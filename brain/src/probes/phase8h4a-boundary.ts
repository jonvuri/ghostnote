/**
 * 8h4a write boundary and reader hardening. Live driver. Use owned unsaved projects; refuse the saved anchor (D29).
 *
 *   setup <state.json>                      P: edit track, 16 survey clips, guard track, and two child tracks
 *   setup-group <state.json>                P: the two child tracks and the edit track only
 *   metadata <out> <state.json>             each fixture shape: the clip.read block against cursor.clipMetadata
 *   survey <out> <state.json>               16 clips: a current pass, two edits, a second pass; metadata points counted
 *   apply-guard <out> <state.json> <insert|delete>
 *                                           hold an executor batch between its stash read and its apply until
 *                                           the operator inserts (or deletes) a scene above the target
 *   q-setup <state.json>                    Q: one owned track with one typical clip
 *   selection <out> <state.json>            in Q after a selection in P: each tool with an outer selection scope
 *   group <out> <state.json> <expanded|collapsed>
 *                                           after the operator groups the two child tracks: group-slot refusals
 *                                           and child reads and checks
 *   cleanup <out> <state.json> <P|Q>        delete owned tracks and check the entry track IDs
 *   verify-offline <dir>                    recheck the retained claims
 */
import assert from 'node:assert/strict';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { LiveAdapter } from '../adapters/live/adapter.js';
import { decodeNoteFrame, type NoteFrame, type RawNoteFields } from '../adapters/live/clip-read.js';
import {
  StaleAddressError, addressKey, clip, clipMetadata, clipSourceFingerprint, decodeClipSnapshotRef,
  encodeClipSnapshotRef, scene, slot, snapshotAddresses, supportedClipColors, track,
  type BatchRequest, type ClipAddress, type NoteRecord,
} from '../contract/index.js';
import { canonicalJson } from '../document/json.js';
import { Executor } from '../engine/executor.js';
import { acquireClipSnapshot } from '../engine/clip-snapshots.js';
import { NOTE_INVARIANTS_SCHEMA, NOTE_PROPOSAL_SCHEMA, type ExactNoteSource } from '../musical/index.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { STABLE_TOOL_PROFILE, callTool, type ToolProfile } from '../surface/tools.js';
import { EXPERIMENTAL_7B_TOOL_PROFILE, callExperimental7b } from './phase7b-profile.js';
import { workspaceOf } from '../surface/workspace.js';
import type { E131Context } from './e131-diagnostic.js';
import { WireTransport } from './phase8h3c-promotion.js';
import type { Transport } from '../adapters/live/transport.js';
import { sameRaw, typicalNotes, type RawClip, type Wire } from './phase8h3e-snapshots-lib.js';

export const SCHEMA = 'phase8h4a-boundary-v1';
export const NORMAL: readonly [string, number, string] = ['normal-v1', 87, 'ca139a3e62a55e68'];
const PAGE = 131_072;
const ANCHOR = 'gn-scale-test';

/** Record each batch request. */
class RecordingAdapter extends LiveAdapter {
  readonly requests: BatchRequest[] = [];
  override async apply(batch: BatchRequest) {
    this.requests.push(batch);
    return super.apply(batch);
  }
}

const transport = new WireTransport();
/**
 * Hold the next `batch.run` frame on the wire, after every brain-side check and cursor preflight of the apply.
 * Only the extension guard runs after the hold.
 */
let hold: (() => Promise<void>) | undefined;
const holding: Transport = {
  async send(frame) {
    if (frame.method === 'batch.run' && hold !== undefined) {
      const wait = hold; hold = undefined; await wait();
    }
    return transport.send(frame);
  },
  close: () => transport.close(),
};
const adapter = new RecordingAdapter({ transport: holding });
const stash = new Stash();
const workspace = workspaceOf({
  ready: async () => undefined, adapter, executor: new Executor(adapter), stash,
  observationStore: new FakeObservationStore(),
});
const request = async (method: string, params?: Wire): Promise<Wire> =>
  await transport.send({ method, ...(params ? { params } : {}) }) as Wire;
const tool = async (
  name: string, args: Wire, profile: ToolProfile | typeof EXPERIMENTAL_7B_TOOL_PROFILE = EXPERIMENTAL_7B_TOOL_PROFILE,
): Promise<Wire> => await (profile === EXPERIMENTAL_7B_TOOL_PROFILE
  ? callExperimental7b(workspace, name, args) : callTool(workspace, name, args, profile)) as Wire;
const pause = async (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));
const load = async (path: string): Promise<Wire> => JSON.parse(await readFile(path, 'utf8'));
const save = async (path: string, value: unknown): Promise<void> => {
  await mkdir(dirname(path), { recursive: true }); await writeFile(path, JSON.stringify(value, null, 1) + '\n');
};
const artifact = async (path: string, value: unknown): Promise<void> => {
  await mkdir(dirname(path), { recursive: true }); await writeFile(path, gzipSync(JSON.stringify(value) + '\n'));
};
const callsOf = (method: string, from = 0): number => transport.calls.slice(from).filter(c => c.method === method).length;
async function until(next: () => Promise<Wire>, done: (value: Wire) => boolean, limit = 30_000): Promise<Wire> {
  const started = performance.now();
  for (;;) {
    const value = await next(); if (done(value)) return value;
    assert(performance.now() - started < limit, `live state did not settle: ${JSON.stringify(value).slice(0, 400)}`);
    await pause(50);
  }
}

/** The normal profile, the 8h4a markers, and an owned unsaved project. */
async function guard(owned = true): Promise<Wire> {
  const hello = await request('contract.hello');
  assert.deepEqual([hello.runtimeProfile, hello.methodCount, hello.methodsHash], NORMAL);
  const mark = await request('revision.get');
  if (owned) assert(/^New \d+$/.test(mark.project) && mark.project !== ANCHOR, `use an owned unsaved project, got ${mark.project}`);
  const rig = await request('rig.info');
  assert.equal(rig.clipReader?.revision, 'clip-reader-v2');
  assert.equal(rig.writeGuard, 'batch-scene-guard-v1');
  assert.equal(rig.selectionRule, 'selection-project-v1');
  await adapter.hello();
  return { hello, mark, rig };
}
const tracksNow = async (): Promise<Wire[]> => (await request('track.list')).tracks as Wire[];
async function indexOf(id: string): Promise<number | undefined> {
  const found = (await tracksNow()).find(row => row.channelId === id);
  return found === undefined ? undefined : Number(found.index);
}
async function clipOf(id: string, row: number): Promise<ClipAddress> {
  return clip(slot(track(id), scene(row, (await adapter.revision()).sceneEpoch)));
}
async function createTrack(name: string): Promise<string> {
  const before = new Set((await tracksNow()).map(row => row.channelId));
  await request('track.create', { position: 0 });
  const after = await until(() => request('track.list'),
    value => (value.tracks as Wire[]).some(row => row.index === 0 && !before.has(row.channelId)));
  const id = String((after.tracks as Wire[]).find(row => row.index === 0)!.channelId);
  await request('track.setName', { trackIndex: 0, name }); return id;
}
/** Write one typical clip with the fine writer cursor. It is not the reader or the executor under test. */
async function writeTypical(id: string, row: number, offset: number): Promise<void> {
  const index = (await indexOf(id))!;
  await request('clip.create', { trackIndex: index, slotIndex: row, lengthBeats: 64 });
  await until(() => request('slot.status', { trackIndex: index, slotIndex: row }), value => value.hasContent === true);
  await (adapter as unknown as E131Context).pointAtClip(await clipOf(id, row), index, new Map(), 'fine');
  await request('cursor.setStepSize', { cursor: 'fine', stepSize: 1 / 4 });
  for (const [channel, notes] of typicalNotes(offset).entries()) await request('cursor.setNotes', { cursor: 'fine', channel, notes });
  await pause(500);
  const raw = await rawRead(id, row);
  assert.equal(raw.rows.length, 256, `typical clip ${id}:${row} has ${raw.rows.length} notes`);
}
async function deleteClip(id: string, row: number): Promise<void> {
  const index = (await indexOf(id))!;
  if ((await request('slot.status', { trackIndex: index, slotIndex: row })).hasContent !== true) return;
  await request('slot.delete', { trackIndex: index, slotIndex: row });
  await until(() => request('slot.status', { trackIndex: index, slotIndex: row }), value => value.hasContent !== true);
}
/** Rewrite one clip to its typical content and give it an exact palette colour, so `clip.update` can run. */
async function resetClip(id: string, row: number, offset: number): Promise<void> {
  await deleteClip(id, row);
  await writeTypical(id, row, offset);
  const target = await clipOf(id, row);
  const value = Object.values((await adapter.read([clipMetadata(target)])).entries)[0]!.value;
  assert(value.of === 'clipMetadata');
  const { red, green, blue } = supportedClipColors()[0]!;
  await adapter.apply({ ops: [{ op: 'clip.update', clip: target, metadata: { ...value.metadata, color: { red, green, blue } } }] });
  await adapter.settle('noteWrite'); await pause(300);
}

/** The independent raw read: `clip.read` and its pages, decoded, with the bound extent and the metadata block. */
async function rawRead(id: string, row: number): Promise<RawClip & { trackFound: boolean; metadata?: Wire; bound?: Wire }> {
  const index = await indexOf(id);
  if (index === undefined) return { trackFound: false, present: false, rows: [], extent: [] };
  if ((await request('slot.status', { trackIndex: index, slotIndex: row })).hasContent !== true) {
    return { trackFound: true, present: false, rows: [], extent: [] };
  }
  const result = await request('clip.read', { trackIndex: index, row, channelId: id });
  assert.equal(result.refused, undefined, `raw read refused: ${result.refused} ${result.message ?? ''}`);
  const rows: RawNoteFields[] = [];
  let frame = result.frame as NoteFrame;
  for (;;) {
    rows.push(...decodeNoteFrame(frame, PAGE));
    if (frame.next < 0) break;
    frame = await request('clip.readPage', { readId: result.readId, from: frame.next }) as NoteFrame;
  }
  const b = result.bound;
  return { trackFound: true, present: true, rows, extent: [b.loopStartBeats, b.loopEndBeats, b.playStopBeats],
    metadata: result.metadata, bound: b };
}
/** `cursor.clipMetadata` through the fine pool cursor: the 8h3e point. */
async function pointedMetadata(id: string, row: number): Promise<Wire> {
  const index = (await indexOf(id))!;
  await (adapter as unknown as E131Context).pointAtClip(await clipOf(id, row), index, new Map(), 'fine');
  return await request('cursor.clipMetadata', { cursor: 'fine' });
}

const note = (over: Partial<NoteRecord>): NoteRecord => ({ startBeats: 0, pitch: 100, velocity: 90, durationBeats: 0.125, ...over });
const firstNote = (offset: number): NoteRecord => ({ startBeats: 0, pitch: 36 + (offset % 48), velocity: 100, durationBeats: 0.125 });

async function setup(statePath: string, groupOnly = false): Promise<void> {
  const entry = await guard();
  let state: Wire;
  try { state = await load(statePath); } catch {
    state = { schema: `${SCHEMA}-state`, entry, entryTracks: await tracksNow(), tracks: {} };
  }
  const missing = 8 - Number((await request('scene.count')).sceneCount);
  if (missing > 0) { await request('scene.create', { count: missing }); await pause(500); }
  const make = async (key: string, name: string, rows: readonly [number, number][]): Promise<void> => {
    if (state.tracks[key]) return;
    const id = await createTrack(name);
    for (const [row, offset] of rows) await writeTypical(id, row, offset);
    state.tracks[key] = id; await save(statePath, state);
  };
  await make('childA', 'gn-8h4a-child-a', [[0, 21], [1, 22]]);
  await make('childB', 'gn-8h4a-child-b', [[0, 23]]);
  if (!groupOnly) await make('guard', 'gn-8h4a-guard', [[0, 3], [2, 5]]);
  await make('edit', 'gn-8h4a-edit', [[0, 0], [1, 7]]);
  if (groupOnly) { console.log(JSON.stringify(state.tracks)); return; }
  state.tracks.survey ??= [];
  while (state.tracks.survey.length < 4) {
    const t = state.tracks.survey.length, id = await createTrack(`gn-8h4a-survey-${t}`);
    for (let row = 0; row < 4; row++) await writeTypical(id, row, 11 + t * 4 + row);
    state.tracks.survey.push(id); await save(statePath, state);
  }
  console.log(JSON.stringify(state.tracks));
}

/** Case 3a: every fixture shape. The block must equal the pointed reply in canonical JSON, and the digests must agree. */
async function metadata(out: string, statePath: string): Promise<void> {
  const entry = await guard(), state = await load(statePath);
  const edit = state.tracks.edit as string, guardTrack = state.tracks.guard as string;
  const update = async (id: string, row: number, change: (m: Wire) => Wire): Promise<void> => {
    const target = await clipOf(id, row);
    const value = Object.values((await adapter.read([clipMetadata(target)])).entries)[0]!.value;
    assert(value.of === 'clipMetadata');
    await adapter.apply({ ops: [{ op: 'clip.update', clip: target, metadata: change(value.metadata as Wire) as never }] });
    await adapter.settle('noteWrite'); await pause(300);
  };
  const shapes: [string, string, number, () => Promise<void>][] = [
    ['typical, palette colour', edit, 0, async () => resetClip(edit, 0, 0)],
    ['typical, default colour', state.tracks.survey[0], 0, async () => undefined],
    ['loop length 32 beats', edit, 0, async () => update(edit, 0, m => ({ ...m, lengthBeats: 32, loopEndBeats: m.loopStartBeats + 32 }))],
    ['named, loop off, play start 4', edit, 1, async () => {
      await resetClip(edit, 1, 7);
      await update(edit, 1, m => ({ ...m, name: 'gn 8h4a shape', loopEnabled: false, playStartBeats: 4 }));
    }],
    ['empty new clip, default colour', guardTrack, 6, async () => {
      const index = (await indexOf(guardTrack))!;
      await deleteClip(guardTrack, 6);
      await request('clip.create', { trackIndex: index, slotIndex: 6, lengthBeats: 4 });
      await until(() => request('slot.status', { trackIndex: index, slotIndex: 6 }), value => value.hasContent === true);
      await pause(300);
    }],
  ];
  const cases: Wire[] = [];
  for (const [label, id, row, prepare] of shapes) {
    await prepare();
    const raw = await rawRead(id, row);
    const pointed = await pointedMetadata(id, row);
    const target = await clipOf(id, row);
    const before = transport.calls.length;
    const read = await adapter.read(snapshotAddresses(target), { sources: [target] });
    const metadataPoints = callsOf('cursor.clipMetadata', before);
    const blockDigest = read.sources?.[addressKey(target)];
    const pointedDigest = clipSourceFingerprint({ clipMetadata: pointed, clipRead: raw.bound!, notes: raw.rows as never });
    const c = {
      label, channelId: id, row, block: raw.metadata, pointed, notes: raw.rows.length,
      blockCanonical: raw.metadata === undefined ? null : canonicalJson(raw.metadata),
      pointedCanonical: canonicalJson(pointed),
      equal: raw.metadata !== undefined && canonicalJson(raw.metadata) === canonicalJson(pointed),
      blockDigest, pointedDigest, digestEqual: blockDigest?.sha256 === pointedDigest.sha256, metadataPoints,
    };
    console.log(JSON.stringify({ label, equal: c.equal, digestEqual: c.digestEqual, metadataPoints, block: raw.metadata }));
    cases.push(c);
  }
  // Restore the edit fixtures and remove the empty clip.
  await resetClip(edit, 0, 0); await resetClip(edit, 1, 7); await deleteClip(guardTrack, 6);
  await artifact(out, { schema: `${SCHEMA}-metadata`, entry, cases });
}

/** Case 3b: 16 typical clips. A current pass, then edits on the first and the last clip, then a second pass. */
async function survey(out: string, statePath: string): Promise<void> {
  const entry = await guard(), state = await load(statePath);
  const clips = (state.tracks.survey as string[]).flatMap(id => [0, 1, 2, 3].map(row => ({ id, row })));
  await resetClip(clips[0]!.id, clips[0]!.row, 11); await resetClip(clips[15]!.id, clips[15]!.row, 11 + 3 * 4 + 3);
  const tokens: string[] = [], raws: RawClip[] = [];
  for (const c of clips) {
    tokens.push(String((await tool('acquire_clip_note_source', { trackId: c.id, row: c.row })).snapshot));
    raws.push(await rawRead(c.id, c.row));
  }
  const pass = async (): Promise<Wire> => {
    const from = transport.calls.length, started = performance.now();
    const result = await tool('check_clip_snapshots', { snapshots: tokens });
    return { wallMs: performance.now() - started, bytes: Buffer.byteLength(JSON.stringify(result)),
      verdicts: (result.verdicts as Wire[]).map(v => v.verdict), result,
      metadataPoints: callsOf('cursor.clipMetadata', from), cursorPoints: callsOf('cursor.pointTrack', from),
      clipReads: callsOf('clip.read', from) };
  };
  const current = await pass();
  const first = clips[0]!, last = clips[15]!, firstOffset = 11, lastOffset = 11 + 3 * 4 + 3;
  await adapter.apply({ ops: [{ op: 'note.write', clip: await clipOf(first.id, first.row), channel: 0,
    notes: [{ ...firstNote(firstOffset), velocity: 64 }] }] });
  await adapter.settle('noteWrite');
  await adapter.apply({ ops: [{ op: 'note.remove', clip: await clipOf(last.id, last.row), channel: 0, notes: [firstNote(lastOffset)] }] });
  await adapter.settle('noteWrite');
  await adapter.apply({ ops: [{ op: 'note.insert', clip: await clipOf(last.id, last.row), channel: 0,
    notes: [{ ...firstNote(lastOffset), startBeats: 1 / 512 }] }] });
  await adapter.settle('noteWrite'); await pause(300);
  const after: RawClip[] = [];
  for (const c of clips) after.push(await rawRead(c.id, c.row));
  const edited = await pass();
  const expected = raws.map((raw, i) => sameRaw(raw, after[i]!) ? 'current' : 'stale');
  const summary = (p: Wire) => ({ wallMs: p.wallMs, bytes: p.bytes, verdicts: p.verdicts,
    metadataPoints: p.metadataPoints, cursorPoints: p.cursorPoints, clipReads: p.clipReads });
  console.log(JSON.stringify({ current: summary(current), edited: summary(edited), expected }));
  await artifact(out, { schema: `${SCHEMA}-survey`, entry, clips, before: raws, after, expected,
    current: summary(current), edited: summary(edited) });
}

/**
 * Case 1: hold a batch between its stash read and its apply. The operator changes the scene layout above the
 * target. The batch must refuse with no host mutation.
 */
async function applyGuard(out: string, statePath: string, kind: 'insert' | 'delete'): Promise<void> {
  const entry = await guard(), state = await load(statePath), id = state.tracks.guard as string;
  const row = kind === 'insert' ? 2 : 3;
  const before = await rawRead(id, row);
  assert.equal(before.rows.length, 256, `the guard target is not at row ${row}`);
  const columnBefore: RawClip[] = [];
  for (let r = 0; r < 8; r++) columnBefore.push(await rawRead(id, r));
  const acquired = await acquireClipSnapshot({
    mark: () => adapter.revision(), read: (a, o) => adapter.read(a, o), contentSince: (m) => adapter.contentSince(m),
  }, id, row);
  assert.equal(acquired.found, true);
  const ref = (acquired as Extract<typeof acquired, { found: true }>).snapshot.ref;
  const markBefore = await request('revision.get');
  let held: Wire = {};
  hold = async () => {
    const at = await request('revision.get');
    held = { sceneEpoch: at.sceneEpoch, sceneCount: at.sceneCount, heldAt: new Date().toISOString() };
    console.log(JSON.stringify({ holding: true, kind, row, sceneEpoch: at.sceneEpoch, sceneCount: at.sceneCount,
      ask: kind === 'insert' ? 'add one empty scene and drag it to the top' : 'delete the empty top scene' }));
    const changed = await until(() => request('revision.get'), value => value.sceneEpoch !== at.sceneEpoch, 3_600_000);
    await pause(500);
    held = { ...held, releasedSceneEpoch: changed.sceneEpoch, releasedSceneCount: changed.sceneCount };
  };
  let outcome: Wire;
  try {
    await new Executor(adapter).run([{ op: 'note.insert', clip: await clipOf(id, row), channel: 9,
      notes: [note({ startBeats: 5.5, pitch: 111 })] }], { ifSnapshot: [ref] });
    outcome = { refused: false };
  } catch (error) {
    outcome = { refused: error instanceof StaleAddressError, errorType: (error as Error)?.constructor?.name, error: String(error),
      why: error instanceof StaleAddressError ? error.why ?? 'scene-layout' : undefined };
  }
  console.log(JSON.stringify({ outcome }));
  const sent = adapter.requests.at(-1);
  const batchCall = transport.calls.filter(c => c.method === 'batch.run').at(-1);
  const wire = batchCall === undefined ? undefined : {
    expectedSceneEpoch: batchCall.params?.expectedSceneEpoch, expectedProject: batchCall.params?.expectedProject,
    reply: batchCall.reply?.result };
  // An added scene lands after the selected scene; the operator then drags it to the top. Wait for that final
  // layout with `slot.status` only, so the poll does not move the selection: the guard clips at rows 1 and 3
  // after an insert, and at rows 0 and 2 after the delete.
  const index = (await indexOf(id))!;
  const filled = kind === 'insert' ? [1, 3] : [0, 2], empty = kind === 'insert' ? [0, 2] : [1, 3];
  console.log(JSON.stringify({ waitingForLayout: { filled, empty } }));
  await until(async () => ({ rows: await Promise.all([0, 1, 2, 3].map(async r =>
    (await request('slot.status', { trackIndex: index, slotIndex: r })).hasContent === true)) }),
  value => filled.every(r => value.rows[r]) && empty.every(r => !value.rows[r]), 3_600_000);
  await pause(1000);
  const markAfter = await request('revision.get');
  const newRow = kind === 'insert' ? row + 1 : row - 1;
  const after = await rawRead(id, newRow);
  const columnAfter: RawClip[] = [];
  for (let r = 0; r < 8; r++) columnAfter.push(await rawRead(id, r));
  // The track's clips moved one row as a block; their raw content is unchanged.
  const shift = kind === 'insert' ? 1 : -1;
  const columnUnchanged = columnBefore.every((raw, r) => {
    const moved = columnAfter[r + shift];
    return !raw.present || (moved !== undefined && sameRaw(raw, moved));
  });
  const result = {
    schema: `${SCHEMA}-apply-guard`, entry, kind, row, newRow, ref: encodeClipSnapshotRef(ref), held, outcome,
    ifScene: sent?.ifScene, wire, revision: [markBefore.revision, markAfter.revision],
    sceneEpoch: [markBefore.sceneEpoch, markAfter.sceneEpoch], before, after,
    targetUnchanged: sameRaw(before, after), columnUnchanged, columnBefore, columnAfter,
  };
  console.log(JSON.stringify({ kind, outcome, wire, revision: result.revision,
    sceneEpoch: result.sceneEpoch, targetUnchanged: result.targetUnchanged, columnUnchanged }));
  await artifact(out, result);
}

async function qSetup(statePath: string): Promise<void> {
  const entry = await guard(), state = await load(statePath);
  state.q ??= { entry, entryTracks: await tracksNow() };
  if (!state.q.track) {
    const id = await createTrack('gn-8h4a-q');
    await writeTypical(id, 0, 9);
    state.q.track = id; await save(statePath, state);
  }
  console.log(JSON.stringify({ project: entry.mark.project, track: state.q.track }));
}

/** Case 2: in Q, after the operator selected a slot in P. Each tool with an outer selection scope. */
async function selection(out: string, statePath: string): Promise<void> {
  const entry = await guard(), state = await load(statePath), id = state.q.track as string;
  assert.equal(entry.mark.project, state.q.entry.mark.project, 'run this in Q');
  const status = async (): Promise<Wire> => await request('selection.status');
  const steps: Wire[] = [];
  const step = async (label: string, run: () => Promise<Wire>): Promise<Wire> => {
    const before = await status(), from = transport.calls.length;
    let result: Wire, error: string | undefined;
    try { result = await run(); } catch (e) { result = {}; error = String(e); }
    const calls = transport.calls.slice(from);
    const after = await status();
    const s = {
      label, before, after, error, refused: result.refused === true || error !== undefined,
      selects: calls.filter(c => c.method === 'slot.select').map(c => c.params),
      slotStatuses: calls.filter(c => c.method === 'slot.status').map(c => c.params),
      readerSelection: calls.filter(c => c.method === 'clip.read').map(c => c.reply?.result?.selection),
    };
    console.log(JSON.stringify({ label, refused: s.refused, error, before: [before.trackIndex, before.slotIndex,
      before.slotProject, before.project], after: [after.trackIndex, after.slotIndex, after.slotProject], selects: s.selects.length }));
    steps.push(s);
    return result;
  };
  const first = await status();
  const acquired = await step('acquire_clip_note_source', () => tool('acquire_clip_note_source', { trackId: id, row: 0 }));
  await step('check_clip_snapshots', () => tool('check_clip_snapshots', { snapshots: [acquired.snapshot] }));
  const source = acquired.exactSource as ExactNoteSource;
  const target = source.eventMap.find(item => item.channel === 2 && item.startBeats === 0.5)!;
  const input = {
    mode: 'agent-note-proposal-v0', source,
    proposal: { schema: NOTE_PROPOSAL_SCHEMA, base_sha256: source.digest.value,
      ops: [{ op: 'transpose', note_ids: [target.id], semitones: 12 }] },
    invariants: { schema: NOTE_INVARIANTS_SCHEMA, preserveUnmentionedFields: true, samePitchOverlap: 'refuse',
      allowedOperations: ['transpose'], allowedTrackAliases: source.aliases.map(item => item.alias),
      noteCount: { min: 256, max: 256 }, pitchRange: { min: 0, max: 127 },
      beatRange: { from: '0', to: '64', noteEndsWithin: true }, requiredEventIds: source.eventMap.map(item => item.id) },
  };
  const preview = await step('transform_clip_music preview', () => tool('transform_clip_music', { ...input, action: 'preview' }));
  await step('transform_clip_music apply', () => tool('transform_clip_music', { ...input, snapshot: acquired.snapshot,
    action: 'apply', acceptedPreviewSha256: preview.preview.previewDigest.value }));
  const written = await step('write_notes', () => tool('write_notes', {
    clips: [{ trackId: id, row: 0, notes: [note({ startBeats: 7.5, pitch: 112 })] }] }, STABLE_TOOL_PROFILE));
  await step('revert_change', () => tool('revert_change', { changeId: written.changeId }, STABLE_TOOL_PROFILE));
  await step('read_clip', () => tool('read_clip', { trackId: id, row: 0 }, STABLE_TOOL_PROFILE));
  await artifact(out, { schema: `${SCHEMA}-selection`, entry, first, steps, last: await status() });
}

const GROUP_TOOLS = (group: string, child: string): [string, Wire, ToolProfile | typeof EXPERIMENTAL_7B_TOOL_PROFILE][] => [
  ['read_clip', { trackId: group, row: 0 }, STABLE_TOOL_PROFILE],
  ['write_notes', { clips: [{ trackId: group, row: 0, notes: [note({ startBeats: 1.5 })] }] }, STABLE_TOOL_PROFILE],
  ['add_clip', { clips: [{ trackId: group, row: 5, lengthBeats: 4 }] }, STABLE_TOOL_PROFILE],
  ['delete_clip', { clips: [{ trackId: group, row: 0 }] }, STABLE_TOOL_PROFILE],
  ['copy_clip_down', { trackId: group, row: 1, quantization: '1', mode: 'continue_or_synced' }, STABLE_TOOL_PROFILE],
  ['move_clip_block', { trackId: group, firstRow: 0, lastRow: 0, destinationFirstRow: 6 }, STABLE_TOOL_PROFILE],
  ['launch_clip', { trackId: group, row: 0, quantization: 'none', mode: 'from_start' }, STABLE_TOOL_PROFILE],
  ['acquire_clip_note_source', { trackId: group, row: 0 }, EXPERIMENTAL_7B_TOOL_PROFILE],
  ['check_clip_snapshots', { snapshots: [child] }, EXPERIMENTAL_7B_TOOL_PROFILE],
];

/** Case 4: the operator grouped the two child tracks. Each content tool refuses; the children read and check. */
async function group(out: string, statePath: string, view: 'expanded' | 'collapsed'): Promise<void> {
  const entry = await guard(), state = await load(statePath);
  const tracks = await tracksNow();
  const groups = tracks.filter(row => row.type === 'Group');
  assert.equal(groups.length, 1, `expected one group track, found ${groups.length}`);
  const groupId = String(groups[0]!.channelId);
  state.tracks.group = groupId; await save(statePath, state);
  const listed = await tool('list_tracks', {}, STABLE_TOOL_PROFILE);
  const groupRow = (listed.tracks as Wire[]).find(row => row.trackId === groupId);
  const rawGroup = (await request('slot.status', { trackIndex: groups[0]!.index, slotIndex: 0 }));
  // A child reference with the group's channelId: the check must refuse it as a group slot.
  // The edit track is always listed; a collapsed child is not (8h4a finding).
  const childToken = String((await tool('acquire_clip_note_source', { trackId: state.tracks.edit, row: 0 })).snapshot);
  const forged = encodeClipSnapshotRef({ ...decodeClipSnapshotRef(childToken), channelId: groupId });
  const markBefore = await request('revision.get');
  const refusals: Wire[] = [];
  for (const [name, args, profile] of GROUP_TOOLS(groupId, forged)) {
    const from = transport.calls.length;
    let result: Wire, error: string | undefined;
    try { result = await tool(name, args, profile); } catch (e) { result = {}; error = String(e); }
    const calls = transport.calls.slice(from).map(c => c.method);
    const r = { name, refused: result.refused === true || error !== undefined, reason: result.reason, error,
      why: result.why, batches: calls.filter(m => m === 'batch.run').length, clipReads: calls.filter(m => m === 'clip.read').length,
      groupSlot: result.reason === 'group-slot' || /group-slot/.test(error ?? '') };
    console.log(JSON.stringify(r));
    refusals.push(r);
  }
  const markAfter = await request('revision.get');
  const children: Wire[] = [];
  for (const [key, row] of [['childA', 0], ['childA', 1], ['childB', 0]] as const) {
    const id = state.tracks[key] as string;
    const listed = tracks.some(item => item.channelId === id);
    let c: Wire;
    if (!listed) {
      const read = await tool('read_clip', { trackId: id, row }, STABLE_TOOL_PROFILE);
      c = { key, row, listed, readClip: read };
    } else {
      try {
        const raw = await rawRead(id, row);
        const acquired = await tool('acquire_clip_note_source', { trackId: id, row });
        const checked = await tool('check_clip_snapshots', { snapshots: [acquired.snapshot] });
        c = { key, row, listed, notes: raw.rows.length, refused: acquired.refused === true,
          verdict: (checked.verdicts as Wire[])[0]?.verdict };
      } catch (error) {
        // E221: in a collapsed group the reader can bind only row 0 of a child. The read refuses.
        let product: Wire;
        try { product = await tool('acquire_clip_note_source', { trackId: id, row }); } catch (e) { product = { error: String(e) }; }
        c = { key, row, listed, refused: true, error: String(error), product: { refused: product.refused === true || product.error !== undefined,
          error: product.error, snapshot: product.snapshot === undefined ? undefined : 'returned' } };
      }
    }
    console.log(JSON.stringify(c));
    children.push(c);
  }
  await artifact(out, { schema: `${SCHEMA}-group`, entry, view, groupId, tracks, groupRow, rawGroupSlot: rawGroup,
    refusals, children, revision: [markBefore.revision, markAfter.revision] });
}

async function cleanup(out: string, statePath: string, which: 'P' | 'Q'): Promise<void> {
  const entry = await guard(), state = await load(statePath);
  const owned = which === 'Q' ? [state.q?.track]
    : [state.tracks.group, state.tracks.childA, state.tracks.childB, state.tracks.guard, state.tracks.edit,
      ...(state.tracks.survey ?? [])];
  const deleted: string[] = [];
  for (const id of owned.filter(Boolean) as string[]) {
    const index = await indexOf(id);
    if (index === undefined) continue;
    await request('track.delete', { trackIndex: index });
    await until(() => request('track.list'), value => !(value.tracks as Wire[]).some(row => row.channelId === id));
    deleted.push(id);
  }
  const tracks = await tracksNow();
  const entryTracks = which === 'Q' ? state.q.entryTracks as Wire[] : state.entryTracks as Wire[];
  assert.deepEqual(tracks.map(row => row.channelId), entryTracks.map(row => row.channelId),
    'the owned project does not match its entry tracks');
  const stats = await request('rig.stats');
  assert.equal(stats.clipReader?.open, false); assert.equal(stats.clipReader?.writeGate?.readOpen, false);
  assert.equal(stats.clipReader?.writeGate?.waiting, 0); assert.equal(stats.clipReader?.writeGate?.leases, 0);
  await artifact(out, { schema: `${SCHEMA}-cleanup`, entry, which, deleted, tracks, entryTracks, stats });
  console.log(JSON.stringify({ which, deleted: deleted.length, tracks: tracks.length }));
}

const gz = async (path: string): Promise<Wire> => JSON.parse(gunzipSync(await readFile(path)).toString('utf8'));

/** Recheck the retained claims from the artifacts. */
export async function verifyOffline(dir: string): Promise<Wire> {
  const names = (await readdir(dir)).filter(name => name.endsWith('.json.gz')).sort();
  const issues: string[] = [];
  for (const name of names) {
    const a = await gz(join(dir, name));
    if (a.schema === `${SCHEMA}-metadata`) {
      for (const c of a.cases) {
        if (c.blockCanonical !== c.pointedCanonical) issues.push(`${name}: ${c.label}: the block differs from the pointed reply`);
        if (c.blockCanonical !== canonicalJson(c.block) || c.pointedCanonical !== canonicalJson(c.pointed)) {
          issues.push(`${name}: ${c.label}: retained canonical text does not match its object`);
        }
        if (c.blockDigest?.sha256 !== c.pointedDigest?.sha256) issues.push(`${name}: ${c.label}: the digests differ`);
        if (c.metadataPoints !== 0) issues.push(`${name}: ${c.label}: the snapshot read made a metadata point`);
      }
    }
    if (a.schema === `${SCHEMA}-survey`) {
      const recomputed = (a.before as RawClip[]).map((raw, i) => sameRaw(raw, a.after[i]) ? 'current' : 'stale');
      if (JSON.stringify(recomputed) !== JSON.stringify(a.edited.verdicts)) issues.push(`${name}: survey verdicts differ from raw reads`);
      if (a.current.verdicts.some((v: string) => v !== 'current')) issues.push(`${name}: the current pass found a stale clip`);
      if (a.current.metadataPoints !== 0 || a.edited.metadataPoints !== 0) issues.push(`${name}: a survey pass made a metadata point`);
    }
    const sideRun = name.includes('preflight') || name.includes('timeout');
    if (a.schema === `${SCHEMA}-apply-guard` && sideRun) {
      // Kept side runs. `preflight`: the first write after an operator scene change refused in the cursor
      // preflight (E3 row staleness). `timeout`: the hold expired before the scene change; no batch was sent.
      const preflight = name.includes('preflight') && /^AddressUnresolvedError/.test(a.outcome.error ?? '');
      const timeout = name.includes('timeout') && a.wire === undefined;
      if (!preflight && !timeout) issues.push(`${name}: an unexpected side run`);
      if (a.outcome.refused === true && !timeout) issues.push(`${name}: a side run claims a guard refusal`);
      if (a.revision[0] !== a.revision[1]) issues.push(`${name}: the revision changed`);
      if (!sameRaw(a.before, a.after) || !a.columnUnchanged) issues.push(`${name}: a raw read changed`);
    }
    if (a.schema === `${SCHEMA}-apply-guard` && !sideRun) {
      if (a.outcome.refused !== true) issues.push(`${name}: the held batch did not refuse`);
      if (a.wire?.reply?.reason !== 'stale-scene' || a.wire?.reply?.field !== 'sceneEpoch') {
        issues.push(`${name}: the extension guard did not refuse the batch`);
      }
      if (a.revision[0] !== a.revision[1]) issues.push(`${name}: the revision changed`);
      if (a.sceneEpoch[0] === a.sceneEpoch[1]) issues.push(`${name}: no scene change was recorded`);
      if (!sameRaw(a.before, a.after) || !a.columnUnchanged) issues.push(`${name}: a raw read changed`);
      if (a.ifScene?.sceneEpoch !== a.sceneEpoch[0]) issues.push(`${name}: the batch did not carry the read scene epoch`);
    }
    if (a.schema === `${SCHEMA}-selection`) {
      for (const s of a.steps) {
        if (s.refused) issues.push(`${name}: ${s.label} refused`);
        const stale = s.before.slotProject !== s.before.project;
        if (stale && s.slotStatuses.some((p: Wire) => p.trackIndex === s.before.trackIndex && p.slotIndex === s.before.slotIndex)) {
          issues.push(`${name}: ${s.label} asked about a stale selection index`);
        }
      }
    }
    if (a.schema === `${SCHEMA}-group`) {
      for (const r of a.refusals) {
        if (!r.refused || !r.groupSlot) issues.push(`${name}: ${r.name} did not refuse with group-slot`);
        if (r.batches !== 0 || r.clipReads !== 0) issues.push(`${name}: ${r.name} reached the host`);
      }
      if (a.revision[0] !== a.revision[1]) issues.push(`${name}: the revision changed`);
      for (const c of a.children) {
        if (a.view === 'expanded' && (c.refused || c.verdict !== 'current')) issues.push(`${name}: child ${c.key}:${c.row} did not read and check`);
        // Before D33 (no content filter) a collapsed group's children left the bank. Under ALL_CHANNELS
        // they must read and check.
        const filtered = a.entry?.rig?.contentFilter === 'ALL_CHANNELS';
        if (a.view === 'collapsed' && !filtered && (c.listed !== false || c.readClip?.readable !== false)) {
          issues.push(`${name}: child ${c.key}:${c.row} is not reported as unaddressable while collapsed`);
        }
        // Under ALL_CHANNELS a collapsed child is listed. Row 0 reads; another row refuses in the reader
        // (E221 collapsed-child binding limit) and must not return content.
        const boundRefusal = c.refused === true && /bound-target-mismatch/.test(c.error ?? '')
          && c.product?.refused === true && c.product?.snapshot === undefined;
        if (a.view === 'collapsed' && filtered
            && (c.listed !== true || (c.row === 0 ? c.refused || c.verdict !== 'current' : !boundRefusal))) {
          issues.push(`${name}: child ${c.key}:${c.row} did not behave as measured under ALL_CHANNELS`);
        }
      }
      if (a.groupRow?.group !== true) issues.push(`${name}: list_tracks did not mark the group`);
    }
  }
  return { artifacts: names.length, issues };
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  try {
    switch (command) {
      case 'setup': await setup(args[0]!); break;
      case 'setup-group': await setup(args[0]!, true); break;
      case 'metadata': await metadata(args[0]!, args[1]!); break;
      case 'survey': await survey(args[0]!, args[1]!); break;
      case 'apply-guard': await applyGuard(args[0]!, args[1]!, args[2] as 'insert' | 'delete'); break;
      case 'q-setup': await qSetup(args[0]!); break;
      case 'selection': await selection(args[0]!, args[1]!); break;
      case 'group': await group(args[0]!, args[1]!, args[2] as 'expanded' | 'collapsed'); break;
      case 'cleanup': await cleanup(args[0]!, args[1]!, args[2] as 'P' | 'Q'); break;
      case 'verify-offline': {
        const result = await verifyOffline(args[0]!);
        console.log(JSON.stringify(result, null, 1)); if (result.issues.length > 0) process.exitCode = 1; return;
      }
      default: throw new Error('usage: setup | metadata | survey | apply-guard | q-setup | selection | group | cleanup | verify-offline');
    }
  } finally { await transport.close(); }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
