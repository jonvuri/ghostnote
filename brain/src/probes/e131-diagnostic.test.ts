import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clip, slot, scene, track, type NoteRecord } from '../contract/index.js';
import { reconcileExactNoteScans } from './e131-diagnostic.js';
const CLIP = (row: number) => clip(slot(track('e4a1c0de-0000-4000-8000-000000000001'), scene(row, 1)));

test('E131: exact reconciliation retains a same-pitch note omitted by one grid', () => {
  const first: NoteRecord = {
    startBeats: 0, pitch: 60, velocity: 0.75, durationBeats: 1 / 8,
  };
  const second: NoteRecord = {
    startBeats: 1 / 8, pitch: 60, velocity: 0.8, durationBeats: 1 / 8,
  };
  assert.deepEqual(reconcileExactNoteScans(CLIP(0), 0, [first, second], [first]), [first, second]);
});

test('E131: exact reconciliation refuses incompatible nearby grid identities', () => {
  const binary: NoteRecord = {
    startBeats: 1 / 8, pitch: 60, velocity: 0.75, durationBeats: 1 / 8,
  };
  const triplet: NoteRecord = { ...binary, startBeats: 1 / 8 + 1 / 768, velocity: 0.5 };
  assert.throws(() => reconcileExactNoteScans(CLIP(0), 0, [binary], [triplet]),
    /binary and triplet scans disagree.*note identity/);
});
