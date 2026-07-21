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
  client as bridge, check, note, failureCount, ensureFixtureTracks, type Note,
} from './lib.js';

// -- setup: resolve the gn-A fixture track index via the bridge directly.
await bridge.connect();
const { trackA } = await ensureFixtureTracks();
bridge.disconnect();
console.log(`gn-A resolved at track index ${trackA}\n`);

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
  arguments: { trackIndex: trackA, slotIndex: 0 },
})) as { pointed: boolean; notes: Note[] };
note(`read_notes -> pointed=${readRes.pointed}, notes=${JSON.stringify(readRes.notes)}`);
const fp: Note = [0, 60, 100, 1];
const hasFp = readRes.notes.some((n) => n.join(',') === fp.join(','));
check('read_notes returns the gn-A slot-0 fingerprint through the MCP layer',
  readRes.pointed && hasFp, { notes: readRes.notes });

note('=> the TS MCP SDK sits cleanly on client.ts: stdio transport, tool');
note('   registration, and both tool calls work with no bridge-side changes.');

await mcp.close();
console.log(failureCount() === 0 ? '\nE9: all checks passed' : `\nE9: ${failureCount()} FAILURES`);
process.exit(failureCount() === 0 ? 0 : 1);
