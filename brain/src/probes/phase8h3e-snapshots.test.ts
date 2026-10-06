import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { verifyOffline } from './phase8h3e-snapshots.js';

const dir = fileURLToPath(new URL('../../../context/evidence/data/phase8h3e-snapshots', import.meta.url));

test('the retained 8h3e artifacts support every E233 live verdict', async () => {
  const report = await verifyOffline(dir);
  assert.deepEqual(report.issues, []);
  assert.equal(Object.keys(report.verdicts).length, 23);
  const counts: Record<string, number> = {};
  for (const verdict of Object.values(report.verdicts) as string[]) counts[verdict] = (counts[verdict] ?? 0) + 1;
  assert.deepEqual(counts, { current: 2, stale: 13, 'identity-changed': 6, incomparable: 2 });
});
