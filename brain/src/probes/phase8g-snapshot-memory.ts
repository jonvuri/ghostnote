// 8h3e removed the research wire or rig configuration that this live driver uses. Live use needs the
// earlier research build of its own session. Its retained artifacts and offline checks do not need a host.
/** Separate enriched payload admission from sparse recorder capacity. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { BridgeClient } from '../client.js';
import { identityEndpoint } from './phase8g-identity-fence.js';
import { checkExpectedFixture } from './phase8g-lifecycle-reuse.js';
import { ACQUIRED_FIELDS, MUTATION_MARKER, checkMutationComparison, collectMutationRegistry, verifyMutationRegistry } from './phase8g-shadow-mutations.js';
import { verifyCapacityMethods, verifyCapacityStatus } from './phase8g-capacity-controls.js';
import { compareShadowSnapshots, shadowSnapshotFromWire, type ShadowCacheWireSnapshot, type ShadowNote } from './phase8g-shadow-cache-lib.js';
type Wire = Record<string, unknown>;
interface Track { index: number; channelId: string; name: string }
const GRID = 1 / 512;
export const SNAPSHOT_MEMORY_OUTPUT = '/tmp/ghostnote-8g-snapshot-memory-v5-results.json';
export const SNAPSHOT_MEMORY_LIMIT = 16 * 1024 * 1024;
function measure(value: unknown, name: string): number { assert(typeof value === 'number' && Number.isFinite(value) && value >= 0, name); return value; }
export function memoryWrittenProjection(notes: readonly ShadowNote[], coordinates: number): void {
  assert.equal(notes.length, coordinates * 16); const keys = new Set<string>();
  for (const note of notes) { assert(Number.isSafeInteger(note.channel) && note.channel >= 0 && note.channel < 16);
    const coordinate = note.cell * 128 + note.pitch; assert(Number.isSafeInteger(coordinate) && coordinate >= 0 && coordinate < coordinates);
    assert(Number.isSafeInteger(note.pitch) && note.pitch >= 0 && note.pitch < 128);
    const key = `${note.channel}:${coordinate}`; assert(!keys.has(key)); keys.add(key);
    assert(ACQUIRED_FIELDS.every(field => Object.hasOwn(note.fields, field))); assert.equal(note.fields.pressure, 0);
    for (const field of ACQUIRED_FIELDS) { const value = note.fields[field]; assert(typeof value === 'string' || typeof value === 'boolean'
      || typeof value === 'number' && Number.isFinite(value), `invalid acquired field ${field}`); }
    assert(Math.abs(Number(note.fields.velocity) - 100 / 127) < 1e-6); assert.equal(note.fields.duration, GRID);
    assert.equal(note.fields.rawDuration, GRID); assert.equal(note.fields.durationCells, 1);
  }
}
export function memoryMatch(value: Wire, id: string, coordinates: number, metadata: unknown): void {
  verifyCapacityStatus(value); assert.equal(value.comparison, 'match'); assert.equal(value.contentComparisonComplete, true); assert.equal(value.authorityAvailable, true);
  const wire = value.diagnosticSnapshot as ShadowCacheWireSnapshot; assert(wire && Array.isArray(value.authorityNotes));
  assert.deepEqual(wire.address, { trackId: id, row: 0 }); assert.equal(wire.coverage.width, 2048); assert.equal(wire.coverage.startCell, 0);
  assert.equal(wire.coverage.allChannels, true); assert.equal(wire.coverage.timingBasis, '1/512-beat'); assert(ACQUIRED_FIELDS.every(field => wire.coverage.fields.includes(field)));
  assert.deepEqual(wire.metadata, metadata); assert.deepEqual(value.authorityMetadata, metadata);
  const cached = shadowSnapshotFromWire(wire, 'complete'), authority = shadowSnapshotFromWire({ ...wire, notes: value.authorityNotes as ShadowNote[],
    metadata: value.authorityMetadata as ShadowCacheWireSnapshot['metadata'], coverage: value.authorityCoverage as ShadowCacheWireSnapshot['coverage'] }, 'complete');
  assert.equal(compareShadowSnapshots(cached, authority, { before: cached.window, after: cached.window }).outcome, 'match');
  memoryWrittenProjection(cached.notes, coordinates); memoryWrittenProjection(authority.notes, coordinates);
}
export function memoryRefusal(value: Wire): string {
  verifyCapacityStatus(value); assert(typeof value.comparison === 'string' && value.comparison !== 'pending' && value.comparison !== 'match');
  assert.notEqual(value.contentComparisonComplete, true); assert(!value.diagnosticSnapshot && !value.authoritativeSnapshot && !value.historicalSnapshot);
  return value.comparison as string;
}
export function memoryBatchNotes(start: number): number[][] {
  assert(start === 0 || start === 256); return Array.from({ length: 256 }, (_, offset) => [Math.floor((start + offset) / 128), (start + offset) % 128, 100, GRID]);
}
export function verifySnapshotMemoryReport(report: Wire): Wire {
  assert.equal(report.marker, MUTATION_MARKER); assert.equal(report.researchOnly, true); assert.equal(report.complete, false); assert.equal(report.eligible, false);
  assert.equal(report.callbackOriginProved, false); assert.equal(report.fixtureRestored, true); assert.equal(typeof report.ended, 'string'); assert(!report.cleanupError);
  verifyCapacityMethods(report.methods as Wire); assert.deepEqual(report.finalTrackIds, report.baselineTrackIds); assert.equal(report.finalScenes, report.baselineScenes);
  assert.deepEqual(report.finalRootEndpoint, report.initialRootEndpoint); assert.deepEqual(report.finalSlots, report.baselineSlots);
  const original = report.baselines as Wire[], restored = report.restoration as Wire[]; assert.equal(original.length, 3); assert.equal(restored.length, 3);
  const id = String(report.ownedTrackId); for (let row = 0; row < 3; row++) {
    const value = original[row]!.result as Wire, expected = (value.diagnosticSnapshot as ShadowCacheWireSnapshot).notes; assert.deepEqual(checkExpectedFixture(expected, row), []);
    assert.deepEqual(checkMutationComparison(value, row, id, expected), []); for (const note of expected) assert.equal(note.fields.pressure, 0);
    assert.deepEqual(checkMutationComparison(restored[row]!.result as Wire, row, id, expected), []); assert.deepEqual((restored[row]!.result as Wire).authorityMetadata, value.authorityMetadata);
  }
  verifyMutationRegistry((report.initialInventory as Wire).result as Wire); verifyMutationRegistry((report.cleanupInventory as Wire).result as Wire);
  const metadata = ((original[0]!.result as Wire).diagnosticSnapshot as ShadowCacheWireSnapshot).metadata, stages = report.cases as Wire[];
  assert(stages.length > 0 && stages.length <= 2); let boundaryObserved = false, matched4096 = false;
  for (const [stageIndex, stage] of stages.entries()) {
    const count = stageIndex === 0 ? 256 : 512; assert.equal(stage.coordinates, count); assert.equal(stage.noteCount, count * 16);
    const batches = stage.batches as Wire[]; assert(batches.length <= 16);
    for (const [channel, batch] of batches.entries()) { assert.equal(batch.channel, channel); assert.deepEqual(batch.notes, memoryBatchNotes(stageIndex === 0 ? 0 : 256));
      if (batch.action) assert.equal((batch.action as Wire).written, 256);
      const statuses = batch.statuses as Wire[]; for (const status of statuses) verifyCapacityStatus(status);
      if (statuses.length) { const final = statuses.at(-1)!;
        assert.equal(final.occupiedCoordinates, stageIndex === 0 ? 256 : 512);
        assert.equal((final.domainObjects as Wire).membershipNoteRecords, (stageIndex === 0 ? 0 : 4096) + (channel + 1) * 256);
      }
    }
    if (stage.result) {
      assert.equal(batches.length, 16); const result = stage.result as Wire;
      if (result.comparison === 'match') { memoryMatch(result, id, count, metadata);
        assert(Number((result.diagnosticSnapshot as Wire).payloadEstimatedBytes) <= SNAPSHOT_MEMORY_LIMIT);
        if (stageIndex === 0) matched4096 = true; }
      else { const reason = memoryRefusal(result); assert.equal(stage.actualTerminalReason, reason);
        if (stageIndex === 1 && reason === 'snapshot-memory-budget') boundaryObserved = true; }
      if (Array.isArray(result.authorityNotes)) {
        assert.equal(result.authorityAvailable, true); memoryWrittenProjection(result.authorityNotes as ShadowNote[], count);
        assert.deepEqual(result.authorityMetadata, metadata); assert.deepEqual(result.authorityCoverage, (original[0]!.result as Wire).authorityCoverage);
      }
      const metrics = stage.metrics as Wire; assert.equal(metrics.serializedBytesAreMemoryMeasurement, false);
      for (const name of ['recorderEstimatedBytes', 'retainedSnapshotEstimatedBytes', 'physicalHintRecorderEstimatedBytes', 'serializedResultBytes',
        'membershipGetStepCalls', 'authorityGetStepCalls', 'enrichmentGetStepCalls', 'membershipHostWorkMs', 'authorityHostWorkMs', 'enrichmentHostWorkMs']) measure(metrics[name], name);
      assert.equal((stage.status as Wire).occupiedCoordinates, count); assert.equal(metrics.recorderEstimatedBytes, 256 + 56 * count);
      assert.equal((stage.status as Wire).physicalBindingRevision, report.warmBindingRevision);
      const census = metrics.domainObjects as Wire; assert.equal(census.membershipNoteRecords, count * 16); assert.equal(census.occupiedCoordinateEntries, count);
      if (stageIndex === 1 && result.comparison === 'snapshot-memory-budget') {
        assert.equal(metrics.retainedSnapshotEstimatedBytes, 0); assert.equal(census.retainedNoteRecords, 0); assert.equal(census.retainedFieldEntries, 0);
      }
    }
  }
  assert.equal(report.snapshotMemoryBoundaryObserved, boundaryObserved && matched4096); assert.equal(report.selectedGlobalBudgetsCovered, false);
  const inference = report.sourceBudgetInference as Wire;
  assert.equal(inference.selectedSnapshotLimitBytes, SNAPSHOT_MEMORY_LIMIT); assert.equal(inference.selectedRecorderOccupiedLimit, 2048);
  assert.equal(inference.authorityStagingPerNoteEstimatedBytes, 160 + ACQUIRED_FIELDS.length * 64);
  assert.equal(inference.authority8192EstimatedBytes, 8192 * (160 + ACQUIRED_FIELDS.length * 64));
  assert(Number(inference.authority8192EstimatedBytes) < SNAPSHOT_MEMORY_LIMIT);
  assert.equal(inference.predictedEnriched8192IsMeasurement, false); assert.equal(inference.serializedBytesAreMemoryMeasurement, false);
  if (stages[1]?.afterFirstMutation) assert.equal((stages[1].afterFirstMutation as Wire).retainedSnapshotEstimatedBytes, 0);
  if (!report.snapshotMemoryBoundaryObserved) assert(typeof report.error === 'string', 'an earlier host limit must remain an explicit failed control');
  return { matched4096, snapshotMemoryBoundaryObserved: boundaryObserved && matched4096, actualReasons: stages.map(stage => stage.actualTerminalReason ?? 'not-acquired'),
    selectedGlobalBudgetsCovered: false, complete: false, eligible: false };
}
const bridge = new BridgeClient(); let calls = 0, responseBytes = 0;
const wait = async (ms = 100): Promise<void> => await new Promise(resolve => setTimeout(resolve, ms));
async function request<T = Wire>(method: string, params?: Wire): Promise<T> {
  const value = await bridge.request(method, params) as T; calls++; responseBytes += Buffer.byteLength(JSON.stringify(value)); return value;
}
async function shadow(operation: string, params: Wire = {}): Promise<Wire> { return await request('cache.shadow', { operation, ...params }); }
async function poll(read: () => Promise<Wire>, done: (value: Wire) => boolean): Promise<Wire> {
  const started = performance.now(); for (;;) { const value = await read(); if (done(value)) return value;
    assert(performance.now() - started < 45_000, `capacity operation expired: ${JSON.stringify(value)}`); await wait(); }
}
async function tracks(): Promise<Track[]> { return (await request<{ tracks: Track[] }>('track.list')).tracks; }
async function scenes(): Promise<number> { return (await request<{ sceneCount: number }>('scene.count')).sceneCount; }
async function owned(id: string): Promise<Track> { const found = (await tracks()).filter(value => value.channelId === id); assert.equal(found.length, 1);
  assert.equal(found[0]!.name, 'gn-8g-reuse'); return found[0]!; }
async function pointWriter(id: string, row: number, page = 0): Promise<void> {
  const track = await owned(id), cursor = 'fine'; await request('cursor.pin', { cursor, pinned: false }); await request('cursor.pinTrack', { cursor, pinned: false });
  await request('cursor.pointTrack', { cursor, trackIndex: track.index }); await request('slot.select', { trackIndex: track.index, slotIndex: row, mechanism: 'track' });
  await poll(() => request('cursor.status', { cursor }), value => value.slotExists === true && value.trackPosition === track.index && value.sceneIndex === row);
  await request('cursor.pinTrack', { cursor, pinned: true }); await request('cursor.pin', { cursor, pinned: true });
  await request('cursor.setStepSize', { cursor, stepSize: GRID }); await request('cursor.scrollToStep', { cursor, step: page }); await wait(150);
}
async function guardWriter(id: string): Promise<void> { const track = await owned(id), value = await request('cursor.status', { cursor: 'fine' });
  assert.equal(value.trackPosition, track.index); assert.equal(value.sceneIndex, 0); assert.equal(value.slotExists, true); assert.equal(value.isPinned, true); assert.equal(value.cursorTrackPinned, true); }
async function bind(id: string, row: number): Promise<Wire> {
  const track = await owned(id); await shadow('point', { index: 0, trackIndex: track.index, row, canaryTrackIndex: track.index, canaryRow: row === 0 ? 1 : 0 });
  const value = await poll(() => shadow('poll', { index: 0 }), value => value.phase === 'retired'
    || ((value.phase === 'settled' || value.phase === 'complete') && value.canaryPhase === 'target'));
  assert.notEqual(value.phase, 'retired'); assert.equal(value.canaryVerifiedForBinding, true); return value;
}
async function drain(retained: Wire[]): Promise<Wire> {
  return await poll(async () => { const value = await shadow('reconcile', { index: 0 }); retained.push(value); verifyCapacityStatus(value); return value; },
    value => value.cacheModelHealth === 'overflow' || (value.physicalPendingHints === 0 && value.pendingCoordinates === 0));
}
async function compare(): Promise<Wire> { let value = await shadow('compareStart', { index: 0 });
  return await poll(async () => { if (value.comparison === 'pending') value = await shadow('comparePoll'); return value; }, value => value.comparison !== 'pending'); }
async function registry(operation: 'inventory' | 'rebuild'): Promise<Wire> {
  const statuses: Wire[] = [], result = await collectMutationRegistry(await shadow(operation), () => shadow('rebuildPoll'), statuses); return { operation, statuses, result };
}
async function restoreA(id: string, original: readonly ShadowNote[], guard: () => Promise<void>): Promise<void> {
  await pointWriter(id, 0); await guard(); await request('cursor.clearNotes', { cursor: 'fine' }); await wait(200);
  for (const note of original) {
    assert.equal(note.fields.pressure, 0); await request('cursor.scrollToStep', { cursor: 'fine', step: note.cell }); await wait(50); await guard();
    await request('cursor.setNotes', { cursor: 'fine', channel: note.channel, notes: [[0, note.pitch, Math.round(Number(note.fields.velocity) * 127), note.fields.rawDuration]] });
    await poll(() => request('cursor.getNotes', { cursor: 'fine', channel: note.channel }), value => (value.notes as number[][]).some(value => value[0] === 0 && value[1] === note.pitch));
    const props: Wire = Object.fromEntries(ACQUIRED_FIELDS.filter(field => !['pressure', 'gain', 'rawGain', 'timbre', 'rawTimbre', 'rawDuration', 'durationCells', 'recurrenceLength', 'recurrenceMask'].includes(field))
      .map(field => [field, note.fields[field]]));
    props.duration = note.fields.rawDuration; props.gain = Number(note.fields.rawGain) / 2; props.timbre = note.fields.rawTimbre;
    props.recurrence = [note.fields.recurrenceLength, note.fields.recurrenceMask]; assert(!Object.hasOwn(props, 'pressure'));
    const applied = await request('cursor.setNoteProps', { cursor: 'fine', channel: note.channel, x: 0, y: note.pitch, props });
    assert.deepEqual(applied.applied, Object.fromEntries(Object.keys(props).map(field => [field, 'ok']))); await wait(100);
  }
  await request('cursor.scrollToStep', { cursor: 'fine', step: 0 }); await wait(200);
}
async function run(output: string): Promise<void> {
  const state = JSON.parse(await readFile('/tmp/ghostnote-8g-research-state.json', 'utf8')) as { ownedTrackId: string; baselineIds: string[]; baselineScenes: number };
  const witness = JSON.parse(await readFile('/tmp/ghostnote-8g-mutation-witness.json', 'utf8')) as Wire;
  assert.equal(witness.status, 'ready'); assert.equal(witness.ownedTrackId, state.ownedTrackId); await owned(state.ownedTrackId);
  const rawTracks = await request('track.list'); assert.equal(rawTracks.count, rawTracks.itemCount); assert(Number(rawTracks.itemCount) <= Number(rawTracks.bankSize));
  const baselineTrackIds = (await tracks()).map(track => track.channelId); assert.equal(new Set(baselineTrackIds).size, 5);
  assert.deepEqual([...baselineTrackIds].sort(), [...state.baselineIds, state.ownedTrackId].sort()); assert.equal(await scenes(), 8); assert.equal(state.baselineScenes, 8);
  const root = identityEndpoint(await shadow('rootSnapshot'), state.ownedTrackId); assert.deepEqual(root, identityEndpoint((witness.layer as Wire).root as Wire, state.ownedTrackId, true));
  const methods = await request('rig.methods'); verifyCapacityMethods(methods); const initial = await shadow('info'); verifyCapacityStatus(initial);
  const allSlots = async (): Promise<Wire[]> => { const values: Wire[] = []; for (const track of await tracks()) for (let row = 0; row < 8; row++) {
    const status = await request('slot.status', { trackIndex: track.index, slotIndex: row }); assert.equal(status.hasContent, track.channelId === state.ownedTrackId && row < 3);
    values.push({ id: track.channelId, row, exists: status.exists, hasContent: status.hasContent }); } return values; };
  const report: Wire = { marker: MUTATION_MARKER, researchOnly: true, complete: false, eligible: false, callbackOriginProved: false,
    selectedGlobalBudgetsCovered: false, snapshotMemoryBoundaryObserved: false, started: new Date().toISOString(), ownedTrackId: state.ownedTrackId,
    baselineTrackIds, baselineScenes: 8, initialRootEndpoint: root, methods, initial, rawTracks, baselineSlots: await allSlots(), cases: [], baselines: [], restoration: [],
    sourceBudgetInference: { selectedSnapshotLimitBytes: SNAPSHOT_MEMORY_LIMIT, selectedRecorderOccupiedLimit: 2048,
      authorityStagingPerNoteEstimatedBytes: 160 + ACQUIRED_FIELDS.length * 64, authority8192EstimatedBytes: 8192 * (160 + ACQUIRED_FIELDS.length * 64),
      predictedEnriched8192BytesApprox: 16_860_000, predictedEnriched8192IsMeasurement: false,
      source: 'ShadowProjectCache.snapshot payload model; ShadowCacheProbe independent authority staging model',
      serializedBytesAreMemoryMeasurement: false }, changedOriginalFieldsScope: 'Owned A note content only; all original acquired fields are retained for restoration.' };
  await writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  let failed: unknown, mutated = false; const originals: (readonly ShadowNote[])[] = [];
  const save = async (): Promise<void> => { report.calls = calls; report.responseBytes = responseBytes; await writeFile(output, JSON.stringify(report, null, 2) + '\n'); };
  const guard = async (): Promise<void> => { assert.deepEqual((await tracks()).map(track => track.channelId), baselineTrackIds); assert.equal(await scenes(), 8);
    await owned(state.ownedTrackId); assert.deepEqual(identityEndpoint(await shadow('rootSnapshot'), state.ownedTrackId), root); await guardWriter(state.ownedTrackId); };
  try {
    report.initialInventory = await registry('inventory');
    for (let row = 0; row < 3; row++) { await bind(state.ownedTrackId, row); await drain([]); const result = await compare();
      const notes = (result.diagnosticSnapshot as ShadowCacheWireSnapshot).notes; assert.deepEqual(checkExpectedFixture(notes, row), []);
      for (const note of notes) { assert.equal(note.fields.pressure, 0); assert(ACQUIRED_FIELDS.every(field => Object.hasOwn(note.fields, field))); }
      assert.deepEqual(checkMutationComparison(result, row, state.ownedTrackId, notes), []); originals.push(structuredClone(notes));
      (report.baselines as Wire[]).push({ row, result }); await save(); }
    await bind(state.ownedTrackId, 0); await drain([]); await pointWriter(state.ownedTrackId, 0); await guard(); mutated = true;
    await request('cursor.clearNotes', { cursor: 'fine' }); await wait(200); report.clearStatuses = []; await drain(report.clearStatuses as Wire[]);
    report.warmBindingRevision = (await shadow('status', { index: 0 })).physicalBindingRevision;
    for (const coordinates of [256, 512]) {
      const before = await shadow('info'), started = performance.now(), beforeCalls = calls, beforeBytes = responseBytes;
      const value: Wire = { coordinates, noteCount: coordinates * 16, label: `enriched-${coordinates * 16}`, batches: [] }; (report.cases as Wire[]).push(value); await save();
      for (let channel = 0; channel < 16; channel++) {
        await guard(); const notes = memoryBatchNotes(coordinates === 256 ? 0 : 256), batch: Wire = { channel, notes, statuses: [] };
        (value.batches as Wire[]).push(batch); await save(); batch.action = await request('cursor.setNotes', { cursor: 'fine', channel, notes }); await wait(200);
        const drained = await drain(batch.statuses as Wire[]); await save();
        assert.equal(drained.occupiedCoordinates, coordinates === 256 ? 256 : 512);
        assert.equal((drained.domainObjects as Wire).membershipNoteRecords, (coordinates === 256 ? 0 : 4096) + (channel + 1) * 256);
        if (coordinates === 512 && channel === 0) {
          value.afterFirstMutation = drained; await save(); assert.equal(drained.retainedSnapshotEstimatedBytes, 0, 'the previous 4096-note candidate must be invalidated');
        }
      }
      value.result = await compare(); const result = value.result as Wire; value.actualTerminalReason = result.comparison;
      value.status = await shadow('status', { index: 0 }); const after = value.status as Wire;
      const metrics: Wire = { wallMs: performance.now() - started, calls: calls - beforeCalls, responseBytes: responseBytes - beforeBytes,
        serializedResultBytes: Buffer.byteLength(JSON.stringify(result)), serializedBytesAreMemoryMeasurement: false, domainObjects: after.domainObjects,
        domainObjectsAreLogicalCounts: true, snapshotPayloadEstimatedBytes: (result.diagnosticSnapshot as Wire | undefined)?.payloadEstimatedBytes ?? null,
        independentlyAcquiredAuthorityNotes: Array.isArray(result.authorityNotes) ? result.authorityNotes.length : 0,
        historicalLastSnapshotSerializedBytes: after.lastSnapshotSerializedBytes };
      for (const field of ['membershipGetStepCalls', 'authorityGetStepCalls', 'enrichmentGetStepCalls', 'membershipHostWorkMs', 'authorityHostWorkMs', 'enrichmentHostWorkMs']) metrics[field] = measure(after[field], field) - measure(before[field], field);
      for (const field of ['recorderEstimatedBytes', 'physicalHintRecorderEstimatedBytes', 'retainedSnapshotEstimatedBytes']) metrics[field] = measure(after[field], field);
      value.metrics = metrics; value.rawFollowupStatus = after; await save();
      const metadata = ((report.baselines as Wire[])[0]!.result as Wire).authorityMetadata;
      if (coordinates === 256) memoryMatch(result, state.ownedTrackId, coordinates, metadata);
      else {
        const reason = memoryRefusal(result);
        if (Array.isArray(result.authorityNotes)) { memoryWrittenProjection(result.authorityNotes as ShadowNote[], coordinates); assert.deepEqual(result.authorityMetadata, metadata); }
        assert.equal(reason, 'snapshot-memory-budget', `actual host refusal precedes the requested snapshot boundary: ${reason}`);
        assert.equal(after.retainedSnapshotEstimatedBytes, 0); report.snapshotMemoryBoundaryObserved = true;
      }
      await save(); console.log(JSON.stringify({ notes: coordinates * 16, actualReason: result.comparison, recorderEstimatedBytes: metrics.recorderEstimatedBytes,
        retainedSnapshotEstimatedBytes: metrics.retainedSnapshotEstimatedBytes, authorityNotes: metrics.independentlyAcquiredAuthorityNotes }));
    }
  } catch (error) { failed = error; report.error = String(error); await save(); }
  finally {
    try { await shadow('retire', { index: 0 }); await shadow('retire', { index: 1 });
      if (mutated) await restoreA(state.ownedTrackId, originals[0]!, guard);
      report.cleanupInventory = await registry('rebuild');
      for (let row = 0; row < originals.length; row++) { await bind(state.ownedTrackId, row); await drain([]); const result = await compare();
        assert.deepEqual(checkMutationComparison(result, row, state.ownedTrackId, originals[row]!), []);
        assert.deepEqual(result.authorityMetadata, ((report.baselines as Wire[])[row]!.result as Wire).authorityMetadata);
        (report.restoration as Wire[]).push({ row, result }); await save(); }
      assert.equal(originals.length, 3); report.finalTrackIds = (await tracks()).map(track => track.channelId); report.finalScenes = await scenes();
      report.finalRootEndpoint = identityEndpoint(await shadow('rootSnapshot'), state.ownedTrackId); report.finalSlots = await allSlots(); report.fixtureRestored = true;
      await pointWriter(state.ownedTrackId, 0);
    } catch (error) { report.cleanupError = String(error); if (!failed) failed = error; }
    await shadow('retire', { index: 0 }); await shadow('retire', { index: 1 }); await shadow('exactCancel', { reason: 'snapshot-memory-ended' }); report.ended = new Date().toISOString(); await save();
  }
  if (failed) throw failed; console.log(JSON.stringify(verifySnapshotMemoryReport(report)));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  void (process.argv[2] === 'verify' ? readFile(process.argv[3] ?? SNAPSHOT_MEMORY_OUTPUT, 'utf8').then(value => console.log(JSON.stringify(verifySnapshotMemoryReport(JSON.parse(value) as Wire))))
    : (assert.equal(process.argv[2], 'run'), run(process.argv[3] ?? SNAPSHOT_MEMORY_OUTPUT))).catch(error => { console.error(error); process.exitCode = 1; }).finally(() => bridge.disconnect());
