/**
 * E17 — the DEVICE PANEL's current item is the real argument, not "the UI
 * selection". Four-level instrumentation.
 *
 * ⚠ **What `e17r` established with human eyes, and it corrects a claim I had
 * called PROVEN.** `Device.selectInEditor()` does NOT select the device: the user
 * reports *"The gn-lay4 track. Nothing in the device is selected."* Row 1 worked
 * — `Group` wrapped exactly the device we chose — but the visible UI selection
 * was the TRACK throughout. So there are three separate things, and conflating
 * the first two is what produced two wrong write-ups:
 *
 *   1  the UI SELECTION      our calls only ever set it to the TRACK
 *   2  the DEVICE PANEL's current item/scope   invisible, and what a
 *      panel-focused named action actually consumes. `device.selectInEditor`
 *      sets THIS. It is why row 1 needed the call AND `focus_or_toggle_device_panel`
 *      AND the foreground.
 *   3  our CURSORS           `cursorLayer0` renders as an "ambient highlight"
 *      (user, arm C) and drives nothing.
 *
 * ⚠ **The lead this opens.** Arm B — `Channel.selectInMixer()` on a chain —
 * scoped the panel INTO the chain: *"the Polysynth chain within the instrument
 * layer now appears to have taken up the whole device panel."* That is the
 * closest anything has come to addressing a chain. And `e17q` scored that same
 * arm as "○ nothing" — while measuring tracks, devices-on-track and chains, but
 * **NOT devices inside chains.** If the panel was scoped into the chain and
 * `Duplicate` acted there, the effect was invisible to the instrument. That is
 * `e17p`'s blind-instrument failure one level deeper, and it has to be ruled out
 * before arm B is written off.
 *
 * ⇒ So: FOUR levels diffed on every trial — tracks, devices-on-track, chains,
 * and devices-INSIDE-each-chain.
 *
 * ⚠ **An AMBIENT baseline arm runs first**, firing `Duplicate` with panel focus
 * and NO selection call at all. If that alone duplicates the container, then
 * every "our setter hit the container" reading collapses into "the panel's
 * current item was already the container and our setters were inert" — which is
 * the confound `e17q` did not control and the user's question exposed.
 *
 * ⚠ Cleanup relies on `app.undo`: there is no wire method to delete a device
 * INSIDE a chain (`device.delete` reaches top level only), so if undo fails the
 * probe says so loudly rather than leaving silent residue.
 *
 * ⚠ Needs Bitwig FOREGROUND; waits rather than refusing.
 */
import { client, check, note, failureCount, pollUntil } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);

const SUBJECT = 'gn-lay4';
const SCRATCH = 'gn-A';
const POLYSYNTH = 'a9ffacb5-33e9-4fc7-8621-b1af31e410ef';
const FOCUS_DEVICES = 'focus_or_toggle_device_panel';
const FOCUS_LAUNCHER = 'focus_or_toggle_clip_launcher';

interface TrackRow { index: number; name: string; type: string; channelId: string }
const list = async () => (await req('track.list')) as { tracks: TrackRow[]; count: number };
interface DevList { devices: { index: number; name: string }[]; count: number; itemCount: number }
interface LayerRow { index: number; name: string; channelId?: string | boolean; devices: { name: string }[] }
interface LayerList { layers: LayerRow[]; count: number }

await client.connect();
const baseline = await list();
const baseIds = new Set(baseline.tracks.map((t) => t.channelId));
const subject = baseline.tracks.find((t) => t.name === SUBJECT);
const scratch = baseline.tracks.find((t) => t.name === SCRATCH);
if (!subject || !scratch) { console.log('REFUSING: fixtures missing.'); process.exit(1); }

async function pointAt(trackIndex: number): Promise<void> {
  await req('cursor.pointTrack', { cursor: '0', trackIndex });
  await pollUntil(async () => {
    const s = (await req('cursor.status', { cursor: '0' })) as { trackPosition: number };
    return s.trackPosition === trackIndex;
  }, 4000, 150);
  await new Promise((r) => setTimeout(r, 350));
}

async function devicesOn(trackIndex: number): Promise<DevList> {
  await pointAt(trackIndex);
  let last = '';
  let out: DevList = { devices: [], count: 0, itemCount: 0 };
  await pollUntil(async () => {
    out = (await req('device.list', { cursor: '0' })) as DevList;
    const n = out.devices.map((d) => d.name).join(',');
    const stable = n === last;
    last = n;
    return stable;
  }, 4000, 200);
  return out;
}

async function scopeToContainer(): Promise<void> {
  await devicesOn(subject!.index);
  await req('devcursor.selectAt', { deviceIndex: 0 });
  await pollUntil(async () => {
    const s = (await req('devcursor.status')) as { exists: boolean; name: string };
    return s.exists && s.name === 'Instrument Layer';
  }, 6000, 150);
}

/** ⚠ FOUR levels. The fourth — devices inside each chain — is the one e17q lacked. */
interface Level {
  tracks: number; devices: number; chains: number;
  inChains: number; shape: string;
}
async function levels(): Promise<Level> {
  const t = await list();
  const d = await devicesOn(subject!.index);
  await scopeToContainer();
  const c = (await req('layer.list')) as LayerList;
  const inChains = c.layers.reduce((n, x) => n + x.devices.length, 0);
  return {
    tracks: t.count, devices: d.count, chains: c.count, inChains,
    shape: c.layers.map((x) => `${x.index}:[${x.devices.map((y) => y.name).join('+') || '—'}]`).join(' '),
  };
}
const fmt = (l: Level) => `tracks=${l.tracks} devices=${l.devices} chains=${l.chains} inChains=${l.inChains}`;

async function focusDevicePanel(): Promise<void> {
  await req('app.invokeAction', { id: FOCUS_LAUNCHER });
  await new Promise((r) => setTimeout(r, 250));
  await req('app.invokeAction', { id: FOCUS_DEVICES });
  await new Promise((r) => setTimeout(r, 400));
}

// ==========================================================================
console.log('\n-- BASELINE, four levels');
const start = await levels();
note(`${SUBJECT}: ${fmt(start)}`);
note(`  ${start.shape}`);
check('PRECONDITION: one container, four chains, one device in each',
  start.devices === 1 && start.chains === 4 && start.inChains === 4, { level: fmt(start) });

// ==========================================================================
console.log('\n-- CONTROL: wait for device-panel dispatch (needs FOREGROUND)');
note('⚠ CLICK INTO BITWIG. Retrying for 90s.');
let live = false;
const t0 = Date.now();
for (let round = 1; Date.now() - t0 < 90_000; round++) {
  for (let g = 0; g < 8; g++) {
    const d = await devicesOn(scratch.index);
    if (d.count === 0) break;
    await req('device.delete', { cursor: '0', deviceIndex: d.devices[0]!.index });
    await pollUntil(async () => (await devicesOn(scratch.index)).count < d.count, 4000, 200);
  }
  await req('device.insertBitwig', { cursor: '0', uuid: POLYSYNTH });
  await pollUntil(async () => (await devicesOn(scratch.index)).count === 1, 8000, 200);
  await devicesOn(scratch.index);
  await req('device.selectInEditor', { deviceIndex: 0 });
  await focusDevicePanel();
  await req('device.selectInEditor', { deviceIndex: 0 });
  await new Promise((r) => setTimeout(r, 300));
  await req('app.invokeAction', { id: 'Group' });
  await new Promise((r) => setTimeout(r, 1600));
  if ((await devicesOn(scratch.index)).devices[0]?.name === 'Instrument Layer') {
    note(`dispatch live on round ${round}`); live = true; break;
  }
  note(`round ${round}: not dispatching`);
}
for (let g = 0; g < 8; g++) {
  const d = await devicesOn(scratch.index);
  if (d.count === 0) break;
  await req('device.delete', { cursor: '0', deviceIndex: d.devices[0]!.index });
  await pollUntil(async () => (await devicesOn(scratch.index)).count < d.count, 4000, 200);
}
check('CONTROL: named actions reach the device panel', live, {});
if (!live) { console.log('\nREFUSING — bring Bitwig forward and re-run.'); process.exit(1); }

// ==========================================================================
interface Trial { label: string; d: Record<string, number>; verdict: string }
const trials: Trial[] = [];

async function trial(label: string, setup: (() => Promise<void>) | null, actions: string[]): Promise<void> {
  const before = await levels();
  if (setup) await setup();
  await focusDevicePanel();
  if (setup) await setup();
  for (const a of actions) {
    await req('app.invokeAction', { id: a });
    await new Promise((r) => setTimeout(r, 1500));
  }
  const after = await levels();
  const d = {
    tracks: after.tracks - before.tracks,
    devices: after.devices - before.devices,
    chains: after.chains - before.chains,
    inChains: after.inChains - before.inChains,
  };
  const verdict = d.chains > 0 ? '●● CHAIN CREATED'
    : d.inChains > 0 ? '⚠ ◐ a device INSIDE a chain'
      : d.devices > 0 ? '◐ the CONTAINER'
        : d.tracks > 0 ? '⚠ a TRACK'
          : '○ nothing';
  console.log(`  ${label.padEnd(46)} Δtr=${d.tracks} Δdev=${d.devices} Δch=${d.chains} Δin=${d.inChains}  ${verdict}`);
  if (d.chains || d.inChains || d.devices || d.tracks) note(`     ${after.shape}`);
  trials.push({ label, d, verdict });

  // ⚠ Restore. There is no wire method to delete a device INSIDE a chain, so undo
  // is the only route for that level — say so loudly if it does not take.
  for (let g = 0; g < 6; g++) {
    const now = await levels();
    if (now.tracks === before.tracks && now.devices === before.devices
      && now.chains === before.chains && now.inChains === before.inChains) break;
    await req('app.undo');
    await new Promise((r) => setTimeout(r, 1400));
  }
  for (let g = 0; g < 10; g++) {
    const t = await list();
    const orphan = t.tracks.find((x) => !baseIds.has(x.channelId));
    if (!orphan) break;
    note(`⚠ ${label}: reaped orphan track ${orphan.name}`);
    await req('track.delete', { trackIndex: orphan.index });
    await pollUntil(async () => !(await list()).tracks.some((x) => x.channelId === orphan.channelId), 4000, 200);
  }
  for (let g = 0; g < 10; g++) {
    const d2 = await devicesOn(subject!.index);
    if (d2.count <= before.devices) break;
    await req('device.delete', { cursor: '0', deviceIndex: d2.devices[d2.devices.length - 1]!.index });
    await pollUntil(async () => (await devicesOn(subject!.index)).count < d2.count, 4000, 200);
  }
  await pointAt(scratch!.index);
  const restored = await levels();
  if (restored.inChains !== before.inChains || restored.chains !== before.chains) {
    note(`⚠⚠ ${label}: NOT fully restored — ${fmt(restored)} vs ${fmt(before)}`);
    note(`   ${restored.shape}`);
  }
}

const selMixer = async () => {
  await scopeToContainer();
  await req('layer.select', { layerIndex: 1, where: 'mixer' });
  await new Promise((r) => setTimeout(r, 800));
};
const selContainer = async () => {
  await devicesOn(subject.index);
  await req('device.selectInEditor', { deviceIndex: 0 });
  await new Promise((r) => setTimeout(r, 400));
};

console.log('\n======== THE TRIALS');
// ⚠ AMBIENT FIRST — no selection call at all. This is the confound e17q never
// controlled: if `Duplicate` duplicates the container with NOTHING selected by
// us, every "our setter hit the container" reading was measuring ambient state.
await trial('AMBIENT (no selection call at all)', null, ['Duplicate']);
await trial('device.selectInEditor(container)', selContainer, ['Duplicate']);
await trial('⚠ layer.select(MIXER) — scopes the panel INTO the chain', selMixer, ['Duplicate']);
await trial('⚠ layer.select(MIXER) + Select All', selMixer, ['Select All', 'Duplicate']);
await trial('⚠ layer.select(MIXER) + Copy/Paste', selMixer, ['Copy', 'Paste']);

// ==========================================================================
console.log('\n-- final state');
const end = await levels();
note(`${SUBJECT}: ${fmt(end)}`);
note(`  ${end.shape}`);
check('the fixture is back to baseline at all FOUR levels',
  end.tracks === start.tracks && end.devices === start.devices
  && end.chains === start.chains && end.inChains === start.inChains,
  { start: fmt(start), end: fmt(end) });

// ==========================================================================
console.log('\n======== VERDICT');
const ambient = trials[0]!;
const mixerArms = trials.filter((t) => t.label.includes('MIXER'));
check('⚠ the AMBIENT arm did nothing, so the other arms measured OUR setters and'
  + ' not leftover panel state',
  ambient.d.devices === 0 && ambient.d.chains === 0 && ambient.d.inChains === 0,
  { ambient: ambient.d });
const mixerReached = mixerArms.some((t) => t.d.inChains > 0 || t.d.chains > 0);
check('⚠ `selectInMixer` scoping the panel into a chain makes an action land THERE',
  mixerReached, { arms: mixerArms.map((t) => `${t.label}=${t.verdict}`) });
if (mixerArms.some((t) => t.d.chains > 0)) {
  note('⚠⚠ A CHAIN WAS CREATED — rows 3 and 4 reopen and the verdict must be re-argued.');
} else if (mixerReached) {
  note('⇒ ⚠ `selectInMixer` DOES reach inside the chain — the action landed on its');
  note('  CONTENTS. So the panel can be scoped to a chain, and e17q scored this arm ○');
  note('  only because it never measured that level. The chain ITSELF is still not the');
  note('  target, but this is much closer than anything before it.');
} else if (ambient.d.devices > 0) {
  note('⚠ The AMBIENT arm duplicated the container by itself. Then every earlier');
  note('  "our setter hit the container" reading is void — the panel already held it,');
  note('  and our layer setters were inert. e17q §3 must be rewritten.');
} else {
  note('⇒ Nothing our side reaches a chain or its contents. The finding stands and is');
  note('  now controlled for the ambient confound.');
}
console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} checks reported a negative — read individually`);
process.exit(0);
