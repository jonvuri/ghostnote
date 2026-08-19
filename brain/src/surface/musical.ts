/** Public rendering for the shared musical planner. */
import {
  musicalPatchSchema,
  type MusicalPlannerResult,
} from '../musical/index.js';

export const musicalToolInputSchema = musicalPatchSchema.shape;
export const musicalToolInputValidator = musicalPatchSchema;

export const MUSICAL_REFUSAL_TEXT =
  'nothing was written. The musical patch cannot be applied as given. Check patch version 1, '
  + 'the selected generation or transformation tool, target clips and channels, operation order, '
  + 'caller seed, clip rows, timing grid, note identities, writable expression, and MIDI 0-127.';

export const MUSICAL_RESULT_CONTRACT = {
  format: 'ghostnote-musical-result',
  version: 1,
  fields: [
    'operation', 'applied', 'outputs', 'differences', 'warnings', 'clipBlocks',
    'changes', 'readback', 'reversal', 'next',
  ],
  procedures: {
    read: 'Call read_clip with an output trackId, row, and channel.',
    revert: 'Call revert_change with a changeId returned here.',
    open: 'Call show_changed_clip with a changeId and one output target.',
  },
  refusal: MUSICAL_REFUSAL_TEXT,
} as const;

export type PublicMusicalResult = ReturnType<typeof publicMusicalResult>;

/** Keep planner detail, but use public change and reversal terms. */
export function publicMusicalResult(result: MusicalPlannerResult) {
  return {
    format: MUSICAL_RESULT_CONTRACT.format,
    version: MUSICAL_RESULT_CONTRACT.version,
    operation: result.boundary,
    applied: result.changesets.some((change) => change.applied),
    outputs: result.results,
    differences: result.differences,
    warnings: result.warnings,
    clipBlocks: result.clipBlocks.map((block) => ({
      trackId: block.trackId,
      firstRow: block.firstRow,
      lastRow: block.lastRow,
      createdRows: block.createdRows,
      protectedRows: block.protectedRows,
    })),
    changes: result.changesets.map((change) => ({
      changeId: change.id,
      sequence: change.seq,
      applied: change.applied,
      reversalQuality: change.fidelity,
    })),
    readback: {
      disagreements: result.disagreements,
      unverified: result.unverified,
      concurrent: result.concurrent,
      ...(result.undecidable === undefined ? {} : { undecidable: result.undecidable }),
    },
    reversal: result.reversal.map((item) => ({
      changeId: item.changeId,
      quality: item.fidelity,
      notRestored: item.unrestored,
    })),
    next: MUSICAL_RESULT_CONTRACT.procedures,
  };
}
