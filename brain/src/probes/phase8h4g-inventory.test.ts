/**
 * Offline time budget of the edit planner (8h4g, E247).
 *
 * A whole-clip velocity edit of every note at the reader limit (16,384 notes) planned in 12.0 s in E246, beside a
 * 31.6 s host write. 8h4g measured 1.2 s here and a 5.3 s live write (`phase8h4c-edit.ts worst`). The budget is
 * about three times the measured time, so a slower machine passes and a return to quadratic or repeated
 * whole-document work fails. The scaling check fails when 4x the notes costs more than 6x the time.
 * When a budget changes on purpose, update the performance ledger in the same session.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { planBench, wireSummary } from './phase8h4g-inventory.js';

const LARGEST_PLAN_MS = 4_000;

test('8h4g planner budget: a whole-clip edit of 16,384 notes plans within the offline budget, and scales linearly', async () => {
  const small = await planBench(4_096);
  const large = await planBench(16_384);
  assert.equal(large.route, 'whole-clip', JSON.stringify(large));
  assert.equal(large.code, undefined, JSON.stringify(large));
  const planMs = large.timing.planMs as number;
  assert.ok(planMs < LARGEST_PLAN_MS, `16,384-note plan took ${Math.round(planMs)} ms (budget ${LARGEST_PLAN_MS} ms)`);
  const ratio = planMs / Math.max(1, small.timing.planMs as number);
  assert.ok(ratio < 6, `4x the notes cost ${ratio.toFixed(1)}x the planning time`);
});

test('8i4 planner budget: sealing one claim on each of 4,096 notes plans within the budget, and scales linearly', async () => {
  // E253: 16,384 claims plan in about 6.3 s (5.8 s with helper bases before 8i4); the codec structure check of each
  // overlay is most of it. The seal adds about 10 percent.
  const small = await planBench(1_024, true, true);
  const large = await planBench(4_096, true, true);
  assert.equal(large.route, 'whole-clip', JSON.stringify(large));
  assert.equal(large.code, undefined, JSON.stringify(large));
  const planMs = large.timing.planMs as number;
  assert.ok(planMs < LARGEST_PLAN_MS, `4,096-claim plan took ${Math.round(planMs)} ms (budget ${LARGEST_PLAN_MS} ms)`);
  const ratio = planMs / Math.max(1, small.timing.planMs as number);
  assert.ok(ratio < 6, `4x the claims cost ${ratio.toFixed(1)}x the planning time`);
});

test('8h4g inventory: calls in flight together are one host turn', () => {
  const summary = wireSummary([
    { method: 'revision.get', sent: 0, received: 24 }, { method: 'track.list', sent: 0, received: 25 },
    { method: 'clip.read', sent: 25, received: 215 }, { method: 'batch.run', sent: 300, received: 324 },
  ]);
  assert.deepEqual({ turns: summary.turns, wireMs: summary.wireMs, clipReads: summary.clipReads, stages: summary.stages },
    { turns: 3, wireMs: 239, clipReads: 1, stages: 1 });
});
