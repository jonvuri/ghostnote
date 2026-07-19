/**
 * E4d — Can nesting structure be CREATED? (challenge to E4c's ○)
 *
 * E4c concluded layers can be filled and navigated but never created. That
 * conclusion rested on ONE mechanism (inserting at a layer index). This probe
 * exhausts every other route the API offers, because building device chains
 * with complex routing is a primary use case and a wrong ○ here is expensive
 * — and this spike has already recorded two false negatives (CLAP params,
 * channelId) from exactly this kind of single-mechanism check.
 *
 * Routes under test:
 *   1. DeviceLayer.duplicateObject()        (DeviceLayer is DuplicableObject)
 *   2. DeviceLayer.duplicate()              (DeviceLayer is also a Channel)
 *   3. InsertionPoint.copyDevices(...)      into a layer chain
 *   4. InsertionPoint.insertFile(preset)    a prebuilt multi-chain structure
 *   5. DrumPad.insertionPoint()             (pads have one; layers do not)
 *   6. Device.duplicateObject()             does a container clone its layers?
 *   7. Application named actions            is creation exposed as an action?
 *
 * Restores fixtures.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  client, check, note, failureCount, pollUntil, point, ensureFixtureTracks,
} from './lib.js';

const MECH = 'trackThenSlot';
const FX_LAYER = 'a0913b7f-096b-4ac9-bddd-33c775314b42';
const INSTRUMENT_LAYER = '5024be2e-65d6-4d40-bbfe-8b2ea993c445';
const DRUM_MACHINE = '8ea97e45-0255-40fd-bc7e-94419741e9d1';
const POLYSYNTH = 'a9ffacb5-33e9-4fc7-8621-b1af31e410ef';
const DRUM_PRESET = path.join(os.homedir(),
  'Documents', 'Bitwig Studio', 'Library', 'Presets', 'Drum Machine', 'PS2 corruption.bwpreset');

const nesting = async () => (await client.request('device.nesting')) as any;
const layers = async () => (await client.request('layer.list')) as any;
const params = async () => (await client.request('param.list')) as any;
const pads = async () => (await client.request('drumpad.list')) as any;
const devList = async () => (await client.request('device.list', { cursor: '0' })) as any;

async function clearDevices() {
  let l = await devList();
  for (let g = 0; g < 12 && l.count > 0; g++) {
    await client.request('device.delete', { cursor: '0', deviceIndex: l.devices[0].index });
    await pollUntil(async () => (await devList()).count < l.count, 5000);
    l = await devList();
  }
  return l.count === 0;
}

async function insertTop(uuid: string) {
  await clearDevices();
  await client.request('device.insertBitwig', { cursor: '0', uuid });
  await pollUntil(async () => (await devList()).count === 1, 8000);
  await client.request('devcursor.selectAt', { deviceIndex: 0 });
  await pollUntil(async () => (await nesting()).exists, 6000);
  await new Promise((r) => setTimeout(r, 700));
}

const settle = (ms = 1500) => new Promise((r) => setTimeout(r, ms));

await client.connect();
console.log('connected\n');
const { trackA } = await ensureFixtureTracks();
await point('0', trackA, 0, MECH);

// ============================================ 0. named actions
console.log('-- 0. is chain/layer creation exposed as a named action?');
const all = await client.request('app.actions', {}) as { total: number; matched: number };
note(`Application.getActions() exposes ${all.total} actions`);
for (const f of ['layer', 'chain', 'drum', 'device']) {
  const hit = await client.request('app.actions', { filter: f }) as
    { actions: { id: string; name: string; category: string }[]; matched: number };
  note(`  filter "${f}": ${hit.matched} — ` +
    (hit.actions.slice(0, 6).map((a) => `${a.id}("${a.name}")`).join(', ') || 'none'));
}
check('named-action list is readable (E6 head start)', all.total > 0, { total: all.total });

// ============================================ 1+2. duplicating a layer
console.log('\n-- 1/2. duplicate an EXISTING layer (FX Layer ships with one)');
await insertTop(FX_LAYER);
await client.request('layer.insertDevice', { layerIndex: 0, uuid: POLYSYNTH });
await pollUntil(async () => ((await layers()).layers[0]?.devices.length ?? 0) > 0, 10000);
const oneLayer = await layers();
note(`before: ${oneLayer.count} layer(s) — ${JSON.stringify(oneLayer.layers.map((l: any) => l.name))}`);

await client.request('layer.duplicate', { layerIndex: 0 });
await settle();
const dupObj = await layers();
note(`after DeviceLayer.duplicateObject(): ${dupObj.count} layer(s) — ` +
  JSON.stringify(dupObj.layers.map((l: any) => `${l.name}(${l.devices.length}dev)`)));
check('ROUTE 1 ✗: DeviceLayer.duplicateObject() does NOT create a layer (silent no-op)',
  dupObj.count === oneLayer.count, { before: oneLayer.count, after: dupObj.count });

await client.request('layer.duplicateChannel', { layerIndex: 0 });
await settle();
const dupCh = await layers();
note(`after Channel.duplicate(): ${dupCh.count} layer(s)`);
check('ROUTE 2 ✗: Channel.duplicate() does NOT create a layer either (silent no-op)',
  dupCh.count === oneLayer.count, { before: oneLayer.count, after: dupCh.count });

// ============================================ 3. copyDevices into a layer
console.log('\n-- 3. InsertionPoint.copyDevices() into a layer chain');
const beforeCopy = await layers();
await client.request('layer.copyDeviceInto', { layerIndex: 0, deviceIndex: 0 });
await settle();
const afterCopy = await layers();
note(`layers ${beforeCopy.count} → ${afterCopy.count}; layer0 devices ` +
  `${beforeCopy.layers[0]?.devices.length} → ${afterCopy.layers[0]?.devices.length}`);
check('ROUTE 3 ✗: copyDevices() into a layer chain is a silent no-op',
  (afterCopy.layers[0]?.devices.length ?? 0) === (beforeCopy.layers[0]?.devices.length ?? 0),
  { before: beforeCopy.layers[0]?.devices.length, after: afterCopy.layers[0]?.devices.length });

// ============================================ 6. duplicating the container
console.log('\n-- 6. Device.duplicateObject() on a populated container');
const beforeDup = await devList();
await client.request('device.duplicate', { deviceIndex: 0 });
await settle(2000);
const afterDup = await devList();
note(`top-level chain ${beforeDup.count} → ${afterDup.count}: ` +
  afterDup.devices.map((d: any) => `"${d.name}"`).join(', '));
check('ROUTE 6: duplicating a container clones it WITH its nested contents',
  afterDup.count > beforeDup.count, { before: beforeDup.count, after: afterDup.count });
if (afterDup.count > beforeDup.count) {
  await client.request('devcursor.selectAt', { deviceIndex: afterDup.count - 1 });
  await settle(800);
  const clone = await layers();
  note(`the CLONE contains ${clone.count} layer(s): ` +
    JSON.stringify(clone.layers.map((l: any) => `${l.name}(${l.devices.length}dev)`)));
  check('the clone carries its nested chain contents (structure is duplicable wholesale)',
    clone.count > 0 && (clone.layers[0]?.devices.length ?? 0) > 0, { layers: clone.count });
}

// ============================================ 5. drum pads
console.log('\n-- 5. Drum Machine: DrumPad.insertionPoint() (pads have one; layers do not)');
note(`Drum Machine UUID ${DRUM_MACHINE} — recovered from the bundle after the E4c miss`);
await insertTop(DRUM_MACHINE);
const dm = await nesting();
const dmPads = await pads();
check('Drum Machine inserts and reports hasDrumPads=true',
  dm.exists && dm.name.toLowerCase().includes('drum') && dmPads.hasDrumPads === true,
  { name: dm.name, hasDrumPads: dmPads.hasDrumPads, pads: dmPads.count });
note(`fresh Drum Machine exposes ${dmPads.count} pad(s)`);

const padsBefore = dmPads.count;
await client.request('drumpad.insertDevice', { padIndex: 0, uuid: POLYSYNTH });
const padFilled = await pollUntil(async () => (await pads()).count > padsBefore, 10000);
const padsAfter = await pads();
note(`after DrumPad(0).insertionPoint().insertBitwigDevice(): ${padsBefore} → ${padsAfter.count} pads ` +
  JSON.stringify(padsAfter.pads.slice(0, 4)));
check('ROUTE 5: inserting into an EMPTY drum pad CREATES a chain',
  padFilled.ok && padsAfter.count > padsBefore, { before: padsBefore, after: padsAfter.count });

if (padsAfter.count > 0) {
  // DrumPad is a Channel, so the generic selectFirstInChannel idiom applies.
  // (selectFirstInKeyPad takes a MIDI KEY, not a pad index — 36 = pad 0. See
  // e04d-diag; passing a pad index silently leaves the cursor put.)
  await client.request('devcursor.selectFirstInPad', { padIndex: 0 });
  const inPad = await pollUntil(async () => (await params()).existing > 0, 8000);
  const pp = await params();
  note(`selectFirstInChannel(pad 0): cursor="${pp.deviceName}" params=${pp.existing}/${pp.total}`);
  check('params resolve on a device inside a drum pad', inPad.ok && pp.existing > 0,
    { device: pp.deviceName, params: pp.existing });

  // fill a second pad → multi-chain structure built entirely programmatically
  await client.request('devcursor.selectParent');
  await settle(800);
  await client.request('drumpad.insertDevice', { padIndex: 1, uuid: POLYSYNTH });
  const two = await pollUntil(async () => (await pads()).count >= 2, 10000);
  const padsNow = await pads();
  check('multiple pad chains can be built programmatically (N chains, no UI)',
    two.ok && padsNow.count >= 2, { pads: padsNow.count });
}

// ============================================ 4. insertFile
console.log('\n-- 4. InsertionPoint.insertFile(): a prebuilt multi-chain preset');
if (fs.existsSync(DRUM_PRESET)) {
  await clearDevices();
  await client.request('device.insertFile', { cursor: '0', path: DRUM_PRESET });
  const loaded = await pollUntil(async () => (await devList()).count > 0, 15000);
  await client.request('devcursor.selectAt', { deviceIndex: 0 });
  await settle(1500);
  const fileDev = await nesting();
  const filePads = await pads();
  note(`insertFile("${path.basename(DRUM_PRESET)}") → "${fileDev.name}" ` +
    `with ${filePads.count} populated pad(s) in ${loaded.ms}ms`);
  check('ROUTE 4: insertFile() materialises a complete multi-chain structure in ONE call',
    loaded.ok && filePads.count > 1, { device: fileDev.name, pads: filePads.count });
} else {
  note(`no preset at ${DRUM_PRESET} — route 4 not exercised`);
}

// ============================================ the remaining gap
console.log('\n-- the residual gap: containers that ship with ZERO chains');
await insertTop(INSTRUMENT_LAYER);
const il0 = await layers();
await client.request('layer.duplicate', { layerIndex: 0 });
await settle();
const il1 = await layers();
note(`Instrument Layer: ${il0.count} layer(s) → after duplicateObject(0) → ${il1.count}`);
check('an EMPTY container still cannot be seeded (nothing to duplicate or fill)',
  il1.count === 0, { layers: il1.count });

// ============================================ cleanup
console.log('\n-- cleanup');
check('gn-A devices removed', await clearDevices());
await point('0', trackA, 0, MECH);
await client.request('cursor.clearNotes', { cursor: '0' });
await client.request('cursor.setNotes', { cursor: '0', notes: [[0, 60, 100, 1]] });

console.log(failureCount() === 0 ? '\nE4d: all checks passed' : `\nE4d: ${failureCount()} FAILURES`);
client.disconnect();
process.exit(failureCount() === 0 ? 0 : 1);
