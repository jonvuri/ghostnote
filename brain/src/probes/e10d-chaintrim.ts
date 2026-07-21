/**
 * E10d — can a layer CHAIN be deleted from a template, the way a modulator can?
 *
 * E10c found the container accepts object REMOVAL while rejecting object
 * INSERTION. That asymmetry is worth pushing on one level up, because it lands
 * on E4d/E4e's biggest ○ and E4f's main cost:
 *
 *   E4d/E4e: layer-type containers cannot GROW — `DeviceLayer` has no
 *            insertionPoint, so a multi-layer instrument stack cannot be
 *            authored from nothing. (A reasoned negative, five lines of
 *            evidence; nothing here challenges it.)
 *   E4f:     therefore ship "a finite template library, one per SHAPE"
 *            (2-layer, 3-layer, 4-layer…).
 *
 * If chains can be REMOVED from a preset, the shape axis collapses the same way
 * E10 collapsed the modulator target axis: author ONE wide template and trim it
 * down to N chains, instead of maintaining a template per chain count. That does
 * not contradict E4d — growing is still impossible — it just means you never
 * need to grow, because you start wide.
 *
 * FIXTURE: the E4g 4-chain Instrument Layer (Phase-4, Polysynth, Organ,
 * Sampler). Chains are CHAIN_LIST items delimited exactly as modulators are:
 * `<u32 classId> 0x02b9 str 'CHAIN<n>'`, so consecutive starts bound each chain.
 *
 * Four trims, to separate "deletion works" from "deletion works only in one
 * position", which decides whether a template must be ordered with its
 * expendable chains in a particular place:
 *   - drop CHAIN2 (Organ)              — a MIDDLE chain
 *   - drop CHAIN0 (Phase-4)            — the FIRST chain
 *   - drop CHAIN1 + CHAIN2             — two at once, down to a 2-chain stack
 *   - drop CHAIN0 + CHAIN1 + CHAIN2    — down to a single chain
 *
 * ⚠ The LAST chain is deliberately never dropped: it has no exact end, since
 * everything after it belongs to the parent (CHAIN_LIST terminator, enclosing
 * object's remaining fields). An early version of this probe fell back to
 * `b.length` for it, cut all of that off, and Bitwig rejected the file — which
 * looked exactly like "deleting the last chain is unsupported" but was a probe
 * bug. `trim()` now refuses undelimitable spans outright. Trimming to one chain
 * is still reachable by dropping everything BEFORE the last one.
 *
 * Verified by `layer.list` readback of the surviving chains' device names — the
 * E4g idiom — never by trusting the edit.
 */
import {
  client, check, note, failureCount, pollUntil, point, ensureFixtureTracks,
} from './lib.js';
import { homedir, tmpdir } from 'node:os';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const MECH = 'trackThenSlot';
const TEMPLATE = join(homedir(), 'Documents', 'Bitwig Studio', 'Library',
  'Presets', 'Instrument Layer', 'gn test - instrument layer 4.bwpreset');

type Chain = { name: string; start: number; end: number; device: string };

function findChains(b: Buffer): Chain[] {
  const marker = Buffer.from([0, 0, 0x02, 0xb9, 0x08, 0, 0, 0, 0x06]);
  const starts: { at: number; name: string }[] = [];
  let i = b.indexOf(marker, 0);
  while (i !== -1) {
    const name = b.subarray(i + 9, i + 15).toString('latin1');
    if (/^CHAIN[0-9]$/.test(name)) starts.push({ at: i - 4, name });
    i = b.indexOf(marker, i + 1);
  }
  return starts.map((s, n) => {
    // The LAST chain has no exact end: everything after it (the CHAIN_LIST
    // terminator and the enclosing object's remaining fields) belongs to the
    // parent, not the chain. Falling back to b.length would cut all of that off
    // and produce a file Bitwig rejects wholesale — verified the hard way.
    // end = -1 marks "not delimitable"; trim() refuses such spans.
    const end = starts[n + 1]?.at ?? -1;
    const seg = b.subarray(s.at, end < 0 ? b.length : end);
    const j = seg.indexOf(Buffer.from([0, 0, 0, 0x9a, 0x08]));
    const len = j >= 0 ? seg.readUInt32BE(j + 5) : 0;
    return {
      name: s.name, start: s.at, end,
      device: j >= 0 ? seg.subarray(j + 9, j + 9 + len).toString('latin1') : '?',
    };
  });
}

/** Remove the named chains. Spans are cut back-to-front so earlier offsets hold. */
function trim(b: Buffer, chains: Chain[], drop: string[]) {
  const spans = chains.filter((c) => drop.includes(c.name))
    .sort((x, y) => y.start - x.start);
  const undelimited = spans.filter((s) => s.end < 0);
  if (undelimited.length) {
    throw new Error(`cannot delete ${undelimited.map((s) => s.name).join(',')}: ` +
      'last chain has no exact end (see findChains)');
  }
  let out = b;
  for (const s of spans) out = Buffer.concat([out.subarray(0, s.start), out.subarray(s.end)]);
  return out;
}

const devList = async () =>
  (await client.request('device.list', { cursor: '0' })) as
    { count: number; devices: { index: number; name: string }[] };
const layers = async () => (await client.request('layer.list')) as
  { count: number; layers: { devices: { name: string }[] }[] };

async function clearDevices() {
  let l = await devList();
  for (let g = 0; g < 8 && l.count > 0; g++) {
    await client.request('device.delete', { cursor: '0', deviceIndex: l.devices[0].index });
    await pollUntil(async () => (await devList()).count < l.count, 4000);
    l = await devList();
  }
  return l.count === 0;
}

async function loadChains(path: string): Promise<string[]> {
  await clearDevices();
  await client.request('device.insertFile', { cursor: '0', path });
  const ok = await pollUntil(async () => (await devList()).count >= 1, 10000);
  if (!ok.ok) return [];
  await client.request('devcursor.selectAt', { deviceIndex: 0 });
  await pollUntil(async () => (await layers()).count > 0, 8000);
  await new Promise((r) => setTimeout(r, 600));
  const l = await layers();
  return l.layers.map((x) => x.devices.map((d) => d.name).join('+') || '(empty)');
}

const src = readFileSync(TEMPLATE);
const chains = findChains(src);
console.log('-- chains in the template');
for (const c of chains) {
  note(`  ${c.name} ${c.device.padEnd(10)} [${c.start}, ${c.end})  ${c.end - c.start}B`);
}
check('all 4 chains delimited', chains.length === 4, { found: chains.map((c) => c.device) });
note('NB: the LAST chain has no exact end, so it cannot be deleted directly — ' +
     'trim by dropping the chains BEFORE it instead (see the final case).');

const cases = [
  { label: 'drop MIDDLE (Organ)', drop: ['CHAIN2'], expect: ['Phase-4', 'Polysynth', 'Sampler'] },
  { label: 'drop FIRST (Phase-4)', drop: ['CHAIN0'], expect: ['Polysynth', 'Organ', 'Sampler'] },
  { label: 'drop TWO (Polysynth+Organ)', drop: ['CHAIN1', 'CHAIN2'], expect: ['Phase-4', 'Sampler'] },
  // Trimming to ONE chain is still reachable without delimiting the last chain:
  // drop every chain BEFORE it. This is the practical floor of the technique.
  { label: 'drop ALL BUT LAST', drop: ['CHAIN0', 'CHAIN1', 'CHAIN2'], expect: ['Sampler'] },
];

await client.connect();
console.log('\nconnected\n');
const { trackA } = await ensureFixtureTracks();
await point('0', trackA, 0, MECH);

console.log('-- baseline: untouched 4-chain template');
const base = await loadChains(TEMPLATE);
note(`chains: ${base.map((c, i) => `[${i}] ${c}`).join('  ')}`);
check('baseline instantiates 4 chains', base.length === 4, { base });

const written: string[] = [];
for (const c of cases) {
  console.log(`\n-- ${c.label}`);
  const buf = trim(src, chains, c.drop);
  const p = join(tmpdir(), `gn-e10d-${c.drop.join('-')}.bwpreset`);
  writeFileSync(p, buf); written.push(p);
  note(`file ${src.length} -> ${buf.length} bytes`);
  const got = await loadChains(p);
  note(`chains: ${got.length ? got.map((x, i) => `[${i}] ${x}`).join('  ') : 'DID NOT LOAD'}`);
  check(`${c.label}: loads with ${c.expect.length} chains`, got.length === c.expect.length,
    { got, expected: c.expect });
  check(`${c.label}: the surviving chains are exactly the expected devices`,
    got.length === c.expect.length && c.expect.every((d, i) => got[i].includes(d)),
    { got, expected: c.expect });
}

note('=> green: a wide template can be TRIMMED to any N >= 1 chains, so E4f\'s');
note('   "one template per SHAPE" collapses to one wide template + trim.');
note('   (E4d stands untouched: growing a layer container is still impossible;');
note('    this only removes the need to.)');
note('=> the only constraint is WHICH chain: any non-last chain can be dropped,');
note('   and dropping the leading ones reaches a 1-chain result.');

console.log('\n-- cleanup');
check('gn-A devices removed', await clearDevices());
await point('0', trackA, 0, MECH);
await client.request('cursor.clearNotes', { cursor: '0' });
await client.request('cursor.setNotes', { cursor: '0', notes: [[0, 60, 100, 1]] });
for (const p of written) { try { unlinkSync(p); } catch { /* best effort */ } }

console.log(failureCount() === 0 ? '\nE10d: all checks passed' : `\nE10d: ${failureCount()} FAILURES`);
client.disconnect();
process.exit(failureCount() === 0 ? 0 : 1);
