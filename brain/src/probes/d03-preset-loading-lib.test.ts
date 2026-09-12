import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyPresetSuffix, directRouteVerdict, timingSummary } from './d03-preset-loading-lib.js';

test('classifies only the documented Bitwig file formats as direct candidates', () => {
  for (const suffix of ['bwpreset', '.H2P', 'fxp', 'FXB', 'vstpreset']) {
    assert.equal(classifyPresetSuffix(suffix), 'bitwig-file');
  }
  for (const suffix of ['aupreset', 'nksf', 'kelvin', 'vpreset', 'serumpreset']) {
    assert.equal(classifyPresetSuffix(suffix), 'host-external');
  }
  assert.equal(classifyPresetSuffix('clap-discovered'), 'clap-discovery');
  assert.equal(classifyPresetSuffix('mystery'), 'unknown');
});

test('reports the median and full range of exactly three warm samples', () => {
  assert.deepEqual(timingSummary([453, 444, 453]), { median: 453, range: [444, 453] });
  assert.throws(() => timingSummary([1, 2]), /exactly three/);
  assert.throws(() => timingSummary([1, Number.NaN, 3]), /finite/);
});

test('separates direct, indexed-only, unsupported, and unstable routes', () => {
  assert.equal(directRouteVerdict([true, true, true, true], true), 'direct');
  assert.equal(directRouteVerdict([true, true, true, true], false), 'indexed-direct');
  assert.equal(directRouteVerdict([false, false, false, false], false), 'unsupported');
  assert.equal(directRouteVerdict([true, false, true, true], false), 'nondeterministic');
  assert.equal(directRouteVerdict([false, false, false, false], true), 'nondeterministic');
});
