/** P01 direct layer insertion research. Deploy ghostnote probe, obtain controller replacement and run probe:hello first.
 * node --import tsx src/probes/p01-chain-insert-live.ts --out NEW_DIRECTORY --operator-file FILE
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
import { readProbeGolden } from '../tools/wire-golden.js';

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

const transport = new WireTransport();
const golden = readProbeGolden();
const adapter = new LiveAdapter({ transport, expectRuntimeProfile: golden.identity, expectMethodsHash: golden.methodsHash });
const workspace = workspaceOf({ ready: async () => undefined, adapter, executor: new Executor(adapter),
  stash: new Stash(), observationStore: new FakeObservationStore(), documents: new IdentityRegistry() });
const scratchName = 'gn-p01-insert';
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
  record(label, { name, args, ...measurement, result, calls }, true);
  assert.equal(result.failure, undefined, JSON.stringify(result));
  if (result.readback?.status !== undefined) assert.equal(result.readback.status, 'verified', JSON.stringify(result));
  return { result, measurement };
}
const read = (label: string) => tool(label, 'read_devices', { trackId: scratchId });
const write = (label: string, name: string, args: Wire) => tool(label, name, { trackId: scratchId, ...args }, true);
const native = (name: string) => ({ kind: 'native', name });
const layers = (r: Wire, position: number): Wire[] => r.data.devices[position].container.layerChains;

async function insert(label: string, chainIndex: number, sources: Wire[], names: string[]): Promise<void> {
  await beforeWrite();
  const before = (await read(`${label}-before`)).result;
  const target = layers(before, 17)[chainIndex]!;
  const observed = await request('chain.observe', { position: 17, expectedTrackChannelId: scratchId });
  const chainId = observed.scope.chains[chainIndex].channelId;
  assert.equal(typeof chainId, 'string');
  assert.equal(observed.scope.chains[chainIndex].name, target.name);
  const selected = await request('selection.status');
  const status = await request('probe.chainInsert', { operation: 'status' });
  assert.equal(status.pendingReceipt, 0); assert.equal(status.uncertain, false);
  const from = transport.calls.length;
  // One request contains ordered source insertions. The acknowledgement is not a successful readback.
  const receipt = await request('probe.chainInsert', { operation: 'insert', position: 17, chainIndex,
    expectedTrackChannelId: scratchId, expectedContainerName: before.data.devices[17].name,
    expectedChannelId: chainId, expectedChainName: target.name, expectedDeviceCount: target.devices.length, sources });
  record(`${label}-attempt`, { sources, receipt, calls: transport.calls.slice(from) }, true);
  assert.equal(receipt.verified, false); assert.equal(receipt.attempted, sources.length);
  // Device-bank observations are independent of the insertion point's attempt receipt.
  const after = (await read(`${label}-readback`)).result;
  const wanted = structuredClone(before.data);
  const destination = wanted.devices[17].container.layerChains[chainIndex];
  const actual = layers(after, 17)[chainIndex]!;
  assert.deepEqual(actual.devices.map((d: Wire) => d.name), [...destination.devices.map((d: Wire) => d.name), ...names]);
  destination.devices = actual.devices;
  destination.devicePages = Math.max(1, Math.ceil(actual.devices.length / destination.deviceWindowSize));
  assert.deepEqual(after.data, wanted, 'only the destination device list may change');
  assert.equal(after.coverage.status, 'complete');
  assert.deepEqual(selectionFields(await request('selection.status')), selectionFields(selected));
  const verified = await request('chain.observe', { position: 17, expectedTrackChannelId: scratchId });
  assert(verified.scope.chains[chainIndex].devices.every((d: Wire) => d.enabled === true));
  assert.equal(verified.scope.chainWindowPosition, 0);
  assert(verified.scope.chains.every((c: Wire) => c.deviceWindowPosition === 0));
  record(`${label}-independent`, verified);
  await request('probe.chainInsert', { operation: 'acknowledge', receipt: receipt.receipt });
}

try {
  const hello = await request('contract.hello');
  assert.deepEqual([hello.runtimeProfile, hello.methodCount, hello.methodsHash], [golden.identity, golden.count, golden.methodsHash]);
  assert.equal(hello.hostApiVersion, 25);
  const stats = await request('rig.stats');
  const deployment = compareDeployment(deployedAtMs(), stats.initEpochMs);
  assert.equal(deployment.state, 'fresh', deployment.detail);
  const status = await request('probe.chainInsert', { operation: 'status' });
  assert.equal(status.marker, 'p01-chain-insert-v2');
  assert.equal(status.busy, false); assert.equal(status.pendingReceipt, 0); assert.equal(status.uncertain, false);
  const rig = await request('rig.info');
  assert.equal(rig.containerScopeStatus.policy, 'container-scope-lru-v1');
  assert.equal(rig.containerScopeStatus.open, false); assert(rig.windowWriteBlock == null);
  record('entry', { operator, hello, stats, deployment, rig, status });
  await adapter.hello();
  assert.equal((await tool('connection', 'check_bitwig_connection')).result.target.project, values.project);
  const resolved = new Map<string, Wire>();
  for (const [name, sourceKind] of [['Tool', 'native'], ['EQ-5', 'native'], ['Gate', 'native'], ['TX16Wx', 'vst3'], ['TX16Wx', 'clap']]) {
    const r = (await tool(`resolve-${sourceKind}-${name}`, 'resolve_device_name', { name, sourceKind })).result;
    assert.equal(r.data.status, 'resolved'); assert.equal(r.coverage.status, 'complete');
    const source = r.data.insertion;
    resolved.set(`${sourceKind}:${name}`, { kind: source.kind === 'bitwig' ? 'native' : source.kind, value: source.id });
  }
  const beforeTracks = await request('track.list'), selected = await request('selection.status');
  record('baseline', { beforeTracks, selected });
  const preserved = new Map<string, unknown>();
  for (const row of beforeTracks.tracks) {
    const { result } = await tool(`preserved-${row.index}`, 'read_devices', { trackId: row.channelId });
    assert.equal(result.coverage.status, 'complete'); preserved.set(row.channelId, result.data);
  }
  const added = await tool('create-scratch', 'add_tracks', { tracks: [{ name: scratchName }] }, true);
  scratchId = added.result.readback.tracks[0].trackId;
  assert.equal(typeof scratchId, 'string'); record('owned-scratch', { scratchId, scratchName });
  await write('fill-sixteen', 'add_devices', { devices: Array.from({ length: 16 }, () => native('Tool')) });
  await write('empty-container', 'add_devices', { devices: [native('Tool'), { kind: 'preset', path: OWNED_FX_LAYER_TEMPLATE_PATH }] });
  let current = (await read('empty-container-read')).result;
  const first = layers(current, 17)[0]!.name;
  for (let i = 1; i < 6; i++) {
    await write(`duplicate-empty-${i}`, 'duplicate_layer_chain', { containerPosition: 17, layerChain: first, name: `P01-${i}` });
  }
  current = (await read('six-empty-chains')).result;
  assert.equal(layers(current, 17).length, 6);
  assert(layers(current, 17).every(c => c.devices.length === 0));
  await write('name-original-chain', 'rename_layer_chain', { containerPosition: 17, layerChain: first, name: 'P01-0' });
  const triple = [resolved.get('native:Tool')!, resolved.get('native:EQ-5')!, resolved.get('native:Gate')!];
  await insert('ordered-native-empty', 0, triple, ['Tool', 'EQ-5', 'Gate']);
  await insert('ordered-native-append', 0, [resolved.get('native:EQ-5')!, resolved.get('native:Tool')!], ['EQ-5', 'Tool']);
  await insert('ordered-native-repeat-empty', 4, triple, ['Tool', 'EQ-5', 'Gate']);
  await insert('ordered-mixed-sixth-chain', 5, [resolved.get('native:Tool')!, resolved.get('vst3:TX16Wx')!,
    resolved.get('clap:TX16Wx')!, { kind: 'preset', value: OWNED_FX_LAYER_TEMPLATE_PATH }],
    ['Tool', 'TX16Wx', 'TX16Wx', 'FX Layer']);
  await insert('ordered-sixth-append', 5, [resolved.get('native:EQ-5')!, resolved.get('native:Gate')!], ['EQ-5', 'Gate']);
  const exit = await request('rig.info');
  assert.equal(exit.containerScopeStatus.open, false); assert(exit.windowWriteBlock == null);
  assert.equal((await request('probe.chainInsert', { operation: 'status' })).pendingReceipt, 0);
  await tool('remove-scratch', 'delete_track', { trackIds: [scratchId] }, true);
  scratchId = undefined;
  const afterTracks = await request('track.list'); assert.deepEqual(afterTracks.tracks, beforeTracks.tracks);
  for (const row of afterTracks.tracks) {
    const { result } = await tool(`preserved-after-${row.index}`, 'read_devices', { trackId: row.channelId });
    assert.equal(result.coverage.status, 'complete'); assert.deepEqual(result.data, preserved.get(row.channelId));
  }
  const afterSelection = await request('selection.status');
  assert.deepEqual(selectionFields(afterSelection), selectionFields(selected));
  record('result', { passed: true, cleanup: true, afterTracks, afterSelection, exit });
} catch (error) {
  record('stopped', { scratchId, scratchName, error: String(error),
    next: 'Inspect actual effects before further writes; do not repeat the driver or auto-delete scratch.' });
  for (const method of ['track.list', 'selection.status', 'rig.info', 'chain.inventory']) {
    try { record(`failure-${method.replace('.', '-')}`, await request(method)); } catch { /* retain original failure */ }
  }
  throw error;
} finally { await transport.close(); }
