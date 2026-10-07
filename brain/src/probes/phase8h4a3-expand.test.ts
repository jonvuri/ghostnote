import assert from 'node:assert/strict';
import { test } from 'node:test';
import { verifyOffline } from './phase8h4a3-expand.js';

const DATA = new URL('../../../context/evidence/data/phase8h4a3-expand', import.meta.url).pathname;

test('E241 retained artifacts support every claim', async () => {
  const summary = await verifyOffline(DATA);
  assert.equal(summary['normal-matrix-collapsed'], 108);
});
