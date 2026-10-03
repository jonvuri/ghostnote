import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { E217_MARKER, aggregateOrdering, batches, compactTrace, sortedRecords, summarizeOrdering } from './e217-callback-ordering-lib.js';

type Wire = Record<string, unknown>;
let seq = 0;
const step = (us: number): Wire => ({ seq: ++seq, us, kind: 'stepData', x: 0, y: 0, state: 0 });
const tick = (us: number, steps: number): Wire => ({ seq: ++seq, us, kind: 'tick', steps, start: '' });
const confirm = (us: number, t: Wire, steps: number, depth = 1): Wire => ({ seq: ++seq, us, kind: 'confirm', tickSeq: t.seq, tickSteps: t.steps, steps, depth });
const rpc = (us: number): Wire => ({ seq: ++seq, us, kind: 'rpc', steps: 0 });
function trace(records: Wire[]): Wire {
  return { orderingMarker: E217_MARKER, eventsDropped: 0, ticksDropped: 0, commands: [],
    events: records.filter(r => r.kind === 'stepData'), ticks: records.filter(r => r.kind !== 'stepData') };
}

test('a confirmation after the batch remainder passes', () => {
  seq = 0; const records: Wire[] = [];
  for (let n = 0; n < 8; n++) records.push(step(1_000 + n));
  const t = tick(1_010, 8); records.push(t);
  for (let n = 0; n < 8; n++) records.push(step(1_030 + n * 5));
  records.push(confirm(1_200, t, 16), confirm(1_300, t, 16, 2));
  const summary = summarizeOrdering(trace(records));
  assert.equal(summary.batches, 1); assert.equal(summary.midBatchTicks, 1); assert.equal(summary.afterBatch, 1);
  assert.equal(aggregateOrdering([{ summary }]).verdict, 'pass');
});

test('a confirmation inside the batch fails the rule, and an unchanged count is the admitted counterexample', () => {
  seq = 0; const records: Wire[] = [step(1_000)];
  const t = tick(1_010, 1); records.push(t, confirm(1_020, t, 1), rpc(1_025), step(1_040));
  const summary = summarizeOrdering(trace(records));
  assert.equal(summary.insideBatch, 1); assert.equal(summary.unchangedInside, 1); assert.equal(summary.rpcInsideBatch, 1);
  assert.equal(aggregateOrdering([{ summary }]).verdict, 'fail');
});

test('a missing confirmation fails, and no mid-batch tick gives no evidence', () => {
  seq = 0; const a = [step(1_000), tick(1_010, 1), step(1_020)];
  assert.equal(aggregateOrdering([{ summary: summarizeOrdering(trace(a)) }]).verdict, 'fail');
  seq = 0; const t = tick(500, 0); const b = [t, confirm(600, t, 0), step(1_000), step(1_010)];
  assert.equal(aggregateOrdering([{ summary: summarizeOrdering(trace(b)) }]).verdict, 'no-mid-batch-evidence');
});

test('step callbacks farther apart than the gap form separate batches', () => {
  seq = 0; const records = [step(0), step(100), step(30_000), step(30_050)];
  assert.deepEqual(batches(sortedRecords(trace(records))).map(b => b.steps), [2, 2]);
});

test('compaction keeps every record that the summary needs', () => {
  seq = 0; const far = tick(100_000, 0); const records: Wire[] = [far, confirm(100_100, far, 0), step(1_000)];
  const t = tick(1_010, 1); records.push(t, step(1_040), confirm(1_200, t, 2), rpc(50_000));
  const full = trace(records), compact = compactTrace(full);
  assert.equal((compact.ticks as Wire[]).length, 2);
  const a = summarizeOrdering(compact), b = summarizeOrdering(full);
  for (const key of ['batches', 'midBatchTicks', 'afterBatch', 'insideBatch', 'rpcInsideBatch']) assert.deepEqual(a[key], b[key]);
});

test('batch inference finds the E216 mid-batch foreign ticks', async () => {
  const report = JSON.parse(await readFile(new URL('../../../context/evidence/data/e216-delivery-coherence/focused-1.json', import.meta.url), 'utf8')) as Wire;
  let midBatch = 0;
  for (const detour of report.detours as Wire[]) {
    const summary = summarizeOrdering({ ...detour.trace as Wire, orderingMarker: E217_MARKER });
    midBatch += Number(summary.midBatchTicks);
    assert.equal(summary.afterBatch, 0); // E216 scheduled no confirmations.
  }
  assert.equal(midBatch, 11);
});

test('v2 classifies RPC callbacks inside a batch like ticks', () => {
  seq = 0; const records: Wire[] = [step(1_000)];
  const call = rpc(1_010); records.push(call, step(1_040), confirm(1_200, { ...call, steps: 0 }, 2));
  const summary = summarizeOrdering(trace(records));
  assert.equal(summary.rpcMidBatch, 1); assert.equal(summary.rpcAfterBatch, 1); assert.equal(summary.afterBatch, 1);
  const v1 = summarizeOrdering({ ...trace(records), orderingMarker: 'e217-callback-ordering-v1' });
  assert.equal(v1.midBatchTicks, 0); assert.equal(v1.rpcInsideBatch, 1);
});
