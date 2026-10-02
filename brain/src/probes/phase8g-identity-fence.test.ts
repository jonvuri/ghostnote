import assert from 'node:assert/strict';
import test from 'node:test';
import { identityEndpoint, checkIdentityRefusal, summarizeIdentityFence, verifyIdentityFenceReport } from './phase8g-identity-fence.js';
import { ACQUIRED_FIELDS, MUTATION_MARKER } from './phase8g-shadow-mutations.js';

type Wire = Record<string, unknown>;
const read = (value: unknown): Wire => ({ status: 'read', value });
const candidates = Array.from({ length: 4 }, (_, layerWindowIndex) => ({ trackWindowIndex: 0, deviceWindowIndex: 0, layerWindowIndex,
  trackChannelId: 'owned', trackName: 'gn-8g-reuse', trackPosition: 0, trackDeviceCount: 1, deviceName: 'Instrument Layer', devicePosition: 0,
  hasLayers: true, layerCount: 4, chainChannelId: `chain-${layerWindowIndex}`, chainName: `Layer ${layerWindowIndex}`, chainDeviceCount: 0 }));
function capture(delivered = false): Wire {
  const events: Wire[] = [{ sequence: 1, kind: 'trace-cleared' }];
  if (delivered) events.push({ sequence: 2, kind: 'callback', signal: 'hasActiveEngine', value: false },
    { sequence: 3, kind: 'callback', signal: 'chainWitness.track.0.device.0.layer.0.channelId', value: 'another-loaded-chain' });
  const shared = { extensionInitNonce: 'extension-one', probeInstanceNonce: 'root-one', callbackCount: delivered ? 2 : 0,
    sequence: delivered ? 3 : 1, traceDroppedSinceClear: 0 };
  return { root: { ...shared, instrumentationRevision: '8g-root-existing-chain-v1', identityDetectionProved: false, hostInputFenceProved: false,
    current: { projectExists: read(true), rootExists: read(true), hasActiveEngine: read(true), projectName: read('New 1'), rootChannelId: read('root'), masterChannelId: read('master') },
    existingChainWitnesses: { candidates }, callbacksChangedDuringRead: false, sequenceBeforeRead: shared.sequence, sequenceAfterRead: shared.sequence,
    automaticIdentityEpoch: delivered ? 5 : 3 },
    trace: { ...shared, traceClearCount: 1, traceRetained: events.length, events } };
}
const refusal = { instrumentationRevision: MUTATION_MARKER, comparison: 'window-changed', complete: false, eligible: false,
  authorityAvailable: false, callbackSourceIdentityKnown: false, readMode: 'refuse' };
function report(): Wire {
  const expectedNotes = Array.from({ length: 16 }, (_, channel) => {
    const fields = Object.fromEntries(ACQUIRED_FIELDS.map(field => [field, field.startsWith('is') ? false : field === 'occurrence' ? 'ALWAYS' : 0]));
    Object.assign(fields, { velocity: (80 + channel) / 127, duration: 2 / 512, rawDuration: 2 / 512, durationCells: 2,
      chance: channel === 0 ? .375 : 1, rawTimbre: channel === 0 ? -.5 : 0, timbre: channel === 0 ? .25 : .5 });
    return { channel, cell: 0, pitch: 60, fields };
  });
  const coverage = { startCell: 0, width: 2048, allChannels: true, fields: [...ACQUIRED_FIELDS], unsupportedFields: ['portableRepeat', 'articulation'], timingBasis: '1/512-beat' };
  const metadata = { name: 'gn-8g-reuse-A', exists: true, length: 4 };
  const comparison = (project: number): Wire => ({ instrumentationRevision: MUTATION_MARKER, comparison: 'match', complete: false, eligible: false,
    authorityAvailable: true, contentComparisonComplete: true, callbackSourceIdentityKnown: false, physicalPendingHints: 0, pendingCoordinates: 0,
    physicalHintOverflow: false, stepDataObservers: 3, residentHandles: 2, observerKind: 'addStepDataObserver', authorityCoverage: coverage,
    authorityNotes: expectedNotes, authorityMetadata: metadata, diagnosticSnapshot: { clipRef: `clip-${project}`, address: { trackId: 'owned', row: 0 },
      token: { initDomain: 'controller-one', project, structure: 1, binding: 1, rebuild: 1 }, contentGeneration: 1, invalidationSequence: 0,
      coverage, metadata, notes: expectedNotes, fingerprint: 'notes' } });
  const registry = { result: { rebuildTerminal: true, registryPublished: true, complete: false, eligible: false,
    inventoryRebuild: { phase: 'published', terminal: true, registryPublished: true, fullInventoryEnumerated: true, membershipComplete: false, complete: false, eligible: false } } };
  const prepared = { ...capture(), comparison: comparison(7), binding: { canaryVerifiedForBinding: true }, inventory: registry,
    active: { comparison: 'pending', scanProgressCoordinates: 8, scanTotalCoordinates: 2048 * 128, initDomain: 'controller-one', projectGeneration: 7 },
    shadow: { initDomain: 'controller-one', automaticIdentityInvalidations: 2, projectGeneration: 7 } };
  const finish = { ...capture(true), polls: [refusal, refusal], oldRead: refusal,
    shadow: { initDomain: 'controller-one', automaticIdentityInvalidations: 3, projectGeneration: 8 } };
  return { label: 'delivered-test', marker: MUTATION_MARKER, initial: { instrumentationRevision: MUTATION_MARKER, residentHandles: 2, authorityHandles: 1 },
    researchOnly: true, complete: false, eligible: false, identityDetectionProved: false, absentCallbackDetectionProved: false, hostInputFenceProved: false,
    stage: 'finished', outcome: 'observed-event-fence-pass', ended: '2026-10-01T00:00:00Z', ownedTrackId: 'owned', expectedNotes,
    prepare: prepared, finish, recovery: { binding: { canaryVerifiedForBinding: true }, inventory: registry, comparison: comparison(8) },
    summary: summarizeIdentityFence(prepared, finish, 'owned') };
}

test('equal returned inputs retain delivered callbacks without an absent-event claim', () => {
  assert.deepEqual(identityEndpoint(capture().root as Wire, 'owned'), identityEndpoint(capture(true).root as Wire, 'owned'));
  const summary = summarizeIdentityFence(capture(), capture(true), 'owned');
  assert.equal(summary.deliveredCallbacks, 2); assert.equal(summary.deliveredIdentityCallbacks, 1); assert.equal(summary.rootIdentityEpochDelta, 2);
  assert.equal(summary.absentCallbackDetectionProved, false); assert.equal(summary.identityDetectionProved, false);
  const silent = summarizeIdentityFence(capture(), capture(), 'owned'); assert.equal(silent.deliveredCallbacks, 0); assert.equal(silent.absentCallbackDetectionProved, false);
});

test('incomplete event traces and changed endpoint chain inputs cannot certify the interval', () => {
  const after = capture(true);
  assert.throws(() => summarizeIdentityFence(capture(), { ...after, trace: { ...(after.trace as Wire), traceDroppedSinceClear: 1 } }, 'owned'));
  assert.throws(() => summarizeIdentityFence(capture(), { ...after, trace: { ...(after.trace as Wire), traceClearCount: 2 } }, 'owned'));
  const root = after.root as Wire;
  assert.throws(() => summarizeIdentityFence(capture(), { ...after, root: { ...root, existingChainWitnesses: { candidates: candidates.map((value, index) => index === 0 ? { ...value, chainChannelId: 'copy-chain' } : value) } } }, 'owned'));
});

test('retired reads must refuse all current and retained payloads', () => {
  assert.doesNotThrow(() => checkIdentityRefusal(refusal));
  for (const field of ['diagnosticSnapshot', 'authorityNotes', 'historicalSnapshot', 'authoritativeSnapshot']) assert.throws(() => checkIdentityRefusal({ ...refusal, [field]: {} }));
  assert.throws(() => checkIdentityRefusal({ ...refusal, authorityAvailable: true }));
});

test('a complete observed-event report requires counter changes, two terminal polls, and a fresh recovered generation', () => {
  const value = report(); assert.equal(verifyIdentityFenceReport(value).deliveredIdentityCallbacks, 1);
  const finish = value.finish as Wire, prepared = value.prepare as Wire, recovery = value.recovery as Wire;
  assert.throws(() => verifyIdentityFenceReport({ ...value, finish: { ...finish, polls: [refusal] } }));
  assert.throws(() => verifyIdentityFenceReport({ ...value, finish: { ...finish, shadow: prepared.shadow } }));
  assert.throws(() => verifyIdentityFenceReport({ ...value, recovery: { ...recovery, comparison: prepared.comparison } }));
  assert.throws(() => verifyIdentityFenceReport({ ...value, identityDetectionProved: true }));
  assert.throws(() => verifyIdentityFenceReport({ ...value, absentCallbackDetectionProved: true }));
});
