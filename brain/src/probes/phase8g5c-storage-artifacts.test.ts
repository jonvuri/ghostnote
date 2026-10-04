import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { gzipSync } from 'node:zlib';
import { allocationDiagnostic, fixtureBaseline, pinned, verifyStorageArtifacts } from './phase8g5c-storage-artifacts.js';
import type { Wire } from './phase8g5c-storage-lib.js';
const root = new URL('../../../context/evidence/data/phase8g5c-storage/', import.meta.url);
test('pinned storage evidence recomputes without a scale acceptance claim', async () => {
  const result = await verifyStorageArtifacts();
  assert.equal(result.populatedScaleAccepted, false); assert.equal(result.combinedStorageAccepted, false);
  assert.equal(result.complete, false); assert.equal(result.eligible, false);
  assert.equal(result.sessionWorkComplete, true);
  const zero = (result.arms as Wire[]).find(arm => arm.capacity === 0)!;
  assert.equal(zero.samples, 3);
  assert.deepEqual(zero.initializationMs, { minimum: 41.98, maximum: 125.414, median: 53.527 });
  const sixteen = (result.arms as Wire[]).find(arm => arm.capacity === 16)!;
  assert(Number(sixteen.samples) >= 1);
  assert(Number((sixteen.topologyConstructionMs as Wire).minimum) >= 0);
  assert(Number((sixteen.membershipReadMs as Wire).minimum) >= 0);
  const counted = (result.countedArms as Wire[]).find(arm => arm.capacity === 512)!;
  assert.equal(counted.samples, 3);
  assert.deepEqual(counted.initializationMs, { minimum: 56.438, maximum: 99.537, median: 67.064 });
  assert.deepEqual(counted.topologyConstructionMs, { minimum: 3.728208, maximum: 7.028791, median: 4.525041 });
  assert.equal(result.counted512EmptyMeasured, true); assert.equal(result.emptyAllocationArmsMeasured, false);
  const countedZero = (result.countedArms as Wire[]).find(arm => arm.capacity === 0)!;
  assert.equal(countedZero.samples, 3);
  assert.deepEqual(countedZero.initializationMs, { minimum: 34.161, maximum: 36.017, median: 35.179 });
  assert.equal(result.countedControlMeasured, true);
  for (const flag of ['flatPopulationVerified', 'flatEmptyOccupancyMeasured', 'flatEndTrackNotesMatched', 'wideChangeArmed'])
    assert.equal(result[flag], true);
  assert.equal(result.wideGroupChecksPassed, true); assert.equal(result.nestedChangeArmed, true);
  assert.equal(result.nestedGroupChecksPassed, true); assert.equal(result.boundaryMoveArmed, true);
  assert.equal(result.boundaryMoveChecksPassed, true); assert.equal(result.collapseChangeArmed, true);
  assert.equal(result.collapsedTopologyAndOccupancyPassed, true); assert.equal(result.collapsedPrimaryBindingRefused, true);
  assert.equal(result.expansionChangeArmed, true); assert.equal(result.collapsedBindingDiagnostics, 1);
  assert.equal(result.expandedRecoveryPassed, true); assert.equal(result.ungroupChangeArmed, true);
  assert.equal(result.flatFixtureRestoredFor512, true);
  for (const flag of ['population512Verified', 'boundary512ChecksPassed', 'excess512AndRecoveryPassed', 'populatedColdReloadPrepared'])
    assert.equal(result[flag], true);
  const populated = (result.countedPopulatedArms as Wire[]).find(arm => arm.capacity === 512)!;
  assert.equal(populated.samples, 3); assert.equal(result.populatedColdSamples, 3);
  assert.equal(result.populatedColdMeasured, true);
  assert.deepEqual(populated.initializationMs, { minimum: 38.671, maximum: 131.9, median: 50.512 });
  assert.deepEqual(populated.topologyConstructionMs, { minimum: 3.200541, maximum: 6.545, median: 4.297542 });
});
test('compressed evidence pins both archive bytes and the exact raw capture bytes', () => {
  const raw = readFileSync(new URL('new8-baseline.json', root)), bytes = gzipSync(raw);
  const record = { file: 'baseline.json.gz', bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'),
    uncompressedBytes: raw.length, uncompressedSha256: createHash('sha256').update(raw).digest('hex') };
  assert.deepEqual(pinned(bytes, record), JSON.parse(raw.toString()));
  assert.throws(() => pinned(bytes, { ...record, uncompressedBytes: raw.length - 1 }));
  assert.throws(() => pinned(bytes, { ...record, uncompressedSha256: '0'.repeat(64) }));
});
test('a changed pin or a false empty fixture refuses', () => {
  const bytes = readFileSync(new URL('new8-baseline.json', root));
  const record = { file: 'new8-baseline.json', bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  const baseline = pinned(bytes, record);
  assert.throws(() => pinned(Buffer.concat([bytes, Buffer.from(' ')]), record));
  assert.throws(() => pinned(bytes, { ...record, sha256: '0'.repeat(64) }));
  const sample = JSON.parse(readFileSync(new URL('empty-0-2.json', root), 'utf8')) as Wire;
  fixtureBaseline(baseline, sample);
  for (const mutate of [
    (value: Wire) => { value.project = 'New 3'; },
    (value: Wire) => { for (const key of ['first', 'second']) ((value[key] as Wire).scan as Wire).slotsWithContent = 1; },
    (value: Wire) => { for (const key of ['first', 'second']) ((value[key] as Wire).scan as Wire).itemCount = 513; },
    (value: Wire) => { value.second = {}; },
    (value: Wire) => { value.eligible = true; },
  ]) {
    const changed = structuredClone(baseline); mutate(changed); assert.throws(() => fixtureBaseline(changed, sample));
  }
});
test('the refused format check is retained without counting another initialization', async () => {
  const report = JSON.parse(readFileSync(new URL('counted-empty-512-1-diagnostic.json', root), 'utf8')) as Wire;
  allocationDiagnostic(report);
  for (const mutate of [
    (value: Wire) => { value.error = 'other failure'; },
    (value: Wire) => { value.processBefore = {}; },
    (value: Wire) => { value.eligible = true; },
    (value: Wire) => { ((value.before as Wire).topology as Wire).bankTrackHandles = 262656; },
  ]) {
    const changed = structuredClone(report); mutate(changed); assert.throws(() => allocationDiagnostic(changed));
  }
  const result = await verifyStorageArtifacts(); assert.equal(result.diagnostics, 8); assert.equal(result.allocationDiagnostics, 1);
  assert.equal(result.combinedLedgerDiagnostics, 1); assert.equal(result.combinedWitnessReloadPrepared, true);
  assert.equal(result.combinedLiveBudgetPassed, true);
  assert.equal(result.capacityVerifierDiagnostics, 1);
  const counted = (result.countedArms as Wire[]).find(arm => arm.capacity === 512)!;
  assert(Number(counted.samples) >= 1); assert.equal(result.populatedScaleAccepted, false);
});
