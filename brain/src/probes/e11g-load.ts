import { client, point, ensureFixtureTracks, pollUntil } from './lib.js';
const req=(m:string,p:any={})=>client.request(m,p);
await client.connect();
const {trackA}=await ensureFixtureTracks(); await point('0',trackA,0,'trackThenSlot');
let dl:any=await req('device.list',{cursor:'0'});
for(let g=0;g<8&&dl.count>0;g++){await req('device.delete',{cursor:'0',deviceIndex:dl.devices[0].index});await pollUntil(async()=>((await req('device.list',{cursor:'0'}) as any).count<dl.count),4000);dl=await req('device.list',{cursor:'0'});}
const path=process.env.GN_FILE!;
await req('device.insertFile',{cursor:'0',path});
await pollUntil(async()=>((await req('device.list',{cursor:'0'}) as any).count>=1),12000);
await req('devcursor.selectAt',{deviceIndex:0}); await new Promise(r=>setTimeout(r,900));
const rl:any=await req('remote.list',{});
console.log('device:',rl.deviceName,' modulator pages:',JSON.stringify(rl.pageNames));
// divergence scan for live modulation (the LFO route)
const div:string[]=[];
for(let pg=0;pg<rl.pageNames.length;pg++){await req('remote.selectPage',{index:pg});await new Promise(r=>setTimeout(r,250));
  const mx=new Map<number,number>();
  for(let s=0;s<5;s++){const l:any=await req('remote.list',{});for(const rc of l.remotes){if(rc.exists&&rc.value!==undefined&&rc.modulatedValue!==undefined){const d=Math.abs(rc.modulatedValue-rc.value);if(!mx.has(rc.index)||d>mx.get(rc.index)!)mx.set(rc.index,d);}}await new Promise(r=>setTimeout(r,150));}
  for(const[idx,d]of mx)if(d>1e-3)div.push(`${rl.pageNames[pg]}#${idx}=${d.toFixed(3)}`);}
console.log('live modulation observed:',div.length?JSON.stringify(div):'none');
console.log('>>> DEVICE LEFT IN PLACE ON gn-A. Do NOT clear. <<<');
client.disconnect();process.exit(0);
