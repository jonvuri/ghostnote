/**
 * The executor — §8b, as one function.
 *
 *     resolve(write-set)   -> explicit, live-checked addresses
 *     read(write-set)      -> the stash
 *     label(stash)         -> per-address fidelity, and THE FLOOR (D18c)
 *     apply(batch)         -> optimistic, staged, revision-guarded
 *     read(write-set)      -> verify
 *     report               -> §8c: what applied, what didn't, what disagrees
 *
 * ⚠ The labelling step moved forward on 2026-08-07 and that is not cosmetic. The
 * labels always existed; they were computed after the apply, for the report. The
 * fidelity floor asks a question only answerable BEFORE the first write — *can
 * this batch be put back?* — so the same derivation now runs between the stash and
 * the apply, and its answer is a refusal rather than an automatic branch
 * (`floor.ts`).
 *
 * The contract already had the four primitives (`adapter.ts:52-93`) and its own
 * header already spelled the pipeline out; nothing called them in sequence. This
 * is that sequence, and it is the component every later session composes: the
 * stash (session 2) records what this produces, the MCP server (session 3) hosts
 * it, the control layer (session 4) triggers its reversal.
 *
 * ⚠ **NO MODULE-LEVEL MUTABLE STATE.** PHASE-1-SESSION-1 §Risks names the
 * failure precisely: the daemon will host one engine per bridge connection and
 * may re-create it when Bitwig restarts, and module state is what makes that
 * unpickable. Everything lives on the instance; `newId` and `now` are injected
 * so takes are deterministic under test without a global clock.
 */
import { randomUUID } from 'node:crypto';

import {
  AddressUnresolvedError, CONTRACT_TAG, InvalidOpError, NOTE_PROP_FIDELITY,
  StaleAddressError, addressKey, addressScene, addressTrack, assertDevicesRoutable, assertOpsWritable,
  blindSpotError, clipMetadata as clipMetadataAt, deltaComplete,
  failures, notes as notesAt,
  type Address, type AdapterInfo, type BitwigAdapter, type ContentDelta, type NoteRecord,
  type ClipMetadataState, type Op, type RevisionMark, type Snapshot,
} from '../contract/index.js';
import { labelTarget, worstOf } from './fidelity.js';
import { floorRefusal, gateBeforeReading, ownChangesetReversal, type Clearance } from './floor.js';
import { NO_MINT_NO_INVERSE, revertOps, type RevertPlan, type Unrestored } from './revert.js';
import type {
  ApplyReport, ConcurrentEdit, Disagreement, Take, TakeValue, Unverified,
} from './take.js';
import { structuralRisk, writeSetOf, type UnrevertableOp } from './write-set.js';

export interface ExecutorOptions {
  /** Injected so a take id is deterministic under test. Never a module global. */
  readonly newId?: () => string;
  /** Injected for the same reason. */
  readonly now?: () => number;
  /** Optional phase timing for focused performance probes. */
  readonly onTiming?: (event: ExecutorTimingEvent) => void;
}

export interface ExecutorTimingEvent {
  readonly phase:
    | 'resolve'
    | 'stash'
    | 'apply'
    | 'verification'
    | 'verificationRetry'
    | 'finalReconciliation'
    | 'conflict';
  readonly elapsedMs: number;
}

export interface RunOptions {
  /**
   * Why this batch may proceed when its prior state cannot be restored exactly
   * (D18c). Absent is the ordinary case: an ordinary write into a clip whose
   * prior state round-trips is `exact` and pays nothing.
   *
   * ⚠ There is no default and no fallback. If the floor trips and nothing clears
   * it, the batch is refused — the system reports and stops rather than choosing
   * a protection for the caller.
   */
  readonly clearance?: Clearance;
  /** Refuse if the project changed after a caller's content preflight. */
  readonly ifRevision?: number;
  /** Fresh scalar cohort state. It replaces duplicate resolve and stash reads. */
  readonly parameterPreflight?: Snapshot;
}

/** What a revert did, and what it could not do (D5). */
export interface RevertResult {
  /** The take the revert ITSELF created — which is what makes branching free. */
  readonly take: Take;
  /** The id of the take that was reverted. */
  readonly of: string;
  readonly plan: RevertPlan;
  readonly unrestored: readonly Unrestored[];
}

/** E2's round-trip tolerance: every property measured exact to +/-2e-3. */
const TOLERANCE = 2e-3;

export class Executor {
  private readonly adapter: BitwigAdapter;
  private readonly newId: () => string;
  private readonly now: () => number;
  private readonly onTiming: ((event: ExecutorTimingEvent) => void) | undefined;

  constructor(adapter: BitwigAdapter, options: ExecutorOptions = {}) {
    this.adapter = adapter;
    this.newId = options.newId ?? (() => randomUUID());
    this.now = options.now ?? (() => Date.now());
    this.onTiming = options.onTiming;
  }

  private async timed<T>(phase: ExecutorTimingEvent['phase'], work: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      return await work();
    } finally {
      this.onTiming?.({ phase, elapsedMs: performance.now() - start });
    }
  }

  /**
   * Run a patch. Returns a take whether or not the batch applied — a rejected
   * batch is still a fact about the session, and a caller that has to catch an
   * exception to learn "someone else wrote first" would be a worse API.
   *
   * Throws only for the refusals: a stale scene epoch (E3), an address we cannot
   * see (E5), a note write into a slot with no clip (E2), and the fidelity floor
   * (D18c). The first three are conditions under which proceeding produces a
   * SILENTLY wrong result, which is the whole reason this project owns revert;
   * the fourth is a documented precondition, and it is a refusal rather than an
   * automatic branch because *"only reporting is imposed"*.
   */
  async run(ops: readonly Op[], options: RunOptions = {}): Promise<Take> {
    return this.adapter.preserveSelection(() => this.runInside(ops, options));
  }

  /**
   * Run one same-route parameter cohort through one engine pipeline, then keep
   * one independent take for each scalar target. A scalar can therefore be put
   * back without also changing its cohort siblings.
   */
  async runParameterCohort(
    ops: readonly Op[],
    options: RunOptions = {},
  ): Promise<readonly Take[]> {
    if (ops.length === 0 || ops.some((op) => op.op !== 'param.set' && op.op !== 'remote.set')) {
      throw new InvalidOpError('parameter cohort', 'only parameter and remote-control writes are allowed');
    }
    const scalarOps = ops as readonly (
      | Extract<Op, { op: 'param.set' }>
      | Extract<Op, { op: 'remote.set' }>
    )[];
    const keys = scalarOps.map((op) => addressKey(op.op === 'param.set' ? op.param : op.remote));
    if (new Set(keys).size !== keys.length) {
      throw new InvalidOpError('parameter cohort', 'each scalar target must occur once');
    }
    return this.adapter.preserveSelection(async () => {
      const batch = await this.runInside(ops, options);
      if (batch.receipt.rejected !== undefined || batch.receipt.stages.length === 0) return [batch];
      return scalarOps.slice(0, batch.receipt.stages.length).map((op, opIndex) => {
        const writeSet = writeSetOf([op]);
        const key = writeSet.targets[0]!.key;
        const stage = batch.receipt.stages[opIndex];
        const stash = snapshotFor(batch.stash, key);
        const verify = snapshotFor(batch.verify, key);
        const values = batch.values.filter((value) => addressKey(value.address) === key);
        return this.take({
          ops: [op],
          targets: writeSet.targets,
          unrevertable: writeSet.unrevertable,
          stash,
          receipt: {
            ...batch.receipt,
            accepted: stage !== undefined && stage.applied && batch.receipt.accepted,
            stages: stage === undefined ? [] : [{ ...stage, index: 0 }],
            minted: {},
          },
          verify,
          values,
          disagreements: batch.report.disagreements.filter(
            (item) => addressKey(item.address) === key,
          ),
          unverified: batch.report.unverified.filter(
            (item) => addressKey(item.address) === key,
          ),
          concurrent: opIndex === 0 ? batch.report.concurrent : [],
          ...(opIndex === 0 && batch.report.undecidable !== undefined
            ? { undecidable: batch.report.undecidable } : {}),
        });
      });
    });
  }

  /** Run inside the one selection scope that covers the complete pipeline. */
  private async runInside(ops: readonly Op[], options: RunOptions): Promise<Take> {
    // ⚠ E15-E, first and before anything reads: a batch asking for `pressure`
    // must be refused before we pay for a stash we are going to throw away.
    assertOpsWritable(ops);
    // ⚠ Same moment, same reason, one address kind further in: a device inside a
    // layer chain is nameable but not yet routable, and the stash would be read
    // through the top-level chain the write would then damage.
    assertDevicesRoutable(ops);

    // ⚠ §3.3.6, and it runs here for a reason: this member's damage precedes the
    // stash, so a check that waited for labels would be reading its verdict off
    // a snapshot that was already insufficient when it was taken.
    const gate = gateBeforeReading(ops, options.clearance);
    if (gate !== undefined) throw gate;

    const { targets, unrevertable } = writeSetOf(ops);
    const addresses: Address[] = targets.map((t) => t.address);
    const risk = structuralRisk(ops);

    const supplied = options.parameterPreflight;
    if (supplied === undefined) {
      await this.timed('resolve', () => this.assertResolvable(addresses));
    } else {
      const suppliedKeys = new Set(Object.keys(supplied.entries));
      if (addresses.some((address) => !suppliedKeys.has(addressKey(address)))) {
        throw new InvalidOpError(
          'parameter cohort',
          'the fresh preflight does not contain every scalar target',
        );
      }
    }
    const stash = supplied ?? await this.timed('stash', () => this.adapter.read(addresses));
    this.assertVisible(stash);
    this.assertClipsExist(ops, stash);

    // ⚠ THE FLOOR (D18c, §3.3.5). The labels are derived here rather than after
    // the apply — same inputs, same answer — because the one instant this
    // decision can still be made is between the stash and the first write.
    const values: TakeValue[] = targets.map((t) => labelTarget(t, stash, risk));
    const refusal = floorRefusal(values, options.clearance);
    if (refusal !== undefined) throw refusal;

    // ⚠ E8-D / D10: the guard is the revision the STASH was taken at, so a
    // concurrent write between reading prior state and applying rejects the
    // batch WHOLE. Without it the take would claim a "before" that was already
    // someone else's "after".
    const receipt = await this.timed('apply', () => this.adapter.apply({
      ops,
      ifRevision: options.ifRevision ?? stash.at.revision,
      ...(supplied === undefined ? {} : { parameterPreflight: supplied }),
    }));

    if (receipt.rejected !== undefined) {
      if (receipt.stages.length > 0) {
        // A later dependency turn can lose its revision guard after an earlier
        // turn landed. Read the complete state and report the remaining delta.
        // Never replay the mutation after this ambiguous partial result.
        await this.adapter.settle('noteWrite');
        const verify = await this.timed('verification', () => this.adapter.read(addresses));
        const seen = await this.concurrent(stash.at, targets, true);
        const reconcileStarted = performance.now();
        const mutationConflicts = mutationStateDisagreementsOf(ops, stash, verify);
        this.onTiming?.({
          phase: 'finalReconciliation',
          elapsedMs: performance.now() - reconcileStarted,
        });
        this.onTiming?.({ phase: 'conflict', elapsedMs: 0 });
        return this.take({
          ops, targets, unrevertable, stash, receipt, verify, values,
          disagreements: [...disagreementsOf(ops, verify), ...mutationConflicts],
          unverified: [], ...seen,
        });
      }
      // ⚠ A rejected batch applied ZERO ops (E8-D), so every launcher event in
      // the window is somebody else's by construction — the cleanest reading of
      // this detector there is, and worth reporting rather than dropping: the
      // revision guard says the world moved, and this says WHERE.
      const seen = await this.concurrent(stash.at, targets, false);
      return this.take({
        ops, targets, unrevertable, stash, receipt, verify: stash, values,
        disagreements: [], unverified: [], ...seen,
      });
    }

    // ⚠ E2: a write is not visible to a read in the same turn, only the next
    // one. `apply` resolves on completion, but its last stage may be the instant
    // one with no settle of its own, so the verify read owes a turn.
    await this.adapter.settle('noteWrite');

    // ⚠ D5, and it is only answerable HERE. `writeSetOf` runs before the apply,
    // so it cannot know whether an insert was observed landing — but a take that
    // stayed silent about an insert nobody watched would claim, in every field a
    // caller reads before reverting, that there is nothing it cannot put back.
    // The device is really in the chain, so that claim is false.
    //
    // Adding it to `unrevertable` is the same channel `track.create` has always
    // used, which is what makes it reach the stash's `planReversal` and the
    // plan's `unrestored` without either of them learning a new concept.
    const unobserved = unobservedInserts(ops, receipt.minted);

    // ⚠ E3, turned on the batch that caused it. A patch containing a scene
    // create/delete invalidates its OWN write-set: compaction moves every row
    // below the edit, and both adapters REFUSE a stale scene epoch rather than
    // resolve it. Re-minting these addresses at the new epoch would be precisely
    // the guess the epoch exists to prevent — row 10 read healthy for 3.1s while
    // the clip was really at row 9 — so the verify skips them and the report
    // says which, instead of a silent "nothing to disagree about".
    const staled = receipt.at.sceneEpoch !== stash.at.sceneEpoch;
    const readable = staled ? addresses.filter((a) => addressScene(a) === undefined) : addresses;
    const unverified: Unverified[] = staled
      ? addresses.filter((a) => addressScene(a) !== undefined).map((address) => ({
        address,
        why:
          'this batch changed the scene layout, which compacts rows and invalidates every ' +
          'scene-relative address minted before it (E3). The write may well have landed; we ' +
          'refuse to claim so from an address we can no longer trust. Re-resolve and re-read.',
      }))
      : [];
    const unread = new Set(unverified.map((item) => addressKey(item.address)));
    let verify = await this.timed('verification', () => this.adapter.read(readable));
    for (const address of verify.unstable) {
      unread.add(addressKey(address));
      unverified.push({
        address,
        why: 'the target device was confirmed, but its parameter observer inventory did not settle',
      });
    }
    let reconcileStarted = performance.now();
    let mutationConflicts = mutationStateDisagreementsOf(ops, stash, verify, unread);
    this.onTiming?.({
      phase: 'finalReconciliation',
      elapsedMs: performance.now() - reconcileStarted,
    });
    if (mutationConflicts.length > 0 && mutationConflicts.every(retryableMutationDifference)) {
      // Read again. Do not replay a mutation after an ambiguous result. The
      // second exact snapshot separates delayed visibility from a stable
      // conflict without risking a duplicate non-idempotent action.
      await this.adapter.settle('noteWrite');
      verify = await this.timed('verificationRetry', () => this.adapter.read(readable));
      reconcileStarted = performance.now();
      mutationConflicts = mutationStateDisagreementsOf(ops, stash, verify, unread);
      this.onTiming?.({
        phase: 'finalReconciliation',
        elapsedMs: performance.now() - reconcileStarted,
      });
    }
    if (mutationConflicts.length > 0) {
      this.onTiming?.({ phase: 'conflict', elapsedMs: 0 });
    }

    // ⚠ Asked AFTER the verify read, so the window covers the whole pipeline —
    // stash, apply, settle and verify. PHASE-1's open question is *"what happens
    // when the user edits inside the write-set after the agent wrote"*, and the
    // moment after the verify is the latest one at which this batch is still the
    // thing that can report it.
    const seen = await this.concurrent(stash.at, targets, true);

    return this.take({
      ops, targets, unrevertable: [...unrevertable, ...unobserved], stash, receipt, verify, values,
      disagreements: [
        ...disagreementsOf(ops, verify, unread),
        ...mutationConflicts,
      ],
      unverified, ...seen,
    });
  }

  /**
   * ⚠ What moved in the clip launcher during this batch that this batch did not
   * move — the extension's observers, turned into a sentence.
   *
   * Three things about the shape, each of which was tempting to get wrong:
   *
   * 1. ⚠ **Events naming our OWN slots are dropped ONLY WHEN THE BATCH APPLIED**,
   *    and that is not a blind spot being introduced — it is one being labelled.
   *    The callback carries no author. A slot we filled produces exactly the
   *    event a human filling it produces, so keeping those would report every
   *    ordinary `clip.create` as a concurrent edit and the field would be noise
   *    within a day. What arbitrates our own addresses in that case is the verify
   *    readback and the stash fingerprint, which compare against what we know we
   *    left. This reaches the rest: the slots we never touched, where no
   *    fingerprint exists to ask.
   *
   *    ⚠⚠ **A REJECTED batch is the exact inverse and the filter must not run.**
   *    It applied ZERO ops (E8-D), so there is no "our own event" to confuse
   *    anything with — every event in the window is somebody else's by
   *    construction. Worse, a rejected take has NO other coverage: its `verify`
   *    IS its stash, so no disagreement is computed, and `planReversal` returns
   *    empty for an unapplied take, so the boundary never runs either. Filtering
   *    the intended write-set out here dropped precisely the edit that caused
   *    the rejection — the human writing the slot we were about to write —
   *    which is the single most informative event this detector can ever see.
   *    Found by review; `X-concurrent`'s reject cases now cover both sides.
   * 2. ⚠ **A window that cannot be evaluated is NOT an empty window.** A ring
   *    that dropped events, a mark from a previous life of the extension, an
   *    event that could not name its track — each is the world having moved
   *    unobserved, and each reads as `events: []` if you only count. `undecidable`
   *    is a separate field for that reason.
   * 3. **It never refuses.** *"Detection matters more than resolution here —
   *    surface it, don't guess"* (PHASE-1). A concurrent edit outside the
   *    write-set does not invalidate a batch that already ran; claiming it did
   *    would be a resolution nobody asked for.
   *
   * ⚠ Failures of the detector itself are reported, never thrown. An adapter that
   * cannot answer must not take down a batch that has already landed — losing the
   * take would be strictly worse than losing the detection, and the caller finds
   * out either way.
   */
  private async concurrent(
    since: RevisionMark,
    targets: readonly { readonly address: Address }[],
    applied: boolean,
  ): Promise<{ concurrent: readonly ConcurrentEdit[]; undecidable?: string }> {
    let delta: ContentDelta;
    try {
      delta = await this.adapter.contentSince(since);
    } catch (error) {
      return {
        concurrent: [],
        undecidable:
          'the launcher-content window could not be read, so whether anyone edited alongside ' +
          `${applied ? 'this batch' : 'this rejected batch'} is unknown: `
          + String(error),
      };
    }

    // ⚠ EMPTY when nothing applied — see note 1. There is no own-event to
    // confuse, and the intended write-set is exactly where the interesting edit
    // is: the guard rejected us because somebody wrote, and this says where.
    const ours = applied
      ? new Set(targets.map((t) => slotKeyOf(t.address)).filter((k) => k !== undefined))
      : new Set<string>();
    const concurrent: ConcurrentEdit[] = delta.events
      .filter((e) => e.channelId !== '' && !ours.has(`${e.channelId}:${e.slotIndex}`))
      .map((e) => ({
        channelId: e.channelId,
        slotIndex: e.slotIndex,
        filled: e.filled,
        why: applied
          ? `slot ${e.slotIndex} of track ${e.channelId} became `
            + `${e.filled ? 'occupied' : 'empty'} while this batch ran, and the batch never `
            + 'addressed it. Clips are addressed by position (there is no durable clip id), so a '
            + 'clip that moved invalidates addresses nothing else can check — including addresses '
            + 'this session minted earlier and has not re-resolved.'
          : `slot ${e.slotIndex} of track ${e.channelId} became `
            + `${e.filled ? 'occupied' : 'empty'} while this batch was being rejected. The batch `
            + 'applied nothing (the revision guard refused it whole), so this edit is somebody '
            + 'else\'s by construction — including on slots the batch itself meant to write, '
            + 'which is very likely what caused the rejection. Re-plan against the new world.',
      }));

    if (deltaComplete(delta)) return { concurrent };
    return {
      concurrent,
      undecidable: undecidableWhy(delta),
    };
  }

  /**
   * ⚠⚠ **Put a take back WITHOUT checking what the world looks like now.** Not
   * the reversal verb — `Stash.planReversal` is. Read the name before reaching
   * for this.
   *
   * D19 bounds reversal to what the agent *"did itself mint-and-last-write"*, and
   * this method cannot evaluate the second half: it materialises ops from the
   * take's own stash and applies them. If a human edited any of those addresses
   * in the meantime, the `note.clear` that must precede every note restore
   * (`revert.ts`) takes their edit with it — silently, because a stash from
   * before their edit has no way to know about it.
   *
   * ⚠ **It was called `revert`, and the rename is the fix.** *"Structurally
   * bounded"* is D19's own word, and a comment saying "prefer the other route" is
   * not structural — the obvious call is the unsafe one, and session 3's wiring
   * would have reached for it by muscle memory. Now the obvious call does not
   * compile, and `executor.test.ts`'s `X-ban` keeps it that way. Same idiom as
   * `WIRE_METHODS_BANNED` and `STASH_MUTATORS`: the ban is reviewable rather than
   * merely stated.
   *
   * ⚠ It is kept rather than deleted because the CONTRACT conformance suite is a
   * legitimate caller: it reverts its own writes on a fixture nobody else can
   * touch, to prove adapter behaviour. Making it hold a session `Stash` would
   * invert the layering — the suite tests the adapter contract, not session 2's
   * policy. The coarse bound is all it needs, and even that is a convention here
   * rather than a guarantee: `Take` is an interface, so a hand-built literal
   * passes. One more reason this is not the route a tool surface uses.
   *
   * The revert is recorded as a take of its own, and that part is not
   * bookkeeping: its stash is the state it replaced, so "undo the undo" is just
   * another revert — and a reversal that left no record would be a write this
   * session could not put back, which is the one thing every write here is
   * supposed to be.
   */
  async revertUnchecked(take: Take): Promise<RevertResult> {
    const plan = revertOps(take);
    // ⚠ D19/D20: putting our own changeset back rides the ordinary write surface
    // and is not gated. It has to be — the floor grades the state a batch is
    // about to overwrite, and the state a revert overwrites is by construction
    // the one the take already recorded, so gating it would make a lossy take
    // impossible to undo at all. What the revert cannot restore is REPORTED
    // (`plan.unrestored`), which is the protection D19 actually asks for.
    const applied = await this.run(plan.ops, { clearance: ownChangesetReversal(take.id) });
    return { take: applied, of: take.id, plan, unrestored: plan.unrestored };
  }

  /**
   * The `resolve` half of §8b, and the only place "verify the address before
   * writing" can live.
   *
   * ⚠ It cannot be done closer to the write. E15-D measured that
   * `cursor.status`'s `trackPosition` and `sceneIndex` lag the cursor's actual
   * target by a turn, so an in-request "did the point land?" check reads the
   * PREVIOUS answer and would certify a mis-point. Checking here, before the
   * batch is built, is the only version of the check that can be true.
   */
  private async assertResolvable(addresses: readonly Address[]): Promise<void> {
    if (addresses.length === 0) return;
    const { at, resolved } = await this.adapter.resolve(addresses);
    for (const r of resolved) {
      if (r.found) continue;
      switch (r.reason) {
        case 'stale-epoch':
          // ⚠ E3: a pinned cursor's sceneIndex goes PERMANENTLY stale after
          // compaction while looking healthy. Refusing is the only safe answer.
          throw new StaleAddressError(
            r.address,
            addressScene(r.address)?.epoch ?? -1,
            at.sceneEpoch,
          );
        case 'outside-bank-window':
          // ⚠ The mark says WHICH window hid it — track or scene row — and the
          // two have different fixes, so the refusal names the binding one.
          throw blindSpotError([r.address], at.window);
        case 'unsupported':
          throw new AddressUnresolvedError(
            r.address,
            'the durable track exists, but this address depends on device-layer chain structure ' +
            'that neither adapter can inspect yet. Refused rather than treating the track anchor ' +
            'as proof that the nested address exists.',
          );
        case 'unstable':
          throw new AddressUnresolvedError(
            r.address,
            'the target device was confirmed, but its DirectParameter observer inventory did not settle',
          );
        default:
          if (r.reason === 'absent'
              && (r.address.kind === 'param' || r.address.kind === 'remote')) {
            throw new AddressUnresolvedError(
              r.address,
              r.address.kind === 'param'
                ? 'the parameter id is not in the confirmed device inventory'
                : 'the remote page or control does not match the confirmed inventory',
            );
          }
          // `absent` is legitimate — a clip that does not exist yet is exactly
          // what `clip.create` is for, and a stash of "nothing was here" is a
          // restorable state.
          break;
      }
    }
  }

  /** ⚠ E5, standing rule 5: never operate on a partially-visible project. */
  private assertVisible(stash: Snapshot): void {
    if (stash.unreachable.length > 0) throw blindSpotError(stash.unreachable, stash.at.window);
    if (stash.unstable.length > 0) {
      throw new AddressUnresolvedError(
        stash.unstable[0]!,
        'the DirectParameter observer inventory did not settle for the confirmed device target',
      );
    }
  }

  /**
   * ⚠ E2, and the nastiest trap in the set: pointing at an EMPTY slot silently
   * lands the cursor on the WRONG clip, with `cursor.status` looking entirely
   * healthy. There is no error and no signal — the note simply appears somewhere
   * nobody addressed, or nowhere at all.
   *
   * The mitigation is procedural ("create the clip first, always", D6) and it is
   * invisible unless something checks. The stash already tells us: a `notes`
   * address whose entry is missing had no clip behind it. A batch that creates
   * or duplicates that clip is fine. `planStages` puts either structural op in
   * an earlier stage, so the slot is real by the time the notes go out.
   */
  private assertClipsExist(ops: readonly Op[], stash: Snapshot): void {
    const created = new Set<string>();
    for (const op of ops) {
      if (op.op === 'clip.create') {
        created.add(addressKey(op.slot));
        continue;
      }
      if (op.op === 'clip.duplicate') {
        created.add(addressKey(op.destination));
        continue;
      }
      if (op.op !== 'note.write' && op.op !== 'note.props' && op.op !== 'note.clear') continue;
      if (created.has(addressKey(op.clip.slot))) continue;
      const address = notesAt(op.clip, op.op === 'note.clear' ? 0 : op.channel ?? 0);
      if (stash.entries[addressKey(address)] !== undefined) continue;
      throw new AddressUnresolvedError(
        address,
        `${op.op} addresses a slot that holds no clip. Pointing at an empty slot silently lands ` +
          'the cursor on a DIFFERENT clip and reports a healthy status (E2), so this batch would ' +
          'either write into a clip nobody addressed or write nowhere at all. Emit `clip.create` ' +
          'or `clip.duplicate` for the slot in the same batch, or create it first.',
      );
    }
  }

  private take(parts: {
    ops: readonly Op[];
    targets: ReturnType<typeof writeSetOf>['targets'];
    unrevertable: ReturnType<typeof writeSetOf>['unrevertable'];
    stash: Snapshot;
    receipt: Take['receipt'];
    verify: Snapshot;
    /**
     * ⚠ Derived before the apply and carried in, not recomputed. The floor is
     * evaluated on exactly these labels, so a take that recomputed its own would
     * be free to disagree with the gate that let it run.
     */
    values: readonly TakeValue[];
    disagreements: readonly Disagreement[];
    unverified: readonly Unverified[];
    concurrent: readonly ConcurrentEdit[];
    undecidable?: string;
  }): Take {
    const values = parts.values;
    const report: ApplyReport = {
      applied: parts.receipt.accepted && parts.receipt.rejected === undefined,
      ...(parts.receipt.rejected === undefined ? {} : { rejected: parts.receipt.rejected }),
      failed: failures(parts.receipt),
      disagreements: parts.disagreements,
      unverified: parts.unverified,
      concurrent: parts.concurrent,
      ...(parts.undecidable === undefined ? {} : { undecidable: parts.undecidable }),
    };
    return {
      contract: CONTRACT_TAG,
      id: this.newId(),
      createdAtMs: this.now(),
      at: parts.stash.at,
      ops: parts.ops,
      targets: parts.targets,
      unrevertable: parts.unrevertable,
      stash: parts.stash,
      receipt: parts.receipt,
      verify: parts.verify,
      values,
      fidelity: worstOf(values),
      report,
    };
  }
}

/** Keep one address and its standing in a cohort member's independent record. */
function snapshotFor(snapshot: Snapshot, key: string): Snapshot {
  const entry = snapshot.entries[key];
  const matches = (address: Address): boolean => addressKey(address) === key;
  return {
    ...snapshot,
    entries: entry === undefined ? {} : { [key]: entry },
    missing: snapshot.missing.filter(matches),
    unreachable: snapshot.unreachable.filter(matches),
    unstable: snapshot.unstable.filter(matches),
  };
}

/**
 * Inserts this batch made whose landing place nobody observed.
 *
 * ⚠ The inverse of `device.insert` is a delete at the chain index the receipt
 * MINTED (D16 rev 2), so an insert with no mint has no inverse: the adapter could
 * not see where it landed, and inferring an index would delete whatever now sits
 * at a position we counted rather than observed (E2c, D20).
 *
 * That is a fact about the EXECUTION, not about the op, which is why it cannot
 * come from `writeSetOf` the way `track.create`'s does — the write-set is derived
 * before the apply and this is only knowable after. It reaches the take through
 * the same field regardless, so nothing downstream has to learn where it came
 * from: the store's walk already folds `take.unrevertable` into its plan, and
 * `revertOps` already turns it into `unrestored`.
 */
function unobservedInserts(
  ops: readonly Op[],
  minted: Readonly<Record<number, Address>>,
): UnrevertableOp[] {
  const out: UnrevertableOp[] = [];
  ops.forEach((op, opIndex) => {
    if (op.op !== 'device.insert' || minted[opIndex]?.kind === 'device') return;
    out.push({ opIndex, op: op.op, why: NO_MINT_NO_INVERSE });
  });
  return out;
}

// --- §8c's third clause: what readback disagrees with the request about ------

/**
 * Compare what the batch ASKED for against what came back.
 *
 * This exists because "the batch was accepted" and "the batch did what you asked"
 * are different claims, and Bitwig separates them routinely rather than
 * exceptionally:
 *
 *   - consecutive same-pitch notes truncate each other, so a written duration is
 *     not guaranteed to survive (E8-E) — no error, no failed op;
 *   - `gain` uses the independently measured write-side inverse (E24);
 *   - a mis-pointed write lands somewhere else entirely (E2), which shows up
 *     here as a note that simply is not present.
 *
 * `note.props` is generated from a `note.write` by `planStages` and carries the
 * same values, so checking it too would report every property twice. Clip
 * metadata is complete state, so only the final update for each surviving clip
 * is compared.
 */
export function disagreementsOf(
  ops: readonly Op[],
  verify: Snapshot,
  /**
   * Addresses the verify deliberately did NOT read (E3's scene-epoch case).
   * Without this they would each be reported as a note that never landed —
   * turning "we could not look" into "it failed", which is the exact confusion
   * `ApplyReport.unverified` exists to prevent.
   */
  unread: ReadonlySet<string> = new Set(),
): Disagreement[] {
  const out: Disagreement[] = [];
  const metadataUpdates = finalClipMetadataUpdates(ops);
  for (const op of metadataUpdates.values()) {
    const address = clipMetadataAt(op.clip);
    if (unread.has(addressKey(address))) continue;
    const entry = verify.entries[addressKey(address)];
    if (entry?.value.of !== 'clipMetadata') {
      out.push({
        address,
        at: 'clip metadata',
        field: 'exists',
        requested: true,
        readback: false,
      });
      continue;
    }
    out.push(...compareClipMetadata(address, op.metadata, entry.value.metadata));
  }

  const parameterWrites = new Map<string, Extract<Op, { op: 'param.set' }>>();
  for (const op of ops) {
    if (op.op === 'param.set') parameterWrites.set(addressKey(op.param), op);
  }
  for (const op of parameterWrites.values()) {
    if (unread.has(addressKey(op.param))) continue;
    const entry = verify.entries[addressKey(op.param)];
    if (entry?.value.of !== 'param') {
      out.push({
        address: op.param,
        at: 'parameter base value',
        field: 'exists',
        requested: true,
        readback: false,
      });
      continue;
    }
    if (!equalEnough(op.value, entry.value.param.value)) {
      out.push({
        address: op.param,
        at: 'parameter base value',
        field: 'value',
        requested: op.value,
        readback: entry.value.param.value,
      });
    }
  }

  const enabledWrites = new Map<string, Extract<Op, { op: 'device.setEnabled' }>>();
  for (const op of ops) {
    if (op.op === 'device.setEnabled') {
      const address = { kind: 'deviceEnabled', device: op.device } as const;
      enabledWrites.set(addressKey(address), op);
    }
  }
  for (const op of enabledWrites.values()) {
    const address = { kind: 'deviceEnabled', device: op.device } as const;
    if (unread.has(addressKey(address))) continue;
    const entry = verify.entries[addressKey(address)];
    if (entry?.value.of !== 'deviceEnabled') {
      out.push({
        address,
        at: 'device enabled state',
        field: 'exists',
        requested: true,
        readback: false,
      });
      continue;
    }
    if (entry.value.enabled !== op.enabled) {
      out.push({
        address,
        at: 'device enabled state',
        field: 'enabled',
        requested: op.enabled,
        readback: entry.value.enabled,
      });
    }
  }

  const remoteWrites = new Map<string, Extract<Op, { op: 'remote.set' }>>();
  for (const op of ops) {
    if (op.op === 'remote.set') remoteWrites.set(addressKey(op.remote), op);
  }
  for (const op of remoteWrites.values()) {
    if (unread.has(addressKey(op.remote))) continue;
    const entry = verify.entries[addressKey(op.remote)];
    if (entry?.value.of !== 'remote') {
      out.push({
        address: op.remote,
        at: 'remote-control base value',
        field: 'exists',
        requested: true,
        readback: false,
      });
      continue;
    }
    if (!equalEnough(op.value, entry.value.remote.value)) {
      out.push({
        address: op.remote,
        at: 'remote-control base value',
        field: 'value',
        requested: op.value,
        readback: entry.value.remote.value,
      });
    }
  }

  for (const op of ops) {
    if (op.op !== 'note.write') continue;
    const address = notesAt(op.clip, op.channel ?? 0);
    if (unread.has(addressKey(address))) continue;
    const entry = verify.entries[addressKey(address)];
    const got = entry?.value.of === 'notes' ? entry.value.notes : [];
    for (const wanted of op.notes) {
      const found = got.find(
        (n) => n.pitch === wanted.pitch && Math.abs(n.startBeats - wanted.startBeats) < 1e-9,
      );
      if (found === undefined) {
        out.push({
          address,
          at: noteLabel(wanted),
          field: 'exists',
          requested: true,
          readback: false,
          known:
            'a note that is not in the readback either never landed or landed in another clip — ' +
            'pointing at an empty slot does the latter, silently (E2).',
        });
        continue;
      }
      out.push(...compareNote(address, wanted, found));
    }
  }
  return out;
}

/**
 * Compare the complete expected note state for each touched clip.
 *
 * `disagreementsOf` proves that requested notes landed. This second comparison
 * also finds an added, removed, or changed note that another writer introduced
 * on the same clip while the mutation settled. Note writes merge, so the prior
 * snapshot is part of the expected result.
 */
export function mutationStateDisagreementsOf(
  ops: readonly Op[],
  before: Snapshot,
  after: Snapshot,
  unread: ReadonlySet<string> = new Set(),
): Disagreement[] {
  const touched = new Map<string, { clip: Extract<Op, { op: 'note.write' }>['clip']; channels: Map<number, NoteRecord[]> }>();
  for (const op of ops) {
    if (op.op !== 'note.write' && op.op !== 'note.clear') continue;
    const key = addressKey(op.clip);
    let target = touched.get(key);
    if (target === undefined) {
      const channels = new Map<number, NoteRecord[]>();
      for (let channel = 0; channel < 16; channel += 1) {
        const entry = before.entries[addressKey(notesAt(op.clip, channel))];
        channels.set(channel, entry?.value.of === 'notes' ? [...entry.value.notes] : []);
      }
      target = { clip: op.clip, channels };
      touched.set(key, target);
    }
    if (op.op === 'note.clear') {
      for (let channel = 0; channel < 16; channel += 1) target.channels.set(channel, []);
      continue;
    }
    const channel = op.channel ?? 0;
    const notes = [...(target.channels.get(channel) ?? [])];
    for (const note of op.notes) {
      const at = notes.findIndex((candidate) => sameNoteCell(candidate, note));
      if (at === -1) notes.push(note);
      else notes[at] = note;
    }
    target.channels.set(channel, truncateAdjacentNotes(notes));
  }

  const out: Disagreement[] = [];
  for (const target of touched.values()) {
    for (let channel = 0; channel < 16; channel += 1) {
      const address = notesAt(target.clip, channel);
      if (unread.has(addressKey(address))) continue;
      const entry = after.entries[addressKey(address)];
      const found = entry?.value.of === 'notes' ? entry.value.notes : [];
      const expected = target.channels.get(channel) ?? [];
      for (const wanted of expected) {
        const got = found.find((candidate) => sameNoteCell(candidate, wanted));
        if (got === undefined) {
          out.push({
            address,
            at: noteLabel(wanted),
            field: 'completeState.exists',
            requested: true,
            readback: false,
          });
          continue;
        }
        out.push(...compareCompleteNote(address, wanted, got));
      }
      for (const got of found) {
        if (expected.some((wanted) => sameNoteCell(wanted, got))) continue;
        out.push({
          address,
          at: noteLabel(got),
          field: 'completeState.exists',
          requested: false,
          readback: true,
        });
      }
    }
  }
  return out;
}

const COMPLETE_NOTE_DEFAULTS: Readonly<Record<string, unknown>> = {
  velocitySpread: 0,
  gain: 0,
  pan: 0,
  pressure: 0,
  timbre: 0,
  transpose: 0,
  chance: 1,
  isChanceEnabled: true,
  isMuted: false,
  isOccurrenceEnabled: true,
  occurrence: 'ALWAYS',
  isRecurrenceEnabled: true,
  recurrence: [1, 1],
  isRepeatEnabled: true,
  repeatCount: 0,
  repeatCurve: 0,
  repeatVelocityCurve: 0,
  repeatVelocityEnd: 0,
};

function compareCompleteNote(address: Address, wanted: NoteRecord, got: NoteRecord): Disagreement[] {
  const fields = ['velocity', 'durationBeats', 'releaseVelocity', ...Object.keys(COMPLETE_NOTE_DEFAULTS)];
  return fields.flatMap((field): Disagreement[] => {
    const expected = noteFieldValue(wanted, field);
    const actual = noteFieldValue(got, field);
    if (equalEnough(expected, actual)) return [];
    return [{
      address,
      at: noteLabel(wanted),
      field: `completeState.${field}`,
      requested: expected,
      readback: actual,
    }];
  });
}

function noteFieldValue(note: NoteRecord, field: string): unknown {
  const value = (note as unknown as Record<string, unknown>)[field];
  if (value !== undefined) return value;
  if (field === 'releaseVelocity') return 100 / 127;
  return COMPLETE_NOTE_DEFAULTS[field];
}

function sameNoteCell(left: NoteRecord, right: NoteRecord): boolean {
  return left.pitch === right.pitch && Math.abs(left.startBeats - right.startBeats) < 1e-9;
}

function truncateAdjacentNotes(notes: readonly NoteRecord[]): NoteRecord[] {
  const byPitch = new Map<number, NoteRecord[]>();
  for (const note of notes) {
    const group = byPitch.get(note.pitch) ?? [];
    group.push(note);
    byPitch.set(note.pitch, group);
  }
  return [...byPitch.values()].flatMap((group) => {
    const ordered = [...group].sort((left, right) => left.startBeats - right.startBeats);
    return ordered.map((note, index) => {
      const next = ordered[index + 1];
      if (next === undefined) return note;
      const room = next.startBeats - note.startBeats;
      return note.durationBeats > room ? { ...note, durationBeats: room } : note;
    });
  }).sort((left, right) => left.startBeats - right.startBeats || left.pitch - right.pitch);
}

function retryableMutationDifference(disagreement: Disagreement): boolean {
  return disagreement.field !== 'completeState.exists' || disagreement.readback === false;
}

/** Keep only metadata requests that still describe the clip at batch end. */
function finalClipMetadataUpdates(
  ops: readonly Op[],
): ReadonlyMap<string, Extract<Op, { op: 'clip.update' }>> {
  const updates = new Map<string, Extract<Op, { op: 'clip.update' }>>();
  for (const op of ops) {
    if (op.op === 'clip.update') {
      updates.set(addressKey(op.clip), op);
      continue;
    }
    if (op.op === 'clip.delete') {
      updates.delete(addressKey({ kind: 'clip', slot: op.slot }));
      continue;
    }
    if (op.op === 'clip.move') updates.delete(addressKey(op.source));
  }
  return updates;
}

function compareClipMetadata(
  address: Address,
  requested: ClipMetadataState,
  readback: ClipMetadataState,
): Disagreement[] {
  const fields: readonly [string, unknown, unknown][] = [
    ['name', requested.name, readback.name],
    ['color.red', requested.color.red, readback.color.red],
    ['color.green', requested.color.green, readback.color.green],
    ['color.blue', requested.color.blue, readback.color.blue],
    ['lengthBeats', requested.lengthBeats, readback.lengthBeats],
    ['playStartBeats', requested.playStartBeats, readback.playStartBeats],
    ['loopEnabled', requested.loopEnabled, readback.loopEnabled],
    ['loopStartBeats', requested.loopStartBeats, readback.loopStartBeats],
    ['loopEndBeats', requested.loopEndBeats, readback.loopEndBeats],
  ];
  return fields
    .filter(([, asked, found]) => !equalEnough(asked, found))
    .map(([field, asked, found]) => ({
      address,
      at: 'clip metadata',
      field,
      requested: asked,
      readback: found,
    }));
}

const noteLabel = (n: NoteRecord): string => `pitch ${n.pitch} @ beat ${n.startBeats}`;

/** `NoteRecord` names time in beats; `NOTE_PROP_FIDELITY` names the API property. */
const FIDELITY_KEY: Record<string, string> = { durationBeats: 'duration' };

function compareNote(address: Address, wanted: NoteRecord, got: NoteRecord): Disagreement[] {
  const out: Disagreement[] = [];
  const a = wanted as unknown as Record<string, unknown>;

  for (const field of Object.keys(a)) {
    if (field === 'startBeats' || field === 'pitch') continue;
    const requested = noteFieldValue(wanted, field);
    const readback = noteFieldValue(got, field);
    if (equalEnough(requested, readback)) continue;
    const known = knownDivergence(field, requested, readback);
    out.push({ address, at: noteLabel(wanted), field, requested, readback, ...(known === undefined ? {} : { known }) });
  }
  return out;
}

function equalEnough(a: unknown, b: unknown): boolean {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= TOLERANCE;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => equalEnough(v, b[i]));
  }
  return a === b;
}

/**
 * Is this divergence a MEASURED Bitwig behaviour rather than a surprise?
 *
 * Derived from `NOTE_PROP_FIDELITY` so that a property promoted to `exact` by a
 * later probe stops being excused here automatically — an excuse that outlives
 * its measurement is how a real regression gets filed as "known".
 */
function knownDivergence(field: string, requested: unknown, readback: unknown): string | undefined {
  const key = FIDELITY_KEY[field] ?? field;
  const fidelity = NOTE_PROP_FIDELITY[key as keyof typeof NOTE_PROP_FIDELITY];

  if (fidelity === 'unverified') {
    return `${key} has an unverified write/read inverse.`;
  }
  if (fidelity === 'unwritable') {
    return `${key} cannot be written through this API (E15-E) — it should not have been emitted at all.`;
  }
  if (key === 'duration' && typeof requested === 'number' && typeof readback === 'number' && readback < requested) {
    return 'a duration that came back SHORTER is the same-pitch adjacency rule: Bitwig ends a ' +
      'note where the next note of that pitch begins (E8-E). The take stores the readback, ' +
      'because storing the request would make a revert restore a state that never existed.';
  }
  return undefined;
}

/**
 * The launcher cell an address hangs off, as `channelId:slot` — or `undefined`
 * when it does not hang off one at all.
 *
 * ⚠ Built from the DURABLE half of the address and the slot index, never from a
 * bank position, because the events it is matched against are keyed the same way
 * for the same reason (standing rule 2). A track address has no slot and a scene
 * address spans every track: neither names a cell, so neither can excuse an event
 * naming one.
 */
function slotKeyOf(address: Address): string | undefined {
  const trackRef = addressTrack(address);
  const sceneRef = addressScene(address);
  if (trackRef === undefined || sceneRef === undefined) return undefined;
  return `${trackRef.channelId}:${sceneRef.index}`;
}

/** Why a launcher window cannot be believed — one sentence per way it can fail. */
function undecidableWhy(delta: ContentDelta): string {
  if (delta.discontinuity === 'project-changed') {
    return 'a DIFFERENT PROJECT was loaded while this batch ran. The extension never restarted, ' +
      'so both epoch counters kept climbing and nothing about the numbers looks wrong — but ' +
      'every address this batch used names a track in a project that is no longer open. ' +
      'Re-resolve everything before writing again.';
  }
  if (delta.discontinuous) {
    return 'this batch\'s mark was taken in a previous life of the extension (Bitwig restarted, ' +
      'or the extension reloaded), so both epoch counters restarted and nothing before can be ' +
      'compared with anything after. Whether anyone edited alongside this batch is unknowable, ' +
      'and every positional address minted before the restart must be re-resolved.';
  }
  if (delta.truncated) {
    return `more launcher edits happened during this batch (${delta.now - delta.since}) than the ` +
      'extension\'s event log holds, so the ones it dropped cannot be named. Something moved and ' +
      'we cannot say what — treat every positional clip address as suspect.';
  }
  return 'at least one launcher event could not name the track it happened on, so it cannot be ' +
    'told apart from an edit inside this batch\'s own write-set. Something moved; which slot is ' +
    'known, whose track is not.';
}
