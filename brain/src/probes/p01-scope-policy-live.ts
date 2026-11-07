/** P01 scope policy only. Deploy normal ghostnote, obtain controller replacement and run probe:hello first.
 * node --import tsx src/probes/p01-scope-policy-live.ts --out NEW_DIRECTORY --operator-file FILE
 *   [--project gn-scale-test] [--idle-client PID]
 * The operator file retains the actual replacement reply. Stop on uncertain effects; never auto-retry writes.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { gzipSync } from 'node:zlib';
import { LiveAdapter } from '../adapters/live/adapter.js';
import type { Frame } from '../adapters/live/wiremap.js';
import { IdentityRegistry } from '../bindings/identity-registry.js';
import { OWNED_FX_LAYER_TEMPLATE_PATH } from '../composition/assets.js';
import { device, track } from '../contract/index.js';
import { compareDeployment, deployedAtMs } from '../deploy.js';
import { Executor } from '../engine/executor.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { AGENT_NATIVE_TOOL_PROFILE, callTool } from '../surface/tools.js';
import { workspaceOf } from '../surface/workspace.js';
import { WireTransport } from './phase8h3c-promotion.js';
import { NORMAL_B17 } from './phase8h4f-measure.js';

type Wire = Record<string, any>;
const { values } = parseArgs({ options: {
  out: { type: 'string' }, 'operator-file': { type: 'string' },
  project: { type: 'string', default: 'gn-scale-test' },
  'idle-client': { type: 'string', multiple: true, default: [] },
} });
assert(values.out && values['operator-file'], 'required: --out NEW_DIRECTORY --operator-file FILE');
const operator = JSON.parse(readFileSync(values['operator-file'], 'utf8')) as Wire;
assert(typeof operator.reply === 'string' && operator.reply.trim(), 'record the actual operator confirmation');
mkdirSync(values.out, { recursive: false });

class PolicyTransport extends WireTransport {
  legacy = false;
  override async send(frame: Frame): Promise<unknown> {
    const result = await super.send(frame) as Wire;
    // Compare acquisition policies on this same extension. Retain the unmodified wire reply in the trace.
    if (!this.legacy || frame.method !== 'device.list') return result;
    return { ...result, devices: result.devices.map(({ hasLayers: _ignored, ...row }: Wire) => row) };
  }
}
const transport = new PolicyTransport();
const adapter = new LiveAdapter({ transport });
const workspace = workspaceOf({ ready: async () => undefined, adapter, executor: new Executor(adapter),
  stash: new Stash(), observationStore: new FakeObservationStore(), documents: new IdentityRegistry() });
const scratchName = 'gn-p01-scopes';
let scratchId: string | undefined;
let sequence = 0;
const record = (label: string, value: unknown, compressed = false) => {
  const path = join(values.out!, `${String(sequence++).padStart(3, '0')}-${label}.json`);
  const text = JSON.stringify(value, null, compressed ? undefined : 2) + '\n';
  writeFileSync(path + (compressed ? '.gz' : ''), compressed ? gzipSync(text) : text);
  console.log(label);
};
const request = async (method: string, params?: Wire): Promise<Wire> => await transport.send({ method, params }) as Wire;
const selectionFields = (s: Wire) => Object.fromEntries(
  ['project', 'trackIndex', 'slotIndex', 'mixerTrackIndex', 'mixerChannelId'].map(k => [k, s[k]]));

function checkClients(): void {
  const rows = execFileSync('ps', ['-axo', 'pid=,ppid=,command='], { encoding: 'utf8' }).trim().split('\n')
    .map(line => { const m = line.trim().match(/^(\d+)\s+(\d+)\s+(.+)$/)!;
      return { pid: Number(m[1]), ppid: Number(m[2]), command: m[3]! }; });
  const ancestors = new Set([process.pid]);
  for (let pid = process.ppid; pid > 1;) {
    ancestors.add(pid);
    const row = rows.find(p => p.pid === pid);
    if (!row) break;
    pid = row.ppid;
  }
  const drivers = rows.filter(p => !ancestors.has(p.pid) && /src\/probes\/.*\.[cm]?[jt]s(?:\s|$)/.test(p.command)
    && !/\.test\.[cm]?[jt]s/.test(p.command));
  const sockets = execFileSync('lsof', ['-nP', '-iTCP:8686', '-sTCP:ESTABLISHED', '-Fp'], { encoding: 'utf8' });
  const clients = [...new Set(sockets.split('\n').filter(s => /^p\d+$/.test(s)).map(s => Number(s.slice(1))))]
    .filter(pid => pid !== process.pid).map(pid => rows.find(p => p.pid === pid)).filter(p => p !== undefined)
    .filter(p => !p.command.includes('BitwigStudio'));
  record('clients', { drivers, clients, allowedIdle: values['idle-client'] });
  assert.equal(drivers.length, 0, 'competing probe driver');
  for (const client of clients) assert(values['idle-client']!.includes(String(client.pid)), `uninspected bridge client ${client.pid}`);
}
async function beforeWrite(): Promise<void> {
  checkClients();
  const mark = await request('revision.get');
  assert.equal(mark.project, values.project);
  const tracks = await request('track.list');
  if (scratchId) assert.equal(tracks.tracks.find((t: Wire) => t.channelId === scratchId)?.name, scratchName);
  else assert(!tracks.tracks.some((t: Wire) => t.name === scratchName));
  record('write-context', { mark, tracks, selection: await request('selection.status'), scratchId });
}
async function tool(label: string, name: string, args: Wire = {}, write = false): Promise<Wire> {
  if (write) await beforeWrite();
  const from = transport.calls.length, started = performance.now();
  const result = await callTool(workspace, name, args, AGENT_NATIVE_TOOL_PROFILE) as Wire;
  const calls = transport.calls.slice(from);
  const scopes = calls.filter(c => c.method === 'chain.observe');
  const measurement = { ms: performance.now() - started, turns: calls.length,
    bytes: calls.reduce((n, c) => n + c.bytes, 0),
    positions: scopes.map(c => c.params?.position),
    scrolls: scopes.reduce((n, c) => n + (c.reply?.result?.aim?.scrolls ?? 0), 0) };
  record(label, { name, args, legacyAcquisition: transport.legacy, ...measurement, result, calls }, true);
  assert.equal(result.failure, undefined, JSON.stringify(result));
  if (result.readback?.status !== undefined) assert.equal(result.readback.status, 'verified', JSON.stringify(result));
  return { result, measurement };
}
const read = (label: string) => tool(label, 'read_devices', { trackId: scratchId });
const write = (label: string, name: string, args: Wire) => tool(label, name, { trackId: scratchId, ...args }, true);
const native = (name: string) => ({ kind: 'native', name });
const layers = (r: Wire, position: number): Wire[] => r.data.devices[position].container.layerChains;

async function capabilityCheck(label: string, expected: number[]): Promise<void> {
  assert(scratchId);
  const bank = await adapter.devices(track(scratchId));
  assert(bank.devicesComplete);
  assert.deepEqual(bank.devices.filter(d => d.hasLayers === true).map(d => d.index), expected);
  assert(bank.devices.every(d => typeof d.hasLayers === 'boolean'));
  // The adapter points and protects selection before the independent scope-handle pass.
  await adapter.read([device(track(scratchId), 0)], { structure: true });
  const scopes = [];
  for (const row of bank.devices) {
    const observed = await request('chain.observe', { position: row.index, expectedTrackChannelId: scratchId });
    assert.equal(observed.trackChannelId, scratchId);
    assert.equal(observed.scope.deviceName, row.name);
    assert.equal(observed.scope.devicePosition, row.index);
    assert.equal(observed.scope.hasLayers, row.hasLayers);
    assert.equal(observed.scope.chainWindowPosition, 0);
    assert(observed.scope.chains.every((c: Wire) => c.deviceWindowPosition === 0));
    scopes.push(observed);
  }
  record(label, { bank, scopes });
}
async function measure(label: string, expected: number[]): Promise<void> {
  assert(scratchId);
  // Explicitly displace all scopes before each policy arm. Only the first timed read is cold.
  const runs: Wire[] = [];
  let reference: unknown;
  for (const legacy of [true, false]) {
    transport.legacy = legacy;
    await adapter.read([0, 1, 2].map(i => device(track(scratchId!), i)), { structure: true });
    for (let i = 0; i < 5; i++) {
      const { result, measurement } = await read(`${label}-${legacy ? 'legacy' : 'modern'}-${i}`);
      assert.equal(result.coverage.status, 'complete');
      reference ??= result.data;
      assert.deepEqual(result.data, reference, 'both acquisition policies return identical complete structure');
      assert.deepEqual(measurement.positions, legacy ? result.data.devices.map((_: unknown, j: number) => j) : expected);
      if (!legacy && i > 0 && expected.length <= 3) assert.equal(measurement.scrolls, 0, 'warm containers stay settled');
      runs.push({ legacy, trial: i, ...measurement });
    }
  }
  transport.legacy = false;
  record(`${label}-measurements`, runs);
}

try {
  const hello = await request('contract.hello');
  assert.deepEqual([hello.runtimeProfile, hello.methodCount, hello.methodsHash], [...NORMAL_B17]);
  assert.equal(hello.hostApiVersion, 25);
  const stats = await request('rig.stats');
  const deployment = compareDeployment(deployedAtMs(), stats.initEpochMs);
  assert.equal(deployment.state, 'fresh', deployment.detail);
  const rig = await request('rig.info');
  assert.equal(rig.containerScopeStatus.policy, 'container-scope-lru-v1');
  assert.equal(rig.containerScopeStatus.open, false);
  assert(rig.windowWriteBlock == null);
  record('entry', { operator, hello, stats, deployment, rig });
  await adapter.hello();
  const connection = (await tool('connection', 'check_bitwig_connection')).result;
  assert.equal(connection.target.project, values.project);
  const beforeTracks = await request('track.list'), selected = await request('selection.status');
  record('baseline', { beforeTracks, selected });
  const preserved = new Map<string, unknown>();
  for (const row of beforeTracks.tracks) {
    const { result } = await tool(`preserved-${row.index}`, 'read_devices', { trackId: row.channelId });
    assert.equal(result.coverage.status, 'complete');
    preserved.set(row.channelId, result.data);
  }
  const added = await tool('create-scratch', 'add_tracks', { tracks: [{ name: scratchName }] }, true);
  scratchId = added.result.readback.tracks[0].trackId;
  assert.equal(typeof scratchId, 'string');
  record('owned-scratch', { scratchId, scratchName });
  await write('base-three', 'add_devices', { devices: ['Tool', 'Dual Pan', 'Ring-Mod'].map(native) });
  await measure('plain', []);
  await write('compose-first', 'compose_devices', { containerKind: 'FX Layer', layerChains: [
    { name: 'A', devices: [{ source: native('EQ-5') }] }, { name: 'B', devices: [{ source: native('Gate') }] },
  ] });
  await write('named-slot-device', 'add_devices', { devices: [native('Delay+')] });
  await write('compose-second', 'compose_devices', { containerKind: 'FX Layer', layerChains: [
    { name: 'C', devices: [{ source: native('Tool') }] },
  ] });
  await capabilityCheck('six-device-capabilities', [3, 5]);
  await measure('six-device', [3, 5]);
  await write('third-empty-container', 'add_devices', { devices: [native('Tool'),
    { kind: 'preset', path: OWNED_FX_LAYER_TEMPLATE_PATH }] });
  let current = (await read('three-far-structure')).result;
  assert(layers(current, 7).length > 0 && layers(current, 7).every(c => c.devices.length === 0));
  await capabilityCheck('three-far-capabilities', [3, 5, 7]);
  await measure('three-far', [3, 5, 7]);
  await write('fill-to-seventeen', 'add_devices', { devices: Array.from({ length: 9 }, () => native('Tool')) });
  await write('overflow-container', 'add_devices', { devices: [{ kind: 'preset', path: OWNED_FX_LAYER_TEMPLATE_PATH }] });
  await capabilityCheck('overflow-capabilities', [3, 5, 7, 17]);
  await measure('four-far-overflow', [3, 5, 7, 17]);
  await write('cross-container-move', 'move_devices', { devices: [{ from: 'layer-chain', containerPosition: 3,
    layerChain: 'A', devicePosition: 0 }], destination: { to: 'layer-chain', containerPosition: 5, layerChain: 'C' } });
  current = (await read('after-transfer')).result;
  assert.deepEqual(layers(current, 3).find(c => c.name === 'A')!.devices, []);
  assert.deepEqual(layers(current, 5).find(c => c.name === 'C')!.devices.map((d: Wire) => d.name), ['Tool', 'EQ-5']);
  // Return to a shorter, different track, then re-acquire the overflow fixture (clamped-bank regression).
  await tool('different-track', 'read_devices', { trackId: beforeTracks.tracks.at(-1).channelId });
  await capabilityCheck('retargeted-capabilities', [3, 5, 7, 17]);
  const exit = await request('rig.info');
  assert.equal(exit.containerScopeStatus.open, false);
  assert(exit.windowWriteBlock == null);
  await tool('remove-scratch', 'delete_track', { trackIds: [scratchId] }, true);
  scratchId = undefined;
  const afterTracks = await request('track.list');
  assert.deepEqual(afterTracks.tracks, beforeTracks.tracks);
  for (const row of afterTracks.tracks) {
    const { result } = await tool(`preserved-after-${row.index}`, 'read_devices', { trackId: row.channelId });
    assert.equal(result.coverage.status, 'complete');
    assert.deepEqual(result.data, preserved.get(row.channelId));
  }
  const afterSelection = await request('selection.status');
  assert.deepEqual(selectionFields(afterSelection), selectionFields(selected));
  record('result', { passed: true, cleanup: true, afterTracks, afterSelection, exit });
} catch (error) {
  record('stopped', { scratchId, scratchName, error: String(error),
    next: 'Inspect actual effects before further writes; do not repeat the driver or auto-delete scratch.' });
  for (const method of ['track.list', 'selection.status', 'rig.info', 'chain.inventory']) {
    try { record(`failure-${method.replace('.', '-')}`, await request(method)); } catch { /* keep the original failure */ }
  }
  throw error;
} finally { await transport.close(); }
