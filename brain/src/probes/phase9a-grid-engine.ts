/** Fixed V12 protocol. Prepare, run, and restore have separate operator boundaries. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, lstatSync, mkdirSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { BridgeClient } from '../client.js';
import { compareDeployment, deployedAtMs } from '../deploy.js';
import { expectedAttachment } from './phase9a-grid-attachment.js';

type Wire = Record<string, any>;
export type Request = (method: string, params?: Wire) => Promise<Wire>;
export type Options = {
  save: (name: string, value: unknown) => void; settle: () => Promise<void>;
  wait: (ms: number) => Promise<void>; now: () => number; verifyFiles: () => void;
  deployedAt: number | undefined;
};
export const ENGINE_MARKER = '9a-grid-engine-v12';
export const ENGINE_HASH = '2e939035ea90b8b0';
export const ENGINE_BUDGET = Object.freeze({ calls: 252, fixtureCaptures: 59, detachedCaptures: 2,
  factories: 1, graphEdits: 11, noteWrites: 16, windows: 10, recoveryCalls: 4 });
const method = 'probe.gridEngine';
const node = (g: Wire, id: number): Wire => { const n = g.nodes.find((n: Wire) => n.id === id); assert.ok(n); return n; };
const property = (n: Wire, id: number): Wire => { const p = n.properties.find((p: Wire) => p.id === id); assert.ok(p); return p; };
const scalar = (n: Wire, id: number): any => property(n, id).value.data;
const atom = (g: Wire, module: number, index: number): number => {
  const m = node(g, property(node(g, 0), 6428).refs[module]);
  return property(node(g, property(m, 406).refs[0]), 173).refs[index];
};
export function expectedStage(graph: Wire, stage: number, receipt?: Wire): Wire[] {
  if (stage === 3) return expectedAttachment(graph, receipt!);
  const g = structuredClone(graph);
  if ([1, 2, 6, 7, 8].includes(stage)) {
    const value = ({ 1: 0, 2: 0.6299605249474366, 6: 0, 7: 0.7937005259840998, 8: 1 } as Wire)[stage];
    for (const id of [712, 949]) property(node(g, atom(g, stage <= 2 ? 1 : 4, 1)), id).value.data = value;
  } else if ([4, 5, 9, 10].includes(stage)) {
    const dest = stage === 4 || stage === 10 ? 4 : 2;
    const p = property(node(g, atom(g, dest, dest === 2 ? 0 : 3)), 7125);
    p.refs = stage === 10 ? [] : [atom(g, stage === 5 ? 4 : 1, 0)]; p.count = p.refs.length;
  } else {
    assert.equal(stage, 11); const p = property(node(g, 0), 6428); assert.equal(p.refs.length, 5); p.refs.pop(); p.count = 4;
  }
  const ids = new Map<number, number>(), nodes: Wire[] = [];
  function visit(old: number): number {
    if (ids.has(old)) return ids.get(old)!;
    const id = nodes.length, n = structuredClone(node(g, old)); ids.set(old, id); n.id = id; nodes.push(n);
    for (const p of n.properties) if (p.refs) p.refs = p.refs.map(visit);
    assert.ok(nodes.length <= 61); return id;
  }
  visit(0); return nodes;
}
function checked(read: Wire) {
  assert.equal(read.marker, ENGINE_MARKER); assert.equal(read.graph.complete, true); assert.equal(read.graph.errorCount, 0);
  assert.ok(read.graph.nodes.length === 53 || read.graph.nodes.length === 61); assert.ok(read.witness);
}
function cohort(hello: Wire, rig: Wire, stats: Wire, options: Options) {
  assert.equal(hello.runtimeProfile, 'phase-8-probe-v1'); assert.equal(hello.methodCount, 118); assert.equal(hello.methodsHash, ENGINE_HASH);
  assert.equal(rig.gridReadProbe, ENGINE_MARKER); assert.equal(compareDeployment(options.deployedAt, stats.initEpochMs ?? -1).state, 'fresh');
}
export async function graphWorkflow(request: Request, options: Options, mode: 'entry' | 'stage' | 'restored', stage = 0, ui: Wire = {}): Promise<Wire> {
  const hello = await request('contract.hello'), rig = await request('rig.info'), stats = await request('rig.stats');
  cohort(hello, rig, stats, options);
  const host = await request('host.info'), revision = await request('revision.get'), selection = await request('selection.status');
  assert.equal(revision.project, 'gn-grid-spike');
  const tracks = await request('track.list'); const matches = tracks.tracks.filter((t: Wire) => t.name === 'grid-probe');
  assert.equal(matches.length, 1); const track = matches[0]; assert.ok(track.hidden === undefined || track.hidden === false);
  await request('cursor.pointTrack', { cursor: '0', trackIndex: track.index }); await options.settle();
  assert.equal((await request('devcursor.status')).trackChannelId, track.channelId);
  const devices = await request('device.list', { cursor: 0 }); assert.equal(devices.itemCount, devices.count);
  const grids = devices.devices.filter((d: Wire) => d.name === 'Poly Grid'); assert.equal(grids.length, 1); assert.equal(grids[0].index, 0);
  const target = { project: 'gn-grid-spike', trackId: track.channelId, trackName: 'grid-probe', deviceIndex: 0, deviceName: 'Poly Grid' };
  options.save('entry', { hello, rig, stats, host, revision, selection, tracks, devices, target });
  const bound = await request(method, { ...target, ...ui, operation: 'bind', mode, stage }); options.save('binding', bound);
  const params = { operation: 'read', epoch: bound.epoch };
  const before = await request(method, params); options.save('before-0', before); checked(before);
  const repeat = await request(method, params); options.save('before-1', repeat); checked(repeat);
  assert.deepEqual(repeat.graph.nodes, before.graph.nodes); assert.deepEqual(repeat.witness, before.witness);
  let final = repeat;
  if (mode === 'stage') {
    const command = await request(method, { operation: 'command', epoch: bound.epoch }); options.save('command', command); checked(command);
    assert.deepEqual(command.graph.nodes, before.graph.nodes); assert.deepEqual(command.witness, before.witness);
    assert.equal(command.writeStatus, 'command-returned; paired readback required');
    const expected = expectedStage(before.graph, stage, command.lifecycle), witness = structuredClone(before.witness);
    if (stage === 3) { witness.moduleUuids.push(command.lifecycle.attached.uuid); witness.rectangles.push(command.lifecycle.attached.rectangle); }
    if (stage === 11) { witness.moduleUuids.pop(); witness.rectangles.pop(); }
    for (let i = 0; i < 2; i++) {
      final = await request(method, params); options.save(`after-${i}`, final); checked(final);
      assert.deepEqual(final.graph.nodes, expected); assert.deepEqual(final.witness, witness);
    }
  }
  options.verifyFiles(); const after = await request('selection.status'); assert.deepEqual(after, selection); options.save('selection-after', after);
  await request(method, { operation: 'release', epoch: bound.epoch });
  return { target, read: final, initEpochMs: stats.initEpochMs };
}
function scope(options: Options, prefix: string): Options { return { ...options, save: (name, value) => options.save(`${prefix}-${name}`, value) }; }
function fresh(ui: Wire, options: Options) {
  assert.ok(Number.isFinite(ui.observedAt)); const age = options.now() - ui.observedAt; assert.ok(age >= 0 && age <= 60_000);
}
export async function prepareEngine(request: Request, options: Options, ui: Wire): Promise<Wire> {
  fresh(ui, options); assert.equal(ui.engineInactive, true); assert.equal(ui.isolationConfirmed, true); options.verifyFiles();
  const rig = await request('rig.info'); assert.equal(rig.gridReadProbe, ENGINE_MARKER); options.save('rig-entry', rig);
  return graphWorkflow(request, scope(options, 'baseline'), 'entry');
}
export function halfRatio(half: number, a: number, b: number) {
  assert.ok(half >= 0 && half < Math.min(a, b));
  const low = (half / (Math.max(a, b) + 1)) ** (1 / .3333), high = ((half + 1) / Math.min(a, b)) ** (1 / .3333);
  assert.ok(low >= .4 && high <= .6, `half-gain ratio ${low}..${high}`);
}
export function checkWindow(w: Wire, name: string): number {
  assert.equal(w.name, name); assert.equal(w.available, true); assert.equal(w.failure, '');
  assert.ok(w.elapsedNanos >= 1_250_000_000 && w.elapsedNanos <= 2_000_000_000);
  assert.ok(w.samples.length > 0 && w.samples.length <= 2048); assert.equal(w.samplesCount, w.samples.length);
  const pulse = !name.startsWith('Q'); let time = -1, peak = -1, last = -1, master = 0, notes = 0;
  for (let i = 0; i < w.samples.length; i++) {
    const [seq, t, kind, v] = w.samples[i]; assert.equal(seq, i); assert.ok(t >= time && t <= w.elapsedNanos); time = t;
    assert.ok(Number.isInteger(v) && v >= 0 && v <= 127); assert.ok([0, 1, 2].includes(kind));
    if (kind === 1) { master++; assert.ok(v <= 1); }
    if (kind === 2) { assert.ok(v === 0 || pulse && v === 60); notes = v; }
    if (kind === 0) {
      if (!pulse || t < 250_000_000) assert.ok(v <= 1);
      if (t >= 400_000_000 && t <= 800_000_000) { if (pulse) assert.equal(notes, 60); peak = Math.max(peak, v); }
      if (t >= 850_000_000) last = v;
    }
  }
  assert.ok(master > 0 && peak >= 0 && last >= 0 && last <= 1); assert.equal(notes, 0); assert.equal(w.peak, peak);
  for (const [begin, end] of w.packets) assert.ok(Number.isFinite(begin) && end > begin);
  assert.equal(w.packets.length, 2);
  if (pulse) for (const field of ['noteOnAttempted', 'noteOffAttempted', 'noteOnObserved', 'noteOffObserved']) assert.equal(w[field], true);
  return peak;
}
export async function runEngine(request: Request, options: Options, ui: Wire): Promise<void> {
  fresh(ui, options); assert.equal(ui.engineActive, true); assert.equal(ui.isolationConfirmed, true); options.verifyFiles();
  const start = options.now(), peaks: Wire = {};
  try {
    const begin = await request(method, { operation: 'sessionBegin', observedAt: ui.observedAt, isolationConfirmed: true }); options.save('session-begin', begin);
    async function window(name: string) {
      assert.ok(options.now() - start <= 60_000);
      const receipt = await request(method, { operation: 'windowBegin', name }); options.save(`window-${name}-begin`, receipt);
      await options.wait(1250);
      const collected = await request(method, { operation: 'windowCollect', name }); options.save(`window-${name}`, collected);
      const peak = checkWindow(collected.window, name); peaks[name] = peak;
      if (['Q0', 'Q1', 'B0', 'N0'].includes(name)) assert.ok(peak <= 1);
      else if (name === 'B+') assert.ok(peak >= 32 && peak <= 110);
      else if (name === 'N-half') halfRatio(peak, peaks['N+'], peaks['N+']);
      else assert.ok(Math.abs(peak - peaks['B+']) <= 3);
      if (name === 'N-return') { assert.ok(Math.abs(peak - peaks['N+']) <= 3); halfRatio(peaks['N-half'], peaks['N+'], peak); }
    }
    await window('Q0'); await window('B+');
    const after: Wire = { 1: 'B0', 2: 'B-return', 5: 'N+', 6: 'N0', 7: 'N-half', 8: 'N-return', 11: 'R+' };
    for (let stage = 1; stage <= 11; stage++) {
      assert.ok(options.now() - start <= 60_000);
      await graphWorkflow(request, scope(options, `stage-${stage}`), 'stage', stage);
      if (after[stage]) await window(after[stage]);
    }
    await window('Q1'); const status = await request(method, { operation: 'status' }); options.save('status', status);
    assert.equal(status.locked, false); assert.equal(status.nativeUnfinished, false); assert.equal(status.next, 'complete');
    options.save('signal-verdict', { status: 'bounded-signal-passes; operator restoration required', peaks });
  } catch (error) {
    // This has no document task or inverse edit. The scheduled owned note-off remains independent.
    try { options.save('abort', await request(method, { operation: 'abort' })); } catch (abortError) { options.save('abort-error', String(abortError)); }
    try { options.save('failure-status', await request(method, { operation: 'status' })); } catch (statusError) { options.save('status-error', String(statusError)); }
    throw error;
  }
}
export async function restoreEngine(request: Request, options: Options, ui: Wire): Promise<void> {
  fresh(ui, options); assert.equal(ui.engineInactive, true); assert.equal(ui.restorationConfirmed, true); options.verifyFiles();
  await graphWorkflow(request, scope(options, 'restored'), 'restored', 0,
    { observedAt: ui.observedAt, engineInactive: true, restorationConfirmed: true });
  const released = await request(method, { operation: 'sessionRelease' }); options.save('released', released);
  assert.equal(released.active, false); assert.equal(released.restored, true);
  assert.equal(released.nativeUnfinished, false); assert.equal(released.epochOpen, false); options.verifyFiles();
}
export async function recoverEngine(request: Request, target: Wire, save: Options['save']): Promise<void> {
  const bound = await request(method, { ...target, operation: 'bind', mode: 'recovery' }); save('binding', bound);
  // A failed read stops here. No second read or release is sent to an unfinished task.
  for (let i = 0; i < 2; i++) save(`read-${i}`, await request(method, { operation: 'read', epoch: bound.epoch }));
  save('release', await request(method, { operation: 'release', epoch: bound.epoch }));
}
function files(config: Wire) {
  for (const [key, hash] of Object.entries({ projectPath: 'af24056e72e9722eacaa80bf01daa02e7fba0c72103f7fd1655f689448da1b4f',
    backupPath: 'af24056e72e9722eacaa80bf01daa02e7fba0c72103f7fd1655f689448da1b4f',
    presetPath: '1e8f90fc3875dbeb1f38ed88bec59ee783f39bb00fb366194c79504e063c0cc9' })) {
    const path = config[key]; assert.ok(isAbsolute(path)); const stat = lstatSync(path); assert.ok(stat.isFile() && stat.size <= 32 * 1024 * 1024);
    assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'), hash, key);
  }
}
async function main() {
  const [mode, input, output] = process.argv.slice(2);
  assert.ok(['prepare', 'run', 'restore', 'recover', 'status'].includes(mode ?? ''), 'Usage: <prepare|run|restore|recover|status> <absolute-input.json> <new-output>');
  assert.ok(input && output && isAbsolute(input) && isAbsolute(output)); assert.ok(lstatSync(input).size <= 8192);
  const config = JSON.parse(readFileSync(input, 'utf8')); mkdirSync(output);
  const save: Options['save'] = (name, value) => writeFileSync(join(output, `${name}.json`), `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
  const client = new BridgeClient(), calls: Wire[] = [];
  const request: Request = async (name, params = {}) => {
    const start = performance.now();
    try { const r = await client.request(name, params) as Wire; calls.push({ name, operation: params.operation, ms: performance.now() - start, bytes: Buffer.byteLength(JSON.stringify(r)) }); return r; }
    catch (error) { calls.push({ name, operation: params.operation, ms: performance.now() - start, error: String(error) }); throw error; }
  };
  const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
  const options: Options = { save, settle: () => wait(150), wait, now: Date.now, verifyFiles: () => files(config), deployedAt: deployedAtMs() };
  try {
    save('input', config);
    if (mode === 'prepare') { save('prepared', await prepareEngine(request, options, config)); assert.equal(calls.length, 16); }
    else if (mode === 'run') { await runEngine(request, options, config); assert.equal(calls.length, 220); }
    else if (mode === 'restore') { await restoreEngine(request, options, config); assert.equal(calls.length, 16); }
    else if (mode === 'recover') { await recoverEngine(request, config, save); assert.equal(calls.length, 4); }
    else save('status', await request(method, { operation: 'status' }));
    console.log(JSON.stringify({ mode, output, calls: calls.length }));
  } finally { save('calls', calls); client.disconnect(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
