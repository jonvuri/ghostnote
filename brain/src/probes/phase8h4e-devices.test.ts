import assert from 'node:assert/strict';
import { join } from 'node:path';
import test from 'node:test';

import { verifyOffline } from './phase8h4e-devices.js';

test('8h4e (E238): the retained recipe and benchmark artifacts carry every claim', async () => {
  const summary = await verifyOffline(join(import.meta.dirname, '..', '..', '..', 'context', 'evidence', 'data',
    'phase8h4e-devices'));
  assert.equal(summary.recipes, 'pass');
  for (const chains of [2, 4]) {
    assert.ok(summary.benchmark[`${chains}-offline`].median < summary.benchmark[`${chains}-staged`].median / 4);
  }
});
