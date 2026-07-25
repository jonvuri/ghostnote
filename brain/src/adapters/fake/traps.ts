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
