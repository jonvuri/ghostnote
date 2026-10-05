/**
 * 8h1a cache limit knee sweep. Live driver. Each subcommand writes one artifact and refuses the protected project.
 * One controller load holds one research allocation; `cache.configure` changes the active scale.
 *
 *   config <entry.json> <current|middle|max> [observers]   write the research rig config (records the original)
 *   restore <entry.json>                                    restore the original rig config
 *   load <out.json> <allocation>                            fresh-load allocation, ping, idle CPU, JVM memory
 *   control <out.json>                                      unsubscribed control: nothing subscribed, then everything
 *   populate <state.json> <channels> <emptyRows>            owned tracks and empty count-sweep clips
 *   fixture <state.json> <name> <track> <row> <width> <count>
 *   arm <out.json> <state.json> <name> <axis> <value> [--exact N] [--warm N] [--observers N]
 *   burst <out.json> <state.json> <name> <reconstruct|native>
 *   observers <out.json> <state.json> <count>
 *   inventory <out.json> <tracks> <scenes>
 *   cleanup <state.json>                                    delete owned fixture clips and tracks
 *   summarize <dir> <out.json>                              recompute arms and select each axis limit (offline)
 */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
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
import { ALLOCATIONS, HEAP_STOP_BYTES, KNEE_MARKER, isolationShape, observerConfig, parseHistogram, widthConfig, KNEE_METHOD_COUNT, KNEE_METHODS_HASH, KNEE_PROFILE, compactIssues,
  exactSourceIssues, fixtureNote, fixtureSoundingCells, kneeConfig, oracleIndexes, openLimits, percentile, selectLimit, targetedIssues, verifyArm,
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

async function config(entryPath: string, name: AllocationName, observers?: number): Promise<void> {
  const bytes = await readFile(configPath);
  let original = bytes;
  try {
    const prior = await readJson(entryPath); original = Buffer.from(String(prior.originalBase64), 'base64');
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  assert.equal(hash(original), ORIGINAL_CONFIG_SHA256, 'unexpected original config');
  const research = name.startsWith('width-') ? widthConfig(Number(name.slice(6)))
    : name.startsWith('observers-') ? observerConfig(Number(name.slice(10).split('-')[0]),
      name.includes('-cursor') ? Number(name.split('-cursor')[1]) : undefined) : kneeConfig(name, observers);
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
async function load(out: string, name: AllocationName): Promise<void> {
  const entry = await guard(), stats = entry.stats as Wire;
  const shape = isolationShape(name), size = shape ?? ALLOCATIONS[name];
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
  await shadow('fixtureSelect', { trackIndex, row });
  await until(() => shadow('fixtureStatus'), value => value.clipExists === true && value.sceneIndex === row);
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
      width: Number(options.width ?? target.width), ...openLimits() });
    report.ping = await shadow('ping', { p95Ms: percentile(await pings(20), 0.95) });
    report.cold = await bindShadow(target, canary);
    heaps.push(await heap('after-cold-bind'));
    const index = Number((report.cold as Wire).index);
    report.coldRead = readSummary(await promoted(index), target);
    const warm: Wire[] = [];
    for (let n = 0; n < Number(options.warm ?? 3); n++) warm.push(readSummary(await promoted(index), target));
    report.warmReads = warm;
    heaps.push(await heap('after-warm-reads'));
    const indexes = oracleIndexes(target.count);
    const cap = target.durationCap ?? 64;
    const coordinates = indexes.map(i => { const note = fixtureNote(i, target.count, target.width, target.semitones, cap); return [note.cell, note.pitch]; });
    await bindFixture(target.trackIndex, target.row);
    const targeted = await shadow('fixtureRead', { coordinates });
    report.oracleIssues = targetedIssues(targeted.notes, indexes, target.count, target.width, target.semitones, cap);
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

/** Edit burst. Transpose the target by +12 and measure callback drain and dirty work. Then restore it. */
async function burst(out: string, statePath: string, name: string, mode: string): Promise<void> {
  assert(['reconstruct', 'native'].includes(mode));
  const entry = await guard(), state = await readJson(statePath), fixtures = state.fixtures as Record<string, Fixture>;
  const target = fixtures[name], canary = fixtures.canary; assert(target && canary);
  assert.equal(target.semitones, 0, 'burst needs an untransposed fixture');
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
    report.configuration = await configure({ activeObservers: 2, width: target.width, ...openLimits() });
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
      (report.phases as Wire[]).push({ from, to, write, callbacks: hints.callbacks, physicalHintOverflow: hints.physicalHintOverflow,
        drain, pingP95Ms: percentile(pingSamples, 0.95), read });
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
  let list = (await request('track.list')).tracks as Wire[];
  while (list.filter(row => row.type !== 'Master').length < channels) {
    // Insert after the last instrument or audio track, before effect and master tracks.
    const position = list.filter(row => row.type !== 'Master' && row.type !== 'Effect').length;
    tracks.push({ intent: 'track', position }); await save(statePath, state);
    await request('track.create', { position });
    const next = await until(async () => await request('track.list'), value => (value.tracks as Wire[]).length > list.length, 30_000, 50);
    list = next.tracks as Wire[];
    tracks[tracks.length - 1] = { position, channelId: list.find(row => row.index === position)?.channelId };
    if (tracks.length % 64 === 0) { await save(statePath, state); console.log(JSON.stringify({ tracks: tracks.length })); }
  }
  await save(statePath, state);
  const owned = new Set(tracks.map(row => row.channelId));
  for (const track of list.filter(row => owned.has(row.channelId))) {
    for (let row = 1; row <= emptyRows; row++) {
      if ((await request('slot.status', { trackIndex: track.index, slotIndex: row })).hasContent === true) continue;
      clips.push({ trackId: track.channelId, row, intent: 'empty' });
      await request('clip.create', { trackIndex: track.index, slotIndex: row, lengthBeats: 4 });
    }
    await save(statePath, state);
  }
  console.log(JSON.stringify({ ownedTracks: owned.size, emptyClips: clips.filter(row => row.intent === 'empty').length }));
}

/** Observer count arm. Bind one handle per empty owned clip in waves of distinct tracks, then measure steady cost. */
async function observers(out: string, statePath: string, count: number): Promise<void> {
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
    report.configuration = await configure({ activeObservers: count, ...openLimits() });
    report.ping = await shadow('ping', { p95Ms: percentile(await pings(20), 0.95) });
    report.idleBefore = await cpu();
    const started = performance.now(), waves: Wire[] = [], serial: Wire[] = [];
    const chosen = targets.slice(0, count), byTrack = new Map<number, typeof chosen>();
    for (const target of chosen) byTrack.set(target.trackIndex, [...(byTrack.get(target.trackIndex) ?? []), target]);
    for (let wave = 0; ; wave++) {
      const batch = [...byTrack.values()].map(rows => rows[wave]).filter(row => row !== undefined);
      if (batch.length === 0) break;
      const waveStarted = performance.now(), indexes: number[] = [];
      for (const target of batch) {
        // An unused handle binds without a canary, so a wave binds in parallel. A used handle needs a
        // canary window. The step window is global, so a canary binding runs alone and settles first.
        let acquired = await shadow('acquire', { trackIndex: target.trackIndex, row: target.row });
        if (acquired.reason === 'populated-canary-required-for-rebind') {
          const serialStarted = performance.now();
          const bound = await bindShadow({ trackIndex: target.trackIndex, row: target.row } as Fixture, canary);
          serial.push({ index: bound.index, bindMs: performance.now() - serialStarted });
          continue;
        }
        assert(['warm', 'reserved'].includes(String(acquired.poolDecision)), JSON.stringify(acquired).slice(0, 400));
        indexes.push(Number(acquired.index));
      }
      const pending = new Set(indexes);
      while (pending.size > 0) {
        for (const index of [...pending]) {
          const value = await shadow('poll', { index });
          assert.notEqual(value.phase, 'retired', `binding ${index} retired: ${String(value.reason)}`);
          if ((value.phase === 'settled' || value.phase === 'complete') && value.canaryPhase === 'target') pending.delete(index);
        }
        assert(performance.now() - waveStarted < 600_000, 'wave did not settle');
        await wait(50);
      }
      waves.push({ wave, observers: batch.length, wallMs: performance.now() - waveStarted });
      if (wave % 8 === 0) console.log(JSON.stringify({ wave, bound: waves.reduce((sum, row) => sum + Number(row.observers), 0) }));
    }
    report.waves = waves; report.serialCanaryBindings = serial; report.bindMs = performance.now() - started;
    report.pingSamplesMs = await pings(); report.pingP95Ms = percentile(report.pingSamplesMs as number[], 0.95);
    report.idleAfter = await cpu(); report.after = await shadow('info');
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
    { exact: flag('exact'), warm: flag('warm'), observers: flag('observers'), width: flag('width'), canary: flag('canary') });
  else if (command === 'burst') await burst(args[0]!, args[1]!, args[2]!, args[3]!);
  else if (command === 'observers') await observers(args[0]!, args[1]!, Number(args[2]));
  else if (command === 'inventory') await inventory(args[0]!, Number(args[1]), Number(args[2]));
  else if (command === 'cleanup') await cleanup(args[0]!);
  else if (command === 'summarize') await summarize(args[0]!, args[1]!);
  else throw new Error(`unknown command: ${String(command)}`);
} finally { bridge.disconnect(); }
