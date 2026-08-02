/**
 * E17 — does `Channel.duplicate()` need a chain to be SELECTED? If so, we can do it.
 *
 * ⚠⚠ **The state, stated honestly.** A TYPED call created a chain — `e17aj` CELL 3,
 * `Channel.duplicate()` on `gn-lay4`, chains 4→5, Phase-4 copied by name, undone
 * cleanly. So chain creation is NOT named-actions-only, and the row-2/3 ○ is wrong.
 *
 * ⚠ **But it did not reproduce on a fresh FX Layer** (`e17aj` CELL 1 ○, where
 * `e17ai` had ●). There is a hidden variable, and the candidate that fits both runs:
 *
 *     gn-lay4          the operator has been clicking chains on it all session
 *                      ⇒ a chain IS selected                      → ●
 *     fresh FX Layer   never selected, never clicked, brand new
 *                      ⇒ NO chain selected                        → ○
 *     e17ai's FX Layer the successful fire came right after `insertViaCursor`,
 *                      which uses `cursorLayer0` and may bind it   → ●
 *
 * ⚠⚠ **If a SELECTION is the precondition, chain creation is FULLY AUTONOMOUS**,
 * because `layer.select` is a typed call of ours and `e17y` proved it sets the very
 * same flag a human click does. That would collapse the entire "human click
 * required" conclusion for CREATE — with no focus, no priming, no foreground.
 *
 * **Four arms on a FRESH FX Layer that has never been selected or clicked:**
 *   A  no selection at all                → expect ○ (reproduce e17aj CELL 1)
 *   B  ⚠ `layer.select(editor, 0)` first   → THE QUESTION
 *   C  `layer.pointCursor(0)` first        → the cursor route, inert for actions
 *                                            (e17u) but maybe not for this verb
 *   D  `insertViaCursor` first             → reproduce e17ai's exact sequence
 *
 * ⚠ Arms alternate against a rebuilt fixture so no arm inherits another's state,
 * and the container is REBUILT FROM SCRATCH between arms — a fresh FX Layer has
 * provably never been selected, which is the one precondition that matters here.
 *
 * ⚠ Full inventory every fire; the track list is checked by identity; a chain count
 * moving by anything other than 0 or +1 aborts.
 *
 * Typed-only: no named actions, no focus, no priming, no foreground, no human.
 */
import { client, check, note, failureCount, pollUntil } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);

const SCRATCH = 'gn-B';
const FX_LAYER = 'a0913b7f-096b-4ac9-bddd-33c775314b42';
const POLYSYNTH = 'a9ffacb5-33e9-4fc7-8621-b1af31e410ef';

interface TrackRow { index: number; name: string; type: string; channelId: string }
interface DevList { devices: { index: number; name: string }[]; count: number; itemCount: number }
interface LayerList { layers: { index: number; name: string; devices: { name: string }[] }[]; count: number }
interface SelRow { index: number; selectedInEditor: boolean }
interface SelState { editorObserver: string; layers: SelRow[] }

await client.connect();
const tracks0 = ((await req('track.list')) as { tracks: TrackRow[] }).tracks;
const m = tracks0.filter((t) => t.name === SCRATCH);
if (m.length !== 1) { console.log(`⚠⚠ REFUSING: ${m.length} tracks named ${SCRATCH}.`); process.exit(1); }
const scratch = m[0]!;
const baseTrackIds = tracks0.map((t) => t.channelId).sort().join(',');

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
  let last = '';
  let out: DevList = { devices: [], count: 0, itemCount: 0 };
  await pollUntil(async () => {
    out = (await req('device.list', { cursor: '0' })) as DevList;
    const n = out.devices.map((d) => d.name).join(',');
    const stable = n === last; last = n; return stable;
  }, 4000, 200);
  return out;
}
async function scope(tag: string): Promise<void> {
  const d = await devs();
  const at = d.devices.findIndex((x) => /FX Layer/.test(x.name));
  if (at < 0) { console.log(`⚠⚠ ABORTING at ${tag}: no FX Layer.`); process.exit(1); }
  await req('devcursor.selectAt', { deviceIndex: at });
  const ok = await pollUntil(async () => {
    const s = (await req('devcursor.status')) as { exists: boolean; name: string };
    return s.exists && /FX Layer/.test(s.name);
  }, 6000, 150);
  if (!ok.ok) { console.log(`⚠⚠ ABORTING at ${tag}: cursor did not land.`); process.exit(1); }
}
interface Inv { trackIds: string; devices: string[]; chains: string[]; inChain: number }
async function inv(tag: string): Promise<Inv> {
  const tl = ((await req('track.list')) as { tracks: TrackRow[] }).tracks;
  await pointScratch();
  const d = await devs();
  await scope(tag);
  const l = (await req('layer.list')) as LayerList;
  return {
    trackIds: tl.map((x) => x.channelId).sort().join(','),
    devices: d.devices.map((x) => x.name),
    chains: l.layers.map((x) => `${x.name}[${x.devices.map((y) => y.name).join('+') || '—'}]`),
    inChain: l.layers.reduce((n, x) => n + x.devices.length, 0),
  };
}
const show = (i: Inv) => `devices=[${i.devices.join(',')}] chains=${i.chains.length} [${i.chains.join(' ')}]`;
const selState = async () => (await req('layer.selectionState')) as SelState;

async function clearScratch(): Promise<void> {
  await pointScratch();
  for (let g = 0; g < 14; g++) {
    const d = await devs();
    if (d.count === 0) break;
    await req('device.delete', { cursor: '0', deviceIndex: d.devices[0]!.index });
    await pollUntil(async () => (await devs()).count < d.count, 4000, 200);
  }
}

/** ⚠ A provably never-selected container: built from scratch, one populated chain. */
async function freshFixture(): Promise<void> {
  await clearScratch();
  await req('device.insertBitwig', { cursor: '0', uuid: FX_LAYER });
  await pollUntil(async () => (await devs()).devices.some((d) => /FX Layer/.test(d.name)), 8000, 200);
  await scope('fixture');
  await req('layer.insertDevice', { layerIndex: 0, uuid: POLYSYNTH });
  await pollUntil(async () => {
    await scope('fixture poll');
    return ((await req('layer.list')) as LayerList).layers.reduce((n, x) => n + x.devices.length, 0) > 0;
  }, 8000, 250);
}

interface Arm { label: string; created: boolean; flagged: string }
const arms: Arm[] = [];

async function arm(label: string, primer: (() => Promise<void>) | null): Promise<Arm> {
  await freshFixture();
  const before = await inv(`${label} before`);
  console.log(`\n  ${label}`);
  note(`   BEFORE ${show(before)}`);
  await scope(`${label} primer`);
  if (primer) await primer();
  await new Promise((r) => setTimeout(r, 500));
  await scope(`${label} at-call`);
  const s = await selState();
  const flaggedIdx = s.layers.findIndex((r) => r.selectedInEditor);
  const flagged = flaggedIdx >= 0 ? `chain ${flaggedIdx}` : 'none';
  note(`   selection flag before the call: ${flagged}`);
  await req('layer.duplicateChannel', { layerIndex: 0 });
  await pollUntil(async () => {
    const n = await inv(`${label} poll`);
    return n.chains.length !== before.chains.length || n.devices.length !== before.devices.length;
  }, 4000, 300);
  const after = await inv(`${label} after`);
  note(`   AFTER  ${show(after)}`);
  const d = after.chains.length - before.chains.length;
  if (after.trackIds !== before.trackIds || d < 0 || d > 1) {
    console.log(`\n⚠⚠ ABORTING: illegal end state (Δchains=${d}).`); process.exit(1);
  }
  console.log(`   ⇒ Δchains=${d}   ${d > 0 ? '●● CHAIN CREATED' : '○ nothing'}`);
  const a = { label, created: d > 0, flagged };
  arms.push(a);
  return a;
}

// ==========================================================================
console.log('');
console.log('='.repeat(74));
console.log(' ⚠ Does `Channel.duplicate()` need a chain SELECTED? Fresh FX Layer each arm.');
console.log('='.repeat(74));
const boot = await selState();
check('PRECONDITION: the selection reader is attached',
  String(boot.editorObserver).startsWith('observing:'), { status: boot.editorObserver });

const A = await arm('ARM A — no selection at all (reproduce e17aj CELL 1)', null);
const B = await arm('⚠⚠ ARM B — layer.select(editor, 0) first  [THE QUESTION]', async () => {
  await req('layer.select', { layerIndex: 0, where: 'editor' });
  note('   primer: layer.select(editor, 0) — typed, ours, sets the same flag a click does (e17y)');
});
const C = await arm('ARM C — layer.pointCursor(0) first', async () => {
  await req('layer.pointCursor', { layerIndex: 0 });
  note('   primer: layer.pointCursor(0) — inert for named actions (e17u), untested for this verb');
});
const D = await arm('ARM D — insertViaCursor first (reproduce e17ai\'s exact sequence)', async () => {
  await req('layer.insertViaCursor', { uuid: POLYSYNTH });
  note('   primer: layer.insertViaCursor — binds cursorLayer0, the e17ai sequence');
});

console.log('\n-- cleanup');
await clearScratch();
const endTracks = ((await req('track.list')) as { tracks: TrackRow[] }).tracks;
check(`${SCRATCH} is empty`, (await devs()).count === 0, {});
check('the TRACK LIST is untouched', endTracks.map((t) => t.channelId).sort().join(',') === baseTrackIds, {});

console.log(`\n${'='.repeat(74)}`);
for (const a of arms) console.log(`  ${a.created ? '●●' : '○ '} ${a.label.padEnd(58)} flag=${a.flagged}`);
console.log('='.repeat(74));
console.log('');
check('⚠ ARM A reproduces the negative — a fresh, never-selected container refuses',
  !A.created, { created: A.created });
if (B.created) {
  note('⚠⚠⚠ A SELECTION IS THE PRECONDITION, AND IT IS OURS TO SET.');
  note('  `layer.select` is typed, needs no focus, no priming, no foreground and no human —');
  note('  and `e17y` proved it sets the identical flag a click does.');
  note('  ⇒ CHAIN CREATION IS FULLY AUTONOMOUS: layer.select + Channel.duplicate().');
  note('  ⇒ Rows 2/3 flip to ●, the "human click" conclusion collapses for CREATE, and');
  note('  E17 must be re-argued again. ⚠ DESTROY is still open — the typed deletes have');
  note('  not been re-tested under a satisfied selection precondition.');
} else if (C.created || D.created) {
  note(`⚠ Not the editor selection — ${C.created ? 'pointCursor' : 'insertViaCursor'} is what enables it.`);
  note('  Still ours, still typed, so autonomy may hold — but the mechanism is different');
  note('  from the one predicted and the write-up must say which call actually matters.');
} else if (!A.created) {
  note('⚠ No primer worked on a fresh container, yet CELL 3 succeeded on gn-lay4. So the');
  note('  variable is NOT a selection we can set — it is something about gn-lay4 that a');
  note('  fresh container lacks. ⚠ Next: try the same verb on gn-lay4 with the selection');
  note('  explicitly CLEARED, and on a fresh container after a save+reload.');
} else {
  note('⚠ ARM A created a chain, so the negative did not reproduce and nothing here is');
  note('  interpretable. The effect is unstable; isolate before recording.');
}
console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} checks reported a negative — read individually`);
process.exit(0);
