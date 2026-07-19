/** E6 diag2 — is invoke() inert for ALL actions, or only focus-dependent ones?
 *  Contrasts: action "Undo" vs typed app.undo (identical state); action
 *  "Create Scene" (global, observable via scene.count) vs typed scene.create. */
import { client, note, pollUntil, ensureFixtureTracks } from './lib.js';
const invoke = async (id: string) => (await client.request('app.invokeAction', { id })) as any;
const has = async (t: number, s: number) => ((await client.request('slot.status', { trackIndex: t, slotIndex: s })) as any).hasContent;
const sceneCount = async () => ((await client.request('scene.count')) as any).sceneCount;
await client.connect();
const { trackA } = await ensureFixtureTracks();

console.log('== resolution check ==');
const r = await invoke('Undo');
note(`invoke("Undo") returned: ${JSON.stringify(r)}`);

console.log('\n== Undo: action vs typed, identical state ==');
for (const s of [8]) if (await has(trackA,s)) { await client.request('slot.delete',{trackIndex:trackA,slotIndex:s}); await pollUntil(async()=>!(await has(trackA,s))); }
await client.request('clip.create',{trackIndex:trackA,slotIndex:8,lengthBeats:4}); await pollUntil(async()=>has(trackA,8));
note(`clip at A,8 present: ${await has(trackA,8)}`);
await invoke('Undo');
await new Promise(res=>setTimeout(res,1200));
note(`after ACTION "Undo": A,8 present = ${await has(trackA,8)}`);
await client.request('app.undo',{times:1});
await new Promise(res=>setTimeout(res,1200));
note(`after TYPED app.undo: A,8 present = ${await has(trackA,8)}`);
if (await has(trackA,8)) { await client.request('slot.delete',{trackIndex:trackA,slotIndex:8}); await pollUntil(async()=>!(await has(trackA,8))); }

console.log('\n== Create Scene: action vs typed, observable via scene.count ==');
const c0 = await sceneCount();
note(`scenes before: ${c0}`);
await invoke('Create Scene');
await new Promise(res=>setTimeout(res,1200));
const c1 = await sceneCount();
note(`after ACTION "Create Scene": ${c1}  (${c1>c0?'FIRED':'no effect'})`);
await client.request('scene.create',{count:1});
await new Promise(res=>setTimeout(res,1200));
const c2 = await sceneCount();
note(`after TYPED scene.create: ${c2}  (${c2>c1?'worked':'no effect'})`);
// teardown any scenes we added (delete from the end)
for (let i=c2; i>c0; i--) { await client.request('scene.delete',{sceneIndex:i-1}); await new Promise(res=>setTimeout(res,200)); }
note(`scenes restored to: ${await sceneCount()}`);

console.log('\ndiag2 done');
client.disconnect(); process.exit(0);
