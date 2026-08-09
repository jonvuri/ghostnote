/**
 * E20c — a scratch MCP server whose ONLY purpose is to carry tool annotations.
 *
 * ⚠⚠ **What is actually under test is the HOST, not this file.** D20 puts
 * destructive verbs on their own annotated tool surface and rests the entire
 * stop-and-ask on *"the host's permission flow"* — and D20 says in its own words
 * that this is **a spec reading, not a measurement**, the same epistemic class as
 * `launchWithOptions`. So four tools go out with four different annotation
 * shapes, and the question is what Claude Code does when each is called.
 *
 * ⚠ **Nothing here touches Bitwig.** No bridge connection, no adapter, no
 * session. A destructive-sounding tool that actually destroys something is not
 * needed to find out whether a host prompts, and building one would put a live
 * DAW behind a probe whose whole point is to be called carelessly. The only side
 * effect any of these has is appending a line to a scratch file, which doubles as
 * the evidence that a call the operator did NOT authorise still went through.
 *
 * ⚠ **The names are deliberately probe-flavoured and must not be reused.** D18c
 * requires the real surface to be written from scratch in fresh, jargon-free
 * language for a general-purpose agent, and that naming is session 3d's and 3g's to do.
 * A name minted here would freeze a v0 vocabulary the moment before the
 * vocabulary is designed — so these are prefixed, ugly, and disposable on
 * purpose.
 *
 *     # arm A, autonomous — does the annotation survive OUR wire?
 *     npm run probe:e20c
 *
 *     # arm B, the operator's — does the HOST do anything with it?
 *     claude mcp add gn-annotation-probe -- npx tsx <abs path>/e20c-server.ts
 *     ...call each tool, record what was prompted, then:
 *     claude mcp remove gn-annotation-probe
 *
 * ⚠⚠ **De-register it when the arm is done.** A leftover server advertising a
 * tool called `destroy` is precisely the confused-agent surface D20 exists to
 * bound.
 *
 * ⚠ stdio transport uses STDOUT for JSON-RPC — nothing here may `console.log`.
 */
import { appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

/** The only side effect any tool here has, and the record that a call landed. */
export const CALL_LOG = join(tmpdir(), 'gn-e20c-calls.log');

const record = (tool: string, note: string): string => {
  const line = `${new Date().toISOString()}  ${tool}  ${note}`;
  appendFileSync(CALL_LOG, `${line}\n`, 'utf8');
  return line;
};

const server = new McpServer({ name: 'gn-annotation-probe', version: '0.0.1' });

/**
 * ⚠ The BASELINE, and the reason the other three are interpretable.
 *
 * Unannotated. If the host prompts identically for this and for the
 * `destructiveHint` one, the annotation is doing nothing — and a probe with only
 * annotated tools in it could not tell that from a host that prompts for
 * everything.
 */
server.registerTool(
  'gn_probe_write',
  {
    title: 'Probe: unannotated write',
    description: 'Appends a line to a scratch file. Carries NO annotations — the control.',
    inputSchema: { note: z.string().default('baseline').describe('Text to record') },
  },
  async ({ note }) => ({ content: [{ type: 'text', text: record('gn_probe_write', note ?? '') }] }),
);

server.registerTool(
  'gn_probe_read',
  {
    title: 'Probe: read-only',
    description: 'Reports where the scratch log lives. Annotated readOnlyHint.',
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false },
  },
  async () => ({ content: [{ type: 'text', text: CALL_LOG }] }),
);

/**
 * ⚠⚠ THE ONE D20 RESTS ON. `destructiveHint: true` with `readOnlyHint: false`.
 *
 * It destroys nothing — it appends a line like the others. What is being
 * measured is whether the host treats the CALL differently, so the tool's real
 * behaviour is irrelevant and its harmlessness is a feature.
 */
server.registerTool(
  'gn_probe_destroy',
  {
    title: 'Probe: destructive',
    description:
      'Records a line describing a pretend deletion. Destroys nothing. '
      + 'Annotated destructiveHint — this is the one D20 rests on.',
    inputSchema: { target: z.string().default('nothing').describe('What it would pretend to delete') },
    annotations: { readOnlyHint: false, destructiveHint: true },
  },
  async ({ target }) => ({
    content: [{ type: 'text', text: record('gn_probe_destroy', `pretend-delete ${target ?? ''}`) }],
  }),
);

/**
 * ⚠ Destructive AND idempotent, because the two hints together are a different
 * question: a host might reasonably soften a prompt for a repeatable destructive
 * call. If it does, that is a finding about how much of the seam the host owns.
 */
server.registerTool(
  'gn_probe_destroy_idempotent',
  {
    title: 'Probe: destructive + idempotent',
    description:
      'As gn_probe_destroy, but also annotated idempotentHint — does a host '
      + 'distinguish a repeatable destructive call from a one-way one?',
    inputSchema: { target: z.string().default('nothing').describe('What it would pretend to delete') },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
  },
  async ({ target }) => ({
    content: [{
      type: 'text',
      text: record('gn_probe_destroy_idempotent', `pretend-delete ${target ?? ''}`),
    }],
  }),
);

const transport = new StdioServerTransport();
await server.connect(transport);
