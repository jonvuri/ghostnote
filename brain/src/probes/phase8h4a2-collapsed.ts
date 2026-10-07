/**
 * 8h4a2 collapsed-child reader routes. Live driver, probe profile. Use an owned unsaved project; refuse the saved
 * anchor (D29).
 *
 *   setup <state.json>                      64 scenes, an other track with a row-0 clip, and one child track for
 *                                           each route with distinct clips in rows 0, 1, and 63 (row 2 empty)
 *   reference <out> <state.json>            the group is expanded: product reads of every child row
 *   matrix <out> <state.json> <view>        every route on its own child: every read order of rows 0, 1, 63 from
 *                                           three entry selections. view is expanded or collapsed (operator state)
 *   hidden-mixer <out> <state.json> <route>
 *                                           the mixer selection is on another child of the collapsed group:
 *                                           every row of the route child, from each other child, twice
 *   refusal <out> <state.json> <view>       the product reader path and its surface refusal on every row of the
 *                                           product child
 *   cleanup <out> <state.json>              delete every track that the entry list does not hold
 *   verify-offline <dir>                    check every E240 claim from the retained artifacts
 */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { LiveAdapter } from '../adapters/live/adapter.js';
import { decodeNoteFrame, type NoteFrame, type RawNoteFields } from '../adapters/live/clip-read.js';
import { addressKey, clip, notes, scene, slot, track } from '../contract/index.js';
import { refusalOf } from '../surface/report.js';
import type { E131Context } from './e131-diagnostic.js';
import { WireTransport, type Call } from './phase8h3c-promotion.js';
import { ENTRIES, ROWS, declared, orders, verdict, type Wire } from './phase8h3c2-rows-lib.js';

export const ROUTES = ['product', 'show-in-editor', 'cursor-step', 'expand-parent'] as const;
const PROBE: readonly [string, number, string] = ['phase-8-probe-v1', 98, '659635435255b259'];
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

/** The probe profile, the reader markers, and an owned unsaved project. */
async function guard(): Promise<Wire> {
  const hello = await request('contract.hello');
  assert.deepEqual([hello.runtimeProfile, hello.methodCount, hello.methodsHash], [...PROBE]);
  const mark = await request('revision.get');
  assert(/^New \d+$/.test(mark.project), `use an owned unsaved project, got ${mark.project}`);
  const rig = await request('rig.info');
  assert.equal(rig.clipReader?.revision, 'clip-reader-v2');
  assert.equal(rig.clipReader?.openRule, 'subscribe-before-unpin-v1');
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
/** Write one declared clip with the E131 fine cursor (E232 fixtures). */
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
  const entry = await guard();
  const state: Wire = { schema: 'phase8h4a2-state-v1', entry, entryTracks: (await request('track.list')).tracks,
    entrySelection: await request('selection.status'), tracks: {}, children: {} };
  const missing = 64 - Number((await request('scene.count')).sceneCount);
  if (missing > 0) { await request('scene.create', { count: missing }); await pause(500); }
  state.tracks.other = await createTrack('gn-8h4a2-other'); await write(state.tracks.other, 0);
  for (const route of [...ROUTES].reverse()) {
    const id = await createTrack(`gn-8h4a2-${route}`);
    for (const row of ROWS) await write(id, row);
    const empty = await request('slot.status', { trackIndex: await indexOf(id), slotIndex: 2 });
    assert.equal(empty.hasContent, false, 'row 2 must stay empty');
    state.children[route] = id; await save(statePath, state);
  }
  console.log(JSON.stringify({ children: state.children, other: state.tracks.other }));
}

/**
 * Put the entry selection in place: another track at row 0, the target row, or another row of the target. A slot
 * in a collapsed group may not take the selection; record what the host reports.
 */
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
async function read(id: string, row: number, route: string): Promise<Wire> {
  const calls: Call[] = [], started = performance.now();
  const before = await request('selection.status');
  const options = route === 'product' ? {} : { diagnosticRoute: route };
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
  return { trackId: id, row, route, reply, rows, before, after, wallMs };
}

async function reference(out: string, statePath: string): Promise<void> {
  const entry = await guard(), state = await load(statePath);
  const reads: Wire[] = [];
  for (const route of ROUTES) for (const row of ROWS) {
    const r = await read(state.children[route], row, 'product');
    reads.push({ ...r, verdict: verdict(r) });
    assert(verdict(r).pass, `reference ${route}:${row}: ${verdict(r).issues.join(', ')}`);
  }
  await artifact(out, { schema: 'phase8h4a2-reference-v1', entry, children: state.children, reads });
  console.log(JSON.stringify({ reference: reads.length }));
}

async function matrix(out: string, statePath: string, view: string): Promise<void> {
  assert(view === 'expanded' || view === 'collapsed', 'view is expanded or collapsed');
  const entry = await guard(), state = await load(statePath);
  const sequences = orders().flatMap(order => ENTRIES.map(entrySelection => ({ order, entrySelection })));
  const report: Wire = { schema: 'phase8h4a2-matrix-v1', entry, view, children: state.children, reads: [] };
  try {
    for (const route of ROUTES) for (const [i, s] of sequences.entries()) for (const row of s.order) {
      const id = state.children[route];
      const entrySelection = await enter(state, id, row, s.entrySelection);
      const r = await read(id, row, route), v = verdict(r);
      report.reads.push({ sequence: i, order: s.order, entry: s.entrySelection, entrySelection, ...r, verdict: v });
      console.log(JSON.stringify({ route, i, entry: s.entrySelection, taken: entrySelection.taken, row,
        bound: r.reply.bound?.row, pass: v.pass, refused: r.reply.refused, path: r.reply.path,
        parent: r.reply.parent?.wasExpanded }));
    }
  } finally { await artifact(out, report); }
  for (const route of ROUTES) {
    const reads = (report.reads as Wire[]).filter(r => r.route === route);
    console.log(JSON.stringify({ route, reads: reads.length, passed: reads.filter(r => r.verdict.pass).length }));
  }
}

/**
 * Put the mixer selection on a child of the collapsed group with a product read of its row 0, then the slot
 * selection on the other track.
 */
async function enterHiddenMixer(state: Wire, mixerId: string): Promise<Wire> {
  const mixer = await indexOf(mixerId), other = await indexOf(state.tracks.other);
  // slot.select does not move the mixer selection to a hidden child; the row selection of a product read does.
  const setup = await read(mixerId, 0, 'product');
  await request('slot.select', { trackIndex: other, slotIndex: 0, mechanism: 'track' });
  const status = await until(() => request('selection.status'), value => value.trackIndex === other, 5_000);
  return { requested: [other, 0, mixer], taken: status.mixerTrackIndex === mixer, status,
    setupSelection: setup.reply.selection, setupRefused: setup.reply.refused ?? null };
}

async function hiddenMixer(out: string, statePath: string, route: string): Promise<void> {
  const entry = await guard(), state = await load(statePath), id = state.children[route];
  const others = ROUTES.filter(r => r !== route).map(r => state.children[r] as string);
  const report: Wire = { schema: 'phase8h4a2-hidden-mixer-v1', entry, route, children: state.children, reads: [] };
  try {
    for (const pass of [1, 2]) for (const mixerId of others) for (const row of ROWS) {
      const entrySelection = await enterHiddenMixer(state, mixerId);
      const r = await read(id, row, route), v = verdict(r);
      report.reads.push({ pass, mixerId, entry: 'hidden-mixer', entrySelection, ...r, verdict: v });
      console.log(JSON.stringify({ route, pass, taken: entrySelection.taken, row, bound: r.reply.bound?.row,
        pass_: v.pass, issues: v.issues }));
    }
  } finally { await artifact(out, report); }
  const reads = report.reads as Wire[];
  console.log(JSON.stringify({ route, reads: reads.length, passed: reads.filter(r => r.verdict.pass).length }));
}

/**
 * The product reader path: `adapter.read` of the notes address, and the surface refusal of its error. Row 0
 * reads; another row refuses `collapsed-group-row` after one retry when the group is collapsed. (`read_clip`
 * also reads the `clip` address through cursor 0, which fails on these tracks for another cause: E240.)
 */
async function refusal(out: string, statePath: string, view: string): Promise<void> {
  const entry = await guard(), state = await load(statePath), id = state.children.product;
  const reads: Wire[] = [];
  for (const row of ROWS) {
    const before = transport.calls.length, mark = await request('revision.get');
    const address = notes(clip(slot(track(id), scene(row, mark.sceneEpoch))), declared(row).channel);
    let value: Wire | undefined, error: Wire | undefined;
    try { value = (await adapter.read([address])).entries[addressKey(address)]?.value as Wire; }
    catch (e) { error = { name: (e as Error).constructor.name, message: String(e), surface: refusalOf(e) }; }
    const clipReads = transport.calls.slice(before).filter(call => call.method === 'clip.read')
      .map(call => { const { frame: _frame, ...reply } = call.reply.result as Wire; return reply; });
    reads.push({ row, value, error, clipReads });
    console.log(JSON.stringify({ view, row, notes: value?.notes?.length ?? null, pitch: value?.notes?.[0]?.pitch,
      error: error?.name, reason: error?.surface?.reason, clipReads: clipReads.map(r => r.refused ?? `row ${r.bound?.row}`) }));
  }
  await artifact(out, { schema: 'phase8h4a2-refusal-v1', entry, view, trackId: id, reads });
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
  await artifact(out, { schema: 'phase8h4a2-cleanup-v1', entry, deleted, tracks, entryTracks: state.entryTracks, stats });
  console.log(JSON.stringify({ deleted: deleted.length, tracks: tracks.length }));
}

const fields = (rows: Wire[]): string => JSON.stringify(rows);

/**
 * Per route: reads, passes, refusals by reason, and wrong reads. A wrong read published notes that are not the
 * expanded reference of the requested track and row.
 */
export function summarize(report: Wire, ref: Wire): Wire {
  const want = new Map<string, string>();
  for (const r of ref.reads as Wire[]) want.set(`${r.trackId}:${r.row}`, fields(r.rows));
  const out: Wire = {};
  for (const route of ROUTES) {
    const reads = (report.reads as Wire[]).filter(r => r.route === route);
    const refused: Record<string, number> = {};
    let passed = 0, wrong = 0, selectionMisses = 0;
    for (const r of reads) {
      assert.deepEqual(verdict(r), r.verdict, `${route}: verdict changed`);
      if (r.verdict.pass) passed++;
      if (r.reply.refused) refused[r.reply.refused] = (refused[r.reply.refused] ?? 0) + 1;
      else if (fields(r.rows) !== want.get(`${r.trackId}:${r.row}`)) wrong++;
      if (r.verdict.issues.some((i: string) => i.startsWith('selection'))) selectionMisses++;
    }
    out[route] = { reads: reads.length, passed, refused, wrong, selectionMisses };
  }
  return out;
}

const counts = (summary: Wire): Wire => Object.fromEntries(ROUTES.map(route => [route, summary[route].passed]));

/** Check every E240 claim from the retained artifacts. */
export async function verifyOffline(dir: string): Promise<Wire> {
  const summary: Wire = {};
  const refs: Record<string, Wire> = {};
  for (const name of ['reference-restore-first', 'reference']) {
    const ref = await gz(`${dir}/${name}.json.gz`);
    assert.equal(ref.reads.length, 12); assert((ref.reads as Wire[]).every(r => r.verdict.pass));
    refs[name] = ref;
  }
  // Two builds: the collapse after the selection restore, then before it. Each with the expanded reference.
  for (const [build, suffix, ref] of [['restore-first', '-restore-first', refs['reference-restore-first']],
    ['collapse-first', '', refs.reference]] as const) {
    for (const name of ['expanded', 'collapsed-a', 'collapsed-b']) {
      const report = await gz(`${dir}/matrix-${name}${suffix}.json.gz`);
      assert.equal(report.reads.length, ROUTES.length * 54, name);
      assert.equal(report.view, name === 'expanded' ? 'expanded' : 'collapsed');
      const s = summarize(report, ref!);
      for (const route of ROUTES) assert.equal(s[route].wrong, 0, `${build} ${name}: ${route} published wrong notes`);
      if (name === 'expanded') assert.deepEqual(counts(s), { product: 54, 'show-in-editor': 54, 'cursor-step': 54, 'expand-parent': 54 });
      else {
        assert.deepEqual(counts(s), { product: 17, 'show-in-editor': 17, 'cursor-step': 17, 'expand-parent': 53 });
        assert.deepEqual(s.product.refused, { 'bound-target-mismatch': 36 });
        assert.deepEqual(s['show-in-editor'].refused, { 'bound-target-mismatch': 36 });
        assert.deepEqual(s['cursor-step'].refused, { 'step-stuck': 36 });
        assert.deepEqual(s['expand-parent'].refused, {});
        const reads = report.reads as Wire[];
        // cursor-step: the reader never leaves row 0 in a collapsed group.
        for (const r of reads.filter(r => r.route === 'cursor-step')) assert.deepEqual(r.reply.path, [[0, true]]);
        // expand-parent: the parent handle is the group; it was collapsed, expanded for the read, and collapsed again.
        for (const r of reads.filter(r => r.route === 'expand-parent')) {
          assert.equal(r.reply.parent.isGroup, true); assert.equal(r.reply.parent.wasExpanded, false);
          assert.equal(r.reply.parent.expanded, true); assert.equal(r.reply.parent.collapsed, true);
        }
        // Its one failure: the entry mixer track is another child; the mixer selection ends on the group track.
        const failed = reads.filter(r => r.route === 'expand-parent' && !r.verdict.pass);
        assert.equal(failed.length, 1); assert.equal(failed[0]!.sequence, 0); assert.equal(failed[0]!.after.mixerTrackIndex, 0);
        assert.deepEqual(failed[0]!.verdict.issues, [`selection 5,0,${failed[0]!.before.mixerTrackIndex} -> 5,0,0`]);
        assert.equal(failed[0]!.reply.selection.restored, true);
        // Entry selections on a collapsed child do not take.
        for (const r of reads.filter(r => r.entry !== 'other')) assert.equal(r.entrySelection.taken, false);
      }
      summary[`${build}:${name}`] = s;
    }
  }
  // The cursor-step lease reclaim: without it, every changed-entry read lost the lease in the expanded group.
  const noReclaim = summarize(await gz(`${dir}/matrix-expanded-no-reclaim.json.gz`), refs['reference-restore-first']!);
  assert.equal(noReclaim['cursor-step'].passed, 18); assert.equal(noReclaim['cursor-step'].wrong, 0);
  summary.noReclaim = counts(noReclaim);
  // Hidden-mixer entry: product and both expand-parent builds fail every restore when collapsed. In the expanded
  // run the setup read restored the mixer, so the entry state never formed (taken: false); it is no evidence.
  for (const [name, passed] of [['hidden-mixer-product', 0], ['hidden-mixer-restore-first', 0], ['hidden-mixer', 0],
    ['hidden-mixer-expanded', 18]] as const) {
    const report = await gz(`${dir}/${name}.json.gz`), reads = report.reads as Wire[];
    assert.equal(reads.length, 18);
    for (const r of reads) {
      assert.deepEqual(verdict(r), r.verdict); assert.equal(r.entrySelection.taken, name !== 'hidden-mixer-expanded');
    }
    assert.equal(reads.filter(r => r.verdict.pass).length, passed, name);
    if (name !== 'hidden-mixer-product' && passed === 0) {
      for (const r of reads) {
        assert.equal(r.reply.refused, undefined); assert.equal(r.after.mixerTrackIndex, 0);
        assert.equal(r.reply.selection.restored, true);
      }
    }
    summary[name] = reads.filter(r => r.verdict.pass).length;
  }
  // The product reader path: collapsed rows 1 and 63 refuse collapsed-group-row after one retry.
  for (const view of ['expanded', 'collapsed']) {
    const report = await gz(`${dir}/refusal-${view}.json.gz`);
    for (const r of report.reads as Wire[]) {
      if (view === 'expanded' || r.row === 0) {
        assert.equal(r.error, undefined); assert.equal(r.value.notes[0].pitch, declared(r.row).pitch);
        assert.equal(r.clipReads.length, 1);
      } else {
        assert.equal(r.error.name, 'CollapsedGroupRowError'); assert.equal(r.error.surface.reason, 'collapsed-group-row');
        assert.deepEqual(r.clipReads.map((c: Wire) => c.refused), ['bound-target-mismatch', 'bound-target-mismatch']);
      }
    }
  }
  // Restoration.
  const cleanupReport = await gz(`${dir}/cleanup.json.gz`);
  assert.deepEqual(cleanupReport.tracks.map((r: Wire) => r.channelId), cleanupReport.entryTracks.map((r: Wire) => r.channelId));
  const baseline = JSON.parse(await readFile(`${dir}/baseline-final.json`, 'utf8'));
  assert.equal(baseline.project, 'gn-scale-test'); assert.equal(baseline.matchesE234, true); assert.equal(baseline.tracks.length, 11);
  const hello = await readFile(`${dir}/normal-hello-final.log`, 'utf8');
  assert.match(hello, /ALL PASS/);
  assert.match(hello, /"runtimeProfile":"normal-v1".*"methodCount":87,"methodsHash":"ca139a3e62a55e68"/);
  // The separate cursor-position finding in the anchor.
  const position = await readFile(`${dir}/cursor-position-anchor.log`, 'utf8');
  assert.match(position, /gn-A 2 0 ok/); assert.match(position, /gn-E16 5 0 ERR .*last observed track 0/);
  assert.match(position, /gn-sel 8 0 ERR .*last observed track 7/);
  return summary;
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  try {
    if (command === 'setup') await setup(args[0]!);
    else if (command === 'reference') await reference(args[0]!, args[1]!);
    else if (command === 'matrix') await matrix(args[0]!, args[1]!, args[2]!);
    else if (command === 'hidden-mixer') await hiddenMixer(args[0]!, args[1]!, args[2]!);
    else if (command === 'refusal') await refusal(args[0]!, args[1]!, args[2]!);
    else if (command === 'cleanup') await cleanup(args[0]!, args[1]!);
    else if (command === 'verify-offline') console.log(JSON.stringify(await verifyOffline(args[0]!), null, 1));
    else throw new Error(`unknown command ${command}`);
  } finally { await transport.close(); }
}
if (import.meta.url === pathToFileURL(process.argv[1]!).href) await main();
