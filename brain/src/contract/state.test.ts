import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  BASE_TO_MODULATED_WARNING_TOLERANCE, orderedNoteProps,
  hasMeaningfulBaseToModulatedDivergence,
} from './state.js';

test('host-value warning tolerance keeps equality and representation noise quiet', () => {
  assert.equal(BASE_TO_MODULATED_WARNING_TOLERANCE, 1e-6);
  assert.equal(hasMeaningfulBaseToModulatedDivergence(0.18, 0.18), false);
  assert.equal(
    hasMeaningfulBaseToModulatedDivergence(0.18, 0.18000000715255737),
    false,
  );
  assert.equal(hasMeaningfulBaseToModulatedDivergence(0.18, 0.180002), true);
});

test('D31 writes disabled control values before their flags', () => {
  const entries = orderedNoteProps({ startBeats: 0, pitch: 60, velocity: 100, durationBeats: 1,
    chance: 0.3, isChanceEnabled: false, occurrence: 'PREV', isOccurrenceEnabled: false,
    recurrence: [8, 85], isRecurrenceEnabled: false, repeatCount: -2,
    repeatCurve: 0.5, repeatVelocityCurve: -0.5, repeatVelocityEnd: 0.75, isRepeatEnabled: false });
  const keys = entries.map(([key]) => key);
  for (const [value, flag] of [['chance', 'isChanceEnabled'], ['occurrence', 'isOccurrenceEnabled'],
    ['recurrence', 'isRecurrenceEnabled'], ['repeatCount', 'isRepeatEnabled'],
    ['repeatCurve', 'isRepeatEnabled'], ['repeatVelocityCurve', 'isRepeatEnabled'],
    ['repeatVelocityEnd', 'isRepeatEnabled']]) {
    assert.ok(keys.indexOf(value!) < keys.indexOf(flag!));
  }
});
