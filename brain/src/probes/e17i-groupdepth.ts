/**
 * E17 row 1, follow-up — `Group` CREATES a chain. Now: can it create a SECOND
 * one, and does `Ungroup` take one away?
 *
 * ⚠ **`e17d` overturned E4d route 7.** With the device panel focused and a device
 * selected via `device.selectInEditor`, the named action `Group` turned
 * `[Polysynth, Polysynth]` into `[Instrument Layer, Polysynth]` with the layer
 * reporting **1 chain**. A chain came into existence programmatically. E4e's
 * reasoned negative is intact as far as the TYPED API goes — no `InsertionPoint`
 * creates a chain, and `e17c` re-confirmed that against two more mechanisms —
 * but the named-action escape hatch does what the typed surface cannot. That is
 * the second time a "no named action does this" ○ has fallen to E16j's shape.
 *
 * **But one chain is not a branch.** A take model needs at least two, and it
 * needs to throw one away. `e17f` established that a chain cannot be DELETED —
 * four routes, both verb controls firing. So this probe asks the only two
 * questions that can still change the session's answer:
 *
 *   Q1  can a SECOND chain be added to a container that already has one?
 *       Without this, `Group` makes a box with one thing in it and no way to
 *       put a sibling beside it — useless for A/B.
 *   Q2  does `Ungroup` dissolve a container? That is the missing counterpart to
 *       creation, and if it works it is a coarse revert: not "delete chain 1"
 *       but "throw the whole container away", which is still §4.2's
 *       revert-by-delete one level down.
 *
 * ⚠ Three ways to attempt Q1, because sibling verbs disagree in this API and a
 * single-mechanism ○ here would be the sixth false negative of that shape:
 *   a  select a top-level device NEXT TO the container and fire `Group`
 *   b  select ALL devices (`Select All` with the device panel focused) and fire
 *      `Group` once — Bitwig's own multi-device gesture
 *   c  select the CONTAINER and fire `Group` again — does it nest, or grow?
 *
 * ⚠ Foreground is a PRECONDITION, not a hope. `e17d` failed twice with Bitwig
 * backgrounded and succeeded once it was frontmost; `Create Group Track` (a
 * Project action) fires either way, which is exactly why E16j did not catch
 * this. So this probe proves the device-panel dispatch path works BEFORE it
 * reads anything, by reproducing `e17d`'s own ● as its precondition.
 *
 * ⚠ Every fire is followed by a track-list diff and orphans are reaped by
 * channelId (E6 blocker 3 / E16j's seven orphans).
 *
 * Silent: nothing is launched and the transport is never touched.
 */
import { client, check, note, failureCount, pollUntil } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);

const POLYSYNTH = 'a9ffacb5-33e9-4fc7-8621-b1af31e410ef';
const ORGAN = 'f2dcfe9a-7b66-4c84-984a-b25685a1c21a';
const PHASE4 = '252723bf-68a6-4ee6-81f8-95ba4d0fb467';
const SUBJECT = 'gn-A';
const FOCUS_DEVICES = 'focus_or_toggle_device_panel';

interface TrackRow { index: number; name: string; type: string; channelId: string }
const list = async () => (await req('track.list')) as { tracks: TrackRow[]; count: number };
interface DevList { devices: { index: number; name: string }[]; count: number }
interface LayerRow { index: number; name: string; devices: { name: string }[] }
interface LayerList { layers: LayerRow[]; count: number; cursorDeviceName?: string }
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

await client.connect();
const baseline = await list();
const baseIds = new Set(baseline.tracks.map((t) => t.channelId));
const subject = baseline.tracks.find((t) => t.name === SUBJECT);
if (!subject) { console.log(`REFUSING: ${SUBJECT} not found.`); process.exit(1); }

async function reapOrphans(where: string): Promise<string[]> {
  const made: string[] = [];
  for (let g = 0; g < 10; g++) {
    const now = await list();
    const orphan = now.tracks.find((t) => !baseIds.has(t.channelId));
    if (!orphan) break;
    made.push(orphan.name);
    await req('track.delete', { trackIndex: orphan.index });
    await pollUntil(async () => !(await list()).tracks.some((t) => t.channelId === orphan.channelId), 4000, 200);
  }
  if (made.length > 0) note(`⚠ ${where}: reaped ${made.length} orphan track(s): ${made.join(', ')}`);
  return made;
}

async function clearSubject(): Promise<void> {
  for (let g = 0; g < 12; g++) {
    const d = await devicesOn(subject!.index);
    if (d.count === 0) break;
    await req('device.delete', { cursor: '0', deviceIndex: d.devices[0]!.index });
    await pollUntil(async () => (await devicesOn(subject!.index)).count < d.count, 4000, 200);
  }
}

async function insert(uuid: string, name: string): Promise<void> {
  const before = await devicesOn(subject!.index);
  await req('device.insertBitwig', { cursor: '0', uuid });
  const ok = await pollUntil(async () => (await devicesOn(subject!.index)).count > before.count, 8000, 200);
  if (!ok.ok) { console.log(`REFUSING: ${name} did not insert.`); process.exit(1); }
}

/** Chains reported by the container at deviceIndex, with the cursor proved on it. */
async function chainsOf(deviceIndex: number, expectName: string): Promise<LayerList> {
  await devicesOn(subject!.index);
  await req('devcursor.selectAt', { deviceIndex });
  await pollUntil(async () => {
    const s = (await req('devcursor.status')) as { exists: boolean; name: string };
    return s.exists && s.name === expectName;
  }, 6000, 150);
  return (await req('layer.list')) as LayerList;
}

/** Focus the device panel, select a device by index, fire an action. */
async function fireOnDevice(actionId: string, deviceIndex: number, alsoSelectAll = false): Promise<void> {
  await devicesOn(subject!.index);
  await req('device.selectInEditor', { deviceIndex });
  await req('app.invokeAction', { id: FOCUS_DEVICES });
  await new Promise((r) => setTimeout(r, 400));
  // ⚠ Re-assert AFTER focusing: focusing a panel can move the selection into it,
  // and firing against a selection we merely assumed is E6 blocker 3.
  await req('device.selectInEditor', { deviceIndex });
  await new Promise((r) => setTimeout(r, 300));
  if (alsoSelectAll) {
    await req('app.invokeAction', { id: 'Select All' });
    await new Promise((r) => setTimeout(r, 400));
  }
  await req('app.invokeAction', { id: actionId });
  await new Promise((r) => setTimeout(r, 1800));
}

// ==========================================================================
console.log('\n======== PRECONDITION — reproduce e17d\'s ●, so dispatch is proved not hoped');
note('⚠ e17d failed twice with Bitwig BACKGROUNDED and succeeded once it was frontmost.');
note('`Create Group Track` (Project) fires either way, which is why E16j never caught this.');
await clearSubject();
await insert(POLYSYNTH, 'Polysynth');
await insert(ORGAN, 'Organ');
const p0 = await devicesOn(subject.index);
note(`${SUBJECT}: [${p0.devices.map((d) => d.name).join(', ')}]`);
await fireOnDevice('Group', 0);
const p1 = await devicesOn(subject.index);
await reapOrphans('precondition');
note(`after Group on device 0: [${p1.devices.map((d) => d.name).join(', ')}]`);
const wrapped = p1.devices[0]?.name === 'Instrument Layer';
check('PRECONDITION: `Group` wraps the selected device — the device-panel dispatch path'
  + ' works right now (e17d, reproduced)',
  wrapped, { before: p0.devices.map((d) => d.name), after: p1.devices.map((d) => d.name) });
if (!wrapped) {
  console.log('\nREFUSING: dispatch is not working. Bring Bitwig to the FOREGROUND and re-run —');
  console.log('everything below reads as ○ for an environmental reason otherwise.');
  process.exit(1);
}
const c1 = await chainsOf(0, 'Instrument Layer');
note(`the new container holds ${c1.count} chain(s): ${shapeOf(c1)}`);
check('⚠ and the wrap CREATED A CHAIN — E4d route 7 and E4e\'s practical reach are wrong',
  c1.count >= 1, { count: c1.count, shape: shapeOf(c1) });

// ==========================================================================
console.log('\n======== Q1a — group the NEIGHBOURING device: does it join as a second chain?');
const before1a = await chainsOf(0, 'Instrument Layer');
const devs1a = await devicesOn(subject.index);
note(`before: devices=[${devs1a.devices.map((d) => d.name).join(', ')}]  chains=${before1a.count}`);
// device 1 is the Organ, still at top level next to the container.
await fireOnDevice('Group', 1);
await reapOrphans('Q1a');
const devs1aAfter = await devicesOn(subject.index);
const after1a = await chainsOf(0, 'Instrument Layer');
note(`after:  devices=[${devs1aAfter.devices.map((d) => d.name).join(', ')}]  chains=${after1a.count}`);
note(`        ${shapeOf(after1a)}`);
const q1a = after1a.count > before1a.count;
check('⚠ Q1a: grouping a neighbouring device adds a SECOND chain to the existing container',
  q1a, { chainsBefore: before1a.count, chainsAfter: after1a.count,
    devices: devs1aAfter.devices.map((d) => d.name) });

// ==========================================================================
console.log('\n======== Q1b — `Select All` in the device panel, then ONE `Group`');
note('Bitwig\'s own multi-device gesture. If a container can only ever be born holding');
note('everything selected at once, that still gives N chains in one call — which is all a');
note('take model needs, provided N can be chosen.');
await clearSubject();
await insert(POLYSYNTH, 'Polysynth');
await insert(ORGAN, 'Organ');
await insert(PHASE4, 'Phase-4');
const b1b = await devicesOn(subject.index);
note(`before: [${b1b.devices.map((d) => d.name).join(', ')}]`);
await fireOnDevice('Group', 0, /* alsoSelectAll */ true);
await reapOrphans('Q1b');
const a1b = await devicesOn(subject.index);
note(`after:  [${a1b.devices.map((d) => d.name).join(', ')}]`);
let q1bChains = 0;
if (a1b.devices[0]?.name === 'Instrument Layer') {
  const c = await chainsOf(0, 'Instrument Layer');
  q1bChains = c.count;
  note(`        container holds ${c.count} chain(s): ${shapeOf(c)}`);
}
// ⚠ Two very different successes, and they are NOT the same capability:
//   3 chains  = one chain per device, which IS a take container
//   1 chain   = all three in SERIES, which is a utility wrapper and no use for A/B
const q1b = q1bChains >= 2;
check('⚠ Q1b: `Select All` + `Group` produces a MULTI-CHAIN container (not one chain'
  + ' holding everything in series)',
  q1b, { chains: q1bChains, devices: a1b.devices.map((d) => d.name) });

// ==========================================================================
console.log('\n======== Q1c — group the CONTAINER itself: nest, or grow?');
const b1c = a1b.devices[0]?.name === 'Instrument Layer' ? await chainsOf(0, 'Instrument Layer') : null;
if (b1c) {
  await fireOnDevice('Group', 0);
  await reapOrphans('Q1c');
  const a1cDevs = await devicesOn(subject.index);
  const a1c = await chainsOf(0, 'Instrument Layer');
  note(`after grouping the container: [${a1cDevs.devices.map((d) => d.name).join(', ')}]`);
  note(`        outer container holds ${a1c.count} chain(s): ${shapeOf(a1c)}`);
  check('Q1c: grouping the container NESTS it rather than growing it (expected)',
    a1c.count >= 1, { before: b1c.count, after: a1c.count });
}

// ==========================================================================
console.log('\n======== Q2 — does `Ungroup` DISSOLVE a container? (the missing counterpart)');
note('⚠ `e17f` proved a chain cannot be deleted, on four routes with both verb controls');
note('firing. If `Ungroup` dissolves the container, there is still a coarse discard — not');
note('"delete chain 1" but "throw the box away" — which is §4.2\'s revert-by-delete one');
note('level down, and it would keep the layer model alive.');
await clearSubject();
await insert(POLYSYNTH, 'Polysynth');
await fireOnDevice('Group', 0);
await reapOrphans('Q2 setup');
const b2 = await devicesOn(subject.index);
check('PRECONDITION: there is a container to ungroup',
  b2.devices[0]?.name === 'Instrument Layer', { devices: b2.devices.map((d) => d.name) });
const b2chains = b2.devices[0]?.name === 'Instrument Layer' ? (await chainsOf(0, 'Instrument Layer')).count : 0;
note(`before Ungroup: [${b2.devices.map((d) => d.name).join(', ')}]  chains=${b2chains}`);
await fireOnDevice('Ungroup', 0);
await reapOrphans('Q2');
const a2 = await devicesOn(subject.index);
note(`after Ungroup:  [${a2.devices.map((d) => d.name).join(', ')}]`);
const q2 = a2.devices[0]?.name !== 'Instrument Layer' && a2.count > 0;
check('⚠ Q2: `Ungroup` dissolves the container and returns its contents to the parent chain',
  q2, { before: b2.devices.map((d) => d.name), after: a2.devices.map((d) => d.name) });

// ==========================================================================
console.log('\n-- cleanup');
await clearSubject();
await reapOrphans('cleanup');
const final = await list();
check('cleanup: the track list is back to its baseline identities',
  final.tracks.every((t) => baseIds.has(t.channelId)) && final.count === baseline.count,
  { before: baseline.count, after: final.count });

// ==========================================================================
console.log('\n======== VERDICT');
console.log(`  Group creates a container WITH A CHAIN        ● (e17d, reproduced)`);
console.log(`  Q1a  a neighbour joins as a second chain      ${q1a ? '●' : '○'}`);
console.log(`  Q1b  Select All + Group ⇒ multi-chain         ${q1b ? '●' : `○ (${q1bChains} chain)`}`);
console.log(`  Q2   Ungroup dissolves the container          ${q2 ? '●' : '○'}`);
console.log(`  (delete ONE chain: ○ on four routes, e17f)`);
if (q1a || q1b) {
  note('⇒ ⚠ Layer containers CAN be grown after all — via a named action, not the typed API.');
  note('  Combined with Ungroup that is a create/discard pair, and the layer model is back');
  note('  in play with the hazard rule 6 names: it acts on the UI selection.');
} else if (q2) {
  note('⇒ A container can be CREATED (1 chain) and DISSOLVED, but never grown to two. One');
  note('  chain is not a branch, so this is a device WRAPPER, not a take container.');
} else {
  note('⇒ `Group` makes a one-chain container that cannot grow and cannot be dissolved.');
  note('  Every way of getting a SECOND chain remains preset-only (E4d route 4), and');
  note('  nothing can remove one. Layers are fixed-shape containers, full stop.');
}

console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} checks reported a negative — read them individually`);
process.exit(0);
