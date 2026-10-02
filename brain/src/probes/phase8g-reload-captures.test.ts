import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { AUTHORITY_REVISION, verifyReloadCaptures } from './phase8g-reload-captures.js';
import { INVENTORY_REVISION } from './phase8g-inventory-controls.js';

type Wire = Record<string, unknown>;
const rootReport = JSON.parse(gunzipSync(await readFile(new URL('../../../context/evidence/data/phase8g-v5-acceptance/identity-fence-v5-distinct-root-return.json.gz', import.meta.url))).toString('utf8')) as Wire;
const prepare = rootReport.prepare as Wire;
const ids = ['1ca0534b-35e0-472b-897d-e3c73de82408', '74c8aee2-e313-48ec-aa3b-cdc2aea1b4cc',
  rootReport.ownedTrackId, '4843da50-35dd-4fd0-a508-659370945654', '9d2a7ac4-0fef-4926-b9e8-ee635d4052e4'];
function fixture() {
  const root = structuredClone(prepare.root) as Wire, info = structuredClone(prepare.shadow) as Wire;
  const started = Number(root.probeInitAtMs);
  const before: Wire = { root, info, captured: new Date(started + 120_000).toISOString(), stats: { runtimeProfile: 'phase-8-probe-v1', initEpochMs: started + 17 },
    scenes: { sceneCount: 8 }, tracks: { count: 5, itemCount: 5, bankSize: 256,
      tracks: ids.map((channelId, index) => ({ channelId, index, position: index,
        name: ['Inst 1', 'Audio 2', 'gn-8g-reuse', 'FX 1', 'Master'][index], type: ['Instrument', 'Audio', 'Instrument', 'Effect', 'Master'][index] })) } };
  const after = structuredClone(before); (after.root as Wire).extensionInitNonce = 'fresh-extension'; (after.root as Wire).probeInstanceNonce = 'fresh-probe';
  (after.root as Wire).probeInitAtMs = started + 180_000; (after.info as Wire).initDomain = 'fresh-core';
  (after.stats as Wire).initEpochMs = started + 180_017; after.captured = new Date(started + 240_000).toISOString();
  Object.assign(after.info as Wire, { authorityBindingRevision: AUTHORITY_REVISION, inventoryControlRevision: INVENTORY_REVISION, inventoryControlMaximumBatchCells: 64 });
  return { before, after };
}
test('reload pair proves a new instance and equal endpoint inputs without continuity claims', () => {
  const { before, after } = fixture(), result = verifyReloadCaptures(before, after);
  assert.equal(result.loadedInstanceNonceChanged, true); assert.equal(result.chainUUIDsEqual, true);
  for (const field of ['projectContinuityProved', 'identityContinuityProved', 'identityDetectionProved', 'hostInputFenceProved', 'wholeSessionComplete', 'eligible', 'complete']) assert.equal(result[field], false);
});
test('one capture or unchanged instance identifiers cannot prove a reload', () => {
  const pair = fixture(); assert.throws(() => verifyReloadCaptures(pair.before, undefined));
  assert.throws(() => verifyReloadCaptures(pair.before, pair.before));
  for (const field of ['extensionInitNonce', 'probeInstanceNonce']) {
    const { before, after } = fixture(); (after.root as Wire)[field] = (before.root as Wire)[field]; assert.throws(() => verifyReloadCaptures(before, after));
  }
  const { before, after } = fixture(); (after.info as Wire).initDomain = (before.info as Wire).initDomain; assert.throws(() => verifyReloadCaptures(before, after));
});
test('new nonces require new initialization times after the before capture', () => {
  for (const field of ['probeInitAtMs', 'initEpochMs']) {
    const { before, after } = fixture(), target = field === 'probeInitAtMs' ? 'root' : 'stats';
    (after[target] as Wire)[field] = (before[target] as Wire)[field]; assert.throws(() => verifyReloadCaptures(before, after));
  }
  const { before, after } = fixture(); (after.stats as Wire).initEpochMs = Date.parse(before.captured as string) - 1;
  assert.throws(() => verifyReloadCaptures(before, after), /follow the before capture/);
});
test('ordered census, scenes, root endpoint, and every chain UUID must stay equal', () => {
  for (const change of [
    (after: Wire) => { ((after.tracks as Wire).tracks as Wire[]).reverse(); },
    (after: Wire) => { ((after.tracks as Wire).tracks as Wire[])[0]!.channelId = '00000000-0000-0000-0000-000000000001'; },
    (after: Wire) => { (after.scenes as Wire).sceneCount = 9; },
    (after: Wire) => { (((after.root as Wire).current as Wire).projectName as Wire).value = 'other-project'; },
    (after: Wire) => { (((after.root as Wire).existingChainWitnesses as Wire).candidates as Wire[]).find(value => value.trackChannelId === rootReport.ownedTrackId)!.chainChannelId = 'other-chain'; },
  ]) { const { before, after } = fixture(); change(after); assert.throws(() => verifyReloadCaptures(before, after)); }
});
test('new revision markers and coherent read observations are required', () => {
  for (const field of ['authorityBindingRevision', 'inventoryControlRevision', 'inventoryControlMaximumBatchCells']) {
    const { before, after } = fixture(); delete (after.info as Wire)[field]; assert.throws(() => verifyReloadCaptures(before, after));
  }
  const { before, after } = fixture(); (after.root as Wire).callbacksChangedDuringRead = true; assert.throws(() => verifyReloadCaptures(before, after));
});
test('reload captures reject session completion, eligibility, and continuity claims', () => {
  for (const field of ['wholeSessionComplete', 'eligible', 'complete', 'projectContinuityProved', 'hostInputFenceProved']) {
    const { before, after } = fixture(); after[field] = true; assert.throws(() => verifyReloadCaptures(before, after));
  }
});
