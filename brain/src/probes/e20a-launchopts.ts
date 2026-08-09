/**
 * E20a — `launchWithOptions(quantization, launchMode)`, the clip half's most
 * valuable unclaimed primitive, run for the first time.
 *
 * ⚠⚠ **Two separable claims, and a first draft of E18-VERDICT conflated them
 * twice before the operator caught it.** They are measured separately here:
 *
 *   1. **quantisation is a PER-CALL override** — `"1"` forces the switch onto the
 *      bar, `"8"` onto the 8-bar phrase, whatever the project's own launch
 *      quantisation says. E16m's complaint ("*it would be better if it were
 *      aligned to beat or measure boundaries*") is answered with a knob.
 *   2. ⚠⚠ **`"continue_or_synced"` makes take B pick up at take A's position**
 *      instead of restarting — the same bar rendered differently. ⚠ **No mute,
 *      solo or chain switch can imitate that**, and it is the one thing the clip
 *      half delivers that nothing else in the design does (E18-VERDICT §4c).
 *
 * ⚠ **What this probe does NOT claim.** `launchWithOptions` is a VERB: it decides
 * how a switch behaves, never that one happens. Every launch still needs a
 * caller. Hands-off auto-advance lives in the Next Action, which is **not in the
 * controller API** (§4a″ — five classes dumped in full, the string "next action"
 * absent from the entire javadoc tree). Nothing below measures unattendedness.
 *
 *     npm run probe:e20a        PART A — autonomous, typed calls only
 *     npm run probe:e20a-ear    PART B — ⚠ the operator, listening
 *
 * ⚠⚠ **THE TRANSPORT ROLLS FOR THE WHOLE OF PART A.** A launcher clip launch
 * starts playback by itself (E16w) and the clip loops. Do not start this while
 * the operator is listening to something; it is stopped again at the end, and on
 * every early exit path.
 *
 * ⚠ PART A needs no sound at all — every verdict is state (`playingStep`,
 * `isPlaying`, `isPlaybackQueued`, `playPosition`), so a fixture track with no
 * instrument on it is fine and quiet. PART B is the opposite: it is entirely
 * about what the operator HEARS, so it refuses to run unless the subject is
 * measurably audible at the master (the `e16v` precedent — "*the subject is not
 * audible, so every trial would be a placebo*").
 *
 * Leaves two clips on the fixture track, named in the closing note.
 */
import {
  client, check, note, failureCount, pollUntil, ensureFixtureTracks, ask, askYesNo,
} from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);

/**
 * ⚠ Rows the fixture does not otherwise use, and NOT `e19`'s row 6 — a leftover
 * from another probe read as this one's take would be undetectable.
 */
const TAKE_A = 4;
const TAKE_B = 5;

/**
 * ⚠⚠ FOUR BARS, and the length is load-bearing rather than arbitrary.
 *
 * With a ONE-bar clip and `quantization: "1"` the switch lands exactly where the
 * loop restarts anyway, so `"continue_or_synced"` and `"from_start"` produce the
 * IDENTICAL result and the headline arm would pass for both. The clip has to be
 * longer than the quantisation grid for "continue" to mean anything — four bars
 * against a one-bar grid gives three distinguishable places to switch.
 *
 * 16 beats is also exactly the cursor's step window (`gridSteps` 64 × the 0.25
 * step size), so `playingStep` spans 0..63 and never leaves the grid.
 */
const CLIP_BEATS = 16;
const STEPS_PER_BEAT = 4;
const CLIP_STEPS = CLIP_BEATS * STEPS_PER_BEAT;

/**
 * ⚠ ASSUMED 4/4. `Transport.timeSignature()` is not on our wire and adding it to
 * read one number would be a worse trade than saying so: if the project is in
 * anything else, the bar-boundary arms below are UNINTERPRETABLE rather than
 * subtly wrong, and they will fail loudly with this constant named in the output.
 */
const BEATS_PER_BAR = 4;
/**
 * ⚠ How far from a bar line still counts as "on the bar", in beats.
 *
 * This is polling error, not Bitwig's: the switch is observed by asking, and a
 * ~20ms poll interval plus a bridge round trip is a few hundredths of a beat at
 * any sane tempo. A tolerance far tighter than the instrument would fail on its
 * own noise; far looser and a quarter-note grid would pass as a bar.
 */
const BAR_TOLERANCE = 0.35;

interface PlayState {
  sampledAtMs: number;
  hasContent: boolean;
  isPlaying: boolean;
  isPlaybackQueued: boolean;
  isStopQueued: boolean;
  playPosition: number;
}
interface CursorPlay {
  sampledAtMs: number;
  playingStep: number;
  exists: boolean;
  loopLength: number;
  sceneIndex: number;
  playPosition: number;
  isPlaying: boolean;
}
interface Mark { contentEpoch: number; contentEvents: { seq: number }[] }

const playState = async (trackIndex: number, slotIndex: number): Promise<PlayState> =>
  (await req('slot.playState', { trackIndex, slotIndex })) as PlayState;
const cursorPlay = async (cursor: string): Promise<CursorPlay> =>
  (await req('cursor.playState', { cursor })) as CursorPlay;
const mark = async (): Promise<Mark> => (await req('revision.get')) as Mark;

/**
 * A clip's loop length in beats, read by pointing a cursor at it.
 *
 * ⚠ Read through the CURSOR rather than trusting the length we asked
 * `clip.create` for. A clip we did not create has whatever length it has, and the
 * request that created one is not evidence about the object that exists now
 * (standing rule 1; rule 3a — verify through a different handle than the one that
 * made the write).
 */
async function lengthOf(slotIndex: number, cursor: string): Promise<number> {
  await req('cursor.pin', { cursor, pinned: false });
  await req('cursor.pointTrack', { cursor, trackIndex: trackA });
  await req('slot.select', { trackIndex: trackA, slotIndex, mechanism: 'track' });
  const landed = await pollUntil(async () =>
    ((await req('cursor.status', { cursor })) as { sceneIndex: number }).sceneIndex === slotIndex);
  if (!landed.ok) return -1;
  await req('cursor.pin', { cursor, pinned: true });
  return ((await req('cursor.status', { cursor })) as { loopLength: number }).loopLength;
}

/** Distance from the nearest bar line, in beats — always in [0, BEATS_PER_BAR/2]. */
const fromBar = (position: number): number => {
  const within = ((position % BEATS_PER_BAR) + BEATS_PER_BAR) % BEATS_PER_BAR;
  return Math.min(within, BEATS_PER_BAR - within);
};

const mode = process.argv[2] ?? 'a';
if (!['a', 'ear'].includes(mode)) {
  console.log('usage: e20a-launchopts.ts [a|ear]');
  process.exit(2);
}

await client.connect();

/** Stop the transport whatever happens next — a probe must not leave it rolling. */
const stopAndExit = async (code: number): Promise<never> => {
  try {
    await req('transport.stop');
  } catch { /* the transport is the DAW's problem if the bridge is already gone */ }
  process.exit(code);
};

const { trackA } = await ensureFixtureTracks();

/**
 * Two takes on ONE track, which is what a clip block is: alternates in the same
 * column, so a launch of one replaces the other and the comparison is a single
 * gesture. Take A is a rising line from pitch 60, take B the same shape an octave
 * up from 72 — so the ear can tell WHICH take is playing (the octave) and WHERE
 * INSIDE IT playback is (the rise), which is the whole of PART B's question.
 */
async function ensureTake(slotIndex: number, pitch: number, cursor: string): Promise<boolean> {
  const has = async () =>
    ((await req('slot.status', { trackIndex: trackA, slotIndex })) as { hasContent: boolean }).hasContent;

  // ⚠⚠ THE LENGTH IS VERIFIED, NOT ASSUMED — and the first run of this probe is
  // why. `ensureTake` used to create a clip only when the slot was EMPTY and
  // accept whatever was already there otherwise, so a pre-existing ONE-BAR clip
  // at row 5 quietly became take B. That is the exact condition this file's own
  // header says makes the headline arm meaningless: with a one-bar take and a
  // one-bar launch grid, the switch always lands where the loop restarts, so
  // `continue_or_synced` and `from_start` are indistinguishable BY CONSTRUCTION
  // and the whole matrix agreed with itself while measuring nothing.
  //
  // ⚠ Standing rule 1, in the place it is easiest to skip: the setup is as much
  // a subject of readback as the result is.
  if (await has()) {
    const existing = (await req('slot.status', { trackIndex: trackA, slotIndex })) as { hasContent: boolean };
    const length = await lengthOf(slotIndex, cursor);
    if (existing.hasContent && Math.abs(length - CLIP_BEATS) > 0.01) {
      note(`⚠ row ${slotIndex} held a ${length}-beat clip, not ${CLIP_BEATS} — REPLACING it, `
        + 'because a clip shorter than the launch grid makes the launch-mode arms undecidable');
      await req('slot.delete', { trackIndex: trackA, slotIndex });
      await pollUntil(async () => !(await has()));
    }
  }
  if (!(await has())) {
    await req('clip.create', { trackIndex: trackA, slotIndex, lengthBeats: CLIP_BEATS });
    if (!(await pollUntil(has)).ok) return false;
  }
  // ⚠ Through `point`, then PINNED. Pointing borrows the user's selection (E1)
  // and an unpinned cursor follows it away again; both takes have to stay
  // readable simultaneously, because the whole measurement is one cursor's step
  // count at the moment the OTHER take starts.
  await req('cursor.pin', { cursor, pinned: false });
  await req('cursor.pointTrack', { cursor, trackIndex: trackA });
  await req('slot.select', { trackIndex: trackA, slotIndex, mechanism: 'track' });
  const landed = await pollUntil(async () => {
    const s = (await req('cursor.status', { cursor })) as { exists: boolean; sceneIndex: number };
    return s.exists && s.sceneIndex === slotIndex;
  });
  if (!landed.ok) return false;
  await req('cursor.pin', { cursor, pinned: true });

  // ⚠ One note per BEAT, duration 0.9 — never a full beat. E8-E: consecutive
  // same-pitch notes truncate each other, so a run of length-1 notes at pitch 60
  // would silently become something else and `playingStep` would report a grid
  // the clip does not have.
  //
  // ⚠⚠ **The line RISES, and that is for the ear arm specifically.** A flat
  // pattern of identical notes makes PART B's second question unanswerable: if
  // every bar sounds like every other bar, "did take B come in part-way through or
  // restart from the top?" has no audible answer, and the operator would be asked
  // to report something they cannot hear. A rising line makes position audible —
  // a take entering at bar 3 enters HIGH. The programmatic arms do not care either
  // way, so this costs nothing and rescues the only arm that measures the thing
  // E16m actually complained about.
  const notes: [number, number, number, number][] = [];
  for (let beat = 0; beat < CLIP_BEATS; beat++) {
    notes.push([beat * STEPS_PER_BEAT, pitch + beat, 100, 0.9]);
  }
  await req('cursor.clearNotes', { cursor });
  await req('cursor.setNotes', { cursor, notes });
  const wrote = await pollUntil(async () =>
    ((await req('cursor.getNotes', { cursor })) as { notes: unknown[] }).notes.length === CLIP_BEATS);
  return wrote.ok;
}

const builtA = await ensureTake(TAKE_A, 60, '0');
const builtB = await ensureTake(TAKE_B, 72, '1');
check('E20a-S0: two takes exist on one track, each readable through its own pinned cursor',
  builtA && builtB, { takeA: builtA, takeB: builtB });
if (!(builtA && builtB)) {
  console.log('REFUSING: without both takes in place every arm below measures the wrong clip.');
  await stopAndExit(1);
}

// ⚠⚠ The guard that would have caught the first run's silent failure, kept even
// though `ensureTake` now enforces the length: the enforcement is a mechanism and
// this is the readback that proves the mechanism worked. Both clips must be
// LONGER THAN THE LAUNCH GRID or the launch-mode arms cannot distinguish anything.
const lengthA = await lengthOf(TAKE_A, '0');
const lengthB = await lengthOf(TAKE_B, '1');
check(`E20a-S1: both takes are ${CLIP_BEATS} beats — four bars against a one-bar launch grid`,
  Math.abs(lengthA - CLIP_BEATS) < 0.01 && Math.abs(lengthB - CLIP_BEATS) < 0.01,
  { takeA: lengthA, takeB: lengthB, launchGridBars: 1, clipBars: CLIP_BEATS / BEATS_PER_BAR });
if (Math.abs(lengthA - CLIP_BEATS) > 0.01 || Math.abs(lengthB - CLIP_BEATS) > 0.01) {
  console.log('REFUSING: a take is not longer than the launch grid, so "continue" and "restart"');
  console.log('would land in the same place and every arm below would agree while measuring');
  console.log('nothing. That is how the first run of this probe produced a consistent matrix');
  console.log('of meaningless numbers.');
  await stopAndExit(1);
}

// ⚠ The baseline for the silence check goes here, AFTER the setup that legitimately
// fires occupancy events — otherwise our own `clip.create` would be scored as the
// concurrent edit the arm is looking for.
const quietFrom = await mark();

if (mode === 'a') {
  // --- A0. the guard, before anything reaches Bitwig -------------------------
  //
  // ⚠⚠ FIRST, and safe precisely because the value never gets there. The API
  // takes these as free strings and documents the legal set in prose; E14-A1
  // established that a value Bitwig rejects arrives as an exception on ITS thread,
  // where no handler try/catch reaches it, and takes the DAW down. So the handler
  // validates, and this is the proof the validation is real rather than intended.
  for (const [field, bad] of [['quantization', '3/5'], ['launchMode', 'continue_or_wishful']] as const) {
    let refused = '';
    try {
      await req('slot.launchWithOptions', {
        trackIndex: trackA,
        slotIndex: TAKE_B,
        quantization: field === 'quantization' ? bad : '1',
        launchMode: field === 'launchMode' ? bad : 'default',
      });
    } catch (e) {
      refused = e instanceof Error ? e.message : String(e);
    }
    check(`E20a-A0: an illegal ${field} is refused BEFORE Bitwig sees it, and the legal set is named`,
      refused.includes(bad) && refused.includes('not one of'), refused || '(the call was accepted!)');
  }

  /**
   * Start take A immediately, then wait until the playhead is deliberately
   * MID-BAR before firing anything.
   *
   * ⚠ Firing mid-bar is what makes both quantisation arms interpretable. A launch
   * fired near a bar line lands near a bar line whatever its quantisation, so the
   * `"none"` control could pass the `"1"` assertion by luck — and a control that
   * can accidentally agree with the experiment is not a control.
   */
  async function armMidBar(): Promise<PlayState> {
    await req('slot.launchWithOptions', {
      trackIndex: trackA, slotIndex: TAKE_A, quantization: 'none', launchMode: 'from_start',
    });
    const started = await pollUntil(async () => (await playState(trackA, TAKE_A)).isPlaying, 8000, 25);
    if (!started.ok) {
      console.log('REFUSING: take A never started, so nothing below would be measuring a SWITCH.');
      await stopAndExit(1);
    }
    const mid = await pollUntil(async () =>
      fromBar((await req('transport.status') as { playPosition: number }).playPosition) > 1.0, 12000, 20);
    if (!mid.ok) {
      console.log('REFUSING: never observed a mid-bar moment to fire from — the tempo may be so');
      console.log('fast that polling cannot see one, which makes every timing arm below noise.');
      await stopAndExit(1);
    }
    return playState(trackA, TAKE_A);
  }

  /**
   * Fire a launch of take B and report the first moment it is actually playing.
   *
   * ⚠ `queuedSeen` is the reason this polls at 20ms rather than waiting. A
   * quantised launch spends the rest of the bar QUEUED, and that pending state is
   * the difference between "the switch was scheduled" and "the call did nothing"
   * — two outcomes that are identical if all you look at is `isPlaying`.
   */
  async function launchB(quantization: string, launchMode: string): Promise<{
    requestedAtMs: number; requestedAt: number; queuedSeen: boolean;
    landed: PlayState | null; firstStep: number; aStepAtSwitch: number;
  }> {
    const before = await playState(trackA, TAKE_A);
    const ack = (await req('slot.launchWithOptions', {
      trackIndex: trackA, slotIndex: TAKE_B, quantization, launchMode,
    })) as { requestedAtMs: number };
    let queuedSeen = false;
    let landed: PlayState | null = null;
    let firstStep = -1;
    // ⚠ Take A's position sampled THROUGHOUT THE WAIT, not before it.
    //
    // A quantised launch waits out the rest of the bar, and take A keeps playing
    // for all of it — so a reading taken when the launch was REQUESTED is up to a
    // bar stale by the time the switch happens. The first version of this probe
    // compared take B's entry against exactly that stale number, which is a
    // comparison against where A *used to be*.
    let aStepAtSwitch = -1;
    const deadline = Date.now() + 45_000;
    while (Date.now() < deadline) {
      const s = await playState(trackA, TAKE_B);
      if (s.isPlaybackQueued) queuedSeen = true;
      if (s.isPlaying) {
        landed = s;
        // ⚠ Read the step IMMEDIATELY, in the next round trip. This is the whole
        // measurement: a `continue` that is sampled late looks like a `from_start`
        // that has been running a while, and at 120bpm a step is 125ms.
        firstStep = (await cursorPlay('1')).playingStep;
        break;
      }
      const a = await cursorPlay('0');
      if (a.playingStep >= 0) aStepAtSwitch = a.playingStep;
      await new Promise((r) => setTimeout(r, 20));
    }
    return {
      requestedAtMs: ack.requestedAtMs, requestedAt: before.playPosition,
      queuedSeen, landed, firstStep, aStepAtSwitch,
    };
  }

  // --- A1. quantisation "1" lands on the bar ---------------------------------
  console.log('\n-- A1/A2. is quantisation a per-call override?');
  await armMidBar();
  const bar = await launchB('1', 'default');
  check('E20a-A1a: a quantised launch is observably QUEUED before it plays', bar.queuedSeen);
  check('E20a-A1b: and it starts ON A BAR LINE, not where it was asked',
    bar.landed !== null && fromBar(bar.landed.playPosition) <= BAR_TOLERANCE,
    { firedAt: bar.requestedAt, startedAt: bar.landed?.playPosition,
      offBy: bar.landed ? fromBar(bar.landed.playPosition) : null, tolerance: BAR_TOLERANCE });
  const barDelayMs = bar.landed ? bar.landed.sampledAtMs - bar.requestedAtMs : -1;
  note(`"1": fired at beat ${bar.requestedAt.toFixed(2)}, started at ${bar.landed?.playPosition.toFixed(2)} (+${barDelayMs}ms)`);

  // --- A2. the control: "none" does NOT wait ---------------------------------
  //
  // ⚠⚠ Without this arm A1 measures nothing. Both are fired from mid-bar, so a
  // launch that ignores quantisation lands mid-bar and one that honours it does
  // not — the comparison is the finding, not either number.
  await armMidBar();
  const now = await launchB('none', 'from_start');
  const nowDelayMs = now.landed ? now.landed.sampledAtMs - now.requestedAtMs : -1;
  check('E20a-A2: the "none" control does NOT wait for the bar — fired mid-bar, starts mid-bar',
    now.landed !== null && fromBar(now.landed.playPosition) > BAR_TOLERANCE,
    { firedAt: now.requestedAt, startedAt: now.landed?.playPosition,
      offBy: now.landed ? fromBar(now.landed.playPosition) : null });
  check('E20a-A2b: and it lands sooner than the quantised one did',
    nowDelayMs >= 0 && barDelayMs > nowDelayMs, { quantised: barDelayMs, none: nowDelayMs });

  // --- A3. "8" is a coarser grid than "1" ------------------------------------
  //
  // ⚠ What is ASSERTED is that "8" waits materially longer than "1" and still
  // lands on a bar line. What is only RECORDED is where the 8-bar grid's phase
  // origin sits: nothing in the javadoc says whether a phrase is counted from the
  // timeline origin or from the last transport start, and asserting a guess would
  // manufacture a finding. Two granularities is what the claim needs.
  console.log('\n-- A3. is the override available at more than one granularity?');
  await armMidBar();
  const phrase = await launchB('8', 'default');
  const phraseDelayMs = phrase.landed ? phrase.landed.sampledAtMs - phrase.requestedAtMs : -1;
  check('E20a-A3a: an 8-bar launch also lands on a bar line',
    phrase.landed !== null && fromBar(phrase.landed.playPosition) <= BAR_TOLERANCE,
    { startedAt: phrase.landed?.playPosition });
  check('E20a-A3b: and it waits materially longer than the 1-bar launch did',
    phraseDelayMs > barDelayMs, { oneBar: barDelayMs, eightBar: phraseDelayMs });
  note(`"8": started at beat ${phrase.landed?.playPosition.toFixed(2)} (+${phraseDelayMs}ms), `
    + `bar ${phrase.landed ? Math.round(phrase.landed.playPosition / BEATS_PER_BAR) : '?'} — `
    + 'phrase phase RECORDED, not asserted');

  // --- A4/A5. ⚠⚠ WHERE DOES TAKE B COME IN? ----------------------------------
  //
  // ⚠⚠ **The first version of this section asked the wrong question, and the
  // answer it got is why this one is a matrix.** It asserted that
  // `continue_or_synced` brings take B in AT TAKE A'S POSITION — E18-VERDICT
  // §4a″-bis's reading of the javadoc — and measured B entering at step 15 while
  // A was at step 32, with the `from_start` control correctly at 0. So the
  // reading is wrong somewhere, and there are THREE candidate positions a
  // "continue" could mean, all of which land in the same neighbourhood if you
  // only take one sample:
  //
  //   1. take A's position          — "continue where the OUTGOING clip was"
  //   2. the transport grid          — "synced": clip position = transport mod
  //                                    clip length. ⚠ Indistinguishable from (1)
  //                                    whenever A is itself on the grid, which is
  //                                    the ordinary case and why this hid.
  //   3. take B's OWN last position  — "continue where THIS clip left off"
  //
  // ⚠ Nothing below asserts which one it is. Each trial computes all three
  // predictions and reports which the measurement is nearest, so the mechanism is
  // classified from the data instead of assumed by the person writing the check.
  // What IS asserted is the two things the design actually needs: the control
  // behaves, and the musically relevant case works.
  console.log('\n-- A4/A5. where does take B come in?');

  interface Trial {
    label: string;
    aStepAtSwitch: number;
    bFirstStep: number;
    transportAtSwitch: number;
    syncedPrediction: number;
    bPrimedTo: number | null;
  }

  /** Clip position implied by the global transport — the "synced" model. */
  const syncedStep = (position: number): number =>
    Math.round(((position % CLIP_BEATS) + CLIP_BEATS) % CLIP_BEATS * STEPS_PER_BEAT);

  /**
   * One switch, fully instrumented.
   *
   * `primeTo` runs take B first, so it HAS a previous position of its own — the
   * only way to tell candidate 3 from the other two. ⚠ Without it the trials are
   * order-dependent in a way that is easy to miss: B had already played three
   * times in A1–A3 before the original A4 ran, so "B's own last position" was
   * never controlled for.
   */
  async function trial(
    label: string, aOffGrid: boolean, bMode: string, primeTo: number | null = null,
    fireWindow: [number, number] = [CLIP_STEPS / 2, CLIP_STEPS],
  ): Promise<Trial> {
    let bPrimedTo: number | null = null;
    if (primeTo !== null) {
      await req('slot.launchWithOptions', {
        trackIndex: trackA, slotIndex: TAKE_B, quantization: 'none', launchMode: 'from_start',
      });
      const primed = await pollUntil(async () => (await cursorPlay('1')).playingStep >= primeTo, 30_000, 25);
      bPrimedTo = primed.ok ? (await cursorPlay('1')).playingStep : -1;
    }

    if (aOffGrid) {
      // ⚠ Fire A mid-bar and UNQUANTISED, which is the only way to make A's own
      // position disagree with the transport grid — and therefore the only
      // condition under which candidates 1 and 2 are distinguishable at all.
      await armMidBar();
    } else {
      await req('slot.launchWithOptions', {
        trackIndex: trackA, slotIndex: TAKE_A, quantization: '1', launchMode: 'synced',
      });
      const started = await pollUntil(async () => (await playState(trackA, TAKE_A)).isPlaying, 20_000, 25);
      if (!started.ok) {
        console.log('REFUSING: take A never started, so this trial would measure nothing.');
        await stopAndExit(1);
      }
    }

    // ⚠ Fire while take A is inside a WINDOW, not merely past a threshold.
    //
    // Past-the-halfway-mark is enough when A is off-grid. It is not enough when A
    // is ON the grid: there the quantised switch lands exactly where A's own loop
    // wraps, so "A's position", "the transport grid" and "the top of the clip" all
    // name the same step and the trial cannot distinguish anything — T6 of the
    // previous run measured A at step 63 handing over to B at step 0, with all
    // three predictions agreeing. Choosing a window whose next bar line falls
    // MID-CLIP is what keeps the on-grid case interpretable.
    const [lo, hi] = fireWindow;
    const ran = await pollUntil(async () => {
      const s = (await cursorPlay('0')).playingStep;
      return s >= lo && s < hi;
    }, 40_000, 25);
    if (!ran.ok) {
      console.log(`REFUSING: take A was never observed inside steps ${lo}..${hi}. If playingStep`);
      console.log('never moves, or never lands in the window, this measurement does not exist');
      console.log('and a PASS below would be meaningless.');
      await stopAndExit(1);
    }
    const switched = await launchB('1', bMode);
    const transportAtSwitch = switched.landed?.playPosition ?? -1;
    return {
      label,
      aStepAtSwitch: switched.aStepAtSwitch,
      bFirstStep: switched.firstStep,
      transportAtSwitch,
      syncedPrediction: transportAtSwitch < 0 ? -1 : syncedStep(transportAtSwitch),
      bPrimedTo,
    };
  }

  /** Which of the candidate meanings the measurement actually landed on. */
  function classify(t: Trial): { winner: string; distances: Record<string, number> } {
    const candidates: [string, number][] = [
      ['A\'s position (continue-from-outgoing)', t.aStepAtSwitch],
      ['the transport grid (synced)', t.syncedPrediction],
      ['the top of the clip (from_start)', 0],
    ];
    if (t.bPrimedTo !== null) candidates.push(['B\'s own last position (continue-own)', t.bPrimedTo]);
    const distances: Record<string, number> = {};
    let winner = '(indeterminate)';
    let best = Number.POSITIVE_INFINITY;
    for (const [name, value] of candidates) {
      // ⚠ The clip loops, so 63 and 0 are one step apart, not 63.
      const raw = Math.abs(t.bFirstStep - value);
      const d = Math.min(raw, CLIP_STEPS - raw);
      distances[name] = d;
      if (d < best) { best = d; winner = name; }
    }
    return { winner, distances };
  }

  const report = (t: Trial): void => {
    const { winner, distances } = classify(t);
    note(`${t.label}`);
    note(`   A at step ${t.aStepAtSwitch}, transport beat ${t.transportAtSwitch.toFixed(2)} `
      + `(synced would be step ${t.syncedPrediction})`
      + (t.bPrimedTo === null ? '' : `, B last left off at step ${t.bPrimedTo}`));
    note(`   => B came in at step ${t.bFirstStep} of ${CLIP_STEPS}  —  nearest: ${winner}`);
    note(`   distances: ${JSON.stringify(distances)}`);
  };

  // ⚠ THE REFERENCE TRIAL, and it runs first because everything else is compared
  // against the model it validates. If explicit `"synced"` does NOT land on the
  // transport-derived step, then `syncedPrediction` is the wrong arithmetic and
  // every classification below is measuring against a fiction.
  const tSynced = await trial('T1  A off-grid, B "synced"', true, 'synced');
  report(tSynced);
  const syncedOff = Math.abs(tSynced.bFirstStep - tSynced.syncedPrediction);
  check('E20a-A4a: explicit "synced" enters at the transport-derived position — the model holds',
    tSynced.syncedPrediction >= 0 && Math.min(syncedOff, CLIP_STEPS - syncedOff) <= STEPS_PER_BEAT,
    { entered: tSynced.bFirstStep, predicted: tSynced.syncedPrediction, toleranceSteps: STEPS_PER_BEAT });

  // ⚠ THE CONTROL. Same clips, same quantisation, same switch point, one word
  // different. If this also came in mid-clip, `playingStep` is measuring
  // something other than clip position and nothing here means anything.
  const tRestart = await trial('T2  A off-grid, B "from_start"', true, 'from_start');
  report(tRestart);
  check('E20a-A5: the "from_start" control comes in AT THE TOP',
    tRestart.bFirstStep >= 0 && tRestart.bFirstStep <= CLIP_STEPS / 8,
    { entered: tRestart.bFirstStep, of: CLIP_STEPS });

  // ⚠⚠ The three that decide what "continue" means. Recorded and classified;
  // NOT asserted, because the point of running them is that we do not know.
  const tContOff = await trial('T3  A off-grid, B "continue_or_synced"', true, 'continue_or_synced');
  report(tContOff);
  const tContFrom = await trial('T4  A off-grid, B "continue_or_from_start"', true, 'continue_or_from_start');
  report(tContFrom);
  // ⚠ B is primed EARLY, deliberately. The previous run primed it to step 48 while
  // take A ended up at 45 — two candidate answers three steps apart, which cannot
  // separate "continue where the OUTGOING clip was" from "continue where THIS clip
  // left off". A prime near the top of the clip puts the two predictions ~38 steps
  // apart, which is the whole reason the trial exists.
  const tPrimed = await trial(
    'T5  A off-grid, B "continue_or_synced", B PRIMED to step 8', true, 'continue_or_synced', 8);
  report(tPrimed);

  // ⚠⚠ THE ONE THE DESIGN ACTUALLY RESTS ON, and the reason the mechanism
  // question is secondary. E16m asked for a beat-aligned A/B in which the second
  // take renders THE SAME BAR differently instead of restarting the loop
  // (E18-VERDICT §4c). In real use take A is launched on the grid like everything
  // else, and on the grid candidates 1 and 2 COINCIDE — so the musical claim can
  // hold even if "continue" turns out to mean something else entirely.
  // ⚠ The fire window matters more here than anywhere else — see the note in
  // `trial`. Firing while A is in steps 16..29 puts the next bar line at step 32,
  // mid-clip, where "A's position" and "the top of the clip" are 32 steps apart
  // instead of coinciding.
  const tOnGrid = await trial('T6  A ON-GRID ("1"/synced), B "continue_or_synced"',
    false, 'continue_or_synced', null, [CLIP_STEPS / 4, CLIP_STEPS / 2 - 2]);
  report(tOnGrid);
  const gap = Math.abs(tOnGrid.bFirstStep - tOnGrid.aStepAtSwitch);
  check('E20a-A4: ⚠⚠ with take A on the grid, take B comes in WHERE TAKE A WAS — the same bar, '
    + 'rendered differently (E16m)',
    tOnGrid.aStepAtSwitch >= 0 && Math.min(gap, CLIP_STEPS - gap) <= STEPS_PER_BEAT,
    { takeAWasAtStep: tOnGrid.aStepAtSwitch, takeBCameInAtStep: tOnGrid.bFirstStep,
      toleranceSteps: STEPS_PER_BEAT, of: CLIP_STEPS });
  check('E20a-A4b: ...and that is not just "the top of the clip" wearing a disguise',
    tOnGrid.bFirstStep > CLIP_STEPS / 8,
    { entered: tOnGrid.bFirstStep, of: CLIP_STEPS });

  // --- A7. a launch is not a content edit ------------------------------------
  //
  // ⚠ Session 3's load-bearing negative, extended to launches and free to take
  // here. The concurrent-edit detector's entire value is that silence means
  // something: if launching fired occupancy events, an A/B session would report
  // itself as a stream of concurrent edits.
  await req('transport.stop');
  const after = await mark();
  const fired = after.contentEvents.filter((e) => e.seq > quietFrom.contentEpoch);
  check('E20a-A7: launching clips fires NO occupancy events — a launch is not an edit',
    fired.length === 0, fired);

  note(`left in place: takes on ${'gn-A'} rows ${TAKE_A} (pitch 60) and ${TAKE_B} (pitch 72), `
    + 'cursors 0 and 1 still pinned to them — PART B needs both.');
  console.log(failureCount() === 0 ? '\nE20a PART A: PASS' : `\nE20a PART A: ${failureCount()} FAILED`);
  await stopAndExit(failureCount() === 0 ? 0 : 1);
}

// --- PART B: ⚠ the operator, listening ---------------------------------------
//
// ⚠⚠ FOREGROUND-GATED. It needs a human at the keyboard with Bitwig audible and
// must never be started opportunistically. PART A settles what the numbers say;
// this settles the only question the numbers cannot reach — whether the switch
// SOUNDS like the A/B a musician asked for. E16m's complaint was a report by ear,
// and the answer to it deserves to be recorded the same way.
console.log('\n⚠ This arm MAKES NOISE and needs your ears. It launches clips on gn-A.');

// ⚠ Audibility is MEASURED before anything is asked, not assumed — the `e16v`
// discipline. A fixture track with no instrument on it is silent, and every
// answer given about a silent track would be a placebo.
await req('slot.launchWithOptions', {
  trackIndex: trackA, slotIndex: TAKE_A, quantization: 'none', launchMode: 'from_start',
});
await pollUntil(async () => (await playState(trackA, TAKE_A)).isPlaying, 8000, 25);
await req('branch.vu', { reset: true });
await new Promise((r) => setTimeout(r, 2000));
const vu = (await req('branch.vu')) as { tracks: { name: string; hold: number }[] };
const master = vu.tracks.find((t) => t.name === 'Master')?.hold ?? 0;
if (master <= 0) {
  await req('transport.stop');
  console.log('\nREFUSING: nothing is reaching the master, so the takes are inaudible and every');
  console.log('answer below would be about silence. Put an instrument on gn-A (any Polysynth');
  console.log('will do), check the track is not muted, and re-run.');
  await stopAndExit(2);
}
note(`master peak while take A plays: ${master} — the takes are audible`);

console.log('\nSwitching A -> B on the bar, picking up mid-phrase (continue_or_synced)...');
await pollUntil(async () =>
  fromBar((await req('transport.status') as { playPosition: number }).playPosition) > 1.0, 12000, 20);
await req('slot.launchWithOptions', {
  trackIndex: trackA, slotIndex: TAKE_B, quantization: '1', launchMode: 'continue_or_synced',
});
await pollUntil(async () => (await playState(trackA, TAKE_B)).isPlaying, 20_000, 25);
await new Promise((r) => setTimeout(r, 4000));

const onBar = await askYesNo('Did the switch land cleanly on a bar line, rather than whenever?');
check('E20a-B1: the quantised switch is heard as beat-aligned', onBar);
const midPhrase = await askYesNo(
  'Did the second take come in PART-WAY THROUGH, rather than restarting from the top?');
check('E20a-B2: "continue_or_synced" is heard as position-continuous', midPhrase);
const verdict = await ask(
  'In your own words: is this the A/B you asked for in E16m? (recorded verbatim)');
note(`operator, verbatim: "${verdict}"`);

await req('transport.stop');
console.log(failureCount() === 0 ? '\nE20a PART B: PASS' : `\nE20a PART B: ${failureCount()} FAILED`);
await stopAndExit(failureCount() === 0 ? 0 : 1);
