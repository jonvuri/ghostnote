/**
 * 8i7: the track mixer fields and their units (E257).
 *
 * The contract carries the host raw values. The 8i7 gate measured them on the live host:
 *
 *   - Volume raw is the cube root of the linear gain. The host display is 60 * log10(raw) dB at each of 25
 *     points, and the normalized value is raw / 2^(1/3). Raw 0 is silence (-Inf dB); raw 2^(1/3) is the
 *     maximum (+6.02 dB). `setRaw` stores the requested double exactly; the readback is equal.
 *   - Pan raw is -1 (full left) to 1 (full right), linear in the normalized value.
 *   - Mute and solo are booleans. The solo write is nonexclusive.
 *
 * The decibel conversion lives here, in one place. The display text is reported beside the value as an
 * independent host check; nothing parses it.
 */

export const MIXER_FIELDS = ['volume', 'pan', 'mute', 'solo'] as const;
export type MixerField = (typeof MIXER_FIELDS)[number];

/** The track kinds whose mixer read and write passed live (E257). */
export const MIXER_TRACK_KINDS = ['Instrument', 'Audio', 'Hybrid', 'Effect', 'Group'] as const;

/** The largest raw volume: 2^(1/3). */
export const VOLUME_RAW_MAX = Math.cbrt(2);
/** The largest volume in dB: 20 * log10(2), shown by Bitwig as +6.0 dB. */
export const VOLUME_DB_MAX = 60 * Math.log10(VOLUME_RAW_MAX);
/**
 * The smallest finite volume that a caller can request. Bitwig shows -120 dB at raw 0.01 and -Inf below about
 * -150 dB; silence is the explicit `-inf` request (raw 0).
 */
export const VOLUME_DB_MIN = -120;
/** `setRaw` stores the requested double; a readback within this distance is the requested value. */
export const MIXER_RAW_TOLERANCE = 1e-9;

export type VolumeDb = number | '-inf';

/** One observed mixer field. `automated` is present for volume and pan; `display` for volume. */
export interface MixerFieldState {
  readonly field: MixerField;
  readonly value: number | boolean;
  readonly automated?: boolean;
  readonly display?: string;
}

/** The raw volume for a dB request. The caller has checked the range. */
export function volumeRawOfDb(db: VolumeDb): number {
  if (db === '-inf') return 0;
  return Math.min(VOLUME_RAW_MAX, 10 ** (db / 60));
}

/** The dB value of a raw volume, or `-inf` for silence. */
export function volumeDbOfRaw(raw: number): VolumeDb {
  return raw <= 0 ? '-inf' : 60 * Math.log10(raw);
}

/** A problem with one requested dB value, or undefined. */
export function volumeDbProblem(db: VolumeDb): string | undefined {
  if (db === '-inf') return undefined;
  if (!Number.isFinite(db)) return 'volumeDb must be a finite number or "-inf"';
  // The tolerance lets the reported maximum (6.0206 dB, rounded to 0.0001 dB) go back; the raw value clamps.
  if (db > VOLUME_DB_MAX + 1e-4) return `volumeDb must be at most ${VOLUME_DB_MAX.toFixed(4)} (the Bitwig maximum)`;
  if (db < VOLUME_DB_MIN) return `volumeDb must be at least ${VOLUME_DB_MIN}, or "-inf" for silence`;
  return undefined;
}

/** A problem with one raw value for the field, or undefined. */
export function mixerValueProblem(field: MixerField, value: unknown): string | undefined {
  switch (field) {
    case 'volume':
      return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= VOLUME_RAW_MAX
        ? undefined : `a raw volume must be 0..${VOLUME_RAW_MAX}`;
    case 'pan':
      return typeof value === 'number' && Number.isFinite(value) && value >= -1 && value <= 1
        ? undefined : 'a raw pan must be -1..1';
    case 'mute':
    case 'solo':
      return typeof value === 'boolean' ? undefined : `${field} must be a boolean`;
  }
}

/** Whether a readback holds the requested raw value. */
export function sameMixerValue(requested: number | boolean, observed: number | boolean): boolean {
  if (typeof requested === 'boolean' || typeof observed === 'boolean') return requested === observed;
  return Math.abs(requested - observed) <= MIXER_RAW_TOLERANCE;
}
