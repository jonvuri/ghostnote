/**
 * E7c — are a loaded modulator's OWN parameters reachable at runtime?
 *
 * E7b proved a template's modulator materialises and drives its target. Open
 * question: once loaded, can the agent read/write the MODULATOR's own controls
 * (the LFO's rate/depth) — not just the modulated target? If yes, one template
 * covers a family of settings (load-then-tweak); if no, every modulator setting
 * needs its own baked template (the cardinality-explosion concern).
 *
 * The only typed address into a modulator was getModulationSource — the dead,
 * throws-at-init API. So the candidate runtime paths are the format-agnostic
 * ones that enumerate a device's whole parameter tree:
 *   - DirectParameter self-enumeration (E4b): does adding an LFO grow the
 *     device's DirectParameter ID list with the LFO's controls?
 *   - remote controls: does any page expose the modulator's params?
 *
 * Compares a BARE Polysynth against the modtest preset (Polysynth + LFO→filter).
 * Non-destructive to gn-B; restores gn-A.
 */
import {
  client, check, note, failureCount, pollUntil, point, ensureFixtureTracks,
} from './lib.js';
import { execSync } from 'node:child_process';
import { homedir } from 'node:os';

const MECH = 'trackThenSlot';
const POLYSYNTH = 'a9ffacb5-33e9-4fc7-8621-b1af31e410ef';

function findPreset(): string | null {
  if (process.env.GN_MOD_PRESET) return process.env.GN_MOD_PRESET;
  try {
    const lib = `${homedir()}/Documents/Bitwig Studio/Library`;
    return execSync(`find "${lib}" -iname '*modtest*.bwpreset' 2>/dev/null`, { encoding: 'utf8' })
      .trim().split('\n').filter(Boolean)[0] ?? null;
  } catch { return null; }
}

type DirectList = {
  params: { id: string; name?: string; value?: number; displayed?: string }[];
  count: number; deviceName: string;
};
type RemoteList = {
  remotes: { index: number; exists: boolean; name?: string }[];
  existing: number; pageCount: number; pageNames: string[]; deviceName: string;
};
const directList = async () => (await client.request('directparam.list')) as DirectList;
const remoteList = async () => (await client.request('remote.list')) as RemoteList;
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

// LFO-ish control names to look for among the device's params.
const MODWORDS = /\b(lfo|rate|phase|depth|amount|amt|attack|decay|sustain|release|shape|mod\d|env\d?|freq(uency)?)\b/i;

await client.connect();
console.log('connected\n');
const preset = findPreset();
if (!preset) { console.log('no modtest preset found'); process.exit(2); }
const { trackA } = await ensureFixtureTracks();
await point('0', trackA, 0, MECH);

async function snapshot(label: string): Promise<{ dp: DirectList; rc: RemoteList }> {
  await client.request('devcursor.selectAt', { deviceIndex: 0 });
  await pollUntil(async () => (await directList()).deviceName.toLowerCase().includes('poly'), 6000);
  await new Promise((r) => setTimeout(r, 1200)); // DirectParameter observers stream in
  const dp = await directList();
  const rc = await remoteList();
  note(`${label}: device="${dp.deviceName}" directParams=${dp.count} remotePages=${rc.pageCount}`);
  return { dp, rc };
}

// ---- A. baseline: bare Polysynth
console.log('-- A. bare Polysynth');
await clearDevices();
await client.request('device.insertBitwig', { cursor: '0', uuid: POLYSYNTH });
await pollUntil(async () => (await devList()).count === 1, 8000);
const bare = await snapshot('bare');

// ---- B. modtest: Polysynth + LFO wired to filter
console.log('\n-- B. modtest preset (Polysynth + LFO → Filter Frequency)');
await clearDevices();
await client.request('device.insertFile', { cursor: '0', path: preset });
await pollUntil(async () => (await devList()).count >= 1, 10000);
const mod = await snapshot('modtest');

// ---- C. diff
console.log('\n-- C. what did the added modulator expose?');
const bareIds = new Set(bare.dp.params.map((p) => p.id));
const newDirect = mod.dp.params.filter((p) => !bareIds.has(p.id));
note(`directParam count: bare=${bare.dp.count} -> modtest=${mod.dp.count} (delta ${mod.dp.count - bare.dp.count})`);
note('new directParam ids/names: ' +
  (newDirect.map((p) => `${p.id}${p.name ? `="${p.name}"` : ''}`).join(', ') || '(none)'));
const modLooking = mod.dp.params.filter((p) => MODWORDS.test(p.name ?? '') || MODWORDS.test(p.id));
note('directParams whose NAME looks modulator-ish: ' +
  (modLooking.slice(0, 12).map((p) => `${p.id}="${p.name}"`).join(', ') || '(none)'));

const bareRemoteNames = new Set(bare.rc.remotes.filter((r) => r.exists).map((r) => r.name));
const newRemotes = mod.rc.remotes.filter((r) => r.exists && !bareRemoteNames.has(r.name));
note(`remote pages: bare=[${bare.rc.pageNames.join(', ')}]`);
note(`             modtest=[${mod.rc.pageNames.join(', ')}]`);
note('new remote-control names on page 0: ' +
  (newRemotes.map((r) => `"${r.name}"`).join(', ') || '(none)'));

const reachable = newDirect.length > 0 || mod.rc.pageNames.length > bare.rc.pageNames.length;
check('adding a modulator changes the runtime-visible parameter surface',
  reachable, { directDelta: mod.dp.count - bare.dp.count,
    remotePagesDelta: mod.rc.pageNames.length - bare.rc.pageNames.length });
note(reachable
  ? '=> a loaded modulator IS at least partially runtime-visible — load-then-tweak may work.'
  : '=> a loaded modulator is INVISIBLE at runtime — its own controls are not addressable;');
if (!reachable) note('   every modulator setting would need its own baked template (cardinality concern).');

// ---- cleanup
console.log('\n-- cleanup');
await clearDevices();
await point('0', trackA, 0, MECH);
await client.request('cursor.clearNotes', { cursor: '0' });
await client.request('cursor.setNotes', { cursor: '0', notes: [[0, 60, 100, 1]] });

console.log(failureCount() === 0 ? '\nE7c: check ran' : `\nE7c: ${failureCount()} FAILURES`);
client.disconnect();
process.exit(0);
