import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FIXTURE_DIR } from '../bwmod/fixtures.js';
import {
  presetModulationInspectionInputValidator, runPresetModulationInspection,
} from './preset-modulation-inspection.js';
import { TOOLS } from './tools.js';

test('5k-schema: the read tool accepts only an explicit absolute preset path', () => {
  const path = join(FIXTURE_DIR, 'Polysynth', 'mp_bare.bwpreset');
  assert.deepEqual(presetModulationInspectionInputValidator.parse({ presetPath: path }), {
    presetPath: path,
  });
  assert.throws(() => presetModulationInspectionInputValidator.parse({ presetPath: 'mp_bare.bwpreset' }));
  assert.throws(() => presetModulationInspectionInputValidator.parse({ presetPath: '/tmp/not-a-preset.txt' }));
  assert.throws(() => presetModulationInspectionInputValidator.parse({ presetPath: path, listIndex: 0 }));

  const tool = TOOLS.find((candidate) => candidate.name === 'inspect_preset_modulation');
  assert.equal(tool?.kind, 'read');
  assert.deepEqual(tool?.emits, []);
});

test('5k-surface: the public runner returns the semantic result from disk', async () => {
  const path = join(FIXTURE_DIR, 'Polysynth', 'gn_mod_lfo-sampler.bwpreset');
  const result = await runPresetModulationInspection({ presetPath: path });
  assert.equal(result.supported, true);
  if (!result.supported) return;
  assert.equal(result.host.name, 'Polysynth');
  assert.deepEqual(result.modulation.map((item) => item.location), [{ kind: 'self' }]);
  assert.equal(result.modulation[0]?.modulators[0]?.name, 'LFO');
});
