/**
 * E17 row 6, the audible half — does soloing one chain SILENCE its sibling?
 *
 * ⚠ `e17g` settled the scope question silently: the solo flag sets, and it is
 * NOT project-global (a track solo flipped 10 other tracks' `isMutedBySolo`; a
 * layer solo flipped none). What it could not settle is the half that decides
 * whether the row is worth anything: **"not global" is not the same as
 * "usefully exclusive".** A layer chain exposes no `isMutedBySolo` —
 * `DeviceLayerBank` declares exactly one member — so whether the sibling chain
 * is actually silenced is not readable, and a solo that does nothing locally
 * looks identical to one that is politely scoped.
 *
 * ⚠ **But this does NOT need ears, and that matters, because a null ear result
 * cannot distinguish "no effect" from "this listener could not have heard one" —
 * the weakness §3.4e had to state about itself.** The VU meter is the oracle,
 * and the MUTE-based A/B is the calibration:
 *
 *   E16w measured, on this same fixture shape: chain 0 alone reads ~58, chain 1
 *   alone (dark, F1FREQ near DC) reads ~16, both open ~57.
 *
 * ⇒ So this run FIRST re-measures both mute-based arms to get today's ground
 * truth, then fires the solo and compares against them. `solo chain 1` must land
 * on the "chain 1 alone" number, not the "both open" number. That is a
 * quantitative discriminator with a known-good reference on each side, which is
 * strictly stronger than an ear trial and needs no forced-balance schedule.
 *
 * ⚠ The instrument is the TRACK'S OWN meter, not the master. Trap 1 (the VU tap
 * is PRE-MUTE) is about the track's own MIXER mute; a device-layer solo happens
 * INSIDE the instrument, upstream of that tap, so the track's own meter is the
 * correct oracle here and the master is the contaminated one. That is E16w's
 * finding, applied rather than rediscovered.
 *
 * ⚠ `slot.launch` ONLY — never `transport.play` afterwards. Launching a launcher
 * clip starts the transport itself and the clip loops; E16w's first attempt
 * called `transport.play` after each launch and `transport.stop` between
 * retries, tearing down the playback it was retrying.
 *
 *   run       the measurement   (⚠ MAKES NOISE)
 *   restore   put every other track's mute back
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { client, check, note, failureCount, pollUntil } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);
const MUTES = join(tmpdir(), 'gn-e17h-mutes.json');
const SUBJECT = 'gn-lay';

interface TrackRow { index: number; name: string; type: string; channelId: string }
const list = async () => ((await req('track.list')) as { tracks: TrackRow[] }).tracks;
const indexOf = async (channelId: string): Promise<number | undefined> => {
  const r = (await req('track.resolveByChannelId', { channelId })) as { found: boolean; index?: number };
  return r.found ? r.index : undefined;
};
interface VuRow { name: string; hold: number; mutedBySolo: boolean }
const vuAll = async (reset = false) =>
  ((await req('branch.vu', { reset })) as { tracks: VuRow[] }).tracks;

/** Peak on the subject's own tap AND the master, over a settle window. */
async function peakPair(ms: number): Promise<{ own: number; master: number }> {
  await vuAll(true);
  await new Promise((r) => setTimeout(r, ms));
  const rows = await vuAll();
  return {
    own: rows.find((t) => t.name === SUBJECT)?.hold ?? 0,
    master: rows.find((t) => t.name === 'Master')?.hold ?? 0,
  };
}

interface LayerRow { index: number; name: string; mute?: boolean | string; solo?: boolean | string }
const layers = async () => (await req('layer.list')) as { layers: LayerRow[]; count: number };

async function selectContainer(trackIndex: number): Promise<void> {
  await req('cursor.pointTrack', { cursor: '0', trackIndex });
  await pollUntil(async () => {
    const s = (await req('cursor.status', { cursor: '0' })) as { trackPosition: number };
    return s.trackPosition === trackIndex;
  }, 4000, 150);
  await req('devcursor.selectAt', { deviceIndex: 0 });
  const ok = await pollUntil(async () => {
    const s = (await req('devcursor.status')) as { exists: boolean; name: string };
    return s.exists && s.name === 'Instrument Layer';
  }, 6000, 150);
  if (!ok.ok) {
    console.log('REFUSING: the device cursor is not on the Instrument Layer (the e16o trap).');
    process.exit(1);
  }
}
const setChain = async (ti: number, layerIndex: number, p: Record<string, unknown>) => {
  await selectContainer(ti);
  await req('layer.setMixer', { layerIndex, ...p });
  await new Promise((r) => setTimeout(r, 900));
};

const mode = process.argv[2] ?? 'run';
await client.connect();

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

const tracks = await list();
const subject = tracks.find((t) => t.name === SUBJECT);
if (!subject) { console.log(`REFUSING: ${SUBJECT} not found.`); process.exit(1); }

// ==========================================================================
console.log('\n-- clearing the room (prior mute state saved for `restore`)');
const prior: { channelId: string; name: string; mute: boolean }[] = [];
for (const t of tracks) {
  if (t.index === subject.index || t.type === 'Master') continue;
  const m = (await req('branch.mixer', { trackIndex: t.index })) as { mute: boolean };
  prior.push({ channelId: t.channelId, name: t.name, mute: m.mute });
  if (!m.mute) await req('branch.setMixer', { trackIndex: t.index, mute: true });
}
writeFileSync(MUTES, JSON.stringify(prior, null, 2));
note(`silenced ${prior.filter((p) => !p.mute).length} other tracks`);

// ==========================================================================
console.log('\n-- both chains open, and PROVE the subject is loud');
await setChain(subject.index, 0, { mute: false, solo: false });
await setChain(subject.index, 1, { mute: false, solo: false });
let loud = 0;
for (let attempt = 1; attempt <= 3; attempt++) {
  await req('slot.launch', { trackIndex: subject.index, slotIndex: 0 });
  await new Promise((r) => setTimeout(r, 2500));
  const p = await peakPair(2500);
  note(`  attempt ${attempt}: own ${p.own}, master ${p.master}`);
  if (p.own > 20) { loud = p.own; break; }
}
if (loud === 0) {
  console.log('\nREFUSING: could not get the subject above 20 on its own meter. Measuring a');
  console.log('decay tail against silence is how E16w\'s earlier attempts produced false results.');
  console.log('⚠ other tracks are still muted — run `restore`.');
  process.exit(1);
}
const bothOpen = await peakPair(2500);
note(`BOTH OPEN — own ${bothOpen.own}, master ${bothOpen.master}`);
check('PRECONDITION: the subject is loud, so a drop below means something',
  bothOpen.own > 20, { bothOpen });

// ==========================================================================
console.log('\n-- CALIBRATION by MUTE: today\'s ground truth for each chain alone');
note('⚠ This is what makes the solo reading interpretable without ears. E16w proved mute');
note('works on a layer chain, so these two numbers ARE "chain N alone", measured now.');
await setChain(subject.index, 1, { mute: true });
const chain0Alone = await peakPair(2500);
await setChain(subject.index, 1, { mute: false });
await setChain(subject.index, 0, { mute: true });
const chain1Alone = await peakPair(2500);
await setChain(subject.index, 0, { mute: false });
const bothAgain = await peakPair(2500);
note(`chain 0 alone (bright):        own ${chain0Alone.own}`);
note(`chain 1 alone (dark, 15.3 Hz): own ${chain1Alone.own}`);
note(`both open again:               own ${bothAgain.own}`);
// ⚠ If the two arms are not separable, nothing downstream can be read — this is
// the "check that a check can FAIL" rule applied to the calibration itself.
const separable = Math.abs(chain0Alone.own - chain1Alone.own) >= 10;
check('⚠ CALIBRATION: the two chains give DIFFERENT meter readings, so "which one is'
  + ' playing" is answerable at all',
  separable, { chain0Alone: chain0Alone.own, chain1Alone: chain1Alone.own });
if (!separable) {
  console.log('\nREFUSING to read the solo arms: with both chains reading the same, a solo that');
  console.log('silences one is indistinguishable from a solo that does nothing. That is rows');
  console.log('D–G trap 6, and it is why §3.4e could not quote its own null result strongly.');
  console.log('⚠ other tracks are still muted — run `restore`.');
  process.exit(1);
}

// ==========================================================================
console.log('\n======== THE ROW — solo chain 1 (the DARK one), and see which number we land on');
note('If solo is locally exclusive, chain 0 is silenced and this must read like');
note(`"chain 1 alone" (~${chain1Alone.own}). If solo does nothing locally, it reads like`);
note(`"both open" (~${bothAgain.own}). Those are ${Math.abs(bothAgain.own - chain1Alone.own)} apart.`);
await setChain(subject.index, 1, { solo: true });
const solo1 = await peakPair(2500);
await selectContainer(subject.index);
const flags1 = await layers();
note(`SOLO chain 1 — own ${solo1.own}, master ${solo1.master}`);
note(`   flags: ${flags1.layers.map((x) => `${x.index}:solo=${x.solo},mute=${x.mute}`).join('  ')}`);
const dOpen = Math.abs(solo1.own - bothAgain.own);
const dAlone = Math.abs(solo1.own - chain1Alone.own);
note(`   distance to "both open" = ${dOpen};  to "chain 1 alone" = ${dAlone}`);
const exclusive1 = dAlone < dOpen;
check('⚠ ROW 6c: soloing chain 1 SILENCES chain 0 — a layer solo is locally EXCLUSIVE',
  exclusive1, { soloed: solo1.own, bothOpen: bothAgain.own, chain1Alone: chain1Alone.own });
await setChain(subject.index, 1, { solo: false });

// The mirror, so the result cannot be an artifact of which chain was chosen.
console.log('\n-- the mirror: solo chain 0 (the BRIGHT one)');
await setChain(subject.index, 0, { solo: true });
const solo0 = await peakPair(2500);
note(`SOLO chain 0 — own ${solo0.own}   ("chain 0 alone" was ${chain0Alone.own})`);
const exclusive0 = Math.abs(solo0.own - chain0Alone.own) <= Math.abs(solo0.own - chain1Alone.own);
check('ROW 6c (mirror): soloing chain 0 lands on "chain 0 alone" too',
  exclusive0, { soloed: solo0.own, chain0Alone: chain0Alone.own, chain1Alone: chain1Alone.own });
await setChain(subject.index, 0, { solo: false });

// ==========================================================================
console.log('\n-- CONTROL: the sound must come BACK');
const restored = await peakPair(2500);
note(`after clearing every solo: own ${restored.own}  (both open was ${bothAgain.own})`);
check('CONTROL: clearing the solos restores the full sound, so the drop was the solo'
  + ' and not the clip ending',
  restored.own > bothAgain.own * 0.5, { restored: restored.own, bothOpen: bothAgain.own });

await req('transport.stop');
await selectContainer(subject.index);
const endFlags = await layers();
check('CLEANUP: no chain is left soloed or muted',
  endFlags.layers.every((x) => x.solo === false && x.mute === false),
  { flags: endFlags.layers.map((x) => `${x.index}:s=${x.solo},m=${x.mute}`) });

// ==========================================================================
console.log('\n======== VERDICT');
console.log(`  both open              own ${bothAgain.own}`);
console.log(`  chain 0 alone (mute)   own ${chain0Alone.own}`);
console.log(`  chain 1 alone (mute)   own ${chain1Alone.own}`);
console.log(`  SOLO chain 1           own ${solo1.own}   ${exclusive1 ? '● lands on "chain 1 alone"' : '○ lands on "both open"'}`);
console.log(`  SOLO chain 0           own ${solo0.own}   ${exclusive0 ? '● lands on "chain 0 alone"' : '○'}`);
if (exclusive1 && exclusive0) {
  note('⇒ ⚠ A LAYER SOLO IS LOCALLY EXCLUSIVE AND NOT PROJECT-GLOBAL. That is the');
  note('  mutually-exclusive selection gesture the user asked for: one call, no selector,');
  note('  no routing — and `solo` is a single readable flag per chain rather than the');
  note('  N mute flags E16m and §4.4 object to.');
} else {
  note('⇒ The solo flag sets and is not global, but it does not silence the sibling either.');
  note('  It is INERT on a layer chain: the A/B gesture stays mute-based (E16w).');
}
console.log('\n⚠ other tracks are still muted — run `npm run probe:e17h restore`.');
console.log(failureCount() === 0 ? 'ALL PASS' : `${failureCount()} checks reported a negative`);
process.exit(0);
