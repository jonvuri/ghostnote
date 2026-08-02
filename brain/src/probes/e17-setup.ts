/**
 * E17 fixture setup — rebuild the layer containers from the presets on disk.
 *
 * `gn-lay` and `gn-sel` did not survive the restart; the `.bwpreset` files that
 * made them did. That is E4d route 4 doing exactly the job the preset-library
 * posture claims for it, so this is a small live re-confirmation as well as a
 * setup step: a human is needed ONCE per shape, never once per use.
 *
 * Three fixtures, because the rows want different shapes and one of them is
 * about to be destroyed:
 *
 *   gn-lay    2-chain Instrument Layer — rows 1, 2b, 3, 5, 6. Chain 1's filter
 *             is dropped so the two chains are AUDIBLY distinct, which is what
 *             makes row 6's ear arm able to discriminate at all.
 *   gn-lay4   4-chain Instrument Layer (the E4g template) — row 4 ONLY. Delete
 *             is destructive, so it gets its own subject and gn-lay survives.
 *             ⚠ Four chains rather than two on purpose: E10d found that a chain
 *             trim behaves DIFFERENTLY in different positions (the last chain
 *             specifically could not be removed, and a probe bug there read
 *             exactly like a capability ○). Testing delete in several positions
 *             is what exposed that, and this row inherits the lesson.
 *   gn-sel    2-chain Instrument Selector — kept for §3.4e's comparison and for
 *             row 6, where a Selector's activeChainIndex is the alternative to
 *             a solo-based "which one is live".
 *
 * ⚠ Standing rule 5 as a PRECONDITION, not a check (the re-plan §1). Every
 * create here is refused before the call if the bank has no room, because E16r
 * measured that a create past the window mints a track that never appears in
 * `track.list` — unaddressable, un-cleanable, and audible. The Master and the FX
 * returns cross the ceiling FIRST, and every audibility oracle in E16/E17 reads
 * one of them, so overflowing costs the instrument before it costs a fixture.
 *
 * ⚠ `insertFile` needs an ABSOLUTE path and a `.bwpreset` extension — both fail
 * silently otherwise (E4h, standing rule 11).
 *
 * Silent: nothing is launched here. Clips are created but not played.
 */
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { client, check, note, failureCount, pollUntil } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);

const LIB = join(homedir(), 'Documents', 'Bitwig Studio', 'Library', 'Presets');
const POLYSYNTH = 'a9ffacb5-33e9-4fc7-8621-b1af31e410ef';
const PRESET = {
  lay2: join(LIB, 'Instrument Layer', 'gn_instrument_layer_2.bwpreset'),
  lay4: join(LIB, 'Instrument Layer', 'gn test - instrument layer 4.bwpreset'),
  sel2: join(LIB, 'Instrument Selector', 'gn_instrument_selector_2.bwpreset'),
};

interface TrackRow { index: number; name: string; type: string; channelId: string }
interface TrackList { tracks: TrackRow[]; count: number; itemCount: number; bankSize: number }
const list = async () => (await req('track.list')) as TrackList;
interface DevList { devices: { index: number; name: string }[]; count: number }
interface LayerList { layers: { index: number; name: string; devices: { name: string }[] }[]; count: number }
const shapeOf = (l: LayerList) =>
  l.layers.map((x) => `${x.index}:${x.name}[${x.devices.map((d) => d.name).join('+') || '—'}]`).join(' ');

/**
 * ⚠ `device.list` right after `cursor.pointTrack` can return the PREVIOUS
 * track's chain — measured in `e17-diag`, 4 of 13 tracks. So every read here
 * polls until two consecutive reads agree rather than trusting the first.
 * A probe that baselines with the immediate read is comparing two tracks.
 */
async function devicesSettled(): Promise<DevList> {
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

// ==========================================================================
console.log('\n-- inventory, and the rule-5 budget BEFORE anything is created');
let l = await list();
for (const t of l.tracks) console.log(`  ${String(t.index).padStart(2)} ${t.name.padEnd(18)} ${t.type}`);
note(`count=${l.count} itemCount=${l.itemCount} bankSize=${l.bankSize}`);
check('rule 5 PRECONDITION: itemCount is readable, so the budget is computable at all',
  typeof l.itemCount === 'number' && l.itemCount > 0, { itemCount: l.itemCount, bankSize: l.bankSize });

for (const p of Object.entries(PRESET)) {
  check(`fixture on disk: ${p[0]}`, existsSync(p[1]), { path: p[1] });
}
if (Object.values(PRESET).some((p) => !existsSync(p))) {
  console.log('REFUSING: a preset is missing and insertFile fails SILENTLY on a bad path (E4h).');
  process.exit(1);
}

// ==========================================================================
console.log('\n-- reaping session 5\'s leftovers, to buy budget back');
// ⚠ By NAME and then by channelId, never by a held index: deleting a track
// shifts every track below it up a slot (E3), so a list of indices captured up
// front deletes the wrong things from the second one onward.
const DOOMED = /^e16u-fork-/;
for (let guard = 0; guard < 12; guard++) {
  l = await list();
  const victim = l.tracks.find((t) => DOOMED.test(t.name));
  if (!victim) break;
  await req('track.delete', { trackIndex: victim.index });
  await pollUntil(async () => !(await list()).tracks.some((t) => t.channelId === victim.channelId), 4000, 200);
  note(`deleted ${victim.name}`);
}
l = await list();
check('every e16u leftover is gone', !l.tracks.some((t) => DOOMED.test(t.name)),
  { remaining: l.tracks.map((t) => t.name) });
note(`budget now: ${l.count} of ${l.bankSize}`);

// ==========================================================================
/** Create a track, name it, and materialise a container into it from a preset. */
async function buildFixture(name: string, presetPath: string, expectChains: number): Promise<number> {
  const before = await list();
  const existing = before.tracks.find((t) => t.name === name);
  // ⚠ Reuse skips the CREATE, never the fill or the verification. The first
  // version of this returned here, and the re-run then "differentiated" a
  // fixture whose chains were still empty — a setup step that reports success
  // without having checked is the same defect as a probe that asserts only its
  // headline (E16w attempt 2), one layer further out.
  if (existing) {
    note(`${name} already exists at ${existing.index}, reusing — re-verifying it anyway`);
    return finishFixture(name, existing.index, expectChains);
  }

  // ⚠ Rule 5 as a precondition: refuse BEFORE the call. A create past the window
  // mints an orphan that never appears in `track.list` (E16r), so `receipt.minted`
  // has nothing to report and there is nothing left to clean up.
  if (before.itemCount >= before.bankSize) {
    console.log(`\nREFUSING to create ${name}: ${before.itemCount} tracks against a ${before.bankSize}`);
    console.log('bank window. A create at the ceiling produces an UNADDRESSABLE, UN-CLEANABLE');
    console.log('orphan (E16r) — and the Master and FX returns leave the bank first, which costs');
    console.log('the audibility oracle every later row depends on.');
    process.exit(1);
  }

  await req('track.create', { position: before.count });
  await pollUntil(async () => (await list()).count === before.count + 1, 6000, 200);
  const after = await list();
  const fresh = after.tracks.filter((t) => t.type === 'Instrument');
  const target = fresh[fresh.length - 1]!;
  await req('track.setName', { trackIndex: target.index, name });
  const renamed = await pollUntil(async () =>
    (await list()).tracks.some((t) => t.index === target.index && t.name === name), 4000, 200);
  if (!renamed.ok) { console.log(`REFUSING: rename to ${name} did not verify.`); process.exit(1); }

  await req('cursor.pointTrack', { cursor: '0', trackIndex: target.index });
  await devicesSettled();
  const t0 = Date.now();
  await req('device.insertFile', { cursor: '0', path: presetPath });
  const landed = await pollUntil(async () => (await devicesSettled()).count >= 1, 10000, 250);
  const dev = await devicesSettled();
  note(`${name}: ${dev.devices.map((d) => d.name).join(', ') || '(nothing)'}  (${Date.now() - t0} ms)`);
  check(`${name}: insertFile materialised a container (E4d route 4, re-confirmed live)`,
    landed.ok && dev.count >= 1, { devices: dev.devices.map((d) => d.name) });

  return finishFixture(name, target.index, expectChains);
}

/** Fill every empty chain, verify the shape, and give the track a clip. */
async function finishFixture(name: string, trackIndex: number, expectChains: number): Promise<number> {
  await req('cursor.pointTrack', { cursor: '0', trackIndex });
  await devicesSettled();
  await req('devcursor.selectAt', { deviceIndex: 0 });
  const chains = await pollUntil(async () =>
    ((await req('layer.list')) as LayerList).count === expectChains, 8000, 250);
  const ll = (await req('layer.list')) as LayerList;
  note(`${name}: ${ll.count} chains — ${shapeOf(ll)}`);
  check(`${name}: the container has ${expectChains} chains`,
    chains.ok && ll.count === expectChains, { count: ll.count, expected: expectChains });

  // ⚠ The 2-chain presets ship their chains EMPTY; the 4-chain E4g template
  // ships them FILLED (Phase-4 / Polysynth / Organ / Sampler). Measured here,
  // not assumed — the first run of this setup descended into an empty chain and
  // its check failed, which is the only reason the difference is on the record.
  // §3.4e hit the same thing and filled by hand at 135/146 ms.
  for (const layer of ll.layers) {
    if (layer.devices.length > 0) continue;
    const t1 = Date.now();
    await req('devcursor.selectAt', { deviceIndex: 0 });
    await req('layer.insertDevice', { layerIndex: layer.index, uuid: POLYSYNTH });
    const filled = await pollUntil(async () => {
      await req('devcursor.selectAt', { deviceIndex: 0 });
      const cur = (await req('layer.list')) as LayerList;
      return (cur.layers.find((x) => x.index === layer.index)?.devices.length ?? 0) > 0;
    }, 8000, 250);
    note(`${name}: filled chain ${layer.index} (${Date.now() - t1} ms)${filled.ok ? '' : ' ⚠ DID NOT FILL'}`);
  }
  await req('devcursor.selectAt', { deviceIndex: 0 });
  const ll2 = (await req('layer.list')) as LayerList;
  note(`${name}: ${shapeOf(ll2)}`);
  check(`${name}: every chain holds a device, so each one can be heard on its own`,
    ll2.layers.every((x) => x.devices.length > 0), { shape: ll2.layers.map((x) => x.devices.length) });

  // A clip, so the fixture can be made audible later without another sitting.
  const has = async () => ((await req('slot.status', { trackIndex, slotIndex: 0 })) as { hasContent: boolean }).hasContent;
  if (!(await has())) {
    await req('clip.create', { trackIndex, slotIndex: 0, lengthBeats: 4 });
    await pollUntil(has, 4000, 200);
  }
  await req('cursor.pin', { cursor: '0', pinned: false });
  await req('slot.select', { trackIndex, slotIndex: 0, mechanism: 'slot' });
  await req('cursor.pointToClipOf', { cursor: '0', from: 'follower' });
  await req('cursor.clearNotes', { cursor: '0' });
  // A held chord, not a single note: row 6 needs something SUSTAINED to judge,
  // and the Drum Machine route was ruled out precisely because it cannot sustain
  // a polyphonic clip across takes (user, 2026-08-01).
  await req('cursor.setNotes', { cursor: '0', notes: [[0, 48, 100, 4], [0, 55, 100, 4], [0, 60, 100, 4]] });
  const notes = (await req('cursor.getNotes', { cursor: '0' })) as { notes: unknown[] };
  check(`${name}: the clip holds a sustained chord (readback, rule 1)`,
    notes.notes.length === 3, { notes: notes.notes.length });
  return trackIndex;
}

console.log('\n======== gn-lay — 2-chain Instrument Layer');
const layIndex = await buildFixture('gn-lay', PRESET.lay2, 2);

// ⚠ Make the two chains AUDIBLY distinct, or row 6's ear arm cannot discriminate
// and a null result would be unreadable — §3.4e's stated weakness, where both
// chains held the same patch and "no glitch" could not be told from "this rig
// could not have heard one". Chain 1 gets its filter dropped to a near-DC value.
console.log('\n-- differentiating gn-lay\'s two chains (F1FREQ on chain 1)');
await req('cursor.pointTrack', { cursor: '0', trackIndex: layIndex });
await devicesSettled();
await req('devcursor.selectAt', { deviceIndex: 0 });
// ⚠ Assert the cursor is on THIS fixture's container before descending. The
// first version polled for "a name without 'Layer' in it" and went green in
// 43 ms against `Instrument Selector` — the previous fixture, which the cursor
// had never left. A predicate that any wrong answer satisfies is not a check;
// this is rows D–G trap 6 in the setup rather than in a row.
const onContainer = await pollUntil(async () => {
  const s = (await req('devcursor.status')) as { exists: boolean; name: string };
  return s.exists && s.name === 'Instrument Layer';
}, 6000, 200);
if (!onContainer.ok) {
  check('PRECONDITION: the device cursor is on gn-lay\'s Instrument Layer', false,
    await req('devcursor.status'));
} else {
  const descended = await pollUntil(async () => {
    await req('devcursor.selectFirstInLayer', { layerIndex: 1 });
    const s = (await req('devcursor.status')) as { exists: boolean; name: string };
    // Name it, do not merely exclude (e16t). The only acceptable landing is the
    // Polysynth we put in chain 1.
    return s.exists && s.name === 'Polysynth';
  }, 8000, 400);
  const nested = (await req('devcursor.status')) as { exists: boolean; name: string };
  const nesting = (await req('device.nesting')) as { isNested?: boolean | string };
  note(`descended into chain 1: ${JSON.stringify(nested)} isNested=${nesting.isNested} (${descended.ms} ms)`);
  check('the cursor is on the Polysynth INSIDE chain 1, not on the container (E4c isNested)',
    descended.ok && nesting.isNested === true, { nested, nesting });
  if (descended.ok) {
    await req('param.set', { id: 'F1FREQ', value: 0.05 });
    const readF1 = async () => {
      const r = (await req('param.list')) as
        { params: { id: string; displayed?: string; value?: number }[]; deviceName: string };
      return { f1: r.params.find((x) => x.id === 'F1FREQ'), deviceName: r.deviceName };
    };
    // ⚠ Poll, do not read once. The first version read back 0.693 — the DEFAULT —
    // immediately after the write and scored it a failure. `setImmediately` is
    // the working setter (E4), so a single read straight after it is measuring
    // the round trip, not the write.
    await pollUntil(async () => ((await readF1()).f1?.value ?? 1) < 0.2, 4000, 200);
    const { f1, deviceName } = await readF1();
    const p = { deviceName };
    note(`chain 1 F1FREQ -> ${f1?.displayed} (${f1?.value}) on ${p.deviceName}`);
    // ⚠ Verified through a re-read rather than through the setter's own return
    // (rule 3a): a cursor reports back what was written to it whether or not it
    // landed, and two findings were wrong for exactly that reason.
    check('chain 1 is now timbrally distinct from chain 0, so an ear arm CAN discriminate',
      f1?.value !== undefined && f1.value < 0.2, { f1, deviceName: p.deviceName });
  }
}
await req('devcursor.selectParent');

console.log('\n======== gn-lay4 — 4-chain Instrument Layer (row 4\'s subject, several positions)');
await buildFixture('gn-lay4', PRESET.lay4, 4);

console.log('\n======== gn-sel — 2-chain Instrument Selector');
await buildFixture('gn-sel', PRESET.sel2, 2);

// ==========================================================================
console.log('\n-- final inventory');
l = await list();
for (const t of l.tracks) console.log(`  ${String(t.index).padStart(2)} ${t.name.padEnd(18)} ${t.type}`);
note(`count=${l.count} itemCount=${l.itemCount} bankSize=${l.bankSize} — headroom ${l.bankSize - l.itemCount}`);
check('rule 5: the bank still has headroom, so later rows can create without minting an orphan',
  l.itemCount < l.bankSize, { itemCount: l.itemCount, bankSize: l.bankSize });

console.log(failureCount() === 0 ? '\nALL PASS — fixtures rebuilt, nothing launched' : `\n${failureCount()} FAILURES`);
process.exit(failureCount() === 0 ? 0 : 1);
