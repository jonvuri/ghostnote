/**
 * E17 rows 3+4 — is a HUMAN needed at all, or did we break it ourselves with
 * `cursor.pointTrack`?
 *
 * ⚠⚠ **`e17aa` flipped the rows.** The human clicked Organ, we then called
 * `selectInEditor(Phase-4)`, we fired `Duplicate` — and **Phase-4** duplicated.
 * Our selection is honoured. Rows 3/4 are reachable, and every ○ from `e17k`
 * through `e17z` was a missing precondition, not a missing capability.
 *
 * ⚠ **But WHY `e17aa` worked and `e17z` did not has two live explanations**, and
 * they differ on the only thing that matters for a product:
 *
 *   (a) the human's CLICK is required — input focus on a chain lane, which no API
 *       call we have can set. Rows 3/4 are ◐ forever: human-assisted.
 *   (b) ⚠ **our own `cursor.pointTrack` destroys it.** `e17aa` called only
 *       `layer.selectionState` between the click and the fire — a read that moves
 *       no cursor. `e17z` called `levels()` and `scope()` first, and both call
 *       `cursor.pointTrack` = `CursorTrack.selectChannel()`, which **E16j proved
 *       sets the UI track selection**. Under (b) NO human is needed and rows 3/4
 *       are ● outright.
 *
 * **Four arms, and they validate each other rather than needing a gate:**
 *   COLD       no click at all. Scope, select, fire. ⚠ If this works, (b) is right
 *              and no human is ever needed.
 *   PRIMED ×3  you click ONCE, then we run three select+fire cycles on DIFFERENT
 *              chains with no further clicks. Does one gesture prime indefinitely,
 *              or is it consumed by the first action?
 *   DESTROYER  after a working cycle, inject `cursor.pointTrack` away and back,
 *              then select and fire. ⚠ If this breaks it, (b) is confirmed
 *              directly and we know exactly which of our own calls to avoid.
 *   ROW 4      gated on a create working: `Delete` with the same recipe.
 *
 * ⚠ **No container-reference gate, deliberately.** The gate fires `Duplicate`
 * through the focus toggle, which would destroy the very priming under test. The
 * arms validate each other instead: if PRIMED succeeds, dispatch was live, which
 * makes COLD's failure meaningful. A ● anywhere is self-validating.
 *
 * ⚠ Reads between a selection and a fire are `layer.selectionState` ONLY — it
 * touches no cursor. `layer.list` is called only AFTER an action.
 *
 * ⚠ Needs Bitwig FOREGROUND and, for two arms, your hands.
 * ⚠ Run IN YOUR OWN TERMINAL — needs a TTY.
 */
import { client, check, note, failureCount, pollUntil, waitForEnter } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);
const SUBJECT = 'gn-lay4';

interface TrackRow { index: number; name: string; type: string; channelId: string }
interface LayerList { layers: { index: number; name: string; devices: { name: string }[] }[]; count: number }
interface SelRow { index: number; selectedInEditor: boolean; selected: boolean }
interface SelState { editorObserver: string; layers: SelRow[]; cursorLayerName?: string;
  cursorLayerExists?: boolean | string }

await client.connect();
const tracks = ((await req('track.list')) as { tracks: TrackRow[] }).tracks;
// ⚠⚠ A NAME IS NOT AN IDENTITY. Two tracks called `gn-lay4` is how `e17ae` failed
// twice: a named `Duplicate` forked the whole track (E6 blocker 3 / E16j) and
// `find(name === …)` then returned the FIRST match while the UI selection sat on
// the other, so a chain was selected on one track and the action fired at another.
const matches = tracks.filter((t) => t.name === SUBJECT);
if (matches.length !== 1) {
  console.log(`\n⚠⚠ REFUSING: ${matches.length} tracks are named ${SUBJECT}.`);
  for (const m of matches) console.log(`     [${m.index}] ${m.name} ${m.channelId.slice(0, 8)}`);
  console.log('  Reap the orphan first:  npm run probe:e17-reap');
  process.exit(1);
}
const subject = matches[0]!;
const other = tracks.find((t) => t.name !== SUBJECT && t.type !== 'master');
if (!other) { console.log('REFUSING: fixtures missing.'); process.exit(1); }
note(`subject: ${SUBJECT} [${subject.index}] channelId ${subject.channelId.slice(0, 8)}`);

// ⚠ An orphan TRACK appearing means the action landed on the TRACK selection —
// which reads as "○ nothing" to anything measuring only devices and chains.
const baseTrackIds = new Set(tracks.map((t) => t.channelId));
async function assertNoOrphan(tag: string): Promise<boolean> {
  const now = ((await req('track.list')) as { tracks: TrackRow[] }).tracks;
  const orphan = now.find((t) => !baseTrackIds.has(t.channelId));
  if (!orphan) return false;
  note(`⚠⚠ ${tag}: a named action FORKED A TRACK — [${orphan.index}] ${orphan.name}`
    + ` ${orphan.channelId.slice(0, 8)}. THAT is where the action landed.`);
  await req('track.delete', { trackIndex: orphan.index });
  await pollUntil(async () =>
    !((await req('track.list')) as { tracks: TrackRow[] }).tracks.some((t) => t.channelId === orphan.channelId),
  6000, 200);
  note('   reaped');
  return true;
}

/** ⚠ Moves the TRACK cursor. This is the suspect — never call it mid-arm. */
async function pointTrack(trackIndex: number): Promise<void> {
  await req('cursor.pointTrack', { cursor: '0', trackIndex });
  await pollUntil(async () => {
    const s = (await req('cursor.status', { cursor: '0' })) as { trackPosition: number };
    return s.trackPosition === trackIndex;
  }, 4000, 150);
  await new Promise((r) => setTimeout(r, 300));
}

async function scopeFull(): Promise<void> {
  await pointTrack(subject!.index);
  await req('devcursor.selectAt', { deviceIndex: 0 });
  const ok = await pollUntil(async () => {
    const s = (await req('devcursor.status')) as { exists: boolean; name: string };
    return s.exists && s.name === 'Instrument Layer';
  }, 6000, 150);
  if (!ok.ok) { console.log('REFUSING: cursor not on the container (the e16o trap).'); process.exit(1); }
}

/** ⚠ Cursor-free. The only read allowed between a selection and a fire. */
const selState = async () => (await req('layer.selectionState')) as SelState;
/** ⚠ Cursor-free too: assumes cursorDevice0 is already on the container. */
async function lightList(): Promise<{ count: number; contents: string[] }> {
  const s = (await req('devcursor.status')) as { exists: boolean; name: string };
  if (!s.exists || s.name !== 'Instrument Layer') {
    note(`⚠ device cursor drifted to ${JSON.stringify(s.name)} — re-scoping (this moves the track cursor)`);
    await scopeFull();
  }
  const l = (await req('layer.list')) as LayerList;
  return { count: l.count, contents: l.layers.map((x) => x.devices[0]?.name ?? '—') };
}
const flagged = (s: SelState, names: string[]) => {
  const hit = s.layers.find((r) => r.selectedInEditor);
  return hit ? (names[hit.index] ?? `chain${hit.index}`) : '(none)';
};

await scopeFull();
const base = await lightList();
const NAMES0 = base.contents;
console.log('');
console.log('='.repeat(72));
console.log(` ${SUBJECT}:  ${NAMES0.map((n, i) => `${i}=${n}`).join('   ')}`);
console.log(' ⚠ Chains ACCUMULATE across the primed arms and are undone at the end —');
console.log('   an undo between cycles is itself a named action and would confound them.');
console.log('='.repeat(72));
check('PRECONDITION: 4 chains with distinct contents',
  base.count === 4 && new Set(NAMES0).size === 4, { contents: NAMES0 });
const boot = await selState();
check('PRECONDITION: the selection reader is attached',
  String(boot.editorObserver).startsWith('observing:'), { status: boot.editorObserver });
if (base.count !== 4 || !String(boot.editorObserver).startsWith('observing:')) {
  console.log('REFUSING.'); process.exit(1);
}

interface Cycle { label: string; aimed: string; flagOk: boolean; before: number; after: number; grew: string }
const cycles: Cycle[] = [];

/**
 * Select a chain by NAME and fire. ⚠ Nothing between the selection and the action
 * except the cursor-free readback.
 */
async function selectAndFire(label: string, wantName: string, action = 'Duplicate'): Promise<Cycle> {
  const before = await lightList();
  const idx = before.contents.indexOf(wantName);
  if (idx < 0) {
    note(`⚠ ${label}: ${wantName} not present — skipping`);
    return { label, aimed: wantName, flagOk: false, before: before.count, after: before.count, grew: '(skipped)' };
  }
  await req('layer.select', { layerIndex: idx, where: 'editor' });
  await new Promise((r) => setTimeout(r, 800));
  const at = await selState();
  const flagOk = flagged(at, before.contents) === wantName;
  console.log(`\n  ${label}`);
  note(`   aimed ${wantName} (chain ${idx});  flag at firing: ${flagged(at, before.contents)} ${flagOk ? '●' : '⚠'}`);
  await req('app.invokeAction', { id: action });
  await new Promise((r) => setTimeout(r, 2000));
  const forked = await assertNoOrphan(label);
  const after = await lightList();
  if (forked) note('   ⚠ read the result below as "the action hit the TRACK", not as a chain outcome');
  // ⚠ Name the survivor, never count it (e16t).
  let grew = '(none)';
  for (const n of new Set([...before.contents, ...after.contents])) {
    const d = after.contents.filter((c) => c === n).length - before.contents.filter((c) => c === n).length;
    if (d > 0) grew = n;
    if (d < 0 && action === 'Delete') grew = `-${n}`;
  }
  const verdict = after.count > before.count ? `●● CHAIN (+${grew})`
    : after.count < before.count ? `●● REMOVED (${grew})` : '○ nothing';
  console.log(`   ${before.count} -> ${after.count} chains  [${after.contents.join(' ')}]   ${verdict}`);
  const c = { label, aimed: wantName, flagOk, before: before.count, after: after.count, grew };
  cycles.push(c);
  return c;
}

// ==========================================================================
// ⚠ COLD FIRST — before any human gesture in this run. If this works, (b) is
// right, no human is needed, and everything below is a bonus.
console.log(`\n${'─'.repeat(72)}`);
console.log('  ⚠⚠ ARM COLD — no click, no priming. Just scope, select, fire.');
console.log('');
console.log('  ⚠⚠ "COLD" MEANS NO CLICK SINCE THE PROJECT WAS OPENED, not merely no click');
console.log('  in this probe. The first run of this probe was scored as cold and was NOT —');
console.log('  the operator had been clicking chains throughout e17y/e17aa in the same');
console.log('  session, so "no human is needed" was never actually established.');
console.log('');
console.log('  ⚠ If you have clicked a chain since opening this project, say so rather than');
console.log('  pressing Enter — a warm session makes this arm meaningless.');
console.log('  ⚠ DO NOT CLICK ANYTHING IN BITWIG. Keep it foreground but hands off.');
await waitForEnter('  Bitwig foreground, hands OFF the mouse — press Enter');
await scopeFull();
const cold = await selectAndFire('COLD: select Organ, fire Duplicate (no human gesture)', 'Organ');
check('⚠⚠ ARM COLD: a chain duplicates with NO human gesture at all',
  cold.after > cold.before, { before: cold.before, after: cold.after, grew: cold.grew });

// ==========================================================================
console.log(`\n${'─'.repeat(72)}`);
console.log('  ARM PRIMED — you click ONCE, then we run three cycles unaided.');
console.log('  ⚠ Click the Sampler chain\'s LANE HEADER, then hands off completely.');
await waitForEnter('  Click the Sampler chain, then press Enter and do not touch Bitwig again');
const p0 = await selState();
note(`   your click registered as: ${flagged(p0, (await lightList()).contents)}`);
const p1 = await selectAndFire('PRIMED cycle 1: select Phase-4, fire', 'Phase-4');
const p2 = await selectAndFire('PRIMED cycle 2: select Polysynth, fire', 'Polysynth');
const p3 = await selectAndFire('PRIMED cycle 3: select Organ, fire', 'Organ');
const primedWorked = [p1, p2, p3].filter((c) => c.after > c.before).length;
check('⚠ ARM PRIMED: one human click primes REPEATED programmatic cycles',
  primedWorked === 3, { worked: primedWorked, of: 3 });

// ==========================================================================
console.log(`\n${'─'.repeat(72)}`);
console.log('  ⚠ ARM DESTROYER — inject `cursor.pointTrack` away and back, then retry.');
console.log('  This is the exact call e17z made and e17aa did not. Hands still off.');
await pointTrack(other.index);
await pointTrack(subject.index);
await req('devcursor.selectAt', { deviceIndex: 0 });
await pollUntil(async () => {
  const s = (await req('devcursor.status')) as { exists: boolean; name: string };
  return s.exists && s.name === 'Instrument Layer';
}, 6000, 150);
const dest = await selectAndFire('DESTROYER: after pointTrack, select Sampler, fire', 'Sampler');
const destroyed = !(dest.after > dest.before);
check('⚠⚠ `cursor.pointTrack` DESTROYS the ability to act on a chain — the self-inflicted wound',
  destroyed && primedWorked > 0, { primedWorked, destroyerGrew: dest.grew });

// ==========================================================================
console.log(`\n${'─'.repeat(72)}`);
console.log('  ROW 4 — ⚠ GATED on a create working');
let deleted = false;
if (cold.after <= cold.before && primedWorked === 0) {
  note('SKIPPED: nothing reached the chain, so a stray `Delete` destroys something real.');
} else {
  if (destroyed) {
    note('re-priming: the destroyer arm confirmed pointTrack breaks it, so re-establish');
    await waitForEnter('  Click the Sampler chain once more, then press Enter and hands off');
  }
  const now = await lightList();
  const victim = now.contents.find((c, i) => now.contents.indexOf(c) !== i) ?? now.contents[0]!;
  const d = await selectAndFire(`ROW 4: select ${victim}, fire Delete`, victim, 'Delete');
  deleted = d.after < d.before;
  check('⚠⚠ ROW 4: `Delete` on a chain WE selected REMOVES it', deleted,
    { before: d.before, after: d.after });
  const t = ((await req('track.list')) as { count: number }).count;
  check('and no TRACK was destroyed', t === tracks.length, { before: tracks.length, after: t });
}

// ==========================================================================
console.log(`\n${'─'.repeat(72)}`);
console.log('  cleanup — undoing every chain this probe created');
for (let g = 0; g < 12; g++) {
  const s = await lightList();
  if (s.count <= base.count && s.contents.join() === base.contents.join()) break;
  await req('app.undo');
  await new Promise((r) => setTimeout(r, 1600));
}
await scopeFull();
const end = await lightList();
note(`${SUBJECT} final: ${end.count} chains — [${end.contents.join(' ')}]`);
check('the fixture is back to baseline',
  end.count === base.count && end.contents.join() === base.contents.join(),
  { base: base.contents, end: end.contents });

// ==========================================================================
console.log(`\n${'='.repeat(72)}`);
console.log(' VERDICT');
for (const c of cycles) {
  console.log(`  ${c.label.padEnd(52)} ${c.before}->${c.after}  ${c.grew}`);
}
console.log('='.repeat(72));
if (cold.after > cold.before) {
  note('⚠⚠⚠ NO HUMAN IS NEEDED. A chain duplicates from a cold start, so (b) is right:');
  note('  our own `cursor.pointTrack` was destroying it, and `e17aa`\'s click was a');
  note('  red herring that merely re-established what our read had cleared.');
  note('  ⇒ ROWS 3 AND 4 ARE ● OUTRIGHT. E17-VERDICT §1a is void in full, and the');
  note('  call must be re-argued: the layer model has a complete branch lifecycle.');
  note('  ⚠ §1b (chain channelId not durable, 8/8 changed on reload) is untouched and');
  note('  is now the ONLY surviving reason to prefer tracks.');
} else if (primedWorked > 0) {
  note(`⚠ A human click is REQUIRED, and it primes ${primedWorked} of 3 subsequent cycles.`);
  note('  ⇒ Rows 3/4 are ◐ HUMAN-ASSISTED — reachable, but not autonomously, which for a');
  note('  take system means a chain branch cannot be minted without the user clicking.');
  if (destroyed) {
    note('  ⚠ And `cursor.pointTrack` demonstrably breaks the primed state, so any future');
    note('  code path that touches a chain must not move the track cursor first.');
  }
} else {
  note('⚠ Neither cold nor primed worked in this sitting, which contradicts e17aa.');
  note('  Do not record anything; something about the run differs and needs isolating.');
}
console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} checks reported a negative — read individually`);
process.exit(0);
