import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { verifyOffline } from './phase8h4a-boundary.js';

const dir = fileURLToPath(new URL('../../../context/evidence/data/phase8h4a-boundary', import.meta.url));

test('the retained 8h4a artifacts support every E234 live claim', async () => {
  const report = await verifyOffline(dir);
  assert.deepEqual(report.issues, []);
  assert.equal(report.artifacts, 13);
});
