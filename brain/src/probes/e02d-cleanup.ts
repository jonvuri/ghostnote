/**
 * E2d — Project cleanup after the E2c track-identity bug.
 * Restores the user's project to pre-spike state:
 *  - deletes ghostnote clips from the FX and Master rows (slots 0-3)
 *  - renames the Master track back to "Master"
 *  - deletes orphaned ghostnote-created Instrument tracks (verified EMPTY,
 *    keeping the first Instrument + Audio rows = the default template)
 */
import { client, check, note, failureCount, pollUntil } from './lib.js';

type TrackRow = { index: number; name: string; position: number; type: string };
const list = async () => (await client.request('track.list')) as { tracks: TrackRow[]; count: number };

await client.connect();
console.log('connected\n');

const before = await list();
note(`before: ${before.tracks.map((t) => `${t.index}:${t.name}(${t.type})`).join(' | ')}`);

// ---- 1. remove our clips from FX / Master rows ------------------------
for (const t of before.tracks.filter((x) => x.type === 'Effect' || x.type === 'Master')) {
  for (let s = 0; s < 4; s++) {
    const st = (await client.request('slot.status', { trackIndex: t.index, slotIndex: s })) as any;
    if (!st.hasContent) continue;
    await client.request('slot.delete', { trackIndex: t.index, slotIndex: s });
    const gone = await pollUntil(async () =>
      !((await client.request('slot.status', { trackIndex: t.index, slotIndex: s })) as any).hasContent);
    check(`cleared clip at ${t.name}(${t.type}) slot ${s}`, gone.ok);
  }
}

// ---- 2. restore Master name -------------------------------------------
const master = before.tracks.find((t) => t.type === 'Master');
if (master && master.name !== 'Master') {
  await client.request('track.setName', { trackIndex: master.index, name: 'Master' });
  const renamed = await pollUntil(async () =>
    (await list()).tracks.some((t) => t.type === 'Master' && t.name === 'Master'));
  check('Master track renamed back to "Master"', renamed.ok);
} else {
  note('Master name already default');
}

// ---- 3. delete orphaned instrument tracks -----------------------------
// Default template = first Instrument + first Audio. Everything else in
// the regular section is a ghostnote orphan — delete ONLY if fully empty.
const cur = (await list()).tracks;
const regular = cur.filter((t) => t.type === 'Instrument' || t.type === 'Audio' || t.type === 'Hybrid');
const keep = new Set<number>();
const firstInst = regular.find((t) => t.type === 'Instrument');
const firstAudio = regular.find((t) => t.type === 'Audio');
if (firstInst) keep.add(firstInst.index);
if (firstAudio) keep.add(firstAudio.index);
const orphans = regular.filter((t) => !keep.has(t.index));
note(`keeping: ${[...keep].map((i) => cur[i].name).join(', ')} — deleting ${orphans.length} orphans: ${orphans.map((t) => t.name).join(', ')}`);

for (const t of [...orphans].sort((a, b) => b.index - a.index)) {
  let empty = true;
  for (let s = 0; s < 16; s++) {
    const st = (await client.request('slot.status', { trackIndex: t.index, slotIndex: s })) as any;
    if (st.hasContent) { empty = false; break; }
  }
  if (!empty) {
    check(`orphan ${t.name} is empty (NOT deleting non-empty track)`, false);
    continue;
  }
  const countBefore = (await list()).count;
  await client.request('track.delete', { trackIndex: t.index });
  const gone = await pollUntil(async () => (await list()).count === countBefore - 1);
  check(`deleted empty orphan ${t.name}`, gone.ok);
}

const after = await list();
note(`after:  ${after.tracks.map((t) => `${t.index}:${t.name}(${t.type})`).join(' | ')}`);
check('final layout is default template (Inst, Audio, FX, Master)',
  after.count === 4 &&
  after.tracks[0].type === 'Instrument' && after.tracks[1].type === 'Audio' &&
  after.tracks[2].type === 'Effect' && after.tracks[3].type === 'Master');

console.log(failureCount() === 0 ? '\nE2d: cleanup complete' : `\nE2d: ${failureCount()} FAILURES`);
client.disconnect();
process.exit(failureCount() === 0 ? 0 : 1);
