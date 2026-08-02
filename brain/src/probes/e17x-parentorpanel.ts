/**
 * E17 — when a chain is selected and `Duplicate` copies the CONTAINER, which
 * object actually decided that?
 *
 * ⚠ **The ambiguity `e17v` cannot resolve, by construction.** `e17v` arm 1 set the
 * chain selection to Phase-4, VERIFIED it read back Phase-4 at the instant of
 * firing, fired `Duplicate`, and the CONTAINER was duplicated. Two different
 * mechanisms predict exactly that, and `gn-lay4` holds only ONE device so nothing
 * in that fixture can tell them apart:
 *
 *   A. the device panel IGNORED our chain selection and acted on its current
 *      DEVICE, which on a one-device track is necessarily the container; or
 *   B. the device panel CONSUMED our chain selection and coarsened it to the
 *      chain's PARENT.
 *
 * ⚠ These are very different findings. Under A the chain selection is inert to
 * actions and §1a survives reworded. Under B the chain selection IS reaching the
 * action — it is merely resolving one level too high — and rows 3/4 are a much
 * more live prospect, because the gap is a granularity bug rather than a wall.
 *
 * **The discriminator is a second, DISTINGUISHABLE device on the same track.**
 * Put an Organ after the container, point the panel at the ORGAN, select a chain
 * INSIDE the container, and fire:
 *
 *   the ORGAN is duplicated      ⇒ A. the panel's current device wins; the chain
 *                                  selection contributed nothing
 *   the CONTAINER is duplicated  ⇒ B. ⚠ our chain selection BEAT the panel's
 *                                  current device — it is consumed, at the wrong
 *                                  granularity. Rows 3/4 must be re-argued.
 *
 * ⚠ Two controls bracket it, both in the same sitting:
 *   - panel on the Organ, NO chain selection  → must duplicate the Organ, else the
 *     `selectInEditor` steering (e17t) is not live today and nothing is readable.
 *   - the container reference, before and after → the gate, per e17v's lesson.
 *
 * ⚠ NEEDS BITWIG FOREGROUND FOR THE WHOLE RUN. Per the operator's standing
 * instruction (2026-08-01) this must be ARRANGED, never started opportunistically:
 * `e17v`'s first attempt passed its control at 47 s, lost the gate when the
 * operator alt-tabbed, and voided every arm after it.
 *
 * Silent: nothing is launched and the transport is never touched.
 */
import { client, check, note, failureCount, pollUntil } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);

const SUBJECT = 'gn-lay4';
const ORGAN = 'f2dcfe9a-7b66-4c84-984a-b25685a1c21a';
const FOCUS_DEVICES = 'focus_or_toggle_device_panel';
const FOCUS_LAUNCHER = 'focus_or_toggle_clip_launcher';

interface TrackRow { index: number; name: string; type: string; channelId: string }
const list = async () => (await req('track.list')) as { tracks: TrackRow[]; count: number };
interface DevList { devices: { index: number; name: string }[]; count: number; itemCount: number }
interface LayerList { layers: { index: number; name: string; devices: { name: string }[] }[]; count: number }
interface Nesting { cursorLayerExists?: boolean | string; cursorLayerName?: string; name?: string }

await client.connect();
const baseline = await list();
const baseIds = new Set(baseline.tracks.map((t) => t.channelId));
const subject = baseline.tracks.find((t) => t.name === SUBJECT);
if (!subject) { console.log(`REFUSING: ${SUBJECT} not found.`); process.exit(1); }

async function pointAt(trackIndex: number): Promise<void> {
  await req('cursor.pointTrack', { cursor: '0', trackIndex });
  await pollUntil(async () => {
    const s = (await req('cursor.status', { cursor: '0' })) as { trackPosition: number };
    return s.trackPosition === trackIndex;
  }, 4000, 150);
  await new Promise((r) => setTimeout(r, 350));
}

async function devices(): Promise<DevList> {
  await pointAt(subject!.index);
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
const shapeOf = (d: DevList) => `[${d.devices.map((x) => x.name).join(', ')}]`;

/** Scope OUR device cursor to the container so the chain selection is readable. */
async function scopeContainer(): Promise<number> {
  const d = await devices();
  const at = d.devices.findIndex((x) => x.name === 'Instrument Layer');
  if (at < 0) { console.log(`REFUSING: no container on ${SUBJECT} — ${shapeOf(d)}`); process.exit(1); }
  await req('devcursor.selectAt', { deviceIndex: at });
  const ok = await pollUntil(async () => {
    const s = (await req('devcursor.status')) as { exists: boolean; name: string };
    return s.exists && s.name === 'Instrument Layer';
  }, 6000, 150);
  if (!ok.ok) { console.log('REFUSING: cursor not on the container (the e16o trap).'); process.exit(1); }
  return at;
}

async function highlight(): Promise<string> {
  const n = (await req('device.nesting')) as Nesting;
  return n.cursorLayerExists === true ? String(n.cursorLayerName) : `(none: ${n.cursorLayerExists})`;
}

async function focusDevicePanel(): Promise<void> {
  await req('app.invokeAction', { id: FOCUS_LAUNCHER });
  await new Promise((r) => setTimeout(r, 250));
  await req('app.invokeAction', { id: FOCUS_DEVICES });
  await new Promise((r) => setTimeout(r, 400));
}

async function reap(where: string): Promise<void> {
  for (let g = 0; g < 10; g++) {
    const now = await list();
    const orphan = now.tracks.find((x) => !baseIds.has(x.channelId));
    if (!orphan) break;
    note(`⚠ ${where}: reaped orphan track ${orphan.name}`);
    await req('track.delete', { trackIndex: orphan.index });
    await pollUntil(async () => !(await list()).tracks.some((x) => x.channelId === orphan.channelId), 4000, 200);
  }
}

/** Restore the track to EXACTLY [Instrument Layer, Organ]. */
async function rebuild(): Promise<void> {
  await reap('rebuild');
  for (let g = 0; g < 16; g++) {
    const d = await devices();
    const extra = d.devices.filter((x) => x.name === 'Instrument Layer').length > 1
      || d.devices.filter((x) => x.name === 'Organ').length > 1
      || d.count > 2;
    if (!extra) break;
    // ⚠ Trim from the END, and never the container at index 0.
    const victim = d.devices[d.devices.length - 1]!;
    note(`⚠ rebuild: trimming ${victim.name} (${shapeOf(d)})`);
    await req('device.delete', { cursor: '0', deviceIndex: victim.index });
    await pollUntil(async () => (await devices()).count < d.count, 4000, 200);
  }
  let d = await devices();
  if (!d.devices.some((x) => x.name === 'Organ')) {
    await req('device.insertBitwig', { cursor: '0', uuid: ORGAN });
    await pollUntil(async () => (await devices()).devices.some((x) => x.name === 'Organ'), 8000, 200);
    d = await devices();
  }
  // ⚠ The device cursor ORPHANS after deletes; only a track-cursor MOVE recovers it.
  const other = baseline.tracks.find((t) => t.index !== subject!.index)!;
  await pointAt(other.index);
  await pointAt(subject!.index);
}

// ==========================================================================
console.log('\n-- PRECONDITIONS');
const start0 = await devices();
note(`${SUBJECT} at start: ${shapeOf(start0)}`);
check(`PRECONDITION: ${SUBJECT} starts as the clean one-container fixture`,
  start0.count === 1 && start0.devices[0]?.name === 'Instrument Layer', { shape: shapeOf(start0) });
await scopeContainer();
const chains0 = (await req('layer.list')) as LayerList;
check('PRECONDITION: 4 chains with distinct contents',
  chains0.count === 4 && new Set(chains0.layers.map((x) => x.devices[0]?.name)).size === 4,
  { chains: chains0.count });

console.log('\n-- building the DISCRIMINATING fixture: [Instrument Layer, Organ]');
await rebuild();
const fixture = await devices();
note(`${SUBJECT} now: ${shapeOf(fixture)}`);
check('⚠ the fixture is DISTINGUISHABLE — two differently-named devices',
  fixture.count === 2 && fixture.devices.some((x) => x.name === 'Organ')
  && fixture.devices.some((x) => x.name === 'Instrument Layer'), { shape: shapeOf(fixture) });
if (fixture.count !== 2) { console.log('REFUSING: could not build the fixture.'); process.exit(1); }

// ==========================================================================
interface Shot { label: string; before: string; after: string; grew: string }
const shots: Shot[] = [];

/**
 * Fire `Duplicate` and report WHICH device gained a copy, by name.
 * Name the survivor, never count it (e16t).
 */
async function shoot(label: string, setup: () => Promise<void>): Promise<Shot> {
  await rebuild();
  const before = await devices();
  console.log(`\n  ${label}`);
  await focusDevicePanel();
  await setup();
  await new Promise((r) => setTimeout(r, 700));
  const after0 = await devices();
  note(`   BEFORE ${shapeOf(after0)}`);
  await req('app.invokeAction', { id: 'Duplicate' });
  await new Promise((r) => setTimeout(r, 1800));
  const after = await devices();
  note(`   AFTER  ${shapeOf(after)}`);
  const countOf = (d: DevList, n: string) => d.devices.filter((x) => x.name === n).length;
  const gainedOrgan = countOf(after, 'Organ') > countOf(before, 'Organ');
  const gainedContainer = countOf(after, 'Instrument Layer') > countOf(before, 'Instrument Layer');
  const grew = gainedOrgan && gainedContainer ? 'BOTH'
    : gainedOrgan ? 'Organ' : gainedContainer ? 'Instrument Layer' : 'nothing';
  console.log(`   ⇒ duplicated: ${grew}`);
  const s = { label, before: shapeOf(before), after: shapeOf(after), grew };
  shots.push(s);
  await rebuild();
  return s;
}

/** Point the device panel at the ORGAN, and leave the chain selection alone. */
const panelOrganOnly = async () => {
  const d = await devices();
  const at = d.devices.findIndex((x) => x.name === 'Organ');
  await req('device.selectInEditor', { deviceIndex: at });
  note(`   panel → Organ (device ${at}); chain selection NOT touched`);
};

/** Point the panel at the ORGAN, THEN select a chain inside the container. */
const panelOrganPlusChain = async () => {
  const d = await devices();
  const at = d.devices.findIndex((x) => x.name === 'Organ');
  await req('device.selectInEditor', { deviceIndex: at });
  await new Promise((r) => setTimeout(r, 400));
  await scopeContainer();
  const from = await highlight();
  const cur = (await req('layer.list')) as LayerList;
  // ⚠ Aim at a chain that is NOT already selected — the whole lesson of e17u.
  const idx = cur.layers.findIndex((x) => (x.devices[0]?.name ?? '—') !== from);
  const aimed = cur.layers[idx]?.devices[0]?.name ?? '—';
  await req('layer.select', { layerIndex: idx, where: 'editor' });
  await new Promise((r) => setTimeout(r, 700));
  await scopeContainer();
  const got = await highlight();
  note(`   panel → Organ (device ${at});  chain ${from} --aim--> ${aimed}, reads ${got}`);
  check('PRECONDITION: the chain selection actually MOVED to the target before firing',
    got === aimed && got !== from, { from, aimed, got });
  // ⚠ Re-assert the panel AFTER the chain work, so the panel is not merely stale.
  const d2 = await devices();
  const at2 = d2.devices.findIndex((x) => x.name === 'Organ');
  await req('device.selectInEditor', { deviceIndex: at2 });
  await new Promise((r) => setTimeout(r, 400));
};

/** The gate: panel on the CONTAINER, which must duplicate the container. */
const panelContainer = async () => {
  const d = await devices();
  const at = d.devices.findIndex((x) => x.name === 'Instrument Layer');
  await req('device.selectInEditor', { deviceIndex: at });
  note(`   panel → Instrument Layer (device ${at})  [gate]`);
};

// ==========================================================================
console.log('\n======== CONTROL 1 — the gate, and the e17t steering, in one shot');
const gateA = await shoot('gate A: panel → CONTAINER, no chain selection', panelContainer);
if (gateA.grew !== 'Instrument Layer') {
  console.log('\n⚠⚠ REFUSING: the gate did not duplicate the container. Dispatch is dead or the');
  console.log('  panel is not steerable right now — either way nothing below would mean');
  console.log('  anything. ⚠ Bring Bitwig to the FRONT and stay there for the entire run.');
  await rebuild();
  process.exit(1);
}
note('   ✓ gate alive, and the panel is steerable');

console.log('\n======== CONTROL 2 — panel → ORGAN, chain selection untouched');
note('⚠ This must duplicate the ORGAN. If it duplicates the container instead, the');
note('  panel is not really steering and the discriminator below is meaningless.');
const ctlOrgan = await shoot('control: panel → ORGAN only', panelOrganOnly);
check('⚠ CONTROL: pointing the panel at the Organ makes `Duplicate` copy the ORGAN',
  ctlOrgan.grew === 'Organ', { duplicated: ctlOrgan.grew });

// ==========================================================================
console.log('\n======== ⚠⚠ THE DISCRIMINATOR — panel → ORGAN *and* a chain selected');
const disc = await shoot('⚠ panel → ORGAN + chain selected inside the container', panelOrganPlusChain);

console.log('\n======== CONTROL 3 — the gate again, after everything');
const gateB = await shoot('gate B: panel → CONTAINER, no chain selection', panelContainer);
check('the gate is STILL alive at the end — the discriminator ran in live conditions',
  gateB.grew === 'Instrument Layer', { duplicated: gateB.grew });

// ==========================================================================
console.log('\n-- restoring the fixture to its one-container baseline');
await rebuild();
for (let g = 0; g < 8; g++) {
  const d = await devices();
  const organ = d.devices.find((x) => x.name === 'Organ');
  if (!organ) break;
  await req('device.delete', { cursor: '0', deviceIndex: organ.index });
  await pollUntil(async () => !(await devices()).devices.some((x) => x.name === 'Organ'), 4000, 200);
}
await reap('final');
const end = await devices();
note(`${SUBJECT} final: ${shapeOf(end)}`);
check('the fixture is back to its one-container baseline',
  end.count === 1 && end.devices[0]?.name === 'Instrument Layer', { shape: shapeOf(end) });
await scopeContainer();
const chainsEnd = (await req('layer.list')) as LayerList;
check('and its four chains are intact', chainsEnd.count === 4, { chains: chainsEnd.count });

// ==========================================================================
console.log('\n======== VERDICT');
for (const s of shots) console.log(`  ${s.label.padEnd(52)} duplicated: ${s.grew}`);
console.log('');
if (ctlOrgan.grew !== 'Organ') {
  note('⚠ UNINTERPRETABLE: the panel did not steer to the Organ even with no chain');
  note('  selection in play, so the discriminator had no working baseline. Record nothing.');
} else if (disc.grew === 'Organ') {
  note('⇒ **A. The chain selection contributed NOTHING.** The panel\'s current device won');
  note('  outright, with a chain verifiably selected at the moment of firing. ⚠ This is a');
  note('  POSITIVE result, much stronger than the old ○: the chain selection is settable');
  note('  and readable, and the device panel simply does not consume it.');
  note('  ⇒ E17-VERDICT §1a survives, REWORDED — not "a chain cannot be addressed" but');
  note('  "a chain can be addressed, and panel-focused actions ignore that address".');
} else if (disc.grew === 'Instrument Layer') {
  note('⚠⚠ **B. The chain selection BEAT the panel\'s current device** — the panel was');
  note('  pointed at the Organ and the CONTAINER was duplicated anyway. So our chain');
  note('  selection IS consumed by the action, and merely resolves one level too high.');
  note('  ⇒ That is a granularity gap, not a wall. E17-VERDICT §1a must be re-argued and');
  note('  rows 3/4 are a live prospect: find the call that resolves AT the chain.');
} else {
  note(`⚠ Neither reading fits (duplicated: ${disc.grew}). Do not record a verdict;`);
  note('  this needs its own sitting.');
}
console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} checks reported a negative — read them individually`);
process.exit(0);
