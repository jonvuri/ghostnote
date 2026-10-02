/** Retain followup evidence separately from the earlier v5 corpus. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync, gunzipSync } from 'node:zlib';
import { verifyReloadCaptures } from './phase8g-reload-captures.js';
import { MUTATION_MARKER, checkMutationComparison } from './phase8g-shadow-mutations.js';
import { verifyStructureReport, checkStructureComparison } from './phase8g-shadow-structure.js';
import { identityEndpoint } from './phase8g-identity-fence.js';
import { verifyInventoryReport } from './phase8g-inventory-controls.js';
import { verifyGroupReport } from './phase8g-ui-group-controls.js';
import { verifySceneReport } from './phase8g-ui-scene-controls.js';
import { verifyUiNoteReport, verifyUiNoteMethods, verifyUiNoteCleanup, uiVelocityTarget } from './phase8g-ui-note-controls.js';
import { groupCensus } from './phase8g-ui-group-controls.js';
import { sceneRows } from './phase8g-ui-scene-controls.js';
import { checkExpectedFixture } from './phase8g-lifecycle-reuse.js';
import type { ShadowCacheWireSnapshot } from './phase8g-shadow-cache-lib.js';
import { verifySnapshotMemoryReport } from './phase8g-snapshot-memory.js';
import { verifyFinalBaselineReports, verifyFinalConfigCopies } from './phase8g-final-baseline.js';
import { verifyOrderingReport, verifyOrderingTimingDiagnostic } from './phase8g-ordering-controls.js';

type Wire = Record<string, unknown>;
export interface FollowupArtifactFile {
  file: string;
  uncompressedSha256: string;
  uncompressedBytes: number;
  compressedSha256: string;
  compressedBytes: number;
}
export interface FollowupArtifactManifest {
  schema: 'phase8g-followup-evidence-v1'; session: '8g'; state: 'active'; instrumentationRevision: typeof MUTATION_MARKER;
  researchOnly: true; complete: false; eligible: false; wholeSessionComplete: false;
  identityDetectionProved: false; projectContinuityProved: false; hostInputFenceProved: false;
  pending: string[];
  retainedReportCounts: Record<string, number>;
  files: Record<string, FollowupArtifactFile>;
}
const DEFAULT_MANIFEST = fileURLToPath(new URL('../../../context/evidence/data/phase8g-followup-acceptance/manifest.json', import.meta.url));
const RELOAD_ROLES = ['reload-before', 'reload-after'] as const;
const ADDITIONAL_ROLES = ['native-scene-controls', 'native-scene-add-move', 'native-note-controls', 'snapshot-memory'] as const;
const FINAL_ROLES = ['cleanup', 'cleanup-verified', 'final-baseline', 'config-original', 'config-research', 'config-restored'] as const;
type AdditionalRole = typeof ADDITIONAL_ROLES[number];
const NOTE_DIAGNOSTIC_ROLE = 'native-note-preparation-diagnostic';
const ORDERING_DIAGNOSTIC_ROLE = 'ordering-timing-diagnostic';
const OPTIONAL_DIAGNOSTIC_ROLES: readonly string[] = [NOTE_DIAGNOSTIC_ROLE, ORDERING_DIAGNOSTIC_ROLE];
const ROLES = [...RELOAD_ROLES, 'structure', 'inventory-controls', 'native-group-controls', 'ordering-controls', NOTE_DIAGNOSTIC_ROLE, ORDERING_DIAGNOSTIC_ROLE, ...ADDITIONAL_ROLES, ...FINAL_ROLES] as const;
const MAX_RAW_BYTES = 128 * 1024 * 1024, MAX_COMPRESSED_BYTES = 64 * 1024 * 1024;
const SHA256 = /^[0-9a-f]{64}$/;
const hash = (value: Uint8Array): string => createHash('sha256').update(value).digest('hex');
function object(value: unknown, name: string): Wire {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${name} must be an object`); return value as Wire;
}
function size(value: unknown, maximum: number, name: string, minimum: number): number {
  assert(Number.isSafeInteger(value) && Number(value) >= minimum && Number(value) <= maximum, `${name} is outside the artifact bound`); return Number(value);
}
/** Link a final control to the measured controller instance and baseline endpoint inputs. */
export function verifyFollowupAdditionalLink(role: AdditionalRole, report: Wire, after: Wire, reload: Wire): void {
  assert(typeof report.started === 'string' && Date.parse(report.started) >= Date.parse(after.captured as string));
  assert(typeof report.ended === 'string' && Date.parse(report.ended) >= Date.parse(report.started));
  for (const field of ['cleanupError', 'fixtureRestoreError', 'retirementError']) assert.equal(report[field], undefined);
  const memory = role === 'snapshot-memory', before = memory ? report : object(report.baseline, `${role} baseline`);
  const prepared = memory ? report : object(report.prepare, `${role} prepare`);
  const initial = object(memory ? report.initial : prepared[role === 'native-note-controls' ? 'status' : 'info'], `${role} initial`);
  const loaded = object(after.info, 'reload info');
  for (const field of ['initDomain', 'authorityBindingRevision', 'inventoryControlRevision'])
    assert.equal(initial[field], loaded[field], `${role} uses a different loaded core or revision`);
  assert.equal(report[memory ? 'ownedTrackId' : 'originalTrackId'], reload.ownedTrackId);
  assert.deepEqual(memory ? report.rawTracks : before.trackList, after.tracks);
  assert.deepEqual(memory ? report.initialRootEndpoint : before.rootEndpoint,
    identityEndpoint(object(after.root, 'reload root'), reload.ownedTrackId as string));
  if (memory) assert.equal(report.baselineScenes, 8);
}
/** Retain diagnostic memory failures without treating a source estimate as a measured boundary. */
export function verifyFollowupAdditionalReport(role: AdditionalRole, report: Wire, after: Wire, reload: Wire): Wire {
  verifyFollowupAdditionalLink(role, report, after, reload);
  if (role === 'native-scene-controls' || role === 'native-scene-add-move') {
    const summary = verifySceneReport(report), kind = object(summary.actionProvenance, 'scene provenance').kind;
    assert.equal(kind, role === 'native-scene-add-move' ? 'compound-add-move' : 'declared-direct-insertion', 'scene action belongs to a different corpus role');
    return summarizeFollowupScene(summary);
  }
  if (role === 'native-note-controls') return { ...verifyUiNoteReport(report),
    originalBaselineComparisons: 3, uiEditAndReacquisitionAreSeparate: true };
  const summary = verifySnapshotMemoryReport(report);
  return { ...summary, outcome: summary.snapshotMemoryBoundaryObserved ? 'measured-boundary' : 'diagnostic-error',
    ...(report.error === undefined ? {} : { retainedError: report.error }),
    literalBoundaryReasonObserved: summary.snapshotMemoryBoundaryObserved,
    sourceBudgetInferenceIsMeasurement: false, serializedBytesAreMemoryMeasurement: false, originalComparisonControls: 6 };
}
/** Keep user-reported action provenance separate from the measured aggregate fence. */
export function summarizeFollowupScene(summary: Wire): Wire {
  const provenance = object(summary.actionProvenance, 'scene action provenance'), compound = provenance.kind === 'compound-add-move';
  assert.equal(summary.cases, 1); assert.equal(summary.singleInsertionProved, false); assert.equal(summary.actionCount, compound ? 2 : 1);
  if (compound) assert.equal(summary.automaticInsertionAcceptanceComplete, false);
  return { ...summary, scope: compound ? 'aggregate Add Scene and Move Scene control' : 'user-reported direct scene insertion control',
    ...(compound ? {} : { beforeAndAtAreOneCase: true }), atCaseDistinct: false,
    originalBaselineComparisons: 3, preparedAndRecoveryComparisons: 2 };
}
/** One interleaving trial does not establish callback delivery or host input order. */
function verifyFollowupOrderingLink(report: Wire, after: Wire, reload: Wire): void {
  const initial = object(report.initial, 'ordering initial'), loaded = object(after.info, 'reload info');
  for (const field of ['initDomain', 'authorityBindingRevision', 'inventoryControlRevision']) assert.equal(initial[field], loaded[field]);
  assert.equal(report.ownedTrackId, reload.ownedTrackId); assert.deepEqual(report.initialTracks, after.tracks);
  assert.deepEqual(report.initialRootEndpoint, identityEndpoint(object(after.root, 'reload root'), reload.ownedTrackId as string));
  assert(typeof report.started === 'string' && Date.parse(report.started) >= Date.parse(after.captured as string));
  assert(typeof report.ended === 'string' && Date.parse(report.ended) >= Date.parse(report.started));
}
export function verifyFollowupOrderingReport(report: Wire, after: Wire, reload: Wire): Wire {
  verifyFollowupOrderingLink(report, after, reload);
  return { ...verifyOrderingReport(report), historicalComparisonLabelsAreCurrentOutput: false,
    complete: false, eligible: false, wholeSessionComplete: false };
}
/** Late native commands do not satisfy the active acquisition control. */
export function verifyFollowupOrderingTimingDiagnostic(report: Wire, after: Wire, reload: Wire): Wire {
  verifyFollowupOrderingLink(report, after, reload);
  return { ...verifyOrderingTimingDiagnostic(report), acceptedInterleavingTrials: 0,
    historicalComparisonLabelsAreCurrentOutput: false, complete: false, eligible: false, wholeSessionComplete: false };
}
/** The reset ended preparation. Original fixture restoration is a separate result. */
export function verifyUiNotePreparationDiagnostic(report: Wire, after: Wire, reload: Wire): Wire {
  verifyFollowupAdditionalLink('native-note-controls', report, after, reload);
  assert.equal(report.marker, MUTATION_MARKER); assert.equal(report.researchOnly, true); assert.equal(report.complete, false); assert.equal(report.eligible, false);
  assert.equal(report.stage, 'finished'); assert.equal(report.controlOutcome, 'failed-or-unfinished'); assert.equal(report.finish, undefined);
  assert.equal(report.plannedUiEditCount, 1); assert.equal(report.uiEditCount, 0); assert.equal(report.reacquisitionObservationCount, 0);
  assert.equal(report.aggregateAcceptanceCount, undefined); assert.equal(report.fixtureRestored, true); assert.equal(report.temporaryFixturesRemoved, true);
  for (const field of ['missingEventContinuityProved', 'hostInputOrderingProved', 'simultaneousAuthorityScansSupported']) assert.equal(report[field], false);
  assert.equal(report.error, undefined); verifyUiNoteMethods(object(report.methods, 'note preparation methods'));
  assert.deepEqual(report.nativePreparationDiagnostic, { action: 'double-click velocity reset', observedVelocityPercent: 100,
    singleEditAcceptance: false, reason: 'Native double-click reset occurred before intended edit. No finish acceptance is claimed.' });
  const baseline = object(report.baseline, 'diagnostic baseline'), prepared = object(report.prepare, 'diagnostic prepare'), restored = object(report.after, 'diagnostic restoration');
  const id = String(report.originalTrackId), child = String(report.ownedTrackId), target = prepared.target as Parameters<typeof uiVelocityTarget>[0];
  assert.equal(target.id, child); assert.equal(target.name, report.ownedClipName); assert.deepEqual(report.expectedEditedTarget, uiVelocityTarget(target));
  checkStructureComparison(object(prepared.fullComparison, 'prepared note seed comparison'), target);
  assert.deepEqual(sceneRows(prepared.sceneSnapshot as Wire), sceneRows(baseline.sceneSnapshot as Wire));
  assert.equal(report.cleanupTargetHadContent, true);
  verifyUiNoteCleanup(baseline.trackList as Wire, prepared.trackList as Wire, report.cleanupGroups as Wire,
    report.cleanupSlots as Wire[], id, child, String(report.ownedTrackName), true);
  assert.deepEqual(groupCensus(restored.trackList as Wire), groupCensus(baseline.trackList as Wire));
  assert.deepEqual(sceneRows(restored.sceneSnapshot as Wire), sceneRows(baseline.sceneSnapshot as Wire));
  assert.deepEqual(restored.slots, baseline.slots); assert.deepEqual(restored.rootEndpoint, baseline.rootEndpoint);
  const before = baseline.comparisons as Wire[], afterComparisons = restored.comparisons as Wire[];
  assert.equal(before.length, 3); assert.equal(afterComparisons.length, 3);
  for (let row = 0; row < 3; row++) {
    const expected = (before[row]!.diagnosticSnapshot as ShadowCacheWireSnapshot).notes;
    assert.deepEqual(checkExpectedFixture(expected, row), []); assert.deepEqual(checkMutationComparison(before[row]!, row, id, expected), []);
    assert.deepEqual(checkMutationComparison(afterComparisons[row]!, row, id, expected), []);
    assert.deepEqual(afterComparisons[row]!.authorityMetadata, before[row]!.authorityMetadata);
  }
  return { outcome: 'abandoned-native-note-preparation', observedVelocityPercent: 100, intendedSeedVelocity: 80 / 127,
    acceptedUiEdits: 0, reacquisitionObservations: 0, singleEditAcceptance: false, originalComparisonsBefore: 3,
    originalRestorationComparisons: 3, preparedSeedComparisons: 1, fixtureRestored: true, temporaryFixturesRemoved: true,
    complete: false, eligible: false, wholeSessionComplete: false, missingEventContinuityProved: false, hostInputOrderingProved: false };
}
export async function verifyFollowupArtifacts(value: unknown, load: (basename: string) => Promise<Uint8Array>): Promise<Wire> {
  const manifest = object(value, 'followup manifest');
  assert.equal(manifest.schema, 'phase8g-followup-evidence-v1'); assert.equal(manifest.session, '8g'); assert.equal(manifest.state, 'active');
  assert.equal(manifest.instrumentationRevision, MUTATION_MARKER); assert.equal(manifest.researchOnly, true);
  for (const field of ['complete', 'eligible', 'wholeSessionComplete', 'identityDetectionProved', 'projectContinuityProved', 'hostInputFenceProved']) assert.equal(manifest[field], false);
  assert(Array.isArray(manifest.pending) && manifest.pending.every(value => typeof value === 'string' && value.length > 0));
  assert.equal(new Set(manifest.pending).size, manifest.pending.length);
  assert(manifest.pending.includes('remaining-8g-acceptance'), 'the followup bundle cannot close the session');
  const files = object(manifest.files, 'followup files');
  for (const role of RELOAD_ROLES) assert(Object.hasOwn(files, role), 'retain both reload captures');
  assert(Object.keys(files).every(role => ROLES.includes(role as typeof ROLES[number])), 'unsupported followup artifact role');
  const counts = object(manifest.retainedReportCounts, 'retained report counts');
  for (const role of ROLES) {
    const optional = OPTIONAL_DIAGNOSTIC_ROLES.includes(role);
    assert.equal(size(optional ? counts[role] ?? 0 : counts[role], 1, `${role} report count`, 0), Object.hasOwn(files, role) ? 1 : 0, `${role} retained report count changed`);
    if (!Object.hasOwn(files, role) && !optional) assert(manifest.pending.includes(role), `missing pending followup role ${role}`);
  }
  const records = Object.keys(files).map(role => {
    const record = object(files[role], role); assert.equal(record.file, `${role}.json.gz`, 'use the fixed safe followup basename');
    for (const field of ['uncompressedSha256', 'compressedSha256']) assert(typeof record[field] === 'string' && SHA256.test(record[field] as string));
    return { role, record, rawBytes: size(record.uncompressedBytes, MAX_RAW_BYTES, `${role} raw bytes`, 2),
      compressedBytes: size(record.compressedBytes, MAX_COMPRESSED_BYTES, `${role} compressed bytes`, 20) };
  });
  const reports = new Map<string, Wire>(), rawReports = new Map<string, Buffer>();
  for (const { role, record, rawBytes, compressedBytes } of records) {
    const compressed = await load(record.file as string);
    assert.equal(compressed.byteLength, compressedBytes, `${role} compressed byte count changed`);
    assert.equal(hash(compressed), record.compressedSha256, `${role} compressed SHA256 changed`);
    assert.deepEqual([...compressed.slice(4, 8)], [0, 0, 0, 0], `${role} gzip timestamp is not deterministic`);
    const raw = gunzipSync(compressed, { maxOutputLength: rawBytes + 1 });
    assert.equal(raw.byteLength, rawBytes, `${role} raw byte count changed`); assert.equal(hash(raw), record.uncompressedSha256, `${role} raw SHA256 changed`);
    reports.set(role, object(JSON.parse(raw.toString('utf8')), role)); rawReports.set(role, raw);
  }
  const reload = verifyReloadCaptures(reports.get('reload-before'), reports.get('reload-after'));
  for (const role of ['structure', 'inventory-controls']) if (reports.has(role)) {
    const report = reports.get(role)!, after = reports.get('reload-after')!, initial = object(report.initial, `${role} initial`);
    assert.equal(initial.initDomain, object(after.info, 'reload info').initDomain, `${role} uses a different loaded core`);
    assert.equal(initial.authorityBindingRevision, object(after.info, 'reload info').authorityBindingRevision);
    assert.equal(initial.inventoryControlRevision, object(after.info, 'reload info').inventoryControlRevision);
    assert(typeof report.started === 'string' && Date.parse(report.started) >= Date.parse(after.captured as string));
    assert.equal(report[role === 'structure' ? 'originalTrackId' : 'ownedTrackId'], reload.ownedTrackId);
    assert.deepEqual(report.initialRootEndpoint, identityEndpoint(object(after.root, 'reload root'), reload.ownedTrackId as string));
  }
  let structure: Wire | undefined;
  if (reports.has('structure')) {
    const report = reports.get('structure')!, after = reports.get('reload-after')!;
    for (const field of ['error', 'cleanupError', 'fixtureRestoreError', 'retirementError']) assert.equal(report[field], undefined);
    assert(typeof report.started === 'string' && Date.parse(report.started) >= Date.parse(after.captured as string));
    assert(typeof report.ended === 'string' && Date.parse(report.ended) >= Date.parse(report.started));
    const initial = object(report.initial, 'structure initial');
    assert.equal(initial.initDomain, object(after.info, 'reload info').initDomain, 'structure uses a different loaded core');
    assert.equal(initial.authorityBindingRevision, object(after.info, 'reload info').authorityBindingRevision);
    assert.equal(initial.inventoryControlRevision, object(after.info, 'reload info').inventoryControlRevision);
    assert.equal(report.originalTrackId, reload.ownedTrackId);
    assert.deepEqual(report.baselineTrackIds, (object(after.tracks, 'reload tracks').tracks as Wire[]).map(value => value.channelId));
    assert.deepEqual(report.initialRootEndpoint, identityEndpoint(object(after.root, 'reload root'), reload.ownedTrackId as string));
    const recoveryCases = verifyStructureReport(report);
    assert.equal(report.automaticFenceMissing, 0); assert.equal(report.automaticStructureAcceptanceComplete, true);
    structure = { recoveryCases, automaticFencesObserved: recoveryCases, originalComparisonControls: 6, fixtureSeedComparisons: 2,
      unsupported: report.unsupported, structuralScopeComplete: false, callbackOriginProved: false,
      fixtureRestored: true, temporaryFixturesRemoved: true,
      bridgeRequests: size(report.calls, Number.MAX_SAFE_INTEGER, 'structure bridge requests', 0),
      responseBytes: size(report.responseBytes, Number.MAX_SAFE_INTEGER, 'structure response bytes', 0) };
  }
  let inventory: Wire | undefined;
  if (reports.has('inventory-controls')) {
    const report = reports.get('inventory-controls')!, after = reports.get('reload-after')!;
    assert.deepEqual(report.baselineTracks, object(after.tracks, 'reload tracks').tracks);
    const controls = verifyInventoryReport(report), arms = report.cases as Wire[];
    const deadline = arms.find(value => value.label === 'total-deadline')!, heartbeats = deadline.heartbeats as Wire[];
    inventory = { controls, privateProgressPerControl: 3, stableTerminalPollsPerControl: 2, explicitFreshRegistryRecoveries: 3,
      originalComparisonControls: 6, recoveryComparisons: 3, deadlineWaitedMs: deadline.waitedMs,
      deadlineHeartbeats: heartbeats.length, maximumHeartbeatPingMs: Math.max(...heartbeats.map(value => Number(value.pingMs))),
      temporaryClipsCreated: 1, fixtureRestored: true, temporaryClipRemoved: true,
      missingEventContinuityProved: false, ambiguousMoveContinuityProved: false,
      bridgeRequests: size(report.calls, Number.MAX_SAFE_INTEGER, 'inventory bridge requests', 0),
      responseBytes: size(report.responseBytes, Number.MAX_SAFE_INTEGER, 'inventory response bytes', 0) };
  }
  let group: Wire | undefined;
  if (reports.has('native-group-controls')) {
    const report = reports.get('native-group-controls')!, after = reports.get('reload-after')!;
    const prepared = object(report.prepare, 'group prepare'), initial = object(prepared.info, 'group initial');
    assert.equal(initial.initDomain, object(after.info, 'reload info').initDomain, 'group uses a different loaded core');
    assert.equal(initial.authorityBindingRevision, object(after.info, 'reload info').authorityBindingRevision);
    assert.equal(initial.inventoryControlRevision, object(after.info, 'reload info').inventoryControlRevision);
    assert.equal(report.originalTrackId, reload.ownedTrackId);
    assert(typeof report.started === 'string' && Date.parse(report.started) >= Date.parse(after.captured as string));
    assert(typeof report.ended === 'string' && Date.parse(report.ended) >= Date.parse(report.started));
    const baseline = object(report.baseline, 'group baseline');
    assert.deepEqual(baseline.trackList, after.tracks);
    assert.deepEqual(baseline.rootEndpoint, identityEndpoint(object(after.root, 'reload root'), reload.ownedTrackId as string));
    group = verifyGroupReport(report);
    assert.equal(group.staleComparisonCancelled, true); assert.equal(group.uiGroupAutomaticAcceptanceComplete, true);
    assert.equal(object(group.automaticFence, 'group automatic fence').observed, true);
    group = { ...group, originalBaselineComparisons: 3, preparedComparison: 1, nativeUngroupConfirmed: true,
      fixtureRestored: true, temporaryFixturesRemoved: true, scope: 'one native Group and Ungroup control; membership remains unproved' };
  }
  const additional: Wire = {};
  for (const role of ADDITIONAL_ROLES) if (reports.has(role))
    additional[role] = verifyFollowupAdditionalReport(role, reports.get(role)!, reports.get('reload-after')!, reload);
  if (reports.has('ordering-controls')) additional['ordering-controls'] = verifyFollowupOrderingReport(reports.get('ordering-controls')!, reports.get('reload-after')!, reload);
  if (reports.has(ORDERING_DIAGNOSTIC_ROLE)) additional[ORDERING_DIAGNOSTIC_ROLE] = verifyFollowupOrderingTimingDiagnostic(reports.get(ORDERING_DIAGNOSTIC_ROLE)!, reports.get('reload-after')!, reload);
  if (reports.has(NOTE_DIAGNOSTIC_ROLE)) additional[NOTE_DIAGNOSTIC_ROLE] = verifyUiNotePreparationDiagnostic(reports.get(NOTE_DIAGNOSTIC_ROLE)!, reports.get('reload-after')!, reload);
  let finalBaseline: Wire | undefined, configuration: Wire | undefined;
  if (FINAL_ROLES.some(role => reports.has(role))) {
    assert(FINAL_ROLES.every(role => reports.has(role)), 'retain cleanup, normal baseline, and configuration copies together');
    const cleanup = reports.get('cleanup')!, final = reports.get('final-baseline')!, after = reports.get('reload-after')!;
    const entry = object(cleanup.entryState, 'final entry state'); assert.equal(entry.ownedTrackId, reload.ownedTrackId);
    const expected = (object(after.tracks, 'reload tracks').tracks as Wire[]).filter(value => value.channelId !== reload.ownedTrackId)
      .map((value, index): Wire => ({ ...value, index, position: index }));
    assert.deepEqual(entry.baselineIds, expected.map(value => value.channelId));
    assert.deepEqual(object(final.tracks, 'final tracks').tracks, expected);
    assert(Number(object(final.stats, 'normal stats').initEpochMs) > Number(object(after.stats, 'experimental stats').initEpochMs));
    finalBaseline = verifyFinalBaselineReports(cleanup, reports.get('cleanup-verified'), final);
    configuration = verifyFinalConfigCopies(rawReports.get('config-original')!, rawReports.get('config-research')!, rawReports.get('config-restored')!);
  }
  return { researchOnly: true, state: 'active', complete: false, eligible: false, wholeSessionComplete: false,
    identityDetectionProved: false, projectContinuityProved: false, hostInputFenceProved: false,
    verifiedFiles: records.length, pending: manifest.pending,
    reload, ...(structure ? { structure } : {}), ...(inventory ? { inventory } : {}), ...(group ? { group } : {}), ...additional,
    ...(finalBaseline ? { finalBaseline, configuration } : {}) };
}

async function retainReload(beforePath: string, afterPath: string, manifestPath: string): Promise<void> {
  assert(beforePath !== afterPath, 'retention needs separate capture paths');
  const raw = await Promise.all([readFile(beforePath), readFile(afterPath)]);
  verifyReloadCaptures(JSON.parse(raw[0]!.toString('utf8')), JSON.parse(raw[1]!.toString('utf8')));
  const files: Record<string, FollowupArtifactFile> = {}, compressed = new Map<string, Buffer>();
  RELOAD_ROLES.forEach((role, index) => {
    const bytes = raw[index]!, zipped = gzipSync(bytes, { level: 9 }), file = `${role}.json.gz`;
    files[role] = { file, uncompressedSha256: hash(bytes), uncompressedBytes: bytes.byteLength,
      compressedSha256: hash(zipped), compressedBytes: zipped.byteLength }; compressed.set(file, zipped);
  });
  const manifest: FollowupArtifactManifest = { schema: 'phase8g-followup-evidence-v1', session: '8g', state: 'active', instrumentationRevision: MUTATION_MARKER,
    researchOnly: true, complete: false, eligible: false, wholeSessionComplete: false, identityDetectionProved: false, projectContinuityProved: false,
    hostInputFenceProved: false, pending: ['structure', 'inventory-controls', 'native-scene-controls', 'native-scene-add-move', 'native-group-controls',
      'native-note-controls', 'snapshot-memory', 'ordering-controls', ...FINAL_ROLES, 'remaining-8g-acceptance'], files,
    retainedReportCounts: Object.fromEntries(ROLES.map(role => [role, RELOAD_ROLES.includes(role as typeof RELOAD_ROLES[number]) ? 1 : 0])) };
  await verifyFollowupArtifacts(manifest, async name => compressed.get(name)!);
  await mkdir(dirname(manifestPath), { recursive: true });
  try {
    const existing = JSON.parse(await readFile(manifestPath, 'utf8'));
    for (const role of RELOAD_ROLES) assert.deepEqual(existing.files[role], files[role], 'retained followup captures are immutable');
    await verifyFollowupArtifacts(existing, name => readFile(join(dirname(manifestPath), name))); return;
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  for (const [file, zipped] of compressed) {
    try { await writeFile(join(dirname(manifestPath), file), zipped, { flag: 'wx' }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      assert.deepEqual(await readFile(join(dirname(manifestPath), file)), zipped, 'retained followup capture changed'); }
  }
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
}
async function retainReport(role: string, source: string, manifestPath: string): Promise<void> {
  assert(ROLES.includes(role as typeof ROLES[number]) && !RELOAD_ROLES.includes(role as typeof RELOAD_ROLES[number])
    && !FINAL_ROLES.includes(role as typeof FINAL_ROLES[number]), 'retain accepts only supported individual reports');
  const raw = await readFile(source), compressed = gzipSync(raw, { level: 9 }), file = `${role}.json.gz`;
  const record: FollowupArtifactFile = { file, uncompressedSha256: hash(raw), uncompressedBytes: raw.byteLength,
    compressedSha256: hash(compressed), compressedBytes: compressed.byteLength };
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as FollowupArtifactManifest;
  manifest.retainedReportCounts ??= Object.fromEntries(ROLES.map(role => [role, Object.hasOwn(manifest.files, role) ? 1 : 0]));
  for (const supported of ROLES) manifest.retainedReportCounts[supported] ??= 0;
  if (manifest.files[role]) {
    assert.deepEqual(manifest.files[role], record, 'retained followup report is immutable');
    await verifyFollowupArtifacts(manifest, name => readFile(join(dirname(manifestPath), name))); return;
  }
  manifest.files[role] = record; manifest.retainedReportCounts[role] = 1; manifest.pending = manifest.pending.filter(value => value !== role);
  await verifyFollowupArtifacts(manifest, name => name === file ? Promise.resolve(compressed) : readFile(join(dirname(manifestPath), name)));
  await writeFile(join(dirname(manifestPath), file), compressed, { flag: 'wx' });
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
}
async function retainFinal(sources: readonly string[], manifestPath: string): Promise<void> {
  assert.equal(sources.length, FINAL_ROLES.length, 'retain-final needs cleanup, verified cleanup, baseline, original config, research config, and restored config');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as FollowupArtifactManifest;
  for (const role of ROLES) manifest.retainedReportCounts[role] ??= 0;
  const candidate = await Promise.all(sources.map(async (source, index) => {
    const role = FINAL_ROLES[index]!, raw = await readFile(source), compressed = gzipSync(raw, { level: 9 });
    const record: FollowupArtifactFile = { file: `${role}.json.gz`, uncompressedSha256: hash(raw), uncompressedBytes: raw.byteLength,
      compressedSha256: hash(compressed), compressedBytes: compressed.byteLength };
    if (manifest.files[role]) assert.deepEqual(manifest.files[role], record, 'retained final evidence is immutable');
    manifest.files[role] = record; manifest.retainedReportCounts[role] = 1; return { record, compressed };
  }));
  manifest.pending = manifest.pending.filter(value => !FINAL_ROLES.includes(value as typeof FINAL_ROLES[number]));
  const staged = new Map(candidate.map(value => [value.record.file, value.compressed]));
  await verifyFollowupArtifacts(manifest, name => staged.has(name) ? Promise.resolve(staged.get(name)!) : readFile(join(dirname(manifestPath), name)));
  for (const { record, compressed } of candidate) {
    try { await writeFile(join(dirname(manifestPath), record.file), compressed, { flag: 'wx' }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      assert.deepEqual(await readFile(join(dirname(manifestPath), record.file)), compressed, 'retained final evidence changed'); }
  }
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
}
async function main(): Promise<void> {
  if (process.argv[2] === 'retain-final') {
    const paths = process.argv.slice(3, 9); assert(paths.length === 6, 'retain-final needs six final report paths');
    await retainFinal(paths.map(path => resolve(path)), resolve(process.argv[9] ?? DEFAULT_MANIFEST)); return;
  }
  if (process.argv[2] === 'retain') {
    const role = process.argv[3], source = process.argv[4]; assert(role && source, 'use retain <role> <final-report.json> [manifest]');
    await retainReport(role, resolve(source), resolve(process.argv[5] ?? DEFAULT_MANIFEST)); return;
  }
  if (process.argv[2] === 'retain-reload') {
    const before = process.argv[3], after = process.argv[4]; assert(before && after, 'use retain-reload <before.json> <after.json> [manifest]');
    await retainReload(resolve(before), resolve(after), resolve(process.argv[5] ?? DEFAULT_MANIFEST)); return;
  }
  assert(process.argv[2] === undefined || process.argv[2] === 'verify', 'use verify [manifest] or retain-reload <before> <after> [manifest]');
  const path = resolve(process.argv[3] ?? DEFAULT_MANIFEST);
  console.log(JSON.stringify(await verifyFollowupArtifacts(JSON.parse(await readFile(path, 'utf8')), name => readFile(join(dirname(path), name))), null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  void main().catch(error => { console.error(error); process.exitCode = 1; });
