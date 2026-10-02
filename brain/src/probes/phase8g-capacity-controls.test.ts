import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { ACQUIRED_FIELDS, MUTATION_MARKER } from './phase8g-shadow-mutations.js';
import { CAPACITY_COUNTS, CAPACITY_METHODS, capacityExpectedNotes, verifyCapacityMethods, verifyCapacityOverflow,
  verifyCapacityReport, verifyCapacityStatus } from './phase8g-capacity-controls.js';
import type { ShadowNote } from './phase8g-shadow-cache-lib.js';
type Wire = Record<string, unknown>;

const fields = Object.fromEntries(ACQUIRED_FIELDS.map(field => [field, field.startsWith('is') ? true : field === 'occurrence' ? 'ALWAYS' : 0]));
Object.assign(fields, { chance: 1, isMuted: false, rawTimbre: 0, timbre: .5, duration: 2 / 512, durationCells: 2, rawDuration: 2 / 512,
  velocity: 95 / 127, releaseVelocity: 100 / 127, recurrenceLength: 1, recurrenceMask: 1 });
const template: ShadowNote = { channel: 15, cell: 0, pitch: 60, fields };
const status = { instrumentationRevision: MUTATION_MARKER, complete: false, eligible: false, callbackSourceIdentityKnown: false,
  stepDataObservers: 3, totalExperimentalStepDataObservers: 6, residentHandles: 2, authorityHandles: 1, observerKind: 'addStepDataObserver',
  physicalHintOverflow: false, physicalPendingHints: 0, pendingCoordinates: 0, pendingWorkItemsIncludingPhysicalHints: 0 };
const registry = { rebuildTerminal: true, registryPublished: true, complete: false, eligible: false,
  inventoryRebuild: { phase: 'published', terminal: true, registryPublished: true, fullInventoryEnumerated: true, membershipComplete: false, complete: false, eligible: false } };
function comparison(row: number, notes: readonly ShadowNote[]): Wire {
  const coverage = { startCell: 0, width: 2048, allChannels: true, fields: [...ACQUIRED_FIELDS], unsupportedFields: ['portableRepeat', 'articulation'], timingBasis: '1/512-beat' };
  const metadata = { name: `gn-8g-reuse-${['A', 'B', 'empty'][row]}`, exists: true, length: 4 };
  const snapshot = { clipRef: 'clip', address: { trackId: 'owned', row }, token: { initDomain: 'controller-one', project: 1, structure: 1, binding: 1, rebuild: 1 },
    contentGeneration: 1, invalidationSequence: 0, coverage, metadata, notes, fingerprint: 'notes', payloadEstimatedBytes: 100 };
  return { ...status, comparison: 'match', authorityAvailable: true, contentComparisonComplete: true,
    diagnosticSnapshot: snapshot, authorityNotes: notes, authorityMetadata: metadata, authorityCoverage: coverage };
}
function overflow(): Wire {
  return { label: 'occupied-2049', request: { channel: 15, notes: [[16, 0, 100, 1 / 512]] }, action: { written: 1 },
    inferredLimitFamily: 'occupied-coordinates-per-clip', literalClipReasonAvailable: false, rawPublicReason: 'working-set-partial',
    statuses: [{ ...status, cacheModelHealth: 'overflow', health: 'overflow', resident: 0, phase: 'complete', occupiedCoordinates: 0, reason: 'working-set-partial' }],
    historicalComparisons: ['match', 'match'],
    refusals: [0, 1].map(() => ({ ...status, comparison: 'match', authorityAvailable: false, readMode: 'refuse', fallbackPerformed: false, resident: 0, phase: 'complete' })) };
}
function report(): Wire {
  const originalA = Array.from({ length: 16 }, (_, channel) => ({ ...structuredClone(template), channel }));
  originalA[0] = { ...originalA[0]!, fields: { ...fields, chance: .375, isChanceEnabled: false, rawTimbre: -.5, timbre: .25 } };
  const originals = [originalA, [0, 15].map(channel => ({ ...structuredClone(template), channel, cell: 1024, pitch: 72 })), []];
  const baselines = originals.map((notes, row) => ({ row, result: comparison(row, notes) }));
  let previous = 0;
  const cases = CAPACITY_COUNTS.map(count => {
    const notes = capacityExpectedNotes(template, count), from = previous;
    const inputs = notes.slice(from).map(note => [note.cell, note.pitch, 100, 1 / 512]); previous = count;
    const drained = { ...status, occupiedCoordinates: count, cacheModelHealth: 'complete', physicalBindingRevision: 7 };
    const metrics = Object.fromEntries(['physicalHintRecorderEstimatedBytes', 'retainedSnapshotEstimatedBytes', 'snapshotPayloadEstimatedBytes', 'membershipGetStepCalls',
      'authorityGetStepCalls', 'enrichmentGetStepCalls', 'membershipHostWorkMs', 'authorityHostWorkMs', 'enrichmentHostWorkMs', 'wallMs', 'calls', 'responseBytes'].map(field => [field, 1]));
    return { label: `occupied-${count}`, count, batches: [{ notes: inputs, action: { written: inputs.length }, statuses: [drained] }],
      result: comparison(0, notes), status: drained, metrics: { ...metrics, recorderEstimatedBytes: 256 + 56 * count, serializedBytesAreMemoryMeasurement: false,
        domainObjectsAreLogicalCounts: true, domainObjects: { occupiedCoordinateEntries: count, occupiedNoteLists: count, membershipNoteRecords: count,
          dirtyCoordinateEntries: 0, retainedNoteRecords: count, retainedFieldEntries: count * ACQUIRED_FIELDS.length } } };
  });
  return { marker: MUTATION_MARKER, researchOnly: true, complete: false, eligible: false, callbackOriginProved: false, fixtureRestored: true,
    ended: '2026-10-01', ownedTrackId: 'owned', baselineTrackIds: ['owned'], finalTrackIds: ['owned'], baselineScenes: 8, finalScenes: 8,
    initialRootEndpoint: {}, finalRootEndpoint: {}, methods: { runtimeProfile: 'phase-8-probe-v1', methods: [...CAPACITY_METHODS] },
    ping: { samplesMs: Array(25).fill(1), p95Ms: 1 }, initialInventory: { result: registry }, cleanupInventory: { result: registry },
    baselines, restoration: structuredClone(baselines), clearStatuses: [{ ...status, occupiedCoordinates: 0 }], warmBindingRevision: 7, cases, overflow: overflow() };
}

test('capacity writes use active methods and never acquire track or scene mutation routes', async () => {
  const golden = JSON.parse(await readFile(new URL('../../../extension/methods.probe.golden.json', import.meta.url), 'utf8')) as { identity: string; methods: string[] };
  verifyCapacityMethods({ runtimeProfile: golden.identity, methods: golden.methods });
  assert(!CAPACITY_METHODS.some(method => String(method) === 'track.delete' || String(method) === 'scene.delete'));
  assert.throws(() => verifyCapacityMethods({ runtimeProfile: golden.identity, methods: golden.methods.filter(method => method !== 'cursor.getNotes') }));
});

test('dense coordinates, setter units and raw defaults remain independent of callback counts', () => {
  const expected = capacityExpectedNotes(template, 2048); assert.equal(expected.length, 2048);
  assert.equal(new Set(expected.map(note => `${note.cell}:${note.pitch}`)).size, 2048); assert.equal(expected.at(-1)!.cell, 15); assert.equal(expected.at(-1)!.pitch, 127);
  assert.deepEqual(capacityExpectedNotes(template, 2049).at(-1), { ...expected[0], cell: 16, pitch: 0 });
  assert.equal(expected[0]!.fields.durationCells, 1); assert.equal(expected[0]!.fields.duration, 1 / 512); assert.equal(expected[0]!.fields.velocity, 100 / 127);
  assert.equal(expected[0]!.fields.releaseVelocity, template.fields.releaseVelocity); assert.equal(expected[0]!.fields.rawGain, template.fields.rawGain);
  assert.throws(() => capacityExpectedNotes({ ...template, fields: { ...fields, pressure: .5 } }, 2048));
});

test('occupied overflow refuses physical backpressure and preserves the literal public reason', () => {
  verifyCapacityOverflow(overflow());
  const wrong = overflow(); (wrong.statuses as Wire[])[0]!.physicalHintOverflow = true; assert.throws(() => verifyCapacityOverflow(wrong));
  assert.throws(() => verifyCapacityOverflow({ ...overflow(), literalClipReasonAvailable: true }));
  assert.throws(() => verifyCapacityOverflow({ ...overflow(), request: { channel: 15, notes: [[0, 0, 100, 1 / 512]] } }));
  assert.throws(() => verifyCapacityOverflow({ ...overflow(), rawPublicReason: 'clip-density-limit' }));
  const stale = overflow(); (stale.refusals as Wire[])[0]!.authorityNotes = []; assert.throws(() => verifyCapacityOverflow(stale));
  const pending = overflow(); (pending.refusals as Wire[])[0]!.scanProgressCoordinates = 0; assert.throws(() => verifyCapacityOverflow(pending));
});

test('counts need a finite bounded queue and the same six registered observers', () => {
  verifyCapacityStatus(status);
  for (const changed of [{ eligible: true }, { totalExperimentalStepDataObservers: 7 }, { pendingCoordinates: 2049 },
    { physicalPendingHints: null }, { pendingWorkItemsIncludingPhysicalHints: NaN }, { observerKind: 'addNoteStepObserver' }]) assert.throws(() => verifyCapacityStatus({ ...status, ...changed }));
});

test('the retained corpus requires all equality controls, sparse estimates, field oracles and restoration', () => {
  const value = report(); assert.equal(verifyCapacityReport(value), 4);
  for (const changed of [{ cases: (value.cases as Wire[]).slice(1) }, { fixtureRestored: false }, { finalScenes: 9 },
    { finalRootEndpoint: { changed: true } }, { marker: 'old' }, { restoration: [] }, { ping: { samplesMs: Array(25).fill(1), p95Ms: 51 } }]) {
    assert.throws(() => verifyCapacityReport({ ...value, ...changed }));
  }
  const census = structuredClone(value); (((census.cases as Wire[])[2]!.metrics as Wire).domainObjects as Wire).membershipNoteRecords = 2047; assert.throws(() => verifyCapacityReport(census));
  const wrong = structuredClone(value), first = (wrong.cases as Wire[])[0]!, result = first.result as Wire;
  const wrongNotes = structuredClone(result.authorityNotes as ShadowNote[]); wrongNotes[0] = { ...wrongNotes[0]!, fields: { ...wrongNotes[0]!.fields, chance: .5 } };
  result.authorityNotes = wrongNotes; (result.diagnosticSnapshot as Wire).notes = wrongNotes; assert.throws(() => verifyCapacityReport(wrong));
});
