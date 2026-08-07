/**
 * E18 §3.1 — ⚠⚠ can a device be moved OUT of a chain, and ACROSS containers?
 *
 * **E18's main question.** A chain cannot be deleted by any typed route — the
 * best-founded ○ in E17, exhausted across both `DeleteableObject` forms, each with
 * and without the selection precondition that unlocked CREATE, each bracketed by a
 * `Track` sibling control deleting in the same run, and with a mechanism that
 * PREDICTS it (a `DeviceLayer` honours the verb `Channel` declares itself and
 * declines every verb it merely inherits; `Channel` declares no delete at all).
 *
 * So the operator proposed working WITHOUT a delete:
 *
 *     reduce    clone the container with fewer chains, migrate the devices across,
 *               delete the OLD container   (`Device.deleteObject()` is ● already)
 *     collapse  migrate the chosen chain's devices out to top level, then delete
 *               the container
 *
 * ⚠ **This is a NEW shape, not E16's K3 track pattern.** K3 is *delete-all-but-one
 * then `Ungroup`*, which works at TRACK level because track delete works. At device
 * level delete is the blocked thing, so it cannot be step one, and `Ungroup` is not
 * a simplifier here.
 *
 * ⚠ **E16n only ever measured ONE direction — top level INTO a chain.** Every
 * direction the strategy needs is unmeasured, and until this session no wire method
 * could even name a device inside a chain as a SOURCE:
 *
 * | row | direction | needed by |
 * |---|---|---|
 * | 1 | ⚠ **chain → top level** | **collapse** |
 * | 2 | chain → chain, same container | either |
 * | 3 | ⚠ **chain → chain, DIFFERENT containers** | **reduce** |
 * | 4 | ⚠ the **COPY** verb, across containers | a rebuild with no gap in the signal path |
 *
 * ⚠ **Row 4 is not completeness.** Sibling verbs on this very interface disagree —
 * `copyDevices` ○ beside `moveDevices` ● (E4d/E16n), `duplicateObject()` ○ beside
 * `Channel.duplicate()` ● (e17ak/e17am). And copy is the better product primitive:
 * a copy-then-delete-container rebuild never has the device MISSING from the signal
 * path, where a move does. The operator's bar is explicitly *"low on (or free of)
 * intermediate states that are undesirable or glitchy"*.
 *
 * ### The fixture, and why every part of it is named
 *
 *     gn-B  slot 0  Instrument Layer (from the 4-chain preset)
 *                     A0 [Phase-4]  A1 [Polysynth]  A2 [Organ]  A3 [Sampler]
 *           slot 1  FX Layer, grown 1 → 3 by layer.select + duplicateChannel
 *                     B0 [—]  B1 [—]  B2 [—]
 *
 * ⚠ **The chains are RENAMED on purpose, and it is not cosmetic.** E4c: a layer's
 * DEFAULT name tracks its content, so a chain that loses its device renames itself
 * and the inventory becomes unreadable exactly when a move succeeds. An explicitly
 * set name is sticky across a content change (E17 row 5 ●●), so `A2` stays `A2`
 * after the Organ leaves — which is what lets a survivor be NAMED rather than
 * counted (e16t / guard #13). Container B is deliberately EMPTY so any device
 * appearing in it can only have come from A.
 *
 * ### Guards (HANDOFF-E18 §1)
 *
 * - ⚠ **#4, as a conservation law.** Total device population = top-level count +
 *   every device inside every chain. A `move` must CONSERVE it and a `copy` must
 *   add exactly one. Anything else ABORTS rather than scoring — an impossible delta
 *   means we are reading the wrong object.
 * - ⚠ **Both halves of every move.** The source chain must LOSE it *and* the
 *   destination must GAIN it. A verb that silently deleted the device would satisfy
 *   the first alone, and "the chain is now empty" is what a successful move and a
 *   destructive one have in common.
 * - ⚠ **#2/#3, at every level, every arm:** the track list by identity, the
 *   top-level device list, both slots' chain lists, and the devices inside them.
 * - ⚠ **Rule 13.** `slotScopeStatus` must read `held` for both scopes or the probe
 *   ABORTS. *"The handle was never built"* and *"the API declines"* are identical in
 *   the outcome, and three false ○s in E17 came from exactly that confusion.
 * - ⚠ **Two independent readers.** The same container is read through the
 *   cursor-scoped `layer.list` AND the slot-scoped `chain.inventory`, and they are
 *   cross-checked. Two readbacks that could disagree is evidence; one agreeing with
 *   itself is not.
 * - ⚠ **`where` is always `chainEnd` for a move to top level.** `chainStart` would
 *   insert BEFORE the containers and shift them out of slots 0/1, silently
 *   invalidating every scope. The probe asserts the two containers are still at
 *   indices 0 and 1 after every arm.
 * - ⚠ **The E16n direction is the CONTROL**, fired through a different handler
 *   (`layer.moveDeviceInto`) before and after the run — so a ○ on any row means the
 *   direction, not a dead verb or a dead bridge.
 *
 * ⚠ Typed-only: no named actions, no focus, no priming, no foreground, no human.
 */
import { client, check, note, failureCount, pollUntil } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const TRACK = 'gn-B';
const PRESET = '/Users/jonvuri/Development/ghostnote/brain/fixtures/InstrumentLayer/gn_layer_4chain.bwpreset';
const FX_LAYER = 'a0913b7f-096b-4ac9-bddd-33c775314b42';
const POLYSYNTH = 'a9ffacb5-33e9-4fc7-8621-b1af31e410ef';

interface TrackRow { index: number; name: string; type: string; channelId: string }
interface DevList { devices: { index: number; name: string }[]; count: number }
interface ChainRow { index: number; name: string; channelId?: string; devices: { index: number; name: string }[] }
interface Scope { slot: number; status: string; deviceExists: boolean; deviceName: string; hasLayers: boolean; chains: ChainRow[]; chainCount: number }
interface Inventory { scopes: Scope[]; trackName: string }
interface LayerList { layers: ChainRow[]; count: number }
interface ParamList { params: { id: string; exists: boolean; value?: number }[]; existing: number; deviceExists: boolean; deviceName: string }

const near = (a: number, b: number, eps = 0.02) => Math.abs(a - b) <= eps;

// ==========================================================================
// Reading
// ==========================================================================

const trackList = async () => ((await req('track.list')) as { tracks: TrackRow[] }).tracks;
const idsOf = (t: TrackRow[]) => t.map((x) => x.channelId).sort().join(',');
let subject!: TrackRow;
let baseTrackIds = '';

async function fail(message: string): Promise<never> {
  console.log(`\n${'⚠'.repeat(3)} ABORTING: ${message}`);
  console.log('   the fixture is left AS IS for inspection — clear gn-B by hand or re-run.');
  process.exit(1);
}

async function pointSubject(): Promise<void> {
  const row = (await trackList()).find((t) => t.channelId === subject.channelId);
  if (!row) await fail(`"${TRACK}" (${subject.channelId}) is gone from the track list.`);
  await req('cursor.pointTrack', { cursor: '0', trackIndex: row!.index });
  await wait(700);
}

async function devs(): Promise<DevList> {
  let last = ' ';
  let out: DevList = { devices: [], count: 0 };
  await pollUntil(async () => {
    out = (await req('device.list', { cursor: '0' })) as DevList;
    const n = out.devices.map((d) => d.name).join(',');
    const stable = n === last; last = n; return stable;
  }, 5000, 200);
  return out;
}

/** Scope the CURSOR-based layer bank onto a top-level slot (for the control + renames). */
async function scopeCursor(slot: number, tag: string): Promise<void> {
  const d = await devs();
  const target = d.devices.find((x) => x.index === slot);
  if (!target) await fail(`${tag}: no device at top-level index ${slot}.`);
  await req('devcursor.selectAt', { deviceIndex: slot });
  const ok = await pollUntil(async () => {
    const s = (await req('devcursor.status')) as { exists: boolean; name: string };
    return s.exists && s.name === target!.name;
  }, 6000, 150);
  if (!ok.ok) await fail(`${tag}: the device cursor never landed on slot ${slot} ("${target!.name}").`);
}

interface State { top: string[]; scopes: Scope[]; population: number; trackIds: string }

/**
 * Read EVERY level in one pass, and refuse if the rig cannot support the reading.
 */
async function state(tag: string): Promise<State> {
  const trackIds = idsOf(await trackList());
  const top = (await devs()).devices.map((x) => x.name);
  const inv = (await req('chain.inventory')) as Inventory;

  // ⚠ The scopes follow `cursorTracks[0]`. If anything re-pointed it, every index
  // below names a different track's devices and the whole read is fiction.
  if (inv.trackName !== TRACK) {
    await fail(`${tag}: the slot scopes are on "${inv.trackName}", not "${TRACK}". `
      + 'Something re-pointed the track cursor and every index below is meaningless.');
  }
  // ⚠ Rule 13: a scope that was never built reads exactly like an API refusal.
  for (const s of inv.scopes) {
    if (s.status !== 'held') {
      await fail(`${tag}: slot scope ${s.slot} reports status "${s.status}" — a missing handle and `
        + 'a refusal are indistinguishable in the outcome (three false ○s in E17 came from this).');
    }
  }
  const population = top.length
    + inv.scopes.reduce((n, s) => n + s.chains.reduce((m, c) => m + c.devices.length, 0), 0);
  return { top, scopes: inv.scopes, population, trackIds };
}

const chainsOf = (s: State, slot: number) => s.scopes.find((x) => x.slot === slot)?.chains ?? [];
const chain = (s: State, slot: number, name: string) => chainsOf(s, slot).find((c) => c.name === name);
const showSlot = (s: State, slot: number) =>
  chainsOf(s, slot).map((c) => `${c.name}[${c.devices.map((d) => d.name).join('+') || '—'}]`).join(' ') || '—';
function show(s: State, tag: string): void {
  note(`${tag.padEnd(9)} top=[${s.top.join(', ')}]`);
  note(`${''.padEnd(9)} A: ${showSlot(s, 0)}`);
  note(`${''.padEnd(9)} B: ${showSlot(s, 1)}`);
}

/** ⚠ The containers must stay at top-level indices 0 and 1 or every scope is wrong. */
async function assertSlots(s: State, tag: string): Promise<void> {
  const a = s.scopes.find((x) => x.slot === 0);
  const b = s.scopes.find((x) => x.slot === 1);
  if (a?.deviceName !== 'Instrument Layer' || b?.deviceName !== 'FX Layer') {
    await fail(`${tag}: the slot scopes no longer name the fixture containers `
      + `(slot 0 = "${a?.deviceName}", slot 1 = "${b?.deviceName}"). A chainStart insert would do this.`);
  }
}

// ==========================================================================
// The arm
// ==========================================================================

interface Row { label: string; ok: boolean | null; detail: string }
const rows: Row[] = [];

/**
 * Fire one relocation and score BOTH halves of it.
 *
 * `expect` names the source chain that must lose the device and the destination
 * that must gain it — by NAME, never by count (e16t / guard #13).
 */
async function relocate(
  label: string,
  params: Record<string, unknown>,
  src: { slot: number; chain: string },
  dst: { slot: number; chain: string } | 'top',
  device: string,
  copying: boolean,
): Promise<Row> {
  console.log(`\n  ${label}`);
  const before = await state(`${label} before`);
  await assertSlots(before, `${label} before`);
  show(before, 'before');

  const srcChainBefore = chain(before, src.slot, src.chain);
  if (!srcChainBefore || !srcChainBefore.devices.some((d) => d.name === device)) {
    await fail(`${label}: the source chain ${src.chain} does not hold a ${device} `
      + `(it holds [${srcChainBefore?.devices.map((d) => d.name).join(', ') ?? 'NOTHING'}]).`);
  }

  // ⚠ Read the source chain's size BEFORE firing. `await fail()` does not narrow
  // the type for TypeScript, and reaching for the handle again after the verb has
  // fired is exactly the re-index hazard E3 warns about.
  // (`!` because `await fail()` exits the process but does not narrow for TS.)
  const srcCountBefore = srcChainBefore!.devices.length;

  const t0 = Date.now();
  const ack = (await req('chain.move', params)) as Record<string, unknown>;
  note(`   ack: source="${ack.sourceName}" in chain "${ack.sourceChain}" of "${ack.sourceContainer}"`
    + (ack.dstChain ? ` → chain "${ack.dstChain}" of "${ack.dstContainer}"` : ' → top level'));
  await pollUntil(async () => {
    const s = await state(`${label} poll`);
    return s.population !== before.population
      || (chain(s, src.slot, src.chain)?.devices.length ?? -1) !== srcCountBefore
      || s.top.length !== before.top.length;
  }, 6000, 250);
  await wait(400);
  const ms = Date.now() - t0;

  const after = await state(`${label} after`);
  show(after, 'after');

  // ⚠ Guard #3/#4 — the conservation law, and the track list by identity.
  if (after.trackIds !== before.trackIds) {
    await fail(`${label}: the TRACK LIST changed. A device relocation cannot do that.`);
  }
  const want = before.population + (copying ? 1 : 0);
  if (after.population !== want) {
    await fail(`${label}: device population went ${before.population} → ${after.population}, `
      + `expected ${want} for a ${copying ? 'copy' : 'move'}. An impossible delta means the wrong `
      + 'object is being read — refusing to score (guard #4).');
  }
  await assertSlots(after, `${label} after`);

  // ⚠ BOTH halves. "The source chain is empty" is what a successful move and a
  // destructive one have in common, so the destination must be checked too.
  const srcAfter = chain(after, src.slot, src.chain);
  const srcLost = copying
    ? (srcAfter?.devices.some((d) => d.name === device) ?? false)   // a copy must NOT lose it
    : !(srcAfter?.devices.some((d) => d.name === device) ?? true);
  const dstGained = dst === 'top'
    ? after.top.filter((n) => n === device).length > before.top.filter((n) => n === device).length
    : (chain(after, dst.slot, dst.chain)?.devices.some((d) => d.name === device) ?? false);

  const ok = srcLost && dstGained;
  const where = dst === 'top' ? 'top level' : `${dst.chain}`;
  const detail = copying
    ? `source ${srcLost ? 'KEPT ●' : 'LOST ⚠'} its ${device}; ${where} ${dstGained ? 'gained ●' : 'did not gain ○'}`
    : `${src.chain} ${srcLost ? 'lost ●' : 'kept ○'} its ${device}; ${where} ${dstGained ? 'gained ●' : 'did not gain ○'}`;
  console.log(`   ⇒ ${ok ? '●● ' : '○  '}${detail}   (${ms} ms)`);

  const row: Row = { label, ok, detail };
  rows.push(row);
  return row;
}

// ==========================================================================
// Run
// ==========================================================================

console.log('');
console.log('='.repeat(78));
console.log(' E18 §3.1 — can a device be moved OUT of a chain, and ACROSS containers?');
console.log('='.repeat(78));

await client.connect();
const hello = (await req('contract.hello')) as { methodsHash: string; methodCount: number };
note(`wire: ${hello.methodCount} methods, methodsHash ${hello.methodsHash}`);

const hits = (await trackList()).filter((t) => t.name === TRACK);
if (hits.length !== 1) { console.log(`⚠⚠ REFUSING: ${hits.length} tracks named "${TRACK}" (guard #1).`); process.exit(1); }
subject = hits[0]!;
baseTrackIds = idsOf(await trackList());
await pointSubject();

// -------------------------------------------------------------------- fixture
console.log('\n-- fixture');
let d = await devs();
for (let guard = 0; guard < 12 && d.count > 0; guard++) {
  await req('device.delete', { cursor: '0', deviceIndex: d.devices[0]!.index });
  await pollUntil(async () => (await devs()).count < d.count, 6000, 200);
  d = await devs();
}
check(`${TRACK} cleared`, d.count === 0, { devices: d.devices.map((x) => x.name) });

await req('device.insertFile', { cursor: '0', path: PRESET });
await pollUntil(async () => (await devs()).count === 1, 12000, 200);
await req('device.insertBitwig', { cursor: '0', uuid: FX_LAYER });
await pollUntil(async () => (await devs()).count === 2, 12000, 200);
await wait(500);

// ⚠ Grow B to three chains BEFORE renaming: a duplicate inherits the name it is
// copied from, so renaming first would produce three chains all called B0.
await scopeCursor(1, 'grow B');
for (let i = 0; i < 2; i++) {
  await req('layer.select', { layerIndex: 0, where: 'editor' });
  await wait(250);
  await req('layer.duplicateChannel', { layerIndex: 0 });
  await pollUntil(async () => ((await req('layer.list')) as LayerList).count === i + 2, 6000, 250);
}
const bGrown = (await req('layer.list')) as LayerList;
check('container B grew to 3 chains', bGrown.count === 3, { count: bGrown.count });
for (let i = 0; i < 3; i++) { await req('layer.setName', { layerIndex: i, name: `B${i}` }); await wait(200); }

await scopeCursor(0, 'rename A');
const aChains = (await req('layer.list')) as LayerList;
check('container A carries the preset\'s 4 chains', aChains.count === 4, { count: aChains.count });
for (let i = 0; i < 4; i++) { await req('layer.setName', { layerIndex: i, name: `A${i}` }); await wait(200); }
await wait(400);

const built = await state('fixture');
show(built, 'built');
await assertSlots(built, 'fixture');
check('⚠ both slot scopes report status "held" (standing rule 13)',
  built.scopes.every((s) => s.status === 'held'), { status: built.scopes.map((s) => s.status) });
check('A holds [Phase-4, Polysynth, Organ, Sampler] one per named chain',
  ['A0', 'A1', 'A2', 'A3'].every((n, i) =>
    chain(built, 0, n)?.devices.map((x) => x.name).join('') === ['Phase-4', 'Polysynth', 'Organ', 'Sampler'][i]),
  { A: showSlot(built, 0) });
check('B holds three EMPTY named chains — anything appearing there came from A',
  ['B0', 'B1', 'B2'].every((n) => chain(built, 1, n)?.devices.length === 0), { B: showSlot(built, 1) });

/**
 * ⚠ Two independent readers on the same container. `layer.list` reaches it through
 * `cursorDevice0`; `chain.inventory` reaches it through a bank hung off the top-level
 * device SLOT. They share no handle, so agreement is evidence — where one reader
 * agreeing with itself is not (rule 10 / rule 3a).
 */
await scopeCursor(0, 'cross-read');
const viaCursor = (await req('layer.list')) as LayerList;
check('⚠ the cursor-scoped and slot-scoped readers AGREE on container A',
  viaCursor.layers.map((c) => `${c.name}:${c.devices.map((x) => x.name).join('+')}`).join(' ')
    === chainsOf(built, 0).map((c) => `${c.name}:${c.devices.map((x) => x.name).join('+')}`).join(' '),
  { cursor: viaCursor.layers.map((c) => c.name), slot: chainsOf(built, 0).map((c) => c.name) });

// ------------------------------------------------------- CONTROL, before
console.log('\n' + '-'.repeat(78));
console.log(' CONTROL (before) — the E16n direction through a DIFFERENT handler');
console.log('-'.repeat(78));
await req('device.insertBitwig', { cursor: '0', uuid: POLYSYNTH });
await pollUntil(async () => (await devs()).count === 3, 12000, 200);
await wait(400);
await scopeCursor(1, 'control before');
await req('layer.moveDeviceInto', { layerIndex: 2, deviceIndex: 2 });
await pollUntil(async () => (await devs()).count === 2, 8000, 250);
await wait(400);
const ctlBefore = await state('control before');
show(ctlBefore, 'control');
const controlBeforeOk = chain(ctlBefore, 1, 'B2')?.devices.some((x) => x.name === 'Polysynth') ?? false;
check('⚠ CONTROL: top level → chain still works (E16n, via layer.moveDeviceInto)',
  controlBeforeOk, { B: showSlot(ctlBefore, 1) });
if (!controlBeforeOk) {
  await fail('the E16n direction failed BEFORE any chain.move fired. `moveDevices` is not live in '
    + 'this sitting, so every ○ below would be about the verb rather than about the direction.');
}

// ------------------------------------------------------- ROW 1
console.log('\n' + '-'.repeat(78));
console.log(' ROW 1 — ⚠ chain → TOP LEVEL, the collapse primitive (with STATE)');
console.log('-'.repeat(78));

/**
 * ⚠ State is marked BEFORE the move and read back through a DIFFERENT handle
 * afterwards (rule 3a / D15): Bitwig's cursors cache what you wrote and report it
 * back whether or not it landed, and two spike findings were wrong for that reason.
 * Two parameters, not one — a single value could coincide with a fresh instance's
 * default and read as "state survived" when the device was silently replaced (e16o).
 */
await scopeCursor(0, 'mark');
await req('devcursor.selectFirstInLayer', { layerIndex: 1 });
await wait(600);
const onPoly = (await req('devcursor.status')) as { exists: boolean; name: string };
check('the device cursor descended onto A1\'s Polysynth', onPoly.exists && onPoly.name === 'Polysynth', onPoly);
const beforeParams = (await req('param.list')) as ParamList;
check('the nested Polysynth exposes parameters to mark',
  beforeParams.deviceExists && beforeParams.existing > 0,
  { device: beforeParams.deviceName, existing: beforeParams.existing });
const marks: { id: string; want: number }[] = [];
for (const p of beforeParams.params.filter((x) => x.exists).slice(0, 2)) {
  const want = (p.value ?? 0) > 0.5 ? 0.17 : 0.83;
  await req('param.set', { id: p.id, value: want });
  marks.push({ id: p.id, want });
}
await wait(500);
const marked = (await req('param.list')) as ParamList;
for (const m of marks) {
  const got = marked.params.find((x) => x.id === m.id)?.value;
  check(`mark landed on ${m.id} before the move (${got?.toFixed(3)})`,
    got !== undefined && near(got, m.want), { want: m.want, got });
}

const row1 = await relocate(
  'ROW 1 — A1\'s Polysynth → TOP LEVEL (chainEnd)',
  { srcSlot: 0, srcLayer: 1, srcDevice: 0, dst: 'top', where: 'chainEnd', verb: 'move' },
  { slot: 0, chain: 'A1' }, 'top', 'Polysynth', false);

if (row1.ok) {
  const top = await devs();
  const at = top.devices.findIndex((x) => x.name === 'Polysynth');
  await req('devcursor.selectAt', { deviceIndex: top.devices[at]!.index });
  await wait(600);
  const landedOn = (await req('devcursor.status')) as { exists: boolean; name: string };
  check('the relocated device is reachable at top level as a Polysynth',
    landedOn.exists && landedOn.name === 'Polysynth', landedOn);
  const afterParams = (await req('param.list')) as ParamList;
  let kept = 0;
  for (const m of marks) {
    const got = afterParams.params.find((x) => x.id === m.id)?.value;
    const held = got !== undefined && near(got, m.want);
    if (held) kept++;
    check(`⚠ STATE: ${m.id} survived the relocation OUT of the chain (${got?.toFixed(3)} vs ${m.want})`,
      held, { want: m.want, got });
  }
  note(`   ⇒ ${kept}/${marks.length} marks survived — read through a different handle than wrote them`);
}

// ------------------------------------------------------- ROWS 2, 3, 4
console.log('\n' + '-'.repeat(78));
console.log(' ROW 2 — chain → chain, SAME container');
console.log('-'.repeat(78));
const row2 = await relocate(
  'ROW 2 — A2\'s Organ → A0',
  { srcSlot: 0, srcLayer: 2, srcDevice: 0, dst: 'chain', dstSlot: 0, dstLayer: 0, verb: 'move' },
  { slot: 0, chain: 'A2' }, { slot: 0, chain: 'A0' }, 'Organ', false);

console.log('\n' + '-'.repeat(78));
console.log(' ROW 3 — ⚠ chain → chain, DIFFERENT containers: the REDUCE primitive');
console.log('-'.repeat(78));
const row3 = await relocate(
  'ROW 3 — A3\'s Sampler → B0 (a different container)',
  { srcSlot: 0, srcLayer: 3, srcDevice: 0, dst: 'chain', dstSlot: 1, dstLayer: 0, verb: 'move' },
  { slot: 0, chain: 'A3' }, { slot: 1, chain: 'B0' }, 'Sampler', false);

console.log('\n' + '-'.repeat(78));
console.log(' ROW 4 — ⚠ the COPY verb across containers: a rebuild with NO gap in the signal path');
console.log('-'.repeat(78));
const row4 = await relocate(
  'ROW 4 — COPY A0\'s Phase-4 → B1',
  { srcSlot: 0, srcLayer: 0, srcDevice: 0, dst: 'chain', dstSlot: 1, dstLayer: 1, verb: 'copy' },
  { slot: 0, chain: 'A0' }, { slot: 1, chain: 'B1' }, 'Phase-4', true);

// ------------------------------------------------------- CONTROL, after
console.log('\n' + '-'.repeat(78));
console.log(' CONTROL (after) — the same known-● direction, once every row has fired');
console.log('-'.repeat(78));
const nowTop = await devs();
if (!nowTop.devices.some((x) => x.name === 'Polysynth')) {
  await req('device.insertBitwig', { cursor: '0', uuid: POLYSYNTH });
  await pollUntil(async () => (await devs()).devices.some((x) => x.name === 'Polysynth'), 12000, 200);
  await wait(400);
}
const topNow = await devs();
const polyAt = topNow.devices.find((x) => x.name === 'Polysynth')!;
await scopeCursor(0, 'control after');
await req('layer.moveDeviceInto', { layerIndex: 1, deviceIndex: polyAt.index });
await pollUntil(async () => !(await devs()).devices.some((x) => x.name === 'Polysynth'), 8000, 250);
await wait(400);
const ctlAfter = await state('control after');
show(ctlAfter, 'control');
check('⚠ CONTROL: top level → chain STILL works after every chain.move fired',
  chain(ctlAfter, 0, 'A1')?.devices.some((x) => x.name === 'Polysynth') ?? false,
  { A: showSlot(ctlAfter, 0) });

// ------------------------------------------------------- cleanup
console.log('\n' + '-'.repeat(78));
console.log(' cleanup');
console.log('-'.repeat(78));
await pointSubject();
let left = await devs();
for (let guard = 0; guard < 12 && left.count > 0; guard++) {
  await req('device.delete', { cursor: '0', deviceIndex: left.devices[0]!.index });
  await pollUntil(async () => (await devs()).count < left.count, 6000, 200);
  left = await devs();
}
check(`${TRACK} is empty again`, left.count === 0, { devices: left.devices.map((x) => x.name) });
check('the TRACK LIST is untouched by identity', idsOf(await trackList()) === baseTrackIds, {});

// ------------------------------------------------------- verdict
console.log('\n' + '='.repeat(78));
for (const r of rows) console.log(`  ${r.ok ? '●●' : '○ '}  ${r.label}`);
console.log('='.repeat(78));
console.log('');

const collapse = row1.ok;
const reduce = row3.ok;
if (collapse && reduce) {
  note('⚠⚠ THE REBUILD STRATEGY IS MECHANICALLY AVAILABLE. Both primitives work:');
  note('   collapse — a chain\'s devices can be migrated OUT to top level, so a chosen take');
  note('              can be kept and the container then deleted (Device.deleteObject ●).');
  note('   reduce   — devices can be migrated ACROSS containers, so a container can be');
  note('              cloned with fewer chains and its contents carried over.');
  note('   ⇒ the missing chain DELETE stops being a wall and becomes a cost.');
  if (row4.ok) {
    note('⚠ And COPY works too, which is the better primitive: a copy-then-delete rebuild');
    note('  never has the device missing from the signal path.');
  } else {
    note('⚠ But COPY does NOT work, so every rebuild has a window where the device is out of');
    note('  the signal path — the intermediate-state cost the operator asked about, and it is');
    note('  now a measured property rather than a worry.');
  }
  note('⚠ STILL OWED before this is a recommendation, not a mechanism: modulator routings');
  note('  across a relocation, chain-level state (colour and sends), audible glitch, undo');
  note('  granularity, atomicity, and cost at realistic N.');
} else if (collapse && !reduce) {
  note('⚠ COLLAPSE works and REDUCE does not. A chosen take can be rescued, but a container');
  note('  cannot be rebuilt narrower — so the shape is "keep one and dissolve", never "shrink".');
} else if (!collapse) {
  note('⚠⚠ THE REBUILD STRATEGY IS BLOCKED AT ITS FIRST STEP. A device cannot leave a chain,');
  note('   so neither collapse nor reduce is available, and the chain DELETE ○ stands as a hard');
  note('   wall on the layer model rather than a cost. ⚠ The control passed on both sides, so');
  note('   this is the DIRECTION refusing, not the verb.');
}

console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} checks reported a negative — read individually`);
process.exit(0);
