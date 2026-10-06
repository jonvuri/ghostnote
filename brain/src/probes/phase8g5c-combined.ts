// 8h3e removed the research wire or rig configuration that this live driver uses. Live use needs the
// earlier research build of its own session. Its retained artifacts and offline checks do not need a host.
/** Capture the selected combined ledger. Controller replacement stays with the operator. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';
import { BridgeClient } from '../client.js';
import { parseSignature } from './e216-delivery-coherence-lib.js';
import { independentNotes, verifyComparison } from './phase8g4-native-lib.js';
import { checkMutationNotes } from './phase8g-shadow-mutations.js';
import type { ShadowNote } from './phase8g-shadow-cache-lib.js';
import { baseEstimate, layoutNotes, noteEstimate, snapshotEstimate } from './e219-snapshot-budgets-lib.js';
import { fullTracks, verifyFlatScale } from './phase8g5c-scale-lib.js';
import { publishedOccupancy } from './phase8g5b-slot-lib.js';
import { OWNED_PROJECT, sweepConfig, type Wire } from './phase8g5c-storage-lib.js';
import { AUTHORITY_NOTE_BYTES, COMBINED_LIMIT, COMBINED_MARKER, COMBINED_C3_MARKER, solveCombinedLayout,
  verifyCombinedBaseline, verifyCombinedDeployment, verifyCombinedLedger, verifyCombinedBudget, verifyCombinedBudgetDiagnostic, verifyBudgetContinuation, type Payload } from './phase8g5c-combined-lib.js';
const bridge = new BridgeClient();
const archivePath = join(homedir(), 'Documents', 'Bitwig Studio', 'Extensions', 'ghostnote-shadow-8g-controls.bwextension');
const configPath = join(homedir(), '.ghostnote', 'rig.json');
const request = async (method: string, params?: Wire): Promise<Wire> => await bridge.request(method, params, 30_000) as Wire;
const shadow = async (operation: string, params: Wire = {}): Promise<Wire> => request('cache.shadow', { operation, ...params });
const wait = async (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));
const hash = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');
const read = async (path: string): Promise<Wire> => {
  const bytes = await readFile(path);
  return JSON.parse((path.endsWith('.gz') ? gunzipSync(bytes, { maxOutputLength: 64 * 1024 * 1024 }) : bytes).toString('utf8')) as Wire;
};
const save = async (path: string, value: Wire): Promise<void> => writeFile(path, JSON.stringify(value, null, 1) + '\n', { flag: 'wx' });
async function until(next: () => Promise<Wire>, done: (value: Wire) => boolean): Promise<Wire> {
  const deadline = Date.now() + 40_000;
  for (;;) { const value = await next(); if (done(value)) return value; assert(Date.now() < deadline, 'live read did not settle'); await wait(30); }
}
async function owned(initialization?: number): Promise<void> {
  assert.equal(parseSignature(String((await shadow('deliveryStatus')).signature)).name, OWNED_PROJECT);
  if (initialization !== undefined) {
    assert.equal((await request('rig.stats')).initEpochMs, initialization);
    assert.equal((await shadow('info')).instrumentationRevision, COMBINED_MARKER);
  }
}
/** Pin the deployed archive and the unchanged independent fixture before replacement. */
async function deployment(path: string, priorPath: string): Promise<void> {
  const prior = await read(priorPath); await owned();
  const stats = await request('rig.stats'); assert.equal(stats.initEpochMs, (prior.stats as Wire).initEpochMs);
  assert.equal((await shadow('info')).instrumentationRevision, COMBINED_C3_MARKER);
  const config = await readFile(configPath);
  assert.deepEqual(JSON.parse(config.toString('utf8')), sweepConfig(512, true));
  const report: Wire = { schema: 'phase8g5c-combined-deployment-v1', captured: new Date().toISOString(),
    project: OWNED_PROJECT, priorPath, stats, marker: COMBINED_MARKER, complete: false, eligible: false,
    combinedStorageAccepted: false, archiveSha256: hash(await readFile(archivePath)),
    archiveMtimeMs: (await stat(archivePath)).mtimeMs, configSha256: hash(config), config: sweepConfig(512, true),
    census: await request('track.list'), topology: await shadow('trackTopology'), scan: await request('rig.scanTracks'),
    inventory: await shadow('inventoryList'), censusAfter: await request('track.list') };
  verifyCombinedDeployment(report, prior); await save(path, report);
  console.log(JSON.stringify({ deployment: path, marker: COMBINED_MARKER, archiveSha256: report.archiveSha256, controllerReplacementPending: true }));
}
async function compare(state: Wire, index: number, census: Wire, initialization: number): Promise<Wire> {
  await owned(initialization); assert.deepEqual(await request('track.list'), census);
  const track = fullTracks(census).find(row => row.channelId === state.trackId); assert(track);
  await shadow('point', { index, trackIndex: track.index, row: 0, canaryTrackIndex: track.index, canaryRow: 1 });
  const settled = await until(() => shadow('poll', { index }), value => value.phase === 'retired'
    || (['settled', 'complete'].includes(String(value.phase)) && value.canaryPhase === 'target'));
  assert.notEqual(settled.phase, 'retired'); assert.equal(settled.canaryVerifiedForBinding, true);
  const value = await compareCurrent(index);
  return value;
}
async function compareCurrent(index: number): Promise<Wire> {
  await until(() => shadow('reconcile', { index }), value => value.physicalPendingHints === 0 && value.pendingCoordinates === 0);
  const ping: number[] = [];
  for (let n = 0; n < 25; n++) { const start = performance.now(); await request('ping'); ping.push(performance.now() - start); }
  await shadow('ping', { p95Ms: [...ping].sort((a, b) => a - b)[Math.ceil(ping.length * .95) - 1] });
  let value = await shadow('compareStart', { index });
  value = await until(async () => value.comparison === 'pending' ? (value = await shadow('comparePoll')) : value,
    next => next.comparison !== 'pending');
  return { ...value, driverPingSamplesMs: ping };
}
/** Read notes and ledger values only. Retirement removes controller cache payloads. */
async function baseline(path: string, deploymentPath: string, seedPath: string, boundaryPath: string): Promise<void> {
  const arm = await read(deploymentPath), seed = await read(seedPath), boundary = await read(boundaryPath);
  await owned(); const stats = await request('rig.stats'), hello = await request('contract.hello');
  assert(Number(stats.initEpochMs) > Number((arm.stats as Wire).initEpochMs));
  assert(Number(stats.initEpochMs) >= Number(arm.archiveMtimeMs));
  assert.equal((await shadow('info')).instrumentationRevision, COMBINED_MARKER);
  assert.equal(hash(await readFile(archivePath)), arm.archiveSha256); assert.equal(hash(await readFile(configPath)), arm.configSha256);
  for (const [key, value] of Object.entries(arm.config as Wire)) if (key !== 'recordChars') assert.equal((stats.config as Wire)[key], value);
  assert.equal(hello.runtimeProfile, 'phase-8-probe-v1'); assert.equal(hello.methodCount, 97); assert.equal(hello.methodsHash, 'f03f19414f40e3d3');
  const report: Wire = { schema: 'phase8g5c-combined-baseline-v1', project: OWNED_PROJECT, captured: new Date().toISOString(),
    deploymentPath, seedPath, boundaryPath, stats, hello, marker: COMBINED_MARKER,
    complete: false, eligible: false, combinedStorageAccepted: false, baselinePassed: false,
    archiveSha256: arm.archiveSha256, configSha256: arm.configSha256,
    memoryScope: 'shared JVM; no forced GC; cache-owned heap and host memory are not measured', comparisons: [] };
  await save(path, report);
  const persist = async (): Promise<void> => writeFile(path, JSON.stringify(report, null, 1) + '\n');
  try {
    report.census = await request('track.list'); assert.deepEqual(report.census, arm.census);
    report.allocationCold = await shadow('allocationStats'); report.scanBefore = await request('rig.scanTracks');
    report.topology = await shadow('trackTopology'); verifyFlatScale(report.topology as Wire, report.census as Wire);
    report.rebuildBegin = await shadow('rebuildBegin');
    report.inventory = await until(async () => { await shadow('rebuildPoll'); return shadow('inventoryList'); }, value => value.occupancyAdmitted === true);
    assert.deepEqual(publishedOccupancy(report.inventory as Wire), publishedOccupancy(arm.inventory as Wire));
    report.infoCold = await shadow('info'); await persist();
    const states = [...seed.seeds as Wire[], boundary.endSeed as Wire];
    for (let position = 0; position < states.length; position++) {
      const value = await compare(states[position]!, position === 0 ? 0 : 1, report.census as Wire, Number(stats.initEpochMs));
      (report.comparisons as Wire[]).push(value); await persist();
      verifyComparison(value, states[position]!, COMBINED_MARKER, [60, 72, 84]);
    }
    report.allocationWorking = await shadow('allocationStats'); report.infoWorking = await shadow('info');
    report.retire = [await shadow('retire', { index: 0 }), await shadow('retire', { index: 1 })];
    report.infoEvicted = await shadow('info'); report.allocationEvicted = await shadow('allocationStats');
    report.scanAfter = await request('rig.scanTracks'); report.censusAfter = await request('track.list');
    await owned(Number(stats.initEpochMs));
    verifyCombinedBaseline(report, arm, states); report.baselinePassed = true; report.finished = new Date().toISOString();
  } catch (error) { report.error = String(error); throw error; }
  finally { await persist(); }
  console.log(JSON.stringify({ baseline: path, baselinePassed: true, complete: false, eligible: false, combinedStorageAccepted: false }));
}
type Write = { channel: number; cell: number; pitch: number; velocity: number; duration?: number };
async function writer(trackId: string, census: Wire, initialization: number): Promise<void> {
  await owned(initialization); assert.deepEqual(await request('track.list'), census);
  const track = fullTracks(census).find(row => row.channelId === trackId); assert(track);
  await request('cursor.pin', { cursor: 'fine', pinned: false }); await request('cursor.pinTrack', { cursor: 'fine', pinned: false });
  await request('cursor.pointTrack', { cursor: 'fine', trackIndex: track.index });
  await request('slot.select', { trackIndex: track.index, slotIndex: 0, mechanism: 'track' });
  await until(() => request('cursor.status', { cursor: 'fine' }), value => value.slotExists === true && value.sceneIndex === 0
    && value.trackPosition === track.position && value.trackName === track.name);
  await request('cursor.pinTrack', { cursor: 'fine', pinned: true }); await request('cursor.pin', { cursor: 'fine', pinned: true });
  await request('cursor.setStepSize', { cursor: 'fine', stepSize: 1 / 512 });
  await request('cursor.scrollToStep', { cursor: 'fine', step: 0 }); await wait(150);
}
async function writes(notes: readonly Write[]): Promise<Wire[]> {
  const replies: Wire[] = [];
  for (let channel = 0; channel < 16; channel++) {
    const rows = notes.filter(note => note.channel === channel);
    for (let start = 0; start < rows.length; start += 256) {
      const part = rows.slice(start, start + 256);
      const reply = await request('cursor.setNotes', { cursor: 'fine', channel,
        notes: part.map(note => [note.cell, note.pitch, note.velocity, note.duration ?? 1 / 512]) });
      assert.equal(reply.written, part.length); replies.push({ channel, start, written: reply.written }); await wait(80);
    }
  }
  return replies;
}
/** Mutate only the proved owned row-0 clip. Persist intent and restore its complete baseline. */
async function budget(path: string, baselinePath: string, seedPath: string, boundaryPath: string, continuationPath?: string): Promise<void> {
  assert(path.endsWith('.json.gz'), 'use a compressed journal');
  const baselineReport = await read(baselinePath), seed = await read(seedPath), boundary = await read(boundaryPath);
  const first = (seed.seeds as Wire[])[0]!, other = boundary.endSeed as Wire;
  verifyCombinedBaseline(baselineReport, await read(String(baselineReport.deploymentPath)), [...seed.seeds as Wire[], other]);
  assert.equal(baselineReport.baselinePassed, true);
  const stats = await request('rig.stats'), initialization = Number((baselineReport.stats as Wire).initEpochMs), census = baselineReport.census as Wire;
  await owned(initialization); assert.deepEqual(await request('track.list'), census);
  assert.equal(hash(await readFile(archivePath)), baselineReport.archiveSha256); assert.equal(hash(await readFile(configPath)), baselineReport.configSha256);
  const report: Wire = { schema: 'phase8g5c-combined-budget-v1', marker: COMBINED_MARKER, project: OWNED_PROJECT,
    baselinePath, seedPath, boundaryPath, stats, census, captured: new Date().toISOString(), complete: false, eligible: false,
    archiveSha256: baselineReport.archiveSha256, configSha256: baselineReport.configSha256, fixtureRestored: false,
    combinedStorageAccepted: false, mutationStage: 'not-started',
    memoryScope: 'shared JVM; no forced GC; configured two-resident working set at the combined limit; no cache-owned heap attribution' };
  let preceding: Wire | undefined, precedingHash = '';
  if (continuationPath) {
    const bytes = await readFile(continuationPath), raw = gunzipSync(bytes, { maxOutputLength: 64 * 1024 * 1024 });
    preceding = JSON.parse(raw.toString('utf8')) as Wire; precedingHash = hash(raw);
    verifyCombinedBudgetDiagnostic(preceding, baselineReport, first, other, 'drain');
    for (const key of ['stats', 'census', 'infoEntry', 'otherResident', 'calibration', 'fixedEstimatedBytes', 'layout',
      'equality', 'allocationWorking', 'excess', 'exactStart', 'exactProgress', 'exactFallback']) report[key] = preceding[key];
    report.continuedFrom = continuationPath; report.continuedFromRawSha256 = precedingHash;
    report.precedingError = preceding.error; report.continuationStarted = new Date().toISOString();
    verifyBudgetContinuation(report, preceding, precedingHash);
  }
  const encoded = (): Buffer => gzipSync(JSON.stringify(report), { level: 9 });
  await writeFile(path, encoded(), { flag: 'wx' });
  const persist = async (): Promise<void> => writeFile(path, encoded());
  let mutated = false, failure: unknown;
  const rawNotes = async (maxX: number): Promise<Wire> => request('cursor.getNotesVerboseAllChannels', { cursor: 'fine', maxX });
  const oracle = { census, topology: baselineReport.topology as Wire, inventory: baselineReport.inventory as Wire };
  const metadataFor = (state: Wire): Wire => {
    const raw = state.metadata as Wire, metadata: Wire = { name: raw.name, isLoopEnabled: raw.loopEnabled };
    for (const key of ['playStart', 'playStop', 'loopStart', 'loopLength', 'colorRed', 'colorGreen', 'colorBlue', 'colorAlpha']) metadata[key] = raw[key];
    return metadata;
  };
  const otherPayload: Payload = { metadata: metadataFor(other), notes: independentNotes(other.notes as Wire) };
  try {
    const entry = await shadow('info'); verifyCombinedLedger(entry, { ...oracle, payloads: [], authorityNotes: [] });
    assert.equal(entry.resident, 0); assert.equal(entry.physicalPendingHints, 0);
    if (preceding) report.continuationEntry = entry; else report.infoEntry = entry;
    await writer(String(first.trackId), census, initialization);
    report.originalNotes = await rawNotes(2048); report.originalMetadata = await request('cursor.clipMetadata', { cursor: 'fine' });
    assert.deepEqual(independentNotes(report.originalNotes as Wire), independentNotes(first.notes as Wire));
    assert.deepEqual(report.originalMetadata, first.metadata); await persist();
    if (!preceding) {
      report.otherResident = await compare(other, 1, census, initialization); await persist();
      verifyComparison(report.otherResident as Wire, other, COMBINED_MARKER, [84]);
      await writer(String(first.trackId), census, initialization);
      report.mutationStage = 'calibration-intent'; await persist(); mutated = true;
      await request('cursor.clearNotes', { cursor: 'fine' }); await wait(200);
      const calibration: Wire = { writes: await writes(Array.from({ length: 127 }, (_, i) => ({ channel: 0, cell: 0, pitch: i, velocity: i + 1 }))) };
      calibration.notes = await rawNotes(1); calibration.metadata = await request('cursor.clipMetadata', { cursor: 'fine' });
      calibration.result = await compare({ trackId: first.trackId }, 0, census, initialization); report.calibration = calibration;
      const notes = independentNotes(calibration.notes as Wire), value = calibration.result as Wire, metadata = metadataFor({ metadata: calibration.metadata });
      assert.equal(value.comparison, 'match'); assert.deepEqual(checkMutationNotes(value.authorityNotes as ShadowNote[], notes), []);
      const calLedger = verifyCombinedLedger({ ...value, resourceAccounting: value.publicationResourceAccounting },
        { ...oracle, payloads: [otherPayload, { metadata, notes }], authorityNotes: notes });
      const costs = new Map(notes.map(note => [note.pitch + 1, noteEstimate(note.fields)]));
      const fixed = Number(calLedger.totalEstimatedBytes) - snapshotEstimate(metadata, notes) - notes.length * AUTHORITY_NOTE_BYTES
        - 56 * new Set(notes.map(note => `${note.cell}:${note.pitch}`)).size;
      report.fixedEstimatedBytes = fixed;
      const layout = solveCombinedLayout(fixed, baseEstimate(metadata), costs, 100); report.layout = layout;
      assert.equal(costs.get(layout.a)! - costs.get(layout.b)!, 2, 'select a two-byte excess before writing the boundary');
      report.mutationStage = 'equality-intent'; await persist();
      await shadow('retire', { index: 0 }); await writer(String(first.trackId), census, initialization);
      await request('cursor.clearNotes', { cursor: 'fine' }); await wait(200);
      const projection = layoutNotes(layout), maxX = Math.ceil(Math.ceil(layout.total / 16) / 128);
      const equality: Wire = { writes: await writes(projection) };
      equality.notes = await rawNotes(maxX); equality.result = await compare({ trackId: first.trackId }, 0, census, initialization);
      report.equality = equality;
      assert.equal((equality.result as Wire).comparison, 'match');
      assert.equal(((equality.result as Wire).publicationResourceAccounting as Wire).totalEstimatedBytes, COMBINED_LIMIT);
      report.allocationWorking = await shadow('allocationStats'); report.mutationStage = 'excess-intent'; await persist();
      await writer(String(first.trackId), census, initialization);
      const excess: Wire = { writes: await writes([{ ...projection[0]!, velocity: layout.a }]) };
      await wait(200); excess.notes = await rawNotes(maxX); excess.result = await compareCurrent(0); report.excess = excess;
      assert.equal((excess.result as Wire).comparison, 'combined-storage-budget');
      excess.viewsAfter = [await shadow('status', { index: 0 }), await shadow('status', { index: 1 })]; await persist();
      const track = fullTracks(census).find(row => row.channelId === first.trackId); assert(track);
      report.exactStart = await shadow('exactStart', { trackIndex: track.index, row: 0 }); await persist();
      assert.equal((report.exactStart as Wire).phase, 'binding', 'the exact reader must start before polling');
      report.exactFallback = await until(async () => {
        const result = await shadow('exactPoll'); report.exactProgress = result; await persist(); return result;
      }, result => result.terminal === true);
      assert.equal((report.exactFallback as Wire).authorityAvailable, true);
      await shadow('exactCancel', { reason: 'explicit-combined-recovery' });
    }
    const layout = report.layout as unknown as Parameters<typeof layoutNotes>[0];
    const projection = layoutNotes(layout), maxX = Math.ceil(Math.ceil(layout.total / 16) / 128);
    report.mutationStage = 'recovery-intent'; await persist();
    await shadow('retire', { index: 0 });
    await writer(String(first.trackId), census, initialization);
    if (preceding) {
      await shadow('exactCancel', { reason: 'continued-combined-recovery' }); await shadow('retire', { index: 1 });
      mutated = true; await request('cursor.clearNotes', { cursor: 'fine' }); await wait(200);
      report.recoveryWrites = await writes(projection);
    } else await writes([projection[0]!]);
    await wait(200);
    report.recoveryOther = await compare(other, 1, census, initialization);
    verifyComparison(report.recoveryOther as Wire, other, COMBINED_MARKER, [84]);
    report.recovery = { notes: await rawNotes(maxX), result: await compare({ trackId: first.trackId }, 0, census, initialization) };
    assert.equal(((report.recovery as Wire).result as Wire).comparison, 'match'); await persist();
    await shadow('retire', { index: 0 }); await shadow('retire', { index: 1 });
    report.infoEvicted = await shadow('info'); report.allocationEvicted = await shadow('allocationStats');
  } catch (error) { failure = error; report.error = String(error); }
  finally {
    if (mutated) {
      try {
        await owned(initialization); await shadow('exactCancel', { reason: 'owned-note-restoration' });
        await shadow('retire', { index: 0 }); await shadow('retire', { index: 1 });
        report.mutationStage = 'restoration-intent'; await persist();
        await writer(String(first.trackId), census, initialization); await request('cursor.clearNotes', { cursor: 'fine' }); await wait(200);
        await writes(independentNotes(first.notes as Wire).map(note => ({ channel: note.channel, cell: note.cell, pitch: note.pitch,
          velocity: 80 + note.channel, duration: 8 / 512 }))); await wait(200);
        report.restoredNotes = await rawNotes(2048); report.restoredMetadata = await request('cursor.clipMetadata', { cursor: 'fine' });
        assert.deepEqual(independentNotes(report.restoredNotes as Wire), independentNotes(first.notes as Wire));
        assert.deepEqual(report.restoredMetadata, first.metadata);
        report.restoredComparison = await compare(first, 0, census, initialization);
        verifyComparison(report.restoredComparison as Wire, first, COMBINED_MARKER);
        await shadow('retire', { index: 0 }); await shadow('retire', { index: 1 });
        report.censusAfter = await request('track.list'); assert.deepEqual(report.censusAfter, census);
        report.scanAfter = await request('rig.scanTracks'); report.inventoryAfter = await shadow('inventoryList');
        assert.equal((report.scanAfter as Wire).slotsWithContent, 6);
        assert.deepEqual(publishedOccupancy(report.inventoryAfter as Wire), publishedOccupancy(baselineReport.inventory as Wire));
        report.infoFinal = await shadow('info'); report.fixtureRestored = true; report.mutationStage = 'restored';
      } catch (error) { report.restoreError = String(error); failure ??= error; }
    }
    report.finished = new Date().toISOString(); await persist();
  }
  if (failure) throw failure;
  try {
    if (preceding) verifyBudgetContinuation(report, preceding, precedingHash);
    report.summary = verifyCombinedBudget(report, baselineReport, first, other); report.combinedStorageAccepted = true;
  } catch (error) { report.error = String(error); await persist(); throw error; }
  await persist();
  console.log(JSON.stringify(report.summary));
}
async function main(): Promise<void> {
  const [mode, path, prior, seed, boundary, continuation] = process.argv.slice(2); assert(path && prior);
  if (mode === 'deployment') await deployment(path, prior);
  else { assert(seed && boundary); if (mode === 'budget' || mode === 'resume-budget') { if (mode === 'resume-budget') assert(continuation);
      await budget(path, prior, seed, boundary, continuation); }
    else { assert.equal(mode, 'baseline'); await baseline(path, prior, seed, boundary); } }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => bridge.disconnect());
