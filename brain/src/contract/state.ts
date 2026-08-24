/**
 * Note state and its fidelity labels — the object class Phase 1 is born on.
 *
 * E2 swept all 21 expression properties and found `setStep` → `getStep` exact to
 * ±2e-3 after the measured gain inverse. That is why clips are where the
 * checkpoint engine gets built: the snapshot is lossless, so a revert bug is
 * unambiguous rather than a fidelity argument.
 *
 * Two traps are named here and NOT silently papered over:
 *
 *   - `gain` reads back 2x the setter input. E24 measured nine values from 0.1
 *     through 1.0, repeated independent-cursor reads, and a zero revert. The
 *     shared property encoder therefore writes `gain / GAIN_READ_SCALE`.
 *   - `pressure` CANNOT BE WRITTEN AT ALL (E15-E). `NoteStep.setPressure` leaves
 *     the value in the writing cursor's own `NoteStep` cache and never in the
 *     clip: re-point that cursor and the value is gone, and any other cursor
 *     reads 0 the whole time. 16 of the other 17 properties persist under the
 *     identical test, so this is specific to pressure, not to the method.
 *     It is `unwritable` below, which makes a write REFUSE and any snapshot
 *     carrying it `lossy` — a phantom that only the writer can see is worse than
 *     a missing feature, because it would make readback lie to a snapshot.
 */
import type { ObservedContainer } from './chains.js';

/** The optional expression properties, beyond the four a note always has. */
export type NoteProp =
  | 'releaseVelocity'
  | 'velocitySpread'
  | 'gain'
  | 'pan'
  | 'pressure'
  | 'timbre'
  | 'transpose'
  | 'chance'
  | 'isChanceEnabled'
  | 'isMuted'
  | 'isOccurrenceEnabled'
  | 'occurrence'
  | 'isRecurrenceEnabled'
  | 'recurrence'
  | 'isRepeatEnabled'
  | 'repeatCount'
  | 'repeatCurve'
  | 'repeatVelocityCurve'
  | 'repeatVelocityEnd';

/**
 * Per-property round-trip confidence (E2, E15-E).
 *
 * `unverified` does NOT mean "broken" — it means we cannot promise a write-read
 * round-trip is the identity, so any snapshot touching it degrades to
 * `fidelity: 'lossy'` and a revert says so up front. D5: "every take carries a
 * fidelity label ... so a revert never silently under-delivers."
 *
 * `unwritable` is the stronger case: the write provably does not reach the clip,
 * so the contract refuses to emit it rather than pretending. Reading one back is
 * still meaningful (a human may have authored it), and it degrades fidelity for
 * the same reason — we cannot restore what we cannot write.
 */
export type PropFidelity = 'exact' | 'unverified' | 'unwritable';

export const NOTE_PROP_FIDELITY: Record<NoteProp | 'velocity' | 'duration', PropFidelity> = {
  velocity: 'exact',
  duration: 'exact',
  releaseVelocity: 'exact',
  velocitySpread: 'exact',
  // E24: the stable inverse is write / 2, verified through an independent cursor.
  gain: 'exact',
  pan: 'exact',
  // ⚠ E15-E: the write never reaches the clip. See this file's header.
  pressure: 'unwritable',
  // E2: "float noise only" — round-trips within the 2e-3 tolerance.
  timbre: 'exact',
  transpose: 'exact',
  chance: 'exact',
  isChanceEnabled: 'exact',
  isMuted: 'exact',
  isOccurrenceEnabled: 'exact',
  occurrence: 'exact',
  isRecurrenceEnabled: 'exact',
  recurrence: 'exact',
  isRepeatEnabled: 'exact',
  repeatCount: 'exact',
  repeatCurve: 'exact',
  repeatVelocityCurve: 'exact',
  repeatVelocityEnd: 'exact',
};

/**
 * The observed readback scale for `gain`.
 *
 * E24 verified the inverse at nine values, with repeated independent reads and
 * a revert. `orderedNoteProps` is the one place that applies it.
 */
export const GAIN_READ_SCALE = 2;

/** Properties whose round-trip we cannot promise — derived, never hand-maintained. */
export const UNVERIFIED_NOTE_PROPS: readonly string[] = Object.entries(NOTE_PROP_FIDELITY)
  .filter(([, f]) => f === 'unverified')
  .map(([k]) => k);

/** Properties the API accepts and then discards — derived from the table above. */
export const UNWRITABLE_NOTE_PROPS: readonly string[] = Object.entries(NOTE_PROP_FIDELITY)
  .filter(([, f]) => f === 'unwritable')
  .map(([k]) => k);

/**
 * The order properties are written in, and the list of what may be written.
 *
 * ⚠ `pressure` is deliberately ABSENT (E15-E) — it is `unwritable`, so nothing
 * may emit it. It used to sit last here under E2/e02e's rule that `setGain` and
 * `setTimbre` "zero pressure". That reading was an artifact: the pressure being
 * zeroed was never in the clip in the first place, and what gain and timbre
 * actually did was force the writing cursor to re-read its `NoteStep`, which
 * replaced the phantom with the clip's real 0. With pressure gone the ordering
 * carries no known dependency; it is kept stable rather than re-derived, because
 * no ordering effect among the remaining 16 has ever been measured.
 */
export const NOTE_PROP_WRITE_ORDER: readonly (NoteProp | 'velocity' | 'duration')[] = [
  'velocity', 'duration', 'releaseVelocity', 'velocitySpread', 'pan', 'transpose',
  'chance', 'isChanceEnabled', 'isMuted', 'isOccurrenceEnabled', 'occurrence',
  'isRecurrenceEnabled', 'recurrence', 'isRepeatEnabled', 'repeatCount', 'repeatCurve',
  'repeatVelocityCurve', 'repeatVelocityEnd',
  'gain', 'timbre',
];

/**
 * A note's expression properties as ordered `[key, value]` entries, safe order
 * guaranteed.
 *
 * This lives in the CONTRACT rather than in the live encoder because both
 * adapters must emit the same property set in the same order: a mitigation that
 * only the live encoder applied would make the two adapters report different
 * results for the same op, and the conformance suite could never be
 * adapter-agnostic.
 *
 * ⚠ This used to say the fake models "applying `gain` zeroes whatever `pressure`
 * it already had". E15-E retired that mechanism — nothing was ever zeroed, the
 * pressure was never in the clip — and `traps.ts` no longer models it. The
 * filtering below is now the whole job.
 */
export function orderedNoteProps(note: NoteRecord): (readonly [string, unknown])[] {
  const bag = note as unknown as Record<string, unknown>;
  const entries: (readonly [string, unknown])[] = [];
  for (const key of NOTE_PROP_WRITE_ORDER) {
    if (key === 'velocity' || key === 'duration') continue;
    // Belt and braces: NOTE_PROP_FIDELITY is the single source of truth about
    // what may be written, so re-adding an unwritable property to the order
    // above cannot quietly put it back on the wire.
    if (UNWRITABLE_NOTE_PROPS.includes(key)) continue;
    const value = bag[key];
    if (value === undefined) continue;
    entries.push([key, key === 'gain' && typeof value === 'number'
      ? value / GAIN_READ_SCALE
      : value] as const);
  }
  return entries;
}

/** Recurrence takes (length, mask) together; the API has no way to set one alone. */
export type Recurrence = readonly [length: number, mask: number];

/**
 * One note.
 *
 * Time is in BEATS, always — the step grid is a per-operation view, not global
 * state (E2, correcting daw-mcp's design). The beats-to-step conversion happens
 * once, in the encoder.
 *
 * `velocity` is 0-127 because that is literally what `Clip.setStep` takes and
 * what `getStep` reports back; the finer-grained expression properties below are
 * 0..1 doubles because that is what `NoteStep` uses. The contract mirrors the API
 * rather than inventing a uniform scale that would hide a rounding step.
 */
export interface NoteRecord {
  readonly startBeats: number;
  readonly pitch: number;
  readonly velocity: number;
  readonly durationBeats: number;

  readonly releaseVelocity?: number;
  readonly velocitySpread?: number;
  readonly gain?: number;
  readonly pan?: number;
  readonly pressure?: number;
  readonly timbre?: number;
  readonly transpose?: number;
  readonly chance?: number;
  readonly isChanceEnabled?: boolean;
  readonly isMuted?: boolean;
  readonly isOccurrenceEnabled?: boolean;
  readonly occurrence?: string;
  readonly isRecurrenceEnabled?: boolean;
  readonly recurrence?: Recurrence;
  readonly isRepeatEnabled?: boolean;
  readonly repeatCount?: number;
  readonly repeatCurve?: number;
  readonly repeatVelocityCurve?: number;
  readonly repeatVelocityEnd?: number;
}

/**
 * Does this note carry any property we cannot promise to round-trip?
 *
 * Both `unverified` and `unwritable` properties count, because the question
 * this answers is "could replaying this snapshot fail to reproduce the clip?"
 * and the answer is yes for both, for different reasons.
 */
export function hasUnverifiedProps(note: NoteRecord): boolean {
  const bag = note as unknown as Record<string, unknown>;
  return UNVERIFIED_NOTE_PROPS.some((p) => bag[p] !== undefined)
    || UNWRITABLE_NOTE_PROPS.some((p) => bag[p] !== undefined);
}

/**
 * The properties on this note that the API accepts and then throws away.
 *
 * Used to REFUSE a write rather than let it silently do nothing (E15-E). A
 * caller who asks for pressure gets an error naming the measurement; a caller
 * who never mentions it is unaffected.
 */
export function unwritableProps(note: NoteRecord): string[] {
  const bag = note as unknown as Record<string, unknown>;
  return UNWRITABLE_NOTE_PROPS.filter((p) => bag[p] !== undefined);
}

export interface TrackState {
  readonly channelId: string;
  readonly name: string;
  readonly position: number;
  readonly type: string;
}

export interface ParamState {
  /** DirectParameter id, or the typed handle's catalog id. */
  readonly id: string;
  /** Present only for a typed specific-device or plugin view. */
  readonly index?: number;
  readonly name: string;
  /** Normalized base value, from 0 through 1. */
  readonly value: number;
  /** Which supplementary fields this reading could observe. */
  readonly observed: {
    readonly display: boolean;
    readonly modulatedValue: boolean;
    readonly hasAutomation: boolean;
    readonly origin: boolean;
    readonly discreteValueCount: boolean;
    readonly discreteValueNames: boolean;
  };
  readonly display?: string;
  /**
   * Diverges from `value` exactly when something is modulating the parameter —
   * a base value holding still while this sweeps is the modulation-liveness
   * oracle (E7). Its presence is also a signal that a static write will not hold.
   */
  readonly modulatedValue?: number;
  /** True when host automation can override the static base-value write. */
  readonly hasAutomation?: boolean;
  /** Typed value origin, when the device-specific view supplies it. */
  readonly origin?: number;
  /** Count of discrete values, when the typed view supplies it. */
  readonly discreteValueCount?: number;
  /** Display names for discrete values, when the typed view supplies them. */
  readonly discreteValueNames?: readonly string[];
}

/** Exact normalized values for a host-proved discrete parameter domain. */
export function discreteNormalizedValues(count: number): readonly number[] {
  if (!Number.isInteger(count) || count < 1) return [];
  if (count === 1) return [0];
  return Array.from({ length: count }, (_, index) => index / (count - 1));
}

/** True when a normalized value is in the host-proved discrete domain. */
export function discreteValueIsRepresentable(value: number, count: number): boolean {
  return discreteNormalizedValues(count).some((allowed) => Math.abs(allowed - value) <= 1e-6);
}

export interface RemoteControlState {
  readonly index: number;
  readonly name: string;
  /** Normalized base value, from 0 through 1. */
  readonly value: number;
  readonly modulatedValue: number;
  /** True only while Bitwig is waiting for a manual mapping gesture. */
  readonly isBeingMapped: boolean;
  readonly hasAutomation?: boolean;
}

export interface RemotePageState {
  readonly index: number;
  readonly name: string;
  readonly controls: readonly RemoteControlState[];
}

export interface RemoteControlsState {
  /** Exact device identity that owned this complete remote inventory. */
  readonly deviceName: string;
  readonly pages: readonly RemotePageState[];
}

export interface DeviceState {
  readonly chainIndex: number;
  readonly name: string;
  /**
   * ⚠⚠ ABSENT MEANS NOT OBSERVED — never *"this device has no parameters"*.
   *
   * It became optional in session 3f step 6b, when a device inside a layer chain
   * became readable. That read goes through the container enumeration, which
   * reports a nested device's NAME and position and has no parameter handle at
   * all; an empty array there would assert a device with no controls, which is
   * a claim about the instrument rather than about our reach. The live adapter
   * omits it for top-level devices too, whose parameter readback is still the
   * device-cursor work Phase 4 owns.
   */
  readonly params?: readonly ParamState[];
  /**
   * The chains this device holds, when it is a CONTAINER we could look inside.
   *
   * ⚠⚠ This is the bootstrap, and without it the chain grammar is unusable.
   * A chain is addressed by NAME (`ChainAddress`), so something has to be able
   * to say what the names ARE — and a chain has no address of its own to be
   * enumerated by, only a container. That container is an ordinary device with
   * an ordinary address, so its READ is the enumeration, and no ninth adapter
   * method is needed for it (the argument `tracks()` had to make, arriving at
   * the opposite answer because a track has no container to hang off).
   *
   * ⚠ Absent means we did not look or could not, exactly as `params` does; a
   * container whose chains we could see and which holds none reports an empty
   * `chains` list with `chainsComplete: true`.
   */
  readonly container?: ObservedContainer;
}

export const LAUNCH_QUANTIZATIONS = [
  'default', 'none', '8', '4', '2', '1', '1/2', '1/4', '1/8', '1/16',
] as const;
export type LaunchQuantization = (typeof LAUNCH_QUANTIZATIONS)[number];

export const LAUNCH_MODES = [
  'default', 'from_start', 'continue_or_from_start', 'continue_or_synced', 'synced',
] as const;
export type LaunchMode = (typeof LAUNCH_MODES)[number];

export interface ClipLaunchState {
  readonly quantization: LaunchQuantization;
  readonly mode: LaunchMode;
  readonly useLoopStartAsQuantizationReference: boolean;
}

/** Host-normalized 8-bit clip colour. E43 proved exact byte round-trips. */
export interface ClipColor {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
}

/** Complete readable and writable launcher-clip container metadata (E43). */
export interface ClipMetadataState {
  readonly name: string;
  readonly color: ClipColor;
  /** Loop length from Clip.getLoopLength(). */
  readonly lengthBeats: number;
  /** Preserved because changing the loop start can move this marker. */
  readonly playStartBeats: number;
  readonly loopEnabled: boolean;
  readonly loopStartBeats: number;
  /** Derived loop end. It must equal loop start plus length. */
  readonly loopEndBeats: number;
}

export interface ClipPlayState {
  readonly hasContent: boolean;
  readonly isPlaying: boolean;
  readonly isPlaybackQueued: boolean;
  readonly isStopQueued: boolean;
  /** Clip-local playback step from Clip.playingStep(); -1 when no clip can be read. */
  readonly playingStep: number;
  /** Sample time assigned inside the extension, beside playingStep/playPosition. */
  readonly sampledAtMs: number;
  readonly playPosition: number;
}
