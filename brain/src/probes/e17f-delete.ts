/**
 * E17 row 4, bracketed — can a layer chain be DELETED? Three routes, two verb
 * controls, and the controls are why the answer is worth anything.
 *
 * ⚠ **This row decides the session.** Rows 1, 2 and 3 are all ○, so delete is the
 * last mechanism a layer-based branch model could rest on. `e17e` measured
 * `layer.delete` and `layer.deleteViaHost` as silent no-ops on a 4-chain
 * container with the precondition proved — but a bare ○ on the row that decides
 * the session is exactly the shape this spike has been wrong about five times
 * (CLAP params, `channelId`, chain creation, group creation, `moveDevices`),
 * every time from a single mechanism with no positive control.
 *
 * So this re-runs it the way `e17b` re-ran E4d's duplication ○:
 *
 *   VERB CONTROL 1  `Device.deleteObject()` on a device — the SAME supertype
 *                   method (`DeleteableObject.deleteObject`, API v10) on a
 *                   neighbouring object. If it fires and the layer call does
 *                   not, the ○ is about LAYERS.
 *   VERB CONTROL 2  `ControllerHost.deleteObjects()` on a clip slot — the same
 *                   host-level batch call `layer.deleteViaHost` uses, on the
 *                   target E14 row G already proved it works against.
 *   ROUTE 3         `layer.select` first, then delete. `deleteObject()` is an
 *                   addressed call rather than a selection-scoped one, so this
 *                   should not matter — but "try the sibling" has paid five
 *                   times in this spike and the call costs nothing.
 *
 * ⚠ Without control 1, "delete does nothing on a layer" cannot be told from
 * "delete does nothing today", which is precisely the ambiguity E6's write-up
 * could not resolve and which §3.4e was criticised for leaving open.
 *
 * Silent: nothing is launched and the transport is never touched.
 */
import { client, check, note, failureCount, pollUntil } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);

const POLYSYNTH = 'a9ffacb5-33e9-4fc7-8621-b1af31e410ef';
const SCRATCH = 'gn-A';

interface TrackRow { index: number; name: string; type: string; channelId: string }
const list = async () => ((await req('track.list')) as { tracks: TrackRow[] }).tracks;
interface DevList { devices: { index: number; name: string }[]; count: number }
interface LayerRow { index: number; name: string; channelId?: string | boolean; devices: { name: string }[] }
interface LayerList { layers: LayerRow[]; count: number; cursorDeviceName?: string }
const layers = async () => (await req('layer.list')) as LayerList;
const namesOf = (l: LayerList) => l.layers.map((x) => x.devices.map((d) => d.name).join('+') || '—');
const shapeOf = (l: LayerList) =>
  l.layers.map((x) => `${x.index}:[${x.devices.map((d) => d.name).join('+') || '—'}]`).join(' ') || '(no chains)';

async function devicesOn(trackIndex: number): Promise<DevList> {
  await req('cursor.pointTrack', { cursor: '0', trackIndex });
  await pollUntil(async () => {
    const s = (await req('cursor.status', { cursor: '0' })) as { trackPosition: number };
    return s.trackPosition === trackIndex;
  }, 4000, 150);
  let last = '';
  let out: DevList = { devices: [], count: 0 };
  await pollUntil(async () => {
    out = (await req('device.list', { cursor: '0' })) as DevList;
    const names = out.devices.map((d) => d.name).join(',');
    const stable = names === last;
    last = names;
    return stable;
  }, 4000, 200);
  return out;
}

async function selectContainer(trackIndex: number, expect = 'Instrument Layer'): Promise<void> {
  await devicesOn(trackIndex);
  await req('devcursor.selectAt', { deviceIndex: 0 });
  const ok = await pollUntil(async () => {
    const s = (await req('devcursor.status')) as { exists: boolean; name: string };
    return s.exists && s.name === expect;
  }, 6000, 150);
  if (!ok.ok) {
    console.log(`\nREFUSING: cursor is not on "${expect}" — ${JSON.stringify(await req('devcursor.status'))}`);
    process.exit(1);
  }
}

await client.connect();
const tracks = await list();
const lay4 = tracks.find((t) => t.name === 'gn-lay4');
const scratch = tracks.find((t) => t.name === SCRATCH);
if (!lay4 || !scratch) { console.log('REFUSING: run e17-setup first.'); process.exit(1); }

// ==========================================================================
console.log('\n======== VERB CONTROL 1 — `Device.deleteObject()`, the same supertype method');
note('If this fires and the layer call does not, the ○ is about LAYERS rather than about');
note('a verb that is dead everywhere. That distinction is the whole point of the control.');
await devicesOn(scratch.index);
let sd = await devicesOn(scratch.index);
for (let g = 0; g < 8 && sd.count > 0; g++) {
  await req('device.delete', { cursor: '0', deviceIndex: sd.devices[0]!.index });
  const n = sd.count;
  await pollUntil(async () => (await devicesOn(scratch.index)).count < n, 4000, 200);
  sd = await devicesOn(scratch.index);
}
await req('device.insertBitwig', { cursor: '0', uuid: POLYSYNTH });
await pollUntil(async () => (await devicesOn(scratch.index)).count === 1, 8000, 200);
const c1Before = await devicesOn(scratch.index);
const t1 = Date.now();
await req('device.delete', { cursor: '0', deviceIndex: 0 });
const c1Gone = await pollUntil(async () => (await devicesOn(scratch.index)).count < c1Before.count, 5000, 200);
const c1After = await devicesOn(scratch.index);
note(`devices ${c1Before.count} -> ${c1After.count}  (${Date.now() - t1} ms)`);
const control1 = c1Gone.ok;
check('⚠ VERB CONTROL 1: `deleteObject()` DOES fire in this session, on a Device',
  control1, { before: c1Before.count, after: c1After.count });

// ==========================================================================
console.log('\n======== VERB CONTROL 2 — `host.deleteObjects()`, the batch call (E14 row G)');
const slotHas = async (slotIndex: number) =>
  ((await req('slot.status', { trackIndex: scratch.index, slotIndex })) as { hasContent: boolean }).hasContent;
if (!(await slotHas(1))) {
  await req('clip.create', { trackIndex: scratch.index, slotIndex: 1, lengthBeats: 4 });
  await pollUntil(async () => slotHas(1), 4000, 200);
}
check('PRECONDITION: a clip exists at slot 1 to be deleted', await slotHas(1), {});
const t2 = Date.now();
await req('ui.deleteObjects', { targets: [{ trackIndex: scratch.index, slotIndex: 1 }] });
const c2Gone = await pollUntil(async () => !(await slotHas(1)), 5000, 200);
note(`slot 1 emptied: ${c2Gone.ok}  (${Date.now() - t2} ms)`);
const control2 = c2Gone.ok;
check('⚠ VERB CONTROL 2: `host.deleteObjects()` DOES fire in this session, on a clip slot',
  control2, { emptied: c2Gone.ok });

// ==========================================================================
console.log('\n======== THE ROW — three routes at a layer, precondition proved each time');
await selectContainer(lay4.index);
const start = await layers();
note(`gn-lay4: count=${start.count}  ${shapeOf(start)}`);
note(`⚠ chain channelIds: ${start.layers.map((x) => `${x.index}:${String(x.channelId).slice(0, 8)}`).join(' ')}`);
check('PRECONDITION: four chains, each with a DISTINCT device, so a survivor is NAMED',
  start.count === 4 && new Set(namesOf(start)).size === 4, { shape: namesOf(start) });

interface Attempt { route: string; before: number; after: number; worked: boolean; ms: number }
const attempts: Attempt[] = [];

async function tryDelete(route: string, layerIndex: number, pre?: () => Promise<void>): Promise<Attempt> {
  await selectContainer(lay4!.index);
  const b = await layers();
  const victim = b.layers.find((x) => x.index === layerIndex);
  // ⚠ Name the victim before the act — after a delete the bank re-indexes and a
  // read taken afterwards describes whatever slid into the slot (E3, e16t).
  note(`${route}: target chain ${layerIndex} = [${victim?.devices.map((d) => d.name).join('+')}]`
    + ` id=${String(victim?.channelId).slice(0, 8)}`);
  if (pre) { await pre(); }
  const t = Date.now();
  await req(route.startsWith('via host') ? 'layer.deleteViaHost' : 'layer.delete', { layerIndex });
  const gone = await pollUntil(async () => {
    await selectContainer(lay4!.index);
    return (await layers()).count < b.count;
  }, 5000, 250);
  await selectContainer(lay4!.index);
  const a = await layers();
  note(`   ${b.count} -> ${a.count}   ${shapeOf(a)}   (${Date.now() - t} ms)`);
  const r = { route, before: b.count, after: a.count, worked: gone.ok, ms: Date.now() - t };
  attempts.push(r);
  return r;
}

const r1 = await tryDelete('layer.delete (deleteObject)', 1);
const r2 = r1.worked ? r1 : await tryDelete('via host.deleteObjects', 1);
const r3 = r2.worked ? r2 : await tryDelete('layer.delete after layer.select', 1, async () => {
  // ⚠ Route 3: make the chain the UI selection first. `selectInEditor` is not
  // deprecated; `DeviceChain.select()` IS, and is deliberately not wired (rule 9).
  const sel = await req('layer.select', { layerIndex: 1, where: 'editor' });
  note(`   layer.select -> ${JSON.stringify(sel)}`);
  await new Promise((x) => setTimeout(x, 600));
});
const r4 = r3.worked ? r3 : await tryDelete('via host.deleteObjects after layer.select', 1, async () => {
  await req('layer.select', { layerIndex: 1, where: 'mixer' });
  await new Promise((x) => setTimeout(x, 600));
});

const deleteWorks = attempts.some((a) => a.worked);
check('⚠ THE ROW: a DeviceLayer chain can be deleted', deleteWorks,
  { routes: attempts.map((a) => `${a.route}=${a.worked ? '●' : '○'}`) });

// ==========================================================================
console.log('\n-- cleanup');
for (let g = 0; g < 8; g++) {
  const d = await devicesOn(scratch.index);
  if (d.count === 0) break;
  await req('device.delete', { cursor: '0', deviceIndex: d.devices[0]!.index });
  await pollUntil(async () => (await devicesOn(scratch.index)).count < d.count, 4000, 200);
}
await selectContainer(lay4.index);
note(`gn-lay4 final: ${shapeOf(await layers())}`);

// ==========================================================================
console.log('\n======== VERDICT');
console.log(`  VERB CONTROL 1  Device.deleteObject()          ${control1 ? '●' : '○'}`);
console.log(`  VERB CONTROL 2  host.deleteObjects() on a slot ${control2 ? '●' : '○'}`);
for (const a of attempts) {
  console.log(`  ROUTE           ${a.route.padEnd(38)} ${a.before} -> ${a.after}  ${a.worked ? '●' : '○'}`);
}
if (!control1 || !control2) {
  note('⚠ INCONCLUSIVE: a verb control failed, so this run says nothing about layers.');
} else if (deleteWorks) {
  note('⚠⚠ DELETE WORKS — the minimum viable unlock is real. Read the counts before believing it.');
} else {
  note('⇒ ⚠ DELETE IS ○, on THREE routes, with BOTH verb controls firing in the same run and');
  note('  the precondition proved before every call. `DeviceLayer` declares');
  note('  `DeleteableObject` and does not honour it.');
  note('');
  note('⚠ And note the DIRECTION, because it is the opposite of the file format. E10c/E10d');
  note('  found chains REMOVABLE but not insertable offline. Live, they are neither. So the');
  note('  two layers of the product do NOT agree, and the offline trim is a capability the');
  note('  live API simply does not expose — which makes `bwmod` the only route to a chain');
  note('  count, and makes it an OFFLINE-ONLY one.');
}

console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} checks reported a negative — read them individually`);
process.exit(0);
