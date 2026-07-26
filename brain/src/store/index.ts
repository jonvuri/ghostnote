/**
 * The take store — PHASE-1 §Scope item 4, as a LIBRARY.
 *
 * Session 1 produced takes as values; this gives them a durable, branchable,
 * human-owned home, and answers what can be done to one: compared, jumped
 * between, branched from, and partially reverted by musical address (D5).
 *
 * ⚠ Two exports are the ones to notice. `TakeLog` is the READ half — the only
 * surface the agent ever sees (§8g, standing rule 8) — and `STORE_MUTATORS`
 * names the other half so the ban on reaching it is reviewable rather than
 * merely stated.
 */
export { STORE_FORMAT, emptyMeta, parseMeta, parseStoredTake, writeAtomic } from './format.js';
export type { StoreMeta, StoredTake, TakeSummary, UnreadableTake } from './format.js';

export {
  DuplicateTakeError, EmptySliceError, ProjectKeyError, StoreError, StoreFormatError,
  TakeCycleError, TakeIdError, TakeNotFoundError,
} from './errors.js';

export { ancestryOf, childrenOf, diffBetween, leavesOf, pathBetween, planBetween, planUndo } from './graph.js';
export type { AddressDiff, Path, PlanInput, TakeIndex } from './graph.js';

export {
  MemoryProjectKeySource, assertProjectKey, reconcilePointer, resolveProjectIdentity,
} from './project.js';
export type { Divergence, ProjectIdentity, ProjectKeySource } from './project.js';

export { WHOLE_TAKE, assertSelects, isWholeTake, selectClip, selectTrack, selects } from './slice.js';
export type { Slice } from './slice.js';

export { DEFAULT_RETENTION, STORE_MUTATORS, TakeStore, defaultStoreRoot } from './store.js';
export type { OpenStoreOptions, RetentionPolicy, StorePlan, TakeLog, TakeWriter } from './store.js';
