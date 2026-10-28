// Paired development runner: seeded order, audited CLI attempts, independent
// scoring and explicit bounded corrections. Development evidence only.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PROFILES } from './cli-controls.mjs';
import { buildTrialPlan, createRepairState, recordAttempt } from './cli-trial-plan.mjs';
import { scoreResponse, surfaces } from './development-surfaces.mjs';
import { developmentTasks } from './development-tasks.mjs';
import { canonical } from './common.mjs';
import { auditAttempt } from './cli-control-audit.mjs';
import { resolveBinary, runCliAttempt, sha } from './cli-attempt.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const json = value => JSON.stringify(value, null, 2) + '\n';

export const REHEARSAL = Object.freeze({
  schema: 'r01-paired-rehearsal-selection-v1',
  seed: 'r01-paired-rehearsal-v1',
  profileId: 'claude-historical',
  tasks: ['edit-velocity-guitar', 'halve-group-spread'],
  repeats: 1, maxRepairs: 2, timeoutMs: 120000,
});

// Haiku 5.5 admission check: one development task across its six primary arms,
// through the normal runner and context policy v2. Development evidence only.
export const HAIKU55_ADMISSION = Object.freeze({
  schema: 'r01-paired-rehearsal-selection-v1',
  seed: 'r01-haiku55-admission-v1',
  profileId: 'claude-current',
  tasks: ['edit-velocity-guitar'],
  repeats: 1, maxRepairs: 2, timeoutMs: 120000,
});
export const SELECTIONS = Object.freeze({ rehearsal: REHEARSAL, 'haiku55-admission': HAIKU55_ADMISSION });

/** Restrict the development manifest to selected tasks, keeping every exclusion. */
export function selectTasks(manifest, taskIds) {
  for (const id of taskIds) assert(manifest.tasks.some(t => t.id === id), `unknown task ${id}`);
  return { ...manifest, tasks: manifest.tasks.filter(t => taskIds.includes(t.id)),
    cells: manifest.cells.filter(c => taskIds.includes(c.task)) };
}

export function modelConfig(profile) {
  return Object.fromEntries(['provider', 'model', 'effort', 'thinkingBudget', 'maxOutputTokens']
    .filter(k => profile[k] !== undefined).map(k => [k, profile[k]]));
}

/**
 * Structured feedback, identical in form for every arm (D59). It locates what
 * in the answer is wrong without disclosing expected values or a resolution:
 * the reason code, the native parser's message, answer/state paths that
 * differ, and the answer's own unmatched notes with a count of missing notes.
 */
export const FEEDBACK_VERSION = 'r01-feedback-v2-locating';
const LIMIT = 8;
const performed = note => ({ pitch: note.pitch, at: note.at, duration: note.duration, velocity: note.velocity });
export function feedback(score) {
  const result = { reason: score.reason ?? 'unspecified-failure' };
  if (score.reason === 'parse-or-validation-error' && score.error) result.validationError = String(score.error).slice(0, 400);
  if (score.differences?.length) {
    result.differingPaths = score.differences.slice(0, LIMIT);
    if (score.differences.length > LIMIT) result.differingPathCount = score.differences.length;
  }
  if (score.reason === 'performed-state-or-envelope-mismatch') {
    const extra = (score.extra ?? []).flatMap(e => Array(e.count).fill(performed(e.note)));
    result.unmatchedAnswerNoteCount = extra.length;
    if (extra.length) result.unmatchedAnswerNotes = extra.slice(0, LIMIT);
    result.missingNoteCount = (score.missing ?? []).reduce((sum, m) => sum + m.count, 0);
    if (score.rootPreserved === false) result.unexpectedTopLevelState = true;
    if (score.envelopePreserved === false) result.documentEnvelopeChanged = true;
  }
  return result;
}

/** A fresh single-turn submission carrying the full original task and history. */
export function correctionPrompt(original, history, maxRepairs) {
  assert(history.length >= 1 && history.length <= maxRepairs);
  const parts = [`CORRECTION REQUEST ${history.length} OF ${maxRepairs}`,
    'An independent checker rejected the previous answer to the task below. Return a corrected, complete answer under the original response contract.',
    '', 'ORIGINAL TASK', '<<<', original.trimEnd(), '>>>'];
  history.forEach(({ answer, feedback: detail }, i) => parts.push('', `ATTEMPT ${i + 1} ANSWER`, '<<<',
    String(answer ?? '').trimEnd(), '>>>', `ATTEMPT ${i + 1} FEEDBACK`, JSON.stringify(detail)));
  return parts.join('\n') + '\n';
}

// Quota or provider-limit evidence pauses the run instead of failing a task.
export function classify(audit) {
  if (audit.controlPass) return null;
  const limited = audit.apiErrorStatus === 429
    || (audit.rateLimitStatuses ?? []).some(status => status !== 'allowed' && status !== 'allowed_warning')
    || /usage limit|rate limit/i.test(audit.answer ?? '');
  if (audit.issues.includes('transport-or-client-failure')) {
    if (limited) return 'quota';
    // A submission killed at its timeout without a completed answer (E370).
    return audit.timedOut === true && !audit.answer ? 'stall' : 'transport';
  }
  return 'control';
}

const TERMINAL = new Set(['complete', 'exhausted']);

/**
 * Rebuild a paused run's repair state from its scored submissions. Quota
 * outcomes are retained but consume no correction (pilot draft 2).
 */
export function resumeState(prior, maxRepairs) {
  assert.equal(prior.status, 'paused-quota', `${prior.id}: only a quota pause can resume`);
  assert.equal(prior.submissions.at(-1)?.outcome, 'quota', `${prior.id}: paused run must end with its quota submission`);
  let state = createRepairState({ maxRepairs });
  const history = [];
  for (const s of prior.submissions.filter(s => s.outcome !== 'quota' && s.outcome !== 'stall')) {
    assert(['pass', 'fail'].includes(s.outcome) && s.score, `${prior.id}: unexpected prior outcome ${s.outcome}`);
    state = recordAttempt(state, { kind: 'task', pass: s.score.pass, reason: s.score.reason ?? null });
    if (state.status === 'awaiting-correction') history.push({ answer: s.answer, feedback: feedback(s.score) });
  }
  assert(state.nextAction !== 'none', `${prior.id}: paused run has no remaining submission`);
  return { state, history };
}

/**
 * Execute a plan through injected `execute(run, attemptIndex, prompt, role)`
 * and `audit(directory)` functions. A transport/control failure stops the whole
 * sequence; quota evidence pauses it. Nothing is retried implicitly, except
 * under the plan's explicit stall policy (`plan.selection.stallResubmissions`):
 * a submission that times out without an answer is kept as a `stall` outcome,
 * consumes no correction and is resubmitted with identical bytes as
 * `resubmitted-after-stall`. A stall beyond that allowance for the same
 * attempt halts the sequence as a transport failure.
 *
 * `prior` holds the run records of an earlier, quota-paused execution of the
 * same plan: terminal runs are carried forward, and the paused run continues
 * with a new `resumed-after-quota` submission of the interrupted attempt.
 * `checkpoint(snapshot)` receives the partial result after every run.
 */
export function runSequence({ plan, pairs, tasks, codec, execute, audit, prior = null, checkpoint = () => {} }) {
  const pairById = new Map(pairs.map(p => [p.id, p])), taskById = new Map(tasks.map(t => [t.id, t]));
  if (prior) assert.deepEqual(prior.map(r => r.id), plan.runs.map(r => r.id), 'prior results do not match the plan');
  const runs = [], stallAllowance = plan.selection?.stallResubmissions ?? 0;
  let status = 'complete';
  const snapshot = () => summarizeRuns(plan, status, [...runs, ...plan.runs.slice(runs.length)
    .map((run, i) => prior?.[runs.length + i] ?? { id: run.id, cell: run.cell, status: 'not-submitted' })]);
  for (const [index, run] of plan.runs.entries()) {
    const earlier = prior?.[index];
    if (earlier && TERMINAL.has(earlier.status)) { runs.push(earlier); continue; }
    if (status !== 'complete') { runs.push(earlier ?? { id: run.id, cell: run.cell, status: 'not-submitted' }); continue; }
    const pair = pairById.get(run.cell), task = taskById.get(run.task);
    assert(pair && task, `missing pair or task for ${run.cell}`);
    assert.equal(sha(pair.prompt), run.promptSha256, `${run.cell}: delivered prompt differs from plan`);
    const resuming = earlier?.status === 'paused-quota';
    if (earlier && !resuming) assert.equal(earlier.status, 'not-submitted', `${run.id}: ${earlier.status} cannot resume`);
    let { state, history } = resuming ? resumeState(earlier, run.maxRepairs)
      : { state: createRepairState({ maxRepairs: run.maxRepairs }), history: [] };
    const submissions = resuming ? [...earlier.submissions] : [];
    let resumeNext = resuming, paused = false, stalls = 0;
    while (state.nextAction !== 'none') {
      const prompt = history.length ? correctionPrompt(pair.prompt, history, run.maxRepairs) : pair.prompt;
      const attemptIndex = state.attempts.length;
      const role = resumeNext ? 'resumed-after-quota' : stalls ? 'resubmitted-after-stall'
        : attemptIndex ? 'correction' : 'initial';
      const { directory } = execute(run, attemptIndex, prompt, role);
      const audited = audit(directory);
      const failure = classify(audited);
      const submission = { attemptIndex, directory, promptSha256: sha(prompt), promptBytes: Buffer.byteLength(prompt),
        role, ...(resumeNext || stalls ? { resumes: submissions.length - 1 } : {}),
        controlPass: audited.controlPass, controlIssues: audited.issues,
        usage: audited.rawFinalUsage, totalInputTokens: audited.totalInputTokens, finalOutputTokens: audited.finalOutputTokens,
        contextClientBytes: (audited.codexContext?.clientAddedContextBytes ?? audited.claudeContext?.clientAddedTextBytes) ?? null,
        retryReport: audited.retryReport ?? null,
        localSerializedContextTokens: audited.requests?.[0]?.localSerializedContextTokens ?? null,
        elapsedMs: audited.elapsedMs ?? null };
      resumeNext = false;
      if (failure === 'quota') {
        // Retained as a quota outcome; it consumes no correction.
        submissions.push({ ...submission, outcome: 'quota' });
        status = 'paused-quota'; paused = true;
        break;
      }
      if (failure === 'stall' && stalls < stallAllowance) {
        // Retained as a stall outcome; it consumes no correction.
        submissions.push({ ...submission, outcome: 'stall' });
        stalls++;
        continue;
      }
      if (failure) {
        state = recordAttempt(state, { kind: failure === 'stall' ? 'transport' : failure, pass: false });
        submissions.push({ ...submission, outcome: failure });
        status = `halted-${failure === 'stall' ? 'transport' : failure}`;
        break;
      }
      stalls = 0;
      const score = scoreResponse(task, run.arm, audited.answer, codec);
      state = recordAttempt(state, { kind: 'task', pass: score.pass, reason: score.reason ?? null });
      // The answer is retained so a quota resume can rebuild correction history.
      submissions.push({ ...submission, outcome: score.pass ? 'pass' : 'fail', score,
        answerSha256: sha(audited.answer ?? ''), answer: audited.answer ?? null });
      if (state.status === 'awaiting-correction') history.push({ answer: audited.answer, feedback: feedback(score) });
    }
    const scored = submissions.filter(s => s.outcome !== 'quota' && s.outcome !== 'stall');
    runs.push({ id: run.id, cell: run.cell, task: run.task, arm: run.arm, role: run.role, repetition: run.repetition,
      provider: run.provider, model: run.model, configSha256: run.configSha256,
      status: paused ? 'paused-quota' : state.status,
      firstAttemptPass: scored[0]?.outcome === 'pass', withinBudgetPass: !paused && state.status === 'complete',
      repairsUsed: state.repairsUsed, submissions });
    checkpoint(snapshot());
  }
  return snapshot();
}

/** Counts over submitted runs; quota pauses and resumptions are reported separately. */
export function summarizeRuns(plan, status, runs) {
  const scored = runs.filter(r => r.submissions);
  const all = scored.flatMap(r => r.submissions);
  const sum = key => all.reduce((n, s) => n + (s[key] ?? 0), 0);
  const finished = scored.filter(r => TERMINAL.has(r.status));
  return { stage: plan.stage ?? 'development', status, runs, counts: { plannedRuns: plan.runs.length, submittedRuns: scored.length,
    finishedRuns: finished.length, submissions: all.length,
    quotaPauses: all.filter(s => s.outcome === 'quota').length,
    resumedSubmissions: all.filter(s => s.role === 'resumed-after-quota').length,
    stalls: all.filter(s => s.outcome === 'stall').length,
    stallResubmissions: all.filter(s => s.role === 'resubmitted-after-stall').length,
    firstAttemptPasses: finished.filter(r => r.firstAttemptPass).length,
    withinBudgetPasses: finished.filter(r => r.withinBudgetPass).length,
    repairsUsed: scored.reduce((n, r) => n + r.repairsUsed, 0),
    totalInputTokens: sum('totalInputTokens'), finalOutputTokens: sum('finalOutputTokens') } };
}

export function loadPackage() {
  const base = join(root, 'context/evidence/data/r01-development-pairs');
  const manifest = JSON.parse(readFileSync(join(base, 'manifest.json'), 'utf8'));
  const pairs = JSON.parse(readFileSync(join(base, 'pairs.json'), 'utf8'));
  const retained = JSON.parse(readFileSync(join(base, 'private-oracles.json'), 'utf8'));
  // The scorer uses current task code; it must equal the retained private record.
  const tasks = developmentTasks();
  assert.equal(canonical(tasks), canonical(retained.tasks), 'development tasks differ from retained oracles');
  return { manifest, pairs, tasks };
}

async function main([upstream, tooling, transportPath, outputArg, selectionId = 'rehearsal']) {
  assert(upstream && tooling && transportPath && outputArg && SELECTIONS[selectionId],
    'usage: node --import tsx cli-paired-runner.mjs PINNED_PP TOOLING TRANSPORT_SUMMARY_JSON_OR_DASH NEW_OUTPUT_DIRECTORY [SELECTION]');
  const selection = SELECTIONS[selectionId];
  const output = resolve(outputArg); mkdirSync(output);
  const profile = PROFILES[selection.profileId];
  const transportEvidence = transportPath === '-' ? null : JSON.parse(readFileSync(resolve(transportPath), 'utf8'));
  if (transportEvidence) transportEvidence.pass = transportEvidence.evaluation?.pass === true;
  const binary = resolveBinary(profile.provider);
  const version = spawnSync(binary.realPath, ['--version'], { encoding: 'utf8' });
  assert.equal(version.stdout.trim(), profile.version, 'CLI version drift');
  const auth = JSON.parse(spawnSync(binary.realPath, ['auth', 'status', '--json'], { encoding: 'utf8' }).stdout);
  assert(auth.loggedIn && auth.authMethod === 'claude.ai' && auth.apiProvider === 'firstParty', 'subscription first-party authentication required');
  const tokenizerPackage = JSON.parse(readFileSync(resolve(tooling, 'node_modules/js-tiktoken/package.json')));
  assert.equal(tokenizerPackage.version, '1.0.21');
  const { getEncoding } = await import(pathToFileURL(resolve(tooling, 'node_modules/js-tiktoken/dist/index.js')));
  const tokenizer = getEncoding('o200k_base');
  const { manifest, pairs, tasks } = loadPackage();
  const plan = buildTrialPlan(selectTasks(manifest, selection.tasks), { models: [modelConfig(profile)],
    seed: selection.seed, repeats: selection.repeats, maxRepairs: selection.maxRepairs, timeoutMs: selection.timeoutMs });
  // Record the order and controls before any submission.
  writeFileSync(join(output, 'plan.json'), json(plan));
  writeFileSync(join(output, 'preflight.json'), json({ selectionId, selection, stage: 'development', profile, binary, version: version.stdout.trim(),
    authentication: Object.fromEntries(['authMethod', 'apiProvider', 'subscriptionType'].map(k => [k, auth[k]])),
    transportEvidenceSha256: transportPath === '-' ? null : sha(readFileSync(resolve(transportPath))), startedAt: new Date().toISOString(),
    sources: ['cli-paired-runner.mjs', 'cli-attempt.mjs', 'cli-controls.mjs', 'cli-control-audit.mjs',
      'claude-context-policy.mjs', 'claude-transport-faults.mjs', 'cli-trial-plan.mjs', 'development-surfaces.mjs']
      .map(path => ({ path: `brain/benchmarks/r01-candidates/${path}`, sha256: sha(readFileSync(new URL(path, import.meta.url))) })) }));
  const { createAdapter } = await import('./precision.mjs');
  const adapter = await createAdapter(upstream);
  try {
    let sequence = 0;
    const result = runSequence({ plan, pairs, tasks, codec: surfaces(adapter),
      execute(run, attemptIndex, prompt) {
        const directory = join(output, 'attempts', `${String(++sequence).padStart(2, '0')}-${run.cell}-a${attemptIndex}`);
        mkdirSync(join(output, 'attempts'), { recursive: true });
        const { processResult } = runCliAttempt({ profile, binary, prompt, output: directory, timeoutMs: run.timeoutMs,
          meta: { kind: 'paired-development-rehearsal', runId: run.id, cell: run.cell, attemptIndex } });
        console.error(`${run.cell} a${attemptIndex}: exit ${processResult.exitCode} ${Math.round(processResult.elapsedMs)} ms`);
        return { directory };
      },
      audit(directory) {
        const audited = auditAttempt(directory, { tokenizer, transportEvidence });
        writeFileSync(join(directory, 'audit.json'), json(audited));
        const processResult = JSON.parse(readFileSync(join(directory, 'process.json'), 'utf8'));
        return { ...audited, elapsedMs: processResult.elapsedMs };
      } });
    writeFileSync(join(output, 'results.json'), json({ schema: 'r01-paired-rehearsal-results-v2',
      selectionId, stage: 'development', status: result.status, evidence: 'development-only; not scored pilot evidence', counts: result.counts,
      runs: result.runs.map(r => ({ ...r, submissions: r.submissions?.map(s => ({ ...s,
        directory: s.directory.slice(output.length + 1) })) })) }));
    console.log(json({ status: result.status, counts: result.counts }));
    if (result.status !== 'complete') process.exitCode = 1;
  } finally { adapter.dispose(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main(process.argv.slice(2));
