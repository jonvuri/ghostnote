/**
 * 8h3d change awareness. Live driver. Use an owned unsaved project; refuse the saved anchor (D29).
 *
 *   config <entry.json>              write the research rig config (record the original)
 *   restore <entry.json>             restore the original rig config
 *   setup <state.json>               owned tracks: one per E227 size, four survey tracks, one edit track
 *   fixtures <state.json>            write every clip; a cold read verifies each declared note
 *   pull <out> <state.json>          candidate 1: three reads at each E227 size
 *   survey <out> <state.json> <n>    candidate 1: baseline, edit two clips, survey n clips again
 *   matrix <out> <state.json>        candidates 1–3: the edit matrix on the edit clip, and the gate interaction
 *   watches <out> <state.json> <n>   candidate 3: heap, ping, bind, and detection with n watched clips
 *   user <out> <state.json>          the operator edits the edit clip in the Bitwig editor
 *   cleanup <out> <state.json>       release watches, park the writer, delete owned tracks
 *   verify-offline <dir>             check the retained artifacts and the restored baseline
 */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { gunzipSync, gzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { LiveAdapter } from '../adapters/live/adapter.js';
import { decodeNoteFrame, type NoteFrame, type RawNoteFields } from '../adapters/live/clip-read.js';
import { clip, scene, slot, track } from '../contract/index.js';
import { Executor } from '../engine/executor.js';
import { ORIGINAL_CONFIG_SHA256 } from './phase8g5-consumers-lib.js';
import { parseHistogram, percentile } from './phase8h1a-knee-lib.js';
import { classCounts } from './phase8h1b-sounding-lib.js';
import { WireTransport, type Call } from './phase8h3c-promotion.js';
import { RESEARCH_HASH, RESEARCH_METHODS, RESEARCH_PROFILE, SINGLE_TRACKS, SIZES, TYPICAL, WATCH_REVISION,
  agentResult, changedValues, compact, declaredIssues, editToStaleMs, median, researchConfig, snapshotFingerprint,
  staleKeys, typicalWidth, type SizePlan, type Wire } from './phase8h3d-change-lib.js';

const PAGE = 131_072;
const ANCHOR = 'gn-scale-test';
const NOTE_STEP_CLASS = 'com.bitwig.flt.control_surface.proxy.NoteStep';
const configPath = join(homedir(), '.ghostnote', 'rig.json');
const transport = new WireTransport();
const adapter = new LiveAdapter({ transport });
const execute = promisify(execFile);
const request = async (method: string, params?: Wire, owned?: Call[]): Promise<Wire> =>
  await transport.sendRecorded({ method, ...(params ? { params } : {}) }, owned) as Wire;
const shadow = async (operation: string, params: Wire = {}, owned?: Call[]): Promise<Wire> =>
  await request('cache.shadow', { operation, ...params }, owned);
const pause = async (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));
const sha = (bytes: Buffer | string): string => createHash('sha256').update(bytes).digest('hex');
const load = async (path: string): Promise<Wire> => JSON.parse(await readFile(path, 'utf8'));
const save = async (path: string, value: unknown): Promise<void> => {
  await mkdir(dirname(path), { recursive: true }); await writeFile(path, JSON.stringify(value, null, 1) + '\n');
};
const artifact = async (path: string, value: unknown): Promise<void> => {
  await mkdir(dirname(path), { recursive: true }); await writeFile(path, gzipSync(JSON.stringify(value) + '\n'));
};
async function until(next: () => Promise<Wire>, done: (value: Wire) => boolean, limit = 60_000, interval = 30): Promise<Wire> {
  const started = performance.now();
  for (;;) {
    const value = await next(); if (done(value)) return value;
    assert(performance.now() - started < limit, `live state did not settle: ${JSON.stringify(value).slice(0, 600)}`);
    await pause(interval);
  }
}

/** Research runtime, watch marker, reader marker, and an owned project. */
async function guard(): Promise<Wire> {
  const hello = await request('contract.hello');
  assert.equal(hello.runtimeProfile, RESEARCH_PROFILE); assert.equal(hello.methodCount, RESEARCH_METHODS);
  assert.equal(hello.methodsHash, RESEARCH_HASH);
  const mark = await request('revision.get');
  assert(/^New \d+$/.test(mark.project) && mark.project !== ANCHOR, `use an owned unsaved project, got ${mark.project}`);
  const rig = await request('rig.info');
  assert.equal(rig.clipReader?.revision, 'clip-reader-v1'); assert.equal(rig.clipReader?.closeRule, 'confirm-before-release-v1');
  assert.equal(rig.clipReader?.page, PAGE);
  const watch = await shadow('watchStatus');
  assert.equal(watch.revision, WATCH_REVISION); assert.equal(watch.count, 32);
  await adapter.hello();
  return { hello, mark, rig, watch, stats: await request('rig.stats') };
}

async function config(entryPath: string): Promise<void> {
  const original = await readFile(configPath);
  assert.equal(sha(original), ORIGINAL_CONFIG_SHA256, 'unexpected original config');
  const research = researchConfig();
  await save(entryPath, { schema: 'phase8h3d-config-entry-v1', captured: new Date().toISOString(),
    originalSha256: sha(original), originalBase64: original.toString('base64'), research });
  await writeFile(configPath, JSON.stringify(research) + '\n');
  console.log(JSON.stringify({ research, researchSha256: sha(await readFile(configPath)) }));
}
async function restore(entryPath: string): Promise<void> {
  const bytes = Buffer.from(String((await load(entryPath)).originalBase64), 'base64');
  assert.equal(sha(bytes), ORIGINAL_CONFIG_SHA256); await writeFile(configPath, bytes);
  assert.equal(sha(await readFile(configPath)), ORIGINAL_CONFIG_SHA256);
  console.log(JSON.stringify({ restoredSha256: ORIGINAL_CONFIG_SHA256 }));
}

async function indexOf(id: string, owned?: Call[]): Promise<number> {
  const found = ((await request('track.list', undefined, owned)).tracks as Wire[]).find(row => row.channelId === id);
  assert(found, `owned track ${id} is absent`); return Number(found.index);
}
interface Target { key: string; trackId: string; row: number; plan: Pick<SizePlan, 'kind' | 'beats' | 'count' | 'cap'> }
const typicalPlan = { kind: 'spec' as const, ...TYPICAL };
function surveyTargets(state: Wire, n: number): Target[] {
  assert(n <= SINGLE_TRACKS, 'too many survey targets');
  return Array.from({ length: n }, (_, i) => ({ key: `single-${i}`, trackId: String(state.tracks[`single-${i}`]), row: 0,
    plan: typicalPlan }));
}
const editTarget = (state: Wire): Target => ({ key: 'edit:0', trackId: String(state.tracks.edit), row: 0, plan: typicalPlan });
function allTargets(state: Wire): Target[] {
  return [...SIZES.map(plan => ({ key: plan.name, trackId: String(state.tracks[plan.name]), row: 0, plan })),
    editTarget(state), ...surveyTargets(state, SINGLE_TRACKS)];
}

/**
 * Owned tracks: E227 sizes, the edit track, and 64 single-clip tracks. A second run adds only absent tracks.
 * The first run also made four 16-row survey tracks; the row finding retired them, and cleanup deletes them.
 */
async function setup(statePath: string): Promise<void> {
  const entry = await guard();
  let state: Wire;
  try { state = await load(statePath); state.resumed = [...(state.resumed ?? []), entry]; }
  catch {
    state = { schema: 'phase8h3d-state-v1', entry, entryTracks: (await request('track.list')).tracks, tracks: {},
      entrySelection: await request('selection.status'), written: {} };
  }
  await save(statePath, state);
  const keys = [...SIZES.map(plan => plan.name), 'edit', ...Array.from({ length: SINGLE_TRACKS }, (_, i) => `single-${i}`)];
  for (const key of keys.filter(key => state.tracks[key] === undefined)) {
    const before = new Set(((await request('track.list')).tracks as Wire[]).map(row => row.channelId));
    await request('track.create', { position: 0 });
    const after = await until(() => request('track.list'),
      value => (value.tracks as Wire[]).some(row => row.index === 0 && !before.has(row.channelId)), 30_000, 50);
    state.tracks[key] = String((after.tracks as Wire[]).find(row => row.index === 0)!.channelId);
    await request('track.setName', { trackIndex: 0, name: `gn-8h3d-${key}` });
    await save(statePath, state);
  }
  console.log(JSON.stringify({ tracks: state.tracks }));
}

/** Bind the full-width research writer to one clip and pin it. */
async function bindWriter(trackIndex: number, row: number): Promise<void> {
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
  // A field edit reads the writer's grid. Let the bind replay arrive first.
  await pause(500);
}
/** Park the writer on the empty clip. It must hold no grid during reads and heap samples. */
async function parkWriter(state: Wire): Promise<void> {
  await shadow('fixturePin', { pinned: false });
  // The empty-64 track holds a clip with no note, so the writer holds no grid there.
  await bindWriter(await indexOf(state.tracks['empty-64']), 0);
}

/** One product read of a clip, with all pages, wall time, and owned response bytes. */
async function read(target: Target): Promise<Wire> {
  const calls: Call[] = [], started = performance.now();
  const result = await request('clip.read', { trackIndex: await indexOf(target.trackId, calls), row: target.row,
    channelId: target.trackId }, calls);
  const rows: RawNoteFields[] = [];
  if (!result.refused) {
    let frame = result.frame as NoteFrame;
    for (;;) {
      for (const row of decodeNoteFrame(frame, PAGE)) rows.push(row);
      if (frame.next < 0) break;
      frame = await request('clip.readPage', { readId: result.readId, from: frame.next }, calls) as NoteFrame;
    }
  }
  const wallMs = performance.now() - started;
  const fingerprint = result.refused ? '' : snapshotFingerprint(rows, result.bound);
  const { frame: _frame, ...reply } = result;
  return { key: target.key, reply, rows, fingerprint, wallMs, calls: calls.length,
    bytes: calls.reduce((sum, call) => sum + call.bytes, 0) };
}
const summary = (r: Wire): Wire => ({ key: r.key, refused: r.reply.refused, notes: r.rows.length, fingerprint: r.fingerprint,
  wallMs: r.wallMs, bytes: r.bytes, calls: r.calls, reader: { parkMs: r.reply.parkMs, closeMs: r.reply.closeMs,
    totalMs: r.reply.totalMs, callbacks: r.reply.callbacks, afterClose: r.reply.afterClose,
    releaseOn: r.reply.releaseOn, releaseSustain: r.reply.releaseSustain } });

/** Write every clip. A cold read verifies each declared note; it retries until the writes land. */
async function fixtures(statePath: string): Promise<void> {
  await guard(); const state = await load(statePath);
  for (const target of allTargets(state)) {
    if (state.written[target.key]) continue;
    const started = performance.now(), idx = await indexOf(target.trackId);
    const slotState = await request('slot.status', { trackIndex: idx, slotIndex: target.row });
    if (slotState.hasContent !== true) {
      await request('clip.create', { trackIndex: idx, slotIndex: target.row, lengthBeats: target.plan.beats });
      await until(() => request('slot.status', { trackIndex: idx, slotIndex: target.row }), value => value.hasContent === true);
    }
    await bindWriter(idx, target.row);
    const width = target.plan.beats * 512;
    if (target.plan.kind === 'one') {
      await shadow('fixtureEdit', { ops: [{ op: 'set', channel: 0, x: 0, y: 60, velocity: 100, durationCells: 4 }] });
    } else if (target.plan.kind === 'spec') {
      for (let from = 0; from < target.plan.count; from += 4096) {
        await shadow('fixtureWrite', { count: target.plan.count, width, from, size: Math.min(4096, target.plan.count - from),
          durationCap: target.plan.cap });
      }
    }
    let issues: string[] = [];
    await until(async () => {
      const r = await read(target);
      issues = r.reply.refused ? [`refused ${r.reply.refused}`] : declaredIssues(r.rows, target.plan);
      return { issues };
    }, () => issues.length === 0, 900_000, 1_000);
    state.written[target.key] = true; await save(statePath, state);
    console.log(JSON.stringify({ fixture: target.key, ms: Math.round(performance.now() - started) }));
  }
  await parkWriter(state);
}

/** Candidate 1: three reads at each E227 size. Equal fingerprints are a current verdict. */
async function pull(out: string, statePath: string): Promise<void> {
  await guard(); const state = await load(statePath); const rows: Wire[] = [];
  await parkWriter(state);
  for (const plan of SIZES) {
    const target: Target = { key: plan.name, trackId: state.tracks[plan.name], row: 0, plan };
    const reads: Wire[] = [];
    for (let i = 0; i < 3; i++) {
      const r = await read(target);
      assert.equal(r.reply.refused, undefined, `${plan.name}: ${r.reply.refused}`);
      assert.deepEqual(declaredIssues(r.rows, plan), []);
      reads.push(summary(r));
    }
    assert.equal(new Set(reads.map(r => r.fingerprint)).size, 1, `${plan.name}: unstable fingerprint`);
    rows.push({ plan, reads });
    console.log(JSON.stringify({ size: plan.name, wallMs: reads.map(r => Math.round(r.wallMs)), bytes: reads[0]!.bytes }));
    await artifact(out, { schema: 'phase8h3d-pull-v1', rows, calls: transport.calls.length });
  }
}

/** A MIDI velocity that differs from the current one, as a host ratio. A rerun must still change the note. */
const otherVelocity = (midi: number): number => (1 + (midi + 40) % 126) / 127;
/** Ghostnote edits through the research writer, which must be bound to the clip. */
const EDITS: Record<string, (base: number[]) => Wire[]> = {
  add: () => [{ op: 'set', channel: 5, x: 40, y: 100, velocity: 90, durationCells: 16 }],
  delete: () => [{ op: 'clear', channel: 5, x: 40, y: 100 }],
  velocity: (b) => [{ op: 'field', channel: b[0], x: b[1], y: b[2], field: 'velocity', value: otherVelocity(b[3]!) }],
  nudge: (b) => [{ op: 'move', channel: b[0], x: b[1], y: b[2], dx: 1, dy: 0 }],
};

/** Candidate 1 survey: baseline n clips, edit two through the writer, then survey them again. */
async function survey(out: string, statePath: string, n: number): Promise<void> {
  await guard(); const state = await load(statePath);
  const targets = surveyTargets(state, n);
  await parkWriter(state);
  const pass = async (label: string): Promise<Wire> => {
    const started = performance.now(), reads: Wire[] = [];
    for (const target of targets) {
      const r = await read(target); assert.equal(r.reply.refused, undefined, `${target.key}: ${r.reply.refused}`);
      reads.push({ ...summary(r), rows: r.rows });
    }
    return { label, wallMs: performance.now() - started, reads };
  };
  const baseline = await pass('baseline');
  const fp = (p: Wire): Map<string, string> => new Map(p.reads.map((r: Wire) => [r.key, r.fingerprint]));
  const current = await pass('current');
  assert.deepEqual(staleKeys(fp(baseline), fp(current)), []);
  // Edit the first and the last clip: a velocity edit and a 1/512 nudge.
  const edited = [targets[0]!, targets.at(-1)!], edits: Wire[] = [];
  for (const [i, target] of edited.entries()) {
    await bindWriter(await indexOf(target.trackId), target.row);
    const base = compact(baseline.reads.find((r: Wire) => r.key === target.key).rows)[3]!;
    const ops = i === 0 ? EDITS.velocity!(base) : EDITS.nudge!(base);
    edits.push({ key: target.key, ops, reply: await shadow('fixtureEdit', { ops }) });
  }
  await parkWriter(state); await pause(500);
  const stale = await pass('after-edit');
  const found = staleKeys(fp(baseline), fp(stale));
  assert.deepEqual(found, edited.map(t => t.key).sort());
  // Agent result proxy: one verdict per clip, with fresh rows only for a stale clip.
  const agent = stale.reads.map((r: Wire) => agentResult(r.key, r.fingerprint, !found.includes(r.key), r.rows));
  const agentBytes = { current: Buffer.byteLength(JSON.stringify(current.reads.map((r: Wire) => agentResult(r.key, r.fingerprint, true)))),
    afterEdit: Buffer.byteLength(JSON.stringify(agent)) };
  const strip = (p: Wire): Wire => ({ ...p, reads: p.reads.map(({ rows: _rows, ...r }: Wire) => r) });
  await artifact(out, { schema: 'phase8h3d-survey-v1', n, baseline: strip(baseline), current: strip(current),
    edits, afterEdit: strip(stale), stale: found, agentBytes, calls: transport.calls.length });
  console.log(JSON.stringify({ n, baselineMs: Math.round(baseline.wallMs), currentMs: Math.round(current.wallMs),
    afterEditMs: Math.round(stale.wallMs), stale: found, agentBytes }));
}

async function watchBind(index: number, target: Target): Promise<Wire> {
  const started = performance.now();
  await shadow('watchBind', { index, trackIndex: await indexOf(target.trackId), row: target.row, channelId: target.trackId });
  const status = await until(() => shadow('watchStatus', { index }),
    value => ['watching', 'refused'].includes(value.watch.phase), 10_000, 10);
  assert.equal(status.watch.phase, 'watching', `watch ${index}: ${status.watch.reason}`);
  return { ...status.watch, driverMs: performance.now() - started };
}
async function releaseAll(): Promise<Wire> {
  const all = await shadow('watchStatus');
  for (const w of all.watches as Wire[]) if (w.subscribed || w.phase === 'watching') await shadow('watchRelease', { index: w.index });
  return await shadow('watchStatus');
}
/** Wait until the watch is stale or the limit passes. Return the edit-to-stale time from the brain clock. */
async function staleAfter(index: number, sent: number, limit = 3_000): Promise<Wire> {
  const started = performance.now();
  for (;;) {
    const before = performance.now();
    const call: Call[] = [];
    const status = await shadow('watchStatus', { index }, call);
    if (status.watch.stale) {
      return { detected: true, editToStaleMs: editToStaleMs(sent, call[0]!.received, Number(status.watch.firstChangeAgoMs)),
        changes: status.watch.changesSinceMark, samples: status.watch.samples, pollMs: performance.now() - before };
    }
    if (performance.now() - started > limit) return { detected: false, changes: 0, samples: [] };
    await pause(5);
  }
}
async function heap(label: string): Promise<Wire> {
  const { stdout } = await execute('pgrep', ['-f', 'BitwigStudio --launch']);
  const pids = stdout.trim().split('\n').filter(Boolean);
  assert.equal(pids.length, 1, 'expected one Bitwig JVM process');
  const started = performance.now();
  const histogram = await execute('jcmd', [pids[0]!, 'GC.class_histogram'], { maxBuffer: 256 * 1024 * 1024 });
  const parsed = parseHistogram(histogram.stdout, 8), steps = classCounts(histogram.stdout, [NOTE_STEP_CLASS])[NOTE_STEP_CLASS]!;
  const sample = { label, liveBytes: parsed.totalBytes, noteSteps: steps.instances, noteStepBytes: steps.bytes,
    histogramMs: performance.now() - started, top: parsed.top };
  console.log(JSON.stringify({ heap: label, liveMiB: Math.round(parsed.totalBytes / 2 ** 20), noteSteps: steps.instances }));
  return sample;
}
async function pings(count = 30): Promise<number[]> {
  const samples: number[] = [];
  for (let i = 0; i < count; i++) { const s = performance.now(); await request('ping'); samples.push(performance.now() - s); }
  return samples;
}

/**
 * The edit matrix on the edit clip. Watch 0 and the values cursor observe the clip. Each case records the pull
 * verdict, the watch verdict and time, and the value observers that report the edit.
 */
async function matrix(out: string, statePath: string): Promise<void> {
  await guard(); const state = await load(statePath), target = editTarget(state), cases: Wire[] = [];
  const idx = await indexOf(target.trackId);
  await releaseAll();
  const entrySelection = await request('selection.status');
  await shadow('watchValuesBind', { trackIndex: idx, row: 0, channelId: target.trackId });
  await until(() => shadow('watchValuesStatus'), v => v.boundTrackId === target.trackId && v.boundRow === 0);
  await shadow('watchValuesPin', { pinned: true });
  const bind = await watchBind(0, target);
  const save_ = async (): Promise<void> => artifact(out, { schema: 'phase8h3d-matrix-v1', entrySelection, bind, cases,
    calls: transport.calls.length });
  const runCase = async (name: string, edit: () => Promise<Wire>, settleMs = 1_500): Promise<Wire> => {
    const before = await read(target); assert.equal(before.reply.refused, undefined);
    // A read of the watched clip must not mark the watch stale.
    const afterRead = await shadow('watchStatus', { index: 0 });
    await shadow('watchMark', { index: 0 }); await shadow('watchValuesMark');
    // Time from the edit request itself. The writer bind before it is not part of the edit.
    const sent = performance.now(), detail = await edit();
    const watch = await staleAfter(0, Number(detail.sentAt ?? sent));
    await pause(settleMs);
    const values = await shadow('watchValuesStatus');
    const after = await read(target); assert.equal(after.reply.refused, undefined);
    const row: Wire = { name, detail, staleAfterPriorRead: afterRead.watch.changesSinceMark, watch,
      watchFinal: (await shadow('watchStatus', { index: 0 })).watch.changesSinceMark,
      values: changedValues(values), valueCounts: values.values, flatBankContentEvents: values.flatBankContentEvents,
      pull: { before: summary(before), after: summary(after), detected: before.fingerprint !== after.fingerprint } };
    cases.push(row); await save_();
    console.log(JSON.stringify({ case: name, pull: row.pull.detected, watch: watch.detected,
      editToStaleMs: watch.editToStaleMs, values: row.values }));
    return row;
  };
  const writer = async (ops: Wire[]): Promise<Wire> => {
    await bindWriter(idx, 0); const sentAt = performance.now(); const reply = await shadow('fixtureEdit', { ops });
    return { ops, reply, sentAt, writeMs: performance.now() - sentAt };
  };
  // The writer binds before the edit; its bind is not an edit of the clip.
  await runCase('control-no-edit', async () => ({ ops: [] }));
  for (const name of ['add', 'delete', 'velocity', 'nudge'] as const) {
    const current = compact((await read(target)).rows)[7]!;
    await runCase(name, async () => await writer(EDITS[name]!(current)));
  }
  // An edit through the product executor: insert one note, then remove it.
  const address = clip(slot(track(target.trackId), scene(0, (await request('revision.get')).sceneEpoch)));
  const executor = new Executor(adapter);
  // A rerun finds the note of an earlier run. Clear it first; a clear of an empty cell has no effect.
  await writer([{ op: 'clear', channel: 9, x: 33 * 512, y: 101 }]); await pause(500);
  await runCase('executor-insert', async () => {
    // The executor time includes its preflight read, write, and verification read.
    const take = await executor.run([{ op: 'note.insert', clip: address, channel: 9,
      notes: [{ startBeats: 33, pitch: 101, velocity: 70, durationBeats: 0.25 }] }]);
    return { applied: take.report.applied, disagreements: take.report.disagreements };
  });
  // Clip-extent control. It must reach the clip-level value observers; restore it after.
  const loop = (await read(target)).reply.bound;
  await runCase('loop-length', async () => await writer([{ op: 'loopLength', beats: 32 }]));
  await writer([{ op: 'loopLength', beats: loop.loopEndBeats - loop.loopStartBeats }]);
  // Gate interaction: a write sent during an open read of the watched clip.
  await shadow('watchMark', { index: 0 });
  await bindWriter(idx, 0);
  const vel = compact((await read(target)).rows)[11]!;
  const reading = read(target);
  for (let i = 0; i < 50 && !(await request('rig.stats')).clipReader.writeGate.readOpen; i++) { /* wait for the read */ }
  const writeCalls: Call[] = [], sent = performance.now();
  await shadow('fixtureEdit', { ops: [{ op: 'field', channel: vel[0], x: vel[1], y: vel[2], field: 'velocity', value: otherVelocity(vel[3]!) }] }, writeCalls);
  const during = await reading;
  const watch = await staleAfter(0, sent);
  await pause(500);
  const after = await read(target);
  const gate = { queuedMs: writeCalls[0]!.reply.result?.queuedMs ?? writeCalls[0]!.reply.queuedMs,
    duringVelocity: compact(during.rows).find(r => r[1] === vel[1] && r[2] === vel[2])![3],
    afterVelocity: compact(after.rows).find(r => r[1] === vel[1] && r[2] === vel[2])![3], watch,
    staleAtReadClose: watch.detected, during: summary(during), after: summary(after),
    expectedVelocity: Math.round(otherVelocity(vel[3]!) * 127), priorVelocity: vel[3],
    detected: during.fingerprint !== after.fingerprint };
  cases.push({ name: 'gate-interaction', gate }); await save_();
  console.log(JSON.stringify({ case: 'gate-interaction', queuedMs: gate.queuedMs, during: gate.duringVelocity,
    after: gate.afterVelocity, watch: watch.detected, editToStaleMs: watch.editToStaleMs }));
  await shadow('watchRelease', { index: 0 }); await shadow('watchValuesPin', { pinned: false });
  await parkWriter(state);
}

/** Candidate 3 cost: heap, ping, and bind time with n watched clips, then one edit on the last clip. */
async function watches(out: string, statePath: string, n: number): Promise<void> {
  await guard(); const state = await load(statePath), targets = surveyTargets(state, n), result: Wire = { n };
  await releaseAll(); await parkWriter(state); await pause(1_000);
  result.heapBefore = await heap(`before-${n}`);
  result.pingBefore = await pings();
  result.binds = [];
  for (const [i, target] of targets.entries()) result.binds.push(await watchBind(i, target));
  await pause(1_000);
  result.heapWatching = await heap(`watching-${n}`);
  result.pingWatching = await pings();
  // One read of a watched clip, then one velocity edit on the last watched clip.
  const last = targets.at(-1)!;
  for (let i = 0; i < n; i++) await shadow('watchMark', { index: i });
  result.readOfWatched = summary(await read(last));
  const base = compact((await read(last)).rows)[5]!;
  await bindWriter(await indexOf(last.trackId), last.row);
  const sent = performance.now();
  result.edit = { reply: await shadow('fixtureEdit', { ops: EDITS.velocity!(base) }) };
  result.edit.watch = await staleAfter(n - 1, sent);
  await pause(500);
  const all = await shadow('watchStatus');
  result.staleIndexes = (all.watches as Wire[]).filter(w => w.stale).map(w => w.index);
  await parkWriter(state); await pause(500);
  result.release = await releaseAll(); await pause(1_000);
  result.heapReleased = await heap(`released-${n}`);
  await artifact(out, { schema: 'phase8h3d-watches-v1', ...result, calls: transport.calls.length });
  const mib = (s: Wire): number => Math.round(s.liveBytes / 2 ** 20);
  console.log(JSON.stringify({ n, heapMiB: [mib(result.heapBefore), mib(result.heapWatching), mib(result.heapReleased)],
    noteSteps: [result.heapBefore.noteSteps, result.heapWatching.noteSteps, result.heapReleased.noteSteps],
    bindMs: { median: median(result.binds.map((b: Wire) => b.driverMs)), max: Math.max(...result.binds.map((b: Wire) => b.driverMs)) },
    pingP95: [percentile(result.pingBefore, 0.95), percentile(result.pingWatching, 0.95)],
    editToStaleMs: result.edit.watch.editToStaleMs, stale: result.staleIndexes }));
}

/** The operator edits the edit clip in the Bitwig editor. Wait up to 15 minutes for the watch. */
async function user(out: string, statePath: string): Promise<void> {
  await guard(); const state = await load(statePath), target = editTarget(state), idx = await indexOf(target.trackId);
  await shadow('watchValuesBind', { trackIndex: idx, row: 0, channelId: target.trackId });
  await until(() => shadow('watchValuesStatus'), v => v.boundTrackId === target.trackId && v.boundRow === 0);
  await shadow('watchValuesPin', { pinned: true });
  const bind = await watchBind(0, target);
  const before = await read(target); assert.equal(before.reply.refused, undefined);
  await shadow('watchMark', { index: 0 }); await shadow('watchValuesMark');
  console.log(JSON.stringify({ ready: true, clip: 'gn-8h3d-edit row 0', notes: before.rows.length }));
  const sent = performance.now();
  const watch = await staleAfter(0, sent, 900_000);
  await pause(3_000);
  const values = await shadow('watchValuesStatus');
  const after = await read(target); assert.equal(after.reply.refused, undefined);
  const beforeRows = new Set(compact(before.rows).map(r => r.join())), afterRows = new Set(compact(after.rows).map(r => r.join()));
  const diff = { removed: [...beforeRows].filter(r => !afterRows.has(r)), added: [...afterRows].filter(r => !beforeRows.has(r)) };
  const row = { bind, watch, watchFinal: (await shadow('watchStatus', { index: 0 })).watch, values: changedValues(values),
    valueCounts: values.values, flatBankContentEvents: values.flatBankContentEvents, diff,
    pull: { before: summary(before), after: summary(after), detected: before.fingerprint !== after.fingerprint } };
  await shadow('watchRelease', { index: 0 }); await shadow('watchValuesPin', { pinned: false });
  await artifact(out, { schema: 'phase8h3d-user-v1', ...row, calls: transport.calls.length });
  console.log(JSON.stringify({ user: true, pull: row.pull.detected, watch: watch.detected, values: row.values, diff }));
}

async function cleanup(out: string, statePath: string): Promise<void> {
  await guard(); const state = await load(statePath);
  const released = await releaseAll();
  await shadow('watchValuesPin', { pinned: false });
  await shadow('fixturePin', { pinned: false });
  for (const id of Object.values(state.tracks) as string[]) {
    await request('track.delete', { trackIndex: await indexOf(id) }); await pause(300);
  }
  const after = await request('track.list');
  assert.deepEqual((after.tracks as Wire[]).map(row => row.channelId), (state.entryTracks as Wire[]).map(row => row.channelId));
  const stats = await request('rig.stats');
  assert.equal(stats.clipReader.open, false); assert.equal(stats.clipReader.writeGate.readOpen, false);
  assert.equal(stats.clipReader.writeGate.waiting, 0); assert.equal(stats.clipReader.writeGate.leases, 0);
  await save(out, { schema: 'phase8h3d-cleanup-v1', released, after, stats, watch: await shadow('watchStatus') });
  console.log(JSON.stringify({ cleanup: 'pass', tracks: after.tracks.length }));
}

const unzip = async (path: string): Promise<Wire> => JSON.parse(gunzipSync(await readFile(path)).toString('utf8'));

/** Check every claim of E231 from the retained artifacts. Throw on the first failure. */
export async function verifyOffline(dir: string): Promise<Wire> {
  const typicalCells = 16_321, report: Wire = {};
  const pullData = await unzip(join(dir, 'pull.json.gz'));
  assert.deepEqual(pullData.rows.map((r: Wire) => r.plan.name), SIZES.map(p => p.name));
  for (const row of pullData.rows as Wire[]) {
    assert.equal(row.reads.length, 3);
    for (const r of row.reads as Wire[]) { assert.equal(r.refused, undefined); assert.equal(r.notes, row.plan.count); }
    assert.equal(new Set(row.reads.map((r: Wire) => r.fingerprint)).size, 1, `${row.plan.name}: unstable fingerprint`);
  }
  report.pull = pullData.rows.map((r: Wire) => [r.plan.name, Math.round(median(r.reads.map((x: Wire) => x.wallMs)))]);
  for (const n of [16, 64]) {
    const sv = await unzip(join(dir, `survey-${n}.json.gz`));
    assert.equal(sv.n, n);
    for (const pass of [sv.baseline, sv.current, sv.afterEdit]) {
      assert.equal(pass.reads.length, n); for (const r of pass.reads as Wire[]) assert.equal(r.refused, undefined);
    }
    const fp = (p: Wire): Map<string, string> => new Map(p.reads.map((r: Wire) => [r.key, r.fingerprint]));
    assert.deepEqual(staleKeys(fp(sv.baseline), fp(sv.current)), []);
    assert.deepEqual(staleKeys(fp(sv.baseline), fp(sv.afterEdit)), ['single-0', `single-${n - 1}`].sort());
    report[`survey${n}`] = [sv.baseline.wallMs, sv.current.wallMs, sv.afterEdit.wallMs].map(Math.round);
  }
  const mx = await unzip(join(dir, 'matrix.json.gz')), cases = mx.cases as Wire[];
  assert.deepEqual(cases.map(c => c.name),
    ['control-no-edit', 'add', 'delete', 'velocity', 'nudge', 'executor-insert', 'loop-length', 'gate-interaction']);
  for (const [i, c] of cases.entries()) {
    if (c.name === 'gate-interaction') continue;
    const edit = !['control-no-edit', 'loop-length'].includes(c.name);
    assert.equal(c.pull.detected, c.name !== 'control-no-edit', `${c.name}: pull`);
    assert.equal(c.watch.detected, edit, `${c.name}: watch`);
    assert.deepEqual(c.values, c.name === 'loop-length' ? ['clip.loopLength'] : [], `${c.name}: values`);
    // The read before the mark adds no watch callback: the count is the final count of the prior case. Before the
    // executor case, a clear removed the note of an earlier run: 128 callbacks, one for each cell of 1/4 beat.
    const prepared = c.name === 'executor-insert' ? 128 : 0;
    assert.equal(c.staleAfterPriorRead, i === 0 ? 0 : cases[i - 1]!.watchFinal + prepared, `${c.name}: a read changed the watch`);
  }
  assert.deepEqual(cases[5]!.detail.disagreements, []); assert.equal(cases[5]!.detail.applied, true);
  const gate = cases[7]!.gate;
  assert(gate.queuedMs > 0); assert.equal(gate.duringVelocity, gate.priorVelocity);
  assert.equal(gate.afterVelocity, gate.expectedVelocity); assert.notEqual(gate.priorVelocity, gate.expectedVelocity);
  assert.equal(gate.detected, true); assert.equal(gate.watch.detected, true);
  report.matrix = cases.filter(c => c.watch?.detected).map(c => [c.name, Math.round(c.watch.editToStaleMs)]);
  const us = await unzip(join(dir, 'user.json.gz'));
  assert.equal(us.pull.detected, true); assert.equal(us.watch.detected, true); assert.deepEqual(us.values, []);
  assert.deepEqual(us.diff, { removed: ['10,11564,94,29,64'], added: ['10,11948,94,29,64'] });
  for (const n of [1, 8, 32]) {
    const w = await unzip(join(dir, `watches-${n}.json.gz`));
    assert.equal(w.binds.length, n); for (const b of w.binds as Wire[]) assert.equal(b.phase, 'watching');
    assert.equal(w.heapWatching.noteSteps - w.heapBefore.noteSteps, n * typicalCells);
    assert.equal(w.heapReleased.noteSteps, w.heapBefore.noteSteps);
    assert.deepEqual(w.staleIndexes, [n - 1]); assert.equal(w.edit.watch.detected, true);
    assert.equal(w.readOfWatched.refused, undefined);
    report[`watches${n}`] = { heapMiB: Math.round((w.heapWatching.liveBytes - w.heapBefore.liveBytes) / 2 ** 20),
      editToStaleMs: Math.round(w.edit.watch.editToStaleMs) };
  }
  const state = await load(join(dir, 'state.json')), cleanupData = await load(join(dir, 'cleanup.json'));
  assert.deepEqual(cleanupData.after.tracks.map((r: Wire) => r.channelId), state.entryTracks.map((r: Wire) => r.channelId));
  const base = await load(join(dir, 'baseline.json'));
  const prior = await load(join(dir, '../phase8h3c-promotion/baseline-final.json'));
  assert.equal(base.mark.project, ANCHOR); assert.equal(base.hello.methodsHash, 'ca139a3e62a55e68');
  assert.deepEqual(base.tracks.tracks.map((r: Wire) => r.channelId), prior.tracks.tracks.map((r: Wire) => r.channelId));
  const entry = await load(join(dir, 'config-entry.json'));
  assert.equal(entry.originalSha256, ORIGINAL_CONFIG_SHA256);
  assert.match(await readFile(join(dir, 'normal-hello-final.log'), 'utf8'), /ALL PASS/);
  return report;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [command, a, b, c] = process.argv.slice(2);
  try {
    assert(a, 'path required');
    if (command === 'config') await config(a);
    else if (command === 'restore') await restore(a);
    else if (command === 'setup') await setup(a);
    else if (command === 'fixtures') await fixtures(a);
    else if (command === 'pull') { assert(b); await pull(a, b); }
    else if (command === 'survey') { assert(b && c); await survey(a, b, Number(c)); }
    else if (command === 'matrix') { assert(b); await matrix(a, b); }
    else if (command === 'watches') { assert(b && c); await watches(a, b, Number(c)); }
    else if (command === 'user') { assert(b); await user(a, b); }
    else if (command === 'cleanup') { assert(b); await cleanup(a, b); }
    else if (command === 'verify-offline') console.log(JSON.stringify(await verifyOffline(a)));
    else throw new Error(`unknown command ${command}`);
  } finally { await transport.close(); }
}
