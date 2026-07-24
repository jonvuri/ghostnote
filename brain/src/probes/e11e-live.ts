import { client, point, ensureFixtureTracks, pollUntil } from './lib.js';
const req = (m:string,p:any={})=>client.request(m,p);
await client.connect();
const { trackA } = await ensureFixtureTracks();
await point('0', trackA, 0, 'trackThenSlot');
// clear devices
let dl:any = await req('device.list',{cursor:'0'});
for(let g=0;g<8 && dl.count>0;g++){ await req('device.delete',{cursor:'0',deviceIndex:dl.devices[0].index}); await pollUntil(async()=>((await req('device.list',{cursor:'0'}) as any).count<dl.count),4000); dl=await req('device.list',{cursor:'0'}); }
const path = process.env.GN_FILE!;
await req('device.insertFile',{cursor:'0',path});
await pollUntil(async()=>((await req('device.list',{cursor:'0'}) as any).count>=1),12000);
await req('devcursor.selectAt',{deviceIndex:0});
await new Promise(r=>setTimeout(r,700));
console.log('nesting:', JSON.stringify(await req('device.nesting',{}).catch(e=>({err:String(e)}))));
// try to descend: selectFirstInSlot / selectInChannel, then read remote params of the nested device
for (const attempt of [
   ()=>req('devcursor.selectFirstInSlot',{slot:'CHAIN'}),
]) {
  try { await attempt(); } catch(e){ /* ignore */ }
  await new Promise(r=>setTimeout(r,500));
  const rl:any = await req('remote.list',{});
  console.log('  after descend attempt -> device=',rl.deviceName,'pages=',JSON.stringify(rl.pageNames));
}
// scan pages of whatever device we're on for divergence (modulatedValue != value)
async function scan(){
  const rl:any = await req('remote.list',{});
  for(let pg=0; pg<rl.pageNames.length; pg++){
    await req('remote.selectPage',{index:pg}); await new Promise(r=>setTimeout(r,250));
    for(let s=0;s<5;s++){ const l:any=await req('remote.list',{});
      for(const rc of l.remotes){ if(rc.exists&&rc.value!==undefined&&rc.modulatedValue!==undefined){ const d=Math.abs(rc.modulatedValue-rc.value); if(d>1e-3) console.log(`   DIVERGENCE ${rl.pageNames[pg]}/${rc.name}=${d.toFixed(3)} (dev=${l.deviceName})`);} }
      await new Promise(r=>setTimeout(r,150)); }
  }
}
console.log('nested device.list:', JSON.stringify(await req('device.list',{cursor:'0'}).catch(e=>({err:String(e)}))));
await scan();
console.log('done');
client.disconnect(); process.exit(0);
