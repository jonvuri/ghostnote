/**
 * E7d — read AND write a loaded modulator's own controls at runtime.
 *
 * E7c found that adding an LFO adds a remote-controls PAGE named "LFO". This
 * probe navigates to that page, enumerates the LFO's own controls, and writes
 * one — proving load-then-tweak works without any binary editing. If green, one
 * template covers a family of modulator settings (defuses the cardinality
 * concern for the SETTINGS axis).
 */
import {
  client, check, note, failureCount, pollUntil, point, ensureFixtureTracks,
} from './lib.js';
import { execSync } from 'node:child_process';
import { homedir } from 'node:os';

const MECH = 'trackThenSlot';
const preset = process.env.GN_MOD_PRESET
  ?? execSync(`find "${homedir()}/Documents/Bitwig Studio/Library" -iname '*modtest*.bwpreset' 2>/dev/null`,
    { encoding: 'utf8' }).trim().split('\n').filter(Boolean)[0];

type RemoteList = {
  remotes: { index: number; exists: boolean; name?: string; value?: number; modulatedValue?: number }[];
  existing: number; pageCount: number; selectedPageIndex: number; pageNames: string[]; deviceName: string;
};
type ParamMod = { params: { id: string; value: number; modulatedValue: number }[] };
const remoteList = async () => (await client.request('remote.list')) as RemoteList;
const paramMod = async () => (await client.request('param.modulated')) as ParamMod;
const devList = async () =>
  (await client.request('device.list', { cursor: '0' })) as { count: number; devices: { index: number }[] };

async function clearDevices() {
  let l = await devList();
  for (let g = 0; g < 8 && l.count > 0; g++) {
    await client.request('device.delete', { cursor: '0', deviceIndex: 0 });
    await pollUntil(async () => (await devList()).count < l.count, 4000);
    l = await devList();
  }
}
async function f1Series(n: number, gap = 150): Promise<number[]> {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const p = (await paramMod()).params.find((x) => x.id === 'F1FREQ');
    if (p) out.push(p.modulatedValue);
    await new Promise((r) => setTimeout(r, gap));
  }
  return out;
}
const spread = (a: number[]) => (a.length ? Math.max(...a) - Math.min(...a) : 0);

if (!preset) { console.log('no modtest preset'); process.exit(2); }
await client.connect();
console.log(`connected\npreset: ${preset}\n`);
const { trackA } = await ensureFixtureTracks();
await point('0', trackA, 0, MECH);
await clearDevices();
await client.request('device.insertFile', { cursor: '0', path: preset });
await pollUntil(async () => (await devList()).count >= 1, 10000);
await client.request('devcursor.selectAt', { deviceIndex: 0 });
await pollUntil(async () => (await remoteList()).deviceName.toLowerCase().includes('poly'), 6000);
await new Promise((r) => setTimeout(r, 800));

// -- A. navigate to the LFO page and read the modulator's own controls
console.log('-- A. select the "LFO" remote page and enumerate the modulator controls');
const pre = await remoteList();
const lfoIdx = pre.pageNames.findIndex((n) => /lfo/i.test(n));
note(`pages: [${pre.pageNames.join(', ')}] — LFO at index ${lfoIdx}`);
await client.request('remote.selectPage', { index: lfoIdx });
await pollUntil(async () => (await remoteList()).selectedPageIndex === lfoIdx, 4000);
await new Promise((r) => setTimeout(r, 500));
const page = await remoteList();
const pageName = page.pageNames[page.selectedPageIndex];
note(`selected page [${page.selectedPageIndex}]="${pageName}"`);
note('LFO controls: ' + page.remotes.filter((r) => r.exists)
  .map((r) => `[${r.index}]"${r.name}"=${r.value?.toFixed(3)}`).join(', '));
check('the modulator\'s own controls are READABLE via its remote page',
  /lfo/i.test(pageName ?? '') && page.existing >= 1, { page: pageName, controls: page.existing });

// -- B. write one of the modulator's controls and read it back
console.log('\n-- B. write a modulator control and confirm the write lands');
const ctrl = page.remotes.find((r) => r.exists && /rate|speed|freq/i.test(r.name ?? ''))
  ?? page.remotes.find((r) => r.exists);
if (!ctrl) {
  check('a modulator control was available to write', false);
} else {
  const want = (ctrl.value ?? 0.5) > 0.5 ? 0.15 : 0.85;
  await client.request('remote.set', { index: ctrl.index, value: want });
  const wrote = await pollUntil(async () => {
    const r = (await remoteList()).remotes.find((x) => x.index === ctrl.index);
    return !!r && Math.abs((r.value ?? -1) - want) < 0.03;
  }, 4000);
  const after = (await remoteList()).remotes.find((x) => x.index === ctrl.index);
  check(`writing the modulator control "${ctrl.name}" round-trips`,
    wrote.ok, { want, got: after?.value?.toFixed(3) });
  note('=> a loaded modulator is READ+WRITE at runtime via its remote page —');
  note('   load a template, then tweak the modulator live. No binary editing needed');
  note('   for the SETTINGS axis (rate/shape/etc.).');
}

// -- C. bonus: does changing an amount/depth control collapse the sweep?
console.log('\n-- C. bonus: can we mute the modulation by driving a depth-like control to 0?');
const depth = page.remotes.find((r) => r.exists && /amount|amt|depth|gain|level/i.test(r.name ?? ''));
if (depth) {
  const base = spread(await f1Series(8));
  await client.request('remote.set', { index: depth.index, value: 0 });
  await new Promise((r) => setTimeout(r, 500));
  const muted = spread(await f1Series(8));
  note(`F1FREQ modulatedValue spread: depth-normal=${base.toFixed(3)} -> depth-0=${muted.toFixed(3)}`);
  check(`driving "${depth.name}" to 0 reduces the modulation sweep`,
    muted < base * 0.5 + 0.02, { base: base.toFixed(3), muted: muted.toFixed(3) });
} else {
  note('no amount/depth-like control on the LFO page (its depth likely lives on the');
  note('routing connection, not the modulator) — skipping the sweep-collapse test.');
}

// -- cleanup
console.log('\n-- cleanup');
await clearDevices();
await point('0', trackA, 0, MECH);
await client.request('cursor.clearNotes', { cursor: '0' });
await client.request('cursor.setNotes', { cursor: '0', notes: [[0, 60, 100, 1]] });

console.log(failureCount() === 0 ? '\nE7d: all checks passed' : `\nE7d: ${failureCount()} FAILURES`);
client.disconnect();
process.exit(failureCount() === 0 ? 0 : 1);
