/**
 * B19 session 2 live check: `slot.occupancy` and `list_launcher_slots` against the open project. Read-only.
 *
 * 1. Build: the normal profile carries `slot.occupancy` (golden count and hash) and the `rig.info` marker.
 * 2. Cost: `REPS` sequential raw `slot.occupancy` calls (wall time, reply bytes, `scanMicros`), and the same number
 *    of `list_launcher_slots` tool calls.
 * 3. Agreement: one `slot.status` for every bank slot of every listed track, inside the scene window, sent in
 *    concurrent chunks between two marks that must show no content or scene event. The occupied set must equal
 *    the listing; the tool's rows must equal the raw listing; the tool's tracks must equal `list_tracks`.
 * 4. Reference: `SEQUENTIAL` single `slot.status` calls in sequence, the brain-only route the brief estimated at one
 *    turn each.
 *
 *   b19-slot-occupancy-live.ts <expected project name> [reps, default 20] [sequential, default 48]
 */
import assert from 'node:assert/strict';
import { LiveAdapter } from '../adapters/live/adapter.js';
import { Executor } from '../engine/executor.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { AGENT_NATIVE_TOOL_PROFILE, callTool } from '../surface/tools.js';
import { workspaceOf } from '../surface/workspace.js';
import { readGolden } from '../tools/wire-golden.js';
import { WireTransport, type Call } from './phase8h3c-promotion.js';

type Wire = Record<string, any>;
const [expectedProject, repsArg, sequentialArg] = process.argv.slice(2);
if (expectedProject === undefined) throw new Error('Usage: b19-slot-occupancy-live.ts <expected project name> [reps] [sequential]');
const REPS = Number(repsArg ?? 20);
const SEQUENTIAL = Number(sequentialArg ?? 48);
const CHUNK = 64;
const golden = readGolden();

const transport = new WireTransport();
const adapter = new LiveAdapter({ transport, expectRuntimeProfile: golden.identity, expectMethodsHash: golden.methodsHash });
const workspace = workspaceOf({
  ready: async () => undefined, adapter, stash: new Stash(), executor: new Executor(adapter),
  observationStore: new FakeObservationStore(),
});
const raw = async (method: string, params?: Wire, owned?: Call[]): Promise<Wire> =>
  await transport.sendRecorded({ method, ...(params ? { params } : {}) }, owned) as Wire;
const tool = async (name: string): Promise<Wire> => {
  const result = await callTool(workspace, name, {}, AGENT_NATIVE_TOOL_PROFILE) as Wire;
  if (result.failure !== undefined) throw new Error(`${name}: ${JSON.stringify(result.failure).slice(0, 800)}`);
  return result;
};
const stats = (values: readonly number[]): Wire => {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (q: number): number => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;
  const round = (n: number): number => Math.round(n * 10) / 10;
  return { n: sorted.length, min: round(sorted[0]!), median: round(at(0.5)), p90: round(at(0.9)), max: round(sorted.at(-1)!) };
};
const markOf = (r: Wire): string => JSON.stringify([r.generation, r.project, r.contentEpoch, r.sceneEpoch, r.sceneCount]);

const hello = await raw('contract.hello');
assert.deepEqual([hello['runtimeProfile'], hello['methodCount'], hello['methodsHash']],
  [golden.identity, golden.count, golden.methodsHash], 'normal build with slot.occupancy');
const info = await raw('rig.info');
assert.equal(typeof info['slotOccupancy'], 'string', 'B19 build marker');
await adapter.hello();
const connection = await tool('check_bitwig_connection');
const project = connection.data?.project;
assert.equal(project, expectedProject, `foreground project is ${project}`);
console.error(JSON.stringify({ step: 'entry', project, build: [hello['runtimeProfile'], hello['methodCount'],
  hello['methodsHash']], marker: info['slotOccupancy'], bank: [info['tracks'], info['scenes']] }));

// 2. Cost of the raw call and of the tool.
const rawCalls: Call[] = [];
let listing: Wire = {};
for (let i = 0; i < REPS; i++) listing = await raw('slot.occupancy', undefined, rawCalls);
const tracks = listing.tracks as Wire[];
const occupiedCount = tracks.reduce((sum, t) => sum + (t.occupied as number[]).length, 0);
const toolMs: number[] = [];
const toolBytes: number[] = [];
let toolResult: Wire = {};
for (let i = 0; i < REPS; i++) {
  const started = performance.now();
  toolResult = await tool('list_launcher_slots');
  toolMs.push(performance.now() - started);
  toolBytes.push(Buffer.byteLength(JSON.stringify(toolResult)));
}
const cost = {
  raw: { ms: stats(rawCalls.map((c) => c.received - c.sent)), bytes: stats(rawCalls.map((c) => c.bytes)),
    scanMicros: stats(rawCalls.map((c) => Number(c.reply.result?.scanMicros))) },
  tool: { ms: stats(toolMs), bytes: stats(toolBytes) },
};
console.error(JSON.stringify({ step: 'cost', tracks: tracks.length, occupied: occupiedCount, ...cost }));

// 3. Agreement with slot.status, bracketed by two marks with no event between.
const sceneCount = Math.min(Number(listing.sceneCount), Number(listing.sceneBankSize));
const before = await raw('revision.get');
const cells = tracks.flatMap((t) => Array.from({ length: sceneCount }, (_, scene) => [t.index as number, scene] as const));
const statusCalls: Call[] = [];
const statuses: Wire[] = [];
const agreementStarted = performance.now();
for (let i = 0; i < cells.length; i += CHUNK) {
  statuses.push(...await Promise.all(cells.slice(i, i + CHUNK).map(([trackIndex, slotIndex]) =>
    raw('slot.status', { trackIndex, slotIndex }, statusCalls))));
}
const agreementMs = performance.now() - agreementStarted;
const after = await raw('revision.get');
const fresh = await raw('slot.occupancy');
assert.equal(markOf(after), markOf(before), 'no launcher or scene event during the comparison');
assert.equal(markOf(fresh), markOf(before), 'the comparison listing is at the same mark');
const byStatus = new Map<number, number[]>();
cells.forEach(([trackIndex, scene], k) => {
  if (statuses[k]!.hasContent === true) byStatus.set(trackIndex, [...(byStatus.get(trackIndex) ?? []), scene]);
});
const mismatches = (fresh.tracks as Wire[]).flatMap((t) => {
  const expected = JSON.stringify(byStatus.get(t.index) ?? []);
  return JSON.stringify(t.occupied) === expected ? [] : [{ index: t.index, name: t.name, listed: t.occupied, status: expected }];
});
assert.deepEqual(mismatches, [], 'slot.occupancy equals slot.status for every slot');

const listed = await tool('list_tracks');
const rawById = new Map((fresh.tracks as Wire[]).map((t) => [t.channelId as string, t]));
const toolTracks = toolResult.data.tracks as Wire[];
assert.deepEqual(toolTracks.map((t) => t.trackId), (listed.data.tracks as Wire[]).map((t) => t.trackId),
  'list_launcher_slots lists the list_tracks tracks in order');
for (const t of toolTracks) {
  if (t.group === true) assert.equal(t.occupiedRows, undefined, `${t.name}: a group lists no rows`);
  else assert.deepEqual(t.occupiedRows, rawById.get(t.trackId)!.occupied, `${t.name}: tool rows equal the raw listing`);
}
const groups = toolTracks.filter((t) => t.group === true).map((t) => ({ name: t.name,
  observedRows: rawById.get(t.trackId)!.occupied }));
console.error(JSON.stringify({ step: 'agreement', slots: cells.length, concurrentChunk: CHUNK,
  ms: Math.round(agreementMs), mismatches: 0, groups }));

// 4. The brain-only reference: single slot.status calls in sequence.
const sequentialCalls: Call[] = [];
const sequentialStarted = performance.now();
for (const [trackIndex, slotIndex] of cells.slice(0, SEQUENTIAL)) await raw('slot.status', { trackIndex, slotIndex }, sequentialCalls);
const sequentialMs = performance.now() - sequentialStarted;
console.error(JSON.stringify({ step: 'sequential', n: sequentialCalls.length, ms: Math.round(sequentialMs),
  perCall: stats(sequentialCalls.map((c) => c.received - c.sent)) }));

console.log(JSON.stringify({ version: 'b19-slot-occupancy-v1', date: new Date().toISOString(),
  build: { profile: hello['runtimeProfile'], methods: hello['methodCount'], hash: hello['methodsHash'],
    marker: info['slotOccupancy'], bank: { tracks: info['tracks'], scenes: info['scenes'] } },
  project, tracks: tracks.length, groups: groups.length, sceneCount, occupied: occupiedCount,
  coverage: toolResult.coverage, cost,
  agreement: { slots: cells.length, chunk: CHUNK, ms: Math.round(agreementMs), mismatches: 0, mark: JSON.parse(markOf(after)) },
  sequential: { n: sequentialCalls.length, ms: Math.round(sequentialMs),
    perCall: stats(sequentialCalls.map((c) => c.received - c.sent)) },
  sample: toolTracks.slice(0, 6) }, null, 2));
await transport.close?.();
