/**
 * E10e — REPLACE isolated: is the gate object-length, or object-replacement itself?
 *
 * E10c replaced modtest's Expressions[459B] with modzoo's Classic LFO[579B] and
 * the whole preset was rejected. But that edit confounded THREE things:
 *   (1) it changed the object's byte length (+120),
 *   (2) the donor was foreign (its GUID not pre-listed in modtest's meta),
 *   (3) it changed object content/structure.
 * E10c's meta-repair phase removed (2) and still failed, but (1) and (3) stayed
 * tangled. This probe separates length from replacement.
 *
 * THE TECHNIQUE. E10b proved a string VALUE can be any length and the file still
 * loads (nothing encodes an offset/length spanning the edit). So a donor object
 * can be tuned to an EXACT byte length by padding one of its empty string fields.
 * Classic LFO is 579B; modtest's Vibrato is 773B. Padding an empty field in the
 * donor by +194 makes a 773B Classic LFO that replaces Vibrato with ZERO change
 * to total file size and every other offset — the cleanest possible replace.
 *
 * FIVE loads, each judged by whether the preset loads AND whether the donor's
 * remote page appears (the E7c/E10c signal that the type instantiated):
 *   S0  unmodified modtest                       baseline, must load
 *   S1  pad an empty field in modtest's own LFO   padding-sanity: isolates whether
 *       object IN PLACE (no replace), +80B        the padding trick itself is safe
 *   R1  replace VIBRATO (LFO, slot0) w/ Classic   identical-length same-category
 *       LFO padded to EXACTLY 773B; meta fixed    replace
 *   R2  replace VIBRATO (LFO, slot0) w/ Classic   different-length (-194)
 *       LFO at native 579B; meta fixed            same-category replace
 *   R3  replace EXPRESSIONS (Note-driven, slot1)  E10c reproduction — the
 *       w/ Classic LFO (LFO); meta fixed          CROSS-category case
 *
 * OUTCOME (recorded): R1 + R2 LOAD with a live Classic LFO; R3 REJECTS. So length
 * is decisively NOT the gate (R2 loads shorter, R3 rejects longer). All five
 * modulators share classId 0x06c9; the field that splits the result is CATEGORY
 * (0x009c): Vibrato/LFO/Classic LFO = 'LFO', Expressions = 'Note-driven'. Type
 * substitution WORKS within a category. E7g/E10c's ○ were cross-category cases.
 *
 * ⚠ CONFOUND not resolvable with these fixtures: R1/R2 replace slot 0, R3 slot 1,
 * and both donor presets carry only LFO-category modulators — so category-match
 * vs slot-POSITION cannot be separated here. That needs minimal-pair presets
 * (a Note-driven modulator at slot 0; an LFO at slot 1). Recorded as the open
 * question this probe hands off.
 *
 * Modulation is read as modulatedValue divergence (E7 Finding B), never movement.
 */
import {
  client, check, note, failureCount, pollUntil, point, ensureFixtureTracks,
} from './lib.js';
import { execSync } from 'node:child_process';
import { homedir, tmpdir } from 'node:os';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const MECH = 'trackThenSlot';
const VIBRATO_GUID = 'ca8cc421-bcbc-44d9-8ef3-6e570e528d2b';
const CLFO_GUID = '39f4b136-2946-4ac5-b34c-e5fde1e58fd8';

function find(name: string): string {
  return execSync(`find "${homedir()}/Documents/Bitwig Studio/Library" -iname '*${name}*.bwpreset' 2>/dev/null`,
    { encoding: 'utf8' }).trim().split('\n')[0];
}

type Mod = { index: string; start: number; end: number; device: string };
function findModulators(b: Buffer): Mod[] {
  const marker = Buffer.from([0, 0, 0x02, 0xb9, 0x08, 0, 0, 0, 0x01]);
  const starts: { at: number; index: string }[] = [];
  let i = b.indexOf(marker, 0);
  while (i !== -1) {
    const ch = b[i + marker.length];
    if (ch >= 0x30 && ch <= 0x39) starts.push({ at: i - 4, index: String.fromCharCode(ch) });
    i = b.indexOf(marker, i + 1);
  }
  return starts.map((s, n) => {
    const end = starts[n + 1]?.at ?? -1;
    const seg = b.subarray(s.at, end < 0 ? b.length : end);
    const j = seg.indexOf(Buffer.from([0, 0, 0, 0x9a, 0x08]));
    const len = j >= 0 ? seg.readUInt32BE(j + 5) : 0;
    return { index: s.index, start: s.at, end,
      device: j >= 0 ? seg.subarray(j + 9, j + 9 + len).toString('latin1') : '?' };
  });
}

/** Grow an empty string field (type 0x08, current len 0) inside `obj` by `add` bytes. */
function padEmptyField(obj: Buffer, fieldId: number, add: number): Buffer {
  const needle = Buffer.from([
    (fieldId >> 24) & 0xff, (fieldId >> 16) & 0xff, (fieldId >> 8) & 0xff, fieldId & 0xff,
    0x08, 0, 0, 0, 0,
  ]);
  const at = obj.indexOf(needle);
  if (at < 0) throw new Error(`no empty string field ${fieldId.toString(16)} in donor`);
  const lenAt = at + 5;                       // the u32 string length (currently 0)
  const out = Buffer.concat([
    obj.subarray(0, lenAt),
    (() => { const b = Buffer.alloc(4); b.writeUInt32BE(add); return b; })(),
    Buffer.alloc(add, 0x20),                   // pad with spaces (harmless metadata)
    obj.subarray(lenAt + 4),
  ]);
  return out;
}

/** Replace modtest's `recipient` object with `donorObj`, fixing meta ref + slot index. */
function spliceReplace(mt: Buffer, recipient: Mod, donorObj: Buffer, oldGuid: string, newGuid: string): Buffer {
  const d = Buffer.from(donorObj);
  const idxAt = d.indexOf(Buffer.from([0, 0, 0x02, 0xb9, 0x08, 0, 0, 0, 0x01]));
  d[idxAt + 9] = recipient.index.charCodeAt(0);          // donor takes recipient's slot number
  const spliced = Buffer.concat([mt.subarray(0, recipient.start), d, mt.subarray(recipient.end)]);
  const fixed = Buffer.from(spliced.toString('latin1').replace(oldGuid, newGuid), 'latin1');
  if (fixed.length !== spliced.length) throw new Error('meta guid fix not length-preserving');
  return fixed;
}

const mtPath = find('modtest');
const mzPath = find('modzoo');
const mt = readFileSync(mtPath);
const mz = readFileSync(mzPath);
const mtMods = findModulators(mt);
const mzMods = findModulators(mz);
const vibrato = mtMods.find((m) => m.device === 'Vibrato')!;
const lfo = mtMods.find((m) => m.device === 'LFO')!;
const clfo = mzMods.find((m) => m.device === 'Classic LFO')!;
const clfoObj = mz.subarray(clfo.start, clfo.end < 0 ? mz.length : clfo.end);

console.log('-- operands');
note(`recipient  Vibrato      [${vibrato.start},${vibrato.end}) len=${vibrato.end - vibrato.start}`);
note(`donor      Classic LFO  ${clfoObj.length}B  (needs +${vibrato.end - vibrato.start - clfoObj.length} to match)`);

const clfoPadded = padEmptyField(clfoObj, 0x12de, (vibrato.end - vibrato.start) - clfoObj.length);
check('donor padded to EXACT recipient length',
  clfoPadded.length === vibrato.end - vibrato.start, { padded: clfoPadded.length, target: vibrato.end - vibrato.start });

// Build the four files.
const files: { key: string; label: string; buf: Buffer; expectPage?: string; sizeDelta: number }[] = [];
files.push({ key: 'S0', label: 'baseline (unmodified)', buf: mt, sizeDelta: 0 });
{ // S1: pad modtest's own LFO object in place by +80, no replace
  const padded = padEmptyField(mt.subarray(lfo.start), 0x12de, 80);
  files.push({ key: 'S1', label: 'pad own LFO in place (+80, no replace)',
    buf: Buffer.concat([mt.subarray(0, lfo.start), padded]), sizeDelta: 80 });
}
{ // R1: identical-length replace
  const buf = spliceReplace(mt, vibrato, clfoPadded, VIBRATO_GUID, CLFO_GUID);
  files.push({ key: 'R1', label: 'replace Vibrato w/ Classic LFO @ IDENTICAL length',
    buf, expectPage: 'Classic LFO', sizeDelta: buf.length - mt.length });
}
{ // R2: different-length replace (control)
  const buf = spliceReplace(mt, vibrato, clfoObj, VIBRATO_GUID, CLFO_GUID);
  files.push({ key: 'R2', label: 'replace Vibrato w/ Classic LFO @ NATIVE length (-194)',
    buf, expectPage: 'Classic LFO', sizeDelta: buf.length - mt.length });
}
{ // R3: E10c-EXACT reproduction — replace Expressions (Note-driven, slot 1) with an LFO-category donor
  const expressions = mtMods.find((m) => m.device === 'Expressions')!;
  const EXPR_GUID = 'dcacb71b-0f1a-4493-8916-bd460eee71d5';
  const buf = spliceReplace(mt, expressions, clfoObj, EXPR_GUID, CLFO_GUID);
  files.push({ key: 'R3', label: 'replace EXPRESSIONS (Note-driven, slot1) w/ Classic LFO (LFO cat)',
    buf, expectPage: 'Classic LFO', sizeDelta: buf.length - mt.length });
}

const devList = async () =>
  (await client.request('device.list', { cursor: '0' })) as
    { count: number; devices: { index: number; name: string }[] };
const remoteList = async () => (await client.request('remote.list')) as { pageNames: string[] };
const paramMod = async () => (await client.request('param.modulated')) as
  { params: { id: string; value: number; modulatedValue: number }[]; deviceName: string };

async function clearDevices() {
  let l = await devList();
  for (let g = 0; g < 8 && l.count > 0; g++) {
    await client.request('device.delete', { cursor: '0', deviceIndex: l.devices[0].index });
    await pollUntil(async () => (await devList()).count < l.count, 4000);
    l = await devList();
  }
  return l.count === 0;
}

async function loadInspect(path: string) {
  await clearDevices();
  await client.request('device.insertFile', { cursor: '0', path });
  const ok = await pollUntil(async () => (await devList()).count >= 1, 10000);
  if (!ok.ok) return { loaded: false, pages: [] as string[], f1: 0 };
  await client.request('devcursor.selectAt', { deviceIndex: 0 });
  await pollUntil(async () => (await paramMod()).deviceName.toLowerCase().includes('poly'), 6000);
  await new Promise((r) => setTimeout(r, 900));
  const pages = (await remoteList()).pageNames;
  const pm = await paramMod();
  const f = pm.params.find((p) => p.id === 'F1FREQ');
  return { loaded: true, pages, f1: f ? Math.abs(f.modulatedValue - f.value) : 0 };
}

await client.connect();
console.log('\nconnected\n');
const { trackA } = await ensureFixtureTracks();
await point('0', trackA, 0, MECH);

const results: Record<string, { loaded: boolean; pages: string[]; f1: number }> = {};
for (const f of files) {
  const p = join(tmpdir(), `gn-e10e-${f.key}.bwpreset`);
  writeFileSync(p, f.buf);
  console.log(`\n-- ${f.key}: ${f.label}  (Δsize ${f.sizeDelta >= 0 ? '+' : ''}${f.sizeDelta})`);
  const r = await loadInspect(p);
  results[f.key] = r;
  note(`${f.key} -> ${r.loaded ? 'LOADED' : 'REJECTED'}  pages=${JSON.stringify(r.pages.slice(8))}  F1FREQ div=${r.f1.toFixed(4)}`);
  try { unlinkSync(p); } catch { /* best effort */ }
}

const has = (k: string, n: string) => results[k].pages.some((p) => p.toLowerCase() === n.toLowerCase());

console.log('\n-- checks');
check('S0 baseline loads', results.S0.loaded);
check('S1 padding-in-place is SAFE (loads) — the padding trick does not itself break loading',
  results.S1.loaded, results.S1);
check('R1 same-category replace @ IDENTICAL length: LOADS + Classic LFO instantiated',
  results.R1.loaded && has('R1', 'Classic LFO'), results.R1);
check('R1: the untouched slot-2 LFO -> F1FREQ route survived',
  results.R1.f1 > 1e-3, { f1: results.R1.f1 });
check('R2 same-category replace @ DIFFERENT length (-194): LOADS + Classic LFO instantiated',
  results.R2.loaded && has('R2', 'Classic LFO'), results.R2);
check('R3 cross-category replace (Note-driven <- LFO, +120): REJECTED',
  !results.R3.loaded, results.R3);

console.log('\n-- verdict');
// LENGTH is decisively ruled out: R2 succeeds at -194 while R3 fails at +120.
const lengthRuledOut = results.R1.loaded && results.R2.loaded && !results.R3.loaded;
if (results.S1.loaded && lengthRuledOut) {
  note('=> LENGTH IS NOT THE GATE. Same-category (LFO<-LFO) replace LOADS at both');
  note('   identical (R1) and shorter (R2) length; the cross-category attempt (R3,');
  note('   Note-driven slot <- LFO donor) REJECTS at +120. So E7g/E10c\'s ○ was');
  note('   never about length or "replace is blocked" — those were CROSS-CATEGORY');
  note('   cases. Type substitution WORKS within a modulator category.');
  note('⚠ CONFOUND: R1/R2 are (LFO donor, slot 0); R3 is (LFO donor, slot 1 +');
  note('   Note-driven recipient). Category vs slot-POSITION is not yet separated —');
  note('   both donor presets carry only LFO-category modulators. Needs minimal-');
  note('   pair presets: a Note-driven modulator at slot 0, an LFO at slot 1.');
} else if (results.S1.loaded && !results.R1.loaded) {
  note('=> GATE = STRUCTURAL. Even a same-category identical-length replace is');
  note('   rejected — replacement itself is blocked. Type stays a per-template axis.');
} else {
  note('=> INCONCLUSIVE: padding sanity (S1) failed or results mixed — re-design.');
}

console.log('\n-- cleanup');
check('gn-A devices removed', await clearDevices());
await point('0', trackA, 0, MECH);
await client.request('cursor.clearNotes', { cursor: '0' });
await client.request('cursor.setNotes', { cursor: '0', notes: [[0, 60, 100, 1]] });

console.log(failureCount() === 0 ? '\nE10e: all checks passed' : `\nE10e: ${failureCount()} FAILURES`);
client.disconnect();
process.exit(failureCount() === 0 ? 0 : 1);
