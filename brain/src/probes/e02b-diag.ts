/**
 * E2b — Diagnostics & characterization after e02's ambiguous results:
 *  1. ground-truth dump of fixture tracks/clips (explains state mysteries)
 *  2. pointing at an EMPTY slot: no-op confirmation
 *  3. runtime setStepSize: honored or init-fixed?
 *  4. gain setter/getter mapping curve
 *  5. pressure persistence timeline
 */
import {
  client, check, note, failureCount, pollUntil, cursorStatus, point,
  type Note as N,
} from './lib.js';

const MECH = 'trackThenSlot';
await client.connect();
console.log('connected\n');

const list = (await client.request('track.list')) as { tracks: { index: number; name: string; position: number }[] };

// ---- 1. ground truth --------------------------------------------------
console.log('-- ground truth');
for (const t of list.tracks) note(`track[${t.index}] pos=${t.position} name="${t.name}"`);
const gnTracks = list.tracks.filter((t) => t.name.startsWith('gn-'));
check('exactly 2 gn- fixture tracks (duplicates would explain mysteries)', gnTracks.length === 2,
  gnTracks.map((t) => `${t.index}:${t.name}`));

for (const t of gnTracks) {
  for (let s = 0; s < 5; s++) {
    const st = (await client.request('slot.status', { trackIndex: t.index, slotIndex: s })) as any;
    if (!st.hasContent) continue;
    const p = await point('fine', t.index, s, MECH);
    const r = (await client.request('cursor.getNotes', { cursor: 'fine' })) as any;
    note(`${t.name}[slot ${s}]: pointed=${p.ok} notes=${JSON.stringify(r.notes)}`);
  }
}

// use gn-A slot 0 as the known clip for the rest; gn-B may be gone
const A = gnTracks.find((t) => t.name === 'gn-A')!.index;
const B = gnTracks.find((t) => t.name === 'gn-B')?.index ?? A;

// ---- 2. empty-slot pointing no-op -------------------------------------
console.log('\n-- empty-slot pointing');
const pKnown = await point('fine', A, 0, MECH);
check('fine -> gn-A slot 0 (known clip)', pKnown.ok);
// find an empty slot on gn-B
let emptySlot = -1;
for (let s = 0; s < 8; s++) {
  const st = (await client.request('slot.status', { trackIndex: B, slotIndex: s })) as any;
  if (st.exists && !st.hasContent) { emptySlot = s; break; }
}
if (emptySlot >= 0) {
  await client.request('cursor.pointTrack', { cursor: 'fine', trackIndex: B });
  await client.request('slot.select', { trackIndex: B, slotIndex: emptySlot, mechanism: 'track' });
  await new Promise((r) => setTimeout(r, 400));
  const st = await cursorStatus('fine');
  const noop = st.trackPosition === A && st.sceneIndex === 0;
  check('pointing at EMPTY slot leaves cursor on previous clip (no-op)', noop || st.exists === false,
    { trackPosition: st.trackPosition, sceneIndex: st.sceneIndex, exists: st.exists });
  note(noop ? 'VERDICT: empty-slot pointing is a silent NO-OP — cursor stays on previous clip'
            : `VERDICT: cursor state after empty-slot pointing: ${JSON.stringify(st)}`);
} else {
  note('no empty slot found on gn-B within 8 — skipped');
}

// ---- 3. runtime setStepSize -------------------------------------------
console.log('\n-- runtime setStepSize');
await point('fine', A, 0, MECH);
await client.request('cursor.clearNotes', { cursor: 'fine' });
await client.request('cursor.setNotes', { cursor: 'fine', notes: [[4, 60, 100, 0.5]] }); // beat 1.0 @0.25
await pollUntil(async () => ((await client.request('cursor.getNotes', { cursor: 'fine' })) as any).count === 1);
await client.request('cursor.setStepSize', { cursor: 'fine', stepSize: 0.125 });
await new Promise((r) => setTimeout(r, 300));
const fineScan = (await client.request('cursor.getNotes', { cursor: 'fine' })) as any;
const n = (fineScan.notes as N[])[0];
const honored = n && n[0] === 8;   // beat 1.0 on 0.125 grid
const ignored = n && n[0] === 4;   // unchanged index => stepSize ignored
check('runtime setStepSize verdict reached', honored || ignored, fineScan.notes);
note(honored ? 'VERDICT: runtime setStepSize IS honored (note re-indexed 4 -> 8)'
   : ignored ? 'VERDICT: runtime setStepSize is IGNORED — grid resolution is fixed at init()'
   : `VERDICT: ambiguous — notes=${JSON.stringify(fineScan.notes)}`);
await client.request('cursor.setStepSize', { cursor: 'fine', stepSize: 0.25 });

// ---- 4. gain mapping ---------------------------------------------------
console.log('\n-- gain setter/getter mapping');
const readGain = async () => {
  const r = (await client.request('cursor.getNotesVerbose', { cursor: 'fine', maxX: 8 })) as any;
  return r.notes[0]?.gain as number;
};
for (const g of [0.1, 0.25, 0.5, 0.7, 1.0]) {
  await client.request('cursor.setNoteProps', { cursor: 'fine', x: 4, y: 60, props: { gain: g } });
  await new Promise((r) => setTimeout(r, 150));
  note(`setGain(${g}) -> gain() = ${await readGain()}`);
}
// feedback loop: write back the read value twice — does it drift?
await client.request('cursor.setNoteProps', { cursor: 'fine', x: 4, y: 60, props: { gain: 0.5 } });
await new Promise((r) => setTimeout(r, 150));
let g1 = await readGain();
await client.request('cursor.setNoteProps', { cursor: 'fine', x: 4, y: 60, props: { gain: g1 } });
await new Promise((r) => setTimeout(r, 150));
const g2 = await readGain();
note(`feedback: set(0.5)->read ${g1}; set(${g1})->read ${g2}`);
check('gain write-back is stable (no drift) OR mapping is now known', true, { g1, g2 });

// ---- 5. pressure timeline ---------------------------------------------
console.log('\n-- pressure persistence');
const readPressure = async () => {
  const r = (await client.request('cursor.getNotesVerbose', { cursor: 'fine', maxX: 8 })) as any;
  return r.notes[0]?.pressure as number;
};
await client.request('cursor.setNoteProps', { cursor: 'fine', x: 4, y: 60, props: { pressure: 0.6 } });
for (const wait of [0, 150, 500, 1000]) {
  await new Promise((r) => setTimeout(r, wait));
  note(`pressure at +${wait}ms (cumulative): ${await readPressure()}`);
}

// cleanup: restore A0 baseline fingerprint
await client.request('cursor.clearNotes', { cursor: 'fine' });
await client.request('cursor.setNotes', { cursor: 'fine', notes: [[0, 60, 100, 1]] });

console.log(failureCount() === 0 ? '\nE2b: all checks passed' : `\nE2b: ${failureCount()} FAILURES`);
client.disconnect();
process.exit(failureCount() === 0 ? 0 : 1);
