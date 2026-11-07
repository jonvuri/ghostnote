/** P01 D65 composition measurement: staged compose_devices by direct chain insertion, and its revert_change.
 * Deploy normal ghostnote, obtain controller replacement and run probe:hello first.
 * node --import tsx src/probes/p01-compose-live.ts --out NEW_DIRECTORY --operator-file FILE [--project gn-scale-test]
 * The operator file retains the actual replacement reply. Stop on uncertain effects; never auto-retry writes.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { gzipSync } from 'node:zlib';
import { LiveAdapter } from '../adapters/live/adapter.js';
import { IdentityRegistry } from '../bindings/identity-registry.js';
import { OWNED_FX_LAYER_TEMPLATE_PATH } from '../composition/assets.js';
import { compareDeployment, deployedAtMs } from '../deploy.js';
import { Executor } from '../engine/executor.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { AGENT_NATIVE_TOOL_PROFILE, callTool } from '../surface/tools.js';
import { workspaceOf } from '../surface/workspace.js';
import { readGolden } from '../tools/wire-golden.js';
import { WireTransport } from './phase8h3c-promotion.js';

type Wire = Record<string, any>;
const { values } = parseArgs({ options: {
  out: { type: 'string' }, 'operator-file': { type: 'string' },
  project: { type: 'string', default: 'gn-scale-test' },
} });
assert(values.out && values['operator-file'], 'required: --out NEW_DIRECTORY --operator-file FILE');
const operator = JSON.parse(readFileSync(values['operator-file'], 'utf8')) as Wire;
assert(typeof operator.reply === 'string' && operator.reply.trim(), 'record the actual operator confirmation');
mkdirSync(values.out, { recursive: false });

const transport = new WireTransport();
const golden = readGolden();
const adapter = new LiveAdapter({ transport, expectRuntimeProfile: golden.identity, expectMethodsHash: golden.methodsHash });
const workspace = workspaceOf({ ready: async () => undefined, adapter, executor: new Executor(adapter),
  stash: new Stash(), observationStore: new FakeObservationStore(), documents: new IdentityRegistry() });
const scratchName = 'gn-p01-compose';
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

/** Refuse a write while another probe driver or bridge client is active. */
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
  let sockets = '';
  try {
    sockets = execFileSync('lsof', ['-nP', '-iTCP:8686', '-sTCP:ESTABLISHED', '-Fp'], { encoding: 'utf8' });
  } catch { /* lsof exits 1 when nothing matches */ }
  const clients = [...new Set(sockets.split('\n').filter(s => /^p\d+$/.test(s)).map(s => Number(s.slice(1))))]
    .filter(pid => pid !== process.pid).map(pid => rows.find(p => p.pid === pid)).filter(p => p !== undefined)
    .filter(p => !p.command.includes('BitwigStudio'));
  assert.equal(drivers.length, 0, `competing probe driver: ${JSON.stringify(drivers)}`);
  assert.equal(clients.length, 0, `another bridge client is connected: ${JSON.stringify(clients)}`);
}
async function beforeWrite(): Promise<void> {
  checkClients();
  const mark = await request('revision.get');
  assert.equal(mark.project, values.project);
  const tracks = await request('track.list');
  if (scratchId) assert.equal(tracks.tracks.find((t: Wire) => t.channelId === scratchId)?.name, scratchName);
  else assert(!tracks.tracks.some((t: Wire) => t.name === scratchName));
}
async function tool(label: string, name: string, args: Wire = {}, write = false): Promise<{ result: Wire; measurement: Wire }> {
  if (write) await beforeWrite();
  const from = transport.calls.length, started = performance.now();
  const result = await callTool(workspace, name, args, AGENT_NATIVE_TOOL_PROFILE) as Wire;
  const calls = transport.calls.slice(from);
  const methods: Record<string, number> = {};
  for (const call of calls) methods[call.method] = (methods[call.method] ?? 0) + 1;
  const measurement = { ms: Math.round(performance.now() - started), turns: calls.length,
    bytes: calls.reduce((n, c) => n + c.bytes, 0), methods };
  record(label, { name, args, ...measurement, result, calls }, true);
  assert.equal(result.failure, undefined, JSON.stringify(result).slice(0, 2000));
  if (result.readback?.status !== undefined) assert.equal(result.readback.status, 'verified', JSON.stringify(result));
  return { result, measurement };
}
const read = async (label: string) => {
  const { result } = await tool(label, 'read_devices', { trackId: scratchId });
  assert.equal(result.coverage.status, 'complete');
  return result.data as Wire;
};
const write = (label: string, name: string, args: Wire) => tool(label, name, { trackId: scratchId, ...args }, true);
const native = (name: string) => ({ source: { kind: 'native', name } });

interface Case {
  readonly label: string;
  readonly position?: number;
  readonly chains: readonly { readonly name: string; readonly devices: readonly Wire[] }[];
  /** Expected device names per chain; undefined entries are plug-in names that are only counted. */
  readonly names: readonly (readonly (string | undefined)[])[];
}

/** Compose, read back independently, revert, and read the exact original structure back. */
async function measure(test: Case): Promise<Wire> {
  const before = await read(`${test.label}-before`);
  const composed = await write(`${test.label}-compose`, 'compose_devices', {
    containerKind: 'FX Layer', layerChains: test.chains,
    ...(test.position === undefined ? {} : { containerPosition: test.position }),
  });
  const position = test.position ?? before.devices.length;
  const after = await read(`${test.label}-after`);
  const container = after.devices[position];
  assert.equal(container?.name, 'FX Layer', 'the container is at its requested position');
  const chains = container.container.layerChains as Wire[];
  assert.deepEqual(chains.map(c => c.name), test.chains.map(c => c.name));
  for (const [index, chain] of chains.entries()) {
    assert.equal(chain.devicesComplete, true);
    const names = chain.devices.map((d: Wire) => d.name);
    assert.equal(names.length, test.names[index]!.length, `${chain.name} device count`);
    test.names[index]!.forEach((name, at) => { if (name !== undefined) assert.equal(names[at], name, `${chain.name}[${at}]`); });
  }
  const reverted = await tool(`${test.label}-revert`, 'revert_change', {
    changeId: composed.result.next.revert.changeId,
  }, true);
  const restored = await read(`${test.label}-restored`);
  assert.deepEqual(restored, before, 'revert_change restores the exact public structure');
  return { label: test.label, compose: composed.measurement, revert: reverted.measurement,
    observed: chains.map(c => ({ name: c.name, devices: c.devices.map((d: Wire) => d.name) })) };
}

try {
  const hello = await request('contract.hello');
  assert.deepEqual([hello.runtimeProfile, hello.methodCount, hello.methodsHash],
    [golden.identity, golden.count, golden.methodsHash]);
  const rig = await request('rig.info');
  assert.equal(rig.chainInsertRoute, 'chain-insert-v1', 'deliberate build marker');
  assert.equal(rig.windowWriteBlock ?? null, null, 'no write block');
  const stats = await request('rig.stats');
  assert.equal(compareDeployment(deployedAtMs(), stats.initEpochMs).state, 'fresh');
  record('entry', { operator, hello, stats, rig });
  await adapter.hello();
  assert.equal((await tool('connection', 'check_bitwig_connection')).result.target.project, values.project);
  const beforeTracks = await request('track.list'), selected = await request('selection.status');
  record('baseline', { beforeTracks, selected });
  const preserved = new Map<string, unknown>();
  for (const row of beforeTracks.tracks) {
    const { result } = await tool(`preserved-${row.index}`, 'read_devices', { trackId: row.channelId });
    assert.equal(result.coverage.status, 'complete'); preserved.set(row.channelId, result.data);
  }
  const resolve = async (sourceKind: string) => {
    const { result } = await tool(`resolve-${sourceKind}`, 'resolve_device_name', { name: 'TX16Wx', sourceKind });
    assert.equal(result.data.status, 'resolved'); return result.data.insertion as Wire;
  };
  const vst3 = await resolve('vst3'), clap = await resolve('clap');

  const added = await tool('scratch', 'add_tracks', { tracks: [{ name: scratchName }] }, true);
  scratchId = added.result.readback.tracks[0].trackId;
  assert.equal(typeof scratchId, 'string'); record('owned', { scratchId });

  const results: Wire[] = [];
  results.push(await measure({ label: '1x1', chains: [{ name: 'One', devices: [native('Tool')] }], names: [['Tool']] }));
  results.push(await measure({ label: '3x2',
    chains: ['A', 'B', 'C'].map(name => ({ name, devices: [native('Tool'), native('EQ-5')] })),
    names: [['Tool', 'EQ-5'], ['Tool', 'EQ-5'], ['Tool', 'EQ-5']] }));
  results.push(await measure({ label: 'mixed', chains: [{ name: 'Mixed', devices: [native('Tool'),
    { source: { kind: 'vst3', classUid: vst3.id } }, { source: { kind: 'clap', id: clap.id } },
    { source: { kind: 'preset', path: OWNED_FX_LAYER_TEMPLATE_PATH } }] }],
  names: [['Tool', undefined, undefined, undefined]] }));
  results.push(await measure({ label: 'modulated', chains: [{ name: 'Mod', devices: [{ ...native('Polysynth'),
    modulators: [{ location: 'container', modulator: 'lfo', amount: 0.5,
      target: { parameterId: 'CONTENTS/F1FREQ', parameterName: 'Filter Frequency' } }] }] }],
  names: [['Polysynth']] }));

  await write('existing-fixture', 'add_devices', { devices: [{ kind: 'native', name: 'EQ-5' }, { kind: 'native', name: 'Gate' }] });
  results.push(await measure({ label: 'existing', position: 0, chains: [
    { name: 'Moved', devices: [{ source: { kind: 'existing-move', devicePosition: 1 } }, native('Tool')] },
    { name: 'Copied', devices: [{ source: { kind: 'existing-copy', devicePosition: 0 } }] },
  ], names: [['Gate', 'Tool'], ['EQ-5']] }));
  await tool('existing-cleanup', 'delete_device', { devices: [1, 0].map(devicePosition => ({ trackId: scratchId, devicePosition })) }, true);
  assert.equal((await read('existing-cleaned')).devices.length, 0);

  await write('anchors-16', 'add_devices', { devices: Array.from({ length: 16 }, () => ({ kind: 'native', name: 'Tool' })) });
  await write('anchors-18', 'add_devices', { devices: Array.from({ length: 2 }, () => ({ kind: 'native', name: 'Tool' })) });
  assert.equal((await read('anchors')).devices.length, 18);
  results.push(await measure({ label: 'six-at-18',
    chains: Array.from({ length: 6 }, (_, index) => ({ name: `Chain ${index}`, devices: [native('Tool')] })),
    names: Array.from({ length: 6 }, () => ['Tool']) }));

  await tool('cleanup', 'delete_track', { trackIds: [scratchId] }, true); scratchId = undefined;
  const afterTracks = await request('track.list'); assert.deepEqual(afterTracks.tracks, beforeTracks.tracks);
  for (const row of afterTracks.tracks) {
    const { result } = await tool(`preserved-after-${row.index}`, 'read_devices', { trackId: row.channelId });
    assert.deepEqual(result.data, preserved.get(row.channelId));
  }
  const afterSelection = await request('selection.status');
  assert.deepEqual(selectionFields(afterSelection), selectionFields(selected));
  record('result', { passed: true, cleanup: true, results, afterTracks, afterSelection, rig: await request('rig.info') });
  for (const item of results) {
    console.log(`${item.label}: compose ${item.compose.ms} ms / ${item.compose.turns} turns; revert ${item.revert.ms} ms / ${item.revert.turns} turns`);
  }
} catch (error) {
  record('stopped', { scratchId, scratchName, error: String(error), next: 'Inspect effects before any further write; never repeat automatically.' });
  for (const method of ['track.list', 'selection.status', 'rig.info']) {
    try { record(method.replace('.', '-'), await request(method)); } catch { /* retain original error */ }
  }
  throw error;
} finally { await transport.close(); }
