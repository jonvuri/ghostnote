/**
 * E18 §3.4 — ⚠⚠ do MODULATOR ROUTINGS survive a relocation?
 *
 * The scariest item on §3.1's owed list, and the reason is the failure mode rather
 * than the probability: **cross-device modulation may break SILENTLY**. A take that
 * comes back with its filter no longer moving, and no error anywhere, is worse than
 * one that fails loudly.
 *
 * ⚠ **The first attempt was BLOCKED, and the blocker is now fixed.** An offline read
 * showed every modulator fixture on disk carries `routes=0` — they modulate nothing,
 * because they were built for `bwmod` FORMAT work where the question was whether a
 * modulator LOADS. A probe on those would compare 0 against 0 before and after and
 * report "modulation survived". `src/tools/build-e18-modfixture.ts` builds a real
 * one: a routed donor aimed at `CONTENTS/F1FREQ` at amount 1.0.
 *
 * ⚠ **And the oracle changed too.** Liveness used to be readable only through
 * `remote.list`, which exposes the 8 controls of the SELECTED remote page — so
 * answering "is this parameter modulated" meant guessing the page. `param.list` now
 * carries `modulatedValue` beside `value` for all 16 named handles, so the question
 * is a direct comparison on `F1FREQ`, the same parameter `e18c` marks for state.
 *
 * ### The three relocations, each the one a rebuild actually performs
 *
 * | leg | move | rebuild step it models |
 * |---|---|---|
 * | 1 | top level → chain `A0` | the human's patch being taken into a take container |
 * | 2 | chain `A0` → chain `B0`, ⚠ **different containers** | **reduce** |
 * | 3 | chain `B0` → top level | **collapse** |
 *
 * ### ⚠ Why this refuses rather than reports, in two places
 *
 * 1. ⚠ **The fixture must PROVE it modulates before anything moves.** An LFO
 *    oscillates through zero, so a single read can catch it at a crossing and look
 *    dead. Every measurement samples repeatedly and takes the **maximum** absolute
 *    divergence, and the probe ABORTS unless the baseline clears a floor well above
 *    the 0.002 E11e saw on a live route. ⚠ **Without that gate every later ● is
 *    unfalsifiable** — 0 before and 0 after "agrees" perfectly.
 * 2. Two fixtures are tried and the better one wins. Whether a modulator RUNS at
 *    rest is not knowable offline (an LFO free-runs; a Vibrato may want voices), so
 *    the choice is measured rather than guessed.
 *
 * ⚠ Typed-only. The transport is never started — if modulation needs it, the
 * baseline gate fails and the probe says so instead of quietly measuring nothing.
 */
import { existsSync } from 'node:fs';
import { client, check, note, failureCount, pollUntil } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const TRACK = 'gn-B';
const FX_LAYER = 'a0913b7f-096b-4ac9-bddd-33c775314b42';
const FIXTURES = [
  '/Users/jonvuri/Development/ghostnote/brain/fixtures/Polysynth/gn_mod_lfo-sampler.bwpreset',
  '/Users/jonvuri/Development/ghostnote/brain/fixtures/Polysynth/gn_mod_vibrato-poly.bwpreset',
];
const PARAM = 'F1FREQ';
/**
 * ⚠ A fixture with NO route, used as the NEGATIVE CONTROL that sets the floor.
 *
 * An offline read shows `routes=0` on this preset — its LFO modulates nothing — so
 * it measures what "not modulated" reads like on this exact instrument.
 */
const UNROUTED = '/Users/jonvuri/Development/ghostnote/brain/fixtures/Polysynth/mp_one_lfo.bwpreset';
/**
 * ⚠⚠ The floor is MEASURED, not asserted, and the first draft got this wrong.
 *
 * It originally hard-coded 0.01 "safely above noise". A live check then showed the
 * authored fixture swinging only ±0.0036 around a static value — real, repeatable
 * modulation that the gate would have thrown away as "no fixture modulates", turning
 * a working instrument into a false blocker.
 *
 * ⚠ The right floor is empirical: when a parameter is genuinely unmodulated,
 * `modulatedValue` equals `value` **exactly** (measured — the unrouted fixtures read
 * 0.00000 divergence, not "small"). So the discrimination is not "big vs small", it
 * is **non-zero vs exactly zero**, and this constant only has to clear read jitter.
 * The negative-control arm proves that in the same sitting rather than trusting it.
 */
const FLOOR = 0.0005;
const SAMPLES = 12;

interface TrackRow { index: number; name: string; channelId: string }
interface DevList { devices: { index: number; name: string }[]; count: number }
interface ChainRow { index: number; name: string; devices: { index: number; name: string }[] }
interface Scope { slot: number; status: string; deviceName: string; chains: ChainRow[] }
interface Inventory { scopes: Scope[]; trackName: string }
interface LayerList { layers: ChainRow[]; count: number }
interface ParamRow { id: string; exists: boolean; value?: number; modulatedValue?: number | string }
interface ParamList { params: ParamRow[]; existing: number; deviceExists: boolean; deviceName: string }

const trackList = async () => ((await req('track.list')) as { tracks: TrackRow[] }).tracks;
let subject!: TrackRow;

async function bail(message: string): Promise<never> {
  console.log(`\n⚠⚠⚠ ABORTING: ${message}`);
  process.exit(1);
}

async function pointSubject(): Promise<void> {
  const row = (await trackList()).find((t) => t.channelId === subject.channelId);
  if (!row) await bail(`"${TRACK}" is gone.`);
  await req('cursor.pointTrack', { cursor: '0', trackIndex: row!.index });
  await wait(650);
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

/**
 * ⚠ Maximum |modulatedValue − value| over repeated samples.
 *
 * An LFO crosses zero, so ONE read can catch a live modulation looking dead. The
 * max over a spread of samples is the honest statistic: it can only be small if the
 * modulation really is small (or absent) throughout the window.
 */
async function divergence(tag: string): Promise<{ max: number; value: number; device: string }> {
  let max = 0;
  let value = Number.NaN;
  let device = '';
  for (let i = 0; i < SAMPLES; i++) {
    const p = (await req('param.list')) as ParamList;
    device = p.deviceName;
    const row = p.params.find((x) => x.id === PARAM && x.exists);
    if (row && typeof row.modulatedValue === 'number' && typeof row.value === 'number') {
      max = Math.max(max, Math.abs(row.modulatedValue - row.value));
      value = row.value;
    } else if (row && typeof row.modulatedValue === 'string') {
      await bail(`${tag}: modulatedValue read as an ERROR string ("${row.modulatedValue}") — `
        + 'the handle is not marked, so this probe cannot measure anything.');
    } else if (row?.exists && row.modulatedValue === undefined) {
      // ⚠ The field is ABSENT, which means the OLD jar is loaded. Left unhandled
      // this reads as zero divergence everywhere and the probe would blame the
      // fixture for a deployment problem — the wrong suspect entirely.
      await bail(`${tag}: param.list carries no modulatedValue field. That is the pre-E18 jar; `
        + 'reload the controller and re-run.');
    }
    await wait(90);
  }
  return { max, value, device };
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

/** Put the device cursor ON the Polysynth, wherever it currently lives. */
async function focusPoly(where: 'top' | { slot: number; layer: number }, tag: string): Promise<void> {
  if (where === 'top') {
    const d = await devs();
    const at = d.devices.find((x) => x.name === 'Polysynth');
    if (!at) await bail(`${tag}: no Polysynth at top level.`);
    await req('devcursor.selectAt', { deviceIndex: at!.index });
  } else {
    await scopeCursor(where.slot, tag);
    await req('devcursor.selectFirstInLayer', { layerIndex: where.layer });
  }
  await wait(900);
  const s = (await req('devcursor.status')) as { exists: boolean; name: string };
  if (!s.exists || s.name !== 'Polysynth') {
    await bail(`${tag}: the device cursor is on "${s.name}" (exists=${s.exists}), not the Polysynth. `
      + 'Every reading below would be of the wrong device.');
  }
}

const inventory = async () => (await req('chain.inventory')) as Inventory;
const showInv = (inv: Inventory) => inv.scopes
  .map((s) => `${s.slot}:${s.deviceName || '—'}{${s.chains.map((c) => `${c.name}[${c.devices.map((d) => d.name).join('+') || '—'}]`).join(' ') || '—'}}`)
  .join('  ');

// ==========================================================================
console.log('');
console.log('='.repeat(78));
console.log(' E18 §3.4 — do MODULATOR ROUTINGS survive a relocation?');
console.log('='.repeat(78));

await client.connect();
const hello = (await req('contract.hello')) as { methodsHash: string; methodCount: number };
note(`wire: ${hello.methodCount} methods, methodsHash ${hello.methodsHash}`);

for (const f of FIXTURES) {
  if (!existsSync(f)) {
    console.log(`⚠⚠ REFUSING: ${f} is missing. Run: npx tsx src/tools/build-e18-modfixture.ts`);
    process.exit(1);
  }
}

const hits = (await trackList()).filter((t) => t.name === TRACK);
if (hits.length !== 1) { console.log(`⚠⚠ REFUSING: ${hits.length} tracks named "${TRACK}".`); process.exit(1); }
subject = hits[0]!;
await pointSubject();

async function clearTrack(): Promise<void> {
  await pointSubject();
  let d = await devs();
  for (let g = 0; g < 14 && d.count > 0; g++) {
    await req('device.delete', { cursor: '0', deviceIndex: d.devices[0]!.index });
    await pollUntil(async () => (await devs()).count < d.count, 6000, 200);
    d = await devs();
  }
}

// --------------------------------------------------------------------------
// PART 0 — which fixture actually modulates? Measured, not guessed.
// --------------------------------------------------------------------------
console.log('\n' + '-'.repeat(78));
console.log(` PART 0 — establish the FLOOR, then pick the fixture that MODULATES ${PARAM}`);
console.log('-'.repeat(78));

/**
 * ⚠ The NEGATIVE CONTROL first, because it defines what "not modulated" reads like.
 * Its route count is 0 offline, so any divergence here is pure instrument noise —
 * and if it is not ~0, the oracle itself is untrustworthy and nothing below counts.
 */
await clearTrack();
await req('device.insertFile', { cursor: '0', path: UNROUTED });
await pollUntil(async () => (await devs()).count === 1, 12000, 200);
await wait(700);
await focusPoly('top', 'negative control');
const floorMeasured = await divergence('negative control');
console.log(`   NEGATIVE CONTROL (routes=0)          max divergence ${floorMeasured.max.toFixed(6)}`);
check('⚠ GATE: an UNROUTED modulator reads ~zero divergence — the oracle has no noise',
  floorMeasured.max < FLOOR, { measured: floorMeasured.max, floor: FLOOR });
if (floorMeasured.max >= FLOOR) {
  await bail('the negative control diverges, so `modulatedValue` moves even with no route. '
    + 'Every "modulation survived" below would be unfalsifiable. The oracle is broken.');
}

let chosen = '';
let baseline = 0;
for (const path of FIXTURES) {
  await clearTrack();
  await req('device.insertFile', { cursor: '0', path });
  await pollUntil(async () => (await devs()).count === 1, 12000, 200);
  await wait(700);
  await focusPoly('top', 'part 0');
  const d = await divergence('part 0');
  const name = path.split('/').pop()!;
  console.log(`   ${d.max > FLOOR ? '●' : '○'} ${name.padEnd(34)} max divergence ${d.max.toFixed(5)}  (value ${d.value.toFixed(4)})`);
  if (d.max > baseline) { baseline = d.max; chosen = path; }
}

check(`⚠ GATE: a fixture modulates ${PARAM} measurably (max ${baseline.toFixed(5)} > ${FLOOR})`,
  baseline > FLOOR, { baseline, floor: FLOOR, chosen: chosen.split('/').pop() });
if (baseline <= FLOOR) {
  console.log('');
  console.log('⚠⚠ REFUSING TO MEASURE THE RELOCATION. Neither fixture produced divergence above the');
  console.log('   noise floor, so "modulation survived a move" would be 0 compared against 0 —');
  console.log('   unfalsifiable, and exactly the false ● this probe was rebuilt to avoid.');
  console.log('   ⚠ NOT a finding about relocation. The instrument is not ready.');
  console.log('   Next: the modulator may need voices or a rolling transport, which makes this a');
  console.log('   foreground/audible arm rather than a silent one — arrange it with the operator.');
  await clearTrack();
  process.exit(1);
}
note(`⇒ using ${chosen.split('/').pop()}, baseline divergence ${baseline.toFixed(5)}`);

// --------------------------------------------------------------------------
// The fixture: the modulating Polysynth at top level, plus two containers.
// --------------------------------------------------------------------------
console.log('\n-- fixture: two containers plus the modulating Polysynth');
await clearTrack();
for (const uuid of [FX_LAYER, FX_LAYER]) {
  const before = (await devs()).count;
  await req('device.insertBitwig', { cursor: '0', uuid });
  await pollUntil(async () => (await devs()).count === before + 1, 12000, 200);
  await wait(400);
}
for (const [slot, tag] of [[0, 'A'], [1, 'B']] as const) {
  await scopeCursor(slot, `name ${tag}`);
  await req('layer.setName', { layerIndex: 0, name: `${tag}0` });
  await wait(250);
}
await req('device.insertFile', { cursor: '0', path: chosen });
await pollUntil(async () => (await devs()).count === 3, 12000, 200);
await wait(700);
note(`built: ${showInv(await inventory())}  top=[${(await devs()).devices.map((x) => x.name).join(', ')}]`);

const legs: { leg: string; max: number; live: boolean }[] = [];
async function measure(leg: string, where: 'top' | { slot: number; layer: number }): Promise<void> {
  await focusPoly(where, leg);
  const d = await divergence(leg);
  const live = d.max > FLOOR;
  legs.push({ leg, max: d.max, live });
  console.log(`   ⇒ ${live ? '●● STILL MODULATING' : '○  MODULATION GONE'}   max ${d.max.toFixed(5)}   (${leg})`);
}

// --------------------------------------------------------------------------
console.log('\n' + '-'.repeat(78));
console.log(' LEG 1 — top level → chain A0 (the human\'s patch entering a take container)');
console.log('-'.repeat(78));
await scopeCursor(0, 'leg 1');
const polyAt = (await devs()).devices.find((x) => x.name === 'Polysynth')!;
await req('layer.moveDeviceInto', { layerIndex: 0, deviceIndex: polyAt.index });
await pollUntil(async () => (await devs()).count === 2, 8000, 250);
await wait(600);
note(`after: ${showInv(await inventory())}`);
await measure('in chain A0', { slot: 0, layer: 0 });

console.log('\n' + '-'.repeat(78));
console.log(' LEG 2 — ⚠ chain A0 → chain B0, ACROSS containers: the REDUCE step');
console.log('-'.repeat(78));
await req('chain.move', { srcSlot: 0, srcLayer: 0, srcDevice: 0, dst: 'chain', dstSlot: 1, dstLayer: 0, verb: 'move' });
await pollUntil(async () => {
  const inv = await inventory();
  return (inv.scopes[1]?.chains[0]?.devices.length ?? 0) > 0;
}, 8000, 250);
await wait(600);
note(`after: ${showInv(await inventory())}`);
await measure('in chain B0, after crossing containers', { slot: 1, layer: 0 });

console.log('\n' + '-'.repeat(78));
console.log(' LEG 3 — ⚠ chain B0 → TOP LEVEL: the COLLAPSE step');
console.log('-'.repeat(78));
await req('chain.move', { srcSlot: 1, srcLayer: 0, srcDevice: 0, dst: 'top', where: 'chainEnd', verb: 'move' });
await pollUntil(async () => (await devs()).count === 3, 8000, 250);
await wait(600);
note(`after: ${showInv(await inventory())}  top=[${(await devs()).devices.map((x) => x.name).join(', ')}]`);
await measure('back at top level', 'top');

// --------------------------------------------------------------------------
console.log('\n-- cleanup');
await clearTrack();
check(`${TRACK} is empty again`, (await devs()).count === 0, {});

console.log('\n' + '='.repeat(78));
console.log(`  baseline (before any move): ${baseline.toFixed(5)}`);
for (const l of legs) console.log(`  ${l.live ? '●●' : '○ '}  ${l.max.toFixed(5)}  ${l.leg}`);
console.log('='.repeat(78));
console.log('');

const allLive = legs.every((l) => l.live);
const anyLost = legs.some((l) => !l.live);
for (const l of legs) {
  check(`modulation survived: ${l.leg}`, l.live, { max: l.max, floor: FLOOR });
}
if (allLive) {
  note('⚠⚠ MODULATION SURVIVES ALL THREE RELOCATIONS, including across containers and back');
  note('   out to top level. The silent-breakage risk §3.1 flagged does NOT materialise for a');
  note('   modulator that lives on the device being moved.');
  note('⚠ SCOPE, stated so this is not over-read: this measures a modulator ON the relocated');
  note('  device, routed to its OWN parameter. It does NOT measure a modulator on the OUTER');
  note('  CONTAINER routed into a chain (E11e\'s cross-device form), whose Ramona path encodes');
  note('  a device INDEX — that path is the one a rebuild could renumber, and it is still owed.');
} else if (anyLost) {
  note('⚠⚠ MODULATION IS LOST BY A RELOCATION, and the leg above names which one.');
  note('   This is the silent failure §3.1 feared: nothing errored, the device moved, and the');
  note('   modulation simply stopped. ⇒ any rebuild must re-establish routings by hand, and');
  note('   there is no API to read a routing back — so the take system would have to own the');
  note('   modulator topology itself. That is a materially bigger commitment.');
}

console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} checks reported a negative — read individually`);
process.exit(0);
