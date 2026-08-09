/**
 * E20b — `duplicateClip()`, the primitive that mints the next take, run for the
 * first time.
 *
 * ⚠⚠ **The question is not "does it work". It is WHERE THE COPY LANDS.** The
 * javadoc is three words — *"Duplicates the clip."* — and the clip block's whole
 * geometry rests on the answer:
 *
 *   - an **APPEND** into a free row leaves every existing clip address intact,
 *     and the append-only discipline E18-VERDICT §4b proposes is sound;
 *   - an **INSERT** shifts every row beneath it, exactly as `Scene.deleteObject()`
 *     compacts upward (E3), and **permanently stales every pinned cursor's
 *     `sceneIndex`** — in which case minting a take is a structural op that
 *     invalidates addresses and the discipline needs a pre-cleared row.
 *
 * A caller that only checked the row it expected would read an insert as a
 * success, so every arm below diffs the WHOLE COLUMN and identifies clips by
 * their contents, never by where they were last seen.
 *
 *     npm run probe:e20b
 *
 * ⚠ **Two routes**, per standing rule 10: `ClipLauncherSlot.duplicateClip()` and
 * `ClipLauncherSlotBank.duplicateClip(int)`. They are different methods on
 * different types, and sibling verbs on these very interfaces have disagreed
 * before (`copyDevices` ○ beside `moveDevices` ● — E4d/E16n), so a ○ from one
 * says nothing about the other.
 *
 * Silent: nothing is launched and the transport is never touched. Creates clips
 * only in a region it has verified is EMPTY, and deletes only what it created.
 */
import {
  client, check, note, failureCount, pollUntil, ensureFixtureTracks,
} from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);

/**
 * Three consecutive rows, which is the minimum every arm actually needs: a
 * source, a free neighbour below it, and one more row for the copy to land in
 * when that neighbour is occupied.
 *
 * ⚠ Sized DOWN from four after the first run refused on a 10-scene project. The
 * fourth row existed only to park the UI selection for B6, and parking it
 * OUTSIDE the region is both cheaper and a better test — a selection two rows
 * away is weaker evidence than one on a different part of the grid entirely.
 */
const REGION = 3;
/** ⚠ Start the search above `e19`'s row 6 and `e20a`'s rows 4–5. */
const FIRST_CANDIDATE = 7;
/** Where B6 parks the UI selection: far from the region, and never inside it. */
const SELECTION_PARK = 0;

const SOURCE_PITCH = 60;
const NEIGHBOUR_PITCH = 72;

interface SlotStatus { exists: boolean; hasContent: boolean }
interface Mark { contentEpoch: number; contentEvents: WireEvent[] }
interface WireEvent { seq: number; channelId: string; slotIndex: number; filled: boolean }

await client.connect();
const { trackA } = await ensureFixtureTracks();
const tracks = (await req('track.list')) as { tracks: { index: number; channelId: string }[] };
const channelA = tracks.tracks.find((t) => t.index === trackA)?.channelId ?? '';
const rig = (await req('rig.info')) as { scenes: number; sceneCount: number };

const status = async (slotIndex: number): Promise<SlotStatus> =>
  (await req('slot.status', { trackIndex: trackA, slotIndex })) as SlotStatus;
const mark = async (): Promise<Mark> => (await req('revision.get')) as Mark;
const since = (m: Mark, from: number): WireEvent[] => m.contentEvents.filter((e) => e.seq > from);

/** Which rows of gn-A's column hold a clip, across the whole visible window. */
async function column(): Promise<boolean[]> {
  const rows: boolean[] = [];
  for (let j = 0; j < visibleRows; j++) rows.push((await status(j)).hasContent);
  return rows;
}
const occupied = (rows: boolean[]): number[] =>
  rows.flatMap((has, index) => (has ? [index] : []));

/**
 * ⚠⚠ STANDING RULE 5, ONE POPULATION DOWN — and this probe REFUSES rather than
 * fixes it.
 *
 * `sceneBank.itemCount()` reports the PROJECT total while `getScene(i)` is bounded
 * to the window, so a scene created past the window is unaddressable and
 * un-deletable — `e19` stranded one in a 99-scene project and that is how the gap
 * was found. The rule is written about tracks and covers scenes verbatim; it is
 * **not implemented for scenes**, and implementing it is the proposed session 3‴,
 * not this probe's business. What IS this probe's business is never being the
 * thing that strands a row.
 */
let sceneCount = rig.sceneCount;
let visibleRows = Math.min(rig.scenes, sceneCount);
note(`scene bank window ${rig.scenes}, project scenes ${sceneCount} => ${visibleRows} addressable rows`);
if (visibleRows < FIRST_CANDIDATE + REGION) {
  check('E20b-B0: a four-row region is addressable', false,
    `SKIPPED — only ${visibleRows} rows are both present and inside the bank window, and this `
    + `probe needs ${REGION} consecutive free rows at or above row ${FIRST_CANDIDATE} (rows 0-6 `
    + 'belong to the fixture, `e19` and `e20a`). Add scenes in Bitwig — ⚠ keeping the total at or '
    + `below the ${rig.scenes}-wide window, standing rule 5 — or raise \`scenes\` in `
    + '~/.ghostnote/rig.json, and re-run.');
  process.exit(1);
}

/**
 * Find a run of empty rows we may use — and NEVER clear one that is occupied.
 *
 * ⚠ The obvious shortcut is to delete whatever is in the way. A clip in the
 * fixture column is far more likely to be the operator's than ours, `slot.delete`
 * is not undoable by us, and D19/D20 put destruction outside what a probe decides.
 * Refusing costs a re-run; deleting costs somebody's work.
 */
function findRegion(rows: boolean[]): number {
  for (let base = FIRST_CANDIDATE; base + REGION <= rows.length; base++) {
    if (rows.slice(base, base + REGION).every((has) => !has)) return base;
  }
  return -1;
}

let initial = await column();
let base = findRegion(initial);

/**
 * ⚠ No free rows? GROW THE GRID — the same move the clip block itself will make.
 *
 * E18-VERDICT §4b's geometry is *append only*: `Project.createScene()` appends at
 * the end (● instant, E3) and a block that needs room takes a new row rather than
 * inserting one, because a mid-grid insert shifts every row below it and stales
 * every address (E3's compaction, upside down). So a probe that needs room should
 * take it the same way the design will.
 *
 * ⚠⚠ **The budget is checked BEFORE the call, never after** (standing rule 5,
 * restated 2026-08-07). `sceneBank.itemCount()` reports the PROJECT total while
 * `getScene(i)` is bounded to the window, so a create past the window mints a row
 * nothing can address or delete — `e19` stranded one exactly this way, and
 * "detect and fail" would run after the damage.
 *
 * ⚠ One coupling, stated because it is the design's too: room is per TRACK (a
 * column) but a scene row is PROJECT-WIDE, so one track running out of space costs
 * a global row that arrives empty for every other track.
 */
let createdScenes = 0;
if (base < 0) {
  const budget = rig.scenes - sceneCount;
  if (budget >= REGION) {
    note(`no free rows among the ${visibleRows} that exist — appending ${REGION} scenes `
      + `(budget ${budget} of the ${rig.scenes}-wide window)`);
    await req('scene.create', { count: REGION });
    const grew = await pollUntil(async () =>
      ((await req('rig.info')) as { sceneCount: number }).sceneCount >= sceneCount + REGION, 8000, 100);
    const after = (await req('rig.info')) as { sceneCount: number };
    // ⚠ BOUND THE DELTA before anything leans on it (method guard 4). If the count
    // moved by something other than what we asked for, we are reading the wrong
    // number — and the cleanup below would then delete somebody else's row.
    if (!grew.ok || after.sceneCount !== sceneCount + REGION) {
      console.log(`ABORT: asked for ${REGION} scenes and the count went `
        + `${sceneCount} -> ${after.sceneCount}. Nothing created or deleted that can be relied on.`);
      process.exit(2);
    }
    createdScenes = REGION;
    base = sceneCount;
    sceneCount = after.sceneCount;
    visibleRows = Math.min(rig.scenes, sceneCount);
    initial = await column();
  }
}

check('E20b-B0: three consecutive EMPTY rows are available to work in', base >= 0,
  base >= 0
    ? { base, appendedScenes: createdScenes }
    : { occupiedRows: occupied(initial), note: 'nothing was deleted to make room' });
if (base < 0) {
  console.log(`REFUSING: no ${REGION} free rows at or above ${FIRST_CANDIDATE} on gn-A, and the`);
  console.log(`scene budget (${rig.scenes - sceneCount} of a ${rig.scenes}-wide window) cannot cover`);
  console.log('appending more. Clear some rows yourself and re-run — this probe will not delete');
  console.log('your clips, and it will not strand a scene past the bank window to make room.');
  process.exit(1);
}
note(`working in rows ${base}..${base + REGION - 1} of gn-A (bank index ${trackA})`);

/** Put a clip with an identifying pitch in a row we have verified is empty. */
async function plant(slotIndex: number, pitch: number, cursor: string): Promise<boolean> {
  await req('clip.create', { trackIndex: trackA, slotIndex, lengthBeats: 4 });
  if (!(await pollUntil(async () => (await status(slotIndex)).hasContent)).ok) return false;
  await req('cursor.pin', { cursor, pinned: false });
  await req('cursor.pointTrack', { cursor, trackIndex: trackA });
  await req('slot.select', { trackIndex: trackA, slotIndex, mechanism: 'track' });
  const landed = await pollUntil(async () =>
    ((await req('cursor.status', { cursor })) as { sceneIndex: number }).sceneIndex === slotIndex);
  if (!landed.ok) return false;
  await req('cursor.clearNotes', { cursor });
  await req('cursor.setNotes', { cursor, notes: [[0, pitch, 100, 0.9], [4, pitch, 100, 0.9]] });
  return (await pollUntil(async () =>
    ((await req('cursor.getNotes', { cursor })) as { notes: number[][] }).notes.length === 2)).ok;
}

/**
 * ⚠ The identity check, and the reason every clip here carries a pitch.
 *
 * Clips and scenes have NO identity at all in the API — a complete pass over 1968
 * members found none (E16l). So "is the clip at row N the one that used to be at
 * row N" is not a question the API can answer, and contents are the only handle
 * there is. That is exactly why an insert would otherwise be invisible.
 */
async function pitchAt(slotIndex: number, cursor = '2'): Promise<number[]> {
  if (!(await status(slotIndex)).hasContent) return [];
  await req('cursor.pin', { cursor, pinned: false });
  await req('cursor.pointTrack', { cursor, trackIndex: trackA });
  await req('slot.select', { trackIndex: trackA, slotIndex, mechanism: 'track' });
  const landed = await pollUntil(async () =>
    ((await req('cursor.status', { cursor })) as { sceneIndex: number }).sceneIndex === slotIndex);
  if (!landed.ok) return [-1];
  const { notes } = (await req('cursor.getNotes', { cursor })) as { notes: number[][] };
  return [...new Set(notes.map((n) => n[1] as number))].sort((a, b) => a - b);
}

/** Delete only rows this probe filled, and only after checking each one. */
async function clearRegion(): Promise<void> {
  for (let j = base; j < base + REGION; j++) {
    if ((await status(j)).hasContent) {
      await req('slot.delete', { trackIndex: trackA, slotIndex: j });
      await pollUntil(async () => !(await status(j)).hasContent);
    }
  }
}

/**
 * One duplication trial, read as a whole-column diff.
 *
 * ⚠ `columnBefore` comes back from the extension, read on the control-surface
 * thread in the same request that performs the duplicate — so nothing can slip
 * between the reading and the act. The "after" is ours, polled.
 */
async function duplicate(sourceRow: number, route: 'slot' | 'bank'): Promise<{
  before: boolean[]; after: boolean[]; appeared: number[]; events: WireEvent[];
}> {
  const before = await column();
  const at = await mark();
  await req('slot.duplicateClip', { trackIndex: trackA, slotIndex: sourceRow, route });
  // ⚠ Poll for a CHANGE ANYWHERE rather than for a specific row: the row is the
  // finding, so waiting on one would presuppose the answer and time out on the
  // interesting outcome.
  //
  // ⚠ A whole-column read costs one request per row, so the interval is 200ms
  // rather than the usual 50 — the normal case exits on the first poll, and the
  // slow path is the one where nothing happened, which is exactly where hammering
  // the control-surface thread buys nothing.
  const changed = await pollUntil(async () => {
    const now = await column();
    return now.some((has, index) => has !== before[index]);
  }, 4000, 200);
  const after = await column();
  const appeared = after.flatMap((has, index) => (has && !before[index] ? [index] : []));
  if (!changed.ok) note(`route "${route}": nothing changed in the column within 4s`);
  return { before, after, appeared, events: since(await mark(), at.contentEpoch) };
}

// --- B1. the free-neighbour case, through the slot route ---------------------
console.log('\n-- B1. duplicate with the next row EMPTY (ClipLauncherSlot.duplicateClip)');
await clearRegion();
check('E20b-B1a: the source clip is in place', await plant(base, SOURCE_PITCH, '0'));
const slotRoute = await duplicate(base, 'slot');
check('E20b-B1b: exactly ONE new clip appeared in the column',
  slotRoute.appeared.length === 1,
  { appeared: slotRoute.appeared, before: occupied(slotRoute.before), after: occupied(slotRoute.after) });
// ⚠ REPORTED, not asserted. "The next row down" is the hypothesis the geometry
// assumes; making it a check would turn a measurement into a confirmation.
note(`route "slot": source row ${base} -> copy landed at row ${JSON.stringify(slotRoute.appeared)}`);
check('E20b-B1c: the source clip is still where it was — a duplicate is not a move',
  slotRoute.after[base] === true, { columnAfter: occupied(slotRoute.after) });

// ⚠ B5 rides here: minting an EMPTY clip would satisfy every geometry check above
// and be worthless as a take.
const copyRow = slotRoute.appeared[0];
const copiedPitches = copyRow === undefined ? [] : await pitchAt(copyRow);
check('E20b-B5: the copy carries the source\'s notes, not an empty clip',
  copiedPitches.length === 1 && copiedPitches[0] === SOURCE_PITCH,
  { atRow: copyRow, pitches: copiedPitches, expected: SOURCE_PITCH });

// ⚠ B4: session 3's observers must SEE it, or the block's geometry is not
// self-reporting and 3″ needs a readback discipline instead of a mark.
check('E20b-B4: the duplicate arrives as a FILL naming the track by durable channelId',
  slotRoute.events.some((e) => e.filled && e.channelId === channelA && e.slotIndex === copyRow),
  { events: slotRoute.events, want: { channelId: channelA, slotIndex: copyRow } });

// --- B2. the same question through the bank route ----------------------------
console.log('\n-- B2. the second mechanism (ClipLauncherSlotBank.duplicateClip(int))');
await clearRegion();
check('E20b-B2a: the source clip is in place', await plant(base, SOURCE_PITCH, '0'));
const bankRoute = await duplicate(base, 'bank');
check('E20b-B2b: the bank route also produces exactly one new clip',
  bankRoute.appeared.length === 1,
  { appeared: bankRoute.appeared, after: occupied(bankRoute.after) });
check('E20b-B2c: and it agrees with the slot route about WHERE',
  JSON.stringify(bankRoute.appeared) === JSON.stringify(slotRoute.appeared),
  { slotRoute: slotRoute.appeared, bankRoute: bankRoute.appeared });

// --- B3. ⚠⚠ the geometry hazard: the next row is OCCUPIED ---------------------
//
// ⚠⚠ **MEASURED 2026-08-09, and the answer was a THIRD option neither the design
// nor this probe's first draft listed.** The candidates were "append past the
// block" and "insert, shifting every row below" (E18-VERDICT §4b's named hazard).
// What Bitwig actually does is OVERWRITE: the copy lands in the next row down and
// the clip that was there is gone — row 11 held pitch 72 before and pitch 60
// after, with row 12 still empty, so nothing was pushed anywhere.
//
// ⇒ ⚠⚠ **Minting a take DESTROYS whatever is in the next row.** For session 3″
// that is a hard precondition, not a nicety: `duplicateClip` may only be called
// against a next row VERIFIED EMPTY, or the block eats a take. It also lands on
// D20 — an agent calling this without the check destroys a clip nobody authorised,
// and the destruction is not ours to undo.
console.log('\n-- B3. duplicate with the next row OCCUPIED — insert, append, or overwrite?');
await clearRegion();
check('E20b-B3a: a crowded pair is in place',
  (await plant(base, SOURCE_PITCH, '0')) && (await plant(base + 1, NEIGHBOUR_PITCH, '1')));
const crowded = await duplicate(base, 'slot');
const neighbourNow = await pitchAt(base + 1);
const rowBelow = await pitchAt(base + 2);
note(`route "slot", crowded: appeared at ${JSON.stringify(crowded.appeared)}; `
  + `row ${base + 1} now holds pitch ${JSON.stringify(neighbourNow)}, row ${base + 2} holds ${JSON.stringify(rowBelow)}`);

// ⚠ All three outcomes named and separated, because two of them put a pitch-60
// clip in row base+1 and only the row BELOW tells them apart. The first draft of
// this check tested one of them and would have reported an overwrite as an insert.
const holds = (pitches: number[], pitch: number): boolean =>
  pitches.length === 1 && pitches[0] === pitch;
const outcome =
  holds(neighbourNow, NEIGHBOUR_PITCH) && crowded.appeared.length === 1 ? 'append'
    : holds(neighbourNow, SOURCE_PITCH) && holds(rowBelow, NEIGHBOUR_PITCH) ? 'insert'
      : holds(neighbourNow, SOURCE_PITCH) && rowBelow.length === 0 ? 'overwrite'
        : crowded.appeared.length === 0 && holds(neighbourNow, NEIGHBOUR_PITCH) ? 'refused'
          : 'unclassified';
note(`   => ${outcome.toUpperCase()}`);

// ⚠ The MEASURED behaviour is pinned as the expectation, so a future Bitwig that
// changed it turns this red. The danger lives in the check's name, not in a
// permanent failure — a probe that is always red stops being read.
check('E20b-B3b: ⚠⚠ a duplicate into an OCCUPIED next row OVERWRITES it — the take that was '
  + 'there is destroyed, so the clip block MUST verify the row is empty first',
  outcome === 'overwrite',
  { outcome, neighbourWas: NEIGHBOUR_PITCH, neighbourNow, rowBelow, appeared: crowded.appeared });

// ⚠⚠ AND THE OBSERVERS CANNOT SEE IT. Occupancy does not change — an occupied
// slot stays occupied — so `addHasContentObserver` never fires and session 3's
// content window reports the destruction as a quiet one. This is the same shape
// as the `moved` verdict's motivating case (a clip replaced by an identical one
// compares equal), one step worse: here the contents are DIFFERENT and the window
// is still empty.
check('E20b-B3c: ⚠⚠ the overwrite fires NO occupancy event — session 3\'s detector is blind '
  + 'to it, exactly as it is to an identical replacement',
  crowded.events.length === 0, { events: crowded.events });

// --- B6. is a UI selection required? -----------------------------------------
//
// ⚠ `duplicateClip` is an addressed API call and should not care. It is asked
// anyway because E6's selection hazard has bitten twice — named actions fire
// against the UI selection our own pointing moves — and a ● here is what lets
// session 3″ call this without establishing a selection first.
console.log('\n-- B6. with the UI selection deliberately somewhere else');
await clearRegion();
check('E20b-B6a: the source clip is in place', await plant(base, SOURCE_PITCH, '0'));
await req('slot.select', { trackIndex: trackA, slotIndex: SELECTION_PARK, mechanism: 'track' });
const elsewhere = await duplicate(base, 'slot');
check('E20b-B6: the duplicate lands with the selection pointed at another row',
  elsewhere.appeared.length === 1 && elsewhere.appeared[0] !== SELECTION_PARK,
  { appeared: elsewhere.appeared, selectionWasAt: SELECTION_PARK });

// --- cleanup -----------------------------------------------------------------
//
// ⚠ Bounded, and it deletes nothing outside the region it claimed as empty.
const finalColumn = await column();
const strays = occupied(finalColumn).filter((row) => row < base || row >= base + REGION);
const straysAtStart = occupied(initial);
if (JSON.stringify(strays) !== JSON.stringify(straysAtStart)) {
  console.log('\n⚠ ABORT — the column changed OUTSIDE the region this probe claimed.');
  note(`before: ${JSON.stringify(straysAtStart)}  now: ${JSON.stringify(strays)}`);
  note('Nothing deleted. Either a duplicate landed further away than any arm predicted, or');
  note('someone else edited the column while this ran — both are findings, and both make a');
  note('blind cleanup the wrong move (method guard 4: an impossible delta means abort).');
  process.exit(2);
}
await clearRegion();

// ⚠ Give the appended rows back, from the END. `Scene.deleteObject()` compacts
// upward (E3), so deleting a TRAILING row moves nothing — while deleting a
// mid-grid one would shift every row beneath it and permanently stale any pinned
// cursor's `sceneIndex`. Order is the whole safety property here.
if (createdScenes > 0) {
  for (let k = 0; k < createdScenes; k++) {
    const now = (await req('rig.info')) as { sceneCount: number };
    await req('scene.delete', { sceneIndex: now.sceneCount - 1 });
    await pollUntil(async () =>
      ((await req('rig.info')) as { sceneCount: number }).sceneCount === now.sceneCount - 1);
  }
  const finalCount = ((await req('rig.info')) as { sceneCount: number }).sceneCount;
  note(`returned ${createdScenes} appended scene rows; project is back to ${finalCount}`);
}

console.log(failureCount() === 0 ? '\nE20b: PASS' : `\nE20b: ${failureCount()} FAILED`);
process.exit(failureCount() === 0 ? 0 : 1);
