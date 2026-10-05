/**
 * 8h2a replay cold read. Live driver. Each subcommand writes one artifact and refuses the anchor project.
 *
 *   config <entry.json>                              write the research rig config (records the original)
 *   restore <entry.json>                             restore the original rig config
 *   setup <state.json>                               owned tracks: park, then one track for each fixture
 *   fixtures <state.json>                            write, decorate, and verify every fixture at row 0 of its track
 *   trials <out.json> <state.json> <name> [--n N]    experiments 1–4: bind from park, observe, decode, release
 *   edit <out.json> <state.json> <name> [--n N]      experiment 3: a write during one replay must refuse the read
 *   resubscribe <out.json> <state.json> <name> [--n N]
 *                                                    experiment 2, candidate 2: resubscribe of a pinned proxy
 *   e131 <out.json> <state.json> <name> [--n N]      experiment 4: paired E131 reads
 */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { open, readFile, unlink, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import { LiveAdapter } from '../adapters/live/adapter.js';
import { BridgeTransport } from '../adapters/live/transport.js';
import { BridgeClient } from '../client.js';
import { Executor } from '../engine/index.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { EXPERIMENTAL_7B_TOOL_PROFILE, callTool } from '../surface/tools.js';
import { workspaceOf } from '../surface/workspace.js';
import { ORIGINAL_CONFIG_SHA256, PROTECTED_PROJECT } from './phase8g5-consumers-lib.js';
import { HEAP_STOP_BYTES, exactSourceIssues, fixtureNote, oracleIndexes, parseHistogram, percentile } from './phase8h1a-knee-lib.js';
import { classCounts } from './phase8h1b-sounding-lib.js';
import { FIXTURES, ONE_NOTE, ORACLE_MS, REPLAY_MARKER, REPLAY_METHOD_COUNT, REPLAY_METHODS_HASH, REPLAY_PROFILE, completion, declaredNotes,
  decodeIssues, fixturePlan, replayConfig, startCandidates, summarizeTrials, targetedAgreement, undecorated, widthCells, windowVerdict,
  type DecodedRow, type DeclaredNote, type Defaults, type FixturePlan, type Wire } from './phase8h2a-replay-lib.js';

let activeMarker: string = REPLAY_MARKER;
let retiredNameAllowed = false;
export const setReplayMarker = (marker: string, allowRetiredName = false): void => { activeMarker = marker; retiredNameAllowed = allowRetiredName; };
const configPath = join(homedir(), '.ghostnote', 'rig.json');
const ANCHOR_PROJECT = 'gn-scale-test';
const NOTE_STEP_CLASS = 'com.bitwig.flt.control_surface.proxy.NoteStep';
const bridge = new BridgeClient();
const adapter = new LiveAdapter({ transport: new BridgeTransport(bridge) });
const workspace = workspaceOf({ ready: async () => undefined, adapter,
  executor: new Executor(adapter), stash: new Stash(), observationStore: new FakeObservationStore() });
const execute = promisify(execFile);
export const request = async (method: string, params?: Wire, timeout = 60_000): Promise<Wire> =>
  await bridge.request(method, params, timeout) as Wire;
export const shadow = async (operation: string, params: Wire = {}): Promise<Wire> => await request('cache.shadow', { operation, ...params });
export const wait = async (ms: number): Promise<void> => await new Promise(resolve => setTimeout(resolve, ms));
const hash = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');
export const readJson = async (path: string): Promise<Wire> => JSON.parse(await readFile(path, 'utf8')) as Wire;
export const save = async (path: string, value: Wire, create = false): Promise<void> =>
  await writeFile(path, JSON.stringify(value, null, 1) + '\n', create ? { flag: 'wx' } : {});
async function until(next: () => Promise<Wire>, done: (value: Wire) => boolean, limit = 60_000, interval = 30): Promise<Wire> {
  const started = performance.now();
  for (;;) {
    const value = await next(); if (done(value)) return value;
    assert(performance.now() - started < limit, `live state did not settle: ${JSON.stringify(value).slice(0, 600)}`);
    await wait(interval);
  }
}

/** Check the research runtime, marker, and an owned project. */
export async function guard(): Promise<Wire> {
  const hello = await request('contract.hello');
  assert.equal(hello.runtimeProfile, REPLAY_PROFILE); assert.equal(hello.methodCount, REPLAY_METHOD_COUNT);
  assert.equal(hello.methodsHash, REPLAY_METHODS_HASH);
  const info = await shadow('info'); assert.equal(info.instrumentationRevision, activeMarker);
  const status = await shadow('replayStatus'); assert.equal(status.revision, activeMarker);
  const allocation = await shadow('allocationStats');
  // D29: refuse the saved anchor. An owned project can reuse the retired name.
  const refused = retiredNameAllowed ? [ANCHOR_PROJECT] : [PROTECTED_PROJECT, ANCHOR_PROJECT];
  assert(!refused.includes(String(allocation.projectName)), 'never run in a protected or anchor project');
  assert(String(allocation.projectName).length > 0, 'project name unavailable');
  return { hello, project: allocation.projectName, configuration: info.activeConfiguration, stats: await request('rig.stats') };
}

/** Live set by class. A class histogram forces a full collection. Throw above the stop. */
async function heap(label: string): Promise<Wire> {
  const { stdout } = await execute('pgrep', ['-f', 'BitwigStudio --launch']);
  const pids = stdout.trim().split('\n').filter(Boolean);
  assert.equal(pids.length, 1, 'expected one Bitwig JVM process');
  const started = performance.now();
  const histogram = await execute('jcmd', [pids[0]!, 'GC.class_histogram'], { maxBuffer: 256 * 1024 * 1024 });
  const parsed = parseHistogram(histogram.stdout, 12), steps = classCounts(histogram.stdout, [NOTE_STEP_CLASS])[NOTE_STEP_CLASS]!;
  const sample = { label, capturedEpochMs: Date.now(), histogramMs: performance.now() - started, liveBytes: parsed.totalBytes,
    noteSteps: steps.instances, noteStepBytes: steps.bytes, top: parsed.top };
  console.log(JSON.stringify({ heap: label, liveMiB: Math.round(parsed.totalBytes / 2 ** 20), noteSteps: steps.instances }));
  assert(parsed.totalBytes < HEAP_STOP_BYTES, `live heap ${parsed.totalBytes} reached the stop at ${label}`);
  return sample;
}
async function pings(count = 20): Promise<number[]> {
  const samples: number[] = [];
  for (let n = 0; n < count; n++) { const start = performance.now(); await request('ping'); samples.push(performance.now() - start); }
  return samples;
}

async function config(entryPath: string): Promise<void> {
  const bytes = await readFile(configPath);
  let original = bytes;
  try { original = Buffer.from(String((await readJson(entryPath)).originalBase64), 'base64'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  assert.equal(hash(original), ORIGINAL_CONFIG_SHA256, 'unexpected original config');
  const research = replayConfig();
  await save(entryPath, { schema: 'phase8h2a-config-entry-v1', captured: new Date().toISOString(),
    originalSha256: hash(original), originalBase64: original.toString('base64'), research });
  await writeFile(configPath, JSON.stringify(research) + '\n');
  console.log(JSON.stringify({ research, researchSha256: hash(await readFile(configPath)) }));
}
export async function restore(entryPath: string): Promise<void> {
  const bytes = Buffer.from(String((await readJson(entryPath)).originalBase64), 'base64');
  assert.equal(hash(bytes), ORIGINAL_CONFIG_SHA256); await writeFile(configPath, bytes);
  assert.equal(hash(await readFile(configPath)), ORIGINAL_CONFIG_SHA256);
  console.log(JSON.stringify({ restoredSha256: ORIGINAL_CONFIG_SHA256 }));
}

interface Fixture extends FixturePlan { trackId: string; row: 0; written: boolean }
export async function trackIndexOf(id: string): Promise<number> {
  const track = ((await request('track.list')).tracks as Wire[]).find(row => row.channelId === id);
  assert(track, `owned track ${id} is absent`); return Number(track.index);
}
const parkId = (state: Wire): string => String((state.tracks as Wire).park);

/** Create the park track and one track for each fixture. The park track never holds a clip. */
export async function setup(statePath: string): Promise<void> {
  await guard();
  const state: Wire = { schema: 'phase8h2a-state-v1', tracks: {}, fixtures: {} };
  await save(statePath, state, true);
  for (const key of ['park', ...FIXTURES.map(row => row.name)]) {
    const before = await request('track.list'), ids = new Set((before.tracks as Wire[]).map(row => row.channelId));
    await request('track.create', { position: 0 });
    const after = await until(() => request('track.list'), value => (value.tracks as Wire[]).some(row => row.index === 0 && !ids.has(row.channelId)), 30_000, 50);
    const id = String((after.tracks as Wire[]).find(row => row.index === 0)!.channelId);
    (state.tracks as Wire)[key] = id; await save(statePath, state);
    await request('track.setName', { trackIndex: 0, name: `gn-8h2a-${key}` });
  }
  console.log(JSON.stringify({ tracks: state.tracks }));
}

export async function bindFixture(trackIndex: number, row: number): Promise<void> {
  await shadow('fixturePin', { pinned: false }); await shadow('fixturePoint', { trackIndex });
  const id = ((await request('track.list')).tracks as Wire[]).find(value => value.index === trackIndex)!.channelId;
  await until(() => shadow('fixtureStatus'), value => value.trackChannelId === id);
  await until(async () => {
    const value = await shadow('fixtureStatus');
    if (value.clipExists !== true || value.sceneIndex !== row) await shadow('fixtureSelect', { trackIndex, row });
    return value;
  }, value => value.clipExists === true && value.sceneIndex === row, 60_000, 200);
  await shadow('fixturePin', { pinned: true });
  await until(() => shadow('fixtureStatus'), value => value.trackPinned === true && value.clipPinned === true);
}
/** The fixture writer is full-width; park it so that it holds no grid. */
export async function parkFixture(state: Wire): Promise<void> {
  await shadow('fixturePin', { pinned: false }); await shadow('fixturePoint', { trackIndex: await trackIndexOf(parkId(state)) });
  await until(() => shadow('fixtureStatus'), value => value.trackChannelId === parkId(state) && value.clipExists === false);
}

/** Targeted host reads: oracle indexes for spec fixtures, the single note for `one`. */
function coordinatesOf(plan: FixturePlan): { indexes: number[]; coordinates: number[][] } {
  if (plan.kind === 'empty') return { indexes: [], coordinates: [[0, ONE_NOTE.pitch]] };
  if (plan.kind === 'one') return { indexes: [0], coordinates: [[ONE_NOTE.cell, ONE_NOTE.pitch]] };
  const indexes = oracleIndexes(plan.count);
  return { indexes, coordinates: indexes.map(i => { const n = fixtureNote(i, plan.count, widthCells(plan), 0, plan.cap); return [n.cell, n.pitch]; }) };
}
function targetedFieldIssues(notes: Wire[], expected: DeclaredNote[]): string[] {
  const issues: string[] = [];
  for (const note of expected) {
    const found = notes.filter(row => row.cell === note.cell && row.pitch === note.pitch);
    if (found.length !== 1 || found[0]!.channel !== note.channel) { issues.push(`coordinate ${note.cell}:${note.pitch} holds ${found.length}`); continue; }
    const row = found[0]!;
    if (Math.abs(Number(row.velocity) * 127 - note.velocity) >= 0.51) issues.push(`velocity at ${note.cell}`);
    if (row.durationCells !== note.durationCells) issues.push(`duration at ${note.cell}`);
    if (Math.abs(Number(row.gain) - note.gain) > 0.005) issues.push(`gain at ${note.cell}`);
    if (Math.abs(Number(row.chance) - note.chance) > 0.005) issues.push(`chance at ${note.cell}`);
    if (row.isChanceEnabled !== note.chanceEnabled) issues.push(`chanceEnabled at ${note.cell}`);
    if (row.isMuted !== note.muted) issues.push(`muted at ${note.cell}`);
  }
  if (notes.length !== expected.length) issues.push(`targeted read returned ${notes.length} for ${expected.length}`);
  return issues;
}
function expectedAt(plan: FixturePlan, indexes: number[], defaults: Defaults): DeclaredNote[] {
  const all = declaredNotes(plan, defaults);
  return plan.kind === 'one' ? all : indexes.map(i => all[i]!);
}

/** Write, decorate, and verify every fixture. The `one` note gives the host defaults; it is never decorated. */
export async function fixtures(statePath: string): Promise<void> {
  await guard();
  const state = await readJson(statePath), done = state.fixtures as Record<string, Fixture>;
  for (const plan of FIXTURES) {
    if (done[plan.name]?.written === true) continue;
    const trackId = String((state.tracks as Wire)[plan.name]), track = await trackIndexOf(trackId);
    const started = performance.now();
    // Write notes only into a new clip. A rewrite races a later decoration and can reset its fields.
    const fresh = done[plan.name] === undefined;
    if (fresh) {
      assert.notEqual((await request('slot.status', { trackIndex: track, slotIndex: 0 })).hasContent, true, 'row 0 must start empty');
      done[plan.name] = { ...plan, trackId, row: 0, written: false }; await save(statePath, state);
      await request('clip.create', { trackIndex: track, slotIndex: 0, lengthBeats: plan.beats });
    }
    await until(() => request('slot.status', { trackIndex: track, slotIndex: 0 }), value => value.hasContent === true);
    // The bind selects row 0 of the track. The reader then binds with one point action.
    await bindFixture(track, 0);
    const width = widthCells(plan);
    if (!fresh) { /* the notes exist; decorate and verify again */ } else if (plan.kind === 'one') {
      await shadow('fixtureEdit', { ops: [{ op: 'set', channel: ONE_NOTE.channel, x: ONE_NOTE.cell, y: ONE_NOTE.pitch,
        velocity: ONE_NOTE.velocity, durationCells: ONE_NOTE.durationCells }] });
    } else if (plan.kind === 'spec') {
      for (let from = 0; from < plan.count; from += 4096) await shadow('fixtureWrite', { count: plan.count, width, from, size: 4096, durationCap: plan.cap });
    }
    const { indexes, coordinates } = coordinatesOf(plan);
    if (plan.kind === 'one') {
      const read = await until(() => shadow('fixtureRead', { coordinates }), value => (value.notes as Wire[]).length === 1, 60_000, 200);
      const note = (read.notes as Wire[])[0]!;
      state.defaults = { gain: note.gain, chance: note.chance, chanceEnabled: note.isChanceEnabled, muted: note.isMuted } satisfies Wire;
      console.log(JSON.stringify({ defaults: state.defaults }));
    }
    // An empty fixture declares no note, so it needs no defaults.
    const defaults = (state.defaults ?? (plan.kind === 'empty' ? {} : undefined)) as Defaults | undefined;
    assert(defaults, 'host defaults come from the one-note fixture first');
    if (plan.kind === 'spec') {
      // A field edit needs the note start in the writer's grid. Wait for the writes, then decorate.
      await until(async () => ({ n: (await shadow('fixtureRead', { coordinates })).notes }), value => (value.n as Wire[]).length === indexes.length, 600_000, 500);
      for (let from = 0; from < plan.count; from += 4096) {
        // Decorate a chunk once, after every note start is in the writer's grid. A setter on a stale step can
        // apply a relative change: a retried partial chunk doubled gain (8h2a fixture finding).
        const chunk: number[][] = [];
        for (let i = from; i < Math.min(plan.count, from + 4096); i++) { const n = fixtureNote(i, plan.count, width, 0, plan.cap); chunk.push([n.cell, n.pitch]); }
        await until(async () => ({ n: ((await shadow('fixtureRead', { coordinates: chunk })).notes as Wire[]).length }), value => value.n === chunk.length, 600_000, 500);
        await shadow('fixtureDecorate', { count: plan.count, width, from, size: 4096 });
      }
    }
    // An immediate read returns cached written values, and a repeated equal setter leaves the cache stale
    // (8h2a finding). Rebind the writer for fresh values, then require two passes 2 s apart.
    await wait(3_000); await parkFixture(state); await bindFixture(track, 0); await wait(2_000);
    let issues: string[] = [], passes = 0;
    await until(async () => {
      const notes = (await shadow('fixtureRead', { coordinates })).notes as Wire[];
      issues = targetedFieldIssues(notes, expectedAt(plan, indexes, defaults));
      passes = issues.length === 0 ? passes + 1 : 0; return { issues };
    }, () => passes >= 2, 600_000, 2_000);
    // Defaults must be the values that undecorated spec notes read back.
    if (plan.kind === 'spec' && indexes.some(undecorated)) assert.deepEqual(issues, []);
    done[plan.name]!.written = true; await save(statePath, state);
    console.log(JSON.stringify({ fixture: plan.name, count: plan.count, ms: Math.round(performance.now() - started) }));
  }
  await parkFixture(state);
}

/** Point the reader at the park track with an armed epoch, then wait until it is quiet. */
export async function parkReader(state: Wire): Promise<Wire> {
  const park = await trackIndexOf(parkId(state));
  const act = await arm({ action: 'point', trackIndex: park, label: 'park' });
  const status = await observe(Number(act.epoch), 1_000);
  assert.equal(status.trackChannelId, parkId(state)); assert.equal(status.clipExists, false);
  return { actMs: act.actMs, callbacks: (status.epoch as Wire).callbacks, lastCallbackMs: (status.epoch as Wire).lastCallbackMs };
}
/** Observe an epoch until {@code quietMs} after the arm and after its last callback, with no batch task pending. */
const armTimes = new Map<number, number>();
export async function observe(epoch: number, quietMs: number): Promise<Wire> {
  const armed = armTimes.get(epoch); assert(armed !== undefined, 'observe needs an epoch armed by this driver');
  return await until(() => shadow('replayStatus'), value => {
    const e = value.epoch as Wire; assert.equal(e.epoch, epoch, 'epoch changed under observation');
    const since = Number(e.msSinceLastCallback);
    return e.pending === false && performance.now() - armed >= quietMs && (since < 0 || since >= quietMs);
  }, 600_000, 50);
}
export async function arm(params: Wire): Promise<Wire> {
  const started = performance.now(), act = await shadow('replayAct', { ...params, arm: true });
  armTimes.set(Number(act.epoch), started); return act;
}

/** Test the point-then-slot.select route in one controller task. */
export async function armViaSlot(trackIndex: number, row: number): Promise<Wire> {
  const started = performance.now();
  const batch = await request('batch.run', { ops: [
    { method: 'cache.shadow', params: { operation: 'replayAct', action: 'point', trackIndex,
      arm: true, measureClose: true, label: 'point-then-slot-select' } },
    { method: 'slot.select', params: { trackIndex, slotIndex: row, mechanism: 'slot' } },
  ] });
  assert.equal(batch.failures, 0);
  const status = await shadow('replayStatus'), epoch = Number((status.epoch as Wire).epoch);
  armTimes.set(epoch, started);
  return { epoch, actMs: null, batch };
}

/** Select the target row while the reader stays at park, then point it in the same task. */
export async function armSelectedTarget(trackIndex: number, row: number, params: Wire): Promise<Wire> {
  const started = performance.now(), owned = params.ownerToken === undefined ? {} : { selectionOwnerToken: params.ownerToken };
  const ops = [
    { method: 'cache.shadow', params: { operation: 'replayAct', ...params, action: 'none', trackIndex, row,
      arm: true, measureClose: true, label: 'select-row-before-point' } },
    { method: 'slot.select', params: { trackIndex, slotIndex: row, mechanism: 'track', ...owned } },
    { method: 'cache.shadow', params: { operation: 'replayAct', action: 'point', trackIndex } },
  ];
  if (params.restoreWhen === 'bind') ops.push({ method: 'cache.shadow', params: { operation: 'replayAct',
    ...params, action: 'restore', trackIndex, row } });
  const batch = await request('batch.run', { ops }); assert.equal(batch.failures, 0);
  const status = await shadow('replayStatus'), epoch = Number((status.epoch as Wire).epoch);
  armTimes.set(epoch, started); return { epoch, actMs: null, batch };
}

export async function decoded(epoch: number): Promise<{ rows: DecodedRow[]; bytes: number; pages: number; encodeMs: number; wallMs: number }> {
  const started = performance.now(), rows: DecodedRow[] = [];
  let from = 0, bytes = 0, pages = 0, encodeMs = 0;
  for (;;) {
    const page = await shadow('replayNotes', { epoch, from, limit: 16_384 });
    bytes += Buffer.byteLength(JSON.stringify(page)); pages++; encodeMs += Number(page.encodeMs);
    rows.push(...page.rows as DecodedRow[]);
    if (Number(page.next) < 0) break;
    from = Number(page.next);
  }
  return { rows, bytes, pages, encodeMs, wallMs: performance.now() - started };
}

/** Experiments 1–4 for one fixture. Each trial binds from the park target with one point action. */
async function trials(out: string, statePath: string, name: string, n: number): Promise<void> {
  const entry = await guard(), state = await readJson(statePath), target = (state.fixtures as Record<string, Fixture>)[name];
  assert(target?.written === true, `fixture ${name} is not written`);
  const defaults = state.defaults as Defaults, declared = declaredNotes(target, defaults);
  const report: Wire = { schema: 'phase8h2a-trials-v1', marker: REPLAY_MARKER, complete: false, eligible: false,
    captured: new Date().toISOString(), fixture: target, defaults, oracleMs: ORACLE_MS, ...entry, trials: [] };
  await save(out, report, true);
  const rows = report.trials as Wire[];
  try {
    await parkFixture(state);
    report.parkBefore = await parkReader(state); await wait(1_000);
    report.baseline = await heap(`${name}-baseline`);
    const track = await trackIndexOf(target.trackId);
    const { coordinates } = coordinatesOf(target);
    for (let trial = 0; trial < n; trial++) {
      const act = await arm({ action: 'point', trackIndex: track, label: `${name}-${trial}` });
      const epoch = Number(act.epoch);
      const status = await observe(epoch, ORACLE_MS);
      assert.equal(status.trackChannelId, target.trackId); assert.equal(status.clipExists, true); assert.equal(status.sceneIndex, 0);
      const e = status.epoch as Wire;
      const read = await decoded(epoch);
      const row: Wire = { trial, epoch, actMs: act.actMs, status: e, completion: completion(e), window: windowVerdict(e),
        start: startCandidates(e, { beats: target.beats, row: 0, trackId: target.trackId }),
        decodeIssues: decodeIssues(read.rows, declared), notes: read.rows.length, bridgeBytes: read.bytes, pages: read.pages,
        encodeMs: read.encodeMs, fetchMs: read.wallMs };
      if (trial === 0) {
        row.boundHeap = await heap(`${name}-bound`);
        // Targeted host reads through the reader-independent fixture writer, at the oracle coordinates.
        await bindFixture(track, 0);
        const targeted = (await shadow('fixtureRead', { coordinates })).notes as Wire[];
        row.targeted = targeted; row.targetedIssues = targetedAgreement(read.rows, targeted);
        await parkFixture(state);
      }
      const releaseStarted = performance.now();
      row.release = await parkReader(state); (row.release as Wire).wallMs = performance.now() - releaseStarted;
      if (trial === 0) { await wait(1_000); row.releasedHeap = await heap(`${name}-released`); }
      rows.push(row); await save(out, report);
      const c = row.completion as Wire;
      console.log(JSON.stringify({ name, trial, callbacks: c.callbacks, batches: c.batches, singleTask: c.singleTask, completeMs: c.completeMs,
        firstToLastMs: c.firstToLastMs, decode: (row.decodeIssues as string[]).length === 0, closes: Object.fromEntries(Object.entries(row.start as Wire)
          .map(([k, v]) => [k, (v as Wire).closes])) }));
    }
    report.summary = summarizeTrials(rows);
    report.pingP95Ms = percentile(await pings(), 0.95);
    console.log(JSON.stringify(report.summary));
  } catch (error) { report.error = String(error); throw error; }
  finally { await save(out, report); }
}

/**
 * Experiment 3 guard. The fixture writer stays on the target. One velocity edit runs from inside the replay,
 * at half of the replay's callbacks, or in the bind call before the replay. The read must refuse.
 */
async function edit(out: string, statePath: string, name: string, n: number): Promise<void> {
  const entry = await guard(), state = await readJson(statePath), target = (state.fixtures as Record<string, Fixture>)[name];
  assert(target?.written === true && target.kind === 'spec' && target.count >= 64, 'a written spec fixture is required');
  const defaults = state.defaults as Defaults, declared = declaredNotes(target, defaults);
  const report: Wire = { schema: 'phase8h2a-edit-v1', marker: REPLAY_MARKER, complete: false, eligible: false,
    captured: new Date().toISOString(), fixture: target, ...entry, trials: [] };
  await save(out, report, true);
  const rows = report.trials as Wire[];
  const track = await trackIndexOf(target.trackId), width = widthCells(target);
  // Edit the last declared note. Its original velocity is restored after each trial.
  const index = target.count - 1, note = declared[index]!;
  const editOps = [{ op: 'field', channel: note.channel, x: note.cell, y: note.pitch, field: 'velocity', value: 0.2 }];
  const restoreOps = [{ op: 'field', channel: note.channel, x: note.cell, y: note.pitch, field: 'velocity', value: note.velocity / 127 }];
  try {
    await bindFixture(track, 0);
    await parkReader(state);
    const clean = await arm({ action: 'point', trackIndex: track, label: `${name}-clean` });
    const cleanStatus = await observe(Number(clean.epoch), ORACLE_MS);
    const total = Number((cleanStatus.epoch as Wire).callbacks);
    report.clean = { completion: completion(cleanStatus.epoch as Wire), window: windowVerdict(cleanStatus.epoch as Wire) };
    await parkReader(state);
    for (let trial = 0; trial < 2 * n; trial++) {
      const mode = trial % 2 === 0 ? 'in-replay' : 'pre-replay';
      const params: Wire = { action: 'point', trackIndex: track, label: `${name}-edit-${trial}`, editOps };
      if (mode === 'in-replay') params.editAt = Math.max(1, Math.floor(total / 2)); else params.editNow = true;
      const act = await arm(params);
      const status = await observe(Number(act.epoch), ORACLE_MS), e = status.epoch as Wire;
      const read = await decoded(Number(act.epoch));
      const issues = decodeIssues(read.rows, declared);
      const row: Wire = { trial, mode, status: e, completion: completion(e), window: windowVerdict(e), decodeIssues: issues,
        editVisible: issues.some(text => text.startsWith('velocity')) };
      await parkReader(state);
      await shadow('fixtureEdit', { ops: restoreOps });
      await until(async () => ({ notes: (await shadow('fixtureRead', { coordinates: [[note.cell, note.pitch]] })).notes }),
        value => (value.notes as Wire[]).length === 1 && Math.abs(Number((value.notes as Wire[])[0]!.velocity) * 127 - note.velocity) < 0.51, 30_000, 100);
      rows.push(row); await save(out, report);
      console.log(JSON.stringify({ name, trial, mode, refuse: (row.window as Wire).refuse, reasons: (row.window as Wire).reasons,
        batches: (row.completion as Wire).batches, editVisible: row.editVisible, edit: e.edit }));
    }
  } catch (error) { report.error = String(error); throw error; }
  finally {
    await save(out, report);
    try { await parkReader(state); await parkFixture(state); } catch (error) { console.error(`park failed: ${String(error)}`); }
  }
}

/** Experiment 2, candidate 2: a pinned, unsubscribed reader subscribes again. Record the value callbacks. */
async function resubscribe(out: string, statePath: string, name: string, n: number): Promise<void> {
  const entry = await guard(), state = await readJson(statePath), target = (state.fixtures as Record<string, Fixture>)[name];
  assert(target?.written === true, `fixture ${name} is not written`);
  const report: Wire = { schema: 'phase8h2a-resubscribe-v1', marker: REPLAY_MARKER, complete: false, eligible: false,
    captured: new Date().toISOString(), fixture: target, ...entry, trials: [] };
  await save(out, report, true);
  const rows = report.trials as Wire[];
  try {
    const track = await trackIndexOf(target.trackId);
    await parkReader(state);
    const bound = await arm({ action: 'point', trackIndex: track, label: `${name}-bind` });
    await observe(Number(bound.epoch), 1_000);
    await shadow('replayAct', { action: 'pin' });
    for (let trial = 0; trial < n; trial++) {
      const off = await arm({ action: 'unsubscribe', label: `${name}-unsubscribe-${trial}` });
      const offStatus = await observe(Number(off.epoch), 1_000);
      const on = await arm({ action: 'subscribe', label: `${name}-subscribe-${trial}` });
      const status = await observe(Number(on.epoch), ORACLE_MS), e = status.epoch as Wire;
      const row: Wire = { trial, unsubscribe: offStatus.epoch, subscribe: e, completion: completion(e),
        start: startCandidates(e, { beats: target.beats, row: 0, trackId: target.trackId }), valueCallbacks: (e.values as Wire[]).length };
      rows.push(row); await save(out, report);
      console.log(JSON.stringify({ name, trial, callbacks: e.callbacks, values: e.values }));
    }
  } catch (error) { report.error = String(error); throw error; }
  finally {
    await save(out, report);
    try { await shadow('replayAct', { action: 'subscribe' }); await parkReader(state); } catch (error) { console.error(`park failed: ${String(error)}`); }
  }
}

/** Paired E131 reads. The exact reader needs the handshake (8h1a finding). */
async function e131(out: string, statePath: string, name: string, n: number): Promise<void> {
  const entry = await guard(), state = await readJson(statePath), target = (state.fixtures as Record<string, Fixture>)[name];
  assert(target?.written === true && target.count <= 4_096, 'E131 pairs fixtures up to 4,096 notes');
  const report: Wire = { schema: 'phase8h2a-e131-v1', marker: REPLAY_MARKER, complete: false, eligible: false,
    captured: new Date().toISOString(), fixture: target, ...entry, reads: [] };
  await save(out, report, true);
  try {
    await parkFixture(state); await parkReader(state);
    await adapter.hello();
    for (let trial = 0; trial < n; trial++) {
      const started = performance.now();
      const value = await callTool(workspace, 'acquire_clip_note_source', { trackId: target.trackId, row: 0 }, EXPERIMENTAL_7B_TOOL_PROFILE) as Wire;
      const wallMs = performance.now() - started, source = value.exactSource as Wire | undefined;
      const events = (source?.eventMap ?? source?.events) as Wire[] | undefined;
      const issues = target.kind === 'spec'
        ? (source === undefined ? ['exact-refused'] : exactSourceIssues(source, target.count, widthCells(target)))
        : (events?.length === target.count ? [] : [`exact note count ${events?.length ?? 'absent'}`]);
      (report.reads as Wire[]).push({ trial, wallMs, noteCount: events?.length ?? 0, issues, bytes: Buffer.byteLength(JSON.stringify(value)) });
      await save(out, report);
      console.log(JSON.stringify({ name, trial, wallMs: Math.round(wallMs), notes: events?.length, issues }));
    }
  } catch (error) { report.error = String(error); throw error; }
  finally { await save(out, report); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
const [command, ...args] = process.argv.slice(2);
// Each live command owns the research cursors and state files until its process exits.
const lockPath = join(tmpdir(), 'ghostnote-phase8h2a-live.lock');
const liveLock = ['config', 'restore'].includes(String(command)) ? undefined : await open(lockPath, 'wx');
if (liveLock) await liveLock.writeFile(JSON.stringify({ pid: process.pid, command, started: new Date().toISOString() }) + '\n');
const flag = (name: string): string | undefined => { const at = args.indexOf(`--${name}`); return at < 0 ? undefined : args[at + 1]; };
try {
  if (command === 'config') await config(args[0]!);
  else if (command === 'restore') await restore(args[0]!);
  else if (command === 'setup') await setup(args[0]!);
  else if (command === 'fixtures') await fixtures(args[0]!);
  else if (command === 'trials') { fixturePlan(args[2]!); await trials(args[0]!, args[1]!, args[2]!, Number(flag('n') ?? 20)); }
  else if (command === 'edit') await edit(args[0]!, args[1]!, args[2]!, Number(flag('n') ?? 5));
  else if (command === 'resubscribe') await resubscribe(args[0]!, args[1]!, args[2]!, Number(flag('n') ?? 5));
  else if (command === 'e131') await e131(args[0]!, args[1]!, args[2]!, Number(flag('n') ?? 3));
  else throw new Error(`unknown command: ${String(command)}`);
} finally {
  bridge.disconnect();
  if (liveLock) { await liveLock.close(); await unlink(lockPath); }
}

}
export const disconnectReplay = (): void => bridge.disconnect();
