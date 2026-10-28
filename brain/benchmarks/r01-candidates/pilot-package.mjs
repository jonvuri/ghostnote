// Build the R01 pilot task package (development stage) with the E358 builder:
// shared cards and contracts, per-arm fact-hash checks, private oracles and
// the offline golden/wrong-answer/gratuitous-refusal rehearsal.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildPackage, writePackage } from './development-pairs.mjs';
import { pilotTasks, loadWindows, TASK_RULES, TASK_RULES_V4, TASK_RULES_V5, SYNTHETIC_SEED, VELOCITY_SEED, WINDOWS_PATH,
  RIGOROUS_SEEDS, RIGOROUS_WINDOWS_PATH } from './pilot-tasks.mjs';
import { createAdapter } from './precision.mjs';

// Package versions over input v2. Version 2 is E367's package; version 3
// (E370) revises task wording, instructions and the bar|beat card and drops
// the TASK SCOPE block. Version 2 omits the packageVersion field, as built.
// Version 4 (D61) replaces p01, p06, p07, p08 and p09 with harder tasks over
// the same inputs; prompts keep revision 2 apart from the p09/p10 response line.
// Version 5 (D63) adds four synthetic group-timing tasks, p13-p16; p01-p12,
// cards, prompts revision 2 and scoring are unchanged.
export const PACKAGE_VERSIONS = { 2: { taskRevision: 2, promptRevision: 1 }, 3: { taskRevision: 3, promptRevision: 2 },
  4: { taskRevision: 4, promptRevision: 2 }, 5: { taskRevision: 5, promptRevision: 2 } };
const rulesFor = version => version >= 5 ? TASK_RULES_V5 : version >= 4 ? TASK_RULES_V4 : TASK_RULES;
export const pilotHeader = version => Object.freeze({ schema: 'r01-pilot-package-v1', status: 'offline-materialized', stage: 'development',
  inputVersion: 2, ...(version >= 3 ? { packageVersion: version, taskRevision: PACKAGE_VERSIONS[version].taskRevision } : {}),
  windows: WINDOWS_PATH, taskRules: rulesFor(version), syntheticSeed: SYNTHETIC_SEED, velocitySeed: VELOCITY_SEED });
export const PILOT_HEADER = pilotHeader(2);

export const PILOT_LIMITS = [
  'Development stage: works A-C and this synthetic seed may be reused and tuned; results support design iteration only.',
  'Real-source windows are transcriptions; their velocities are seeded synthetic dynamics over placeholder 64, not recovered performance dynamics or musical intent.',
  'Source tasks exclude current-document and Producer Pal arms: no annotation adapter or sidecar is supplied (pilot draft 2, review answer 3).',
  'Cards, shared instructions, scope text and response contracts are the E358 versions; only requests, inputs and oracles are new.',
];
const LIMITS_V3 = [
  'Development stage: works A-C and this synthetic seed may be reused and tuned; results support design iteration only.',
  'Real-source windows are transcriptions; their velocities are seeded synthetic dynamics over placeholder 64, not recovered performance dynamics or musical intent.',
  'Source tasks exclude current-document and Producer Pal arms: no annotation adapter or sidecar is supplied (pilot draft 2, review answer 3).',
  'Package v3 (E370): selector, spelling and contract wording revised, the TASK SCOPE block folded into the contract prose, and the bar|beat card documents d/t suffixes. Inputs and oracles equal v2.',
  'Scoring follows D59: functionally equivalent parsed answers pass; rational strings compare by value.',
  'Native Producer Pal parsing is tolerant; semantic pass does not establish canonical or strictly valid syntax.',
  'Cell order is build order; trial order comes from the pilot runner plan.',
  'Common performed scoring normalizes once at 1/512; IDs/order are not cross-format scored. Source scoring is exact.',
  'Native Producer Pal parsing is tolerant; semantic pass does not establish canonical or strictly valid syntax.',
  'Cell order is build order; trial order comes from the pilot runner plan.',
];

const LIMITS_V4 = [
  ...LIMITS_V3.slice(0, 4),
  'Package v4 (D61): p01, p06, p07, p08 and p09 are harder replacements under new IDs (boundary read, multi-note transpose, off-grid halving with an anchor move, a two-step onset-bounded range, a near-miss delete); p09 and p10 share a conditional-refusal response line. Inputs equal v3; p01 now reads work C.',
  ...LIMITS_V3.slice(4),
];

const LIMITS_V5 = [
  ...LIMITS_V4.slice(0, 5),
  'Package v5 (D63): adds four synthetic group-timing source tasks, p13-p16 (read a derived-onset window, group existing notes, move a member between timed groups, retime two groups). p01-p12 equal v4. Note-array order equals C4 block traversal in every new fixture.',
  ...LIMITS_V4.slice(5),
];

// Rigorous stage (R01-D1, R01-D2): package v5's frozen tasks, prompts and
// cards on works 4-6 (roles A-C) with the rigorous seeds. Task rules keep
// schema v4; the seed and window-selection changes are stated beside them.
export const RIGOROUS = Object.freeze({ name: 'pilot-rigorous-v1', basedOn: 5, windows: RIGOROUS_WINDOWS_PATH, seeds: RIGOROUS_SEEDS });
export const rigorousHeader = () => Object.freeze({ schema: 'r01-pilot-package-v1', status: 'offline-materialized', stage: 'rigorous',
  inputVersion: 'rigorous-1', packageVersion: RIGOROUS.basedOn, taskRevision: PACKAGE_VERSIONS[RIGOROUS.basedOn].taskRevision,
  windows: RIGOROUS.windows, taskRules: rulesFor(RIGOROUS.basedOn),
  stageRules: { decisions: ['R01-D1', 'R01-D2', 'R01-D3'],
    seeds: `The synthetic draws use ${RIGOROUS_SEEDS.synthetic} and the real-source velocities ${RIGOROUS_SEEDS.velocity}, in place of the development seeds named in taskRules.`,
    roles: 'Works 4-6 of the seeded order (or their replacements) fill roles A, B and C; taskRules\' Work A/B/C refer to these roles.',
    windows: 'Densest admissible window with target-rule refusal (r01-pilot-selection-rules-v3).' },
  syntheticSeed: RIGOROUS_SEEDS.synthetic, velocitySeed: RIGOROUS_SEEDS.velocity });

const LIMITS_RIGOROUS = [
  'Rigorous stage: versions frozen by R01-D1; works and seeds are fresh (R01-D2) and were not seen in development.',
  ...LIMITS_V5.slice(1),
];

/** The rigorous package over the given rigorous windows (default: the retained file). */
export function buildRigorousPackage(adapter, tokenizer, { windows = loadWindows(RIGOROUS.windows) } = {}) {
  assert.equal(windows.stage, 'rigorous', 'rigorous package needs rigorous windows');
  const { taskRevision, promptRevision } = PACKAGE_VERSIONS[RIGOROUS.basedOn];
  return buildPackage(adapter, tokenizer, { tasks: pilotTasks(windows, { revision: taskRevision, seeds: RIGOROUS.seeds }),
    header: rigorousHeader(), limits: LIMITS_RIGOROUS, promptRevision });
}

export function buildPilotPackage(adapter, tokenizer, { version = 5 } = {}) {
  const { taskRevision, promptRevision } = PACKAGE_VERSIONS[version] ?? {};
  assert(taskRevision, `unknown package version ${version}`);
  return buildPackage(adapter, tokenizer, { tasks: pilotTasks(undefined, { revision: taskRevision }), header: pilotHeader(version),
    limits: version >= 5 ? LIMITS_V5 : version >= 4 ? LIMITS_V4 : version >= 3 ? LIMITS_V3 : PILOT_LIMITS, promptRevision });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [upstream, tooling, output, version = '5'] = process.argv.slice(2);
  assert(upstream && tooling && output, 'usage: node --import tsx pilot-package.mjs PINNED_PP TOOLING NEW_OUTPUT_DIRECTORY [PACKAGE_VERSION=5|rigorous]');
  const rigorous = version === 'rigorous';
  const tokenizerPackage = JSON.parse(readFileSync(resolve(tooling, 'node_modules/js-tiktoken/package.json')));
  assert.equal(tokenizerPackage.version, '1.0.21');
  const { getEncoding } = await import(pathToFileURL(resolve(tooling, 'node_modules/js-tiktoken/dist/index.js')));
  const adapter = await createAdapter(upstream);
  try {
    const built = rigorous ? buildRigorousPackage(adapter, getEncoding('o200k_base'))
      : buildPilotPackage(adapter, getEncoding('o200k_base'), { version: Number(version) });
    writePackage(built, resolve(output), { extraSources: ['brain/benchmarks/r01-candidates/pilot-tasks.mjs',
      'brain/benchmarks/r01-candidates/pilot-inputs.mjs', 'brain/benchmarks/r01-candidates/pilot-package.mjs',
      rigorous ? RIGOROUS.windows : WINDOWS_PATH] });
    console.log(JSON.stringify(built.manifest.counts, null, 2));
  } finally { adapter.dispose(); }
}
