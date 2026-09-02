/** Checkpointed wrap and reversal for one existing top-level device. */
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  EXISTING_DEVICE_WRAPPER_ENTRY, EXISTING_DEVICE_WRAPPER_KIND,
  composeExistingDeviceWrapperPreset,
  type ExistingDeviceWrapperModulation,
} from '../composition/index.js';
import {
  addressKey, chain, device, deviceIn,
  type Address, type DeviceAddress, type ObservedDevice, type ObservedDeviceBank,
  type Op, type ParamState, type RevisionMark, type Snapshot, type TrackAddress,
} from '../contract/index.js';
import type { RunOptions } from './executor.js';
import { ownChangesetReversal } from './floor.js';
import {
  verifyModulation, verifyPages,
  type ModulationVerification, type ModulatorPageVerification,
} from './modulator-authoring.js';
import type { Take } from './take.js';

export interface ExistingDeviceWrapperHost {
  /** Re-throw an active cancellation before a workflow converts an error to a result. */
  readonly throwIfCancelled?: () => void;
  devices(track: TrackAddress): Promise<ObservedDeviceBank>;
  read(addresses: readonly Address[]): Promise<Snapshot>;
  apply(ops: readonly Op[], options?: RunOptions): Promise<{ readonly take: Take }>;
}

export interface ExistingDeviceOrderItem {
  readonly name: string;
  readonly enabled: boolean;
}

export interface ExistingDeviceWrapperRequest {
  readonly track: TrackAddress;
  readonly devicePosition: number;
  readonly expectedDeviceOrder: readonly ExistingDeviceOrderItem[];
  readonly containerKind: typeof EXISTING_DEVICE_WRAPPER_KIND;
  readonly entryName: typeof EXISTING_DEVICE_WRAPPER_ENTRY;
  readonly modulators: readonly ExistingDeviceWrapperModulation[];
}

export interface DeviceParameterFingerprint {
  readonly algorithm: 'sha256';
  readonly sha256: string;
  readonly parameterCount: number;
}

export interface ExistingDeviceWrapperCheckpoint {
  readonly schemaVersion: 1;
  readonly state: 'container-inserted' | 'container-positioned' | 'wrapped';
  readonly track: TrackAddress;
  readonly containerKind: typeof EXISTING_DEVICE_WRAPPER_KIND;
  readonly entryName: typeof EXISTING_DEVICE_WRAPPER_ENTRY;
  readonly currentEntryName: string;
  readonly containerInsertTakeId: string;
  readonly insertedContainerPosition: number;
  readonly currentContainerPosition: number;
  readonly originalDeviceOrder: readonly ExistingDeviceOrderItem[];
  readonly device: {
    readonly originalPosition: number;
    readonly name: string;
    readonly enabled: boolean;
    readonly parameterFingerprint: DeviceParameterFingerprint;
  };
}

export interface ExistingDeviceWrapperStageReceipt {
  readonly stage: 'insert-container' | 'position-container' | 'prepare-entry-name'
    | 'confirm-entry-name' | 'relocate-device' | 'restore-position' | 'remove-container';
  readonly changeId: string;
  readonly applied: boolean;
}

export interface ExistingDeviceWrapperVerification {
  readonly verified: boolean;
  readonly preservedOpaqueState: true;
  readonly opaqueStateQualification: string;
  readonly scalarFingerprint: {
    readonly before: DeviceParameterFingerprint;
    readonly after?: DeviceParameterFingerprint;
    readonly preserved: boolean;
  };
  readonly pages: ModulatorPageVerification;
  readonly behaviors: readonly ModulationVerification[];
}

export interface ExistingDeviceWrapperResult {
  readonly complete: boolean;
  readonly failedStage?: 'insert-container' | 'position-container' | 'container-witness' | 'relocate-device' | 'post-move-witness';
  readonly why?: string;
  readonly stages: readonly ExistingDeviceWrapperStageReceipt[];
  readonly checkpoint?: ExistingDeviceWrapperCheckpoint;
  readonly currentLocation: {
    readonly kind: 'top-level' | 'container-entry' | 'unknown';
    readonly devicePosition?: number;
    readonly containerPosition?: number;
    readonly entryName?: string;
  };
  readonly verification?: ExistingDeviceWrapperVerification;
}

export interface ExistingDeviceWrapperReversal {
  readonly complete: boolean;
  readonly failedStage?: 'reversal-boundary' | 'position-container' | 'relocate-device'
    | 'restore-position' | 'remove-container';
  readonly why?: string;
  readonly stages: readonly ExistingDeviceWrapperStageReceipt[];
  readonly currentLocation: ExistingDeviceWrapperResult['currentLocation'];
  readonly containerRemoved: boolean;
  readonly restoredDeviceOrder: boolean;
}

export interface ExistingDeviceWrapperOptions {
  readonly run?: Omit<RunOptions, 'ifRevision'>;
  readonly wait?: (milliseconds: number) => Promise<void>;
  readonly tempRoot?: string;
  readonly templatePath?: string;
  readonly manifestPath?: string;
}

class WrapperError extends Error {
  constructor(readonly stage: NonNullable<ExistingDeviceWrapperResult['failedStage']>, message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Insert the owned container, move the existing device, and prove the result. */
export async function wrapExistingDeviceModulation(
  host: ExistingDeviceWrapperHost,
  request: ExistingDeviceWrapperRequest,
  options: ExistingDeviceWrapperOptions = {},
): Promise<ExistingDeviceWrapperResult> {
  const stages: ExistingDeviceWrapperStageReceipt[] = [];
  const entry = await stableTop(host, request.track, 'container-witness');
  assertExpectedOrder(entry.devices, request.expectedDeviceOrder);
  const source = entry.devices[request.devicePosition];
  if (source === undefined || source.enabled === undefined) {
    throw new WrapperError('container-witness', 'the requested top-level device is missing');
  }
  const before = await stableInventory(host, device(request.track, request.devicePosition));
  if (before.name !== source.name) {
    throw new WrapperError('container-witness', 'the device name disagreed with its parameter inventory');
  }
  assertTargets(before.params, request.modulators);
  const beforeFingerprint = parameterFingerprint(before.params);
  const composed = await composeExistingDeviceWrapperPreset(request.modulators, {
    ...(options.templatePath === undefined ? {} : { templatePath: options.templatePath }),
    ...(options.manifestPath === undefined ? {} : { manifestPath: options.manifestPath }),
  });

  const directory = await mkdtemp(join(options.tempRoot ?? tmpdir(), 'ghostnote-device-wrapper-'));
  const presetPath = join(directory, 'fx-layer-wrapper.bwpreset');
  let insertion: Take;
  try {
    await writeFile(presetPath, composed.preset);
    ({ take: insertion } = await host.apply([{
      op: 'device.insert',
      track: request.track,
      source: { from: 'file', path: presetPath },
      expectedDeviceName: EXISTING_DEVICE_WRAPPER_KIND,
      expectedChain: names(entry.devices),
      expectedEnabledChain: enabled(entry.devices),
    }], { ...options.run, ifRevision: entry.at.revision }));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
  stages.push(stageReceipt('insert-container', insertion));
  const minted = insertion.receipt.minted[0];
  if (!accepted(insertion) || minted?.kind !== 'device') {
    return {
      complete: false,
      failedStage: 'insert-container',
      why: 'The owned container insertion was not proved.',
      stages,
      currentLocation: { kind: 'top-level', devicePosition: request.devicePosition },
    };
  }

  const insertedOrder = [...request.expectedDeviceOrder, {
    name: EXISTING_DEVICE_WRAPPER_KIND, enabled: true,
  }];
  const insertedPosition = minted.chainIndex;
  const insertedCheckpoint: ExistingDeviceWrapperCheckpoint = {
    schemaVersion: 1,
    state: 'container-inserted',
    track: request.track,
    containerKind: request.containerKind,
    entryName: request.entryName,
    currentEntryName: request.entryName,
    containerInsertTakeId: insertion.id,
    insertedContainerPosition: insertedPosition,
    currentContainerPosition: insertedPosition,
    originalDeviceOrder: request.expectedDeviceOrder,
    device: {
      originalPosition: request.devicePosition,
      name: source.name,
      enabled: source.enabled,
      parameterFingerprint: beforeFingerprint,
    },
  };

  let recoveryCheckpoint = insertedCheckpoint;
  let failureStage: NonNullable<ExistingDeviceWrapperResult['failedStage']> = 'container-witness';
  try {
    const inserted = await stableTop(host, request.track, 'container-witness', insertedOrder);

    failureStage = 'position-container';
    const positioning = (await host.apply([{
      op: 'device.relocate',
      track: request.track,
      sourceFromEnd: 0,
      expectedName: EXISTING_DEVICE_WRAPPER_KIND,
      before: device(request.track, request.devicePosition),
      expectedChain: names(inserted.devices),
      expectedEnabledChain: enabled(inserted.devices),
    }], { ...options.run, ifRevision: inserted.at.revision })).take;
    stages.push(stageReceipt('position-container', positioning));
    if (!accepted(positioning)) {
      return {
        complete: false,
        failedStage: 'position-container',
        why: 'The owned container was inserted but its observable position was not proved.',
        stages,
        checkpoint: insertedCheckpoint,
        currentLocation: {
          kind: 'top-level', devicePosition: request.devicePosition, containerPosition: insertedPosition,
        },
      };
    }

    const positionedOrder = insertContainerAt(
      request.expectedDeviceOrder, request.devicePosition, request.containerKind,
    );
    const positionedCheckpoint: ExistingDeviceWrapperCheckpoint = {
      ...insertedCheckpoint,
      state: 'container-positioned',
      currentContainerPosition: request.devicePosition,
    };
    recoveryCheckpoint = positionedCheckpoint;
    failureStage = 'container-witness';
    const positioned = await stableTop(host, request.track, 'container-witness', positionedOrder);
    const positionedContainer = device(request.track, request.devicePosition);
    const empty = await exactContainer(host, positionedContainer, request.entryName, 0);
    const pageChecks = pageWitnesses(composed.modulatorPages);
    const pages = empty
      ? await verifyPages(host, positionedContainer, pageChecks, options.wait ?? wait)
      : failedPages('The owned container entry was not empty and complete.');
    if (!empty || !pages.verified) {
      return {
        complete: false,
        failedStage: 'container-witness',
        why: pages.why ?? 'The owned container entry was not empty and complete.',
        stages,
        checkpoint: positionedCheckpoint,
        currentLocation: {
          kind: 'top-level', devicePosition: request.devicePosition + 1,
          containerPosition: request.devicePosition,
        },
        verification: verification(beforeFingerprint, undefined, pages, []),
      };
    }

    const temporaryEntryName = 'ghostnote pending wrapper entry';
    const preparation = (await host.apply([{
      op: 'chain.rename',
      chain: chain(positionedContainer, request.entryName),
      name: temporaryEntryName,
    }], { ...options.run, ifRevision: positioned.at.revision })).take;
    stages.push(stageReceipt('prepare-entry-name', preparation));
    if (accepted(preparation)) {
      recoveryCheckpoint = { ...positionedCheckpoint, currentEntryName: temporaryEntryName };
    }
    const preparedTop = await stableTop(host, request.track, 'container-witness', positionedOrder);
    const preparedName = await singleEntryName(host, positionedContainer) ?? request.entryName;
    const preparedCheckpoint = { ...positionedCheckpoint, currentEntryName: preparedName };
    if (!accepted(preparation)
        || !await exactContainer(host, positionedContainer, temporaryEntryName, 0)) {
      return {
        complete: false,
        failedStage: 'container-witness',
        why: 'The owned entry could not be marked with an explicit stable name.',
        stages,
        checkpoint: preparedCheckpoint,
        currentLocation: {
          kind: 'top-level', devicePosition: request.devicePosition + 1,
          containerPosition: request.devicePosition,
        },
        verification: verification(beforeFingerprint, undefined, pages, []),
      };
    }
    recoveryCheckpoint = preparedCheckpoint;

    const naming = (await host.apply([{
      op: 'chain.rename',
      chain: chain(positionedContainer, temporaryEntryName),
      name: request.entryName,
    }], { ...options.run, ifRevision: preparedTop.at.revision })).take;
    stages.push(stageReceipt('confirm-entry-name', naming));
    if (accepted(naming)) {
      recoveryCheckpoint = { ...positionedCheckpoint, currentEntryName: request.entryName };
    }
    const namedTop = await stableTop(host, request.track, 'container-witness', positionedOrder);
    const namedEntry = await singleEntryName(host, positionedContainer) ?? temporaryEntryName;
    const namedCheckpoint = { ...positionedCheckpoint, currentEntryName: namedEntry };
    if (!accepted(naming) || !await exactContainer(host, positionedContainer, request.entryName, 0)) {
      return {
        complete: false,
        failedStage: 'container-witness',
        why: 'The explicit owned entry name did not read back.',
        stages,
        checkpoint: namedCheckpoint,
        currentLocation: {
          kind: 'top-level', devicePosition: request.devicePosition + 1,
          containerPosition: request.devicePosition,
        },
        verification: verification(beforeFingerprint, undefined, pages, []),
      };
    }
    recoveryCheckpoint = namedCheckpoint;

    failureStage = 'relocate-device';
    const relocation = (await host.apply([{
      op: 'chain.relocate',
      source: device(request.track, request.devicePosition + 1),
      destination: chain(positionedContainer, request.entryName),
      mode: 'move',
      expectedChain: names(namedTop.devices),
      expectedEnabledChain: enabled(namedTop.devices),
    }], { ...options.run, ifRevision: namedTop.at.revision })).take;
    stages.push(stageReceipt('relocate-device', relocation));
    const wrappedOrder = replaceSourceWithContainer(
      request.expectedDeviceOrder, request.devicePosition, request.containerKind,
    );
    const containerPosition = request.devicePosition;
    const wrappedCheckpoint: ExistingDeviceWrapperCheckpoint = {
      ...namedCheckpoint,
      state: 'wrapped',
      currentContainerPosition: containerPosition,
    };
    if (!accepted(relocation)) {
      try {
        await stableTop(host, request.track, 'post-move-witness', wrappedOrder);
        const movedEntry = await singleEntryName(host, positionedContainer);
        if (movedEntry !== undefined
            && await exactContainer(host, positionedContainer, movedEntry, 1, source)) {
          const movedCheckpoint = { ...wrappedCheckpoint, currentEntryName: movedEntry };
          return {
            complete: false,
            failedStage: 'relocate-device',
            why: 'The device moved, but the relocation receipt was not fully proved.',
            stages,
            checkpoint: movedCheckpoint,
            currentLocation: {
              kind: 'container-entry', containerPosition,
              entryName: movedEntry, devicePosition: 0,
            },
            verification: verification(beforeFingerprint, undefined, pages, []),
          };
        }
      } catch {
        // The guarded checkpoint below describes only the last fully proved state.
      }
      return {
        complete: false,
        failedStage: 'relocate-device',
        why: 'The device relocation was not proved.',
        stages,
        checkpoint: namedCheckpoint,
        currentLocation: {
          kind: 'top-level', devicePosition: request.devicePosition + 1,
          containerPosition,
        },
        verification: verification(beforeFingerprint, undefined, pages, []),
      };
    }

    recoveryCheckpoint = wrappedCheckpoint;
    failureStage = 'post-move-witness';
    await stableTop(host, request.track, 'post-move-witness', wrappedOrder);
    const currentContainer = device(request.track, containerPosition);
    const nested = deviceIn(chain(currentContainer, request.entryName), 0);
    const structure = await exactContainer(host, currentContainer, request.entryName, 1, source);
    if (!structure) {
      return {
        complete: false,
        failedStage: 'post-move-witness',
        why: 'The moved device is reachable, but the complete parent-child edge did not match.',
        stages,
        checkpoint: wrappedCheckpoint,
        currentLocation: {
          kind: 'container-entry', containerPosition, entryName: request.entryName, devicePosition: 0,
        },
        verification: verification(beforeFingerprint, undefined, pages, []),
      };
    }
    const after = await stableInventory(host, nested);
    const afterFingerprint = parameterFingerprint(after.params);
    const afterPages = await verifyPages(
      host, currentContainer, pageChecks, options.wait ?? wait,
    );
    const behaviors: ModulationVerification[] = [];
    for (const item of request.modulators) {
      behaviors.push(await verifyModulation(host, nested, item.target, options.wait ?? wait));
    }
    const checked = verification(beforeFingerprint, afterFingerprint, afterPages, behaviors);
    return {
      complete: checked.verified,
      ...(checked.verified ? {} : {
        failedStage: 'post-move-witness' as const,
        why: 'The existing device remains inside the owned container, but a post-move witness failed.',
      }),
      stages,
      checkpoint: wrappedCheckpoint,
      currentLocation: {
        kind: 'container-entry', containerPosition, entryName: request.entryName, devicePosition: 0,
      },
      verification: checked,
    };
  } catch (error) {
    host.throwIfCancelled?.();
    return {
      complete: false,
      failedStage: failureStage,
      why: `The workflow stopped after a project write. ${message(error)}`,
      stages,
      checkpoint: recoveryCheckpoint,
      currentLocation: { kind: 'unknown' },
    };
  }
}

/** Move the same device back and remove only the empty owned container. */
export async function reverseExistingDeviceModulation(
  host: ExistingDeviceWrapperHost,
  checkpoint: ExistingDeviceWrapperCheckpoint,
  options: Pick<ExistingDeviceWrapperOptions, 'run'> = {},
): Promise<ExistingDeviceWrapperReversal> {
  const stages: ExistingDeviceWrapperStageReceipt[] = [];
  const original = checkpoint.originalDeviceOrder;
  const source = checkpoint.device;
  const insertedOrder = [...original, { name: checkpoint.containerKind, enabled: true }];
  const positionedContainerPosition = checkpoint.state === 'container-inserted'
    ? source.originalPosition
    : checkpoint.currentContainerPosition;
  const positionedOrder = insertContainerAt(
    original, positionedContainerPosition, checkpoint.containerKind,
  );
  const wrappedOrder = insertContainerAt(
    original.filter((_, index) => index !== source.originalPosition),
    checkpoint.currentContainerPosition,
    checkpoint.containerKind,
  );
  let current: StableTop;
  try {
    current = checkpoint.state === 'container-inserted'
      ? await stableTop(host, checkpoint.track, 'container-witness', insertedOrder)
      : checkpoint.state === 'container-positioned'
        ? await stableTop(host, checkpoint.track, 'container-witness', positionedOrder)
        : await stableTop(host, checkpoint.track, 'post-move-witness', wrappedOrder);
  } catch (error) {
    return reversalFailure('reversal-boundary', message(error), stages, { kind: 'unknown' });
  }

  let containerPosition = checkpoint.currentContainerPosition;
  if (checkpoint.state === 'container-inserted') {
    const positioning = (await host.apply([{
      op: 'device.relocate',
      track: checkpoint.track,
      sourceFromEnd: 0,
      expectedName: checkpoint.containerKind,
      before: device(checkpoint.track, source.originalPosition),
      expectedChain: names(current.devices),
      expectedEnabledChain: enabled(current.devices),
    }], { ...options.run, ifRevision: current.at.revision })).take;
    stages.push(stageReceipt('position-container', positioning));
    if (!accepted(positioning)) {
      return reversalFailure(
        'position-container',
        'The owned container could not be moved into the observable position.',
        stages,
        { kind: 'unknown' },
      );
    }
    const moved = current.devices[current.devices.length - 1]!;
    current = {
      at: positioning.verify.at,
      devices: [
        ...current.devices.slice(0, source.originalPosition),
        moved,
        ...current.devices.slice(source.originalPosition, -1),
      ],
      bankSize: current.bankSize,
    };
    containerPosition = source.originalPosition;
  }
  if (checkpoint.state === 'wrapped') {
    const container = device(checkpoint.track, containerPosition);
    const target = deviceIn(chain(container, checkpoint.currentEntryName), 0);
    const structure = await exactContainer(
      host, container, checkpoint.currentEntryName, 1,
      { index: 0, name: source.name, enabled: source.enabled },
    );
    if (!structure) {
      return reversalFailure('reversal-boundary', 'The owned container structure changed.', stages, {
        kind: 'unknown', containerPosition,
      });
    }
    let inventory: StableInventory;
    try {
      inventory = await stableInventory(host, target);
    } catch (error) {
      return reversalFailure('reversal-boundary', message(error), stages, {
        kind: 'container-entry', containerPosition,
        entryName: checkpoint.currentEntryName, devicePosition: 0,
      });
    }
    if (inventory.name !== source.name
        || !sameFingerprint(parameterFingerprint(inventory.params), source.parameterFingerprint)) {
      return reversalFailure(
        'reversal-boundary',
        'The moved device scalar fingerprint changed after the wrapper checkpoint.',
        stages,
        { kind: 'container-entry', containerPosition,
          entryName: checkpoint.currentEntryName, devicePosition: 0 },
      );
    }

    const extracted = (await host.apply([{
      op: 'chain.relocate', source: target, destination: checkpoint.track, mode: 'move',
      expectedChain: names(current.devices),
      expectedEnabledChain: enabled(current.devices),
    }], { ...options.run, ifRevision: current.at.revision })).take;
    stages.push(stageReceipt('relocate-device', extracted));
    if (!accepted(extracted)) {
      return reversalFailure('relocate-device', 'The move out of the owned container was not proved.', stages, {
        kind: 'container-entry', containerPosition,
        entryName: checkpoint.currentEntryName, devicePosition: 0,
      });
    }
    const extractedOrder = [...wrappedOrder, { name: source.name, enabled: source.enabled }];
    try {
      current = await stableTop(host, checkpoint.track, 'post-move-witness', extractedOrder);
    } catch (error) {
      return reversalFailure('relocate-device', message(error), stages, { kind: 'unknown', containerPosition });
    }
    if (!await exactContainer(
      host, device(checkpoint.track, containerPosition), checkpoint.currentEntryName, 0,
    )) {
      return reversalFailure('relocate-device', 'The target moved out, but the owned entry is not empty.', stages, {
        kind: 'top-level', devicePosition: extractedOrder.length - 1, containerPosition,
      });
    }

    if (source.originalPosition < original.length - 1) {
      const reorder = (await host.apply([{
        op: 'device.relocate',
        track: checkpoint.track,
        sourceFromEnd: 0,
        expectedName: source.name,
        before: device(checkpoint.track, source.originalPosition + 1),
        expectedChain: names(current.devices),
        expectedEnabledChain: enabled(current.devices),
      }], { ...options.run, ifRevision: current.at.revision })).take;
      stages.push(stageReceipt('restore-position', reorder));
      if (!accepted(reorder)) {
        return reversalFailure('restore-position', 'The exact prior signal position was not restored.', stages, {
          kind: 'top-level', devicePosition: extractedOrder.length - 1, containerPosition,
        });
      }
      try {
        current = await stableTop(host, checkpoint.track, 'post-move-witness', positionedOrder);
      } catch (error) {
        return reversalFailure('restore-position', message(error), stages, { kind: 'unknown' });
      }
    }
  }

  const beforeDelete = current.devices;
  const container = device(checkpoint.track, containerPosition);
  if (!await exactContainer(host, container, checkpoint.currentEntryName, 0)) {
    return reversalFailure('remove-container', 'The owned container is not empty.', stages, {
      kind: 'top-level',
      devicePosition: checkpoint.state === 'wrapped' ? source.originalPosition + 1 : source.originalPosition + 1,
      containerPosition,
    });
  }
  const removal = (await host.apply([{
    op: 'device.delete',
    device: container,
    expectedName: checkpoint.containerKind,
    expectedChain: names(beforeDelete),
    expectedEnabledChain: enabled(beforeDelete),
  }], {
    ...options.run,
    ifRevision: current.at.revision,
    clearance: ownChangesetReversal(checkpoint.containerInsertTakeId),
  })).take;
  stages.push(stageReceipt('remove-container', removal));
  if (!accepted(removal)) {
    return reversalFailure('remove-container', 'The empty owned container was not removed.', stages, {
      kind: 'top-level', devicePosition: source.originalPosition, containerPosition,
    });
  }
  try {
    await stableTop(host, checkpoint.track, 'post-move-witness', original);
  } catch (error) {
    return reversalFailure('remove-container', message(error), stages, { kind: 'unknown' });
  }
  return {
    complete: true,
    stages,
    currentLocation: { kind: 'top-level', devicePosition: source.originalPosition },
    containerRemoved: true,
    restoredDeviceOrder: true,
  };
}

function insertContainerAt(
  order: readonly ExistingDeviceOrderItem[], position: number, containerKind: string,
): ExistingDeviceOrderItem[] {
  return [
    ...order.slice(0, position),
    { name: containerKind, enabled: true },
    ...order.slice(position),
  ];
}

function replaceSourceWithContainer(
  order: readonly ExistingDeviceOrderItem[], sourcePosition: number, containerKind: string,
): ExistingDeviceOrderItem[] {
  return order.map((item, index) => index === sourcePosition
    ? { name: containerKind, enabled: true }
    : item);
}

interface StableTop {
  readonly at: RevisionMark;
  readonly devices: readonly ObservedDevice[];
  readonly bankSize: number;
}

interface StableInventory {
  readonly name: string;
  readonly params: readonly ParamState[];
}

async function stableTop(
  host: ExistingDeviceWrapperHost,
  track: TrackAddress,
  stage: NonNullable<ExistingDeviceWrapperResult['failedStage']>,
  expected?: readonly ExistingDeviceOrderItem[],
): Promise<StableTop> {
  const before = await host.read([]);
  const bank = await host.devices(track);
  const after = await host.read([]);
  if (!sameMark(before.at, after.at)) throw new WrapperError(stage, 'the project changed during device inspection');
  if (!bank.devicesComplete || bank.bankSize === undefined) {
    throw new WrapperError(stage, 'the complete top-level device order is required');
  }
  if (bank.devices.some((item, index) => item.index !== index || item.enabled === undefined)) {
    throw new WrapperError(stage, 'the complete ordered enabled state is required');
  }
  if (expected !== undefined) assertExpectedOrder(bank.devices, expected);
  return { at: after.at, devices: bank.devices, bankSize: bank.bankSize };
}

function assertExpectedOrder(
  actual: readonly ObservedDevice[], expected: readonly ExistingDeviceOrderItem[],
): void {
  const current = actual.map((item) => ({ name: item.name, enabled: item.enabled }));
  if (JSON.stringify(current) !== JSON.stringify(expected)) {
    throw new WrapperError('container-witness', 'the top-level device order or enabled state is stale');
  }
}

async function stableInventory(
  host: ExistingDeviceWrapperHost, address: DeviceAddress,
): Promise<StableInventory> {
  const snapshot = await host.read([address]);
  const key = addressKey(address);
  if (snapshot.unreachable.some((item) => addressKey(item) === key)) {
    throw new WrapperError('post-move-witness', 'the device is outside the observer window');
  }
  if (snapshot.unstable.some((item) => addressKey(item) === key)) {
    throw new WrapperError('post-move-witness', 'the DirectParameter inventory is unstable');
  }
  const value = snapshot.entries[key]?.value;
  if (value?.of !== 'device' || value.device.params === undefined) {
    throw new WrapperError('post-move-witness', 'the complete DirectParameter inventory is missing');
  }
  if (value.device.params.length === 0
      || new Set(value.device.params.map((item) => item.id)).size !== value.device.params.length) {
    throw new WrapperError('post-move-witness', 'the DirectParameter inventory is empty or has duplicate ids');
  }
  return { name: value.device.name, params: value.device.params };
}

async function exactContainer(
  host: ExistingDeviceWrapperHost,
  address: DeviceAddress,
  entryName: string,
  deviceCount: number,
  expectedDevice?: ObservedDevice,
): Promise<boolean> {
  const snapshot = await host.read([address]);
  const value = snapshot.entries[addressKey(address)]?.value;
  if (value?.of !== 'device' || value.device.name !== EXISTING_DEVICE_WRAPPER_KIND) return false;
  const container = value.device.container;
  if (container === undefined || !container.chainsComplete || container.chains.length !== 1) return false;
  const entry = container.chains[0];
  if (entry?.index !== 0 || entry.name !== entryName || !entry.devicesComplete
      || entry.devices.length !== deviceCount) return false;
  if (expectedDevice === undefined) return deviceCount === 0;
  const nested = entry.devices[0];
  return nested?.index === 0 && nested.name === expectedDevice.name
    && nested.enabled === expectedDevice.enabled;
}

async function singleEntryName(
  host: ExistingDeviceWrapperHost, address: DeviceAddress,
): Promise<string | undefined> {
  const snapshot = await host.read([address]);
  const value = snapshot.entries[addressKey(address)]?.value;
  const container = value?.of === 'device' ? value.device.container : undefined;
  return container?.chainsComplete === true && container.chains.length === 1
    ? container.chains[0]?.name
    : undefined;
}

function assertTargets(
  params: readonly ParamState[], requests: readonly ExistingDeviceWrapperModulation[],
): void {
  for (const request of requests) {
    const matches = params.filter((item) => item.id === request.target.parameterId);
    if (matches.length !== 1 || matches[0]!.name !== request.target.parameterName) {
      throw new WrapperError(
        'container-witness',
        `DirectParameter ${JSON.stringify(request.target.parameterId)} is missing or changed name`,
      );
    }
  }
}

function parameterFingerprint(params: readonly ParamState[]): DeviceParameterFingerprint {
  const body = params.map((item) => [item.id, item.name, item.value.toFixed(10)]);
  return {
    algorithm: 'sha256',
    sha256: createHash('sha256').update(JSON.stringify(body)).digest('hex'),
    parameterCount: params.length,
  };
}

function sameFingerprint(left: DeviceParameterFingerprint, right: DeviceParameterFingerprint): boolean {
  return left.algorithm === right.algorithm && left.sha256 === right.sha256
    && left.parameterCount === right.parameterCount;
}

function verification(
  before: DeviceParameterFingerprint,
  after: DeviceParameterFingerprint | undefined,
  pages: ModulatorPageVerification,
  behaviors: readonly ModulationVerification[],
): ExistingDeviceWrapperVerification {
  const preserved = after !== undefined && sameFingerprint(before, after);
  return {
    verified: preserved && pages.verified && behaviors.length > 0
      && behaviors.every((item) => item.verified),
    preservedOpaqueState: true,
    opaqueStateQualification: 'The workflow does not replace the existing device. Relocation moves the same instance. Opaque state is not read back byte for byte.',
    scalarFingerprint: { before, ...(after === undefined ? {} : { after }), preserved },
    pages,
    behaviors,
  };
}

function pageWitnesses(pages: readonly string[]): { pageName: string; expectedCount: number }[] {
  return [...new Set(pages)].map((pageName) => ({
    pageName, expectedCount: pages.filter((item) => item === pageName).length,
  }));
}

function failedPages(why: string): ModulatorPageVerification {
  return { verified: false, actualPages: [], witnesses: [], why };
}

function stageReceipt(
  stage: ExistingDeviceWrapperStageReceipt['stage'], take: Take,
): ExistingDeviceWrapperStageReceipt {
  return { stage, changeId: take.id, applied: accepted(take) };
}

function accepted(take: Take): boolean {
  return take.receipt.accepted && take.report.rejected === undefined
    && take.report.failed.length === 0 && take.report.disagreements.length === 0;
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

function reversalFailure(
  failedStage: NonNullable<ExistingDeviceWrapperReversal['failedStage']>,
  why: string,
  stages: readonly ExistingDeviceWrapperStageReceipt[],
  currentLocation: ExistingDeviceWrapperResult['currentLocation'],
): ExistingDeviceWrapperReversal {
  return {
    complete: false, failedStage, why, stages, currentLocation,
    containerRemoved: false, restoredDeviceOrder: false,
  };
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const wait = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));
