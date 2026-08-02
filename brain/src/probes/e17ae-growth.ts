/**
 * E17 row 1, PROPERLY — does chain count gate growth, or was that our recipe?
 *
 * ⚠⚠ **`e17ac` was invalid twice over and neither fault was Bitwig's.**
 *
 *   1. **The blind spot, for the third time.** `growAttempt` measured only
 *      `chainsNow()`, so when `Duplicate` copied the CONTAINER the reading said
 *      "1 -> 1 chains, nothing happened". The next section's device list gave it
 *      away: `[Instrument Layer, Instrument Layer]`. Same failure as `e17p`, which
 *      I had already diagnosed in `e17v` and written again anyway.
 *   2. ⚠ **The confound, which is worse.** To make `Group` build a container the
 *      recipe calls `device.selectInEditor(0)` — and `e17x` PROVED that call sets
 *      the device panel's current device, which beats the chain selection. So the
 *      build step poisoned the very measurement that followed. `e17ab` worked
 *      precisely because it never called `device.selectInEditor` at all.
 *
 * ⇒ **Row 1's growth question is UNANSWERED**, and `e17ac`'s three ○s are void.
 *
 * ⚠ **The fix is to stop needing `Group`.** `gn-lay4` already has a container, and
 * `Delete` on a chain now works (`e17ab`), so the chain COUNT can be varied on an
 * existing container with the one recipe proven clean — and `device.selectInEditor`
 * is never called in this probe at all.
 *
 *   CONTROL   at 4 chains, grow → 5. Proves the recipe is live in THIS sitting, so
 *             a later ○ means something. ⚠ A positive control that reproduces the
 *             SUCCESS is what `e17ac` lacked.
 *   SHRINK    delete down to exactly ONE chain, verified at every level.
 *   ⚠ QUESTION at 1 chain, grow → 2?
 *
 * If growth works at 4 and fails at 1, chain count really does gate it and row 1
 * stands. If it works at both, row 1 was our recipe all along and **§5's whole
 * preset-library dependency dissolves**.
 *
 * ⚠ EVERY reading is all-levels — tracks, devices, chains, and chain contents — so
 * a container duplication can never again be read as "nothing happened".
 * ⚠ `cursor.pointTrack` is called ONCE, at the top. Never mid-sequence (`e17ab`'s
 * DESTROYER arm).
 *
 * ⚠⚠ **THE DEVICE PANEL MUST BE OPEN AND SHOWING `gn-lay4`'s CHAINS.** This is a
 * real precondition, discovered the hard way: the operator noticed the panel had
 * CLOSED after `e17ac`, which fired `focus_or_toggle_device_panel` repeatedly in
 * its Group retry loop. It is a **toggle**, so an odd number of fires shuts the
 * panel — and with no device panel a chain action silently does nothing, Δ0 at
 * every level, indistinguishable from "the capability does not exist".
 *
 * ⚠ That is the THIRD call of ours to break its own measurement, after
 * `cursor.pointTrack` and `device.selectInEditor`. This probe fires **no focus
 * actions at all**, so once the panel is open it stays open.
 *
 * ⚠ Needs Bitwig FOREGROUND for the whole run; arrange it.
 * Silent: nothing is launched and the transport is never touched.
 */
import { client, check, note, failureCount, pollUntil, waitForEnter } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);
const SUBJECT = 'gn-lay4';

interface TrackRow { index: number; name: string; type: string; channelId: string }
interface DevList { devices: { index: number; name: string }[]; count: number; itemCount: number }
interface LayerList { layers: { index: number; name: string; devices: { name: string }[] }[]; count: number }
interface SelRow { index: number; selectedInEditor: boolean }
interface SelState { editorObserver: string; layers: SelRow[] }

await client.connect();
const tracks0 = ((await req('track.list')) as { tracks: TrackRow[] }).tracks;
// ⚠⚠ REFUSE on a duplicate NAME. Two tracks called `gn-lay4` is exactly how the
// previous run failed: a named `Duplicate` fired against the UI TRACK selection and
// forked the whole track (E6 blocker 3 / E16j), after which `find(name === …)`
// silently returned the FIRST match while the UI selection sat on the other one —
// so we selected a chain on one track and fired the action at another.
const matches = tracks0.filter((t) => t.name === SUBJECT);
if (matches.length !== 1) {
  console.log(`\n⚠⚠ REFUSING: ${matches.length} tracks are named ${SUBJECT}.`);
  for (const m of matches) console.log(`     [${m.index}] ${m.name} ${m.channelId.slice(0, 8)}`);
  console.log('  A name is not an identity here. Reap the orphan first:');
  console.log('     npm run probe:e17-reap                 (lists and flags duplicates)');
  console.log('     npm run probe:e17-reap -- <channelId8> (deletes exactly one)');
  process.exit(1);
}
const subject = matches[0]!;
note(`subject: ${SUBJECT} [${subject.index}] channelId ${subject.channelId.slice(0, 8)}`);

// ⚠ An orphan TRACK appearing mid-run means a named action hit the track selection.
// Detected by identity against this baseline, never by count.
const baseTrackIds = new Set(tracks0.map((t) => t.channelId));
async function assertNoOrphan(tag: string): Promise<void> {
  const now = ((await req('track.list')) as { tracks: TrackRow[] }).tracks;
  const orphan = now.find((t) => !baseTrackIds.has(t.channelId));
  if (orphan) {
    note(`⚠⚠ ${tag}: a named action FORKED A TRACK — [${orphan.index}] ${orphan.name}`
      + ` ${orphan.channelId.slice(0, 8)}. That is the action landing on the TRACK selection.`);
    await req('track.delete', { trackIndex: orphan.index });
    await pollUntil(async () =>
      !((await req('track.list')) as { tracks: TrackRow[] }).tracks.some((t) => t.channelId === orphan.channelId),
    6000, 200);
    note(`   reaped ${orphan.channelId.slice(0, 8)}`);
  }
}

/** ⚠ ONCE, at the top. */
await req('cursor.pointTrack', { cursor: '0', trackIndex: subject.index });
await pollUntil(async () => {
  const s = (await req('cursor.status', { cursor: '0' })) as { trackPosition: number };
  return s.trackPosition === subject.index;
}, 4000, 150);
await new Promise((r) => setTimeout(r, 400));

/** ⚠ No pointTrack — the track cursor is already parked. */
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

/** ⚠ ALL LEVELS. The reading e17ac should have taken. */
interface Level { tracks: number; devices: number; itemCount: number; chains: number; contents: string[] }
async function levels(): Promise<Level> {
  const t = ((await req('track.list')) as { tracks: TrackRow[] }).tracks.length;
  const d = await devs();
  const at = d.devices.findIndex((x) => x.name === 'Instrument Layer');
  let chains = 0;
  let contents: string[] = [];
  if (at >= 0) {
    await req('devcursor.selectAt', { deviceIndex: at });
    const ok = await pollUntil(async () => {
      const s = (await req('devcursor.status')) as { exists: boolean; name: string };
      return s.exists && s.name === 'Instrument Layer';
    }, 6000, 150);
    if (ok.ok) {
      const l = (await req('layer.list')) as LayerList;
      chains = l.count;
      contents = l.layers.map((x) => x.devices[0]?.name ?? '—');
    }
  }
  return { tracks: t, devices: d.count, itemCount: d.itemCount, chains, contents };
}
const fmt = (l: Level) =>
  `tracks=${l.tracks} devices=${l.devices}/${l.itemCount} chains=${l.chains} [${l.contents.join(' ')}]`;
const selState = async () => (await req('layer.selectionState')) as SelState;

/**
 * Select a chain by index and fire. ⚠ `layer.selectionState` is the ONLY call
 * between the selection and the action, and `device.selectInEditor` is never used.
 */
async function selectAndFire(label: string, idx: number, action: string): Promise<{ before: Level; after: Level }> {
  const before = await levels();
  await req('layer.select', { layerIndex: idx, where: 'editor' });
  await new Promise((r) => setTimeout(r, 800));
  const at = await selState();
  const flagOk = at.layers.find((r) => r.index === idx)?.selectedInEditor === true;
  console.log(`\n  ${label}`);
  note(`   chain ${idx} (${before.contents[idx] ?? '?'});  flag: ${flagOk ? '● SET' : '○ NOT SET'}`);
  note(`   BEFORE ${fmt(before)}`);
  await req('app.invokeAction', { id: action });
  await new Promise((r) => setTimeout(r, 1900));
  // ⚠ Check the TRACK level first: if the action forked a track, that is where it
  // landed, and reading only devices/chains would report "○ nothing at all".
  await assertNoOrphan(label);
  const after = await levels();
  note(`   AFTER  ${fmt(after)}`);
  const dD = after.devices - before.devices, dC = after.chains - before.chains;
  // ⚠ The distinction e17ac could not make.
  const verdict = dC > 0 ? `●● CHAIN +${dC}` : dC < 0 ? `●● CHAIN ${dC}`
    : dD > 0 ? `⚠ CONTAINER +${dD} — the action fired and hit the wrong level`
      : '○ nothing at all';
  console.log(`   Δdevices=${dD} Δchains=${dC}   ${verdict}`);
  return { before, after };
}

async function undoUntil(pred: (l: Level) => boolean, tag: string): Promise<void> {
  for (let g = 0; g < 14; g++) {
    if (pred(await levels())) break;
    await req('app.undo');
    await new Promise((r) => setTimeout(r, 1600));
  }
  note(`   ${tag}: ${fmt(await levels())}`);
}

// ==========================================================================
console.log('\n-- PRECONDITIONS');
const boot = await selState();
check('the selection reader is attached', String(boot.editorObserver).startsWith('observing:'),
  { status: boot.editorObserver });
const start = await levels();
note(`${SUBJECT}: ${fmt(start)}`);
check('PRECONDITION: exactly ONE container and 4 distinct chains',
  start.devices === 1 && start.itemCount === 1 && start.chains === 4
  && new Set(start.contents).size === 4, { state: fmt(start) });
if (start.chains !== 4 || start.devices !== 1) { console.log('REFUSING: fixture is not clean.'); process.exit(1); }

// ==========================================================================
// ⚠⚠ PRIMING. `e17ab`'s cold run settled it: with no human gesture since the
// project was opened, a chain action does NOTHING (4→4), and after ONE click it
// works and keeps working. This probe failed three times for exactly this reason —
// twice blamed on a closed panel, once on an orphan track, and neither was it.
console.log(`\n${'─'.repeat(72)}`);
console.log('  ⚠⚠ PRIMING — required, and this is why this probe failed three times.');
console.log('  Click the SAMPLER chain\'s lane header in gn-lay4\'s Instrument Layer,');
console.log('  then keep your hands off Bitwig for the rest of the run.');
console.log('  ⚠ One click is enough and it holds for many cycles — but it does NOT');
console.log('    survive a project reload, and it is destroyed by moving the track');
console.log('    cursor to another track. This probe never moves it.');
await waitForEnter('  Click the Sampler chain, then press Enter and hands off');
const primed = await selState();
const litIdx = primed.layers.findIndex((r) => r.selectedInEditor);
note(`your click registered on chain ${litIdx >= 0 ? litIdx : '(none)'}`);
check('PRECONDITION: your click registered on some chain — the probe is primed',
  litIdx >= 0, { flaggedIndex: litIdx });

// ==========================================================================
console.log('\n======== CONTROL — growth at FOUR chains (reproduce e17ab in THIS sitting)');
const ctl = await selectAndFire('CONTROL: select Organ, Duplicate', 2, 'Duplicate');
const ctlGrew = ctl.after.chains > ctl.before.chains;
check('⚠ CONTROL: the clean recipe grows a 4-chain container — so a later ○ means something',
  ctlGrew, { before: ctl.before.chains, after: ctl.after.chains });
if (!ctlGrew) {
  console.log('\n⚠⚠ REFUSING: the control did not grow, so nothing below is interpretable.');
  if (ctl.after.devices > ctl.before.devices) {
    console.log('  ⚠ It duplicated the CONTAINER instead — something set the panel\'s current');
    console.log('  device. Check that no earlier probe left `device.selectInEditor` state.');
  } else {
    // ⚠ The operator reported the device panel CLOSED after `e17ac`, which fired
    // `focus_or_toggle_device_panel` repeatedly in its Group retry loop. It is a
    // TOGGLE, so an odd number of fires leaves the panel shut — and with no device
    // panel there is nothing for a panel-scoped action to dispatch against.
    console.log('  ⚠⚠ Δ0 at EVERY level means the action did not fire at all. The most likely');
    console.log('  cause is that THE DEVICE PANEL IS CLOSED. `focus_or_toggle_device_panel` is a');
    console.log('  TOGGLE, and `e17ac` fired it repeatedly — an odd number of fires shuts the');
    console.log('  panel, and chain actions then silently do nothing.');
    console.log('');
    console.log('  ⇒ OPEN THE DEVICE PANEL IN BITWIG (double-click the track, or the Devices');
    console.log('    tab at the bottom) so gn-lay4\'s Instrument Layer and its chains are');
    console.log('    VISIBLE, then re-run. This probe fires no focus actions itself, so once');
    console.log('    the panel is open it stays open.');
  }
  await undoUntil((l) => l.chains <= start.chains && l.devices <= start.devices, 'restore');
  process.exit(1);
}
await undoUntil((l) => l.chains <= start.chains && l.devices <= start.devices, 'undone');

// ==========================================================================
console.log('\n======== SHRINK — delete down to exactly ONE chain');
for (let target = 3; target >= 1; target--) {
  const cur = await levels();
  if (cur.chains <= 1) break;
  // ⚠ Always delete the LAST chain, re-read each time: indices shift under us.
  const idx = cur.chains - 1;
  const r = await selectAndFire(`SHRINK: delete chain ${idx} (${cur.contents[idx]})`, idx, 'Delete');
  if (r.after.chains >= r.before.chains) {
    console.log('\n⚠ REFUSING: a delete did not remove a chain, so the shrink is unreliable.');
    await undoUntil((l) => l.chains >= start.chains, 'restore');
    process.exit(1);
  }
}
const shrunk = await levels();
note(`after shrinking: ${fmt(shrunk)}`);
check('⚠ the container now holds exactly ONE chain, one container, no track churn',
  shrunk.chains === 1 && shrunk.devices === 1 && shrunk.tracks === start.tracks, { state: fmt(shrunk) });

// ==========================================================================
console.log('\n======== ⚠⚠ THE QUESTION — can a ONE-chain container grow?');
const q = await selectAndFire('⚠ select the only chain, Duplicate', 0, 'Duplicate');
const grewFromOne = q.after.chains > q.before.chains;
check('⚠⚠ ROW 1: a ONE-chain container CAN grow to two',
  grewFromOne, { before: q.before.chains, after: q.after.chains, devices: `${q.before.devices}->${q.after.devices}` });

// ==========================================================================
console.log('\n-- restoring gn-lay4 to its 4-chain baseline');
await undoUntil((l) => l.chains >= start.chains && l.devices === start.devices, 'restored');
const end = await levels();
check('the fixture is back to baseline at ALL levels',
  end.devices === start.devices && end.itemCount === start.itemCount
  && end.chains === start.chains && end.contents.join() === start.contents.join(),
  { start: fmt(start), end: fmt(end) });
if (end.contents.join() !== start.contents.join()) {
  note('⚠ THE FIXTURE DID NOT RESTORE. Do not run anything else against gn-lay4 until');
  note('  it is repaired — reopen the saved project rather than patching it.');
}

// ==========================================================================
console.log('\n======== VERDICT');
console.log(`  CONTROL  grow at 4 chains        ${ctlGrew ? '●' : '○'}`);
console.log(`  SHRINK   down to 1 chain         ${shrunk.chains === 1 ? '●' : '○'}`);
console.log(`  ⚠ ROW 1  grow at 1 chain         ${grewFromOne ? '●● YES' : '○ no'}`);
console.log('');
if (ctlGrew && grewFromOne) {
  note('⚠⚠⚠ ROW 1 IS OVERTURNED. Chain count does NOT gate growth — a one-chain');
  note('  container grows like any other, and `e17ac`\'s ○ was our own');
  note('  `device.selectInEditor` poisoning the test.');
  note('  ⇒ A multi-chain container can be built at RUNTIME from nothing but `Group`');
  note('  plus `Duplicate`. §5\'s dependency chain DISSOLVES: rule 11 / E4h /');
  note('  `insertFile` / `bwmod`\'s offline chain trim are no longer prerequisites of');
  note('  the A/B story. ⚠ That removes the single biggest practical objection to the');
  note('  layer model, and E17 must be re-argued with it gone.');
} else if (ctlGrew && !grewFromOne) {
  note('⇒ ⚠ Row 1 STANDS, and now on a real control: the identical recipe grows a');
  note('  4-chain container in the same sitting and refuses at one. Chain count gates');
  note(`  it. ⚠ Note the level it DID hit: devices ${q.before.devices}->${q.after.devices}.`);
  note('  ⇒ §5\'s preset-library dependency survives: the FIRST extra chain must come');
  note('  from a human-authored `.bwpreset`, after which growth is programmatic.');
}
console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} checks reported a negative — read individually`);
process.exit(0);
