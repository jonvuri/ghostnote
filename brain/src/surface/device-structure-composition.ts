/** Public vocabulary and result mapping for owned device-structure composition. */
import { z } from 'zod';

import {
  COMPOSITION_MODULATOR_TYPES, COMPOSITION_TARGET_IDS, COMPOSITION_TARGETS,
  TemplateCompositionError,
} from '../composition/index.js';
import {
  buildOwnedTemplateComposition,
  type CompositionLiveWitness, type OwnedTemplateCompositionOptions,
} from '../engine/index.js';
import { track as trackAt } from '../contract/index.js';
import { receiptOf } from './report.js';
import type { Workspace } from './workspace.js';

const target = z.enum(COMPOSITION_TARGET_IDS).describe(
  'Named native-device target with one exact remote control witness.',
);

const amount = z.number().finite().min(-1).max(1).describe(
  'Normalized modulation amount from -1 through 1.',
);

const modulatorType = z.enum(COMPOSITION_MODULATOR_TYPES).describe(
  'LFO, Random, Classic LFO, Vibrato, or Expressions.',
);

const modulatorEdit = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('add'),
    modulator: modulatorType,
    target,
    amount,
  }).strict(),
  z.object({
    kind: z.literal('replace'),
    existing: z.string().min(1).describe('Exact current modulator name in this entry.'),
    modulator: modulatorType,
    target: target.optional(),
    amount: amount.optional(),
  }).strict(),
  z.object({
    kind: z.literal('retarget'),
    modulator: z.string().min(1).describe('Exact current modulator name in this entry.'),
    target,
    amount,
  }).strict(),
  z.object({
    kind: z.literal('amount'),
    modulator: z.string().min(1).describe('Exact current modulator name in this entry.'),
    target,
    amount,
  }).strict(),
  z.object({
    kind: z.literal('delete'),
    modulator: z.string().min(1).describe('Exact current modulator name in this entry.'),
  }).strict(),
]);

const entry = z.object({
  deviceName: z.string().min(1).describe('Exact native-device catalog name.'),
  modulators: z.array(modulatorEdit).optional().describe(
    'Ordered named modulator edits for this entry.',
  ),
}).strict();

export const deviceStructureCompositionInputSchema = {
  trackId: z.string().min(1).describe('Durable track id from list_tracks.'),
  entries: z.array(entry).min(1).max(4).describe(
    'One through four ordered entries. Each exact device name must occur once.',
  ),
} as const;

export const deviceStructureCompositionInputValidator = z.object(
  deviceStructureCompositionInputSchema,
).strict().superRefine((input, context) => {
  const names = new Set<string>();
  input.entries.forEach((item, entryIndex) => {
    if (names.has(item.deviceName)) {
      context.addIssue({
        code: 'custom',
        path: ['entries', entryIndex, 'deviceName'],
        message: 'Each native-device name must occur once in one request.',
      });
    }
    names.add(item.deviceName);
    for (const [editIndex, edit] of (item.modulators ?? []).entries()) {
      if (edit.kind === 'replace' && (edit.target === undefined) !== (edit.amount === undefined)) {
        context.addIssue({
          code: 'custom',
          path: ['entries', entryIndex, 'modulators', editIndex],
          message: 'Replace must include target and amount together, or omit both.',
        });
      }
      if (!('target' in edit) || edit.target === undefined) continue;
      if (COMPOSITION_TARGETS[edit.target].deviceName !== item.deviceName) {
        context.addIssue({
          code: 'custom',
          path: ['entries', entryIndex, 'modulators', editIndex, 'target'],
          message: 'The named target is not available for this native device.',
        });
      }
    }
  });
});

export type DeviceStructureCompositionInput = z.infer<
  typeof deviceStructureCompositionInputValidator
>;

function publicBehavior(witness: CompositionLiveWitness): Record<string, unknown> | undefined {
  const behavior = witness.behavior;
  if (behavior === undefined) return undefined;
  return {
    verified: behavior.verified,
    expected: witness.request.behavior?.expected,
    target: witness.request.target,
    ...(behavior.verified ? {} : { why: behavior.why }),
    ...(behavior.selector === undefined ? {} : {
      selector: {
        pagePosition: behavior.selector.pageIndex,
        pageName: behavior.selector.pageName,
        controlPosition: behavior.selector.controlIndex,
        controlName: behavior.selector.controlName,
      },
    }),
    samples: behavior.samples,
    maximumDivergence: behavior.maximumDivergence,
    baseSpread: behavior.baseSpread,
  };
}

function publicWitness(witness: CompositionLiveWitness): Record<string, unknown> {
  const behavior = publicBehavior(witness);
  return {
    entryPosition: witness.request.entryIndex,
    operation: witness.request.kind,
    modulatorName: witness.request.modulatorPage,
    target: witness.request.target,
    verified: witness.verified,
    page: {
      verified: witness.pages.verified,
      name: witness.request.modulatorPage,
      expectedCount: witness.request.expectedPageCount,
      actualCount: witness.pages.witnesses[0]?.actualCount ?? 0,
      ...(witness.pages.why === undefined ? {} : { why: witness.pages.why }),
    },
    ...(behavior === undefined ? {} : { behavior }),
  };
}

function publicWarnings(warnings: readonly string[]): string[] {
  return warnings.some((warning) => /empty target/i.test(warning))
    ? ['One validated modulator has no active target.']
    : [];
}

function compositionRefusal(error: unknown): Record<string, unknown> {
  if (error instanceof TemplateCompositionError) {
    const why = error.stage === 'asset'
      ? 'The bundled composition source did not pass its integrity checks.'
      : error.stage === 'validate'
        ? 'The requested structure did not pass the complete pre-write checks.'
        : /unknown/i.test(error.message)
          ? 'The exact native-device name is not in the current catalog.'
          : /ambiguous/i.test(error.message)
            ? 'The exact native-device name matched more than one catalog entry.'
            : /unsupported/i.test(error.message)
              ? 'The named target is not available for that native device.'
              : 'The requested named device or modulator edit could not be resolved exactly.';
    return { refused: true, nothingWasWritten: true, why: `Nothing was written. ${why}` };
  }
  return {
    refused: true,
    nothingWasWritten: true,
    why: 'Nothing was written. Device-structure composition stopped before the project write completed.',
  };
}

/** Compose one complete public structure through the recorded Workspace seam. */
export async function runDeviceStructureComposition(
  workspace: Workspace,
  input: DeviceStructureCompositionInput,
  options: OwnedTemplateCompositionOptions = {},
): Promise<Record<string, unknown>> {
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
    const result = await buildOwnedTemplateComposition(workspace, {
      track: trackAt(input.trackId),
      entries: input.entries,
      expectedChain: bank.devices.map((device) => device.name),
      expectedEnabledChain: enabled as boolean[],
    }, options);
    const change = receiptOf(workspace.changes.require(result.take.id));
    const observed = result.verification.structure.entries;
    const containerKind = result.verification.structure.containerName ?? null;
    const routing = 'All entries run in parallel and receive the same MIDI input. '
      + 'This Instrument Layer does not route MIDI notes to separate entries.';
    return {
      applied: change.applied,
      containerKind,
      routing,
      requested: {
        entryOrder: input.entries.map((item) => item.deviceName),
        entries: input.entries.map((item, index) => ({ entryPosition: index, ...item })),
      },
      validated: {
        entries: result.composition.validatedEntries.map((item) => ({
          entryPosition: item.index,
          deviceName: item.deviceName,
          modulators: item.modulators.map((modulator) => ({
            position: modulator.index,
            name: modulator.name,
            category: modulator.category,
            routed: modulator.routed,
          })),
        })),
        warnings: publicWarnings(result.composition.validationWarnings),
      },
      observed: {
        verified: result.verification.structure.verified,
        containerKind,
        routing,
        entryOrder: observed.map((item) => item.deviceNames[0] ?? null),
        entries: observed.map((item) => ({
          entryPosition: item.index,
          entryName: item.chainName,
          devicesComplete: item.devicesComplete,
          deviceNames: item.deviceNames,
        })),
        ...(result.verification.structure.verified ? {} : {
          why: 'The inserted container did not match the complete requested structure.',
        }),
      },
      verification: {
        verified: result.verification.verified,
        witnesses: result.verification.witnesses.map(publicWitness),
      },
      insertedDevicePosition: result.minted?.chainIndex,
      change,
      reversal: 'revert_change removes the inserted container while its last proved position remains valid.',
    };
  } catch (error) {
    if (workspace.changes.list().some((change) => !priorChangeIds.has(change.id))) throw error;
    return compositionRefusal(error);
  }
}
