/**
 * E20c — do MCP tool annotations reach a host, and does the host act on them?
 *
 * ⚠⚠ **D20's stop-and-ask is currently a spec reading.** Destructive verbs get
 * their own annotated tool surface (`destructiveHint`; read tools carry
 * `readOnlyHint`) and *"the host's permission flow is the stop-and-ask"* — with
 * ⚠ nothing inside our system gating a directed destructive call. D20 says so
 * itself and names verification as a Phase-1 early item. This is that item.
 *
 * **Two arms, and only the second one answers the question.**
 *
 *     npm run probe:e20c     ARM A — autonomous. Do the annotations survive OUR
 *                            wire, exactly as written? Runs with Bitwig closed.
 *     (by hand)              ARM B — the operator registers the scratch server in
 *                            Claude Code, calls each tool, and records what the
 *                            host did. See §ARM B below.
 *
 * ⚠ **Arm A cannot be skipped and cannot substitute for arm B.** It establishes
 * that we emit what we think we emit — without which a host that did nothing
 * would be indistinguishable from a server that sent nothing, and the ○ would be
 * recorded against the wrong component. That is the E17 method trap (a ○ from a
 * mechanism whose precondition was never checked) in its cheapest form.
 *
 * ⚠⚠ **A ○ IS AN EXPECTED OUTCOME AND IS NOT A FAILED PROBE.** Claude Code's
 * permission model gates on tool NAME. If annotations turn out to change nothing,
 * D20's seam still stands — the destructive verbs live on separately-NAMED tools,
 * which is what the host actually gates — but D20's sentence needs amending from
 * *"the host prompts because of the annotation"* to *"...because of the separate
 * names"*. That is a proposed amendment for the operator under standing rule 10,
 * not a defect to fix here.
 *
 * Touches no DAW, holds no bridge connection, and destroys nothing.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// ⚠ `e20c-server.ts` is deliberately NOT imported. Its module body connects a
// stdio transport on import, so pulling a constant out of it would start a
// second MCP server on this probe's own stdin/stdout. The scratch log's path is
// obtained the way any client would obtain it — by calling `gn_probe_read`,
// which is also the only use the read-only tool has here.
import { check, note, failureCount } from './lib.js';

interface Annotations {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

const SERVER = join(import.meta.dirname, 'e20c-server.ts');

// ⚠ Spawned as a subprocess over stdio — the same transport Claude Code uses
// (E9). Arm A is only worth anything if it travels the path arm B will travel.
const transport = new StdioClientTransport({ command: 'npx', args: ['tsx', SERVER] });
const mcp = new Client({ name: 'e20c-probe', version: '0.0.1' });
await mcp.connect(transport);

const { tools } = await mcp.listTools();
const byName = new Map(tools.map((t) => [t.name, t]));
const annotationsOf = (name: string): Annotations =>
  (byName.get(name)?.annotations ?? {}) as Annotations;

console.log('-- ARM A. do the annotations survive tools/list?');
note(`tools: [${tools.map((t) => t.name).sort().join(', ')}]`);

check('E20c-A1: all four probe tools are discoverable',
  ['gn_probe_read', 'gn_probe_write', 'gn_probe_destroy', 'gn_probe_destroy_idempotent']
    .every((n) => byName.has(n)),
  { got: tools.map((t) => t.name) });

// ⚠ The BASELINE first. If this carried annotations, every comparison below
// would be against a moving reference.
check('E20c-A2: the control tool carries NO annotations',
  byName.get('gn_probe_write')?.annotations === undefined,
  byName.get('gn_probe_write')?.annotations);

check('E20c-A3: readOnlyHint survives the wire',
  annotationsOf('gn_probe_read').readOnlyHint === true
  && annotationsOf('gn_probe_read').destructiveHint === false,
  annotationsOf('gn_probe_read'));

// ⚠⚠ The one D20 rests on, asserted field by field rather than as "annotations
// exist": a host reads the FIELD, and an object that arrived with the wrong one
// set would still be truthy.
check('E20c-A4: destructiveHint survives the wire, with readOnlyHint explicitly false',
  annotationsOf('gn_probe_destroy').destructiveHint === true
  && annotationsOf('gn_probe_destroy').readOnlyHint === false,
  annotationsOf('gn_probe_destroy'));

check('E20c-A5: destructiveHint and idempotentHint travel together',
  annotationsOf('gn_probe_destroy_idempotent').destructiveHint === true
  && annotationsOf('gn_probe_destroy_idempotent').idempotentHint === true,
  annotationsOf('gn_probe_destroy_idempotent'));

// ⚠ Calling one proves the tools work at all, so that a silent arm B cannot be
// blamed on a broken server. The annotated tool is deliberately the one called:
// if a CLIENT ever refused to invoke a destructive tool without confirmation,
// this is where that would show up.
console.log('\n-- ARM A. and a call still works, so arm B can blame the host');
const textOf = (res: unknown): string =>
  ((res as { content?: { type: string; text?: string }[] }).content ?? [])
    .find((c) => c.type === 'text')?.text ?? '';

const callLog = textOf(await mcp.callTool({ name: 'gn_probe_read', arguments: {} })).trim();
const called = await mcp.callTool({ name: 'gn_probe_destroy', arguments: { target: 'arm-A' } });
const text = textOf(called);
check('E20c-A6: the destructive-annotated tool is callable and logs its call',
  text.includes('pretend-delete arm-A'), text);
// ⚠ Read from disk, not from the reply. The reply is the server telling us what
// it did; the file is the side effect actually landing — standing rule 1, in the
// one place in this probe where a readback exists at all.
let onDisk = '';
try {
  onDisk = readFileSync(callLog, 'utf8');
} catch { /* reported by the check below */ }
check('E20c-A7: the side effect is observable independently of the reply',
  onDisk.includes('pretend-delete arm-A'), { log: callLog });

await mcp.close();

console.log(`
-- ARM B. ⚠ THE ACTUAL QUESTION, and it needs the operator.

   Arm A proves only that we EMIT the annotations. Whether Claude Code does
   anything with them cannot be measured from inside a test.

     1. claude mcp add gn-annotation-probe -- npx tsx ${SERVER}
     2. In a Claude Code session, call all four tools, in this order:
          gn_probe_write                (⚠ the unannotated BASELINE — first, so
                                         the others are compared against it)
          gn_probe_read                 readOnlyHint
          gn_probe_destroy              ⚠⚠ destructiveHint — the one D20 rests on
          gn_probe_destroy_idempotent   destructiveHint + idempotentHint
     3. For EACH, record: was there a prompt at all? did the prompt TEXT or its
        allow-once / allow-always options differ from the baseline's? was the
        tool auto-approved by an existing rule?
     4. claude mcp remove gn-annotation-probe
        ⚠⚠ Do not skip this. A leftover server advertising a 'destroy' tool is
        exactly the surface D20 exists to bound.

   ⚠ Record a NEGATIVE as a finding, not as a failure: if the prompts are
   identical, the host gates on tool NAME and D20's justification needs
   re-wording, not its seam. Either way the answer belongs in FINDINGS E20c and
   the D20 amendment is PROPOSED to the operator, never recorded (rule 10).

   The call log, as independent evidence of what actually ran:
     ${callLog}
`);

console.log(failureCount() === 0 ? 'E20c ARM A: PASS' : `E20c ARM A: ${failureCount()} FAILED`);
process.exit(failureCount() === 0 ? 0 : 1);
