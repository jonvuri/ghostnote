/**
 * E4e — closing the last untested InsertionPoint sources.
 *
 * Every other route to creating a layer has been tried (e04d). The only
 * InsertionPoint sources never exercised are Device.beforeDeviceInsertionPoint
 * and Device.afterDeviceInsertionPoint anchored on a device that is ALREADY
 * inside a layer. If inserting relative to a nested device spawns a sibling
 * layer, the gap is not real. Expected: it adds to the SAME layer chain.
 */
import { client, check, note, failureCount, pollUntil, point, ensureFixtureTracks } from './lib.js';

const MECH = 'trackThenSlot';
const FX_LAYER = 'a0913b7f-096b-4ac9-bddd-33c775314b42';
const POLYSYNTH = 'a9ffacb5-33e9-4fc7-8621-b1af31e410ef';

const layers = async () => (await client.request('layer.list')) as any;
const nesting = async () => (await client.request('device.nesting')) as any;
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
const settle = (ms = 1600) => new Promise((r) => setTimeout(r, ms));

await client.connect();
console.log('connected\n');
const { trackA } = await ensureFixtureTracks();
await point('0', trackA, 0, MECH);

// FX Layer with one populated layer
await clearDevices();
await client.request('device.insertBitwig', { cursor: '0', uuid: FX_LAYER });
await pollUntil(async () => (await devList()).count === 1, 8000);
await client.request('devcursor.selectAt', { deviceIndex: 0 });
await pollUntil(async () => (await nesting()).hasLayers, 6000);
await client.request('layer.insertDevice', { layerIndex: 0, uuid: POLYSYNTH });
await pollUntil(async () => ((await layers()).layers[0]?.devices.length ?? 0) > 0, 10000);

const before = await layers();
note(`baseline: ${before.count} layer(s), layer0 has ${before.layers[0].devices.length} device(s)`);

for (const where of ['after', 'before'] as const) {
  const pre = await layers();
  await client.request('layer.insertRelative',
    { layerIndex: 0, deviceIndex: 0, uuid: POLYSYNTH, where });
  await settle();
  const post = await layers();
  note(`${where}DeviceInsertionPoint(nested device): layers ${pre.count}→${post.count}, ` +
    `layer0 devices ${pre.layers[0].devices.length}→${post.layers[0]?.devices.length}`);
  check(`${where}DeviceInsertionPoint adds to the SAME layer chain, does not create a layer`,
    post.count === pre.count && post.layers[0].devices.length > pre.layers[0].devices.length,
    { layersBefore: pre.count, layersAfter: post.count,
      devicesBefore: pre.layers[0].devices.length, devicesAfter: post.layers[0]?.devices.length });
}

const final = await layers();
note(`final: still ${final.count} layer(s) containing ` +
  `${final.layers[0].devices.map((d: any) => `"${d.name}"`).join(', ')}`);
check('ALL InsertionPoint sources are now exercised; none creates a device layer',
  final.count === 1, { layers: final.count });

console.log('\n-- cleanup');
check('gn-A devices removed', await clearDevices());
await point('0', trackA, 0, MECH);
await client.request('cursor.clearNotes', { cursor: '0' });
await client.request('cursor.setNotes', { cursor: '0', notes: [[0, 60, 100, 1]] });

console.log(failureCount() === 0 ? '\nE4e: all checks passed' : `\nE4e: ${failureCount()} FAILURES`);
client.disconnect();
process.exit(failureCount() === 0 ? 0 : 1);
