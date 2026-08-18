/**
 * The step grid — which grid a set of notes implies.
 *
 * This lived in the live encoder while the encoder was the only thing that cared:
 * steps are a wire detail, the contract is beats-native, and standing rule 12
 * says the grid is "a per-operation view, not global state". All still true at
 * the boundary — nothing outside `encodeOp` ever puts a step index on a wire.
 *
 * ⚠ What changed is that the grid stopped being only a rendering choice. E15-D
 * measured that `cursor.setNoteProps` READS through the grid, and that a
 * `setStepSize` which actually CHANGES the grid makes that read unusable for
 * ~120ms — every property in the op is then discarded in silence. So whether two
 * ops imply the SAME grid is now a correctness question, and `planStages` and the
 * fake both have to be able to ask it. A mitigation only one adapter can see is
 * one the conformance suite cannot assert, which is the same reason
 * `orderedNoteProps` lives in the contract rather than in the encoder.
 */
import { InvalidOpError } from './errors.js';
import type { NoteRecord } from './state.js';

/**
 * Candidate step sizes in beats, coarsest first.
 *
 * Coarsest-that-is-exact is the right choice for two reasons. The grid bounds how
 * many steps a clip scan walks, and — the load-bearing one — a note that does not
 * land on the grid is not merely imprecise: E2 found off-grid notes are reported
 * snapped DOWN (a note at beat 0.09375 scans as x=0 on a 0.25 grid), so a lossy
 * grid choice would corrupt a snapshot silently.
 */
export const STEP_SIZES: readonly number[] = [
  1,
  0.5,
  1 / 3,
  0.25,
  1 / 6,
  0.125,
  1 / 12,
  0.0625,
  1 / 24,
  0.03125,
  1 / 48,
  0.015625,
];

const EPSILON = 1e-9;

/**
 * The coarsest grid on which every start and duration is exact, or `undefined`
 * when the notes are finer than the grid floor.
 *
 * The non-throwing form, because two of its three callers are asking a question
 * ("do these two ops want the same grid?") rather than emitting a frame, and for
 * them "no representable grid" is an answer, not an error.
 */
export function stepSizeFor(notes: readonly NoteRecord[]): number | undefined {
  const values = notes.flatMap((n) => [n.startBeats, n.durationBeats]);
  return STEP_SIZES.find((size) => values.every((v) => Math.abs(v / size - Math.round(v / size)) < EPSILON));
}

/** The same answer, as a refusal — for the encoder, which has to emit something. */
export function chooseStepSize(notes: readonly NoteRecord[]): number {
  const size = stepSizeFor(notes);
  if (size !== undefined) return size;
  const finest = STEP_SIZES[STEP_SIZES.length - 1]!;
  throw new InvalidOpError(
    'note.write',
    `note positions are finer than the ${finest}-beat grid floor; ` +
      'Bitwig would report them snapped DOWN to the nearest step (E2), silently ' +
      'corrupting any snapshot taken afterwards.',
  );
}
