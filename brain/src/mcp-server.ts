/**
 * A minimal MCP server over the ghostnote bridge (E9 originally; re-pointed onto
 * the adapter contract in Phase 0).
 *
 * Two tools, deliberately still two — PHASE-0 puts "any MCP tool surface" out of
 * scope, and Phase 2 is where the real one gets designed against the patch shape.
 * The change here is WHAT IT SITS ON: it used to import helpers from
 * `probes/lib.ts`, which meant a shipping artifact depended on the spike's probe
 * layer. It now goes through `LiveAdapter`, so it exercises the same seam
 * everything else will.
 *
 *   - `ping`       — round-trips a ping through the Bitwig bridge.
 *   - `read_notes` — reads a clip's notes by durable track id (channelId), which
 *                    is the only addressing the contract accepts (E2f).
 *
 * ⚠ stdio transport uses STDOUT for JSON-RPC — this file must never write to
 * stdout (no console.log). Diagnostics go to stderr only.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { LiveAdapter } from './adapters/live/adapter.js';
import { BridgeTransport } from './adapters/live/transport.js';
import { WIRE } from './adapters/live/wiremap.js';
import { BridgeClient } from './client.js';
import { addressKey, clip, notes, scene, slot, track } from './contract/index.js';

const client = new BridgeClient();
const adapter = new LiveAdapter({ transport: new BridgeTransport(client) });

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
    const res = (await client.request(WIRE.ping)) as { pong: boolean; thread: string };
    return { content: [{ type: 'text', text: JSON.stringify(res) }] };
  },
);

server.registerTool(
  'read_notes',
  {
    title: 'Read notes from a clip',
    description:
      'Read a clip\'s notes as beats-native records. The track is addressed by its '
      + 'durable channelId (UUID), which survives renames, index shifts and a '
      + 'project reload — a bank index does not.',
    inputSchema: {
      channelId: z.string().describe('Durable track UUID, from track.list'),
      sceneIndex: z.number().int().default(0).describe('Scene/slot index (default 0)'),
    },
  },
  async ({ channelId, sceneIndex }) => {
    const index = sceneIndex ?? 0;
    const { sceneEpoch } = await adapter.revision();
    const address = notes(clip(slot(track(channelId), scene(index, sceneEpoch))));
    const snapshot = await adapter.read([address]);
    const entry = snapshot.entries[addressKey(address)];
    const found = entry?.value.of === 'notes' ? entry.value.notes : [];
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          channelId,
          sceneIndex: index,
          // A clip that is missing is reported as such rather than as "no notes":
          // an empty result and an absent clip are different facts.
          found: entry !== undefined,
          fidelity: entry?.fidelity,
          notes: found,
        }),
      }],
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
