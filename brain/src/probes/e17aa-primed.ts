/**
 * E17 — the click carries something the FLAG does not. What wins when they disagree?
 *
 * ⚠ **The contradiction, stated exactly.**
 *   `e17l`  human selects a chain → OUR `invokeAction` works. 4→5, and Delete 4→3
 *           by channelId. Sound: it even asks the human to confirm our own read
 *           did not steal the selection first.
 *   `e17y`  a human's click and our `selectInEditor()` set the **IDENTICAL**
 *           observer flag. Same reader, same object. And a chain OUR call selected
 *           was deleted by hand, successfully.
 *   `e17z`  our selection + our `invokeAction` → nothing reaches the chain, under
 *           **three** focus regimes (none / full toggle / panel-only), flag
 *           verified SET at firing in all three, all four gates alive.
 *
 * ⇒ Same flag, same action, opposite outcome — decided by **who set it**. So the
 * click carries something beyond the selection model. The leading candidate is
 * input/keyboard FOCUS on the chain lane widget, which is what `invokeAction`
 * dispatches against and which no API call we have touches.
 *
 * ⚠ **Two hypotheses of mine already died here** (the foreground gate, then the
 * focus toggle), so this probe does not test the focus story directly — it asks the
 * question whose every answer is informative:
 *
 *   **The human clicks chain X. We then select chain Y. We fire. Which duplicates?**
 *
 *     X duplicates  ⇒ the click's extra is STICKY and our selection cannot move it.
 *                     We need whatever the click sets, not a better selection call.
 *     Y duplicates  ⇒ ⚠⚠ our selection IS honoured — once a click has primed the
 *                     panel. Then the missing piece is only FOCUS ACQUISITION, a far
 *                     narrower problem, and rows 3/4 become reachable with a
 *                     one-time priming gesture.
 *     nothing       ⇒ our call actively DESTROYS the priming, which is its own
 *                     finding and explains e17z's arms A and C reading Δ0.
 *
 * ⚠ **Instrument discipline learned from `e17l`.** Our normal reads move cursors
 * (`layer.list` → `devcursor.selectAt`, `levels()` → `cursor.pointTrack`), and
 * `e17l` had to ask the human whether its own read stole the selection. So the
 * fixture shape is captured ONCE up front, the device cursor is scoped ONCE, and
 * between arms only `layer.selectionState` is used — it reads rig arrays and
 * touches no cursor. The full `layer.list` runs only AFTER firing.
 *
 * ⚠ Needs Bitwig FOREGROUND and your hands. Nothing is created except via the
 * actions under test, and each is undone immediately.
 * ⚠ Run IN YOUR OWN TERMINAL — needs a TTY.
 */
import { client, check, note, failureCount, pollUntil, ask, waitForEnter } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);
const SUBJECT = 'gn-lay4';

interface TrackRow { index: number; name: string; type: string; channelId: string }
interface LayerList { layers: { index: number; name: string; devices: { name: string }[] }[]; count: number }
interface SelRow { index: number; selectedInEditor: boolean; selected: boolean }
interface SelState { editorObserver: string; layers: SelRow[]; cursorLayerName?: string;
  cursorLayerExists?: boolean | string }

await client.connect();
const tracks = ((await req('track.list')) as { tracks: TrackRow[] }).tracks;
const subject = tracks.find((t) => t.name === SUBJECT);
if (!subject) { console.log(`REFUSING: ${SUBJECT} not found.`); process.exit(1); }

/** Scope ONCE. After this, nothing below moves a cursor until after an action fires. */
async function scopeOnce(): Promise<void> {
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
  if (!ok.ok) { console.log('REFUSING: cursor not on the container (the e16o trap).'); process.exit(1); }
}

/** ⚠ The only read used between arms: no cursor moves, no bank walk. */
const selState = async () => (await req('layer.selectionState')) as SelState;
const flagged = (s: SelState, names: string[]) => {
  const hit = s.layers.find((r) => r.selectedInEditor);
  return hit ? (names[hit.index] ?? `chain${hit.index}`) : '(none)';
};
/** ⚠ Only AFTER firing. Moves the device cursor, so never before. */
const shape = async () => {
  await scopeOnce();
  const l = (await req('layer.list')) as LayerList;
  return { count: l.count, contents: l.layers.map((x) => x.devices[0]?.name ?? '—') };
};

await scopeOnce();
const base = await shape();
const NAMES = base.contents;
console.log('');
console.log('='.repeat(72));
console.log(` ${SUBJECT}:  ${NAMES.map((n, i) => `${i}=${n}`).join('   ')}`);
console.log(' Each arm undoes itself. Keep Bitwig FOREGROUND throughout.');
console.log('='.repeat(72));
check('PRECONDITION: 4 chains with distinct contents', base.count === 4 && new Set(NAMES).size === 4,
  { contents: NAMES });
const boot = await selState();
check('PRECONDITION: the selection reader is attached',
  String(boot.editorObserver).startsWith('observing:'), { status: boot.editorObserver });
if (base.count !== 4 || !String(boot.editorObserver).startsWith('observing:')) {
  console.log('REFUSING.'); process.exit(1);
}

const CLICK = NAMES[2]!;               // what the human clicks
const OURS = NAMES[0]!;                // what we then select — deliberately different
const clickIdx = 2;
const oursIdx = 0;

async function fireAndName(what: string): Promise<{ count: number; contents: string[]; grew: string }> {
  await req('app.invokeAction', { id: 'Duplicate' });
  await new Promise((r) => setTimeout(r, 2000));
  const after = await shape();
  // ⚠ Name the survivor, never count it (e16t): 5 chains is also what duplicating
  // the WRONG chain produces.
  let grew = '(none)';
  for (const n of new Set(after.contents)) {
    const d = after.contents.filter((c) => c === n).length - base.contents.filter((c) => c === n).length;
    if (d > 0) grew = n;
  }
  note(`   ${what}: ${base.count} -> ${after.count} chains  [${after.contents.join(' ')}]`);
  note(`   ⇒ the chain that gained a copy: ${grew}`);
  return { ...after, grew };
}

async function undoTo(n: number, tag: string): Promise<void> {
  for (let g = 0; g < 6; g++) {
    const s = await shape();
    if (s.count <= n) break;
    await req('app.undo');
    await new Promise((r) => setTimeout(r, 1600));
  }
  note(`   ${tag}: restored to ${(await shape()).count} chains`);
}

// ==========================================================================
// ⚠ ARM 1 — reproduce e17l's ● with the observer attached. If this does NOT
// reproduce, the whole contradiction dissolves and e17l was the anomaly.
console.log(`\n${'─'.repeat(72)}`);
console.log('  ARM 1 — BASELINE: your click alone. Reproducing e17l with the reader on.');
console.log(`  ⚠ Click the ${CLICK} chain's LANE HEADER. Click nothing else afterwards.`);
await waitForEnter(`  Click the ${CLICK} chain, then press Enter`);
const s1 = await selState();
note(`   observer says selected: ${flagged(s1, NAMES)}   (you clicked ${CLICK})`);
check(`ARM 1 PRECONDITION: the observer sees YOUR click on ${CLICK}`,
  flagged(s1, NAMES) === CLICK, { flagged: flagged(s1, NAMES), expected: CLICK });
console.log('   firing Duplicate...');
const r1 = await fireAndName('ARM 1');
const arm1Worked = r1.count > base.count;
check('⚠ ARM 1: our `invokeAction` acts on YOUR click — e17l reproduced',
  arm1Worked, { before: base.count, after: r1.count, grew: r1.grew });
if (arm1Worked) await undoTo(base.count, 'ARM 1');

// ==========================================================================
console.log(`\n${'─'.repeat(72)}`);
console.log('  ⚠⚠ ARM 2 — THE DISCRIMINATOR');
console.log(`  Click the ${CLICK} chain again. Then I will select ${OURS} instead,`);
console.log('  and fire. Whichever one gets duplicated is the answer.');
if (!arm1Worked) {
  note('⚠ ARM 1 did not reproduce, so arm 2 cannot be interpreted. Running it anyway');
  note('  would produce a number with no baseline. SKIPPING.');
} else {
  await waitForEnter(`  Click the ${CLICK} chain, then press Enter`);
  const before2 = await selState();
  note(`   after your click, observer says: ${flagged(before2, NAMES)}`);
  check(`ARM 2 PRECONDITION: your click registered on ${CLICK}`,
    flagged(before2, NAMES) === CLICK, { flagged: flagged(before2, NAMES) });

  console.log(`   now calling layer.select(${oursIdx}, editor) → ${OURS} ...`);
  await req('layer.select', { layerIndex: oursIdx, where: 'editor' });
  await new Promise((r) => setTimeout(r, 900));
  const after2 = await selState();
  note(`   observer NOW says: ${flagged(after2, NAMES)}   (we aimed at ${OURS})`);
  check(`ARM 2 PRECONDITION: our call moved the flag from ${CLICK} to ${OURS}`,
    flagged(after2, NAMES) === OURS, { flagged: flagged(after2, NAMES), expected: OURS });

  const eyes = await ask(`  Before I fire — what looks selected in Bitwig right now,`
    + ` ${CLICK} or ${OURS}?\n     (or something else / nothing)`);

  console.log('   firing Duplicate...');
  const r2 = await fireAndName('ARM 2');
  console.log('');
  console.log('='.repeat(72));
  console.log(`  you clicked:        ${CLICK}`);
  console.log(`  we then selected:   ${OURS}   (observer confirmed: ${flagged(after2, NAMES)})`);
  console.log(`  your eyes said:     ${JSON.stringify(eyes)}`);
  console.log(`  ⚠ DUPLICATED:       ${r2.grew}`);
  console.log('='.repeat(72));

  if (r2.grew === OURS) {
    note('⇒ ⚠⚠ OUR SELECTION WON. It IS honoured — but only once your click has primed');
    note('  the panel. So the missing piece is not the selection at all, it is FOCUS');
    note('  ACQUISITION, which is a much narrower problem than "chains are unreachable".');
    note('  ⇒ Rows 3/4 become reachable with a priming gesture, and E17-VERDICT §1a');
    note('  must be re-argued around whether that gesture can be made without a human.');
  } else if (r2.grew === CLICK) {
    note('⇒ ⚠ YOUR CLICK WON, even though the observer flag had moved to our chain.');
    note('  So the actionable target is NOT the flag — it is something the click owns');
    note('  and our call cannot move. The selection model and the action target are');
    note('  genuinely different objects, and §1a survives on much sharper evidence:');
    note('  not "we cannot select a chain" but "the action target is not the selection".');
  } else if (r2.count === base.count) {
    note('⇒ ⚠ NOTHING happened — so our `selectInEditor()` call DESTROYED the priming');
    note('  your click established. That is its own finding, and it explains e17z arms');
    note('  A and C reading Δ0: our selection call does not just fail to help, it');
    note('  actively clears whatever makes a chain actionable.');
  } else {
    note(`⇒ ⚠ Neither chain: ${r2.grew}. Do not record a verdict; this needs its own sitting.`);
  }
  await undoTo(base.count, 'ARM 2');
}

// ==========================================================================
const end = await shape();
check('the fixture is back to baseline', end.count === base.count
  && end.contents.join() === base.contents.join(), { base: base.contents, end: end.contents });
console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} checks reported a negative — read individually`);
process.exit(0);
