/** Focused live check for the session 4a product panel. */
import { createInterface } from 'node:readline/promises';

import { BridgeClient } from '../client.js';
import { withTemporaryRecord } from './temporary-record.js';

const client = new BridgeClient();
const readline = createInterface({ input: process.stdin, output: process.stdout });
const recordChars = 262144;
const marker = '4'.repeat(recordChars);
let original = '';

interface RecordReply {
  readonly available?: boolean;
  readonly accepted?: boolean;
  readonly value?: string;
  readonly capacityChars?: number;
}

interface RevisionReply {
  readonly generation?: string;
  readonly project?: string;
}

async function readRecord(): Promise<RecordReply> {
  return await client.request('observation.read') as RecordReply;
}

async function waitFor(value: string): Promise<void> {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if ((await readRecord()).value === value) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`observation record did not settle at ${value.length} characters`);
}

async function replace(value: string): Promise<void> {
  const reply = await client.request('observation.replace', { value }) as RecordReply;
  if (reply.accepted !== true) throw new Error('observation replacement was not accepted');
  await waitFor(value);
}

try {
  await client.connect();
  const before = await readRecord();
  if (before.available !== true || typeof before.value !== 'string') {
    throw new Error('the hidden observation record is unavailable');
  }
  if (before.capacityChars !== recordChars) {
    throw new Error(`expected ${recordChars} record characters, got ${before.capacityChars}`);
  }
  original = before.value;
  await withTemporaryRecord(replace, original, marker, async () => {
    const at = await client.request('revision.get') as RevisionReply;
    if (typeof at.generation !== 'string' || typeof at.project !== 'string') {
      throw new Error('the project identity is unavailable');
    }

    const status = 'Change · 4a-live-check';
    const pushed = await client.request('status.push', {
      value: status,
      expectedGeneration: at.generation,
      expectedProject: at.project,
    }) as { readonly accepted?: boolean };
    if (pushed.accepted !== true) throw new Error('status update was not accepted');

    console.log('ARMED: the hidden record holds 262144 characters and status is:');
    console.log(`  ${status}`);
    console.log('Confirm in Bitwig:');
    console.log('  1. The pane shows only Last change.');
    console.log('  2. Observation record, Revert, Take, slots, and probe rows are absent.');
    console.log('  3. The pane stays responsive.');
    console.log('  4. Edit Last change; it restores the value above without another request.');
    await readline.question('Press Enter after all four checks pass: ');
  });
  console.log(`RESTORED: original observation record (${original.length} characters).`);
} finally {
  readline.close();
  client.disconnect();
}
