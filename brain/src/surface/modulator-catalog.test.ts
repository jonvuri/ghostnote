import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { z } from 'zod';

import { listDonorTypes, listHostModulatorInventory } from '../bwmod/index.js';
import { deviceStructureCompositionInputValidator } from './device-structure-composition.js';
import { modulatorAuthoringInputValidator } from './modulator-authoring.js';
import { runModulatorCatalog } from './modulator-catalog.js';
import { TOOLS } from './tools.js';

const PRESET = join(import.meta.dirname, '../../fixtures/Polysynth/mp_bare.bwpreset');
const SEMANTIC_SELECTION = {
  fingerprint: { algorithm: 'sha256' as const, sha256: '0'.repeat(64), byteLength: 1 },
  location: { kind: 'self' as const },
};

function keys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(keys);
  if (value === null || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) => [key, ...keys(child)]);
}

test('5m catalog records the complete host inventory and public standing', () => {
  const result = runModulatorCatalog() as {
    host: { product: string; version: string };
    supportedTypes: Array<{
      type: string;
      category: string;
      operations: string[];
      sampledPreset: string;
      witness: { mode: string; requirements: string[] };
    }>;
    inventory: Array<{ name: string; standing: string; why?: string }>;
    totals: { hostTypes: number; supportedTypes: number; excludedTypes: number };
  };
  assert.deepEqual(result.host, { product: 'Bitwig Studio', version: '6.0.6' });
  assert.deepEqual(result.totals, { hostTypes: 43, supportedTypes: 12, excludedTypes: 31 });
  assert.equal(result.inventory.length, 43);
  assert.equal(new Set(result.inventory.map((entry) => entry.name)).size, 43);
  assert.ok(result.inventory.filter((entry) => entry.standing === 'excluded')
    .every((entry) => (entry.why?.length ?? 0) > 40));
  const excluded = result.inventory.filter((entry) => entry.standing === 'excluded')
    .map((entry) => entry.name);
  assert.equal(excluded.length, 31);
  assert.ok(excluded.includes('Envelope Follower'));
  assert.ok(excluded.includes('Wavetable LFO'));
  assert.deepEqual(
    new Set(result.supportedTypes.map((type) => type.witness.mode)),
    new Set(['structural', 'free-running', 'note-driven']),
  );
  assert.ok(result.supportedTypes.every((type) => type.category.length > 0));
  assert.ok(result.supportedTypes.every((type) => type.witness.requirements.length > 0));
  assert.ok(!keys(result).some((key) => [
    'donorId', 'route', 'footprint', 'guid', 'offset', 'listIndex',
  ].includes(key)));
});

test('5m public write vocabularies come from manifest capabilities', () => {
  for (const type of listDonorTypes()) {
    const addInput = {
      trackId: 'track', presetPath: PRESET,
      ...SEMANTIC_SELECTION,
      operation: {
        kind: 'add', modulator: type.id,
        target: 'polysynth-filter-frequency', amount: 1,
      },
    };
    assert.equal(
      modulatorAuthoringInputValidator.safeParse(addInput).success,
      type.capabilities.includes('add'),
      `${type.id} add standing`,
    );
    assert.equal(deviceStructureCompositionInputValidator.safeParse({
      trackId: 'track',
      entries: [{
        deviceName: 'Polysynth',
        modulators: [{
          kind: 'add', modulator: type.id,
          target: 'polysynth-filter-frequency', amount: 1,
        }],
      }],
    }).success, true, `${type.id} composition vocabulary`);

    const replaceInput = {
      trackId: 'track', presetPath: PRESET,
      ...SEMANTIC_SELECTION,
      operation: { kind: 'replace', position: 0, modulator: type.id },
      pageChecks: [{ pageName: type.publicName, expectedCount: 1 }],
    };
    assert.equal(
      modulatorAuthoringInputValidator.safeParse(replaceInput).success,
      type.capabilities.includes('replace'),
      `${type.id} replace standing`,
    );
  }
  const excluded = listHostModulatorInventory().find((entry) => entry.supportedType === null)!;
  assert.equal(modulatorAuthoringInputValidator.safeParse({
    trackId: 'track', presetPath: PRESET,
    ...SEMANTIC_SELECTION,
    operation: {
      kind: 'add', modulator: excluded.name,
      target: 'polysynth-filter-frequency', amount: 1,
    },
  }).success, false);
});

test('5m public write descriptions defer the exact type list to the manifest', () => {
  const authoring = JSON.stringify(z.toJSONSchema(modulatorAuthoringInputValidator));
  const composition = JSON.stringify(z.toJSONSchema(deviceStructureCompositionInputValidator));
  assert.match(authoring, /Manifest-backed modulator type/);
  assert.match(composition, /Manifest-backed modulator type/);
  assert.doesNotMatch(authoring, /LFO, Random/);
  assert.doesNotMatch(composition, /LFO, Random/);
  const tool = TOOLS.find((candidate) => candidate.name === 'author_modulators');
  assert.match(tool?.description ?? '', /list_modulator_types/);
  assert.doesNotMatch(tool?.description ?? '', /LFO, Random/);
});
