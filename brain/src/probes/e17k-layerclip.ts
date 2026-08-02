/**
 * E17 rows 3 + 4, REOPENED — Editing actions against a selected LAYER.
 *
 * ⚠ **User report, 2026-08-01:** *"Selecting a layer, copying it, and pasting
 * directly at the same selection results in inserting a duplicate of that layer,
 * for me."* That is chain creation in the UI, by a gesture nothing has tried.
 *
 * **What every previous attempt aimed at, and why none of them was this.**
 *
 *   e17c   typed insertion points, aimed at a CHAIN (`endOf…`, `startOf…`) or at
 *          the container-scoped cursor. ○ — no referent to bind to (E4e).
 *   e17d   the `Group` action with a DEVICE selected. ● but always one chain.
 *   e17j   the `Paste` action with the CONTAINER selected → landed beside it;
 *          and `layer.pasteInto`, which pastes INTO an existing chain. ○ create.
 *   e17f   `deleteObject()` / `host.deleteObjects()` — TYPED calls — including
 *          two runs preceded by `layer.select`. ○ on four routes.
 *
 * ⚠ **The gap is precise and it is embarrassing in hindsight.** `layer.select`
 * went on the wire this session and `e17f` used it — but only ever before a
 * TYPED call, where the UI selection is irrelevant because the call is addressed.
 * It was never paired with a NAMED ACTION, which is the only surface for which a
 * UI selection is the argument. `DeviceLayer` is a `DeviceChain`, whose
 * `selectInEditor()` javadoc reads *"Selects the device chain in Bitwig Studio,
 * **in case it is a selectable object**"* — and the user's report says it is one.
 *
 * ⇒ If a layer is a first-class UI selection, **every** Editing action applies to
 * it, and both load-bearing negatives are back in play:
 *   row 3  `Duplicate`, or `Copy`+`Paste`, creates a chain
 *   row 4  `Delete` removes one
 *
 * ⚠ **HAZARD, and it is worse than usual, so `Delete` is GATED.** A named action
 * fires against whatever is selected NOW (E6 blocker 3; E16j's seven orphans). A
 * stray `Duplicate` mints an orphan that the channelId reaper cleans up — but a
 * stray `Delete` destroys something that EXISTS, and no reaper brings that back.
 * So `Delete` is attempted **only if a create route has already proved that
 * `layer.select` moves the selection**, and the full track list plus the
 * container's own chain list are captured by identity first.
 *
 * ⚠ Panel focus is a TOGGLE and is established from a known state (launcher
 * first, then devices) — firing it blind cost two runs and looked exactly like
 * Bitwig being backgrounded.
 *
 * Silent: nothing is launched and the transport is never touched.
 */
import { client, check, note, failureCount, pollUntil } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);

const POLYSYNTH = 'a9ffacb5-33e9-4fc7-8621-b1af31e410ef';
const SUBJECT = 'gn-lay4';
const SCRATCH = 'gn-A';
const FOCUS_DEVICES = 'focus_or_toggle_device_panel';
const FOCUS_LAUNCHER = 'focus_or_toggle_clip_launcher';

interface TrackRow { index: number; name: string; type: string; channelId: string }
const list = async () => (await req('track.list')) as { tracks: TrackRow[]; count: number };
interface DevList { devices: { index: number; name: string }[]; count: number }
interface LayerRow { index: number; name: string; channelId?: string | boolean; devices: { name: string }[] }
interface LayerList { layers: LayerRow[]; count: number; cursorDeviceName?: string }
const shapeOf = (l: LayerList) =>
  l.layers.map((x) => `${x.index}:[${x.devices.map((d) => d.name).join('+') || '—'}]`).join(' ') || '(no chains)';
const idsOf = (l: LayerList) => l.layers.map((x) => String(x.channelId).slice(0, 8));

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
const scratch = baseline.tracks.find((t) => t.name === SCRATCH);
if (!subject || !scratch) { console.log('REFUSING: run e17-setup first.'); process.exit(1); }

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

/** ⚠ Did a track that EXISTED disappear? A reaper cannot undo that. */
async function assertNoTrackLost(where: string): Promise<boolean> {
  const now = await list();
  const nowIds = new Set(now.tracks.map((t) => t.channelId));
  const lost = [...baseIds].filter((id) => !nowIds.has(id));
  if (lost.length > 0) {
    const names = baseline.tracks.filter((t) => lost.includes(t.channelId)).map((t) => t.name);
    console.log(`\n⚠⚠ ${where}: A TRACK WAS DESTROYED — ${names.join(', ')}`);
    console.log('Firing app.undo to recover it. Do not re-run until you have checked the project.');
    await req('app.undo');
    await new Promise((r) => setTimeout(r, 1200));
    return false;
  }
  return true;
}

async function selectContainer(trackIndex: number, expect = 'Instrument Layer'): Promise<void> {
  await devicesOn(trackIndex);
  await req('devcursor.selectAt', { deviceIndex: 0 });
  const ok = await pollUntil(async () => {
    const s = (await req('devcursor.status')) as { exists: boolean; name: string };
    return s.exists && s.name === expect;
  }, 6000, 150);
  if (!ok.ok) {
    console.log(`REFUSING: cursor is not on "${expect}" (the e16o trap).`);
    process.exit(1);
  }
}
const chains = async (trackIndex: number) => {
  await selectContainer(trackIndex);
  return (await req('layer.list')) as LayerList;
};

/** ⚠ Focus from a KNOWN state — `focus_or_toggle_*` is a toggle, not a setter. */
async function focusDevicePanel(): Promise<void> {
  await req('app.invokeAction', { id: FOCUS_LAUNCHER });
  await new Promise((r) => setTimeout(r, 250));
  await req('app.invokeAction', { id: FOCUS_DEVICES });
  await new Promise((r) => setTimeout(r, 400));
}

/** Select a LAYER (not the container, not a device) and fire named actions at it. */
async function fireOnLayer(layerIndex: number, where: string, actions: string[]): Promise<void> {
  await selectContainer(subject!.index);
  const sel = await req('layer.select', { layerIndex, where });
  note(`   layer.select(${layerIndex}, ${where}) -> ${JSON.stringify(sel)}`);
  await focusDevicePanel();
  // ⚠ Re-assert AFTER focusing: focusing a panel can move the selection into it.
  await selectContainer(subject!.index);
  await req('layer.select', { layerIndex, where });
  await new Promise((r) => setTimeout(r, 400));
  for (const a of actions) {
    await req('app.invokeAction', { id: a });
    await new Promise((r) => setTimeout(r, 1400));
  }
  await new Promise((r) => setTimeout(r, 800));
}

// ==========================================================================
console.log('\n======== CONTROL — is the device-panel dispatch path live right now?');
note('Reproduce e17d\'s ● on the scratch track. Bitwig must be FOREGROUND, and panel');
note('focus must be established from a known state (the toggle trap).');
note('');
note('⚠ This WAITS rather than refusing, and the reason is practical: the operator has to');
note('be in their editor to start the run, which takes the foreground away from Bitwig —');
note('so a probe that demands the foreground at t=0 can never be started by hand. It');
note('retries for 90s, re-building its fixture each round so no attempt contaminates the');
note('next. ⚠ CLICK INTO BITWIG NOW.');

async function clearScratch(): Promise<void> {
  for (let g = 0; g < 10; g++) {
    const d = await devicesOn(scratch!.index);
    if (d.count === 0) break;
    await req('device.delete', { cursor: '0', deviceIndex: d.devices[0]!.index });
    await pollUntil(async () => (await devicesOn(scratch!.index)).count < d.count, 4000, 200);
  }
}

let dispatchLive = false;
const waitStart = Date.now();
for (let round = 1; Date.now() - waitStart < 90_000; round++) {
  await clearScratch();
  await req('device.insertBitwig', { cursor: '0', uuid: POLYSYNTH });
  await pollUntil(async () => (await devicesOn(scratch.index)).count === 1, 8000, 200);
  await devicesOn(scratch.index);
  await req('device.selectInEditor', { deviceIndex: 0 });
  await focusDevicePanel();
  await req('device.selectInEditor', { deviceIndex: 0 });
  await new Promise((r) => setTimeout(r, 300));
  await req('app.invokeAction', { id: 'Group' });
  await new Promise((r) => setTimeout(r, 1600));
  const ctl = await devicesOn(scratch.index);
  await reapOrphans(`control round ${round}`);
  if (ctl.devices[0]?.name === 'Instrument Layer') {
    note(`dispatch became live on round ${round} (${((Date.now() - waitStart) / 1000).toFixed(0)}s)`);
    dispatchLive = true;
    break;
  }
  note(`round ${round}: still not dispatching — [${ctl.devices.map((d) => d.name).join(', ')}]`);
}
check('CONTROL: `Group` wraps a device — named actions reach the device panel right now',
  dispatchLive, {});
if (!dispatchLive) {
  console.log('\nREFUSING after 90s: the device panel never took the action. Either Bitwig was');
  console.log('not brought forward, or something else about the dispatch path has changed —');
  console.log('and either way every route below would read ○ for an environmental reason.');
  process.exit(1);
}
await clearScratch();

// ==========================================================================
console.log(`\n======== PRECONDITION — ${SUBJECT}, four chains with DISTINCT contents`);
const start = await chains(subject.index);
note(`${shapeOf(start)}`);
note(`chain ids: ${idsOf(start).join(' ')}`);
check('PRECONDITION: 4 chains, each holding a different device, so a new one is NAMED',
  start.count === 4 && new Set(start.layers.map((x) => x.devices[0]?.name)).size === 4,
  { shape: shapeOf(start) });
if (start.count !== 4) { console.log(`REFUSING: ${SUBJECT} is not the 4-chain fixture.`); process.exit(1); }

interface Attempt { label: string; before: number; after: number; grew: boolean }
const attempts: Attempt[] = [];

async function attempt(label: string, layerIndex: number, where: string, actions: string[]): Promise<Attempt> {
  const b = await chains(subject!.index);
  note(`${label}`);
  note(`   BEFORE ${b.count}: ${shapeOf(b)}`);
  await fireOnLayer(layerIndex, where, actions);
  await reapOrphans(label);
  await assertNoTrackLost(label);
  const a = await chains(subject!.index);
  note(`   AFTER  ${a.count}: ${shapeOf(a)}`);
  note(`   ids:   ${idsOf(a).join(' ')}`);
  const r = { label, before: b.count, after: a.count, grew: a.count > b.count };
  attempts.push(r);
  return r;
}

// ==========================================================================
console.log('\n======== ROUTE 1 — select the LAYER, fire `Duplicate` (the most direct form)');
const r1 = await attempt('  layer.select(1,editor) + Duplicate', 1, 'editor', ['Duplicate']);
check('⚠ ROUTE 1: `Duplicate` with a LAYER selected creates a chain',
  r1.grew, { before: r1.before, after: r1.after });

// ==========================================================================
console.log('\n======== ROUTE 2 — the user\'s exact gesture: select the layer, Copy, Paste');
const r2 = r1.grew ? r1 : await attempt('  layer.select(1,editor) + Copy + Paste', 1, 'editor', ['Copy', 'Paste']);
if (!r1.grew) {
  check('⚠ ROUTE 2: Copy+Paste with a LAYER selected creates a chain (the user\'s report)',
    r2.grew, { before: r2.before, after: r2.after });
}

// ==========================================================================
console.log('\n======== ROUTE 3 — the same, via `selectInMixer` rather than `selectInEditor`');
note('⚠ Sibling verbs disagree throughout this API — `copyDevices` ○ beside `moveDevices` ●,');
note('`copyTracks` ○ beside three working duplication verbs. A single-mechanism ○ here');
note('would be the same shape that has produced five false negatives.');
const r3 = (r1.grew || r2.grew) ? r2
  : await attempt('  layer.select(1,mixer) + Copy + Paste', 1, 'mixer', ['Copy', 'Paste']);
if (!r1.grew && !r2.grew) {
  check('ROUTE 3: `selectInMixer` + Copy + Paste creates a chain',
    r3.grew, { before: r3.before, after: r3.after });
}

// ==========================================================================
const createWorks = attempts.some((a) => a.grew);
console.log('\n======== ROUTE 4 — ⚠ GATED: `Delete` with a LAYER selected (row 4 reopened)');
let deleteWorks = false;
if (!createWorks) {
  note('⚠ SKIPPED, deliberately. No create route worked, so there is no evidence that');
  note('  `layer.select` moves the UI selection at all — and firing `Delete` against an');
  note('  unknown selection destroys something that EXISTS, which no reaper undoes.');
  note('  This is E6 blocker 3 with the safety catch on.');
} else {
  const b = await chains(subject.index);
  note(`   BEFORE ${b.count}: ${shapeOf(b)}`);
  note(`   ids:   ${idsOf(b).join(' ')}`);
  const victimId = String(b.layers[1]?.channelId);
  await fireOnLayer(1, 'editor', ['Delete']);
  await reapOrphans('route 4');
  const safe = await assertNoTrackLost('route 4');
  const a = await chains(subject.index);
  note(`   AFTER  ${a.count}: ${shapeOf(a)}`);
  deleteWorks = a.count < b.count;
  check('⚠ ROUTE 4: `Delete` with a LAYER selected removes a chain — row 4 REOPENS',
    deleteWorks, { before: b.count, after: a.count });
  check('and no TRACK was destroyed in the process', safe, {});
  if (deleteWorks) {
    // Name the survivor, do not count it (e16t): a count of 3 is also what
    // deleting the wrong chain produces.
    const goneRight = !idsOf(a).includes(victimId.slice(0, 8));
    check('and the RIGHT chain went (verified by channelId, not by count)',
      goneRight, { victim: victimId.slice(0, 8), remaining: idsOf(a) });
  }
}

// ==========================================================================
console.log('\n-- cleanup');
await reapOrphans('cleanup');
const final = await list();
check('cleanup: every baseline track still exists and nothing was added',
  final.tracks.every((t) => baseIds.has(t.channelId)) && final.count === baseline.count,
  { before: baseline.count, after: final.count });
const endChains = await chains(subject.index);
note(`${SUBJECT} final: ${endChains.count} chains — ${shapeOf(endChains)}`);

// ==========================================================================
console.log('\n======== VERDICT');
console.log(`  CONTROL  device-panel dispatch live        ${dispatchLive ? '●' : '○'}`);
for (const a of attempts) {
  console.log(`  ${a.label.trim().padEnd(42)} ${a.before} -> ${a.after}  ${a.grew ? '●' : '○'}`);
}
console.log(`  ROUTE 4  Delete with a layer selected      ${createWorks ? (deleteWorks ? '●' : '○') : 'SKIPPED (gated)'}`);
if (createWorks && deleteWorks) {
  note('⚠⚠ BOTH ROWS FLIP. A layer chain can be created AND deleted through the UI');
  note('  selection. E17-VERDICT.md §1 is wrong and the whole call must be re-argued:');
  note('  the layer model has a complete branch lifecycle after all.');
} else if (createWorks) {
  note('⚠⚠ ROW 3 FLIPS — a chain CAN be created. Row 4 still decides the model, and it');
  note('  is now the ONLY thing standing between layers and a working branch lifecycle.');
} else {
  note('⇒ A layer is not a selection that named actions act on — or `layer.select` does');
  note('  not reach the UI selection the way `device.selectInEditor` does. ⚠ These are');
  note('  NOT the same finding, and this run cannot separate them: there is no readback');
  note('  for the UI selection, and the control only proves the DEVICE path works.');
  note('  ⇒ The honest next step is a human doing the gesture by hand while we watch');
  note('    layer.list — see the note printed below.');
  note('');
  note('  ⚠ Do NOT record this as "the UI gesture does not exist". The user has done it.');
}

console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} checks reported a negative — read them individually`);
process.exit(0);
