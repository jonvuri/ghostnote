// R05 single foreground session. Run from brain/ with node --import tsx.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import { BridgeClient } from '../../../../../brain/src/client.ts';
import { BROWSER_MARKER, discoverBrowserNames } from './discovery-driver.ts';

import { compareDeployment, deployedAtMs } from '../../../../../brain/src/deploy.ts';

const [project, generation, output, mode] = process.argv.slice(2);
assert.ok(project && generation && output, 'project, generation, new output directory required');
assert.ok(mode === undefined || mode === 'plugins', 'unknown research condition');
mkdirSync(output); // Never overwrite an earlier attempt.
const c = new BridgeClient();
const started = performance.now();
const record = (label, value) => appendFileSync(join(output, 'events.jsonl'),
  JSON.stringify({ elapsedMs: performance.now() - started, label, value }) + '\n');
async function request(method, params = {}) {
  const result = await c.request(method, params);
  record(method, { params, result });
  return result;
}
async function projectGuard() {
  const revision = await request('revision.get');
  assert.equal(revision.project, project);
  assert.equal(revision.generation, generation);
  return revision;
}
async function mutate(method, params) {
  const r = await projectGuard();
  const result = await request('batch.run', { ifRevision: r.revision,
    expectedGeneration: generation, expectedProject: project, expectedSceneEpoch: r.sceneEpoch,
    verbose: true, ops: [{ method, params }] });
  assert.equal(result.applied, true);
  assert.equal(result.failures, 0, JSON.stringify(result));
}
async function tracks() {
  const state = await request('track.list');
  assert.equal(state.count, state.itemCount, 'track bank overflow');
  return state.tracks;
}
async function point(track) {
  await mutate('cursor.pointTrack', { cursor: '0', trackIndex: track.index });
  let previous;
  for (let i = 0; i < 15; i++) {
    await wait(100);
    const value = await request('device.list', { cursor: '0' });
    if (value.trackChannelId === track.channelId && JSON.stringify(value) === JSON.stringify(previous)) {
      assert.equal(value.count, value.itemCount, 'device bank overflow');
      return value;
    }
    previous = value;
  }
  throw new Error('cursor did not reach a stable owned track');
}
async function snapshot() {
  const rev = await projectGuard();
  const rows = await tracks();
  const mixer = await request('track.mixer', { tracks: rows.map(row => ({trackIndex:row.index, channelId:row.channelId})) });
  const slots = [], devices = [];
  for (const row of rows) {
    const chain = await point(row);
    devices.push(chain);
    for (let slotIndex = 0; slotIndex < rev.sceneCount; slotIndex++) {
      const slot = await request('slot.status', {trackIndex:row.index, slotIndex});
      slots.push({ channelId: row.channelId, slotIndex, exists: slot.exists, hasContent: slot.hasContent });
    }
  }
  const end = await projectGuard();
  assert.equal(end.contentEpoch, rev.contentEpoch, 'clip occupancy changed during snapshot');
  assert.equal(end.sceneEpoch, rev.sceneEpoch, 'scenes changed during snapshot');
  return { rows, mixer, slots, devices, sceneCount: rev.sceneCount };
}
let ownedId, entry, selection, ownedSelection, verdict, failure;
try {
  const hello = await request('contract.hello');
  assert.equal(hello.runtimeProfile, 'phase-8-probe-v1');
  assert.equal(hello.methodCount, 119);
  assert.equal(hello.methodsHash, '9e75b9a8b3938491');
  assert.equal(hello.hostApiVersion, 25);
  const stats = await request('rig.stats');
  assert.equal(compareDeployment(deployedAtMs(), stats.initEpochMs).state, 'fresh', 'probe build is not fresh');
  await projectGuard();
  selection = await request('selection.status');
  const transport = await request('cursor.playState', {cursor:'0'});
  assert.equal(transport.isPlaying, false, 'transport must be stopped');
  const browser = await request('probe.browserDiscovery', {operation:'status'});
  assert.equal(browser.marker, BROWSER_MARKER);
  assert.equal(browser.exists, false);
  assert.equal(browser.owned, false);
  entry = await snapshot();
  assert.deepEqual(await request('selection.status'), selection, 'inventory moved selection');
  assert.equal(entry.rows.some(row => row.name.startsWith('gn-r05-')), false, 'scratch residue exists');
  writeFileSync(join(output,'before.json'), JSON.stringify(entry,null,2)+'\n');
  const position = entry.rows.find(row => row.type === 'Effect')?.position ?? entry.rows.length - 1;
  await mutate('track.create', {position,kind:'instrument'});
  await wait(500);
  const afterCreate = await tracks();
  const added = afterCreate.filter(row => !entry.rows.some(old => old.channelId === row.channelId));
  assert.equal(added.length,1,'uncertain track creation; inspect before cleanup');
  ownedId = added[0].channelId;
  record('owned-track', {channelId:ownedId});
  assert.equal(afterCreate.length,entry.rows.length+1);
  await mutate('track.setName',{trackIndex:added[0].index,name:'gn-r05-browser'});
  await wait(250);
  const owned = (await tracks()).find(row=>row.channelId===ownedId);
  assert.equal(owned?.name,'gn-r05-browser');
  assert.equal((await point(owned)).count,0,'scratch chain is not empty');
  ownedSelection = await request('selection.status');
  verdict = await discoverBrowserNames({request:params=>request('probe.browserDiscovery',params),
    wait, record, resultLimit: 128, locationPageLimit: mode === 'plugins' ? 2 : 1,
    conditions: mode === 'plugins' ? [['System VST 3 Plug-ins', 'Addictive Drums 2'], ['System CLAP Plug-ins', 'Diva']] : undefined, target:{project,generation,trackId:ownedId}, token:randomUUID()});
  record('verdict',verdict);
} catch (error) {
  failure = String(error);
  record('failure',{error:failure});
} finally {
  try {
    if (ownedId) {
      await projectGuard();
      const browser = await request('probe.browserDiscovery',{operation:'status'});
      assert.equal(browser.exists,false,'inspect uncanceled browser before any more writes');
      assert.equal(browser.owned,false);
      const owned = (await tracks()).find(row=>row.channelId===ownedId);
      assert.ok(owned && owned.name === 'gn-r05-browser','scratch identity changed');
      assert.equal((await point(owned)).count,0,'scratch gained devices; inspect before deleting');
      const rev = await projectGuard();
      for(let slotIndex=0;slotIndex<rev.sceneCount;slotIndex++) {
        const slot=await request('slot.status',{trackIndex:owned.index,slotIndex});
        assert.equal(slot.hasContent,false,'scratch gained clips; inspect before deleting');
      }
      const beforeDeleteSelection = await request('selection.status');
      const restoreAllowed = ownedSelection && JSON.stringify(beforeDeleteSelection)===JSON.stringify(ownedSelection);
      await mutate('track.delete',{trackIndex:owned.index});
      await wait(500);
      assert.equal((await tracks()).some(row=>row.channelId===ownedId),false,'scratch deletion unconfirmed');
      const afterDeleteSelection = await request('selection.status');
      if (restoreAllowed && afterDeleteSelection.mixerChannelId !== selection.mixerChannelId) {
        const receipt = await request('selection.restoreMixer',{channelId:selection.mixerChannelId,
          expectedChannelId:afterDeleteSelection.mixerChannelId,expectedRevision:afterDeleteSelection.revision});
        assert.equal(receipt.restored,true);
        await wait(250);
      }
      const after = await snapshot();
      writeFileSync(join(output,'after.json'),JSON.stringify(after,null,2)+'\n');
      assert.deepEqual(after,entry,'preserved inventories differ');
      const entryCursor = entry.rows.find(row=>row.channelId===selection.mixerChannelId);
      if (entryCursor) await point(entryCursor);
      const finalSelection=await request('selection.status');
      if (restoreAllowed) assert.equal(finalSelection.mixerChannelId,selection.mixerChannelId);
      const play=await request('cursor.playState',{cursor:'0'});
      assert.equal(play.isPlaying,false);
      record('cleanup',{scratchRemoved:true,inventoriesEqual:true,restoreAllowed,finalSelection});
    }
  } catch(error) {
    record('cleanup-failure',{error:String(error)});
    failure = `${failure ?? ''} cleanup: ${error}`;
  }
  c.disconnect();
}
writeFileSync(join(output,'result.json'),JSON.stringify({project,generation,ownedId,verdict,failure},null,2)+'\n');
console.log(JSON.stringify({project,ownedId,verdict,failure}));
if(failure) process.exitCode=1;
