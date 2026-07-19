/** E6 diag3 — the foreground-focus hypothesis. Run with Bitwig as the ACTIVE
 *  OS window. If actions fire now but not when backgrounded, the escape hatch
 *  is fundamentally incompatible with a background/headless agent. */
import { client, note, pollUntil, point, ensureFixtureTracks } from './lib.js';
const invoke = async (id: string) => (await client.request('app.invokeAction', { id })) as any;
const has = async (t: number, s: number) => ((await client.request('slot.status', { trackIndex: t, slotIndex: s })) as any).hasContent;
const sceneCount = async () => ((await client.request('scene.count')) as any).sceneCount;
const sel = async () => (await client.request('selection.status')) as any;
await client.connect();
const { trackA } = await ensureFixtureTracks();
console.log('=== ACTIONS WITH BITWIG FOREGROUNDED ===\n');

// 1. Create Scene (global, observable)
const c0 = await sceneCount();
await invoke('Create Scene');
await new Promise(r=>setTimeout(r,1200));
const c1 = await sceneCount();
note(`Create Scene: ${c0} -> ${c1}  ==> ${c1>c0?'*** FIRED ***':'no effect'}`);
for (let i=c1; i>c0; i--) { await client.request('scene.delete',{sceneIndex:i-1}); await new Promise(r=>setTimeout(r,200)); }

// 2. Duplicate on a selected clip
for (const s of [8,9]) if (await has(trackA,s)) { await client.request('slot.delete',{trackIndex:trackA,slotIndex:s}); await pollUntil(async()=>!(await has(trackA,s))); }
await client.request('clip.create',{trackIndex:trackA,slotIndex:8,lengthBeats:4}); await pollUntil(async()=>has(trackA,8));
await client.request('slot.select',{trackIndex:trackA,slotIndex:8,mechanism:'slot'});
await pollUntil(async()=>(await sel()).trackIndex===trackA && (await sel()).slotIndex===8);
await invoke('Duplicate');
await new Promise(r=>setTimeout(r,1200));
const dup = await has(trackA,9);
note(`Duplicate (A,8 selected): content at A,9 = ${dup}  ==> ${dup?'*** FIRED ***':'no effect'}`);
for (const s of [8,9]) if (await has(trackA,s)) { await client.request('slot.delete',{trackIndex:trackA,slotIndex:s}); await pollUntil(async()=>!(await has(trackA,s))); }

await point('0', trackA, 0, 'trackThenSlot');
await client.request('cursor.clearNotes',{cursor:'0'});
await client.request('cursor.setNotes',{cursor:'0',notes:[[0,60,100,1]]});
console.log('\ndiag3 done');
client.disconnect(); process.exit(0);
