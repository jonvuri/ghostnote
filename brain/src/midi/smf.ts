/** Bounded Standard MIDI File framing. This module has no host or filesystem access. */
export const MIDI_LIMITS = { bytes: 8 * 1024 * 1024, tracks: 256, events: 262144, notes: 16384 } as const;
export class MidiError extends Error {
  constructor(readonly code: 'invalid-input' | 'unsupported' | 'outside-limit' | 'collision',
    message: string, readonly detail?: unknown) { super(message); this.name = 'MidiError'; }
}
export function requireMidi(ok: unknown, message: string, code: MidiError['code'] = 'invalid-input'): asserts ok {
  if (!ok) throw new MidiError(code, message);
}
export interface MidiEvent { tick: number; order: number; status: number; meta?: number; data: Buffer }
export interface MidiTrack { events: MidiEvent[]; endTick: number }
export interface MidiFile { format: number; ppq: number; tracks: MidiTrack[] }

export function parseSmf(bytes: Buffer): MidiFile {
  requireMidi(bytes.length <= MIDI_LIMITS.bytes, 'MIDI input exceeds 8 MiB.', 'outside-limit');
  let p = 0, end = bytes.length;
  const take = (n: number): Buffer => {
    requireMidi(n >= 0 && p + n <= end, `Truncated MIDI data at byte ${p}.`);
    const data = bytes.subarray(p, p + n); p += n; return data;
  };
  const byte = () => take(1)[0]!;
  const vlq = (): number => {
    let value = 0;
    for (let i = 0; i < 4; i++) {
      const b = byte(); value = value * 128 + (b & 127);
      if (b < 128) return value;
    }
    throw new MidiError('invalid-input', 'MIDI variable-length quantity exceeds four bytes.');
  };
  requireMidi(take(4).toString('ascii') === 'MThd', 'Expected a Standard MIDI File header.');
  const headerSize = take(4).readUInt32BE();
  requireMidi(headerSize >= 6, 'MIDI header is too short.');
  const header = take(headerSize), format = header.readUInt16BE(0), count = header.readUInt16BE(2), ppq = header.readUInt16BE(4);
  requireMidi(format === 0 || format === 1, 'Only MIDI formats 0 and 1 are supported.', 'unsupported');
  requireMidi(ppq > 0 && !(ppq & 0x8000), 'Only quarter-note tick timing is supported; SMPTE timing is unsupported.', 'unsupported');
  requireMidi(count > 0 && (format !== 0 || count === 1), 'Invalid MIDI track count.');
  requireMidi(count <= MIDI_LIMITS.tracks, 'MIDI input exceeds 256 tracks.', 'outside-limit');
  const tracks: MidiTrack[] = []; let total = 0;
  for (let t = 0; t < count; t++) {
    requireMidi(take(4).toString('ascii') === 'MTrk', 'Expected a MIDI track chunk.');
    const size = take(4).readUInt32BE();
    requireMidi(p + size <= bytes.length, 'Truncated MIDI track.');
    end = p + size; let tick = 0, running = 0, ended = false;
    const events: MidiEvent[] = [];
    while (p < end) {
      requireMidi(++total <= MIDI_LIMITS.events, 'MIDI input exceeds 262144 events.', 'outside-limit');
      tick += vlq(); requireMidi(Number.isSafeInteger(tick), 'MIDI tick position exceeds the integer limit.', 'outside-limit');
      let status = byte();
      if (status < 128) {
        requireMidi(running !== 0, 'Running status has no preceding channel message.');
        p--; status = running;
      }
      const order = events.length;
      if (status === 0xff) {
        running = 0;
        const meta = byte(); requireMidi(meta < 128, 'Invalid MIDI meta-event type.');
        const data = take(vlq());
        const lengths: Record<number, number> = { 0x00: 2, 0x20: 1, 0x21: 1, 0x2f: 0, 0x51: 3, 0x54: 5, 0x58: 4, 0x59: 2 };
        requireMidi(lengths[meta] === undefined || data.length === lengths[meta], `Invalid length for MIDI meta event ${meta}.`);
        events.push({ tick, order, status, meta, data });
        if (meta === 0x2f) { requireMidi(p === end, 'Data follows the end-of-track event.'); ended = true; }
      } else if (status === 0xf0 || status === 0xf7) {
        running = 0; events.push({ tick, order, status, data: take(vlq()) });
      } else {
        requireMidi(status >= 0x80 && status <= 0xef, 'Unsupported MIDI status byte.');
        running = status;
        const kind = status >> 4, data = take(kind === 0xc || kind === 0xd ? 1 : 2);
        requireMidi(data.every(b => b < 128), 'MIDI channel data contains a status byte.');
        events.push({ tick, order, status, data });
      }
    }
    requireMidi(ended, 'MIDI track has no end-of-track event.');
    tracks.push({ events, endTick: tick }); end = bytes.length;
  }
  requireMidi(p === bytes.length, 'Unexpected data after MIDI tracks.');
  return { format, ppq, tracks };
}

export function vlq(value: number): Buffer {
  requireMidi(Number.isSafeInteger(value) && value >= 0 && value <= 0x0fffffff,
    'MIDI event gap exceeds the four-byte tick limit.', 'outside-limit');
  const bytes = [value & 127];
  while ((value = Math.floor(value / 128)) > 0) bytes.unshift((value & 127) | 128);
  return Buffer.from(bytes);
}
export interface OutputEvent { tick: number; priority: number; bytes: Buffer; order?: number }
export const metaEvent = (type: number, data: Buffer): Buffer => Buffer.concat([Buffer.from([0xff, type]), vlq(data.length), data]);
export function writeSmf(tracks: OutputEvent[][], ppq = 512): Buffer {
  requireMidi(tracks.length > 0 && tracks.length <= MIDI_LIMITS.tracks, 'Output exceeds 256 MIDI tracks.', 'outside-limit');
  const header = Buffer.alloc(14); header.write('MThd'); header.writeUInt32BE(6, 4);
  header.writeUInt16BE(1, 8); header.writeUInt16BE(tracks.length, 10); header.writeUInt16BE(ppq, 12);
  const chunks = tracks.map(events => {
    events.sort((a, b) => a.tick - b.tick || a.priority - b.priority || (a.order ?? 0) - (b.order ?? 0) || Buffer.compare(a.bytes, b.bytes));
    let previous = 0;
    const parts = events.map(e => { const delta = vlq(e.tick - previous); previous = e.tick; return Buffer.concat([delta, e.bytes]); });
    const body = Buffer.concat(parts), head = Buffer.alloc(8); head.write('MTrk'); head.writeUInt32BE(body.length, 4);
    return Buffer.concat([head, body]);
  });
  const bytes = Buffer.concat([header, ...chunks]);
  requireMidi(bytes.length <= MIDI_LIMITS.bytes, 'MIDI output exceeds 8 MiB.', 'outside-limit');
  return bytes;
}
