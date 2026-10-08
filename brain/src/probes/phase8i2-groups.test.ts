import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { verifyOffline } from './phase8i2-groups.js';

const dir = fileURLToPath(new URL('../../../context/evidence/data/phase8i2-groups', import.meta.url));

test('E251: the retained 8i2 artifacts support every claim', async () => {
  await verifyOffline(dir);
});
