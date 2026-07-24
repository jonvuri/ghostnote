import { client, point, ensureFixtureTracks } from './lib.js';
const req=(m:string,p:any={})=>client.request(m,p);
// bridge may still be coming up after Bitwig relaunch — retry connect
let connected=false;
for(let i=0;i<30 && !connected;i++){ try{ await client.connect(); connected=true; }catch{ await new Promise(r=>setTimeout(r,2000)); } }
if(!connected){ console.log('bridge not reachable — is Bitwig up with the project open?'); process.exit(2); }
const {trackA}=await ensureFixtureTracks(); await point('0',trackA,0,'trackThenSlot');
await new Promise(r=>setTimeout(r,600));
const dl:any=await req('device.list',{cursor:'0'});
console.log('gn-A devices after reload:',dl.count, JSON.stringify(dl.devices?.map((d:any)=>d.name)));
if(dl.count>=1){
  await req('devcursor.selectAt',{deviceIndex:0}); await new Promise(r=>setTimeout(r,900));
  const rl:any=await req('remote.list',{});
  const pages:string[]=rl.pageNames;
  const hasLFO=pages.includes('LFO'), hasRand=pages.includes('Random');
  console.log('device:',rl.deviceName,' pages:',JSON.stringify(pages));
  console.log(`SURVIVED?  LFO=${hasLFO}  Random=${hasRand}  =>`, (hasLFO&&hasRand)?'YES ✅ surgical [LFO,Random] persisted':'NO ❌');
}else{
  console.log('no device on gn-A — did the project save with the device, and reopen the same project?');
}
client.disconnect();process.exit(0);
