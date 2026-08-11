/**
 * The ghostnote adapter contract, v0 — PHASE-0 §Scope item 2.
 *
 * The typed seam every subsequent phase writes against. Two implementations live
 * under `src/adapters/`: `live/` (real Bitwig over the JSON-RPC bridge) and
 * `fake/` (in-process, models the traps). Nothing here knows the wire exists.
 *
 * Read `context/plan/PHASE-0-FOUNDATION.md` for why this is the first thing
 * built, and `context/PROJECT_PLAN.md` §4 for the standing rules every module
 * here encodes.
 */
export {
  ADDRESS_IDENTITY, addressKey, addressScene, addressTrack,
  clip, clipLaunch, clipPlay, device, notes, param, scene, slot, track,
} from './address.js';
export type {
  Address, AddressKey, AddressKind, BeatRange, ClipAddress, ClipLaunchAddress, ClipPlayAddress, DeviceAddress,
  NotesAddress, ParamAddress, SceneAddress, SlotAddress, TrackAddress,
} from './address.js';

export { SETTLE_MS, TICK_MS, budgetTicks } from './budgets.js';
export type { SettleBudget } from './budgets.js';

export { STEP_SIZES, chooseStepSize, stepSizeFor } from './grid.js';

export {
  contentDelta, contentTouching, deltaComplete, discontinuityBetween, sliceDelta,
  uncoveredAt, uncoveredBetween,
} from './observers.js';
export type { ContentDelta, ContentEvent, UncoveredIn } from './observers.js';

export {
  OP_BUMPS_SCENE_EPOCH, OP_SETTLE, OP_SETTLE_BEFORE, assertNever, assertOpsAddressable,
  assertOpsWritable, assertSceneRoom, assertSlotsFree, assertClipSources,
} from './ops.js';
export type { DeviceSource, Op, OpKind } from './ops.js';

export {
  GAIN_READ_SCALE, LAUNCH_MODES, LAUNCH_QUANTIZATIONS, NOTE_PROP_FIDELITY, NOTE_PROP_WRITE_ORDER, UNVERIFIED_NOTE_PROPS,
  UNWRITABLE_NOTE_PROPS, hasUnverifiedProps, orderedNoteProps, unwritableProps,
} from './state.js';
export type {
  ClipLaunchState, ClipPlayState, DeviceState, LaunchMode, LaunchQuantization, NoteProp, NoteRecord, ParamState, PropFidelity, Recurrence, TrackState,
} from './state.js';

export { blindCount, failures, fullyApplied, windowCovers } from './snapshot.js';
export type {
  BatchReceipt, Fidelity, OpReceipt, RevisionMark, Snapshot, StageReceipt, StateEntry, StateValue,
  WindowCoverage,
} from './snapshot.js';

export { planBudgetMs, planStages } from './stages.js';
export type { Stage } from './stages.js';

export { CONTRACT_TAG, CONTRACT_VERSION } from './version.js';
export type { AdapterCapabilities, AdapterInfo, BankLimits, ContractTag } from './version.js';

export {
  AddressUnresolvedError, BankWindowOverflowError, BlindSpotError, ContractError,
  ContractVersionError, InvalidOpError, SlotOccupiedError, StaleAddressError, UnsupportedOpError,
  WireDriftError, blindSpotError,
} from './errors.js';
export type { BankDimension, OccupiedSlotHazard } from './errors.js';

export type { BatchRequest, BitwigAdapter, ResolveResult, ResolvedAddress } from './adapter.js';
