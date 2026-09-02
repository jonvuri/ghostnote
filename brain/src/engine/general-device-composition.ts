/** Guarded composition and reversal for general device sources. */
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  composeGeneralDeviceContainerPreset, GENERAL_DEVICE_COMPOSITION_CAPACITIES,
  type GeneralDeviceContainerKind, type GeneralDeviceContainerModulation,
} from '../composition/index.js';
import {
  addressKey, chain, device, deviceIn,
  type Address, type DeviceAddress, type DeviceSource, type ObservedDevice,
  type ObservedContainer, type ObservedDeviceBank, type ObservedDeviceSequence,
  type Op, type ParamState, type RevisionMark,
  type Snapshot, type TrackAddress,
} from '../contract/index.js';
import {
  inspectPresetModulation,
  type PresetFingerprint, type SemanticModulatorLocation,
} from './preset-modulation-inspection.js';
import type { RunOptions } from './executor.js';
import { ownChangesetReversal } from './floor.js';
import {
  authorSemanticPreset, verifyModulation, verifyPages,
  type ModulationVerification, type ModulatorPageVerification,
} from './modulator-authoring.js';
import type { ModulationTarget } from './modulation-target.js';
import { modulationRoute } from './modulation-target.js';
import type { Take } from './take.js';

export interface GeneralDeviceCompositionHost {
  readonly throwIfCancelled?: () => void;
  devices(track: TrackAddress): Promise<ObservedDeviceBank>;
  read(addresses: readonly Address[]): Promise<Snapshot>;
  apply(ops: readonly Op[], options?: RunOptions): Promise<{ readonly take: Take }>;
}

export interface GeneralDeviceOrderItem {
  readonly name: string;
  readonly enabled: boolean;
}

export type GeneralDeviceSourceRequest =
  | { readonly kind: 'native'; readonly name: string; readonly uuid: string }
  | { readonly kind: 'vst3'; readonly classUid: string }
  | { readonly kind: 'clap'; readonly id: string }
  | {
    readonly kind: 'preset'; readonly path: string; readonly fingerprint?: PresetFingerprint;
    readonly modulatorLocation?: SemanticModulatorLocation;
  }
  | { readonly kind: 'existing-move'; readonly devicePosition: number }
  | { readonly kind: 'existing-copy'; readonly devicePosition: number };

export interface GeneralDeviceModulationRequest {
  readonly location: 'container' | 'device';
  readonly modulator: string;
  readonly donorId: string;
  readonly pageName: string;
  readonly target: ModulationTarget;
  readonly amount: number;
  readonly behaviorCheck: 'active' | 'page-only';
}

export interface GeneralDeviceEntryDeviceRequest {
  readonly source: GeneralDeviceSourceRequest;
  readonly modulators: readonly GeneralDeviceModulationRequest[];
}

export interface GeneralDeviceEntryRequest {
  readonly entryName: string;
  readonly devices: readonly GeneralDeviceEntryDeviceRequest[];
}

export interface GeneralDeviceCompositionRequest {
  readonly track: TrackAddress;
  readonly expectedDeviceOrder: readonly GeneralDeviceOrderItem[];
  readonly containerKind: GeneralDeviceContainerKind;
  readonly containerPosition: number;
  readonly entries: readonly GeneralDeviceEntryRequest[];
}

export interface GeneralDeviceFingerprint {
  readonly algorithm: 'sha256';
  readonly sha256: string;
  readonly parameterCount: number;
}

export interface GeneralDeviceStageReceipt {
  readonly stage: 'insert-container' | 'position-container' | 'prepare-entry-name'
    | 'confirm-entry-name' | 'insert-source' | 'relocate-source'
    | 'extract-source' | 'restore-position' | 'remove-source' | 'remove-container';
  readonly entryIndex?: number;
  readonly changeId: string;
  readonly applied: boolean;
}

export interface GeneralDeviceCheckpointEntry {
  readonly entryIndex: number;
  readonly deviceIndex: number;
  readonly entryName: string;
  readonly sourceKind: GeneralDeviceSourceRequest['kind'];
  readonly observedName: string;
  readonly enabled: boolean;
  readonly fingerprint?: GeneralDeviceFingerprint;
  readonly fingerprintLocation?: SemanticModulatorLocation;
  readonly ownedChangeId?: string;
  readonly originalPosition?: number;
}

export interface GeneralDeviceCompositionCheckpoint {
  readonly schemaVersion: 5;
  readonly state: 'container-inserted' | 'container-positioned' | 'entries-prepared' | 'composing';
  readonly track: TrackAddress;
  readonly containerKind: GeneralDeviceContainerKind;
  readonly requestedContainerPosition: number;
  readonly containerInsertTakeId: string;
  readonly insertedContainerPosition: number;
  readonly currentContainerPosition: number;
  readonly seedUnchanged: boolean;
  readonly lastWriteAt: { readonly revision: number; readonly generation: string; readonly project: string };
  readonly originalDeviceOrder: readonly GeneralDeviceOrderItem[];
  readonly entryNames: readonly string[];
  readonly preparedEntryNames: readonly string[];
  readonly completedEntries: readonly GeneralDeviceCheckpointEntry[];
  readonly pendingUnwitnessedSource?: {
    readonly entryIndex: number;
    readonly deviceIndex: number;
    readonly sourceKind: GeneralDeviceSourceRequest['kind'];
    readonly ownedChangeId: string;
    readonly chainIndex: number;
    readonly at: { readonly revision: number; readonly generation: string; readonly project: string };
  };
  readonly pendingEntry?: GeneralDeviceCheckpointEntry & {
    readonly location: 'top-level' | 'container-entry';
  };
  readonly reversalRemainingEntries?: readonly GeneralDeviceCheckpointEntry[];
  readonly reversalPendingTopLevel?: GeneralDeviceCheckpointEntry & {
    readonly position: number;
  };
  readonly reversalContainerRemoved?: true;
}

export interface GeneralDeviceEntryVerification {
  readonly entryIndex: number;
  readonly deviceIndex: number;
  readonly entryName: string;
  readonly sourceKind: GeneralDeviceSourceRequest['kind'];
  readonly sourceIdentity: Record<string, unknown>;
  readonly observed: { readonly deviceName: string; readonly enabled: boolean; readonly position: number };
  readonly instance: 'preserved' | 'new';
  readonly stateClaim: string;
  readonly scalarFingerprint?: {
    readonly before?: GeneralDeviceFingerprint;
    readonly after: GeneralDeviceFingerprint;
    readonly preserved?: boolean;
  };
  readonly pages: ModulatorPageVerification;
  readonly containerPages: ModulatorPageVerification;
  readonly behaviors: readonly ModulationVerification[];
  readonly verified: boolean;
}

export interface GeneralDeviceCompositionResult {
  readonly complete: boolean;
  readonly failedStage?: string;
  readonly why?: string;
  readonly stages: readonly GeneralDeviceStageReceipt[];
  readonly checkpoint?: GeneralDeviceCompositionCheckpoint;
  readonly entries: readonly GeneralDeviceEntryVerification[];
  readonly capacities: typeof GENERAL_DEVICE_COMPOSITION_CAPACITIES;
  readonly structure?: readonly {
    readonly entryIndex: number; readonly entryName: string;
    readonly devices: readonly { readonly position: number; readonly name: string; readonly enabled: boolean }[];
  }[];
}

export interface GeneralDeviceCompositionReversal {
  readonly complete: boolean;
  readonly failedStage?: string;
  readonly why?: string;
  readonly stages: readonly GeneralDeviceStageReceipt[];
  readonly containerRemoved: boolean;
  readonly restoredDeviceOrder: boolean;
  readonly checkpoint?: GeneralDeviceCompositionCheckpoint;
}

export interface GeneralDeviceCompositionOptions {
  readonly run?: Omit<RunOptions, 'ifRevision'>;
  readonly wait?: (milliseconds: number) => Promise<void>;
  readonly tempRoot?: string;
  readonly templatePath?: string;
}

/** Compose ordered sources inside one owned bounded container. */
export async function composeGeneralDeviceSources(
  host: GeneralDeviceCompositionHost,
  request: GeneralDeviceCompositionRequest,
  options: GeneralDeviceCompositionOptions = {},
): Promise<GeneralDeviceCompositionResult> {
  const stages: GeneralDeviceStageReceipt[] = [];
  const verified: GeneralDeviceEntryVerification[] = [];
  let checkpoint: GeneralDeviceCompositionCheckpoint | undefined;
  let failedStage = 'preflight';
  try {
    const initial = await stableTop(host, request.track, request.expectedDeviceOrder);
    assertRequest(request, initial.bankSize);
    const outerRequests: GeneralDeviceContainerModulation[] = request.entries.flatMap(
      (entry, entryIndex) => entry.devices.flatMap((entryDevice, deviceIndex) =>
        entryDevice.modulators
          .filter((item) => item.location === 'container')
          .map((item) => ({
            entryIndex, deviceIndex,
            modulator: item.modulator, target: item.target, amount: item.amount,
          }))),
    );
    const containerPreset = await composeGeneralDeviceContainerPreset(request.containerKind, outerRequests, {
      ...(options.templatePath === undefined ? {} : { templatePath: options.templatePath }),
      entryCount: request.entries.length,
    });
    const directory = await mkdtemp(join(options.tempRoot ?? tmpdir(), 'ghostnote-general-compose-'));
    try {
      const containerPath = join(directory, 'general-device-container.bwpreset');
      await writeFile(containerPath, containerPreset.preset);
      failedStage = 'insert-container';
      const insertion = (await host.apply([{
        op: 'device.insert', track: request.track,
        source: { from: 'file', path: containerPath },
        expectedDeviceName: request.containerKind,
        expectedChain: names(initial.devices), expectedEnabledChain: enabled(initial.devices),
      }], { ...options.run, ifRevision: initial.at.revision })).take;
      stages.push(receipt('insert-container', insertion));
      const minted = insertion.receipt.minted[0];
      if (!accepted(insertion) || minted?.kind !== 'device') {
        return failure(failedStage, 'The owned container insertion was not proved.', stages, verified);
      }
      checkpoint = {
        schemaVersion: 5, state: 'container-inserted', track: request.track,
        containerKind: request.containerKind, containerInsertTakeId: insertion.id,
        requestedContainerPosition: request.containerPosition,
        insertedContainerPosition: minted.chainIndex, currentContainerPosition: minted.chainIndex,
        seedUnchanged: true, lastWriteAt: minimalMark(insertion.verify.at),
        originalDeviceOrder: request.expectedDeviceOrder,
        entryNames: request.entries.map((item) => item.entryName),
        preparedEntryNames: [],
        completedEntries: [],
      };

      const inserted = await stableTop(host, request.track, [
        ...request.expectedDeviceOrder, { name: request.containerKind, enabled: true },
      ]);
      let lastWriteAt = checkpoint.lastWriteAt;
      if (minted.chainIndex !== request.containerPosition) {
        failedStage = 'position-container';
        const positioning = (await host.apply([{
          op: 'device.relocate', track: request.track, sourceFromEnd: 0,
          expectedName: request.containerKind, before: device(request.track, request.containerPosition),
          expectedChain: names(inserted.devices), expectedEnabledChain: enabled(inserted.devices),
        }], { ...options.run, ifRevision: inserted.at.revision })).take;
        stages.push(receipt('position-container', positioning));
        if (!accepted(positioning)) {
          return failure(failedStage, 'The owned container position was not proved.', stages, verified, checkpoint);
        }
        lastWriteAt = minimalMark(positioning.verify.at);
      }
      checkpoint = {
        ...checkpoint, state: 'container-positioned',
        currentContainerPosition: request.containerPosition,
        lastWriteAt,
      };
      let current = await stableTop(
        host, request.track, withContainer(request.expectedDeviceOrder, request),
      );
      let container = device(request.track, request.containerPosition);
      const initialStructure = await observedContainer(host, container, request.containerKind);
      const initialEntries = initialStructure === undefined
        ? undefined : observedEntries(initialStructure, request.containerKind);
      const initialNames = initialEntries?.map((entry) => entry.name) ?? [];
      if (initialEntries === undefined || initialEntries.length !== request.entries.length
          || new Set(initialNames).size !== initialNames.length
          || initialEntries.some((entry) =>
            !entry.sequence.devicesComplete || entry.sequence.devices.length !== 0)) {
        return failure('container-witness', 'The exact empty seed structure did not read back.', stages, verified, checkpoint);
      }
      checkpoint = { ...checkpoint, preparedEntryNames: initialNames };
      const requestedNames = request.entries.map((item) => item.entryName);
      if (JSON.stringify(initialNames) !== JSON.stringify(requestedNames)) {
        const temporaryNames = uniqueTemporaryNames(
          [...initialNames, ...requestedNames], request.entries.length,
        );
        failedStage = 'prepare-entries';
        for (const [index, initialName] of initialNames.entries()) {
          const prepare = (await host.apply([{
            op: 'chain.rename', chain: chain(container, initialName), name: temporaryNames[index]!,
          }], { ...options.run, ifRevision: current.at.revision })).take;
          stages.push(receipt('prepare-entry-name', prepare, index));
          if (!accepted(prepare)) {
            return failure('prepare-entries', `Temporary entry ${index} was not proved.`, stages, verified, checkpoint);
          }
          checkpoint = {
            ...checkpoint,
            seedUnchanged: false,
            lastWriteAt: minimalMark(prepare.verify.at),
            preparedEntryNames: checkpoint.preparedEntryNames.map((name, entryIndex) =>
              entryIndex === index ? temporaryNames[index]! : name),
          };
          current = await stableTop(host, request.track);
        }
        for (const [index, temporaryName] of temporaryNames.entries()) {
          const confirm = (await host.apply([{
            op: 'chain.rename', chain: chain(container, temporaryName),
            name: requestedNames[index]!,
          }], { ...options.run, ifRevision: current.at.revision })).take;
          stages.push(receipt('confirm-entry-name', confirm, index));
          if (!accepted(confirm)) {
            return failure('prepare-entries', `Explicit entry ${index} was not proved.`, stages, verified, checkpoint);
          }
          checkpoint = {
            ...checkpoint,
            preparedEntryNames: checkpoint.preparedEntryNames.map((name, entryIndex) =>
              entryIndex === index ? requestedNames[index]! : name),
          };
          current = await stableTop(host, request.track);
        }
      }
      if (!await exactEntries(host, container, checkpoint.preparedEntryNames, [], request.containerKind)) {
        return failure('prepare-entries', 'The complete empty entry order did not read back.', stages, verified, checkpoint);
      }
      checkpoint = { ...checkpoint, state: 'entries-prepared' };

      for (const [entryIndex, entry] of request.entries.entries()) {
        for (const [deviceIndex, entryDevice] of entry.devices.entries()) {
          failedStage = `source-${entryIndex}-${deviceIndex}`;
          const completed = await addEntry(
            host, request, entry.entryName, entryDevice, entryIndex, deviceIndex,
            directory, checkpoint, stages, options,
            (pendingEntry, currentContainerPosition) => {
              checkpoint = {
                ...checkpoint!, state: 'composing', pendingEntry,
                pendingUnwitnessedSource: undefined,
                currentContainerPosition, seedUnchanged: false,
              };
            },
            (pendingUnwitnessedSource) => {
              checkpoint = {
                ...checkpoint!, state: 'composing', pendingUnwitnessedSource,
                seedUnchanged: false,
              };
            },
          );
          if ('why' in completed) {
            return failure(failedStage, completed.why, stages, verified, checkpoint);
          }
          verified.push(completed.verification);
          const completedEntries: GeneralDeviceCheckpointEntry[] = [
            ...checkpoint.completedEntries, completed.checkpoint,
          ];
          checkpoint = {
            ...checkpoint, state: 'composing', completedEntries, pendingEntry: undefined,
            currentContainerPosition: containerPosition(request, completedEntries),
          };
        }
      }

      container = device(request.track, checkpoint.currentContainerPosition);
      const structure = await readStructure(
        host, container, checkpoint.entryNames, checkpoint.completedEntries, request.containerKind,
      );
      const complete = structure !== undefined && verified.every((item) => item.verified);
      return {
        complete,
        ...(complete ? {} : {
          failedStage: 'final-witness',
          why: 'The complete structure or one modulation witness did not pass.',
        }),
        stages, checkpoint, entries: verified, capacities: GENERAL_DEVICE_COMPOSITION_CAPACITIES,
        ...(structure === undefined ? {} : { structure }),
      };
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  } catch (error) {
    host.throwIfCancelled?.();
    return failure(
      failedStage,
      `${checkpoint === undefined ? 'Nothing was written.' : 'The workflow stopped after a project write.'} ${message(error)}`,
      stages, verified, checkpoint,
    );
  }
}

async function addEntry(
  host: GeneralDeviceCompositionHost,
  request: GeneralDeviceCompositionRequest,
  entryName: string,
  entryDevice: GeneralDeviceEntryDeviceRequest,
  entryIndex: number,
  deviceIndex: number,
  directory: string,
  checkpoint: GeneralDeviceCompositionCheckpoint,
  stages: GeneralDeviceStageReceipt[],
  options: GeneralDeviceCompositionOptions,
  onPending: (
    entry: GeneralDeviceCheckpointEntry & { readonly location: 'top-level' | 'container-entry' },
    currentContainerPosition: number,
  ) => void,
  onUnwitnessed: (
    source: NonNullable<GeneralDeviceCompositionCheckpoint['pendingUnwitnessedSource']>,
  ) => void,
): Promise<{ readonly why: string } | {
  readonly checkpoint: GeneralDeviceCheckpointEntry;
  readonly verification: GeneralDeviceEntryVerification;
}> {
  let currentContainerPosition = containerPosition(request, checkpoint.completedEntries);
  let container = device(request.track, currentContainerPosition);
  const source = entryDevice.source;
  let top = await stableTop(host, request.track, projectedTop(request, checkpoint.completedEntries));
  let sourcePosition: number;
  let observedName: string;
  let observedEnabled: boolean;
  let ownedChangeId: string | undefined;
  let beforeFingerprint: GeneralDeviceFingerprint | undefined;
  let presetIdentity: Record<string, unknown> = {};

  if (source.kind === 'existing-move' || source.kind === 'existing-copy') {
    sourcePosition = currentExistingPosition(request, source.devicePosition, checkpoint.completedEntries);
    const observed = top.devices[sourcePosition];
    const expected = request.expectedDeviceOrder[source.devicePosition];
    if (observed === undefined || expected === undefined
        || observed.name !== expected.name || observed.enabled !== expected.enabled) {
      return { why: 'The existing source identity or enabled state changed before its stage.' };
    }
    const inventory = await stableInventory(host, device(request.track, sourcePosition));
    beforeFingerprint = fingerprint(inventory.params);
    observedName = observed.name;
    observedEnabled = observed.enabled!;
  } else {
    let insertSource: DeviceSource;
    let expectedDeviceName: string | undefined;
    if (source.kind === 'native') {
      insertSource = { from: 'bitwig', uuid: source.uuid };
      expectedDeviceName = source.name;
    } else if (source.kind === 'vst3') {
      insertSource = { from: 'vst3', classUid: source.classUid };
    } else if (source.kind === 'clap') {
      insertSource = { from: 'clap', id: source.id };
    } else {
      const deviceMods = entryDevice.modulators.filter((item) => item.location === 'device');
      let path = source.path;
      if (deviceMods.length > 0) {
        if (source.fingerprint === undefined || source.modulatorLocation === undefined) {
          return { why: 'A preset device modulation needs its exact fingerprint and semantic location.' };
        }
        const authored = await authorSemanticPreset(
          source.path, source.fingerprint, source.modulatorLocation,
          deviceMods.map((item) => ({
            donorId: item.donorId,
            routing: { target: modulationRoute(item.target), amount: item.amount },
          })),
        );
        path = join(directory, `${entryIndex}-${deviceIndex}-${basename(source.path)}`);
        await writeFile(path, authored.preset);
        presetIdentity = {
          presetMetadataName: authored.hostName,
          semanticLocation: authored.location,
          sampledPreset: authored.sampledPreset,
          adjustedSampleReferences: authored.adjustedSampleReferences,
        };
      } else {
        const bytes = await readFile(source.path);
        const inspection = inspectPresetModulation(bytes);
        presetIdentity = inspection.supported
          ? {
            presetBytes: bytes.length, presetMetadataName: inspection.host.name,
            sampledPreset: inspection.host.tier === 'tier-2',
          }
          : { presetBytes: bytes.length, presetMetadataUnavailable: inspection.why };
      }
      insertSource = { from: 'file', path };
    }
    const inserted = (await host.apply([{
      op: 'device.insert', track: request.track, source: insertSource,
      ...(expectedDeviceName === undefined ? {} : { expectedDeviceName }),
      expectedChain: names(top.devices), expectedEnabledChain: enabled(top.devices),
    }], { ...options.run, ifRevision: top.at.revision })).take;
    stages.push(receipt('insert-source', inserted, entryIndex));
    const minted = inserted.receipt.minted[0];
    if (!accepted(inserted) || minted?.kind !== 'device') {
      return { why: 'The source insertion was not proved.' };
    }
    ownedChangeId = inserted.id;
    sourcePosition = minted.chainIndex;
    onUnwitnessed({
      entryIndex, deviceIndex, sourceKind: source.kind, ownedChangeId,
      chainIndex: sourcePosition,
      at: {
        revision: inserted.verify.at.revision,
        generation: inserted.verify.at.generation,
        project: inserted.verify.at.project,
      },
    });
    top = await stableTop(host, request.track);
    const observed = top.devices[sourcePosition];
    if (observed === undefined || observed.enabled === undefined) {
      return { why: 'The inserted source name and enabled state did not read back.' };
    }
    observedName = observed.name;
    observedEnabled = observed.enabled;
    onPending({
      entryIndex, deviceIndex, entryName, sourceKind: source.kind,
      observedName, enabled: observedEnabled, ownedChangeId, location: 'top-level',
    }, currentContainerPosition);
    if (source.kind === 'preset') {
      const metadataName = presetIdentity['presetMetadataName'];
      presetIdentity = {
        ...presetIdentity,
        observedDeviceName: observedName,
        nameMatchesPresetMetadata: typeof metadataName === 'string'
          ? metadataName === observedName : 'not-observed',
      };
    }
  }

  top = await stableTop(host, request.track);
  const relocation = (await host.apply([{
    op: 'chain.relocate', source: device(request.track, sourcePosition),
    destination: chain(container, entryName),
    mode: source.kind === 'existing-copy' ? 'copy' : 'move',
    expectedChain: names(top.devices), expectedEnabledChain: enabled(top.devices),
  }], { ...options.run, ifRevision: top.at.revision })).take;
  stages.push(receipt('relocate-source', relocation, entryIndex));
  if (!accepted(relocation)) return { why: 'The source relocation was not proved.' };
  if (source.kind === 'existing-copy') ownedChangeId = relocation.id;
  const pendingEntry = {
    entryIndex, deviceIndex, entryName, sourceKind: source.kind,
    observedName, enabled: observedEnabled,
    ...(beforeFingerprint === undefined ? {} : { fingerprint: beforeFingerprint }),
    ...(ownedChangeId === undefined ? {} : { ownedChangeId }),
    ...(source.kind === 'existing-move' || source.kind === 'existing-copy'
      ? { originalPosition: source.devicePosition } : {}),
    location: 'container-entry' as const,
  };
  currentContainerPosition = containerPosition(request, [...checkpoint.completedEntries, pendingEntry]);
  container = device(request.track, currentContainerPosition);
  onPending({
    ...pendingEntry,
  }, currentContainerPosition);

  const nested = deviceIn(chain(container, entryName), deviceIndex);
  const deviceMods = entryDevice.modulators.filter((item) => item.location === 'device');
  const containerMods = entryDevice.modulators.filter((item) => item.location === 'container');
  const deviceWitness = deviceMods.length === 0
    ? { address: nested }
    : deviceModulationWitness(
      nested, source.kind === 'preset' ? source.modulatorLocation : undefined,
    );
  const fingerprintLocation = deviceMods.length > 0 && source.kind === 'preset'
      && source.modulatorLocation?.kind === 'entry'
    ? source.modulatorLocation : undefined;
  const inventory = await stableInventory(host, deviceWitness.address, options.wait ?? wait);
  if (deviceWitness.expectedName !== undefined
      && inventory.name !== deviceWitness.expectedName) {
    return { why: 'The preset device modulation host did not match its semantic location.' };
  }
  const afterFingerprint = fingerprint(inventory.params);
  const expectedEntries = [...checkpoint.completedEntries, {
    entryIndex, deviceIndex, entryName, sourceKind: source.kind,
    observedName, enabled: observedEnabled,
  }];
  if (!await exactEntries(host, container, checkpoint.entryNames, expectedEntries, request.containerKind)) {
    return { why: 'The complete entry and device order did not read back.' };
  }

  const relevantPages = deviceMods.map((item) => item.pageName);
  const pages = relevantPages.length === 0
    ? { verified: true, actualPages: [], witnesses: [] }
    : await verifyPages(
      host, deviceWitness.address, pageWitnesses(relevantPages), options.wait ?? wait,
    );
  const behaviors: ModulationVerification[] = [];
  for (const item of entryDevice.modulators.filter((modulator) => modulator.behaviorCheck === 'active')) {
    behaviors.push(await verifyActiveModulation(
      host, item.location === 'device' ? deviceWitness.address : nested,
      item.target, options.wait ?? wait,
    ));
  }
  let containerPages: ModulatorPageVerification = {
    verified: true, actualPages: [], witnesses: [],
  };
  if (containerMods.length > 0) {
    const allOuterPages = request.entries.flatMap((item) => item.devices.flatMap((entryItem) =>
      entryItem.modulators.filter((mod) => mod.location === 'container').map((mod) => mod.pageName)));
    containerPages = await verifyPages(
      host, container, pageWitnesses(allOuterPages), options.wait ?? wait,
    );
    if (!containerPages.verified) {
      return { why: containerPages.why ?? 'The outer modulator pages did not read back.' };
    }
  }

  const preserved = beforeFingerprint === undefined
    ? undefined : sameFingerprint(beforeFingerprint, afterFingerprint);
  const instance = source.kind === 'existing-move' ? 'preserved' as const : 'new' as const;
  const sourceIdentity = source.kind === 'native'
    ? { kind: source.kind, exactCatalogName: source.name }
    : source.kind === 'vst3' ? { kind: source.kind, classUid: source.classUid }
      : source.kind === 'clap' ? { kind: source.kind, id: source.id }
        : source.kind === 'preset' ? { kind: source.kind, path: source.path, ...presetIdentity }
          : { kind: source.kind, originalDevicePosition: source.devicePosition };
  const verification: GeneralDeviceEntryVerification = {
    entryIndex, deviceIndex, entryName, sourceKind: source.kind, sourceIdentity,
    observed: { deviceName: observedName, enabled: observedEnabled, position: deviceIndex },
    instance,
    stateClaim: source.kind === 'existing-move'
      ? 'The same device instance moved. Opaque state was not read back byte for byte.'
      : source.kind === 'existing-copy'
        ? 'The copy is a new instance. No state-identity claim is made.'
        : 'The source created a new device instance.',
    scalarFingerprint: {
      ...(beforeFingerprint === undefined ? {} : { before: beforeFingerprint }),
      after: afterFingerprint,
      ...(preserved === undefined ? {} : { preserved }),
    },
    pages, containerPages, behaviors,
    verified: (preserved ?? true) && pages.verified && containerPages.verified
      && behaviors.length === entryDevice.modulators.filter((item) => item.behaviorCheck === 'active').length
      && behaviors.every((item) => item.verified),
  };
  return {
    checkpoint: {
      entryIndex, deviceIndex, entryName, sourceKind: source.kind,
      observedName, enabled: observedEnabled, fingerprint: afterFingerprint,
      ...(fingerprintLocation === undefined ? {} : { fingerprintLocation }),
      ...(ownedChangeId === undefined ? {} : { ownedChangeId }),
      ...(source.kind === 'existing-move' || source.kind === 'existing-copy'
        ? { originalPosition: source.devicePosition } : {}),
    },
    verification,
  };
}

/** Reverse completed source stages, then remove the proved empty owned container. */
export async function reverseGeneralDeviceSources(
  host: GeneralDeviceCompositionHost,
  checkpoint: GeneralDeviceCompositionCheckpoint,
  options: Pick<GeneralDeviceCompositionOptions, 'run'> = {},
): Promise<GeneralDeviceCompositionReversal> {
  const stages: GeneralDeviceStageReceipt[] = [];
  let progress = checkpoint;
  const failed = (stage: string, why?: string) =>
    reversalFailure(stage, stages, why, progress);
  try {
    if (progress.reversalContainerRemoved === true) {
      await stableTop(host, progress.track, progress.originalDeviceOrder);
      return { complete: true, stages, containerRemoved: true, restoredDeviceOrder: true };
    }
    let current: StableTop;
    if (checkpoint.pendingUnwitnessedSource !== undefined) {
      const pending = checkpoint.pendingUnwitnessedSource;
      current = await stableTop(host, checkpoint.track);
      const expected = projectedNestedTop(checkpoint, checkpoint.completedEntries);
      if (current.at.revision !== pending.at.revision
          || current.at.generation !== pending.at.generation
          || current.at.project !== pending.at.project
          || pending.chainIndex !== expected.length
          || current.devices.length !== expected.length + 1
          || JSON.stringify(current.devices.slice(0, -1).map((item) => ({
            name: item.name, enabled: item.enabled,
          }))) !== JSON.stringify(expected)) {
        return failed('reversal-boundary', 'The unwitnessed inserted source boundary changed.');
      }
      const tail = current.devices.length - 1;
      const removed = (await host.apply([{
        op: 'device.delete', device: device(checkpoint.track, tail),
        expectedName: current.devices[tail]!.name,
        expectedChain: names(current.devices), expectedEnabledChain: enabled(current.devices),
      }], {
        ...options.run, ifRevision: current.at.revision,
        clearance: ownChangesetReversal(pending.ownedChangeId),
      })).take;
      stages.push(receipt('remove-source', removed, pending.entryIndex));
      if (!accepted(removed)) return failed('remove-source');
      progress = {
        ...progress, pendingUnwitnessedSource: undefined,
        lastWriteAt: minimalMark(removed.verify.at),
      };
      current = await stableTopAfter(host, checkpoint.track, removed, expected);
    } else {
      current = await stableTop(host, checkpoint.track, projectedTopFromCheckpoint(checkpoint));
    }
    if (checkpoint.seedUnchanged
        && (checkpoint.state === 'container-inserted' || checkpoint.state === 'container-positioned')) {
      if (current.at.revision !== checkpoint.lastWriteAt.revision
          || current.at.generation !== checkpoint.lastWriteAt.generation
          || current.at.project !== checkpoint.lastWriteAt.project
          || current.devices[checkpoint.currentContainerPosition]?.name !== checkpoint.containerKind) {
        return failed('reversal-boundary', 'The untouched seed boundary changed.');
      }
      const removal = (await host.apply([{
        op: 'device.delete', device: device(checkpoint.track, checkpoint.currentContainerPosition),
        expectedName: checkpoint.containerKind,
        expectedChain: names(current.devices), expectedEnabledChain: enabled(current.devices),
      }], {
        ...options.run, ifRevision: current.at.revision,
        clearance: ownChangesetReversal(checkpoint.containerInsertTakeId),
      })).take;
      stages.push(receipt('remove-container', removal));
      if (!accepted(removal)) return failed('remove-container');
      progress = {
        ...progress, reversalContainerRemoved: true,
        lastWriteAt: minimalMark(removal.verify.at),
      };
      await stableTop(host, checkpoint.track, checkpoint.originalDeviceOrder);
      return { complete: true, stages, containerRemoved: true, restoredDeviceOrder: true };
    }
    let containerPosition = checkpoint.currentContainerPosition;
    if (checkpoint.state === 'container-inserted'
        && containerPosition !== checkpoint.requestedContainerPosition) {
      const positioning = (await host.apply([{
        op: 'device.relocate', track: checkpoint.track, sourceFromEnd: 0,
        expectedName: checkpoint.containerKind,
        before: device(checkpoint.track, checkpoint.requestedContainerPosition),
        expectedChain: names(current.devices), expectedEnabledChain: enabled(current.devices),
      }], { ...options.run, ifRevision: current.at.revision })).take;
      stages.push(receipt('position-container', positioning));
      if (!accepted(positioning)) return failed('position-container');
      progress = {
        ...progress, state: 'container-positioned',
        currentContainerPosition: checkpoint.requestedContainerPosition,
        lastWriteAt: minimalMark(positioning.verify.at),
      };
      containerPosition = checkpoint.requestedContainerPosition;
      current = await stableTopAfter(
        host, checkpoint.track, positioning, projectedNestedTop(checkpoint, []),
      );
    }
    const container = device(checkpoint.track, containerPosition);
    const nestedEntries = progress.reversalRemainingEntries ?? [
      ...checkpoint.completedEntries,
      ...(checkpoint.pendingEntry?.location === 'container-entry' ? [checkpoint.pendingEntry] : []),
    ];
    if (!await exactEntries(
      host, container, checkpoint.preparedEntryNames, nestedEntries, checkpoint.containerKind,
    )) {
      return failed('reversal-boundary', 'The owned container structure changed.');
    }

    if (checkpoint.pendingEntry?.location === 'top-level') {
      const item = checkpoint.pendingEntry;
      if (item.ownedChangeId === undefined) {
        return failed('remove-source', 'The pending owned source change is missing.');
      }
      const tail = current.devices.length - 1;
      const removed = (await host.apply([{
        op: 'device.delete', device: device(checkpoint.track, tail),
        expectedName: item.observedName,
        expectedChain: names(current.devices), expectedEnabledChain: enabled(current.devices),
      }], {
        ...options.run, ifRevision: current.at.revision,
        clearance: ownChangesetReversal(item.ownedChangeId),
      })).take;
      stages.push(receipt('remove-source', removed, item.entryIndex));
      if (!accepted(removed)) return failed('remove-source');
      progress = {
        ...progress, pendingEntry: undefined,
        lastWriteAt: minimalMark(removed.verify.at),
      };
      current = await stableTopAfter(
        host, checkpoint.track, removed, projectedNestedTop(checkpoint, nestedEntries),
      );
    }

    const remaining = [...nestedEntries];
    const resumed = progress.reversalPendingTopLevel;
    if (resumed !== undefined) {
      const position = resumed.position;
      const observed = current.devices[position];
      if (observed?.name !== resumed.observedName || observed.enabled !== resumed.enabled) {
        return failed('reversal-boundary', 'The extracted source boundary changed.');
      }
      if (resumed.sourceKind === 'existing-move') {
        const desired = desiredWithContainer(checkpoint, remaining);
        const desiredOrder = projectedNestedTop(checkpoint, remaining);
        const target = desired.findIndex((entry) =>
          entry.originalPosition === resumed.originalPosition && entry.restored);
        if (target < 0) return failed('restore-position', 'The original source position is missing.');
        if (target !== position) {
          const reordered = (await host.apply([{
            op: 'device.relocate', track: checkpoint.track,
            sourceFromEnd: current.devices.length - 1 - position,
            expectedName: resumed.observedName, before: device(checkpoint.track, target),
            expectedChain: names(current.devices), expectedEnabledChain: enabled(current.devices),
          }], { ...options.run, ifRevision: current.at.revision })).take;
          stages.push(receipt('restore-position', reordered, resumed.entryIndex));
          if (!accepted(reordered)) return failed('restore-position');
          progress = clearReversalPending(progress, reordered.verify.at);
          current = await stableTopAfter(host, checkpoint.track, reordered, desiredOrder);
        } else {
          progress = clearReversalPending(progress, current.at);
          current = await stableTop(host, checkpoint.track, desiredOrder);
        }
      } else {
        if (resumed.ownedChangeId === undefined) {
          return failed('remove-source', 'The owned source change is missing.');
        }
        const removed = (await host.apply([{
          op: 'device.delete', device: device(checkpoint.track, position),
          expectedName: resumed.observedName,
          expectedChain: names(current.devices), expectedEnabledChain: enabled(current.devices),
        }], {
          ...options.run, ifRevision: current.at.revision,
          clearance: ownChangesetReversal(resumed.ownedChangeId),
        })).take;
        stages.push(receipt('remove-source', removed, resumed.entryIndex));
        if (!accepted(removed)) return failed('remove-source');
        progress = clearReversalPending(progress, removed.verify.at);
        current = await stableTopAfter(
          host, checkpoint.track, removed, projectedNestedTop(checkpoint, remaining),
        );
      }
    }
    for (const item of [...remaining].reverse()) {
      const currentContainer = device(
        checkpoint.track, checkpointContainerPosition(checkpoint, remaining),
      );
      const nested = deviceIn(chain(currentContainer, item.entryName), item.deviceIndex);
      const fingerprintWitness = deviceModulationWitness(nested, item.fingerprintLocation);
      const inventory = await stableInventory(host, fingerprintWitness.address, wait, 80);
      if (inventory.name !== (fingerprintWitness.expectedName ?? item.observedName)
          || (item.fingerprint !== undefined
            && !sameFingerprint(fingerprint(inventory.params), item.fingerprint))) {
        return failed('reversal-boundary', `Entry ${item.entryIndex} changed.`);
      }
      current = await stableTop(host, checkpoint.track, projectedNestedTop(checkpoint, remaining));
      if (!sameMark(inventory.at, current.at)) {
        return failed('reversal-boundary', `Entry ${item.entryIndex} changed during inspection.`);
      }
      const extracted = (await host.apply([{
        op: 'chain.relocate', source: nested, destination: checkpoint.track, mode: 'move',
        expectedChain: names(current.devices), expectedEnabledChain: enabled(current.devices),
      }], { ...options.run, ifRevision: current.at.revision })).take;
      stages.push(receipt('extract-source', extracted, item.entryIndex));
      if (!accepted(extracted)) return failed('extract-source');
      const extractedOrder = [
        ...projectedNestedTop(checkpoint, remaining),
        { name: item.observedName, enabled: item.enabled },
      ];
      const nextRemaining = remaining.filter((candidate) => candidate !== item);
      progress = {
        ...progress,
        reversalRemainingEntries: nextRemaining,
        reversalPendingTopLevel: { ...item, position: extractedOrder.length - 1 },
        lastWriteAt: minimalMark(extracted.verify.at),
      };
      current = await stableTopAfter(host, checkpoint.track, extracted, extractedOrder);

      if (item.sourceKind === 'existing-move') {
        const desired = desiredWithContainer(checkpoint, nextRemaining);
        const desiredOrder = projectedNestedTop(checkpoint, nextRemaining);
        const target = desired.findIndex((entry) =>
          entry.originalPosition === item.originalPosition && entry.restored);
        if (target < current.devices.length - 1) {
          const reordered = (await host.apply([{
            op: 'device.relocate', track: checkpoint.track, sourceFromEnd: 0,
            expectedName: item.observedName, before: device(checkpoint.track, target),
            expectedChain: names(current.devices), expectedEnabledChain: enabled(current.devices),
          }], { ...options.run, ifRevision: current.at.revision })).take;
          stages.push(receipt('restore-position', reordered, item.entryIndex));
          if (!accepted(reordered)) return failed('restore-position');
          progress = clearReversalPending(progress, reordered.verify.at);
          current = await stableTopAfter(host, checkpoint.track, reordered, desiredOrder);
        } else {
          progress = clearReversalPending(progress, current.at);
          current = await stableTop(host, checkpoint.track, desiredOrder);
        }
      } else {
        if (item.ownedChangeId === undefined) {
          return failed('remove-source', 'The owned source change is missing.');
        }
        const tail = current.devices.length - 1;
        const removed = (await host.apply([{
          op: 'device.delete', device: device(checkpoint.track, tail),
          expectedName: item.observedName,
          expectedChain: names(current.devices), expectedEnabledChain: enabled(current.devices),
        }], {
          ...options.run, ifRevision: current.at.revision,
          clearance: ownChangesetReversal(item.ownedChangeId),
        })).take;
        stages.push(receipt('remove-source', removed, item.entryIndex));
        if (!accepted(removed)) return failed('remove-source');
        progress = clearReversalPending(progress, removed.verify.at);
        current = await stableTopAfter(
          host, checkpoint.track, removed, projectedNestedTop(checkpoint, nextRemaining),
        );
      }
      remaining.splice(0, remaining.length, ...nextRemaining);
    }

    current = await stableTop(host, checkpoint.track, projectedNestedTop(checkpoint, []));
    if (!await exactEntries(
      host, device(checkpoint.track, checkpoint.requestedContainerPosition),
      checkpoint.preparedEntryNames, [], checkpoint.containerKind,
    )) {
      return failed('remove-container', 'The owned container is not empty.');
    }
    const removal = (await host.apply([{
      op: 'device.delete', device: device(checkpoint.track, checkpoint.requestedContainerPosition),
      expectedName: checkpoint.containerKind,
      expectedChain: names(current.devices), expectedEnabledChain: enabled(current.devices),
    }], {
      ...options.run, ifRevision: current.at.revision,
      clearance: ownChangesetReversal(checkpoint.containerInsertTakeId),
    })).take;
    stages.push(receipt('remove-container', removal));
    if (!accepted(removal)) return failed('remove-container');
    progress = {
      ...progress, reversalContainerRemoved: true,
      lastWriteAt: minimalMark(removal.verify.at),
    };
    await stableTop(host, checkpoint.track, checkpoint.originalDeviceOrder);
    return { complete: true, stages, containerRemoved: true, restoredDeviceOrder: true };
  } catch (error) {
    return failed('reversal-boundary', message(error));
  }
}

interface StableTop {
  readonly at: RevisionMark;
  readonly devices: readonly ObservedDevice[];
  readonly bankSize: number;
}

async function stableTop(
  host: GeneralDeviceCompositionHost,
  track: TrackAddress,
  expected?: readonly GeneralDeviceOrderItem[],
): Promise<StableTop> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const before = await host.read([]);
    const bank = await host.devices(track);
    const after = await host.read([]);
    if (!sameMark(before.at, after.at)) {
      throw new Error('the project changed during device inspection');
    }
    if (bank.devicesComplete && bank.bankSize !== undefined
        && bank.devices.every((item, index) => item.index === index && item.enabled !== undefined)) {
      if (expected !== undefined && JSON.stringify(bank.devices.map((item) => ({
        name: item.name, enabled: item.enabled,
      }))) !== JSON.stringify(expected)) {
        throw new Error('the top-level device order or enabled state is stale');
      }
      return { at: after.at, devices: bank.devices, bankSize: bank.bankSize };
    }
    if (attempt < 19) await wait(200);
  }
  throw new Error('the complete ordered top-level device state did not settle');
}

async function stableTopAfter(
  host: GeneralDeviceCompositionHost,
  track: TrackAddress,
  take: Take,
  expected: readonly GeneralDeviceOrderItem[],
): Promise<StableTop> {
  const observed = await stableTop(host, track, expected);
  if (!sameMark(observed.at, take.verify.at)) {
    throw new Error('the project changed after the guarded stage');
  }
  return observed;
}

async function stableInventory(
  host: GeneralDeviceCompositionHost, address: DeviceAddress,
  pause: (milliseconds: number) => Promise<void> = wait,
  attempts = 40,
): Promise<{
  readonly at: RevisionMark;
  readonly name: string;
  readonly params: readonly ParamState[];
}> {
  const key = addressKey(address);
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const snapshot = await host.read([address]);
      const value = snapshot.entries[key]?.value;
      if (!snapshot.unreachable.some((item) => addressKey(item) === key)
          && !snapshot.unstable.some((item) => addressKey(item) === key)
          && value?.of === 'device' && value.device.params !== undefined
          && new Set(value.device.params.map((item) => item.id)).size === value.device.params.length) {
        return { at: snapshot.at, name: value.device.name, params: value.device.params };
      }
    } catch (error) {
      host.throwIfCancelled?.();
      lastError = error;
    }
    if (attempt < attempts - 1) await pause(250);
  }
  throw new Error(
    `the complete stable DirectParameter inventory did not settle${lastError === undefined ? '' : `: ${message(lastError)}`}`,
  );
}

async function verifyActiveModulation(
  host: GeneralDeviceCompositionHost,
  address: DeviceAddress,
  target: ModulationTarget,
  pause: (milliseconds: number) => Promise<void>,
): Promise<ModulationVerification> {
  let verification: ModulationVerification | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    verification = await verifyModulation(host, address, {
      ...target, inventoryAttempts: 40, inventoryRetryMs: 250,
    }, pause);
    if (verification.verified || !isTransientVerification(verification.why)) return verification;
    if (attempt < 2) await pause(250);
  }
  return verification!;
}

function isTransientVerification(why: string | undefined): boolean {
  return why !== undefined && (/did not settle|did not return the exact id|inventory failed|sample \d+ failed/.test(why));
}

async function exactEntries(
  host: GeneralDeviceCompositionHost,
  container: DeviceAddress,
  names: readonly string[],
  occupied: readonly Pick<GeneralDeviceCheckpointEntry,
  'entryIndex' | 'deviceIndex' | 'entryName' | 'observedName' | 'enabled'>[],
  containerKind: GeneralDeviceContainerKind,
): Promise<boolean> {
  const structure = await observedContainer(host, container, containerKind);
  const entries = structure === undefined ? undefined : observedEntries(structure, containerKind);
  if (entries === undefined || entries.length !== names.length) return false;
  return entries.every((entry, index) => {
    const expected = occupied.filter((item) => item.entryIndex === index)
      .sort((left, right) => left.deviceIndex - right.deviceIndex);
    return entry.name === names[index] && entry.sequence.devicesComplete
      && entry.sequence.devices.length === expected.length
      && entry.sequence.devices.every((item, deviceIndex) => item.index === deviceIndex
        && item.name === expected[deviceIndex]?.observedName
        && item.enabled === expected[deviceIndex]?.enabled);
  });
}

async function readStructure(
  host: GeneralDeviceCompositionHost,
  container: DeviceAddress,
  names: readonly string[],
  expected: readonly GeneralDeviceCheckpointEntry[],
  containerKind: GeneralDeviceContainerKind,
): Promise<GeneralDeviceCompositionResult['structure'] | undefined> {
  const structure = await observedContainer(host, container, containerKind);
  const entries = structure === undefined ? undefined : observedEntries(structure, containerKind);
  if (entries === undefined || entries.length !== names.length) return undefined;
  if (entries.some((entry, entryIndex) => {
    const wanted = expected.filter((item) => item.entryIndex === entryIndex)
      .sort((left, right) => left.deviceIndex - right.deviceIndex);
    return entry.name !== names[entryIndex] || !entry.sequence.devicesComplete
      || entry.sequence.devices.length !== wanted.length
      || entry.sequence.devices.some((item, deviceIndex) => item.index !== deviceIndex
        || item.name !== wanted[deviceIndex]?.observedName
        || item.enabled !== wanted[deviceIndex]?.enabled);
  })) return undefined;
  return entries.map((entry, entryIndex) => ({
    entryIndex, entryName: entry.name,
    devices: entry.sequence.devices.map((item) => ({
      position: item.index, name: item.name, enabled: item.enabled as boolean,
    })),
  }));
}

async function observedContainer(
  host: GeneralDeviceCompositionHost,
  container: DeviceAddress,
  containerKind: GeneralDeviceContainerKind,
): Promise<ObservedContainer | undefined> {
  const snapshot = await host.read([container]);
  const value = snapshot.entries[addressKey(container)]?.value;
  if (value?.of !== 'device' || value.device.name !== containerKind) return undefined;
  return value.device.container;
}

function observedEntries(
  structure: ObservedContainer,
  containerKind: GeneralDeviceContainerKind,
): readonly { readonly name: string; readonly sequence: ObservedDeviceSequence }[] | undefined {
  if (!structure.chainsComplete) return undefined;
  return structure.chains.map((entry) => ({ name: entry.name, sequence: entry }));
}

function assertRequest(request: GeneralDeviceCompositionRequest, topBankSize: number): void {
  if (!Number.isInteger(request.containerPosition) || request.containerPosition < 0
      || request.containerPosition >= GENERAL_DEVICE_COMPOSITION_CAPACITIES.topLevelContainerPositions
      || request.containerPosition > request.expectedDeviceOrder.length) {
    throw new Error('containerPosition is outside the complete top-level container scope');
  }
  const maxEntries = GENERAL_DEVICE_COMPOSITION_CAPACITIES.entriesPerLayer;
  if (request.entries.length < 1 || request.entries.length > maxEntries) {
    throw new Error(`the container accepts one through ${maxEntries} entries`);
  }
  const entryNames = request.entries.map((item) => item.entryName);
  if (new Set(entryNames).size !== entryNames.length) throw new Error('each entry name must be unique');
  if (request.expectedDeviceOrder.length + 1 > topBankSize) {
    throw new Error('the top-level device bank has no room for the owned container');
  }
  const devices = request.entries.flatMap((entry) => entry.devices);
  if (devices.some((item) => item.source.kind !== 'existing-move')
      && request.expectedDeviceOrder.length + 2 > topBankSize) {
    throw new Error('the top-level device bank has no scratch slot for exact reversal');
  }
  for (const entry of request.entries) {
    if (entry.devices.length < 1
        || entry.devices.length > GENERAL_DEVICE_COMPOSITION_CAPACITIES.devicesPerEntry) {
      throw new Error('each entry accepts one through four ordered devices');
    }
    for (const entryDevice of entry.devices) {
      if (entryDevice.source.kind === 'preset'
          && entryDevice.source.modulatorLocation?.kind === 'entry'
          && 1 + entryDevice.source.modulatorLocation.devicePath.length
            > GENERAL_DEVICE_COMPOSITION_CAPACITIES.parameterRouteDepth) {
        throw new Error('the total preset device route exceeds the supported depth of two');
      }
      if (entryDevice.source.kind !== 'preset'
          && entryDevice.modulators.some((item) => item.location === 'device')) {
        throw new Error('device-local modulator authoring requires an explicit preset source');
      }
      if ((entryDevice.source.kind === 'existing-move' || entryDevice.source.kind === 'existing-copy')
          && request.expectedDeviceOrder[entryDevice.source.devicePosition] === undefined) {
        throw new Error('an existing source position is missing from expectedDeviceOrder');
      }
    }
  }
  const moved = devices.filter((item) => item.source.kind === 'existing-move')
    .map((item) => (item.source as Extract<GeneralDeviceSourceRequest, { kind: 'existing-move' }>).devicePosition);
  if (new Set(moved).size !== moved.length) throw new Error('one existing device cannot move twice');
  const alreadyMoved = new Set<number>();
  for (const entry of devices) {
    if ((entry.source.kind === 'existing-move' || entry.source.kind === 'existing-copy')
        && alreadyMoved.has(entry.source.devicePosition)) {
      throw new Error('an existing source cannot be used again after it moves');
    }
    if (entry.source.kind === 'existing-move') alreadyMoved.add(entry.source.devicePosition);
  }
}

function currentExistingPosition(
  request: GeneralDeviceCompositionRequest,
  original: number,
  completed: readonly GeneralDeviceCheckpointEntry[],
): number {
  return topTokens(
    request.expectedDeviceOrder, request.containerKind, request.containerPosition, completed,
  ).findIndex((item) => item.originalPosition === original);
}

function projectedTop(
  request: GeneralDeviceCompositionRequest, completed: readonly GeneralDeviceCheckpointEntry[],
): GeneralDeviceOrderItem[] {
  return topTokens(
    request.expectedDeviceOrder, request.containerKind, request.containerPosition, completed,
  ).map((item) => item.order);
}

function projectedTopFromCheckpoint(
  checkpoint: GeneralDeviceCompositionCheckpoint,
): GeneralDeviceOrderItem[] {
  if (checkpoint.reversalContainerRemoved === true) return [...checkpoint.originalDeviceOrder];
  if (checkpoint.state === 'container-inserted') {
    return [...checkpoint.originalDeviceOrder, { name: checkpoint.containerKind, enabled: true }];
  }
  const effective = checkpoint.reversalRemainingEntries ?? [
    ...checkpoint.completedEntries,
    ...(checkpoint.pendingEntry?.location === 'container-entry' ? [checkpoint.pendingEntry] : []),
  ];
  const pendingReversal = checkpoint.reversalPendingTopLevel;
  const base = topTokens(
    checkpoint.originalDeviceOrder, checkpoint.containerKind,
    checkpoint.requestedContainerPosition,
    pendingReversal === undefined ? effective : [...effective, pendingReversal],
  ).map((item) => item.order);
  if (pendingReversal !== undefined) {
    base.splice(pendingReversal.position, 0, {
      name: pendingReversal.observedName, enabled: pendingReversal.enabled,
    });
    return base;
  }
  return checkpoint.pendingEntry?.location === 'top-level'
    ? [...base, {
      name: checkpoint.pendingEntry.observedName, enabled: checkpoint.pendingEntry.enabled,
    }]
    : base;
}

function projectedNestedTop(
  checkpoint: GeneralDeviceCompositionCheckpoint,
  remaining: readonly GeneralDeviceCheckpointEntry[],
): GeneralDeviceOrderItem[] {
  return topTokens(
    checkpoint.originalDeviceOrder, checkpoint.containerKind,
    checkpoint.requestedContainerPosition, remaining,
  ).map((item) => item.order);
}

function desiredWithContainer(
  checkpoint: GeneralDeviceCompositionCheckpoint,
  remaining: readonly GeneralDeviceCheckpointEntry[],
): readonly { readonly originalPosition?: number; readonly restored: boolean }[] {
  return topTokens(
    checkpoint.originalDeviceOrder, checkpoint.containerKind,
    checkpoint.requestedContainerPosition, remaining,
  ).map((item) => ({ ...item, restored: true }));
}

function withContainer(
  order: readonly GeneralDeviceOrderItem[], request: GeneralDeviceCompositionRequest,
): GeneralDeviceOrderItem[] {
  return topTokens(order, request.containerKind, request.containerPosition, []).map((item) => item.order);
}

function containerPosition(
  request: GeneralDeviceCompositionRequest,
  completed: readonly GeneralDeviceCheckpointEntry[],
): number {
  return topTokens(
    request.expectedDeviceOrder, request.containerKind, request.containerPosition, completed,
  ).findIndex((item) => item.container);
}

function checkpointContainerPosition(
  checkpoint: GeneralDeviceCompositionCheckpoint,
  nested: readonly GeneralDeviceCheckpointEntry[],
): number {
  return topTokens(
    checkpoint.originalDeviceOrder, checkpoint.containerKind,
    checkpoint.requestedContainerPosition, nested,
  ).findIndex((item) => item.container);
}

function topTokens(
  original: readonly GeneralDeviceOrderItem[],
  containerKind: GeneralDeviceContainerKind,
  requestedPosition: number,
  nested: readonly GeneralDeviceCheckpointEntry[],
): { readonly order: GeneralDeviceOrderItem; readonly container: boolean; readonly originalPosition?: number }[] {
  const moved = new Set(nested.filter((item) => item.sourceKind === 'existing-move')
    .map((item) => item.originalPosition));
  const tokens: {
    order: GeneralDeviceOrderItem; container: boolean; originalPosition?: number;
  }[] = original.map((order, originalPosition) => ({ order, container: false, originalPosition }));
  tokens.splice(requestedPosition, 0, {
    order: { name: containerKind, enabled: true }, container: true,
  });
  return tokens.filter((item) => item.container || !moved.has(item.originalPosition));
}

function fingerprint(params: readonly ParamState[]): GeneralDeviceFingerprint {
  const body = params.map((item) => [item.id, item.name, item.value.toFixed(10)]);
  return {
    algorithm: 'sha256',
    sha256: createHash('sha256').update(JSON.stringify(body)).digest('hex'),
    parameterCount: params.length,
  };
}

function sameFingerprint(left: GeneralDeviceFingerprint, right: GeneralDeviceFingerprint): boolean {
  return left.algorithm === right.algorithm && left.sha256 === right.sha256
    && left.parameterCount === right.parameterCount;
}

function receipt(
  stage: GeneralDeviceStageReceipt['stage'], take: Take, entryIndex?: number,
): GeneralDeviceStageReceipt {
  return { stage, ...(entryIndex === undefined ? {} : { entryIndex }), changeId: take.id, applied: accepted(take) };
}

function accepted(take: Take): boolean {
  return take.receipt.accepted && take.report.rejected === undefined
    && take.report.failed.length === 0 && take.report.disagreements.length === 0;
}

function pageWitnesses(pages: readonly string[]): { pageName: string; expectedCount: number }[] {
  return [...new Set(pages)].map((pageName) => ({
    pageName, expectedCount: pages.filter((item) => item === pageName).length,
  }));
}

function deviceModulationWitness(
  sourceRoot: DeviceAddress,
  location: SemanticModulatorLocation | undefined,
): { readonly address: DeviceAddress; readonly expectedName?: string } {
  if (location?.kind !== 'entry') {
    return { address: sourceRoot };
  }
  const selected = location.devicePath[0];
  if (selected === undefined) return { address: sourceRoot };
  return {
    address: deviceIn(chain(sourceRoot, selected.name), selected.position),
    expectedName: selected.name,
  };
}

function failure(
  failedStage: string, why: string,
  stages: readonly GeneralDeviceStageReceipt[], entries: readonly GeneralDeviceEntryVerification[],
  checkpoint?: GeneralDeviceCompositionCheckpoint,
): GeneralDeviceCompositionResult {
  return {
    complete: false, failedStage, why, stages, entries,
    capacities: GENERAL_DEVICE_COMPOSITION_CAPACITIES,
    ...(checkpoint === undefined ? {} : { checkpoint }),
  };
}

function reversalFailure(
  failedStage: string, stages: readonly GeneralDeviceStageReceipt[],
  why = 'The guarded reversal stage was not proved.',
  checkpoint?: GeneralDeviceCompositionCheckpoint,
): GeneralDeviceCompositionReversal {
  return {
    complete: false, failedStage, why, stages,
    containerRemoved: checkpoint?.reversalContainerRemoved === true,
    restoredDeviceOrder: false,
    ...(checkpoint === undefined ? {} : { checkpoint }),
  };
}

function clearReversalPending(
  checkpoint: GeneralDeviceCompositionCheckpoint,
  at: RevisionMark,
): GeneralDeviceCompositionCheckpoint {
  const { reversalPendingTopLevel: _pending, ...rest } = checkpoint;
  return { ...rest, lastWriteAt: minimalMark(at) };
}

function uniqueTemporaryNames(names: readonly string[], count: number): string[] {
  const reserved = new Set(names);
  return Array.from({ length: count }, (_, index) => {
    let name = `ghostnote pending general entry ${index + 1}`;
    while (reserved.has(name)) name += ' pending';
    reserved.add(name);
    return name;
  });
}

function names(devices: readonly ObservedDevice[]): string[] {
  return devices.map((item) => item.name);
}

function enabled(devices: readonly ObservedDevice[]): boolean[] {
  return devices.map((item) => item.enabled as boolean);
}

function sameMark(left: RevisionMark, right: RevisionMark): boolean {
  return left.revision === right.revision && left.sceneEpoch === right.sceneEpoch
    && left.contentEpoch === right.contentEpoch && left.generation === right.generation
    && left.project === right.project;
}

function minimalMark(mark: RevisionMark): GeneralDeviceCompositionCheckpoint['lastWriteAt'] {
  return { revision: mark.revision, generation: mark.generation, project: mark.project };
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function wait(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}
