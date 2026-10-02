import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { verifyMutationWitness } from './phase8g-mutation-witness.js';

const retained = JSON.parse(gunzipSync(await readFile(new URL('../../../context/evidence/data/phase8g-selected-replay-and-witnesses/mutation-witness.json.gz', import.meta.url))).toString('utf8'));
test('owned witness retains the unchanged fixture and four existing chains', () => {
  verifyMutationWitness(retained, retained.ownedTrackId);
  const relocated = structuredClone(retained);
  relocated.presetPath = '/another/checkout/brain/fixtures/InstrumentLayer/gn_layer_4chain.bwpreset';
  relocated.insertParams.path = relocated.presetPath;
  verifyMutationWitness(relocated, retained.ownedTrackId);
});
test('another owner, changed notes, missing chains, or changed preset cannot certify setup', () => {
  assert.throws(() => verifyMutationWitness(retained, 'another-owner'));
  for (const damage of [
    (value: typeof retained) => { value.after.notes[0].notes[0].velocity = 0; },
    (value: typeof retained) => { value.layer.inventory.scopes[0].chains.pop(); },
    (value: typeof retained) => { value.presetSha256After = '0'.repeat(64); },
    (value: typeof retained) => { delete value.insertRequestedAt; },
  ]) { const value = structuredClone(retained); damage(value); assert.throws(() => verifyMutationWitness(value, retained.ownedTrackId)); }
});
