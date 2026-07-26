/**
 * `revertOps` — pure, which is the whole reason the hardest logic in the phase
 * is testable as a function of two values.
 *
 * PHASE-1-SESSION-1 §Risks: "revert looks trivial and is not. 'Apply the stash'
 * hides note removal, the gain trap, the pressure trap, and structural ops with
 * no inverse." One test per hidden thing:
 *
 *   R-clear     a revert CLEARS before it writes, or it merges instead
 *   R-empty     "there were no notes" is itself a state, restored by a clear
 *   R-gain      gain is withheld and REPORTED — replaying it would double again
 *   R-pressure  pressure is stripped, and the plan survives assertOpsWritable
 *   R-clip      absence is un-created; an existing clip is reported
 *   R-none      structural targets report rather than throw
 *   R-order     un-creates run last, so nothing writes through a dead cursor
 *   R-stages    the plan survives planStages with props still interleaved
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CONTRACT_TAG, addressKey, assertOpsWritable, clip, notes as notesAt, planStages, scene, slot,
  track, type NoteRecord, type Snapshot, type StateEntry,
} from '../contract/index.js';
import { revertOps } from './revert.js';
import { writeSetOf } from './write-set.js';

const TA = track('b07f6b06-8f4f-4f4f-802d-ddf1a5190515');
const TB = track('c07f6b06-8f4f-4f4f-802d-ddf1a5190515');
const SLOT_A = slot(TA, scene(0, 1));
const SLOT_B = slot(TB, scene(0, 1));
const CLIP_A = clip(SLOT_A);
const CLIP_B = clip(SLOT_B);

const note = (over: Partial<NoteRecord> = {}): NoteRecord => ({
  startBeats: 0, pitch: 60, velocity: 100, durationBeats: 1, ...over,
});

/** A stash built by hand — the only way to model state a human authored. */
function stashOf(entries: readonly StateEntry[], unreachable: Snapshot['unreachable'] = []): Snapshot {
  return {
    contract: CONTRACT_TAG,
    at: { revision: 7, sceneEpoch: 1 },
    entries: Object.fromEntries(entries.map((e) => [addressKey(e.address), e])),
    missing: [],
    unreachable,
  };
}

const notesEntry = (address: ReturnType<typeof notesAt>, list: readonly NoteRecord[], fidelity: StateEntry['fidelity'] = 'exact'): StateEntry =>
  ({ address, fidelity, value: { of: 'notes', notes: list } });

test('R-clear: a revert CLEARS before it writes — otherwise it merges into the batch output', () => {
  const address = notesAt(CLIP_A);
  const plan = revertOps({
    ...writeSetOf([{ op: 'note.write', clip: CLIP_A, notes: [note()] }]),
    stash: stashOf([notesEntry(address, [note({ pitch: 62 })])]),
  });
  assert.deepEqual(plan.ops.map((o) => o.op), ['note.clear', 'note.write']);
  assert.equal(plan.unrestored.length, 0);
});

test('R-empty: "there were no notes here" is a state, and only a clear can express it', () => {
  const address = notesAt(CLIP_A);
  const plan = revertOps({
    ...writeSetOf([{ op: 'note.write', clip: CLIP_A, notes: [note()] }]),
    stash: stashOf([notesEntry(address, [])]),
  });
  // A plan that only ever writes could never restore an empty clip.
  assert.deepEqual(plan.ops.map((o) => o.op), ['note.clear']);
});

test('R-gain: gain is WITHHELD and reported, never replayed (E2, D8)', () => {
  const address = notesAt(CLIP_A);
  // The stash holds what readback REPORTED — 1.4 for a note written at 0.7.
  const plan = revertOps({
    ...writeSetOf([{ op: 'note.write', clip: CLIP_A, notes: [note()] }]),
    stash: stashOf([notesEntry(address, [note({ gain: 1.4, pan: 0.25 })], 'lossy')]),
  });

  const write = plan.ops.find((o) => o.op === 'note.write');
  assert.ok(write?.op === 'note.write');
  // Replaying 1.4 would write 1.4 and read back 2.8 — and compound on every
  // subsequent revert. The inverse is unverified, so neither replaying nor
  // correcting is defensible; withholding is bounded and visible.
  assert.equal(write.notes[0]?.gain, undefined);
  assert.equal(write.notes[0]?.pan, 0.25, 'the exact properties around it are untouched');

  const said = plan.unrestored.find((u) => u.what === 'gain');
  assert.ok(said, 'D5: a revert never silently under-delivers');
  assert.match(said.why, /UNVERIFIED/);
});

test('R-pressure: a human-authored pressure is stripped, and the plan is emittable (E15-E)', () => {
  const address = notesAt(CLIP_A);
  const plan = revertOps({
    ...writeSetOf([{ op: 'note.write', clip: CLIP_A, notes: [note()] }]),
    stash: stashOf([notesEntry(address, [note({ pressure: 0.9, timbre: 0.3 })], 'lossy')]),
  });

  // ⚠ THE POINT: `assertOpsWritable` REFUSES pressure, so a revert that replayed
  // the stash verbatim would throw — and a revert that fails because of a
  // property the USER authored is a worse failure than one that reports it.
  assert.doesNotThrow(() => assertOpsWritable(plan.ops));
  const write = plan.ops.find((o) => o.op === 'note.write');
  assert.ok(write?.op === 'note.write');
  assert.equal(write.notes[0]?.pressure, undefined);
  assert.equal(write.notes[0]?.timbre, 0.3);
  assert.match(plan.unrestored.find((u) => u.what === 'pressure')?.why ?? '', /cannot be written/);
});

test('R-clip: a slot that was EMPTY is un-created; one that held a clip is reported', () => {
  const empty = revertOps({
    ...writeSetOf([{ op: 'clip.create', slot: SLOT_A, lengthBeats: 4 }]),
    stash: stashOf([{ address: CLIP_A, fidelity: 'none', value: { of: 'clip', exists: false } }]),
  });
  // Absence is the one structural inverse that is not a guess.
  assert.deepEqual(empty.ops.map((o) => o.op), ['clip.delete']);
  assert.deepEqual(empty.unrestored, []);

  const occupied = revertOps({
    ...writeSetOf([{ op: 'clip.create', slot: SLOT_A, lengthBeats: 4 }]),
    stash: stashOf([
      { address: CLIP_A, fidelity: 'none', value: { of: 'clip', exists: true, lengthBeats: 8 } },
      notesEntry(notesAt(CLIP_A), [note()]),
    ]),
  });
  // Nothing to un-create; the notes target restores the content, and the clip's
  // own length is not offered because it has no readback that could reproduce it.
  assert.deepEqual(occupied.ops.map((o) => o.op), ['note.clear', 'note.write']);
});

test('R-none: a structural target REPORTS rather than throwing or being dropped', () => {
  const plan = revertOps({
    ...writeSetOf([
      { op: 'track.delete', track: TA },
      { op: 'track.create', name: 'gn-new' },
    ]),
    stash: stashOf([
      { address: TA, fidelity: 'exact', value: { of: 'track', track: { channelId: TA.channelId, name: 'gn-A', position: 0, type: 'Instrument' } } },
    ]),
  });
  assert.deepEqual(plan.ops, [], 'nothing here has an inverse');
  // D5's rule is a constraint on REPORTING, not a reason to refuse the whole
  // operation — so both are named, loudly.
  assert.deepEqual(plan.unrestored.map((u) => u.what).sort(), ['track', 'track.create']);
});

test('R-none: an address that was outside the bank window is reported, not silently skipped (E5)', () => {
  const address = notesAt(CLIP_A);
  const plan = revertOps({
    ...writeSetOf([{ op: 'note.write', clip: CLIP_A, notes: [note()] }]),
    stash: stashOf([], [address]),
  });
  assert.deepEqual(plan.ops, []);
  assert.match(plan.unrestored[0]?.why ?? '', /invisible, not empty/);
});

test('R-order: un-creates run LAST, so nothing writes through a cursor whose clip just died (E2)', () => {
  const plan = revertOps({
    ...writeSetOf([
      { op: 'clip.create', slot: SLOT_B, lengthBeats: 4 },
      { op: 'note.write', clip: CLIP_A, notes: [note()] },
    ]),
    stash: stashOf([
      { address: CLIP_B, fidelity: 'none', value: { of: 'clip', exists: false } },
      notesEntry(notesAt(CLIP_A), [note({ pitch: 62 })]),
    ]),
  });
  assert.deepEqual(plan.ops.map((o) => o.op), ['note.clear', 'note.write', 'clip.delete']);
});

test('R-stages: the plan survives planStages with every props op still behind ITS create (E15-F)', () => {
  // ⚠ EXIT CRITERION 2. A multi-clip revert carrying expression is the exact
  // shape E15-F kills: `cursor.setNoteProps` resolves its note against the clip
  // the cursor held at TURN START, so a props stage that opens on another clip
  // loses everything it carries, silently and with a clean receipt.
  const plan = revertOps({
    ...writeSetOf([
      { op: 'note.write', clip: CLIP_A, notes: [note()] },
      { op: 'note.write', clip: CLIP_B, notes: [note()] },
    ]),
    stash: stashOf([
      notesEntry(notesAt(CLIP_A), [note({ pitch: 60, pan: -0.25 })]),
      notesEntry(notesAt(CLIP_B), [note({ pitch: 67, pan: 0.5 })]),
    ]),
  });

  const stages = planStages(plan.ops);
  const shape = stages.map((s) => s.ops.map((o) => o.op).join('+'));
  assert.deepEqual(shape, [
    'note.clear+note.write',   // clip A: create
    'note.props',              // clip A: its own properties, same turn-start clip
    'note.clear+note.write',   // clip B
    'note.props',
  ]);
  // And each props stage addresses the clip the stage before it wrote.
  const clipOf = (i: number) => {
    const op = stages[i]!.ops[stages[i]!.ops.length - 1]!;
    return op.op === 'note.props' || op.op === 'note.write' ? addressKey(op.clip) : '';
  };
  assert.equal(clipOf(1), clipOf(0));
  assert.equal(clipOf(3), clipOf(2));
});
