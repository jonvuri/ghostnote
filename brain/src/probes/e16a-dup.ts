/**
 * E16 row A — can a TOP-LEVEL track be duplicated at all?
 *
 * This is the gate. `SPIKE-E16-BRANCHES-AS-TRACKS.md` §4 kill criterion 1: if a
 * track cannot be duplicated there is no idea, because rebuilding a track by
 * hand would be `none`-fidelity in exactly the way branches exist to avoid.
 *
 * ⚠ The doc pass alone cannot answer it, which is why this runs live. `Track`
 * extends `Channel` extends `DuplicableObject`, so all three routes COMPILE —
 * and E4c is the standing warning about what that is worth: `DeviceLayer` also
 * extends `Channel`, and both `duplicate()` and `duplicateObject()` were silent
 * no-ops on it. A supertype method is a claim, not a capability.
 *
 * Three routes are tried in sequence, each on the same fixture, each identified
 * by a channelId diff of the bank (standing rule 2 — E2c's positional heuristic
 * is what got track identity wrong the first time).
 *
 * Also collects, cheaply, on an ordinary instrument track: A4 (new channelId,
 * landing position), C1 (latency baseline), D1 (does the copy resolve), D2 (do
 * held addresses go stale), B4/B5 lite (clips and mixer state carried), F1/G1
 * (undo granularity, delete-as-revert). Rows B/C proper need the hard fixture.
 *
 * Creates up to 3 duplicate tracks and deletes every one of them again.
 */
import { client, check, note, failureCount, pollUntil } from './lib.js';

type TrackRow = { index: number; name: string; position: number; type: string; channelId: string };
type TrackList = { tracks: TrackRow[]; count: number; itemCount: number; bankSize: number };
type Mixer = {
  index: number; name: string; channelId: string; position: number; type: string;
  isGroup: boolean; volume: number; volumeDisplayed: string; pan: number;
  mute: boolean; solo: boolean; mutedBySolo: boolean; activated: boolean; color: string;
  sends: { index: number; name: string; value: number; enabled: boolean; preFader: boolean }[];
  sendCount: number;
};

const list = async () => (await client.request('track.list')) as TrackList;
const mixer = async (trackIndex: number) =>
  (await client.request('branch.mixer', { trackIndex })) as Mixer;
const resolve = async (channelId: string) =>
  (await client.request('track.resolveByChannelId', { channelId })) as
    { found: boolean; index?: number; name?: string; position?: number; type?: string };
const slotHasContent = async (trackIndex: number, slotIndex: number) =>
  ((await client.request('slot.status', { trackIndex, slotIndex })) as { hasContent: boolean }).hasContent;

await client.connect();
console.log('connected\n');

// ---- 0. refuse to run half-blind (standing rule 5) ----
const start = await list();
note(`bank: ${start.count} visible, itemCount=${start.itemCount}, bankSize=${start.bankSize}`);
if (start.itemCount > start.bankSize) {
  console.log('REFUSING: project exceeds the bank window; every reading here would be partial.');
  process.exit(1);
}
if (start.itemCount + 3 > start.bankSize) {
  console.log('REFUSING: not enough bank headroom for 3 duplicates.');
  process.exit(1);
}

const source = start.tracks.find((t) => t.name === 'gn-A' && t.type === 'Instrument');
if (source === undefined) {
  console.log('REFUSING: fixture track gn-A not found; run probe:e02f first.');
  process.exit(1);
}
const sourceId = source.channelId;
const sourceMixer = await mixer(source.index);
note(`source: [${source.index}] "${source.name}" pos=${source.position} ${sourceId}`);
note(`source mixer: vol=${sourceMixer.volume.toFixed(4)} (${sourceMixer.volumeDisplayed}) `
  + `pan=${sourceMixer.pan.toFixed(4)} color=${sourceMixer.color} sends=${sourceMixer.sends.length}`);

// A source worth duplicating: give it mixer state that is NOT the default, so
// "the copy matches" cannot be satisfied by a fresh track's defaults (this is
// the same confound standing rule 3a is about — a reading that would look right
// either way proves nothing).
await client.request('branch.setMixer', {
  trackIndex: source.index, volume: 0.62, pan: 0.35, color: [0.9, 0.2, 0.4],
});
if (sourceMixer.sends.length > 0) {
  await client.request('branch.setMixer', { trackIndex: source.index, sendIndex: 0, sendValue: 0.42 });
}
await pollUntil(async () => Math.abs((await mixer(source.index)).volume - 0.62) < 0.005);
const marked = await mixer(source.index);
note(`source marked: vol=${marked.volume.toFixed(4)} pan=${marked.pan.toFixed(4)} `
  + `color=${marked.color} send0=${marked.sends[0]?.value.toFixed(4) ?? 'n/a'}`);
check('the fixture carries non-default mixer state to copy',
  Math.abs(marked.volume - 0.62) < 0.005 && Math.abs(marked.pan - 0.35) < 0.005);

const scenesBefore = ((await client.request('scene.count')) as { sceneCount: number }).sceneCount;
const clipsBefore = [await slotHasContent(source.index, 0), await slotHasContent(source.index, 1)];
note(`source clips: slot0=${clipsBefore[0]} slot1=${clipsBefore[1]}, scenes=${scenesBefore}`);

// ---- 1. row A: the three routes ----
// `copyTracksAfter` is the fourth route, found by walking InsertionPoint rather
// than the duplicate-shaped names — the only one that says WHERE the copy lands,
// which is what any branch topology (groups, ordering, clutter) would need.
const routes = ['channelDuplicate', 'duplicateObject', 'hostDuplicate', 'copyTracksAfter'] as const;
const made: { route: string; row: TrackRow; ms: number }[] = [];

for (const route of routes) {
  console.log(`\n-- route ${route}`);
  const before = await list();
  const beforeIds = new Set(before.tracks.map((t) => t.channelId));
  const sourceIndex = (await resolve(sourceId)).index!;

  const t0 = Date.now();
  const res = (await client.request('branch.duplicateTrack', {
    trackIndex: sourceIndex, route, undoName: `ghostnote E16 branch (${route})`,
  })) as { success: boolean; route: string; sourceChannelId: string };
  const appeared = await pollUntil(async () => (await list()).count === before.count + 1, 8000, 50);
  const ms = Date.now() - t0;

  check(`${route}: a new track appeared`, appeared.ok, { ms, requestAck: res.success });
  if (!appeared.ok) {
    note(`${route} made NO track in 8s — this route is a silent no-op (the E4c shape)`);
    continue;
  }
  const after = await list();
  const row = after.tracks.find((t) => !beforeIds.has(t.channelId))!;
  made.push({ route, row, ms });
  note(`${route}: [${row.index}] "${row.name}" pos=${row.position} type=${row.type} id=${row.channelId} (${ms}ms)`);
}

check('ROW A GATE — at least one route duplicates a top-level track', made.length > 0,
  { routesThatWorked: made.map((m) => m.route) });
if (made.length === 0) {
  console.log('\n⚠ KILL CRITERION 1 FIRED: no route duplicates a track. E16 is dead.');
  process.exit(1);
}

// ---- 2. row A4: identity and landing ----
console.log('\n-- A4: identity and where it lands');
for (const { route, row } of made) {
  check(`${route}: the copy has a FRESH channelId`, row.channelId !== sourceId,
    { source: sourceId, copy: row.channelId });
}
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
check('every copy has a UUID-shaped channelId', made.every((m) => uuidRe.test(m.row.channelId)));
check('all copies are distinct from each other',
  new Set(made.map((m) => m.row.channelId)).size === made.length);

const sourceNow = await resolve(sourceId);
for (const { route, row } of made) {
  note(`${route}: copy pos=${row.position}, source pos=${sourceNow.position} (delta ${row.position - sourceNow.position!})`);
}
check('the copy lands ADJACENT to its source (position + 1), not at the end',
  made.every((m) => Math.abs(m.row.position - sourceNow.position!) <= made.length),
  { sourcePos: sourceNow.position, copyPositions: made.map((m) => m.row.position) });
note(`copy names: ${made.map((m) => `"${m.row.name}"`).join(', ')}`);
check('the copy is the same track TYPE as its source',
  made.every((m) => m.row.type === source.type), made.map((m) => m.row.type));

// ---- 3. C1: latency baseline on an ordinary instrument track ----
console.log('\n-- C1: latency (ordinary instrument track, no big plugins)');
for (const { route, ms } of made) note(`${route}: ${ms}ms until the track was visible`);

// ---- 4. D1/D2: is the result addressable, and did anything go stale? ----
console.log('\n-- D1/D2: addressability and staleness');
for (const { route, row } of made) {
  const r = await resolve(row.channelId);
  check(`${route}: the copy resolves by its channelId`, r.found === true,
    { index: r.index, name: r.name });
}
const nowList = await list();
const survivors = start.tracks.filter((t) => nowList.tracks.some((n) => n.channelId === t.channelId));
check('D2: every pre-existing track still resolves by channelId (identity survived)',
  survivors.length === start.tracks.length,
  { before: start.tracks.length, stillThere: survivors.length });
const scenesAfter = ((await client.request('scene.count')) as { sceneCount: number }).sceneCount;
check('D2: duplication did NOT change the scene count (no scene-epoch bump)',
  scenesAfter === scenesBefore, { before: scenesBefore, after: scenesAfter });

// ---- 5. B4/B5 lite: did the copy carry clips and mixer state? ----
console.log('\n-- B4/B5 lite: content and mixer state on an ordinary track');
const probe = made[0]!;
const copyIndex = (await resolve(probe.row.channelId)).index!;
const copyClips = [await slotHasContent(copyIndex, 0), await slotHasContent(copyIndex, 1)];
check('B4: the copy carries its clips', copyClips[0] === clipsBefore[0] && copyClips[1] === clipsBefore[1],
  { source: clipsBefore, copy: copyClips });

const copyMixer = await mixer(copyIndex);
const srcMixer = await mixer((await resolve(sourceId)).index!);
note(`copy mixer:   vol=${copyMixer.volume.toFixed(4)} pan=${copyMixer.pan.toFixed(4)} `
  + `color=${copyMixer.color} send0=${copyMixer.sends[0]?.value.toFixed(4) ?? 'n/a'}`);
check('B5: volume carried', Math.abs(copyMixer.volume - srcMixer.volume) < 0.005,
  { source: srcMixer.volume, copy: copyMixer.volume });
check('B5: pan carried', Math.abs(copyMixer.pan - srcMixer.pan) < 0.005,
  { source: srcMixer.pan, copy: copyMixer.pan });
check('B5: colour carried', copyMixer.color === srcMixer.color,
  { source: srcMixer.color, copy: copyMixer.color });
check('B5: send bank is visible on the copy', copyMixer.sends.length === srcMixer.sends.length,
  { source: srcMixer.sends.length, copy: copyMixer.sends.length });
if (srcMixer.sends.length > 0) {
  check('B5: send 0 value carried',
    Math.abs((copyMixer.sends[0]?.value ?? -1) - (srcMixer.sends[0]?.value ?? -2)) < 0.005,
    { source: srcMixer.sends[0]?.value, copy: copyMixer.sends[0]?.value });
  check('B5: send pre/post-fader mode carried',
    copyMixer.sends[0]?.preFader === srcMixer.sends[0]?.preFader,
    { source: srcMixer.sends[0]?.preFader, copy: copyMixer.sends[0]?.preFader });
}
check('B5: the copy is NOT muted (it is audible the moment it exists — row E5)',
  copyMixer.mute === false, { mute: copyMixer.mute });

// ---- 6. F1/G1: undo granularity, then delete-as-revert ----
console.log('\n-- F1: is a duplicate ONE undo step?');
const beforeUndo = await list();
const undone = (await client.request('app.undo', { times: 1 })) as { undosPerformed: number };
const gone = await pollUntil(async () => (await list()).count === beforeUndo.count - 1, 4000, 50);
check('F1: ONE undo removes a whole duplicated track', gone.ok && undone.undosPerformed === 1,
  { undosPerformed: undone.undosPerformed, ms: gone.ms });
const afterUndo = await list();
const undoneIds = made.filter((m) => !afterUndo.tracks.some((t) => t.channelId === m.row.channelId));
note(`undo removed: ${undoneIds.map((m) => m.route).join(', ') || '(nothing we made)'}`);
check('F1: undo removed exactly one of OUR duplicates, not something else',
  undoneIds.length === 1, { removed: undoneIds.map((m) => m.route) });

console.log('\n-- G1: delete-as-revert (the whole revert story)');
const remaining = made.filter((m) => afterUndo.tracks.some((t) => t.channelId === m.row.channelId));
for (const { route, row } of remaining) {
  const before = await list();
  const at = await resolve(row.channelId);
  const t0 = Date.now();
  await client.request('track.delete', { trackIndex: at.index });
  const removed = await pollUntil(async () => (await list()).count === before.count - 1, 6000, 50);
  const after = await resolve(row.channelId);
  check(`G1: deleting the ${route} copy removes it and its identity tombstones`,
    removed.ok && after.found === false, { ms: Date.now() - t0, stillResolves: after.found });
}

// ---- 7. the source has to be untouched, which is the entire premise ----
console.log('\n-- the premise: the original was never edited');
const finalSource = await resolve(sourceId);
check('the source track survived all of it, same channelId', finalSource.found === true,
  { index: finalSource.index, name: finalSource.name });
const finalMixer = await mixer(finalSource.index!);
check('the source mixer state is unchanged',
  Math.abs(finalMixer.volume - marked.volume) < 0.005 && finalMixer.color === marked.color,
  { volume: finalMixer.volume, color: finalMixer.color });
const finalList = await list();
check('the bank is back to the track count we started with',
  finalList.count === start.count, { start: start.count, end: finalList.count });

console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} FAILURES`);
process.exit(failureCount() === 0 ? 0 : 1);
