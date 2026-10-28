/** Archived diagnostic; executed from .tmp/b17-session7. Imports adjusted for this location. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { WireTransport } from '../../../../brain/src/probes/phase8h3c-promotion.ts';
import { LiveAdapter } from '../../../../brain/src/adapters/live/adapter.ts';
import { Executor } from '../../../../brain/src/engine/executor.ts';
import { IdentityRegistry } from '../../../../brain/src/bindings/identity-registry.ts';
import { FakeObservationStore } from '../../../../brain/src/observation/index.ts';
import { Stash } from '../../../../brain/src/stash/index.ts';
import { workspaceOf } from '../../../../brain/src/surface/workspace.ts';
import { callTool, AGENT_NATIVE_TOOL_PROFILE } from '../../../../brain/src/surface/tools.ts';
async function main() {
const t = new WireTransport(); const a = new LiveAdapter({transport:t});
const w=workspaceOf({ready:async()=>{},adapter:a,executor:new Executor(a),documents:new IdentityRegistry(),observationStore:new FakeObservationStore(),stash:new Stash()});
try {
 await a.hello();
 const out='../context/evidence/data/b17-integrated-live/';
 const baseline=JSON.parse(readFileSync(out+'attempt-1/002-baseline.json','utf8'));
 const data:any={};
 const save=()=>writeFileSync(out+'cleanup-1.json',JSON.stringify({data,calls:t.calls},null,2)+'\n');
 for(const method of ['revision.get','track.list','selection.status','rig.info']) data[method]=await t.send({method});
 assert.equal(data['revision.get'].project,'gn-scale-test');
 assert.equal(data['selection.status'].mixerChannelId,baseline.selected.mixerChannelId);
 assert(data['rig.info'].windowWriteBlock==null);
 const id='f11d8e43-b4af-4f63-b94a-11f635dfcd38';
 assert.equal(data['track.list'].tracks.find((r:any)=>r.channelId===id)?.name,'gn-b17w');
 data.clients=execFileSync('ps',['-axo','pid=,ppid=,command='],{encoding:'utf8'}).split('\n').filter(s=>/src\/probes\/|(?:^|\s|\/brain\/)(?:src|dist)\/(?:index|main|server)\.[jt]s(?:\s|$)/.test(s));
 assert.deepEqual(data.clients,[]);
 data.scratch=await callTool(w,'read_devices',{trackId:id},AGENT_NATIVE_TOOL_PROFILE) as any;
 assert.equal(data.scratch.coverage.status,'complete');
 assert.deepEqual(data.scratch.data.devices.map((r:any)=>r.name),[...Array(17).fill('Tool'),'FX Layer']);
 assert(data.scratch.data.devices[17].container.layerChains.every((c:any)=>c.devices.length===0));
 save();
 data.deletion=await callTool(w,'delete_track',{trackIds:[id]},AGENT_NATIVE_TOOL_PROFILE) as any;
 save(); assert.equal(data.deletion.failure,undefined);
 data.afterTracks=await t.send({method:'track.list'});
 assert.deepEqual(data.afterTracks.tracks,baseline.beforeTracks.tracks);
 data.preserved=[];
 for(const row of baseline.beforeTracks.tracks) {
  const got:any=await callTool(w,'read_devices',{trackId:row.channelId},AGENT_NATIVE_TOOL_PROFILE);
  const before=JSON.parse(readFileSync(out+`attempt-1/${String(3+row.index).padStart(3,'0')}-preserved-${row.index}.json`,'utf8'));
  assert.deepEqual(got.data,before.result.data);
  data.preserved.push({trackId:row.channelId,result:got});
 }
 data.afterSelection=await t.send({method:'selection.status'});
 for(const key of ['project','trackIndex','slotIndex','mixerTrackIndex','mixerChannelId']) assert.equal(data.afterSelection[key],baseline.selected[key]);
 data.passed=true; save(); console.log('Cleanup and preserved state: PASS');
} finally { await t.close(); }
}
main();
