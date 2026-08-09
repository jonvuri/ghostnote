/**
 * A minimal MCP server over the ghostnote bridge (E9 originally; re-pointed onto
 * the adapter contract in Phase 0).
 *
 * ⚠ **This process holds the bridge connection.** There is no daemon (D4 rev) —
 * see `session.ts` for which of `ghostnoted`'s three jobs each went where, and
 * for why "ordered is not coherent" replaced standing rule 7. What changed HERE
 * in session 3 is the lifecycle: the connection is opened lazily, handshaken on
 * every reconnect, and everything index-shaped is thrown away when the extension
 * turns out to be a different life of itself.
 *
 * Two tools, deliberately still two. The real tool surface is D18c/D20 work —
 * versioned descriptions in fresh, jargon-free language, with destructive verbs
 * on their own annotated surface — and it belongs to the branch-mechanisms
 * session, not to this one. Widening it here would freeze a v0 vocabulary the
 * moment before the vocabulary is designed.
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

import { WIRE } from './adapters/live/wiremap.js';
import { addressKey, clip, notes, scene, slot, track } from './contract/index.js';
import { Session } from './session.js';

const session = new Session();

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
    const { generation, restarted } = await session.ready();
    const res = (await session.client.request(WIRE.ping)) as { pong: boolean; thread: string };
    return { content: [{ type: 'text', text: JSON.stringify({ ...res, generation, restarted }) }] };
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
    // ⚠ The epoch is READ, never remembered. It comes off an observer in the
    // extension that sees the user's scene ops as well as ours (session 3), so
    // an address minted here is minted against the world as it is — and a scene
    // op between this call and the next one makes the address refusable rather
    // than silently wrong (E3).
    const { sceneEpoch, contentEpoch, generation } = await session.mark();
    const address = notes(clip(slot(track(channelId), scene(index, sceneEpoch))));
    const snapshot = await session.bitwig.read([address]);
    const entry = snapshot.entries[addressKey(address)];
    const found = entry?.value.of === 'notes' ? entry.value.notes : [];
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          channelId,
          sceneIndex: index,
          // ⚠ Returned so a caller can baseline on it. Both epochs are
          // meaningless as absolutes and only a DIFFERENCE across a known event
          // carries information — the generation is what makes that difference
          // honest across a Bitwig restart.
          at: { sceneEpoch, contentEpoch, generation },
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
