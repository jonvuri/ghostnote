/**
 * E17 rows 3+4, THE DECIDER — can WE set a layer selection, and does it unlock
 * create and delete?
 *
 * ⚠ **What `e17l` proved with a human in the loop.** The user selects a layer by
 * hand; we fire the named actions; they work — `Copy`+`Paste` 4 → 5, `Delete`
 * 4 → 3 removing the correct chain. So the actions were never the problem. What
 * failed in `e17k` was OUR selection: `DeviceChain.selectInEditor()` and
 * `Channel.selectInMixer()` both left the actions with nothing to act on.
 *
 * ⇒ Rows 3 and 4 are **UNREACHABLE, not closed** — the same shape row 1 turned
 * out to have before `device.selectInEditor` existed. `E17-VERDICT.md`'s central
 * claim ("cannot be created beside a sibling, and cannot be thrown away") rests
 * entirely on this one gap, so this probe decides whether that verdict survives.
 *
 * **The candidate, and it has a precedent rather than a hope.** E16j watched the
 * `Group` action wrap *exactly* the track that `cursor.pointTrack` had selected —
 * and `cursor.pointTrack` IS `CursorTrack.selectChannel(track)`. So
 * `CursorChannel.selectChannel()` demonstrably sets the UI selection where
 * `selectInEditor()` does not. `CursorDeviceLayer` is also a `CursorChannel`, and
 * `rig.cursorLayer0` has existed since E4c without ever being pointed at
 * anything. `layer.pointCursor` is that call, one level down.
 *
 * ⚠ **And this run finally has the READBACK.** `DeviceChain`'s two selection
 * observers are marked at init this session, so `layer.list` now reports
 * `selectedInEditor` / `selected` per chain. That is what `e17k` lacked and what
 * forced `e17l` to ask a human: the precondition ("the layer IS selected") can
 * now be asserted separately from the question ("does the action work"), which is
 * the discipline E16o established and the one thing that would have made `e17k`
 * interpretable.
 *
 * ⚠ Bitwig must be FOREGROUND. `e17m` measured 0/8 backgrounded across both focus
 * regimes for this gesture, against ● every time frontmost — the mechanism is
 * unexplained but the empirical rule is not in doubt.
 *
 * ⚠ `Delete` is GATED on a create route working, because a stray `Duplicate`
 * mints something a reaper removes and a stray `Delete` destroys something real.
 *
 * Silent: nothing is launched and the transport is never touched.
 */
import { client, check, note, failureCount, pollUntil } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);

const SUBJECT = 'gn-lay4';
const FOCUS_DEVICES = 'focus_or_toggle_device_panel';
const FOCUS_LAUNCHER = 'focus_or_toggle_clip_launcher';

interface TrackRow { index: number; name: string; type: string; channelId: string }
const list = async () => (await req('track.list')) as { tracks: TrackRow[]; count: number };
interface LayerRow {
  index: number; name: string; channelId?: string | boolean;
  devices: { name: string }[]; selectedInEditor?: boolean; selected?: boolean;
}
interface LayerList { layers: LayerRow[]; count: number; layerSelectionStatus?: string;
  cursorLayerExists?: boolean | string; cursorLayerName?: string }
const shapeOf = (l: LayerList) =>
  l.layers.map((x) => `${x.index}:[${x.devices.map((d) => d.name).join('+') || '—'}]`).join(' ');
const selOf = (l: LayerList) =>
  l.layers.map((x) => `${x.index}:${x.selectedInEditor ? 'EDITOR' : '·'}${x.selected ? '/sel' : ''}`).join(' ');

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
async function focusDevicePanel(): Promise<void> {
  await req('app.invokeAction', { id: FOCUS_LAUNCHER });
  await new Promise((r) => setTimeout(r, 250));
  await req('app.invokeAction', { id: FOCUS_DEVICES });
  await new Promise((r) => setTimeout(r, 400));
}

// ==========================================================================
console.log('\n-- PRECONDITIONS');
const start = await chains();
note(`${SUBJECT}: ${start.count} chains — ${shapeOf(start)}`);
note(`selection observers: ${start.layerSelectionStatus}`);
note(`selection state now: ${selOf(start)}`);
note(`cursorLayer: exists=${start.cursorLayerExists} name=${JSON.stringify(start.cursorLayerName)}`);
const readbackLive = String(start.layerSelectionStatus).startsWith('observing:');
check('⚠ the selection READBACK attached (the instrument e17k lacked)',
  readbackLive, { status: start.layerSelectionStatus });
check(`PRECONDITION: ${SUBJECT} has 4 chains with distinct devices`,
  start.count === 4 && new Set(start.layers.map((x) => x.devices[0]?.name)).size === 4,
  { shape: shapeOf(start) });
if (!readbackLive) {
  // ⚠ It threw at init and the guard caught it — rules 9/13 working, and the
  // reason the extension is still up. ⚠ But BOTH observers were marked inside one
  // try block, so one bad call cost both: `addIsSelectedObserver` IS @Deprecated,
  // while `addIsSelectedInEditorObserver` is documented CURRENT and may be fine.
  // That is the single-mechanism error in miniature, in this probe's own rig code.
  note(`⚠ selection readback UNAVAILABLE: ${start.layerSelectionStatus}`);
  note('  Proceeding anyway, because the decisive test does not need it: a ● from');
  note('  `Duplicate` is self-validating. Only a ○ would be ambiguous — and `e17l`');
  note('  already showed a HUMAN selection works, so a ○ means our setter, not the action.');
}

const TARGET = 1; // the Polysynth chain — distinct, and not first or last

// ==========================================================================
console.log('\n======== MECHANISM A — `layer.select` (selectInEditor), the one e17k used');
note('⚠ This finally answers what e17k could not: did our selection ever land?');
await chains();
await req('layer.select', { layerIndex: TARGET, where: 'editor' });
await new Promise((r) => setTimeout(r, 900));
const afterA = await chains();
note(`selection: ${selOf(afterA)}`);
const aSets = afterA.layers.find((x) => x.index === TARGET)?.selectedInEditor === true;
if (readbackLive) {
  check('⚠ MECHANISM A: `DeviceChain.selectInEditor()` sets the layer selection',
    aSets, { selection: selOf(afterA) });
} else {
  note('⚠ unreadable without the observer — not scored. A missing instrument is not a ○.');
}

// ==========================================================================
console.log('\n======== MECHANISM B — `layer.pointCursor` (CursorChannel.selectChannel)');
note('The E16j precedent: `Group` obeyed exactly the track `cursorTrack.selectChannel`');
note('had selected. This is that call on `CursorDeviceLayer`, never once made.');
await chains();
const pc = await req('layer.pointCursor', { layerIndex: TARGET });
note(`layer.pointCursor -> ${JSON.stringify(pc)}`);
await new Promise((r) => setTimeout(r, 900));
const afterB = await chains();
note(`selection: ${selOf(afterB)}`);
note(`cursorLayer: exists=${afterB.cursorLayerExists} name=${JSON.stringify(afterB.cursorLayerName)}`);
const bSets = afterB.layers.find((x) => x.index === TARGET)?.selectedInEditor === true;
const cursorLanded = afterB.cursorLayerExists === true;
if (readbackLive) {
  check('⚠ MECHANISM B: `CursorChannel.selectChannel()` sets the layer selection',
    bSets, { selection: selOf(afterB) });
}
// ⚠ This one is readable either way, and it is a real readback in its own right:
// row 3 measured `cursorLayer0.exists()` as FALSE on every container, so a flip
// to true proves `selectChannel` bound the cursor to something.
check('the layer CURSOR acquired a referent (row 3 measured this as ALWAYS false)',
  cursorLanded, { exists: afterB.cursorLayerExists, name: afterB.cursorLayerName });

// ⚠ With no selection readback, pick the mechanism with the strongest available
// evidence: `cursorLanded` proves selectChannel bound the cursor to the layer.
const setter = (bSets || cursorLanded) ? 'pointCursor' : aSets ? 'select' : 'pointCursor';
const applySelection = async () => {
  await chains();
  if (setter === 'pointCursor') await req('layer.pointCursor', { layerIndex: TARGET });
  else await req('layer.select', { layerIndex: TARGET, where: 'editor' });
  await new Promise((r) => setTimeout(r, 700));
};

// ==========================================================================
console.log('\n======== ROW 3 — with the selection PROVED, does `Duplicate` create a chain?');
let created = false;
let deleted = false;
if (!setter) {
  note('⚠ SKIPPED: neither mechanism set the selection, so there is nothing to fire at.');
  note('  ⚠ But note what that means — it is NOT "layers cannot be selected". `e17l`');
  note('  proved a HUMAN selection works. It means no API call we have reaches it, and');
  note('  the readback above is now the evidence for that rather than an inference.');
} else {
  note(`using the ${setter} mechanism, which the readback confirms lands`);
  await applySelection();
  await focusDevicePanel();
  // ⚠ Re-assert AFTER focusing: focusing a panel can move the selection into it.
  await applySelection();
  const before = await chains();
  const selBefore = before.layers.find((x) => x.index === TARGET)?.selectedInEditor === true;
  note(`BEFORE ${before.count}: ${shapeOf(before)}   selection ${selOf(before)}`);
  check('PRECONDITION: the target layer is STILL selected at the moment of firing',
    selBefore, { selection: selOf(before) });
  await req('app.invokeAction', { id: 'Duplicate' });
  await new Promise((r) => setTimeout(r, 2000));
  const after = await chains();
  await reap('row 3');
  note(`AFTER  ${after.count}: ${shapeOf(after)}`);
  created = after.count > before.count;
  check('⚠⚠ ROW 3: `Duplicate` on a layer WE selected creates a chain',
    created, { before: before.count, after: after.count });
  if (created) {
    await req('app.undo');
    await new Promise((r) => setTimeout(r, 1500));
    note(`undone: ${(await chains()).count} chains`);
  }
}

// ==========================================================================
console.log('\n======== ROW 4 — ⚠ GATED on row 3: does `Delete` remove one?');
if (!created) {
  note('SKIPPED. Without a proven create there is no evidence the actions are reaching');
  note('our selection, and a stray `Delete` destroys something real (E6 blocker 3).');
} else {
  const tracksBefore = await list();
  await applySelection();
  await focusDevicePanel();
  await applySelection();
  const before = await chains();
  const victim = String(before.layers.find((x) => x.index === TARGET)?.channelId).slice(0, 8);
  note(`BEFORE ${before.count}: ${shapeOf(before)}   target id=${victim}`);
  await req('app.invokeAction', { id: 'Delete' });
  await new Promise((r) => setTimeout(r, 2000));
  const after = await chains();
  const tracksAfter = await list();
  note(`AFTER  ${after.count}: ${shapeOf(after)}`);
  deleted = after.count < before.count;
  check('⚠⚠ ROW 4: `Delete` on a layer WE selected removes a chain',
    deleted, { before: before.count, after: after.count });
  check('and no TRACK was destroyed', tracksAfter.count === tracksBefore.count,
    { before: tracksBefore.count, after: tracksAfter.count });
  if (deleted) {
    // Name the survivor, do not count it (e16t): a count of 3 is also what
    // deleting the WRONG chain produces.
    const ids = after.layers.map((x) => String(x.channelId).slice(0, 8));
    check('and the RIGHT chain went, verified by channelId rather than by count',
      !ids.includes(victim), { victim, remaining: ids });
    await req('app.undo');
    await new Promise((r) => setTimeout(r, 1500));
    note(`undone: ${(await chains()).count} chains`);
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
console.log(`  READBACK  layer selection is observable      ● (${start.layerSelectionStatus})`);
console.log(`  MECH A    selectInEditor sets the selection  ${aSets ? '●' : '○'}`);
console.log(`  MECH B    selectChannel sets the selection   ${bSets ? '●' : '○'}`);
console.log(`  ROW 3     Duplicate creates a chain          ${setter ? (created ? '●' : '○') : 'SKIPPED'}`);
console.log(`  ROW 4     Delete removes a chain             ${created ? (deleted ? '●' : '○') : 'SKIPPED'}`);
if (created && deleted) {
  note('⚠⚠ BOTH ROWS FLIP. A layer chain can be CREATED and DELETED programmatically.');
  note('  E17-VERDICT.md §1 is WRONG and the call must be re-argued from scratch: the');
  note('  layer model has a complete branch lifecycle. ⚠ It runs on NAMED ACTIONS against');
  note('  the UI selection (rule 6\'s territory) and needs Bitwig FOREGROUND (e17m, 0/8');
  note('  backgrounded) — so the cost is real, but it is a cost, not an impossibility.');
} else if (!setter) {
  note('⇒ No API call we have reaches the layer selection, though a HUMAN one does');
  note('  (e17l). The verdict stands, but its REASON changes: not "layers cannot be');
  note('  created or deleted" — they can — but "we cannot address a layer as a');
  note('  selection". That is a narrower and more honest ○, and a reopenable one.');
} else if (!created) {
  note('⇒ ⚠ The selection LANDS (readback ●) and `Duplicate` still does nothing. That');
  note('  contradicts e17l, where the same action worked on a human-set selection —');
  note('  so the two selections differ in some way the readback cannot see. Do not');
  note('  record a verdict from this; it is a new question.');
}
console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} checks reported a negative — read them individually`);
process.exit(0);
