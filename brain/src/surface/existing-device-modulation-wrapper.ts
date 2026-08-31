/** Public schemas and result mapping for the existing-device wrapper lifecycle. */
import { z } from 'zod';

import { listDonorTypes } from '../bwmod/index.js';
import {
  EXISTING_DEVICE_WRAPPER_ENTRY, EXISTING_DEVICE_WRAPPER_KIND,
} from '../composition/index.js';
import { track as trackAt } from '../contract/index.js';
import {
  reverseExistingDeviceModulation, wrapExistingDeviceModulation,
  type ExistingDeviceWrapperCheckpoint, type ExistingDeviceWrapperOptions,
  type ExistingDeviceWrapperResult, type ExistingDeviceWrapperReversal,
} from '../engine/index.js';
import { receiptOf } from './report.js';
import type { Workspace } from './workspace.js';

const ADD_TYPES = listDonorTypes()
  .filter((item) => item.capabilities.includes('add'))
  .map((item) => item.id) as [string, ...string[]];

const orderItem = z.object({
  name: z.string().min(1),
  enabled: z.boolean(),
}).strict();

const fingerprint = z.object({
  algorithm: z.literal('sha256'),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  parameterCount: z.number().int().min(1),
}).strict();

const modulation = z.object({
  modulator: z.enum(ADD_TYPES).describe('Manifest-backed modulator type from list_modulator_types.'),
  target: z.object({
    parameterId: z.string().min(1).describe('Exact DirectParameter id from inspect_device_parameters.'),
    parameterName: z.string().min(1).describe('Exact name returned with parameterId.'),
  }).strict(),
  amount: z.number().finite().min(-1).max(1),
}).strict();

export const existingDeviceModulationWrapperInputSchema = {
  trackId: z.string().min(1).describe('Durable track id from list_tracks.'),
  devicePosition: z.number().int().min(0).describe('Current top-level device position.'),
  expectedDeviceOrder: z.array(orderItem).min(1).max(15).describe(
    'Exact complete name and enabled-state order from the latest inspect_devices call.',
  ),
  containerKind: z.literal(EXISTING_DEVICE_WRAPPER_KIND).describe(
    'The only container kind proved for empty-entry late binding.',
  ),
  entryName: z.literal(EXISTING_DEVICE_WRAPPER_ENTRY).describe(
    'The exact empty entry supplied by the owned FX Layer source.',
  ),
  modulators: z.array(modulation).min(1).max(16),
} as const;

export const existingDeviceModulationWrapperInputValidator = z.object(
  existingDeviceModulationWrapperInputSchema,
).strict().superRefine((input, context) => {
  if (input.devicePosition >= input.expectedDeviceOrder.length) {
    context.addIssue({
      code: 'custom', path: ['devicePosition'],
      message: 'The device position must exist in expectedDeviceOrder.',
    });
  }
});

const publicCheckpoint = z.object({
  schemaVersion: z.literal(1),
  state: z.enum(['container-inserted', 'container-positioned', 'wrapped']),
  trackId: z.string().min(1),
  containerKind: z.literal(EXISTING_DEVICE_WRAPPER_KIND),
  entryName: z.literal(EXISTING_DEVICE_WRAPPER_ENTRY),
  currentEntryName: z.string().min(1),
  containerInsertChangeId: z.string().min(1),
  insertedContainerPosition: z.number().int().min(0),
  currentContainerPosition: z.number().int().min(0),
  originalDeviceOrder: z.array(orderItem).min(1).max(15),
  device: z.object({
    originalPosition: z.number().int().min(0),
    name: z.string().min(1),
    enabled: z.boolean(),
    parameterFingerprint: fingerprint,
  }).strict(),
}).strict();

export const existingDeviceModulationReversalInputSchema = {
  checkpoint: publicCheckpoint.describe(
    'Exact reversal checkpoint returned by wrap_existing_device_modulation.',
  ),
} as const;

export const existingDeviceModulationReversalInputValidator = z.object(
  existingDeviceModulationReversalInputSchema,
).strict();

export type ExistingDeviceModulationWrapperInput = z.infer<
  typeof existingDeviceModulationWrapperInputValidator
>;
export type ExistingDeviceModulationReversalInput = z.infer<
  typeof existingDeviceModulationReversalInputValidator
>;

const issuedCheckpoints = new WeakMap<object, Map<string, string>>();

/** Run one public guarded wrap through the recorded Workspace seam. */
export async function runExistingDeviceModulationWrapper(
  workspace: Workspace,
  input: ExistingDeviceModulationWrapperInput,
  options: ExistingDeviceWrapperOptions = {},
): Promise<Record<string, unknown>> {
  const before = new Set(workspace.changes.list().map((item) => item.id));
  try {
    const result = await wrapExistingDeviceModulation(workspace, {
      track: trackAt(input.trackId),
      devicePosition: input.devicePosition,
      expectedDeviceOrder: input.expectedDeviceOrder,
      containerKind: input.containerKind,
      entryName: input.entryName,
      modulators: input.modulators,
    }, options);
    return publicWrap(workspace, input, result);
  } catch (error) {
    workspace.throwIfCancelled?.();
    const recorded = workspace.changes.list().filter((item) => !before.has(item.id));
    if (recorded.length > 0) {
      const changes = recorded.map((item) => receiptOf(workspace.changes.require(item.id)));
      const applied = changes.some((item) => item.applied);
      return {
        applied,
        complete: false,
        partialCompletion: applied,
        completionUnknown: true,
        why: `The workflow stopped after a project write. ${message(error)}`,
        stages: [],
        changes,
        currentLocation: { kind: 'unknown' },
      };
    }
    return {
      refused: true,
      nothingWasWritten: true,
      why: `Nothing was written. ${message(error)}`,
    };
  }
}

/** Continue one exact public reversal checkpoint. */
export async function runExistingDeviceModulationReversal(
  workspace: Workspace,
  input: ExistingDeviceModulationReversalInput,
): Promise<Record<string, unknown>> {
  if (!isIssuedCheckpoint(workspace, input.checkpoint)) {
    return {
      refused: true, nothingWasWritten: true,
      why: 'Nothing was written. The checkpoint is not the exact value issued in this session.',
    };
  }
  const checkpoint = internalCheckpoint(input.checkpoint);
  let insertion;
  try {
    insertion = workspace.changes.require(checkpoint.containerInsertTakeId);
  } catch {
    return {
      refused: true, nothingWasWritten: true,
      why: 'Nothing was written. The container insertion change is not in this session.',
    };
  }
  const op = insertion.take.ops[0];
  const minted = insertion.take.receipt.minted[0];
  const owned = insertion.take.ops.length === 1
    && op?.op === 'device.insert'
    && op.track.channelId === checkpoint.track.channelId
    && op.expectedDeviceName === checkpoint.containerKind
    && minted?.kind === 'device'
    && minted.track.channelId === checkpoint.track.channelId
    && minted.chainIndex === checkpoint.insertedContainerPosition;
  if (!owned) {
    return {
      refused: true, nothingWasWritten: true,
      why: 'Nothing was written. The checkpoint does not identify its exact owned insertion.',
    };
  }
  const before = new Set(workspace.changes.list().map((item) => item.id));
  try {
    const result = await reverseExistingDeviceModulation(workspace, checkpoint);
    if (result.complete) forgetCheckpoint(workspace, input.checkpoint.containerInsertChangeId);
    return publicReversal(workspace, result);
  } catch (error) {
    workspace.throwIfCancelled?.();
    const recorded = workspace.changes.list().filter((item) => !before.has(item.id));
    if (recorded.length === 0) throw error;
    const changes = recorded.map((item) => receiptOf(workspace.changes.require(item.id)));
    const applied = changes.some((item) => item.applied);
    return {
      applied,
      complete: false,
      partialReversal: applied,
      completionUnknown: true,
      why: `The reversal stopped after a project write. ${message(error)}`,
      stages: [],
      changes,
      currentLocation: { kind: 'unknown' },
      containerRemoved: false,
      restoredDeviceOrder: false,
    };
  }
}

function publicWrap(
  workspace: Workspace,
  input: ExistingDeviceModulationWrapperInput,
  result: ExistingDeviceWrapperResult,
): Record<string, unknown> {
  const checkpoint = result.checkpoint === undefined
    ? undefined
    : externalCheckpoint(result.checkpoint);
  if (checkpoint !== undefined) rememberCheckpoint(workspace, checkpoint);
  return {
    applied: result.stages.some((item) => item.applied),
    complete: result.complete,
    partialCompletion: !result.complete && result.stages.some((item) => item.applied),
    ...(result.failedStage === undefined ? {} : { failedStage: result.failedStage }),
    ...(result.why === undefined ? {} : { why: result.why }),
    requested: {
      devicePosition: input.devicePosition,
      deviceName: input.expectedDeviceOrder[input.devicePosition]?.name,
      containerKind: input.containerKind,
      entryName: input.entryName,
      modulators: input.modulators,
    },
    stages: result.stages.map((item) => ({
      stage: item.stage,
      change: receiptOf(workspace.changes.require(item.changeId)),
    })),
    currentLocation: result.currentLocation,
    ...(result.verification === undefined ? {} : { verification: result.verification }),
    ...(checkpoint === undefined ? {} : {
      reversalCheckpoint: checkpoint,
      reversal: 'Pass reversalCheckpoint to reverse_existing_device_modulation_wrap. '
        + 'It moves the same device to its prior order and removes only the empty owned container.',
    }),
  };
}

function publicReversal(
  workspace: Workspace, result: ExistingDeviceWrapperReversal,
): Record<string, unknown> {
  return {
    applied: result.stages.some((item) => item.applied),
    complete: result.complete,
    partialReversal: !result.complete && result.stages.some((item) => item.applied),
    ...(result.failedStage === undefined ? {} : { failedStage: result.failedStage }),
    ...(result.why === undefined ? {} : { why: result.why }),
    stages: result.stages.map((item) => ({
      stage: item.stage,
      change: receiptOf(workspace.changes.require(item.changeId)),
    })),
    currentLocation: result.currentLocation,
    containerRemoved: result.containerRemoved,
    restoredDeviceOrder: result.restoredDeviceOrder,
  };
}

function externalCheckpoint(checkpoint: ExistingDeviceWrapperCheckpoint) {
  return {
    schemaVersion: checkpoint.schemaVersion,
    state: checkpoint.state,
    trackId: checkpoint.track.channelId,
    containerKind: checkpoint.containerKind,
    entryName: checkpoint.entryName,
    currentEntryName: checkpoint.currentEntryName,
    containerInsertChangeId: checkpoint.containerInsertTakeId,
    insertedContainerPosition: checkpoint.insertedContainerPosition,
    currentContainerPosition: checkpoint.currentContainerPosition,
    originalDeviceOrder: checkpoint.originalDeviceOrder,
    device: checkpoint.device,
  };
}

function internalCheckpoint(
  checkpoint: ExistingDeviceModulationReversalInput['checkpoint'],
): ExistingDeviceWrapperCheckpoint {
  return {
    schemaVersion: checkpoint.schemaVersion,
    state: checkpoint.state,
    track: trackAt(checkpoint.trackId),
    containerKind: checkpoint.containerKind,
    entryName: checkpoint.entryName,
    currentEntryName: checkpoint.currentEntryName,
    containerInsertTakeId: checkpoint.containerInsertChangeId,
    insertedContainerPosition: checkpoint.insertedContainerPosition,
    currentContainerPosition: checkpoint.currentContainerPosition,
    originalDeviceOrder: checkpoint.originalDeviceOrder,
    device: checkpoint.device,
  };
}

function rememberCheckpoint(
  workspace: Workspace,
  checkpoint: ReturnType<typeof externalCheckpoint>,
): void {
  let registry = issuedCheckpoints.get(workspace.changes);
  if (registry === undefined) {
    registry = new Map();
    issuedCheckpoints.set(workspace.changes, registry);
  }
  registry.set(checkpoint.containerInsertChangeId, JSON.stringify(checkpoint));
}

function isIssuedCheckpoint(
  workspace: Workspace,
  checkpoint: ExistingDeviceModulationReversalInput['checkpoint'],
): boolean {
  const normalized = externalCheckpoint(internalCheckpoint(checkpoint));
  return issuedCheckpoints.get(workspace.changes)?.get(checkpoint.containerInsertChangeId)
    === JSON.stringify(normalized);
}

function forgetCheckpoint(workspace: Workspace, changeId: string): void {
  issuedCheckpoints.get(workspace.changes)?.delete(changeId);
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
