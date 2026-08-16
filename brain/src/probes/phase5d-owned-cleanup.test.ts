import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { NoteRecord } from '../contract/index.js';
import {
  ownClip, removeOwnedClip, type CleanupCell, type OwnedClipCleanupPort,
} from './phase5d-owned-cleanup.js';

const TARGET: CleanupCell = { trackId: 'target', trackIndex: 1, row: 9 };
const SOURCE: CleanupCell = { trackId: 'source', trackIndex: 2, row: 9 };
const DESTINATION: CleanupCell = { trackId: 'destination', trackIndex: 3, row: 9 };
const TARGET_NOTES: readonly NoteRecord[] = [
  { startBeats: 0, pitch: 36, velocity: 72, durationBeats: 0.25 },
];
const DRAG_NOTES: readonly NoteRecord[] = [
  { startBeats: 3.5, pitch: 108, velocity: 64, durationBeats: 0.25 },
];

const key = (cell: CleanupCell): string => `${cell.trackId}:${cell.row}`;

test('5d cursor repair: early setup failure can remove both registered owned clips', async () => {
  const clips = new Map<string, readonly NoteRecord[]>([
    [key(TARGET), TARGET_NOTES],
    [key(SOURCE), DRAG_NOTES],
  ]);
  const target = ownClip(TARGET, TARGET_NOTES);
  const drag = ownClip(SOURCE, DRAG_NOTES, DESTINATION);
  const port: OwnedClipCleanupPort = {
    async hasContent(cell) {
      return clips.has(key(cell));
    },
    async readNotes(cell) {
      const notes = clips.get(key(cell));
      if (notes === undefined) throw new Error('clip is absent');
      return notes;
    },
    async move(source, destination) {
      const notes = clips.get(key(source));
      if (notes === undefined) throw new Error('move source is absent');
      clips.delete(key(source));
      clips.set(key(destination), notes);
    },
    async remove(cell) {
      clips.delete(key(cell));
    },
  };

  await assert.rejects(async () => {
    throw new Error('complete grid capture failed');
  }, /grid capture failed/);

  await removeOwnedClip(drag, port);
  await removeOwnedClip(target, port);

  assert.deepEqual([...clips], []);
  assert.deepEqual(target.fingerprint, TARGET_NOTES);
  assert.deepEqual(drag.fingerprint, DRAG_NOTES);
});
