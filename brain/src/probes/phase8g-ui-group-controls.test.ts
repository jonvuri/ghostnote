import assert from 'node:assert/strict';
import test from 'node:test';
import { GROUP_CONTROL_REVISION, GROUP_REQUIRED_METHODS, groupCancellationObserved, groupCensus, summarizeGroupTopology,
  UI_GROUP_NAME, verifyAbortedChild, verifyGroupMethods, verifyTrackGroups, verifyUngroupedCleanup } from './phase8g-ui-group-controls.js';

type Wire = Record<string, unknown>;
const uuid = (n: number): string => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
function track(index: number, n: number, name = `track-${n}`): Wire { return { index, position: index, channelId: uuid(n), name, type: 'Instrument' }; }
function census(tracks: Wire[]): Wire { return { tracks, count: tracks.length, itemCount: tracks.length, bankSize: 256 }; }
const before = census([track(0, 1), track(1, 2, UI_GROUP_NAME), track(2, 3)]);
const child = uuid(2), mixer = { channelId: child, name: UI_GROUP_NAME, isGroup: false };
const slots = Array.from({ length: 8 }, (_, row) => ({ id: child, row, exists: true, hasContent: false }));
test('full flat census requires UUIDs, unique IDs, exact counts and stable indices', () => {
  assert.equal(groupCensus(before).length, 3);
  for (const value of [{ ...before, itemCount: 4 }, { ...before, bankSize: 2 }, census([track(0, 1), track(1, 1)]), census([track(1, 1)]), census([{ ...track(0, 1), channelId: '' }])])
    assert.throws(() => groupCensus(value));
});
test('visible child plus one new group never proves descendants or wrapper ownership', () => {
  const after = census([track(0, 1), track(1, 4, 'Group'), track(2, 2, UI_GROUP_NAME), track(3, 3)]);
  assert.deepEqual(summarizeGroupTopology(before, after, child, [{ channelId: uuid(4), isGroup: true }]), {
    addedIds: [uuid(4)], missingIds: [], ownedChildVisible: true, newGroupIds: [uuid(4)], groupMembershipProved: false,
    baselineDescendantsExcluded: false, wrapperDeletionAllowed: false, requiresNativeUngroup: true,
  });
});
test('collapsed child and missing baseline remain diagnostic only', () => {
  const after = census([track(0, 1), track(1, 4, 'Group')]);
  const value = summarizeGroupTopology(before, after, child, [{ channelId: uuid(4), isGroup: true }]);
  assert.equal(value.ownedChildVisible, false); assert.deepEqual(value.missingIds, [uuid(2), uuid(3)]);
  assert.equal(value.wrapperDeletionAllowed, false); assert.equal(value.baselineDescendantsExcluded, false);
});
test('cleanup requires exact native ungroup recovery; only the empty child is deletable', () => {
  verifyUngroupedCleanup(before, structuredClone(before), child, mixer, slots);
  for (const value of [census([track(0, 1), track(1, 4, 'Group'), track(2, 2, UI_GROUP_NAME), track(3, 3)]),
    census([track(0, 1), track(1, 3), track(2, 2, UI_GROUP_NAME)]), census([track(0, 1), track(1, 2, 'renamed'), track(2, 3)])])
    assert.throws(() => verifyUngroupedCleanup(before, value, child, mixer, slots));
  for (const value of [{ ...mixer, isGroup: true }, { ...mixer, channelId: uuid(4) }, { ...mixer, name: 'renamed' }])
    assert.throws(() => verifyUngroupedCleanup(before, before, child, value, slots));
});
test('cleanup refuses content, omitted rows and another track slot', () => {
  for (const value of [slots.slice(0, 7), slots.map((slot, row) => row === 0 ? { ...slot, hasContent: true } : slot),
    slots.map((slot, row) => row === 0 ? { ...slot, id: uuid(1) } : slot), slots.map((slot, row) => row === 7 ? { ...slot, row: 6 } : slot)])
    assert.throws(() => verifyUngroupedCleanup(before, before, child, mixer, value));
});
test('stale scan cancellation requires a closed terminal result with no retained output', () => {
  const refusal = { complete: false, eligible: false, comparison: 'window-changed', authorityAvailable: false };
  assert.equal(groupCancellationObserved(refusal), true);
  for (const patch of [{ comparison: 'pending' }, { comparison: 'match' }, { authorityAvailable: true },
    { diagnosticSnapshot: {} }, { authorityNotes: [] }, { historicalSnapshot: {} }, { authoritativeSnapshot: {} }])
    assert.equal(groupCancellationObserved({ ...refusal, ...patch }), false);
  assert.throws(() => groupCancellationObserved({ ...refusal, eligible: true }));
  assert.equal(groupCancellationObserved({ ...refusal, comparison: 'match', readMode: 'refuse', phase: 'retired' }), false,
    'a historical match can describe a refused read, but it does not prove cancellation of the active comparison');
});
function flags(value: Wire): Wire {
  return { groupControlRevision: GROUP_CONTROL_REVISION, coherent: true, fullWindow: true, researchOnly: true,
    groupMembershipProved: false, hostInputOrderingProved: false, totalCount: (value.tracks as Wire[]).length, bankSize: 256,
    tracks: (value.tracks as Wire[]).map(track => ({ index: track.index, name: track.name, channelId: track.channelId, isGroup: false, isGroupExpanded: false })) };
}
test('prepare preflight rejects missing methods and absent or mismatched group snapshot before creation', () => {
  verifyGroupMethods({ runtimeProfile: 'phase-8-probe-v1', methods: [...GROUP_REQUIRED_METHODS] });
  for (const omitted of GROUP_REQUIRED_METHODS) assert.throws(() => verifyGroupMethods({ runtimeProfile: 'phase-8-probe-v1', methods: GROUP_REQUIRED_METHODS.filter(method => method !== omitted) }));
  const value = flags(before); verifyTrackGroups(value, before);
  for (const patch of [{ groupControlRevision: 'old' }, { coherent: false }, { fullWindow: false }, { totalCount: 4 },
    { tracks: [{ ...(value.tracks as Wire[])[0], channelId: uuid(9) }, ...(value.tracks as Wire[]).slice(1)] }])
    assert.throws(() => verifyTrackGroups({ ...value, ...patch }, before));
});
test('failed prepare recovery requires exact plain-child ownership and rejects any grouped attempt', () => {
  const baseline = census([track(0, 1), track(1, 3)]);
  const source = { stage: 'preparing', error: 'BridgeError: Method not found: branch.mixer', baseline: { trackList: baseline },
    originalTrackId: uuid(1), ownedTrackId: child, creationIntent: { position: 1, name: UI_GROUP_NAME, priorIds: [uuid(1), uuid(3)] } };
  verifyAbortedChild(source, before, flags(before), slots);
  assert.throws(() => verifyAbortedChild({ ...source, grouped: {} }, before, flags(before), slots));
  assert.throws(() => verifyAbortedChild({ ...source, prepare: {} }, before, flags(before), slots));
  assert.throws(() => verifyAbortedChild({ ...source, error: 'other failure' }, before, flags(before), slots));
  const grouped = flags(before); (grouped.tracks as Wire[])[1]!.isGroup = true;
  assert.throws(() => verifyAbortedChild(source, before, grouped, slots));
});
