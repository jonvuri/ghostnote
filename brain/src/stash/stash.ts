/**
 * The stash — what the world looked like before each of this session's batches,
 * and the one thing that survived the take store (D17 rev).
 *
 * ## ⚠ What this is NOT any more
 *
 * This file was `store.ts`: a durable, branchable, project-keyed take log on
 * disk. D18 made the system stateless and **the project the take log** — takes
 * are real structures in the project (track forks, layer chains, clip blocks) and
 * navigation is *switching* between them, not materialising a revert. So the head
 * pointer, the parent edges, the path walk, the on-disk layout, the retention
 * policy and the project key are all gone, along with `graph.ts` and
 * `project.ts`.
 *
 * ⚠ D17c's trap keeps its force in the new form and is worth restating where
 * someone is most likely to reach for it: **a navigation is a SWITCH, never an
 * edit.** Nothing here may record one, because a recorded navigation is a step
 * the next navigation would then reverse.
 *
 * ## Why it survived anyway — three jobs, and losing any one is a data-loss bug
 *
 * D19 spells them out, and the disposition table warns twice that the stash is
 * easy to delete along with the store:
 *
 *   1. **Unbranched writes.** A branch isolates a TRACK. Every write that is not
 *      track-scoped — tempo, scenes, the master, the FX returns, cross-track
 *      routing — has no fork that could rescue it, and neither does an ordinary
 *      write the caller did not branch. For all of those the stash is the only
 *      "before" that exists.
 *   2. ⚠ **The clip content fingerprint.** Clips are addressed positionally
 *      (D16a — there is no durable clip id and we are not inventing one), so a
 *      positional address is only trustworthy while the content behind it is
 *      still what we last saw. `boundary()` is that check.
 *   3. **Agent-edit reversal (D19).** Bitwig's undo stack is the human's; the
 *      agent's own edits are ours to put back, best-effort, saying best-effort
 *      through D8/D16's existing fidelity labels.
 *
 * ## ⚠ The boundary, which is the new thing here
 *
 * D19 bounds reversal **structurally, twice**:
 *
 *   - **To the session's own changesets.** The stash holds exactly the batches
 *     this session ran, so "reverse X" is unaskable for anything else — it is the
 *     shape of the API rather than a rule to remember (`ChangesetNotFoundError`).
 *   - **To what we mint-and-LAST-WROTE.** *"Reversal that would destroy anything
 *     the agent did not itself mint-and-last-write is withheld and reported
 *     through the fidelity machinery, never silently escalated to destruction."*
 *     That needs evidence, not bookkeeping — hence `readSetFor` → read →
 *     `planReversal(id, current)`. A withheld address travels out as an
 *     `Unrestored`, the same channel `gain` and `pressure` already use, so no
 *     caller learns a second concept for "we did not put this back".
 *
 * ⚠ **Reversal is not reaping** (D20), so nothing here is gated: clean reverts
 * *"need no approval beyond the instruction that directed them."* The gate is the
 * boundary above — what falls outside it is not escalated to the destructive
 * surface by this module, it is reported and left alone.
 *
 * ## The privilege split, kept — and its justification has MOVED
 *
 * D17g survives outright, but read it against D20: the privilege boundary is now
 * *"at the MCP tool surface (D12 amendment) rather than around a store object."*
 * The type split below is therefore no longer THE boundary — it is the in-process
 * seam that makes the boundary cheap to hold, and `surface.test.ts` still asserts
 * it in the `WIRE_METHODS_BANNED` spirit: the ban is reviewable rather than
 * merely stated.
 */
import {
  addressKey, addressScene, addressTrack, contentTouching, deltaComplete,
  type Address, type AddressKey, type ClipAddress, type ContentDelta, type Fidelity, type Op,
  type Snapshot, type StateEntry, type TrackAddress,
} from '../contract/index.js';
import {
  ownChangesetReversal, revertOps, worstOf,
  type Clearance, type InsertBatch, type RevertInput, type Take, type TakeValue,
  type Unrestored, type UnrevertableOp, type WriteTarget,
} from '../engine/index.js';
import { ChangesetNotFoundError, DuplicateChangesetError } from './errors.js';
import {
  inBounds, sameValue,
  type BoundaryCheck, type BoundaryVerdict, type ChangesetSummary, type StashedChangeset,
} from './record.js';
import { assertSelects, isWholeTake, selectClip, selectTrack, selects, type Slice } from './slice.js';

/**
 * A reversal, fully described BEFORE anything runs.
 *
 * D5's *"a revert never silently under-delivers"* is a promise about what a
 * caller can read IN ADVANCE, so `fidelity`, `unrestored` and `withheld` are all
 * computed by planning: "this cannot put everything back" is answerable without
 * applying a single op.
 */
export interface ReversalPlan {
  /** The changeset being put back. */
  readonly of: string;
  /** Ready for `Executor.run`. Empty is a legitimate answer — see `unrestored`. */
  readonly ops: readonly Op[];
  /**
   * ⚠ Hand this to `Executor.run` alongside the ops. D19/D20: putting our own
   * changeset back rides the ordinary write surface and is not gated, and the
   * floor would otherwise refuse the reversal of any lossy batch — i.e. exactly
   * the batches most worth reversing.
   */
  readonly clearance: Clearance;
  /**
   * D5's "never silently" half, in ONE channel: fidelity withholds (`gain`,
   * `pressure`, `none`-labelled addresses) and boundary withholds arrive here
   * together, because to the human they are the same sentence.
   */
  readonly unrestored: readonly Unrestored[];
  /** The boundary detail behind the withholds, for a caller that wants to explain. */
  readonly withheld: readonly BoundaryCheck[];
  /** The worst label across this reversal, counting a withheld address as `none`. */
  readonly fidelity: Fidelity;
  readonly caveats: readonly string[];
  /** The addresses the ops actually cover — post-slice, post-boundary. */
  readonly addresses: readonly AddressKey[];
  readonly slice?: Slice;
}

/** Options for planning a reversal. */
export interface ReversalOptions {
  readonly slice?: Slice;
  /**
   * ⚠ What the clip launcher has done since this changeset ran
   * (`adapter.contentSince(take.at)`), so the boundary can see a MOVE.
   *
   * Optional, and the omission is REPORTED rather than silently tolerated: a
   * caller that does not supply one gets the pre-session-3 boundary — content
   * comparison alone, which cannot distinguish "still our clip" from "an
   * identical clip somebody dragged in" — plus a caveat saying exactly that.
   * *"An unchecked address is not an unchanged one"* is already this module's
   * doctrine for `unread`; this is the same sentence about a different check.
   */
  readonly launcher?: ContentDelta;
}

// --- the read half -----------------------------------------------------------

/**
 * Everything a caller may do with the stash: read it, check it, plan against it.
 *
 * Note what is absent — no `record`, no `forget`, and no property leading back to
 * the object that owns them.
 */
export interface StashLog {
  /** Newest first. */
  list(): readonly ChangesetSummary[];
  has(id: string): boolean;
  get(id: string): StashedChangeset | undefined;
  require(id: string): StashedChangeset;
  summary(id: string): ChangesetSummary;

  /**
   * The changeset that last wrote `key`, of the ones that actually applied.
   *
   * This is what makes a `superseded` verdict sayable rather than a bare
   * "changed" — reversing the middle of two writes to the same clip would clobber
   * our own later work, and the caller deserves to be told which one to reverse.
   */
  lastWriterOf(key: AddressKey): string | undefined;

  /**
   * ⚠ The addresses to read before planning a bounded reversal — the protocol
   * D19 implies and §8b already uses everywhere else (*"a known write-set → read
   * prior state of exactly those addresses"*).
   */
  readSetFor(id: string): readonly Address[];

  /**
   * The boundary verdict for a changeset's own write-set, against a snapshot
   * read now — job 3 (D19). `fingerprint` is the same comparison keyed on
   * addresses, which is job 2's shape.
   */
  boundary(id: string, current: Snapshot, launcher?: ContentDelta): readonly BoundaryCheck[];

  /**
   * ⚠ The same check keyed on ADDRESSES rather than a changeset — what a write
   * about to touch a positional clip address has to ask (D17 rev's *"content
   * fingerprint that guards positional clip addressing"*).
   *
   * Each address is resolved to the changeset that LAST wrote it. An address no
   * changeset of ours ever wrote comes back `unseen`, which is an absence of
   * evidence and not a pass.
   */
  fingerprint(
    addresses: readonly Address[],
    current: Snapshot,
    launcher?: ContentDelta,
  ): readonly BoundaryCheck[];

  /** Put changeset `id` back, as far as the boundary and the labels allow. */
  planReversal(id: string, current: Snapshot, options?: ReversalOptions): ReversalPlan;

  /** The changeset's addresses that belong to one clip — a partial-revert selector. */
  selectClip(id: string, clip: ClipAddress): Slice;
  selectTrack(id: string, track: TrackAddress): Slice;
}

// --- the mutate half ---------------------------------------------------------

/**
 * ⚠ The half that must not be reachable from a `StashLog`.
 *
 * Every member is named in `STASH_MUTATORS` with the reason, so a new mutator
 * added without a matching entry fails `surface.test.ts` rather than quietly
 * becoming a hole.
 */
export interface StashWriter {
  /** Record what a batch did. Returns the record, including its session order. */
  record(take: Take): StashedChangeset;
  /** Drop everything. See `STASH_MUTATORS` for why this one is the sharp edge. */
  forget(): void;
}

/**
 * The mutating surface, named so the ban is reviewable — the `WIRE_METHODS_BANNED`
 * idiom applied to a privilege seam instead of a wire.
 *
 * ⚠ Two entries where the store had six, and that is the point rather than a
 * shortfall: `append`/`setHead`/`label`/`prune`/`adopt`/`publishPointer` were all
 * ways of editing a HISTORY, and there is no history to edit. What is left is the
 * record of what we ourselves just did.
 */
export const STASH_MUTATORS: Readonly<Record<keyof StashWriter, string>> = {
  record: '§8g — a changeset exists because a batch ran, never because the agent asked for one',
  forget:
    '⚠ D19/D20 — forgetting is the destructive mutation here. The stash is the only "before" ' +
    'for every unbranched write, so dropping it does not lose a log, it loses the ability to ' +
    'put the music back. Destruction is never the agent\'s decision (rule 8).',
};

// --- the stash ---------------------------------------------------------------

export interface StashOptions {
  /** Injected so records are deterministic under test. Never a module global. */
  readonly now?: () => number;
}

export class Stash implements StashLog, StashWriter {
  private readonly now: () => number;
  /** ⚠ Insertion order IS session order, and session order is the boundary's clock. */
  private readonly order: StashedChangeset[] = [];
  private readonly byId = new Map<string, StashedChangeset>();
  private readonly readHalf: StashLog;

  constructor(options: StashOptions = {}) {
    this.now = options.now ?? (() => Date.now());
    this.readHalf = this.buildReadHalf();
  }

  /**
   * The read half, as a separate frozen object.
   *
   * ⚠ NOT `this` narrowed to `StashLog`. A narrowing cast is undone by another
   * cast, which makes the seam a comment; a distinct object with only these own
   * properties makes it a fact something can be asserted about. Nothing here
   * closes over a mutator, and the object is frozen so a client cannot bolt one
   * on either.
   */
  get log(): StashLog {
    return this.readHalf;
  }

  private buildReadHalf(): StashLog {
    return Object.freeze<StashLog>({
      list: () => this.list(),
      has: (id) => this.has(id),
      get: (id) => this.get(id),
      require: (id) => this.require(id),
      summary: (id) => this.summary(id),
      lastWriterOf: (key) => this.lastWriterOf(key),
      readSetFor: (id) => this.readSetFor(id),
      boundary: (id, current, launcher) => this.boundary(id, current, launcher),
      fingerprint: (addresses, current, launcher) => this.fingerprint(addresses, current, launcher),
      planReversal: (id, current, options) => this.planReversal(id, current, options),
      selectClip: (id, clip) => this.selectClip(id, clip),
      selectTrack: (id, track) => this.selectTrack(id, track),
    });
  }

  // --- read ----------------------------------------------------------------

  list(): readonly ChangesetSummary[] {
    return [...this.order].reverse().map((c) => summarize(c));
  }

  has(id: string): boolean {
    return this.byId.has(id);
  }

  get(id: string): StashedChangeset | undefined {
    const found = this.byId.get(id);
    // Cloned on the way out: a record a caller can mutate is a "before" that
    // disagrees with the one the reversal will replay, and the read half must not
    // be able to produce that even by accident.
    return found === undefined ? undefined : structuredClone(found);
  }

  require(id: string): StashedChangeset {
    const found = this.byId.get(id);
    if (found === undefined) throw new ChangesetNotFoundError(id);
    return structuredClone(found);
  }

  summary(id: string): ChangesetSummary {
    const found = this.byId.get(id);
    if (found === undefined) throw new ChangesetNotFoundError(id);
    return summarize(found);
  }

  lastWriterOf(key: AddressKey): string | undefined {
    for (let i = this.order.length - 1; i >= 0; i -= 1) {
      const change = this.order[i]!;
      // ⚠ A batch the revision guard rejected applied ZERO ops (D10), so it wrote
      // nothing and cannot be anybody's last writer — its stash is still a true
      // record of that moment, which is why it is kept rather than dropped.
      if (!change.take.report.applied) continue;
      if (change.take.targets.some((t) => t.key === key)) return change.take.id;
    }
    return undefined;
  }

  readSetFor(id: string): readonly Address[] {
    const take = this.requireInternal(id).take;
    const unverified = new Set(take.report.unverified.map((u) => addressKey(u.address)));
    return take.targets
      // ⚠ An address the batch could not verify is EXCLUDED, and not as an
      // optimisation. E3's case is a scene op, which bumps the epoch — so the
      // address is now stale and both adapters THROW rather than resolve it
      // (`StaleAddressError`). Handing a caller a read set that cannot be read is
      // the sort of API that gets worked around with a try/catch. It could never
      // clear the boundary anyway: `unverified` is a verdict, not a maybe.
      .filter((t) => !unverified.has(t.key))
      // A `restore: 'none'` target has no reversal to bound, so reading it buys
      // nothing. `planReversal` bypasses the boundary for exactly these and lets
      // `revertOps` say the sentence the write-set derived.
      .filter((t) => t.restore !== 'none')
      .map((t) => t.address);
  }

  selectClip(id: string, clip: ClipAddress): Slice {
    return selectClip(this.addressesOf(id), clip);
  }

  selectTrack(id: string, track: TrackAddress): Slice {
    return selectTrack(this.addressesOf(id), track);
  }

  private addressesOf(id: string): Address[] {
    return [...this.readSetFor(id)];
  }

  // --- the boundary --------------------------------------------------------

  /**
   * Is each of this changeset's addresses still holding what we left in it?
   *
   * ⚠ Read the verdicts in this order, because each one is a different sentence
   * and collapsing any two of them is how a silent overwrite happens:
   *
   *   `blind`       we cannot SEE it right now (E5, standing rule 5). Not empty.
   *   `unverified`  we never saw what we LEFT (E3's scene-epoch case), so there is
   *                 no "what we wrote" to compare against.
   *   `unread`      the caller did not read it just now. Absent evidence, not
   *                 evidence of absence.
   *   `superseded`  a later changeset of OURS wrote it — reverse that one first,
   *                 or this reversal undoes work we did after.
   *   `changed`     it differs and nothing of ours explains it. Someone else did
   *                 that, and it is not ours to overwrite.
   *   `ours`        it matches. Ours to put back.
   *
   * ⚠ **"Nothing is there" and "we did not look" are read out of DIFFERENT
   * fields**, and conflating them breaks the flagship case in both directions.
   * `Snapshot` separates `entries` from `missing` precisely so a caller can tell
   * them apart — so reversing a `clip.delete` compares "empty now" against "empty
   * when we left" and correctly reads `ours`, where an absence-means-unread rule
   * would withhold the notes replay and leave the clip a shell.
   */
  boundary(id: string, current: Snapshot, launcher?: ContentDelta): readonly BoundaryCheck[] {
    const change = this.requireInternal(id);
    return change.take.targets.map(
      (target) => this.checkOne(target.address, target.key, change, current, launcher),
    );
  }

  /**
   * ⚠ Job 2 of the stash, asked the way a WRITE has to ask it.
   *
   * `boundary` is keyed on a changeset, because a reversal knows which one it is
   * putting back. A write about to touch a positional clip address knows no such
   * thing — it has addresses. So this takes addresses, resolves each one to the
   * changeset that LAST wrote it, and compares against that.
   *
   * ⚠ Shipping only `boundary` was under-delivering on D17 rev's *"content
   * fingerprint that guards positional clip addressing"*: the guard is a
   * pre-write question and the only available form answered a post-write one, so
   * the caller would have had to hand-roll the lookup. Found in review.
   *
   * ⚠ **`unseen` is not a pass.** An address no changeset of ours ever wrote gets
   * no opinion from the stash — the stash can only vouch for what it recorded.
   * The live launcher-content epoch (session 3, in the extension) is what covers
   * the rest, and it is a different mechanism precisely because this one cannot.
   */
  fingerprint(
    addresses: readonly Address[],
    current: Snapshot,
    launcher?: ContentDelta,
  ): readonly BoundaryCheck[] {
    return addresses.map((address) => {
      const key = addressKey(address);
      const lastWriter = this.lastWriterOf(key);
      const change = lastWriter === undefined ? undefined : this.byId.get(lastWriter);
      if (change === undefined) {
        return {
          key,
          address,
          verdict: 'unseen',
          why:
            'no changeset of this session has written this address, so the stash has nothing to ' +
            'compare the world against. That is an ABSENCE OF EVIDENCE, not a clean bill of ' +
            'health — a positional clip address the agent has never written is exactly the case ' +
            'the launcher-content epoch exists for (E16s).',
        };
      }
      // ⚠ Compared against the LAST writer, so `superseded` cannot arise here by
      // construction: there is no later changeset of ours to be superseded by.
      return this.checkOne(address, key, change, current, launcher);
    });
  }

  /**
   * One address, against one changeset's record of what it left there.
   *
   * Shared by both callers so the two questions cannot drift apart — the same
   * comparison, differing only in which changeset supplies the "what we left".
   */
  private checkOne(
    address: Address,
    key: AddressKey,
    change: StashedChangeset,
    current: Snapshot,
    launcher?: ContentDelta,
  ): BoundaryCheck {
    const unverified = new Set(change.take.report.unverified.map((u) => addressKey(u.address)));
    const blind = new Set(current.unreachable.map((a) => addressKey(a)));
    const verify = change.take.verify;
    const lastWriter = this.lastWriterOf(key);

    const base = { key, address, ...(lastWriter === undefined ? {} : { lastWrittenBy: lastWriter }) };
    const verdict = (v: BoundaryVerdict, why: string): BoundaryCheck => ({ ...base, verdict: v, why });

    if (blind.has(key)) {
      return verdict('blind',
        'this address is outside the bank window in the read just taken — invisible, which is ' +
        'not the same as unchanged (E5, standing rule 5). Nothing can be concluded about it, ' +
        'so nothing is written to it.');
    }
    if (unverified.has(key) || !observed(verify, key)) {
      return verdict('unverified',
        'the batch that wrote this address could not read it back afterwards (E3: it changed ' +
        'the scene layout, which invalidates every scene-relative address minted before it). ' +
        'There is no record of what we left here, so there is nothing to compare the world ' +
        'against and no way to tell our own work from a human\'s.');
    }
    // ⚠ BEFORE `unread`, and that ordering is the mechanism's whole contribution.
    // A move is visible without reading the address at all — that is what a PUSHED
    // detector buys over a polled one — so an address nobody read this turn can
    // still be known to have moved. Putting this after `unread` would throw the
    // one verdict away that needs no snapshot.
    const moved = launcher === undefined ? [] : contentTouching(launcher, address);
    if (moved.length > 0 && !this.explainedByUs(change, address, moved)) {
      return verdict('moved',
        'the clip launcher reports this slot ' +
        `${moved.map((e) => (e.filled ? 'filling' : 'emptying')).join(' then ')} since this ` +
        'batch wrote it, and no changeset of this session did that. ⚠ Note what this does NOT ' +
        'depend on: the contents may compare byte-identical and the address still not mean what ' +
        'it meant, because clips are addressed by position and have no durable id (D16a). A ' +
        'clip dragged out and an identical one dragged in is exactly this case (E16s). ' +
        'Re-resolve before writing.');
    }
    if (!observed(current, key)) {
      return verdict('unread',
        'this address was not in the snapshot handed to the boundary check, so whether it ' +
        'still holds our work is unevaluated. Read `readSetFor(id)` and try again — an ' +
        'unchecked address is not an unchanged one.');
    }
    if (!sameValue(current.entries[key]?.value, verify.entries[key]?.value)) {
      if (lastWriter !== undefined && lastWriter !== change.take.id) {
        return verdict('superseded',
          `changeset ${lastWriter} wrote this address after ${change.take.id} did, so what is ` +
          'there now is our own later work. Putting the earlier "before" back would discard ' +
          'it silently. Reverse the later changeset first, or slice this one to exclude ' +
          'this address.');
      }
      return verdict('changed',
        'what is in this address now is not what this batch left there, and no changeset of ' +
        'this session explains the difference — so a human edited it. Reversal is bounded to ' +
        'what we ourselves last wrote (D19): overwriting this would be destroying somebody ' +
        'else\'s work, which is never the agent\'s decision (D20, rule 8).');
    }
    // ⚠ LAST, and only over `ours`. An unusable launcher window is not evidence
    // against a specific address — it is the absence of the evidence that would
    // let us say `ours` about a POSITIONAL one. Every more specific verdict above
    // already stands on its own, and a track or device address is untouched
    // because the launcher observer never had anything to say about it.
    if (launcher !== undefined && !deltaComplete(launcher) && isLauncherCell(address)) {
      return verdict('undecidable', undecidableWhy(launcher));
    }
    return verdict('ours', '');
  }

  /**
   * Do THIS session's own ops account for the launcher events on this address?
   *
   * ⚠ The callback carries no author, so this is answered from our own record of
   * what we asked for — never from the event, which cannot tell us. Only
   * `clip.create` and `clip.delete` change a slot's occupancy: a note write into
   * a clip that already exists fires nothing (and a write into a slot that does
   * not is refused before it runs, E2). So the expected count is derivable, and
   * anything beyond it came from somewhere else.
   *
   * ⚠ Counted per direction rather than matched as a sequence. Our ops and a
   * human's interleave in an order nobody records, so sequence equality would be
   * brittle in the direction that matters — it would report `moved` for an
   * ordinary batch and the verdict would stop being believed. Fills and empties
   * are counted separately so a swap (one of each) cannot hide inside a total.
   *
   * ⚠ This is a count, and standing rule 13 says name the survivor rather than
   * count it. The rule is about OBJECTS, where a count of 3 is also what deleting
   * the wrong one produces; there is no object here to name, only edges, and the
   * comparison fails toward REPORTING — an excess is always a move, a shortfall
   * never conceals one.
   *
   * ⚠ Every changeset from this one onward counts, not just this one. A later
   * batch of ours that re-created the clip is our work too; the content
   * comparison below then reports it as `superseded`, which is the truer sentence
   * and is already the right one.
   */
  private explainedByUs(
    change: StashedChangeset,
    address: Address,
    observed: readonly { readonly filled: boolean }[],
  ): boolean {
    const key = slotOf(address);
    if (key === undefined) return false;
    let fills = 0;
    let empties = 0;
    for (const record of this.order) {
      if (record.seq < change.seq) continue;
      if (!record.take.report.applied) continue;
      for (const op of record.take.ops) {
        if (op.op === 'clip.create' && slotOf(op.slot) === key) fills++;
        if (op.op === 'clip.delete' && slotOf(op.slot) === key) empties++;
      }
    }
    return observed.filter((e) => e.filled).length <= fills
      && observed.filter((e) => !e.filled).length <= empties;
  }

  /**
   * Plan the reversal of one changeset — the whole verb, and the only one.
   *
   * ⚠ The store had two verbs (`planTo`, `planRevert`) because it had a graph to
   * walk. There is no graph: reversal undoes ONE batch's own write-set and
   * nothing else, which is also what makes a partial reversal of it meaningful.
   * A/B between takes is Bitwig's own surface now (D14 rev, D18) — mute, solo,
   * clip launch — and is not this module's business.
   */
  planReversal(id: string, current: Snapshot, options: ReversalOptions = {}): ReversalPlan {
    const change = this.requireInternal(id);
    const take = change.take;
    const slice = options.slice;
    const whole = isWholeTake(slice);

    assertSelects(slice, take.targets.map((t) => t.key));

    // ⚠ A batch the revision guard rejected applied ZERO ops (D10/E8-D), so its
    // reversal is nothing — not "restore the stash". The stash and the verify are
    // the SAME snapshot for a rejected take, so the boundary would read `ours` and
    // `revertOps` would happily emit a `note.clear`/`note.write` pair that rewrites
    // a clip to itself. Writing is never free: E8-E's same-pitch truncation means
    // "restore this to what it already is" can still change durations.
    if (!take.report.applied) {
      return {
        of: take.id,
        ops: [],
        clearance: ownChangesetReversal(take.id),
        unrestored: [],
        withheld: [],
        fidelity: 'exact',
        caveats: [
          'this batch applied nothing — the revision guard rejected it whole (D10), so there is ' +
          'nothing to put back. Its stash is kept because it is a true record of the world at ' +
          'that moment, not because it is a step.',
        ],
        addresses: [],
        ...(slice === undefined ? {} : { slice }),
      };
    }

    const checks = this.boundary(id, current, options.launcher);
    const verdict = new Map(checks.map((c) => [c.key, c]));
    const unrestored: Unrestored[] = [];
    const withheld: BoundaryCheck[] = [];

    // ⚠ Pass 1: a clip this batch CREATED is reversed by deleting it, and that is
    // the one inverse that destroys rather than restores. D19 wants
    // mint-and-LAST-WRITE, and the mint alone is not enough — a human may have
    // played into the clip since. The evidence for "and last wrote" is the notes
    // address on that same clip, and only this changeset's own write-set can
    // supply it: a stash that went looking for addresses it never wrote would be
    // minting addresses, which is the contract's job and not ours (D16a).
    //
    // ⚠ The verdict PROPAGATES from the content address to the clip address. A
    // clip whose slot still reads exactly as we left it is `ours` on its own
    // terms, and reporting that while refusing to delete it would put a verdict
    // in `withheld` that contradicts the withholding.
    const undeletable = new Map<AddressKey, { verdict: BoundaryVerdict; why: string }>();
    for (const target of take.targets) {
      if (!deletesTheClip(target, take)) continue;
      const content = take.targets.filter((t) => coversClipContent(t, target.key));
      if (content.length === 0) {
        // ⚠ Unreachable today, and worth keeping because WHY it is unreachable is
        // a coupling that would otherwise be silent: `clip.create` pairs its clip
        // address with the channel-0 notes address in `write-set.ts`, so the
        // evidence is always there. Break that pairing and this fails closed
        // rather than deleting a clip whose contents nobody ever looked at.
        undeletable.set(target.key, {
          verdict: 'unread',
          why:
            'this batch created the clip but never wrote or read its contents, so the stash ' +
            'cannot tell whether anything has been put in it since. Deleting it would be ' +
            'destroying work we cannot see (D19). The clip stays.',
        });
        continue;
      }
      const worst = content.find((t) => !inBounds(verdict.get(t.key)!));
      if (worst !== undefined) {
        const inherited = verdict.get(worst.key)!.verdict;
        undeletable.set(target.key, {
          verdict: inherited,
          why:
            'this batch created the clip, but its contents are no longer what we left there ' +
            `(${inherited}). Deleting the clip would take those contents with it, so the clip ` +
            'stays and the notes address says why.',
        });
      }
    }

    // ⚠ Pass 2: the surviving targets. `revertOps` is session 1's function and is
    // NOT reimplemented here — the whole point of `RevertInput` taking a target
    // list is that a sliced or boundary-narrowed reversal is the same code path as
    // a whole one and cannot disagree with it about what restoring means.
    const targets: WriteTarget[] = [];
    const entries: Record<AddressKey, StateEntry> = {};
    const unreachable: Address[] = [];
    const labels: TakeValue[] = [];

    for (const target of take.targets) {
      if (!selects(slice, target.key)) continue;
      const label = take.values.find((v) => v.key === target.key);

      // ⚠ A `restore: 'none'` target bypasses the boundary, and must. Its
      // reversal writes NOTHING — `revertOps` turns it straight into an
      // `unrestored` carrying the reason the write-set derived (*a recreated
      // track mints a new channelId*, E2f) — so there is no destruction for the
      // boundary to bound, and running the check anyway would replace that exact
      // sentence with a vaguer one about evidence.
      //
      // ⚠ Its LABEL still counts. It is `none` by construction, and dropping it
      // here made a plan that could restore nothing report `exact` — caught by a
      // test, and it is the exact under-delivery D5 forbids.
      if (target.restore === 'none') {
        targets.push(target);
        if (label !== undefined) labels.push(label);
        continue;
      }
      const check = verdict.get(target.key)!;
      const blocked = undeletable.get(target.key);
      if (!inBounds(check) || blocked !== undefined) {
        const reported = blocked === undefined ? check : { ...check, ...blocked };
        withheld.push(reported);
        unrestored.push({
          address: target.address,
          what: target.address.kind,
          why: reported.why,
        });
        continue;
      }
      targets.push(target);
      const entry = take.stash.entries[target.key];
      if (entry !== undefined) entries[target.key] = entry;
      if (take.stash.unreachable.some((a) => addressKey(a) === target.key)) {
        unreachable.push(target.address);
      }
      if (label !== undefined) labels.push(label);
    }

    // ⚠ A SLICE cannot un-insert a device, and says so rather than silently
    // leaving it out: slicing selects ADDRESSES and an insert has none, so
    // "restore just this clip" has no honest reading under which a device also
    // disappears. Reverse the whole changeset to remove it.
    const unrevertable: UnrevertableOp[] = [
      ...take.unrevertable,
      ...(whole ? [] : slicedInserts(take)),
    ];
    const batches: InsertBatch[] = whole
      ? [{ ops: take.ops, minted: take.receipt.minted }]
      : [];

    const input: RevertInput = {
      targets,
      unrevertable,
      stash: { ...take.stash, entries, unreachable },
      ...(batches.length === 0 ? {} : { batches }),
    };
    const plan = revertOps(input);

    const caveats = dedupe([
      ...labels.flatMap((l) => l.caveats),
      ...(plan.ops.some((o) => o.op === 'device.delete') ? [DEVICE_INDEX_CAVEAT] : []),
      ...(options.launcher === undefined && take.targets.some((t) => isLauncherCell(t.address))
        ? [NO_LAUNCHER_WINDOW_CAVEAT]
        : []),
    ]);

    return {
      of: take.id,
      ops: plan.ops,
      // ⚠ D19/D20, and it must be here rather than left to the caller: the floor
      // grades the state a batch is about to overwrite, and the state a reversal
      // overwrites is by construction the one this changeset already recorded. A
      // caller that forgot the clearance would find every lossy batch impossible
      // to undo — the deadlock version of the rule.
      clearance: ownChangesetReversal(take.id),
      unrestored: [...plan.unrestored, ...unrestored],
      withheld,
      // ⚠ A withheld address is not restored AT ALL, so it counts as `none` here.
      // Reporting the worst of the SURVIVING labels would let a reversal that
      // silently dropped half its write-set claim `exact`, which is the precise
      // shape of under-delivery D5 forbids.
      fidelity: worstOf([
        ...labels,
        ...withheld.map(() => ({ fidelity: 'none' as Fidelity })),
      ]),
      caveats,
      addresses: targets.map((t) => t.key),
      ...(slice === undefined ? {} : { slice }),
    };
  }

  // --- mutate --------------------------------------------------------------

  /**
   * Record what a batch did.
   *
   * ⚠ A REJECTED batch is recorded too. It applied zero ops (D10), so it is
   * nobody's last writer and reverses to nothing — but its stash is a true record
   * of the world at that moment, and "someone else wrote first" is a fact about
   * the session that the caller should be able to read back rather than infer
   * from an absence.
   */
  record(take: Take): StashedChangeset {
    if (this.byId.has(take.id)) throw new DuplicateChangesetError(take.id);
    const change: StashedChangeset = {
      seq: this.order.length + 1,
      recordedAtMs: this.now(),
      take,
    };
    this.order.push(change);
    this.byId.set(take.id, change);
    return structuredClone(change);
  }

  forget(): void {
    this.order.length = 0;
    this.byId.clear();
  }

  /** Uncloned, for internal use only — the clone is what `require` is for. */
  private requireInternal(id: string): StashedChangeset {
    const found = this.byId.get(id);
    if (found === undefined) throw new ChangesetNotFoundError(id);
    return found;
  }
}

// --- helpers -----------------------------------------------------------------

/**
 * ⚠ The caveat for a reversal planned WITHOUT the launcher window.
 *
 * Not defensive padding. The content fingerprint's blind spot is specific and
 * nameable — it compares what is in a slot, so a clip dragged away and an
 * identical one dragged in reads as unchanged — and a caller who never learns
 * the window was skipped has no way to know a `ours` verdict was reached on the
 * weaker of the two available checks.
 */
const NO_LAUNCHER_WINDOW_CAVEAT =
  'this reversal was planned WITHOUT the clip-launcher window (pass ' +
  '`launcher: await adapter.contentSince(take.at)`). The boundary therefore compared CONTENT ' +
  'only, which cannot see a move: clips are addressed by position and have no durable id ' +
  '(D16a), so a clip dragged out of one of these slots and an identical one dragged in ' +
  'compares equal and is not the same clip (E16s). Every verdict of `ours` above is a claim ' +
  'about contents, not about identity.';

/**
 * ⚠ The one caveat the plan adds that no label produces.
 *
 * D16 amendment 2 settled that `device.insert` reverses to a `device.delete` at
 * the chain index the receipt MINTED, and `revertOps` emits it only from an
 * observed mint — never a computed one. What no mint can supply is the other half
 * of D20's execution discipline: *name the survivor, never count it.* A chain
 * index is a count, and devices have no readback (D8) that could confirm the
 * occupant is still the device we inserted. So the reversal says so.
 */
const DEVICE_INDEX_CAVEAT =
  'this reversal deletes a device at the chain index its insert was OBSERVED to produce (D16 ' +
  'amendment 2). A device chain has no readback (D8), so unlike every clip and note address in ' +
  'this plan the occupant of that index cannot be fingerprinted first — if the chain has been ' +
  'rearranged by hand since, the delete lands on whatever is there now.';

/**
 * ⚠ Did this snapshot actually LOOK at `key`?
 *
 * `entries` is "here is what is there", `missing` is "we looked and there is
 * nothing there", and neither is "we did not ask". The distinction is the same
 * one D16 found the hard way — the fake reported an empty clip where Bitwig
 * reports no clip — and it is why the boundary can tell a deleted clip from an
 * unread one.
 */
function observed(snapshot: Snapshot, key: AddressKey): boolean {
  return snapshot.entries[key] !== undefined
    || snapshot.missing.some((a) => addressKey(a) === key);
}

function summarize(change: StashedChangeset): ChangesetSummary {
  const take = change.take;
  return {
    id: take.id,
    seq: change.seq,
    createdAtMs: take.createdAtMs,
    fidelity: take.fidelity,
    applied: take.report.applied,
    addresses: take.targets.map((t) => t.key),
    // ⚠ Computed from what the take already carries: an address labelled `none`
    // cannot be put back, and saying so belongs in the listing rather than in the
    // middle of a reversal (D5).
    unrestorable: take.values
      .filter((v) => v.fidelity === 'none')
      .map((v) => ({ key: v.key, why: v.caveats.join(' ') })),
  };
}

/** Does reversing this target DELETE a clip, rather than restore one? */
function deletesTheClip(target: WriteTarget, take: Take): boolean {
  if (target.address.kind !== 'clip' || target.restore === 'none') return false;
  const value = take.stash.entries[target.key]?.value;
  return value?.of === 'clip' && !value.exists;
}

/** Is this target the note content of the clip at `clipKey`? */
function coversClipContent(target: WriteTarget, clipKey: AddressKey): boolean {
  return target.address.kind === 'notes' && addressKey(target.address.clip) === clipKey;
}

/**
 * ⚠ Inserts a SLICED reversal is deliberately not undoing.
 *
 * Carried over from `graph.ts` unchanged, because the reasoning is about slices
 * and not about walks: slicing selects ADDRESSES, an insert has none to select,
 * so "restore just this clip" has no honest reading under which a device also
 * disappears. Reported rather than silently skipped, with the move that WOULD
 * remove it named.
 */
function slicedInserts(take: Take): UnrevertableOp[] {
  const out: UnrevertableOp[] = [];
  take.ops.forEach((op, opIndex) => {
    if (op.op !== 'device.insert') return;
    out.push({
      opIndex,
      op: op.op,
      why:
        `changeset ${take.id} inserted a device, and this reversal selects specific addresses. An ` +
        'insert has no address to select, so it is outside the slice: the device stays in the ' +
        'chain. Reverse the WHOLE changeset to remove it.',
    });
  });
  return out;
}

const dedupe = (values: readonly string[]): string[] => [...new Set(values)];

/**
 * Does this address name a clip-launcher cell — i.e. is it the kind of address
 * the launcher-content observer can say anything about at all?
 *
 * ⚠ Asked so that an unusable window degrades ONLY what it actually covers. A
 * track, device or param address is unaffected by a dropped launcher event, and
 * marking it `undecidable` would be pessimism spreading past its evidence, which
 * is how a fail-closed mechanism becomes one nobody leaves switched on.
 */
function isLauncherCell(address: Address): boolean {
  return slotOf(address) !== undefined;
}

/** The three ways a launcher window can be unusable, each said in full. */
function undecidableWhy(delta: ContentDelta): string {
  if (delta.discontinuity === 'project-changed') {
    return 'a DIFFERENT PROJECT has been loaded since this changeset ran. The extension never ' +
      'restarted, so the epoch counters kept climbing and the window looks perfectly ordinary — ' +
      'but every `channelId` in this changeset names a track in a project that is no longer ' +
      'open, and every scene index means something else. ⚠ Note the limit of the detector ' +
      'itself: it compares project NAMES, and a name is not an identity (rule 2), so it catches ' +
      'the changes it sees and cannot promise it saw them all.';
  }
  if (delta.discontinuous) {
    return 'the mark this changeset was taken at belongs to a previous life of the extension ' +
      '(Bitwig restarted, or the extension reloaded), so both epoch counters restarted and ' +
      'nothing before can be compared with anything after. Whether this slot moved in between ' +
      'is not merely unknown — it is unobservable, because every observer was destroyed and ' +
      'rebuilt. Re-resolve this address from scratch.';
  }
  if (delta.truncated) {
    return `${delta.now - delta.since} launcher edits have happened since this changeset ran, ` +
      'which is more than the extension\'s event log holds, so the ones it dropped cannot be ' +
      'named. This slot may be among them. Contents comparing equal does not settle it: clips ' +
      'are addressed by position and a moved clip can leave an identical-looking one behind.';
  }
  return 'at least one launcher event since this changeset ran could not name the track it ' +
    'happened on, so it cannot be ruled out as having been this slot. Which slot moved is ' +
    'known; whose track it was is not.';
}

/**
 * The launcher cell an address hangs off, as `channelId:slot`.
 *
 * ⚠ Durable half plus slot index, matching how the events are keyed and for the
 * same reason (standing rule 2). Shared by the boundary and by `isLauncherCell`
 * so the two cannot disagree about what counts as a cell.
 */
function slotOf(address: Address): string | undefined {
  const trackRef = addressTrack(address);
  const sceneRef = addressScene(address);
  if (trackRef === undefined || sceneRef === undefined) return undefined;
  return `${trackRef.channelId}:${sceneRef.index}`;
}
