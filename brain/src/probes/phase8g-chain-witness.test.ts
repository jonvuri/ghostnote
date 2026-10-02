import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyChainWitnessReport } from './phase8g-chain-witness.js';

type Wire = Record<string, unknown>;
const read = (value: unknown): Wire => ({ status: 'read', value });
function capture(label: string, chainId = 'chain-a', changes: Wire = {}): { label: string; snapshot: Wire; trace: Wire } {
  const candidate: Wire = { trackWindowIndex: 0, deviceWindowIndex: 0, layerWindowIndex: 0,
    trackChannelId: 'track-a', trackName: 'owned-A', trackPosition: 0, trackDeviceCount: 1,
    deviceName: 'Instrument Layer', devicePosition: 0, hasLayers: true, layerCount: 1,
    chainChannelId: chainId, chainName: 'owned-chain-0', chainDeviceCount: 1, ...changes };
  const tp = 'chainWitness.track.0', dp = `${tp}.device.0`, lp = `${dp}.layer.0`;
  const source: Wire = {};
  for (const path of [`${tp}.exists`, `${dp}.exists`, `${lp}.exists`]) source[path] = read(true);
  const mapping: Record<string, string> = { trackChannelId: `${tp}.channelId`, trackName: `${tp}.name`, trackPosition: `${tp}.position`,
    trackDeviceCount: `${tp}.deviceCount`, deviceName: `${dp}.name`, devicePosition: `${dp}.position`, hasLayers: `${dp}.hasLayers`,
    layerCount: `${dp}.layerCount`, chainChannelId: `${lp}.channelId`, chainName: `${lp}.name`, chainDeviceCount: `${lp}.deviceCount` };
  for (const [key, path] of Object.entries(mapping)) source[path] = candidate[key] === null
    ? { status: 'read-error', value: null } : read(candidate[key]);
  const state: Wire = { purpose: 'root-identity-research', instrumentationRevision: '8g-root-existing-chain-v1',
    identityDetectionProved: false, extensionInitNonce: 'extension-one', probeInstanceNonce: 'probe-one', sequence: 5,
    callbackCount: 4, traceDroppedTotal: 0, traceDroppedSinceClear: 0 };
  const snapshot: Wire = { ...state, sequenceBeforeRead: 5, sequenceAfterRead: 5, callbacksChangedDuringRead: false,
    current: { projectExists: read(true), rootExists: read(true), hasActiveEngine: read(false),
      projectName: read('identity'), rootChannelId: read('root-a'), masterChannelId: read('root-a') },
    existingChainWitnesses: { loadedInstanceIdentityProved: false, settlementProved: false, scopeComplete: false,
      trackWindow: 4, deviceWindowPerTrack: 4, layerWindowPerDevice: 4, candidateCount: 1, candidates: [candidate], current: source } };
  return { label, snapshot, trace: { ...state, traceCapacity: 2048, traceRetained: 1, events: [{ sequence: 5 }] } };
}
function report(...captures: ReturnType<typeof capture>[]): Wire { return { researchOnly: true, identityDetectionProved: false, captures }; }
function witness(c: ReturnType<typeof capture>): Wire { return c.snapshot.existingChainWitnesses as Wire; }

test('matched chain structure reports UUID same or different without project identity', () => {
  const result = verifyChainWitnessReport(report(capture('A'), capture('copy', 'chain-copy'), capture('reload')));
  assert.deepEqual(result.pairs.map(pair => pair.chainUUIDs), ['different', 'same', 'different']);
  assert.equal(result.identityDetectionProved, false); assert.equal(result.pairs[0]!.comparedChains, 1);
  assert.equal(result.pairs[0]!.changedChainUUIDs, 1); assert.equal(result.pairs[0]!.reason, 'matched-source-structure');
});
test('distinct track identity or changed source structure is unavailable', () => {
  for (const changes of [{ trackChannelId: 'independent-track' }, { trackName: 'different track' },
    { deviceName: 'different container' }, { devicePosition: 1, trackDeviceCount: 2 },
    { chainName: 'renamed chain' }, { layerCount: 2 }, { chainDeviceCount: 2 }]) {
    const result = verifyChainWitnessReport(report(capture('A'), capture('B', 'different-uuid', changes)));
    assert.equal(result.pairs[0]!.chainUUIDs, 'unknown'); assert.equal(result.pairs[0]!.reason, 'source-structure-differs');
  }
});
test('no chain, unreadable chain, and unbound root cannot supply a witness', () => {
  const empty = capture('no-chain'); witness(empty).candidates = []; witness(empty).candidateCount = 0;
  assert.equal(verifyChainWitnessReport(report(capture('A'), empty)).pairs[0]!.reason, 'no-chain-witness');
  const unreadable = capture('read-error', 'chain-b', { chainChannelId: null });
  assert.equal(verifyChainWitnessReport(report(capture('A'), unreadable)).pairs[0]!.reason, 'unreadable-source-or-chain');
  const unbound = capture('unbound'); (unbound.snapshot.current as Wire).projectExists = read(false);
  assert.equal(verifyChainWitnessReport(report(capture('A'), unbound)).pairs[0]!.reason, 'project-or-root-unbound');
});
test('snapshot callbacks or later trace changes prevent an endpoint comparison', () => {
  const changed = capture('changing'); changed.snapshot.sequenceAfterRead = 6; changed.snapshot.callbacksChangedDuringRead = true; changed.trace.sequence = 6;
  assert.equal(verifyChainWitnessReport(report(capture('A'), changed)).pairs[0]!.reason, 'endpoint-sequence-changed');
  const later = capture('late callback'); later.trace.sequence = 6;
  assert.equal(verifyChainWitnessReport(report(capture('A'), later)).captures[1]!.endpointStable, false);
});
test('trace loss is explicit and cannot be missing or fabricated', () => {
  const dropped = capture('dropped'); dropped.trace.traceDroppedTotal = 3; dropped.trace.traceDroppedSinceClear = 1;
  const result = verifyChainWitnessReport(report(capture('A'), dropped));
  assert.equal(result.captures[1]!.traceDrops, 3); assert.equal(result.pairs[0]!.traceComplete, false);
  const missing = capture('missing'); delete missing.trace.traceDroppedTotal;
  assert.throws(() => verifyChainWitnessReport(report(missing)));
  const backwards = capture('bad trace'); backwards.trace.events = [{ sequence: 4 }, { sequence: 3 }]; backwards.trace.traceRetained = 2;
  assert.throws(() => verifyChainWitnessReport(report(backwards)));
});
test('marker, original six read values, and experimental status are required', () => {
  for (const mutate of [(c: ReturnType<typeof capture>) => { c.snapshot.instrumentationRevision = 'old-code'; },
    (c: ReturnType<typeof capture>) => { c.trace.instrumentationRevision = 'old-code'; },
    (c: ReturnType<typeof capture>) => { (c.snapshot.current as Wire).rootChannelId = { status: 'unavailable', value: null }; },
    (c: ReturnType<typeof capture>) => { c.snapshot.identityDetectionProved = true; },
    (c: ReturnType<typeof capture>) => { witness(c).loadedInstanceIdentityProved = true; },
    (c: ReturnType<typeof capture>) => { c.trace.extensionInitNonce = 'other-instance'; }]) {
    const c = capture('invalid'); mutate(c); assert.throws(() => verifyChainWitnessReport(report(c)));
  }
});
test('candidate count, window bounds, source counts, and original values are checked', () => {
  for (const mutate of [(w: Wire) => { w.candidateCount = 65; }, (w: Wire) => { w.trackWindow = 5; },
    (w: Wire) => { w.candidateCount = 0; }, (w: Wire) => { w.candidates = [...w.candidates as Wire[], ...w.candidates as Wire[]]; w.candidateCount = 2; },
    (w: Wire) => { (w.current as Wire)['chainWitness.track.0.device.0.layer.0.channelId'] = read('forged'); }]) {
    const c = capture('invalid'); mutate(witness(c)); assert.throws(() => verifyChainWitnessReport(report(c)));
  }
  assert.throws(() => verifyChainWitnessReport(report(capture('out-of-source-count', 'chain-a', { layerCount: 0 }))));
  assert.throws(() => verifyChainWitnessReport(report(capture('fraction', 'chain-a', { chainDeviceCount: 1.5 }))));
});
test('undo and root engine state never affect chain UUID comparison', () => {
  const a = capture('before'), b = capture('after');
  (witness(a).current as Wire)['chainWitness.canUndo'] = read(true);
  (witness(b).current as Wire)['chainWitness.canUndo'] = read(false);
  (b.snapshot.current as Wire).hasActiveEngine = read(true); b.snapshot.extensionInitNonce = 'new'; b.trace.extensionInitNonce = 'new';
  assert.equal(verifyChainWitnessReport(report(a, b)).pairs[0]!.chainUUIDs, 'same');
});
