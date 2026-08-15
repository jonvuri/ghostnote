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
 *   R-clip      absence is un-created; a clip that was there is rebuilt and refilled
 *   R-device    an insert is undone at the chain index the receipt MINTED
 *   R-none      structural targets report rather than throw
 *   R-order     re-creates run first and un-creates last, so nothing writes
 *               through a cursor whose clip does not exist (E2, both directions)
 *   R-stages    the plan survives planStages with props still interleaved
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CONTRACT_TAG, addressKey, assertOpsWritable, clip, device, notes as notesAt, planStages, scene,
  slot, track, type NoteRecord, type Op, type Snapshot, type StateEntry,
} from '../contract/index.js';
import { labelTarget } from './fidelity.js';
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
    at: {
      revision: 7, sceneEpoch: 1, contentEpoch: 0, generation: 'test-gen', project: 'test-project',
      window: { tracks: { count: 2, bankSize: 16 }, scenes: { count: 8, bankSize: 16 } },
    },
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

test('R-clip: a slot that was EMPTY is un-created; one that held a clip is REBUILT (D16 rev)', () => {
  const empty = revertOps({
    ...writeSetOf([{ op: 'clip.create', slot: SLOT_A, lengthBeats: 4 }]),
    stash: stashOf([{ address: CLIP_A, fidelity: 'exact', value: { of: 'clip', exists: false } }]),
  });
  // Absence is the one structural inverse that is not a guess.
  assert.deepEqual(empty.ops.map((o) => o.op), ['clip.delete']);
  assert.deepEqual(empty.unrestored, []);

  // ⚠ AMENDED 2026-08-07 (§3.3.3). This used to assert that an occupied slot got
  // its NOTES back and nothing else, "because the clip's own length has no
  // readback that could reproduce it" — which was false about the code as it
  // stood. The captured length is the rebuild instruction, so a create that
  // landed on an occupied slot gives the ORIGINAL 8 beats back rather than
  // keeping the 4 the batch imposed.
  const occupied = revertOps({
    ...writeSetOf([{ op: 'clip.create', slot: SLOT_A, lengthBeats: 4 }]),
    stash: stashOf([
      { address: CLIP_A, fidelity: 'lossy', value: { of: 'clip', exists: true, lengthBeats: 8 } },
      notesEntry(notesAt(CLIP_A), [note()]),
    ]),
  });
  assert.deepEqual(occupied.ops.map((o) => o.op), ['clip.create', 'note.clear', 'note.write']);
  const rebuilt = occupied.ops[0]!;
  assert.equal(rebuilt.op === 'clip.create' ? rebuilt.lengthBeats : 0, 8);
});

test('R-clip: a DELETED clip is recreated and refilled — and the create goes FIRST (E2)', () => {
  // The flagship of the amendment: `clip.delete` used to be `none` on both
  // halves, so this plan was empty and the take reported two things it could not
  // do. Now the clip comes back at its captured length and its notes go into it —
  // in that order, because writing into a slot with no clip lands the cursor on a
  // DIFFERENT clip and reports a healthy status (E2).
  const plan = revertOps({
    ...writeSetOf([{ op: 'clip.delete', slot: SLOT_A }]),
    stash: stashOf([
      { address: CLIP_A, fidelity: 'lossy', value: { of: 'clip', exists: true, lengthBeats: 4 } },
      notesEntry(notesAt(CLIP_A), [note({ pitch: 62 })]),
    ]),
  });
  assert.deepEqual(plan.ops.map((o) => o.op), ['clip.create', 'note.clear', 'note.write']);
  assert.deepEqual(plan.unrestored, [], 'nothing here is withheld — the caveats carry the rest');
  const write = plan.ops[2]!;
  assert.deepEqual(write.op === 'note.write' ? write.notes.map((n) => n.pitch) : [], [62]);
});

test('R-clip: a clip whose LENGTH was never captured is reported, not rebuilt at a guess', () => {
  // ⚠ The live adapter omits `lengthBeats` rather than defaulting it when
  // `loopLength` does not read as a positive number, because a clip recreated at
  // a guessed length is a musical value invented from nothing. The plan must then
  // also withhold the NOTES: replaying them into a slot with no clip is E2's trap.
  const { targets, unrevertable } = writeSetOf([{ op: 'clip.delete', slot: SLOT_A }]);
  const stash = stashOf([
    { address: CLIP_A, fidelity: 'lossy', value: { of: 'clip', exists: true } },
    notesEntry(notesAt(CLIP_A), [note()]),
  ]);
  const plan = revertOps({ targets, unrevertable, stash });
  assert.deepEqual(plan.ops, []);
  assert.equal(plan.unrestored.length, 1);
  assert.match(plan.unrestored[0]!.why, /length was not captured/);

  // ⚠ And the LABEL has to agree with the plan, or the take under-delivers
  // silently — which is the half of D5 that is a promise about reporting. Both
  // adapters say `lossy` here and both are right about their own readback; what
  // they cannot know is that `revert.ts` then withholds the clip AND its notes,
  // so nothing about this address survives. `labelTarget` derives that once, on
  // this side, and takes the worst.
  //
  // It is load-bearing downstream: the stash's `summarize` lists exactly the
  // `none` values as `unrestorable`, so a `lossy` here would drop the clip out
  // of the changeset listing and surface the loss only mid-reversal.
  const clipTarget = targets.find((t) => t.address.kind === 'clip')!;
  const label = labelTarget(clipTarget, stash, { scenes: false, deviceChains: false });
  assert.equal(label.fidelity, 'none');
  assert.match(label.caveats.join(' '), /LENGTH was not captured/);

  // The same clip WITH a length stays `lossy` — the downgrade is derived from
  // the missing field, not from the address kind.
  const withLength = labelTarget(clipTarget, stashOf([
    { address: CLIP_A, fidelity: 'lossy', value: { of: 'clip', exists: true, lengthBeats: 4 } },
  ]), { scenes: false, deviceChains: false });
  assert.equal(withLength.fidelity, 'lossy');
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

test('R-none: a copied track retains a specific public failure label', () => {
  const plan = revertOps({
    ...writeSetOf([{ op: 'track.duplicate', track: TA }]),
    stash: stashOf([
      { address: TA, fidelity: 'exact', value: { of: 'track', track: { channelId: TA.channelId, name: 'gn-A', position: 0, type: 'Instrument' } } },
    ]),
  });
  assert.deepEqual(plan.ops, []);
  assert.deepEqual(plan.unrestored.map((u) => u.what), ['copied track']);
});

test('R-device: an insert is undone at the chain index the receipt MINTED (D16 rev)', () => {
  const ops: Op[] = [
    { op: 'device.insert', track: TA, source: { from: 'bitwig', uuid: 'abc' } },
    { op: 'device.insert', track: TA, source: { from: 'bitwig', uuid: 'def' } },
  ];
  const plan = revertOps({
    ...writeSetOf(ops),
    stash: stashOf([]),
    batches: [{ ops, minted: { 0: device(TA, 3), 1: device(TA, 4) } }],
  });
  // ⚠ DESCENDING. A device chain RE-INDEXES on delete (E3), so deleting 3 first
  // would shift 4 down into its place and the second delete would take the wrong
  // device — a bug that looks like it works on any one-device batch.
  assert.deepEqual(plan.ops.map((o) => (o.op === 'device.delete' ? o.device.chainIndex : -1)), [4, 3]);
  assert.deepEqual(plan.unrestored, []);
});

test('R-device: SEVERAL batches keep their own op indices, and order across all of them', () => {
  // ⚠ The shape the store's walk needs, and the reason `batches` is a list. A
  // `minted` map is indexed by op index WITHIN its batch, so flattening two takes
  // makes op 0 ambiguous — and the delete that came out of the ambiguity would
  // take a device nobody addressed. Kept apart, both takes contribute, and the
  // descending order is computed over the WHOLE set because the hazard is the
  // chain's shape, not which take caused it.
  const first: Op[] = [{ op: 'device.insert', track: TA, source: { from: 'bitwig', uuid: 'abc' } }];
  const second: Op[] = [{ op: 'device.insert', track: TA, source: { from: 'bitwig', uuid: 'def' } }];
  const plan = revertOps({
    ...writeSetOf([...first, ...second]),
    stash: stashOf([]),
    batches: [
      { ops: first, minted: { 0: device(TA, 1) } },
      { ops: second, minted: { 0: device(TA, 2) } },
    ],
  });
  assert.deepEqual(plan.ops.map((o) => (o.op === 'device.delete' ? o.device.chainIndex : -1)), [2, 1]);
  assert.deepEqual(plan.unrestored, []);
});

test('R-device: an insert nobody watched land is REPORTED, never deleted at a counted index', () => {
  // The whole point of minting rather than computing. An index we inferred can be
  // wrong by any structural op that ran in between, and being wrong here deletes
  // a device the user cares about (E2c's rule for `track.create`, D20's *name the
  // survivor, never count it*). So an unobserved insert leaves the chain alone.
  const ops: Op[] = [{ op: 'device.insert', track: TA, source: { from: 'bitwig', uuid: 'abc' } }];
  const plan = revertOps({ ...writeSetOf(ops), stash: stashOf([]), batches: [{ ops, minted: {} }] });
  assert.deepEqual(plan.ops, []);
  assert.equal(plan.unrestored.length, 1);
  assert.match(plan.unrestored[0]!.why, /never read back/);

  // ⚠ ...and it is said ONCE. The executor stamps the same fact onto the take the
  // moment the receipt comes back (`unobservedInserts`), so by the time a plan is
  // built both channels know it — and D5's promise is a report a human reads, not
  // a report that repeats itself.
  const alreadySaid = revertOps({
    targets: [],
    unrevertable: [{ opIndex: 0, op: 'device.insert', why: 'said by the executor' }],
    stash: stashOf([]),
    batches: [{ ops, minted: {} }],
  });
  assert.equal(alreadySaid.unrestored.length, 1);
  assert.match(alreadySaid.unrestored[0]!.why, /said by the executor/);
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
