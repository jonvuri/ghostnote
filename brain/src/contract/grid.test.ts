import assert from 'node:assert/strict';
import test from 'node:test';
import { noteReadCell, noteReadStart, chooseStepSize } from './grid.js';

test('D31 uses the occupied cell and keeps binary cell boundaries', () => {
  assert.equal(noteReadCell(1 / 6), 85);
  assert.equal(noteReadStart(1 / 6), 85 / 512);
  assert.equal(noteReadCell(85 / 512), 85);
  assert.equal(noteReadCell(1 / 6 + 1 / 512), 86);
});

test('D31 reconstructs cell starts with independent D9 durations', () => {
  assert.equal(chooseStepSize([{ startBeats: 85 / 512, pitch: 60, velocity: 100,
    durationBeats: 1 / 3 }]), 1 / 512);
  assert.equal(chooseStepSize([{ startBeats: 1 / 6, pitch: 60, velocity: 100,
    durationBeats: 1 / 3 }]), 1 / 6);
  assert.throws(() => chooseStepSize([{ startBeats: 85 / 512, pitch: 60, velocity: 100,
    durationBeats: 0.123456789 }]), /timing|grid/i);
});
