/**
 * E17 diagnostic — what is actually in the sandbox right now.
 *
 * ⚠ Born because `e17b`'s FX-Layer precondition FAILED, and the failure had two
 * readings that matter very differently: either the insert landed on the wrong
 * track (fixture damage), or `device.list` read the PREVIOUS track's chain
 * because the DeviceBank had not finished re-scoping after `cursor.pointTrack`.
 * The second is a method trap worth recording; the first is a mess to clean up.
 * A count cannot tell them apart — naming what is on each track can (the e16t
 * "name it, do not count it" rule).
 *
 * ⚠ It also demonstrates the trap directly: it reads each track's chain TWICE,
 * once immediately after pointing and once after polling for the re-scope.
 */
import { client, note, pollUntil } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);

interface TrackRow { index: number; name: string; type: string; channelId: string }
interface DevList { devices: { index: number; name: string }[]; count: number }

await client.connect();
const tracks = ((await req('track.list')) as { tracks: TrackRow[] }).tracks;

console.log('\n-- every track\'s device chain, read IMMEDIATELY vs after a settle poll');
let staleSeen = 0;
let previous = '(none)';
for (const t of tracks) {
  await req('cursor.pointTrack', { cursor: '0', trackIndex: t.index });
  const immediate = (await req('device.list', { cursor: '0' })) as DevList;
  const immediateNames = immediate.devices.map((d) => d.name).join(', ') || '—';
  // ⚠ Wait on the CURSOR's own trackPosition, not on the device list settling.
  // The first version of this polled for "two consecutive equal reads", which a
  // stale-but-stable value satisfies immediately — so the diagnostic written to
  // expose the stale-read trap was itself reporting stale chains, and said
  // gn-lay held gn-E16's devices. The bank cannot have re-scoped before the
  // cursor has arrived, so the cursor is the thing to wait on.
  await pollUntil(async () => {
    const s = (await req('cursor.status', { cursor: '0' })) as { trackPosition: number };
    return s.trackPosition === t.index;
  }, 4000, 150);
  let last = '';
  await pollUntil(async () => {
    const d = (await req('device.list', { cursor: '0' })) as DevList;
    const names = d.devices.map((x) => x.name).join(', ') || '—';
    const stable = names === last;
    last = names;
    return stable;
  }, 3000, 200);
  const settled = last;
  const stale = immediateNames !== settled;
  if (stale) staleSeen++;
  console.log(`  ${String(t.index).padStart(2)} ${t.name.padEnd(18)} ${t.type.padEnd(11)}`
    + ` [${settled}]${stale ? `   ⚠ IMMEDIATE read said [${immediateNames}]`
      + `${immediateNames === previous ? ' — which is the PREVIOUS track\'s chain' : ''}` : ''}`);
  previous = settled;
}

note(`${staleSeen} of ${tracks.length} tracks returned a stale chain on the immediate read`);
if (staleSeen > 0) {
  note('⚠ `device.list` right after `cursor.pointTrack` can return the PREVIOUS track\'s');
  note('  chain. A probe that baselines with that read is comparing two different tracks.');
}
process.exit(0);
