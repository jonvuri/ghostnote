/**
 * E8 — Concurrency & safety mechanics (SPIKE_PLAN §4), automated part.
 *
 * De-risks the §8 batch/safety machinery (interference — which needs the user
 * at the keyboard — is e08b):
 *   A. throughput: a server-side batch handler (N ops, one request → one
 *      control-surface turn) vs N round-trips, for the fast note-write class.
 *   B. staged pacing: a batch mixing note writes with device inserts, paced
 *      delayMs apart so the ~600ms device-insert settle (E3) is respected;
 *      confirm every op lands by readback.
 *   C. mid-batch showPopupNotification — fires as a progress signal without
 *      stalling the paced batch.
 *   D. stale-revision guard — a write tagged with a superseded revision is
 *      rejected whole (applies nothing); a fresh one applies.
 *
 * Fixtures restored at the end (gn-A slot0 [[0,60,100,1]], gn-B slot0
 * [[2,62,100,1]], gn-A slot1 [[1,61,100,1]]).
 */
import {
  client, check, note, failureCount, pollUntil, point, getNotes,
  ensureFixtureTracks, type Note,
} from './lib.js';

const MECH = 'trackThenSlot';
const CURSOR = '0';
const POLYSYNTH = 'a9ffacb5-33e9-4fc7-8621-b1af31e410ef';

type BatchResult = {
  applied: boolean; rejected?: boolean; reason?: string;
  expected?: number; actual?: number;
  paced?: boolean; scheduled?: number; delayMs?: number;
  count?: number; failures?: number; elapsedMicros?: number; revision: number;
};
const batch = async (ops: unknown[], extra: Record<string, unknown> = {}) =>
  (await client.request('batch.run', { ops, ...extra }, 30000)) as BatchResult;
const getRevision = async () =>
  ((await client.request('revision.get')) as { revision: number }).revision;
const devList = async () =>
  (await client.request('device.list', { cursor: CURSOR })) as { count: number };

/** 240 distinct (x,y) note-write ops — 4 pitch rows × 60 steps. */
function noteOps(n: number): { method: string; params: unknown }[] {
  const ops: { method: string; params: unknown }[] = [];
  for (let i = 0; i < n; i++) {
    const x = i % 60;
    const y = 40 + Math.floor(i / 60);
    ops.push({ method: 'cursor.setNotes', params: { cursor: CURSOR, notes: [[x, y, 100, 1]] } });
  }
  return ops;
}
const N = 240;

await client.connect();
console.log('connected\n');
const { trackA } = await ensureFixtureTracks();
await point(CURSOR, trackA, 0, MECH);

// ---------------------------------------------------------------- A. throughput
console.log('-- A. throughput: one batch request vs N round-trips (N=' + N + ' note writes)');
const ops = noteOps(N);

await client.request('cursor.clearNotes', { cursor: CURSOR });
await pollUntil(async () => (await getNotes(CURSOR)).length === 0);

const t0 = Date.now();
const bres = await batch(ops);
const batchWall = Date.now() - t0;
const landedBatch = await pollUntil(async () => (await getNotes(CURSOR)).length === N, 8000);
note(`batch: ${N} ops in ONE request — server elapsed=${bres.elapsedMicros}µs, `
  + `client wall=${batchWall}ms, failures=${bres.failures}`);
check('batch applied all ops in a single control-surface turn',
  bres.applied && bres.failures === 0 && landedBatch.ok,
  { serverMicros: bres.elapsedMicros, notesLanded: (await getNotes(CURSOR)).length });

await client.request('cursor.clearNotes', { cursor: CURSOR });
await pollUntil(async () => (await getNotes(CURSOR)).length === 0);

const t1 = Date.now();
for (const op of ops) {
  await client.request(op.method, op.params as Record<string, unknown>);
}
const rtWall = Date.now() - t1;
const landedRT = await pollUntil(async () => (await getNotes(CURSOR)).length === N, 8000);
note(`N round-trips: ${N} separate requests — client wall=${rtWall}ms`);
check('N round-trips produce the same result (slower)',
  landedRT.ok, { notesLanded: (await getNotes(CURSOR)).length });
const speedup = (rtWall / Math.max(batchWall, 1));
note(`=> batch is ${speedup.toFixed(1)}× faster wall-clock (${rtWall}ms → ${batchWall}ms). `
  + `The N-turn tick tax collapses to one turn; readback is one turn later regardless of N.`);
check('the batch is materially faster than N round-trips', speedup >= 3, { speedup: speedup.toFixed(1) });

// ---------------------------------------------------------------- B. staged pacing
console.log('\n-- B. staged pacing: note writes + device inserts, paced for the ~600ms insert settle');
await client.request('cursor.clearNotes', { cursor: CURSOR });
// clear any devices first
for (let g = 0; g < 8 && (await devList()).count > 0; g++) {
  await client.request('device.delete', { cursor: CURSOR, deviceIndex: 0 });
  await pollUntil(async () => (await devList()).count < 8, 4000);
  if ((await devList()).count === 0) break;
}
const DELAY = 650; // E3 device-insert budget
const pacedOps = [
  { method: 'cursor.setNotes', params: { cursor: CURSOR, notes: [[0, 60, 100, 1]] } },
  { method: 'device.insertBitwig', params: { cursor: CURSOR, uuid: POLYSYNTH } },
  { method: 'cursor.setNotes', params: { cursor: CURSOR, notes: [[1, 61, 100, 1]] } },
  { method: 'device.insertBitwig', params: { cursor: CURSOR, uuid: POLYSYNTH } },
  { method: 'cursor.setNotes', params: { cursor: CURSOR, notes: [[2, 62, 100, 1]] } },
];
const pt0 = Date.now();
const pres = await batch(pacedOps, { delayMs: DELAY });
note(`paced batch accepted: scheduled=${pres.scheduled}, delayMs=${pres.delayMs}, returned in ${Date.now() - pt0}ms`);
check('a paced batch returns immediately (does not block on settle)',
  pres.paced === true && pres.scheduled === pacedOps.length && (Date.now() - pt0) < DELAY);
// wait for the whole staged sequence to drain, then verify by readback
const wantNotes: Note[] = [[0, 60, 100, 1], [1, 61, 100, 1], [2, 62, 100, 1]];
const drained = await pollUntil(async () => {
  const notes = await getNotes(CURSOR);
  const devs = (await devList()).count;
  return notes.length === 3 && devs === 2;
}, 8000);
const finalNotes = await getNotes(CURSOR);
const finalDevs = (await devList()).count;
note(`after drain (${drained.ms}ms): notes=${finalNotes.length}, devices=${finalDevs}`);
check('every op in the paced batch landed (3 notes + 2 device inserts), settle respected',
  drained.ok && finalNotes.length === 3 && finalDevs === 2,
  { notes: finalNotes.length, devices: finalDevs });
void wantNotes;

// clean the inserted devices
for (let g = 0; g < 8 && (await devList()).count > 0; g++) {
  await client.request('device.delete', { cursor: CURSOR, deviceIndex: 0 });
  await pollUntil(async () => (await devList()).count < 8, 4000);
  if ((await devList()).count === 0) break;
}

// ---------------------------------------------------------------- C. mid-batch notify
console.log('\n-- C. mid-batch showPopupNotification as a progress signal (watch Bitwig for popups)');
await client.request('cursor.clearNotes', { cursor: CURSOR });
const progressOps = [
  { method: 'notify', params: { message: 'ghostnote batch 0%' } },
  { method: 'cursor.setNotes', params: { cursor: CURSOR, notes: [[0, 60, 100, 1]] } },
  { method: 'notify', params: { message: 'ghostnote batch 50%' } },
  { method: 'cursor.setNotes', params: { cursor: CURSOR, notes: [[4, 64, 100, 1]] } },
  { method: 'notify', params: { message: 'ghostnote batch 100%' } },
];
const ct0 = Date.now();
const cres = await batch(progressOps, { delayMs: 400 });
// each notify + write turn is ~400ms apart; total ~2s for 5 ops
const cdrain = await pollUntil(async () => (await getNotes(CURSOR)).length === 2, 6000);
note(`paced progress batch: ${progressOps.length} ops, drained in ${Date.now() - ct0}ms`);
check('mid-batch notifications fire without stalling the batch (notes still landed)',
  cres.applied && cdrain.ok, { notesLanded: (await getNotes(CURSOR)).length });
note('=> 3 popups (0/50/100%) should have appeared in Bitwig, spaced across the batch —');
note('   showPopupNotification is a usable progress-UX signal for a paced batch.');

// ---------------------------------------------------------------- D. revision guard
console.log('\n-- D. stale-revision guard (optimistic concurrency)');
await client.request('cursor.clearNotes', { cursor: CURSOR });
await pollUntil(async () => (await getNotes(CURSOR)).length === 0);

// D1: a batch tagged with the CURRENT revision applies and bumps it.
const r0 = await getRevision();
const d1 = await batch(
  [{ method: 'cursor.setNotes', params: { cursor: CURSOR, notes: [[10, 70, 100, 1]] } }],
  { ifRevision: r0 });
await pollUntil(async () => (await getNotes(CURSOR)).length === 1, 4000);
check('a batch tagged with the current revision applies and bumps the revision',
  d1.applied && !d1.rejected && d1.revision === r0 + 1, { before: r0, after: d1.revision });

// D2: an interfering edit bumps the revision; a batch tagged with the STALE
// revision is rejected whole — nothing applied.
const rBefore = await getRevision();
await client.request('revision.bump'); // simulate a concurrent user/agent edit
const rAfterBump = await getRevision();
const notesBeforeStale = (await getNotes(CURSOR)).length;
const d2 = await batch(
  [{ method: 'cursor.setNotes', params: { cursor: CURSOR, notes: [[20, 80, 100, 1]] } }],
  { ifRevision: rBefore });
await new Promise((r) => setTimeout(r, 300)); // give any (wrongly-applied) write a turn to show
const notesAfterStale = (await getNotes(CURSOR)).length;
check('an interfering edit bumps the revision',
  rAfterBump === rBefore + 1, { before: rBefore, after: rAfterBump });
check('a batch tagged with a STALE revision is rejected whole (nothing applied)',
  d2.applied === false && d2.rejected === true && d2.reason === 'stale-revision'
  && notesAfterStale === notesBeforeStale,
  { expected: d2.expected, actual: d2.actual, notesBefore: notesBeforeStale, notesAfter: notesAfterStale });

// D3: resubmitting against the fresh revision applies.
const rFresh = await getRevision();
const d3 = await batch(
  [{ method: 'cursor.setNotes', params: { cursor: CURSOR, notes: [[20, 80, 100, 1]] } }],
  { ifRevision: rFresh });
const d3landed = await pollUntil(async () => (await getNotes(CURSOR)).length === notesBeforeStale + 1, 4000);
check('resubmitting the rejected write against the fresh revision applies',
  d3.applied && !d3.rejected && d3landed.ok, { revision: d3.revision });

// ---------------------------------------------------------------- cleanup
console.log('\n-- cleanup: restore fixtures');
for (let g = 0; g < 8 && (await devList()).count > 0; g++) {
  await client.request('device.delete', { cursor: CURSOR, deviceIndex: 0 });
  await pollUntil(async () => (await devList()).count < 8, 4000);
  if ((await devList()).count === 0) break;
}
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

console.log(failureCount() === 0 ? '\nE8: all checks passed' : `\nE8: ${failureCount()} FAILURES`);
client.disconnect();
process.exit(failureCount() === 0 ? 0 : 1);
