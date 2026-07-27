/**
 * E16 row E2 — does mute cut SENDS?
 *
 * The highest-value row left, because it does not ask whether A/B-by-mute is
 * *possible* (row E5 already showed the tracks coexist) but whether it is
 * audibly **correct**. A branch feeds every bus its source feeds, so while two
 * branches exist the reverb return hears BOTH of them; muting one is only a
 * valid A/B if the mute also takes that branch's send with it.
 *
 * ⚠ Pre- and post-fader sends are two different questions wearing one name. A
 * post-fader send is taken after the fader, so anything that zeroes the fader
 * path plausibly zeroes the send. A pre-fader send is taken BEFORE it, and
 * whether Bitwig's mute sits upstream or downstream of that tap is exactly what
 * is unmeasured. If it sits downstream, a muted branch is still feeding the
 * bus — the branch's own meter reads 0 and the mix is still wrong, which is the
 * worst possible shape for a bug because the obvious oracle agrees with you.
 *
 * ⚠ **Not by ear.** The oracle is the FX track's own VU (`branch.vu` hold),
 * read while the sender is muted. Ears cannot separate "the reverb return is
 * carrying one branch" from "…two", and a decaying tail confounds the moment
 * of the mute; a peak-hold over a fixed window does neither.
 *
 * ⚠ **`addVuMeterObserver` is PRE-MUTE — measured, and it ate this probe's
 * first run.** A muted track's own meter kept reading 55-58 while the master
 * bus read 2. So a sender's own level says NOTHING about whether it is
 * audible, and every verdict here reads the FX return and the MASTER instead,
 * which sit downstream of the mute. (`isActivated(false)` DOES read 0 on the
 * track meter, so mute and deactivate are on opposite sides of the tap.)
 *
 * ⚠ **Tails, the second thing that ate run one.** A 400ms settle after a mute
 * measures the notes that were still ringing when it landed: the window right
 * after a mute read FX 16 / master 26, and the very next window, same state,
 * read FX 1 / master 2. Every state change here is followed by a settle long
 * enough for the tail to clear BEFORE the peak-hold is armed.
 *
 * **Every muted reading is paired with two controls.** Trap 6 from rows A–C:
 * two silences must never make a green.
 *   1. the same send mode, unmuted — proves the return can hear this send
 *   2. ⚠ the sender's own PRE-MUTE meter, read during the muted window — proves
 *      the clip is still playing, so a silent return means the send was cut
 *      rather than that the music simply stopped. The confound in (the) oracle
 *      turns out to be the perfect instrument for this, since it is the one
 *      meter that reports a muted track's undiminished output.
 *
 * Requires `gn-E16` (build it with probe:e16b) and an FX track to send to.
 * ⚠ This makes noise. Restores gn-E16's send state and deletes its own branch.
 */
import { client, check, note, failureCount, pollUntil } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Long enough for a launched loop to come round again, so a peak-hold is a fair sample. */
const WINDOW_MS = 3000;
/** ⚠ Tail clearance BEFORE arming. Measured need: at 800ms a mute still read 26 on master. */
const SETTLE_MS = 3000;
/** Hot enough that the return is unambiguous, short of clipping it. */
const SEND_VALUE = 0.7;
/**
 * ⚠ One step of slack above the floor, and it is EARNED, not chosen to make a
 * check pass. A mute applied while a note is ringing leaves a one-step residue
 * on the transition; §2b's sweep shows that residue does not scale with the
 * send that would have to feed it, and reads a flat 0 once the state is stable.
 * Without the sweep this constant would be exactly the kind of fudge that turns
 * an unmeasured row green, so it must not be widened without re-running it.
 */
const CUT_EPSILON = 1;

type TrackRow = { index: number; name: string; channelId: string; type: string };
type VuRow = { channelId: string; name: string; now: number; hold: number; mute: boolean };
type SendRow = { index: number; name: string; value: number; enabled: boolean; preFader: boolean; sendMode?: string };
type Mixer = { index: number; name: string; channelId: string; mute: boolean; sends: SendRow[] };

const list = async () => (await req('track.list')) as { tracks: TrackRow[]; count: number };

/**
 * Bank indices move under us — a duplicate lands adjacent and pushes the FX and
 * Master rows down one. Everything here is addressed by `channelId` and
 * re-resolved at the point of use (standing rule 2).
 */
const indexOf = async (channelId: string): Promise<number> => {
  const r = (await req('track.resolveByChannelId', { channelId })) as { found: boolean; index?: number };
  if (!r.found || r.index === undefined) throw new Error(`track ${channelId} no longer resolves`);
  return r.index;
};
const mixerOf = async (channelId: string) =>
  (await req('branch.mixer', { trackIndex: await indexOf(channelId) })) as Mixer;
const setMute = async (channelId: string, mute: boolean) =>
  req('branch.setMixer', { trackIndex: await indexOf(channelId), mute });

/** Arm the peak-hold, let the music run, report what each track reached. */
const listen = async (ms = WINDOW_MS): Promise<Map<string, VuRow>> => {
  await req('branch.vu', { reset: true });
  await wait(ms);
  const vu = (await req('branch.vu')) as { tracks: VuRow[] };
  return new Map(vu.tracks.map((t) => [t.channelId, t]));
};

await client.connect();
console.log('connected\n');

// ---- 0. the rig this row needs -------------------------------------------
const all = await list();
const fixture = all.tracks.find((t) => t.name === 'gn-E16');
const fx = all.tracks.find((t) => t.type === 'Effect');
const master = all.tracks.find((t) => t.type === 'Master');
if (!fixture) {
  console.log('REFUSING: gn-E16 not found — run `npm run probe:e16b` first to build it.');
  process.exit(1);
}
if (!fx || !master) {
  console.log('REFUSING: this project needs an Effect track and a Master — E2 has no bus to measure.');
  process.exit(1);
}
const SRC = fixture.channelId;
const FX = fx.channelId;
const MASTER = master.channelId;
note(`sender: ${fixture.name}   return: ${fx.name}   ground truth: ${master.name}`);

// ⚠ The write path for sendMode and the readback both go through the same
// SendBank handle, so this readback is NOT standing-rule-3a independent. The
// row's actual verdict does not rest on it: the verdict is the FX track's VU,
// which is a different subsystem entirely. The readback is here to catch a
// silent no-op in the SETUP (E4c), not to prove the finding.
const before = await mixerOf(SRC);
const send0 = before.sends[0];
if (!send0) {
  console.log('REFUSING: gn-E16 has no send 0 — nothing to measure.');
  process.exit(1);
}
const restore = { value: send0.value, enabled: send0.enabled, sendMode: send0.sendMode ?? 'AUTO' };
note(`gn-E16 send 0 was ${JSON.stringify(restore)} — will be restored`);

if (send0.sendMode === undefined) {
  console.log('');
  console.log('REFUSING: `branch.mixer` returned no `sendMode` field, so Bitwig is running an');
  console.log('OLDER extension than this checkout. Reload the ghostnote controller in Bitwig');
  console.log('(Dashboard -> Settings -> Controllers: toggle it off and on) and re-run.');
  process.exit(1);
}

// ---- 1. make the send audible on the return ------------------------------
await req('branch.setMixer', {
  trackIndex: await indexOf(SRC), sendIndex: 0, sendValue: SEND_VALUE, sendEnabled: true,
});
await setMute(SRC, false);

/**
 * Calibrate what "silent" is before claiming anything reached it.
 *
 * ⚠ A stopped transport is not instantly a silent one — the first run's
 * "nothing playing" window still read 9 on both the return and the master,
 * which was the previous phase's tail. So: stop, let it decay, and only then
 * take the floor that every later verdict is compared against.
 */
await req('transport.stop');
await wait(SETTLE_MS);
const stoppedVu = await listen();
note(`floor, transport STOPPED: FX ${stoppedVu.get(FX)?.hold}, master ${stoppedVu.get(MASTER)?.hold}`);

await req('slot.launch', { trackIndex: await indexOf(SRC), slotIndex: 0 });
await wait(2000);

/**
 * ⚠ The floor that actually matters, and the reason the first corrected run
 * could not call its own result.
 *
 * A stopped transport reads a clean 0, but the muted windows read 1-2 — and
 * 1-2 out of 128 is either a real send leak or the meter's floor with the
 * engine running. Those are opposite findings, so the difference has to be
 * measured rather than argued: roll the transport with the clip playing, the
 * sender MUTED and its send DISABLED. Whatever the return and master read then
 * cannot be our send, so it is the number "cut" has to be judged against.
 */
await req('branch.setMixer', {
  trackIndex: await indexOf(SRC), sendIndex: 0, sendEnabled: false,
});
await setMute(SRC, true);
await wait(SETTLE_MS);
const rollingVu = await listen();
const FLOOR = Math.max(rollingVu.get(FX)?.hold ?? 0, rollingVu.get(MASTER)?.hold ?? 0);
note(`floor, transport ROLLING + sender muted + send OFF: FX ${rollingVu.get(FX)?.hold}, `
  + `master ${rollingVu.get(MASTER)?.hold} (sender's pre-mute meter ${rollingVu.get(SRC)?.hold}) `
  + `— "cut" means <= ${FLOOR}`);
check('the rolling floor is a real control: the clip is playing through it',
  (rollingVu.get(SRC)?.hold ?? 0) > 0, { senderPreMuteMeter: rollingVu.get(SRC)?.hold });

await req('branch.setMixer', {
  trackIndex: await indexOf(SRC), sendIndex: 0, sendValue: SEND_VALUE, sendEnabled: true,
});
await setMute(SRC, false);
await wait(1000);

const armed = await mixerOf(SRC);
check('setup: send 0 is enabled and open (a closed send would measure nothing)',
  armed.sends[0]!.enabled && armed.sends[0]!.value > 0.5, { send: armed.sends[0] });

/**
 * One send mode, measured twice: unmuted (the control) then muted (the test).
 *
 * `senders` is every track feeding the bus, so the branch phase can mute one of
 * two and still see what the other contributes.
 */
interface ModeResult {
  control: number; muted: number; masterControl: number; masterMuted: number;
  /** ⚠ PRE-mute meter — proves the clip kept playing, NOT that anything was audible. */
  stillPlaying: number;
}
async function measureMode(
  mode: 'POST' | 'PRE',
  senders: string[],
  muteThese: string[],
  label: string,
): Promise<ModeResult> {
  for (const id of senders) {
    await req('branch.setMixer', { trackIndex: await indexOf(id), sendIndex: 0, sendMode: mode });
  }
  await wait(400);

  const conf = await mixerOf(senders[0]!);
  const resolvedPreFader = conf.sends[0]!.preFader;
  check(`${label}: sendMode=${mode} landed (setting reads back, and Bitwig RESOLVED it)`,
    conf.sends[0]!.sendMode === mode && resolvedPreFader === (mode === 'PRE'),
    { asked: mode, sendMode: conf.sends[0]!.sendMode, preFader: resolvedPreFader });

  for (const id of muteThese) await setMute(id, false);
  await wait(SETTLE_MS);
  const controlVu = await listen();

  for (const id of muteThese) await setMute(id, true);
  await wait(SETTLE_MS); // ⚠ let the tail clear, or this measures the last note, not the mute
  const mutedVu = await listen();

  for (const id of muteThese) await setMute(id, false);
  return {
    control: controlVu.get(FX)?.hold ?? 0,
    muted: mutedVu.get(FX)?.hold ?? 0,
    masterControl: controlVu.get(MASTER)?.hold ?? 0,
    masterMuted: mutedVu.get(MASTER)?.hold ?? 0,
    stillPlaying: muteThese.reduce((m, id) => Math.max(m, mutedVu.get(id)?.hold ?? 0), 0),
  };
}

// ---- 2. E2 proper: one sender, each send mode ----------------------------
console.log('\n-- E2: mute the SENDER, watch the RETURN');
const results: Record<string, ModeResult> = {};
for (const mode of ['POST', 'PRE'] as const) {
  const r = await measureMode(mode, [SRC], [SRC], `E2/${mode}`);
  results[mode] = r;
  note(`${mode}: FX return ${r.control} -> ${r.muted} muted; master ${r.masterControl} -> `
    + `${r.masterMuted}; sender's PRE-MUTE meter while muted: ${r.stillPlaying}`);

  // Control 1: the return can hear this send at all. Allowed to fail the row alone.
  const audible = r.control > FLOOR;
  check(`E2/${mode} CONTROL 1 — the return actually hears the send when unmuted`,
    audible, { fxHoldUnmuted: r.control, floor: FLOOR });
  // Control 2: the music did not simply stop. Without this a silent return is
  // ambiguous between "mute cut the send" and "nothing was playing" (trap 6).
  const playing = r.stillPlaying > FLOOR;
  check(`E2/${mode} CONTROL 2 — the clip was STILL PLAYING through the muted window`,
    playing, { senderPreMuteMeter: r.stillPlaying,
      why: 'pre-mute meter: a muted track still reports its undiminished output' });

  if (!audible || !playing) {
    check(`E2/${mode} — UNMEASURABLE, not green: a control failed`, false,
      { note: 'two silences must not make a green (rows A-C trap 6)' });
    continue;
  }
  check(`E2/${mode}: muting the sender CUTS its ${mode}-fader send to the return`,
    r.muted <= FLOOR + CUT_EPSILON,
    { fxHoldUnmuted: r.control, fxHoldMuted: r.muted, floor: FLOOR, epsilon: CUT_EPSILON });
}

// ⚠ The shape that would survive a by-ear check and a naive meter check alike:
// the branch looks silent everywhere the human would look, and still feeds the bus.
for (const mode of ['POST', 'PRE'] as const) {
  const r = results[mode];
  if (r && r.control > FLOOR && r.muted > FLOOR + CUT_EPSILON) {
    check(`⚠ E2 HAZARD (${mode}): a muted branch is still feeding the return`, false, {
      fxWhileMuted: r.muted, floor: FLOOR, masterWhileMuted: r.masterMuted,
      meaning: 'A/B by mute is wrong in the WET path: the branch keeps its reverb contribution',
    });
  }
}

// ---- 2b. the decisive form of the row ------------------------------------
/**
 * ⚠ **This sweep is row E2's primary evidence; everything above corroborates it.**
 *
 * The threshold runs left a residual that could not be adjudicated by argument:
 * muted-POST settled on the floor (1) and muted-PRE one step above it (2),
 * reproducibly, 4 readings out of 4. One step out of 128 is either a real
 * pre-fader leak or the meter's bottom, and those are opposite findings.
 *
 * A leak has to SCALE with the send that feeds it. So: hold the sender muted
 * and sweep its send across the full range in both modes. A leak climbs; an
 * artifact does not move. The unmuted positive control at the end proves the
 * sweep's axis is live — that this send level really does drive this return —
 * so a flat muted line cannot be dismissed as a dead knob.
 */
console.log('\n-- E2 decisive: hold the sender MUTED, sweep the send across its range');
const sweep: { mode: string; value: number; fx: number; master: number; src: number }[] = [];
await setMute(SRC, true);
await wait(SETTLE_MS);
for (const mode of ['POST', 'PRE'] as const) {
  for (const value of [0, 0.5, 1.0]) {
    await req('branch.setMixer', {
      trackIndex: await indexOf(SRC), sendIndex: 0, sendValue: value, sendEnabled: true, sendMode: mode,
    });
    await wait(SETTLE_MS);
    const v = await listen();
    sweep.push({ mode, value, fx: v.get(FX)?.hold ?? 0, master: v.get(MASTER)?.hold ?? 0,
      src: v.get(SRC)?.hold ?? 0 });
  }
}
for (const s of sweep) {
  note(`muted, ${s.mode} @ ${s.value.toFixed(2)}: FX ${s.fx}, master ${s.master} `
    + `(clip still playing: ${s.src})`);
}
check('E2 sweep CONTROL — the clip played through every muted reading',
  sweep.every((s) => s.src > FLOOR), { preMuteMeters: sweep.map((s) => s.src) });

await setMute(SRC, false);
await wait(SETTLE_MS);
const posLow = await (async () => {
  await req('branch.setMixer', {
    trackIndex: await indexOf(SRC), sendIndex: 0, sendValue: 0.25, sendEnabled: true, sendMode: 'PRE' });
  await wait(SETTLE_MS); return (await listen()).get(FX)?.hold ?? 0;
})();
const posHigh = await (async () => {
  await req('branch.setMixer', {
    trackIndex: await indexOf(SRC), sendIndex: 0, sendValue: 1.0, sendEnabled: true, sendMode: 'PRE' });
  await wait(SETTLE_MS); return (await listen()).get(FX)?.hold ?? 0;
})();
note(`positive control, UNMUTED: PRE @0.25 -> FX ${posLow}, PRE @1.00 -> FX ${posHigh}`);
check('E2 sweep POSITIVE CONTROL — send level really does drive this return, '
  + 'so a flat muted line is not a dead knob', posHigh > posLow && posLow > FLOOR,
  { at025: posLow, at100: posHigh });

check('⚠ E2 VERDICT: mute CUTS the send at every level, in BOTH pre- and post-fader modes '
  + '— A/B by mute is audibly correct in the wet path',
  sweep.every((s) => s.fx <= FLOOR && s.master <= FLOOR),
  { sweep: sweep.map((s) => `${s.mode}@${s.value}=${s.fx}`), floor: FLOOR });

await setMute(SRC, false);
await req('branch.setMixer', {
  trackIndex: await indexOf(SRC), sendIndex: 0, sendValue: SEND_VALUE, sendEnabled: true });

// ---- 3. the real scenario: a BRANCH also feeding the bus ------------------
console.log('\n-- E2 in the branch case: does the return double, and does muting the branch undo it?');
const pre = await list();
const preIds = new Set(pre.tracks.map((t) => t.channelId));
await req('branch.duplicateTrack', {
  trackIndex: await indexOf(SRC), route: 'hostDuplicate', undoName: 'ghostnote E16 E2 branch',
});
const appeared = await pollUntil(async () => (await list()).count === pre.count + 1, 20000, 50);
check('a branch to measure with was created', appeared.ok, { ms: appeared.ms });

let branchId: string | undefined;
if (appeared.ok) {
  branchId = (await list()).tracks.find((t) => !preIds.has(t.channelId))?.channelId;
}

if (branchId) {
  await req('branch.setMixer', {
    trackIndex: await indexOf(branchId), sendIndex: 0, sendValue: SEND_VALUE, sendEnabled: true,
  });
  await req('slot.launch', { trackIndex: await indexOf(branchId), slotIndex: 0 });
  await wait(2000);

  /**
   * ⚠ "Does the return DOUBLE with two branches" is not asked here, because
   * this instrument cannot answer it. Measured: the same condition (source
   * alone, sending) read 52 in one phase and 40 in another — a ±12 swing on a
   * 0-127 scale, from a peak-hold over a 3-note loop whose two copies were
   * launched independently and are not phase-aligned. The branch's contribution
   * is smaller than that variance, so any "it doubled" or "it did not" from
   * these numbers would be reading noise. Row A-C's honesty rule applies to
   * over-claiming as much as to under-claiming: the level question is left
   * UNMEASURED and flagged for a better instrument.
   *
   * What IS answerable is the binary one, and it is the one A/B depends on:
   * with ONLY the branch feeding the bus, does muting the branch cut it? That
   * is the same clean shape the single-sender phase already proved it can
   * resolve, so the branch is isolated rather than summed.
   */
  note('level/"doubling" question: NOT MEASURED — see the comment; peak-hold variance (±12) '
    + 'exceeds the effect');

  for (const mode of ['POST', 'PRE'] as const) {
    await setMute(SRC, true); // isolate: the branch is the only thing feeding the bus
    await wait(SETTLE_MS);
    const r = await measureMode(mode, [branchId], [branchId], `branch/${mode}`);
    note(`${mode} (branch isolated, source muted): FX ${r.control} -> ${r.muted} with the `
      + `branch muted; branch's PRE-MUTE meter while muted: ${r.stillPlaying} (floor ${FLOOR})`);

    const audible = r.control > FLOOR;
    const playing = r.stillPlaying > FLOOR;
    check(`branch/${mode} CONTROL 1 — the BRANCH's own send reaches the return`,
      audible, { fxWithBranchOnly: r.control, floor: FLOOR });
    check(`branch/${mode} CONTROL 2 — the branch's clip played through the muted window`,
      playing, { branchPreMuteMeter: r.stillPlaying });
    if (!audible || !playing) {
      check(`branch/${mode} — UNMEASURABLE, not green: a control failed`, false, {});
      continue;
    }
    check(`branch/${mode}: muting the BRANCH cuts its ${mode}-fader send — `
      + 'A/B by mute is correct in the wet path',
      r.muted <= FLOOR + CUT_EPSILON,
      { fxBranchSending: r.control, fxBranchMuted: r.muted, floor: FLOOR, epsilon: CUT_EPSILON });
  }
  await setMute(SRC, false);
}

// ---- 4. put the project back ---------------------------------------------
console.log('\n-- cleanup');
if (branchId) {
  const n = (await list()).count;
  await req('track.delete', { trackIndex: await indexOf(branchId) });
  const gone = await pollUntil(async () => (await list()).count === n - 1, 8000, 100);
  check('the branch this probe made was deleted', gone.ok);
}
await req('transport.stop');
await setMute(SRC, false);
await req('branch.setMixer', {
  trackIndex: await indexOf(SRC), sendIndex: 0,
  sendValue: restore.value, sendEnabled: restore.enabled, sendMode: restore.sendMode,
});
const after = await mixerOf(SRC);
check('gn-E16 survived with its send state restored', after.sends[0]!.value === restore.value, {
  restored: after.sends[0], wanted: restore,
});

console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} FAILURES`);
process.exit(failureCount() === 0 ? 0 : 1);
