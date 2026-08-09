/**
 * E20a-diag — ⚠⚠ IS `playingStep` AN INSTRUMENT AT ALL?
 *
 * `e20a`'s A4/A5 matrix produced numbers that cannot all be true at once:
 *
 *     T1  B "synced"                 -> step 0    (transport said 48)
 *     T3  B "continue_or_synced"     -> step 15
 *     T4  B "continue_or_from_start" -> step 15   ⚠ IDENTICAL to T3, different mode
 *     T5  priming B to step 48       -> ⚠⚠ NEVER GOT THERE in 30s, though the clip
 *                                       sweeps its 64 steps every 8s at 120bpm
 *     T6  B "continue_or_synced"     -> step 0
 *
 * Meanwhile take A's cursor reported 46, 46, 46, 46, 34, 47 — moving, plausible,
 * and responsive to a poll that waited for it. ⚠ **One cursor appears to work and
 * the other does not**, which is not a statement about launch modes at all.
 *
 * ⚠ This is the E17 method trap in its cheapest form: a ○ (or worse, a confident
 * ●) from a mechanism whose precondition was never checked. Three false negatives
 * in E17 came from being unable to tell "the API declines" from "the handle was
 * never built". So before any launch-mode conclusion is recorded, ONE question:
 *
 *     does `Clip.playingStep()` on a pinned pool cursor track a launcher clip's
 *     playhead — for BOTH cursors, sampled over time, with the clip each cursor
 *     points at named and verified?
 *
 * ⚠ Verified through a DIFFERENT handle than the one under test (standing rule
 * 3a): `slot.playState` says which slot Bitwig thinks is playing, and the cursor
 * is asked separately. If they disagree, the disagreement is the finding.
 *
 *     npm run probe:e20a-diag
 *
 * ⚠ Rolls the transport. Reads only — creates nothing, writes no notes, and stops
 * the transport on every exit path.
 */
import { client, check, note, failureCount, pollUntil, ensureFixtureTracks } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);

const TAKE_A = 4;
const TAKE_B = 5;
const SAMPLES = 40;
const INTERVAL_MS = 150;

interface CursorPlay { playingStep: number; loopLength: number; sceneIndex: number; playPosition: number }
interface CursorStatus { exists: boolean; sceneIndex: number; isPinned?: boolean; loopLength: number; trackPosition: number }
interface PlayState { isPlaying: boolean; hasContent: boolean }

const cursorPlay = async (cursor: string): Promise<CursorPlay> =>
  (await req('cursor.playState', { cursor })) as CursorPlay;
const cursorStatus = async (cursor: string): Promise<CursorStatus> =>
  (await req('cursor.status', { cursor })) as CursorStatus;
const playState = async (slotIndex: number): Promise<PlayState> =>
  (await req('slot.playState', { trackIndex: trackA, slotIndex })) as PlayState;

await client.connect();
const { trackA } = await ensureFixtureTracks();

const stopAndExit = async (code: number): Promise<never> => {
  try { await req('transport.stop'); } catch { /* nothing left to stop */ }
  process.exit(code);
};

// --- 1. WHICH CLIP IS EACH CURSOR ON? ---------------------------------------
//
// ⚠ First, and it is not a formality. Every number in the matrix was attributed
// to a clip on the strength of a pin set minutes earlier, and a pin that silently
// let go would produce exactly the readings that were seen.
console.log('-- 1. where the two cursors actually point');
for (const [cursor, expected] of [['0', TAKE_A], ['1', TAKE_B]] as const) {
  const s = await cursorStatus(cursor);
  check(`D1-${cursor}: cursor ${cursor} is on scene row ${expected}, exists, and is still pinned`,
    s.exists && s.sceneIndex === expected && s.isPinned === true,
    { sceneIndex: s.sceneIndex, exists: s.exists, isPinned: s.isPinned, loopLength: s.loopLength });
  // ⚠ The step arithmetic in `e20a` divides by a 16-beat clip. If a clip is a
  // different length, every prediction it computes is wrong by a factor nobody
  // would notice, because the numbers stay in range.
  check(`D1-${cursor}-len: its clip is 16 beats, as the matrix's arithmetic assumes`,
    Math.abs(s.loopLength - 16) < 0.01, { loopLength: s.loopLength });
}

/** Sample both cursors and both slots while one clip plays. */
async function watch(label: string, playing: number): Promise<{
  steps: Record<string, number[]>; playingSlots: number[];
}> {
  const steps: Record<string, number[]> = { '0': [], '1': [] };
  const playingSlots: number[] = [];
  for (let i = 0; i < SAMPLES; i++) {
    steps['0']!.push((await cursorPlay('0')).playingStep);
    steps['1']!.push((await cursorPlay('1')).playingStep);
    playingSlots.push((await playState(playing)).isPlaying ? 1 : 0);
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }
  note(`${label}`);
  note(`   cursor 0 (row ${TAKE_A}): ${JSON.stringify(steps['0'])}`);
  note(`   cursor 1 (row ${TAKE_B}): ${JSON.stringify(steps['1'])}`);
  return { steps, playingSlots };
}

/** Did the series actually move, and did it advance rather than jitter? */
const moved = (series: number[]): boolean => new Set(series.filter((s) => s >= 0)).size > 3;
const spread = (series: number[]): number => {
  const live = series.filter((s) => s >= 0);
  return live.length === 0 ? -1 : Math.max(...live) - Math.min(...live);
};

// --- 2. WITH TAKE A PLAYING --------------------------------------------------
console.log('\n-- 2. take A playing: does its own cursor track it, and what does the other say?');
await req('slot.launchWithOptions', {
  trackIndex: trackA, slotIndex: TAKE_A, quantization: 'none', launchMode: 'from_start',
});
if (!(await pollUntil(async () => (await playState(TAKE_A)).isPlaying, 10_000, 25)).ok) {
  console.log('REFUSING: take A never started, so there is nothing to observe.');
  await stopAndExit(1);
}
const aPlaying = await watch('while take A plays', TAKE_A);
check('D2a: cursor 0 TRACKS take A while take A plays', moved(aPlaying.steps['0']!),
  { distinct: new Set(aPlaying.steps['0']).size, spread: spread(aPlaying.steps['0']!) });
// ⚠⚠ The load-bearing negative of this diagnostic. If cursor 1 reports a moving
// step while a clip it does NOT point at is playing, then `playingStep` is a
// per-TRACK playhead rather than a per-CLIP one — and every reading `e20a` took
// "for take B" was really take A's position, which would explain the matrix
// exactly.
check('D2b: cursor 1 reports NOTHING (-1) while its own clip is silent',
  aPlaying.steps['1']!.every((s) => s < 0),
  { sample: aPlaying.steps['1']!.slice(0, 8), distinct: [...new Set(aPlaying.steps['1'])] });

// --- 3. WITH TAKE B PLAYING --------------------------------------------------
console.log('\n-- 3. take B playing: the mirror image, which is the case the matrix relied on');
await req('slot.launchWithOptions', {
  trackIndex: trackA, slotIndex: TAKE_B, quantization: 'none', launchMode: 'from_start',
});
if (!(await pollUntil(async () => (await playState(TAKE_B)).isPlaying, 10_000, 25)).ok) {
  console.log('REFUSING: take B never started.');
  await stopAndExit(1);
}
const bPlaying = await watch('while take B plays', TAKE_B);
// ⚠⚠ THE ONE THE MATRIX NEEDED AND NEVER CHECKED. `e20a` read cursor 1 the
// instant take B started and treated the number as B's entry position; if this
// series does not move, that number was never a position at all.
check('D3a: cursor 1 TRACKS take B while take B plays', moved(bPlaying.steps['1']!),
  { distinct: new Set(bPlaying.steps['1']).size, spread: spread(bPlaying.steps['1']!) });
check('D3b: cursor 0 reports NOTHING (-1) while ITS clip is silent',
  aPlaying.steps['0']!.length > 0 && bPlaying.steps['0']!.every((s) => s < 0),
  { sample: bPlaying.steps['0']!.slice(0, 8), distinct: [...new Set(bPlaying.steps['0'])] });

// ⚠ The sweep test, separately from "did it move": a playhead crosses the whole
// clip. A value that wobbles between 0 and 15 has moved, and is still not a
// playhead — which is precisely the shape `e20a`'s readings had.
// ⚠ Against the clip's OWN measured length, never a constant. The first run of
// this check hard-coded 64 steps and failed on a clip that was doing exactly what
// a 16-step clip should — reporting a defect in the subject that was really a
// defect in the expectation.
const bSteps = Math.round((await cursorStatus('1')).loopLength * 4);
check('D3c: cursor 1 sweeps most of its OWN clip rather than hovering near the top',
  spread(bPlaying.steps['1']!) > bSteps / 2,
  { spread: spread(bPlaying.steps['1']!), clipSteps: bSteps });

await req('transport.stop');
console.log(failureCount() === 0
  ? '\nE20a-diag: PASS — playingStep is a per-clip playhead on both cursors, so the matrix\'s'
    + '\n           readings were real and the launch-mode question stands as measured.'
  : `\nE20a-diag: ${failureCount()} FAILED — read the series above before trusting ANY A4/A5 number.`);
await stopAndExit(failureCount() === 0 ? 0 : 1);
