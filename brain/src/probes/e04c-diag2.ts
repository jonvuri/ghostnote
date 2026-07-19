/**
 * E4c diagnostic 2 — can layers be APPENDED, or only filled?
 *
 * FX Layer ships with exactly one chain ("Layer 1"). If inserting at
 * layerIndex 1 creates a second layer, containers are growable
 * programmatically; if it silently no-ops, layer creation is UI-only and the
 * Create column has a hard gap.
 */
import { client, note, pollUntil, point, ensureFixtureTracks } from './lib.js';

const MECH = 'trackThenSlot';
const FX_LAYER = 'a0913b7f-096b-4ac9-bddd-33c775314b42';
const NOTE_FX_LAYER = '96456481-4c52-423a-8485-4604b15d0183';
const POLYSYNTH = 'a9ffacb5-33e9-4fc7-8621-b1af31e410ef';

const layers = async () => (await client.request('layer.list')) as any;
const nesting = async () => (await client.request('device.nesting')) as any;
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

for (const [label, uuid] of [['FX Layer', FX_LAYER], ['Note FX Layer', NOTE_FX_LAYER]] as const) {
  console.log(`\n======== ${label}: append test`);
  await clearDevices();
  await client.request('device.insertBitwig', { cursor: '0', uuid });
  await pollUntil(async () => (await devList()).count === 1, 8000);
  await client.request('devcursor.selectAt', { deviceIndex: 0 });
  await pollUntil(async () => (await nesting()).exists, 6000);
  await new Promise((r) => setTimeout(r, 600));
  note(`shipped with ${(await layers()).count} layer(s): ${JSON.stringify((await layers()).layers)}`);

  for (const idx of [0, 1, 2]) {
    await client.request('layer.insertDevice', { layerIndex: idx, uuid: POLYSYNTH });
    await new Promise((r) => setTimeout(r, 1200));
    const l = await layers();
    note(`  after insert at layerIndex=${idx}: ${l.count} layer(s) — ` +
      l.layers.map((x: any) => `[${x.index}]"${x.name}"(${x.devices.length} dev)`).join(' '));
  }
}

await clearDevices();
console.log('\ndiag2 done');
client.disconnect();
process.exit(0);
