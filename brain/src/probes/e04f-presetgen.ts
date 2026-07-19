/**
 * E4f — Can insertFile construct structures ON THE FLY, without presets
 * prepared in advance?
 *
 * insertFile materialises whatever a .bwpreset contains (E4d). The open
 * question is whether the agent can PRODUCE such a file at runtime, which
 * would turn "ship a preset library" into "synthesise any structure on
 * demand". Three gates, cheapest first — each one is fatal if it fails:
 *
 *   GATE 1  does insertFile accept an arbitrary path (outside the Library)?
 *   GATE 2  does it accept a byte-identical COPY (no Library registration)?
 *   GATE 3  does a length-preserving byte PATCH load — swapping a device
 *           UUID for another? This is the cheapest possible synthesis: no
 *           understanding of the format required, no offsets to recompute.
 *
 * Gate 3 is the real question. If a UUID swap survives, "template preset +
 * substitution" is a viable on-the-fly construction path. If it does not,
 * synthesis requires genuinely reverse-engineering an undocumented binary
 * format, and the honest answer is a preset library.
 *
 * Read-only against the app bundle; all writes go to a scratch dir.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  client, check, note, failureCount, pollUntil, point, ensureFixtureTracks,
} from './lib.js';

const MECH = 'trackThenSlot';
const POLYSYNTH = 'a9ffacb5-33e9-4fc7-8621-b1af31e410ef';
const POLYMER = '8f58138b-03aa-4e9d-83bd-a038c99a4ed5';
const DS = '/Applications/Bitwig Studio.app/Contents/Resources/Library/device-settings';
const POLYSYNTH_PRESET = path.join(DS, POLYSYNTH, 'Default.bwpreset');
const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), 'gn-presetgen-'));

const devList = async () => (await client.request('device.list', { cursor: '0' })) as any;
const nesting = async () => (await client.request('device.nesting')) as any;

async function clearDevices() {
  let l = await devList();
  for (let g = 0; g < 12 && l.count > 0; g++) {
    await client.request('device.delete', { cursor: '0', deviceIndex: l.devices[0].index });
    await pollUntil(async () => (await devList()).count < l.count, 5000);
    l = await devList();
  }
  return l.count === 0;
}

/** insertFile the given path; return the resulting top-level device name. */
async function insertFileAndRead(p: string, label: string): Promise<string | null> {
  await clearDevices();
  try {
    await client.request('device.insertFile', { cursor: '0', path: p });
  } catch (e) {
    note(`${label}: bridge error — ${(e as Error).message}`);
    return null;
  }
  const ok = await pollUntil(async () => (await devList()).count > 0, 12000);
  if (!ok.ok) return null;
  await client.request('devcursor.selectAt', { deviceIndex: 0 });
  await new Promise((r) => setTimeout(r, 900));
  return (await nesting()).name;
}

await client.connect();
console.log('connected\n');
const { trackA } = await ensureFixtureTracks();
await point('0', trackA, 0, MECH);
note(`scratch dir: ${SCRATCH}`);

// ============================================================ GATE 1
console.log('\n-- GATE 1: insertFile with an arbitrary path (app bundle, not the user Library)');
const g1 = await insertFileAndRead(POLYSYNTH_PRESET, 'bundle path');
note(`insertFile("<bundle>/${POLYSYNTH}/Default.bwpreset") → ${g1 ? `"${g1}"` : 'NOTHING'}`);
check('GATE 1: insertFile loads a preset from an arbitrary filesystem path',
  g1 !== null && g1.toLowerCase().includes('poly'), { loaded: g1 });

// ============================================================ GATE 2
console.log('\n-- GATE 2: a byte-identical copy in a scratch dir (no Library registration)');
const copyPath = path.join(SCRATCH, 'copy.bwpreset');
fs.copyFileSync(POLYSYNTH_PRESET, copyPath);
const g2 = await insertFileAndRead(copyPath, 'scratch copy');
note(`insertFile("${copyPath}") → ${g2 ? `"${g2}"` : 'NOTHING'}`);
check('GATE 2: an unregistered file anywhere on disk loads (files are the unit, not Library entries)',
  g2 !== null && g2.toLowerCase().includes('poly'), { loaded: g2 });

// ============================================================ GATE 3
console.log('\n-- GATE 3: length-preserving byte patch — swap the device UUID');
const raw = fs.readFileSync(POLYSYNTH_PRESET);
const occurrences = raw.toString('latin1').split(POLYSYNTH).length - 1;
note(`the Polysynth UUID appears ${occurrences}× in its own preset (${raw.length} bytes)`);
note(`patching → Polymer ${POLYMER} (same 36-char length, so no offsets shift)`);

const patched = Buffer.from(raw.toString('latin1').split(POLYSYNTH).join(POLYMER), 'latin1');
check('patch is byte-length preserving', patched.length === raw.length,
  { before: raw.length, after: patched.length });
const patchPath = path.join(SCRATCH, 'patched.bwpreset');
fs.writeFileSync(patchPath, patched);

const g3 = await insertFileAndRead(patchPath, 'patched');
note(`insertFile(patched) → ${g3 ? `"${g3}"` : 'NOTHING LOADED'}`);
const swapWorked = g3 !== null && g3.toLowerCase().includes('polymer');
check('GATE 3: a UUID-substituted preset loads as the SUBSTITUTED device',
  swapWorked, { expected: 'Polymer', got: g3 });

if (!swapWorked) {
  note('⇒ substitution is NOT a free lunch: the format is not a bag of independent');
  note('  fields. Device state is bound to the device identity (checksums, payload');
  note('  layout, or per-device blobs), so on-the-fly synthesis needs real format work.');
} else {
  note('⇒ template + UUID substitution IS viable: structures can be parameterised');
  note('  at runtime without understanding the rest of the format.');
}

// ============================================================ GATE 4
console.log('\n-- GATE 4: patch the BINARY GUID too (the real identity)');
note('the 2 ASCII hits are metadata — "device_id" and "referenced_device_ids".');
note('the payload carries the identity as a raw 16-byte big-endian GUID, which');
note('GATE 3 left untouched. That is why the original device still loaded.');

const uuidBytes = (u: string) => Buffer.from(u.replace(/-/g, ''), 'hex');
const psBin = uuidBytes(POLYSYNTH);
const pmBin = uuidBytes(POLYMER);
const binHits = raw.length - Buffer.concat([raw]).toString('latin1')
  .split(psBin.toString('latin1')).join('').length;
note(`raw 16-byte GUID occurrences: ${binHits / 16}`);

let full = patched.toString('latin1').split(psBin.toString('latin1')).join(pmBin.toString('latin1'));
const fullBuf = Buffer.from(full, 'latin1');
check('binary patch is also length-preserving', fullBuf.length === raw.length,
  { before: raw.length, after: fullBuf.length });
const fullPath = path.join(SCRATCH, 'patched-binary.bwpreset');
fs.writeFileSync(fullPath, fullBuf);

// NOTE: feeding a device a payload authored for a DIFFERENT device is exactly
// the class of input the community parser had to fix to stop crashing Bitwig.
// Scratch project only.
const g4 = await insertFileAndRead(fullPath, 'binary-patched');
note(`insertFile(binary-patched) → ${g4 ? `"${g4}"` : 'NOTHING LOADED'}`);
const binSwapWorked = g4 !== null && g4.toLowerCase().includes('polymer');
check('GATE 4: patching the binary GUID swaps the device that loads',
  binSwapWorked, { expected: 'Polymer', got: g4 });

if (binSwapWorked) {
  note('⇒ identity IS swappable, but the payload following it was authored for the');
  note('  ORIGINAL device — so this only holds where the two devices share a state');
  note('  layout. It is not general-purpose synthesis.');
} else {
  note('⇒ even a full identity swap does not produce a valid preset for another');
  note('  device: the state payload is device-specific. Synthesis requires authoring');
  note('  that payload, i.e. real reverse-engineering of an undocumented format.');
}

// ============================================================ GATE 5
console.log('\n-- GATE 5: is the substituted device actually FUNCTIONAL?');
note('it inherited a state payload authored for the other device, so "it loaded"');
note('is not the same as "it works". DirectParameter (E4b) enumerates any device.');
if (binSwapWorked) {
  const dl = await pollUntil(async () =>
    ((await client.request('directparam.list')) as any).count > 0, 8000);
  const dp = (await client.request('directparam.list')) as any;
  note(`substituted device enumerates ${dp.count} direct params: ` +
    dp.params.slice(0, 4).map((p: any) => `"${p.name}"=${p.value?.toFixed(2)}`).join(', '));
  check('GATE 5: the substituted device enumerates its own parameters (it is live)',
    dl.ok && dp.count > 0, { count: dp.count });

  const t = dp.params.find((p: any) => typeof p.value === 'number');
  if (t) {
    const want = t.value > 0.5 ? 0.25 : 0.75;
    await client.request('directparam.set', { id: t.id, value: want, resolution: 1 });
    const wrote = await pollUntil(async () => {
      const p = ((await client.request('directparam.list')) as any).params
        .find((x: any) => x.id === t.id);
      return p ? Math.abs(p.value - want) < 0.03 : false;
    }, 4000);
    check('GATE 5: parameters on the substituted device are writable',
      wrote.ok, { id: t.id, want });
    note('⇒ preset state does not need to be correct: load the SHAPE from a template,');
    note('  then set every parameter through the API (E4/E4b). That is the pipeline.');
  }
}

// ============================================================ verdict aids
console.log('\n-- supporting facts for the write-up');
note('No save/export-preset API exists (only Device.loadPreset(int) and the browser),');
note('so the agent can never CAPTURE a structure it or the user built — presets must');
note('come from the user saving them in the UI, or from synthesis.');
note(`Preset header: "BtWg" magic + tag/length/value records; a structural preset is`);
note(`small (FX Layer default = 6.6KB) while sample-bearing ones reach megabytes.`);

// ============================================================ cleanup
console.log('\n-- cleanup');
check('gn-A devices removed', await clearDevices());
await point('0', trackA, 0, MECH);
await client.request('cursor.clearNotes', { cursor: '0' });
await client.request('cursor.setNotes', { cursor: '0', notes: [[0, 60, 100, 1]] });
fs.rmSync(SCRATCH, { recursive: true, force: true });
note(`scratch dir removed`);

console.log(failureCount() === 0 ? '\nE4f: all checks passed' : `\nE4f: ${failureCount()} check(s) failed — see above; a failed GATE is itself the finding`);
client.disconnect();
process.exit(0);
