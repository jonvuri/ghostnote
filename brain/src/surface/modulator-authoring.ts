/** Public semantic preset-modulator authoring vocabulary and tool runner. */
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { isAbsolute } from 'node:path';

import { z } from 'zod';

import { track as trackAt } from '../contract/index.js';
import { donorType, listDonorTypes } from '../bwmod/index.js';
import {
  ModulatorAuthoringError, authorSemanticModulatorEdit, inspectPresetModulation, modulationRoute,
  type ModulationVerification, type ModulatorPageVerification,
} from '../engine/index.js';
import { receiptOf } from './report.js';
import type { Workspace } from './workspace.js';

const ROUTED_MODULATOR_TYPES = listDonorTypes()
  .filter((type) => type.capabilities.includes('add'))
  .map((type) => type.id) as [string, ...string[]];
const REPLACE_MODULATOR_TYPES = listDonorTypes()
  .filter((type) => type.capabilities.includes('replace'))
  .map((type) => type.id) as [string, ...string[]];
const TARGET_RECIPE_IDS = [
  'polysynth-filter-frequency',
  'polysynth-filter-resonance',
  'sampler-amp-attack',
] as const;

type TargetRecipeId = typeof TARGET_RECIPE_IDS[number];
type DirectParameterTarget = {
  readonly parameterId: string;
  readonly parameterName: string;
};

interface TargetRecipe {
  readonly parameterId: string;
  readonly parameterName: string;
}

const TARGET_RECIPES: Readonly<Record<TargetRecipeId, TargetRecipe>> = {
  'polysynth-filter-frequency': {
    parameterId: 'CONTENTS/F1FREQ', parameterName: 'Filter Frequency',
  },
  'polysynth-filter-resonance': {
    parameterId: 'CONTENTS/F1RESO', parameterName: 'Filter Resonance',
  },
  'sampler-amp-attack': {
    parameterId: 'CONTENTS/AMP_ATTACK_TIME', parameterName: 'AEG Attack Time',
  },
};

const presetPath = z.string().min(1).superRefine((path, context) => {
  if (!isAbsolute(path)) {
    context.addIssue({ code: 'custom', message: 'The preset path must be absolute.' });
  }
  if (!path.toLowerCase().endsWith('.bwpreset')) {
    context.addIssue({ code: 'custom', message: 'The preset path must end in .bwpreset.' });
  }
  if (!existsSync(path)) {
    context.addIssue({ code: 'custom', message: 'The preset file does not exist.' });
  }
}).describe('Absolute path to one human-saved Bitwig preset file.');

const targetRecipe = z.enum(TARGET_RECIPE_IDS).describe(
  'Compatibility name for one of the three original native-device targets.',
);

const directParameterTarget = z.object({
  parameterId: z.string().min(1).describe(
    'Exact DirectParameter id returned by inspect_device_parameters.',
  ),
  parameterName: z.string().min(1).describe(
    'Exact parameter name returned with parameterId in the same stable inventory.',
  ),
}).strict();

const modulationTarget = z.union([directParameterTarget, targetRecipe]).describe(
  'An exact DirectParameter id and name, or one original compatibility name.',
);

const fingerprint = z.object({
  algorithm: z.literal('sha256'),
  sha256: z.string().regex(/^[0-9a-f]{64}$/).describe(
    'Exact SHA-256 returned by inspect_preset_modulation.',
  ),
  byteLength: z.number().int().min(1).describe(
    'Exact byte length returned with the SHA-256.',
  ),
}).strict().describe('Exact preset fingerprint returned by inspect_preset_modulation.');

const semanticDeviceStep = z.object({
  position: z.number().int().min(0),
  name: z.string().min(1),
}).strict();

const semanticLocation = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('self') }).strict(),
  z.object({
    kind: z.literal('container'),
    name: z.string().min(1),
  }).strict(),
  z.object({
    kind: z.literal('entry'),
    entry: z.object({
      position: z.number().int().min(0),
      name: z.string().min(1),
    }).strict(),
    devicePath: z.array(semanticDeviceStep).min(1),
  }).strict(),
]).describe('Exact semantic modulator location returned by inspect_preset_modulation.');

const pageCheck = z.object({
  pageName: z.string().min(1).describe('Exact remote page name.'),
  expectedCount: z.number().int().min(0).describe('Required count for that exact page name.'),
}).strict();

const behaviorCheck = z.object({
  expected: z.enum(['active', 'inactive']).describe(
    'Active requires live base-to-modulated divergence. Inactive requires no divergence.',
  ),
  target: modulationTarget,
}).strict();

const structuralCheck = z.object({
  kind: z.literal('inserted-host'),
}).strict().describe('Require the exact inspected host name after insertion.');

const operation = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('add'),
    modulator: z.enum(ROUTED_MODULATOR_TYPES).describe(
      'Manifest-backed modulator type that supports add and safe target assignment.',
    ),
    target: modulationTarget,
    amount: z.number().finite().min(-1).max(1).describe('Normalized modulation amount from -1 through 1.'),
  }).strict(),
  z.object({
    kind: z.literal('replace'),
    position: z.number().int().min(0).describe('Modulator position in the saved preset, from 0.'),
    modulator: z.enum(REPLACE_MODULATOR_TYPES).describe(
      'Manifest-backed modulator type that supports replace. Tier-1-only types refuse on sampled presets.',
    ),
  }).strict(),
  z.object({
    kind: z.literal('retarget'),
    position: z.number().int().min(0).describe('Modulator position in the saved preset, from 0.'),
    target: modulationTarget,
  }).strict(),
  z.object({
    kind: z.literal('delete'),
    position: z.number().int().min(0).describe('Modulator position in the saved preset, from 0.'),
  }).strict(),
  z.object({
    kind: z.literal('amount'),
    position: z.number().int().min(0).describe('Modulator position in the saved preset, from 0.'),
    amount: z.number().finite().min(-1).max(1).describe('Normalized modulation amount from -1 through 1.'),
  }).strict(),
]);

export const modulatorAuthoringInputSchema = {
  trackId: z.string().min(1).describe('Durable track id from list_tracks.'),
  presetPath,
  fingerprint,
  location: semanticLocation,
  operation,
  structuralCheck: structuralCheck.optional(),
  pageChecks: z.array(pageCheck).optional().describe(
    'Exact remote page counts that must hold at the selected semantic location.',
  ),
  behaviorChecks: z.array(behaviorCheck).optional().describe(
    'Exact DirectParameter controls that must prove active or inactive behavior after the edit.',
  ),
} as const;

export const modulatorAuthoringInputValidator = z.object(modulatorAuthoringInputSchema)
  .strict()
  .superRefine((input, context) => {
    const structuralOnly = input.structuralCheck !== undefined
      && input.pageChecks === undefined
      && input.behaviorChecks === undefined;
    const derivedPageCount = input.operation.kind === 'add'
      && input.pageChecks === undefined && !structuralOnly ? 1 : 0;
    const derivedBehaviorCount = input.operation.kind === 'add'
      && input.behaviorChecks === undefined && !structuralOnly ? 1 : 0;
    const witnessCount = (input.structuralCheck === undefined ? 0 : 1)
      + (input.pageChecks?.length ?? derivedPageCount)
      + (input.behaviorChecks?.length ?? derivedBehaviorCount);
    if (witnessCount === 0) {
      context.addIssue({
        code: 'custom',
        path: ['structuralCheck'],
        message: 'The operation requires an exact structural, page, or behavior check.',
      });
    }
  });

export type ModulatorAuthoringInput = z.infer<typeof modulatorAuthoringInputValidator>;

function publicBehavior(verification: ModulationVerification): Record<string, unknown> {
  const selector = verification.selector;
  return {
    verified: verification.verified,
    ...(verification.verified ? {} : { why: verification.why }),
    ...(selector === undefined ? {} : {
      selector: {
        parameterId: selector.directId,
      },
    }),
    samples: verification.samples,
    maximumDivergence: verification.maximumDivergence,
    baseSpread: verification.baseSpread,
  };
}

function witnessSelection(location: ModulatorAuthoringInput['location']):
  | { readonly chainName: string; readonly chainIndex: number }
  | undefined {
  if (location.kind !== 'entry') return undefined;
  const first = location.devicePath[0]!;
  const selected = location.devicePath[location.devicePath.length - 1]!;
  return { chainName: first.name, chainIndex: selected.position };
}

function requestedFacts(input: ModulatorAuthoringInput): Record<string, unknown> {
  return {
    fingerprint: input.fingerprint,
    location: input.location,
    operation: input.operation,
    structuralCheck: input.structuralCheck ?? null,
    pageChecks: input.pageChecks ?? [],
    behaviorChecks: input.behaviorChecks ?? [],
  };
}

function resolveTarget(target: TargetRecipeId | DirectParameterTarget): TargetRecipe {
  return typeof target === 'string' ? TARGET_RECIPES[target] : target;
}

function publicPages(verification: ModulatorPageVerification): Record<string, unknown> {
  return {
    verified: verification.verified,
    actualPages: verification.actualPages,
    checks: verification.witnesses.map((witness) => ({
      pageName: witness.pageName,
      expectedCount: witness.expectedCount,
      actualCount: witness.actualCount,
    })),
    ...(verification.why === undefined ? {} : { why: verification.why }),
  };
}

function authoringRefusal(error: unknown): Record<string, unknown> {
  const message = error instanceof Error ? error.message : String(error);
  if (/no measured footprint|removedFootprint|removed footprint|embeds a sample/i.test(message)) {
    return {
      refused: true,
      nothingWasWritten: true,
      why: 'Nothing was written. This sampled preset needs an exact measured adjustment for the '
        + 'selected asset or resident modulator, and no such measurement is available. An '
        + 'estimated value can make the complete preset fail to load.',
    };
  }
  if (/pass a listIndex|container list selection/i.test(message)) {
    return {
      refused: true,
      nothingWasWritten: true,
      why: 'Nothing was written. This preset contains more than one editable device list. The '
        + 'public operation cannot select one safely.',
    };
  }
  if (error instanceof ModulatorAuthoringError) {
    return {
      refused: true,
      nothingWasWritten: true,
      why: error.stage === 'validate'
        ? 'Nothing was written. The edited preset did not pass the complete pre-write load checks.'
        : 'Nothing was written. The saved preset does not support the requested edit safely.',
    };
  }
  return {
    refused: true,
    nothingWasWritten: true,
    why: 'Nothing was written. Modulator authoring stopped before the project write completed.',
  };
}

/** Run one fingerprinted semantic edit through the recorded write seam. */
export async function runModulatorAuthoring(
  workspace: Workspace,
  input: ModulatorAuthoringInput,
): Promise<Record<string, unknown>> {
  // A new record proves that execution crossed the project-write boundary.
  const priorChangeIds = new Set(workspace.changes.list().map((change) => change.id));
  try {
    const bank = await workspace.devices(trackAt(input.trackId));
    const enabled = bank.devices.map((device) => device.enabled);
    if (!bank.devicesComplete || enabled.some((value) => value === undefined)) {
      return {
        refused: true,
        nothingWasWritten: true,
        why: 'Nothing was written. The complete current device order and enabled state are required.',
      };
    }
    const expectedChain = bank.devices.map((device) => device.name);
    const expectedEnabledChain = enabled as boolean[];

    const preset = await readFile(input.presetPath);
    const inspection = inspectPresetModulation(preset);
    const edit = input.operation.kind === 'add'
      ? {
        kind: 'add' as const,
        donorId: donorType(input.operation.modulator, 'add').donorId,
        routing: {
          target: modulationRoute(resolveTarget(input.operation.target)),
          amount: input.operation.amount,
        },
      }
      : input.operation.kind === 'replace'
      ? {
        kind: 'replace' as const,
        index: input.operation.position,
        donorId: donorType(input.operation.modulator, 'replace').donorId,
      }
      : input.operation.kind === 'retarget'
        ? {
          kind: 'retarget' as const,
          index: input.operation.position,
          target: modulationRoute(resolveTarget(input.operation.target)),
        }
        : input.operation.kind === 'amount'
          ? {
            kind: 'amount' as const,
            index: input.operation.position,
            amount: input.operation.amount,
          }
          : { kind: 'delete' as const, index: input.operation.position };
    const nestedDevice = witnessSelection(input.location);
    const structuralOnly = input.structuralCheck !== undefined
      && input.pageChecks === undefined
      && input.behaviorChecks === undefined;
    const pageWitnesses = input.pageChecks?.map((check) => ({
      ...check,
      ...(nestedDevice === undefined ? {} : { nestedDevice }),
    })) ?? [];
    const behaviorInputs = input.behaviorChecks ?? (input.operation.kind === 'add' && !structuralOnly
      ? [{ expected: 'active' as const, target: input.operation.target }]
      : []);
    const behaviorWitnesses = behaviorInputs.map((check) => {
      const target = resolveTarget(check.target);
      return {
        expected: check.expected,
        ...target,
        ...(nestedDevice === undefined ? {} : { nestedDevice }),
      };
    });
    if (input.operation.kind === 'add' && input.pageChecks === undefined && !structuralOnly) {
      const type = donorType(input.operation.modulator, 'add');
      const selected = inspection.supported
        ? inspection.modulation.find((item) => JSON.stringify(item.location) === JSON.stringify(input.location))
        : undefined;
      const count = selected?.modulators.filter((item) => item.name === type.publicName).length ?? 0;
      pageWitnesses.push({
        pageName: type.publicName,
        expectedCount: count + 1,
        ...(nestedDevice === undefined ? {} : { nestedDevice }),
      });
    }
    const result = await authorSemanticModulatorEdit(workspace, {
      track: trackAt(input.trackId),
      templatePath: input.presetPath,
      fingerprint: input.fingerprint,
      location: input.location,
      edit,
      pageWitnesses,
      behaviorWitnesses,
      expectedChain,
      expectedEnabledChain,
    });
    const change = receiptOf(workspace.changes.require(result.take.id));
    return {
      applied: change.applied,
      requested: requestedFacts(input),
      decoded: inspection.supported
        ? {
          host: inspection.host,
          containerKind: inspection.containerKind,
          entries: inspection.entries,
          complete: inspection.complete,
        }
        : { supported: false, why: inspection.why },
      edited: {
        location: result.edit.location,
        before: result.edit.modulatorsBefore,
        after: result.edit.modulatorsAfter,
        siblingInventoriesUnchanged: result.edit.siblingInventoriesUnchanged,
        sampledPreset: result.edit.stubRelocation !== undefined,
        adjustedSampleReferences: result.edit.stubRelocation?.stubCount ?? 0,
      },
      observed: {
        insertedDevicePosition: result.minted?.chainIndex,
        pages: publicPages(result.verification.pages),
        behaviors: result.verification.behaviors.map(publicBehavior),
      },
      verified: {
        passed: result.verification.verified,
        insertedHost: result.minted !== undefined,
        pages: result.verification.pages.verified,
        behaviors: result.verification.behaviors.map((item) => ({
          passed: item.verified,
          ...(!item.verified && 'why' in item ? { why: item.why } : {}),
        })),
      },
      change,
      reversal: 'revert_change removes the inserted device while its last proved position remains valid.',
    };
  } catch (error) {
    if (workspace.changes.list().some((change) => !priorChangeIds.has(change.id))) {
      throw error;
    }
    return authoringRefusal(error);
  }
}
