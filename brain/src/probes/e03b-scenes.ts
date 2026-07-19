/**
 * E3b — Scene-deletion semantics: does deleting a middle scene COMPACT the
 * rows below it (shifting clips up), and do pinned cursors track the move?
 * e03 saw a pinned clip keep sceneIndex=9 after deleting scene 8 — resolve
 * whether that's "no compaction" or "cursor didn't update".
 */
import {
  client, check, note, failureCount, pollUntil, cursorStatus, getNotes, sameNotes, point, ensureFixtureTracks,
  type Note as N,
} from './lib.js';

const MECH = 'trackThenSlot';
const sceneCount = async () => ((await client.request('scene.count')) as { sceneCount: number }).sceneCount;
const hasClip = async (t: number, s: number) =>
  ((await client.request('slot.status', { trackIndex: t, slotIndex: s })) as any).hasContent as boolean;

await client.connect();
console.log('connected\n');
const { trackA, trackB } = await ensureFixtureTracks();

const base = await sceneCount();
note(`baseline scenes: ${base}`);
await client.request('scene.create', { count: 4 });
await pollUntil(async () => (await sceneCount()) === base + 4);

// place two marker clips at high, currently-empty rows
const rowLo = base + 1;
const rowHi = base + 2;
for (const [t, s, fp] of [[trackB, rowLo, [[1, 60, 100, 0.5]]], [trackB, rowHi, [[2, 64, 100, 0.5]]]] as const) {
  await client.request('clip.create', { trackIndex: t, slotIndex: s, lengthBeats: 4 });
  await pollUntil(() => hasClip(t, s));
  await point('0', t, s, MECH);
  await client.request('cursor.setNotes', { cursor: '0', notes: fp as unknown as N[] });
  await pollUntil(async () => sameNotes(await getNotes('0'), fp as unknown as N[]));
}
note(`markers: LO clip at row ${rowLo} (pitch 60), HI clip at row ${rowHi} (pitch 64)`);

// pin cursor2 on the HI marker, record sceneIndex
await point('2', trackB, rowHi, MECH);
await client.request('cursor.pin', { cursor: '2', pinned: true });
const before = await cursorStatus('2');
check(`pinned cursor2 on HI marker reports sceneIndex ${rowHi}`, before.sceneIndex === rowHi, before);

// delete a scene strictly BELOW both markers (row base = empty new row)
const delRow = base; // below rowLo and rowHi
const cntBefore = await sceneCount();
await client.request('scene.delete', { sceneIndex: delRow });
await pollUntil(async () => (await sceneCount()) === cntBefore - 1);
note(`deleted scene at index ${delRow}`);

// identify clips by PITCH (hasContent alone can't tell which clip is where).
// pin cursor0/1 to read specific rows.
const pitchAt = async (row: number): Promise<number | null> => {
  await point('0', trackB, row, MECH);
  const notes = await getNotes('0');
  return notes.length ? notes[0][1] : null;
};
// emptiness via slot bank (cursor pointing no-ops on empty slots, E2);
// identity via cursor pitch, only trusted where the slot actually has content.
const has8 = await hasClip(trackB, rowLo - 1);
const has9 = await hasClip(trackB, rowLo);
const has10 = await hasClip(trackB, rowHi);
const p8 = has8 ? await pitchAt(rowLo - 1) : null;
const p9 = has9 ? await pitchAt(rowLo) : null;
note(`after delete — row ${rowLo - 1}: has=${has8} pitch=${p8} | row ${rowLo}: has=${has9} pitch=${p9} | row ${rowHi}: has=${has10}`);

// compaction => LO(60) now at row 8, HI(64) now at row 9, row 10 empty
const compacts = p8 === 60 && p9 === 64 && !has10;
const staysPut = !has8 && p9 === 60 && has10;
check('scene-deletion semantics determined', compacts || staysPut, { p8, p9, has10 });
note(compacts ? 'VERDICT: deleting a scene COMPACTS rows below upward (clips shift up one row)'
   : staysPut ? 'VERDICT: deleting a scene does NOT move other rows'
   : 'VERDICT: ambiguous — see pitches above');

// cursor2 stays pinned on the HI marker object. Content should still be
// pitch 64; does its sceneIndex settle to the compacted row 9, or stay
// stale at 10? (poll to distinguish settle-timing from permanent staleness)
const settle = await pollUntil(async () => (await cursorStatus('2')).sceneIndex === rowHi - 1, 3000);
const after = await cursorStatus('2');
const afterNotes = await getNotes('2');
note(`pinned cursor2 after delete: sceneIndex=${after.sceneIndex} (settled to ${rowHi - 1}? ${settle.ok} in ${settle.ms}ms), content=${JSON.stringify(afterNotes)}`);
check('pinned cursor still resolves to HI marker content (pitch 64)', sameNotes(afterNotes, [[2, 64, 100, 0.5]]), { afterNotes });
check('cursor sceneIndex reflects compaction (else: sceneIndex is stale while pinned)',
  settle.ok, { finalSceneIndex: after.sceneIndex, expected: rowHi - 1 });
await client.request('cursor.pin', { cursor: '2', pinned: false });

// ---- cleanup: remove markers + extra scenes ----
await client.request('cursor.pin', { cursor: '2', pinned: false });
let c = await sceneCount();
while (c > base) {
  await client.request('scene.delete', { sceneIndex: c - 1 });
  await pollUntil(async () => (await sceneCount()) === c - 1, 3000).catch(() => {});
  c = await sceneCount();
}
note(`scenes restored to ${await sceneCount()} (baseline ${base})`);

console.log(failureCount() === 0 ? '\nE3b: all checks passed' : `\nE3b: ${failureCount()} FAILURES`);
client.disconnect();
process.exit(failureCount() === 0 ? 0 : 1);
