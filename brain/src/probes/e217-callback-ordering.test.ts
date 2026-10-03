import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { verify } from './e217-callback-ordering.js';

type Wire = Record<string, unknown>;
const data = new URL('../../../context/evidence/data/e217-callback-ordering/', import.meta.url);
const load = async (name: string): Promise<Wire> => JSON.parse(await readFile(new URL(name, data), 'utf8')) as Wire;

test('E217 run 1 retains a passing ordering rule for 33 mid-batch ticks', async () => {
  const summary = verify(await load('run-1.json'));
  const same = summary.sameCallback as Wire;
  assert.equal(same.runs, 100); assert.equal(same.midBatchTicks, 33); assert.equal(same.afterBatch, 33);
  assert.equal(same.insideBatch, 0); assert.equal(same.missingConfirmation, 0); assert.equal(same.verdict, 'pass');
  assert.equal(same.rpcInsideBatch, 28);
  assert.equal((summary.separateCallback as Wire).verdict, 'no-mid-batch-evidence');
  assert.deepEqual(summary.counterexamples, []); assert.equal(summary.eligible, false);
});

test('E217 smoke run retains its single mid-batch tick', async () => {
  const summary = verify(await load('smoke.json'));
  assert.equal((summary.sameCallback as Wire).midBatchTicks, 1); assert.equal((summary.sameCallback as Wire).verdict, 'pass');
});
