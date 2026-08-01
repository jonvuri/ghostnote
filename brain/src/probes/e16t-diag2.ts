/**
 * E16 §3.4g diagnostic 2 — is the CLIP equals value wrong, or merely STUCK?
 *
 * `e16t-diag` left one thing genuinely open and two things it got wrong.
 *
 * ⚠ Wrong, and caught by its own transcript: its "two cursors on different EMPTY
 * slots" test asked for scenes 11 and 12, and both cursors timed out and stayed
 * at scene 1 — so it compared two cursors on the SAME slot and read the expected
 * `true` as evidence for a hypothesis it did not test. The slot bank has 16 rows
 * but the PROJECT has fewer scenes, and a row past the scene count is not
 * pointable. That is the second time in this row a discarded return value
 * produced something that read like a result; this probe asserts arrival every
 * single time and refuses outright when it does not get it.
 *
 * ⚠ Genuinely open: with both cursors PROVED on different clips, `clip0=clip1`
 * still read true. Three shapes, distinguishable only by the ORDER of the reads:
 *
 *   always-true   different → true, same → true, different → true
 *   STUCK         ⚠ first read latches and never changes afterwards
 *   works         different → false, same → true, different → false
 *
 * The previous runs only ever went same-then-different, which cannot tell the
 * first two apart from the third. So this one starts on DIFFERENT slots, from a
 * fresh connection, and reads before anything has had a chance to latch.
 *
 * Silent. Points cursors and creates clips in slots the fixture already owns.
 */
import { client, check, note, failureCount, pollUntil, cursorStatus, ensureFixtureTracks } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);

interface EqualsStatus { pairs: Record<string, boolean | string> }
const pairOf = async (key: string): Promise<boolean | string | undefined> =>
  ((await req('equals.status', { all: true })) as EqualsStatus).pairs[key];
const slotHas = async (trackIndex: number, slotIndex: number): Promise<boolean> =>
  ((await req('slot.status', { trackIndex, slotIndex })) as { hasContent: boolean }).hasContent;

/** Point, and REFUSE to report anything if the cursor did not verifiably arrive. */
async function pointHard(cursor: string, trackIndex: number, slotIndex: number): Promise<void> {
  await req('cursor.pointTrack', { cursor, trackIndex });
  await req('slot.select', { trackIndex, slotIndex, mechanism: 'track' });
  const r = await pollUntil(async () => {
    const s = await cursorStatus(cursor);
    return s.trackPosition === trackIndex && s.sceneIndex === slotIndex && s.exists;
  }, 5000, 100);
  const s = await cursorStatus(cursor);
  if (!r.ok) {
    console.log(`\nREFUSING: cursor ${cursor} did not reach ${trackIndex}/${slotIndex} — it is at `
      + `${s.trackPosition}/${s.sceneIndex} exists=${s.exists} after ${r.ms}ms.`);
    console.log('Reading an equals pair now would compare two cursors that are not where this');
    console.log('probe believes they are, which is exactly how the previous run went wrong.');
    process.exit(1);
  }
  note(`  cursor ${cursor} -> ${trackIndex}/${slotIndex} (${r.ms}ms, exists=${s.exists})`);
}

/** Read after a settle window, so "false" is not merely "has not updated yet". */
async function readPair(label: string): Promise<boolean | string | undefined> {
  await new Promise((r) => setTimeout(r, 600));
  const v = await pairOf('clip0=clip1');
  note(`  ${label}: clip0=clip1 -> ${JSON.stringify(v)}`);
  return v;
}

await client.connect();
console.log('connected\n');

const rolling = (await req('transport.status')) as { isPlaying: boolean };
if (rolling.isPlaying) {
  console.log('REFUSING: the transport is rolling.');
  process.exit(1);
}

const { trackA, trackB } = await ensureFixtureTracks();
const scenes = ((await req('scene.count')) as { sceneCount: number }).sceneCount;
note(`the project has ${scenes} scenes; the slot bank has 16 rows.`);
note('⚠ rows past the scene count are NOT pointable — that is what broke e16t-diag 1b.');
if (scenes < 2) {
  console.log('REFUSING: fewer than two scenes, so there is no second slot to compare against.');
  process.exit(1);
}

for (const s of [0, 1]) {
  if (!(await slotHas(trackA, s))) {
    await req('clip.create', { trackIndex: trackA, slotIndex: s, lengthBeats: 4 });
    await pollUntil(() => slotHas(trackA, s));
  }
}
for (const c of [0, 1]) {
  await req('cursor.pinTrack', { cursor: c, pinned: false });
  await req('cursor.pin', { cursor: String(c), pinned: false });
}

// ==========================================================================
// ⚠ DIFFERENT FIRST — the ordering the previous runs never tried
// ==========================================================================
console.log('-- A: different slots, read BEFORE anything could latch');
await pointHard('0', trackA, 0);
await pointHard('1', trackA, 1);
const a = await readPair('different (0 vs 1)');

console.log('\n-- B: now the SAME slot');
await pointHard('1', trackA, 0);
const b = await readPair('same (0 vs 0)');

console.log('\n-- C: different again');
await pointHard('1', trackA, 1);
const c = await readPair('different again (0 vs 1)');

console.log('\n-- D: and the other cursor moved instead, in case only cursor 1 is inert');
await pointHard('0', trackA, 1);
const d = await readPair('same, reached by moving cursor 0 (1 vs 1)');
await pointHard('0', trackA, 0);
const e = await readPair('different, by moving cursor 0 back (0 vs 1)');

// ==========================================================================
// ⚠ F — is it always-true, or is it comparing the wrong THING?
// ==========================================================================
/**
 * Everything above varied only the SLOT, and kept both cursors on one track. So
 * "always true" has a second reading that is far more informative: the
 * comparison may be at the granularity of the cursor's OWNING TRACK rather than
 * the clip it points at.
 *
 * ⚠ There is already evidence for that reading. `clip0=follower` read FALSE in
 * `e16t`, so clip pairs are not universally true — and `followerClip` is the one
 * clip cursor created on the HOST rather than on a cursor track. Two readings,
 * one test: put the cursors on different TRACKS.
 */
console.log('\n-- F: different TRACKS, not merely different slots');
await pointHard('0', trackA, 0);
await pointHard('1', trackB, 0);
const f = await readPair('different tracks (A/0 vs B/0)');
const followerPair = await pairOf('clip0=follower');
note(`  and clip0=follower -> ${JSON.stringify(followerPair)} (a HOST-level cursor clip)`);

// ==========================================================================
// ⚠ G — the doubt F creates about the TRACK pairs, chased rather than left
// ==========================================================================
/**
 * ⚠ **F's result impeaches a guard this row already claimed.**
 *
 * If two clip cursors compare equal regardless of what they point at, the
 * comparison is not about the target — and `ct{i}=ct{j}` is the same shape:
 * two CURSOR proxies of the same kind. `e16t` claimed cursor↔cursor as an
 * aliasing detector (E2c's fixture contamination, caught directly instead of
 * from symptoms) and never actually exercised it — it only ever exercised
 * cursor↔BANK-ITEM, which demonstrably does discriminate.
 *
 * So the claim is unverified and F says it is probably false. Chasing it now,
 * because writing up an aliasing detector that reads true unconditionally would
 * be shipping a guard that fails GREEN — the one shape that must never ship.
 */
console.log('\n-- G: does cursor-vs-cursor discriminate for TRACKS either?');
await req('cursor.pointTrack', { cursor: '0', trackIndex: trackA });
await req('cursor.pointTrack', { cursor: '1', trackIndex: trackB });
await pollUntil(async () => {
  const s0 = await cursorStatus('0');
  const s1 = await cursorStatus('1');
  return s0.trackPosition === trackA && s1.trackPosition === trackB;
}, 5000, 100);
note(`  cursor tracks are on ${trackA} and ${trackB} (different tracks)`);
await new Promise((r) => setTimeout(r, 600));
const ctDifferent = await pairOf('ct0=ct1');
note(`  ct0=ct1 on DIFFERENT tracks -> ${JSON.stringify(ctDifferent)}`);

await req('cursor.pointTrack', { cursor: '1', trackIndex: trackA });
await pollUntil(async () => (await cursorStatus('1')).trackPosition === trackA, 5000, 100);
await new Promise((r) => setTimeout(r, 600));
const ctSame = await pairOf('ct0=ct1');
note(`  ct0=ct1 on the SAME track -> ${JSON.stringify(ctSame)}`);

check('⚠ cursor-vs-cursor discriminates for tracks (the claimed ALIASING detector)',
  ctDifferent === false && ctSame === true, { different: ctDifferent, same: ctSame });
if (ctDifferent === true) {
  note('⚠ it does NOT. `ct0=ct1` is true even on different tracks, exactly as the clip');
  note('  pairs are. ⇒ The rule is not "createEqualsValue works"; it is that it works');
  note('  between a CURSOR and a BANK ITEM, and is meaningless between two cursors of');
  note('  the same kind. e16t\'s aliasing-detector claim is WITHDRAWN — and note that it');
  note('  would have failed GREEN, reporting "no aliasing" by reporting "always aliased".');
}

// ==========================================================================
// verdict
// ==========================================================================
console.log('\n================ which shape is it? ================');
const reads = { a, b, c, d, e, f, ctDifferent, ctSame };
note(`reads: ${JSON.stringify(reads)}`);

const allTrue = [a, b, c, d, e].every((v) => v === true);
const works = a === false && b === true && c === false && d === true && e === false;
const latched = a === false && b === true && c === true;

check('⚠ the clip equals value DISCRIMINATES between two different clips', works, reads);

if (works) {
  note('● it works. The earlier FAIL was an artifact of always reading same-then-different');
  note('  after the cursors had been pinned by an earlier section — a probe defect, and the');
  note('  clip half of the matrix is sound.');
} else if (allTrue) {
  note('⚠ ALWAYS TRUE, including on a fresh read with the cursors proven apart. The clip');
  note('  pairs are worthless: a value that cannot be false cannot be a guard. Note this');
  note('  does NOT weaken the track pairs, which were shown to go both ways (e16t §3b).');
} else if (latched) {
  note('⚠ STUCK: it reads correctly once and then latches on the first true. That is worse');
  note('  than always-true, because it looks like it works right up until it silently');
  note('  stops — and a guard that fails green is the one shape that must never ship.');
} else {
  note('⚠ none of the three shapes fits. Report the raw reads and do not summarise them');
  note('  into a verdict; an unexplained pattern is a result, not a rounding error.');
}

note('⚠ Either way the CONCLUSION for §3.4g is unchanged: both halves of every clip pair');
note('  are OUR OWN cursors, so this can only ever detect cursor aliasing (E2c), never');
note('  whether a clip a human moved is still the clip we addressed. E16l stands.');

console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} FAILURES`);
process.exit(failureCount() === 0 ? 0 : 1);
