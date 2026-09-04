/** One bounded policy for reads that wait for host observer state. */
export interface SettlementPolicy {
  readonly deadlineMs: number;
  readonly retryMs: number;
  readonly maximumAttempts: number;
}

/** E97 measured valid nested reads at 0.97-2.10 seconds. */
export const HOST_SETTLEMENT_POLICY: SettlementPolicy = {
  deadlineMs: 12_000,
  retryMs: 250,
  maximumAttempts: 3,
};

export interface SettlementProgress {
  readonly stage: string;
  readonly detail: string;
  readonly generation?: string | number;
}

export interface SettlementReport {
  readonly deadlineMs: number;
  readonly attempts: number;
  readonly elapsedMs: number;
  readonly lastProgress: SettlementProgress;
  readonly cause?: 'complete' | 'deadline' | 'attempt-limit' | 'no-progress';
}

export type SettlementObservation<T> =
  | { readonly complete: true; readonly value: T; readonly progress: SettlementProgress }
  | { readonly complete: false; readonly progress: SettlementProgress };

export interface SettlementOptions {
  readonly policy?: SettlementPolicy;
  readonly wait?: (milliseconds: number) => Promise<void>;
  readonly now?: () => number;
  readonly throwIfCancelled?: () => void;
}

export type SettlementResult<T> =
  | { readonly complete: true; readonly value: T; readonly report: SettlementReport }
  | { readonly complete: false; readonly report: SettlementReport };

/**
 * Repeat complete observations within one deadline. The live adapter creates
 * one fresh generation for each acquisition. The caller defines progress. An
 * in-flight observation can finish after the deadline, but its result cannot
 * complete the settlement.
 */
export async function settleObservation<T>(
  observe: () => Promise<SettlementObservation<T>>,
  options: SettlementOptions = {},
): Promise<SettlementResult<T>> {
  const policy = options.policy ?? HOST_SETTLEMENT_POLICY;
  const pause = options.wait ?? wait;
  const now = options.now ?? (() => performance.now());
  const started = now();
  let attempts = 0;
  let lastProgress: SettlementProgress = {
    stage: 'not-started', detail: 'no observer generation started',
  };
  let priorIncompleteProgress: SettlementProgress | undefined;
  let progressChanged = false;

  while (attempts < policy.maximumAttempts) {
    options.throwIfCancelled?.();
    if (attempts > 0 && now() - started >= policy.deadlineMs) {
      return incomplete('deadline');
    }
    attempts += 1;
    const observed = await observe();
    options.throwIfCancelled?.();
    lastProgress = observed.progress;
    if (now() - started >= policy.deadlineMs) return incomplete('deadline');
    if (observed.complete) {
      return {
        complete: true,
        value: observed.value,
        report: report('complete'),
      };
    }
    if (priorIncompleteProgress !== undefined
        && !sameProgress(priorIncompleteProgress, observed.progress)) {
      progressChanged = true;
    }
    priorIncompleteProgress = observed.progress;
    if (attempts >= policy.maximumAttempts) break;
    const remaining = policy.deadlineMs - (now() - started);
    if (remaining <= 0) return incomplete('deadline');
    await pause(Math.min(policy.retryMs, remaining));
    options.throwIfCancelled?.();
  }
  return incomplete(now() - started >= policy.deadlineMs
    ? 'deadline'
    : progressChanged ? 'attempt-limit' : 'no-progress');

  function report(cause: SettlementReport['cause']): SettlementReport {
    return {
      deadlineMs: policy.deadlineMs,
      attempts,
      elapsedMs: Math.max(0, Math.round(now() - started)),
      lastProgress,
      cause,
    };
  }

  function incomplete(
    cause: 'deadline' | 'attempt-limit' | 'no-progress',
  ): SettlementResult<T> {
    return { complete: false, report: report(cause) };
  }
}

function sameProgress(left: SettlementProgress, right: SettlementProgress): boolean {
  return left.stage === right.stage && left.detail === right.detail
    && left.generation === right.generation;
}

const wait = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));
