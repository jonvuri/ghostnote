/** 8h4b pure checks: a document read against an independent raw `clip.read`, and the raw diff of an operator edit. */
import type { RawNoteFields } from '../adapters/live/clip-read.js';
import { portableOccurrence } from '../bindings/ghostnote-document.js';
import { EVENT_DEFAULTS, normalizeTiming, parse, type EventField, type StateDocument } from '../document/index.js';
import { canonicalJson } from '../document/json.js';

export type Wire = Record<string, any>;
export const SCHEMA = 'phase8h4b-document-read-v1';
export const NORMAL: readonly [string, number, string] = ['normal-v1', 88, '68d457c4c4d1d7b3'];

export const rowKey = (row: RawNoteFields): string => `${row['channel']}:${row['pitch']}:${row['cell']}`;
/** The cell key of a document event: host channel, pitch, and 1/512-beat cell. */
export function eventKey(event: { channel?: number; pitch: number; at: string }): string {
  const [n, d = '1'] = event.at.split('/');
  return `${(event.channel ?? 1) - 1}:${event.pitch}:${BigInt(n!) * 512n / BigInt(d)}`;
}

/**
 * The portable values that one raw row must project to (HOST-BINDING.md field table). Written apart from the
 * binding: an enabled control with a neutral value is the default. Gain is `null` here; `agreement` checks it
 * by its defining property (`gainAgrees`).
 */
export function expectedEvent(row: RawNoteFields): Wire {
  const n = (name: string): number => Number(row[name]);
  const chanceOn = row['isChanceEnabled'] === true && n('chance') !== 1;
  const occurrenceOn = row['isOccurrenceEnabled'] === true && row['occurrence'] !== 'ALWAYS';
  const recurrenceOn = row['isRecurrenceEnabled'] === true && !(n('recurrenceLength') === 1 && n('recurrenceMask') === 1);
  return {
    duration: normalizeTiming(0, n('duration')).duration,
    velocity: Math.round(n('velocity') * 127),
    mute: row['isMuted'] === true,
    releaseVelocity: n('releaseVelocity'),
    expression: {
      velocitySpread: n('velocitySpread'), gain: null, pan: n('pan'), pressure: n('pressure'),
      timbre: (n('timbre') + 1) / 2, transpose: n('transpose'),
    },
    chance: { enabled: chanceOn, value: n('chance') },
    occurrence: { enabled: occurrenceOn, condition: portableOccurrence(String(row['occurrence'])) },
    recurrence: { enabled: recurrenceOn, length: n('recurrenceLength'), mask: n('recurrenceMask') },
  };
}

const DEFAULTS: Wire = {
  mute: false, releaseVelocity: 100 / 127,
  expression: { velocitySpread: 0, gain: 1, pan: 0, pressure: 0, timbre: 0.5, transpose: 0 },
  chance: { enabled: false, value: 1 }, occurrence: { enabled: false, condition: 'always' },
  recurrence: { enabled: false, length: 1, mask: 1 },
};
const plain = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

/**
 * E245: raw 0 is unity; a cube that underflows is portable 0; otherwise the cube root of the portable gain is the raw gain, and the portable gain is
 * within four units in the last place of `raw^3`.
 */
export function gainAgrees(portable: number, raw: number): boolean {
  if (raw === 0) return portable === 1;
  // A raw value whose cube underflows (the silent raw value 1e-323, E245) projects to portable 0.
  if (portable === 0) return raw ** 3 === 0;
  return Math.cbrt(portable) === raw && Math.abs(portable - raw ** 3) <= 4 * Number.EPSILON * raw ** 3;
}

/** Every disagreement between a FIELDS document and the raw rows. An empty list agrees. */
export function agreement(fields: string, rows: readonly RawNoteFields[]): string[] {
  const document = parse(fields, 'fields') as StateDocument;
  const issues: string[] = [];
  const raw = new Map(rows.map((row) => [rowKey(row), row]));
  if (document.events.length !== raw.size) issues.push(`events ${document.events.length}, raw rows ${raw.size}`);
  for (const event of document.events) {
    const row = raw.get(eventKey(event));
    if (row === undefined) { issues.push(`${event.id}: no raw row at ${eventKey(event)}`); continue; }
    const expected = expectedEvent(row);
    const actual: Wire = { duration: event.duration, velocity: event.velocity };
    for (const field of Object.keys(DEFAULTS)) actual[field] = plain((event as Wire)[field] ?? DEFAULTS[field]);
    if (!gainAgrees(actual.expression.gain, Number(row['gain']))) {
      issues.push(`${event.id} gain: ${actual.expression.gain} does not project raw ${row['gain']}`);
    }
    actual.expression.gain = null;
    for (const field of Object.keys(expected)) {
      if (canonicalJson(actual[field]) !== canonicalJson(expected[field])) {
        issues.push(`${event.id} ${field}: ${canonicalJson(actual[field])} != ${canonicalJson(expected[field])}`);
      }
    }
  }
  return issues;
}

/** The event ID of each cell key in a FIELDS document. */
export function idsByKey(fields: string): Map<string, string> {
  const document = parse(fields, 'fields') as StateDocument;
  return new Map(document.events.map((event) => [eventKey(event), event.id]));
}

/** The raw difference between two reads: keys removed, keys added, and changed fields at kept keys. */
export function rawDiff(before: readonly RawNoteFields[], after: readonly RawNoteFields[]) {
  const a = new Map(before.map((row) => [rowKey(row), row]));
  const b = new Map(after.map((row) => [rowKey(row), row]));
  const removed = [...a.keys()].filter((key) => !b.has(key));
  const added = [...b.keys()].filter((key) => !a.has(key));
  const changed = [...a.keys()].filter((key) => b.has(key)).flatMap((key) => {
    const fields = Object.keys(a.get(key)!).filter((field) => a.get(key)![field] !== b.get(key)![field]);
    return fields.length === 0 ? [] : [{ key, fields }];
  });
  return { removed, added, changed };
}

/** The raw fields of a new host note (E245). A row with only these values projects with no WITH object. */
const HOST_DEFAULT_ROW: Wire = {
  releaseVelocity: 100 / 127, velocitySpread: 0, gain: 0, pan: 0, pressure: 0, timbre: 0, transpose: 0, chance: 1,
  occurrence: 'ALWAYS', recurrenceLength: 1, recurrenceMask: 1, isMuted: false,
};

/** Events whose WITH presence disagrees with the raw row: WITH iff the row is not a host default (8h4b2). */
export function withIssues(fields: string, rows: readonly RawNoteFields[]): string[] {
  const raw = new Map(rows.map((row) => [rowKey(row), row]));
  const issues: string[] = [];
  const document = parse(fields, 'fields') as StateDocument;
  const lines = new Map(fields.split('\n').filter((line) => line.startsWith('EVENT ')).map((line) => [line.split(' ')[1]!, line]));
  for (const event of document.events) {
    const row = raw.get(eventKey(event));
    if (row === undefined) continue;
    const hostDefault = Object.entries(HOST_DEFAULT_ROW).every(([field, value]) => row[field] === value);
    const hasWith = lines.get(event.id)!.includes(' WITH ');
    if (hostDefault === hasWith) issues.push(`${event.id}: WITH ${hasWith}, host default ${hostDefault}`);
  }
  return issues;
}

/** Python `json.dumps(sort_keys=True, separators=(',', ':'), ensure_ascii=False)`. */
export function pythonCanonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(pythonCanonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${pythonCanonical((value as Record<string, unknown>)[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * The equivalent exact JSON of a one-clip document (8h4b2): the same notes and the same represented fields. Each
 * event states every field of its clip coverage, with defaults expanded, in 8c control style.
 */
export function equivalentExactJson(document: StateDocument): string {
  const covered = document.coverage[0]!.fields as EventField[];
  const defaults = EVENT_DEFAULTS as Record<string, unknown>;
  return pythonCanonical({
    length_beats: document.clips[0]!.length,
    notes: document.events.map((event) => Object.fromEntries(covered.filter((field) => field !== 'clip')
      .map((field) => [field, (event as unknown as Record<string, unknown>)[field] ?? defaults[field]]))),
  });
}
