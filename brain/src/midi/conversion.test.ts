import assert from 'node:assert/strict';
import test from 'node:test';
import { serialize, parse, sealOverlays, BINDING, type StateDocument } from '../document/index.js';
import { importMidi, exportMidi } from './conversion.js';
import { parseSmf, MidiError, MIDI_LIMITS, vlq } from './smf.js';
import { EOT, SIMPLE_MIDI, smfFixture, midiDocument } from './fixtures.js';

const refuses = (fn: () => unknown, code: string) => assert.throws(fn, (e: unknown) => e instanceof MidiError && e.code === code);
const plain = (value: unknown) => JSON.parse(JSON.stringify(value));
const noteValues = (d: StateDocument) => d.events.map(({ id, clip, ...note }) => note);

function midiSnapshot(count = 1): StateDocument {
  const doc = midiDocument(count);
  doc.kind = 'snapshot';
  doc.coverage[0]!.fields = [...BINDING, 'releaseVelocity'];
  return doc;
}

test('snapshot export uses covered MIDI fields without changing kind or coverage', () => {
  const doc = midiSnapshot(3), original = plain(doc);
  doc.events[0]!.releaseVelocity = 0;
  original.events[0].releaseVelocity = 0;
  const desired = midiDocument(3); desired.events[0]!.releaseVelocity = 0;
  assert.deepEqual(exportMidi(doc).bytes, exportMidi(desired).bytes);
  assert.deepEqual(doc, original);
  assert.equal(exportMidi(midiSnapshot(0)).report.notes, 0);
});

test('snapshot export refuses missing fields, channels, spans, or complete status even with accepted loss', () => {
  const missing = midiSnapshot(); missing.coverage[0]!.fields = [...BINDING];
  assert.throws(() => exportMidi(missing, { acceptLoss: true }), (e: unknown) => {
    assert.ok(e instanceof MidiError);
    assert.equal(e.code, 'invalid-input');
    assert.deepEqual(e.detail, { clip: 'c1', missingFields: ['releaseVelocity'] });
    return true;
  });
  for (const edit of [
    (d: StateDocument) => { d.coverage[0]!.channels = [1]; },
    (d: StateDocument) => { d.coverage[0]!.from = '1'; },
    (d: StateDocument) => { d.coverage[0]!.to = '3'; },
    (d: StateDocument) => { d.coverage[0]!.status = 'partial'; d.coverage[0]!.reason = 'test'; },
    (d: StateDocument) => { d.coverage[0]!.status = 'unavailable'; d.coverage[0]!.reason = 'test'; },
  ]) {
    const doc = midiSnapshot(0); edit(doc);
    refuses(() => exportMidi(doc, { acceptLoss: true }), 'invalid-input');
  }
  const multi = midiSnapshot(0);
  multi.clips.push({ id: 'c2', length: '4' });
  multi.coverage.push({ ...multi.coverage[0]!, clip: 'c2', fields: [...BINDING] });
  refuses(() => exportMidi(multi, { acceptLoss: true }), 'invalid-input');
});

test('snapshot export keeps the loss checks for loops and observed nondefault fields', () => {
  const doc = midiSnapshot();
  doc.clips[0]!.loop = { from: '0', to: '4' };
  doc.coverage[0]!.fields = [...BINDING, 'releaseVelocity', 'chance'];
  doc.events[0]!.chance = { enabled: true, value: 0.5 };
  refuses(() => exportMidi(doc), 'unsupported');
  assert.deepEqual(exportMidi(doc, { acceptLoss: true }).report.losses,
    [{ code: 'clip-loop', count: 1 }, { code: 'note-chance', count: 1 }]);
});

test('source beats and 60-to-120 elapsed-time conversion use distinct coordinates', () => {
  const source = importMidi(SIMPLE_MIDI), converted = importMidi(SIMPLE_MIDI, { targetBpm: 120 });
  assert.equal(source.document.events[0]!.duration, '1');
  assert.equal(converted.document.events[0]!.duration, '2');
  assert.equal(converted.document.clips[0]!.length, '2');
  assert.equal(converted.report.timing, 'elapsed-time-at-target-bpm');
  assert.deepEqual(plain(converted.document.overlays[0]!.data), { clip: 'c1', at: '0', bpm: 120 });
  assert.equal(converted.document.events[0]!.releaseVelocity, 0);
  assert.deepEqual(importMidi(SIMPLE_MIDI, { targetBpm: 120 }), converted);
});

test('a held note crosses a tempo change: integrate onset and end separately', () => {
  const bytes = smfFixture([[0, 255, 81, 3, 15, 66, 64, 0x83, 0x74, 0x90, 60, 90,
    0x83, 0x74, 255, 81, 3, 7, 161, 32, 0x87, 0x68, 0x80, 60, 40, ...EOT]]);
  const imported = importMidi(bytes, { targetBpm: 120 });
  assert.equal(imported.document.events[0]!.at, '1');
  assert.equal(imported.document.events[0]!.duration, '2');
  assert.equal(imported.document.clips[0]!.length, '3');
  assert.equal(imported.report.sourceTempoMap.length, 2);
  const preserved = importMidi(bytes);
  assert.deepEqual(plain(preserved.document.overlays.map(o => o.data)), [{ clip: 'c1', at: '0', bpm: 60 }, { clip: 'c1', at: '1', bpm: 120 }]);
});

test('running status, velocity-zero off, channel 16, and leading silence', () => {
  const d = importMidi(smfFixture([[10, 0x9f, 60, 100, 10, 60, 0, ...EOT]], 512));
  assert.deepEqual(plain(d.document.events[0]), { id: 'c1n1', clip: 'c1', at: '5/256', duration: '5/256', pitch: 60, velocity: 100, channel: 16, releaseVelocity: 64 / 127 });
  assert.equal(d.report.defaultTempoApplied, true);
});

test('exact flooring, ties-up duration, minimum duration, and normalization collisions', () => {
  const d = importMidi(smfFixture([[1, 0x90, 60, 100, 3, 0x80, 60, 100, 0, 0x90, 61, 100, 1, 0x80, 61, 100, ...EOT]], 1024));
  assert.equal(d.document.events[0]!.at, '0');
  assert.equal(d.document.events[0]!.duration, '1/256');
  assert.equal(d.document.events[1]!.duration, '1/512');
  const tiny = importMidi(smfFixture([[0, 0x90, 60, 100, 1, 0x80, 60, 100, ...EOT]], 4096));
  assert.equal(tiny.report.minimumDurationPromotions, 1);
  refuses(() => importMidi(smfFixture([[0, 0x90, 60, 100, 1, 0x80, 60, 100,
    0, 0x90, 60, 100, 1, 0x80, 60, 100, ...EOT]], 4096)), 'collision');
});

test('track names, musical tracks, meter, and source losses are explicit', () => {
  const d = importMidi(smfFixture([
    [0, 255, 88, 4, 3, 2, 36, 8, ...EOT],
    [0, 255, 3, 4, 66, 97, 115, 115, 0, 0xc0, 33, 0, 0xb0, 64, 127,
      0, 0xe0, 0, 64, 0, 0x90, 36, 100, 10, 0x80, 36, 100, ...EOT],
    [0, 0x99, 36, 100, 10, 0x89, 36, 100, ...EOT],
  ], 512));
  assert.deepEqual(d.document.clips.map(c => c.id), ['c2', 'c3']);
  assert.equal(d.document.clips[0]!.name, 'Bass');
  assert.equal(d.document.events[1]!.channel, 10);
  assert.equal(d.document.overlays.filter(o => o.type === 'meter').length, 2);
  assert.deepEqual(d.report.ignored.map(l => l.code), ['control-change', 'meter-click-fields', 'pitch-bend', 'program-change']);
});

test('empty MIDI produces a complete empty clip', () => {
  const { document } = importMidi(smfFixture([[...EOT]]));
  assert.equal(document.events.length, 0);
  assert.equal(document.clips[0]!.length, '0');
  const again = importMidi(exportMidi(document).bytes);
  assert.equal(again.document.events.length, 0);
});

test('malformed framing, running status, lengths, end events, and statuses refuse', () => {
  for (const bytes of [Buffer.alloc(0), SIMPLE_MIDI.subarray(0, -1), Buffer.concat([SIMPLE_MIDI, Buffer.from([0])]),
    smfFixture([[0, 60, 100, ...EOT]]), smfFixture([[0, 0xf1, 0, ...EOT]]),
    smfFixture([[0, 255, 81, 2, 0, 1, ...EOT]]), smfFixture([[...EOT, 0]]),
    smfFixture([[0, 0x90, 60, 128, ...EOT]]), smfFixture([[0, 0x90, 60, 100]]),
    smfFixture([[128, 128, 128, 128, 0, ...EOT]]),
    smfFixture([[0, 0xc0, 1, 0, 255, 1, 0, 0, 2, ...EOT]])]) {
    refuses(() => importMidi(bytes), 'invalid-input');
  }
});

test('unsupported file modes, invalid note pairs, and conflicting metadata refuse', () => {
  refuses(() => importMidi(smfFixture([[...EOT]], 512, 2)), 'unsupported');
  refuses(() => importMidi(smfFixture([[...EOT]], 0xe728)), 'unsupported');
  refuses(() => importMidi(smfFixture([[0, 0x90, 60, 100, 0, 0x90, 60, 100, ...EOT]])), 'invalid-input');
  refuses(() => importMidi(smfFixture([[0, 0x90, 60, 100, ...EOT]])), 'invalid-input');
  refuses(() => importMidi(smfFixture([[0, 0x80, 60, 100, ...EOT]])), 'invalid-input');
  refuses(() => importMidi(smfFixture([[0, 0x90, 60, 100, 0, 0x80, 60, 100, ...EOT]])), 'invalid-input');
  refuses(() => importMidi(smfFixture([[0, 255, 81, 3, 0, 0, 0, ...EOT]])), 'invalid-input');
  refuses(() => importMidi(smfFixture([[0, 255, 81, 3, 15, 66, 64, 0, 255, 81, 3, 7, 161, 32, ...EOT]])), 'unsupported');
  refuses(() => importMidi(SIMPLE_MIDI, { targetBpm: 0 }), 'invalid-input');
});

test('export note values round-trip, including adjacent equal pitches and all channels', () => {
  const d = midiDocument(16);
  d.events.forEach((n, i) => { n.channel = i + 1; n.releaseVelocity = i / 127; n.duration = '1'; n.pitch = 60; });
  const out = exportMidi(d), again = importMidi(out.bytes);
  assert.deepEqual(noteValues(again.document), noteValues(parse(serialize(d, 'fields'), 'fields') as StateDocument));
  assert.deepEqual(exportMidi(d).bytes, out.bytes);
  assert.equal(parseSmf(out.bytes).ppq, 512);
  assert.equal(out.report.losses.length, 0);
});

test('unsupported values require acceptance and are enumerated', () => {
  const d = midiDocument(3);
  d.clips[0]!.loop = { from: '0', to: '4' };
  d.events[0]!.mute = true; d.events[1]!.velocity = 0;
  d.events[2]!.expression = { ...EVENT_EXPRESSION, pressure: 0.5 };
  refuses(() => exportMidi(d), 'unsupported');
  const out = exportMidi(d, { acceptLoss: true });
  assert.equal(out.report.notes, 1);
  assert.deepEqual(out.report.losses.map(l => l.code), ['clip-loop', 'muted-notes-omitted', 'note-expression', 'zero-velocity-notes-omitted']);
});
const EVENT_EXPRESSION = { velocitySpread: 0, gain: 1, pan: 0, pressure: 0, timbre: 0.5, transpose: 0 };

test('export refuses partial input and same-pitch overlaps; reports tail and rounding', () => {
  const d = midiDocument(2);
  d.events[0]!.pitch = 60; d.events[0]!.duration = '3'; d.events[1]!.pitch = 60;
  refuses(() => exportMidi(d), 'unsupported');
  d.events[1]!.pitch = 61; d.events[0]!.duration = '5';
  refuses(() => exportMidi(d), 'unsupported');
  assert.equal(exportMidi(d, { acceptLoss: true }).report.losses[0]!.code, 'clip-length-extended-for-note-tail');
  d.events[0]!.duration = '1/2'; d.events[0]!.releaseVelocity = 0.5;
  assert.equal(exportMidi(d).report.rounding[0]!.code, 'release-velocity-rounded');
  d.kind = 'snapshot'; d.coverage[0]!.status = 'partial'; d.coverage[0]!.reason = 'test';
  assert.throws(() => exportMidi(d));
});

test('source tempo and meter survive export; explicit tempo override is a stated loss', () => {
  const doc = importMidi(SIMPLE_MIDI).document;
  const out = exportMidi(doc);
  assert.equal(importMidi(out.bytes).document.overlays.find(o => o.type === 'tempo')!.data.bpm, 60);
  refuses(() => exportMidi(doc, { bpm: 120 }), 'unsupported');
  const override = exportMidi(doc, { bpm: 120, acceptLoss: true });
  const read = importMidi(override.bytes);
  assert.equal(read.document.events[0]!.duration, '1');
  assert.equal(read.document.overlays.find(o => o.type === 'tempo')!.data.bpm, 120);
});

test('resource limits refuse whole inputs; VLQ boundary is exact', () => {
  refuses(() => parseSmf(Buffer.alloc(MIDI_LIMITS.bytes + 1)), 'outside-limit');
  assert.deepEqual([...vlq(0x0fffffff)], [255, 255, 255, 127]);
  refuses(() => vlq(0x10000000), 'outside-limit');
  refuses(() => exportMidi(midiDocument(MIDI_LIMITS.notes + 1)), 'outside-limit');
});

test('FIFO pairing preserves crossing overlaps and equal ends with distinct release velocities', () => {
  const d = midiDocument(3);
  d.events.forEach((n, i) => { n.pitch = 60; n.duration = String(4 - i); n.releaseVelocity = (100 - i * 30) / 127; });
  const out = exportMidi(d);
  const again = importMidi(out.bytes);
  assert.equal(again.report.overlappingNoteOns, 2);
  assert.equal(again.report.notePairing, 'fifo-per-track-channel-pitch');
  assert.deepEqual(noteValues(again.document), noteValues(parse(serialize(d, 'fields'), 'fields') as StateDocument));
});

test('a tempo map on one track cannot silently change a different clip map', () => {
  const source = smfFixture([
    [0, 255, 81, 3, 7, 161, 32, ...EOT],
    [0, 0x90, 60, 100, 0x90, 0, 0x80, 60, 100, ...EOT],
    [0, 0x91, 64, 100, 0x90, 0, 0x81, 64, 100, ...EOT],
  ], 512);
  const doc = importMidi(source).document;
  const tempo = doc.overlays.find(o => o.type === 'tempo')!;
  if (tempo.type !== 'tempo') throw new Error('fixture');
  doc.overlays.push({ ...tempo, id: 'changedTempo', depends: { ...tempo.depends, clips: [{ id: 'c3', fields: ['length'] }] }, data: { clip: 'c3', at: '1', bpm: 60 } });
  const sealed = sealOverlays(doc);
  refuses(() => exportMidi(sealed), 'unsupported');
});

test('import event and note limits are enforced before document materialization', () => {
  const events = Array.from({ length: MIDI_LIMITS.notes + 1 }, () => [0, 0x90, 60, 100, 1, 0x80, 60, 100]).flat();
  refuses(() => importMidi(smfFixture([[...events, ...EOT]], 512)), 'outside-limit');
  const many = Buffer.concat([Buffer.from([0, 0xc0, 1]), Buffer.alloc((MIDI_LIMITS.events + 1) * 2), Buffer.from(EOT)]);
  const file = smfFixture([[]]);
  const head = Buffer.from(file.subarray(0, 22)); head.writeUInt32BE(many.length, 18);
  refuses(() => importMidi(Buffer.concat([head, many])), 'outside-limit');
});
