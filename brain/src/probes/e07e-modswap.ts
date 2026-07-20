/**
 * E7e — modulator-TYPE substitution by GUID (the E4g trick on a modulator atom).
 *
 * modtest.bwpreset carries three modulator GUIDs as raw 16-byte big-endian
 * (like device GUIDs, E4f/E4g): the Polysynth's two BUILT-INS (also present in
 * the bare Default.bwpreset) and the user-added LFO (ad947004-…, the only
 * modtest-exclusive UUID, one binary occurrence).
 *
 * Round-1 findings folded back in (a FAIL was a wrong expectation, twice):
 *   - ca8cc421 = the Vibrato modulator ("Vibrato 2" page materialised — and the
 *     built-in's page renamed itself "Vibrato 1": page names are content-derived
 *     and instance-numbered, the E4c layer-name instability again).
 *   - Vibrato is a PER-VOICE modulator: zero output while the project is
 *     silent, so route survival must be measured WITH A NOTE PLAYING.
 *   - dcacb71b materialises NO page (bare page set) — output-only/page-less
 *     type or silently dropped; either way graceful, no crash.
 *
 * Signals:
 *   - page renames away from "LFO"           => the slot changed TYPE
 *   - F1FREQ modulatedValue spread, note held => the ROUTE survived the swap
 */
import {
  client, check, note, failureCount, pollUntil, point, ensureFixtureTracks,
} from './lib.js';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { homedir } from 'node:os';

const MECH = 'trackThenSlot';
const SCRATCH = '/private/tmp/claude-501/-Users-jonvuri-Development-ghostnote/04fcf17e-5b4f-4cfb-9c86-d37a4e796199/scratchpad/e07e';
const LFO_UUID = 'ad947004-f1d3-40a1-bd15-3ec721ee7c65';
const VIBRATO_UUID = 'ca8cc421-bcbc-44d9-8ef3-6e570e528d2b'; // identified round 1
const BUILTIN_2 = 'dcacb71b-0f1a-4493-8916-bd460eee71d5';    // page-less; characterise only

const preset = process.env.GN_MOD_PRESET
  ?? execSync(`find "${homedir()}/Documents/Bitwig Studio/Library" -iname '*modtest*.bwpreset' 2>/dev/null`,
    { encoding: 'utf8' }).trim().split('\n').filter(Boolean)[0];

function uuidToBytes(u: string): Buffer {
  return Buffer.from(u.replace(/-/g, ''), 'hex'); // big-endian, 16 bytes
}
function patchGuid(src: Buffer, from: string, to: string): Buffer {
  const f = uuidToBytes(from);
  const first = src.indexOf(f);
  if (first === -1) throw new Error(`GUID ${from} not found in preset`);
  if (src.indexOf(f, first + 1) !== -1) throw new Error(`GUID ${from} occurs more than once`);
  const out = Buffer.from(src);
  uuidToBytes(to).copy(out, first);
  return out;
}

type RemoteList = {
  remotes: { index: number; exists: boolean; name?: string; value?: number }[];
  existing: number; pageCount: number; selectedPageIndex: number; pageNames: string[]; deviceName: string;
};
type ParamMod = { params: { id: string; value: number; modulatedValue: number }[] };
const remoteList = async () => (await client.request('remote.list')) as RemoteList;
const paramMod = async () => (await client.request('param.modulated')) as ParamMod;
const devList = async () =>
  (await client.request('device.list', { cursor: '0' })) as
    { count: number; devices: { index: number; name: string }[] };

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
  const vals: number[] = [];
  for (let i = 0; i < n; i++) {
    const p = (await paramMod()).params.find((x) => x.id === 'F1FREQ');
    if (p) vals.push(p.modulatedValue);
    await new Promise((r) => setTimeout(r, gap));
  }
  return vals.length ? Math.max(...vals) - Math.min(...vals) : 0;
}
async function loadOntoA(path: string): Promise<RemoteList> {
  await clearDevices();
  await client.request('device.insertFile', { cursor: '0', path });
  await pollUntil(async () => (await devList()).count >= 1, 10000);
  await client.request('devcursor.selectAt', { deviceIndex: 0 });
  await pollUntil(async () => (await remoteList()).deviceName.toLowerCase().includes('poly'), 6000);
  await pollUntil(async () => (await remoteList()).pageCount >= 9, 6000);
  await new Promise((r) => setTimeout(r, 700));
  return remoteList();
}

if (!preset) { console.log('no modtest preset'); process.exit(2); }
await client.connect();
console.log(`connected\npreset: ${preset}\n`);
const src = readFileSync(preset);
mkdirSync(SCRATCH, { recursive: true });
const { trackA } = await ensureFixtureTracks();
await point('0', trackA, 0, MECH);

// Sustained note in gn-A slot 0 so per-voice modulators have a voice to run on.
await client.request('cursor.clearNotes', { cursor: '0' });
await client.request('cursor.setNotes', { cursor: '0', notes: [[0, 60, 100, 4]] });

async function spreadWhilePlaying(): Promise<number> {
  await client.request('slot.launch', { trackIndex: trackA, slotIndex: 0 });
  await pollUntil(async () =>
    ((await client.request('transport.status')) as { isPlaying: boolean }).isPlaying, 4000);
  await new Promise((r) => setTimeout(r, 400)); // let the voice start
  const s = await f1Spread();
  await client.request('transport.stop');
  return s;
}

// -- control: unpatched preset (LFO free-runs; both silent + playing shown)
console.log('-- control: unpatched modtest');
const ctl = await loadOntoA(preset);
const ctlLast = ctl.pageNames[ctl.pageNames.length - 1];
const ctlSilent = await f1Spread();
note(`pages=${ctl.pageCount} last="${ctlLast}" F1FREQ spread silent=${ctlSilent.toFixed(3)}`);
check('control: LFO page present and route live', /lfo/i.test(ctlLast) && ctlSilent > 0.1,
  { last: ctlLast, spread: ctlSilent.toFixed(3) });

// -- swap 1: LFO -> Vibrato (per-voice; measure with a note held)
console.log('\n-- swap LFO -> Vibrato (ca8cc421…), route measured while a note plays');
{
  const path = `${SCRATCH}/modswap-vibrato.bwpreset`;
  writeFileSync(path, patchGuid(src, LFO_UUID, VIBRATO_UUID));
  const rc = await loadOntoA(path);
  const last = rc.pageNames[rc.pageNames.length - 1];
  note(`pages=[${rc.pageNames.join(', ')}]`);
  check('slot changed TYPE: LFO page replaced by a second Vibrato page',
    rc.pageCount === ctl.pageCount && /vibrato/i.test(last) && !/lfo/i.test(rc.pageNames.join(',')),
    { lastPage: last });

  // wake the swapped-in Vibrato: it loads with Rate=0; give it rate + amount
  const lastIdx = rc.pageNames.length - 1;
  await client.request('remote.selectPage', { index: lastIdx });
  await pollUntil(async () => (await remoteList()).selectedPageIndex === lastIdx, 4000);
  await new Promise((r) => setTimeout(r, 400));
  const page = await remoteList();
  note(`controls: ${page.remotes.filter((r) => r.exists)
    .map((r) => `"${r.name}"=${r.value?.toFixed(2)}`).join(', ')}`);
  for (const r of page.remotes.filter((r) => r.exists)) {
    if (/rate/i.test(r.name ?? '')) await client.request('remote.set', { index: r.index, value: 0.7 });
    if (/amount/i.test(r.name ?? '')) await client.request('remote.set', { index: r.index, value: 1 });
  }

  const silent = await f1Spread(4);
  const playing = await spreadWhilePlaying();
  note(`F1FREQ spread: silent=${silent.toFixed(3)} playing=${playing.toFixed(3)}`);
  check('ROUTE to F1FREQ survived the type swap (modulates while a note plays)',
    playing > 0.02, { silent: silent.toFixed(3), playing: playing.toFixed(3) });
  if (playing > 0.02 && silent < 0.02) {
    note('=> and Vibrato is confirmed PER-VOICE: output only while a voice is live.');
  }
}

// -- swap 2: LFO -> dcacb71b (characterisation only — page-less or dropped?)
console.log('\n-- swap LFO -> builtin-2 (dcacb71b…): characterise, with a note held');
{
  const path = `${SCRATCH}/modswap-b2.bwpreset`;
  writeFileSync(path, patchGuid(src, LFO_UUID, BUILTIN_2));
  const rc = await loadOntoA(path);
  note(`pages=[${rc.pageNames.join(', ')}]`);
  check('substituting a page-less/unknown GUID degrades GRACEFULLY (loads, no crash)',
    rc.deviceName.toLowerCase().includes('poly') && rc.pageCount >= 9,
    { pages: rc.pageCount });
  const playing = await spreadWhilePlaying();
  note(`F1FREQ spread while playing: ${playing.toFixed(3)}`);
  note(playing > 0.02
    ? '=> dcacb71b DID materialise (page-less type) and the route survived.'
    : '=> no modulation: dcacb71b is output-only-idle here or was silently dropped.');
}

// -- cleanup
console.log('\n-- cleanup');
await client.request('transport.stop');
check('gn-A devices removed', await clearDevices());
rmSync(SCRATCH, { recursive: true, force: true });
await point('0', trackA, 0, MECH);
await client.request('cursor.clearNotes', { cursor: '0' });
await client.request('cursor.setNotes', { cursor: '0', notes: [[0, 60, 100, 1]] });

console.log(failureCount() === 0 ? '\nE7e: all checks passed' : `\nE7e: ${failureCount()} FAILURES`);
client.disconnect();
process.exit(failureCount() === 0 ? 0 : 1);
