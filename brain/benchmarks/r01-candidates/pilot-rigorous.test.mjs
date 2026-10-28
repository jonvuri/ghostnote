// Rigorous-stage path (R01-D1 to R01-D6), offline. No reserved work beyond
// development works A-C is opened: window selection runs on synthetic decoded
// assets, and the end-to-end package check reuses the development windows
// relabeled as rigorous so the new seeds' tasks can be rehearsed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PROFILES, DEVELOPMENT_PROFILES, profilesFor } from './cli-controls.mjs';
import { PACKAGES, checkExecution, checkRestart, loadPackageDirectory, orderOf, pilotPlan, pilotSelection, resolvePackage } from './cli-pilot-runner.mjs';
import { RIGOROUS_SEEDS, loadWindows, pilotTasks, synthesizeVelocities, targetRuleFailure } from './pilot-tasks.mjs';
import { SELECTION_RIGOROUS, selectDenseWindows, selectRigorousWindows } from './pilot-inputs.mjs';
import { RIGOROUS, buildRigorousPackage } from './pilot-package.mjs';
import { RIGOROUS_FREEZE, buildExecutionManifest, rehearseExecution } from './pilot-execution.mjs';
import { writePackage } from './development-pairs.mjs';
import { createAdapter } from './precision.mjs';
import { surfaces } from './development-surfaces.mjs';
import { canonical } from './common.mjs';

const development = loadWindows();
const strip = notes => notes.map(({ id, pitch, at, duration }) => ({ id, pitch, at, duration }));

test('rigorous Luna runs at medium; development plans keep low; Haiku is unchanged (D64, R01-D1)', () => {
  assert.equal(PROFILES['codex-current'].effort, 'medium');
  assert.equal(DEVELOPMENT_PROFILES['codex-current'].effort, 'low');
  assert.equal(profilesFor('rigorous'), PROFILES);
  assert.equal(profilesFor('development'), DEVELOPMENT_PROFILES);
  for (const profiles of [PROFILES, DEVELOPMENT_PROFILES]) assert.deepEqual(profiles['claude-current'],
    { provider: 'claude', model: 'claude-haiku-5-5', effort: 'low', version: '2.1.302 (Claude Code)' });
  const v5 = resolvePackage('pilot-development-v5').manifest;
  const plan = pilotPlan({ ...v5, stage: 'rigorous' }, pilotSelection({ stage: 'rigorous' }));
  const luna = plan.cohorts.find(c => c.id === 'codex-current');
  assert.equal(luna.profile.effort, 'medium');
  assert(plan.runs.filter(r => r.configSha256 === luna.configSha256).every(r => r.effort === 'medium'));
  // R01-D5: three repeats, 261 initial attempts and at most 783 submissions per cohort.
  for (const cohort of plan.cohorts) assert.equal(plan.runs.filter(r => r.configSha256 === cohort.configSha256).length, 261);
  assert.equal(plan.counts.maximumTaskAttempts, 2 * 783);
  // Probe cohorts stay development-only.
  assert.throws(() => pilotSelection({ cohorts: ['codex-current-medium'], stage: 'rigorous' }), /not an admitted pilot cohort/);
});

test('target rules pass on every development role and name the failing rule otherwise (R01-D3)', () => {
  for (const work of development.works) {
    const notes = synthesizeVelocities(strip(work.notes), work.shardId);
    assert.equal(targetRuleFailure(work.label, notes), null, work.label);
  }
  const sparse = [{ id: 'a', pitch: 60, at: '0', duration: '1', velocity: 80 }, { id: 'b', pitch: 62, at: '5', duration: '1', velocity: 80 }];
  assert.equal(targetRuleFailure('A', sparse), 'p08-shift-transpose-range');
  assert.equal(targetRuleFailure('B', sparse), 'p09-near-miss');
  assert.equal(targetRuleFailure('C', sparse), 'p01-boundary-time');
  assert.throws(() => targetRuleFailure('D', sparse), /unknown role/);
});

test('rigorous seeds change only what they seed, and generation restores the development seeds', () => {
  const before = canonical(pilotTasks());
  const rigorous = pilotTasks(development, { revision: 5, seeds: RIGOROUS_SEEDS });
  assert.equal(canonical(pilotTasks()), before);
  const dev = JSON.parse(before), byId = new Map(rigorous.map(t => [t.id, t]));
  assert.deepEqual(rigorous.map(t => t.id), dev.map(t => t.id));
  for (const task of dev) {
    const other = byId.get(task.id);
    if (task.source.startsWith('reserved:')) {
      // Same windows: identical pitch/onset/duration, new synthetic velocities.
      assert.deepEqual(strip(other.input.notes), strip(task.input.notes), task.id);
      assert.notDeepEqual(other.input.notes.map(n => n.velocity), task.input.notes.map(n => n.velocity), task.id);
    } else assert.notEqual(canonical(other), canonical(task), `${task.id}: synthetic task did not change with the seed`);
  }
});

// Synthetic decoded assets: one note per onset, every half quarter, with a
// selectable dense run so window ranking is predictable.
const PPQ = 4;
function decodedAsset(id, onsets) {
  return { ppq: PPQ, tempoIsImplicit: false, notes: onsets.map((t, i) => ({ id: `${id}-${i}`, pitch: 40 + (i % 30),
    startTick: t, endTick: t + PPQ, velocity: 64, trackIndex: 0, channel: 0 })) };
}
const run = (from, count, step) => Array.from({ length: count }, (_, i) => from + i * step);
function fixture() {
  const sources = {
    w1a: decodedAsset('w1a', run(0, 40, 2)),
    w1b: decodedAsset('w1b', [...run(0, 20, 4), ...run(400, 50, 1)]),
    w2a: decodedAsset('w2a', run(0, 30, 2)),
    w3a: decodedAsset('w3a', run(0, 24, 2)),
    w4a: decodedAsset('w4a', run(0, 26, 2)),
    w5a: decodedAsset('w5a', run(0, 28, 2)),
  };
  const asset = (shardId, assetId) => ({ assetId, shardId, path: `${shardId}/${assetId}.mid`, contentHash: `h-${assetId}`,
    signalId: 's', origin: 'o', model: 'm', runId: 'r', transcription: { resolution: { timing: 'mapped' } },
    midi: { ticksPerQuarter: PPQ, noteCount: 1, endTick: 1, tempoMap: [] } });
  const assets = [asset('dev', 'deva'), asset('w1', 'w1a'), asset('w1', 'w1b'), asset('w2', 'w2a'), asset('w3', 'w3a'),
    asset('w4', 'w4a'), asset('w5', 'w5a')];
  sources.deva = decodedAsset('deva', run(0, 60, 1));
  const order = [['dev', ['deva']], ['w1', ['w1a', 'w1b']], ['w2', ['w2a']], ['w3', ['w3a']], ['w4', ['w4a']], ['w5', ['w5a']]]
    .map(([shardId, assetOrder]) => ({ shardId, title: `title ${shardId}`, assetOrder }));
  const opened = [];
  const io = { readFile: path => { opened.push(path); return path; }, decode: path => sources[path.split('/').at(-1).replace('.mid', '')] };
  return { assets, order, io, opened };
}

test('rigorous selection skips development works and equals the dense rule when every target passes', () => {
  const { assets, order, io, opened } = fixture();
  const rigorous = selectRigorousWindows(assets, order, '/lib', { exclude: new Set(['dev']), admit: () => null, ...io });
  assert(!opened.some(p => p.startsWith('/lib/dev/')), 'a development work was opened');
  assert.deepEqual(rigorous.works.map(w => [w.label, w.shardId]), [['A', 'w1'], ['B', 'w2'], ['C', 'w3']]);
  assert.equal(rigorous.attempts[0].outcome, 'development-work-skipped');
  // w1b's dense run (64 notes in 16 quarters) beats w1a's 32.
  assert.equal(rigorous.works[0].assetId, 'w1b');
  const dense = selectDenseWindows(assets, order.slice(1), '/lib', io.readFile, io.decode);
  assert.deepEqual(rigorous.works, dense.works);
  assert.equal(SELECTION_RIGOROUS.stage, 'rigorous');
});

test('a target-rule failure refuses the window, tries the next candidate, then the next work (R01-D3)', () => {
  const { assets, order, io } = fixture();
  const seen = [];
  // Role A refuses every window from w1b; role B refuses all of w2, so w3 becomes B and w4 becomes C.
  const admit = (role, notes, shardId) => {
    seen.push([role, shardId, notes.length]);
    if (role === 'A' && notes[0].id.startsWith('w1b')) return 'p08-shift-transpose-range';
    if (role === 'B' && shardId === 'w2') return 'p05-edit-target';
    return null;
  };
  const { works, attempts } = selectRigorousWindows(assets, order, '/lib', { exclude: new Set(['dev']), admit, ...io });
  assert.deepEqual(works.map(w => [w.label, w.shardId, w.assetId]), [['A', 'w1', 'w1a'], ['B', 'w3', 'w3a'], ['C', 'w4', 'w4a']]);
  const refused = attempts.filter(a => a.reason === 'no-task-target');
  assert(refused.length > 2 && refused.every(a => a.rule && a.role && Number.isInteger(a.startTick)));
  // Candidates are tried densest first.
  const w1Counts = seen.filter(([role, shard]) => role === 'A' && shard === 'w1').map(([, , n]) => n);
  assert.deepEqual(w1Counts, [...w1Counts].sort((x, y) => y - x));
  assert.deepEqual(attempts.find(a => a.outcome === 'work-exhausted'), { work: 'title w2', shardId: 'w2', outcome: 'work-exhausted',
    role: 'B', collisionsSkipped: 0, reason: 'no admissible window passes the role\'s target rules in any pool asset' });
});

// A rigorous plan over v5's cells, its pinned order, and a halted result.
function rigorousFixture() {
  const v5 = resolvePackage('pilot-development-v5');
  const pkg = { ...v5, name: 'pilot-rigorous-test', manifest: { ...v5.manifest, stage: 'rigorous' }, manifestSha256: 'rigorous-test' };
  const full = pilotPlan(pkg.manifest, pilotSelection({ stage: 'rigorous' }));
  const pinned = { stage: 'rigorous', package: { name: pkg.name, manifestSha256: pkg.manifestSha256 },
    scoring: 'r01-scoring-v2-functional-rationals', feedback: 'r01-feedback-v2-locating',
    cells: pkg.manifest.cells.filter(c => c.eligible).map(c => ({ id: c.id, promptSha256: c.prompt.sha256 })),
    cohorts: full.cohorts.map(c => ({ id: c.id, configSha256: c.configSha256 })),
    order: Object.fromEntries(full.cohorts.map(c => [c.id, orderOf(full, c)])), plan: { planSha256: 'unused' } };
  const haiku = full.cohorts[0].configSha256;
  const halted = { output: '/runs/full', plan: { ...full, package: { name: pkg.name, manifestSha256: pkg.manifestSha256 } },
    results: { status: 'halted-control', runs: full.runs.map((r, i) => ({ id: r.id,
      status: r.configSha256 === haiku ? 'complete' : i === full.runs.findIndex(x => x.configSha256 !== haiku) ? 'halted' : 'not-submitted' })) } };
  return { pkg, full, pinned, halted };
}

test('a halted rigorous pass restarts only its unfinished cohorts, once, in the pinned order (R01-D6)', () => {
  const { pkg, pinned, halted } = rigorousFixture();
  const restart = pilotPlan(pkg.manifest, pilotSelection({ cohorts: ['codex-current'], stage: 'rigorous' }));
  const restartOf = checkRestart(restart, pkg, halted);
  assert.deepEqual([restartOf.output, restartOf.cohorts], ['/runs/full', ['codex-current']]);
  assert(checkExecution(pinned, pkg, { ...restart, selection: { ...restart.selection, restartOf } }));
  // The completed cohort is not rerun.
  const both = pilotPlan(pkg.manifest, pilotSelection({ stage: 'rigorous' }));
  assert.throws(() => checkRestart(both, pkg, halted), /exactly the unfinished cohorts: codex-current/);
  // A restart cannot be restarted.
  const second = { ...halted, plan: { ...halted.plan, selection: { ...restart.selection, restartOf } } };
  assert.throws(() => checkRestart(restart, pkg, second), /cannot be restarted/);
  // Only a halted pass of the same package.
  assert.throws(() => checkRestart(restart, pkg, { ...halted, results: { ...halted.results, status: 'complete' } }), /did not halt/);
  assert.throws(() => checkRestart(restart, { ...pkg, manifestSha256: 'other' }, halted), /another package/);
  // No other rigorous subset.
  assert.throws(() => checkRestart(restart, pkg, null), /full pass or a --restart-of restart/);
  const tasks = pilotPlan(pkg.manifest, pilotSelection({ cohorts: ['codex-current'], tasks: ['p10-refuse-ambiguous-pitch'], stage: 'rigorous' }));
  assert.throws(() => checkRestart(tasks, pkg, halted), /whole cohorts/);
  // A full rigorous pass needs no restart target; development refuses one.
  assert.equal(checkRestart(both, pkg, null), null);
  const dev = pilotPlan(resolvePackage('pilot-development-v5').manifest, pilotSelection());
  assert.throws(() => checkRestart(dev, pkg, halted), /rigorous stage/);
});

test('a rigorous start refuses an order or configuration that differs from the pinned manifest', () => {
  const { pkg, pinned } = rigorousFixture();
  const restart = pilotPlan(pkg.manifest, pilotSelection({ cohorts: ['codex-current'], stage: 'rigorous' }));
  const shuffled = { ...pinned, order: { ...pinned.order, 'codex-current': [...pinned.order['codex-current']].reverse() } };
  assert.throws(() => checkExecution(shuffled, pkg, restart), /order differs/);
  const low = { ...pinned, cohorts: pinned.cohorts.map(c => c.id === 'codex-current' ? { ...c, configSha256: 'low' } : c) };
  assert.throws(() => checkExecution(low, pkg, restart), /configuration differs/);
});

test('the rigorous package is registered and the development package stays usable', () => {
  assert.equal(PACKAGES['pilot-rigorous-v1'].directory, 'context/evidence/data/r01-pilot-inputs/rigorous/package');
  assert.equal(PACKAGES['pilot-development-v5'].retired, undefined);
  assert.equal(RIGOROUS.name, 'pilot-rigorous-v1');
  assert.deepEqual(RIGOROUS.seeds, { synthetic: 'r01-pilot-synthetic-v2', velocity: 'r01-pilot-velocity-v2' });
});

test('end to end on development windows relabeled rigorous: the new seeds rehearse and the manifest pins medium Luna', async () => {
  const tooling = process.env.R01_TOOLING ?? '/tmp/ghostnote-r01-tooling';
  const { getEncoding } = await import(pathToFileURL(resolve(tooling, 'node_modules/js-tiktoken/dist/index.js')).href);
  const adapter = await createAdapter(process.env.R01_UPSTREAM ?? '/tmp/ghostnote-r01-producer-pal');
  const scratch = mkdtempSync(join(tmpdir(), 'r01-rigorous-'));
  try {
    assert.throws(() => buildRigorousPackage(adapter, getEncoding('o200k_base'), { windows: development }), /rigorous windows/);
    const built = buildRigorousPackage(adapter, getEncoding('o200k_base'), { windows: { ...development, stage: 'rigorous' } });
    assert.equal(built.manifest.stage, 'rigorous');
    assert.equal(built.manifest.syntheticSeed, 'r01-pilot-synthetic-v2');
    assert.equal(built.manifest.taskRules.schema, 'r01-pilot-task-rules-v4');
    assert.deepEqual([built.manifest.counts.eligibleCells, built.manifest.counts.exclusions], [87, 33]);
    writePackage(built, join(scratch, 'package'));
    const pkg = { name: 'rigorous-relabeled', directory: join(scratch, 'package'), ...loadPackageDirectory(join(scratch, 'package')) };
    const rehearsal = rehearseExecution(pkg, surfaces(adapter));
    assert.equal(rehearsal.stage, 'rigorous');
    assert.equal(rehearsal.counts.goldenPasses, 87);
    assert.equal(rehearsal.counts.wrongAnswersRejected, rehearsal.counts.wrongAnswersScored);
    assert.equal(rehearsal.counts.gratuitousRefusalsRejected, rehearsal.counts.gratuitousRefusalsScored);
    const manifest = buildExecutionManifest(pkg, rehearsal, { readWindows: () => JSON.stringify(development) });
    assert.equal(manifest.stage, 'rigorous');
    assert.deepEqual(manifest.freeze, RIGOROUS_FREEZE);
    assert.equal(manifest.cohorts.find(c => c.id === 'codex-current').profile.effort, 'medium');
    for (const order of Object.values(manifest.order)) assert.equal(order.length, 261);
    assert(manifest.sources.some(s => s.path.endsWith('pilot-inputs.mjs')));
    assert.throws(() => buildExecutionManifest(pkg, rehearsal, { selection: pilotSelection() }), /stage differs/);
  } finally { adapter.dispose(); rmSync(scratch, { recursive: true, force: true }); }
});
