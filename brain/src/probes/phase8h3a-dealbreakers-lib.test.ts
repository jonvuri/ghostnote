import assert from 'node:assert/strict';
import test from 'node:test';
import { verdict } from './phase8h3a-dealbreakers-lib.js';
import { fixturePlan, type Wire } from './phase8h2a-replay-lib.js';
const defaults = { gain: 0, chance: 1, chanceEnabled: true, muted: false };
const trial = (): Wire => ({ target: { ...fixturePlan('one-64'), trackId: 't', row: 0 }, cursor: { trackChannelId: 't', sceneIndex: 0, clipExists: true }, rows: [[0, 0, 60, 100 / 127, 4, 0, 1, true, false]],
  status: { closeMs: 50, closeSeq: 4, callbacks: 4, duplicates: 0, droppedBatches: 0, droppedValues: 0,
    values: [['clipExists', 'true', 0, 25, 4, 50]], batches: [[1, 25, 4, 50, 26, 4, 75]] } });
test('8h3a: a close capture needs exact fields and no callback after close', () => {
  assert.equal(verdict(trial(), defaults).pass, true);
  const late = trial(); (late.status as Wire).callbacks = 5;
  assert.equal(verdict(late, defaults).afterClose, 1); assert.equal(verdict(late, defaults).pass, false);
  const wrong = trial(); (wrong.rows as number[][])[0]![5] = 0.5;
  assert.equal(verdict(wrong, defaults).exact, false);
  const missing = trial(); (missing.status as Wire).closeMs = -1;
  assert.deepEqual(verdict(missing, defaults).issues, ['no-close-signal']);
});
test('8h3a: the earlier write must be present in the close capture', () => {
  const changed = trial(); changed.writeVelocity = 0.2;
  assert.equal(verdict(changed, defaults).exact, false);
  (changed.rows as number[][])[0]![3] = 0.2;
  assert.equal(verdict(changed, defaults).pass, true);
});

test('8h3a: close time alone cannot admit a split replay or a wrong target', () => {
  const split = trial(); (split.status as Wire).batches = [[1, 25, 2, 40, 26, 4, 75], [3, 45, 4, 50, 46, 4, 75]];
  assert.equal(verdict(split, defaults).pass, false);
  const early = trial(); (early.status as Wire).values = [['clipExists', 'true', 0, 25, 2, 40]];
  assert.equal(verdict(early, defaults).pass, false);
  const wrong = trial(); (wrong.cursor as Wire).sceneIndex = 1;
  assert.equal(verdict(wrong, defaults).pass, false);
});
