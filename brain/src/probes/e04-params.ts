/**
 * E4 — Direct parameter layer (§6a differentiator). Fully autonomous.
 *
 *  A. enumeration: named + valued Polysynth params readable at once (>8)
 *  B. read/write round-trip; take-over strategy characterization
 *  C. repointing: device cursor moves across devices in a chain, handles follow
 *  D. cross-track repoint + device-cursor pinning
 *  E. insert -> param-readable timing
 *  F. type specificity: SpecificBitwigDevice view is empty on a non-match
 *
 * Uses gn-A/gn-B. Inserts + deletes its own devices; restores fixtures.
 */
import {
  client, check, note, failureCount, pollUntil, point, ensureFixtureTracks,
} from './lib.js';

const MECH = 'trackThenSlot';
const DEV = {
  Polysynth: 'a9ffacb5-33e9-4fc7-8621-b1af31e410ef',
  Polymer: '8f58138b-03aa-4e9d-83bd-a038c99a4ed5',
};
const near = (a: number, b: number, eps = 0.02) => Math.abs(a - b) <= eps;

type Param = { id: string; exists: boolean; name?: string; value?: number; displayed?: string };
type ParamList = { params: Param[]; total: number; existing: number; deviceExists: boolean; deviceName: string };
const paramList = async () => (await client.request('param.list')) as ParamList;
const readParam = async (id: string) => (await paramList()).params.find((p) => p.id === id)!;
const devList = async (cursor: string) =>
  (await client.request('device.list', { cursor })) as { devices: { index: number; name: string }[]; count: number };

async function clearDevices(cursor: string) {
  let l = await devList(cursor);
  for (let g = 0; g < 8 && l.count > 0; g++) {
    await client.request('device.delete', { cursor, deviceIndex: l.devices[0].index });
    await pollUntil(async () => (await devList(cursor)).count < l.count, 4000);
    l = await devList(cursor);
  }
  return l.count === 0;
}
// device+params live once the cursor device exists and at least the anchor
// param (F1FREQ) resolves
const paramsLive = async () => {
  const pl = await paramList();
  return pl.deviceExists && pl.params.find((p) => p.id === 'F1FREQ')?.exists === true;
};

await client.connect();
console.log('connected\n');
const { trackA, trackB } = await ensureFixtureTracks();
note(`fixture: gn-A=${trackA}, gn-B=${trackB}`);

// ============================================================ Phase A
console.log('\n-- phase A: enumeration (named + valued params, >8 ceiling)');
await point('0', trackA, 0, MECH);
check('gn-A device chain cleared', await clearDevices('0'));

const tInsert = Date.now();
await client.request('device.insertBitwig', { cursor: '0', uuid: DEV.Polysynth });
const devUp = await pollUntil(async () => (await devList('0')).count === 1, 6000);
check('Polysynth inserted', devUp.ok, { settleMs: devUp.ms });
const live = await pollUntil(paramsLive, 6000);
const tReady = Date.now() - tInsert;
const pl = await paramList();
note(`device cursor: exists=${pl.deviceExists} name="${pl.deviceName}"; params live in ~${tReady}ms`);
check('device cursor followed to inserted Polysynth', live.ok && pl.deviceName.includes('Poly'), pl.deviceName);

const missing = pl.params.filter((p) => !p.exists).map((p) => p.id);
note(`param handles resolving: ${pl.existing}/${pl.total}; unresolved IDs: [${missing.join(', ')}]`);
check('well past the 8-per-remote-page ceiling (§6a broken)', pl.existing > 8, { existing: pl.existing });
const withNames = pl.params.filter((p) => p.exists && p.name && p.name.length > 0).length;
const withDisplay = pl.params.filter((p) => p.exists && p.displayed && p.displayed.length > 0).length;
check('resolved params self-describe (name + displayed value)',
  withNames === pl.existing && withDisplay === pl.existing, { withNames, withDisplay, existing: pl.existing });
note('sample: ' + pl.params.filter((p) => p.exists).slice(0, 6).map((p) => `${p.id}="${p.name}"=${p.displayed}`).join(', '));

// ============================================================ Phase B
console.log('\n-- phase B: read/write round-trip + take-over characterization');
const f1 = await readParam('F1FREQ');
note(`F1FREQ initial: value=${f1.value?.toFixed(4)} displayed="${f1.displayed}"`);

// B1: smoothed set() — expected swallowed by controller take-over strategy
await client.request('param.set', { id: 'F1FREQ', value: 0.15, mode: 'smoothed' });
await new Promise((r) => setTimeout(r, 400));
const afterSmoothed = await readParam('F1FREQ');
note(`after set(0.15, smoothed): value=${afterSmoothed.value?.toFixed(4)} (unchanged => take-over swallows plain set)`);

// B2: setImmediately — expected to work
await client.request('param.set', { id: 'F1FREQ', value: 0.25 });
const lo = await pollUntil(async () => near((await readParam('F1FREQ')).value!, 0.25), 2000);
const f1lo = await readParam('F1FREQ');
check('setImmediately F1FREQ=0.25 round-trips', lo.ok, { value: f1lo.value, displayed: f1lo.displayed });
await client.request('param.set', { id: 'F1FREQ', value: 0.8 });
const hi = await pollUntil(async () => near((await readParam('F1FREQ')).value!, 0.8), 2000);
const f1hi = await readParam('F1FREQ');
check('setImmediately F1FREQ=0.8 round-trips', hi.ok, { value: f1hi.value, displayed: f1hi.displayed });
check('displayed value tracks the write', f1lo.displayed !== f1hi.displayed, { lo: f1lo.displayed, hi: f1hi.displayed });
check('smoothed set() was indeed swallowed (take-over confirmed)',
  near(afterSmoothed.value!, f1.value!), { was: f1.value, afterSmoothed: afterSmoothed.value });
await client.request('param.set', { id: 'OSCMIX', value: 0.9 });
await pollUntil(async () => near((await readParam('OSCMIX')).value!, 0.9), 2000);
check('OSCMIX set independently, F1FREQ still 0.8', near((await readParam('F1FREQ')).value!, 0.8));

// ============================================================ Phase C
console.log('\n-- phase C: device-cursor repointing within a chain');
await client.request('device.insertBitwig', { cursor: '0', uuid: DEV.Polysynth });
const two = await pollUntil(async () => (await devList('0')).count === 2, 6000);
check('second Polysynth inserted (chain=2)', two.ok);
await client.request('devcursor.selectAt', { deviceIndex: 1 });
await pollUntil(paramsLive, 4000);
await client.request('param.set', { id: 'F1FREQ', value: 0.1 });
const atOne = await pollUntil(async () => near((await readParam('F1FREQ')).value!, 0.1), 2000);
check('device[1] F1FREQ set to 0.1', atOne.ok, { value: (await readParam('F1FREQ')).value });
await client.request('devcursor.selectAt', { deviceIndex: 0 });
const backToZero = await pollUntil(async () => near((await readParam('F1FREQ')).value!, 0.8), 3000);
check('repoint to device[0]: handles now read device[0] (0.8), independent of device[1]',
  backToZero.ok, { value: (await readParam('F1FREQ')).value });

// ============================================================ Phase D
console.log('\n-- phase D: cross-track repoint + holding a device address');
await point('0', trackB, 0, MECH);
check('cursor0 track -> gn-B', await clearDevices('0'));
await client.request('device.insertBitwig', { cursor: '0', uuid: DEV.Polysynth });
await pollUntil(async () => (await devList('0')).count === 1, 6000);
const onB = await pollUntil(paramsLive, 6000);
check('device cursor followed cursor-track to gn-B Polysynth', onB.ok);
await client.request('param.set', { id: 'GAIN', value: 0.33 });
await pollUntil(async () => near((await readParam('GAIN')).value!, 0.33), 2000);
note(`GAIN on gn-B device set to 0.33`);

// D1: robust hold = pin the TRACK; device params stay live under selection churn
await client.request('cursor.pin', { cursor: '0', pinned: true });
// move the user selection elsewhere via the follower cursor
await client.request('slot.select', { trackIndex: trackA, slotIndex: 0, mechanism: 'slot' });
await new Promise((r) => setTimeout(r, 400));
const heldByTrackPin = near((await readParam('GAIN')).value!, 0.33) && (await paramList()).deviceExists;
check('track-pin holds the device address: params still read gn-B (GAIN=0.33) under selection change',
  heldByTrackPin, { gain: (await readParam('GAIN')).value });

// D2: document that device-level isPinned does NOT survive a track repoint
await client.request('devcursor.pin', { pinned: true });
await client.request('cursor.pin', { cursor: '0', pinned: false });
await point('0', trackA, 0, MECH); // move the parent track cursor to gn-A
await new Promise((r) => setTimeout(r, 500));
const afterTrackMove = (await readParam('GAIN')).value!;
const devStatus = (await client.request('devcursor.status')) as any;
note(`device isPinned=${devStatus.isPinned}, but after moving parent track cursor to gn-A, GAIN reads ${afterTrackMove?.toFixed(3)} ` +
     `(gn-B value was 0.33) => device cursor is SUBORDINATE to its track cursor`);
check('FINDING: device-level pin does NOT survive parent track repoint (use track-pin + selectAt instead)',
  !near(afterTrackMove, 0.33), { afterTrackMove });
await client.request('devcursor.pin', { pinned: false });

// ============================================================ Phase F
console.log('\n-- phase F: SpecificBitwigDevice view is type-specific');
await point('0', trackA, 0, MECH);
await clearDevices('0');
await client.request('device.insertBitwig', { cursor: '0', uuid: DEV.Polymer });
await pollUntil(async () => (await devList('0')).count === 1, 6000);
await client.request('devcursor.selectInChannel', {});
await new Promise((r) => setTimeout(r, 800));
const onPolymer = await paramList();
note(`device cursor on Polymer: exists=${onPolymer.deviceExists} name="${onPolymer.deviceName}" polysynthParamsResolving=${onPolymer.existing}`);
check('Polysynth param view is EMPTY on a Polymer (view is device-type-specific)', onPolymer.existing === 0,
  { existing: onPolymer.existing });

// ============================================================ cleanup
console.log('\n-- cleanup');
await point('0', trackA, 0, MECH);
check('gn-A devices removed', await clearDevices('0'));
await point('0', trackB, 0, MECH);
check('gn-B devices removed', await clearDevices('0'));
await point('0', trackA, 0, MECH);
await client.request('cursor.clearNotes', { cursor: '0' });
await client.request('cursor.setNotes', { cursor: '0', notes: [[0, 60, 100, 1]] });

console.log(failureCount() === 0 ? '\nE4: all checks passed' : `\nE4: ${failureCount()} FAILURES`);
note(`(2 of 16 harvested IDs unresolved is expected — see phase A "unresolved IDs")`);
client.disconnect();
process.exit(failureCount() === 0 ? 0 : 1);
