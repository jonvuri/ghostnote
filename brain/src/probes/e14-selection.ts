/**
 * E14 row F, re-specified — the wart is the SELECTION, not notifications.
 *
 * ⚠ Row F as written in PHASE-0-FOUNDATION and PHASE-0-SESSION-2 asks: "Do
 * `NotificationSettings.setShouldShow*Notifications(false)` suppress the spray
 * our cursor pointing causes (E1's wart)?" That question cannot be answered,
 * because its premise is a misreading. E1's wart, verbatim from FINDINGS:
 *
 *     **Pointing borrows the UI selection.** `selectSlot` visibly moves the
 *     user's selection (2 changes during 3-cursor setup; user confirmed
 *     visually). Not a correctness problem, but a UX wart under optimistic
 *     application. Phase-1 candidates: restore prior selection after a batch,
 *     and/or investigate selection-free pointing further.
 *
 * There is no notification spray in E1. The wart is that the highlighted clip
 * JUMPS — a change to real selection state, which no notification setting can
 * suppress because it is not a notification. `NotificationSettings` governs
 * notifications the CONTROLLER requests, they are off by default, and ghostnote
 * never enables any; the live run confirmed nothing to suppress in any of the
 * three conditions. PROJECT_PLAN §7 carries the same conflation ("`Notification
 * Settings` may suppress the resulting notification spray").
 *
 * So this probe measures the thing E1 actually flagged, and the question §7
 * leaves open: **whether the selection movement itself can be restored after a
 * batch.** That is a Phase-1 decision with a concrete answer, and it needs no
 * human — `selection.status` reports the UI selection directly, because E1 wired
 * an `addIsSelectedObserver` across the whole slot bank for exactly this.
 *
 *   npm run probe:e14-selection
 *
 * ⚠ Moves the user's clip selection around gn-A / gn-B and puts it back. Writes
 * no notes and creates nothing.
 */
import { client, check, note, failureCount, pollUntil, ensureFixtureTracks } from './lib.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const SETTLE = 400;

type Selection = { trackIndex: number; slotIndex: number; changes: number };
const selection = async (): Promise<Selection> =>
  (await client.request('selection.status')) as Selection;

type Op = { method: string; params?: Record<string, unknown> };
const batch = (ops: Op[]) =>
  client.request('batch.run', {
    ops: ops.map((o) => ({ method: o.method, params: o.params ?? {} })),
    verbose: true,
  });

/** Stand in for "the user clicked this clip". */
async function userSelects(trackIndex: number, slotIndex: number): Promise<void> {
  await client.request('slot.select', { trackIndex, slotIndex, mechanism: 'slot' });
  const r = await pollUntil(async () => {
    const s = await selection();
    return s.trackIndex === trackIndex && s.slotIndex === slotIndex;
  }, 4000, 10);
  if (!r.ok) throw new Error(`selecting (${trackIndex},${slotIndex}) never confirmed`);
}

const { trackA, trackB } = await ensureFixtureTracks();
note(`fixtures: gn-A=${trackA} gn-B=${trackB}`);

// ================================================ A. does pointing move the selection?

console.log('\n-- A. the user is working on gn-B; we write to gn-A');

await userSelects(trackB, 0);
const before = await selection();
note(`the user's selection: track=${before.trackIndex} slot=${before.slotIndex} (changes=${before.changes})`);

// Exactly the frames `encodeOp('note.write')` emits to reach a clip — the point
// pair is what E1 said borrows the selection.
await batch([
  { method: 'cursor.pointTrack', params: { cursor: '0', trackIndex: trackA } },
  { method: 'slot.select', params: { trackIndex: trackA, slotIndex: 0, mechanism: 'track' } },
  { method: 'cursor.setStepSize', params: { cursor: '0', stepSize: 1 } },
]);
await sleep(SETTLE);

const after = await selection();
note(`after one pointed write:  track=${after.trackIndex} slot=${after.slotIndex} (changes=${after.changes})`);
const moved = after.trackIndex !== before.trackIndex || after.slotIndex !== before.slotIndex;
// ⚠ E1 confirmed this visually; this is the programmatic version, and it is what
// makes the wart measurable rather than anecdotal.
check('VERDICT F1: ● pointing DOES steal the user\'s clip selection (E1, now measured)',
  moved && after.trackIndex === trackA, { before, after });

// ================================================ B. can it be put back?

console.log('\n-- B. can the prior selection be saved and RESTORED around the batch?');
// The §7 open question, and the one Phase 1 has to answer to make optimistic
// apply tolerable: the user should not lose their place because the agent wrote
// somewhere else.
await userSelects(before.trackIndex, before.slotIndex);
const restored = await selection();
note(`after restore:            track=${restored.trackIndex} slot=${restored.slotIndex} (changes=${restored.changes})`);
check('VERDICT F2: ● the prior selection can be restored after a batch (§7, → P1)',
  restored.trackIndex === before.trackIndex && restored.slotIndex === before.slotIndex,
  { want: { trackIndex: before.trackIndex, slotIndex: before.slotIndex }, got: restored });

// ================================================ C. what does restoring cost?

console.log('\n-- C. does restoring the selection disturb our own cursors?');
// The mechanism only helps if putting the selection back does NOT re-point the
// pool cursor we just aimed. E1 says pool cursors are non-following by
// construction (`shouldFollowSelection=false`), so this should hold — but it is
// the load-bearing half of the fix, so it gets measured rather than assumed.
const cursor = (await client.request('cursor.status', { cursor: '0' })) as {
  trackPosition: number; sceneIndex: number; exists: boolean;
};
note(`pool cursor 0 after the selection was restored: track=${cursor.trackPosition} scene=${cursor.sceneIndex}`);
check('VERDICT F3: ● restoring the selection does NOT re-point the pool cursor (E1)',
  cursor.trackPosition === trackA && cursor.exists,
  { cursorTrack: cursor.trackPosition, expected: trackA });

// ================================================ D. the cost in selection events

console.log('\n-- D. how many selection changes does a batch cost?');
await userSelects(trackB, 0);
const d0 = await selection();
// Three clips in one batch — the realistic shape, and the one that would make
// the selection strobe if each point were separately visible to the user.
await batch([
  { method: 'cursor.pointTrack', params: { cursor: '0', trackIndex: trackA } },
  { method: 'slot.select', params: { trackIndex: trackA, slotIndex: 0, mechanism: 'track' } },
  { method: 'cursor.pointTrack', params: { cursor: '0', trackIndex: trackB } },
  { method: 'slot.select', params: { trackIndex: trackB, slotIndex: 0, mechanism: 'track' } },
  { method: 'cursor.pointTrack', params: { cursor: '0', trackIndex: trackA } },
  { method: 'slot.select', params: { trackIndex: trackA, slotIndex: 1, mechanism: 'track' } },
]);
await sleep(SETTLE);
const d1 = await selection();
note(`three points in ONE batch produced ${d1.changes - d0.changes} observable selection change(s)`);
note(`final selection: track=${d1.trackIndex} slot=${d1.slotIndex}`);
// Not asserted as pass/fail — it is a number Phase 1 needs in order to decide
// whether one restore at the end of a batch is sufficient, or whether the
// intermediate hops are visible enough to matter on their own.
note(d1.changes - d0.changes <= 1
  ? '⇒ the batch collapses to at most ONE visible change, so a single restore at the end suffices'
  : `⇒ the user sees the selection move ${d1.changes - d0.changes} times mid-batch; a trailing`
    + ' restore fixes where it ENDS but not the strobing on the way');

// ---------------------------------------------------------------- cleanup

await userSelects(trackB, 0);
note('selection returned to gn-B slot 0');

client.disconnect();
console.log(`\n${failureCount() === 0 ? 'E14 row F (re-specified): all checks passed' : `E14 row F: ${failureCount()} FAILURE(S)`}`);
process.exit(failureCount() === 0 ? 0 : 1);
