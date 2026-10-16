import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, readdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { serialize, parse, BINDING, type StateDocument } from '../document/index.js';
import { FakeAdapter } from '../adapters/fake/adapter.js';
import { IdentityRegistry } from '../bindings/identity-registry.js';
import { Executor } from '../engine/index.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { exportMidi } from '../midi/conversion.js';
import { EOT, SIMPLE_MIDI, midiDocument, smfFixture } from '../midi/fixtures.js';
import { AGENT_NATIVE_TOOL_PROFILE, callTool, registerTools } from './tools.js';
import { workspaceOf, type Workspace } from './workspace.js';
import { writeMidiFile } from './midi-files.js';

type Wire = Record<string, any>;
const offline = new Proxy({} as Workspace, { get(_t, key) { throw new Error(`Host workspace access: ${String(key)}`); } });
const call = (name: string, args: unknown) => callTool(offline, name, args, AGENT_NATIVE_TOOL_PROFILE) as Promise<Wire>;
async function files(t: { after: (fn: () => Promise<void>) => void }) {
  const dir = await mkdtemp(join(tmpdir(), 'ghostnote-midi-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

test('a Launcher read exports directly with its observed field coverage', async t => {
  const dir = await files(t), fake = new FakeAdapter({ tracks: ['midi-source'], scenes: 1 });
  let id = 0;
  const workspace = workspaceOf({ ready: async () => undefined, adapter: fake,
    executor: new Executor(fake, { newId: () => `midi-${++id}`, now: () => id }),
    stash: new Stash({ now: () => id }), observationStore: new FakeObservationStore(), documents: new IdentityRegistry() });
  const trackId = fake.model.visibleTracks()[0]!.channelId, source = midiDocument(3);
  source.events[0]!.channel = 16; source.events[0]!.releaseVelocity = 0;
  const added = await callTool(workspace, 'add_launcher_clip', { trackId, row: 0,
    document: serialize(source, 'fields') }, AGENT_NATIVE_TOOL_PROFILE) as Wire;
  assert.equal(added.applied, true, JSON.stringify(added));
  const read = await callTool(workspace, 'read_launcher_clip', { trackId, row: 0 }, AGENT_NATIVE_TOOL_PROFILE) as Wire;
  const snapshot = parse(read.data.document, 'fields') as StateDocument;
  assert.equal(snapshot.kind, 'snapshot');
  assert.ok(Array.isArray(snapshot.coverage[0]!.fields));
  assert.equal(snapshot.coverage[0]!.fields.includes('articulation'), false);
  const path = join(dir, 'snapshot.mid');
  const write = await call('write_midi_file', { path, document: read.data.document, bpm: 110 });
  assert.equal(write.readback.status, 'verified', JSON.stringify(write));
  const recovered = await call('read_midi_file', { path });
  const values = (doc: StateDocument) => doc.events.map(({ id, clip, ...note }) => note);
  assert.deepEqual(values(parse(recovered.data.document, 'fields') as StateDocument), values(snapshot));
});

test('missing snapshot MIDI fields refuse before publication and cannot be accepted as loss', async () => {
  const document = midiDocument(); document.kind = 'snapshot'; document.coverage[0]!.fields = [...BINDING];
  let published = false;
  const result = await writeMidiFile({ path: '/unused.mid', format: 'json', document: { ...document }, acceptLoss: true }, {
    publish: async () => { published = true; }, read: async () => Buffer.alloc(0),
  }) as Wire;
  assert.equal(published, false);
  assert.equal(result.failure.stage, 'input');
  assert.equal(result.failure.code, 'invalid-input');
  assert.deepEqual(result.detail, { clip: 'c1', missingFields: ['releaseVelocity'] });
});

test('MIDI tools read, convert, write and verify with no workspace or host access', async t => {
  const dir = await files(t), input = join(dir, 'source.mid'), output = join(dir, 'edited.mid');
  await writeFile(input, SIMPLE_MIDI);
  const read = await call('read_midi_file', { path: input, targetBpm: 120 });
  assert.equal(read.failure, undefined, JSON.stringify(read));
  const doc = parse(read.data.document, 'fields') as StateDocument;
  assert.equal(doc.events[0]!.duration, '2');
  doc.events[0]!.pitch = 62;
  const write = await call('write_midi_file', { path: output, document: serialize(doc, 'fields') });
  assert.equal(write.applied, true, JSON.stringify(write));
  assert.equal(write.readback.status, 'verified');
  assert.deepEqual(write.effects, []);
  assert.equal(write.file.reversible, false);
  const again = await call('read_midi_file', { path: output });
  const result = parse(again.data.document, 'fields') as StateDocument;
  assert.equal(result.events[0]!.pitch, 62);
  assert.equal(result.events[0]!.duration, '2');
  assert.deepEqual((await readdir(dir)).sort(), ['edited.mid', 'source.mid']);
});

test('full inline output has every note beyond 24,000 characters', async t => {
  const dir = await files(t), input = join(dir, 'large.mid');
  await writeFile(input, exportMidi(midiDocument(2000)).bytes);
  const read = await call('read_midi_file', { path: input });
  assert.ok(read.data.document.length > 24000);
  assert.equal((parse(read.data.document, 'fields') as StateDocument).events.length, 2000);
  assert.equal(read.coverage.notes, 2000);
  assert.equal(read.data.report.notes, 2000);
  assert.ok(JSON.stringify(read.data.report).length < 2000);
  assert.deepEqual(await readdir(dir), ['large.mid']);
});

test('a 512-event tempo map gives a bounded read report; the document keeps each change (8i20, E270)', async t => {
  const dir = await files(t), input = join(dir, 'tempo.mid');
  // 512 tempo events, 125 BPM and 120 BPM in pairs, each 250 ticks apart; one note over all of them.
  const us = (bpm: number) => { const v = 60000000 / bpm; return [v >> 16, (v >> 8) & 255, v & 255]; };
  const track = [0, 0x90, 60, 90];
  for (let i = 0; i < 512; i++) track.push(...(i ? [0x81, 0x7a] : [0]), 255, 81, 3, ...us(i % 4 < 2 ? 125 : 120));
  track.push(0x81, 0x7a, 0x80, 60, 40, ...EOT);
  await writeFile(input, smfFixture([track]));
  const inline = await call('read_midi_file', { path: input });
  assert.deepEqual(inline.data.report.sourceTempo, { events: 512, changes: 256, equalMerged: 256, firstBpm: 125, minBpm: 120, maxBpm: 125 });
  assert.equal((parse(inline.data.document, 'fields') as StateDocument).overlays.filter(o => o.type === 'tempo').length, 256);
  const filed = await call('read_midi_file', { path: input, documentOutputPath: join(dir, 'tempo.gndoc') });
  assert.equal(filed.data.documentFile.readback.status, 'verified');
  assert.ok(JSON.stringify(filed).length <= 4096, String(JSON.stringify(filed).length));
});

test('JSON document input and FIELDS export use identical MIDI bytes', async t => {
  const dir = await files(t), document = midiDocument();
  const json = await call('write_midi_file', { path: join(dir, 'json.mid'), format: 'json', document });
  const fields = await call('write_midi_file', { path: join(dir, 'fields.mid'), document: serialize(document, 'fields') });
  assert.equal(json.file.sha256, fields.file.sha256);
  const wrong = await call('write_midi_file', { path: join(dir, 'wrong.mid'), document });
  assert.equal(wrong.failure.code, 'invalid-input');
});

test('existing files and symlinks refuse; no file is replaced and staging is removed', async t => {
  const dir = await files(t), path = join(dir, 'keep.mid'), alias = join(dir, 'alias.mid');
  await writeFile(path, 'keep'); await symlink(path, alias);
  for (const target of [path, alias]) {
    const result = await call('write_midi_file', { path: target, format: 'json', document: midiDocument() });
    assert.equal(result.failure.code, 'occupied');
  }
  assert.equal((await readFile(path)).toString(), 'keep');
  assert.deepEqual((await readdir(dir)).sort(), ['alias.mid', 'keep.mid']);
  const input = await call('read_midi_file', { path: alias });
  assert.equal(input.failure.code, 'unsupported');
});

test('concurrent publication creates one complete file and refuses the other writer', async t => {
  const dir = await files(t), path = join(dir, 'race.mid');
  const documents = [midiDocument(), midiDocument()];
  documents[1]!.events[0]!.pitch = 70;
  const results = await Promise.all(documents.map(document => call('write_midi_file', { path, format: 'json', document })));
  const winner = results.findIndex(result => result.applied === true);
  assert.ok(winner >= 0);
  assert.equal(results[1 - winner]!.failure.code, 'occupied');
  assert.deepEqual(await readFile(path), exportMidi(documents[winner]!).bytes);
  assert.deepEqual(await readdir(dir), ['race.mid']);
});

test('absent, malformed, directory and relative paths fail without writes', async t => {
  const dir = await files(t);
  await writeFile(join(dir, 'bad.mid'), 'not midi');
  for (const [path, code] of [[join(dir, 'missing.mid'), 'absent'], [join(dir, 'bad.mid'), 'invalid-input'], [dir, 'invalid-input']]) {
    const result = await call('read_midi_file', { path }); assert.equal(result.failure.code, code);
  }
  await assert.rejects(call('read_midi_file', { path: 'relative.mid' }));
  const invalid = await call('write_midi_file', { path: join(dir, 'new.mid'), document: 'invalid' });
  assert.equal(invalid.failure.code, 'invalid-input');
  const missing = await call('write_midi_file', { path: join(dir, 'absent', 'new.mid'), format: 'json', document: midiDocument() });
  assert.equal(missing.failure.code, 'absent');
  assert.deepEqual(await readdir(dir), ['bad.mid']);
});

test('loss refusal happens before publication; publication error returns no applied effect', async () => {
  let writes = 0;
  const document = midiDocument(); document.events[0]!.mute = true;
  const io = { publish: async () => { writes++; throw new Error('disk failure'); }, read: async () => Buffer.alloc(0) };
  const refusal = await writeMidiFile({ path: '/unused.mid', format: 'json', document: { ...document } }, io) as Wire;
  assert.equal(refusal.failure.code, 'unsupported');
  assert.deepEqual(refusal.detail.losses, [{ code: 'muted-notes-omitted', count: 1 }]);
  assert.equal(writes, 0);
  const failure = await writeMidiFile({ path: '/unused.mid', format: 'json', document: { ...midiDocument() } }, io) as Wire;
  assert.equal(failure.failure.stage, 'write');
  assert.equal(failure.applied, undefined);
});

test('MCP registration returns the full inline document in its text result', async t => {
  const dir = await files(t), path = join(dir, 'mcp.mid');
  await writeFile(path, exportMidi(midiDocument(2000)).bytes);
  const callbacks = new Map<string, (args: unknown, extra: object) => Promise<any>>();
  registerTools({ registerTool: (name: string, _spec: unknown, callback: any) => callbacks.set(name, callback) } as any,
    offline, AGENT_NATIVE_TOOL_PROFILE);
  const result = await callbacks.get('read_midi_file')!({ path }, {});
  const body = JSON.parse(result.content[0].text);
  assert.ok(result.content[0].text.length > 24000);
  assert.equal((parse(body.data.document, 'fields') as StateDocument).events.length, 2000);
});
