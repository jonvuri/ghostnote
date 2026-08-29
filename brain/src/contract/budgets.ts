/**
 * Settle budgets — every number measured, every number cited.
 *
 * These are NAMES, not milliseconds at the call site. Two reasons, both
 * load-bearing:
 *
 *   1. Bitwig writes are not visible to a read in the same request — only in the
 *      next one (~25ms, E2). Somebody has to wait a turn. If that somebody is
 *      `await sleep(25)` scattered through the brain, the fake can never be
 *      deterministic and the offline suite pays real wall-clock for every write.
 *      Routing it through `adapter.settle(budget)` lets the live adapter poll and
 *      the fake advance virtual ticks, with ONE code path.
 *   2. Phase 1 will re-measure these on real projects. A named budget makes that
 *      one edit in one table instead of a grep for magic numbers.
 *
 * ⚠ A budget is a MEASURED DURATION, and `LiveAdapter.settle` waits it out. An
 * earlier version of this header claimed the live adapter polls to the budget as
 * a deadline; it does not, and it cannot in general. E1's poll-until-confirmed
 * rule applies to POINTING, which has an observable target (`trackPosition` /
 * `sceneIndex`) to poll for. Most budgets have none — E15-D's `gridChange` is
 * "the cursor has re-fetched its step data", whose only observable is attempting
 * the write and seeing whether it was silently discarded, which is the thing the
 * budget exists to prevent.
 *
 * So the discipline is narrower than "never sleep": where a readback exists, use
 * it instead of a budget (`refreshIndex` re-reads the bank rather than waiting
 * out a track create; `apply` diffs by channelId rather than assuming). Where one
 * does not, wait the measured number — and cite the measurement, as every entry
 * below does.
 */

export type SettleBudget =
  | 'tick'
  | 'cursorPoint'
  | 'noteWrite'
  | 'gridChange'
  | 'trackStruct'
  | 'insertFile'
  | 'paramsLive'
  | 'deviceInsert';

/**
 * The control-surface tick floor: `ping` p50 pinned at ~24ms in EVERY rig
 * configuration measured in E5, from 16 tracks to 256. It is the quantum of the
 * whole system — nothing round-trips faster — which is why the batch executor
 * exists at all (N requests pay N ticks; one batch pays one).
 */
export const TICK_MS = 24;

export const SETTLE_MS: Record<SettleBudget, number> = {
  /** One control-surface turn (E5). */
  tick: 24,
  /** Cursor point, verified by polling trackPosition + sceneIndex (E1). */
  cursorPoint: 25,
  /** Two-turn write visibility; applies once per BATCH, not per op (E2, E8-A). */
  noteWrite: 25,
  /**
   * How long a `setStepSize` needs before a `getStep` against the new grid is
   * usable (E15-D). Measured by stepping the gap between a grid change and a
   * `cursor.setNoteProps`: 0/3 properties landed at 0, 24, 48, 72 and 96ms, and
   * 3/3 landed at 120, 144, 192 and 288ms. Nothing is reported either way — the
   * properties are simply discarded — so this budget is the whole mitigation.
   * 144 keeps a tick of headroom over the measured 120 floor, and matches what
   * the read path was already waiting after its own `setStepSize`.
   */
  gridChange: 144,
  /** Track and clip create/delete (E1: ~144ms; E3 concurs at ~140ms). */
  trackStruct: 144,
  /** insertFile of a 12-pad multi-chain preset, one call (E4d). */
  insertFile: 268,
  /** Parameters become readable this long AFTER a device insert lands (E4). */
  paramsLive: 194,
  /** Cold plug-in preset insertion and its first complete device-chain readback. */
  deviceInsert: 4000,
};

/** How many control-surface ticks a budget spans. The fake advances exactly this many. */
export function budgetTicks(budget: SettleBudget): number {
  return Math.ceil(SETTLE_MS[budget] / TICK_MS);
}
