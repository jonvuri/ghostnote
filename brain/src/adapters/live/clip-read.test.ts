import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { REPO_ROOT } from '../../tools/wire-golden.js';
import { decodeNoteFrame, notesByChannel, readerNote, type NoteFrame } from './clip-read.js';

const golden = JSON.parse(readFileSync(join(REPO_ROOT, 'extension', 'clip-read.frame.golden.json'), 'utf8')) as NoteFrame;

test('the Java notes-v1 golden decodes to the declared raw fields', () => {
  const rows = decodeNoteFrame(golden, golden.size);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((row) => [row['channel'], row['cell'], row['pitch']]), [
    [0, 0, 60], [3, 512, 62], [15, 4_194_303, 127],
  ]);
  const disabled = rows[1]!;
  assert.equal(disabled['velocity'], 64 / 127);
  assert.equal(disabled['occurrence'], 'PREV');
  assert.equal(disabled['recurrenceLength'], 8);
  assert.equal(disabled['recurrenceMask'], 85);
  assert.equal(disabled['repeatCount'], -2);
  assert.equal(disabled['isChanceEnabled'], false);
  assert.equal(disabled['isMuted'], true);
  assert.equal(disabled['transpose'], 2);
  assert.equal(rows[2]!['duration'], 1 / 512);
  assert.equal(rows[2]!['transpose'], -12);
});

test('reader notes keep disabled controls, raw recurrence, and release velocity (D31)', () => {
  const channels = notesByChannel(decodeNoteFrame(golden, golden.size));
  assert.deepEqual(channels.get(0), [{
    startBeats: 0, pitch: 60, velocity: 100, durationBeats: 1, releaseVelocity: 0,
    isChanceEnabled: true, isOccurrenceEnabled: true, isRecurrenceEnabled: true, isRepeatEnabled: true,
    recurrence: [1, 1],
  }]);
  assert.deepEqual(channels.get(3), [{
    startBeats: 1, pitch: 62, velocity: 64, durationBeats: 0.75, releaseVelocity: 0.5,
    velocitySpread: 0.25, gain: 0.5, pan: -0.25, timbre: 0.125, transpose: 2, chance: 0.3,
    occurrence: 'PREV', repeatCount: -2, repeatCurve: 0.5, repeatVelocityCurve: -0.5, repeatVelocityEnd: 0.75,
    isChanceEnabled: false, isOccurrenceEnabled: false, isRecurrenceEnabled: false, isRepeatEnabled: false,
    isMuted: true, recurrence: [8, 85],
  }]);
  const last = channels.get(15)![0]!;
  assert.equal(last.startBeats, 4_194_303 / 512);
  assert.equal(last.pressure, 0.5);
  assert.equal(channels.get(1)!.length, 0);
});

test('a disabled recurrence with the default raw value adds no recurrence', () => {
  const rows = decodeNoteFrame(golden, golden.size);
  const note = readerNote({ ...rows[0]!, isRecurrenceEnabled: false });
  assert.equal(note.recurrence, undefined);
  assert.equal(note.isRecurrenceEnabled, false);
});

test('a malformed frame refuses', () => {
  assert.throws(() => decodeNoteFrame({ ...golden, format: 'rows' }, golden.size), /unknown format/);
  assert.throws(() => decodeNoteFrame({ ...golden, data: golden.data.slice(0, 8) }, golden.size), /truncated/);
  assert.throws(() => decodeNoteFrame({ ...golden, columns: golden.columns.slice(1) }, golden.size), /missing column channel/);
  const extra = Buffer.concat([Buffer.from(golden.data, 'base64'), Buffer.from([0])]).toString('base64');
  assert.throws(() => decodeNoteFrame({ ...golden, data: extra }, golden.size), /trailing/);
  assert.throws(() => decodeNoteFrame(golden, golden.size - 1), /invalid size/);
});
