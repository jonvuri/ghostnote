/** E6 diag6 — what disturbs a pinned pool cursor: invoke() in general, or
 *  Duplicate specifically? (Bitwig FOREGROUNDED for this run.) */
import { client, note, point, cursorStatus, pollUntil, ensureFixtureTracks } from './lib.js';
const has = async (t: number, s: number) => ((await client.request('slot.status', { trackIndex: t, slotIndex: s })) as any).hasContent;
const st = async () => { const s = await cursorStatus('1'); return `pos=${s.trackPosition} scene=${s.sceneIndex} pinned=${s.isPinned}`; };
const repin = async (t: number) => { await point('1', t, 8, 'trackThenSlot'); await client.request('cursor.pin',{cursor:'1',pinned:true}); await new Promise(r=>setTimeout(r,300)); };
await client.connect();
const { trackA, trackB } = await ensureFixtureTracks();
if (!(await has(trackA,8))) { await client.request('clip.create',{trackIndex:trackA,slotIndex:8,lengthBeats:4}); await pollUntil(async()=>has(trackA,8)); }
note(`trackA=${trackA} trackB=${trackB}`);

// 1. harmless global action (zoom) — no selection, no data
await repin(trackA);
note(`pinned:                       ${await st()}`);
await client.request('app.invokeAction',{id:'detail_editor_zoom_in'});
await new Promise(r=>setTimeout(r,400));
note(`after invoke zoom_in:         ${await st()}   <-- does a harmless invoke disturb it?`);

// 2. Duplicate with NOTHING selected by us (don't call slot.select)
await repin(trackA);
await client.request('app.invokeAction',{id:'Duplicate'});
await new Promise(r=>setTimeout(r,400));
note(`after invoke Duplicate (no sel):  ${await st()}`);

// 3. Duplicate WITH (B,0) selected
await repin(trackA);
await client.request('slot.select',{trackIndex:trackB,slotIndex:0,mechanism:'slot'});
await new Promise(r=>setTimeout(r,300));
note(`after slot.select(B,0):       ${await st()}`);
await client.request('app.invokeAction',{id:'Duplicate'});
await new Promise(r=>setTimeout(r,400));
note(`after invoke Duplicate (B sel):   ${await st()}`);

await client.request('cursor.pin',{cursor:'1',pinned:false});
for (let s=1;s<=2;s++) if (await has(trackB,s)) { await client.request('slot.delete',{trackIndex:trackB,slotIndex:s}); await pollUntil(async()=>!(await has(trackB,s))); break; }
if (await has(trackA,8)) { await client.request('slot.delete',{trackIndex:trackA,slotIndex:8}); await pollUntil(async()=>!(await has(trackA,8))); }
console.log('diag6 done'); client.disconnect(); process.exit(0);
