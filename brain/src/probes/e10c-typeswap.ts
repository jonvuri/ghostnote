/**
 * E10c — does swapping GUID *and* payload solve modulator TYPE substitution?
 *
 * E7g tried to change a modulator's type by patching only its 16-byte GUID, the
 * edit that works cleanly for DEVICES (E4g). It failed three different ways —
 * unwired / page-less / "Missing" — and E10 explained why: a modulator instance
 * is not identified by its GUID alone. It is an object carrying a TYPE-SPECIFIC
 * payload beside it:
 *
 *   <cls 0x06c9> { device_name 'LFO'  device_guid ad947004-…
 *                  CONTENTS [ RATE, FORM, FADE_IN, TIMEBASE, … ] }
 *
 * Patching 16 bytes leaves LFO-shaped CONTENTS under another type's identity, so
 * Bitwig cannot reconcile it. The obvious follow-up, and the question this probe
 * answers: if the GUID and the payload are replaced TOGETHER — i.e. the whole
 * modulator object is spliced in from a donor preset — does the type actually
 * change and instantiate cleanly?
 *
 * FEASIBILITY. E10b established that length-changing edits are safe: nothing in
 * the container encodes an offset or byte length spanning an edit, so an object
 * of one size can be replaced by one of another. Object boundaries are
 * recoverable without a full parse — every modulator in the MODULATORS list is a
 * list item beginning `<u32 classId> 0x02b9 str '<index>'`, so consecutive item
 * starts delimit each object exactly.
 *
 * THE SPLICE (both operands chosen as NON-LAST items, whose bounds are exact):
 *   donor      modzoo.bwpreset  item0 'Classic LFO'  (39f4b136-…)
 *   recipient  modtest.bwpreset item1 'Expressions'  (dcacb71b-…)
 *
 * 'Classic LFO' is the strongest possible test: it is the GUID that failed
 * WORST under E7g, loading as "Missing" (unloadable) despite loading fine in its
 * own preset.
 *
 * Neither operand carries a routing target (modzoo's modulators were never
 * wired; Expressions has no route), so this isolates ONE variable — type
 * instantiation — and does not disturb the untouched LFO -> F1FREQ route, whose
 * survival is itself a check that the splice did not corrupt its siblings.
 *
 * Observable: a modulator that instantiates correctly gets its own auto-created
 * remote-control PAGE (E7c/E7d). So 'Classic LFO' must APPEAR in pageNames, and
 * its own controls must be readable — a husk would be page-less, which is
 * precisely one of E7g's failure modes.
 */
import {
  client, check, note, failureCount, pollUntil, point, ensureFixtureTracks,
} from './lib.js';
import { execSync } from 'node:child_process';
import { homedir, tmpdir } from 'node:os';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const MECH = 'trackThenSlot';

function findPreset(name: string): string | null {
  try {
    const lib = `${homedir()}/Documents/Bitwig Studio/Library`;
    const out = execSync(`find "${lib}" -iname '*${name}*.bwpreset' 2>/dev/null`, { encoding: 'utf8' })
      .trim().split('\n').filter(Boolean);
    return out[0] ?? null;
  } catch { return null; }
}

type Mod = { index: string; start: number; end: number; device: string; guid: string };

/** Delimit MODULATORS list items. Consecutive starts bound each object exactly. */
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
    const seg = b.subarray(s.at, starts[n + 1]?.at ?? b.length);
    const nameField = Buffer.from([0, 0, 0, 0x9a, 0x08]);
    const j = seg.indexOf(nameField);
    const len = j >= 0 ? seg.readUInt32BE(j + 5) : 0;
    const guidField = Buffer.from([0, 0, 0x18, 0xc6, 0x15]);
    const g = seg.indexOf(guidField);
    return {
      index: s.index,
      start: s.at,
      end: starts[n + 1]?.at ?? -1,   // -1 = last item, bounds not exact
      device: j >= 0 ? seg.subarray(j + 9, j + 9 + len).toString('latin1') : '?',
      guid: g >= 0 ? seg.subarray(g + 5, g + 21).toString('hex') : '?',
    };
  });
}

const devList = async () =>
  (await client.request('device.list', { cursor: '0' })) as
    { count: number; devices: { index: number; name: string }[] };
type Remotes = {
  remotes: { index: number; exists: boolean; name?: string; value?: number }[];
  pageCount: number; selectedPageIndex: number; pageNames: string[];
};
const remoteList = async () => (await client.request('remote.list')) as Remotes;
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

/** `expectLoad: false` means a rejected preset is the expected outcome, so the
 *  load is reported but not asserted — the caller does the asserting. */
async function loadAndInspect(path: string, label: string, expectLoad = true) {
  await clearDevices();
  await client.request('device.insertFile', { cursor: '0', path });
  const loaded = await pollUntil(async () => (await devList()).count >= 1, 10000);
  const chain = await devList();
  const desc = `[${label}] loads (chain: ${chain.devices.map((d) => d.name).join(', ') || 'EMPTY'})`;
  if (expectLoad) check(desc, loaded.ok && chain.count >= 1, chain);
  else note(`${desc} -> ${loaded.ok ? 'loaded' : 'REJECTED'}`);
  if (!loaded.ok) return { pages: [] as string[], f1: 0 };

  await client.request('devcursor.selectAt', { deviceIndex: 0 });
  await pollUntil(async () => (await paramMod()).deviceName.toLowerCase().includes('poly'), 6000);
  await new Promise((r) => setTimeout(r, 1000));

  const rl = await remoteList();
  note(`[${label}] remote pages (${rl.pageCount}): ${JSON.stringify(rl.pageNames)}`);
  const pm = await paramMod();
  const f = pm.params.find((p) => p.id === 'F1FREQ');
  const f1 = f ? Math.abs(f.modulatedValue - f.value) : 0;
  note(`[${label}] F1FREQ divergence=${f1.toFixed(4)} (the untouched LFO route)`);
  return { pages: rl.pageNames, f1 };
}

const mtPath = findPreset('modtest');
const mzPath = findPreset('modzoo');
if (!mtPath || !mzPath) {
  console.log('Need both modtest.bwpreset and modzoo.bwpreset (E7 fixtures).');
  process.exit(2);
}
const mt = readFileSync(mtPath);
const mz = readFileSync(mzPath);

console.log('-- modulator objects found');
const mtMods = findModulators(mt);
const mzMods = findModulators(mz);
for (const m of mtMods) note(`  modtest[${m.index}] ${m.device.padEnd(12)} ${m.guid.slice(0, 8)} [${m.start}, ${m.end})`);
for (const m of mzMods) note(`  modzoo [${m.index}] ${m.device.padEnd(12)} ${m.guid.slice(0, 8)} [${m.start}, ${m.end})`);

const recipient = mtMods.find((m) => m.device === 'Expressions');
const donor = mzMods.find((m) => m.device === 'Classic LFO');
check('recipient (modtest Expressions) has exact bounds (is not the last item)',
  !!recipient && recipient.end > 0, recipient);
check('donor (modzoo Classic LFO) has exact bounds (is not the last item)',
  !!donor && donor.end > 0, donor);
if (!recipient || !donor || recipient.end < 0 || donor.end < 0) {
  console.log('cannot splice safely — aborting'); process.exit(1);
}

// Splice, renaming the donor's list index to the slot it now occupies.
const donorObj = Buffer.from(mz.subarray(donor.start, donor.end));
const idxAt = donorObj.indexOf(Buffer.from([0, 0, 0x02, 0xb9, 0x08, 0, 0, 0, 0x01]));
donorObj[idxAt + 9] = recipient.index.charCodeAt(0);
const spliced = Buffer.concat([
  mt.subarray(0, recipient.start), donorObj, mt.subarray(recipient.end),
]);
note(`spliced: replaced ${recipient.end - recipient.start}B '${recipient.device}' with ` +
     `${donorObj.length}B '${donor.device}' — file ${mt.length} -> ${spliced.length}`);
note('NB: meta referenced_modulator_ids still lists the OLD Expressions GUID ' +
     '(stale metadata; E4g showed it is not consulted) — this run also tests that.');

const outPath = join(tmpdir(), 'gn-e10c-splice-foreign.bwpreset');
writeFileSync(outPath, spliced);

/**
 * Phase C additionally repairs the meta's `referenced_modulator_ids`, which
 * still names the Expressions GUID that is no longer present.
 *
 * E4g found the equivalent DEVICE list (`referenced_device_ids`) is stale-safe —
 * ignored at load. But E7g's three GUID-swap results split exactly along this
 * line: ca8cc421 and dcacb71b both LOADED (broken, but present) and both are
 * listed in modtest's referenced_modulator_ids; 39f4b136 came back "Missing" and
 * is NOT listed. That is a strong hint the MODULATOR list is consulted even
 * though the device list is not — i.e. E4g's stale-safe rule does not transfer.
 * GUIDs appear there as 36-char ASCII, so the repair is length-preserving.
 */
const asciiGuid = (hex: string) =>
  `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
const oldRef = asciiGuid(recipient.guid);
const newRef = asciiGuid(donor.guid);
const refCount = spliced.toString('latin1').split(oldRef).length - 1;
note(`meta reference ${oldRef} -> ${newRef} (${refCount} ASCII occurrence(s))`);
const repaired = Buffer.from(
  spliced.toString('latin1').split(oldRef).join(newRef), 'latin1');
check('meta repair is length-preserving', repaired.length === spliced.length,
  { before: spliced.length, after: repaired.length });
const outPathC = join(tmpdir(), 'gn-e10c-typeswap-meta.bwpreset');
writeFileSync(outPathC, repaired);

await client.connect();
console.log('\nconnected\n');
const { trackA } = await ensureFixtureTracks();
await point('0', trackA, 0, MECH);

/**
 * Three variants, chosen to isolate WHICH operation the container rejects.
 * DELETE removes exactly [start,end); if the bounds were wrong the file would be
 * corrupt, so DELETE loading is also the proof that object boundaries are exact.
 * DUP inserts a well-formed object copied from the SAME file — it cannot be
 * malformed, so if it is rejected the problem is insertion itself, not the donor.
 */
const withIndex = (o: Buffer, ix: string) => {
  const c = Buffer.from(o);
  const a = c.indexOf(Buffer.from([0, 0, 0x02, 0xb9, 0x08, 0, 0, 0, 0x01]));
  c[a + 9] = ix.charCodeAt(0);
  return c;
};
const vibrato = mtMods.find((m) => m.device === 'Vibrato')!;
const variants: { label: string; buf: Buffer; expectLoad: boolean }[] = [
  { label: 'DELETE  (drop Expressions)',
    buf: Buffer.concat([mt.subarray(0, recipient.start), mt.subarray(recipient.end)]),
    expectLoad: true },
  { label: 'DUP     (same-file Vibrato copy)',
    buf: Buffer.concat([mt.subarray(0, recipient.start),
                        withIndex(mt.subarray(vibrato.start, vibrato.end), recipient.index),
                        mt.subarray(recipient.end)]),
    expectLoad: false },
  { label: 'FOREIGN (modzoo Classic LFO)', buf: spliced, expectLoad: false },
  { label: 'FOREIGN + meta ref repaired', buf: repaired, expectLoad: false },
];

console.log('-- baseline');
const a = await loadAndInspect(mtPath, 'baseline');
check('baseline has no Classic LFO page',
  !a.pages.some((p) => p.toLowerCase() === 'classic lfo'), a.pages);

const written: string[] = [outPath, outPathC];
for (const v of variants) {
  console.log(`\n-- ${v.label}`);
  const p = join(tmpdir(), `gn-e10c-${v.label.slice(0, 7).trim().toLowerCase()}.bwpreset`);
  writeFileSync(p, v.buf); written.push(p);
  const r = await loadAndInspect(p, v.label.split(' ')[0], v.expectLoad);
  const loaded = r.pages.length > 0;
  check(`${v.label}: ${v.expectLoad ? 'LOADS' : 'is REJECTED (whole preset fails to load)'}`,
    loaded === v.expectLoad, { loaded, pages: r.pages });
}

note('=> The container accepts object REMOVAL but rejects object INSERTION —');
note('   even of a well-formed copy taken from the same file. So GUID+payload');
note('   together do NOT solve type substitution: the blocker was never the');
note('   GUID/payload pairing, it is that a modulator cannot be ADDED at all.');
note('=> DELETE loading also proves the object bounds are byte-exact, and is a');
note('   real capability: modulators can be REMOVED from a template.');

console.log('\n-- cleanup');
check('gn-A devices removed', await clearDevices());
await point('0', trackA, 0, MECH);
await client.request('cursor.clearNotes', { cursor: '0' });
await client.request('cursor.setNotes', { cursor: '0', notes: [[0, 60, 100, 1]] });
for (const p of written) { try { unlinkSync(p); } catch { /* best effort */ } }

console.log(failureCount() === 0 ? '\nE10c: all checks passed' : `\nE10c: ${failureCount()} FAILURES`);
client.disconnect();
process.exit(failureCount() === 0 ? 0 : 1);
