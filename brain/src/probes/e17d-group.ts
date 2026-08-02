/**
 * E17 row 1 — can DEVICES be GROUPED into a layer by a named action?
 *
 * ⚠ **This is the strongest lead in the session, and it is E16j's exact shape.**
 * E6 concluded named actions were "unusable AND hazardous"; E16j overturned it
 * and found `Create Group Track` and `Group` — a UI gesture with a hotkey that
 * turned out to be a named action after all, and the thing that unblocked the
 * whole track-native model. The user reports that grouping devices into a layer
 * likewise has a menu item and a hotkey in Bitwig's own UI, so the capability
 * exists; the only question is whether it is reachable.
 *
 * E4d route 7's ○ swept for the wrong concept — it asked which actions *create
 * chains*. `e17a` re-swept the SAME 781-action list (identical size, so it is
 * demonstrably the same curated subset) for the concept, and `Group` (id `Group`,
 * Editing) is in it.
 *
 * ⚠ **TWO things had to be true before this row could be probed at all, and the
 * first two attempts got each of them wrong.**
 *
 * 1. **The UI DEVICE selection has to be settable, and it was not on the wire.**
 *    `devcursor.selectAt` calls `CursorDevice.selectDevice()` on a cursor track
 *    created with `shouldFollowSelection=false` — it moves OUR handle and never
 *    touches Bitwig's selection. `device.selectInEditor` (new this session) is
 *    the actual setter. So row 1 was never ○; it was unreachable, and every
 *    argument about it concerned a selection nobody had set.
 *
 * 2. ⚠ **Editing actions dispatch against whichever PANEL HOLDS FOCUS**, and
 *    that is E6's own data rather than a guess. E6 diag4 found `Duplicate` would
 *    only touch a CLIP after `focus_or_toggle_clip_launcher`; diag7 found the
 *    same action hitting the TRACK selection without it. E16j read the two
 *    together and concluded Editing actions "dispatch against whatever panel
 *    holds focus rather than failing to fire". The first two attempts at this row
 *    fired `Group` and `Duplicate` with no panel focused and got nothing from
 *    either — which is that mechanism, not a capability answer.
 *
 * ⇒ So the row focuses the DEVICE panel first, which is where Bitwig's own
 * device-grouping gesture lives.
 *
 * ⚠ **The controls, and why there are three.** There is NO readback for the UI
 * device selection — nothing in the API reports it, and the two observers that
 * would (`addHasSelectedDeviceObserver`, `addIsSelectedInEditorObserver`) cannot
 * be added without another restart under rule 13. So a bare ○ has three readings
 * and only controls can separate them:
 *
 *   A  do named actions fire in this sitting at all?   `Create Group Track`,
 *      E16j's proven ●, selection-independent. This is the POSITIVE CONTROL
 *      §3.4e was criticised for lacking — without it, "the action did nothing"
 *      cannot be told from "no action would have done anything right now".
 *   B  does the panel-focus mechanism work as E6 diag4 describes?  Focus the
 *      clip launcher, select a slot, fire `Duplicate`, watch a clip appear.
 *      ⚠ This is the one that makes a ○ on the row mean something, because it
 *      exercises the EXACT dispatch path the row depends on, on a panel where it
 *      is already known to work.
 *   C  the row itself, with the device panel focused.
 *
 * ⚠ **THE HAZARD IS REAL AND E6 EARNED IT.** An action fires against whatever is
 * selected NOW, and E16j made seven orphan duplicates this way — and watched
 * `Group` wrap exactly the track `cursor.pointTrack` had selected. So the full
 * track list is baselined by channelId before anything fires, every fire is
 * followed by a diff, and anything new is reaped by identity.
 * ⚠ No action whose display name ends in "..." is ever fired — that ellipsis is
 * a modal dialog, which would block Bitwig's UI thread with no way for us to
 * dismiss it. (`multiplex` / "Fold to Takes..." is the one that tempted.)
 *
 * Silent: nothing is launched and the transport is never touched.
 */
import { client, check, note, failureCount, pollUntil } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);

const POLYSYNTH = 'a9ffacb5-33e9-4fc7-8621-b1af31e410ef';
const SUBJECT = 'gn-A';
const FOCUS_DEVICES = 'focus_or_toggle_device_panel';
const FOCUS_LAUNCHER = 'focus_or_toggle_clip_launcher';

interface TrackRow { index: number; name: string; type: string; channelId: string }
const list = async () => (await req('track.list')) as { tracks: TrackRow[]; count: number };
interface DevList { devices: { index: number; name: string }[]; count: number }
interface LayerList { layers: { index: number; name: string; devices: { name: string }[] }[]; count: number }

/**
 * ⚠ Point at a track and PROVE the device bank followed before reading it.
 *
 * `device.list` right after `cursor.pointTrack` can return the PREVIOUS track's
 * chain — measured in `e17-diag`, 4 of 13 tracks. An earlier version of this
 * helper polled for "two consecutive equal reads", which a stale-but-stable
 * value satisfies immediately; it handed back an empty chain and the next call
 * threw. The cursor's own `trackPosition` is the thing to wait on.
 */
async function devicesOn(trackIndex: number): Promise<DevList> {
  await req('cursor.pointTrack', { cursor: '0', trackIndex });
  await pollUntil(async () => {
    const s = (await req('cursor.status', { cursor: '0' })) as { trackPosition: number };
    return s.trackPosition === trackIndex;
  }, 4000, 150);
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

await client.connect();

// ==========================================================================
console.log('\n-- baseline: the whole track list, by IDENTITY, before anything fires');
const baseline = await list();
const baseIds = new Set(baseline.tracks.map((t) => t.channelId));
const subject = baseline.tracks.find((t) => t.name === SUBJECT);
if (!subject) { console.log(`REFUSING: ${SUBJECT} not found — run e17-setup.`); process.exit(1); }
note(`${baseline.count} tracks; subject ${SUBJECT} at ${subject.index}`);

/** Anything that appeared since the baseline is an orphan this probe made. */
async function reapOrphans(where: string): Promise<string[]> {
  const made: string[] = [];
  for (let g = 0; g < 10; g++) {
    const now = await list();
    const orphan = now.tracks.find((t) => !baseIds.has(t.channelId));
    if (!orphan) break;
    made.push(`${orphan.name} (${orphan.type})`);
    await req('track.delete', { trackIndex: orphan.index });
    await pollUntil(async () => !(await list()).tracks.some((t) => t.channelId === orphan.channelId), 4000, 200);
  }
  if (made.length > 0) {
    note(`⚠ ${where}: hit the TRACK selection and made ${made.length} orphan(s):`
      + ` ${made.join(', ')} — reaped by channelId`);
  }
  return made;
}

// ==========================================================================
console.log('\n-- fixture: two Polysynths on ' + SUBJECT + ', so there is something to group');
let devs = await devicesOn(subject.index);
for (let g = 0; g < 10 && devs.count > 0; g++) {
  await req('device.delete', { cursor: '0', deviceIndex: devs.devices[0]!.index });
  const n = devs.count;
  await pollUntil(async () => (await devicesOn(subject.index)).count < n, 4000, 200);
  devs = await devicesOn(subject.index);
}
for (let i = 0; i < 2; i++) {
  const before = await devicesOn(subject.index);
  await req('device.insertBitwig', { cursor: '0', uuid: POLYSYNTH });
  await pollUntil(async () => (await devicesOn(subject.index)).count > before.count, 8000, 200);
}
devs = await devicesOn(subject.index);
note(`${SUBJECT}: ${devs.devices.map((d) => d.name).join(', ')}`);
check('PRECONDITION: two devices exist to be grouped', devs.count === 2,
  { devices: devs.devices.map((d) => d.name) });

// ==========================================================================
console.log('\n======== CONTROL A — do named actions fire AT ALL in this sitting?');
const aBefore = await list();
await req('app.invokeAction', { id: 'Create Group Track' });
const aFired = await pollUntil(async () => (await list()).count > aBefore.count, 6000, 250);
note(`tracks ${aBefore.count} -> ${(await list()).count}  (${aFired.ms} ms)`);
const madeGroup = await reapOrphans('control A');
const actionsFire = aFired.ok;
check('⚠ CONTROL A: named actions DO fire in this sitting (E16j, re-confirmed)',
  actionsFire, { fired: aFired.ok, made: madeGroup });

// ==========================================================================
console.log('\n======== CONTROL B — does panel focus route an Editing action? (E6 diag4\'s shape)');
note('Focus the clip launcher, select a slot, fire `Duplicate`. E6 diag4 measured exactly');
note('this working. It exercises the SAME dispatch path the row depends on, on a panel');
note('where it is already known to work — so a ○ in the row cannot be blamed on dispatch.');
const slotHas = async (slotIndex: number) =>
  ((await req('slot.status', { trackIndex: subject.index, slotIndex })) as { hasContent: boolean }).hasContent;
if (!(await slotHas(0))) {
  await req('clip.create', { trackIndex: subject.index, slotIndex: 0, lengthBeats: 4 });
  await pollUntil(async () => slotHas(0), 4000, 200);
}
if (await slotHas(1)) {
  await req('slot.delete', { trackIndex: subject.index, slotIndex: 1 });
  await pollUntil(async () => !(await slotHas(1)), 4000, 200);
}
check('PRECONDITION: slot 0 has a clip and slot 1 is empty, so a duplicate is unambiguous',
  (await slotHas(0)) && !(await slotHas(1)), { slot0: await slotHas(0), slot1: await slotHas(1) });

await req('slot.select', { trackIndex: subject.index, slotIndex: 0, mechanism: 'slot' });
await pollUntil(async () =>
  ((await req('selection.status')) as { trackIndex: number }).trackIndex === subject.index, 4000, 150);
await req('app.invokeAction', { id: FOCUS_LAUNCHER });
await new Promise((r) => setTimeout(r, 400));
await req('app.invokeAction', { id: 'Duplicate' });
const clipDuped = await pollUntil(async () => slotHas(1), 6000, 250);
note(`with the launcher focused, Duplicate landed a clip at slot 1: ${clipDuped.ok}  (${clipDuped.ms} ms)`);
await reapOrphans('control B');
const dispatchWorks = clipDuped.ok;
check('⚠ CONTROL B: panel focus routes an Editing action to OUR selection (E6 diag4)',
  dispatchWorks, { clipDuplicated: clipDuped.ok, ms: clipDuped.ms });
if (await slotHas(1)) {
  await req('slot.delete', { trackIndex: subject.index, slotIndex: 1 });
  await pollUntil(async () => !(await slotHas(1)), 4000, 200);
}

// ==========================================================================
console.log('\n======== THE ROW — device panel focused, device selected, fire `Group`');
const devsBefore = await devicesOn(subject.index);
await req('devcursor.selectAt', { deviceIndex: 0 });
const layersBefore = (await req('layer.list')) as LayerList;
const tracksBefore = await list();
note(`BEFORE  devices=[${devsBefore.devices.map((d) => d.name).join(', ')}]  chains=${layersBefore.count}`);

const sel = await req('device.selectInEditor', { deviceIndex: 0 });
note(`device.selectInEditor -> ${JSON.stringify(sel)}`);
await req('app.invokeAction', { id: FOCUS_DEVICES });
await new Promise((r) => setTimeout(r, 400));
// ⚠ Re-assert the device selection AFTER focusing: focusing a panel can move the
// selection into it, and firing against a selection we assumed is E6 blocker 3.
await req('device.selectInEditor', { deviceIndex: 0 });
await new Promise((r) => setTimeout(r, 300));
const fired = await req('app.invokeAction', { id: 'Group' });
note(`app.invokeAction Group -> ${JSON.stringify(fired)}`);
// ⚠ Verified by DIFF, never by the return value: `invoke()` acknowledges
// identically whether or not anything happened (E6 blocker 4).
await new Promise((r) => setTimeout(r, 2000));
const devsAfter = await devicesOn(subject.index);
await req('devcursor.selectAt', { deviceIndex: 0 });
const layersAfter = (await req('layer.list')) as LayerList;
const tracksAfter = await list();
note(`AFTER   devices=[${devsAfter.devices.map((d) => d.name).join(', ')}]  chains=${layersAfter.count}`);
note(`tracks ${tracksBefore.count} -> ${tracksAfter.count}`);

const madeAContainer = devsAfter.devices.some((d) => /Layer|Selector|Chain/.test(d.name))
  && !devsBefore.devices.some((d) => /Layer|Selector|Chain/.test(d.name));
const nestedTheDevices = layersAfter.count > layersBefore.count;
const madeATrack = tracksAfter.count > tracksBefore.count;
const grouped = madeAContainer || nestedTheDevices;

check('⚠ THE ROW: `Group` with the device panel focused wraps the devices in a container',
  grouped,
  { before: devsBefore.devices.map((d) => d.name), after: devsAfter.devices.map((d) => d.name),
    chainsBefore: layersBefore.count, chainsAfter: layersAfter.count });
check('and it did NOT fall back to the track selection (E16j\'s orphan mechanism)',
  !madeATrack, { tracksBefore: tracksBefore.count, tracksAfter: tracksAfter.count });
const orphans = await reapOrphans('the Group row');

// ==========================================================================
console.log('\n-- cleanup');
// ⚠ Put the launcher focus back: this probe moved a UI panel focus the human did
// not ask it to move, and leaving it there is the same class of discourtesy as
// leaving tracks muted (E16w had to ship a `restore` mode for exactly that).
await req('app.invokeAction', { id: FOCUS_LAUNCHER });
for (let g = 0; g < 10; g++) {
  const d = await devicesOn(subject.index);
  if (d.count === 0) break;
  await req('device.delete', { cursor: '0', deviceIndex: d.devices[0]!.index });
  await pollUntil(async () => (await devicesOn(subject.index)).count < d.count, 4000, 200);
}
await reapOrphans('cleanup');
const final = await list();
check('cleanup: the track list is back to its baseline identities',
  final.tracks.every((t) => baseIds.has(t.channelId)) && final.count === baseline.count,
  { before: baseline.count, after: final.count });

// ==========================================================================
console.log('\n======== VERDICT');
console.log(`  CONTROL A  named actions fire at all            ${actionsFire ? '●' : '○'}`);
console.log(`  CONTROL B  panel focus routes Editing actions   ${dispatchWorks ? '●' : '○'}`);
console.log(`  ROW        Group wraps devices into a container ${grouped ? '●' : '○'}`);
console.log(`  fallback   Group made a TRACK instead           ${madeATrack ? '⚠ YES' : 'no'}`);
if (!actionsFire) {
  note('⚠ INCONCLUSIVE, environmental: no named action fired in this sitting.');
} else if (!dispatchWorks) {
  note('⚠ INCONCLUSIVE: the dispatch path itself did not work on a panel where E6 diag4');
  note('  measured it working, so the row says nothing about devices. Something about the');
  note('  focus mechanism differs from E6\'s sitting and that is what needs chasing first.');
} else if (grouped) {
  note('⚠⚠ E4d route 7 IS WRONG — devices CAN be grouped into a container by a named');
  note('  action. That is the second "no named action does this" ○ to fall to E16j\'s shape.');
} else if (madeATrack) {
  note('⇒ `Group` ignored the device selection and acted on the TRACK even with the device');
  note('  panel focused. The UI\'s device-grouping gesture is NOT this action.');
} else {
  note('⇒ Actions fire, the dispatch path works, the device panel was focused and the device');
  note('  selection was set — and `Group` still did nothing. So the UI gesture the user has');
  note('  is not `Group`, and `getActions()` (a CURATED subset) exposes no path to it.');
  note('  ⚠ That is a REACHABILITY ○, and a different one from E4d route 7\'s.');
  note(`  orphans made: ${orphans.length}`);
}

console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} checks reported a negative — read them individually`);
process.exit(0);
