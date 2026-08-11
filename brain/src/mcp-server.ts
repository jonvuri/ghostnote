/**
 * The MCP server — the process an agent actually talks to.
 *
 * ⚠ **This process holds the bridge connection.** There is no daemon (D4 rev) —
 * see `session.ts` for which of `ghostnoted`'s three jobs each went where, and
 * for why "ordered is not coherent" replaced standing rule 7.
 *
 * ⚠ What changed in session 3d is everything above the connection. This file used
 * to register two tools by hand and was *"deliberately still two"*, because the
 * real surface is D18c/D20 work and widening it early would have frozen a v0
 * vocabulary the moment before the vocabulary was designed. That vocabulary now
 * exists: `surface/tools.ts` holds the tools as data — partitioned into reading,
 * writing and destroying by NAME, which is the grain a host's permission
 * allow-list keys on (E20c) — and this file is the three lines that put them on a
 * transport.
 *
 * ⚠ The engine is reached only through `surface/workspace.ts`, which is what makes
 * "every batch that applied is recorded" a property of the code rather than a
 * habit: no tool can see an executor to go around it.
 *
 * ⚠ stdio transport uses STDOUT for JSON-RPC — this file must never write to
 * stdout (no console.log). Diagnostics go to stderr only. `surface.test.ts`
 * asserts it for the whole surface, because the failure it produces is a
 * transport that dies with no message at all.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { Session } from './session.js';
import { registerTools } from './surface/tools.js';
import { workspaceOf } from './surface/workspace.js';

const session = new Session();

const server = new McpServer({ name: 'ghostnote', version: '0.0.1' });

registerTools(server, workspaceOf({
  ready: async () => {
    await session.ready();
  },
  // ⚠ Getters, not values. `Session` throws its adapter and executor away when it
  // reconnects onto a different life of the extension, and a workspace holding
  // the old ones would go on writing through handles whose every index names a
  // track that is no longer there.
  get adapter() {
    return session.bitwig;
  },
  get executor() {
    return session.executor;
  },
  stash: session.stash,
}));

const transport = new StdioServerTransport();
await server.connect(transport);
