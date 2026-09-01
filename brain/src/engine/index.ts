/**
 * The write engine — PHASE-1 §Scope items 2, 3 and 5, as a LIBRARY.
 *
 * Deliberately not a module with state and deliberately not a process. The
 * daemon (session 3) will host one `Executor` per bridge connection and may
 * re-create it when Bitwig restarts; the stash (session 2) records what this
 * produces and bounds what may be reversed from it (D19); the control layer
 * (session 4) triggers that reversal. All three compose a value, which is only
 * possible because nothing here is global.
 */
export { Executor, disagreementsOf } from './executor.js';
export type { ExecutorOptions, ExecutorTimingEvent, RevertResult, RunOptions } from './executor.js';

export { labelTarget, notePropCaveats, splitReplayable, worse, worstOf } from './fidelity.js';

export {
  ManagedFxChainError, buildManagedFxChain, reverseManagedFxChain,
} from './managed-fx-chain.js';
export type {
  ManagedFxChainCheckpoint, ManagedFxChainHost, ManagedFxChainObservation, ManagedFxChainRecovery,
  ManagedFxChainReport, ManagedFxChainRequest, ManagedFxChainReversal,
  ManagedFxDeviceRequest, ManagedFxEnabledCheckpoint, ManagedFxExistingEnabledRequest,
  ManagedFxFailedWrite, ManagedFxInsertedDevice, ManagedFxLogicalDevice,
  ManagedFxNonTakingWrite, ManagedFxParameterCheckpoint, ManagedFxParameterSetting,
  ManagedFxScalarCheckpoint, ManagedFxStage, ManagedFxWarning,
} from './managed-fx-chain.js';

export {
  authorModulatorAdd, authorModulatorEdit, authorSemanticModulatorEdit,
  authorSemanticPreset, ModulatorAuthoringError,
} from './modulator-authoring.js';

export { modulationRoute } from './modulation-target.js';
export type {
  ModulationTarget, ResolvedModulationTargetLocation,
} from './modulation-target.js';

export {
  assertPresetFingerprint, fingerprintPreset, inspectPresetModulation, PresetInspectionError,
} from './preset-modulation-inspection.js';
export type {
  PresetEntryInventory, PresetFingerprint, PresetHostFormat, PresetModulationInspection,
  PublicModulationTarget, PublicPresetModulator, SemanticDeviceStep, SemanticModulatorInventory,
  SemanticModulatorLocation,
} from './preset-modulation-inspection.js';

export { buildOwnedTemplateComposition } from './owned-template-composition.js';
export type {
  CompositionLiveWitness, CompositionStructureVerification, ObservedCompositionEntry,
  OwnedTemplateCompositionHost, OwnedTemplateCompositionOptions, OwnedTemplateCompositionRequest,
  OwnedTemplateCompositionResult, ValidatedCompositionEntry,
} from './owned-template-composition.js';
export {
  reverseExistingDeviceModulation, wrapExistingDeviceModulation,
} from './existing-device-wrapper.js';
export {
  composeGeneralDeviceSources, reverseGeneralDeviceSources,
} from './general-device-composition.js';
export type {
  GeneralDeviceCheckpointEntry, GeneralDeviceCompositionCheckpoint,
  GeneralDeviceCompositionHost, GeneralDeviceCompositionOptions,
  GeneralDeviceCompositionRequest, GeneralDeviceCompositionResult,
  GeneralDeviceCompositionReversal, GeneralDeviceEntryRequest,
  GeneralDeviceEntryVerification, GeneralDeviceFingerprint,
  GeneralDeviceModulationRequest, GeneralDeviceOrderItem,
  GeneralDeviceSourceRequest, GeneralDeviceStageReceipt,
} from './general-device-composition.js';
export type {
  DeviceParameterFingerprint, ExistingDeviceOrderItem, ExistingDeviceWrapperCheckpoint,
  ExistingDeviceWrapperHost, ExistingDeviceWrapperOptions, ExistingDeviceWrapperRequest,
  ExistingDeviceWrapperResult, ExistingDeviceWrapperReversal,
  ExistingDeviceWrapperStageReceipt, ExistingDeviceWrapperVerification,
} from './existing-device-wrapper.js';
export type {
  AddModulatorOptions, AddModulatorRequest, AddModulatorResult, ModulationSample,
  ModulationVerification, ModulatorAuthoringHost, ModulatorBehaviorWitness, ModulatorEdit,
  ModulatorEditOptions, ModulatorEditRequest, ModulatorEditResult,
  ModulatorPageVerification, ModulatorPageWitness, ModulatorParameterWitness,
  ModulatorStubRelocation, SemanticModulatorEditRequest, SemanticModulatorEditResult,
  AuthoredSemanticPreset, SemanticPresetModulatorAdd,
} from './modulator-authoring.js';

export {
  branchProtected, directedDestruction, floorRefusal, gateBeforeReading, ownChangesetReversal,
  UnprotectedWriteError,
} from './floor.js';
export type { Clearance } from './floor.js';

export { NO_MINT_NO_INVERSE, revertOps } from './revert.js';
export type { InsertBatch, RevertInput, RevertPlan, Unrestored } from './revert.js';

export { takeAppliedAnything, takeWriteSet } from './take.js';
export type {
  ApplyReport, ConcurrentEdit, Disagreement, Take, TakeValue, Unverified,
} from './take.js';

export { isAtRisk, structuralRisk, writeSet, writeSetOf } from './write-set.js';
export type { Restore, StructuralRisk, UnrevertableOp, WriteSet, WriteTarget } from './write-set.js';
