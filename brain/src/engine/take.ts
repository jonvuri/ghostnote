/**
 * A take — what one batch produced, as a value.
 *
 * D5: "a batch creates a named, addressable take that can be compared, jumped
 * between and partially reverted." Session 1 owes the VALUE; session 2 keeps it
 * in the session's stash, where it is the "before" every reversal replays and
 * the fingerprint the boundary checks against (D19). Everything that needs is in
 * here already, which is deliberate — the stash should be a RECORD, not a second
 * model.
 *
 * ⚠ It used to say *"session 2 gives it a durable, branchable home."* There is
 * no home: the store is retired and the PROJECT is the take log (D17 rev, D18).
 *
 * The three fields it is easy to get wrong, and why they are what they are:
 *
 *   - `stash` is a `Snapshot`, i.e. WHAT READBACK REPORTED, never what was
 *     requested (D5, E8-E). It is also the "before" side of Phase 3's diff —
 *     one mechanism, two features (§8f).
 *   - `values` carries a fidelity label per address, DERIVED from the write-set
 *     rather than attached by a caller (D5, PHASE-1 §Risks: "the label is part
 *     of the take schema from the first write, not an addition").
 *   - `report` is §8c: what applied, what did not take, and what readback
 *     disagrees with the request about. A batch is not "done" until it has one.
 */
import type {
  Address, BatchReceipt, ContractTag, Fidelity, Op, OpReceipt, RevisionMark, Snapshot, StateValue,
} from '../contract/index.js';
import type { UnrevertableOp, WriteTarget } from './write-set.js';

/**
 * One address's prior state, labelled.
 *
 * `value` is `undefined` when nothing was there — which is a restorable state
 * (you restore it by not writing, or by deleting what the batch created), and
 * so is NOT the same as `fidelity: 'none'`.
 */
export interface TakeValue {
  readonly address: Address;
  readonly key: string;
  readonly fidelity: Fidelity;
  readonly value: StateValue | undefined;
  /**
   * Why this is not `exact`, in the caller's language — property names, the
   * structural op that put the address at risk, the blind spot that hid it.
   * Empty when `fidelity` is `exact`.
   */
  readonly caveats: readonly string[];
}

/**
 * One field where readback and request disagree (§8c's third clause).
 *
 * Not an error. This includes note differences and exact clip metadata that did
 * not read back as requested. E8-E's same-pitch adjacency truncation means a
 * written duration is not guaranteed to survive. Gain has a measured write-side
 * inverse (E24), so it no longer creates a disagreement. Reporting real
 * differences separates a truthful take from one that claims a write landed as
 * asked.
 */
export interface Disagreement {
  readonly address: Address;
  /** Which value, in the caller's own units. */
  readonly at: string;
  readonly field: string;
  readonly requested: unknown;
  readonly readback: unknown;
  /** Set when this divergence is a MEASURED behaviour rather than a surprise. */
  readonly known?: string;
}

/**
 * An address the verify read could not cover — so "no disagreement reported"
 * must not be read as "it landed".
 *
 * ⚠ The case this exists for is E3 turning on the batch that caused it: a patch
 * containing a scene create/delete invalidates its OWN write-set, because
 * compaction moves every row below the edit and `resolve` refuses a stale epoch
 * rather than guessing where things went. Re-minting the addresses at the new
 * epoch would be exactly that guess. So the verify skips them and says so.
 */
export interface Unverified {
  readonly address: Address;
  readonly why: string;
}

/**
 * ⚠ Something in the clip launcher changed while this batch was running, and the
 * batch did not do it.
 *
 * PHASE-1 asks *"what happens when the user edits inside the write-set after the
 * agent wrote"* and answers its own question: *"detection matters more than
 * resolution here — surface it, don't guess."* This is the surface. Nothing here
 * repairs anything, refuses anything, or re-mints an address.
 *
 * ⚠ **Its unique reach is the slots the batch did NOT write.** The launcher
 * callback carries no author, so an event naming a slot this batch also wrote is
 * evidence of nothing — that case is arbitrated by the verify readback and the
 * stash fingerprint, which compare against what we know we left. What no
 * fingerprint can see is a clip that moved somewhere we never looked, and a
 * position-addressed world is exactly the one where that matters (D16a: there is
 * no durable clip id, and we are not inventing one).
 *
 * ⚠ `undecidable` is not "nothing happened". It is the extension's ring having
 * dropped events, or a mark from a previous life of the extension — the two ways
 * the window can be intact-looking and empty while the world moved. Reported as
 * its own field so a caller cannot read silence as calm.
 */
export interface ConcurrentEdit {
  readonly channelId: string;
  readonly slotIndex: number;
  readonly filled: boolean;
  readonly why: string;
}

/** §8c: what applied, what didn't take, and where readback disagrees. */
export interface ApplyReport {
  /** True only when the complete request was accepted. */
  readonly applied: boolean;
  /** Set when a revision guard rejected the current stage (E8-D). */
  readonly rejected?: BatchReceipt['rejected'];
  readonly failed: readonly OpReceipt[];
  readonly disagreements: readonly Disagreement[];
  /** ⚠ Addresses the verify could not READ. Empty in the ordinary case. */
  readonly unverified: readonly Unverified[];
  /** ⚠ Launcher edits during this batch that this batch cannot account for. */
  readonly concurrent: readonly ConcurrentEdit[];
  /**
   * ⚠ Set when the concurrent-edit window could not be evaluated at all, with
   * the reason. An empty `concurrent` means "we looked and saw nothing" ONLY
   * while this is absent.
   */
  readonly undecidable?: string;
}

export interface Take {
  /** Stamped so a take written by an older contract is rejected, not half-read. */
  readonly contract: ContractTag;
  readonly id: string;
  readonly createdAtMs: number;
  /** Where the world was when the stash was taken — the guard the batch ran under. */
  readonly at: RevisionMark;
  /** The patch AS REQUESTED. `receipt.stages` is what actually ran, post-`planStages`. */
  readonly ops: readonly Op[];
  readonly targets: readonly WriteTarget[];
  readonly unrevertable: readonly UnrevertableOp[];
  readonly stash: Snapshot;
  readonly receipt: BatchReceipt;
  /** The readback AFTER the batch — the verify half of §8b, and the diff's "after". */
  readonly verify: Snapshot;
  readonly values: readonly TakeValue[];
  /** The worst label across `values`. A take is only as restorable as its weakest address. */
  readonly fidelity: Fidelity;
  readonly report: ApplyReport;
}

/** Did at least one stage reach the project, including before a later rejection? */
export function takeAppliedAnything(take: Pick<Take, 'receipt' | 'report'>): boolean {
  return take.report.applied || take.receipt.stages.length > 0;
}

/** The addresses a take covers — what session 2's partial revert slices. */
export function takeWriteSet(take: Take): readonly Address[] {
  return take.targets.map((t) => t.address);
}
