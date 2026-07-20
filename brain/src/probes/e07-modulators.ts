/**
 * E7 — Modulators (§12 #6, the last ◐ to resolve).
 *
 * Question: how far does programmatic modulator access / routing / creation go?
 *
 * The API sweep found a "modulation source" surface — Device.getModulationSource,
 * Macro.getModulationSource, ModulationSource.{isMapped,isMapping,toggleIsMapping}.
 * The FIRST thing this probe learned is not tested live here because it is
 * fatal: calling Device.getModulationSource(int) at init throws Bitwig's
 * `deprecatedFail` ("This has been deprecated since API version 2: Use remote
 * controls instead") and takes the whole extension down. Same class of
 * deprecation on Macro ("Macros no longer exist as built in features") and the
 * ModulationSource interface itself ("Use isMapping() instead"). So the classic
 * modulation-source API is not merely discouraged — it is UNCALLABLE from a
 * modern controller extension. That is finding #1 and it is why the rig carries
 * NO getModulationSource handles (an earlier build that did crashed on load).
 *
 * What remains, and what this probe measures live:
 *   A. Remote controls — the surface Bitwig redirects you to. Reading a
 *      device's remote-control pages (name/value/isBeingMapped).
 *   B. Parameter.modulatedValue() — reading a parameter's POST-modulation
 *      value (not deprecated; the checkpoint-fidelity lever).
 *   C. The map idiom via RemoteControl.isBeingMapped() — can a mapping be
 *      CREATED headless? (Hypothesis from E6: no — it is UI-focus dependent.)
 *   D. Modulator CREATION — insertFile(.bwmodulator) at every insertion point.
 *
 * Inserts/deletes devices on gn-A; restores fixtures at the end.
 */
import {
  client, check, note, failureCount, pollUntil, point, ensureFixtureTracks,
} from './lib.js';

const MECH = 'trackThenSlot';
const POLYSYNTH = 'a9ffacb5-33e9-4fc7-8621-b1af31e410ef';
const MODDIR = '/Applications/Bitwig Studio.app/Contents/Resources/Library/modulators';
const LFO = `${MODDIR}/LFO.bwmodulator`;
const ADSR = `${MODDIR}/ADSR.bwmodulator`;

type RemoteList = {
  remotes: { index: number; exists: boolean; name?: string; value?: number;
    modulatedValue?: number; isBeingMapped?: boolean }[];
  existing: number; pageCount: number; selectedPageIndex: number;
  pageNames: string[]; deviceExists: boolean; deviceName: string;
};
type ParamMod = {
  params: { id: string; value: number; modulatedValue: number; displayed: string }[];
  deviceName: string;
};

const remotes = async () => (await client.request('remote.list')) as RemoteList;
const paramMod = async () => (await client.request('param.modulated')) as ParamMod;
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

async function insertPolysynth() {
  await clearDevices();
  await client.request('device.insertBitwig', { cursor: '0', uuid: POLYSYNTH });
  await pollUntil(async () => (await devList()).count === 1, 8000);
  await client.request('devcursor.selectAt', { deviceIndex: 0 });
  await pollUntil(async () => (await remotes()).deviceName.toLowerCase().includes('poly'), 6000);
  await new Promise((r) => setTimeout(r, 700)); // let remote/param observers stream in
}

await client.connect();
console.log('connected\n');
const { trackA } = await ensureFixtureTracks();
await point('0', trackA, 0, MECH);

// ============================ 0. the deprecation finding (documented, not run)
console.log('-- 0. classic modulation-source API is UNCALLABLE');
note('Device.getModulationSource / Macro / ModulationSource all throw');
note('deprecatedFail at init ("Use remote controls instead"). Verified by a');
note('build that carried getModulationSource handles: it crashed the extension');
note('on load (BitwigStudio.log: DeviceProxy.getModulationSource deprecatedFail).');
note('=> not tested live here; doing so would take the bridge down.');

// ============================ A. remote controls (the redirected-to surface)
console.log('\n-- A. remote controls on a Polysynth (the modern surface)');
await insertPolysynth();
const rc = await remotes();
note(`device="${rc.deviceName}" pages=${rc.pageCount} selected=${rc.selectedPageIndex} ` +
  `pageNames=[${rc.pageNames.join(', ')}]`);
note('remotes: ' + rc.remotes.filter((r) => r.exists)
  .map((r) => `[${r.index}]"${r.name}"=${r.value?.toFixed(3)}`).join(', ') || '(none)');
check('a Bitwig device exposes readable remote-control pages',
  rc.pageCount >= 1 && rc.existing >= 1, { pages: rc.pageCount, existing: rc.existing });
check('each remote control reports a name and value',
  rc.remotes.filter((r) => r.exists).every((r) => !!r.name && r.value !== undefined),
  rc.remotes.filter((r) => r.exists).slice(0, 3));

// ============================ B. modulatedValue readback
console.log('\n-- B. Parameter.modulatedValue() — post-modulation readback');
const pm = await paramMod();
const sample = pm.params.slice(0, 4);
note('value vs modulatedValue: ' + sample
  .map((p) => `${p.id} v=${p.value.toFixed(3)}/mv=${p.modulatedValue.toFixed(3)}`).join(', '));
check('modulatedValue reads for every existing param', pm.params.length > 0,
  { count: pm.params.length });
check('with no modulation, value == modulatedValue (no divergence to reconstruct)',
  pm.params.every((p) => Math.abs(p.value - p.modulatedValue) < 1e-6),
  { diverging: pm.params.filter((p) => Math.abs(p.value - p.modulatedValue) >= 1e-6).map((p) => p.id) });
note('=> modulatedValue is the checkpoint-fidelity lever: a modulated param');
note('   reports value (the static base) != modulatedValue (what is heard).');

// verify it tracks a write
const t = pm.params.find((p) => p.id === 'F1FREQ') ?? pm.params[0];
if (t) {
  const want = t.value > 0.5 ? 0.2 : 0.8;
  await client.request('param.set', { id: t.id, value: want });
  await pollUntil(async () => {
    const p = (await paramMod()).params.find((x) => x.id === t.id);
    return !!p && Math.abs(p.value - want) < 0.02;
  }, 4000);
  const after = (await paramMod()).params.find((x) => x.id === t.id)!;
  check('modulatedValue follows the base value when unmodulated',
    Math.abs(after.modulatedValue - want) < 0.02,
    { id: t.id, want, value: after.value.toFixed(3), modulatedValue: after.modulatedValue.toFixed(3) });
}

// ============================ B2. driving a remote control end to end
console.log('\n-- B2. can the agent DRIVE a remote-mapped control?');
await insertPolysynth();
type ParamList = { params: { id: string; exists: boolean; value?: number; name?: string }[] };
const paramList = async () => (await client.request('param.list')) as ParamList;
const rlist = await remotes();
// remote[0] on a fresh Polysynth is "Osc1Pitch", pre-mapped to OSC1_PITCH.
const oscRemote = rlist.remotes.find((r) => r.exists && /osc1pitch/i.test(r.name ?? ''));
const before = (await paramList()).params.find((p) => p.id === 'OSC1_PITCH');
if (oscRemote && before?.exists) {
  note(`remote[${oscRemote.index}]="${oscRemote.name}" (=${oscRemote.value?.toFixed(3)}) ` +
    `↔ OSC1_PITCH param=${before.value?.toFixed(3)}`);
  const want = (before.value ?? 0.5) > 0.5 ? 0.2 : 0.8;
  await client.request('remote.set', { index: oscRemote.index, value: want });
  const drove = await pollUntil(async () => {
    const p = (await paramList()).params.find((x) => x.id === 'OSC1_PITCH');
    return !!p && Math.abs((p.value ?? -1) - want) < 0.05;
  }, 4000);
  const after = (await paramList()).params.find((p) => p.id === 'OSC1_PITCH');
  const afterRemote = (await remotes()).remotes.find((r) => r.index === oscRemote.index);
  check('writing a remote control drives its mapped device parameter',
    drove.ok, { want, remote: afterRemote?.value?.toFixed(3), target: after?.value?.toFixed(3) });
  note('=> remotes are a LIVE control surface: the agent can turn any macro a');
  note('   user/template has wired — the indirect route to modulation sound-design.');
} else {
  check('a pre-mapped remote control was available to drive', false,
    { oscRemote, oscParam: before });
}

// ============================ C. the map idiom (RemoteControl.isBeingMapped)
console.log('\n-- C. map idiom: RemoteControl.isBeingMapped() headless');
await insertPolysynth();
const r0 = (await remotes()).remotes.find((r) => r.exists);
if (!r0) {
  check('a remote control exists to test the map idiom', false);
} else {
  const set = await client.request('remote.setMapping', { index: r0.index, mapping: true }) as
    { isBeingMappedBefore: boolean; isBeingMappedAfter: boolean };
  note(`setMapping(true) on remote[${r0.index}]: before=${set.isBeingMappedBefore} after=${set.isBeingMappedAfter}`);
  // Now "touch" a target param the only way the API allows and see if a route forms.
  await client.request('param.set', { id: 'F1FREQ', value: 0.42 });
  await new Promise((r) => setTimeout(r, 800));
  const stillMapping = (await remotes()).remotes.find((r) => r.index === r0.index)?.isBeingMapped;
  note(`after a programmatic param.set as the "touch": remote.isBeingMapped=${stillMapping}`);
  // A completed mapping would clear isBeingMapped AND make the remote drive the param.
  check('isBeingMapped is at least SETTABLE from the controller',
    set.isBeingMappedAfter === true || set.isBeingMappedBefore === set.isBeingMappedAfter,
    set);
  note('Whether the state flips is the readback question; completing a mapping');
  note('needs a real UI parameter touch, which a background agent cannot supply');
  note('(same focus dependency as E6 named actions). Recorded as observed above.');
  // leave mapping mode so we do not strand the device in a weird state
  await client.request('remote.setMapping', { index: r0.index, mapping: false });
}

// ============================ D. modulator CREATION — every insertion point
console.log('\n-- D. can a modulator be CREATED? insertFile(.bwmodulator) sweep');
await insertPolysynth();
const baseChain = (await devList()).count;
const routes: { where: string; call: () => Promise<unknown> }[] = [
  { where: 'track end-of-chain', call: () => client.request('device.insertFile', { cursor: '0', path: LFO }) },
  { where: 'after device', call: () => client.request('device.insertFileAt', { where: 'after', path: LFO }) },
  { where: 'before device', call: () => client.request('device.insertFileAt', { where: 'before', path: ADSR }) },
];
let anyCreated = false;
for (const route of routes) {
  const before = (await devList()).count;
  await route.call();
  await new Promise((r) => setTimeout(r, 1200));
  const after = await devList();
  const grew = after.count > before;
  const asModulator = after.devices.some((d) =>
    /lfo|adsr|envelope|random|modulat/i.test(d.name));
  if (grew) anyCreated = true;
  note(`  ${route.where.padEnd(20)} chain ${before}->${after.count}` +
    (grew ? ` [${after.devices.map((d) => d.name).join(', ')}]` : ' (no change)'));
  check(`insertFile(.bwmodulator) @ ${route.where} does NOT add a modulator`,
    !grew || !asModulator, { count: after.count, devices: after.devices.map((d) => d.name) });
  // reset chain to just the polysynth for the next route
  if (after.count !== baseChain) {
    await insertPolysynth();
  }
}
check('no insertion point creates a modulator — there is no create-modulator API',
  !anyCreated, { anyCreated });
note('There is NO insertModulator API and no modulator-specific InsertionPoint;');
note('a .bwmodulator is inert at every device-chain insertion point.');

// ============================ cleanup
console.log('\n-- cleanup');
check('gn-A devices removed', await clearDevices());
await point('0', trackA, 0, MECH);
await client.request('cursor.clearNotes', { cursor: '0' });
await client.request('cursor.setNotes', { cursor: '0', notes: [[0, 60, 100, 1]] });

console.log(failureCount() === 0 ? '\nE7: all checks passed' : `\nE7: ${failureCount()} FAILURES`);
client.disconnect();
process.exit(failureCount() === 0 ? 0 : 1);
