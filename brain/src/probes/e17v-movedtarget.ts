/**
 * E17 rows 3+4, RE-OPENED — fire at a chain highlight that is PROVEN to have moved.
 *
 * ⚠ **What `e17u` overturned.** With the target varied instead of the setter:
 *
 *     layer.pointCursor(3 / 0 / 2)   readback "Polysynth" every time, eyes agree
 *                                    ⇒ `CursorDeviceLayer.selectChannel()` is INERT
 *     layer.select(editor, 3)        readback "Sampler", eyes "Sampler"
 *                                    ⇒ `DeviceChain.selectInEditor()` MOVES the highlight
 *
 * And the baseline answer was **"Polysynth" — chain 1 — before anything was
 * touched.** ⚠ `e17k`, `e17o`, `e17q` and `e17r` every one of them aimed at
 * `layerIndex: 1`. So every trial in this session set the highlight to where it
 * already sat: the setter worked, its effect was invisible, and each action fired
 * afterwards ran against a state indistinguishable from having done nothing. Rows
 * 3 and 4 were never actually tested against a moved chain selection.
 *
 * ⚠ **Two claims are retracted by this, not merely weakened:**
 *   - `e17o`'s MECHANISM B ● — `cursorLayer0.exists()` flipping true was NOT
 *     `selectChannel` binding. It was already bound to the ambient current chain.
 *     `e17o` then CHOSE `pointCursor` for rows 3/4 off that false positive, so
 *     those rows ran on an inert setter.
 *   - the "ambient highlight" note from `e17r` — the highlight is real, but it is
 *     `layer.select(editor)` that drives it, not the cursor.
 *
 * ⚠ **The instrument changed too, and that is the quiet win.** `cursorLayerName`
 * tracked the human's eyes 5/5 in `e17u`, so the chain selection is now
 * MACHINE-READABLE — the readback `e17k` lacked and `e17q` went looking for in the
 * observers that died to a deprecated sibling. Precondition and question can
 * finally be asserted apart (E16o), with no human in the loop.
 *   ⚠ Valid only while `cursorDevice0` sits on the container: `e17u` arm E moved
 *   the device cursor into a chain and `cursorLayerExists` went false while the
 *   highlight plainly stayed put. PART 0 controls for that read being disturbing.
 *
 * ⚠ Every target below is chosen AGAINST the live baseline, never a fixed index.
 *
 * ⚠ Needs Bitwig FOREGROUND (e17m: 0/8 backgrounded). Waits rather than refusing.
 * ⚠ `Delete` is GATED on a create route working first.
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
interface Nesting { cursorLayerExists?: boolean | string; cursorLayerName?: string; name?: string }

await client.connect();
const baseline = await list();
const baseIds = new Set(baseline.tracks.map((t) => t.channelId));
const subject = baseline.tracks.find((t) => t.name === SUBJECT);
const scratch = baseline.tracks.find((t) => t.name === SCRATCH);
if (!subject || !scratch) { console.log('REFUSING: gn-lay4 / gn-A missing — run e17-setup.'); process.exit(1); }

async function pointAt(trackIndex: number): Promise<void> {
  await req('cursor.pointTrack', { cursor: '0', trackIndex });
  await pollUntil(async () => {
    const s = (await req('cursor.status', { cursor: '0' })) as { trackPosition: number };
    return s.trackPosition === trackIndex;
  }, 4000, 150);
  await new Promise((r) => setTimeout(r, 350));
}

/** ⚠ `itemCount` too: the bank caps at deviceBank, so a count of 8 can hide more. */
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

/** Put OUR device cursor on the container so `layerBank0` / `cursorLayer0` resolve. */
async function scope(): Promise<void> {
  await devicesOn(subject!.index);
  await req('devcursor.selectAt', { deviceIndex: 0 });
  const ok = await pollUntil(async () => {
    const s = (await req('devcursor.status')) as { exists: boolean; name: string };
    return s.exists && s.name === 'Instrument Layer';
  }, 6000, 150);
  if (!ok.ok) { console.log('REFUSING: cursor not on the container (the e16o trap).'); process.exit(1); }
}

/** The chain highlight, read back. Validated against human eyes 5/5 in e17u. */
async function highlight(): Promise<string> {
  const n = (await req('device.nesting')) as Nesting;
  return n.cursorLayerExists === true ? String(n.cursorLayerName) : `(none: ${n.cursorLayerExists})`;
}

async function chains(): Promise<LayerList> {
  await scope();
  return (await req('layer.list')) as LayerList;
}
const shapeOf = (l: LayerList) =>
  l.layers.map((x) => `${x.index}:[${x.devices.map((d) => d.name).join('+') || '—'}]`).join(' ');
/** Name the survivor, never count it (e16t). */
const contentsOf = (l: LayerList) => l.layers.map((x) => x.devices[0]?.name ?? '—');

async function focusDevicePanel(): Promise<void> {
  await req('app.invokeAction', { id: FOCUS_LAUNCHER });
  await new Promise((r) => setTimeout(r, 250));
  await req('app.invokeAction', { id: FOCUS_DEVICES });
  await new Promise((r) => setTimeout(r, 400));
}

interface Level { tracks: number; devices: number; itemCount: number; chains: number; contents: string[] }
async function levels(): Promise<Level> {
  const t = await list();
  const d = await devicesOn(subject!.index);
  const c = await chains();
  return { tracks: t.count, devices: d.count, itemCount: d.itemCount, chains: c.count, contents: contentsOf(c) };
}
const fmt = (l: Level) => `tracks=${l.tracks} devices=${l.devices}/${l.itemCount} chains=${l.chains} [${l.contents.join(' ')}]`;

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

async function restore(target: Level, where: string): Promise<void> {
  await reap(where);
  for (let g = 0; g < 16; g++) {
    const d = await devicesOn(subject!.index);
    if (d.count <= target.devices) break;
    note(`⚠ ${where}: trimming a duplicate container (${d.count} -> ${d.count - 1})`);
    await req('device.delete', { cursor: '0', deviceIndex: d.devices[d.devices.length - 1]!.index });
    await pollUntil(async () => (await devicesOn(subject!.index)).count < d.count, 4000, 200);
  }
  // ⚠ The device cursor ORPHANS after deletes; only a track-cursor MOVE recovers it.
  await pointAt(scratch!.index);
  await pointAt(subject!.index);
}

// ==========================================================================
console.log('\n-- PRECONDITIONS');
const start = await levels();
note(`${SUBJECT}: ${fmt(start)}`);
check('PRECONDITION: exactly ONE container, so a duplicate of it is visible',
  start.devices === 1 && start.itemCount === 1, { devices: start.devices, itemCount: start.itemCount });
check('PRECONDITION: 4 chains with DISTINCT contents, so a new one can be NAMED',
  start.chains === 4 && new Set(start.contents).size === 4, { contents: start.contents });
if (start.chains !== 4) { console.log('REFUSING: not the 4-chain fixture.'); process.exit(1); }

// ==========================================================================
// ⚠ PART 0 — is the READ disturbing? `e17l` had our own `layer.list` steal the
// human's selection, so the instrument has to be cleared before it is trusted.
console.log('\n======== PART 0 — does re-scoping our device cursor move the highlight?');
await scope();
const h0 = await highlight();
const away = start.contents.findIndex((c) => c !== h0);
await req('layer.select', { layerIndex: away, where: 'editor' });
await new Promise((r) => setTimeout(r, 700));
const h1 = await highlight();
await pointAt(scratch.index);   // leave the track entirely
await scope();                  // and come all the way back
const h2 = await highlight();
note(`highlight: start=${h0} -> after select(${away})=${h1} -> after a full re-scope=${h2}`);
check('the readback SURVIVES a full re-scope — our own read is not moving it',
  h1 === h2, { afterSelect: h1, afterRescope: h2 });

// ==========================================================================
// ⚠ PART 1 — which setters MOVE it? Each aimed at a chain that is NOT already lit,
// chosen from the live reading rather than hardcoded. That is the whole lesson.
console.log('\n======== PART 1 — which setter moves the chain highlight? (silent, no actions)');
interface SetterRow { label: string; from: string; aimed: string; got: string; moved: boolean }
const setters: SetterRow[] = [];

async function trySetter(label: string, fire: (i: number) => Promise<void>): Promise<SetterRow> {
  await scope();
  const from = await highlight();
  const cur = await chains();
  // ⚠ Aim somewhere OTHER than the current highlight — the error this probe exists for.
  const idx = cur.layers.findIndex((x) => (x.devices[0]?.name ?? '—') !== from);
  const aimed = cur.layers[idx]?.devices[0]?.name ?? '—';
  await fire(idx);
  await new Promise((r) => setTimeout(r, 800));
  await scope();
  const got = await highlight();
  const row = { label, from, aimed, got, moved: got === aimed && got !== from };
  console.log(`  ${label.padEnd(34)} ${from} --aim--> ${aimed}   landed: ${got}   ${row.moved ? '●' : '○'}`);
  setters.push(row);
  return row;
}

const sEditor = await trySetter('layer.select(editor)',
  async (i) => { await req('layer.select', { layerIndex: i, where: 'editor' }); });
const sMixer = await trySetter('layer.select(mixer)',
  async (i) => { await req('layer.select', { layerIndex: i, where: 'mixer' }); });
const sCursor = await trySetter('layer.pointCursor (selectChannel)',
  async (i) => { await req('layer.pointCursor', { layerIndex: i }); });

check('⚠ `DeviceChain.selectInEditor()` MOVES the chain highlight (e17u, now machine-read)',
  sEditor.moved, { from: sEditor.from, aimed: sEditor.aimed, got: sEditor.got });
check('⚠ RETRACTION CONTROL: `CursorDeviceLayer.selectChannel()` is INERT — it must NOT move it',
  !sCursor.moved, { from: sCursor.from, aimed: sCursor.aimed, got: sCursor.got });

const setter = sEditor.moved ? 'editor' : sMixer.moved ? 'mixer' : null;
if (!setter) {
  console.log('\nREFUSING: no setter moves the highlight, which contradicts e17u. Stop and re-measure.');
  process.exit(1);
}

// ==========================================================================
console.log('\n-- CONTROL: is the device-panel dispatch path live? (needs FOREGROUND)');
note('⚠ CLICK INTO BITWIG. Retrying for 90s, rebuilding the scratch fixture each round.');
async function clearScratch(): Promise<void> {
  for (let g = 0; g < 10; g++) {
    const d = await devicesOn(scratch!.index);
    if (d.count === 0) break;
    await req('device.delete', { cursor: '0', deviceIndex: d.devices[0]!.index });
    await pollUntil(async () => (await devicesOn(scratch!.index)).count < d.count, 4000, 200);
  }
}
let live = false;
const t0 = Date.now();
for (let round = 1; Date.now() - t0 < 90_000; round++) {
  await clearScratch();
  await req('device.insertBitwig', { cursor: '0', uuid: POLYSYNTH });
  await pollUntil(async () => (await devicesOn(scratch.index)).count === 1, 8000, 200);
  await devicesOn(scratch.index);
  await req('device.selectInEditor', { deviceIndex: 0 });
  await focusDevicePanel();
  await req('device.selectInEditor', { deviceIndex: 0 });
  await new Promise((r) => setTimeout(r, 300));
  await req('app.invokeAction', { id: 'Group' });
  await new Promise((r) => setTimeout(r, 1600));
  if ((await devicesOn(scratch.index)).devices[0]?.name === 'Instrument Layer') {
    note(`dispatch live on round ${round} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    live = true; break;
  }
  note(`round ${round}: not dispatching`);
}
await clearScratch();
await reap('control');
check('CONTROL: named actions reach the device panel right now', live, {});
if (!live) { console.log('\nREFUSING after 90s — bring Bitwig forward and re-run.'); process.exit(1); }

// ==========================================================================
// ⚠ PART 2 — the row-3 retry, with the precondition ASSERTED at the moment of firing.
console.log('\n======== PART 2 — ROW 3: `Duplicate` against a VERIFIED, MOVED chain highlight');

interface Shot { label: string; target: string; verified: boolean; before: Level; after: Level }
const shots: Shot[] = [];

async function shoot(label: string, actions: string[], useContainer = false): Promise<Shot> {
  const before = await levels();
  await scope();
  const from = await highlight();
  const cur = await chains();
  const idx = cur.layers.findIndex((x) => (x.devices[0]?.name ?? '—') !== from);
  const target = cur.layers[idx]?.devices[0]?.name ?? '—';

  // ⚠ Focus FIRST, then select, then VERIFY. Older probes re-applied the setter
  // after focusing but never checked it survived — now we can.
  await focusDevicePanel();
  if (useContainer) {
    await devicesOn(subject!.index);
    await req('device.selectInEditor', { deviceIndex: 0 });
  } else if (setter === 'editor') {
    await req('layer.select', { layerIndex: idx, where: 'editor' });
  } else {
    await req('layer.select', { layerIndex: idx, where: 'mixer' });
  }
  await new Promise((r) => setTimeout(r, 700));
  await scope();
  const atFiring = await highlight();
  const verified = useContainer || atFiring === target;
  console.log(`\n  ${label}`);
  note(`   highlight ${from} --aim--> ${target}, and AT FIRING it reads ${atFiring} ${verified ? '●' : '⚠ NOT ON TARGET'}`);
  note(`   BEFORE ${fmt(before)}`);
  if (!useContainer) {
    check(`PRECONDITION [${label}]: the target chain is still highlighted when the action fires`,
      verified, { aimed: target, atFiring });
  }

  for (const a of actions) {
    await req('app.invokeAction', { id: a });
    await new Promise((r) => setTimeout(r, 1600));
  }
  const after = await levels();
  note(`   AFTER  ${fmt(after)}`);
  const dT = after.tracks - before.tracks, dD = after.devices - before.devices, dC = after.chains - before.chains;
  const verdict = dC > 0 ? '●● CHAIN' : dD > 0 ? '◐ CONTAINER' : dT > 0 ? '⚠ TRACK' : '○ nothing';
  console.log(`   Δtracks=${dT} Δdevices=${dD} Δchains=${dC}   ${verdict}`);
  if (dC > 0) {
    // ⚠ A count of 5 is also what duplicating the WRONG chain produces.
    const grewBy = after.contents.filter((c) => c === target).length - before.contents.filter((c) => c === target).length;
    check(`⚠ and it is the TARGET chain that was copied — a second ${target} exists`,
      grewBy > 0, { target, before: before.contents, after: after.contents });
  }
  const shot = { label, target, verified, before, after };
  shots.push(shot);
  await restore(before, label);
  return shot;
}

const refHit = (s: Shot) => s.after.devices > s.before.devices;
const chainHit = (s: Shot) => s.after.chains > s.before.chains;

/**
 * ⚠ The reference arm, run BEFORE / BETWEEN / AFTER rather than once at the end.
 *
 * The first version of this probe ran it last, and paid for it: the dispatch
 * control passed at 47 s, the operator alt-tabbed away, the gate closed, and all
 * three arms read Δ0 — only the trailing reference revealed that the whole run was
 * void. A gate that is only checked at the end cannot tell you WHEN it died.
 *
 * ⚠ It is also the comparison itself. A ○ on a chain arm only means something if
 * the container arm bracketing it reads ◐ in the same conditions.
 */
async function gate(tag: string): Promise<Shot> {
  const s = await shoot(`REF [${tag}]: device.selectInEditor(container) + Duplicate`, ['Duplicate'], true);
  if (!refHit(s)) {
    console.log(`\n⚠⚠ REFUSING — the reference arm did NOT duplicate the container at "${tag}".`);
    console.log('  Dispatch is dead, so every reading taken around it is void and nothing is');
    console.log('  recorded. ⚠ Bring Bitwig to the FRONT and stay there for the entire run —');
    console.log('  alt-tabbing away mid-run is exactly what voided the previous attempt.');
    await restore(start, 'refuse');
    process.exit(1);
  }
  note(`   ✓ gate ALIVE at "${tag}" (container ${s.before.devices} -> ${s.after.devices})`);
  return s;
}

await gate('before the chain arms');
const rowThree = await shoot(`arm 1: layer.select(${setter}) + Duplicate  — ⚠ the moved target`, ['Duplicate']);
await gate('between arms 1 and 2');
const rowThreeB = await shoot(`arm 2: layer.select(${setter}) + Copy + Paste`, ['Copy', 'Paste']);
const reference = await gate('after the chain arms');

const created = chainHit(rowThree) || chainHit(rowThreeB);
check('⚠⚠ ROW 3: a chain WE selected can be DUPLICATED — the layer branch lifecycle opens',
  created, {
    duplicate: `${rowThree.before.chains}->${rowThree.after.chains}`,
    copyPaste: `${rowThreeB.before.chains}->${rowThreeB.after.chains}`,
    reference: `devices ${reference.before.devices}->${reference.after.devices}`,
  });

// ==========================================================================
console.log('\n======== PART 3 — ROW 4: `Delete`, ⚠ GATED on a create route working');
let deleted = false;
if (!created) {
  note('SKIPPED. Without a proven create there is no evidence the actions reach our chain');
  note('selection, and a stray `Delete` destroys something real (E6 blocker 3).');
} else {
  // ⚠ One more gate immediately before a DESTRUCTIVE action. A `Delete` fired into
  // a dead gate reads "○ it refused" and is indistinguishable from a real refusal.
  await gate('immediately before Delete');
  const before = await levels();
  await scope();
  const from = await highlight();
  const cur = await chains();
  const idx = cur.layers.findIndex((x) => (x.devices[0]?.name ?? '—') !== from);
  const victim = cur.layers[idx]?.devices[0]?.name ?? '—';
  await focusDevicePanel();
  await req('layer.select', { layerIndex: idx, where: setter });
  await new Promise((r) => setTimeout(r, 700));
  await scope();
  const atFiring = await highlight();
  note(`   victim ${victim}, highlight at firing reads ${atFiring}`);
  check('PRECONDITION: the victim chain is highlighted at the moment `Delete` fires',
    atFiring === victim, { victim, atFiring });
  if (atFiring === victim) {
    await req('app.invokeAction', { id: 'Delete' });
    await new Promise((r) => setTimeout(r, 2000));
    const after = await levels();
    note(`   BEFORE ${fmt(before)}`);
    note(`   AFTER  ${fmt(after)}`);
    deleted = after.chains < before.chains;
    check('⚠⚠ ROW 4: `Delete` on a chain WE selected removes it', deleted,
      { before: before.chains, after: after.chains });
    check('and no TRACK was destroyed', after.tracks === before.tracks,
      { before: before.tracks, after: after.tracks });
    if (deleted) {
      check(`and the RIGHT chain went — no ${victim} remains, verified by content not by count`,
        !after.contents.includes(victim), { victim, remaining: after.contents });
      await req('app.undo');
      await new Promise((r) => setTimeout(r, 1800));
      note(`undone: ${fmt(await levels())}`);
    }
  }
}

// ==========================================================================
console.log('\n-- final state');
await restore(start, 'final');
const end = await levels();
note(`${SUBJECT}: ${fmt(end)}`);
check('the fixture is back to baseline at all three levels',
  end.tracks === start.tracks && end.devices === start.devices && end.chains === start.chains
  && end.contents.join() === start.contents.join(),
  { start: fmt(start), end: fmt(end) });

// ==========================================================================
console.log('\n======== VERDICT');
console.log(`  SETTER  selectInEditor moves the highlight   ${sEditor.moved ? '●' : '○'}`);
console.log(`  SETTER  selectInMixer moves the highlight    ${sMixer.moved ? '●' : '○'}`);
console.log(`  SETTER  selectChannel moves the highlight    ${sCursor.moved ? '● ⚠ contradicts e17u' : '○ (retraction confirmed)'}`);
console.log(`  ROW 3   a selected chain can be duplicated   ${created ? '●' : '○'}`);
console.log(`  ROW 4   a selected chain can be deleted      ${created ? (deleted ? '●' : '○') : 'SKIPPED'}`);
if (created && deleted) {
  note('⚠⚠ BOTH ROWS FLIP. A chain has a complete branch lifecycle after all, and');
  note('  E17-VERDICT.md §1a — "a chain is not addressable as the panel\'s current');
  note('  item" — is WRONG. The call must be re-argued. ⚠ §1b is untouched: chain');
  note('  `channelId` is still not durable (8/8 changed across reloads), and that is');
  note('  an independent reason takes may still need to be tracks.');
} else if (created && !deleted) {
  note('⚠ Create works and delete does not — record BOTH, and do not smooth it into');
  note('  one story. A branch you can mint but not remove is a different verdict again.');
} else if (reference.after.devices > reference.before.devices) {
  note('⇒ The chain highlight moved, was VERIFIED still on target at firing, and the');
  note('  action still took the container — which the reference arm proves was live.');
  note('  ⚠ That is a POSITIVE finding and much stronger than the old ○: the chain');
  note('  highlight is simply not the argument these actions consume. §1a survives,');
  note('  but its wording must change from "not addressable" to "addressable, and');
  note('  ignored by the device panel".');
} else {
  note('⚠ The reference arm did nothing either, so the whole run is uninterpretable —');
  note('  dispatch died after the control passed. Re-run; record nothing.');
}
console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} checks reported a negative — read them individually`);
process.exit(0);
