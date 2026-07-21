/**
 * E9 — minimal MCP server over the ghostnote bridge (SPIKE_PLAN §4, last probe).
 *
 * Two tools, both backed by `client.ts` (via lib.ts, which wraps it):
 *   - `ping`       — round-trips a ping through the Bitwig bridge.
 *   - `read_notes` — points a pool cursor at (trackIndex, slotIndex) and reads
 *                    the clip's notes.
 *
 * Pure Phase-1 wiring de-risk: does the TS MCP SDK sit cleanly on top of the
 * bridge client? Speaks MCP over stdio, so it can be registered as a Claude
 * Code MCP server OR driven by the e09 probe (an MCP client over stdio).
 *
 * ⚠ stdio transport uses STDOUT for JSON-RPC — this file must never write to
 * stdout (no console.log). Diagnostics go to stderr only.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { client, point, getNotes, type Note } from './probes/lib.js';

const server = new McpServer({ name: 'ghostnote', version: '0.0.1' });

server.registerTool(
  'ping',
  {
    title: 'Ping the ghostnote bridge',
    description:
      'Round-trip a ping through the Bitwig bridge. Returns pong plus the '
      + 'control-surface thread name — confirms the extension is live.',
    inputSchema: {},
  },
  async () => {
    const res = (await client.request('ping')) as { pong: boolean; thread: string };
    return { content: [{ type: 'text', text: JSON.stringify(res) }] };
  },
);

server.registerTool(
  'read_notes',
  {
    title: 'Read notes from a clip',
    description:
      'Point a pool cursor at (trackIndex, slotIndex) and read the clip\'s '
      + 'notes as [x, y, velocity, duration] tuples.',
    inputSchema: {
      trackIndex: z.number().int().describe('Bank index of the track'),
      slotIndex: z.number().int().default(0).describe('Scene/slot index (default 0)'),
    },
  },
  async ({ trackIndex, slotIndex }) => {
    const slot = slotIndex ?? 0;
    const p = await point('0', trackIndex, slot, 'trackThenSlot');
    const notes: Note[] = p.ok ? await getNotes('0') : [];
    return {
      content: [{ type: 'text', text: JSON.stringify({ trackIndex, slotIndex: slot, pointed: p.ok, notes }) }],
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
