export {
  MUSICAL_OPERATION_SEMANTICS, MUSICAL_PATCH_POLICY, MUSICAL_PATCH_SCHEMA,
  MUSICAL_PATCH_VERSION, STOCHASTIC_OPERATIONS, assertMusicalToolBoundary,
  compileMusicalClip, decodeMusicalPatch, describeMusicalPatch,
  encodeMusicalPatch, encodeMusicalReport, musicalPatchSchema, musicalRandom, musicalSeedScope,
  parseMusicalPatch,
} from './patch.js';
export type {
  MaterializedMusicalChannel, MaterializedMusicalPreflight, MaterializedMusicalTarget,
  MusicalCompilation, MusicalContractReport, MusicalLoss, MusicalLossCode, MusicalOperation,
  MusicalOperationKind, MusicalOperationSemantics, MusicalPatch, MusicalSelection, MusicalTarget,
  MusicalToolBoundary, WritableExpression,
} from './patch.js';
export { MusicalPatchError } from './patch.js';
export {
  MUSICAL_CORPUS_V1_SHA256, MUSICAL_REQUEST_CORPUS, encodeMusicalCorpus,
  fingerprintMusicalCorpus, musicalCorpusArtifact,
} from './corpus.js';
export type { MusicalCorpusCase } from './corpus.js';
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
