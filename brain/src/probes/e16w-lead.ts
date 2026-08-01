/**
 * The DeviceLayer-mute lead, third attempt — and the first with a clean room.
 *
 * ⚠ Both previous attempts measured the wrong thing, in two different ways, and
 * both were caught by controls rather than by luck:
 *
 *   `e16v meter`  read only the MASTER and saw 62 -> 56. That looked like "the
 *                 mute does nothing". It was the master hearing four OTHER
 *                 tracks: `e16v-diag` §0 found Group 7, gn-E16, gn-sel and
 *                 gn-lay all at 54–58 with nothing of ours launched.
 *   `e16v-diag`   read the right meter but its subject had stopped playing —
 *                 open 5, restored 0. Its "mute silences it" PASS compared
 *                 silence to silence, and only the PRECONDITION and CONTROL
 *                 failing alongside it revealed that. ⚠ A probe asserting just
 *                 its headline would have published a ● here.
 *
 * So this one: silences every other track first (recording their prior state and
 * restoring it), PROVES the subject is loud before touching anything, and
 * refuses outright rather than measuring a decay tail. The clean room is also
 * what the ear trials need — a layer mute cannot be judged under a project
 * playing at 58.
 *
 * ⚠ The instrument is the TRACK'S OWN meter. Trap 1 (the VU tap is pre-mute)
 * is about the track's own MIXER mute; a device-layer mute is inside the
 * instrument, upstream of that tap, so unlike E16m the track's own meter is the
 * correct oracle and the master is the contaminated one.
 *
 *   run       the measurement            (⚠ makes noise)
 *   ab-run    8 trials, forced balance   (⚠ makes noise)
 *   ab-score <answers>
 *   restore   put every other track's mute back
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { client, check, note, failureCount, pollUntil } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);
const DEVAB = join(tmpdir(), 'gn-e16v-devab.json');
const MUTES = join(tmpdir(), 'gn-e16w-mutes.json');
const AB = join(tmpdir(), 'gn-e16w-ab.json');
const SUBJECT = 'gn-lay';

type TrackRow = { index: number; name: string; channelId: string; type: string };
const list = async () => (await req('track.list')) as { tracks: TrackRow[]; count: number };
const indexOf = async (channelId: string): Promise<number | undefined> => {
  const r = (await req('track.resolveByChannelId', { channelId })) as { found: boolean; index?: number };
  return r.found ? r.index : undefined;
};
interface VuRow { name: string; hold: number }
const vuAll = async (reset = false) =>
  ((await req('branch.vu', { reset })) as { tracks: VuRow[] }).tracks;
async function peakOf(name: string, ms: number): Promise<number> {
  await vuAll(true);
  await new Promise((r) => setTimeout(r, ms));
  return (await vuAll()).find((t) => t.name === name)?.hold ?? 0;
}
/**
 * ⚠ BOTH meters, because they answer different questions and only one of them
 * is the mix.
 *
 * `own`    the subject's own tap. A device-layer mute is INSIDE the instrument
 *          and therefore upstream of this, so it is the instrument for "did the
 *          layer stop producing".
 * `master` the only reading that says whether anything REACHES the mix.
 *
 * ⚠ And this is why the previous run's "clean room" check was wrong: per-track
 * meters are PRE-MUTE (trap 1), so tracks that are muted and inaudible still
 * read 57 on their own tap. Judging the room by them reports contamination that
 * does not exist. The master is the arbiter.
 */
async function peakPair(name: string, ms: number): Promise<{ own: number; master: number }> {
  await vuAll(true);
  await new Promise((r) => setTimeout(r, ms));
  const rows = await vuAll();
  return {
    own: rows.find((t) => t.name === name)?.hold ?? 0,
    master: rows.find((t) => t.name === 'Master')?.hold ?? 0,
  };
}
async function audibleNow(ms: number): Promise<Record<string, number>> {
  await vuAll(true);
  await new Promise((r) => setTimeout(r, ms));
  const out: Record<string, number> = {};
  for (const t of await vuAll()) if (t.hold > 0) out[t.name] = t.hold;
  return out;
}
interface LayerRow { index: number; name: string; mute?: boolean | string; channelId?: boolean | string }
const layers = async () => (await req('layer.list')) as { layers: LayerRow[]; count: number };

async function selectContainer(trackIndex: number): Promise<void> {
  await req('cursor.pointTrack', { cursor: '0', trackIndex });
  await req('devcursor.selectAt', { deviceIndex: 0 });
  const ok = await pollUntil(async () => {
    const s = (await req('devcursor.status')) as { exists: boolean; name: string };
    return s.exists && s.name.includes('Layer');
  }, 6000, 100);
  if (!ok.ok) {
    console.log('REFUSING: the device cursor is not on the Instrument Layer. Every layer call');
    console.log('reaches its target through it, so proceeding produces silent no-ops that are');
    console.log('byte-identical to API refusals (the e16o trap).');
    process.exit(1);
  }
}
const setChainMute = async (trackIndex: number, layerIndex: number, mute: boolean) => {
  await selectContainer(trackIndex);
  await req('layer.setMixer', { layerIndex, mute });
};

/** Silence everything except the subject, remembering what to put back. */
async function clearTheRoom(subjectIndex: number): Promise<void> {
  const rows = (await list()).tracks;
  const prior: { channelId: string; name: string; mute: boolean }[] = [];
  for (const t of rows) {
    if (t.index === subjectIndex || t.type === 'Master') continue;
    const m = (await req('branch.mixer', { trackIndex: t.index })) as { mute: boolean };
    prior.push({ channelId: t.channelId, name: t.name, mute: m.mute });
    if (!m.mute) await req('branch.setMixer', { trackIndex: t.index, mute: true });
  }
  writeFileSync(MUTES, JSON.stringify(prior, null, 2));
  note(`silenced ${prior.filter((p) => !p.mute).length} other tracks (prior state saved)`);
}

/**
 * Launch and PROVE the subject is loud; refuse rather than measure a tail.
 *
 * ⚠ `slot.launch` ONLY — no `transport.play`. Launching a launcher clip starts
 * the transport by itself and the clip loops, which is how `e16m` held a sound
 * for eight toggles without ever touching the transport. The previous attempt
 * called `transport.play` after each launch and `transport.stop` between
 * retries, which tore down the launcher playback it had just started: attempt 1
 * caught a decay tail at 5 and attempts 2 and 3 read 0. The retry loop was
 * destroying the very thing it was retrying.
 */
async function makeAudible(trackIndex: number): Promise<number> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    await req('slot.launch', { trackIndex, slotIndex: 0 });
    await new Promise((r) => setTimeout(r, 2500));
    const p = await peakOf(SUBJECT, 2500);
    note(`  attempt ${attempt}: ${SUBJECT} peaks at ${p}`);
    if (p > 20) return p;
  }
  console.log(`\nREFUSING: could not get ${SUBJECT} above 20 on its own meter. Measuring a`);
  console.log('decay tail against silence is how the previous attempt produced a false PASS.');
  process.exit(1);
}

const mode = process.argv[2] ?? 'run';
await client.connect();
const built = JSON.parse(readFileSync(DEVAB, 'utf8')) as Record<string, { channelId: string }>;
const subjectId = built[SUBJECT]!.channelId;

// ==========================================================================
if (mode === 'restore') {
  const prior = JSON.parse(readFileSync(MUTES, 'utf8')) as
    { channelId: string; name: string; mute: boolean }[];
  let restored = 0;
  for (const p of prior) {
    const idx = await indexOf(p.channelId);
    if (idx === undefined) continue;
    await req('branch.setMixer', { trackIndex: idx, mute: p.mute });
    restored++;
  }
  await req('transport.stop');
  console.log(`RESTORED ${restored} tracks' mute state, transport stopped.`);
  process.exit(0);
}

const subjectIndex = await indexOf(subjectId);
if (subjectIndex === undefined) { console.log(`REFUSING: ${SUBJECT} does not resolve.`); process.exit(1); }

// ==========================================================================
if (mode === 'run') {
  console.log('-- clearing the room');
  await clearTheRoom(subjectIndex);
  await setChainMute(subjectIndex, 0, false);
  await setChainMute(subjectIndex, 1, false);

  console.log('\n-- proving the subject is loud');
  await makeAudible(subjectIndex);
  const openPair = await peakPair(SUBJECT, 2500);
  const open = openPair.own;
  const room = await audibleNow(2000);
  note(`OPEN — own ${openPair.own}, master ${openPair.master}`);
  note(`per-track taps (⚠ PRE-MUTE, so muted tracks still show): ${JSON.stringify(room)}`);
  check('PRECONDITION: the subject is loud on its own meter', open > 20, { open });

  // ⚠ FLOOR CONTROL, the one e16m insisted on: mute the SUBJECT's own track mute
  // and read the master. That is what "silence" looks like in this room, and
  // without it a low number later has nothing to be compared against.
  await req('branch.setMixer', { trackIndex: subjectIndex, mute: true });
  await new Promise((r) => setTimeout(r, 1500));
  const floor = await peakPair(SUBJECT, 2500);
  await req('branch.setMixer', { trackIndex: subjectIndex, mute: false });
  await new Promise((r) => setTimeout(r, 1500));
  note(`FLOOR (subject muted at its own mixer) — own ${floor.own}, master ${floor.master}`);
  check('FLOOR CONTROL: the room really is otherwise silent at the MASTER, so a low'
    + ' master reading later means our mute and not someone else stopping',
    floor.master <= 3, { masterFloor: floor.master, ownStillReads: floor.own });
  note('⚠ the subject\'s own tap still reads while its track is muted — trap 1, and it is');
  note('  why the master is the arbiter for "does it reach the mix".');

  console.log('\n-- the lead: mute BOTH chains');
  await setChainMute(subjectIndex, 0, true);
  await setChainMute(subjectIndex, 1, true);
  await new Promise((r) => setTimeout(r, 1500));
  const muted = await peakPair(SUBJECT, 2500);
  await selectContainer(subjectIndex);
  const l = await layers();
  const flags = l.layers.map((x) => `chain${x.index}.mute=${x.mute}`);
  note(`BOTH MUTED — own ${muted.own}, master ${muted.master}   flags: ${flags.join(', ')}`);
  note(`⚠ layer channelIds: ${l.layers.map((x) => `${x.index}:${x.channelId}`).join(', ')}`);
  const bothMuted = muted.own;

  check('⚠ THE LEAD: muting both DeviceLayer chains takes the track out of the MIX',
    muted.master <= Math.max(3, floor.master + 2),
    { openMaster: openPair.master, mutedMaster: muted.master, floorMaster: floor.master });
  check('and its own (post-device) tap drops with it',
    muted.own < open * 0.4, { open, muted: muted.own });
  check('the mute FLAG reads back as set, so the API accepted the write',
    flags.every((f) => f.endsWith('=true')), { flags });

  console.log('\n-- CONTROL: it must come BACK');
  await setChainMute(subjectIndex, 0, false);
  await setChainMute(subjectIndex, 1, false);
  await new Promise((r) => setTimeout(r, 1500));
  const restored = await peakOf(SUBJECT, 2500);
  note(`unmuted: ${restored}`);
  check('CONTROL: sound returns on unmute, so the silence was the mute, not the clip ending',
    restored > open * 0.5, { open, restored });

  console.log('\n-- and the A/B shape: mute ONE chain');
  await setChainMute(subjectIndex, 0, true);
  await new Promise((r) => setTimeout(r, 1500));
  const only1 = await peakOf(SUBJECT, 2500);
  await setChainMute(subjectIndex, 0, false);
  await setChainMute(subjectIndex, 1, true);
  await new Promise((r) => setTimeout(r, 1500));
  const only0 = await peakOf(SUBJECT, 2500);
  await setChainMute(subjectIndex, 1, false);
  note(`chain 1 alone (dark, F1FREQ 19.4Hz): ${only1}`);
  note(`chain 0 alone (default): ${only0}`);
  check('⚠ the two chains are individually selectable by mute — a device-scoped A/B',
    only0 > 20 && only1 < only0, { chain0Alone: only0, chain1Alone: only1 });
  note('⚠ this is the lead\'s payoff IF it holds: an A/B that costs no bank slot, no C5');
  note('  duplication glitch, and that reaches the master and the FX returns — the two');
  note('  places a fork cannot reach (§4.8) and the first to leave the bank (E16r).');
  note('⚠ what it does NOT buy: §4.4 wants a SINGLE readable "which branch is live".');
  note('  This is N mute flags, which is E16m\'s problem one level down. A selector\'s');
  note('  activeChainIndex() is the single integer; this is the cheap fallback.');

  await req('transport.stop');
  console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} FAILURES`);
  console.log('⚠ other tracks are still muted — run `restore` when done with the ear trials.');
  process.exit(failureCount() === 0 ? 0 : 1);
}

// ==========================================================================
if (mode === 'ab-run') {
  await setChainMute(subjectIndex, 0, false);
  await setChainMute(subjectIndex, 1, false);
  await makeAudible(subjectIndex);

  // ⚠ FORCED balance, not a coin — E16m's coin gave 5 real / 1 placebo and left
  // its ear half resting on a single placebo trial.
  const TRIALS = 8;
  const arms = [...Array(TRIALS / 2).fill(true), ...Array(TRIALS / 2).fill(false)] as boolean[];
  for (let i = arms.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arms[i], arms[j]] = [arms[j]!, arms[i]!];
  }

  console.log(`\n${TRIALS} trials, ~5s each. For EACH, note: did the sound CHANGE?`);
  console.log('(y = changed, n = stayed the same)\n');
  const meters: number[] = [];
  for (let t = 0; t < TRIALS; t++) {
    console.log(`  trial ${t + 1} ...`);
    if (arms[t]) await setChainMute(subjectIndex, 0, true);
    meters.push(await peakOf(SUBJECT, 2200));
    if (arms[t]) await setChainMute(subjectIndex, 0, false);
    await new Promise((r) => setTimeout(r, 2200));
  }
  await req('transport.stop');
  writeFileSync(AB, JSON.stringify({ arms, meters }, null, 2));
  console.log('\nTRIALS DONE — transport stopped.');
  note(`meter per trial: ${meters.join(', ')}`);
  note('⚠ the schedule is on disk and deliberately NOT printed. Report 8 letters.');
  process.exit(0);
}

// ==========================================================================
if (mode === 'ab-score') {
  const answers = (process.argv[3] ?? '').toLowerCase().replace(/[^yn]/g, '');
  const rec = JSON.parse(readFileSync(AB, 'utf8')) as { arms: boolean[]; meters: number[] };
  if (answers.length !== rec.arms.length) {
    console.log(`REFUSING: got ${answers.length} answers for ${rec.arms.length} trials.`);
    process.exit(2);
  }
  const realN = rec.arms.filter(Boolean).length;
  const placeboN = rec.arms.length - realN;
  let realHeard = 0; let placeboHeard = 0;
  console.log(`\nlayer-mute A/B — ${realN} real / ${placeboN} placebo (FORCED balance)\n`);
  rec.arms.forEach((real, i) => {
    const heard = answers[i] === 'y';
    if (real && heard) realHeard++;
    if (!real && heard) placeboHeard++;
    console.log(`  trial ${i + 1}: ${real ? 'REAL   ' : 'placebo'} | heard=${heard ? 'yes' : 'no '}`
      + ` | own-meter peak ${rec.meters[i]}`);
  });
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
  const realM = avg(rec.meters.filter((_, i) => rec.arms[i]!));
  const placeboM = avg(rec.meters.filter((_, i) => !rec.arms[i]!));
  console.log('');
  note(`ear:   ${realHeard}/${realN} real vs ${placeboHeard}/${placeboN} placebo`);
  note(`meter: real avg ${realM.toFixed(1)} vs placebo avg ${placeboM.toFixed(1)}`);
  check('both arms occurred, so the set can discriminate at all', realN > 0 && placeboN > 0);
  check('the ear separates the arms', realHeard / realN > placeboHeard / Math.max(1, placeboN),
    { realRate: (realHeard / realN).toFixed(2), placeboRate: (placeboHeard / placeboN).toFixed(2) });
  // ⚠ A disagreement between ear and meter is the alarming outcome, not a low score.
  check('⚠ the ear AGREES with the meter', (realM < placeboM) === (realHeard > placeboHeard),
    { realM, placeboM, realHeard, placeboHeard });
  process.exit(failureCount() === 0 ? 0 : 1);
}

console.log('usage: e16w-lead.ts run|ab-run|ab-score <answers>|restore');
process.exit(2);
