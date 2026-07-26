/**
 * Staging — replacing E8's raw `delayMs` with declared settle classes.
 *
 * E8 shipped two execution modes on the wire: a synchronous fast path (every op
 * in one control-surface turn — 240 note writes in 25ms versus 5804ms as separate
 * RPCs, 232x) and a paced path that hands ops to the scheduler one settle-budget
 * apart and returns IMMEDIATELY. The paced response therefore acknowledges
 * ACCEPTANCE, not completion, because the Bridge writes a handler's response when
 * it returns — and E8 flagged the deferred-response protocol as an open Phase-1
 * build item.
 *
 * This module sidesteps that entirely for v0. Instead of passing `delayMs` and
 * hoping, the brain partitions ops by their declared settle class and issues one
 * `batch.run` per stage, awaiting a settle between stages. So:
 *
 *   - the fast path keeps its 232x win (every `instant` op shares stage 0);
 *   - `apply()` resolves on COMPLETION, because nothing is ever fire-and-forget;
 *   - the caller cannot get pacing wrong — there is no knob to pass;
 *   - stage n guards on the revision stage n-1 returned, so cross-stage
 *     interference is caught for free.
 *
 * ⚠ The honest limitation: all-or-nothing holds WITHIN a stage, not across them.
 * A later stage can fail after an earlier one landed, and the receipt says which.
 * Phase 1 replaces the implementation (one paced call plus a completion frame)
 * once deferred responses exist; the `Stage` shape and `stages[]` receipt survive
 * that change, which is why they look like this now.
 */
import type { SettleBudget } from './budgets.js';
import { OP_SETTLE, OP_SETTLE_BEFORE, type Op } from './ops.js';
import { orderedNoteProps, type NoteRecord } from './state.js';

export interface Stage {
  readonly ops: readonly Op[];
  /** Original indices, so the receipt can map results back to the caller's ops. */
  readonly opIndices: readonly number[];
  /** Waited AFTER this stage. `undefined` on a purely instant stage. */
  readonly settle?: SettleBudget;
  /**
   * Waited BEFORE this stage is sent (E15-D).
   *
   * Not the same knob as `settle` and not interchangeable with it: this one
   * guards against an op reading state that an EARLIER stage invalidated, which
   * no amount of waiting afterwards can repair.
   */
  readonly settleBefore?: SettleBudget;
}

/**
 * Partition ops into stages, preserving caller order.
 *
 * Rules, in order of precedence:
 *   1. Consecutive `instant` ops coalesce into one stage — the batch win.
 *   2. A settling op gets its own stage, followed by its budget. It cannot share
 *      with the instant ops around it, because an op after a device insert must
 *      not run before the device exists (E8's own worked example).
 *   3. Order is never rearranged. Callers express dependencies positionally, and
 *      silently reordering them would be a correctness bug, not an optimization.
 */
/** The four fields that ride on `setStep` itself; everything else is a property. */
function identity(n: NoteRecord): NoteRecord {
  return { startBeats: n.startBeats, pitch: n.pitch, velocity: n.velocity, durationBeats: n.durationBeats };
}

/** Does this note carry anything that must go out as a SEPARATE property write? */
function hasWritableProps(n: NoteRecord): boolean {
  return orderedNoteProps(n).length > 0;
}

/**
 * Split a note write into the turns Bitwig actually requires.
 *
 * ⚠ A note's properties cannot be set in the same request that CREATES it.
 * `setStep` is not visible to a `getStep` in the same request (E2), so the
 * `NoteStep` a same-request `setNoteProps` operates on is stale and every
 * property written to it is silently discarded (E15-B; measured: gain 0.7
 * written alongside the note reads back 0). So a fully-specified note needs two
 * turns — create, then properties — and the properties stage additionally
 * carries `settleBefore: 'gridChange'`, because the `cursor.setStepSize` the
 * create emitted has to land before that `getStep` is usable (E15-D).
 *
 * ⚠ This used to emit a THIRD stage carrying `pressure` alone, on the strength
 * of E2/e02e's "gain and timbre zero pressure". E15-E retired both: pressure
 * cannot be written at all, in any number of turns, and `assertOpsWritable`
 * refuses it up front — so there is nothing left for a third stage to do.
 *
 * ⚠ The properties op carries the write's WHOLE note set, not just the notes
 * that have properties, and that is load-bearing rather than lazy. Both stages
 * derive their step grid from the notes they hold (`stepSizeFor`), and E15-D's
 * other half is that a `setStepSize` which actually CHANGES the grid poisons the
 * `getStep` inside `setNoteProps` — in the same turn, where no `settleBefore`
 * can reach it. Filtering to the property-bearing notes can make the properties
 * stage coarser than the create stage: one note at beat 0 with `pan` plus one
 * plain note at beat 0.5 gives grid 0.5 for the create and grid 1 for a filtered
 * props op, so the props op changes the grid and loses everything it carries,
 * with no error. Handing over the same note set makes the two grids identical by
 * construction, and a note with no properties costs nothing downstream — the
 * encoder emits no frame for it and the fake applies no change.
 *
 * Callers never arrange any of this. They hand over a `NoteRecord` and the plan
 * makes it land; this is the single largest thing the contract buys over the
 * raw wire.
 */
function splitNoteWrite(op: Op): Op[] {
  if (op.op !== 'note.write' || !op.notes.some(hasWritableProps)) return [op];

  const channel = op.channel === undefined ? {} : { channel: op.channel };
  return [
    { ...op, notes: op.notes.map(identity) },
    { op: 'note.props', clip: op.clip, ...channel, notes: op.notes },
  ];
}

/**
 * ⚠ DO NOT hoist the generated `note.props` ops into one trailing stage.
 *
 * It is the obvious optimization and it is unsound. N property-bearing writes
 * currently cost 2N stages and N x `gridChange`, and PHASE-0-SESSION-2 item 4
 * proposed collapsing that to 2 stages and one wait, reasoning from E15-D that
 * "ops addressing different clips MAY share a stage".
 *
 * E15-D measured `setNotes`, a pure write. `note.props` is the one op that READS
 * first, and E15-F measured it directly: `cursor.setNoteProps` resolves its note
 * against the clip the cursor held when the TURN BEGAN, whatever it re-points to
 * inside that turn. Hoisted, the props stage opens with the cursor on the LAST
 * clip written, so every op but that one looks its note up in the wrong clip,
 * finds nothing, and writes nothing — silently. Measured on two clips: gn-A lost
 * its pan, gn-B kept its own, no error and no failed op in the receipt.
 *
 * Interleaving is what makes the shipped plan correct, and not by accident any
 * more: each props stage follows the create stage for the SAME clip, so its
 * point frames are a no-op and the turn starts where the lookup needs it. That
 * is the invariant, stated here because it was previously implicit and nothing
 * in the code would have stopped someone optimizing it away.
 *
 * The fake models the trap (`propsReadsTurnStartClip`), so a future hoist fails
 * offline rather than costing a musician their expression data.
 */
export function planStages(input: readonly Op[]): Stage[] {
  // Expand first, so index mapping below is over the EXPANDED list. The receipt
  // therefore reports the ops that actually ran, which is what §8c asks for.
  const ops = input.flatMap(splitNoteWrite);

  const stages: Stage[] = [];
  let pending: Op[] = [];
  let pendingIndices: number[] = [];

  const flushInstant = () => {
    if (pending.length > 0) {
      stages.push({ ops: pending, opIndices: pendingIndices });
      pending = [];
      pendingIndices = [];
    }
  };

  ops.forEach((op, i) => {
    const settle = OP_SETTLE[op.op];
    if (settle === 'instant') {
      pending.push(op);
      pendingIndices.push(i);
      return;
    }
    flushInstant();
    const settleBefore = OP_SETTLE_BEFORE[op.op];
    stages.push({
      ops: [op],
      opIndices: [i],
      settle,
      ...(settleBefore === undefined ? {} : { settleBefore }),
    });
  });

  flushInstant();
  return stages;
}

/**
 * Worst-case wall-clock for a plan, in ms. Advisory only — used to warn before a
 * long batch and to size the progress `notify` ops, never to sleep by.
 */
export function planBudgetMs(stages: readonly Stage[], settleMs: Record<SettleBudget, number>): number {
  return stages.reduce(
    (total, s) => total + (s.settleBefore ? settleMs[s.settleBefore] : 0) + (s.settle ? settleMs[s.settle] : 0),
    0,
  );
}
