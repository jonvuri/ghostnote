/**
 * E15-D, part 3 — `cursor.setNoteProps` and the grid it reads through.
 *
 * Part 2 showed the two runs of C-pressure emit BYTE-IDENTICAL frames and get
 * different results, so the variable is inbound cursor state, not the request.
 * The one piece of inbound state that differs is the pool cursor's STEP SIZE:
 * the passing run inherited grid 1 from the probe before it, the failing run
 * inherited grid 0.0625 from `C-notes`'s readback (`scanStepSize(4)`).
 *
 * The mechanism that would explain it: `cursor.setNoteProps` is the only write
 * op whose handler READS — `clip.getStep(channel, x, y)` — before it mutates.
 * E2 already established that reads lag a write by a turn; `e15d-pointing` §C2
 * measured `setStepSize` taking ~117ms to become observable to a scan, against a
 * `noteWrite` settle budget of 25ms. So a same-request `setStepSize` steers
 * `setNotes` (a pure write, proven in part 1) but NOT the `getStep` inside
 * `setNoteProps`, which still indexes the OLD grid.
 *
 * This probe varies exactly one thing — the grid the cursor is already on when
 * the sequence starts — and holds everything else constant.
 *
 *   npx tsx src/probes/e15d-props.ts
 *
 * ⚠ Writes into the gn-A fixture clip at scene 0. Creates no tracks.
 */
import { client, check, note, failureCount, pollUntil, cursorStatus } from './lib.js';

const WRITE = '0';
const READ = '1';
const SETTLE = 400;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Op = { method: string; params?: Record<string, unknown> };
type VerboseStep = Record<string, number | boolean | string>;

const batch = (ops: Op[]) =>
  client.request('batch.run', { ops: ops.map((o) => ({ method: o.method, params: o.params ?? {} })), verbose: true });

const pointOps = (cursor: string, trackIndex: number, slotIndex: number): Op[] => [
  { method: 'cursor.pointTrack', params: { cursor, trackIndex } },
  { method: 'slot.select', params: { trackIndex, slotIndex, mechanism: 'track' } },
];

async function pointVerified(cursor: string, trackIndex: number, slotIndex: number): Promise<void> {
  await client.request('cursor.pointTrack', { cursor, trackIndex });
  await client.request('slot.select', { trackIndex, slotIndex, mechanism: 'track' });
  const r = await pollUntil(async () => {
    const s = await cursorStatus(cursor);
    return s.exists && s.trackPosition === trackIndex && s.sceneIndex === slotIndex;
  }, 4000, 5);
  if (!r.ok) throw new Error(`pointing ${cursor} at (${trackIndex},${slotIndex}) never confirmed`);
}

/** Set the grid in its own request and wait far past the ~117ms it needs. */
async function setGrid(cursor: string, stepSize: number): Promise<void> {
  await client.request('cursor.setStepSize', { cursor, stepSize });
  await sleep(SETTLE);
}

/** A fully-settled read through a cursor that took no part in the write. */
async function readProps(trackIndex: number, stepSize: number, cursor = READ): Promise<VerboseStep | undefined> {
  await pointVerified(cursor, trackIndex, 0);
  await setGrid(cursor, stepSize);
  const res = (await client.request('cursor.getNotesVerbose', { cursor, maxX: 64 })) as { notes: VerboseStep[] };
  return res.notes[0];
}

const show = (s: VerboseStep | undefined) =>
  s === undefined ? '(no note)' : `x=${s['x']} y=${s['y']} gain=${s['gain']} timbre=${s['timbre']} pressure=${s['pressure']}`;

const rows = (await client.request('track.list')) as { tracks: { index: number; name: string }[] };
const trackA = rows.tracks.find((t) => t.name === 'gn-A')?.index;
if (trackA === undefined) throw new Error('fixture track gn-A not found');
note(`gn-A at index ${trackA}`);

// A pin left behind by an E1 probe freezes a cursor, and a frozen cursor would
// make every reading below a statement about the pin rather than about the grid.
for (const c of [WRITE, READ, '2']) {
  await client.request('cursor.pin', { cursor: c, pinned: false });
  note(`cursor ${c}: ${JSON.stringify(await cursorStatus(c))}`);
}

/**
 * The three batches `LiveAdapter` sends for
 * `note.write {gain, timbre, pressure}`, frame for frame.
 */
async function adapterSequence(): Promise<void> {
  const p = pointOps(WRITE, trackA!, 0);
  const grid: Op = { method: 'cursor.setStepSize', params: { cursor: WRITE, stepSize: 1 } };
  await batch([...p, { method: 'cursor.clearNotes', params: { cursor: WRITE } }]);
  await sleep(25);
  await batch([...p, grid, { method: 'cursor.setNotes', params: { cursor: WRITE, channel: 0, notes: [[0, 60, 100, 1]] } }]);
  await sleep(25);
  await batch([...p, grid, { method: 'cursor.setNoteProps', params: { cursor: WRITE, x: 0, y: 60, props: { gain: 0.7, timbre: 0.3 } } }]);
  await sleep(25);
  await batch([...p, grid, { method: 'cursor.setNoteProps', params: { cursor: WRITE, x: 0, y: 60, props: { pressure: 0.9 } } }]);
  await sleep(25);
}

// ================================================ A. does the inbound grid decide it?

console.log('-- A. same frames, varying ONLY the grid the cursor arrives on');

const results: { inbound: number; gain: unknown; timbre: unknown; pressure: unknown }[] = [];
for (const inbound of [1, 0.5, 0.25, 0.0625]) {
  await pointVerified(WRITE, trackA, 0);
  await setGrid(WRITE, inbound); // fully settled, so ONLY this differs
  await adapterSequence();
  await sleep(SETTLE);
  const got = await readProps(trackA, 1);
  note(`inbound grid ${String(inbound).padEnd(7)} -> ${show(got)}`);
  results.push({ inbound, gain: got?.['gain'], timbre: got?.['timbre'], pressure: got?.['pressure'] });
}

const atOne = results.find((r) => r.inbound === 1)!;
const changed = results.filter((r) => r.inbound !== 1);
// ⚠ This asserts the TRAP, not the fix. Arriving already on the grid the write
// wants means `setStepSize` changes nothing and the properties land; arriving on
// any other grid means the same frames silently discard every property. That
// asymmetry IS finding E15-D, and it is what the contract's
// `OP_SETTLE_BEFORE: {'note.props': 'gridChange'}` exists to defeat.
check('VERDICT A: properties land only when the cursor ALREADY had the right grid (E15-D)',
  atOne.gain === 1.4 && changed.every((r) => r.gain === 0),
  { arrivedAtGrid1: atOne, arrivedElsewhere: changed });

// ================================================ B. does a settled grid fix it?

console.log('\n-- B. the same sequence, but with the grid SETTLED before the props batches');

await pointVerified(WRITE, trackA, 0);
await setGrid(WRITE, 0.0625); // the poisoned inbound state from A
const p = pointOps(WRITE, trackA, 0);
await batch([...p, { method: 'cursor.clearNotes', params: { cursor: WRITE } }]);
await sleep(25);
await setGrid(WRITE, 1); // ← the only change: its own request, fully settled
await batch([...p, { method: 'cursor.setNotes', params: { cursor: WRITE, channel: 0, notes: [[0, 60, 100, 1]] } }]);
await sleep(25);
await batch([...p, { method: 'cursor.setNoteProps', params: { cursor: WRITE, x: 0, y: 60, props: { gain: 0.7, timbre: 0.3 } } }]);
await sleep(25);
await batch([...p, { method: 'cursor.setNoteProps', params: { cursor: WRITE, x: 0, y: 60, props: { pressure: 0.9 } } }]);
await sleep(SETTLE);

const settled = await readProps(trackA, 1);
note(`grid settled before props -> ${show(settled)}`);
// The fix, measured: the ONE change from section A's failing rows is a settled
// grid, and it is sufficient. (`pressure` stays 0 here for an unrelated reason —
// part 4: it never persists at all.)
check('VERDICT B: settling the grid before setNoteProps makes the properties land (E15-D)',
  settled?.['gain'] === 1.4 && Math.abs((settled?.['timbre'] as number) - 0.3) < 2e-3,
  { gain: settled?.['gain'], timbre: settled?.['timbre'] });

// ================================================ C. is READBACK grid-sensitive?

console.log('\n-- C. read the SAME clip at three grids, and through three cursors');

for (const g of [1, 0.25, 0.0625]) {
  note(`read at grid ${String(g).padEnd(7)} -> ${show(await readProps(trackA, g))}`);
}
for (const c of ['0', '1', '2']) {
  note(`read at grid 1 via cursor ${c} -> ${show(await readProps(trackA, 1, c))}`);
}

// ================================================ D. gain, on its own

console.log('\n-- D. does gain land at all, given a settled grid? (E2 says 0.7 -> 1.4)');

await pointVerified(WRITE, trackA, 0);
await setGrid(WRITE, 1);
await client.request('cursor.clearNotes', { cursor: WRITE });
await sleep(SETTLE);
await client.request('cursor.setNotes', { cursor: WRITE, channel: 0, notes: [[0, 60, 100, 1]] });
await sleep(SETTLE);
const beforeProps = await readProps(trackA, 1);
note(`plain note, no props written: ${show(beforeProps)}`);
await pointVerified(WRITE, trackA, 0);
await setGrid(WRITE, 1);
await client.request('cursor.setNoteProps', { cursor: WRITE, x: 0, y: 60, props: { gain: 0.7 } });
await sleep(SETTLE);
const afterGain = await readProps(trackA, 1);
note(`after a settled setNoteProps{gain:0.7}: ${show(afterGain)}`);
check('gain reads back 2x written when everything is settled (E2)',
  Math.abs((afterGain?.['gain'] as number) - 1.4) < 1e-6, { gain: afterGain?.['gain'] });
check('a plain note reports gain 0, NOT the 0.5 the decoder calls its default',
  beforeProps?.['gain'] === 0, { gain: beforeProps?.['gain'] });

// ---------------------------------------------------------------- cleanup

await pointVerified(WRITE, trackA, 0);
await client.request('cursor.clearNotes', { cursor: WRITE });
await sleep(SETTLE);
note('fixture clip cleared');

client.disconnect();
console.log(`\n${failureCount() === 0 ? 'ALL PASS' : `${failureCount()} FAILURE(S)`}`);
process.exit(failureCount() === 0 ? 0 : 1);
