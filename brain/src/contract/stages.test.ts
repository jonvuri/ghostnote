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

import { SETTLE_MS, planBudgetMs, planStages } from './index.js';
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
  assert.deepEqual(stages.map((s) => s.settle), [undefined, 'deviceInsert', undefined]);
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
