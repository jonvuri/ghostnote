/**
 * `bwmod` unit tests — the BWMOD_DESIGN §6.1 matrix, test ids kept verbatim so
 * the design doc and the suite stay greppable against each other.
 *
 *   npx tsx --test src/bwmod/*.test.ts
 *
 * These run offline against vendored fixtures. They are necessary but NOT
 * sufficient: a preset can pass every check here and still carry no modulation
 * (E10b). The live half of the definition of done is `src/probes/e13-bwmod.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  ASSET_DIR, SENTINEL, addModulator, deleteModulator, extractModulator, findModulatorList,
  identifyCuratedDonor, instanceIds, listChains, listDonorAssets, listModulators, loadDonor,
  modulatorBounds, modulatorListOffsets, nextFreeInstanceId, parseHeader, readMeta,
  readModulatorRefs, relocateStubs, repointF6, replaceModulator, retarget, setAmount, setF4,
  streamOffset, stubValues, validate, writeModulatorRefs,
} from './index.js';
import { allFixtures, fixture, normalizeVolatiles } from './fixtures.js';
import { INSTRUMENT_LAYER_SEED_PATH } from '../device-alternates/assets.js';

const ZIP_MAGIC = Buffer.from('PK\x03\x04', 'latin1');
const SAMPLED = 'Sampler/gn_sampler_one_lfo';
const MULTISAMPLE = 'Sampler/gn_sampler_multi_one_lfo';
const ZEBRA = 'Zebra3/gn_zebra3clap_one_lfo';

/** The sentinel must survive every edit intact, with the last object abutting it (E11h). */
function assertSentinelIntact(buf: Buffer, what: string) {
  const list = findModulatorList(buf);
  assert.deepEqual(
    buf.subarray(list.listEnd, list.listEnd + 8),
    SENTINEL,
    `${what}: the 0x1a46 list does not end with an intact sentinel`,
  );
  if (list.itemStarts.length > 0) {
    assert.equal(buf.readUInt32BE(list.listEnd - 4), 0, `${what}: last object's terminator does not abut the sentinel`);
  }
}

function assertValid(buf: Buffer, what: string, opts = {}) {
  const result = validate(buf, opts);
  assert.equal(result.ok, true, `${what}: ${result.problems.join(' | ')}`);
}

// ---------------------------------------------------------------------------
// U-parse
// ---------------------------------------------------------------------------

test('U-parse: listModulators reads modtest as [Vibrato/0, Expressions/1, LFO/2]', () => {
  const mods = listModulators(fixture('Polysynth/modtest'));
  assert.deepEqual(
    mods.map((m) => [m.deviceName, m.instanceId]),
    [['Vibrato', 0], ['Expressions', 1], ['LFO', 2]],
  );
  assert.deepEqual(mods.map((m) => m.name), ['0', '1', '2']);
  assert.deepEqual(mods.map((m) => m.category), ['LFO', 'Note-driven', 'LFO']);
  // Routing lives inside the modulator object (spec §4); Expressions routes nowhere.
  assert.equal(mods[0].routing?.target, 'CONTENTS/PITCH');
  assert.equal(mods[1].routing, null);
  assert.equal(mods[2].routing?.target, 'CONTENTS/F1FREQ');
  // The meta refs are the same GUIDs, in the same order.
  assert.deepEqual(readModulatorRefs(fixture('Polysynth/modtest')), mods.map((m) => m.guid));
});

test('U-parse: a CLAP host uses the deeper PID route form, and carries a plugin-state blob', () => {
  const buf = fixture(ZEBRA);
  assert.equal(listModulators(buf)[0].routing?.target, 'CONTENTS/ROOT_GENERIC_MODULE/PID411');
  assert.notEqual(parseHeader(buf).f6, 0);
});

test('U-parse: listChains resolves a layer container, last chain end unknown (E10d)', () => {
  assert.deepEqual(listChains(fixture('Polysynth/modtest')), [], 'a plain device has no CHAIN_LIST');

  const chains = listChains(fixture('InstrumentLayer/gn_layer_4chain'));
  assert.deepEqual(chains.map((c) => c.name), ['CHAIN0', 'CHAIN1', 'CHAIN2', 'CHAIN3']);
  // Chains nest — the fixture holds 14 0x018f objects for 4 top-level chains — so
  // only the top-level ones are reported.
  assert.ok(chains.every((c, i) => i === 0 || c.start > chains[i - 1].start));
  assert.equal(chains.at(-1)?.end, null, 'the last chain has no exact end (E10d)');
  assert.ok(chains.slice(0, -1).every((c) => c.end !== null));
});

test('U-seed: the bundled Instrument container seed is valid and has one entry', () => {
  const seed = readFileSync(INSTRUMENT_LAYER_SEED_PATH);
  assert.deepEqual(listChains(seed).map((item) => item.name), ['CHAIN1']);
  assertValid(seed, 'instrument device-alternate seed');
});

// ---------------------------------------------------------------------------
// U-roundtrip
// ---------------------------------------------------------------------------

test('U-roundtrip: every primitive is byte-identical when it re-writes what it read', () => {
  for (const name of allFixtures()) {
    const buf = fixture(name);
    assert.deepEqual(writeModulatorRefs(buf, readModulatorRefs(buf)), buf, `${name}: meta refs`);
    assert.deepEqual(setF4(buf, streamOffset(buf)), buf, `${name}: f4`);
    assert.deepEqual(repointF6(buf), buf, `${name}: f6`);
    assert.deepEqual(relocateStubs(buf, 0), buf, `${name}: stubs`);

    // Each modulator's extracted bytes put back at its own span reproduce the
    // file: the proof that the sentinel-snapped bounds are exact. A container
    // preset carries one list per nested device, so walk them all.
    for (let li = 0; li < modulatorListOffsets(buf).length; li++) {
      const list = findModulatorList(buf, li);
      for (let i = 0; i < list.itemStarts.length; i++) {
        const [start, end] = modulatorBounds(buf, i, list);
        const object = Buffer.from(buf.subarray(start, end));
        assert.deepEqual(
          Buffer.concat([buf.subarray(0, start), object, buf.subarray(end)]),
          buf,
          `${name}: list ${li} mod ${i}`,
        );
      }
    }
  }
});

test('U-roundtrip: every vendored fixture is a real Bitwig file and validates clean', () => {
  for (const name of allFixtures()) {
    assertValid(fixture(name), name);
  }
});

test('U-roundtrip: a container preset is read per nested device and refuses a blind edit', () => {
  const layer = fixture('InstrumentLayer/gn_layer_4chain');
  const lists = modulatorListOffsets(layer);
  assert.ok(lists.length > 1, 'the layer fixture should hold one MODULATORS list per nested device');

  // It is a perfectly valid Bitwig file — just outside single-device editing.
  const result = validate(layer);
  assert.equal(result.ok, true);
  assert.match(result.warnings.join(' '), /MODULATORS lists/);

  // Refusing beats guessing: editing "the first list" would silently rewrite
  // whichever nested device happened to serialize first.
  assert.throws(() => listModulators(layer), /pass a listIndex/);
  assert.throws(() => addModulator(layer, loadDonor('classiclfo-poly')), /pass a listIndex/);
  for (let li = 0; li < lists.length; li++) {
    assert.doesNotThrow(() => listModulators(layer, li));
  }
});

test('U-container-retarget: an explicit list changes only that device list', () => {
  const layer = fixture('InstrumentLayer/gn_layer_4chain');
  const target = 'CONTENTS/DEVICE_CHAIN/Chain/DEVICE_CHAIN/0:CONTENTS/F1FREQ';
  const semantic = (buf: Buffer, index: number) => listModulators(buf, index)
    .map(({ span: _span, ...modulator }) => modulator);
  const before = modulatorListOffsets(layer).map((_, index) => semantic(layer, index));
  const edited = retarget(layer, 0, target, 0, 1);
  const after = modulatorListOffsets(edited).map((_, index) => semantic(edited, index));

  assert.equal(after[1]?.[0]?.routing?.target, target);
  assert.deepEqual(after[0], before[0]);
  assert.deepEqual(after.slice(2), before.slice(2));
  const checked = validate(edited, { reference: layer, listIndex: 1 });
  assert.equal(checked.ok, true, checked.problems.join('; '));
  assert.match(checked.warnings.join(' '), /explicit list 1/);
});

// ---------------------------------------------------------------------------
// U-golden — the recipe must reproduce what Bitwig itself writes
// ---------------------------------------------------------------------------

const GOLDENS: [string, string, string, number | null][] = [
  // E10f: the Tier-1 reconstruction that proved the add recipe complete.
  ['Polysynth', 'Polysynth/mp_bare', 'Polysynth/mp_one_lfo', null],
  // E12c: the Tier-2 analogue — same recipe plus count-stub relocation.
  ['sampled', 'Sampler/gn_sampler_bare', 'Sampler/gn_sampler_one_lfo', 0x10],
  // E12c: a NEW type introduced into a sample-only template (the "wall" that never was).
  ['sampled NEW type', 'Sampler/gn_sampler_bare', 'Sampler/gn_sampler_one_random', 0x0d],
  // E12d: multisample, where 4 stubs must all move.
  ['multisample', 'Sampler/gn_sampler_multi_bare', 'Sampler/gn_sampler_multi_one_lfo', 0x10],
];

for (const [label, bareName, realName, footprint] of GOLDENS) {
  test(`U-golden (${label}): addModulator reconstructs ${realName} byte-identically`, () => {
    const bare = fixture(bareName);
    const real = fixture(realName);
    const donor = extractModulator(real, 0, footprint);
    const built = addModulator(bare, donor);

    assert.deepEqual(
      normalizeVolatiles(built),
      normalizeVolatiles(real),
      'differs from the real Bitwig-saved file beyond the embedded name and per-save 0x2ab8 GUIDs',
    );
    assert.deepEqual(stubValues(built), stubValues(real), 'count stubs do not match the real file');
    assertSentinelIntact(built, label);
    assertValid(built, label);
  });
}

// ---------------------------------------------------------------------------
// U-unique — the one proven load gate
// ---------------------------------------------------------------------------

test('U-unique: repeated add/replace assign distinct ids, each = nextFreeInstanceId', () => {
  const base = fixture('Polysynth/mp_one_lfo');
  const donor = loadDonor('random-poly');

  const firstId = nextFreeInstanceId(base);
  const once = addModulator(base, donor);
  const secondId = nextFreeInstanceId(once);
  const twice = addModulator(once, donor);
  assert.equal(firstId, 1);
  assert.equal(secondId, 2);
  assert.deepEqual(instanceIds(twice), [0, 1, 2]);
  assert.equal(new Set(instanceIds(twice)).size, 3);

  // Same-type duplicates are legitimate (E11f) — two Randoms, one repeated meta ref.
  const refs = readModulatorRefs(twice);
  assert.equal(refs.filter((r) => r === donor.guid).length, 2);
  assertValid(twice, 'double add');

  const replacedOnce = replaceModulator(fixture('Polysynth/modtest'), 1, donor);
  const replacedTwice = replaceModulator(replacedOnce, 1, loadDonor('classiclfo-poly'));
  assert.equal(new Set(instanceIds(replacedTwice)).size, 3);
  assert.notEqual(listModulators(replacedOnce)[1].instanceId, listModulators(replacedTwice)[1].instanceId);
  assertValid(replacedTwice, 'double replace');
});

test('U-unique: ids need not be contiguous, and an explicit collision is refused', () => {
  // E11a: sparse/permuted id sets load; uniqueness is the whole rule.
  const sparse = addModulator(fixture('Polysynth/mp_one_lfo'), loadDonor('random-poly'), undefined, { instanceId: 9 });
  assert.deepEqual(instanceIds(sparse), [0, 9]);
  assertValid(sparse, 'sparse ids');

  assert.throws(
    () => addModulator(fixture('Polysynth/mp_one_lfo'), loadDonor('random-poly'), undefined, { instanceId: 0 }),
    /already used/,
  );
});

// ---------------------------------------------------------------------------
// U-metasync / U-f4
// ---------------------------------------------------------------------------

test('U-metasync: add / replace / delete keep referenced_modulator_ids in sync', () => {
  const base = fixture('Polysynth/modtest');
  const donor = loadDonor('classiclfo-poly');
  const cases: [string, Buffer][] = [
    ['add', addModulator(base, donor)],
    ['replace', replaceModulator(base, 1, donor)],
    ['delete', deleteModulator(base, 1)],
  ];
  for (const [what, out] of cases) {
    const refs = readModulatorRefs(out);
    const guids = listModulators(out).map((m) => m.guid);
    assert.deepEqual(refs, guids, `${what}: refs are not the modulator GUIDs in order`);
    assertValid(out, what);
  }
  assert.equal(readModulatorRefs(cases[0][1]).length, 4);
  assert.equal(readModulatorRefs(cases[2][1]).length, 2);
  // A delete removes the ref at the modulator's own index, not the first guid match.
  assert.deepEqual(readModulatorRefs(cases[2][1]), [listModulators(base)[0].guid, listModulators(base)[2].guid]);
});

test('U-f4: a meta size change moves f4 by exactly the meta delta, and it still indexes 0x0a', () => {
  const base = fixture('Polysynth/modtest');
  const before = streamOffset(base);

  const added = addModulator(base, loadDonor('random-poly'));
  assert.equal(streamOffset(added) - before, 40, 'one 36-char GUID + its u32 length prefix');
  assert.equal(added.readUInt8(streamOffset(added)), 0x0a);

  const deleted = deleteModulator(base, 1);
  assert.equal(streamOffset(deleted) - before, -40);
  assert.equal(deleted.readUInt8(streamOffset(deleted)), 0x0a);

  // A replace swaps one 36-char GUID for another: META is the same size, f4 must not move.
  const replaced = replaceModulator(base, 1, loadDonor('classiclfo-poly'));
  assert.equal(streamOffset(replaced), before);
  assert.equal(replaced.readUInt8(streamOffset(replaced)), 0x0a);
});

// ---------------------------------------------------------------------------
// U-f6 — the embedded plugin-state blob pointer (E11i)
// ---------------------------------------------------------------------------

test('U-f6: a length-changing edit re-points f6 at the slid PK\\x03\\x04 blob', () => {
  const base = fixture(ZEBRA);
  const baseF6 = parseHeader(base).f6;
  assert.ok(baseF6 > 0);
  assert.deepEqual(base.subarray(baseF6, baseF6 + 4), ZIP_MAGIC, 'fixture f6 should already be sound');

  for (const [what, out] of [
    ['add', addModulator(base, loadDonor('random-poly'))],
    ['delete', deleteModulator(base, 0)],
    ['retarget longer', retarget(base, 0, 'CONTENTS/ROOT_GENERIC_MODULE/PID411_MUCH_LONGER_PATH')],
    ['retarget shorter', retarget(base, 0, 'CONTENTS/X')],
  ] as [string, Buffer][]) {
    const f6 = parseHeader(out).f6;
    assert.equal(f6, out.indexOf(ZIP_MAGIC, streamOffset(out)), `${what}: f6 is not the blob offset`);
    assert.deepEqual(out.subarray(f6, f6 + 4), ZIP_MAGIC, `${what}: f6 does not point at PK\\x03\\x04`);
    assert.notEqual(f6, 0);
    assertValid(out, `zebra ${what}`);
  }

  // The blob does NOT mirror modulator topology (E11i-corrected): only the pointer moves.
  const added = addModulator(base, loadDonor('random-poly'));
  assert.deepEqual(added.subarray(parseHeader(added).f6), base.subarray(baseF6), 'the blob bytes should be untouched');
});

test('U-f6: a preset with f6 == 0 keeps it at 0', () => {
  const out = addModulator(fixture('Polysynth/mp_one_lfo'), loadDonor('random-poly'));
  assert.equal(parseHeader(out).f6, 0);
});

// ---------------------------------------------------------------------------
// U-sentinel — the single most common way an edit silently rejects
// ---------------------------------------------------------------------------

test('U-sentinel: every editor leaves the list sentinel intact on every host', () => {
  for (const name of [
    'Polysynth/modtest', 'Polysynth/mp_one_lfo', SAMPLED, MULTISAMPLE, ZEBRA,
    'Sampler/gn_sampler_lfo_random',
  ]) {
    const base = fixture(name);
    const sampled = stubValues(base).length > 0;
    const donor = loadDonor(sampled ? 'lfo-sampler' : 'classiclfo-poly');
    // The multisample LFO is not one of the curated donors (different params), so
    // its footprint has to be told, not guessed — see the removed-footprint test.
    const removedFootprint = sampled ? 0x10 : undefined;
    assertSentinelIntact(addModulator(base, donor), `${name} add`);
    assertSentinelIntact(replaceModulator(base, 0, donor, { removedFootprint }), `${name} replace`);
    assertSentinelIntact(deleteModulator(base, 0, { removedFootprint }), `${name} delete`);
    const routed = listModulators(base).findIndex((m) => m.routes.length > 0);
    if (routed !== -1) assertSentinelIntact(retarget(base, routed, 'CONTENTS/X'), `${name} retarget`);
  }
});

test('U-sentinel: a 2-byte-late object bound is caught, not silently written (the E11i bug)', () => {
  // Reproduce exactly what the old diff-derived extractor did: end the object 2
  // bytes into the sentinel, leaving 00 03 00 00 00 00 00 00 behind it.
  const base = fixture('Polysynth/mp_one_lfo');
  const list = findModulatorList(base);
  const corrupted = Buffer.concat([
    base.subarray(0, list.listEnd + 2),
    base.subarray(list.listEnd + 4),
  ]);
  const result = validate(corrupted);
  assert.equal(result.ok, false);
  assert.match(result.problems.join(' '), /sentinel|MODULATORS/i);
});

// ---------------------------------------------------------------------------
// U-stub-relocate — Tier 2 (E12)
// ---------------------------------------------------------------------------

test('U-stub-relocate: every stub in every count list moves by (inserted - removed) footprint', () => {
  for (const name of [SAMPLED, MULTISAMPLE]) {
    const base = fixture(name);
    const before = stubValues(base);
    assert.ok(before.length >= 2, `${name}: expected count stubs`);

    // Both fixtures hold an LFO at slot 0; the single-sample one IS the curated
    // donor, the multisample one only shares its type, so state the footprint.
    const opts = { removedFootprint: 0x10 };
    const cases: [string, Buffer, number][] = [
      ['add same type', addModulator(base, loadDonor('lfo-sampler')), 0x10],
      ['add NEW type', addModulator(base, loadDonor('random-poly')), 0x0b],
      ['replace with NEW type', replaceModulator(base, 0, loadDonor('random-sampler'), opts), 0x0d - 0x10],
      ['delete', deleteModulator(base, 0, opts), -0x10],
    ];
    for (const [what, out, delta] of cases) {
      assert.deepEqual(stubValues(out), before.map((v) => v + delta), `${name} ${what}`);
      assertValid(out, `${name} ${what}`, { reference: base, stubDelta: delta });
      assertSentinelIntact(out, `${name} ${what}`);
    }
  }
});

test('U-stub-relocate: the multisample fixture really does carry 4 stubs across both lists', () => {
  assert.equal(stubValues(fixture(MULTISAMPLE)).length, 4);
  assert.equal(stubValues(fixture(SAMPLED)).length, 2);
  assert.equal(stubValues(fixture('Sampler/gn_sampler_no_sample')).length, 0, 'sample-less Sampler is plain Tier 1');
});

test('U-stub-relocate: retarget and setAmount add no objects, so they must not touch the stubs', () => {
  const base = fixture(SAMPLED);
  assert.deepEqual(stubValues(retarget(base, 0, 'CONTENTS/AMP_DECAY_TIME')), stubValues(base));
  assert.deepEqual(stubValues(retarget(base, 0, 'CONTENTS/A_MUCH_LONGER_PARAMETER_NAME')), stubValues(base));
  assert.deepEqual(stubValues(setAmount(base, 0, 0)), stubValues(base));
});

test('U-stub-relocate: a Tier-1 preset needs no footprint at all', () => {
  const unmeasured = loadDonor('lfo-poly');
  assert.equal(unmeasured.footprint, null);
  assertValid(addModulator(fixture('Polysynth/mp_bare'), unmeasured), 'unmeasured donor on Tier 1');
});

test('U-stub-relocate: an unmeasured footprint is refused on a sampled preset, never guessed', () => {
  assert.throws(
    () => addModulator(fixture(SAMPLED), loadDonor('lfo-poly')),
    /no measured footprint/,
    'a guessed footprint rejects the preset silently — it must fail loudly instead',
  );
});

test('U-stub-relocate: the removed footprint comes from an exact donor match, else it is demanded', () => {
  const base = fixture(SAMPLED);
  assert.equal(identifyCuratedDonor(base.subarray(...modulatorBounds(base, 0)))?.id, 'lfo-sampler');

  // A donor this library planted and then retargeted/re-amounted still matches:
  // those edits provably add no objects, so the footprint is unchanged (E12e).
  const planted = addModulator(base, loadDonor('random-sampler'), { target: 'CONTENTS/AMP_DECAY_TIME', amount: 0.75 });
  assert.equal(identifyCuratedDonor(planted.subarray(...modulatorBounds(planted, 1)))?.id, 'random-sampler');
  assert.deepEqual(stubValues(deleteModulator(planted, 1)), stubValues(base), 'plant then delete should be a round trip');

  // A modulator that resembles no curated donor is NOT guessed at.
  const multi = fixture(MULTISAMPLE);
  assert.equal(identifyCuratedDonor(multi.subarray(...modulatorBounds(multi, 0))), null, 'same type, different params');
  assert.throws(() => deleteModulator(multi, 0), /removedFootprint/);
  assert.deepEqual(
    stubValues(deleteModulator(multi, 0, { removedFootprint: 0x10 })),
    stubValues(multi).map((v) => v - 0x10),
  );
});

test('U-stub-relocate: curated footprints agree with the fixtures they were measured on', () => {
  // An offline cross-check of the two footprints that have a bare/one fixture
  // pair: the stub delta a real Bitwig save produced IS the donor's footprint.
  const bareSingle = stubValues(fixture('Sampler/gn_sampler_bare'));
  assert.deepEqual(stubValues(fixture('Sampler/gn_sampler_one_lfo')), bareSingle.map((v) => v + 0x10));
  assert.deepEqual(stubValues(fixture('Sampler/gn_sampler_one_random')), bareSingle.map((v) => v + 0x0d));
  // Both at once — E12f's recombination arithmetic (base + LFO + Random).
  assert.deepEqual(stubValues(fixture('Sampler/gn_sampler_lfo_random')), bareSingle.map((v) => v + 0x10 + 0x0d));
  assert.deepEqual(
    stubValues(fixture(MULTISAMPLE)),
    stubValues(fixture('Sampler/gn_sampler_multi_bare')).map((v) => v + 0x10),
  );

  const byId = new Map(listDonorAssets().map((d) => [d.id, d]));
  assert.equal(byId.get('lfo-sampler')?.footprint, 0x10);
  assert.equal(byId.get('random-sampler')?.footprint, 0x0d);
  assert.equal(byId.get('random-poly')?.footprint, 0x0b);
});

// ---------------------------------------------------------------------------
// U-retarget-len
// ---------------------------------------------------------------------------

test('U-retarget-len: any-length retarget is a stream-only edit that leaves f4 alone', () => {
  const base = fixture('Polysynth/modtest');
  const before = streamOffset(base);
  const original = listModulators(base)[2].routing?.target as string;

  for (const target of ['CONTENTS/F1RESO', 'X', 'CONTENTS/A_VERY_MUCH_LONGER_RAMONA_PATH_THAN_BEFORE']) {
    const out = retarget(base, 2, target);
    assert.equal(listModulators(out)[2].routing?.target, target);
    assert.equal(out.length - base.length, target.length - original.length, 'length delta should be exactly the string delta');
    assert.equal(streamOffset(out), before, 'retarget must not move f4');
    assertValid(out, `retarget ${target}`);
    // Sibling modulators are untouched.
    assert.equal(listModulators(out)[0].routing?.target, 'CONTENTS/PITCH');
  }

  assert.throws(() => retarget(base, 1, 'CONTENTS/X'), /has 0 route/, 'Expressions routes nowhere');
  assert.throws(() => retarget(base, 2, ''), /empty route target/);
});

test('U-setAmount: the slot-bank lever writes a fixed-width f64 and moves nothing', () => {
  const base = fixture('Polysynth/modtest');
  const out = setAmount(base, 2, 0);
  assert.equal(out.length, base.length);
  assert.equal(streamOffset(out), streamOffset(base));
  assert.equal(listModulators(out)[2].routing?.amount, 0);
  assert.equal(listModulators(setAmount(base, 2, -0.25))[2].routing?.amount, -0.25);
  assertValid(out, 'setAmount 0');
});

test('addModulator can attach a route at build time (the composed edit)', () => {
  const base = fixture(SAMPLED);
  const out = addModulator(base, loadDonor('lfo-sampler'), { target: 'CONTENTS/AMP_DECAY_TIME', amount: 0.5 });
  const added = listModulators(out)[1];
  assert.equal(added.routing?.target, 'CONTENTS/AMP_DECAY_TIME');
  assert.equal(added.routing?.amount, 0.5);
  assert.equal(added.instanceId, 1);
  assert.deepEqual(stubValues(out), stubValues(base).map((v) => v + 0x10));
  assertValid(out, 'add with routing');

  // A route cannot be conjured where the donor has none (E10) — refuse, don't invent.
  assert.throws(
    () => addModulator(fixture('Polysynth/mp_bare'), loadDonor('random-poly'), { target: 'CONTENTS/F1FREQ', amount: 1 }),
    /no 0x0e3d modulation entry/,
  );
});

// ---------------------------------------------------------------------------
// U-immutable
// ---------------------------------------------------------------------------

test('U-immutable: no editor mutates its input', () => {
  for (const name of ['Polysynth/modtest', SAMPLED, ZEBRA]) {
    const base = fixture(name);
    const pristine = Buffer.from(base);
    const sampled = stubValues(base).length > 0;
    const donor = loadDonor(sampled ? 'lfo-sampler' : 'classiclfo-poly');

    addModulator(base, donor);
    replaceModulator(base, 0, donor);
    deleteModulator(base, 0);
    retarget(base, 0, 'CONTENTS/SOMETHING_ELSE_ENTIRELY');
    setAmount(base, 0, 0.125);
    validate(base);

    assert.deepEqual(base, pristine, `${name}: an editor mutated its input buffer`);
  }
});

test('U-immutable: donor assets are not mutated by being planted', () => {
  const donor = loadDonor('classiclfo-poly');
  const pristine = Buffer.from(donor.bytes);
  addModulator(fixture('Polysynth/mp_bare'), donor);
  addModulator(fixture('Polysynth/modtest'), donor);
  assert.deepEqual(donor.bytes, pristine);
});

// ---------------------------------------------------------------------------
// U-validate-neg
// ---------------------------------------------------------------------------

test('U-validate-neg: a duplicate 0x1a1b is caught and the collision is named', () => {
  // The E10f M1 control: modtest with slot 1's instance id flipped 1 -> 0.
  const base = fixture('Polysynth/modtest');
  const [start, end] = modulatorBounds(base, 1);
  const idAt = base.indexOf(Buffer.from([0x00, 0x00, 0x1a, 0x1b, 0x01]), start);
  assert.ok(idAt !== -1 && idAt < end);
  const dup = Buffer.from(base);
  dup.writeUInt8(0, idAt + 5);

  const result = validate(dup);
  assert.equal(result.ok, false);
  assert.match(result.problems.join(' '), /duplicate 0x1a1b instance id 0/);
  assert.match(result.problems.join(' '), /Vibrato/);
  assert.match(result.problems.join(' '), /Expressions/);
});

test('U-validate-neg2: a dropped meta ref is caught', () => {
  const base = fixture('Polysynth/modtest');
  const broken = writeModulatorRefs(base, readModulatorRefs(base).slice(1));
  const result = validate(broken);
  assert.equal(result.ok, false);
  assert.match(result.problems.join(' '), /referenced_modulator_ids/);

  const wrongGuid = writeModulatorRefs(base, ['00000000-0000-0000-0000-000000000000', ...readModulatorRefs(base).slice(1)]);
  assert.equal(validate(wrongGuid).ok, false);
});

test('U-validate-neg3: a stale f6 is caught (the E11i slide guard)', () => {
  const base = fixture(ZEBRA);
  // Grow the stream without re-pointing f6 — exactly what a naive editor does.
  const list = findModulatorList(base);
  const stale = Buffer.concat([base.subarray(0, list.listEnd), Buffer.alloc(0), base.subarray(list.listEnd)]);
  const grown = Buffer.concat([stale.subarray(0, list.listEnd), fixture(ZEBRA).subarray(list.listEnd, list.listEnd + 8), stale.subarray(list.listEnd)]);
  const result = validate(grown);
  assert.equal(result.ok, false);
  assert.match(result.problems.join(' '), /f6 is stale|sentinel|MODULATORS/i);
});

test('U-validate-neg4: an empty route target is a warning, not a rejection', () => {
  const base = fixture('Polysynth/modtest');
  const slotAt = base.indexOf(Buffer.from([0x00, 0x00, 0x0e, 0x3d, 0x08]));
  const blanked = Buffer.concat([
    base.subarray(0, slotAt + 5),
    Buffer.from([0, 0, 0, 0]),
    base.subarray(slotAt + 9 + base.readUInt32BE(slotAt + 5)),
  ]);
  const result = validate(blanked);
  assert.equal(result.ok, true, 'an empty target loads fine — it just does nothing');
  assert.match(result.warnings.join(' '), /empty target/);
});

test('U-validate-neg5: a stale count stub is caught when a reference is supplied', () => {
  const base = fixture(SAMPLED);
  const added = addModulator(base, loadDonor('lfo-sampler'));
  // Right recipe, wrong delta — the E11d mistake of using one type's footprint for another.
  assert.equal(validate(added, { reference: base, stubDelta: 0x0b }).ok, false);
  assert.equal(validate(added, { reference: base, stubDelta: 0x10 }).ok, true);

  const halfDone = relocateStubs(added, -0x10); // undo, leaving every stub stale
  assert.equal(validate(halfDone, { reference: base, stubDelta: 0x10 }).ok, false);
});

// ---------------------------------------------------------------------------
// donor assets
// ---------------------------------------------------------------------------

test('donor assets: every curated donor loads, matches its index entry, and is transplantable', () => {
  const assets = listDonorAssets();
  assert.ok(assets.length >= 5);
  for (const asset of assets) {
    const donor = loadDonor(asset.id);
    assert.equal(donor.guid, asset.guid, `${asset.id}: index GUID disagrees with the object`);
    assert.equal(donor.deviceName, asset.deviceName);
    assert.equal(donor.category, asset.category);
    assert.deepEqual(donor.bytes, readFileSync(join(ASSET_DIR, asset.file)));
    assert.equal(donor.bytes.readUInt32BE(0), 0x06c9, `${asset.id}: not a modulator object`);

    // Plant it in a Tier-1 template and make sure the result is loadable-shaped.
    const out = addModulator(fixture('Polysynth/mp_bare'), donor);
    assertValid(out, `plant ${asset.id}`);
    assert.equal(listModulators(out)[0].deviceName, asset.deviceName);
    assert.equal(listModulators(out)[0].instanceId, 0);
  }
});

test('donor assets: cross-category transplant is allowed — category is not a gate (E10f)', () => {
  // modtest slot 1 is a Note-driven Expressions; replace it with an LFO-category donor.
  const base = fixture('Polysynth/modtest');
  assert.equal(listModulators(base)[1].category, 'Note-driven');
  const out = replaceModulator(base, 1, loadDonor('classiclfo-poly'));
  assert.equal(listModulators(out)[1].category, 'LFO');
  assert.equal(listModulators(out)[1].deviceName, 'Classic LFO');
  assertValid(out, 'cross-category replace');
});

test('readMeta exposes the keys the recipe depends on', () => {
  const meta = readMeta(fixture('Polysynth/modtest'));
  assert.equal(meta.get('device_name'), 'Polysynth');
  assert.deepEqual(meta.get('referenced_modulator_ids'), readModulatorRefs(fixture('Polysynth/modtest')));
  assert.equal(typeof meta.get('revision_id'), 'string');
});
