/**
 * E15-D, part 4 — is `pressure` actually IN the clip, or only in the cursor that
 * wrote it?
 *
 * Part 3 turned up something nobody was looking for. After a settled
 * `setNoteProps{pressure:0.9}`, the same note reads back:
 *
 *     via cursor 0 (the one that wrote it) -> pressure = 0.9
 *     via cursor 1                         -> pressure = 0
 *     via cursor 2                         -> pressure = 0
 *
 * while `gain` and `timbre`, written in the same breath, read 1.4 / 0.3 through
 * ALL THREE. So either pressure propagates to other cursors far more slowly than
 * every other property, or `setPressure` never reaches the engine at all and the
 * writing cursor is reporting its own optimistic `NoteStep` cache back to us.
 *
 * This matters well beyond E15-D. `LiveAdapter` reads through the SAME pool
 * cursor it writes through, so if it is the second explanation then C-pressure
 * "passing" means nothing, E15-C is built on a measurement artifact, and the
 * three-turn note write it justifies is paying for something that does not work.
 *
 * The discriminator: make the writing cursor forget. Point it away, poll-verify
 * it moved, point it back, and read again. A cache does not survive that; the
 * clip does.
 *
 *   npx tsx src/probes/e15d-persist.ts
 *
 * ⚠ Writes into the gn-A and gn-B fixture clips at scene 0. Creates no tracks.
 */
import { client, check, note, failureCount, pollUntil, cursorStatus, ensureFixtureTracks } from './lib.js';

const SETTLE = 500;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
type VerboseStep = Record<string, number | boolean | string>;

async function pointVerified(cursor: string, trackIndex: number, slotIndex: number): Promise<void> {
  await client.request('cursor.pointTrack', { cursor, trackIndex });
  await client.request('slot.select', { trackIndex, slotIndex, mechanism: 'track' });
  const r = await pollUntil(async () => {
    const s = await cursorStatus(cursor);
    return s.exists && s.trackPosition === trackIndex && s.sceneIndex === slotIndex;
  }, 4000, 5);
  if (!r.ok) throw new Error(`pointing ${cursor} at (${trackIndex},${slotIndex}) never confirmed`);
}

async function grid(cursor: string, stepSize: number): Promise<void> {
  await client.request('cursor.setStepSize', { cursor, stepSize });
  await sleep(SETTLE);
}

async function scan(cursor: string): Promise<VerboseStep | undefined> {
  const res = (await client.request('cursor.getNotesVerbose', { cursor, maxX: 64 })) as { notes: VerboseStep[] };
  return res.notes[0];
}

const props = (s: VerboseStep | undefined) =>
  s === undefined ? '(no note)' : `gain=${s['gain']} timbre=${s['timbre']} pan=${s['pan']} pressure=${s['pressure']}`;

const { trackA, trackB } = await ensureFixtureTracks();
note(`gn-A=${trackA} gn-B=${trackB}`);
for (const c of ['0', '1', '2']) await client.request('cursor.pin', { cursor: c, pinned: false });

// ------------------------------------------- a clean note, then pressure alone

console.log('-- A. write pressure ALONE onto a clean note, everything settled');

await pointVerified('0', trackA, 0);
await grid('0', 1);
await client.request('cursor.clearNotes', { cursor: '0' });
await sleep(SETTLE);
await client.request('cursor.setNotes', { cursor: '0', channel: 0, notes: [[0, 60, 100, 1]] });
await sleep(SETTLE);
note(`fresh note:              ${props(await scan('0'))}`);

await client.request('cursor.setNoteProps', { cursor: '0', x: 0, y: 60, props: { pressure: 0.9 } });
await sleep(SETTLE);
const writerSees = await scan('0');
note(`via the WRITING cursor:  ${props(writerSees)}`);

await pointVerified('1', trackA, 0);
await grid('1', 1);
const otherSees = await scan('1');
note(`via a different cursor:  ${props(otherSees)}`);

// ⚠ Both of these assert the TRAP. The phantom is precisely that the first is
// true and the second is false.
check('the phantom: a settled pressure write IS visible to the cursor that wrote it',
  writerSees?.['pressure'] === 0.9, { pressure: writerSees?.['pressure'] });
check('...and is NOT visible to any other cursor — so it is not in the clip (E15-E)',
  otherSees?.['pressure'] === 0, { pressure: otherSees?.['pressure'] });

// ------------------------------------------- make the writer forget

console.log('\n-- B. point the writing cursor away and back, then ask it again');

await pointVerified('0', trackB, 0);
await sleep(SETTLE);
note(`cursor 0 parked on gn-B: ${props(await scan('0'))}`);
await pointVerified('0', trackA, 0);
await grid('0', 1);
const afterRepoint = await scan('0');
note(`cursor 0 back on gn-A:   ${props(afterRepoint)}`);

check('VERDICT: pressure does NOT survive the writing cursor being re-pointed (E15-E)',
  afterRepoint?.['pressure'] === 0, {
    beforeRepoint: writerSees?.['pressure'], afterRepoint: afterRepoint?.['pressure'],
  });

// ------------------------------------------- the same treatment for a control

console.log('\n-- C. control: does `pan` (a property nobody suspects) behave the same way?');

await pointVerified('0', trackA, 0);
await grid('0', 1);
await client.request('cursor.setNoteProps', { cursor: '0', x: 0, y: 60, props: { pan: -0.25 } });
await sleep(SETTLE);
note(`via the WRITING cursor:  ${props(await scan('0'))}`);
await pointVerified('1', trackA, 0);
await grid('1', 1);
note(`via a different cursor:  ${props(await scan('1'))}`);
await pointVerified('0', trackB, 0);
await sleep(SETTLE);
await pointVerified('0', trackA, 0);
await grid('0', 1);
const panAfter = await scan('0');
note(`after re-point:          ${props(panAfter)}`);
check('pan persists across a re-point (so the re-point test is not simply destructive)',
  panAfter?.['pan'] === -0.25, { pan: panAfter?.['pan'] });

// ------------------------------------------- the whole property set

console.log('\n-- D. which of the 19 expression properties actually PERSIST?');
console.log('   (write alone, settled -> read via writer -> re-point away and back -> read again)');

/** Every property `cursor.setNoteProps` accepts, with a distinctive test value. */
const CASES: [string, unknown, unknown][] = [
  // [prop, written, expected on readback]
  ['releaseVelocity', 0.5, 0.5],
  ['velocitySpread', 0.1, 0.1],
  ['gain', 0.7, 1.4], // ⚠ E2: reads back 2x
  ['pan', -0.25, -0.25],
  ['pressure', 0.9, 0.9],
  ['timbre', 0.3, 0.3],
  ['transpose', 1.5, 1.5],
  ['chance', 0.45, 0.45],
  ['isChanceEnabled', true, true],
  ['isMuted', true, true],
  ['isOccurrenceEnabled', true, true],
  ['occurrence', 'FIRST', 'FIRST'],
  ['isRepeatEnabled', true, true],
  ['repeatCount', 3, 3],
  ['repeatCurve', 0.5, 0.5],
  ['repeatVelocityCurve', -0.3, -0.3],
  ['repeatVelocityEnd', 0.2, 0.2],
];

const near = (got: unknown, want: unknown) =>
  typeof got === 'number' && typeof want === 'number' ? Math.abs(got - want) < 2e-3 : got === want;

const persists: string[] = [];
const phantom: string[] = [];
const refused: string[] = [];

for (const [prop, written, expected] of CASES) {
  // A clean note per property, so no earlier write can explain the result.
  await pointVerified('0', trackA, 0);
  await grid('0', 1);
  await client.request('cursor.clearNotes', { cursor: '0' });
  await sleep(SETTLE);
  await client.request('cursor.setNotes', { cursor: '0', channel: 0, notes: [[0, 60, 100, 1]] });
  await sleep(SETTLE);
  await client.request('cursor.setNoteProps', { cursor: '0', x: 0, y: 60, props: { [prop]: written } });
  await sleep(SETTLE);
  const immediate = (await scan('0'))?.[prop];

  // Force the writing cursor to drop whatever it is holding locally.
  await pointVerified('0', trackB, 0);
  await sleep(SETTLE);
  await pointVerified('0', trackA, 0);
  await grid('0', 1);
  const durable = (await scan('0'))?.[prop];

  const tookLocally = near(immediate, expected);
  const tookDurably = near(durable, expected);
  if (tookDurably) persists.push(prop);
  else if (tookLocally) phantom.push(prop);
  else refused.push(prop);
  note(`${prop.padEnd(20)} wrote ${String(written).padEnd(6)} -> writer sees ${String(immediate).padEnd(8)} -> after re-point ${String(durable).padEnd(8)} ${tookDurably ? 'PERSISTS' : tookLocally ? '*** PHANTOM ***' : 'refused'}`);
}

note(`persists (${persists.length}): ${persists.join(', ')}`);
note(`PHANTOM  (${phantom.length}): ${phantom.join(', ') || '(none)'}`);
note(`refused  (${refused.length}): ${refused.join(', ') || '(none)'}`);
check('VERDICT: pressure is the ONLY phantom; the other 16 persist (E15-E)',
  phantom.length === 1 && phantom[0] === 'pressure' && persists.length === 16 && refused.length === 0,
  { phantom, persists: persists.length, refused });

// ------------------------------------------- cleanup

await pointVerified('0', trackA, 0);
await client.request('cursor.clearNotes', { cursor: '0' });
await sleep(SETTLE);
note('fixture clip cleared');

client.disconnect();
console.log(`\n${failureCount() === 0 ? 'ALL PASS' : `${failureCount()} FAILURE(S)`}`);
process.exit(failureCount() === 0 ? 0 : 1);
