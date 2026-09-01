/** Guarded composition and reversal for general device sources. */
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  composeGeneralDeviceContainerPreset, EXISTING_DEVICE_WRAPPER_KIND,
  type GeneralDeviceContainerModulation,
} from '../composition/index.js';
import {
  addressKey, chain, device, deviceIn,
  type Address, type DeviceAddress, type DeviceSource, type ObservedDevice,
  type ObservedDeviceBank, type Op, type ParamState, type RevisionMark,
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

export interface GeneralDeviceEntryRequest {
  readonly entryName: string;
  readonly source: GeneralDeviceSourceRequest;
  readonly modulators: readonly GeneralDeviceModulationRequest[];
}

export interface GeneralDeviceCompositionRequest {
  readonly track: TrackAddress;
  readonly expectedDeviceOrder: readonly GeneralDeviceOrderItem[];
  readonly containerKind: typeof EXISTING_DEVICE_WRAPPER_KIND;
  readonly entries: readonly GeneralDeviceEntryRequest[];
}

export interface GeneralDeviceFingerprint {
  readonly algorithm: 'sha256';
  readonly sha256: string;
  readonly parameterCount: number;
}

export interface GeneralDeviceStageReceipt {
  readonly stage: 'insert-container' | 'position-container' | 'prepare-entry-name'
    | 'confirm-entry-name' | 'create-entry' | 'insert-source' | 'relocate-source'
    | 'extract-source' | 'restore-position' | 'remove-source' | 'remove-container';
  readonly entryIndex?: number;
  readonly changeId: string;
  readonly applied: boolean;
}

export interface GeneralDeviceCheckpointEntry {
  readonly entryIndex: number;
  readonly entryName: string;
  readonly sourceKind: GeneralDeviceSourceRequest['kind'];
  readonly observedName: string;
  readonly enabled: boolean;
  readonly fingerprint?: GeneralDeviceFingerprint;
  readonly ownedChangeId?: string;
  readonly originalPosition?: number;
}

export interface GeneralDeviceCompositionCheckpoint {
  readonly schemaVersion: 1;
  readonly state: 'container-inserted' | 'container-positioned' | 'entries-prepared' | 'composing';
  readonly track: TrackAddress;
  readonly containerKind: typeof EXISTING_DEVICE_WRAPPER_KIND;
  readonly containerInsertTakeId: string;
  readonly insertedContainerPosition: number;
  readonly currentContainerPosition: number;
  readonly originalDeviceOrder: readonly GeneralDeviceOrderItem[];
  readonly entryNames: readonly string[];
  readonly preparedEntryNames: readonly string[];
  readonly completedEntries: readonly GeneralDeviceCheckpointEntry[];
  readonly pendingEntry?: GeneralDeviceCheckpointEntry & {
    readonly location: 'top-level' | 'container-entry';
  };
}

export interface GeneralDeviceEntryVerification {
  readonly entryIndex: number;
  readonly entryName: string;
  readonly sourceKind: GeneralDeviceSourceRequest['kind'];
  readonly sourceIdentity: Record<string, unknown>;
  readonly observed: { readonly deviceName: string; readonly enabled: boolean; readonly position: 0 };
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
}

export interface GeneralDeviceCompositionOptions {
  readonly run?: Omit<RunOptions, 'ifRevision'>;
  readonly wait?: (milliseconds: number) => Promise<void>;
  readonly tempRoot?: string;
  readonly templatePath?: string;
  readonly manifestPath?: string;
}

/** Compose ordered sources inside one owned FX Layer and prove each stage. */
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
      (entry, entryIndex) => entry.modulators
        .filter((item) => item.location === 'container')
        .map((item) => ({
          entryIndex, modulator: item.modulator, target: item.target, amount: item.amount,
        })),
    );
    const containerPreset = await composeGeneralDeviceContainerPreset(outerRequests, {
      ...(options.templatePath === undefined ? {} : { templatePath: options.templatePath }),
      ...(options.manifestPath === undefined ? {} : { manifestPath: options.manifestPath }),
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
        schemaVersion: 1, state: 'container-inserted', track: request.track,
        containerKind: request.containerKind, containerInsertTakeId: insertion.id,
        insertedContainerPosition: minted.chainIndex, currentContainerPosition: minted.chainIndex,
        originalDeviceOrder: request.expectedDeviceOrder,
        entryNames: request.entries.map((item) => item.entryName),
        preparedEntryNames: ['Layer 1'], completedEntries: [],
      };

      const inserted = await stableTop(host, request.track, [
        ...request.expectedDeviceOrder, { name: request.containerKind, enabled: true },
      ]);
      if (minted.chainIndex > 0) {
        failedStage = 'position-container';
        const positioning = (await host.apply([{
          op: 'device.relocate', track: request.track, sourceFromEnd: 0,
          expectedName: request.containerKind, before: device(request.track, 0),
          expectedChain: names(inserted.devices), expectedEnabledChain: enabled(inserted.devices),
        }], { ...options.run, ifRevision: inserted.at.revision })).take;
        stages.push(receipt('position-container', positioning));
        if (!accepted(positioning)) {
          return failure(failedStage, 'The owned container position was not proved.', stages, verified, checkpoint);
        }
      }
      checkpoint = { ...checkpoint, state: 'container-positioned', currentContainerPosition: 0 };
      let current = await stableTop(host, request.track, [
        { name: request.containerKind, enabled: true }, ...request.expectedDeviceOrder,
      ]);
      const container = device(request.track, 0);
      if (!await exactEntries(host, container, ['Layer 1'], [])) {
        return failure('container-witness', 'The owned seed entry was not empty and complete.', stages, verified, checkpoint);
      }

      const temporaryName = uniqueTemporaryName(request.entries.map((item) => item.entryName));
      failedStage = 'prepare-entries';
      const prepare = (await host.apply([{
        op: 'chain.rename', chain: chain(container, 'Layer 1'), name: temporaryName,
      }], { ...options.run, ifRevision: current.at.revision })).take;
      stages.push(receipt('prepare-entry-name', prepare));
      if (!accepted(prepare)) {
        return failure('prepare-entries', 'The temporary entry name was not proved.', stages, verified, checkpoint);
      }
      checkpoint = { ...checkpoint, preparedEntryNames: [temporaryName] };
      current = await stableTop(host, request.track);
      const confirm = (await host.apply([{
        op: 'chain.rename', chain: chain(container, temporaryName), name: request.entries[0]!.entryName,
      }], { ...options.run, ifRevision: current.at.revision })).take;
      stages.push(receipt('confirm-entry-name', confirm, 0));
      if (!accepted(confirm)) {
        return failure('prepare-entries', 'The first explicit entry name was not proved.', stages, verified, checkpoint);
      }
      checkpoint = { ...checkpoint, preparedEntryNames: [request.entries[0]!.entryName] };
      for (let index = 1; index < request.entries.length; index++) {
        current = await stableTop(host, request.track);
        const created = (await host.apply([{
          op: 'chain.create', source: chain(container, request.entries[index - 1]!.entryName),
          name: request.entries[index]!.entryName,
        }], { ...options.run, ifRevision: current.at.revision })).take;
        stages.push(receipt('create-entry', created, index));
        if (!accepted(created)) {
          return failure('prepare-entries', `Entry ${index} was not created.`, stages, verified, checkpoint);
        }
        checkpoint = {
          ...checkpoint,
          preparedEntryNames: [...checkpoint.preparedEntryNames, request.entries[index]!.entryName],
        };
      }
      if (!await exactEntries(host, container, checkpoint.preparedEntryNames, [])) {
        return failure('prepare-entries', 'The complete empty entry order did not read back.', stages, verified, checkpoint);
      }
      checkpoint = { ...checkpoint, state: 'entries-prepared' };

      for (const [entryIndex, entry] of request.entries.entries()) {
        failedStage = `source-${entryIndex}`;
        const completed = await addEntry(
          host, request, entry, entryIndex, directory, checkpoint, stages,
          options,
          (pendingEntry) => {
            checkpoint = { ...checkpoint!, state: 'composing', pendingEntry };
          },
        );
        if ('why' in completed) {
          return failure(failedStage, completed.why, stages, verified, checkpoint);
        }
        verified.push(completed.verification);
        checkpoint = {
          ...checkpoint, state: 'composing',
          completedEntries: [...checkpoint.completedEntries, completed.checkpoint],
          pendingEntry: undefined,
        };
      }

      const structure = await readStructure(
        host, container, checkpoint.entryNames, checkpoint.completedEntries,
      );
      const complete = structure !== undefined && verified.every((item) => item.verified);
      return {
        complete,
        ...(complete ? {} : {
          failedStage: 'final-witness',
          why: 'The complete structure or one modulation witness did not pass.',
        }),
        stages, checkpoint, entries: verified,
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
  entry: GeneralDeviceEntryRequest,
  entryIndex: number,
  directory: string,
  checkpoint: GeneralDeviceCompositionCheckpoint,
  stages: GeneralDeviceStageReceipt[],
  options: GeneralDeviceCompositionOptions,
  onPending: (
    entry: GeneralDeviceCheckpointEntry & { readonly location: 'top-level' | 'container-entry' },
  ) => void,
): Promise<{ readonly why: string } | {
  readonly checkpoint: GeneralDeviceCheckpointEntry;
  readonly verification: GeneralDeviceEntryVerification;
}> {
  const container = device(request.track, 0);
  const source = entry.source;
  let top = await stableTop(host, request.track, projectedTop(request, checkpoint.completedEntries));
  let sourcePosition: number;
  let observedName: string;
  let observedEnabled: boolean;
  let ownedChangeId: string | undefined;
  let beforeFingerprint: GeneralDeviceFingerprint | undefined;
  let presetIdentity: Record<string, unknown> = {};

  if (source.kind === 'existing-move' || source.kind === 'existing-copy') {
    sourcePosition = currentExistingPosition(source.devicePosition, checkpoint.completedEntries);
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
      const deviceMods = entry.modulators.filter((item) => item.location === 'device');
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
        path = join(directory, `${entryIndex}-${basename(source.path)}`);
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
    top = await stableTop(host, request.track);
    const observed = top.devices[sourcePosition];
    if (observed === undefined || observed.enabled === undefined) {
      return { why: 'The inserted source name and enabled state did not read back.' };
    }
    observedName = observed.name;
    observedEnabled = observed.enabled;
    if (source.kind === 'preset') {
      const metadataName = presetIdentity['presetMetadataName'];
      presetIdentity = {
        ...presetIdentity,
        observedDeviceName: observedName,
        nameMatchesPresetMetadata: typeof metadataName === 'string'
          ? metadataName === observedName : 'not-observed',
      };
    }
    onPending({
      entryIndex, entryName: entry.entryName, sourceKind: source.kind,
      observedName, enabled: observedEnabled, ownedChangeId, location: 'top-level',
    });
  }

  top = await stableTop(host, request.track);
  const relocation = (await host.apply([{
    op: 'chain.relocate', source: device(request.track, sourcePosition),
    destination: chain(container, entry.entryName),
    mode: source.kind === 'existing-copy' ? 'copy' : 'move',
    expectedChain: names(top.devices), expectedEnabledChain: enabled(top.devices),
  }], { ...options.run, ifRevision: top.at.revision })).take;
  stages.push(receipt('relocate-source', relocation, entryIndex));
  if (!accepted(relocation)) return { why: 'The source relocation was not proved.' };
  if (source.kind === 'existing-copy') ownedChangeId = relocation.id;
  onPending({
    entryIndex, entryName: entry.entryName, sourceKind: source.kind,
    observedName, enabled: observedEnabled,
    ...(beforeFingerprint === undefined ? {} : { fingerprint: beforeFingerprint }),
    ...(ownedChangeId === undefined ? {} : { ownedChangeId }),
    ...(source.kind === 'existing-move' || source.kind === 'existing-copy'
      ? { originalPosition: source.devicePosition } : {}),
    location: 'container-entry',
  });

  const nested = deviceIn(chain(container, entry.entryName), 0);
  const inventory = await stableInventory(host, nested, options.wait ?? wait);
  const afterFingerprint = fingerprint(inventory.params);
  const expectedEntries = [...checkpoint.completedEntries.map((item) => ({
    name: item.entryName, device: { name: item.observedName, enabled: item.enabled },
  })), { name: entry.entryName, device: { name: observedName, enabled: observedEnabled } }];
  if (!await exactEntries(host, container, checkpoint.entryNames, expectedEntries)) {
    return { why: 'The complete entry and device order did not read back.' };
  }

  const deviceMods = entry.modulators.filter((item) => item.location === 'device');
  const containerMods = entry.modulators.filter((item) => item.location === 'container');
  const relevantPages = deviceMods.map((item) => item.pageName);
  const pages = relevantPages.length === 0
    ? { verified: true, actualPages: [], witnesses: [] }
    : await verifyPages(host, nested, pageWitnesses(relevantPages), options.wait ?? wait);
  const behaviors: ModulationVerification[] = [];
  for (const item of entry.modulators.filter((modulator) => modulator.behaviorCheck === 'active')) {
    behaviors.push(await verifyActiveModulation(
      host, nested, item.target, options.wait ?? wait,
    ));
  }
  let containerPages: ModulatorPageVerification = {
    verified: true, actualPages: [], witnesses: [],
  };
  if (containerMods.length > 0) {
    const allOuterPages = request.entries.flatMap((item) =>
      item.modulators.filter((mod) => mod.location === 'container').map((mod) => mod.pageName));
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
    entryIndex, entryName: entry.entryName, sourceKind: source.kind, sourceIdentity,
    observed: { deviceName: observedName, enabled: observedEnabled, position: 0 },
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
      && behaviors.length === entry.modulators.filter((item) => item.behaviorCheck === 'active').length
      && behaviors.every((item) => item.verified),
  };
  return {
    checkpoint: {
      entryIndex, entryName: entry.entryName, sourceKind: source.kind,
      observedName, enabled: observedEnabled, fingerprint: afterFingerprint,
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
  try {
    let current = await stableTop(host, checkpoint.track, projectedTopFromCheckpoint(checkpoint));
    let containerPosition = checkpoint.currentContainerPosition;
    if (checkpoint.state === 'container-inserted' && containerPosition > 0) {
      const positioning = (await host.apply([{
        op: 'device.relocate', track: checkpoint.track, sourceFromEnd: 0,
        expectedName: checkpoint.containerKind, before: device(checkpoint.track, 0),
        expectedChain: names(current.devices), expectedEnabledChain: enabled(current.devices),
      }], { ...options.run, ifRevision: current.at.revision })).take;
      stages.push(receipt('position-container', positioning));
      if (!accepted(positioning)) return reversalFailure('position-container', stages);
      containerPosition = 0;
      current = await stableTopAfter(host, checkpoint.track, positioning, [
        { name: checkpoint.containerKind, enabled: true }, ...checkpoint.originalDeviceOrder,
      ]);
    }
    const container = device(checkpoint.track, containerPosition);
    const nestedEntries = [
      ...checkpoint.completedEntries,
      ...(checkpoint.pendingEntry?.location === 'container-entry' ? [checkpoint.pendingEntry] : []),
    ];
    const expectedNested = nestedEntries.map((item) => ({
      name: item.entryName, device: { name: item.observedName, enabled: item.enabled },
    }));
    if (!await exactEntries(host, container, checkpoint.preparedEntryNames, expectedNested)) {
      return reversalFailure('reversal-boundary', stages, 'The owned container structure changed.');
    }

    if (checkpoint.pendingEntry?.location === 'top-level') {
      const item = checkpoint.pendingEntry;
      if (item.ownedChangeId === undefined) {
        return reversalFailure('remove-source', stages, 'The pending owned source change is missing.');
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
      if (!accepted(removed)) return reversalFailure('remove-source', stages);
      current = await stableTopAfter(
        host, checkpoint.track, removed, projectedNestedTop(checkpoint, nestedEntries),
      );
    }

    const remaining = [...nestedEntries];
    for (const item of [...remaining].reverse()) {
      const nested = deviceIn(chain(container, item.entryName), 0);
      const inventory = await stableInventory(host, nested, wait, 80);
      if (inventory.name !== item.observedName
          || (item.fingerprint !== undefined
            && !sameFingerprint(fingerprint(inventory.params), item.fingerprint))) {
        return reversalFailure('reversal-boundary', stages, `Entry ${item.entryIndex} changed.`);
      }
      current = await stableTop(host, checkpoint.track, projectedNestedTop(checkpoint, remaining));
      if (!sameMark(inventory.at, current.at)) {
        return reversalFailure(
          'reversal-boundary', stages, `Entry ${item.entryIndex} changed during inspection.`,
        );
      }
      const extracted = (await host.apply([{
        op: 'chain.relocate', source: nested, destination: checkpoint.track, mode: 'move',
        expectedChain: names(current.devices), expectedEnabledChain: enabled(current.devices),
      }], { ...options.run, ifRevision: current.at.revision })).take;
      stages.push(receipt('extract-source', extracted, item.entryIndex));
      if (!accepted(extracted)) return reversalFailure('extract-source', stages);
      const extractedOrder = [
        ...projectedNestedTop(checkpoint, remaining),
        { name: item.observedName, enabled: item.enabled },
      ];
      current = await stableTopAfter(host, checkpoint.track, extracted, extractedOrder);

      if (item.sourceKind === 'existing-move') {
        remaining.splice(remaining.indexOf(item), 1);
        const desired = desiredWithContainer(checkpoint, remaining);
        const desiredOrder = projectedNestedTop(checkpoint, remaining);
        const target = desired.findIndex((entry) =>
          entry.originalPosition === item.originalPosition && entry.restored);
        if (target < current.devices.length - 1) {
          const reordered = (await host.apply([{
            op: 'device.relocate', track: checkpoint.track, sourceFromEnd: 0,
            expectedName: item.observedName, before: device(checkpoint.track, target),
            expectedChain: names(current.devices), expectedEnabledChain: enabled(current.devices),
          }], { ...options.run, ifRevision: current.at.revision })).take;
          stages.push(receipt('restore-position', reordered, item.entryIndex));
          if (!accepted(reordered)) return reversalFailure('restore-position', stages);
          current = await stableTopAfter(host, checkpoint.track, reordered, desiredOrder);
        } else {
          current = await stableTop(host, checkpoint.track, desiredOrder);
        }
      } else {
        if (item.ownedChangeId === undefined) {
          return reversalFailure('remove-source', stages, 'The owned source change is missing.');
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
        if (!accepted(removed)) return reversalFailure('remove-source', stages);
        remaining.splice(remaining.indexOf(item), 1);
        current = await stableTopAfter(
          host, checkpoint.track, removed, projectedNestedTop(checkpoint, remaining),
        );
      }
    }

    current = await stableTop(host, checkpoint.track, [
      { name: checkpoint.containerKind, enabled: true }, ...checkpoint.originalDeviceOrder,
    ]);
    if (!await exactEntries(host, device(checkpoint.track, 0), checkpoint.preparedEntryNames, [])) {
      return reversalFailure('remove-container', stages, 'The owned container is not empty.');
    }
    const removal = (await host.apply([{
      op: 'device.delete', device: device(checkpoint.track, 0),
      expectedName: checkpoint.containerKind,
      expectedChain: names(current.devices), expectedEnabledChain: enabled(current.devices),
    }], {
      ...options.run, ifRevision: current.at.revision,
      clearance: ownChangesetReversal(checkpoint.containerInsertTakeId),
    })).take;
    stages.push(receipt('remove-container', removal));
    if (!accepted(removal)) return reversalFailure('remove-container', stages);
    await stableTop(host, checkpoint.track, checkpoint.originalDeviceOrder);
    return { complete: true, stages, containerRemoved: true, restoredDeviceOrder: true };
  } catch (error) {
    return reversalFailure('reversal-boundary', stages, message(error));
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
          && value.device.params.length > 0
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
  occupied: readonly { readonly name: string; readonly device: GeneralDeviceOrderItem }[],
): Promise<boolean> {
  const snapshot = await host.read([container]);
  const value = snapshot.entries[addressKey(container)]?.value;
  const structure = value?.of === 'device' ? value.device.container : undefined;
  if (value?.of !== 'device' || value.device.name !== EXISTING_DEVICE_WRAPPER_KIND
      || structure?.chainsComplete !== true || structure.chains.length !== names.length) return false;
  return structure.chains.every((entry, index) => {
    const expected = occupied.find((item) => item.name === names[index]);
    return entry.index === index && entry.name === names[index] && entry.devicesComplete
      && entry.devices.length === (expected === undefined ? 0 : 1)
      && (expected === undefined || (entry.devices[0]?.index === 0
        && entry.devices[0]?.name === expected.device.name
        && entry.devices[0]?.enabled === expected.device.enabled));
  });
}

async function readStructure(
  host: GeneralDeviceCompositionHost,
  container: DeviceAddress,
  names: readonly string[],
  expected: readonly GeneralDeviceCheckpointEntry[],
): Promise<GeneralDeviceCompositionResult['structure'] | undefined> {
  const snapshot = await host.read([container]);
  const value = snapshot.entries[addressKey(container)]?.value;
  const structure = value?.of === 'device' ? value.device.container : undefined;
  if (value?.of !== 'device' || value.device.name !== EXISTING_DEVICE_WRAPPER_KIND
      || structure?.chainsComplete !== true || structure.chains.length !== names.length
      || expected.length !== names.length) return undefined;
  if (structure.chains.some((entry, index) => {
    const wanted = expected[index];
    return wanted === undefined || wanted.entryIndex !== index || wanted.entryName !== names[index]
      || entry.index !== index || entry.name !== names[index] || !entry.devicesComplete
      || entry.devices.length !== 1 || entry.devices[0]?.index !== 0
      || entry.devices[0]?.name !== wanted.observedName
      || entry.devices[0]?.enabled !== wanted.enabled;
  })) return undefined;
  return structure.chains.map((entry) => ({
    entryIndex: entry.index, entryName: entry.name,
    devices: entry.devices.map((item) => ({
      position: item.index, name: item.name, enabled: item.enabled as boolean,
    })),
  }));
}

function assertRequest(request: GeneralDeviceCompositionRequest, topBankSize: number): void {
  if (request.entries.length < 1 || request.entries.length > 4) {
    throw new Error('one through four entries are required by the current complete chain bank');
  }
  const entryNames = request.entries.map((item) => item.entryName);
  if (new Set(entryNames).size !== entryNames.length) throw new Error('each entry name must be unique');
  if (request.expectedDeviceOrder.length + 1 > topBankSize) {
    throw new Error('the top-level device bank has no room for the owned container');
  }
  for (const entry of request.entries) {
    if (entry.source.kind !== 'preset'
        && entry.modulators.some((item) => item.location === 'device')) {
      throw new Error('device-local modulator authoring requires an explicit preset source');
    }
    if ((entry.source.kind === 'existing-move' || entry.source.kind === 'existing-copy')
        && request.expectedDeviceOrder[entry.source.devicePosition] === undefined) {
      throw new Error('an existing source position is missing from expectedDeviceOrder');
    }
  }
  if (request.entries.slice(1).some((entry) =>
    entry.modulators.some((item) => item.location === 'container'))) {
    throw new Error('outer modulation is supported only for the first late-bound entry');
  }
  const moved = request.entries.filter((item) => item.source.kind === 'existing-move')
    .map((item) => (item.source as Extract<GeneralDeviceSourceRequest, { kind: 'existing-move' }>).devicePosition);
  if (new Set(moved).size !== moved.length) throw new Error('one existing device cannot move twice');
  const alreadyMoved = new Set<number>();
  for (const entry of request.entries) {
    if ((entry.source.kind === 'existing-move' || entry.source.kind === 'existing-copy')
        && alreadyMoved.has(entry.source.devicePosition)) {
      throw new Error('an existing source cannot be used again after it moves');
    }
    if (entry.source.kind === 'existing-move') alreadyMoved.add(entry.source.devicePosition);
  }
}

function currentExistingPosition(
  original: number, completed: readonly GeneralDeviceCheckpointEntry[],
): number {
  return original + 1 - completed.filter((item) =>
    item.sourceKind === 'existing-move' && (item.originalPosition ?? -1) < original).length;
}

function projectedTop(
  request: GeneralDeviceCompositionRequest, completed: readonly GeneralDeviceCheckpointEntry[],
): GeneralDeviceOrderItem[] {
  const moved = new Set(completed.filter((item) => item.sourceKind === 'existing-move')
    .map((item) => item.originalPosition));
  return [{ name: request.containerKind, enabled: true },
    ...request.expectedDeviceOrder.filter((_, index) => !moved.has(index))];
}

function projectedTopFromCheckpoint(checkpoint: GeneralDeviceCompositionCheckpoint): GeneralDeviceOrderItem[] {
  if (checkpoint.state === 'container-inserted') {
    return [...checkpoint.originalDeviceOrder, { name: checkpoint.containerKind, enabled: true }];
  }
  const effective = [
    ...checkpoint.completedEntries,
    ...(checkpoint.pendingEntry?.location === 'container-entry' ? [checkpoint.pendingEntry] : []),
  ];
  const moved = new Set(effective
    .filter((item) => item.sourceKind === 'existing-move').map((item) => item.originalPosition));
  const base = [{ name: checkpoint.containerKind, enabled: true },
    ...checkpoint.originalDeviceOrder.filter((_, index) => !moved.has(index))];
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
  const moved = new Set(remaining.filter((item) => item.sourceKind === 'existing-move')
    .map((item) => item.originalPosition));
  return [{ name: checkpoint.containerKind, enabled: true },
    ...checkpoint.originalDeviceOrder.filter((_, index) => !moved.has(index))];
}

function desiredWithContainer(
  checkpoint: GeneralDeviceCompositionCheckpoint,
  remaining: readonly GeneralDeviceCheckpointEntry[],
): readonly { readonly originalPosition?: number; readonly restored: boolean }[] {
  const stillMoved = new Set(remaining.filter((item) => item.sourceKind === 'existing-move')
    .map((item) => item.originalPosition));
  return [{ restored: true }, ...checkpoint.originalDeviceOrder.flatMap((_, index) =>
    stillMoved.has(index) ? [] : [{ originalPosition: index, restored: true }])];
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

function failure(
  failedStage: string, why: string,
  stages: readonly GeneralDeviceStageReceipt[], entries: readonly GeneralDeviceEntryVerification[],
  checkpoint?: GeneralDeviceCompositionCheckpoint,
): GeneralDeviceCompositionResult {
  return { complete: false, failedStage, why, stages, entries, ...(checkpoint === undefined ? {} : { checkpoint }) };
}

function reversalFailure(
  failedStage: string, stages: readonly GeneralDeviceStageReceipt[],
  why = 'The guarded reversal stage was not proved.',
): GeneralDeviceCompositionReversal {
  return { complete: false, failedStage, why, stages, containerRemoved: false, restoredDeviceOrder: false };
}

function uniqueTemporaryName(names: readonly string[]): string {
  let name = 'ghostnote pending general entry';
  while (names.includes(name)) name += ' pending';
  return name;
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

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function wait(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}
