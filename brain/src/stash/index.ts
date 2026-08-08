/**
 * The stash — PHASE-1 session 2, after the take store was retired (D17 rev).
 *
 * ⚠ The store's own header used to say *"session 1 produced takes as values; this
 * gives them a durable, branchable, human-owned home."* There is no home: the
 * system is stateless and **the project is the take log** (D18). What is here is
 * the one thing that outlived it, load-bearing three ways (D19) — unbranched
 * writes, the clip content fingerprint, and agent-edit reversal.
 *
 * ⚠ Two exports are the ones to notice. `StashLog` is the read half, and
 * `STASH_MUTATORS` names the other half so the ban on reaching it is reviewable
 * rather than merely stated (D17g, generalised by D20 to the MCP tool surface).
 */
export { ChangesetNotFoundError, DuplicateChangesetError, EmptySliceError, StashError } from './errors.js';

export { inBounds, sameValue } from './record.js';
export type {
  BoundaryCheck, BoundaryVerdict, ChangesetSummary, StashedChangeset,
} from './record.js';

export { WHOLE_TAKE, assertSelects, isWholeTake, selectClip, selectTrack, selects } from './slice.js';
export type { Slice } from './slice.js';

export { STASH_MUTATORS, Stash } from './stash.js';
export type {
  ReversalOptions, ReversalPlan, StashLog, StashOptions, StashWriter,
} from './stash.js';
