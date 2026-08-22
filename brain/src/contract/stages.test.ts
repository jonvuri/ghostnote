/**
 * Staging plan tests — `planStages` is pure, so this needs no adapter at all.
 *
 * What is being protected: E8 measured 240 note writes at 25ms as one batch
 * versus 5804ms as separate RPCs (232x), and that win survives only if instant
 * ops actually coalesce. The opposite failure is subtler — an op that depends on
 * a structural op running before its target exists — which is why a settling op
 * never shares a stage with anything.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SETTLE_MS, planBudgetMs, planStages, stepSizeFor } from './index.js';
import { clip, device, param, scene, slot, track } from './address.js';
import type { Op } from './ops.js';

const T = track('b07f6b06-8f4f-4f4f-802d-ddf1a5190515');
const CLIP = clip(slot(T, scene(0, 1)));
const note = { startBeats: 0, pitch: 60, velocity: 100, durationBeats: 1 };

const write = (): Op => ({ op: 'note.write', clip: CLIP, notes: [note] });
const notify = (m: string): Op => ({ op: 'notify', message: m });

test('S-coalesce: consecutive instant ops share ONE stage (the E8 232x win)', () => {
  const stages = planStages([write(), write(), notify('x'), write()]);
  assert.equal(stages.length, 1);
  assert.equal(stages[0]!.ops.length, 4);
  assert.equal(stages[0]!.settle, undefined);
});

test('S-stage: a settling op gets its own stage with its budget', () => {
  const stages = planStages([
    { op: 'device.insert', track: T, source: { from: 'bitwig', uuid: 'abc' } },
  ]);
  assert.equal(stages.length, 1);
  // ~600ms: a real plugin load, the slowest op measured (E3).
  assert.equal(stages[0]!.settle, 'deviceInsert');
});

test('S-stage: a settling op never shares with the instant ops around it', () => {
  // The E8 worked example: writing into a device inserted earlier in the same
  // batch would run before the device exists.
  const stages = planStages([
    write(),
    { op: 'device.insert', track: T, source: { from: 'bitwig', uuid: 'abc' } },
    { op: 'param.set', param: param(device(T, 0), 3), value: 0.5 },
  ]);
  assert.deepEqual(stages.map((s) => s.ops.map((o) => o.op)), [
    ['note.write'],
    ['device.insert'],
    ['param.set'],
  ]);
  assert.deepEqual(stages.map((s) => s.settle), [undefined, 'deviceInsert', 'tick']);
});

test('S-order: caller order is never rearranged', () => {
  // Callers express dependencies positionally; reordering would be a correctness
  // bug dressed up as an optimization.
  const stages = planStages([
    { op: 'clip.create', slot: slot(T, scene(0, 1)), lengthBeats: 4 },
    write(),
  ]);
  assert.deepEqual(stages.flatMap((s) => s.ops.map((o) => o.op)), ['clip.create', 'note.write']);
});

test('S-order: clip.create can precede a write to that clip in one plan', () => {
  // ⚠ E2: pointing at an EMPTY slot silently lands the cursor on the WRONG clip
  // while status looks healthy, so the create must both come first AND settle.
  const stages = planStages([
    { op: 'clip.create', slot: slot(T, scene(0, 1)), lengthBeats: 4 },
    write(),
  ]);
  assert.equal(stages[0]!.settle, 'trackStruct');
  assert.equal(stages[1]!.settle, undefined);
});

test('S-indices: every op maps back to its caller index', () => {
  const ops = [write(), { op: 'scene.create', count: 1 } as Op, write()];
  const stages = planStages(ops);
  assert.deepEqual(stages.flatMap((s) => s.opIndices), [0, 1, 2]);
});

test('S-empty: an empty plan is an empty stage list, not a stage of nothing', () => {
  assert.deepEqual(planStages([]), []);
});

test('S-budget: the advisory wall-clock estimate sums only the settles', () => {
  const stages = planStages([
    write(),
    { op: 'device.insert', track: T, source: { from: 'bitwig', uuid: 'abc' } },
  ]);
  assert.equal(planBudgetMs(stages, SETTLE_MS), SETTLE_MS.deviceInsert);
});

// --- E15-D: the wait that has to come BEFORE a stage -------------------------

test('S-before: a property write waits for the grid the create changed (E15-D)', () => {
  // ⚠ The load-bearing assertion of the E15-D fix. `cursor.setNoteProps` reads a
  // NoteStep before mutating it, and that read is unusable for ~120ms after the
  // `cursor.setStepSize` the create emitted. A settle AFTER the props stage
  // cannot help: by then the properties have already been discarded, silently.
  const stages = planStages([
    { op: 'note.write', clip: CLIP, notes: [{ ...note, pan: -0.25 }] },
  ]);
  assert.deepEqual(stages.map((s) => s.ops.map((o) => o.op)), [['note.write'], ['note.props']]);
  assert.equal(stages[0]!.settleBefore, undefined, 'the create needs no wait in front of it');
  assert.equal(stages[1]!.settleBefore, 'gridChange');
});

test('S-before: a note with no properties pays nothing for the rule (E8)', () => {
  const stages = planStages([write(), write()]);
  assert.equal(stages.length, 1);
  assert.equal(stages[0]!.settleBefore, undefined);
  assert.equal(planBudgetMs(stages, SETTLE_MS), 0);
});

test('S-budget: a settleBefore counts toward the estimate too (E15-D)', () => {
  const stages = planStages([{ op: 'note.write', clip: CLIP, notes: [{ ...note, pan: 0.5 }] }]);
  // gridChange in front of the props stage, then noteWrite after it.
  assert.equal(planBudgetMs(stages, SETTLE_MS), SETTLE_MS.gridChange + SETTLE_MS.noteWrite);
});

test('S-nohoist: property ops stay INTERLEAVED with their writes (E15-F)', () => {
  // ⚠ Asserting a deliberate non-optimization, which is unusual enough to
  // justify itself. Two property-bearing writes to different clips cost four
  // stages, and PHASE-0-SESSION-2 item 4 proposed collapsing them to two.
  // E15-F measured that the collapsed shape silently loses expression: a props
  // op resolves its note against the clip the cursor held at the START of the
  // turn, so in a shared stage every op but one looks in the wrong clip.
  //
  // Interleaving is the mitigation. This test is what makes removing it fail
  // here rather than on someone's project.
  const CLIP_B = clip(slot(track('9c1a0b7e-1111-4f4f-802d-ddf1a5190515'), scene(0, 1)));
  const withPan = (n: typeof note) => ({ ...n, pan: -0.25 });
  const stages = planStages([
    { op: 'note.write', clip: CLIP, notes: [withPan(note)] },
    { op: 'note.write', clip: CLIP_B, notes: [withPan({ ...note, pitch: 67 })] },
  ]);
  assert.deepEqual(stages.map((s) => s.ops.map((o) => o.op)), [
    ['note.write'], ['note.props'], ['note.write'], ['note.props'],
  ], 'each props stage must follow the create for its OWN clip, so the turn starts there');
  // And the cost is the thing item 4 wanted to remove — recorded honestly, so
  // the trade-off is visible rather than forgotten.
  assert.equal(planBudgetMs(stages, SETTLE_MS), 2 * (SETTLE_MS.gridChange + SETTLE_MS.noteWrite));
});

test('S-grid: the split leaves both stages on the SAME grid (E15-D)', () => {
  // ⚠ The invariant the props stage's frames rest on, and the reason the props
  // op carries the write's whole note set rather than just the expressive ones.
  // A props op emits `setStepSize` then `getStep` in ONE turn, so if that grid
  // differs from the one the create left behind, the call is a real change and
  // every property is discarded silently — a `settleBefore` in front of the
  // stage cannot reach damage done inside it.
  //
  // The beat positions are chosen so filtering WOULD diverge: the create sees
  // beat 0.5 and needs a 0.5 grid, while the expressive note alone (beat 0,
  // duration 1) would sit happily on a 1 grid.
  const stages = planStages([
    {
      op: 'note.write',
      clip: CLIP,
      notes: [
        { startBeats: 0, pitch: 60, velocity: 100, durationBeats: 1, pan: -0.25 },
        { startBeats: 0.5, pitch: 67, velocity: 100, durationBeats: 0.5 },
      ],
    },
  ]);
  const write = stages[0]!.ops[0] as Extract<Op, { op: 'note.write' }>;
  const props = stages[1]!.ops[0] as Extract<Op, { op: 'note.props' }>;
  assert.equal(stepSizeFor(write.notes), 0.5, 'the create is pinned to the finer note');
  assert.equal(stepSizeFor(props.notes), stepSizeFor(write.notes));
  assert.equal(stepSizeFor([props.notes[0]!]), 1, 'and filtering really would have diverged');
});
