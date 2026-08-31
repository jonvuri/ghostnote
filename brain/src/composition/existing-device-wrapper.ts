/** Build one owned FX Layer that late-binds modulation to its first device. */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import {
  addModulator, donorType, listModulators, loadDonor, validate,
} from '../bwmod/index.js';
import { modulationRoute, type ModulationTarget } from '../engine/modulation-target.js';
import {
  OWNED_FX_LAYER_MANIFEST_PATH, OWNED_FX_LAYER_TEMPLATE_PATH,
} from './assets.js';

export const EXISTING_DEVICE_WRAPPER_KIND = 'FX Layer' as const;
export const EXISTING_DEVICE_WRAPPER_ENTRY = 'Layer 1' as const;

export interface ExistingDeviceWrapperModulation {
  readonly modulator: string;
  readonly target: ModulationTarget;
  readonly amount: number;
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
