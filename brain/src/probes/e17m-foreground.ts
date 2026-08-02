/**
 * E17 — is the "foreground gate" on panel-routed actions REAL, or was it always
 * the focus toggle?
 *
 * ⚠ **This probe exists to retract a claim, and the claim was mine.** `e17d`
 * recorded that panel-routed Editing actions need Bitwig frontmost, on the
 * strength of two backgrounded failures followed by a success after the user
 * brought Bitwig forward. That reasoning has a confound and a contradiction:
 *
 *   CONFOUND       "the user brought Bitwig forward" is also "the user CLICKED
 *                  somewhere in Bitwig", which sets panel focus. The two moved
 *                  together and were never separated.
 *   THE PAIR       `e17j` failed and then succeeded with NO foreground change
 *                  between them — the only difference was making the panel-focus
 *                  toggle deterministic. Same state, opposite result, one variable.
 *   CONTRADICTION  ⚠ E16j ran `Group` — an EDITING action — backgrounded AND
 *                  minimised across 5 runs and it fired every time. The `e17d`
 *                  write-up waved that away as "true of Project actions, not
 *                  panel-routed Editing ones", but `Group` is the Editing action
 *                  E16j tested. Existing evidence was overridden by a new story.
 *
 * ⇒ The hypothesis to kill: **there is no foreground gate; `focus_or_toggle_*` is
 * a TOGGLE, and firing it from an unknown state is what produced every failure.**
 *
 * Method: fire the row-1 gesture N times with focus established DETERMINISTICALLY
 * (launcher first, then devices) while Bitwig is BEHIND another window. If it
 * fires, the gate does not exist. Each round rebuilds its own fixture so no round
 * contaminates the next, and both outcomes are reported per round rather than
 * collapsed into a pass/fail — E16j's bracketing discipline.
 *
 * ⚠ A second arm fires the SAME gesture with focus deliberately left UNDETERMINED
 * (the `e17d` shape). If deterministic succeeds and blind fails IN THE SAME
 * BACKGROUNDED SITTING, that isolates the toggle as the whole cause and the
 * retraction is earned rather than merely plausible.
 *
 * ⚠ Per E16j's standing constraint this does NOT touch OS-level focus — no
 * `osascript`, no focus detection, no bringing Bitwig up programmatically. The
 * window state is the operator's to set and to report.
 *
 * Silent: nothing is launched and the transport is never touched.
 */
import { client, check, note, failureCount, pollUntil } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);

const POLYSYNTH = 'a9ffacb5-33e9-4fc7-8621-b1af31e410ef';
const SCRATCH = 'gn-A';
const FOCUS_DEVICES = 'focus_or_toggle_device_panel';
const FOCUS_LAUNCHER = 'focus_or_toggle_clip_launcher';
const ROUNDS = 4;

interface TrackRow { index: number; name: string; type: string; channelId: string }
const list = async () => (await req('track.list')) as { tracks: TrackRow[]; count: number };
interface DevList { devices: { index: number; name: string }[]; count: number }

await client.connect();
const baseline = await list();
const baseIds = new Set(baseline.tracks.map((t) => t.channelId));
const scratch = baseline.tracks.find((t) => t.name === SCRATCH);
if (!scratch) { console.log(`REFUSING: ${SCRATCH} not found.`); process.exit(1); }

async function devicesOn(trackIndex: number): Promise<DevList> {
  await req('cursor.pointTrack', { cursor: '0', trackIndex });
  await pollUntil(async () => {
    const s = (await req('cursor.status', { cursor: '0' })) as { trackPosition: number };
    return s.trackPosition === trackIndex;
  }, 4000, 150);
  let last = '';
  let out: DevList = { devices: [], count: 0 };
  await pollUntil(async () => {
    out = (await req('device.list', { cursor: '0' })) as DevList;
    const names = out.devices.map((d) => d.name).join(',');
    const stable = names === last;
    last = names;
    return stable;
  }, 4000, 200);
  return out;
}

async function reap(): Promise<void> {
  for (let g = 0; g < 10; g++) {
    const now = await list();
    const orphan = now.tracks.find((t) => !baseIds.has(t.channelId));
    if (!orphan) break;
    note(`⚠ reaped orphan track ${orphan.name}`);
    await req('track.delete', { trackIndex: orphan.index });
    await pollUntil(async () => !(await list()).tracks.some((t) => t.channelId === orphan.channelId), 4000, 200);
  }
}

async function clearScratch(): Promise<void> {
  for (let g = 0; g < 10; g++) {
    const d = await devicesOn(scratch!.index);
    if (d.count === 0) break;
    await req('device.delete', { cursor: '0', deviceIndex: d.devices[0]!.index });
    await pollUntil(async () => (await devicesOn(scratch!.index)).count < d.count, 4000, 200);
  }
}

/** One trial: fresh Polysynth, select it, focus (or not), fire `Group`, diff. */
async function trial(deterministicFocus: boolean): Promise<boolean> {
  await clearScratch();
  await req('device.insertBitwig', { cursor: '0', uuid: POLYSYNTH });
  await pollUntil(async () => (await devicesOn(scratch!.index)).count === 1, 8000, 200);
  await devicesOn(scratch!.index);
  await req('device.selectInEditor', { deviceIndex: 0 });
  if (deterministicFocus) {
    // ⚠ From a KNOWN state: move focus to the launcher, THEN toggle to devices.
    await req('app.invokeAction', { id: FOCUS_LAUNCHER });
    await new Promise((r) => setTimeout(r, 250));
  }
  await req('app.invokeAction', { id: FOCUS_DEVICES });
  await new Promise((r) => setTimeout(r, 400));
  await req('device.selectInEditor', { deviceIndex: 0 });
  await new Promise((r) => setTimeout(r, 300));
  await req('app.invokeAction', { id: 'Group' });
  await new Promise((r) => setTimeout(r, 1600));
  const after = await devicesOn(scratch!.index);
  await reap();
  return after.devices[0]?.name === 'Instrument Layer';
}

console.log('');
console.log('='.repeat(74));
console.log(' ⚠ LEAVE BITWIG BEHIND YOUR OTHER WINDOWS FOR THIS RUN. Do not click into it.');
console.log(' The question is whether a panel-routed Editing action fires while it is');
console.log(' backgrounded — which E16j says it should, and `e17d` claimed it does not.');
console.log('='.repeat(74));

// ==========================================================================
console.log('\n-- ARM 1: DETERMINISTIC focus (launcher, then devices), Bitwig backgrounded');
const det: boolean[] = [];
for (let i = 1; i <= ROUNDS; i++) {
  const ok = await trial(true);
  det.push(ok);
  note(`round ${i}: ${ok ? '● fired' : '○ nothing'}`);
}
const detCount = det.filter(Boolean).length;

// ==========================================================================
console.log('\n-- ARM 2: BLIND focus (toggle fired from an unknown state) — the e17d shape');
note('⚠ Alternating rounds deliberately leave the device panel focused, so the next');
note('blind toggle turns it OFF. That is the exact state `e17j` tripped on.');
const blind: boolean[] = [];
for (let i = 1; i <= ROUNDS; i++) {
  const ok = await trial(false);
  blind.push(ok);
  note(`round ${i}: ${ok ? '● fired' : '○ nothing'}`);
}
const blindCount = blind.filter(Boolean).length;

await clearScratch();
await reap();

// ==========================================================================
console.log('\n' + '='.repeat(74));
console.log(` DETERMINISTIC focus, backgrounded: ${detCount}/${ROUNDS} fired`);
console.log(` BLIND focus,         backgrounded: ${blindCount}/${ROUNDS} fired`);
console.log('='.repeat(74));

check('⚠ THE RETRACTION: a panel-routed Editing action fires with Bitwig BACKGROUNDED,'
  + ' provided panel focus is established deterministically',
  detCount === ROUNDS, { deterministic: `${detCount}/${ROUNDS}` });
// ⚠ Both arms must be reported, and a blind arm that ALSO always fires would mean
// the toggle is not the explanation either and something else was going on.
check('and the BLIND arm is the one that is unreliable — isolating the toggle as the cause',
  blindCount < detCount, { deterministic: detCount, blind: blindCount });

if (detCount === ROUNDS) {
  note('⇒ ⚠ THERE IS NO FOREGROUND GATE. E16j stands unqualified: named actions fire');
  note('  backgrounded, Editing ones included. `e17d`\'s foreground claim is RETRACTED —');
  note('  it was the `focus_or_toggle_*` toggle all along, and "the user brought Bitwig');
  note('  forward" was confounded with "the user clicked, changing panel focus".');
  if (blindCount === ROUNDS) {
    note('⚠ But the blind arm fired too, so the toggle is not the whole story either.');
    note('  Report both numbers and do NOT claim the mechanism is understood.');
  }
} else if (detCount === 0) {
  note('⇒ The gate may be real after all — nothing fired backgrounded even with focus');
  note('  handled properly. ⚠ Then `e17j`\'s success needs another explanation, because');
  note('  its foreground state was the same as its failure. Do not settle this from here.');
} else {
  note(`⇒ ⚠ INTERMITTENT (${detCount}/${ROUNDS}) — which is the worst outcome and the most`);
  note('  useful one: neither "gated" nor "not gated" is true, and anything built on');
  note('  named actions inherits a flaky dispatch. Rule 6 should say so.');
}
console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} checks reported a negative — read them individually`);
process.exit(0);
