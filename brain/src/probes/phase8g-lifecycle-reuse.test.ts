import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkExpectedFixture, parseCleanupArguments, RESEARCH_CLEANUP_OUTPUT, RESEARCH_CLEANUP_VERIFIED_OUTPUT,
  reserveCleanupOutput } from './phase8g-lifecycle-reuse.js';
test('cleanup CLI preserves defaults and supports one explicit output with optional state retention', () => {
  assert.deepEqual(parseCleanupArguments('cleanup', []), { output: RESEARCH_CLEANUP_OUTPUT, explicitOutput: false, keepState: false });
  assert.deepEqual(parseCleanupArguments('verify-cleanup', []), { output: RESEARCH_CLEANUP_VERIFIED_OUTPUT, explicitOutput: false, keepState: false });
  assert.deepEqual(parseCleanupArguments('verify-cleanup', ['/tmp/followup cleanup.json', '--keep-state']),
    { output: '/tmp/followup cleanup.json', explicitOutput: true, keepState: true });
  assert.deepEqual(parseCleanupArguments('verify-cleanup', ['--keep-state', 'followup.json']),
    { output: 'followup.json', explicitOutput: true, keepState: true });
  for (const args of [['one.json', 'two.json'], [''], ['   '], ['bad\0path'], ['--unknown'], ['--keep-state', '--keep-state']])
    assert.throws(() => parseCleanupArguments('verify-cleanup', args));
  assert.throws(() => parseCleanupArguments('cleanup', ['--keep-state']));
});
test('explicit cleanup output is reserved without overwriting historical evidence', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ghostnote-cleanup-path-'));
  try {
    const path = join(directory, 'followup cleanup.json'), options = parseCleanupArguments('cleanup', [path]);
    await reserveCleanupOutput(options, { cleaned: false, entryState: { baselineIds: ['baseline'] } });
    const original = await readFile(path, 'utf8'); assert.equal(JSON.parse(original).cleaned, false);
    await assert.rejects(reserveCleanupOutput(options, { cleaned: true }), { code: 'EEXIST' });
    assert.equal(await readFile(path, 'utf8'), original);
    const historic = join(directory, 'historic.json'); await writeFile(historic, 'retained bytes\n');
    await reserveCleanupOutput({ output: historic, explicitOutput: false, keepState: false }, { cleaned: false });
    assert.equal(await readFile(historic, 'utf8'), 'retained bytes\n');
  } finally { await rm(directory, { recursive: true, force: true }); }
});
const a = Array.from({ length: 16 }, (_, channel) => ({ channel, cell: 0, pitch: 60,
  fields: { chance: .375, isChanceEnabled: false, rawTimbre: -.5, timbre: .25 } }));
const b = [0, 15].map(channel => ({ channel, cell: 1024, pitch: 72, fields: {} }));
test('reuse fixtures reject two proxies that agree on the wrong populated clip', () => {
  assert.deepEqual(checkExpectedFixture(a, 0), []); assert.deepEqual(checkExpectedFixture(b, 1), []);
  assert(checkExpectedFixture(b, 0).includes('fixture-membership-mismatch'));
  assert(checkExpectedFixture(a.slice(0, 1), 0).includes('fixture-membership-mismatch'));
  assert.deepEqual(checkExpectedFixture([], 2), []);
});
test('reuse fixtures require disabled field values and signed timbre conversion', () => {
  assert(checkExpectedFixture(a.map(note => ({ ...note, fields: {} })), 0).includes('fixture-disabled-chance-mismatch'));
  assert(checkExpectedFixture(a.map(note => ({ ...note, fields: { ...note.fields, timbre: -.5 } })), 0).includes('fixture-timbre-units-mismatch'));
  assert(checkExpectedFixture(a, 0, .625).includes('fixture-disabled-chance-mismatch'));
});

import { verifyResearchReports } from './phase8g-lifecycle-reuse.js';
const roots = { researchOnly: true, identityDetectionProved: false, captures: [{
  snapshot: { purpose: 'root-identity-research', identityDetectionProved: false },
  trace: { purpose: 'root-identity-research', identityDetectionProved: false },
}] };
const cleanup = { verified: true, hello: { runtimeProfile: 'normal-v1' }, baselineIds: ['track-a'] };
function caseReport(): Record<string, unknown> {
  return { label: 'row-b', row: 1, expectedChance: .375, researchOnly: true, eligible: false,
    comparisonData: { comparison: 'match', eligible: false, complete: false, scanComplete: true,
      residentNotes: b, authorityNotes: b, residentMetadata: { name: 'gn-8g-reuse-B' }, authorityMetadata: { name: 'gn-8g-reuse-B' } },
    expectedResidentIssues: [], expectedAuthorityIssues: [], expectedResidentMetadataIssues: [], expectedAuthorityMetadataIssues: [],
    outcome: 'content-and-fixture-match' };
}
test('research verifier rejects forged success and promoted experimental results', () => {
  const arm = caseReport(), report = { researchOnly: true, eligible: false, cases: [arm] };
  assert.deepEqual(verifyResearchReports(roots, report, cleanup), { rootCaptures: 1, reuseCases: 1, matches: 1, failures: 0 });
  const wrongClip = structuredClone(report);
  (wrongClip.cases[0]!.comparisonData as Record<string, unknown>).residentNotes = a;
  assert.throws(() => verifyResearchReports(roots, wrongClip, cleanup));
  const wrongField = structuredClone(report);
  const comparison = wrongField.cases[0]!.comparisonData as Record<string, unknown>;
  const notes = structuredClone(comparison.residentNotes) as typeof b;
  notes[0]!.fields = { velocity: .9 }; comparison.residentNotes = notes;
  assert.throws(() => verifyResearchReports(roots, wrongField, cleanup));
  const promoted = structuredClone(report);
  (promoted.cases[0]!.comparisonData as Record<string, unknown>).eligible = true;
  assert.throws(() => verifyResearchReports(roots, promoted, cleanup));
});
test('research verifier retains measured failures and rejects stale interrupted publication', () => {
  const arm = caseReport(); arm.outcome = 'content-or-fixture-failure';
  (arm.comparisonData as Record<string, unknown>).comparison = 'mismatch';
  const report = { researchOnly: true, eligible: false, cases: [arm] };
  assert.equal(verifyResearchReports(roots, report, cleanup).failures, 1);
  const interrupted = caseReport(); interrupted.label = 'interrupted-comparison-and-recovery';
  interrupted.action = [{ comparison: 'scanning', revision: 1 },
    { comparison: 'not-run', revision: 2, scanComplete: false }, { comparison: 'cancelled', revision: 3, scanComplete: false }];
  const retained = { researchOnly: true, eligible: false, cases: [interrupted] };
  assert.equal(verifyResearchReports(roots, retained, cleanup).matches, 1);
  (interrupted.action as Record<string, unknown>[])[1]!.scanComplete = true;
  assert.throws(() => verifyResearchReports(roots, retained, cleanup));
});

import { checkSparseFixture } from './phase8g-lifecycle-reuse.js';
function sparseFixture(notes = a): Record<string, unknown> {
  return { sparseNotes: notes, sparseMetadata: { name: 'gn-8g-reuse-A' }, sparseObservationCurrent: true,
    sparseRevisionBefore: 1, sparseRevisionAfter: 1, sparseBindingBefore: 2, sparseBindingAfter: 2,
    sparseCallbacksBefore: 3, sparseCallbacksAfter: 3, fullComparisonSeedsRecorder: false,
    observerKind: 'StepDataChangedCallback', observerRegistration: 'addStepDataObserver', complete: false, eligible: false };
}
test('sparse checks reject a missing recorder before a full scan can hide it', () => {
  assert.deepEqual(checkSparseFixture(sparseFixture(), 0), []);
  assert(checkSparseFixture(sparseFixture([]), 0).includes('fixture-membership-mismatch'));
  assert(checkSparseFixture({ ...sparseFixture(), fullComparisonSeedsRecorder: true }, 0).includes('scan-seeding-not-disabled'));
  assert(checkSparseFixture({ ...sparseFixture(), observerKind: 'NoteStepChangedCallback' }, 0).includes('wrong-observer-family'));
});
test('sparse checks cover enable-only edits and changed reconciliation windows', () => {
  const enabled = a.map(note => ({ ...note, fields: { ...note.fields, isChanceEnabled: true } }));
  assert.deepEqual(checkSparseFixture(sparseFixture(enabled), 0, .375, true), []);
  assert(checkSparseFixture(sparseFixture(), 0, .375, true).includes('fixture-disabled-chance-mismatch'));
  assert(checkSparseFixture({ ...sparseFixture(), sparseCallbacksAfter: 4, sparseObservationCurrent: false }, 0).includes('sparseCallbacksBefore-changed'));
  assert(checkSparseFixture({ ...sparseFixture(), sparseBindingAfter: 3 }, 0).includes('sparseBindingBefore-changed'));
});

import { verifyReplayReport } from './phase8g-lifecycle-reuse.js';
test('replay verifier rejects sparse gaps hidden by a passing full scan', () => {
  const arm = { label: 'reset-canary-target-0-0-row-0', row: 0, expectedChance: .375, expectedChanceEnabled: false,
    researchOnly: true, complete: false, eligible: false, sparse: sparseFixture(), sparseIssues: [],
    expectedResidentIssues: [], expectedAuthorityIssues: [], outcome: 'sparse-and-independent-match',
    comparisonData: { comparison: 'match', complete: false, eligible: false, fullComparisonSeedsRecorder: false,
      scanComplete: true, residentNotes: a, authorityNotes: a, residentSparseNotesBeforeScan: a,
      sparseMatchesResidentScan: true, sparseMatchesAuthorityScan: true,
      residentMetadata: { name: 'gn-8g-reuse-A' }, authorityMetadata: { name: 'gn-8g-reuse-A' } } };
  const report = { instrumentationRevision: '8g-reuse-sparse-replay-v3', researchOnly: true, complete: false, eligible: false, cases: [arm] };
  assert.deepEqual(verifyReplayReport(report), { matches: 1, failures: 0 });
  const lost = structuredClone(report); lost.cases[0]!.sparse.sparseNotes = [];
  assert.throws(() => verifyReplayReport(lost));
  const seeded = structuredClone(report); seeded.cases[0]!.comparisonData.residentSparseNotesBeforeScan = [];
  assert.throws(() => verifyReplayReport(seeded));
});
