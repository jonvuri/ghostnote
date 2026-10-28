/** B17 session 7 only. Deploy normal ghostnote, replace the controller, run probe:hello, then:
 * node --import tsx src/probes/b17-integrated-live.ts --out NEW_DIRECTORY
 * [--project gn-scale-test] [--idle-client PID ...]
 * Inspect listed clients before allowing an idle MCP client. Never allow another probe driver.
 * A failed/uncertain write stops the sequence and retains scratch for inspection; no automatic retry or cleanup.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { LiveAdapter } from '../adapters/live/adapter.js';
import { IdentityRegistry } from '../bindings/identity-registry.js';
import { compareDeployment, deployedAtMs } from '../deploy.js';
import { Executor } from '../engine/executor.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { AGENT_NATIVE_TOOL_PROFILE, callTool } from '../surface/tools.js';
import { TOOL_DESCRIPTION_VERSION } from '../surface/description-cohort.js';
import { workspaceOf } from '../surface/workspace.js';
import { WireTransport } from './phase8h3c-promotion.js';
import { NORMAL_B17 } from './phase8h4f-measure.js';

type Wire = Record<string, any>;
const { values } = parseArgs({ options: {
  out: { type: 'string' }, project: { type: 'string', default: 'gn-scale-test' },
  'idle-client': { type: 'string', multiple: true, default: [] },
} });
assert(values.out, 'required: --out NEW_DIRECTORY');
mkdirSync(values.out, { recursive: false });
const transport = new WireTransport();
const adapter = new LiveAdapter({ transport });
const workspace = workspaceOf({ ready: async () => undefined, adapter, executor: new Executor(adapter),
  stash: new Stash(), observationStore: new FakeObservationStore(), documents: new IdentityRegistry() });
let serial = 0;
let scratchId: string | undefined;
const scratchName = 'gn-b17w';
const record = (label: string, value: unknown) => {
  writeFileSync(join(values.out!, `${String(serial++).padStart(3, '0')}-${label}.json`), JSON.stringify(value, null, 2) + '\n');
  console.log(label);
};
const request = async (method: string, params?: Wire): Promise<Wire> => await transport.send({ method, params }) as Wire;
async function tool(label: string, name: string, args: Wire = {}): Promise<Wire> {
  const from = transport.calls.length, start = performance.now();
  const result = await callTool(workspace, name, args, AGENT_NATIVE_TOOL_PROFILE) as Wire;
  record(label, { name, args, result, ms: performance.now() - start, turns: transport.calls.length - from,
    calls: transport.calls.slice(from) });
  assert.equal(result.failure, undefined, JSON.stringify(result));
  if (result.readback?.status !== undefined) assert.equal(result.readback.status, 'verified', JSON.stringify(result));
  return result;
}
const selectionFields = (s: Wire) => Object.fromEntries(
  ['project', 'trackIndex', 'slotIndex', 'mixerTrackIndex', 'mixerChannelId'].map(k => [k, s[k]]));
const layers = (r: Wire, position: number): Wire[] => r.data.devices[position].container.layerChains;
const layerDevices = (r: Wire, position: number, name: string): string[] =>
  layers(r, position).find(c => c.name === name)!.devices.map((d: Wire) => d.name);
const source = (name = 'Tool') => ({ source: { kind: 'native', name } });

function checkDrivers(): void {
  const processes = execFileSync('ps', ['-axo', 'pid=,ppid=,command='], { encoding: 'utf8' }).trim().split('\n')
    .map(line => { const m = line.trim().match(/^(\d+)\s+(\d+)\s+(.+)$/)!;
      return { pid: Number(m[1]), ppid: Number(m[2]), command: m[3]! }; });
  const ancestors = new Set([process.pid]);
  for (let pid = process.ppid; pid > 1;) {
    ancestors.add(pid);
    const row = processes.find(p => p.pid === pid);
    if (!row) break;
    pid = row.ppid;
  }
  // Match brain entry points, not unrelated editor servers in node_modules/*/dist.
  const clients = processes.filter(p => !ancestors.has(p.pid)
    && /(?:src\/probes\/|(?:^|\s|\/brain\/)(?:src|dist)\/(?:index|main|server)\.[jt]s(?:\s|$))/.test(p.command));
  record('clients', { clients, allowedIdleClients: values['idle-client'] });
  for (const client of clients) {
    assert(!client.command.includes('/probes/'), `competing probe driver ${client.pid}`);
    assert(values['idle-client']!.includes(String(client.pid)), `inspect MCP client ${client.pid} before allowing it as idle`);
  }
}
try {
  const hello = await request('contract.hello');
  assert.deepEqual([hello.runtimeProfile, hello.methodCount, hello.methodsHash], [...NORMAL_B17]);
  assert.equal(hello.hostApiVersion, 25);
  assert.equal(TOOL_DESCRIPTION_VERSION, 'ghostnote-description-v57');
  const stats = await request('rig.stats');
  const deployment = compareDeployment(deployedAtMs(), stats.initEpochMs);
  assert.equal(deployment.state, 'fresh', deployment.detail);
  const rig = await request('rig.info');
  for (const [key, marker] of Object.entries({ containerScopeRoute: 'paged-windows-v3',
    layerControlRoute: 'paged-chain-controls-v1', chainMoveRoute: 'paged-chain-moves-v2',
    deviceMutationRoute: 'paged-device-mutations-v1' })) assert.equal(rig[key], marker, key);
  assert.equal(rig.containerScopeStatus.open, false);
  assert(rig.windowWriteBlock == null);
  record('entry', { hello, stats, deployment, rig, descriptions: TOOL_DESCRIPTION_VERSION });
  await adapter.hello();
  const connection = await tool('connection', 'check_bitwig_connection');
  assert.equal(connection.target.project, values.project);
  const beforeTracks = await request('track.list');
  assert(!beforeTracks.tracks.some((t: Wire) => t.name === scratchName), 'scratch name must be unused');
  const selected = await request('selection.status');
  record('baseline', { beforeTracks, selected });
  const preserved = new Map<string, Wire>();
  for (const row of beforeTracks.tracks) {
    const read = await tool(`preserved-${row.index}`, 'read_devices', { trackId: row.channelId });
    assert.equal(read.coverage.status, 'complete');
    preserved.set(row.channelId, read.data);
  }
  checkDrivers();
  const added = await tool('create-scratch', 'add_tracks', { tracks: [{ name: scratchName }] });
  scratchId = added.readback.tracks[0].trackId;
  record('owned-scratch', { scratchId, scratchName });
  assert.equal(typeof scratchId, 'string');
  const read = (label: string) => tool(label, 'read_devices', { trackId: scratchId });
  const write = (label: string, name: string, args: Wire) => tool(label, name, { trackId: scratchId, ...args });
  await write('base-sixteen', 'add_devices', { devices: Array.from({ length: 16 }, () => ({ kind: 'native', name: 'Tool' })) });
  await write('base-seventeen', 'add_devices', { devices: [{ kind: 'native', name: 'Tool' }] });
  // One five-device chain exercises composition's retired inner width cap.
  await write('compose-five-devices', 'compose_devices', { containerKind: 'FX Layer',
    layerChains: [{ name: 'A', devices: [source(), source(), source(), source(), source('Dual Pan')] }] });
  for (const [index, name] of ['B', 'C', 'D', 'E', 'F'].entries()) {
    await write(`duplicate-${name}`, 'duplicate_layer_chain', { containerPosition: 17,
      layerChain: ['A', 'B', 'C', 'D', 'E'][index], name });
  }
  // Six chains require the extra empty-chain seed stage.
  await write('compose-six-chains', 'compose_devices', { containerKind: 'FX Layer',
    layerChains: Array.from({ length: 6 }, (_, i) => ({ name: `G${i}`, devices: [source()] })) });
  let state = await read('overflow-structure');
  assert.equal(state.coverage.status, 'complete');
  assert.equal(state.data.devices.length, 19);
  assert.deepEqual(layers(state, 17).map(c => c.name), ['A', 'B', 'C', 'D', 'E', 'F']);
  assert.equal(layers(state, 18).length, 6);
  assert(layers(state, 17).every(c => c.devices.length === 5));
  await write('solo-sixth', 'set_layer_chain_solo', { containerPosition: 17, layerChain: 'F', mode: 'exclusive' });
  await write('rename-sixth', 'rename_layer_chain', { containerPosition: 17, layerChain: 'F', name: 'Sixth' });
  await write('grow-inner', 'copy_devices', { devices: [{ from: 'top-level', devicePosition: 16 }],
    destination: { to: 'layer-chain', containerPosition: 17, layerChain: 'A' } });
  await write('move-fifth-out', 'move_devices', { devices: [{ from: 'layer-chain', containerPosition: 17,
    layerChain: 'A', devicePosition: 4 }], destination: { to: 'track-end' } });
  await write('same-container-distant', 'move_devices', { devices: [{ from: 'layer-chain', containerPosition: 17,
    layerChain: 'Sixth', devicePosition: 4 }], destination: { to: 'layer-chain', containerPosition: 17, layerChain: 'A' } });
  await write('cross-container', 'move_devices', { devices: [{ from: 'layer-chain', containerPosition: 17,
    layerChain: 'A', devicePosition: 5 }], destination: { to: 'layer-chain', containerPosition: 18, layerChain: 'G5' } });
  state = await read('after-transfers');
  assert.deepEqual(layerDevices(state, 17, 'A'), Array(5).fill('Tool'));
  assert.deepEqual(layerDevices(state, 18, 'G5'), ['Tool', 'Dual Pan']);
  assert.equal(layers(state, 17).find(c => c.name === 'Sixth')!.solo, true);
  assert.equal(state.data.devices[19].name, 'Dual Pan');
  await tool('disable-overflow', 'set_device_enabled', { settings: [{ trackId: scratchId, devicePosition: 19, enabled: false }] });
  await write('reorder-distant', 'move_devices', { devices: [{ from: 'top-level', devicePosition: 19 }],
    destination: { to: 'top-level-position', devicePosition: 0 } });
  state = await read('after-reorder');
  assert.equal(state.data.devices[0].name, 'Dual Pan');
  assert.equal(state.data.devices[0].enabled, false);
  assert.equal(state.data.devices[18].container.layerChains.length, 6);
  await tool('delete-reordered', 'delete_device', { devices: [{ trackId: scratchId, devicePosition: 0 }] });
  await write('insert-overflow', 'add_devices', { devices: [{ kind: 'native', name: 'Gate' }] });
  await tool('delete-overflow', 'delete_device', { devices: [{ trackId: scratchId, devicePosition: 19 }] });
  state = await read('final-scratch');
  assert.equal(state.data.devices.length, 19);
  assert.deepEqual(layerDevices(state, 18, 'G5'), ['Tool', 'Dual Pan']);
  const trials = [];
  for (let i = 0; i < 5; i++) {
    const from = transport.calls.length, started = performance.now();
    const snapshot = await adapter.read([{ kind: 'device', track: { kind: 'track', channelId: scratchId! }, chainIndex: 17 }], { structure: true });
    trials.push({ ms: performance.now() - started, turns: transport.calls.length - from, snapshot });
  }
  record('overflow-read-cost', trials);
  const inventory = await request('chain.inventory');
  record('restored-windows', inventory);
  for (const scope of inventory.scopes) {
    assert.equal(scope.chainWindowPosition, 0);
    assert(scope.chains.every((c: Wire) => c.deviceWindowPosition === 0));
  }
  const exit = await request('rig.info');
  assert.equal(exit.containerScopeStatus.open, false);
  assert(exit.windowWriteBlock == null);
  await tool('remove-scratch', 'delete_track', { trackIds: [scratchId] });
  scratchId = undefined;
  const afterTracks = await request('track.list');
  assert.deepEqual(afterTracks.tracks, beforeTracks.tracks);
  for (const row of afterTracks.tracks) {
    assert.deepEqual((await tool(`preserved-after-${row.index}`, 'read_devices', { trackId: row.channelId })).data,
      preserved.get(row.channelId));
  }
  const afterSelection = await request('selection.status');
  assert.deepEqual(selectionFields(afterSelection), selectionFields(selected));
  record('result', { passed: true, cleanup: true, afterTracks, afterSelection, exit });
} catch (error) {
  record('stopped', { scratchId, scratchName, error: String(error),
    next: 'Inspect recorded effects and current state before any further write; do not repeat this driver.' });
  // Diagnostics only: an uncertain mutation must not trigger another write.
  for (const method of ['track.list', 'selection.status', 'rig.info', 'chain.inventory']) {
    try { record(`failure-${method.replace('.', '-')}`, await request(method)); } catch { /* retain original failure */ }
  }
  throw error;
} finally {
  await transport.close();
}
