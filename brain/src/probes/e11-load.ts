/**
 * E11 generic loader — load each manifest case, report load/reject + full
 * pageNames, and (if GN_DIVERGE=1) scan every remote page for a knob whose
 * modulatedValue diverges from value (a live modulation route, host-agnostic —
 * param.modulated is Polysynth-only, but remote.list re-scopes to any device).
 *
 * Used by E11a (id contiguity) and E11d (non-Polysynth hosts). The probe REPORTS
 * the matrix; interpretation is done from it (the spike's standing discipline).
 *
 *   python3 tools/bwformat/build_e11X_cases.py > /tmp/m.json
 *   GN_MANIFEST=/tmp/m.json [GN_DIVERGE=1] npx tsx src/probes/e11-load.ts
 */
import {
  client, check, note, failureCount, pollUntil, point, ensureFixtureTracks,
} from './lib.js';
import { readFileSync } from 'node:fs';

const MECH = 'trackThenSlot';
const manifestPath = process.env.GN_MANIFEST;
if (!manifestPath) { console.log('set GN_MANIFEST=/path/manifest.json'); process.exit(2); }
const DIVERGE = process.env.GN_DIVERGE === '1';
type Case = { key: string; path: string; desc: string; expect_load: boolean | null; expect_page: string | null };
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { cases: Case[] };

const devList = async () =>
  (await client.request('device.list', { cursor: '0' })) as
    { count: number; devices: { index: number; name: string }[] };
type Remote = { index: number; exists: boolean; name?: string; value?: number; modulatedValue?: number };
const remoteList = async () => (await client.request('remote.list')) as
  { remotes: Remote[]; pageNames: string[]; pageCount?: number; deviceName: string };
const selectPage = async (index: number) => client.request('remote.selectPage', { index });

async function clearDevices() {
  let l = await devList();
  for (let g = 0; g < 8 && l.count > 0; g++) {
    await client.request('device.delete', { cursor: '0', deviceIndex: l.devices[0].index });
    await pollUntil(async () => (await devList()).count < l.count, 4000);
    l = await devList();
  }
  return l.count === 0;
}

/** Scan every remote page for a knob carrying modulation (mv != value). */
async function divergentKnobs(pageNames: string[]): Promise<string[]> {
  const hits: string[] = [];
  for (let pg = 0; pg < pageNames.length; pg++) {
    await selectPage(pg);
    await new Promise((r) => setTimeout(r, 250));
    const maxDiv = new Map<number, { name: string; d: number }>();
    for (let s = 0; s < 6; s++) {
      const rl = await remoteList();
      for (const rc of rl.remotes) {
        if (!rc.exists || rc.value === undefined || rc.modulatedValue === undefined) continue;
        const d = Math.abs(rc.modulatedValue - rc.value);
        const prev = maxDiv.get(rc.index);
        if (!prev || d > prev.d) maxDiv.set(rc.index, { name: rc.name ?? `#${rc.index}`, d });
      }
      await new Promise((r) => setTimeout(r, 150));
    }
    for (const { name, d } of maxDiv.values()) {
      if (d > 1e-3) hits.push(`${pageNames[pg]}/${name}=${d.toFixed(3)}`);
    }
  }
  return hits;
}

async function loadCase(c: Case) {
  for (let attempt = 0; attempt < 2; attempt++) {
    await clearDevices();
    await client.request('device.insertFile', { cursor: '0', path: c.path });
    const ok = await pollUntil(async () => (await devList()).count >= 1, 12000);
    if (ok.ok) break;
    if (attempt === 1) return { loaded: false, pages: [] as string[], device: '', diverge: [] as string[] };
    await new Promise((r) => setTimeout(r, 1500));
  }
  await client.request('devcursor.selectAt', { deviceIndex: 0 });
  await new Promise((r) => setTimeout(r, 900));
  const rl = await remoteList();
  const diverge = DIVERGE ? await divergentKnobs(rl.pageNames) : [];
  return { loaded: true, pages: rl.pageNames, device: rl.deviceName, diverge };
}

await client.connect();
console.log(`connected  (diverge-scan=${DIVERGE})\n`);
const { trackA } = await ensureFixtureTracks();
await point('0', trackA, 0, MECH);

const res: Record<string, Awaited<ReturnType<typeof loadCase>>> = {};
for (const c of manifest.cases) {
  console.log(`\n-- ${c.key}: ${c.desc}`);
  const r = await loadCase(c);
  res[c.key] = r;
  note(`${c.key} -> ${r.loaded ? 'LOADED' : 'REJECTED'}  device=${r.device}`);
  note(`   pages=${JSON.stringify(r.pages)}`);
  if (DIVERGE) note(`   modulation observed: ${r.diverge.length ? JSON.stringify(r.diverge) : 'none'}`);
  if (c.expect_load === true) check(`${c.key} loads (baseline)`, r.loaded, { pages: r.pages });
}

console.log('\n== RESULT MATRIX ==');
for (const c of manifest.cases) {
  const r = res[c.key];
  note(`${r.loaded ? 'LOAD  ' : 'REJECT'}  ${c.key.padEnd(26)} pages=${JSON.stringify(r.pages)}${DIVERGE ? `  mod=${JSON.stringify(r.diverge)}` : ''}`);
}

console.log('\n-- cleanup / fixture restore');
check('gn-A devices removed', await clearDevices());
await point('0', trackA, 0, MECH);
await client.request('cursor.clearNotes', { cursor: '0' });
await client.request('cursor.setNotes', { cursor: '0', notes: [[0, 60, 100, 1]] });

console.log(failureCount() === 0 ? '\nE11: baselines OK' : `\nE11: ${failureCount()} FAILURES`);
client.disconnect();
process.exit(failureCount() === 0 ? 0 : 1);
