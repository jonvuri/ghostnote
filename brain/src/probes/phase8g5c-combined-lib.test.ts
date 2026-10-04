import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { COMBINED_LIMIT, COMBINED_MARKER, COMBINED_C3_MARKER, WITNESS_BYTES, AUTHORITY_NOTE_BYTES, solveCombinedLayout, verifyCombinedLedger, verifyCombinedDeployment, verifyCombinedDiagnostic, verifyCombinedBaseline, verifyCombinedHostBudgetDiagnostic, calibratedNotes, clipMetadata, verifyCombinedBudget, verifyCombinedBudgetDiagnostic, verifyBudgetContinuation, verifyExactReaderDiagnostic, verifyNormalDeployment, verifyStorageCleanup } from './phase8g5c-combined-lib.js';
import { independentNotes } from './phase8g4-native-lib.js';
import { baseEstimate, noteEstimate, snapshotEstimate } from './e219-snapshot-budgets-lib.js';
import { sweepConfig, type Wire } from './phase8g5c-storage-lib.js';
const source = JSON.parse(gunzipSync(readFileSync(new URL('../../../context/evidence/data/phase8g5c-storage/counted-populated-512-3.json.gz', import.meta.url))).toString()) as Wire;
test('C4 preserves its host-budget refusal and verifies the explicit baseline retry', () => {
  const root = new URL('../../../context/evidence/data/phase8g5c-storage/', import.meta.url);
  const read = (name: string): Wire => { const b = readFileSync(new URL(name, root)); return JSON.parse((name.endsWith('.gz') ? gunzipSync(b) : b).toString()) as Wire; };
  const refused = read('combined-baseline-host-budget-diagnostic.json.gz'), deployment = read('combined-witness-deployment.json');
  const baseline = read('combined-baseline.json.gz');
  const states = [...read('flat-seed.json.gz').seeds as Wire[], read('512-result.json.gz').endSeed as Wire];
  verifyCombinedHostBudgetDiagnostic(refused, deployment); assert.equal(baseline.baselinePassed, true);
  assert.equal((refused.stats as Wire).initEpochMs, (baseline.stats as Wire).initEpochMs);
  verifyCombinedBaseline(baseline, deployment, states);
  for (const mutate of [
    (value: Wire) => { value.baselinePassed = true; },
    (value: Wire) => { value.error = undefined; },
    (value: Wire) => { (value.infoAfterRefusal as Wire).comparison = 'match'; },
  ]) { const changed = structuredClone(refused); mutate(changed); assert.throws(() => verifyCombinedHostBudgetDiagnostic(changed, deployment)); }
  const changed = structuredClone(baseline);
  ((changed.comparisons as Wire[])[0]!.snapshotCandidate as Wire).combinedPeakEstimatedBytes = 0;
  assert.throws(() => verifyCombinedBaseline(changed, deployment, states));
});
test('native velocity calibration gives an exact combined layout across all 16 channels', () => {
  const root = new URL('../../../context/evidence/data/phase8g5c-storage/flat-seed.json.gz', import.meta.url);
  const seed = JSON.parse(gunzipSync(readFileSync(root)).toString()) as Wire, first = (seed.seeds as Wire[])[0]!;
  const raw = structuredClone(first.notes as Wire), channels = raw.channels as Wire[], template = (channels[0]!.notes as Wire[])[0]!;
  raw.count = 127;
  for (const channel of channels) {
    channel.notes = channel.channel === 0 ? Array.from({ length: 127 }, (_, index) => ({ ...template, x: 0, y: index,
      duration: 1 / 512, velocity: Math.fround((index + 1) / 127) })) : [];
    channel.count = (channel.notes as Wire[]).length;
  }
  const metadata = clipMetadata(first.metadata as Wire), cal = independentNotes(raw);
  const costs = new Map(cal.map(note => [note.pitch + 1, noteEstimate(note.fields)]));
  const fixed = 590716, layout = solveCombinedLayout(fixed, baseEstimate(metadata), costs, 100);
  const equal = calibratedNotes(raw, layout), excess = calibratedNotes(raw, layout, true);
  assert.equal(new Set(equal.map(note => note.channel)).size, 16);
  assert.equal(fixed + 56 * Math.ceil(layout.total / 16) + snapshotEstimate(metadata, equal) + AUTHORITY_NOTE_BYTES * equal.length, COMBINED_LIMIT);
  assert.equal(snapshotEstimate(metadata, excess) - snapshotEstimate(metadata, equal), 2);
  const bad = structuredClone(raw); ((bad.channels as Wire[])[0]!.notes as Wire[])[0]!.duration = 1;
  assert.throws(() => calibratedNotes(bad, layout));
});
test('deployment pins a new archive and the unchanged full populated fixture', () => {
  const config = sweepConfig(512, true);
  const report: Wire = { schema: 'phase8g5c-combined-deployment-v1', project: 'New 8', marker: COMBINED_C3_MARKER,
    complete: false, eligible: false, combinedStorageAccepted: false, stats: source.stats,
    archiveMtimeMs: Number((source.stats as Wire).initEpochMs) + 1000, archiveSha256: 'a'.repeat(64), config,
    configSha256: createHash('sha256').update(JSON.stringify(config, null, 2) + '\n').digest('hex'),
    census: source.tracks, censusAfter: source.tracks, topology: source.topology, inventory: source.inventory, scan: source.scanAfter };
  verifyCombinedDeployment(report, source);
  for (const mutate of [
    (value: Wire) => { value.archiveSha256 = source.archiveSha256; },
    (value: Wire) => { value.archiveMtimeMs = 0; },
    (value: Wire) => { value.configSha256 = '0'.repeat(64); },
    (value: Wire) => { value.censusAfter = {}; },
    (value: Wire) => { value.combinedStorageAccepted = true; },
  ]) { const changed = structuredClone(report); mutate(changed); assert.throws(() => verifyCombinedDeployment(changed, source)); }
});
test('the combined solver accounts for authority and sparse coordinates at equality', () => {
  const fixed = 700000, base = 2198, costs = new Map([[1, 2064], [5, 2062]]);
  const layout = solveCombinedLayout(fixed, base, costs, 1);
  const expected = fixed + base + 56 * Math.ceil(layout.total / 16) + layout.countA * 2064
    + layout.countB * 2062 + layout.total * AUTHORITY_NOTE_BYTES;
  assert.equal(expected, COMBINED_LIMIT); assert(layout.total <= 32768); assert(layout.countB > 0);
  assert(expected - layout.countB * 2062 + layout.countB * 2064 > COMBINED_LIMIT);
  assert.throws(() => solveCombinedLayout(fixed + 1, base, costs, 1));
  assert.throws(() => solveCombinedLayout(-1, base, costs, 1));
});
test('the seven-domain oracle checks the measured flat fixture without accepting scale or heap', () => {
  // Extend a recorded empty-cache census with the declared C3 source model. This is a model test, not live C3 evidence.
  const info = structuredClone(source.inventory as Wire), ledger = info.resourceAccounting as Wire;
  info.instrumentationRevision = COMBINED_MARKER;
  const guard = (info.inventoryRebuild as Wire).capturedGuard as Wire;
  const census = source.tracks as Wire;
  const witness = `${census.count}:${(census.tracks as Wire[]).map(row => String(row.channelId) + ';').join('')}${JSON.stringify((source.topology as Wire).tree)}`;
  const registryGuard = 128 + 2 * (String(guard.structureWitness).length + String(guard.loadedInstanceWitness).length);
  const slotWindow = 296 + 2 * String((info.slotWindowValue as Wire).initNonce).length + 128;
  Object.assign(ledger, { accountingRevision: '8g5c-resource-accounting-v3', combinedLimitSelected: true,
    combinedLimitBytes: COMBINED_LIMIT, candidateWitnessEstimatedBytes: 0,
    registryGuardEstimatedBytes: registryGuard, registryAttemptEstimatedBytes: 18216 + registryGuard,
    topologyBookkeepingEstimatedBytes: 10544, topologyWitnessCharacters: witness.length,
    topologyWitnessEstimatedBytes: 40 + 2 * witness.length, topologyDomainEstimatedBytes: 10584 + 2 * witness.length,
    slotSourceBookkeepingEstimatedBytes: 96, slotWindowEstimatedBytes: slotWindow, slotReadRetained: true,
    slotDomainEstimatedBytes: 96 + slotWindow });
  ledger.totalEstimatedBytes = Number(ledger.registryAttemptEstimatedBytes) + Number(ledger.identityAndWitnessEstimatedBytes)
    + Number(ledger.topologyDomainEstimatedBytes) + Number(ledger.slotDomainEstimatedBytes);
  const oracle = { census, topology: source.topology as Wire, inventory: info, payloads: [], authorityNotes: [] };
  verifyCombinedLedger(info, oracle);
  for (const mutate of [
    (value: Wire) => { (value.resourceAccounting as Wire).topologyDomainEstimatedBytes = 0; },
    (value: Wire) => { (value.resourceAccounting as Wire).slotDomainEstimatedBytes = 0; },
    (value: Wire) => { (value.resourceAccounting as Wire).registryGuardEstimatedBytes = 0; },
    (value: Wire) => { (value.resourceAccounting as Wire).totalEstimatedBytes = COMBINED_LIMIT; },
    (value: Wire) => { value.resident = -1; },
    (value: Wire) => { (value.resourceAccounting as Wire).heapMeasured = true; },
  ]) { const changed = structuredClone(info); mutate(changed); assert.throws(() => verifyCombinedLedger(changed, oracle)); }
});
test('the completed C3 reads include full versioned witnesses while retaining the failed verifier', () => {
  const root = new URL('../../../context/evidence/data/phase8g5c-storage/', import.meta.url);
  const read = (name: string): Wire => { const b = readFileSync(new URL(name, root)); return JSON.parse((name.endsWith('.gz') ? gunzipSync(b) : b).toString()) as Wire; };
  const report = read('combined-baseline-diagnostic.json.gz'), deployment = read('combined-deployment.json');
  const states = [...read('flat-seed.json.gz').seeds as Wire[], read('512-result.json.gz').endSeed as Wire];
  assert.equal(WITNESS_BYTES, 210); verifyCombinedDiagnostic(report, deployment, states);
  for (const mutate of [
    (value: Wire) => { value.baselinePassed = true; },
    (value: Wire) => { value.error = undefined; },
    (value: Wire) => { ((value.comparisons as Wire[])[0]!.resourceAccounting as Wire).identityAndWitnessEstimatedBytes = 3196; },
    (value: Wire) => { ((value.comparisons as Wire[])[0]!.publicationResourceAccounting as Wire).totalEstimatedBytes = COMBINED_LIMIT; },
  ]) { const changed = structuredClone(report); mutate(changed); assert.throws(() => verifyCombinedDiagnostic(changed, deployment, states)); }
});

const evidenceRoot = new URL('../../../context/evidence/data/phase8g5c-storage/', import.meta.url);
const evidence = (name: string): Wire => {
  const bytes = readFileSync(new URL(name, evidenceRoot));
  return JSON.parse((name.endsWith('.gz') ? gunzipSync(bytes) : bytes).toString()) as Wire;
};
test('live combined boundaries and exact recovery use independent fields and preserve failed attempts', () => {
  const baseline = evidence('combined-baseline.json.gz'), first = (evidence('flat-seed.json.gz').seeds as Wire[])[0]!;
  const other = evidence('512-result.json.gz').endSeed as Wire;
  for (const mode of ['reader', 'drain'] as const) {
    const diagnostic = evidence(`combined-budget-${mode}-diagnostic.json.gz`);
    verifyCombinedBudgetDiagnostic(diagnostic, baseline, first, other, mode);
    assert.throws(() => verifyCombinedBudgetDiagnostic({ ...diagnostic, combinedStorageAccepted: true }, baseline, first, other, mode));
    assert.throws(() => verifyCombinedBudgetDiagnostic({ ...diagnostic, fixtureRestored: false }, baseline, first, other, mode));
  }
  const report = evidence('combined-budget.json.gz');
  const summary = verifyCombinedBudget(report, baseline, first, other);
  assert.equal(summary.workingNotes, 6315); assert.equal(summary.liveRecovery, true);
  const arm = report.recovery as Wire, result = arm.result as Wire;
  const badPeak = { ...report, recovery: { ...arm, result: { ...result,
    publicationResourceAccounting: { ...result.publicationResourceAccounting as Wire, totalEstimatedBytes: COMBINED_LIMIT + 2 } } } };
  assert.throws(() => verifyCombinedBudget(badPeak, baseline, first, other));
  const exact = report.exactFallback as Wire, notes = exact.authorityNotes as Wire[];
  const changed = [{ ...notes[0]!, fields: { ...notes[0]!.fields as Wire, rawDuration: 1 } }, ...notes.slice(1)];
  assert.throws(() => verifyCombinedBudget({ ...report, exactFallback: { ...exact, authorityNotes: changed } }, baseline, first, other));
  const excess = report.excess as Wire, views = excess.viewsAfter as Wire[];
  assert.throws(() => verifyCombinedBudget({ ...report, excess: { ...excess, viewsAfter: [
    { ...views[0]!, historicalSnapshot: {} }, views[1]!] } }, baseline, first, other));
});
test('recovery continuation pins unchanged earlier observations and exact raw source bytes', () => {
  const report = evidence('combined-budget.json.gz'), source = evidence('combined-budget-drain-diagnostic.json.gz');
  const raw = gunzipSync(readFileSync(new URL('combined-budget-drain-diagnostic.json.gz', evidenceRoot)));
  const digest = createHash('sha256').update(raw).digest('hex');
  verifyBudgetContinuation(report, source, digest);
  assert.throws(() => verifyBudgetContinuation(report, source, '0'.repeat(64)));
  assert.throws(() => verifyBudgetContinuation({ ...report, layout: { ...report.layout as Wire, total: 6314 } }, source, digest));
  assert.throws(() => verifyBudgetContinuation({ ...report, precedingError: undefined }, source, digest));
});
test('the exact reader startup diagnostic cannot claim terminal authority', () => {
  const report = evidence('exact-reader-first-diagnostic.json.gz'), baseline = evidence('combined-baseline.json.gz');
  verifyExactReaderDiagnostic(report, baseline);
  const rows = report.rows as Wire[];
  assert.throws(() => verifyExactReaderDiagnostic({ ...report, rows: [...rows.slice(0, 3),
    { ...rows[3]!, value: { ...rows[3]!.value as Wire, authorityAvailable: true } }] }, baseline));
});
test('normal restoration preparation pins the original config and the restored owned fixture', () => {
  const report = evidence('normal-deployment.json'), budget = evidence('combined-budget.json.gz'), entry = evidence('entry.json');
  verifyNormalDeployment(report, budget, entry);
  for (const changed of [{ ...report, configSha256: '0'.repeat(64) }, { ...report, physicalPendingHints: 1 },
    { ...report, normalArchiveMtimeMs: report.priorInitialization }])
    assert.throws(() => verifyNormalDeployment(changed, budget, entry));
});

test('final cleanup verifies the actual normal baseline and rejects project or reader residue', () => {
  const report = evidence('cleanup.json'), deployment = evidence('normal-deployment.json');
  const restoration = evidence('new3-final-baseline.json');
  const adopted = JSON.parse(readFileSync(new URL('../phase8g5a-group/new3-baseline.json', evidenceRoot), 'utf8')) as Wire;
  verifyStorageCleanup(report, deployment, restoration, adopted);
  for (const changed of [{ ...report, operatorDiscardedOwnedFixture: false }, { ...report, researchArchiveRemoved: false },
    { ...report, protectedProjectSaved: true }, { ...report, normalArchiveSha256: '0'.repeat(64) }])
    assert.throws(() => verifyStorageCleanup(changed, deployment, restoration, adopted));
  for (const mutate of [
    (value: Wire) => { (value.hello as Wire).runtimeProfile = 'phase-8-probe-v1'; },
    (value: Wire) => { (value.stats as Wire).initEpochMs = deployment.priorInitialization; },
    (value: Wire) => { (((value.baseline as Wire).tracks as Wire).tracks as Wire[])[0]!.channelId = 'foreign'; },
    (value: Wire) => { (value.metadata as Wire).loopLength = 8; },
    (value: Wire) => { (value.confirmationNotes as Wire).count = 1; },
    (value: Wire) => { (((value.confirmation as Wire).cursors as Wire).fine as Wire).clipPinned = true; },
  ]) {
    const changed = structuredClone(restoration); mutate(changed);
    assert.throws(() => verifyStorageCleanup(report, deployment, changed, adopted));
  }
});
