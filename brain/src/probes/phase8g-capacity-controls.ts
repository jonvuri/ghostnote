/** Separate occupied-coordinate capacity from callback backpressure. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { BridgeClient } from '../client.js';
import { identityEndpoint } from './phase8g-identity-fence.js';
import { checkExpectedFixture } from './phase8g-lifecycle-reuse.js';
import { ACQUIRED_FIELDS, MUTATION_MARKER, applyExpectedProps, checkMutationComparison,
  collectMutationRegistry, verifyMutationRegistry } from './phase8g-shadow-mutations.js';
import type { NormalizedValue, ShadowCacheWireSnapshot, ShadowNote } from './phase8g-shadow-cache-lib.js';

type Wire = Record<string, unknown>;
type Note = { channel: number; cell: number; pitch: number; fields: Record<string, NormalizedValue> };
interface Track { index: number; channelId: string; name: string }
const GRID = 1 / 512, LIMIT = 2048;
export const CAPACITY_OUTPUT = '/tmp/ghostnote-8g-capacity-controls-v5-results.json';
export const CAPACITY_COUNTS = [256, 1024, 2048] as const;
export const CAPACITY_METHODS = ['cache.shadow', 'rig.methods', 'contract.hello', 'track.list', 'scene.count', 'slot.status', 'slot.select',
  'cursor.pin', 'cursor.pinTrack', 'cursor.pointTrack', 'cursor.status', 'cursor.setStepSize', 'cursor.scrollToStep', 'cursor.clearNotes',
  'cursor.setNotes', 'cursor.setNoteProps', 'cursor.getNotes', 'ping'] as const;
export function verifyCapacityMethods(value: Wire): void {
  assert.equal(value.runtimeProfile, 'phase-8-probe-v1'); assert(Array.isArray(value.methods));
  assert.deepEqual(CAPACITY_METHODS.filter(method => !(value.methods as string[]).includes(method)), []);
}
function measure(value: unknown, field: string): number {
  assert(typeof value === 'number' && Number.isFinite(value) && value >= 0, `invalid measurement: ${field}`); return value;
}
/** Keep raw defaults from the original channel 15 note. */
export function capacityExpectedNotes(template: ShadowNote, count: number): Note[] {
  assert.equal(template.channel, 15); assert.equal(template.fields.pressure, 0); assert(Number.isSafeInteger(count) && count > 0 && count <= LIMIT + 1);
  return Array.from({ length: count }, (_, coordinate) => {
    const note = { ...structuredClone(template), cell: Math.floor(coordinate / 128), pitch: coordinate % 128, fields: { ...template.fields } };
    applyExpectedProps(note, { velocity: 100 / 127, duration: GRID }); return note;
  });
}
export function verifyCapacityStatus(value: Wire): void {
  assert.equal(value.instrumentationRevision, MUTATION_MARKER); assert.equal(value.complete, false); assert.equal(value.eligible, false);
  assert.equal(value.callbackSourceIdentityKnown, false); assert.equal(value.stepDataObservers, 3); assert.equal(value.totalExperimentalStepDataObservers, 6);
  assert.equal(value.residentHandles, 2); assert.equal(value.authorityHandles, 1); assert.equal(value.observerKind, 'addStepDataObserver');
  assert.equal(value.physicalHintOverflow, false); assert(measure(value.physicalPendingHints, 'physicalPendingHints') <= LIMIT);
  assert(measure(value.pendingCoordinates, 'pendingCoordinates') <= LIMIT); assert(measure(value.pendingWorkItemsIncludingPhysicalHints, 'pendingWorkItemsIncludingPhysicalHints') <= LIMIT);
}
/** The literal clip reason is unavailable on v5. Retain the source-backed inference separately. */
export function verifyCapacityOverflow(value: Wire): void {
  assert.equal(value.label, 'occupied-2049'); assert.deepEqual(value.request, { channel: 15, notes: [[16, 0, 100, GRID]] });
  assert.equal((value.action as Wire).written, 1); assert.equal(value.inferredLimitFamily, 'occupied-coordinates-per-clip');
  assert.equal(value.literalClipReasonAvailable, false); assert.equal(typeof value.rawPublicReason, 'string');
  const statuses = value.statuses as Wire[]; assert(statuses.length > 0); for (const status of statuses) verifyCapacityStatus(status);
  const final = statuses.at(-1)!; assert.equal(final.cacheModelHealth, 'overflow'); assert.equal(final.health, 'overflow');
  assert.equal(final.resident, 0); assert.equal(final.occupiedCoordinates, 0); assert.equal(final.pendingCoordinates, 0);
  assert.equal(final.physicalPendingHints, 0); assert.equal(value.rawPublicReason, final.reason);
  for (const refusal of value.refusals as Wire[]) {
    assert.equal(refusal.complete, false); assert.equal(refusal.eligible, false); assert.equal(refusal.authorityAvailable, false);
    assert.equal(refusal.readMode, 'refuse'); assert.equal(refusal.fallbackPerformed, false); assert.equal(refusal.resident, 0);
    assert.equal(refusal.phase, final.phase); assert(typeof refusal.phase === 'string');
    assert(!refusal.diagnosticSnapshot && !refusal.authorityNotes); assert(!Object.hasOwn(refusal, 'scanProgressCoordinates'));
  }
  assert.equal((value.refusals as Wire[]).length, 2);
  assert.deepEqual(value.historicalComparisons, (value.refusals as Wire[]).map(refusal => refusal.comparison ?? null));
}
export function verifyCapacityReport(report: Wire): number {
  assert.equal(report.marker, MUTATION_MARKER); assert.equal(report.researchOnly, true); assert.equal(report.complete, false); assert.equal(report.eligible, false);
  assert.equal(report.callbackOriginProved, false); assert.equal(report.fixtureRestored, true); assert.equal(typeof report.ended, 'string'); assert(!report.error && !report.cleanupError);
  verifyCapacityMethods(report.methods as Wire); assert.deepEqual(report.finalTrackIds, report.baselineTrackIds); assert.equal(report.finalScenes, report.baselineScenes);
  assert.deepEqual(report.finalRootEndpoint, report.initialRootEndpoint);
  const ping = report.ping as Wire; assert.equal((ping.samplesMs as number[]).length, 25); assert(measure(ping.p95Ms, 'pingP95Ms') <= 50);
  verifyMutationRegistry((report.initialInventory as Wire).result as Wire); verifyMutationRegistry((report.cleanupInventory as Wire).result as Wire);
  const before = report.baselines as Wire[], after = report.restoration as Wire[]; assert.equal(before.length, 3); assert.equal(after.length, 3);
  const id = String(report.ownedTrackId), originals = before.map((value, row) => {
    const result = value.result as Wire, notes = (result.diagnosticSnapshot as ShadowCacheWireSnapshot).notes;
    assert.deepEqual(checkExpectedFixture(notes, row), []); assert.deepEqual(checkMutationComparison(result, row, id, notes), []);
    for (const note of notes) { assert.equal(note.fields.pressure, 0); assert(ACQUIRED_FIELDS.every(field => Object.hasOwn(note.fields, field))); }
    return notes;
  });
  const template = originals[0]!.find(note => note.channel === 15)!; assert(template);
  const clearStatuses = report.clearStatuses as Wire[]; assert(clearStatuses.length > 0); for (const value of clearStatuses) verifyCapacityStatus(value);
  const cleared = clearStatuses.at(-1)!; assert.equal(cleared.occupiedCoordinates, 0); assert.equal(cleared.physicalPendingHints, 0); assert.equal(cleared.pendingCoordinates, 0);
  const cases = report.cases as Wire[]; assert.deepEqual(cases.map(value => value.count), CAPACITY_COUNTS);
  let written = 0;
  for (const value of cases) {
    const count = Number(value.count), expected = capacityExpectedNotes(template, count); assert.equal(value.label, `occupied-${count}`);
    const batches = value.batches as Wire[]; assert(batches.length > 0);
    for (const batch of batches) {
      const inputs = batch.notes as number[][]; assert(inputs.length > 0 && inputs.length <= 1024);
      assert.deepEqual(inputs, Array.from({ length: inputs.length }, (_, offset) => [Math.floor((written + offset) / 128), (written + offset) % 128, 100, GRID]));
      assert.equal((batch.action as Wire).written, inputs.length); written += inputs.length;
      const statuses = batch.statuses as Wire[]; assert(statuses.length > 0); for (const status of statuses) verifyCapacityStatus(status);
      const drained = statuses.at(-1)!; assert.equal(drained.physicalPendingHints, 0); assert.equal(drained.pendingCoordinates, 0); assert.equal(drained.occupiedCoordinates, written);
    }
    assert.equal(written, count); verifyCapacityStatus(value.status as Wire);
    assert.equal((value.status as Wire).occupiedCoordinates, count); assert.equal((value.status as Wire).pendingCoordinates, 0);
    assert.equal((value.status as Wire).physicalPendingHints, 0); assert.equal((value.status as Wire).cacheModelHealth, 'complete');
    assert.deepEqual(checkMutationComparison(value.result as Wire, 0, id, expected), []);
    const baselineMetadata = ((before[0]!.result as Wire).diagnosticSnapshot as ShadowCacheWireSnapshot).metadata;
    assert.deepEqual((value.result as Wire).authorityMetadata, baselineMetadata);
    const metrics = value.metrics as Wire; for (const field of ['recorderEstimatedBytes', 'physicalHintRecorderEstimatedBytes', 'retainedSnapshotEstimatedBytes', 'snapshotPayloadEstimatedBytes',
      'membershipGetStepCalls', 'authorityGetStepCalls', 'enrichmentGetStepCalls', 'membershipHostWorkMs', 'authorityHostWorkMs', 'enrichmentHostWorkMs', 'wallMs', 'calls', 'responseBytes']) measure(metrics[field], field);
    assert.equal(metrics.serializedBytesAreMemoryMeasurement, false); assert.equal((value.status as Wire).physicalBindingRevision, report.warmBindingRevision);
    assert.equal(metrics.recorderEstimatedBytes, 256 + 56 * count);
    const census = metrics.domainObjects as Wire; assert(census);
    for (const [field, amount] of Object.entries(census)) measure(amount, field);
    assert.equal(census.occupiedCoordinateEntries, count); assert.equal(census.occupiedNoteLists, count); assert.equal(census.membershipNoteRecords, count);
    assert.equal(census.dirtyCoordinateEntries, 0); assert.equal(census.retainedNoteRecords, count); assert.equal(census.retainedFieldEntries, count * ACQUIRED_FIELDS.length);
    assert.equal(metrics.domainObjectsAreLogicalCounts, true);
  }
  verifyCapacityOverflow(report.overflow as Wire);
  for (const [row, value] of after.entries()) {
    assert.deepEqual(checkMutationComparison(value.result as Wire, row, id, originals[row]!), []);
    assert.deepEqual((value.result as Wire).authorityMetadata, (before[row]!.result as Wire).authorityMetadata);
  }
  return cases.length + 1;
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
  const baselineTrackIds = (await tracks()).map(value => value.channelId); assert.deepEqual([...baselineTrackIds].sort(), [...state.baselineIds, state.ownedTrackId].sort());
  assert.equal(await scenes(), state.baselineScenes); const root = identityEndpoint(await shadow('rootSnapshot'), state.ownedTrackId);
  const methods = await request('rig.methods'); verifyCapacityMethods(methods); const initial = await shadow('info'); verifyCapacityStatus(initial);
  const report: Wire = { marker: MUTATION_MARKER, researchOnly: true, complete: false, eligible: false, callbackOriginProved: false,
    started: new Date().toISOString(), ownedTrackId: state.ownedTrackId, baselineTrackIds, baselineScenes: state.baselineScenes,
    initialRootEndpoint: root, methods, hello: await request('contract.hello'), initial, cases: [], baselines: [], restoration: [],
    assumption: 'New note defaults equal the original channel 15 defaults; exact field oracles must confirm this.' };
  await writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  let failed: unknown, mutated = false; const originals: (readonly ShadowNote[])[] = [];
  const save = async (): Promise<void> => { report.calls = calls; report.responseBytes = responseBytes; await writeFile(output, JSON.stringify(report, null, 2) + '\n'); };
  const guard = async (): Promise<void> => { assert.deepEqual((await tracks()).map(value => value.channelId), baselineTrackIds); assert.equal(await scenes(), state.baselineScenes);
    await owned(state.ownedTrackId); assert.deepEqual(identityEndpoint(await shadow('rootSnapshot'), state.ownedTrackId), root); await guardWriter(state.ownedTrackId); };
  try {
    const pings: number[] = []; for (let i = 0; i < 25; i++) { const start = performance.now(); await request('ping'); pings.push(performance.now() - start); }
    pings.sort((a, b) => a - b); report.ping = { samplesMs: pings, p95Ms: pings[23] }; assert(pings[23]! <= 50); await shadow('ping', { p95Ms: pings[23] });
    report.initialInventory = await registry('inventory');
    for (let row = 0; row < 3; row++) { await bind(state.ownedTrackId, row); await drain([]); const result = await compare();
      const notes = (result.diagnosticSnapshot as ShadowCacheWireSnapshot).notes; assert.deepEqual(checkExpectedFixture(notes, row), []);
      for (const note of notes) { assert.equal(note.fields.pressure, 0); assert(ACQUIRED_FIELDS.every(field => Object.hasOwn(note.fields, field))); }
      assert.deepEqual(checkMutationComparison(result, row, state.ownedTrackId, notes), []); originals.push(structuredClone(notes));
      (report.baselines as Wire[]).push({ row, result }); await save(); }
    const template = originals[0]!.find(note => note.channel === 15)!; assert(template);
    await bind(state.ownedTrackId, 0); await drain([]);
    await pointWriter(state.ownedTrackId, 0); await guard(); mutated = true; await request('cursor.clearNotes', { cursor: 'fine' }); await wait(200);
    report.clearStatuses = []; await drain(report.clearStatuses as Wire[]); report.warmBindingRevision = (await shadow('status', { index: 0 })).physicalBindingRevision;
    let filled = 0;
    for (const count of CAPACITY_COUNTS) {
      const before = await shadow('info'), started = performance.now(), beforeCalls = calls, beforeBytes = responseBytes;
      const value: Wire = { label: `occupied-${count}`, count, batches: [] }; (report.cases as Wire[]).push(value); await save();
      while (filled < count) { await guard(); const size = Math.min(1024, count - filled);
        const notes = Array.from({ length: size }, (_, offset) => [Math.floor((filled + offset) / 128), (filled + offset) % 128, 100, GRID]);
        const batch: Wire = { channel: 15, notes, statuses: [] }; (value.batches as Wire[]).push(batch); await save();
        batch.action = await request('cursor.setNotes', { cursor: 'fine', channel: 15, notes }); await wait(200);
        const drained = await drain(batch.statuses as Wire[]); filled += size; assert.equal(drained.occupiedCoordinates, filled); await save(); }
      value.result = await compare(); const result = value.result as Wire; assert.deepEqual(checkMutationComparison(result, 0, state.ownedTrackId, capacityExpectedNotes(template, count)), []);
      value.status = await shadow('status', { index: 0 }); const after = value.status as Wire;
      const metrics: Wire = { wallMs: performance.now() - started, calls: calls - beforeCalls, responseBytes: responseBytes - beforeBytes,
        serializedBytesAreMemoryMeasurement: false, snapshotPayloadEstimatedBytes: (result.diagnosticSnapshot as Wire).payloadEstimatedBytes,
        domainObjects: after.domainObjects, domainObjectsAreLogicalCounts: true };
      for (const field of ['membershipGetStepCalls', 'authorityGetStepCalls', 'enrichmentGetStepCalls', 'membershipHostWorkMs', 'authorityHostWorkMs', 'enrichmentHostWorkMs']) metrics[field] = measure(after[field], field) - measure(before[field], field);
      for (const field of ['recorderEstimatedBytes', 'physicalHintRecorderEstimatedBytes', 'retainedSnapshotEstimatedBytes']) metrics[field] = measure(after[field], field);
      value.metrics = metrics; await save(); console.log(JSON.stringify({ count, comparison: 'match', wallMs: metrics.wallMs }));
    }
    await guard(); const overflow: Wire = { label: 'occupied-2049', request: { channel: 15, notes: [[16, 0, 100, GRID]] }, statuses: [],
      inferredLimitFamily: 'occupied-coordinates-per-clip', literalClipReasonAvailable: false };
    report.overflow = overflow; await save(); overflow.action = await request('cursor.setNotes', { cursor: 'fine', ...(overflow.request as Wire) }); await wait(200);
    const final = await drain(overflow.statuses as Wire[]); overflow.rawPublicReason = final.reason;
    overflow.refusals = [await shadow('read', { index: 0 }), await shadow('compareStart', { index: 0 })];
    overflow.historicalComparisons = (overflow.refusals as Wire[]).map(value => value.comparison ?? null); verifyCapacityOverflow(overflow); await save();
  } catch (error) { failed = error; report.error = String(error); await save(); }
  finally {
    try { await shadow('retire', { index: 0 }); await shadow('retire', { index: 1 });
      if (mutated) await restoreA(state.ownedTrackId, originals[0]!, guard);
      report.cleanupInventory = await registry('rebuild');
      for (let row = 0; row < originals.length; row++) { await bind(state.ownedTrackId, row); await drain([]); const result = await compare();
        assert.deepEqual(checkMutationComparison(result, row, state.ownedTrackId, originals[row]!), []);
        assert.deepEqual(result.authorityMetadata, ((report.baselines as Wire[])[row]!.result as Wire).authorityMetadata);
        (report.restoration as Wire[]).push({ row, result }); await save(); }
      assert.equal(originals.length, 3); report.finalTrackIds = (await tracks()).map(value => value.channelId); report.finalScenes = await scenes();
      report.finalRootEndpoint = identityEndpoint(await shadow('rootSnapshot'), state.ownedTrackId); report.fixtureRestored = true;
      await pointWriter(state.ownedTrackId, 0);
    } catch (error) { report.cleanupError = String(error); if (!failed) failed = error; }
    await shadow('retire', { index: 0 }); await shadow('retire', { index: 1 }); await shadow('exactCancel', { reason: 'capacity-ended' });
    report.ended = new Date().toISOString(); await save();
  }
  if (failed) throw failed; console.log(`Occupied capacity verifies ${verifyCapacityReport(report)} controls. No eligibility is claimed.`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  void (process.argv[2] === 'verify' ? readFile(process.argv[3] ?? CAPACITY_OUTPUT, 'utf8').then(value => console.log(`Verified ${verifyCapacityReport(JSON.parse(value) as Wire)} occupied controls.`))
    : (assert.equal(process.argv[2], 'run'), run(process.argv[3] ?? CAPACITY_OUTPUT))).catch(error => { console.error(error); process.exitCode = 1; }).finally(() => bridge.disconnect());
