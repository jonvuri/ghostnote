/** E6 diag7 — what does invoke('Duplicate') actually duplicate? Track count +
 *  types before/after. (Bitwig FOREGROUNDED.) */
import { client, note, point, pollUntil, ensureFixtureTracks } from './lib.js';
const list = async () => (await client.request('track.list')) as any;
const has = async (t: number, s: number) => ((await client.request('slot.status', { trackIndex: t, slotIndex: s })) as any).hasContent;
await client.connect();
const { trackA } = await ensureFixtureTracks();
if (!(await has(trackA,8))) { await client.request('clip.create',{trackIndex:trackA,slotIndex:8,lengthBeats:4}); await pollUntil(async()=>has(trackA,8)); }
const before = await list();
note(`before: ${before.count} tracks — types [${before.tracks.map((t:any)=>t.type).join(',')}]`);
const beforeIds = new Set(before.tracks.map((t:any)=>t.channelId));
// point a pool cursor at trackA (this selectChannel's trackA in the UI), pin
await point('1', trackA, 8, 'trackThenSlot');
await client.request('cursor.pin',{cursor:'1',pinned:true});
await new Promise(r=>setTimeout(r,300));
await client.request('app.invokeAction',{id:'Duplicate'});
await new Promise(r=>setTimeout(r,1200));
const after = await list();
note(`after Duplicate: ${after.count} tracks — types [${after.tracks.map((t:any)=>t.type).join(',')}]`);
const added = after.tracks.filter((t:any)=>!beforeIds.has(t.channelId));
note(`NEW tracks: ${added.map((t:any)=>`idx${t.index}:${t.type}:"${t.name}"`).join(', ') || 'none'}`);
// teardown: delete any added tracks by channelId
await client.request('cursor.pin',{cursor:'1',pinned:false});
for (const t of added) {
  const r = (await client.request('track.resolveByChannelId',{channelId:t.channelId})) as any;
  if (r.found) { await client.request('track.delete',{trackIndex:r.index}); await pollUntil(async()=>!((await client.request('track.resolveByChannelId',{channelId:t.channelId})) as any).found); }
}
if (await has(trackA,8)) { await client.request('slot.delete',{trackIndex:trackA,slotIndex:8}); await pollUntil(async()=>!(await has(trackA,8))); }
const fin = await list();
note(`teardown: back to ${fin.count} tracks (started ${before.count})`);
console.log('diag7 done'); client.disconnect(); process.exit(0);
