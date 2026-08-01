/**
 * E16 §3.1 — can an EXISTING device be MOVED into a layer chain?
 *
 * E4d route 3 recorded `InsertionPoint.copyDevices()` into a layer as a silent
 * no-op and concluded devices cannot be relocated into layer chains. ⚠ **That
 * rests on a single mechanism**, which is the exact shape that has produced four
 * false negatives in this spike (CLAP params, `channelId`, chain creation, group
 * creation) — and E4d itself exists only because E4c's ○ was overturned the same
 * way. The complete-recall sweep of all 1968 API members found exactly three
 * device-relocation verbs on `InsertionPoint`: `copyDevices` (measured ○),
 * `moveDevices` and `paste()`. **Neither of the last two has ever been called.**
 *
 * Why it matters: FX returns cannot be forked — other tracks' sends still feed
 * the original, so duplicating one isolates nothing. If devices can be relocated
 * into layer chains, a chain selector becomes a device-scoped A/B that costs no
 * bank slot and no duplication glitch, and reaches the master and the returns,
 * which the track-native model cannot.
 *
 * ### ⚠ The controls are the design, not decoration
 *
 * A bare "we called `moveDevices` into a layer and nothing happened" is worth
 * nothing, because two completely different worlds produce that observation:
 * **layers refuse relocation**, or **`moveDevices` does nothing anywhere**. The
 * first is a finding about layers; the second is a finding about the verb, and
 * writing it up as the first would be E6's mistake — its control was a different
 * object read through a different oracle, so it could not separate "the channel
 * is dead" from "this action does nothing".
 *
 * So every run takes two independent controls and the verdict is the 2x2:
 *
 *   DEST  `layer.insertDevice(0, Polysynth)` — does this layer chain accept a
 *         Polysynth at all? (E4c measured ●; re-run here IN SITU, because a
 *         control measured on another day in another fixture is an assumption)
 *   VERB  `device.moveTo` — does `moveDevices` relocate a device between two
 *         positions in one flat chain, where no nesting is involved?
 *
 * | VERB | DEST | target | reading |
 * |------|------|--------|---------|
 * |  ●   |  ●   |   ●    | devices CAN be relocated into layers; E4d route 3's ○ was VERB-specific |
 * |  ●   |  ●   |   ○    | layers specifically refuse relocation — E4d's conclusion stands, now on two verbs plus a live control |
 * |  ○   |  ●   |   ○    | ⚠ INCONCLUSIVE about layers — the verb is dead everywhere |
 * |  —   |  ○   |   —    | the rig is broken; refuse to report anything |
 *
 * ⚠ **The moved device is a Polysynth on purpose.** E4c proved a Polysynth can
 * be *inserted* into an FX Layer chain, so a refusal cannot be explained away as
 * "that device type does not belong there" — the only difference between the
 * control and the target is the verb.
 *
 * ⚠ **`layer.pasteInto` is deliberately NOT called here.** It takes its content
 * from the clipboard, and filling that programmatically would mean
 * `Application.cut()`/`copy()` acting on the UI selection our own addressing
 * sets — E6 blocker 3, the mechanism that made seven orphan duplicates and was
 * observed live again in `e16j`. Pasting whatever the human happens to be
 * carrying would also corrupt the device diff this probe reads its verdict from.
 * It is on the wire, and it is a human-assisted follow-up worth taking only if
 * the target below comes back ○.
 *
 * Silent: structural device ops only, no clip is ever launched. Runs on `gn-A`
 * and clears its device chain before and after. Safe on a non-TTY.
 */
import { client, check, note, failureCount, pollUntil, point, ensureFixtureTracks } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const MECH = 'trackThenSlot';
const FX_LAYER = 'a0913b7f-096b-4ac9-bddd-33c775314b42';
const POLYSYNTH = 'a9ffacb5-33e9-4fc7-8621-b1af31e410ef';

/** E8/D10: a device insert needs its settle budget before the chain reads back. */
const DEVICE_SETTLE = 800;
/** Layer observers stream in after the cursor lands (E4c). */
const LAYER_SETTLE = 600;

type DevList = { count: number; itemCount: number; devices: { index: number; name: string }[] };
type LayerList = {
  count: number; hasLayers?: boolean;
  layers: { index: number; name: string; devices: { index: number; name: string }[] }[];
};

const devList = async () => (await req('device.list', { cursor: '0' })) as DevList;

/**
 * ⚠ `layer.list` reads `rig.layerBank0`, which FOLLOWS `cursorDevice0`. Every
 * top-level insert can move that cursor, so the container is re-selected before
 * every single read — a layer list taken while the cursor sits on the wrong
 * device reports `count: 0` and looks exactly like "the layer is empty".
 */
async function layersOfContainer(containerIndex: number): Promise<LayerList> {
  await req('devcursor.selectAt', { deviceIndex: containerIndex });
  await wait(LAYER_SETTLE);
  return (await req('layer.list')) as LayerList;
}

const names = (l: DevList) => l.devices.map((d) => d.name);
const layerDevNames = (l: LayerList) => (l.layers[0]?.devices ?? []).map((d) => d.name);

async function clearDevices(): Promise<boolean> {
  let l = await devList();
  for (let guard = 0; guard < 12 && l.count > 0; guard++) {
    await req('device.delete', { cursor: '0', deviceIndex: l.devices[0]!.index });
    await pollUntil(async () => (await devList()).count < l.count, 6000, 100);
    l = await devList();
  }
  return l.count === 0;
}

async function insertTop(uuid: string): Promise<void> {
  const before = (await devList()).count;
  await req('device.insertBitwig', { cursor: '0', uuid });
  const ok = await pollUntil(async () => (await devList()).count === before + 1, 10000, 100);
  if (!ok.ok) throw new Error(`device insert never appeared (still ${before})`);
  await wait(DEVICE_SETTLE);
}

await client.connect();
console.log('connected\n');

const { trackA } = await ensureFixtureTracks();
await point('0', trackA, 0, MECH);
note(`working on gn-A (bank index ${trackA}); its device chain is cleared before and after`);

// ==========================================================================
// 0. the fixture: an FX Layer with its one shipped chain, plus a device to move
// ==========================================================================
console.log('\n-- 0. fixture');
check('gn-A device chain cleared before building the fixture', await clearDevices(), {});

await insertTop(FX_LAYER);
await insertTop(POLYSYNTH);
const built = await devList();
note(`top-level chain: [${names(built).join(', ')}]`);
check('the fixture is [FX Layer, Polysynth] at top level',
  built.count === 2 && built.devices[0]?.name === 'FX Layer', { devices: names(built) });

const empty = await layersOfContainer(0);
note(`FX Layer ships with ${empty.count} chain(s), holding [${layerDevNames(empty).join(', ') || '—'}]`);
check('the FX Layer has exactly ONE chain and it is EMPTY — the destination for the move',
  empty.count === 1 && layerDevNames(empty).length === 0,
  { chains: empty.count, contents: layerDevNames(empty),
    why: 'E4c: FX Layer ships with 1 chain and will not grow; the Selectors ship with 0' });

if (empty.count !== 1) {
  console.log('\nREFUSING: the destination chain is not in the expected state, so neither the ');
  console.log('target nor its controls would mean anything.');
  await clearDevices();
  process.exit(1);
}

// ==========================================================================
// 1. THE TARGET — moveDevices into the layer chain, attempted on an EMPTY layer
// ==========================================================================
/**
 * Run FIRST, deliberately, so the target gets the cleanest and most natural
 * conditions available: an empty destination chain and a chain-order diff that
 * nothing else has disturbed. The controls follow and cannot bias it.
 */
console.log('\n-- 1. TARGET: layer.moveDeviceInto — move the top-level Polysynth into the layer');

const preMove = await devList();
const polyIndex = preMove.devices.findIndex((d) => d.name === 'Polysynth');
check('the Polysynth is addressable at top level before the move',
  polyIndex >= 0, { devices: names(preMove), polyIndex });

const moveAck = await req('layer.moveDeviceInto', { layerIndex: 0, deviceIndex: polyIndex });
note(`layer.moveDeviceInto acknowledged: ${JSON.stringify(moveAck)}`);
await wait(DEVICE_SETTLE);

// ⚠ Verified by DIFF on both sides, never by the acknowledgement above. E6
// blocker 4: a resolved call that did nothing is indistinguishable from one that
// worked, from the return value alone.
const afterLayers = await layersOfContainer(0);
const afterTop = await devList();
note(`after the move — top level: [${names(afterTop).join(', ')}]`);
note(`after the move — layer 0:   [${layerDevNames(afterLayers).join(', ') || '—'}]`);

const landedInside = layerDevNames(afterLayers).includes('Polysynth');
const leftTopLevel = !names(afterTop).includes('Polysynth');
const TARGET = landedInside && leftTopLevel;

check('MOVE DIFF IS COHERENT — the device either moved on both sides or neither, '
  + 'never appearing in two places at once (this checks the reading, not the answer)',
  landedInside === leftTopLevel,
  { landedInside, leftTopLevel,
    warning: landedInside !== leftTopLevel
      ? '⚠ the device is in BOTH or NEITHER place — this is a COPY or a partial op, not a move'
      : 'coherent' });

// ==========================================================================
// 2. CONTROL — DEST: does this layer chain accept a Polysynth at all?
// ==========================================================================
console.log('\n-- 2. CONTROL (destination): layer.insertDevice into the same chain');

const beforeInsert = layerDevNames(await layersOfContainer(0)).length;
await req('layer.insertDevice', { layerIndex: 0, uuid: POLYSYNTH });
await wait(DEVICE_SETTLE);
const afterInsert = await layersOfContainer(0);
const DEST_OK = layerDevNames(afterInsert).length === beforeInsert + 1;
note(`layer 0 contents: ${beforeInsert} -> ${layerDevNames(afterInsert).length} `
  + `[${layerDevNames(afterInsert).join(', ') || '—'}]`);
check('DEST CONTROL — the layer chain accepts an inserted Polysynth (E4c ●, re-run in situ), '
  + 'so a refused MOVE cannot be blamed on the destination or on the device type',
  DEST_OK, { before: beforeInsert, after: layerDevNames(afterInsert) });

// ==========================================================================
// 3. CONTROL — VERB: is moveDevices alive at all, on a flat same-track chain?
// ==========================================================================
console.log('\n-- 3. CONTROL (verb): device.moveTo — reorder two devices in one flat chain');

// Guarantee two top-level devices whatever happened above.
if ((await devList()).count < 2) await insertTop(POLYSYNTH);
const preReorder = await devList();
note(`top-level order before: [${names(preReorder).join(', ')}]`);

let VERB_OK = false;
let reorderNote = 'not attempted';
if (preReorder.count >= 2) {
  const from = preReorder.count - 1;
  const moveToAck = await req('device.moveTo', {
    cursor: '0', deviceIndex: from, where: 'before', anchorIndex: 0,
  });
  await wait(DEVICE_SETTLE);
  const postReorder = await devList();
  note(`top-level order after:  [${names(postReorder).join(', ')}]`);
  // The order changed, and nothing was created or destroyed — a MOVE, not an insert.
  VERB_OK = postReorder.count === preReorder.count
    && names(postReorder).join('|') !== names(preReorder).join('|');
  reorderNote = `${JSON.stringify(moveToAck)}`;
  check('VERB CONTROL — moveDevices reorders a flat chain, so the verb dispatches and is '
    + 'not a universal no-op',
    VERB_OK,
    { before: names(preReorder), after: names(postReorder),
      countStable: postReorder.count === preReorder.count,
      why: 'if this FAILS the target above is INCONCLUSIVE about layers' });
} else {
  check('VERB CONTROL had two devices to reorder', false, { count: preReorder.count });
}

// ==========================================================================
// 4. the verdict — the 2x2, computed
// ==========================================================================
console.log('\n=== VERDICT ===');
console.log(`  VERB control (flat reorder):        ${VERB_OK ? '●' : '○'}`);
console.log(`  DEST control (insert into layer):   ${DEST_OK ? '●' : '○'}`);
console.log(`  TARGET (moveDevices into a layer):  ${TARGET ? '●' : '○'}`);
console.log('');

let reading: string;
if (!DEST_OK) {
  reading = '⚠ RIG BROKEN — the destination chain would not accept an insert either. '
    + 'Nothing in this run is reportable; fix the fixture and re-run.';
} else if (TARGET) {
  reading = '● DEVICES CAN BE RELOCATED INTO LAYER CHAINS. E4d route 3\'s ○ was '
    + 'VERB-SPECIFIC, not a property of layers — the FIFTH single-mechanism false '
    + 'negative of this spike. §3.1\'s chain-selector route is mechanically open, and '
    + '§3.4e (switching glitch/latency/sends) becomes worth measuring.';
} else if (VERB_OK) {
  reading = '○ LAYERS SPECIFICALLY REFUSE RELOCATION. The verb dispatches (flat reorder ●) '
    + 'and the destination accepts inserts (●), so the refusal is a property of moving '
    + 'INTO a layer chain. E4d\'s conclusion STANDS, now on two verbs plus two live '
    + 'controls rather than a single mechanism. ⚠ `layer.pasteInto` remains untried and '
    + 'is the last route — it needs a human to fill the clipboard.';
} else {
  reading = '⚠ INCONCLUSIVE ABOUT LAYERS. `moveDevices` did not move a device even within '
    + 'one flat chain, so this run says the VERB is inert and says nothing about layers. '
    + 'Do NOT write this up as a finding about layer containers.';
}
console.log(`  ${reading}`);
note(`device.moveTo returned: ${reorderNote}`);

check('the run reached a reportable verdict (the DEST control held)', DEST_OK,
  { verb: VERB_OK, dest: DEST_OK, target: TARGET, reading });

// ==========================================================================
// 5. cleanup
// ==========================================================================
console.log('\n-- 5. cleanup');
const cleared = await clearDevices();
check('gn-A device chain cleared — the fixture track is back as found', cleared,
  { remaining: (await devList()).count });

console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} FAILURES`);
process.exit(failureCount() === 0 ? 0 : 1);
