/** Build owned containers that late-bind modulation to requested devices. */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import {
  addModulator, donorType, listChains, listModulators, loadDonor,
  modulatorListOffsets, stubValues, validate,
} from '../bwmod/index.js';
import { modulationRoute, type ModulationTarget } from '../engine/modulation-target.js';
import {
  OWNED_FX_LAYER_MANIFEST_PATH, OWNED_FX_LAYER_TEMPLATE_PATH,
  GENERAL_CONTAINER_SEED_MANIFEST_PATH,
} from './assets.js';
import { fiveEntryLayerSeedPreset } from './layer-seeds.js';

export const EXISTING_DEVICE_WRAPPER_KIND = 'FX Layer' as const;
export const EXISTING_DEVICE_WRAPPER_ENTRY = 'Layer 1' as const;
export const GENERAL_DEVICE_CONTAINER_KINDS = ['Instrument Layer', 'FX Layer'] as const;
export type GeneralDeviceContainerKind = typeof GENERAL_DEVICE_CONTAINER_KINDS[number];
export const GENERAL_DEVICE_COMPOSITION_CAPACITIES = Object.freeze({
  topLevelContainerPositions: 3,
  entriesPerLayer: 5,
  devicesPerEntry: 4,
  parameterRouteDepth: 2,
});

export interface ExistingDeviceWrapperModulation {
  readonly modulator: string;
  readonly target: ModulationTarget;
  readonly amount: number;
}

export interface GeneralDeviceContainerModulation extends ExistingDeviceWrapperModulation {
  readonly entryIndex: number;
  readonly deviceIndex: number;
}

export interface ExistingDeviceWrapperPreset {
  readonly preset: Buffer;
  readonly modulatorPages: readonly string[];
  readonly routes: readonly {
    readonly parameterId: string;
    readonly parameterName: string;
    readonly route: string;
  }[];
}

interface FxLayerManifest {
  readonly schemaVersion: number;
  readonly id: string;
  readonly sha256: string;
  readonly byteLength: number;
  readonly container: { readonly name: string };
  readonly targetEntry: {
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
  readonly schemaVersion: 1;
  readonly assets: readonly {
    readonly id: string;
    readonly containerName: GeneralDeviceContainerKind;
    readonly containerGuid: string;
    readonly containerGuidOffset: number;
    readonly sha256: string;
    readonly byteLength: number;
    readonly outerModulatorListOffset: number;
    readonly maximumEntries: number;
    readonly chains: readonly {
      readonly index: number; readonly name: string; readonly start: number; readonly end: number | null;
    }[];
    readonly sampleReferenceStubs: number;
  }[];
}

export class ExistingDeviceWrapperPresetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Author and validate one private preset copy. No project write occurs here. */
export async function composeExistingDeviceWrapperPreset(
  requests: readonly ExistingDeviceWrapperModulation[],
  options: {
    readonly templatePath?: string;
    readonly manifestPath?: string;
  } = {},
): Promise<ExistingDeviceWrapperPreset> {
  if (requests.length === 0) {
    throw new ExistingDeviceWrapperPresetError('at least one modulation request is required');
  }
  const templatePath = options.templatePath ?? OWNED_FX_LAYER_TEMPLATE_PATH;
  const manifestPath = options.manifestPath ?? OWNED_FX_LAYER_MANIFEST_PATH;
  const [source, manifestText] = await Promise.all([
    readFile(templatePath),
    readFile(manifestPath, 'utf8'),
  ]);
  const manifest = JSON.parse(manifestText) as FxLayerManifest;
  assertManifest(source, manifest);

  let preset: Buffer = Buffer.from(source);
  const routes: ExistingDeviceWrapperPreset['routes'][number][] = [];
  for (const request of requests) {
    if (!Number.isFinite(request.amount) || request.amount < -1 || request.amount > 1) {
      throw new ExistingDeviceWrapperPresetError('modulation amount must be from -1 through 1');
    }
    const type = donorType(request.modulator, 'add');
    const target = fxLayerTarget(request.target);
    preset = addModulator(
      preset,
      loadDonor(type.donorId),
      { target, amount: request.amount },
      { listIndex: 0 },
    );
    routes.push({ ...request.target, route: target });
  }

  const checked = validate(preset, { reference: source, listIndex: 0 });
  if (!checked.ok) {
    throw new ExistingDeviceWrapperPresetError(
      `the wrapper preset failed validation: ${checked.problems.join('; ')}`,
    );
  }
  const modulators = listModulators(preset, 0);
  if (modulators.length !== requests.length) {
    throw new ExistingDeviceWrapperPresetError('the complete outer modulator inventory did not read back');
  }
  for (const [index, route] of routes.entries()) {
    if (!modulators[index]?.routes.some((item) => item.target === route.route)) {
      throw new ExistingDeviceWrapperPresetError(
        `outer modulator ${index} did not read back its exact target`,
      );
    }
  }
  return {
    preset,
    modulatorPages: modulators.map((item) => item.deviceName),
    routes,
  };
}

/** Author outer routes for several late-bound FX Layer entries. */
export async function composeGeneralDeviceContainerPreset(
  containerKind: GeneralDeviceContainerKind,
  requests: readonly GeneralDeviceContainerModulation[],
  options: {
    readonly templatePath?: string;
    readonly entryCount?: number;
  } = {},
): Promise<ExistingDeviceWrapperPreset> {
  if (requests.some((item) => !Number.isInteger(item.entryIndex)
      || item.entryIndex < 0 || item.entryIndex >= GENERAL_DEVICE_COMPOSITION_CAPACITIES.entriesPerLayer)) {
    throw new ExistingDeviceWrapperPresetError('entry index must be from 0 through 4');
  }
  if (requests.some((item) => !Number.isInteger(item.deviceIndex)
      || item.deviceIndex < 0 || item.deviceIndex >= GENERAL_DEVICE_COMPOSITION_CAPACITIES.devicesPerEntry)) {
    throw new ExistingDeviceWrapperPresetError('device index must be from 0 through 3');
  }
  const entryCount = options.entryCount ?? Math.max(
    1, ...requests.map((item) => item.entryIndex + 1),
  );
  if (!Number.isInteger(entryCount) || entryCount < 1
      || entryCount > GENERAL_DEVICE_COMPOSITION_CAPACITIES.entriesPerLayer) {
    throw new ExistingDeviceWrapperPresetError('entry count is outside the complete container capacity');
  }
  if (requests.some((item) => item.entryIndex >= entryCount)) {
    throw new ExistingDeviceWrapperPresetError('a route names an entry outside the requested container shape');
  }
  const rawSource = options.templatePath === undefined
    ? fiveEntryLayerSeedPreset(containerKind)
    : await readFile(options.templatePath);
  if (options.templatePath === undefined) await assertGeneralSeed(rawSource, containerKind);
  const source = trimLayerSeed(rawSource, entryCount);

  let preset: Buffer = Buffer.from(source);
  const routes: ExistingDeviceWrapperPreset['routes'][number][] = [];
  for (const request of requests) {
    if (!Number.isFinite(request.amount) || request.amount < -1 || request.amount > 1) {
      throw new ExistingDeviceWrapperPresetError('modulation amount must be from -1 through 1');
    }
    const type = donorType(request.modulator, 'add');
    // Bitwig normalizes a retained layer suffix to CHAIN0..CHAINn when it
    // loads. The displayed entry name is a separate field.
    const target = `CONTENTS/CHAIN_LIST/CHAIN${request.entryIndex}/DEVICE_CHAIN/${request.deviceIndex}:`
      + modulationRoute(request.target);
    preset = addModulator(
      preset, loadDonor(type.donorId), { target, amount: request.amount }, { listIndex: 0 },
    );
    routes.push({ ...request.target, route: target });
  }

  const checked = validate(preset, { reference: source, listIndex: 0 });
  if (!checked.ok) {
    throw new ExistingDeviceWrapperPresetError(
      `the general container preset failed validation: ${checked.problems.join('; ')}`,
    );
  }
  const modulators = listModulators(preset, 0);
  if (modulators.length !== requests.length) {
    throw new ExistingDeviceWrapperPresetError('the complete outer modulator inventory did not read back');
  }
  for (const [index, route] of routes.entries()) {
    if (!modulators[index]?.routes.some((item) => item.target === route.route)) {
      throw new ExistingDeviceWrapperPresetError(
        `outer modulator ${index} did not read back its exact target`,
      );
    }
  }
  return {
    preset,
    modulatorPages: modulators.map((item) => item.deviceName),
    routes,
  };
}

function trimLayerSeed(source: Buffer, entryCount: number): Buffer {
  const chains = listChains(source);
  if (chains.length !== GENERAL_DEVICE_COMPOSITION_CAPACITIES.entriesPerLayer) {
    throw new ExistingDeviceWrapperPresetError('the layer seed does not have five complete entries');
  }
  let preset = Buffer.from(source);
  for (const entry of chains.slice(0, chains.length - entryCount).reverse()) {
    if (entry.end === null) {
      throw new ExistingDeviceWrapperPresetError('a removable layer entry has no exact end');
    }
    preset = Buffer.concat([preset.subarray(0, entry.start), preset.subarray(entry.end)]);
  }
  if (listChains(preset).length !== entryCount || !validate(preset).ok) {
    throw new ExistingDeviceWrapperPresetError('the trimmed layer seed did not validate exactly');
  }
  return preset;
}

async function assertGeneralSeed(
  source: Buffer, containerKind: GeneralDeviceContainerKind,
): Promise<void> {
  const parsed = JSON.parse(
    await readFile(GENERAL_CONTAINER_SEED_MANIFEST_PATH, 'utf8'),
  ) as GeneralContainerSeedManifest;
  const asset = parsed.assets.find((item) => item.containerName === containerKind);
  const hash = createHash('sha256').update(source).digest('hex');
  const guid = asset === undefined ? undefined
    : Buffer.from(asset.containerGuid.replaceAll('-', ''), 'hex');
  if (parsed.schemaVersion !== 1 || asset === undefined || guid === undefined
      || asset.sha256 !== hash || asset.byteLength !== source.length
      || !source.subarray(asset.containerGuidOffset, asset.containerGuidOffset + 16).equals(guid)
      || JSON.stringify(modulatorListOffsets(source))
        !== JSON.stringify([asset.outerModulatorListOffset])
      || JSON.stringify(listChains(source)) !== JSON.stringify(asset.chains)
      || stubValues(source).length !== asset.sampleReferenceStubs
      || listModulators(source, 0).length !== 0 || !validate(source).ok) {
    throw new ExistingDeviceWrapperPresetError(
      `the ${containerKind} seed did not match its exact manifest`,
    );
  }
}

function fxLayerTarget(target: ModulationTarget): string {
  const parameterRoute = modulationRoute(target);
  return 'CONTENTS/CHAIN_LIST/CHAIN0/DEVICE_CHAIN/0:' + parameterRoute;
}

function assertManifest(source: Buffer, manifest: FxLayerManifest): void {
  const hash = createHash('sha256').update(source).digest('hex');
  const valid = manifest.schemaVersion === 1
    && manifest.id === 'fx-layer-late-bound'
    && manifest.sha256 === hash
    && manifest.byteLength === source.length
    && manifest.container.name === EXISTING_DEVICE_WRAPPER_KIND
    && manifest.targetEntry.liveName === EXISTING_DEVICE_WRAPPER_ENTRY
    && manifest.targetEntry.devicePosition === 0
    && manifest.targetEntry.initiallyEmpty
    && manifest.externalReferences.packagedFileIds.length === 0
    && manifest.externalReferences.sampledPresetReferenceStubs === 0;
  if (!valid) {
    throw new ExistingDeviceWrapperPresetError(
      'the owned FX Layer source did not match its complete manifest',
    );
  }
}
