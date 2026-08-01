/**
 * E16 §3.4g — ⚠ is `ObjectProxy.createEqualsValue` usable as a target guard?
 *
 * E16l's find, and the one thing that complete-recall pass turned up which
 * nobody had recorded. It creates a `BooleanValue` that is true when two proxies
 * are proxying the SAME target object — a genuine identity comparison, where
 * D6's guard today is "verify a cursor's target by name and position".
 *
 * Four questions, and the last two are what decide whether it is worth anything:
 *
 *   1. ⚠ **Is it init-only?** It is a `create*`, the exact shape that has thrown
 *      *"can only be called during driver initialization"* four times across
 *      unrelated subsystems (standing rule 13). The rule is stated as a DEFAULT
 *      to assume, not as something checked on this method. `equals.tryCreate`
 *      asks directly. If it IS init-only, the guard can only ever compare pairs
 *      we predicted at startup, which is most of the cost of using it.
 *   2. **Does it work at all** — true when both proxies are on one object, false
 *      otherwise, and does it update promptly enough to guard a write?
 *   3. ⚠ **Does it beat name-and-position?** Two discriminating cases: a RENAME,
 *      which breaks a name check and must not break this; and a POSITION SHIFT,
 *      which nothing we have today detects at all.
 *   4. ⚠ **Does it help CLIPS?** This is where the honest answer probably hurts.
 *      It compares proxies WE HOLD, and the only persistent proxies are 3 pool
 *      cursors and 16 bank rows. For a track that is enough for a real guard. For
 *      a clip there is no second persistent proxy on the intended clip, so the
 *      only clip pairs that exist are cursor-to-cursor — which measures our own
 *      addressing, not the clip's identity. E16l proved clips have no identity;
 *      this row should not be allowed to look like it found one.
 *
 * ⚠ The matrix is pre-allocated in `Rig.buildEqualsProbes` and every entry is
 * named (`ct0=bank3`, `clip0=follower`) rather than indexed, so the transcript
 * says what is being compared instead of a coordinate to decode.
 *
 * Silent. Duplicates one track to shift positions and deletes it again; renames
 * a fixture track and puts the name back. Refuses while the transport rolls.
 */
import { client, check, note, failureCount, pollUntil, ensureFixtureTracks, point } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);

interface EqualsStatus {
  buildStatus: string;
  pairCount: number;
  trueCount: number;
  pairs: Record<string, boolean | string>;
}
const equals = async (all = false) => (await req('equals.status', { all })) as EqualsStatus;
/** Just the pairs reading true — the matrix is 65 entries and the falses are noise. */
const trues = async (): Promise<string[]> => Object.keys((await equals()).pairs);
const pairOf = async (key: string): Promise<boolean | string | undefined> =>
  (await equals(true)).pairs[key];

type TrackRow = { index: number; name: string; channelId: string; type: string };
const list = async () => (await req('track.list')) as { tracks: TrackRow[]; count: number };
const indexOf = async (channelId: string): Promise<number | undefined> => {
  const r = (await req('track.resolveByChannelId', { channelId })) as { found: boolean; index?: number };
  return r.found ? r.index : undefined;
};

await client.connect();
console.log('connected\n');

const rolling = (await req('transport.status')) as { isPlaying: boolean };
if (rolling.isPlaying) {
  console.log('REFUSING: the transport is rolling and this probe duplicates and deletes a');
  console.log('track. Stop the transport and re-run.');
  process.exit(1);
}

// ==========================================================================
// 1 — did the matrix survive init, and is createEqualsValue init-only?
// ==========================================================================
console.log('-- 1: the build, and standing rule 13\'s question');

const built = await equals();
note(`build status: ${built.buildStatus}`);
check('the equals matrix was built at init without bricking the extension',
  built.buildStatus.startsWith('built:'), { buildStatus: built.buildStatus, pairs: built.pairCount });

if (!built.buildStatus.startsWith('built:')) {
  console.log('\nREFUSING to read further: the matrix did not build, so every pair below would');
  console.log('be reporting the absence of a handle rather than the identity of an object.');
  console.log('⚠ That is itself the §3.4g answer — createEqualsValue is not usable at init on');
  console.log('this rig — and it should be written up as one. Nothing else here is meaningful.');
  process.exit(1);
}

const fresh = (await req('equals.tryCreate')) as
  { created: boolean; readsAs?: unknown; threw?: string; message?: string };
check('⚠ RULE 13: createEqualsValue outside init() is REFUSED, as the rule predicts',
  !fresh.created, fresh);
if (fresh.created) {
  note('⚠ it is NOT init-only — standing rule 13 does not apply to this method. That is a');
  note('  real relaxation: the guard could be built on demand for an arbitrary pair rather');
  note('  than only for pairs predicted at startup, which is most of its cost.');
  note(`  a freshly created value reads as: ${JSON.stringify(fresh.readsAs)}`);
} else {
  note(`refused with ${fresh.threw}: ${fresh.message}`);
  note('⚠ so every usable pair must be pre-allocated at init. The guard is bounded to');
  note('  pairs we predicted, and its cost is fixed at startup rather than paid per use.');
}

// ==========================================================================
// 2 — does it work at all?
// ==========================================================================
console.log('\n-- 2: does it read true for the same object and false for a different one?');

const { trackA, trackB } = await ensureFixtureTracks();
const rows = (await list()).tracks;
const rowA = rows.find((t) => t.index === trackA)!;
const rowB = rows.find((t) => t.index === trackB)!;
note(`gn-A at bank ${trackA} (${rowA.channelId}), gn-B at bank ${trackB} (${rowB.channelId})`);

await req('cursor.pointTrack', { cursor: '0', trackIndex: trackA });
await req('cursor.pinTrack', { cursor: 0, pinned: true });
const settled = await pollUntil(async () => (await trues()).includes(`ct0=bank${trackA}`), 4000, 50);
check('cursor 0 pointed at gn-A reads TRUE against gn-A\'s bank row',
  settled.ok, { pair: `ct0=bank${trackA}`, settledMs: settled.ms });
note(`⚠ it settled in ${settled.ms}ms — a guard that lags is a guard that lies, so this is`);
note('  the number that decides whether it can be read immediately after a repoint.');

check('and FALSE against gn-B\'s bank row', (await pairOf(`ct0=bank${trackB}`)) === false,
  { pair: `ct0=bank${trackB}`, value: await pairOf(`ct0=bank${trackB}`) });

const trueSet = await trues();
const ct0Trues = trueSet.filter((k) => k.startsWith('ct0=bank'));
check('⚠ exactly ONE bank row matches — the comparison is identity, not a class test',
  ct0Trues.length === 1, { matched: ct0Trues });

// ==========================================================================
// 3 — the two cases that beat name-and-position
// ==========================================================================
console.log('\n-- 3a: a RENAME, which a name-based guard fails');

await req('track.setName', { trackIndex: trackA, name: 'gn-A renamed by e16t' });
await pollUntil(async () => (await list()).tracks.find((t) => t.index === trackA)?.name
  === 'gn-A renamed by e16t', 4000, 50);
const survivedRename = (await pairOf(`ct0=bank${trackA}`)) === true;
check('⚠ the guard SURVIVES a rename (D6\'s name check would have failed here)',
  survivedRename, { pair: `ct0=bank${trackA}`, value: await pairOf(`ct0=bank${trackA}`) });
await req('track.setName', { trackIndex: trackA, name: 'gn-A' });
await pollUntil(async () => (await list()).tracks.find((t) => t.index === trackA)?.name === 'gn-A');

console.log('\n-- 3b: a POSITION SHIFT, which nothing we have today detects');

/**
 * ⚠ The shift is made by DUPLICATING a track above the target, not by creating
 * one: E2c measured that `createInstrumentTrack(position)` does not honour bank
 * positions and lands at the end, which would shift nothing and produce a
 * green-looking null result. A duplicate lands immediately after its source
 * (A4/E3), so everything below it moves down exactly one.
 */
await req('cursor.pointTrack', { cursor: '1', trackIndex: trackB });
await req('cursor.pinTrack', { cursor: 1, pinned: true });
await pollUntil(async () => (await trues()).includes(`ct1=bank${trackB}`), 4000, 50);
check('cursor 1 is pinned to gn-B before the shift',
  (await pairOf(`ct1=bank${trackB}`)) === true, { pair: `ct1=bank${trackB}` });

const beforeShift = await list();
const beforeIds = new Set(beforeShift.tracks.map((t) => t.channelId));
await req('branch.duplicateTrack', { trackIndex: trackA });
const grew = await pollUntil(async () => (await list()).count === beforeShift.count + 1, 8000, 100);
check('PRECONDITION: a duplicate of gn-A appeared', grew.ok,
  { before: beforeShift.count, after: (await list()).count });

let dupId: string | undefined;
if (grew.ok) {
  dupId = (await list()).tracks.find((t) => !beforeIds.has(t.channelId))?.channelId;
  const newIndexB = await indexOf(rowB.channelId);
  note(`gn-B moved from bank ${trackB} to bank ${newIndexB}`);

  const oldPair = await pairOf(`ct1=bank${trackB}`);
  const newPair = newIndexB === undefined ? undefined : await pairOf(`ct1=bank${newIndexB}`);
  check('⚠ the guard goes FALSE at the OLD position — positional drift is DETECTED',
    oldPair === false, { pair: `ct1=bank${trackB}`, value: oldPair });
  check('and TRUE at the NEW one, so it also says where the target went',
    newPair === true, { pair: `ct1=bank${newIndexB}`, value: newPair });
  note('⚠ this is the capability D6 does not have. A name-and-position check re-reads a');
  note('  name and compares it; this reports "the thing you addressed is no longer here"');
  note('  with no read of the target at all, which is what makes it a guard rather than a');
  note('  verification step.');
}

// ==========================================================================
// 4 — the clip question, asked honestly
// ==========================================================================
console.log('\n-- 4: does any of this help CLIPS?');

const liveA = (await indexOf(rowA.channelId)) ?? trackA;
await point('0', liveA, 0, 'trackThenSlot');
await point('1', liveA, 0, 'trackThenSlot');
const sameSlot = await pollUntil(async () => (await pairOf('clip0=clip1')) === true, 4000, 50);
check('two pool clip cursors on the SAME slot compare equal', sameSlot.ok,
  { pair: 'clip0=clip1', value: await pairOf('clip0=clip1') });

await point('1', liveA, 1, 'trackThenSlot');
const diffSlot = await pollUntil(async () => (await pairOf('clip0=clip1')) === false, 4000, 50);
check('and on DIFFERENT slots they do not', diffSlot.ok,
  { pair: 'clip0=clip1', value: await pairOf('clip0=clip1') });

note('⚠ what this does and does not establish. It works — but both halves are OUR OWN');
note('  cursors, so it measures our addressing, not the clip. There is no second');
note('  persistent proxy on a clip a human might move, because a `Clip` and a');
note('  `ClipLauncherSlot` are different objects and the bank holds only the latter.');
note('  ⇒ It is an ALIASING detector (E2c\'s fixture contamination, diagnosed directly');
note('  rather than from symptoms) and NOT the clip identity D6 wants. E16l stands.');

const followerPair = await pairOf('clip0=follower');
note(`clip0=follower currently reads ${JSON.stringify(followerPair)} — true only when the`);
note('  human\'s own clip selection happens to be the slot cursor 0 is on.');

// ==========================================================================
// 5 — what happens when the target is DELETED
// ==========================================================================
console.log('\n-- 5: the target is deleted');
if (dupId !== undefined) {
  const dupIndex = await indexOf(dupId);
  if (dupIndex !== undefined) {
    await req('cursor.pointTrack', { cursor: '2', trackIndex: dupIndex });
    await req('cursor.pinTrack', { cursor: 2, pinned: true });
    await pollUntil(async () => (await trues()).some((k) => k.startsWith('ct2=bank')), 4000, 50);
    const pinnedTo = (await trues()).filter((k) => k.startsWith('ct2=bank'));
    note(`cursor 2 is pinned to the duplicate: ${pinnedTo.join(', ') || '(no match)'}`);

    await req('track.delete', { trackIndex: dupIndex });
    await pollUntil(async () => (await indexOf(dupId)) === undefined, 8000, 100);
    const after = (await trues()).filter((k) => k.startsWith('ct2=bank'));
    check('⚠ after the target is deleted the cursor matches nothing (or follows elsewhere)',
      true, { matchesNow: after });
    note(`⚠ cursor 2 now matches ${after.length} bank rows. If it matches ONE, the cursor`);
    note('  slid onto a NEIGHBOUR — which is the E3 hazard and means "still matches something"');
    note('  must never be read as "still on my target". If it matches none, deletion is');
    note('  detectable, which is more than resolveByChannelId offers (trap 12: found:false');
    note('  is byte-identical to out-of-window).');
  }
} else {
  note('skipped: no duplicate was made, so there is nothing safe to delete.');
}

// ==========================================================================
// cleanup + verdict
// ==========================================================================
console.log('\n-- cleanup');
if (dupId !== undefined) {
  const stillThere = await indexOf(dupId);
  if (stillThere !== undefined) {
    await req('track.delete', { trackIndex: stillThere });
    await pollUntil(async () => (await indexOf(dupId)) === undefined, 8000, 100);
  }
}
const finalName = (await list()).tracks.find((t) => t.channelId === rowA.channelId)?.name;
check('gn-A\'s name was put back', finalName === 'gn-A', { name: finalName });
check('the project is back to the track count it started with',
  (await list()).count === beforeShift.count,
  { before: beforeShift.count, after: (await list()).count });

console.log('\n================ §3.4g verdict ================');
note(`init-only: ${fresh.created ? '○ no — it can be created on demand' : '● yes, rule 13 holds'}`);
note(`as a TRACK guard: survives rename ${survivedRename ? '●' : '○'}, detects position drift — see 3b`);
note('as a CLIP guard: ○ — it can only compare proxies we hold, and a clip has no second one.');
note('⚠ recommendation is the write-up\'s job, not this probe\'s (rule 10).');

console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} FAILURES`);
process.exit(failureCount() === 0 ? 0 : 1);
