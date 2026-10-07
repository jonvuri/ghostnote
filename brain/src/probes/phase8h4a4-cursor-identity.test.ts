import assert from 'node:assert/strict';
import { test } from 'node:test';
import { verifyOffline } from './phase8h4a4-cursor-identity.js';

const DATA = new URL('../../../context/evidence/data/phase8h4a4-cursor', import.meta.url).pathname;

test('E242 retained artifacts support every claim', async () => {
  const summary = await verifyOffline(DATA);
  assert.deepEqual(summary['collapsedRows'], { refused: 10, total: 27 });
});
