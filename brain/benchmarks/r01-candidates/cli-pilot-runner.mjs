// R01 pilot runner: both admitted cohorts, seeded pilot order, stage labels,
// incremental results and quota resume. It reuses the paired runner's
// sequence, classification, correction and feedback rules.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { profilesFor } from './cli-controls.mjs';
import { buildTrialPlan, STAGES } from './cli-trial-plan.mjs';
import { SCORING_VERSION, surfaces } from './development-surfaces.mjs';
import { developmentTasks } from './development-tasks.mjs';
import { pilotTasks, loadWindows, RIGOROUS_SEEDS, RIGOROUS_WINDOWS_PATH } from './pilot-tasks.mjs';
import { canonical } from './common.mjs';
import { auditAttempt } from './cli-control-audit.mjs';
import { preflightProvider, runCliAttempt, sha } from './cli-attempt.mjs';
import { FEEDBACK_VERSION, modelConfig, runSequence, selectTasks, summarizeRuns } from './cli-paired-runner.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const json = value => JSON.stringify(value, null, 2) + '\n';
const readJson = path => JSON.parse(readFileSync(path, 'utf8'));

// Pilot draft 2: Haiku 5.5 and Luna, 12 instances x 3 repeats, order seed
// r01-pilot-order-v1, at most two corrections, 120 s per submission.
export const PILOT = Object.freeze({
  schema: 'r01-pilot-selection-v1', stage: 'development', seed: 'r01-pilot-order-v1',
  cohorts: Object.freeze(['claude-current', 'codex-current']), tasks: null,
  repeats: 3, maxRepairs: 2, timeoutMs: 120000,
  // E370: one identical resubmission after a timeout without an answer.
  stallResubmissions: 1,
});

// Development effort probes (E376): admitted profiles at another effort.
// They run only in development subsets and are never part of a full pass.
export const PROBE_COHORTS = Object.freeze(['codex-current-medium']);

/** A full pass or a recorded subset of cohorts, tasks and repeats. */
export function pilotSelection({ cohorts = PILOT.cohorts, tasks = null, repeats = PILOT.repeats, stage = PILOT.stage } = {}) {
  assert(Array.isArray(cohorts) && cohorts.length && new Set(cohorts).size === cohorts.length, 'cohorts must be distinct and nonempty');
  for (const id of cohorts) assert(PILOT.cohorts.includes(id) || PROBE_COHORTS.includes(id) && stage === 'development',
    `${id} is not an admitted pilot cohort`);
  assert(tasks === null || Array.isArray(tasks) && tasks.length && new Set(tasks).size === tasks.length, 'tasks must be null or distinct IDs');
  assert(Number.isSafeInteger(repeats) && repeats >= 1, 'repeats must be a positive integer');
  assert(STAGES.includes(stage), 'unknown stage');
  // Keep the pilot's cohort order regardless of argument order.
  return { ...PILOT, stage, repeats, tasks: tasks ? [...tasks] : null,
    cohorts: [...PILOT.cohorts, ...PROBE_COHORTS].filter(id => cohorts.includes(id)),
    subset: cohorts.some(id => PROBE_COHORTS.includes(id)) || cohorts.length < PILOT.cohorts.length || tasks !== null || repeats !== PILOT.repeats };
}

/** The planner's seeded order over the selection, with each cohort's configuration hash. */
export function pilotPlan(manifest, selection) {
  const scoped = selection.tasks ? selectTasks(manifest, selection.tasks) : manifest;
  const profiles = profilesFor(selection.stage);
  const plan = buildTrialPlan(scoped, { models: selection.cohorts.map(id => modelConfig(profiles[id])),
    seed: selection.seed, repeats: selection.repeats, maxRepairs: selection.maxRepairs,
    timeoutMs: selection.timeoutMs, stage: selection.stage });
  const cohorts = selection.cohorts.map((id, i) => ({ id, configSha256: plan.models[i].configSha256, profile: profiles[id] }));
  return { ...plan, selection, cohorts };
}

export const cohortOf = (plan, run) => plan.cohorts.find(c => c.configSha256 === run.configSha256).id;

/** Per-cohort counts; results are compared only within a cohort. */
export function countsByCohort(plan, result) {
  return Object.fromEntries(plan.cohorts.map(c => {
    const runs = plan.runs.filter(r => r.configSha256 === c.configSha256);
    const ids = new Set(runs.map(r => r.id));
    return [c.id, summarizeRuns({ ...plan, runs }, result.status, result.runs.filter(r => ids.has(r.id))).counts];
  }));
}

export const PACKAGES = {
  development: { directory: 'context/evidence/data/r01-development-pairs', regenerate: developmentTasks },
  // E366 inputs (first-window rule, placeholder velocities): artifact checks only.
  'pilot-development-v1': { directory: 'context/evidence/data/r01-pilot-inputs/package', regenerate: null, retired: 'pilot-development-v5' },
  // Densest windows, distinct targets and synthetic velocities; regenerated from current task code.
  // E367 package (task revision 2). Retired by v3 (E370): loads for analysis; start refuses it.
  'pilot-development-v2': { directory: 'context/evidence/data/r01-pilot-inputs/v2/package',
    regenerate: () => pilotTasks(undefined, { revision: 2 }), retired: 'pilot-development-v5' },
  // Input v2 with revised wording and prompts (E370). Retired by v4 (D61).
  'pilot-development-v3': { directory: 'context/evidence/data/r01-pilot-inputs/v3/package',
    regenerate: () => pilotTasks(undefined, { revision: 3 }),
    execution: 'context/evidence/data/r01-pilot-inputs/v3/execution/manifest.json', retired: 'pilot-development-v5' },
  // Harder p01, p06, p07, p08 and p09 over the same inputs (D61). Retired by v5 (D63).
  'pilot-development-v4': { directory: 'context/evidence/data/r01-pilot-inputs/v4/package',
    regenerate: () => pilotTasks(undefined, { revision: 4 }),
    execution: 'context/evidence/data/r01-pilot-inputs/v4/execution/manifest.json', retired: 'pilot-development-v5' },
  // v4 plus four synthetic group-timing tasks p13-p16 (D63); the last development package.
  'pilot-development-v5': { directory: 'context/evidence/data/r01-pilot-inputs/v5/package',
    regenerate: () => pilotTasks(undefined, { revision: 5 }),
    execution: 'context/evidence/data/r01-pilot-inputs/v5/execution/manifest.json' },
  // Rigorous stage (R01-D1-D3): v5's frozen tasks on works 4-6 with fresh seeds.
  'pilot-rigorous-v1': { directory: 'context/evidence/data/r01-pilot-inputs/rigorous/package',
    regenerate: () => pilotTasks(loadWindows(RIGOROUS_WINDOWS_PATH), { revision: 5, seeds: RIGOROUS_SEEDS }),
    execution: 'context/evidence/data/r01-pilot-inputs/rigorous/execution/manifest.json' },
};

/** Canonical hash of the plan as the runner writes it to plan.json. */
export const planSha256 = (plan, pkg) => sha(canonical({ ...plan, package: { name: pkg.name, manifestSha256: pkg.manifestSha256 } }));
export const orderOf = (plan, cohort) => plan.runs.filter(r => r.configSha256 === cohort.configSha256).map(r => `r${r.repetition}:${r.cell}`);

/**
 * Check a start against a pinned execution manifest: the package bytes, every
 * planned run's prompt hash and, for a full pass, the exact plan and order.
 * A subset is checked per run, since its seeded order is its own.
 */
export function checkExecution(pinned, pkg, plan) {
  assert.equal(pinned.stage, plan.stage, 'execution manifest stage differs from the plan');
  assert.equal(pinned.package.name, pkg.name, 'execution manifest names another package');
  assert.equal(pinned.package.manifestSha256, pkg.manifestSha256, 'package differs from the execution manifest');
  assert.equal(pinned.scoring ?? null, SCORING_VERSION, 'scoring version differs from the execution manifest');
  assert.equal(pinned.feedback ?? null, FEEDBACK_VERSION, 'feedback version differs from the execution manifest');
  const cells = new Map(pinned.cells.map(c => [c.id, c]));
  for (const run of plan.runs) assert.equal(run.promptSha256, cells.get(run.cell)?.promptSha256, `${run.cell}: prompt differs from the execution manifest`);
  if (!plan.selection.subset) assert.equal(planSha256(plan, pkg), pinned.plan.planSha256, 'plan differs from the execution manifest');
  // A full pass and a rigorous cohort restart (R01-D6) both follow the pinned order of each cohort.
  if (!plan.selection.subset || plan.stage === 'rigorous') {
    for (const cohort of plan.cohorts) {
      assert.equal(cohort.configSha256, pinned.cohorts.find(c => c.id === cohort.id)?.configSha256, `${cohort.id}: configuration differs from the execution manifest`);
      assert.deepEqual(orderOf(plan, cohort), pinned.order[cohort.id], `${cohort.id}: order differs from the execution manifest`);
    }
  }
  return true;
}

/**
 * R01-D6: a rigorous subset is only a restart of a halted full pass. It names
 * that pass, which must be a rigorous full pass of the same package and a
 * non-restart, and covers exactly the cohorts that did not finish there.
 */
export function checkRestart(plan, pkg, halted) {
  if (plan.stage !== 'rigorous') { assert.equal(halted, null, '--restart-of is for the rigorous stage'); return null; }
  if (!halted) { assert(!plan.selection.subset, 'a rigorous run is a full pass or a --restart-of restart'); return null; }
  const { plan: prior, results } = halted;
  assert.equal(prior.stage, 'rigorous', 'restart target is not a rigorous run');
  assert.equal(prior.package.manifestSha256, pkg.manifestSha256, 'restart target used another package');
  assert(!prior.selection.subset && !prior.selection.restartOf, 'restart target must be a full pass; a restart cannot be restarted');
  assert.match(results.status, /^halted-/, 'restart target did not halt');
  assert(plan.selection.tasks === null && plan.selection.repeats === prior.selection.repeats, 'a restart covers whole cohorts');
  const unfinished = prior.cohorts.filter(c => prior.runs.filter(r => r.configSha256 === c.configSha256)
    .some(r => !TERMINAL_STATUSES.has(results.runs.find(x => x.id === r.id)?.status))).map(c => c.id);
  assert.deepEqual(plan.cohorts.map(c => c.id), unfinished, `restart must cover exactly the unfinished cohorts: ${unfinished.join(', ')}`);
  return { output: halted.output, planSha256: sha(canonical(prior)), cohorts: unfinished };
}
const TERMINAL_STATUSES = new Set(['complete', 'exhausted']);

export function loadExecution(name) {
  const path = PACKAGES[name]?.execution;
  return path ? readJson(join(root, path)) : null;
}

/**
 * Load a task package and check its integrity: listed artifact hashes, one
 * pair per eligible cell with the pinned prompt, and (when supplied) that
 * current task code regenerates the retained private tasks.
 */
export function loadPackageDirectory(directory, { regenerate = null } = {}) {
  const manifestBytes = readFileSync(join(directory, 'manifest.json'));
  const manifest = JSON.parse(manifestBytes);
  for (const artifact of manifest.artifacts ?? [])
    assert.equal(sha(readFileSync(join(directory, artifact.path))), artifact.sha256, `${artifact.path}: artifact hash differs`);
  const pairs = readJson(join(directory, 'pairs.json'));
  const retained = readJson(join(directory, 'private-oracles.json'));
  const pairById = new Map(pairs.map(p => [p.id, p]));
  for (const cell of manifest.cells.filter(c => c.eligible))
    assert.equal(sha(pairById.get(cell.id)?.prompt ?? ''), cell.prompt.sha256, `${cell.id}: pair prompt differs from manifest`);
  if (regenerate) assert.equal(canonical(regenerate()), canonical(retained.tasks), 'task code differs from retained oracles');
  return { manifest, pairs, tasks: retained.tasks, manifestSha256: sha(manifestBytes) };
}

export function resolvePackage(name) {
  const known = PACKAGES[name];
  const directory = known ? join(root, known.directory) : resolve(name);
  return { name, directory, ...loadPackageDirectory(directory, { regenerate: known?.regenerate ?? null }) };
}

const SOURCES = ['cli-pilot-runner.mjs', 'cli-paired-runner.mjs', 'cli-attempt.mjs', 'cli-controls.mjs',
  'cli-control-audit.mjs', 'claude-context-policy.mjs', 'codex-context-policy.mjs', 'codex-isolation.mjs',
  'cli-trial-plan.mjs', 'development-surfaces.mjs', 'pilot-tasks.mjs'];

function parseOptions(args) {
  const options = {}, positional = [];
  for (let i = 0; i < args.length; i++) {
    if (!args[i].startsWith('--')) { positional.push(args[i]); continue; }
    const key = args[i].slice(2);
    if (key === 'after-interruption') { options.afterInterruption = true; continue; }
    assert(['cohorts', 'tasks', 'repeats', 'transport', 'restart-of'].includes(key) && i + 1 < args.length, `unknown or incomplete option --${key}`);
    options[key] = args[++i];
  }
  return { options, positional };
}

const USAGE = `usage:
  node --import tsx cli-pilot-runner.mjs start PINNED_PP TOOLING PACKAGE NEW_OUTPUT [--cohorts a,b] [--tasks t1,t2] [--repeats n] [--transport claude=SUMMARY_JSON] [--restart-of HALTED_OUTPUT]
  node --import tsx cli-pilot-runner.mjs resume PINNED_PP TOOLING OUTPUT [--after-interruption]
PACKAGE is "pilot-rigorous-v1", "pilot-development-v5", "development" or a package directory (v1-v4 are retired).
The stage comes from the package. A rigorous start is a full pass, or a restart of the halted
full pass's unfinished cohorts with --restart-of and --cohorts (R01-D6).`;

async function main(args) {
  const { options, positional: [command, upstream, tooling, ...rest] } = parseOptions(args);
  assert(['start', 'resume'].includes(command) && upstream && tooling, USAGE);
  const tokenizerPackage = readJson(resolve(tooling, 'node_modules/js-tiktoken/package.json'));
  assert.equal(tokenizerPackage.version, '1.0.21');
  const { getEncoding } = await import(pathToFileURL(resolve(tooling, 'node_modules/js-tiktoken/dist/index.js')));
  const tokenizer = getEncoding('o200k_base');

  let output, plan, pkg, prior = null, sessionIndex, firstSession = null;
  if (command === 'start') {
    const [packageName, outputArg] = rest;
    assert(packageName && outputArg && !options.afterInterruption, USAGE);
    assert(!PACKAGES[packageName]?.retired, `${packageName} is retired; use ${PACKAGES[packageName]?.retired}`);
    pkg = resolvePackage(packageName);
    const stage = pkg.manifest.stage ?? 'development';
    const halted = options['restart-of'] ? { output: resolve(options['restart-of']),
      plan: readJson(join(resolve(options['restart-of']), 'plan.json')), results: readJson(join(resolve(options['restart-of']), 'results.json')) } : null;
    const selection = pilotSelection({ cohorts: options.cohorts?.split(','), tasks: options.tasks?.split(','),
      repeats: options.repeats === undefined ? undefined : Number(options.repeats), stage });
    plan = pilotPlan(pkg.manifest, selection);
    const restartOf = checkRestart(plan, pkg, halted);
    if (restartOf) plan = { ...plan, selection: { ...plan.selection, restartOf } };
    const pinned = loadExecution(packageName);
    assert(pinned || stage === 'development', 'a rigorous start needs a pinned execution manifest');
    if (pinned) checkExecution(pinned, pkg, plan);
    output = resolve(outputArg);
    assert(!existsSync(output), 'output already exists');
    sessionIndex = 1;
  } else {
    const [outputArg] = rest;
    assert(outputArg && !options.cohorts && !options.tasks && !options.repeats, USAGE);
    output = resolve(outputArg);
    const saved = readJson(join(output, 'plan.json'));
    const results = readJson(join(output, 'results.json'));
    const allowed = options.afterInterruption ? ['paused-quota', 'running'] : ['paused-quota'];
    assert(allowed.includes(results.status), `results status ${results.status} cannot resume${results.status === 'running' ? ' without --after-interruption' : ''}`);
    pkg = resolvePackage(saved.package.name);
    assert.equal(pkg.manifestSha256, saved.package.manifestSha256, 'package changed since the plan was written');
    plan = pilotPlan(pkg.manifest, pilotSelection(saved.selection));
    if (saved.selection.restartOf) plan = { ...plan, selection: { ...plan.selection, restartOf: saved.selection.restartOf } };
    assert.equal(canonical({ ...plan, package: saved.package }), canonical(saved), 'rebuilt plan differs; start a new versioned run');
    prior = results.runs;
    const sessions = readdirSync(join(output, 'sessions')).sort();
    firstSession = readJson(join(output, 'sessions', sessions[0]));
    sessionIndex = sessions.length + 1;
    options.transport ??= firstSession.transportArgument;
  }

  // Pin each provider binary; a resumed session must use the same binaries.
  const binaries = {}, authentication = {};
  for (const provider of new Set(plan.cohorts.map(c => c.profile.provider))) {
    const profile = plan.cohorts.find(c => c.profile.provider === provider).profile;
    ({ binary: binaries[provider], authentication: authentication[provider] } = preflightProvider(provider, profile.version));
    if (firstSession) assert.equal(binaries[provider].sha256, firstSession.binaries[provider].sha256,
      `${provider} binary changed; a new context-policy check is required before further calls`);
  }
  const transportEvidence = {};
  for (const entry of options.transport ? options.transport.split(',') : []) {
    const [provider, path] = entry.split('=');
    assert(provider === 'claude' && path, '--transport accepts claude=SUMMARY_JSON');
    const evidence = readJson(resolve(path));
    transportEvidence[provider] = { ...evidence, pass: evidence.evaluation?.pass === true, fileSha256: sha(readFileSync(resolve(path))) };
  }
  if (command === 'start') {
    // Record the materialized order before any submission.
    mkdirSync(output); mkdirSync(join(output, 'sessions')); mkdirSync(join(output, 'attempts'));
    writeFileSync(join(output, 'plan.json'), json({ ...plan, package: { name: pkg.name, manifestSha256: pkg.manifestSha256 } }));
  }
  const referenced = new Set((prior ?? []).flatMap(r => r.submissions ?? []).map(s => s.directory));
  const existing = readdirSync(join(output, 'attempts')).sort();
  const { createAdapter } = await import('./precision.mjs');
  const adapter = await createAdapter(upstream);
  const session = { schema: 'r01-pilot-session-v1', stage: plan.stage, session: sessionIndex, command,
    afterInterruption: options.afterInterruption === true, startedAt: new Date().toISOString(), node: process.version,
    package: { name: pkg.name, manifestSha256: pkg.manifestSha256 }, binaries, authentication,
    transportArgument: options.transport ?? null,
    transportEvidenceSha256: Object.fromEntries(Object.entries(transportEvidence).map(([k, v]) => [k, v.fileSha256])),
    scoring: SCORING_VERSION, feedback: FEEDBACK_VERSION,
    tokenizer: 'js-tiktoken@1.0.21/o200k_base', upstreamPin: adapter.pin, precisionPatchSha256: adapter.patchSha256,
    // Attempts left by an interrupted session are retained, unscored and listed.
    unscoredInterruptedAttempts: existing.filter(name => !referenced.has(`attempts/${name}`)),
    sources: SOURCES.map(path => ({ path: `brain/benchmarks/r01-candidates/${path}`, sha256: sha(readFileSync(new URL(path, import.meta.url))) })) };
  writeFileSync(join(output, 'sessions', `${String(sessionIndex).padStart(2, '0')}.json`), json(session));

  const writeResults = result => writeFileSync(join(output, 'results.json'), json({ schema: 'r01-pilot-results-v1',
    stage: plan.stage, status: result.status,
    evidence: plan.stage === 'development' ? 'development stage: supports design iteration only, not candidate comparison' : 'rigorous stage',
    selection: plan.selection, sessions: sessionIndex, counts: result.counts, countsByCohort: countsByCohort(plan, result),
    runs: result.runs }));
  let sequence = existing.length;
  try {
    const result = runSequence({ plan, pairs: pkg.pairs, tasks: pkg.tasks, codec: surfaces(adapter), prior,
      execute(run, attemptIndex, prompt, role) {
        const cohort = cohortOf(plan, run);
        const profile = plan.cohorts.find(c => c.id === cohort).profile;
        const suffix = role === 'resumed-after-quota' ? '-resumed' : role === 'resubmitted-after-stall' ? '-resubmitted' : '';
        const name = `${String(++sequence).padStart(3, '0')}-${cohort}-r${run.repetition}-${run.cell}-a${attemptIndex}${suffix}`;
        const { processResult } = runCliAttempt({ profile, binary: binaries[profile.provider], prompt,
          output: join(output, 'attempts', name), timeoutMs: run.timeoutMs,
          meta: { kind: 'pilot-run', stage: plan.stage, session: sessionIndex, runId: run.id, cell: run.cell, cohort, attemptIndex, role } });
        console.error(`${sequence} ${cohort} r${run.repetition} ${run.cell} a${attemptIndex} ${role}: exit ${processResult.exitCode} ${Math.round(processResult.elapsedMs)} ms`);
        return { directory: `attempts/${name}` };
      },
      audit(directory) {
        const absolute = join(output, directory);
        const provider = readJson(join(absolute, 'manifest.json')).profile.provider;
        const audited = auditAttempt(absolute, { tokenizer, transportEvidence: transportEvidence[provider] ?? null });
        writeFileSync(join(absolute, 'audit.json'), json(audited));
        const processRecord = readJson(join(absolute, 'process.json'));
        return { ...audited, elapsedMs: processRecord.elapsedMs, timedOut: /ETIMEDOUT/.test(processRecord.error ?? '') };
      },
      checkpoint(snapshot) {
        const pending = snapshot.runs.some(r => r.status === 'not-submitted');
        writeResults({ ...snapshot, status: snapshot.status === 'complete' && pending ? 'running' : snapshot.status });
      } });
    writeResults(result);
    console.log(json({ stage: plan.stage, status: result.status, counts: result.counts }));
    if (result.status !== 'complete') process.exitCode = 1;
  } finally { adapter.dispose(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main(process.argv.slice(2));
