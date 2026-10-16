import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { FakeAdapter } from '../adapters/fake/adapter.js';
import { IdentityRegistry } from '../bindings/identity-registry.js';
import { parse, serialize, type StateDocument } from '../document/index.js';
import { Executor } from '../engine/index.js';
import { SIMPLE_MIDI, midiDocument } from '../midi/fixtures.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { detectEncoding, publishDocumentFile } from './document-files.js';
import { AGENT_NATIVE_TOOL_PROFILE, callTool } from './tools.js';
import { workspaceOf, type Workspace } from './workspace.js';

type Wire = Record<string, any>;
const offline = new Proxy({} as Workspace, { get(_t, key) { throw new Error(`Host workspace access: ${String(key)}`); } });
const call = (name: string, args: unknown, workspace = offline) =>
  callTool(workspace, name, args, AGENT_NATIVE_TOOL_PROFILE) as Promise<Wire>;
async function files(t: { after: (fn: () => Promise<void>) => void }) {
  const dir = await mkdtemp(join(tmpdir(), 'ghostnote-document-file-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}
function liveFixture() {
  const fake = new FakeAdapter({ tracks: ['gn-files'], scenes: 3 });
  let id = 0;
  const workspace = workspaceOf({ ready: async () => undefined, adapter: fake,
    executor: new Executor(fake, { newId: () => `file-${++id}`, now: () => id }),
    stash: new Stash({ now: () => id }), observationStore: new FakeObservationStore(), documents: new IdentityRegistry() });
  return { workspace, trackId: fake.model.visibleTracks()[0]!.channelId };
}
const values = (doc: StateDocument) => doc.events.map(({ id, clip, ...note }) => note);

test('encoding detection reads the first record', () => {
  assert.equal(detectEncoding('DOC ghostnote-document 1.0 desired\n'), 'fields');
  assert.equal(detectEncoding(' \t\r\nDOC\tghostnote-document 1.0 patch'), 'fields');
  assert.equal(detectEncoding('\n  {"format":"ghostnote-document"}'), 'json');
  assert.equal(detectEncoding('DOCUMENT'), undefined);
  assert.equal(detectEncoding('# notes\nDOC ghostnote-document 1.0 desired'), undefined);
  assert.equal(detectEncoding(''), undefined);
});

test('read_midi_file writes its document to a new file and holds no inline document', async t => {
  const dir = await files(t);
  await writeFile(join(dir, 'source.mid'), SIMPLE_MIDI);
  const inline = await call('read_midi_file', { path: join(dir, 'source.mid') });
  const out = join(dir, 'source.gndoc');
  const filed = await call('read_midi_file', { path: join(dir, 'source.mid'), documentOutputPath: out });
  assert.equal(filed.failure, undefined, JSON.stringify(filed));
  assert.equal(filed.data.document, undefined);
  assert.equal(filed.data.documentBytes, undefined);
  assert.equal(filed.data.documentFile.path, out);
  assert.equal(filed.data.documentFile.format, 'fields');
  assert.equal(filed.data.documentFile.readback.status, 'verified');
  assert.equal(await readFile(out, 'utf8'), inline.data.document);
  assert.equal(filed.data.documentFile.bytes, inline.data.documentBytes);
  assert.deepEqual(filed.data.report, inline.data.report);
  assert.deepEqual((await readdir(dir)).sort(), ['source.gndoc', 'source.mid']);

  const again = await call('read_midi_file', { path: join(dir, 'source.mid'), documentOutputPath: out });
  assert.equal(again.failure.code, 'occupied');
  assert.equal(again.failure.stage, 'input');
  assert.equal(await readFile(out, 'utf8'), inline.data.document);
  const noParent = await call('read_midi_file', { path: join(dir, 'source.mid'), documentOutputPath: join(dir, 'none', 'a.gndoc') });
  assert.equal(noParent.failure.code, 'invalid-input');
  // The destination check runs before the MIDI read: a missing source with an occupied destination names the destination.
  const first = await call('read_midi_file', { path: join(dir, 'missing.mid'), documentOutputPath: out });
  assert.equal(first.failure.code, 'occupied');
  await assert.rejects(call('read_midi_file', { path: join(dir, 'source.mid'), documentOutputPath: 'a.gndoc' }), /absolute path/);
});

test('write_midi_file takes documentPath in either encoding and reports the detected format', async t => {
  const dir = await files(t);
  const document = midiDocument(3);
  await writeFile(join(dir, 'a.gndoc'), serialize(document, 'fields'));
  await writeFile(join(dir, 'b.gndoc.json'), serialize(document, 'json'));
  for (const [name, format] of [['a.gndoc', 'fields'], ['b.gndoc.json', 'json']] as const) {
    const path = join(dir, `${name}.mid`);
    const write = await call('write_midi_file', { path, documentPath: join(dir, name) });
    assert.equal(write.readback.status, 'verified', JSON.stringify(write));
    assert.equal(write.documentFile.format, format);
    assert.equal(write.documentFile.path, join(dir, name));
    const recovered = await call('read_midi_file', { path });
    assert.deepEqual(values(parse(recovered.data.document, 'fields') as StateDocument), values(document));
  }
  const both = await call('write_midi_file', { path: join(dir, 'c.mid'), documentPath: join(dir, 'a.gndoc'),
    document: serialize(document, 'fields') });
  assert.equal(both.failure.code, 'invalid-input');
  const neither = await call('write_midi_file', { path: join(dir, 'c.mid') });
  assert.equal(neither.failure.code, 'invalid-input');
  const withFormat = await call('write_midi_file', { path: join(dir, 'c.mid'), documentPath: join(dir, 'a.gndoc'), format: 'fields' });
  assert.equal(withFormat.failure.code, 'invalid-input');
  assert.match(withFormat.message, /Omit format/);
  assert.deepEqual((await readdir(dir)).filter((name) => name.startsWith('c')), []);
});

test('document files refuse unreadable or unrecognized content before any parse or write', async t => {
  const dir = await files(t), path = join(dir, 'out.mid');
  const cases: [string, Buffer | string, string][] = [
    ['prose.gndoc', 'Here is the clip:\nDOC ghostnote-document 1.0 desired\n', 'invalid-input'],
    ['latin1.gndoc', Buffer.from([0x44, 0x4f, 0x43, 0x20, 0xff, 0x0a]), 'invalid-input'],
    ['bom.gndoc', `﻿${serialize(midiDocument(), 'fields')}`, 'invalid-input'],
  ];
  for (const [name, content, code] of cases) {
    await writeFile(join(dir, name), content);
    const result = await call('write_midi_file', { path, documentPath: join(dir, name) });
    assert.equal(result.failure?.code, code, `${name}: ${JSON.stringify(result)}`);
  }
  await symlink(join(dir, 'prose.gndoc'), join(dir, 'link.gndoc'));
  assert.equal((await call('write_midi_file', { path, documentPath: join(dir, 'link.gndoc') })).failure.code, 'unsupported');
  assert.equal((await call('write_midi_file', { path, documentPath: join(dir, 'missing.gndoc') })).failure.code, 'absent');
  await mkdir(join(dir, 'folder.gndoc'));
  assert.equal((await call('write_midi_file', { path, documentPath: join(dir, 'folder.gndoc') })).failure.code, 'invalid-input');
  await writeFile(join(dir, 'large.gndoc'), Buffer.alloc(8 * 1024 * 1024 + 1, 0x20));
  assert.equal((await call('write_midi_file', { path, documentPath: join(dir, 'large.gndoc') })).failure.code, 'outside-limit');
  assert.equal((await readdir(dir)).includes('out.mid'), false);
});

test('a clip round trip uses files only: add, read to a file, edit from a file, export from a file', async t => {
  const dir = await files(t), { workspace, trackId } = liveFixture();
  const source = midiDocument(4);
  await writeFile(join(dir, 'new.gndoc'), serialize(source, 'fields'));
  const added = await call('add_launcher_clip', { trackId, row: 0, documentPath: join(dir, 'new.gndoc') }, workspace);
  assert.equal(added.applied, true, JSON.stringify(added));
  assert.deepEqual(Object.keys(added.documentFile).sort(), ['bytes', 'format', 'path', 'sha256']);
  assert.equal(added.documentFile.format, 'fields');

  const out = join(dir, 'read.gndoc.json');
  const read = await call('read_launcher_clip', { trackId, row: 0, format: 'json', documentOutputPath: out }, workspace);
  assert.equal(read.failure, undefined, JSON.stringify(read));
  assert.equal(read.data.document, undefined);
  assert.equal(read.data.documentFile.format, 'json');
  assert.equal(read.data.documentFile.readback.status, 'verified');
  const snapshot = parse(await readFile(out, 'utf8'), 'json') as StateDocument;
  assert.equal(snapshot.kind, 'snapshot');
  assert.deepEqual(values(snapshot).map((note) => note.pitch), values(source).map((note) => note.pitch));
  const inline = await call('read_launcher_clip', { trackId, row: 0, format: 'json' }, workspace);
  assert.deepEqual(JSON.parse(await readFile(out, 'utf8')), inline.data.document);

  // A script makes a patch from the file and the base of the read.
  const patch = { format: 'ghostnote-document', version: '1.0', kind: 'patch', base: read.authority.base,
    add: [], remove: [], clipUpdate: [], overlayPut: [], overlayRemove: [],
    update: [{ id: snapshot.events[0]!.id, set: { velocity: 33 } }] };
  await writeFile(join(dir, 'patch.gndoc.json'), JSON.stringify(patch));
  const edited = await call('edit_launcher_clip', { trackId, row: 0, documentPath: join(dir, 'patch.gndoc.json'),
    readback: 'document' }, workspace);
  assert.equal(edited.applied, true, JSON.stringify(edited));
  assert.equal(edited.documentFile.format, 'json');
  // format sets the returned document: fields by default, also for a JSON input file.
  assert.match(edited.readback.document, /^DOC ghostnote-document 1\.0 snapshot/);

  const final = join(dir, 'final.gndoc');
  const after = await call('read_launcher_clip', { trackId, row: 0, documentOutputPath: final }, workspace);
  assert.equal(after.data.documentFile.format, 'fields');
  const midi = await call('write_midi_file', { path: join(dir, 'final.mid'), documentPath: final, bpm: 110 });
  assert.equal(midi.readback.status, 'verified', JSON.stringify(midi));
  const recovered = await call('read_midi_file', { path: join(dir, 'final.mid') });
  const notes = (parse(recovered.data.document, 'fields') as StateDocument).events;
  assert.equal(notes.find((note) => note.pitch === source.events[0]!.pitch)!.velocity, 33);

  const empty = join(dir, 'empty.gndoc');
  const none = await call('read_launcher_clip', { trackId, row: 1, documentOutputPath: empty }, workspace);
  assert.equal(none.data.occupancy, 'empty');
  assert.equal((await readdir(dir)).includes('empty.gndoc'), false);
});

test('write_midi_file keeps codec line and repair for a document file and an inline document', async t => {
  const dir = await files(t), broken = serialize(midiDocument(2), 'fields').replace(/ 1\/2 /, ' 0.5 ');
  await writeFile(join(dir, 'broken.gndoc'), broken);
  for (const input of [{ documentPath: join(dir, 'broken.gndoc') }, { document: broken }]) {
    const result = await call('write_midi_file', { path: join(dir, 'out.mid'), ...input });
    assert.equal(result.failure.code, 'invalid-input', JSON.stringify(result));
    assert.equal(result.failure.stage, 'input');
    assert.equal(result.detail.line, broken.split('\n').findIndex((line) => line.includes(' 0.5 ')) + 1);
    assert.equal(typeof result.detail.column, 'number');
    assert.ok(result.detail.repair !== undefined, JSON.stringify(result.detail));
  }
  assert.equal((await readdir(dir)).includes('out.mid'), false);
});

test('a codec refusal from a document file keeps its rule, line, and repair', async t => {
  const dir = await files(t), { workspace, trackId } = liveFixture();
  const broken = serialize(midiDocument(2), 'fields').replace(/ 1\/2 /, ' 0.5 ');
  await writeFile(join(dir, 'broken.gndoc'), broken);
  const result = await call('add_launcher_clip', { trackId, row: 0, documentPath: join(dir, 'broken.gndoc') }, workspace);
  assert.equal(result.failure.code, 'invalid-input');
  assert.equal(result.failure.stage, 'input');
  assert.equal(typeof result.detail.line, 'number');
  const snapshotFile = join(dir, 'snapshot.gndoc');
  await call('add_launcher_clip', { trackId, row: 1, document: serialize(midiDocument(1), 'fields') }, workspace);
  await call('read_launcher_clip', { trackId, row: 1, documentOutputPath: snapshotFile }, workspace);
  const notEdit = await call('edit_launcher_clip', { trackId, row: 1, documentPath: snapshotFile }, workspace);
  assert.equal(notEdit.failure.code, 'invalid-input');
  assert.ok(notEdit.detail.repair !== undefined);
  const neither = await call('edit_launcher_clip', { trackId, row: 1 }, workspace);
  assert.match(neither.message, /exactly one of document and documentPath/);
});

for (const mode of ['differs', 'unavailable'] as const) {
  test(`8i19 document output: ${mode} verification keeps the published file`, async () => {
    let published = false;
    const result = await publishDocumentFile('ghostnote-midi-file-read/1', '/test.gndoc', 'DOC ghostnote-document 1.0 desired\n', 'fields', {
      publish: async () => { published = true; },
      read: async () => { if (mode === 'unavailable') throw new Error('injected readback failure'); return Buffer.from('other'); },
    });
    assert.equal(published, true);
    assert.equal(result.documentFile.readback['status'], mode);
    assert.equal(result.warnings.length, mode === 'unavailable' ? 1 : 0);
  });
}
