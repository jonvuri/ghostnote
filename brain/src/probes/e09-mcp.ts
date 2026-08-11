/**
 * E9 — MCP smoke test (SPIKE_PLAN §4, last & cheap).
 *
 * Q: any surprises wiring the TS MCP SDK over the bridge?
 * Method: spawn the MCP server (src/mcp-server.ts) over stdio as an MCP CLIENT
 * (the same transport Claude Code uses), list its tools, and call two of them.
 * If it "just works", the MCP layer sits cleanly on client.ts and nothing
 * architectural is in the way.
 *
 * ⚠ Re-pointed in session 3d, which replaced the two hand-written tools with the
 * real surface: `ping` became `check_connection` and `read_notes` became
 * `read_clip`. E9's question is unchanged; the names and the reply shapes moved.
 * ⚠ One assertion is WEAKER by construction: `ping` returned the control-surface
 * thread name, and `check_connection` reports where the world is instead — the
 * round trip is still proven (the reply comes off the extension over the bridge),
 * the thread name is no longer on the surface, because an agent has no use for it.
 *
 * ⚠⚠ And one is STRONGER, after a real failure. Check C asserted a hard-coded
 * fingerprint in gn-A row 0; run against `gn-scale-test` on 2026-08-10 it failed,
 * because that slot holds a 16-note chromatic run another probe wrote. Nothing
 * guarantees that clip's CONTENTS — `ensureFixtureTracks` guarantees the slot
 * holds *a* clip and never writes a note into it — so the check was a claim about
 * one project. It now compares the MCP layer's answer against a DIRECT adapter
 * read of the same address, which is both project-independent and a sharper
 * question: does anything change on the way through?
 *
 * ⚠ Every tool called here is a READ tool. The write surface is not exercised
 * against a live project by this probe: the offline suite covers it end to end
 * (`surface/surface.test.ts`), and a smoke test is not the place to find out what
 * a write does to somebody's music.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import {
  client as bridge, check, note, failureCount, ensureFixtureTracks,
} from './lib.js';
import { LiveAdapter } from '../adapters/live/adapter.js';
import { BridgeTransport } from '../adapters/live/transport.js';
import {
  addressKey, clip, notes as notesAt, scene, slot, track, type NoteRecord,
} from '../contract/index.js';

// -- setup: resolve the gn-A fixture via the bridge directly.
//
// Phase 0: mcp-server.ts was re-pointed off probes/lib.ts onto the adapter
// contract, so the read tool addresses a track by its durable channelId (the
// only key that survives a rename or an index shift, E2f) and returns
// beats-native note records instead of raw [x, y, vel, dur] tuples. E9's actual
// question — does the TS MCP SDK sit cleanly over the bridge? — is unchanged.
await bridge.connect();
const { trackA } = await ensureFixtureTracks();
const { tracks } = (await bridge.request('track.list')) as {
  tracks: { index: number; channelId: string }[];
};
const channelId = tracks.find((t) => t.index === trackA)?.channelId;
if (!channelId) throw new Error(`gn-A at index ${trackA} has no channelId`);

// ⚠⚠ Read the SAME address directly, before the MCP server is even spawned, and
// keep it to compare against.
//
// This replaces an assertion on a hard-coded fingerprint — *gn-A row 0 holds
// [beat 0, pitch 60, velocity 100, duration 1]* — which failed on 2026-08-10
// against `gn-scale-test`, where that slot holds a 16-note chromatic run some
// other probe wrote. ⚠ The failure was real and the assertion was wrong: nothing
// guarantees that clip's CONTENTS. `ensureFixtureTracks` guarantees the slot
// holds *a* clip and never writes a note into it, so the fingerprint was a claim
// about one project rather than about the transport, and E9's question is about
// the transport.
//
// ⚠ Comparing the two reads is also a STRONGER check than the fingerprint was:
// it proves the MCP layer changes nothing on the way through, in any project,
// including properties no fixture would have thought to carry.
const directAdapter = new LiveAdapter({ transport: new BridgeTransport(bridge) });
await directAdapter.hello();
const at = await directAdapter.revision();
const fixtureClip = clip(slot(track(channelId), scene(0, at.sceneEpoch)));
const fixtureNotes = notesAt(fixtureClip, 0);
const directSnapshot = await directAdapter.read([fixtureClip, fixtureNotes]);
const directEntry = directSnapshot.entries[addressKey(fixtureNotes)];
const direct: readonly NoteRecord[] = directEntry?.value.of === 'notes' ? directEntry.value.notes : [];
const directClip = directSnapshot.entries[addressKey(fixtureClip)]?.value;
bridge.disconnect();
console.log(`gn-A resolved at track index ${trackA} (channelId ${channelId})`);
console.log(`read directly: ${direct.length} note(s) in row 0\n`);

/** Order is the adapter's business, not the clip's — compare as a set. */
const canonical = (ns: readonly NoteRecord[]): string => JSON.stringify(
  [...ns].sort((x, y) => x.startBeats - y.startBeats || x.pitch - y.pitch),
);

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
check('the MCP server exposes the read surface',
  toolNames.includes('check_connection') && toolNames.includes('read_clip'), { toolNames });
// ⚠ The partition itself is asserted offline, against every registered tool
// (`surface.test.ts` T-partition). What is worth checking HERE is that it
// survives the transport: the annotations are what a host would read, and a
// serializer that dropped them would be invisible to an in-process test.
const destructive = tools.filter((t) => t.annotations?.destructiveHint === true).map((t) => t.name);
const readOnly = tools.filter((t) => t.annotations?.readOnlyHint === true).map((t) => t.name);
note(`read-only over the wire: [${readOnly.sort().join(', ')}]`);
note(`destructive over the wire: [${destructive.sort().join(', ')}]`);
check('annotations survive the MCP transport, and the two sets are disjoint',
  destructive.length > 0 && readOnly.length > 0
    && destructive.every((n) => !readOnly.includes(n)),
  { destructive, readOnly });

// -- B. the connection check round-trips through the bridge via the MCP layer.
console.log('\n-- B. tools/call check_connection');
const pingRes = parse(await mcp.callTool({ name: 'check_connection', arguments: {} })) as
  { reachable?: boolean; project?: string | null; refused?: boolean };
note(`check_connection -> ${JSON.stringify(pingRes)}`);
check('the connection check round-trips through the bridge and names the open project',
  pingRes.reachable === true && typeof pingRes.project === 'string', pingRes);

// -- C. read_clip returns, through the MCP layer, exactly what the adapter read.
console.log('\n-- C. tools/call read_clip on gn-A row 0');
const readRes = parse(await mcp.callTool({
  name: 'read_clip',
  arguments: { trackId: channelId, row: 0 },
})) as { readable?: boolean; clipExists?: boolean; notes: NoteRecord[] };
note(`read_clip -> clipExists=${readRes.clipExists}, ${(readRes.notes ?? []).length} note(s)`);
check('read_clip finds the clip the direct read found',
  readRes.clipExists === (directClip?.of === 'clip' && directClip.exists),
  { throughMcp: readRes.clipExists, direct: directClip });
// ⚠ The real check: byte-for-byte the same notes, through two different routes
// to the same slot. A transport that dropped a property, rounded a beat or
// re-ordered a reply fails here in any project — which the fingerprint it
// replaces could only do in one.
check('the MCP layer changes NOTHING: its notes equal a direct adapter read',
  canonical(readRes.notes ?? []) === canonical(direct),
  { throughMcp: readRes.notes, direct });
note(`${direct.length} note(s) compared, property for property`);

note('=> the TS MCP SDK sits cleanly on client.ts: stdio transport, tool');
note('   registration, and both tool calls work with no bridge-side changes.');

await mcp.close();
console.log(failureCount() === 0 ? '\nE9: all checks passed' : `\nE9: ${failureCount()} FAILURES`);
process.exit(failureCount() === 0 ? 0 : 1);
