import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync, gzipSync } from 'node:zlib';
import { verifyFollowupArtifacts, verifyFollowupAdditionalLink, verifyFollowupAdditionalReport, summarizeFollowupScene, verifyFollowupOrderingReport, verifyFollowupOrderingTimingDiagnostic, verifyUiNotePreparationDiagnostic, type FollowupArtifactManifest } from './phase8g-followup-artifacts.js';
import { verifyReloadCaptures } from './phase8g-reload-captures.js';
import { ACQUIRED_FIELDS, MUTATION_MARKER } from './phase8g-shadow-mutations.js';
import { SCENE_METHODS, sceneActionProvenance } from './phase8g-ui-scene-controls.js';
import { ORDERING_POLL_CADENCE_MS, summarizeOrderingSamples, summarizeOrderingCommands } from './phase8g-ordering-controls.js';
import type { ShadowNote } from './phase8g-shadow-cache-lib.js';
import { UI_NOTE_METHODS, uiVelocityTarget } from './phase8g-ui-note-controls.js';

type Wire = Record<string, unknown>;
const base = new URL('../../../context/evidence/data/phase8g-followup-acceptance/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', base), 'utf8')) as FollowupArtifactManifest;
const files = new Map(await Promise.all(Object.values(manifest.files).map(async record => [record.file, await readFile(new URL(record.file, base))] as const)));
const hash = (value: Uint8Array): string => createHash('sha256').update(value).digest('hex');
function fixture() { return { manifest: structuredClone(manifest), files: new Map(files) }; }
function run(value: ReturnType<typeof fixture>) { return verifyFollowupArtifacts(value.manifest, async name => {
  assert(value.files.has(name)); return value.files.get(name)!;
}); }
function rewrite(value: ReturnType<typeof fixture>, role: string, change: (capture: Wire) => void): void {
  const record = value.manifest.files[role]!, capture = JSON.parse(gunzipSync(value.files.get(record.file)!).toString('utf8')) as Wire;
  change(capture); const raw = Buffer.from(JSON.stringify(capture)), zipped = gzipSync(raw, { level: 9 });
  Object.assign(record, { uncompressedSha256: hash(raw), uncompressedBytes: raw.byteLength, compressedSha256: hash(zipped), compressedBytes: zipped.byteLength });
  value.files.set(record.file, zipped);
}
function report(role: string): Wire { return JSON.parse(gunzipSync(files.get(manifest.files[role]!.file)!).toString('utf8')) as Wire; }
const afterCapture = report('reload-after'), reloadSummary = verifyReloadCaptures(report('reload-before'), afterCapture);
function notePreparationFixture(): Wire {
  const scene = report('native-scene-controls'), baseline = structuredClone(scene.baseline) as Wire, after = structuredClone(scene.after) as Wire;
  const child = String(scene.ownedTrackId), name = 'gn-8g-ui-note-diagnostic-track', clip = 'gn-8g-ui-note-diagnostic-clip';
  const trackList = structuredClone((scene.prepare as Wire).trackList) as Wire;
  ((trackList.tracks as Wire[]).find(track => track.channelId === child)!).name = name;
  const full = structuredClone((baseline.comparisons as Wire[])[0]!) as Wire, snapshot = full.diagnosticSnapshot as Wire;
  const note = structuredClone((snapshot.notes as ShadowNote[])[0]!); Object.assign(note.fields, { velocity: 80 / 127, duration: 8 / 512, durationCells: 8, rawDuration: 8 / 512 });
  snapshot.address = { trackId: child, row: 0 }; snapshot.notes = [note]; (snapshot.metadata as Wire).name = clip;
  full.authorityNotes = [structuredClone(note)]; full.authorityMetadata = structuredClone(snapshot.metadata);
  const target = { id: child, row: 0, name: clip, notes: [note] };
  const slots = (trackList.tracks as Wire[]).flatMap(track => Array.from({ length: 8 }, (_, row) => ({ id: track.channelId, row,
    exists: true, hasContent: track.channelId === reloadSummary.ownedTrackId && row < 3 || track.channelId === child && row === 0 })));
  return { marker: MUTATION_MARKER, started: scene.started, ended: scene.ended, methods: { runtimeProfile: 'phase-8-probe-v1', methods: [...UI_NOTE_METHODS] },
    stage: 'finished', controlOutcome: 'failed-or-unfinished', researchOnly: true, complete: false, eligible: false,
    missingEventContinuityProved: false, hostInputOrderingProved: false, simultaneousAuthorityScansSupported: false,
    originalTrackId: reloadSummary.ownedTrackId, ownedTrackId: child, ownedTrackName: name, ownedClipName: clip,
    plannedUiEditCount: 1, uiEditCount: 0, reacquisitionObservationCount: 0, fixtureRestored: true, temporaryFixturesRemoved: true,
    baseline, after, prepare: { trackList, sceneSnapshot: structuredClone(baseline.sceneSnapshot), target, fullComparison: full, status: full },
    expectedEditedTarget: uiVelocityTarget(target), cleanupTargetHadContent: true, cleanupSlots: slots,
    cleanupGroups: { groupControlRevision: '8g-group-controls-v1', coherent: true, fullWindow: true, researchOnly: true,
      groupMembershipProved: false, hostInputOrderingProved: false, totalCount: 6,
      tracks: (trackList.tracks as Wire[]).map(track => ({ ...track, isGroup: false, isGroupExpanded: false })) },
    nativePreparationDiagnostic: { action: 'double-click velocity reset', observedVelocityPercent: 100, singleEditAcceptance: false,
      reason: 'Native double-click reset occurred before intended edit. No finish acceptance is claimed.' } };
}
test('abandoned native note preparation retains six original oracles and zero accepted edits', () => {
  const summary = verifyUiNotePreparationDiagnostic(notePreparationFixture(), afterCapture, reloadSummary);
  assert.equal(summary.acceptedUiEdits, 0); assert.equal(summary.reacquisitionObservations, 0); assert.equal(summary.singleEditAcceptance, false);
  assert.equal(summary.originalComparisonsBefore, 3); assert.equal(summary.originalRestorationComparisons, 3);
});
test('preparation diagnostic rejects a finish, accepted edit, changed reset fact, or cleanup residue', () => {
  for (const change of [
    (value: Wire) => { value.finish = {}; },
    (value: Wire) => { value.uiEditCount = 1; },
    (value: Wire) => { value.reacquisitionObservationCount = 1; },
    (value: Wire) => { (value.nativePreparationDiagnostic as Wire).observedVelocityPercent = 99; },
    (value: Wire) => { (value.nativePreparationDiagnostic as Wire).singleEditAcceptance = true; },
    (value: Wire) => { (value.cleanupSlots as Wire[]).find(slot => slot.id === value.ownedTrackId && slot.row === 1)!.hasContent = true; },
    (value: Wire) => { ((value.after as Wire).comparisons as Wire[]).pop(); },
  ]) { const value = notePreparationFixture(); change(value); assert.throws(() => verifyUiNotePreparationDiagnostic(value, afterCapture, reloadSummary)); }
});
function orderingFixture(): Wire {
  const original = report('inventory-controls'), baseline = original.originalBefore as Wire[], restored = original.originalAfter as Wire[];
  const registry = ((original.cases as Wire[])[0]!.recovery as Wire).result;
  const root = structuredClone(afterCapture.root), nonce = (root as Wire).extensionInitNonce, info = afterCapture.info as Wire;
  const start = Date.parse(afterCapture.captured as string) + 3_600_000, at = (offset: number) => new Date(start + offset).toISOString();
  const sample: Wire = { started: at(0), ended: at(5000), before: root, after: structuredClone(root), comparePollIssued: true,
    comparePollAtElapsedMs: 0, comparePollSequence: 1,
    status: { complete: false, eligible: false, phase: 'retired', authorityAvailable: false, instrumentationRevision: MUTATION_MARKER, initDomain: info.initDomain },
    result: { complete: false, eligible: false, comparison: 'membership-mismatch', terminal: true, phase: 'retired', readMode: 'refuse',
      authorityAvailable: false, historicalSnapshot: { token: 'old' }, instrumentationRevision: MUTATION_MARKER, initDomain: info.initDomain } };
  const value: Wire = { marker: MUTATION_MARKER, started: at(0), ended: at(10_000), stage: 'finished', researchOnly: true,
    complete: false, eligible: false, callbackOriginProved: false, missingEventContinuityProved: false, hostInputOrderingProved: false,
    perBatchGetStepValuesAvailable: false, fixtureMutationsIssued: 0, fixtureRestored: true, comparePollCadenceMs: ORDERING_POLL_CADENCE_MS, comparePollCount: 1,
    ownedTrackId: reloadSummary.ownedTrackId, initial: info, initialTracks: afterCapture.tracks, finalTracks: afterCapture.tracks,
    initialRootEndpoint: original.initialRootEndpoint, finalRootEndpoint: original.initialRootEndpoint, finalScenes: 8,
    expectedRows: baseline.map(value => ((value.result as Wire).diagnosticSnapshot as Wire).notes),
    baseline: baseline.map(value => ({ ...value, inventory: { result: registry } })),
    restoration: restored.map(value => ({ ...value, inventory: { result: registry } })),
    active: { comparison: 'pending', complete: false, eligible: false, initDomain: info.initDomain, scanProgressCoordinates: 1, scanTotalCoordinates: 2048 * 128 },
    samples: [sample], beforeTrace: { extensionInitNonce: nonce, traceClearCount: 1, traceDroppedSinceClear: 0, traceRetained: 0, events: [] },
    afterTrace: { extensionInitNonce: nonce, traceClearCount: 1, traceDroppedSinceClear: 0, traceRetained: 0, events: [] },
    commandLog: { commands: [{ target: 'B', started: at(1000), ended: at(2000), completed: true }, { target: 'A', started: at(3000), ended: at(4000), completed: true }] } };
  refreshOrdering(value); return value;
}
function refreshOrdering(value: Wire): void {
  value.summary = summarizeOrderingSamples(value.samples as Wire[], String(value.ownedTrackId), (value.expectedRows as ShadowNote[][])[0]!);
  value.commandSummary = summarizeOrderingCommands(value.commandLog as Wire, value.samples as Wire[]);
}
test('ordering artifact preserves one interleaving trial, six original comparisons, and historical labels', () => {
  const summary = verifyFollowupOrderingReport(orderingFixture(), afterCapture, reloadSummary);
  assert.equal(summary.interleavingTrials, 1); assert.equal(summary.originalComparisonsBefore, 3); assert.equal(summary.originalRestorationComparisons, 3);
  assert.equal(summary.historicalMismatchLabels, 1); assert.equal(summary.historicalSnapshotSamples, 1); assert.equal(summary.outputSamples, 0);
  assert.equal(summary.callbackOriginProved, false); assert.equal(summary.hostInputOrderingProved, false);
  assert.equal((summary.commandSummary as Wire).externallyCompletedBNotSampled, true);
  assert.equal((summary.commandSummary as Wire).controllerDeliveryFailureProved, false);
});
test('ordering artifact rejects late native transitions and current mismatch output', () => {
  const late = orderingFixture(), first = (late.samples as Wire[])[0]!, start = Date.parse(first.started as string);
  const second = structuredClone(first); second.started = new Date(start + 5100).toISOString(); second.ended = new Date(start + 10_000).toISOString();
  second.comparePollIssued = false; delete second.result; (late.samples as Wire[]).push(second);
  (late.commandLog as Wire).commands = [{ target: 'B', started: new Date(start + 6000).toISOString(), ended: new Date(start + 7000).toISOString(), completed: true },
    { target: 'A', started: new Date(start + 8000).toISOString(), ended: new Date(start + 9000).toISOString(), completed: true }];
  refreshOrdering(late); assert.throws(() => verifyFollowupOrderingReport(late, afterCapture, reloadSummary), /after acquisition ended/);
  const output = orderingFixture(); Object.assign((output.samples as Wire[])[0]!.result as Wire, { authorityAvailable: true, authorityNotes: [], automaticIdentityEpoch: 0 });
  refreshOrdering(output); assert.throws(() => verifyFollowupOrderingReport(output, afterCapture, reloadSummary), /violation was observed/);
});
test('ordering artifact cannot change core, census, owner, or event proof claims', () => {
  for (const change of [
    (value: Wire) => { value.initial = { ...(value.initial as Wire), initDomain: 'old-core' }; },
    (value: Wire) => { value.initialTracks = { ...(value.initialTracks as Wire), tracks: [] }; },
    (value: Wire) => { value.ownedTrackId = 'another-owner'; },
    (value: Wire) => { value.hostInputOrderingProved = true; },
    (value: Wire) => { value.callbackOriginProved = true; },
  ]) { const value = orderingFixture(); change(value); assert.throws(() => verifyFollowupOrderingReport(value, afterCapture, reloadSummary)); }
});
function orderingTimingFixture(): Wire {
  const value = orderingFixture(), first = (value.samples as Wire[])[0]!, start = Date.parse(first.started as string);
  const second = structuredClone(first); second.started = new Date(start + 5100).toISOString(); second.ended = new Date(start + 10_000).toISOString();
  second.comparePollIssued = false; delete second.result; (value.samples as Wire[]).push(second);
  value.comparePollCadenceMs = 250;
  (value.commandLog as Wire).commands = [{ target: 'B', started: new Date(start + 6000).toISOString(), ended: new Date(start + 7000).toISOString(), completed: true },
    { target: 'A', started: new Date(start + 8000).toISOString(), ended: new Date(start + 9000).toISOString(), completed: true }];
  refreshOrdering(value); return value;
}
test('late commands remain a diagnostic and cannot become an accepted ordering control', async () => {
  const value = fixture(), diagnostic = orderingTimingFixture(), raw = Buffer.from(JSON.stringify(diagnostic)), compressed = gzipSync(raw, { level: 9 });
  const accepted = value.manifest.files['ordering-controls'];
  if (accepted) value.files.delete(accepted.file);
  delete value.manifest.files['ordering-controls']; value.manifest.retainedReportCounts['ordering-controls'] = 0;
  if (!value.manifest.pending.includes('ordering-controls')) value.manifest.pending.push('ordering-controls');
  const role = 'ordering-timing-diagnostic', file = `${role}.json.gz`;
  value.manifest.files[role] = { file, uncompressedBytes: raw.byteLength, uncompressedSha256: hash(raw),
    compressedBytes: compressed.byteLength, compressedSha256: hash(compressed) };
  value.manifest.retainedReportCounts[role] = 1; value.files.set(file, compressed);
  const summary = await run(value), retained = summary[role] as Wire;
  assert.equal(retained.interleavingTrials, 0); assert.equal(retained.acceptedInterleavingTrials, 0); assert.equal(retained.timingDiagnosticTrials, 1);
  assert.equal(retained.originalComparisonsBefore, 3); assert.equal(retained.originalRestorationComparisons, 3);
  assert.equal((retained.commandSummary as Wire).nativeCommandsOverlappedActiveAcquisition, false);
  assert.equal(summary['ordering-controls'], undefined); assert(value.manifest.pending.includes('ordering-controls'));
  assert.throws(() => verifyFollowupOrderingReport(diagnostic, afterCapture, reloadSummary));
});
test('timing diagnostic rejects active overlap, a changed core, and a current content violation', () => {
  assert.throws(() => verifyFollowupOrderingTimingDiagnostic(orderingFixture(), afterCapture, reloadSummary));
  for (const change of [
    (value: Wire) => { value.initial = { ...(value.initial as Wire), initDomain: 'old-core' }; },
    (value: Wire) => { ((value.restoration as Wire[])[0]!.result as Wire).authorityNotes = []; },
    (value: Wire) => { Object.assign((value.samples as Wire[])[0]!.result as Wire, { authorityAvailable: true, authorityNotes: [], automaticIdentityEpoch: 0 }); refreshOrdering(value); },
  ]) { const value = orderingTimingFixture(); change(value); assert.throws(() => verifyFollowupOrderingTimingDiagnostic(value, afterCapture, reloadSummary)); }
});
test('compound scene summary keeps two reported actions and only the measured aggregate fence', () => {
  const summary = summarizeFollowupScene({ cases: 1, actionProvenance: sceneActionProvenance('finish-add-move'), actionCount: 2,
    singleInsertionProved: false, automaticInsertionAcceptanceComplete: false, aggregateMutationFenceObserved: true, aggregateScanCancelled: true });
  assert.equal(summary.scope, 'aggregate Add Scene and Move Scene control'); assert.equal(summary.beforeAndAtAreOneCase, undefined);
  assert.equal(summary.singleInsertionProved, false); assert.equal(summary.actionCount, 2); assert.equal(summary.automaticInsertionAcceptanceComplete, false);
  assert.throws(() => summarizeFollowupScene({ ...summary, singleInsertionProved: true }));
  assert.throws(() => summarizeFollowupScene({ ...summary, automaticInsertionAcceptanceComplete: true }));
});
function withFinal(): ReturnType<typeof fixture> {
  const value = fixture(), tracks = ((afterCapture.tracks as Wire).tracks as Wire[]).filter(track => track.channelId !== reloadSummary.ownedTrackId)
    .map((track, index): Wire => ({ ...track, index, position: index }));
  const ids = tracks.map(track => track.channelId), cursor = { trackExists: false, slotExists: false, trackPosition: -1, sceneIndex: 0, isPinned: false, cursorTrackPinned: false };
  const selection = { trackIndex: -1, slotIndex: -1, mixerTrackIndex: 0 }, cursors = { '0': cursor, fine: { ...cursor } };
  const entry = { baselineIds: ids, baselineScenes: 8, baselineSlotsWithContent: 0, baselineSelection: selection, cursors, ownedTrackId: reloadSummary.ownedTrackId };
  const start = Date.parse(afterCapture.captured as string) + 3_600_000, at = (offset: number) => new Date(start + offset).toISOString();
  const hello = { runtimeProfile: 'normal-v1', methodCount: 85, methodsHash: 'bba7383dce25c0f0', contractVersion: 0, hostApiVersion: 25 };
  const captures: Record<string, unknown> = {
    cleanup: { started: at(0), ended: at(10_000), cleaned: true, entryState: entry, tracks },
    'cleanup-verified': { started: at(30_000), ended: at(40_000), verified: true, stateRetentionPolicy: 'retain', entryState: entry,
      baselineIds: ids, sceneCount: 8, hello, selection, cursors },
    'final-baseline': { captured: at(50_000), entryState: entry, hello, selection, cursors, stats: { initEpochMs: start + 20_000 },
      tracks: { tracks, count: 4, itemCount: 4, bankSize: 256 }, scenes: { sceneCount: 8 },
      scan: { existing: 4, withChannelId: 4, slotsWithContent: 0, sceneCount: 8, itemCount: 4, bankSize: 256 },
      slots: ids.flatMap(id => Array.from({ length: 8 }, (_, row) => ({ id, row, exists: true, hasContent: false }))) },
    'config-original': { tracks: 256, scenes: 128 },
    'config-research': { tracks: 256, scenes: 128, cacheLifecycleResearch: true, cacheShadowObservers: 2, cacheShadowSteps: 2048 },
    'config-restored': { tracks: 256, scenes: 128 },
  };
  for (const [role, capture] of Object.entries(captures)) {
    const raw = Buffer.from(JSON.stringify(capture)), zipped = gzipSync(raw, { level: 9 }), file = `${role}.json.gz`;
    value.manifest.files[role] = { file, uncompressedBytes: raw.byteLength, uncompressedSha256: hash(raw), compressedBytes: zipped.byteLength, compressedSha256: hash(zipped) };
    value.manifest.retainedReportCounts[role] = 1; value.files.set(file, zipped); value.manifest.pending = value.manifest.pending.filter(value => value !== role);
  }
  return value;
}
test('final cleanup requires the full linked observation and exact configuration group', async () => {
  const summary = await run(withFinal()); assert.equal((summary.finalBaseline as Wire).normalRuntimeRestored, true);
  assert.equal((summary.configuration as Wire).exactEntryConfigurationRestored, true); assert.equal(summary.wholeSessionComplete, false);
  const missing = withFinal(); delete missing.manifest.files['final-baseline']; missing.manifest.retainedReportCounts['final-baseline'] = 0; missing.manifest.pending.push('final-baseline');
  await assert.rejects(run(missing), /copies together/);
  const foreign = withFinal(); rewrite(foreign, 'cleanup', capture => { (capture.entryState as Wire).ownedTrackId = 'foreign-owner'; }); await assert.rejects(run(foreign));
});
test('configuration hashes do not allow equivalent JSON or a stale normal baseline', async () => {
  const changed = withFinal(), record = changed.manifest.files['config-restored']!, raw = Buffer.from('{ "tracks":256,"scenes":128 }'), zipped = gzipSync(raw, { level: 9 });
  Object.assign(record, { uncompressedBytes: raw.byteLength, uncompressedSha256: hash(raw), compressedBytes: zipped.byteLength, compressedSha256: hash(zipped) }); changed.files.set(record.file, zipped);
  await assert.rejects(run(changed), /exact entry bytes/);
  const stale = withFinal(); rewrite(stale, 'final-baseline', capture => { (capture.stats as Wire).initEpochMs = (afterCapture.stats as Wire).initEpochMs; }); await assert.rejects(run(stale));
});
function additionalFixture(role: 'native-scene-controls' | 'native-note-controls' | 'snapshot-memory'): Wire {
  const initial = structuredClone(afterCapture.info), trackList = structuredClone(afterCapture.tracks), endpoint = (report('inventory-controls').initialRootEndpoint);
  const times = { started: new Date(Date.parse(afterCapture.captured as string) + 10_000).toISOString(), ended: new Date(Date.parse(afterCapture.captured as string) + 20_000).toISOString() };
  return role === 'snapshot-memory' ? { ...times, ownedTrackId: reloadSummary.ownedTrackId, initial, rawTracks: trackList, initialRootEndpoint: endpoint, baselineScenes: 8 }
    : { ...times, originalTrackId: reloadSummary.ownedTrackId, baseline: { trackList, rootEndpoint: endpoint },
      prepare: { [role === 'native-note-controls' ? 'status' : 'info']: initial } };
}
test('new final roles require the paired core, complete ordered baseline, and exact root inputs', () => {
  for (const role of ['native-scene-controls', 'native-note-controls', 'snapshot-memory'] as const) {
    const value = additionalFixture(role); verifyFollowupAdditionalLink(role, value, afterCapture, reloadSummary);
    const old = structuredClone(value), initial = role === 'snapshot-memory' ? old.initial : (old.prepare as Wire)[role === 'native-note-controls' ? 'status' : 'info'];
    (initial as Wire).initDomain = 'another-core'; assert.throws(() => verifyFollowupAdditionalLink(role, old, afterCapture, reloadSummary));
    const changed = structuredClone(value), census = role === 'snapshot-memory' ? changed.rawTracks : (changed.baseline as Wire).trackList;
    ((census as Wire).tracks as Wire[]).reverse(); assert.throws(() => verifyFollowupAdditionalLink(role, changed, afterCapture, reloadSummary));
    const root = structuredClone(value), endpoint = role === 'snapshot-memory' ? root.initialRootEndpoint : (root.baseline as Wire).rootEndpoint;
    (endpoint as Wire).rootChannelId = 'other-root'; assert.throws(() => verifyFollowupAdditionalLink(role, root, afterCapture, reloadSummary));
  }
});
test('new native roles reject an invented second insertion or an edit-observation aggregate', () => {
  const scene = { ...additionalFixture('native-scene-controls'), marker: MUTATION_MARKER, researchOnly: true, complete: false, eligible: false,
    sceneIdentityProved: false, hostInputOrderingProved: false, stage: 'finished', fixtureRestored: true, temporaryFixturesRemoved: true,
    methods: { runtimeProfile: 'phase-8-probe-v1', methods: [...SCENE_METHODS] }, caseLabels: ['before', 'at'], atCaseDistinct: true, caseCount: 2 };
  assert.throws(() => verifyFollowupAdditionalReport('native-scene-controls', scene, afterCapture, reloadSummary));
  const note = { ...additionalFixture('native-note-controls'), marker: MUTATION_MARKER, researchOnly: true, complete: false, eligible: false,
    stage: 'finished', fixtureRestored: true, temporaryFixturesRemoved: true, uiEditCount: 1, reacquisitionObservationCount: 1, aggregateAcceptanceCount: 2 };
  assert.throws(() => verifyFollowupAdditionalReport('native-note-controls', note, afterCapture, reloadSummary));
});
test('memory diagnostics retain an earlier error without claiming the literal snapshot boundary', async () => {
  const capacity = JSON.parse(gunzipSync(await readFile(new URL('../../../context/evidence/data/phase8g-v5-acceptance/capacity.json.gz', import.meta.url))).toString('utf8')) as Wire;
  const inventory = report('inventory-controls'), staging = 160 + ACQUIRED_FIELDS.length * 64;
  const value: Wire = { ...capacity, ...additionalFixture('snapshot-memory'), callbackOriginProved: false,
    baselineSlots: inventory.slotsBefore, finalSlots: inventory.slotsAfter, selectedGlobalBudgetsCovered: false,
    snapshotMemoryBoundaryObserved: false, error: 'host control stopped before the first channel',
    cases: [{ coordinates: 256, noteCount: 4096, batches: [] }],
    sourceBudgetInference: { selectedSnapshotLimitBytes: 16 * 1024 * 1024, selectedRecorderOccupiedLimit: 2048,
      authorityStagingPerNoteEstimatedBytes: staging, authority8192EstimatedBytes: 8192 * staging,
      predictedEnriched8192IsMeasurement: false, serializedBytesAreMemoryMeasurement: false } };
  const summary = verifyFollowupAdditionalReport('snapshot-memory', value, afterCapture, reloadSummary);
  assert.equal(summary.outcome, 'diagnostic-error'); assert.equal(summary.literalBoundaryReasonObserved, false);
  assert.equal(summary.sourceBudgetInferenceIsMeasurement, false); assert.equal(summary.selectedGlobalBudgetsCovered, false);
  assert.throws(() => verifyFollowupAdditionalReport('snapshot-memory', { ...value, snapshotMemoryBoundaryObserved: true }, afterCapture, reloadSummary));
  assert.throws(() => verifyFollowupAdditionalReport('snapshot-memory', { ...value, selectedGlobalBudgetsCovered: true }, afterCapture, reloadSummary));
  assert.throws(() => verifyFollowupAdditionalReport('snapshot-memory', { ...value, error: undefined }, afterCapture, reloadSummary));
});
test('retained paired captures verify only the measured reload instance change', async () => {
  const summary = await run(fixture()), reload = summary.reload as Wire;
  assert.equal(summary.verifiedFiles, Object.keys(manifest.files).length); assert.equal(reload.loadedInstanceNonceChanged, true); assert.equal(reload.chainUUIDsEqual, true);
  assert.equal(summary.wholeSessionComplete, false); assert.equal(summary.projectContinuityProved, false); assert.equal(summary.identityDetectionProved, false);
});
test('a missing pair or an unverified extra report cannot change the corpus silently', async () => {
  const missing = fixture(); delete missing.manifest.files['reload-after']; await assert.rejects(run(missing), /both reload captures/);
  const extra = fixture(); extra.manifest.files.unverified = extra.manifest.files['reload-before']!; await assert.rejects(run(extra), /unsupported followup artifact role/);
});
test('retained compound scene evidence cannot count as the isolated single action role', async () => {
  const compound = report('native-scene-add-move'), summary = await run(fixture());
  assert.equal((summary['native-scene-add-move'] as Wire).actionCount, 2);
  assert.equal((summary['native-scene-add-move'] as Wire).singleInsertionProved, false);
  assert.throws(() => verifyFollowupAdditionalReport('native-scene-controls', compound, afterCapture, reloadSummary), /different corpus role/);
});
test('structural corpus uses the measured reload instance and retains all fourteen fences', async () => {
  const summary = await run(fixture()), structure = summary.structure as Wire;
  assert.equal(structure.recoveryCases, 14); assert.equal(structure.automaticFencesObserved, 14); assert.equal(structure.structuralScopeComplete, false);
  const missing = fixture(); delete missing.manifest.files.structure; missing.manifest.pending.push('structure');
  await assert.rejects(run(missing), /retained report count changed/);
  const old = fixture(); rewrite(old, 'structure', report => { (report.initial as Wire).initDomain = 'old-core'; });
  await assert.rejects(run(old), /different loaded core/);
  const short = fixture(); rewrite(short, 'structure', report => { (report.cases as Wire[]).pop(); }); await assert.rejects(run(short));
});
test('structural raw hashes cannot hide missing cleanup or current output after a fence', async () => {
  const cleanup = fixture(); rewrite(cleanup, 'structure', report => { report.fixtureRestored = false; }); await assert.rejects(run(cleanup));
  const stale = fixture(); rewrite(stale, 'structure', report => { ((report.cases as Wire[])[0]!.automaticRead as Wire).authorityNotes = []; });
  await assert.rejects(run(stale));
});
test('inventory reports retain private progress and stable terminal polls before explicit recovery', async () => {
  const summary = await run(fixture()), inventory = summary.inventory as Wire;
  assert.equal(inventory.controls, 3); assert.equal(inventory.deadlineHeartbeats, 40);
  assert.equal(inventory.missingEventContinuityProved, false); assert.equal(inventory.ambiguousMoveContinuityProved, false);
  const noProgress = fixture(); rewrite(noProgress, 'inventory-controls', report => {
    (((report.cases as Wire[])[0]!.partial as Wire).inventoryRebuild as Wire).enumeratedCells = 0;
  }); await assert.rejects(run(noProgress));
  const retry = fixture(); rewrite(retry, 'inventory-controls', report => {
    const terminal = (((report.cases as Wire[])[0]!.terminalPolls as Wire[])[1]!.inventoryRebuild as Wire);
    (terminal.token as Wire).rebuild = Number((terminal.token as Wire).rebuild) + 1;
  }); await assert.rejects(run(retry));
});
test('inventory evidence cannot hide a shortened deadline or leave its temporary clip', async () => {
  const short = fixture(); rewrite(short, 'inventory-controls', report => { (report.cases as Wire[])[1]!.waitedMs = 39_999; });
  await assert.rejects(run(short));
  const residue = fixture(); rewrite(residue, 'inventory-controls', report => { (report.slotsAfter as Wire[]).find(slot => slot.id === report.ownedTrackId && slot.row === 3)!.hasContent = true; });
  await assert.rejects(run(residue));
});
test('native group evidence proves its measured fence and cancellation without membership proof', async () => {
  const summary = await run(fixture()), group = summary.group as Wire;
  assert.equal(group.staleComparisonCancelled, true); assert.equal(group.groupMembershipProved, false); assert.equal(group.wrapperDeleted, false);
  const cancelled = fixture(); rewrite(cancelled, 'native-group-controls', report => { (report.grouped as Wire).staleComparisonCancelled = false; });
  await assert.rejects(run(cancelled));
  const membership = fixture(); rewrite(membership, 'native-group-controls', report => { report.groupMembershipProved = true; }); await assert.rejects(run(membership));
});
test('native group cleanup requires manual ungroup and exact baseline restoration', async () => {
  const grouped = fixture(); rewrite(grouped, 'native-group-controls', report => { report.nativeUngroupConfirmed = false; }); await assert.rejects(run(grouped));
  const child = fixture(); rewrite(child, 'native-group-controls', report => { (report.cleanupMixer as Wire).isGroup = true; }); await assert.rejects(run(child));
  const census = fixture(); rewrite(census, 'native-group-controls', report => { (((report.after as Wire).trackList as Wire).tracks as Wire[]).pop(); }); await assert.rejects(run(census));
});
test('unsafe filenames and unbounded declarations fail before file reads', async () => {
  for (const change of [
    (value: ReturnType<typeof fixture>) => { value.manifest.files['reload-before']!.file = '../reload-before.json.gz'; },
    (value: ReturnType<typeof fixture>) => { value.manifest.files['reload-before']!.uncompressedBytes = 129 * 1024 * 1024; },
  ]) { const value = fixture(); change(value); let reads = 0;
    await assert.rejects(verifyFollowupArtifacts(value.manifest, async () => { reads++; return Buffer.alloc(0); })); assert.equal(reads, 0); }
});
test('raw and compressed hashes and exact lengths reject changed captures', async () => {
  for (const field of ['compressedSha256', 'uncompressedSha256'] as const) {
    const value = fixture(); value.manifest.files['reload-after']![field] = '0'.repeat(64); await assert.rejects(run(value), /SHA256 changed/);
  }
  for (const field of ['compressedBytes', 'uncompressedBytes'] as const) {
    const value = fixture(); value.manifest.files['reload-after']![field]++; await assert.rejects(run(value), /byte count changed/);
  }
});
test('truncated streams and nondeterministic gzip timestamps fail even with new compressed hashes', async () => {
  const cut = fixture(), record = cut.manifest.files['reload-after']!, old = cut.files.get(record.file)!;
  const truncated = old.subarray(0, old.length - 8); cut.files.set(record.file, truncated); record.compressedSha256 = hash(truncated); record.compressedBytes = truncated.byteLength;
  await assert.rejects(run(cut));
  const timestamp = fixture(), entry = timestamp.manifest.files['reload-after']!, bytes = Buffer.from(timestamp.files.get(entry.file)!);
  bytes[4] = 1; timestamp.files.set(entry.file, bytes); entry.compressedSha256 = hash(bytes);
  await assert.rejects(run(timestamp), /timestamp is not deterministic/);
});
test('recomputed checksums cannot certify an old deployment or an incomplete capture', async () => {
  const marker = fixture(); rewrite(marker, 'reload-after', capture => { delete (capture.info as Wire).authorityBindingRevision; });
  await assert.rejects(run(marker));
  const incomplete = fixture(); rewrite(incomplete, 'reload-after', capture => { delete capture.stats; }); await assert.rejects(run(incomplete));
});
test('rehashed retained note mismatches cannot pass through a later recovery match', async () => {
  const original = report('native-note-controls');
  assert.equal(((original.finish as Wire).recoveryComparison as Wire).comparison, 'match');
  for (const cause of ['mismatch', 'metadata-mismatch', 'membership-mismatch', 'field-mismatch', 'coverage-mismatch']) {
    const value = fixture(); rewrite(value, 'native-note-controls', capture => {
      (((capture.finish as Wire).reacquisition as Wire).comparison as Wire).comparison = cause;
    });
    await assert.rejects(run(value), /warm comparison reported/);
  }
});
test('rehashed retained note report rejects unknown outcomes and refusal output', async () => {
  for (const outcome of [null, [], 'match', {}, { complete: false, eligible: false, comparison: 'pending' },
    { complete: false, eligible: false, comparison: 'unknown' },
    { complete: false, eligible: false, comparison: 'window-changed', reason: 'window-changed', terminal: true,
      readMode: 'refuse', authorityAvailable: false, fallbackPerformed: false, authorityNotes: [] }]) {
    const value = fixture(); rewrite(value, 'native-note-controls', capture => { ((capture.finish as Wire).reacquisition as Wire).comparison = outcome; });
    await assert.rejects(run(value));
  }
});
test('manifest flags cannot turn a narrow reload pair into session or continuity proof', async () => {
  for (const field of ['wholeSessionComplete', 'identityDetectionProved', 'projectContinuityProved', 'hostInputFenceProved', 'complete', 'eligible']) {
    const value = fixture(); (value.manifest as unknown as Wire)[field] = true; await assert.rejects(run(value));
  }
  const value = fixture(); value.manifest.pending = []; await assert.rejects(run(value), /cannot close the session/);
});
