/**
 * The Class-B traps: Bitwig behaviours the fake actively REPRODUCES.
 *
 * A fake that only models the happy path certifies nothing — PHASE-0 §Scope says
 * the fidelity that matters is "modelling the traps, not the happy path", and
 * §Risks names fake divergence as the classic failure of this approach. So each
 * function here is a deliberate misbehaviour, named after the finding it mirrors,
 * and each is covered by three tests:
 *
 *   1. a direct model test that pokes it with no contract involved (this file's
 *      `model.test.ts`) — because a trap that is always mitigated is a trap whose
 *      model can rot undetected;
 *   2. a conformance test proving the contract avoids or labels it;
 *   3. the archived live probe, as the cross-check against real Bitwig.
 *
 * Traps NOT here are the encoder-only class: `set` being swallowed (E4),
 * `resolution=128` (E4b), insertFile's path rules (E4h) and named actions (E6).
 * The fake would have to accept a call it then ignores, and nothing could reach
 * that path — the op union cannot express any of them. Those are proven in
 * `live/encoder.test.ts` instead.
 */
import { GAIN_READ_SCALE, orderedNoteProps, type NoteRecord } from '../../contract/index.js';
import type { FakeSlot, FakeTrack, ProjectModel } from './model.js';

/**
 * ⚠ E2: `gain` reads back 2x the written value — set 0.7, settled read 1.4,
 * reproducibly and on clean state, while the javadoc claims 0..1 both ways.
 *
 * The fake reports the doubled value because that is what Bitwig does. The
 * contract does NOT correct it: the inverse mapping is unverified until Phase 1,
 * and correcting on an unverified inverse would make every take restore a wrong
 * gain silently. Instead `gain` is labelled `unverified` in NOTE_PROP_FIDELITY
 * and any snapshot touching it degrades to `lossy`.
 */
export function gainOnReadback(written: number): number {
  return written * GAIN_READ_SCALE;
}

/**
 * Apply property writes in the order given.
 *
 * ⚠ This used to also model E2/e02e's "`setGain` and `setTimbre` each RESET
 * `pressure` to 0". E15-E retired that: the pressure being reset was never in
 * the clip, only in the writing cursor's own `NoteStep` cache, and gain/timbre
 * merely forced that cache to be re-read. Modelling a phantom's disappearance
 * would be the fake certifying a mechanism that does not exist — the precise
 * failure PHASE-0 §Risks names. Pressure is now refused at the contract
 * boundary (`assertOpsWritable`) and never reaches here.
 *
 * The ordering itself is preserved because `orderedNoteProps` is still the
 * shared mitigation both adapters use, and a property list applied out of order
 * should still be observable if a future finding gives order meaning again.
 */
export function applyNotePropsInOrder(
  base: NoteRecord,
  entries: readonly (readonly [string, unknown])[],
): NoteRecord {
  const out = { ...base } as unknown as Record<string, unknown>;
  for (const [key, value] of entries) out[key] = value;
  return out as unknown as NoteRecord;
}

/**
 * ⚠ E15-D, and the trap this whole finding is about: `cursor.setNoteProps` is
 * the only write whose handler READS first — `clip.getStep(channel, x, y)` —
 * and that read is unusable for ~120ms after the step grid changed. Every
 * property written into that window is DISCARDED, with no error, no failed op
 * in the batch result, and a `cursor.status` that looks perfectly healthy.
 *
 * Measured live: 0 of 3 properties landed at gaps of 0/24/48/72/96ms after the
 * grid change, 3 of 3 at 120/144/192/288ms.
 *
 * The fake marks a slot's step data stale on every note write (a note write
 * always sets the grid on the way in) and discards property writes that arrive
 * too early. The contract's mitigation is `OP_SETTLE_BEFORE`, which makes
 * `planStages` put a `gridChange` settle in FRONT of the props stage — so if
 * that ever regresses, this model turns it into a failing offline test instead
 * of a note that quietly lost its expression.
 */
export function stepDataIsStale(slot: FakeSlot, tick: number): boolean {
  return tick < slot.stepDataStaleUntilTick;
}

/**
 * ⚠ E15-D's OTHER half, and the one `settleBefore` cannot reach.
 *
 * `stepDataIsStale` above models a grid change made in an EARLIER request, which
 * a settle in front of the stage fixes. This models a grid change made in the
 * SAME turn as the read, which it cannot: `cursor.setNoteProps` emits
 * `cursor.setStepSize` immediately before its own `clip.getStep`, so if that
 * call actually moves the grid, the read is against a grid the cursor has not
 * re-fetched and every property in the op is discarded. Waiting afterwards is
 * waiting for damage already done.
 *
 * Measured directly in probe `e15d-props` §A, which held the frames byte-identical
 * and varied only the grid the cursor arrived on: gain landed (1.4) when the
 * cursor was ALREADY on grid 1, and read back 0 from grids 0.5, 0.25 and 0.0625.
 *
 * The contract's mitigation is that `splitNoteWrite` hands the properties op the
 * same note set as its create, so the two imply the same grid and this call is a
 * no-op. Modelling the trap is what turns removing that into a failing offline
 * test rather than expression silently vanishing on a real project.
 *
 * `undefined` on either side means "cannot tell": a fresh cursor has no known
 * grid, and notes finer than the grid floor are refused by the encoder before
 * they could get here. Guessing in either case would be the fake inventing a
 * failure live Bitwig does not have.
 */
export function gridChangePoisonsRead(cursorStepSize: number | undefined, wanted: number | undefined): boolean {
  if (cursorStepSize === undefined || wanted === undefined) return false;
  return cursorStepSize !== wanted;
}

/**
 * ⚠ E15-F: `setNoteProps` looks the note up in the clip the cursor held at the
 * START of the turn, whichever clip it re-points to inside that turn.
 *
 * Measured against four shapes that all reduce to this one rule (probe
 * `e15f-hoist`):
 *
 *   cursor parked on A; ONE batch: props A then props B   -> A lands, B lost
 *   the same two ops as two separate 400ms-apart batches   -> A lands, B lost
 *   point B in its own request, settle, THEN props B       -> B lands
 *   write A + write B, settle, then props A + props B      -> B lands, A lost
 *
 * The last one looks backwards until you apply the rule: that turn STARTED with
 * the cursor on B, so only B's cell resolved. The batch boundary has nothing to
 * do with it — a props op that re-points is unreliable in any shape.
 *
 * Two things it is NOT, both measured rather than assumed. The mutation writes
 * through to the clip actually addressed, so this is a LOST property and never a
 * write to the wrong clip; and a property write against a cell with no note is
 * inert, so it cannot conjure one. Bad, but bounded.
 *
 * This is what makes hoisting the generated props ops into one trailing stage
 * unsound, and PHASE-0-SESSION-2 item 4 proposed exactly that on the strength of
 * E15-D's "ops addressing different clips MAY share a stage". E15-D measured
 * `setNotes`, a pure write. This is the one op that reads first.
 *
 * The contract stays safe by never re-pointing inside a props turn: each props
 * stage follows the create stage for the SAME clip, so its point frames are a
 * no-op. Modelling the trap is what turns a future hoist into a failing offline
 * test instead of expression that silently disappears from a real project.
 */
export function propsReadsTurnStartClip(
  turnStartClip: string | undefined,
  addressed: string,
): boolean {
  // `undefined` is a fresh cursor with no known clip — the fake declines to
  // invent a failure that live Bitwig would not have.
  return turnStartClip !== undefined && turnStartClip !== addressed;
}

/**
 * Store a note as the request that CREATES it would — which is to say, with
 * every expression property thrown away.
 *
 * ⚠ E15-B: `setStep` is not visible to a `getStep` in the same request (E2), so
 * a `setNoteProps` riding along in that request operates on a stale `NoteStep`
 * and every property written to it is silently discarded. Measured live: gain
 * 0.7 written alongside the note reads back 0; written in the next request it
 * reads back 1.4. No error, no signal, and it applies to all 18 properties, not
 * just the fragile ones.
 *
 * The contract's mitigation is `planStages` splitting the write into a create
 * turn and a `note.props` turn. Modelling the discard here is what stops the
 * fake certifying the single-request path that does not work.
 *
 * ⚠ This docblock used to describe E2/e02e's "gain and timbre zero pressure"
 * and a two-turn write that recovered it. E15-E retracted both: pressure never
 * reaches the clip at all, `assertOpsWritable` now refuses it at the contract
 * boundary, and no pressure value ever arrives here.
 */
export function writeNoteProps(note: NoteRecord): NoteRecord {
  return {
    startBeats: note.startBeats,
    pitch: note.pitch,
    velocity: note.velocity,
    durationBeats: note.durationBeats,
  };
}

/** What a stored note looks like when read back, traps included. */
export function noteOnReadback(stored: NoteRecord): NoteRecord {
  return stored.gain === undefined ? stored : { ...stored, gain: gainOnReadback(stored.gain) };
}

export interface PointResult {
  readonly slot: FakeSlot;
  readonly sceneIndex: number;
  /** True when the cursor did NOT land where it was asked to — and says nothing. */
  readonly mispointed: boolean;
}

/**
 * ⚠ E2, and the nastiest trap in the set: pointing at an EMPTY slot silently
 * lands the cursor on the WRONG clip. Observed both staying on the previous clip
 * and attaching to a different clip on the target track — and in BOTH cases
 * `cursor.status` looks entirely healthy. There is no error and no signal.
 *
 * The mitigation is procedural (create the clip before pointing at it), and it is
 * invisible unless the fake actually misbehaves — which is exactly why this is
 * the highest-value trap to model.
 */
export function pointAtSlot(track: FakeTrack, sceneIndex: number): PointResult {
  const target = track.slots[sceneIndex];
  if (target !== undefined && target.hasContent) {
    return { slot: target, sceneIndex, mispointed: false };
  }
  // Land on the first slot on this track that HAS content — the observed
  // "attached to a different clip on the target track (slot 0)" behaviour.
  const fallbackIndex = track.slots.findIndex((s) => s.hasContent);
  if (fallbackIndex < 0) {
    return { slot: target ?? track.slots[0]!, sceneIndex, mispointed: false };
  }
  return { slot: track.slots[fallbackIndex]!, sceneIndex: fallbackIndex, mispointed: true };
}

/**
 * ⚠ E5: with a 54-track project and a 32-track bank, 22 tracks and 160 clips
 * were simply INVISIBLE — not slow, absent — and `channelId` resolves only inside
 * the window. That is a checkpoint blind spot: a revert could silently miss state
 * it never saw. Standing rule 5 makes it a refusal, never a tuning knob.
 */
export function bankBlindSpot(model: ProjectModel): { visible: number; total: number } | undefined {
  return model.overflowing
    ? { visible: model.visibleTracks().length, total: model.trackCount }
    : undefined;
}
