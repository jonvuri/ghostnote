import assert from 'node:assert/strict';
import test from 'node:test';
import { automaticStructureFence } from './phase8g-shadow-structure.js';
import { SCENE_CONTROL_REVISION, SCENE_METHODS, sceneRows, uiSceneSeedSettled, verifyNativeSceneInsertion, verifyOwnedSceneTail,
  verifySceneMethods, verifySceneSlotLayout, verifySceneTrackExtension, parseSceneFinishArguments, sceneActionProvenance, verifySceneActionEvidence, UI_SCENE_OUTPUT } from './phase8g-ui-scene-controls.js';

type Wire = Record<string, unknown>;
const names = ['gn-8g-ui-scene-test-first', 'gn-8g-ui-scene-test-target', 'gn-8g-ui-scene-test-last'];
function scenes(tail: readonly string[] = []): Wire {
  const labels = [...Array.from({ length: 8 }, (_, index) => `Scene ${index + 1}`), ...tail];
  return { sceneControlRevision: SCENE_CONTROL_REVISION, researchOnly: true, coherent: true, fullWindow: true, sceneIdentityProved: false,
    hostInputOrderingProved: false, namesAreMutable: true, windowStart: 0, totalCount: labels.length, bankSize: 128,
    sequenceBeforeRead: 1, sequenceAfterRead: 1, callbacksChangedDuringRead: false,
    scenes: Array.from({ length: 128 }, (_, index) => ({ index, exists: index < labels.length, ...(index < labels.length ? { name: labels[index], position: index } : {}) })) };
}
const baseline = scenes(), inserted = scenes([names[0]!, 'Scene 10', names[1]!, names[2]!]);
test('nested all-channel seed requires the sole channel-0 pitch-67 note with exact duration', () => {
  const raw = { count: 1, channels: Array.from({ length: 16 }, (_, channel) => ({ channel,
    notes: channel === 0 ? [{ x: 0, y: 67, velocity: 91 / 127, duration: 5 / 512 }] : [] })) };
  assert.equal(uiSceneSeedSettled(raw), true);
  assert.equal(uiSceneSeedSettled({ count: 1, notes: raw.channels[0]!.notes }), false);
  for (const patch of [{ x: 1 }, { y: 60 }, { velocity: 80 / 127 }, { duration: 6 / 512 }]) {
    const value = structuredClone(raw); Object.assign(value.channels[0]!.notes[0]!, patch); assert.equal(uiSceneSeedSettled(value), false);
  }
  const extra = structuredClone(raw); extra.channels[15]!.notes = [...extra.channels[0]!.notes]; assert.equal(uiSceneSeedSettled(extra), false);
  const moved = structuredClone(raw); moved.channels[15]!.notes = moved.channels[0]!.notes; moved.channels[0]!.notes = [];
  assert.equal(uiSceneSeedSettled(moved), false);
  const omitted = structuredClone(raw); omitted.channels.pop(); assert.equal(uiSceneSeedSettled(omitted), false);
  const duplicate = structuredClone(raw); duplicate.channels[15]!.channel = 0; assert.equal(uiSceneSeedSettled(duplicate), false);
});
test('scene read requires bounded coherent positions and names without identity promotion', () => {
  assert.equal(sceneRows(baseline).length, 8);
  for (const patch of [{ sceneControlRevision: 'old' }, { coherent: false }, { fullWindow: false }, { windowStart: 1 },
    { sceneIdentityProved: true }, { hostInputOrderingProved: true }, { sequenceAfterRead: 2 }, { callbacksChangedDuringRead: true }, { bankSize: 129 }])
    assert.throws(() => sceneRows({ ...baseline, ...patch }));
  for (const patch of [{ position: 2 }, { exists: false }, { readError: 'unavailable' }]) {
    const value = structuredClone(baseline); Object.assign((value.scenes as Wire[])[0]!, patch); assert.throws(() => sceneRows(value));
  }
});
test('owned tail preserves all baseline names and requires unique owned markers', () => {
  verifyOwnedSceneTail(baseline, scenes(names), names);
  assert.throws(() => verifyOwnedSceneTail(baseline, scenes([names[0]!, names[0]!]), [names[0]!, names[0]!]));
  assert.throws(() => verifyOwnedSceneTail(baseline, scenes(['Scene 1']), ['Scene 1']));
  const changed = scenes(names); (changed.scenes as Wire[])[7]!.name = 'changed';
  assert.throws(() => verifyOwnedSceneTail(baseline, changed, names));
  assert.throws(() => verifyOwnedSceneTail(baseline, scenes([...names].reverse()), names));
});
test('final layout has one extra scene before the middle target and preserves marker order', () => {
  assert.equal(verifyNativeSceneInsertion(baseline, inserted, names).index, 9);
  for (const tail of [['Scene 9', ...names], [...names, 'Scene 12'], [names[0]!, names[1]!, 'Scene 11', names[2]!],
    [names[0]!, names[1]!, names[1]!, names[2]!], [names[0]!, 'Scene 10', names[2]!, names[1]!]])
    assert.throws(() => verifyNativeSceneInsertion(baseline, scenes(tail), names));
  const changed = structuredClone(inserted); (changed.scenes as Wire[])[0]!.name = 'changed';
  assert.throws(() => verifyNativeSceneInsertion(baseline, changed, names));
});
test('slot census permits only original clips and the isolated moved target', () => {
  const values = ['original', 'temporary'].flatMap(id => Array.from({ length: 12 }, (_, row) => ({ id, row, exists: true,
    hasContent: id === 'original' && row < 3 || id === 'temporary' && row === 10 })));
  verifySceneSlotLayout(values, ['original', 'temporary'], 'temporary', 10, 'original', 12);
  const moved = structuredClone(values); moved[22]!.hasContent = false; moved[21]!.hasContent = true;
  assert.throws(() => verifySceneSlotLayout(moved, ['original', 'temporary'], 'temporary', 10, 'original', 12));
  const extra = structuredClone(values); extra[11]!.hasContent = true;
  assert.throws(() => verifySceneSlotLayout(extra, ['original', 'temporary'], 'temporary', 10, 'original', 12));
  assert.throws(() => verifySceneSlotLayout(values.slice(1), ['original', 'temporary'], 'temporary', 10, 'original', 12));
  const duplicate = structuredClone(values); duplicate[23] = duplicate[22]!;
  assert.throws(() => verifySceneSlotLayout(duplicate, ['original', 'temporary'], 'temporary', 10, 'original', 12));
});
test('preflight rejects each unavailable method before fixture creation', () => {
  verifySceneMethods({ runtimeProfile: 'phase-8-probe-v1', methods: [...SCENE_METHODS] });
  for (const missing of SCENE_METHODS) assert.throws(() => verifySceneMethods({ runtimeProfile: 'phase-8-probe-v1', methods: SCENE_METHODS.filter(method => method !== missing) }));
});
const uuid = (index: number): string => `00000000-0000-0000-0000-${String(index).padStart(12, '0')}`;
function census(ids: number[]): Wire { return { count: ids.length, itemCount: ids.length, bankSize: 256,
  tracks: ids.map((id, index) => ({ index, position: index, name: `track-${id}`, type: 'Instrument', channelId: uuid(id) })) }; }
test('track ownership requires exactly one instrument after the original UUID', () => {
  const prior = census([1, 2]), now = census([1, 3, 2]); verifySceneTrackExtension(prior, now, uuid(1), uuid(3), 'track-3');
  assert.throws(() => verifySceneTrackExtension(prior, census([1, 2, 3]), uuid(1), uuid(3), 'track-3'));
  assert.throws(() => verifySceneTrackExtension(prior, census([1, 3, 4, 2]), uuid(1), uuid(3), 'track-3'));
  assert.throws(() => verifySceneTrackExtension(prior, now, uuid(1), uuid(3), 'renamed'));
  const changed = structuredClone(now); (changed.tracks as Wire[])[2]!.name = 'baseline changed';
  assert.throws(() => verifySceneTrackExtension(prior, changed, uuid(1), uuid(3), 'track-3'));
});

test('direct CLI requires a separate declaration; Add then Move has its own mode', () => {
  assert.throws(() => parseSceneFinishArguments('finish-insert', []));
  assert.throws(() => parseSceneFinishArguments('finish-insert', ['/tmp/scene.json']));
  assert.deepEqual(parseSceneFinishArguments('finish-insert', ['--direct-insertion-confirmed']),
    { output: UI_SCENE_OUTPUT, provenance: sceneActionProvenance('finish-insert') });
  assert.equal(parseSceneFinishArguments('finish-insert', ['/tmp/scene.json', '--direct-insertion-confirmed']).output, '/tmp/scene.json');
  assert.deepEqual(parseSceneFinishArguments('finish-add-move', ['/tmp/compound.json']),
    { output: '/tmp/compound.json', provenance: sceneActionProvenance('finish-add-move') });
  assert.throws(() => parseSceneFinishArguments('finish-add-move', ['--direct-insertion-confirmed']));
  assert.throws(() => parseSceneFinishArguments('finish-add-move', ['/tmp/one.json', '/tmp/two.json']));
});
function actionReport(compound: boolean): Wire {
  const before = { projectGeneration: 1, structuralEpoch: 1 };
  const info = { complete: false, eligible: false, projectGeneration: 1, structuralEpoch: 2 };
  const status = { complete: false, eligible: false };
  const read = { complete: false, eligible: false, readMode: 'refuse', phase: 'retired', authorityAvailable: false,
    fallbackPerformed: false, comparison: 'match' };
  const poll = { complete: false, eligible: false, comparison: 'window-changed', authorityAvailable: false };
  const fence = automaticStructureFence(before, info, status, read);
  return { actionProvenance: sceneActionProvenance(compound ? 'finish-add-move' : 'finish-insert'),
    caseLabels: [compound ? 'native-add-after-and-move-before-observed-target' : 'native-insert-before-observed-target'],
    actionCount: compound ? 2 : 1, singleInsertionProved: false, aggregateMutationFenceObserved: true, aggregateScanCancelled: true,
    automaticInsertionAcceptanceComplete: !compound, prepare: { info: before }, inserted: { info, status, read, poll,
      aggregateMutationFence: fence, ...(!compound ? { automaticFence: fence, staleComparisonCancelled: true } : {}) } };
}
test('compound endpoint and aggregate fence never prove direct insertion acceptance', () => {
  verifyNativeSceneInsertion(baseline, inserted, names);
  const report = actionReport(true), summary = verifySceneActionEvidence(report);
  assert.equal(summary.aggregateMutationFenceObserved, true); assert.equal(summary.aggregateScanCancelled, true);
  assert.equal(summary.automaticInsertionAcceptanceComplete, false); assert.equal(summary.singleInsertionProved, false);
  for (const patch of [{ automaticInsertionAcceptanceComplete: true }, { singleInsertionProved: true }, { actionCount: 1 },
    { caseLabels: ['native-insert-before-observed-target'] }, { actionProvenance: undefined }])
    assert.throws(() => verifySceneActionEvidence({ ...report, ...patch }));
  for (const patch of [{ actions: ['native-insert-before-observed-target'] }, { intermediateStatesObserved: true }, { singleInsertionDeclared: true }])
    assert.throws(() => verifySceneActionEvidence({ ...report, actionProvenance: { ...report.actionProvenance as Wire, ...patch } }));
  const attributed = structuredClone(report); (attributed.inserted as Wire).automaticFence = (attributed.inserted as Wire).aggregateMutationFence;
  assert.throws(() => verifySceneActionEvidence(attributed));
});
test('declared direct evidence needs measured current refusal and scan cancellation', () => {
  const report = actionReport(false); assert.equal(verifySceneActionEvidence(report).automaticInsertionAcceptanceComplete, true);
  const missing = structuredClone(report); delete missing.actionProvenance; assert.throws(() => verifySceneActionEvidence(missing));
  const retainedMatch = structuredClone(report); (retainedMatch.inserted as Wire).read = { complete: false, eligible: false, comparison: 'match' };
  assert.throws(() => verifySceneActionEvidence(retainedMatch));
  const active = structuredClone(report); (active.inserted as Wire).poll = { complete: false, eligible: false, comparison: 'pending' };
  assert.throws(() => verifySceneActionEvidence(active));
});
