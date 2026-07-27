/**
 * E16 rows E1 and E5's window — A/B by mute, with the transport rolling.
 *
 * Rows A–C settled that branches coexist and that all of them sound at once.
 * These two rows ask whether the coexistence can be made *usable*:
 *
 *   E1  toggling a branch's mute mid-roll — click-free? musically instant?
 *   E5  the window. A copy is audible the instant it exists (measured), so the
 *       question is no longer *is there a bad window* but *how short can it be*,
 *       and whether there is a route with no bad window at all.
 *
 * Two candidate routes for E5, and they fail differently — which is the point:
 *
 *   A "mute after"   duplicate, find the copy, mute it as fast as the wire
 *                    allows. The failure is a DOUBLED mix for that window.
 *   B "born muted"   mute the source FIRST, duplicate (row B5 says the mixer
 *                    strip is carried, so the copy should inherit mute), then
 *                    unmute the source. The failure is a GAP in the source.
 *
 * ⚠ Both are wrong mixes; they are not equally wrong, and which one a musician
 * would rather hear is a §8 decision for the user, not a verdict this probe
 * gets to reach. It measures both and asks what they sounded like.
 *
 * ⚠ **The oracle is the MASTER bus, never a track's own meter.** Row E2
 * measured that `addVuMeterObserver` is PRE-MUTE: a muted track goes on
 * reporting 55-58 while master reads 0. An earlier version of this probe polled
 * the branch's own meter for the mute transition — a transition that meter
 * never shows — and would have reported confident, wholly invented latencies.
 * So every audibility question here is asked of master, with the SOURCE muted
 * so that master carries the branch and nothing else.
 *
 * ⚠ **Needs a human at the keyboard and a monitor they can hear.** `ask()`
 * refuses on a non-TTY, so run this one directly:  npm run probe:e16e
 *
 * Requires `gn-E16` (build it with probe:e16b). Deletes every branch it makes.
 */
import { client, check, note, ask, askYesNo, failureCount, pollUntil } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const TOGGLES = 8;
const POLL_MS = 15;
/** ⚠ Tail clearance before any peak-hold is armed — see E2's notes. */
const SETTLE_MS = 3000;
const WINDOW_MS = 2500;

type TrackRow = { index: number; name: string; channelId: string; type: string };
type VuRow = { channelId: string; name: string; now: number; hold: number; mute: boolean };

const list = async () => (await req('track.list')) as { tracks: TrackRow[]; count: number };
const indexOf = async (channelId: string): Promise<number> => {
  const r = (await req('track.resolveByChannelId', { channelId })) as { found: boolean; index?: number };
  if (!r.found || r.index === undefined) throw new Error(`track ${channelId} no longer resolves`);
  return r.index;
};
const setMute = async (channelId: string, mute: boolean) =>
  req('branch.setMixer', { trackIndex: await indexOf(channelId), mute });
const vu = async (reset = false) => {
  const v = (await req('branch.vu', { reset })) as { tracks: VuRow[] };
  return new Map(v.tracks.map((t) => [t.channelId, t]));
};

await client.connect();
console.log('connected\n');

const all = await list();
const fixture = all.tracks.find((t) => t.name === 'gn-E16');
const master = all.tracks.find((t) => t.type === 'Master');
if (!fixture || !master) {
  console.log('REFUSING: need gn-E16 (probe:e16b) and a Master track.');
  process.exit(1);
}
const SRC = fixture.channelId;
const MASTER = master.channelId;

/**
 * Sweep up branches left by an aborted run before measuring anything.
 *
 * ⚠ This probe asks the human to listen and then Ctrl-C when something sounds
 * wrong, which is the correct instinct and leaves a duplicate behind every
 * time — four of them accumulated in one sitting. A stale branch is not
 * cosmetic here: it shifts every bank index, adds its own CPU, and if it is
 * unmuted it is *in the mix being measured*.
 *
 * ⚠ Deletes are poll-verified one at a time. A fixed wait is not enough — a
 * delete re-indexes the bank, and resolving the next victim before that
 * settles targets the wrong track (observed: two deletes that reported the
 * channelId still resolving, and one unrelated track removed as collateral).
 *
 * The survivor is the LOWEST-positioned `gn-E16`: row A4 measured that a copy
 * carries its source's name and lands adjacent below it, so the original is
 * always first.
 */
const strays = (await list()).tracks
  .filter((t) => t.name === 'gn-E16' && t.channelId !== SRC && t.type === 'Instrument');
if (strays.length > 0) {
  note(`${strays.length} leftover gn-E16 branch(es) from an aborted run — removing before measuring`);
  for (const stray of strays) {
    const at = (await req('track.resolveByChannelId', { channelId: stray.channelId })) as
      { found: boolean; index?: number };
    if (!at.found || at.index === undefined) continue;
    await req('track.delete', { trackIndex: at.index });
    const gone = await pollUntil(async () =>
      !((await req('track.resolveByChannelId', { channelId: stray.channelId })) as
        { found: boolean }).found, 8000, 100);
    note(`  removed ${stray.channelId} (tombstoned after ${gone.ms}ms)`);
  }
  check('the project is back to a single gn-E16 before measurement starts',
    (await list()).tracks.filter((t) => t.name === 'gn-E16').length === 1, {});
}
await setMute(SRC, false);

/** The bridge round-trip is the floor under every latency here; report it, don't hide it. */
const pings: number[] = [];
for (let i = 0; i < 20; i++) {
  const t = Date.now();
  await req('ping');
  pings.push(Date.now() - t);
}
pings.sort((a, b) => a - b);
const pingMedian = pings[10]!;
note(`bridge round-trip: median ${pingMedian}ms, min ${pings[0]}ms, max ${pings[19]}ms `
  + '— no mute can land faster than this');

console.log('\n⚠ This probe MAKES NOISE and asks what you heard. Have Bitwig audible.');
await ask('ready? (press Enter)');

// ---- calibrate silence on the master bus ---------------------------------
await setMute(SRC, false);
await req('slot.launch', { trackIndex: await indexOf(SRC), slotIndex: 0 });
await wait(2000);
await setMute(SRC, true);
await wait(SETTLE_MS);
await vu(true);
await wait(WINDOW_MS);
const floorVu = await vu();
const FLOOR = floorVu.get(MASTER)?.hold ?? 0;
note(`master floor with everything muted (clip still running: `
  + `${floorVu.get(SRC)?.hold} on the pre-mute meter): ${FLOOR}`);
check('floor CONTROL — the clip really was playing behind the muted floor',
  (floorVu.get(SRC)?.hold ?? 0) > 0, { srcPreMuteMeter: floorVu.get(SRC)?.hold });

await setMute(SRC, false);
await wait(SETTLE_MS);

const makeBranch = async (undoName: string): Promise<{ id: string; toVisible: number }> => {
  const pre = await list();
  const preIds = new Set(pre.tracks.map((t) => t.channelId));
  const t0 = Date.now();
  await req('branch.duplicateTrack', { trackIndex: await indexOf(SRC), route: 'hostDuplicate', undoName });
  const ok = await pollUntil(async () => (await list()).count === pre.count + 1, 20000, POLL_MS);
  if (!ok.ok) throw new Error('branch never appeared');
  const id = (await list()).tracks.find((t) => !preIds.has(t.channelId))!.channelId;
  return { id, toVisible: Date.now() - t0 };
};
const deleteBranch = async (id: string) => {
  const n = (await list()).count;
  await req('track.delete', { trackIndex: await indexOf(id) });
  await pollUntil(async () => (await list()).count === n - 1, 8000, 100);
};

// ==========================================================================
// E5 route A — duplicate mid-roll, then mute as fast as the wire allows
// ==========================================================================
console.log('\n-- E5 route A: "mute after" — how much sound escapes?');
console.log('   Listen for the moment the mix doubles, and for how long it stays doubled.');
await wait(500);

// ⚠ Deliberately NOT launching the copy's clip. The mid-session scenario is a
// branch taken while the music runs, so the question is whether the copy starts
// playing BY ITSELF — which is what makes the window exist at all.
const a = await makeBranch('ghostnote E16 E5 route A');
const tMute = Date.now();
await setMute(a.id, true);
const muteAcked = Date.now() - tMute;
note(`route A: copy visible in ${a.toVisible}ms, muted ${muteAcked}ms later `
  + `— ${a.toVisible + muteAcked}ms of doubled mix`);
check('route A: the window is at least a full duplicate + one round trip long',
  a.toVisible + muteAcked > 100, { toVisibleMs: a.toVisible, muteMs: muteAcked,
    bridgeRoundTrip: pingMedian });

/**
 * ⚠ Asked HERE, immediately, and not at the end of the row.
 *
 * The first sitting put these questions after the solo-branch and steady-state
 * phases — some forty seconds and two structural changes later — and got the
 * only honest answer available: *"I don't know when the branch was created
 * exactly."* A perceptual question separated from its event by other events is
 * a question about a memory of the wrong thing. Everything below this point
 * makes noise of its own, so the asking has to happen before it starts.
 *
 * Open, not leading: the first run reported hearing no doubling while a broken
 * check claimed otherwise, and "did you hear it double?" would have quietly
 * collected agreement with the probe instead of an observation.
 */
const heardA = await ask('route A — the branch was created and muted in the last ~2 seconds. '
  + 'What did you hear? (a level jump? a glitch? nothing at all?)');
note(`human on route A: ${heardA}`);
check('the human reported what route A sounded like', heardA.length > 0, { heard: heardA });

/**
 * ⚠ **No level is claimed for the transient window, and an earlier version of
 * this probe claimed one that was pure fiction.**
 *
 * `vuHold` is BANK-INDEXED (Rig.java says so). A copy lands adjacent and shifts
 * every track below it down a slot, so a hold armed before the duplicate and
 * read after it reports the peak of whichever track USED to occupy that slot.
 * Measured, unambiguously: FX 1 had accumulated 38, the copy landed on FX 1's
 * index, and the copy's "peak" came back as exactly 38. The check passed on a
 * number belonging to another track.
 *
 * A hold is therefore only attributable if it is armed AFTER the structural
 * change — which means the transient window cannot be levelled by this
 * instrument at all, because arming it costs the very interval being measured.
 * So the window is reported as a DURATION, which is solid, and its magnitude is
 * measured separately below in steady state, where the instrument is sound.
 */
await setMute(a.id, false);
await wait(SETTLE_MS);
const soloBranch = await (async () => {
  await setMute(SRC, true); await wait(SETTLE_MS);
  await vu(true); await wait(WINDOW_MS);
  const h = (await vu()).get(a.id)?.hold ?? 0;
  await setMute(SRC, false); await wait(1000);
  return h;
})();
check('route A: the copy inherited the RUNNING clip and sounds on its own, '
  + 'with no clip ever launched on it (hold armed AFTER the duplicate, so it is attributable)',
  soloBranch > FLOOR, { branchOwnMeter: soloBranch, floor: FLOOR });

// ---- the magnitude of the wrong mix, measured where the instrument works ----
console.log('\n-- E5: HOW wrong is the mix while both sound? (steady state, master bus)');
const mutedRuns: number[] = [];
const soundingRuns: number[] = [];
for (let i = 0; i < 3; i++) {
  // Alternated rather than blocked, so a drift in the material cannot masquerade
  // as the branch's contribution.
  await setMute(a.id, true);
  await wait(SETTLE_MS);
  await vu(true); await wait(WINDOW_MS);
  mutedRuns.push((await vu()).get(MASTER)?.hold ?? 0);
  await setMute(a.id, false);
  await wait(SETTLE_MS);
  await vu(true); await wait(WINDOW_MS);
  soundingRuns.push((await vu()).get(MASTER)?.hold ?? 0);
}
const median = (xs: number[]) => [...xs].sort((x, y) => x - y)[Math.floor(xs.length / 2)]!;
note(`master with the branch muted: ${mutedRuns.join(', ')} (median ${median(mutedRuns)})`);
note(`master with the branch sounding: ${soundingRuns.join(', ')} (median ${median(soundingRuns)})`);
check('E5: a coexisting branch measurably changes the mix on the master bus',
  median(soundingRuns) > median(mutedRuns) && Math.min(...soundingRuns) > Math.max(...mutedRuns),
  { muted: mutedRuns, sounding: soundingRuns,
    delta: median(soundingRuns) - median(mutedRuns),
    why: 'spreads must not overlap, or the delta is inside the noise' });
await setMute(a.id, true);

// C5 is NOT asked here any more. It needs per-event attribution and a placebo
// arm to separate a real glitch from an expected one, which is a different
// experiment: `probe:e16g`.

// ==========================================================================
// E1 — mute/unmute latency and click-freeness, transport rolling
// ==========================================================================
console.log('\n-- E1: toggling the branch mute while the transport rolls');
console.log('   (source muted for the timed part, so the master bus carries the branch alone)');
await setMute(SRC, true);
await setMute(a.id, false);
await wait(SETTLE_MS);

/**
 * UNMUTE latency is the primary number, and deliberately so.
 *
 * ⚠ Muting is the harder thing to time honestly: the material is a few short
 * notes, so master falls to the floor on its own between them, and a mute timed
 * that way can be credited with a silence the music produced. Unmute has no such
 * failure — a muted branch holds master at the floor, so the first sample above
 * it can only be the unmute. Where the music happens to be resting the number
 * comes out too LARGE, which is the safe direction for a latency claim.
 */
const above = async () => ((await vu()).get(MASTER)?.now ?? 0) > FLOOR;
const atFloor = async () => ((await vu()).get(MASTER)?.now ?? 0) <= FLOOR;

const unmuteLatencies: number[] = [];
const muteLatencies: number[] = [];
for (let i = 0; i < TOGGLES; i++) {
  await setMute(a.id, true);
  await wait(900);

  const t0 = Date.now();
  await setMute(a.id, false);
  const heard = await pollUntil(above, 4000, POLL_MS);
  if (heard.ok) unmuteLatencies.push(Date.now() - t0);
  await wait(700);

  const t1 = Date.now();
  await setMute(a.id, true);
  const gone = await pollUntil(atFloor, 4000, POLL_MS);
  if (gone.ok) muteLatencies.push(Date.now() - t1);
  await wait(500);
}
await setMute(a.id, false);
await wait(1200);

const stat = (xs: number[]) => {
  const s = [...xs].sort((x, y) => x - y);
  return { n: s.length, min: s[0], median: s[Math.floor(s.length / 2)], max: s[s.length - 1] };
};
note(`unmute -> first signal on master: ${JSON.stringify(stat(unmuteLatencies))} (ms, includes `
  + `${pingMedian}ms round trip and the meter's own reporting period)`);
note(`mute -> master back at floor:     ${JSON.stringify(stat(muteLatencies))} (ms) `
  + '⚠ upper bound only — see the control below');

/**
 * The control for the mute number: with NO mute at all, how long does master
 * take to touch the floor on its own? If that is comparable to the mute
 * latency, the mute measurement is just the gap between notes and must not be
 * quoted as a latency.
 */
const selfZero: number[] = [];
for (let i = 0; i < 5; i++) {
  const t = Date.now();
  const z = await pollUntil(atFloor, 3000, POLL_MS);
  selfZero.push(z.ok ? Date.now() - t : 3000);
  await wait(400);
}
note(`CONTROL, no mute at all — master touches the floor by itself in `
  + `${JSON.stringify(stat(selfZero))} (ms)`);
check('the mute-latency number is not just the music resting between notes',
  (stat(muteLatencies).median ?? 9999) < (stat(selfZero).median ?? 0),
  { muteMedian: stat(muteLatencies).median, selfZeroMedian: stat(selfZero).median,
    caveat: 'if this FAILS, quote unmute latency only' });

check('E1: unmute is musically instant (first signal inside 100ms)',
  (stat(unmuteLatencies).median ?? 9999) < 100, stat(unmuteLatencies));

// The ear half needs BOTH tracks audible — that is the real A/B situation.
await setMute(SRC, false);
await wait(1000);
console.log(`\n   Now toggling the branch ${TOGGLES} more times with BOTH tracks audible.`);
console.log('   This is the actual A/B gesture — listen to it as one.');
for (let i = 0; i < TOGGLES; i++) {
  await setMute(a.id, true);
  await wait(900);
  await setMute(a.id, false);
  await wait(900);
}
const clicks = await askYesNo('E1 — did you hear a CLICK or POP on any of those toggles?');
check('E1: mute toggling is click-free', !clicks, { humanHeardClicks: clicks });
const feel = await ask('E1 — did the toggles feel musically instant, or laggy? '
  + '(and did they feel quantised to the beat, or immediate?)');
note(`human on mute feel: ${feel}`);
const abUsable = await ask('E1 — as an A/B gesture for comparing two takes, is this usable? '
  + 'What would make it not usable?');
note(`human on A/B usability: ${abUsable}`);

// ==========================================================================
// E5 route B — born muted
// ==========================================================================
console.log('\n-- E5 route B: "born muted" — mute the SOURCE first, duplicate, unmute the source');
console.log('   Listen for a GAP in the music rather than a doubling.');
await deleteBranch(a.id);
await wait(SETTLE_MS);

const tGapStart = Date.now();
await setMute(SRC, true);
const b = await makeBranch('ghostnote E16 E5 route B');
const bMute = (await vu()).get(b.id)?.mute ?? false;
await setMute(SRC, false);
const gapMs = Date.now() - tGapStart;

note(`route B: source silent for ${gapMs}ms; copy inherited mute=${bMute}`);
check('route B: the copy INHERITS the source mute, so it is born silent',
  bMute, { branchMute: bMute });

/**
 * ⚠ "Nothing escaped" is INFERRED here, and deliberately not measured.
 *
 * A master peak-hold spanning the duplicate would be read off a shifted bank
 * slot, which is precisely the mistake route A made. The claim rests instead on
 * two things that ARE measured: the copy is born with mute already set (above),
 * and row E2 established that mute cuts a track's output and its sends at every
 * level in both fader modes. A track that is muted before it first sounds has
 * no path to the bus. Stated as an inference so that nobody later mistakes it
 * for an observation.
 */
await wait(SETTLE_MS);
const stillMuted = (await vu()).get(b.id)?.mute ?? false;
check('route B: the copy is STILL muted after the operation settles '
  + '(so "nothing escaped" follows from E2, rather than from a shifted meter)',
  stillMuted, { branchMute: stillMuted });

const heardB = await ask('route B — what did you hear? (a gap? how long? worse or better '
  + 'than the doubling in route A?)');
check('the human reported what route B sounded like', heardB.length > 0, { heard: heardB });

const preference = await ask('E5 — which is the better failure for a mid-session branch point: '
  + 'route A\'s doubled mix, or route B\'s gap? (this is a §8 decision, it is yours)');
note(`USER PREFERENCE (§8, not a verdict): ${preference}`);

// ---- cleanup --------------------------------------------------------------
console.log('\n-- cleanup');
await deleteBranch(b.id);
await req('transport.stop');
await setMute(SRC, false);
check('gn-E16 survived, unmuted', ((await req('track.resolveByChannelId', { channelId: SRC })) as
  { found: boolean }).found && (await vu()).get(SRC)?.mute === false);

console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} FAILURES`);
process.exit(failureCount() === 0 ? 0 : 1);
