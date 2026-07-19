/**
 * E4d diagnostic — how do you point the device cursor INTO a drum pad chain?
 *
 * e04d built pad chains successfully but selectFirstInKeyPad(0) left the
 * cursor on the Drum Machine. Two hypotheses:
 *   (a) selectFirstInKeyPad takes a MIDI KEY (36 = C1), not a pad index
 *   (b) the generic selectFirstInChannel(DrumPad) is the right idiom, since
 *       DrumPad is a Channel — the same call used for tracks
 */
import { client, note, pollUntil, point, ensureFixtureTracks } from './lib.js';

const MECH = 'trackThenSlot';
const DRUM_MACHINE = '8ea97e45-0255-40fd-bc7e-94419741e9d1';
const POLYSYNTH = 'a9ffacb5-33e9-4fc7-8621-b1af31e410ef';

const nesting = async () => (await client.request('device.nesting')) as any;
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
}
const settle = (ms = 900) => new Promise((r) => setTimeout(r, ms));

await client.connect();
const { trackA } = await ensureFixtureTracks();
await point('0', trackA, 0, MECH);

await clearDevices();
await client.request('device.insertBitwig', { cursor: '0', uuid: DRUM_MACHINE });
await pollUntil(async () => (await devList()).count === 1, 8000);
await client.request('devcursor.selectAt', { deviceIndex: 0 });
await settle();

// build two pad chains
await client.request('drumpad.insertDevice', { padIndex: 0, uuid: POLYSYNTH });
await pollUntil(async () => (await pads()).count >= 1, 10000);
await client.request('drumpad.insertDevice', { padIndex: 3, uuid: POLYSYNTH });
await pollUntil(async () => (await pads()).count >= 2, 10000);
const p = await pads();
note(`pads present: ${JSON.stringify(p.pads)}`);

// hypothesis (b): DrumPad is a Channel
for (const padIndex of [0, 3]) {
  await client.request('devcursor.selectAt', { deviceIndex: 0 }); // back to the Drum Machine
  await settle();
  await client.request('devcursor.selectFirstInPad', { padIndex });
  await settle(1200);
  const n = await nesting();
  const pm = await params();
  note(`selectFirstInChannel(pad ${padIndex}): cursor="${n.name}" isNested=${n.isNested} ` +
    `params=${pm.existing}/${pm.total}`);
}

// hypothesis (a): selectFirstInKeyPad takes a MIDI key
for (const key of [0, 36, 60]) {
  await client.request('devcursor.selectAt', { deviceIndex: 0 });
  await settle();
  await client.request('devcursor.selectFirstInKeyPad', { pad: key });
  await settle(1200);
  const n = await nesting();
  const pm = await params();
  note(`selectFirstInKeyPad(${key}): cursor="${n.name}" isNested=${n.isNested} ` +
    `params=${pm.existing}/${pm.total}`);
}

await clearDevices();
console.log('\ndiag done');
client.disconnect();
process.exit(0);
