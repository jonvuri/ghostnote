import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { verifyOffline } from './phase8h3d-change.js';

const dir = fileURLToPath(new URL('../../../context/evidence/data/phase8h3d-change', import.meta.url));

test('the retained 8h3d artifacts support every E231 claim', async () => {
  const report = await verifyOffline(dir);
  assert.equal(report.pull.length, 8);
  assert.equal(report.watches32.heapMiB, 154);
});
