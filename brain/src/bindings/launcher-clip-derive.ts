/**
 * B19 session 4: a new clip derived from a source clip (slice, split, duplicate-and-vary).
 *
 * Pure: the source is the document of a fresh read; the result is a desired document for `add_launcher_clip`.
 *
 *   - The range `[from, to)` selects the notes whose onset lies in it. A note that starts before `from` stays out;
 *     a note that ends after `to` is shortened to end at `to`, and the result names it.
 *   - Each kept note moves by `shift - from`, so `from` lands at `shift`. The new clip is `shift + (to - from)`
 *     beats long, and it loops over that length when the source loops. The play range is not carried.
 *   - Every kept note keeps its source event ID, so a patch can name the source IDs (ID lineage). The clip keeps
 *     the source clip ID as its label; the write gives the new clip its own clip ID.
 *   - The clip name, META, and EXTENSIONS stay. Provenance (R33) stays, and a source range narrows to the slice
 *     when it spans exactly the source clip length (clip beat 0 is the start of that range); any other source is
 *     kept unchanged, because its beats do not map onto clip beats.
 *
 * The range arithmetic is exact (rational text). Every bound is on the 1/512-beat cell plane, so each derived
 * onset and duration stays on it.
 */
import {
  type ClipProvenance, type Event, type StateDocument,
} from '../document/index.js';
import { cmp, difference, onGrid, sum } from '../document/rational.js';
import { validate } from '../document/index.js';

export interface DeriveSpec {
  /** First source beat, inclusive. Default 0. */
  readonly from?: string;
  /** Last source beat, exclusive. Default the source clip length. */
  readonly to?: string;
  /** Where `from` lands in the new clip. Default 0. */
  readonly shift?: string;
}

export interface Derived {
  readonly document: StateDocument;
  readonly from: string;
  readonly to: string;
  readonly shift: string;
  readonly length: string;
  /** Event IDs of the kept notes, in document order. */
  readonly kept: readonly string[];
  /** Event IDs of kept notes that the range end shortened. */
  readonly shortened: readonly string[];
  /** Source notes outside the range. */
  readonly omitted: number;
  /** Provenance sources whose range narrowed to the slice (indices into `sources`); none for the whole clip. */
  readonly narrowedSources: readonly number[];
}

/** A refusal of the range, before any write. `field` names the input. */
export class DeriveRefusal extends Error {
  constructor(readonly field: 'from' | 'to' | 'shift' | 'source', message: string) {
    super(message);
    this.name = 'DeriveRefusal';
  }
}

/** Check one bound without the source: exact rational text, nonnegative, on the 1/512-beat plane. */
export function checkBound(field: 'from' | 'to' | 'shift', value: string): void {
  let ok: boolean;
  try {
    ok = cmp(value, '0') >= 0 && onGrid(value);
  } catch {
    ok = false;
  }
  if (!ok) {
    throw new DeriveRefusal(field, `${field} must be exact nonnegative beat text on the 1/512-beat plane, such as `
      + '"4" or "3/2".');
  }
}

function narrowed(provenance: ClipProvenance, sourceLength: string, from: string, to: string) {
  const indices: number[] = [];
  const whole = cmp(from, '0') === 0 && cmp(to, sourceLength) === 0;
  if (provenance.sources === undefined || whole) return { provenance, indices };
  const sources = provenance.sources.map((source, index) => {
    const range = source.range;
    if (range === undefined || cmp(difference(range.to, range.from), sourceLength) !== 0) return source;
    indices.push(index);
    return { ...source, range: { from: sum(range.from, from), to: sum(range.from, to) } };
  });
  return { provenance: { ...provenance, sources }, indices };
}

/** Derive the desired document of a new clip from a one-clip source document. */
export function deriveClip(sourceDocument: StateDocument, spec: DeriveSpec): Derived {
  // validate expands clip defaults (R34) into the events, so every kept event states its values.
  const source = validate(sourceDocument) as StateDocument;
  if (source.clips.length !== 1) throw new DeriveRefusal('source', 'The source document has more than one clip.');
  const clip = source.clips[0]!;
  const from = spec.from ?? '0', to = spec.to ?? clip.length, shift = spec.shift ?? '0';
  for (const [field, value] of [['from', from], ['to', to], ['shift', shift]] as const) checkBound(field, value);
  if (cmp(from, to) >= 0) throw new DeriveRefusal('to', `to (${to}) must be after from (${from}).`);
  if (cmp(to, clip.length) > 0) {
    throw new DeriveRefusal('to', `to (${to}) is after the end of the source clip (length ${clip.length}).`);
  }
  const length = sum(shift, difference(to, from));
  const offset = difference(shift, from);

  const kept: string[] = [], shortened: string[] = [];
  const events: Event[] = [];
  for (const event of source.events) {
    if (cmp(event.at, from) < 0 || cmp(event.at, to) >= 0) continue;
    const end = sum(event.at, event.duration);
    const cut = cmp(end, to) > 0;
    if (cut) shortened.push(event.id);
    kept.push(event.id);
    events.push({ ...event, at: sum(event.at, offset), duration: cut ? difference(to, event.at) : event.duration });
  }

  const carried = clip.provenance === undefined ? undefined : narrowed(clip.provenance, clip.length, from, to);
  const derivedClip: StateDocument['clips'][number] = {
    id: clip.id,
    length,
    ...(clip.name === undefined || clip.name === '' ? {} : { name: clip.name }),
    ...((clip.loop ?? null) === null ? {} : { loop: { from: '0', to: length } }),
    ...(carried === undefined ? {} : { provenance: carried.provenance }),
  };
  const coverage = source.coverage.find((item) => item.clip === clip.id)!;
  const document = validate({
    format: source.format,
    version: source.version,
    kind: 'desired',
    ...(source.meta === undefined ? {} : { meta: source.meta }),
    ...(source.extensions === undefined ? {} : { extensions: source.extensions }),
    clips: [derivedClip],
    coverage: [{ clip: clip.id, from: '0', to: length, channels: coverage.channels, fields: 'all', status: 'complete' }],
    events,
  }) as StateDocument;
  return {
    document, from, to, shift, length, kept, shortened,
    omitted: source.events.length - kept.length,
    narrowedSources: carried?.indices ?? [],
  };
}
