/**
 * The launcher-content observer, as a contract type — session 3's whole point.
 *
 * ## Why this exists at all
 *
 * Clips have no durable id and we are not inventing one (D16a). A clip address is
 * *(durable track, scene index)* and is therefore only as good as our knowledge
 * that the row still means what it meant. Two things break that, and until now
 * only one of them was detectable:
 *
 *   - **scene create/delete** compacts the rows below (E3). The scene epoch
 *     catches it — and only started catching the USER's scene ops when the epoch
 *     moved into the extension, which is this session.
 *   - ⚠ **a clip MOVE** changes no scene count and no row meaning globally, but it
 *     empties one slot and fills another. E16s measured the count observer sitting
 *     still at 3 → 3 through a human clip drag while `ClipLauncherSlotBank`'s
 *     content observer reported it as a PAIR — `t2s7=emptied`, `t2s3=filled` —
 *     agreeing exactly with the human's independent report. That is why *"the
 *     content epoch is the one clip addressing consults"* (E16-REPLAN §2).
 *
 * One indexed observer per bank row covers every slot in it, so the whole grid
 * costs `tracks` observers, not `tracks × scenes`.
 *
 * ## ⚠ Epochs are DIFFERENCES, never absolutes
 *
 * Bitwig delivers initial values through the same callbacks, so both epochs are
 * already nonzero at rest and neither number means anything on its own. Every
 * consumer baselines a mark and asks what happened since. The three ways that
 * question can fail to have an answer are modelled explicitly rather than
 * collapsed into "no events", because each of them is a silence that means the
 * opposite of quiet:
 *
 *   `truncated`      more events happened than the extension's ring holds, so the
 *                    NAMES are gone. Something moved and we cannot say what.
 *   `discontinuous`  the counters are not comparable at all, for one of two
 *                    reasons `discontinuity` names. A previous LIFE of the
 *                    extension: the counters restarted lower, so a stale mark can
 *                    compare EQUAL to a fresh one — a difference that reads as no
 *                    difference. Or a different PROJECT, which is worse, because
 *                    the extension never restarted: the counters kept climbing,
 *                    so a stale mark's window looks like an ordinary busy one
 *                    while every address in it means something else.
 *   `unattributable` an event whose track could not be named (the observer read an
 *                    empty `channelId`, which happens while initial values are
 *                    still arriving). It touched something; we cannot say what.
 *   `uncovered`      ⚠⚠ the observers could not have seen the whole project. The
 *                    fourth, added in session 3c, and the one that is NOT visible
 *                    in the delta: the other three are things the event stream
 *                    reports about itself, while this one is a fact about the
 *                    stream's REACH. See `uncoveredBetween`.
 *
 * ## ⚠ What this mechanism is NOT
 *
 * It is a detector, not a resolver — PHASE-1 is explicit that *"detection matters
 * more than resolution here — surface it, don't guess."* It says a slot changed;
 * it never says what to do about it, and nothing here repairs an address.
 *
 * It also cannot tell OUR fill from the human's fill of the same slot. Nothing
 * can: the callback carries no author. The division of labour is the point —
 * the stash's content fingerprint (`stash/record.ts`) answers *"is this address
 * still holding what WE left?"* for addresses we wrote, and this answers *"did
 * anything move at all, including in slots we never touched?"*, which the
 * fingerprint structurally cannot: a clip dragged away and an identical one
 * dragged in fingerprints as unchanged and is not the same clip.
 */
import { addressScene, addressTrack, type Address } from './address.js';
import { windowCovers, type RevisionMark } from './snapshot.js';

/**
 * ⚠⚠ WHICH population the launcher observers could not cover.
 *
 * Named rather than collapsed into a boolean because the two dimensions have
 * different causes and different fixes, and because *"tracks and scenes both"* is
 * the case a caller most wants to see spelled out. Mirrors `discontinuity`: a
 * boolean says the window is unusable, this says which way.
 */
export type UncoveredIn = 'tracks' | 'scenes' | 'both';

/** What a single mark's banks could not see. `undefined` when they covered the world. */
export function uncoveredAt(mark: RevisionMark): UncoveredIn | undefined {
  const tracks = !windowCovers(mark.window.tracks);
  const scenes = !windowCovers(mark.window.scenes);
  if (tracks && scenes) return 'both';
  if (tracks) return 'tracks';
  if (scenes) return 'scenes';
  return undefined;
}

/**
 * ⚠⚠ Could the observers have seen the whole project across this window — the
 * fourth verdict, and B2's whole fix.
 *
 * By construction in `Rig.java`, `addHasContentObserver` is attached per bank row
 * across `config.tracks`, on a slot bank sized by `config.scenes`. An edit on a
 * track past the track window, or a row past the scene window, fires nothing at
 * all. Every other way a window can lie is *reported by the window*; this one is
 * the window not existing where the edit happened, so a delta that only counts
 * events calls it quiet.
 *
 * ⚠ The UNION of both ends, and deliberately pessimistic. Coverage is a property
 * of the whole interval and we only ever hold its two endpoints, so a window that
 * was uncoverable at either moment is reported uncovered. The alternative — trust
 * the later reading — resolves "we could not tell" to "nothing happened", which is
 * the direction this entire mechanism exists to refuse.
 *
 * ⚠ Computed even when the marks are DISCONTINUOUS. Comparing counts across a
 * project change means nothing, but each end is still a true observation of a real
 * moment, and the union of two true statements is conservative in the safe
 * direction. A caller reading `discontinuous` and `uncovered` together learns two
 * independent facts rather than one that swallowed the other.
 */
export function uncoveredBetween(
  since: RevisionMark,
  now: RevisionMark,
): UncoveredIn | undefined {
  const a = uncoveredAt(since);
  const b = uncoveredAt(now);
  if (a === undefined) return b;
  if (b === undefined) return a;
  return a === b ? a : 'both';
}

/**
 * ⚠ Are two marks comparable at all — and if not, which way.
 *
 * Shared by both adapters so neither can be more forgiving than the other about
 * a project change, which is the failure mode with no numeric tell: the epochs
 * keep climbing across a project load because the extension never restarted.
 *
 * ⚠ An UNKNOWN project (empty on either side) is NOT treated as a match. The
 * handle may not have been obtained (`projectStatus`), and "we could not tell"
 * must not resolve to "the same" — that is the direction that writes into the
 * wrong project.
 */
export function discontinuityBetween(
  since: RevisionMark,
  now: RevisionMark,
): ContentDelta['discontinuity'] {
  if (since.generation !== now.generation) return 'extension-restarted';
  if (since.project !== now.project || since.project === '') return 'project-changed';
  return undefined;
}

/**
 * One launcher slot changing between empty and occupied.
 *
 * ⚠ `channelId`, not a bank index. The extension captures the durable id at
 * callback time, when the bank row and the track still agree; a bank index
 * recorded now and read later names whatever slid into that slot in between
 * (E2c/E3, standing rule 2). `trackIndex` rides along for human-readable logs
 * and must never be matched on.
 */
export interface ContentEvent {
  /** The epoch value this event produced, so a window can be sliced exactly. */
  readonly seq: number;
  /** ⚠ Empty when the observer could not name the track — see `unattributable`. */
  readonly channelId: string;
  /** Diagnostics only. Positional, and stale the moment the bank re-indexes. */
  readonly trackIndex: number;
  readonly slotIndex: number;
  readonly filled: boolean;
}

/** What the launcher did between two marks, and whether that account is complete. */
export interface ContentDelta {
  readonly since: number;
  readonly now: number;
  /** Events in `(since, now]`, oldest first. Empty is only meaningful if `complete`. */
  readonly events: readonly ContentEvent[];
  /** ⚠ The ring dropped events in this window: something moved, unnamed. */
  readonly truncated: boolean;
  /** ⚠ The counters are not comparable at all. See `discontinuity` for which way. */
  readonly discontinuous: boolean;
  /**
   * ⚠ WHY the window is incomparable, because the two causes need different
   * sentences and one of them is much easier to miss.
   *
   * `extension-restarted` — the counters went backwards, which is at least
   * anomalous on its face. `project-changed` — the extension never restarted, so
   * the counters kept climbing and nothing about the numbers looks wrong.
   */
  readonly discontinuity?: 'extension-restarted' | 'project-changed';
  /**
   * ⚠⚠ The observers could not have seen the whole project, so an empty window is
   * a statement about the BANK and not about the world (B2, session 3c).
   *
   * The other three flags describe events that happened; this one describes
   * events that could not have arrived. It is the only one of the four a delta
   * cannot notice on its own, which is why it is carried rather than inferred.
   */
  readonly uncovered: boolean;
  /** ⚠ WHICH population went unobserved. Mirrors `discontinuity`. */
  readonly uncoveredIn?: UncoveredIn;
}

/**
 * ⚠ Can this delta be reasoned about at all?
 *
 * Stated once, here, so no caller re-derives it and none of them forgets that an
 * empty `events` array is a claim about the world only when the window is
 * intact. Everything else must fail closed.
 *
 * ⚠⚠ `uncovered` joined the list in session 3c, and adding it here is the entire
 * distribution of the fix: the stash's `undecidable` verdict and the executor's
 * concurrent-edit report both gate on this one predicate, so both learned to fail
 * closed on an unobservable window without either of them changing a line.
 */
export const deltaComplete = (delta: ContentDelta): boolean =>
  !delta.truncated
  && !delta.discontinuous
  && !delta.uncovered
  && delta.events.every((e) => e.channelId !== '');

/** The events that touch the slot this address hangs off, by durable identity. */
export function contentTouching(
  delta: ContentDelta,
  address: Address,
): readonly ContentEvent[] {
  const trackRef = addressTrack(address);
  const sceneRef = addressScene(address);
  // A scene address spans every track and a track address has no slot: neither
  // names one launcher cell, so neither can be matched against a cell event.
  // Answering "no events" for them would be a pass they have not earned, so the
  // callers that care ask `deltaComplete` first and treat those kinds separately.
  if (trackRef === undefined || sceneRef === undefined) return [];
  return delta.events.filter(
    (e) => e.channelId === trackRef.channelId && e.slotIndex === sceneRef.index,
  );
}

/**
 * ⚠ Slice a raw extension reply into the window a caller actually asked about.
 *
 * Shared by both adapters so the fake cannot drift into being kinder about a
 * dropped event than the live one is. The ring-overflow test is the load-bearing
 * line: if the oldest event we can still see is newer than `since + 1`, then
 * events between them existed and are gone, and a short window would otherwise
 * read as a quiet one.
 */
export function sliceDelta(
  since: number,
  now: number,
  ring: readonly ContentEvent[],
): Pick<ContentDelta, 'since' | 'now' | 'events' | 'truncated'> {
  const events = ring.filter((e) => e.seq > since && e.seq <= now);
  const expected = Math.max(0, now - since);
  return { since, now, events, truncated: events.length < expected };
}

/**
 * ⚠⚠ The WHOLE delta, assembled once — the only place a `ContentDelta` is built.
 *
 * Both adapters used to construct one each, from the same two helpers, with the
 * discontinuity short-circuit written out twice. That is exactly the shape
 * PHASE-0 §Risks names: a fake that can drift into being kinder than Bitwig, one
 * forgotten field at a time. Session 3's own review already caught one instance
 * of it (`restartExtension` resetting one epoch and not the other), and adding a
 * FOURTH verdict to two hand-written literals is how the next one happens.
 *
 * ⚠ A discontinuous window reports NO events rather than a slice of them. The
 * counters are not comparable, so `(since, now]` does not name an interval —
 * handing back the events that happen to fall in the arithmetic range would be
 * inventing a window out of two unrelated numbers.
 */
export function contentDelta(
  since: RevisionMark,
  now: RevisionMark,
  ring: readonly ContentEvent[],
): ContentDelta {
  const uncoveredIn = uncoveredBetween(since, now);
  const coverage = uncoveredIn === undefined
    ? { uncovered: false as const }
    : { uncovered: true as const, uncoveredIn };
  const discontinuity = discontinuityBetween(since, now);
  if (discontinuity !== undefined) {
    return {
      since: since.contentEpoch,
      now: now.contentEpoch,
      events: [],
      truncated: false,
      discontinuous: true,
      discontinuity,
      ...coverage,
    };
  }
  return {
    ...sliceDelta(since.contentEpoch, now.contentEpoch, ring),
    discontinuous: false,
    ...coverage,
  };
}
