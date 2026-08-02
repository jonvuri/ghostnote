/**
 * E17 row 4 — does the typed DELETE also just need a SELECTION?
 *
 * ⚠⚠ `e17ak` settled CREATE: `Channel.duplicate()` needs the chain SELECTED, and
 * `layer.select` is ours — typed, no focus, no human. Chain creation is autonomous.
 *
 * ⚠ Every typed-delete measurement ever taken (`e17f`, `e17q`, `e17aj`) scoped the
 * DEVICE cursor to the container and never selected a CHAIN. That is exactly the
 * missing precondition that made CREATE look impossible for the whole spike.
 *
 *   A  no selection                → expect ○ (the historical result, reproduced)
 *   B  ⚠ layer.select then delete  → THE QUESTION
 *   C  ⚠ layer.select then deleteViaHost — the independent mechanism
 *
 * ⚠ Name the survivor, never count it: the two chains are made distinguishable so a
 * count of 1 cannot hide the WRONG one having gone.
 * Typed-only. No named actions, no focus, no human.
 */
import { client, check, note, failureCount, pollUntil } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);
const SCRATCH = 'gn-B';
const FX_LAYER = 'a0913b7f-096b-4ac9-bddd-33c775314b42';
const POLYSYNTH = 'a9ffacb5-33e9-4fc7-8621-b1af31e410ef';
const ORGAN = 'f2dcfe9a-7b66-4c84-984a-b25685a1c21a';

interface TrackRow { index: number; name: string; type: string; channelId: string }
interface DevList { devices: { index: number; name: string }[]; count: number; itemCount: number }
interface LayerList { layers: { index: number; name: string; devices: { name: string }[] }[]; count: number }
interface SelState { editorObserver: string; layers: { index: number; selectedInEditor: boolean }[] }

await client.connect();
const tracks0 = ((await req('track.list')) as { tracks: TrackRow[] }).tracks;
const mm = tracks0.filter((t) => t.name === SCRATCH);
if (mm.length !== 1) { console.log('REFUSING: ambiguous scratch track.'); process.exit(1); }
const scratch = mm[0]!;
const baseIds = tracks0.map((t) => t.channelId).sort().join(',');

async function pointScratch(): Promise<void> {
  const now = ((await req('track.list')) as { tracks: TrackRow[] }).tracks;
  const t = now.find((x) => x.channelId === scratch.channelId)!;
  await req('cursor.pointTrack', { cursor: '0', trackIndex: t.index });
  await pollUntil(async () => {
    const s = (await req('cursor.status', { cursor: '0' })) as { trackPosition: number };
    return s.trackPosition === t.index;
  }, 4000, 150);
  await new Promise((r) => setTimeout(r, 250));
}
async function devs(): Promise<DevList> {
  let last = ''; let out: DevList = { devices: [], count: 0, itemCount: 0 };
  await pollUntil(async () => {
    out = (await req('device.list', { cursor: '0' })) as DevList;
    const n = out.devices.map((d) => d.name).join(','); const s = n === last; last = n; return s;
  }, 4000, 200);
  return out;
}
async function scope(tag: string): Promise<void> {
  const d = await devs();
  const at = d.devices.findIndex((x) => /FX Layer/.test(x.name));
  if (at < 0) { console.log(`ABORT ${tag}: no FX Layer`); process.exit(1); }
  await req('devcursor.selectAt', { deviceIndex: at });
  const ok = await pollUntil(async () => {
    const s = (await req('devcursor.status')) as { exists: boolean; name: string };
    return s.exists && /FX Layer/.test(s.name);
  }, 6000, 150);
  if (!ok.ok) { console.log(`ABORT ${tag}: cursor`); process.exit(1); }
}
async function chains(tag: string): Promise<string[]> {
  await pointScratch(); await scope(tag);
  const l = (await req('layer.list')) as LayerList;
  return l.layers.map((x) => x.devices.map((y) => y.name).join('+') || '—');
}
const selState = async () => (await req('layer.selectionState')) as SelState;

async function clearScratch(): Promise<void> {
  await pointScratch();
  for (let g = 0; g < 14; g++) {
    const d = await devs(); if (d.count === 0) break;
    await req('device.delete', { cursor: '0', deviceIndex: d.devices[0]!.index });
    await pollUntil(async () => (await devs()).count < d.count, 4000, 200);
  }
}

/** Two DISTINGUISHABLE chains: [Polysynth] and [Organ], built with the e17ak recipe. */
async function fixture(): Promise<void> {
  await clearScratch();
  await req('device.insertBitwig', { cursor: '0', uuid: FX_LAYER });
  await pollUntil(async () => (await devs()).devices.some((d) => /FX Layer/.test(d.name)), 8000, 200);
  await scope('fx'); await req('layer.insertDevice', { layerIndex: 0, uuid: POLYSYNTH });
  await pollUntil(async () => { await scope('fp'); return (await chains('fp'))[0] !== '—'; }, 8000, 250);
  await scope('dup'); await req('layer.select', { layerIndex: 0, where: 'editor' });
  await new Promise((r) => setTimeout(r, 400));
  await req('layer.duplicateChannel', { layerIndex: 0 });
  await pollUntil(async () => (await chains('dp')).length >= 2, 6000, 250);
  // Make chain 1 distinguishable so a survivor can be NAMED.
  await scope('org'); await req('layer.insertDevice', { layerIndex: 1, uuid: ORGAN });
  await pollUntil(async () => (await chains('op'))[1]?.includes('Organ') === true, 8000, 250);
}

interface Arm { label: string; removed: boolean; survivors: string[]; flag: string; threw: string | null }
const arms: Arm[] = [];
async function arm(label: string, select: boolean, method: string): Promise<Arm> {
  await fixture();
  const before = await chains(`${label} before`);
  console.log(`\n  ${label}`);
  note(`   BEFORE chains=${before.length} [${before.join(' ')}]`);
  await scope(`${label} pre`);
  if (select) { await req('layer.select', { layerIndex: 1, where: 'editor' }); await new Promise((r) => setTimeout(r, 400)); }
  await scope(`${label} call`);
  const s = await selState();
  const fi = s.layers.findIndex((r) => r.selectedInEditor);
  const flag = fi >= 0 ? `chain ${fi}` : 'none';
  note(`   selection flag: ${flag}   (targeting chain 1, the Organ)`);
  let threw: string | null = null;
  try { await req(method, { layerIndex: 1 }); } catch (e) {
    threw = e instanceof Error ? e.message : String(e); note(`   ⚠ THREW: ${threw}`);
  }
  await pollUntil(async () => (await chains(`${label} poll`)).length !== before.length, 4000, 300);
  const after = await chains(`${label} after`);
  note(`   AFTER  chains=${after.length} [${after.join(' ')}]`);
  const removed = after.length < before.length;
  console.log(`   ⇒ ${removed ? `●● REMOVED — survivors [${after.join(' ')}]` : '○ nothing'}`);
  const a = { label, removed, survivors: after, flag, threw };
  arms.push(a); return a;
}

console.log('\n' + '='.repeat(74));
console.log(' ⚠ Row 4 — does the typed DELETE just need a SELECTION too?');
console.log('='.repeat(74));
const A = await arm('ARM A — no selection, layer.delete (the historical recipe)', false, 'layer.delete');
const B = await arm('⚠⚠ ARM B — layer.select then layer.delete', true, 'layer.delete');
const C = await arm('⚠ ARM C — layer.select then layer.deleteViaHost', true, 'layer.deleteViaHost');

await clearScratch();
const endTracks = ((await req('track.list')) as { tracks: TrackRow[] }).tracks;
check(`${SCRATCH} is empty`, (await devs()).count === 0, {});
check('the TRACK LIST is untouched', endTracks.map((t) => t.channelId).sort().join(',') === baseIds, {});

console.log('\n' + '='.repeat(74));
for (const a of arms) console.log(`  ${a.removed ? '●●' : '○ '} ${a.label.padEnd(56)} flag=${a.flag}`);
console.log('='.repeat(74) + '\n');
check('⚠ ARM A reproduces the historical ○ — no selection, no delete', !A.removed, {});
if (B.removed || C.removed) {
  const winner = B.removed ? B : C;
  check('⚠ and the RIGHT chain went — the Organ, named not counted',
    !winner.survivors.some((x) => x.includes('Organ')), { survivors: winner.survivors });
  note('⚠⚠⚠ DESTROY IS AUTONOMOUS TOO. The typed deletes were never refusing — they were');
  note('  missing the same selection precondition that hid CREATE for the whole spike.');
  note('  ⇒ THE COMPLETE BRANCH LIFECYCLE IS TYPED AND AUTONOMOUS: layer.select +');
  note('  duplicateChannel to create, layer.select + delete to destroy. No named actions,');
  note('  no focus, no human click. ⇒ E17 must be re-argued from the ground up.');
} else {
  note('⚠ CREATE is autonomous but DESTROY is not: the typed deletes refuse even with the');
  note('  selection satisfied. ⇒ Branches can be minted programmatically and removed only');
  note('  by a named action (human-focused) or `app.undo`. Record the asymmetry exactly.');
}
console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} checks reported a negative`);
process.exit(0);
