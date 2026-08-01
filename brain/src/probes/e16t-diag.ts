/**
 * E16 §3.4g diagnostic — two results from `e16t` that must not be written up
 * until they are told apart from probe defects.
 *
 * ⚠ **1. `clip0=clip1` read TRUE with the cursors on different slots.** Three
 * explanations, and they are not remotely the same finding:
 *
 *   (a) the probe never moved cursor 1 — `e16t` called `point()` and DISCARDED
 *       its return value, and cursor track 1 was still PINNED from the
 *       position-shift section, so a repoint could simply have been refused.
 *       That is the E16o trap exactly: a precondition left unasserted, producing
 *       something that reads like a result.
 *   (b) two clip cursors pointing at NOTHING compare equal, in which case the
 *       preceding PASS is a false positive as well and the whole clip half of
 *       the row is measuring the absence of clips.
 *   (c) clip proxies genuinely do not discriminate, which would be a real and
 *       surprising limitation.
 *
 * ⚠ **2. After its pinned target was deleted, cursor 2 still matched exactly one
 * bank row.** `e16t` printed the count, not the name — the precise mistake
 * `e16r-diag` made, where counting the tracks that fell out of the bank hid the
 * finding that naming them revealed. If the cursor slid onto the track that took
 * the deleted one's POSITION, then `createEqualsValue` reporting true does not
 * mean the target survived, and that is a sharp limitation on the whole guard.
 *
 * Silent. Reads, points cursors, creates and deletes one throwaway track.
 */
import { client, check, note, failureCount, pollUntil, cursorStatus, ensureFixtureTracks } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);

interface EqualsStatus { pairs: Record<string, boolean | string> }
const pairOf = async (key: string): Promise<boolean | string | undefined> =>
  ((await req('equals.status', { all: true })) as EqualsStatus).pairs[key];
const truePairs = async (prefix: string): Promise<string[]> =>
  Object.keys(((await req('equals.status')) as EqualsStatus).pairs).filter((k) => k.startsWith(prefix));

type TrackRow = { index: number; name: string; channelId: string; type: string };
const list = async () => (await req('track.list')) as { tracks: TrackRow[]; count: number };
const nameAt = async (index: number) => (await list()).tracks.find((t) => t.index === index)?.name;
const indexOf = async (channelId: string): Promise<number | undefined> => {
  const r = (await req('track.resolveByChannelId', { channelId })) as { found: boolean; index?: number };
  return r.found ? r.index : undefined;
};
const slotHas = async (trackIndex: number, slotIndex: number): Promise<boolean> =>
  ((await req('slot.status', { trackIndex, slotIndex })) as { hasContent: boolean }).hasContent;

await client.connect();
console.log('connected\n');

const rolling = (await req('transport.status')) as { isPlaying: boolean };
if (rolling.isPlaying) {
  console.log('REFUSING: the transport is rolling.');
  process.exit(1);
}

const { trackA } = await ensureFixtureTracks();

// ==========================================================================
// 1 — the clip pair, with every precondition asserted
// ==========================================================================
console.log('-- 1: clip0 vs clip1, with the repoint PROVED rather than assumed');

// ⚠ Unpin both cursor TRACKS first. `e16t` left cursor track 1 pinned from the
// position-shift section and then tried to repoint it, which is the leading
// suspect for the whole result.
for (const c of [0, 1, 2]) {
  await req('cursor.pinTrack', { cursor: c, pinned: false });
  await req('cursor.pin', { cursor: String(c), pinned: false });
}

/** Point a pool cursor and REFUSE to continue unless it verifiably arrived. */
async function pointHard(cursor: string, trackIndex: number, slotIndex: number): Promise<boolean> {
  await req('cursor.pointTrack', { cursor, trackIndex });
  await req('slot.select', { trackIndex, slotIndex, mechanism: 'track' });
  const r = await pollUntil(async () => {
    const s = await cursorStatus(cursor);
    return s.trackPosition === trackIndex && s.sceneIndex === slotIndex;
  }, 5000, 100);
  const s = await cursorStatus(cursor);
  note(`  cursor ${cursor} -> track ${s.trackPosition} scene ${s.sceneIndex} `
    + `exists=${s.exists} (wanted ${trackIndex}/${slotIndex}, ${r.ms}ms)`);
  return r.ok;
}

// Both slots must actually HOLD clips, or hypothesis (b) is live.
for (const s of [0, 1]) {
  if (!(await slotHas(trackA, s))) {
    await req('clip.create', { trackIndex: trackA, slotIndex: s, lengthBeats: 4 });
    await pollUntil(() => slotHas(trackA, s));
  }
}
check('PRECONDITION: both fixture slots hold a clip',
  (await slotHas(trackA, 0)) && (await slotHas(trackA, 1)));

const at0 = await pointHard('0', trackA, 0);
const at1same = await pointHard('1', trackA, 0);
check('PRECONDITION: both cursors verifiably arrived at the SAME slot', at0 && at1same);
const sameSlotSettled = await pollUntil(async () => (await pairOf('clip0=clip1')) === true, 4000, 50);
check('same slot, both cursors proven there: clip0=clip1 is TRUE',
  sameSlotSettled.ok, { value: await pairOf('clip0=clip1'), ms: sameSlotSettled.ms });

const at1diff = await pointHard('1', trackA, 1);
check('PRECONDITION: cursor 1 verifiably MOVED to the other slot', at1diff);
const diffSettled = await pollUntil(async () => (await pairOf('clip0=clip1')) === false, 4000, 50);
check('⚠ different slots, both cursors proven: clip0=clip1 is FALSE',
  diffSettled.ok, { value: await pairOf('clip0=clip1'), ms: diffSettled.ms });

if (!at1diff) {
  note('⚠ hypothesis (a): the repoint itself failed, so e16t\'s FAIL was a probe defect');
  note('  and says nothing about clip proxies.');
} else if (!diffSettled.ok) {
  note('⚠ hypothesis (c): the repoint DID land and the pair still reads true, so clip');
  note('  proxies genuinely do not discriminate between two different clips. That would');
  note('  make the clip half of the matrix worthless — and it is worth checking whether');
  note('  the value is simply STUCK rather than wrong (see the empty-slot test below).');
}

// -- hypothesis (b): what do two cursors on EMPTY slots compare as?
console.log('\n-- 1b: two cursors on slots with NO clip');
const EMPTY_1 = 11;
const EMPTY_2 = 12;
for (const s of [EMPTY_1, EMPTY_2]) {
  if (await slotHas(trackA, s)) {
    await req('slot.delete', { trackIndex: trackA, slotIndex: s });
    await pollUntil(async () => !(await slotHas(trackA, s)));
  }
}
await pointHard('0', trackA, EMPTY_1);
await pointHard('1', trackA, EMPTY_2);
const s0 = await cursorStatus('0');
const s1 = await cursorStatus('1');
const emptyPair = await pairOf('clip0=clip1');
note(`cursor 0 exists=${s0.exists}, cursor 1 exists=${s1.exists}, clip0=clip1 -> ${emptyPair}`);
check('⚠ two cursors on DIFFERENT EMPTY slots do not compare equal',
  emptyPair === false, { value: emptyPair, cursor0Exists: s0.exists, cursor1Exists: s1.exists });
if (emptyPair === true) {
  note('⚠ hypothesis (b) CONFIRMED: two non-existent clip proxies compare EQUAL. Then a');
  note('  true reading means "both point at the same thing OR neither points at anything",');
  note('  and the guard MUST be read together with exists() or it silently reports');
  note('  agreement between two absences. That is a real trap and it belongs in the row.');
}

// ==========================================================================
// 2 — name the track the pinned cursor slid onto
// ==========================================================================
console.log('\n-- 2: when a pinned target is deleted, WHICH row does the cursor match?');

const before = await list();
const beforeIds = new Set(before.tracks.map((t) => t.channelId));
await req('branch.duplicateTrack', { trackIndex: trackA });
const grew = await pollUntil(async () => (await list()).count === before.count + 1, 8000, 100);
check('PRECONDITION: a throwaway duplicate appeared', grew.ok);

if (grew.ok) {
  const dup = (await list()).tracks.find((t) => !beforeIds.has(t.channelId))!;
  note(`duplicate "${dup.name}" at bank ${dup.index} (${dup.channelId})`);

  await req('cursor.pointTrack', { cursor: '2', trackIndex: dup.index });
  await req('cursor.pinTrack', { cursor: 2, pinned: true });
  await pollUntil(async () => (await truePairs('ct2=bank')).length > 0, 4000, 50);
  const pinnedAt = await truePairs('ct2=bank');
  check('PRECONDITION: cursor 2 is pinned to the duplicate and matches its row',
    pinnedAt.includes(`ct2=bank${dup.index}`), { matched: pinnedAt });

  // What sits at the row BELOW the duplicate — the track that will inherit its
  // position when it is deleted (E3 compaction).
  const heirBefore = await nameAt(dup.index + 1);
  note(`the row below the duplicate is currently "${heirBefore}" — this is what will`);
  note(`  slide up into bank ${dup.index} when the duplicate goes.`);

  await req('track.delete', { trackIndex: dup.index });
  await pollUntil(async () => (await indexOf(dup.channelId)) === undefined, 8000, 100);

  const after = await truePairs('ct2=bank');
  const names: string[] = [];
  for (const key of after) {
    const idx = Number(key.slice('ct2=bank'.length));
    names.push(`${key} = "${await nameAt(idx)}"`);
  }
  // ⚠ NAME it, do not count it. e16r-diag threw a finding away by counting.
  note(`after the delete, cursor 2 matches: ${names.length ? names.join(', ') : '(nothing)'}`);
  const cs = await cursorStatus('2');
  note(`cursor 2 now reports trackName="${cs.trackName}" trackPosition=${cs.trackPosition} `
    + `exists=${cs.exists}`);

  const slidOntoHeir = names.some((n) => n.includes(`"${heirBefore}"`));
  check('⚠ a pinned cursor whose target is DELETED does not silently slide onto the heir',
    !slidOntoHeir, { heir: heirBefore, matchesNow: names });
  if (slidOntoHeir) {
    note('⚠ CONFIRMED and it is the sharpest limitation on §3.4g: the cursor followed the');
    note('  POSITION, not the object, so `createEqualsValue` reads TRUE against a track that');
    note('  is not the one that was addressed. The guard detects DRIFT (§3b, where the');
    note('  target survived and moved) but NOT DEATH — and the two are indistinguishable');
    note('  from the equals value alone. Pairing it with channelId remains mandatory.');
  } else if (names.length === 0) {
    note('⚠ the cursor matches nothing, so deletion IS detectable — which is more than');
    note('  resolveByChannelId gives, where found:false is byte-identical to out-of-window');
    note('  (trap 12).');
  }
}

console.log('\n-- cleanup');
check('the project is back to the track count it started with',
  (await list()).count === before.count, { before: before.count, after: (await list()).count });

console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} FAILURES`);
process.exit(failureCount() === 0 ? 0 : 1);
