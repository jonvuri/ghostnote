import assert from 'node:assert/strict';
import { test } from 'node:test';
import { verifyOffline } from './phase8h4a2-collapsed.js';

const DATA = new URL('../../../context/evidence/data/phase8h4a2-collapsed', import.meta.url).pathname;

test('E240 retained artifacts support every claim', async () => {
  const summary = await verifyOffline(DATA);
  assert.equal(summary['collapse-first:collapsed-a']['expand-parent'].passed, 53);
});
