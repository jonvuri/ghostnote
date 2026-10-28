import test from 'node:test';
import assert from 'node:assert/strict';
import { REHEARSAL, SELECTIONS, selectTasks, modelConfig, correctionPrompt, feedback, runSequence, loadPackage, resumeState } from './cli-paired-runner.mjs';
import { buildTrialPlan } from './cli-trial-plan.mjs';
import { PROFILES } from './cli-controls.mjs';
import { surfaces, goldenResponse } from './development-surfaces.mjs';

const { manifest, pairs, tasks } = loadPackage();
const options = { models: [modelConfig(PROFILES[REHEARSAL.profileId])], seed: REHEARSAL.seed,
  repeats: REHEARSAL.repeats, maxRepairs: REHEARSAL.maxRepairs, timeoutMs: REHEARSAL.timeoutMs };
const plan = buildTrialPlan(selectTasks(manifest, REHEARSAL.tasks), options);
// Fault cases use the group task only: its arms need no Producer Pal adapter.
const groupPlan = buildTrialPlan(selectTasks(manifest, ['halve-group-spread']), options);
const codec = surfaces(null);
const task = id => tasks.find(t => t.id === id);
const pass = answer => ({ controlPass: true, issues: [], answer, rawFinalUsage: { input_tokens: 1, output_tokens: 1 },
  totalInputTokens: 10, finalOutputTokens: 2 });

// Scripted executor: each response is either answer text, 'GOLD', or an audit override.
function harness(script) {
  const submitted = [];
  const execute = (run, attemptIndex, prompt) => { submitted.push({ run, attemptIndex, prompt }); return { directory: `${run.cell}/${attemptIndex}` }; };
  const audit = () => {
    const { run } = submitted.at(-1), step = script(run, submitted.filter(s => s.run.id === run.id).length - 1);
    if (step === 'GOLD') return pass(goldenResponse(task(run.task), run.arm, codec));
    return typeof step === 'string' ? pass(step) : { ...pass(null), ...step };
  };
  return { submitted, execute, audit };
}

test('rehearsal plan has 11 initial attempts, 33 maximum submissions and four explicit exclusions', () => {
  assert.deepEqual([plan.counts.initialAttempts, plan.counts.primaryAttempts, plan.counts.diagnosticAttempts,
    plan.counts.exclusions, plan.counts.maximumTaskAttempts], [11, 8, 3, 4, 33]);
  assert.equal(plan.seed, 'r01-paired-rehearsal-v1');
  assert.deepEqual(plan.models[0], { ...options.models[0], maxRepairs: 2, timeoutMs: 120000,
    wrapperFallback: false, wrapperAutomaticRetry: false, configSha256: plan.models[0].configSha256 });
  assert.deepEqual(new Set(plan.runs.filter(r => r.role === 'diagnostic').map(r => r.arm)),
    new Set(['c3-json', 'c4-json', 'c4-detached-fields']));
  assert(plan.exclusions.every(e => e.task === 'halve-group-spread' && e.reason));
  assert.deepEqual(buildTrialPlan(selectTasks(manifest, REHEARSAL.tasks), options), plan, 'seeded order is reproducible');
});

test('a failed answer receives an equal-form correction carrying the full history, then can pass', () => {
  const h = harness((run, i) => i === 0 ? 'not a valid surface' : 'GOLD');
  const result = runSequence({ plan: groupPlan, pairs, tasks, codec, ...h });
  assert.equal(result.status, 'complete');
  assert.equal(result.counts.submissions, 10); assert.equal(result.counts.repairsUsed, 5);
  assert(result.runs.every(r => !r.firstAttemptPass && r.withinBudgetPass && r.repairsUsed === 1));
  for (const run of groupPlan.runs) {
    const [initial, correction] = h.submitted.filter(s => s.run.id === run.id);
    const original = pairs.find(p => p.id === run.cell).prompt;
    assert.equal(initial.prompt, original);
    assert(correction.prompt.startsWith('CORRECTION REQUEST 1 OF 2\n'));
    assert(correction.prompt.includes(`ORIGINAL TASK\n<<<\n${original.trimEnd()}\n>>>`));
    assert(correction.prompt.includes('ATTEMPT 1 ANSWER\n<<<\nnot a valid surface\n>>>'));
    assert(correction.prompt.includes('"reason":"parse-or-validation-error"'));
    assert(!correction.prompt.includes(goldenResponse(task(run.task), run.arm, codec)), 'golden response leaked');
  }
});

test('feedback locates answer errors without disclosing expected values (D59)', () => {
  assert.deepEqual(feedback({ reason: 'source-state-mismatch', missing: ['secret'], extra: [] }), { reason: 'source-state-mismatch' });
  assert.deepEqual(feedback({ reason: 'answer-mismatch', differences: ['$.before: differs'] }), { reason: 'answer-mismatch', differingPaths: ['$.before: differs'] });
  const note = (pitch, velocity) => ({ id: 'x', pitch, at: '1', duration: '1/2', velocity, channel: 1 });
  const performed = feedback({ reason: 'performed-state-or-envelope-mismatch', rootPreserved: true, envelopePreserved: true,
    missing: [{ note: note(60, 91), count: 1 }], extra: [{ note: note(60, 83), count: 2 }] });
  assert.deepEqual(performed, { reason: 'performed-state-or-envelope-mismatch', unmatchedAnswerNoteCount: 2,
    unmatchedAnswerNotes: [{ pitch: 60, at: '1', duration: '1/2', velocity: 83 }, { pitch: 60, at: '1', duration: '1/2', velocity: 83 }], missingNoteCount: 1 });
  assert(!JSON.stringify(performed).includes('91'), 'expected value leaked');
  const paths = Array.from({ length: 12 }, (_, i) => `$.notes[${i}].at: differs`);
  assert.deepEqual(feedback({ reason: 'source-state-mismatch', differences: paths }), { reason: 'source-state-mismatch', differingPaths: paths.slice(0, 8), differingPathCount: 12 });
  assert.deepEqual(Object.keys(feedback({ reason: 'parse-or-validation-error', error: 'bad line 3' })), ['reason', 'validationError']);
  const twice = correctionPrompt('TASK\n', [{ answer: 'a', feedback: { reason: 'x' } }, { answer: 'b', feedback: { reason: 'y' } }], 2);
  assert(twice.startsWith('CORRECTION REQUEST 2 OF 2\n') && twice.includes('ATTEMPT 2 ANSWER\n<<<\nb\n>>>'));
  assert.throws(() => correctionPrompt('TASK\n', [], 2));
});

test('the correction budget stops after two repairs; no fourth submission occurs', () => {
  const h = harness(() => 'REFUSE unsupported');
  const result = runSequence({ plan: groupPlan, pairs, tasks, codec, ...h });
  assert.equal(result.status, 'complete');
  assert(result.runs.every(r => r.status === 'exhausted' && r.submissions.length === 3 && r.repairsUsed === 2));
  assert.equal(h.submitted.length, 15);
  assert(result.runs[0].submissions.every(s => s.score.reason === 'gratuitous-refusal'));
});

test('transport, control and quota failures stop the sequence without scoring or retrying', () => {
  for (const [audit, status] of [
    [{ controlPass: false, issues: ['transport-or-client-failure'] }, 'halted-transport'],
    [{ controlPass: false, issues: ['claude-client-context-policy-violation'] }, 'halted-control'],
    [{ controlPass: false, issues: ['transport-or-client-failure'], apiErrorStatus: 429 }, 'paused-quota'],
    [{ controlPass: false, issues: ['transport-or-client-failure'], rateLimitStatuses: ['rejected'] }, 'paused-quota'],
  ]) {
    const h = harness((run, i) => run.id === groupPlan.runs[1].id ? audit : 'GOLD');
    const result = runSequence({ plan: groupPlan, pairs, tasks, codec, ...h });
    assert.equal(result.status, status);
    assert.equal(h.submitted.length, 2, 'no retry of the failed attempt and no later run');
    assert.equal(result.runs[1].submissions[0].score, undefined);
    assert.equal(result.runs[1].status, status);
    assert.equal(result.runs[1].submissions[0].outcome, status === 'paused-quota' ? 'quota' : status.slice(7));
    assert.equal(result.runs[1].repairsUsed, 0);
    assert(result.runs.slice(2).every(r => r.status === 'not-submitted'));
  }
});

test('a delivered prompt that differs from the plan refuses before submission', () => {
  const h = harness(() => 'GOLD');
  const altered = pairs.map(p => p.id === groupPlan.runs[0].cell ? { ...p, prompt: p.prompt + ' ' } : p);
  assert.throws(() => runSequence({ plan: groupPlan, pairs: altered, tasks, codec, ...h }), /differs from plan/);
  assert.equal(h.submitted.length, 0);
});

test('recovered retries remain successful first attempts and survive into submission reports', () => {
  const retryReport = { admissionGate: false, capturedRequests: 2, inferenceFailures: 1, httpAttempts: null };
  const h = harness(run => ({ ...pass(goldenResponse(task(run.task), run.arm, codec)),
    transportClean: false, retryReport }));
  const result = runSequence({ plan: groupPlan, pairs, tasks, codec, ...h });
  assert.equal(result.status, 'complete');
  assert.equal(result.counts.repairsUsed, 0);
  assert.equal(result.counts.submissions, groupPlan.runs.length);
  for (const run of result.runs) {
    assert.equal(run.firstAttemptPass, true);
    assert.deepEqual(run.submissions[0].retryReport, retryReport);
  }
});

test('Haiku 5.5 admission selection uses the current profile and every primary arm of one task', () => {
  const selection = SELECTIONS['haiku55-admission'];
  assert.equal(SELECTIONS.rehearsal, REHEARSAL);
  assert.equal(PROFILES[selection.profileId].model, 'claude-haiku-5-5');
  const { manifest } = loadPackage();
  const plan = buildTrialPlan(selectTasks(manifest, selection.tasks), { models: [modelConfig(PROFILES[selection.profileId])],
    seed: selection.seed, repeats: selection.repeats, maxRepairs: selection.maxRepairs, timeoutMs: selection.timeoutMs });
  assert.equal(plan.runs.length, 6);
  assert(plan.runs.every(r => r.role === 'primary' && r.task === 'edit-velocity-guitar'));
  assert.equal(new Set(plan.runs.map(r => r.arm)).size, 6);
});

const quota = { controlPass: false, issues: ['transport-or-client-failure'], apiErrorStatus: 429 };

test('a quota pause resumes with a labeled resubmission that consumes no correction', () => {
  const target = groupPlan.runs[2].id;
  const first = harness((run, i) => run.id === target ? quota : 'GOLD');
  const paused = runSequence({ plan: groupPlan, pairs, tasks, codec, ...first });
  assert.equal(paused.status, 'paused-quota');
  assert.equal(paused.counts.quotaPauses, 1);
  const second = harness(() => 'GOLD');
  const resumed = runSequence({ plan: groupPlan, pairs, tasks, codec, ...second, prior: paused.runs });
  assert.equal(resumed.status, 'complete');
  // Only the paused run and later runs are submitted again.
  assert.deepEqual(second.submitted.map(s => s.run.id), groupPlan.runs.slice(2).map(r => r.id));
  const run = resumed.runs[2];
  assert.deepEqual(run.submissions.map(s => [s.role, s.outcome]), [['initial', 'quota'], ['resumed-after-quota', 'pass']]);
  assert.equal(run.submissions[1].resumes, 0);
  assert.equal(second.submitted[0].prompt, pairs.find(p => p.id === run.cell).prompt);
  assert.deepEqual([run.status, run.firstAttemptPass, run.withinBudgetPass, run.repairsUsed], ['complete', true, true, 0]);
  assert.deepEqual(resumed.runs.slice(0, 2), paused.runs.slice(0, 2), 'finished runs carry forward unchanged');
  assert.deepEqual([resumed.counts.submissions, resumed.counts.quotaPauses, resumed.counts.resumedSubmissions],
    [groupPlan.runs.length + 1, 1, 1]);
});

test('a quota pause during a correction resumes the same correction with its full history', () => {
  const target = groupPlan.runs[0].id;
  const first = harness((run, i) => run.id !== target ? 'GOLD' : i === 0 ? 'not a valid surface' : quota);
  const paused = runSequence({ plan: groupPlan, pairs, tasks, codec, ...first });
  const pausedPrompt = first.submitted[1].prompt;
  assert(pausedPrompt.startsWith('CORRECTION REQUEST 1 OF 2\n'));
  const second = harness(() => 'GOLD');
  const resumed = runSequence({ plan: groupPlan, pairs, tasks, codec, ...second, prior: paused.runs });
  assert.equal(second.submitted[0].prompt, pausedPrompt, 'the interrupted correction is resubmitted byte for byte');
  assert.equal(second.submitted[0].attemptIndex, 1);
  const run = resumed.runs[0];
  assert.deepEqual(run.submissions.map(s => [s.role, s.outcome]),
    [['initial', 'fail'], ['correction', 'quota'], ['resumed-after-quota', 'pass']]);
  assert.deepEqual([run.status, run.firstAttemptPass, run.repairsUsed], ['complete', false, 1]);
});

test('halted runs and mismatched prior results refuse to resume', () => {
  const target = groupPlan.runs[1].id;
  const control = { controlPass: false, issues: ['claude-client-context-policy-violation'] };
  const halted = runSequence({ plan: groupPlan, pairs, tasks, codec, ...harness(run => run.id === target ? control : 'GOLD') });
  assert.throws(() => runSequence({ plan: groupPlan, pairs, tasks, codec, ...harness(() => 'GOLD'), prior: halted.runs }), /cannot resume/);
  assert.throws(() => runSequence({ plan: groupPlan, pairs, tasks, codec, ...harness(() => 'GOLD'), prior: halted.runs.slice(1) }), /do not match/);
  assert.throws(() => resumeState(halted.runs[1], 2), /only a quota pause/);
});

test('checkpoints report every run after it finishes, with pending runs not submitted', () => {
  const snapshots = [];
  runSequence({ plan: groupPlan, pairs, tasks, codec, ...harness(() => 'GOLD'), checkpoint: s => snapshots.push(s) });
  assert.equal(snapshots.length, groupPlan.runs.length);
  snapshots.forEach((s, i) => {
    assert.equal(s.runs.length, groupPlan.runs.length);
    assert.equal(s.runs.filter(r => r.status === 'not-submitted').length, groupPlan.runs.length - i - 1);
    assert.equal(s.stage, 'development');
  });
});
