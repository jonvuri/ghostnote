/**
 * E10 — can a modulation ROUTING TARGET be changed by editing the preset?
 *
 * E7 Finding F recorded routing-target change as ○: unreachable in every RUNTIME
 * state, including foregrounded (the map idiom never latches). It concluded that
 * arbitrary-target routing needs "hazardous binary topology surgery" and parked
 * it as a sequenced-later escape hatch, forcing the slot-bank template design
 * (Finding H) with a CURATED, not arbitrary, target set.
 *
 * Decoding the `.bwpreset` container (this session) showed that is very likely
 * overstated. A modulator's routing target is not an opaque topology atom — it
 * is a plain, length-prefixed UTF-8 STRING holding a parameter path:
 *
 *   <0x06c9> modulator {
 *     #0x009a str 'LFO'                       <- modulator device
 *     #0x18c6 GUID ad947004-…                 <- modulator identity (E7e/g)
 *     #0x18c7 OBJ 'CONTENTS' [ … 'LFO' [
 *         #0x0e3d str = 'CONTENTS/F1FREQ'     <- THE ROUTING TARGET
 *         #0x0124 f64 = -36  #0x0125 f64 = 36 <- range
 *         #0x0e32 f64 = 0.5                   <- amount
 *     ] ]
 *   }
 *
 * So retargeting *may* be a length-preserving string substitution — the same
 * class of edit as E4g's device-GUID swap, which loads cleanly, and NOT the
 * structural atom splicing that crashes Bitwig (E4f / bwEdit-Python).
 *
 * THE TEST (two-sided, so neither outcome is ambiguous):
 *   Phase A  load the UNPATCHED template  -> expect F1FREQ modulated, F1RESO not.
 *   Phase B  load a copy with the routing string patched
 *            'CONTENTS/F1FREQ' -> 'CONTENTS/F1RESO' (both 15 bytes, so every
 *            offset in the file is preserved)
 *            -> expect F1RESO modulated and F1FREQ clean.
 *
 * A one-sided result would be weak: if F1FREQ merely stopped being modulated,
 * the edit could have broken the route rather than moved it. Requiring the
 * modulation to APPEAR on the new target distinguishes "retargeted" from
 * "destroyed".
 *
 * "Modulated" is measured as modulatedValue diverging from the static base value
 * (E7 Finding B) — NOT as movement over time. The first run of this probe used
 * temporal spread and reported a false negative on its own baseline: modtest's
 * LFO is transport-synced, so with the transport stopped it holds a fixed phase,
 * diverging strongly while never moving. Divergence is the robust signal.
 *
 * Watch for the E4f gate-3 trap: a silent wrong-result, where Bitwig ignores the
 * edit and loads the ORIGINAL routing. That shows up here as Phase B looking
 * identical to Phase A, and is recorded as ○ (not as a pass).
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
const NEW_TARGET = 'CONTENTS/F1RESO';

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

/** Load a preset onto gn-A and report, per param, whether modulatedValue MOVES. */
async function loadAndSample(path: string, label: string) {
  await clearDevices();
  await client.request('device.insertFile', { cursor: '0', path });
  const loaded = await pollUntil(async () => (await devList()).count >= 1, 10000);
  const chain = await devList();
  check(`[${label}] preset loads (chain: ${chain.devices.map((d) => d.name).join(', ')})`,
    loaded.ok && chain.count >= 1, chain);

  await client.request('devcursor.selectAt', { deviceIndex: 0 });
  await pollUntil(async () => (await paramMod()).deviceName.toLowerCase().includes('poly'), 6000);
  await new Promise((r) => setTimeout(r, 800));

  const samples: { id: string; value: number; mv: number }[][] = [];
  for (let i = 0; i < 8; i++) {
    const pm = await paramMod();
    samples.push(pm.params.map((p) => ({ id: p.id, value: p.value, mv: p.modulatedValue })));
    await new Promise((r) => setTimeout(r, 180));
  }
  // "Modulation lands on this param" = modulatedValue DIVERGES from the static
  // base value (E7 Finding B). Do NOT use movement-over-time: a transport-synced
  // LFO holds a fixed phase while the transport is stopped, so it diverges
  // without ever moving. Measuring spread reports a live route as absent.
  const diverge = new Map<string, number>();
  for (const id of samples[0].map((s) => s.id)) {
    const d = samples.map((s) => s.find((x) => x.id === id)!)
      .reduce((m, s) => Math.max(m, Math.abs(s.mv - s.value)), 0);
    diverge.set(id, d);
  }
  const hit = [...diverge.entries()].filter(([, d]) => d > 1e-3).map(([id]) => id);
  note(`[${label}] params carrying modulation (mv != value): [${hit.join(', ') || 'none'}]`);
  for (const id of ['F1FREQ', 'F1RESO']) {
    const s = samples[0].find((x) => x.id === id);
    note(`[${label}]   ${id}: value=${s?.value.toFixed(4)} mv=${s?.mv.toFixed(4)} ` +
         `divergence=${(diverge.get(id) ?? -1).toFixed(4)}`);
  }
  return diverge;
}

const preset = findPreset();
if (!preset) {
  console.log('NO PRESET FOUND — need the E7 modtest.bwpreset (Polysynth + LFO -> F1FREQ).');
  console.log('Set GN_MOD_PRESET=/abs/path.bwpreset');
  process.exit(2);
}

// ---- build the patched copy (length-preserving, single occurrence) ----
const src = readFileSync(preset);
const occurrences = src.toString('latin1').split(OLD_TARGET).length - 1;
check(`routing target ${OLD_TARGET!} occurs EXACTLY once (length-preserving swap is safe)`,
  occurrences === 1, { occurrences });
if (OLD_TARGET.length !== NEW_TARGET.length) {
  throw new Error('substitution must be length-preserving');
}
const patched = Buffer.from(src);
const at = src.indexOf(OLD_TARGET, 0, 'latin1');
patched.write(NEW_TARGET, at, 'latin1');
const patchedPath = join(tmpdir(), 'gn-e10-retarget.bwpreset'); // absolute + .bwpreset (E4h)
writeFileSync(patchedPath, patched);
note(`patched ${OLD_TARGET} -> ${NEW_TARGET} at offset ${at} (0x${at.toString(16)})`);
note(`same size: ${src.length} -> ${patched.length}`);

await client.connect();
console.log(`connected\ntemplate: ${preset}\npatched:  ${patchedPath}\n`);
const { trackA } = await ensureFixtureTracks();
await point('0', trackA, 0, MECH);

console.log('-- PHASE A: unpatched template (baseline)');
const a = await loadAndSample(preset, 'A/orig');

console.log('\n-- PHASE B: patched routing target');
const b = await loadAndSample(patchedPath, 'B/patched');

console.log('\n-- verdict');
const T = 1e-3;
const aFreq = a.get('F1FREQ') ?? 0, aReso = a.get('F1RESO') ?? 0;
const bFreq = b.get('F1FREQ') ?? 0, bReso = b.get('F1RESO') ?? 0;

check('A: baseline modulation lands on F1FREQ (and not F1RESO)',
  aFreq > T && aReso <= T, { aFreq, aReso });
check('B: modulation LEFT the old target (F1FREQ no longer modulated)',
  bFreq <= T, { bFreq });
check('B: modulation ARRIVED at the new target (F1RESO now modulated)',
  bReso > T, { bReso });
note('=> all green: a routing target is a length-preserving STRING edit, and E7');
note('   Finding F ("arbitrary-target routing needs hazardous topology surgery")');
note('   is overstated -- targets become parameterisable like device GUIDs (E4g).');
note('=> B identical to A: the E4f gate-3 trap (edit ignored, original loaded) -> ○.');

console.log('\n-- cleanup');
check('gn-A devices removed', await clearDevices());
await point('0', trackA, 0, MECH);
await client.request('cursor.clearNotes', { cursor: '0' });
await client.request('cursor.setNotes', { cursor: '0', notes: [[0, 60, 100, 1]] });
try { unlinkSync(patchedPath); } catch { /* best effort */ }

console.log(failureCount() === 0 ? '\nE10: all checks passed' : `\nE10: ${failureCount()} FAILURES`);
client.disconnect();
process.exit(failureCount() === 0 ? 0 : 1);
