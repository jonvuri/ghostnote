/** Public read-only preset modulation inspection. */
import { readFile } from 'node:fs/promises';
import { isAbsolute } from 'node:path';

import { z } from 'zod';

import { inspectPresetModulation } from '../engine/index.js';

export const presetModulationInspectionInputSchema = {
  presetPath: z.string().min(1).superRefine((path, context) => {
    if (!isAbsolute(path)) {
      context.addIssue({ code: 'custom', message: 'The preset path must be absolute.' });
    }
    if (!path.toLowerCase().endsWith('.bwpreset')) {
      context.addIssue({ code: 'custom', message: 'The preset path must end in .bwpreset.' });
    }
  }).describe('Absolute path to one human-saved Bitwig preset file.'),
} as const;

export const presetModulationInspectionInputValidator = z.object(
  presetModulationInspectionInputSchema,
).strict();

export type PresetModulationInspectionInput = z.infer<
  typeof presetModulationInspectionInputValidator
>;

export async function runPresetModulationInspection(
  input: PresetModulationInspectionInput,
): Promise<ReturnType<typeof inspectPresetModulation>> {
  return inspectPresetModulation(await readFile(input.presetPath));
}
