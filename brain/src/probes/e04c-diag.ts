/**
 * E4c diagnostic — why did the Instrument Layer expose 0 layers?
 *
 * Hypothesis: a freshly-inserted Instrument Layer is genuinely EMPTY (no
 * chains yet), so there is nothing to address into, while an Instrument
 * Selector ships with one chain. If so, nesting NAVIGATION works fine and
 * only layer CREATION is missing from the API.
 */
import { client, note, pollUntil, point, ensureFixtureTracks } from './lib.js';

const MECH = 'trackThenSlot';
const INSTRUMENT_LAYER = '5024be2e-65d6-4d40-bbfe-8b2ea993c445';
const INSTRUMENT_SELECTOR = '9588fbcf-721a-438b-8555-97e4231f7d2c';
const FX_LAYER = 'a0913b7f-096b-4ac9-bddd-33c775314b42';
const POLYSYNTH = 'a9ffacb5-33e9-4fc7-8621-b1af31e410ef';

const nesting = async () => (await client.request('device.nesting')) as any;
const layers = async () => (await client.request('layer.list')) as any;
const params = async () => (await client.request('param.list')) as any;
const chain = async () => (await client.request('chainselector.status')) as any;
const devList = async () => (await client.request('device.list', { cursor: '0' })) as any;

async function clearDevices() {
  let l = await devList();
  for (let g = 0; g < 8 && l.count > 0; g++) {
    await client.request('device.delete', { cursor: '0', deviceIndex: l.devices[0].index });
    await pollUntil(async () => (await devList()).count < l.count, 4000);
    l = await devList();
  }
}

await client.connect();
const { trackA } = await ensureFixtureTracks();
await point('0', trackA, 0, MECH);

for (const [label, uuid] of [
  ['Instrument Selector', INSTRUMENT_SELECTOR],
  ['Instrument Layer', INSTRUMENT_LAYER],
  ['FX Layer', FX_LAYER],
] as const) {
  console.log(`\n======== ${label}`);
  await clearDevices();
  await client.request('device.insertBitwig', { cursor: '0', uuid });
  await pollUntil(async () => (await devList()).count === 1, 8000);
  await client.request('devcursor.selectAt', { deviceIndex: 0 });
  await pollUntil(async () => (await nesting()).exists, 6000);
  await new Promise((r) => setTimeout(r, 600)); // let layer observers stream

  const n = await nesting();
  const l = await layers();
  const c = await chain();
  note(`${n.name}: hasLayers=${n.hasLayers} hasSlots=${n.hasSlots} slots=[${n.slotNames}]`);
  note(`  layerBank: count=${l.count} ${JSON.stringify(l.layers)}`);
  note(`  chainSelector: exists=${c.exists} chainCount=${c.chainCount} active=${c.activeChainIndex}`);

  // try inserting into layer 0 regardless of whether it reports existing
  await client.request('layer.insertDevice', { layerIndex: 0, uuid: POLYSYNTH });
  const got = await pollUntil(async () => (await layers()).count > 0
    && ((await layers()).layers[0]?.devices.length ?? 0) > 0, 8000);
  const l2 = await layers();
  const c2 = await chain();
  note(`  after insert into layer 0 (${got.ok ? 'TOOK' : 'NO EFFECT'}): ` +
    `layers=${l2.count} ${JSON.stringify(l2.layers)} chainCount=${c2.chainCount}`);

  if (l2.count > 0 && (l2.layers[0]?.devices.length ?? 0) > 0) {
    await client.request('devcursor.selectFirstInLayer', { layerIndex: 0 });
    await pollUntil(async () => (await params()).existing > 0, 6000);
    const p = await params();
    const nn = await nesting();
    note(`  descended: cursor="${p.deviceName}" params=${p.existing}/${p.total} isNested=${nn.isNested}`);
  }
}

// slot navigation on a plain Polysynth
console.log('\n======== named slots on a flat Polysynth');
await clearDevices();
await client.request('device.insertBitwig', { cursor: '0', uuid: POLYSYNTH });
await pollUntil(async () => (await devList()).count === 1, 8000);
await client.request('devcursor.selectAt', { deviceIndex: 0 });
await pollUntil(async () => (await params()).existing > 0, 6000);
note(`before: cursor="${(await params()).deviceName}" slots=[${(await nesting()).slotNames}]`);
await client.request('devcursor.selectFirstInSlot', { slot: 'FX' });
await new Promise((r) => setTimeout(r, 600));
const afterSlot = await nesting();
note(`after selectFirstInSlot("FX") on an EMPTY slot: exists=${afterSlot.exists} ` +
  `name="${afterSlot.name}" isNested=${afterSlot.isNested}`);

await clearDevices();
console.log('\ndiag done');
client.disconnect();
process.exit(0);
