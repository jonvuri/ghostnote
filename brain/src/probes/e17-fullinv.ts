/**
 * E17 — FULL project inventory: every track, every device, every chain.
 *
 * ⚠ **Why this exists.** `e17ah`'s `snapshot()` verified the track list by identity
 * and captured `gn-lay4`'s devices and chains — but never looked at any OTHER
 * track's contents. So a `Duplicate` landing on the reset track (or anywhere else)
 * would be invisible to `classify()`, and every ○ in the sweep would mean "the
 * action fired somewhere I was not looking" rather than "no focus was established".
 *
 * The operator spotted it by eye: *"the track that was briefly switched to each time
 * seemed to have several duplicated layers, as if the actions were all landing on it
 * instead of gn-lay4."* ⚠ That is the third time a blind spot in a probe has been
 * caught by a human looking at the screen rather than by the instrument.
 *
 * ⚠ Two known pre-existing artifacts, documented in FINDINGS, so they are NOT
 * evidence of anything new:
 *   - track 0, literally named `Instrument Layer` (Hybrid), carries EIGHT stacked
 *     containers of the E4g shape and always has — a leftover from an earlier
 *     session; no E17 probe has ever addressed it.
 *   - `gn-lay` chain 0 `A·take` holds `[Polysynth + Polysynth + Polysynth]`,
 *     consistent with the earlier chain-FILL routes.
 * ⚠ Anything BEYOND those two is new and needs explaining.
 *
 * Silent and READ-ONLY: no actions, no inserts, no deletes, no foreground needed.
 */
import { client, note, failureCount, check, pollUntil } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);

interface TrackRow { index: number; name: string; type: string; channelId: string }
interface DevList { devices: { index: number; name: string }[]; count: number; itemCount: number }
interface LayerList { layers: { index: number; name: string; devices: { name: string }[] }[]; count: number }

await client.connect();
const tracks = ((await req('track.list')) as { tracks: TrackRow[] }).tracks;

async function devicesOn(trackIndex: number): Promise<DevList> {
  await req('cursor.pointTrack', { cursor: '0', trackIndex });
  await pollUntil(async () => {
    const s = (await req('cursor.status', { cursor: '0' })) as { trackPosition: number };
    return s.trackPosition === trackIndex;
  }, 4000, 150);
  await new Promise((r) => setTimeout(r, 250));
  let last = '';
  let out: DevList = { devices: [], count: 0, itemCount: 0 };
  await pollUntil(async () => {
    out = (await req('device.list', { cursor: '0' })) as DevList;
    const n = out.devices.map((d) => d.name).join(',');
    const stable = n === last; last = n; return stable;
  }, 4000, 200);
  return out;
}

console.log('');
console.log('='.repeat(74));
console.log(' FULL PROJECT INVENTORY — every track, every device, every chain');
console.log('='.repeat(74));

let totalContainers = 0;
const containerCounts: Record<string, number> = {};

for (const t of tracks) {
  if (t.type === 'Master' || t.type === 'master') { console.log(`\n  [${t.index}] ${t.name}  (${t.type})`); continue; }
  const d = await devicesOn(t.index);
  console.log(`\n  [${t.index}] ${t.name}  (${t.type})  ${t.channelId.slice(0, 8)}  devices=${d.count}/${d.itemCount}`);
  if (d.count === 0) { console.log('        (no devices)'); continue; }
  let containers = 0;
  for (const dev of d.devices) {
    const isContainer = /Instrument Layer|FX Layer|Instrument Selector|FX Selector/.test(dev.name);
    console.log(`        [${dev.index}] ${dev.name}${isContainer ? '' : '   (not a container)'}`);
    if (!isContainer) continue;
    containers++;
    totalContainers++;
    await req('devcursor.selectAt', { deviceIndex: dev.index });
    const ok = await pollUntil(async () => {
      const s = (await req('devcursor.status')) as { exists: boolean; name: string };
      return s.exists && s.name === dev.name;
    }, 6000, 150);
    if (!ok.ok) { console.log('            ⚠ could not scope to it'); continue; }
    const l = (await req('layer.list')) as LayerList;
    for (const ch of l.layers) {
      const inside = ch.devices.map((x) => x.name);
      console.log(`            chain ${ch.index} ${JSON.stringify(ch.name).padEnd(14)}`
        + ` [${inside.join(' + ') || '—'}]${inside.length > 1 ? '   ⚠ multi-device' : ''}`);
    }
  }
  containerCounts[t.name] = containers;
}

console.log('');
console.log('='.repeat(74));
// ⚠ The two documented pre-existing artifacts, asserted by NAME so a new one stands out.
check('gn-lay4 has exactly ONE container (the sweep\'s subject, must be pristine)',
  containerCounts['gn-lay4'] === 1, { containers: containerCounts['gn-lay4'] });
check('gn-lay has exactly ONE container',
  containerCounts['gn-lay'] === 1, { containers: containerCounts['gn-lay'] });
check('⚠ track 0 `Instrument Layer` still has its documented EIGHT stacked containers',
  containerCounts['Instrument Layer'] === 8,
  { containers: containerCounts['Instrument Layer'], documented: 8 });
note(`total containers across the project: ${totalContainers}`);
note('⚠ Compare the chain lists above against FINDINGS. Anything beyond the two');
note('  documented artifacts (track 0\'s eight containers, gn-lay\'s A·take triple)');
note('  is NEW and means an action landed somewhere no probe was measuring.');
console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} checks reported a negative — read individually`);
process.exit(0);
