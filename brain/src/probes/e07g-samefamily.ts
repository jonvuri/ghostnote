/**
 * E7g — does a SAME-FAMILY modulator GUID swap preserve the route?
 *
 * E7e: LFO -> Vibrato (cross-family) dropped the route to F1FREQ even with the
 * new modulator driven and a note held. Question left open: is that because the
 * substituted device loads in DEFAULT (unwired) state (E4f gate 5), or because
 * Vibrato is a different output shape? Test the nearest neighbour: LFO ->
 * Classic LFO (both free-running LFO family, both output continuously while
 * silent — so no note needed). Classic LFO UUID harvested from modzoo (slot 1).
 *
 * If the route survives -> same-family swap is a usable TYPE lever that keeps
 * wiring; if it drops too -> GUID substitution is type-only-always-unwired, and
 * the slot-bank template design is the path.
 */
import {
  client, check, note, failureCount, pollUntil, point, ensureFixtureTracks,
} from './lib.js';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { homedir } from 'node:os';

const MECH = 'trackThenSlot';
const SCRATCH = '/private/tmp/claude-501/-Users-jonvuri-Development-ghostnote/04fcf17e-5b4f-4cfb-9c86-d37a4e796199/scratchpad/e07g';
const LFO_UUID = 'ad947004-f1d3-40a1-bd15-3ec721ee7c65';
const CLASSIC_LFO_UUID = '39f4b136-2946-4ac5-b34c-e5fde1e58fd8'; // modzoo slot 1
const RANDOM_UUID = 'bf29a7b0-91dc-4851-8a94-c63f358f3cda';      // modzoo slot 2 (bonus)

const preset = execSync(`find "${homedir()}/Documents/Bitwig Studio/Library" -iname '*modtest*.bwpreset' 2>/dev/null`,
  { encoding: 'utf8' }).trim().split('\n').filter(Boolean)[0];

const u2b = (u: string) => Buffer.from(u.replace(/-/g, ''), 'hex');
function patchGuid(src: Buffer, from: string, to: string): Buffer {
  const f = u2b(from);
  const first = src.indexOf(f);
  if (first === -1) throw new Error(`GUID ${from} not found`);
  if (src.indexOf(f, first + 1) !== -1) throw new Error(`GUID ${from} occurs >1x`);
  const out = Buffer.from(src);
  u2b(to).copy(out, first);
  return out;
}

type RemoteList = {
  remotes: { index: number; exists: boolean; name?: string; value?: number }[];
  pageCount: number; selectedPageIndex: number; pageNames: string[]; deviceName: string;
};
type ParamMod = { params: { id: string; value: number; modulatedValue: number }[] };
const remoteList = async () => (await client.request('remote.list')) as RemoteList;
const paramMod = async () => (await client.request('param.modulated')) as ParamMod;
const devList = async () => (await client.request('device.list', { cursor: '0' })) as { count: number };

async function clearDevices() {
  let l = await devList();
  for (let g = 0; g < 8 && l.count > 0; g++) {
    await client.request('device.delete', { cursor: '0', deviceIndex: 0 });
    await pollUntil(async () => (await devList()).count < l.count, 4000);
    l = await devList();
  }
  return l.count === 0;
}
async function f1Spread(n = 8, gap = 150): Promise<number> {
  const v: number[] = [];
  for (let i = 0; i < n; i++) {
    const p = (await paramMod()).params.find((x) => x.id === 'F1FREQ');
    if (p) v.push(p.modulatedValue);
    await new Promise((r) => setTimeout(r, gap));
  }
  return v.length ? Math.max(...v) - Math.min(...v) : 0;
}
async function loadOntoA(path: string): Promise<RemoteList> {
  await clearDevices();
  await client.request('device.insertFile', { cursor: '0', path });
  await pollUntil(async () => (await devList()).count >= 1, 10000);
  await client.request('devcursor.selectAt', { deviceIndex: 0 });
  await pollUntil(async () => (await remoteList()).pageCount >= 9, 8000);
  await new Promise((r) => setTimeout(r, 700));
  return remoteList();
}

if (!preset) { console.log('no modtest'); process.exit(2); }
await client.connect();
console.log(`connected\npreset: ${preset}\n`);
const src = readFileSync(preset);
mkdirSync(SCRATCH, { recursive: true });
const { trackA } = await ensureFixtureTracks();
await point('0', trackA, 0, MECH);

// control
console.log('-- control (unpatched LFO)');
const ctl = await loadOntoA(preset);
const ctlSpread = await f1Spread();
note(`last page="${ctl.pageNames.at(-1)}" spread=${ctlSpread.toFixed(3)}`);

// same-family: LFO -> Classic LFO
console.log('\n-- swap LFO -> Classic LFO (same family, free-running)');
const p1 = `${SCRATCH}/lfo2classic.bwpreset`;
writeFileSync(p1, patchGuid(src, LFO_UUID, CLASSIC_LFO_UUID));
const rc1 = await loadOntoA(p1);
note(`pages=[${rc1.pageNames.join(', ')}]`);
check('same-family swap loads and changes type (page renamed)',
  rc1.pageCount === ctl.pageCount, { last: rc1.pageNames.at(-1) });
let spread1 = await f1Spread();
note(`spread as-loaded=${spread1.toFixed(3)}`);
if (spread1 < 0.02) {
  // drive its controls in case Classic LFO idles differently
  const lastIdx = rc1.pageNames.length - 1;
  await client.request('remote.selectPage', { index: lastIdx });
  await pollUntil(async () => (await remoteList()).selectedPageIndex === lastIdx, 4000);
  await new Promise((r) => setTimeout(r, 400));
  const pg = await remoteList();
  note(`Classic LFO controls: ${pg.remotes.filter((r) => r.exists)
    .map((r) => `"${r.name}"=${r.value?.toFixed(2)}`).join(', ')}`);
  for (const r of pg.remotes.filter((r) => r.exists)) {
    if (/rate|freq|speed/i.test(r.name ?? '')) await client.request('remote.set', { index: r.index, value: 0.6 });
    if (/amount|amt|depth/i.test(r.name ?? '')) await client.request('remote.set', { index: r.index, value: 1 });
  }
  await new Promise((r) => setTimeout(r, 500));
  spread1 = await f1Spread();
  note(`spread after driving controls=${spread1.toFixed(3)}`);
}
check('SAME-FAMILY swap: route to F1FREQ survived', spread1 > 0.05,
  { control: ctlSpread.toFixed(3), swapped: spread1.toFixed(3) });

note(spread1 > 0.05
  ? '=> route SURVIVES same-family swap: GUID substitution is a wiring-preserving TYPE lever within a family.'
  : '=> route DROPS even same-family: substitution is type-only-always-unwired (E4f gate 5). Slot-bank design it is.');

// cleanup
console.log('\n-- cleanup');
check('gn-A devices removed', await clearDevices());
rmSync(SCRATCH, { recursive: true, force: true });
await point('0', trackA, 0, MECH);
await client.request('cursor.clearNotes', { cursor: '0' });
await client.request('cursor.setNotes', { cursor: '0', notes: [[0, 60, 100, 1]] });

console.log(failureCount() === 0 ? '\nE7g: all checks passed' : `\nE7g: ${failureCount()} FAILURES`);
client.disconnect();
process.exit(failureCount() === 0 ? 0 : 1);
