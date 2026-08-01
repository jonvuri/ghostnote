/**
 * E16 §3.4f — ⚠ is a clip move DETECTABLE, and does a pinned cursor follow it?
 *
 * ⚠ **The handoff's question needs restating before it can be measured.** It
 * asks whether a clip `moveTo` bumps the scene epoch. It cannot: `sceneEpoch`
 * lives in the brain (`adapters/live/adapter.ts`) and is bumped by our OWN scene
 * ops, so asking it whether a human moved a clip is asking ourselves. The
 * adapter's own comment says as much — *"this counter only sees OUR OWN scene
 * ops"* — and defers the fix to an observer.
 *
 * The answerable question is: **when a clip moves, what observable changes?**
 * Three candidate answers, with very different consequences:
 *
 *   PUSHED   an observer fires. Moves are then detectable for free, without
 *            polling and without having suspected anything — and §3.2.3's
 *            extension-side observer should watch launcher CONTENT, not merely
 *            scene count, whose blind spot §3.2.3 already predicted.
 *   FOLLOWED ⚠ a pinned cursor tracks the clip through the move. Then a pinned
 *            cursor is an operational clip identity for the life of a session,
 *            which E16l's complete pass did not think to ask — it settled that
 *            no *durable, serializable* identifier exists, which is a different
 *            claim and does not settle this one.
 *   POLLED   `hasContent` differs at both ends and nothing else moves. That is
 *            §1's tolerant fallback restated, not a detector: you only see it if
 *            you re-read both slots, i.e. only if you already suspected. A ○ here
 *            means fingerprint-re-location-then-recreate carries the whole weight.
 *
 * ⚠ **The human drag is the real experiment; the API move is the control.** The
 * threat model E16l raised is a HUMAN swapping clips between scenes, and that
 * needs no wire method at all. `slot.moveTo` exists so the same question can be
 * asked silently and repeatably, and so a DISAGREEMENT between the two routes is
 * visible rather than assumed. If the drag fires observers and the API move does
 * not (or the reverse), that is the finding.
 *
 * ⚠ `ClipLauncherSlotOrScene.moveTo` is @Deprecated (API 4, "use
 * replaceInsertionPoint() instead"), so the default route is
 * `replaceInsertionPoint().moveSlotsOrScenes()` and the deprecated call is tried
 * only as the second mechanism (standing rules 9 and 10).
 *
 * Controls, because a ○ on the target is otherwise uninterpretable: a clip
 * CREATE and a clip DELETE are run against the same instrument first. If those
 * do not bump the epoch, the observer is not working and the row says nothing
 * about moves — the e16j/E16n discipline, and the thing E6 lacked.
 *
 * Silent: creates and moves launcher clips, launches nothing, refuses while the
 * transport rolls. The human half is skipped (loudly) without a TTY.
 */
import {
  client, check, note, failureCount, pollUntil, ask, waitForEnter,
  ensureFixtureTracks, stampFingerprint, getNotes, sameNotes, cursorStatus,
  type Note,
} from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);

interface Epoch { epoch: number; sceneCountChanges: number; sceneCount: number;
  selectionChanges: number; log: string[] }
const epoch = async () => (await req('slot.epoch')) as Epoch;

const slotHas = async (trackIndex: number, slotIndex: number): Promise<boolean> =>
  ((await req('slot.status', { trackIndex, slotIndex })) as { hasContent: boolean }).hasContent;

/** Everything pollable that could conceivably move, read in one go. */
interface Snapshot {
  epoch: number;
  sceneCountChanges: number;
  selectionChanges: number;
  canUndo: boolean;
  sceneCount: number;
}
const snapshot = async (): Promise<Snapshot> => {
  const e = await epoch();
  const u = (await req('app.undoState')) as { canUndo: boolean };
  const s = (await req('scene.count')) as { sceneCount: number };
  return {
    epoch: e.epoch,
    sceneCountChanges: e.sceneCountChanges,
    selectionChanges: e.selectionChanges,
    canUndo: u.canUndo,
    sceneCount: s.sceneCount,
  };
};

/** What moved between two snapshots, named rather than counted (E16r's lesson). */
const moved = (a: Snapshot, b: Snapshot): string[] => {
  const out: string[] = [];
  if (b.epoch !== a.epoch) out.push(`contentEpoch +${b.epoch - a.epoch}`);
  if (b.sceneCountChanges !== a.sceneCountChanges) out.push(`sceneCountChanges +${b.sceneCountChanges - a.sceneCountChanges}`);
  if (b.selectionChanges !== a.selectionChanges) out.push(`selectionChanges +${b.selectionChanges - a.selectionChanges}`);
  if (b.canUndo !== a.canUndo) out.push(`canUndo ${a.canUndo}->${b.canUndo}`);
  if (b.sceneCount !== a.sceneCount) out.push(`sceneCount ${a.sceneCount}->${b.sceneCount}`);
  return out;
};

/** The log entries added since a known epoch — the pair a move should produce. */
const newLog = (before: Epoch, after: Epoch): string[] => {
  const added = after.epoch - before.epoch;
  return added <= 0 ? [] : after.log.slice(Math.max(0, after.log.length - added));
};

await client.connect();
console.log('connected\n');

const rolling = (await req('transport.status')) as { isPlaying: boolean };
if (rolling.isPlaying) {
  console.log('REFUSING: the transport is rolling. This probe rewrites launcher clips and a');
  console.log('clip that is playing while it is moved is a different experiment. Stop and re-run.');
  process.exit(1);
}

// The instrument itself must be alive before anything is asked of it.
const boot = await epoch();
check('the launcher-content observer is installed and has reported', boot.epoch > 0,
  { epoch: boot.epoch, sceneCount: boot.sceneCount });
if (boot.epoch === 0) {
  console.log('\nREFUSING: `slot.epoch` reads 0, so the observer never delivered initial values.');
  console.log('Either the extension is the pre-restart jar, or the observer did not install.');
  console.log('Check `npm run probe:hello` for the methodsHash before reading anything below.');
  process.exit(1);
}

const { trackA, trackB } = await ensureFixtureTracks();
note(`fixture: gn-A at ${trackA}, gn-B at ${trackB}`);

/** Slots this probe owns. Kept well clear of the fixture's own 0/1. */
const SPARE_A = 5;
const SPARE_B = 6;
const HUMAN_SRC = 7;

// Start from a known-empty destination set.
for (const [t, s] of [[trackA, SPARE_A], [trackA, SPARE_B], [trackB, SPARE_A], [trackA, HUMAN_SRC]] as const) {
  if (await slotHas(t, s)) {
    await req('slot.delete', { trackIndex: t, slotIndex: s });
    await pollUntil(async () => !(await slotHas(t, s)));
  }
}

// ==========================================================================
// controls — does the instrument see anything at all?
// ==========================================================================
console.log('\n-- controls: does a create and a delete bump the epoch?');

const c0 = await epoch();
await req('clip.create', { trackIndex: trackA, slotIndex: SPARE_A, lengthBeats: 4 });
await pollUntil(() => slotHas(trackA, SPARE_A));
const c1 = await epoch();
const createBumped = c1.epoch > c0.epoch;
check('CONTROL: a clip create bumps the content epoch', createBumped,
  { delta: c1.epoch - c0.epoch, added: newLog(c0, c1) });

await req('slot.delete', { trackIndex: trackA, slotIndex: SPARE_A });
await pollUntil(async () => !(await slotHas(trackA, SPARE_A)));
const c2 = await epoch();
const deleteBumped = c2.epoch > c1.epoch;
check('CONTROL: a clip delete bumps the content epoch', deleteBumped,
  { delta: c2.epoch - c1.epoch, added: newLog(c1, c2) });

const instrumentLive = createBumped && deleteBumped;
if (!instrumentLive) {
  note('⚠ the controls did not both fire. Everything below is INCONCLUSIVE about moves:');
  note('  a silent target would mean the observer is dead, not that moves are invisible.');
}

// ==========================================================================
// target 1 — the API move, within one track
// ==========================================================================
console.log('\n-- target 1: an API move, (gn-A, 0) -> (gn-A, 5)');

const FP: Note[] = [[0, 60, 100, 1]];
const stamped = await stampFingerprint('0', trackA, 0, FP, 'trackThenSlot');
check('the source clip carries a known fingerprint', stamped, { fp: FP });

// ⚠ Pin cursor 0 to the source clip BEFORE the move. This is the FOLLOWED
// question and it is the row's most valuable half: if a pinned cursor tracks the
// clip through a move, we have an operational clip identity for the session.
await req('cursor.pin', { cursor: '0', pinned: true });
const pinnedBefore = await cursorStatus('0');
check('cursor 0 is pinned to the source clip before the move', pinnedBefore.exists
  && pinnedBefore.trackPosition === trackA && pinnedBefore.sceneIndex === 0,
  { trackPosition: pinnedBefore.trackPosition, sceneIndex: pinnedBefore.sceneIndex });

const s0 = await snapshot();
const e0 = await epoch();
await req('slot.moveTo', {
  trackIndex: trackA, slotIndex: 0, toTrackIndex: trackA, toSlotIndex: SPARE_A,
});
// ⚠ Assert the PRECONDITION separately from the question. E16o nearly published
// a false negative because a silent no-op is byte-identical to an API refusal:
// "nothing was observed" is only a finding about observation if something moved.
const relocated = await pollUntil(async () =>
  !(await slotHas(trackA, 0)) && (await slotHas(trackA, SPARE_A)), 6000, 100);
const srcAfter = await slotHas(trackA, 0);
const dstAfter = await slotHas(trackA, SPARE_A);
check('PRECONDITION: the clip actually relocated (source empty, destination full)',
  relocated.ok, { sourceHasContent: srcAfter, destHasContent: dstAfter, afterMs: relocated.ms });

const s1 = await snapshot();
const e1 = await epoch();
const apiMoveBumps = e1.epoch - e0.epoch;

if (!relocated.ok) {
  note('⚠ the API move did NOT relocate the clip. `slot.moveTo` via');
  note('  replaceInsertionPoint().moveSlotsOrScenes() is a silent no-op here, which is a');
  note('  finding in its own right — the same shape as copyDevices in E4d — but it means');
  note('  this row cannot speak about detectability from the API route. The human drag');
  note('  below is unaffected and is the experiment that matters.');
} else {
  check('an API clip move is PUSHED — the content observer fires', apiMoveBumps > 0,
    { bumps: apiMoveBumps, added: newLog(e0, e1) });
  note(`everything that moved: ${moved(s0, s1).join(', ') || '(nothing)'}`);
  if (apiMoveBumps >= 2) {
    note('⚠ two or more bumps: a move reads as a PAIR (one slot emptied, one filled),');
    note('  which is what makes it distinguishable from a bare create or delete.');
  } else if (apiMoveBumps === 1) {
    note('⚠ exactly ONE bump: the move is visible but is NOT distinguishable from a');
    note('  create or a delete by the counter alone — only the log says which.');
  }

  // -- the FOLLOWED question
  const pinnedAfter = await cursorStatus('0');
  const followed = pinnedAfter.exists && pinnedAfter.sceneIndex === SPARE_A;
  const stale = pinnedAfter.exists && pinnedAfter.sceneIndex === 0;
  check('⚠ a PINNED cursor follows the clip through the move', followed,
    { sceneIndexBefore: 0, sceneIndexAfter: pinnedAfter.sceneIndex, exists: pinnedAfter.exists });
  if (followed) {
    const notesAfter = await getNotes('0');
    check('and it still reads the moved clip\'s own notes', sameNotes(notesAfter, FP),
      { read: notesAfter, expected: FP });
    note('⚠ a pinned cursor is therefore an OPERATIONAL clip identity for the session.');
    note('  E16l settled that no DURABLE, serializable clip identifier exists; this is a');
    note('  different claim and it does not contradict that one. It cannot be stored, sent');
    note('  or compared across sessions, and it is bounded by the cursor pool (3 here).');
  } else if (stale) {
    note('⚠ the pinned cursor stayed at the OLD position, so it now points at whatever');
    note('  occupies that slot — the E3 hazard, one level down. Positional addressing plus');
    note('  the fingerprint carries the whole weight, exactly as §1 assumes.');
  }
}

// ==========================================================================
// target 2 — the deprecated route, only if route 1 was silent (rule 10)
// ==========================================================================
if (!relocated.ok) {
  console.log('\n-- target 2: the @Deprecated ClipLauncherSlotOrScene.moveTo');
  note('⚠ run ONLY because route 1 was a no-op: standing rule 10 refuses a ○ from one');
  note('  mechanism, and standing rule 9 is why this is not the default route.');
  const e2a = await epoch();
  await req('slot.moveTo', {
    trackIndex: trackA, slotIndex: 0, toTrackIndex: trackA, toSlotIndex: SPARE_A,
    route: 'deprecatedMoveTo',
  });
  const dep = await pollUntil(async () =>
    !(await slotHas(trackA, 0)) && (await slotHas(trackA, SPARE_A)), 6000, 100);
  const e2b = await epoch();
  check('the deprecated route relocates the clip where the modern one did not', dep.ok,
    { bumps: e2b.epoch - e2a.epoch, added: newLog(e2a, e2b) });
  if (!dep.ok) {
    note('⚠ both routes are silent. Clip relocation is not ours to perform — which does');
    note('  NOT answer detectability, because the human can still do it. The drag below is');
    note('  now the ONLY evidence this row will produce, and it is the one that mattered.');
  }
}

// ==========================================================================
// target 3 — cross-track, which is the shape E16l actually worried about
// ==========================================================================
console.log('\n-- target 3: an API move ACROSS tracks, (gn-A, 1) -> (gn-B, 5)');
if (!(await slotHas(trackA, 1))) {
  await req('clip.create', { trackIndex: trackA, slotIndex: 1, lengthBeats: 4 });
  await pollUntil(() => slotHas(trackA, 1));
}
const x0 = await epoch();
await req('slot.moveTo', {
  trackIndex: trackA, slotIndex: 1, toTrackIndex: trackB, toSlotIndex: SPARE_A,
});
const crossed = await pollUntil(async () =>
  !(await slotHas(trackA, 1)) && (await slotHas(trackB, SPARE_A)), 6000, 100);
const x1 = await epoch();
check('a clip can be moved to a DIFFERENT track', crossed.ok,
  { bumps: x1.epoch - x0.epoch, added: newLog(x0, x1) });
if (crossed.ok) {
  note('⚠ the log names both tracks, so a cross-track move is distinguishable from a');
  note('  within-track one without re-reading anything.');
}

// ==========================================================================
// target 4 — ⚠ THE EXPERIMENT: a human drag
// ==========================================================================
console.log('\n-- target 4: a HUMAN drag — the threat model, and the row that counts');

if (!process.stdin.isTTY) {
  note('SKIPPED: no TTY, so nobody can drag anything. ⚠ This is the half of the row that');
  note('  matters — the threat model is a human moving clips, not us — so a run without');
  note('  it is INCOMPLETE and must not be written up as a verdict on detectability.');
} else {
  if (!(await slotHas(trackA, HUMAN_SRC))) {
    await req('clip.create', { trackIndex: trackA, slotIndex: HUMAN_SRC, lengthBeats: 4 });
    await pollUntil(() => slotHas(trackA, HUMAN_SRC));
  }
  note(`a clip is waiting at gn-A (track index ${trackA}), scene row ${HUMAN_SRC}.`);
  note('nothing here makes any sound; the transport stays stopped.');

  const h0 = await snapshot();
  const he0 = await epoch();
  await waitForEnter(
    `In Bitwig's clip launcher, DRAG the clip in gn-A row ${HUMAN_SRC} to an EMPTY slot\n`
    + '     in a different scene row (same track or a different one — your choice).',
  );
  const he1 = await epoch();
  const h1 = await snapshot();
  const humanBumps = he1.epoch - he0.epoch;

  check('⚠ a HUMAN clip drag is detectable — the content observer fires', humanBumps > 0,
    { bumps: humanBumps, added: newLog(he0, he1) });
  note(`everything that moved: ${moved(h0, h1).join(', ') || '(nothing)'}`);

  const where = await ask('Where did you drop it? (track name + row number, or "cancelled")');
  note(`human reports: ${JSON.stringify(where)}`);
  note(`the observer reports: ${JSON.stringify(newLog(he0, he1))}`);

  // ⚠ Agreement between the two is the check, not the observer on its own. An
  // observer that fires on the wrong slot is worse than one that stays silent,
  // because it would be trusted.
  check('the observer\'s account is non-empty and can be compared with the human\'s',
    newLog(he0, he1).length > 0 && where.length > 0,
    { observed: newLog(he0, he1), reported: where });

  if (humanBumps === 0) {
    note('⚠ nothing fired for a human drag. Then moves are POLLED-only: the §1 fallback');
    note('  (fingerprint re-location, then recreate) carries the entire weight, and');
    note('  §3.2.3\'s extension-side observer cannot be extended to cover this case.');
  }

  // The scene-count observer's predicted blind spot, measured next to it.
  check('the scene-count observer did NOT fire for a clip move (§3.2.3\'s predicted blind spot)',
    h1.sceneCountChanges === h0.sceneCountChanges,
    { before: h0.sceneCountChanges, after: h1.sceneCountChanges });
}

// ==========================================================================
// verdict
// ==========================================================================
console.log('\n================ §3.4f verdict ================');
note(`controls: create ${createBumped ? '●' : '○'}, delete ${deleteBumped ? '●' : '○'}`);
note(`API move relocated: ${relocated.ok ? '●' : '○'}${relocated.ok ? `, bumps ${apiMoveBumps}` : ''}`);
note('⚠ the human-drag half above is the one this row is FOR. A run that skipped it has');
note('  measured our own writes only, which is not the threat model.');

console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} FAILURES`);
process.exit(failureCount() === 0 ? 0 : 1);
