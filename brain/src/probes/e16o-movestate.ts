/**
 * E16 §3.1, act 2 — the two questions `e16n`'s ● immediately raises.
 *
 * `e16n` established that `InsertionPoint.moveDevices` relocates an existing
 * top-level device into a layer chain, overturning E4d route 3. That is only
 * useful if two further things hold, and neither follows from it:
 *
 *   O1  ⚠ **Does the moved device keep its STATE?** This is the whole point.
 *       The A/B use case is *"take the patch the human has been working on and
 *       put it in chain 0"* — if relocation resets the device, or hands back a
 *       fresh instance of the same type, the capability is worthless for the one
 *       job it was reopened for. Nothing in `e16n` tested a single parameter;
 *       it counted devices by name, and two Polysynths look alike.
 *
 *   O2  Can `moveDevices` CREATE a chain, rather than only fill one that already
 *       exists? E4d's residual gap says layer-type containers cannot grow:
 *       FX Layer ships with 1 and will not grow, and Instrument/Note FX Layer
 *       and the Selectors ship with 0 and cannot be seeded. That gap was
 *       established against duplicate/copy/insert — ⚠ **`moveDevices` was not
 *       among them**, and today is the second time in one sitting that an
 *       untried verb on this interface has behaved differently from its
 *       siblings.
 *
 * ### ⚠ What O2 does and does not decide
 *
 * A ○ on O2 does NOT close the chain-selector route, and it would be easy to
 * read it that way. The structure can still come from a `.bwpreset` — E4d route
 * 4 materialises arbitrary multi-chain structure in one 268ms call, and shipping
 * a preset library is already the decided posture. What `e16n` unlocked is the
 * half that presets never could: **the CONTENT of a chain can now be the user's
 * own device, carrying its own state**, where before only a freshly-inserted
 * one could go there. O2 asks whether the preset dependency can be dropped too;
 * O1 asks whether the thing that was unlocked actually works.
 *
 * ⇒ **O1 is the load-bearing one.** O2 is completeness.
 *
 * ⚠ E4e's architectural answer predicts O2 ○, and predicts it for a REASON
 * rather than from observation: an `InsertionPoint` must bind to a referent, and
 * "layer 3" has no referent until it exists, so there is nothing to hand back.
 * That reasoning is unaffected by which verb is called on the insertion point,
 * which is exactly why O2 is cheap completeness rather than a live hypothesis.
 * Recorded either way.
 *
 * Silent: structural device ops only, nothing is ever launched. Runs on `gn-A`
 * and clears its device chain before and after. Safe on a non-TTY.
 */
import { client, check, note, failureCount, pollUntil, point, ensureFixtureTracks } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const MECH = 'trackThenSlot';
const FX_LAYER = 'a0913b7f-096b-4ac9-bddd-33c775314b42';
const NOTE_FX_LAYER = '96456481-4c52-423a-8485-4604b15d0183';
const INSTRUMENT_LAYER = '5024be2e-65d6-4d40-bbfe-8b2ea993c445';
const INSTRUMENT_SELECTOR = '9588fbcf-721a-438b-8555-97e4231f7d2c';
const POLYSYNTH = 'a9ffacb5-33e9-4fc7-8621-b1af31e410ef';

const DEVICE_SETTLE = 800;
const LAYER_SETTLE = 600;
const near = (a: number, b: number, eps = 0.02) => Math.abs(a - b) <= eps;

type DevList = { count: number; devices: { index: number; name: string }[] };
type LayerList = {
  count: number;
  layers: { index: number; name: string; devices: { index: number; name: string }[] }[];
};
type ParamList = {
  params: { id: string; exists: boolean; name?: string; value?: number; displayed?: string }[];
  total: number; existing: number; deviceExists: boolean; deviceName: string;
};

const devList = async () => (await req('device.list', { cursor: '0' })) as DevList;
const params = async () => (await req('param.list')) as ParamList;
const names = (l: DevList) => l.devices.map((d) => d.name);
const layerDevNames = (l: LayerList) => (l.layers[0]?.devices ?? []).map((d) => d.name);

/**
 * ⚠ **`rig.layerBank0` follows `cursorDevice0`, and this binds the WRITE as well
 * as the read.** `layer.list` and `layer.moveDeviceInto` both reach the
 * destination through that one bank, so the container has to be the selected
 * device at the moment either is called.
 *
 * ⚠ This ate the first run of this probe and the failure is worth recording,
 * because it is the exact shape of a false negative. O1 selects the *Polysynth*
 * to mark its parameters, and the move that followed then resolved
 * `layerBank0.getItemAt(0)` against a Polysynth — which has no layers — so the
 * insertion point had no referent and did nothing. The transcript read
 * `layer 0 now holds [—]`, i.e. **exactly what a genuine API refusal looks
 * like**, and a probe without the precondition check below would have written up
 * "relocation loses state" as a finding when nothing had been relocated at all.
 */
async function selectContainer(containerIndex: number): Promise<{ name: string; hasLayers: boolean }> {
  await req('devcursor.selectAt', { deviceIndex: containerIndex });
  await wait(LAYER_SETTLE);
  const n = (await req('device.nesting')) as { name: string; hasLayers: boolean };
  return { name: n.name, hasLayers: n.hasLayers };
}

async function layersOfContainer(containerIndex: number): Promise<LayerList> {
  await selectContainer(containerIndex);
  return (await req('layer.list')) as LayerList;
}

/**
 * Move a device into a container's layer chain, with the cursor precondition
 * asserted rather than assumed. Returns what the destination actually was.
 */
async function moveInto(containerIndex: number, layerIndex: number, deviceIndex: number) {
  const on = await selectContainer(containerIndex);
  check(`the layer-bank cursor is on a container with layers before the move `
    + `(it is on "${on.name}", hasLayers=${on.hasLayers})`,
    on.hasLayers,
    { cursorDevice: on.name, hasLayers: on.hasLayers,
      why: 'layerBank0 follows cursorDevice0; aimed at a device with no layers, the move is a '
        + 'silent no-op indistinguishable from a refusal' });
  await req('layer.moveDeviceInto', { layerIndex, deviceIndex });
  await wait(DEVICE_SETTLE);
  return on;
}

async function clearDevices(): Promise<boolean> {
  let l = await devList();
  for (let guard = 0; guard < 12 && l.count > 0; guard++) {
    await req('device.delete', { cursor: '0', deviceIndex: l.devices[0]!.index });
    await pollUntil(async () => (await devList()).count < l.count, 6000, 100);
    l = await devList();
  }
  return l.count === 0;
}

async function insertTop(uuid: string): Promise<void> {
  const before = (await devList()).count;
  await req('device.insertBitwig', { cursor: '0', uuid });
  const ok = await pollUntil(async () => (await devList()).count === before + 1, 10000, 100);
  if (!ok.ok) throw new Error('device insert never appeared');
  await wait(DEVICE_SETTLE);
}

await client.connect();
console.log('connected\n');
const { trackA } = await ensureFixtureTracks();
await point('0', trackA, 0, MECH);

// ==========================================================================
// O1 — does a relocated device carry its STATE?
// ==========================================================================
console.log('-- O1: does the moved device keep its parameter state?');
check('gn-A cleared before O1', await clearDevices(), {});

await insertTop(FX_LAYER);
await insertTop(POLYSYNTH);

// Point at the Polysynth and give it a state a fresh instance would not have.
await req('devcursor.selectAt', { deviceIndex: 1 });
await wait(LAYER_SETTLE);
const before = await params();
check('the top-level Polysynth exposes parameters to mark',
  before.deviceExists && before.existing > 0,
  { device: before.deviceName, existing: before.existing });

/**
 * ⚠ Marked on TWO parameters, not one. A single value could coincide with a
 * fresh instance's default and read as "state survived" when the device was
 * silently replaced. Each is driven to the far side of its current value, so
 * neither mark can be the default it started from.
 */
const marks: { id: string; want: number }[] = [];
for (const p of before.params.filter((x) => x.exists).slice(0, 2)) {
  const want = (p.value ?? 0) > 0.5 ? 0.17 : 0.83;
  await req('param.set', { id: p.id, value: want });
  marks.push({ id: p.id, want });
}
await wait(400);
const marked = await params();
for (const m of marks) {
  const got = marked.params.find((x) => x.id === m.id)?.value;
  check(`mark landed on ${m.id} before the move (readback ${got?.toFixed(3)})`,
    got !== undefined && near(got, m.want), { id: m.id, want: m.want, got });
}
note(`marked: ${marks.map((m) => `${m.id}=${m.want}`).join(', ')}`);

// Move it in. ⚠ `moveInto` re-selects the FX Layer first — the marking above
// left `cursorDevice0` on the Polysynth, and the destination bank follows it.
const poly = (await devList()).devices.findIndex((d) => d.name === 'Polysynth');
await moveInto(0, 0, poly);

const nested = await layersOfContainer(0);
note(`layer 0 now holds [${layerDevNames(nested).join(', ') || '—'}]; `
  + `top level [${names(await devList()).join(', ')}]`);
const moved = layerDevNames(nested).includes('Polysynth');
check('O1 precondition — the device did relocate (e16n reproduced)', moved,
  { layer: layerDevNames(nested) });

/**
 * ⚠ Read through the NESTED cursor, which is a different handle from the one
 * that wrote the marks (standing rule 3a / D15). Bitwig's cursors cache what you
 * wrote to them and report it back whether or not it landed; two spike findings
 * were wrong for exactly this reason. `selectFirstInLayer` descends into the
 * chain, so this read genuinely comes from where the device now lives.
 */
await req('devcursor.selectFirstInLayer', { layerIndex: 0 });
await wait(LAYER_SETTLE);
const after = await params();
note(`nested cursor is on "${after.deviceName}", ${after.existing} params exist`);

let survived = moved && after.deviceExists;
for (const m of marks) {
  const got = after.params.find((x) => x.id === m.id)?.value;
  const ok = got !== undefined && near(got, m.want);
  if (!ok) survived = false;
  check(`O1: ${m.id} survived the move (want ${m.want}, got ${got?.toFixed(3)})`,
    ok, { id: m.id, want: m.want, got, readThrough: 'the nested cursor, not the writing one' });
}

console.log('');
console.log(`   ⇒ O1: a relocated device ${survived ? 'KEEPS' : 'DOES NOT KEEP'} its state.`);
if (survived) {
  console.log('      ⇒ the A/B use case is real: the human\'s own patch can be moved into a chain.');
} else {
  console.log('      ⚠ ⇒ moveDevices is NOT usable for the job it was reopened for. The device');
  console.log('        arrives reset or replaced, so the chain would hold a stranger.');
}

// ==========================================================================
// O2 — can moveDevices CREATE a chain?
// ==========================================================================
/**
 * Two shapes of the same question: seed a container that ships with ZERO chains,
 * and grow one that ships with exactly one. Both target a `layerIndex` that does
 * not currently exist.
 *
 * ⚠ Calling an insertion point whose referent does not exist is the one place
 * this probe takes a risk, so it is worth saying why it is an acceptable one:
 * `InsertionPoint`'s own javadoc specifies the no-op ("Some things may not make
 * sense to insert in which case nothing happens"), and E4d already drove
 * duplicate/copy/insert at these same non-existent layers without incident. The
 * hazard class that killed Bitwig was a `Signal.fire()` on document state
 * (E14-A1), which is not this.
 */
console.log('\n-- O2: can moveDevices CREATE a chain, or only fill an existing one?');

interface SeedResult { container: string; shipped: number; targetIndex: number; after: number }
const seeds: SeedResult[] = [];

for (const [label, uuid, targetIndex] of [
  ['Instrument Selector', INSTRUMENT_SELECTOR, 0],
  ['Instrument Layer', INSTRUMENT_LAYER, 0],
  ['Note FX Layer', NOTE_FX_LAYER, 0],
  ['FX Layer (grow to a 2nd chain)', FX_LAYER, 1],
] as const) {
  await clearDevices();
  await insertTop(uuid);
  await insertTop(POLYSYNTH);

  const shipped = (await layersOfContainer(0)).count;
  const polyAt = (await devList()).devices.findIndex((d) => d.name === 'Polysynth');

  // ⚠ `moveInto`'s precondition asserts `hasLayers`, which is the CAPABILITY
  // flag and not the chain count — E4c's own lesson is that `hasLayers=true`
  // does not imply a layer exists, and all four of these report true while three
  // ship zero chains. So the assertion is about the cursor being where we think
  // it is, and it does not encode this phase's hypothesis. The counts below are
  // the reading.
  await moveInto(0, targetIndex, polyAt);

  const post = await layersOfContainer(0);
  seeds.push({ container: label, shipped, targetIndex, after: post.count });
  note(`${label}: ships ${shipped} chain(s); after moveDevices into layer `
    + `${targetIndex} it has ${post.count}`);
}

console.log('');
const anyGrew = seeds.some((s) => s.after > s.shipped);
for (const s of seeds) {
  console.log(`   ⇒ O2 ${s.container}: ${s.shipped} -> ${s.after} chains `
    + `${s.after > s.shipped ? '● GREW' : '○ unchanged'}`);
}
check('O2 is READABLE — every container reported a chain count both before and after '
  + '(about the instrument, not the answer)',
  seeds.length === 4 && seeds.every((s) => Number.isInteger(s.after)),
  { seeds });

console.log('');
console.log(anyGrew
  ? '   ⚠ ● A CONTAINER GREW A CHAIN — E4d\'s residual gap is BREACHED, and E4e\'s '
    + 'architectural reasoning needs revisiting.'
  : '   ○ No container grew. E4d\'s residual gap STANDS, now against a fourth verb, and '
    + 'E4e\'s "an InsertionPoint must bind to a referent" survives its best test. '
    + 'Multi-chain structure still comes from a .bwpreset (route 4).');

// ==========================================================================
// cleanup
// ==========================================================================
console.log('\n-- cleanup');
const cleared = await clearDevices();
check('gn-A device chain cleared — the fixture track is back as found', cleared,
  { remaining: (await devList()).count });

console.log('');
console.log('=== SUMMARY FOR THE WRITE-UP ===');
console.log(`  O1  relocated device ${survived ? 'KEEPS ● ' : 'LOSES ○ '} its state `
  + `(${marks.map((m) => m.id).join(', ')} checked through the nested cursor)`);
for (const s of seeds) {
  console.log(`  O2  ${s.container}: ${s.shipped} -> ${s.after}`);
}

console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} FAILURES`);
process.exit(failureCount() === 0 ? 0 : 1);
