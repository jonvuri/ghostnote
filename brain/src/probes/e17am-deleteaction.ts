/**
 * E17 row 4 — `deleteObjectAction().invoke()`, the last untried typed route.
 *
 * ⚠⚠ **Why the prior is better than "we already measured delete".** A type sweep
 * shows the two receivers are SIBLINGS:
 *
 *     Channel extends DeviceChain, DeleteableObject, DuplicableObject
 *        ↑                              ↑
 *     Track                        DeviceLayer   ← `interface DeviceLayer
 *     + isGroup, position, …                        extends Channel {}` — EMPTY
 *
 * `track.delete` calls `Track.deleteObject()` and works every time; the SAME
 * inherited method refuses on a `DeviceLayer`. And `Channel` declares its own
 * bespoke `duplicate()` but **no delete at all**.
 *
 * ⚠ **The duplicate case already proved which sibling method you call decides it:**
 *     DuplicableObject.duplicateObject()  ○ dead on a layer
 *     Channel.duplicate()                 ● creates a chain (with a selection)
 * So `deleteObject()` refusing says NOTHING about `deleteObjectAction()`.
 *
 * ⚠ **`e17ak`'s lesson is applied throughout**: creation needed the chain SELECTED,
 * and every earlier delete probe scoped the DEVICE cursor and never selected a
 * CHAIN. Every arm here is run BOTH ways, so a selection-dependence cannot hide.
 *
 * **Arms** (fixture rebuilt each time, two DISTINGUISHABLE chains so a survivor is NAMED):
 *   1  deleteObjectAction()   no selection
 *   2  ⚠ deleteObjectAction() WITH the chain selected      ← THE QUESTION
 *   3  duplicateObjectAction() with the chain selected      — does the *Action* form
 *      work for the verb we KNOW has a working sibling?
 *   4  ⚠ TRACK CONTROL: deleteObjectAction() on a scratch TRACK
 *
 * ⚠ Arm 4 is what makes a ○ interpretable. Identical inherited call, identical form,
 * only the receiver differs. Without it, "the layer declined" and "the `*Action()`
 * form is dead everywhere" are the same observation — the mistake that let a dozen
 * E17 negatives stand.
 *
 * ⚠ It DELETES A TRACK: a disposable one this probe creates by duplicating `gn-B`,
 * verified by channelId, never a fixture. Full inventory before and after.
 *
 * Typed-only: no named actions, no focus, no priming, no foreground, no human.
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
const t0 = ((await req('track.list')) as { tracks: TrackRow[] }).tracks;
const mm = t0.filter((t) => t.name === SCRATCH);
if (mm.length !== 1) { console.log(`REFUSING: ${mm.length} tracks named ${SCRATCH}.`); process.exit(1); }
const scratch = mm[0]!;
const baseIds = new Set(t0.map((t) => t.channelId));

async function tracks(): Promise<TrackRow[]> {
  return ((await req('track.list')) as { tracks: TrackRow[] }).tracks;
}
async function pointScratch(): Promise<void> {
  const t = (await tracks()).find((x) => x.channelId === scratch.channelId);
  if (!t) { console.log('⚠⚠ ABORTING: scratch track gone.'); process.exit(1); }
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
  if (at < 0) { console.log(`⚠⚠ ABORT ${tag}: no FX Layer.`); process.exit(1); }
  await req('devcursor.selectAt', { deviceIndex: at });
  const ok = await pollUntil(async () => {
    const s = (await req('devcursor.status')) as { exists: boolean; name: string };
    return s.exists && /FX Layer/.test(s.name);
  }, 6000, 150);
  if (!ok.ok) { console.log(`⚠⚠ ABORT ${tag}: cursor.`); process.exit(1); }
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
/** Two DISTINGUISHABLE chains via the e17ak recipe: [Polysynth] and [Polysynth+Organ]. */
async function fixture(): Promise<void> {
  await clearScratch();
  await req('device.insertBitwig', { cursor: '0', uuid: FX_LAYER });
  await pollUntil(async () => (await devs()).devices.some((d) => /FX Layer/.test(d.name)), 8000, 200);
  await scope('fx'); await req('layer.insertDevice', { layerIndex: 0, uuid: POLYSYNTH });
  await pollUntil(async () => (await chains('f1'))[0] !== '—', 8000, 250);
  await scope('dup'); await req('layer.select', { layerIndex: 0, where: 'editor' });
  await new Promise((r) => setTimeout(r, 400));
  await req('layer.duplicateChannel', { layerIndex: 0 });
  await pollUntil(async () => (await chains('f2')).length >= 2, 6000, 250);
  await scope('org'); await req('layer.insertDevice', { layerIndex: 1, uuid: ORGAN });
  await pollUntil(async () => (await chains('f3'))[1]?.includes('Organ') === true, 8000, 250);
}

interface Arm { label: string; changed: boolean; survivors: string[]; flag: string; result: string }
const arms: Arm[] = [];
async function layerArm(label: string, method: string, select: boolean): Promise<Arm> {
  await fixture();
  const before = await chains(`${label} b`);
  console.log(`\n  ${label}`);
  note(`   BEFORE chains=${before.length} [${before.join(' ')}]   target = chain 1 (the Organ)`);
  await scope(`${label} pre`);
  if (select) { await req('layer.select', { layerIndex: 1, where: 'editor' }); await new Promise((r) => setTimeout(r, 400)); }
  await scope(`${label} call`);
  const s = await selState();
  const fi = s.layers.findIndex((r) => r.selectedInEditor);
  const flag = fi >= 0 ? `chain ${fi}` : 'none';
  let result = 'returned'; let handle = '?';
  try {
    const r = await req(method, { layerIndex: 1 }) as { actionInvoke?: string; handleStatus?: string };
    result = r.actionInvoke ?? 'returned';
    handle = r.handleStatus ?? '?';
  } catch (e) { result = `WIRE-THREW: ${e instanceof Error ? e.message : String(e)}`; }
  // ⚠ `handleStatus` is the guard against repeating the first attempt, where every
  // arm threw "This can only be called during driver initialization" — rule 13 —
  // and three false ○s were produced by a handle that never existed.
  note(`   selection flag: ${flag}   handle=${handle}   invoke -> ${result}`);
  if (!handle.startsWith('held:')) {
    console.log(`\n⚠⚠ ABORTING: the init-time handle was not obtained (${handle}).`);
    console.log('  Every arm would be a false ○. Did the extension actually reload?');
    process.exit(1);
  }
  await pollUntil(async () => (await chains(`${label} p`)).length !== before.length, 4000, 300);
  const after = await chains(`${label} a`);
  note(`   AFTER  chains=${after.length} [${after.join(' ')}]`);
  const changed = after.length !== before.length;
  console.log(`   ⇒ ${after.length < before.length ? `●● REMOVED — survivors [${after.join(' ')}]`
    : after.length > before.length ? `●● CREATED — [${after.join(' ')}]` : '○ nothing'}`);
  const a = { label, changed, survivors: after, flag, result };
  arms.push(a); return a;
}

console.log('\n' + '='.repeat(74));
console.log(' ⚠ Row 4 — the `*Action()` routes, never called before');
console.log('='.repeat(74));
const boot = await selState();
check('PRECONDITION: the selection reader is attached',
  String(boot.editorObserver).startsWith('observing:'), { status: boot.editorObserver });

const boot2 = await req('layer.selectionState') as { editorObserver: string };
note(`⚠ handles held at init — see handleStatus on each arm below`);
const A1 = await layerArm('ARM 1 — deleteObjectAction()      NO selection', 'layer.deleteViaAction', false);
const A2 = await layerArm('⚠⚠ ARM 2 — deleteObjectAction()   WITH selection', 'layer.deleteViaAction', true);
const A3 = await layerArm('ARM 3 — duplicateObjectAction()   WITH selection', 'layer.duplicateViaAction', true);

// ==========================================================================
console.log('\n======== ⚠ ARM 4 — THE TRACK CONTROL: same call, sibling receiver');
note('⚠ A disposable track, made by duplicating gn-B and verified by channelId.');
await clearScratch();
const beforeDup = await tracks();
const si = beforeDup.find((x) => x.channelId === scratch.channelId)!.index;
await req('branch.duplicateTrack', { trackIndex: si });
await pollUntil(async () => (await tracks()).some((t) => !baseIds.has(t.channelId)), 8000, 250);
const victim = (await tracks()).find((t) => !baseIds.has(t.channelId));
if (!victim) { console.log('⚠⚠ ABORTING: could not create a disposable track.'); process.exit(1); }
note(`   disposable track: [${victim.index}] ${victim.name} ${victim.channelId.slice(0, 8)}`);
let ctlResult = 'returned';
try {
  const r = await req('track.deleteViaAction', { trackIndex: victim.index }) as { actionInvoke?: string };
  ctlResult = r.actionInvoke ?? 'returned';
} catch (e) { ctlResult = `WIRE-THREW: ${e instanceof Error ? e.message : String(e)}`; }
const gone = await pollUntil(async () => !(await tracks()).some((t) => t.channelId === victim.channelId), 6000, 250);
note(`   invoke -> ${ctlResult};  track ${gone.ok ? 'REMOVED ●' : 'still present ○'}`);
check('⚠⚠ TRACK CONTROL: `deleteObjectAction().invoke()` DOES delete a Track',
  gone.ok, { channelId: victim.channelId.slice(0, 8), invoke: ctlResult });
// ⚠ Reap by identity if the control did not fire, so nothing is left behind.
for (let g = 0; g < 6; g++) {
  const o = (await tracks()).find((t) => !baseIds.has(t.channelId));
  if (!o) break;
  note(`   reaping leftover ${o.name} ${o.channelId.slice(0, 8)}`);
  await req('track.delete', { trackIndex: o.index });
  await pollUntil(async () => !(await tracks()).some((t) => t.channelId === o.channelId), 4000, 200);
}

console.log('\n-- cleanup');
await clearScratch();
const endT = await tracks();
check(`${SCRATCH} is empty`, (await devs()).count === 0, {});
check('the TRACK LIST is back to baseline',
  endT.length === t0.length && endT.every((t) => baseIds.has(t.channelId)),
  { before: t0.length, after: endT.length });

console.log('\n' + '='.repeat(74));
for (const a of arms) console.log(`  ${a.changed ? '●●' : '○ '} ${a.label.padEnd(50)} flag=${a.flag}  invoke=${a.result}`);
console.log(`  ${gone.ok ? '●●' : '○ '} ARM 4 — TRACK CONTROL, same call, sibling receiver`);
console.log('='.repeat(74) + '\n');

const layerDeleted = A1.changed || A2.changed;
if (layerDeleted && gone.ok) {
  const w = A2.changed ? A2 : A1;
  check('⚠ and the RIGHT chain went — the Organ, named not counted',
    !w.survivors.some((x) => x.includes('Organ')), { survivors: w.survivors });
  note('⚠⚠⚠ DESTROY IS AUTONOMOUS AFTER ALL. `deleteObject()` was simply the wrong');
  note('  sibling method — exactly as `duplicateObject()` was for CREATE.');
  note('  ⇒ THE COMPLETE BRANCH LIFECYCLE IS TYPED AND AUTONOMOUS. E17 must be');
  note('  re-argued: layers lose only on durable identity and clips.');
  if (A2.changed && !A1.changed) note('  ⚠ It needs the SELECTION, same as create.');
  else if (A1.changed) note('  ⚠ And it needs NO selection — unlike create.');
} else if (!layerDeleted && gone.ok) {
  note('⇒ ⚠ A REAL, WELL-CONTROLLED ○. The identical inherited call, in the identical');
  note('  form, deletes a Track and refuses on a DeviceLayer — the sibling control');
  note('  passing in the same run is what makes that meaningful.');
  note('  ⇒ Both DeleteableObject forms are now exhausted. Destroy stays ◐: named');
  note('  action (human focus) or `app.undo`. ⚠ Create remains ● autonomous, so the');
  note('  ASYMMETRY is real and is the finding.');
} else if (!gone.ok) {
  note('⚠ THE CONTROL FAILED — `deleteObjectAction()` did not delete a Track either.');
  note('  So the `*Action()` form may be dead everywhere and the layer arms measure');
  note('  nothing. Record NOTHING about layers from this run.');
}
console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} checks reported a negative`);
process.exit(0);
