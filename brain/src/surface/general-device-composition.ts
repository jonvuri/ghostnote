/** Public schemas and mapping for general device-source composition. */
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { isAbsolute } from 'node:path';

import { z } from 'zod';

import { listDonorTypes } from '../bwmod/index.js';
import {
  GENERAL_DEVICE_COMPOSITION_CAPACITIES, GENERAL_DEVICE_CONTAINER_KINDS, NATIVE_CATALOG_PATH,
} from '../composition/index.js';
import { track as trackAt } from '../contract/index.js';
import {
  composeGeneralDeviceSources, reverseGeneralDeviceSources,
  type GeneralDeviceCompositionCheckpoint, type GeneralDeviceCompositionOptions,
  type GeneralDeviceCompositionResult, type GeneralDeviceCompositionReversal,
} from '../engine/index.js';
import { resolveExactNativeDevices, type NativeCatalog } from '../native-catalog/catalog.js';
import { receiptOf } from './report.js';
import type { Workspace } from './workspace.js';

const TYPES = listDonorTypes().filter((item) => item.capabilities.includes('add'));
const TYPE_IDS = TYPES.map((item) => item.id) as [string, ...string[]];

const orderItem = z.object({ name: z.string().min(1), enabled: z.boolean() }).strict();
const fingerprint = z.object({
  algorithm: z.literal('sha256'), sha256: z.string().regex(/^[0-9a-f]{64}$/),
  byteLength: z.number().int().min(1),
}).strict();
const deviceStep = z.object({ position: z.number().int().min(0), name: z.string().min(1) }).strict();
const semanticLocation = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('self') }).strict(),
  z.object({ kind: z.literal('container'), name: z.string().min(1) }).strict(),
  z.object({
    kind: z.literal('entry'),
    entry: z.object({ position: z.number().int().min(0), name: z.string().min(1) }).strict(),
    devicePath: z.array(deviceStep).min(1),
  }).strict(),
]);
const presetPath = z.string().min(1).superRefine((path, context) => {
  if (!isAbsolute(path)) context.addIssue({ code: 'custom', message: 'The preset path must be absolute.' });
  if (!path.toLowerCase().endsWith('.bwpreset')) {
    context.addIssue({ code: 'custom', message: 'The preset path must end in .bwpreset.' });
  }
  if (!existsSync(path)) context.addIssue({ code: 'custom', message: 'The preset file does not exist.' });
});

const source = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('native'), name: z.string().min(1) }).strict(),
  z.object({
    kind: z.literal('vst3'),
    classUid: z.string().regex(/^[0-9A-Fa-f]{32}$/),
  }).strict(),
  z.object({
    kind: z.literal('clap'),
    id: z.string().min(1).refine((id) => id === id.trim()
      && !/[\u0000-\u001f\u007f]/.test(id), 'A CLAP id cannot contain surrounding space or control characters.'),
  }).strict(),
  z.object({
    kind: z.literal('preset'), path: presetPath,
    fingerprint: fingerprint.optional(), modulatorLocation: semanticLocation.optional(),
  }).strict(),
  z.object({ kind: z.literal('existing-move'), devicePosition: z.number().int().min(0) }).strict(),
  z.object({ kind: z.literal('existing-copy'), devicePosition: z.number().int().min(0) }).strict(),
]);

const modulation = z.object({
  location: z.enum(['container', 'device']).describe(
    'Container authors late-bound outer modulation. Device authors inside a preset source.',
  ),
  modulator: z.enum(TYPE_IDS).describe('Manifest-backed type from list_modulator_types.'),
  target: z.object({
    parameterId: z.string().min(1).describe('Exact DirectParameter id.'),
    parameterName: z.string().min(1).describe('Exact DirectParameter name.'),
  }).strict(),
  amount: z.number().finite().min(-1).max(1),
  behaviorCheck: z.enum(['active', 'page-only']).optional().describe(
    'Use page-only only when the host does not expose a usable modulated-value witness.',
  ),
}).strict();

export const generalDeviceCompositionInputSchema = {
  trackId: z.string().min(1).describe('Durable track id from list_tracks.'),
  expectedDeviceOrder: z.array(orderItem).max(15).describe(
    'Exact complete top-level name and enabled-state order from inspect_devices.',
  ),
  containerKind: z.enum(GENERAL_DEVICE_CONTAINER_KINDS),
  containerPosition: z.number().int().min(0).default(0),
  entries: z.array(z.union([z.object({
    entryName: z.string().min(1).describe('Unique caller-supplied stable entry name.'),
    source,
    modulators: z.array(modulation).max(16),
  }).strict(), z.object({
    entryName: z.string().min(1).describe('Unique caller-supplied stable entry name.'),
    devices: z.array(z.object({
      source, modulators: z.array(modulation).max(16),
    }).strict()).min(1),
  }).strict()])).min(1),
} as const;

export const generalDeviceCompositionInputValidator = z.object(
  generalDeviceCompositionInputSchema,
).strict().superRefine((input, context) => {
  const names = input.entries.map((item) => item.entryName);
  if (new Set(names).size !== names.length) {
    context.addIssue({ code: 'custom', path: ['entries'], message: 'Each entryName must be unique.' });
  }
  for (const [index, entry] of input.entries.entries()) {
    for (const [deviceIndex, entryDevice] of inputDevices(entry).entries()) {
      const local = entryDevice.modulators.some((item) => item.location === 'device');
      if (local && entryDevice.source.kind !== 'preset') {
        context.addIssue({
          code: 'custom', path: ['entries', index, 'devices', deviceIndex, 'source'],
          message: 'Device-local modulator authoring requires a preset source.',
        });
      }
      if (local && entryDevice.source.kind === 'preset'
          && (entryDevice.source.fingerprint === undefined
            || entryDevice.source.modulatorLocation === undefined)) {
        context.addIssue({
          code: 'custom', path: ['entries', index, 'devices', deviceIndex, 'source'],
          message: 'Preset-local authoring requires fingerprint and modulatorLocation.',
        });
      }
    }
  }
});

const checkpointEntry = z.object({
  entryIndex: z.number().int().min(0), deviceIndex: z.number().int().min(0),
  entryName: z.string().min(1),
  sourceKind: z.enum(['native', 'vst3', 'clap', 'preset', 'existing-move', 'existing-copy']),
  observedName: z.string().min(1), enabled: z.boolean(),
  fingerprint: z.object({
    algorithm: z.literal('sha256'), sha256: z.string().regex(/^[0-9a-f]{64}$/),
    parameterCount: z.number().int().min(0),
  }).strict().optional(),
  fingerprintLocation: semanticLocation.optional(),
  ownedChangeId: z.string().min(1).optional(), originalPosition: z.number().int().min(0).optional(),
}).strict();

const publicCheckpoint = z.object({
  schemaVersion: z.literal(5),
  state: z.enum(['container-inserted', 'container-positioned', 'entries-prepared', 'composing']),
  trackId: z.string().min(1), containerKind: z.enum(GENERAL_DEVICE_CONTAINER_KINDS),
  requestedContainerPosition: z.number().int().min(0)
    .max(GENERAL_DEVICE_COMPOSITION_CAPACITIES.topLevelContainerPositions - 1),
  containerInsertChangeId: z.string().min(1), insertedContainerPosition: z.number().int().min(0),
  currentContainerPosition: z.number().int().min(0),
  seedUnchanged: z.boolean(),
  lastWriteAt: z.object({
    revision: z.number().int().min(0), generation: z.string(), project: z.string(),
  }).strict(),
  originalDeviceOrder: z.array(orderItem).max(15),
  entryNames: z.array(z.string().min(1)).min(1).max(5),
  preparedEntryNames: z.array(z.string().min(1)).max(5),
  completedEntries: z.array(checkpointEntry).max(20),
  pendingUnwitnessedSource: z.object({
    entryIndex: z.number().int().min(0), deviceIndex: z.number().int().min(0),
    sourceKind: z.enum(['native', 'vst3', 'clap', 'preset', 'existing-move', 'existing-copy']),
    ownedChangeId: z.string().min(1), chainIndex: z.number().int().min(0),
    at: z.object({
      revision: z.number().int().min(0), generation: z.string(), project: z.string(),
    }).strict(),
  }).strict().optional(),
  pendingEntry: checkpointEntry.extend({
    location: z.enum(['top-level', 'container-entry']),
  }).strict().optional(),
  reversalRemainingEntries: z.array(checkpointEntry).max(20).optional(),
  reversalPendingTopLevel: checkpointEntry.extend({
    position: z.number().int().min(0),
  }).strict().optional(),
  reversalContainerRemoved: z.literal(true).optional(),
}).strict();

export const generalDeviceCompositionReversalInputSchema = {
  checkpoint: publicCheckpoint.describe('Exact checkpoint returned by compose_device_sources.'),
} as const;
export const generalDeviceCompositionReversalInputValidator = z.object(
  generalDeviceCompositionReversalInputSchema,
).strict();

export type GeneralDeviceCompositionInput = z.infer<typeof generalDeviceCompositionInputValidator>;
export type GeneralDeviceCompositionReversalInput = z.infer<
  typeof generalDeviceCompositionReversalInputValidator
>;

export interface GeneralDeviceCompositionSurfaceOptions extends GeneralDeviceCompositionOptions {
  readonly catalogPath?: string;
}

const issued = new WeakMap<object, Map<string, string>>();

/** Resolve exact native names, then run the guarded workflow. */
export async function runGeneralDeviceComposition(
  workspace: Workspace,
  input: GeneralDeviceCompositionInput,
  options: GeneralDeviceCompositionSurfaceOptions = {},
): Promise<Record<string, unknown>> {
  let catalog: NativeCatalog;
  try {
    catalog = JSON.parse(await readFile(options.catalogPath ?? NATIVE_CATALOG_PATH, 'utf8')) as NativeCatalog;
  } catch (error) {
    return refusal(error);
  }
  const nativeNames = input.entries.flatMap((entry) => inputDevices(entry).flatMap((entryDevice) =>
    entryDevice.source.kind === 'native' ? [entryDevice.source.name] : []));
  let nativeByName = new Map<string, string>();
  try {
    nativeByName = new Map(resolveExactNativeDevices(catalog, nativeNames)
      .map((item) => [item.name, item.uuid]));
  } catch (error) {
    return refusal(error);
  }

  const result = await composeGeneralDeviceSources(workspace, {
    track: trackAt(input.trackId), expectedDeviceOrder: input.expectedDeviceOrder,
    containerKind: input.containerKind, containerPosition: input.containerPosition,
    entries: input.entries.map((entry) => {
      return {
        entryName: entry.entryName,
        devices: inputDevices(entry).map((entryDevice) => {
          const resolvedSource = entryDevice.source.kind === 'native'
            ? { ...entryDevice.source, uuid: nativeByName.get(entryDevice.source.name)! }
            : entryDevice.source;
          return {
            source: resolvedSource,
            modulators: entryDevice.modulators.map((item) => {
              const type = TYPES.find((candidate) => candidate.id === item.modulator)!;
              return {
                ...item, donorId: type.donorId, pageName: type.publicName,
                behaviorCheck: item.behaviorCheck ?? 'active',
              };
            }),
          };
        }),
      };
    }),
  }, options);
  return publicResult(workspace, input, result);
}

/** Continue one exact issued reversal checkpoint. */
export async function runGeneralDeviceCompositionReversal(
  workspace: Workspace,
  input: GeneralDeviceCompositionReversalInput,
): Promise<Record<string, unknown>> {
  if (!isIssued(workspace, input.checkpoint)) {
    return {
      refused: true, nothingWasWritten: true,
      why: 'Nothing was written. The checkpoint is not the exact value issued in this session.',
    };
  }
  const checkpoint = internalCheckpoint(input.checkpoint);
  try {
    workspace.changes.require(checkpoint.containerInsertTakeId);
  } catch {
    return {
      refused: true, nothingWasWritten: true,
      why: 'Nothing was written. The owned container insertion is not in this session.',
    };
  }
  const result = await reverseGeneralDeviceSources(workspace, checkpoint);
  if (result.complete) {
    issued.get(workspace.changes)?.delete(checkpoint.containerInsertTakeId);
  } else if (result.checkpoint !== undefined) {
    remember(workspace, externalCheckpoint(result.checkpoint));
  }
  return publicReversal(workspace, result);
}

function publicResult(
  workspace: Workspace, input: GeneralDeviceCompositionInput, result: GeneralDeviceCompositionResult,
): Record<string, unknown> {
  if (result.checkpoint === undefined && result.stages.length === 0) {
    return {
      refused: true, nothingWasWritten: true, capacities: result.capacities,
      why: result.why ?? 'Nothing was written.',
    };
  }
  const checkpoint = result.checkpoint === undefined ? undefined : externalCheckpoint(result.checkpoint);
  if (checkpoint !== undefined) remember(workspace, checkpoint);
  return {
    applied: result.stages.some((item) => item.applied), complete: result.complete,
    partialCompletion: !result.complete && result.stages.some((item) => item.applied),
    ...(result.failedStage === undefined ? {} : { failedStage: result.failedStage }),
    ...(result.why === undefined ? {} : { why: result.why }),
    requested: {
      containerKind: input.containerKind, containerPosition: input.containerPosition,
      entries: input.entries,
    },
    capacities: result.capacities,
    stages: result.stages.map((item) => ({
      stage: item.stage, ...(item.entryIndex === undefined ? {} : { entryIndex: item.entryIndex }),
      change: receiptOf(workspace.changes.require(item.changeId)),
    })),
    entries: result.entries,
    ...(result.structure === undefined ? {} : { structure: result.structure }),
    ...(checkpoint === undefined ? {} : {
      reversalCheckpoint: checkpoint,
      reversal: 'Pass reversalCheckpoint to reverse_device_source_composition.',
    }),
  };
}

function publicReversal(
  workspace: Workspace, result: GeneralDeviceCompositionReversal,
): Record<string, unknown> {
  const checkpoint = result.checkpoint === undefined ? undefined : externalCheckpoint(result.checkpoint);
  return {
    applied: result.stages.some((item) => item.applied), complete: result.complete,
    partialReversal: !result.complete && result.stages.some((item) => item.applied),
    ...(result.failedStage === undefined ? {} : { failedStage: result.failedStage }),
    ...(result.why === undefined ? {} : { why: result.why }),
    stages: result.stages.map((item) => ({
      stage: item.stage, ...(item.entryIndex === undefined ? {} : { entryIndex: item.entryIndex }),
      change: receiptOf(workspace.changes.require(item.changeId)),
    })),
    containerRemoved: result.containerRemoved, restoredDeviceOrder: result.restoredDeviceOrder,
    ...(checkpoint === undefined ? {} : {
      reversalCheckpoint: checkpoint,
      reversal: 'Retry reverse_device_source_composition with reversalCheckpoint.',
    }),
  };
}

function externalCheckpoint(checkpoint: GeneralDeviceCompositionCheckpoint) {
  return {
    schemaVersion: checkpoint.schemaVersion, state: checkpoint.state,
    trackId: checkpoint.track.channelId, containerKind: checkpoint.containerKind,
    requestedContainerPosition: checkpoint.requestedContainerPosition,
    containerInsertChangeId: checkpoint.containerInsertTakeId,
    insertedContainerPosition: checkpoint.insertedContainerPosition,
    currentContainerPosition: checkpoint.currentContainerPosition,
    seedUnchanged: checkpoint.seedUnchanged, lastWriteAt: checkpoint.lastWriteAt,
    originalDeviceOrder: checkpoint.originalDeviceOrder,
    entryNames: checkpoint.entryNames, preparedEntryNames: checkpoint.preparedEntryNames,
    completedEntries: checkpoint.completedEntries,
    ...(checkpoint.pendingUnwitnessedSource === undefined ? {} : {
      pendingUnwitnessedSource: checkpoint.pendingUnwitnessedSource,
    }),
    ...(checkpoint.pendingEntry === undefined ? {} : { pendingEntry: checkpoint.pendingEntry }),
    ...(checkpoint.reversalRemainingEntries === undefined ? {} : {
      reversalRemainingEntries: checkpoint.reversalRemainingEntries,
    }),
    ...(checkpoint.reversalPendingTopLevel === undefined ? {} : {
      reversalPendingTopLevel: checkpoint.reversalPendingTopLevel,
    }),
    ...(checkpoint.reversalContainerRemoved === undefined ? {} : {
      reversalContainerRemoved: checkpoint.reversalContainerRemoved,
    }),
  };
}

function internalCheckpoint(
  checkpoint: GeneralDeviceCompositionReversalInput['checkpoint'],
): GeneralDeviceCompositionCheckpoint {
  return {
    schemaVersion: checkpoint.schemaVersion, state: checkpoint.state,
    track: trackAt(checkpoint.trackId), containerKind: checkpoint.containerKind,
    requestedContainerPosition: checkpoint.requestedContainerPosition,
    containerInsertTakeId: checkpoint.containerInsertChangeId,
    insertedContainerPosition: checkpoint.insertedContainerPosition,
    currentContainerPosition: checkpoint.currentContainerPosition,
    seedUnchanged: checkpoint.seedUnchanged, lastWriteAt: checkpoint.lastWriteAt,
    originalDeviceOrder: checkpoint.originalDeviceOrder,
    entryNames: checkpoint.entryNames, preparedEntryNames: checkpoint.preparedEntryNames,
    completedEntries: checkpoint.completedEntries,
    ...(checkpoint.pendingUnwitnessedSource === undefined ? {} : {
      pendingUnwitnessedSource: checkpoint.pendingUnwitnessedSource,
    }),
    ...(checkpoint.pendingEntry === undefined ? {} : { pendingEntry: checkpoint.pendingEntry }),
    ...(checkpoint.reversalRemainingEntries === undefined ? {} : {
      reversalRemainingEntries: checkpoint.reversalRemainingEntries,
    }),
    ...(checkpoint.reversalPendingTopLevel === undefined ? {} : {
      reversalPendingTopLevel: checkpoint.reversalPendingTopLevel,
    }),
    ...(checkpoint.reversalContainerRemoved === undefined ? {} : {
      reversalContainerRemoved: checkpoint.reversalContainerRemoved,
    }),
  };
}

function remember(workspace: Workspace, checkpoint: ReturnType<typeof externalCheckpoint>): void {
  let registry = issued.get(workspace.changes);
  if (registry === undefined) {
    registry = new Map();
    issued.set(workspace.changes, registry);
  }
  registry.set(checkpoint.containerInsertChangeId, JSON.stringify(checkpoint));
}

function isIssued(
  workspace: Workspace, checkpoint: GeneralDeviceCompositionReversalInput['checkpoint'],
): boolean {
  return issued.get(workspace.changes)?.get(checkpoint.containerInsertChangeId)
    === JSON.stringify(externalCheckpoint(internalCheckpoint(checkpoint)));
}

function refusal(error: unknown): Record<string, unknown> {
  return {
    refused: true, nothingWasWritten: true, capacities: GENERAL_DEVICE_COMPOSITION_CAPACITIES,
    why: `Nothing was written. ${error instanceof Error ? error.message : String(error)}`,
  };
}

function inputDevices(entry: {
  readonly entryName: string;
  readonly source: z.infer<typeof source>;
  readonly modulators: readonly z.infer<typeof modulation>[];
} | {
  readonly entryName: string;
  readonly devices: readonly {
    readonly source: z.infer<typeof source>;
    readonly modulators: readonly z.infer<typeof modulation>[];
  }[];
}) {
  return 'devices' in entry ? entry.devices : [{ source: entry.source, modulators: entry.modulators }];
}
