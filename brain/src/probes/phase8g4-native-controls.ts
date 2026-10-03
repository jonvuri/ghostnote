/** Run native topology and acquisition controls on owned, unsaved projects. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';
import { BridgeClient } from '../client.js';
import { parseSignature } from './e216-delivery-coherence-lib.js';
import { atBoundary, BOUNDARIES, closed, independentNotes, NATIVE_MARKER, orderingSummary, verifyComparison, verifyOrdering,
  verifyTopology, type Boundary, type Wire } from './phase8g4-native-lib.js';
import { verifyNativeTopologyReport } from './phase8g4-native-topology.js';
const bridge = new BridgeClient(), ORIGINAL = 'New 1', GRID = 1 / 512;
const CONFIG = join(homedir(), '.ghostnote', 'rig.json'), BACKUP = '/tmp/ghostnote-8g4-rig-backup.json';
const CONFIG_HASH = '256bbf07094cd654c372d0e5e050e494ef7783c9a0001a0a2a688331bcf643b0';
const wait = async (ms = 50): Promise<void> => await new Promise(resolve => setTimeout(resolve, ms));
const hash = (b: Buffer): string => createHash('sha256').update(b).digest('hex');
async function read(path: string): Promise<Wire> { const b = await readFile(path); return JSON.parse((path.endsWith('.gz') ? gunzipSync(b) : b).toString()) as Wire; }
async function save(path: string, value: Wire, exclusive = false): Promise<void> {
  const b = Buffer.from(JSON.stringify(value, null, 1) + '\n');
  await writeFile(path, path.endsWith('.gz') ? gzipSync(b) : b, exclusive ? { flag: 'wx' } : undefined);
}
const request = async (method: string, params?: Wire): Promise<Wire> => await bridge.request(method, params, 30_000) as Wire;
const shadow = async (operation: string, params: Wire = {}): Promise<Wire> => await request('cache.shadow', { operation, ...params });
const shown = async (): Promise<string> => parseSignature(String((await shadow('deliveryStatus')).signature)).name;
async function config(mode: string): Promise<void> {
  if (mode === 'restore') { const b = await readFile(BACKUP); assert.equal(hash(b), CONFIG_HASH); await writeFile(CONFIG, b); await unlink(BACKUP); return; }
  assert.equal(mode, 'set'); const b = await readFile(CONFIG); assert.equal(hash(b), CONFIG_HASH); await writeFile(BACKUP, b, { flag: 'wx' });
  await writeFile(CONFIG, JSON.stringify({ recordChars: 0, stamp: '8g4-native-topology', cacheLifecycleResearch: true,
    deliveryResearch: true, cacheShadowObservers: 2, cacheShadowSteps: 2048, fineSteps: 2048, contentFilter: 'ALL_CHANNELS' }, null, 2) + '\n');
}
async function poll(readNext: () => Promise<Wire>, done: (v: Wire) => boolean, limit = 20_000): Promise<Wire> {
  const start = performance.now(); for (;;) { const v = await readNext(); if (done(v)) return v;
    assert(performance.now() - start < limit, `poll expired: ${String(v.reason ?? v.phase)}`); await wait(); }
}
async function guard(state: Wire): Promise<void> {
  assert.notEqual(state.project, ORIGINAL); assert.equal(await shown(), state.project);
  const tracks = await request('track.list'); assert.deepEqual(tracks, state.tracks); assert.equal((await request('scene.count')).sceneCount, 8);
}
async function writer(state: Wire, row: number): Promise<void> {
  assert.equal(await shown(), state.project); assert.notEqual(state.project, ORIGINAL);
  const tracks = (await request('track.list')).tracks as Wire[]; const found = tracks.find(t => t.channelId === state.trackId); assert(found);
  const cursor = 'fine'; await request('cursor.pin', { cursor, pinned: false }); await request('cursor.pinTrack', { cursor, pinned: false });
  await request('cursor.pointTrack', { cursor, trackIndex: found.index }); await request('slot.select', { trackIndex: found.index, slotIndex: row, mechanism: 'track' });
  await poll(() => request('cursor.status', { cursor }), v => v.slotExists === true && v.trackPosition === found.position && v.sceneIndex === row);
  await request('cursor.pinTrack', { cursor, pinned: true }); await request('cursor.pin', { cursor, pinned: true });
  await request('cursor.setStepSize', { cursor, stepSize: GRID }); await request('cursor.scrollToStep', { cursor, step: 0 }); await wait(150);
}
async function prepare(path: string, pitchText: string): Promise<void> {
  const project = await shown(); assert.notEqual(project, ORIGINAL); const pitch = Number(pitchText); assert([60, 72].includes(pitch));
  const tracks = await request('track.list'); assert.equal(tracks.itemCount, 4); assert.equal((await request('scene.count')).sceneCount, 8);
  const state: Wire = { project, trackId: (tracks.tracks as Wire[])[0]!.channelId, tracks, pitch, clipName: `gn-8g4-${pitch}`, ownedRows: [0, 1] };
  await save(path, { ...state, stage: 'preparing' }, true);
  for (const row of [0, 1]) {
    assert.equal((await request('slot.status', { trackIndex: 0, slotIndex: row })).hasContent, false, 'owned seed must start empty');
    await request('clip.create', { trackIndex: 0, slotIndex: row, lengthBeats: 4 }); await wait(200); await writer(state, row);
    await request('cursor.setClipMetadata', { cursor: 'fine', name: row === 0 ? state.clipName : `gn-8g4-canary-${pitch}` });
    for (let channel = 0; channel < 16; channel++) {
      await request('cursor.setNotes', { cursor: 'fine', channel, notes: Array.from({ length: 4 }, (_, cell) => [cell * 8, pitch + cell, 80 + channel, 8 * GRID]) });
    }
    await wait(250);
  }
  await writer(state, 0); state.notes = await request('cursor.getNotesVerboseAllChannels', { cursor: 'fine', maxX: 2048 });
  state.metadata = await request('cursor.clipMetadata', { cursor: 'fine' });
  const notes = independentNotes(state.notes as Wire); assert.equal(notes.length, 64);
  for (const n of notes) { assert(n.pitch >= pitch && n.pitch <= pitch + 3); assert(Math.abs(Number(n.fields.velocity) - (80 + n.channel) / 127) < 1e-6); }
  state.topology = await shadow('trackTopology'); verifyTopology(state.topology as Wire, { roots: (tracks.tracks as Wire[]).map(t => String(t.channelId)), children: {} });
  state.stage = 'prepared'; await save(path, state); console.log(JSON.stringify({ prepared: path, project, pitch }));
}
async function bind(state: Wire): Promise<void> {
  await guard(state); const start = await shadow('point', { index: 0, trackIndex: 0, row: 0, canaryTrackIndex: 0, canaryRow: 1 });
  assert.equal(start.index, 0, `binding refused: ${JSON.stringify(start)}`);
  const settled = await poll(() => shadow('poll', { index: 0 }), v => v.phase === 'retired' || (['settled', 'complete'].includes(String(v.phase)) && v.canaryPhase === 'target'));
  assert.notEqual(settled.phase, 'retired'); assert.equal(settled.canaryVerifiedForBinding, true);
  await poll(() => shadow('reconcile', { index: 0 }), v => v.physicalPendingHints === 0 && v.pendingCoordinates === 0);
}
async function comparison(state: Wire, persist?: (value: Wire) => Promise<void>): Promise<Wire> {
  await bind(state); let v = await shadow('compareStart', { index: 0 });
  v = await poll(async () => v.comparison === 'pending' ? (v = await shadow('comparePoll')) : v, v => v.comparison !== 'pending');
  if (persist) await persist(v);
  verifyComparison(v, state); return v;
}
async function order(path: string, sourcePath: string, targetPath: string, boundaryText: string): Promise<void> {
  assert(BOUNDARIES.includes(boundaryText as Boundary)); const boundary = boundaryText as Boundary;
  const source = await read(sourcePath), target = await read(targetPath); await guard(source);
  assert.notEqual(source.project, target.project); const info = await shadow('info'); assert.equal(info.instrumentationRevision, NATIVE_MARKER);
  const report: Wire = { schema: 'phase8g4-native-ordering-v1', marker: NATIVE_MARKER, started: new Date().toISOString(), stage: 'preparing',
    researchOnly: true, complete: false, eligible: false, source, target, boundary, samples: [] };
  await save(path, report, true);
  try {
    report.baseline = await comparison(source, async v => { report.baseline = v; await save(path, report); });
    await shadow('rootClearTrace'); report.beforeTrace = await shadow('rootTrace');
    let active = await shadow('compareStart', { index: 0, maxEnrichmentCoordinates: boundary === 'enrichment' ? 1 : 64 });
    active = await poll(async () => atBoundary(active, boundary) ? active : (active = await shadow('comparePoll')),
      v => atBoundary(v, boundary) || v.comparison !== 'pending');
    assert(atBoundary(active, boundary), `boundary not reached: ${JSON.stringify(active)}`);
    report.active = active; report.readyAt = new Date().toISOString(); report.stage = 'sampling'; await save(path, report);
    console.log(`READY ${boundary}: ${source.project} -> ${target.project}`);
    for (const started = performance.now(); performance.now() - started < 35_000 && (report.samples as Wire[]).length < 400;) {
      const sample: Wire = { started: new Date().toISOString() }; (report.samples as Wire[]).push(sample);
      try { sample.acquisition = await shadow('compareStatus'); sample.tracks = await request('track.list'); sample.root = await shadow('rootSnapshot'); }
      catch (error) { sample.error = String(error); }
      sample.ended = new Date().toISOString(); await save(path, report); await wait(25);
    }
    report.afterTrace = await shadow('rootTrace'); report.stage = 'sampled';
  } catch (error) { report.error = String(error); report.stage = 'prepare-or-sample-error'; throw error; }
  finally { report.sampleEnded = new Date().toISOString(); await save(path, report); }
}
async function finish(path: string, commandPath: string): Promise<void> {
  const report = await read(path); assert.equal(report.stage, 'sampled'); report.command = await read(commandPath);
  try {
    const source = report.source as Wire; await guard(source);
    report.recovery = await comparison(source, async v => { report.recovery = v; await save(path, report); });
    await writer(source, 0); report.recoveryNotes = await request('cursor.getNotesVerboseAllChannels', { cursor: 'fine', maxX: 2048 });
    report.finalTracks = await request('track.list'); report.finalScenes = (await request('scene.count')).sceneCount;
    report.fixtureRestored = true; await shadow('retire', { index: 0 }); await shadow('retire', { index: 1 });
  } catch (error) { report.recoveryError = String(error); report.fixtureRestored = false; }
  report.stage = 'finished'; report.ended = new Date().toISOString(); report.summary = orderingSummary(report); await save(path, report);
  console.log(JSON.stringify(verifyOrdering(report, (report.summary as Wire).accepted === true)));
}
async function topology(path: string, label: string, statePath?: string): Promise<void> {
  assert.notEqual(await shown(), ORIGINAL); const report = await read(path);
  const capture: Wire = { label, captured: new Date().toISOString(), project: await shown(), tracks: await request('track.list'),
    topology: await shadow('trackTopology'), scenes: await shadow('sceneSnapshot'), info: await shadow('info'), status: await shadow('status', { index: 0 }) };
  (report.captures as Wire[]).push(capture); await save(path, report);
  try {
    if (statePath) {
      const state = await read(statePath); assert.equal(state.project, capture.project);
      if ((capture.topology as Wire).membershipComplete === true) await writer(state, 0);
      capture.readerStatus = await request('cursor.status', { cursor: 'fine' });
      const reader = capture.readerStatus as Wire;
      assert.equal(reader.trackName, ((state.tracks as Wire).tracks as Wire[])[0]!.name);
      assert.equal(reader.slotName, state.clipName); assert.equal(reader.sceneIndex, 0); assert.equal(reader.slotExists, true);
      capture.notes = await request('cursor.getNotesVerboseAllChannels', { cursor: 'fine', maxX: 2048 });
      capture.metadata = await request('cursor.clipMetadata', { cursor: 'fine' });
    }
  } catch (error) { capture.readerError = String(error); throw error; }
  finally { await save(path, report); }
  console.log(JSON.stringify({ label, membershipComplete: (capture.topology as Wire).membershipComplete, reason: (capture.topology as Wire).reason }));
}
async function cleanup(path: string): Promise<void> {
  const state = await read(path); await guard(state);
  verifyTopology(await shadow('trackTopology'), { roots: ((state.tracks as Wire).tracks as Wire[]).map(t => String(t.channelId)), children: {} });
  await shadow('retire', { index: 0 }); await shadow('retire', { index: 1 });
  for (const row of state.ownedRows as number[]) { await writer(state, row); await request('cursor.clearNotes', { cursor: 'fine' }); await wait(200);
    await request('slot.delete', { trackIndex: 0, slotIndex: row }); await wait(200); }
  for (const cursor of ['fine', '0']) { await request('cursor.pin', { cursor, pinned: false }); await request('cursor.pinTrack', { cursor, pinned: false }); }
  const scan = await request('rig.scanTracks'); assert.equal(scan.slotsWithContent, 0); await guard(state);
  const slots = []; for (const track of ((state.tracks as Wire).tracks as Wire[])) for (let row = 0; row < 8; row++)
    slots.push({ trackId: track.channelId, row, ...await request('slot.status', { trackIndex: track.index, slotIndex: row }) });
  const cursors: Wire = {}; for (const cursor of ['fine', '0']) cursors[cursor] = await request('cursor.status', { cursor });
  state.cleanup = { scan, slots, cursors, tracks: await request('track.list'), topology: await shadow('trackTopology'), at: new Date().toISOString() }; await save(path, state);
}
async function topologyStart(path: string, statePath: string): Promise<void> {
  const source = await read(statePath); await guard(source);
  const report: Wire = { schema: 'phase8g4-native-topology-v1', marker: NATIVE_MARKER, researchOnly: true, complete: false, eligible: false,
    stage: 'preparing', source, captures: [], commands: [], wrapperDeleted: false };
  await save(path, report, true);
  try { report.baseline = await comparison(source, async v => { report.baseline = v; await save(path, report); });
    report.stage = 'active'; await save(path, report); await topology(path, 'plain', statePath); }
  catch (error) { report.error = String(error); await save(path, report); throw error; }
}
async function topologyFinish(path: string): Promise<void> {
  const report = await read(path), source = report.source as Wire; await guard(source);
  report.recovery = await comparison(source, async v => { report.recovery = v; await save(path, report); });
  report.finalTracks = await request('track.list'); report.finalScenes = (await request('scene.count')).sceneCount;
  report.fixtureRestored = true; report.stage = 'finished'; report.ended = new Date().toISOString();
  await save(path, report); report.summary = verifyNativeTopologyReport(report); await save(path, report);
  await shadow('retire', { index: 0 }); await shadow('retire', { index: 1 }); console.log(JSON.stringify(report.summary));
}
async function main(): Promise<void> {
  const [mode, path, a, b, c] = process.argv.slice(2); assert(path);
  if (mode === 'config') await config(path);
  else if (mode === 'prepare') { assert(a); await prepare(path, a); }
  else if (mode === 'order') { assert(a && b && c); await order(path, a, b, c); }
  else if (mode === 'finish-order') { assert(a); await finish(path, a); }
  else if (mode === 'topology') { assert(a); await topology(path, a, b); }
  else if (mode === 'topology-start') { assert(a); await topologyStart(path, a); }
  else if (mode === 'topology-finish') await topologyFinish(path);
  else if (mode === 'cleanup') await cleanup(path);
  else { assert.equal(mode, 'verify-order'); const report = await read(path); console.log(JSON.stringify(verifyOrdering(report, (report.summary as Wire).accepted === true))); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  void main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => bridge.disconnect());
