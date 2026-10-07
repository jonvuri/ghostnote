/**
 * 8h4b document read and identity registry. Live driver. Use an owned unsaved project; refuse the saved anchor (D29).
 * The identity registry is in process memory, so one `accept` run spans the operator edits.
 *
 *   accept <dir>            create gn-8h4b-doc and rewrite a typical clip in row 0 (E231 density). Then:
 *                           two reads (equal ref and IDs); the timing and bytes of one typical read; an operator
 *                           velocity edit and a check (stale, equal IDs); an operator pitch edit and a read (the
 *                           edited note has a new ID); a scene append and a check (identity-changed, retired) and a
 *                           read (new IDs). Every projection is compared with an independent raw `clip.read`.
 *   verify-offline <dir>    recompute every claim from the retained artifact
 */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { LiveAdapter } from '../adapters/live/adapter.js';
import { decodeNoteFrame, type NoteFrame, type RawNoteFields } from '../adapters/live/clip-read.js';
import { clip, scene, slot, track, type ClipAddress } from '../contract/index.js';
import { Executor } from '../engine/executor.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { AGENT_NATIVE_TOOL_PROFILE, callTool } from '../surface/tools.js';
import { workspaceOf } from '../surface/workspace.js';
import type { E131Context } from './e131-diagnostic.js';
import { WireTransport } from './phase8h3c-promotion.js';
import { typicalNotes } from './phase8h3e-snapshots-lib.js';
import { parse, type StateDocument } from '../document/index.js';
import {
  NORMAL, SCHEMA, agreement, equivalentExactJson, idsByKey, rawDiff, withIssues, type Wire,
} from './phase8h4b-document-read-lib.js';

const PAGE = 131_072;
const ANCHOR = 'gn-scale-test';
const ROW = 0;
const transport = new WireTransport();
const adapter = new LiveAdapter({ transport });
const workspace = workspaceOf({
  ready: async () => undefined, adapter, executor: new Executor(adapter), stash: new Stash(),
  observationStore: new FakeObservationStore(),
});
const request = async (method: string, params?: Wire): Promise<Wire> =>
  await transport.send({ method, ...(params ? { params } : {}) }) as Wire;
const tool = async (name: string, args: Wire): Promise<Wire> =>
  await callTool(workspace, name, args, AGENT_NATIVE_TOOL_PROFILE) as Wire;
const pause = async (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));
async function until(next: () => Promise<Wire>, done: (value: Wire) => boolean, limit = 30_000): Promise<Wire> {
  const started = performance.now();
  for (;;) {
    const value = await next(); if (done(value)) return value;
    assert(performance.now() - started < limit, `live state did not settle: ${JSON.stringify(value).slice(0, 400)}`);
    await pause(50);
  }
}
const say = (value: Wire): void => console.log(JSON.stringify(value));

async function guard(): Promise<Wire> {
  const hello = await request('contract.hello');
  assert.deepEqual([hello.runtimeProfile, hello.methodCount, hello.methodsHash], NORMAL);
  const mark = await request('revision.get');
  assert(/^New \d+$/.test(mark.project) && mark.project !== ANCHOR, `use an owned unsaved project, got ${mark.project}`);
  const rig = await request('rig.info');
  assert.equal(rig.clipReader?.revision, 'clip-reader-v3');
  await adapter.hello();
  return { hello, mark, rig };
}
async function indexOf(id: string): Promise<number> {
  const found = ((await request('track.list')).tracks as Wire[]).find(row => row.channelId === id);
  assert(found !== undefined, `track ${id} is missing`);
  return Number(found.index);
}
async function clipOf(id: string, row: number): Promise<ClipAddress> {
  return clip(slot(track(id), scene(row, (await adapter.revision()).sceneEpoch)));
}
async function createTrack(name: string): Promise<string> {
  const before = new Set(((await request('track.list')).tracks as Wire[]).map(row => row.channelId));
  await request('track.create', { position: 0 });
  const after = await until(() => request('track.list'),
    value => (value.tracks as Wire[]).some(row => row.index === 0 && !before.has(row.channelId)));
  const id = String((after.tracks as Wire[]).find(row => row.index === 0)!.channelId);
  await request('track.setName', { trackIndex: 0, name }); return id;
}
/** Write one typical clip with the fine writer cursor. It is not the reader under test. */
async function writeTypical(id: string, row: number): Promise<void> {
  const index = await indexOf(id);
  if ((await request('slot.status', { trackIndex: index, slotIndex: row })).hasContent === true) {
    await request('slot.delete', { trackIndex: index, slotIndex: row });
    await until(() => request('slot.status', { trackIndex: index, slotIndex: row }), value => value.hasContent !== true);
  }
  await request('clip.create', { trackIndex: index, slotIndex: row, lengthBeats: 64 });
  await until(() => request('slot.status', { trackIndex: index, slotIndex: row }), value => value.hasContent === true);
  await (adapter as unknown as E131Context).pointAtClip(await clipOf(id, row), index, new Map(), 'fine');
  await request('cursor.setStepSize', { cursor: 'fine', stepSize: 1 / 4 });
  for (const [channel, notes] of typicalNotes(0).entries()) await request('cursor.setNotes', { cursor: 'fine', channel, notes });
  await pause(500);
  assert.equal((await rawRead(id, row)).length, 256);
}
/**
 * The independent raw read: `clip.read` and its pages, decoded. A read that overlaps an operator edit refuses
 * (`step-delta`); retry it up to five times.
 */
async function rawRead(id: string, row: number): Promise<RawNoteFields[]> {
  const index = await indexOf(id);
  let result = await request('clip.read', { trackIndex: index, row, channelId: id });
  for (let attempt = 0; result.refused !== undefined && attempt < 5; attempt++) {
    say({ rawReadRefused: result.refused, attempt });
    await pause(500);
    result = await request('clip.read', { trackIndex: index, row, channelId: id });
  }
  assert.equal(result.refused, undefined, `raw read refused: ${result.refused} ${result.message ?? ''}`);
  const rows: RawNoteFields[] = [];
  let frame = result.frame as NoteFrame;
  for (;;) {
    rows.push(...decodeNoteFrame(frame, PAGE));
    if (frame.next < 0) break;
    frame = await request('clip.readPage', { readId: result.readId, from: frame.next }) as NoteFrame;
  }
  return rows;
}
/** Wait for an operator edit: the raw read differs from `before` and then holds for two more reads. */
async function operatorEdit(id: string, before: RawNoteFields[], instruction: string): Promise<RawNoteFields[]> {
  say({ operator: instruction });
  const same = (a: RawNoteFields[], b: RawNoteFields[]): boolean => {
    const d = rawDiff(a, b); return d.removed.length + d.added.length + d.changed.length === 0;
  };
  for (;;) {
    const now = await rawRead(id, ROW);
    if (!same(before, now)) {
      await pause(1500);
      const settled = await rawRead(id, ROW);
      await pause(1500);
      if (same(settled, await rawRead(id, ROW))) return settled;
    }
    await pause(500);
  }
}

/** One read through the tool, with driver wall time, result bytes, and the wire bytes of the calls. */
async function timedRead(id: string, format: 'fields' | 'json' = 'fields'): Promise<Wire> {
  const calls = transport.calls.length;
  const started = performance.now();
  const result = await tool('read_launcher_clip', { trackId: id, row: ROW, format });
  const wallMs = performance.now() - started;
  const wire = transport.calls.slice(calls);
  assert.equal(result.failure, undefined, JSON.stringify(result).slice(0, 600));
  return {
    result, wallMs, resultBytes: Buffer.byteLength(JSON.stringify(result)),
    documentBytes: Buffer.byteLength(typeof result.data.document === 'string' ? result.data.document : JSON.stringify(result.data.document)),
    wireCalls: wire.length, wireBytes: wire.reduce((sum, call) => sum + Number(call.bytes ?? 0), 0),
    methods: [...new Set(wire.map(call => call.method))],
  };
}

async function accept(dir: string): Promise<void> {
  const entry = await guard();
  const existing = ((await request('track.list')).tracks as Wire[]).find(row => row.name === 'gn-8h4b-doc');
  const id = existing === undefined ? await createTrack('gn-8h4b-doc') : String(existing.channelId);
  await writeTypical(id, ROW);
  const raw0 = await rawRead(id, ROW);
  const out: Wire = { schema: SCHEMA, entry, trackId: id, row: ROW, raw0 };

  // 1. Two reads, then timing and bytes.
  const first = await timedRead(id);
  const second = await timedRead(id);
  const json = await timedRead(id, 'json');
  const repeats: Wire[] = [];
  for (let i = 0; i < 5; i++) repeats.push(await timedRead(id));
  out.reads = { first, second, json, repeats: repeats.map(({ result: _r, ...rest }) => rest),
    rawAfter: await rawRead(id, ROW) };
  say({ step: 'reads', identity: [first.result.authority.identity, second.result.authority.identity],
    sameRef: first.result.authority.base.ref === second.result.authority.base.ref,
    sameDocument: first.result.data.document === second.result.data.document,
    agreement: agreement(first.result.data.document, raw0).length,
    wallMs: first.wallMs, resultBytes: first.resultBytes, documentBytes: first.documentBytes,
    jsonDocumentBytes: json.documentBytes, wireBytes: first.wireBytes });
  const ref1 = String(first.result.authority.base.ref);

  // 2. Operator velocity edit, then a check.
  const raw1 = await operatorEdit(id, raw0, 'In gn-8h4b-doc row 1 (scene 1), change the velocity of the first note '
    + '(beat 1.1.1, C1 / pitch 36, MIDI channel 1) from 100 to about 50. Change nothing else.');
  const velocityCheck = await tool('check_launcher_clips', { refs: [ref1] });
  out.velocity = { raw: raw1, diff: rawDiff(raw0, raw1), check: velocityCheck };
  const v = velocityCheck.data.results[0] as Wire;
  say({ step: 'velocity', diff: out.velocity.diff, verdict: v.verdict, retained: v.retainedIds, minted: v.mintedIds,
    sameIds: v.document === undefined ? null : JSON.stringify([...idsByKey(v.document)]) === JSON.stringify([...idsByKey(first.result.data.document)]),
    agreement: v.document === undefined ? null : agreement(v.document, raw1).length });

  // 3. Operator pitch edit, then a read.
  const raw2 = await operatorEdit(id, raw1, 'In the same clip, move the note at beat 1.3.1 (channel 9, pitch 44 / G#1) '
    + 'up one semitone to pitch 45 / A1. Keep its start and length.');
  const pitched = await timedRead(id);
  out.pitch = { raw: raw2, diff: rawDiff(raw1, raw2), read: pitched };
  say({ step: 'pitch', diff: out.pitch.diff, identity: pitched.result.authority.identity,
    retained: pitched.result.authority.retainedIds, minted: pitched.result.authority.mintedIds,
    agreement: agreement(pitched.result.data.document, raw2).length });

  // 4. Scene append: the ref retires; the next read mints new IDs.
  const ref2 = String(pitched.result.authority.base.ref);
  const scenes = Number((await request('scene.count')).sceneCount);
  await adapter.apply({ ops: [{ op: 'scene.create', count: 1 }] });
  await until(() => request('scene.count'), value => Number(value.sceneCount) === scenes + 1);
  await pause(500);
  const sceneCheck = await tool('check_launcher_clips', { refs: [ref2, ref1] });
  const afterScene = await timedRead(id);
  const raw3 = await rawRead(id, ROW);
  out.scene = { scenes: [scenes, scenes + 1], check: sceneCheck, read: afterScene, raw: raw3 };
  say({ step: 'scene', verdicts: (sceneCheck.data.results as Wire[]).map(item => [item.verdict, item.retired, item.code]),
    identity: afterScene.result.authority.identity, agreement: agreement(afterScene.result.data.document, raw3).length });
  // Remove the appended scene again; the project is discarded after the run.
  const appended = scene(scenes, (await adapter.revision()).sceneEpoch);
  await adapter.apply({ ops: [{ op: 'scene.delete', scene: appended }] });
  await until(() => request('scene.count'), value => Number(value.sceneCount) === scenes);

  const stats = await request('rig.stats');
  out.stats = stats.clipReader;
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'accept.json.gz'), gzipSync(JSON.stringify(out) + '\n'));
  const result = await verify(out);
  console.log(JSON.stringify(result, null, 1));
  if (result.issues.length > 0) process.exitCode = 1;
}

/** Recompute every claim from the artifact. */
export async function verify(a: Wire): Promise<{ issues: string[]; summary: Wire }> {
  const issues: string[] = [];
  const doc = (read: Wire): string => read.result.data.document;
  const { first, second } = a.reads;
  if (first.result.authority.identity !== 'new') issues.push('first read is not new');
  if (second.result.authority.identity !== 'current') issues.push('second read is not current');
  if (first.result.authority.base.ref !== second.result.authority.base.ref) issues.push('repeated read changed the ref');
  if (doc(first) !== doc(second)) issues.push('repeated read changed the document');
  issues.push(...agreement(doc(first), a.raw0).map(issue => `first: ${issue}`));
  issues.push(...withIssues(doc(first), a.raw0).map(issue => `first: ${issue}`));
  if (rawDiff(a.raw0, a.reads.rawAfter).changed.length > 0) issues.push('the reads changed the clip');

  const vd = a.velocity.diff;
  if (vd.removed.length + vd.added.length !== 0 || vd.changed.length !== 1
    || JSON.stringify(vd.changed[0].fields) !== '["velocity"]') issues.push(`velocity edit diff: ${JSON.stringify(vd)}`);
  const v = a.velocity.check.data.results[0];
  if (v.verdict !== 'stale') issues.push(`velocity check verdict ${v.verdict}`);
  else {
    if (JSON.stringify([...idsByKey(v.document)]) !== JSON.stringify([...idsByKey(doc(first))])) issues.push('velocity edit changed IDs');
    if (v.retainedIds !== 256 || v.mintedIds !== 0) issues.push(`velocity retained ${v.retainedIds} minted ${v.mintedIds}`);
    issues.push(...agreement(v.document, a.velocity.raw).map(issue => `velocity: ${issue}`));
    issues.push(...withIssues(v.document, a.velocity.raw).map(issue => `velocity: ${issue}`));
  }

  const pd = a.pitch.diff;
  if (pd.removed.length !== 1 || pd.added.length !== 1 || pd.changed.length !== 0) issues.push(`pitch edit diff: ${JSON.stringify(pd)}`);
  const pitched = a.pitch.read.result;
  if (pitched.authority.identity !== 'stale') issues.push(`pitch read identity ${pitched.authority.identity}`);
  const before = v.document === undefined ? new Map<string, string>() : idsByKey(v.document);
  const after = idsByKey(pitched.data.document);
  for (const [key, eventId] of after) {
    if (key === pd.added[0]) { if ([...before.values()].includes(eventId)) issues.push('the edited note kept an old ID'); }
    else if (before.get(key) !== eventId) issues.push(`unedited note ${key} changed ID`);
  }
  if (pitched.authority.retainedIds !== 255 || pitched.authority.mintedIds !== 1) issues.push('pitch edit retained/minted counts');
  issues.push(...agreement(pitched.data.document, a.pitch.raw).map(issue => `pitch: ${issue}`));

  const verdicts = a.scene.check.data.results as Wire[];
  if (verdicts.some(item => item.verdict !== 'identity-changed' || item.retired !== true)) {
    issues.push(`scene check: ${JSON.stringify(verdicts.map(item => item.verdict))}`);
  }
  const fresh = a.scene.read.result;
  if (fresh.authority.identity !== 'new') issues.push(`scene read identity ${fresh.authority.identity}`);
  const old = new Set(after.values());
  if ([...idsByKey(fresh.data.document).values()].some(eventId => old.has(eventId))) issues.push('scene read kept an old event ID');
  issues.push(...agreement(fresh.data.document, a.scene.raw).map(issue => `scene: ${issue}`));

  const walls = [first, ...a.reads.repeats].map((item: Wire) => item.wallMs).sort((x: number, y: number) => x - y);
  return {
    issues,
    summary: {
      withRows: doc(first).split('\n').filter((line: string) => line.includes(' WITH ')).length,
      bytesPerNote: first.documentBytes / a.raw0.length,
      exactJsonBytes: Buffer.byteLength(equivalentExactJson(parse(doc(first), 'fields') as StateDocument)),
      firstRead: { wallMs: first.wallMs, toolMs: first.result.timing.totalMs, readMs: first.result.timing.readMs,
        resultBytes: first.resultBytes, documentBytes: first.documentBytes, wireCalls: first.wireCalls, wireBytes: first.wireBytes },
      jsonDocumentBytes: a.reads.json.documentBytes, jsonResultBytes: a.reads.json.resultBytes,
      repeatedReadMs: { median: walls[Math.floor(walls.length / 2)], min: walls[0], max: walls[walls.length - 1] },
      velocityCheckMs: a.velocity.check.timing.totalMs, velocityCheckBytes: Buffer.byteLength(JSON.stringify(a.velocity.check)),
      sceneCheckBytes: Buffer.byteLength(JSON.stringify(a.scene.check)),
    },
  };
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  try {
    switch (command) {
      case 'accept': await accept(args[0]!); break;
      case 'verify-offline': {
        const a = JSON.parse(gunzipSync(await readFile(join(args[0]!, 'accept.json.gz'))).toString('utf8'));
        const result = await verify(a);
        console.log(JSON.stringify(result, null, 1)); if (result.issues.length > 0) process.exitCode = 1; return;
      }
      default: throw new Error('usage: accept <dir> | verify-offline <dir>');
    }
  } finally { await transport.close(); }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
