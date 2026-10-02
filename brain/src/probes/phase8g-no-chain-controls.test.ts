import assert from 'node:assert/strict';
import test from 'node:test';
import { NO_CHAIN_ROOT, NO_CHAIN_MAIN_IDS, NO_CHAIN_FX_ID, NO_CHAIN_PROJECT, NO_CHAIN_MARKER, verifyNoChainBaseline,
  verifyNoChainReport, verifyNoChainRoot, verifyNoChainSave } from './phase8g-no-chain-controls.js';
type Wire = Record<string, unknown>;
const unknown = { instrumentationRevision: NO_CHAIN_MARKER, complete: false, eligible: false, optionalLifecycleWitnessSupported: true,
  identityWitnessAvailable: false, identityContinuityProved: false, hostInputFenceProved: false, lifecycleFallback: 'project-lifecycle-fence-unproved',
  resident: 0, entries: 1, occupiedCoordinates: 0, initDomain: 'controller-one', projectGeneration: 12 };
function root(): Wire {
  const row = (value: unknown): Wire => ({ status: 'read', value }); const current: Wire = {};
  for (const [i, id] of NO_CHAIN_MAIN_IDS.entries()) for (const [field, expected] of [['exists', true], ['channelId', id], ['deviceCount', 0]] as const)
    current[`chainWitness.track.${i}.${field}`] = row(expected);
  return { instrumentationRevision: '8g-root-existing-chain-v1', identityDetectionProved: false, hostInputFenceProved: false,
    current: { rootChannelId: row(NO_CHAIN_ROOT), masterChannelId: row(NO_CHAIN_ROOT), projectExists: row(true), rootExists: row(true),
      projectName: row('identity'), hasActiveEngine: row(false) }, extensionInitNonce: 'controller-one', automaticIdentityEpoch: 48,
    callbacksChangedDuringRead: false, sequenceBeforeRead: 100, sequenceAfterRead: 100,
    existingChainWitnesses: { trackWindow: 4, deviceWindowPerTrack: 4, layerWindowPerDevice: 4, candidateCount: 0, candidates: [],
      loadedInstanceIdentityProved: false, scopeComplete: false, current } };
}
function baseline(): Wire {
  const ids = [...NO_CHAIN_MAIN_IDS, NO_CHAIN_FX_ID, NO_CHAIN_ROOT];
  const tracks = ids.map((channelId, index) => ({ channelId, index, position: index, name: ['Inst 1', 'Audio 2', 'FX 1', 'Master'][index], type: 'test' }));
  return { root: root(), cache: { ...unknown }, scenes: 8, trackList: { tracks, count: 4, itemCount: 4, bankSize: 16 },
    slots: ids.flatMap(id => Array.from({ length: 8 }, (_, row) => ({ id, row, exists: true, hasContent: false }))),
    scan: { slotsWithContent: 0 }, disk: { path: NO_CHAIN_PROJECT, bytes: 100, sha256: 'a'.repeat(64) } };
}
const refused = { ...unknown, terminal: true, phase: 'refused', authorityAvailable: false, fallbackPerformed: false, readMode: 'refuse' };
function report(): Wire {
  return { researchOnly: true, complete: false, eligible: false, identityDetectionProved: false, hostInputFenceProved: false,
    noChainScope: 'owned-B-fixed-main-track-window', ended: 'now', fixtureRestored: true, before: baseline(), after: baseline(),
    createdTrackId: NO_CHAIN_MAIN_IDS[0], createdRow: 0, createdClipCount: 1, createdSlot: { hasContent: true }, beforeExact: { ...unknown }, exactHostCalls: 2048 * 128 * 16,
    acquireRefusals: [{ ...unknown, poolDecision: 'refused', reason: 'identity-witness-unavailable' }, { ...unknown, poolDecision: 'refused', reason: 'identity-witness-unavailable' }],
    manual: { mode: 'history-refusal', result: { ...unknown, authorityAvailable: false, readMode: 'refuse', reason: 'populated-canary-required-for-rebind' } },
    exact: { ...unknown, terminal: true, phase: 'acquired', authorityAvailable: true, fallbackPerformed: true, readMode: 'exact-fallback',
      cacheResidenceAdmitted: false, cacheMembershipUsed: false, address: { trackId: NO_CHAIN_MAIN_IDS[0], row: 0 },
      coverage: { startCell: 0, width: 2048, allChannels: true, timingBasis: '1/512-beat' }, scannedCoordinates: 2048 * 128,
      totalCoordinates: 2048 * 128, authorityNoteCount: 0, authorityNotes: [], authorityMetadata: { name: 'empty', playStart: 0, playStop: 4, loopStart: 0, loopLength: 4 } },
    scopeRefusals: [{ ...refused, reason: 'authority-coverage-unavailable' }, { ...refused, reason: 'authority-coverage-unavailable' }],
    afterScopeRefusal: { ...refused }, cancelled: { active: { phase: 'scanning', scannedCoordinates: 100 },
      after: [{ ...refused, reason: 'no-chain-control-cancel' }, { ...refused, reason: 'no-chain-control-cancel' }] } };
}
test('B scope needs known root/main UUIDs, no chains, four tracks and 32 empty slots', () => {
  assert.doesNotThrow(() => verifyNoChainBaseline(baseline()));
  for (const mutate of [(v: Wire) => { (v.root as Wire).current = {}; }, (v: Wire) => { ((v.root as Wire).existingChainWitnesses as Wire).candidateCount = 1; },
    (v: Wire) => { (v.slots as Wire[])[0]!.hasContent = true; }, (v: Wire) => { (v.trackList as Wire).itemCount = 5; },
    (v: Wire) => { (v.disk as Wire).path = '/tmp/unowned.bwproject'; }]) {
    const value = baseline(); mutate(value); assert.throws(() => verifyNoChainBaseline(value));
  }
});
test('engine state is diagnostic but a read-time callback refuses the endpoint', () => {
  const value = root(); (value.current as Wire).hasActiveEngine = { status: 'read', value: true }; assert.doesNotThrow(() => verifyNoChainRoot(value));
  value.callbacksChangedDuringRead = true; assert.throws(() => verifyNoChainRoot(value));
});
test('empty fallback requires full coordinates, all host calls and zero admission', () => {
  assert.equal(verifyNoChainReport(report()), 1);
  for (const changed of [{ scannedCoordinates: 262143 }, { authorityNotes: [{ channel: 0 }] }, { cacheResidenceAdmitted: true },
    { cacheMembershipUsed: true }, { resident: 1 }, { entries: 2 }, { eligible: true }, { authorityAvailable: false }]) {
    const value = report(); Object.assign(value.exact as Wire, changed); assert.throws(() => verifyNoChainReport(value));
  }
  const value = report(); value.exactHostCalls = 0; assert.throws(() => verifyNoChainReport(value));
});
test('cleanup, refusal corpus and cancelled output cannot be omitted or promoted', () => {
  for (const changed of [{ fixtureRestored: false }, { createdTrackId: NO_CHAIN_ROOT }, { createdClipCount: 2 }, { acquireRefusals: [] }])
    assert.throws(() => verifyNoChainReport({ ...report(), ...changed }));
  const value = report(); ((value.cancelled as Wire).after as Wire[])[0]!.authorityNotes = []; assert.throws(() => verifyNoChainReport(value));
  const changedCensus = report(); ((changedCensus.after as Wire).trackList as Wire).tracks = []; assert.throws(() => verifyNoChainReport(changedCensus));
});
test('fresh settlement and physical history refusal retain distinct branches', () => {
  const value = report(); value.manual = { mode: 'settled-reuse-refusal', result: { ...unknown, authorityAvailable: false, readMode: 'refuse', reason: 'identity-unverified-requires-forced-canary' } };
  assert.equal(verifyNoChainReport(value), 1); (value.manual as Wire).mode = 'assumed-reuse'; assert.throws(() => verifyNoChainReport(value));
});
test('manual save requires confirmation and preserves local domain without proving identity', () => {
  const value: Wire = { researchOnly: true, complete: false, eligible: false, manualSaveConfirmed: true, ended: 'now',
    identityDetectionProved: false, hostInputFenceProved: false, before: baseline(), after: baseline() };
  assert.doesNotThrow(() => verifyNoChainSave(value));
  for (const changed of [{ initDomain: 'other-controller' }, { projectGeneration: 13 }]) {
    const wrong = structuredClone(value); Object.assign((wrong.after as Wire).cache as Wire, changed); assert.throws(() => verifyNoChainSave(wrong));
  }
  const unconfirmed = structuredClone(value); unconfirmed.manualSaveConfirmed = false; assert.throws(() => verifyNoChainSave(unconfirmed));
});
