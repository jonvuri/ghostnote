/**
 * E217 pure analysis: does a task scheduled from a mid-batch callback run after
 * the rest of that delivery batch? Research only; these summaries are not host fences.
 */
import assert from 'node:assert/strict';

type Wire = Record<string, unknown>;
export const E217_MARKER = 'e217-callback-ordering-v2';
/** v1 confirms from ticks only. v2 also confirms from bridge RPC callbacks. */
export const E217_MARKERS = ['e217-callback-ordering-v1', E217_MARKER];
/** Step callbacks closer than this belong to one apparent batch. Batches are about 23 ms apart. */
export const BATCH_GAP_US = 2_000;
/** Retained context around each batch. */
export const CONTEXT_US = 3_000;

const seq = (r: Wire): number => Number(r.seq);
const us = (r: Wire): number => Number(r.us);

export function sortedRecords(trace: Wire): Wire[] {
  const all = [...trace.events as Wire[], ...trace.ticks as Wire[], ...trace.commands as Wire[]];
  return all.sort((a, b) => seq(a) - seq(b));
}

export interface Batch { firstSeq: number; lastSeq: number; firstUs: number; lastUs: number; steps: number }

/** Group step callbacks into apparent batches by time gap. Other records do not split a batch. */
export function batches(records: Wire[]): Batch[] {
  const result: Batch[] = [];
  for (const step of records.filter(r => r.kind === 'stepData')) {
    const last = result.at(-1);
    if (last && us(step) - last.lastUs <= BATCH_GAP_US) { last.lastSeq = seq(step); last.lastUs = us(step); last.steps++; }
    else result.push({ firstSeq: seq(step), lastSeq: seq(step), firstUs: us(step), lastUs: us(step), steps: 1 });
  }
  return result;
}

/**
 * Classify every tick that runs strictly inside a batch. The rule passes for a
 * tick when its depth-1 confirmation runs after the last step callback of the
 * batch. A confirmation inside the batch fails the rule, even if its count changed.
 */
export function summarizeOrdering(trace: Wire): Wire {
  assert(E217_MARKERS.includes(String(trace.orderingMarker)), `unknown ordering marker ${String(trace.orderingMarker)}`);
  const records = sortedRecords(trace), found = batches(records);
  const confirms = new Map<string, Wire>();
  for (const r of records) if (r.kind === 'confirm') confirms.set(`${String(r.tickSeq)}:${String(r.depth)}`, r);
  const midBatch: Wire[] = [];
  let rpcInsideBatch = 0;
  // v2 RPC records schedule confirmations too, so they are classified like ticks.
  const rpcConfirms = trace.orderingMarker !== 'e217-callback-ordering-v1';
  for (const [index, batch] of found.entries()) {
    const inside = records.filter(r => seq(r) > batch.firstSeq && seq(r) < batch.lastSeq);
    rpcInsideBatch += inside.filter(r => r.kind === 'rpc').length;
    for (const tick of inside.filter(r => r.kind === 'tick' || (rpcConfirms && r.kind === 'rpc'))) {
      const confirm = confirms.get(`${String(tick.seq)}:1`), second = confirms.get(`${String(tick.seq)}:2`);
      const stepsAfterTick = records.filter(r => r.kind === 'stepData' && seq(r) > seq(tick) && seq(r) <= batch.lastSeq).length;
      const outcome = !confirm ? 'missing-confirmation' : seq(confirm) > batch.lastSeq ? 'after-batch' : 'inside-batch';
      midBatch.push({ batch: index, source: tick.kind, tickSeq: tick.seq, stepsAfterTick, outcome,
        confirmChanged: confirm ? Number(confirm.steps) !== Number(tick.steps) : null,
        confirmLagUs: confirm ? us(confirm) - us(tick) : null,
        secondAfterBatch: second ? seq(second) > batch.lastSeq : null });
    }
  }
  const count = (o: string): number => midBatch.filter(t => t.outcome === o).length;
  // An unchanged count inside the batch is the counterexample that a guard would admit.
  const unchangedInside = midBatch.filter(t => t.outcome === 'inside-batch' && t.confirmChanged === false).length;
  return { batches: found.length, batchSteps: found.map(b => b.steps), midBatchTicks: midBatch.length,
    afterBatch: count('after-batch'), insideBatch: count('inside-batch'), missingConfirmation: count('missing-confirmation'),
    unchangedInside, rpcInsideBatch, rpcs: records.filter(r => r.kind === 'rpc').length,
    ticks: records.filter(r => r.kind === 'tick').length,
    rpcMidBatch: midBatch.filter(t => t.source === 'rpc').length,
    rpcAfterBatch: midBatch.filter(t => t.source === 'rpc' && t.outcome === 'after-batch').length, midBatch,
    eventsDropped: trace.eventsDropped, ticksDropped: trace.ticksDropped, hostFenceProved: false };
}

/** Keep commands, values, steps, and every record near a batch. Verification needs nothing else. */
export function compactTrace(trace: Wire): Wire {
  const records = sortedRecords(trace), found = batches(records);
  const near = (r: Wire): boolean => found.some(b => us(r) >= b.firstUs - CONTEXT_US && us(r) <= b.lastUs + CONTEXT_US);
  const keptTicks = new Set<number>();
  const ticks = (trace.ticks as Wire[]).filter(r => {
    if ((r.kind === 'tick' || r.kind === 'rpc') && near(r)) { keptTicks.add(seq(r)); return true; }
    return false;
  });
  const confirms = (trace.ticks as Wire[]).filter(r => r.kind === 'confirm' && keptTicks.has(Number(r.tickSeq)));
  const { events, ticks: _all, commands, ...status } = trace;
  return { ...status, compacted: true, contextUs: CONTEXT_US, events, commands,
    ticks: [...ticks, ...confirms].sort((a, b) => seq(a) - seq(b)) };
}

/** The rule passes only with mid-batch evidence and zero confirmations inside a batch. */
export function aggregateOrdering(rows: Wire[]): Wire {
  const sum = (key: string): number => rows.reduce((n, r) => n + Number((r.summary as Wire)[key]), 0);
  const midBatchTicks = sum('midBatchTicks'), insideBatch = sum('insideBatch'), missing = sum('missingConfirmation');
  const rpcInsideBatch = sum('rpcInsideBatch');
  const rpcSum = (key: string): number => rows.reduce((n, r) => n + Number((r.summary as Wire)[key] ?? 0), 0);
  const verdict = insideBatch > 0 || missing > 0 ? 'fail' : midBatchTicks === 0 ? 'no-mid-batch-evidence' : 'pass';
  return { runs: rows.length, batches: sum('batches'), midBatchTicks, afterBatch: sum('afterBatch'), insideBatch,
    missingConfirmation: missing, unchangedInside: sum('unchangedInside'), rpcInsideBatch, rpcs: sum('rpcs'),
    rpcMidBatch: rpcSum('rpcMidBatch'), rpcAfterBatch: rpcSum('rpcAfterBatch'),
    runsWithMidBatchTick: rows.filter(r => Number((r.summary as Wire).midBatchTicks) > 0).length,
    verdict, hostFenceProved: false };
}
