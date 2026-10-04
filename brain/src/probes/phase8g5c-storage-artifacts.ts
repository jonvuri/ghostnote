/** Verify pinned allocation evidence. These results do not accept populated scale or storage. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { verifyPopulation, verifyFlatEmpty, verifyFlatSeed, verifyWideArm, verifyWideFirst, verifyWideResult, verifyNestedArm,
  verifyNestedFirst, verifyNestedResult, verifyBoundaryArm, verifyBoundaryFirst, verifyBoundaryResult, verifyCollapseArm,
  verifyToggleFirst, verifyCollapseResult, verifyCollapseDiagnostic, verifyExpandArm, verifyExpandResult,
  verifyUngroupArm, verifyUngroupFirst, verifyUngroupResult, verify512Population, verify512Result,
  verify512ExcessConfirmation } from './phase8g5c-scale-lib.js';
import { ALLOCATION_STATS_REVISION, CAPACITIES, COUNTED_ALLOCATION_MARKER, OWNED_PROJECT, sweepConfig, verifyAllocation, verifyAllocationSample, verifyPopulatedAnchor, type Wire } from './phase8g5c-storage-lib.js';
import { verifyCombinedDeployment, verifyCombinedBaseline, verifyCombinedDiagnostic, verifyCombinedHostBudgetDiagnostic, verifyCombinedBudget, verifyCombinedBudgetDiagnostic, verifyBudgetContinuation, verifyExactReaderDiagnostic, verifyNormalDeployment, verifyStorageCleanup, COMBINED_MARKER } from './phase8g5c-combined-lib.js';
const root = new URL('../../../context/evidence/data/phase8g5c-storage/', import.meta.url);
export interface Artifact { file: string; bytes: number; sha256: string; uncompressedBytes?: number; uncompressedSha256?: string }
export function pinned(bytes: Buffer, record: Artifact): Wire {
  assert.equal(bytes.byteLength, record.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), record.sha256);
  const raw = record.file.endsWith('.gz') ? gunzipSync(bytes, { maxOutputLength: 64 * 1024 * 1024 }) : bytes;
  if (record.file.endsWith('.gz')) {
    assert.equal(raw.length, record.uncompressedBytes);
    assert.equal(createHash('sha256').update(raw).digest('hex'), record.uncompressedSha256);
  }
  return JSON.parse(raw.toString('utf8')) as Wire;
}
/** Compare the whole idle fixture with its initial independently read track UUIDs. */
export function fixtureBaseline(report: Wire, sample: Wire): void {
  assert.equal(report.schema, 'phase8g5c-fixture-entry-v1'); assert.equal(report.project, OWNED_PROJECT);
  assert.equal(report.complete, false); assert.equal(report.eligible, false); assert.equal(report.emptySlotsVerified, true);
  const values = (state: Wire): Wire => {
    const scan = { ...state.scan as Wire }, selection = { ...state.selection as Wire };
    delete scan.scanMicros; delete selection.changes; delete selection.revision;
    return { ...state, scan, selection };
  };
  const first = report.first as Wire, second = report.second as Wire;
  assert.deepEqual(values(first), values(second)); assert.deepEqual(first.tracks, sample.tracks);
  for (const state of [first, second]) {
    const scan = state.scan as Wire;
    assert.equal(scan.existing, 4); assert.equal(scan.withChannelId, 4); assert.equal(scan.itemCount, 4);
    assert.equal(scan.bankSize, 512); assert.equal(scan.sceneCount, 8); assert.equal(scan.slotsWithContent, 0);
    assert.equal((state.scenes as Wire).sceneCount, 8);
    assert.deepEqual(Object.keys(state.cursors as Wire).sort(), ['0', '1', '2', '3', '4', '5', '6', '7', 'fine', 'observer'].sort());
  }
}
const range = (values: number[]): Wire => {
  const ordered = [...values].sort((a, b) => a - b), middle = Math.floor(values.length / 2);
  return { minimum: ordered[0], maximum: ordered.at(-1),
    median: ordered.length % 2 === 0 ? (ordered[middle - 1]! + ordered[middle]!) / 2 : ordered[middle] };
};
/** This saved attempt stopped at the format-revision check, before the idle interval. */
export function allocationDiagnostic(report: Wire): void {
  assert.equal(report.schema, 'phase8g5c-allocation-v1'); assert.equal(report.project, OWNED_PROJECT);
  assert.equal(report.complete, false); assert.equal(report.eligible, false);
  assert.equal(report.capacity, 512); assert.equal(report.allocationRoute, 'counted');
  assert.match(String(report.error), /AssertionError.*Expected values to be strictly equal/s);
  assert(String(report.error).includes(ALLOCATION_STATS_REVISION));
  assert(String(report.error).includes(COUNTED_ALLOCATION_MARKER));
  verifyAllocation(report.before as Wire, 512, true);
  for (const key of ['processBefore', 'processAfter', 'after', 'idleCpu', 'topology']) assert.equal(report[key], undefined);
}
export async function verifyStorageArtifacts(): Promise<Wire> {
  const manifest = JSON.parse(await readFile(new URL('artifacts.json', root), 'utf8')) as { schema: string; artifacts: Artifact[] };
  assert.equal(manifest.schema, 'phase8g5c-artifacts-v1');
  const data = new Map<string, Wire>();
  for (const record of manifest.artifacts) {
    assert.match(record.file, /^[a-z0-9-]+\.json(?:\.gz)?$/); assert(!data.has(record.file));
    assert(Number.isSafeInteger(record.bytes) && record.bytes > 0 && record.bytes <= 64 * 1024 * 1024);
    data.set(record.file, pinned(await readFile(new URL(record.file, root)), record));
  }
  const entry = data.get('entry.json'); assert(entry); assert.equal(entry.schema, 'phase8g5c-entry-v1');
  assert.equal(entry.configSha256, '256bbf07094cd654c372d0e5e050e494ef7783c9a0001a0a2a688331bcf643b0');
  const original = Buffer.from(String(entry.configBase64), 'base64');
  assert.equal(createHash('sha256').update(original).digest('hex'), entry.configSha256);
  const adopted = data.get('entry-baseline.json'); assert(adopted);
  assert.equal(adopted.project, 'New 3'); assert.equal(adopted.stateValuesRestored, true);
  const samples: Wire[] = [], epochs = new Set<number>(); let diagnostics = 0, budgetDiagnostics = 0;
  const countedDeployment = data.get('counted-deployment.json');
  if (countedDeployment) {
    assert.equal(countedDeployment.schema, 'phase8g5c-counted-deployment-v1');
    assert.equal(countedDeployment.marker, COUNTED_ALLOCATION_MARKER);
    assert.equal(countedDeployment.complete, false); assert.equal(countedDeployment.eligible, false);
    assert.equal(countedDeployment.liveRouteAccepted, false);
    assert.deepEqual(countedDeployment.config, sweepConfig(512, true));
    const bytes = Buffer.from(JSON.stringify(countedDeployment.config, null, 2) + '\n');
    assert.equal(countedDeployment.configSha256, createHash('sha256').update(bytes).digest('hex'));
    assert.match(String(countedDeployment.archiveSha256), /^[a-f0-9]{64}$/);
  }
  for (const [file, report] of data) if (report.schema === 'phase8g5c-allocation-v1') {
    const priorFile = String(report.priorPath).split('/').at(-1)!;
    const prior = data.get(priorFile); assert(prior, `missing preceding sample: ${file}`);
    if (report.allocationRoute === 'counted') {
      assert(countedDeployment, 'missing counted route deployment');
      assert.equal(report.archiveSha256, countedDeployment.archiveSha256);
    } else assert.equal(report.archiveSha256, '7cb670c478419f9eb4c3b4c02df41855cd184b21e04e500c905efcd74cd67df6');
    if (report.error !== undefined) {
      assert.equal(file, 'counted-empty-512-1-diagnostic.json'); allocationDiagnostic(report); diagnostics++;
      assert(Number((report.stats as Wire).initEpochMs) > Number((prior.stats as Wire).initEpochMs));
      continue;
    }
    const anchor = report.fixtureAnchorPath ? data.get(String(report.fixtureAnchorPath).split('/').at(-1)!) : undefined;
    verifyAllocationSample(report, prior, anchor);
    const epoch = Number((report.stats as Wire).initEpochMs); assert(!epochs.has(epoch), 'initialization counted twice');
    epochs.add(epoch); samples.push(report);
  }
  const baseline = data.get('new8-baseline.json'); assert(baseline);
  const diagnostic = data.get('counted-empty-512-1-diagnostic.json');
  if (diagnostic) {
    const completed = data.get('counted-empty-512-1.json'); assert(completed);
    assert.equal((diagnostic.stats as Wire).initEpochMs, (completed.stats as Wire).initEpochMs);
    assert.deepEqual(diagnostic.tracks, completed.tracks);
    assert.deepEqual((diagnostic.stats as Wire).config, (completed.stats as Wire).config);
  }
  const baselineSample = data.get(String(baseline.samplePath).split('/').at(-1)!); assert(baselineSample);
  fixtureBaseline(baseline, baselineSample);
  const source = (path: unknown): Wire => {
    const name = String(path).split('/').at(-1)!;
    const value = data.get(name) ?? data.get(name + '.gz'); assert(value, `missing pinned source: ${name}`); return value;
  };
  const population = data.get('flat-population.json.gz');
  if (population) verifyPopulation(population, baseline, source(population.priorPath));
  const flatEmpty = data.get('flat-empty-check.json.gz');
  if (flatEmpty) { assert(population); assert.equal(source(flatEmpty.sourcePath), population); verifyFlatEmpty(flatEmpty, population); }
  const flatSeed = data.get('flat-seed.json.gz');
  if (flatSeed) { assert(population); assert.equal(source(flatSeed.sourcePath), population); verifyFlatSeed(flatSeed, population); }
  const wideArm = data.get('wide-arm.json.gz');
  if (wideArm) { assert(population && flatSeed); assert.equal(source(wideArm.seedPath), flatSeed); verifyWideArm(wideArm, flatSeed, population); }
  const wideFirst = data.get('wide-first-read.json.gz');
  if (wideFirst) { assert(wideArm && population); verifyWideFirst(wideFirst, wideArm, population); }
  const wideResult = data.get('wide-result.json.gz');
  if (wideResult) {
    assert(wideFirst && wideArm && flatSeed && population); assert.equal(source(wideResult.firstPath), wideFirst);
    assert.equal(source(wideResult.armPath), wideArm); verifyWideResult(wideResult, wideFirst, wideArm, flatSeed, population);
  }
  const nestedArm = data.get('nested-arm.json.gz');
  if (nestedArm) { assert(wideResult && flatSeed); assert.equal(source(nestedArm.widePath), wideResult); verifyNestedArm(nestedArm, wideResult, flatSeed); }
  const nestedFirst = data.get('nested-first-read.json.gz');
  if (nestedFirst) { assert(nestedArm && wideResult); verifyNestedFirst(nestedFirst, nestedArm, wideResult); }
  const nestedResult = data.get('nested-result.json.gz');
  if (nestedResult) {
    assert(nestedFirst && nestedArm && wideResult && flatSeed); assert.equal(source(nestedResult.firstPath), nestedFirst);
    assert.equal(source(nestedResult.armPath), nestedArm); verifyNestedResult(nestedResult, nestedFirst, nestedArm, wideResult, flatSeed);
  }
  const boundaryArm = data.get('boundary-arm.json.gz');
  if (boundaryArm) { assert(nestedResult && flatSeed); assert.equal(source(boundaryArm.nestedPath), nestedResult); verifyBoundaryArm(boundaryArm, nestedResult, flatSeed); }
  const boundaryFirst = data.get('boundary-first-read.json.gz');
  if (boundaryFirst) {
    assert(boundaryArm && nestedResult && population); assert.equal(source(boundaryFirst.armPath), boundaryArm);
    assert.equal((boundaryFirst.stats as Wire).initEpochMs, (population.stats as Wire).initEpochMs);
    verifyBoundaryFirst(boundaryFirst, boundaryArm, nestedResult);
  }
  const boundaryResult = data.get('boundary-result.json.gz');
  if (boundaryResult) {
    assert(boundaryFirst && boundaryArm && nestedResult && flatSeed); assert.equal(source(boundaryResult.firstPath), boundaryFirst);
    assert.equal(source(boundaryResult.armPath), boundaryArm); verifyBoundaryResult(boundaryResult, boundaryFirst, boundaryArm, nestedResult, flatSeed);
  }
  const collapseArm = data.get('collapse-arm.json.gz');
  if (collapseArm) { assert(boundaryResult && flatSeed); assert.equal(source(collapseArm.boundaryPath), boundaryResult); verifyCollapseArm(collapseArm, boundaryResult, flatSeed); }
  const collapseFirst = data.get('collapse-first-read.json.gz');
  if (collapseFirst) {
    assert(collapseArm && boundaryResult && population); assert.equal(source(collapseFirst.armPath), collapseArm);
    assert.equal((collapseFirst.stats as Wire).initEpochMs, (population.stats as Wire).initEpochMs);
    verifyToggleFirst(collapseFirst, collapseArm, boundaryResult, false);
  }
  const collapseDiagnostic = data.get('collapse-result-diagnostic.json.gz');
  if (collapseDiagnostic) {
    assert(collapseFirst && collapseArm && boundaryResult && flatSeed); assert.equal(source(collapseDiagnostic.firstPath), collapseFirst);
    assert.equal(source(collapseDiagnostic.armPath), collapseArm); verifyCollapseDiagnostic(collapseDiagnostic, collapseFirst, collapseArm, boundaryResult, flatSeed);
  }
  const collapseResult = data.get('collapse-result.json.gz');
  if (collapseResult) {
    assert(collapseFirst && collapseArm && boundaryResult && flatSeed); assert.equal(source(collapseResult.firstPath), collapseFirst);
    assert.equal(source(collapseResult.armPath), collapseArm); verifyCollapseResult(collapseResult, collapseFirst, collapseArm, boundaryResult, flatSeed);
  }
  const expandArm = data.get('expand-arm.json.gz');
  if (expandArm) { assert(collapseResult && flatSeed); assert.equal(source(expandArm.collapsePath), collapseResult); verifyExpandArm(expandArm, collapseResult, flatSeed); }
  const expandFirst = data.get('expand-first-read.json.gz');
  if (expandFirst) {
    assert(expandArm && collapseResult && population); assert.equal(source(expandFirst.armPath), expandArm);
    assert.equal((expandFirst.stats as Wire).initEpochMs, (population.stats as Wire).initEpochMs);
    verifyToggleFirst(expandFirst, expandArm, collapseResult, true);
  }
  const expandResult = data.get('expand-result.json.gz');
  if (expandResult) {
    assert(expandFirst && expandArm && collapseResult && flatSeed); assert.equal(source(expandResult.firstPath), expandFirst);
    assert.equal(source(expandResult.armPath), expandArm); verifyExpandResult(expandResult, expandFirst, expandArm, collapseResult, flatSeed);
  }
  const ungroupArm = data.get('ungroup-arm.json.gz');
  if (ungroupArm) { assert(expandResult && flatSeed); assert.equal(source(ungroupArm.expandedPath), expandResult); verifyUngroupArm(ungroupArm, expandResult, flatSeed); }
  const ungroupFirst = data.get('ungroup-first-read.json.gz');
  if (ungroupFirst) {
    assert(ungroupArm && population); assert.equal(source(ungroupFirst.armPath), ungroupArm);
    assert.equal((ungroupFirst.stats as Wire).initEpochMs, (population.stats as Wire).initEpochMs);
    verifyUngroupFirst(ungroupFirst, ungroupArm, population);
  }
  const ungroupResult = data.get('ungroup-result.json.gz');
  if (ungroupResult) {
    assert(ungroupFirst && ungroupArm && population && flatSeed); assert.equal(source(ungroupResult.firstPath), ungroupFirst);
    assert.equal(source(ungroupResult.armPath), ungroupArm); verifyUngroupResult(ungroupResult, ungroupFirst, ungroupArm, population, flatSeed);
  }
  const population512 = data.get('512-population.json.gz');
  if (population512) { assert(ungroupResult); assert.equal(source(population512.ungroupPath), ungroupResult); verify512Population(population512, ungroupResult); }
  const boundary512 = data.get('512-result.json.gz');
  if (boundary512) {
    assert(population512 && flatSeed); assert.equal(source(boundary512.populationPath), population512);
    verify512Result(boundary512, population512, flatSeed);
  }
  const excess512 = data.get('512-excess.json.gz'), excessConfirmation = data.get('512-excess-confirmation.json.gz');
  if (excess512 || excessConfirmation) {
    assert(excess512 && excessConfirmation && boundary512 && flatSeed);
    assert.equal(source(excessConfirmation.sourcePath), excess512);
    assert.equal(excessConfirmation.sourceRawSha256,
      manifest.artifacts.find(record => record.file === '512-excess.json.gz')!.uncompressedSha256);
    verify512ExcessConfirmation(excessConfirmation, excess512, boundary512, flatSeed);
  }
  const populatedAnchor = data.get('populated-anchor.json');
  if (populatedAnchor) {
    assert(boundary512 && excessConfirmation); assert.equal(source(populatedAnchor.sourcePath), boundary512);
    assert.equal(populatedAnchor.archiveSha256, countedDeployment!.archiveSha256);
    verifyPopulatedAnchor(populatedAnchor, boundary512);
  }
  const combinedDeployment = data.get('combined-deployment.json');
  if (combinedDeployment) verifyCombinedDeployment(combinedDeployment, source(combinedDeployment.priorPath));
  const combinedDiagnostic = data.get('combined-baseline-diagnostic.json.gz');
  if (combinedDiagnostic) {
    assert(combinedDeployment && flatSeed && boundary512);
    verifyCombinedDiagnostic(combinedDiagnostic, combinedDeployment, [...flatSeed.seeds as Wire[], boundary512.endSeed as Wire]);
  }
  const witnessDeployment = data.get('combined-witness-deployment.json');
  if (witnessDeployment) { assert(combinedDiagnostic); assert.equal(source(witnessDeployment.priorPath), combinedDiagnostic); verifyCombinedDeployment(witnessDeployment, combinedDiagnostic); }
  const hostBudgetDiagnostic = data.get('combined-baseline-host-budget-diagnostic.json.gz');
  if (hostBudgetDiagnostic) { assert(witnessDeployment); verifyCombinedHostBudgetDiagnostic(hostBudgetDiagnostic, witnessDeployment); }
  const combinedBaseline = data.get('combined-baseline.json.gz');
  if (combinedBaseline) {
    assert(witnessDeployment && flatSeed && boundary512);
    assert.equal(combinedBaseline.marker, COMBINED_MARKER);
    assert.equal(source(combinedBaseline.deploymentPath), witnessDeployment);
    assert.equal(source(combinedBaseline.seedPath), flatSeed); assert.equal(source(combinedBaseline.boundaryPath), boundary512);
    assert.equal(combinedBaseline.baselinePassed, true);
    verifyCombinedBaseline(combinedBaseline, witnessDeployment, [...flatSeed.seeds as Wire[], boundary512.endSeed as Wire]);
  }
  for (const mode of ['reader', 'drain'] as const) {
    const diagnostic = data.get(`combined-budget-${mode}-diagnostic.json.gz`);
    if (diagnostic) {
      assert(combinedBaseline && flatSeed && boundary512);
      assert.equal(source(diagnostic.baselinePath), combinedBaseline);
      verifyCombinedBudgetDiagnostic(diagnostic, combinedBaseline, (flatSeed.seeds as Wire[])[0]!, boundary512.endSeed as Wire, mode);
      budgetDiagnostics++;
    }
  }
  const exactReaderDiagnostic = data.get('exact-reader-first-diagnostic.json.gz');
  if (exactReaderDiagnostic) { assert(combinedBaseline); verifyExactReaderDiagnostic(exactReaderDiagnostic, combinedBaseline); }
  const combinedBudget = data.get('combined-budget.json.gz');
  if (combinedBudget) {
    assert(combinedBaseline && flatSeed && boundary512);
    assert.equal(source(combinedBudget.baselinePath), combinedBaseline);
    assert.equal(source(combinedBudget.seedPath), flatSeed); assert.equal(source(combinedBudget.boundaryPath), boundary512);
    assert.equal(combinedBudget.combinedStorageAccepted, true);
    if (combinedBudget.continuedFrom) {
      const preceding = source(combinedBudget.continuedFrom);
      const record = manifest.artifacts.find(row => row.file === String(combinedBudget.continuedFrom).split('/').at(-1)); assert(record);
      verifyBudgetContinuation(combinedBudget, preceding, record.uncompressedSha256!);
    }
    const summary = verifyCombinedBudget(combinedBudget, combinedBaseline, (flatSeed.seeds as Wire[])[0]!, boundary512.endSeed as Wire);
    assert.deepEqual(combinedBudget.summary, summary);
  }
  const normalDeployment = data.get('normal-deployment.json');
  if (normalDeployment) { assert(combinedBudget); assert.equal(source(normalDeployment.budgetPath), combinedBudget); verifyNormalDeployment(normalDeployment, combinedBudget, entry); }
  const cleanup = data.get('cleanup.json');
  if (cleanup) {
    assert(normalDeployment);
    const restoration = source(cleanup.protectedRestorationPath);
    assert.equal(cleanup.adoptedBaselineSha256, createHash('sha256').update(await readFile(new URL('../phase8g5a-group/new3-baseline.json', root))).digest('hex'));
    const adopted = JSON.parse(await readFile(new URL('../phase8g5a-group/new3-baseline.json', root), 'utf8')) as Wire;
    verifyStorageCleanup(cleanup, normalDeployment, restoration, adopted);
  }
  for (const sample of samples.filter(sample => sample.fixture === 'empty'))
    assert.deepEqual(sample.tracks, (baseline.first as Wire).tracks);
  const summarize = (counted: boolean, fixture = 'empty'): Wire[] => CAPACITIES.map(capacity => {
    const values = samples.filter(sample => sample.capacity === capacity && sample.fixture === fixture
      && (sample.allocationRoute === 'counted') === counted);
    return { capacity, samples: values.length, minimumFreshSamples: 3,
      ...(values.length === 0 ? {} : {
        initializationMs: range(values.map(value => Number((value.stats as Wire).initMicros) / 1000)),
        rigConstructionMs: range(values.map(value => Number((value.stats as Wire).rigConstructMicros) / 1000)),
        sampledSharedJvmUsedMiB: range(values.flatMap(value => ['before', 'after'].map(key =>
          Number(((value[key] as Wire).jvmMemory as Wire).usedBytes) / (1024 * 1024)))),
        ...(capacity === 0 ? {} : {
          topologyConstructionMs: range(values.map(value => Number(
            (((value.before as Wire).topology as Wire).allocationMeasurement as Wire).constructionMs))),
          membershipReadMs: range(values.map(value => Number((value.topology as Wire).readMs))),
        }),
      }) };
  });
  const arms = summarize(false), countedArms = summarize(true), countedPopulatedArms = summarize(true, 'populated');
  const populatedSamples = samples.filter(sample => sample.fixture === 'populated');
  return { artifacts: data.size, diagnostics: diagnostics + budgetDiagnostics + (exactReaderDiagnostic ? 1 : 0) + (collapseDiagnostic ? 1 : 0) + (excess512 ? 1 : 0) + (combinedDiagnostic ? 1 : 0) + (hostBudgetDiagnostic ? 1 : 0), allocationDiagnostics: diagnostics,
    capacityVerifierDiagnostics: excess512 ? 1 : 0,
    collapsedBindingDiagnostics: collapseDiagnostic ? 1 : 0, arms, countedArms, countedPopulatedArms,
    emptyAllocationArmsMeasured: arms.every(arm => Number(arm.samples) >= 3),
    counted512EmptyMeasured: countedArms.some(arm => arm.capacity === 512 && Number(arm.samples) >= 3),
    countedControlMeasured: countedArms.some(arm => arm.capacity === 0 && Number(arm.samples) >= 3),
    flatPopulationVerified: population !== undefined, flatEmptyOccupancyMeasured: flatEmpty !== undefined,
    flatEndTrackNotesMatched: flatSeed !== undefined, wideChangeArmed: wideArm !== undefined,
    wideGroupChecksPassed: wideResult !== undefined, nestedChangeArmed: nestedArm !== undefined,
    nestedGroupChecksPassed: nestedResult !== undefined, boundaryMoveArmed: boundaryArm !== undefined,
    boundaryMoveChecksPassed: boundaryResult !== undefined, collapseChangeArmed: collapseArm !== undefined,
    collapsedTopologyAndOccupancyPassed: collapseResult !== undefined,
    collapsedPrimaryBindingRefused: (collapseResult?.primaryBinding as Wire | undefined)?.outcome === 'refused',
    expansionChangeArmed: expandArm !== undefined,
    expandedRecoveryPassed: expandResult !== undefined, ungroupChangeArmed: ungroupArm !== undefined,
    flatFixtureRestoredFor512: ungroupResult !== undefined,
    population512Verified: population512 !== undefined, boundary512ChecksPassed: boundary512 !== undefined,
    excess512AndRecoveryPassed: excessConfirmation !== undefined, populatedColdReloadPrepared: populatedAnchor !== undefined,
    populatedColdSamples: populatedSamples.length, populatedColdMeasured: populatedSamples.length >= 3,
    combinedDeploymentPrepared: combinedDeployment !== undefined, combinedBaselinePassed: combinedBaseline !== undefined,
    combinedLedgerDiagnostics: combinedDiagnostic ? 1 : 0, combinedWitnessReloadPrepared: witnessDeployment !== undefined,
    combinedHostBudgetDiagnostics: hostBudgetDiagnostic ? 1 : 0,
    combinedLiveBudgetPassed: combinedBudget !== undefined, combinedBudgetDiagnostics: budgetDiagnostics,
    exactReaderDiagnostics: exactReaderDiagnostic ? 1 : 0, normalRestorationPrepared: normalDeployment !== undefined,
    sessionWorkComplete: cleanup !== undefined,
    populatedScaleAccepted: false, combinedStorageAccepted: false, complete: false, eligible: false };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  verifyStorageArtifacts().then(value => console.log(JSON.stringify(value, null, 1)))
    .catch(error => { console.error(error); process.exitCode = 1; });
