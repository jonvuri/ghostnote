/**
 * Snapshots and batch receipts — the two serialized artifacts of the contract.
 *
 * A snapshot is the §8b stash AND the verify primitive AND the "before" side of
 * Phase 3's diff. One mechanism, three features (§8f): because writes are
 * addressed, the write-set is known before execution, so "read exactly those
 * addresses" is all that revert ever needs. No inverse-operation algebra —
 * quantize and humanize have no clean inverse but a perfectly clean prior state.
 *
 * ⚠ A snapshot records WHAT READBACK REPORTED, never what was requested. E8
 * found consecutive same-pitch notes truncate each other (Bitwig ends a note
 * where the next same-pitch note begins), so a written duration is not guaranteed
 * to survive. Storing the request would make a revert restore a state that never
 * existed.
 */
import type { Address, AddressKey } from './address.js';
import type { DeviceState, NoteRecord, ParamState, TrackState } from './state.js';
import type { ContractTag } from './version.js';

/**
 * Where in the world a snapshot or receipt was taken.
 *
 * `revision` is E8's monotonic counter, which lives on the extension's executor
 * and is thread-confined to the control-surface thread — that confinement is what
 * makes check-then-apply-then-bump atomic with no locking. `sceneEpoch` is ours,
 * and it is what makes E3's compaction trap a refusal instead of a silent
 * mis-write.
 */
export interface RevisionMark {
  readonly revision: number;
  readonly sceneEpoch: number;
}

/**
 * How exactly this entry can be restored.
 *
 *   exact — round-trips losslessly; a revert fully restores it.
 *   lossy — restorable, but at least one property has an unverified round-trip
 *           (today: note `gain`, E2), or the address is positional and a
 *           structural op could have moved it, or the value carries less than the
 *           object does (a clip is rebuilt from its length and notes, and its
 *           name, colour and automation lanes are not in the snapshot at all).
 *   none  — captured for the record, not restorable (a deleted track: a recreated
 *           one mints a fresh `channelId`, so no stash can be replayed onto it).
 *
 * ⚠ This is the input to the fidelity floor (`engine/floor.ts`): anything worse
 * than `exact` REFUSES to run unless the caller cleared it. An adapter that
 * over-labels here does not merely mislead a report — it opens a safety gate.
 */
export type Fidelity = 'exact' | 'lossy' | 'none';

export type StateValue =
  | { readonly of: 'notes'; readonly notes: readonly NoteRecord[] }
  | { readonly of: 'track'; readonly track: TrackState }
  /**
   * ⚠ `lengthBeats` is LOAD-BEARING, and was not always treated as such. It is
   * what lets a revert rebuild a clip the batch removed (D16 amendment 1); an
   * entry that says `exists: true` without one cannot be rebuilt at all, and
   * `revertOps` reports that rather than picking a length. It stays OPTIONAL
   * because the live adapter reads it from `Clip.getLoopLength()` and will not
   * invent a number when that does not read back — the honest shape of "we did
   * not capture it".
   *
   * ⚠ It was declared, populated by the fake, and ignored by the live adapter for
   * a whole phase — PHASE-0 §Risks' named failure mode, invisible because nothing
   * read the field. Both adapters populate it now and `C-clip` asserts it on both.
   */
  | { readonly of: 'clip'; readonly exists: boolean; readonly lengthBeats?: number }
  | { readonly of: 'device'; readonly device: DeviceState }
  | { readonly of: 'param'; readonly param: ParamState };

export interface StateEntry {
  readonly address: Address;
  readonly fidelity: Fidelity;
  readonly value: StateValue;
}

export interface Snapshot {
  readonly contract: ContractTag;
  readonly at: RevisionMark;
  readonly entries: Readonly<Record<AddressKey, StateEntry>>;
  /** Resolved fine, but there is nothing there (an empty slot, a deleted track). */
  readonly missing: readonly Address[];
  /**
   * ⚠ Outside the bank window — we CANNOT SEE this address, which is not the same
   * as it being empty. Kept separate from `missing` for exactly that reason:
   * collapsing the two is how a blind spot becomes a silently empty snapshot and
   * a revert that quietly under-delivers (E5, standing rule 5).
   */
  readonly unreachable: readonly Address[];
}

export interface OpReceipt {
  readonly op: string;
  readonly ok: boolean;
  readonly error?: string;
}

export interface StageReceipt {
  readonly index: number;
  /** `undefined` for the instant stage; otherwise the budget waited after it. */
  readonly settled?: string;
  readonly applied: boolean;
  readonly ops: readonly OpReceipt[];
  readonly revision: number;
}

export interface BatchReceipt {
  readonly contract: ContractTag;
  readonly accepted: boolean;
  /** Set when the revision guard rejected the batch WHOLE, applying zero ops (E8-D). */
  readonly rejected?: { readonly reason: 'stale-revision'; readonly expected: number; readonly actual: number };
  /**
   * Per stage, in order.
   *
   * ⚠ All-or-nothing holds WITHIN a stage, not across stages: a paced batch is
   * several `batch.run` calls, and a later stage can fail after an earlier one
   * landed. That is what "report what applied and what didn't take" (§8c) means,
   * and pretending otherwise would be the dishonest simplification.
   */
  readonly stages: readonly StageReceipt[];
  /**
   * Identity minted by this batch: op index -> the address it produced.
   *
   * E2c proved the discipline on `track.create`: create, diff the bank by
   * channelId, verify — never assume a requested position. ⚠ `device.insert`
   * mints too (D16 amendment 2), and for a sharper reason: the chain index it
   * reports is what a revert DELETES, so an index that was counted rather than
   * observed would remove a device nobody addressed. An adapter that cannot see
   * where the device landed reports no mint, and the revert says so.
   */
  readonly minted: Readonly<Record<number, Address>>;
  readonly at: RevisionMark;
}

/** Did every stage apply cleanly? */
export function fullyApplied(receipt: BatchReceipt): boolean {
  return (
    receipt.accepted &&
    receipt.rejected === undefined &&
    receipt.stages.every((s) => s.applied && s.ops.every((o) => o.ok))
  );
}

/** Ops that did not take — the report §8c requires after every batch. */
export function failures(receipt: BatchReceipt): readonly OpReceipt[] {
  return receipt.stages.flatMap((s) => s.ops.filter((o) => !o.ok));
}
