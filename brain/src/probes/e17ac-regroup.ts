/**
 * E17 — re-measure the NAMED-ACTION results taken under the cleared state.
 *
 * ⚠ **Why.** `e17ab` proved our own `cursor.pointTrack` (= `CursorTrack.
 * selectChannel()`, which E16j showed sets the UI track selection) was clearing the
 * actionable state before nearly every named-action measurement in E17. Rows 3/4
 * flipped from ○ to ● the moment it was removed. Three results were taken the same
 * way and have never been re-run:
 *
 *   ROW 1   "`Group` gives a container with exactly ONE chain and nothing we can
 *           call seeds a second."  ⚠ This is the load-bearing one: `Duplicate` on a
 *           selected chain demonstrably adds one now, so a one-chain container
 *           almost certainly CAN grow — and if it can, **§5's entire preset-library
 *           dependency dissolves** (rule 11 / E4h / `bwmod`'s offline chain trim
 *           all stop being prerequisites of the A/B story).
 *   UNGROUP `e17i`'s ○ — fired through `focus_or_toggle_device_panel` + `Select All`.
 *   PASTE   `e17j`'s NAMED routes. ⚠ Route A (`layer.pasteInto`) is a TYPED call and
 *           is unaffected; its ● stands and is not re-run here.
 *
 * ⚠ **The corrected harness, and it is the whole point:**
 *   1. `cursor.pointTrack` ONCE per section, at the top. ⚠ Never between tracks
 *      mid-sequence — `e17ab`'s DESTROYER arm moved away and back and that alone
 *      killed it, even though the cursor ended up in the same place.
 *   2. Between the chain selection and the action: `layer.selectionState` only.
 *      It moves no cursor. `device.list`/`layer.list` are called before or after,
 *      never between.
 *   3. The chain flag is ASSERTED at firing, separately from the question (E16o).
 *
 * ⚠ **The focus toggle is measured, not assumed.** `Group` on a plain device needs
 * `device.selectInEditor` + panel focus (`e17d`/`e17t`), but the toggle is also what
 * `e17z` arm B was doing when the action took the container. So the chain-growth
 * step is tried BOTH ways — without the toggle first, then with it — rather than
 * picking one and reading a ○ as a property of Bitwig.
 *
 * ⚠ Needs Bitwig FOREGROUND for the whole run; arrange it (standing instruction).
 * Silent: nothing is launched and the transport is never touched.
 */
import { client, check, note, failureCount, pollUntil } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);

const SCRATCH = 'gn-A';
const SUBJECT = 'gn-lay4';
const POLYSYNTH = 'a9ffacb5-33e9-4fc7-8621-b1af31e410ef';
const FOCUS_DEVICES = 'focus_or_toggle_device_panel';
const FOCUS_LAUNCHER = 'focus_or_toggle_clip_launcher';

interface TrackRow { index: number; name: string; type: string; channelId: string }
interface DevList { devices: { index: number; name: string }[]; count: number; itemCount: number }
interface LayerList { layers: { index: number; name: string; devices: { name: string }[] }[]; count: number }
interface SelRow { index: number; selectedInEditor: boolean }
interface SelState { editorObserver: string; layers: SelRow[] }

await client.connect();
const tracks = ((await req('track.list')) as { tracks: TrackRow[] }).tracks;
const scratch = tracks.find((t) => t.name === SCRATCH);
const subject = tracks.find((t) => t.name === SUBJECT);
if (!scratch || !subject) { console.log('REFUSING: gn-A / gn-lay4 missing.'); process.exit(1); }

/** ⚠ THE DANGEROUS CALL. Once per section, never mid-sequence. */
async function pointOnce(trackIndex: number): Promise<void> {
  await req('cursor.pointTrack', { cursor: '0', trackIndex });
  await pollUntil(async () => {
    const s = (await req('cursor.status', { cursor: '0' })) as { trackPosition: number };
    return s.trackPosition === trackIndex;
  }, 4000, 150);
  await new Promise((r) => setTimeout(r, 400));
}

/** ⚠ No pointTrack. Assumes the track cursor is already where it should be. */
async function devs(): Promise<DevList> {
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
const shapeOf = (d: DevList) => `[${d.devices.map((x) => x.name).join(', ')}]`;

/** Scope the DEVICE cursor only — this does not move the track cursor. */
async function scopeTo(deviceIndex: number, expect: RegExp): Promise<boolean> {
  await req('devcursor.selectAt', { deviceIndex });
  const ok = await pollUntil(async () => {
    const s = (await req('devcursor.status')) as { exists: boolean; name: string };
    return s.exists && expect.test(s.name);
  }, 6000, 150);
  return ok.ok;
}
const chainsNow = async () => (await req('layer.list')) as LayerList;
const selState = async () => (await req('layer.selectionState')) as SelState;

async function focusPanel(full: boolean): Promise<void> {
  if (full) {
    await req('app.invokeAction', { id: FOCUS_LAUNCHER });
    await new Promise((r) => setTimeout(r, 250));
  }
  await req('app.invokeAction', { id: FOCUS_DEVICES });
  await new Promise((r) => setTimeout(r, 400));
}

async function clearScratch(): Promise<void> {
  for (let g = 0; g < 12; g++) {
    const d = await devs();
    if (d.count === 0) break;
    await req('device.delete', { cursor: '0', deviceIndex: d.devices[0]!.index });
    await pollUntil(async () => (await devs()).count < d.count, 4000, 200);
  }
}

async function reap(where: string): Promise<void> {
  const ids = new Set(tracks.map((t) => t.channelId));
  for (let g = 0; g < 10; g++) {
    const now = ((await req('track.list')) as { tracks: TrackRow[] }).tracks;
    const orphan = now.find((x) => !ids.has(x.channelId));
    if (!orphan) break;
    note(`⚠ ${where}: reaped orphan track ${orphan.name}`);
    await req('track.delete', { trackIndex: orphan.index });
    await pollUntil(async () =>
      !((await req('track.list')) as { tracks: TrackRow[] }).tracks.some((x) => x.channelId === orphan.channelId),
    4000, 200);
  }
}

// ==========================================================================
console.log('\n-- PRECONDITIONS');
const boot = await selState();
check('the selection reader is attached', String(boot.editorObserver).startsWith('observing:'),
  { status: boot.editorObserver });
if (!String(boot.editorObserver).startsWith('observing:')) { console.log('REFUSING.'); process.exit(1); }

// ==========================================================================
console.log('\n======== SECTION 1 — ROW 1 RE-MEASURED: can a one-chain container GROW?');
await pointOnce(scratch.index);            // ⚠ the only pointTrack in this section
await clearScratch();

// Build [Polysynth] and Group it — the e17d/e17t recipe, which needs panel focus.
note('building: insert Polysynth, then Group it (the known e17d/e17t recipe)');
let live = false;
const t0 = Date.now();
for (let round = 1; Date.now() - t0 < 90_000; round++) {
  await clearScratch();
  await req('device.insertBitwig', { cursor: '0', uuid: POLYSYNTH });
  await pollUntil(async () => (await devs()).count === 1, 8000, 200);
  await devs();
  await req('device.selectInEditor', { deviceIndex: 0 });
  await focusPanel(true);
  await req('device.selectInEditor', { deviceIndex: 0 });
  await new Promise((r) => setTimeout(r, 300));
  await req('app.invokeAction', { id: 'Group' });
  await new Promise((r) => setTimeout(r, 1800));
  if ((await devs()).devices[0]?.name === 'Instrument Layer') {
    note(`Group succeeded on round ${round} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    live = true; break;
  }
  note(`round ${round}: Group not dispatching — is Bitwig foreground?`);
}
await reap('section 1 build');
check('CONTROL: `Group` created a container (dispatch live, and row 1\'s first half)', live, {});
if (!live) { console.log('\nREFUSING after 90s — bring Bitwig forward and re-run.'); await clearScratch(); process.exit(1); }

const built = await devs();
note(`gn-A now: ${shapeOf(built)}`);
const contAt = built.devices.findIndex((d) => d.name === 'Instrument Layer');
if (!await scopeTo(contAt, /Instrument Layer/)) {
  console.log('REFUSING: could not scope to the new container.'); await clearScratch(); process.exit(1);
}
const one = await chainsNow();
note(`the new container holds ${one.count} chain(s): ${one.layers.map((x) => x.devices[0]?.name ?? '—').join(' ')}`);
check('row 1 first half re-confirmed: `Group` yields exactly ONE chain',
  one.count === 1, { count: one.count });

/** ⚠ Select chain 0 and fire, with the focus regime as the only variable. */
async function growAttempt(label: string, toggle: boolean | null): Promise<number> {
  const before = await chainsNow();
  if (toggle !== null) await focusPanel(toggle);
  await req('layer.select', { layerIndex: 0, where: 'editor' });
  await new Promise((r) => setTimeout(r, 800));
  const at = await selState();     // ⚠ cursor-free; the only call before firing
  const flagOk = at.layers.find((r) => r.index === 0)?.selectedInEditor === true;
  console.log(`\n  ${label}`);
  note(`   flag at firing: ${flagOk ? '● SET' : '○ NOT SET'}   chains before: ${before.count}`);
  await req('app.invokeAction', { id: 'Duplicate' });
  await new Promise((r) => setTimeout(r, 1900));
  const after = await chainsNow();
  note(`   chains ${before.count} -> ${after.count}   [${after.layers.map((x) => x.devices[0]?.name ?? '—').join(' ')}]`);
  return after.count;
}

const noToggle = await growAttempt('⚠⚠ GROW attempt 1 — no focus call (the e17ab recipe)', null);
let grewTo = noToggle;
if (noToggle <= one.count) {
  grewTo = await growAttempt('GROW attempt 2 — with the panel focused', false);
}
check('⚠⚠ ROW 1 RE-MEASURED: a one-chain container CAN grow to two',
  grewTo > one.count, { from: one.count, to: grewTo });

let grewAgain = grewTo;
if (grewTo > one.count) {
  grewAgain = await growAttempt('GROW attempt 3 — and again, to three?', null);
  check('and it keeps growing — the shape is not capped at two',
    grewAgain > grewTo, { from: grewTo, to: grewAgain });
}

// ==========================================================================
console.log('\n======== SECTION 2 — UNGROUP re-measured (e17i\'s ○)');
const beforeUn = await devs();
await req('device.selectInEditor', { deviceIndex: contAt });
await new Promise((r) => setTimeout(r, 500));
await req('app.invokeAction', { id: 'Ungroup' });
await new Promise((r) => setTimeout(r, 1900));
const afterUn = await devs();
note(`gn-A: ${shapeOf(beforeUn)} -> ${shapeOf(afterUn)}`);
const ungrouped = !afterUn.devices.some((d) => d.name === 'Instrument Layer');
check('⚠ UNGROUP re-measured: the container dissolves', ungrouped,
  { before: shapeOf(beforeUn), after: shapeOf(afterUn) });

console.log('\n-- cleanup: gn-A back to empty');
await clearScratch();
await reap('section 2');
check('gn-A is empty again', (await devs()).count === 0, { shape: shapeOf(await devs()) });

// ==========================================================================
console.log('\n======== SECTION 3 — the NAMED clipboard route re-measured (e17j)');
note('⚠ e17j route A (`layer.pasteInto`) is a TYPED call, unaffected by the wound —');
note('  its ● stands and is not re-run. This is the named Copy/Paste route only.');
await pointOnce(subject.index);            // ⚠ the only pointTrack in this section
if (!await scopeTo(0, /Instrument Layer/)) {
  console.log('REFUSING: could not scope to gn-lay4\'s container.'); process.exit(1);
}
const cBefore = await chainsNow();
note(`${SUBJECT}: ${cBefore.count} chains — ${cBefore.layers.map((x) => x.devices[0]?.name ?? '—').join(' ')}`);
const targetIdx = 2;
const targetName = cBefore.layers[targetIdx]?.devices[0]?.name ?? '—';
await req('layer.select', { layerIndex: targetIdx, where: 'editor' });
await new Promise((r) => setTimeout(r, 800));
const atCopy = await selState();
check(`PRECONDITION: ${targetName} is flagged before Copy`,
  atCopy.layers.find((r) => r.index === targetIdx)?.selectedInEditor === true, { targetName });
await req('app.invokeAction', { id: 'Copy' });
await new Promise((r) => setTimeout(r, 1200));
await req('app.invokeAction', { id: 'Paste' });
await new Promise((r) => setTimeout(r, 1900));
const cAfter = await chainsNow();
const names = cAfter.layers.map((x) => x.devices[0]?.name ?? '—');
note(`${SUBJECT}: ${cBefore.count} -> ${cAfter.count} chains — ${names.join(' ')}`);
const pasted = cAfter.count > cBefore.count;
check('⚠ the NAMED `Copy`+`Paste` route creates a chain', pasted,
  { before: cBefore.count, after: cAfter.count });
if (pasted) {
  const grew = names.filter((n) => n === targetName).length
    - cBefore.layers.map((x) => x.devices[0]?.name ?? '—').filter((n) => n === targetName).length;
  check(`and it is ${targetName} that was copied — named, not counted`, grew > 0,
    { targetName, after: names });
}

console.log('\n-- cleanup: undo back to 4 chains');
for (let g = 0; g < 8; g++) {
  const c = await chainsNow();
  if (c.count <= cBefore.count) break;
  await req('app.undo');
  await new Promise((r) => setTimeout(r, 1600));
}
await reap('final');
const end = await chainsNow();
check(`${SUBJECT} is back to ${cBefore.count} chains`, end.count === cBefore.count,
  { before: cBefore.count, end: end.count });

// ==========================================================================
console.log('\n======== VERDICT');
console.log(`  ROW 1   Group yields one chain          ${one.count === 1 ? '●' : '○'}`);
console.log(`  ⚠ ROW 1 that container can GROW         ${grewTo > one.count ? '●● YES' : '○ no'}`);
console.log(`  ⚠      and keeps growing                ${grewAgain > grewTo ? '●' : '—'}`);
console.log(`  UNGROUP dissolves the container         ${ungrouped ? '●' : '○'}`);
console.log(`  PASTE   named Copy+Paste creates        ${pasted ? '●' : '○'}`);
console.log('');
if (grewTo > one.count) {
  note('⚠⚠⚠ ROW 1 IS OVERTURNED. A container built by `Group` grows to two chains and');
  note('  beyond, so a multi-chain container needs NO human-authored `.bwpreset`.');
  note('  ⇒ §5\'s whole dependency chain DISSOLVES: rule 11 / E4h / `insertFile` /');
  note('  `bwmod`\'s offline chain trim stop being prerequisites of the A/B story.');
  note('  ⇒ Layers can be built from nothing, at runtime, with no preset library.');
} else {
  note('⚠ Row 1 stands: the container does not grow even under the corrected harness.');
  note('  ⚠ Record WHICH focus regime was tried — both were — so this is a real ○ and');
  note('  not another single-recipe artifact.');
}
console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} checks reported a negative — read individually`);
process.exit(0);
