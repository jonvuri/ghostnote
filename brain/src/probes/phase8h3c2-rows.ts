/**
 * 8h3c2 reader row binding. Live driver. Use an owned unsaved project; refuse the saved anchor (D29).
 *
 *   setup <state.json> <set> <n>            64 scenes, an empty park track, an other track, and n row tracks
 *                                           with a distinct clip in rows 0, 1, and 63
 *   matrix <out> <state.json> <set> [route] [park]
 *                                           every read order of rows 0, 1, 63 from three entry selections,
 *                                           one track per sequence, then a second pass on the same tracks.
 *                                           The research build of E232 had more routes and a park track
 *                                           (research-routes.patch.gz); the product build has only legacy-open.
 *   alternate <out> <state.json> <set> <n>  n alternating reads of rows 0 and 1 on two tracks
 *   guard <out> <state.json> <set>          probe profile, three fresh tracks: legacy-open pins rows; the
 *                                           guard refuses each mismatch; product reads then bind the requested
 *                                           rows; the adapter repairs each earlier pin with one retry
 *   typical <state.json> <n>                n single-clip tracks at E231 typical density (256 notes, 64 beats)
 *   large <state.json>                      one track whose row-0 clip has 1,048,576 sounding cells
 *   cost <out> <state.json> <route> <n> [set]
 *                                           n rounds of reads across a set (typical, or large+typical);
 *                                           time and stray replay
 *   cleanup <out> <state.json>              delete owned tracks and check the entry track IDs
 *   verify <artifact>                       recompute every verdict of a retained matrix or alternate artifact
 *   verify-offline <dir>                    check every E232 claim from the retained artifacts
 */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { LiveAdapter } from '../adapters/live/adapter.js';
import { decodeNoteFrame, type NoteFrame, type RawNoteFields } from '../adapters/live/clip-read.js';
import { addressKey, clip, notes, scene, slot, track } from '../contract/index.js';
import type { E131Context } from './e131-diagnostic.js';
import { WireTransport, type Call } from './phase8h3c-promotion.js';
import { ROWS, ENTRIES, declared, orders, verdict, type Wire } from './phase8h3c2-rows-lib.js';
import { verifyPaired, verifyQueue, verifySelection, verifySmoke } from './phase8h3c-promotion.js';

const PAGE = 131_072;
const transport = new WireTransport();
const adapter = new LiveAdapter({ transport });
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
async function until(next: () => Promise<Wire>, done: (value: Wire) => boolean, limit = 30_000, interval = 50): Promise<Wire> {
  const started = performance.now();
  for (;;) {
    const value = await next(); if (done(value)) return value;
    assert(performance.now() - started < limit, `live state did not settle: ${JSON.stringify(value).slice(0, 400)}`);
    await pause(interval);
  }
}

const PROFILES: Record<string, [number, string]> = {
  'normal-v1': [87, 'ca139a3e62a55e68'], 'phase-8-probe-v1': [100, '4232fd6c9f325749'],
};
/** A known profile, the reader markers, and an owned unsaved project. */
async function guard(): Promise<Wire> {
  const hello = await request('contract.hello');
  const known = PROFILES[String(hello.runtimeProfile)];
  assert(known, `unknown profile ${hello.runtimeProfile}`);
  assert.equal(hello.methodCount, known[0]); assert.equal(hello.methodsHash, known[1]);
  const mark = await request('revision.get');
  assert(/^New \d+$/.test(mark.project), `use an owned unsaved project, got ${mark.project}`);
  const rig = await request('rig.info');
  assert.equal(rig.clipReader?.revision, 'clip-reader-v1');
  assert.equal(rig.clipReader?.closeRule, 'confirm-before-release-v1');
  await adapter.hello();
  return { hello, mark, rig };
}
async function indexOf(id: string, owned?: Call[]): Promise<number> {
  const found = ((await request('track.list', undefined, owned)).tracks as Wire[]).find(row => row.channelId === id);
  assert(found, `owned track ${id} is absent`); return Number(found.index);
}
async function createTrack(name: string): Promise<string> {
  const before = new Set(((await request('track.list')).tracks as Wire[]).map(row => row.channelId));
  await request('track.create', { position: 0 });
  const after = await until(() => request('track.list'),
    value => (value.tracks as Wire[]).some(row => row.index === 0 && !before.has(row.channelId)));
  const id = String((after.tracks as Wire[]).find(row => row.index === 0)!.channelId);
  await request('track.setName', { trackIndex: 0, name }); return id;
}
/** Write one declared clip with the E131 fine cursor. That route points first, then selects the slot. */
async function write(id: string, row: number): Promise<void> {
  const d = declared(row), index = await indexOf(id);
  const status = await request('slot.status', { trackIndex: index, slotIndex: row });
  if (status.hasContent !== true) {
    await request('clip.create', { trackIndex: index, slotIndex: row, lengthBeats: d.beats });
    await until(() => request('slot.status', { trackIndex: index, slotIndex: row }), value => value.hasContent === true);
  }
  const mark = await request('revision.get');
  await (adapter as unknown as E131Context).pointAtClip(clip(slot(track(id), scene(row, mark.sceneEpoch))), index,
    new Map(), 'fine');
  await request('cursor.setStepSize', { cursor: 'fine', stepSize: 1 / 4 });
  await request('cursor.setNotes', { cursor: 'fine', channel: d.channel, notes: [[d.step, d.pitch, 100, 0.25]] });
  await pause(250);
}

async function setup(statePath: string, set: string, n: number): Promise<void> {
  const entry = await guard();
  let state: Wire;
  try { state = await load(statePath); } catch {
    state = { schema: 'phase8h3c2-state-v1', entry, entryTracks: (await request('track.list')).tracks,
      entrySelection: await request('selection.status'), tracks: {}, sets: {} };
  }
  const missing = 64 - Number((await request('scene.count')).sceneCount);
  if (missing > 0) { await request('scene.create', { count: missing }); await pause(500); }
  if (!state.tracks.park) { state.tracks.park = await createTrack('gn-8h3c2-park'); await save(statePath, state); }
  if (!state.tracks.other) {
    state.tracks.other = await createTrack('gn-8h3c2-other'); await write(state.tracks.other, 0); await save(statePath, state);
  }
  const list: string[] = state.sets[set] ?? [];
  while (list.length < n) {
    const id = await createTrack(`gn-8h3c2-${set}-${list.length}`);
    for (const row of ROWS) await write(id, row);
    list.push(id); state.sets[set] = list; await save(statePath, state);
    console.log(JSON.stringify({ set, track: list.length - 1, id }));
  }
  // Check every declared clip once with the fine cursor route, not with the reader under test.
  console.log(JSON.stringify({ set, tracks: list.length, park: state.tracks.park, other: state.tracks.other }));
}

/** E231 typical density: 256 notes, one every 1/4 beat, each 1/8 beat long, channel by index, in 64 beats. */
async function typical(statePath: string, n: number): Promise<void> {
  await guard(); const state = await load(statePath);
  const list: string[] = state.sets.typical ?? [];
  while (list.length < n) {
    const id = await createTrack(`gn-8h3c2-typical-${list.length}`), index = await indexOf(id);
    await request('clip.create', { trackIndex: index, slotIndex: 0, lengthBeats: 64 });
    await until(() => request('slot.status', { trackIndex: index, slotIndex: 0 }), value => value.hasContent === true);
    const mark = await request('revision.get');
    await (adapter as unknown as E131Context).pointAtClip(clip(slot(track(id), scene(0, mark.sceneEpoch))), index, new Map(), 'fine');
    await request('cursor.setStepSize', { cursor: 'fine', stepSize: 1 / 4 });
    for (let channel = 0; channel < 16; channel++) {
      const notes = Array.from({ length: 16 }, (_, k) => k * 16 + channel).map(i => [i, 36 + (i % 48), 100, 0.125]);
      await request('cursor.setNotes', { cursor: 'fine', channel, notes });
    }
    await pause(500);
    const r = await read(id, 0);
    assert.equal(r.reply.refused, undefined); assert.equal(r.rows.length, 256, `typical clip has ${r.rows.length} notes`);
    list.push(id); state.sets.typical = list; await save(statePath, state);
  }
  console.log(JSON.stringify({ typical: list.length }));
}
/** 16 notes, one per channel, each 128 beats long: 1,048,576 sounding cells, the E227 upper size. */
async function large(statePath: string): Promise<void> {
  await guard(); const state = await load(statePath);
  if (!state.tracks.large) {
    const id = await createTrack('gn-8h3c2-large'), index = await indexOf(id);
    await request('clip.create', { trackIndex: index, slotIndex: 0, lengthBeats: 128 });
    await until(() => request('slot.status', { trackIndex: index, slotIndex: 0 }), value => value.hasContent === true);
    const mark = await request('revision.get');
    await (adapter as unknown as E131Context).pointAtClip(clip(slot(track(id), scene(0, mark.sceneEpoch))), index, new Map(), 'fine');
    await request('cursor.setStepSize', { cursor: 'fine', stepSize: 1 / 4 });
    for (let channel = 0; channel < 16; channel++) {
      await request('cursor.setNotes', { cursor: 'fine', channel, notes: [[0, 48 + channel, 100, 128]] });
    }
    await pause(1_000);
    const r = await read(id, 0);
    assert.equal(r.reply.refused, undefined); assert.equal(r.rows.length, 16);
    state.tracks.large = id; await save(statePath, state);
  }
  console.log(JSON.stringify({ large: state.tracks.large }));
}
async function cost(out: string, statePath: string, route: string, n: number, set = 'typical'): Promise<void> {
  const entry = await guard(), state = await load(statePath);
  const tracks: string[] = set === 'large' ? [state.tracks.large, state.sets.typical[0]] : state.sets.typical;
  const report: Wire = { schema: 'phase8h3c2-cost-v1', entry, route, tracks, reads: [] };
  try {
    for (let i = 0; i < n; i++) for (const id of tracks) {
      const r = await read(id, 0, await options(state, route));
      assert.equal(r.reply.refused, undefined, String(r.reply.refused));
      assert.equal(r.rows.length, id === state.tracks.large ? 16 : 256);
      const { rows: _rows, ...kept } = r;
      report.reads.push({ i, ...kept, notes: r.rows.length });
    }
  } finally { await artifact(out, report); }
  const med = (xs: number[]): number => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
  const reads = report.reads as Wire[];
  const after = (key: string): Wire[] => reads.filter((r, i) => i > 0 && reads[i - 1]!.trackId === key);
  if (set === 'large') {
    const typicalAfterLarge = after(state.tracks.large);
    console.log(JSON.stringify({ route, typicalAfterLarge: { wallMs: med(typicalAfterLarge.map(r => r.wallMs)),
      parkMs: med(typicalAfterLarge.map(r => r.reply.parkMs)), openStray: med(typicalAfterLarge.map(r => r.reply.openStray ?? 0)) } }));
  }
  console.log(JSON.stringify({ route, reads: reads.length, wallMs: med(reads.map(r => r.wallMs)),
    parkMs: med(reads.map(r => r.reply.parkMs)), totalMs: med(reads.map(r => r.reply.totalMs)),
    openStray: med(reads.map(r => r.reply.openStray ?? 0)) }));
}

/** Put the entry selection in place: another track at row 0, the target row, or another row of the target. */
async function enter(state: Wire, id: string, row: number, entry: string): Promise<Wire> {
  const target = await indexOf(id);
  const [trackIndex, slotIndex] = entry === 'other' ? [await indexOf(state.tracks.other), 0]
    : entry === 'target' ? [target, row] : [target, ROWS[(ROWS.indexOf(row as 0) + 1) % ROWS.length]!];
  await request('slot.select', { trackIndex, slotIndex, mechanism: 'track' });
  return await until(() => request('selection.status'),
    value => value.trackIndex === trackIndex && value.slotIndex === slotIndex, 5_000);
}
async function read(id: string, row: number, options: Wire = {}): Promise<Wire> {
  const calls: Call[] = [], started = performance.now();
  const before = await request('selection.status');
  const result = await request('clip.read', { trackIndex: await indexOf(id, calls), row, channelId: id, ...options }, calls);
  const rows: RawNoteFields[] = [];
  if (!result.refused) {
    let frame = result.frame as NoteFrame;
    for (;;) {
      rows.push(...decodeNoteFrame(frame, PAGE));
      if (frame.next < 0) break;
      frame = await request('clip.readPage', { readId: result.readId, from: frame.next }, calls) as NoteFrame;
    }
  }
  const wallMs = performance.now() - started;
  const after = await request('selection.status');
  const { frame: _frame, ...reply } = result;
  return { trackId: id, row, reply, rows, before, after, wallMs };
}
async function options(state: Wire, route = '', park = ''): Promise<Wire> {
  return { ...(route && route !== 'product' ? { diagnosticRoute: route } : {}),
    ...(park === 'park' ? { diagnosticParkTrack: await indexOf(state.tracks.park) } : {}) };
}

async function matrix(out: string, statePath: string, set: string, route = '', park = ''): Promise<void> {
  const entry = await guard(), state = await load(statePath), tracks: string[] = state.sets[set];
  const sequences = orders().flatMap(order => ENTRIES.map(entrySelection => ({ order, entrySelection })));
  assert(tracks.length >= sequences.length, `set ${set} needs ${sequences.length} tracks`);
  const report: Wire = { schema: 'phase8h3c2-matrix-v1', entry, set, route: route || 'product', park: park || 'master',
    tracks, reads: [] };
  try {
    for (const pass of [1, 2]) for (const [i, s] of sequences.entries()) {
      for (const row of s.order) {
        const entrySelection = await enter(state, tracks[i]!, row, s.entrySelection);
        const r = await read(tracks[i]!, row, await options(state, route, park));
        const v = verdict(r);
        report.reads.push({ pass, sequence: i, order: s.order, entry: s.entrySelection, entrySelection, ...r, verdict: v });
        console.log(JSON.stringify({ pass, i, order: s.order.join('-'), entry: s.entrySelection, row,
          bound: r.reply.bound?.row, content: v.contentRow, pass_: v.pass, refused: r.reply.refused }));
      }
      await artifact(out, report);
    }
  } finally { await artifact(out, report); }
  const failed = report.reads.filter((r: Wire) => !r.verdict.pass).length;
  console.log(JSON.stringify({ reads: report.reads.length, failed }));
}

async function alternate(out: string, statePath: string, set: string, n: number): Promise<void> {
  const entry = await guard(), state = await load(statePath), tracks: string[] = state.sets[set].slice(0, 2);
  const report: Wire = { schema: 'phase8h3c2-alternate-v1', entry, set, tracks, reads: [] };
  try {
    for (let i = 0; i < n; i++) for (const id of tracks) {
      const row = i % 2 === 0 ? 1 : 0, r = await read(id, row);
      report.reads.push({ i, ...r, verdict: verdict(r) });
    }
  } finally { await artifact(out, report); }
  const failed = report.reads.filter((r: Wire) => !r.verdict.pass).length;
  console.log(JSON.stringify({ reads: report.reads.length, failed }));
}

/**
 * Forced mismatch and repair. {@code legacy-open} is the 8h3c open order: its unpin does not reach the host.
 * Each legacy read pins its track. A legacy read of another row binds the pinned row; the guard must refuse it.
 * A product read then binds the requested row. Last, legacy reads pin three tracks at row 0, and the adapter
 * reads another row of each. A clip.read can refuse once for the earlier pin; the one retry must pass.
 */
async function guardCase(out: string, statePath: string, set: string): Promise<void> {
  const entry = await guard(), state = await load(statePath), [a, b, c] = state.sets[set] as string[];
  assert.equal(entry.hello.runtimeProfile, 'phase-8-probe-v1');
  const legacy = { diagnosticRoute: 'legacy-open' };
  const report: Wire = { schema: 'phase8h3c2-guard-v1', entry, set, reads: [] };
  const step = async (label: string, id: string, row: number, options: Wire = {}): Promise<Wire> => {
    const r = await read(id, row, options), v = verdict(r);
    report.reads.push({ label, ...r, verdict: v });
    console.log(JSON.stringify({ label, row, refused: r.reply.refused ?? null, bound: r.reply.bound?.row, pass: v.pass }));
    return r;
  };
  try {
    await step('legacy-pin', a!, 0, legacy);
    for (const row of [1, 63]) {
      const r = await step('forced', a!, row, legacy);
      assert.equal(r.reply.refused, 'bound-target-mismatch'); assert.equal(r.reply.bound?.row, 0);
    }
    for (const row of [1, 63, 0]) assert.equal((await step('product', a!, row)).reply.refused, undefined);
    for (const id of [a!, b!, c!]) await step('legacy-pin', id, 0, legacy);
    await enter(state, a!, 0, 'other');
    report.adapter = [];
    for (const [id, row] of [[a!, 1], [b!, 63], [c!, 1]] as const) {
      const mark = await request('revision.get');
      const address = notes(clip(slot(track(id), scene(row, mark.sceneEpoch))), declared(row).channel);
      const before = transport.calls.length;
      const snapshot = await adapter.read([address]);
      const reads = transport.calls.slice(before).filter(call => call.method === 'clip.read')
        .map(call => { const { frame: _frame, ...reply } = call.reply.result as Wire; return reply; });
      const value = snapshot.entries[addressKey(address)]?.value as Wire | undefined;
      report.adapter.push({ trackId: id, row, reads, value });
      console.log(JSON.stringify({ adapter: row, reads: reads.map(reply => reply.refused ?? `row ${reply.bound?.row}`),
        notes: value?.notes?.length }));
      assert.equal(reads.at(-1)!.refused, undefined); assert.equal(reads.at(-1)!.bound?.row, row);
      // A and B keep their legacy pins; the open task of the A read removes the pin of C.
      assert.equal(reads.length, id === c ? 1 : 2);
      if (reads.length === 2) assert.equal(reads[0]!.refused, 'bound-target-mismatch');
      assert.equal(value?.notes?.length, 1); assert.equal(value?.notes?.[0]?.pitch, declared(row).pitch);
    }
  } finally { await artifact(out, report); }
}

async function cleanup(out: string, statePath: string): Promise<void> {
  const entry = await guard(), state = await load(statePath);
  const owned = [state.tracks.park, state.tracks.other, state.tracks.large, ...Object.values(state.sets as Record<string, string[]>).flat()]
    .filter(Boolean) as string[];
  const deleted: string[] = [];
  for (const id of owned) {
    const found = ((await request('track.list')).tracks as Wire[]).find(row => row.channelId === id);
    if (!found) continue;
    await request('track.delete', { trackIndex: found.index });
    await until(() => request('track.list'), value => !(value.tracks as Wire[]).some(row => row.channelId === id));
    deleted.push(id);
  }
  const tracks = (await request('track.list')).tracks as Wire[];
  const ids = tracks.map(row => row.channelId), entryIds = (state.entryTracks as Wire[]).map(row => row.channelId);
  assert.deepEqual(ids, entryIds, 'the owned project does not match its entry tracks');
  const stats = await request('rig.stats');
  assert.equal(stats.clipReader?.open, false); assert.equal(stats.clipReader?.writeGate?.readOpen, false);
  assert.equal(stats.clipReader?.writeGate?.waiting, 0); assert.equal(stats.clipReader?.writeGate?.leases, 0);
  await artifact(out, { schema: 'phase8h3c2-cleanup-v1', entry, deleted, tracks, entryTracks: state.entryTracks, stats });
  console.log(JSON.stringify({ deleted: deleted.length, tracks: ids.length }));
}

/** Recompute every verdict from the retained reply and decoded rows. */
export async function verify(path: string): Promise<Wire> {
  const report = JSON.parse(gunzipSync(await readFile(path)).toString('utf8'));
  const reads: Wire[] = report.reads;
  for (const r of reads) assert.deepEqual(verdict(r), r.verdict, `verdict changed: ${r.trackId}:${r.row}`);
  return { schema: report.schema, reads: reads.length, passed: reads.filter(r => r.verdict.pass).length };
}

const gz = async (path: string): Promise<Wire> => JSON.parse(gunzipSync(await readFile(path)).toString('utf8'));
const median = (xs: number[]): number => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;

/** Every read of a track binds one row: the cursor keeps the row of its pinned clip. Refusals are mismatches. */
function stuck(reads: Wire[]): void {
  const rows = new Map<string, number>();
  for (const r of reads) {
    const bound = r.reply.bound?.row;
    if (!rows.has(r.trackId)) rows.set(r.trackId, bound);
    assert.equal(bound, rows.get(r.trackId), `track ${r.trackId} bound another row`);
    if (bound !== r.row) assert.equal(r.reply.refused, 'bound-target-mismatch');
  }
}
const allPass = (reads: Wire[]): void => assert(reads.every(r => r.verdict.pass), 'a read failed');

/** Check every E232 claim from the retained artifacts. */
export async function verifyOffline(dir: string): Promise<Wire> {
  const load = async (name: string): Promise<Wire> => {
    const report = await gz(`${dir}/${name}.json.gz`);
    for (const r of report.reads ?? []) assert.deepEqual(verdict(r), r.verdict, `${name}: verdict changed`);
    return report;
  };
  const summary: Wire = {};
  // Reproduction: the product route binds the first row that it read on each track, also after a reload.
  const repro = await load('repro-product');
  assert.equal(repro.reads.length, 108);
  for (const r of repro.reads as Wire[]) {
    if (r.pass === 1) assert.equal(r.reply.bound.row, r.order[0], 'pass 1 binds the first-visit row');
  }
  stuck(repro.reads);
  const selectionMisses = (repro.reads as Wire[]).filter(r => r.verdict.issues.some((i: string) => i.startsWith('selection')));
  assert.equal(selectionMisses.length, 1); assert.equal(selectionMisses[0]!.sequence, 0);
  summary.repro = { reads: 108, passed: repro.reads.filter((r: Wire) => r.verdict.pass).length };
  // Candidates that do not remove the host pin keep the stuck rows.
  for (const name of ['repro-product-reload', 'candidate-select-early', 'candidate-park-track', 'candidate-cursor-slot-same',
    'candidate-cursor-slot-next', 'candidate-subscribe-wait', 'candidate-prime', 'candidate-prime-subscribed',
    'candidate-park-unpin', 'candidate-park-subscribe-unpin-b']) {
    const report = await load(name);
    assert.equal(report.reads.length, 108); stuck(report.reads);
    assert.equal(report.reads.filter((r: Wire) => r.verdict.pass).length, 36, name);
  }
  // The host reports the pin only after a subscribe on the target: an unsubscribed unpin did not reach it.
  const unpin = await load('candidate-subscribe-unpin');
  const pinned = (unpin.reads as Wire[]).filter(r => (r.reply.trace as unknown[][]).some(([, kind, value]) =>
    kind === 'unpinned' && String(value).includes('clipPinned=true')));
  assert.equal(pinned.length, 107, 'the host pin was not visible after subscribe');
  for (const name of ['candidate-subscribe-unpin', 'candidate-subscribe-unpin-b', 'candidate-subscribe-unpin-same-b']) {
    const report = await load(name); assert.equal(report.reads.length, 108); allPass(report.reads);
  }
  // Old pins: the subscribe-first open removes only the prior target pin. Each first read of a track refuses once.
  const legacy = await load('candidate-subscribe-unpin-legacy');
  const failed = (legacy.reads as Wire[]).filter(r => !r.verdict.pass);
  assert.equal(failed.length, 17);
  for (const r of failed) {
    assert.equal(r.pass, 1); assert.equal(r.row, r.order[0]); assert.equal(r.reply.refused, 'bound-target-mismatch');
  }
  // An unpin on the target while subscribed binds the requested row, but adds a second replay.
  for (const [name, refusal] of [['candidate-release-unpin', 'step-delta'], ['candidate-bind-unpin', 'duplicate-cell']]) {
    const report = await load(name!);
    for (const r of report.reads as Wire[]) {
      assert.equal(r.reply.bound.row, r.row, `${name} bound the requested row`);
      if (r.reply.refused) assert.equal(r.reply.refused, refusal);
    }
  }
  // Without a clip pin, the close-task restore of another row of the target track moves the reader.
  const noPin = await load('candidate-no-clip-pin');
  for (const r of noPin.reads as Wire[]) if (!r.verdict.pass) assert.equal(r.entry, 'sibling');
  // Acceptance on the product build.
  const accept = await load('accept-matrix');
  assert.equal(accept.reads.length, 108); allPass(accept.reads);
  assert.equal(new Set(accept.reads.map((r: Wire) => `${r.order.join('-')}:${r.entry}`)).size, 18);
  const history = await load('accept-matrix-history');
  const historyFailed = (history.reads as Wire[]).filter(r => !r.verdict.pass);
  assert.equal(historyFailed.length, 1);
  assert.equal(historyFailed[0]!.pass, 1); assert.equal(historyFailed[0]!.row, historyFailed[0]!.order[0]);
  assert.equal(historyFailed[0]!.reply.refused, 'bound-target-mismatch');
  const alternate = await load('accept-alternate');
  assert.equal(alternate.reads.length, 40); allPass(alternate.reads);
  assert.equal(new Set(alternate.reads.map((r: Wire) => r.trackId)).size, 2);
  const guardReport = await load('accept-guard');
  const labels = (guardReport.reads as Wire[]).map(r => `${r.label}:${r.row}:${r.reply.refused ?? 'ok'}`);
  assert.deepEqual(labels, ['legacy-pin:0:ok', 'forced:1:bound-target-mismatch', 'forced:63:bound-target-mismatch',
    'product:1:ok', 'product:63:ok', 'product:0:ok', 'legacy-pin:0:ok', 'legacy-pin:0:ok', 'legacy-pin:0:ok']);
  assert.deepEqual((guardReport.adapter as Wire[]).map(a => a.reads.map((r: Wire) => r.refused ?? r.bound.row)),
    [['bound-target-mismatch', 1], ['bound-target-mismatch', 63], [1]]);
  for (const a of guardReport.adapter as Wire[]) assert.equal(a.value.notes[0].pitch, declared(a.row).pitch);
  // Cost of the prior-clip replay.
  const cost: Wire = {};
  for (const name of ['cost-typical-product', 'cost-typical-subscribe-unpin-same', 'cost-large-product',
    'cost-large-subscribe-unpin-same']) {
    const reads = (await gz(`${dir}/${name}.json.gz`)).reads as Wire[];
    assert(reads.every(r => r.reply.refused === undefined));
    const afterLarge = reads.filter((r, i) => i > 0 && reads[i - 1]!.notes === 16 && r.notes === 256);
    cost[name] = { reads: reads.length, wallMs: median(reads.map(r => r.wallMs)),
      openStray: median(reads.map(r => r.reply.openStray ?? 0)),
      ...(afterLarge.length ? { afterLargeParkMs: median(afterLarge.map(r => r.reply.parkMs)),
        afterLargeStray: median(afterLarge.map(r => r.reply.openStray)) } : {}) };
  }
  assert.equal(cost['cost-typical-product'].openStray, 0); assert.equal(cost['cost-typical-subscribe-unpin-same'].openStray, 65_536);
  assert.equal(cost['cost-large-subscribe-unpin-same'].afterLargeStray, 2_097_152);
  summary.cost = cost;
  // E230 cases at rows 0 and 1, and cleanup.
  await verifySmoke(`${dir}/e230-smoke.json.gz`);
  for (const row of [0, 1]) {
    await verifyPaired(`${dir}/e230-paired-row${row}.json.gz`);
    await verifySelection(`${dir}/e230-selection-row${row}.json.gz`);
    await verifyQueue(`${dir}/e230-queue-row${row}.json.gz`);
    for (const c of ['paired', 'selection', 'queue']) assert.equal((await gz(`${dir}/e230-${c}-row${row}.json.gz`)).row ?? 0, row);
  }
  const cleanupReport = await gz(`${dir}/cleanup.json.gz`);
  assert.deepEqual(cleanupReport.tracks.map((r: Wire) => r.channelId), cleanupReport.entryTracks.map((r: Wire) => r.channelId));
  assert.equal(cleanupReport.deleted.length, 49);
  const hello = await readFile(`${dir}/normal-hello-final.log`, 'utf8');
  assert.match(hello, /ALL PASS/); assert.match(hello, /"openRule":"subscribe-before-unpin-v1"/);
  assert.match(hello, /"runtimeProfile":"normal-v1".*"methodCount":87,"methodsHash":"ca139a3e62a55e68"/);
  return summary;
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  try {
    if (command === 'setup') await setup(args[0]!, args[1]!, Number(args[2]));
    else if (command === 'matrix') await matrix(args[0]!, args[1]!, args[2]!, args[3], args[4]);
    else if (command === 'alternate') await alternate(args[0]!, args[1]!, args[2]!, Number(args[3]));
    else if (command === 'guard') await guardCase(args[0]!, args[1]!, args[2]!);
    else if (command === 'typical') await typical(args[0]!, Number(args[1]));
    else if (command === 'large') await large(args[0]!);
    else if (command === 'cost') await cost(args[0]!, args[1]!, args[2]!, Number(args[3]), args[4]);
    else if (command === 'cleanup') await cleanup(args[0]!, args[1]!);
    else if (command === 'verify') console.log(JSON.stringify(await verify(args[0]!)));
    else if (command === 'verify-offline') console.log(JSON.stringify(await verifyOffline(args[0]!)));
    else throw new Error(`unknown command ${command}`);
  } finally { await transport.close(); }
}
if (import.meta.url === pathToFileURL(process.argv[1]!).href) await main();
