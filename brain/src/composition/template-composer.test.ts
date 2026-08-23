import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { findModulatorList, listChains, listModulators, modulatorListOffsets } from '../bwmod/index.js';
import type { NativeCatalog } from '../native-catalog/catalog.js';
import {
  NATIVE_CATALOG_PATH, OWNED_LAYER_MANIFEST_PATH, OWNED_LAYER_TEMPLATE_PATH,
} from './assets.js';
import {
  TemplateCompositionError, composeOwnedTemplate, compositionModulatorSemantics,
  type CompositionEntryRequest, type OwnedTemplateManifest,
} from './template-composer.js';

const source = (): Buffer => readFileSync(OWNED_LAYER_TEMPLATE_PATH);
const manifest = (): OwnedTemplateManifest =>
  JSON.parse(readFileSync(OWNED_LAYER_MANIFEST_PATH, 'utf8')) as OwnedTemplateManifest;
const catalog = (): NativeCatalog =>
  JSON.parse(readFileSync(NATIVE_CATALOG_PATH, 'utf8')) as NativeCatalog;

const namesBySize: Readonly<Record<number, readonly string[]>> = {
  1: ['Sampler'],
  2: ['Polysynth', 'Sampler'],
  3: ['Polymer', 'Phase-4', 'Sampler'],
  4: ['Polymer', 'Organ', 'Polysynth', 'Sampler'],
};

for (const size of [1, 2, 3, 4] as const) {
  test(`5g-compose-${size}: keeps exact request order and never mutates the source`, () => {
    const input = source();
    const before = Buffer.from(input);
    const request = namesBySize[size]!.map((deviceName) => ({ deviceName }));
    const result = composeOwnedTemplate(input, manifest(), catalog(), request);

    assert.deepEqual(input, before);
    assert.deepEqual(result.requested.map((entry) => entry.deviceName), namesBySize[size]);
    assert.deepEqual(result.bindings.map((entry) => entry.deviceName), namesBySize[size]);
    assert.deepEqual(result.bindings.map((entry) => entry.entryIndex),
      Array.from({ length: size }, (_, index) => index));
    assert.equal(listChains(result.preset).length, size);
    assert.equal(modulatorListOffsets(result.preset).length, size + 1,
      'dropped entries and their nested modulator lists are absent');
    for (const binding of result.bindings) {
      const expected = Buffer.from(binding.deviceGuid.replaceAll('-', ''), 'hex');
      assert.deepEqual(
        result.preset.subarray(binding.deviceGuidOffset, binding.deviceGuidOffset + 16),
        expected,
      );
    }
  });
}

test('5g-binding: one named edit changes only its retained list', () => {
  const request: readonly CompositionEntryRequest[] = [
    {
      deviceName: 'Polysynth',
      modulators: [{
        kind: 'retarget',
        modulator: 'Vibrato',
        target: 'polysynth-filter-frequency',
        amount: 0.75,
      }],
    },
    { deviceName: 'Sampler' },
  ];
  const baseline = composeOwnedTemplate(source(), manifest(), catalog(), request.map((entry) => ({
    deviceName: entry.deviceName,
  })));
  const edited = composeOwnedTemplate(source(), manifest(), catalog(), request);

  assert.deepEqual(compositionModulatorSemantics(edited.preset, 0),
    compositionModulatorSemantics(baseline.preset, 0), 'outer list changed');
  assert.notDeepEqual(compositionModulatorSemantics(edited.preset, 1),
    compositionModulatorSemantics(baseline.preset, 1), 'bound list did not change');
  assert.deepEqual(compositionModulatorSemantics(edited.preset, 2),
    compositionModulatorSemantics(baseline.preset, 2), 'sibling list changed');
  assert.equal(compositionModulatorSemantics(edited.preset, 1)[0]?.routing?.target,
    'CONTENTS/F1FREQ');
});

test('5g-list-ids: separate nested lists can reuse instance ids', () => {
  const result = composeOwnedTemplate(source(), manifest(), catalog(), [
    {
      deviceName: 'Polysynth',
      modulators: [{
        kind: 'add', modulator: 'lfo', target: 'polysynth-filter-frequency', amount: 1,
      }],
    },
    {
      deviceName: 'Sampler',
      modulators: [{
        kind: 'add', modulator: 'lfo', target: 'sampler-amp-attack', amount: 1,
      }],
    },
  ]);

  assert.deepEqual(listModulators(result.preset, 1).map((modulator) => modulator.instanceId), [0, 1, 2]);
  assert.deepEqual(listModulators(result.preset, 2).map((modulator) => modulator.instanceId), [0, 1, 2]);
});

test('5g-editors: named composition expresses add, replace, retarget, amount, and delete', () => {
  const result = composeOwnedTemplate(source(), manifest(), catalog(), [{
    deviceName: 'Polysynth',
    modulators: [
      { kind: 'add', modulator: 'lfo', target: 'polysynth-filter-frequency', amount: 0.4 },
      { kind: 'amount', modulator: 'LFO', target: 'polysynth-filter-frequency', amount: 0.6 },
      {
        kind: 'replace', existing: 'Vibrato', modulator: 'random',
      },
      {
        kind: 'retarget', modulator: 'Random',
        target: 'polysynth-filter-frequency', amount: 0.7,
      },
      { kind: 'delete', modulator: 'Expressions' },
    ],
  }]);

  assert.deepEqual(compositionModulatorSemantics(result.preset, 0), [], 'outer list changed');
  const nested = compositionModulatorSemantics(result.preset, 1);
  assert.deepEqual(nested.map((modulator) => modulator.deviceName), ['Random', 'LFO']);
  assert.deepEqual(nested.map((modulator) => modulator.routing), [
    { target: 'CONTENTS/F1FREQ', amount: 0.7, rangeLo: -3, rangeHi: 1 },
    { target: 'CONTENTS/F1FREQ', amount: 0.6, rangeLo: -3, rangeHi: 1 },
  ]);
  assert.deepEqual(result.edits.map((edit) => edit.kind),
    ['add', 'amount', 'replace', 'retarget', 'delete']);
});

test('5g-witnesses: an intermediate route that conflicts with final state refuses', () => {
  assert.throws(
    () => composeOwnedTemplate(source(), manifest(), catalog(), [{
      deviceName: 'Polysynth',
      modulators: [
        {
          kind: 'replace', existing: 'Vibrato', modulator: 'random',
          target: 'polysynth-filter-resonance', amount: 0.5,
        },
        {
          kind: 'retarget', modulator: 'Random',
          target: 'polysynth-filter-frequency', amount: 0.7,
        },
      ],
    }]),
    (error: unknown) => compositionError(error, 'edit', /conflicts with the final route/),
  );
  assert.throws(
    () => composeOwnedTemplate(source(), manifest(), catalog(), [{
      deviceName: 'Polysynth',
      modulators: [
        { kind: 'add', modulator: 'lfo', target: 'polysynth-filter-frequency', amount: 0.5 },
        { kind: 'add', modulator: 'lfo', target: 'polysynth-filter-frequency', amount: 0.75 },
      ],
    }]),
    (error: unknown) => compositionError(error, 'edit', /conflicts with the final page count 2/),
  );
});

test('5g-refusals: invalid sizes, devices, asset facts, routes, and validation fail before output', () => {
  const one = [{ deviceName: 'Sampler' }] as const;
  assert.throws(
    () => composeOwnedTemplate(source(), manifest(), catalog(), []),
    (error: unknown) => compositionError(error, 'request', /at least one/),
  );
  assert.throws(
    () => composeOwnedTemplate(source(), manifest(), catalog(), [...one, ...one, ...one, ...one, ...one]),
    (error: unknown) => compositionError(error, 'request', /capacity/),
  );
  assert.throws(
    () => composeOwnedTemplate(source(), manifest(), catalog(), [{ deviceName: 'No Such Device' }]),
    (error: unknown) => compositionError(error, 'request', /unknown/),
  );

  const ambiguous = catalog();
  const sampler = ambiguous.devices.find((device) => device.name === 'Sampler')!;
  const duplicateCatalog = { ...ambiguous, devices: [...ambiguous.devices, { ...sampler }] };
  assert.throws(
    () => composeOwnedTemplate(source(), manifest(), duplicateCatalog, one),
    (error: unknown) => compositionError(error, 'request', /ambiguous/),
  );

  const drifted = source();
  drifted[100] = drifted[100]! ^ 1;
  assert.throws(
    () => composeOwnedTemplate(drifted, manifest(), catalog(), one),
    (error: unknown) => compositionError(error, 'asset', /SHA-256 drifted/),
  );

  const missingBinding = JSON.parse(JSON.stringify(manifest())) as OwnedTemplateManifest;
  (missingBinding.entries[3]!.modulatorList as { fieldOffset: number }).fieldOffset += 1;
  assert.throws(
    () => composeOwnedTemplate(source(), missingBinding, catalog(), one),
    (error: unknown) => compositionError(error, 'asset', /binding drifted/),
  );

  assert.throws(
    () => composeOwnedTemplate(source(), manifest(), catalog(), [{
      deviceName: 'Polysynth',
      modulators: [{ kind: 'add', modulator: 'lfo', target: 'sampler-amp-attack', amount: 1 }],
    }]),
    (error: unknown) => compositionError(error, 'edit', /unsupported/),
  );

  assert.throws(
    () => composeOwnedTemplate(source(), manifest(), catalog(), one, {
      beforeValidate(preset) {
        const list = findModulatorList(preset, 1);
        preset[list.listEnd] = 0xff;
      },
    }),
    (error: unknown) => compositionError(error, 'validate', /modulator list 1/),
  );
});

function compositionError(
  error: unknown,
  stage: TemplateCompositionError['stage'],
  pattern: RegExp,
): boolean {
  return error instanceof TemplateCompositionError
    && error.stage === stage
    && pattern.test(error.message);
}
