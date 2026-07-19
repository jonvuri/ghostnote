/** E6 diag4 (Bitwig foregrounded) — does focusing the clip-launcher PANEL via
 *  an action, then selecting + Duplicate, make the editing action fire? */
import { client, note, pollUntil, point, ensureFixtureTracks } from './lib.js';
const invoke = async (id: string) => (await client.request('app.invokeAction', { id })) as any;
const has = async (t: number, s: number) => ((await client.request('slot.status', { trackIndex: t, slotIndex: s })) as any).hasContent;
const sel = async () => (await client.request('selection.status')) as any;
await client.connect();
const { trackA } = await ensureFixtureTracks();
for (const s of [8,9]) if (await has(trackA,s)) { await client.request('slot.delete',{trackIndex:trackA,slotIndex:s}); await pollUntil(async()=>!(await has(trackA,s))); }
await client.request('clip.create',{trackIndex:trackA,slotIndex:8,lengthBeats:4}); await pollUntil(async()=>has(trackA,8));

// A: focus clip launcher panel (action), then select, then Duplicate
await invoke('focus_or_toggle_clip_launcher');
await new Promise(r=>setTimeout(r,400));
await client.request('slot.select',{trackIndex:trackA,slotIndex:8,mechanism:'slot'});
await pollUntil(async()=>(await sel()).slotIndex===8);
await invoke('Duplicate');
await new Promise(r=>setTimeout(r,1200));
note(`A: focus-panel + select + Duplicate -> A,9 = ${await has(trackA,9)}  ${await has(trackA,9)?'*** FIRED ***':'no effect'}`);
// toggle panel back
await invoke('focus_or_toggle_clip_launcher'); await new Promise(r=>setTimeout(r,300));

for (const s of [8,9]) if (await has(trackA,s)) { await client.request('slot.delete',{trackIndex:trackA,slotIndex:s}); await pollUntil(async()=>!(await has(trackA,s))); }
await point('0', trackA, 0, 'trackThenSlot');
await client.request('cursor.clearNotes',{cursor:'0'});
await client.request('cursor.setNotes',{cursor:'0',notes:[[0,60,100,1]]});
console.log('diag4 done'); client.disconnect(); process.exit(0);
