/**
 * The fake's virtual clock — how the offline suite gets Bitwig's TIMING without
 * paying wall-clock for it.
 *
 * The whole point is E2's two-turn rule: a `setStep` is not visible to a
 * `getStep` in the same request, only in the next one. That is a real constraint
 * the brain must handle, so the fake has to reproduce it — but reproducing it
 * with `setTimeout` would make the suite slow AND flaky, which is how offline
 * suites get deleted.
 *
 * So: writes land in a PENDING buffer and commit at turn boundaries.
 *
 *     apply()   commit pending, tick, then stage this batch into pending
 *     settle()  commit pending, advance N ticks, drain due timers
 *     read()    read COMMITTED only — never commits, never advances
 *
 * Everything falls out of that:
 *
 *     apply(); read()             -> stale        (the trap)
 *     apply(); settle(); read()   -> visible
 *     apply(); apply(); read()    -> both visible
 *
 * ...and the rule lands "once per batch, not per op" (E8-A) for free, because a
 * batch enters `pending` as a unit.
 *
 * ⚠ `read` must not advance the clock. A poll loop is read-settle-read-settle;
 * if reads ticked too, every budget assertion would double-count.
 */
import { TICK_MS, budgetTicks, type SettleBudget } from '../../contract/index.js';

/** An effect that becomes visible only after some time has passed. */
interface Timer {
  readonly atTick: number;
  readonly effect: () => void;
  readonly label: string;
}

export class VirtualClock {
  private currentTick = 0;
  private pending: (() => void)[] = [];
  private timers: Timer[] = [];

  get tick(): number {
    return this.currentTick;
  }

  get elapsedMs(): number {
    return this.currentTick * TICK_MS;
  }

  get pendingCount(): number {
    return this.pending.length;
  }

  /** Stage a write. Invisible to `read` until the next turn boundary. */
  stage(effect: () => void): void {
    this.pending.push(effect);
  }

  /**
   * Schedule an effect that lands only after a budget has elapsed — e.g. E4's
   * "parameters become live ~194ms AFTER the device insert itself landed".
   * A plain tick counter cannot express that; a timer queue can.
   */
  after(budget: SettleBudget, label: string, effect: () => void): void {
    this.timers.push({ atTick: this.currentTick + budgetTicks(budget), effect, label });
  }

  /** Flush staged writes. Called at the head of `apply` and by `settle`. */
  commit(): void {
    const due = this.pending;
    this.pending = [];
    for (const effect of due) effect();
  }

  /** One control-surface turn: ~24ms, the measured tick floor (E5). */
  advance(ticks = 1): void {
    this.currentTick += ticks;
    this.drainTimers();
  }

  /** Commit, then wait out a budget. The only clock source in the fake. */
  settle(budget: SettleBudget): void {
    this.commit();
    this.advance(budgetTicks(budget));
  }

  private drainTimers(): void {
    const due = this.timers.filter((t) => t.atTick <= this.currentTick);
    if (due.length === 0) return;
    this.timers = this.timers.filter((t) => t.atTick > this.currentTick);
    for (const timer of due) timer.effect();
  }

  /** Timers not yet due — inspected by trap tests, never by production code. */
  get pendingTimers(): readonly string[] {
    return this.timers.map((t) => t.label);
  }
}
