/**
 * E13 — the `bwmod` integration suite (BWMOD_DESIGN §6.2).
 *
 * Every case here is built by the LIBRARY (not by the Python tooling), written
 * to a temp `.bwpreset`, loaded into Bitwig with `device.insertFile`, and then
 * read back off the device's remote-control pages. The readback is the point:
 * `validate()` predicts a LOAD, but a wrong Ramona route path passes validate,
 * loads clean, and silently carries no modulation (E10b). The only proof that an
 * edit did what it claimed is the live page list plus an observed modulation
 * divergence.
 *
 * Reading the pages needs one piece of calibration: a device's OWN remote pages
 * come first and the modulator pages are appended after them — and a modulator
 * with no remote page (Expressions) contributes nothing. So each case names the
 * modulator-free `bare` fixture for its device; loading that once gives the
 * device's page count, and everything past it is modulator pages.
 *
 * Requires Bitwig 6.0.6 with the ghostnote controller (bridge on 127.0.0.1:8686).
 * Restores the gn-A/gn-B fixtures on the way out.
 *
 *   cd brain && npx tsx src/probes/e13-bwmod.ts
 *   GN_KEEP=1 npx tsx src/probes/e13-bwmod.ts     # leave the built files on disk
 */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { client, check, note, failureCount, pollUntil, point, ensureFixtureTracks } from './lib.js';
import {
  addModulator, deleteModulator, extractModulator, listModulators, loadDonor, modulatorBounds,
  replaceModulator, retarget, setAmount, stubValues, validate,
} from '../bwmod/index.js';
import { fixture } from '../bwmod/fixtures.js';

const MECH = 'trackThenSlot';
const OUT = mkdtempSync(join(tmpdir(), 'gn-e13-'));

/** Bitwig disambiguates duplicate modulator page names ("LFO 1"/"LFO 2", E11f). */
const basePageName = (name: string) => name.replace(/\s+\d+$/, '');

interface Case {
  key: string;
  desc: string;
  buf: Buffer;
  /** the modulator-free fixture for this device, used to count its own pages */
  bare: string;
  /** null = the outcome is what the case measures */
  expectLoad: boolean | null;
  /** the modulator pages expected after the device's own, in list order */
  expectModulatorPages?: string[];
  /** knob names that must carry live modulation */
  expectModulated?: string[];
  /** knob names that must NOT — the divergence control */
  expectNotModulated?: string[];
}

// ---------------------------------------------------------------------------
// Build every case up front, offline.
// ---------------------------------------------------------------------------

const modtest = fixture('Polysynth/modtest'); // Vibrato/0, Expressions/1, LFO/2
const oneLfo = fixture('Polysynth/mp_one_lfo');
const sampled = fixture('Sampler/gn_sampler_one_lfo');
const multisample = fixture('Sampler/gn_sampler_multi_one_lfo');

const POLY = 'Polysynth/mp_bare';
const SAMP = 'Sampler/gn_sampler_bare';
const MULTI = 'Sampler/gn_sampler_multi_bare';

const lfoIndex = listModulators(modtest).findIndex((m) => m.deviceName === 'LFO');
/** modtest's LFO is routed to CONTENTS/F1FREQ at a known-live amount — the compose donor. */
const routedLfo = extractModulator(modtest, lfoIndex);

const cases: Case[] = [
  {
    key: 'I-base-modtest',
    desc: 'modtest unmodified — the baseline: three modulators, two pages, F1FREQ live',
    buf: modtest,
    bare: POLY,
    expectLoad: true,
    // Expressions is Note-driven and contributes no remote page.
    expectModulatorPages: ['Vibrato', 'LFO'],
    expectModulated: ['Filt Freq'],
  },
  {
    key: 'I-add',
    desc: 'addModulator(mp_one_lfo, Random) — a second modulator, of a NEW type',
    buf: addModulator(oneLfo, loadDonor('random-poly')),
    bare: POLY,
    expectLoad: null,
    expectModulatorPages: ['LFO', 'Random'],
  },
  {
    key: 'I-replace',
    desc: 'replaceModulator(modtest, 1, Classic LFO) — type-swap at slot 1',
    buf: replaceModulator(modtest, 1, loadDonor('classiclfo-poly')),
    bare: POLY,
    expectLoad: null,
    expectModulatorPages: ['Vibrato', 'Classic LFO', 'LFO'],
  },
  {
    key: 'I-retarget',
    desc: `retarget(modtest, ${lfoIndex}, CONTENTS/F1RESO) — modulation must MOVE off Filt Freq`,
    buf: retarget(modtest, lfoIndex, 'CONTENTS/F1RESO'),
    bare: POLY,
    expectLoad: null,
    expectModulatorPages: ['Vibrato', 'LFO'],
    expectModulated: ['Reso'],
    expectNotModulated: ['Filt Freq'],
  },
  {
    key: 'I-delete',
    desc: `deleteModulator(modtest, ${lfoIndex}) — the LFO page and its modulation both go`,
    buf: deleteModulator(modtest, lfoIndex),
    bare: POLY,
    expectLoad: null,
    expectModulatorPages: ['Vibrato'],
    expectNotModulated: ['Filt Freq'],
  },
  {
    key: 'I-crosscat',
    desc: 'replace the Note-driven slot 1 with an LFO-category donor — category is not a gate',
    buf: replaceModulator(modtest, 1, loadDonor('lfo-poly')),
    bare: POLY,
    expectLoad: null,
    expectModulatorPages: ['Vibrato', 'LFO', 'LFO'],
  },
  {
    key: 'I-compose',
    desc: 'add + retarget + setAmount composed in one build — the composed route must be live',
    buf: (() => {
      const added = addModulator(oneLfo, routedLfo); // routed to F1FREQ by inheritance
      const moved = retarget(added, 1, 'CONTENTS/F1RESO');
      return setAmount(moved, 1, 48);
    })(),
    bare: POLY,
    expectLoad: null,
    expectModulatorPages: ['LFO', 'LFO'],
    expectModulated: ['Reso'],
    // mp_one_lfo's own LFO is unrouted, so nothing else may be modulating.
    expectNotModulated: ['Filt Freq'],
  },

  // --- Tier 2: the same library calls on presets that embed a sample (E12) ---
  {
    key: 'I-sampled-add',
    desc: 'addModulator on a sampled Sampler — count stubs relocated by the LFO footprint',
    buf: addModulator(sampled, loadDonor('lfo-sampler'), { target: 'CONTENTS/AMP_DECAY_TIME', amount: 3 }),
    bare: SAMP,
    expectLoad: null,
    expectModulatorPages: ['LFO', 'LFO'],
  },
  {
    key: 'I-sampled-newtype',
    desc: 'addModulator of a NEW type on a sampled Sampler — the wall that never existed',
    buf: addModulator(sampled, loadDonor('random-poly')),
    bare: SAMP,
    expectLoad: null,
    expectModulatorPages: ['LFO', 'Random'],
  },
  {
    key: 'I-sampled-delete',
    desc: 'deleteModulator on a sampled Sampler — stubs move back by the same footprint',
    buf: deleteModulator(sampled, 0),
    bare: SAMP,
    expectLoad: null,
    expectModulatorPages: [],
  },
  {
    key: 'I-multisample-add',
    desc: 'addModulator on a MULTISAMPLE Sampler — all four stubs must move',
    buf: addModulator(multisample, loadDonor('lfo-sampler'), { target: 'CONTENTS/AMP_DECAY_TIME', amount: 3 }),
    bare: MULTI,
    expectLoad: null,
    expectModulatorPages: ['LFO', 'LFO'],
  },

  // --- the negative control -------------------------------------------------
  {
    key: 'I-dup-neg',
    desc: 'a forced duplicate 0x1a1b — MUST be rejected (0 devices); the guard control',
    buf: (() => {
      // Built by hand precisely because the library refuses to produce it.
      const [start, end] = modulatorBounds(modtest, 1);
      const idAt = modtest.indexOf(Buffer.from([0x00, 0x00, 0x1a, 0x1b, 0x01]), start);
      if (idAt === -1 || idAt >= end) throw new Error('could not find slot 1 instance id');
      const out = Buffer.from(modtest);
      out.writeUInt8(listModulators(modtest)[0].instanceId, idAt + 5);
      return out;
    })(),
    bare: POLY,
    expectLoad: false,
  },
];

const paths = new Map<string, string>();
const write = (key: string, buf: Buffer) => {
  const path = join(OUT, `${key.replace(/[^\w.-]/g, '_')}.bwpreset`);
  writeFileSync(path, buf);
  paths.set(key, path);
  return path;
};

console.log('== offline gate: validate() before any load ==');
for (const c of cases) {
  const result = validate(c.buf);
  const shouldBeValid = c.expectLoad !== false;
  check(`${c.key} validate().ok === ${shouldBeValid}`, result.ok === shouldBeValid, result.problems.slice(0, 2));
  if (result.warnings.length) note(`   warnings: ${JSON.stringify(result.warnings)}`);
  write(c.key, c.buf);
}
for (const bare of new Set(cases.map((c) => c.bare))) write(`bare:${bare}`, fixture(bare));
note(`built ${cases.length} presets in ${OUT}`);
note(`stub values — sampled base=${JSON.stringify(stubValues(sampled))}, multi base=${JSON.stringify(stubValues(multisample))}`);

// ---------------------------------------------------------------------------
// Live half
// ---------------------------------------------------------------------------

const devList = async () =>
  (await client.request('device.list', { cursor: '0' })) as { count: number; devices: { index: number; name: string }[] };
type Remote = { index: number; exists: boolean; name?: string; value?: number; modulatedValue?: number };
const remoteList = async () =>
  (await client.request('remote.list')) as { remotes: Remote[]; pageNames: string[]; deviceName: string };

async function clearDevices() {
  let l = await devList();
  for (let guard = 0; guard < 8 && l.count > 0; guard++) {
    await client.request('device.delete', { cursor: '0', deviceIndex: l.devices[0].index });
    await pollUntil(async () => (await devList()).count < l.count, 4000);
    l = await devList();
  }
  return l.count === 0;
}

/** Knob names whose modulatedValue diverges from value — i.e. that carry live modulation. */
async function divergentKnobs(pageCount: number): Promise<string[]> {
  const hits = new Set<string>();
  for (let pg = 0; pg < pageCount; pg++) {
    await client.request('remote.selectPage', { index: pg });
    await new Promise((r) => setTimeout(r, 250));
    for (let sample = 0; sample < 6; sample++) {
      for (const rc of (await remoteList()).remotes) {
        if (!rc.exists || rc.value === undefined || rc.modulatedValue === undefined) continue;
        if (Math.abs(rc.modulatedValue - rc.value) > 1e-3) hits.add(rc.name ?? `#${rc.index}`);
      }
      await new Promise((r) => setTimeout(r, 150));
    }
  }
  return [...hits];
}

async function loadPreset(path: string, scanModulation: boolean) {
  for (let attempt = 0; attempt < 2; attempt++) {
    await clearDevices();
    await client.request('device.insertFile', { cursor: '0', path });
    if ((await pollUntil(async () => (await devList()).count >= 1, 12000)).ok) break;
    if (attempt === 1) return { loaded: false, pages: [] as string[], device: '', diverge: [] as string[] };
    await new Promise((r) => setTimeout(r, 1500));
  }
  await client.request('devcursor.selectAt', { deviceIndex: 0 });
  await new Promise((r) => setTimeout(r, 900));
  const rl = await remoteList();
  return {
    loaded: true,
    pages: rl.pageNames,
    device: rl.deviceName,
    diverge: scanModulation ? await divergentKnobs(rl.pageNames.length) : [],
  };
}

await client.connect();
console.log('\n== calibration: how many remote pages does each device own? ==');
const { trackA } = await ensureFixtureTracks();
await point('0', trackA, 0, MECH);

const devicePages = new Map<string, number>();
for (const bare of new Set(cases.map((c) => c.bare))) {
  const r = await loadPreset(paths.get(`bare:${bare}`) as string, false);
  check(`${bare} loads (calibration baseline)`, r.loaded);
  devicePages.set(bare, r.pages.length);
  note(`${bare}: ${r.device} owns ${r.pages.length} pages ${JSON.stringify(r.pages)}`);
}

console.log('\n== live: load + remote-page readback ==');
const results = new Map<string, Awaited<ReturnType<typeof loadPreset>>>();
for (const c of cases) {
  console.log(`\n-- ${c.key}: ${c.desc}`);
  const scan = (c.expectModulated?.length ?? 0) + (c.expectNotModulated?.length ?? 0) > 0;
  const r = await loadPreset(paths.get(c.key) as string, scan && c.expectLoad !== false);
  results.set(c.key, r);
  note(`${r.loaded ? 'LOADED' : 'REJECTED'}  device=${r.device}  pages=${JSON.stringify(r.pages)}`);

  if (c.expectLoad === false) {
    check(`${c.key} is REJECTED (the negative control)`, !r.loaded, { pages: r.pages });
    continue;
  }
  check(`${c.key} loads`, r.loaded, { pages: r.pages });
  if (!r.loaded) continue;

  if (c.expectModulatorPages) {
    const own = devicePages.get(c.bare) as number;
    const got = r.pages.slice(own).map(basePageName);
    check(
      `${c.key} modulator pages == ${JSON.stringify(c.expectModulatorPages)}`,
      got.length === c.expectModulatorPages.length && c.expectModulatorPages.every((p, i) => got[i] === p),
      { got, allPages: r.pages },
    );
  }
  if (scan) {
    note(`   modulation observed on: ${JSON.stringify(r.diverge)}`);
    for (const knob of c.expectModulated ?? []) {
      check(`${c.key} ${knob} carries live modulation`, r.diverge.includes(knob), { diverge: r.diverge });
    }
    for (const knob of c.expectNotModulated ?? []) {
      check(`${c.key} ${knob} carries NO modulation (control)`, !r.diverge.includes(knob), { diverge: r.diverge });
    }
  }
}

console.log('\n== RESULT MATRIX ==');
for (const c of cases) {
  const r = results.get(c.key);
  const own = devicePages.get(c.bare) as number;
  note(
    `${r?.loaded ? 'LOAD  ' : 'REJECT'}  ${c.key.padEnd(20)} ` +
      `mods=${JSON.stringify((r?.pages ?? []).slice(own).map(basePageName))}` +
      `${r?.diverge.length ? `  mod=${JSON.stringify(r.diverge)}` : ''}`,
  );
}

console.log('\n-- cleanup / fixture restore');
check('gn-A devices removed', await clearDevices());
await point('0', trackA, 0, MECH);
await client.request('cursor.clearNotes', { cursor: '0' });
await client.request('cursor.setNotes', { cursor: '0', notes: [[0, 60, 100, 1]] });
if (process.env.GN_KEEP) note(`kept built presets in ${OUT}`);

console.log(failureCount() === 0 ? '\nE13: ALL PASS' : `\nE13: ${failureCount()} FAILURES`);
client.disconnect();
process.exit(failureCount() === 0 ? 0 : 1);
