/**
 * E16k — is a GROUP a usable branch container? The collapse primitive, measured.
 *
 * E16j unblocked group creation (named actions fire backgrounded; `Create Group
 * Track` and `Group` both work). That turns a design the spike had written off —
 * ⚠ **the project itself as the branch tree**, with groups as lineage containers
 * and no external history — back into something worth costing. But the model
 * rests on four mechanics nobody has probed, and the load-bearing one is a
 * sentence the user wrote as though it were obvious:
 *
 *   > "Collapsing to a certain take would often be as simple as delete all but
 *   >  one in a group and ungroup."
 *
 * `Ungroup` has never been invoked. Whether it survives its own children, and
 * whether **`channelId` survives grouping and ungrouping**, decide whether a
 * group can hold a branch lineage at all — because `channelId` is the only
 * durable key we have (E2f/D6), and an operation that mints a new one silently
 * orphans every reference we hold.
 *
 * ## Rows
 *
 *   K1  `Group` a plain track            → does the child keep its channelId?
 *   K2  duplicate a child inside a group → does the copy land INSIDE? (E3 said
 *                                          yes for a human-made group; this is
 *                                          the same claim for one WE made)
 *   K3  ⚠ the collapse primitive         → delete all but one, then `Ungroup`.
 *                                          Does the survivor come back to top
 *                                          level with its identity intact?
 *   K4  `Group` a track already in a group → does it NEST, or wrap at top level?
 *                                          (tree DEPTH, vs a flat sibling set)
 *
 * ## What this deliberately does NOT measure
 *
 * ⚠ **Group mute.** "Mute the group to A/B a whole lineage" is the ergonomic
 * claim the model leans on hardest, and it cannot be answered here: trap 7 says
 * `addVuMeterObserver` is PRE-mute, so the only honest oracle is the master bus
 * with the transport ROLLING — which is noise, and the posture is to ask before
 * making any. Left as an owed audible row.
 *
 * Everything below is silent: structural ops with the transport stopped. The
 * probe REFUSES to run if the transport is rolling.
 *
 * Verified by `track.list` diff and the collapse oracle throughout — never by
 * `invoke()`'s return (E6 blocker 4, re-confirmed in E16j).
 */
import { client, check, note, failureCount, pollUntil, trackedRequest } from './lib.js';

const req = trackedRequest();
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

type TrackRow = { index: number; name: string; position: number; type: string; channelId: string };
type Listing = { tracks: TrackRow[]; count: number; itemCount: number; bankSize: number };

const list = async () => (await req('track.list')) as Listing;
const invoke = async (id: string) => (await req('app.invokeAction', { id })) as { resolved: boolean };
const resolve = async (channelId: string) =>
  (await req('track.resolveByChannelId', { channelId })) as
    { found: boolean; index?: number; name?: string; type?: string; position?: number };
const ids = (l: Listing) => new Set(l.tracks.map((t) => t.channelId));
const layout = (l: Listing) =>
  l.tracks.map((t) => `${t.position}:${t.name}${t.type === 'Group' ? '*' : ''}`).join('  ');

await client.connect();
console.log('connected\n');

// ═══════════════════════════════════════════════ preflight
console.log('-- 0. preflight');
const playing = ((await req('transport.status')) as { isPlaying: boolean }).isPlaying;
if (playing) {
  console.log('REFUSING: the transport is rolling. Every row here is a structural op and '
    + 'C5 says duplication GLITCHES audio — that is noise, and noise gets asked for first. '
    + 'Stop the transport and re-run.');
  process.exit(1);
}
const boot = await list();
note(`bank: count=${boot.count} itemCount=${boot.itemCount} bankSize=${boot.bankSize}`);
if (boot.itemCount !== boot.count) {
  console.log('REFUSING: bank window does not show the whole project; every diff below would lie.');
  process.exit(1);
}
if (boot.bankSize - boot.count < 5) {
  console.log(`REFUSING: only ${boot.bankSize - boot.count} free bank slots; this probe needs 5.`);
  process.exit(1);
}

/** Every group open, so `found:false` can only mean DELETED (trap 12). */
async function expandAllGroups(): Promise<void> {
  for (const g of (await list()).tracks.filter((t) => t.type === 'Group')) {
    const r = await resolve(g.channelId);
    if (r.found) await req('branch.setMixer', { trackIndex: r.index, groupExpanded: true });
  }
  await wait(600);
}
await expandAllGroups();

const baseline = await list();
const protectedIds = new Set(ids(baseline));
const disposable = new Set<string>();
note(`baseline: ${layout(baseline)}`);

async function makeTrack(name: string): Promise<string> {
  const before = await list();
  await req('track.create', { position: before.count });
  if (!(await pollUntil(async () => (await list()).count === before.count + 1, 6000, 150)).ok) {
    throw new Error(`creating ${name} did not settle`);
  }
  const fresh = (await list()).tracks.find((t) => !ids(before).has(t.channelId));
  if (!fresh) throw new Error(`created ${name} but could not identify it`);
  await req('track.setName', { trackIndex: fresh.index, name });
  await pollUntil(async () =>
    (await list()).tracks.some((t) => t.channelId === fresh.channelId && t.name === name), 4000, 150);
  // A clip, purely so `cursor.status.trackName` can confirm a selection — on a
  // clip-less track that field reads "" forever (E16j). Never launched.
  const at = await resolve(fresh.channelId);
  if (at.found) await req('clip.create', { trackIndex: at.index, slotIndex: 0, lengthBeats: 4 });
  disposable.add(fresh.channelId);
  return fresh.channelId;
}

/** Park the UI selection, and prove it landed — actions fire against it (E6 blocker 3). */
async function select(channelId: string): Promise<boolean> {
  const r = await resolve(channelId);
  if (!r.found) return false;
  await req('cursor.pinTrack', { cursor: 0, pinned: false });
  await req('cursor.pointTrack', { cursor: '0', trackIndex: r.index });
  await wait(700);
  const s = (await req('cursor.status', { cursor: '0' })) as
    { cursorTrackPosition?: number; trackName?: string };
  // ⚠ Groups have no clips, so `trackName` cannot confirm one. Position is the
  // only available signal and it is a DIFFERENT coordinate system from the flat
  // bank's (E16k/E16j), so this reports rather than asserts.
  note(`    selection → cursorTrackPosition=${s.cursorTrackPosition} trackName="${s.trackName}"`);
  return true;
}

/** Which channelIds leave the bank when this group folds — i.e. its children. */
async function childrenOf(channelId: string): Promise<string[]> {
  const open = await resolve(channelId);
  if (!open.found) return [];
  const before = ids(await list());
  await req('branch.setMixer', { trackIndex: open.index, groupExpanded: false });
  await wait(1500);
  const folded = ids(await list());
  const shut = await resolve(channelId);
  if (shut.found) await req('branch.setMixer', { trackIndex: shut.index, groupExpanded: true });
  await wait(1500);
  return [...before].filter((c) => c !== channelId && !folded.has(c));
}

async function deleteById(channelId: string): Promise<boolean> {
  const r = await resolve(channelId);
  if (!r.found) return true;
  await req('track.delete', { trackIndex: r.index });
  return (await pollUntil(async () => !(await resolve(channelId)).found, 6000, 150)).ok;
}

/** Anything that appeared and is not baseline is ours to remove. */
async function newSince(before: Listing): Promise<TrackRow[]> {
  await expandAllGroups();
  const after = await list();
  const fresh = after.tracks.filter((t) => !ids(before).has(t.channelId));
  for (const t of fresh) disposable.add(t.channelId);
  return fresh;
}

// ═══════════════════════════════════════════════ K1 — Group keeps identity
console.log('\n-- K1. `Group` a plain track: does the child keep its channelId?');
const k1 = await makeTrack('gn-K1');
note(`gn-K1 = ${k1}`);
const beforeK1 = await list();
await select(k1);
await invoke('Group');
await pollUntil(async () => (await list()).tracks.length !== beforeK1.tracks.length, 4000, 200);
const madeK1 = await newSince(beforeK1);
const groupK1 = madeK1.find((t) => t.type === 'Group');
note(`appeared: ${madeK1.map((t) => `${t.name}(${t.type})`).join(', ') || 'none'}`);
check('`Group` created a group track', groupK1 !== undefined, { appeared: madeK1.map((t) => t.name) });

const k1StillThere = await resolve(k1);
check('⚠ the wrapped child KEEPS its channelId — grouping does not mint a new identity, '
  + 'so every reference we hold survives it (E2f/D6: channelId is the only durable key)',
  k1StillThere.found, { channelId: k1, resolved: k1StillThere });

if (groupK1) {
  const kids = await childrenOf(groupK1.channelId);
  check('...and the group really WRAPS it (collapse oracle, not position)',
    kids.includes(k1), { children: kids, wanted: k1 });
  note(`group "${groupK1.name}" = ${groupK1.channelId}`);
}

// ═══════════════════════════════════════════════ K2 — a branch lands inside
console.log('\n-- K2. duplicate the child: does the copy land INSIDE the group we made?');
let sibling: string | undefined;
if (groupK1) {
  const beforeK2 = await list();
  const at = await resolve(k1);
  await req('branch.duplicateTrack', { trackIndex: at.index, route: 'channelDuplicate' });
  await pollUntil(async () => (await list()).tracks.length !== beforeK2.tracks.length, 6000, 200);
  const madeK2 = await newSince(beforeK2);
  sibling = madeK2[0]?.channelId;
  note(`appeared: ${madeK2.map((t) => `${t.name}(${t.type})`).join(', ') || 'none'}`);
  const kids = await childrenOf(groupK1.channelId);
  check('⚠ the copy lands INSIDE the group — this is the whole construction: there is no '
    + 'way to MOVE a track into a group (`moveTracks` is a silent no-op), so "group the '
    + 'original first, then duplicate" is the only known route to a populated lineage',
    sibling !== undefined && kids.includes(sibling),
    { children: kids, copy: sibling, siblingCount: kids.length });
  note(`group now holds ${kids.length} track(s)`);
}

// ═══════════════════════════════════════════════ K3 — ⚠ the collapse primitive
console.log('\n-- K3. ⚠ THE COLLAPSE PRIMITIVE: delete all but one, then `Ungroup`');
if (groupK1 && sibling) {
  // "delete all but one" — keep the COPY, drop the original, so the survivor is
  // demonstrably a branch rather than the thing we started with.
  await deleteById(k1);
  const kidsLeft = await childrenOf(groupK1.channelId);
  check('after deleting all but one, the group holds exactly one track',
    kidsLeft.length === 1 && kidsLeft[0] === sibling, { children: kidsLeft, survivor: sibling });

  const beforeUngroup = await list();
  await select(groupK1.channelId);
  await invoke('Ungroup');
  const gone = await pollUntil(async () => !(await resolve(groupK1.channelId)).found, 5000, 200);
  await expandAllGroups();
  const afterUngroup = await list();
  note(`before: ${layout(beforeUngroup)}`);
  note(`after:  ${layout(afterUngroup)}`);

  check('⚠ `Ungroup` DISSOLVES the group track', gone.ok,
    { ms: gone.ms, note: 'if this fails, "delete all but one and ungroup" is not the collapse '
      + 'primitive and a lineage container can never be removed once made' });

  const survivor = await resolve(sibling);
  check('⚠ ...and the survivor comes back with its channelId INTACT — so collapsing a '
    + 'lineage does not orphan the references we hold to the winner',
    survivor.found, { channelId: sibling, resolved: survivor });
  if (survivor.found) {
    note(`survivor "${survivor.name}" is now type=${survivor.type} at position ${survivor.position}`);
    check('the survivor is a normal track again, not still a group child',
      survivor.type !== 'Group', { type: survivor.type });
  }
} else {
  check('K3 could not run — K1/K2 did not produce a group with a sibling', false);
}

// ═══════════════════════════════════════════════ K4 — does it NEST?
console.log('\n-- K4. `Group` a track that is already inside a group: nest, or wrap at top level?');
const k2 = await makeTrack('gn-K2');
const beforeOuter = await list();
await select(k2);
await invoke('Group');
await pollUntil(async () => (await list()).tracks.length !== beforeOuter.tracks.length, 4000, 200);
const outer = (await newSince(beforeOuter)).find((t) => t.type === 'Group');

if (outer) {
  const beforeInner = await list();
  await select(k2);
  await invoke('Group');
  await pollUntil(async () => (await list()).tracks.length !== beforeInner.tracks.length, 4000, 200);
  const inner = (await newSince(beforeInner)).find((t) => t.type === 'Group');
  note(`outer = ${outer.name}, inner = ${inner?.name ?? 'none'}`);

  if (inner) {
    const outerKids = await childrenOf(outer.channelId);
    const innerKids = await childrenOf(inner.channelId);
    note(`outer wraps [${outerKids.length}]: ${outerKids.join(', ')}`);
    note(`inner wraps [${innerKids.length}]: ${innerKids.join(', ')}`);
    check('⚠ groups NEST — the second `Group` went inside the first, so a branch tree can '
      + 'have real DEPTH rather than one flat sibling set per lineage',
      innerKids.includes(k2) && outerKids.includes(inner.channelId),
      { outerKids, innerKids, subject: k2,
        ifFailed: 'the second group wrapped at TOP level instead, so lineages are flat and '
          + '"a branch of a branch" has no structural home' });
  } else {
    check('a second `Group` produced no group at all', false, { note: 'nesting unavailable' });
  }
}

// ═══════════════════════════════════════════════ cleanup
console.log('\n-- cleanup');
await expandAllGroups();
// Groups first — the cascade takes their children (E3) — then any stragglers.
for (let pass = 0; pass < 4; pass++) {
  await expandAllGroups();
  const strays = (await list()).tracks.filter((t) => !protectedIds.has(t.channelId));
  if (strays.length === 0) break;
  for (const t of strays.filter((s) => s.type === 'Group')) await deleteById(t.channelId);
  for (const t of strays.filter((s) => s.type !== 'Group')) await deleteById(t.channelId);
}
await expandAllGroups();
const final = await list();
const leftover = final.tracks.filter((t) => !protectedIds.has(t.channelId));
check('the project is back to baseline — nothing this probe made survives it',
  leftover.length === 0 && [...protectedIds].every((c) => ids(final).has(c)),
  { leftover: leftover.map((t) => t.name), missing: [...protectedIds].filter((c) => !ids(final).has(c)) });
note(`final: ${layout(final)}`);

console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} FAILURES`);
client.disconnect();
process.exit(failureCount() === 0 ? 0 : 1);
