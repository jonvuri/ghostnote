import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { PACKAGES, PILOT, pilotSelection, pilotPlan, cohortOf, countsByCohort, resolvePackage, loadPackageDirectory } from './cli-pilot-runner.mjs';
import { runSequence } from './cli-paired-runner.mjs';
import { PROFILES, DEVELOPMENT_PROFILES } from './cli-controls.mjs';
import { INSTANCES, draftCells, draftCounts } from './pilot-draft.mjs';
import { surfaces, goldenResponse } from './development-surfaces.mjs';

const hash = value => createHash('sha256').update(String(value)).digest('hex');
const development = resolvePackage('development');

// A pilot-shaped package manifest with placeholder hashes: it exercises the
// planner on the draft's twelve instances before materialization exists.
function pilotShapedManifest(stage = 'development') {
  const cells = draftCells().map(c => ({ id: `${c.instance}--${c.arm}`, task: c.instance, arm: c.arm, role: c.role,
    eligible: c.eligible, ...(c.eligible ? { prompt: { sha256: hash(`${c.instance}/${c.arm}`) },
      request: { sha256: hash(c.instance) }, sourceFactsSha256: hash(`facts/${c.instance}`),
      decodedFactsSha256: hash(`facts/${c.instance}`) } : { reason: c.reason }) }));
  return { schema: 'r01-pilot-package-v1', status: 'offline-materialized', stage,
    tasks: INSTANCES.map(i => ({ id: i.id })), cells };
}

test('the full pilot plan matches draft 2: 201 initial and 603 maximum submissions per cohort', () => {
  const plan = pilotPlan(pilotShapedManifest(), pilotSelection());
  const expected = draftCounts();
  assert.equal(plan.stage, 'development');
  assert.equal(plan.seed, 'r01-pilot-order-v1');
  assert.deepEqual(plan.cohorts.map(c => c.id), ['claude-current', 'codex-current']);
  assert.deepEqual(plan.cohorts.map(c => c.profile), [DEVELOPMENT_PROFILES['claude-current'], DEVELOPMENT_PROFILES['codex-current']]);
  assert.deepEqual([plan.counts.initialAttempts, plan.counts.maximumTaskAttempts, plan.counts.exclusions],
    [expected.allCohorts.initialAttempts, expected.allCohorts.maximumSubmissions, expected.exclusions * 2]);
  for (const cohort of plan.cohorts) {
    const runs = plan.runs.filter(r => r.configSha256 === cohort.configSha256);
    assert.equal(runs.length, 201);
    assert.equal(runs.filter(r => r.role === 'primary').length, 168);
    assert.equal(runs.filter(r => r.role === 'diagnostic').length, 33);
    assert.equal(runs.length * (1 + plan.maxRepairs), 603);
    assert.equal(plan.exclusions.filter(e => e.configSha256 === cohort.configSha256).length, 51);
    assert(runs.every(r => cohortOf(plan, r) === cohort.id));
  }
  assert.equal(plan.selection.subset, false);
  assert.deepEqual(pilotPlan(pilotShapedManifest(), pilotSelection()), plan, 'seeded order is reproducible');
});

test('subsets are recorded, keep the pilot cohort order and refuse unadmitted cohorts', () => {
  const selection = pilotSelection({ cohorts: ['codex-current', 'claude-current'], tasks: ['p10-refuse-ambiguous-pitch'], repeats: 1 });
  assert.deepEqual(selection.cohorts, PILOT.cohorts);
  assert.equal(selection.subset, true);
  const plan = pilotPlan(pilotShapedManifest(), selection);
  assert.equal(plan.runs.length, 12);
  assert.deepEqual(plan.selection.tasks, ['p10-refuse-ambiguous-pitch']);
  assert.equal(pilotSelection({ cohorts: ['codex-current'] }).subset, true);
  assert.throws(() => pilotSelection({ cohorts: ['claude-historical'] }), /not an admitted pilot cohort/);
  // E376: a development effort probe runs only as a recorded development subset.
  const probe = pilotSelection({ cohorts: ['codex-current-medium'], tasks: ['p10-refuse-ambiguous-pitch'], repeats: 1 });
  assert.deepEqual([probe.cohorts, probe.subset], [['codex-current-medium'], true]);
  assert.equal(pilotSelection({ cohorts: ['codex-current-medium'] }).subset, true);
  assert.throws(() => pilotSelection({ cohorts: ['codex-current-medium'], stage: 'rigorous' }), /not an admitted pilot cohort/);
  assert.throws(() => pilotSelection({ repeats: 0 }), /positive integer/);
  assert.throws(() => pilotSelection({ cohorts: [] }), /nonempty/);
});

test('the stage label must agree between selection, plan and package', () => {
  assert.equal(pilotPlan(pilotShapedManifest('rigorous'), pilotSelection({ stage: 'rigorous' })).stage, 'rigorous');
  assert.throws(() => pilotPlan(pilotShapedManifest('development'), pilotSelection({ stage: 'rigorous' })), /stage differs/);
  // The E358 package predates stage labels and is development material only.
  assert.equal(pilotPlan(development.manifest, pilotSelection({ repeats: 1 })).stage, 'development');
  assert.throws(() => pilotPlan(development.manifest, pilotSelection({ stage: 'rigorous' })), /stage differs/);
  assert.throws(() => pilotSelection({ stage: 'final' }), /unknown stage/);
});

test('package loading checks artifact hashes and pinned prompts', () => {
  assert.equal(development.tasks.length, development.manifest.tasks.length);
  const directory = mkdtempSync(join(tmpdir(), 'r01-pilot-package-'));
  try {
    cpSync(development.directory, directory, { recursive: true });
    assert.equal(loadPackageDirectory(directory).manifestSha256, development.manifestSha256);
    const pairs = development.pairs.map((p, i) => i ? p : { ...p, prompt: p.prompt + ' ' });
    writeFileSync(join(directory, 'pairs.json'), JSON.stringify(pairs, null, 2) + '\n');
    assert.throws(() => loadPackageDirectory(directory), /artifact hash differs/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('one sequence runs both cohorts with per-cohort counts and resumes after a quota pause', () => {
  const plan = pilotPlan(development.manifest, pilotSelection({ tasks: ['halve-group-spread'], repeats: 1 }));
  const codec = surfaces(null), task = development.tasks.find(t => t.id === 'halve-group-spread');
  assert.equal(plan.runs.length, 10);
  const pausedAt = plan.runs.findIndex(r => cohortOf(plan, r) === 'codex-current');
  const submitted = [];
  const sequence = (quotaAt) => ({ plan, pairs: development.pairs, tasks: development.tasks, codec,
    execute: (run, attemptIndex, prompt, role) => { submitted.push({ run, role }); return { directory: `${submitted.length}` }; },
    audit: () => {
      const { run } = submitted.at(-1);
      if (run.id === plan.runs[quotaAt]?.id) return { controlPass: false, issues: ['transport-or-client-failure'], rateLimitStatuses: ['rejected'] };
      return { controlPass: true, issues: [], answer: goldenResponse(task, run.arm, codec), totalInputTokens: 5, finalOutputTokens: 1 };
    } });
  const paused = runSequence(sequence(pausedAt));
  assert.equal(paused.status, 'paused-quota');
  assert.deepEqual(countsByCohort(plan, paused)['claude-current'].finishedRuns, 5);
  assert.deepEqual(countsByCohort(plan, paused)['codex-current'].finishedRuns, 0);
  const resumed = runSequence({ ...sequence(-1), prior: paused.runs });
  assert.equal(resumed.status, 'complete');
  const counts = countsByCohort(plan, resumed);
  assert.deepEqual([counts['claude-current'].firstAttemptPasses, counts['codex-current'].firstAttemptPasses], [5, 5]);
  assert.deepEqual([counts['claude-current'].quotaPauses, counts['codex-current'].quotaPauses], [0, 1]);
  assert.equal(submitted.filter(s => s.role === 'resumed-after-quota').length, 1);
  assert.equal(resumed.stage, 'development');
});

test('a timeout without an answer is resubmitted once with identical bytes; a second stall halts (E370)', () => {
  const plan = pilotPlan(development.manifest, pilotSelection({ tasks: ['halve-group-spread'], repeats: 1 }));
  assert.equal(plan.selection.stallResubmissions, 1);
  const codec = surfaces(null), task = development.tasks.find(t => t.id === 'halve-group-spread');
  const stalled = { controlPass: false, issues: ['transport-or-client-failure'], timedOut: true, answer: null };
  const harness = (decide) => {
    const submitted = [];
    const result = runSequence({ plan, pairs: development.pairs, tasks: development.tasks, codec,
      execute: (run, attemptIndex, prompt, role) => { submitted.push({ run, attemptIndex, prompt, role }); return { directory: `${submitted.length}` }; },
      audit: () => {
        const last = submitted.at(-1), count = submitted.filter(s => s.run.id === last.run.id).length;
        return decide(last, count) ?? { controlPass: true, issues: [], answer: goldenResponse(task, last.run.arm, codec), totalInputTokens: 5, finalOutputTokens: 1 };
      } });
    return { result, submitted };
  };
  // One stall on the third run's initial attempt: resubmitted, then passes; the run still counts as a first-attempt pass.
  const third = plan.runs[2].id;
  const once = harness((last, count) => last.run.id === third && count === 1 ? stalled : null);
  assert.equal(once.result.status, 'complete');
  const resubmission = once.submitted.find(s => s.role === 'resubmitted-after-stall');
  assert.equal(resubmission.prompt, once.submitted.find(s => s.run.id === third && s.role === 'initial').prompt, 'identical bytes');
  const run = once.result.runs.find(r => r.id === third);
  assert.deepEqual(run.submissions.map(s => [s.role, s.outcome]), [['initial', 'stall'], ['resubmitted-after-stall', 'pass']]);
  assert.equal(run.firstAttemptPass, true); assert.equal(run.repairsUsed, 0);
  assert.deepEqual([once.result.counts.stalls, once.result.counts.stallResubmissions, once.result.counts.finishedRuns], [1, 1, 10]);
  // Two consecutive stalls on the same attempt halt as a transport failure.
  const twice = harness((last, count) => last.run.id === third && count <= 2 ? stalled : null);
  assert.equal(twice.result.status, 'halted-transport');
  assert.equal(twice.submitted.length, 4);
  // A timeout that still produced an answer, or a non-timeout failure, is not a stall.
  const failed = harness((last) => last.run.id === third ? { controlPass: false, issues: ['transport-or-client-failure'], timedOut: false } : null);
  assert.equal(failed.result.status, 'halted-transport'); assert.equal(failed.submitted.length, 3);
  // Without the policy (earlier plans), a stall halts immediately.
  const strict = { ...plan, selection: { ...plan.selection, stallResubmissions: 0 } };
  const halted = runSequence({ plan: strict, pairs: development.pairs, tasks: development.tasks, codec,
    execute: () => ({ directory: 'x' }), audit: () => stalled });
  assert.equal(halted.status, 'halted-transport');
});

test('retired packages refuse new starts', () => {
  for (const version of [1, 2, 3, 4]) assert.equal(PACKAGES[`pilot-development-v${version}`].retired, 'pilot-development-v5');
  assert.equal(PACKAGES['pilot-development-v5'].retired, undefined);
});
