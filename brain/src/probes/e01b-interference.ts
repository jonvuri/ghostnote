/**
 * E1b — Addressing under real user interference. INTERACTIVE:
 * run this yourself in a terminal (`npm run probe:e01b`) with Bitwig
 * visible, and follow the prompts.
 *
 * Requires the E1a fixture (re-establishes it automatically if missing).
 */
import * as readline from 'node:readline/promises';
import {
  client, check, note, failureCount, pollUntil,
  cursorStatus, getNotes, sameNotes, point, ensureFixtureTracks, stampFingerprint, FIXTURE_FPS,
  type Note as N,
} from './lib.js';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (msg: string) => rl.question(`\n>>> ${msg}\n    [press Enter when done] `);

await client.connect();
console.log('connected');

// ---- re-establish fixture + pins (idempotent) -------------------------
// 'trackThenSlot' is the only pointing mechanism that works (E1a finding)
const MECH = 'trackThenSlot';
const { trackA, trackB } = await ensureFixtureTracks();
const { fpA0, fpA1, fpB0 } = FIXTURE_FPS;
const selBefore = (await client.request('selection.status')) as { changes: number };
for (const [c, t, s, fp] of [['0', trackA, 0, fpA0], ['1', trackA, 1, fpA1], ['2', trackB, 0, fpB0]] as const) {
  const ok = await stampFingerprint(c, t, s, fp as unknown as N[], MECH);
  await client.request('cursor.pin', { cursor: c, pinned: true });
  if (!ok) {
    console.error(`could not establish cursor${c} at (${t},${s}) — aborting`);
    process.exit(1);
  }
}
const selAfter = (await client.request('selection.status')) as { changes: number; trackIndex: number; slotIndex: number };
note(`programmatic pointing changed UI selection ${selAfter.changes - selBefore.changes} times during setup ` +
     `(now at track=${selAfter.trackIndex}, slot=${selAfter.slotIndex}) — 0 would mean pointing is selection-free`);
note(`cursors pinned: 0 -> gn-A slot 1 UI row 1, 1 -> gn-A slot 2, 2 -> gn-B slot 1 (0-indexed internally)`);
note(`observe Bitwig now: did the clip selection visibly jump during setup? (will ask at the end)`);

const sel = async () => (await client.request('selection.status')) as { trackIndex: number; slotIndex: number; changes: number };

// ---- test 1: click elsewhere ------------------------------------------
const sel0 = await sel();
await ask(`In Bitwig, click on any clip or track OUTSIDE gn-A/gn-B (one of your own).`);
const sel1 = await sel();
check('user selection change observed', sel1.changes !== sel0.changes, sel1);
const st1 = await cursorStatus('0');
check('cursor0 still pinned at gn-A slot 0', st1.trackPosition === trackA && st1.sceneIndex === 0);
check('cursor0 fingerprint intact', sameNotes(await getNotes('0'), fpA0 as unknown as N[]));
const w1: N[] = [[0, 60, 100, 1], [8, 64, 80, 0.5]];
await client.request('cursor.setNotes', { cursor: '0', notes: [[8, 64, 80, 0.5]] });
check('post-click write lands on pinned target', (await pollUntil(async () => sameNotes(await getNotes('0'), w1))).ok);
check('other pinned clip (B0) unaffected', sameNotes(await getNotes('2'), fpB0 as unknown as N[]));

// ---- test 2: continuous clicking during writes ------------------------
await ask(`NEXT: for ~10 seconds after you press Enter, click around the session view
    continuously — different clips, tracks, empty slots. Keep clicking until told to stop.`);
console.log('    ...writing through pinned cursor0 while you click...');
let mismatches = 0;
for (let i = 0; i < 20; i++) {
  const fp: N[] = [[0, 60, 100, 1], [12, 50 + (i % 12), 70, 0.25]];
  await client.request('cursor.clearNotes', { cursor: '0' });
  await client.request('cursor.setNotes', { cursor: '0', notes: fp });
  const r = await pollUntil(async () => sameNotes(await getNotes('0'), fp), 2000, 50);
  if (!r.ok) mismatches++;
  await new Promise((r2) => setTimeout(r2, 350));
}
console.log('    ...done, you can stop clicking.');
check('20 write+readback cycles under interference, 0 mismatches', mismatches === 0, { mismatches });
const sel2 = await sel();
note(`selection changes observed during test: ${sel2.changes}`);

// ---- test 3: drag the pinned clip to another slot ---------------------
await ask(`NEXT: drag the CLIP in track "gn-A" row 1 (cursor0's target) down to row 4 of the same track.`);
const st3 = await cursorStatus('0');
const content3 = await getNotes('0');
const followed = st3.sceneIndex === 3 && content3.length > 0;
const stayed = st3.sceneIndex === 0;
check('pin behavior after drag is coherent (followed object OR stayed at slot)', followed || stayed,
  { sceneIndex: st3.sceneIndex, notes: content3.length });
note(followed ? 'VERDICT: pin follows the clip OBJECT when moved' :
     stayed ? `VERDICT: pin stays at the SLOT (address), content now: ${content3.length} notes` :
     `VERDICT: ambiguous — sceneIndex=${st3.sceneIndex}, notes=${content3.length}`);
await ask(`Drag the clip back to row 1 of "gn-A".`);
const st3b = await cursorStatus('0');
note(`after drag-back: sceneIndex=${st3b.sceneIndex}, notes=${(await getNotes('0')).length}`);

// ---- test 4: unpinned control (proves the pin does the work) ----------
await client.request('cursor.pin', { cursor: '2', pinned: false });
await ask(`NEXT: click on the CLIP in track "gn-A" row 1.`);
const st4 = await cursorStatus('2');
const moved = st4.trackPosition === trackA && st4.sceneIndex === 0;
check('unpinned cursor2 followed the user selection (control test)', moved,
  { track: st4.trackPosition, scene: st4.sceneIndex });
// restore
await stampFingerprint('2', trackB, 0, fpB0 as unknown as N[], MECH);
await client.request('cursor.pin', { cursor: '2', pinned: true });

// ---- wrap up ----------------------------------------------------------
const visible = await rl.question(`\n>>> During setup/pointing, did you SEE the selection highlight jump around in
    Bitwig's UI? (y/n) `);
note(`user reports selection visibly moved during programmatic pointing: ${visible.trim()}`);

console.log(failureCount() === 0 ? '\nE1b: all checks passed' : `\nE1b: ${failureCount()} FAILURES`);
rl.close();
client.disconnect();
process.exit(failureCount() === 0 ? 0 : 1);
