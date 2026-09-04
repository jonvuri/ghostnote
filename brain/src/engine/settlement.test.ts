import { test } from 'node:test';
import assert from 'node:assert/strict';

import { settleObservation, type SettlementProgress } from './settlement.js';

function clock() {
  let now = 0;
  return {
    now: () => now,
    wait: async (milliseconds: number) => { now += milliseconds; },
  };
}

const progress = (detail: string, generation: number): SettlementProgress => ({
  stage: 'remote-inventory', detail, generation,
});

test('5u settlement: delayed complete state succeeds without a real-time loop', async () => {
  const time = clock();
  let generation = 0;
  const result = await settleObservation(async () => {
    generation += 1;
    return generation === 3
      ? { complete: true as const, value: 'ready', progress: progress('complete', generation) }
      : { complete: false as const, progress: progress('partial pages', generation) };
  }, {
    ...time,
    policy: { deadlineMs: 1_000, retryMs: 100, maximumAttempts: 5 },
  });

  assert.equal(result.complete, true);
  assert.equal(result.complete ? result.value : undefined, 'ready');
  assert.deepEqual(result.report, {
    deadlineMs: 1_000, attempts: 3, elapsedMs: 200,
    lastProgress: progress('complete', 3), cause: 'complete',
  });
});

test('5u settlement: stale generations cannot hide a fresh complete generation', async () => {
  const time = clock();
  let generation = 7;
  const result = await settleObservation(async () => {
    generation += 1;
    return generation === 10
      ? { complete: true as const, value: generation, progress: progress('complete', generation) }
      : { complete: false as const, progress: progress('stale generation rejected', generation) };
  }, {
    ...time,
    policy: { deadlineMs: 500, retryMs: 50, maximumAttempts: 4 },
  });

  assert.equal(result.complete && result.value, 10);
  assert.equal(result.report.attempts, 3);
});

test('5u settlement: a never-complete observer reports its bound and last progress', async () => {
  const time = clock();
  let generation = 0;
  const result = await settleObservation(async () => {
    generation += 1;
    return { complete: false as const, progress: progress('page 1 of 4', generation) };
  }, {
    ...time,
    policy: { deadlineMs: 250, retryMs: 100, maximumAttempts: 10 },
  });

  assert.equal(result.complete, false);
  assert.equal(result.report.cause, 'deadline');
  assert.equal(result.report.elapsedMs, 250);
  assert.equal(result.report.attempts, 3);
  assert.deepEqual(result.report.lastProgress, progress('page 1 of 4', 3));
});

test('5u settlement: a completion after the deadline is rejected', async () => {
  const time = clock();
  const result = await settleObservation(async () => {
    await time.wait(110);
    return { complete: true as const, value: 'late', progress: progress('complete', 1) };
  }, {
    ...time,
    policy: { deadlineMs: 100, retryMs: 25, maximumAttempts: 3 },
  });

  assert.equal(result.complete, false);
  assert.equal(result.report.cause, 'deadline');
  assert.equal(result.report.elapsedMs, 110);
  assert.deepEqual(result.report.lastProgress, progress('complete', 1));
});

test('5u settlement: no progress stops at the attempt bound', async () => {
  const time = clock();
  const result = await settleObservation(async () => ({
    complete: false as const, progress: progress('no callbacks', 1),
  }), {
    ...time,
    policy: { deadlineMs: 5_000, retryMs: 100, maximumAttempts: 3 },
  });

  assert.equal(result.complete, false);
  assert.equal(result.report.cause, 'no-progress');
  assert.equal(result.report.attempts, 3);
  assert.equal(result.report.elapsedMs, 200);
});

test('5u settlement: advancing observations stop at the attempt limit', async () => {
  const time = clock();
  let generation = 0;
  const result = await settleObservation(async () => {
    generation += 1;
    return {
      complete: false as const,
      progress: progress(`page ${generation} of 4`, generation),
    };
  }, {
    ...time,
    policy: { deadlineMs: 5_000, retryMs: 100, maximumAttempts: 3 },
  });

  assert.equal(result.complete, false);
  assert.equal(result.report.cause, 'attempt-limit');
  assert.equal(result.report.attempts, 3);
  assert.deepEqual(result.report.lastProgress, progress('page 3 of 4', 3));
});

test('5u settlement: cancellation stops before the next generation', async () => {
  const time = clock();
  const controller = new AbortController();
  let attempts = 0;
  await assert.rejects(settleObservation(async () => {
    attempts += 1;
    controller.abort(new Error('cancelled by test'));
    return { complete: false as const, progress: progress('partial', attempts) };
  }, {
    ...time,
    throwIfCancelled: () => controller.signal.throwIfAborted(),
  }), /cancelled by test/);
  assert.equal(attempts, 1);
});
