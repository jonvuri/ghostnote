/**
 * E18 §3.3 — can a CONTAINER be placed on the MASTER and an FX RETURN, by US?
 *
 * **The claim under test.** `E17-VERDICT.md` §6.1 says layers are *"the only
 * device-scoped A/B that reaches the Master and the FX returns"* — the hole §4.8
 * had no answer for, because an FX return cannot be forked at all (other tracks'
 * sends still feed the original). ⚠ **That argument assumes a container can be
 * PLACED there autonomously, and it has never been tested.** It is an assumption
 * carrying the whole of §6, and it costs three typed calls to check.
 *
 * ⚠ **The route changed under it since `e17ak`, and the new one is stronger.**
 * The verdict's §5 assumed a multi-chain container had to come from a
 * hand-authored `.bwpreset` (rule 11 / E4h). It does not:
 *
 *     device.insertBitwig(FX Layer)   → ships with exactly ONE chain (e17ai)
 *     layer.select(editor, 0)         → typed, ours, sets the identical flag a
 *                                       human click does (e17y)
 *     layer.duplicateChannel(0)       → Channel.duplicate(), ● with a selection
 *                                       (e17ak) — no focus, priming or human
 *
 * So the real question is not *"does `insertFile` work there"* but **does that
 * whole autonomous recipe survive a change of DESTINATION.** Both are measured;
 * the recipe is the load-bearing arm and `insertFile` is asked because §3.3 asks
 * for it by name.
 *
 * ### The cells, and why the third column exists
 *
 * |                                  | gn-B (control) | FX 1 | Master |
 * |----------------------------------|----------------|------|--------|
 * | FX Layer by UUID, grown to 2 chains | control     | Q    | Q      |
 * | Instrument Layer by UUID            | control     | ⚠ discriminator |
 * | Instrument-Layer PRESET by insertFile | control   | Q (§3.3 by name) |
 *
 * ⚠ **The discriminator earns its place.** Every container fixture on disk is
 * INSTRUMENT-shaped (`gn_layer_4chain.bwpreset`), and an instrument container on
 * a Master is plausibly refused for being an *instrument* rather than for being a
 * *container*. Without the middle row an `insertFile` ○ on the Master would be
 * scored as "the destination refuses containers" when the honest reading is "the
 * destination refuses instruments" — the e17v mistake, where a one-device fixture
 * made two mechanisms predict the same outcome. Inserting an Instrument Layer by
 * UUID beside an FX Layer by UUID separates TYPE from ROUTE, on one destination,
 * in one sitting.
 *
 * ### Method guards this probe is built against (HANDOFF-E18 §1)
 *
 * - **#1 a name is not an identity.** Every destination is resolved by
 *   `channelId`, and the probe REFUSES if any name matches more than one track.
 *   The index is re-resolved from a fresh `track.list` before every point.
 * - **#2 measure every level.** Each arm reads the track's device list, the
 *   container's chain list, and the devices inside every chain.
 * - **#3 check for objects REMOVED.** The full track identity set is compared
 *   before and after every arm, not just at the end.
 * - **#4 bound the delta.** One insert cannot change a device count by anything
 *   but 0 or +1, and one duplicate cannot change a chain count by anything but 0
 *   or +1. An impossible delta ABORTS rather than scoring.
 * - **#6 a probe's SETUP is part of its experiment.** ⚠ `device.selectInEditor`
 *   is never called — it poisoned `e17ac` by overriding the chain selection, and
 *   nothing here needs it. `layer.pointCursor` is never called either (inert,
 *   `e17u`).
 * - **#12 sibling controls.** `gn-B` runs the identical recipe BEFORE, BETWEEN
 *   and AFTER the two real destinations (the `e17v` ordering fix), so a recipe
 *   that dies mid-run produces an early refusal rather than three false ○s.
 * - **#13 name the survivor, never count it.** Chain 0 is renamed to a
 *   distinctive tag before the duplicate, so growth is verified by NAME.
 *
 * ### Safety
 *
 * ⚠ **This writes to the MASTER**, which is the global signal path. Two parallel
 * chains sum the signal twice, so the probe **REFUSES to run while the transport
 * is rolling**. Every arm restores its destination to the exact device-name
 * sequence it started with, an abort attempts the same restore before exiting,
 * and a cross-track device fingerprint is taken at both ends so a device left
 * anywhere at all is caught rather than assumed absent.
 *
 * ⚠ **Typed-only.** No named actions, so no focus, foreground, priming or human
 * — none of `e17ab`'s preconditions apply. It does call `cursor.pointTrack`,
 * which is `CursorTrack.selectChannel()` and therefore DESTROYS named-action
 * priming (E16j / `e17ag` arm 5); anything named-action-gated in the same sitting
 * must be re-primed after this runs.
 */
import { client, check, note, failureCount, pollUntil } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const FX_LAYER = 'a0913b7f-096b-4ac9-bddd-33c775314b42';
const INSTRUMENT_LAYER = '5024be2e-65d6-4d40-bbfe-8b2ea993c445';
/** ⚠ Rule 11 / E4h: `insertFile` needs an ABSOLUTE path and a `.bwpreset` extension — both fail silently otherwise. */
const PRESET = '/Users/jonvuri/Development/ghostnote/brain/fixtures/InstrumentLayer/gn_layer_4chain.bwpreset';

const CONTROL = 'gn-B';
const FX_RETURN = 'FX 1';
const MASTER = 'Master';

const TAG = 'E18·a';

interface TrackRow { index: number; name: string; type: string; channelId: string }
interface DevList { devices: { index: number; name: string }[]; count: number; itemCount: number }
interface ChainRow { index: number; name: string; devices: { name: string }[] }
interface LayerList { layers: ChainRow[]; count: number; cursorDeviceName?: string }
interface SelState { editorObserver: string; layers: { index: number; selectedInEditor: boolean }[] }

// ==========================================================================
// Resolution and reading
// ==========================================================================

const trackList = async () => ((await req('track.list')) as { tracks: TrackRow[] }).tracks;
const idsOf = (t: TrackRow[]) => t.map((x) => x.channelId).sort().join(',');

/**
 * ⚠ Guard #1 — refuse when a name matches more than one track. Two tracks called
 * `gn-lay4` are what let `e17ag` select a chain on one and fire at the other.
 */
async function resolve(name: string): Promise<TrackRow> {
  const hits = (await trackList()).filter((t) => t.name === name);
  if (hits.length !== 1) {
    await bail(`REFUSING: ${hits.length} tracks named "${name}" — a name is not an identity (guard #1).`);
  }
  return hits[0]!;
}

/**
 * ⚠⚠ The landing readback, and the first run of this probe died on getting it wrong.
 *
 * `cursor.status.trackPosition` reads `clip.getTrack()` — the cursor CLIP's track —
 * and an FX return and the Master have **no launcher clip**, so it reports
 * `trackPosition=-1, trackName="", trackExists=false` however correctly the cursor
 * landed. A probe waiting on it aborts on the two destinations it exists to measure.
 *
 * ⚠ And the obvious replacement is also wrong: `cursorTrack.position()` is **not the
 * bank index**. Measured across all 13 tracks, it is the position within the PARENT
 * GROUP — `gn-E16` reads `0` because it is a child of `Group 7`, and everything after
 * the group is shifted by one (`gn-sel` bank 10 → position 9, `Master` bank 12 → 11).
 * So the same number names two different tracks, which is D6's whole complaint.
 *
 * ⇒ Calibrate the mapping per destination, and REFUSE if two destinations share a
 * position — an ambiguous readback is not a readback (guard #1).
 */
const cursorPos = new Map<string, number>();

async function calibrate(dest: TrackRow): Promise<number> {
  const now = await trackList();
  const row = now.find((t) => t.channelId === dest.channelId);
  if (!row) await bail(`the destination "${dest.name}" (${dest.channelId}) is not in the track list.`);
  await req('cursor.pointTrack', { cursor: '0', trackIndex: row!.index });
  let last = Number.NaN;
  let stable = Number.NaN;
  const ok = await pollUntil(async () => {
    const s = (await req('cursor.status', { cursor: '0' })) as { cursorTrackPosition: number };
    const same = s.cursorTrackPosition === last;
    last = s.cursorTrackPosition;
    if (same) stable = s.cursorTrackPosition;
    return same;
  }, 6000, 300);
  if (!ok.ok) await bail(`the cursor position never settled while calibrating "${dest.name}".`);
  await wait(250);
  return stable;
}

/** Point cursor 0 at a track by IDENTITY, re-resolving its index first (guard #1). */
async function pointTo(dest: TrackRow): Promise<void> {
  const now = await trackList();
  const row = now.find((t) => t.channelId === dest.channelId);
  if (!row) await bail(`the destination "${dest.name}" (${dest.channelId}) is GONE from the track list.`);
  await req('cursor.pointTrack', { cursor: '0', trackIndex: row!.index });
  const want = cursorPos.get(dest.channelId);
  if (want === undefined) { await wait(700); return; }
  // ⚠ Method trap 2 (E17): polling for "two consecutive equal reads" of the DEVICE
  // list is satisfied immediately by a stale-but-stable value. Wait on the cursor's
  // own position — the bank cannot have re-scoped before the cursor arrived.
  const ok = await pollUntil(async () => {
    const s = (await req('cursor.status', { cursor: '0' })) as { cursorTrackPosition: number };
    return s.cursorTrackPosition === want;
  }, 6000, 150);
  if (!ok.ok) await bail(`the cursor never landed on "${dest.name}" (wanted position ${want}).`);
  await wait(250);
}

/** The pointed track's top-level device list, read until it stops moving. */
async function devs(): Promise<DevList> {
  let last = ' ';
  let out: DevList = { devices: [], count: 0, itemCount: 0 };
  await pollUntil(async () => {
    out = (await req('device.list', { cursor: '0' })) as DevList;
    const n = out.devices.map((d) => d.name).join(',');
    const stable = n === last;
    last = n;
    return stable;
  }, 5000, 200);
  return out;
}
const devNames = (d: DevList) => d.devices.map((x) => x.name);

/**
 * Scope the layer bank onto a container by NAME (guard #13), and prove it landed.
 *
 * ⚠ The e16o trap in one place: `rig.layerBank0` follows `cursorDevice0`, so
 * aimed at a device with no layers every `layer.*` call is a silent no-op
 * byte-identical to an API refusal.
 */
async function scope(match: RegExp, tag: string): Promise<boolean> {
  const d = await devs();
  const at = d.devices.findIndex((x) => match.test(x.name));
  if (at < 0) return false;
  await req('devcursor.selectAt', { deviceIndex: d.devices[at]!.index });
  const ok = await pollUntil(async () => {
    const s = (await req('devcursor.status')) as { exists: boolean; name: string };
    return s.exists && match.test(s.name);
  }, 6000, 150);
  if (!ok.ok) {
    note(`   ⚠ ${tag}: the device cursor never landed on ${match} — layer reads below would be meaningless.`);
    return false;
  }
  return true;
}

const layers = async () => (await req('layer.list')) as LayerList;
const showChains = (l: LayerList) =>
  l.layers.map((c) => `${c.name}[${c.devices.map((d) => d.name).join('+') || '—'}]`).join(' ') || '—';

// ==========================================================================
// Baseline, restore and abort
// ==========================================================================

const baselines = new Map<string, string[]>();
let baseTrackIds = '';

/** Restore one destination to the exact device-name SEQUENCE it started with. */
async function restore(dest: TrackRow): Promise<boolean> {
  const want = baselines.get(dest.channelId);
  if (!want) return true;
  await pointTo(dest);
  for (let guard = 0; guard < 12; guard++) {
    const d = await devs();
    if (d.count <= want.length) break;
    // Only ever appended, so the surplus is at the END — and the index is read
    // fresh each pass because a delete re-indexes the bank (E3).
    const last = d.devices[d.devices.length - 1]!;
    await req('device.delete', { cursor: '0', deviceIndex: last.index });
    await pollUntil(async () => (await devs()).count < d.count, 6000, 200);
  }
  const end = devNames(await devs());
  return end.join(',') === want.join(',');
}

/** Abort LOUDLY, but put the Master back first — it is the global signal path. */
async function bail(message: string): Promise<never> {
  console.log(`\n${'⚠'.repeat(3)} ABORTING: ${message}`);
  console.log('   attempting to restore every destination to baseline before exiting…');
  for (const [, dest] of destinations) {
    try {
      const ok = await restore(dest);
      console.log(`   ${ok ? 'restored' : '⚠⚠ NOT RESTORED'}  ${dest.name}`);
    } catch (e) {
      console.log(`   ⚠⚠ restore of ${dest.name} threw: ${(e as Error).message}`);
    }
  }
  process.exit(1);
}

const destinations = new Map<string, TrackRow>();

/**
 * A cross-track inventory of TOP-LEVEL devices. ⚠ `e17ah` shipped a `snapshot()`
 * that verified the track list by identity but never looked inside any track but
 * the subject, so anything landing elsewhere read as ○ everywhere. This is the
 * off-subject check, taken at both ends.
 */
async function fingerprint(): Promise<string> {
  const rows: string[] = [];
  for (const t of await trackList()) {
    await req('cursor.pointTrack', { cursor: '0', trackIndex: t.index });
    // ⚠ Uncalibrated tracks have no unambiguous position readback (two tracks can
    // share one — see `calibrate`), so this settles on time and on a stable device
    // list instead. Both passes walk the SAME order, so a systematic stale read
    // reproduces identically and cannot manufacture a difference; a device left
    // behind by us changes one row and still shows.
    await wait(700);
    rows.push(`${t.name}:${devNames(await devs()).join('+') || '—'}`);
  }
  return rows.join(' | ');
}

// ==========================================================================
// The arm
// ==========================================================================

interface Arm {
  dest: string;
  route: string;
  landed: string | null;
  chains: number | null;
  grew: boolean | null;
  ms: number;
}
const arms: Arm[] = [];

/**
 * Insert one container at a destination, read every level, then restore.
 *
 * `grow` is only attempted when the container reports chains — an FX Layer ships
 * with one (`e17ai`) and that first chain is what `Channel.duplicate()` copies.
 */
async function place(
  dest: TrackRow,
  route: string,
  fire: () => Promise<void>,
  match: RegExp,
  grow: boolean,
): Promise<Arm> {
  console.log(`\n  ${dest.name.padEnd(8)} ← ${route}`);
  await pointTo(dest);
  const before = devNames(await devs());
  const idsBefore = idsOf(await trackList());
  note(`   before: [${before.join(', ') || '—'}]`);

  const t0 = Date.now();
  await fire();
  await pollUntil(async () => (await devs()).count === before.length + 1, 12000, 200);
  const ms = Date.now() - t0;
  await wait(300);

  const after = devNames(await devs());
  const delta = after.length - before.length;

  // ⚠ Guard #3/#4 — verify nothing was REMOVED and the delta is possible at all.
  if (idsOf(await trackList()) !== idsBefore) {
    await bail(`the TRACK LIST changed during "${route}" on ${dest.name}. One insert cannot do that.`);
  }
  if (delta < 0 || delta > 1) {
    await bail(`impossible Δdevices=${delta} for one insert on ${dest.name} — reading the wrong object (guard #4).`);
  }
  if (delta === 1 && after.slice(0, before.length).join(',') !== before.join(',')) {
    await bail(`the insert did not APPEND on ${dest.name}: [${before.join(', ')}] → [${after.join(', ')}].`);
  }

  const landed = delta === 1 ? after[after.length - 1]! : null;
  let chains: number | null = null;
  let grew: boolean | null = null;

  if (landed === null) {
    console.log(`   ⇒ ○ NOTHING LANDED  (${ms} ms, device list unchanged)`);
  } else {
    note(`   after:  [${after.join(', ')}]  — landed "${landed}" in ${ms} ms`);
    if (await scope(match, `${dest.name}/${route}`)) {
      const l = await layers();
      chains = l.count;
      note(`   chains: ${chains}  [${showChains(l)}]  (container "${l.cursorDeviceName ?? '?'}")`);

      if (grow && chains > 0) {
        // ⚠ Guard #13 — name the survivor. An explicit chain name is sticky
        // across a content change AND a save+restart (E17 row 5 ●●), so growth
        // can be verified by NAME rather than by a count that a wrong-object
        // read would also produce.
        await req('layer.setName', { layerIndex: 0, name: TAG });
        await wait(300);
        await req('layer.select', { layerIndex: 0, where: 'editor' });
        await wait(300);
        const sel = (await req('layer.selectionState')) as SelState;
        const flagged = sel.layers.findIndex((r) => r.selectedInEditor);
        note(`   selection flag at the call: ${flagged >= 0 ? `chain ${flagged}` : 'NONE'}`
          + `   (observer ${sel.editorObserver})`);
        check(`${dest.name}: the chain selection is SET before the duplicate (e17ak's precondition)`,
          flagged === 0, { flagged, observer: sel.editorObserver });

        await req('layer.duplicateChannel', { layerIndex: 0 });
        await pollUntil(async () => {
          await scope(match, `${dest.name} grow poll`);
          return (await layers()).count !== chains!;
        }, 6000, 250);
        await scope(match, `${dest.name} grow read`);
        const l2 = await layers();
        const d2 = l2.count - chains;
        if (d2 < 0 || d2 > 1) {
          await bail(`impossible Δchains=${d2} for one duplicate on ${dest.name} (guard #4).`);
        }
        grew = d2 === 1;
        // ⚠ Report the count AFTER the duplicate. The first run recorded the
        // pre-growth count here and the summary table read "1 chains" under a body
        // that said "GREW to 2" — a derived line disagreeing with its own evidence.
        chains = l2.count;
        const tagged = l2.layers.filter((c) => c.name.startsWith(TAG)).map((c) => c.name);
        note(`   after duplicate: ${l2.count} chains  [${showChains(l2)}]`);
        console.log(`   ⇒ ${grew ? '●● GREW to ' + l2.count + ' chains, tagged survivors [' + tagged.join(', ') + ']'
          : '○ did NOT grow'}`);
      } else {
        console.log(`   ⇒ ● CONTAINER LANDED with ${chains} chain(s)`);
      }
    } else {
      console.log(`   ⇒ ◐ a device landed but the cursor could not scope it as ${match}`);
    }
  }

  const ok = await restore(dest);
  check(`${dest.name} restored to baseline after "${route}"`, ok,
    { want: baselines.get(dest.channelId), got: devNames(await devs()) });

  const arm: Arm = { dest: dest.name, route, landed, chains, grew, ms };
  arms.push(arm);
  return arm;
}

// ==========================================================================
// Run
// ==========================================================================

console.log('');
console.log('='.repeat(78));
console.log(' E18 §3.3 — can a CONTAINER be placed on the MASTER and an FX RETURN, by us?');
console.log('='.repeat(78));

await client.connect();

const hello = (await req('contract.hello')) as { methodsHash: string; methodCount: number };
note(`wire: ${hello.methodCount} methods, methodsHash ${hello.methodsHash}`);

// ⚠ Two parallel chains SUM the signal. Refuse rather than surprise the operator.
const tp = (await req('transport.status')) as { isPlaying: boolean };
if (tp.isPlaying) {
  console.log('\n⚠⚠ REFUSING: the transport is ROLLING. This probe puts a container on the MASTER,');
  console.log('   and parallel chains sum the signal. Stop the transport and re-run.');
  process.exit(1);
}
check('the transport is stopped (this probe writes to the MASTER)', !tp.isPlaying, tp);

for (const name of [CONTROL, FX_RETURN, MASTER]) {
  const t = await resolve(name);
  destinations.set(name, t);
}
const control = destinations.get(CONTROL)!;
const fxReturn = destinations.get(FX_RETURN)!;
const master = destinations.get(MASTER)!;
note(`destinations: ${[...destinations.values()].map((t) => `${t.name}(${t.type}, ${t.channelId.slice(0, 8)})`).join('  ')}`);
check('the FX return really is an Effect track and the Master really is a Master',
  fxReturn.type === 'Effect' && master.type === 'Master',
  { fx: fxReturn.type, master: master.type });

console.log('\n-- baseline and cursor calibration');
baseTrackIds = idsOf(await trackList());
for (const dest of destinations.values()) {
  const pos = await calibrate(dest);
  cursorPos.set(dest.channelId, pos);
  const d = devNames(await devs());
  baselines.set(dest.channelId, d);
  note(`${dest.name.padEnd(8)} cursorTrackPosition=${String(pos).padStart(3)}  [${d.join(', ') || '—'}]`);
}
// ⚠ An ambiguous readback is not a readback. `position()` is per-parent-group, so
// a child track and a top-level track genuinely collide at 0 in this project.
const positions = [...cursorPos.values()];
if (new Set(positions).size !== positions.length) {
  await bail(`two destinations share a cursorTrackPosition (${positions.join(', ')}) — `
    + 'the landing readback cannot tell them apart (guard #1).');
}
const fpBefore = await fingerprint();

// --------------------------------------------------------------------------
// ⚠ The control runs BEFORE, BETWEEN and AFTER (the e17v ordering fix): a
// recipe that stops working mid-run must produce an early refusal, not three
// uninterpretable ○s on the destinations that matter.
// --------------------------------------------------------------------------
console.log('\n' + '-'.repeat(78));
console.log(' PART 1 — the autonomous recipe: FX Layer by UUID, grown by layer.select + duplicate');
console.log('-'.repeat(78));

const c1 = await place(control, 'insertBitwig(FX Layer) + grow', async () => {
  await req('device.insertBitwig', { cursor: '0', uuid: FX_LAYER });
}, /FX Layer/, true);
if (!c1.landed || !c1.grew) {
  await bail('the CONTROL failed on an ordinary instrument track. Nothing measured here would be '
    + 'interpretable — a ○ on the Master would be about the recipe, not about the Master.');
}

const fx1 = await place(fxReturn, 'insertBitwig(FX Layer) + grow', async () => {
  await req('device.insertBitwig', { cursor: '0', uuid: FX_LAYER });
}, /FX Layer/, true);

const c2 = await place(control, 'insertBitwig(FX Layer) + grow  [control, between]', async () => {
  await req('device.insertBitwig', { cursor: '0', uuid: FX_LAYER });
}, /FX Layer/, true);
if (!c2.landed || !c2.grew) {
  await bail('the CONTROL stopped working between the FX return and the Master arms.');
}

const m1 = await place(master, 'insertBitwig(FX Layer) + grow', async () => {
  await req('device.insertBitwig', { cursor: '0', uuid: FX_LAYER });
}, /FX Layer/, true);

const c3 = await place(control, 'insertBitwig(FX Layer) + grow  [control, after]', async () => {
  await req('device.insertBitwig', { cursor: '0', uuid: FX_LAYER });
}, /FX Layer/, true);

// --------------------------------------------------------------------------
console.log('\n' + '-'.repeat(78));
console.log(' PART 2 — ⚠ the DISCRIMINATOR: an INSTRUMENT container at the same destinations');
console.log('        (separates "the destination refuses CONTAINERS" from "… refuses INSTRUMENTS")');
console.log('-'.repeat(78));

const i0 = await place(control, 'insertBitwig(Instrument Layer)', async () => {
  await req('device.insertBitwig', { cursor: '0', uuid: INSTRUMENT_LAYER });
}, /Instrument Layer/, false);
const i1 = await place(fxReturn, 'insertBitwig(Instrument Layer)', async () => {
  await req('device.insertBitwig', { cursor: '0', uuid: INSTRUMENT_LAYER });
}, /Instrument Layer/, false);
const i2 = await place(master, 'insertBitwig(Instrument Layer)', async () => {
  await req('device.insertBitwig', { cursor: '0', uuid: INSTRUMENT_LAYER });
}, /Instrument Layer/, false);

// --------------------------------------------------------------------------
console.log('\n' + '-'.repeat(78));
console.log(' PART 3 — insertFile, which is what §3.3 asks for by name');
console.log(`        preset: ${PRESET}`);
console.log('-'.repeat(78));

const f0 = await place(control, 'insertFile(4-chain Instrument Layer)', async () => {
  await req('device.insertFile', { cursor: '0', path: PRESET });
}, /Layer/, false);
const f1 = await place(fxReturn, 'insertFile(4-chain Instrument Layer)', async () => {
  await req('device.insertFile', { cursor: '0', path: PRESET });
}, /Layer/, false);
const f2 = await place(master, 'insertFile(4-chain Instrument Layer)', async () => {
  await req('device.insertFile', { cursor: '0', path: PRESET });
}, /Layer/, false);

// --------------------------------------------------------------------------
console.log('\n' + '-'.repeat(78));
console.log(' cleanup and integrity');
console.log('-'.repeat(78));

for (const dest of destinations.values()) {
  check(`${dest.name} is back to baseline`, await restore(dest),
    { want: baselines.get(dest.channelId) });
}
check('the TRACK LIST is untouched by identity (guard #3)', idsOf(await trackList()) === baseTrackIds, {});
const fpAfter = await fingerprint();
check('⚠ the CROSS-TRACK device fingerprint is unchanged — nothing landed off-subject',
  fpAfter === fpBefore, fpAfter === fpBefore ? {} : { before: fpBefore, after: fpAfter });

// --------------------------------------------------------------------------
console.log('\n' + '='.repeat(78));
const cell = (a: Arm) => a.landed === null ? '○ none'
  : a.grew === true ? `●● ${a.chains} chains`
  : a.grew === false ? `◐ landed, no growth`
  : `● ${a.chains ?? '?'} chain(s)`;
console.log(`  ${'route'.padEnd(38)} ${'gn-B'.padEnd(18)} ${'FX 1'.padEnd(18)} Master`);
console.log(`  ${'FX Layer by UUID + grow'.padEnd(38)} ${cell(c1).padEnd(18)} ${cell(fx1).padEnd(18)} ${cell(m1)}`);
console.log(`  ${'Instrument Layer by UUID'.padEnd(38)} ${cell(i0).padEnd(18)} ${cell(i1).padEnd(18)} ${cell(i2)}`);
console.log(`  ${'insertFile (Instrument preset)'.padEnd(38)} ${cell(f0).padEnd(18)} ${cell(f1).padEnd(18)} ${cell(f2)}`);
console.log('='.repeat(78));
note(`⚠ the control BRACKETS the run (e17v ordering): before=${cell(c1)}  between=${cell(c2)}  after=${cell(c3)}`);
check('all three control runs grew — the recipe was live throughout, so every ○ above means something',
  Boolean(c1.grew && c2.grew && c3.grew), { before: c1.grew, between: c2.grew, after: c3.grew });
note(`timings (ms): insertBitwig ${[c1, fx1, m1].map((a) => a.ms).join('/')}  `
  + `insertFile ${[f0, f1, f2].map((a) => a.ms).join('/')}`);
console.log('');

// The verdict, stated so it cannot be over-read.
const reached = Boolean(fx1.grew && m1.grew);
if (reached) {
  note('⚠⚠ §6.1 IS SUPPORTED BY MEASUREMENT, not by assumption. A multi-chain container');
  note('   can be built on both the Master and an FX return with no preset, no named action,');
  note('   no focus and no human — the two places E16r showed leave the addressable set first,');
  note('   and that no track fork can reach at all (§4.8).');
} else if (fx1.landed && m1.landed) {
  note('⚠ A container REACHES both destinations but does not GROW there. §6.1 survives only');
  note('   for a fixed-shape fixture; the autonomous multi-chain build does not transfer, and');
  note('   the preset dependency (rule 11 / E4h) comes back for these two destinations.');
} else {
  note('⚠⚠ §6.1\'s LOAD-BEARING ASSUMPTION IS FALSE for at least one destination.');
  note('   The "layers are the only device-scoped A/B that reaches the Master and the FX');
  note('   returns" argument does not survive, and E17-VERDICT §6 must be rewritten around it.');
}
if (i2.landed === null && f2.landed === null && m1.landed !== null) {
  note('⚠ The DISCRIMINATOR fired: the Master takes an FX Layer and refuses an INSTRUMENT');
  note('   container. So the insertFile ○ is about the container TYPE, not about insertFile');
  note('   and not about the destination — and an FX Layer is exactly the shape §6 wants there.');
}

console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} checks reported a negative — read individually`);
process.exit(0);
