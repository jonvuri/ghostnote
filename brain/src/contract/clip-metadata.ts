/**
 * Clip metadata field ownership (8i0, D42).
 *
 * A `clip.update` carries the complete candidate metadata for validation, and can name the fields that it writes.
 * Only those fields get a host setter, a readback comparison, and a reversal. A missing list means all fields: the
 * complete writer of a restore after clip deletion and of `stable-v1`.
 *
 * Marker fields are one group. A loop-start write can move the play markers (E43), so it also writes the length
 * and restores the play start. Loop end is derived: it follows loop start plus length and has no setter.
 */
import { CLIP_COLOR_TOLERANCE } from './clip-color.js';
import type { ClipMetadataState } from './state.js';

export type ClipMetadataField = keyof ClipMetadataState;

/** All fields in the host write order: the loop first, then the play start (E43). */
export const CLIP_METADATA_FIELDS: readonly ClipMetadataField[] = [
  'lengthBeats', 'loopStartBeats', 'loopEndBeats', 'playStartBeats', 'loopEnabled', 'name', 'color',
];

/** The order of readback differences (unchanged since E43). */
const REPORT_ORDER: readonly ClipMetadataField[] = [
  'name', 'color', 'lengthBeats', 'playStartBeats', 'loopEnabled', 'loopStartBeats', 'loopEndBeats',
];

const sameColor = (left: ClipMetadataState['color'], right: ClipMetadataState['color']): boolean =>
  left.red === right.red && left.green === right.green && left.blue === right.blue;

/** The fields to write so that the host goes from `prior` to `next`, with the marker dependencies. */
export function changedClipMetadataFields(prior: ClipMetadataState, next: ClipMetadataState): ClipMetadataField[] {
  const fields = new Set<ClipMetadataField>();
  if (prior.name !== next.name) fields.add('name');
  if (!sameColor(prior.color, next.color)) fields.add('color');
  if (prior.loopEnabled !== next.loopEnabled) fields.add('loopEnabled');
  const loopStart = prior.loopStartBeats !== next.loopStartBeats;
  if (loopStart || prior.lengthBeats !== next.lengthBeats || prior.loopEndBeats !== next.loopEndBeats) {
    for (const field of ['lengthBeats', 'loopEndBeats', 'playStartBeats'] as const) fields.add(field);
    if (loopStart) fields.add('loopStartBeats');
  }
  if (prior.playStartBeats !== next.playStartBeats) fields.add('playStartBeats');
  return CLIP_METADATA_FIELDS.filter((field) => fields.has(field));
}

/** The reason that a field list is not a valid write, or undefined when it is valid. */
export function assertClipMetadataFields(fields: readonly string[]): string | undefined {
  if (fields.length === 0) return 'a clip.update field list must name at least one field';
  if (new Set(fields).size !== fields.length) return 'a clip.update field list must not repeat a field';
  const known = new Set<string>(CLIP_METADATA_FIELDS);
  const unknown = fields.find((field) => !known.has(field));
  if (unknown !== undefined) return `unknown clip metadata field ${unknown}`;
  const has = new Set(fields);
  if (has.has('lengthBeats') !== has.has('loopEndBeats')) {
    return 'lengthBeats and loopEndBeats are written together: loop end follows loop start plus length';
  }
  if (has.has('loopStartBeats') && !has.has('lengthBeats')) {
    return 'a loopStartBeats write also writes lengthBeats and loopEndBeats';
  }
  if (has.has('lengthBeats') && !has.has('playStartBeats')) {
    return 'a loop marker write also restores playStartBeats (E43)';
  }
  return undefined;
}

export interface ClipMetadataDifference {
  /** `name`, `color.red`, `lengthBeats`, and so on. */
  readonly field: string;
  readonly requested: unknown;
  readonly observed: unknown;
}

/**
 * The differences of the compared fields. A written colour passes within the RGB tolerance (D42); a colour that
 * was not written must read back exactly. `same` compares the other values.
 */
export function clipMetadataDifferences(
  requested: ClipMetadataState,
  observed: ClipMetadataState,
  options: {
    readonly fields?: readonly ClipMetadataField[];
    readonly colorWritten?: boolean;
    readonly same?: (requested: unknown, observed: unknown) => boolean;
  } = {},
): ClipMetadataDifference[] {
  const fields = options.fields ?? CLIP_METADATA_FIELDS;
  const same = options.same ?? ((left: unknown, right: unknown) => left === right);
  const tolerance = options.colorWritten === true ? CLIP_COLOR_TOLERANCE : 0;
  const out: ClipMetadataDifference[] = [];
  for (const field of REPORT_ORDER) {
    if (!fields.includes(field)) continue;
    if (field === 'color') {
      for (const part of ['red', 'green', 'blue'] as const) {
        if (Math.abs(requested.color[part] - observed.color[part]) > tolerance) {
          out.push({ field: `color.${part}`, requested: requested.color[part], observed: observed.color[part] });
        }
      }
      continue;
    }
    if (!same(requested[field], observed[field])) {
      out.push({ field, requested: requested[field], observed: observed[field] });
    }
  }
  return out;
}

/** The candidate values of the owned fields over a base: unowned fields keep the base value. */
export function ownedClipMetadata(
  base: ClipMetadataState,
  owned: ClipMetadataState,
  fields: readonly ClipMetadataField[] | undefined,
): ClipMetadataState {
  if (fields === undefined) return owned;
  const next: Record<string, unknown> = { ...base };
  for (const field of fields) next[field] = owned[field];
  return next as unknown as ClipMetadataState;
}
