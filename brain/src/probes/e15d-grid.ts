/**
 * E15-D, part 5 — how long must a grid change settle before `setNoteProps`?
 *
 * Parts 1–4 located the real defect. `cursor.setNoteProps` is the only write op
 * whose handler READS first — `clip.getStep(channel, x, y)` — and a `getStep`
 * issued too soon after a `cursor.setStepSize` that CHANGED the grid lands on a
 * step the cursor has not re-fetched yet. Every property written to it is
 * silently discarded, exactly like the stale-`NoteStep` fault in §E15-B.
 *
 * That is why `C-pressure` fails only after `C-notes`: `C-notes` ends with a
 * readback, which leaves the pool cursor on the 1/16 scan grid, so the write that
 * follows CHANGES the grid — while a case that arrives already on the right grid
 * changes nothing and its properties land.
 *
 * This probe measures the number the fix needs: the smallest gap between the
 * grid change and the props write at which the properties reliably land. It
 * writes `pan`, not `pressure` — part 4 established `pressure` never persists at
 * all, so it cannot be used to measure anything.
 *
 *   npx tsx src/probes/e15d-grid.ts
 *
 * ⚠ Writes into the gn-A fixture clip at scene 0. Creates no tracks.
 */
import { client, check, note, failureCount, pollUntil, cursorStatus, ensureFixtureTracks } from './lib.js';

const REPS = 3;
const DELAYS = [0, 24, 48, 72, 96, 120, 144, 192, 288];
const SETTLE = 500;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Op = { method: string; params?: Record<string, unknown> };
type VerboseStep = Record<string, number | boolean | string>;

const batch = (ops: Op[]) =>
  client.request('batch.run', { ops: ops.map((o) => ({ method: o.method, params: o.params ?? {} })), verbose: true });

async function pointVerified(cursor: string, trackIndex: number, slotIndex: number): Promise<void> {
  await client.request('cursor.pointTrack', { cursor, trackIndex });
  await client.request('slot.select', { trackIndex, slotIndex, mechanism: 'track' });
  const r = await pollUntil(async () => {
    const s = await cursorStatus(cursor);
    return s.exists && s.trackPosition === trackIndex && s.sceneIndex === slotIndex;
  }, 4000, 5);
  if (!r.ok) throw new Error(`pointing ${cursor} at (${trackIndex},${slotIndex}) never confirmed`);
}

const { trackA } = await ensureFixtureTracks();
note(`gn-A at index ${trackA}`);
for (const c of ['0', '1']) await client.request('cursor.pin', { cursor: c, pinned: false });

const point: Op[] = [
  { method: 'cursor.pointTrack', params: { cursor: '0', trackIndex: trackA } },
  { method: 'slot.select', params: { trackIndex: trackA, slotIndex: 0, mechanism: 'track' } },
];
const setGrid1: Op = { method: 'cursor.setStepSize', params: { cursor: '0', stepSize: 1 } };

/** One trial: arrive on a WRONG grid, write, wait `delay`, set props. */
async function trial(delayMs: number): Promise<boolean> {
  await pointVerified('0', trackA, 0);
  // The poisoned inbound state: the grid the read path leaves behind.
  await client.request('cursor.setStepSize', { cursor: '0', stepSize: 0.0625 });
  await sleep(SETTLE);
  await client.request('cursor.clearNotes', { cursor: '0' });
  await sleep(SETTLE);

  // Stage 0 — exactly what `encodeOp('note.write')` emits.
  await batch([...point, setGrid1, { method: 'cursor.setNotes', params: { cursor: '0', channel: 0, notes: [[0, 60, 100, 1]] } }]);
  await sleep(delayMs);
  // Stage 1 — exactly what `encodeOp('note.props')` emits.
  await batch([...point, setGrid1, { method: 'cursor.setNoteProps', params: { cursor: '0', x: 0, y: 60, props: { pan: -0.25 } } }]);
  await sleep(SETTLE);

  // Read through a cursor that took no part in the write (part 4's lesson).
  await pointVerified('1', trackA, 0);
  await client.request('cursor.setStepSize', { cursor: '1', stepSize: 1 });
  await sleep(SETTLE);
  const res = (await client.request('cursor.getNotesVerbose', { cursor: '1', maxX: 64 })) as { notes: VerboseStep[] };
  return res.notes[0]?.['pan'] === -0.25;
}

console.log(`-- how many of ${REPS} property writes land, per gap after the grid change?\n`);

let firstClean: number | undefined;
for (const delay of DELAYS) {
  let landed = 0;
  for (let i = 0; i < REPS; i++) if (await trial(delay)) landed++;
  const verdict = landed === REPS ? 'all landed' : landed === 0 ? 'ALL SILENTLY DISCARDED' : 'INTERMITTENT';
  note(`gap ${String(delay).padStart(3)}ms -> ${landed}/${REPS} ${verdict}`);
  if (landed === REPS && firstClean === undefined) firstClean = delay;
}

console.log('');
check('a same-turn props write after a grid change is NOT reliable (the defect)',
  firstClean !== undefined && firstClean > 24, { firstCleanGapMs: firstClean });
check('some bounded settle DOES make it reliable (so a settle is the right fix)',
  firstClean !== undefined, { firstCleanGapMs: firstClean });
note(`=> smallest reliable gap measured: ${firstClean ?? 'none within ' + DELAYS[DELAYS.length - 1] + 'ms'}`);

await pointVerified('0', trackA, 0);
await client.request('cursor.clearNotes', { cursor: '0' });
await sleep(SETTLE);
note('fixture clip cleared');

client.disconnect();
console.log(`\n${failureCount() === 0 ? 'ALL PASS' : `${failureCount()} FAILURE(S)`}`);
process.exit(failureCount() === 0 ? 0 : 1);
