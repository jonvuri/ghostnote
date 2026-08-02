/**
 * E17 cleanup — trim the duplicate containers `e17p` stacked onto gn-lay4.
 *
 * ⚠ **What went wrong, because it is a method finding and not just a mess.**
 * `e17p` fired `Duplicate` six times, once per navigation candidate, expecting
 * the navigation to have moved the selection onto a layer chain. It never did —
 * the selection stayed on the CONTAINER, so every fire duplicated the container
 * device. The sweep's ○ verdict is unaffected (it read chains through device 0,
 * which stayed the original), but the fixture ended with 8 stacked Instrument
 * Layers.
 *
 * ⚠ **The instrument was blind to its own side effect.** The probe measured
 * `chains inside device 0` and `devices inside those chains`, and duplicating the
 * container changes NEITHER. So the `app.undo` cleanup was gated on a signal that
 * could not appear, and six duplications accumulated silently. The general rule:
 * **a probe that fires a selection-scoped action must diff EVERY level the action
 * could have landed on** — track list, device list AND chain list — because the
 * whole point of the uncertainty is not knowing which one it hit.
 *
 * This keeps device 0 and deletes the rest, verifying by name and count.
 */
import { client, check, note, failureCount, pollUntil } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);
const SUBJECT = 'gn-lay4';

interface TrackRow { index: number; name: string; type: string; channelId: string }
interface DevList { devices: { index: number; name: string }[]; count: number }
interface LayerList { layers: { index: number; name: string; devices: { name: string }[] }[]; count: number }

await client.connect();
const tracks = ((await req('track.list')) as { tracks: TrackRow[] }).tracks;
const subject = tracks.find((t) => t.name === SUBJECT);
if (!subject) { console.log(`REFUSING: ${SUBJECT} not found.`); process.exit(1); }

async function devices(): Promise<DevList> {
  await req('cursor.pointTrack', { cursor: '0', trackIndex: subject!.index });
  await pollUntil(async () => {
    const s = (await req('cursor.status', { cursor: '0' })) as { trackPosition: number };
    return s.trackPosition === subject!.index;
  }, 4000, 150);
  let last = '';
  let out: DevList = { devices: [], count: 0 };
  await pollUntil(async () => {
    out = (await req('device.list', { cursor: '0' })) as DevList;
    const n = out.devices.map((d) => d.name).join(',');
    const stable = n === last;
    last = n;
    return stable;
  }, 4000, 200);
  return out;
}

const before = await devices();
note(`${SUBJECT} before: ${before.count} devices — [${before.devices.map((d) => d.name).join(', ')}]`);

// ⚠ Always delete the LAST one, never a held index: deleting device[0] slides the
// survivor from 1 to 0 under any index we were holding (E3).
for (let g = 0; g < 16; g++) {
  const d = await devices();
  if (d.count <= 1) break;
  const victim = d.devices[d.devices.length - 1]!;
  await req('device.delete', { cursor: '0', deviceIndex: victim.index });
  await pollUntil(async () => (await devices()).count < d.count, 4000, 200);
}

const after = await devices();
note(`${SUBJECT} after:  ${after.count} devices — [${after.devices.map((d) => d.name).join(', ')}]`);
check('exactly one container survives', after.count === 1 && after.devices[0]?.name === 'Instrument Layer',
  { devices: after.devices.map((d) => d.name) });

// ⚠ BOUNCE the track cursor off another track and back before reading.
//
// After a burst of deletes the device cursor is left ORPHANED — `devcursor.status`
// reports `exists:false, name:""` — and neither `devcursor.selectAt` nor
// `devcursor.selectInChannel` recovers it. The first version of this probe read
// through that orphaned cursor and reported the surviving container as having
// ZERO chains, which looks exactly like "the cleanup deleted the wrong ones".
// Re-pointing the TRACK cursor away and back forces the DeviceBank and the cursor
// device to re-scope, and the 4 chains reappear. This is E1/E3's "re-point after
// any structural op" with the sharper detail that the re-point has to be a real
// MOVE — pointing at the same track again is not enough.
const others = tracks.filter((t) => t.index !== subject.index && t.type === 'Instrument');
for (const target of [others[0] ?? tracks[0]!, subject]) {
  await req('cursor.pointTrack', { cursor: '0', trackIndex: target.index });
  await pollUntil(async () => {
    const s = (await req('cursor.status', { cursor: '0' })) as { trackPosition: number };
    return s.trackPosition === target.index;
  }, 4000, 150);
  await new Promise((r) => setTimeout(r, 800));
  await req('device.list', { cursor: '0' });
}

// ⚠ And the survivor must still be the REAL fixture, not an empty shell — named,
// not counted (e16t): a count of 4 is also what a wrong survivor could report.
await req('devcursor.selectAt', { deviceIndex: 0 });
const bound = await pollUntil(async () => {
  const s = (await req('devcursor.status')) as { exists: boolean; name: string };
  return s.exists && s.name === 'Instrument Layer';
}, 6000, 150);
check('the device cursor re-bound after the deletes (it orphans, and only a track'
  + ' cursor MOVE recovers it)', bound.ok, await req('devcursor.status'));
const l = (await req('layer.list')) as LayerList;
const shape = l.layers.map((x) => `${x.index}:[${x.devices.map((d) => d.name).join('+') || '—'}]`).join(' ');
note(`chains: ${shape}`);
check('the surviving container is the E4g 4-chain fixture, by DEVICE NAME',
  l.count === 4
  && ['Phase-4', 'Polysynth', 'Organ', 'Sampler'].every((n, i) => l.layers[i]?.devices[0]?.name === n),
  { count: l.count, shape });

console.log(failureCount() === 0 ? '\nALL PASS — fixture restored' : `\n${failureCount()} FAILURES`);
process.exit(failureCount() === 0 ? 0 : 1);
