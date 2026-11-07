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
 * Structured feedback, identical in form for every arm: the scorer's reason
 * code plus the native parser's message for unparseable output. Expected
 * values, note differences and golden responses are never disclosed.
 */
export function feedback(score) {
  return { reason: score.reason ?? 'unspecified-failure',
    ...(score.reason === 'parse-or-validation-error' && score.error ? { validationError: String(score.error).slice(0, 400) } : {}) };
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
function classify(audit) {
  if (audit.controlPass) return null;
  const limited = audit.apiErrorStatus === 429
    || (audit.rateLimitStatuses ?? []).some(status => status !== 'allowed' && status !== 'allowed_warning')
    || /usage limit|rate limit/i.test(audit.answer ?? '');
  if (audit.issues.includes('transport-or-client-failure')) return limited ? 'quota' : 'transport';
  return 'control';
}

/**
 * Execute a plan through injected `execute(run, attemptIndex, prompt)` and
 * `audit(directory)` functions. A transport/control failure stops the whole
 * sequence; quota evidence pauses it. Nothing is retried implicitly.
 */
export function runSequence({ plan, pairs, tasks, codec, execute, audit }) {
  const pairById = new Map(pairs.map(p => [p.id, p])), taskById = new Map(tasks.map(t => [t.id, t]));
  const runs = [];
  let status = 'complete';
  for (const run of plan.runs) {
    if (status !== 'complete') { runs.push({ id: run.id, cell: run.cell, status: 'not-submitted' }); continue; }
    const pair = pairById.get(run.cell), task = taskById.get(run.task);
    assert(pair && task, `missing pair or task for ${run.cell}`);
    assert.equal(sha(pair.prompt), run.promptSha256, `${run.cell}: delivered prompt differs from plan`);
    let state = createRepairState({ maxRepairs: run.maxRepairs });
    const history = [], submissions = [];
    while (state.nextAction !== 'none') {
      const prompt = history.length ? correctionPrompt(pair.prompt, history, run.maxRepairs) : pair.prompt;
      const attemptIndex = state.attempts.length;
      const { directory } = execute(run, attemptIndex, prompt);
      const audited = audit(directory);
      const failure = classify(audited);
      const submission = { attemptIndex, directory, promptSha256: sha(prompt), promptBytes: Buffer.byteLength(prompt),
        role: attemptIndex ? 'correction' : 'initial', controlPass: audited.controlPass, controlIssues: audited.issues,
        usage: audited.rawFinalUsage, totalInputTokens: audited.totalInputTokens, finalOutputTokens: audited.finalOutputTokens,
        contextClientBytes: audited.claudeContext?.clientAddedTextBytes ?? null,
        localSerializedContextTokens: audited.requests?.[0]?.localSerializedContextTokens ?? null,
        elapsedMs: audited.elapsedMs ?? null };
      if (failure) {
        state = recordAttempt(state, { kind: failure === 'quota' ? 'transport' : failure, pass: false, quota: failure === 'quota' });
        submissions.push({ ...submission, outcome: failure });
        status = failure === 'quota' ? 'paused-quota' : `halted-${failure}`;
        break;
      }
      const score = scoreResponse(task, run.arm, audited.answer, codec);
      state = recordAttempt(state, { kind: 'task', pass: score.pass, reason: score.reason ?? null });
      submissions.push({ ...submission, outcome: score.pass ? 'pass' : 'fail', score, answerSha256: sha(audited.answer ?? '') });
      if (state.status === 'awaiting-correction') history.push({ answer: audited.answer, feedback: feedback(score) });
    }
    runs.push({ id: run.id, cell: run.cell, task: run.task, arm: run.arm, role: run.role, status: state.status,
      firstAttemptPass: submissions[0]?.outcome === 'pass', withinBudgetPass: state.status === 'complete',
      repairsUsed: state.repairsUsed, submissions });
  }
  const scored = runs.filter(r => r.submissions);
  const sum = key => scored.flatMap(r => r.submissions).reduce((n, s) => n + (s[key] ?? 0), 0);
  return { status, runs, counts: { plannedRuns: plan.runs.length, submittedRuns: scored.length,
    submissions: scored.reduce((n, r) => n + r.submissions.length, 0),
    firstAttemptPasses: scored.filter(r => r.firstAttemptPass).length,
    withinBudgetPasses: scored.filter(r => r.withinBudgetPass).length,
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

async function main([upstream, tooling, transportPath, outputArg]) {
  assert(upstream && tooling && transportPath && outputArg,
    'usage: node --import tsx cli-paired-runner.mjs PINNED_PP TOOLING TRANSPORT_SUMMARY_JSON NEW_OUTPUT_DIRECTORY');
  const output = resolve(outputArg); mkdirSync(output);
  const profile = PROFILES[REHEARSAL.profileId];
  const transportEvidence = JSON.parse(readFileSync(resolve(transportPath), 'utf8'));
  assert(transportEvidence.evaluation?.pass, 'transport fault suite has not passed');
  transportEvidence.pass = transportEvidence.evaluation.pass;
  const binary = resolveBinary(profile.provider);
  assert.equal(binary.sha256, transportEvidence.binary.sha256, 'CLI binary differs from the fault-tested binary');
  const version = spawnSync(binary.realPath, ['--version'], { encoding: 'utf8' });
  assert.equal(version.stdout.trim(), profile.version, 'CLI version drift');
  const auth = JSON.parse(spawnSync(binary.realPath, ['auth', 'status', '--json'], { encoding: 'utf8' }).stdout);
  assert(auth.loggedIn && auth.authMethod === 'claude.ai' && auth.apiProvider === 'firstParty', 'subscription first-party authentication required');
  const tokenizerPackage = JSON.parse(readFileSync(resolve(tooling, 'node_modules/js-tiktoken/package.json')));
  assert.equal(tokenizerPackage.version, '1.0.21');
  const { getEncoding } = await import(pathToFileURL(resolve(tooling, 'node_modules/js-tiktoken/dist/index.js')));
  const tokenizer = getEncoding('o200k_base');
  const { manifest, pairs, tasks } = loadPackage();
  const plan = buildTrialPlan(selectTasks(manifest, REHEARSAL.tasks), { models: [modelConfig(profile)],
    seed: REHEARSAL.seed, repeats: REHEARSAL.repeats, maxRepairs: REHEARSAL.maxRepairs, timeoutMs: REHEARSAL.timeoutMs });
  // Record the order and controls before any submission.
  writeFileSync(join(output, 'plan.json'), json(plan));
  writeFileSync(join(output, 'preflight.json'), json({ selection: REHEARSAL, profile, binary, version: version.stdout.trim(),
    authentication: Object.fromEntries(['authMethod', 'apiProvider', 'subscriptionType'].map(k => [k, auth[k]])),
    transportEvidenceSha256: sha(readFileSync(resolve(transportPath))), startedAt: new Date().toISOString(),
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
    writeFileSync(join(output, 'results.json'), json({ schema: 'r01-paired-rehearsal-results-v1',
      status: result.status, evidence: 'development-only; not scored pilot evidence', counts: result.counts,
      runs: result.runs.map(r => ({ ...r, submissions: r.submissions?.map(s => ({ ...s,
        directory: s.directory.slice(output.length + 1) })) })) }));
    console.log(json({ status: result.status, counts: result.counts }));
    if (result.status !== 'complete') process.exitCode = 1;
  } finally { adapter.dispose(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main(process.argv.slice(2));
