/** P01 structural deletion measurement. Deploy ghostnote probe, obtain controller replacement and run probe:hello first.
 * node --import tsx src/probes/p01-delete-live.ts --out NEW_DIRECTORY --operator-file FILE
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
class DeletionAdapter extends LiveAdapter {
  measuring = false;
  legacy = false;
  shapes: Wire[] = [];
  override async read(...args: Parameters<LiveAdapter['read']>) {
    if (this.measuring && args[0].some(a => a.kind === 'device')) {
      const ordinal = this.shapes.length;
      // Same current code and fixture: restore only the two executor captures to their old full shape.
      const options = this.legacy && ordinal > 0 ? { ...args[1], structure: false } : args[1];
      this.shapes.push({ ordinal, requestedStructure: args[1]?.structure, actualStructure: options?.structure });
      return super.read(args[0], options);
    }
    return super.read(...args);
  }
}
const adapter = new DeletionAdapter({ transport, expectRuntimeProfile: golden.identity, expectMethodsHash: golden.methodsHash });
const workspace = workspaceOf({ ready: async () => undefined, adapter, executor: new Executor(adapter),
  stash: new Stash(), observationStore: new FakeObservationStore(), documents: new IdentityRegistry() });
const scratchName = 'gn-p01-delete';
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

try {
  const hello = await request('contract.hello');
  assert.deepEqual([hello.runtimeProfile, hello.methodCount, hello.methodsHash], [golden.identity, golden.count, golden.methodsHash]);
  const stats = await request('rig.stats');
  assert.equal(compareDeployment(deployedAtMs(), stats.initEpochMs).state, 'fresh');
  const insertion = await request('probe.chainInsert', { operation: 'status' });
  assert.equal(insertion.marker, 'p01-chain-insert-v2');
  assert.equal(insertion.pendingReceipt, 0); assert.equal(insertion.uncertain, false);
  record('entry', { operator, hello, stats, insertion });
  await adapter.hello();
  assert.equal((await tool('connection', 'check_bitwig_connection')).result.target.project, values.project);
  const beforeTracks = await request('track.list'), selected = await request('selection.status');
  record('baseline', { beforeTracks, selected });
  const preserved = new Map<string, unknown>();
  for (const row of beforeTracks.tracks) {
    const { result } = await tool(`preserved-${row.index}`, 'read_devices', { trackId: row.channelId });
    assert.equal(result.coverage.status, 'complete'); preserved.set(row.channelId, result.data);
  }
  const measurements = [];
  for (const legacy of [true, false]) {
    const label = legacy ? 'full-capture' : 'structure';
    const added = await tool(`${label}-scratch`, 'add_tracks', { tracks: [{ name: scratchName }] }, true);
    scratchId = added.result.readback.tracks[0].trackId;
    assert.equal(typeof scratchId, 'string'); record(`${label}-owned`, { scratchId });
    await write(`${label}-fixture`, 'add_devices', { devices: [
      { kind: 'preset', path: OWNED_FX_LAYER_TEMPLATE_PATH }, native('Tool')] });
    const before = (await read(`${label}-before`)).result;
    assert.deepEqual(before.data.devices.map((d: Wire) => d.name), ['FX Layer', 'Tool']);
    const from = transport.calls.length;
    adapter.legacy = legacy; adapter.shapes = []; adapter.measuring = true;
    const deletion = await tool(`${label}-delete`, 'delete_device', { devices: [{ trackId: scratchId, devicePosition: 0 }] }, true);
    adapter.measuring = false;
    const calls = transport.calls.slice(from);
    assert.deepEqual(adapter.shapes.map(s => s.actualStructure), legacy ? [true, false, false] : [true, true, true]);
    const parameterCalls = calls.filter(c => c.method.startsWith('directparam.') || c.method === 'param.list');
    if (legacy) assert(parameterCalls.length > 0, 'comparison must exercise the old parameter capture');
    else assert.equal(parameterCalls.length, 0, 'structural deletion makes no parameter inventory calls');
    measurements.push({ label, ...deletion.measurement, parameterCalls: parameterCalls.length, shapes: adapter.shapes });
    const after = (await read(`${label}-after`)).result;
    assert.equal(after.coverage.status, 'complete');
    const expected = structuredClone(before.data); expected.devices.shift(); expected.devices[0].devicePosition = 0;
    assert.deepEqual(after.data, expected, 'only the requested FX Layer is removed; the following Tool shifts to zero');
    await tool(`${label}-cleanup`, 'delete_track', { trackIds: [scratchId] }, true); scratchId = undefined;
  }
  const afterTracks = await request('track.list'); assert.deepEqual(afterTracks.tracks, beforeTracks.tracks);
  for (const row of afterTracks.tracks) {
    const { result } = await tool(`preserved-after-${row.index}`, 'read_devices', { trackId: row.channelId });
    assert.deepEqual(result.data, preserved.get(row.channelId));
  }
  const afterSelection = await request('selection.status');
  assert.deepEqual(selectionFields(afterSelection), selectionFields(selected));
  record('result', { passed: true, cleanup: true, measurements, afterTracks, afterSelection, rig: await request('rig.info') });
} catch (error) {
  record('stopped', { scratchId, scratchName, error: String(error), next: 'Inspect effects before any further write; never repeat automatically.' });
  for (const method of ['track.list', 'selection.status', 'rig.info']) {
    try { record(method.replace('.', '-'), await request(method)); } catch { /* retain original error */ }
  }
  throw error;
} finally { await transport.close(); }
