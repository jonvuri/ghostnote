/** Fixed V13 operator audio protocol. Prepare, run, and restore have separate operator boundaries. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, lstatSync, mkdirSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
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
  ask?: (check: ListeningCheck) => Promise<{ verdict: string; answer: string }>;
};
export const ENGINE_MARKER = '9a-grid-audio-v13';
export const ENGINE_HASH = '2e939035ea90b8b0';
export const ENGINE_BUDGET = Object.freeze({ calls: 240, fixtureCaptures: 59, detachedCaptures: 2,
  factories: 1, graphEdits: 11, noteWrites: 0, acknowledgements: 8, recoveryCalls: 4 });
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
export type ListeningCheck = { name: string; prompt: string };
export const LISTENING_CHECKS: ListeningCheck[] = [
  { name: 'B+', prompt: 'Can you hear the steady baseline tone?' },
  { name: 'B0', prompt: 'Has the tone stopped?' },
  { name: 'B-return', prompt: 'Has the tone returned to the baseline level?' },
  { name: 'N+', prompt: 'Can you hear the tone at the baseline level through the new Amplify?' },
  { name: 'N0', prompt: 'Has the tone stopped?' },
  { name: 'N-half', prompt: 'Is the tone audible and clearly quieter than at N+?' },
  { name: 'N-return', prompt: 'Has the tone returned to the N+ level?' },
  { name: 'R+', prompt: 'Has the original baseline tone remained after removal of the new Amplify?' },
];
export async function runEngine(request: Request, options: Options, ui: Wire): Promise<void> {
  fresh(ui, options); assert.equal(ui.engineActive, true); assert.equal(ui.isolationConfirmed, true);
  assert.ok(options.ask, 'An operator answer source is required'); options.verifyFiles();
  const start = options.now(); let segmentStart = start;
  const answers: Wire[] = [];
  function deadline() {
    assert.ok(options.now() - start <= 900_000, 'Operator session expired');
    assert.ok(options.now() - segmentStart <= 60_000, 'Automatic segment expired');
  }
  try {
    const begin = await request(method, { operation: 'sessionBegin', observedAt: ui.observedAt, isolationConfirmed: true });
    options.save('session-begin', begin); assert.equal(typeof begin.session, 'string'); assert.ok(begin.session.length > 0);
    const scoped: Request = (name, params = {}) => request(name, name === method ? { ...params, session: begin.session } : params);
    async function listen(name: string) {
      deadline(); await options.wait(1000); deadline();
      const check = LISTENING_CHECKS.find(c => c.name === name)!;
      const promptedAt = options.now(); options.save(`prompt-${name}`, { ...check, session: begin.session, promptedAt });
      let timer: ReturnType<typeof setTimeout> | undefined;
      const answer = await Promise.race([
        options.ask!(check),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Operator session expired')), Math.max(0, 900_000 - (options.now() - start))); }),
      ]).finally(() => clearTimeout(timer));
      const answeredAt = options.now();
      assert.ok(answeredAt - start <= 900_000, 'Operator session expired');
      assert.ok(['yes', 'no', 'unsure'].includes(answer.verdict));
      assert.ok(answer.answer.trim().length > 0 && Buffer.byteLength(answer.answer) <= 128);
      const row = { name, ...answer, promptedAt, answeredAt }; answers.push(row); options.save(`answer-${name}`, row);
      const ack = await scoped(method, { operation: 'operatorAck', ...row }); options.save(`ack-${name}`, ack);
      assert.equal(ack.session, begin.session); assert.equal(ack.answers.length, answers.length);
      assert.equal(ack.answers.at(-1).name, name); assert.equal(ack.answers.at(-1).answer, answer.answer);
      assert.equal(ack.answers.at(-1).verdict, answer.verdict);
      assert.equal(answer.verdict, 'yes', `Operator answered ${answer.verdict} at ${name}`); assert.equal(ack.locked, false);
      segmentStart = options.now();
    }
    await listen('B+');
    const after: Wire = { 1: 'B0', 2: 'B-return', 5: 'N+', 6: 'N0', 7: 'N-half', 8: 'N-return', 11: 'R+' };
    for (let stage = 1; stage <= 11; stage++) {
      deadline(); await graphWorkflow(scoped, scope(options, `stage-${stage}`), 'stage', stage); deadline();
      if (after[stage]) await listen(after[stage]);
    }
    const status = await scoped(method, { operation: 'status' }); options.save('status', status);
    assert.equal(status.locked, false); assert.equal(status.nativeUnfinished, false); assert.equal(status.next, 'complete');
    options.save('audio-verdict', { status: 'operator-audio-passes; exact restoration required',
      marker: ENGINE_MARKER, session: begin.session, answers,
      graphEvidence: Object.fromEntries([[0, 'B+'], ...Object.entries(after).map(([stage, name]) => [Number(stage), name])]
        .map(([stage, name]) => [name, { phase: stage === 0 ? 'prepare' : 'run',
          pairedReads: stage === 0 ? ['baseline-before-0.json', 'baseline-before-1.json']
            : [`stage-${stage}-after-0.json`, `stage-${stage}-after-1.json`] }])) });
  } catch (error) {
    // These calls have no document task or inverse edit.
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
  const inputLines = mode === 'run' ? createInterface({ input: process.stdin, crlfDelay: Infinity }) : undefined;
  const lines = inputLines?.[Symbol.asyncIterator]();
  const options: Options = { save, settle: () => wait(150), wait, now: Date.now, verifyFiles: () => files(config), deployedAt: deployedAtMs(),
    ask: async check => {
      console.log(JSON.stringify({ listeningCheck: check.name, prompt: check.prompt, answer: 'yes | no | unsure' }));
      const line = await lines!.next(); if (line.done) throw new Error('Operator input closed');
      return { verdict: line.value.trim().toLowerCase(), answer: line.value };
    } };
  try {
    save('input', config);
    if (mode === 'prepare') { save('prepared', await prepareEngine(request, options, config)); assert.equal(calls.length, 16); }
    else if (mode === 'run') { await runEngine(request, options, config); assert.equal(calls.length, 208); }
    else if (mode === 'restore') { await restoreEngine(request, options, config); assert.equal(calls.length, 16); }
    else if (mode === 'recover') { await recoverEngine(request, config, save); assert.equal(calls.length, 4); }
    else save('status', await request(method, { operation: 'status' }));
    console.log(JSON.stringify({ mode, output, calls: calls.length }));
  } finally { inputLines?.close(); save('calls', calls); client.disconnect(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
