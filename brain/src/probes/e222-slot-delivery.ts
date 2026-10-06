// 8h3e removed the research wire or rig configuration that this live driver uses. Live use needs the
// earlier research build of its own session. Its retained artifacts and offline checks do not need a host.
/**
 * E222 live driver: hasContent delivery across controller-issued P→Q→P project
 * detours and same-callback clip recreation. Research only; nothing becomes eligible.
 *
 * Modes:
 *   status                          print the recorder signatures
 *   prepare <P|Q> <state.json>      create the owned occupancy pattern on the shown project
 *   trial <state.json> <out.json> [reps]
 *   recreate-witness <state.json> <out.json> [reps]
 *   verify <out.json>               recompute summaries from retained traces
 */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { BridgeClient } from '../client.js';
import { parseSignature } from './e216-delivery-coherence-lib.js';
import { E222_MARKER, aggregateSlotRuns, compactSlotTrace, occupancyFor, summarizeSlotRun } from './e222-slot-delivery-lib.js';
import type { Side, SlotSide, SlotSides } from './e222-slot-delivery-lib.js';

type Wire = Record<string, unknown>;
const PROTECTED_PROJECT = 'New 3';
const NEXT = 'Select Next Project', PREV = 'Select Previous Project';
/** P and Q share row 0, so that row tests identity across projects with equal occupancy. */
export const PATTERNS: Record<Side, readonly number[]> = { P: [0, 1, 2], Q: [0, 4, 5] };
/** P row 1 is the recreate target. P row 6 is empty and is the separate create/delete target. */
const RECREATE_ROW = 1, TOGGLE_ROW = 6, SEPARATE_DELAY_MS = 150;
const SETTLE_MS = 600, FLOOD_MS = 300, FLOOD_CONCURRENCY = 4, SEPARATE_REPS = 20, RECREATE_REPS = 20, TOGGLE_REPS = 10;
const bridge = new BridgeClient();
const wait = async (ms: number): Promise<void> => await new Promise(resolve => setTimeout(resolve, ms));
const request = async (method: string, params?: Wire): Promise<Wire> => await bridge.request(method, params, 30_000) as Wire;
const delivery = async (operation: string, params: Wire = {}): Promise<Wire> => await request('cache.shadow', { operation, ...params });
const readJson = async (path: string): Promise<Wire> => JSON.parse(await readFile(path, 'utf8')) as Wire;
const save = async (path: string, value: Wire): Promise<void> => await writeFile(path, JSON.stringify(value, null, 1) + '\n');

async function flood(until: number): Promise<number> {
  let sent = 0;
  await Promise.all(Array.from({ length: FLOOD_CONCURRENCY }, async () => {
    while (performance.now() < until) { await delivery('deliveryPing'); sent++; }
  }));
  return sent;
}

async function runScript(script: Wire[], withFlood = false): Promise<{ trace: Wire; pings: number }> {
  await delivery('deliveryClear'); await delivery('deliveryStart', { ordering: true }); await wait(150);
  await delivery('deliveryRun', { script });
  const pings = withFlood ? await flood(performance.now() + FLOOD_MS) : 0;
  const start = performance.now();
  for (;;) { const status = await delivery('deliveryStatus'); if (Number(status.runRemaining) === 0) break;
    assert(performance.now() - start < 20_000, 'delivery run did not finish'); await wait(20); }
  await wait(SETTLE_MS);
  await delivery('deliveryStop');
  const trace = await delivery('deliveryTrace');
  assert.equal(trace.slotMarker, E222_MARKER); assert.equal(trace.ordering, true);
  return { trace, pings };
}

async function prepare(side: Side, statePath: string): Promise<void> {
  const status = await delivery('deliveryStatus'), name = parseSignature(String(status.signature)).name;
  assert.notEqual(name, PROTECTED_PROJECT, 'never prepare the protected project');
  let state: Wire = {}; try { state = await readJson(statePath); } catch { /* first side */ }
  const other = state[side === 'P' ? 'Q' : 'P'] as SlotSide | undefined;
  assert(!other || other.name !== name, 'P and Q must be different loaded projects');
  const tracks = (await request('track.list')).tracks as Wire[];
  assert.equal(tracks[0]?.type, 'Instrument', 'the owned project needs a first instrument track');
  const empty = String(status.slotSignature);
  assert(/^\.{8}(,[.-]{8})*$/.test(empty), `the owned project must start with an empty window: ${empty}`);
  for (const row of PATTERNS[side]) await request('clip.create', { trackIndex: 0, slotIndex: row, lengthBeats: 4 });
  const expected = occupancyFor(PATTERNS[side], empty), until = Date.now() + 10_000;
  let current = '';
  while ((current = String((await delivery('deliveryStatus')).slotSignature)) !== expected) {
    assert(Date.now() < until, `occupancy did not settle: ${current}`); await wait(50);
  }
  const identity: SlotSide = { name, trackId: String(tracks[0]!.channelId), occupancy: expected };
  state[side] = identity; state[`${side}Setup`] = { tracks, emptyOccupancy: empty, rows: PATTERNS[side], at: new Date().toISOString() };
  await save(statePath, state);
  console.log(JSON.stringify({ side, identity }));
}

async function trial(statePath: string, out: string, reps: number): Promise<void> {
  const state = await readJson(statePath), sides = { P: state.P, Q: state.Q } as SlotSides;
  assert(sides.P && sides.Q, 'prepare both P and Q first');
  const status = await delivery('deliveryStatus');
  assert.equal(parseSignature(String(status.signature)).name, sides.P.name, 'trial must start on P');
  assert.equal(status.slotSignature, sides.P.occupancy, 'trial must start with the P occupancy');
  const guard = { expectedProject: sides.P.name, expectedTrackChannelId: sides.P.trackId, track: 0 };
  const report: Wire = { marker: E222_MARKER, researchOnly: true, complete: false, eligible: false, hostFenceProved: false,
    started: new Date().toISOString(), sides, actions: { next: NEXT, prev: PREV }, reps, settleMs: SETTLE_MS,
    floodMs: FLOOD_MS, floodConcurrency: FLOOD_CONCURRENCY, runs: [], limitations: [
      'commands and observers share one controller process; neither is a host input fence',
      'one four-track by eight-row window per project and controller-issued commands only',
      'occupancy is a flat window read; it does not identify a clip',
    ] };
  const persist = async (): Promise<void> => await save(out, report);
  const stop = async (reason: string): Promise<never> => { report.stoppedReason = reason; report.ended = new Date().toISOString(); await persist(); throw new Error(reason); };
  await persist();
  const plan: Wire[] = [
    ...Array.from({ length: 3 }, (_, rep) => ({ kind: 'single-control', rep })),
    ...Array.from({ length: reps }, (_, rep) => ({ kind: 'same-callback-detour', rep, flood: rep % 2 === 0 })),
    ...Array.from({ length: SEPARATE_REPS }, (_, rep) => ({ kind: 'separate-callback-detour', rep, flood: rep % 2 === 0 })),
    ...Array.from({ length: RECREATE_REPS }, (_, rep) => ({ kind: 'same-callback-recreate', rep, flood: rep % 2 === 0 })),
    ...Array.from({ length: TOGGLE_REPS }, (_, rep) => ({ kind: 'separate-create-delete', rep })),
  ];
  for (const item of plan) {
    const kind = String(item.kind);
    let script: Wire[], watch: { t: number; s: number }[] = [], allowed: string[] = [];
    if (kind === 'single-control') script = [{ op: 'mark', label: `${kind} rep=${String(item.rep)}` },
      { op: 'invoke', id: NEXT, delayMs: -1 }, { op: 'invoke', id: PREV, delayMs: 400 }];
    else if (kind.endsWith('detour')) script = [{ op: 'mark', label: `${kind} rep=${String(item.rep)}` }, { op: 'invoke', id: NEXT, delayMs: -1 },
      { op: 'invoke', id: PREV, delayMs: kind === 'same-callback-detour' ? -1 : 0 }];
    else if (kind === 'same-callback-recreate') {
      script = [{ op: 'mark', label: `${kind} rep=${String(item.rep)}` }, { op: 'slotRecreate', ...guard, row: RECREATE_ROW, delayMs: -1 }];
      watch = [{ t: 0, s: RECREATE_ROW }];
    } else {
      script = [{ op: 'mark', label: `${kind} rep=${String(item.rep)}` }, { op: 'slotCreate', ...guard, row: TOGGLE_ROW, delayMs: -1 },
        { op: 'slotDelete', ...guard, row: TOGGLE_ROW, delayMs: SEPARATE_DELAY_MS }];
      watch = [{ t: 0, s: TOGGLE_ROW }];
      allowed = [occupancyFor([...PATTERNS.P, TOGGLE_ROW], sides.P.occupancy)];
    }
    if (kind.endsWith('detour') || kind === 'single-control') watch = [{ t: 0, s: 0 }];
    const { trace, pings } = await runScript(script, item.flood === true);
    const compact = compactSlotTrace(trace), summary = summarizeSlotRun(compact, sides, watch, allowed);
    (report.runs as Wire[]).push({ ...item, pings, watch, allowed, summary, trace: compact });
    await persist();
    if (trace.runError !== '') await stop(`${kind} rep=${String(item.rep)} run error: ${String(trace.runError)}`);
    if (summary.finalSide !== 'P' || summary.finalOccupancyIsP !== true)
      await stop(`${kind} rep=${String(item.rep)} ended at ${String(trace.signature)} ${String(trace.slotSignature)}`);
    if (Number(summary.missedDeliveries) > 0 || Number(summary.admittedForeignTicks) > 0)
      await stop(`${kind} rep=${String(item.rep)} violates the slot window rule`);
  }
  report.aggregates = aggregates(report.runs as Wire[]);
  report.ended = new Date().toISOString(); await persist();
  console.log(JSON.stringify(verify(report), null, 1));
}

/** Point the unpinned fine reader at P track 0 at one row. */
async function reader(sides: SlotSides, row: number): Promise<Wire> {
  const tracks = (await request('track.list')).tracks as Wire[];
  const track = tracks.find(value => value.channelId === sides.P.trackId); assert(track && track.index === 0);
  await request('cursor.pin', { cursor: 'fine', pinned: false }); await request('cursor.pinTrack', { cursor: 'fine', pinned: false });
  await request('cursor.pointTrack', { cursor: 'fine', trackIndex: 0 });
  await request('slot.select', { trackIndex: 0, slotIndex: row, mechanism: 'track' });
  const until = Date.now() + 10_000;
  for (;;) {
    const status = await request('cursor.status', { cursor: 'fine' });
    if (status.slotExists === true && status.sceneIndex === row && status.trackName === track.name) break;
    assert(Date.now() < until, 'reader did not settle'); await wait(50);
  }
  await request('cursor.setStepSize', { cursor: 'fine', stepSize: 0.25 }); await request('cursor.scrollToStep', { cursor: 'fine', step: 0 });
  await wait(200);
  return { name: (await request('cursor.clipMetadata', { cursor: 'fine' })).name,
    notes: (await request('cursor.getNotesVerboseAllChannels', { cursor: 'fine', maxX: 16 })).count };
}

/**
 * Independent identity witness for same-callback recreation. A named clip with one note
 * is recreated. A new empty unnamed clip at equal occupancy proves the identity change.
 */
async function recreateWitness(statePath: string, out: string, reps: number): Promise<void> {
  const state = await readJson(statePath), sides = { P: state.P, Q: state.Q } as SlotSides;
  assert.equal(parseSignature(String((await delivery('deliveryStatus')).signature)).name, sides.P.name, 'witness must run on P');
  const guard = { expectedProject: sides.P.name, expectedTrackChannelId: sides.P.trackId, track: 0 };
  const report: Wire = { marker: E222_MARKER, schema: 'e222-recreate-witness-v1', researchOnly: true, complete: false, eligible: false,
    sides, row: RECREATE_ROW, reps, started: new Date().toISOString(), runs: [] };
  for (let rep = 0; rep < reps; rep++) {
    await reader(sides, RECREATE_ROW);
    const name = `gn-8g5b-witness-${rep}`;
    await request('cursor.setClipMetadata', { cursor: 'fine', name });
    await request('cursor.setNotes', { cursor: 'fine', channel: 0, notes: [[0, 60, 100, 0.25]] });
    await wait(300);
    const before = await reader(sides, RECREATE_ROW);
    assert.deepEqual(before, { name, notes: 1 }, 'witness clip was not written');
    const { trace } = await runScript([{ op: 'mark', label: `witness rep=${rep}` }, { op: 'slotRecreate', ...guard, row: RECREATE_ROW, delayMs: -1 }]);
    const compact = compactSlotTrace(trace), summary = summarizeSlotRun(compact, sides, [{ t: 0, s: RECREATE_ROW }]);
    const after = await reader(sides, RECREATE_ROW);
    const row = { rep, before, after, identityChanged: after.name === '' && after.notes === 0, summary, trace: compact };
    (report.runs as Wire[]).push(row); await save(out, report);
    assert.equal(trace.runError, '', String(trace.runError));
    assert.equal(summary.finalOccupancyIsP, true, 'recreate changed occupancy');
  }
  const runs = report.runs as Wire[];
  report.summary = { runs: runs.length, identityChanged: runs.filter(r => r.identityChanged).length,
    withoutRowCallback: runs.filter(r => ((r.summary as Wire).watchedSlotEvents as number[])[0] === 0).length,
    identityChangedWithoutRowCallback: runs.filter(r => r.identityChanged && ((r.summary as Wire).watchedSlotEvents as number[])[0] === 0).length,
    missedDeliveries: runs.reduce((n, r) => n + Number((r.summary as Wire).missedDeliveries), 0) };
  report.ended = new Date().toISOString(); await save(out, report);
  console.log(JSON.stringify(report.summary));
}

function aggregates(runs: readonly Wire[]): Wire {
  const result: Wire = {};
  for (const kind of new Set(runs.map(r => String(r.kind))))
    result[kind] = aggregateSlotRuns(runs.filter(r => r.kind === kind).map(r => r.summary as Wire));
  return result;
}

/** Recompute every retained summary from its compacted trace. */
export function verify(report: Wire): Wire {
  assert.equal(report.marker, E222_MARKER); assert.equal(report.eligible, false); assert.equal(report.hostFenceProved, false);
  const sides = report.sides as SlotSides;
  const runs = (report.runs as Wire[]).map(row => {
    const summary = summarizeSlotRun(row.trace as Wire, sides, row.watch as { t: number; s: number }[], (row.allowed as string[] | undefined) ?? []);
    assert.deepEqual(summary, row.summary, `retained ${String(row.kind)} rep=${String(row.rep)} summary differs`);
    return { ...row, summary } as Wire;
  });
  const recomputed = aggregates(runs);
  if (report.aggregates) assert.deepEqual(recomputed, report.aggregates, 'retained aggregates differ');
  return { stoppedReason: report.stoppedReason ?? null, aggregates: recomputed, eligible: false, hostFenceProved: false };
}

async function main(): Promise<void> {
  const [mode, ...args] = process.argv.slice(2);
  if (mode === 'verify') { console.log(JSON.stringify(verify(await readJson(args[0]!)), null, 1)); return; }
  await bridge.connect();
  if (mode === 'status') {
    const status = await delivery('deliveryStatus');
    console.log(JSON.stringify({ signature: status.signature, slotSignature: status.slotSignature, slotCallbacks: status.slotCallbacks }));
  } else if (mode === 'prepare') { assert(args[0] === 'P' || args[0] === 'Q'); assert(args[1]); await prepare(args[0], args[1]); }
  else if (mode === 'trial') { assert(args[0] && args[1]); await trial(args[0], args[1], Number(args[2] ?? 100)); }
  else if (mode === 'recreate-witness') { assert(args[0] && args[1]); await recreateWitness(args[0], args[1], Number(args[2] ?? 10)); }
  else throw new Error('usage: status|prepare|trial|verify');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  void main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => bridge.disconnect());
