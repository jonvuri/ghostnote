import { test } from 'node:test';
import assert from 'node:assert/strict';

import { listSupportedDonorTypes } from '../bwmod/index.js';
import { phase5tWitnessPolicy } from './phase5t-witness-policy.js';

test('5t witness policy applies every supported manifest trigger', () => {
  const policies = listSupportedDonorTypes().map((type) => ({
    id: type.id,
    policy: phase5tWitnessPolicy(type),
  }));
  const ids = (key: keyof (typeof policies)[number]['policy']): string[] => policies
    .filter((item) => item.policy[key])
    .map((item) => item.id);

  assert.deepEqual(ids('sustainedNote'), ['adsr', 'ramp', 'random', 'segments', 'vibrato']);
  assert.deepEqual(ids('runningTransport'), [
    'adsr', 'beat-lfo', 'curves', 'lfo', 'ramp', 'random', 'segments', 'vibrato',
  ]);
  assert.deepEqual(ids('operatorControl'), ['vector-4', 'vector-8', 'xy']);
  assert.deepEqual(ids('targetDivergence'), ['lfo', 'random', 'vibrato']);
  assert.deepEqual(ids('exactPage'), [
    'adsr', 'beat-lfo', 'classic-lfo', 'curves', 'ramp', 'segments',
    'vector-4', 'vector-8', 'xy',
  ]);
});

test('5t witness policy refuses an unknown requirement', () => {
  assert.throws(() => phase5tWitnessPolicy({
    id: 'future',
    witness: { mode: 'structural', requirements: ['future-trigger'] },
  }), /unknown witness requirements/);
});
