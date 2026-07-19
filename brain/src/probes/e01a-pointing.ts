/**
 * E1a — Addressing: programmatic pointing, pinning, cursor pool, index shift.
 * Fully autonomous (no user interaction needed; E1b covers UI interference).
 *
 * Creates fixture tracks "gn-A"/"gn-B" (kept for E1b) and a temporary
 * "gn-shift" track (deleted at the end).
 */
import {
  client, check, note, failureCount, pollUntil,
  cursorStatus, getNotes, sameNotes, point, ensureFixtureTracks, stampFingerprint, FIXTURE_FPS,
  type Note as N,
} from './lib.js';

await client.connect();
console.log('connected\n');

const rig = await client.request('rig.info');
note(`rig: ${JSON.stringify(rig)}`);

// ---- fixture ----------------------------------------------------------
const { trackA, trackB } = await ensureFixtureTracks();
note(`fixture tracks: gn-A=index ${trackA}, gn-B=index ${trackB}`);

// ---- phase M: which pointing mechanisms work? -------------------------
console.log('\n-- phase M: pointing mechanisms (cursor 0)');
const targets: [number, number][] = [[trackA, 0], [trackA, 1], [trackB, 0]];
const results: Record<string, { ok: boolean; ms: number }> = {};
const mechanisms = ['selectClip', 'slotSelect', 'trackThenSlot'] as const;
for (let i = 0; i < mechanisms.length; i++) {
  const m = mechanisms[i];
  const [t, s] = targets[i % targets.length];
  results[m] = await point('0', t, s, m);
  check(`mechanism ${m} points cursor0 at (${t},${s})`, results[m].ok, { settleMs: results[m].ms });
}
const working = mechanisms.filter((m) => results[m].ok);
if (working.length === 0) {
  console.log('\nFATAL: no pointing mechanism works — E1 fails, stop here.');
  process.exit(1);
}
const best = working[0];
note(`using mechanism: ${best}`);

// ---- phase F: fingerprints + repointing round-trip --------------------
console.log('\n-- phase F: fingerprints');
const { fpA0, fpA1, fpB0 } = FIXTURE_FPS;
check('stamp A0', await stampFingerprint('0', trackA, 0, fpA0, best));
check('stamp A1', await stampFingerprint('0', trackA, 1, fpA1, best));
check('stamp B0', await stampFingerprint('0', trackB, 0, fpB0, best));
// repoint back to A0: content must be fpA0 again
const back = await point('0', trackA, 0, best);
check('repoint cursor0 -> A0', back.ok, { settleMs: back.ms });
check('A0 content survived repointing', sameNotes(await getNotes('0'), fpA0));

// ---- phase P: pool of pinned cursors ----------------------------------
console.log('\n-- phase P: pinned cursor pool');
async function pinAt(cursor: string, t: number, s: number) {
  const p = await point(cursor, t, s, best);
  await client.request('cursor.pin', { cursor, pinned: true });
  return p.ok;
}
check('cursor0 pinned at A0', await pinAt('0', trackA, 0));
check('cursor1 pinned at A1', await pinAt('1', trackA, 1));
check('cursor2 pinned at B0', await pinAt('2', trackB, 0));
for (const [c, fp, label] of [['0', fpA0, 'A0'], ['1', fpA1, 'A1'], ['2', fpB0, 'B0']] as const) {
  const st = await cursorStatus(c);
  check(`cursor${c} status pinned+target ${label}`, st.isPinned === true && st.exists,
    { track: st.trackPosition, scene: st.sceneIndex });
  check(`cursor${c} reads ${label} fingerprint`, sameNotes(await getNotes(c), fp as unknown as N[]));
}

// ---- phase S: programmatic selection interference ---------------------
console.log('\n-- phase S: selection moves, pinned cursors must not');
await client.request('slot.select', { trackIndex: trackB, slotIndex: 0, mechanism: 'slot' });
await pollUntil(async () => {
  const f = await cursorStatus('follower');
  return f.trackPosition === trackB && f.sceneIndex === 0;
});
const fol = await cursorStatus('follower');
check('follower follows selection to B0', fol.trackPosition === trackB && fol.sceneIndex === 0);
const s0 = await cursorStatus('0');
check('pinned cursor0 unmoved by selection', s0.trackPosition === trackA && s0.sceneIndex === 0);
check('pinned cursor0 content intact', sameNotes(await getNotes('0'), fpA0));
// write through pinned cursor while selection is elsewhere; verify placement
const fpA0v2: N[] = [[0, 60, 100, 1], [4, 72, 90, 0.5]];
await client.request('cursor.setNotes', { cursor: '0', notes: [[4, 72, 90, 0.5]] });
check('write via pinned cursor lands at A0', (await pollUntil(async () => sameNotes(await getNotes('0'), fpA0v2))).ok);
check('B0 (selected) did not receive the write', sameNotes(await getNotes('2'), fpB0));

// ---- phase X: index shift ---------------------------------------------
console.log('\n-- phase X: structural index shift');
const listCount = async () => ((await client.request('track.list')) as { count: number }).count;
const before = await listCount();
await client.request('track.create', { position: 0 });
check('track created at position 0', (await pollUntil(async () => (await listCount()) === before + 1)).ok);
await client.request('track.setName', { trackIndex: 0, name: 'gn-shift' });

const sh0 = await cursorStatus('0');
check('pinned cursor0 followed object (position +1)', sh0.trackPosition === trackA + 1,
  { trackPosition: sh0.trackPosition, expected: trackA + 1 });
check('cursor0 content intact after shift', sameNotes(await getNotes('0'), fpA0v2));
check('cursor2 content intact after shift', sameNotes(await getNotes('2'), fpB0));

// delete the shift track (early E3 signal: Track.deleteObject)
await client.request('track.delete', { trackIndex: 0 });
const deleted = await pollUntil(async () => (await listCount()) === before);
check('track.deleteObject removed gn-shift', deleted.ok, { settleMs: deleted.ms });
const post = await cursorStatus('0');
check('cursor0 back at original position after delete', post.trackPosition === trackA);
check('cursor0 content intact after delete', sameNotes(await getNotes('0'), fpA0v2));

// restore A0 fingerprint for E1b
await client.request('cursor.clearNotes', { cursor: '0' });
await client.request('cursor.setNotes', { cursor: '0', notes: fpA0 });

console.log(failureCount() === 0 ? '\nE1a: all checks passed' : `\nE1a: ${failureCount()} FAILURES`);
note('fixture tracks gn-A/gn-B and pinned cursors left in place for E1b');
client.disconnect();
process.exit(failureCount() === 0 ? 0 : 1);
