/**
 * E17 rows 2+3 — ⚠⚠ `Channel.duplicate()` CREATES A CHAIN. Which variable decides?
 *
 * ⚠⚠ **`e17ai` overturned the typed ○, and the operator predicted it**: *"those are
 * the ones that really seem like they should have worked from the start."*
 *
 *     FX Layer, chain EMPTY      → Channel.duplicate()  ○ nothing
 *     FX Layer, chain POPULATED  → Channel.duplicate()  ●● chains 1→2, a FULL copy
 *
 * Same call, same container, same session, full inventory, verb control passing, no
 * throw. **A device chain can be created by a TYPED call.**
 *
 * ⚠ But `e17b` tested a POPULATED chain too — on `gn-lay`'s **Instrument Layer** —
 * and recorded ○. So two variables are confounded and only one has been varied:
 *
 *   |                   | empty chain | populated chain |
 *   |-------------------|-------------|-----------------|
 *   | FX Layer          | ○ measured  | ⚠ ● measured    |
 *   | Instrument Layer  | n/a (ships with 0 chains) | ⚠ e17b said ○ — UNVERIFIED |
 *
 * **That last cell is the whole question.** If a populated Instrument Layer chain
 * also duplicates, chain creation is **fully autonomous** and E17's "human click
 * required" conclusion collapses for CREATE. If it does not, the capability is
 * FX-Layer-only — which still matters, because §6's use case is the Master and the
 * FX returns, where an FX Layer is exactly what you would use.
 *
 * ⚠ **`DeviceLayer.duplicateObject()` is swept alongside** — it read ○ in both
 * `e17ai` cells, so it may be genuinely dead where `Channel.duplicate()` is not.
 * Two verbs that were always reported together turn out to differ.
 *
 * ⚠ **DELETE is re-tested too.** `e17f` recorded `deleteObject()`/`deleteObjects()`
 * as refusing, measured on Instrument Layer chains. If "populated" or "container
 * type" is the variable for duplicate, it may be for delete as well — and delete is
 * the other half of the branch lifecycle.
 *
 * ⚠ Populated Instrument Layer chains cannot be built typed (that is the very
 * capability in question), so `gn-lay4` is used for those cells and every change is
 * undone. Its four chains are named and distinct, so a survivor is always NAMED.
 *
 * Typed-only: no named actions, no focus, no priming, no foreground. `app.undo` is
 * the only action, used solely to restore.
 */
import { client, check, note, failureCount, pollUntil } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);

const SCRATCH = 'gn-B';
const POPULATED_INST = 'gn-lay4';
const FX_LAYER = 'a0913b7f-096b-4ac9-bddd-33c775314b42';
const INSTRUMENT_LAYER = '5024be2e-65d6-4d40-bbfe-8b2ea993c445';
const POLYSYNTH = 'a9ffacb5-33e9-4fc7-8621-b1af31e410ef';

interface TrackRow { index: number; name: string; type: string; channelId: string }
interface DevList { devices: { index: number; name: string }[]; count: number; itemCount: number }
interface LayerList { layers: { index: number; name: string; devices: { name: string }[] }[]; count: number }

await client.connect();
const tracks0 = ((await req('track.list')) as { tracks: TrackRow[] }).tracks;
const baseTrackIds = tracks0.map((t) => t.channelId).sort().join(',');
function only(name: string): TrackRow {
  const m = tracks0.filter((t) => t.name === name);
  if (m.length !== 1) { console.log(`\n⚠⚠ REFUSING: ${m.length} tracks named ${name}.`); process.exit(1); }
  return m[0]!;
}
const scratch = only(SCRATCH);
const populated = only(POPULATED_INST);

async function pointAt(t: TrackRow): Promise<void> {
  const now = ((await req('track.list')) as { tracks: TrackRow[] }).tracks;
  const cur = now.find((x) => x.channelId === t.channelId);
  if (!cur) { console.log(`\n⚠⚠ ABORTING: ${t.name} is GONE.`); process.exit(1); }
  await req('cursor.pointTrack', { cursor: '0', trackIndex: cur.index });
  await pollUntil(async () => {
    const s = (await req('cursor.status', { cursor: '0' })) as { trackPosition: number };
    return s.trackPosition === cur.index;
  }, 4000, 150);
  await new Promise((r) => setTimeout(r, 250));
}
async function devs(): Promise<DevList> {
  let last = '';
  let out: DevList = { devices: [], count: 0, itemCount: 0 };
  await pollUntil(async () => {
    out = (await req('device.list', { cursor: '0' })) as DevList;
    const n = out.devices.map((d) => d.name).join(',');
    const stable = n === last; last = n; return stable;
  }, 4000, 200);
  return out;
}
async function scopeTo(expect: RegExp, tag: string): Promise<void> {
  const d = await devs();
  const at = d.devices.findIndex((x) => expect.test(x.name));
  if (at < 0) { console.log(`\n⚠⚠ ABORTING at ${tag}: no ${expect} — [${d.devices.map((x) => x.name).join(', ')}]`); process.exit(1); }
  await req('devcursor.selectAt', { deviceIndex: at });
  const ok = await pollUntil(async () => {
    const s = (await req('devcursor.status')) as { exists: boolean; name: string };
    return s.exists && expect.test(s.name);
  }, 6000, 150);
  if (!ok.ok) { console.log(`\n⚠⚠ ABORTING at ${tag}: cursor did not land.`); process.exit(1); }
}
interface Inv { trackIds: string; devices: string[]; chains: string[]; inChain: number }
async function inv(t: TrackRow, expect: RegExp, tag: string): Promise<Inv> {
  const tl = ((await req('track.list')) as { tracks: TrackRow[] }).tracks;
  await pointAt(t);
  const d = await devs();
  await scopeTo(expect, tag);
  const l = (await req('layer.list')) as LayerList;
  return {
    trackIds: tl.map((x) => x.channelId).sort().join(','),
    devices: d.devices.map((x) => x.name),
    chains: l.layers.map((x) => `${x.name}[${x.devices.map((y) => y.name).join('+') || '—'}]`),
    inChain: l.layers.reduce((n, x) => n + x.devices.length, 0),
  };
}
const show = (i: Inv) => `devices=[${i.devices.join(',')}] chains=${i.chains.length} [${i.chains.join(' ')}]`;

interface Cell { label: string; created: boolean; removed: boolean; threw: string | null; detail: string }
const cells: Cell[] = [];

async function tryVerb(label: string, method: string, t: TrackRow, expect: RegExp,
  layerIndex = 0): Promise<Cell> {
  const before = await inv(t, expect, `${label} before`);
  console.log(`\n  ${label}`);
  note(`   BEFORE ${show(before)}`);
  if (before.chains.length === 0) {
    console.log('   ⚠⚠ SKIPPED: zero chains, so `getItemAt(0)` has no referent (the e16o trap).');
    const c: Cell = { label: `${label} [SKIPPED: no referent]`, created: false, removed: false, threw: null, detail: '' };
    cells.push(c); return c;
  }
  await scopeTo(expect, `${label} at-call`);
  let threw: string | null = null;
  try { await req(method, { layerIndex }); } catch (e) {
    threw = e instanceof Error ? e.message : String(e);
    note(`   ⚠ THREW: ${threw}`);
  }
  await pollUntil(async () => {
    const n = await inv(t, expect, `${label} poll`);
    return n.chains.length !== before.chains.length || n.devices.length !== before.devices.length
      || n.inChain !== before.inChain;
  }, 4000, 300);
  const after = await inv(t, expect, `${label} after`);
  note(`   AFTER  ${show(after)}`);
  const created = after.chains.length > before.chains.length;
  const removed = after.chains.length < before.chains.length;
  console.log(`   ⇒ Δchains=${after.chains.length - before.chains.length}`
    + `  Δdevices=${after.devices.length - before.devices.length}`
    + `   ${created ? '●● CHAIN CREATED' : removed ? '●● CHAIN REMOVED' : '○ nothing'}`);
  if (after.trackIds !== before.trackIds) { console.log('\n⚠⚠ ABORTING: the track list changed.'); process.exit(1); }
  const c: Cell = { label, created, removed, threw, detail: after.chains.join(' ') };
  cells.push(c);
  // ⚠ Restore immediately — `app.undo` is the only route, since delete may refuse.
  if (created || removed) {
    for (let g = 0; g < 6; g++) {
      const now = await inv(t, expect, `${label} undo`);
      if (now.chains.length === before.chains.length) break;
      await req('app.undo'); await new Promise((r) => setTimeout(r, 1600));
    }
    const back = await inv(t, expect, `${label} restored`);
    if (back.chains.join() !== before.chains.join()) {
      console.log(`\n⚠⚠ ABORTING: undo did not restore — [${back.chains.join(' ')}]`); process.exit(1);
    }
    note('   restored');
  }
  return c;
}

async function clearScratch(): Promise<void> {
  await pointAt(scratch);
  for (let g = 0; g < 14; g++) {
    const d = await devs();
    if (d.count === 0) break;
    await req('device.delete', { cursor: '0', deviceIndex: d.devices[0]!.index });
    await pollUntil(async () => (await devs()).count < d.count, 4000, 200);
  }
}

// ==========================================================================
console.log('');
console.log('='.repeat(74));
console.log(' ⚠⚠ THE 2×2 — does CONTAINER TYPE or CHAIN CONTENTS decide?');
console.log('='.repeat(74));

// ---- FX LAYER, populated: reproduce e17ai's ● first, so the rest is bracketed.
console.log('\n======== CELL 1 — FX Layer, POPULATED chain (reproduce e17ai)');
await clearScratch();
await req('device.insertBitwig', { cursor: '0', uuid: FX_LAYER });
await pollUntil(async () => (await devs()).devices.some((d) => /FX Layer/.test(d.name)), 8000, 200);
await scopeTo(/FX Layer/, 'cell1 fill');
await req('layer.insertDevice', { layerIndex: 0, uuid: POLYSYNTH });
await pollUntil(async () => {
  await scopeTo(/FX Layer/, 'cell1 fill poll');
  return ((await req('layer.list')) as LayerList).layers.reduce((n, x) => n + x.devices.length, 0) > 0;
}, 8000, 250);
const c1 = await tryVerb('CELL 1  Channel.duplicate()      FX Layer / POPULATED',
  'layer.duplicateChannel', scratch, /FX Layer/);
const c1b = await tryVerb('CELL 1b DeviceLayer.duplicateObject()  FX Layer / POPULATED',
  'layer.duplicate', scratch, /FX Layer/);

// ---- FX LAYER, empty
console.log('\n======== CELL 2 — FX Layer, EMPTY chain');
await clearScratch();
await req('device.insertBitwig', { cursor: '0', uuid: FX_LAYER });
await pollUntil(async () => (await devs()).devices.some((d) => /FX Layer/.test(d.name)), 8000, 200);
const c2 = await tryVerb('CELL 2  Channel.duplicate()      FX Layer / EMPTY',
  'layer.duplicateChannel', scratch, /FX Layer/);

// ---- INSTRUMENT LAYER, populated — ⚠ THE DECIDING CELL
console.log('\n======== ⚠⚠ CELL 3 — Instrument Layer, POPULATED chain (THE DECIDER)');
note(`using ${POPULATED_INST}; a populated Instrument Layer cannot be built typed —`);
note('that is the very capability under test. Every change is undone.');
const c3 = await tryVerb('CELL 3  Channel.duplicate()      Instrument Layer / POPULATED',
  'layer.duplicateChannel', populated, /Instrument Layer/);
const c3b = await tryVerb('CELL 3b DeviceLayer.duplicateObject()  Instrument Layer / POPULATED',
  'layer.duplicate', populated, /Instrument Layer/);

// ---- DELETE, re-tested against the same two variables
console.log('\n======== ⚠ DELETE re-tested — is `deleteObject()` also contents-dependent?');
await clearScratch();
await req('device.insertBitwig', { cursor: '0', uuid: FX_LAYER });
await pollUntil(async () => (await devs()).devices.some((d) => /FX Layer/.test(d.name)), 8000, 200);
await scopeTo(/FX Layer/, 'del fill');
await req('layer.insertDevice', { layerIndex: 0, uuid: POLYSYNTH });
await pollUntil(async () => {
  await scopeTo(/FX Layer/, 'del fill poll');
  return ((await req('layer.list')) as LayerList).layers.reduce((n, x) => n + x.devices.length, 0) > 0;
}, 8000, 250);
// Grow to two chains first, so a delete has something to remove without emptying it.
await req('layer.duplicateChannel', { layerIndex: 0 });
await pollUntil(async () => {
  await scopeTo(/FX Layer/, 'del grow poll');
  return ((await req('layer.list')) as LayerList).count >= 2;
}, 6000, 250);
const d1 = await tryVerb('DELETE  DeviceLayer.deleteObject()   FX Layer / POPULATED',
  'layer.delete', scratch, /FX Layer/, 1);
const d2 = await tryVerb('DELETE  host.deleteObjects()         FX Layer / POPULATED',
  'layer.deleteViaHost', scratch, /FX Layer/, 1);

console.log('\n-- cleanup');
await clearScratch();
const endTracks = ((await req('track.list')) as { tracks: TrackRow[] }).tracks;
check(`${SCRATCH} is empty`, (await devs()).count === 0, {});
check('the TRACK LIST is untouched', endTracks.map((t) => t.channelId).sort().join(',') === baseTrackIds, {});
const finalPop = await inv(populated, /Instrument Layer/, 'final');
check(`${POPULATED_INST} is back to its 4 chains`, finalPop.chains.length === 4,
  { chains: finalPop.chains });

// ==========================================================================
console.log(`\n${'='.repeat(74)}`);
console.log(' THE MATRIX');
for (const c of cells) {
  const mark = c.created ? '●●' : c.removed ? '●●' : '○ ';
  console.log(`  ${mark} ${c.label}${c.threw ? '  ⚠ THREW' : ''}`);
}
console.log('='.repeat(74));
console.log('');
const fxPop = c1.created, fxEmpty = c2.created, instPop = c3.created;
if (fxPop && instPop) {
  note('⚠⚠⚠ CONTENTS is the variable, not container type. `Channel.duplicate()` creates a');
  note('  chain on BOTH container types whenever the source chain is POPULATED.');
  note('  ⇒ CHAIN CREATION IS FULLY AUTONOMOUS — typed, no focus, no human click.');
  note('  ⇒ E17 row 2/3 flip to ●, and the autonomy objection collapses for CREATE.');
  note(`  ⚠ DELETE remains ${d1.removed || d2.removed ? '● TOO — the lifecycle is complete'
    : '○ typed — still named-actions-only, so DESTROY is the remaining gap'}.`);
} else if (fxPop && !instPop) {
  note('⚠⚠ CONTAINER TYPE is the variable. `Channel.duplicate()` creates a chain in an');
  note('  FX Layer but not an Instrument Layer. ⇒ `e17b` was right about Instrument');
  note('  Layers and wrong as a general claim.');
  note('  ⚠ This still matters a great deal: §6\'s use case is the MASTER and the FX');
  note('  RETURNS, where an FX Layer is exactly the container you would use — so the');
  note('  A/B fixture there could be built and grown AUTONOMOUSLY.');
} else if (!fxPop) {
  note('⚠ CELL 1 did not reproduce e17ai\'s ●. Do not record anything from this run —');
  note('  the effect is not stable and needs isolating before any claim rests on it.');
}
if (fxEmpty) note('⚠ and it works on an EMPTY chain too, so contents are not required after all.');
console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} checks reported a negative — read individually`);
process.exit(0);
