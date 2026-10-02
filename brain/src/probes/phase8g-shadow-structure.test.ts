import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { ACQUIRED_FIELDS, MUTATION_MARKER } from './phase8g-shadow-mutations.js';
import { automaticStructureFence, checkStructureComparison, checkStructureSeed, STRUCTURE_LABELS, STRUCTURE_METHODS,
  STRUCTURE_UNSUPPORTED, settleStructureSeedChannel, verifyStructureMethods, verifyStructureReport } from './phase8g-shadow-structure.js';
import type { ShadowNote } from './phase8g-shadow-cache-lib.js';

type Wire = Record<string, unknown>;
const fields = Object.fromEntries(ACQUIRED_FIELDS.map(field => [field, field.startsWith('is') ? false : field === 'occurrence' ? 'ALWAYS' : 0]));
Object.assign(fields, { chance: .375, rawTimbre: -.5, timbre: .25, gain: 1.25, rawGain: 1.25, duration: 2 / 512, durationCells: 2, rawDuration: 2 / 512, velocity: 80 / 127 });
function note(channel: number, cell: number, pitch: number, velocity = 80, durationCells = 2): ShadowNote {
  return { channel, cell, pitch, fields: { ...fields, velocity: velocity / 127, durationCells, duration: durationCells / 512, rawDuration: durationCells / 512 } };
}
const a = { id: 'temp', row: 9, name: 'gn-8g-structure-A', notes: [note(0, 0, 60), note(0, 16, 76, 100, 4), note(15, 0, 60), note(15, 16, 76, 100, 4)] };
const b = { id: 'temp', row: 12, name: 'gn-8g-structure-B', notes: [note(7, 32, 72, 77, 9)] };
function comparison(target: typeof a): Wire {
  const coverage = { startCell: 0, width: 2048, allChannels: true, fields: [...ACQUIRED_FIELDS], unsupportedFields: ['portableRepeat', 'articulation'], timingBasis: '1/512-beat' };
  const metadata = { name: target.name, exists: true, length: 4 }, snapshot = { clipRef: 'clip', address: { trackId: target.id, row: target.row },
    token: { initDomain: 'controller-one', project: 1, structure: 1, binding: 1, rebuild: 1 }, contentGeneration: 1,
    invalidationSequence: 0, coverage, notes: target.notes, metadata, fingerprint: 'fields' };
  return { instrumentationRevision: MUTATION_MARKER, comparison: 'match', complete: false, eligible: false, callbackSourceIdentityKnown: false,
    contentComparisonComplete: true, authorityAvailable: true, stepDataObservers: 3, residentHandles: 2, observerKind: 'addStepDataObserver',
    physicalPendingHints: 0, pendingCoordinates: 0, physicalHintOverflow: false, diagnosticSnapshot: snapshot,
    authorityNotes: target.notes, authorityMetadata: metadata, authorityCoverage: coverage };
}
const refusal = { complete: false, eligible: false, comparison: 'unavailable', authorityAvailable: false,
  readMode: 'refuse', phase: 'retired', fallbackPerformed: false };
const registry = { rebuildTerminal: true, registryPublished: true, complete: false, eligible: false,
  inventoryRebuild: { phase: 'published', terminal: true, registryPublished: true, fullInventoryEnumerated: true, membershipComplete: false, complete: false, eligible: false } };
function report(): Wire {
  const original = [Array.from({ length: 16 }, (_, channel) => note(channel, 0, 60)), [note(0, 1024, 72), note(15, 1024, 72)], []];
  const before = original.map((notes, row) => ({ row, result: comparison({ id: 'original', row, name: `gn-8g-reuse-${['A', 'B', 'empty'][row]}`, notes }) }));
  const rows = [10, 11, 11, 9, 11, 11, 11, 10, 8, 8, 8, 8, 8, 0];
  const metrics = Object.fromEntries(['membershipGetStepCalls', 'authorityGetStepCalls', 'enrichmentGetStepCalls', 'membershipHostWorkMs', 'authorityHostWorkMs',
    'enrichmentHostWorkMs', 'recorderEstimatedBytes', 'physicalHintRecorderEstimatedBytes', 'retainedSnapshotEstimatedBytes'].map(field => [field, 1]));
  const cases = STRUCTURE_LABELS.map((label, index) => {
    const target = index === 13 ? { id: 'original', row: 0, name: 'gn-8g-reuse-A', notes: original[0]! }
      : { ...(index === 2 ? b : a), row: rows[index]!, id: index === 11 ? 'copy' : 'temp' };
    const start = { complete: false, eligible: false, projectGeneration: 1, structuralEpoch: 1 };
    const info = { ...start, structuralEpoch: 2 };
    return { label, before: start, automaticInfo: info, automaticStatus: info, automaticRead: refusal,
      automaticFence: automaticStructureFence(start, info, info, refusal), explicitBarrier: true, afterBarrierRead: refusal,
      rebuild: { result: registry }, target, result: comparison(target), wallMs: 1, outcome: 'recovery-match',
      metrics: { ...metrics, serializedBytesAreMemoryMeasurement: false } };
  });
  return { marker: MUTATION_MARKER, researchOnly: true, complete: false, eligible: false, structuralScopeComplete: false, callbackOriginProved: false,
    ended: '2026-10-01', fixtureRestored: true, temporaryFixturesRemoved: true, methods: { runtimeProfile: 'phase-8-probe-v1', methods: [...STRUCTURE_METHODS] },
    baselineTrackIds: ['original', 'baseline'], finalTrackIds: ['original', 'baseline'], baselineScenes: 8, finalScenes: 8,
    baselineSlotsBefore: [], baselineSlotsAfter: [], initialRootEndpoint: {}, finalRootEndpoint: {}, originalTrackId: 'original', originalBefore: before,
    originalAfter: structuredClone(before), fixtureBaselines: [{ target: a, result: comparison(a) }, { target: b, result: comparison(b) }],
    cases, unsupported: STRUCTURE_UNSUPPORTED, automaticFenceMissing: 0, automaticStructureAcceptanceComplete: true };
}

test('the structural driver uses active safe routes and keeps unavailable controls explicit', async () => {
  const golden = JSON.parse(await readFile(new URL('../../../extension/methods.probe.golden.json', import.meta.url), 'utf8')) as { identity: string; methods: string[] };
  verifyStructureMethods({ runtimeProfile: golden.identity, methods: golden.methods });
  assert(!STRUCTURE_METHODS.some(method => String(method) === 'branch.groupTrack' || String(method) === 'app.undo' || String(method) === 'app.invokeAction'));
  assert.equal(STRUCTURE_LABELS.length, 14); assert.equal(new Set(STRUCTURE_LABELS).size, 14);
  assert.deepEqual(STRUCTURE_UNSUPPORTED.map(value => value.label), ['scene-insert-before', 'scene-insert-at', 'group-topology']);
  assert.throws(() => verifyStructureMethods({ runtimeProfile: golden.identity, methods: golden.methods.filter(method => method !== 'slot.moveTo') }));
});

test('automatic fencing requires a changed generation and terminal refusal before the barrier', () => {
  const start = { complete: false, eligible: false, projectGeneration: 1, structuralEpoch: 1 }, changed = { ...start, structuralEpoch: 2 };
  assert.equal(automaticStructureFence(start, changed, changed, refusal).observed, true);
  assert.equal(automaticStructureFence(start, start, start, refusal).observed, false);
  assert.equal(automaticStructureFence(start, changed, changed, { ...refusal, phase: 'settled', scanProgressCoordinates: 0 }).observed, false);
  assert.equal(automaticStructureFence(start, changed, changed, { ...refusal, diagnosticSnapshot: {} }).observed, false);
  assert.throws(() => automaticStructureFence(start, { ...changed, eligible: true }, changed, refusal));
});

test('the seed oracle checks onset, duration, velocity, disabled chance and raw expression units', () => {
  checkStructureSeed(a, 'A'); checkStructureSeed(b, 'B');
  for (const changed of [{ chance: .75 }, { isChanceEnabled: true }, { rawTimbre: .5 }, { gain: .625 }, { velocity: .5 }, { durationCells: 10 }]) {
    const wrong = structuredClone(a); Object.assign(wrong.notes[0]!.fields, changed); assert.throws(() => checkStructureSeed(wrong, 'A'));
  }
  assert.throws(() => checkStructureSeed({ ...a, notes: a.notes.slice(1) }, 'A'));
});

test('equal wrong acquisitions fail against the full retained field oracle', () => {
  const value = comparison(a); checkStructureComparison(value, a);
  const wrong = structuredClone(a); wrong.notes[0] = { ...wrong.notes[0]!, fields: { ...wrong.notes[0]!.fields, releaseVelocity: .5 } };
  assert.throws(() => checkStructureComparison(comparison(wrong), a));
  assert.throws(() => checkStructureComparison({ ...value, eligible: true }, a));
  assert.throws(() => checkStructureComparison({ ...value, authorityCoverage: { ...(value.authorityCoverage as Wire), allChannels: false } }, a));
  assert.throws(() => checkStructureComparison(value, { ...a, id: 'different' }));
});

test('the retained verifier requires the full case sequence, ownership, recovery and unchanged baseline', () => {
  const value = report(); assert.equal(verifyStructureReport(value), 14);
  for (const changed of [{ cases: (value.cases as Wire[]).slice(1) }, { fixtureRestored: false }, { temporaryFixturesRemoved: false },
    { unsupported: [] }, { marker: 'old' }, { structuralScopeComplete: true }, { finalTrackIds: ['original'] },
    { finalScenes: 9 }, { finalRootEndpoint: { changed: true } }, { baselineSlotsAfter: [{ hasContent: true }] }]) {
    assert.throws(() => verifyStructureReport({ ...value, ...changed }));
  }
  const wrong = structuredClone(value); ((wrong.cases as Wire[])[0]!.target as Wire).id = 'baseline'; assert.throws(() => verifyStructureReport(wrong));
  const stale = structuredClone(value); (stale.cases as Wire[])[0]!.afterBarrierRead = { ...refusal, scanProgressCoordinates: 0 }; assert.throws(() => verifyStructureReport(stale));
});

test('missing automatic fences remain visible after successful explicit recovery', () => {
  const value = report(), first = (value.cases as Wire[])[0]!;
  first.automaticInfo = first.before; first.automaticStatus = first.before;
  first.automaticFence = automaticStructureFence(first.before as Wire, first.before as Wire, first.before as Wire, refusal);
  value.automaticFenceMissing = 1; value.automaticStructureAcceptanceComplete = false;
  assert.equal(verifyStructureReport(value), 14);
  assert.throws(() => verifyStructureReport({ ...value, automaticFenceMissing: 0 }));
});

test('field setters wait for exact note-on readback and then wait for raw field settlement', async () => {
  const events: string[] = [], inputs = [[0, 60, 80, 2 / 512]]; let onsets = 0, fieldsRead = 0;
  const result = await settleStructureSeedChannel(inputs, async () => { events.push('onsets'); return { notes: ++onsets === 1 ? [] : inputs }; },
    async () => { events.push('apply'); assert.equal(onsets, 2); return [{ applied: { chance: 'ok', isChanceEnabled: 'ok', timbre: 'ok', gain: 'ok' } }]; },
    async () => { events.push('fields'); return { notes: [{ x: 0, y: 60, chance: ++fieldsRead === 1 ? 1 : .375, isChanceEnabled: false, timbre: -.5, gain: 1.25 }] }; });
  assert.deepEqual(events, ['onsets', 'onsets', 'apply', 'fields', 'fields']); assert(result.settled);
});

test('a historical match label cannot replace the current retired refusal or claim acquired output', () => {
  const value = report(); const first = (value.cases as Wire[])[0]!, read = { ...refusal, comparison: 'match' };
  first.automaticRead = read; first.afterBarrierRead = read;
  first.automaticFence = automaticStructureFence(first.before as Wire, first.automaticInfo as Wire, first.automaticStatus as Wire, read);
  assert.equal((first.automaticFence as Wire).observed, true); assert.equal((first.automaticFence as Wire).historicalComparison, 'match');
  assert.equal(verifyStructureReport(value), 14);
  for (const changed of [{ readMode: 'exact-fallback' }, { authorityAvailable: true }, { phase: 'settled' },
    { diagnosticSnapshot: {} }, { authorityNotes: [] }, { scanProgressCoordinates: 1 }]) {
    assert.equal(automaticStructureFence(first.before as Wire, first.automaticInfo as Wire, first.automaticStatus as Wire, { ...read, ...changed }).observed, false);
  }
});
