// R01 pilot response analysis (offline). Classifies every scored submission of
// a pilot run against its package: unchanged input, missed intended edits,
// collateral edits, note-count changes, differing paths, refusal shape and
// repeated correction answers. Scores use the current scorer, so a run scored
// under an older version can be compared on the same basis.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonical, equivalence, noteKey } from './common.mjs';
import { scoreResponse, surfaces, functionalForm, differencePaths } from './development-surfaces.mjs';
import { resolvePackage } from './cli-pilot-runner.mjs';

const readJson = path => JSON.parse(readFileSync(path, 'utf8'));
const count = list => list.reduce((s, x) => s + x.count, 0);

/** Multiset notes removed from `from` and added in `to`, under performed comparison. */
function delta(from, to) {
  const d = equivalence(from, to);
  return { removed: d.missing, added: d.extra };
}

export function classifySubmission(task, arm, answer, codec) {
  const score = scoreResponse(task, arm, answer, codec);
  const result = { pass: score.pass, reason: score.reason ?? null };
  const trimmed = typeof answer === 'string' ? answer.trim() : '';
  if (task.response === 'refusal') {
    result.shape = trimmed.startsWith('REFUSE ') ? 'refusal' : trimmed.startsWith('{') ? 'json' : 'surface';
    if (result.shape === 'refusal') result.code = trimmed.slice(7);
    return result;
  }
  if (trimmed.startsWith('REFUSE ')) return { ...result, shape: 'refusal', code: trimmed.slice(7) };
  if (task.response === 'answer') {
    try { result.paths = differencePaths(functionalForm(JSON.parse(trimmed)), functionalForm(task.answer)); }
    catch { result.shape = 'unparseable-json'; }
    return result;
  }
  let fixture;
  try { fixture = codec.decode(arm, answer).fixture; } catch (error) {
    return { ...result, shape: 'unparseable', error: error.message.split('\n')[0].slice(0, 160) };
  }
  result.shape = 'surface';
  if (task.cohort === 'source') {
    result.unchangedInput = canonical(functionalForm(fixture)) === canonical(functionalForm(task.input))
      && canonical(task.input) !== canonical(task.expected);
    if (!score.pass) result.paths = differencePaths(functionalForm(fixture), functionalForm(task.expected)).slice(0, 12);
    return result;
  }
  const input = task.input.notes, expected = task.expected.notes, notes = fixture.notes;
  const intended = delta(input, expected), actual = delta(input, notes);
  const keys = list => new Map(list.map(x => [noteKey(x.note), x.count]));
  const intendedRemoved = keys(intended.removed), actualRemoved = keys(actual.removed);
  const intendedAdded = keys(intended.added), actualAdded = keys(actual.added);
  const missed = [...intendedRemoved].reduce((s, [k, c]) => s + Math.max(0, c - (actualRemoved.get(k) ?? 0)), 0)
    + [...intendedAdded].reduce((s, [k, c]) => s + Math.max(0, c - (actualAdded.get(k) ?? 0)), 0);
  const collateral = [...actualRemoved].reduce((s, [k, c]) => s + Math.max(0, c - (intendedRemoved.get(k) ?? 0)), 0);
  const wrongAdded = [...actualAdded].reduce((s, [k, c]) => s + Math.max(0, c - (intendedAdded.get(k) ?? 0)), 0);
  Object.assign(result, {
    noteCount: notes.length, expectedNoteCount: expected.length, inputNoteCount: input.length,
    unchangedInput: !count(actual.removed) && !count(actual.added) && (count(intended.removed) + count(intended.added) > 0),
    intendedChanges: count(intended.removed) + count(intended.added), missedIntended: missed,
    collateralRemoved: collateral, wrongAdded,
  });
  return result;
}

/** Classify every submission of a run directory against its package. */
export function analyzeRun(directory, codec) {
  const plan = readJson(join(directory, 'plan.json')), results = readJson(join(directory, 'results.json'));
  const pkg = resolvePackage(plan.package.name);
  assert.equal(pkg.manifestSha256, plan.package.manifestSha256, 'package changed since the run');
  const tasks = new Map(pkg.tasks.map(t => [t.id, t]));
  const cohorts = new Map(plan.cohorts.map(c => [c.configSha256, c.id]));
  return results.runs.flatMap(run => (run.submissions ?? []).map((s, i) => ({
    cohort: cohorts.get(run.configSha256), task: run.task, arm: run.arm, role: run.role, attempt: s.attemptIndex,
    recordedOutcome: s.outcome, outputTokens: s.finalOutputTokens, elapsedMs: Math.round(s.elapsedMs),
    repeatsPrevious: i > 0 && s.answer === run.submissions[i - 1].answer,
    ...(s.answer === undefined || s.answer === null ? { pass: false, shape: 'no-answer' } : classifySubmission(tasks.get(run.task), run.arm, s.answer, codec)),
  })));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [upstream, ...directories] = process.argv.slice(2);
  assert(upstream && directories.length, 'usage: node --import tsx pilot-analysis.mjs PINNED_PP RUN_DIRECTORY...');
  const { createAdapter } = await import('./precision.mjs');
  const adapter = await createAdapter(upstream);
  try {
    const codec = surfaces(adapter);
    const rows = directories.flatMap(d => analyzeRun(resolve(d), codec).map(r => ({ run: d, ...r })));
    process.stdout.write(JSON.stringify(rows, null, 1) + '\n');
  } finally { adapter.dispose(); }
}
