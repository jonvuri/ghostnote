import { test } from 'node:test';
import assert from 'node:assert/strict';

import { withTemporaryRecord } from './temporary-record.js';

test('4a follow-up: cleanup runs when replacement readback fails', async () => {
  const writes: string[] = [];
  const replace = async (value: string): Promise<void> => {
    writes.push(value);
    if (value === 'marker') throw new Error('readback timed out after acceptance');
  };

  await assert.rejects(
    withTemporaryRecord(replace, 'saved', 'marker', async () => undefined),
    /readback timed out/,
  );
  assert.deepEqual(writes, ['marker', 'saved']);
});

test('4a follow-up: cleanup runs when the bridge disconnects after replacement', async () => {
  const writes: string[] = [];

  await assert.rejects(
    withTemporaryRecord(
      async (value) => { writes.push(value); },
      'saved',
      'marker',
      async () => { throw new Error('bridge disconnected'); },
    ),
    /bridge disconnected/,
  );
  assert.deepEqual(writes, ['marker', 'saved']);
});
