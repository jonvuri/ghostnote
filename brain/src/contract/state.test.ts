import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  BASE_TO_MODULATED_WARNING_TOLERANCE,
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
