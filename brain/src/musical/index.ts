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
  MusicalOperationKind, MusicalOperationSemantics, MusicalPatch, MusicalTarget,
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
  modeFact, noteFact, pitchClassSetFact, progressionFact, scaleFact,
  toMaterializedMusicalTarget,
} from './theory.js';
export type {
  CanonicalMusicalNote, ChordFact, GeneratedMusicalTarget, HarmonyDetection,
  IntervalFact, KeyFact, ModeFact, MusicalProvenance, NoteFact, PitchClassSetFact,
  ProgressionFact, ScaleFact, TheoryRefusalCode, TheoryResult,
} from './theory.js';
