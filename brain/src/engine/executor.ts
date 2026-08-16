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
  AddressUnresolvedError, CONTRACT_TAG, GAIN_READ_SCALE, NOTE_PROP_FIDELITY,
  StaleAddressError, addressKey, addressScene, addressTrack, assertDevicesRoutable, assertOpsWritable,
  blindSpotError, deltaComplete,
  failures, notes as notesAt,
  type Address, type AdapterInfo, type BitwigAdapter, type ContentDelta, type NoteRecord,
  type Op, type RevisionMark, type Snapshot,
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

  constructor(adapter: BitwigAdapter, options: ExecutorOptions = {}) {
    this.adapter = adapter;
    this.newId = options.newId ?? (() => randomUUID());
    this.now = options.now ?? (() => Date.now());
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

    await this.assertResolvable(addresses);
    const stash = await this.adapter.read(addresses);
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
    const receipt = await this.adapter.apply({ ops, ifRevision: stash.at.revision });

    if (receipt.rejected !== undefined) {
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
    const verify = await this.adapter.read(readable);

    // ⚠ Asked AFTER the verify read, so the window covers the whole pipeline —
    // stash, apply, settle and verify. PHASE-1's open question is *"what happens
    // when the user edits inside the write-set after the agent wrote"*, and the
    // moment after the verify is the latest one at which this batch is still the
    // thing that can report it.
    const seen = await this.concurrent(stash.at, targets, true);

    return this.take({
      ops, targets, unrevertable: [...unrevertable, ...unobserved], stash, receipt, verify, values,
      disagreements: disagreementsOf(ops, verify, new Set(unverified.map((u) => addressKey(u.address)))),
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
        default:
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
  }

  /**
   * ⚠ E2, and the nastiest trap in the set: pointing at an EMPTY slot silently
   * lands the cursor on the WRONG clip, with `cursor.status` looking entirely
   * healthy. There is no error and no signal — the note simply appears somewhere
   * nobody addressed, or nowhere at all.
   *
   * The mitigation is procedural ("create the clip first, always", D6) and it is
   * invisible unless something checks. The stash already tells us: a `notes`
   * address whose entry is missing had no clip behind it. A batch that CREATES
   * that clip is fine — `planStages` gives `clip.create` its own stage and a
   * `trackStruct` settle, so the slot is real by the time the notes go out.
   */
  private assertClipsExist(ops: readonly Op[], stash: Snapshot): void {
    const created = new Set(
      ops.filter((o) => o.op === 'clip.create').map((o) => addressKey(o.slot)),
    );
    for (const op of ops) {
      if (op.op !== 'note.write' && op.op !== 'note.props' && op.op !== 'note.clear') continue;
      if (created.has(addressKey(op.clip.slot))) continue;
      const address = notesAt(op.clip, op.channel ?? 0);
      if (stash.entries[addressKey(address)] !== undefined) continue;
      throw new AddressUnresolvedError(
        address,
        `${op.op} addresses a slot that holds no clip. Pointing at an empty slot silently lands ` +
          'the cursor on a DIFFERENT clip and reports a healthy status (E2), so this batch would ' +
          'either write into a clip nobody addressed or write nowhere at all. Emit `clip.create` ' +
          'for the slot in the same batch — it stages ahead of the write — or create it first.',
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
 *   - `gain` reads back doubled (E2);
 *   - a mis-pointed write lands somewhere else entirely (E2), which shows up
 *     here as a note that simply is not present.
 *
 * Only `note.write` states a request about note content, so only it is checked.
 * `note.props` is generated FROM a `note.write` by `planStages` and carries the
 * same values, so checking it too would double-report every property.
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

const noteLabel = (n: NoteRecord): string => `pitch ${n.pitch} @ beat ${n.startBeats}`;

/** `NoteRecord` names time in beats; `NOTE_PROP_FIDELITY` names the API property. */
const FIDELITY_KEY: Record<string, string> = { durationBeats: 'duration' };

function compareNote(address: Address, wanted: NoteRecord, got: NoteRecord): Disagreement[] {
  const out: Disagreement[] = [];
  const a = wanted as unknown as Record<string, unknown>;
  const b = got as unknown as Record<string, unknown>;

  for (const field of Object.keys(a)) {
    if (field === 'startBeats' || field === 'pitch') continue;
    const requested = a[field];
    const readback = b[field];
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
    const doubled = typeof requested === 'number' && typeof readback === 'number'
      && Math.abs(readback - requested * GAIN_READ_SCALE) <= TOLERANCE;
    return doubled
      ? `${key} reads back exactly ${GAIN_READ_SCALE}x written, as measured (E2). The inverse is ` +
        'unverified, so this is reported and never corrected (D8).'
      : `${key} has an unverified round-trip (E2, D8).`;
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
