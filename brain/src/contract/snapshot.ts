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
import type {
  ClipLaunchState, ClipPlayState, DeviceState, NoteRecord, ParamState, TrackState,
} from './state.js';
import type { ContractTag } from './version.js';

/**
 * How much of one population the bank can see — the numbers standing rule 5 is
 * an inequality over.
 *
 * ⚠ `count` is the PROJECT total, not the window's occupancy. `Bank.itemCount()`
 * reports it (E15-A for tracks, re-confirmed E16r; measured for SCENES in E21
 * arm 1), and that is the whole reason the rule is implementable: without it,
 * *"16 tracks exist"* and *"16 of 54 are visible"* are indistinguishable.
 *
 * ⚠ Both numbers, never a derived boolean. A caller that only receives
 * "overflowing: true" cannot say by how much, and every refusal this feeds has
 * to name the budget and the totals or it is not actionable.
 */
export interface WindowCoverage {
  /**
   * What the PROJECT holds — `Bank.itemCount()`, the project total (E15-A).
   *
   * ⚠ NEGATIVE means the total could not be read. Live, `revision.get` reports the
   * scene observer's last value, which is `-1` until Bitwig has delivered one —
   * and "we could not tell" must never resolve to "we saw everything". Every
   * predicate below treats it as uncovered.
   */
  readonly count: number;
  /** How many of them the bank window can address at once. Fixed at `init()` (D7). */
  readonly bankSize: number;
}

/** ⚠ Can the window see the whole population? An unknown total is NOT a yes. */
export const windowCovers = (c: WindowCoverage): boolean => c.count >= 0 && c.count <= c.bankSize;

/** How many exist that the window cannot address; `-1` when the total is unknown. */
export const blindCount = (c: WindowCoverage): number =>
  c.count < 0 ? -1 : Math.max(0, c.count - c.bankSize);

/**
 * Where in the world a snapshot or receipt was taken.
 *
 * `revision` is E8's monotonic counter, which lives on the extension's executor
 * and is thread-confined to the control-surface thread — that confinement is what
 * makes check-then-apply-then-bump atomic with no locking. `sceneEpoch` is what
 * makes E3's compaction trap a refusal instead of a silent mis-write.
 *
 * ⚠ **`sceneEpoch` stopped being OURS in session 3, and that is the change.** It
 * used to be a counter the adapter bumped on its own scene ops, which meant it
 * could see us and not the user — so a scene the human deleted left every
 * scene-relative address resolving as `found` while the rows beneath it had
 * already moved. Both epochs now come off observers in the EXTENSION (D4 rev),
 * which is alive whenever Bitwig is and therefore cannot miss an edit made while
 * no client was attached.
 *
 * `contentEpoch` is the second one, and it exists because the first has a
 * structural blind spot: a clip MOVE changes no scene count. E16s measured the
 * count sitting still at 3 → 3 through a human clip drag that the launcher
 * content observer reported as a pair. Clip addressing consults the content
 * epoch (E16-REPLAN §2); see `observers.ts`.
 *
 * ⚠ Neither epoch means anything as an ABSOLUTE — initial values arrive through
 * the same callbacks, so both are nonzero at rest. Only a difference between two
 * marks carries information, and `generation` is what makes that difference
 * honest: it is minted per `init()`, so a mark from a previous life of the
 * extension is INCOMPARABLE rather than merely old. Without it the counters
 * restart lower and a stale mark compares equal to a fresh one.
 */
export interface RevisionMark {
  readonly revision: number;
  readonly sceneEpoch: number;
  readonly contentEpoch: number;
  /** ⚠ Per-`init()` nonce. Marks from different generations are not comparable. */
  readonly generation: string;
  /**
   * ⚠ WHICH PROJECT the epochs were counted in — the gap `generation` does not
   * close, and PHASE-1-SESSION-3's *"sharpest question in the session"*.
   *
   * Loading a different project does NOT re-`init()` the extension, so the
   * generation is unchanged and both counters keep climbing — while every
   * `channelId` is different and every positional address means something else.
   * ⚠ That is WORSE than a restart, not better: a restart makes the counters go
   * backwards, which is at least anomalous, whereas a project change leaves a
   * stale mark's epoch genuinely lower and the window looking like an ordinary
   * busy one. D17a's `projectKey` covered this and was retired with the store.
   *
   * ⚠⚠ **A NAME IS NOT AN IDENTITY** (standing rule 2; E17 method guard 1 says it
   * again for fixtures). Two projects can share a name, and a rename is not a
   * project change — so this detects a change it SEES and cannot promise it sees
   * every one. It is a `lossy` detector and is documented as one rather than
   * being treated as a key: it may never be used to ADDRESS anything, only to
   * refuse a comparison. Empty when the handle was never obtained, which is
   * treated as unknown rather than as a match.
   */
  readonly project: string;
  /**
   * ⚠⚠ WHAT THE BANKS COULD SEE when this mark was taken, in both dimensions —
   * session 3's carry-forward B2, and the fourth way a window can lie.
   *
   * The other three (`truncated`, `discontinuous`, `unattributable`) are visible
   * IN the delta. This one is not: the launcher observers are attached per bank
   * row across `config.tracks`, on a slot bank sized by `config.scenes`, so an
   * edit on a track past the track window or a row past the scene window fires
   * NOTHING — and a delta that only counts events reports a clean, complete,
   * empty window while the world moved outside the bank.
   *
   * ⚠ It rides on the MARK rather than being re-derived at each consumer,
   * because the consumer that forgets fails in the direction that reads as
   * "nothing happened". And it rides on BOTH ends of a window: `contentSince`
   * takes the union, so a window that was uncoverable at either moment is
   * reported uncovered.
   *
   * ⚠ Assembled from what is ALREADY on the wire — `revision.get`'s `sceneCount`
   * and `track.list`'s `itemCount`/`bankSize` — rather than from a new reply
   * field. `methodsHash` is over method NAMES and cannot see a field appear, so
   * a stale extension would answer a coverage question with silence.
   */
  readonly window: {
    readonly tracks: WindowCoverage;
    readonly scenes: WindowCoverage;
  };
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
  | { readonly of: 'clipLaunch'; readonly launch: ClipLaunchState }
  | { readonly of: 'clipPlay'; readonly play: ClipPlayState }
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
   *
   * ⚠⚠ BOTH DIMENSIONS since session 3c. It reported blind TRACKS and stayed
   * silent about blind clip ROWS, which meant a project with more scenes than the
   * scene window produced a clean-looking snapshot of a grid whose lower half
   * nothing had looked at — the under-delivery D5 forbids, arriving through the
   * field that exists to prevent it. A row past the window is unreachable; a row
   * past the project's scene COUNT does not exist and is `missing`.
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
