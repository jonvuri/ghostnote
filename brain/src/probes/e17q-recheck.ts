/**
 * E17 — re-measure the rows that ran against a CONTAMINATED fixture.
 *
 * ⚠ **Why.** `e17p` stacked duplicate containers onto `gn-lay4` and its
 * instrument could not see them: it measured *chains inside device 0* and
 * *devices inside those chains*, and duplicating the CONTAINER changes neither.
 * The user then reported having noticed the duplicates "quite a while ago",
 * which places their origin EARLIER than `e17p` — `e17p`'s own control printed
 * FOUR containers after a single `Group`, so ~3 already existed. The window is
 * `e17k` → `e17p`, and `e17k`/`e17o` fired `Duplicate`/`Copy`+`Paste` with the
 * same blind instrument.
 *
 * ⚠ **The fix is not a better argument, it is a better instrument.** Every trial
 * here diffs ALL THREE levels a selection-scoped action could land on:
 *
 *     TRACKS   an action that hit the track selection (E16j's orphan mechanism)
 *     DEVICES  an action that hit the CONTAINER — the level that was invisible
 *     CHAINS   an action that hit the chain, which is the thing being asked about
 *
 * A trial that changes nothing at any level means the action did not fire; a
 * trial that changes DEVICES means it fired and landed on the container. Those
 * are completely different findings and the old probes could not tell them apart.
 *
 * ⚠ Re-running also RESCUES an interpretation rather than merely confirming one.
 * If the ○ trials turn out to have been duplicating the container all along, the
 * actions were firing — which makes "our selection never reaches the chain" a
 * POSITIVE result rather than an absence, and strengthens `E17-VERDICT.md` §1a.
 *
 * Also re-run: row 4's typed delete, which is the single most load-bearing ○ in
 * the session. It ran before the contamination window on the reconstruction, but
 * the whole point of this probe is to stop relying on reconstruction.
 *
 * ⚠ Needs Bitwig FOREGROUND (e17m: 0/8 backgrounded). Waits rather than refusing.
 *
 * Silent: nothing is launched and the transport is never touched.
 */
import { client, check, note, failureCount, pollUntil } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);

const SUBJECT = 'gn-lay4';
const SCRATCH = 'gn-A';
const POLYSYNTH = 'a9ffacb5-33e9-4fc7-8621-b1af31e410ef';
const FOCUS_DEVICES = 'focus_or_toggle_device_panel';
const FOCUS_LAUNCHER = 'focus_or_toggle_clip_launcher';

interface TrackRow { index: number; name: string; type: string; channelId: string }
const list = async () => (await req('track.list')) as { tracks: TrackRow[]; count: number };
interface DevList { devices: { index: number; name: string }[]; count: number; itemCount: number }
interface LayerRow { index: number; name: string; channelId?: string | boolean; devices: { name: string }[] }
interface LayerList { layers: LayerRow[]; count: number }

await client.connect();
const baseline = await list();
const baseIds = new Set(baseline.tracks.map((t) => t.channelId));
const subject = baseline.tracks.find((t) => t.name === SUBJECT);
const scratch = baseline.tracks.find((t) => t.name === SCRATCH);
if (!subject || !scratch) { console.log('REFUSING: fixtures missing.'); process.exit(1); }

async function pointAt(trackIndex: number): Promise<void> {
  await req('cursor.pointTrack', { cursor: '0', trackIndex });
  await pollUntil(async () => {
    const s = (await req('cursor.status', { cursor: '0' })) as { trackPosition: number };
    return s.trackPosition === trackIndex;
  }, 4000, 150);
  await new Promise((r) => setTimeout(r, 400));
}

/** ⚠ `itemCount` as well as `count`: the bank caps at deviceBank, so a count of 8 can hide more. */
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

async function chainsOf(trackIndex: number): Promise<LayerList> {
  await devicesOn(trackIndex);
  await req('devcursor.selectAt', { deviceIndex: 0 });
  await pollUntil(async () => {
    const s = (await req('devcursor.status')) as { exists: boolean; name: string };
    return s.exists && s.name === 'Instrument Layer';
  }, 6000, 150);
  return (await req('layer.list')) as LayerList;
}

/** A full three-level reading — the instrument the old probes lacked. */
interface Level { tracks: number; devices: number; itemCount: number; chains: number; chainIds: string[] }
async function levels(): Promise<Level> {
  const t = await list();
  const d = await devicesOn(subject!.index);
  const c = await chainsOf(subject!.index);
  return {
    tracks: t.count, devices: d.count, itemCount: d.itemCount, chains: c.count,
    chainIds: c.layers.map((x) => String(x.channelId).slice(0, 8)),
  };
}
const fmt = (l: Level) => `tracks=${l.tracks} devices=${l.devices}/${l.itemCount} chains=${l.chains}`;

async function restore(target: Level, where: string): Promise<void> {
  // ⚠ Reap orphan TRACKS by identity, then trim excess DEVICES from the end.
  for (let g = 0; g < 10; g++) {
    const now = await list();
    const orphan = now.tracks.find((x) => !baseIds.has(x.channelId));
    if (!orphan) break;
    note(`⚠ ${where}: reaped orphan track ${orphan.name}`);
    await req('track.delete', { trackIndex: orphan.index });
    await pollUntil(async () => !(await list()).tracks.some((x) => x.channelId === orphan.channelId), 4000, 200);
  }
  for (let g = 0; g < 16; g++) {
    const d = await devicesOn(subject!.index);
    if (d.count <= target.devices) break;
    note(`⚠ ${where}: trimming a duplicate container (${d.count} -> ${d.count - 1})`);
    await req('device.delete', { cursor: '0', deviceIndex: d.devices[d.devices.length - 1]!.index });
    await pollUntil(async () => (await devicesOn(subject!.index)).count < d.count, 4000, 200);
  }
  // ⚠ The device cursor ORPHANS after deletes and only a track-cursor MOVE
  // recovers it — re-pointing at the same track is not enough.
  await pointAt(scratch!.index);
  await pointAt(subject!.index);
}

// ==========================================================================
console.log('\n-- BASELINE, all three levels');
const start = await levels();
note(`${SUBJECT}: ${fmt(start)}  chainIds=${start.chainIds.join(' ')}`);
check('PRECONDITION: exactly ONE container, so a duplicate is immediately visible',
  start.devices === 1 && start.itemCount === 1, { devices: start.devices, itemCount: start.itemCount });
check('PRECONDITION: it is the 4-chain E4g fixture', start.chains === 4, { chains: start.chains });

// ==========================================================================
console.log('\n-- CONTROL: wait for the device-panel dispatch path (needs FOREGROUND)');
note('⚠ CLICK INTO BITWIG. Retrying for 90s, rebuilding the scratch fixture each round.');
let dispatchLive = false;
const waitStart = Date.now();
for (let round = 1; Date.now() - waitStart < 90_000; round++) {
  for (let g = 0; g < 8; g++) {
    const d = await devicesOn(scratch.index);
    if (d.count === 0) break;
    await req('device.delete', { cursor: '0', deviceIndex: d.devices[0]!.index });
    await pollUntil(async () => (await devicesOn(scratch.index)).count < d.count, 4000, 200);
  }
  await req('device.insertBitwig', { cursor: '0', uuid: POLYSYNTH });
  await pollUntil(async () => (await devicesOn(scratch.index)).count === 1, 8000, 200);
  await devicesOn(scratch.index);
  await req('device.selectInEditor', { deviceIndex: 0 });
  await req('app.invokeAction', { id: FOCUS_LAUNCHER });
  await new Promise((r) => setTimeout(r, 250));
  await req('app.invokeAction', { id: FOCUS_DEVICES });
  await new Promise((r) => setTimeout(r, 400));
  await req('device.selectInEditor', { deviceIndex: 0 });
  await new Promise((r) => setTimeout(r, 300));
  await req('app.invokeAction', { id: 'Group' });
  await new Promise((r) => setTimeout(r, 1600));
  const d = await devicesOn(scratch.index);
  if (d.devices[0]?.name === 'Instrument Layer') {
    note(`dispatch live on round ${round} (${((Date.now() - waitStart) / 1000).toFixed(0)}s)`);
    dispatchLive = true;
    break;
  }
  note(`round ${round}: not dispatching`);
}
for (let g = 0; g < 8; g++) {
  const d = await devicesOn(scratch.index);
  if (d.count === 0) break;
  await req('device.delete', { cursor: '0', deviceIndex: d.devices[0]!.index });
  await pollUntil(async () => (await devicesOn(scratch.index)).count < d.count, 4000, 200);
}
check('CONTROL: named actions reach our DEVICE selection', dispatchLive, {});
if (!dispatchLive) {
  console.log('\nREFUSING after 90s — bring Bitwig forward and re-run.');
  process.exit(1);
}

// ==========================================================================
console.log('\n======== RE-TEST: every selection mechanism, diffing ALL THREE levels');
interface Trial { label: string; before: Level; after: Level }
const trials: Trial[] = [];

async function trial(label: string, setup: () => Promise<void>, action: string[]): Promise<Trial> {
  const before = await levels();
  await setup();
  await req('app.invokeAction', { id: FOCUS_LAUNCHER });
  await new Promise((r) => setTimeout(r, 250));
  await req('app.invokeAction', { id: FOCUS_DEVICES });
  await new Promise((r) => setTimeout(r, 400));
  await setup();
  for (const a of action) {
    await req('app.invokeAction', { id: a });
    await new Promise((r) => setTimeout(r, 1500));
  }
  const after = await levels();
  const dT = after.tracks - before.tracks;
  const dD = after.devices - before.devices;
  const dC = after.chains - before.chains;
  const verdict = dC > 0 ? '● CHAIN' : dD > 0 ? '◐ CONTAINER' : dT > 0 ? '⚠ TRACK' : '○ nothing';
  console.log(`  ${label.padEnd(40)} Δtracks=${dT} Δdevices=${dD} Δchains=${dC}   ${verdict}`);
  trials.push({ label, before, after });
  await restore(before, label);
  return { label, before, after };
}

const selLayerEditor = async () => {
  await chainsOf(subject.index);
  await req('layer.select', { layerIndex: 1, where: 'editor' });
  await new Promise((r) => setTimeout(r, 500));
};
const selLayerMixer = async () => {
  await chainsOf(subject.index);
  await req('layer.select', { layerIndex: 1, where: 'mixer' });
  await new Promise((r) => setTimeout(r, 500));
};
const selPointCursor = async () => {
  await chainsOf(subject.index);
  await req('layer.pointCursor', { layerIndex: 1 });
  await new Promise((r) => setTimeout(r, 500));
};
const selContainer = async () => {
  await devicesOn(subject.index);
  await req('device.selectInEditor', { deviceIndex: 0 });
  await new Promise((r) => setTimeout(r, 400));
};

await trial('layer.select(editor) + Duplicate', selLayerEditor, ['Duplicate']);
await trial('layer.select(mixer) + Duplicate', selLayerMixer, ['Duplicate']);
await trial('layer.pointCursor + Duplicate', selPointCursor, ['Duplicate']);
await trial('layer.pointCursor + Copy + Paste', selPointCursor, ['Copy', 'Paste']);
// ⚠ The REFERENCE arm: aim at the container deliberately. If this shows ◐ and the
// layer arms show ○, the layer selection is genuinely not being reached. If the
// layer arms ALSO show ◐, they were hitting the container all along.
await trial('device.selectInEditor(container) + Duplicate  [reference]', selContainer, ['Duplicate']);

// ==========================================================================
console.log('\n======== RE-TEST: row 4, the typed deletes, on a proven-clean fixture');
const b4 = await levels();
note(`before: ${fmt(b4)}  chainIds=${b4.chainIds.join(' ')}`);
for (const method of ['layer.delete', 'layer.deleteViaHost']) {
  await chainsOf(subject.index);
  await req(method, { layerIndex: 1 });
  await new Promise((r) => setTimeout(r, 1500));
  const a = await levels();
  console.log(`  ${method.padEnd(40)} Δdevices=${a.devices - b4.devices} Δchains=${a.chains - b4.chains}`
    + `   ${a.chains < b4.chains ? '● removed' : '○'}`);
}
const a4 = await levels();
check('⚠ ROW 4 re-confirmed on a clean fixture: the typed deletes still refuse',
  a4.chains === b4.chains && a4.chainIds.join() === b4.chainIds.join(),
  { before: b4.chainIds, after: a4.chainIds });

// ==========================================================================
console.log('\n-- final state');
await restore(start, 'final');
const end = await levels();
note(`${SUBJECT}: ${fmt(end)}  chainIds=${end.chainIds.join(' ')}`);
check('the fixture is back to its baseline at all three levels',
  end.tracks === start.tracks && end.devices === start.devices && end.chains === start.chains,
  { start: fmt(start), end: fmt(end) });

// ==========================================================================
console.log('\n======== VERDICT');
const chainHits = trials.filter((t) => t.after.chains > t.before.chains);
const containerHits = trials.filter((t) => t.after.devices > t.before.devices);
check('⚠ no selection mechanism reaches the CHAIN (the E17-VERDICT §1a claim)',
  chainHits.length === 0, { hits: chainHits.map((t) => t.label) });
note(`${containerHits.length} of ${trials.length} trials landed on the CONTAINER: `
  + `${containerHits.map((t) => t.label).join(', ') || 'none'}`);
if (chainHits.length > 0) {
  note('⚠⚠ A mechanism DOES reach the chain — E17-VERDICT.md §1a is wrong.');
} else if (containerHits.some((t) => t.label.startsWith('layer.'))) {
  note('⇒ ⚠ The layer-selection arms fired and hit the CONTAINER. So the actions were');
  note('  live and our selection simply never moved off the container — which makes');
  note('  §1a a POSITIVE result rather than an absence, and explains the duplicates.');
} else {
  note('⇒ The layer-selection arms did nothing at any level, while the container');
  note('  reference arm did. Our selection reaches a device and never a chain.');
}
console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} checks reported a negative — read them individually`);
process.exit(0);
