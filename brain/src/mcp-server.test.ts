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

test('the retired Phase 7b server profile refuses to start (8h4d)', async () => {
  const env = Object.fromEntries(Object.entries(process.env)
    .filter((entry): entry is [string, string] => entry[1] !== undefined));
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['--import', 'tsx', 'src/mcp-server.ts'],
    env: { ...env, GHOSTNOTE_TOOL_PROFILE: 'phase-7b-agent-note-patch-v0' },
    stderr: 'ignore',
  });
  const client = new Client({ name: 'ghostnote-retired-profile-test', version: '1.0.0' });
  await assert.rejects(client.connect(transport));
  await client.close().catch(() => undefined);
});

test('the agent-native-v1 server profile lists the kept stable tools, the document, clip, and device tools', async (t) => {
  const env = Object.fromEntries(Object.entries(process.env)
    .filter((entry): entry is [string, string] => entry[1] !== undefined));
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['--import', 'tsx', 'src/mcp-server.ts'],
    env: { ...env, GHOSTNOTE_TOOL_PROFILE: 'agent-native-v1' },
  });
  const client = new Client({ name: 'ghostnote-agent-native-profile-test', version: '1.0.0' });
  await client.connect(transport);
  t.after(async () => client.close());

  const names = (await client.listTools()).tools.map((item) => item.name);
  assert.equal(names.length, 41);
  assert.deepEqual(names.slice(-24, -21), ['read_launcher_clip', 'check_launcher_clips', 'edit_launcher_clip']);
  assert.deepEqual(names.slice(-12, -9), ['read_devices', 'read_device_controls', 'set_device_controls']);
  for (const retired of ['acquire_clip_note_source', 'read_clip', 'write_notes', 'record_observation', 'copy_clip_down',
    'create_device_alternates', 'keep_device_alternate', 'inspect_devices', 'set_parameter', 'compose_device_sources']) {
    assert.equal(names.includes(retired), false, retired);
  }
});
