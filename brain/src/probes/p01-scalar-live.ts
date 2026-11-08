/** P01 scalar cohorts, live: set_device_controls and set_track_mixer through MCP dispatch on one scratch track.
 * Each write is read back independently with the read tool, one change is reverted and read back, and the scratch
 * track is removed. Every original track's structure, the track list and the selection must match the baseline.
 * Brain code only; run probe:hello first and confirm the normal build is loaded.
 * node --import tsx src/probes/p01-scalar-live.ts --out NEW_DIRECTORY --operator-file FILE [--project gn-scale-test]
 * Stop on uncertain effects; never auto-retry writes.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { gzipSync } from 'node:zlib';
import { LiveAdapter } from '../adapters/live/adapter.js';
import { IdentityRegistry } from '../bindings/identity-registry.js';
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
const scratchName = 'gn-p01-scalar';
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

/** Continuous controls: a discrete control admits only its returned values. */
const continuous = (items: Wire[]) => items.filter(item => typeof item.normalizedValue === 'number'
  && item.discreteValueCount === undefined);
const nextValue = (value: number): number => (value > 0.5 ? 0.25 : 0.75);
const close = (a: number, b: number) => Math.abs(a - b) <= 2e-3;

async function directValues(label: string, device: Wire): Promise<Map<string, number>> {
  const { result } = await tool(label, 'read_device_controls', { device });
  assert.equal(result.standing, 'stable');
  return new Map((result.parameters as Wire[]).map(item => [item.id as string, item.normalizedValue as number]));
}

/** Write `count` continuous DirectParameters in one call and read every parameter back with the read tool. */
async function directCase(label: string, device: Wire, count: number, revert = false,
  only: (id: string) => boolean = () => true): Promise<Wire> {
  const { result: read } = await tool(`${label}-read`, 'read_device_controls', { device });
  const targets = continuous(read.parameters as Wire[]).filter(item => only(item.id)).slice(0, count);
  assert.equal(targets.length, count, `${label}: ${count} continuous controls`);
  const before = await directValues(`${label}-before`, device);
  const requested = new Map(targets.map(item => [item.id as string, nextValue(before.get(item.id)!)]));
  const set = await tool(`${label}-set`, 'set_device_controls', { settings: [...requested].map(([parameterId, value]) => ({
    kind: 'direct', device, parameterId, normalizedValue: value })) }, true);
  assert.equal(set.result.verified, true, `${label} is not verified`);
  const after = await directValues(`${label}-after`, device);
  for (const [id, prior] of before) {
    const wanted = requested.get(id);
    assert(close(after.get(id)!, wanted ?? prior), `${label} ${id}: ${wanted === undefined ? 'unrequested' : 'requested'} `
      + `${wanted ?? prior}, read ${after.get(id)}`);
  }
  let reverted: Wire | undefined;
  if (revert) {
    const changeId = set.result.parameterChanges[0].changes[0].changeId as string;
    reverted = (await tool(`${label}-revert`, 'revert_change', { changeId }, true)).measurement;
    const restored = await directValues(`${label}-restored`, device);
    const [id] = [...requested.keys()];
    assert(close(restored.get(id!)!, before.get(id!)!), `${label} revert ${id}`);
  }
  return { label, count, set: set.measurement, ...(reverted === undefined ? {} : { revert: reverted }) };
}

try {
  const hello = await request('contract.hello');
  assert.deepEqual([hello.runtimeProfile, hello.methodCount, hello.methodsHash],
    [golden.identity, golden.count, golden.methodsHash]);
  const rig = await request('rig.info');
  assert.equal(rig.windowWriteBlock ?? null, null, 'no write block');
  const stats = await request('rig.stats');
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
  const mixers = (await tool('mixers-before', 'read_track_mixer', {
    trackIds: beforeTracks.tracks.slice(0, 8).map((t: Wire) => t.channelId) })).result.data;

  const added = await tool('scratch', 'add_tracks', { tracks: [{ name: scratchName }] }, true);
  scratchId = added.result.readback.tracks[0].trackId;
  assert.equal(typeof scratchId, 'string'); record('owned', { scratchId });

  const results: Wire[] = [];
  await tool('add-polysynth', 'add_devices', { trackId: scratchId, devices: [{ kind: 'native', name: 'Polysynth' }] }, true);
  const poly = { trackId: scratchId, devicePosition: 0 };
  const all = continuous((await tool('poly-inventory', 'read_device_controls', { device: poly })).result.parameters);
  results.push(await directCase('poly-1', poly, 1, true));
  results.push(await directCase('poly-8', poly, 8));
  results.push(await directCase(`poly-${all.length}`, poly, all.length));

  // Remote controls: every continuous visible control, up to 64, in one call, then the remote view read back.
  const pages = (await tool('remotes-before', 'read_device_controls', { device: poly, view: 'remote-controls' }))
    .result.remotePages as Wire[];
  const remotes = pages.flatMap(page => continuous(page.controls as Wire[]).map(control => ({ kind: 'remote', device: poly,
    pagePosition: page.position, pageName: page.name, controlPosition: control.position, controlName: control.name,
    normalizedValue: nextValue(control.normalizedValue) }))).slice(0, 64);
  const remoteSet = await tool(`remote-${remotes.length}-set`, 'set_device_controls', { settings: remotes }, true);
  assert.equal(remoteSet.result.verified, true);
  const remoteAfter = (await tool('remotes-after', 'read_device_controls', { device: poly, view: 'remote-controls' }))
    .result.remotePages as Wire[];
  for (const item of remotes) {
    const control = remoteAfter.find(page => page.position === item.pagePosition)!.controls
      .find((c: Wire) => c.position === item.controlPosition);
    assert(close(control.normalizedValue, item.normalizedValue), `remote ${item.pageName}/${item.controlName}`);
  }
  results.push({ label: `remote-${remotes.length}`, count: remotes.length, set: remoteSet.measurement });

  // A depth-1 route: one EQ-5 inside an FX Layer chain after the Polysynth.
  await tool('compose-layer', 'compose_devices', { trackId: scratchId, containerKind: 'FX Layer',
    layerChains: [{ name: 'Chain 0', devices: [{ source: { kind: 'native', name: 'EQ-5' } }] }] }, true);
  const nested = { trackId: scratchId, devicePosition: 1, route: [{ through: 'layer-chain', name: 'Chain 0', devicePosition: 0 }] };
  // EQ-5 band type is a switch without a reported discrete domain (baseline run 1); write gain, frequency and Q.
  results.push(await directCase('nested-eq5-8', nested, 8, false, id => /^CONTENTS\/(GAIN|FREQ|Q)\d$/.test(id)));

  // Mixer: three fields on the scratch track, read back with the read tool, then reverted.
  const mixerOf = (row: Wire) => [row.volume.db, row.pan.value, row.mute];
  const mixerBefore = (await tool('mixer-before', 'read_track_mixer', { trackIds: [scratchId] })).result.data.tracks[0];
  const mixerSet = await tool('mixer-set', 'set_track_mixer', { tracks: [{ trackId: scratchId, volumeDb: -12, pan: 0.25,
    mute: true }] }, true);
  const mixerAfter = (await tool('mixer-after', 'read_track_mixer', { trackIds: [scratchId] })).result.data.tracks[0];
  assert.deepEqual(mixerOf(mixerAfter), [-12, 0.25, true], JSON.stringify(mixerAfter));
  const mixerRevert = await tool('mixer-revert', 'revert_change', { changeId: mixerSet.result.next.revert.changeId }, true);
  const mixerRestored = (await tool('mixer-restored', 'read_track_mixer', { trackIds: [scratchId] })).result.data.tracks[0];
  assert.deepEqual(mixerOf(mixerRestored), mixerOf(mixerBefore), JSON.stringify(mixerRestored));
  results.push({ label: 'mixer-3', set: mixerSet.measurement, revert: mixerRevert.measurement });

  await tool('cleanup', 'delete_track', { trackIds: [scratchId] }, true); scratchId = undefined;
  const afterTracks = await request('track.list'); assert.deepEqual(afterTracks.tracks, beforeTracks.tracks);
  for (const row of afterTracks.tracks) {
    const { result } = await tool(`preserved-after-${row.index}`, 'read_devices', { trackId: row.channelId });
    assert.deepEqual(result.data, preserved.get(row.channelId));
  }
  const mixersAfter = (await tool('mixers-after', 'read_track_mixer', {
    trackIds: beforeTracks.tracks.slice(0, 8).map((t: Wire) => t.channelId) })).result.data;
  assert.deepEqual(mixersAfter, mixers);
  const afterSelection = await request('selection.status');
  assert.deepEqual(selectionFields(afterSelection), selectionFields(selected));
  record('result', { passed: true, cleanup: true, results, afterTracks, afterSelection });
  for (const item of results) {
    console.log(`${item.label}: set ${item.set.ms} ms / ${item.set.turns} turns`
      + (item.revert === undefined ? '' : `; revert ${item.revert.ms} ms / ${item.revert.turns} turns`));
  }
} catch (error) {
  record('stopped', { scratchId, scratchName, error: String(error), next: 'Inspect effects before any further write; never repeat automatically.' });
  for (const method of ['track.list', 'selection.status', 'rig.info']) {
    try { record(method.replace('.', '-'), await request(method)); } catch { /* retain original error */ }
  }
  throw error;
} finally { await transport.close(); }
