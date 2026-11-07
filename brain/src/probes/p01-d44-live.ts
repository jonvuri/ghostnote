/** P01 D44 measurement: staged compose_devices shapes above the six-unit limit, and their revert_change.
 * The candidate shapes are admitted only through the benchmark option of composeDevices; no tool input reaches it.
 * Deploy normal ghostnote, obtain controller replacement and run probe:hello first.
 * node --import tsx src/probes/p01-d44-live.ts --out NEW_DIRECTORY --operator-file FILE [--project gn-scale-test]
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
import { composeDevices } from '../surface/agent-native-devices.js';
import { AGENT_NATIVE_TOOL_PROFILE, callTool, callToolSpec, toolsForProfile } from '../surface/tools.js';
import { workspaceOf } from '../surface/workspace.js';
import { readGolden } from '../tools/wire-golden.js';
import { WireTransport } from './phase8h3c-promotion.js';

type Wire = Record<string, any>;
const { values } = parseArgs({ options: {
  out: { type: 'string' }, 'operator-file': { type: 'string' },
  project: { type: 'string', default: 'gn-scale-test' },
  /**
   * candidates: shapes above the six-unit limit; limit: the worst new-source shapes at 16 units and 8 layer chains;
   * existing: 8 existing sources (4 moves, 4 copies) into 8 chains at the end of an 18-device track;
   * layer-tools: duplicate_layer_chain and rename_layer_chain on a composed container, read back independently;
   * add-devices: add_devices of native, VST3 and native devices (projected and read chains), read back independently;
   * chains (E409): names carried by the 16-chain seed (ASCII punctuation; a non-ASCII name falls back to a live
   * rename), then 8x2, 12x1 and 16x1 at the end of an 18-device track;
   * unicode-names (E410): non-ASCII names, a surrogate pair included, written into the seed as UTF-16.
   */
  set: { type: 'string', default: 'candidates' },
} });
assert(['candidates', 'limit', 'existing', 'layer-tools', 'add-devices', 'chains', 'unicode-names'].includes(values.set!),
  '--set candidates|limit|existing|layer-tools|add-devices|chains');
assert(values.out && values['operator-file'], 'required: --out NEW_DIRECTORY --operator-file FILE');
const operator = JSON.parse(readFileSync(values['operator-file'], 'utf8')) as Wire;
assert(typeof operator.reply === 'string' && operator.reply.trim(), 'record the actual operator confirmation');
mkdirSync(values.out, { recursive: false });

const transport = new WireTransport();
const golden = readGolden();
const adapter = new LiveAdapter({ transport, expectRuntimeProfile: golden.identity, expectMethodsHash: golden.methodsHash });
const workspace = workspaceOf({ ready: async () => undefined, adapter, executor: new Executor(adapter),
  stash: new Stash(), observationStore: new FakeObservationStore(), documents: new IdentityRegistry() });
const scratchName = 'gn-p01-d44';
/** compose_devices with the candidate limits; everything else is the tool's own spec and input validation. */
const MEASUREMENT_LIMITS = { layerChains: 16, devices: 16, modulators: 4 };
const composeSpec = { ...toolsForProfile(AGENT_NATIVE_TOOL_PROFILE).find(item => item.name === 'compose_devices')!,
  run: (scoped: Parameters<typeof composeDevices>[0], input: unknown) =>
    composeDevices(scoped, input as Parameters<typeof composeDevices>[1], { measurementLimits: MEASUREMENT_LIMITS }) };
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
  const result = (name === 'compose_devices'
    ? await callToolSpec(workspace, composeSpec as never, args)
    : await callTool(workspace, name, args, AGENT_NATIVE_TOOL_PROFILE)) as Wire;
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
  /** The container's position after the composition when existing moves from before it shift it. */
  readonly at?: number;
  readonly chains: readonly { readonly name: string; readonly devices: readonly Wire[] }[];
  /** Expected device names per chain; undefined entries are plug-in names that are only counted. */
  readonly names: readonly (readonly (string | undefined)[])[];
  /** E409: whether a live layer-chain naming stage is expected; checked only when stated. */
  readonly liveNaming?: boolean;
}

/** Compose, read back independently, revert, and read the exact original structure back. */
async function measure(test: Case): Promise<Wire> {
  const before = await read(`${test.label}-before`);
  const composed = await write(`${test.label}-compose`, 'compose_devices', {
    containerKind: 'FX Layer', layerChains: test.chains,
    ...(test.position === undefined ? {} : { containerPosition: test.position }),
  });
  const position = test.at ?? test.position ?? before.devices.length;
  if (test.liveNaming !== undefined) {
    const stages: string[] = JSON.stringify(composed.result.effects ?? []).match(/grow-entries|entry-name/g) ?? [];
    assert.equal(stages.some(stage => stage === 'entry-name'), test.liveNaming, `naming stages: ${stages.join(',')}`);
    assert.equal(stages.includes('grow-entries'), false, 'no chain is grown live');
  }
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
  const chainsOf = (count: number, devices: readonly string[]) => Array.from({ length: count }, (_, index) => ({
    name: `Chain ${index}`, devices: devices.map(native) }));
  if (values.set === 'candidates') {
  results.push(await measure({ label: '4x3-native', chains: chainsOf(4, ['Tool', 'EQ-5', 'Gate']),
    names: Array.from({ length: 4 }, () => ['Tool', 'EQ-5', 'Gate']) }));
  results.push(await measure({ label: '4x4-native', chains: chainsOf(4, ['Tool', 'EQ-5', 'Gate', 'Tool']),
    names: Array.from({ length: 4 }, () => ['Tool', 'EQ-5', 'Gate', 'Tool']) }));
  results.push(await measure({ label: 'plugins-16-units', chains: Array.from({ length: 4 }, (_, index) => ({
    name: `Plug ${index}`, devices: [{ source: { kind: 'vst3', classUid: vst3.id } }, { source: { kind: 'clap', id: clap.id } }],
  })), names: Array.from({ length: 4 }, () => [undefined, undefined]) }));
  results.push(await measure({ label: 'modulated-4', chains: Array.from({ length: 4 }, (_, index) => ({
    name: `Mod ${index}`, devices: [{ ...native('Polysynth'), modulators: [{ location: 'container', modulator: 'lfo',
      amount: 0.5, target: { parameterId: 'CONTENTS/F1FREQ', parameterName: 'Filter Frequency' } }] }],
  })), names: Array.from({ length: 4 }, () => ['Polysynth']) }));
  }

  if (values.set === 'chains') {
    results.push(await measure({ label: 'preset-names', liveNaming: false, chains: [
      { name: 'Bass (sub) #1', devices: [native('Tool')] }, { name: 'Pad\'s "wide" - L/R', devices: [native('Tool')] },
      { name: 'x', devices: [native('Tool')] }], names: [['Tool'], ['Tool'], ['Tool']] }));
    results.push(await measure({ label: 'live-rename-fallback', liveNaming: true, chains: [
      { name: 'Später', devices: [native('Tool')] }, { name: 'Chain 1', devices: [native('Tool')] }],
    names: [['Tool'], ['Tool']] }));
  }

  if (values.set === 'unicode-names') {
    results.push(await measure({ label: 'unicode-names', liveNaming: false, chains: [
      { name: 'Später', devices: [native('Tool')] }, { name: 'Später € 音', devices: [native('Tool')] },
      { name: '𝄞 Keys', devices: [native('Tool')] }, { name: 'ASCII', devices: [native('Tool')] }],
    names: [['Tool'], ['Tool'], ['Tool'], ['Tool']] }));
  }

  if (values.set === 'add-devices') {
    const added = await write('add-mixed', 'add_devices', { devices: [{ kind: 'native', name: 'Tool' },
      { kind: 'native', name: 'EQ-5' }, { kind: 'vst3', id: vst3.id }, { kind: 'native', name: 'Gate' }] });
    const devices = (await read('add-mixed-after')).devices as Wire[];
    assert.equal(devices.length, 4);
    assert.deepEqual([0, 1, 3].map(at => devices[at].name), ['Tool', 'EQ-5', 'Gate']);
    results.push({ label: 'add-devices', add: added.measurement });
  } else if (values.set === 'layer-tools') {
    await write('layer-compose', 'compose_devices', { containerKind: 'FX Layer',
      layerChains: [{ name: 'One', devices: [native('Tool')] }] });
    const duplicated = await write('layer-duplicate', 'duplicate_layer_chain',
      { containerPosition: 0, layerChain: 'One', name: 'Two' });
    const renamed = await write('layer-rename', 'rename_layer_chain',
      { containerPosition: 0, layerChain: 'Two', name: 'Renamed' });
    const chains = (await read('layer-after')).devices[0].container.layerChains as Wire[];
    assert.deepEqual(chains.map(c => [c.name, c.devices.map((d: Wire) => d.name)]), [['One', ['Tool']], ['Renamed', ['Tool']]]);
    results.push({ label: 'layer-tools', duplicate: duplicated.measurement, rename: renamed.measurement });
  } else if (values.set !== 'unicode-names') {
  await write('anchors-16', 'add_devices', { devices: Array.from({ length: 16 }, () => ({ kind: 'native', name: 'Tool' })) });
  await write('anchors-18', 'add_devices', { devices: Array.from({ length: 2 }, () => ({ kind: 'native', name: 'Tool' })) });
  assert.equal((await read('anchors')).devices.length, 18);
  if (values.set === 'chains') {
    results.push(await measure({ label: 'eight-by-two-at-18', liveNaming: false, position: 18,
      chains: chainsOf(8, ['Tool', 'EQ-5']), names: Array.from({ length: 8 }, () => ['Tool', 'EQ-5']) }));
    results.push(await measure({ label: 'twelve-at-18', liveNaming: false, position: 18, chains: chainsOf(12, ['Tool']),
      names: Array.from({ length: 12 }, () => ['Tool']) }));
    results.push(await measure({ label: 'sixteen-at-18', liveNaming: false, position: 18, chains: chainsOf(16, ['Tool']),
      names: Array.from({ length: 16 }, () => ['Tool']) }));
  } else if (values.set === 'candidates') {
    results.push(await measure({ label: 'sixteen-at-18', position: 18, chains: chainsOf(16, ['Tool']),
      names: Array.from({ length: 16 }, () => ['Tool']) }));
  } else if (values.set === 'existing') {
    results.push(await measure({ label: 'eight-existing-at-18', position: 18, at: 14, chains: Array.from({ length: 8 }, (_, index) => ({
      name: `Existing ${index}`,
      devices: [{ source: { kind: index % 2 === 0 ? 'existing-move' : 'existing-copy', devicePosition: index } }] })),
    names: Array.from({ length: 8 }, () => ['Tool']) }));
  } else {
    results.push(await measure({ label: 'eight-by-two-at-18', position: 18, chains: chainsOf(8, ['Tool', 'EQ-5']),
      names: Array.from({ length: 8 }, () => ['Tool', 'EQ-5']) }));
    results.push(await measure({ label: 'eight-vst3-at-18', position: 18, chains: Array.from({ length: 8 }, (_, index) => ({
      name: `Plug ${index}`, devices: [{ source: { kind: 'vst3', classUid: vst3.id } }] })),
    names: Array.from({ length: 8 }, () => [undefined]) }));
  }
  }

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
    if (item.label === 'add-devices') {
      console.log(`add_devices ${item.add.ms} ms / ${item.add.turns} turns`);
      continue;
    }
    if (item.label === 'layer-tools') {
      console.log(`duplicate ${item.duplicate.ms} ms / ${item.duplicate.turns} turns; rename ${item.rename.ms} ms / ${item.rename.turns} turns`);
      continue;
    }
    console.log(`${item.label}: compose ${item.compose.ms} ms / ${item.compose.turns} turns; revert ${item.revert.ms} ms / ${item.revert.turns} turns`);
  }
} catch (error) {
  record('stopped', { scratchId, scratchName, error: String(error), next: 'Inspect effects before any further write; never repeat automatically.' });
  for (const method of ['track.list', 'selection.status', 'rig.info']) {
    try { record(method.replace('.', '-'), await request(method)); } catch { /* retain original error */ }
  }
  throw error;
} finally { await transport.close(); }
