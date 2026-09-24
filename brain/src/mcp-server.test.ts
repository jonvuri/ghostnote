import assert from 'node:assert/strict';
import test from 'node:test';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const EXPECTED_INSTRUCTIONS = 'Ghostnote reads and edits the active Bitwig Studio project: tracks, '
  + 'launcher clips, notes, devices, parameters, modulation, device alternates, and verified '
  + 'composition workflows. Clients should use a specific read when current state is needed. Writes '
  + 'return recorded change IDs; supported writes can be inspected or reversed. Delete tools '
  + 'permanently remove containers.';

test('initialize returns the compact Ghostnote server instructions', async (t) => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['--import', 'tsx', 'src/mcp-server.ts'],
  });
  const client = new Client({ name: 'ghostnote-initialize-test', version: '1.0.0' });
  await client.connect(transport);
  t.after(async () => client.close());

  const instructions = client.getInstructions();
  assert.equal(instructions, EXPECTED_INSTRUCTIONS);
  assert.equal(Buffer.byteLength(JSON.stringify(instructions), 'utf8'), 371);
});

test('the explicit Phase 7b server profile adds only experimental tools', async (t) => {
  const env = Object.fromEntries(Object.entries(process.env)
    .filter((entry): entry is [string, string] => entry[1] !== undefined));
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['--import', 'tsx', 'src/mcp-server.ts'],
    env: { ...env, GHOSTNOTE_TOOL_PROFILE: 'phase-7b-agent-note-patch-v0' },
  });
  const client = new Client({ name: 'ghostnote-experimental-profile-test', version: '1.0.0' });
  await client.connect(transport);
  t.after(async () => client.close());

  const listed = await client.listTools();
  assert.equal(listed.tools.some((item) => item.name === 'acquire_clip_note_source'), true);
});
