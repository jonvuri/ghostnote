/**
 * E17 rows 2+3 — the TYPED verbs, rebuilt from scratch on a fresh target.
 *
 * ⚠ **Why, even though these ○s are structurally immune to the focus faults.**
 * Every correction this spike found lives in the NAMED-ACTION dispatch path
 * (focus). A typed call never consults the UI selection, so `e17b`/`e17c` could not
 * have fallen to any of it. But neither was ever re-run, `e17b`'s stale-read guard
 * polls a device NAME rather than `trackPosition`, and these two ○s are what the
 * whole "only named actions can create or destroy a chain" claim rests on.
 *
 * ⚠⚠ **RE-EXAMINING THE ASSUMPTIONS TURNED UP A REAL PROBLEM, before any re-run.**
 * Reading the handlers:
 *
 *     layerInsertViaCursor →  rig.cursorLayer0.endOfDeviceChainInsertionPoint()
 *     layerInsertAtStart   →  layer.startOfDeviceChainInsertionPoint()
 *
 * Both insertion points hang off **a CHAIN**, so both insert a DEVICE INTO AN
 * EXISTING CHAIN. ⚠ **Neither could ever have created a chain**, whatever the
 * result. `e17c` scored them ○ for chain creation, which is trivially true and
 * tells us nothing about the capability. Worse, `cursorLayer0` is now known to
 * track the *current chain selection* (`e17u`/`e17v`) — so "the container-scoped
 * cursor" was never container-scoped at all; it points at a LAYER.
 *
 * ⇒ Row 3's typed ○ actually rests on TWO things, and only one is a measurement:
 *   (a) ⚠ an ENUMERATION — no `InsertionPoint` in the API hangs off a container
 *       `Device` (11 sources, none of them a container). A doc pass, and rule 10
 *       says a doc pass alone does not establish a ○.
 *   (b) the DUPLICATION verbs refuse — `e17b`, a real measurement.
 *
 * So (b) is load-bearing for both rows, and it is what this probe rebuilds.
 *
 * ⚠ **Also unguarded at the handler level:** `layerDuplicate` and
 * `layerDuplicateChannel` call `rig.layerBank0.getItemAt(i)` with **no
 * `requireLayer` check** — the e16o trap is not caught in Java, only by the probe
 * remembering to scope first. And both `return ok()` unconditionally, so a THROW
 * and a SILENT NO-OP were never distinguished. This probe distinguishes them.
 *
 * **Rebuilt with:**
 *   - a FRESH TARGET — `gn-B`, empty and untouched all session, never `gn-lay`
 *   - containers built by `device.insertBitwig` (typed), never `Group`
 *   - ⚠ FULL INVENTORY before and after every fire: all tracks by identity, the
 *     subject's devices, its chains, AND the devices inside each chain
 *   - ⚠ throw-vs-silence recorded explicitly
 *   - ⚠ the cursor asserted on the container immediately BEFORE and AFTER each call
 *   - a verb control in the same session
 *
 * Silent, typed-only: no named actions, no focus dependency, no priming, no
 * foreground requirement, and the transport is never touched.
 */
import { client, check, note, failureCount, pollUntil } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);

const TARGET = 'gn-B';
const FX_LAYER = 'a0913b7f-096b-4ac9-bddd-33c775314b42';
const INSTRUMENT_LAYER = '5024be2e-65d6-4d40-bbfe-8b2ea993c445';
const POLYSYNTH = 'a9ffacb5-33e9-4fc7-8621-b1af31e410ef';

interface TrackRow { index: number; name: string; type: string; channelId: string }
interface DevList { devices: { index: number; name: string }[]; count: number; itemCount: number }
interface LayerList {
  layers: { index: number; name: string; devices: { name: string }[] }[];
  count: number; cursorDeviceName?: string;
}

await client.connect();
const tracks0 = ((await req('track.list')) as { tracks: TrackRow[] }).tracks;
const matches = tracks0.filter((t) => t.name === TARGET);
if (matches.length !== 1) {
  console.log(`\n⚠⚠ REFUSING: ${matches.length} tracks named ${TARGET}.`);
  process.exit(1);
}
const target = matches[0]!;
const baseTrackIds = tracks0.map((t) => t.channelId).sort().join(',');

async function pointTarget(): Promise<void> {
  const now = ((await req('track.list')) as { tracks: TrackRow[] }).tracks;
  const t = now.find((x) => x.channelId === target.channelId);
  if (!t) { console.log('\n⚠⚠ ABORTING: the target track is GONE.'); process.exit(1); }
  await req('cursor.pointTrack', { cursor: '0', trackIndex: t.index });
  // ⚠ Poll the POSITION, not a device name — the guard `e17b` lacked.
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

/** ⚠ Scope AND assert. Returns the container's index so it can be re-asserted after. */
async function scopeTo(expect: RegExp, tag: string): Promise<number> {
  const d = await devs();
  const at = d.devices.findIndex((x) => expect.test(x.name));
  if (at < 0) {
    console.log(`\n⚠⚠ ABORTING at ${tag}: no container matching ${expect} —`
      + ` [${d.devices.map((x) => x.name).join(', ')}]`);
    process.exit(1);
  }
  await req('devcursor.selectAt', { deviceIndex: at });
  const ok = await pollUntil(async () => {
    const s = (await req('devcursor.status')) as { exists: boolean; name: string };
    return s.exists && expect.test(s.name);
  }, 6000, 150);
  if (!ok.ok) { console.log(`\n⚠⚠ ABORTING at ${tag}: cursor did not land on ${expect}.`); process.exit(1); }
  return at;
}

/** ⚠ FULL inventory — every level a typed verb could plausibly touch. */
interface Inv { trackIds: string; trackCount: number; devices: string[]; chains: string[]; inChain: number }
async function inventory(expect: RegExp, tag: string): Promise<Inv> {
  const t = ((await req('track.list')) as { tracks: TrackRow[] }).tracks;
  await pointTarget();
  const d = await devs();
  await scopeTo(expect, tag);
  const l = (await req('layer.list')) as LayerList;
  return {
    trackIds: t.map((x) => x.channelId).sort().join(','),
    trackCount: t.length,
    devices: d.devices.map((x) => x.name),
    chains: l.layers.map((x) => `${x.name}[${x.devices.map((y) => y.name).join('+') || '—'}]`),
    inChain: l.layers.reduce((n, x) => n + x.devices.length, 0),
  };
}
const show = (i: Inv) =>
  `tracks=${i.trackCount} devices=[${i.devices.join(',')}] chains=${i.chains.length} [${i.chains.join(' ')}] devicesInChains=${i.inChain}`;

interface Fired { label: string; threw: string | null; chainDelta: number; deviceDelta: number;
  inChainDelta: number; trackChanged: boolean }
const fired: Fired[] = [];

/**
 * Fire a TYPED verb and report every level. ⚠ Throw-vs-silence is recorded, because
 * the handlers `return ok()` unconditionally and the two were never distinguished.
 */
async function fire(label: string, method: string, params: Record<string, unknown>,
  expect: RegExp): Promise<Fired> {
  const before = await inventory(expect, `${label} before`);
  console.log(`\n  ${label}`);
  note(`   BEFORE ${show(before)}`);
  // ⚠⚠ THE e16o TRAP, guarded. `layerBank0.getItemAt(0)` on a container with ZERO
  // chains has no referent, and the resulting silence is byte-identical to an API
  // refusal. The first run of this probe fired two arms straight into it, because a
  // fresh Instrument Layer turns out to ship with no chains at all.
  if (/duplicate/.test(method) && before.chains.length === 0) {
    console.log('   ⚠⚠ REFUSING this arm: the container has ZERO chains, so `getItemAt(0)`');
    console.log('   has no referent and a no-op would be indistinguishable from a refusal.');
    const skipped: Fired = { label: `${label}  [SKIPPED: no referent]`, threw: null,
      chainDelta: 0, deviceDelta: 0, inChainDelta: 0, trackChanged: false };
    fired.push(skipped);
    return skipped;
  }
  // ⚠ Assert the cursor is on the container at the MOMENT of the call — neither
  // duplication handler checks this in Java (no `requireLayer`), so the e16o trap
  // is the probe's responsibility alone.
  const at = await scopeTo(expect, `${label} at-call`);
  const st = (await req('devcursor.status')) as { exists: boolean; name: string };
  note(`   cursor at call: device ${at} = ${JSON.stringify(st.name)} exists=${st.exists}`);

  let threw: string | null = null;
  try {
    await req(method, params);
  } catch (e) {
    threw = e instanceof Error ? e.message : String(e);
    note(`   ⚠ THE CALL THREW: ${threw}`);
  }
  // ⚠ Poll for ANY change at any level, not just chain growth — the blind spot that
  // let three earlier probes report "nothing happened" during a container duplication.
  await pollUntil(async () => {
    const now = await inventory(expect, `${label} poll`);
    return now.chains.length !== before.chains.length
      || now.devices.length !== before.devices.length
      || now.inChain !== before.inChain
      || now.trackIds !== before.trackIds;
  }, 4000, 300);
  const after = await inventory(expect, `${label} after`);
  note(`   AFTER  ${show(after)}`);
  const f: Fired = {
    label, threw,
    chainDelta: after.chains.length - before.chains.length,
    deviceDelta: after.devices.length - before.devices.length,
    inChainDelta: after.inChain - before.inChain,
    trackChanged: after.trackIds !== before.trackIds,
  };
  const bits = [
    `Δchains=${f.chainDelta}`, `Δdevices=${f.deviceDelta}`,
    `ΔdevicesInChains=${f.inChainDelta}`, f.trackChanged ? '⚠ TRACKS CHANGED' : '',
  ].filter(Boolean);
  console.log(`   ⇒ ${bits.join('  ')}   ${f.chainDelta > 0 ? '●● A CHAIN WAS CREATED'
    : f.inChainDelta > 0 ? '◐ a DEVICE landed (not a chain)'
      : f.deviceDelta > 0 ? '⚠ the CONTAINER was duplicated' : '○ nothing at any level'}`);
  if (f.trackChanged) { console.log('\n⚠⚠ ABORTING: a typed verb changed the TRACK LIST.'); process.exit(1); }
  fired.push(f);
  return f;
}

async function clearTarget(): Promise<void> {
  await pointTarget();
  for (let g = 0; g < 14; g++) {
    const d = await devs();
    if (d.count === 0) break;
    await req('device.delete', { cursor: '0', deviceIndex: d.devices[0]!.index });
    await pollUntil(async () => (await devs()).count < d.count, 4000, 200);
  }
}

// ==========================================================================
console.log('');
console.log('='.repeat(74));
console.log(` TYPED-VERB REBUILD on ${TARGET} — a fresh target, never used this session`);
console.log(' ⚠ Typed calls only. No named actions, no focus, no priming, no foreground.');
console.log('='.repeat(74));
await clearTarget();
check(`PRECONDITION: ${TARGET} starts EMPTY`, (await devs()).count === 0, {});

// ==========================================================================
console.log('\n======== FIXTURE 1 — a fresh FX Layer (ships with ONE EMPTY chain, E4c)');
await req('device.insertBitwig', { cursor: '0', uuid: FX_LAYER });
await pollUntil(async () => (await devs()).devices.some((d) => /FX Layer/.test(d.name)), 8000, 200);
const f1 = await inventory(/FX Layer/, 'fixture 1');
note(`${show(f1)}`);
check('PRECONDITION: the FX Layer has exactly one chain', f1.chains.length === 1, { chains: f1.chains });

await fire('R1  layer.duplicate      → DeviceLayer.duplicateObject()', 'layer.duplicate',
  { layerIndex: 0 }, /FX Layer/);
await fire('R2  layer.duplicateChannel → Channel.duplicate()', 'layer.duplicateChannel',
  { layerIndex: 0 }, /FX Layer/);

// ⚠ The insertion points, framed CORRECTLY this time. Both hang off a CHAIN, so the
// only honest question is "does a DEVICE land", not "does a CHAIN appear".
console.log('\n  ⚠ The next two insert into an EXISTING chain by construction — an');
console.log('    InsertionPoint hangs off a DeviceChain, never off a container Device.');
console.log('    A ◐ here is the CORRECT outcome and is the control for the ○s above.');
await fire('R3  layer.insertAtStart  → chain.startOfDeviceChainInsertionPoint()', 'layer.insertAtStart',
  { layerIndex: 0, uuid: POLYSYNTH }, /FX Layer/);
await fire('R4  layer.insertViaCursor → cursorLayer0.endOfDeviceChainInsertionPoint()', 'layer.insertViaCursor',
  { uuid: POLYSYNTH }, /FX Layer/);

// ==========================================================================
// ⚠ FIXTURE 2 is the SAME FX Layer, whose chain R3/R4 have now populated. The first
// run tried a fresh Instrument Layer instead and its precondition failed — see below.
console.log('\n======== FIXTURE 2 — the SAME chain, now POPULATED by R3/R4');
const f2 = await inventory(/FX Layer/, 'fixture 2');
note(`${show(f2)}`);
check('PRECONDITION: the chain now holds devices, so the populated case is real',
  f2.chains.length >= 1 && f2.inChain >= 1, { state: show(f2) });

await fire('R1  layer.duplicate       (POPULATED chain)', 'layer.duplicate',
  { layerIndex: 0 }, /FX Layer/);
await fire('R2  layer.duplicateChannel (POPULATED chain)', 'layer.duplicateChannel',
  { layerIndex: 0 }, /FX Layer/);

// ==========================================================================
// ⚠⚠ A NEW FINDING, and the reason the first run's fixture 2 failed: the two
// container types do not ship alike. E4c recorded "containers ship with zero chains";
// that is true of an Instrument Layer and FALSE of an FX Layer.
console.log('\n======== ⚠ SHIPPED SHAPE — do the two container types differ?');
await clearTarget();
await req('device.insertBitwig', { cursor: '0', uuid: INSTRUMENT_LAYER });
await pollUntil(async () => (await devs()).devices.some((d) => /Instrument Layer/.test(d.name)), 8000, 200);
const instShape = await inventory(/Instrument Layer/, 'shipped instrument layer');
note(`fresh Instrument Layer: ${instShape.chains.length} chain(s) ${instShape.chains.join(' ')}`);
await clearTarget();
await req('device.insertBitwig', { cursor: '0', uuid: FX_LAYER });
await pollUntil(async () => (await devs()).devices.some((d) => /FX Layer/.test(d.name)), 8000, 200);
const fxShape = await inventory(/FX Layer/, 'shipped fx layer');
note(`fresh FX Layer:         ${fxShape.chains.length} chain(s) ${fxShape.chains.join(' ')}`);
check('⚠ the two container types ship DIFFERENTLY — Instrument Layer 0 chains, FX Layer 1',
  instShape.chains.length === 0 && fxShape.chains.length === 1,
  { instrumentLayer: instShape.chains.length, fxLayer: fxShape.chains.length });
note('⚠ This is why the first run\'s fixture 2 was void: it fired duplication verbs at a');
note('  ZERO-chain Instrument Layer, where `getItemAt(0)` has no referent and silence is');
note('  indistinguishable from refusal (the e16o trap). Now guarded and SKIPPED instead.');

// ==========================================================================
console.log('\n======== VERB CONTROL — the SAME verbs on a DEVICE, in this session');
note('⚠ Without this, "the verb did nothing on a layer" cannot be told from');
note('  "the verb is dead right now". It is the whole reason the ○s mean anything.');
const cBefore = await devs();
await req('device.duplicate', { deviceIndex: 0 });
const cGrew = await pollUntil(async () => (await devs()).count > cBefore.count, 5000, 250);
const cAfter = await devs();
note(`   devices ${cBefore.count} -> ${cAfter.count}  [${cAfter.devices.map((d) => d.name).join(', ')}]  (${cGrew.ms} ms)`);
check('⚠ VERB CONTROL: `Device.duplicateObject()` DOES fire in this session',
  cGrew.ok, { before: cBefore.count, after: cAfter.count });

// ==========================================================================
console.log('\n-- cleanup');
await clearTarget();
const end = await devs();
const endTracks = ((await req('track.list')) as { tracks: TrackRow[] }).tracks;
check(`${TARGET} is empty again`, end.count === 0, { devices: end.devices.map((d) => d.name) });
check('the TRACK LIST is untouched', endTracks.map((t) => t.channelId).sort().join(',') === baseTrackIds,
  { before: tracks0.length, after: endTracks.length });

// ==========================================================================
console.log(`\n${'='.repeat(74)}`);
console.log(' TYPED VERBS — did any create a CHAIN?');
for (const f of fired) {
  const mark = f.chainDelta > 0 ? '●●' : f.inChainDelta > 0 ? '◐ ' : '○ ';
  console.log(`  ${mark} ${f.label.padEnd(58)} Δchains=${f.chainDelta} ΔinChain=${f.inChainDelta}`
    + `${f.threw ? '  ⚠ THREW' : ''}`);
}
console.log('='.repeat(74));
const dupRoutes = fired.filter((f) => /layer\.duplicate/.test(f.label));
const anyCreated = fired.some((f) => f.chainDelta > 0);
const insertsLanded = fired.filter((f) => /insert/.test(f.label) && f.inChainDelta > 0);
console.log('');
check('⚠⚠ ROW 2/3 REBUILT: no typed verb creates a chain', !anyCreated,
  { created: fired.filter((f) => f.chainDelta > 0).map((f) => f.label) });
check('⚠ and the duplication verbs are SILENT, not throwing — a refusal, not an error',
  dupRoutes.every((f) => f.threw === null), { threw: dupRoutes.filter((f) => f.threw).map((f) => f.label) });
check('⚠ CONTROL: the insertion points DID land a device — so the rig and the fixture work',
  insertsLanded.length > 0, { landed: insertsLanded.map((f) => f.label) });
note('');
if (!anyCreated && cGrew.ok && insertsLanded.length > 0) {
  note('⇒ ⚠ CONFIRMED on a fresh target, full inventory, cursor asserted at the moment of');
  note('  call, and throw-vs-silence recorded: **no typed verb creates a device chain.**');
  note('  The duplication verbs return silently; the insertion points land a DEVICE in an');
  note('  EXISTING chain, which is all an InsertionPoint hanging off a DeviceChain could');
  note('  ever do. ⇒ Chain create/destroy really is named-actions-only, and the human');
  note('  click is therefore a real limitation rather than a harness artifact.');
} else if (anyCreated) {
  note('⚠⚠ A TYPED VERB CREATED A CHAIN. Rows 2/3 are WRONG and the whole "named actions');
  note('  only" conclusion collapses — chain creation would be fully autonomous.');
}
console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} checks reported a negative — read individually`);
process.exit(0);
