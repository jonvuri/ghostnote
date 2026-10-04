/** Independent source estimates for the selected 8g5c scope and combined storage limit. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { ACQUIRED_FIELDS } from './phase8g-shadow-mutations.js';
import { baseEstimate, layoutNotes, noteEstimate, snapshotEstimate, SNAPSHOT_LIMIT, UNSUPPORTED_FIELDS, type Layout } from './e219-snapshot-budgets-lib.js';
import { fullTracks, verifyFlatScale } from './phase8g5c-scale-lib.js';
import { publishedOccupancy } from './phase8g5b-slot-lib.js';
import { ALLOCATION_STATS_REVISION, COUNTED_ALLOCATION_MARKER, OWNED_PROJECT, sweepConfig, type Wire } from './phase8g5c-storage-lib.js';
import { independentNotes, verifyComparison } from './phase8g4-native-lib.js';
import { checkMutationNotes } from './phase8g-shadow-mutations.js';
import type { ShadowNote } from './phase8g-shadow-cache-lib.js';
export const COMBINED_MARKER = '8g5c-combined-storage-v4';
export const COMBINED_C3_MARKER = '8g5c-combined-storage-v3';
export const WITNESS_BYTES = 40 + 2 * ('shadow-normalized-v1:'.length + 64);
export const COMBINED_LIMIT = 24 * 1024 * 1024;
export const SUPPORTED_TRACKS = 512;
export const AUTHORITY_NOTE_BYTES = 160 + ACQUIRED_FIELDS.length * 64;
export interface Payload { metadata: Wire; notes: { fields: Wire }[] }
export interface LedgerOracle {
  census: Wire; topology: Wire; inventory: Wire; payloads: Payload[];
  authorityNotes: unknown[]; candidateWitnessReserved?: boolean;
}
export function clipMetadata(raw: Wire): Wire {
  assert.equal(raw.exists, true);
  const metadata: Wire = { name: raw.name, isLoopEnabled: raw.loopEnabled };
  assert.equal(typeof metadata.name, 'string'); assert.equal(typeof metadata.isLoopEnabled, 'boolean');
  for (const key of ['playStart', 'playStop', 'loopStart', 'loopLength', 'colorRed', 'colorGreen', 'colorBlue', 'colorAlpha']) {
    assert.equal(typeof raw[key], 'number'); assert(Number.isFinite(raw[key])); metadata[key] = raw[key];
  }
  return metadata;
}
export function calibratedNotes(raw: Wire, layout: Layout, excess = false): ShadowNote[] {
  const calibration = independentNotes(raw); assert.equal(calibration.length, 127);
  for (let velocity = 1; velocity <= 127; velocity++) {
    const matches = calibration.filter(note => note.channel === 0 && note.cell === 0 && note.pitch === velocity - 1);
    assert.equal(matches.length, 1); assert(Math.abs(Number(matches[0]!.fields.velocity) - velocity / 127) < 1e-6);
    assert.equal(matches[0]!.fields.rawDuration, 1 / 512);
  }
  return layoutNotes(layout).map((note, index) => {
    const velocity = excess && index === 0 ? layout.a : note.velocity;
    const source = calibration.find(row => row.pitch === velocity - 1); assert(source);
    return { channel: note.channel, cell: note.cell, pitch: note.pitch, fields: { ...source.fields } };
  });
}
export function verifyBudgetComparison(value: Wire, expected: ShadowNote[], metadata: Wire, trackId: string, excess = false): void {
  assert.equal(value.instrumentationRevision, COMBINED_MARKER); assert.equal(value.complete, false); assert.equal(value.eligible, false);
  assert.equal(value.comparison, excess ? 'combined-storage-budget' : 'match');
  assert.equal(value.authorityAvailable, true); assert.equal(value.fallbackPerformed, true); assert.equal(value.stepWindowConfirmed, true);
  assert.equal(value.readMode, 'exact-fallback'); assert.equal(value.contentComparisonComplete, !excess);
  assert.equal(value.authorityNoteCount, expected.length); assert.deepEqual(value.authorityMetadata, metadata);
  assert.deepEqual(checkMutationNotes(value.authorityNotes as ShadowNote[], expected), []);
  for (const coverage of [value.authorityCoverage] as Wire[]) {
    assert.equal(coverage.startCell, 0); assert.equal(coverage.width, 2048); assert.equal(coverage.allChannels, true);
    assert.equal(coverage.timingBasis, '1/512-beat'); assert.deepEqual([...coverage.fields as string[]].sort(), [...ACQUIRED_FIELDS].sort());
  }
  if (excess) {
    assert.equal(value.diagnosticSnapshot, undefined); assert.equal(value.historicalSnapshot, undefined);
    assert.equal(value.retainedSnapshotEstimatedBytes, 0); assert.equal((value.domainObjects as Wire).retainedSnapshotRecords, 0);
    assert.equal((value.resourceAccounting as Wire).candidateSnapshotEstimatedBytes, 0);
    assert.equal((value.snapshotCandidate as Wire).combinedRejectedEstimatedBytes, COMBINED_LIMIT + 2);
  } else {
    const snapshot = value.diagnosticSnapshot as Wire;
    assert.deepEqual(snapshot.address, { trackId, row: 0 }); assert.deepEqual(snapshot.metadata, metadata);
    assert.match(String(snapshot.fingerprint), /^shadow-normalized-v1:[a-f0-9]{64}$/);
    assert.deepEqual(checkMutationNotes(snapshot.notes as ShadowNote[], expected), []);
    assert.equal(snapshot.payloadEstimatedBytes, snapshotEstimate(metadata, expected));
    assert.equal((value.snapshotCandidate as Wire).combinedPeakEstimatedBytes, COMBINED_LIMIT);
  }
}
/** Verify an independently calibrated live boundary and its restored fixture. */
function verifyBudgetReport(report: Wire, baseline: Wire, first: Wire, other: Wire, mode: 'full' | 'reader' | 'drain'): Wire {
  assert.equal(report.schema, 'phase8g5c-combined-budget-v1'); assert.equal(report.marker, COMBINED_MARKER);
  assert.equal(report.project, OWNED_PROJECT); assert.equal(report.complete, false); assert.equal(report.eligible, false);
  if (mode === 'full') assert.equal(report.error, undefined);
  else { assert.match(String(report.error), /live read did not settle/); assert.equal(report.combinedStorageAccepted, false);
    assert.equal(report.recovery, undefined); assert.equal(report.recoveryOther, undefined); assert.equal(report.infoEvicted, undefined); }
  assert.equal(report.restoreError, undefined); assert.equal(report.fixtureRestored, true);
  assert.equal(baseline.baselinePassed, true); assert.equal((report.stats as Wire).initEpochMs, (baseline.stats as Wire).initEpochMs);
  assert.equal(report.archiveSha256, baseline.archiveSha256); assert.equal(report.configSha256, baseline.configSha256);
  assert.deepEqual(report.census, baseline.census); assert.deepEqual(report.censusAfter, report.census);
  const oracle = { census: baseline.census as Wire, topology: baseline.topology as Wire, inventory: baseline.inventory as Wire };
  const ledger = (value: Wire, payloads: Payload[], authorityNotes: unknown[] = []): Wire => verifyCombinedLedger(value, { ...oracle, payloads, authorityNotes });
  ledger(report.infoEntry as Wire, []);
  const otherResult = report.otherResident as Wire; verifyComparison(otherResult, other, COMBINED_MARKER, [84]);
  const otherPayload = { metadata: clipMetadata(other.metadata as Wire), notes: independentNotes(other.notes as Wire) };
  ledger({ ...otherResult, resourceAccounting: otherResult.publicationResourceAccounting }, [otherPayload], otherResult.authorityNotes as unknown[]);
  const calibration = report.calibration as Wire, calNotes = independentNotes(calibration.notes as Wire);
  assert.equal(calNotes.length, 127);
  const result = calibration.result as Wire, metadata = clipMetadata(calibration.metadata as Wire);
  assert.equal(result.comparison, 'match'); assert.deepEqual(checkMutationNotes(result.authorityNotes as ShadowNote[], calNotes), []);
  assert.deepEqual(checkMutationNotes((result.diagnosticSnapshot as Wire).notes as ShadowNote[], calNotes), []);
  assert.deepEqual(result.authorityMetadata, metadata); assert.deepEqual(metadata, clipMetadata(first.metadata as Wire));
  const calLedger = ledger({ ...result, resourceAccounting: result.publicationResourceAccounting }, [otherPayload, { metadata, notes: calNotes }], calNotes);
  const coordinates = new Set(calNotes.map(note => `${note.cell}:${note.pitch}`)).size;
  const fixed = Number(calLedger.totalEstimatedBytes) - snapshotEstimate(metadata, calNotes) - calNotes.length * AUTHORITY_NOTE_BYTES - coordinates * 56;
  assert.equal(report.fixedEstimatedBytes, fixed);
  const costs = new Map(calNotes.map(note => [note.pitch + 1, noteEstimate(note.fields)]));
  const base = baseEstimate(metadata), layout = report.layout as unknown as Layout;
  assert.deepEqual(layout, solveCombinedLayout(fixed, base, costs, 100));
  const expected = calibratedNotes(calibration.notes as Wire, layout), grown = calibratedNotes(calibration.notes as Wire, layout, true);
  assert.equal(snapshotEstimate(metadata, grown) - snapshotEstimate(metadata, expected), 2);
  for (const key of mode === 'full' ? ['equality', 'excess', 'recovery'] : ['equality', 'excess']) {
    const arm = report[key] as Wire, value = arm.result as Wire, notes = key === 'excess' ? grown : expected;
    assert.deepEqual(checkMutationNotes(independentNotes(arm.notes as Wire), notes), []);
    verifyBudgetComparison(value, notes, metadata, String(first.trackId), key === 'excess');
    const payloads = key === 'excess' ? [] : [otherPayload, { metadata, notes }];
    const peak = ledger({ ...value, resourceAccounting: value.publicationResourceAccounting }, payloads, notes);
    ledger(value, payloads);
    if (key !== 'excess') assert.equal(peak.totalEstimatedBytes, COMBINED_LIMIT);
  }
  if (mode !== 'reader') {
    const exact = report.exactFallback as Wire;
    const shedViews = (report.excess as Wire).viewsAfter as Wire[]; assert.equal(shedViews.length, 2);
    for (const view of shedViews) {
      assert.equal(view.complete, false); assert.equal(view.eligible, false);
      for (const key of ['historicalSnapshot', 'authoritativeSnapshot', 'diagnosticSnapshot']) assert.equal(view[key], undefined);
      assert.equal((view.resourceAccounting as Wire).snapshotDomainEstimatedBytes, 0);
    }
    assert.equal(exact.terminal, true); assert.equal(exact.authorityAvailable, true); assert.equal(exact.fallbackPerformed, true);
    assert.equal(exact.cacheMembershipUsed, false); assert.equal(exact.cacheResidenceAdmitted, false);
    assert.equal(exact.complete, false); assert.equal(exact.eligible, false); assert.equal(exact.authorityNoteCount, grown.length);
    assert.deepEqual(exact.address, { trackId: first.trackId, row: 0 }); assert.deepEqual(exact.authorityMetadata, metadata);
    assert.deepEqual(checkMutationNotes(exact.authorityNotes as ShadowNote[], grown), []); ledger(exact, [], grown);
    assert.equal((report.exactStart as Wire).phase, 'binding');
  } else {
    assert.equal(report.exactFallback, undefined);
    const views = (report.excess as Wire).viewsAfter as Wire[]; assert.equal(views.length, 2);
    assert.equal(views[0]!.scanActive, true); assert.equal(views[1]!.reason, 'authority-scan-busy');
  }
  if (mode === 'full') {
    const recoveryOther = report.recoveryOther as Wire; verifyComparison(recoveryOther, other, COMBINED_MARKER, [84]);
    ledger(recoveryOther, [otherPayload]);
    assert.equal((report.infoEvicted as Wire).resident, 0); ledger(report.infoEvicted as Wire, []);
  }
  assert.deepEqual(independentNotes(report.restoredNotes as Wire), independentNotes(first.notes as Wire));
  assert.deepEqual(report.restoredMetadata, first.metadata);
  verifyComparison(report.restoredComparison as Wire, first, COMBINED_MARKER);
  assert.equal((report.scanAfter as Wire).slotsWithContent, 6); assert.equal((report.scanAfter as Wire).existing, SUPPORTED_TRACKS);
  assert.deepEqual(publishedOccupancy(report.inventoryAfter as Wire), publishedOccupancy(baseline.inventory as Wire));
  assert.equal((report.infoFinal as Wire).resident, 0); ledger(report.infoFinal as Wire, []);
  for (const allocation of (mode === 'full' ? [report.allocationWorking, report.allocationEvicted] : [report.allocationWorking]) as Wire[]) {
    const memory = allocation.jvmMemory as Wire; assert.equal(memory.scope, 'shared-jvm'); assert.equal(memory.forcedGc, false);
    assert(Number(memory.usedBytes) > 0 && Number(memory.usedBytes) <= Number(memory.committedBytes));
  }
  return { liveCombinedEquality: true, liveCombinedExcess: true, independentExactFallback: mode !== 'reader', liveRecovery: mode === 'full',
    fixtureRestored: true, workingNotes: layout.total, complete: false, eligible: false };
}
export function verifyCombinedBudget(report: Wire, baseline: Wire, first: Wire, other: Wire): Wire {
  return verifyBudgetReport(report, baseline, first, other, 'full');
}
/** Preserve harness failures and verify only the completed live arms. */
export function verifyCombinedBudgetDiagnostic(report: Wire, baseline: Wire, first: Wire, other: Wire, mode: 'reader' | 'drain'): void {
  verifyBudgetReport(report, baseline, first, other, mode);
}
/** The continuation must keep every earlier observation unchanged. */
export function verifyBudgetContinuation(report: Wire, source: Wire, rawSha256: string): void {
  assert.equal(report.continuedFromRawSha256, rawSha256); assert.equal(report.precedingError, source.error);
  assert(Number.isFinite(Date.parse(String(report.continuationStarted))));
  assert(Date.parse(String(report.continuationStarted)) >= Date.parse(String(source.finished)));
  for (const key of ['stats', 'census', 'infoEntry', 'otherResident', 'calibration', 'fixedEstimatedBytes', 'layout',
    'equality', 'allocationWorking', 'excess', 'exactStart', 'exactProgress', 'exactFallback', 'archiveSha256', 'configSha256'])
    assert.deepEqual(report[key], source[key], `unchanged preceding observation: ${key}`);
}
/** These diagnostic polls prove only reader startup, without content acceptance. */
export function verifyExactReaderDiagnostic(report: Wire, baseline: Wire): void {
  assert.equal(report.schema, 'phase8g5c-exact-reader-diagnostic-v1');
  assert.equal(report.complete, false); assert.equal(report.eligible, false);
  const rows = report.rows as Wire[]; assert.equal(rows.length, 4);
  assert.deepEqual(rows.map(row => row.operation), ['info', 'exactPoll', 'exactStart', 'exactPoll']);
  const domain = ((baseline.comparisons as Wire[])[0]!).initDomain;
  for (const row of rows) {
    const value = row.value as Wire;
    assert.equal(value.instrumentationRevision, COMBINED_MARKER); assert.equal(value.initDomain, domain);
    assert.equal(value.complete, false); assert.equal(value.eligible, false); assert.equal(value.authorityAvailable, false);
  }
  for (const [index, phase] of [[1, 'idle'], [2, 'binding'], [3, 'binding']] as const) {
    assert.equal((rows[index]!.value as Wire).phase, phase); assert.equal((rows[index]!.value as Wire).terminal, false);
  }
}
/** Pin the prepared normal restoration while the research fixture is still active. */
export function verifyNormalDeployment(report: Wire, budget: Wire, entry: Wire): void {
  assert.equal(report.schema, 'phase8g5c-normal-deployment-v1');
  assert.equal(report.complete, false); assert.equal(report.eligible, false); assert.equal(report.combinedStorageAccepted, false);
  assert.equal(report.normalControllerReplacementPending, true); assert.equal(report.ownedFixtureDiscardPending, true);
  assert.equal(report.protectedProject, 'New 3'); assert.equal(report.ownedProject, OWNED_PROJECT);
  assert.equal(report.priorInitialization, (budget.stats as Wire).initEpochMs); assert.equal(report.priorMarker, COMBINED_MARKER);
  assert.equal(report.fixtureRestored, true); assert.equal(budget.fixtureRestored, true);
  assert.equal(report.cacheResident, 0); assert.equal(report.physicalPendingHints, 0);
  assert.equal(report.researchArchiveSha256, budget.archiveSha256); assert.equal(report.configSha256, entry.configSha256);
  assert.match(String(report.normalArchiveSha256), /^[a-f0-9]{64}$/);
  assert(Number(report.normalArchiveMtimeMs) > Number(report.priorInitialization));
}
/** Compare both final protected reads with the adopted reader and empty clip. */
export function verifyStorageCleanup(report: Wire, deployment: Wire, restoration: Wire, adopted: Wire): void {
  assert.equal(report.schema, 'phase8g5c-cleanup-v1'); assert.equal(report.complete, false); assert.equal(report.eligible, false);
  assert.equal(report.sessionWorkComplete, true); assert.equal(report.operatorDiscardedOwnedFixture, true);
  assert.equal(report.ownedFixture, OWNED_PROJECT); assert.equal(report.protectedProject, 'New 3');
  assert.equal(report.protectedProjectSaved, false); assert.equal(report.protectedProjectClosed, false);
  assert.equal(report.researchArchiveRemoved, true); assert.equal(report.researchArchiveSha256, deployment.researchArchiveSha256);
  assert.equal(report.normalArchiveSha256, deployment.normalArchiveSha256); assert.equal(report.configSha256, deployment.configSha256);
  assert.equal(restoration.schema, 'phase8g5a-normal-restoration-v1'); assert.equal(restoration.error, undefined);
  assert.equal(restoration.stateValuesRestored, true); assert.equal(restoration.project, 'New 3');
  assert.equal(restoration.complete, false); assert.equal(restoration.eligible, false);
  assert.equal(restoration.configSha256, deployment.configSha256);
  const hello = restoration.hello as Wire;
  assert.equal(hello.runtimeProfile, 'normal-v1'); assert.equal(hello.methodCount, 85); assert.equal(hello.methodsHash, 'bba7383dce25c0f0');
  const stats = restoration.stats as Wire;
  assert(Number(stats.initEpochMs) > Number(deployment.priorInitialization));
  assert(Number(stats.initEpochMs) >= Number(deployment.normalArchiveMtimeMs));
  assert.equal(report.normalInitialization, stats.initEpochMs);
  const config = stats.config as Wire;
  assert.equal(config.cacheLifecycleResearch, false); assert.equal(config.cacheShadowObservers, 0);
  assert.equal(config.tracks, 256); assert.equal(config.scenes, 128);
  const stateValues = (state: Wire): Wire => {
    const scan = { ...state.scan as Wire }, selection = { ...state.selection as Wire };
    delete scan.scanMicros; delete selection.changes; delete selection.revision;
    return { ...state, scan, selection };
  };
  for (const key of ['baseline', 'confirmation']) assert.deepEqual(stateValues(restoration[key] as Wire), stateValues(adopted.baseline as Wire));
  const preserved = adopted.preservedClip as Wire;
  assert.deepEqual(restoration.metadata, preserved.metadata); assert.deepEqual(restoration.launchSettings, preserved.launchSettings);
  const noteValues = (state: Wire): Wire => { const copy = { ...state }; delete copy.scanMicros; return copy; };
  for (const key of ['notes', 'confirmationNotes']) assert.deepEqual(noteValues(restoration[key] as Wire), noteValues(preserved.notes as Wire));
}
export function verifyCombinedDeployment(report: Wire, prior: Wire): void {
  assert.equal(report.schema, 'phase8g5c-combined-deployment-v1'); assert.equal(report.project, OWNED_PROJECT);
  assert([COMBINED_MARKER, COMBINED_C3_MARKER].includes(String(report.marker))); assert.equal(report.complete, false); assert.equal(report.eligible, false);
  assert.equal(report.combinedStorageAccepted, false);
  if (report.marker === COMBINED_C3_MARKER) {
    assert.equal(prior.schema, 'phase8g5c-allocation-v1'); assert.equal(prior.instrumentationRevision, COUNTED_ALLOCATION_MARKER);
    assert.equal(prior.fixture, 'populated'); assert.equal(prior.capacity, SUPPORTED_TRACKS); assert.equal(prior.error, undefined);
  } else {
    assert.equal(prior.schema, 'phase8g5c-combined-baseline-v1'); assert.equal(prior.marker, COMBINED_C3_MARKER);
    assert.equal(prior.baselinePassed, false); assert.match(String(prior.error), /independent identityAndWitnessEstimatedBytes/);
  }
  assert.equal((report.stats as Wire).initEpochMs, (prior.stats as Wire).initEpochMs);
  assert(Number(report.archiveMtimeMs) > Number((report.stats as Wire).initEpochMs));
  assert.match(String(report.archiveSha256), /^[a-f0-9]{64}$/);
  assert.notEqual(report.archiveSha256, prior.archiveSha256);
  assert.deepEqual(report.config, sweepConfig(SUPPORTED_TRACKS, true));
  assert.equal(report.configSha256, createHash('sha256').update(JSON.stringify(report.config, null, 2) + '\n').digest('hex'));
  assert.deepEqual(report.census, prior.tracks ?? prior.census); assert.deepEqual(report.censusAfter, report.census);
  verifyFlatScale(report.topology as Wire, report.census as Wire);
  assert.equal((report.scan as Wire).slotsWithContent, 6);
  assert.deepEqual(publishedOccupancy(report.inventory as Wire), publishedOccupancy(prior.inventory as Wire));
}
/** Recompute publication peaks and post-eviction values from the owned note controls. */
export function verifyCombinedBaseline(report: Wire, deployment: Wire, states: Wire[]): void {
  assert.equal(report.schema, 'phase8g5c-combined-baseline-v1'); assert.equal(report.project, OWNED_PROJECT);
  assert.equal(report.marker, deployment.marker); assert([COMBINED_MARKER, COMBINED_C3_MARKER].includes(String(report.marker)));
  assert.equal(report.complete, false); assert.equal(report.eligible, false);
  assert.equal(report.combinedStorageAccepted, false); assert.equal(report.error, undefined);
  assert.equal(report.archiveSha256, deployment.archiveSha256); assert.equal(report.configSha256, deployment.configSha256);
  assert(Number((report.stats as Wire).initEpochMs) > Number((deployment.stats as Wire).initEpochMs));
  assert(Number((report.stats as Wire).initEpochMs) >= Number(deployment.archiveMtimeMs));
  const hello = report.hello as Wire;
  assert.equal(hello.runtimeProfile, 'phase-8-probe-v1'); assert.equal(hello.methodCount, 97); assert.equal(hello.methodsHash, 'f03f19414f40e3d3');
  for (const [key, value] of Object.entries(deployment.config as Wire)) if (key !== 'recordChars') assert.equal(((report.stats as Wire).config as Wire)[key], value);
  assert.deepEqual(report.census, deployment.census); assert.deepEqual(report.censusAfter, report.census);
  assert.deepEqual(publishedOccupancy(report.inventory as Wire), publishedOccupancy(deployment.inventory as Wire));
  for (const scan of [report.scanBefore, report.scanAfter] as Wire[]) { assert.equal(scan.slotsWithContent, 6); assert.equal(scan.existing, SUPPORTED_TRACKS); }
  const oracle = { census: report.census as Wire, topology: report.topology as Wire, inventory: report.inventory as Wire };
  const ledger = (info: Wire, payloads: Payload[], authorityNotes: unknown[] = []): void => { verifyCombinedLedger(info, { ...oracle, payloads, authorityNotes }, String(report.marker)); };
  assert.equal((report.infoCold as Wire).resident, 0); ledger(report.infoCold as Wire, []);
  const comparisons = report.comparisons as Wire[]; assert.equal(comparisons.length, 3); assert.equal(states.length, 3);
  let first: Payload | undefined, last: Payload | undefined;
  for (let index = 0; index < comparisons.length; index++) {
    const value = comparisons[index]!, state = states[index]!;
    verifyComparison(value, state, String(report.marker), [60, 72, 84]);
    const raw = state.metadata as Wire, metadata: Wire = { name: raw.name, isLoopEnabled: raw.loopEnabled };
    for (const field of ['playStart', 'playStop', 'loopStart', 'loopLength', 'colorRed', 'colorGreen', 'colorBlue', 'colorAlpha']) metadata[field] = raw[field];
    const payload = { metadata, notes: independentNotes(state.notes as Wire) };
    const retained = index === 0 ? [payload] : [first!, payload];
    ledger({ ...value, resourceAccounting: value.publicationResourceAccounting }, retained, value.authorityNotes as unknown[]);
    if (report.marker === COMBINED_MARKER) assert.equal((value.snapshotCandidate as Wire).combinedPeakEstimatedBytes,
      (value.publicationResourceAccounting as Wire).totalEstimatedBytes, 'publication has no unreserved witness growth');
    ledger(value, retained);
    if (index === 0) first = payload; else last = payload;
  }
  assert.equal((report.infoWorking as Wire).resident, 2); ledger(report.infoWorking as Wire, [first!, last!]);
  assert.equal((report.infoEvicted as Wire).resident, 0); ledger(report.infoEvicted as Wire, []);
  for (const allocation of [report.allocationCold, report.allocationWorking, report.allocationEvicted] as Wire[]) {
    assert.equal(allocation.revision, ALLOCATION_STATS_REVISION);
    const memory = allocation.jvmMemory as Wire;
    assert.equal(memory.scope, 'shared-jvm'); assert.equal(memory.forcedGc, false);
    for (const key of ['usedBytes', 'committedBytes', 'maximumBytes']) assert(Number.isSafeInteger(memory[key]) && Number(memory[key]) > 0);
    assert(Number(memory.usedBytes) <= Number(memory.committedBytes)); assert(Number(memory.committedBytes) <= Number(memory.maximumBytes));
  }
}
/** Preserve C3's verifier failure. Recompute its completed reads with the full witness prefix. */
export function verifyCombinedDiagnostic(report: Wire, deployment: Wire, states: Wire[]): void {
  assert.equal(report.marker, COMBINED_C3_MARKER); assert.equal(deployment.marker, COMBINED_C3_MARKER);
  assert.equal(report.baselinePassed, false); assert.match(String(report.error), /independent identityAndWitnessEstimatedBytes/);
  assert(String(report.error).includes('3280 !== 3196'));
  verifyCombinedBaseline({ ...report, error: undefined }, deployment, states);
}
/** A refused C4 read grants no content or storage acceptance. The fixture is unchanged. */
export function verifyCombinedHostBudgetDiagnostic(report: Wire, deployment: Wire): void {
  assert.equal(report.schema, 'phase8g5c-combined-baseline-v1'); assert.equal(report.marker, COMBINED_MARKER);
  assert.equal(report.project, OWNED_PROJECT); assert.equal(report.complete, false); assert.equal(report.eligible, false);
  assert.equal(report.baselinePassed, false); assert.equal(report.combinedStorageAccepted, false);
  assert.match(String(report.error), /authority-host-work-budget/); assert.deepEqual(report.comparisons, []);
  assert.equal(report.archiveSha256, deployment.archiveSha256); assert.equal(report.configSha256, deployment.configSha256);
  assert(Number((report.stats as Wire).initEpochMs) > Number((deployment.stats as Wire).initEpochMs));
  assert.deepEqual(report.census, deployment.census);
  assert.deepEqual(publishedOccupancy(report.inventory as Wire), publishedOccupancy(deployment.inventory as Wire));
  assert.equal((report.scanBefore as Wire).slotsWithContent, 6);
  const info = report.infoAfterRefusal as Wire; assert.equal(info.comparison, 'authority-host-work-budget');
  assert.equal(info.retainedSnapshotEstimatedBytes, 0); assert.equal(info.scanActive, undefined);
  assert(Number((info.lastScanPhaseTimesMs as Wire).authorityHostWorkMs) > 50);
  for (const state of [report.infoCold, info] as Wire[])
    verifyCombinedLedger(state, { census: report.census as Wire, topology: report.topology as Wire,
      inventory: report.inventory as Wire, payloads: [], authorityNotes: [] });
}
/** Recompute all seven domains from UUIDs, raw counters, guard text, and independently acquired payloads. */
export function verifyCombinedLedger(info: Wire, oracle: LedgerOracle, marker = COMBINED_MARKER): Wire {
  assert.equal(info.complete, false); assert.equal(info.eligible, false);
  assert.equal(info.instrumentationRevision, marker);
  const rows = fullTracks(oracle.census); assert.equal(rows.length, SUPPORTED_TRACKS);
  verifyFlatScale(oracle.topology, oracle.census); publishedOccupancy(oracle.inventory);
  const accounting = info.resourceAccounting as Wire, census = info.domainObjects as Wire;
  for (const value of [info.entries, info.resident, info.occupiedCoordinates, info.pendingCoordinates,
    info.physicalPendingHints, census.witnessReferences]) assert(Number.isSafeInteger(value) && Number(value) >= 0);
  assert.equal(accounting.accountingRevision, marker === COMBINED_C3_MARKER ? '8g5c-resource-accounting-v2' : '8g5c-resource-accounting-v3');
  assert.equal(accounting.combinedLimitSelected, true); assert.equal(accounting.combinedLimitBytes, COMBINED_LIMIT);
  for (const key of ['heapMeasured', 'hostMemoryMeasured', 'serializedBytesAreMemoryMeasurement']) assert.equal(accounting[key], false);
  for (const key of ['recorderLimitBytes', 'snapshotLimitBytes', 'authorityLimitBytes', 'registryAttemptLimitBytes']) assert.equal(accounting[key], SNAPSHOT_LIMIT);
  assert.equal(accounting.stagingRecorderEstimatedBytes, 0, 'this oracle checks a published registry');
  assert.equal(accounting.candidateSnapshotEstimatedBytes, 0, 'supply completed independent payloads');
  const slots = oracle.inventory.occupancy as Wire[];
  assert.equal(info.entries, slots.length); assert.equal(census.clipEntryRecords, slots.length);
  const reserved = oracle.candidateWitnessReserved ? WITNESS_BYTES : 0;
  assert.equal(accounting.candidateWitnessEstimatedBytes, reserved);
  const identity = 40 + 2 * String(info.initDomain).length
    + slots.reduce((sum, slot) => sum + 256 + 2 * (String(slot.ref).length + String(slot.trackId).length), 0)
    + WITNESS_BYTES * Number(census.witnessReferences) + reserved;
  const recorder = 256 * Number(info.resident) + 56 * (Number(info.occupiedCoordinates)
    + Number(info.pendingCoordinates) + Number(info.physicalPendingHints));
  const snapshots = oracle.payloads.reduce((sum, payload) => sum + snapshotEstimate(payload.metadata, payload.notes), 0);
  const authority = oracle.authorityNotes.length * AUTHORITY_NOTE_BYTES;
  assert.equal(Number(accounting.comparisonAuthorityStagingEstimatedBytes) + Number(accounting.exactAuthorityStagingEstimatedBytes), authority);
  assert(Number(accounting.comparisonAuthorityStagingEstimatedBytes) === 0 || Number(accounting.exactAuthorityStagingEstimatedBytes) === 0);
  const guard = (oracle.inventory.inventoryRebuild as Wire).capturedGuard as Wire;
  const guardBytes = 128 + 2 * (String(guard.structureWitness).length + String(guard.loadedInstanceWitness ?? '').length);
  const itemBytes = slots.reduce((sum, slot) => sum + 512 + 2 * String(slot.trackId).length + 2 * '1/512-beat'.length
    + [...ACQUIRED_FIELDS, ...UNSUPPORTED_FIELDS].reduce((bytes, field) => bytes + 64 + 2 * field.length, 0), 0);
  const registry = guardBytes + itemBytes;
  const witness = `${rows.length}:${rows.map(row => row.channelId + ';').join('')}${JSON.stringify(oracle.topology.tree)}`;
  const topologyBookkeeping = 304 + 20 * SUPPORTED_TRACKS, topologyWitness = 40 + 2 * witness.length;
  assert.equal(accounting.topologyBookkeepingEstimatedBytes, topologyBookkeeping);
  assert.equal(accounting.topologyWitnessCharacters, witness.length); assert.equal(accounting.topologyWitnessEstimatedBytes, topologyWitness);
  assert.equal(accounting.registryGuardEstimatedBytes, guardBytes);
  const window = info.slotWindowValue as Wire;
  assert.equal(accounting.slotReadRetained, info.slotWindowState !== 'none');
  const slotWindow = 296 + 2 * String(window.initNonce).length + (accounting.slotReadRetained ? 128 : 0);
  assert.equal(accounting.slotSourceBookkeepingEstimatedBytes, 96); assert.equal(accounting.slotWindowEstimatedBytes, slotWindow);
  const estimates: Wire = { recorderDomainEstimatedBytes: recorder, snapshotDomainEstimatedBytes: snapshots,
    authorityDomainEstimatedBytes: authority, registryAttemptEstimatedBytes: registry, identityAndWitnessEstimatedBytes: identity,
    topologyDomainEstimatedBytes: topologyBookkeeping + topologyWitness, slotDomainEstimatedBytes: 96 + slotWindow };
  for (const [key, value] of Object.entries(estimates)) assert.equal(accounting[key], value, `independent ${key}`);
  for (const value of [recorder, snapshots, authority, registry]) assert(value <= SNAPSHOT_LIMIT);
  const total = Object.values(estimates).reduce<number>((sum, value) => sum + Number(value), 0);
  assert.equal(accounting.totalEstimatedBytes, total); assert(total <= COMBINED_LIMIT);
  return { ...estimates, totalEstimatedBytes: total, complete: false, eligible: false };
}

/** Include authority staging and one sparse coordinate for each group of 16 channel notes. */
export function solveCombinedLayout(fixed: number, base: number, costs: ReadonlyMap<number, number>, reference: number): Layout {
  assert(Number.isSafeInteger(fixed) && fixed >= 0); assert(Number.isSafeInteger(base) && base > 0);
  assert(costs.size > 1 && costs.has(reference));
  for (const [velocity, cost] of costs) { assert(Number.isInteger(velocity) && velocity >= 1 && velocity <= 127); assert(Number.isSafeInteger(cost) && cost > 0); }
  const ordered = [...costs.keys()].sort((a, b) => a === reference ? -1 : b === reference ? 1 : a - b);
  const steps = [...new Set([...costs.values()].flatMap(a => [...costs.values()].map(b => a - b)).filter(step => step > 0))].sort((a, b) => a - b);
  for (const step of steps) for (const a of ordered) for (const [b, costB] of costs) {
    const costA = costs.get(a)!; if (costA - costB !== step) continue;
    const first = Math.max(1, Math.ceil((COMBINED_LIMIT - fixed - base) / (costA + AUTHORITY_NOTE_BYTES + 56 / 16)) - 1);
    for (let total = first; total <= Math.min(32768, first + step + 16); total++) {
      const over = fixed + base + 56 * Math.ceil(total / 16) + total * (costA + AUTHORITY_NOTE_BYTES) - COMBINED_LIMIT;
      if (over < 0 || over % step !== 0) continue;
      const countB = over / step; if (countB < 1 || countB > total) continue;
      const result = { a, b, countA: total - countB, countB, total };
      assert.equal(fixed + base + 56 * Math.ceil(total / 16) + result.countA * costA + countB * costB
        + total * AUTHORITY_NOTE_BYTES, COMBINED_LIMIT); return result;
    }
  }
  throw new Error('no combined equality layout within note and coordinate limits');
}
