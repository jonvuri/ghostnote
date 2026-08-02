/**
 * E17 — does `Device.selectInEditor()` do ANYTHING? The discriminator row 1
 * should have had.
 *
 * ⚠ **Why this is owed.** `e17s`'s AMBIENT arm fired `Duplicate` with no
 * selection call at all and duplicated the container — indistinguishable from
 * the `device.selectInEditor(container)` arm. And `e17r` showed with human eyes
 * that the call does not visibly select anything: *"The gn-lay4 track. Nothing in
 * the device is selected."*
 *
 * ⇒ So row 1's evidence does not establish what I recorded. `e17d` selected
 * device **0** of two and `Group` wrapped a device — but **device 0 is also the
 * ambient default**, so "the action obeyed our selection" and "the action took
 * the first device and our call was inert" predict exactly the same outcome.
 * Recording it as the former was the same error the whole session keeps making:
 * a result consistent with two mechanisms, written up as one.
 *
 * **The discriminator is one line of design:** put TWO DISTINGUISHABLE devices on
 * the track, select the SECOND, and see which one gets wrapped.
 *
 *   wraps the Organ (index 1)      ⇒ ● `selectInEditor` drives the panel
 *   wraps the Polysynth (index 0)  ⇒ ○ it is INERT; the panel takes the first
 *                                    device and row 1's write-up needs amending
 *
 * ⚠ Distinguishable ON PURPOSE — `e17d` used two Polysynths, which is precisely
 * why it could not tell these apart. Name the survivor, never count it (e16t).
 *
 * ⚠ Both arms are run, ambient and selected, so the comparison is within one
 * sitting rather than against a remembered number.
 *
 * ⚠ Needs Bitwig FOREGROUND; waits rather than refusing.
 */
import { client, check, note, failureCount, pollUntil } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);

const SCRATCH = 'gn-A';
const POLYSYNTH = 'a9ffacb5-33e9-4fc7-8621-b1af31e410ef';
const ORGAN = 'f2dcfe9a-7b66-4c84-984a-b25685a1c21a';
const FOCUS_DEVICES = 'focus_or_toggle_device_panel';
const FOCUS_LAUNCHER = 'focus_or_toggle_clip_launcher';

interface TrackRow { index: number; name: string; type: string; channelId: string }
const list = async () => (await req('track.list')) as { tracks: TrackRow[]; count: number };
interface DevList { devices: { index: number; name: string }[]; count: number }
interface LayerList { layers: { index: number; name: string; devices: { name: string }[] }[]; count: number }

await client.connect();
const baseline = await list();
const baseIds = new Set(baseline.tracks.map((t) => t.channelId));
const scratch = baseline.tracks.find((t) => t.name === SCRATCH);
if (!scratch) { console.log('REFUSING: gn-A not found.'); process.exit(1); }

async function devices(): Promise<DevList> {
  await req('cursor.pointTrack', { cursor: '0', trackIndex: scratch!.index });
  await pollUntil(async () => {
    const s = (await req('cursor.status', { cursor: '0' })) as { trackPosition: number };
    return s.trackPosition === scratch!.index;
  }, 4000, 150);
  let last = '';
  let out: DevList = { devices: [], count: 0 };
  await pollUntil(async () => {
    out = (await req('device.list', { cursor: '0' })) as DevList;
    const n = out.devices.map((d) => d.name).join(',');
    const stable = n === last;
    last = n;
    return stable;
  }, 4000, 200);
  return out;
}

async function clear(): Promise<void> {
  for (let g = 0; g < 12; g++) {
    const d = await devices();
    if (d.count === 0) break;
    await req('device.delete', { cursor: '0', deviceIndex: d.devices[0]!.index });
    await pollUntil(async () => (await devices()).count < d.count, 4000, 200);
  }
}

async function reap(): Promise<void> {
  for (let g = 0; g < 10; g++) {
    const t = await list();
    const orphan = t.tracks.find((x) => !baseIds.has(x.channelId));
    if (!orphan) break;
    note(`⚠ reaped orphan track ${orphan.name}`);
    await req('track.delete', { trackIndex: orphan.index });
    await pollUntil(async () => !(await list()).tracks.some((x) => x.channelId === orphan.channelId), 4000, 200);
  }
}

async function focusDevicePanel(): Promise<void> {
  await req('app.invokeAction', { id: FOCUS_LAUNCHER });
  await new Promise((r) => setTimeout(r, 250));
  await req('app.invokeAction', { id: FOCUS_DEVICES });
  await new Promise((r) => setTimeout(r, 400));
}

/** Fresh [Polysynth, Organ] — DISTINGUISHABLE, which is the whole point. */
async function fixture(): Promise<void> {
  await clear();
  for (const uuid of [POLYSYNTH, ORGAN]) {
    const before = await devices();
    await req('device.insertBitwig', { cursor: '0', uuid });
    await pollUntil(async () => (await devices()).count > before.count, 8000, 200);
  }
}

/**
 * Fire `Group` and report WHICH device got wrapped, by looking inside the
 * container that appears — not by counting.
 */
async function whichGotWrapped(selectIndex: number | null): Promise<string> {
  await fixture();
  const before = await devices();
  if (before.devices.map((d) => d.name).join(',') !== 'Polysynth,Organ') {
    note(`⚠ fixture is [${before.devices.map((d) => d.name).join(', ')}], expected [Polysynth, Organ]`);
  }
  if (selectIndex !== null) await req('device.selectInEditor', { deviceIndex: selectIndex });
  await focusDevicePanel();
  if (selectIndex !== null) await req('device.selectInEditor', { deviceIndex: selectIndex });
  await new Promise((r) => setTimeout(r, 350));
  await req('app.invokeAction', { id: 'Group' });
  await new Promise((r) => setTimeout(r, 1800));
  const after = await devices();
  await reap();
  const containerAt = after.devices.findIndex((d) => d.name === 'Instrument Layer');
  if (containerAt < 0) {
    note(`   no container appeared: [${after.devices.map((d) => d.name).join(', ')}]`);
    return '(none)';
  }
  await req('devcursor.selectAt', { deviceIndex: containerAt });
  await pollUntil(async () => {
    const s = (await req('devcursor.status')) as { exists: boolean; name: string };
    return s.exists && s.name === 'Instrument Layer';
  }, 6000, 150);
  const l = (await req('layer.list')) as LayerList;
  const inside = l.layers.flatMap((x) => x.devices.map((y) => y.name)).join('+') || '(empty)';
  note(`   track now [${after.devices.map((d) => d.name).join(', ')}]  container holds [${inside}]`);
  return inside;
}

// ==========================================================================
console.log('\n-- CONTROL: wait for device-panel dispatch (needs FOREGROUND)');
note('⚠ CLICK INTO BITWIG. Retrying for 90s.');
let live = false;
const t0 = Date.now();
for (let round = 1; Date.now() - t0 < 90_000; round++) {
  await clear();
  await req('device.insertBitwig', { cursor: '0', uuid: POLYSYNTH });
  await pollUntil(async () => (await devices()).count === 1, 8000, 200);
  await devices();
  await req('device.selectInEditor', { deviceIndex: 0 });
  await focusDevicePanel();
  await req('device.selectInEditor', { deviceIndex: 0 });
  await new Promise((r) => setTimeout(r, 300));
  await req('app.invokeAction', { id: 'Group' });
  await new Promise((r) => setTimeout(r, 1600));
  if ((await devices()).devices[0]?.name === 'Instrument Layer') {
    note(`dispatch live on round ${round}`); live = true; break;
  }
  note(`round ${round}: not dispatching`);
}
await reap();
check('CONTROL: named actions reach the device panel', live, {});
if (!live) { console.log('\nREFUSING — bring Bitwig forward and re-run.'); process.exit(1); }

// ==========================================================================
console.log('\n======== THE DISCRIMINATOR — fixture is [Polysynth, Organ] every time');
console.log('\n-- arm 1: AMBIENT (no selectInEditor at all)');
const ambient = await whichGotWrapped(null);
console.log('\n-- arm 2: select index 0 (Polysynth) — the row-1 case, ambiguous by construction');
const sel0 = await whichGotWrapped(0);
console.log('\n-- arm 3: ⚠ select index 1 (ORGAN) — the arm that discriminates');
const sel1 = await whichGotWrapped(1);

await clear();
await reap();

// ==========================================================================
console.log('\n======== VERDICT');
console.log(`  AMBIENT, nothing selected        wrapped: ${ambient}`);
console.log(`  selectInEditor(0) = Polysynth    wrapped: ${sel0}`);
console.log(`  ⚠ selectInEditor(1) = ORGAN      wrapped: ${sel1}`);
const drives = sel1.includes('Organ') && !sel1.includes('Polysynth');
check('⚠ `Device.selectInEditor()` DRIVES the device panel — selecting index 1 wrapped'
  + ' the ORGAN, not the ambient first device',
  drives, { ambient, sel0, sel1 });
if (drives) {
  note('⇒ ● The call works. Row 1\'s write-up stands, and `device.selectInEditor` really is');
  note('  the enabling call it was recorded as — now proven by a discriminating fixture');
  note('  rather than by an outcome two mechanisms both predict.');
} else if (sel1 === ambient) {
  note('⇒ ⚠⚠ `Device.selectInEditor()` is INERT. The device panel simply acts on its own');
  note('  first/current device, and every "we selected X then fired" claim in E17 —');
  note('  including row 1\'s — needs restating as "the panel\'s current device was X".');
  note('  ⚠ It does NOT change row 1\'s verdict: `Group` still creates a one-chain');
  note('  container. It changes who chose the victim.');
} else {
  note(`⇒ ⚠ Neither reading fits: ambient=${ambient} sel0=${sel0} sel1=${sel1}. Do not`);
  note('  record a verdict; this needs its own sitting.');
}
console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} checks reported a negative — read individually`);
process.exit(0);
