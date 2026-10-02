import assert from 'node:assert/strict';
import test from 'node:test';
import { ACQUIRED_FIELDS, MUTATION_MARKER } from './phase8g-shadow-mutations.js';
import { memoryBatchNotes, memoryMatch, memoryRefusal, memoryWrittenProjection, SNAPSHOT_MEMORY_LIMIT } from './phase8g-snapshot-memory.js';
import type { ShadowNote } from './phase8g-shadow-cache-lib.js';
type Wire = Record<string, unknown>;
const fields = { ...Object.fromEntries(ACQUIRED_FIELDS.map(field => [field, field.startsWith('is') ? false : field === 'occurrence' ? 'ALWAYS' : 0])),
  pressure: 0, velocity: 100 / 127, duration: 1 / 512, rawDuration: 1 / 512, durationCells: 1, rawGain: 1, gain: 1, rawTimbre: 0, timbre: .5 };
function notes(count = 256): ShadowNote[] {
  return Array.from({ length: 16 }, (_, channel) => Array.from({ length: count }, (_, coordinate) => ({ channel,
    cell: Math.floor(coordinate / 128), pitch: coordinate % 128, fields: { ...fields } }))).flat();
}
const status = { instrumentationRevision: MUTATION_MARKER, complete: false, eligible: false, callbackSourceIdentityKnown: false,
  stepDataObservers: 3, totalExperimentalStepDataObservers: 6, residentHandles: 2, authorityHandles: 1, observerKind: 'addStepDataObserver',
  physicalHintOverflow: false, physicalPendingHints: 0, pendingCoordinates: 0, pendingWorkItemsIncludingPhysicalHints: 0 };
const coverage = { startCell: 0, width: 2048, allChannels: true, fields: [...ACQUIRED_FIELDS], unsupportedFields: ['portableRepeat', 'articulation'], timingBasis: '1/512-beat' };
const metadata = { name: 'gn-8g-reuse-A', playStart: 0, playStop: 4, loopStart: 0, loopLength: 4 };
function match(): Wire {
  const values = notes(); return { ...status, comparison: 'match', contentComparisonComplete: true, authorityAvailable: true,
    authorityNotes: structuredClone(values), authorityCoverage: coverage, authorityMetadata: metadata,
    diagnosticSnapshot: { clipRef: 'clip', address: { trackId: 'owned', row: 0 }, token: { initDomain: 'domain', project: 1, structure: 1, binding: 1, rebuild: 1 },
      contentGeneration: 1, invalidationSequence: 0, coverage, metadata, notes: values, fingerprint: 'snapshot', payloadEstimatedBytes: 8_430_000 } };
}
test('all channels contain 4096 and 8192 notes at 256 and 512 coordinates', () => {
  memoryWrittenProjection(notes(), 256); memoryWrittenProjection(notes(512), 512);
  const duplicate = notes(); duplicate[0] = duplicate[1]!; assert.throws(() => memoryWrittenProjection(duplicate, 256));
  for (const patch of [{ channel: 16 }, { pitch: 128 }, { cell: 2 }]) {
    const values = notes(); Object.assign(values[0]!, patch); assert.throws(() => memoryWrittenProjection(values, 256));
  }
});
test('written projection rejects missing or changed raw fields without assuming all channel defaults', () => {
  for (const patch of [{ velocity: .25 }, { durationCells: 2 }, { rawDuration: 2 / 512 }, { pressure: .5 }, { pan: Infinity }]) {
    const values = notes(); Object.assign(values[0]!.fields, patch); assert.throws(() => memoryWrittenProjection(values, 256));
  }
  const values = notes(); delete (values[0]!.fields as Wire).isChanceEnabled; assert.throws(() => memoryWrittenProjection(values, 256));
  const perChannel = notes(); (perChannel[256]!.fields as Wire).chance = .375; memoryWrittenProjection(perChannel, 256);
});
test('full normalized cache and independent authority comparison checks every acquired field', () => {
  memoryMatch(match(), 'owned', 256, metadata);
  const changed = match(); ((changed.authorityNotes as ShadowNote[])[500]!.fields as Wire).chance = .375;
  assert.throws(() => memoryMatch(changed, 'owned', 256, metadata));
  const omitted = match(); omitted.authorityNotes = (omitted.authorityNotes as ShadowNote[]).slice(1);
  assert.throws(() => memoryMatch(omitted, 'owned', 256, metadata));
});
test('snapshot refusal can retain valid independent authority while rejecting any current cache output', () => {
  const refusal = { ...status, comparison: 'snapshot-memory-budget', contentComparisonComplete: false, authorityAvailable: true, authorityNotes: notes(512) };
  assert.equal(memoryRefusal(refusal), 'snapshot-memory-budget'); memoryWrittenProjection(refusal.authorityNotes, 512);
  for (const patch of [{ diagnosticSnapshot: {} }, { authoritativeSnapshot: {} }, { historicalSnapshot: {} }, { comparison: 'pending' },
    { comparison: 'match' }, { complete: true }, { eligible: true }, { contentComparisonComplete: true }, { physicalHintOverflow: true }])
    assert.throws(() => memoryRefusal({ ...refusal, ...patch }));
});
test('earlier enrichment refusal stays an actual failed boundary outcome', () => {
  assert.equal(memoryRefusal({ ...status, comparison: 'enrichment-budget', authorityAvailable: true }), 'enrichment-budget');
  assert.equal(memoryRefusal({ ...status, comparison: 'authority-host-work-budget', authorityAvailable: false }), 'authority-host-work-budget');
});
test('each channel write has 256 coordinates and staging estimate stays below the selected limit', () => {
  const first = memoryBatchNotes(0), second = memoryBatchNotes(256); assert.equal(first.length, 256); assert.equal(second.length, 256);
  assert.deepEqual(first[0], [0, 0, 100, 1 / 512]); assert.deepEqual(first.at(-1), [1, 127, 100, 1 / 512]);
  assert.deepEqual(second[0], [2, 0, 100, 1 / 512]); assert.deepEqual(second.at(-1), [3, 127, 100, 1 / 512]);
  assert.throws(() => memoryBatchNotes(512)); assert(8192 * (160 + ACQUIRED_FIELDS.length * 64) < SNAPSHOT_MEMORY_LIMIT);
});
