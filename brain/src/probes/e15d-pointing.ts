/**
 * E15-D — what, exactly, is unsafe about acting in the request that pointed?
 *
 * The encoder emits `cursor.pointTrack` + `slot.select` into the SAME `batch.run`
 * as the op they precede, and `encodeOp('note.write')` additionally emits
 * `cursor.setStepSize` immediately before `cursor.setNotes`. Both are one
 * control-surface turn. E1 measured pointing at ~25ms and E2 recorded that
 * `setStepSize` "needs a settle wait — not instant", so both are suspect — but
 * "suspect" is not a finding, and the conformance symptom (C-pressure failing
 * only after C-notes) is two inferences away from either cause.
 *
 * This probe measures the mechanisms directly, one at a time, each against a
 * control that differs ONLY in whether a request boundary separates the two
 * halves. It answers four questions:
 *
 *   A. How long does pointing take, and is the NEXT request already enough?
 *      (the cost of the poll-and-verify fix)
 *   B. Does a point + write in one batch write through the OLD cursor?
 *   C. Does `setStepSize` + `setNotes` in one batch place notes on the OLD grid?
 *      (HANDOFF §5.1 — unverified, and silently wrong if true)
 *   D. Does a point + `clearNotes` in one batch clear the WRONG clip?
 *      (HANDOFF §5.2 — destructive if true)
 *   E. Do two writes to DIFFERENT clips in one batch both land? (§5.3)
 *
 * Every readback here points in its own request and poll-verifies before
 * scanning, so a wrong answer is never the measurement's fault.
 *
 *   npx tsx src/probes/e15d-pointing.ts
 *
 * ⚠ Writes notes into the gn-A / gn-B fixture clips, like every other E1/E2
 * probe. It creates no tracks.
 */
import { client, check, note, failureCount, pollUntil, ensureFixtureTracks, cursorStatus, type Note } from './lib.js';

const CURSOR = '0';

/** Generous by design: this is an instrument, not production pacing. */
const SETTLE_MS = 400;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Op = { method: string; params?: Record<string, unknown> };

const batch = async (ops: Op[]) =>
  (await client.request('batch.run', { ops: ops.map((o) => ({ method: o.method, params: o.params ?? {} })), verbose: true })) as
    { applied: boolean; results?: { method: string; ok: boolean; error?: string }[] };

const pointOps = (trackIndex: number, slotIndex: number): Op[] => [
  { method: 'cursor.pointTrack', params: { cursor: CURSOR, trackIndex } },
  { method: 'slot.select', params: { trackIndex, slotIndex, mechanism: 'track' } },
];

/** Point in its OWN requests and POLL until status confirms it (E1's rule). */
async function pointVerified(trackIndex: number, slotIndex: number): Promise<number> {
  await client.request('cursor.pointTrack', { cursor: CURSOR, trackIndex });
  await client.request('slot.select', { trackIndex, slotIndex, mechanism: 'track' });
  const r = await pollUntil(async () => {
    const s = await cursorStatus(CURSOR);
    return s.exists && s.trackPosition === trackIndex && s.sceneIndex === slotIndex;
  }, 4000, 5);
  if (!r.ok) throw new Error(`pointing at (${trackIndex},${slotIndex}) never confirmed`);
  return r.ms;
}

/** Set the grid in its OWN request and wait well past any plausible settle. */
async function setGrid(stepSize: number): Promise<void> {
  await client.request('cursor.setStepSize', { cursor: CURSOR, stepSize });
  await sleep(SETTLE_MS);
}

/** A trustworthy read: separate point, poll-verified, separate grid, settled. */
async function readNotesAt(trackIndex: number, slotIndex: number, stepSize: number): Promise<Note[]> {
  await pointVerified(trackIndex, slotIndex);
  await setGrid(stepSize);
  const res = (await client.request('cursor.getNotes', { cursor: CURSOR })) as { notes: Note[] };
  return res.notes;
}

/** Beats, so a result is independent of whatever grid it was scanned on. */
const beatsOf = (notes: Note[], stepSize: number) => notes.map((n) => n[0] * stepSize);

async function clearVerified(trackIndex: number, slotIndex: number): Promise<void> {
  await pointVerified(trackIndex, slotIndex);
  await client.request('cursor.clearNotes', { cursor: CURSOR });
  await sleep(SETTLE_MS);
}

// ---------------------------------------------------------------- setup

const { trackA, trackB } = await ensureFixtureTracks();
note(`fixtures: gn-A=${trackA} gn-B=${trackB}`);
// A pin left behind by an E1 probe would freeze the cursor and make every
// result below a lie about pointing rather than a measurement of it.
await client.request('cursor.pin', { cursor: CURSOR, pinned: false });
const pinned = (await cursorStatus(CURSOR)).isPinned;
check('the pool cursor is unpinned, so pointing is actually free to move', pinned === false, { isPinned: pinned });

// ============================================================ A. the cost

console.log('\n-- A. how long does pointing take, and how soon is it observable?');

// Alternate targets so every sample is a genuine re-point, not a no-op.
const pollSamples: number[] = [];
for (let i = 0; i < 6; i++) {
  pollSamples.push(await pointVerified(i % 2 === 0 ? trackB : trackA, 0));
}
note(`poll-to-confirm: ${pollSamples.join(', ')} ms`);

// The question that sets the price of the fix: after issuing the two point
// frames, is the very NEXT request already looking at the new clip?
let nextRequestOk = 0;
const nextRequestSamples = 6;
for (let i = 0; i < nextRequestSamples; i++) {
  const t = i % 2 === 0 ? trackB : trackA;
  await client.request('cursor.pointTrack', { cursor: CURSOR, trackIndex: t });
  await client.request('slot.select', { trackIndex: t, slotIndex: 0, mechanism: 'track' });
  const s = await cursorStatus(CURSOR);
  if (s.trackPosition === t && s.sceneIndex === 0) nextRequestOk++;
}
note(`the next request already saw the new target in ${nextRequestOk}/${nextRequestSamples} samples`);
check('pointing settles within a request boundary (so the poll is cheap, E1)',
  pollSamples.every((ms) => ms < 200), { samples: pollSamples });

// ============================================================ B. the defect

console.log('\n-- B. point + write in ONE batch: does the write reach the NEW clip?');

await clearVerified(trackA, 0);
await clearVerified(trackB, 0);
// Leave the cursor parked on A, then ask a single batch to move to B and write.
await pointVerified(trackA, 0);
await setGrid(1);

await batch([...pointOps(trackB, 0), { method: 'cursor.setNotes', params: { cursor: CURSOR, notes: [[0, 72, 100, 1]] } }]);
await sleep(SETTLE_MS);

const bWrongClip = await readNotesAt(trackA, 0, 1);
const bRightClip = await readNotesAt(trackB, 0, 1);
note(`gn-A slot0 (the OLD target): ${JSON.stringify(bWrongClip)}`);
note(`gn-B slot0 (the ASKED target): ${JSON.stringify(bRightClip)}`);
const bLandedWrong = bWrongClip.length > 0 && bRightClip.length === 0;
check('VERDICT B: a same-request point+write reaches the target it asked for',
  bRightClip.length === 1 && bWrongClip.length === 0,
  { landedOnPreviousClip: bLandedWrong, wrong: bWrongClip.length, right: bRightClip.length });

console.log('\n-- B-control: the same write, with the point in a SEPARATE request');
await clearVerified(trackA, 0);
await clearVerified(trackB, 0);
await pointVerified(trackA, 0);
await pointVerified(trackB, 0); // separate request + poll-verified
await batch([{ method: 'cursor.setNotes', params: { cursor: CURSOR, notes: [[0, 72, 100, 1]] } }]);
await sleep(SETTLE_MS);

const bcWrong = await readNotesAt(trackA, 0, 1);
const bcRight = await readNotesAt(trackB, 0, 1);
note(`gn-A slot0: ${JSON.stringify(bcWrong)}   gn-B slot0: ${JSON.stringify(bcRight)}`);
check('CONTROL B: point-then-poll in its own request writes to the right clip',
  bcRight.length === 1 && bcWrong.length === 0, { wrong: bcWrong.length, right: bcRight.length });

// ============================================================ C. the grid

console.log('\n-- C. setStepSize + setNotes in ONE batch: which grid does x mean?');
// x=2 means beat 1.0 on the NEW 0.5 grid, beat 0.125 on the OLD 0.0625 grid.
await clearVerified(trackA, 0);
await pointVerified(trackA, 0);
await setGrid(0.0625);

await batch([
  { method: 'cursor.setStepSize', params: { cursor: CURSOR, stepSize: 0.5 } },
  { method: 'cursor.setNotes', params: { cursor: CURSOR, notes: [[2, 60, 100, 0.5]] } },
]);
await sleep(SETTLE_MS);

// Scan on a grid fine enough to tell the two answers apart without ambiguity.
const cScan = await readNotesAt(trackA, 0, 0.0625);
const cBeats = beatsOf(cScan, 0.0625);
note(`scanned at 1/16 beat: ${JSON.stringify(cScan)} -> beats ${JSON.stringify(cBeats)}`);
const cOnNewGrid = cBeats.length === 1 && Math.abs(cBeats[0]! - 1.0) < 1e-9;
const cOnOldGrid = cBeats.length === 1 && Math.abs(cBeats[0]! - 0.125) < 1e-9;
check('VERDICT C: x in a same-request setNotes is read against the NEW grid',
  cOnNewGrid, { beats: cBeats, onOldGrid: cOnOldGrid });

console.log('\n-- C-control: the same write with setStepSize in a SEPARATE request');
await clearVerified(trackA, 0);
await pointVerified(trackA, 0);
await setGrid(0.0625);
await setGrid(0.5); // its own request, settled
await batch([{ method: 'cursor.setNotes', params: { cursor: CURSOR, notes: [[2, 60, 100, 0.5]] } }]);
await sleep(SETTLE_MS);

const ccBeats = beatsOf(await readNotesAt(trackA, 0, 0.0625), 0.0625);
note(`beats ${JSON.stringify(ccBeats)}`);
check('CONTROL C: a settled setStepSize places the note at the intended beat',
  ccBeats.length === 1 && Math.abs(ccBeats[0]! - 1.0) < 1e-9, { beats: ccBeats });

console.log('\n-- C2. how long does setStepSize actually take to take effect?');
// Write a note at beat 1 on a 0.5 grid, then change the grid and poll until the
// scan reports it at the position the NEW grid implies.
await clearVerified(trackA, 0);
await pointVerified(trackA, 0);
await setGrid(0.5);
await batch([{ method: 'cursor.setNotes', params: { cursor: CURSOR, notes: [[2, 60, 100, 0.5]] } }]);
await sleep(SETTLE_MS);
await client.request('cursor.setStepSize', { cursor: CURSOR, stepSize: 0.25 });
const gridSettle = await pollUntil(async () => {
  const res = (await client.request('cursor.getNotes', { cursor: CURSOR })) as { notes: Note[] };
  return res.notes.length === 1 && res.notes[0]![0] === 4;
}, 4000, 5);
note(`setStepSize became observable after ${gridSettle.ms}ms (ok=${gridSettle.ok})`);

// ============================================================ D. the clear

console.log('\n-- D. point + clearNotes in ONE batch: which clip gets cleared?');
await clearVerified(trackA, 0);
await clearVerified(trackB, 0);
await pointVerified(trackA, 0);
await setGrid(1);
await batch([{ method: 'cursor.setNotes', params: { cursor: CURSOR, notes: [[0, 60, 100, 1]] } }]);
await sleep(SETTLE_MS);
await pointVerified(trackB, 0);
await setGrid(1);
await batch([{ method: 'cursor.setNotes', params: { cursor: CURSOR, notes: [[1, 62, 100, 1]] } }]);
await sleep(SETTLE_MS);

note(`before: A=${JSON.stringify(await readNotesAt(trackA, 0, 1))} B=${JSON.stringify(await readNotesAt(trackB, 0, 1))}`);
// Park on A, then ask one batch to move to B and clear.
await pointVerified(trackA, 0);
await batch([...pointOps(trackB, 0), { method: 'cursor.clearNotes', params: { cursor: CURSOR } }]);
await sleep(SETTLE_MS);

const dA = await readNotesAt(trackA, 0, 1);
const dB = await readNotesAt(trackB, 0, 1);
note(`after: A=${JSON.stringify(dA)} B=${JSON.stringify(dB)}`);
check('VERDICT D: a same-request point+clear clears the clip it asked for',
  dB.length === 0 && dA.length === 1, { aSurvived: dA.length, bCleared: dB.length });

// ============================================================ E. two clips

console.log('\n-- E. two writes to DIFFERENT clips in ONE batch (§5.3)');
await clearVerified(trackA, 0);
await clearVerified(trackB, 0);
await pointVerified(trackA, 0);
await setGrid(1);

await batch([
  ...pointOps(trackA, 0),
  { method: 'cursor.setNotes', params: { cursor: CURSOR, notes: [[0, 60, 100, 1]] } },
  ...pointOps(trackB, 0),
  { method: 'cursor.setNotes', params: { cursor: CURSOR, notes: [[1, 62, 100, 1]] } },
]);
await sleep(SETTLE_MS);

const eA = await readNotesAt(trackA, 0, 1);
const eB = await readNotesAt(trackB, 0, 1);
note(`A=${JSON.stringify(eA)} B=${JSON.stringify(eB)}`);
check('VERDICT E: two clips addressed in one batch each receive their own notes',
  eA.length === 1 && eA[0]![1] === 60 && eB.length === 1 && eB[0]![1] === 62,
  { a: eA, b: eB });

// ---------------------------------------------------------------- cleanup

await clearVerified(trackA, 0);
await clearVerified(trackB, 0);
note('fixture clips cleared');

client.disconnect();
console.log(`\n${failureCount() === 0 ? 'ALL PASS' : `${failureCount()} FAILURE(S)`}`);
process.exit(failureCount() === 0 ? 0 : 1);
