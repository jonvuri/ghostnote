import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FIXTURE_DIR, fixture } from '../bwmod/fixtures.js';
import { FID, TYPE, patchString, readStr } from '../bwmod/format.js';
import { findFields } from '../bwmod/stream.js';
import {
  assertPresetFingerprint, fingerprintPreset, inspectPresetModulation, PresetInspectionError,
} from './preset-modulation-inspection.js';

const MATRIX = [
  {
    label: 'plain native', fixture: 'Polysynth/gn_mod_lfo-sampler',
    format: 'native', tier: 'tier-1', containerKind: null,
  },
  {
    label: 'native container', fixture: 'InstrumentLayer/gn_layer_4chain',
    format: 'native', tier: 'tier-1', containerKind: 'Instrument Layer',
  },
  {
    label: 'VST3', fixture: 'Zebra3/gn_zebra3vst_one_lfo',
    format: 'vst3', tier: 'tier-1', containerKind: null,
  },
  {
    label: 'CLAP', fixture: 'Zebra3/gn_zebra3clap_one_lfo',
    format: 'clap', tier: 'tier-1', containerKind: null,
  },
  {
    label: 'sample-less Sampler', fixture: 'Sampler/gn_sampler_no_sample',
    format: 'native', tier: 'tier-1', containerKind: null,
  },
  {
    label: 'sampled Sampler', fixture: 'Sampler/gn_sampler_one_lfo',
    format: 'native', tier: 'tier-2', containerKind: null,
  },
] as const;

test('5k-fixtures: every required host returns one complete typed inspection', () => {
  for (const item of MATRIX) {
    const result = inspectPresetModulation(fixture(item.fixture));
    assert.equal(result.supported, true, item.label);
    if (!result.supported) continue;
    assert.equal(result.host.format, item.format, item.label);
    assert.equal(result.host.tier, item.tier, item.label);
    assert.equal(result.containerKind, item.containerKind, item.label);
    assert.equal(result.complete, true, item.label);
    assert.equal(result.modulation.length, item.containerKind === null ? 1 : 5, item.label);
    assert.equal(result.fingerprint.algorithm, 'sha256', item.label);
    assert.match(result.fingerprint.sha256, /^[0-9a-f]{64}$/, item.label);
  }
});

test('5k-container: each semantic location binds one complete public inventory', () => {
  const result = inspectPresetModulation(fixture('InstrumentLayer/gn_layer_4chain'));
  assert.equal(result.supported, true);
  if (!result.supported) return;
  assert.deepEqual(result.entries, [
    { position: 0, name: 'CHAIN0', devices: [{ position: 0, name: 'Phase-4' }] },
    { position: 1, name: 'CHAIN1', devices: [{ position: 0, name: 'Polysynth' }] },
    { position: 2, name: 'CHAIN2', devices: [{ position: 0, name: 'Organ' }] },
    { position: 3, name: 'CHAIN3', devices: [{ position: 0, name: 'Sampler' }] },
  ]);
  assert.deepEqual(result.modulation.map((item) => item.location), [
    { kind: 'container', name: 'Instrument Layer' },
    {
      kind: 'entry', entry: { position: 0, name: 'CHAIN0' },
      devicePath: [{ position: 0, name: 'Phase-4' }],
    },
    {
      kind: 'entry', entry: { position: 1, name: 'CHAIN1' },
      devicePath: [{ position: 0, name: 'Polysynth' }],
    },
    {
      kind: 'entry', entry: { position: 2, name: 'CHAIN2' },
      devicePath: [{ position: 0, name: 'Organ' }],
    },
    {
      kind: 'entry', entry: { position: 3, name: 'CHAIN3' },
      devicePath: [{ position: 0, name: 'Sampler' }],
    },
  ]);
  assert.deepEqual(result.modulation[1]?.modulators[0]?.routes[0]?.target, {
    standing: 'resolved',
    parameter: { parameterId: 'CONTENTS/PITCH', parameterName: 'Pitch' },
  });
});

test('5k-duplicates: equal entry and device names stay distinct by ordered position', () => {
  let preset = fixture('InstrumentLayer/gn_layer_4chain');
  preset = replaceFirstStreamString(preset, FID.NAME, 'CHAIN1', 'CHAIN0');
  preset = replaceFirstStreamString(preset, FID.DEVICE_NAME, 'Polysynth', 'Phase-4');
  const result = inspectPresetModulation(preset);
  assert.equal(result.supported, true);
  if (!result.supported) return;
  assert.deepEqual(result.entries.slice(0, 2), [
    { position: 0, name: 'CHAIN0', devices: [{ position: 0, name: 'Phase-4' }] },
    { position: 1, name: 'CHAIN0', devices: [{ position: 0, name: 'Phase-4' }] },
  ]);
  assert.deepEqual(result.modulation.slice(1, 3).map((item) => item.location), [
    {
      kind: 'entry', entry: { position: 0, name: 'CHAIN0' },
      devicePath: [{ position: 0, name: 'Phase-4' }],
    },
    {
      kind: 'entry', entry: { position: 1, name: 'CHAIN0' },
      devicePath: [{ position: 0, name: 'Phase-4' }],
    },
  ]);
});

test('5k-refusal: an incomplete owner mapping is unsupported and not guessed', () => {
  const preset = fixture('InstrumentLayer/gn_layer_4chain');
  const damaged = Buffer.from(preset);
  const ownerValue = findFields(damaged, 0, damaged.length, FID.DEVICE_NAME, TYPE.STR)
    .find((at) => readStr(damaged, at) === 'Phase-4');
  assert.notEqual(ownerValue, undefined);
  damaged[ownerValue! - 1] = TYPE.BOOL;
  const result = inspectPresetModulation(damaged);
  assert.deepEqual(result, {
    supported: false,
    fingerprint: fingerprintPreset(damaged),
    why: 'The preset structure does not provide one complete, unambiguous semantic modulator mapping.',
  });
});

test('5k-public: results contain no binary selector or hidden route', () => {
  for (const item of MATRIX) {
    const encoded = JSON.stringify(inspectPresetModulation(fixture(item.fixture)));
    assert.doesNotMatch(
      encoded,
      /rawRoute|routeString|listIndex|objectId|footprint|stub|byteOffset|fieldOffset|guid/i,
      item.label,
    );
    assert.doesNotMatch(encoded, /ROOT_GENERIC_MODULE/, item.label);
  }
});

test('5k-targets: known public targets resolve and unknown routes stay explicit', () => {
  const known = inspectPresetModulation(fixture('Zebra3/gn_zebra3vst_one_lfo'));
  assert.equal(known.supported, true);
  if (known.supported) {
    assert.deepEqual(known.modulation[0]?.modulators[0]?.routes[0]?.target, {
      standing: 'resolved',
      parameter: { parameterId: 'CONTENTS/PID411', parameterName: 'Cutoff' },
    });
  }

  let unknown = fixture('Polysynth/gn_mod_lfo-sampler');
  unknown = replaceFirstStreamString(unknown, FID.ROUTING_TARGET, 'CONTENTS/F1FREQ', 'CONTENTS/UNKNOWN');
  const result = inspectPresetModulation(unknown);
  assert.equal(result.supported, true);
  if (result.supported) {
    assert.deepEqual(result.modulation[0]?.modulators[0]?.routes[0]?.target, {
      standing: 'unresolved',
    });
    assert.doesNotMatch(JSON.stringify(result), /CONTENTS\/UNKNOWN/);
  }
});

test('5k-fingerprint: later writes reject changed bytes', () => {
  const preset = fixture('Polysynth/mp_bare');
  const fingerprint = fingerprintPreset(preset);
  assert.doesNotThrow(() => assertPresetFingerprint(preset, fingerprint));
  const changed = Buffer.from(preset);
  changed[changed.length - 1] ^= 1;
  assert.throws(
    () => assertPresetFingerprint(changed, fingerprint),
    (error: unknown) => error instanceof PresetInspectionError
      && /changed after inspection/.test(error.message),
  );
});

test('5k-read-only: inspection does not change the fixture file or input bytes', () => {
  const path = join(FIXTURE_DIR, 'Sampler', 'gn_sampler_one_lfo.bwpreset');
  const before = readFileSync(path);
  const input = Buffer.from(before);
  inspectPresetModulation(input);
  assert.deepEqual(input, before);
  assert.deepEqual(readFileSync(path), before);
});

function replaceFirstStreamString(
  preset: Buffer,
  fieldId: number,
  from: string,
  to: string,
): Buffer {
  const valueStart = findFields(preset, 0, preset.length, fieldId, TYPE.STR)
    .find((at) => readStr(preset, at) === from);
  assert.notEqual(valueStart, undefined, `${from} is absent`);
  return patchString(preset, valueStart!, to);
}
