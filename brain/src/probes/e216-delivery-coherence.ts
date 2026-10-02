/**
 * E216 live driver: observer delivery and per-callback coherence across
 * controller-issued P→Q→P project detours. Research only; nothing becomes eligible.
 *
 * Modes:
 *   actions [filter...]             list named actions that match any filter
 *   status                          print the recorder signature and track list
 *   switch <actionId>               invoke one action, settle, print the signature
 *   prepare <P|Q> <state.json>      write the owned witness on the shown project
 *   trial <state.json> <out.json> <nextId> <prevId> [reps]
 *   verify <out.json>               recompute summaries from retained traces
 */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { BridgeClient } from '../client.js';
import { E216_MARKER, aggregateDetours, classifyTick, parseSignature, summarizeDetour, summarizeSpin, summarizeToggle } from './e216-delivery-coherence-lib.js';
import type { Identities, Side, SideIdentity } from './e216-delivery-coherence-lib.js';

type Wire = Record<string, unknown>;
const ORIGINAL_PROJECT = 'New 1';
export const DWELLS_MS = [-1, 0, 1, 2, 5, 10, 20, 50, 100, 250, 500];
const SETTLE_MS = 1_500;
const bridge = new BridgeClient();
const wait = async (ms: number): Promise<void> => await new Promise(resolve => setTimeout(resolve, ms));
const request = async (method: string, params?: Wire): Promise<Wire> => await bridge.request(method, params, 30_000) as Wire;
const delivery = async (operation: string, params: Wire = {}): Promise<Wire> => await request('cache.shadow', { operation, ...params });
const readJson = async (path: string): Promise<Wire> => JSON.parse(await readFile(path, 'utf8')) as Wire;
const save = async (path: string, value: Wire): Promise<void> => await writeFile(path, JSON.stringify(value, null, 1) + '\n');

async function runScript(script: Wire[], settleMs = SETTLE_MS): Promise<{ trace: Wire; final: string }> {
  await delivery('deliveryClear'); await delivery('deliveryStart'); await wait(150);
  await delivery('deliveryRun', { script });
  const start = performance.now();
  for (;;) { const status = await delivery('deliveryStatus'); if (Number(status.runRemaining) === 0) break;
    assert(performance.now() - start < 20_000, 'delivery run did not finish'); await wait(20); }
  await wait(settleMs);
  await delivery('deliveryStop');
  const trace = await delivery('deliveryTrace');
  assert.equal(trace.marker, E216_MARKER); assert.equal(trace.runError, '', `run error: ${String(trace.runError)}`);
  return { trace, final: String(trace.signature) };
}
function sideOf(signature: string, identities: Identities): string {
  return String(classifyTick(parseSignature(signature), identities).project);
}
function guardFor(side: SideIdentity): Wire { return { expectedProject: side.name, expectedCursorChannelId: side.cursor }; }

async function prepare(side: Side, statePath: string): Promise<void> {
  const status = await delivery('deliveryStatus'); const sig = parseSignature(String(status.signature));
  assert.notEqual(sig.name, ORIGINAL_PROJECT, 'never prepare the original project');
  let state: Wire = {}; try { state = await readJson(statePath); } catch { /* first side */ }
  const other = state[side === 'P' ? 'Q' : 'P'] as SideIdentity | undefined;
  assert(!other || (other.name !== sig.name && other.root !== sig.root), 'P and Q must be different loaded projects');
  const tracks = (await request('track.list')).tracks as Wire[];
  assert(tracks.length > 0 && tracks[0]!.type !== 'Master', 'the owned project needs a first non-master track');
  const track = tracks[0]!;
  const slot = await request('slot.status', { trackIndex: 0, slotIndex: 0 });
  const createdClip = slot.hasContent !== true;
  if (createdClip) { await request('clip.create', { trackIndex: 0, slotIndex: 0, lengthBeats: 4 }); await wait(500); }
  await request('slot.select', { trackIndex: 0, slotIndex: 0 }); await wait(800);
  const selected = parseSignature(String((await delivery('deliveryStatus')).signature));
  assert.equal(selected.cursor, track.channelId, 'delivery cursor did not follow the owned track');
  assert(selected.clip, 'delivery cursor has no clip');
  const identity: SideIdentity = { name: sig.name, root: sig.root, cursor: String(track.channelId) };
  const { final } = await runScript([{ op: 'writeWitness', side, ...guardFor(identity) }], 800);
  const written = parseSignature(final);
  assert.equal(side === 'P' ? written.wP : written.wQ, 'NNNN', `witness not written: ${final}`);
  state[side] = identity; state[`${side}Setup`] = { createdClip, trackName: track.name, tracks, signature: final, at: new Date().toISOString() };
  await save(statePath, state);
  console.log(JSON.stringify({ side, identity, signature: final }));
}

async function trial(statePath: string, out: string, next: string, prev: string, reps: number): Promise<void> {
  const state = await readJson(statePath); const identities = { P: state.P, Q: state.Q } as Identities;
  assert(identities.P && identities.Q, 'prepare both P and Q first');
  const initial = String((await delivery('deliveryStatus')).signature);
  assert.equal(sideOf(initial, identities), 'P', `trial must start coherent on P: ${initial}`);
  assert.equal(classifyTick(parseSignature(initial), identities).coherent, true);
  const report: Wire = { marker: E216_MARKER, researchOnly: true, complete: false, eligible: false, hostFenceProved: false,
    started: new Date().toISOString(), identities, actions: { next, prev }, dwellsMs: DWELLS_MS, reps, settleMs: SETTLE_MS,
    initialSignature: initial, controls: [], detours: [], spins: [], toggles: [], limitations: [
      'commands come from the same controller process as the observers; the command log is separate but not external',
      'a P endpoint after two invocations does not prove that Q became current when no Q value is delivered',
      'signatures read the delivered controller-side state, not the host model',
    ] };
  const persist = async (): Promise<void> => await save(out, report);
  const stop = async (reason: string): Promise<never> => { report.stoppedReason = reason; report.ended = new Date().toISOString(); await persist(); throw new Error(reason); };
  await persist();

  // Single-leg controls calibrate delivery for a settled switch.
  for (let n = 0; n < 3; n++) {
    for (const [leg, id, expected] of [['P->Q', next, 'Q'], ['Q->P', prev, 'P']] as const) {
      const { trace, final } = await runScript([{ op: 'invoke', id }]);
      const values = (trace.events as Wire[]).filter(e => e.kind === 'value' && e.name === 'projectName');
      const row = { leg, n, final, finalSide: sideOf(final, identities), projectNameEvents: values.length,
        firstDeliveryUs: values[0] ? Number(values[0].us) - Number((trace.commands as Wire[])[0]!.us) : null, trace };
      (report.controls as Wire[]).push(row); await persist();
      if (row.finalSide !== expected) await stop(`control ${leg} ended on ${row.finalSide}`);
    }
  }

  // Composition oracle: three same-callback commands must end on Q if each one applies in order.
  report.composition = [];
  for (let n = 0; n < 3; n++) {
    const { trace, final } = await runScript([{ op: 'invoke', id: next }, { op: 'invoke', id: prev, delayMs: -1 }, { op: 'invoke', id: next, delayMs: -1 }]);
    const values = (trace.events as Wire[]).filter(e => e.kind === 'value' && e.name === 'projectName').map(e => e.value);
    (report.composition as Wire[]).push({ n, final, finalSide: sideOf(final, identities), projectNameValues: values, trace }); await persist();
    if (sideOf(final, identities) !== 'Q') await stop(`composition ${n} ended on ${sideOf(final, identities)}`);
    const back = await runScript([{ op: 'invoke', id: prev }]);
    if (sideOf(back.final, identities) !== 'P') await stop('composition return did not reach P');
  }

  // Interleave dwell values across repetitions to spread drift.
  for (let rep = 0; rep < reps; rep++) {
    for (const dwell of DWELLS_MS) {
      const script = [{ op: 'mark', label: `detour dwell=${dwell} rep=${rep}` }, { op: 'invoke', id: next, delayMs: -1 },
        { op: 'invoke', id: prev, delayMs: dwell < 0 ? -1 : dwell }];
      const { trace, final } = await runScript(script);
      const summary = summarizeDetour(trace, identities, final);
      (report.detours as Wire[]).push({ dwell, rep, summary, trace }); await persist();
      if (summary.outcome === 'endpoint-not-P' || summary.outcome === 'command-error')
        await stop(`detour dwell=${dwell} rep=${rep} ended ${String(summary.outcome)} at ${final}`);
    }
  }

  // Hold one callback after each switch, then hold a separate callback while the switch lands.
  for (const [label, script, expected] of [
    ['same-callback P->Q', [{ op: 'invoke', id: next }, { op: 'spin', ms: 400, delayMs: -1 }], 'Q'],
    ['same-callback Q->P', [{ op: 'invoke', id: prev }, { op: 'spin', ms: 400, delayMs: -1 }], 'P'],
    ['next-callback P->Q', [{ op: 'invoke', id: next }, { op: 'spin', ms: 400, delayMs: 0 }], 'Q'],
    ['next-callback Q->P', [{ op: 'invoke', id: prev }, { op: 'spin', ms: 400, delayMs: 0 }], 'P'],
  ] as const) {
    const { trace, final } = await runScript(script as unknown as Wire[]);
    const row = { label, final, finalSide: sideOf(final, identities), summary: summarizeSpin(trace), trace };
    (report.spins as Wire[]).push(row); await persist();
    if (row.finalSide !== expected) await stop(`spin ${label} ended on ${row.finalSide}`);
  }

  // Toggle arms run only on P with owned guards. Even counts restore the endpoint.
  const guard = guardFor(identities.P);
  for (const kind of ['mute', 'scratchStep'] as const) {
    for (let n = 0; n < 3; n++) {
      for (const delay of [-1, 0, 1, 5, 20, 100]) {
        const before = parseSignature(String((await delivery('deliveryStatus')).signature));
        const script = delay < 0 ? [{ op: kind, count: 2, ...guard }]
          : [{ op: kind, count: 1, ...guard }, { op: kind, count: 1, delayMs: delay, ...guard }];
        const { trace, final } = await runScript(script, 800);
        const summary = summarizeToggle(trace, kind, before, final);
        (report.toggles as Wire[]).push({ kind, n, delay, summary, trace }); await persist();
        if (summary.outcome !== 'measured' || summary.endpointRestored !== true) await stop(`toggle ${kind} delay=${delay} did not restore`);
      }
    }
  }

  report.aggregate = aggregateDetours(report.detours as Wire[]);
  report.finalSignature = String((await delivery('deliveryStatus')).signature);
  report.ended = new Date().toISOString(); await persist();
  console.log(JSON.stringify(verify(report)));
}

/** Follow-up: repeat same-callback detours and run step toggles only beyond delivery latency. */
async function focused(statePath: string, out: string, next: string, prev: string, reps: number): Promise<void> {
  const state = await readJson(statePath); const identities = { P: state.P, Q: state.Q } as Identities;
  const initial = String((await delivery('deliveryStatus')).signature);
  assert.equal(classifyTick(parseSignature(initial), identities).coherent, true, `focused run must start coherent on P: ${initial}`);
  const report: Wire = { marker: E216_MARKER, role: 'focused', researchOnly: true, complete: false, eligible: false, hostFenceProved: false,
    started: new Date().toISOString(), identities, actions: { next, prev }, reps, initialSignature: initial, detours: [], toggles: [] };
  const persist = async (): Promise<void> => await save(out, report);
  const stop = async (reason: string): Promise<never> => { report.stoppedReason = reason; report.ended = new Date().toISOString(); await persist(); throw new Error(reason); };
  for (let rep = 0; rep < reps; rep++) {
    const { trace, final } = await runScript([{ op: 'invoke', id: next }, { op: 'invoke', id: prev, delayMs: -1 }]);
    const summary = summarizeDetour(trace, identities, final);
    (report.detours as Wire[]).push({ dwell: -1, rep, summary, trace }); await persist();
    if (summary.outcome === 'endpoint-not-P' || summary.outcome === 'command-error') await stop(`detour rep=${rep} ended ${String(summary.outcome)}`);
  }
  const guard = guardFor(identities.P);
  for (const kind of ['mute', 'scratchStep'] as const) for (let n = 0; n < 5; n++) for (const delay of [-1, 100]) {
    const before = parseSignature(String((await delivery('deliveryStatus')).signature));
    const script = delay < 0 ? [{ op: kind, count: 2, ...guard }] : [{ op: kind, count: 1, ...guard }, { op: kind, count: 1, delayMs: delay, ...guard }];
    const { trace, final } = await runScript(script, 800);
    const summary = summarizeToggle(trace, kind, before, final);
    (report.toggles as Wire[]).push({ kind, n, delay, summary, trace }); await persist();
    if (summary.outcome !== 'measured' || summary.endpointRestored !== true) await stop(`toggle ${kind} delay=${delay} did not restore`);
  }
  report.aggregate = aggregateDetours(report.detours as Wire[]);
  report.finalSignature = String((await delivery('deliveryStatus')).signature); report.ended = new Date().toISOString(); await persist();
  console.log(JSON.stringify(report.aggregate));
}

export function verify(report: Wire): Wire {
  assert.equal(report.marker, E216_MARKER); assert.equal(report.eligible, false); assert.equal(report.hostFenceProved, false);
  const identities = report.identities as Identities;
  const detours = (report.detours as Wire[]).map(row => ({ dwell: row.dwell, summary: summarizeDetour(row.trace as Wire, identities, String((row.trace as Wire).signature)) }));
  // Later analyzer fields extend a retained summary; every retained field must still match.
  for (const [index, row] of detours.entries()) {
    const retained = (report.detours as Wire[])[index]!.summary as Wire;
    for (const key of Object.keys(retained)) assert.deepEqual((row.summary as Wire)[key], retained[key], `retained detour field ${key} differs`);
  }
  const toggles = (report.toggles as Wire[]).map(row => ({ ...row.summary as Wire, kind: row.kind, delay: row.delay }) as Wire);
  const coalescing = ['mute', 'scratchStep'].flatMap(kind => [-1, 0, 1, 5, 20, 100].map(delay => {
    const rows = toggles.filter(t => t.kind === kind && t.delay === delay);
    return { kind, delay, trials: rows.length, deliveredChanges: rows.map(r => r.deliveredChanges), coalesced: rows.filter(r => r.coalesced).length };
  })).filter(row => row.trials > 0);
  const controls = ((report.controls ?? []) as Wire[]).map(row => ({ leg: row.leg, events: row.projectNameEvents, firstDeliveryUs: row.firstDeliveryUs }));
  const spins = ((report.spins ?? []) as Wire[]).map(row => ({ label: row.label, ...row.summary as Wire }));
  const composition = ((report.composition ?? []) as Wire[]).map(row => ({ finalSide: row.finalSide, projectNameValues: row.projectNameValues }));
  return { stoppedReason: report.stoppedReason ?? null, controls, composition, detours: aggregateDetours(detours), coalescing, spins,
    eligible: false, hostFenceProved: false };
}

async function main(): Promise<void> {
  const [mode, ...args] = process.argv.slice(2);
  if (mode === 'verify') { console.log(JSON.stringify(verify(await readJson(args[0]!)), null, 1)); return; }
  await bridge.connect();
  if (mode === 'actions') {
    const filters = args.length ? args : ['project', 'tab'];
    const seen = new Map<string, Wire>();
    for (const filter of filters) for (const action of (await request('app.actions', { filter })).actions as Wire[]) seen.set(String(action.id), action);
    console.log(JSON.stringify([...seen.values()], null, 1));
  } else if (mode === 'status') {
    console.log(JSON.stringify({ status: await delivery('deliveryStatus'), tracks: (await request('track.list')).tracks }, null, 1));
  } else if (mode === 'switch') {
    const before = String((await delivery('deliveryStatus')).signature);
    assert(args[0]); const { trace, final } = await runScript([{ op: 'invoke', id: args[0] }]);
    console.log(JSON.stringify({ before, final, events: (trace.events as Wire[]).filter(e => e.kind === 'value') }, null, 1));
  } else if (mode === 'prepare') {
    assert(args[0] === 'P' || args[0] === 'Q'); assert(args[1]); await prepare(args[0], args[1]);
  } else if (mode === 'focused') {
    assert(args[0] && args[1] && args[2] && args[3]); await focused(args[0], args[1], args[2], args[3], Number(args[4] ?? 30));
  } else if (mode === 'trial') {
    assert(args[0] && args[1] && args[2] && args[3]); await trial(args[0], args[1], args[2], args[3], Number(args[4] ?? 5));
  } else throw new Error('usage: actions|status|switch|prepare|trial|verify');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  void main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => bridge.disconnect());
