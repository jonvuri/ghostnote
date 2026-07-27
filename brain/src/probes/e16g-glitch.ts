/**
 * E16 row C5 — does duplication stall the surface or glitch the audio?
 * (and, riding along: is a branch appearing PERCEPTIBLE at all?)
 *
 * ⚠ **This probe exists because the first attempt at C5 was unanswerable.**
 * `probe:e16e` asked "did the audio glitch at the moment the branch was
 * created?" some forty seconds after the fact, with three other measurement
 * phases in between, and got the only honest reply available: *"I don't know
 * when the branch was created exactly, so hard to say. Needs a more focused
 * test with a clear signal of when that happens."* That is a defect in the
 * instrument, not a missing observation.
 *
 * Three things fix it:
 *
 *  1. **A countdown.** Each trial announces itself, acts on a spoken NOW, and
 *     leaves a short judged window with nothing else happening in it.
 *  2. **One question per trial, asked immediately.** Attribution is the whole
 *     difficulty; a verdict collected 40 seconds later is about a memory.
 *  3. ⚠ **Placebo trials.** Roughly half of them count down to NOW and then do
 *     NOTHING. Without them this probe cannot distinguish a glitch from an
 *     expectation: the listener knows a duplicate is coming, duplicates are
 *     believed to glitch, and hearing one is the natural result. The sequence
 *     is withheld until the end so the run is blind while it matters.
 *
 * The verdict is the CONTINGENCY — glitches reported on real trials versus on
 * placebos — never the raw count. A listener who reports a glitch on every
 * trial has told us the test is worthless, and this probe will say so rather
 * than counting it as 100% confirmation.
 *
 * ⚠ Needs a human at the keyboard. Run it directly:  npm run probe:e16g
 *
 * Requires `gn-E16`. Deletes every branch it makes.
 */
import { client, check, note, ask, askYesNo, failureCount, pollUntil } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const TRIALS = 8;
/** The window the human judges. Long enough to hear, short enough to attribute. */
const JUDGE_MS = 2500;

type TrackRow = { index: number; name: string; channelId: string; type: string };
const list = async () => (await req('track.list')) as { tracks: TrackRow[]; count: number };
const indexOf = async (channelId: string): Promise<number> => {
  const r = (await req('track.resolveByChannelId', { channelId })) as { found: boolean; index?: number };
  if (!r.found || r.index === undefined) throw new Error(`track ${channelId} no longer resolves`);
  return r.index;
};

await client.connect();
console.log('connected\n');

const all = await list();
const fixture = all.tracks.find((t) => t.name === 'gn-E16');
if (!fixture) {
  console.log('REFUSING: gn-E16 not found — run `npm run probe:e16b` first to build it.');
  process.exit(1);
}
const SRC = fixture.channelId;

// Sweep up anything an aborted run left behind (see e16e's note on this).
for (const stray of (await list()).tracks.filter(
  (t) => t.name === 'gn-E16' && t.channelId !== SRC && t.type === 'Instrument')) {
  const at = (await req('track.resolveByChannelId', { channelId: stray.channelId })) as
    { found: boolean; index?: number };
  if (!at.found || at.index === undefined) continue;
  await req('track.delete', { trackIndex: at.index });
  await pollUntil(async () => !((await req('track.resolveByChannelId',
    { channelId: stray.channelId })) as { found: boolean }).found, 8000, 100);
  note(`cleared a leftover branch: ${stray.channelId}`);
}

console.log('⚠ This makes noise. You will judge one short window at a time.\n');
console.log('  Each trial counts down and then says NOW. Listen to the couple of seconds');
console.log('  AFTER "NOW" and say whether anything happened in the audio.');
console.log('');
console.log('  ⚠ Some trials do nothing at all. That is deliberate and you are not told');
console.log('  which — it is the only way to tell a real glitch from an expected one.');
console.log('  Answering "nothing" often is a useful result, not a failed test.\n');
await ask('ready? (press Enter)');

await req('branch.setMixer', { trackIndex: await indexOf(SRC), mute: false });
await req('slot.launch', { trackIndex: await indexOf(SRC), slotIndex: 0 });
await wait(3000);

interface Trial { n: number; real: boolean; glitch: boolean; louder: boolean; said: string }
const trials: Trial[] = [];
const made: string[] = [];

for (let n = 1; n <= TRIALS; n++) {
  // Coin flip per trial, kept secret until the summary.
  const real = Math.random() < 0.5;

  console.log(`\n--- trial ${n} of ${TRIALS} ---`);
  for (const c of ['3', '2', '1']) {
    process.stdout.write(`  ${c}... `);
    await wait(1000);
  }
  console.log('NOW');

  let branchId: string | undefined;
  if (real) {
    const pre = await list();
    const preIds = new Set(pre.tracks.map((t) => t.channelId));
    await req('branch.duplicateTrack', {
      trackIndex: await indexOf(SRC), route: 'hostDuplicate', undoName: `ghostnote E16 C5 trial ${n}`,
    });
    const ok = await pollUntil(async () => (await list()).count === pre.count + 1, 20000, 25);
    if (ok.ok) {
      branchId = (await list()).tracks.find((t) => !preIds.has(t.channelId))?.channelId;
      if (branchId) made.push(branchId);
    }
  }

  await wait(JUDGE_MS);

  const glitch = await askYesNo(`trial ${n} — did the audio GLITCH, stutter or drop out?`);
  const louder = await askYesNo(`trial ${n} — did the mix get LOUDER or thicker?`);
  const said = await ask(`trial ${n} — anything else? (Enter for nothing)`);
  trials.push({ n, real, glitch, louder, said });

  // Silence the new branch outside the judged window, so trials stay independent.
  if (branchId) {
    console.log('  (settling)');
    await req('branch.setMixer', { trackIndex: await indexOf(branchId), mute: true });
    await wait(1500);
  }
}

// ---- the contingency, which is the actual result -------------------------
console.log('\n\n=== what actually happened ===');
for (const t of trials) {
  console.log(`  trial ${t.n}: ${t.real ? 'DUPLICATED' : 'placebo   '} | `
    + `glitch=${t.glitch ? 'Y' : 'n'} louder=${t.louder ? 'Y' : 'n'}`
    + (t.said ? ` | "${t.said}"` : ''));
}

const real = trials.filter((t) => t.real);
const placebo = trials.filter((t) => !t.real);
const glitchReal = real.filter((t) => t.glitch).length;
const glitchPlacebo = placebo.filter((t) => t.glitch).length;
const louderReal = real.filter((t) => t.louder).length;
const louderPlacebo = placebo.filter((t) => t.louder).length;

console.log('');
note(`glitch reported: ${glitchReal}/${real.length} real vs ${glitchPlacebo}/${placebo.length} placebo`);
note(`louder reported: ${louderReal}/${real.length} real vs ${louderPlacebo}/${placebo.length} placebo`);

check('the trial set is usable: both arms actually occurred',
  real.length > 0 && placebo.length > 0, { real: real.length, placebo: placebo.length });

// ⚠ Reported as a discrimination, never as a raw rate. "Glitched on 4 of 4
// duplications" means nothing if it also glitched on 4 of 4 placebos.
check('C5: duplication GLITCHES the audio — and the listener discriminated it from placebo',
  real.length > 0 && placebo.length > 0
    && glitchReal / real.length > glitchPlacebo / placebo.length,
  { realRate: real.length ? (glitchReal / real.length).toFixed(2) : 'n/a',
    placeboRate: placebo.length ? (glitchPlacebo / placebo.length).toFixed(2) : 'n/a',
    reading: 'if the rates are equal, C5 is UNPROVEN by this run, whatever the raw count' });

check('E5: a branch appearing is PERCEPTIBLE as a level/thickness change, above placebo',
  real.length > 0 && placebo.length > 0
    && louderReal / real.length > louderPlacebo / placebo.length,
  { realRate: real.length ? (louderReal / real.length).toFixed(2) : 'n/a',
    placeboRate: placebo.length ? (louderPlacebo / placebo.length).toFixed(2) : 'n/a' });

// ---- cleanup --------------------------------------------------------------
console.log('\n-- cleanup');
for (const id of made) {
  const at = (await req('track.resolveByChannelId', { channelId: id })) as
    { found: boolean; index?: number };
  if (!at.found || at.index === undefined) continue;
  await req('track.delete', { trackIndex: at.index });
  await pollUntil(async () =>
    !((await req('track.resolveByChannelId', { channelId: id })) as { found: boolean }).found,
    8000, 100);
}
await req('transport.stop');
await req('branch.setMixer', { trackIndex: await indexOf(SRC), mute: false });
check('gn-E16 survived and the project is back to one of it',
  (await list()).tracks.filter((t) => t.name === 'gn-E16').length === 1, {});

console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} FAILURES`);
process.exit(failureCount() === 0 ? 0 : 1);
