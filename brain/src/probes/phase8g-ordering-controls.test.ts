import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { ORDERING_POLL_CADENCE_MS, orderingPollDue, summarizeOrderingCommands, summarizeOrderingSamples, verifyOrderingReport, verifyOrderingTimingDiagnostic } from './phase8g-ordering-controls.js';
import { NO_CHAIN_ROOT } from './phase8g-no-chain-controls.js';
import { MUTATION_MARKER } from './phase8g-shadow-mutations.js';
import type { ShadowNote } from './phase8g-shadow-cache-lib.js';
type Wire = Record<string, unknown>;
function root(id = 'A', epoch = 1, sequence = epoch): Wire {
  return { extensionInitNonce: 'init', automaticIdentityEpoch: epoch, sequenceAfterRead: sequence, callbacksChangedDuringRead: false,
    current: { rootChannelId: { status: 'read', value: id }, masterChannelId: { status: 'read', value: id }, projectExists: { status: 'read', value: true } },
    existingChainWitnesses: { candidates: id === 'A' ? [{ chainChannelId: 'chain-A' }] : [] } };
}
function sample(before = root(), after = before, result: Wire = {}): Wire {
  return { started: '2026-10-02T00:00:00Z', ended: '2026-10-02T00:00:05Z', before, after,
    status: { complete: false, eligible: false, phase: 'retired', authorityAvailable: false },
    result: { complete: false, eligible: false, comparison: 'window-changed', ...result } };
}
test('a changed identity bracket with terminal refusal has no stale output violation', () => {
  const summary = summarizeOrderingSamples([sample(root(), root(NO_CHAIN_ROOT, 2))], 'owned', []);
  assert.equal(summary.crossedB, 1); assert.equal(summary.changedBrackets, 1); assert.equal(summary.retiredPolls, 1);
  assert.deepEqual(summary.violations, []); assert.equal(summary.hostInputOrderingProved, false);
});
test('historical match label with no current payload is not stale output', () => {
  const summary = summarizeOrderingSamples([sample(root(), root(), { comparison: 'match', authorityAvailable: false })], 'owned', []);
  assert.deepEqual(summary.violations, []); assert.equal(summary.outputSamples, 0);
});
test('terminal refusal with a historical mismatch and snapshot is not current mismatch output', () => {
  const summary = summarizeOrderingSamples([sample(root(), root(), { comparison: 'membership-mismatch', terminal: true,
    phase: 'retired', readMode: 'refuse', authorityAvailable: false, historicalSnapshot: { token: 'old' } })], 'owned', []);
  assert.deepEqual(summary.violations, []); assert.equal(summary.outputSamples, 0);
  assert.equal(summary.historicalMismatchLabels, 1); assert.equal(summary.historicalSnapshotSamples, 1);
});
test('payload after an observed retirement and output in stable B are separate failures', () => {
  const summary = summarizeOrderingSamples([sample(root(NO_CHAIN_ROOT, 2), root(NO_CHAIN_ROOT, 2),
    { comparison: 'other', authorityNotes: [], automaticIdentityEpoch: 1 })], 'owned', []);
  assert.deepEqual((summary.violations as Wire[]).map(value => value.kind), ['output-after-observed-retirement', 'A-output-in-stable-B-bracket']);
});
test('oracle failures remain retained violations rather than losing the control report', () => {
  const summary = summarizeOrderingSamples([sample(root(), root(), { comparison: 'match', authorityNotes: [], automaticIdentityEpoch: 1 })], 'owned', []);
  assert((summary.violations as Wire[]).some(value => value.kind === 'fixture-output-mismatch'));
  const current = sample(root(), root(), { comparison: 'membership-mismatch', authorityAvailable: true, authorityNotes: [], automaticIdentityEpoch: 1 });
  current.status = { complete: false, eligible: false, phase: 'complete' };
  const mismatch = summarizeOrderingSamples([current], 'owned', []);
  assert.equal((mismatch.violations as Wire[])[0]!.kind, 'content-mismatch');
});
test('sample errors stay visible and cannot certify observer delivery', () => {
  const summary = summarizeOrderingSamples([{ error: 'timeout' }], 'owned', []);
  assert.equal(summary.errors, 1); assert.equal(summary.missingEventContinuityProved, false);
});
function commands(): Wire { return { commands: [
  { target: 'B', started: '2026-10-02T00:00:01Z', ended: '2026-10-02T00:00:02Z', completed: true },
  { target: 'A', started: '2026-10-02T00:00:03Z', ended: '2026-10-02T00:00:04Z', completed: true },
] }; }
test('unsampled externally completed B is an observation gap, not a missed-callback claim', () => {
  const summary = summarizeOrderingCommands(commands(), [sample()]);
  assert.equal(summary.externallyCompletedBNotSampled, true); assert.equal(summary.controllerDeliveryFailureProved, false);
  const observed = summarizeOrderingCommands(commands(), [sample(root(NO_CHAIN_ROOT), root())]);
  assert.equal(observed.samplingObservedB, true); assert.equal(observed.externalLogIsHostFence, false);
});
test('native log requires real timing overlap, completed transitions, and return to A', () => {
  const incomplete = commands(); (incomplete.commands as Wire[])[0]!.completed = false;
  assert.throws(() => summarizeOrderingCommands(incomplete, [sample()]));
  const wrongLast = commands(); (wrongLast.commands as Wire[])[1]!.target = 'B';
  assert.throws(() => summarizeOrderingCommands(wrongLast, [sample()]));
  const late = commands(); (late.commands as Wire[])[1]!.started = '2026-10-03T00:00:00Z';
  (late.commands as Wire[])[1]!.ended = '2026-10-03T00:00:01Z';
  (late.commands as Wire[])[0]!.started = '2026-10-03T00:00:00Z'; (late.commands as Wire[])[0]!.ended = '2026-10-03T00:00:00Z';
  assert.throws(() => summarizeOrderingCommands(late, [sample()]));
});
test('a switch during observation after scan termination is not active acquisition interleaving', () => {
  const early = sample(); early.ended = '2026-10-02T00:00:00.100Z';
  const later = sample(); later.started = '2026-10-02T00:00:00.200Z';
  const summary = summarizeOrderingCommands(commands(), [early, later]);
  assert.equal(summary.nativeCommandsOverlappedActiveAcquisition, false);
});
test('authority polls require ten seconds while observational samples can continue', () => {
  assert.equal(orderingPollDue(0, undefined), true); assert.equal(orderingPollDue(9999, 0), false);
  assert.equal(orderingPollDue(10_000, 0), true); assert.equal(orderingPollDue(20_001, 10_000), true);
  assert.throws(() => orderingPollDue(1, 2));
  const observed = sample(root(), root(NO_CHAIN_ROOT, 2)); delete observed.result;
  const summary = summarizeOrderingSamples([observed], 'owned', []);
  assert.equal(summary.crossedB, 1); assert.equal(summary.changedBrackets, 1); assert.equal(summary.outputSamples, 0);
  assert.deepEqual(summary.violations, []);
});
test('the observed 65536-coordinate chunks leave acquisition active for native setup', () => {
  assert.equal(ORDERING_POLL_CADENCE_MS, 10_000);
  let scanned = 65_536, previous: number | undefined;
  for (const elapsed of [0, 250, 750, 4000, 9999, 10_000]) {
    if (orderingPollDue(elapsed, previous)) { scanned += 65_536; previous = elapsed; }
    assert(scanned < 2048 * 128, 'native setup must fit before the final chunk');
  }
  assert.equal(scanned, 196_608); assert(orderingPollDue(20_000, previous));
});
const retained = JSON.parse(gunzipSync(await readFile(new URL('../../../context/evidence/data/phase8g-v5-acceptance/capacity.json.gz', import.meta.url))).toString('utf8')) as Wire;
function report(overlap: boolean, cadence = ORDERING_POLL_CADENCE_MS): Wire {
  const baselines: Wire[] = (retained.baselines as Wire[]).map(capture => ({ ...structuredClone(capture), inventory: retained.initialInventory }));
  const restoration: Wire[] = (retained.restoration as Wire[]).map(capture => ({ ...structuredClone(capture), inventory: retained.cleanupInventory }));
  const expected = baselines.map(capture => ((capture.result as Wire).diagnosticSnapshot as Wire).notes as ShadowNote[]);
  const initDomain = (baselines[0]!.result as Wire).initDomain;
  const item = sample(); item.comparePollIssued = true; item.comparePollAtElapsedMs = 0; item.comparePollSequence = 1;
  if (!overlap) item.ended = '2026-10-02T00:00:00.100Z';
  item.status = { complete: false, eligible: false, instrumentationRevision: MUTATION_MARKER, initDomain, phase: 'retired', authorityAvailable: false };
  item.result = { ...item.status as Wire, comparison: 'window-changed' };
  const observation = sample(); observation.comparePollIssued = false; delete observation.result;
  observation.started = '2026-10-02T00:00:00.200Z'; observation.status = item.status;
  const samples = overlap ? [item] : [item, observation];
  const trace = { extensionInitNonce: 'init', traceClearCount: 1, traceDroppedSinceClear: 0, events: [], traceRetained: 0 };
  const value: Wire = { marker: MUTATION_MARKER, stage: 'finished', started: '2026-10-02T00:00:00Z', ended: '2026-10-02T00:00:10Z',
    researchOnly: true, complete: false, eligible: false, callbackOriginProved: false, missingEventContinuityProved: false,
    hostInputOrderingProved: false, perBatchGetStepValuesAvailable: false, fixtureMutationsIssued: 0, fixtureRestored: true,
    comparePollCadenceMs: cadence, comparePollCount: 1, samples, beforeTrace: trace, afterTrace: trace,
    ownedTrackId: retained.ownedTrackId, expectedRows: expected, baseline: baselines, restoration,
    active: { complete: false, eligible: false, comparison: 'pending', scanProgressCoordinates: 65_536, scanTotalCoordinates: 262_144, initDomain },
    initialTracks: retained.rawTracks, finalTracks: retained.rawTracks, finalScenes: 8,
    initialRootEndpoint: retained.initialRootEndpoint, finalRootEndpoint: retained.initialRootEndpoint, commandLog: commands() };
  value.summary = summarizeOrderingSamples(samples, String(value.ownedTrackId), expected[0]!);
  value.commandSummary = summarizeOrderingCommands(value.commandLog as Wire, samples); return value;
}
test('timing diagnostics and accepted interleaving have distinct verifier roles', () => {
  const accepted = report(true); assert.equal(verifyOrderingReport(accepted).interleavingTrials, 1);
  assert.throws(() => verifyOrderingTimingDiagnostic(accepted));
  const diagnostic = report(false, 250), summary = verifyOrderingTimingDiagnostic(diagnostic);
  assert.equal(summary.interleavingTrials, 0); assert.equal(summary.timingDiagnosticTrials, 1);
  assert.equal(summary.diagnosticReason, 'nativecommands-after-acquisition'); assert.throws(() => verifyOrderingReport(diagnostic));
  const dirty = report(false, 250); dirty.fixtureRestored = false; assert.throws(() => verifyOrderingTimingDiagnostic(dirty));
  const broken = report(false, 250); (broken.restoration as Wire[])[0] = { result: { comparison: 'mismatch' } };
  assert.throws(() => verifyOrderingTimingDiagnostic(broken));
});
