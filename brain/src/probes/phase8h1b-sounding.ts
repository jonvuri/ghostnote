/**
 * 8h1b sounding-cell cost reduction. Live driver. Each subcommand writes one artifact and refuses the anchor project.
 *
 *   config <entry.json>                                     write the research rig config (records the original)
 *   restore <entry.json>                                    restore the original rig config
 *   setup <state.json>                                      owned tracks: dense, park, canary, matrix
 *   fixture <state.json> <name> <track> <row> <width> <count> [--cap N]
 *   release <out.json> <state.json> <name>                  experiment 1: which action releases a bound grid
 *   census <out.json> <state.json> <name> <action>          experiment 2: every cursor that can hold a resident clip
 *   admission <out.json> <state.json> <first> <second> <budget> <clipLimit> [--action A]
 *                                                           experiment 3: eviction and readmission under a cell budget
 *   matrix <out.json> <state.json> <stepCells> [--row N]    experiment 4: coarse sentinel detection matrix on an owned clip row
 */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { open, readFile, unlink, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { BridgeClient } from '../client.js';
import { ORIGINAL_CONFIG_SHA256, PROTECTED_PROJECT } from './phase8g5-consumers-lib.js';
import { HEAP_STOP_BYTES, compactIssues, fixtureNote, fixtureSoundingCells, openLimits, oracleIndexes, parseHistogram, percentile,
  targetedIssues } from './phase8h1a-knee-lib.js';
import { classCounts, evaluateRow, matrixPlan, releaseDelta, soundingConfig, verifyMatrix, MATRIX_BEATS, NOTE_STEP_CLASS, SENTINEL_STEPS,
  SOUNDING_MARKER, SOUNDING_METHOD_COUNT, SOUNDING_METHODS_HASH, SOUNDING_PROFILE, SOUNDING_WIDTH, stepBeats, type EditOp, type TraceRow,
  type Wire } from './phase8h1b-sounding-lib.js';

const configPath = join(homedir(), '.ghostnote', 'rig.json');
const ANCHOR_PROJECT = 'gn-scale-test';
const GRID = 1 / 512;
const POOL_STEP = 0.25;
const bridge = new BridgeClient();
const execute = promisify(execFile);
const request = async (method: string, params?: Wire, timeout = 60_000): Promise<Wire> =>
  await bridge.request(method, params, timeout) as Wire;
const shadow = async (operation: string, params: Wire = {}): Promise<Wire> => await request('cache.shadow', { operation, ...params });
const wait = async (ms: number): Promise<void> => await new Promise(resolve => setTimeout(resolve, ms));
const hash = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');
const readJson = async (path: string): Promise<Wire> => JSON.parse(await readFile(path, 'utf8')) as Wire;
const save = async (path: string, value: Wire, create = false): Promise<void> =>
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
async function guard(): Promise<Wire> {
  const hello = await request('contract.hello');
  assert.equal(hello.runtimeProfile, SOUNDING_PROFILE); assert.equal(hello.methodCount, SOUNDING_METHOD_COUNT);
  assert.equal(hello.methodsHash, SOUNDING_METHODS_HASH);
  const info = await shadow('info'); assert.equal(info.instrumentationRevision, SOUNDING_MARKER);
  const status = await shadow('soundingStatus'); assert.equal(status.revision, SOUNDING_MARKER);
  const allocation = await shadow('allocationStats');
  // D29: never run research in the saved anchor. New 3 stays refused as well.
  assert(![PROTECTED_PROJECT, ANCHOR_PROJECT].includes(String(allocation.projectName)), 'never run in a protected or anchor project');
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
  const research = soundingConfig();
  await save(entryPath, { schema: 'phase8h1b-config-entry-v1', captured: new Date().toISOString(),
    originalSha256: hash(original), originalBase64: original.toString('base64'), research });
  await writeFile(configPath, JSON.stringify(research) + '\n');
  console.log(JSON.stringify({ research, researchSha256: hash(await readFile(configPath)) }));
}
async function restore(entryPath: string): Promise<void> {
  const bytes = Buffer.from(String((await readJson(entryPath)).originalBase64), 'base64');
  assert.equal(hash(bytes), ORIGINAL_CONFIG_SHA256); await writeFile(configPath, bytes);
  assert.equal(hash(await readFile(configPath)), ORIGINAL_CONFIG_SHA256);
  console.log(JSON.stringify({ restoredSha256: ORIGINAL_CONFIG_SHA256 }));
}

type TrackKey = 'dense' | 'park' | 'canary' | 'matrix';
interface Fixture { name: string; track: TrackKey; trackId: string; row: number; width: number; count: number; cap: number; cells: number }
async function trackIndex(state: Wire, key: TrackKey): Promise<number> {
  const id = (state.tracks as Record<string, string>)[key];
  const track = ((await request('track.list')).tracks as Wire[]).find(row => row.channelId === id);
  assert(track, `owned track ${key} is absent`); return Number(track.index);
}

/** Create four owned tracks. The park track never holds a clip; parked cursors point at its empty slot. */
async function setup(statePath: string): Promise<void> {
  await guard();
  const state: Wire = { schema: 'phase8h1b-state-v1', tracks: {}, fixtures: {}, clips: [] };
  await save(statePath, state, true);
  for (const key of ['dense', 'park', 'canary', 'matrix'] as const) {
    const before = await request('track.list'), ids = new Set((before.tracks as Wire[]).map(row => row.channelId));
    await request('track.create', { position: 0 });
    const after = await until(() => request('track.list'), value => (value.tracks as Wire[]).some(row => row.index === 0 && !ids.has(row.channelId)), 30_000, 50);
    const id = String((after.tracks as Wire[]).find(row => row.index === 0)!.channelId);
    (state.tracks as Wire)[key] = id; await save(statePath, state);
    await request('track.setName', { trackIndex: 0, name: `gn-8h1b-${key}` });
  }
  console.log(JSON.stringify({ tracks: state.tracks }));
}

/** Point a research cursor at a clip and pin it. A select issued just after clip creation can be lost; repeat it. */
async function bindRole(role: string, track: number, row: number): Promise<Wire> {
  const started = performance.now();
  const id = ((await request('track.list')).tracks as Wire[]).find(value => value.index === track)!.channelId;
  const cursor = async (): Promise<Wire> => ((await shadow('soundingStatus')).cursors as Wire)[role] as Wire;
  await shadow('soundingAct', { role, action: 'point', trackIndex: track });
  await until(cursor, value => value.trackChannelId === id);
  await shadow('soundingAct', { role, action: 'pinTrack' });
  await until(async () => {
    const value = await cursor();
    if (value.clipExists !== true || value.sceneIndex !== row) await shadow('soundingAct', { role, action: 'select', trackIndex: track, row });
    return value;
  }, value => value.clipExists === true && value.sceneIndex === row, 60_000, 200);
  await shadow('soundingAct', { role, action: 'pin' });
  await until(cursor, value => value.trackPinned === true && value.clipPinned === true);
  return { bindMs: performance.now() - started };
}
/** Point a cursor at the park track. The park track has no clip, so its selected slot is empty. */
async function parkRole(role: string, park: number): Promise<void> {
  const id = ((await request('track.list')).tracks as Wire[]).find(value => value.index === park)!.channelId;
  const cursor = async (): Promise<Wire> => ((await shadow('soundingStatus')).cursors as Wire)[role] as Wire;
  await shadow('soundingAct', { role, action: 'point', trackIndex: park });
  await until(cursor, value => value.trackChannelId === id && value.clipExists === false);
  await shadow('soundingAct', { role, action: 'pinTrack' });
}
async function parkAll(state: Wire, except: string[] = []): Promise<string[]> {
  const park = await trackIndex(state, 'park'), roles = Object.keys((await shadow('soundingStatus')).cursors as Wire);
  for (const role of roles) if (!except.includes(role)) await parkRole(role, park);
  return roles;
}

/** Wait until a recorder is quiet. Report the wall time from {@code started} to its last callback. */
async function quiet(role: string, started: number, quietMs = 1_000, noneMs = 5_000, limit = 600_000): Promise<Wire> {
  let value: Wire = {};
  for (;;) {
    value = ((await shadow('soundingStatus')).cursors as Wire)[role] as Wire;
    const since = Number(value.msSinceLastCallback), now = performance.now() - started;
    if (Number(value.callbacks) === 0 && now >= noneMs) return { callbacks: 0, lastCallbackMs: null, waitedMs: now };
    if (Number(value.callbacks) > 0 && since >= quietMs) {
      return { callbacks: value.callbacks, onset: value.onsetCallbacks, sustain: value.sustainCallbacks, empty: value.emptyCallbacks,
        lastCallbackMs: now - since, firstToLastCallbackMs: value.firstToLastCallbackMs, waitedMs: now };
    }
    assert(now < limit, `${role} callbacks did not become quiet`);
    await wait(100);
  }
}

async function bindFixture(trackIndexValue: number, row: number): Promise<void> {
  await shadow('fixturePin', { pinned: false }); await shadow('fixturePoint', { trackIndex: trackIndexValue });
  const id = ((await request('track.list')).tracks as Wire[]).find(value => value.index === trackIndexValue)!.channelId;
  await until(() => shadow('fixtureStatus'), value => value.trackChannelId === id);
  await until(async () => {
    const value = await shadow('fixtureStatus');
    if (value.clipExists !== true || value.sceneIndex !== row) await shadow('fixtureSelect', { trackIndex: trackIndexValue, row });
    return value;
  }, value => value.clipExists === true && value.sceneIndex === row, 60_000, 200);
  await shadow('fixturePin', { pinned: true });
  await until(() => shadow('fixtureStatus'), value => value.trackPinned === true && value.clipPinned === true);
}
async function createClip(state: Wire, key: TrackKey, row: number, beats: number, intent: string): Promise<number> {
  const track = await trackIndex(state, key);
  const owned = (state.clips as Wire[]).some(clip => clip.intent === intent);
  if (!owned) {
    assert.notEqual((await request('slot.status', { trackIndex: track, slotIndex: row })).hasContent, true, 'row must start empty');
    (state.clips as Wire[]).push({ track: key, row, intent });
    await request('clip.create', { trackIndex: track, slotIndex: row, lengthBeats: beats });
  }
  await until(() => request('slot.status', { trackIndex: track, slotIndex: row }), value => value.hasContent === true);
  return track;
}

async function fixture(statePath: string, name: string, key: TrackKey, row: number, width: number, count: number, cap: number): Promise<void> {
  await guard();
  const state = await readJson(statePath), fixtures = state.fixtures as Record<string, Fixture>;
  assert(!fixtures[name], `fixture ${name} exists`); assert(key !== 'park', 'the park track holds no clip');
  assert.equal(width % 512, 0, 'fixture width must be whole beats');
  const track = await createClip(state, key, row, width / 512, name); await save(statePath, state);
  await bindFixture(track, row);
  const started = performance.now();
  for (let from = 0; from < count; from += 4096) await shadow('fixtureWrite', { count, width, from, size: 4096, durationCap: cap });
  const writeMs = performance.now() - started;
  const indexes = oracleIndexes(count), coordinates = indexes.map(i => { const n = fixtureNote(i, count, width, 0, cap); return [n.cell, n.pitch]; });
  let issues: string[] = [];
  await until(async () => {
    issues = targetedIssues((await shadow('fixtureRead', { coordinates })).notes, indexes, count, width, 0, cap); return { issues };
  }, () => issues.length === 0, 600_000, 500);
  const trackId = String((state.tracks as Wire)[key]);
  fixtures[name] = { name, track: key, trackId, row, width, count, cap, cells: fixtureSoundingCells(count, width, cap) };
  await save(statePath, state);
  console.log(JSON.stringify({ fixture: name, count, width, cells: fixtures[name]!.cells, writeMs: Math.round(writeMs),
    settleMs: Math.round(performance.now() - started - writeMs) }));
}

/**
 * Experiment 1. Bind the release proxy to a sustained fixture. Apply each action, count note steps, then
 * restore the binding and time its replay.
 */
async function release(out: string, statePath: string, name: string): Promise<void> {
  const entry = await guard(), state = await readJson(statePath), target = (state.fixtures as Record<string, Fixture>)[name];
  assert(target, 'fixture required');
  const report: Wire = { schema: 'phase8h1b-release-v1', marker: SOUNDING_MARKER, complete: false, eligible: false,
    captured: new Date().toISOString(), fixture: target, ...entry, actions: [] };
  await save(out, report, true);
  const actions = report.actions as Wire[];
  try {
    const dense = await trackIndex(state, 'dense'), park = await trackIndex(state, 'park');
    assert.equal(target.track, 'dense'); assert.equal(target.row, 0, 'release uses dense row 0; row 1 must stay empty');
    assert.notEqual((await request('slot.status', { trackIndex: dense, slotIndex: 1 })).hasContent, true, 'dense row 1 must be empty');
    // The fixture writer holds the grid after writing. Measure it, then park it.
    await bindFixture(dense, target.row);
    await parkAll(state, ['fixture']); await wait(3_000);
    report.fixtureBound = await heap('fixture-bound');
    await parkRole('fixture', park); await wait(3_000);
    report.baseline = await heap('baseline');
    report.fixtureRelease = releaseDelta(Number((report.fixtureBound as Wire).noteSteps), Number((report.baseline as Wire).noteSteps), target.cells);
    const baseSteps = Number((report.baseline as Wire).noteSteps);
    const restoreBinding = async (label: string, perform: () => Promise<void>): Promise<Wire> => {
      await shadow('soundingReset', { role: 'release' });
      const started = performance.now(); await perform();
      const replay = await quiet('release', started);
      await wait(1_000);
      const sample = await heap(`${label}-restored`);
      return { replay, heap: sample, boundNoteSteps: Number(sample.noteSteps) - baseSteps };
    };
    report.bound = await restoreBinding('bound', async () => { await bindRole('release', dense, target.row); });
    const bound = Number(((report.bound as Wire).heap as Wire).noteSteps);
    const plan: [string, () => Promise<void>, () => Promise<void>][] = [
      ['unsubscribe', async () => { await shadow('soundingAct', { role: 'release', action: 'unsubscribe' }); },
        async () => { await shadow('soundingAct', { role: 'release', action: 'subscribe' }); }],
      ['unpin', async () => { await shadow('soundingAct', { role: 'release', action: 'unpin' }); },
        async () => { await shadow('soundingAct', { role: 'release', action: 'pin' }); }],
      ['empty-slot', async () => {
        await shadow('soundingAct', { role: 'release', action: 'unpinClip' });
        await shadow('soundingAct', { role: 'release', action: 'select', trackIndex: dense, row: 1 });
        // A selected empty slot can leave the cursor on its last clip. The status after the action records that.
      }, async () => { await bindRole('release', dense, target.row); }],
      ['other-track', async () => { await parkRole('release', park); },
        async () => { await bindRole('release', dense, target.row); }],
      ['coarse-step', async () => { await shadow('soundingAct', { role: 'release', action: 'stepSize', beats: 1 }); },
        async () => { await shadow('soundingAct', { role: 'release', action: 'stepSize', beats: GRID }); }],
      ['scroll-off', async () => { await shadow('soundingAct', { role: 'release', action: 'scroll', step: SOUNDING_WIDTH }); },
        async () => { await shadow('soundingAct', { role: 'release', action: 'scroll', step: 0 }); }],
    ];
    for (const [action, apply, undo] of plan) {
      const started = performance.now(); await apply(); const applyMs = performance.now() - started;
      await wait(3_000);
      const after = await heap(`${action}`);
      const row: Wire = { action, applyMs, after, delta: releaseDelta(bound, Number(after.noteSteps), target.cells),
        status: ((await shadow('soundingStatus')).cursors as Wire).release };
      row.restore = await restoreBinding(action, undo);
      actions.push(row); await save(out, report);
      console.log(JSON.stringify({ action, releases: (row.delta as Wire).releases, freed: (row.delta as Wire).freed,
        replayMs: ((row.restore as Wire).replay as Wire).lastCallbackMs }));
    }
    await parkRole('release', park); await wait(3_000);
    report.released = await heap('parked');
    report.pingP95Ms = percentile(await pings(), 0.95);
  } catch (error) { report.error = String(error); throw error; }
  finally { await save(out, report); }
}

/** Experiment 2. Bind each listed cursor to the dense clip, then release it with one action. */
async function census(out: string, statePath: string, name: string, action: string): Promise<void> {
  assert(['other-track', 'empty-slot'].includes(action), 'census action must move the cursor off the clip');
  const entry = await guard(), state = await readJson(statePath), target = (state.fixtures as Record<string, Fixture>)[name];
  assert(target && target.track === 'dense' && target.row === 0, 'dense row 0 fixture required');
  const report: Wire = { schema: 'phase8h1b-census-v1', marker: SOUNDING_MARKER, complete: false, eligible: false,
    captured: new Date().toISOString(), fixture: target, action, ...entry, cursors: [] };
  await save(out, report, true);
  const rows = report.cursors as Wire[];
  try {
    const dense = await trackIndex(state, 'dense'), park = await trackIndex(state, 'park');
    const roles = await parkAll(state); await wait(3_000);
    report.baseline = await heap('census-baseline');
    const base = Number((report.baseline as Wire).noteSteps);
    for (const role of roles.filter(value => !['release', 'sentinel'].includes(value))) {
      const status = ((await shadow('soundingStatus')).cursors as Wire)[role] as Wire;
      const row: Wire = { role, width: status.width, windowed: status.windowed };
      row.bind = await bindRole(role, dense, target.row); await wait(5_000);
      row.bound = await heap(`${role}-bound`);
      row.boundNoteSteps = Number((row.bound as Wire).noteSteps) - base;
      if (status.windowed === true) {
        // A windowed cursor at 1/512 holds at most its window. E131 reads use this step.
        await shadow('soundingAct', { role, action: 'stepSize', beats: GRID }); await wait(5_000);
        row.fineStep = await heap(`${role}-fine-step`);
        row.fineStepNoteSteps = Number((row.fineStep as Wire).noteSteps) - base;
        await shadow('soundingAct', { role, action: 'stepSize', beats: POOL_STEP });
      }
      if (action === 'empty-slot') {
        await shadow('soundingAct', { role, action: 'unpinClip' });
        await shadow('soundingAct', { role, action: 'select', trackIndex: dense, row: 1 });
      } else await parkRole(role, park);
      await wait(5_000);
      row.released = await heap(`${role}-released`);
      row.releasedNoteSteps = Number((row.released as Wire).noteSteps) - base;
      await parkRole(role, park);
      rows.push(row); await save(out, report);
      console.log(JSON.stringify({ role, bound: row.boundNoteSteps, fineStep: row.fineStepNoteSteps ?? null, released: row.releasedNoteSteps }));
    }
  } catch (error) { report.error = String(error); throw error; }
  finally { await save(out, report); }
}

/** Bind one cache view with a populated canary, then drain its dirty work. */
async function bindView(target: Fixture, canary: Fixture, state: Wire): Promise<Wire> {
  const started = performance.now();
  const acquired = await shadow('acquire', { trackIndex: await trackIndex(state, target.track), row: target.row,
    canaryTrackIndex: await trackIndex(state, canary.track), canaryRow: canary.row });
  assert(['warm', 'reserved'].includes(String(acquired.poolDecision)), JSON.stringify(acquired).slice(0, 600));
  const index = Number(acquired.index);
  await until(() => shadow('poll', { index }), value => {
    assert.notEqual(value.phase, 'retired', `binding retired: ${String(value.reason)}`);
    return (value.phase === 'settled' || value.phase === 'complete') && value.canaryPhase === 'target';
  }, 3_600_000, 50);
  const bindMs = performance.now() - started;
  let quietPolls = 0;
  while (quietPolls < 3) {
    const value = await shadow('reconcile', { index });
    assert(value.reconciledCoordinates !== undefined, `reconcile refused: ${String(value.reason)}`);
    quietPolls = Number(value.pendingWorkItemsIncludingPhysicalHints ?? 0) === 0 && Number(value.reconciledCoordinates) === 0 ? quietPolls + 1 : 0;
    await wait(20);
  }
  const drainedMs = performance.now() - started;
  const read = await promotedRead(index);
  const result = read.result as Wire;
  const issues = result.comparison === 'promoted-unverified'
    ? compactIssues(result.compactNotes, target.count, target.width, 0, 20, target.cap) : [`refused:${String(result.comparison)}`];
  return { index, poolDecision: acquired.poolDecision, bindMs, drainedMs, readMs: read.wallMs, totalMs: performance.now() - started, issues };
}
async function promotedRead(index: number): Promise<Wire> {
  const started = performance.now();
  let result = await shadow('promotedStart', { index, payload: 'compact' });
  assert(result.scanId !== undefined || result.promoted === true, `promoted read refused: ${String(result.reason)}`);
  while (result.comparison === 'pending') {
    result = await shadow('comparePoll');
    assert(performance.now() - started < 3_600_000, 'promoted read did not end');
  }
  return { wallMs: performance.now() - started, result };
}

/**
 * Experiment 3. Two dense clips and a budget that holds only one. Admission after each read evicts the least
 * recently used resident; the driver retires its view and releases the proxy with the measured action.
 */
async function admission(out: string, statePath: string, first: string, second: string, budget: number, clipLimit: number, action: string): Promise<void> {
  assert(action === 'other-track', 'admission releases a view to the park track');
  const entry = await guard(), state = await readJson(statePath), fixtures = state.fixtures as Record<string, Fixture>;
  const a = fixtures[first], b = fixtures[second], canary = fixtures.canary;
  assert(a && b && canary, 'two dense fixtures and a canary are required');
  assert(a.cells + b.cells > budget && Math.max(a.cells, b.cells) <= clipLimit, 'the budget must hold only one clip');
  const report: Wire = { schema: 'phase8h1b-admission-v1', marker: SOUNDING_MARKER, complete: false, eligible: false,
    captured: new Date().toISOString(), budgetCells: budget, clipLimitCells: clipLimit, releaseAction: action, fixtures: [a, b], ...entry, steps: [] };
  await save(out, report, true);
  const steps = report.steps as Wire[];
  try {
    const park = await trackIndex(state, 'park');
    report.configuration = await request('cache.configure', { activeObservers: 2, width: SOUNDING_WIDTH, ...openLimits() }, 120_000);
    assert.equal((report.configuration as Wire).applied, true);
    await shadow('soundingBudget', { budgetCells: budget, clipLimitCells: clipLimit });
    await parkAll(state); await wait(3_000);
    report.baseline = await heap('admission-baseline');
    const views = new Map<string, number>();
    for (const target of [a, b, a, b]) {
      const step: Wire = { target: target.name, cells: target.cells };
      step.bind = await bindView(target, canary, state);
      assert.deepEqual((step.bind as Wire).issues, [], `${target.name} read differs from the fixture`);
      const index = Number((step.bind as Wire).index); views.set(target.name, index);
      step.decision = await shadow('soundingAdmit', { key: target.name, cells: target.cells, busy: [target.name] });
      const evicted = (step.decision as Wire).evicted as string[];
      const releases: Wire[] = [];
      for (const key of evicted) {
        const victim = views.get(key)!; const started = performance.now();
        await shadow('retire', { index: victim }); await parkRole(`view:${victim}`, park);
        releases.push({ key, index: victim, releaseMs: performance.now() - started }); views.delete(key);
      }
      step.releases = releases;
      await wait(3_000);
      step.heap = await heap(`admit-${target.name}-${steps.length}`);
      steps.push(step); await save(out, report);
      console.log(JSON.stringify({ target: target.name, index, poolDecision: (step.bind as Wire).poolDecision,
        totalMs: Math.round(Number((step.bind as Wire).totalMs)), evicted, noteSteps: (step.heap as Wire).noteSteps }));
    }
    report.budget = (await shadow('soundingStatus')).budget;
    report.pingP95Ms = percentile(await pings(), 0.95);
  } catch (error) { report.error = String(error); throw error; }
  finally { await save(out, report); }
}

/** Wait until both recorders are quiet after an edit. */
async function settle(started: number): Promise<Wire> {
  for (;;) {
    const cursors = (await shadow('soundingStatus')).cursors as Wire, now = performance.now() - started;
    const fine = cursors.release as Wire, coarse = cursors.sentinel as Wire;
    const quietFor = (value: Wire): boolean => Number(value.msSinceLastCallback) < 0 || Number(value.msSinceLastCallback) >= 1_000;
    if (now >= 1_500 && quietFor(fine) && quietFor(coarse)) return { fineCallbacks: fine.callbacks, sentinelCallbacks: coarse.callbacks, waitedMs: now };
    assert(now < 30_000, 'recorders did not become quiet');
    await wait(100);
  }
}

/** Experiment 4. One owned matrix clip for each step size. Each row records the fine and coarse traces of one edit. */
async function matrix(out: string, statePath: string, step: number, clipRow?: number): Promise<void> {
  assert(SENTINEL_STEPS.includes(step as typeof SENTINEL_STEPS[number]));
  const entry = await guard(), state = await readJson(statePath);
  const plan = matrixPlan(step), row = clipRow ?? SENTINEL_STEPS.indexOf(step as typeof SENTINEL_STEPS[number]);
  const report: Wire = { schema: 'phase8h1b-matrix-v1', marker: SOUNDING_MARKER, complete: false, eligible: false,
    captured: new Date().toISOString(), stepCells: step, stepBeats: stepBeats(step), clipBeats: MATRIX_BEATS, ...entry, rows: [] };
  await save(out, report, true);
  const rows = report.rows as Wire[];
  try {
    const track = await createClip(state, 'matrix', row, MATRIX_BEATS, `matrix-${step}-row${row}`); await save(statePath, state);
    await parkAll(state, ['fixture']);
    await bindFixture(track, row);
    await shadow('soundingAct', { role: 'sentinel', action: 'stepSize', beats: stepBeats(step) });
    await bindRole('release', track, row); await bindRole('sentinel', track, row);
    for (const role of ['release', 'sentinel']) await shadow('soundingTrace', { role, enabled: true });
    const edit = async (ops: EditOp[]): Promise<Wire> => await shadow('soundingEdit', { ops });
    let started = performance.now(); await edit(plan.baseline); report.baseline = await settle(started);
    started = performance.now(); await edit(plan.setup); report.setup = await settle(started);
    for (const item of plan.rows) {
      const marks = (await shadow('soundingStatus')).cursors as Wire;
      const fineMark = Number((marks.release as Wire).callbacks), coarseMark = Number((marks.sentinel as Wire).callbacks);
      started = performance.now(); const applied = await edit(item.ops); const settled = await settle(started);
      const fine = await shadow('soundingSince', { role: 'release', since: fineMark, limit: 4096 });
      const sentinel = await shadow('soundingSince', { role: 'sentinel', since: coarseMark, limit: 4096 });
      const result = evaluateRow(item, step, fine.rows as TraceRow[], sentinel.rows as TraceRow[]);
      rows.push({ label: item.label, kind: item.kind, ops: item.ops, applyMs: applied.batchMs, settled,
        fine: fine.rows, sentinel: sentinel.rows, fineComplete: fine.complete, sentinelComplete: sentinel.complete, result });
      await save(out, report);
      console.log(JSON.stringify({ step, label: item.label, pass: result.pass, missing: result.missing, derivedMissing: result.derivedMissing,
        fine: result.fineCallbacks, sentinel: result.sentinelCallbacks }));
    }
    for (const role of ['release', 'sentinel']) await shadow('soundingTrace', { role, enabled: false });
    report.clip = ((await shadow('soundingStatus')).cursors as Wire).release;
    report.summary = verifyMatrix(report);
    console.log(JSON.stringify(report.summary));
  } catch (error) { report.error = String(error); throw error; }
  finally {
    await save(out, report);
    try { await parkAll(state); await shadow('soundingAct', { role: 'sentinel', action: 'stepSize', beats: stepBeats(SENTINEL_STEPS[0]) }); }
    catch (error) { console.error(`park failed: ${String(error)}`); }
  }
}

const [command, ...args] = process.argv.slice(2);
// Each live command owns the research cursors and state files until its process exits.
const lockPath = join(tmpdir(), 'ghostnote-phase8h1b-live.lock');
const liveLock = ['config', 'restore'].includes(String(command)) ? undefined : await open(lockPath, 'wx');
if (liveLock) await liveLock.writeFile(JSON.stringify({ pid: process.pid, command, started: new Date().toISOString() }) + '\n');
const flag = (name: string): string | undefined => { const at = args.indexOf(`--${name}`); return at < 0 ? undefined : args[at + 1]; };
try {
  if (command === 'config') await config(args[0]!);
  else if (command === 'restore') await restore(args[0]!);
  else if (command === 'setup') await setup(args[0]!);
  else if (command === 'fixture') await fixture(args[0]!, args[1]!, args[2] as TrackKey, Number(args[3]), Number(args[4]), Number(args[5]),
    Number(flag('cap') ?? 64));
  else if (command === 'release') await release(args[0]!, args[1]!, args[2]!);
  else if (command === 'census') await census(args[0]!, args[1]!, args[2]!, args[3]!);
  else if (command === 'admission') await admission(args[0]!, args[1]!, args[2]!, args[3]!, Number(args[4]), Number(args[5]), flag('action') ?? 'other-track');
  else if (command === 'matrix') await matrix(args[0]!, args[1]!, Number(args[2]), flag('row') === undefined ? undefined : Number(flag('row')));
  else throw new Error(`unknown command: ${String(command)}`);
} finally {
  bridge.disconnect();
  if (liveLock) { await liveLock.close(); await unlink(lockPath); }
}
