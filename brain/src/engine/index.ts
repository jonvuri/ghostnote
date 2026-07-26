/**
 * The write engine — PHASE-1 §Scope items 2, 3 and 5, as a LIBRARY.
 *
 * Deliberately not a module with state and deliberately not a process. The
 * daemon (session 3) will host one `Executor` per bridge connection and may
 * re-create it when Bitwig restarts; the take store (session 2) persists what
 * this produces; the control layer (session 4) triggers its revert. All three
 * compose a value, which is only possible because nothing here is global.
 */
export { Executor, disagreementsOf } from './executor.js';
export type { ExecutorOptions, RevertResult } from './executor.js';

export { labelTarget, notePropCaveats, splitReplayable, worse, worstOf } from './fidelity.js';

export { revertOps } from './revert.js';
export type { RevertInput, RevertPlan, Unrestored } from './revert.js';

export { takeWriteSet } from './take.js';
export type { ApplyReport, Disagreement, Take, TakeValue, Unverified } from './take.js';

export { isAtRisk, structuralRisk, writeSet, writeSetOf } from './write-set.js';
export type { Restore, StructuralRisk, UnrevertableOp, WriteSet, WriteTarget } from './write-set.js';
