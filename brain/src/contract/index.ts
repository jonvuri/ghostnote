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
  ADDRESS_IDENTITY, addressKey, addressScene, addressTrack, chainPath, isNestedDevice,
  chain, clip, clipLaunch, clipMetadata, clipPlay, device, deviceEnabled, deviceIn, deviceSlot, drumPad, notes, param,
  remote, remotes, scene, slot, track,
} from './address.js';
export type {
  Address, AddressKey, AddressKind, BeatRange, ChainAddress, ClipAddress, ClipLaunchAddress,
  ClipMetadataAddress, ClipPlayAddress, DeviceAddress, DeviceEnabledAddress, DeviceParentAddress, DeviceSlotAddress,
  DrumPadAddress,
  NotesAddress, ParamAddress, RemoteAddress, RemotesAddress, SceneAddress, SlotAddress, TrackAddress,
} from './address.js';

export {
  chainCopyUnnamed, lookupChain, lookupDevice, lookupDeviceSlot, lookupNestedDevice, mintedChain, nestingDepth,
  nestingObservable, projectedReorder, reorderIndistinguishable, verifyDeviceRelocation,
  verifyChainSolo, verifyDeviceReorder, verifyExclusiveChain,
} from './chains.js';
export type {
  ChainLookup, ChainMint, ChainMiss, DeviceLookup, DeviceSlotLookup, ObservedChain, ObservedContainer,
  ObservedDevice, ObservedDeviceSequence, ObservedDeviceSlot,
} from './chains.js';

export { SETTLE_MS, TICK_MS, budgetTicks } from './budgets.js';
export type { SettleBudget } from './budgets.js';

export {
  CLIP_SNAPSHOT_VERSION, CLIP_SOURCE_DOMAIN, ClipSnapshotRefusedError, clipSnapshotFrom, clipSourceFingerprint,
  decodeClipSnapshotRef, encodeClipSnapshotRef, guardVerdict, judgeClipSnapshot, snapshotAddresses, snapshotClip,
} from './clip-snapshot.js';
export type {
  ClipSnapshot, ClipSnapshotRef, ClipSnapshotVerdict, ClipSnapshotVerdictKind, ClipSourceCapture,
  ClipSourceDigest, RawSourceRecord, RawSourceValue,
} from './clip-snapshot.js';

export {
  CLIP_COLOR_TOLERANCE, EXACT_CLIP_COLORS, clipColorWireBytes, clipColorWithinTolerance, exactClipColor,
  supportedClipColors,
} from './clip-color.js';
export {
  CLIP_METADATA_FIELDS, assertClipMetadataFields, changedClipMetadataFields, clipMetadataDifferences,
  ownedClipMetadata,
} from './clip-metadata.js';
export type { ClipMetadataDifference, ClipMetadataField } from './clip-metadata.js';
export type { ClipColorBytes, ExactClipColor } from './clip-color.js';

export { STEP_SIZES, chooseStepSize, stepSizeFor, noteReadCell, noteReadStart } from './grid.js';

export {
  contentDelta, contentTouching, deltaComplete, discontinuityBetween, sliceDelta,
  uncoveredAt, uncoveredBetween,
} from './observers.js';
export type { ContentDelta, ContentEvent, UncoveredIn } from './observers.js';

export {
  CREATABLE_TRACK_KINDS, OP_BUMPS_SCENE_EPOCH, OP_SETTLE, OP_SETTLE_BEFORE, assertChainActivatable, assertChainCreatable, assertChainRelocatable, assertChainRenamable, assertDeviceInsertable, assertDeviceRelocatable, assertDrumPadInsertable, assertDevicesRoutable,
  assertNever, assertOpsAddressable, assertOpsWritable, assertSceneRoom, assertTrackRoom,
  assertSlotsFree, assertClipSources, launcherSlotsOf, sceneRowsOf,
} from './ops.js';
export type {
  CreatableTrackKind, DeviceSource, ObservedDeviceBank, ObservedDrumPad, ObservedDrumPadBank, Op, OpKind,
} from './ops.js';

export {
  GAIN_READ_SCALE, LAUNCH_MODES, LAUNCH_QUANTIZATIONS, NOTE_PROP_FIDELITY, NOTE_PROP_WRITE_ORDER, UNVERIFIED_NOTE_PROPS,
  UNWRITABLE_NOTE_PROPS, hasUnverifiedProps, orderedNoteProps, unwritableProps,
  BASE_TO_MODULATED_WARNING_TOLERANCE, discreteNormalizedValues, discreteValueIsRepresentable,
  hasMeaningfulBaseToModulatedDivergence, resolveRemoteSelector,
} from './state.js';
export type {
  ClipColor, ClipLaunchState, ClipMetadataState, ClipPlayState, DeviceState, LaunchMode,
  LaunchQuantization, NoteProp, NoteRecord, ParamState, PropFidelity, Recurrence,
  RemoteControlState, RemoteControlsState, RemotePageState, RemoteSelectorResolution, TrackState,
} from './state.js';

export {
  blindCount, failures, fullyApplied, recordUnpinnedCursorTracks, unpinnedCursorTracksOf, windowCovers,
} from './snapshot.js';
export type {
  BatchReceipt, Fidelity, OpReceipt, RevisionMark, Snapshot, StageReceipt, StateEntry, StateValue,
  WindowCoverage,
} from './snapshot.js';

export { planBudgetMs, planStages } from './stages.js';
export type { Stage } from './stages.js';

export { CONTRACT_TAG, CONTRACT_VERSION } from './version.js';
export type { AdapterCapabilities, AdapterInfo, BankLimits, ContractTag } from './version.js';

export {
  AddressUnresolvedError, BankWindowOverflowError, BlindSpotError, CLIP_READ_SOUNDING_CELLS, ClipReadLimitError, ContractError,
  ContractVersionError, InvalidOpError, NoteTimingUnrepresentableError, SlotOccupiedError,
  ParameterValueUnrepresentableError, RemoteSelectorError, StaleAddressError, UnsupportedOpError, WireDriftError,
  RuntimeProfileMismatchError, WriterWidthError, blindSpotError,
} from './errors.js';
export type { BankDimension, OccupiedSlotHazard } from './errors.js';

export {
  CollapsedGroupRowError, GROUP_TRACK_TYPE, GroupSlotError, assertNoGroupSlotAddresses, assertNoGroupSlotOps, isGroupTrack,
  opsHaveSceneRows, sceneGuardError, sceneGuardMismatch, sceneGuardOf,
} from './write-boundary.js';
export type { SceneGuard, SceneGuardField } from './write-boundary.js';

export type {
  BatchRequest, BitwigAdapter, ClipNavigationResult, ReadOptions, ResolveResult, ResolvedAddress,
} from './adapter.js';
