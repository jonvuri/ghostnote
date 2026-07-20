/**
 * E7b — does modulation baked into a template preset MATERIALISE via insertFile?
 *
 * The E4g pattern, one level deeper. Finding D (e07) proved you cannot create a
 * modulator at RUNTIME (no API; bare `.bwmodulator` inert). But community
 * tooling (bwEdit-Python "added support for modulators"; zezic device-hacks)
 * shows modulators live as atoms INSIDE the `.bwpreset` binary. So a preset the
 * user built once — a Polysynth with an LFO wired to Filter Frequency — should,
 * on insertFile, bring the modulator AND its routing along. The observable
 * proof: `modulatedValue` diverges from the static `value` (and, for an LFO,
 * sweeps over time) with no modulation authored by us.
 *
 * PREREQUISITE (a user action — there is no save API, E4f):
 *   1. Add a **Polysynth** to any track.
 *   2. Add an **LFO** modulator; wire it to **Filter Frequency (F1FREQ)** with a
 *      large depth (a slow LFO makes the sweep obvious).
 *   3. Save it as a preset with "modtest" in the name (Save Preset… → Library),
 *      OR set GN_MOD_PRESET to an absolute .bwpreset path.
 *
 * Loads onto gn-A, points the device cursor at it, samples value vs
 * modulatedValue over ~1s, then restores fixtures.
 */
import {
  client, check, note, failureCount, pollUntil, point, ensureFixtureTracks,
} from './lib.js';
import { execSync } from 'node:child_process';
import { homedir } from 'node:os';

const MECH = 'trackThenSlot';

function findPreset(): string | null {
  if (process.env.GN_MOD_PRESET) return process.env.GN_MOD_PRESET;
  try {
    const lib = `${homedir()}/Documents/Bitwig Studio/Library`;
    const out = execSync(`find "${lib}" -iname '*modtest*.bwpreset' 2>/dev/null`, { encoding: 'utf8' })
      .trim().split('\n').filter(Boolean);
    return out[0] ?? null;
  } catch {
    return null;
  }
}

type ParamMod = {
  params: { id: string; value: number; modulatedValue: number; displayed: string }[];
  deviceName: string;
};
const paramMod = async () => (await client.request('param.modulated')) as ParamMod;
const devList = async () =>
  (await client.request('device.list', { cursor: '0' })) as
    { count: number; devices: { index: number; name: string }[] };

async function clearDevices() {
  let l = await devList();
  for (let g = 0; g < 8 && l.count > 0; g++) {
    await client.request('device.delete', { cursor: '0', deviceIndex: l.devices[0].index });
    await pollUntil(async () => (await devList()).count < l.count, 4000);
    l = await devList();
  }
  return l.count === 0;
}

const preset = findPreset();
if (!preset) {
  console.log('NO PRESET FOUND. Build one (see file header) and either name it');
  console.log('with "modtest" in the Library, or set GN_MOD_PRESET=/abs/path.bwpreset');
  process.exit(2);
}

await client.connect();
console.log(`connected\npreset: ${preset}\n`);
const { trackA } = await ensureFixtureTracks();
await point('0', trackA, 0, MECH);
await clearDevices();

console.log('-- load the modulator template onto gn-A');
await client.request('device.insertFile', { cursor: '0', path: preset });
const loaded = await pollUntil(async () => (await devList()).count >= 1, 10000);
const chain = await devList();
note('chain: ' + chain.devices.map((d) => d.name).join(', '));
check('template preset loads via insertFile', loaded.ok && chain.count >= 1, chain);

await client.request('devcursor.selectAt', { deviceIndex: 0 });
await pollUntil(async () => (await paramMod()).deviceName.toLowerCase().includes('poly'), 6000);
await new Promise((r) => setTimeout(r, 800));

console.log('\n-- sample value vs modulatedValue over ~1s (LFO should sweep modulatedValue)');
const samples: { id: string; value: number; mv: number }[][] = [];
for (let i = 0; i < 6; i++) {
  const pm = await paramMod();
  samples.push(pm.params.map((p) => ({ id: p.id, value: p.value, mv: p.modulatedValue })));
  await new Promise((r) => setTimeout(r, 180));
}
// Divergence: modulatedValue != value at some instant, for some param.
const diverged = new Set<string>();
// Movement: modulatedValue changed across samples, for some param.
const moved = new Set<string>();
for (const id of samples[0].map((s) => s.id)) {
  const series = samples.map((s) => s.find((x) => x.id === id)!);
  if (series.some((s) => Math.abs(s.mv - s.value) > 1e-4)) diverged.add(id);
  const mvs = series.map((s) => s.mv);
  if (Math.max(...mvs) - Math.min(...mvs) > 1e-4) moved.add(id);
}
const f1 = samples.map((s) => s.find((x) => x.id === 'F1FREQ')).filter(Boolean) as { value: number; mv: number }[];
if (f1.length) {
  note('F1FREQ value/mv over time: ' + f1.map((s) => `${s.value.toFixed(3)}/${s.mv.toFixed(3)}`).join('  '));
}
note(`params with value≠modulatedValue: [${[...diverged].join(', ') || 'none'}]`);
note(`params whose modulatedValue MOVED over time: [${[...moved].join(', ') || 'none'}]`);

check('the modulator MATERIALISED and is LIVE (modulatedValue diverges from base)',
  diverged.size > 0, { diverged: [...diverged] });
check('the routing is intact (a modulated param actually moves under the modulator)',
  moved.size > 0, { moved: [...moved] });
note('=> if green: modulation ships in templates; author-by-template, drive-at-runtime,');
note('   the same posture as structure (E4d–E4h). Finding D narrows to runtime-only.');

console.log('\n-- cleanup');
check('gn-A devices removed', await clearDevices());
await point('0', trackA, 0, MECH);
await client.request('cursor.clearNotes', { cursor: '0' });
await client.request('cursor.setNotes', { cursor: '0', notes: [[0, 60, 100, 1]] });

console.log(failureCount() === 0 ? '\nE7b: all checks passed' : `\nE7b: ${failureCount()} FAILURES`);
client.disconnect();
process.exit(failureCount() === 0 ? 0 : 1);
