/** Checkpointed loading and live proof for the owned wide-template composer. */
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  NATIVE_CATALOG_PATH, OWNED_LAYER_MANIFEST_PATH, OWNED_LAYER_TEMPLATE_PATH,
  composeOwnedTemplate, compositionModulatorSemantics,
  type ComposeTemplateOptions, type CompositionEditWitness, type CompositionEntryRequest,
  type OwnedTemplateManifest,
} from '../composition/index.js';
import type { NativeCatalog } from '../native-catalog/catalog.js';
import {
  addressKey, chain, deviceIn,
  type Address, type DeviceAddress, type DeviceState, type Op, type Snapshot, type TrackAddress,
} from '../contract/index.js';
import type { RunOptions } from './executor.js';
import {
  verifyModulation, verifyPages,
  type ModulationVerification, type ModulatorAuthoringHost, type ModulatorPageVerification,
} from './modulator-authoring.js';
import type { Take } from './take.js';

const DEFAULT_STRUCTURE_ATTEMPTS = 4;
const DEFAULT_STRUCTURE_RETRY_MS = 250;

export interface OwnedTemplateCompositionHost extends ModulatorAuthoringHost {
  read(addresses: readonly Address[]): Promise<Snapshot>;
  apply(ops: readonly Op[], options?: RunOptions): Promise<{ readonly take: Take }>;
}

export interface OwnedTemplateCompositionRequest {
  readonly track: TrackAddress;
  readonly entries: readonly CompositionEntryRequest[];
  /** Complete top-level names from the caller's last accepted observation. */
  readonly expectedChain?: readonly string[];
  /** Aligned top-level enabled flags from the same observation. */
  readonly expectedEnabledChain?: readonly boolean[];
}

export interface ObservedCompositionEntry {
  readonly index: number;
  readonly chainName: string;
  readonly deviceNames: readonly string[];
  readonly devicesComplete: boolean;
}

export interface CompositionStructureVerification {
  readonly verified: boolean;
  readonly requested: readonly string[];
  readonly containerName?: string;
  readonly entries: readonly ObservedCompositionEntry[];
  readonly why?: string;
}

export interface CompositionLiveWitness {
  readonly request: CompositionEditWitness;
  readonly pages: ModulatorPageVerification;
  readonly behavior?: ModulationVerification;
  readonly verified: boolean;
}

export interface OwnedTemplateCompositionResult {
  readonly take: Take;
  readonly minted?: DeviceAddress;
  readonly composition: {
    readonly structural: true;
    readonly manifestId: string;
    readonly templatePath: string;
    readonly requested: readonly CompositionEntryRequest[];
    readonly validatedEntries: readonly ValidatedCompositionEntry[];
    readonly validationWarnings: readonly string[];
    /** Restores prior absence. It does not claim byte-exact preset readback. */
    readonly restoreFidelity: Take['fidelity'];
    readonly reversalBoundary: 'remove-observed-container';
  };
  readonly verification: {
    readonly verified: boolean;
    readonly structure: CompositionStructureVerification;
    readonly witnesses: readonly CompositionLiveWitness[];
  };
}

export interface ValidatedCompositionEntry {
  readonly index: number;
  readonly deviceName: string;
  readonly modulators: readonly {
    readonly index: number;
    readonly name: string;
    readonly category: string;
    readonly routed: boolean;
  }[];
}

export interface OwnedTemplateCompositionOptions {
  readonly run?: RunOptions;
  readonly tempRoot?: string;
  readonly wait?: (milliseconds: number) => Promise<void>;
  readonly structureAttempts?: number;
  readonly structureRetryMs?: number;
  /** Test seams. Production uses the checked-in product paths. */
  readonly templatePath?: string;
  readonly manifestPath?: string;
  readonly catalogPath?: string;
  readonly compose?: ComposeTemplateOptions;
  /** Observe a private copy after all validation and before project write. */
  readonly onValidated?: (preset: Buffer) => void;
}

/** Compose, validate, load with one structural insertion, and prove live state. */
export async function buildOwnedTemplateComposition(
  host: OwnedTemplateCompositionHost,
  request: OwnedTemplateCompositionRequest,
  options: OwnedTemplateCompositionOptions = {},
): Promise<OwnedTemplateCompositionResult> {
  const templatePath = options.templatePath ?? OWNED_LAYER_TEMPLATE_PATH;
  const manifestPath = options.manifestPath ?? OWNED_LAYER_MANIFEST_PATH;
  const catalogPath = options.catalogPath ?? NATIVE_CATALOG_PATH;
  const [source, manifestJson, catalogJson] = await Promise.all([
    readFile(templatePath),
    readFile(manifestPath, 'utf8'),
    readFile(catalogPath, 'utf8'),
  ]);
  const manifest = JSON.parse(manifestJson) as OwnedTemplateManifest;
  const catalog = JSON.parse(catalogJson) as NativeCatalog;
  const composed = composeOwnedTemplate(source, manifest, catalog, request.entries, options.compose);
  options.onValidated?.(Buffer.from(composed.preset));

  const directory = await mkdtemp(join(options.tempRoot ?? tmpdir(), 'ghostnote-compose-'));
  const outputPath = join(directory, `${safeName(manifest.id)}.bwpreset`);
  let take: Take;
  try {
    await writeFile(outputPath, composed.preset);
    ({ take } = await host.apply([{
      op: 'device.insert',
      track: request.track,
      source: { from: 'file', path: outputPath },
      ...(request.expectedChain === undefined ? {} : { expectedChain: request.expectedChain }),
      ...(request.expectedEnabledChain === undefined
        ? {} : { expectedEnabledChain: request.expectedEnabledChain }),
    }], options.run));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }

  const mintedValue = take.receipt.minted[0];
  const minted = mintedValue?.kind === 'device' ? mintedValue : undefined;
  const pause = options.wait ?? wait;
  const structure = minted === undefined
    ? failedStructure(request.entries, 'the preset insert returned no observed container address')
    : await verifyStructure(host, minted, manifest.container.name, request.entries, pause, options);
  const witnesses: CompositionLiveWitness[] = [];
  if (minted !== undefined && structure.verified) {
    for (const edit of composed.edits) {
      const observed = structure.entries[edit.entryIndex]!;
      const nested = deviceIn(chain(minted, observed.chainName), 0);
      const pages = await verifyPages(host, nested, [{
        pageName: edit.modulatorPage,
        expectedCount: edit.expectedPageCount,
      }], pause);
      const behavior = edit.behavior === undefined
        ? undefined
        : await verifyModulation(host, nested, {
          parameterId: edit.behavior.parameterId,
          parameterName: edit.behavior.parameterName,
        }, pause, edit.behavior.expected);
      witnesses.push({
        request: edit,
        pages,
        ...(behavior === undefined ? {} : { behavior }),
        verified: pages.verified && (behavior?.verified ?? true),
      });
    }
  }
  const witnessesComplete = witnesses.length === composed.edits.length
    && witnesses.every((witness) => witness.verified);

  return {
    take,
    ...(minted === undefined ? {} : { minted }),
    composition: {
      structural: true,
      manifestId: composed.manifestId,
      templatePath,
      requested: composed.requested,
      validatedEntries: composed.bindings.map((binding) => ({
        index: binding.entryIndex,
        deviceName: binding.deviceName,
        modulators: compositionModulatorSemantics(composed.preset, binding.modulatorListIndex)
          .map((modulator) => ({
            index: modulator.index,
            name: modulator.deviceName,
            category: modulator.category,
            routed: modulator.routes.length > 0,
          })),
      })),
      validationWarnings: composed.validationWarnings,
      restoreFidelity: take.fidelity,
      reversalBoundary: 'remove-observed-container',
    },
    verification: {
      verified: structure.verified && witnessesComplete,
      structure,
      witnesses,
    },
  };
}

async function verifyStructure(
  host: OwnedTemplateCompositionHost,
  minted: DeviceAddress,
  expectedContainerName: string,
  requested: readonly CompositionEntryRequest[],
  pause: (milliseconds: number) => Promise<void>,
  options: OwnedTemplateCompositionOptions,
): Promise<CompositionStructureVerification> {
  const attempts = options.structureAttempts ?? DEFAULT_STRUCTURE_ATTEMPTS;
  const retryMs = options.structureRetryMs ?? DEFAULT_STRUCTURE_RETRY_MS;
  let why = 'the inserted container structure did not settle';
  let lastState: DeviceState | undefined;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const snapshot = await host.read([minted]);
      const value = snapshot.entries[addressKey(minted)]?.value;
      if (value?.of === 'device') {
        lastState = value.device;
        const checked = structureOf(lastState, expectedContainerName, requested);
        if (checked.verified) return checked;
        why = checked.why ?? why;
      } else if (snapshot.unreachable.some((address) => addressKey(address) === addressKey(minted))) {
        why = 'the inserted container is outside the observable device window';
      } else if (snapshot.unstable.some((address) => addressKey(address) === addressKey(minted))) {
        why = 'the inserted container inventory is unstable';
      } else {
        why = 'the inserted container address did not read back';
      }
    } catch (error) {
      throwIfCancellation(host, error);
      why = `container readback failed: ${errorMessage(error)}`;
    }
    if (attempt + 1 < attempts && retryMs > 0) await pause(retryMs);
  }
  const observed = lastState === undefined
    ? []
    : observedEntries(lastState);
  return {
    verified: false,
    requested: requested.map((entry) => entry.deviceName),
    ...(lastState?.name === undefined ? {} : { containerName: lastState.name }),
    entries: observed,
    why,
  };
}

function structureOf(
  state: DeviceState,
  expectedContainerName: string,
  requested: readonly CompositionEntryRequest[],
): CompositionStructureVerification {
  const wanted = requested.map((entry) => entry.deviceName);
  const entries = observedEntries(state);
  if (state.name !== expectedContainerName) {
    return failure(`container is ${JSON.stringify(state.name)}, expected ${JSON.stringify(expectedContainerName)}`);
  }
  if (state.container === undefined) return failure('the container chain inventory was not observed');
  if (!state.container.chainsComplete) return failure('the container chain inventory is partial');
  if (entries.length !== wanted.length) {
    return failure(`observed ${entries.length} entries, expected ${wanted.length}`);
  }
  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index]!;
    if (entry.index !== index) return failure(`entry ${index} read back at position ${entry.index}`);
    if (!entry.devicesComplete) return failure(`entry ${index} device inventory is partial`);
    if (entry.deviceNames.length !== 1 || entry.deviceNames[0] !== wanted[index]) {
      return failure(
        `entry ${index} contains [${entry.deviceNames.join(', ')}], expected [${wanted[index]}]`,
      );
    }
  }
  return {
    verified: true,
    requested: wanted,
    containerName: state.name,
    entries,
  };

  function failure(why: string): CompositionStructureVerification {
    return {
      verified: false,
      requested: wanted,
      containerName: state.name,
      entries,
      why,
    };
  }
}

function observedEntries(state: DeviceState): ObservedCompositionEntry[] {
  return (state.container?.chains ?? []).map((entry) => ({
    index: entry.index,
    chainName: entry.name,
    deviceNames: entry.devices.map((device) => device.name),
    devicesComplete: entry.devicesComplete,
  }));
}

function failedStructure(
  requested: readonly CompositionEntryRequest[],
  why: string,
): CompositionStructureVerification {
  return { verified: false, requested: requested.map((entry) => entry.deviceName), entries: [], why };
}

function safeName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function throwIfCancellation(host: OwnedTemplateCompositionHost, error: unknown): void {
  host.throwIfCancelled?.();
  if (!(error instanceof Error) || error.name === 'AbortError') throw error;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
