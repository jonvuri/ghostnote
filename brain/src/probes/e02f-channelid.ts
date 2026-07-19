/**
 * E2f — Stable track identity via channelId() (channel UUID, API 20+).
 * Revisits the E2c "no stable track addressing" claim: is channelId a
 * stable, serializable identifier that survives index shifts and renames,
 * and can it re-resolve a track regardless of current position/name?
 *
 * Creates + deletes one temp track; renames gn-A and restores its name.
 */
import { client, check, note, failureCount, pollUntil, ensureFixtureTracks } from './lib.js';

type TrackRow = { index: number; name: string; position: number; type: string; channelId: string };
const list = async () => (await client.request('track.list')) as { tracks: TrackRow[]; count: number };
const resolve = async (channelId: string) =>
  (await client.request('track.resolveByChannelId', { channelId })) as
    { found: boolean; index?: number; name?: string; position?: number };

await client.connect();
console.log('connected\n');
const { trackA, trackB } = await ensureFixtureTracks();

// ---- 1. channelId exists and is UUID-shaped ----
let l = await list();
note('tracks with channelIds:');
for (const t of l.tracks) note(`  [${t.index}] ${t.name}(${t.type}) channelId=${t.channelId}`);
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const allUuid = l.tracks.every((t) => uuidRe.test(t.channelId));
const allDistinct = new Set(l.tracks.map((t) => t.channelId)).size === l.tracks.length;
check('every track reports a UUID-shaped channelId', allUuid, l.tracks.map((t) => t.channelId));
check('channelIds are all distinct', allDistinct);

// capture gn-A / gn-B identities
const idA = l.tracks.find((t) => t.name === 'gn-A')!.channelId;
const idB = l.tracks.find((t) => t.name === 'gn-B')!.channelId;
note(`gn-A UUID=${idA}\n      gn-B UUID=${idB}`);

// ---- 2. stable across INDEX SHIFT (insert a track before them) ----
console.log('\n-- stability across structural index shift');
const before = await list();
const beforeIds = new Set(before.tracks.map((t) => t.channelId));
await client.request('track.create', { position: 0 });
await pollUntil(async () => (await list()).count === before.count + 1);
// identify the newcomer robustly: the ONE channelId not present before
// (this is exactly what the "last Instrument" positional heuristic got
//  wrong in the first run — channelId is the correct way).
let after = await list();
const newcomer = after.tracks.find((t) => !beforeIds.has(t.channelId))!;
const idTmp = newcomer.channelId;
note(`newcomer identified by UUID-diff: idx ${newcomer.index} "${newcomer.name}" ${idTmp}`);

const aAfter = after.tracks.find((t) => t.channelId === idA);
const bAfter = after.tracks.find((t) => t.channelId === idB);
check('gn-A still found by UUID after structural change', aAfter !== undefined);
check('gn-B still found by UUID after structural change', bAfter !== undefined);
check('UUID is INDEX-independent: gn-A/gn-B keep their name+identity despite index shift',
  aAfter?.name === 'gn-A' && bAfter?.name === 'gn-B',
  { gnA: `idx ${aAfter?.index} "${aAfter?.name}"`, gnB: `idx ${bAfter?.index} "${bAfter?.name}"` });

// ---- 3. re-resolution by UUID (the addressing primitive) ----
console.log('\n-- re-resolution by UUID via the extension');
const rA = await resolve(idA);
check('resolveByChannelId(gn-A UUID) finds it at its current index', rA.found && rA.name === 'gn-A',
  { index: rA.index, name: rA.name });

// ---- 4. stable across RENAME ----
console.log('\n-- stability across rename');
const gnAIdx = rA.index!;
await client.request('track.setName', { trackIndex: gnAIdx, name: 'renamed-A' });
await pollUntil(async () => (await list()).tracks.some((t) => t.index === gnAIdx && t.name === 'renamed-A'));
const rAfterRename = await resolve(idA);
check('UUID unchanged after rename (name mutated, identity did not)',
  rAfterRename.found && rAfterRename.index === gnAIdx && rAfterRename.name === 'renamed-A',
  rAfterRename);
const stillSameId = (await list()).tracks.find((t) => t.index === gnAIdx)?.channelId === idA;
check('channelId value itself is unchanged by rename', stillSameId);
await client.request('track.setName', { trackIndex: gnAIdx, name: 'gn-A' }); // restore

// ---- 5. deleted track's UUID resolves to not-found ----
console.log('\n-- deleted track no longer resolves');
// delete the newcomer BY UUID (resolve its current index first — the very
// pattern the addressing model will use)
const tmpResolved = await resolve(idTmp);
await client.request('track.delete', { trackIndex: tmpResolved.index });
await pollUntil(async () => !(await resolve(idTmp)).found);
const rTmp = await resolve(idTmp);
check('deleted track UUID resolves to found=false (clean tombstone)', rTmp.found === false, rTmp);

// gn-A / gn-B still resolve after all churn
check('gn-A + gn-B still resolve by UUID after all operations',
  (await resolve(idA)).found && (await resolve(idB)).found);

console.log(failureCount() === 0 ? '\nE2f: all checks passed' : `\nE2f: ${failureCount()} FAILURES`);
note('CROSS-SESSION persistence not tested here — reload the project and re-run to confirm the UUIDs above survive.');
client.disconnect();
process.exit(failureCount() === 0 ? 0 : 1);
