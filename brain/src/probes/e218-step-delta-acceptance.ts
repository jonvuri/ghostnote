/**
 * E218 live driver: guarded shadow acquisitions during P→Q→P project detours.
 * Each trial ends with an independent settled exact authority read after return
 * to P. Research only; nothing becomes eligible. Prepare P and Q with the E216
 * driver first.
 *
 * Modes:
 *   prepare-canary <state.json>     write a P witness clip at track 0, slot 1 (P must be shown)
 *   run <state.json> <out.json> <arm> [reps]
 *        arms: control, same-callback, separate-callback, exact-same-callback, window-same-callback, window-exact, native
 *   verify <out.json>               recompute every retained trial summary
 */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { BridgeClient } from '../client.js';
import { parseSignature } from './e216-delivery-coherence-lib.js';
import type { Identities } from './e216-delivery-coherence-lib.js';
import { E218_MARKER, ROOT_MARKER, SHADOW_MARKER, aggregateArm, checkReport, classifyTrial } from './e218-step-delta-acceptance-lib.js';

type Wire = Record<string, unknown>;
const NEXT = 'Select Next Project', PREV = 'Select Previous Project';
const TARGET = { trackIndex: 0, row: 0 }, CANARY = { canaryTrackIndex: 0, canaryRow: 1 };
const POLL_MS = 20, PHASE_LIMIT_MS = 20_000, SETTLE_AFTER_DETOUR_MS = 1_500, NATIVE_RETURN_LIMIT_MS = 30_000;
const bridge = new BridgeClient();
const wait = async (ms: number): Promise<void> => await new Promise(resolve => setTimeout(resolve, ms));
const request = async (method: string, params?: Wire): Promise<Wire> => await bridge.request(method, params, 30_000) as Wire;
const shadow = async (operation: string, params: Wire = {}): Promise<Wire> => await request('cache.shadow', { operation, ...params });
const readJson = async (path: string): Promise<Wire> => JSON.parse(await readFile(path, 'utf8')) as Wire;
const save = async (path: string, value: Wire): Promise<void> => await writeFile(path, JSON.stringify(value, null, 1) + '\n');
const shown = async (): Promise<string> => parseSignature(String((await shadow('deliveryStatus')).signature)).name;

/** Strip bulky diagnostics. Keep every field that classification and verification read. */
function keep(result: Wire | undefined): Wire | undefined {
  if (!result) return undefined;
  const fields = ['phase', 'reason', 'comparison', 'terminal', 'authorityAvailable', 'stepWindowConfirmed', 'canaryPhase',
    'authorityNotes', 'diagnosticSnapshot', 'historicalSnapshot', 'complete', 'eligible', 'stepWindowCallbacks',
    'stepWindowConfirmations', 'stepWindowChanges', 'stepWindowRefusals', 'retainedStepWindowDiscards', 'fallbackReason'];
  return Object.fromEntries(fields.filter(f => f in result).map(f => [f, result[f]]));
}

/** Run injected work once after a chosen number of shadow operations. */
class Injector {
  ops = 0; fired = false; firedAtOp: number | null = null; firedAfter: Wire | null = null; last: Wire = {};
  constructor(readonly atOp: number | null, readonly script: Wire[] | null, readonly targetStage: string | null = null) {}
  async tick(operation = '', result: Wire = {}): Promise<void> {
    this.ops++;
    this.last = stageOf(operation, result);
    if ((this.atOp !== null && this.ops >= this.atOp) || (this.targetStage !== null && this.last.stage === this.targetStage)) await this.fire();
  }
  /** A detour that the route did not reach still runs after it, so retained output meets it. */
  async fire(): Promise<void> {
    if (this.fired || this.script === null) return;
    this.fired = true; this.firedAtOp = this.ops; this.firedAfter = this.last;
    await shadow('deliveryRun', { script: this.script });
  }
}

async function op(injector: Injector, operation: string, params: Wire = {}): Promise<Wire> {
  const result = await shadow(operation, params); await injector.tick(operation, result); return result;
}

/** The acquisition stage that the last operation reported before an injection. */
function stageOf(operation: string, result: Wire): Wire {
  const progress = result.scanProgressCoordinates as number | undefined, total = result.scanTotalCoordinates as number | undefined;
  const stage = operation === 'exactStart' || operation === 'exactPoll' ? `exact-${String(result.phase)}`
    : operation === 'acquire' || operation === 'poll' ? `binding-${String(result.canaryPhase ?? 'unknown')}-${String(result.phase)}`
    : operation === 'compareStart' || operation === 'comparePoll'
      ? result.terminal === true || (result.comparison !== undefined && result.comparison !== 'pending') ? 'compare-terminal'
        : progress === undefined || progress === 0 ? 'compare-before-reads' : progress < (total ?? Infinity) ? 'compare-reading' : 'compare-confirming'
      : operation;
  return { operation, stage };
}

async function shadowRoute(injector: Injector): Promise<Wire> {
  const row: Wire = {};
  const acquired = await op(injector, 'acquire', { ...TARGET, ...CANARY });
  row.acquire = keep(acquired);
  if (acquired.poolDecision === 'refused') { row.refusal = String(acquired.reason); return row; }
  const index = Number(acquired.index); row.index = index;
  const started = performance.now();
  for (;;) {
    const status = await op(injector, 'poll', { index });
    const phase = String(status.phase);
    if ((phase === 'settled' || phase === 'complete') && status.canaryPhase === 'target') break;
    // A refusal is a fallback result without an index. A retired status is also terminal.
    if (status.index === undefined || phase === 'retired') {
      row.refusal = String(status.index === undefined ? status.reason : status.fallbackReason); row.poll = keep(status); return row;
    }
    if (performance.now() - started > PHASE_LIMIT_MS) { row.refusal = 'driver-binding-timeout'; row.poll = keep(status); return row; }
    await wait(POLL_MS);
  }
  await op(injector, 'reconcile', { index });
  let compare = await op(injector, 'compareStart', { index });
  const compareStarted = performance.now();
  while (compare.comparison === 'pending' && compare.terminal !== true) {
    if (performance.now() - compareStarted > 45_000) { row.refusal = 'driver-compare-timeout'; break; }
    await wait(POLL_MS); compare = await op(injector, 'comparePoll');
  }
  row.compare = keep(compare);
  row.status = keep(await op(injector, 'status', { index }));
  return row;
}

async function exactRoute(injector: Injector): Promise<Wire> {
  let result = await op(injector, 'exactStart', TARGET);
  const started = performance.now();
  while (result.terminal !== true) {
    if (performance.now() - started > 45_000) { await shadow('exactCancel', { reason: 'driver-timeout' }); return { refusal: 'driver-exact-timeout' }; }
    await wait(POLL_MS); result = await op(injector, 'exactPoll');
  }
  return keep(result)!;
}

async function independentAuthority(): Promise<Wire> {
  return await exactRoute(new Injector(null, null));
}

/** Wait until the shown project stays the same for three seconds. */
async function settledOn(name: string): Promise<void> {
  const started = performance.now(); let stableSince = performance.now();
  for (;;) {
    if (await shown() !== name) stableSince = performance.now();
    if (performance.now() - stableSince >= 3_000) return;
    assert(performance.now() - started < NATIVE_RETURN_LIMIT_MS, 'P did not settle');
    await wait(250);
  }
}

async function waitForRun(): Promise<void> {
  const started = performance.now();
  for (;;) { if (Number((await shadow('deliveryStatus')).runRemaining) === 0) return;
    assert(performance.now() - started < 20_000, 'delivery run did not finish'); await wait(POLL_MS); }
}

async function measurePing(): Promise<number> {
  const samples: number[] = [];
  for (let n = 0; n < 20; n++) { const start = performance.now(); await request('ping'); samples.push(performance.now() - start); }
  samples.sort((a, b) => a - b);
  const p95 = samples[Math.ceil(samples.length * 0.95) - 1]!;
  await shadow('ping', { p95Ms: p95 });
  return p95;
}

function detourScript(arm: string, dwell: number): Wire[] | null {
  if (['same-callback', 'exact-same-callback', 'window-same-callback', 'window-exact'].includes(arm)) return [{ op: 'invoke', id: NEXT }, { op: 'invoke', id: PREV, delayMs: -1 }];
  if (arm === 'separate-callback') return [{ op: 'invoke', id: NEXT }, { op: 'invoke', id: PREV, delayMs: dwell }];
  return null;
}

async function prepareCanary(statePath: string): Promise<void> {
  const state = await readJson(statePath); const P = state.P as Wire;
  assert.equal(await shown(), P.name, 'show P before preparing its canary');
  const slot = await request('slot.status', { trackIndex: 0, slotIndex: 1 });
  if (slot.hasContent !== true) { await request('clip.create', { trackIndex: 0, slotIndex: 1, lengthBeats: 4 }); await wait(500); }
  await request('slot.select', { trackIndex: 0, slotIndex: 1 }); await wait(800);
  await shadow('deliveryRun', { script: [{ op: 'writeWitness', side: 'P', expectedProject: P.name, expectedCursorChannelId: P.cursor }] });
  await waitForRun(); await wait(500);
  const written = parseSignature(String((await shadow('deliveryStatus')).signature));
  assert.equal(written.wP, 'NNNN', 'canary witness was not written');
  await request('slot.select', { trackIndex: 0, slotIndex: 0 }); await wait(800);
  state.PCanary = { trackIndex: 0, slotIndex: 1, createdClip: slot.hasContent !== true, at: new Date().toISOString() };
  await save(statePath, state);
  console.log(JSON.stringify(state.PCanary));
}

async function run(statePath: string, out: string, arm: string, reps: number): Promise<void> {
  const state = await readJson(statePath); const identities = { P: state.P, Q: state.Q } as Identities;
  assert(identities.P && identities.Q && state.PCanary, 'prepare P, Q, and the P canary first');
  assert.equal(await shown(), identities.P.name, 'trials start on P');
  const info = await shadow('info'), root = await shadow('rootSnapshot');
  assert.equal(info.instrumentationRevision, SHADOW_MARKER); assert.equal(root.instrumentationRevision, ROOT_MARKER);
  const pingP95Ms = await measurePing();
  const report: Wire = { marker: E218_MARKER, arm, reps, researchOnly: true, complete: false, eligible: false, hostFenceProved: false,
    started: new Date().toISOString(), identities, pingP95Ms, shadowMarker: SHADOW_MARKER, rootMarker: ROOT_MARKER,
    namedAssumptions: ['D26 complete step-data delivery for covered cells', 'E217 later-callback ordering rule'],
    inventory: keep(await shadow('inventory')), trials: [], limitations: [
      'controller-issued project actions, except the native arm where the user switches tabs',
      'one witness clip per project; slot inventory is outside step coverage and refuses',
      'the independent authority is the same extension reading through its exact route after return to P',
    ] };
  const persist = async (): Promise<void> => await save(out, report);
  const stop = async (reason: string): Promise<never> => { report.stoppedReason = reason; report.ended = new Date().toISOString(); await persist(); throw new Error(reason); };
  await persist();
  const deadline = arm === 'native' ? performance.now() + reps * 1_000 : Infinity;
  for (let rep = 0; arm === 'native' ? performance.now() < deadline : rep < reps; rep++) {
    const dwell = [0, 20, 100][rep % 3]!;
    const script = detourScript(arm, dwell);
    // Spread injection across binding, membership, authority, settlement, and result stages.
    // Window arms fire when the last operation reports an open read window.
    const targetStage = arm === 'window-same-callback' ? ['compare-reading', 'compare-confirming'][rep % 2]!
      : arm === 'window-exact' ? ['exact-scanning', 'exact-confirming'][rep % 2]! : null;
    const atOp = script && !targetStage ? 1 + Math.floor(Math.random() * (arm === 'exact-same-callback' ? 60 : 160)) : null;
    const injector = new Injector(atOp, script, targetStage);
    await shadow('deliveryClear'); await shadow('deliveryStart');
    const row: Wire = { rep, arm, dwell: arm === 'separate-callback' ? dwell : null, atOp, targetStage };
    const route = arm === 'exact-same-callback' || arm === 'window-exact' ? { exact: await exactRoute(injector) } : await shadowRoute(injector);
    Object.assign(row, route);
    row.ops = injector.ops; row.firedDuringRoute = injector.fired;
    await injector.fire();
    row.injected = injector.fired; row.firedAtOp = injector.firedAtOp; row.firedAfter = injector.firedAfter;
    await waitForRun();
    await shadow('deliveryStop');
    const trace = await shadow('deliveryTrace');
    const values = (trace.events as Wire[]).filter(e => e.kind === 'value' && e.name === 'projectName');
    row.qProjectNameEvents = values.filter(e => e.value === identities.Q.name).length;
    row.stepEvents = (trace.events as Wire[]).filter(e => e.kind === 'stepData').length;
    await wait(SETTLE_AFTER_DETOUR_MS);
    let endpoint = await shown();
    if (arm === 'native') {
      const started = performance.now();
      while (endpoint !== identities.P.name && performance.now() - started < NATIVE_RETURN_LIMIT_MS) { await wait(250); endpoint = await shown(); }
      if (endpoint === identities.P.name) { await settledOn(identities.P.name); endpoint = await shown(); }
    }
    row.endpoint = endpoint === identities.P.name ? 'P' : endpoint === identities.Q.name ? 'Q' : 'other';
    if (row.endpoint !== 'P') { (report.trials as Wire[]).push(row); await stop(`trial ${rep} endpoint ${endpoint}`); }
    // Retained output after the detour must be discarded or still equal the P authority.
    if (row.index !== undefined) row.statusAfter = keep(await shadow('status', { index: row.index }));
    if (row.exact !== undefined) row.exactAfter = keep(await shadow('exactPoll'));
    row.independent = await independentAuthority();
    if (arm === 'native') {
      // The user can still be switching. The independent read must run on a settled P endpoint.
      const attempts: Wire[] = [];
      while ((row.independent as Wire).reason === 'automatic-identity-invalidated' && attempts.length < 3) {
        attempts.push(row.independent as Wire);
        await settledOn(identities.P.name);
        row.independent = await independentAuthority();
      }
      row.independentSettleAttempts = attempts;
    }
    row.summary = classifyTrial(row);
    (report.trials as Wire[]).push(row); await persist();
    const summary = row.summary as Wire;
    if (summary.independentOk !== true) await stop(`trial ${rep} independent authority read failed`);
    if (Number(summary.foreignOutputs) > 0 || Number(summary.outputsDifferingFromAuthority) > 0)
      await stop(`trial ${rep} published foreign or differing content`);
    console.log(JSON.stringify({ rep, atOp, fired: injector.firedAtOp, q: row.qProjectNameEvents, steps: row.stepEvents, ...summary }));
  }
  report.aggregate = aggregateArm(report.trials as Wire[]);
  report.finalInfo = keep(await shadow('info'));
  report.ended = new Date().toISOString(); await persist();
  console.log(JSON.stringify(report.aggregate, null, 1));
}

export function verify(report: Wire): Wire {
  checkReport(report);
  const trials = report.trials as Wire[];
  for (const row of trials) if (row.summary) {
    const live = classifyTrial(row), retained = row.summary as Wire;
    for (const key of Object.keys(retained)) assert.deepEqual(live[key], retained[key], `trial ${String(row.rep)} field ${key} differs`);
  }
  const aggregate = aggregateArm(trials.filter(r => r.summary));
  if (report.aggregate) assert.deepEqual(aggregate, report.aggregate, 'retained aggregate differs');
  return { arm: report.arm, stoppedReason: report.stoppedReason ?? null, inventoryReason: (report.inventory as Wire | undefined)?.reason ?? null, ...aggregate };
}

async function main(): Promise<void> {
  const [mode, ...args] = process.argv.slice(2);
  if (mode === 'verify') { for (const path of args) console.log(JSON.stringify(verify(await readJson(path)))); return; }
  await bridge.connect();
  if (mode === 'prepare-canary') { assert(args[0]); await prepareCanary(args[0]); }
  else if (mode === 'run') { assert(args[0] && args[1] && args[2]); await run(args[0], args[1], args[2], Number(args[3] ?? 10)); }
  else throw new Error('usage: prepare-canary|run|verify');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  void main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => bridge.disconnect());
