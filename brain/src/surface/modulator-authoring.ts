/** Public modulator authoring vocabulary and tool runner. */
import { existsSync } from 'node:fs';
import { isAbsolute } from 'node:path';

import { z } from 'zod';

import { track as trackAt } from '../contract/index.js';
import {
  ModulatorAuthoringError, authorModulatorAdd, authorModulatorEdit, modulationRoute,
  type ModulationVerification, type ModulatorPageVerification,
} from '../engine/index.js';
import { receiptOf } from './report.js';
import type { Workspace } from './workspace.js';

const ROUTED_MODULATOR_TYPES = ['lfo', 'random', 'vibrato'] as const;
const REPLACE_MODULATOR_TYPES = [
  'lfo', 'random', 'classic-lfo', 'vibrato', 'expressions',
] as const;
const TARGET_RECIPE_IDS = [
  'polysynth-filter-frequency',
  'polysynth-filter-resonance',
  'sampler-amp-attack',
] as const;

type ReplaceModulatorType = typeof REPLACE_MODULATOR_TYPES[number];
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
    parameterId: 'CONTENTS/AMP_ATTACK_TIME', parameterName: 'Amp Attack',
  },
};

const DONOR_FOR_TYPE: Readonly<Record<ReplaceModulatorType, string>> = {
  lfo: 'lfo-sampler',
  random: 'random-sampler',
  'classic-lfo': 'classiclfo-poly',
  vibrato: 'vibrato-poly',
  expressions: 'expressions-poly',
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

const operation = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('add'),
    modulator: z.enum(ROUTED_MODULATOR_TYPES).describe(
      'LFO, Random, or Vibrato. These three assets support safe target assignment.',
    ),
    target: modulationTarget,
    amount: z.number().finite().min(-1).max(1).describe('Normalized modulation amount from -1 through 1.'),
  }).strict(),
  z.object({
    kind: z.literal('replace'),
    position: z.number().int().min(0).describe('Modulator position in the saved preset, from 0.'),
    modulator: z.enum(REPLACE_MODULATOR_TYPES).describe(
      'LFO, Random, Classic LFO, Vibrato, or Expressions. Expressions refuses on sampled presets.',
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
]);

export const modulatorAuthoringInputSchema = {
  trackId: z.string().min(1).describe('Durable track id from list_tracks.'),
  presetPath,
  operation,
  pageChecks: z.array(pageCheck).optional().describe(
    'Exact remote page counts that must hold after replace, retarget, or delete.',
  ),
  behaviorChecks: z.array(behaviorCheck).optional().describe(
    'Exact named controls that must prove active or inactive behavior after the edit.',
  ),
} as const;

export const modulatorAuthoringInputValidator = z.object(modulatorAuthoringInputSchema)
  .strict()
  .superRefine((input, context) => {
    if (input.operation.kind === 'add'
        && ((input.pageChecks?.length ?? 0) > 0 || (input.behaviorChecks?.length ?? 0) > 0)) {
      context.addIssue({
        code: 'custom',
        path: ['operation', 'target'],
        message: 'Add derives its one exact active behavior check from the named target.',
      });
    }
    if (input.operation.kind !== 'add'
        && (input.pageChecks?.length ?? 0) + (input.behaviorChecks?.length ?? 0) === 0) {
      context.addIssue({
        code: 'custom',
        path: ['pageChecks'],
        message: 'Replace, retarget, and delete require at least one exact page or behavior check.',
      });
    }
  });

export type ModulatorAuthoringInput = z.infer<typeof modulatorAuthoringInputValidator>;

function publicModulator(modulator: {
  readonly index: number;
  readonly deviceName: string;
  readonly category: string;
  readonly routes: readonly unknown[];
}): Record<string, unknown> {
  return {
    position: modulator.index,
    name: modulator.deviceName,
    category: modulator.category,
    routed: modulator.routes.length > 0,
  };
}

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

/** Run one format-hidden modulator operation through the recorded write seam. */
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

    if (input.operation.kind === 'add') {
      const target = resolveTarget(input.operation.target);
      const result = await authorModulatorAdd(workspace, {
        track: trackAt(input.trackId),
        templatePath: input.presetPath,
        donorId: DONOR_FOR_TYPE[input.operation.modulator],
        routing: { target: modulationRoute(target), amount: input.operation.amount },
        witness: target,
        expectedChain,
        expectedEnabledChain,
      });
      const change = receiptOf(workspace.changes.require(result.take.id));
      return {
        applied: change.applied,
        operation: {
          kind: 'add',
          modulator: input.operation.modulator,
          target: input.operation.target,
          amount: input.operation.amount,
        },
        insertedDevicePosition: result.minted?.chainIndex,
        modulatorCountBefore: result.edit.modulatorCountBefore,
        modulatorCountAfter: result.edit.modulatorCountAfter,
        sampledPreset: result.edit.stubRelocation !== undefined,
        adjustedSampleReferences: result.edit.stubRelocation?.stubCount ?? 0,
        validationWarnings: result.edit.validationWarnings,
        verification: {
          verified: result.verification.verified,
          pages: { verified: true, actualPages: [], checks: [] },
          behaviors: [publicBehavior(result.verification)],
        },
        change,
        reversal: 'revert_change removes the inserted device while its last proved position remains valid.',
      };
    }

    const edit = input.operation.kind === 'replace'
      ? {
        kind: 'replace' as const,
        index: input.operation.position,
        donorId: DONOR_FOR_TYPE[input.operation.modulator],
      }
      : input.operation.kind === 'retarget'
        ? {
          kind: 'retarget' as const,
          index: input.operation.position,
          target: modulationRoute(resolveTarget(input.operation.target)),
        }
        : { kind: 'delete' as const, index: input.operation.position };
    const result = await authorModulatorEdit(workspace, {
      track: trackAt(input.trackId),
      templatePath: input.presetPath,
      edit,
      pageWitnesses: input.pageChecks,
      behaviorWitnesses: input.behaviorChecks?.map((check) => {
        const target = resolveTarget(check.target);
        return {
          expected: check.expected,
          ...target,
        };
      }),
      expectedChain,
      expectedEnabledChain,
    });
    const change = receiptOf(workspace.changes.require(result.take.id));
    return {
      applied: change.applied,
      operation: input.operation,
      insertedDevicePosition: result.minted?.chainIndex,
      modulatorsBefore: result.edit.modulatorsBefore.map(publicModulator),
      modulatorsAfter: result.edit.modulatorsAfter.map(publicModulator),
      sampledPreset: result.edit.stubRelocation !== undefined,
      adjustedSampleReferences: result.edit.stubRelocation?.stubCount ?? 0,
      validationWarnings: result.edit.validationWarnings,
      verification: {
        verified: result.verification.verified,
        pages: publicPages(result.verification.pages),
        behaviors: result.verification.behaviors.map(publicBehavior),
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
