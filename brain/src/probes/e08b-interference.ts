/**
 * E8b — write-under-interference (SPIKE_PLAN §4, the sub-test that needs the
 * USER at the keyboard). Extends E1b's interference test from READS to WRITES:
 * while a paced batch streams note writes to a pinned cursor on gn-A, the user
 * clicks / drags / edits OTHER clips and tracks. If every write still lands on
 * gn-A and the cursor stays pinned to its target, the pinned-cursor addressing
 * model (E1) holds under concurrent user editing during a live batch.
 *
 * Requires Bitwig foregrounded and the user interacting for the batch window.
 * Restores fixtures at the end.
 */
import {
  client, check, note, failureCount, pollUntil, point, cursorStatus, getNotes,
  ensureFixtureTracks, sameNotes, type Note,
} from './lib.js';

const MECH = 'trackThenSlot';
const CURSOR = '0';
const COUNT = 40;          // distinct note writes
const DELAY = 400;         // ms between writes → ~16s interference window

const selChanges = async () =>
  ((await client.request('selection.status')) as { changes: number }).changes;

await client.connect();
console.log('connected\n');
const { trackA } = await ensureFixtureTracks();

// Pin cursor 0 to gn-A slot 0 (track + clip pin, the robust hold from E1/E4).
await point(CURSOR, trackA, 0, MECH);
await client.request('cursor.pinTrack', { cursor: Number(CURSOR), pinned: true });
await client.request('cursor.pin', { cursor: CURSOR, pinned: true });
await client.request('cursor.clearNotes', { cursor: CURSOR });
await pollUntil(async () => (await getNotes(CURSOR)).length === 0);

// Build 40 writes as a paced batch. One DISTINCT pitch per note (y = 48 + i)
// so notes never share a pitch — adjacent same-pitch notes truncate each
// other's duration (correct Bitwig behavior), which would make an exact
// content match spuriously fail. Distinct pitches let dur=1 round-trip, so
// the check is a clean "every write landed exactly on its target cell".
const expected: Note[] = [];
const ops: { method: string; params: unknown }[] = [];
for (let i = 0; i < COUNT; i++) {
  const x = i % 8;
  const y = 48 + i;
  expected.push([x, y, 100, 1]);
  ops.push({ method: 'cursor.setNotes', params: { cursor: CURSOR, notes: [[x, y, 100, 1]] } });
}

console.log('============================================================');
console.log(' USER ACTION NEEDED — bring Bitwig to the FOREGROUND now.');
console.log(` For the next ~${Math.round((COUNT * DELAY) / 1000)}s, click, drag, and edit`);
console.log(' OTHER clips and tracks (NOT gn-A) — select clips, drag notes,');
console.log(' switch tracks — interfere as much as you can.');
console.log(' Starting in 5 seconds...');
console.log('============================================================');
await new Promise((r) => setTimeout(r, 5000));

const selBefore = await selChanges();
console.log(`\nrunning paced batch: ${COUNT} writes, ${DELAY}ms apart — INTERFERE NOW`);
await client.request('batch.run', { ops, delayMs: DELAY }, 5000);

// Wait for the whole staged sequence to drain.
const drained = await pollUntil(async () => (await getNotes(CURSOR)).length >= COUNT,
  COUNT * DELAY + 8000, 300);
const selAfter = await selChanges();
console.log('\n============================================================');
console.log(' Batch complete — you can STOP interacting with Bitwig now.');
console.log('============================================================\n');

// -- verify every write landed on the target, exactly.
const landed = await getNotes(CURSOR);
const status = await cursorStatus(CURSOR);
note(`selection changes observed during batch: ${selAfter - selBefore} `
  + `(${selAfter - selBefore > 0 ? 'user interference confirmed' : 'no interference detected'})`);
note(`cursor after batch: track "${status.trackName}" pos=${status.trackPosition} `
  + `scene=${status.sceneIndex} pinned=${status.isPinned}`);
note(`notes landed on gn-A: ${landed.length}/${COUNT}, drained in ${drained.ms}ms`);

check('the pinned cursor stayed on its target (gn-A slot 0) through the batch',
  status.trackPosition === trackA && status.sceneIndex === 0 && status.exists,
  { trackPosition: status.trackPosition, sceneIndex: status.sceneIndex });
check('every write landed on the target clip despite concurrent user editing',
  sameNotes(landed, expected), { landed: landed.length, expected: COUNT });
if (selAfter - selBefore === 0) {
  note('NOTE: no selection changes were seen — if you did not interact with Bitwig,');
  note('      re-run and interfere during the window for a meaningful result.');
}

// -- cleanup: unpin + restore fixtures
console.log('\n-- cleanup: restore fixtures');
await client.request('cursor.pin', { cursor: CURSOR, pinned: false });
await client.request('cursor.pinTrack', { cursor: Number(CURSOR), pinned: false });
async function restore(track: number, slot: number, fp: Note[]) {
  await point(CURSOR, track, slot, MECH);
  await client.request('cursor.clearNotes', { cursor: CURSOR });
  await client.request('cursor.setNotes', { cursor: CURSOR, notes: fp });
  await pollUntil(async () => (await getNotes(CURSOR)).length === fp.length, 4000);
}
const { trackB } = await ensureFixtureTracks();
await restore(trackA, 0, [[0, 60, 100, 1]]);
await restore(trackA, 1, [[1, 61, 100, 1]]);
await restore(trackB, 0, [[2, 62, 100, 1]]);
note('fixtures restored');

console.log(failureCount() === 0 ? '\nE8b: all checks passed' : `\nE8b: ${failureCount()} FAILURES`);
client.disconnect();
process.exit(failureCount() === 0 ? 0 : 1);
