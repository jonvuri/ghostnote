/**
 * E2 — Note round-trip fidelity, grid resolution, observer gotcha,
 * stale-cursor reads. Fully autonomous. Uses the E1 fixture (gn-A/gn-B);
 * creates+deletes a clip at gn-B slot 2 (top-to-bottom: row 3).
 */
import {
  client, check, note, failureCount, pollUntil,
  cursorStatus, getNotes, sameNotes, point, ensureFixtureTracks,
  type Note as N,
} from './lib.js';

const MECH = 'trackThenSlot';
const close = (a: number, b: number, eps = 2e-3) => Math.abs(a - b) <= eps;

await client.connect();
console.log('connected\n');
const { trackA, trackB } = await ensureFixtureTracks();
note(`fixture: gn-A=${trackA}, gn-B=${trackB}`);

// ---- phase A: synchronous visibility of setStep -----------------------
console.log('\n-- phase A: write visibility');
const pA = await point('0', trackA, 0, MECH);
check('cursor0 -> A0', pA.ok, { settleMs: pA.ms });
await client.request('cursor.clearNotes', { cursor: '0' });
await pollUntil(async () => (await getNotes('0')).length === 0);
const sr = (await client.request('cursor.setAndReadNote', { cursor: '0', x: 0, y: 60, vel: 100, dur: 1 })) as any;
note(`same-request readback after setStep: pre=${sr.preState} post=${sr.postState} vel=${sr.postVelocity} dur=${sr.postDuration}`);
check('same-request visibility characterized (either result is a finding)', true, sr);
const nextReq = await pollUntil(async () => (await getNotes('0')).length === 1, 2000, 25);
check('note visible on subsequent request', nextReq.ok, { ms: nextReq.ms });

// ---- phase B: full NoteStep property round-trip -----------------------
console.log('\n-- phase B: full property surface');
const PROPS: Record<string, unknown> = {
  velocity: 0.8, releaseVelocity: 0.5, velocitySpread: 0.1, duration: 0.75,
  gain: 0.7, pan: -0.25, pressure: 0.6, timbre: 0.3, transpose: 1.5,
  chance: 0.45, isChanceEnabled: true,
  occurrence: 'FIRST', isOccurrenceEnabled: true,
  recurrence: [4, 5], isRecurrenceEnabled: true,
  isRepeatEnabled: true, repeatCount: 3, repeatCurve: 0.5,
  repeatVelocityCurve: -0.3, repeatVelocityEnd: 0.2,
};
const applied = (await client.request('cursor.setNoteProps', { cursor: '0', x: 0, y: 60, props: PROPS })) as any;
const applyErrs = Object.entries(applied.applied).filter(([, v]) => v !== 'ok');
check('all property setters accepted', applyErrs.length === 0, applyErrs.length ? applyErrs : undefined);

const readVerbose = async () => {
  const r = (await client.request('cursor.getNotesVerbose', { cursor: '0', maxX: 4 })) as any;
  return r.notes[0];
};
const v1 = await readVerbose();
await new Promise((r) => setTimeout(r, 250));
const v2 = await readVerbose();

const expect: [string, (n: any) => boolean][] = [
  ['velocity', (n) => close(n.velocity, 0.8)],
  ['releaseVelocity', (n) => close(n.releaseVelocity, 0.5)],
  ['velocitySpread', (n) => close(n.velocitySpread, 0.1)],
  ['duration', (n) => close(n.duration, 0.75)],
  ['gain', (n) => close(n.gain, 0.7)],
  ['pan', (n) => close(n.pan, -0.25)],
  ['pressure', (n) => close(n.pressure, 0.6)],
  ['timbre', (n) => close(n.timbre, 0.3)],
  ['transpose', (n) => close(n.transpose, 1.5)],
  ['chance', (n) => close(n.chance, 0.45)],
  ['isChanceEnabled', (n) => n.isChanceEnabled === true],
  ['occurrence', (n) => n.occurrence === 'FIRST'],
  ['isOccurrenceEnabled', (n) => n.isOccurrenceEnabled === true],
  ['recurrenceLength', (n) => n.recurrenceLength === 4],
  ['recurrenceMask', (n) => n.recurrenceMask === 5],
  ['isRecurrenceEnabled', (n) => n.isRecurrenceEnabled === true],
  ['isRepeatEnabled', (n) => n.isRepeatEnabled === true],
  ['repeatCount', (n) => n.repeatCount === 3],
  ['repeatCurve', (n) => close(n.repeatCurve, 0.5)],
  ['repeatVelocityCurve', (n) => close(n.repeatVelocityCurve, -0.3)],
  ['repeatVelocityEnd', (n) => close(n.repeatVelocityEnd, 0.2)],
];
let exact = 0;
for (const [name, pred] of expect) {
  const okNow = v2 && pred(v2);
  if (okNow) exact++;
  else check(`prop ${name} round-trips`, false, { settled: v2?.[name] });
  if (v1 && v2 && JSON.stringify(v1[name]) !== JSON.stringify(v2[name])) {
    note(`prop ${name} settled late: immediate=${v1[name]} settled=${v2[name]}`);
  }
}
check(`property round-trip: ${exact}/${expect.length} exact`, exact === expect.length);

// mute separately (may affect scan state)
await client.request('cursor.setNoteProps', { cursor: '0', x: 0, y: 60, props: { isMuted: true } });
await new Promise((r) => setTimeout(r, 150));
const vm = await readVerbose();
check('muted note still visible to scan with isMuted=true', vm?.isMuted === true, { state: vm ? 'NoteOn' : 'GONE' });
await client.request('cursor.setNoteProps', { cursor: '0', x: 0, y: 60, props: { isMuted: false } });

// ---- phase C: observer gotcha (bare cursor, zero markInterested) ------
console.log('\n-- phase C: bare cursor (no markInterested anywhere)');
const bareStatus = (await client.request('cursor.status', { cursor: 'bare' })) as any;
note(`bare status fields: ${JSON.stringify(bareStatus)}`);
const pBare = await (async () => {
  // point() polls via cursor.status which may be all-ERR for bare; point manually
  await client.request('cursor.pin', { cursor: 'bare', pinned: false });
  await client.request('cursor.pointTrack', { cursor: 'bare', trackIndex: trackA });
  await client.request('slot.select', { trackIndex: trackA, slotIndex: 0, mechanism: 'track' });
  return pollUntil(async () => {
    try {
      const r = (await client.request('cursor.getNotes', { cursor: 'bare' })) as any;
      return r.count === 1;
    } catch {
      return false;
    }
  }, 3000);
})();
try {
  const bareRead = (await client.request('cursor.getNotes', { cursor: 'bare' })) as any;
  note(`bare getStep scan: count=${bareRead.count} clipExists=${bareRead.clipExists} scanMicros=${bareRead.scanMicros}`);
  check('bare cursor getStep works without any markInterested', pBare.ok && bareRead.count === 1);
} catch (err) {
  check('bare cursor getStep works without any markInterested', false, String(err));
}

// ---- phase D: grid resolution (fine cursor, 512-step grid) ------------
console.log('\n-- phase D: grid resolution');
const pFine = await point('fine', trackB, 0, MECH);
check('fine cursor -> B0', pFine.ok, { settleMs: pFine.ms });
// B0 carries E1 fingerprint [[2,62,100,1]] at stepSize 0.25 => beat 0.5
const coarse = (await client.request('cursor.getNotes', { cursor: 'fine' })) as any;
note(`fine@0.25 scan of 512x128: scanMicros=${coarse.scanMicros}, count=${coarse.count}`);
check('fine cursor sees B0 fingerprint at stepSize 0.25', coarse.count >= 1);

await client.request('cursor.setStepSize', { cursor: 'fine', stepSize: 0.03125 });
await new Promise((r) => setTimeout(r, 350)); // setStepSize settles async (e02b)
const fineRead = (await client.request('cursor.getNotes', { cursor: 'fine' })) as any;
const fpFine = (fineRead.notes as N[]).find((n) => n[1] === 62);
check('runtime setStepSize works; note re-indexed on finer grid', fpFine !== undefined && fpFine[0] === 16,
  { expectedX: 16, notes: fineRead.notes });
note(`fine@1/128-note scan: scanMicros=${fineRead.scanMicros}`);

// write off-coarse-grid note at x=3 (beat 0.09375), read back
await client.request('cursor.setNotes', { cursor: 'fine', notes: [[3, 70, 100, 0.05]] });
const offGrid = await pollUntil(async () => {
  const r = (await client.request('cursor.getNotes', { cursor: 'fine' })) as any;
  return (r.notes as N[]).some((n) => n[0] === 3 && n[1] === 70);
}, 2000);
check('off-coarse-grid write at 0.09375 beats round-trips on fine grid', offGrid.ok);

// switch back to coarse: is the off-grid note still visible somewhere?
await client.request('cursor.setStepSize', { cursor: 'fine', stepSize: 0.25 });
await new Promise((r) => setTimeout(r, 350));
const coarse2 = (await client.request('cursor.getNotes', { cursor: 'fine' })) as any;
const at70 = (coarse2.notes as N[]).find((n) => n[1] === 70);
note(`off-grid note viewed on 0.25 grid: ${at70 ? `appears at x=${at70[0]}` : 'NOT VISIBLE in NoteOn scan'}`);
check('grid-view behavior characterized (either is a finding)', true);

// triplet grid
await client.request('cursor.setStepSize', { cursor: 'fine', stepSize: 1 / 6 });
await client.request('cursor.setNotes', { cursor: 'fine', notes: [[1, 71, 100, 0.15]] });
const trip = await pollUntil(async () => {
  const r = (await client.request('cursor.getNotes', { cursor: 'fine' })) as any;
  return (r.notes as N[]).some((n) => n[0] === 1 && n[1] === 71);
}, 2000);
check('triplet grid (1/6 beat) write+read round-trips', trip.ok);
await client.request('cursor.setStepSize', { cursor: 'fine', stepSize: 0.25 });
// cleanup extra notes on B0: restore E1 fingerprint
await client.request('cursor.clearNotes', { cursor: 'fine' });
await client.request('cursor.setNotes', { cursor: 'fine', notes: [[2, 62, 100, 1]] });

// ---- phase E: empty/stale cursor reads --------------------------------
console.log('\n-- phase E: empty slot & deleted clip');
await client.request('cursor.pin', { cursor: '1', pinned: false });
await client.request('cursor.pointTrack', { cursor: '1', trackIndex: trackB });
await client.request('slot.select', { trackIndex: trackB, slotIndex: 2, mechanism: 'track' });
await new Promise((r) => setTimeout(r, 300));
const emptySt = await cursorStatus('1');
const emptyRead = (await client.request('cursor.getNotes', { cursor: '1' })) as any;
note(`pointed at EMPTY slot: exists=${emptySt.exists} slotExists=${emptySt.slotExists} readCount=${emptyRead.count} clipExists=${emptyRead.clipExists}`);
// e02b finding: pointing at an empty slot is a silent NO-OP; the cursor
// stays on its previous clip (cursor1's E1 home = A slot 1, one note)
check('empty-slot pointing no-ops (cursor still on previous clip A1)',
  emptySt.trackPosition === trackA && emptySt.sceneIndex === 1 && emptyRead.count === 1, emptySt);

await client.request('clip.create', { trackIndex: trackB, slotIndex: 2, lengthBeats: 4 });
await pollUntil(async () => ((await client.request('slot.status', { trackIndex: trackB, slotIndex: 2 })) as any).hasContent);
const pE = await point('1', trackB, 2, MECH);
check('cursor1 -> new clip at B2', pE.ok);
const fpE: N[] = [[5, 65, 100, 0.5]];
await client.request('cursor.setNotes', { cursor: '1', notes: fpE });
check('fingerprint written to B2', (await pollUntil(async () => sameNotes(await getNotes('1'), fpE))).ok);

await client.request('slot.delete', { trackIndex: trackB, slotIndex: 2 });
const gone = await pollUntil(async () => !((await client.request('slot.status', { trackIndex: trackB, slotIndex: 2 })) as any).hasContent);
check('ClipLauncherSlot.deleteObject removed the clip', gone.ok, { ms: gone.ms });
const staleSt = await cursorStatus('1');
const staleRead = (await client.request('cursor.getNotes', { cursor: '1' })) as any;
note(`after clip delete: cursor exists=${staleSt.exists} readCount=${staleRead.count} clipExists=${staleRead.clipExists}`);
check('STALE-READ characterization: exists=false after delete', staleSt.exists === false, staleSt);
check('STALE-READ characterization: scan returns no stale notes', staleRead.count === 0, { count: staleRead.count });

// re-point cursor1 to its E1 home (A1) and restore pin
await point('1', trackA, 1, MECH);
await client.request('cursor.pin', { cursor: '1', pinned: true });
await client.request('cursor.pin', { cursor: '0', pinned: true });

// ---- phase F: arranger cursor (report only) ---------------------------
console.log('\n-- phase F: arranger cursor');
const arr = (await client.request('cursor.status', { cursor: 'arranger' })) as any;
note(`arranger cursor status: ${JSON.stringify(arr)}`);

console.log(failureCount() === 0 ? '\nE2: all checks passed' : `\nE2: ${failureCount()} FAILURES`);
client.disconnect();
process.exit(failureCount() === 0 ? 0 : 1);
