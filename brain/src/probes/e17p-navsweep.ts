/**
 * E17 rows 3+4 — can NAVIGATION reach the layer selection our setters cannot?
 *
 * ⚠ **The state this is trying to break.** `e17l` proved with a human in the loop
 * that a selected layer obeys `Duplicate`, `Copy`+`Paste` and `Delete`. Three of
 * our own setters do not produce that selection:
 *
 *   `DeviceChain.selectInEditor()`      ○ (e17k, e17o)
 *   `Channel.selectInMixer()`           ○ (e17k)
 *   `CursorChannel.selectChannel()`     ○ — ⚠ and this one is the interesting
 *       failure: it demonstrably BINDS our layer cursor (`cursorLayer0.exists()`
 *       false → true, name "Polysynth"), and the action still did nothing. So
 *       "our cursor points at the chain" and "Bitwig's UI selection IS the chain"
 *       are different things. For TRACKS they are the same — E16j watched `Group`
 *       obey exactly the track `cursorTrack.selectChannel` had selected.
 *
 * ⇒ The one selection we CAN set inside a device chain is a DEVICE
 * (`device.selectInEditor`, row 1 ●). So the remaining idea is to select the
 * container and then NAVIGATE onto the chain, using Bitwig's own keyboard
 * navigation — the actions a human's arrow keys fire.
 *
 * ⚠ **This is the last no-restart route.** If it fails, the honest conclusion is
 * that a device CHAIN is not addressable as a UI selection from a controller
 * extension — which leaves rows 3 and 4 as capabilities that exist, that a human
 * can drive, and that we cannot. That is a materially different ○ from "layers
 * cannot be created or deleted", and the verdict has to say so.
 *
 * ⚠ Each candidate is bracketed: the container selection is re-established from
 * scratch every time, and `Duplicate` is the detector because it is reversible
 * (`app.undo`) where `Delete` is not. A chain-count rise is the signal; a DEVICE
 * count rise inside a chain means the navigation landed on a device instead, and
 * that is reported separately rather than scored as nothing.
 *
 * ⚠ Bitwig must be FOREGROUND (e17m: 0/8 backgrounded for this gesture).
 *
 * Silent: nothing is launched and the transport is never touched.
 */
import { client, check, note, failureCount, pollUntil } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);

const SUBJECT = 'gn-lay4';
const FOCUS_DEVICES = 'focus_or_toggle_device_panel';
const FOCUS_LAUNCHER = 'focus_or_toggle_clip_launcher';

/** Navigation candidates, each fired between "container selected" and `Duplicate`. */
const CANDIDATES: { id: string; why: string }[] = [
  { id: 'Enter Group', why: 'descends into a container in the UI; the device analogue is untested' },
  { id: 'Expand Item', why: 'opens the container, which may make its chains focusable' },
  { id: 'Focus widget below', why: 'the arrow-key move a human makes to get from a device onto its chain' },
  { id: 'Focus widget to the right', why: 'the same, horizontally — layer chains stack sideways' },
  { id: 'Select Next', why: 'moves the selection within the focused panel' },
  { id: 'toggle_children_expanded_state', why: 'exposes the chains as children, which may make them selectable' },
];

interface TrackRow { index: number; name: string; type: string; channelId: string }
const list = async () => (await req('track.list')) as { tracks: TrackRow[]; count: number };
interface LayerRow { index: number; name: string; devices: { name: string }[] }
interface LayerList { layers: LayerRow[]; count: number }
const shapeOf = (l: LayerList) =>
  l.layers.map((x) => `${x.index}:[${x.devices.map((d) => d.name).join('+') || '—'}]`).join(' ');
const devTotal = (l: LayerList) => l.layers.reduce((n, x) => n + x.devices.length, 0);

await client.connect();
const baseline = await list();
const baseIds = new Set(baseline.tracks.map((t) => t.channelId));
const subject = baseline.tracks.find((t) => t.name === SUBJECT);
if (!subject) { console.log(`REFUSING: ${SUBJECT} not found.`); process.exit(1); }

async function chains(): Promise<LayerList> {
  await req('cursor.pointTrack', { cursor: '0', trackIndex: subject!.index });
  await pollUntil(async () => {
    const s = (await req('cursor.status', { cursor: '0' })) as { trackPosition: number };
    return s.trackPosition === subject!.index;
  }, 4000, 150);
  await req('devcursor.selectAt', { deviceIndex: 0 });
  const ok = await pollUntil(async () => {
    const s = (await req('devcursor.status')) as { exists: boolean; name: string };
    return s.exists && s.name === 'Instrument Layer';
  }, 6000, 150);
  if (!ok.ok) { console.log('REFUSING: cursor not on the container (e16o trap).'); process.exit(1); }
  return (await req('layer.list')) as LayerList;
}

async function reap(where: string): Promise<void> {
  for (let g = 0; g < 10; g++) {
    const now = await list();
    const orphan = now.tracks.find((t) => !baseIds.has(t.channelId));
    if (!orphan) break;
    note(`⚠ ${where}: reaped orphan track ${orphan.name}`);
    await req('track.delete', { trackIndex: orphan.index });
    await pollUntil(async () => !(await list()).tracks.some((t) => t.channelId === orphan.channelId), 4000, 200);
  }
}

/** ⚠ Focus from a KNOWN state — `focus_or_toggle_*` is a toggle, not a setter. */
async function selectContainerInEditor(): Promise<void> {
  await chains();
  await req('device.selectInEditor', { deviceIndex: 0 });
  await req('app.invokeAction', { id: FOCUS_LAUNCHER });
  await new Promise((r) => setTimeout(r, 250));
  await req('app.invokeAction', { id: FOCUS_DEVICES });
  await new Promise((r) => setTimeout(r, 400));
  await req('device.selectInEditor', { deviceIndex: 0 });
  await new Promise((r) => setTimeout(r, 350));
}

// ==========================================================================
console.log('\n-- CONTROL: is the device-panel dispatch path live? (needs FOREGROUND)');
// ⚠ Reuse the row-1 gesture on the container itself: `Group` on a selected
// container nests it, which is visible as a device-count change on the track.
const beforeCtl = await chains();
note(`${SUBJECT}: ${beforeCtl.count} chains — ${shapeOf(beforeCtl)}`);
await selectContainerInEditor();
await req('app.invokeAction', { id: 'Group' });
await new Promise((r) => setTimeout(r, 1800));
const devs = (await req('device.list', { cursor: '0' })) as { devices: { name: string }[]; count: number };
await reap('control');
const nested = devs.count > 1 || devs.devices.filter((d) => d.name === 'Instrument Layer').length > 1;
note(`after Group on the container: [${devs.devices.map((d) => d.name).join(', ')}]`);
check('CONTROL: named actions reach our DEVICE selection right now', nested,
  { devices: devs.devices.map((d) => d.name) });
if (nested) {
  await req('app.undo');
  await new Promise((r) => setTimeout(r, 1500));
}
if (!nested) {
  console.log('\nREFUSING: bring Bitwig to the FOREGROUND and re-run — every candidate below');
  console.log('would read ○ for an environmental reason (e17m: 0/8 backgrounded).');
  process.exit(1);
}

// ==========================================================================
console.log('\n======== THE SWEEP — container selected, then NAVIGATE, then `Duplicate`');
interface Result { id: string; chainsBefore: number; chainsAfter: number; devsBefore: number; devsAfter: number }
const results: Result[] = [];

for (const c of CANDIDATES) {
  const before = await chains();
  await selectContainerInEditor();
  await req('app.invokeAction', { id: c.id });
  await new Promise((r) => setTimeout(r, 900));
  await req('app.invokeAction', { id: 'Duplicate' });
  await new Promise((r) => setTimeout(r, 1800));
  const after = await chains();
  await reap(c.id);
  const r: Result = {
    id: c.id, chainsBefore: before.count, chainsAfter: after.count,
    devsBefore: devTotal(before), devsAfter: devTotal(after),
  };
  results.push(r);
  const grew = r.chainsAfter > r.chainsBefore;
  const devGrew = r.devsAfter > r.devsBefore;
  console.log(`  ${c.id.padEnd(34)} chains ${r.chainsBefore}->${r.chainsAfter}`
    + `  devices-in-chains ${r.devsBefore}->${r.devsAfter}`
    + `  ${grew ? '● CHAIN CREATED' : devGrew ? '◐ landed on a DEVICE' : '○'}`);
  if (grew || devGrew) {
    note(`     ${shapeOf(after)}`);
    await req('app.undo');
    await new Promise((r2) => setTimeout(r2, 1500));
    const undone = await chains();
    if (undone.count !== before.count || devTotal(undone) !== devTotal(before)) {
      note(`     ⚠ undo did not fully restore: ${shapeOf(undone)}`);
    }
  }
}

// ==========================================================================
console.log('\n-- cleanup');
await reap('cleanup');
const final = await list();
check('cleanup: the track list is unchanged',
  final.tracks.every((t) => baseIds.has(t.channelId)) && final.count === baseline.count,
  { before: baseline.count, after: final.count });
const end = await chains();
note(`${SUBJECT} final: ${end.count} chains — ${shapeOf(end)}`);

// ==========================================================================
console.log('\n======== VERDICT');
const winner = results.find((r) => r.chainsAfter > r.chainsBefore);
const devLanders = results.filter((r) => r.devsAfter > r.devsBefore).map((r) => r.id);
check('⚠ some navigation route reaches the LAYER selection', winner !== undefined,
  { winner: winner?.id, candidates: results.length });
if (winner) {
  note(`⇒ ⚠⚠ "${winner.id}" + Duplicate CREATES A CHAIN. Rows 3 and 4 are reachable after`);
  note('  all, and E17-VERDICT.md must be re-argued from scratch.');
} else {
  if (devLanders.length > 0) {
    note(`⚠ ${devLanders.length} route(s) landed on a DEVICE rather than a chain:`
      + ` ${devLanders.join(', ')}`);
    note('  So the navigation moved the selection — just not onto the chain. That is');
    note('  evidence the panel responds to these actions at all, which makes the');
    note('  chain-shaped ○ sharper rather than weaker.');
  }
  note('⇒ Every setter and every navigation route we have reaches a TRACK or a DEVICE,');
  note('  and none reaches a CHAIN. ⚠ The capability is NOT absent — `e17l` drove it by');
  note('  hand — it is UNADDRESSABLE from a controller extension. Rows 3 and 4 should be');
  note('  recorded that way, and the verdict rests on it rather than on "impossible".');
}
console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} checks reported a negative — read them individually`);
process.exit(0);
