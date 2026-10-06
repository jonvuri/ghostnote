import assert from 'node:assert/strict';
import test from 'node:test';

import { CACHE_SCALE_LIMITS, evaluateCachePolicy, type CachePolicyInput } from './phase8e-cache-policy.js';

const healthy: CachePolicyInput = {
  generationValid: true,
  replayComplete: true,
  authorityAvailable: true,
  viewSteps: CACHE_SCALE_LIMITS.viewSteps,
  activeObservers: CACHE_SCALE_LIMITS.activeObservers,
  occupiedCoordinates: CACHE_SCALE_LIMITS.occupiedCoordinatesPerClip,
  pendingDirtyCoordinates: CACHE_SCALE_LIMITS.pendingDirtyCoordinates,
  estimatedBytes: CACHE_SCALE_LIMITS.estimatedBytes,
  cacheConstructionMs: CACHE_SCALE_LIMITS.cacheConstructionMs,
  replayMs: CACHE_SCALE_LIMITS.replayMs,
  rebuildMs: CACHE_SCALE_LIMITS.rebuildMs,
  pingP95Ms: CACHE_SCALE_LIMITS.pingP95Ms,
};

test('cache policy admits values at every selected limit', () => {
  assert.deepEqual(evaluateCachePolicy(healthy), {
    health: 'complete',
    mode: 'cache',
    reason: 'within-budget',
    shedCallbacks: false,
    scheduleRebuild: false,
  });
});

for (const [field, reason] of [
  ['viewSteps', 'view-width-limit'],
  ['activeObservers', 'observer-working-set-limit'],
  ['occupiedCoordinates', 'clip-density-limit'],
  ['estimatedBytes', 'memory-budget'],
  ['cacheConstructionMs', 'cache-construction-budget'],
  ['pingP95Ms', 'tail-latency-budget'],
] as const) {
  test(`cache policy uses an exact fallback above ${field}`, () => {
    const decision = evaluateCachePolicy({ ...healthy, [field]: healthy[field] + 1 });
    assert.equal(decision.mode, 'exact-fallback');
    assert.equal(decision.health, 'invalid');
    assert.equal(decision.reason, reason);
    assert.equal(decision.limit, healthy[field]);
  });
}

test('cache policy sheds dirty callbacks and schedules a rebuild', () => {
  const decision = evaluateCachePolicy({
    ...healthy,
    pendingDirtyCoordinates: CACHE_SCALE_LIMITS.pendingDirtyCoordinates + 1,
  });
  assert.equal(decision.mode, 'exact-fallback');
  assert.equal(decision.health, 'dirty');
  assert.equal(decision.reason, 'dirty-backpressure');
  assert.equal(decision.shedCallbacks, true);
  assert.equal(decision.scheduleRebuild, true);
});

test('cache policy keeps incomplete and slow lifecycle state private', () => {
  assert.deepEqual(
    evaluateCachePolicy({ ...healthy, replayComplete: false }),
    {
      health: 'warming',
      mode: 'exact-fallback',
      reason: 'replay-incomplete',
      shedCallbacks: false,
      scheduleRebuild: false,
    },
  );
  const replay = evaluateCachePolicy({
    ...healthy, replayMs: CACHE_SCALE_LIMITS.replayMs + 1,
  });
  assert.equal(replay.mode, 'exact-fallback');
  assert.equal(replay.health, 'warming');
  assert.equal(replay.reason, 'replay-budget');
  const rebuild = evaluateCachePolicy({
    ...healthy, rebuildMs: CACHE_SCALE_LIMITS.rebuildMs + 1,
  });
  assert.equal(rebuild.mode, 'exact-fallback');
  assert.equal(rebuild.health, 'rebuilding');
  assert.equal(rebuild.reason, 'rebuild-budget');
  assert.equal(rebuild.scheduleRebuild, true);
});

test('cache policy refuses when neither cache nor exact authority is safe', () => {
  const decision = evaluateCachePolicy({
    ...healthy,
    authorityAvailable: false,
    generationValid: false,
  });
  assert.equal(decision.mode, 'refuse');
  assert.equal(decision.health, 'invalid');
  assert.equal(decision.reason, 'authority-unavailable');
});
