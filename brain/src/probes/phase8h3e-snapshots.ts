/**
 * 8h3e D32 snapshot references. Live driver. Use an owned unsaved project; refuse the saved anchor (D29).
 * Every case compares the experimental-profile verdict with an independent raw `clip.read`.
 *
 *   setup <state.json>                      edit track (rows 0 and 1) and 16 survey clips at E231 typical density
 *   edits <out> <state.json> <row>          no edit, add, delete, velocity, 1/512 nudge, executor note.insert,
 *                                           and a loop-length change on the edit track at one row
 *   identity <out> <state.json>             a scene append, and a clip delete and recreate with equal content
 *   arm <state.json> <label> <row>          record a reference and a raw read before an operator step
 *   judge <out> <state.json> <label>        the verdict after the operator step (move, scene insert, project
 *                                           switch, controller reload, or a P→Q→P detour)
 *   guard-write <out> <state.json>          an agent-proposal apply against a stale and then a current reference
 *   survey <out> <state.json>               16 clips: a current pass, then two edits and a second pass
 *   cleanup <out> <state.json>              delete owned tracks and check the entry track IDs
 *   verify-offline <dir>                    recompute every retained verdict from its raw reads
 */
import assert from 'node:assert/strict';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { LiveAdapter } from '../adapters/live/adapter.js';
import { decodeNoteFrame, type NoteFrame, type RawNoteFields } from '../adapters/live/clip-read.js';
import {
  ClipSnapshotRefusedError, clip, clipMetadata, decodeClipSnapshotRef, scene, slot, supportedClipColors, track,
  type ClipAddress, type NoteRecord,
} from '../contract/index.js';
import { Executor } from '../engine/executor.js';
import { NOTE_INVARIANTS_SCHEMA, NOTE_PROPOSAL_SCHEMA, type ExactNoteSource } from '../musical/index.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { callExperimental7b } from './phase7b-profile.js';
import { workspaceOf } from '../surface/workspace.js';
import type { E131Context } from './e131-diagnostic.js';
import { WireTransport } from './phase8h3c-promotion.js';
import { NORMAL, SCHEMA, caseIssues, expectedVerdict, rawChannels, sameRaw, typicalNotes, type RawClip, type Wire } from './phase8h3e-snapshots-lib.js';

const PAGE = 131_072;
const ANCHOR = 'gn-scale-test';
const transport = new WireTransport();
const adapter = new LiveAdapter({ transport });
const workspace = workspaceOf({
  ready: async () => undefined, adapter, executor: new Executor(adapter), stash: new Stash(),
  observationStore: new FakeObservationStore(),
});
const request = async (method: string, params?: Wire): Promise<Wire> =>
  await transport.send({ method, ...(params ? { params } : {}) }) as Wire;
const tool = async (name: string, args: Wire): Promise<Wire> =>
  await callExperimental7b(workspace, name, args) as Wire;
const pause = async (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));
const load = async (path: string): Promise<Wire> => JSON.parse(await readFile(path, 'utf8'));
const save = async (path: string, value: unknown): Promise<void> => {
  await mkdir(dirname(path), { recursive: true }); await writeFile(path, JSON.stringify(value, null, 1) + '\n');
};
const artifact = async (path: string, value: unknown): Promise<void> => {
  await mkdir(dirname(path), { recursive: true }); await writeFile(path, gzipSync(JSON.stringify(value) + '\n'));
};
async function until(next: () => Promise<Wire>, done: (value: Wire) => boolean, limit = 30_000): Promise<Wire> {
  const started = performance.now();
  for (;;) {
    const value = await next(); if (done(value)) return value;
    assert(performance.now() - started < limit, `live state did not settle: ${JSON.stringify(value).slice(0, 400)}`);
    await pause(50);
  }
}

/** The normal profile, the reader markers, and an owned unsaved project. */
async function guard(owned = true): Promise<Wire> {
  const hello = await request('contract.hello');
  assert.deepEqual([hello.runtimeProfile, hello.methodCount, hello.methodsHash], NORMAL);
  const mark = await request('revision.get');
  if (owned) assert(/^New \d+$/.test(mark.project) && mark.project !== ANCHOR, `use an owned unsaved project, got ${mark.project}`);
  const rig = await request('rig.info');
  assert.equal(rig.clipReader?.revision, 'clip-reader-v1');
  await adapter.hello();
  return { hello, mark, rig };
}
async function indexOf(id: string): Promise<number | undefined> {
  const found = ((await request('track.list')).tracks as Wire[]).find(row => row.channelId === id);
  return found === undefined ? undefined : Number(found.index);
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

/** Rewrite one clip to its typical content and give it an exact palette colour, so `clip.update` can run. */
async function resetClip(id: string, row: number, offset: number): Promise<void> {
  const index = (await indexOf(id))!;
  if ((await request('slot.status', { trackIndex: index, slotIndex: row })).hasContent === true) {
    await request('slot.delete', { trackIndex: index, slotIndex: row });
    await until(() => request('slot.status', { trackIndex: index, slotIndex: row }), value => value.hasContent !== true);
  }
  await writeTypical(id, row, offset);
  const target = await clipOf(id, row);
  const value = Object.values((await adapter.read([clipMetadata(target)])).entries)[0]!.value;
  assert(value.of === 'clipMetadata');
  const { red, green, blue } = supportedClipColors()[0]!;
  await adapter.apply({ ops: [{ op: 'clip.update', clip: target, metadata: { ...value.metadata, color: { red, green, blue } } }] });
  await adapter.settle('noteWrite'); await pause(300);
}

/** The independent raw read: `clip.read` and its pages, decoded, with the bound extent. */
async function rawRead(id: string, row: number): Promise<RawClip & { trackFound: boolean }> {
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
  return { trackFound: true, present: true, rows, extent: [b.loopStartBeats, b.loopEndBeats, b.playStopBeats] };
}

async function acquire(id: string, row: number): Promise<{ token: string; raw: RawClip; acquisition: Wire }> {
  const acquisition = await tool('acquire_clip_note_source', { trackId: id, row });
  return { token: String(acquisition.snapshot), raw: await rawRead(id, row), acquisition };
}

/** One case: the raw read after the step, the guards, the tool verdict, and a recheck of a new snapshot. */
async function judgeCase(label: string, token: string, before: RawClip): Promise<Wire> {
  const ref = decodeClipSnapshotRef(token);
  const after = await rawRead(ref.channelId, ref.row);
  const now = await adapter.revision();
  const delta = await adapter.contentSince(ref.mark);
  const started = performance.now();
  const checked = await tool('check_clip_snapshots', { snapshots: [token] });
  const checkMs = performance.now() - started;
  const v = checked.verdicts[0] as Wire;
  const fresh = v.newSnapshot as Wire | undefined;
  const recheck = fresh === undefined ? undefined
    : ((await tool('check_clip_snapshots', { snapshots: [fresh.snapshot] })).verdicts[0] as Wire).verdict;
  const c: Wire = {
    label, channelId: ref.channelId, row: ref.row, mark: ref.mark, now, delta, before, after,
    trackFound: after.trackFound, verdict: v.verdict, why: v.why ?? v.uncoveredIn, checkMs,
    resultBytes: Buffer.byteLength(JSON.stringify(checked)),
    ...(fresh === undefined ? {} : { newSnapshot: fresh.snapshot, newChannels: (fresh.clip.channels as Wire[]).map(item => item.notes) }),
    ...(recheck === undefined ? {} : { recheck }),
  };
  c.expected = expectedVerdict({ mark: c.mark, now, delta, channelId: c.channelId, row: c.row, before, after,
    trackFound: after.trackFound });
  c.issues = caseIssues(c);
  console.log(JSON.stringify({ label, verdict: c.verdict, expected: c.expected, why: c.why, sceneEpoch: [ref.mark.sceneEpoch, now.sceneEpoch],
    contentEvents: delta.events.length, complete: !delta.truncated && !delta.discontinuous && !delta.uncovered, issues: c.issues }));
  return c;
}

const note = (over: Partial<NoteRecord>): NoteRecord => ({ startBeats: 0, pitch: 100, velocity: 90, durationBeats: 0.125, ...over });
/** The first typical note of channel 0 at offset 0 or 7. */
const firstNote = (offset: number): NoteRecord => ({ startBeats: 0, pitch: 36 + (offset % 48), velocity: 100, durationBeats: 0.125 });

async function setup(statePath: string): Promise<void> {
  const entry = await guard();
  let state: Wire;
  try { state = await load(statePath); } catch {
    state = { schema: `${SCHEMA}-state`, entry, entryTracks: (await request('track.list')).tracks, tracks: {}, armed: {} };
  }
  const missing = 8 - Number((await request('scene.count')).sceneCount);
  if (missing > 0) { await request('scene.create', { count: missing }); await pause(500); }
  if (!state.tracks.edit) {
    const id = await createTrack('gn-8h3e-edit');
    await writeTypical(id, 0, 0); await writeTypical(id, 1, 7);
    state.tracks.edit = id; await save(statePath, state);
  }
  state.tracks.survey ??= [];
  while (state.tracks.survey.length < 4) {
    const t = state.tracks.survey.length, id = await createTrack(`gn-8h3e-survey-${t}`);
    for (let row = 0; row < 4; row++) await writeTypical(id, row, 11 + t * 4 + row);
    state.tracks.survey.push(id); await save(statePath, state);
  }
  console.log(JSON.stringify({ edit: state.tracks.edit, survey: state.tracks.survey }));
}

async function edits(out: string, statePath: string, row: number): Promise<void> {
  const entry = await guard(), state = await load(statePath), id = state.tracks.edit as string;
  const offset = row === 0 ? 0 : 7, base = firstNote(offset);
  await resetClip(id, row, offset);
  const apply = async (ops: Wire[]): Promise<void> => {
    await adapter.apply({ ops: ops as never }); await adapter.settle('noteWrite'); await pause(300);
  };
  const steps: [string, () => Promise<void>][] = [
    ['none', async () => undefined],
    ['add', async () => apply([{ op: 'note.insert', clip: await clipOf(id, row), channel: 0, notes: [note({ startBeats: 0.5 })] }])],
    ['delete', async () => apply([{ op: 'note.remove', clip: await clipOf(id, row), channel: 0, notes: [note({ startBeats: 0.5 })] }])],
    ['velocity', async () => apply([{ op: 'note.write', clip: await clipOf(id, row), channel: 0, notes: [{ ...base, velocity: 64 }] }])],
    ['nudge', async () => {
      await apply([{ op: 'note.remove', clip: await clipOf(id, row), channel: 0, notes: [{ ...base, velocity: 64 }] }]);
      await apply([{ op: 'note.insert', clip: await clipOf(id, row), channel: 0, notes: [{ ...base, velocity: 64, startBeats: 1 / 512 }] }]);
    }],
    ['executor note.insert', async () => {
      await new Executor(adapter).run([{ op: 'note.insert', clip: await clipOf(id, row), channel: 1,
        notes: [note({ startBeats: 2.5, pitch: 101 })] }]);
      await pause(300);
    }],
    ['loop length', async () => {
      const target = await clipOf(id, row);
      const read = await adapter.read([clipMetadata(target)]);
      const entryValue = Object.values(read.entries)[0]!.value;
      assert(entryValue.of === 'clipMetadata');
      const m = entryValue.metadata;
      await apply([{ op: 'clip.update', clip: target, metadata: { ...m, lengthBeats: 32, loopEndBeats: m.loopStartBeats + 32 } }]);
    }],
  ];
  let { token, raw } = await acquire(id, row);
  const cases: Wire[] = [];
  for (const [label, step] of steps) {
    await step();
    const c = await judgeCase(`row ${row}: ${label}`, token, raw);
    cases.push(c);
    if (c.verdict === 'stale') { token = c.newSnapshot; raw = c.after; }
  }
  await artifact(out, { schema: `${SCHEMA}-edits`, entry, row, cases });
}

async function identity(out: string, statePath: string): Promise<void> {
  const entry = await guard(), state = await load(statePath), id = state.tracks.edit as string;
  const cases: Wire[] = [];
  await resetClip(id, 1, 7);
  let { token, raw } = await acquire(id, 1);
  await request('scene.create', { count: 1 }); await pause(500);
  cases.push(await judgeCase('scene append', token, raw));
  ({ token, raw } = await acquire(id, 1));
  // Delete the clip and recreate it with equal notes, extent, and colour.
  await resetClip(id, 1, 7);
  const recreated = await rawRead(id, 1);
  const c = await judgeCase('clip delete and recreate', token, raw);
  c.contentEqual = sameRaw(raw, recreated);
  cases.push(c);
  await artifact(out, { schema: `${SCHEMA}-identity`, entry, cases });
}

async function arm(statePath: string, label: string, row: number): Promise<void> {
  await guard(); const state = await load(statePath);
  const current = await rawRead(state.tracks.edit, row);
  // A loop-length edit makes acquisition ask for consolidation. Only then restore the typical clip.
  if (current.extent[1] !== 64) await resetClip(state.tracks.edit, row, row === 0 ? 0 : 7);
  const { token, raw } = await acquire(state.tracks.edit, row);
  state.armed[label] = { token, raw, armedAt: new Date().toISOString() }; await save(statePath, state);
  console.log(JSON.stringify({ armed: label, row, project: decodeClipSnapshotRef(token).mark.project }));
}

async function judge(out: string, statePath: string, label: string): Promise<void> {
  const entry = await guard(false), state = await load(statePath), armed = state.armed[label];
  assert(armed, `no armed reference ${label}`);
  const c = await judgeCase(label, armed.token, armed.raw);
  await artifact(out, { schema: `${SCHEMA}-operator`, entry, cases: [c] });
}

/** Case 4: an apply against a stale reference refuses before a write; the executor guard refuses alone too. */
async function guardWrite(out: string, statePath: string): Promise<void> {
  const entry = await guard(), state = await load(statePath), id = state.tracks.survey[3] as string, row = 3;
  const proposal = (source: ExactNoteSource): Wire => {
    const target = source.eventMap.find(item => item.channel === 2 && item.startBeats === 0.5)!;
    return {
      mode: 'agent-note-proposal-v0', source,
      proposal: { schema: NOTE_PROPOSAL_SCHEMA, base_sha256: source.digest.value,
        ops: [{ op: 'transpose', note_ids: [target.id], semitones: 12 }] },
      invariants: { schema: NOTE_INVARIANTS_SCHEMA, preserveUnmentionedFields: true, samePitchOverlap: 'refuse',
        allowedOperations: ['transpose'], allowedTrackAliases: source.aliases.map(item => item.alias),
        noteCount: { min: 256, max: 257 }, pitchRange: { min: 0, max: 127 },
        beatRange: { from: '0', to: '64', noteEndsWithin: true }, requiredEventIds: source.eventMap.map(item => item.id) },
    };
  };
  const first = await acquire(id, row);
  const input = proposal(first.acquisition.exactSource);
  const preview = await tool('transform_clip_music', { ...input, action: 'preview' });
  // Another writer changes the clip after the preview.
  await adapter.apply({ ops: [{ op: 'note.insert', clip: await clipOf(id, row), channel: 5, notes: [note({ startBeats: 3.5 })] }] });
  await adapter.settle('noteWrite'); await pause(300);
  const before = await rawRead(id, row), markBefore = await request('revision.get');
  const refused = await tool('transform_clip_music', { ...input, snapshot: first.token, action: 'apply',
    acceptedPreviewSha256: preview.preview.previewDigest.value });
  const afterRefusal = await rawRead(id, row), markAfter = await request('revision.get');
  let executorRefusal: Wire = {};
  try {
    await new Executor(adapter).run([{ op: 'note.insert', clip: await clipOf(id, row), channel: 6, notes: [note({ startBeats: 4.5 })] }],
      { ifSnapshot: [decodeClipSnapshotRef(first.token)] });
    executorRefusal = { refused: false };
  } catch (error) {
    executorRefusal = { refused: error instanceof ClipSnapshotRefusedError,
      verdicts: error instanceof ClipSnapshotRefusedError ? error.verdicts.map(v => v.verdict) : [], message: String(error) };
  }
  const afterExecutor = await rawRead(id, row), markExecutor = await request('revision.get');
  const fresh = await acquire(id, row);
  const freshInput = proposal(fresh.acquisition.exactSource);
  const freshPreview = await tool('transform_clip_music', { ...freshInput, action: 'preview' });
  const applied = await tool('transform_clip_music', { ...freshInput, snapshot: fresh.token, action: 'apply',
    acceptedPreviewSha256: freshPreview.preview.previewDigest.value });
  const afterApply = await rawRead(id, row);
  const result = {
    schema: `${SCHEMA}-guard-write`, entry,
    refusal: { applied: refused.applied, verdicts: (refused.snapshotRefusal?.verdicts ?? []).map((v: Wire) => v.verdict),
      newSnapshotMatchesRaw: JSON.stringify(refused.snapshotRefusal?.verdicts?.[0]?.newSnapshot?.clip.channels.map((c: Wire) => c.notes))
        === JSON.stringify(rawChannels(before)),
      rawUnchanged: sameRaw(before, afterRefusal), revision: [markBefore.revision, markAfter.revision] },
    executor: { ...executorRefusal, rawUnchanged: sameRaw(before, afterExecutor), revision: [markBefore.revision, markExecutor.revision] },
    current: { applied: applied.applied, discrepancies: applied.readback?.discrepancies?.length,
      changed: !sameRaw(before, afterApply), noteCount: afterApply.rows.length },
    before, afterRefusal, afterApply,
  };
  console.log(JSON.stringify({ refusal: result.refusal, executor: { ...result.executor, message: undefined }, current: result.current }));
  await artifact(out, result);
}

/** Case 5: 16 typical clips. A current pass, then edits on the first and the last clip, then a second pass. */
async function survey(out: string, statePath: string): Promise<void> {
  const entry = await guard(), state = await load(statePath);
  const clips = (state.tracks.survey as string[]).flatMap(id => [0, 1, 2, 3].map(row => ({ id, row })));
  const tokens: string[] = [], raws: RawClip[] = [];
  // The edits below change the first and the last clip. Start both from their typical content.
  await resetClip(clips[0]!.id, clips[0]!.row, 11); await resetClip(clips[15]!.id, clips[15]!.row, 11 + 3 * 4 + 3);
  for (const c of clips) { const a = await acquire(c.id, c.row); tokens.push(a.token); raws.push(a.raw); }
  const pass = async (): Promise<Wire> => {
    const started = performance.now();
    const result = await tool('check_clip_snapshots', { snapshots: tokens });
    return { wallMs: performance.now() - started, bytes: Buffer.byteLength(JSON.stringify(result)),
      verdicts: (result.verdicts as Wire[]).map(v => v.verdict), result };
  };
  const current = await pass();
  const first = clips[0]!, last = clips[15]!;
  const firstOffset = 11, lastOffset = 11 + 3 * 4 + 3;
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
  console.log(JSON.stringify({ current: { wallMs: current.wallMs, bytes: current.bytes, verdicts: current.verdicts },
    edited: { wallMs: edited.wallMs, bytes: edited.bytes, verdicts: edited.verdicts }, expected }));
  await artifact(out, { schema: `${SCHEMA}-survey`, entry, clips, before: raws, after, expected,
    current: { wallMs: current.wallMs, bytes: current.bytes, verdicts: current.verdicts },
    edited: { wallMs: edited.wallMs, bytes: edited.bytes, verdicts: edited.verdicts,
      staleMatchRaw: (edited.result.verdicts as Wire[]).map((v, i) => v.newSnapshot === undefined ? null
        : JSON.stringify(v.newSnapshot.clip.channels.map((c: Wire) => c.notes)) === JSON.stringify(rawChannels(after[i]!))) } });
}

async function cleanup(out: string, statePath: string): Promise<void> {
  const entry = await guard(), state = await load(statePath);
  const owned = [state.tracks.edit, ...(state.tracks.survey ?? [])].filter(Boolean) as string[];
  const deleted: string[] = [];
  for (const id of owned) {
    const index = await indexOf(id);
    if (index === undefined) continue;
    await request('track.delete', { trackIndex: index });
    await until(() => request('track.list'), value => !(value.tracks as Wire[]).some(row => row.channelId === id));
    deleted.push(id);
  }
  const tracks = (await request('track.list')).tracks as Wire[];
  assert.deepEqual(tracks.map(row => row.channelId), (state.entryTracks as Wire[]).map(row => row.channelId),
    'the owned project does not match its entry tracks');
  const stats = await request('rig.stats');
  assert.equal(stats.clipReader?.open, false); assert.equal(stats.clipReader?.writeGate?.readOpen, false);
  assert.equal(stats.clipReader?.writeGate?.waiting, 0); assert.equal(stats.clipReader?.writeGate?.leases, 0);
  await artifact(out, { schema: `${SCHEMA}-cleanup`, entry, deleted, tracks, entryTracks: state.entryTracks, stats });
  console.log(JSON.stringify({ deleted: deleted.length, tracks: tracks.length }));
}

const gz = async (path: string): Promise<Wire> => JSON.parse(gunzipSync(await readFile(path)).toString('utf8'));

/** Recompute every retained verdict and check the write-guard and survey claims. */
export async function verifyOffline(dir: string): Promise<Wire> {
  const names = (await readdir(dir)).filter(name => name.endsWith('.json.gz')).sort();
  const issues: string[] = [];
  const verdicts: Record<string, string> = {};
  for (const name of names) {
    const a = await gz(join(dir, name));
    for (const c of a.cases ?? []) {
      issues.push(...caseIssues(c).map(issue => `${name}: ${issue}`));
      verdicts[c.label] = c.verdict;
    }
    if (a.schema === `${SCHEMA}-guard-write`) {
      if (a.refusal.applied !== false || a.refusal.verdicts[0] !== 'stale' || !a.refusal.newSnapshotMatchesRaw
        || !a.refusal.rawUnchanged || a.refusal.revision[0] !== a.refusal.revision[1]) issues.push(`${name}: stale apply did not refuse cleanly`);
      if (a.executor.refused !== true || !a.executor.rawUnchanged || a.executor.revision[0] !== a.executor.revision[1])
        issues.push(`${name}: the executor guard did not refuse cleanly`);
      if (a.current.applied !== true || a.current.discrepancies !== 0 || !a.current.changed) issues.push(`${name}: current apply failed`);
    }
    if (a.schema === `${SCHEMA}-survey`) {
      if (a.current.verdicts.some((v: string) => v !== 'current')) issues.push(`${name}: the current pass found a stale clip`);
      const recomputed = (a.before as RawClip[]).map((raw, i) => sameRaw(raw, a.after[i]) ? 'current' : 'stale');
      if (JSON.stringify(recomputed) !== JSON.stringify(a.edited.verdicts)) issues.push(`${name}: survey verdicts differ from raw reads`);
      if (recomputed.filter(v => v === 'stale').length !== 2) issues.push(`${name}: not exactly two stale clips`);
      if (a.edited.staleMatchRaw.some((m: boolean | null, i: number) => (recomputed[i] === 'stale') !== (m === true)))
        issues.push(`${name}: a stale snapshot differs from its raw read`);
    }
  }
  return { artifacts: names.length, verdicts, issues };
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  try {
    switch (command) {
      case 'setup': await setup(args[0]!); break;
      case 'edits': await edits(args[0]!, args[1]!, Number(args[2])); break;
      case 'identity': await identity(args[0]!, args[1]!); break;
      case 'arm': await arm(args[0]!, args[1]!, Number(args[2])); break;
      case 'judge': await judge(args[0]!, args[1]!, args[2]!); break;
      case 'guard-write': await guardWrite(args[0]!, args[1]!); break;
      case 'survey': await survey(args[0]!, args[1]!); break;
      case 'cleanup': await cleanup(args[0]!, args[1]!); break;
      case 'verify-offline': {
        const result = await verifyOffline(args[0]!);
        console.log(JSON.stringify(result, null, 1)); if (result.issues.length > 0) process.exitCode = 1; return;
      }
      default: throw new Error('usage: setup | edits | identity | arm | judge | guard-write | survey | cleanup | verify-offline');
    }
  } finally { await transport.close(); }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
