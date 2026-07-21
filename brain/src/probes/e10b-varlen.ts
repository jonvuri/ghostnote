/**
 * E10b — is routing-target substitution VARIABLE-LENGTH, or only length-preserving?
 *
 * E10 moved a modulation route by overwriting the target path string in place
 * ('CONTENTS/F1FREQ' -> 'CONTENTS/F1RESO', both 15 bytes). That worked, but it
 * proves the weaker claim: it never touched a single offset in the file. Real
 * parameter paths are not all 15 characters, so unless targets can also change
 * LENGTH, the capability is a curiosity rather than a tool.
 *
 * A length change means rewriting the string's own u32 length prefix and
 * shifting every byte after it. That is only safe if nothing else in the
 * container encodes an absolute offset or a byte length spanning the edit. From
 * decoding the format this session:
 *   - the u32 following a 0x09 (object) / 0x12 (list) type byte is a classId,
 *     NOT a byte length  -> nothing to fix up  [INFERENCE UNDER TEST HERE]
 *   - header field f4 points at the object-stream root, which sits BEFORE any
 *     routing string, so a later edit cannot move it
 *   - meta carries a `revision_id` hash, but E10 already changed file content
 *     without updating it and Bitwig loaded it fine -> not validated
 * If the classId inference is wrong, an enclosing length would now be stale and
 * the file should fail to load, load unwired, or (worst case) crash the host.
 *
 * Two cases, in both directions, because a shift could plausibly break one way
 * and not the other:
 *   LONGER   'CONTENTS/F1FREQ' (15) -> 'CONTENTS/OSC1_PITCH' (19)   +4 bytes
 *   SHORTER  'CONTENTS/F1FREQ' (15) -> 'CONTENTS/NOISE'      (14)   -1 byte
 *
 * Each case is judged two-sided, as in E10: the modulation must LEAVE F1FREQ and
 * ARRIVE at the named target. "Left F1FREQ" alone would also be consistent with
 * a corrupted file that silently dropped the route.
 *
 * ⚠ Not every enumerable param id forms a valid target path. 'CONTENTS/GAIN'
 * loaded cleanly and silently carried NO modulation, even though GAIN is
 * enumerable — 'CONTENTS/<id>' is not a universal rule (GAIN appears among the
 * nested EFFECT_CHAIN strings in the file, so its real path is presumably
 * deeper). A wrong path is a SILENT no-op, exactly like every other insert trap
 * in this spike, so a retarget must always be confirmed by readback.
 *
 * Modulation is measured as modulatedValue diverging from the base value (E7
 * Finding B), never as movement over time — modtest's LFO is transport-synced
 * and holds a fixed phase while the transport is stopped (the false negative
 * that E10's first run walked into).
 */
import {
  client, check, note, failureCount, pollUntil, point, ensureFixtureTracks,
} from './lib.js';
import { execSync } from 'node:child_process';
import { homedir, tmpdir } from 'node:os';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const MECH = 'trackThenSlot';
const OLD_TARGET = 'CONTENTS/F1FREQ';
const OLD_PARAM = 'F1FREQ';

const CASES = [
  { label: 'LONGER',  target: 'CONTENTS/OSC1_PITCH', param: 'OSC1_PITCH' },
  // NB: the target must be one of the params the rig actually enumerates (14 on
  // this device), not merely a string present in the preset. An earlier run used
  // CONTENTS/PAN, which is in the file but not enumerable, so the case could not
  // be judged either way — a bad fixture, not a negative result.
  { label: 'SHORTER', target: 'CONTENTS/NOISE',      param: 'NOISE' },
];

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

/**
 * Replace the length-prefixed string `oldS` with `newS`, rewriting the u32
 * length prefix that sits immediately before it. Lengths may differ.
 */
function patchLengthPrefixed(src: Buffer, oldS: string, newS: string) {
  const at = src.indexOf(oldS, 0, 'latin1');
  if (at < 0) throw new Error(`target ${oldS} not found`);
  const prefix = src.readUInt32BE(at - 4);
  if (prefix !== oldS.length) {
    throw new Error(`expected u32 length prefix ${oldS.length} at ${at - 4}, got ${prefix}`);
  }
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(newS.length);
  return Buffer.concat([
    src.subarray(0, at - 4),
    lenBuf,
    Buffer.from(newS, 'latin1'),
    src.subarray(at + oldS.length),
  ]);
}

async function loadAndMeasure(path: string, label: string) {
  await clearDevices();
  await client.request('device.insertFile', { cursor: '0', path });
  const loaded = await pollUntil(async () => (await devList()).count >= 1, 10000);
  const chain = await devList();
  check(`[${label}] patched preset still LOADS (chain: ${chain.devices.map((d) => d.name).join(', ')})`,
    loaded.ok && chain.count >= 1, chain);
  if (!loaded.ok) return new Map<string, number>();

  await client.request('devcursor.selectAt', { deviceIndex: 0 });
  await pollUntil(async () => (await paramMod()).deviceName.toLowerCase().includes('poly'), 6000);
  await new Promise((r) => setTimeout(r, 800));

  const samples: { id: string; value: number; mv: number }[][] = [];
  for (let i = 0; i < 6; i++) {
    const pm = await paramMod();
    samples.push(pm.params.map((p) => ({ id: p.id, value: p.value, mv: p.modulatedValue })));
    await new Promise((r) => setTimeout(r, 180));
  }
  const diverge = new Map<string, number>();
  for (const id of samples[0].map((s) => s.id)) {
    diverge.set(id, samples.map((s) => s.find((x) => x.id === id)!)
      .reduce((m, s) => Math.max(m, Math.abs(s.mv - s.value)), 0));
  }
  const hit = [...diverge.entries()].filter(([, d]) => d > 1e-3).map(([id]) => id);
  note(`[${label}] params carrying modulation: [${hit.join(', ') || 'none'}]`);
  return diverge;
}

const preset = findPreset();
if (!preset) {
  console.log('NO PRESET FOUND — need the E7 modtest.bwpreset. Set GN_MOD_PRESET=/abs/path.bwpreset');
  process.exit(2);
}

const src = readFileSync(preset);
check(`${OLD_TARGET} occurs exactly once`,
  src.toString('latin1').split(OLD_TARGET).length - 1 === 1);

await client.connect();
console.log(`connected\ntemplate: ${preset}\n`);
const { trackA } = await ensureFixtureTracks();
await point('0', trackA, 0, MECH);

const T = 1e-3;
const written: string[] = [];

for (const c of CASES) {
  console.log(`\n-- ${c.label}: ${OLD_TARGET} (${OLD_TARGET.length}) -> ${c.target} (${c.target.length})`);
  const patched = patchLengthPrefixed(src, OLD_TARGET, c.target);
  const delta = patched.length - src.length;
  note(`[${c.label}] file size ${src.length} -> ${patched.length} (${delta >= 0 ? '+' : ''}${delta} bytes)`);
  check(`[${c.label}] size shifted by exactly the length delta`,
    delta === c.target.length - OLD_TARGET.length, { delta });

  const p = join(tmpdir(), `gn-e10b-${c.label.toLowerCase()}.bwpreset`); // absolute + .bwpreset (E4h)
  writeFileSync(p, patched);
  written.push(p);

  const d = await loadAndMeasure(p, c.label);
  const oldD = d.get(OLD_PARAM) ?? 0;
  const newD = d.get(c.param) ?? -1;
  note(`[${c.label}] ${OLD_PARAM} divergence=${oldD.toFixed(4)}  ${c.param} divergence=${newD.toFixed(4)}`);

  check(`[${c.label}] target param ${c.param} is enumerable (sanity: it exists on this device)`,
    d.has(c.param), { known: d.has(c.param) });
  check(`[${c.label}] modulation LEFT ${OLD_PARAM}`, oldD <= T, { oldD });
  check(`[${c.label}] modulation ARRIVED at ${c.param}`, newD > T, { newD });
}

note('=> all green: routing targets are variable-length editable; nothing in the');
note('   container encodes a byte length or offset spanning the edit, so the');
note('   classId reading of the 0x09/0x12 u32 holds. Targets are fully');
note('   parameterisable -> the slot-bank need not pre-wire a target matrix.');
note('=> loads but unwired: an enclosing length IS stale -> only length-preserving');
note('   edits are safe, and Finding H keeps its curated target set.');

console.log('\n-- cleanup');
check('gn-A devices removed', await clearDevices());
await point('0', trackA, 0, MECH);
await client.request('cursor.clearNotes', { cursor: '0' });
await client.request('cursor.setNotes', { cursor: '0', notes: [[0, 60, 100, 1]] });
for (const p of written) { try { unlinkSync(p); } catch { /* best effort */ } }

console.log(failureCount() === 0 ? '\nE10b: all checks passed' : `\nE10b: ${failureCount()} FAILURES`);
client.disconnect();
process.exit(failureCount() === 0 ? 0 : 1);
