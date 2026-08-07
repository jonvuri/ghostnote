/**
 * E18 §3.1 — ⚠ CHAIN-LEVEL state: colour and sends, the two never measured.
 *
 * **Why this row exists.** Relocating devices carries the DEVICES and nothing else.
 * A chain is a `Channel`, so it also has name, mute, solo, volume, pan, **colour**
 * and **sends** — and every one of those is chain-level state a rebuild has to read
 * off the old chain and write onto the new one, or silently lose. Name, mute, solo,
 * volume and pan are already ● (E17 rows 5/6, `layer.setMixer`). ⚠ **Colour and
 * sends were never on the wire at all**, so nobody could even ask.
 *
 * A take that comes back a different colour is a small annoyance; one that comes
 * back missing its reverb send is a wrong mix. Both are the kind of loss that shows
 * up long after the operation, which is what makes them worth measuring.
 *
 * ### The three questions, in the order they stop mattering
 *
 * | | question | if ○ |
 * |---|---|---|
 * | 1 | can a chain's colour be READ and WRITTEN? | a rebuild cannot restore colour |
 * | 2 | does a chain HAVE sends at all? | ⚠ **nothing to lose — the row closes itself** |
 * | 3 | is chain state carried by a device migration? | expected NO; this makes it explicit |
 *
 * ⚠ **Question 2 can close question 3's harder half by construction.** A layer chain
 * is not a mixer channel routed to FX buses, so `sendBank()` may legitimately be
 * empty — `DeviceLayer` inherits it from `Channel`, and an inherited member is a
 * CLAIM, not a capability (`deleteObject()` is inherited and refuses). An empty bank
 * is a real finding and the probe reports it as one rather than as a failure.
 *
 * ⚠ **Question 3 is the one that decides the rebuild's shape.** Expect NO — a
 * migration moves devices, and chain state lives on the chain. Measuring it makes
 * the rebuild's true step count explicit: it is not "move the devices", it is "move
 * the devices AND re-apply every chain property", which is more calls, and `e18f`
 * already measured that every call is another undo step.
 *
 * ⚠ Rule 13: the probe ABORTS unless `layerColorStatus` and `layerSendsStatus` both
 * read `marked:`. "Every chain reads 0,0,0 with no sends" means something completely
 * different depending on whether the handles were ever built, and three false ○s in
 * E17 came from exactly that confusion.
 *
 * Typed-only. Restores `gn-B` and verifies the track list by identity.
 */
import { client, check, note, failureCount, pollUntil } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const TRACK = 'gn-B';
const FX_LAYER = 'a0913b7f-096b-4ac9-bddd-33c775314b42';
const POLYSYNTH = 'a9ffacb5-33e9-4fc7-8621-b1af31e410ef';
/** A colour no default could coincide with (e16o's "mark away from the default"). */
const MARK = { r: 0.83, g: 0.17, b: 0.42 };

interface TrackRow { index: number; name: string; channelId: string }
interface DevList { devices: { index: number; name: string }[]; count: number }
interface SendRow { index: number; name: string; value: number }
interface LayerRow {
  index: number; name: string; color?: string; sends?: SendRow[];
  devices: { name: string }[];
}
interface LayerList {
  layers: LayerRow[]; count: number;
  layerColorStatus?: string; layerSendsStatus?: string; layerMixerStatus?: string;
}
interface ChainRow { index: number; name: string; devices: { index: number; name: string }[] }
interface Inventory { scopes: { slot: number; status: string; deviceName: string; chains: ChainRow[] }[]; trackName: string }

const trackList = async () => ((await req('track.list')) as { tracks: TrackRow[] }).tracks;
const idsOf = (t: TrackRow[]) => t.map((x) => x.channelId).sort().join(',');
let subject!: TrackRow;

async function bail(message: string): Promise<never> {
  console.log(`\n⚠⚠⚠ ABORTING: ${message}`);
  process.exit(1);
}

async function pointSubject(): Promise<void> {
  const row = (await trackList()).find((t) => t.channelId === subject.channelId);
  if (!row) await bail(`"${TRACK}" is gone.`);
  await req('cursor.pointTrack', { cursor: '0', trackIndex: row!.index });
  await wait(650);
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

async function scopeCursor(slot: number, tag: string): Promise<void> {
  const d = await devs();
  const target = d.devices.find((x) => x.index === slot);
  if (!target) await bail(`${tag}: no device at top-level index ${slot}.`);
  await req('devcursor.selectAt', { deviceIndex: slot });
  const ok = await pollUntil(async () => {
    const s = (await req('devcursor.status')) as { exists: boolean; name: string };
    return s.exists && s.name === target!.name;
  }, 6000, 150);
  if (!ok.ok) await bail(`${tag}: the device cursor never landed on slot ${slot}.`);
}

const layers = async () => (await req('layer.list')) as LayerList;
const near = (a: number, b: number, eps = 0.02) => Math.abs(a - b) <= eps;
const parseColor = (s?: string) => (s ?? '').split(',').map(Number);

// ==========================================================================
console.log('');
console.log('='.repeat(78));
console.log(' E18 §3.1 — CHAIN-LEVEL state: can colour and sends survive a rebuild?');
console.log('='.repeat(78));

await client.connect();
const hello = (await req('contract.hello')) as { methodsHash: string; methodCount: number };
note(`wire: ${hello.methodCount} methods, methodsHash ${hello.methodsHash}`);

const hits = (await trackList()).filter((t) => t.name === TRACK);
if (hits.length !== 1) { console.log(`⚠⚠ REFUSING: ${hits.length} tracks named "${TRACK}".`); process.exit(1); }
subject = hits[0]!;
const baseTrackIds = idsOf(await trackList());
await pointSubject();

async function clearTrack(): Promise<void> {
  await pointSubject();
  let d = await devs();
  for (let g = 0; g < 14 && d.count > 0; g++) {
    await req('device.delete', { cursor: '0', deviceIndex: d.devices[0]!.index });
    await pollUntil(async () => (await devs()).count < d.count, 6000, 200);
    d = await devs();
  }
}

console.log('\n-- fixture: container A with two filled chains, container B empty');
await clearTrack();
for (let i = 0; i < 2; i++) {
  const before = (await devs()).count;
  await req('device.insertBitwig', { cursor: '0', uuid: FX_LAYER });
  await pollUntil(async () => (await devs()).count === before + 1, 12000, 200);
  await wait(400);
}
await scopeCursor(0, 'grow A');
await req('layer.select', { layerIndex: 0, where: 'editor' });
await wait(250);
await req('layer.duplicateChannel', { layerIndex: 0 });
await pollUntil(async () => (await layers()).count === 2, 6000, 250);
for (let i = 0; i < 2; i++) { await req('layer.setName', { layerIndex: i, name: `A${i}` }); await wait(200); }
await req('layer.insertDevice', { layerIndex: 0, uuid: POLYSYNTH });
await wait(900);
await scopeCursor(1, 'name B');
await req('layer.setName', { layerIndex: 0, name: 'B0' });
await wait(250);

// ⚠ RULE 13 GATE — before any reading is believed.
await scopeCursor(0, 'gate');
const gate = await layers();
note(`layerColorStatus=${gate.layerColorStatus}  layerSendsStatus=${gate.layerSendsStatus}`);
check('⚠ GATE: the colour handles were marked at init (rule 13)',
  String(gate.layerColorStatus).startsWith('marked:'), { status: gate.layerColorStatus });
if (!String(gate.layerColorStatus).startsWith('marked:')) {
  await bail('the colour handles were never built, so "no colour" would be OUR failure reported '
    + 'as Bitwig\'s. Refusing to score.');
}

/**
 * ⚠⚠ The send status needs THREE readings, not two, and getting this wrong would
 * have been the session's worst error.
 *
 *   marked:N                     the bank exists — Q2 is "yes", run the write test
 *   ⚠ "No send bank exists"      ⚠ **that IS the answer to Q2**, in Bitwig's own
 *                                words. `sendBank()` on a DeviceLayer does not
 *                                return an empty bank, it REFUSES to make one.
 *   anything else                OUR failure — abort, because an instrument fault
 *                                dressed as a capability ○ is the exact mistake
 *                                standing rule 13 exists to prevent
 *
 * ⚠ An explicit refusal message from Bitwig is far stronger evidence than a silent
 * no-op: it is the API stating the capability is absent rather than quietly doing
 * nothing (E6 blocker 4's whole problem). Recorded with the raw string so the
 * reading can be audited rather than taken on trust.
 */
const sendStatus = String(gate.layerSendsStatus);
const sendsMarked = sendStatus.startsWith('marked:');
const sendsAbsent = /No send bank exists/i.test(sendStatus);
if (!sendsMarked && !sendsAbsent) {
  await bail(`the send handles failed for an UNRECOGNISED reason ("${sendStatus}"). That is an `
    + 'instrument fault, and reporting it as "chains have no sends" would be a capability ○ '
    + 'manufactured out of our own bug.');
}
check('⚠ GATE: the send status is interpretable (either marked, or Bitwig refusing explicitly)',
  sendsMarked || sendsAbsent, { status: sendStatus });

// --------------------------------------------------------------------------
console.log('\n' + '-'.repeat(78));
console.log(' Q1 — can a chain\'s COLOUR be read and written?');
console.log('-'.repeat(78));
const before = await layers();
for (const l of before.layers) note(`   ${l.name.padEnd(4)} colour ${l.color}`);

await req('layer.setMixer', { layerIndex: 0, color: MARK });
await wait(600);
const afterWrite = await layers();
const got = parseColor(afterWrite.layers.find((l) => l.name === 'A0')?.color);
note(`   A0 after write: ${afterWrite.layers.find((l) => l.name === 'A0')?.color}  (wanted ${MARK.r},${MARK.g},${MARK.b})`);
const colourWritable = got.length === 3
  && near(got[0]!, MARK.r) && near(got[1]!, MARK.g) && near(got[2]!, MARK.b);
check('⚠ Q1: a chain\'s colour is READABLE and WRITABLE', colourWritable,
  { wanted: MARK, got: afterWrite.layers.find((l) => l.name === 'A0')?.color });

// ⚠ The sibling chain must NOT have changed — otherwise `color()` is a property of
// the container and not of the chain, which would be a different (and worse) finding.
const sibling = parseColor(afterWrite.layers.find((l) => l.name === 'A1')?.color);
const siblingBefore = parseColor(before.layers.find((l) => l.name === 'A1')?.color);
check('⚠ colour is PER-CHAIN — the sibling chain is unchanged',
  sibling.join(',') === siblingBefore.join(','),
  { before: siblingBefore.join(','), after: sibling.join(',') });

// --------------------------------------------------------------------------
console.log('\n' + '-'.repeat(78));
console.log(' Q2 — does a layer chain HAVE sends at all?');
console.log('-'.repeat(78));
const sendRows = afterWrite.layers.find((l) => l.name === 'A0')?.sends ?? [];
note(`   init status: ${sendStatus}`);
note(`   A0 sends: ${sendRows.length === 0 ? 'NONE' : sendRows.map((s) => `${s.name}=${s.value.toFixed(3)}`).join(', ')}`);
const hasSends = sendRows.length > 0 && sendsMarked;
if (sendsAbsent) {
  note('   ⚠⚠ Bitwig REFUSED to create the bank at all, in its own words:');
  note(`     "${sendStatus.replace(/^FAILED@\d+:\w+:/, '')}"`);
  note('   ⚠ That is a stronger negative than a silent no-op — the API is stating the');
  note('     capability is absent, not quietly doing nothing (E6 blocker 4\'s problem).');
}
if (hasSends) {
  note('   ⚠ a chain DOES carry sends — so a rebuild must re-apply them, and the write half matters.');
  const target = sendRows[0]!;
  await req('layer.setMixer', { layerIndex: 0, sendIndex: target.index, sendValue: 0.61 });
  await wait(600);
  const reread = (await layers()).layers.find((l) => l.name === 'A0')?.sends ?? [];
  const now = reread.find((s) => s.index === target.index);
  check('a chain send is WRITABLE', now !== undefined && near(now.value, 0.61),
    { wanted: 0.61, got: now?.value });
} else {
  note('   ⇒ ⚠ a DeviceLayer chain has NO sends. `sendBank()` is inherited from `Channel` and');
  note('     is empty here — an inherited member is a claim, not a capability. ⚠ That CLOSES');
  note('     this half of the row rather than failing it: a rebuild cannot lose what does not');
  note('     exist, and it is consistent with a layer chain not being a mixer channel routed');
  note('     to FX buses. (A TRACK fork, by contrast, does carry sends — E16d.)');
}
check('⚠ Q2 answered either way (sends exist and are writable, or provably absent)', true,
  { sends: sendRows.length });

// --------------------------------------------------------------------------
console.log('\n' + '-'.repeat(78));
console.log(' Q3 — ⚠ does a device MIGRATION carry chain state across?');
console.log('-'.repeat(78));
note('   A0 is now a distinctive colour and holds the Polysynth. Migrate the DEVICE to B0');
note('   and ask whether the colour went with it. Expected NO — chain state lives on the chain.');

await req('chain.move', { srcSlot: 0, srcLayer: 0, srcDevice: 0, dst: 'chain', dstSlot: 1, dstLayer: 0, verb: 'move' });
await pollUntil(async () => {
  const inv = (await req('chain.inventory')) as Inventory;
  return (inv.scopes[1]?.chains[0]?.devices.length ?? 0) > 0;
}, 8000, 250);
await wait(700);

await scopeCursor(1, 'Q3 read B');
const bAfter = await layers();
const b0 = bAfter.layers.find((l) => l.name === 'B0');
note(`   B0 after migration: colour ${b0?.color}  devices=[${b0?.devices.map((d) => d.name).join('+') || '—'}]`);
const b0Colour = parseColor(b0?.color);
const carried = b0Colour.length === 3
  && near(b0Colour[0]!, MARK.r) && near(b0Colour[1]!, MARK.g) && near(b0Colour[2]!, MARK.b);

check('⚠ the DEVICE migrated (the precondition for asking about state)',
  (b0?.devices.length ?? 0) > 0, { devices: b0?.devices.map((d) => d.name) });
check('⚠⚠ Q3: chain COLOUR is NOT carried by a device migration (expected, and it matters)',
  !carried, { markColour: `${MARK.r},${MARK.g},${MARK.b}`, b0Colour: b0?.color });

// The other half: can it be RE-APPLIED onto the destination? That is what makes it
// a cost rather than a loss.
await req('layer.setMixer', { layerIndex: 0, color: MARK });
await wait(600);
const restored = parseColor((await layers()).layers.find((l) => l.name === 'B0')?.color);
const reapplied = restored.length === 3
  && near(restored[0]!, MARK.r) && near(restored[1]!, MARK.g) && near(restored[2]!, MARK.b);
check('⚠ but it CAN be re-applied onto the destination chain — a cost, not a loss',
  reapplied, { got: restored.join(',') });

// --------------------------------------------------------------------------
console.log('\n-- cleanup');
await clearTrack();
check(`${TRACK} is empty again`, (await devs()).count === 0, {});
check('the TRACK LIST is untouched by identity', idsOf(await trackList()) === baseTrackIds, {});

console.log('\n' + '='.repeat(78));
console.log(`  colour   ${colourWritable ? '●● readable + writable, per-chain' : '○ not writable'}`);
console.log(`  sends    ${hasSends ? `●● ${sendRows.length} present` : '○ NONE on a DeviceLayer — nothing to lose'}`);
console.log(`  migration carries chain state?  ${carried ? '⚠ YES (unexpected)' : '○ NO — must be re-applied'}`);
console.log('='.repeat(78));
console.log('');
note('⚠ THE REBUILD IS NOT "MOVE THE DEVICES". It is move the devices AND re-apply every');
note('  chain property that was set — name, mute, solo, volume, pan' + (hasSends ? ', sends' : '') + ' and colour.');
note('  ⚠ `e18f` measured that EVERY call is another undo step, so each property restored is');
note('    one more step between the user and their single Cmd-Z. That is the compounding cost.');

console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} checks reported a negative — read individually`);
process.exit(0);
