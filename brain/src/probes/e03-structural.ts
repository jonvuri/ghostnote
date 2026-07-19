/**
 * E3 — Structural ops & revert correctness. Fully autonomous.
 *
 *  A. device chain: insert / list / delete / index-shift
 *  B. scenes: create / count / delete + effect on pinned cursor sceneIndex
 *  C. undo granularity: does an N-op batch land as N undo entries?
 *  D. revert-fidelity roundtrip: snapshot -> delete clip -> recreate -> restore
 *
 * Uses the E1 fixture (gn-A/gn-B). Leaves fixtures restored.
 */
import {
  client, check, note, failureCount, pollUntil,
  cursorStatus, getNotes, sameNotes, point, ensureFixtureTracks,
  type Note as N,
} from './lib.js';

const MECH = 'trackThenSlot';
const DEV = {
  Polysynth: 'a9ffacb5-33e9-4fc7-8621-b1af31e410ef',
  Polymer: '8f58138b-03aa-4e9d-83bd-a038c99a4ed5',
};

await client.connect();
console.log('connected\n');
const { trackA, trackB } = await ensureFixtureTracks();
note(`fixture: gn-A=${trackA}, gn-B=${trackB}`);

const devList = async (cursor: string) =>
  (await client.request('device.list', { cursor })) as { devices: { index: number; name: string }[]; count: number; itemCount: number };

// ============================================================ Phase A
console.log('\n-- phase A: device chain create/delete/index-shift');
const pA = await point('0', trackA, 0, MECH);
check('cursor0 track -> gn-A', pA.ok);
// clear any pre-existing devices on the fixture track for a clean start
let pre = await devList('0');
for (let g = 0; g < 8 && pre.count > 0; g++) {
  await client.request('device.delete', { cursor: '0', deviceIndex: pre.devices[0].index });
  await pollUntil(async () => (await devList('0')).count < pre.count, 3000);
  pre = await devList('0');
}
check('gn-A device chain starts empty', pre.count === 0, pre);

await client.request('device.insertBitwig', { cursor: '0', uuid: DEV.Polysynth });
const ins1 = await pollUntil(async () => (await devList('0')).count === 1, 5000);
check('insert Polysynth -> 1 device', ins1.ok, { settleMs: ins1.ms });
const l1 = await devList('0');
note(`after insert 1: ${JSON.stringify(l1.devices)}`);

await client.request('device.insertBitwig', { cursor: '0', uuid: DEV.Polymer });
const ins2 = await pollUntil(async () => (await devList('0')).count === 2, 5000);
check('insert Polymer -> 2 devices', ins2.ok, { settleMs: ins2.ms });
const l2 = await devList('0');
note(`after insert 2: ${JSON.stringify(l2.devices)}`);

// delete device at index 0 -> the other must shift down to index 0
const nameAt1 = l2.devices.find((d) => d.index === 1)?.name;
await client.request('device.delete', { cursor: '0', deviceIndex: 0 });
const del1 = await pollUntil(async () => (await devList('0')).count === 1, 5000);
check('delete device[0] -> 1 device', del1.ok, { settleMs: del1.ms });
const l3 = await devList('0');
check('surviving device shifted to index 0 (chain re-indexes)',
  l3.devices.length === 1 && l3.devices[0].index === 0, { was: nameAt1, now: l3.devices[0] });

await client.request('device.delete', { cursor: '0', deviceIndex: 0 });
const del2 = await pollUntil(async () => (await devList('0')).count === 0, 5000);
check('delete last device -> chain empty', del2.ok);

// ============================================================ Phase B
console.log('\n-- phase B: scenes + pinned-cursor sceneIndex shift');
const sceneCount = async () => ((await client.request('scene.count')) as { sceneCount: number }).sceneCount;
const base = await sceneCount();
note(`baseline scene count: ${base}`);

await client.request('scene.create', { count: 3 });
const grew = await pollUntil(async () => (await sceneCount()) === base + 3, 4000);
check('scene.create(3) appended 3 scenes', grew.ok, { from: base, to: await sceneCount() });

// put a fingerprinted clip in a NEW high scene row on gn-B, pin cursor2 there
const hiScene = base + 1; // within the newly created rows (safe: empty)
await client.request('clip.create', { trackIndex: trackB, slotIndex: hiScene, lengthBeats: 4 });
await pollUntil(async () => ((await client.request('slot.status', { trackIndex: trackB, slotIndex: hiScene })) as any).hasContent);
const pHi = await point('2', trackB, hiScene, MECH);
check(`cursor2 -> gn-B new scene ${hiScene}`, pHi.ok);
const fpHi: N[] = [[3, 67, 100, 0.5]];
await client.request('cursor.setNotes', { cursor: '2', notes: fpHi });
await pollUntil(async () => sameNotes(await getNotes('2'), fpHi));
await client.request('cursor.pin', { cursor: '2', pinned: true });
const stBefore = await cursorStatus('2');
check(`cursor2 sceneIndex == ${hiScene} before delete`, stBefore.sceneIndex === hiScene, stBefore);

// delete a scene BELOW the pinned clip (scene base = first new empty row)
await client.request('scene.delete', { sceneIndex: base });
const shrank = await pollUntil(async () => (await sceneCount()) === base + 2, 4000);
check('scene.delete removed a scene', shrank.ok, { now: await sceneCount() });
const stAfter = await cursorStatus('2');
note(`pinned cursor2 after deleting scene ${base}: sceneIndex=${stAfter.sceneIndex} (was ${hiScene}), notes=${(await getNotes('2')).length}`);
check('pinned cursor shifted with its row (sceneIndex-1) and kept content',
  stAfter.sceneIndex === hiScene - 1 && sameNotes(await getNotes('2'), fpHi),
  { sceneIndex: stAfter.sceneIndex, expected: hiScene - 1 });

// cleanup new scenes: delete the clip then the two extra scenes from the end
await client.request('cursor.pin', { cursor: '2', pinned: false });
const curCount = await sceneCount();
for (let s = curCount - 1; s >= base; s--) {
  await client.request('scene.delete', { sceneIndex: s });
  await pollUntil(async () => (await sceneCount()) < curCount - (curCount - 1 - s), 3000).catch(() => {});
}
note(`scene count after cleanup: ${await sceneCount()} (baseline ${base})`);

// ============================================================ Phase C
console.log('\n-- phase C: undo granularity');
// scratch clip on gn-B slot 0
const pC = await point('0', trackB, 0, MECH);
check('cursor0 -> gn-B slot0 (scratch)', pC.ok);
await client.request('cursor.clearNotes', { cursor: '0' });
await pollUntil(async () => (await getNotes('0')).length === 0);

// C1: four notes in ONE request (one handler call, 4 setStep)
const four: N[] = [[0, 60, 100, 0.5], [1, 62, 100, 0.5], [2, 64, 100, 0.5], [3, 65, 100, 0.5]];
await client.request('cursor.setNotes', { cursor: '0', notes: four });
await pollUntil(async () => (await getNotes('0')).length === 4);
let undos = 0;
for (let i = 0; i < 8; i++) {
  const r = (await client.request('app.undo', { times: 1 })) as any;
  if (r.undosPerformed === 0) break;
  undos++;
  await new Promise((r2) => setTimeout(r2, 120));
  const cnt = (await getNotes('0')).length;
  note(`  [single-request batch] after undo #${undos}: ${cnt} notes`);
  if (cnt === 0) break;
}
check('C1: 4-note single-request batch undo behavior recorded', true, { undosToClear: undos });

// C2: four notes in FOUR separate requests
await client.request('cursor.clearNotes', { cursor: '0' });
await pollUntil(async () => (await getNotes('0')).length === 0);
for (const n of four) await client.request('cursor.setNotes', { cursor: '0', notes: [n] });
await pollUntil(async () => (await getNotes('0')).length === 4);
let undos2 = 0;
for (let i = 0; i < 8; i++) {
  const r = (await client.request('app.undo', { times: 1 })) as any;
  if (r.undosPerformed === 0) break;
  undos2++;
  await new Promise((r2) => setTimeout(r2, 120));
  const cnt = (await getNotes('0')).length;
  note(`  [four-request batch] after undo #${undos2}: ${cnt} notes`);
  if (cnt === 0) break;
}
check('C2: four-request batch undo behavior recorded', true, { undosToClear: undos2 });
note(`GRANULARITY VERDICT: single-request 4 notes => ${undos} undo(s); four requests => ${undos2} undo(s)`);

// C3: does undo reach across into structural ops? (global stack demo)
const preUndoState = (await client.request('app.undoState')) as any;
note(`undo stack still has history after clearing notes: canUndo=${preUndoState.canUndo} (global stack, §8a)`);

// ============================================================ Phase D
console.log('\n-- phase D: revert-fidelity roundtrip (delete clip -> restore)');
const pD = await point('1', trackA, 1, MECH);
check('cursor1 -> gn-A slot1', pD.ok);
await client.request('cursor.clearNotes', { cursor: '1' });
const rich: N[] = [[0, 60, 110, 1], [2, 64, 90, 0.5], [4, 67, 80, 0.25]];
await client.request('cursor.setNotes', { cursor: '1', notes: rich });
await pollUntil(async () => sameNotes(await getNotes('1'), rich));
// snapshot ("before")
const snapshot = (await client.request('cursor.getNotesVerbose', { cursor: '1', maxX: 8 })) as any;
note(`snapshot: ${snapshot.count} notes captured`);

// destructive op: delete the whole clip
await client.request('slot.delete', { trackIndex: trackA, slotIndex: 1 });
const gone = await pollUntil(async () => !((await client.request('slot.status', { trackIndex: trackA, slotIndex: 1 })) as any).hasContent);
check('clip deleted', gone.ok);

// revert: recreate + replay snapshot
await client.request('clip.create', { trackIndex: trackA, slotIndex: 1, lengthBeats: 4 });
await pollUntil(async () => ((await client.request('slot.status', { trackIndex: trackA, slotIndex: 1 })) as any).hasContent);
const pRestore = await point('1', trackA, 1, MECH);
check('cursor1 re-points to recreated clip', pRestore.ok);
const restoreNotes: N[] = (snapshot.notes as any[]).map((s) => [s.x, s.y, Math.round(s.velocity * 127), s.duration]);
await client.request('cursor.setNotes', { cursor: '1', notes: restoreNotes });
const restored = await pollUntil(async () => sameNotes(await getNotes('1'), rich));
check('revert restored note set exactly (structural delete IS reversible via snapshot)', restored.ok);

// restore E1 baseline fingerprint on gn-A slot1
await client.request('cursor.clearNotes', { cursor: '1' });
await client.request('cursor.setNotes', { cursor: '1', notes: [[1, 61, 100, 1]] });

console.log(failureCount() === 0 ? '\nE3: all checks passed' : `\nE3: ${failureCount()} FAILURES`);
client.disconnect();
process.exit(failureCount() === 0 ? 0 : 1);
