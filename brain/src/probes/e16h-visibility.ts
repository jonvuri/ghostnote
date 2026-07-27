/**
 * E16 — can the bank be made to SEE a collapsed group's children?
 *
 * ⚠ This probe exists because a finding was recorded too confidently.
 *
 * Rows D–G reported that collapsing a group removes its children from the flat
 * track bank — `itemCount` drops, `track.resolveByChannelId` returns
 * `found:false` exactly as a deleted track does, and the child goes on
 * sounding. That much is measured and reproduces. What was WRONG was the
 * framing: it was written up as an inherent property of the bank, when the API
 * has an explicit control for precisely this and nobody had looked.
 *
 * `TrackBankContentFilter`:
 *   TOP_LEVEL_CHANNELS    only the current level; skip group children entirely
 *   ALL_VISIBLE_CHANNELS  current level and nested, but skip tracks "not visible
 *                         in the mixer" — i.e. what the legacy 4-arg
 *                         `createTrackBank(tracks, sends, scenes, flat)` does,
 *                         and the reason the hazard exists
 *   ALL_CHANNELS          ⚠ "Include all tracks, EVEN THE ONES THAT ARE NOT
 *                         VISIBLE IN THE MIXER"
 *
 * Two separate unknowns, and the probe reports them separately because they
 * have different consequences:
 *
 *   1. Does `ALL_CHANNELS` actually restore folded children? If yes, the hazard
 *      is a configuration mistake of ours, not a property of Bitwig.
 *   2. Does `setContentFilter` work AFTER init? Standing rule 13 says Bitwig
 *      resources are overwhelmingly init-only, so a runtime call may be a silent
 *      no-op (E4c). If it only works at init, the fix is `rig.json` +
 *      `contentFilter` + a Bitwig restart, which is a very different operational
 *      story from "flip it when we need to look".
 *
 * ⚠ Both are answered by re-reading `track.list`, never by the call's return
 * value, which is only an acknowledgement.
 *
 * Also re-checks the `vuHold` staleness fix: the hold now self-invalidates when
 * a bank slot's channelId changes, so a duplicate can no longer hand back the
 * previous occupant's peak.
 *
 * Needs a group with at least one child. Makes brief noise for the vu check.
 */
import { client, check, note, failureCount, pollUntil } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

type TrackRow = { index: number; name: string; position: number; type: string; channelId: string };
type Listing = { tracks: TrackRow[]; count: number; itemCount: number };
const list = async () => (await req('track.list')) as Listing;
const resolves = async (channelId: string) =>
  ((await req('track.resolveByChannelId', { channelId })) as { found: boolean }).found;
const indexOf = async (channelId: string): Promise<number> => {
  const r = (await req('track.resolveByChannelId', { channelId })) as { found: boolean; index?: number };
  if (!r.found || r.index === undefined) throw new Error(`${channelId} does not resolve`);
  return r.index;
};
const setExpanded = async (groupId: string, expanded: boolean) => {
  await req('branch.setMixer', { trackIndex: await indexOf(groupId), groupExpanded: expanded });
  await wait(1500);
};

await client.connect();
console.log('connected\n');

const hello = (await req('contract.hello')) as { methodsHash: string; methodCount: number };
note(`extension: ${hello.methodCount} methods, hash ${hello.methodsHash}`);
const methods = (await req('rig.methods')) as { methods: string[] };
if (!methods.methods.includes('branch.contentFilter')) {
  console.log('\nREFUSING: `branch.contentFilter` is not registered, so Bitwig is running an');
  console.log('OLDER extension than this checkout. A Java extension needs a FULL BITWIG');
  console.log('RESTART — toggling the controller re-runs init() on already-loaded classes.');
  process.exit(1);
}
const stats = (await req('rig.stats')) as Record<string, unknown>;
note(`contentFilter applied at init: ${JSON.stringify(
  (stats as { config?: { contentFilter?: string } }).config?.contentFilter ?? '(not in rig.stats)')}`);

const before = await list();
const group = before.tracks.find((t) => t.type === 'Group');
if (!group) {
  console.log('REFUSING: no group track. Make one in Bitwig (select tracks -> Cmd-G) and re-run.');
  process.exit(1);
}
await setExpanded(group.channelId, true);
const expanded = await list();
const kids = expanded.tracks.filter((t) => !before.tracks.some((b) => b.channelId === t.channelId))
  .concat(expanded.tracks.filter((t) => t.type !== 'Group' && t.position > group.position));
note(`group "${group.name}" at position ${group.position}; bank shows ${expanded.count} tracks`);

// ---- 1. reproduce the hazard under the CURRENT filter ---------------------
console.log('\n-- 1. the hazard, under whatever filter is live now');
await setExpanded(group.channelId, false);
const collapsed = await list();
const vanished = expanded.tracks.filter(
  (t) => !collapsed.tracks.some((c) => c.channelId === t.channelId));
note(`collapsed: count ${expanded.count} -> ${collapsed.count}, `
  + `itemCount ${expanded.itemCount} -> ${collapsed.itemCount}`);
note(`hidden: ${vanished.map((t) => t.name).join(', ') || '(none)'}`);

const hazardReproduces = vanished.length > 0;
check('the hazard reproduces: collapsing a group hides children from the bank',
  hazardReproduces, { hidden: vanished.map((t) => t.name) });
if (!hazardReproduces) {
  note('nothing was hidden — the live filter already includes folded children, '
    + 'so ALL_CHANNELS may already be in effect from rig.json');
}
const ghost = vanished[0];
if (ghost) {
  check('...and the hidden child is UNADDRESSABLE (this is what looks like a deletion)',
    !(await resolves(ghost.channelId)), { channelId: ghost.channelId });
}

// ---- 2. can a RUNTIME filter change bring it back? ------------------------
console.log('\n-- 2. setContentFilter(ALL_CHANNELS) at RUNTIME, group still collapsed');
const applied = (await req('branch.contentFilter', { filter: 'ALL_CHANNELS' })) as
  { called: boolean; error?: string; appliedAtInit?: string };
note(`call acknowledged: ${JSON.stringify(applied)}`);
await wait(1500);

const afterFilter = await list();
note(`after ALL_CHANNELS: count ${collapsed.count} -> ${afterFilter.count}, `
  + `itemCount ${collapsed.itemCount} -> ${afterFilter.itemCount}`);

const runtimeWorks = ghost ? await resolves(ghost.channelId) : afterFilter.count > collapsed.count;
check('⚠ RUNTIME `setContentFilter(ALL_CHANNELS)` restores folded children — '
  + 'the hazard is fixable without a restart',
  runtimeWorks, {
    hiddenChild: ghost?.name, resolvesNow: ghost ? await resolves(ghost.channelId) : 'n/a',
    countBefore: collapsed.count, countAfter: afterFilter.count,
    ifFailed: 'then this is init-only (standing rule 13) — set contentFilter in '
      + '~/.ghostnote/rig.json and restart Bitwig, then re-run',
  });

if (!runtimeWorks) {
  console.log('');
  console.log('  Runtime change did nothing. That is standing rule 13 again: the filter is');
  console.log('  a bank-CREATION-time decision, like `sends`. To test the init path:');
  console.log('    1. add  "contentFilter": "ALL_CHANNELS"  to ~/.ghostnote/rig.json');
  console.log('    2. restart Bitwig (a Java extension needs a full restart)');
  console.log('    3. re-run this probe');
  console.log('');
}

// ---- 3. restore, and confirm the restore actually took --------------------
console.log('\n-- 3. put it back');
await req('branch.contentFilter', { filter: 'ALL_VISIBLE_CHANNELS' });
await wait(1000);
await setExpanded(group.channelId, true);
const restored = await list();
check('the group is expanded again and every track is back',
  restored.count === expanded.count, { before: expanded.count, after: restored.count });

// ---- 4. the vuHold staleness fix -----------------------------------------
console.log('\n-- 4. does the vu hold now self-invalidate across a duplicate?');
const src = restored.tracks.find((t) => t.name === 'gn-E16');
if (!src) {
  note('gn-E16 not present — vu staleness re-check SKIPPED');
} else {
  await req('branch.setMixer', { trackIndex: await indexOf(src.channelId), mute: false });
  await req('slot.launch', { trackIndex: await indexOf(src.channelId), slotIndex: 0 });
  await wait(3000);
  await req('branch.vu', { reset: true });
  await wait(2500);

  const pre = await list();
  const preIds = new Set(pre.tracks.map((t) => t.channelId));
  await req('branch.duplicateTrack', {
    trackIndex: await indexOf(src.channelId), route: 'hostDuplicate', undoName: 'gn E16 vu recheck' });
  await pollUntil(async () => (await list()).count === pre.count + 1, 20000, 25);
  const copy = (await list()).tracks.find((t) => !preIds.has(t.channelId));

  if (copy) {
    const vu = (await req('branch.vu')) as
      { tracks: { channelId: string; hold: number; identityChanged?: boolean }[] };
    const row = vu.tracks.find((t) => t.channelId === copy.channelId);
    note(`copy's row: hold=${row?.hold}, identityChanged=${row?.identityChanged}`);
    check('⚠ a bank slot whose identity changed reports hold=0 and says so, instead of '
      + 'handing back the previous occupant\'s peak',
      row?.hold === 0 && row?.identityChanged === true, { row });

    await req('track.delete', { trackIndex: await indexOf(copy.channelId) });
    await pollUntil(async () => !(await resolves(copy.channelId)), 8000, 100);
  }
  await req('transport.stop');
}

const final = await list();
note(`final: ${final.tracks.map((t) => `${t.position}:${t.name}`).join('  ')}`);
console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} FAILURES`);
process.exit(failureCount() === 0 ? 0 : 1);
