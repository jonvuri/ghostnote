import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { verifyOffline } from './phase8h4e0-display.js';

const dir = fileURLToPath(new URL('../../../context/evidence/data/phase8h4e0-display', import.meta.url));

test('E244: the retained 8h4e0 artifacts support every claim', async () => {
  await verifyOffline(dir);
});
