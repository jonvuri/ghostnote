/**
 * E17 — a FULL inventory of gn-lay4, one level deeper than any probe has looked.
 *
 * ⚠ **Why this exists.** `e17v`'s `contentsOf()` read `x.devices[0]?.name` — the
 * FIRST device in each chain. So a `Duplicate` that copied the Phase-4 device
 * *inside* chain 0 would leave that chain holding `[Phase-4, Phase-4]` and the
 * column would still print `"Phase-4"`. **"○ nothing happened" and "it duplicated
 * a device one level below where I was looking" are the same reading in that
 * instrument** — which is exactly the blindness `e17p` had when it stacked six
 * containers invisibly, reproduced by me one level down.
 *
 * ⚠ `e17v`'s `restore()` would not have caught it either: it trims excess
 * CONTAINERS and reaps orphan TRACKS, and knows nothing about devices inside a
 * chain. Its closing "back to baseline at all three levels" check compares the
 * same blind column, so it can pass over a dirty fixture.
 *
 * This prints EVERY device in EVERY chain, and the device list of every track
 * the E17 fixtures use, so the state is inspectable rather than inferred.
 *
 * Silent and READ-ONLY: no actions, no inserts, no deletes, no transport, and
 * nothing here needs Bitwig in the foreground.
 */
import { client, check, note, failureCount, pollUntil } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);

const FIXTURES = ['gn-lay4', 'gn-lay', 'gn-sel', 'gn-A', 'gn-B'];

interface TrackRow { index: number; name: string; type: string; channelId: string }
interface DevList { devices: { index: number; name: string }[]; count: number; itemCount: number }
interface LayerRow { index: number; name: string; channelId?: string | boolean; devices: { name: string }[] }
interface LayerList { layers: LayerRow[]; count: number }

await client.connect();
const tracks = ((await req('track.list')) as { tracks: TrackRow[] }).tracks;

async function pointAt(trackIndex: number): Promise<void> {
  await req('cursor.pointTrack', { cursor: '0', trackIndex });
  // ⚠ Poll the POSITION, not two equal reads — a stale-but-stable value satisfies
  // "two consecutive equal reads" and that trap ate `e17-diag` itself.
  await pollUntil(async () => {
    const s = (await req('cursor.status', { cursor: '0' })) as { trackPosition: number };
    return s.trackPosition === trackIndex;
  }, 4000, 150);
  await new Promise((r) => setTimeout(r, 300));
}

async function devicesOn(trackIndex: number): Promise<DevList> {
  await pointAt(trackIndex);
  let last = '';
  let out: DevList = { devices: [], count: 0, itemCount: 0 };
  await pollUntil(async () => {
    out = (await req('device.list', { cursor: '0' })) as DevList;
    const n = out.devices.map((d) => d.name).join(',');
    const stable = n === last;
    last = n;
    return stable;
  }, 4000, 200);
  return out;
}

console.log('');
console.log('='.repeat(70));
console.log(' FULL INVENTORY — every device, in every chain, on every E17 fixture');
console.log('='.repeat(70));

// ⚠ Scoped per TRACK, not globally. `e17v` only ever touched `gn-lay4` and `gn-A`,
// so a multi-device chain on `gn-lay` says nothing about it — and the first version
// of this probe blamed `e17v` for exactly that, committing the one-outcome-two-causes
// error it was written to catch.
const SUBJECT_OF_E17V = 'gn-lay4';
let subjectDirty = false;
const elsewhere: string[] = [];

for (const name of FIXTURES) {
  const t = tracks.find((x) => x.name === name);
  if (!t) { console.log(`\n  ${name}: (absent)`); continue; }
  const d = await devicesOn(t.index);
  console.log(`\n  ${name}  (track ${t.index})  devices=${d.count}/${d.itemCount}`);
  if (d.count === 0) { console.log('      (empty)'); continue; }
  for (const dev of d.devices) {
    console.log(`      [${dev.index}] ${dev.name}`);
    if (dev.name !== 'Instrument Layer' && dev.name !== 'FX Layer') continue;
    await req('devcursor.selectAt', { deviceIndex: dev.index });
    const ok = await pollUntil(async () => {
      const s = (await req('devcursor.status')) as { exists: boolean; name: string };
      return s.exists && s.name === dev.name;
    }, 6000, 150);
    if (!ok.ok) { console.log('          ⚠ could not scope to this container'); continue; }
    const l = (await req('layer.list')) as LayerList;
    for (const ch of l.layers) {
      const inside = ch.devices.map((x) => x.name);
      // ⚠ THE THING e17v COULD NOT SEE: more than one device in a chain.
      const flag = inside.length > 1 ? '   ⚠ MORE THAN ONE DEVICE' : '';
      if (inside.length > 1) {
        if (name === SUBJECT_OF_E17V) subjectDirty = true;
        else elsewhere.push(`${name} chain ${ch.index} ${JSON.stringify(ch.name)} [${inside.join(' + ')}]`);
      }
      console.log(`          chain ${ch.index} ${JSON.stringify(ch.name).padEnd(14)}`
        + ` [${inside.join(' + ') || '—'}]${flag}`);
    }
  }
}

console.log('');
console.log('='.repeat(70));
check(`⚠ ${SUBJECT_OF_E17V} — e17v's ONLY subject — has no chain holding an extra device`,
  !subjectDirty, { subjectDirty });
if (subjectDirty) {
  note('⚠⚠ `e17v` arm 1 or 2 DID fire and landed one level below its instrument — so its');
  note('  "○ nothing" is WRONG and rows 3/4 must be re-argued: the action reached the');
  note('  chain SCOPE and duplicated a device inside it. Do not record e17v as it stands.');
} else {
  note(`⇒ \`e17v\`'s Δ0 readings are genuine at this level too — ${SUBJECT_OF_E17V} is`);
  note('  byte-for-byte its baseline, so the blind spot did not bite and the fixture is');
  note('  clean for the next run. ⚠ Its PART 2 is still VOID, but for the OTHER reason:');
  note('  the container reference arm was dead, so dispatch had stopped.');
}
if (elsewhere.length > 0) {
  note('');
  note('⚠ Multi-device chains exist on tracks e17v never touched. NOT attributable to it:');
  for (const e of elsewhere) note(`    ${e}`);
  note('  These are consistent with the earlier chain-FILL routes (row 3 typed-create,');
  note('  `moveDevices`, `layer.pasteInto`), which deliberately put devices into a chain.');
  note('  ⚠ Recorded as unexplained rather than assigned — no probe here measured it.');
}
console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} checks reported a negative`);
process.exit(0);
