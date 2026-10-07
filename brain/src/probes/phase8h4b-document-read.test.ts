import assert from 'node:assert/strict';
import test from 'node:test';

import type { RawNoteFields } from '../adapters/live/clip-read.js';
import { projectLauncherClip, launcherClipCells } from '../bindings/launcher-clip-document.js';
import { notesByChannel } from '../adapters/live/clip-read.js';
import { serialize } from '../document/index.js';
import { agreement, idsByKey, rawDiff } from './phase8h4b-document-read-lib.js';

const row = (over: Partial<Record<string, number | boolean | string>> = {}): RawNoteFields => ({
  channel: 0, cell: 0, pitch: 36, velocity: 100 / 127, duration: 0.125, releaseVelocity: 0.5, velocitySpread: 0,
  gain: 0, pan: 0, pressure: 0, timbre: 0, transpose: 0, chance: 1, occurrence: 'ALWAYS', recurrenceLength: 1,
  recurrenceMask: 1, repeatCount: 0, repeatCurve: 0, repeatVelocityCurve: 0, repeatVelocityEnd: 0,
  isChanceEnabled: false, isMuted: false, isOccurrenceEnabled: false, isRecurrenceEnabled: false, isRepeatEnabled: false,
  ...over,
} as RawNoteFields);

function fieldsOf(rows: RawNoteFields[]): string {
  const channels = notesByChannel(rows);
  const snapshot = { ref: {} as never, metadata: { name: '', color: {} as never, lengthBeats: 4, playStartBeats: 0,
    loopEnabled: true, loopStartBeats: 0, loopEndBeats: 4 }, channels: Array.from({ length: 16 }, (_, c) => channels.get(c) ?? []) };
  const cells = launcherClipCells(snapshot);
  return serialize(projectLauncherClip(snapshot, 'c1', cells.map((_, i) => `e${i + 1}`)).document, 'fields');
}

test('8h4b driver lib: the reader projection agrees with its raw rows; a changed raw field disagrees', () => {
  const rows = [row(), row({ channel: 8, cell: 1024, pitch: 44, gain: 1.2, timbre: -1, isMuted: true, chance: 0.3 })];
  const fields = fieldsOf(rows);
  assert.deepEqual(agreement(fields, rows), []);
  assert.deepEqual([...idsByKey(fields).keys()], ['0:36:0', '8:44:1024']);
  const edited = [row({ velocity: 50 / 127 }), rows[1]!];
  assert.equal(agreement(fields, edited).length, 1);
  assert.deepEqual(rawDiff(rows, edited), { removed: [], added: [], changed: [{ key: '0:36:0', fields: ['velocity'] }] });
  const moved = [rows[0]!, { ...rows[1]!, pitch: 45 }];
  assert.deepEqual(rawDiff(rows, moved), { removed: ['8:44:1024'], added: ['8:45:1024'], changed: [] });
});
