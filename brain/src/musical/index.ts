export {
  MUSICAL_OPERATION_SEMANTICS, MUSICAL_PATCH_POLICY, MUSICAL_PATCH_SCHEMA,
  MUSICAL_PATCH_VERSION, STOCHASTIC_OPERATIONS, assertMusicalToolBoundary,
  compileMusicalClip, decodeMusicalPatch, describeMusicalPatch,
  encodeMusicalPatch, encodeMusicalReport, musicalOutputCount, musicalPatchSchema,
  musicalRandom, musicalSeedScope,
  parseMusicalPatch,
} from './patch.js';
export type {
  MaterializedMusicalChannel, MaterializedMusicalPreflight, MaterializedMusicalTarget,
  MusicalCompilation, MusicalContractReport, MusicalLoss, MusicalLossCode, MusicalOperation,
  MusicalOperationKind, MusicalOperationSemantics, MusicalPatch, MusicalSelection, MusicalTarget,
  MusicalToolBoundary, WritableExpression,
} from './patch.js';
export { MusicalPatchError } from './patch.js';
export { applyMusicalPatch, planMusicalPatch } from './planner.js';
export type {
  MusicalChangesetIdentity, MusicalPlannerResult, MusicalReversalQualification,
  PlannedClipBlock, PlannedMusicalApplication, PlannedMusicalResult,
} from './planner.js';
export {
  MUSICAL_CORPUS_V1_SHA256, MUSICAL_REQUEST_CORPUS, encodeMusicalCorpus,
  fingerprintMusicalCorpus, musicalCorpusArtifact,
} from './corpus.js';
export type { MusicalCorpusCase } from './corpus.js';
export {
  AGENT_CONTEXT_MODES, AGENT_CONTEXT_SCHEMA, GROOVE_CONTEXT_SCHEMA,
  agentContextSchema, fingerprintAgentContext, parseAgentContext, renderAgentContext,
} from './agent-context.js';
export type { AgentContext, AgentContextMode, GrooveContext } from './agent-context.js';
export { AgentContextError } from './agent-context.js';
export {
  EXACT_NOTE_JSON_VERSION, EXACT_NOTE_SOURCE_DOMAIN, EXACT_NOTE_SOURCE_MAX_CLIPS,
  EXACT_NOTE_SOURCE_MAX_NOTES, EXACT_NOTE_SOURCE_SCHEMA, ExactNoteSourceError,
  readExactNoteSource, serializeExactNoteSource, snapshotToExactSource,
  validateExactNoteSource,
} from './exact-note-source.js';
export type {
  ExactNoteAcquisition, ExactNoteChannel, ExactNoteClip, ExactNoteEventMapEntry,
  ExactNoteSource, ExactNoteSourcePayload, ExactNoteTrackAlias, SnapshotExactSourceRequest,
} from './exact-note-source.js';
export {
  HOST_BEAT_RATIONAL_VERSION, SYMBOLIC_CONTEXT_MAX_EVENTS, SYMBOLIC_CONTEXT_MODULE_ID,
  SYMBOLIC_CONTEXT_MODULE_VERSION, SYMBOLIC_CONTEXT_SCHEMA, SymbolicContextError,
  exactSourceToContext, hostBeatToRational, symbolicContextModule,
} from './symbolic-context.js';
export type {
  AlternativeEvidence, AuthorityEntry, DeclaredRegion, DeclaredTrackRole,
  DerivedMeasurement, ExactFact, HarmonyAlternative, ProviderVersion,
  QualifiedHarmonyEvidence, SymbolicContextRequest, SymbolicContextResult,
  SymbolicContextTask, SymbolicContextTimingEvent, SymbolicContextOptions,
  SymbolicMeasurement,
} from './symbolic-context.js';
export {
  AGENT_CONTEXT_CORPUS, AGENT_CONTEXT_CORPUS_V0_SHA256,
  COMPACT_AGENT_CONTEXT, GROOVE_AGENT_CONTEXT, fingerprintAgentContextCorpus,
} from './agent-context-corpus.js';
export {
  chordFact, detectHarmony, intervalFact, keyFact, materializeGenerationPatch,
  materializeHarmonicTarget, materializeMusicalTarget, materializeRhythmTarget,
  modeFact, noteFact, pitchClassSetFact, progressionFact,
  groupNotesByExactOnset, resolveHarmonyPlan, scaleFact, selectCanonicalNotes,
  toMaterializedMusicalTarget,
} from './theory.js';
export type {
  CanonicalMusicalNote, ChordFact, GeneratedMusicalTarget, HarmonyDetection,
  HarmonicMaterializedTarget, HarmonicTransformOptions, HarmonyPlan,
  HarmonyPlanResolver, HarmonyRegion, IntervalFact, KeyFact, ModeFact,
  MusicalMaterializedTarget, MusicalNoteGroup, MusicalNoteGrouping, MusicalProvenance,
  MusicalTransformOptions, NoteFact,
  NoteSelectionResult, PitchClassSetFact, ProgressionFact, ScaleFact,
  TheoryRefusalCode, TheoryResult,
} from './theory.js';
