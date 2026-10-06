// 8h3e removed the research wire or rig configuration that this live driver uses. Live use needs the
// earlier research build of its own session. Its retained artifacts and offline checks do not need a host.
/**
 * E219 (8g3) live driver: snapshot budget equality and excess at the selected
 * 16 MiB estimate, combined working sets with eviction and recovery, interrupted
 * candidate staging, and latency under that workload. Research only; nothing
 * becomes eligible. Use one owned, unsaved project. Never use `New 1`.
 *
 * Modes:
 *   config set|restore                 install or restore the E219 rig configuration
 *   prepare <state.json>               create owned clips on track 0 of the shown project
 *   run <state.json> <out.json.gz>     run all arms; persist the report after each step
 *   cleanup <state.json>               clear owned notes and delete owned clips
 *   verify <out.json.gz>               verify a retained report
 *   baseline capture|verify <path>     capture or compare the shown project's API state (normal methods only)
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, readFile, unlink, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';
import { BridgeClient } from '../client.js';
import { parseSignature } from './e216-delivery-coherence-lib.js';
import { E219_MARKER, SNAPSHOT_LIMIT, authorityEstimate, baseEstimate, checkStatus, layoutNotes, noteEstimate, solveLayout,
  verifyReport, type Layout } from './e219-snapshot-budgets-lib.js';

type Wire = Record<string, unknown>;
type Write = { channel: number; cell: number; pitch: number; velocity: number };
const GRID = 1 / 512, ORIGINAL_PROJECT = 'New 1', REFERENCE_VELOCITY = 100;
const CONFIG_PATH = join(homedir(), '.ghostnote', 'rig.json'), CONFIG_BACKUP = '/tmp/ghostnote-e219-rig-backup.json';
const BASELINE_CONFIG_SHA256 = '256bbf07094cd654c372d0e5e050e494ef7783c9a0001a0a2a688331bcf643b0';
const E219_CONFIG = { recordChars: 0, stamp: 'e219-snapshot-budgets', deliveryResearch: true, cacheLifecycleResearch: true,
  cacheShadowObservers: 2, cacheShadowSteps: 2048 };
const A = 0, CANARY = 1, B = 2;
const bridge = new BridgeClient();
let calls = 0, responseBytes = 0;
const wait = async (ms: number): Promise<void> => await new Promise(resolve => setTimeout(resolve, ms));
async function request(method: string, params?: Wire): Promise<Wire> {
  const value = await bridge.request(method, params, 30_000) as Wire; calls++; responseBytes += Buffer.byteLength(JSON.stringify(value)); return value;
}
const shadow = async (operation: string, params: Wire = {}): Promise<Wire> => await request('cache.shadow', { operation, ...params });
const readJson = async (path: string): Promise<Wire> => JSON.parse(await readFile(path, 'utf8')) as Wire;
const shown = async (): Promise<string> => parseSignature(String((await shadow('deliveryStatus')).signature)).name;
const sha256 = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');

async function config(command: string): Promise<void> {
  if (command === 'restore') {
    const bytes = await readFile(CONFIG_BACKUP); assert.equal(sha256(bytes), BASELINE_CONFIG_SHA256, 'backup is the baseline config');
    await writeFile(CONFIG_PATH, bytes); await unlink(CONFIG_BACKUP);
    assert.equal(sha256(await readFile(CONFIG_PATH)), BASELINE_CONFIG_SHA256); console.log('restored baseline rig config'); return;
  }
  assert.equal(command, 'set');
  const current = await readFile(CONFIG_PATH); assert.equal(sha256(current), BASELINE_CONFIG_SHA256, 'entry config is the baseline');
  try { await access(CONFIG_BACKUP); throw new Error('a config backup already exists'); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  await writeFile(CONFIG_BACKUP, current, { flag: 'wx' });
  await writeFile(CONFIG_PATH, `${JSON.stringify(E219_CONFIG, null, 2)}\n`); console.log(E219_CONFIG.stamp);
}

async function ownedProject(state: Wire): Promise<void> {
  const name = await shown(); assert.notEqual(name, ORIGINAL_PROJECT, 'never use the original project'); assert.equal(name, state.project);
  const tracks = (await request('track.list')).tracks as Wire[]; assert.equal(tracks[0]!.channelId, state.trackChannelId, 'owned track 0');
}

async function prepare(path: string): Promise<void> {
  const name = await shown(); assert.notEqual(name, ORIGINAL_PROJECT, 'never prepare the original project');
  const tracks = (await request('track.list')).tracks as Wire[]; assert(tracks.length > 0 && tracks[0]!.type !== 'Master');
  const created: number[] = [];
  for (const slot of [A, CANARY, B]) {
    const status = await request('slot.status', { trackIndex: 0, slotIndex: slot });
    if (status.hasContent !== true) { await request('clip.create', { trackIndex: 0, slotIndex: slot, lengthBeats: 4 }); created.push(slot); await wait(400); }
  }
  const state: Wire = { project: name, trackChannelId: tracks[0]!.channelId, trackName: tracks[0]!.name, created, tracks,
    sceneCount: (await request('scene.count')).sceneCount, at: new Date().toISOString() };
  await pointWriter(CANARY); await request('cursor.clearNotes', { cursor: 'fine' }); await wait(200);
  await request('cursor.setNotes', { cursor: 'fine', channel: 0, notes: [0, 1, 2, 3].map(cell => [cell, 60, 90, GRID]) }); await wait(300);
  for (const slot of [A, B]) { await pointWriter(slot); await request('cursor.clearNotes', { cursor: 'fine' }); await wait(200); }
  await writeFile(path, JSON.stringify(state, null, 1) + '\n'); console.log(JSON.stringify({ project: name, created }));
}

async function pointWriter(row: number): Promise<void> {
  const cursor = 'fine'; await request('cursor.pin', { cursor, pinned: false }); await request('cursor.pinTrack', { cursor, pinned: false });
  await request('cursor.pointTrack', { cursor, trackIndex: 0 }); await request('slot.select', { trackIndex: 0, slotIndex: row, mechanism: 'track' });
  for (const started = performance.now(); ;) {
    const value = await request('cursor.status', { cursor });
    if (value.slotExists === true && value.trackPosition === 0 && value.sceneIndex === row) break;
    assert(performance.now() - started < 10_000, 'writer cursor did not reach the owned slot'); await wait(50);
  }
  await request('cursor.pinTrack', { cursor, pinned: true }); await request('cursor.pin', { cursor, pinned: true });
  await request('cursor.setStepSize', { cursor, stepSize: GRID }); await request('cursor.scrollToStep', { cursor, step: 0 }); await wait(150);
}

/** Write notes by channel. Drain resident hints after each channel batch. */
async function writeNotes(row: number, notes: readonly Write[], drainIndex: number | null): Promise<Wire[]> {
  await pointWriter(row); const drained: Wire[] = [];
  for (let channel = 0; channel < 16; channel++) {
    const batch = notes.filter(note => note.channel === channel); if (!batch.length) continue;
    for (let start = 0; start < batch.length; start += 256) {
      const part = batch.slice(start, start + 256).map(note => [note.cell, note.pitch, note.velocity, GRID]);
      const written = await request('cursor.setNotes', { cursor: 'fine', channel, notes: part }); assert.equal(written.written, part.length);
      await wait(150); if (drainIndex !== null) drained.push(await drain(drainIndex));
    }
  }
  return drained;
}

async function drain(index: number): Promise<Wire> {
  for (const started = performance.now(); ;) {
    const value = await shadow('reconcile', { index });
    if (value.physicalPendingHints === 0 && value.pendingCoordinates === 0) return slim(value);
    assert(performance.now() - started < 30_000, `drain did not finish: ${String(value.reason)}`); await wait(50);
  }
}

async function bind(index: number, row: number): Promise<Wire> {
  let value = await shadow('point', { index, trackIndex: 0, row, canaryTrackIndex: 0, canaryRow: CANARY });
  for (const started = performance.now(); ;) {
    if ((value.phase === 'settled' || value.phase === 'complete') && value.canaryPhase === 'target') break;
    assert(value.phase !== 'retired' && value.index !== undefined, `binding refused: ${String(value.reason)}`);
    assert(performance.now() - started < 20_000, 'binding did not settle'); await wait(50); value = await shadow('poll', { index });
  }
  return slim(await drain(index));
}

const latency: number[] = [];
async function pingOnce(): Promise<number> { const started = performance.now(); await request('ping'); const ms = performance.now() - started; latency.push(ms); return ms; }
async function pingBurst(): Promise<number> {
  const samples: number[] = []; for (let n = 0; n < 25; n++) samples.push(await pingOnce());
  samples.sort((x, y) => x - y); return samples[23]!;
}

/** Keep the fields that verification reads. Drop large diagnostic copies that the report does not use. */
function slim(value: Wire): Wire {
  const drop = ['handlePool', 'authorityBinding', 'inventoryRebuild', 'lastRetiredInventoryRebuild'];
  return Object.fromEntries(Object.entries(value).filter(([key]) => !drop.includes(key)));
}

interface Step { label: string; expected: string; boundary?: string; projection?: Write[]; index: number; result?: Wire; metrics?: Wire; samples?: number[] }
async function compare(step: Step, interrupt = false): Promise<Step> {
  const p95 = await pingBurst(); await shadow('ping', { p95Ms: p95 });
  const before = await shadow('info'), started = performance.now(), firstCall = calls, firstBytes = responseBytes, samples: number[] = [];
  let value = await shadow('compareStart', interrupt ? { index: step.index, maxEnrichmentCoordinates: 64 } : { index: step.index }), polls = 0, interrupted: Wire | undefined;
  while (value.comparison === 'pending' && value.terminal !== true) {
    if (interrupt && value.scanStage === 'enrichment' && (value.snapshotCandidate as Wire | undefined)?.phase === 'enriching') {
      const partial = slim(value); await shadow('retire', { index: step.index }); interrupted = { partial, after: slim(await shadow('info')), poll: slim(await shadow('comparePoll')) };
      break;
    }
    samples.push(await pingOnce());
    assert(performance.now() - started < 60_000, 'comparison did not terminate'); await wait(20); value = await shadow('comparePoll'); polls++;
  }
  const after = await shadow('info');
  const delta = (name: string): number => Number(after[name]) - Number(before[name]);
  step.result = slim(interrupted ? interrupted.after as Wire : value); step.samples = samples;
  step.metrics = { wallMs: performance.now() - started, bridgeRequests: calls - firstCall, responseBytes: responseBytes - firstBytes,
    publicToolCalls: 0, agentDelay: 'unmeasured: no agent in this driver', pingBurstP95Ms: p95, polls,
    phaseTimesMs: value.scanPhaseTimesMs ?? after.lastScanPhaseTimesMs, candidate: after.lastSnapshotCandidate,
    membershipGetStepCalls: delta('membershipGetStepCalls'), authorityGetStepCalls: delta('authorityGetStepCalls'),
    enrichmentGetStepCalls: delta('enrichmentGetStepCalls'), authorityHostWorkMs: delta('authorityHostWorkMs'),
    enrichmentHostWorkMs: delta('enrichmentHostWorkMs'), enrichmentBatches: delta('enrichmentBatches'),
    stepWindowChanges: delta('stepWindowChanges'), retainedStepWindowDiscards: delta('retainedStepWindowDiscards'),
    resourceAccounting: after.resourceAccounting, units: 'ms are wall or host-work milliseconds as named; bytes are response bytes' };
  if (interrupted) (step.metrics as Wire).interrupted = interrupted;
  return step;
}

async function run(statePath: string, out: string): Promise<void> {
  const state = await readJson(statePath); await ownedProject(state);
  const methods = await request('rig.methods'), entry = await shadow('info'); checkStatus(entry);
  assert.equal(entry.residentHandles, 2); assert.equal(entry.steps, 2048);
  const report: Wire = { marker: E219_MARKER, researchOnly: true, complete: false, eligible: false, started: new Date().toISOString(),
    config: E219_CONFIG, project: state.project, methods, entry: slim(entry), arms: [] };
  const save = async (): Promise<void> => { report.calls = calls; report.responseBytes = responseBytes;
    report.latency = latencySummary(); await writeFile(out, gzipSync(JSON.stringify(report))); };
  const arms = report.arms as Wire[], arm = (name: string): Step[] => { const steps: Step[] = []; arms.push({ name, steps }); return steps; };
  let failed: unknown;
  try {
    // Calibration: one note per velocity on channel 0. Costs come from the independent oracle.
    // Each run starts from empty owned clips. The canary keeps its prepared notes.
    for (const slot of [A, B]) { await pointWriter(slot); await request('cursor.clearNotes', { cursor: 'fine' }); await wait(300); }
    const calibrationNotes: Write[] = Array.from({ length: 127 }, (_, i) => ({ channel: 0, cell: 0, pitch: i, velocity: i + 1 }));
    await writeNotes(A, calibrationNotes, null); await bind(0, A);
    const calibration = await compare({ label: 'calibration', expected: 'match', index: 0 }); const result = calibration.result!;
    assert.equal(result.comparison, 'match', `calibration: ${String(result.comparison)}`);
    const notes = result.authorityNotes as { pitch: number; fields: Wire }[]; assert.equal(notes.length, 127, 'calibration holds one note per velocity');
    assert.equal(authorityEstimate(result), (result.diagnosticSnapshot as Wire).payloadEstimatedBytes, 'oracle equals the Java estimate');
    const costs = new Map(notes.map(note => [note.pitch + 1, noteEstimate(note.fields)] as [number, number]));
    const values = new Map(notes.map(note => [note.pitch + 1, note.fields.velocity as number] as [number, number]));
    const base = baseEstimate(result.authorityMetadata as Wire);
    report.calibration = { result, costs: [...costs], velocityValues: [...values], reference: REFERENCE_VELOCITY, base }; await save();
    const layout: Layout & { base: number } = { ...solveLayout(base, costs, SNAPSHOT_LIMIT, REFERENCE_VELOCITY, 2048 * 16, 1), base };
    report.layout = layout; await save();
    const equal = layoutNotes(layout), grown = equal.map((note, i) => (i === 0 ? { ...note, velocity: layout.a } : note));

    const boundary = arm('boundary');
    await shadow('retire', { index: 0 }); await pointWriter(A); await request('cursor.clearNotes', { cursor: 'fine' }); await wait(300);
    await writeNotes(A, equal, null); await bind(0, A);
    boundary.push(await compare({ label: 'equality', expected: 'match', boundary: 'equality', projection: equal, index: 0 })); await save();
    assert.equal(boundary[0]!.result!.comparison, 'match', 'equality must publish');
    await writeNotes(A, [grown[0]!], 0);
    boundary.push(await compare({ label: 'excess', expected: 'snapshot-memory-budget', boundary: 'excess', projection: grown, index: 0 })); await save();
    assert.equal(boundary[1]!.result!.comparison, 'snapshot-memory-budget', 'excess must refuse at the snapshot boundary');
    await shadow('retire', { index: 0 }); await writeNotes(A, [equal[0]!], null); await bind(0, A);
    boundary.push(await compare({ label: 'equality-restored', expected: 'match', boundary: 'equality', projection: equal, index: 0 })); await save();

    // Combined working set: two residents share the snapshot domain.
    const combined = arm('combined'); const small: Write[] = Array.from({ length: 64 }, (_, i) => ({ channel: i % 16, cell: 1, pitch: 40 + Math.floor(i / 16), velocity: 80 }));
    await writeNotes(B, small, null); await bind(1, B);
    combined.push(await compare({ label: 'second-over-retained', expected: 'snapshot-memory-budget', projection: small, index: 1 })); await save();
    await shadow('retire', { index: 0 });
    combined.push(await compare({ label: 'second-after-eviction', expected: 'match', projection: small, index: 1 })); await save();
    await bind(0, A);
    combined.push(await compare({ label: 'first-over-retained', expected: 'snapshot-memory-budget', projection: equal, index: 0 })); await save();
    await shadow('retire', { index: 1 });
    combined.push(await compare({ label: 'first-after-eviction', expected: 'match', boundary: 'equality', projection: equal, index: 0 })); await save();

    // Interrupted staging: retire during enrichment, then recover with a new attempt.
    const interrupted = arm('interrupted');
    const cut = await compare({ label: 'retire-during-enrichment', expected: 'window-changed', index: 0 }, true);
    interrupted.push(cut); await save();
    assert((cut.metrics as Wire).interrupted, 'the enrichment stage was reached and interrupted');
    await bind(0, A);
    interrupted.push(await compare({ label: 'explicit-recovery', expected: 'match', boundary: 'equality', projection: equal, index: 0 })); await save();
  } catch (error) { failed = error; report.error = String(error); }
  finally {
    await shadow('retire', { index: 0 }).catch(() => undefined); await shadow('retire', { index: 1 }).catch(() => undefined);
    report.final = slim(await shadow('info')); report.ended = new Date().toISOString(); await save();
  }
  if (failed) throw failed;
  console.log(JSON.stringify(verifyReport(report)));
}

function latencySummary(): Wire {
  const sorted = [...latency].sort((x, y) => x - y), at = (q: number): number | null => sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)]! : null;
  return { samples: latency.map(value => Math.round(value * 1000) / 1000), underLoadP95Ms: at(0.95), medianMs: at(0.5), maxMs: sorted.at(-1) ?? null,
    scope: 'bridge ping round trips during and between comparisons in this run' };
}

async function cleanup(statePath: string): Promise<void> {
  const state = await readJson(statePath); await ownedProject(state);
  await shadow('retire', { index: 0 }); await shadow('retire', { index: 1 });
  for (const slot of [A, CANARY, B]) { await pointWriter(slot); await request('cursor.clearNotes', { cursor: 'fine' }); await wait(200); }
  for (const slot of (state.created as number[])) { await request('slot.delete', { trackIndex: 0, slotIndex: slot }); await wait(300); }
  const slots = []; for (const slot of [A, CANARY, B]) slots.push(await request('slot.status', { trackIndex: 0, slotIndex: slot }));
  for (const [i, slot] of [A, CANARY, B].entries()) if ((state.created as number[]).includes(slot)) assert.equal(slots[i]!.hasContent, false);
  console.log(JSON.stringify({ cleaned: state.project, slots: slots.map(slot => slot.hasContent) }));
}

/** API state of the shown project. Run with the original project shown. */
async function apiState(): Promise<Wire> {
  const tracks = await request('track.list'), scenes = await request('scene.count'), scan = await request('rig.scanTracks');
  const slots: Wire[] = [];
  for (const track of tracks.tracks as Wire[]) for (let row = 0; row < Number(scenes.sceneCount); row++) {
    const status = await request('slot.status', { trackIndex: track.index, slotIndex: row });
    slots.push({ id: track.channelId, row, exists: status.exists, hasContent: status.hasContent });
  }
  const cursors: Wire = {};
  for (const cursor of ['0', 'fine']) {
    const value = await request('cursor.status', { cursor });
    cursors[cursor] = Object.fromEntries(['trackExists', 'slotExists', 'trackPosition', 'sceneIndex', 'isPinned', 'cursorTrackPinned'].map(field => [field, value[field]]));
  }
  const methods = await request('rig.methods'), selection = await request('selection.status');
  return { selection: Object.fromEntries(['trackIndex', 'slotIndex', 'mixerTrackIndex'].map(field => [field, selection[field]])), tracks: tracks.tracks, trackCount: tracks.count, sceneCount: scenes.sceneCount,
    scan: Object.fromEntries(['existing', 'withChannelId', 'slotsWithContent', 'sceneCount', 'itemCount', 'bankSize'].map(field => [field, scan[field]])),
    slots, cursors, methodCount: methods.count, methodHash: methods.hash, captured: new Date().toISOString() };
}
async function baseline(mode: string, path: string): Promise<void> {
  const current = await apiState();
  if (mode === 'capture') { await writeFile(path, JSON.stringify(current, null, 1) + '\n', { flag: 'wx' }); console.log(JSON.stringify({ captured: path })); return; }
  assert.equal(mode, 'verify'); const entry = await readJson(path);
  for (const field of ['selection', 'tracks', 'trackCount', 'sceneCount', 'scan', 'slots', 'cursors', 'methodCount', 'methodHash'])
    assert.deepEqual(current[field], entry[field], `baseline ${field} differs`);
  console.log(JSON.stringify({ baselineRestored: true, tracks: (current.tracks as Wire[]).length, slots: (current.slots as Wire[]).length }));
}

export async function readReport(path: string): Promise<Wire> { return JSON.parse(gunzipSync(await readFile(path)).toString('utf8')) as Wire; }

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [mode, ...args] = process.argv.slice(2);
  const main = mode === 'config' ? config(args[0]!) : mode === 'prepare' ? prepare(args[0]!) : mode === 'run' ? run(args[0]!, args[1]!)
    : mode === 'cleanup' ? cleanup(args[0]!) : mode === 'baseline' ? baseline(args[0]!, args[1]!) : mode === 'verify' ? readReport(args[0]!).then(report => console.log(JSON.stringify(verifyReport(report))))
    : Promise.reject(new Error('usage: config|prepare|run|cleanup|verify'));
  void main.catch(error => { console.error(error); process.exitCode = 1; }).finally(() => bridge.disconnect());
}
