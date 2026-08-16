import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { NoteRecord } from '../contract/index.js';
import {
  ownClip, promoteOwnedClip, removeOwnedClip, type CleanupCell, type OwnedClipCleanupPort,
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
const ENRICHED_TARGET: readonly NoteRecord[] = [{
  ...TARGET_NOTES[0]!,
  releaseVelocity: 100 / 127,
  isChanceEnabled: true,
  isOccurrenceEnabled: true,
  isRecurrenceEnabled: true,
  recurrence: [1, 1],
  isRepeatEnabled: true,
}];
const ENRICHED_DRAG: readonly NoteRecord[] = [{
  ...DRAG_NOTES[0]!,
  releaseVelocity: 100 / 127,
  isChanceEnabled: true,
  isOccurrenceEnabled: true,
  isRecurrenceEnabled: true,
  recurrence: [1, 1],
  isRepeatEnabled: true,
}];

const key = (cell: CleanupCell): string => `${cell.trackId}:${cell.row}`;

function cleanupHarness(initial: ReadonlyMap<string, readonly NoteRecord[]>): {
  readonly clips: Map<string, readonly NoteRecord[]>;
  readonly port: OwnedClipCleanupPort;
} {
  const clips = new Map(initial);
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
  return { clips, port };
}

test('5d cleanup repair: enriched readback permits cleanup before promotion', async () => {
  const { clips, port } = cleanupHarness(new Map([
    [key(TARGET), ENRICHED_TARGET],
    [key(SOURCE), ENRICHED_DRAG],
  ]));
  const target = ownClip(TARGET, TARGET_NOTES);
  const drag = ownClip(SOURCE, DRAG_NOTES, DESTINATION);

  await assert.rejects(async () => {
    throw new Error('complete grid capture failed');
  }, /grid capture failed/);

  await removeOwnedClip(drag, port);
  await removeOwnedClip(target, port);

  assert.deepEqual([...clips], []);
  assert.deepEqual(target.creationFingerprint, TARGET_NOTES);
  assert.deepEqual(drag.creationFingerprint, DRAG_NOTES);
  assert.equal(target.exactFingerprint, undefined);
  assert.equal(drag.exactFingerprint, undefined);
});

test('5d cleanup repair: early cleanup refuses changed authored fields', async () => {
  const changed = [{ ...ENRICHED_TARGET[0]!, velocity: 73 }];
  const { clips, port } = cleanupHarness(new Map([[key(TARGET), changed]]));

  await assert.rejects(removeOwnedClip(ownClip(TARGET, TARGET_NOTES), port),
    /fingerprint changed/);
  assert.equal(clips.has(key(TARGET)), true);
});

test('5d cleanup repair: early cleanup refuses an added note', async () => {
  const added = [...ENRICHED_TARGET, {
    startBeats: 1, pitch: 48, velocity: 80, durationBeats: 0.25,
  }];
  const { clips, port } = cleanupHarness(new Map([[key(TARGET), added]]));

  await assert.rejects(removeOwnedClip(ownClip(TARGET, TARGET_NOTES), port),
    /fingerprint changed/);
  assert.equal(clips.has(key(TARGET)), true);
});

test('5d cleanup repair: independent readback promotes the exact fingerprint', () => {
  const owned = ownClip(TARGET, TARGET_NOTES);
  const promoted = promoteOwnedClip(owned, ENRICHED_TARGET);

  assert.deepEqual(promoted.creationFingerprint, TARGET_NOTES);
  assert.deepEqual(promoted.exactFingerprint, ENRICHED_TARGET);
  assert.equal(owned.exactFingerprint, undefined);
  assert.notEqual(promoted, owned);
});

test('5d cleanup repair: promotion refuses a changed authored field', () => {
  assert.throws(() => promoteOwnedClip(ownClip(TARGET, TARGET_NOTES), [{
    ...ENRICHED_TARGET[0]!, durationBeats: 0.5,
  }]), /creation fingerprint/);
});

test('5d cleanup repair: post-promotion drift blocks cleanup', async () => {
  const promoted = promoteOwnedClip(ownClip(TARGET, TARGET_NOTES), ENRICHED_TARGET);
  const drifted = [{ ...ENRICHED_TARGET[0]!, releaseVelocity: 0.5 }];
  const { clips, port } = cleanupHarness(new Map([[key(TARGET), drifted]]));

  await assert.rejects(removeOwnedClip(promoted, port), /fingerprint changed/);
  assert.equal(clips.has(key(TARGET)), true);
});
