// Read-only Ghostworks inventory refresh for the R01 pilot. It calls the
// Ghostworks MCP server's list_shard_assets (discovery metadata only) over
// stdio and saves the reply; it opens no MIDI or audio file.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function listShardAssets(command, args = [], options = {}) {
  const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'inherit'], ...options });
  let buffer = '', nextId = 1;
  const pending = new Map();
  child.stdout.on('data', chunk => {
    buffer += chunk;
    for (let index; (index = buffer.indexOf('\n')) >= 0;) {
      const line = buffer.slice(0, index).trim(); buffer = buffer.slice(index + 1);
      if (!line) continue;
      const message = JSON.parse(line);
      if (message.id !== undefined && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); }
    }
  });
  const request = (method, params) => new Promise((resolveReply, reject) => {
    const id = nextId++;
    pending.set(id, message => message.error ? reject(new Error(JSON.stringify(message.error))) : resolveReply(message.result));
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
  try {
    const init = await request('initialize', { protocolVersion: '2025-06-18', capabilities: {},
      clientInfo: { name: 'r01-pilot-inventory', version: '1' } });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
    const result = await request('tools/call', { name: 'list_shard_assets', arguments: {} });
    assert(!result.isError, `list_shard_assets failed: ${JSON.stringify(result.content)}`);
    return { server: init.serverInfo, reply: JSON.parse(result.content.find(c => c.type === 'text').text) };
  } finally { child.kill(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [launcher, output] = process.argv.slice(2);
  assert(launcher && output && !existsSync(resolve(output)), 'usage: node pilot-inventory.mjs GHOSTWORKS_MCP_LAUNCHER NEW_OUTPUT_JSON');
  const { server, reply } = await listShardAssets(launcher);
  const text = JSON.stringify({ schema: 'r01-pilot-inventory-raw-v1', capturedAt: new Date().toISOString(),
    tool: 'list_shard_assets', arguments: {}, server, reply }) + '\n';
  writeFileSync(resolve(output), text);
  const midi = reply.assets.filter(a => a.kind === 'midi');
  console.log(JSON.stringify({ sha256: createHash('sha256').update(text).digest('hex'), assets: reply.assets.length, midi: midi.length,
    shards: new Set(reply.assets.map(a => a.shardId)).size }));
}
