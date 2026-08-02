/**
 * E17 row 3, route 3 — the CLIPBOARD, the last unexercised mechanism.
 *
 * ⚠ **Why this is worth a probe after row 3 already returned ○ twice.**
 * `InsertionPoint` has exactly 14 members (E16l's complete-recall pass).
 * Thirteen have now been called. `paste()` has not — `layer.pasteInto` went on
 * the wire in session 4 and was never invoked, because filling the clipboard
 * means `Application.copy()` acting on the UI SELECTION, and **nothing could set
 * a device selection until `device.selectInEditor` landed today.** So this is not
 * a re-run of a closed question; it is a route that only became reachable an hour
 * ago, and it was flagged as owed in the handoff (§3, *"the last of
 * `InsertionPoint`'s 14 members unexercised"*).
 *
 * ⚠ **And row 1 changed the prior.** Before today the argument against was E4e's
 * referent rule plus "no named action does this". `Group` has now created a
 * container AND a chain through the device panel, so the named-action surface
 * demonstrably reaches into device-chain structure. `Paste` is an Editing action
 * on the same panel. If pasting a device onto a selected CONTAINER lands it as a
 * new chain — which is what the Bitwig UI gesture does — row 3 flips and the
 * whole verdict with it.
 *
 * Two routes, because they are different mechanisms with different reach:
 *   A  the WIRE call `layer.pasteInto` — `DeviceLayer.endOfDeviceChainInsertionPoint()
 *      .paste()`. Addressed at an EXISTING chain, so at best it fills one; it
 *      cannot invent a referent (E4e). Run for completeness — it is the 14th member.
 *   B  ⚠ the NAMED ACTION `Paste` with the CONTAINER selected in the device panel.
 *      This is the one that could create, and it is row 1's exact shape.
 *
 * ⚠ Controls, because a ○ here has three readings and only controls separate them:
 *   C1  does `Copy` actually fill the clipboard? Copy a device, paste it at TOP
 *       LEVEL, and watch the device count rise. Without this, "paste did nothing"
 *       cannot be told from "the clipboard was empty".
 *   C2  is the device-panel dispatch path live right now? Bitwig must be
 *       FOREGROUND — row 1 failed twice backgrounded — so `Group` is reproduced
 *       as a precondition exactly as `e17i` does.
 *
 * ⚠ Every fire is verified by `device.list` / `layer.list` DIFF and orphan tracks
 * are reaped by channelId (E6 blocker 3; E16j's seven orphans).
 *
 * Silent: nothing is launched and the transport is never touched.
 */
import { client, check, note, failureCount, pollUntil } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);

const POLYSYNTH = 'a9ffacb5-33e9-4fc7-8621-b1af31e410ef';
const ORGAN = 'f2dcfe9a-7b66-4c84-984a-b25685a1c21a';
const SUBJECT = 'gn-A';
const FOCUS_DEVICES = 'focus_or_toggle_device_panel';
const FOCUS_LAUNCHER = 'focus_or_toggle_clip_launcher';

interface TrackRow { index: number; name: string; type: string; channelId: string }
const list = async () => (await req('track.list')) as { tracks: TrackRow[]; count: number };
interface DevList { devices: { index: number; name: string }[]; count: number }
interface LayerList { layers: { index: number; name: string; devices: { name: string }[] }[]; count: number }
const shapeOf = (l: LayerList) =>
  l.layers.map((x) => `${x.index}:[${x.devices.map((d) => d.name).join('+') || '—'}]`).join(' ') || '(no chains)';

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
const baseline = await list();
const baseIds = new Set(baseline.tracks.map((t) => t.channelId));
const subject = baseline.tracks.find((t) => t.name === SUBJECT);
if (!subject) { console.log(`REFUSING: ${SUBJECT} not found.`); process.exit(1); }

async function reapOrphans(where: string): Promise<void> {
  for (let g = 0; g < 10; g++) {
    const now = await list();
    const orphan = now.tracks.find((t) => !baseIds.has(t.channelId));
    if (!orphan) break;
    note(`⚠ ${where}: reaping orphan track ${orphan.name}`);
    await req('track.delete', { trackIndex: orphan.index });
    await pollUntil(async () => !(await list()).tracks.some((t) => t.channelId === orphan.channelId), 4000, 200);
  }
}

async function clearSubject(): Promise<void> {
  for (let g = 0; g < 12; g++) {
    const d = await devicesOn(subject!.index);
    if (d.count === 0) break;
    await req('device.delete', { cursor: '0', deviceIndex: d.devices[0]!.index });
    await pollUntil(async () => (await devicesOn(subject!.index)).count < d.count, 4000, 200);
  }
}

async function insert(uuid: string): Promise<void> {
  const before = await devicesOn(subject!.index);
  await req('device.insertBitwig', { cursor: '0', uuid });
  await pollUntil(async () => (await devicesOn(subject!.index)).count > before.count, 8000, 200);
}

/**
 * Focus the device panel, select a device by index, fire an action.
 *
 * ⚠ **`focus_or_toggle_device_panel` is a TOGGLE, and that makes it non-idempotent
 * — this cost a run.** Fired when the device panel is ALREADY focused it turns the
 * focus off, so the very next Editing action dispatches somewhere else. `e17d`
 * happened to work because its cleanup restored launcher focus; `e17i` inherited
 * that state and worked too, then left the DEVICE panel focused — and `e17j`'s
 * first fire toggled it off and reported the dispatch path dead. The symptom is
 * identical to Bitwig being backgrounded, which is exactly the wrong diagnosis.
 *
 * ⇒ So focus is made DETERMINISTIC rather than assumed: move focus to the clip
 * launcher first, then toggle the device panel. From a known state the toggle has
 * a known result.
 */
async function fireOnDevice(actionId: string, deviceIndex: number): Promise<void> {
  await devicesOn(subject!.index);
  await req('device.selectInEditor', { deviceIndex });
  await req('app.invokeAction', { id: FOCUS_LAUNCHER });
  await new Promise((r) => setTimeout(r, 250));
  await req('app.invokeAction', { id: FOCUS_DEVICES });
  await new Promise((r) => setTimeout(r, 400));
  // ⚠ Re-assert AFTER focusing — focusing a panel can move the selection into it,
  // and firing against a selection we merely assumed is E6 blocker 3.
  await req('device.selectInEditor', { deviceIndex });
  await new Promise((r) => setTimeout(r, 300));
  await req('app.invokeAction', { id: actionId });
  await new Promise((r) => setTimeout(r, 1800));
}

async function chainsOf(deviceIndex: number, expectName: string): Promise<LayerList> {
  await devicesOn(subject!.index);
  await req('devcursor.selectAt', { deviceIndex });
  await pollUntil(async () => {
    const s = (await req('devcursor.status')) as { exists: boolean; name: string };
    return s.exists && s.name === expectName;
  }, 6000, 150);
  return (await req('layer.list')) as LayerList;
}

// ==========================================================================
console.log('\n======== C2 — is the device-panel dispatch path live? (Bitwig must be FOREGROUND)');
await clearSubject();
await insert(POLYSYNTH);
await insert(ORGAN);
await fireOnDevice('Group', 0);
await reapOrphans('C2');
const c2 = await devicesOn(subject.index);
note(`after Group on device 0: [${c2.devices.map((d) => d.name).join(', ')}]`);
const dispatchLive = c2.devices[0]?.name === 'Instrument Layer';
check('C2: `Group` wraps a device, so the device-panel dispatch path works right now',
  dispatchLive, { devices: c2.devices.map((d) => d.name) });
if (!dispatchLive) {
  console.log('\nREFUSING: bring Bitwig to the FOREGROUND and re-run — every route below would');
  console.log('read ○ for an environmental reason. Row 1 failed exactly this way twice.');
  process.exit(1);
}

// ==========================================================================
console.log('\n======== C1 — does `Copy` fill the clipboard at all?');
note('⚠ Without this, "paste did nothing" cannot be told from "the clipboard was empty".');
// Copy the Organ, which is still a plain device at top level (index 1).
const beforeCopy = await devicesOn(subject.index);
note(`copying device 1 = ${beforeCopy.devices[1]?.name}`);
await fireOnDevice('Copy', 1);
await fireOnDevice('Paste', 1);
await reapOrphans('C1');
const afterC1 = await devicesOn(subject.index);
note(`after Copy + Paste at top level: [${afterC1.devices.map((d) => d.name).join(', ')}]`);
const clipboardWorks = afterC1.count > beforeCopy.count;
check('⚠ C1: `Copy` fills the clipboard and `Paste` pastes a DEVICE — the clipboard'
  + ' mechanism is live and reachable',
  clipboardWorks, { before: beforeCopy.count, after: afterC1.count,
    devices: afterC1.devices.map((d) => d.name) });

// ==========================================================================
console.log('\n======== ROUTE B — `Paste` with the CONTAINER selected (the one that could create)');
note('This is row 1\'s exact shape, applied to the verb that moves content rather than');
note('the one that wraps it. Bitwig\'s UI gesture drops a copied device onto a container');
note('and it lands as a new chain; the question is whether the action does the same.');
const containerIdx = afterC1.devices.findIndex((d) => d.name === 'Instrument Layer');
if (containerIdx < 0) { console.log('REFUSING: no container to paste onto.'); process.exit(1); }
const bChains = await chainsOf(containerIdx, 'Instrument Layer');
const bDevices = await devicesOn(subject.index);
note(`before: devices=[${bDevices.devices.map((d) => d.name).join(', ')}]  chains=${bChains.count}`);
note(`        ${shapeOf(bChains)}`);
// Re-fill the clipboard with a plain device, then aim Paste at the container.
const organIdx = bDevices.devices.findIndex((d) => d.name === 'Organ');
await fireOnDevice('Copy', organIdx >= 0 ? organIdx : 1);
await fireOnDevice('Paste', containerIdx);
await reapOrphans('route B');
const aDevices = await devicesOn(subject.index);
const aChains = await chainsOf(containerIdx, 'Instrument Layer');
note(`after:  devices=[${aDevices.devices.map((d) => d.name).join(', ')}]  chains=${aChains.count}`);
note(`        ${shapeOf(aChains)}`);
const routeB = aChains.count > bChains.count;
check('⚠ ROUTE B: `Paste` onto a selected container CREATES A NEW CHAIN',
  routeB, { chainsBefore: bChains.count, chainsAfter: aChains.count,
    devicesBefore: bDevices.devices.map((d) => d.name),
    devicesAfter: aDevices.devices.map((d) => d.name) });

// ==========================================================================
console.log('\n======== ROUTE A — the WIRE call `layer.pasteInto` (InsertionPoint member 14/14)');
note('Addressed at an EXISTING chain, so at best it FILLS one — E4e says it cannot');
note('invent a referent. Run because it is the last unexercised member, not for hope.');
const aBefore = await chainsOf(containerIdx, 'Instrument Layer');
const aBeforeDevices = aBefore.layers.reduce((n, x) => n + x.devices.length, 0);
note(`before: chains=${aBefore.count} devices-in-chains=${aBeforeDevices}  ${shapeOf(aBefore)}`);
await req('layer.pasteInto', { layerIndex: 0 });
await new Promise((r) => setTimeout(r, 2000));
const aAfter = await chainsOf(containerIdx, 'Instrument Layer');
const aAfterDevices = aAfter.layers.reduce((n, x) => n + x.devices.length, 0);
note(`after:  chains=${aAfter.count} devices-in-chains=${aAfterDevices}  ${shapeOf(aAfter)}`);
const routeAGrew = aAfter.count > aBefore.count;
const routeAFilled = aAfterDevices > aBeforeDevices;
check('ROUTE A: `layer.pasteInto` FILLS an existing chain from the clipboard',
  routeAFilled, { before: aBeforeDevices, after: aAfterDevices });
check('ROUTE A: …and does not create a chain (expected — no referent, E4e)',
  !routeAGrew, { before: aBefore.count, after: aAfter.count });

// ==========================================================================
console.log('\n-- cleanup');
await clearSubject();
await reapOrphans('cleanup');
const final = await list();
check('cleanup: the track list is back to its baseline identities',
  final.tracks.every((t) => baseIds.has(t.channelId)) && final.count === baseline.count,
  { before: baseline.count, after: final.count });

// ==========================================================================
console.log('\n======== VERDICT');
console.log(`  C2  device-panel dispatch is live          ${dispatchLive ? '●' : '○'}`);
console.log(`  C1  Copy fills the clipboard               ${clipboardWorks ? '●' : '○'}`);
console.log(`  B   Paste onto a container CREATES a chain ${routeB ? '●' : '○'}`);
console.log(`  A   layer.pasteInto fills an existing one  ${routeAFilled ? '●' : '○'}   (creates: ${routeAGrew ? '●' : '○'})`);
if (!clipboardWorks) {
  note('⚠ INCONCLUSIVE: the clipboard control failed, so neither paste route says anything.');
} else if (routeB || routeAGrew) {
  note('⚠⚠ ROW 3 FLIPS — a chain CAN be created, via the clipboard. That reopens the whole');
  note('  verdict: with create ● and delete ○ the model is still lopsided, but "layers');
  note('  cannot be grown" would no longer be true and E17-VERDICT §2 needs rewriting.');
} else {
  note('⇒ The clipboard is live and reaches devices, and STILL does not create a chain.');
  note('  All 14 `InsertionPoint` members are now exercised. Row 3\'s ○ is complete: the');
  note('  only way to a second chain remains a human-authored `.bwpreset`.');
}

console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} checks reported a negative — read them individually`);
process.exit(0);
