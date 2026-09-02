import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  listChains, listModulators, modulatorListOffsets, readMeta, stubValues, validate,
} from '../bwmod/index.js';
import {
  GENERAL_CONTAINER_SEED_MANIFEST_PATH,
  OWNED_FX_LAYER_MANIFEST_PATH, OWNED_FX_LAYER_TEMPLATE_PATH,
} from './assets.js';
import {
  composeExistingDeviceWrapperPreset, composeGeneralDeviceContainerPreset,
  type GeneralDeviceContainerKind,
} from './existing-device-wrapper.js';
import { fiveEntryLayerSeedPreset } from './layer-seeds.js';

interface LateBoundManifest {
  readonly schemaVersion: number;
  readonly id: string;
  readonly assetPath: string;
  readonly sha256: string;
  readonly byteLength: number;
  readonly authoring: {
    readonly bitwigVersion: string;
    readonly creator: string;
    readonly sourceEvidence: string;
    readonly origin: string;
  };
  readonly container: {
    readonly name: string;
    readonly guid: string;
    readonly outerModulatorList: { readonly sourceIndex: number; readonly fieldOffset: number };
  };
  readonly targetEntry: {
    readonly position: number;
    readonly serializedName: string;
    readonly liveName: string;
    readonly devicePosition: number;
    readonly initiallyEmpty: boolean;
  };
  readonly externalReferences: {
    readonly packagedFileIds: readonly string[];
    readonly sampledPresetReferenceStubs: number;
  };
}

interface GeneralContainerSeedManifest {
  readonly schemaVersion: number;
  readonly authoring: {
    readonly bitwigVersion: string;
    readonly creator: string;
    readonly origin: string;
    readonly sourceEvidence: string;
  };
  readonly assets: readonly {
    readonly id: string;
    readonly libraryName: string;
    readonly containerName: GeneralDeviceContainerKind;
    readonly containerGuid: string;
    readonly containerGuidOffset: number;
    readonly sha256: string;
    readonly byteLength: number;
    readonly outerModulatorListOffset: number;
    readonly maximumEntries: number;
    readonly chains: readonly {
      readonly index: number;
      readonly name: string;
      readonly start: number;
      readonly end: number | null;
    }[];
    readonly sampleReferenceStubs: number;
  }[];
}

test('5o-asset: the human-authored empty FX Layer seed matches its manifest', () => {
  const preset = readFileSync(OWNED_FX_LAYER_TEMPLATE_PATH);
  const manifest = JSON.parse(
    readFileSync(OWNED_FX_LAYER_MANIFEST_PATH, 'utf8'),
  ) as LateBoundManifest;
  const meta = readMeta(preset);

  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.id, 'fx-layer-late-bound');
  assert.equal(manifest.assetPath, 'fixtures/FXLayer/gn_latebound_fx_layer.bwpreset');
  assert.equal(createHash('sha256').update(preset).digest('hex'), manifest.sha256);
  assert.equal(preset.length, manifest.byteLength);
  assert.deepEqual(manifest.authoring, {
    bitwigVersion: '6.0.6', creator: 'jrajav', sourceEvidence: 'E90', origin: 'human-authored',
  });
  assert.equal(meta.get('application_version_name'), manifest.authoring.bitwigVersion);
  assert.equal(meta.get('creator'), manifest.authoring.creator);
  assert.equal(meta.get('device_name'), manifest.container.name);
  assert.equal(meta.get('device_id'), manifest.container.guid);
  assert.deepEqual(modulatorListOffsets(preset), [manifest.container.outerModulatorList.fieldOffset]);
  assert.deepEqual(listModulators(preset, manifest.container.outerModulatorList.sourceIndex), []);
  assert.deepEqual(listChains(preset).map((chain) => [chain.index, chain.name]), [[0, 'CHAIN0']]);
  assert.deepEqual(manifest.targetEntry, {
    position: 0,
    serializedName: 'CHAIN0',
    liveName: 'Layer 1',
    devicePosition: 0,
    initiallyEmpty: true,
  });
  assert.deepEqual(meta.get('referenced_packaged_file_ids'),
    manifest.externalReferences.packagedFileIds);
  assert.equal(stubValues(preset).length,
    manifest.externalReferences.sampledPresetReferenceStubs);
  assert.equal(validate(preset, { listIndex: 0 }).ok, true);
});

test('5r-assets: both supported human-saved seeds match their exact manifest facts', () => {
  const manifest = JSON.parse(
    readFileSync(GENERAL_CONTAINER_SEED_MANIFEST_PATH, 'utf8'),
  ) as GeneralContainerSeedManifest;
  assert.equal(manifest.schemaVersion, 1);
  assert.deepEqual(manifest.authoring, {
    bitwigVersion: '6.0.6', creator: 'jrajav', origin: 'human-authored',
    sourceEvidence: 'phase-5-session-5r',
  });

  const sources = new Map<GeneralDeviceContainerKind, Buffer>([
    ['Instrument Layer', fiveEntryLayerSeedPreset('Instrument Layer')],
    ['FX Layer', fiveEntryLayerSeedPreset('FX Layer')],
  ]);
  assert.deepEqual(manifest.assets.map((asset) => asset.containerName), [...sources.keys()]);
  for (const asset of manifest.assets) {
    const preset = sources.get(asset.containerName)!;
    const meta = readMeta(preset);
    const guid = Buffer.from(asset.containerGuid.replaceAll('-', ''), 'hex');
    assert.equal(createHash('sha256').update(preset).digest('hex'), asset.sha256, asset.id);
    assert.equal(preset.length, asset.byteLength, asset.id);
    assert.deepEqual(
      preset.subarray(asset.containerGuidOffset, asset.containerGuidOffset + guid.length),
      guid,
      asset.id,
    );
    assert.equal(meta.get('application_version_name'), manifest.authoring.bitwigVersion, asset.id);
    assert.equal(meta.get('creator'), manifest.authoring.creator, asset.id);
    assert.equal(meta.get('device_name'), asset.containerName, asset.id);
    assert.equal(meta.get('device_id'), asset.containerGuid, asset.id);
    assert.deepEqual(modulatorListOffsets(preset), [asset.outerModulatorListOffset], asset.id);
    assert.deepEqual(listModulators(preset, 0), [], asset.id);
    assert.deepEqual(listChains(preset), asset.chains, asset.id);
    assert.equal(asset.maximumEntries, 5, asset.id);
    assert.equal(stubValues(preset).length, asset.sampleReferenceStubs, asset.id);
    assert.equal(validate(preset, { listIndex: 0 }).ok, true, asset.id);
  }
});

for (const kind of ['Instrument Layer', 'FX Layer'] as const) {
  for (let width = 1; width <= 5; width++) {
    test(`5r-${kind}-width-${width}: retains one exact complete layer suffix`, async () => {
      const result = await composeGeneralDeviceContainerPreset(kind, [], { entryCount: width });
      const first = 5 - width;
      assert.deepEqual(
        listChains(result.preset).map((entry) => entry.name),
        Array.from({ length: width }, (_, index) => `CHAIN${first + index}`),
      );
      assert.deepEqual(listModulators(result.preset, 0), []);
      assert.equal(validate(result.preset, { listIndex: 0 }).ok, true);
    });
  }
}

test('5r-layer-routes: retained suffixes use normalized live route positions', async () => {
  const target = { parameterId: 'CONTENTS/F1FREQ', parameterName: 'Filter Frequency' };
  for (const kind of ['Instrument Layer', 'FX Layer'] as const) {
    const result = await composeGeneralDeviceContainerPreset(kind, [
      { entryIndex: 0, deviceIndex: 0, modulator: 'lfo', target, amount: 0.5 },
      { entryIndex: 1, deviceIndex: 2, modulator: 'lfo', target, amount: 1 },
    ], { entryCount: 2 });
    assert.deepEqual(result.routes.map((route) => route.route), [
      'CONTENTS/CHAIN_LIST/CHAIN0/DEVICE_CHAIN/0:CONTENTS/F1FREQ',
      'CONTENTS/CHAIN_LIST/CHAIN1/DEVICE_CHAIN/2:CONTENTS/F1FREQ',
    ], kind);
    assert.deepEqual(
      listModulators(result.preset, 0).flatMap((modulator) =>
        modulator.routes.map((route) => route.target)),
      result.routes.map((route) => route.route),
      kind,
    );
  }
});

test('5s-wrapper-grid: mixed donor types occupy compact visible slots', async () => {
  const result = await composeExistingDeviceWrapperPreset([
    {
      modulator: 'lfo',
      target: { parameterId: 'PID5', parameterName: 'Delay Rate' },
      amount: 0.36,
    },
    {
      modulator: 'random',
      target: { parameterId: 'PIDc', parameterName: 'Regeneration' },
      amount: 0.22,
    },
    {
      modulator: 'beat-lfo',
      target: { parameterId: 'PIDe', parameterName: 'Brightness' },
      amount: 0.45,
    },
    {
      modulator: 'classic-lfo',
      target: { parameterId: 'PID1', parameterName: 'Stereo Phase' },
      amount: 0.5,
    },
  ]);

  assert.deepEqual(
    listModulators(result.preset, 0).map((modulator) =>
      [modulator.deviceName, modulator.instanceGroup, modulator.instanceId]),
    [
      ['LFO', 0, 0],
      ['Random', 0, 1],
      ['Beat LFO', 0, 2],
      ['Classic LFO', 1, 0],
    ],
  );
});
