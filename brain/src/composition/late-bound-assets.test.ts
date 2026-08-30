import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  listChains, listModulators, modulatorListOffsets, readMeta, stubValues, validate,
} from '../bwmod/index.js';
import {
  OWNED_FX_LAYER_MANIFEST_PATH, OWNED_FX_LAYER_TEMPLATE_PATH,
} from './assets.js';

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
