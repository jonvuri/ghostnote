/**
 * 8h4a3 expand-parent acceptance. Live driver for the product reader, which expands each collapsed parent group
 * (E240). Use an owned unsaved project; refuse the saved anchor (D29).
 *
 *   setup <state.json>                      64 scenes, an other track with a row-0 clip, and children a, b, and n
 *                                           with distinct clips in rows 0, 1, and 63 (row 2 empty)
 *   matrix <out> <state.json> <view>        children a and b (group G1): every read order of rows 0, 1, 63 from
 *                                           three entry selections. view: expanded or collapsed (operator state)
 *   nested <out> <state.json> <outer> <inner>
 *                                           child n (group G2 inside group G3): each row from each entry, twice.
 *                                           outer and inner: expanded or collapsed (operator state)
 *   refusals <out> <state.json>             probe, G1 collapsed: short deadlines and capture faults on child a;
 *                                           each next read must find G1 collapsed again
 *   no-expand <out> <state.json>            probe, G1 collapsed: the 8h4a2 route still refuses rows 1 and 63
 *   hidden-mixer <out> <state.json> [route] G1 collapsed: the entry mixer track is child b; read child a
 *   master-entry <out> <state.json> [route] G1 collapsed: the entry mixer track is the master track (a read
 *                                           refused before its bind leaves it there); read child a
 *   top-level <out> <state.json> <n>        n product reads of the other track (in no group): the cost of the finder
 *   adapter <out> <state.json>              the brain reader path (adapter.read of the notes address) on every row of
 *                                           children a and n: each reads with one clip.read
 *   anchor <out>                            read-only, in gn-scale-test: each occupied row (0-15) of gn-E16 (inside the
 *                                           collapsed Group 5) and gn-A (top level), twice
 *   anchor-matrix <out> <reference>         read-only, in gn-scale-test with Group 5 collapsed: every order of rows 0, 1,
 *                                           2 of gn-E16 from four entries (gn-A row 4, the target slot, another row
 *                                           of the target, and the master mixer track); notes against <reference>
 *   anchor-hidden <out> <reference>         read-only, after the operator selected a gn-E16 slot and collapsed Group 5:
 *                                           rows 0, 1, 2 of gn-E16 twice, from that entry, with no entry setup
 *   cleanup <out> <state.json>              delete every track that the entry list does not hold
 *   verify-offline <dir>                    check every E241 claim from the retained artifacts
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
import { ENTRIES, ROWS, declared, orders, verdict, type Wire } from './phase8h3c2-rows-lib.js';

export const GROUP_RULE = 'expand-collapsed-parent-v1';
const PROFILES: Record<string, [number, string]> = {
  'normal-v1': [87, 'ca139a3e62a55e68'], 'phase-8-probe-v1': [98, '659635435255b259'],
};
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
const gz = async (path: string): Promise<Wire> => JSON.parse(gunzipSync(await readFile(path)).toString('utf8'));
async function until(next: () => Promise<Wire>, done: (value: Wire) => boolean, limit = 30_000): Promise<Wire> {
  const started = performance.now();
  for (;;) {
    const value = await next(); if (done(value)) return value;
    assert(performance.now() - started < limit, `live state did not settle: ${JSON.stringify(value).slice(0, 400)}`);
    await pause(50);
  }
}

/** A known profile, the reader markers, and an owned unsaved project. */
async function guard(profile?: string): Promise<Wire> {
  const hello = await request('contract.hello');
  const known = PROFILES[String(hello.runtimeProfile)];
  assert(known, `unknown profile ${hello.runtimeProfile}`);
  assert.deepEqual([hello.methodCount, hello.methodsHash], known);
  if (profile) assert.equal(hello.runtimeProfile, profile);
  const mark = await request('revision.get');
  assert(/^New \d+$/.test(mark.project), `use an owned unsaved project, got ${mark.project}`);
  const rig = await request('rig.info');
  assert.equal(rig.clipReader?.revision, 'clip-reader-v2');
  assert.equal(rig.clipReader?.groupRule, GROUP_RULE);
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
/** Write one declared clip with the E131 fine cursor (E232 fixtures), before any group exists. */
async function write(id: string, row: number): Promise<void> {
  const d = declared(row), index = await indexOf(id);
  await request('clip.create', { trackIndex: index, slotIndex: row, lengthBeats: d.beats });
  await until(() => request('slot.status', { trackIndex: index, slotIndex: row }), value => value.hasContent === true);
  const mark = await request('revision.get');
  await (adapter as unknown as E131Context).pointAtClip(clip(slot(track(id), scene(row, mark.sceneEpoch))), index,
    new Map(), 'fine');
  await request('cursor.setStepSize', { cursor: 'fine', stepSize: 1 / 4 });
  await request('cursor.setNotes', { cursor: 'fine', channel: d.channel, notes: [[d.step, d.pitch, 100, 0.25]] });
  await pause(250);
}

async function setup(statePath: string): Promise<void> {
  const entry = await guard('phase-8-probe-v1');
  const state: Wire = { schema: 'phase8h4a3-state-v1', entry, entryTracks: (await request('track.list')).tracks,
    tracks: {} };
  const missing = 64 - Number((await request('scene.count')).sceneCount);
  if (missing > 0) { await request('scene.create', { count: missing }); await pause(500); }
  state.tracks.other = await createTrack('gn-8h4a3-other'); await write(state.tracks.other, 0);
  for (const key of ['n', 'b', 'a']) {
    const id = await createTrack(`gn-8h4a3-${key}`);
    for (const row of ROWS) await write(id, row);
    const empty = await request('slot.status', { trackIndex: await indexOf(id), slotIndex: 2 });
    assert.equal(empty.hasContent, false, 'row 2 must stay empty');
    state.tracks[key] = id; await save(statePath, state);
  }
  console.log(JSON.stringify(state.tracks));
}

/** Put the entry selection in place. A slot on a child of a collapsed group may not take it; record that. */
async function enter(state: Wire, id: string, row: number, entry: string): Promise<Wire> {
  const target = await indexOf(id);
  const [trackIndex, slotIndex] = entry === 'other' ? [await indexOf(state.tracks.other), 0]
    : entry === 'target' ? [target, row] : [target, ROWS[(ROWS.indexOf(row as 0) + 1) % ROWS.length]!];
  await request('slot.select', { trackIndex, slotIndex, mechanism: 'track' });
  const started = performance.now();
  for (;;) {
    const status = await request('selection.status');
    const taken = status.trackIndex === trackIndex && status.slotIndex === slotIndex;
    if (taken || performance.now() - started > 2_000) return { requested: [trackIndex, slotIndex], taken, status };
    await pause(50);
  }
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
  return { trackId: id, row, options, reply, rows, before, after, wallMs };
}
/** The parent levels that the reply reports: [wasExpanded, expanded, collapsed] for each group level. */
export const levels = (reply: Wire): boolean[][] => ((reply.parents ?? []) as Wire[]).filter(p => p.isGroup)
  .map(p => [p.wasExpanded === true, p.expanded === true, p.collapsed === true]);
const log = (label: Wire, r: Wire, v: Wire): void => console.log(JSON.stringify({ ...label, row: r.row,
  bound: r.reply.bound?.row, pass: v.pass, refused: r.reply.refused, levels: levels(r.reply), issues: v.issues }));

async function matrix(out: string, statePath: string, view: string): Promise<void> {
  assert(view === 'expanded' || view === 'collapsed');
  const entry = await guard(), state = await load(statePath);
  const sequences = orders().flatMap(order => ENTRIES.map(entrySelection => ({ order, entrySelection })));
  const report: Wire = { schema: 'phase8h4a3-matrix-v1', entry, view, tracks: state.tracks, reads: [] };
  try {
    for (const key of ['a', 'b']) for (const [i, s] of sequences.entries()) for (const row of s.order) {
      const id = state.tracks[key];
      const entrySelection = await enter(state, id, row, s.entrySelection);
      const r = await read(id, row), v = verdict(r);
      report.reads.push({ child: key, sequence: i, order: s.order, entry: s.entrySelection, entrySelection, ...r, verdict: v });
      log({ key, i, entry: s.entrySelection, taken: entrySelection.taken }, r, v);
    }
  } finally { await artifact(out, report); }
  const reads = report.reads as Wire[];
  console.log(JSON.stringify({ view, reads: reads.length, passed: reads.filter(r => r.verdict.pass).length }));
}

async function nested(out: string, statePath: string, outer: string, inner: string): Promise<void> {
  const entry = await guard(), state = await load(statePath), id = state.tracks.n;
  const report: Wire = { schema: 'phase8h4a3-nested-v1', entry, outer, inner, trackId: id, reads: [] };
  try {
    for (const pass of [1, 2]) for (const e of ENTRIES) for (const row of ROWS) {
      const entrySelection = await enter(state, id, row, e);
      const r = await read(id, row), v = verdict(r);
      report.reads.push({ pass, entry: e, entrySelection, ...r, verdict: v });
      log({ outer, inner, pass, entry: e }, r, v);
    }
  } finally { await artifact(out, report); }
  const reads = report.reads as Wire[];
  console.log(JSON.stringify({ outer, inner, reads: reads.length, passed: reads.filter(r => r.verdict.pass).length }));
}

/** Refuse after the expansion; the next read must find the group collapsed and read its row. */
async function refusals(out: string, statePath: string): Promise<void> {
  const entry = await guard('phase-8-probe-v1'), state = await load(statePath), id = state.tracks.a;
  const cases: Wire[] = [
    ...[10, 30, 50, 70, 90, 110, 130, 150, 200].map(deadlineMs => ({ deadlineMs })),
    { diagnosticFault: 'duplicate-cell' }, { diagnosticFault: 'step-delta' },
  ];
  const report: Wire = { schema: 'phase8h4a3-refusals-v1', entry, trackId: id, reads: [] };
  try {
    for (const options of cases) for (const row of [1, 63]) {
      await enter(state, id, row, 'other');
      const refused = await read(id, row, options);
      const next = await read(id, row === 1 ? 63 : 1), v = verdict(next);
      report.reads.push({ options, refused, next: { ...next, verdict: v } });
      console.log(JSON.stringify({ options, row, refused: refused.reply.refused ?? null, levels: levels(refused.reply),
        nextLevels: levels(next.reply), nextPass: v.pass, issues: v.issues }));
    }
  } finally { await artifact(out, report); }
}

async function noExpand(out: string, statePath: string): Promise<void> {
  const entry = await guard('phase-8-probe-v1'), state = await load(statePath), id = state.tracks.a;
  const report: Wire = { schema: 'phase8h4a3-no-expand-v1', entry, trackId: id, reads: [] };
  try {
    for (const row of ROWS) {
      await enter(state, id, row, 'other');
      const r = await read(id, row, { diagnosticRoute: 'no-expand' }), v = verdict(r);
      report.reads.push({ ...r, verdict: v });
      log({ route: 'no-expand' }, r, v);
    }
  } finally { await artifact(out, report); }
}

/** The E240 failing entry: the mixer track is another child of the collapsed group. A person cannot make it. */
async function hiddenMixer(out: string, statePath: string, route = ''): Promise<void> {
  const entry = await guard(), state = await load(statePath), id = state.tracks.a, b = state.tracks.b;
  const options = route ? { diagnosticRoute: route } : {};
  const report: Wire = { schema: 'phase8h4a3-hidden-mixer-v1', entry, route, trackId: id, reads: [] };
  try {
    for (const pass of [1, 2]) for (const row of ROWS) {
      // E240: the 8h4a2 route leaves the mixer selection on child b (lease-lost); slot.select cannot.
      const setup = await read(b, 0, entry.hello.runtimeProfile === 'phase-8-probe-v1' ? { diagnosticRoute: 'no-expand' } : {});
      await request('slot.select', { trackIndex: await indexOf(state.tracks.other), slotIndex: 0, mechanism: 'track' });
      const status = await until(() => request('selection.status'), value => value.slotIndex === 0, 5_000);
      const taken = status.mixerTrackIndex === await indexOf(b);
      const r = await read(id, row, options), v = verdict(r);
      report.reads.push({ pass, taken, setupSelection: setup.reply.selection, ...r, verdict: v });
      log({ pass, taken }, r, v);
    }
  } finally { await artifact(out, report); }
}

async function masterEntry(out: string, statePath: string, route = ''): Promise<void> {
  const entry = await guard('phase-8-probe-v1'), state = await load(statePath), id = state.tracks.a;
  const options = route ? { diagnosticRoute: route } : {};
  const master = ((await request('track.list')).tracks as Wire[]).find(row => row.type === 'Master')!.index;
  const report: Wire = { schema: 'phase8h4a3-master-entry-v1', entry, route, trackId: id, master, reads: [] };
  try {
    for (const pass of [1, 2]) for (const row of ROWS) {
      const setup = await read(id, 1, { deadlineMs: 10 });
      await request('slot.select', { trackIndex: await indexOf(state.tracks.other), slotIndex: 0, mechanism: 'track' });
      const status = await until(() => request('selection.status'), value => value.slotIndex === 0, 5_000);
      const taken = status.mixerTrackIndex === master;
      const r = await read(id, row, options), v = verdict(r);
      report.reads.push({ pass, taken, setupRefused: setup.reply.refused ?? null, ...r, verdict: v });
      log({ pass, taken, reselect: r.reply.mixerReselect }, r, v);
    }
  } finally { await artifact(out, report); }
}

async function topLevel(out: string, statePath: string, n: number): Promise<void> {
  const entry = await guard(), state = await load(statePath), id = state.tracks.other;
  const report: Wire = { schema: 'phase8h4a3-top-level-v1', entry, trackId: id, reads: [] };
  try {
    for (let i = 0; i < n; i++) {
      const r = await read(id, 0), v = verdict(r);
      report.reads.push({ i, ...r, verdict: v });
    }
  } finally { await artifact(out, report); }
  const reads = report.reads as Wire[], t = reads.map(r => r.reply.totalMs).sort((a, b) => a - b);
  console.log(JSON.stringify({ reads: reads.length, passed: reads.filter(r => r.verdict.pass).length,
    medianTotalMs: t[t.length >> 1], parents: [...new Set(reads.map(r => JSON.stringify(r.reply.parents)))] }));
}

async function adapterPath(out: string, statePath: string): Promise<void> {
  const entry = await guard(), state = await load(statePath);
  const reads: Wire[] = [];
  try {
    for (const key of ['a', 'n']) for (const row of ROWS) {
      const id = state.tracks[key], before = transport.calls.length, mark = await request('revision.get');
      const address = notes(clip(slot(track(id), scene(row, mark.sceneEpoch))), declared(row).channel);
      let value: Wire | undefined, error: string | undefined;
      try { value = (await adapter.read([address])).entries[addressKey(address)]?.value as Wire; }
      catch (e) { error = String(e); }
      const clipReads = transport.calls.slice(before).filter(call => call.method === 'clip.read')
        .map(call => { const { frame: _frame, ...reply } = call.reply.result as Wire; return reply; });
      reads.push({ key, row, value, error, clipReads });
      console.log(JSON.stringify({ key, row, notes: value?.notes?.length ?? null, pitch: value?.notes?.[0]?.pitch, error,
        clipReads: clipReads.map(r => r.refused ?? `row ${r.bound?.row}`) }));
    }
  } finally { await artifact(out, { schema: 'phase8h4a3-adapter-v1', entry, reads }); }
}

async function anchor(out: string): Promise<void> {
  const hello = await request('contract.hello'), mark = await request('revision.get'), rig = await request('rig.info');
  assert.equal(mark.project, 'gn-scale-test'); assert.equal(rig.clipReader?.groupRule, GROUP_RULE);
  const tracks = (await request('track.list')).tracks as Wire[];
  const report: Wire = { schema: 'phase8h4a3-anchor-v1', hello, mark, rig, tracks, reads: [] };
  try {
    for (const name of ['gn-E16', 'gn-A']) {
      const row = tracks.find(t => t.name === name)!;
      const rows: number[] = [];
      for (let j = 0; j < 16; j++) {
        if ((await request('slot.status', { trackIndex: row.index, slotIndex: j })).hasContent) rows.push(j);
      }
      for (const pass of [1, 2]) for (const j of rows) {
        const r = await read(String(row.channelId), j);
        report.reads.push({ name, pass, ...r });
        console.log(JSON.stringify({ name, pass, row: j, refused: r.reply.refused ?? null, bound: r.reply.bound?.row,
          notes: r.rows.length, levels: levels(r.reply), restored: r.reply.selection?.restored,
          same: JSON.stringify([r.before.trackIndex, r.before.slotIndex, r.before.mixerTrackIndex])
            === JSON.stringify([r.after.trackIndex, r.after.slotIndex, r.after.mixerTrackIndex]) }));
      }
    }
  } finally { await artifact(out, report); }
}

/** A read of an anchor row passes when it binds the row, returns the reference notes, and restores the selection. */
export function anchorVerdict(r: Wire, want: string | undefined): Wire {
  const issues: string[] = [];
  if (r.reply.refused) issues.push(`refused ${r.reply.refused}`);
  if (r.reply.bound?.channelId !== r.trackId || r.reply.bound?.row !== r.row) issues.push('bound');
  if (!r.reply.refused && JSON.stringify(r.rows) !== want) issues.push('notes');
  const sel = (s: Wire): string => JSON.stringify([s.trackIndex, s.slotIndex, s.mixerTrackIndex]);
  if (sel(r.before) !== sel(r.after)) issues.push(`selection ${sel(r.before)} -> ${sel(r.after)}`);
  return { pass: issues.length === 0, issues };
}

async function anchorMatrix(out: string, referencePath: string): Promise<void> {
  const hello = await request('contract.hello'), mark = await request('revision.get'), rig = await request('rig.info');
  assert.equal(mark.project, 'gn-scale-test'); assert.equal(rig.clipReader?.groupRule, GROUP_RULE);
  assert.equal(hello.runtimeProfile, 'normal-v1');
  const ref = await gz(referencePath), want = new Map<number, string>();
  for (const r of ref.reads as Wire[]) if (r.name === 'gn-E16' && r.pass === 2) want.set(r.row, JSON.stringify(r.rows));
  const tracks = (await request('track.list')).tracks as Wire[];
  const e16 = tracks.find(t => t.name === 'gn-E16')!, a = tracks.find(t => t.name === 'gn-A')!;
  const master = tracks.find(t => t.type === 'Master')!.index;
  const rows = [0, 1, 2], id = String(e16.channelId);
  const report: Wire = { schema: 'phase8h4a3-anchor-matrix-v1', hello, mark, rig, tracks, reads: [] };
  const walk = (rest: number[], prefix: number[], acc: number[][]): number[][] => rest.length === 0 ? [...acc, prefix]
    : rest.reduce((all, row, i) => walk([...rest.slice(0, i), ...rest.slice(i + 1)], [...prefix, row], all), acc);
  try {
    for (const order of walk(rows, [], [])) for (const entry of ['other', 'target', 'sibling', 'master']) {
      for (const row of order) {
        if (entry === 'master') await read(id, row, { deadlineMs: 10 });
        const [ti, si] = entry === 'target' ? [e16.index, row] : entry === 'sibling' ? [e16.index, (row + 1) % 3] : [a.index, 4];
        await request('slot.select', { trackIndex: ti, slotIndex: si, mechanism: 'track' });
        await pause(150);
        const status = await request('selection.status');
        const r = await read(id, row), v = anchorVerdict(r, want.get(row));
        report.reads.push({ order, entry, entrySelection: status, taken: status.trackIndex === ti && status.slotIndex === si,
          master: entry === 'master' ? status.mixerTrackIndex === master : undefined, ...r, verdict: v });
        console.log(JSON.stringify({ order: order.join('-'), entry, row, pass: v.pass, issues: v.issues,
          levels: levels(r.reply) }));
      }
    }
  } finally { await artifact(out, report); }
  const list = report.reads as Wire[];
  console.log(JSON.stringify({ reads: list.length, passed: list.filter(r => r.verdict.pass).length }));
}

async function anchorHidden(out: string, referencePath: string): Promise<void> {
  const hello = await request('contract.hello'), mark = await request('revision.get');
  assert.equal(mark.project, 'gn-scale-test'); assert.equal(hello.runtimeProfile, 'normal-v1');
  const ref = await gz(referencePath), want = new Map<number, string>();
  for (const r of ref.reads as Wire[]) if (r.name === 'gn-E16' && r.pass === 2) want.set(r.row, JSON.stringify(r.rows));
  const tracks = (await request('track.list')).tracks as Wire[], e16 = tracks.find(t => t.name === 'gn-E16')!;
  const entry = await request('selection.status');
  assert.equal(entry.trackIndex, e16.index, 'select a gn-E16 slot, then collapse Group 5');
  const report: Wire = { schema: 'phase8h4a3-anchor-hidden-v1', hello, mark, tracks, entry, reads: [] };
  try {
    for (const row of [0, 1, 2, 0, 1, 2]) {
      const r = await read(String(e16.channelId), row), v = anchorVerdict(r, want.get(row));
      report.reads.push({ ...r, verdict: v });
      console.log(JSON.stringify({ row, pass: v.pass, issues: v.issues, levels: levels(r.reply),
        reselect: r.reply.mixerReselect }));
    }
  } finally { await artifact(out, report); }
}

async function cleanup(out: string, statePath: string): Promise<void> {
  const entry = await guard(), state = await load(statePath);
  const entryIds = (state.entryTracks as Wire[]).map(row => row.channelId);
  const deleted: string[] = [];
  for (;;) {
    const extra = ((await request('track.list')).tracks as Wire[]).find(row => !entryIds.includes(row.channelId));
    if (!extra) break;
    await request('track.delete', { trackIndex: extra.index });
    await until(() => request('track.list'), value => !(value.tracks as Wire[]).some(row => row.channelId === extra.channelId));
    deleted.push(String(extra.channelId));
  }
  const tracks = (await request('track.list')).tracks as Wire[];
  assert.deepEqual(tracks.map(row => row.channelId), entryIds, 'the owned project does not match its entry tracks');
  const stats = await request('rig.stats');
  assert.equal(stats.clipReader?.open, false); assert.equal(stats.clipReader?.writeGate?.readOpen, false);
  assert.equal(stats.clipReader?.writeGate?.waiting, 0); assert.equal(stats.clipReader?.writeGate?.leases, 0);
  await artifact(out, { schema: 'phase8h4a3-cleanup-v1', entry, deleted, tracks, entryTracks: state.entryTracks, stats });
  console.log(JSON.stringify({ deleted: deleted.length, tracks: tracks.length }));
}

const passed = (reads: Wire[]): number => reads.filter(r => r.verdict.pass).length;
async function reads(dir: string, name: string): Promise<Wire[]> {
  const report = await gz(`${dir}/${name}.json.gz`), out = report.reads as Wire[];
  for (const r of out) {
    if (r.verdict) assert.deepEqual(verdict(r), r.verdict, `${name}: verdict changed`);
    if (r.next) assert.deepEqual(verdict(r.next), r.next.verdict, `${name}: next verdict changed`);
  }
  return out;
}
/** Every read that the reply did not refuse returned exactly the declared note of its row. */
function noWrongNotes(name: string, list: Wire[]): void {
  for (const r of list) {
    if (r.reply?.refused || !r.rows) continue;
    const d = declared(r.row);
    assert.equal(r.rows.length, 1, `${name}: ${r.rows.length} notes`);
    assert.deepEqual([r.rows[0].channel, r.rows[0].cell, r.rows[0].pitch], [d.channel, d.cell, d.pitch], `${name}: wrong note`);
  }
}
/** Each group level of each reply: collapsed at entry was expanded and collapsed again. */
function restoredLevels(name: string, list: Wire[], want: boolean[][]): void {
  for (const r of list) if (!r.reply.refused) assert.deepEqual(levels(r.reply), want, `${name}: levels`);
}

/** Check every E241 claim from the retained artifacts. */
export async function verifyOffline(dir: string): Promise<Wire> {
  const summary: Wire = {};
  const median = (xs: number[]): number => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
  const G1 = [[false, true, true]], NESTED: Record<string, boolean[][]> = {
    'collapsed-expanded': [[true, false, false], [false, true, true]],
    'collapsed-collapsed': [[false, true, true], [false, true, true]],
    'expanded-collapsed': [[false, true, true], [true, false, false]],
  };
  // Final build (probe 932613a5, normal 3ed03556; one source): owned project New 11.
  for (const [name, count, want] of [['matrix-collapsed-a', 107, G1], ['normal-matrix-collapsed', 108, G1],
    ['normal-matrix-expanded', 108, [[true, false, false]]]] as const) {
    const list = await reads(dir, name);
    assert.equal(list.length, 108); assert.equal(passed(list), count, name);
    noWrongNotes(name, list); restoredLevels(name, list, want as boolean[][]);
    summary[name] = passed(list);
  }
  // The one probe miss: the first read of the session lost the lease (E232 open observation).
  const first = (await reads(dir, 'matrix-collapsed-a')).filter(r => !r.verdict.pass);
  assert.equal(first[0]!.sequence, 0); assert.equal(first[0]!.order[0], first[0]!.row);
  assert.equal(first[0]!.reply.selection.reason, 'lease-lost');
  for (const [name, state] of [['nested-collapsed-collapsed', 'collapsed-collapsed'],
    ['normal-nested-collapsed-collapsed', 'collapsed-collapsed'], ['normal-nested-expanded-collapsed', 'expanded-collapsed'],
    ['normal-nested-collapsed-expanded', 'collapsed-expanded']] as const) {
    const list = await reads(dir, name);
    assert.equal(list.length, 18); assert.equal(passed(list), 18, name);
    noWrongNotes(name, list); restoredLevels(name, list, NESTED[state]!);
    summary[name] = passed(list);
  }
  summary.groupMedianMs = median((await reads(dir, 'normal-matrix-collapsed')).map(r => r.reply.totalMs));
  summary.nestedMedianMs = median((await reads(dir, 'normal-nested-collapsed-collapsed')).map(r => r.reply.totalMs));
  // A top-level track: the parent is the project proxy (master ID, isGroup true). Nothing expands; no cost.
  for (const name of ['top-level-probe', 'normal-top-level']) {
    const list = await reads(dir, name);
    assert.equal(passed(list), 20, name);
    for (const r of list) assert.deepEqual(levels(r.reply), [[false, false, false]], `${name}: proxy`);
    summary[`${name}MedianMs`] = median(list.map(r => r.reply.totalMs));
    assert(summary[`${name}MedianMs`] < 200);
  }
  // Refusals after the expansion: the next read finds G1 collapsed and reads its notes; all pass.
  const refused = await reads(dir, 'refusals');
  assert.equal(refused.length, 22); assert.equal(refused.filter(r => r.next.verdict.pass).length, 22);
  for (const r of refused) { assert.deepEqual(levels(r.next.reply), G1); noWrongNotes('refusals', [r.next]); }
  assert.deepEqual([...new Set(refused.map(r => r.refused.reply.refused ?? 'none'))].sort(),
    ['deadline', 'duplicate-cell', 'none', 'step-delta']);
  // Hidden-child and master entry mixer tracks; with the final order they pass also without the reselect.
  for (const name of ['hidden-mixer', 'master-entry', 'master-entry-no-reselect']) {
    const list = await reads(dir, name);
    assert(list.every(r => r.taken === true), `${name}: entry state`); assert.equal(passed(list), 6, name);
  }
  const noExpand = await reads(dir, 'no-expand');
  assert.deepEqual(noExpand.map(r => r.reply.refused ?? null), [null, 'bound-target-mismatch', 'bound-target-mismatch']);
  for (const r of await reads(dir, 'normal-adapter')) {
    assert.equal(r.error, undefined); assert.equal(r.clipReads.length, 1); assert.equal(r.value.notes[0].pitch, declared(r.row).pitch);
  }
  // The anchor, read-only, Group 5 collapsed. Notes against the reads made while it was expanded.
  const ref = await gz(`${dir}/anchor-group-expanded.json.gz`), want = new Map<number, string>();
  for (const r of ref.reads as Wire[]) if (r.name === 'gn-E16' && r.pass === 2) want.set(r.row, JSON.stringify(r.rows));
  assert.equal(want.size, 3);
  const anchorMatrix = (await gz(`${dir}/anchor-matrix.json.gz`)).reads as Wire[];
  assert.equal(anchorMatrix.length, 72);
  for (const r of anchorMatrix) {
    assert.deepEqual(anchorVerdict(r, want.get(r.row)), r.verdict); assert(r.verdict.pass);
    assert.deepEqual(levels(r.reply), G1);
  }
  // The person's path: select a gn-E16 slot, collapse Group 5. Before the final order, the slot did not restore.
  const hidden = await gz(`${dir}/anchor-hidden.json.gz`), sameTask = await gz(`${dir}/anchor-hidden-same-task.json.gz`);
  for (const [report, pass] of [[hidden, 6], [sameTask, 0]] as const) {
    assert.equal(report.entry.trackIndex, report.tracks.find((t: Wire) => t.name === 'gn-E16').index);
    for (const r of report.reads as Wire[]) assert.deepEqual(anchorVerdict(r, want.get(r.row)), r.verdict);
    assert.equal((report.reads as Wire[]).filter(r => r.verdict.pass).length, pass);
  }
  for (const r of sameTask.reads as Wire[]) assert.equal(r.after.slotIndex, r.row, 'the slot stayed on the read row');
  // Defects found on the way, each fail-closed: the project proxy, the group parent handle, and a climb wait.
  const proxy = await reads(dir, 'top-level-project-proxy-defect');
  assert(proxy.every(r => r.reply.refused === 'deadline' && r.reply.parents[0].isGroup === true));
  const handle = await reads(dir, 'nested-collapsed-expanded-parent-handle');
  assert.equal(passed(handle), 5);
  for (const r of handle) {
    assert.equal(r.reply.parents[1].channelId, r.reply.parents[0].channelId); assert.equal(r.reply.parents[1].isGroup, false);
    if (r.reply.refused) assert.equal(r.reply.refused, 'bound-target-mismatch');
  }
  assert((await reads(dir, 'nested-collapsed-expanded-climb-wait-defect')).every(r => r.reply.refused === 'deadline'));
  for (const name of ['matrix-collapsed-a', 'nested-collapsed-collapsed', 'top-level-probe']) {
    for (const r of await reads(dir, name)) assert.equal(r.reply.refused === undefined || r.reply.refused === null, true);
  }
  // Every selectParent move landed at the first poll; the top-level wait was then 10 polls.
  const moves = (await reads(dir, 'timing-nested')).flatMap(r => (r.reply.parents as Wire[]).filter(p => p.movePolls !== undefined));
  assert.equal(moves.length, 36); assert(moves.every(m => m.movePolls === 1 && m.moveMs < 30));
  // The collapse in the close task (earlier build): a master or hidden-child entry mixer ends on the group.
  for (const [name, count] of [['master-entry-no-reselect-collapse-in-close', 0], ['hidden-mixer-before-reselect', 0],
    ['master-entry-collapse-in-close', 6]] as const) {
    const list = await reads(dir, name);
    assert.equal(passed(list), count, name);
    if (count === 0) for (const r of list) assert.equal(r.after.mixerTrackIndex, 0, `${name}: the mixer ends on G1`);
  }
  // Restoration.
  for (const name of ['cleanup', 'cleanup-new10']) {
    const c = await gz(`${dir}/${name}.json.gz`);
    assert.deepEqual(c.tracks.map((r: Wire) => r.channelId), c.entryTracks.map((r: Wire) => r.channelId));
  }
  const baseline = JSON.parse(await readFile(`${dir}/baseline-final.json`, 'utf8'));
  assert.equal(baseline.project, 'gn-scale-test'); assert.equal(baseline.matchesE234, true);
  for (const log of ['normal-hello.log', 'normal-hello-final.log']) {
    const hello = await readFile(`${dir}/${log}`, 'utf8');
    assert.match(hello, /ALL PASS/); assert.match(hello, /"groupRule":"expand-collapsed-parent-v1"/);
    assert.match(hello, /"runtimeProfile":"normal-v1".*"methodCount":87,"methodsHash":"ca139a3e62a55e68"/);
  }
  return summary;
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  try {
    if (command === 'setup') await setup(args[0]!);
    else if (command === 'matrix') await matrix(args[0]!, args[1]!, args[2]!);
    else if (command === 'nested') await nested(args[0]!, args[1]!, args[2]!, args[3]!);
    else if (command === 'refusals') await refusals(args[0]!, args[1]!);
    else if (command === 'no-expand') await noExpand(args[0]!, args[1]!);
    else if (command === 'hidden-mixer') await hiddenMixer(args[0]!, args[1]!, args[2]);
    else if (command === 'master-entry') await masterEntry(args[0]!, args[1]!, args[2]);
    else if (command === 'top-level') await topLevel(args[0]!, args[1]!, Number(args[2]));
    else if (command === 'adapter') await adapterPath(args[0]!, args[1]!);
    else if (command === 'anchor') await anchor(args[0]!);
    else if (command === 'anchor-matrix') await anchorMatrix(args[0]!, args[1]!);
    else if (command === 'anchor-hidden') await anchorHidden(args[0]!, args[1]!);
    else if (command === 'cleanup') await cleanup(args[0]!, args[1]!);
    else if (command === 'verify-offline') console.log(JSON.stringify(await verifyOffline(args[0]!), null, 1));
    else throw new Error(`unknown command ${command}`);
  } finally { await transport.close(); }
}
if (import.meta.url === pathToFileURL(process.argv[1]!).href) await main();
