/**
 * E17 row 3 — can a layer chain be CREATED? The last two untried readings.
 *
 * ⚠ **Expect ○, and say so before running.** E4d/E4e is the strongest negative
 * in this spike: five converging lines of evidence, including the vendor's own
 * architectural reason (an `InsertionPoint` must bind to a referent, and "layer
 * 3" has none until it exists) and an ecosystem check against DrivenByMoss. The
 * user agrees the row looks genuinely closed. This runs because two readings
 * remain untested and both are cheap, not because the prior is good — and
 * because E4c's ○ was overturned by E4d, part of which was then overturned by
 * E16n. A ○ here is worth having *stated against these two mechanisms*.
 *
 * ROUTE A — the CONTAINER-SCOPED cursor (`layer.insertViaCursor`).
 *   The Bitwig user guide, quoted in E4e, describes chain creation as a SIDE
 *   EFFECT of adding a device to the container: *"there is only one Add Device
 *   button in the main interface of Instrument Layer, with each added device
 *   being placed on a newly created instrument chain."* Everything tried so far
 *   inserted into an existing chain addressed BY INDEX (E4c, E16n) or called a
 *   duplication verb. E4e's referent argument is an argument about indexed
 *   addressing specifically; `createCursorLayer()` is not indexed.
 *   ⚠ A javadoc sweep finds exactly 11 methods in the whole API returning an
 *   `InsertionPoint`, and not one of them hangs off a container `Device`. So
 *   there is no literal "container insertion point" and this cursor is the
 *   closest thing to one that exists.
 *
 * ROUTE B — `startOfDeviceChainInsertionPoint()` (`layer.insertAtStart`).
 *   E4c and E16n both used `endOfDeviceChainInsertionPoint()`. Its sibling, same
 *   API version, has never been called on a `DeviceLayer`. E4e's "every
 *   InsertionPoint source has been exercised" is exhaustive about sources
 *   ENUMERATED, not about sources called on a layer.
 *
 * ⚠ **Route B is also the CONTROL, and that is why it is worth more than its
 * own result.** It should land in the SAME chain rather than spawn a sibling. If
 * it lands and route A does nothing, the difference is the cursor rather than a
 * dead verb — the e16n discipline, where `moveDevices` ● beside a same-track
 * positive control is what let a negative mean anything.
 *
 * Three fixture states, because a zero-chain container and a one-chain container
 * fail for different documented reasons (E4c/E4d):
 *   0 chains  a bare Instrument Layer — "cannot be seeded at all"
 *   1 chain   a bare FX Layer — "ships with exactly one chain and will not grow"
 *   2 chains  gn-lay — the populated case, where nothing is missing
 *
 * Silent: nothing is launched and the transport is never touched.
 */
import { client, check, note, failureCount, pollUntil } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);

const POLYSYNTH = 'a9ffacb5-33e9-4fc7-8621-b1af31e410ef';
const INSTRUMENT_LAYER = '5024be2e-65d6-4d40-bbfe-8b2ea993c445';
const FX_LAYER = 'a0913b7f-096b-4ac9-bddd-33c775314b42';
const SCRATCH = 'gn-A';

interface TrackRow { index: number; name: string; type: string; channelId: string }
const list = async () => ((await req('track.list')) as { tracks: TrackRow[] }).tracks;
interface DevList { devices: { index: number; name: string }[]; count: number }
interface LayerList {
  layers: { index: number; name: string; devices: { name: string }[] }[];
  count: number; hasLayers?: boolean | string;
  cursorLayerExists?: boolean | string; cursorLayerName?: string; cursorDeviceName?: string;
}
const shapeOf = (l: LayerList) =>
  l.layers.map((x) => `${x.index}:${x.name}[${x.devices.map((d) => d.name).join('+') || '—'}]`).join(' ') || '(no chains)';

/** ⚠ `device.list` right after `cursor.pointTrack` can return the PREVIOUS track's chain (e17-diag). */
async function devicesSettled(): Promise<DevList> {
  let last = '';
  let out: DevList = { devices: [], count: 0 };
  await pollUntil(async () => {
    out = (await req('device.list', { cursor: '0' })) as DevList;
    const names = out.devices.map((d) => d.name).join(',');
    const stable = names === last;
    last = names;
    return stable;
  }, 4000, 200);
  return out;
}

/** Point at a container and REFUSE unless it landed — the e16o trap, centralised. */
async function selectContainer(trackIndex: number, deviceIndex: number, expect: string): Promise<void> {
  await req('cursor.pointTrack', { cursor: '0', trackIndex });
  await devicesSettled();
  await req('devcursor.selectAt', { deviceIndex });
  const ok = await pollUntil(async () => {
    const s = (await req('devcursor.status')) as { exists: boolean; name: string };
    return s.exists && s.name === expect;
  }, 6000, 150);
  if (!ok.ok) {
    console.log(`\nREFUSING: cursor is not on "${expect}" — ${JSON.stringify(await req('devcursor.status'))}`);
    console.log('Every layer call reaches its target through this cursor (the e16o trap).');
    process.exit(1);
  }
}

const layers = async () => (await req('layer.list')) as LayerList;

await client.connect();
const tracks = await list();
const scratch = tracks.find((t) => t.name === SCRATCH);
const lay = tracks.find((t) => t.name === 'gn-lay');
if (!scratch || !lay) { console.log('REFUSING: run e17-setup first.'); process.exit(1); }

/** Put a bare container on the scratch track and return its device index. */
async function bareContainer(uuid: string, expectName: string): Promise<number> {
  await req('cursor.pointTrack', { cursor: '0', trackIndex: scratch!.index });
  const before = await devicesSettled();
  await req('device.insertBitwig', { cursor: '0', uuid });
  await pollUntil(async () => (await devicesSettled()).count > before.count, 8000, 200);
  const after = await devicesSettled();
  const idx = after.devices.findIndex((d) => d.name === expectName);
  if (idx < 0) { console.log(`REFUSING: no ${expectName} after insert.`); process.exit(1); }
  return idx;
}

async function clearScratch(): Promise<void> {
  for (let g = 0; g < 10; g++) {
    await req('cursor.pointTrack', { cursor: '0', trackIndex: scratch!.index });
    const d = await devicesSettled();
    if (d.count === 0) break;
    await req('device.delete', { cursor: '0', deviceIndex: d.devices[0]!.index });
    await pollUntil(async () => (await devicesSettled()).count < d.count, 4000, 200);
  }
}

interface RowResult { before: number; after: number; grew: boolean; devicesLanded: boolean }

/** Fire an insert and report the chain-count DIFF and whether the device went anywhere. */
async function attempt(
  label: string, method: string, params: Record<string, unknown>,
  trackIndex: number, deviceIndex: number, expectName: string,
): Promise<RowResult> {
  await selectContainer(trackIndex, deviceIndex, expectName);
  const before = await layers();
  const beforeDevices = before.layers.reduce((n, x) => n + x.devices.length, 0);
  note(`${label}`);
  note(`   BEFORE  chains=${before.count}  ${shapeOf(before)}`);
  note(`   cursorLayer: exists=${before.cursorLayerExists} name=${JSON.stringify(before.cursorLayerName)}`
    + `  (scoped to ${JSON.stringify(before.cursorDeviceName)})`);
  await req(method, params);
  const grew = await pollUntil(async () => {
    await selectContainer(trackIndex, deviceIndex, expectName);
    return (await layers()).count > before.count;
  }, 4000, 250);
  await selectContainer(trackIndex, deviceIndex, expectName);
  const after = await layers();
  const afterDevices = after.layers.reduce((n, x) => n + x.devices.length, 0);
  note(`   AFTER   chains=${after.count}  ${shapeOf(after)}   (${grew.ms} ms)`);
  return {
    before: before.count, after: after.count, grew: grew.ok,
    devicesLanded: afterDevices > beforeDevices,
  };
}

// ==========================================================================
console.log('\n======== FIXTURE 0 CHAINS — a bare Instrument Layer ("cannot be seeded at all", E4c)');
await clearScratch();
const ilIndex = await bareContainer(INSTRUMENT_LAYER, 'Instrument Layer');
await selectContainer(scratch.index, ilIndex, 'Instrument Layer');
const zero = await layers();
note(`shipped with ${zero.count} chains, hasLayers=${zero.hasLayers}`);
check('PRECONDITION: a bare Instrument Layer really does ship with ZERO chains (E4c, re-confirmed)',
  zero.count === 0 && zero.hasLayers === true, { count: zero.count, hasLayers: zero.hasLayers });
// ⚠ This is half of row 3's answer and nothing has ever read it: does the
// container-scoped cursor have a REFERENT when there are no chains to point at?
note(`⚠ cursorLayer on a 0-chain container: exists=${zero.cursorLayerExists}`
  + ` name=${JSON.stringify(zero.cursorLayerName)}`);

const z1 = await attempt('ROUTE A — insert via the CONTAINER-SCOPED cursor',
  'layer.insertViaCursor', { uuid: POLYSYNTH }, scratch.index, ilIndex, 'Instrument Layer');
check('⚠ ROUTE A on a 0-chain container: does a chain appear?', z1.grew,
  { before: z1.before, after: z1.after });

// ==========================================================================
console.log('\n======== FIXTURE 1 CHAIN — a bare FX Layer ("will not grow", E4c/E4d)');
await clearScratch();
const fxIndex = await bareContainer(FX_LAYER, 'FX Layer');
await selectContainer(scratch.index, fxIndex, 'FX Layer');
const one = await layers();
check('PRECONDITION: an FX Layer ships with exactly ONE chain, and it is empty',
  one.count === 1 && one.layers[0]?.devices.length === 0, { count: one.count, shape: shapeOf(one) });
note(`⚠ cursorLayer on a 1-chain container: exists=${one.cursorLayerExists}`
  + ` name=${JSON.stringify(one.cursorLayerName)}`);

const o1 = await attempt('ROUTE A — insert via the CONTAINER-SCOPED cursor',
  'layer.insertViaCursor', { uuid: POLYSYNTH }, scratch.index, fxIndex, 'FX Layer');
check('⚠ ROUTE A on a 1-chain container: does a SECOND chain appear?', o1.grew,
  { before: o1.before, after: o1.after, devicesLanded: o1.devicesLanded });
note(`   (a device DID land somewhere: ${o1.devicesLanded} — if true with no new chain,`);
note(`    the cursor resolved to the EXISTING chain, which is E4e's referent argument working)`);

// ==========================================================================
console.log('\n======== FIXTURE 2 CHAINS — gn-lay, where nothing is missing');
const t1 = await attempt('ROUTE A — insert via the CONTAINER-SCOPED cursor',
  'layer.insertViaCursor', { uuid: POLYSYNTH }, lay.index, 0, 'Instrument Layer');
check('⚠ ROUTE A on a 2-chain container: does a THIRD chain appear?', t1.grew,
  { before: t1.before, after: t1.after, devicesLanded: t1.devicesLanded });

// ==========================================================================
console.log('\n======== ROUTE B / THE CONTROL — startOfDeviceChainInsertionPoint on chain 0');
note('⚠ This is the control, and it decides whether the ○s above mean anything. It should');
note('  land IN chain 0 rather than spawn a sibling. If it lands and route A did nothing,');
note('  the difference is the CURSOR, not a dead verb (the e16n discipline).');
const b1 = await attempt('ROUTE B — insertAtStart on chain 0 of gn-lay',
  'layer.insertAtStart', { layerIndex: 0, uuid: POLYSYNTH }, lay.index, 0, 'Instrument Layer');
check('⚠ CONTROL: the insertion point WORKS — a device landed in chain 0',
  b1.devicesLanded, { devicesLanded: b1.devicesLanded });
check('ROUTE B does not spawn a sibling chain either (expected: it should not)',
  !b1.grew, { before: b1.before, after: b1.after });

// ==========================================================================
console.log('\n-- cleanup');
await clearScratch();
// gn-lay picked up whatever landed in its chains; put it back to one device each.
await selectContainer(lay.index, 0, 'Instrument Layer');
for (let g = 0; g < 8; g++) {
  await selectContainer(lay.index, 0, 'Instrument Layer');
  const l = await layers();
  const fat = l.layers.find((x) => x.devices.length > 1);
  if (!fat) break;
  await req('devcursor.selectFirstInLayer', { layerIndex: fat.index });
  await pollUntil(async () => {
    const s = (await req('devcursor.status')) as { name: string };
    return s.name === 'Polysynth';
  }, 4000, 200);
  await req('devcursor.selectParent');
  // Delete through the layer's own device bank by re-inserting nothing: instead
  // trim by deleting the extra device via the nested bank is not on the wire, so
  // rebuild the chain contents is out of scope here — report instead of pretend.
  note(`⚠ chain ${fat.index} now holds ${fat.devices.map((d) => d.name).join('+')}`
    + ' — extra devices left in place; there is no nested device-delete on the wire.');
  break;
}
await selectContainer(lay.index, 0, 'Instrument Layer');
note(`gn-lay final: ${shapeOf(await layers())}`);

// ==========================================================================
console.log('\n======== VERDICT');
const anyGrew = z1.grew || o1.grew || t1.grew || b1.grew;
console.log(`  0 chains  ROUTE A via cursor        ${z1.before} -> ${z1.after}  ${z1.grew ? '●' : '○'}`);
console.log(`  1 chain   ROUTE A via cursor        ${o1.before} -> ${o1.after}  ${o1.grew ? '●' : '○'}`);
console.log(`  2 chains  ROUTE A via cursor        ${t1.before} -> ${t1.after}  ${t1.grew ? '●' : '○'}`);
console.log(`  2 chains  ROUTE B insertAtStart     ${b1.before} -> ${b1.after}  ${b1.grew ? '●' : '○'}`
  + `   (device landed: ${b1.devicesLanded ? '● CONTROL HOLDS' : '○ ⚠ CONTROL FAILED'})`);
if (!anyGrew && b1.devicesLanded) {
  note('⇒ E4d/E4e STANDS against two further mechanisms, bracketed by a positive control on');
  note('  the same insertion-point family. Layer-type containers cannot grow chains, and the');
  note('  vendor\'s "newly created chain" wording describes the UI, not a reachable API path.');
} else if (!anyGrew) {
  note('⚠ INCONCLUSIVE: the control did not land either, so this run says nothing.');
} else {
  note('⚠⚠ E4e IS WRONG — a chain was created. Read the counts above before believing it.');
}

console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} checks reported a negative (expected for this row — read them individually)`);
process.exit(0);
