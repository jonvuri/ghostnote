/**
 * E11f — same-donor / same-TYPE repeated ADD. Does a duplicate 0x18c6 device GUID
 * (and the duplicate referenced_modulator_ids entry it forces) load?
 *
 * The handoff hypothesised a 0x2ab8 "Chain" GUID collision on same-donor adds, but
 * measurement showed a modulator object embeds NO 0x2ab8 — the only per-object ids
 * are 0x1a1b (unique within this list, proven) and 0x18c6 (the TYPE guid, shared by all instances of
 * a type and copied verbatim into referenced_modulator_ids). So two same-type
 * modulators necessarily DUPLICATE 0x18c6 and duplicate the meta ref. This probe
 * loads such files and REPORTS load/reject + the resulting modulator pages.
 *
 *   python3 tools/bwformat/build_e11f_cases.py > /tmp/e11f_manifest.json
 *   GN_MANIFEST=/tmp/e11f_manifest.json npx tsx src/probes/e11f-dupdonor.ts
 */
import {
  client, check, note, failureCount, pollUntil, point, ensureFixtureTracks,
} from './lib.js';
import { readFileSync } from 'node:fs';

const MECH = 'trackThenSlot';
const manifestPath = process.env.GN_MANIFEST;
if (!manifestPath) { console.log('set GN_MANIFEST=/path/manifest.json'); process.exit(2); }
type Case = { key: string; path: string; desc: string; expect_load: boolean | null; expect_page: string | null };
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { cases: Case[] };

const DEVICE_PAGES = ['OSC1', 'OSC2', 'MIX', 'FILTER', 'FILTER/EG', 'AMP', 'Envelope', 'Common'];

const devList = async () =>
  (await client.request('device.list', { cursor: '0' })) as
    { count: number; devices: { index: number; name: string }[] };
const remoteList = async () => (await client.request('remote.list')) as { pageNames: string[] };
const paramMod = async () => (await client.request('param.modulated')) as { deviceName: string };

async function clearDevices() {
  let l = await devList();
  for (let g = 0; g < 8 && l.count > 0; g++) {
    await client.request('device.delete', { cursor: '0', deviceIndex: l.devices[0].index });
    await pollUntil(async () => (await devList()).count < l.count, 4000);
    l = await devList();
  }
  return l.count === 0;
}

async function loadCase(path: string) {
  for (let attempt = 0; attempt < 2; attempt++) {
    await clearDevices();
    await client.request('device.insertFile', { cursor: '0', path });
    const ok = await pollUntil(async () => (await devList()).count >= 1, 12000);
    if (ok.ok) break;
    if (attempt === 1) return { loaded: false, pages: [] as string[] };
    await new Promise((r) => setTimeout(r, 1500));
  }
  await client.request('devcursor.selectAt', { deviceIndex: 0 });
  await pollUntil(async () => (await paramMod()).deviceName.toLowerCase().includes('poly'), 6000);
  await new Promise((r) => setTimeout(r, 900));
  return { loaded: true, pages: (await remoteList()).pageNames };
}

await client.connect();
console.log('connected\n');
const { trackA } = await ensureFixtureTracks();
await point('0', trackA, 0, MECH);

const res: Record<string, { loaded: boolean; pages: string[] }> = {};
const modPagesOf = (pages: string[]) => pages.filter((p) => !DEVICE_PAGES.includes(p));

for (const c of manifest.cases) {
  console.log(`\n-- ${c.key}: ${c.desc}`);
  const r = await loadCase(c.path);
  res[c.key] = r;
  note(`${c.key} -> ${r.loaded ? 'LOADED' : 'REJECTED'}  modulator pages=${JSON.stringify(modPagesOf(r.pages))}`);
  if (c.expect_load === true) check(`${c.key} loads (baseline)`, r.loaded, r);
}

const L = (k: string) => (res[k]?.loaded ? 'LOAD  ' : 'REJECT');

console.log('\n== RESULT MATRIX (raw) ==');
for (const c of manifest.cases) {
  note(`${L(c.key)}  ${c.key.padEnd(22)} ${JSON.stringify(modPagesOf(res[c.key].pages))}`);
}

console.log('\n== the E11f question ==');
note(`F1 add-once (control)        = ${L('F1_add_random_once')}  pages=${JSON.stringify(modPagesOf(res.F1_add_random_once.pages))}`);
note(`F2 add SAME Random twice     = ${L('F2_add_random_twice')}  pages=${JSON.stringify(modPagesOf(res.F2_add_random_twice.pages))}`);
note(`F3 add 2nd LFO (dup type)    = ${L('F3_add_lfo_dup')}  pages=${JSON.stringify(modPagesOf(res.F3_add_lfo_dup.pages))}`);
note('If F2/F3 LOAD with the duplicated modulator page present -> duplicate 0x18c6 +');
note('duplicate referenced_modulator_ids are FINE; addModulator needs no freshen step.');
note('If they REJECT -> same-type add has a deeper constraint; report loudly.');
note('(Interpretation from the matrix — the probe reports, it does not assert a mechanism.)');

console.log('\n-- cleanup / fixture restore');
check('gn-A devices removed', await clearDevices());
await point('0', trackA, 0, MECH);
await client.request('cursor.clearNotes', { cursor: '0' });
await client.request('cursor.setNotes', { cursor: '0', notes: [[0, 60, 100, 1]] });

console.log(failureCount() === 0 ? '\nE11f: baselines OK' : `\nE11f: ${failureCount()} FAILURES`);
client.disconnect();
process.exit(failureCount() === 0 ? 0 : 1);
