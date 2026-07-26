/**
 * E15-F — can the READING write op share a turn with a re-point?
 *
 * PHASE-0-SESSION-2 item 4 proposes hoisting the `note.props` ops that
 * `splitNoteWrite` generates into ONE trailing stage, so N clips carrying
 * expression cost 2 stages and one `gridChange` rather than 2N and N. Its
 * justification is E15-D's "ops addressing different clips MAY share a stage".
 *
 * ⚠ That is an inference, and it may not hold. E15-D measured two `setNotes` —
 * pure WRITES — sharing a turn (§E). `cursor.setNoteProps` is explicitly the one
 * write op whose handler READS first, and the entire E15-D lesson is that writes
 * are steered by same-turn state while reads are not. Extending the result from
 * one to the other is exactly the step E15-D's own retraction of finding C warns
 * against. Nothing has ever measured a re-point followed by a `getStep` in one
 * turn, because the shipped shape never does it: the props stage always re-points
 * to the clip the create stage was already on, so its `slot.select` is a no-op.
 *
 * So this probe measures the two things the hoist needs, and nothing else:
 *
 *   A. Does `setNoteProps` see a re-point made EARLIER IN THE SAME BATCH?
 *      (control: the same two ops as two batches)
 *   B. Does the whole hoisted shape land end to end on N clips?
 *      (control: the interleaved shape the contract emits today, which is known
 *      good — if the control fails, the rig is at fault and A/B mean nothing)
 *
 * Every readback goes through a DIFFERENT cursor from the one that wrote, per
 * PROJECT_PLAN §4 rule 3a — the rule E15-C and E15-D were both wrong for want of.
 *
 *   npx tsx src/probes/e15f-hoist.ts
 *
 * ⚠ Writes into the gn-A / gn-B fixture clips at scene 0. Creates no tracks.
 * Clears them at the end.
 */
import { client, check, note, failureCount, pollUntil, cursorStatus, ensureFixtureTracks } from './lib.js';

const WRITE = '0';
const READ = '1';
/** Generous by design: this is an instrument, not production pacing. */
const SETTLE = 400;
/** The contract's `gridChange` budget — what a hoisted plan would actually wait. */
const GRID_CHANGE = 144;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Op = { method: string; params?: Record<string, unknown> };
type VerboseStep = Record<string, number | boolean | string>;

const batch = (ops: Op[]) =>
  client.request('batch.run', {
    ops: ops.map((o) => ({ method: o.method, params: o.params ?? {} })),
    verbose: true,
  });

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

/** ⚠ Rule 3a: read through a cursor that took no part in the write. */
async function readOne(trackIndex: number, stepSize = 1): Promise<VerboseStep | undefined> {
  await pointVerified(READ, trackIndex, 0);
  await client.request('cursor.setStepSize', { cursor: READ, stepSize });
  await sleep(SETTLE);
  const res = (await client.request('cursor.getNotesVerbose', { cursor: READ, maxX: 64 })) as { notes: VerboseStep[] };
  return res.notes[0];
}

const panOf = (s: VerboseStep | undefined) => (s === undefined ? undefined : s['pan']);
const show = (s: VerboseStep | undefined) =>
  s === undefined ? '(no note)' : `x=${s['x']} y=${s['y']} pan=${s['pan']} timbre=${s['timbre']}`;

async function clearBoth(a: number, b: number): Promise<void> {
  for (const t of [a, b]) {
    await pointVerified(WRITE, t, 0);
    await client.request('cursor.clearNotes', { cursor: WRITE });
  }
  await sleep(SETTLE);
}

// ---------------------------------------------------------------- setup

const { trackA, trackB } = await ensureFixtureTracks();
note(`fixtures: gn-A=${trackA} gn-B=${trackB}`);
// A pin left behind by an E1 probe would freeze the cursor and make every result
// below a statement about the pin rather than about same-turn re-pointing.
for (const c of [WRITE, READ]) await client.request('cursor.pin', { cursor: c, pinned: false });

/** The frames `encodeOp('note.write')` emits for one clip, grid 1, one note. */
const writeOps = (trackIndex: number, pitch: number): Op[] => [
  ...pointOps(WRITE, trackIndex, 0),
  { method: 'cursor.setStepSize', params: { cursor: WRITE, stepSize: 1 } },
  { method: 'cursor.setNotes', params: { cursor: WRITE, channel: 0, notes: [[0, pitch, 100, 1]] } },
];

/** The frames `encodeOp('note.props')` emits for one clip, grid 1, one note. */
const propsOps = (trackIndex: number, pitch: number, pan: number): Op[] => [
  ...pointOps(WRITE, trackIndex, 0),
  { method: 'cursor.setStepSize', params: { cursor: WRITE, stepSize: 1 } },
  { method: 'cursor.setNoteProps', params: { cursor: WRITE, x: 0, y: pitch, props: { pan } } },
];

// ==================================== A. does setNoteProps survive a re-point?

console.log('\n-- A. two props ops, two clips, ONE batch');
console.log('   The cursor is parked on gn-A and already on grid 1, so the ONLY');
console.log('   variable is whether the re-point to gn-B mid-batch is visible to');
console.log('   the getStep that follows it.');

await clearBoth(trackA, trackB);
// Create both notes first, fully settled, so section A measures ONLY the props.
await batch([...writeOps(trackA, 60), ...writeOps(trackB, 67)]);
await sleep(SETTLE);
// Park the cursor on A, on the grid the props ops want. Nothing left to settle.
await pointVerified(WRITE, trackA, 0);
await client.request('cursor.setStepSize', { cursor: WRITE, stepSize: 1 });
await sleep(SETTLE);

await batch([...propsOps(trackA, 60, -0.25), ...propsOps(trackB, 67, 0.5)]);
await sleep(SETTLE);

const aFirst = await readOne(trackA);
const aSecond = await readOne(trackB);
note(`gn-A (cursor was ALREADY here): ${show(aFirst)}`);
note(`gn-B (re-pointed mid-batch):    ${show(aSecond)}`);

const firstLanded = panOf(aFirst) === -0.25;
const secondLanded = panOf(aSecond) === 0.5;
// ⚠ MEASURED ○ (2026-07-25). The op the cursor was ALREADY pointed at lands; the
// one that had to re-point loses everything, silently, exactly like a grid
// change. So `getStep` does not follow a re-point made in its own turn — and
// SESSION-2 item 4's premise ("E15-D measured that ops addressing different
// clips may share a stage") does not transfer to this op. E15-D measured
// `setNotes`, a pure WRITE. This is the one op that reads first, and the whole
// E15-D lesson is that reads do not see same-turn state.
check('VERDICT A: ✗ EXPECTED — a props op does NOT see a re-point made in its own turn',
  firstLanded && !secondLanded,
  { alreadyPointedLanded: firstLanded, rePointedLanded: secondLanded, gotA: panOf(aFirst), gotB: panOf(aSecond) });

console.log('\n-- A2. the same two props ops as two SEPARATE batches');
console.log('   Isolates the mechanism: if the batch boundary were what mattered,');
console.log('   both would land here. If it is the RE-POINT, gn-B still fails.');
await clearBoth(trackA, trackB);
await batch([...writeOps(trackA, 60), ...writeOps(trackB, 67)]);
await sleep(SETTLE);
await pointVerified(WRITE, trackA, 0);
await client.request('cursor.setStepSize', { cursor: WRITE, stepSize: 1 });
await sleep(SETTLE);

await batch(propsOps(trackA, 60, -0.25));
await sleep(SETTLE);
await batch(propsOps(trackB, 67, 0.5));
await sleep(SETTLE);

const acA = await readOne(trackA);
const acB = await readOne(trackB);
note(`gn-A: ${show(acA)}   gn-B: ${show(acB)}`);
// ⚠ MEASURED: gn-B fails HERE TOO, with its own request and 400ms of settle in
// front of it. That rules out the batch boundary and leaves the re-point as the
// only remaining variable. It also means this is not merely a limit on
// hoisting — a props op that re-points is unsafe in ANY shape.
check('VERDICT A2: ✗ EXPECTED — a separate request does not help; it is the RE-POINT, not the batch',
  panOf(acA) === -0.25 && panOf(acB) !== 0.5, { a: panOf(acA), b: panOf(acB) });

console.log('\n-- A3. and a props op whose re-point already SETTLED?');
console.log('   This is the invariant the shipped contract relies on without');
console.log('   ever having stated it: the props stage re-points to the clip the');
console.log('   create stage was already on, so its point frames are a NO-OP.');
await clearBoth(trackA, trackB);
await batch([...writeOps(trackA, 60), ...writeOps(trackB, 67)]);
await sleep(SETTLE);
// Point at B and let it settle in its OWN request, then send props with the
// cursor already there — the same frames as A2's failing half.
await pointVerified(WRITE, trackB, 0);
await client.request('cursor.setStepSize', { cursor: WRITE, stepSize: 1 });
await sleep(SETTLE);
await batch(propsOps(trackB, 67, 0.5));
await sleep(SETTLE);

const a3B = await readOne(trackB);
note(`gn-B after a SETTLED re-point: ${show(a3B)}`);
check('VERDICT A3: ● a settled re-point is fine — the hazard is the re-point IN the turn',
  panOf(a3B) === 0.5, { b: panOf(a3B) });

// ==================================== B. the whole hoisted plan, end to end

console.log('\n-- B. the shape a hoisted planStages would emit for 2 clips');
console.log('   stage 0: both creates, coalesced   ->  settle gridChange');
console.log('   stage 1: both props, coalesced');

await clearBoth(trackA, trackB);
await batch([...writeOps(trackA, 60), ...writeOps(trackB, 67)]);
await sleep(GRID_CHANGE);
await batch([...propsOps(trackA, 60, -0.25), ...propsOps(trackB, 67, 0.5)]);
await sleep(SETTLE);

const bA = await readOne(trackA);
const bB = await readOne(trackB);
note(`gn-A: ${show(bA)}   gn-B: ${show(bB)}`);
// ⚠ MEASURED ○: expression is lost on at least one clip. This is the verdict
// that retires SESSION-2 item 4's optimization. Note WHICH clip survives is not
// asserted — it moved between runs, and an unstable answer to "which of the two
// silently loses your expression" is a worse property than a stable one.
check('VERDICT B: ✗ EXPECTED — the hoisted 2-stage plan LOSES expression, so the hoist is unsound',
  !(panOf(bA) === -0.25 && panOf(bB) === 0.5), { a: panOf(bA), b: panOf(bB) });

console.log('\n-- B-control: the INTERLEAVED shape the contract emits today');
await clearBoth(trackA, trackB);
await batch(writeOps(trackA, 60));
await sleep(GRID_CHANGE);
await batch(propsOps(trackA, 60, -0.25));
await sleep(GRID_CHANGE);
await batch(writeOps(trackB, 67));
await sleep(GRID_CHANGE);
await batch(propsOps(trackB, 67, 0.5));
await sleep(SETTLE);

const bcA = await readOne(trackA);
const bcB = await readOne(trackB);
note(`gn-A: ${show(bcA)}   gn-B: ${show(bcB)}`);
check('CONTROL B: the shipped interleaved shape lands on both clips (4 stages)',
  panOf(bcA) === -0.25 && panOf(bcB) === 0.5, { a: panOf(bcA), b: panOf(bcB) });

// ==================================== C. the grid the hoist must hold constant

console.log('\n-- C. a props op that changes the grid in its OWN turn');
console.log('   Refines E15-D rather than repeating it. E15-D changed the grid in');
console.log('   an EARLIER request and measured the ~120ms window before a read was');
console.log('   usable. This changes it in the same turn as the read.');

await clearBoth(trackA, trackB);
await batch(writeOps(trackA, 60));
await sleep(GRID_CHANGE);
await batch([
  ...pointOps(WRITE, trackA, 0),
  { method: 'cursor.setStepSize', params: { cursor: WRITE, stepSize: 0.5 } },
  { method: 'cursor.setNoteProps', params: { cursor: WRITE, x: 0, y: 60, props: { pan: -0.25 } } },
]);
await sleep(SETTLE);

const cA = await readOne(trackA);
note(`gn-A after a grid-changing props op: ${show(cA)}`);
// ⚠ MEASURED ●: it LANDS. The note sits at beat 0, which is step 0 on every
// grid, so the read resolves the same cell whether or not the new grid took
// effect. Read together with A2, that reshapes E15-D's mechanism: what breaks a
// `getStep` is the cursor's step data being INVALIDATED and not yet re-fetched —
// by a grid change ~120ms ago, or by a re-point in this turn — and a grid change
// that has not taken effect yet has invalidated nothing. Kept as an assertion
// because the shipped `note.props` frames re-send the grid every time, and this
// is the evidence that doing so is harmless when the value is unchanged.
check('VERDICT C: ● a same-turn grid change does not by itself poison the read',
  panOf(cA) === -0.25, { pan: panOf(cA) });

// ==================================== D. where do the lost properties actually GO?

console.log('\n-- D. the model A/A2/A3/B all fit, and its nastiest consequence');
console.log('   Every result above is explained by ONE rule: `setNoteProps`');
console.log('   resolves against the clip the cursor held at the START of the turn,');
console.log('   whatever it re-points to inside it. (A: turn started on gn-A, so the');
console.log('   gn-A op landed. B stage 1: turn started on gn-B, so the gn-B op');
console.log('   landed, though it was second.)');
console.log('');
console.log('   If that is right, the properties are not DISCARDED — they are');
console.log('   applied to the turn-start clip, and vanish only because there is');
console.log('   usually no note at that cell. Put one there and it is not a loss');
console.log('   any more, it is a write to the WRONG CLIP.');

await clearBoth(trackA, trackB);
// The same cell, y=60, in BOTH clips — the case a real project hits constantly,
// since two clips in one batch are usually two parts of one musical idea.
await batch([...writeOps(trackA, 60), ...writeOps(trackB, 60)]);
await sleep(SETTLE);
// Park on gn-A and settle, so the turn starts there beyond any doubt.
await pointVerified(WRITE, trackA, 0);
await client.request('cursor.setStepSize', { cursor: WRITE, stepSize: 1 });
await sleep(SETTLE);

// Ask for gn-B, and only gn-B.
await batch(propsOps(trackB, 60, 0.5));
await sleep(SETTLE);

const dA = await readOne(trackA);
const dB = await readOne(trackB);
note(`gn-A (NOT addressed): ${show(dA)}`);
note(`gn-B (the target):    ${show(dB)}`);

const landedOnWrongClip = panOf(dA) === 0.5;
const landedOnTarget = panOf(dB) === 0.5;
// ⚠ MEASURED, and the hypothesis above is WRONG — which is the useful part. The
// write went to gn-B, the clip that was actually addressed. Nothing leaked into
// gn-A.
//
// Held against A2, where the identical shape LOST the write, exactly one thing
// differs: there the turn-start clip had no note at the addressed cell, here it
// does. So the mechanism splits in two, and only the first half is stale:
//
//     `clip.getStep(x, y)` resolves against the step data the cursor held at
//     TURN START, but mutating the returned NoteStep writes through to whatever
//     the cursor points at NOW.
//
// That accounts for every row above, including the one that looked backwards
// (B stage 1's SECOND op landing while its first did not — the turn started on
// gn-B, so only gn-B's cell resolved). And the consequence is a good deal better
// than feared: a re-pointing props op LOSES its properties, it does not
// misdirect them. Loss, not corruption.
check('VERDICT D: ● the write reaches the ADDRESSED clip — the staleness is in the lookup, not the target',
  landedOnTarget && !landedOnWrongClip,
  { targetGotIt: landedOnTarget, wrongClipGotIt: landedOnWrongClip, a: panOf(dA), b: panOf(dB) });

console.log('\n-- D2. the remaining corruption question: can it CREATE a note?');
console.log('   The lookup succeeds against the turn-start clip and the write goes');
console.log('   to the target. So what happens when the target has NO note at that');
console.log('   cell — does the property write conjure one?');
await clearBoth(trackA, trackB);
// gn-A gets a note at y=60; gn-B is left EMPTY at that cell (its note is y=72).
await batch([...writeOps(trackA, 60), ...writeOps(trackB, 72)]);
await sleep(SETTLE);
await pointVerified(WRITE, trackA, 0);
await client.request('cursor.setStepSize', { cursor: WRITE, stepSize: 1 });
await sleep(SETTLE);
// Turn-start clip gn-A HAS (0,60); target gn-B does not.
await batch(propsOps(trackB, 60, 0.5));
await sleep(SETTLE);

const d2 = (await client.request('cursor.getNotesVerbose', { cursor: READ, maxX: 64 })) as { notes: VerboseStep[] };
await pointVerified(READ, trackB, 0);
await client.request('cursor.setStepSize', { cursor: READ, stepSize: 1 });
await sleep(SETTLE);
const d2B = (await client.request('cursor.getNotesVerbose', { cursor: READ, maxX: 64 })) as { notes: VerboseStep[] };
const pitches = d2B.notes.map((n) => n['y']);
note(`gn-B now holds pitches ${JSON.stringify(pitches)} (should be [72] only)`);
void d2;
check('VERDICT D2: ● a property write on an absent note creates nothing — it is inert',
  pitches.length === 1 && pitches[0] === 72, { pitches });

// ---------------------------------------------------------------- cleanup

await clearBoth(trackA, trackB);
note('fixture clips cleared');

client.disconnect();
console.log(`\n${failureCount() === 0 ? 'ALL PASS' : `${failureCount()} FAILURE(S)`}`);
process.exit(failureCount() === 0 ? 0 : 1);
