import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createAdapter } from './precision.mjs';
import { scoreResponse, surfaces } from './development-surfaces.mjs';
import { feedback } from './cli-paired-runner.mjs';
import { checkExecution, loadExecution, pilotPlan, pilotSelection, resolvePackage } from './cli-pilot-runner.mjs';
import { buildExecutionManifest, rehearseExecution, wrongAnswers } from './pilot-execution.mjs';

const adapter = await createAdapter(process.env.R01_UPSTREAM ?? '/tmp/ghostnote-r01-producer-pal');
test.after(() => adapter.dispose());
const codec = surfaces(adapter);
const pkg = resolvePackage('pilot-development-v5');
const pinned = loadExecution('pilot-development-v5');
const executionFile = (version, name) => readFileSync(fileURLToPath(new URL(`../../../context/evidence/data/r01-pilot-inputs/v${version}/execution/${name}`, import.meta.url)), 'utf8');
const json = value => JSON.stringify(value, null, 2) + '\n';
const rehearsal = rehearseExecution(pkg, codec);

test('the retained execution manifest and rehearsal regenerate byte for byte', () => {
  assert.equal(json(rehearsal), executionFile(5, 'rehearsal.json'));
  // E376 changed two harness sources (probe profile, Codex policy v3) after pinning;
  // everything the runner checks at start still regenerates exactly.
  const { sources, ...rebuilt } = buildExecutionManifest(pkg, rehearsal);
  const { sources: retainedSources, ...retained } = JSON.parse(executionFile(5, 'manifest.json'));
  assert.deepEqual(rebuilt, retained);
  assert.deepEqual(sources.map(s => s.path), retainedSources.map(s => s.path));
  const drifted = sources.filter((s, i) => s.sha256 !== retainedSources[i].sha256).map(s => s.path.split('/').at(-1));
  assert(drifted.every(p => ['cli-controls.mjs', 'cli-pilot-runner.mjs'].includes(p)), drifted.join());
  assert.equal(pinned.stage, 'development');
  assert.equal(pinned.selection.seed, 'r01-pilot-order-v1');
  assert.equal(pinned.selection.subset, false);
  assert.equal(pinned.package.manifestSha256, pkg.manifestSha256);
  for (const cohort of Object.values(pinned.order)) assert.equal(cohort.length, 261);
  const eligible = pinned.cells.filter(c => c.eligible);
  assert.equal(eligible.length, 87);
  for (const cell of eligible) for (const key of ['payloadSha256', 'promptSha256', 'oracleSha256', 'cardSha256'])
    assert.match(cell[key], /^[0-9a-f]{64}$/, `${cell.id}: ${key}`);
});

for (const version of [3, 4]) test(`retired v${version} still rehearses and pins the same plan; only later source hashes differ`, () => {
  const old = resolvePackage(`pilot-development-v${version}`), oldRehearsal = rehearseExecution(old, codec);
  assert.equal(json(oldRehearsal), executionFile(version, 'rehearsal.json'));
  const { sources, ...rebuilt } = buildExecutionManifest(old, oldRehearsal);
  const { sources: retainedSources, ...retained } = JSON.parse(executionFile(version, 'manifest.json'));
  assert.deepEqual(rebuilt, retained);
  assert.deepEqual(sources.map(s => s.path), retainedSources.map(s => s.path));
});

test('every golden passes and every task-specific wrong answer and gratuitous refusal fails', () => {
  const { counts } = rehearsal;
  assert.equal(counts.goldenPasses, 87);
  assert.equal(counts.wrongAnswersRejected, counts.wrongAnswersScored);
  assert.equal(counts.gratuitousRefusalsRejected, 81);
  assert(rehearsal.cells.every(c => c.wrongAnswers.length >= 4 && c.wrongAnswers.every(w => !w.pass && w.reason)));
  // Rejections are semantic mismatches, not parser failures on well-formed wrong answers.
  assert(rehearsal.cells.every(c => c.wrongAnswers.every(w => w.reason !== 'parse-or-validation-error')));
  // D59: the oracle respelled with unreduced rationals passes wherever it is scored.
  assert.equal(counts.equivalentSpellingsAccepted, counts.equivalentSpellingsScored);
  assert(counts.equivalentSpellingsDelivered > 0);
  // Feedback for a wrong answer names locations, never the oracle's values.
  const p02 = pkg.tasks.find(t => t.id.startsWith('p02'));
  const score = scoreResponse(p02, 'c4-fields', JSON.stringify({ ...p02.answer, at: '57/8' }), codec);
  assert.deepEqual(feedback(score), { reason: 'answer-mismatch', differingPaths: ['$.at: differs'] });
  // Inexpressible states are listed per arm rather than counted as rejections.
  assert.deepEqual(rehearsal.unencodable.map(u => u.cell), ['p11-preserve-window--baseline-fields', 'p11-preserve-window--baseline-json']);
});

test('wrong answers are task-specific and correct-by-accident variants are dropped', () => {
  const named = id => rehearsal.variants[pkg.tasks.find(t => t.id.startsWith(id)).id];
  assert(named('p01').includes('includes-note-ending-at-t'));
  assert(named('p01').includes('excludes-note-starting-at-t'));
  assert(named('p05').includes('untouched-target'));
  assert(named('p06').includes('last-match-missed'));
  assert(named('p07').includes('halves-floored-to-grid'));
  // D61 places both p08 bounds on note onsets, so either bound error is distinguishable.
  assert(named('p08').includes('inclusive-upper-bound') && named('p08').includes('exclusive-lower-bound'));
  assert(named('p09').includes('refused-as-ambiguous') && named('p09').includes('boundary-note-deleted-instead'));
  assert(named('p10').includes('wrong-refusal-code'));
  assert(named('p12').includes('onset-rounded-to-1-512'));
  // D63 group-timing tasks: every planned misreading is present and distinguishing.
  for (const [id, names] of Object.entries({
    p13: ['omits-common-delay', 'spread-only', 'inclusive-upper-bound', 'skips-loose-notes', 'skips-timing-free-members', 'id-order', 'ties-in-note-order'],
    p14: ['onsets-moved-delay-dropped', 'spreads-measured-from-anchor', 'group-without-timing', 'performance-order-missing', 'one-note-left-loose'],
    p15: ['onset-kept-spread-derived', 'still-member-of-source-group', 'inserted-at-front-of-target', 'removed-from-timing-free-group', 'onset-omits-target-delay'],
    p16: ['only-first-group-changed', 'only-second-group-changed', 'second-group-spreads-halved', 'loose-note-moved', 'first-group-delay-moved-too', 'timing-free-group-dropped'],
  })) for (const name of names) assert(named(id).includes(name), `${id}: ${name}`);
  // Every sounding note at T starts at T or is the one held note, so counting onsets at T is not always distinct.
  assert(rehearsal.notDistinguishing.every(d => d.task.startsWith('p01')));
  for (const d of rehearsal.notDistinguishing) assert(!rehearsal.variants[d.task].includes(d.variant));
  assert.throws(() => wrongAnswers({ id: 'p99-unknown' }), /no task-specific wrong answers/);
});

test('a start must match the pinned package, prompts and materialized order', () => {
  const plan = pilotPlan(pkg.manifest, pilotSelection());
  assert(checkExecution(pinned, pkg, plan));
  // A subset keeps its own seeded order but must use pinned prompts.
  assert(checkExecution(pinned, pkg, pilotPlan(pkg.manifest, pilotSelection({ tasks: ['p05-edit-velocity-large'], repeats: 1 }))));
  assert.throws(() => checkExecution(loadExecution('pilot-development-v3'), pkg, plan), /names another package/);
  assert.throws(() => checkExecution(pinned, { ...pkg, manifestSha256: '0'.repeat(64) }, plan), /package differs/);
  const reseeded = pilotPlan(pkg.manifest, { ...pilotSelection(), seed: 'other-seed' });
  assert.throws(() => checkExecution(pinned, pkg, reseeded), /plan differs/);
  const tampered = { ...pinned, cells: pinned.cells.map(c => c.id === plan.runs[0].cell ? { ...c, promptSha256: '0'.repeat(64) } : c) };
  assert.throws(() => checkExecution(tampered, pkg, plan), /prompt differs/);
  const reordered = { ...pinned, order: { ...pinned.order, 'claude-current': [...pinned.order['claude-current']].reverse() } };
  assert.throws(() => checkExecution(reordered, pkg, plan), /order differs/);
  assert.throws(() => checkExecution({ ...pinned, stage: 'rigorous' }, pkg, plan), /stage differs/);
  assert.throws(() => checkExecution({ ...pinned, scoring: 'r01-scoring-v1' }, pkg, plan), /scoring version differs/);
  assert.throws(() => checkExecution({ ...pinned, feedback: 'r01-feedback-v1' }, pkg, plan), /feedback version differs/);
});
