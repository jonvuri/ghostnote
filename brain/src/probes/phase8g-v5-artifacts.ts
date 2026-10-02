/** Retain and verify v5 diagnostic evidence. Session completion stays unproved. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';
import { verifyCacheAcceptance } from './phase8g-cache-acceptance.js';
import { checkMutationComparison, MUTATION_MARKER, verifyMutationReport } from './phase8g-shadow-mutations.js';
import { checkIdentityRefusal, verifyIdentityFenceReport } from './phase8g-identity-fence.js';
import { automaticStructureFence, checkStructureComparison, verifyStructureReport } from './phase8g-shadow-structure.js';
import { checkExpectedFixture } from './phase8g-lifecycle-reuse.js';
import type { ShadowCacheWireSnapshot } from './phase8g-shadow-cache-lib.js';
import { verifyNoChainReport, verifyNoChainSave } from './phase8g-no-chain-controls.js';
import { verifyCapacityReport } from './phase8g-capacity-controls.js';

type Wire = Record<string, unknown>;
export type V5ArtifactRole = 'cache-acceptance' | 'mutations' | 'identity-fence' | 'structure' | 'diagnostic-error'
  | 'diagnostic-structure-setup-error' | 'diagnostic-structure-historical-label-error' | 'diagnostic-structure-authority-refusal'
  | 'diagnostic-group-preflight-error' | 'diagnostic-group-preflight-cleanup'
  | 'no-chain' | 'no-chain-save' | 'capacity';
export interface V5ArtifactFile {
  role: V5ArtifactRole;
  file: string;
  uncompressedSha256: string;
  uncompressedBytes: number;
  compressedSha256: string;
  compressedBytes: number;
}
export interface V5ArtifactManifest {
  schema: 'phase8g-v5-acceptance-evidence-v1';
  session: '8g';
  state: 'active';
  researchOnly: true;
  wholeSessionComplete: false;
  eligibilityProved: false;
  identityDetectionProved: false;
  complete: false;
  eligible: false;
  instrumentationRevision: typeof MUTATION_MARKER;
  pending: string[];
  files: Record<string, V5ArtifactFile>;
  retainedReportCounts: Record<V5ArtifactRole, number>;
}

const DEFAULT_MANIFEST = fileURLToPath(new URL('../../../context/evidence/data/phase8g-v5-acceptance/manifest.json', import.meta.url));
const ROLES: readonly V5ArtifactRole[] = ['cache-acceptance', 'mutations', 'identity-fence', 'structure', 'diagnostic-error',
  'diagnostic-structure-setup-error', 'diagnostic-structure-historical-label-error', 'diagnostic-structure-authority-refusal',
  'diagnostic-group-preflight-error', 'diagnostic-group-preflight-cleanup',
  'no-chain', 'no-chain-save', 'capacity'];
const labeled = (role: V5ArtifactRole): boolean => role === 'identity-fence' || role === 'diagnostic-error';
const diagnostic = (role: V5ArtifactRole): boolean => role.startsWith('diagnostic-');
const MAX_RAW_BYTES = 128 * 1024 * 1024;
const MAX_COMPRESSED_BYTES = 64 * 1024 * 1024;
const SHA256 = /^[0-9a-f]{64}$/;
const BASENAME = /^[a-z0-9][a-z0-9_-]*\.json\.gz$/;
const sha256 = (raw: Uint8Array): string => createHash('sha256').update(raw).digest('hex');
function object(value: unknown, name: string): Wire {
  assert(value !== null && typeof value === 'object' && !Array.isArray(value), `${name} must be an object`); return value as Wire;
}
function number(value: unknown, name: string): number {
  assert(typeof value === 'number' && Number.isFinite(value) && value >= 0, `${name} must be a finite nonnegative measurement`); return value;
}
function count(value: unknown, name: string, maximum = Number.MAX_SAFE_INTEGER): number {
  const result = number(value, name); assert(Number.isSafeInteger(result) && result <= maximum, `${name} is outside the artifact bound`); return result;
}
function completed(report: Wire, role: string, allowSetupError = false): void {
  for (const field of ['started', 'ended']) assert(typeof report[field] === 'string' && Number.isFinite(Date.parse(report[field] as string)), `${role}.${field} is unavailable`);
  assert(Date.parse(report.ended as string) >= Date.parse(report.started as string), `${role} end precedes start`);
  assert.equal(report.researchOnly, true); assert.equal(report.complete, false); assert.equal(report.eligible, false);
  for (const field of ['fixtureRestoreError', 'cleanupError', ...(allowSetupError ? [] : ['error'])]) assert.equal(report[field], undefined, `${role} retains a failed run`);
}
function checkedRole(value: unknown): V5ArtifactRole {
  assert(ROLES.includes(value as V5ArtifactRole), `unsupported v5 artifact role ${String(value)}`); return value as V5ArtifactRole;
}
function ping(value: unknown, name: string): number {
  const record = object(value, name), samples = record.samplesMs;
  assert(Array.isArray(samples) && samples.length === 30, `${name} needs all 30 ping samples`);
  const values = samples.map((sample, index) => number(sample, `${name}.samplesMs[${index}]`));
  assert.deepEqual(values, [...values].sort((a, b) => a - b), `${name} samples are not sorted`);
  assert.equal(record.p95Ms, values[Math.ceil(values.length * .95) - 1], `${name} p95 differs from retained samples`);
  return number(record.p95Ms, `${name}.p95Ms`);
}
function range(values: readonly number[]): { minimum: number; maximum: number } {
  assert(values.length > 0); return { minimum: Math.min(...values), maximum: Math.max(...values) };
}
function diagnosticFlags(value: unknown): void {
  if (value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) { for (const item of value) diagnosticFlags(item); return; }
  const record = value as Wire;
  if (record.instrumentationRevision !== undefined && String(record.instrumentationRevision).startsWith('8g-shadow-')) {
    assert.equal(record.instrumentationRevision, MUTATION_MARKER, 'mixed or stale v5 instrumentation marker');
    assert.equal(record.complete, false, 'diagnostic result cannot claim completeness');
    assert.equal(record.eligible, false, 'diagnostic result cannot claim eligibility');
  }
  for (const item of Object.values(record)) diagnosticFlags(item);
}

export function summarizeV5CacheAcceptance(report: Wire): Wire {
  const comparisons = verifyCacheAcceptance(report), pools = report.poolCases as Wire[], exact = report.exactCases as Wire[];
  const poolResults = pools.map(value => object(value.comparison, 'pool comparison'));
  for (const result of poolResults) {
    assert.equal(result.pingMeasurementAvailable, true); assert.equal(result.constructionMeasurementAvailable, true);
    assert.equal(result.cacheBudgetMeasurementsComplete, true);
  }
  const initial = object(report.initial, 'initial'), final = object(report.final, 'final');
  const registry = object(object(report.registry, 'registry').inventoryRebuild, 'registry status');
  const rebuild = object(object(report.rebuild, 'rebuild').inventoryRebuild, 'rebuild status');
  return {
    comparisons, poolComparisons: pools.length, exactComparisons: exact.length, consumerControls: 6,
    bridgeRequests: count(report.calls, 'bridge requests'), responseBytes: count(report.responseBytes, 'response bytes'),
    bridgeCountScope: 'retained bridge requests; excludes final cleanup requests and public tool calls',
    poolWallMs: range(pools.map(value => number(value.wallMs, 'pool wall time'))),
    exactWallMs: range(exact.map(value => number(value.wallMs, 'exact wall time'))),
    constructionMs: number(initial.constructionMs, 'construction'),
    pingBeforeP95Ms: ping(report.pingBeforePool, 'pingBeforePool'), pingAfterP95Ms: ping(report.ping, 'ping'),
    registryMs: number(registry.elapsedMs, 'registry elapsed'), rebuildMs: number(rebuild.elapsedMs, 'rebuild elapsed'),
    registryMetadataEstimatedBytes: number(rebuild.registryMetadataEstimatedBytes, 'registry bookkeeping estimate'),
    maximumSparseRecorderEstimatedBytes: Math.max(...poolResults.map(value => number(value.recorderEstimatedBytes, 'sparse recorder estimate'))),
    maximumPhysicalHintRecorderEstimatedBytes: Math.max(...poolResults.map(value => number(value.physicalHintRecorderEstimatedBytes, 'physical hint estimate'))),
    maximumRetainedSnapshotEstimatedBytes: Math.max(...poolResults.map(value => number(value.retainedSnapshotEstimatedBytes, 'retained snapshot estimate'))),
    maximumSnapshotSerializedBytes: Math.max(...poolResults.map(value => count(value.lastSnapshotSerializedBytes, 'serialized snapshot bytes'))),
    maximumAuthoritySerializedBytes: Math.max(...poolResults.map(value => count(value.lastAuthoritySerializedBytes, 'serialized authority bytes'))),
    experimentalStepDataObservers: count(final.totalExperimentalStepDataObservers, 'aggregate observers'),
    shadowStepDataObservers: count(final.stepDataObservers, 'shadow observers'),
    serializedBytesAreMemoryMeasurement: false, complete: false, eligible: false,
  };
}

/** Retain this failed control without treating it as a cache mismatch or identity proof. */
export function verifyV5DiagnosticError(report: Wire): Wire {
  assert.equal(report.marker, MUTATION_MARKER); assert.equal(report.stage, 'finished'); assert.equal(report.outcome, 'error');
  for (const field of ['identityDetectionProved', 'absentCallbackDetectionProved', 'hostInputFenceProved']) assert.equal(report[field], false);
  assert(typeof report.observationError === 'string' && report.observationError.length > 0);
  assert(typeof report.recoveryError === 'string' && report.recoveryError.length > 0);
  assert.deepEqual(object(report.recovery, 'failed recovery'), {}, 'failed control must not retain successful recovery');
  const finish = object(report.finish, 'failed finish'), root = object(finish.root, 'failed root');
  const engine = object(object(root.current, 'failed root current').hasActiveEngine, 'engine read');
  assert.equal(engine.status, 'read'); assert.equal(engine.value, false, 'this diagnostic role retains an inactive original engine');
  assert.equal(object(object(report.prepare, 'failed prepare').comparison, 'prepared comparison').comparison, 'match');
  assert(Array.isArray(finish.polls) && finish.polls.length === 2);
  for (const value of finish.polls) { checkIdentityRefusal(object(value, 'failed control poll')); assert.equal((value as Wire).comparison, 'window-changed'); }
  checkIdentityRefusal(object(finish.oldRead, 'failed control old read'));
  return { outcome: 'control-error', reason: 'original-engine-inactive', observedRetiredPolls: 2,
    recoveryProved: false, cacheMismatchProved: false, identityDetectionProved: false, hostInputFenceProved: false };
}

/** The seed assertion stopped the structure run before its first arm. Verify cleanup separately. */
export function verifyV5StructureSetupError(report: Wire): Wire {
  assert.equal(report.marker, MUTATION_MARKER); assert.equal(report.structuralScopeComplete, false); assert.equal(report.callbackOriginProved, false);
  assert(typeof report.error === 'string' && /1 !== 0\.375/.test(report.error), 'retain the specific chance seed assertion');
  assert.deepEqual(report.cases, [], 'no structural arm ran'); assert.equal(report.fixtureBaselines, undefined, 'no seed comparison was retained');
  verifyStructureErrorCleanup(report);
  return { outcome: 'setup-error', reason: 'chance-seed-assertion', structuralCases: 0, originalComparisonControls: 6,
    fixtureRestored: true, temporaryFixturesRemoved: true, structuralAcceptanceProved: false, cacheMismatchProved: false };
}

function verifyStructureErrorCleanup(report: Wire): void {
  assert.deepEqual(report.ownedTracks, []); assert.equal(report.fixtureRestored, true); assert.equal(report.temporaryFixturesRemoved, true);
  assert.deepEqual(report.finalTrackIds, report.baselineTrackIds); assert.equal(report.finalScenes, report.baselineScenes);
  assert.deepEqual(report.baselineSlotsAfter, report.baselineSlotsBefore); assert.deepEqual(report.finalRootEndpoint, report.initialRootEndpoint);
  const before = report.originalBefore as Wire[], after = report.originalAfter as Wire[];
  assert(Array.isArray(before) && before.length === 3); assert(Array.isArray(after) && after.length === 3);
  assert(typeof report.originalTrackId === 'string' && report.originalTrackId.length > 0);
  for (let row = 0; row < 3; row++) {
    const baseline = object(before[row]!.result, 'setup-error baseline'), restored = object(after[row]!.result, 'setup-error restoration');
    const notes = (baseline.diagnosticSnapshot as ShadowCacheWireSnapshot).notes;
    assert.deepEqual(checkExpectedFixture(notes, row), []);
    assert.deepEqual(checkMutationComparison(baseline, row, report.originalTrackId, notes), []);
    assert.deepEqual(checkMutationComparison(restored, row, report.originalTrackId, notes), []);
    assert.deepEqual(restored.authorityMetadata, baseline.authorityMetadata);
  }
}

/** A retained comparison label is historical. Closed reads have no current result. */
export function verifyV5HistoricalLabelError(report: Wire): Wire {
  assert.equal(report.marker, MUTATION_MARKER); assert.equal(report.structuralScopeComplete, false); assert.equal(report.callbackOriginProved, false);
  assert(typeof report.error === 'string' && report.error.includes("refused.comparison !== 'pending' && refused.comparison !== 'match'"));
  const cases = report.cases as Wire[];
  assert(Array.isArray(cases) && cases.length === 1); const arm = cases[0]!;
  assert.equal(arm.label, 'clip-duplicate'); assert.equal(arm.explicitBarrier, true);
  for (const field of ['result', 'outcome', 'rebuild']) assert.equal(arm[field], undefined, 'no structural recovery comparison completed');
  const before = object(arm.before, 'historical-label before'), current = object(arm.automaticInfo, 'historical-label current');
  assert.equal(current.initDomain, before.initDomain); assert.equal(current.projectGeneration, before.projectGeneration);
  assert(count(current.structuralEpoch, 'current structure') > count(before.structuralEpoch, 'before structure'));
  for (const field of ['automaticStatus', 'automaticRead', 'afterBarrierRead']) {
    const value = object(arm[field], `historical-label ${field}`);
    assert.equal(value.complete, false); assert.equal(value.eligible, false); assert.equal(value.phase, 'retired');
    assert.equal(value.readMode, 'refuse'); assert.equal(value.authorityAvailable, false); assert.equal(value.comparison, 'match');
    for (const output of ['diagnosticSnapshot', 'authorityNotes', 'historicalSnapshot']) assert.equal(value[output], undefined);
  }
  verifyStructureErrorCleanup(report);
  return { outcome: 'driver-assertion-error', reason: 'historical-comparison-label', attemptedStructuralCases: 1,
    completedStructuralCases: 0, closedReadsRetained: true, originalComparisonControls: 6,
    fixtureRestored: true, temporaryFixturesRemoved: true, structuralAcceptanceProved: false, cacheMismatchProved: false };
}

/** The assertion retains the authority budget reason. The failed terminal wire result was not saved. */
export function verifyV5StructureAuthorityRefusal(report: Wire): Wire {
  assert.equal(report.marker, MUTATION_MARKER); assert.equal(report.structuralScopeComplete, false); assert.equal(report.callbackOriginProved, false);
  assert(typeof report.error === 'string' && report.error.includes("+ 'authority-binding-budget'") && report.error.includes("- 'match'"));
  const cases = report.cases as Wire[]; assert(Array.isArray(cases) && cases.length === 2);
  assert.deepEqual(cases.map(value => value.label), ['clip-duplicate', 'clip-move']);
  assert.equal(cases[0]!.outcome, 'recovery-match');
  checkStructureComparison(object(cases[0]!.result, 'duplicate recovery'), cases[0]!.target as Parameters<typeof checkStructureComparison>[1]);
  for (const field of ['result', 'outcome']) assert.equal(cases[1]![field], undefined, 'failed terminal wire result was not retained');
  for (const arm of cases) {
    const observed = automaticStructureFence(arm.before as Wire, arm.automaticInfo as Wire, arm.automaticStatus as Wire, arm.automaticRead as Wire);
    assert.equal(observed.observed, true); assert.deepEqual(arm.automaticFence, observed);
    const refused = object(arm.afterBarrierRead, 'authority-refusal barrier read');
    assert.equal(refused.complete, false); assert.equal(refused.eligible, false); assert.equal(refused.readMode, 'refuse');
    assert.equal(refused.authorityAvailable, false); assert.equal(refused.diagnosticSnapshot, undefined); assert.equal(refused.authorityNotes, undefined);
  }
  verifyStructureErrorCleanup(report);
  return { outcome: 'bounded-authority-refusal', reportedReason: 'authority-binding-budget', terminalWireResultRetained: false,
    attemptedStructuralCases: 2, completedStructuralCases: 1, automaticClosedReads: 2, originalComparisonControls: 6,
    fixtureRestored: true, temporaryFixturesRemoved: true, structuralAcceptanceProved: false, cacheMismatchProved: false };
}

/** The method error stopped preparation. The separate cleanup file records the track census. */
function verifyGroupPreflight(report: Wire, cleanup: boolean): Wire {
  if (cleanup) {
    assert(typeof report.ended === 'string' && Number.isFinite(Date.parse(report.ended)));
    assert.equal(report.nativeGroupActionPerformed, false); assert.equal(report.temporaryTrackRemoved, true);
    assert.equal(report.baselineCensusRestored, true);
    const slots = report.slots as Wire[]; assert(Array.isArray(slots) && slots.length === 8);
    slots.forEach((slot, row) => assert.deepEqual(slot, { row, exists: true, hasContent: false, isSelected: false }));
    object(report.before, 'group cleanup before'); object(report.after, 'group cleanup after');
    return { outcome: 'preflight-cleanup', nativeGroupActionPerformed: false, temporaryTrackRemoved: true,
      baselineCensusRestored: true, fullContentRestorationMeasured: false, groupAcceptanceProved: false };
  }
  assert.equal(report.marker, MUTATION_MARKER); assert.equal(report.researchOnly, true);
  assert.equal(report.complete, false); assert.equal(report.eligible, false);
  assert(typeof report.started === 'string' && Number.isFinite(Date.parse(report.started)));
  assert.equal(report.ended, undefined); assert.equal(report.stage, 'preparing');
  assert.equal(report.error, 'BridgeError: Method not found: branch.mixer');
  assert.equal(report.groupMembershipProved, false); assert.equal(report.wrapperDeleted, false);
  const baseline = object(report.baseline, 'group prepare baseline'), comparisons = baseline.comparisons as Wire[];
  assert(typeof report.originalTrackId === 'string' && report.originalTrackId.length > 0);
  assert(Array.isArray(comparisons) && comparisons.length === 3);
  for (let row = 0; row < 3; row++) {
    const notes = (comparisons[row]!.diagnosticSnapshot as ShadowCacheWireSnapshot).notes;
    assert.deepEqual(checkExpectedFixture(notes, row), []);
    assert.deepEqual(checkMutationComparison(comparisons[row]!, row, report.originalTrackId, notes), []);
  }
  return { outcome: 'preflight-method-error', reason: 'branch.mixer-unavailable', completedGroupControls: 0,
    originalBaselineComparisons: 3, groupAcceptanceProved: false, cacheMismatchProved: false };
}

function verifyGroupPreflightPair(report: Wire, cleanup: Wire): void {
  assert.equal(cleanup.ownedTrackId, report.ownedTrackId);
  assert(Date.parse(cleanup.ended as string) >= Date.parse(report.started as string));
  const baseline = object(report.baseline, 'group baseline'), original = object(baseline.trackList, 'group original track list');
  const before = object(cleanup.before, 'group cleanup before'), after = object(cleanup.after, 'group cleanup after');
  const intent = object(report.creationIntent, 'group creation intent');
  const tracks = original.tracks as Wire[], added = before.tracks as Wire[];
  assert(Array.isArray(tracks) && Array.isArray(added)); assert.equal(baseline.scenes, 8);
  assert.deepEqual(intent.priorIds, tracks.map(value => value.channelId));
  const position = count(intent.position, 'group insert position', tracks.length);
  assert.equal(intent.name, 'gn-8g-ui-group'); assert.equal(typeof report.ownedTrackId, 'string');
  assert(!tracks.some(value => value.channelId === report.ownedTrackId));
  const expected = tracks.map(value => ({ ...value }));
  expected.splice(position, 0, { index: position, name: intent.name, position, type: 'Instrument', channelId: report.ownedTrackId });
  expected.forEach((value, index) => { value.index = index; value.position = index; });
  assert.deepEqual(added, expected, 'only the owned empty Instrument track was added');
  assert.equal(before.count, original.count as number + 1); assert.equal(before.itemCount, original.itemCount as number + 1);
  assert.equal(before.bankSize, original.bankSize);
  assert.deepEqual(after, original, 'cleanup must restore the exact original track census');
}

/** Each role uses its live driver's semantic verifier. No checksum alone proves a result. */
function verifyReport(role: V5ArtifactRole, report: Wire): Wire {
  if (role.startsWith('diagnostic-group-preflight-')) {
    diagnosticFlags(report); return verifyGroupPreflight(report, role.endsWith('-cleanup'));
  }
  completed(report, role, role.startsWith('diagnostic-structure-')); diagnosticFlags(report);
  if (role === 'cache-acceptance') return summarizeV5CacheAcceptance(report);
  if (role === 'no-chain') return { exactComparisons: verifyNoChainReport(report), scannedCoordinates: 2048 * 128,
    authorityGetStepCalls: count(report.exactHostCalls, 'no-chain authority host calls'), pooledRefusals: 2,
    cancelledExactControls: 1, fixtureRestored: true, identityDetectionProved: false, hostInputFenceProved: false };
  if (role === 'no-chain-save') {
    verifyNoChainSave(report);
    const before = object(report.before, 'save before'), after = object(report.after, 'save after');
    return { manualSaveConfirmed: true, projectGenerationUnchanged: true, initDomainUnchanged: true,
      automaticIdentityEpochUnchanged: true, inventoriesUnchanged: true,
      diskChecksumChanged: object(before.disk, 'save before disk').sha256 !== object(after.disk, 'save after disk').sha256,
      identityDetectionProved: false, hostInputFenceProved: false };
  }
  assert.equal(report.marker, MUTATION_MARKER, `${role} marker differs`);
  if (role === 'capacity') {
    const controls = verifyCapacityReport(report), overflow = object(report.overflow, 'density overflow');
    return { controls, normalizedDensityComparisons: 3, overflowControls: 1, baselineComparisons: 3, restorationComparisons: 3,
      occupiedEquality: 2048, occupiedExcess: 2049, literalClipReasonAvailable: false,
      rawPublicReason: overflow.rawPublicReason, inferredLimitFamily: overflow.inferredLimitFamily,
      inferenceScope: 'source-backed inference; not a literal host diagnostic', capacityScopeComplete: false,
      callbackOriginProved: false, fixtureRestored: true,
      bridgeRequests: count(report.calls, 'capacity bridge requests'), responseBytes: count(report.responseBytes, 'capacity response bytes') };
  }
  if (role === 'mutations') {
    const cases = verifyMutationReport(report), arms = report.cases as Wire[];
    const comparisons = arms.filter(value => value.label !== 'overflow-2049');
    return { cases, normalizedComparisonCases: comparisons.length, overflowControls: arms.length - comparisons.length,
      restorationComparisons: 3, bridgeRequests: count(report.bridgeRequests, 'mutation bridge requests'),
      responseBytes: count(report.responseBytes, 'mutation response bytes'), fixtureRestored: true,
      comparisonWallMs: range(comparisons.map(value => number(value.wallMs, 'mutation comparison wall time'))),
      authorityHostWorkMs: range(comparisons.map(value => number(object(value.metrics, 'mutation metrics').authorityHostWorkMs, 'mutation authority work'))),
      pingP95Ms: number(report.pingP95Ms, 'mutation ping'), complete: false, eligible: false };
  }
  if (role === 'identity-fence') return verifyIdentityFenceReport(report);
  if (role === 'diagnostic-error') return verifyV5DiagnosticError(report);
  if (role === 'diagnostic-structure-setup-error') return verifyV5StructureSetupError(report);
  if (role === 'diagnostic-structure-historical-label-error') return verifyV5HistoricalLabelError(report);
  if (role === 'diagnostic-structure-authority-refusal') return verifyV5StructureAuthorityRefusal(report);
  return { recoveryCases: verifyStructureReport(report), originalComparisonControls: 6, fixtureSeedComparisons: 2,
    automaticFenceMissing: count(report.automaticFenceMissing, 'missing automatic structure fences'),
    automaticStructureAcceptanceComplete: report.automaticStructureAcceptanceComplete,
    structuralScopeComplete: false, callbackOriginProved: false, unsupported: report.unsupported,
    fixtureRestored: true, temporaryFixturesRemoved: true,
    bridgeRequests: count(report.calls, 'structure bridge requests'), responseBytes: count(report.responseBytes, 'structure response bytes') };
}

export interface V5ArtifactSummary {
  state: 'active'; session: '8g'; wholeSessionComplete: false; eligibilityProved: false; identityDetectionProved: false;
  verifiedFiles: number; pending: readonly string[]; cacheAcceptance: Wire; mutations: Wire;
  identityFences: Readonly<Record<string, Wire>>;
  diagnosticErrors: Readonly<Record<string, Wire>>;
  structure?: Wire;
  noChain?: Wire;
  noChainSave?: Wire;
  capacity?: Wire;
}

/** Check safe filenames and exact compressed and raw bytes before report meaning. */
export async function verifyV5Artifacts(value: unknown, load: (basename: string) => Promise<Uint8Array>): Promise<V5ArtifactSummary> {
  const manifest = object(value, 'manifest');
  assert.equal(manifest.schema, 'phase8g-v5-acceptance-evidence-v1'); assert.equal(manifest.session, '8g'); assert.equal(manifest.state, 'active');
  assert.equal(manifest.researchOnly, true); assert.equal(manifest.wholeSessionComplete, false); assert.equal(manifest.eligibilityProved, false);
  assert.equal(manifest.identityDetectionProved, false); assert.equal(manifest.complete, false); assert.equal(manifest.eligible, false);
  assert.equal(manifest.instrumentationRevision, MUTATION_MARKER);
  assert(Array.isArray(manifest.pending) && manifest.pending.every(value => typeof value === 'string' && value.length > 0));
  assert.equal(new Set(manifest.pending).size, manifest.pending.length, 'pending criteria must be unique');
  const files = object(manifest.files, 'files');
  for (const key of ['cache-acceptance', 'mutations']) assert(Object.hasOwn(files, key), `missing required v5 artifact ${key}`);
  const records = Object.entries(files).map(([key, value]) => {
    const record = object(value, `files.${key}`), role = checkedRole(record.role), file = record.file;
    assert(typeof file === 'string' && BASENAME.test(file), `unsafe v5 artifact basename ${String(file)}`);
    assert.equal(key, labeled(role) ? file.slice(0, -'.json.gz'.length) : role, 'artifact role key and filename disagree');
    if (labeled(role)) assert(file.startsWith(`${role}-`), 'labeled reports need separate filenames');
    assert.equal(file, `${key}.json.gz`);
    for (const field of ['uncompressedSha256', 'compressedSha256']) assert(typeof record[field] === 'string' && SHA256.test(record[field] as string), `${key}.${field} is invalid`);
    const rawBytes = count(record.uncompressedBytes, `${key}.uncompressedBytes`, MAX_RAW_BYTES);
    const compressedBytes = count(record.compressedBytes, `${key}.compressedBytes`, MAX_COMPRESSED_BYTES);
    assert(rawBytes >= 2 && compressedBytes >= 20, `${key} is empty or truncated`);
    return { key, role, file, rawBytes, compressedBytes, record };
  });
  assert.equal(new Set(records.map(record => record.file)).size, records.length, 'v5 artifact filenames must be distinct');
  const counts = object(manifest.retainedReportCounts, 'retainedReportCounts');
  for (const role of ROLES) {
    const found = records.filter(record => record.role === role).length;
    assert.equal(count(counts[role], `${role} report count`), found, `${role} retained report count changed`);
    if (!found && !diagnostic(role)) assert((manifest.pending as string[]).includes(role), `missing pending role ${role}`);
    if (!labeled(role)) assert(found <= 1, `${role} must have one report`);
  }
  const summaries = new Map<string, Wire>(), reports = new Map<string, Wire>();
  const identityFences: Record<string, Wire> = {}, diagnosticErrors: Record<string, Wire> = {};
  for (const { key, role, file, rawBytes, compressedBytes, record } of records) {
    const compressed = await load(file);
    assert.equal(compressed.byteLength, compressedBytes, `${key} compressed byte count changed`);
    assert.equal(sha256(compressed), record.compressedSha256, `${key} compressed SHA256 changed`);
    assert.deepEqual([...compressed.slice(4, 8)], [0, 0, 0, 0], `${key} gzip timestamp is not deterministic`);
    const raw = gunzipSync(compressed, { maxOutputLength: rawBytes + 1 });
    assert.equal(raw.byteLength, rawBytes, `${key} raw byte count changed`);
    assert.equal(sha256(raw), record.uncompressedSha256, `${key} raw SHA256 changed`);
    const report = object(JSON.parse(raw.toString('utf8')), key);
    reports.set(key, report);
    if (labeled(role)) assert.equal(key, `${role}-${report.label}`, 'report label differs from role key');
    const summary = verifyReport(role, report); summaries.set(key, summary);
    if (role === 'identity-fence') identityFences[key] = summary;
    if (diagnostic(role)) diagnosticErrors[key] = summary;
  }
  const fixtureOwner = reports.get('cache-acceptance')!.ownedTrackId;
  for (const record of records.filter(value => !['no-chain', 'no-chain-save', 'diagnostic-group-preflight-cleanup'].includes(value.role)))
    assert.equal(reports.get(record.key)![record.role === 'structure' || record.role.startsWith('diagnostic-structure-') || record.role === 'diagnostic-group-preflight-error' ? 'originalTrackId' : 'ownedTrackId'],
      fixtureOwner, `${record.key} uses a different owned replay fixture`);
  if (reports.has('diagnostic-group-preflight-error') || reports.has('diagnostic-group-preflight-cleanup')) {
    assert(reports.has('diagnostic-group-preflight-error') && reports.has('diagnostic-group-preflight-cleanup'), 'retain both group preflight files');
    verifyGroupPreflightPair(reports.get('diagnostic-group-preflight-error')!, reports.get('diagnostic-group-preflight-cleanup')!);
  }
  return { state: 'active', session: '8g', wholeSessionComplete: false, eligibilityProved: false, identityDetectionProved: false,
    verifiedFiles: records.length, pending: manifest.pending as string[], cacheAcceptance: summaries.get('cache-acceptance')!,
    mutations: summaries.get('mutations')!, identityFences, diagnosticErrors,
    ...(summaries.has('structure') ? { structure: summaries.get('structure')! } : {}),
    ...(summaries.has('no-chain') ? { noChain: summaries.get('no-chain')! } : {}),
    ...(summaries.has('no-chain-save') ? { noChainSave: summaries.get('no-chain-save')! } : {}),
    ...(summaries.has('capacity') ? { capacity: summaries.get('capacity')! } : {}) };
}

function blankManifest(): V5ArtifactManifest {
  return { schema: 'phase8g-v5-acceptance-evidence-v1', session: '8g', state: 'active', researchOnly: true,
    wholeSessionComplete: false, eligibilityProved: false, identityDetectionProved: false, complete: false, eligible: false,
    instrumentationRevision: MUTATION_MARKER, pending: ['identity-fence', 'structure', 'no-chain', 'no-chain-save', 'capacity', 'cleanup',
      'implementation-capacity-corpus', 'remaining-8g-acceptance'],
    files: {}, retainedReportCounts: { 'cache-acceptance': 0, mutations: 0, 'identity-fence': 0, structure: 0,
      'diagnostic-error': 0, 'diagnostic-structure-setup-error': 0, 'diagnostic-structure-historical-label-error': 0,
      'diagnostic-structure-authority-refusal': 0, 'diagnostic-group-preflight-error': 0, 'diagnostic-group-preflight-cleanup': 0,
      'no-chain': 0, 'no-chain-save': 0, capacity: 0 } };
}
async function retain(role: V5ArtifactRole, source: string, manifestPath: string): Promise<void> {
  const raw = await readFile(source), report = object(JSON.parse(raw.toString('utf8')), role); verifyReport(role, report);
  const key = labeled(role) ? `${role}-${report.label}` : role, file = `${key}.json.gz`;
  assert(BASENAME.test(file), 'unsafe report label');
  const compressed = gzipSync(raw, { level: 9 });
  const record: V5ArtifactFile = { role, file, uncompressedSha256: sha256(raw), uncompressedBytes: raw.byteLength,
    compressedSha256: sha256(compressed), compressedBytes: compressed.byteLength };
  let manifest: V5ArtifactManifest;
  try { manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as V5ArtifactManifest; }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; manifest = blankManifest(); }
  await mkdir(dirname(manifestPath), { recursive: true });
  if (manifest.files[key]) {
    assert.deepEqual(manifest.files[key], record, 'retained v5 evidence is immutable; use a separate role for a new run');
    assert.deepEqual(await readFile(join(dirname(manifestPath), file)), compressed, 'retained compressed artifact changed');
    return;
  }
  await writeFile(join(dirname(manifestPath), file), compressed, { flag: 'wx' });
  manifest.files[key] = record;
  for (const role of ROLES) manifest.retainedReportCounts[role] ??= 0;
  manifest.retainedReportCounts[role]++;
  manifest.pending = manifest.pending.filter(value => value !== role);
  if (role === 'structure') {
    for (const criterion of ['unsupported-structural-ui-controls',
      ...(report.automaticStructureAcceptanceComplete === true ? [] : ['automatic-structural-fence-coverage'])])
      if (!manifest.pending.includes(criterion)) manifest.pending.push(criterion);
  }
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
}

async function main(): Promise<void> {
  if (process.argv[2] === 'retain') {
    const role = checkedRole(process.argv[3]), source = process.argv[4]; assert(source, 'retain needs a completed report path');
    await retain(role, resolve(source), resolve(process.argv[5] ?? DEFAULT_MANIFEST)); return;
  }
  assert(process.argv[2] === undefined || process.argv[2] === 'verify', 'use verify [manifest] or retain <role> <report> [manifest]');
  const path = resolve(process.argv[3] ?? DEFAULT_MANIFEST), manifest = JSON.parse(await readFile(path, 'utf8'));
  console.log(JSON.stringify(await verifyV5Artifacts(manifest, name => readFile(join(dirname(path), name))), null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  void main().catch(error => { console.error(error); process.exitCode = 1; });
