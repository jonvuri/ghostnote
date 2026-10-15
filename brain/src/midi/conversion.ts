/** Exact MIDI timing conversion and the Document 1.0 import boundary. */
import { importNotes, sealOverlays, validate, BINDING, EVENT_DEFAULTS, ImportCollisionError,
  LIMITS, type StateDocument, type SourceNote, type Document } from '../document/index.js';
import { add, sub, fraction, rational, spelling, cmp, sum, type Rational } from '../document/rational.js';
import { MIDI_LIMITS, MidiError, requireMidi, parseSmf, writeSmf, metaEvent, type OutputEvent } from './smf.js';

export const MIDI_CONVERSION_VERSION = 'midi-document-v1';
const channels = Array.from({ length: 16 }, (_, i) => i + 1);
export interface Loss { code: string; count: number }
const countLoss = (counts: Map<string, number>, code: string, count = 1) => counts.set(code, (counts.get(code) ?? 0) + count);
const lossesOf = (counts: Map<string, number>): Loss[] => [...counts].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([code, count]) => ({ code, count }));
interface Tempo { tick: number; microseconds: number }
interface Meter { tick: number; numerator: number; denominator: number }
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const mul = (a: Rational, b: Rational) => fraction(a.n * b.n, a.d * b.d);

/** Convert a finite decimal BPM input to an exact decimal rational. */
function bpmValue(bpm: number): Rational {
  requireMidi(Number.isFinite(bpm) && bpm > 0 && bpm <= 1000, 'BPM must be greater than 0 and at most 1000.');
  const [mantissa, exponent = '0'] = String(bpm).toLowerCase().split('e');
  const [whole, decimals = ''] = mantissa!.split('.');
  const power = Number(exponent) - decimals.length;
  return power >= 0 ? fraction(BigInt(whole! + decimals) * 10n ** BigInt(power))
    : fraction(BigInt(whole! + decimals), 10n ** BigInt(-power));
}
function uniqueMap<T extends { tick: number }>(values: T[], label: string): T[] {
  const map = new Map<number, T>();
  for (const value of values) {
    const old = map.get(value.tick);
    requireMidi(!old || same(old, value), `Conflicting ${label} events at tick ${value.tick}.`, 'unsupported');
    map.set(value.tick, value);
  }
  return [...map.values()].sort((a, b) => a.tick - b.tick);
}

export function importMidi(bytes: Buffer, options: { targetBpm?: number } = {}) {
  const midi = parseSmf(bytes), ignored = new Map<string, number>();
  const target = options.targetBpm === undefined ? undefined : bpmValue(options.targetBpm);
  const tempos: Tempo[] = [], meters: Meter[] = [];
  const trackNames = new Map<number, string>();
  for (const [trackIndex, track] of midi.tracks.entries()) for (const event of track.events) {
    if (event.meta === 0x51) {
      const microseconds = event.data.readUIntBE(0, 3);
      requireMidi(microseconds > 0, 'MIDI tempo must be positive.');
      tempos.push({ tick: event.tick, microseconds });
    } else if (event.meta === 0x58) {
      const [numerator, power, clocks, thirtySeconds] = event.data;
      requireMidi(numerator! > 0 && numerator! <= 64 && power! <= 6, 'Time signature exceeds Document 1.0 limits.', 'unsupported');
      meters.push({ tick: event.tick, numerator: numerator!, denominator: 2 ** power! });
      if (clocks !== 24 || thirtySeconds !== 8) countLoss(ignored, 'meter-click-fields');
    } else if (event.meta === 3 && !trackNames.has(trackIndex)) {
      // SMF text has no mandatory encoding. UTF-8 is tried first, then Latin-1.
      let name: string;
      try { name = new TextDecoder('utf-8', { fatal: true }).decode(event.data); }
      catch { name = event.data.toString('latin1'); countLoss(ignored, 'track-name-latin1-decoded'); }
      trackNames.set(trackIndex, name);
    } else if (event.meta === 0x21) {
      requireMidi(event.data[0] === 0, 'Multiple MIDI ports cannot be represented.', 'unsupported');
      countLoss(ignored, 'midi-port');
    } else if (event.meta !== 0x2f && (event.status >= 0xf0 || ![8, 9].includes(event.status >> 4))) {
      const labels: Record<number, string> = { 0xa: 'poly-pressure', 0xb: 'control-change', 0xc: 'program-change', 0xd: 'channel-pressure', 0xe: 'pitch-bend' };
      countLoss(ignored, event.meta !== undefined ? `meta-${event.meta.toString(16).padStart(2, '0')}`
        : event.status >= 0xf0 ? 'sysex' : labels[event.status >> 4]!);
    }
  }
  let tempoMap = uniqueMap(tempos, 'tempo');
  const defaultTempo = !tempoMap.some(t => t.tick === 0);
  if (defaultTempo) tempoMap = [{ tick: 0, microseconds: 500000 }, ...tempoMap];
  const meterMap = uniqueMap(meters, 'meter');
  // Prefix integrals plus binary search avoid rescanning the map for each note.
  let elapsed = fraction(0n);
  const clock = tempoMap.map((t, i) => {
    if (i) elapsed = add(elapsed, fraction(BigInt(t.tick - tempoMap[i - 1]!.tick) * BigInt(tempoMap[i - 1]!.microseconds), BigInt(midi.ppq) * 1000000n));
    return { ...t, elapsed };
  });
  const position = (tick: number): Rational => {
    if (!target) return fraction(BigInt(tick), BigInt(midi.ppq));
    let low = 0, high = clock.length;
    while (low + 1 < high) { const mid = (low + high) >> 1; if (clock[mid]!.tick <= tick) low = mid; else high = mid; }
    const t = clock[low]!;
    const seconds = add(t.elapsed, fraction(BigInt(tick - t.tick) * BigInt(t.microseconds), BigInt(midi.ppq) * 1000000n));
    return mul(seconds, fraction(target.n, target.d * 60n));
  };
  const selected = midi.tracks.map((track, index) => ({ track, index })).filter(({ track, index }) =>
    track.events.some(e => e.status < 0xf0) || (index > 0 && trackNames.has(index)));
  if (!selected.length) selected.push({ track: midi.tracks[0]!, index: 0 });
  for (const index of trackNames.keys()) if (!selected.some(t => t.index === index)) countLoss(ignored, 'conductor-track-name');
  const source: SourceNote[] = [];
  let overlappingNoteOns = 0;
  const tracks = selected.map(({ track, index }) => {
    const clip = `c${index + 1}`, active = new Map<string, { notes: { tick: number; velocity: number; id: string }[]; head: number }>();
    let noteCount = 0, openCount = 0;
    for (const event of track.events) {
      const kind = event.status >> 4;
      if (kind !== 8 && kind !== 9) continue;
      const channel = (event.status & 15) + 1, pitch = event.data[0]!, key = `${channel}:${pitch}`;
      if (kind === 9 && event.data[1]! > 0) {
        const queue = active.get(key) ?? { notes: [], head: 0 };
        if (queue.head < queue.notes.length) overlappingNoteOns++;
        requireMidi(source.length + openCount < MIDI_LIMITS.notes, 'MIDI input exceeds 16384 notes.', 'outside-limit');
        queue.notes.push({ tick: event.tick, velocity: event.data[1]!, id: `${clip}n${++noteCount}` });
        active.set(key, queue); openCount++;
      } else {
        const queue = active.get(key), start = queue?.notes[queue.head];
        requireMidi(start, `Note-off has no note-on (track ${index}, channel ${channel}, pitch ${pitch}).`);
        requireMidi(event.tick > start.tick, 'Zero-duration MIDI notes cannot be imported.');
        const at = position(start.tick), duration = sub(position(event.tick), at);
        source.push({ id: start.id, clip, channel, pitch, velocity: start.velocity, at: spelling(at),
          duration: spelling(duration), releaseVelocity: (kind === 8 ? event.data[1]! : 64) / 127 });
        queue!.head++; openCount--;
        if (queue!.head === queue!.notes.length) active.delete(key);
      }
    }
    requireMidi(active.size === 0, `Track ${index} ends with unclosed notes.`);
    return { clip, index, name: trackNames.get(index) ?? `Track ${index + 1}`, noteCount, length: spelling(position(track.endTick)) };
  });
  let imported: ReturnType<typeof importNotes>;
  try { imported = importNotes(source); }
  catch (error) {
    if (error instanceof ImportCollisionError) throw new MidiError('collision', 'MIDI notes collide after 1/512-beat normalization.', { collisions: error.report.collisionGroups });
    throw error;
  }
  const doc: StateDocument = { format: 'ghostnote-document', version: '1.0', kind: 'desired',
    clips: tracks.map(t => ({ id: t.clip, name: t.name, length: t.length })),
    coverage: tracks.map(t => ({ clip: t.clip, from: '0', to: t.length, channels, fields: 'all', status: 'complete' })),
    events: imported.events, overlays: [] };
  const overlay = (type: 'tempo' | 'meter', clip: string, at: string, data: Record<string, number>) => {
    requireMidi(doc.overlays.length < LIMITS.overlays, 'MIDI metadata exceeds the document overlay limit.', 'outside-limit');
    doc.overlays.push({ id: `m${doc.overlays.length + 1}`, state: 'current', basis: '0'.repeat(64),
      provenance: { kind: 'declared', source: 'midi-file', method: MIDI_CONVERSION_VERSION },
      depends: { clips: [{ id: clip, fields: ['length'] }], events: [], overlays: [], membership: [] },
      ...(type === 'tempo' ? { type: 'tempo', data: { clip, at, bpm: data.bpm! } }
        : { type: 'meter', data: { clip, at, numerator: data.numerator!, denominator: data.denominator! } }) });
  };
  for (const track of tracks) {
    for (const tempo of target ? [{ tick: 0, microseconds: 60000000 / options.targetBpm! }] : tempoMap) {
      const at = spelling(position(tempo.tick));
      if (cmp(at, track.length) >= 0 && !(at === '0' && track.length === '0')) continue;
      const bpm = target ? options.targetBpm! : 60000000 / tempo.microseconds;
      requireMidi(bpm <= 1000, 'Source tempo exceeds 1000 BPM; supply targetBpm to convert elapsed time.', 'unsupported');
      overlay('tempo', track.clip, at, { bpm });
    }
    for (const meter of meterMap) {
      const at = spelling(position(meter.tick));
      if (cmp(at, track.length) < 0 || (at === '0' && track.length === '0')) overlay('meter', track.clip, at, { numerator: meter.numerator, denominator: meter.denominator });
    }
  }
  for (const [kind, points] of [['tempo', tempoMap], ['meter', meterMap]] as const) {
    for (const point of points) {
      const at = spelling(position(point.tick));
      if (!tracks.some(t => cmp(at, t.length) < 0 || (at === '0' && t.length === '0'))) countLoss(ignored, `${kind}-outside-clips`);
    }
  }
  const document = sealOverlays(doc);
  return { document, normalization: imported.report, report: { version: MIDI_CONVERSION_VERSION, sourceFormat: midi.format, sourcePpq: midi.ppq,
    timing: target ? 'elapsed-time-at-target-bpm' : 'source-beats', targetBpm: options.targetBpm ?? null,
    notePairing: 'fifo-per-track-channel-pitch', overlappingNoteOns, velocityZeroOffReleaseVelocity: 64,
    sourceTempoMap: tempoMap, defaultTempoApplied: defaultTempo, tracks,
    notes: imported.events.length, normalizedOnsets: imported.report.notes.filter(n => n.atDelta !== '0').length,
    normalizedDurations: imported.report.notes.filter(n => n.durationDelta !== '0').length,
    minimumDurationPromotions: imported.report.notes.filter(n => n.minimumDurationPromotion).length,
    changedOverlapPairs: imported.report.changedOverlaps.length, ignored: lossesOf(ignored) } };
}

export function exportMidi(input: Document, options: { acceptLoss?: boolean; bpm?: number } = {}) {
  const document = validate(input);
  requireMidi(document.kind !== 'patch', 'Export needs a complete desired document or a complete snapshot.');
  // A snapshot needs known MIDI fields. Other fields can remain unobserved.
  const lengths = new Map(document.clips.map(clip => [clip.id, clip.length]));
  for (const coverage of document.coverage) {
    requireMidi(coverage.status === 'complete' && cmp(coverage.from, '0') === 0
      && cmp(coverage.to, lengths.get(coverage.clip)!) === 0 && coverage.channels.length === 16,
    `MIDI export needs complete coverage of the full clip and all 16 channels (${coverage.clip}).`);
    const missingFields = [...BINDING, 'releaseVelocity' as const]
      .filter(field => coverage.fields !== 'all' && !coverage.fields.includes(field));
    if (missingFields.length) throw new MidiError('invalid-input',
      `MIDI export needs observed note fields for clip ${coverage.clip}: ${missingFields.join(', ')}. Read these fields; do not change coverage to all.`,
      { clip: coverage.clip, missingFields });
  }
  requireMidi(document.clips.length > 0 && document.clips.length < MIDI_LIMITS.tracks,
    'Export needs 1 to 255 clips (plus the tempo track).', 'outside-limit');
  requireMidi(document.events.length <= MIDI_LIMITS.notes, 'MIDI export exceeds 16384 notes.', 'outside-limit');
  if (options.bpm !== undefined) bpmValue(options.bpm);
  const losses = new Map<string, number>(), rounding = new Map<string, number>();
  const tick = (at: string): number => {
    const r = rational(at), scaled = r.n * 512n;
    const result = (scaled * 2n + r.d) / (r.d * 2n);
    requireMidi(result <= BigInt(Number.MAX_SAFE_INTEGER), 'Output tick position is too large.', 'outside-limit');
    if (scaled % r.d) countLoss(rounding, 'metadata-time-rounded');
    return Number(result);
  };
  for (const type of ['tempo', 'meter'] as const) {
    if (type === 'tempo' && options.bpm !== undefined) continue;
    const maps = document.clips.map(clip => ({ clip, points: document.overlays
      .filter(o => o.type === type && o.state === 'current' && o.data.clip === clip.id)
      .map(o => {
        if (o.type !== 'tempo' && o.type !== 'meter') throw new Error('metadata type');
        return { at: o.data.at, value: o.type === 'tempo' ? [o.data.bpm] : [o.data.numerator, o.data.denominator] };
      }).sort((a, b) => cmp(a.at, b.at)) })).filter(m => m.points.length);
    for (let i = 0; i < maps.length; i++) for (let j = i + 1; j < maps.length; j++) {
      const a = maps[i]!, b = maps[j]!;
      const length = cmp(a.clip.length, b.clip.length) < 0 ? a.clip.length : b.clip.length;
      const points = [...new Set([...a.points, ...b.points].map(p => p.at))].sort(cmp);
      let ai = 0, bi = 0;
      for (const at of points) {
        if (cmp(at, length) >= 0) break;
        while (ai + 1 < a.points.length && cmp(a.points[ai + 1]!.at, at) <= 0) ai++;
        while (bi + 1 < b.points.length && cmp(b.points[bi + 1]!.at, at) <= 0) bi++;
        const ap = a.points[ai]!, bp = b.points[bi]!;
        if (cmp(ap.at, at) <= 0 && cmp(bp.at, at) <= 0) requireMidi(same(ap.value, bp.value),
          `Clips ${a.clip.id} and ${b.clip.id} have incompatible ${type} maps at beat ${at}.`, 'unsupported');
      }
    }
  }
  const tempoEvents = new Map<number, Buffer>(), meterEvents = new Map<number, Buffer>();
  const put = (map: Map<number, Buffer>, at: number, bytes: Buffer) => {
    requireMidi(!map.has(at) || map.get(at)!.equals(bytes), `Conflicting global MIDI metadata at tick ${at}.`, 'unsupported');
    map.set(at, bytes);
  };
  const tempoBytes = (bpm: number): Buffer => {
    const b = bpmValue(bpm), us = (60000000n * b.d * 2n + b.n) / (b.n * 2n);
    requireMidi(us > 0 && us <= 0xffffffn, 'Tempo is outside the MIDI microseconds range.', 'unsupported');
    if (60000000n * b.d % b.n) countLoss(rounding, 'tempo-microseconds-rounded');
    const data = Buffer.alloc(3); data.writeUIntBE(Number(us), 0, 3); return metaEvent(0x51, data);
  };
  for (const overlay of document.overlays) {
    if (overlay.state !== 'current' || (overlay.type !== 'tempo' && overlay.type !== 'meter')) {
      countLoss(losses, `overlay-${overlay.type}`); continue;
    }
    if (overlay.type === 'tempo') {
      if (options.bpm !== undefined) { countLoss(losses, 'tempo-map-overridden'); continue; }
      put(tempoEvents, tick(overlay.data.at), tempoBytes(overlay.data.bpm));
    } else put(meterEvents, tick(overlay.data.at), metaEvent(0x58,
      Buffer.from([overlay.data.numerator, Math.log2(overlay.data.denominator), 24, 8])));
  }
  if (options.bpm !== undefined || !tempoEvents.has(0)) tempoEvents.set(0, tempoBytes(options.bpm ?? 120));
  const conductor: OutputEvent[] = [
    ...[...tempoEvents].map(([at, bytes]) => ({ tick: at, priority: 0, bytes })),
    ...[...meterEvents].map(([at, bytes]) => ({ tick: at, priority: 1, bytes })),
  ];
  const activeAddresses = new Map<string, { at: string; end: string; id: string; clip: string }[]>();
  let noteCount = 0, lastTick = 0;
  const tracks = document.clips.map(clip => {
    if (clip.loop) countLoss(losses, 'clip-loop');
    if (clip.playRange) countLoss(losses, 'clip-play-range');
    const events: OutputEvent[] = [{ tick: 0, priority: -1, bytes: metaEvent(3, Buffer.from(clip.name ?? '', 'utf8')) }];
    const clipEndTick = tick(clip.length);
    let endTick = clipEndTick;
    for (const note of document.events.filter(n => n.clip === clip.id)) {
      for (const field of ['articulation', 'expression', 'chance', 'occurrence', 'recurrence', 'repeat'] as const) {
        if (note[field] !== undefined && !same(note[field], EVENT_DEFAULTS[field])) countLoss(losses, `note-${field}`);
      }
      if (note.mute || note.velocity === 0) { countLoss(losses, note.mute ? 'muted-notes-omitted' : 'zero-velocity-notes-omitted'); continue; }
      const ch = (note.channel ?? 1) - 1, start = tick(note.at), end = tick(sum(note.at, note.duration));
      const release = (note.releaseVelocity ?? EVENT_DEFAULTS.releaseVelocity) * 127, velocity = Math.round(release);
      if (Math.abs(velocity - release) > 1e-12) countLoss(rounding, 'release-velocity-rounded');
      events.push({ tick: start, priority: 3, order: noteCount, bytes: Buffer.from([0x90 | ch, note.pitch, note.velocity]) },
        { tick: end, priority: 2, order: noteCount, bytes: Buffer.from([0x80 | ch, note.pitch, velocity]) });
      endTick = Math.max(endTick, end); noteCount++;
      const key = `${ch}:${note.pitch}`, addresses = activeAddresses.get(key) ?? [];
      addresses.push({ at: note.at, end: sum(note.at, note.duration), id: note.id, clip: clip.id }); activeAddresses.set(key, addresses);
    }
    if (endTick > clipEndTick) countLoss(losses, 'clip-length-extended-for-note-tail');
    lastTick = Math.max(lastTick, endTick);
    events.push({ tick: endTick, priority: 9, bytes: metaEvent(0x2f, Buffer.alloc(0)) }); return events;
  });
  for (const addresses of activeAddresses.values()) {
    addresses.sort((a, b) => cmp(a.at, b.at));
    for (let i = 1; i < addresses.length; i++) {
      const previous = addresses[i - 1]!, next = addresses[i]!;
      if (cmp(next.at, previous.end) < 0) requireMidi(next.clip === previous.clip && cmp(next.end, previous.end) >= 0,
        `Same-pitch notes have nested ends or overlap across tracks (${previous.id}, ${next.id}); MIDI FIFO pairing cannot preserve them.`, 'unsupported');
    }
  }
  if (document.meta) countLoss(losses, 'document-meta');
  if (document.extensions && Object.keys(document.extensions).length) countLoss(losses, 'document-extensions');
  const loss = lossesOf(losses);
  if (loss.length && !options.acceptLoss) throw new MidiError('unsupported', 'MIDI cannot preserve all document data. Review losses and set acceptLoss: true to export realized notes.', { losses: loss });
  conductor.push({ tick: Math.max(lastTick, ...conductor.map(e => e.tick)), priority: 9, bytes: metaEvent(0x2f, Buffer.alloc(0)) });
  return { bytes: writeSmf([conductor, ...tracks]), report: { version: MIDI_CONVERSION_VERSION, format: 1, ppq: 512,
    clips: document.clips.length, notes: noteCount, notePairing: 'fifo-per-track-channel-pitch', losses: loss, rounding: lossesOf(rounding),
    defaultTempoApplied: options.bpm === undefined && !document.overlays.some(o => o.type === 'tempo' && o.state === 'current' && o.data.at === '0') } };
}
