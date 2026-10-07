import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { verifyOffline } from './phase8h4a5-collapsed-cursor.js';

const dir = fileURLToPath(new URL('../../../context/evidence/data/phase8h4a5-cursor', import.meta.url));

test('E243: the retained 8h4a5 artifacts support every claim', async () => {
  await verifyOffline(dir);
});
