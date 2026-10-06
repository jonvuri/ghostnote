/**
 * The 8h3c clip read: decode `notes-v1` pages into contract notes.
 *
 * The extension reads one launcher clip completely from its replay through one
 * 1/512-beat view (D23, D30). A page is the 8h3b `packedDict` format for all
 * note fields (E229). Each column is a constant, a table with u8 or u16
 * indexes, or raw f64, i32, or u8 values. The `data` block holds the table and
 * raw sections in column order, little-endian.
 *
 * Note mapping follows D31. A start is the start of its 1/512 cell. Release
 * velocity and the four playback-control enable flags are always present, so a
 * reconstruction writes a disabled control as disabled. A raw recurrence value
 * is kept also when recurrence is disabled.
 */
import type { NoteRecord } from '../../contract/index.js';

export const NOTE_FRAME_FORMAT = 'notes-v1';
export const CLIP_READ_GRID = 1 / 512;

export interface NoteFrame {
  readonly format: string;
  readonly count: number;
  readonly from: number;
  readonly size: number;
  readonly next: number;
  readonly columns: readonly (readonly [string, 'const' | 'dict' | 'raw', string?])[];
  readonly constants: Readonly<Record<string, number | boolean | string>>;
  readonly tables: Readonly<Record<string, readonly (number | string)[]>>;
  readonly data: string;
}

/** The raw fields of one note, as the host reported them. */
export type RawNoteFields = Readonly<Record<string, number | boolean | string>>;

const FLAGS = new Set(['isChanceEnabled', 'isMuted', 'isOccurrenceEnabled', 'isRecurrenceEnabled', 'isRepeatEnabled']);
const REQUIRED = [
  'channel', 'pitch', 'cell', 'velocity', 'releaseVelocity', 'velocitySpread', 'duration', 'gain', 'pan',
  'pressure', 'timbre', 'transpose', 'chance', 'repeatCurve', 'repeatVelocityCurve', 'repeatVelocityEnd',
  'occurrence', 'recurrenceLength', 'recurrenceMask', 'repeatCount', ...FLAGS,
];
const SIZES: Readonly<Record<string, number>> = { f64: 8, i32: 4, u16: 2, u8: 1 };

export class NoteFrameError extends Error {
  constructor(message: string) {
    super(`notes-v1 frame: ${message}`);
    this.name = 'NoteFrameError';
  }
}

/**
 * Decode one page into raw field rows, in page order. A page holds at most
 * `maxSize` notes: the page size that `rig.info` reports.
 */
export function decodeNoteFrame(frame: NoteFrame, maxSize: number): RawNoteFields[] {
  if (frame.format !== NOTE_FRAME_FORMAT) throw new NoteFrameError(`unknown format ${String(frame.format)}`);
  const n = frame.size;
  if (!Number.isInteger(n) || n < 0 || n > maxSize) throw new NoteFrameError('invalid size');
  const names = frame.columns.map(([name]) => name);
  if (new Set(names).size !== names.length || names.some((name) => !REQUIRED.includes(name))) {
    throw new NoteFrameError('duplicate or unknown column');
  }
  for (const name of REQUIRED) {
    if (!names.includes(name)) throw new NoteFrameError(`missing column ${name}`);
  }
  const bytes = Buffer.from(frame.data, 'base64');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  const rows: Record<string, number | boolean | string>[] = Array.from({ length: n }, () => ({}));
  for (const [name, encoding, type] of frame.columns) {
    if (encoding === 'const') {
      const value = frame.constants[name];
      if (value === undefined) throw new NoteFrameError(`missing constant ${name}`);
      for (const row of rows) row[name] = value;
      continue;
    }
    const size = type === undefined ? undefined : SIZES[type];
    if (size === undefined) throw new NoteFrameError(`unknown type ${String(type)} for ${name}`);
    if (offset + n * size > bytes.byteLength) throw new NoteFrameError(`section ${name} is truncated`);
    const read = (i: number): number => {
      const at = offset + i * size;
      switch (type) {
        case 'f64': return view.getFloat64(at, true);
        case 'i32': return view.getInt32(at, true);
        case 'u16': return view.getUint16(at, true);
        default: return view.getUint8(at);
      }
    };
    if (encoding === 'dict') {
      const table = frame.tables[name];
      if (table === undefined) throw new NoteFrameError(`missing table ${name}`);
      for (let i = 0; i < n; i += 1) {
        const value = table[read(i)];
        if (value === undefined) throw new NoteFrameError(`index outside table ${name}`);
        rows[i]![name] = value;
      }
    } else if (encoding === 'raw') {
      for (let i = 0; i < n; i += 1) rows[i]![name] = FLAGS.has(name) ? read(i) !== 0 : read(i);
    } else {
      throw new NoteFrameError(`unknown encoding ${String(encoding)} for ${name}`);
    }
    offset += n * size;
  }
  if (offset !== bytes.byteLength) throw new NoteFrameError('data has trailing bytes');
  return rows;
}

const DEFAULTS: Readonly<Record<string, number | string>> = {
  velocitySpread: 0, gain: 0, pan: 0, pressure: 0, timbre: 0, transpose: 0, chance: 1,
  occurrence: 'ALWAYS', repeatCount: 0, repeatCurve: 0, repeatVelocityCurve: 0, repeatVelocityEnd: 0,
};

/**
 * One raw row -> one contract note (D31).
 *
 * A value equal to the default of a new host note is omitted. The decoder
 * defaults of `decodeVerboseNote` differ from those defaults for five fields:
 * `releaseVelocity` and the enable flags of chance, occurrence, recurrence,
 * and repeat. These fields are therefore always present. Otherwise a
 * reconstruction writes a new note and the host default replaces the read
 * value (E224). `recurrence` is present when it is enabled or when its raw
 * value is not `[1, 1]`.
 */
export function readerNote(fields: RawNoteFields): NoteRecord {
  const num = (name: string): number => {
    const value = fields[name];
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new NoteFrameError(`${name} is not a finite number`);
    return value;
  };
  for (const name of REQUIRED) {
    if (FLAGS.has(name)) {
      if (typeof fields[name] !== 'boolean') throw new NoteFrameError(`${name} is not a boolean`);
    } else if (name === 'occurrence') {
      if (typeof fields[name] !== 'string' || fields[name] === '') throw new NoteFrameError('invalid occurrence');
    } else num(name);
  }
  for (const [name, maximum] of [['cell', 4_194_303], ['pitch', 127], ['channel', 15]] as const) {
    const value = num(name);
    if (!Number.isInteger(value) || value < 0 || value > maximum) throw new NoteFrameError(`invalid ${name}`);
  }
  const note: Record<string, unknown> = {
    startBeats: num('cell') * CLIP_READ_GRID,
    pitch: num('pitch'),
    velocity: Math.round(num('velocity') * 127),
    durationBeats: num('duration'),
    releaseVelocity: num('releaseVelocity'),
  };
  for (const [name, fallback] of Object.entries(DEFAULTS)) {
    const value = fields[name];
    if (value !== undefined && value !== fallback) note[name] = value;
  }
  for (const flag of ['isChanceEnabled', 'isOccurrenceEnabled', 'isRecurrenceEnabled', 'isRepeatEnabled']) {
    note[flag] = fields[flag] === true;
  }
  if (fields['isMuted'] === true) note['isMuted'] = true;
  const length = num('recurrenceLength');
  const mask = num('recurrenceMask');
  if (fields['isRecurrenceEnabled'] === true || length !== 1 || mask !== 1) note['recurrence'] = [length, mask];
  return note as unknown as NoteRecord;
}

/** Group decoded rows into the 16 MIDI channels, each sorted by start and pitch. */
export function notesByChannel(rows: readonly RawNoteFields[]): Map<number, NoteRecord[]> {
  const channels = new Map<number, NoteRecord[]>();
  for (let channel = 0; channel < 16; channel += 1) channels.set(channel, []);
  for (const row of rows) {
    const channel = row['channel'];
    if (typeof channel !== 'number' || !Number.isInteger(channel) || channel < 0 || channel > 15) {
      throw new NoteFrameError('a note has an invalid MIDI channel');
    }
    channels.get(channel)!.push(readerNote(row));
  }
  for (const notes of channels.values()) {
    notes.sort((left, right) => left.startBeats - right.startBeats || left.pitch - right.pitch);
  }
  return channels;
}
