/**
 * B17 session 1 live check: the product tools on layer containers past position 2 with the scopes owned by the
 * extension (`chain.observe` and the async chain writes; no `chain.scroll`, no brain scope state).
 *
 *   npm run probe:b17-live -- --out NEW_DIRECTORY
 *
 * Runs only against the B17 normal build (NORMAL_B17) on `gn-scale-test`. Repeats the E394 shape so the results
 * compare directly: a scratch track `gn-b17s`, a container composed at position 3 and a second one at position 5,
 * read_devices, the five layer-chain tools, and a cross-container move, the solo read back through the cursor
 * route (D15) and the raw scope inventory, the container read cost at a resting and at a far position for the
 * ledger, and deletion of the scratch track with preserved-state checks. Every step is written to the output
 * directory with the wire exchange of the scope operations and their `aim` reports.
 */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import { LiveAdapter } from '../adapters/live/adapter.js';
import { IdentityRegistry } from '../bindings/identity-registry.js';
import { compareDeployment, deployedAtMs } from '../deploy.js';
import { Executor } from '../engine/executor.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { AGENT_NATIVE_TOOL_PROFILE, callTool } from '../surface/tools.js';
import { workspaceOf } from '../surface/workspace.js';
import { WireTransport } from './phase8h3c-promotion.js';
import { NORMAL_B17 } from './phase8h4f-measure.js';
import { wireSummary } from './phase8h4g-inventory.js';

type Wire = Record<string, any>;
const { values } = parseArgs({ options: { out: { type: 'string' } } });
if (!values.out) throw new Error('required: --out NEW_DIRECTORY');
const output = values.out;
mkdirSync(output, { recursive: false });
const SCRATCH = 'gn-b17s';
const SCOPE_METHODS = new Set(['chain.observe', 'chain.select', 'chain.duplicate', 'chain.setName', 'chain.activate',
  'chain.setSolo', 'chain.move', 'chain.inventory', 'chain.scroll']);
const transport = new WireTransport();
const adapter = new LiveAdapter({ transport });
const workspace = workspaceOf({
  ready: async () => undefined, adapter, stash: new Stash(), executor: new Executor(adapter),
  observationStore: new FakeObservationStore(), documents: new IdentityRegistry(),
});
const started = performance.now();
let sequence = 0;
function record(label: string, value: unknown): void {
  writeFileSync(join(output, `${String(sequence++).padStart(3, '0')}-${label}.json`),
    `${JSON.stringify({ elapsedMs: Math.round(performance.now() - started), value }, null, 2)}\n`);
  console.log(`${String(sequence - 1).padStart(3, '0')} ${label}`);
}
const request = async (method: string, params?: Wire): Promise<Wire> =>
  await transport.send({ method, ...(params ? { params } : {}) }) as Wire;
/** The scope operations of one exchange: method, params, round trip, and the extension's aim report. */
const scopeCalls = (calls: readonly Wire[], begun: number): Wire[] => calls
  .filter((call) => SCOPE_METHODS.has(call.method))
  .map((call) => ({ method: call.method, params: call.params, at: Math.round(call.sent - begun),
    ms: Math.round(call.received - call.sent), slot: call.reply?.result?.slot, aim: call.reply?.result?.aim,
    error: call.reply?.error }));
async function tool(label: string, name: string, args: Wire, allowFailure = false): Promise<Wire> {
  const from = transport.calls.length;
  const begun = performance.now();
  const result = await callTool(workspace, name, args, AGENT_NATIVE_TOOL_PROFILE) as Wire;
  const ms = Math.round(performance.now() - begun);
  const calls = transport.calls.slice(from);
  const scopes = scopeCalls(calls, begun);
  const scrolls = scopes.reduce((sum, call) => sum + (call.aim?.scrolls ?? 0), 0);
  record(label, { name, args, ms, turns: calls.length, wire: wireSummary(calls), observes: scopes.length, scrolls, result,
    scopeCalls: scopes });
  if (!allowFailure) assert(result.failure === undefined, `${name}: ${JSON.stringify(result).slice(0, 800)}`);
  assert(!calls.some((call) => call.method === 'chain.scroll'), 'the brain sends no chain.scroll');
  return result;
}
const chainsOf = (read: Wire, position: number): Wire[] => read.data.devices[position]?.container?.layerChains ?? [];
const names = (read: Wire): string[] => read.data.devices.map((item: Wire) => item.name);

let scratchId: string | undefined;
let trackIndex = -1;
try {
  const hello = await request('contract.hello');
  assert.deepEqual([hello.runtimeProfile, hello.methodCount, hello.methodsHash], [...NORMAL_B17], 'deploy the B17 build');
  const stats = await request('rig.stats');
  const deployment = compareDeployment(deployedAtMs(), stats.initEpochMs);
  assert.equal(deployment.state, 'fresh', deployment.detail);
  await adapter.hello();
  const info = await request('rig.info');
  assert.equal(info.containerScopeRoute, 'extension-owned-scopes-v1');
  record('entry', { hello, deployment, containerScopeRoute: info.containerScopeRoute,
    containerScopeStatus: info.containerScopeStatus, containerScopes: info.containerScopes,
    containerScopePositions: info.containerScopePositions, resources: info.resources });

  const connection = await tool('connection', 'check_bitwig_connection', {});
  assert.equal(connection.target.project, 'gn-scale-test');
  await tool('tracks-before', 'list_tracks', {});
  const selectionBefore = await request('selection.status');
  record('selection-before', selectionBefore);
  const lay4Before = await tool('lay4-before', 'read_devices', { trackId: (connection.target.tracks ?? []).find?.((t: Wire) => t.name === 'gn-lay4')?.trackId
    ?? ((await request('track.list')).tracks as Wire[]).find((row) => row.name === 'gn-lay4')?.channelId });

  const added = await tool('add-track', 'add_tracks', { tracks: [{ name: SCRATCH }] });
  scratchId = added.readback.tracks[0].trackId as string;
  trackIndex = ((await request('track.list')).tracks as Wire[]).find((row) => row.channelId === scratchId)!.index;

  await tool('add-three', 'add_devices', { trackId: scratchId, devices: [
    { kind: 'native', name: 'Tool' }, { kind: 'native', name: 'Dual Pan' }, { kind: 'native', name: 'Ring-Mod' }] });
  // Position 3: past the three resting scopes.
  await tool('compose-far', 'compose_devices', { trackId: scratchId, containerKind: 'FX Layer', layerChains: [
    { name: 'A', devices: [{ source: { kind: 'native', name: 'EQ-5' } }] },
    { name: 'B', devices: [{ source: { kind: 'native', name: 'Gate' } }] }] });

  const readOne = await tool('read-far-first', 'read_devices', { trackId: scratchId });
  assert.deepEqual(names(readOne), ['Tool', 'Dual Pan', 'Ring-Mod', 'FX Layer']);
  assert.deepEqual(chainsOf(readOne, 3).map((chain) => [chain.name, chain.devices.map((d: Wire) => d.name)]),
    [['A', ['EQ-5']], ['B', ['Gate']]]);
  assert.deepEqual(readOne.coverage.layerChainPositions, [0, 1, 2, 3]);
  assert.equal(readOne.coverage.status, 'complete');
  const readTwo = await tool('read-far-second', 'read_devices', { trackId: scratchId });
  assert.deepEqual(chainsOf(readTwo, 3).map((chain) => chain.name), ['A', 'B']);

  // The ledger rows: one isolated container structure read at a far position (the scope rested elsewhere each
  // time, through a direct observe of position 2, which re-aims scope 2 at its rest) and at a resting position.
  const timed = async (position: number, rest: number | undefined) => {
    const trials: { ms: number; turns: number; wire: ReturnType<typeof wireSummary>; scopeCalls: Wire[] }[] = [];
    for (let trial = 0; trial < 5; trial += 1) {
      if (rest !== undefined) {
        const resting = await request('chain.observe', { position: rest, expectedTrackChannelId: scratchId });
        assert.equal(resting.slot, rest, `scope ${rest} rests at ${rest}`);
        await setTimeout(100);
      }
      const from = transport.calls.length;
      const begun = performance.now();
      const snapshot = await adapter.read([{ kind: 'device', track: { kind: 'track', channelId: scratchId }, chainIndex: position } as never], { structure: true });
      const ms = Math.round(performance.now() - begun);
      const calls = transport.calls.slice(from);
      const entry = Object.values(snapshot.entries)[0] as Wire | undefined;
      assert.ok(entry?.value?.device !== undefined, 'the isolated structure read answers');
      if (position === 3) assert.equal(entry?.value?.device?.container?.chains?.length, 2, 'both chains listed');
      trials.push({ ms, turns: calls.length, wire: wireSummary(calls), scopeCalls: scopeCalls(calls, begun) });
    }
    return trials;
  };
  record('container-read-timings-far', await timed(3, 2));
  record('container-read-timings-resting', await timed(0, undefined));

  // The five layer-chain tools at position 3.
  const soloed = await tool('solo-exclusive', 'set_layer_chain_solo', { trackId: scratchId, containerPosition: 3, layerChain: 'A', mode: 'exclusive' });
  assert.equal(soloed.applied, true);
  // D15: an independent readback through the cursor route, not through the scope that wrote.
  await request('cursor.pointTrack', { cursor: '0', trackIndex });
  await request('devcursor.selectAt', { deviceIndex: 3 });
  await setTimeout(200);
  const cursorLayers = await request('layer.list');
  record('solo-cursor-readback', cursorLayers);
  const layerRows = (cursorLayers.layers ?? cursorLayers.items ?? []) as Wire[];
  assert.deepEqual(layerRows.map((row) => [row.name, row.solo]), [['A', true], ['B', false]], JSON.stringify(cursorLayers));
  await request('devcursor.selectAt', { deviceIndex: 0 });
  // And the raw scope inventory: which scope the extension settled at 3, read without the product route.
  const inventory = await request('chain.inventory');
  const scopeAt3 = (inventory.scopes as Wire[]).find((scope) => scope.requestedPosition === 3 && scope.settled === true);
  record('solo-raw-scope-readback', { trackChannelId: inventory.trackChannelId, scopes: (inventory.scopes as Wire[]).map((scope) =>
    ({ slot: scope.slot, position: scope.position, requestedPosition: scope.requestedPosition, settled: scope.settled, deviceName: scope.deviceName })),
  scopeAt3 });
  assert.ok(scopeAt3 !== undefined, 'one scope is settled at position 3');
  assert.deepEqual(scopeAt3!.chains.map((chain: Wire) => [chain.name, chain.solo]), [['A', true], ['B', false]]);
  const unsoloed = await tool('solo-off', 'set_layer_chain_solo', { trackId: scratchId, containerPosition: 3, layerChain: 'A', mode: 'off' });
  assert.equal(unsoloed.applied, true);
  const renamed = await tool('rename', 'rename_layer_chain', { trackId: scratchId, containerPosition: 3, layerChain: 'B', name: 'B2' });
  assert.equal(renamed.applied, true);
  const duplicated = await tool('duplicate', 'duplicate_layer_chain', { trackId: scratchId, containerPosition: 3, layerChain: 'A', name: 'C' });
  assert.equal(duplicated.applied, true);
  const copied = await tool('copy-top-into-far', 'copy_devices', { trackId: scratchId,
    devices: [{ from: 'top-level', devicePosition: 0 }], destination: { to: 'layer-chain', containerPosition: 3, layerChain: 'C' } });
  assert.equal(copied.applied, true);
  const afterCopy = await tool('read-after-copy', 'read_devices', { trackId: scratchId });
  assert.deepEqual(chainsOf(afterCopy, 3).map((chain) => [chain.name, chain.devices.map((d: Wire) => d.name)]),
    [['A', ['EQ-5']], ['C', ['EQ-5', 'Tool']], ['B2', ['Gate']]]);
  const movedOut = await tool('move-far-to-end', 'move_devices', { trackId: scratchId,
    devices: [{ from: 'layer-chain', containerPosition: 3, layerChain: 'C', devicePosition: 1 }], destination: { to: 'track-end' } });
  assert.equal(movedOut.applied, true);
  const afterMove = await tool('read-after-move', 'read_devices', { trackId: scratchId });
  assert.deepEqual(names(afterMove), ['Tool', 'Dual Pan', 'Ring-Mod', 'FX Layer', 'Tool']);
  assert.deepEqual(chainsOf(afterMove, 3).map((chain) => chain.devices.map((d: Wire) => d.name)), [['EQ-5'], ['EQ-5'], ['Gate']]);

  // A second container at position 5 and a move between the two far containers: one `chain.move` holding two scopes.
  await tool('compose-farther', 'compose_devices', { trackId: scratchId, containerKind: 'FX Layer', layerChains: [
    { name: 'X', devices: [{ source: { kind: 'native', name: 'Peak Limiter' } }] }] });
  const twoFar = await tool('read-two-far', 'read_devices', { trackId: scratchId });
  assert.deepEqual(names(twoFar), ['Tool', 'Dual Pan', 'Ring-Mod', 'FX Layer', 'Tool', 'FX Layer']);
  assert.deepEqual(chainsOf(twoFar, 5).map((chain) => chain.name), ['X']);
  const crossMove = await tool('move-between-far', 'move_devices', { trackId: scratchId,
    devices: [{ from: 'layer-chain', containerPosition: 3, layerChain: 'B2', devicePosition: 0 }],
    destination: { to: 'layer-chain', containerPosition: 5, layerChain: 'X' } });
  assert.equal(crossMove.applied, true);
  const afterCross = await tool('read-after-cross', 'read_devices', { trackId: scratchId });
  assert.deepEqual(chainsOf(afterCross, 3).map((chain) => [chain.name, chain.devices.map((d: Wire) => d.name)]),
    [['A', ['EQ-5']], ['C', ['EQ-5']], ['B2', []]]);
  assert.deepEqual(chainsOf(afterCross, 5).map((chain) => [chain.name, chain.devices.map((d: Wire) => d.name)]),
    [['X', ['Peak Limiter', 'Gate']]]);
  const finalInventory = await request('chain.inventory');
  record('final-inventory', finalInventory);
  record('scope-status', (await request('rig.info')).containerScopeStatus);
  void lay4Before;
} finally {
  if (scratchId !== undefined) {
    const removed = await tool('delete-scratch', 'delete_track', { trackIds: [scratchId] }, true);
    const tracksAfter = await tool('tracks-after', 'list_tracks', {}, true);
    const selectionAfter = await request('selection.status');
    record('selection-after', selectionAfter);
    const lay4 = ((await request('track.list')).tracks as Wire[]).find((row) => row.name === 'gn-lay4');
    const lay4After = lay4 === undefined ? undefined : await tool('lay4-after', 'read_devices', { trackId: lay4.channelId }, true);
    record('cleanup', { removed: removed.readback?.removed, warnings: removed.warnings, tracks: tracksAfter.data?.tracks?.length,
      lay4Chains: lay4After?.data?.devices?.map((d: Wire) => d.container?.layerChains?.map((c: Wire) => c.name)) });
  }
  await transport.close();
}
