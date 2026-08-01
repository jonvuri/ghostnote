/**
 * E16 §3.4a / §3.4c / §3.4i — the branch budget, measured.
 *
 * Under the track-native model **the bank window IS the history budget**: every
 * fork is a track, every lineage is a group, and a four-track turn costs four
 * groups on top of four forks. Nobody has measured where that ceiling is, and
 * rows D–G left the question open with a specific warning attached —
 * `ALL_CHANNELS` became load-bearing (a folded group's children otherwise leave
 * the bank and read `found:false`, byte-identical to deleted), and *"ALL_CHANNELS
 * is not free and is UNMEASURED. Folded children now occupy bank slots, so a
 * grouped project consumes the window faster."*
 *
 *   A  ⚠ what happens AT and PAST the bank window under `ALL_CHANNELS`, and —
 *      the load-bearing half — does `itemCount()` still report the PROJECT
 *      total there? Standing rule 5 ("detect and fail loud, never operate on a
 *      partially-visible project") is only implementable if it does. E15-A
 *      measured that on the DEFAULT filter; rows D–G then noted `itemCount`
 *      inherits the filter, so the rule's foundation has not been checked on the
 *      filter the model now requires.
 *   C  fork burst cost — C5 measured single duplications; a lineage is made in
 *      bursts, and a burst may be worse than N x one.
 *   I  cursor-pool pressure — a lineage multiplies the tracks a pool must reach.
 *
 * ⚠ **This probe CREATES AND DELETES a lot of tracks.** Every id it mints is
 * recorded and removed at the end, poll-verified one at a time: rows D–G trap 4
 * measured a fixed 400ms wait between deletes mis-targeting the next one and
 * removing an unrelated track as collateral.
 *
 * ⚠ Transport must be STOPPED — duplication glitches audio (C5, 5/5 vs 0/3
 * placebo) and this makes many of them. The probe refuses to run while it rolls.
 *
 * Silent otherwise; nothing is launched. Safe on a non-TTY.
 */
import { client, check, note, failureCount, pollUntil } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

type TrackRow = { index: number; name: string; channelId: string; type: string };
type TrackList = { tracks: TrackRow[]; count: number; itemCount: number; bankSize: number };

const list = async () => (await req('track.list')) as TrackList;
const resolves = async (channelId: string) =>
  (await req('track.resolveByChannelId', { channelId })) as { found: boolean; index?: number };

const minted: string[] = [];

async function createTrack(): Promise<string | undefined> {
  const before = await list();
  const beforeIds = new Set(before.tracks.map((t) => t.channelId));
  await req('track.create', { position: before.count });
  // ⚠ Poll on itemCount, NOT on the visible count — past the window the visible
  // count cannot move, and waiting for it would hang exactly when the finding
  // starts. That asymmetry is the whole point of row A.
  await pollUntil(async () => (await list()).itemCount > before.itemCount, 10000, 80);
  const after = await list();
  const fresh = after.tracks.find((t) => !beforeIds.has(t.channelId))?.channelId;
  if (fresh) minted.push(fresh);
  return fresh;
}

await client.connect();
console.log('connected\n');

const transport = (await req('transport.status')) as { isPlaying: boolean };
if (transport.isPlaying) {
  console.log('REFUSING: the transport is rolling. This probe makes many duplications and');
  console.log('every one of them glitches the audio (C5). Stop the transport and re-run.');
  process.exit(1);
}

const start = await list();
note(`start: ${start.count} visible / ${start.itemCount} itemCount / bankSize ${start.bankSize}`);

// ⚠ ALL_CHANNELS, because that is the filter the model requires and the one the
// budget has never been measured on.
const filterAck = (await req('branch.contentFilter', { filter: 'ALL_CHANNELS' })) as
  { called: boolean; error?: string };
check('bank is on ALL_CHANNELS for this measurement', filterAck.called === true, filterAck);
await wait(500);

// ==========================================================================
// A — the bank window, at and past the ceiling
// ==========================================================================
console.log('\n-- A: filling the bank window under ALL_CHANNELS');

const bankSize = start.bankSize;
const target = bankSize + 5;
const trail: { itemCount: number; visible: number; lastResolved: boolean }[] = [];

while ((await list()).itemCount < target) {
  const id = await createTrack();
  const l = await list();
  const r = id ? await resolves(id) : { found: false };
  trail.push({ itemCount: l.itemCount, visible: l.count, lastResolved: r.found });
  if (trail.length > 40) break; // guard against a runaway loop
}

const end = await list();
note(`end: ${end.count} visible / ${end.itemCount} itemCount / bankSize ${end.bankSize}`);
console.log('');
console.log('  itemCount  visible  newest-resolved');
for (const t of trail) {
  const mark = t.itemCount > bankSize ? ' <- past the window' : '';
  console.log(`  ${String(t.itemCount).padStart(9)}  ${String(t.visible).padStart(7)}  `
    + `${t.lastResolved ? '●' : '○'}${mark}`);
}

/**
 * ⚠ THE load-bearing check of this probe. Standing rule 5 says overflow is a
 * refusal, not a knob — and E15-A made that implementable by finding that
 * `itemCount()` reports the PROJECT total rather than the window. Rows D–G then
 * observed that `itemCount` INHERITS the content filter. So the rule's
 * foundation has to be re-confirmed on `ALL_CHANNELS`, which is the filter the
 * model makes mandatory. If it caps at `bankSize`, "16 tracks exist" and "16 of
 * 21 are visible" become indistinguishable and rule 5 is unimplementable.
 */
const pastWindow = end.itemCount > bankSize;
check('⚠ A: `itemCount` reports the PROJECT total past the bank window under ALL_CHANNELS — '
  + 'so standing rule 5 is still implementable on the filter the model requires',
  pastWindow && end.itemCount > end.count,
  { itemCount: end.itemCount, visible: end.count, bankSize,
    why: 'if itemCount capped at bankSize, overflow would be undetectable and rule 5 unbuildable' });

check('A: the visible bank saturates at bankSize while the project grows past it',
  end.count <= bankSize && end.itemCount > end.count,
  { visible: end.count, bankSize, itemCount: end.itemCount });

const beyond = trail.filter((t) => t.itemCount > bankSize);
const beyondResolved = beyond.filter((t) => t.lastResolved).length;
note(`tracks created past the window: ${beyond.length}, of which resolvable: ${beyondResolved}`);
check('A: a track past the window does NOT resolve — it is invisible, not merely slow, '
  + 'which is what makes it a checkpoint blind spot rather than a performance issue',
  beyond.length === 0 || beyondResolved === 0,
  { createdBeyond: beyond.length, resolvedBeyond: beyondResolved,
    reading: beyondResolved > 0
      ? '⚠ some resolved past the window — the ceiling is softer than E5 recorded'
      : 'clean ceiling' });

console.log('');
console.log(`   ⇒ A: with the rig at tracks=${bankSize}, the branch budget is `
  + `${bankSize} MINUS the project's own tracks.`);
console.log(`      This project started at ${start.itemCount}, so it had ${bankSize - start.itemCount} `
  + 'slots for forks and groups before rule 5 must refuse.');
console.log('      ⚠ The bank size is CONFIG (`~/.ghostnote/rig.json`, D7 ships 256), so the');
console.log('        ceiling is a tuning decision, not a wall — what is NOT tunable is that');
console.log('        every fork and every lineage group consumes one slot.');

// ==========================================================================
// C — fork burst cost
// ==========================================================================
/**
 * ⚠ Measured well INSIDE the window, after trimming back, so the burst is not
 * secretly measuring the overflow behaviour row A just established.
 */
console.log('\n-- C: fork burst — N duplications back to back vs one at a time');

// Trim back to leave room.
while (minted.length > 2) {
  const id = minted.pop()!;
  const at = await resolves(id);
  if (at.found && at.index !== undefined) {
    await req('track.delete', { trackIndex: at.index });
    await pollUntil(async () => !(await resolves(id)).found, 8000, 100);
  }
}
await wait(500);

const source = minted[0] ?? (await createTrack());
if (!source) {
  console.log('REFUSING: no source track to duplicate.');
} else {
  const dupOnce = async (): Promise<number> => {
    const at = await resolves(source);
    if (!at.found || at.index === undefined) throw new Error('source vanished');
    const before = (await list()).itemCount;
    const beforeIds = new Set((await list()).tracks.map((t) => t.channelId));
    const t0 = Date.now();
    await req('branch.duplicateTrack', { trackIndex: at.index, route: 'hostDuplicate' });
    await pollUntil(async () => (await list()).itemCount > before, 20000, 15);
    const ms = Date.now() - t0;
    const fresh = (await list()).tracks.find((t) => !beforeIds.has(t.channelId))?.channelId;
    if (fresh) minted.push(fresh);
    return ms;
  };

  // Spaced singles — the C1/C5 baseline shape.
  const singles: number[] = [];
  for (let i = 0; i < 3; i++) {
    singles.push(await dupOnce());
    await wait(1200);
  }

  // Burst — back to back, no settle between.
  const burst: number[] = [];
  for (let i = 0; i < 3; i++) burst.push(await dupOnce());

  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
  note(`spaced singles: ${singles.join(', ')} ms (median ${median(singles)})`);
  note(`burst:          ${burst.join(', ')} ms (median ${median(burst)})`);
  const ratio = median(burst) / Math.max(1, median(singles));
  console.log('');
  console.log(`   ⇒ C: a burst duplication costs ${ratio.toFixed(2)}x a spaced one `
    + `(${median(burst)}ms vs ${median(singles)}ms).`);
  check('C: burst cost is REPORTED (both arms produced timings) — the reading, not the answer',
    singles.length === 3 && burst.length === 3, { singles, burst, ratio: ratio.toFixed(2) });
  note(ratio > 1.5
    ? '⚠ a burst is materially worse per fork than a spaced one — an N-track turn should pace'
    : 'a burst is not materially worse per fork; an N-track turn need not pace for cost reasons');
}

// ==========================================================================
// I — cursor-pool pressure
// ==========================================================================
console.log('\n-- I: cursor-pool pressure across a lineage');
const rig = (await req('rig.info')) as { cursorPool: number };
note(`rig cursorPool = ${rig.cursorPool} (D7 ships 8)`);

const reachable = (await list()).tracks.filter((t) => t.type === 'Instrument').slice(0, rig.cursorPool + 1);
let pointed = 0;
for (let i = 0; i < Math.min(rig.cursorPool, reachable.length); i++) {
  await req('cursor.pointTrack', { cursor: String(i), trackIndex: reachable[i]!.index });
  pointed++;
}
check(`all ${pointed} pool cursors point at different tracks concurrently `
  + '(E1\'s result, reconfirmed under a lineage-shaped project)',
  pointed === Math.min(rig.cursorPool, reachable.length), { pointed, pool: rig.cursorPool });

/**
 * ⚠ The question that matters for a lineage: what happens when it needs MORE
 * concurrent handles than the pool has? A loud failure is fine; a silent
 * fallback onto cursor 0 would mean a write aimed at fork D landing on fork A.
 */
let outOfPool = 'no error';
try {
  await req('cursor.pointTrack', { cursor: String(rig.cursorPool), trackIndex: reachable[0]!.index });
} catch (e) {
  outOfPool = e instanceof Error ? e.message : String(e);
}
note(`pointing cursor '${rig.cursorPool}' (one past the pool): ${outOfPool}`);
check('⚠ I: asking for a cursor beyond the pool FAILS LOUDLY rather than silently aliasing '
  + 'onto another cursor — a silent alias would land a write on the wrong fork',
  outOfPool !== 'no error',
  { response: outOfPool,
    why: 'a lineage of N forks needs N concurrent handles; the pool is the real limit and it '
      + 'must announce itself' });

console.log('');
console.log(`   ⇒ I: concurrent addressing across a lineage is bounded by cursorPool `
  + `(${rig.cursorPool} here, D7 ships 8), NOT by the bank window.`);
console.log('      A lineage wider than the pool must address its forks in sequence, re-pointing');
console.log('      between them — which D6 already requires after any structural op anyway.');

// ==========================================================================
// cleanup
// ==========================================================================
console.log('\n-- cleanup: removing every track this probe minted');
let removed = 0;
for (const id of [...minted].reverse()) {
  const at = await resolves(id);
  if (!at.found || at.index === undefined) continue;
  await req('track.delete', { trackIndex: at.index });
  // ⚠ One at a time, poll-verified. Rows D–G trap 4: a fixed wait between
  // deletes mis-targets the next one and takes an unrelated track with it.
  const gone = await pollUntil(async () => !(await resolves(id)).found, 8000, 100);
  if (gone.ok) removed++;
}
await req('branch.contentFilter', { filter: 'ALL_VISIBLE_CHANNELS' });
const final = await list();
note(`removed ${removed} of ${minted.length} minted tracks`);
check('the project is back to the track count it started with',
  final.itemCount === start.itemCount,
  { before: start.itemCount, after: final.itemCount,
    warning: final.itemCount !== start.itemCount ? '⚠ LITTER LEFT — clean up by hand' : 'clean' });

console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} FAILURES`);
process.exit(failureCount() === 0 ? 0 : 1);
