/**
 * E16 row M — does muting a GROUP silence its children, and does it take their
 * SENDS with it?
 *
 * ⚠ **The ergonomic claim the track-native model leans on hardest, and the one
 * thing E16k could not measure.** Under the chosen model a lineage is a group of
 * duplicated tracks and A/B is mute (E1/E2 ●) — but every one of those results is
 * about muting a *leaf* track. "Mute the lineage to hear it against the rest of
 * the arrangement" is a different act on a different object, and nobody has
 * pressed it. If a group's mute does not reach its children, lineage-level A/B
 * does not exist and the model's coarse gesture is per-track only.
 *
 * The row is in two halves and the second is the one that can go wrong quietly:
 *
 *   M1  does master fall silent when the GROUP is muted and the child is not?
 *   M2  ⚠ does the child's SEND to an FX return fall silent too?
 *
 * **M2 is the group-level restatement of row E2**, and it does not inherit E2's
 * answer. E2 measured that a track's OWN mute cuts its OWN sends, pre- and
 * post-fader alike. A child's send is a different topology question: the child's
 * main output flows into the group, but its send is tapped on the child and
 * routed straight to the return, so a mute applied at the *parent* may sit
 * entirely downstream of that tap. If it does, muting a lineage silences its dry
 * path and leaves its reverb feeding the bus — the branch is still in the mix,
 * the mixer shows it muted, and the obvious oracle agrees with you. That is the
 * worst available shape for a bug and it is exactly what this half is for.
 *
 * ### The instrument, and why it is not the obvious one
 *
 * ⚠ **`addVuMeterObserver` is PRE-MUTE** (rows D–G, trap 1): a muted track's own
 * meter goes on reporting 55-58 while master reads 2. Here that is worse than it
 * was for E2, because the mute under test is on a *different track* than the one
 * being metered — the child's meter taps the child's output, upstream of the
 * parent entirely, so it should read undiminished no matter how this row comes
 * out. **A child's own meter therefore cannot tell you whether its lineage is
 * audible**, and this probe reads MASTER and the FX RETURN for every verdict.
 *
 * That same confound is the perfect control, exactly as it was in E2: the
 * child's pre-mute meter, read during a muted window, proves the clip is still
 * playing — so a silent master means the group cut it, rather than that the
 * music simply stopped between notes.
 *
 * ⚠ **Tails.** A short settle after a mute measures the notes that were still
 * ringing when it landed (rows D–G, trap 3: 16/26 in one window, 1/2 in the
 * next, identical state). Every state change here is followed by a settle long
 * enough to clear before any peak-hold is armed.
 *
 * ### ⚠ What this probe asserts, and what it only reports
 *
 * The first version of `e16j` failed its own run by asserting "the control did
 * NOT fire, therefore this really was backgrounded" — the hypothesis written as
 * a self-validation, which reported a red X against a true result. The checks
 * below assert only things that are true **whichever way the world is**: that
 * the floor is a real floor, that the positive control is live, that the clip
 * kept playing. **The row's answer is COMPUTED and REPORTED, never asserted** —
 * if group mute turns out not to reach children, this probe passes and says so.
 *
 * ⚠ Needs a human at the keyboard and a monitor they can hear. `ask()` refuses
 * on a non-TTY, so run it directly:  npm run probe:e16m
 *
 * Requires `gn-E16` inside a Group, an Effect track and a Master. Restores the
 * group's mute/fold state, the child's send, and the bank's content filter.
 */
import { client, check, note, ask, askYesNo, failureCount, pollUntil } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Long enough for a launched loop to come round, so a peak-hold is a fair sample. */
const WINDOW_MS = 3000;
/** ⚠ Tail clearance BEFORE arming. Rows D–G measured that 800ms is not enough. */
const SETTLE_MS = 3000;
/** Hot enough that the return is unambiguous, short of clipping it (E2's value). */
const SEND_VALUE = 0.7;
/**
 * ⚠ Inherited from E2, where it was EARNED by a sweep rather than chosen: a mute
 * applied while a note rings leaves a one-step residue on the transition, and
 * reads a flat 0 once the state is stable. It must not be widened without
 * re-running that sweep — a wider epsilon is how an unmeasured row goes green.
 */
const CUT_EPSILON = 1;
/** Alternated repetitions of the A/B, so material drift cannot pose as the effect. */
const REPS = 3;
const TRIALS = 6;
const JUDGE_MS = 2500;

type TrackRow = { index: number; name: string; channelId: string; type: string; position: number };
type VuRow = { channelId: string; name: string; now: number; hold: number; mute: boolean; identityChanged: boolean };
type SendRow = { index: number; name: string; value: number; enabled: boolean; preFader: boolean; sendMode: string };
type Mixer = {
  index: number; name: string; channelId: string; mute: boolean; isGroup: boolean;
  isGroupExpanded: boolean; sends: SendRow[];
};

const list = async () => (await req('track.list')) as { tracks: TrackRow[]; count: number; itemCount: number };

/**
 * Bank indices move under folding and under any structural op, so nothing here
 * holds one across a call — every index is re-resolved from `channelId` at the
 * point of use (standing rule 2 / D6).
 */
const indexOf = async (channelId: string): Promise<number> => {
  const r = (await req('track.resolveByChannelId', { channelId })) as { found: boolean; index?: number };
  if (!r.found || r.index === undefined) throw new Error(`track ${channelId} no longer resolves`);
  return r.index;
};
const resolves = async (channelId: string): Promise<boolean> =>
  ((await req('track.resolveByChannelId', { channelId })) as { found: boolean }).found;
const mixerOf = async (channelId: string) =>
  (await req('branch.mixer', { trackIndex: await indexOf(channelId) })) as Mixer;
const setMute = async (channelId: string, mute: boolean) =>
  req('branch.setMixer', { trackIndex: await indexOf(channelId), mute });
const setFold = async (channelId: string, expanded: boolean) =>
  req('branch.setMixer', { trackIndex: await indexOf(channelId), groupExpanded: expanded });

/** Arm the peak-hold, let the music run, report what each track reached. */
const listen = async (ms = WINDOW_MS): Promise<Map<string, VuRow>> => {
  await req('branch.vu', { reset: true });
  await wait(ms);
  const vu = (await req('branch.vu')) as { tracks: VuRow[] };
  return new Map(vu.tracks.map((t) => [t.channelId, t]));
};

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;

await client.connect();
console.log('connected\n');

// ==========================================================================
// 0. the rig this row needs
// ==========================================================================
const all = await list();
const fixture = all.tracks.find((t) => t.name === 'gn-E16');
const fx = all.tracks.find((t) => t.type === 'Effect');
const master = all.tracks.find((t) => t.type === 'Master');
if (!fixture) {
  console.log('REFUSING: gn-E16 not found — run `npm run probe:e16b` first to build it.');
  process.exit(1);
}
if (!fx || !master) {
  console.log('REFUSING: this row needs an Effect track and a Master — M2 has no bus to measure.');
  process.exit(1);
}

/**
 * The group is found as the nearest Group row ABOVE the fixture, and then
 * PROVED to be its parent in §1 rather than trusted. Adjacency in a flat bank is
 * a hint, not a parentage claim: `CursorTrack.position()` and the flat bank's
 * `Track.position()` are different coordinate systems and agree only for tracks
 * ahead of every populated group (E16j, incidental 1).
 */
const groupRow = [...all.tracks]
  .filter((t) => t.type === 'Group' && t.position < fixture.position)
  .sort((a, b) => b.position - a.position)[0];
if (!groupRow) {
  console.log('REFUSING: no Group track above gn-E16 — this row needs a lineage container.');
  console.log('  Groups cannot be created by the typed API (e16i: createParentTrack is init-only),');
  console.log('  so make one by hand: select gn-E16 in Bitwig and press ⌘G.');
  process.exit(1);
}

const SRC = fixture.channelId;
const GROUP = groupRow.channelId;
const FX = fx.channelId;
const MASTER = master.channelId;
note(`child: ${fixture.name}   container: ${groupRow.name}   return: ${fx.name}   truth: ${master.name}`);

const groupBefore = await mixerOf(GROUP);
const childBefore = await mixerOf(SRC);
const sendBefore = childBefore.sends[0];
note(`restoring afterwards: group mute=${groupBefore.mute} expanded=${groupBefore.isGroupExpanded}, `
  + `child mute=${childBefore.mute}, send=${JSON.stringify(sendBefore)}`);

// ==========================================================================
// 1. PROVE the parentage, before measuring anything about it
// ==========================================================================
/**
 * ⚠ This row's entire meaning depends on gn-E16 really being a child of that
 * group, and nothing in `track.list` says so — it is a FLAT bank, so a child and
 * a sibling look identical. E16k had the same problem and answered it with the
 * collapse oracle, which is the only structural readback available: under the
 * default filter, folding a group removes its children from the bank entirely
 * (rows D–G), so a track that VANISHES when this group folds is inside it.
 *
 * Done first, with the transport stopped and before any hold is armed, because
 * it changes bank membership.
 */
console.log('\n-- 1. parentage, by the collapse oracle (silent)');
await req('branch.contentFilter', { filter: 'ALL_VISIBLE_CHANNELS' });
await setFold(GROUP, false);
const foldedGone = await pollUntil(async () => !(await resolves(SRC)), 5000, 100);
const childVisibleWhileFolded = await resolves(SRC);
await setFold(GROUP, true);
await pollUntil(async () => await resolves(SRC), 5000, 100);

check(`${fixture.name} is INSIDE ${groupRow.name} — it left the bank when the group folded`,
  foldedGone.ok && !childVisibleWhileFolded,
  { vanishedAfterMs: foldedGone.ms,
    why: 'a fold hides only children; a sibling would have stayed resolvable' });
if (!foldedGone.ok) {
  console.log('\nREFUSING to go on: the fold did not hide it, so it is not a child of this group');
  console.log('and every reading below would be about two unrelated tracks.');
  // ⚠ Restore the fold before leaving. An early exit that leaves the human's
  // group collapsed is a probe editing the project on its way out of the door.
  await setFold(GROUP, groupBefore.isGroupExpanded);
  await req('branch.contentFilter', { filter: 'ALL_VISIBLE_CHANNELS' });
  process.exit(1);
}
check(`${fixture.name} came back when the group was expanded again`, await resolves(SRC), {});

/**
 * ⚠ ALL_CHANNELS for the measurement, and it is not a nicety. Under the default
 * filter a folded child is absent from the bank — `found:false`, byte-identical
 * to a deleted track — and `branch.vu` iterates that same bank, so a group that
 * folded mid-run would take the child's meter row with it and the row would read
 * "silent" for the wrong reason. `setContentFilter` is a genuine RUNTIME setter
 * (rows D–G, trap 6), which is what makes this possible at all.
 */
const filterAck = (await req('branch.contentFilter', { filter: 'ALL_CHANNELS' })) as
  { called: boolean; error?: string };
check('the bank is on ALL_CHANNELS, so a fold cannot silently remove the child from the oracle',
  filterAck.called === true, filterAck);

// ==========================================================================
// 2. calibrate the instrument — a floor, and a positive control
// ==========================================================================
console.log('\n⚠ This probe MAKES NOISE from here on. Have Bitwig audible.');
await ask('ready? (press Enter)');

await setMute(GROUP, false);
await setMute(SRC, false);
await req('slot.launch', { trackIndex: await indexOf(SRC), slotIndex: 0 });
await wait(2000);

console.log('\n-- 2. calibration');

// The floor: the child muted by its OWN mute, which E1/E2 already proved works.
await setMute(SRC, true);
await wait(SETTLE_MS);
const floorVu = await listen();
const FLOOR = floorVu.get(MASTER)?.hold ?? 0;
const floorChildOwn = floorVu.get(SRC)?.hold ?? 0;
note(`master floor, child muted by its own mute: ${FLOOR}  `
  + `(child's own PRE-MUTE meter meanwhile: ${floorChildOwn})`);
check('FLOOR CONTROL — the clip really was playing behind that silence, so the floor is a '
  + 'floor and not a gap in the music',
  floorChildOwn > 0, { childPreMuteMeter: floorChildOwn,
    why: 'the pre-mute meter is the one instrument that reports a muted track undiminished' });

// The positive control: everything open, the child audible THROUGH the group.
await setMute(SRC, false);
await wait(SETTLE_MS);
const openVu = await listen();
const OPEN = openVu.get(MASTER)?.hold ?? 0;
note(`master with everything open (the child sounding through the group): ${OPEN}`);
check('POSITIVE CONTROL — the child is audible on master through its group, so this rig can '
  + 'tell sound from silence at all',
  OPEN > FLOOR + CUT_EPSILON, { open: OPEN, floor: FLOOR });

// ==========================================================================
// 3. M1 — mute the GROUP, with the child left unmuted
// ==========================================================================
console.log('\n-- 3. M1: muting the GROUP (the child stays unmuted throughout)');

const groupMuted: number[] = [];
const groupOpen: number[] = [];
const childOwnWhileGroupMuted: number[] = [];
let childMuteFlagChanged = false;

for (let i = 0; i < REPS; i++) {
  // Alternated rather than blocked: a drift in the material cannot then
  // masquerade as the group's contribution (the discipline row E5 used).
  await setMute(GROUP, true);
  await wait(SETTLE_MS);
  const m = await listen();
  groupMuted.push(m.get(MASTER)?.hold ?? 0);
  childOwnWhileGroupMuted.push(m.get(SRC)?.hold ?? 0);
  if (m.get(SRC)?.mute === true) childMuteFlagChanged = true;

  await setMute(GROUP, false);
  await wait(SETTLE_MS);
  const o = await listen();
  groupOpen.push(o.get(MASTER)?.hold ?? 0);
}

note(`master, GROUP muted:   ${groupMuted.join(', ')}  (median ${median(groupMuted)})`);
note(`master, GROUP open:    ${groupOpen.join(', ')}  (median ${median(groupOpen)})`);
note(`child's own PRE-MUTE meter while the group was muted: ${childOwnWhileGroupMuted.join(', ')}`);

check('CONTROL — the clip kept playing through every group-muted window, so a quiet master '
  + 'is the group cutting it rather than the music resting',
  Math.min(...childOwnWhileGroupMuted) > 0, { childOwnMeter: childOwnWhileGroupMuted });

/**
 * ⚠ REPORTED, not asserted — see this file's header. Both outcomes are real
 * results and the probe must survive either. The verdict is a separation
 * between two spreads, never a single pair of numbers.
 */
/**
 * ⚠ Three outcomes, and only ONE of them is an instrument failure. An earlier
 * shape of this block asserted `silences || separated`, which would have printed
 * a red X against a perfectly clean "group mute does not reach children" — the
 * exact `e16j` mistake this file's header undertakes not to repeat.
 *
 *   at the floor            group mute reaches children       ● a result
 *   indistinguishable from  group mute does not reach them    ○ also a result,
 *     the open reading                                          and a clean one
 *   somewhere in between,   the reading is inside the noise   ⚠ the only case
 *     spreads overlapping                                       worth failing on
 */
const mutedMax = Math.max(...groupMuted);
const mutedMin = Math.min(...groupMuted);
const m1Silences = mutedMax <= FLOOR + CUT_EPSILON;
const m1Untouched = mutedMin >= Math.min(...groupOpen) - CUT_EPSILON;
const m1Ambiguous = !m1Silences && !m1Untouched && mutedMax >= Math.min(...groupOpen);
console.log('');
console.log(`   ⇒ M1: muting the group ${m1Silences ? 'SILENCES its children'
  : m1Untouched ? 'DOES NOT REACH its children'
    : 'PARTIALLY attenuates its children'}.`);
console.log(`      group-muted ${mutedMin}–${mutedMax} vs floor ${FLOOR} `
  + `(+${CUT_EPSILON} tolerance), group-open min ${Math.min(...groupOpen)}`);
check('M1 is READABLE — the result is not stranded inside the noise between floor and open '
  + '(this check is about the instrument; either direction of the answer passes it)',
  !m1Ambiguous,
  { groupMuted, groupOpen, floor: FLOOR, open: OPEN,
    reading: m1Silences ? '● group mute reaches children'
      : m1Untouched ? '○ group mute does NOT reach children — lineage-level A/B does not exist'
        : m1Ambiguous ? '⚠ INDETERMINATE: spreads overlap, do not quote this row'
          : '◐ partial attenuation — separated from both floor and open' });

/**
 * ⚠ Worth recording whichever way M1 goes: does the child's OWN mute flag move
 * when its parent is muted? If it does not — the expected answer — then a
 * lineage's audibility is not readable from its members' mute flags, and
 * anything inferring "which branch is live" from them is wrong. That is the
 * §4.1 overloading problem one level up.
 */
check('the child\'s own mute flag was NOT changed by muting its parent, so lineage audibility '
  + 'cannot be read off the children\'s mute state',
  !childMuteFlagChanged, { childMuteFlagChanged,
    note: 'reported either way — a FAIL here would be a genuinely useful surprise' });

await setMute(GROUP, false);
await wait(SETTLE_MS);

// ==========================================================================
// 4. M2 — does the group's mute take the child's SENDS with it?
// ==========================================================================
/**
 * The half that can be wrong silently. Both fader modes, because they are two
 * different questions wearing one name (E2's framing): a POST send is tapped
 * after the child's fader, a PRE send before it, and where a *parent's* mute
 * sits relative to either tap is unmeasured.
 */
console.log('\n-- 4. M2: does muting the GROUP cut the CHILD\'s send to the return?');

const srcIndex = async () => await indexOf(SRC);
await req('branch.setMixer', {
  trackIndex: await srcIndex(), sendIndex: 0, sendEnabled: true, sendValue: SEND_VALUE,
});

interface SendResult { mode: string; resolvedPreFader: boolean; open: number; muted: number; childOwn: number }
const sendResults: SendResult[] = [];

for (const mode of ['POST', 'PRE'] as const) {
  await req('branch.setMixer', { trackIndex: await srcIndex(), sendIndex: 0, sendMode: mode });
  await wait(500);

  // ⚠ Read back what Bitwig RESOLVED the mode to, never what we asked for.
  // `sendMode` is the setting and `isPreFader` is the resolution, and AUTO
  // resolves to POST for an ordinary FX track (E2). A silent no-op on the enum
  // would otherwise measure POST twice and call it a clean result.
  const after = await mixerOf(SRC);
  const resolved = after.sends[0]?.preFader ?? false;
  check(`send mode ${mode} was accepted and Bitwig resolved it to ${resolved ? 'PRE' : 'POST'}`,
    after.sends[0]?.sendMode === mode, { requested: mode, readback: after.sends[0] });

  // Positive control first: with nothing muted, does the return hear this send?
  await setMute(GROUP, false);
  await wait(SETTLE_MS);
  const openVuS = await listen();
  const fxOpen = openVuS.get(FX)?.hold ?? 0;

  // The measurement: the GROUP muted, the child untouched.
  await setMute(GROUP, true);
  await wait(SETTLE_MS);
  const mutedVuS = await listen();
  const fxMuted = mutedVuS.get(FX)?.hold ?? 0;
  const childOwn = mutedVuS.get(SRC)?.hold ?? 0;

  await setMute(GROUP, false);
  await wait(1000);

  sendResults.push({ mode, resolvedPreFader: resolved, open: fxOpen, muted: fxMuted, childOwn });
  note(`${mode}: FX return reads ${fxOpen} with the group open, ${fxMuted} with it muted `
    + `(child's own pre-mute meter meanwhile: ${childOwn})`);

  check(`${mode}: SEND CONTROL — the return can hear this send at all, so a silent muted `
    + 'reading means something was cut rather than that nothing was ever routed',
    fxOpen > CUT_EPSILON, { fxOpen, sendValue: SEND_VALUE });
  check(`${mode}: CLIP CONTROL — the child kept playing through the muted window`,
    childOwn > 0, { childOwnMeter: childOwn });
}

console.log('');
for (const r of sendResults) {
  const cut = r.muted <= CUT_EPSILON;
  console.log(`   ⇒ M2 ${r.mode} (resolved ${r.resolvedPreFader ? 'PRE' : 'POST'}): `
    + `muting the group ${cut ? 'CUTS' : 'DOES NOT CUT'} the child's send `
    + `(${r.open} → ${r.muted})`);
}
const m2AllCut = sendResults.every((r) => r.muted <= CUT_EPSILON && r.open > CUT_EPSILON);
const m2AnyLeak = sendResults.some((r) => r.muted > CUT_EPSILON && r.open > CUT_EPSILON);
check('M2 is DECIDED — every mode had a live send to cut, so both readings mean something '
  + '(again: about the instrument, not the answer)',
  sendResults.every((r) => r.open > CUT_EPSILON),
  { sendResults,
    reading: m2AllCut ? 'group mute takes the children\'s sends with it — the wet path is correct'
      : m2AnyLeak ? '⚠ A CHILD\'S SEND SURVIVES ITS PARENT\'S MUTE — lineage A/B is wrong in the '
        + 'wet path, and the mixer shows the lineage muted while it still feeds the bus'
        : 'INDETERMINATE' });

// ==========================================================================
// 5. the ear half — with placebos, because a meter is not a musician
// ==========================================================================
/**
 * ⚠ Placebos even though the effect is expected to be obvious. Rows D–G's C5
 * showed what they are worth: the load-bearing datum was a clean "no" after four
 * consecutive real trials, and no raw count could have ruled out expectation.
 * Here they guard a subtler failure — a listener who is told a mute is coming
 * will hear the mix "change" on a trial where nothing happened.
 */
console.log('\n-- 5. the ear half');
console.log('  Each trial counts down and says NOW. Judge the couple of seconds after it.');
console.log('  ⚠ Some trials do nothing at all, and you are not told which.');
console.log('  Answering "nothing" often is a useful result, not a failed test.\n');
await setMute(GROUP, false);
await setMute(SRC, false);
await wait(2000);

interface Trial { n: number; real: boolean; stopped: boolean; click: boolean; said: string }
const trials: Trial[] = [];

for (let n = 1; n <= TRIALS; n++) {
  const real = Math.random() < 0.5;
  console.log(`\n--- trial ${n} of ${TRIALS} ---`);
  for (const c of ['3', '2', '1']) {
    process.stdout.write(`  ${c}... `);
    await wait(1000);
  }
  console.log('NOW');

  if (real) await setMute(GROUP, true);
  await wait(JUDGE_MS);

  const stopped = await askYesNo(`trial ${n} — did the sound STOP or drop away?`);
  const click = await askYesNo(`trial ${n} — was there a CLICK or POP on the transition?`);
  const said = await ask(`trial ${n} — anything else? (Enter for nothing)`);
  trials.push({ n, real, stopped, click, said });

  if (real) {
    await setMute(GROUP, false);
    console.log('  (settling)');
    await wait(1500);
  }
}

console.log('\n=== what actually happened ===');
for (const t of trials) {
  console.log(`  trial ${t.n}: ${t.real ? 'GROUP MUTED' : 'placebo    '} | `
    + `stopped=${t.stopped ? 'Y' : 'n'} click=${t.click ? 'Y' : 'n'}`
    + (t.said ? ` | "${t.said}"` : ''));
}
const realTrials = trials.filter((t) => t.real);
const placeboTrials = trials.filter((t) => !t.real);
const stopReal = realTrials.filter((t) => t.stopped).length;
const stopPlacebo = placeboTrials.filter((t) => t.stopped).length;
console.log('');
note(`"sound stopped" reported: ${stopReal}/${realTrials.length} real vs `
  + `${stopPlacebo}/${placeboTrials.length} placebo`);

check('the trial set is usable: both arms actually occurred',
  realTrials.length > 0 && placeboTrials.length > 0,
  { real: realTrials.length, placebo: placeboTrials.length });
/**
 * ⚠ The check is that the EAR AGREES WITH THE METER, not that the listener heard
 * a mute — because if M1 came out ○ then the correct thing to hear is nothing,
 * and demanding discrimination would fail the run for reporting the truth. Read
 * the two arms together: a disagreement between ear and meter is the genuinely
 * alarming outcome and it is what this fails on.
 */
const realRate = realTrials.length ? stopReal / realTrials.length : 0;
const placeboRate = placeboTrials.length ? stopPlacebo / placeboTrials.length : 0;
const earAgrees = m1Silences ? realRate > placeboRate : realRate <= placeboRate;
check('the EAR AGREES WITH THE METER — the listener discriminated a group mute exactly when '
  + 'the master bus said there was one to discriminate',
  realTrials.length > 0 && placeboTrials.length > 0 && earAgrees,
  { realRate: realRate.toFixed(2), placeboRate: placeboRate.toFixed(2),
    meterSaid: m1Silences ? 'silences' : m1Untouched ? 'does not reach' : 'partial',
    reading: earAgrees
      ? 'ear and meter tell the same story'
      : '⚠ EAR AND METER DISAGREE — do not write this row up until that is explained' });

// The A/B gesture as one continuous act — E1's question, one level up.
console.log('\n  Now toggling the GROUP mute 8 times. This is the lineage-level A/B gesture.');
console.log('  Listen to it as one thing.');
for (let i = 0; i < 8; i++) {
  await setMute(GROUP, true);
  await wait(900);
  await setMute(GROUP, false);
  await wait(900);
}
const feel = await ask('as a gesture for auditioning a whole lineage against the rest of the '
  + 'arrangement — is this usable? What would make it not usable?');
note(`human on lineage-level A/B: ${feel}`);
check('the human reported what the lineage-level A/B felt like', feel.length > 0, { feel });

const anythingElse = await ask('anything you noticed that this probe did not ask about? '
  + '(Enter for nothing)');
if (anythingElse) note(`unprompted: ${anythingElse}`);

// ==========================================================================
// 6. cleanup — put the project back exactly as it was found
// ==========================================================================
console.log('\n-- 6. cleanup');
await req('transport.stop');
await setMute(GROUP, groupBefore.mute);
await setMute(SRC, childBefore.mute);
await setFold(GROUP, groupBefore.isGroupExpanded);
if (sendBefore) {
  await req('branch.setMixer', {
    trackIndex: await srcIndex(), sendIndex: 0,
    sendValue: sendBefore.value, sendEnabled: sendBefore.enabled, sendMode: sendBefore.sendMode,
  });
}
// ⚠ Back to the filter the rig was built with. ALL_CHANNELS changes the meaning
// of `itemCount`, which standing rule 5's accounting reads, so leaving it on
// would quietly alter the next probe's idea of the project.
await req('branch.contentFilter', { filter: 'ALL_VISIBLE_CHANNELS' });

const groupAfter = await mixerOf(GROUP);
const childAfter = await mixerOf(SRC);
check('the project is back as found: group and child mute/fold and the send restored',
  groupAfter.mute === groupBefore.mute
    && groupAfter.isGroupExpanded === groupBefore.isGroupExpanded
    && childAfter.mute === childBefore.mute
    && childAfter.sends[0]?.value === sendBefore?.value
    && childAfter.sends[0]?.enabled === sendBefore?.enabled,
  { groupAfter: { mute: groupAfter.mute, expanded: groupAfter.isGroupExpanded },
    childAfter: { mute: childAfter.mute, send: childAfter.sends[0] } });

console.log('');
console.log('=== SUMMARY FOR THE WRITE-UP ===');
console.log(`  M1  group mute ${m1Silences ? 'SILENCES children ●'
  : m1Untouched ? 'DOES NOT REACH children ○' : 'PARTIALLY attenuates children ◐'}  `
  + `— master ${median(groupOpen)} open vs ${median(groupMuted)} muted, floor ${FLOOR}`);
for (const r of sendResults) {
  console.log(`  M2  ${r.mode} (resolved ${r.resolvedPreFader ? 'PRE' : 'POST'}): send `
    + `${r.muted <= CUT_EPSILON ? 'CUT' : 'SURVIVES'} — FX ${r.open} → ${r.muted}`);
}
console.log(`  ear "sound stopped": ${stopReal}/${realTrials.length} real vs `
  + `${stopPlacebo}/${placeboTrials.length} placebo`);

console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} FAILURES`);
process.exit(failureCount() === 0 ? 0 : 1);
