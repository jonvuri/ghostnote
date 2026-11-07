// Build R01 round 2's development package (R01-D8 to R01-D13) with the E358
// builder: shared revision-2 cards and contracts, private oracles, and a
// per-level timeout scaled with the expected output (R01-D12).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildPackage, writePackage } from './development-pairs.mjs';
import { createAdapter } from './precision.mjs';
import { INSTANCES, LADDERS, LADDERS_V2, LADDERS_V3, LADDERS_V4, LADDERS_V5, LADDERS_V6, ROUND2_FAMILY_RULES, ROUND2_FAMILY_RULES_V5, ROUND2_FAMILY_RULES_V6, ROUND2_RULES, ROUND2_RULES_V2, ROUND2_RULES_V3, ROUND2_SEEDS, ROUND2_WINDOWS_PATH, ROUND2_WINDOWS_V3_PATH,
  loadRound2Windows, round2Tasks } from './round2-tasks.mjs';
import { ROUND2_WINDOW_RULES, ROUND2_WINDOW_RULES_V3 } from './round2-inputs.mjs';
import { FAMILY_SEED } from './round2-families.mjs';

export const ROUND2_PACKAGE = 'round2-development-v1';
// Version 2 (R01-D14): harder shared ladder; cohorts Haiku 5.5 low and Luna high.
export const ROUND2_VERSIONS = Object.freeze({
  1: { name: 'round2-development-v1', ladders: LADDERS, rules: ROUND2_RULES, selectionVersion: 1, decisions: ['R01-D8', 'R01-D9', 'R01-D10', 'R01-D11', 'R01-D12', 'R01-D13'] },
  2: { name: 'round2-development-v2', ladders: LADDERS_V2, rules: ROUND2_RULES_V2, selectionVersion: 2, decisions: ['R01-D8', 'R01-D11', 'R01-D12', 'R01-D13', 'R01-D14'] },
  // Version 3 (R01-D18): one package per cohort, fresh instances, per-family repeats.
  3: { name: 'round2-development-v3', perCohort: LADDERS_V3, rules: ROUND2_RULES_V3, selectionVersion: 3,
    windows: ROUND2_WINDOWS_V3_PATH, windowRules: ROUND2_WINDOW_RULES_V3, decisions: ['R01-D8', 'R01-D11', 'R01-D12', 'R01-D13', 'R01-D14', 'R01-D18'] },
  // Version 4 (R01-D19, R01-D20): format-dependent families, synthetic only (no
  // real windows); one calibration instance per level in each cohort's package.
  4: { name: 'round2-development-v4', perCohort: LADDERS_V4, rules: ROUND2_FAMILY_RULES, selectionVersion: 4, windows: null, windowRules: null,
    inputVersion: 'round2-4-synthetic', decisions: ['R01-D8', 'R01-D11', 'R01-D12', 'R01-D14', 'R01-D18', 'R01-D19', 'R01-D20'] },
  // Version 5 (R01-D21): Haiku-only recalibration of the families at higher levels.
  5: { name: 'round2-development-v5', perCohort: LADDERS_V5, rules: ROUND2_FAMILY_RULES_V5, selectionVersion: 5, windows: null, windowRules: null,
    inputVersion: 'round2-4-synthetic', decisions: ['R01-D8', 'R01-D11', 'R01-D12', 'R01-D18', 'R01-D19', 'R01-D20', 'R01-D21'] },
  // Version 6 (R01-D21): development pass of the families on one shared ladder, fresh instances.
  6: { name: 'round2-development-v6', perCohort: LADDERS_V6, rules: ROUND2_FAMILY_RULES_V6, selectionVersion: 6, windows: null, windowRules: null,
    inputVersion: 'round2-4-synthetic', decisions: ['R01-D8', 'R01-D11', 'R01-D12', 'R01-D18', 'R01-D19', 'R01-D20', 'R01-D21'] },
});
// Per-cohort package names by version.
export const V3_PACKAGES = Object.freeze({ 'claude-current': 'round2-development-v3-haiku', 'codex-current-high': 'round2-development-v3-luna' });
export const V4_PACKAGES = Object.freeze({ 'claude-current': 'round2-development-v4-haiku', 'codex-current-high': 'round2-development-v4-luna' });
export const V5_PACKAGES = Object.freeze({ 'claude-current': 'round2-development-v5-haiku' });
export const V6_PACKAGES = Object.freeze({ 'claude-current': 'round2-development-v6-haiku', 'codex-current-high': 'round2-development-v6-luna' });
const PACKAGES_BY_VERSION = { 3: V3_PACKAGES, 4: V4_PACKAGES, 5: V5_PACKAGES, 6: V6_PACKAGES };

/** Per-task repeats from a v3 ladder (R01-D18); earlier versions use the selection's single count. */
export function repeatsByTask(built, ladders) {
  return { schema: 'r01-round2-repeats-v1', rule: 'Each family ladder sets its repeats; the planner schedules that many repetitions of each of its tasks.',
    byTask: Object.fromEntries(built.privateOracles.tasks.map(t => [t.id, ladders[t.ladder.family].repeats])) };
}

// R01-D12: one limit per family level, the same for every format and instance.
export const TIMEOUT_RULE = Object.freeze({ schema: 'r01-round2-timeout-v1', baseMs: 120000, perTokenMs: 60, roundToMs: 10000,
  expectedOutput: 'the largest golden response, in local o200k_base tokens, over every eligible arm and instance of the family level',
  formula: 'timeoutMs = ceil((baseMs + perTokenMs x expected output tokens) / roundToMs) x roundToMs',
  rationale: 'At least the round-1 limit; 60 ms per token allows about 17 answer tokens per second beyond two minutes for reasoning and latency. Elapsed time is reported as a measure.' });
export const timeoutMs = tokens => Math.ceil((TIMEOUT_RULE.baseMs + TIMEOUT_RULE.perTokenMs * tokens) / TIMEOUT_RULE.roundToMs) * TIMEOUT_RULE.roundToMs;

/** Per-level and per-task limits from the built package's golden responses. */
export function levelTimeouts(built, tokenizer) {
  const tasks = new Map(built.privateOracles.tasks.map(t => [t.id, t])), cells = new Map(built.manifest.cells.map(c => [c.id, c]));
  const byLevel = {};
  for (const { id, response } of built.privateOracles.responses) {
    const { family, level } = tasks.get(cells.get(id).task).ladder, tokens = tokenizer.encode(response).length;
    const entry = ((byLevel[family] ??= {})[level] ??= { expectedOutputTokens: 0 });
    entry.expectedOutputTokens = Math.max(entry.expectedOutputTokens, tokens);
  }
  for (const levels of Object.values(byLevel)) for (const entry of Object.values(levels)) entry.timeoutMs = timeoutMs(entry.expectedOutputTokens);
  const byTask = Object.fromEntries(built.privateOracles.tasks.map(t => [t.id, byLevel[t.ladder.family][t.ladder.level].timeoutMs]));
  return { ...TIMEOUT_RULE, byLevel, byTask };
}

export const round2Header = (version = 1, cohort = null) => { const v = ROUND2_VERSIONS[version];
  const ladders = v.perCohort ? v.perCohort[cohort] : v.ladders;
  assert(ladders, `round-2 package version ${version} needs a cohort with a ladder`);
  return Object.freeze({ schema: 'r01-pilot-package-v1', status: 'offline-materialized', stage: 'development',
    round: 2, packageVersion: v.perCohort ? PACKAGES_BY_VERSION[version][cohort] : v.name, inputVersion: v.inputVersion ?? (v.perCohort ? 'round2-3' : 'round2-1'),
    windows: v.windows === undefined ? ROUND2_WINDOWS_PATH : v.windows, windowRules: v.windowRules === undefined ? ROUND2_WINDOW_RULES : v.windowRules,
    taskRules: v.rules, ladders,
    instances: v.perCohort ? Object.fromEntries(Object.entries(ladders).map(([f, l]) => [f, l.instances])) : INSTANCES,
    ...(v.perCohort ? { cohort } : {}), decisions: v.decisions,
    ...(version >= 2 ? { selectionVersion: v.selectionVersion } : {}),
    ...(version >= 4 ? { syntheticSeed: FAMILY_SEED, velocitySeed: null }
      : { syntheticSeed: ROUND2_SEEDS.synthetic, velocitySeed: ROUND2_SEEDS.velocity }) }); };

export const ROUND2_LIMITS = [
  'Development stage, round 2 (R01-D8): works 4-6 and the round-2 seeds may be reused and tuned; results support design iteration only and are never pooled with round 1.',
  'Real-source windows are transcriptions; velocities are seeded synthetic dynamics, not recovered performance dynamics or musical intent.',
  'Only works 4-6 are opened. One asset (the gapra whitewood piano, 859 notes) holds 512 notes, so every 512-note instance comes from it and instances 2-4 overlap earlier ones (largest overlap 428 of 512 notes); 256-note instances come from two assets.',
  'Selective-delete targets and near misses are planted into real windows at a pitch with no nearby notes; notes are renumbered so planted IDs do not stand out.',
  'Source tasks exclude current-document and Producer Pal arms. The three source diagnostics run at one level per source family.',
  'Cards, instructions and contracts are prompt revision 2 (packages v3-v5); scoring follows D59.',
  'Common performed scoring normalizes once at 1/512; IDs/order are not cross-format scored. Source scoring is exact up to rational spelling.',
  'Native Producer Pal parsing is tolerant; semantic pass does not establish canonical or strictly valid syntax.',
  'Cell order is build order; trial order comes from the runner plan. Timeouts are pinned per family level (r01-round2-timeout-v1).',
];

const LIMITS_V2 = [
  ...ROUND2_LIMITS.slice(0, 2),
  'Ladder v2 (R01-D14): one harder shared ladder for Haiku 5.5 low and Luna high, from E382 and E383. Real windows equal v1; only 128-512-note windows are used. Preservation runs once at 512 notes as a cost measure.',
  ...ROUND2_LIMITS.slice(2),
];

const LIMITS_V3 = [
  ...ROUND2_LIMITS.slice(0, 2),
  'Ladder v3 (R01-D18): one package per cohort, with levels chosen for C3/C4 and C4/baseline discordance in E385 and one level above where an arm still passed more than half. Levels above E385\'s are uncalibrated.',
  'Fresh instances: synthetic instances 5-16 and 128-note range-edit windows 5-8 (largest overlap with any earlier window 16 notes). Works 4-6 hold no fresh low-overlap 256- or 512-note windows, so those levels are not run.',
  'One repeat per synthetic task; range-edit runs three repeats because its fresh material allows only four instances.',
  'Source tasks exclude current-document and Producer Pal arms. No source diagnostics run.',
  ...ROUND2_LIMITS.slice(5),
];

const LIMITS_V5 = [
  'Development stage, round 2 (R01-D8): synthetic material only (seed r01-round2-families-v1); results support design iteration only.',
  'Ladder v5 (R01-D21): Haiku-only recalibration above the v4 levels that saturated it (E389); one instance per level and one repeat. Large-edit is not probed (output cap, R01-D20).',
  'Source tasks exclude current-document and Producer Pal arms. No source diagnostics run.',
];
const LIMITS_V6 = [
  'Development stage, round 2 (R01-D8): synthetic material only (seed r01-round2-families-v1); results support design iteration only and are never pooled with round 1.',
  'Ladder v6 (R01-D21): per family, the union of Luna\'s levels (E389) and Haiku\'s levels (pre-stated rule on the v5 recalibration), run identically by both models. Each model also runs levels chosen for the other.',
  'Fresh instances 2-13, one repeat (R01-D18); instance 1 was used in calibration.',
  'Source tasks exclude current-document and Producer Pal arms. No source diagnostics run.',
  ...ROUND2_LIMITS.slice(5),
];
const LIMITS_V4 = [
  'Development stage, round 2 (R01-D8): synthetic material only (seed r01-round2-families-v1); no work is opened and no real window is used. Results support design iteration only and are never pooled with round 1.',
  'Ladder v4 (R01-D19, R01-D20): four format-dependent families on C3 and C4 FIELDS, uncalibrated levels shared by both cohort packages, one instance per level and one repeat (calibration). The development pass uses fresh instances in a later package.',
  'Synthetic documents are constructed to exercise structure (derived onsets, overlapping memberships, rich surrounding state, interpretation provenance); they are not musical material and carry no performance intent.',
  'Source tasks exclude current-document and Producer Pal arms. No source diagnostics run.',
  ...ROUND2_LIMITS.slice(5),
];

export function buildRound2Package(adapter, tokenizer, { windows, instances = INSTANCES, version = 1, cohort = null } = {}) {
  const v = ROUND2_VERSIONS[version];
  assert(v, `unknown round-2 package version ${version}`);
  // Version 4 is synthetic; its generators never read windows.
  if (v.windows !== null) {
    windows ??= loadRound2Windows(v.windows);
    assert.equal(windows.schema, 'r01-round2-windows-v1', 'round 2 needs round-2 windows');
  }
  const header = round2Header(version, cohort), ladders = header.ladders;
  const built = buildPackage(adapter, tokenizer, { tasks: round2Tasks(windows ?? null, { instances, ladders }), header,
    limits: version === 6 ? LIMITS_V6 : version === 5 ? LIMITS_V5 : version >= 4 ? LIMITS_V4 : version >= 3 ? LIMITS_V3 : version >= 2 ? LIMITS_V2 : ROUND2_LIMITS, promptRevision: 2 });
  built.manifest.timeouts = levelTimeouts(built, tokenizer);
  if (version >= 3) built.manifest.repeats = repeatsByTask(built, ladders);
  return built;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [upstream, tooling, output, version = '1', cohort = null] = process.argv.slice(2);
  assert(upstream && tooling && output && (Number(version) < 3 || cohort),
    'usage: node --import tsx round2-package.mjs PINNED_PP TOOLING NEW_OUTPUT_DIRECTORY [VERSION=1|2|3|4] [COHORT (versions 3 and 4)]');
  const tokenizerPackage = JSON.parse(readFileSync(resolve(tooling, 'node_modules/js-tiktoken/package.json')));
  assert.equal(tokenizerPackage.version, '1.0.21');
  const { getEncoding } = await import(pathToFileURL(resolve(tooling, 'node_modules/js-tiktoken/dist/index.js')));
  const adapter = await createAdapter(upstream);
  try {
    const built = buildRound2Package(adapter, getEncoding('o200k_base'), { version: Number(version), cohort });
    writePackage(built, resolve(output), { extraSources: ['brain/benchmarks/r01-candidates/round2-tasks.mjs',
      'brain/benchmarks/r01-candidates/round2-inputs.mjs', 'brain/benchmarks/r01-candidates/round2-package.mjs',
      ...(Number(version) >= 4 ? ['brain/benchmarks/r01-candidates/round2-families.mjs'] : [built.manifest.windows])] });
    console.log(JSON.stringify({ counts: built.manifest.counts, timeouts: built.manifest.timeouts.byLevel }, null, 2));
  } finally { adapter.dispose(); }
}
