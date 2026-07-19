/**
 * E4c — Device nesting: addressing INTO layered devices.
 *
 * The API sweep called this "device layers", but the surface is really FOUR
 * distinct nesting mechanisms, characterised here:
 *   1. layers        — hasLayers / createLayerBank / DeviceLayer  (FX Layer)
 *   2. drum pads     — hasDrumPads / createDrumPadBank            (Drum Machine)
 *   3. named slots   — hasSlots / slotNames / selectFirstInSlot
 *   4. chain selector— createChainSelector / activeChainIndex     (Selectors)
 *
 * Headline question: does `CursorDevice.selectFirstInLayer(i)` move the SAME
 * device cursor into a nested chain? If so, E4's param handles follow it down
 * and deep addressing needs no new machinery.
 *
 * Second question, discovered while probing: containers differ in how many
 * chains they SHIP with, and no *layer* can be added to a layer-type
 * container — see `e04c-diag` / `e04c-diag2` for the controlled trials
 * behind the expectations asserted below.
 *
 * ⚠ Do not read the layer findings here as "chains cannot be created" — that
 * generalisation was wrong. `e04d` establishes that drum pads, insertFile
 * and container duplication all create structure.
 *
 * Inserts and deletes containers on gn-A; restores fixtures.
 */
import {
  client, check, note, failureCount, pollUntil, point, ensureFixtureTracks,
} from './lib.js';

const MECH = 'trackThenSlot';
const FX_LAYER = 'a0913b7f-096b-4ac9-bddd-33c775314b42';
const NOTE_FX_LAYER = '96456481-4c52-423a-8485-4604b15d0183';
const INSTRUMENT_LAYER = '5024be2e-65d6-4d40-bbfe-8b2ea993c445';
const INSTRUMENT_SELECTOR = '9588fbcf-721a-438b-8555-97e4231f7d2c';
const POLYSYNTH = 'a9ffacb5-33e9-4fc7-8621-b1af31e410ef';
const near = (a: number, b: number, eps = 0.02) => Math.abs(a - b) <= eps;

type Nesting = {
  exists: boolean; name: string; hasLayers: boolean; hasDrumPads: boolean;
  hasSlots: boolean; isNested: boolean; slotNames: string[];
  cursorLayerExists: boolean; cursorLayerName: string;
};
type LayerList = {
  layers: { index: number; name: string; devices: { index: number; name: string }[] }[];
  count: number; hasLayers: boolean;
};
type ParamList = {
  params: { id: string; exists: boolean; name?: string; value?: number; displayed?: string }[];
  total: number; existing: number; deviceExists: boolean; deviceName: string;
};

const nesting = async () => (await client.request('device.nesting')) as Nesting;
const layers = async () => (await client.request('layer.list')) as LayerList;
const params = async () => (await client.request('param.list')) as ParamList;
const devList = async () =>
  (await client.request('device.list', { cursor: '0' })) as
    { count: number; devices: { index: number; name: string }[] };

async function clearDevices() {
  let l = await devList();
  for (let g = 0; g < 8 && l.count > 0; g++) {
    await client.request('device.delete', { cursor: '0', deviceIndex: l.devices[0].index });
    await pollUntil(async () => (await devList()).count < l.count, 4000);
    l = await devList();
  }
  return l.count === 0;
}

/** Insert a device at the top of gn-A's chain and point the device cursor at it. */
async function insertTop(uuid: string) {
  await clearDevices();
  await client.request('device.insertBitwig', { cursor: '0', uuid });
  await pollUntil(async () => (await devList()).count === 1, 8000);
  await client.request('devcursor.selectAt', { deviceIndex: 0 });
  await pollUntil(async () => (await nesting()).exists, 6000);
  await new Promise((r) => setTimeout(r, 600)); // let layer observers stream in
}

await client.connect();
console.log('connected\n');
const { trackA } = await ensureFixtureTracks();
await point('0', trackA, 0, MECH);

// ============================================ A. nesting introspection matrix
console.log('-- A. how each device type reports its nesting');
const matrix: { device: string; layers: boolean; shipped: number; drums: boolean; slots: string }[] = [];
for (const [label, uuid] of [
  ['Polysynth (flat)', POLYSYNTH],
  ['FX Layer', FX_LAYER],
  ['Note FX Layer', NOTE_FX_LAYER],
  ['Instrument Layer', INSTRUMENT_LAYER],
  ['Instrument Selector', INSTRUMENT_SELECTOR],
] as const) {
  await insertTop(uuid);
  const n = await nesting();
  const l = await layers();
  matrix.push({
    device: label, layers: n.hasLayers, shipped: l.count,
    drums: n.hasDrumPads, slots: n.slotNames.join('/') || '—',
  });
}
console.log('  device'.padEnd(24), 'hasLayers'.padStart(10), 'shipped'.padStart(8),
  'drumPads'.padStart(9), '  slots');
for (const m of matrix) {
  console.log('  ' + m.device.padEnd(22), String(m.layers).padStart(10),
    String(m.shipped).padStart(8), String(m.drums).padStart(9), '  ' + m.slots);
}

const flat = matrix.find((m) => m.device.startsWith('Polysynth'))!;
check('a flat instrument reports no layers and no drum pads',
  flat.layers === false && flat.drums === false, flat);
check('hasLayers=true does NOT imply a layer exists — containers ship differently',
  matrix.filter((m) => m.layers && m.shipped === 0).length > 0,
  { emptyContainers: matrix.filter((m) => m.layers && m.shipped === 0).map((m) => m.device) });

// ==================================== B. FX Layer: the container we can drive
console.log('\n-- B. FX Layer (ships with one chain): insert INTO the layer');
await insertTop(FX_LAYER);
const fresh = await layers();
note(`shipped layers: ${fresh.layers.map((l) => `[${l.index}]"${l.name}"`).join(', ')}`);
check('layer bank enumerates the container\'s chains', fresh.count === 1, { count: fresh.count });

await client.request('layer.insertDevice', { layerIndex: 0, uuid: POLYSYNTH });
const nestedIn = await pollUntil(async () =>
  ((await layers()).layers[0]?.devices.length ?? 0) > 0, 10000);
const l0 = (await layers()).layers[0];
note(`layer 0 now: "${l0?.name}" containing ${l0?.devices.map((d) => `"${d.name}"`).join(', ')} ` +
  `(${nestedIn.ms}ms) — note the LAYER renamed itself after its content`);
check('device inserted INTO a layer via the layer\'s own insertion point',
  nestedIn.ok && (l0?.devices.length ?? 0) > 0, { devices: l0?.devices });

const top = await devList();
check('the nested device does NOT appear in the top-level chain (real nesting)',
  top.count === 1, { topLevel: top.devices.map((d) => d.name) });

// ==================================== C. the key test: params at depth
console.log('\n-- C. does the E4 param apparatus follow the cursor INTO a layer?');
const before = await params();
note(`before descending: cursor="${before.deviceName}", ${before.existing}/${before.total} params resolve`);

await client.request('devcursor.selectFirstInLayer', { layerIndex: 0 });
const descended = await pollUntil(async () => (await params()).existing > 0, 8000);
const inside = await params();
note(`after selectFirstInLayer(0): cursor="${inside.deviceName}", ` +
  `${inside.existing}/${inside.total} params resolve`);
check('selectFirstInLayer moves the device cursor INTO the nested chain',
  inside.deviceName.toLowerCase().includes('poly'), { deviceName: inside.deviceName });
check('E4 param handles resolve on the NESTED device (no new machinery needed)',
  descended.ok && inside.existing > 0, { existing: inside.existing, total: inside.total });
note(`nested params self-describe: ` + inside.params.filter((p) => p.exists).slice(0, 4)
  .map((p) => `${p.id}="${p.name}"=${p.displayed}`).join(', '));

const target = inside.params.find((p) => p.exists && p.id === 'F1FREQ')
  ?? inside.params.find((p) => p.exists);
if (target) {
  const want = (target.value ?? 0) > 0.5 ? 0.2 : 0.8;
  await client.request('param.set', { id: target.id, value: want });
  const wrote = await pollUntil(async () => {
    const p = (await params()).params.find((x) => x.id === target.id);
    return p ? near(p.value ?? -1, want) : false;
  }, 4000);
  const after = (await params()).params.find((x) => x.id === target.id);
  check('param WRITE lands on a device nested inside a layer', wrote.ok,
    { id: target.id, want, got: after?.value?.toFixed(3), displayed: after?.displayed });
}
const deep = await nesting();
check('the nested device reports isNested=true', deep.isNested === true,
  { name: deep.name, isNested: deep.isNested });

// ==================================== D. depth 2 — is the model recursive?
console.log('\n-- D. depth 2: FX Layer inside an FX Layer');
await insertTop(FX_LAYER);
await client.request('layer.insertDevice', { layerIndex: 0, uuid: FX_LAYER });
await pollUntil(async () => ((await layers()).layers[0]?.devices.length ?? 0) > 0, 10000);

await client.request('devcursor.selectFirstInLayer', { layerIndex: 0 });
await pollUntil(async () => (await nesting()).name.includes('Layer'), 6000);
await new Promise((r) => setTimeout(r, 600));
const lvl1 = await nesting();
const lvl1Layers = await layers();
note(`depth 1: cursor="${lvl1.name}" isNested=${lvl1.isNested}; ` +
  `its layer bank re-scoped to ${lvl1Layers.count} layer(s)`);
check('the layer bank re-scopes to whatever the cursor points at',
  lvl1Layers.count === 1, { count: lvl1Layers.count });

await client.request('layer.insertDevice', { layerIndex: 0, uuid: POLYSYNTH });
await pollUntil(async () => ((await layers()).layers[0]?.devices.length ?? 0) > 0, 10000);
await client.request('devcursor.selectFirstInLayer', { layerIndex: 0 });
const deep2 = await pollUntil(async () => (await params()).existing > 0, 8000);
const lvl2 = await params();
note(`depth 2: cursor="${lvl2.deviceName}", ${lvl2.existing}/${lvl2.total} params resolve`);
check('addressing is RECURSIVE — params resolve two levels down',
  deep2.ok && lvl2.existing > 0 && lvl2.deviceName.toLowerCase().includes('poly'),
  { device: lvl2.deviceName, params: lvl2.existing });

// ==================================== E. the creation gap + silent no-ops
console.log('\n-- E. layer CREATION: no API, and the failures are silent');
await insertTop(FX_LAYER);
await client.request('layer.insertDevice', { layerIndex: 1, uuid: POLYSYNTH });
await new Promise((r) => setTimeout(r, 1500));
const appended = await layers();
check('inserting at a NON-EXISTENT layer index silently no-ops (no error, no layer)',
  appended.count === 1, { layers: appended.count });

await insertTop(NOTE_FX_LAYER);
await client.request('layer.insertDevice', { layerIndex: 0, uuid: POLYSYNTH });
await new Promise((r) => setTimeout(r, 1500));
const empty = await layers();
check('a container that ships with ZERO chains cannot be populated at all',
  empty.count === 0, { layers: empty.count });
note('⇒ layers can be FILLED and NAVIGATED, but never CREATED via the API.');

await insertTop(POLYSYNTH);
const beforeSlot = await nesting();
await client.request('devcursor.selectFirstInSlot', { slot: 'FX' });
await new Promise((r) => setTimeout(r, 700));
const afterSlot = await nesting();
check('selectFirstInSlot on an EMPTY slot silently leaves the cursor put (E2-family trap)',
  afterSlot.exists && afterSlot.name === beforeSlot.name && !afterSlot.isNested,
  { before: beforeSlot.name, after: afterSlot.name, isNested: afterSlot.isNested });

// ==================================== F. chain selector
console.log('\n-- F. chain selector (Instrument Selector)');
await insertTop(INSTRUMENT_SELECTOR);
const cs = await client.request('chainselector.status') as
  { exists: boolean; chainCount: number; activeChainIndex: number };
note(`chainSelector: exists=${cs.exists} chainCount=${cs.chainCount} active=${cs.activeChainIndex}`);
check('Instrument Selector exposes a ChainSelector with a readable chain count',
  cs.exists === true && cs.chainCount >= 1, cs);
note('its chains are not layer-bank visible and cannot be added via the API either — ' +
  'the selector is readable/switchable, not buildable.');

// ==================================== G. drum pads
console.log('\n-- G. drum pads');
const pads = await client.request('drumpad.list') as { count: number; hasDrumPads: boolean };
check('drum pad bank correctly reports nothing for a non-drum device', pads.hasDrumPads === false, pads);
note('Drum pads are covered in e04d: a Drum Machine (8ea97e45-…) creates a chain when a');
note('pad is filled, and selectFirstInChannel(pad) addresses into it. An earlier claim');
note('here that Drum Machine was absent from the app bundle was a brittle-grep artefact.');

// ==================================== cleanup
console.log('\n-- cleanup');
check('gn-A devices removed', await clearDevices());
await point('0', trackA, 0, MECH);
await client.request('cursor.clearNotes', { cursor: '0' });
await client.request('cursor.setNotes', { cursor: '0', notes: [[0, 60, 100, 1]] });

console.log(failureCount() === 0 ? '\nE4c: all checks passed' : `\nE4c: ${failureCount()} FAILURES`);
client.disconnect();
process.exit(failureCount() === 0 ? 0 : 1);
