/**
 * E16 rows E3/E4 — groups, and whether we get to say WHERE a branch lands.
 *
 * Two questions the plan treats as one:
 *
 *   E3  can a group be created, is a group track duplicable, can we duplicate
 *       INTO one — the proposed management topology for branch clutter (F2)
 *   E4  is there a topology giving the human a SINGLE control, drivable from
 *       the extension (explicitly not a named action — rule 6 / D13)
 *
 * ⚠ **Group creation: ○, and the grep is done.** Complete member-index sweep of
 * `InsertionPoint`, `Application`, `TrackBank`, `ControllerHost` and `Track`
 * across the v25 index (which carries `Since:` for every earlier version, so it
 * is the all-versions grep rule 10 asks for): track creation exists only as
 * `createInstrumentTrack` / `createAudioTrack` / `createEffectTrack`. There is
 * no group variant anywhere.
 *
 * ⚠ `Track.createParentTrack(int, int)` is NOT a group creator, despite the
 * name — "Creates an object that represent[s] the parent track", i.e. it
 * allocates a read proxy for a parent that already exists, the same way
 * `createCursorTrack` does. Recorded because the name alone would have been
 * read as a capability, which is trap 4 (`copyTracks`) in a friendlier costume.
 *
 * So a group can only come from the human. Part 2 below refuses rather than
 * guesses if there is no group in the project.
 *
 * **Part 1 needs nobody and is the more valuable half.** Row A concluded
 * "placement is not ours to choose" from `InsertionPoint.copyTracks` being a
 * silent no-op. `InsertionPoint.moveTracks` is its never-probed sibling: if it
 * works, "duplicate, then move" restores the placement control row A gave up
 * on, and that is what would put a branch inside a group without any API for
 * making one.
 *
 * Requires `gn-E16` (build it with probe:e16b). Deletes every branch it makes.
 */
import { client, check, note, failureCount, pollUntil } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

type TrackRow = { index: number; name: string; position: number; type: string; channelId: string };
type Mixer = { name: string; channelId: string; position: number; isGroup: boolean;
  isGroupExpanded: boolean; mute: boolean; type: string };

const list = async () => (await req('track.list')) as { tracks: TrackRow[]; count: number };
const indexOf = async (channelId: string): Promise<number> => {
  const r = (await req('track.resolveByChannelId', { channelId })) as { found: boolean; index?: number };
  if (!r.found || r.index === undefined) throw new Error(`track ${channelId} no longer resolves`);
  return r.index;
};
const mixerOf = async (channelId: string) =>
  (await req('branch.mixer', { trackIndex: await indexOf(channelId) })) as Mixer;
const layout = async (tag: string) => {
  const l = await list();
  note(`${tag}: ${l.tracks.map((t) => `${t.position}:${t.name}${t.type === 'Group' ? '*' : ''}`).join('  ')}`);
  return l;
};

await client.connect();
console.log('connected\n');

const all = await list();
const fixture = all.tracks.find((t) => t.name === 'gn-E16');
if (!fixture) {
  console.log('REFUSING: gn-E16 not found — run `npm run probe:e16b` first to build it.');
  process.exit(1);
}
const SRC = fixture.channelId;

const makeBranch = async (undoName: string): Promise<string> => {
  const pre = await list();
  const preIds = new Set(pre.tracks.map((t) => t.channelId));
  await req('branch.duplicateTrack', { trackIndex: await indexOf(SRC), route: 'hostDuplicate', undoName });
  const ok = await pollUntil(async () => (await list()).count === pre.count + 1, 20000, 50);
  if (!ok.ok) throw new Error('branch never appeared');
  return (await list()).tracks.find((t) => !preIds.has(t.channelId))!.channelId;
};
/**
 * ⚠ Tolerates a track that is ALREADY gone, because deleting a group deletes
 * its children with it — measured, by this probe crashing on exactly that.
 * The cleanup loop deleted a duplicated group, then tried to delete the child
 * it had counted separately, and `indexOf` threw on a track the group had taken
 * with it. The cascade is a finding (it is what makes revert-by-delete work on
 * a whole group); the crash was just a naive loop.
 */
const deleteBranch = async (id: string): Promise<'deleted' | 'already-gone'> => {
  const at = (await req('track.resolveByChannelId', { channelId: id })) as
    { found: boolean; index?: number };
  if (!at.found || at.index === undefined) return 'already-gone';
  await req('track.delete', { trackIndex: at.index });
  await pollUntil(async () =>
    !((await req('track.resolveByChannelId', { channelId: id })) as { found: boolean }).found,
    8000, 100);
  return 'deleted';
};

/**
 * Is `childId` actually INSIDE `groupId`?
 *
 * ⚠ Position cannot answer this and the first version of this probe pretended
 * otherwise ("landed after the group, so presumably inside"). Collapsing the
 * group is a real oracle: a collapsed group's children leave the flat bank
 * entirely — `track.list` count drops, and `resolveByChannelId` returns
 * `found:false`. So "does collapsing this group make that track disappear" is
 * exactly the question "is that track a child of this group", asked in a way
 * the API actually answers.
 */
const isChildOf = async (childId: string, groupId: string): Promise<boolean> => {
  const gi = await indexOf(groupId);
  const wasExpanded = (await mixerOf(groupId)).isGroupExpanded;
  await req('branch.setMixer', { trackIndex: gi, groupExpanded: false });
  await wait(1200);
  const hiddenWhileCollapsed =
    !((await req('track.resolveByChannelId', { channelId: childId })) as { found: boolean }).found;
  await req('branch.setMixer', { trackIndex: await indexOf(groupId), groupExpanded: wasExpanded });
  await wait(1200);
  return hiddenWhileCollapsed;
};

// ==========================================================================
// Part 1 — is placement ours after all? `InsertionPoint.moveTracks`
// ==========================================================================
console.log('-- E3/A-revisited: can a branch be MOVED once it exists?');
await layout('before');
const branch = await makeBranch('ghostnote E16 E3 branch');
const born = await mixerOf(branch);
note(`branch born at position ${born.position} (source is at ${(await mixerOf(SRC)).position})`);
await layout('after duplicate');

// Move it to the very front — a position adjacency could never produce, so a
// pass here cannot be duplication's own "lands next to its source" behaviour.
const first = (await list()).tracks[0]!;
check('the move target is a DIFFERENT position than the branch already holds',
  first.channelId !== branch && born.position !== 0, { branchPosition: born.position });

await req('branch.moveTrack', {
  trackIndex: await indexOf(branch),
  anchorTrackIndex: await indexOf(first.channelId),
  where: 'before',
});
const moved = await pollUntil(async () => (await mixerOf(branch)).position === 0, 5000, 100);
const afterMove = await mixerOf(branch);
await layout('after moveTracks');

check('E3: `InsertionPoint.moveTracks` actually MOVES a track '
  + '(row A gave up on placement after copyTracks alone — this is its sibling)',
  moved.ok && afterMove.position === 0,
  { wanted: 0, got: afterMove.position, ms: moved.ms,
    ifFailed: 'then moveTracks is a silent no-op too, and row A\'s conclusion stands on two routes' });

// ⚠ These two only mean anything if the move HAPPENED. Gated, because a no-op
// preserves identity perfectly and would hand back two greens for a track that
// never went anywhere — the same "two silences make a green" shape as row B1's
// empty-list comparison. When the move fails they are reported as unmeasurable.
if (moved.ok && afterMove.position === 0) {
  // A "move" that is really a delete-and-recreate would mint a fresh channelId
  // and stale every address we hold (D1/D6). The identity is the point, not the row.
  check('E3: a moved track keeps its channelId, so held addresses survive the move',
    afterMove.channelId === branch, { before: branch, after: afterMove.channelId });
  check('E3: a moved track keeps its name and is still the branch we made',
    afterMove.name === born.name, { before: born.name, after: afterMove.name });
} else {
  note('identity-across-move: NOT MEASURED — nothing moved, so "identity survived" '
    + 'would be a green earned by a no-op');
}

await deleteBranch(branch);
await layout('after cleanup');

// ==========================================================================
// Part 2 — groups, which only a human can bring into existence
// ==========================================================================
console.log('\n-- E3/E4: groups');
const groups = (await list()).tracks.filter((t) => t.type === 'Group');
if (groups.length === 0) {
  console.log('');
  console.log('  No group track in this project, and no API creates one (see the header).');
  console.log('  To measure the rest of E3/E4, make one by hand in Bitwig:');
  console.log('    select one or more tracks in the mixer -> right-click -> Group Tracks (or Cmd-G)');
  console.log('  then re-run this probe. Everything above already ran and is recorded.');
  console.log('');
  note('E3 group half: NOT MEASURED (no fixture) — deliberately not recorded as ○');
  console.log(failureCount() === 0 ? '\nALL PASS (part 1 only)' : `\n${failureCount()} FAILURES`);
  process.exit(failureCount() === 0 ? 0 : 1);
}

const group = groups[0]!;
note(`group fixture: "${group.name}" at position ${group.position}`);
const gm = await mixerOf(group.channelId);
check('a group track reports isGroup', gm.isGroup, { mixer: gm });

/**
 * ⚠ **E4/F2's clutter control is a TRAP, and this is the sharpest finding of
 * the row.** Collapsing a group does not merely hide its children from the
 * human — it removes them from the FLAT TRACK BANK altogether:
 *
 *   - `track.list` count and **`itemCount` both drop**
 *   - `track.resolveByChannelId` returns `found:false` — byte-for-byte the same
 *     answer a DELETED track gives (E2f tombstone semantics)
 *   - the child vanishes from `branch.vu` entirely
 *   - ...while the master meter shows it is STILL PLAYING, and the group's own
 *     meter carries its signal
 *
 * So a collapsed branch is **audible but unaddressable**, and indistinguishable
 * from a deleted one through every read path we have. Three consequences the
 * design has to answer, none of them local to E16:
 *
 *   1. **D1/E2f**: `found:false` no longer means "deleted". Tombstone detection
 *      is ambiguous unless the daemon also tracks every group's expanded state.
 *   2. **Standing rule 5 / E15-A**: `itemCount()` was load-bearing precisely
 *      because it "reports the PROJECT total". Collapsing a group reduces it,
 *      so the bank-window blind-spot check has a blind spot of its own.
 *   3. **F3**: a human collapsing a group is indistinguishable from a human
 *      deleting the branches inside it.
 *
 * Recoverable — expanding restores every child with its channelId intact — but
 * not DETECTABLE, which is the part that matters. Collapsing is a completely
 * ordinary thing for a human to do to their own mixer.
 */
console.log('\n-- E4/F2: what collapsing a group does to our view of it');
const gExpandedIdx = await indexOf(group.channelId);
const wasExpanded = (await mixerOf(group.channelId)).isGroupExpanded;
const kids = (await list()).tracks.filter((t) => t.channelId !== group.channelId);
const beforeCollapse = await list();

await req('branch.setMixer', { trackIndex: gExpandedIdx, groupExpanded: false });
await wait(1500);
const collapsed = await list();
const collapsedState = (await mixerOf(group.channelId)).isGroupExpanded;
check('E4/F2: `isGroupExpanded` is drivable', collapsedState === false,
  { was: wasExpanded, got: collapsedState });

const vanished = beforeCollapse.tracks.filter(
  (t) => !collapsed.tracks.some((c) => c.channelId === t.channelId));
note(`collapsing hid ${vanished.length} track(s): ${vanished.map((t) => t.name).join(', ') || 'none'}`);
note(`track count ${beforeCollapse.count} -> ${collapsed.count}`);

if (vanished.length > 0) {
  const ghost = vanished[0]!;
  const resolves = (await req('track.resolveByChannelId', { channelId: ghost.channelId })) as
    { found: boolean };
  check('⚠ E4/F2 HAZARD: a collapsed group\'s child is UNADDRESSABLE — it resolves '
    + 'exactly like a deleted track, so a tombstone no longer means "deleted"',
    resolves.found, { channelId: ghost.channelId, found: resolves.found,
      consequence: 'D1/E2f tombstones ambiguous; standing rule 5 itemCount() undercounts; '
        + 'F3 cannot tell a collapse from a deletion' });
} else {
  note('collapsing hid nothing — the hazard above does NOT reproduce here');
}

await req('branch.setMixer', { trackIndex: await indexOf(group.channelId), groupExpanded: wasExpanded });
await wait(1500);
const restored = await list();
check('collapsing is reversible: every hidden child comes back on expand',
  restored.count === beforeCollapse.count, { before: beforeCollapse.count, after: restored.count });

// ---- E3: is a group track itself duplicable, and does it carry its children? ----
console.log('\n-- E3: duplicating a whole group');
const pre = await list();
const preIds = new Set(pre.tracks.map((t) => t.channelId));
await req('branch.duplicateTrack', {
  trackIndex: await indexOf(group.channelId), route: 'hostDuplicate', undoName: 'ghostnote E16 group dup',
});
const grew = await pollUntil(async () => (await list()).count > pre.count, 20000, 50);
const added = (await list()).tracks.filter((t) => !preIds.has(t.channelId));
await layout('after duplicating the GROUP');
check('E3: a group track is duplicable', grew.ok && added.length > 0, { added: added.length });
check('E3: duplicating a group carries its child tracks, not just the group header',
  added.length > 1, {
    tracksAdded: added.length, names: added.map((t) => t.name),
    meaning: 'if 1, the copy is an empty group and the branch topology cannot be duplicated wholesale',
  });

// ⚠ "Can we duplicate INTO a group" — moveTracks is a no-op (part 1), so the
// only way a branch lands inside one is if duplicating a track that is ALREADY
// inside produces a copy inside too. Asked with the collapse oracle, not position.
const copiedGroup = added.find((t) => t.type === 'Group');
const insideSource = pre.tracks.find((t) => t.type !== 'Group' && t.channelId !== SRC
  && kids.some((k) => k.channelId === t.channelId));
if (copiedGroup) {
  const copiedKid = added.find((t) => t.channelId !== copiedGroup.channelId);
  if (copiedKid) {
    const nested = await isChildOf(copiedKid.channelId, copiedGroup.channelId);
    check('E3: the duplicated group\'s child really is INSIDE the copy '
      + '(proved by collapse, not by position)',
      nested, { group: copiedGroup.name, child: copiedKid.name });
  }
}

// ⚠ Deleting the group cascades to its children — delete the GROUP first and
// let the rest report already-gone, which is itself the measurement.
const outcomes: Record<string, string> = {};
if (copiedGroup) outcomes[copiedGroup.name] = await deleteBranch(copiedGroup.channelId);
for (const t of added.filter((x) => x.channelId !== copiedGroup?.channelId)) {
  outcomes[t.name] = await deleteBranch(t.channelId);
}
note(`delete outcomes: ${JSON.stringify(outcomes)}`);
check('E3/G: deleting a duplicated GROUP takes its children with it — '
  + 'revert-by-delete works on a whole group in one act',
  Object.values(outcomes).filter((v) => v === 'already-gone').length > 0
    || Object.keys(outcomes).length === 1,
  { outcomes, meaning: '"already-gone" for a child means the group delete cascaded to it' });

// ---- E3: does duplicating a track that is INSIDE a group stay inside? ----
if (insideSource) {
  console.log('\n-- E3: does a branch of an in-group track land inside the group?');
  const b2 = await makeBranch('ghostnote E16 in-group branch');
  const nested = await isChildOf(b2, group.channelId);
  check('E3: duplicating a track inside a group produces a copy INSIDE that group '
    + '(the only route left, since moveTracks is a no-op)',
    nested, { branch: b2, group: group.name,
      why: 'proved by collapsing the group and watching the branch leave the bank' });
  await deleteBranch(b2);
}

await layout('final');
check('gn-E16 survived', ((await req('track.resolveByChannelId', { channelId: SRC })) as
  { found: boolean }).found);
console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} FAILURES`);
process.exit(failureCount() === 0 ? 0 : 1);
