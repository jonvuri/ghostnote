/**
 * E217 live driver: the 8g2b later-callback ordering rule. Each tick schedules
 * zero-delay confirmations. Same-callback P→Q→P detours create mid-batch ticks.
 * Research only; nothing becomes eligible. Use the E216 driver to prepare P and Q.
 *
 * Modes:
 *   run <state.json> <out.json> <nextId> <prevId> [reps]
 *   verify <out.json>               recompute summaries from retained traces
 */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { BridgeClient } from '../client.js';
import { classifyTick, parseSignature } from './e216-delivery-coherence-lib.js';
import type { Identities } from './e216-delivery-coherence-lib.js';
import { E217_MARKER, E217_MARKERS, aggregateOrdering, compactTrace, summarizeOrdering } from './e217-callback-ordering-lib.js';

type Wire = Record<string, unknown>;
const SETTLE_MS = 600, FLOOD_MS = 400, FLOOD_CONCURRENCY = 4, SEPARATE_REPS = 20;
const bridge = new BridgeClient();
const wait = async (ms: number): Promise<void> => await new Promise(resolve => setTimeout(resolve, ms));
const request = async (method: string, params?: Wire): Promise<Wire> => await bridge.request(method, params, 30_000) as Wire;
const delivery = async (operation: string, params: Wire = {}): Promise<Wire> => await request('cache.shadow', { operation, ...params });
const readJson = async (path: string): Promise<Wire> => JSON.parse(await readFile(path, 'utf8')) as Wire;
const save = async (path: string, value: Wire): Promise<void> => await writeFile(path, JSON.stringify(value, null, 1) + '\n');

/** Keep several bridge requests in flight so that RPC callbacks compete with delivery batches. */
async function flood(until: number): Promise<number> {
  let sent = 0;
  await Promise.all(Array.from({ length: FLOOD_CONCURRENCY }, async () => {
    while (performance.now() < until) { await delivery('deliveryPing'); sent++; }
  }));
  return sent;
}

async function runDetour(script: Wire[], withFlood: boolean): Promise<{ trace: Wire; final: string; pings: number }> {
  await delivery('deliveryClear'); await delivery('deliveryStart', { ordering: true }); await wait(150);
  await delivery('deliveryRun', { script });
  const pings = withFlood ? await flood(performance.now() + FLOOD_MS) : 0;
  const start = performance.now();
  for (;;) { const status = await delivery('deliveryStatus'); if (Number(status.runRemaining) === 0) break;
    assert(performance.now() - start < 20_000, 'delivery run did not finish'); await wait(20); }
  await wait(SETTLE_MS);
  await delivery('deliveryStop');
  const trace = await delivery('deliveryTrace');
  assert.equal(trace.orderingMarker, E217_MARKER); assert.equal(trace.ordering, true);
  assert.equal(trace.runError, '', `run error: ${String(trace.runError)}`);
  return { trace, final: String(trace.signature), pings };
}

async function run(statePath: string, out: string, next: string, prev: string, reps: number): Promise<void> {
  const state = await readJson(statePath); const identities = { P: state.P, Q: state.Q } as Identities;
  assert(identities.P && identities.Q, 'prepare both P and Q first');
  const initial = String((await delivery('deliveryStatus')).signature);
  assert.equal(classifyTick(parseSignature(initial), identities).coherent, true, `run must start coherent on P: ${initial}`);
  const report: Wire = { marker: E217_MARKER, researchOnly: true, complete: false, eligible: false, hostFenceProved: false,
    started: new Date().toISOString(), identities, actions: { next, prev }, reps, separateReps: SEPARATE_REPS,
    floodMs: FLOOD_MS, floodConcurrency: FLOOD_CONCURRENCY, initialSignature: initial, runs: [], limitations: [
      'batches are inferred from step-callback time gaps; the host does not expose a batch boundary',
      'commands and observers share one controller process; neither is a host input fence',
      'one witness clip per project and controller-issued project actions only',
    ] };
  const persist = async (): Promise<void> => await save(out, report);
  const stop = async (reason: string): Promise<never> => { report.stoppedReason = reason; report.ended = new Date().toISOString(); await persist(); throw new Error(reason); };
  await persist();
  // Same-callback detours give mid-batch ticks. Separate-callback detours are a seen-batch control.
  const plan = [...Array.from({ length: reps }, (_, rep) => ({ kind: 'same-callback', rep, flood: rep % 2 === 0 })),
    ...Array.from({ length: SEPARATE_REPS }, (_, rep) => ({ kind: 'separate-callback', rep, flood: rep % 2 === 0 }))];
  for (const item of plan) {
    const script = [{ op: 'mark', label: `${item.kind} rep=${item.rep}` }, { op: 'invoke', id: next, delayMs: -1 },
      { op: 'invoke', id: prev, delayMs: item.kind === 'same-callback' ? -1 : 0 }];
    const { trace, final, pings } = await runDetour(script, item.flood);
    // Summaries come from the retained compact trace, so verification recomputes them exactly.
    const compact = compactTrace(trace), summary = summarizeOrdering(compact);
    const endpoint = classifyTick(parseSignature(final), identities);
    (report.runs as Wire[]).push({ ...item, pings, finalProject: endpoint.project, finalCoherent: endpoint.coherent,
      summary: { ...summary, midBatch: undefined }, trace: compact });
    await persist();
    if (endpoint.project !== 'P' || !endpoint.coherent) await stop(`${item.kind} rep=${item.rep} ended at ${final}`);
  }
  report.aggregate = aggregateOrdering((report.runs as Wire[]).filter(r => r.kind === 'same-callback'));
  report.separateAggregate = aggregateOrdering((report.runs as Wire[]).filter(r => r.kind === 'separate-callback'));
  report.finalSignature = String((await delivery('deliveryStatus')).signature);
  report.ended = new Date().toISOString(); await persist();
  console.log(JSON.stringify(verify(report), null, 1));
}

/** Recompute every retained summary from its compacted trace. */
export function verify(report: Wire): Wire {
  assert(E217_MARKERS.includes(String(report.marker))); assert.equal(report.eligible, false); assert.equal(report.hostFenceProved, false);
  // Later analyzer fields extend a retained aggregate; every retained field must still match.
  const same = (live: Wire, retained: Wire | undefined, label: string): void => {
    if (retained) for (const key of Object.keys(retained)) assert.deepEqual(live[key], retained[key], `${label} field ${key} differs`);
  };
  const runs = (report.runs as Wire[]).map(row => {
    const summary = summarizeOrdering(row.trace as Wire), retained = row.summary as Wire;
    for (const key of Object.keys(retained)) if (key !== 'midBatch')
      assert.deepEqual(summary[key], retained[key], `retained ${String(row.kind)} rep=${String(row.rep)} field ${key} differs`);
    return { ...row, summary } as Wire;
  });
  const sameCallback = aggregateOrdering(runs.filter(r => r.kind === 'same-callback'));
  const separate = aggregateOrdering(runs.filter(r => r.kind === 'separate-callback'));
  same(sameCallback, report.aggregate as Wire | undefined, 'retained aggregate');
  same(separate, report.separateAggregate as Wire | undefined, 'retained separate aggregate');
  const withFlood = aggregateOrdering(runs.filter(r => r.kind === 'same-callback' && r.flood === true));
  const counterexamples = runs.flatMap(r => ((r.summary as Wire).midBatch as Wire[])
    .filter(t => t.outcome !== 'after-batch').map(t => ({ kind: r.kind, rep: r.rep, ...t })));
  return { stoppedReason: report.stoppedReason ?? null, sameCallback, separateCallback: separate,
    sameCallbackWithFlood: withFlood, counterexamples, eligible: false, hostFenceProved: false };
}

async function main(): Promise<void> {
  const [mode, ...args] = process.argv.slice(2);
  if (mode === 'verify') { console.log(JSON.stringify(verify(await readJson(args[0]!)), null, 1)); return; }
  await bridge.connect();
  if (mode === 'run') {
    assert(args[0] && args[1] && args[2] && args[3]); await run(args[0], args[1], args[2], args[3], Number(args[4] ?? 100));
  } else throw new Error('usage: run|verify');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  void main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => bridge.disconnect());
