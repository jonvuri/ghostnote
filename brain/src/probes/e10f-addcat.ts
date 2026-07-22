/**
 * E10f — resolve the E10e confound (category vs slot-position) AND test a clean ADD.
 *
 * Built from user-authored minimal-pair presets (mp_note_first, mp_one_lfo,
 * mp_one_random) whose only intended differences are the modulator(s). A
 * methodology control (mp_bare vs mp_bare_same) proved the ONLY per-save noise is
 * the embedded preset name + a random per-instance "Chain" GUID (field 0x2ab8) —
 * so every other diff is signal.
 *
 * The test files are built by tools/bwformat/build_e10f_cases.py (all byte-surgery
 * lives in the Python format tooling); this probe only loads them and reads remote
 * pages. Build the manifest, then run:
 *   python3 tools/bwformat/build_e10f_cases.py > /tmp/e10f_manifest.json
 *   GN_E10F_MANIFEST=/tmp/e10f_manifest.json npx tsx src/probes/e10f-addcat.ts
 * Manifest JSON: {cases:[{key,path,desc,expect_load,expect_page}]}.
 *
 * PHASE A — category vs position (the E10e confound).
 *   E10e: same-category replace at slot 0 LOADS (R1/R2); cross-category replace at
 *   slot 1 REJECTS (R3). Confounded because both donor presets were LFO-only.
 *   mp_note_first puts a Note-driven modulator at SLOT 0.
 *     A0 baseline (must load)
 *     A1 replace Expressions(Note-driven, SLOT 0) with Classic LFO(LFO)
 *   A1 REJECTS  -> cross-category fails even at slot 0 => CATEGORY is the gate,
 *                  slot-position exonerated. (expected)
 *   A1 LOADS    -> cross-category works at slot 0 but failed at slot 1 =>
 *                  position/interaction matters after all.
 *
 * PHASE B — the ADD test (E10c's insertion ○).
 *   The footprint diff (mp_bare -> mp_one_lfo) showed adding a modulator costs
 *   EXACTLY: one object in the MODULATORS list + one GUID in
 *   referenced_modulator_ids + the f4 stream-pointer shift. NO count field. E10c
 *   called insertion blocked, but its cases had meta inconsistencies / were
 *   cross-category. This adds a SECOND modulator cleanly (same category).
 *     B0 baseline one_lfo (LFO only)
 *     B1 one_lfo + Random(LFO) added as slot 1, meta ref appended, f4 patched
 *   B1 LOADS with a Random page -> ADD works; E10c's insertion ○ is overturned,
 *      and modulator construction from templates is largely unlocked.
 *   B1 REJECTS -> there IS a deeper insertion gate beyond the footprint; E10c
 *      stands and only replace/delete are available.
 */
import {
  client, check, note, failureCount, pollUntil, point, ensureFixtureTracks,
} from './lib.js';
import { readFileSync } from 'node:fs';

const MECH = 'trackThenSlot';
const manifestPath = process.env.GN_E10F_MANIFEST;
if (!manifestPath) { console.log('set GN_E10F_MANIFEST=/path/manifest.json'); process.exit(2); }
type Case = { key: string; path: string; desc: string; expect_load: boolean | null; expect_page: string | null };
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { cases: Case[] };

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
  // Retry once on an apparent rejection, to distinguish a genuine load-refusal
  // from a transient timing miss (the settle after insertFile is not instant).
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
  // modulator pages are the ones after the device's own pages (OSC1..Common)
  const pages = (await remoteList()).pageNames;
  return { loaded: true, pages };
}

await client.connect();
console.log('connected\n');
const { trackA } = await ensureFixtureTracks();
await point('0', trackA, 0, MECH);

const res: Record<string, { loaded: boolean; pages: string[] }> = {};
for (const c of manifest.cases) {
  console.log(`\n-- ${c.key}: ${c.desc}`);
  const r = await loadCase(c.path);
  res[c.key] = r;
  const modPages = r.pages.filter((p) => !['OSC1', 'OSC2', 'MIX', 'FILTER', 'FILTER/EG', 'AMP', 'Envelope', 'Common'].includes(p));
  note(`${c.key} -> ${r.loaded ? 'LOADED' : 'REJECTED'}  modulator pages=${JSON.stringify(modPages)}`);
  if (c.expect_load === true) check(`${c.key} loads (baseline)`, r.loaded, r);
}

const L = (k: string) => (res[k]?.loaded ? 'LOAD  ' : 'REJECT');

console.log('\n== RESULT MATRIX (raw; interpret below) ==');
for (const c of manifest.cases) {
  const modPages = res[c.key].pages.filter((p) => !['OSC1', 'OSC2', 'MIX', 'FILTER', 'FILTER/EG', 'AMP', 'Envelope', 'Common'].includes(p));
  note(`${L(c.key)}  ${c.key.padEnd(24)} ${JSON.stringify(modPages)}`);
}

console.log('\n== controlled comparisons ==');
// The clean isolations. Each pair differs in exactly ONE thing.
check('A0/B0/C0 baselines all load', res.A0_baseline.loaded && res.B0_baseline.loaded && res.C0_baseline.loaded);

// (1) REPLACE slot1: fix vs no-fix (the ONLY diff is 0x1a1b). E10e-R3 == C1n.
note(`REPLACE slot1:  fixed(C1)=${L('C1_replace_slot1_fixed')}  nofix/R3-repro(C1n)=${L('C1n_replace_slot1_nofix')}`);
// (2) ADD slot1: fix vs no-fix (the ONLY diff is 0x1a1b).
note(`ADD slot1:      fixed(B1)=${L('B1_add_random')}  nofix(B1n)=${L('B1n_add_nofix')}`);
// (3) one-byte index perturbation: does Bitwig VALIDATE 0x1a1b on load?
note(`INDEX one-byte: modtest w/ slot1 0x1a1b 1->0 (M1)=${L('M1_index_dup')}  (baseline C0=${L('C0_baseline')})`);
// (4) cross-category at slot 0
note(`CROSS-CAT slot0 (A1)=${L('A1_crosscat_slot0')}  (E10e says cross-cat at slot1 rejected)`);

note('interpretation is done from the matrix — expectations have been wrong twice,');
note('so this probe REPORTS rather than asserts a mechanism.');

console.log('\n-- cleanup');
check('gn-A devices removed', await clearDevices());
await point('0', trackA, 0, MECH);
await client.request('cursor.clearNotes', { cursor: '0' });
await client.request('cursor.setNotes', { cursor: '0', notes: [[0, 60, 100, 1]] });

console.log(failureCount() === 0 ? '\nE10f: all checks passed' : `\nE10f: ${failureCount()} FAILURES`);
client.disconnect();
process.exit(failureCount() === 0 ? 0 : 1);
