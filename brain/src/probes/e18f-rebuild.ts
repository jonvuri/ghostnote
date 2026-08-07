/**
 * E18 §3.1's BAR — a realistic REBUILD, measured: cost, undo granularity, atomicity.
 *
 * `e18c` established the rebuild strategy is MECHANICALLY available. ⚠ That was
 * never the operator's question:
 *
 * > *"reasonably efficient, stable, and low on (or free of) intermediate states that
 * > are undesirable or glitchy… It doesn't need to be perfect — track branching
 * > isn't either."*
 *
 * So this runs the **`reduce`** shape end to end — clone the container with fewer
 * chains, migrate the devices across, delete the old container — and measures the
 * three properties that decide whether it is shippable.
 *
 * | | question | why it decides something |
 * |---|---|---|
 * | COST | how long does a realistic reduce take? | N chains × M devices adds up; the track model's fork is one op |
 * | ⚠ **UNDO** | how many undo steps is one rebuild? | ⚠ **a real UX regression vs the track model** — one user Cmd-Z landing mid-migration is a broken project |
 * | ATOMICITY | what does a half-done rebuild look like? | if it fails partway, the old container may already be gone |
 *
 * ### ⚠⚠ The undo arm is the dangerous one, and it is railed accordingly
 *
 * `app.undo` walks the **PROJECT-WIDE** undo stack. It does not know about our
 * fixture, and firing it blindly can undo the operator's own work — which would be
 * an unrecoverable side effect of a measurement, and by far the worst thing this
 * probe could do. Four rails, all of which must hold:
 *
 * 1. ⚠ A full **cross-track fingerprint** is taken before the first undo. After
 *    EVERY undo, everything outside `gn-B` must be byte-identical — the track list
 *    by identity, and the device list of every other track including `gn-A`, the
 *    Master and `FX 1`, which earlier probes in this session also wrote to.
 * 2. ⚠ The moment anything else moves, the probe **REDOES immediately** and aborts.
 * 3. A hard ceiling on undo count, so a runaway cannot walk the stack.
 * 4. ⚠ Every undo is **redone** at the end, so the operator's stack is left where it
 *    was found rather than rewound. Measuring must not mutate.
 *
 * ⚠ These rails are why the arm is worth running at all: the answer matters (it is a
 * genuine argument against the layer model) and it cannot be reasoned out — Bitwig
 * decides its own undo granularity and nothing in the API documents it.
 *
 * ⚠ Typed-only. No named actions, no focus, no priming, no human. The transport is
 * never started.
 */
import { client, check, note, failureCount, pollUntil } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const TRACK = 'gn-B';
const PRESET = '/Users/jonvuri/Development/ghostnote/brain/fixtures/InstrumentLayer/gn_layer_4chain.bwpreset';
const FX_LAYER = 'a0913b7f-096b-4ac9-bddd-33c775314b42';
const MAX_UNDO = 40;

interface TrackRow { index: number; name: string; channelId: string }
interface DevList { devices: { index: number; name: string }[]; count: number }
interface ChainRow { index: number; name: string; devices: { index: number; name: string }[] }
interface Scope { slot: number; status: string; deviceName: string; chains: ChainRow[] }
interface Inventory { scopes: Scope[]; trackName: string }
interface LayerList { layers: ChainRow[]; count: number }
interface UndoState { canUndo: boolean; canRedo: boolean }

const trackList = async () => ((await req('track.list')) as { tracks: TrackRow[] }).tracks;
const idsOf = (t: TrackRow[]) => t.map((x) => x.channelId).sort().join(',');
let subject!: TrackRow;

async function bail(message: string): Promise<never> {
  console.log(`\n⚠⚠⚠ ABORTING: ${message}`);
  process.exit(1);
}

async function pointAt(t: TrackRow): Promise<void> {
  const row = (await trackList()).find((x) => x.channelId === t.channelId);
  if (!row) await bail(`"${t.name}" is gone from the track list.`);
  await req('cursor.pointTrack', { cursor: '0', trackIndex: row!.index });
  await wait(650);
}
const pointSubject = () => pointAt(subject);

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

async function scopeCursor(slot: number, tag: string): Promise<void> {
  const d = await devs();
  const target = d.devices.find((x) => x.index === slot);
  if (!target) await bail(`${tag}: no device at top-level index ${slot}.`);
  await req('devcursor.selectAt', { deviceIndex: slot });
  const ok = await pollUntil(async () => {
    const s = (await req('devcursor.status')) as { exists: boolean; name: string };
    return s.exists && s.name === target!.name;
  }, 6000, 150);
  if (!ok.ok) await bail(`${tag}: the device cursor never landed on slot ${slot}.`);
}

/** Everything about gn-B, at every level. */
async function shape(tag: string): Promise<string> {
  const top = (await devs()).devices.map((x) => x.name);
  const inv = (await req('chain.inventory')) as Inventory;
  if (inv.trackName !== TRACK) await bail(`${tag}: the scopes are on "${inv.trackName}", not "${TRACK}".`);
  const slots = inv.scopes
    .map((s) => `${s.slot}:${s.deviceName || '—'}{${s.chains.map((c) => `${c.name}[${c.devices.map((x) => x.name).join('+') || '—'}]`).join(' ') || '—'}}`)
    .join('  ');
  return `top=[${top.join(', ')}]  ${slots}`;
}

/**
 * ⚠ The world OUTSIDE gn-B, which the undo arm must never disturb.
 *
 * `e17ah` shipped a snapshot that verified the track list by identity but never
 * looked inside any track but the subject, so anything landing elsewhere read as ○
 * everywhere. Earlier probes THIS SESSION wrote to `gn-A`, the Master and `FX 1`,
 * so those are exactly the rows a runaway undo would hit first.
 */
async function outsideWorld(): Promise<string> {
  const rows: string[] = [];
  for (const t of await trackList()) {
    if (t.channelId === subject.channelId) continue;
    await req('cursor.pointTrack', { cursor: '0', trackIndex: t.index });
    await wait(600);
    rows.push(`${t.name}:${(await devs()).devices.map((x) => x.name).join('+') || '—'}`);
  }
  return `${idsOf(await trackList())} || ${rows.join(' | ')}`;
}

// ==========================================================================
console.log('');
console.log('='.repeat(78));
console.log(' E18 §3.1 — the BAR: what does a realistic REBUILD actually cost?');
console.log('='.repeat(78));

await client.connect();
const hello = (await req('contract.hello')) as { methodsHash: string; methodCount: number };
note(`wire: ${hello.methodCount} methods, methodsHash ${hello.methodsHash}`);

const hits = (await trackList()).filter((t) => t.name === TRACK);
if (hits.length !== 1) { console.log(`⚠⚠ REFUSING: ${hits.length} tracks named "${TRACK}".`); process.exit(1); }
subject = hits[0]!;
await pointSubject();

console.log('\n-- fixture: a 4-take container, the thing being reduced');
let d = await devs();
for (let g = 0; g < 12 && d.count > 0; g++) {
  await req('device.delete', { cursor: '0', deviceIndex: d.devices[0]!.index });
  await pollUntil(async () => (await devs()).count < d.count, 6000, 200);
  d = await devs();
}
await req('device.insertFile', { cursor: '0', path: PRESET });
await pollUntil(async () => (await devs()).count === 1, 12000, 200);
await wait(500);
await scopeCursor(0, 'rename');
for (let i = 0; i < 4; i++) { await req('layer.setName', { layerIndex: i, name: `OLD${i}` }); await wait(180); }
await wait(300);
const startShape = await shape('fixture');
note(startShape);
check('the OLD container carries 4 named takes',
  ((await req('chain.inventory')) as Inventory).scopes[0]!.chains.length === 4, {});

// ==========================================================================
// COST — the `reduce` shape, end to end and timed per step
// ==========================================================================
console.log('\n' + '-'.repeat(78));
console.log(' COST — reduce 4 takes to 2: clone narrower, migrate across, delete the old');
console.log('-'.repeat(78));

const timings: { step: string; ms: number }[] = [];
async function step<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const t0 = Date.now();
  const out = await fn();
  const ms = Date.now() - t0;
  timings.push({ step: label, ms });
  note(`   ${String(ms).padStart(5)} ms  ${label}`);
  return out;
}

const rebuildStart = Date.now();

await step('insert the NEW container (FX Layer, ships with 1 chain)', async () => {
  await req('device.insertBitwig', { cursor: '0', uuid: FX_LAYER });
  await pollUntil(async () => (await devs()).count === 2, 12000, 200);
  await wait(300);
});
await step('grow it to 2 chains (layer.select + duplicateChannel)', async () => {
  await scopeCursor(1, 'grow');
  await req('layer.select', { layerIndex: 0, where: 'editor' });
  await wait(200);
  await req('layer.duplicateChannel', { layerIndex: 0 });
  await pollUntil(async () => ((await req('layer.list')) as LayerList).count === 2, 6000, 250);
});
await step('name the 2 surviving takes', async () => {
  for (let i = 0; i < 2; i++) { await req('layer.setName', { layerIndex: i, name: `NEW${i}` }); await wait(180); }
});
await step('migrate take OLD0 → NEW0 (copy, across containers)', async () => {
  await req('chain.move', { srcSlot: 0, srcLayer: 0, srcDevice: 0, dst: 'chain', dstSlot: 1, dstLayer: 0, verb: 'copy' });
  await pollUntil(async () => {
    const inv = (await req('chain.inventory')) as Inventory;
    return (inv.scopes[1]?.chains[0]?.devices.length ?? 0) > 0;
  }, 8000, 250);
});
await step('migrate take OLD1 → NEW1 (copy, across containers)', async () => {
  await req('chain.move', { srcSlot: 0, srcLayer: 1, srcDevice: 0, dst: 'chain', dstSlot: 1, dstLayer: 1, verb: 'copy' });
  await pollUntil(async () => {
    const inv = (await req('chain.inventory')) as Inventory;
    return (inv.scopes[1]?.chains[1]?.devices.length ?? 0) > 0;
  }, 8000, 250);
});
await step('DELETE the old container', async () => {
  await pointSubject();
  const now = await devs();
  const old = now.devices.find((x) => x.name === 'Instrument Layer')!;
  await req('device.delete', { cursor: '0', deviceIndex: old.index });
  await pollUntil(async () => (await devs()).count === 1, 8000, 200);
  await wait(300);
});

const rebuildMs = Date.now() - rebuildStart;
const rebuiltShape = await shape('rebuilt');
console.log('');
note(`rebuilt: ${rebuiltShape}`);
const invAfter = (await req('chain.inventory')) as Inventory;
const survived = invAfter.scopes[0]!.chains;
check('⚠ the rebuild produced a 2-take container carrying the migrated devices',
  survived.length === 2 && survived.every((c) => c.devices.length > 0),
  { chains: survived.map((c) => `${c.name}[${c.devices.map((x) => x.name).join('+')}]`) });
console.log('');
console.log(`  ⇒ TOTAL ${rebuildMs} ms for a 4→2 reduce carrying 2 devices, in ${timings.length} steps`);

// ==========================================================================
// UNDO GRANULARITY — the UX question, heavily railed
// ==========================================================================
console.log('\n' + '-'.repeat(78));
console.log(' UNDO — how many steps is ONE rebuild? (project-wide stack: fully railed)');
console.log('-'.repeat(78));

const worldBefore = await outsideWorld();
note('the world outside gn-B is fingerprinted; ANY change to it aborts and redoes');
await pointSubject();

const undoTrail: { n: number; shape: string }[] = [];
let undone = 0;
let reachedStart = false;

for (let i = 1; i <= MAX_UNDO; i++) {
  const st = (await req('app.undoState')) as UndoState;
  if (!st.canUndo) { note(`   the undo stack is exhausted after ${undone}`); break; }
  await req('app.undo');
  await wait(500);
  undone = i;

  // ⚠ RAIL 1+2: nothing outside gn-B may move. If it did, put it straight back.
  const worldNow = await outsideWorld();
  await pointSubject();
  if (worldNow !== worldBefore) {
    console.log(`\n⚠⚠ undo #${i} reached OUTSIDE gn-B. Redoing immediately.`);
    for (let r = 0; r < i; r++) { await req('app.redo'); await wait(400); }
    const restored = await outsideWorld();
    await pointSubject();
    check('⚠ the world outside gn-B was RESTORED by redo', restored === worldBefore,
      { before: worldBefore, after: restored });
    note(`⇒ the rebuild is AT MOST ${i - 1} undo steps — the walk stopped at the fixture boundary,`);
    note('  which is a bound, not the exact number.');
    undone = i - 1;
    break;
  }

  const s = await shape(`undo ${i}`);
  undoTrail.push({ n: i, shape: s });
  console.log(`   undo ${String(i).padStart(2)}: ${s}`);
  if (s === startShape) { reachedStart = true; note(`   ⇒ back to the pre-rebuild shape after ${i} undos`); break; }
}

console.log('');
if (reachedStart) {
  console.log(`  ⇒ ⚠⚠ ONE REBUILD = ${undone} UNDO STEPS.`);
} else {
  console.log(`  ⇒ ${undone} undos did not reach the pre-rebuild shape (ceiling ${MAX_UNDO}).`);
}

// ⚠ ATOMICITY, read off the same trail: what does a half-undone rebuild look like?
const broken = undoTrail.filter((t) => /Instrument Layer/.test(t.shape) && /FX Layer/.test(t.shape));
note(`⚠ intermediate states in which BOTH containers coexist: ${broken.length} of ${undoTrail.length}`);
if (broken.length > 0) {
  note('  ⇒ a single user Cmd-Z lands INSIDE the rebuild, with the old and new containers');
  note('    both present and the takes duplicated across them. That is the intermediate');
  note('    state the operator asked about, and it is reachable by one keystroke.');
}

// ⚠ RAIL 4: leave the operator's undo stack where it was found.
console.log('\n-- restoring the undo stack (measuring must not mutate)');
let redone = 0;
for (let i = 0; i < undone; i++) {
  const st = (await req('app.undoState')) as UndoState;
  if (!st.canRedo) break;
  await req('app.redo');
  await wait(450);
  redone++;
}
await pointSubject();
const backShape = await shape('redone');
note(`redid ${redone} of ${undone}: ${backShape}`);
check('⚠ redo returned gn-B to the rebuilt shape — the stack is where we found it',
  backShape === rebuiltShape, { want: rebuiltShape, got: backShape });
const worldEnd = await outsideWorld();
await pointSubject();
check('⚠ the world outside gn-B is untouched by the whole undo arm', worldEnd === worldBefore,
  worldEnd === worldBefore ? {} : { before: worldBefore, after: worldEnd });

// ==========================================================================
console.log('\n' + '-'.repeat(78));
console.log(' cleanup');
console.log('-'.repeat(78));
await pointSubject();
let left = await devs();
for (let g = 0; g < 14 && left.count > 0; g++) {
  await req('device.delete', { cursor: '0', deviceIndex: left.devices[0]!.index });
  await pollUntil(async () => (await devs()).count < left.count, 6000, 200);
  left = await devs();
}
check(`${TRACK} is empty again`, left.count === 0, { devices: left.devices.map((x) => x.name) });

console.log('\n' + '='.repeat(78));
console.log(`  COST   ${rebuildMs} ms  (4→2 reduce, 2 devices migrated, ${timings.length} steps)`);
for (const t of timings) console.log(`         ${String(t.ms).padStart(5)} ms  ${t.step}`);
console.log(`  UNDO   ${reachedStart ? `${undone} steps for one rebuild` : `> ${undone} steps (not bottomed out)`}`);
console.log(`  ATOMIC ${broken.length} intermediate state(s) with both containers present`);
console.log('='.repeat(78));
console.log('');
if (undone > 1) {
  note('⚠⚠ UNDO IS THE REAL REGRESSION, and it is not a footnote. A rebuild is many');
  note('   operations and Bitwig gives each its own undo step, so the user\'s single Cmd-Z');
  note('   does NOT undo "the take change" — it lands mid-migration. Under the TRACK model a');
  note('   branch is one op and one Cmd-Z, which is the comparison that matters.');
  note('⚠ Not fatal by itself: the operator\'s bar is "it doesn\'t need to be perfect".');
  note('  But it is a per-use cost the track model does not have, and it is invisible until');
  note('  the user hits undo once.');
}

console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} checks reported a negative — read individually`);
process.exit(0);
