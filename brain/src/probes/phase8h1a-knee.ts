/**
 * 8h1a cache limit knee sweep. Live driver. Each subcommand writes one artifact and refuses the protected project.
 * One controller load holds one research allocation; `cache.configure` changes the active scale.
 *
 *   config <entry.json> <current|middle|max|width-N|observers-N[-cursorK]|flat-TxS|combined> [observers]
 *                                                           write the research rig config (records the original)
 *   restore <entry.json>                                    restore the original rig config
 *   load <out.json> <allocation>                            fresh-load allocation, ping, idle CPU, JVM memory
 *   control <out.json>                                      unsubscribed control: nothing subscribed, then everything
 *   populate <state.json> <channels> <emptyRows>            owned tracks and empty count-sweep clips
 *   fixture <state.json> <name> <track> <row> <width> <count>
 *   arm <out.json> <state.json> <name> <axis> <value> [--exact N] [--warm N] [--observers N] [--bounded]
 *   rebinds <out.json> <state.json> [rounds]               serial canary rebinds of one used handle
 *   switch <out.json> [rounds] [--bounded]                   project switches: slot-delta drain, then inventory publication
 *   burst <out.json> <state.json> <name> <reconstruct|native> [--bounded]
 *   binding <out.json> <state.json> [--index N]            cursor slot bank matrix on an unused handle: last scene, canary, escape, dense, exact
 *   observers <out.json> <state.json> <count> [--bounded] [--indexStart N]
 *   inventory <out.json> <tracks> <scenes>
 *   cleanup <state.json>                                    delete owned fixture clips and tracks
 *   summarize <dir> <out.json>                              recompute arms and select each axis limit (offline)
 */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { open, readFile, unlink, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { BridgeClient } from '../client.js';
import { LiveAdapter } from '../adapters/live/adapter.js';
import { BridgeTransport } from '../adapters/live/transport.js';
import { Executor } from '../engine/index.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { EXPERIMENTAL_7B_TOOL_PROFILE, callTool } from '../surface/tools.js';
import { workspaceOf } from '../surface/workspace.js';
import { ORIGINAL_CONFIG_SHA256, PROTECTED_PROJECT } from './phase8g5-consumers-lib.js';
import { intervalCpu, processes } from './phase8g5c-storage-lib.js';
import { ALLOCATIONS, HEAP_STOP_BYTES, combinedConfig, flatConfig, KNEE_MARKER, isolationShape, observerConfig, parseHistogram, widthConfig, KNEE_METHOD_COUNT, KNEE_METHODS_HASH, KNEE_PROFILE, compactIssues,
  exactSourceIssues, fixtureNote, membershipIssues, fixtureSoundingCells, kneeConfig, oracleIndexes, openLimits, percentile, selectLimit, targetedIssues, verifyArm, verifyBinding,
  type AllocationName, type Wire } from './phase8h1a-knee-lib.js';

const configPath = join(homedir(), '.ghostnote', 'rig.json');
const ANCHOR_PROJECT = 'gn-scale-test';
const bridge = new BridgeClient();
const adapter = new LiveAdapter({ transport: new BridgeTransport(bridge) });
const workspace = workspaceOf({ ready: async () => undefined, adapter,
  executor: new Executor(adapter), stash: new Stash(), observationStore: new FakeObservationStore() });
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
  assert.equal(hello.runtimeProfile, KNEE_PROFILE); assert.equal(hello.methodCount, KNEE_METHOD_COUNT);
  assert.equal(hello.methodsHash, KNEE_METHODS_HASH);
  const info = await shadow('info'); assert.equal(info.instrumentationRevision, KNEE_MARKER);
  const allocation = await shadow('allocationStats');
  // D29: the saved anchor is never a research project. New 3 stays refused as well.
  assert(![PROTECTED_PROJECT, ANCHOR_PROJECT].includes(String(allocation.projectName)), 'never run in a protected or anchor project');
  assert(String(allocation.projectName).length > 0, 'project name unavailable');
  return { hello, allocation, stats: await request('rig.stats'), configuration: info.activeConfiguration };
}
async function pings(count = 40): Promise<number[]> {
  const samples: number[] = [];
  for (let n = 0; n < count; n++) { const start = performance.now(); await request('ping'); samples.push(performance.now() - start); }
  return samples;
}
async function cpu(intervalMs = 10_000): Promise<Wire> {
  const sample = async (): Promise<Wire> => {
    const { stdout } = await execute('ps', ['-axo', 'pid=,ppid=,rss=,%cpu=,time=,comm=']);
    return { capturedEpochMs: Date.now(), rows: processes(stdout) };
  };
  const first = await sample(); await wait(intervalMs); const second = await sample();
  const elapsed = Number(second.capturedEpochMs) - Number(first.capturedEpochMs);
  return { intervalMs: elapsed, processes: intervalCpu(first.rows as Wire[], second.rows as Wire[], elapsed) };
}
/** Live-set heap by class from the Bitwig JVM. Throw above the stop, before more work can grow the heap. */
async function heap(label: string): Promise<Wire> {
  const { stdout } = await execute('pgrep', ['-f', 'BitwigStudio --launch']);
  const pids = stdout.trim().split('\n').filter(Boolean);
  assert.equal(pids.length, 1, 'expected one Bitwig JVM process');
  const started = performance.now();
  const histogram = await execute('jcmd', [pids[0]!, 'GC.class_histogram'], { maxBuffer: 256 * 1024 * 1024 });
  const parsed = parseHistogram(histogram.stdout);
  const info = (await execute('jcmd', [pids[0]!, 'GC.heap_info'])).stdout.trim();
  const sample = { label, capturedEpochMs: Date.now(), pid: Number(pids[0]), histogramMs: performance.now() - started,
    liveBytes: parsed.totalBytes, liveInstances: parsed.totalInstances, top: parsed.top, heapInfo: info };
  console.log(JSON.stringify({ heap: label, liveMiB: Math.round(parsed.totalBytes / 2 ** 20) }));
  assert(parsed.totalBytes < HEAP_STOP_BYTES, `live heap ${parsed.totalBytes} reached the ${HEAP_STOP_BYTES} stop at ${label}`);
  return sample;
}

async function configure(values: Wire): Promise<Wire> {
  const applied = await request('cache.configure', values, 120_000);
  assert.equal(applied.applied, true, `configuration refused: ${String(applied.reason)}`);
  return applied;
}

/** The combined row checks the selected deadlines. Other sweep rows leave those deadlines open. */
function sweepLimits(bounded: boolean): Wire {
  return openLimits(bounded ? { replayDeadlineMs: 5_000, enrichmentDeadlineMs: 5_000,
    rebuildDeadlineMs: 40_000, constructionBudgetMs: 200 } : {});
}

async function config(entryPath: string, name: string, observers?: number): Promise<void> {
  const bytes = await readFile(configPath);
  let original = bytes;
  try {
    const prior = await readJson(entryPath); original = Buffer.from(String(prior.originalBase64), 'base64');
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  assert.equal(hash(original), ORIGINAL_CONFIG_SHA256, 'unexpected original config');
  const research = name === 'combined' ? combinedConfig() : name.startsWith('width-') ? widthConfig(Number(name.slice(6)))
    : name.startsWith('flat-') ? flatConfig(Number(name.slice(5).split('x')[0]), Number(name.split('x')[1]))
    : name.startsWith('observers-') ? observerConfig(Number(name.slice(10).split('-')[0]),
      name.includes('-cursor') ? Number(name.split('-cursor')[1]) : undefined) : kneeConfig(name as AllocationName, observers);
  await save(entryPath, { schema: 'phase8h1a-config-entry-v1', captured: new Date().toISOString(),
    originalSha256: hash(original), originalBase64: original.toString('base64'), allocation: name, research });
  await writeFile(configPath, JSON.stringify(research) + '\n');
  console.log(JSON.stringify({ allocation: name, research, researchSha256: hash(await readFile(configPath)) }));
}
async function restore(entryPath: string): Promise<void> {
  const entry = await readJson(entryPath), bytes = Buffer.from(String(entry.originalBase64), 'base64');
  assert.equal(hash(bytes), ORIGINAL_CONFIG_SHA256); await writeFile(configPath, bytes);
  assert.equal(hash(await readFile(configPath)), ORIGINAL_CONFIG_SHA256);
  console.log(JSON.stringify({ restoredSha256: ORIGINAL_CONFIG_SHA256 }));
}

/** One fresh controller load. Measure allocation, init, idle cost, and ping with the default active set. */
async function load(out: string, name: string): Promise<void> {
  const entry = await guard(), stats = entry.stats as Wire;
  const shape = isolationShape(name), size = shape ?? ALLOCATIONS[name as AllocationName];
  const configuration = entry.configuration as Wire, allocation = configuration.allocation as Wire;
  assert.equal(allocation.width, size.width); assert.equal(allocation.tracks, size.tracks); assert.equal(allocation.scenes, size.scenes);
  if (shape) assert.equal(allocation.observers, shape.observers);
  const report: Wire = { schema: 'phase8h1a-load-v1', marker: KNEE_MARKER, complete: false, eligible: false,
    captured: new Date().toISOString(), allocationName: name, ...entry,
    rigConstructMs: Number(stats.rigConstructMicros) / 1000, initMs: Number(stats.initMicros) / 1000,
    cacheBankConstructionMs: allocation.cacheBankConstructionMs, idle: await cpu(), pingSamplesMs: await pings(),
    jvmAfter: (await shadow('allocationStats')).jvmMemory, heap: await heap('load') };
  report.pingP95Ms = percentile(report.pingSamplesMs as number[], 0.95);
  await save(out, report, true);
  console.log(JSON.stringify({ allocation: name, observers: allocation.observers, initMs: report.initMs,
    rigConstructMs: report.rigConstructMs, cacheBankConstructionMs: report.cacheBankConstructionMs, pingP95Ms: report.pingP95Ms }));
}

/** E215 left unsubscribed cost unproved. Measure the same allocation with none and then all observers subscribed. */
async function control(out: string): Promise<void> {
  const entry = await guard(), allocation = (entry.configuration as Wire).allocation as Wire;
  const arms: Wire[] = [];
  for (const observers of [0, Number(allocation.observers), 0]) {
    const applied = await configure({ activeObservers: observers, ...openLimits() });
    await wait(3_000);
    const samples = await pings();
    arms.push({ observers, applied, idle: await cpu(), pingSamplesMs: samples, pingP95Ms: percentile(samples, 0.95),
      jvm: (await shadow('allocationStats')).jvmMemory, heap: await heap(`control-${observers}`) });
    console.log(JSON.stringify({ observers, pingP95Ms: percentile(samples, 0.95) }));
  }
  await save(out, { schema: 'phase8h1a-control-v1', marker: KNEE_MARKER, complete: false, eligible: false,
    captured: new Date().toISOString(), ...entry, arms }, true);
}

interface Fixture { name: string; trackIndex: number; trackId: string; row: number; width: number; count: number; semitones: number; durationCap?: number }
async function trackAt(index: number): Promise<Wire> {
  const tracks = (await request('track.list')).tracks as Wire[]; const track = tracks.find(row => row.index === index);
  assert(track, `track ${index} absent`); return track;
}
/** Bind the research fixture cursor. It is separate from every shadow handle. */
async function bindFixture(trackIndex: number, row: number): Promise<void> {
  await shadow('fixturePin', { pinned: false }); await shadow('fixturePoint', { trackIndex });
  const track = await trackAt(trackIndex);
  await until(() => shadow('fixtureStatus'), value => value.trackChannelId === track.channelId);
  // A select issued just after clip creation can be lost. Repeat it until the clip cursor reports the row.
  await until(async () => {
    const value = await shadow('fixtureStatus');
    if (value.clipExists !== true || value.sceneIndex !== row) await shadow('fixtureSelect', { trackIndex, row });
    return value;
  }, value => value.clipExists === true && value.sceneIndex === row, 60_000, 200);
  await shadow('fixturePin', { pinned: true });
  await until(() => shadow('fixtureStatus'), value => value.trackPinned === true && value.clipPinned === true);
}
async function fixture(statePath: string, name: string, trackIndex: number, row: number, width: number, count: number, cap = 64): Promise<void> {
  await guard();
  let state: Wire;
  try { state = await readJson(statePath); } catch { state = { schema: 'phase8h1a-state-v1', fixtures: {}, tracks: [], clips: [] }; }
  const fixtures = state.fixtures as Record<string, Fixture>;
  assert(!fixtures[name], `fixture ${name} exists`);
  assert.equal(width % 512, 0, 'fixture width must be whole beats');
  const slot = await request('slot.status', { trackIndex, slotIndex: row });
  const track = await trackAt(trackIndex);
  // A failed earlier attempt recorded its owned clip. Resume it; setStep rewrites the same notes.
  const owned = (state.clips as Wire[]).some(clip => clip.intent === name && clip.row === row && clip.trackId === track.channelId);
  if (!owned) {
    assert.notEqual(slot.hasContent, true, 'row must start empty');
    (state.clips as Wire[]).push({ trackId: track.channelId, row, intent: name }); await save(statePath, state);
    await request('clip.create', { trackIndex, slotIndex: row, lengthBeats: width / 512 });
  }
  await until(() => request('slot.status', { trackIndex, slotIndex: row }), value => value.hasContent === true);
  await bindFixture(trackIndex, row);
  const started = performance.now(), batches: number[] = [];
  for (let from = 0; from < count; from += 4096) {
    const reply = await shadow('fixtureWrite', { count, width, from, size: 4096, durationCap: cap });
    batches.push(Number(reply.batchMs));
  }
  const writeMs = performance.now() - started;
  // The host applies writes after the request returns. Poll the declared coordinates until they verify.
  const indexes = oracleIndexes(count), coordinates = indexes.map(i => { const n = fixtureNote(i, count, width, 0, cap); return [n.cell, n.pitch]; });
  let issues: string[] = [];
  await until(async () => {
    const read = await shadow('fixtureRead', { coordinates });
    issues = targetedIssues(read.notes, indexes, count, width, 0, cap); return { issues };
  }, () => issues.length === 0, 600_000, 500);
  const settleMs = performance.now() - started - writeMs;
  fixtures[name] = { name, trackIndex, trackId: String(track.channelId), row, width, count, semitones: 0, durationCap: cap };
  (state.writes ??= []) as Wire[]; (state.writes as Wire[]).push({ name, count, width, writeMs, batches: batches.length,
    maxBatchMs: Math.max(...batches), settleMs, verifiedIndexes: indexes.length });
  await save(statePath, state);
  console.log(JSON.stringify({ fixture: name, count, width, writeMs: Math.round(writeMs), settleMs: Math.round(settleMs), verified: indexes.length }));
}

/** Bind one shadow handle with a populated canary, then drain dirty work. */
async function bindShadow(target: Fixture, canary: Fixture): Promise<Wire> {
  const started = performance.now();
  const acquired = await shadow('acquire', { trackIndex: target.trackIndex, row: target.row,
    canaryTrackIndex: canary.trackIndex, canaryRow: canary.row });
  assert(['warm', 'reserved'].includes(String(acquired.poolDecision)), JSON.stringify(acquired).slice(0, 600));
  const index = Number(acquired.index);
  const settled = await until(() => shadow('poll', { index }), value => {
    assert.notEqual(value.phase, 'retired', `binding retired: ${String(value.reason)}`);
    return (value.phase === 'settled' || value.phase === 'complete') && value.canaryPhase === 'target';
  }, 3_600_000, 50);
  const bindMs = performance.now() - started;
  const drain = await drainShadow(index);
  return { index, acquired: { poolDecision: acquired.poolDecision }, bindMs, settledPhase: settled.phase, drain };
}
async function drainShadow(index: number): Promise<Wire> {
  const started = performance.now(); let calls = 0, coordinates = 0, maxMs = 0, quiet = 0, last: Wire = {};
  for (;;) {
    last = await shadow('reconcile', { index }); calls++;
    // A refused reconcile has no coordinate count. It is a failure, not a quiet poll.
    assert(last.reconciledCoordinates !== undefined, `reconcile refused: ${String(last.reason)} (${String(last.fallbackReason)})`);
    coordinates += Number(last.reconciledCoordinates ?? 0); maxMs = Math.max(maxMs, Number(last.reconcileMs ?? 0));
    const pending = Number(last.pendingWorkItemsIncludingPhysicalHints ?? 0);
    quiet = pending === 0 && Number(last.reconciledCoordinates ?? 0) === 0 ? quiet + 1 : 0;
    if (quiet >= 3) break;
    assert(performance.now() - started < 3_600_000, 'dirty work did not drain');
    await wait(20);
  }
  return { drainMs: performance.now() - started, calls, coordinates, maxReconcileMs: maxMs, reason: last.reason ?? null };
}
async function promoted(index: number, payload: 'compact' | 'none' | 'full' = 'compact'): Promise<Wire> {
  const started = performance.now(); let polls = 1;
  let result = await shadow('promotedStart', { index, payload });
  assert(result.scanId !== undefined || result.promoted === true, `promoted read refused: ${String(result.reason)}`);
  // Publication ends the read. A later poll returns only global diagnostics.
  while (result.comparison === 'pending') {
    result = await shadow('comparePoll'); polls++;
    assert(performance.now() - started < 3_600_000, 'promoted read did not end');
  }
  return { wallMs: performance.now() - started, polls, result };
}
function readSummary(read: Wire, target: Fixture): Wire {
  const result = read.result as Wire, candidate = (result.lastSnapshotCandidate ?? {}) as Wire;
  const issues = result.comparison === 'promoted-unverified'
    ? compactIssues(result.compactNotes, target.count, target.width, target.semitones, 20, target.durationCap ?? 64) : [`refused:${String(result.comparison)}`];
  return { wallMs: read.wallMs, polls: read.polls, comparison: result.comparison, settlementWitness: result.settlementWitness,
    noteCount: result.noteCount ?? 0, reconcileMs: result.reconcileMs, enrichmentHostWorkMs: candidate.hostWorkMs,
    enrichmentBatches: candidate.batches, maxBatchMs: candidate.lastBatchMs, phases: result.scanPhaseTimesMs,
    payloadEncodeMs: result.payloadEncodeMs, responseBytes: Buffer.byteLength(JSON.stringify(result)), issues };
}
let helloDone = false;
/** The exact reader needs the handshake. Without it the adapter reads a coarse pool grid (8h1a finding). */
async function exactRead(target: Fixture): Promise<Wire> {
  if (!helloDone) { await adapter.hello(); helloDone = true; }
  const started = performance.now();
  let value: Wire;
  try {
    value = await callTool(workspace, 'acquire_clip_note_source', { trackId: target.trackId, row: target.row }, EXPERIMENTAL_7B_TOOL_PROFILE) as Wire;
  } catch (error) {
    // E131 refuses some clips, for example above its note limit. A refusal is not an exact read.
    return { wallMs: performance.now() - started, refused: String(error).slice(0, 300), issues: [], noteCount: 0 };
  }
  const wallMs = performance.now() - started;
  const source = value.exactSource as Wire | undefined;
  return { wallMs, issues: source === undefined ? [`exact-refused:${JSON.stringify(value).slice(0, 300)}`]
    : exactSourceIssues(source, target.count, target.width, target.semitones), noteCount: (source?.eventMap as Wire[] | undefined)?.length ?? 0 };
}

/** One arm: configure, cold bind and promoted read, warm reads, targeted oracle, and optional paired exact reads. */
async function arm(out: string, statePath: string, name: string, axis: string, value: number, options: Wire): Promise<void> {
  const entry = await guard(), state = await readJson(statePath), fixtures = state.fixtures as Record<string, Fixture>;
  const target = fixtures[name], canary = fixtures[String(options.canary ?? 'canary')];
  assert(target && canary, 'target and canary fixtures are required');
  const allocation = (entry.configuration as Wire).allocation as Wire;
  const report: Wire = { schema: 'phase8h1a-arm-v1', marker: KNEE_MARKER, complete: false, eligible: false, captured: new Date().toISOString(),
    axis, axisValue: value, fixture: target, canary: canary.name, ...entry };
  await save(out, report, true);
  const heaps: Wire[] = []; report.heaps = heaps;
  try {
    heaps.push(await heap('arm-entry'));
    report.configuration = await configure({ activeObservers: Number(options.observers ?? Math.min(2, Number(allocation.observers))),
      width: Number(options.width ?? target.width), ...sweepLimits(options.bounded === true) });
    report.ping = await shadow('ping', { p95Ms: percentile(await pings(20), 0.95) });
    report.cold = await bindShadow(target, canary);
    heaps.push(await heap('after-cold-bind'));
    const index = Number((report.cold as Wire).index);
    report.coldRead = readSummary(await promoted(index), target);
    assert.deepEqual((report.coldRead as Wire).issues, [], 'cold read differs from the fixture');
    const warm: Wire[] = [];
    report.warmReads = warm;
    for (let n = 0; n < Number(options.warm ?? 3); n++) {
      const read = readSummary(await promoted(index), target); warm.push(read);
      assert.deepEqual(read.issues, [], 'warm read differs from the fixture');
    }
    heaps.push(await heap('after-warm-reads'));
    const indexes = oracleIndexes(target.count);
    const cap = target.durationCap ?? 64;
    const coordinates = indexes.map(i => { const note = fixtureNote(i, target.count, target.width, target.semitones, cap); return [note.cell, note.pitch]; });
    await bindFixture(target.trackIndex, target.row);
    const targeted = await shadow('fixtureRead', { coordinates });
    report.oracleIssues = targetedIssues(targeted.notes, indexes, target.count, target.width, target.semitones, cap);
    assert.deepEqual(report.oracleIssues, [], 'targeted read differs from the fixture');
    heaps.push(await heap('after-targeted-oracle'));
    report.soundingCells = fixtureSoundingCells(target.count, target.width, cap);
    report.oracleReadMs = targeted.readMs;
    const exact: Wire[] = [];
    for (let n = 0; n < Number(options.exact ?? 0); n++) exact.push(await exactRead(target));
    report.exactReads = exact;
    if (exact.length > 0) heaps.push(await heap('after-exact-reads'));
    report.pingSamplesMs = await pings();
    report.after = await shadow('info');
    report.jvm = (await shadow('allocationStats')).jvmMemory;
    report.summary = verifyArm(report);
  } catch (error) { report.error = String(error); report.refused ??= String(error).slice(0, 200); throw error; }
  finally { await save(out, report); }
  console.log(JSON.stringify(report.summary));
}

/** Point one handle and wait for its target replay. Record each canary stage that a poll reports. */
async function pointShadow(index: number, target: Fixture, canary?: Fixture): Promise<Wire> {
  const started = performance.now(), stages: string[] = [];
  const params: Wire = { index, trackIndex: target.trackIndex, row: target.row };
  if (canary) { params.canaryTrackIndex = canary.trackIndex; params.canaryRow = canary.row; }
  const pointed = await shadow('point', params);
  assert.notEqual(pointed.phase, 'retired', `point refused: ${String(pointed.reason)}`);
  const settled = await until(() => shadow('poll', { index }), value => {
    assert.notEqual(value.phase, 'retired', `binding retired: ${String(value.reason)}`);
    if (stages.at(-1) !== value.canaryPhase) stages.push(String(value.canaryPhase));
    return (value.phase === 'settled' || value.phase === 'complete') && value.canaryPhase === 'target';
  }, 600_000, 50);
  return { bindMs: performance.now() - started, stages, canaryVerified: settled.canaryVerifiedForBinding, drain: await drainShadow(index) };
}
/** Dense comparison of one bound handle with an independent authority scan. */
async function dense(index: number): Promise<Wire> {
  const started = performance.now();
  let value = await shadow('compareStart', { index }); let polls = 1;
  while (value.comparison === 'pending') {
    value = await shadow('comparePoll'); polls++;
    assert(performance.now() - started < 600_000, 'dense comparison did not end');
  }
  return { wallMs: performance.now() - started, polls, comparison: value.comparison, noteCount: (value.authorityNotes as Wire[] | undefined)?.length ?? 0 };
}
/** Exact fallback reads a clip through the authority handle only. */
async function exactFallback(target: Fixture): Promise<Wire> {
  const started = performance.now(); let polls = 1;
  let value = await shadow('exactStart', { trackIndex: target.trackIndex, row: target.row });
  while (value.terminal !== true) {
    value = await shadow('exactPoll'); polls++;
    assert(performance.now() - started < 600_000, 'exact fallback did not end');
  }
  return { wallMs: performance.now() - started, polls, phase: value.phase, readMode: value.readMode,
    cacheMembershipUsed: value.cacheMembershipUsed, scannedCoordinates: value.scannedCoordinates,
    issues: value.phase === 'acquired' ? membershipIssues(value.authorityNotes, target.count, target.width, target.semitones, target.durationCap ?? 64)
      : [`exact-refused:${String(value.reason)}`] };
}

/**
 * Cursor slot bank row. Bind with the allocated cursor slot setting: an unused handle at the last scene, a canary
 * rebind, and the escape stage. Each binding gets a promoted read and a dense comparison. Exact fallback follows.
 */
async function binding(out: string, statePath: string, index: number): Promise<void> {
  const entry = await guard(), state = await readJson(statePath), fixtures = state.fixtures as Record<string, Fixture>;
  const { canary, last, other } = fixtures; assert(canary && last && other, 'canary, last, and other fixtures are required');
  const allocation = (entry.configuration as Wire).allocation as Wire;
  assert.equal(last.row, Number(allocation.scenes) - 1, 'the last fixture must be in the last scene');
  assert(canary.width === last.width && other.width === last.width, 'the matrix uses one width');
  const report: Wire = { schema: 'phase8h1a-binding-v1', marker: KNEE_MARKER, complete: false, eligible: false,
    captured: new Date().toISOString(), cursorScenes: allocation.cursorScenes, ...entry, steps: [] };
  await save(out, report, true);
  const steps = report.steps as Wire[];
  try {
    // The first step needs a handle that no earlier run in this load has used.
    report.configuration = await configure({ activeObservers: index + 1, width: last.width, ...openLimits() });
    report.handleIndex = index;
    report.ping = await shadow('ping', { p95Ms: percentile(await pings(20), 0.95) });
    const plan: [string, Fixture, Fixture | undefined, string[]][] = [
      ['unused-last-scene', last, undefined, ['target']],
      ['canary-rebind', other, canary, ['canary', 'target']],
      ['escape-to-canary', canary, other, ['escape', 'canary', 'target']],
      ['escape', last, canary, ['escape', 'canary', 'target']],
    ];
    for (const [label, target, via, expected] of plan) {
      const bound = await pointShadow(index, target, via);
      const read = readSummary(await promoted(index), target);
      const comparison = await dense(index);
      const step = { label, target: target.name, canary: via?.name ?? null, expectedStages: expected, ...bound, read, dense: comparison };
      steps.push(step); await save(out, report);
      console.log(JSON.stringify({ label, stages: bound.stages, bindMs: Math.round(Number(bound.bindMs)),
        readIssues: (read.issues as string[]).length, dense: comparison.comparison }));
    }
    report.exact = [await exactFallback(last), await exactFallback(other)];
    report.pingSamplesMs = await pings(); report.pingP95Ms = percentile(report.pingSamplesMs as number[], 0.95);
    report.heap = await heap('after-binding-matrix');
    report.summary = verifyBinding(report);
  } catch (error) { report.error = String(error); throw error; }
  finally { await save(out, report); }
  console.log(JSON.stringify(report.summary));
}

/**
 * Deadline row. Rebind one used handle serially across fixtures; each rebind needs a populated canary window.
 * The step window is global, so a working-set rewarm costs about the count times one rebind.
 */
async function rebinds(out: string, statePath: string, rounds: number): Promise<void> {
  const entry = await guard(), state = await readJson(statePath), fixtures = state.fixtures as Record<string, Fixture>;
  const { canary, last, other, w131072: large } = fixtures; assert(canary && last && other && large, 'canary, last, other, and w131072 are required');
  const report: Wire = { schema: 'phase8h1a-rebinds-v1', marker: KNEE_MARKER, complete: false, eligible: false,
    captured: new Date().toISOString(), rounds, ...entry, rebinds: [] };
  await save(out, report, true);
  const rows = report.rebinds as Wire[];
  try {
    report.configuration = await configure({ activeObservers: 2, width: large.width, ...openLimits() });
    report.ping = await shadow('ping', { p95Ms: percentile(await pings(20), 0.95) });
    for (let round = 0; round < rounds; round++) for (const target of [other, large, last]) {
      const bound = await pointShadow(0, target, canary);
      const read = readSummary(await promoted(0), target);
      rows.push({ round, target: target.name, notes: target.count, ...bound, readWallMs: read.wallMs, readIssues: read.issues });
      assert.deepEqual(read.issues, [], `${target.name} read issues`);
      console.log(JSON.stringify({ round, target: target.name, stages: bound.stages, bindMs: Math.round(Number(bound.bindMs)) }));
    }
    report.pingSamplesMs = await pings(); report.pingP95Ms = percentile(report.pingSamplesMs as number[], 0.95);
  } catch (error) { report.error = String(error); throw error; }
  finally { await save(out, report); }
}

/** Edit burst. Transpose the target by +12 and measure callback drain and dirty work. Then restore it. */
async function burst(out: string, statePath: string, name: string, mode: string, bounded = false): Promise<void> {
  assert(['reconstruct', 'native'].includes(mode));
  const entry = await guard(), state = await readJson(statePath), fixtures = state.fixtures as Record<string, Fixture>;
  const target = fixtures[name], canary = fixtures.canary; assert(target && canary);
  assert.equal(target.semitones, 0, 'burst needs an untransposed fixture');
  assert(mode === 'native' || (target.durationCap ?? 64) === 64,
    'the reconstruct writer supports only the default duration cap');
  const report: Wire = { schema: 'phase8h1a-burst-v1', marker: KNEE_MARKER, complete: false, eligible: false,
    captured: new Date().toISOString(), mode, fixture: target, ...entry, phases: [] };
  await save(out, report, true);
  const transpose = async (from: number, to: number): Promise<Wire> => {
    await bindFixture(target.trackIndex, target.row);
    const started = performance.now(); let batches = 0;
    if (mode === 'native') { await shadow('fixtureTranspose', { semitones: to - from }); batches = 1; }
    else for (let index = 0; index < target.count; index += 2048) {
      await shadow('fixtureReconstruct', { count: target.count, width: target.width, from: index, size: 2048, fromShift: from, toShift: to });
      batches++;
    }
    return { writeMs: performance.now() - started, batches };
  };
  try {
    const active = Number(((entry.configuration as Wire).active as Wire).observers);
    report.configuration = await configure({ activeObservers: bounded ? active : 2, width: target.width, ...sweepLimits(bounded) });
    report.heapBefore = await heap('burst-entry');
    report.ping = await shadow('ping', { p95Ms: percentile(await pings(20), 0.95) });
    const bound = await bindShadow(target, canary); const index = Number(bound.index); report.cold = bound;
    report.before = readSummary(await promoted(index), target);
    for (const [from, to] of [[0, 12], [12, 0]] as const) {
      const write = await transpose(from, to);
      target.semitones = to;
      const hints = await until(() => shadow('status', { index }), (() => {
        let last = -1, quiet = 0;
        return (value: Wire) => { const now = Number(value.callbacks); quiet = now === last ? quiet + 1 : 0; last = now; return quiet >= 10; };
      })(), 3_600_000, 100);
      const drain = await drainShadow(index);
      const pingSamples = await pings(20);
      const read = readSummary(await promoted(index), target);
      assert.deepEqual(read.issues, [], 'burst read differs from the fixture');
      (report.phases as Wire[]).push({ from, to, write, callbacks: hints.callbacks, physicalHintOverflow: hints.physicalHintOverflow,
        drain, pingP95Ms: percentile(pingSamples, 0.95), read, heap: await heap(`burst-shift-${to}`) });
      await save(out, report);
      console.log(JSON.stringify({ to, drainMs: drain.drainMs, coordinates: drain.coordinates, readIssues: (read.issues as string[]).length }));
    }
  } catch (error) { report.error = String(error); throw error; }
  finally {
    fixtures[name] = target; await save(statePath, state); await save(out, report);
  }
}

/** Create owned instrument tracks and empty clips for the observer count axis. Record intent first. */
async function populate(statePath: string, channels: number, emptyRows: number): Promise<void> {
  await guard();
  const state = await readJson(statePath);
  const tracks = state.tracks as Wire[], clips = state.clips as Wire[];
  let snapshot = await request('track.list'), list = snapshot.tracks as Wire[];
  assert(Number.isInteger(channels) && channels >= 1, 'channels must be a positive integer');
  const createEmpty = async (track: Wire): Promise<void> => {
    for (let row = 1; row <= emptyRows; row++) {
      if ((await request('slot.status', { trackIndex: track.index, slotIndex: row })).hasContent === true) continue;
      clips.push({ trackId: track.channelId, row, intent: 'empty' }); await save(statePath, state);
      await request('clip.create', { trackIndex: track.index, slotIndex: row, lengthBeats: 4 });
      await until(() => request('slot.status', { trackIndex: track.index, slotIndex: row }), value => value.hasContent === true);
    }
  };
  while (Number(snapshot.itemCount) - 1 < channels) {
    // The project count can exceed the bank window. Keep the new track and the fixture track visible.
    const position = Math.min(2, Number(snapshot.itemCount) - 1), beforeCount = Number(snapshot.itemCount),
      beforeIds = new Set(list.map(row => row.channelId));
    tracks.push({ intent: 'track', position }); await save(statePath, state);
    await request('track.create', { position });
    snapshot = await until(() => request('track.list'), value => Number(value.itemCount) > beforeCount
      && (value.tracks as Wire[]).some(row => row.index === position && !beforeIds.has(row.channelId)), 30_000, 50);
    list = snapshot.tracks as Wire[];
    tracks[tracks.length - 1] = { position, channelId: list.find(row => row.index === position)!.channelId };
    await createEmpty(list.find(row => row.index === position)!);
    if (tracks.length % 64 === 0) { await save(statePath, state); console.log(JSON.stringify({ tracks: tracks.length })); }
  }
  await save(statePath, state);
  const owned = new Set(tracks.map(row => row.channelId));
  for (const track of list.filter(row => owned.has(row.channelId))) {
    await createEmpty(track);
    await save(statePath, state);
  }
  console.log(JSON.stringify({ ownedTracks: owned.size, projectChannels: Number(snapshot.itemCount) - 1,
    visibleTracks: list.length, emptyClips: clips.filter(row => row.intent === 'empty').length }));
}

/** Observer count arm. Bind one handle per empty owned clip in waves of distinct tracks, then measure steady cost. */
async function observers(out: string, statePath: string, count: number, bounded = false, indexStart?: number): Promise<void> {
  const entry = await guard(), state = await readJson(statePath), canary = (state.fixtures as Record<string, Fixture>).canary;
  assert(canary, 'canary fixture required');
  const list = (await request('track.list')).tracks as Wire[];
  const targets = (state.clips as Wire[]).filter(row => row.intent === 'empty').map(row => ({
    trackIndex: Number(list.find(track => track.channelId === row.trackId)?.index), row: Number(row.row) }));
  assert(targets.length >= count, `${count} observers need ${count} empty owned clips; ${targets.length} exist`);
  const report: Wire = { schema: 'phase8h1a-observers-v1', marker: KNEE_MARKER, complete: false, eligible: false,
    captured: new Date().toISOString(), count, ...entry };
  await save(out, report, true);
  try {
    const allocation = (entry.configuration as Wire).allocation as Wire;
    if (indexStart !== undefined) assert(indexStart >= 0 && indexStart + count <= Number(allocation.observers));
    report.configuration = await configure({ activeObservers: indexStart === undefined ? count : Number(allocation.observers),
      width: bounded ? Number(allocation.width) : Number(((entry.configuration as Wire).active as Wire).width), ...sweepLimits(bounded) });
    report.directUnusedIndexStart = indexStart ?? null;
    report.ping = await shadow('ping', { p95Ms: percentile(await pings(20), 0.95) });
    report.heapBefore = await heap('observer-entry');
    report.idleBefore = await cpu();
    const started = performance.now(), waves: Wire[] = [], serial: Wire[] = [];
    report.waves = waves; report.serialCanaryBindings = serial;
    let directIndex = indexStart ?? 0, maxPollBatchMs = 0;
    const chosen = targets.slice(0, count), byTrack = new Map<number, typeof chosen>();
    for (const target of chosen) byTrack.set(target.trackIndex, [...(byTrack.get(target.trackIndex) ?? []), target]);
    for (let wave = 0; ; wave++) {
      const targetsInWave = [...byTrack.values()].map(rows => rows[wave]).filter(row => row !== undefined);
      if (targetsInWave.length === 0) break;
      const waveSize = bounded ? 16 : targetsInWave.length;
      for (let offset = 0; offset < targetsInWave.length; offset += waveSize) {
        const batch = targetsInWave.slice(offset, offset + waveSize);
        const waveStarted = performance.now(), indexes: number[] = [];
        for (const target of batch) {
          // An unused handle binds without a canary, so a wave binds in parallel. A used handle needs a
          // canary window. The step window is global, so a canary binding runs alone and settles first.
          let acquired: Wire;
          if (indexStart === undefined) acquired = await shadow('acquire', { trackIndex: target.trackIndex, row: target.row });
          else {
            const index = directIndex++;
            acquired = { ...await shadow('point', { index, trackIndex: target.trackIndex, row: target.row }), index,
              poolDecision: 'direct-unused' };
            assert.notEqual(acquired.phase, 'retired', `unused handle ${index} refused: ${String(acquired.reason)}`);
          }
          if (acquired.reason === 'populated-canary-required-for-rebind') {
            const serialStarted = performance.now();
            const bound = await bindShadow({ trackIndex: target.trackIndex, row: target.row } as Fixture, canary);
            serial.push({ index: bound.index, bindMs: performance.now() - serialStarted });
            continue;
          }
          assert(['warm', 'reserved', 'direct-unused'].includes(String(acquired.poolDecision)), JSON.stringify(acquired).slice(0, 400));
          indexes.push(Number(acquired.index));
        }
        const pending = new Set(indexes);
        while (pending.size > 0) {
          if (bounded) {
            // Service all handles while the host completes their binding and quiet floor.
            const pumpStarted = performance.now();
            while (performance.now() - pumpStarted < 2_000) {
              const pumped = await request('batch.run', { ops: [...pending].map(index =>
                ({ method: 'cache.shadow', params: { operation: 'poll', index } })) });
              assert.equal(pumped.failures, 0);
              maxPollBatchMs = Math.max(maxPollBatchMs, Number(pumped.elapsedMicros) / 1000);
              assert(maxPollBatchMs < 50, 'observer poll batch exceeded the host-work limit');
              await wait(50);
            }
          }
          for (const index of [...pending]) {
            const value = await shadow('poll', { index });
            assert.notEqual(value.phase, 'retired', `binding ${index} retired: ${String(value.reason)}`);
            if ((value.phase === 'settled' || value.phase === 'complete') && value.canaryPhase === 'target') pending.delete(index);
          }
          assert(performance.now() - waveStarted < 600_000, 'wave did not settle');
          await wait(50);
        }
        waves.push({ wave, offset, observers: batch.length, wallMs: performance.now() - waveStarted, indexes });
        await save(out, report);
        if (waves.length % 8 === 0) console.log(JSON.stringify({ wave, bound: waves.reduce((sum, row) => sum + Number(row.observers), 0) }));
      }
    }
    report.maxPollBatchMs = maxPollBatchMs;
    report.waves = waves; report.serialCanaryBindings = serial; report.bindMs = performance.now() - started;
    report.pingSamplesMs = await pings(); report.pingP95Ms = percentile(report.pingSamplesMs as number[], 0.95);
    report.idleAfter = await cpu(); report.after = await shadow('info');
    report.heap = await heap('after-observers');
    report.jvm = (await shadow('allocationStats')).jvmMemory;
  } catch (error) { report.error = String(error); throw error; }
  finally { await save(out, report); }
  console.log(JSON.stringify({ count, bindMs: report.bindMs, pingP95Ms: report.pingP95Ms }));
}

/** Inventory publication at one active bank size. A project switch uses the same drain from a fresh domain. */
async function inventory(out: string, tracks: number, scenes: number): Promise<void> {
  const entry = await guard();
  const report: Wire = { schema: 'phase8h1a-inventory-v1', marker: KNEE_MARKER, complete: false, eligible: false,
    captured: new Date().toISOString(), tracks, scenes, ...entry };
  await save(out, report, true);
  try {
    report.configuration = await configure({ tracks, scenes, activeObservers: 2, ...openLimits() });
    await wait(2_000);
    report.allocationAfterConfigure = await shadow('allocationStats');
    report.pingSamplesMs = await pings(); report.pingP95Ms = percentile(report.pingSamplesMs as number[], 0.95);
    const started = performance.now(); await shadow('rebuildBegin'); let polls = 0, list: Wire;
    for (;;) {
      await shadow('rebuildPoll'); polls++;
      list = await shadow('inventoryList');
      if (list.occupancyAdmitted === true) break;
      assert(performance.now() - started < 3_600_000, `inventory did not publish: ${String(list.reason)}`);
      await wait(20);
    }
    report.publication = { wallMs: performance.now() - started, polls, occupancyCount: list.occupancyCount };
    report.scan = await request('rig.scanTracks', {}, 300_000);
    report.idle = await cpu();
  } catch (error) { report.error = String(error); throw error; }
  finally { await save(out, report); }
  console.log(JSON.stringify({ tracks, scenes, publication: report.publication, pingP95Ms: report.pingP95Ms }));
}

/** Wait until the slot callback counter is quiet for one second. Return the drain to the last change. */
async function slotDrain(started: number, before: number): Promise<Wire> {
  let last = before, lastChange = started, polls = 0;
  for (;;) {
    const value = Number(((await shadow('info')).slotWindowValue as Wire).slots); polls++;
    if (value !== last) { last = value; lastChange = performance.now(); }
    if (performance.now() - lastChange >= 1_000) break;
    assert(performance.now() - started < 600_000, 'slot callbacks did not drain');
    await wait(20);
  }
  return { drainMs: lastChange - started, slotCallbacks: last - before, polls };
}
/**
 * Project size row. Switch to the previous project tab (the saved anchor) and back. Measure slot-delta delivery
 * and drain after each real switch, then inventory publication in the owned project. Nothing writes in the anchor.
 */
async function projectSwitch(out: string, rounds: number, bounded = false): Promise<void> {
  const entry = await guard(), owned = String((entry.allocation as Wire).projectName);
  const report: Wire = { schema: 'phase8h1a-switch-v1', marker: KNEE_MARKER, complete: false, eligible: false,
    captured: new Date().toISOString(), ownedProject: owned, ...entry, switches: [] };
  await save(out, report, true);
  const rows = report.switches as Wire[];
  try {
    const active = Number(((entry.configuration as Wire).active as Wire).observers);
    report.configuration = await configure({ activeObservers: bounded ? active : 2, ...sweepLimits(bounded) });
    report.tracks = (await request('track.list')).itemCount;
    for (let round = 0; round < rounds; round++) for (const action of ['Select Previous Project', 'Select Next Project']) {
      const before = Number(((await shadow('info')).slotWindowValue as Wire).slots), started = performance.now();
      await request('app.invokeAction', { id: action });
      const expectedProject = action === 'Select Previous Project' ? ANCHOR_PROJECT : owned;
      await until(() => shadow('allocationStats'), value => value.projectName === expectedProject, 120_000, 100);
      const activationMs = performance.now() - started;
      const drain = await slotDrain(started, before);
      const project = String((await shadow('allocationStats')).projectName);
      const samples = await pings(20);
      rows.push({ round, action, project, activationMs, ...drain, pingP95Ms: percentile(samples, 0.95) });
      await save(out, report);
      console.log(JSON.stringify({ round, action, project, activationMs: Math.round(activationMs),
        drainMs: Math.round(Number(drain.drainMs)), slotCallbacks: drain.slotCallbacks }));
    }
    const back = await shadow('allocationStats');
    assert.equal(back.projectName, owned, 'the switch must end in the owned project');
    report.heap = await heap('after-switches');
    if (Number(back.trackItemCount) > Number(back.activeTracks)) {
      report.publication = { refused: 'project-exceeds-active-bank', projectTracks: back.trackItemCount,
        activeTracks: back.activeTracks };
      return;
    }
    const started = performance.now(); await shadow('rebuildBegin'); let polls = 0, list: Wire;
    for (;;) {
      await shadow('rebuildPoll'); polls++;
      list = await shadow('inventoryList');
      if (list.occupancyAdmitted === true) break;
      assert(performance.now() - started < 3_600_000, `inventory did not publish: ${String(list.reason)}`);
      await wait(20);
    }
    report.publication = { wallMs: performance.now() - started, polls, occupancyCount: list.occupancyCount };
  } catch (error) { report.error = String(error); throw error; }
  finally { await save(out, report); }
  console.log(JSON.stringify({ publication: report.publication }));
}

/** Delete owned clips, then owned tracks, in reverse intent order. */
async function cleanup(statePath: string): Promise<void> {
  await guard();
  const state = await readJson(statePath);
  const resolve = async (id: unknown): Promise<number | undefined> =>
    ((await request('track.list')).tracks as Wire[]).find(row => row.channelId === id)?.index as number | undefined;
  for (const clip of [...(state.clips as Wire[])].reverse()) {
    const index = await resolve(clip.trackId); if (index === undefined) continue;
    if ((await request('slot.status', { trackIndex: index, slotIndex: clip.row })).hasContent === true)
      await request('slot.delete', { trackIndex: index, slotIndex: clip.row });
  }
  for (const track of [...(state.tracks as Wire[])].reverse()) {
    const index = await resolve(track.channelId); if (index === undefined) continue;
    await request('track.delete', { trackIndex: index }); await wait(50);
  }
  state.cleaned = new Date().toISOString(); await save(statePath, state);
  console.log(JSON.stringify({ cleaned: true, clips: (state.clips as Wire[]).length, tracks: (state.tracks as Wire[]).length }));
}

/** Recompute each retained arm from its samples, then select each axis limit. Diagnostic files are excluded. */
async function summarize(directory: string, out: string): Promise<void> {
  const { readdir } = await import('node:fs/promises');
  const files = (await readdir(directory)).filter(name => /^arm-[a-z]+-\d+\.json$/.test(name)).sort();
  const axes = new Map<string, ReturnType<typeof verifyArm>[]>();
  const arms: Wire[] = [];
  for (const file of files) {
    const arm = await readJson(join(directory, file));
    const point = verifyArm(arm);
    arms.push({ file, axis: arm.axis, point });
    axes.set(String(arm.axis), [...(axes.get(String(arm.axis)) ?? []), point]);
  }
  const selection: Wire = {};
  for (const [axis, points] of axes) selection[axis] = selectLimit(points);
  await save(out, { schema: 'phase8h1a-summary-v1', marker: KNEE_MARKER, complete: false, eligible: false,
    generated: new Date().toISOString(), arms, selection });
  console.log(JSON.stringify(selection));
}

const [command, ...args] = process.argv.slice(2);
// Each live command owns the fixture cursor and state files until its process exits.
const lockPath = join(tmpdir(), 'ghostnote-phase8h1a-live.lock');
const liveLock = command === 'summarize' ? undefined : await open(lockPath, 'wx');
if (liveLock) await liveLock.writeFile(JSON.stringify({ pid: process.pid, command, started: new Date().toISOString() }) + '\n');
const flag = (name: string): string | undefined => { const at = args.indexOf(`--${name}`); return at < 0 ? undefined : args[at + 1]; };
try {
  if (command === 'config') await config(args[0]!, args[1] as AllocationName, args[2] === undefined ? undefined : Number(args[2]));
  else if (command === 'restore') await restore(args[0]!);
  else if (command === 'load') await load(args[0]!, args[1] as AllocationName);
  else if (command === 'control') await control(args[0]!);
  else if (command === 'populate') await populate(args[0]!, Number(args[1]), Number(args[2]));
  else if (command === 'fixture') await fixture(args[0]!, args[1]!, Number(args[2]), Number(args[3]), Number(args[4]), Number(args[5]),
    flag('cap') === undefined ? 64 : Number(flag('cap')));
  else if (command === 'arm') await arm(args[0]!, args[1]!, args[2]!, args[3]!, Number(args[4]),
    { exact: flag('exact'), warm: flag('warm'), observers: flag('observers'), width: flag('width'), canary: flag('canary'), bounded: args.includes('--bounded') });
  else if (command === 'binding') await binding(args[0]!, args[1]!, Number(flag('index') ?? 7));
  else if (command === 'rebinds') await rebinds(args[0]!, args[1]!, Number(args[2] ?? 3));
  else if (command === 'switch') await projectSwitch(args[0]!, Number(args[1] ?? 2), args.includes('--bounded'));
  else if (command === 'burst') await burst(args[0]!, args[1]!, args[2]!, args[3]!, args.includes('--bounded'));
  else if (command === 'observers') await observers(args[0]!, args[1]!, Number(args[2]), args.includes('--bounded'),
    flag('indexStart') === undefined ? undefined : Number(flag('indexStart')));
  else if (command === 'inventory') await inventory(args[0]!, Number(args[1]), Number(args[2]));
  else if (command === 'cleanup') await cleanup(args[0]!);
  else if (command === 'summarize') await summarize(args[0]!, args[1]!);
  else throw new Error(`unknown command: ${String(command)}`);
} finally {
  bridge.disconnect();
  if (liveLock) { await liveLock.close(); await unlink(lockPath); }
}
