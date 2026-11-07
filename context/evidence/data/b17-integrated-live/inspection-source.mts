/** Archived diagnostic; executed from .tmp/b17-session7. Imports adjusted for this location. */
import { writeFileSync } from 'node:fs';
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
 const data:any={};
 for(const method of ['contract.hello','revision.get','track.list','selection.status','rig.info']) data[method]=await t.send({method});
 data.scratch=await callTool(w,'read_devices',{trackId:'d5082b46-5af5-4672-81ba-3b14f59a42bb'},AGENT_NATIVE_TOOL_PROFILE);
 writeFileSync('../context/evidence/data/b17-integrated-live/inspection-3.json',JSON.stringify({data,calls:t.calls},null,2)+'\n');
 console.log(JSON.stringify({project:data['revision.get'].project,selection:data['selection.status'],scratch:data.scratch},null,2));
} finally { await t.close(); }
}
main();
