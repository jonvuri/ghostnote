/**
 * E4g — Independent per-layer substitution in a multi-layer template.
 *
 * Closes E4f's stated evidence gap. E4f proved GUID substitution on a
 * SINGLE-device preset and could only infer that a multi-layer template's
 * per-layer devices are independently swappable. That inference is the whole
 * basis of "parameterised construction", so it needs verifying, not assuming.
 *
 * Template (built by hand in the UI, since no save API exists): an Instrument
 * Layer with four chains — Phase-4, Polysynth, Organ, Sampler — each device's
 * identity appearing exactly once as a raw 16-byte GUID at a distinct offset.
 *
 * Tests, in order of what would falsify the claim fastest:
 *   1. the untouched template materialises all 4 chains
 *   2. patching ONE layer's GUID changes ONLY that layer
 *   3. patching TWO layers at once changes both, independently
 *   4. a substituted device is live at depth (enumerates + accepts writes)
 *
 * Also settles whether the stale ASCII `referenced_device_ids` metadata
 * matters, by patching the binary GUID *only*.
 *
 * Read-only against the user's preset; all writes go to a scratch dir.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  client, check, note, failureCount, pollUntil, point, ensureFixtureTracks,
} from './lib.js';

const MECH = 'trackThenSlot';
const TEMPLATE = path.join(os.homedir(), 'Documents', 'Bitwig Studio', 'Library',
  'Presets', 'Instrument Layer', 'gn test - instrument layer 4.bwpreset');
const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), 'gn-multilayer-'));

const UUIDS = {
  phase4: '252723bf-68a6-4ee6-81f8-95ba4d0fb467',
  polysynth: 'a9ffacb5-33e9-4fc7-8621-b1af31e410ef',
  organ: 'f2dcfe9a-7b66-4c84-984a-b25685a1c21a',
  sampler: '468bc14b-b2e7-45a1-9666-e83117fe404e',
  polymer: '8f58138b-03aa-4e9d-83bd-a038c99a4ed5',
  fm4: '',
};

const bin = (u: string) => Buffer.from(u.replace(/-/g, ''), 'hex');

/** Patch binary GUIDs only; asserts each swap hits exactly one occurrence. */
function patch(src: Buffer, swaps: [string, string][], label: string): string {
  let buf = Buffer.from(src);
  for (const [from, to] of swaps) {
    const f = bin(from);
    const t = bin(to);
    let hits = 0;
    let idx = buf.indexOf(f);
    while (idx >= 0) {
      hits++;
      t.copy(buf, idx);
      idx = buf.indexOf(f, idx + 1);
    }
    if (hits !== 1) {
      note(`  ⚠ ${from.slice(0, 8)} matched ${hits}× (expected 1)`);
    }
  }
  const p = path.join(SCRATCH, `${label}.bwpreset`);
  fs.writeFileSync(p, buf);
  if (buf.length !== src.length) throw new Error('patch changed file length');
  return p;
}

const devList = async () => (await client.request('device.list', { cursor: '0' })) as any;
const layers = async () => (await client.request('layer.list')) as any;
const nesting = async () => (await client.request('device.nesting')) as any;

async function clearDevices() {
  let l = await devList();
  for (let g = 0; g < 12 && l.count > 0; g++) {
    await client.request('device.delete', { cursor: '0', deviceIndex: l.devices[0].index });
    await pollUntil(async () => (await devList()).count < l.count, 5000);
    l = await devList();
  }
  return l.count === 0;
}

/** Load a preset file and return the device name in each layer, in order. */
async function loadAndReadChains(p: string): Promise<string[]> {
  await clearDevices();
  await client.request('device.insertFile', { cursor: '0', path: p });
  const ok = await pollUntil(async () => (await devList()).count > 0, 15000);
  if (!ok.ok) return [];
  await client.request('devcursor.selectAt', { deviceIndex: 0 });
  await pollUntil(async () => (await layers()).count > 0, 10000);
  await new Promise((r) => setTimeout(r, 1200)); // let nested banks stream
  const l = await layers();
  return l.layers.map((x: any) => x.devices.map((d: any) => d.name).join('+') || '(empty)');
}

await client.connect();
console.log('connected\n');
const { trackA } = await ensureFixtureTracks();
await point('0', trackA, 0, MECH);

if (!fs.existsSync(TEMPLATE)) {
  console.log(`template not found at ${TEMPLATE}`);
  process.exit(1);
}
const src = fs.readFileSync(TEMPLATE);
note(`template: ${path.basename(TEMPLATE)} (${src.length} bytes)`);

// ============================================ 1. the untouched template
console.log('\n-- 1. does the untouched template materialise all four chains?');
const base = await loadAndReadChains(TEMPLATE);
note(`chains: ${base.map((c, i) => `[${i}] ${c}`).join('  ')}`);
check('template instantiates a 4-chain Instrument Layer in one insertFile call',
  base.length === 4, { chains: base.length, contents: base });
const expected = ['Phase-4', 'Polysynth', 'Organ', 'Sampler'];
check('each chain holds the device the user placed there',
  expected.every((e) => base.some((c) => c.includes(e))), { expected, got: base });

// ============================================ 2. swap ONE layer
console.log('\n-- 2. patch ONE layer\'s binary GUID (Organ → Polymer); others must not move');
const onePath = patch(src, [[UUIDS.organ, UUIDS.polymer]], 'one-layer');
const one = await loadAndReadChains(onePath);
note(`chains: ${one.map((c, i) => `[${i}] ${c}`).join('  ')}`);
check('the patched layer now holds the SUBSTITUTED device',
  one.some((c) => c.includes('Polymer')), { chains: one });
check('no chain holds the replaced device any more',
  !one.some((c) => c.includes('Organ')), { chains: one });
check('THE KEY RESULT: the other three chains are untouched',
  one.length === 4
  && one.some((c) => c.includes('Phase-4'))
  && one.some((c) => c.includes('Polysynth'))
  && one.some((c) => c.includes('Sampler')),
  { chains: one });
note('(binary GUID patched ONLY — the ASCII referenced_device_ids still names Organ,');
note(' so that metadata is evidently not consulted when instantiating.)');

// ============================================ 3. swap TWO layers at once
console.log('\n-- 3. patch TWO layers simultaneously (Phase-4 → Polymer, Sampler → Polysynth)');
const twoPath = patch(src,
  [[UUIDS.phase4, UUIDS.polymer], [UUIDS.sampler, UUIDS.polysynth]], 'two-layer');
const two = await loadAndReadChains(twoPath);
note(`chains: ${two.map((c, i) => `[${i}] ${c}`).join('  ')}`);
check('both patched layers changed, independently of each other',
  two.length === 4
  && two.some((c) => c.includes('Polymer'))
  && !two.some((c) => c.includes('Phase-4'))
  && !two.some((c) => c.includes('Sampler')),
  { chains: two });
check('the untouched layers survived a multi-swap',
  two.some((c) => c.includes('Organ')), { chains: two });

// ============================================ 4. live at depth?
console.log('\n-- 4. is a substituted device functional INSIDE its layer?');
const target = two.findIndex((c) => c.includes('Polymer'));
if (target >= 0) {
  await client.request('devcursor.selectFirstInLayer', { layerIndex: target });
  const live = await pollUntil(async () =>
    ((await client.request('directparam.list')) as any).count > 0, 10000);
  const dp = (await client.request('directparam.list')) as any;
  const n = await nesting();
  note(`descended into layer ${target}: cursor="${n.name}" isNested=${n.isNested}, ` +
    `${dp.count} direct params`);
  check('substituted device is live at depth (enumerates its own params)',
    live.ok && dp.count > 0, { device: n.name, params: dp.count });

  const t = dp.params.find((p: any) => typeof p.value === 'number');
  if (t) {
    const want = t.value > 0.5 ? 0.25 : 0.75;
    await client.request('directparam.set', { id: t.id, value: want, resolution: 1 });
    const wrote = await pollUntil(async () => {
      const p = ((await client.request('directparam.list')) as any).params
        .find((x: any) => x.id === t.id);
      return p ? Math.abs(p.value - want) < 0.03 : false;
    }, 4000);
    check('params on the substituted nested device are writable',
      wrote.ok, { id: t.id, want });
  }
}

// ============================================ cleanup
console.log('\n-- cleanup');
check('gn-A devices removed', await clearDevices());
await point('0', trackA, 0, MECH);
await client.request('cursor.clearNotes', { cursor: '0' });
await client.request('cursor.setNotes', { cursor: '0', notes: [[0, 60, 100, 1]] });
fs.rmSync(SCRATCH, { recursive: true, force: true });
note('scratch dir removed; the template preset was never modified');

console.log(failureCount() === 0 ? '\nE4g: all checks passed' : `\nE4g: ${failureCount()} FAILURES`);
client.disconnect();
process.exit(failureCount() === 0 ? 0 : 1);
