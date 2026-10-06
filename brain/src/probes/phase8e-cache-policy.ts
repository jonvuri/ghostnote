/** E139 research limits for a resident clip cache. 8h3e moved them from the product contract. */
export const CACHE_SCALE_LIMITS = {
  viewSteps: 131_072,
  activeObservers: 512,
  occupiedCoordinatesPerClip: 2_048,
  pendingDirtyCoordinates: 2_048,
  estimatedBytes: 16 * 1024 * 1024,
  cacheConstructionMs: 50,
  replayMs: 5_000,
  rebuildMs: 40_000,
  pingP95Ms: 50,
} as const;

export type CacheHealth = 'complete' | 'warming' | 'dirty' | 'rebuilding' | 'invalid';
export type CacheReadMode = 'cache' | 'exact-fallback' | 'refuse';

export type CachePolicyReason =
  | 'within-budget'
  | 'generation-invalid'
  | 'replay-incomplete'
  | 'view-width-limit'
  | 'observer-working-set-limit'
  | 'clip-density-limit'
  | 'dirty-backpressure'
  | 'memory-budget'
  | 'cache-construction-budget'
  | 'replay-budget'
  | 'rebuild-budget'
  | 'tail-latency-budget'
  | 'authority-unavailable';

export interface CachePolicyInput {
  readonly generationValid: boolean;
  readonly replayComplete: boolean;
  readonly authorityAvailable: boolean;
  readonly viewSteps: number;
  readonly activeObservers: number;
  readonly occupiedCoordinates: number;
  readonly pendingDirtyCoordinates: number;
  readonly estimatedBytes: number;
  readonly cacheConstructionMs: number;
  readonly replayMs: number;
  readonly rebuildMs: number;
  readonly pingP95Ms: number;
}

export interface CachePolicyDecision {
  readonly health: CacheHealth;
  readonly mode: CacheReadMode;
  readonly reason: CachePolicyReason;
  readonly shedCallbacks: boolean;
  readonly scheduleRebuild: boolean;
  readonly measured?: number;
  readonly limit?: number;
}

function degrade(
  input: CachePolicyInput,
  health: Exclude<CacheHealth, 'complete'>,
  reason: Exclude<CachePolicyReason, 'within-budget' | 'authority-unavailable'>,
  measured?: number,
  limit?: number,
  shedCallbacks = false,
): CachePolicyDecision {
  if (!input.authorityAvailable) {
    return {
      health,
      mode: 'refuse',
      reason: 'authority-unavailable',
      shedCallbacks,
      scheduleRebuild: health !== 'invalid',
      ...(measured === undefined ? {} : { measured }),
      ...(limit === undefined ? {} : { limit }),
    };
  }
  return {
    health,
    mode: 'exact-fallback',
    reason,
    shedCallbacks,
    scheduleRebuild: health === 'dirty' || health === 'rebuilding',
    ...(measured === undefined ? {} : { measured }),
    ...(limit === undefined ? {} : { limit }),
  };
}

/** Select a complete cache read, an exact authority read, or an explicit refusal. */
export function evaluateCachePolicy(input: CachePolicyInput): CachePolicyDecision {
  if (!input.generationValid) return degrade(input, 'invalid', 'generation-invalid');
  if (!input.replayComplete) return degrade(input, 'warming', 'replay-incomplete');

  const limits: readonly [
    number,
    number,
    Exclude<CachePolicyReason, 'within-budget' | 'authority-unavailable'>,
  ][] = [
    [input.viewSteps, CACHE_SCALE_LIMITS.viewSteps, 'view-width-limit'],
    [input.activeObservers, CACHE_SCALE_LIMITS.activeObservers, 'observer-working-set-limit'],
    [input.occupiedCoordinates, CACHE_SCALE_LIMITS.occupiedCoordinatesPerClip,
      'clip-density-limit'],
    [input.estimatedBytes, CACHE_SCALE_LIMITS.estimatedBytes, 'memory-budget'],
    [input.cacheConstructionMs, CACHE_SCALE_LIMITS.cacheConstructionMs,
      'cache-construction-budget'],
    [input.pingP95Ms, CACHE_SCALE_LIMITS.pingP95Ms, 'tail-latency-budget'],
  ];
  for (const [measured, limit, reason] of limits) {
    if (measured > limit) return degrade(input, 'invalid', reason, measured, limit);
  }
  if (input.pendingDirtyCoordinates > CACHE_SCALE_LIMITS.pendingDirtyCoordinates) {
    return degrade(
      input,
      'dirty',
      'dirty-backpressure',
      input.pendingDirtyCoordinates,
      CACHE_SCALE_LIMITS.pendingDirtyCoordinates,
      true,
    );
  }
  if (input.replayMs > CACHE_SCALE_LIMITS.replayMs) {
    return degrade(
      input, 'warming', 'replay-budget', input.replayMs, CACHE_SCALE_LIMITS.replayMs,
    );
  }
  if (input.rebuildMs > CACHE_SCALE_LIMITS.rebuildMs) {
    return degrade(
      input, 'rebuilding', 'rebuild-budget', input.rebuildMs, CACHE_SCALE_LIMITS.rebuildMs,
    );
  }
  return {
    health: 'complete',
    mode: 'cache',
    reason: 'within-budget',
    shedCallbacks: false,
    scheduleRebuild: false,
  };
}
