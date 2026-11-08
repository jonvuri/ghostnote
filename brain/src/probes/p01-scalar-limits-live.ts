/** P01 set_device_controls limits, live: u-he Diva (CLAP, 281 DirectParameters) routes on one scratch track.
 * 4, 8, 12 and 16 Diva routes with 16 settings each, then one route with 64 settings and one with every continuous
 * control. Shapes above the public limits (64 settings, 4 routes) are admitted only through this driver's copy of the
 * tool spec, which skips the two limit checks; no tool input reaches it. Each write is read back independently with
 * read_device_controls on every route, one change is reverted, and the scratch track is removed. Every original
 * track's structure, the track list and the selection must match the baseline. The audio engine must be on (E244).
 * node --import tsx src/probes/p01-scalar-limits-live.ts --out NEW_DIRECTORY --operator-file FILE [--project gn-scale-test]
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
import { setDeviceControls, type ParameterSetting } from '../surface/device-controls.js';
import { AGENT_NATIVE_TOOL_PROFILE, callTool, callToolSpec, toolsForProfile } from '../surface/tools.js';
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
const scratchName = 'gn-p01-scalar-limits';
const DIVA = 'com.u-he.Diva';
/** set_device_controls without its two D44 limit checks; everything else is the tool's own spec and validation. */
const setSpec = { ...toolsForProfile(AGENT_NATIVE_TOOL_PROFILE).find(item => item.name === 'set_device_controls')!,
  run: (scoped: Parameters<typeof setDeviceControls>[0], input: unknown) =>
    setDeviceControls(scoped, { settings: (input as { settings: ParameterSetting[] }).settings }) };
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
  const result = (name === 'set_device_controls'
    ? await callToolSpec(workspace, setSpec as never, args)
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

/** Continuous controls; Diva switches without a domain read back exactly only at the endpoints (E252). */
const continuous = (items: Wire[]) => items.filter(item => typeof item.normalizedValue === 'number'
  && item.discreteValueCount === undefined);
const endpoint = (value: number): number => (value > 0.5 ? 0 : 1);
const close = (a: number, b: number) => Math.abs(a - b) <= 2e-3;
const route = (devicePosition: number) => ({ trackId: scratchId, devicePosition });

/** The current values of every route, read with the read tool. */
const state = new Map<number, Map<string, number>>();
const writableIds = new Map<number, string[]>();
async function readRoute(label: string, position: number): Promise<void> {
  const { result } = await tool(label, 'read_device_controls', { device: route(position) });
  assert.equal(result.standing, 'stable', `Diva ${position}: turn the audio engine on`);
  state.set(position, new Map((result.parameters as Wire[]).map(item => [item.id as string, item.normalizedValue as number])));
  if (!writableIds.has(position)) writableIds.set(position, continuous(result.parameters).map(item => item.id as string));
}
async function addDivas(label: string, count: number): Promise<void> {
  const before = state.size;
  await tool(label, 'add_devices', { trackId: scratchId, devices: Array.from({ length: count }, () => ({ kind: 'clap', id: DIVA })) }, true);
  for (let position = before; position < before + count; position++) await readRoute(`${label}-read-${position}`, position);
}

/** Write `perRoute` settings on each of `routes` Diva routes in one call; read every route back independently. */
async function measure(label: string, routes: number, perRoute: number, required = true): Promise<Wire> {
  const requested = new Map<number, Map<string, number>>();
  for (let position = 0; position < routes; position++) {
    const ids = writableIds.get(position)!.slice(0, perRoute);
    assert.equal(ids.length, perRoute, `Diva ${position} has ${perRoute} continuous controls`);
    requested.set(position, new Map(ids.map(id => [id, endpoint(state.get(position)!.get(id)!)])));
  }
  const settings = [...requested].flatMap(([position, values]) => [...values].map(([parameterId, value]) => ({
    kind: 'direct', device: route(position), parameterId, normalizedValue: value })));
  if (!required) await beforeWrite();
  const set = required
    ? await tool(`${label}-set`, 'set_device_controls', { settings }, true)
    : await tool(`${label}-set`, 'set_device_controls', { settings }, false).catch((error: unknown) => ({ error }));
  const differences: string[] = [];
  for (let position = 0; position < routes; position++) {
    const before = state.get(position)!;
    await readRoute(`${label}-after-${position}`, position);
    const after = state.get(position)!;
    for (const [id, prior] of before) {
      const wanted = requested.get(position)!.get(id);
      if (!close(after.get(id)!, wanted ?? prior)) differences.push(`${position}/${id}: ${wanted === undefined
        ? 'unrequested' : 'requested'} ${wanted ?? prior}, read ${after.get(id)}`);
    }
  }
  if ('error' in set) return { label, routes, perRoute, settings: settings.length, error: String(set.error), differences };
  if (required) {
    assert.equal(set.result.verified, true, `${label} is not verified`);
    assert.deepEqual(differences, [], `${label}: independent readback`);
  }
  return { label, routes, perRoute, settings: settings.length, set: set.measurement, verified: set.result.verified,
    differences, ...(required ? {} : { result: set.result }) };
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

  const added = await tool('scratch', 'add_tracks', { tracks: [{ name: scratchName }] }, true);
  scratchId = added.result.readback.tracks[0].trackId;
  assert.equal(typeof scratchId, 'string'); record('owned', { scratchId });

  const results: Wire[] = [];
  await addDivas('add-diva-4', 4);
  results.push(await measure('routes-4x16', 4, 16));
  const changeId = (await (async () => {
    const { result } = await tool('revert-probe-set', 'set_device_controls', { settings: [{ kind: 'direct', device: route(0),
      parameterId: writableIds.get(0)![0], normalizedValue: endpoint(state.get(0)!.get(writableIds.get(0)![0])!) }] }, true);
    return result.parameterChanges[0].changes[0].changeId as string;
  })());
  const prior = state.get(0)!.get(writableIds.get(0)![0])!;
  const reverted = await tool('revert-one', 'revert_change', { changeId }, true);
  await readRoute('revert-one-after', 0);
  assert(close(state.get(0)!.get(writableIds.get(0)![0])!, prior), 'revert restores the base value');
  results.push({ label: 'revert-one', revert: reverted.measurement });
  for (const routes of [8, 12, 16]) {
    await addDivas(`add-diva-${routes}`, 4);
    results.push(await measure(`routes-${routes}x16`, routes, 16));
  }
  results.push(await measure('route-1x64', 1, 64));
  const every = writableIds.get(0)!.length;
  results.push(await measure(`route-1x${every}`, 1, every, false));
  record('results', results);

  await tool('cleanup', 'delete_track', { trackIds: [scratchId] }, true); scratchId = undefined;
  const afterTracks = await request('track.list'); assert.deepEqual(afterTracks.tracks, beforeTracks.tracks);
  for (const row of afterTracks.tracks) {
    const { result } = await tool(`preserved-after-${row.index}`, 'read_devices', { trackId: row.channelId });
    assert.deepEqual(result.data, preserved.get(row.channelId));
  }
  const afterSelection = await request('selection.status');
  assert.deepEqual(selectionFields(afterSelection), selectionFields(selected));
  record('result', { passed: true, cleanup: true, results, afterTracks, afterSelection });
  for (const item of results) {
    console.log(item.revert !== undefined ? `${item.label}: ${item.revert.ms} ms / ${item.revert.turns} turns`
      : item.error !== undefined ? `${item.label}: error ${item.error.slice(0, 200)}`
      : `${item.label} (${item.settings} settings): ${item.set.ms} ms / ${item.set.turns} turns; verified ${item.verified}; `
        + `readback differences ${item.differences.length}`);
  }
} catch (error) {
  record('stopped', { scratchId, scratchName, error: String(error), next: 'Inspect effects before any further write; never repeat automatically.' });
  for (const method of ['track.list', 'selection.status', 'rig.info']) {
    try { record(method.replace('.', '-'), await request(method)); } catch { /* retain original error */ }
  }
  throw error;
} finally { await transport.close(); }
