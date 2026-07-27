/**
 * E16 row E3, REOPENED — does `createParentTrack` actually create a group?
 *
 * ⚠ This probe exists because row E3's ○ was recorded from a DOC PASS, which is
 * the precise thing standing rule 10 forbids.
 *
 * `Track.createParentTrack(int numSends, int numScenes)` is documented as
 * "Creates an object that represent[s] the parent track" — phrasing that reads
 * like `createCursorTrack`, i.e. an accessor returning a proxy for something
 * that already exists. On that reading, and on a sweep of the typed API that
 * found no other candidate, E3 recorded "group creation: ○ no typed API".
 *
 * A third-party extension disagrees. `gregrossdev/bitwig-extensions`
 * (`gig-maestro`) implements `track/createGroup` as exactly this call on a
 * CursorTrack, and its design notes state: *"There is no dedicated createGroup()
 * API method. The only way to create a group is Track.createParentTrack(...)
 * which creates a parent group above the current track."*
 *
 * ⚠ **Their evidence is a mock.** The only test is
 * `verify(mockCursorTrack).createParentTrack(4, 5)` — an assertion that the call
 * was ISSUED, with no live verification anywhere in that repository. That is the
 * E4c failure mode exactly ("a supertype method is a claim, not a capability"),
 * and it is how `copyTracks` and `moveTracks` both passed inspection here before
 * turning out to be silent no-ops. So their claim is a hypothesis, and this
 * probe is the readback that settles it either way.
 *
 * Three outcomes, all of them worth having:
 *   ● a NEW group track appears wrapping the subject → E3 flips to ●, group
 *     topology is available with no named action, and §8's decision 5 changes
 *   ○ nothing appears → the javadoc was right, the third-party claim is wrong,
 *     and E3's ○ now rests on a live probe instead of a doc pass
 *   ⚠ the call throws → `create*` is init-only after all (standing rule 13)
 *
 * ⚠ **HAZARD.** `create*` is the shape rule 13 says is init-only, and a runtime
 * call may throw. Everything goes through `trackedRequest()` so that a dropped
 * bridge is reported as a RESULT rather than a stack trace. **Save the project
 * before running this.**
 *
 * Verified by diffing `track.list` — never by the returned proxy, which is only
 * a handle and would look identical in the accessor case.
 */
import { client, check, note, failureCount, pollUntil, trackedRequest } from './lib.js';

const req = trackedRequest();
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

type TrackRow = { index: number; name: string; position: number; type: string; channelId: string };
type Listing = { tracks: TrackRow[]; count: number; itemCount: number };
const list = async () => (await req('track.list')) as Listing;
const indexOf = async (channelId: string): Promise<number> => {
  const r = (await req('track.resolveByChannelId', { channelId })) as { found: boolean; index?: number };
  if (!r.found || r.index === undefined) throw new Error(`${channelId} does not resolve`);
  return r.index;
};
const layout = (l: Listing) =>
  l.tracks.map((t) => `${t.position}:${t.name}${t.type === 'Group' ? '*' : ''}`).join('  ');

await client.connect();
console.log('connected\n');

const methods = (await req('rig.methods')) as { methods: string[] };
if (!methods.methods.includes('branch.createParentTrack')) {
  console.log('REFUSING: `branch.createParentTrack` is not registered — Bitwig is running an');
  console.log('older extension. A Java change needs a FULL BITWIG RESTART.');
  process.exit(1);
}

/**
 * Subject: a plain top-level track that is NOT already inside a group, so that
 * "a parent appeared" cannot be confused with "it already had one". `gn-A` is a
 * disposable fixture; gn-E16 is deliberately avoided — it currently lives inside
 * Group 7 and would make the result unreadable.
 */
const all = await list();
const subject = all.tracks.find((t) => t.name === 'gn-A' && t.type === 'Instrument');
if (!subject) {
  console.log('REFUSING: no gn-A fixture to use as a subject.');
  process.exit(1);
}
note(`subject: ${subject.name} at position ${subject.position}`);
note(`before: ${layout(all)}`);
const groupsBefore = all.tracks.filter((t) => t.type === 'Group').length;

// Point a pool cursor at the subject — the third-party route calls this on a
// CursorTrack, so the cursor must actually be there for the test to be theirs.
await req('cursor.pinTrack', { cursor: 0, pinned: false });
await req('cursor.pointTrack', { cursor: '0', trackIndex: await indexOf(subject.channelId) });
await wait(800);
const cur = (await req('cursor.status', { cursor: '0' })) as { trackName?: string };
check('the cursor is on the subject before the call (else the route is untested)',
  cur.trackName === subject.name, { cursorTrack: cur.trackName, wanted: subject.name });

console.log('\n-- the call (cursorTrack route, as gig-maestro does it)');
const result = (await req('branch.createParentTrack', { route: 'cursorTrack', cursor: '0' })) as
  Record<string, unknown>;
note(`handler returned: ${JSON.stringify(result)}`);

check('the call did not throw — `createParentTrack` is reachable at RUNTIME '
  + '(rule 13 says create* is usually init-only)',
  result['callError'] === undefined, { callError: result['callError'] });

// ⚠ The verdict is the project, not the proxy. In the accessor reading the call
// returns a perfectly good Track handle for the ROOT group and changes nothing.
const settled = await pollUntil(async () =>
  (await list()).tracks.filter((t) => t.type === 'Group').length > groupsBefore, 6000, 200);
const after = await list();
note(`after:  ${layout(after)}`);
const groupsAfter = after.tracks.filter((t) => t.type === 'Group').length;
const newTracks = after.tracks.filter((t) => !all.tracks.some((b) => b.channelId === t.channelId));

note(`group tracks: ${groupsBefore} -> ${groupsAfter}; new tracks: `
  + `${newTracks.map((t) => `${t.name}(${t.type})`).join(', ') || 'none'}`);

const created = groupsAfter > groupsBefore;
check('⚠ E3 REOPENED: `createParentTrack` CREATES a group track in the project '
  + '(verified by diffing track.list, not by the returned proxy)',
  created, {
    groupsBefore, groupsAfter, newTracks: newTracks.map((t) => t.name), settledMs: settled.ms,
    ifFailed: 'the javadoc reading was right — it returns a proxy for an EXISTING parent '
      + '(the root track group) and creates nothing. gig-maestro\'s claim rests on a mock.',
  });

if (created) {
  const group = newTracks.find((t) => t.type === 'Group') ?? after.tracks.find((t) => t.type === 'Group')!;
  note(`new group: "${group.name}" at position ${group.position}`);
  // Does it actually WRAP the subject? Collapse it and see whether the subject
  // leaves the bank — the same oracle row E3 used for nesting.
  await req('branch.setMixer', { trackIndex: await indexOf(group.channelId), groupExpanded: false });
  await wait(1500);
  const wrapped = !((await req('track.resolveByChannelId', { channelId: subject.channelId })) as
    { found: boolean }).found;
  await req('branch.setMixer', { trackIndex: await indexOf(group.channelId), groupExpanded: true });
  await wait(1500);
  check('...and the new group WRAPS the subject (proved by collapse, not position)',
    wrapped, { group: group.name, subject: subject.name });

  console.log('');
  console.log('  ⚠ A group track was created and is LEFT IN PLACE for review.');
  console.log(`     To undo by hand: select "${group.name}" and Ungroup, or use undo.`);
  console.log('     (Not auto-removed: deleting a group cascades to its children, and');
  console.log('      this one wraps a real fixture.)');
} else {
  note('nothing was created — E3\'s ○ now rests on a live probe rather than a doc pass');
}

console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} FAILURES`);
process.exit(failureCount() === 0 ? 0 : 1);
