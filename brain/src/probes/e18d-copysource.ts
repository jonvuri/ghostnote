/**
 * E18 — ⚠ `e18c` row 4 CONTRADICTS E4d route 3. Which one is wrong?
 *
 * **The conflict, stated exactly.** E4d recorded `InsertionPoint.copyDevices()`
 * into a layer chain as a silent no-op, and E16n reasoned about that ○ at length
 * when it overturned the `moveDevices` half:
 *
 * > *"`copyDevices`' no-op was verb-specific rather than destination-specific"*
 *
 * ⚠ **`e18c` row 4 copied a device INTO a layer chain and it worked** — `Phase-4`
 * from chain `A0` into chain `B1` of a different container, with the source keeping
 * its copy and the population rising by exactly one. That is the same verb at the
 * same kind of destination, with the opposite outcome.
 *
 * **Two readings survive, and they are materially different:**
 *
 *   (a) E4d's ○ was an ARTIFACT — most likely the e16o trap, where `layerBank0`
 *       follows `cursorDevice0` and a call aimed at a device with no layers is a
 *       silent no-op byte-identical to a refusal. Its `moveDevices` sibling died of
 *       exactly that and E16n overturned it. ⇒ a correction is owed to E4d route 3.
 *   (b) The SOURCE decides. Every previous attempt copied a device from the
 *       TOP-LEVEL chain; `e18c` copied one that was already NESTED. If a nested
 *       source works where a top-level one does not, E4d's ○ stands and is simply
 *       narrower than it was written.
 *
 * ⚠ Nothing about the two readings is decided by argument, and the whole spike's
 * record says not to try: this is the fifth time a verb everyone had written off
 * turned out to work when aimed differently.
 *
 * ### Three arms, one fixture, one sitting — the source is the only variable
 *
 *     fixture   gn-B  slot 0 = FX Layer  C0[Polysynth] C1[—] C2[—]
 *                     top    = [FX Layer, Polysynth]
 *
 * | arm | verb | SOURCE | destination | prior |
 * |---|---|---|---|---|
 * | A | `copy` | ⚠ **nested** (C0) | C1 | ● expected — reproduces `e18c` row 4 |
 * | B | ⚠ **`copy`** | ⚠ **top level** | C2 | ⚠ **THE QUESTION** — E4d says ○ |
 * | C | `move` | ⚠ **top level** | C2 | ● expected — E16n |
 *
 * ⚠ **C is what makes B interpretable, and it is the whole design.** It holds the
 * source and the destination fixed and changes only the VERB. If B is ○ while C is
 * ●, the top-level source handle is demonstrably valid and the destination
 * demonstrably alive in the same sitting — so the ○ can only be the verb, and
 * reading (b) is established rather than assumed. Without C, a ○ on B is the E6
 * failure again: a negative whose control was a different object read through a
 * different oracle, unable to tell "the channel is dead" from "this call does
 * nothing".
 *
 * ⚠ A ● on all three convicts E4d route 3 of being a false negative and the
 * correction goes into FINDINGS rather than into an argument.
 *
 * Typed-only. Restores `gn-B` to empty and verifies the track list by identity.
 */
import { client, check, note, failureCount, pollUntil } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const TRACK = 'gn-B';
const FX_LAYER = 'a0913b7f-096b-4ac9-bddd-33c775314b42';
const POLYSYNTH = 'a9ffacb5-33e9-4fc7-8621-b1af31e410ef';
const ORGAN = 'f2dcfe9a-7b66-4c84-984a-b25685a1c21a';

interface TrackRow { index: number; name: string; channelId: string }
interface DevList { devices: { index: number; name: string }[]; count: number }
interface ChainRow { index: number; name: string; devices: { index: number; name: string }[] }
interface Scope { slot: number; status: string; deviceName: string; chains: ChainRow[] }
interface Inventory { scopes: Scope[]; trackName: string }
interface LayerList { layers: ChainRow[]; count: number }

const trackList = async () => ((await req('track.list')) as { tracks: TrackRow[] }).tracks;
const idsOf = (t: TrackRow[]) => t.map((x) => x.channelId).sort().join(',');
let subject!: TrackRow;

async function fail(message: string): Promise<never> {
  console.log(`\n⚠⚠⚠ ABORTING: ${message}`);
  process.exit(1);
}

async function pointSubject(): Promise<void> {
  const row = (await trackList()).find((t) => t.channelId === subject.channelId);
  if (!row) await fail(`"${TRACK}" is gone.`);
  await req('cursor.pointTrack', { cursor: '0', trackIndex: row!.index });
  await wait(700);
}

async function devs(): Promise<DevList> {
  let last = ' ';
  let out: DevList = { devices: [], count: 0 };
  await pollUntil(async () => {
    out = (await req('device.list', { cursor: '0' })) as DevList;
    const n = out.devices.map((d) => d.name).join(',');
    const stable = n === last; last = n; return stable;
  }, 5000, 200);
  return out;
}

/** Scope cursorDevice0 onto the FX Layer — `layer.*` calls reach through it. */
async function scopeContainer(tag: string): Promise<void> {
  const d = await devs();
  const at = d.devices.find((x) => /FX Layer/.test(x.name));
  if (!at) await fail(`${tag}: no FX Layer on ${TRACK}.`);
  await req('devcursor.selectAt', { deviceIndex: at!.index });
  const ok = await pollUntil(async () => {
    const s = (await req('devcursor.status')) as { exists: boolean; name: string };
    return s.exists && /FX Layer/.test(s.name);
  }, 6000, 150);
  if (!ok.ok) await fail(`${tag}: the device cursor never landed on the FX Layer.`);
}

interface State { top: string[]; chains: ChainRow[]; population: number }
async function state(tag: string): Promise<State> {
  const top = (await devs()).devices.map((x) => x.name);
  const inv = (await req('chain.inventory')) as Inventory;
  if (inv.trackName !== TRACK) {
    await fail(`${tag}: the slot scopes are on "${inv.trackName}", not "${TRACK}".`);
  }
  const s0 = inv.scopes.find((s) => s.slot === 0);
  if (!s0 || s0.status !== 'held') {
    await fail(`${tag}: slot scope 0 reports "${s0?.status}" — a missing handle reads exactly `
      + 'like a refusal (standing rule 13).');
  }
  const chains = s0!.chains;
  return { top, chains, population: top.length + chains.reduce((n, c) => n + c.devices.length, 0) };
}
const chainOf = (s: State, name: string) => s.chains.find((c) => c.name === name);
const show = (s: State, tag: string) => {
  note(`${tag.padEnd(8)} top=[${s.top.join(', ')}]`);
  note(`${''.padEnd(8)} C: ${s.chains.map((c) => `${c.name}[${c.devices.map((d) => d.name).join('+') || '—'}]`).join(' ')}`);
};

interface Arm { label: string; ok: boolean; detail: string }
const arms: Arm[] = [];

/**
 * Fire one arm and score BOTH halves: a copy must leave the source intact and a
 * move must not, and either way the destination must actually gain the device.
 */
async function arm(
  label: string, fire: () => Promise<void>, sourceIsTop: boolean,
  srcChain: string | null, dstChain: string, device: string, copying: boolean,
): Promise<Arm> {
  console.log(`\n  ${label}`);
  const before = await state(`${label} before`);
  show(before, 'before');

  await fire();
  await pollUntil(async () => {
    const s = await state(`${label} poll`);
    return s.population !== before.population || s.top.length !== before.top.length
      || (chainOf(s, dstChain)?.devices.length ?? 0) !== (chainOf(before, dstChain)?.devices.length ?? 0);
  }, 6000, 250);
  await wait(400);
  const after = await state(`${label} after`);
  show(after, 'after');

  // ⚠ Guard #4 — a copy adds exactly one, a move conserves. Anything else means
  // the wrong object is being read, so abort rather than score.
  const want = before.population + (copying ? 1 : 0);
  if (after.population !== want) {
    await fail(`${label}: population ${before.population} → ${after.population}, expected ${want}.`);
  }

  const dstGained = (chainOf(after, dstChain)?.devices.filter((d) => d.name === device).length ?? 0)
    > (chainOf(before, dstChain)?.devices.filter((d) => d.name === device).length ?? 0);
  const srcHeld = sourceIsTop
    ? after.top.filter((n) => n === device).length === before.top.filter((n) => n === device).length
    : (chainOf(after, srcChain!)?.devices.some((d) => d.name === device) ?? false);
  // A copy must KEEP its source; a move must lose it.
  const srcCorrect = copying ? srcHeld : !srcHeld;

  const ok = dstGained && srcCorrect;
  const detail = `${dstChain} ${dstGained ? 'gained ●' : 'did NOT gain ○'}; `
    + `source ${srcHeld ? 'kept' : 'lost'} it (${copying ? 'copy must keep' : 'move must lose'}) `
    + `${srcCorrect ? '●' : '⚠'}`;
  console.log(`   ⇒ ${ok ? '●● ' : '○  '}${detail}`);
  const a = { label, ok, detail };
  arms.push(a);
  return a;
}

// ==========================================================================
console.log('');
console.log('='.repeat(78));
console.log(' E18 — does `copyDevices` into a chain depend on where the SOURCE lives?');
console.log('='.repeat(78));

await client.connect();
const hello = (await req('contract.hello')) as { methodsHash: string; methodCount: number };
note(`wire: ${hello.methodCount} methods, methodsHash ${hello.methodsHash}`);

const hits = (await trackList()).filter((t) => t.name === TRACK);
if (hits.length !== 1) { console.log(`⚠⚠ REFUSING: ${hits.length} tracks named "${TRACK}".`); process.exit(1); }
subject = hits[0]!;
const baseTrackIds = idsOf(await trackList());
await pointSubject();

console.log('\n-- fixture');
let d = await devs();
for (let g = 0; g < 12 && d.count > 0; g++) {
  await req('device.delete', { cursor: '0', deviceIndex: d.devices[0]!.index });
  await pollUntil(async () => (await devs()).count < d.count, 6000, 200);
  d = await devs();
}
check(`${TRACK} cleared`, d.count === 0, {});

await req('device.insertBitwig', { cursor: '0', uuid: FX_LAYER });
await pollUntil(async () => (await devs()).count === 1, 12000, 200);
await wait(400);
await scopeContainer('grow');
for (let i = 0; i < 2; i++) {
  await req('layer.select', { layerIndex: 0, where: 'editor' });
  await wait(250);
  await req('layer.duplicateChannel', { layerIndex: 0 });
  await pollUntil(async () => ((await req('layer.list')) as LayerList).count === i + 2, 6000, 250);
}
for (let i = 0; i < 3; i++) { await req('layer.setName', { layerIndex: i, name: `C${i}` }); await wait(200); }
// ⚠ Seed C0 through `layer.insertDevice` — a route independent of every verb under
// test, so the nested source exists without presupposing the answer.
await req('layer.insertDevice', { layerIndex: 0, uuid: ORGAN });
await wait(800);
// The TOP-LEVEL source, at index 1 so the FX Layer keeps slot 0.
await req('device.insertBitwig', { cursor: '0', uuid: POLYSYNTH });
await pollUntil(async () => (await devs()).count === 2, 12000, 200);
await wait(500);

const built = await state('fixture');
show(built, 'built');
check('C0 holds the nested source (Organ), C1 and C2 are empty',
  chainOf(built, 'C0')?.devices.map((x) => x.name).join('') === 'Organ'
  && chainOf(built, 'C1')?.devices.length === 0 && chainOf(built, 'C2')?.devices.length === 0, {});
check('a top-level Polysynth is available as the other source',
  built.top.filter((n) => n === 'Polysynth').length === 1, { top: built.top });

// ---------------------------------------------------------------- the arms
console.log('\n' + '-'.repeat(78));
console.log(' ARM A — copy from a NESTED source (reproduce e18c row 4)');
console.log('-'.repeat(78));
const A = await arm('ARM A — copy C0\'s Organ → C1', async () => {
  await req('chain.move', { srcSlot: 0, srcLayer: 0, srcDevice: 0, dst: 'chain', dstSlot: 0, dstLayer: 1, verb: 'copy' });
}, false, 'C0', 'C1', 'Organ', true);

console.log('\n' + '-'.repeat(78));
console.log(' ARM B — ⚠ copy from a TOP-LEVEL source: the E4d route 3 question');
console.log('-'.repeat(78));
const B = await arm('ARM B — copy the top-level Polysynth → C2 (layer.copyDeviceInto)', async () => {
  await scopeContainer('arm B');
  const top = await devs();
  const at = top.devices.find((x) => x.name === 'Polysynth')!;
  await req('layer.copyDeviceInto', { layerIndex: 2, deviceIndex: at.index });
}, true, null, 'C2', 'Polysynth', true);

console.log('\n' + '-'.repeat(78));
console.log(' ARM C — ⚠ the DISCRIMINATOR: same source, same destination, MOVE instead of copy');
console.log('-'.repeat(78));
const C = await arm('ARM C — move the top-level Polysynth → C2 (layer.moveDeviceInto)', async () => {
  await scopeContainer('arm C');
  const top = await devs();
  const at = top.devices.find((x) => x.name === 'Polysynth')!;
  await req('layer.moveDeviceInto', { layerIndex: 2, deviceIndex: at.index });
}, true, null, 'C2', 'Polysynth', false);

// ---------------------------------------------------------------- cleanup
console.log('\n' + '-'.repeat(78));
await pointSubject();
let left = await devs();
for (let g = 0; g < 12 && left.count > 0; g++) {
  await req('device.delete', { cursor: '0', deviceIndex: left.devices[0]!.index });
  await pollUntil(async () => (await devs()).count < left.count, 6000, 200);
  left = await devs();
}
check(`${TRACK} is empty again`, left.count === 0, { devices: left.devices.map((x) => x.name) });
check('the TRACK LIST is untouched by identity', idsOf(await trackList()) === baseTrackIds, {});

// ---------------------------------------------------------------- verdict
console.log('\n' + '='.repeat(78));
for (const a of arms) console.log(`  ${a.ok ? '●●' : '○ '}  ${a.label}`);
console.log('='.repeat(78));
console.log('');

if (A.ok && B.ok && C.ok) {
  note('⚠⚠ E4d ROUTE 3 IS A FALSE NEGATIVE. `copyDevices` into a layer chain works from a');
  note('   TOP-LEVEL source as well as a nested one — the same shape as its `moveDevices`');
  note('   sibling, which E16n already overturned for the same reason. ⇒ E16n\'s reading');
  note('   that the no-op was "verb-specific rather than destination-specific" is wrong in');
  note('   both halves: it was neither. A correction is owed to E4d route 3 and to E16n.');
} else if (A.ok && !B.ok && C.ok) {
  note('⚠⚠ THE SOURCE DECIDES, and the discriminator is clean: the SAME source and the SAME');
  note('   destination accept a MOVE and refuse a COPY, in one sitting. So E4d route 3 stands');
  note('   and is narrower than it was written — `copyDevices` works from a NESTED source and');
  note('   refuses a top-level one. ⚠ For the rebuild strategy that is the half that matters:');
  note('   every migration copy is chain → chain, which is the direction that works.');
} else if (!A.ok) {
  note('⚠⚠ ARM A did not reproduce `e18c` row 4, so nothing here is interpretable. The effect');
  note('   is unstable across sittings — isolate that before recording anything at all.');
} else if (!C.ok) {
  note('⚠ ARM C failed, so the top-level source handle or the destination was not live in this');
  note('  sitting and ARM B\'s ○ cannot be attributed. The run is VOID, not a negative.');
}

console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} checks reported a negative — read individually`);
process.exit(0);
