/**
 * E9 — MCP smoke test (SPIKE_PLAN §4, last & cheap).
 *
 * Q: any surprises wiring the TS MCP SDK over the bridge?
 * Method: spawn the minimal MCP server (src/mcp-server.ts) over stdio as an
 * MCP CLIENT (the same transport Claude Code uses), list its tools, and call
 * both `ping` and `read_notes`. If it "just works", the MCP layer sits cleanly
 * on client.ts and nothing architectural is in the way.
 *
 * Fixtures are read-only here (read_notes points a cursor and reads); the gn-A
 * slot-0 fingerprint is left untouched.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import {
  client as bridge, check, note, failureCount, ensureFixtureTracks,
} from './lib.js';
import type { NoteRecord } from '../contract/index.js';

// -- setup: resolve the gn-A fixture via the bridge directly.
//
// Phase 0: mcp-server.ts was re-pointed off probes/lib.ts onto the adapter
// contract, so `read_notes` now addresses a track by its durable channelId (the
// only key that survives a rename or an index shift, E2f) and returns
// beats-native note records instead of raw [x, y, vel, dur] tuples. E9's actual
// question — does the TS MCP SDK sit cleanly over the bridge? — is unchanged,
// and so are the assertions below.
await bridge.connect();
const { trackA } = await ensureFixtureTracks();
const { tracks } = (await bridge.request('track.list')) as {
  tracks: { index: number; channelId: string }[];
};
const channelId = tracks.find((t) => t.index === trackA)?.channelId;
if (!channelId) throw new Error(`gn-A at index ${trackA} has no channelId`);
bridge.disconnect();
console.log(`gn-A resolved at track index ${trackA} (channelId ${channelId})\n`);

// -- spawn the MCP server as a subprocess and connect as an MCP client.
const transport = new StdioClientTransport({
  command: 'npx',
  args: ['tsx', 'src/mcp-server.ts'],
});
const mcp = new Client({ name: 'e09-probe', version: '0.0.1' });
await mcp.connect(transport);
console.log('connected to MCP server over stdio\n');

const parse = (res: unknown): unknown => {
  const content = (res as { content?: { type: string; text?: string }[] }).content ?? [];
  const text = content.find((c) => c.type === 'text')?.text ?? '{}';
  return JSON.parse(text);
};

// -- A. discovery: the SDK enumerates the tools we registered.
console.log('-- A. tools/list');
const { tools } = await mcp.listTools();
const toolNames = tools.map((t) => t.name).sort();
note(`tools: [${toolNames.join(', ')}]`);
check('the MCP server exposes ping and read_notes',
  toolNames.includes('ping') && toolNames.includes('read_notes'), { toolNames });

// -- B. ping round-trips through the bridge via the MCP layer.
console.log('\n-- B. tools/call ping');
const pingRes = parse(await mcp.callTool({ name: 'ping', arguments: {} })) as
  { pong: boolean; thread: string };
note(`ping -> ${JSON.stringify(pingRes)}`);
check('ping round-trips through the bridge (pong=true, control-surface thread)',
  pingRes.pong === true && /Control Surface/i.test(pingRes.thread ?? ''), pingRes);

// -- C. read_notes returns the gn-A slot-0 fixture note via client.ts.
console.log('\n-- C. tools/call read_notes on gn-A slot 0');
const readRes = parse(await mcp.callTool({
  name: 'read_notes',
  arguments: { channelId, sceneIndex: 0 },
})) as { found: boolean; fidelity?: string; notes: NoteRecord[] };
note(`read_notes -> found=${readRes.found}, notes=${JSON.stringify(readRes.notes)}`);
// The gn-A slot-0 fingerprint is [x=0, y=60, vel=100, dur=1] on a 0.25 grid,
// which the contract reports as beat 0, pitch 60, velocity 100, duration 1.
const hasFp = readRes.notes.some(
  (n) => n.startBeats === 0 && n.pitch === 60 && n.velocity === 100 && n.durationBeats === 1,
);
check('read_notes returns the gn-A slot-0 fingerprint through the MCP layer',
  readRes.found && hasFp, { notes: readRes.notes });

note('=> the TS MCP SDK sits cleanly on client.ts: stdio transport, tool');
note('   registration, and both tool calls work with no bridge-side changes.');

await mcp.close();
console.log(failureCount() === 0 ? '\nE9: all checks passed' : `\nE9: ${failureCount()} FAILURES`);
process.exit(failureCount() === 0 ? 0 : 1);
