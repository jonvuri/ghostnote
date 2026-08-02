/**
 * E17 row 2 — can a device LAYER be duplicated? E4d routes 1 and 2, re-run with
 * the precondition PROVED.
 *
 * ⚠ Why an eleven-day-old ○ is being re-run rather than cited. E4d recorded
 * `DeviceLayer.duplicateObject()` and `Channel.duplicate()` as silent no-ops.
 * Both went through `rig.layerBank0`, which FOLLOWS `cursorDevice0` — and E16o
 * then discovered that aiming that bank at a device with no layers produces a
 * silent no-op **byte-identical to an API refusal**. That very shape nearly
 * published a false negative on the `moveDevices` row, caught only because the
 * probe asserted its precondition separately from its question. E4d predates
 * that finding, asserted nothing, and recorded no fixture state. So the ○ may be
 * real, or it may be a probe that was pointed at the wrong object.
 *
 * ⇒ Every call here is preceded by a proof that the container is the selected
 * device AND that `layer.list` reports the chains it is about to duplicate. If
 * the verbs still no-op, the ○ is real and now rests on an asserted precondition.
 *
 * ⚠ TWO fixture states, because E4d recorded neither and they can fail for
 * different reasons:
 *   POPULATED  gn-lay's Instrument Layer, 2 chains each holding a Polysynth
 *   EMPTY      a fresh FX Layer, which ships with exactly one EMPTY chain (E4c)
 *
 * ⚠ And a VERB CONTROL, which is what makes a negative mean anything (the e16n
 * discipline). `Device.duplicateObject()` on a container is E4d route 6 ● — the
 * SAME verb, from the same supertype, on a neighbouring object. If it fires here
 * and the layer calls do not, the ○ is object-specific. If it does not fire
 * either, the verb is dead in this session and the row measured nothing.
 *
 * Silent: nothing is launched and the transport is never touched.
 */
import { client, check, note, failureCount, pollUntil } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);

const FX_LAYER = 'a0913b7f-096b-4ac9-bddd-33c775314b42';
const SUBJECT = 'gn-lay';
const SCRATCH = 'gn-A';

type TrackRow = { index: number; name: string; channelId: string; type: string };
const list = async () => ((await req('track.list')) as { tracks: TrackRow[] }).tracks;

interface LayerRow { index: number; name: string; channelId?: string | boolean; devices: { name: string }[] }
interface LayerList { layers: LayerRow[]; count: number; hasLayers?: boolean | string }
const layers = async () => (await req('layer.list')) as LayerList;
const devices = async () =>
  (await req('device.list', { cursor: '0' })) as { devices: { index: number; name: string }[]; count: number };

const shape = (l: LayerList) =>
  l.layers.map((x) => `${x.index}:${x.name}[${x.devices.map((d) => d.name).join('+') || '—'}]`).join(' ');

/**
 * Point the device cursor at a container and REFUSE unless it landed.
 *
 * ⚠ This is the whole point of the row. `rig.layerBank0` follows `cursorDevice0`,
 * so the cursor is a hidden argument to every layer call — read AND write. The
 * e16o trap is aiming it at something with no layers and reading the resulting
 * silence as a refusal.
 */
async function selectContainer(trackIndex: number, deviceIndex: number, expect: string): Promise<void> {
  await req('cursor.pointTrack', { cursor: '0', trackIndex });
  await req('devcursor.selectAt', { deviceIndex });
  const ok = await pollUntil(async () => {
    const s = (await req('devcursor.status')) as { exists: boolean; name: string };
    return s.exists && s.name.includes(expect);
  }, 6000, 100);
  if (!ok.ok) {
    const s = await req('devcursor.status');
    console.log(`\nREFUSING: the device cursor is not on a "${expect}" — it reports ${JSON.stringify(s)}.`);
    console.log('Every layer call reaches its target through this cursor, so proceeding produces');
    console.log('silent no-ops that are byte-identical to API refusals (the e16o trap), which is');
    console.log('exactly the defect this row exists to rule out of E4d.');
    process.exit(1);
  }
}

/** Fire a duplication verb and report the layer-count DIFF, never the return value. */
async function tryVerb(
  label: string, method: string, layerIndex: number,
  trackIndex: number, deviceIndex: number, expect: string,
): Promise<{ before: number; after: number; grew: boolean }> {
  await selectContainer(trackIndex, deviceIndex, expect);
  const before = await layers();
  note(`${label}: BEFORE count=${before.count}  ${shape(before)}`);
  await req(method, { layerIndex });
  // ⚠ Poll rather than sleep-and-read: a structural op settles across turns (E8),
  // and a fixed wait that is too short reports a real ● as a ○.
  const grew = await pollUntil(async () => {
    await selectContainer(trackIndex, deviceIndex, expect);
    return (await layers()).count > before.count;
  }, 4000, 250);
  await selectContainer(trackIndex, deviceIndex, expect);
  const after = await layers();
  note(`${label}: AFTER  count=${after.count}  ${shape(after)}   (${grew.ms} ms)`);
  return { before: before.count, after: after.count, grew: grew.ok };
}

await client.connect();
const tracks = await list();
const subject = tracks.find((t) => t.name === SUBJECT);
const scratch = tracks.find((t) => t.name === SCRATCH);
if (!subject) { console.log(`REFUSING: ${SUBJECT} not found.`); process.exit(1); }
if (!scratch) { console.log(`REFUSING: ${SCRATCH} not found.`); process.exit(1); }

// ==========================================================================
console.log('\n======== ARM P — POPULATED: gn-lay\'s Instrument Layer, 2 filled chains');
await selectContainer(subject.index, 0, 'Layer');
const p0 = await layers();
note(`chains: ${shape(p0)}`);
note(`⚠ layer channelIds: ${p0.layers.map((x) => `${x.index}:${x.channelId}`).join(', ')}`);
check('PRECONDITION: the container is selected and reports its chains — so a no-op'
  + ' below cannot be E4d\'s wrong-cursor artifact',
  p0.count === 2, { count: p0.count, hasLayers: p0.hasLayers });
check('PRECONDITION: both chains are POPULATED, so an empty-chain excuse does not apply',
  p0.layers.every((x) => x.devices.length > 0), { shape: shape(p0) });
if (p0.count !== 2) {
  console.log('REFUSING: gn-lay does not have its 2 chains; the fixture is not what the row assumes.');
  process.exit(1);
}

const pRoute1 = await tryVerb('  route 1 duplicateObject ', 'layer.duplicate', 0, subject.index, 0, 'Layer');
const pRoute2 = await tryVerb('  route 2 Channel.duplicate', 'layer.duplicateChannel', 0, subject.index, 0, 'Layer');

// ==========================================================================
console.log('\n======== ARM E — EMPTY: a fresh FX Layer, which ships with 1 empty chain');
await req('cursor.pointTrack', { cursor: '0', trackIndex: scratch.index });
const dBefore = await devices();
note(`${SCRATCH} chain before: ${dBefore.devices.map((d) => d.name).join(', ') || '(empty)'}`);
await req('device.insertBitwig', { cursor: '0', uuid: FX_LAYER });
const inserted = await pollUntil(async () => (await devices()).count === dBefore.count + 1, 8000, 200);
const dAfter = await devices();
const fxIndex = dAfter.devices.findIndex((d) => d.name === 'FX Layer');
check('PRECONDITION: an FX Layer was inserted, so the empty arm has a subject',
  inserted.ok && fxIndex >= 0, { count: dAfter.count, names: dAfter.devices.map((d) => d.name) });
if (fxIndex < 0) { console.log('REFUSING: no FX Layer to work with.'); process.exit(1); }

await selectContainer(scratch.index, fxIndex, 'FX Layer');
const e0 = await layers();
note(`chains: ${shape(e0)}`);
check('PRECONDITION: the FX Layer ships with exactly 1 chain, and it is EMPTY (E4c, re-confirmed)',
  e0.count === 1 && e0.layers[0]?.devices.length === 0, { count: e0.count, shape: shape(e0) });

const eRoute1 = await tryVerb('  route 1 duplicateObject ', 'layer.duplicate', 0, scratch.index, fxIndex, 'FX Layer');
const eRoute2 = await tryVerb('  route 2 Channel.duplicate', 'layer.duplicateChannel', 0, scratch.index, fxIndex, 'FX Layer');

// ==========================================================================
console.log('\n======== VERB CONTROL — the SAME verb on a neighbouring object (E4d route 6 ●)');
note('`Device.duplicateObject()` on the container. If this fires and the layer calls did');
note('not, the ○ is about layers. If it does not fire either, the verb is dead in this');
note('session and the arms above measured nothing — which is E6\'s missing control.');
await req('cursor.pointTrack', { cursor: '0', trackIndex: scratch.index });
const cBefore = await devices();
await req('device.duplicate', { deviceIndex: fxIndex });
const cGrew = await pollUntil(async () => (await devices()).count > cBefore.count, 6000, 250);
const cAfter = await devices();
note(`devices ${cBefore.count} -> ${cAfter.count}: ${cAfter.devices.map((d) => d.name).join(', ')}`);
check('⚠ VERB CONTROL: duplicateObject() DOES fire in this session, on a container device',
  cGrew.ok, { before: cBefore.count, after: cAfter.count, ms: cGrew.ms });

// ==========================================================================
console.log('\n-- cleanup: remove every FX Layer this probe added to ' + SCRATCH);
for (let guard = 0; guard < 6; guard++) {
  await req('cursor.pointTrack', { cursor: '0', trackIndex: scratch.index });
  const d = await devices();
  const victim = d.devices.find((x) => x.name === 'FX Layer');
  if (!victim) break;
  await req('device.delete', { cursor: '0', deviceIndex: victim.index });
  await pollUntil(async () => (await devices()).count < d.count, 4000, 200);
}
await req('cursor.pointTrack', { cursor: '0', trackIndex: scratch.index });
const dEnd = await devices();
check('cleanup: no FX Layer left behind on ' + SCRATCH,
  !dEnd.devices.some((x) => x.name === 'FX Layer'), { names: dEnd.devices.map((x) => x.name) });

// ==========================================================================
console.log('\n======== VERDICT');
const anyGrew = pRoute1.grew || pRoute2.grew || eRoute1.grew || eRoute2.grew;
console.log(`  populated  route 1 duplicateObject   ${pRoute1.before} -> ${pRoute1.after}  ${pRoute1.grew ? '●' : '○'}`);
console.log(`  populated  route 2 Channel.duplicate ${pRoute2.before} -> ${pRoute2.after}  ${pRoute2.grew ? '●' : '○'}`);
console.log(`  empty      route 1 duplicateObject   ${eRoute1.before} -> ${eRoute1.after}  ${eRoute1.grew ? '●' : '○'}`);
console.log(`  empty      route 2 Channel.duplicate ${eRoute2.before} -> ${eRoute2.after}  ${eRoute2.grew ? '●' : '○'}`);
console.log(`  VERB CONTROL duplicateObject on a Device            ${cGrew.ok ? '●' : '○'}`);
if (!anyGrew && cGrew.ok) {
  note('⇒ E4d routes 1 and 2 STAND, now on an asserted precondition and in both fixture states,');
  note('  bracketed by a positive control on the same verb. The ○ is about LAYERS.');
} else if (!anyGrew && !cGrew.ok) {
  note('⚠ INCONCLUSIVE: the control did not fire either, so this run says nothing about layers.');
} else {
  note('⚠⚠ E4d IS WRONG — a layer duplicated. Read the counts above before believing it.');
}

console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} FAILURES`);
process.exit(failureCount() === 0 ? 0 : 1);
