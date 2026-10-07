/** 8h4b pure checks: a document read against an independent raw `clip.read`, and the raw diff of an operator edit. */
import type { RawNoteFields } from '../adapters/live/clip-read.js';
import { portableOccurrence } from '../bindings/ghostnote-document.js';
import { normalizeTiming, parse, type StateDocument } from '../document/index.js';
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

/** The portable values that one raw row must project to (HOST-BINDING.md field table). */
export function expectedEvent(row: RawNoteFields): Wire {
  const n = (name: string): number => Number(row[name]);
  return {
    duration: normalizeTiming(0, n('duration')).duration,
    velocity: Math.round(n('velocity') * 127),
    mute: row['isMuted'] === true,
    releaseVelocity: n('releaseVelocity'),
    expression: {
      velocitySpread: n('velocitySpread'), gain: n('gain'), pan: n('pan'), pressure: n('pressure'),
      timbre: (n('timbre') + 1) / 2, transpose: n('transpose'),
    },
    chance: { enabled: row['isChanceEnabled'] === true, value: n('chance') },
    occurrence: { enabled: row['isOccurrenceEnabled'] === true, condition: portableOccurrence(String(row['occurrence'])) },
    recurrence: { enabled: row['isRecurrenceEnabled'] === true, length: n('recurrenceLength'), mask: n('recurrenceMask') },
  };
}

const DEFAULTS: Wire = {
  mute: false, releaseVelocity: 0.5,
  expression: { velocitySpread: 0, gain: 1, pan: 0, pressure: 0, timbre: 0.5, transpose: 0 },
  chance: { enabled: false, value: 1 }, occurrence: { enabled: false, condition: 'always' },
  recurrence: { enabled: false, length: 1, mask: 1 },
};
const plain = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

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
