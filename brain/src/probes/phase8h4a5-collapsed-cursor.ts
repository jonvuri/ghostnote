/**
 * 8h4a5 collapsed-child cursor route and parameter settle. Live driver. Use an owned unsaved project for writes;
 * the anchor mode is read-only (D29).
 *
 *   setup <state.json>               tracks before, in, in2, and after with declared clips in rows 0, 1, and 2.
 *                                    Polysynth on before and in, Phase-4 on in2 and after. Then the operator groups
 *                                    in and in2 with Cmd+G.
 *   probes <out> <state.json>        probe profile. P1: a pinned cursor across a collapse, from an entry selection
 *                                    inside and outside the group. P2: a same-request point on a collapsed child.
 *                                    P3: the side effects of one expand and collapse.
 *   params <out> <state.json>        probe profile. P4: the DirectParameter and remote-page callbacks on a
 *                                    same-type and a different-type switch. P5: the candidate hops.
 *   setup-nested <state.json>        a track deep with declared clips in rows 0, 1, and 2. Then the operator groups
 *                                    it twice with Cmd+G (an inner group inside an outer group).
 *   tools <out> <state.json>         normal profile: each product tool that takes a clip or a device address, once,
 *                                    on in (row 2 for clips), with restores (8h4a2 retrospective)
 *   matrix <out> <state.json> <view> normal profile: on each track and rows 0, 1, 2, from a fresh adapter for
 *                                    each target: the reads, the note insert and remove, clip.update and restore,
 *                                    clip.launchSettings and restore, and the note observer arm. Each write is
 *                                    checked with clip.read on every row. view: expanded or collapsed (operator)
 *   own-path <out> <state.json>      normal profile: after the operator selected in row 1 and collapsed the group,
 *                                    read and write in row 2 with no entry setup
 *   refusal <out> <state.json>       normal profile, group collapsed: a stale scene guard after the expansion
 *                                    point; then the group must be collapsed and the next read must pass
 *   nested <out> <state.json>        normal profile, outer group collapsed: the reads and writes of deep
 *   devices <out> <state.json>       normal profile: device read, parameter read, param.set and restore, and the
 *                                    remote controls on before, in, in2, after, before, with no hop
 *   anchor <out>                     read-only, in gn-scale-test with Group 5 collapsed: the cursor and clip reads
 *                                    of gn-E16 rows 0, 1, 2 (its occupied rows), of gn-A, and of gn-sel; row 15 of
 *                                    gn-E16 is empty and must read as no clip with no point
 *   cleanup <out> <state.json>       delete every track that the entry list does not hold
 *   verify-offline <dir>             check every 8h4a5 claim from the retained artifacts
 */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { LiveAdapter } from '../adapters/live/adapter.js';
import { decodeNoteFrame, type NoteFrame } from '../adapters/live/clip-read.js';
import {
  addressKey, clip, clipLaunch, clipMetadata, clipPlay, device, notes, param, remotes, scene, slot, track,
  type Address, type ClipAddress, type Op,
} from '../contract/index.js';
import { EXACT_CLIP_COLORS } from '../contract/clip-color.js';
import { Executor } from '../engine/index.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { callTool } from '../surface/tools.js';
import { workspaceOf } from '../surface/workspace.js';
import type { E131Context } from './e131-diagnostic.js';
import { WireTransport, type Call } from './phase8h3c-promotion.js';
import type { Wire } from './phase8h3c2-rows-lib.js';

const POLYSYNTH = 'a9ffacb5-33e9-4fc7-8621-b1af31e410ef';
const PHASE4 = '252723bf-68a6-4ee6-81f8-95ba4d0fb467';
export const KEYS = ['before', 'in', 'in2', 'after'] as const;
export const ROWS = [0, 1, 2] as const;
const INSTRUMENT: Record<string, [string, string]> = {
  before: [POLYSYNTH, 'Polysynth'], in: [POLYSYNTH, 'Polysynth'], in2: [PHASE4, 'Phase-4'], after: [PHASE4, 'Phase-4'],
};
/** One distinct clip per row: its own length, channel, start step (1/4 beat), and pitch. */
export const declared = (row: number): { beats: number; channel: number; step: number; pitch: number } =>
  ({ beats: 4 * (row + 1), channel: row, step: row, pitch: 60 + row });
/** The marker note of a probe write: beat 2, pitch 72, on the channel of the declared row. */
export const MARKER = { step: 8, pitch: 72 };

const transport = new WireTransport();
const request = async (method: string, params?: Wire, owned?: Call[]): Promise<Wire> =>
  await transport.sendRecorded({ method, ...(params ? { params } : {}) }, owned) as Wire;
const pause = async (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));
const load = async (path: string): Promise<Wire> => JSON.parse(await readFile(path, 'utf8'));
const save = async (path: string, value: unknown): Promise<void> => {
  await mkdir(dirname(path), { recursive: true }); await writeFile(path, JSON.stringify(value, null, 1) + '\n');
};
const artifact = async (path: string, value: unknown): Promise<void> => {
  await mkdir(dirname(path), { recursive: true }); await writeFile(path, gzipSync(JSON.stringify(value) + '\n'));
};
const gz = async (path: string): Promise<Wire> => JSON.parse(gunzipSync(await readFile(path)).toString('utf8'));
const failure = (error: unknown): string => error instanceof Error ? `${error.name}: ${error.message}` : String(error);
async function until(next: () => Promise<Wire>, done: (value: Wire) => boolean, limit = 30_000): Promise<Wire> {
  const started = performance.now();
  for (;;) {
    const value = await next(); if (done(value)) return value;
    assert(performance.now() - started < limit, `live state did not settle: ${JSON.stringify(value).slice(0, 400)}`);
    await pause(25);
  }
}

/** The expected profile and an owned unsaved project. */
async function guard(profile: 'normal-v1' | 'phase-8-probe-v1'): Promise<Wire> {
  const hello = await request('contract.hello');
  assert.equal(hello.runtimeProfile, profile);
  const mark = await request('revision.get');
  assert(/^New \d+$/.test(mark.project), `use an owned unsaved project, got ${mark.project}`);
  const rig = await request('rig.info');
  return { hello, mark, rig };
}
const tracks = async (): Promise<Wire[]> => (await request('track.list')).tracks as Wire[];
async function rowOf(id: string): Promise<Wire> {
  const found = (await tracks()).find(row => row.channelId === id);
  assert(found, `track ${id} is absent`); return found;
}
const groupRow = async (): Promise<Wire> => {
  const group = (await tracks()).find(row => row.type === 'Group');
  assert(group, 'the fixture has no group track'); return group;
};
async function createTrack(name: string): Promise<string> {
  const before = new Set((await tracks()).map(row => row.channelId));
  await request('track.create', { position: 0 });
  const after = await until(() => request('track.list'),
    value => (value.tracks as Wire[]).some(row => row.index === 0 && !before.has(row.channelId)));
  const id = String((after.tracks as Wire[]).find(row => row.index === 0)!.channelId);
  await request('track.setName', { trackIndex: 0, name }); return id;
}
const clipAt = async (id: string, row: number): Promise<ClipAddress> =>
  clip(slot(track(id), scene(row, Number((await request('revision.get')).sceneEpoch))));

async function setup(statePath: string): Promise<void> {
  const entry = await guard((await request('contract.hello')).runtimeProfile);
  const adapter = new LiveAdapter({ transport });
  await adapter.hello();
  const state: Wire = { schema: 'phase8h4a5-state-v1', entry, entryTracks: await tracks(), tracks: {} };
  // Created at position 0 in reverse, so the bank order is before, in, in2, after.
  for (const key of [...KEYS].reverse()) {
    const id = await createTrack(`gn-8h4a5-${key}`);
    for (const row of ROWS) {
      const d = declared(row), index = Number((await rowOf(id)).index);
      await request('clip.create', { trackIndex: index, slotIndex: row, lengthBeats: d.beats });
      await until(() => request('slot.status', { trackIndex: index, slotIndex: row }), value => value.hasContent === true);
      await (adapter as unknown as E131Context).pointAtClip(await clipAt(id, row), index, new Map(), 'fine');
      await request('cursor.setStepSize', { cursor: 'fine', stepSize: 1 / 4 });
      await request('cursor.setNotes', { cursor: 'fine', channel: d.channel, notes: [[d.step, d.pitch, 100, 0.25]] });
      await pause(250);
    }
    const index = Number((await rowOf(id)).index);
    const [uuid, name] = INSTRUMENT[key]!;
    await request('cursor.pinTrack', { cursor: '0', pinned: false });
    await request('cursor.pointTrack', { cursor: '0', trackIndex: index });
    await pause(100);
    await request('device.insertBitwig', { cursor: '0', uuid });
    await until(() => request('device.list', { cursor: '0' }),
      value => value.trackChannelId === id && (value.devices as Wire[] | undefined)?.[0]?.name === name);
    state.tracks[key] = id; await save(statePath, state);
  }
  console.log(JSON.stringify(state.tracks));
  console.log('Operator: select gn-8h4a5-in and gn-8h4a5-in2 and press Cmd+G.');
}

/** One step: its result, or its error. A failed step never loses the record. */
async function step(record: Wire[], label: Wire, run: () => Promise<Wire>): Promise<Wire> {
  const started = performance.now();
  try {
    const value = await run();
    record.push({ ...label, ok: true, ms: Math.round(performance.now() - started), ...value });
  } catch (error) {
    record.push({ ...label, ok: false, ms: Math.round(performance.now() - started), error: failure(error) });
  }
  const last = record.at(-1)!;
  console.log(JSON.stringify({ ...label, ok: last.ok, ...(last.ok ? {} : { error: last.error }) }));
  return last;
}

async function setExpanded(expanded: boolean): Promise<Wire> {
  const group = await groupRow();
  const started = performance.now();
  await request('branch.setMixer', { trackIndex: group.index, groupExpanded: expanded });
  await until(() => request('branch.mixer', { trackIndex: group.index, groupOnly: true }), value => value.isGroupExpanded === expanded);
  return { group: group.index, expanded, ms: Math.round(performance.now() - started) };
}
const expandedNow = async (): Promise<boolean> =>
  (await request('branch.mixer', { trackIndex: (await groupRow()).index, groupOnly: true })).isGroupExpanded as boolean;

/** Every note of one clip, all channels, through the product reader: [channel, pitch, cell]. */
async function rawRead(id: string, row: number): Promise<Wire> {
  const index = Number((await rowOf(id)).index);
  const reply = await request('clip.read', { trackIndex: index, row, channelId: id });
  if (reply.refused) return { refused: reply.refused, message: reply.message };
  const rows = decodeNoteFrame(reply.frame as NoteFrame, Number(reply.frame.count) + 1);
  return { notes: rows.map(n => [n.channel, n.pitch, n.cell]), metadata: reply.metadata, bound: reply.bound,
    ...(reply.launch ? { launch: reply.launch } : {}) };
}
/** The note rows of every fixture row of one track. */
async function rowsOf(id: string): Promise<Wire> {
  const out: Wire = {};
  for (const row of ROWS) out[row] = await rawRead(id, row);
  return out;
}
const declaredNotes = (row: number): number[][] => [[declared(row).channel, declared(row).pitch, declared(row).step * 128]];
const markerCell = MARKER.step * 128;

const snapshotState = async (): Promise<Wire> => {
  const mark = await request('revision.get');
  return { revision: mark.revision, sceneEpoch: mark.sceneEpoch, contentEpoch: mark.contentEpoch,
    generation: mark.generation, order: (await tracks()).map(t => t.channelId),
    selection: await request('selection.status') };
};

/** P1 on one entry selection: point and pin a cursor on `in` row 1 with the group expanded, then collapse. */
async function p1(state: Wire, entry: 'inside' | 'outside', record: Wire[]): Promise<void> {
  const id = String(state.tracks.in), cursor = '1', label = { probe: 'P1', entry };
  await setExpanded(true);
  const entryTrack = entry === 'inside' ? String(state.tracks.in2) : String(state.tracks.before);
  await request('slot.select', { trackIndex: (await rowOf(entryTrack)).index, slotIndex: 0, mechanism: 'track' });
  await pause(150);
  const adapter = new LiveAdapter({ transport });
  await adapter.hello();
  const c = await clipAt(id, 1);
  await step(record, { ...label, part: 'point-expanded' }, async () => {
    await (adapter as unknown as E131Context).pointAtClip(c, Number((await rowOf(id)).index), new Map(), cursor);
    return { status: await request('cursor.status', { cursor }), selection: await request('selection.status') };
  });
  await step(record, { ...label, part: 'collapse' }, async () => ({ ...await setExpanded(false),
    selection: await request('selection.status') }));
  await step(record, { ...label, part: 'reads-collapsed' }, async () => ({
    status: await request('cursor.status', { cursor }),
    launch: await request('cursor.launchSettings', { cursor }),
    play: await request('cursor.playState', { cursor }),
    metadata: await request('cursor.clipMetadata', { cursor }),
  }));
  const d = declared(1);
  await step(record, { ...label, part: 'setNotes-collapsed' }, async () => {
    await request('cursor.setStepSize', { cursor, stepSize: 1 / 4 });
    await request('cursor.setNotes', { cursor, channel: d.channel, notes: [[MARKER.step, MARKER.pitch, 100, 0.25]] });
    await pause(300);
    const rows = await rowsOf(id);
    await request('cursor.clearNote', { cursor, channel: d.channel, x: MARKER.step, y: MARKER.pitch });
    await pause(300);
    return { rows, after: await rowsOf(id), expanded: await expandedNow() };
  });
  await step(record, { ...label, part: 'setClipMetadata-collapsed' }, async () => {
    const before = (await rawRead(id, 1)).metadata?.name;
    await request('cursor.setClipMetadata', { cursor, name: 'gn-8h4a5-p1' });
    await pause(300);
    const rows = await rowsOf(id);
    await request('cursor.setClipMetadata', { cursor, name: String(before ?? '') });
    await pause(300);
    const names = Object.fromEntries(Object.entries(rows).map(([r, v]) => [r, (v as Wire).metadata?.name]));
    return { before, names, restored: (await rawRead(id, 1)).metadata?.name };
  });
  await step(record, { ...label, part: 'final' }, async () => ({ status: await request('cursor.status', { cursor }),
    selection: await request('selection.status'), expanded: await expandedNow() }));
}

/** P2: the group collapsed and the cursor unpinned. One batch points at `in` row 1 and writes the marker. */
async function p2(state: Wire, record: Wire[]): Promise<void> {
  const id = String(state.tracks.in), cursor = '1', d = declared(1);
  if (await expandedNow()) await setExpanded(false);
  await request('cursor.pin', { cursor, pinned: false });
  await request('cursor.pinTrack', { cursor, pinned: false });
  // Move the cursor off the target first, so that no earlier point can make the result pass.
  await request('cursor.pointTrack', { cursor, trackIndex: (await rowOf(String(state.tracks.after))).index });
  await request('slot.select', { trackIndex: (await rowOf(String(state.tracks.after))).index, slotIndex: 2, mechanism: 'track' });
  await pause(300);
  const index = Number((await rowOf(id)).index);
  await step(record, { probe: 'P2', part: 'batch' }, async () => {
    const before = await request('cursor.status', { cursor });
    const reply = await request('batch.run', { verbose: true, ops: [
      { method: 'cursor.pointTrack', params: { cursor, trackIndex: index } },
      { method: 'slot.select', params: { trackIndex: index, slotIndex: 1, mechanism: 'track' } },
      { method: 'cursor.setStepSize', params: { cursor, stepSize: 1 / 4 } },
      { method: 'cursor.setNotes', params: { cursor, channel: d.channel, notes: [[MARKER.step, MARKER.pitch, 100, 0.25]] } },
    ] });
    await pause(400);
    return { before, reply, status: await request('cursor.status', { cursor }), rows: await rowsOf(id) };
  });
  // Remove the marker from each row that holds it. Expand so that each row is reachable.
  await step(record, { probe: 'P2', part: 'cleanup' }, async () => {
    await setExpanded(true);
    const adapter = new LiveAdapter({ transport });
    await adapter.hello();
    const removed: number[] = [];
    for (const row of ROWS) {
      const read = await rawRead(id, row);
      const hit = (read.notes as number[][] | undefined)?.find(n => n[1] === MARKER.pitch && n[2] === markerCell);
      if (!hit) continue;
      await (adapter as unknown as E131Context).pointAtClip(await clipAt(id, row), index, new Map(), cursor);
      await request('cursor.setStepSize', { cursor, stepSize: 1 / 4 });
      await request('cursor.clearNote', { cursor, channel: hit[0], x: MARKER.step, y: MARKER.pitch });
      removed.push(row);
    }
    await pause(300);
    const after = await rowsOf(id);
    await setExpanded(false);
    return { removed, after };
  });
}

/** P3: one expand and collapse with no other action. */
async function p3(record: Wire[]): Promise<void> {
  if (await expandedNow()) await setExpanded(false);
  await step(record, { probe: 'P3' }, async () => {
    const before = await snapshotState();
    await setExpanded(true);
    const expanded = await snapshotState();
    await setExpanded(false);
    await pause(200);
    return { before, expanded, after: await snapshotState() };
  });
}

async function probes(out: string, statePath: string): Promise<void> {
  const entry = await guard('phase-8-probe-v1'), state = await load(statePath);
  const report: Wire = { schema: 'phase8h4a5-probes-v1', entry, tracks: await tracks(), steps: [] };
  try {
    await p3(report.steps);
    await p1(state, 'outside', report.steps);
    await p1(state, 'inside', report.steps);
    await p2(state, report.steps);
    report.final = { tracks: await tracks(), selection: await request('selection.status'), expanded: await expandedNow() };
  } finally { await artifact(out, report); }
}

/** Point cursor 0 at device 0 of a track, as the adapter does, and wait for the device name. */
async function pointDevice(id: string, name: string): Promise<void> {
  const index = Number((await rowOf(id)).index);
  await request('cursor.pinTrack', { cursor: '0', pinned: false });
  await request('cursor.pointTrack', { cursor: '0', trackIndex: index });
  await request('devcursor.selectAt', { deviceIndex: 0 });
  await until(() => request('directparam.callbacks'), v => v.trackChannelId === id && v.deviceName === name, 5_000);
}
const delta = (a: Wire, b: Wire): Wire => Object.fromEntries(['ids', 'names', 'values', 'displays',
  'remotePageNames', 'remoteSelectedPage'].map(k => [k, Number(b[k]) - Number(a[k])]));

/** Begin a DirectParameter generation and poll until its IDs settle, or for `limit` ms. */
async function settleParams(limit = 2_000): Promise<Wire> {
  const started = performance.now();
  const begun = await request('directparam.list', { begin: true });
  let observed: Wire = begun, polls = 0;
  while (performance.now() - started < limit) {
    observed = await request('directparam.list', {});
    polls++;
    if (observed.idsGeneration === begun.generation && observed.count > 0
        && (observed.params as Wire[]).every(p => typeof p.value === 'number' && typeof p.name === 'string')) break;
    await pause(25);
  }
  return { generation: begun.generation, idsGeneration: observed.idsGeneration, count: observed.count,
    named: (observed.params as Wire[]).filter(p => typeof p.name === 'string').length,
    valued: (observed.params as Wire[]).filter(p => typeof p.value === 'number').length,
    observedTrack: observed.observedTrackChannelId, deviceName: observed.deviceName, polls,
    settled: observed.idsGeneration === begun.generation && observed.count > 0,
    ms: Math.round(performance.now() - started), first: (observed.params as Wire[])[0] };
}
async function settleRemote(limit = 2_000): Promise<Wire> {
  const started = performance.now();
  let reply = await request('remote.list', { begin: true });
  const generation = reply.generation;
  let polls = 0;
  while (performance.now() - started < limit) {
    if (Array.isArray(reply.preparePages) && reply.preparePages.length > 0) {
      for (const page of reply.preparePages) await request('remote.list', { preparePage: page, generation });
    }
    reply = await request('remote.list', {});
    polls++;
    if (reply.observedGeneration === generation) break;
    await pause(25);
  }
  return { generation, observedGeneration: reply.observedGeneration, observedTrack: reply.observedTrackChannelId,
    deviceName: reply.deviceName, existing: reply.existing, settled: reply.observedGeneration === generation, polls,
    ms: Math.round(performance.now() - started) };
}

/** One device switch: the callbacks from the point through the settle, and the settle itself. */
async function switchTo(state: Wire, key: string, hop?: 'empty' | 'empty-back' | 'empty-then-back'): Promise<Wire> {
  const id = String(state.tracks[key]), name = INSTRUMENT[key]![1];
  const c0 = await request('directparam.callbacks');
  const started = performance.now();
  await pointDevice(id, name);
  const pointedMs = Math.round(performance.now() - started);
  await pause(300);
  const c1 = await request('directparam.callbacks');
  let hopMs: number | undefined;
  if (hop !== undefined) {
    const t = performance.now();
    if (hop === 'empty-then-back') {
      await request('directparam.hop', { mode: 'empty' });
      await until(() => request('directparam.callbacks'), v => v.deviceExists === false, 2_000).catch(() => undefined);
      await request('devcursor.selectAt', { deviceIndex: 0 });
      await until(() => request('directparam.callbacks'), v => v.deviceExists === true && v.deviceName === name, 2_000);
    } else {
      await request('directparam.hop', { mode: hop, deviceIndex: 0 });
      if (hop === 'empty') {
        await until(() => request('directparam.callbacks'), v => v.deviceExists === false, 2_000).catch(() => undefined);
        await request('devcursor.selectAt', { deviceIndex: 0 });
        await until(() => request('directparam.callbacks'), v => v.deviceName === name, 2_000);
      }
    }
    hopMs = Math.round(performance.now() - t);
  }
  const params = await settleParams();
  const c2 = await request('directparam.callbacks');
  const remote = await settleRemote();
  const c3 = await request('directparam.callbacks');
  return { key, hop: hop ?? 'none', pointedMs, hopMs, beforeBegin: delta(c0, c1), afterBegin: delta(c1, c2),
    remoteDelta: delta(c2, c3), maps: c2, params, remote };
}

async function params(out: string, statePath: string): Promise<void> {
  const entry = await guard('phase-8-probe-v1'), state = await load(statePath);
  const report: Wire = { schema: 'phase8h4a5-params-v1', entry, tracks: await tracks(), steps: [] };
  const run = async (label: Wire, key: string, hop?: 'empty' | 'empty-back' | 'empty-then-back'): Promise<void> => {
    await step(report.steps, label, async () => await switchTo(state, key, hop));
  };
  try {
    // P4: equal default values on both Polysynths. Then the order of the acceptance matrix.
    for (const key of ['before', 'in', 'in2', 'after', 'before', 'in']) await run({ probe: 'P4', case: 'equal' }, key);
    // P4 with unequal values: the adapter writes parameter 0 of `in` after a Phase-4 (a different type settles),
    // then the probe switches before -> in again. The restore uses the same path.
    const adapter = new LiveAdapter({ transport });
    await adapter.hello();
    const p0 = device(track(String(state.tracks.in)), 0);
    const guardChain = { expectedName: 'Polysynth', expectedChain: ['Polysynth'], expectedEnabledChain: [true] };
    const setIn = async (value?: number): Promise<Wire> => {
      await run({ probe: 'P4', case: 'via-phase4' }, 'in2');
      const read = (await adapter.read([p0])).entries[addressKey(p0)]?.value as Wire | undefined;
      const first = read?.device?.params?.[0] as Wire | undefined;
      assert(first, 'the device read of in has no parameter');
      const target = value ?? (first.value < 0.5 ? first.value + 0.25 : first.value - 0.25);
      await adapter.apply({ ops: [{ op: 'param.set', param: param(p0, String(first.id)), value: target, ...guardChain }] });
      return { id: first.id, base: first.value, target };
    };
    let changed: Wire | undefined;
    await step(report.steps, { probe: 'P4', case: 'change-value' }, async () => (changed = await setIn()));
    await run({ probe: 'P4', case: 'unequal' }, 'before');
    await run({ probe: 'P4', case: 'unequal' }, 'in');
    if (changed) await step(report.steps, { probe: 'P4', case: 'restore-value' }, async () => await setIn(changed!.base));
    // P5: hops after a same-type switch.
    for (const hop of ['empty-back', 'empty', 'empty-then-back'] as const) {
      await run({ probe: 'P5', case: 'reset' }, 'before');
      await run({ probe: 'P5', case: hop }, 'in', hop);
    }
    report.final = await request('directparam.callbacks');
  } finally { await artifact(out, report); }
}

// ------------------------------------------------------------------ live acceptance (normal profile)

export const GROUP_POINT = 'expand-collapsed-point-v1';
export const PARAMETER_SETTLE = 'same-ids-switch-v1';

/** The normal profile with the 8h4a5 markers, and (unless read-only) an owned unsaved project. */
async function guardNormal(project?: string): Promise<Wire> {
  const hello = await request('contract.hello');
  assert.equal(hello.runtimeProfile, 'normal-v1');
  const mark = await request('revision.get');
  if (project) assert.equal(mark.project, project);
  else assert(/^New \d+$/.test(mark.project), `use an owned unsaved project, got ${mark.project}`);
  const rig = await request('rig.info');
  assert.equal(rig.groupPoint, GROUP_POINT, 'the deployed extension lacks the 8h4a5 group point marker');
  assert.equal(rig.parameterSettle, PARAMETER_SETTLE);
  assert.equal(rig.clipReader?.revision, 'clip-reader-v3');
  return { hello, mark, rig };
}

/** A fresh adapter: no held cursor can make a result pass (8h4a4 retrospective). Its trace counts group points. */
async function fresh(): Promise<{ adapter: LiveAdapter; trace: string[] }> {
  const trace: string[] = [];
  const adapter = new LiveAdapter({ transport, onTrace: event => trace.push(event.action) });
  await adapter.hello();
  return { adapter, trace };
}
const methodsSince = (start: number): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const call of transport.calls.slice(start)) out[call.method] = (out[call.method] ?? 0) + 1;
  return out;
};
const selectionOf = (s: Wire): number[] => [s.trackIndex, s.slotIndex, s.mixerTrackIndex];
const hiddenOf = async (state: Wire): Promise<Record<string, boolean>> => {
  const list = await tracks();
  return Object.fromEntries(Object.entries(state.tracks as Record<string, string>)
    .map(([key, id]) => [key, list.find(t => t.channelId === id)?.hidden === true]));
};
const entryOf = (snapshot: Awaited<ReturnType<LiveAdapter['read']>>, address: Address): Wire | undefined =>
  snapshot.entries[addressKey(address)] as Wire | undefined;

/**
 * One acceptance step: its wire calls by method, the selection before and after, the hidden flags after, and
 * the group points of its adapter.
 */
async function accept(record: Wire[], state: Wire, label: Wire, run: (trace: string[]) => Promise<Wire>): Promise<Wire> {
  const start = transport.calls.length;
  const before = await request('selection.status');
  const trace: string[] = [];
  const last = await step(record, label, async () => await run(trace));
  last.calls = methodsSince(start);
  last.groupPoints = trace.filter(a => a === 'group-point').length;
  last.selectionBefore = selectionOf(before);
  last.selectionAfter = selectionOf(await request('selection.status'));
  last.hidden = await hiddenOf(state);
  return last;
}
/** Every row of one track through the product reader: notes, metadata name, and launch block. */
async function rowsState(id: string, rows: readonly number[] = ROWS): Promise<Wire> {
  const out: Wire = {};
  for (const row of rows) {
    const read = await rawRead(id, row);
    out[row] = { notes: read.notes, name: read.metadata?.name, launch: read.launch, refused: read.refused };
  }
  return out;
}
const sameExcept = (a: Wire, b: Wire, row: number, field: string): boolean =>
  Object.keys(a).every(r => Number(r) === row || JSON.stringify(a[r][field]) === JSON.stringify(b[r][field]));

/** The reads of one target from one fresh adapter. */
async function targetReads(id: string, row: number, trace: string[]): Promise<Wire> {
  const d = declared(row), c = await clipAt(id, row);
  const { adapter, trace: own } = await fresh();
  const addresses = [clip(c.slot), clipLaunch(c), clipPlay(c), clipMetadata(c), notes(c, d.channel)];
  const snapshot = await adapter.read(addresses);
  trace.push(...own);
  const values = Object.fromEntries(addresses.map(a => [a.kind, entryOf(snapshot, a)?.value]));
  assert.equal(values.clip?.exists, true, 'clip');
  assert.equal(values.clip?.lengthBeats, d.beats, 'clip length');
  assert.equal(values.clipLaunch?.of, 'clipLaunch', 'clipLaunch');
  assert.equal(values.clipPlay?.of, 'clipPlay', 'clipPlay');
  assert.equal(values.clipMetadata?.metadata?.lengthBeats, d.beats, 'clipMetadata length');
  assert.deepEqual((values.notes?.notes as Wire[] | undefined)?.map(n => [n.startBeats, n.pitch]), [[d.step / 4, d.pitch]], 'notes');
  return { values };
}

/** Note insert and remove on one row, each from a fresh adapter. Every row is checked with clip.read. */
async function noteRoundTrip(id: string, row: number, trace: string[], rows: readonly number[] = ROWS): Promise<Wire> {
  const d = declared(row), c = await clipAt(id, row);
  const marker = { startBeats: 2, pitch: MARKER.pitch, velocity: 100, durationBeats: 0.25 };
  const base = await rowsState(id, rows);
  const a = await fresh();
  await a.adapter.apply({ ops: [{ op: 'note.insert', clip: c, channel: d.channel, notes: [marker] }] });
  trace.push(...a.trace);
  const inserted = await rowsState(id, rows);
  const sorted = (rows: number[][]): string[] => rows.map(n => JSON.stringify(n)).sort();
  assert.deepEqual(sorted(inserted[row].notes), sorted([...base[row].notes, [d.channel, MARKER.pitch, markerCell]]),
    'the marker is not in the target row');
  assert(sameExcept(base, inserted, row, 'notes'), 'another row changed');
  const b = await fresh();
  await b.adapter.apply({ ops: [{ op: 'note.remove', clip: c, channel: d.channel, notes: [marker] }] });
  trace.push(...b.trace);
  const removed = await rowsState(id, rows);
  assert.deepEqual(removed, base, 'the track did not restore');
  return { inserted: inserted[row].notes };
}

/** clip.update and restore on one row. The colour stays a palette colour (a new clip's colour is outside it). */
async function updateRoundTrip(id: string, row: number, trace: string[], rows: readonly number[] = ROWS): Promise<Wire> {
  const c = await clipAt(id, row);
  const base = await rowsState(id, rows);
  const a = await fresh();
  const before = entryOf(await a.adapter.read([clipMetadata(c)]), clipMetadata(c))?.value.metadata as Wire;
  const color = EXACT_CLIP_COLORS[3]!.color;
  const changed = { ...before, name: `gn-8h4a5-r${row}`, color };
  await a.adapter.apply({ ops: [{ op: 'clip.update', clip: c, metadata: changed as never }] });
  trace.push(...a.trace);
  const updated = await rowsState(id, rows);
  assert.equal(updated[row].name, changed.name, 'the name is not in the target row');
  assert(sameExcept(base, updated, row, 'name'), 'another row name changed');
  assert(sameExcept(base, updated, -1, 'notes'), 'notes changed');
  const b = await fresh();
  await b.adapter.apply({ ops: [{ op: 'clip.update', clip: c, metadata: { ...changed, name: before.name } as never }] });
  trace.push(...b.trace);
  const restored = await rowsState(id, rows);
  assert.deepEqual(restored, base, 'the track did not restore');
  return { name: changed.name };
}

/** clip.launchSettings and restore on one row. Each launch block is read with clip.read. */
async function launchRoundTrip(id: string, row: number, trace: string[], rows: readonly number[] = ROWS): Promise<Wire> {
  const c = await clipAt(id, row);
  const base = await rowsState(id, rows);
  const was = base[row].launch as Wire;
  const set = async (quantization: string, mode: string, useLoopStart: boolean): Promise<void> => {
    const a = await fresh();
    await a.adapter.apply({ ops: [{ op: 'clip.launchSettings', clip: c, quantization, mode,
      useLoopStartAsQuantizationReference: useLoopStart } as Op] });
    trace.push(...a.trace);
  };
  await set('1/4', 'synced', !was.useLoopStartAsQuantizationReference);
  const changed = await rowsState(id, rows);
  assert.deepEqual(changed[row].launch, { launchQuantization: '1/4', launchMode: 'synced',
    useLoopStartAsQuantizationReference: !was.useLoopStartAsQuantizationReference }, 'the target row did not change');
  assert(sameExcept(base, changed, row, 'launch'), 'another row launch block changed');
  await set(was.launchQuantization, was.launchMode, was.useLoopStartAsQuantizationReference);
  assert.deepEqual(await rowsState(id, rows), base, 'the track did not restore');
  return { was, changed: changed[row].launch };
}

/** The note observer arm, through the product point (cursor `observer`), from a fresh adapter. */
async function observerArm(id: string, row: number, trace: string[]): Promise<Wire> {
  const c = await clipAt(id, row), index = Number((await rowOf(id)).index);
  const { adapter, trace: own } = await fresh();
  await adapter.preserveSelection(async () => {
    const prepared = await request('note.observer.prepare');
    await (adapter as unknown as E131Context).pointAtClip(c, index, new Map(), 'observer');
    const armed = await request('note.observer.arm', { generation: prepared.generation, trackId: id,
      trackIndex: index, slotIndex: row });
    assert(Number.isInteger(armed.afterSequence), `the arm returned ${JSON.stringify(armed)}`);
  });
  trace.push(...own);
  return {};
}

async function matrix(out: string, statePath: string, view: string): Promise<void> {
  assert(view === 'expanded' || view === 'collapsed');
  const entry = await guardNormal(), state = await load(statePath);
  const hidden = await hiddenOf(state);
  assert.deepEqual([hidden.in, hidden.in2], view === 'collapsed' ? [true, true] : [false, false], `the group is not ${view}`);
  // The entry selection: a slot of a track in no group. Each step must leave it unchanged.
  await request('slot.select', { trackIndex: (await rowOf(String(state.tracks.after))).index, slotIndex: 0, mechanism: 'track' });
  await pause(200);
  const report: Wire = { schema: 'phase8h4a5-matrix-v1', view, entry, tracks: await tracks(), steps: [] };
  try {
    for (const key of KEYS) {
      const id = String(state.tracks[key]);
      for (const row of ROWS) {
        const at = { key, row };
        await accept(report.steps, state, { ...at, step: 'reads' }, trace => targetReads(id, row, trace));
        await accept(report.steps, state, { ...at, step: 'notes' }, trace => noteRoundTrip(id, row, trace));
        await accept(report.steps, state, { ...at, step: 'clip.update' }, trace => updateRoundTrip(id, row, trace));
        await accept(report.steps, state, { ...at, step: 'launch' }, trace => launchRoundTrip(id, row, trace));
        await accept(report.steps, state, { ...at, step: 'observer' }, trace => observerArm(id, row, trace));
      }
    }
    report.final = { tracks: await tracks(), selection: await request('selection.status') };
  } finally { await artifact(out, report); }
}

async function ownPath(out: string, statePath: string): Promise<void> {
  const entry = await guardNormal(), state = await load(statePath);
  const id = String(state.tracks.in);
  const selection = await request('selection.status');
  const report: Wire = { schema: 'phase8h4a5-own-path-v1', entry, selection, hidden: await hiddenOf(state),
    tracks: await tracks(), steps: [] };
  try {
    assert.equal(report.hidden.in, true, 'the operator did not collapse the group');
    for (const pass of [1, 2]) {
      await accept(report.steps, state, { pass, step: 'reads' }, trace => targetReads(id, 2, trace));
      await accept(report.steps, state, { pass, step: 'notes' }, trace => noteRoundTrip(id, 2, trace));
    }
    report.final = await request('selection.status');
  } finally { await artifact(out, report); }
}

async function refusal(out: string, statePath: string): Promise<void> {
  const entry = await guardNormal(), state = await load(statePath);
  const id = String(state.tracks.in);
  const report: Wire = { schema: 'phase8h4a5-refusal-v1', entry, hidden: await hiddenOf(state), steps: [] };
  try {
    assert.equal(report.hidden.in, true, 'the group is not collapsed');
    const base = await rowsState(id);
    await accept(report.steps, state, { step: 'stale-scene' }, async trace => {
      const c = await clipAt(id, 2), mark = await request('revision.get');
      const { adapter, trace: own } = await fresh();
      let refused = '';
      try {
        await adapter.apply({ ops: [{ op: 'note.insert', clip: c, channel: declared(2).channel,
          notes: [{ startBeats: 2, pitch: MARKER.pitch, velocity: 100, durationBeats: 0.25 }] }],
        ifScene: { generation: String(mark.generation), project: String(mark.project), sceneEpoch: Number(mark.sceneEpoch) + 1 } });
      } catch (error) { refused = failure(error); }
      trace.push(...own);
      assert(refused !== '', 'the stale scene guard did not refuse');
      return { refused };
    });
    report.after = await rowsState(id);
    assert.deepEqual(report.after, base, 'the refused write changed the track');
    await accept(report.steps, state, { step: 'next-read' }, trace => targetReads(id, 2, trace));
  } finally { await artifact(out, report); }
}

async function setupNested(statePath: string): Promise<void> {
  await guardNormal();
  const state = await load(statePath);
  const { adapter } = await fresh();
  const id = await createTrack('gn-8h4a5-deep');
  for (const row of ROWS) {
    const d = declared(row), index = Number((await rowOf(id)).index);
    await request('clip.create', { trackIndex: index, slotIndex: row, lengthBeats: d.beats });
    await until(() => request('slot.status', { trackIndex: index, slotIndex: row }), value => value.hasContent === true);
    await (adapter as unknown as E131Context).pointAtClip(await clipAt(id, row), index, new Map(), 'fine');
    await request('cursor.setStepSize', { cursor: 'fine', stepSize: 1 / 4 });
    await request('cursor.setNotes', { cursor: 'fine', channel: d.channel, notes: [[d.step, d.pitch, 100, 0.25]] });
    await pause(250);
  }
  state.tracks.deep = id; await save(statePath, state);
  console.log('Operator: select gn-8h4a5-deep, press Cmd+G; then select the new group track, press Cmd+G again.');
}

async function nested(out: string, statePath: string): Promise<void> {
  const entry = await guardNormal(), state = await load(statePath);
  const id = String(state.tracks.deep);
  const report: Wire = { schema: 'phase8h4a5-nested-v1', entry, hidden: await hiddenOf(state), tracks: await tracks(),
    steps: [] };
  try {
    assert.equal(report.hidden.deep, true, 'the outer group is not collapsed');
    for (const row of ROWS) {
      await accept(report.steps, state, { row, step: 'reads' }, trace => targetReads(id, row, trace));
      await accept(report.steps, state, { row, step: 'notes' }, trace => noteRoundTrip(id, row, trace));
      await accept(report.steps, state, { row, step: 'launch' }, trace => launchRoundTrip(id, row, trace));
    }
  } finally { await artifact(out, report); }
}

async function devices(out: string, statePath: string): Promise<void> {
  const entry = await guardNormal(), state = await load(statePath);
  const report: Wire = { schema: 'phase8h4a5-devices-v1', entry, tracks: await tracks(), steps: [] };
  try {
    for (const key of ['before', 'in', 'in2', 'after', 'before']) {
      const id = String(state.tracks[key]), name = INSTRUMENT[key]![1];
      await accept(report.steps, state, { key, step: 'device' }, async () => {
        const start = transport.calls.length;
        const d = device(track(id), 0);
        const { adapter } = await fresh();
        const read = entryOf(await adapter.read([d]), d)?.value;
        assert.equal(read?.device?.name, name);
        const p = read.device.params?.[0] as Wire | undefined;
        assert(p, 'the device read has no parameter');
        const address = param(d, String(p.id));
        const target = p.value < 0.5 ? p.value + 0.25 : p.value - 0.25;
        const guardChain = { expectedName: name, expectedChain: [name], expectedEnabledChain: [true] };
        await adapter.apply({ ops: [{ op: 'param.set', param: address, value: target, ...guardChain }] });
        const written = entryOf(await adapter.read([address]), address)?.value.param.value as number;
        await adapter.apply({ ops: [{ op: 'param.set', param: address, value: p.value, ...guardChain }] });
        const restored = entryOf(await adapter.read([address]), address)?.value.param.value as number;
        assert(Math.abs(written - target) < 1e-3, `param.set read ${written}, wanted ${target}`);
        assert(Math.abs(restored - p.value) < 1e-3, `param restore read ${restored}, wanted ${p.value}`);
        const remote = entryOf(await adapter.read([remotes(d)]), remotes(d))?.value;
        assert(remote !== undefined, 'the remote controls did not settle');
        const settledBy = transport.calls.slice(start).filter(c => c.method === 'directparam.list')
          .map(c => c.reply.result?.settledBy).filter(v => v);
        return { params: read.device.params.length, param: p.id, base: p.value, written, restored,
          remotePages: remote.remotes?.pages?.length ?? remote.pages?.length, settledBy: [...new Set(settledBy)] };
      });
    }
  } finally { await artifact(out, report); }
}

async function tools(out: string, statePath: string): Promise<void> {
  const entry = await guardNormal(), state = await load(statePath);
  const id = String(state.tracks.in), row = 2;
  const { adapter } = await fresh();
  const workspace = workspaceOf({ ready: async () => undefined, adapter, executor: new Executor(adapter),
    stash: new Stash(), observationStore: new FakeObservationStore() });
  // The entry selection: a slot of a track in no group, as in the matrix.
  await request('slot.select', { trackIndex: (await rowOf(String(state.tracks.after))).index, slotIndex: 0, mechanism: 'track' });
  await pause(200);
  const report: Wire = { schema: 'phase8h4a5-tools-v1', entry, hidden: await hiddenOf(state), steps: [] };
  const run = async (name: string, args: unknown, check?: (result: Wire) => void): Promise<Wire> => {
    const last = await accept(report.steps, state, { tool: name }, async () => {
      const result = await callTool(workspace, name, args) as Wire;
      check?.(result);
      return { result };
    });
    return last.result ?? {};
  };
  try {
    const base = await rowsState(id);
    const meta = (await rawRead(id, row)).metadata as Wire;
    await run('read_clip', { trackId: id, row, channel: declared(row).channel },
      r => assert.equal(JSON.stringify(r).includes('"pitch":62'), true, 'read_clip lacks the row 2 note'));
    await run('inspect_clip_block', { trackId: id, firstRow: 0, lastRow: 2 });
    const was = base[row].launch as Wire;
    await run('set_clip_launch', { clips: [{ trackId: id, row, quantization: '1/4', mode: 'synced' }] });
    await run('set_clip_launch', { clips: [{ trackId: id, row, quantization: was.launchQuantization, mode: was.launchMode,
      useLoopStartAsQuantizationReference: was.useLoopStartAsQuantizationReference }] });
    const color = EXACT_CLIP_COLORS[3]!.color;
    const metadata = { name: 'gn-8h4a5-tool', color, lengthBeats: meta.loopLength, playStartBeats: meta.playStart,
      loopEnabled: meta.loopEnabled, loopStartBeats: meta.loopStart, loopEndBeats: meta.loopStart + meta.loopLength };
    await run('set_clip_metadata', { clips: [{ trackId: id, row, metadata }] });
    await run('set_clip_metadata', { clips: [{ trackId: id, row, metadata: { ...metadata, name: meta.name } }] });
    await run('write_notes', { clips: [{ trackId: id, row, channel: declared(row).channel,
      notes: [{ startBeats: 2, pitch: MARKER.pitch, velocity: 100, durationBeats: 0.25 }] }] });
    const written = await rowsState(id);
    report.written = written[row].notes;
    // write_notes adds notes. Restore the declared clip: erase it, then write the declared note.
    await run('erase_notes', { clips: [{ trackId: id, row }] });
    await run('write_notes', { clips: [{ trackId: id, row, channel: declared(row).channel,
      notes: [{ startBeats: declared(row).step / 4, pitch: declared(row).pitch, velocity: 100, durationBeats: 0.25 }] }] });
    report.restored = await rowsState(id);
    await run('inspect_devices', { trackId: id });
    const params = await run('inspect_device_parameters', { device: { trackId: id, devicePosition: 0 } });
    await run('inspect_device_parameters', { device: { trackId: id, devicePosition: 0 }, view: 'remote-controls' });
    const first = (params.parameters as Wire[] | undefined)?.[0];
    if (first) {
      const value = Number(first.normalizedValue ?? first.value);
      await run('set_parameter', { settings: [{ kind: 'direct', device: { trackId: id, devicePosition: 0 },
        parameterId: first.id ?? first.parameterId, normalizedValue: value < 0.5 ? value + 0.25 : value - 0.25 }] });
      await run('set_parameter', { settings: [{ kind: 'direct', device: { trackId: id, devicePosition: 0 },
        parameterId: first.id ?? first.parameterId, normalizedValue: value }] });
    }
    await run('set_device_enabled', { settings: [{ trackId: id, devicePosition: 0, enabled: false }] });
    await run('set_device_enabled', { settings: [{ trackId: id, devicePosition: 0, enabled: true }] });
    report.final = await rowsState(id);
    assert.deepEqual(report.final, base, 'the tools left residue in the track');
  } finally { await artifact(out, report); }
}

async function anchor(out: string): Promise<void> {
  const entry = await guardNormal('gn-scale-test');
  const list = await tracks();
  const report: Wire = { schema: 'phase8h4a5-anchor-v1', entry, tracks: list, steps: [] };
  const state = { tracks: Object.fromEntries(['gn-A', 'gn-E16', 'gn-sel'].map(n => [n, list.find(t => t.name === n)!.channelId])) };
  try {
    for (const [name, rows] of [['gn-E16', [0, 1, 2]], ['gn-A', [0]], ['gn-sel', [0]]] as const) {
      const id = String(state.tracks[name]);
      for (const row of rows) {
        await accept(report.steps, state, { name, row }, async trace => {
          const c = await clipAt(id, row);
          const { adapter, trace: own } = await fresh();
          const addresses = [clip(c.slot), clipLaunch(c), clipPlay(c), clipMetadata(c)];
          const snapshot = await adapter.read(addresses);
          trace.push(...own);
          const values = Object.fromEntries(addresses.map(a => [a.kind, entryOf(snapshot, a)?.value]));
          assert.equal(values.clip?.exists, true); assert.equal(values.clipMetadata?.of, 'clipMetadata');
          assert.equal(values.clipLaunch?.of, 'clipLaunch'); assert.equal(values.clipPlay?.of, 'clipPlay');
          return { values };
        });
      }
    }
    const e16 = String(state.tracks['gn-E16']);
    await accept(report.steps, state, { name: 'gn-E16', row: 15, empty: true }, async trace => {
      const c = await clipAt(e16, 15);
      const { adapter, trace: own } = await fresh();
      const value = entryOf(await adapter.read([clip(c.slot)]), clip(c.slot))?.value;
      trace.push(...own);
      assert.deepEqual(value, { of: 'clip', exists: false });
      return { value };
    });
    report.final = { tracks: await tracks(), mark: await request('revision.get') };
  } finally { await artifact(out, report); }
}

async function cleanup(out: string, statePath: string): Promise<void> {
  const entry = await guard((await request('contract.hello')).runtimeProfile), state = await load(statePath);
  const entryIds = (state.entryTracks as Wire[]).map(row => row.channelId);
  const deleted: string[] = [];
  for (;;) {
    const extra = (await tracks()).find(row => !entryIds.includes(row.channelId));
    if (!extra) break;
    await request('track.delete', { trackIndex: extra.index });
    await until(() => request('track.list'), value => !(value.tracks as Wire[]).some(row => row.channelId === extra.channelId));
    deleted.push(String(extra.channelId));
  }
  const final = await tracks();
  assert.deepEqual(final.map(row => row.channelId), entryIds, 'the owned project does not match its entry tracks');
  await artifact(out, { schema: 'phase8h4a5-cleanup-v1', entry, deleted, tracks: final, entryTracks: state.entryTracks });
  console.log(JSON.stringify({ deleted: deleted.length, tracks: final.length }));
}

export const NORMAL: [number, string] = [88, '68d457c4c4d1d7b3'];
const sel = (s: Wire): string => JSON.stringify(s);
const pe = (s: Wire): number => s.calls?.['cursor.pointExpanded'] ?? 0;
const pt = (s: Wire): number => s.calls?.['cursor.pointTrack'] ?? 0;

/** Check every E243 claim from the retained artifacts. */
export async function verifyOffline(dir: string): Promise<Wire> {
  const summary: Wire = {};
  const state = await load(`${dir}/state.json`);

  // P1-P3 (probe profile).
  const probes = await gz(`${dir}/probes.json.gz`);
  assert.equal(probes.schema, 'phase8h4a5-probes-v1');
  assert.equal(probes.entry.hello.runtimeProfile, 'phase-8-probe-v1');
  const p3 = (probes.steps as Wire[]).find(s => s.probe === 'P3')!;
  for (const field of ['revision', 'sceneEpoch', 'contentEpoch', 'order']) {
    assert.deepEqual(p3.expanded[field], p3.before[field], `P3 ${field}`);
    assert.deepEqual(p3.after[field], p3.before[field], `P3 ${field}`);
  }
  assert.deepEqual(selectionOf(p3.after.selection), selectionOf(p3.before.selection), 'P3 selection');
  for (const entry of ['outside', 'inside']) {
    const part = (name: string): Wire => (probes.steps as Wire[]).find(s => s.probe === 'P1' && s.entry === entry && s.part === name)!;
    const reads = part('reads-collapsed');
    assert.deepEqual([reads.status.trackChannelId, reads.status.sceneIndex, reads.status.isPinned, reads.status.cursorTrackPinned],
      [state.tracks.in, 1, true, true], `P1 ${entry}: the pinned cursor kept row 1`);
    assert.equal(reads.launch.sceneIndex, 1); assert.equal(reads.play.sceneIndex, 1);
    assert.equal(reads.metadata.loopLength, declared(1).beats);
    const notesPart = part('setNotes-collapsed');
    assert.equal(notesPart.expanded, false);
    assert.deepEqual(notesPart.rows[1].notes, [...declaredNotes(1), [1, MARKER.pitch, markerCell]], `P1 ${entry}: row 1`);
    for (const row of [0, 2]) assert.deepEqual(notesPart.rows[row].notes, declaredNotes(row), `P1 ${entry}: row ${row}`);
    for (const row of ROWS) assert.deepEqual(notesPart.after[row].notes, declaredNotes(row), `P1 ${entry}: restored`);
    assert.deepEqual(part('setClipMetadata-collapsed').names, { 0: '', 1: 'gn-8h4a5-p1', 2: '' }, `P1 ${entry}: names`);
  }
  // P1 inside: the collapse moved the mixer selection from the child to the group track.
  const inside = (probes.steps as Wire[]).find(s => s.probe === 'P1' && s.entry === 'inside' && s.part === 'collapse')!;
  assert.equal(inside.selection.mixerTrackIndex, 1);
  const p2 = (probes.steps as Wire[]).find(s => s.probe === 'P2' && s.part === 'batch')!;
  assert.equal(p2.reply.applied, true);
  assert.deepEqual(p2.rows[0].notes, [...declaredNotes(0), [1, MARKER.pitch, markerCell]], 'P2: the write landed in row 0');
  assert.deepEqual(p2.rows[1].notes, declaredNotes(1), 'P2: row 1 did not change');
  const p2clean = (probes.steps as Wire[]).find(s => s.probe === 'P2' && s.part === 'cleanup')!;
  assert.deepEqual(p2clean.removed, [0]);
  for (const row of ROWS) assert.deepEqual(p2clean.after[row].notes, declaredNotes(row));
  summary.probes = { p1: 'kept row 1', p2: 'row 0', p3: 'no change' };

  // P4-P5 (probe profile).
  const params = await gz(`${dir}/params.json.gz`);
  const switches = (params.steps as Wire[]).filter(s => s.params);
  const same = switches.filter(s => s.probe === 'P4' && s.beforeBegin.ids === 0 && s.beforeBegin.names > 0);
  assert(same.length >= 4, 'P4: same-type switches');
  for (const s of same) {
    assert.equal(s.beforeBegin.names, s.beforeBegin.values, 'P4: one name and one value for each ID');
    assert.equal(s.beforeBegin.names, s.key === 'in' || s.key === 'before' ? 55 : 103);
    assert.equal(s.params.settled, false, 'P4: the earlier build did not settle');
    assert.equal(s.remote.settled, true, 'P4: the remote pages settled');
  }
  assert(same.some(s => s.case === 'unequal'), 'P4: also with unequal values');
  for (const s of switches.filter(s => s.probe === 'P4' && s.beforeBegin.ids === 1)) assert.equal(s.params.settled, true);
  for (const s of switches.filter(s => s.probe === 'P5' && s.hop !== 'none')) {
    assert.equal(s.params.settled, false, `P5 ${s.hop}: no hop made the ID observer fire`);
    assert.equal(s.beforeBegin.ids, 0);
  }
  summary.params = { sameTypeSwitches: same.length };

  // Normal profile acceptance.
  for (const log of ['normal-hello.log', 'normal-hello-final.log']) {
    const hello = await readFile(`${dir}/${log}`, 'utf8');
    assert.match(hello, /ALL PASS/);
    assert.match(hello, new RegExp(`"runtimeProfile":"normal-v1".*"methodCount":${NORMAL[0]},"methodsHash":"${NORMAL[1]}"`));
    assert.match(hello, /"groupPoint":"expand-collapsed-point-v1","parameterSettle":"same-ids-switch-v1"/);
  }
  const tools = await gz(`${dir}/tools.json.gz`);
  assert.deepEqual([tools.hidden.in, tools.hidden.in2], [true, true]);
  assert.deepEqual((tools.steps as Wire[]).map(s => s.tool), ['read_clip', 'inspect_clip_block', 'set_clip_launch',
    'set_clip_launch', 'set_clip_metadata', 'set_clip_metadata', 'write_notes', 'erase_notes', 'write_notes',
    'inspect_devices', 'inspect_device_parameters', 'inspect_device_parameters', 'set_parameter', 'set_parameter',
    'set_device_enabled', 'set_device_enabled']);
  for (const s of tools.steps as Wire[]) {
    assert(s.ok, s.tool);
    assert.equal(sel(s.selectionAfter), sel(s.selectionBefore), `${s.tool}: selection`);
    if (s.result.applied !== undefined) assert.equal(s.result.applied, true, s.tool);
    if (s.result.verified !== undefined) assert.equal(s.result.verified, true, s.tool);
    if (s.result.standing !== undefined) assert.equal(s.result.standing, 'stable', s.tool);
  }
  assert.deepEqual(tools.final, tools.restored, 'the tools left no residue');
  // The first tools run restored write_notes wrongly (the tool adds notes); the marker stayed in row 2.
  const first = await gz(`${dir}/tools-first.json.gz`);
  assert.deepEqual(first.final[2].notes, [[2, 62, 256], [2, MARKER.pitch, markerCell]]);

  const cursorKeys = new Set(['in', 'in2']);
  for (const view of ['collapsed', 'expanded']) {
    const m = await gz(`${dir}/matrix-${view}.json.gz`);
    assert.equal(m.view, view);
    assert.equal((m.steps as Wire[]).length, 60);
    for (const s of m.steps as Wire[]) {
      const label = `${view} ${s.key}:${s.row}:${s.step}`;
      assert(s.ok, label);
      assert.deepEqual([s.hidden.in, s.hidden.in2], view === 'collapsed' ? [true, true] : [false, false], `${label}: group`);
      const routed = view === 'collapsed' && cursorKeys.has(s.key);
      if (s.step !== 'observer' || routed) {
        assert.equal(pe(s) > 0, routed, `${label}: group point`);
        if (routed) assert.equal(pt(s), 0, `${label}: no normal point`);
      }
      if (sel(s.selectionAfter) !== sel(s.selectionBefore)) {
        // Two older adapter behaviours on the normal route, not on the group point: a direct read restores the slot
        // only, and the driver's direct observer point is not a borrow, so its scope does not restore.
        assert.equal(pe(s), 0, `${label}: a group point changed the selection`);
        if (s.step === 'reads') assert.deepEqual(s.selectionAfter.slice(0, 2), s.selectionBefore.slice(0, 2), label);
        else assert.equal(s.step, 'observer', label);
      }
    }
    const ms = (key: string, step: string): number[] => (m.steps as Wire[]).filter(s => s.key === key && s.step === step).map(s => s.ms);
    summary[view] = { readsMs: Object.fromEntries(KEYS.map(k => [k, ms(k, 'reads')])),
      notesMs: Object.fromEntries(KEYS.map(k => [k, ms(k, 'notes')])) };
  }
  const own = await gz(`${dir}/own-path.json.gz`);
  assert.equal(own.hidden.in, true);
  assert.deepEqual([own.selection.trackIndex, own.selection.slotIndex], [Number(own.tracks.find((t: Wire) => t.channelId === state.tracks.in).index), 1]);
  for (const s of own.steps as Wire[]) {
    assert(s.ok && pe(s) > 0 && pt(s) === 0 && s.hidden.in, `own ${s.pass}:${s.step}`);
    assert.equal(sel(s.selectionAfter), sel(s.selectionBefore), `own ${s.pass}:${s.step}: selection`);
  }
  assert.deepEqual(selectionOf(own.final), selectionOf(own.selection));
  const refusal = await gz(`${dir}/refusal.json.gz`);
  const stale = (refusal.steps as Wire[])[0]!, next = (refusal.steps as Wire[])[1]!;
  assert.match(stale.refused, /^StaleAddressError/);
  assert(pe(stale) > 0 && stale.calls['batch.run'] === 1 && stale.hidden.in, 'the refusal came after the group point');
  assert(next.ok && next.hidden.in && pe(next) > 0, 'the next read found the group collapsed and read');
  const nested = await gz(`${dir}/nested.json.gz`);
  assert.equal(nested.hidden.deep, true);
  assert.equal((nested.steps as Wire[]).length, 9);
  for (const s of nested.steps as Wire[]) assert(s.ok && pe(s) > 0 && s.hidden.deep, `nested ${s.row}:${s.step}`);
  const devices = await gz(`${dir}/devices.json.gz`);
  assert.deepEqual((devices.steps as Wire[]).map(s => [s.key, s.params, s.settledBy.includes('switch')]),
    [['before', 55, false], ['in', 55, true], ['in2', 103, false], ['after', 103, true], ['before', 55, false]]);
  for (const s of devices.steps as Wire[]) {
    assert(s.ok && Math.abs(s.restored - s.base) < 1e-3 && Math.abs(s.written - s.base) > 0.2, `device ${s.key}`);
    assert(s.remotePages > 0, `device ${s.key}: remotes`);
  }
  summary.devices = (devices.steps as Wire[]).map(s => [s.key, s.ms]);

  const anchor = await gz(`${dir}/anchor.json.gz`);
  assert.equal(anchor.entry.mark.project, 'gn-scale-test');
  assert.deepEqual((anchor.steps as Wire[]).map(s => [s.name, s.row, s.ok, pe(s) > 0]), [['gn-E16', 0, true, true],
    ['gn-E16', 1, true, true], ['gn-E16', 2, true, true], ['gn-A', 0, true, false], ['gn-sel', 0, true, false],
    ['gn-E16', 15, true, false]]);
  assert.deepEqual((anchor.steps as Wire[]).at(-1)!.value, { of: 'clip', exists: false });
  const firstAnchor = await gz(`${dir}/anchor-row15.json.gz`);
  assert.equal((firstAnchor.steps as Wire[]).find(s => s.row === 15)?.ok, false, 'row 15 of gn-E16 is empty');
  const baseline = await load(`${dir}/baseline-final.json`);
  assert.equal(baseline.project, 'gn-scale-test'); assert.equal(baseline.matchesE234, true);
  assert.equal(baseline.tracks.length, 11);
  assert.deepEqual(anchor.final.tracks.filter((t: Wire) => t.hidden).map((t: Wire) => t.name), ['gn-E16']);
  const cleanupReport = await gz(`${dir}/cleanup.json.gz`);
  assert.deepEqual((cleanupReport.tracks as Wire[]).map(t => t.channelId), (cleanupReport.entryTracks as Wire[]).map(t => t.channelId));
  return summary;
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  try {
    if (command === 'setup') await setup(args[0]!);
    else if (command === 'probes') await probes(args[0]!, args[1]!);
    else if (command === 'params') await params(args[0]!, args[1]!);
    else if (command === 'setup-nested') await setupNested(args[0]!);
    else if (command === 'tools') await tools(args[0]!, args[1]!);
    else if (command === 'matrix') await matrix(args[0]!, args[1]!, args[2]!);
    else if (command === 'own-path') await ownPath(args[0]!, args[1]!);
    else if (command === 'refusal') await refusal(args[0]!, args[1]!);
    else if (command === 'nested') await nested(args[0]!, args[1]!);
    else if (command === 'devices') await devices(args[0]!, args[1]!);
    else if (command === 'anchor') await anchor(args[0]!);
    else if (command === 'cleanup') await cleanup(args[0]!, args[1]!);
    else if (command === 'verify-offline') console.log(JSON.stringify(await verifyOffline(args[0]!), null, 1));
    else throw new Error(`unknown command ${command}`);
  } finally { await transport.close(); }
}
if (import.meta.url === pathToFileURL(process.argv[1]!).href) await main();
