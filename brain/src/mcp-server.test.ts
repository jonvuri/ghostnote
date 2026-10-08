import assert from 'node:assert/strict';
import test from 'node:test';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const STABLE_INSTRUCTIONS = 'Ghostnote reads and edits the active Bitwig Studio project: tracks, '
  + 'launcher clips, notes, devices, parameters, modulation, device alternates, and verified '
  + 'composition workflows. Clients should use a specific read when current state is needed. Writes '
  + 'return recorded change IDs; supported writes can be inspected or reversed. Delete tools '
  + 'permanently remove containers.';
const AGENT_NATIVE_INSTRUCTIONS = 'Ghostnote reads and edits the active Bitwig Studio project: tracks, Launcher '
  + 'clips as Ghostnote documents, devices, layer chains, device controls, and preset modulation. Read the current '
  + 'state before a write. Each result has a schema; a failure has failure.code. Each durable effect has a change '
  + 'ID for revert_change. Delete tools permanently remove what they name.';

const environment = (profile?: string): Record<string, string> => ({
  ...Object.fromEntries(Object.entries(process.env)
    .filter((entry): entry is [string, string] => entry[1] !== undefined && entry[0] !== 'GHOSTNOTE_TOOL_PROFILE')),
  ...(profile === undefined ? {} : { GHOSTNOTE_TOOL_PROFILE: profile }),
});

async function connected(t: { after(run: () => Promise<void>): void }, profile?: string): Promise<Client> {
  const transport = new StdioClientTransport({
    command: process.execPath, args: ['--import', 'tsx', 'src/mcp-server.ts'], env: environment(profile),
  });
  const client = new Client({ name: 'ghostnote-profile-test', version: '1.0.0' });
  await client.connect(transport);
  t.after(async () => client.close());
  return client;
}

test('8h4f: the default server profile is agent-native-v1, with its compact instructions', async (t) => {
  const client = await connected(t);
  assert.equal(client.getInstructions(), AGENT_NATIVE_INSTRUCTIONS);
  const names = (await client.listTools()).tools.map((item) => item.name);
  assert.equal(names.length, 41);
  assert.equal(names[1], 'check_bitwig_connection');
});

test('8h4f: stable-v1 stays selectable with its frozen instructions and 53 tools', async (t) => {
  const client = await connected(t, 'stable-v1');
  const instructions = client.getInstructions();
  assert.equal(instructions, STABLE_INSTRUCTIONS);
  assert.equal(Buffer.byteLength(JSON.stringify(instructions), 'utf8'), 371);
  const names = (await client.listTools()).tools.map((item) => item.name);
  assert.equal(names.length, 53);
  assert.equal(names[2], 'check_connection');
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
    'create_device_alternates', 'keep_device_alternate', 'inspect_devices', 'set_parameter', 'compose_device_sources',
    'check_connection', 'add_track', 'copy_track']) {
    assert.equal(names.includes(retired), false, retired);
  }
});
