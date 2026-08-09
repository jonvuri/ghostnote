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
  clip, device, notes, param, scene, slot, track,
} from './address.js';
export type {
  Address, AddressKey, AddressKind, BeatRange, ClipAddress, DeviceAddress,
  NotesAddress, ParamAddress, SceneAddress, SlotAddress, TrackAddress,
} from './address.js';

export { SETTLE_MS, TICK_MS, budgetTicks } from './budgets.js';
export type { SettleBudget } from './budgets.js';

export { STEP_SIZES, chooseStepSize, stepSizeFor } from './grid.js';

export { contentTouching, deltaComplete, discontinuityBetween, sliceDelta } from './observers.js';
export type { ContentDelta, ContentEvent } from './observers.js';

export { OP_BUMPS_SCENE_EPOCH, OP_SETTLE, OP_SETTLE_BEFORE, assertNever, assertOpsWritable } from './ops.js';
export type { DeviceSource, Op, OpKind } from './ops.js';

export {
  GAIN_READ_SCALE, NOTE_PROP_FIDELITY, NOTE_PROP_WRITE_ORDER, UNVERIFIED_NOTE_PROPS,
  UNWRITABLE_NOTE_PROPS, hasUnverifiedProps, orderedNoteProps, unwritableProps,
} from './state.js';
export type {
  DeviceState, NoteProp, NoteRecord, ParamState, PropFidelity, Recurrence, TrackState,
} from './state.js';

export { failures, fullyApplied } from './snapshot.js';
export type {
  BatchReceipt, Fidelity, OpReceipt, RevisionMark, Snapshot, StageReceipt, StateEntry, StateValue,
} from './snapshot.js';

export { planBudgetMs, planStages } from './stages.js';
export type { Stage } from './stages.js';

export { CONTRACT_TAG, CONTRACT_VERSION } from './version.js';
export type { AdapterCapabilities, AdapterInfo, BankLimits, ContractTag } from './version.js';

export {
  AddressUnresolvedError, BankWindowOverflowError, BlindSpotError, ContractError,
  ContractVersionError, InvalidOpError, StaleAddressError, UnsupportedOpError, WireDriftError,
} from './errors.js';

export type { BatchRequest, BitwigAdapter, ResolveResult, ResolvedAddress } from './adapter.js';
