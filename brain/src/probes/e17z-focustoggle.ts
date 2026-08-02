/**
 * E17 rows 3+4 — ⚠⚠ is OUR OWN FOCUS TOGGLE what has been breaking this all along?
 *
 * ⚠ **What `e17y` established, and it moves the whole question.**
 *   - `addIsSelectedInEditorObserver` finally attached (`observing:8`).
 *   - A HUMAN's click and OUR `selectInEditor()` set the **identical flag**:
 *     click → `Organ:EDITOR`, our call → `Phase-4:EDITOR`. **Same object.**
 *   - ⚠ `DeviceChain.select()` (@Deprecated) did NOT throw — it returned, and set
 *     the same flag. The prediction that it would throw was wrong.
 *   - ⚠⚠ **The operator deleted a chain that OUR call had selected, by hand, and it
 *     worked.** So a selection we set programmatically is genuinely actionable.
 *
 * ⇒ **The selection was never the blocker.** It is set correctly, it reads back
 * correctly, and Bitwig honours it. What fails is only our NAMED-ACTION dispatch.
 *
 * ⚠ **And there is exactly one variable that separates the run that worked from
 * every run that failed.** `e17l` — where our `Copy`+`Paste` gave 4→5 and our
 * `Delete` gave 4→3 on a human-set selection — **never called `focusDevicePanel()`.**
 * `e17k`, `e17q`, `e17v` and `e17x` all did, and all failed to reach the chain.
 *
 *     focus_or_toggle_clip_launcher  →  focus_or_toggle_device_panel
 *
 * ⚠ Both are TOGGLES, not setters. That round trip through the launcher was added
 * by us to "focus from a known state", and the plain reading now is that it resets
 * the device panel's target to its default DEVICE — which is precisely what `e17x`
 * measured and recorded as "the panel's current device wins outright". If so, that
 * finding is not wrong but it is SCOPED: it holds *with the panel explicitly
 * focused*, a condition we imposed on ourselves.
 *
 * **Three arms, one variable:**
 *   A  no focus calls at all           — the `e17l` condition
 *   B  the full toggle round trip      — the failing recipe, as a control
 *   C  only `focus_or_toggle_device_panel`, no launcher first — is the LAUNCHER
 *      step the culprit rather than focusing as such?
 *
 * ⚠ Every arm asserts the chain flag via the observer AT THE MOMENT OF FIRING, and
 * is bracketed by a container reference arm proving dispatch was live — `e17v`'s
 * first run was voided by a dead gate discovered only at the end.
 *
 * ⚠ Needs Bitwig FOREGROUND for the whole run; arrange it, never start it
 * opportunistically (standing instruction, 2026-08-01).
 * ⚠ `Delete` is GATED on a create arm working first.
 * Silent: nothing is launched and the transport is never touched.
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
interface LayerList { layers: { index: number; name: string; devices: { name: string }[] }[]; count: number }
interface SelRow { index: number; selectedInEditor: boolean; selected: boolean }
interface SelState { editorObserver: string; layers: SelRow[]; cursorLayerName?: string;
  cursorLayerExists?: boolean | string }

await client.connect();
const baseline = await list();
const baseIds = new Set(baseline.tracks.map((t) => t.channelId));
const subject = baseline.tracks.find((t) => t.name === SUBJECT);
const scratch = baseline.tracks.find((t) => t.name === SCRATCH);
if (!subject || !scratch) { console.log('REFUSING: gn-lay4 / gn-A missing.'); process.exit(1); }

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

async function scope(): Promise<void> {
  await devicesOn(subject!.index);
  await req('devcursor.selectAt', { deviceIndex: 0 });
  const ok = await pollUntil(async () => {
    const s = (await req('devcursor.status')) as { exists: boolean; name: string };
    return s.exists && s.name === 'Instrument Layer';
  }, 6000, 150);
  if (!ok.ok) { console.log('REFUSING: cursor not on the container (the e16o trap).'); process.exit(1); }
}

async function chains(): Promise<LayerList> {
  await scope();
  return (await req('layer.list')) as LayerList;
}
const contentsOf = (l: LayerList) => l.layers.map((x) => x.devices[0]?.name ?? '—');

/** ⚠ The cheap read — does not walk device banks, so it cannot perturb the selection. */
const selState = async () => (await req('layer.selectionState')) as SelState;

interface Level { tracks: number; devices: number; chains: number; contents: string[] }
async function levels(): Promise<Level> {
  const t = await list();
  const d = await devicesOn(subject!.index);
  const c = await chains();
  return { tracks: t.count, devices: d.count, chains: c.count, contents: contentsOf(c) };
}
const fmt = (l: Level) => `tracks=${l.tracks} devices=${l.devices} chains=${l.chains} [${l.contents.join(' ')}]`;

async function reap(where: string): Promise<void> {
  for (let g = 0; g < 10; g++) {
    const now = await list();
    const orphan = now.tracks.find((x) => !baseIds.has(x.channelId));
    if (!orphan) break;
    note(`⚠ ${where}: reaped orphan track ${orphan.name}`);
    await req('track.delete', { trackIndex: orphan.index });
    await pollUntil(async () => !(await list()).tracks.some((x) => x.channelId === orphan.channelId), 4000, 200);
  }
}

async function restore(target: Level, where: string): Promise<void> {
  await reap(where);
  for (let g = 0; g < 16; g++) {
    const d = await devicesOn(subject!.index);
    if (d.count <= target.devices) break;
    note(`⚠ ${where}: trimming a duplicate container (${d.count} -> ${d.count - 1})`);
    await req('device.delete', { cursor: '0', deviceIndex: d.devices[d.devices.length - 1]!.index });
    await pollUntil(async () => (await devicesOn(subject!.index)).count < d.count, 4000, 200);
  }
  for (let g = 0; g < 8; g++) {
    const c = await chains();
    if (c.count <= target.chains) break;
    note(`⚠ ${where}: undoing an extra chain (${c.count} -> ${target.chains})`);
    await req('app.undo');
    await new Promise((r) => setTimeout(r, 1500));
  }
  // ⚠ The device cursor ORPHANS after deletes; only a track-cursor MOVE recovers it.
  await pointAt(scratch!.index);
  await pointAt(subject!.index);
}

// ==========================================================================
console.log('\n-- PRECONDITIONS');
const boot = await selState();
note(`editor observer: ${boot.editorObserver}`);
check('⚠ the selection READBACK is attached (e17y\'s instrument)',
  String(boot.editorObserver).startsWith('observing:'), { status: boot.editorObserver });
if (!String(boot.editorObserver).startsWith('observing:')) {
  console.log('\nREFUSING: no reader, so no arm below can assert its precondition.');
  process.exit(1);
}
const start = await levels();
note(`${SUBJECT}: ${fmt(start)}`);
check('PRECONDITION: one container, 4 chains, distinct contents',
  start.devices === 1 && start.chains === 4 && new Set(start.contents).size === 4, { state: fmt(start) });
if (start.chains !== 4) { console.log('REFUSING: not the 4-chain fixture.'); process.exit(1); }

// ==========================================================================
console.log('\n-- CONTROL: is dispatch live? (needs FOREGROUND)');
note('⚠ CLICK INTO BITWIG and STAY there. Retrying for 90s.');
async function clearScratch(): Promise<void> {
  for (let g = 0; g < 10; g++) {
    const d = await devicesOn(scratch!.index);
    if (d.count === 0) break;
    await req('device.delete', { cursor: '0', deviceIndex: d.devices[0]!.index });
    await pollUntil(async () => (await devicesOn(scratch!.index)).count < d.count, 4000, 200);
  }
}
let live = false;
const t0 = Date.now();
for (let round = 1; Date.now() - t0 < 90_000; round++) {
  await clearScratch();
  await req('device.insertBitwig', { cursor: '0', uuid: POLYSYNTH });
  await pollUntil(async () => (await devicesOn(scratch.index)).count === 1, 8000, 200);
  await devicesOn(scratch.index);
  await req('device.selectInEditor', { deviceIndex: 0 });
  await req('app.invokeAction', { id: FOCUS_LAUNCHER });
  await new Promise((r) => setTimeout(r, 250));
  await req('app.invokeAction', { id: FOCUS_DEVICES });
  await new Promise((r) => setTimeout(r, 400));
  await req('device.selectInEditor', { deviceIndex: 0 });
  await new Promise((r) => setTimeout(r, 300));
  await req('app.invokeAction', { id: 'Group' });
  await new Promise((r) => setTimeout(r, 1600));
  if ((await devicesOn(scratch.index)).devices[0]?.name === 'Instrument Layer') {
    note(`dispatch live on round ${round} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    live = true; break;
  }
  note(`round ${round}: not dispatching`);
}
await clearScratch();
await reap('control');
check('CONTROL: named actions reach Bitwig right now', live, {});
if (!live) { console.log('\nREFUSING after 90s — bring Bitwig forward and re-run.'); process.exit(1); }

// ==========================================================================
type FocusMode = 'none' | 'toggle' | 'panelOnly';

async function applyFocus(mode: FocusMode): Promise<void> {
  if (mode === 'none') return;
  if (mode === 'toggle') {
    await req('app.invokeAction', { id: FOCUS_LAUNCHER });
    await new Promise((r) => setTimeout(r, 250));
  }
  await req('app.invokeAction', { id: FOCUS_DEVICES });
  await new Promise((r) => setTimeout(r, 400));
}

interface Shot { label: string; target: string; before: Level; after: Level; flagOk: boolean }
const shots: Shot[] = [];

/**
 * Select a chain, assert the flag, fire. ⚠ The focus mode is the ONLY thing that
 * varies between arms.
 */
async function shoot(label: string, mode: FocusMode, actions: string[]): Promise<Shot> {
  const before = await levels();
  await scope();
  const s0 = await selState();
  const lit = s0.cursorLayerExists === true ? String(s0.cursorLayerName) : '';
  // ⚠ Aim at a chain that is NOT already selected. Never a fixed index.
  const idx = before.contents.findIndex((c) => c !== lit);
  const target = before.contents[idx]!;

  await applyFocus(mode);
  await req('layer.select', { layerIndex: idx, where: 'editor' });
  await new Promise((r) => setTimeout(r, 700));

  // ⚠ Assert the PRECONDITION with the observer, separately from the question.
  const atFiring = await selState();
  const row = atFiring.layers.find((r) => r.index === idx);
  const flagOk = row?.selectedInEditor === true;
  console.log(`\n  ${label}`);
  note(`   focus=${mode}   target=${target} (chain ${idx})   flag at firing: ${flagOk ? '● SET' : '○ NOT SET'}`);
  note(`   BEFORE ${fmt(before)}`);
  check(`PRECONDITION [${label}]: the target chain's EDITOR flag is set when the action fires`,
    flagOk, { target, flags: atFiring.layers.slice(0, 4).map((r) => `${r.index}:${r.selectedInEditor}`) });

  for (const a of actions) {
    await req('app.invokeAction', { id: a });
    await new Promise((r) => setTimeout(r, 1700));
  }
  const after = await levels();
  note(`   AFTER  ${fmt(after)}`);
  const dT = after.tracks - before.tracks, dD = after.devices - before.devices, dC = after.chains - before.chains;
  const verdict = dC > 0 ? '●● CHAIN' : dD > 0 ? '◐ CONTAINER' : dT > 0 ? '⚠ TRACK' : '○ nothing';
  console.log(`   Δtracks=${dT} Δdevices=${dD} Δchains=${dC}   ${verdict}`);
  if (dC > 0) {
    // ⚠ 5 chains is also what duplicating the WRONG one produces (e16t).
    const grew = after.contents.filter((c) => c === target).length
      - before.contents.filter((c) => c === target).length;
    check(`⚠ and it is the TARGET chain that was copied — a second ${target}`,
      grew > 0, { target, before: before.contents, after: after.contents });
  }
  const shot = { label, target, before, after, flagOk };
  shots.push(shot);
  await restore(before, label);
  return shot;
}

/** The gate. ⚠ Uses the container, which is known to work under the toggle. */
async function gate(tag: string): Promise<void> {
  const before = await levels();
  await devicesOn(subject!.index);
  await req('device.selectInEditor', { deviceIndex: 0 });
  await applyFocus('toggle');
  await req('device.selectInEditor', { deviceIndex: 0 });
  await new Promise((r) => setTimeout(r, 400));
  await req('app.invokeAction', { id: 'Duplicate' });
  await new Promise((r) => setTimeout(r, 1700));
  const after = await levels();
  const alive = after.devices > before.devices;
  note(`   ✓ gate ${alive ? 'ALIVE' : '⚠ DEAD'} at "${tag}" (container ${before.devices} -> ${after.devices})`);
  await restore(before, `gate ${tag}`);
  if (!alive) {
    console.log(`\n⚠⚠ REFUSING: dispatch died at "${tag}". Everything around it is void.`);
    console.log('  ⚠ Bring Bitwig to the FRONT and stay there for the entire run.');
    await restore(start, 'refuse');
    process.exit(1);
  }
}

// ==========================================================================
console.log('\n======== THE A/B — one variable: our own focus call');
await gate('before the arms');
const armA = await shoot('⚠ ARM A: NO focus call at all  (the e17l condition)', 'none', ['Duplicate']);
await gate('between A and B');
const armB = await shoot('ARM B: full toggle round trip  (the failing recipe, as control)', 'toggle', ['Duplicate']);
await gate('between B and C');
const armC = await shoot('ARM C: device panel only, no launcher first', 'panelOnly', ['Duplicate']);
await gate('after the arms');

const grewOf = (s: Shot) => s.after.chains > s.before.chains;
const created = grewOf(armA) || grewOf(armC);

// ==========================================================================
console.log('\n======== ROW 4 — ⚠ GATED on a create arm working');
let deleted = false;
if (!created) {
  note('SKIPPED. No create arm reached the chain, so a stray `Delete` would destroy');
  note('something real (E6 blocker 3).');
} else {
  const mode: FocusMode = grewOf(armA) ? 'none' : 'panelOnly';
  note(`using focus=${mode}, the arm that reached the chain`);
  const before = await levels();
  const d = await shoot(`⚠ ROW 4: Delete with focus=${mode}`, mode, ['Delete']);
  deleted = d.after.chains < d.before.chains;
  check('⚠⚠ ROW 4: `Delete` on a chain WE selected removes it', deleted,
    { before: d.before.chains, after: d.after.chains });
  check('and no TRACK was destroyed', d.after.tracks === before.tracks,
    { before: before.tracks, after: d.after.tracks });
}

// ==========================================================================
console.log('\n-- final state');
await restore(start, 'final');
const end = await levels();
note(`${SUBJECT}: ${fmt(end)}`);
check('the fixture is back to baseline at all three levels',
  end.tracks === start.tracks && end.devices === start.devices
  && end.chains === start.chains && end.contents.join() === start.contents.join(),
  { start: fmt(start), end: fmt(end) });

// ==========================================================================
console.log('\n======== VERDICT');
for (const s of shots) {
  const dC = s.after.chains - s.before.chains;
  const dD = s.after.devices - s.before.devices;
  console.log(`  ${s.label.padEnd(56)} Δchains=${dC} Δdevices=${dD}`);
}
console.log('');
if (grewOf(armA) && !grewOf(armB)) {
  note('⚠⚠ OUR OWN FOCUS TOGGLE WAS THE BUG. With no focus call the action reaches the');
  note('  chain; with the toggle it takes the container. Rows 3/4 FLIP to ●, and every');
  note('  ○ recorded through e17k/e17q/e17v/e17x was measuring our own workaround.');
  note('  ⇒ E17-VERDICT §1a collapses and the call must be re-argued from scratch:');
  note('  a layer chain has a complete branch lifecycle. ⚠ §1b (no durable chain');
  note('  identity, 8/8 ids changed on reload) is untouched and still stands alone.');
} else if (created) {
  note(`⚠ A create arm worked (A=${grewOf(armA)} C=${grewOf(armC)}) — record WHICH, precisely.`);
  note('  The focus recipe is load-bearing and the exact working form is the finding.');
} else if (armA.flagOk && armB.flagOk) {
  note('⇒ The flag was set in every arm and no arm reached the chain, focus or not.');
  note('  ⚠ So the focus toggle is NOT the explanation, and e17l\'s success came from');
  note('  something else about a human-driven click that we still have not isolated.');
  note('  ⚠ Note the operator DID delete our-selected chain by hand (e17y) — so a');
  note('  keystroke honours it and `invokeAction` does not. That is the next question.');
} else {
  note('⚠ Some arm failed its precondition — read the checks individually before');
  note('  concluding anything.');
}
console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} checks reported a negative — read individually`);
process.exit(0);
