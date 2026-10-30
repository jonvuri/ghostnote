// R01 round 2 (R01-D8 to R01-D13), offline: windows, ladders, oracles,
// timeouts, selection, retained package and execution manifest, and measures.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { add, cmp, canonical } from './common.mjs';
import { clipLength } from './development-surfaces.mjs';
import { buildTrialPlan } from './cli-trial-plan.mjs';
import { PACKAGES, ROUND2, checkExecution, loadExecution, pilotPlan, resolvePackage, round2Selection, selectionFor } from './cli-pilot-runner.mjs';
import { DELETE_WINDOW, INSTANCES, LADDERS, WINDOW_SIZES, loadRound2Windows, plantNearMisses, rangeEditTarget, round2Tasks, taskId } from './round2-tasks.mjs';
import { ROUND2_WINDOW_RULES, noteWindow, selectRound2Windows, windowStarts } from './round2-inputs.mjs';
import { TIMEOUT_RULE, timeoutMs } from './round2-package.mjs';
import { breakingPoint, logisticFit, mcnemar, round2Measures } from './round2-analysis.mjs';

const windows = loadRound2Windows(), tasks = round2Tasks(windows);
const pkg = resolvePackage('round2-development-v1'), pinned = loadExecution('round2-development-v1');
const data = fileURLToPath(new URL('../../../context/evidence/data/r01-round2/', import.meta.url));

/** C4 block traversal: timed groups' members, then notes homed in timing-free groups, then loose notes. */
function traversal(fixture) {
  const timed = (fixture.groups ?? []).filter(g => g.spread), free = (fixture.groups ?? []).filter(g => !g.spread), seen = new Set(), order = [];
  const visit = id => { if (!seen.has(id)) { seen.add(id); order.push(id); } };
  for (const g of timed) for (const id of g.members) visit(id);
  for (const g of free) for (const id of g.members) visit(id);
  for (const x of fixture.notes) visit(x.id);
  return order;
}

test('window starts never split a chord, and windows hold exactly N notes at relative onsets', () => {
  const decoded = { ppq: 4, notes: [0, 0, 4, 8, 8, 8, 12, 16].map((startTick, i) => ({ id: `n${i}`, pitch: 60 + i, startTick, endTick: startTick + 2 })) };
  // Index 0 holds the whole first chord; 2-5 would end inside the chord at tick 8.
  assert.deepEqual(windowStarts(decoded, 2), [0, 6]);
  assert.deepEqual(windowStarts(decoded, 3), [0, 3]);
  const w = noteWindow(decoded, 3, 3);
  assert.deepEqual(w.notes.map(x => x.at), ['0', '0', '0']);
  assert.equal(w.endTickExclusive, 12);
  const one = { ppq: 4, notes: [{ id: 'a', pitch: 60, startTick: 0, endTick: 3 }, { id: 'b', pitch: 60, startTick: 0, endTick: 2 }] };
  assert.deepEqual(noteWindow(one, 0, 2).collisions, ['60@0']);
});

test('selection cycles works, avoids repeating windows and records overlap', () => {
  const asset = (id, count) => ({ asset: { assetId: id, path: `x/${id}.mid`, contentHash: id, transcription: { resolution: { timing: 'baked' } } },
    decoded: { ppq: 4, notes: Array.from({ length: count }, (_, i) => ({ id: `${id}${i}`, pitch: 40 + (i % 40), startTick: 4 * i, endTick: 4 * i + 2 })) } });
  const works = [{ shardId: 'w1', title: 'one', position: 4, assets: [asset('a', 12)] }, { shardId: 'w2', title: 'two', position: 5, assets: [asset('b', 6)] }];
  const { windows: picked } = selectRound2Windows(works, { sizes: [4, 8], instances: 3, admit: () => null });
  assert.deepEqual(picked.filter(w => w.size === 4).map(w => [w.work, w.startIndex]), [['one', 0], ['two', 0], ['one', 4]]);
  // Only work one holds eight notes; later instances minimize their largest overlap and never repeat.
  assert.deepEqual(picked.filter(w => w.size === 8).map(w => w.startIndex), [0, 4, 2]);
  assert(picked.every(w => w.largestOverlapWithAnEarlierInstance < w.size));
  const refused = selectRound2Windows(works, { sizes: [4], instances: 1, admit: (size, notes) => notes[0].id === 'a0' ? 'range-edit' : null });
  assert.equal(refused.windows[0].startIndex, 1);
});

test('retained windows: works 4-6 only, every size and instance, exact counts', () => {
  assert.equal(windows.schema, 'r01-round2-windows-v1');
  assert.deepEqual(windows.rules, JSON.parse(JSON.stringify(ROUND2_WINDOW_RULES)));
  assert.deepEqual(windows.works.map(w => w.position), [4, 5, 6]);
  const rigorous = JSON.parse(readFileSync(new URL('../../../context/evidence/data/r01-pilot-inputs/rigorous/windows.json', import.meta.url), 'utf8'));
  assert.deepEqual(windows.works.map(w => w.shardId).sort(), rigorous.works.map(w => w.shardId).sort());
  for (const size of WINDOW_SIZES) for (let k = 1; k <= INSTANCES; k++) {
    const w = windows.windows.find(x => x.size === size && x.instance === k);
    assert(w && w.notes.length === size && w.sourceNotes.length === size, `${size}/${k}`);
    assert.equal(new Set(w.notes.map(x => `${x.pitch}@${x.at}`)).size, size, 'no normalization collision');
  }
  // One asset holds 512 notes; its instances overlap but never repeat.
  const big = windows.windows.filter(w => w.size === 512);
  assert.equal(new Set(big.map(w => w.assetId)).size, 1);
  assert.equal(new Set(big.map(w => w.startIndex)).size, INSTANCES);
});

test('every family level varies only its axis, and expected states are independently consistent', () => {
  assert.equal(tasks.length, Object.values(LADDERS).reduce((s, l) => s + l.levels.length, 0) * INSTANCES);
  const at = (family, level, k = 1) => tasks.find(t => t.id === taskId(family, level, k));
  for (const level of LADDERS['derived-read'].levels) {
    const t = at('derived-read', level), timed = t.input.groups.filter(g => g.spread);
    assert.equal(timed.length, level);
    // Recompute performed onsets from the group equation, independently of the generator.
    const onset = new Map(t.input.notes.map(x => [x.id, x.at]));
    for (const g of timed) for (const id of g.members) assert.equal(cmp(onset.get(id), add(add(g.anchor, g.delay), g.spread[id])), 0);
    const [, from, to] = t.request.match(/at least (\S+) and less than (\S+),/);
    const ids = t.input.notes.filter(x => cmp(x.at, from) >= 0 && cmp(x.at, to) < 0)
      .sort((a, b) => cmp(a.at, b.at) || (a.id < b.id ? -1 : 1)).map(x => x.id);
    assert.deepEqual(t.answer.ids, ids);
    assert(ids.includes('bt') && ids.includes('fa'), 'tie and untimed boundary cases inside the window');
  }
  for (const level of LADDERS['group-retime'].levels) {
    const t = at('group-retime', level);
    assert.equal(t.ladder.ops.length, level);
    for (const g of t.expected.groups.filter(g => g.spread)) for (const id of g.members)
      assert.equal(cmp(t.expected.notes.find(x => x.id === id).at, add(add(g.anchor, g.delay), g.spread[id])), 0);
  }
  for (const level of LADDERS.regroup.levels) {
    const t = at('regroup', level);
    assert.equal(t.expected.groups.length - t.input.groups.length, level);
    assert.equal(canonical(t.expected.notes), canonical(t.input.notes), 'onsets unchanged');
    for (const g of t.expected.groups) for (const id of g.members)
      assert.equal(cmp(t.input.notes.find(x => x.id === id).at, add(add(g.anchor, g.delay), g.spread[id])), 0);
  }
  for (const level of LADDERS['member-move'].levels) {
    const t = at('member-move', level);
    assert.equal(t.ladder.moves.length, level);
    for (const m of t.ladder.moves) {
      const to = t.expected.groups.find(g => g.id === m.to);
      assert(to.members.includes(m.note) && !t.expected.groups.find(g => g.id === m.from).members.includes(m.note));
      assert.equal(cmp(t.expected.notes.find(x => x.id === m.note).at, add(add(to.anchor, to.delay), m.spread)), 0);
    }
  }
  for (const t of tasks.filter(t => t.cohort === 'source' && t.input.groups)) {
    assert.deepEqual(t.input.notes.map(x => x.id), traversal(t.input), `${t.id}: input order`);
    if (t.expected) assert.deepEqual(t.expected.notes.map(x => x.id), traversal(t.expected), `${t.id}: expected order`);
  }
  for (const level of LADDERS['range-edit'].levels) for (let k = 1; k <= INSTANCES; k++) {
    const t = at('range-edit', level, k), moved = t.expected.notes.filter((x, i) => x.at !== t.input.notes[i].at);
    assert.equal(t.input.notes.length, level);
    assert(moved.length >= Math.ceil(level / 16) && moved.length <= Math.floor(level / 8), `${t.id}: ${moved.length}`);
    assert.equal(clipLength(t.input), clipLength(t.expected));
  }
  for (const level of LADDERS['selective-delete'].levels) {
    const t = at('selective-delete', level), { from, to, pitch } = t.ladder;
    const inRange = t.input.notes.filter(x => x.pitch === pitch && cmp(x.at, from) >= 0 && cmp(x.at, to) < 0);
    assert.deepEqual(inRange.map(x => x.id), [t.ladder.target]);
    assert.equal(t.ladder.nearMissIds.length, level);
    assert.equal(t.input.notes.length, DELETE_WINDOW + 1 + level);
    assert(t.input.notes.some(x => x.pitch === pitch && cmp(x.at, to) === 0), 'a near miss sits at the upper bound');
  }
  for (const family of ['preserve-performed', 'preserve-exact']) for (const level of LADDERS[family].levels)
    assert.equal(at(family, level).input.notes.length, level);
  assert(at('preserve-exact', 512).input.notes.some(x => x.annotation) && at('preserve-exact', 512).input.notes.some(x => x.chance));
  // Diagnostics run at one level per source family.
  for (const [family, ladder] of Object.entries(LADDERS)) {
    const diagnosed = new Set(tasks.filter(t => t.ladder.family === family && t.diagnostics).map(t => t.ladder.level));
    assert.deepEqual([...diagnosed], ladder.cohort === 'source' ? [ladder.levels[ladder.diagnosticLevel]] : []);
  }
});

test('target rules refuse windows without a case', () => {
  const flat = Array.from({ length: 64 }, (_, i) => ({ id: `n${i}`, pitch: 126, at: String(i), duration: '1/2', velocity: 64 }));
  assert.throws(() => rangeEditTarget(flat), /no eligible range-edit range/);
  const dense = Array.from({ length: 128 }, (_, i) => ({ id: `n${i}`, pitch: 60 + (i % 2), at: spell16(i), duration: '1/2', velocity: 64 }));
  assert.throws(() => plantNearMisses(dense, 1, ['t']), /no eligible near-miss pitch/);
});
const spell16 = i => `${i}/16`;

test('R01-D12: one timeout per family level, at least two minutes, scaled with the largest golden', () => {
  assert.equal(timeoutMs(0), 120000);
  assert.equal(timeoutMs(16518), Math.ceil((120000 + 60 * 16518) / 10000) * 10000);
  const t = pkg.manifest.timeouts;
  assert.equal(t.schema, TIMEOUT_RULE.schema);
  for (const task of pkg.tasks) assert.equal(t.byTask[task.id], t.byLevel[task.ladder.family][task.ladder.level].timeoutMs);
  const plan = pilotPlan(pkg.manifest, round2Selection({ instances: [1], repeats: 1 }));
  for (const run of plan.runs) assert.equal(run.timeoutMs, t.byTask[run.task]);
  assert(plan.runs.every(r => r.timeoutMs >= 120000));
  // Without timeouts, the planner keeps the single limit (round-1 plans are unchanged).
  const v5 = resolvePackage('pilot-development-v5').manifest;
  assert.throws(() => buildTrialPlan(v5, { models: [{ provider: 'claude', model: 'm', effort: 'low' }], seed: 's', timeouts: { 'p01-read-sounding-at': 1 } }), /no timeout/);
});

test('round-2 selection: four cohorts, calibration subset and refusal of unknown cohorts', () => {
  const full = round2Selection();
  assert.deepEqual(full.cohorts, ['claude-current', 'codex-current-medium', 'claude-historical-uncapped', 'codex-terra']);
  assert.deepEqual([full.pass, full.subset, full.repeats], ['development', false, 3]);
  const calibration = round2Selection({ instances: [1], repeats: 1 });
  assert.deepEqual([calibration.pass, calibration.subset], ['calibration', true]);
  assert.deepEqual(selectionFor(JSON.parse(JSON.stringify(calibration))), calibration);
  assert.throws(() => round2Selection({ cohorts: ['codex-current'] }), /not a round-2 cohort/);
  assert.equal(round2Selection({ cohorts: [...ROUND2.cohorts, 'codex-terra-6-1'] }).cohorts.at(-1), 'codex-terra-6-1');
  const plan = pilotPlan(pkg.manifest, calibration);
  const profiles = Object.fromEntries(plan.cohorts.map(c => [c.id, c.profile]));
  assert.equal(profiles['codex-current-medium'].effort, 'medium');
  assert.equal(profiles['codex-terra'].model, 'gpt-5.6-terra');
  assert.equal(profiles['claude-historical-uncapped'].maxOutputTokens, undefined);
  for (const cohort of plan.cohorts) assert.equal(plan.runs.filter(r => r.configSha256 === cohort.configSha256).length, 112);
  assert(plan.runs.every(r => r.task.endsWith('-i1')));
});

test('retained package regenerates from task code; the execution manifest pins the full pass and admits the calibration subset', () => {
  assert.equal(PACKAGES['round2-development-v1'].retired, undefined);
  assert.equal(pkg.manifest.round, 2);
  assert.equal(pkg.manifest.counts.eligibleCells, 448);
  assert.equal(pinned.round, 2);
  assert.equal(pinned.package.manifestSha256, pkg.manifestSha256);
  assert.equal(pinned.selection.subset, false);
  for (const order of Object.values(pinned.order)) assert.equal(order.length, 1344);
  assert.equal(pinned.rehearsal.counts.wrongAnswersRejected, pinned.rehearsal.counts.wrongAnswersScored);
  assert.equal(pinned.rehearsal.counts.notDistinguishing, 0);
  assert(checkExecution(pinned, pkg, pilotPlan(pkg.manifest, round2Selection())));
  assert(checkExecution(pinned, pkg, pilotPlan(pkg.manifest, round2Selection({ instances: [1], repeats: 1 }))));
  const rehearsal = JSON.parse(readFileSync(data + 'execution/rehearsal.json', 'utf8'));
  assert.equal(rehearsal.counts.goldenPasses, 448);
});

test('measures: logistic breaking point, separated ladders, McNemar and per-level aggregation', () => {
  const runs = [];
  for (const [level, passes] of [[1, 4], [2, 3], [4, 1], [8, 0]]) for (let k = 1; k <= 4; k++) runs.push({ level, instance: k, pass: k <= passes });
  const bp = breakingPoint(runs, { levels: [1, 2, 4, 8], resamples: 200 });
  assert.equal(bp.firstLevelBelowHalf, 4);
  assert(bp.fitted > 2 && bp.fitted < 4, String(bp.fitted));
  assert(bp.interval && bp.interval.usable > 0);
  assert.equal(breakingPoint(runs.map(r => ({ ...r, pass: true })), { levels: [1, 2, 4, 8] }).fitted, 'above 8');
  assert.equal(breakingPoint(runs.map(r => ({ ...r, pass: false })), { levels: [1, 2, 4, 8] }).fitted, 'below 1');
  assert(logisticFit([{ x: 0, y: 1 }, { x: 1, y: 0 }]).slope < 0);
  assert.deepEqual(mcnemar([[true, false], [true, false], [false, false]]), { pairs: 3, onlyFirst: 2, onlySecond: 0, p: 0.5 });
  assert(Math.abs(mcnemar(Array(6).fill([true, false])).p - 0.03125) < 1e-12);
  const row = (arm, level, instance, pass, reason = null) => ({ cohort: 'c', arm, family: 'derived-read', level, instance, repetition: 0,
    firstAttemptPass: pass, withinBudgetPass: pass, firstReason: pass ? null : reason, failedReasons: pass ? [] : [reason],
    generatedToFirstCorrect: pass ? 100 : null, elapsedToFirstCorrectMs: pass ? 1000 : null, firstGenerated: 100, firstReasoning: 50,
    firstOutputLocalTokens: 20, collateralRemoved: null, wrongAdded: null, stalls: 0 });
  const measured = round2Measures([row('c3-fields', 1, 1, true), row('c4-fields', 1, 1, false, 'parse-or-validation-error'),
    row('c3-fields', 2, 1, false, 'answer-mismatch'), row('c4-fields', 2, 1, false, 'answer-mismatch')], { ladders: LADDERS });
  const c4 = measured.cells.find(c => c.arm === 'c4-fields' && c.level === 1);
  assert.deepEqual([c4.errorVisibility.validatorCaught, c4.errorVisibility.validatorShare, c4.passCubed], [1, 1, null]);
  assert.deepEqual(measured.pairedC3C4.find(p => p.level === 1), { cohort: 'c', family: 'derived-read', level: 1, first: 'c3-fields', second: 'c4-fields', pairs: 1, onlyFirst: 1, onlySecond: 0, p: 1 });
});

test('round-2 effort probe: Luna high runs only in subsets and is audited against its own effort', async () => {
  const { PROFILES } = await import('./cli-controls.mjs');
  assert.deepEqual(PROFILES['codex-current-high'], { provider: 'codex', model: 'gpt-6-luna', effort: 'high', version: 'codex-cli 0.163.0' });
  assert.throws(() => round2Selection({ cohorts: ['codex-current-high'] }), /only in subsets/);
  const probe = round2Selection({ cohorts: ['codex-current-high'], tasks: ['r2-read-L1-i1'], repeats: 1 });
  assert.deepEqual([probe.pass, probe.subset], ['probe', true]);
  const plan = pilotPlan(pkg.manifest, probe);
  assert(plan.runs.every(r => r.effort === 'high' && r.model === 'gpt-6-luna'));
  assert(checkExecution(pinned, pkg, plan));
});

test('R01-D14: package v2 is the harder shared ladder for Haiku 5.5 low and Luna high; v1 is unchanged', async () => {
  const { LADDERS_V2 } = await import('./round2-tasks.mjs');
  const v2 = resolvePackage('round2-development-v2'), pinned2 = loadExecution('round2-development-v2');
  assert.equal(v2.manifest.selectionVersion, 2);
  assert.deepEqual(Object.fromEntries(Object.entries(v2.manifest.ladders).map(([f, l]) => [f, l.levels])),
    Object.fromEntries(Object.entries(LADDERS_V2).map(([f, l]) => [f, l.levels])));
  const full = round2Selection({ version: 2 });
  assert.deepEqual([full.cohorts, full.seed, full.pass, full.subset], [['claude-current', 'codex-current-high'], 'r01-round2-order-v2', 'development', false]);
  assert.throws(() => round2Selection({ version: 2, cohorts: ['codex-current-medium'] }), /not a round-2 cohort/);
  const plan = pilotPlan(v2.manifest, full);
  assert.equal(plan.cohorts.find(c => c.id === 'codex-current-high').profile.effort, 'high');
  for (const order of Object.values(pinned2.order)) assert.equal(order.length, 1080);
  assert(checkExecution(pinned2, v2, plan));
  const calibration = pilotPlan(v2.manifest, round2Selection({ version: 2, instances: [1], repeats: 1 }));
  assert(checkExecution(pinned2, v2, calibration));
  for (const c of calibration.cohorts) assert.equal(calibration.runs.filter(r => r.configSha256 === c.configSha256).length, 90);
  // Scaled-up generators keep IDs unique and near misses distinct and exact.
  for (const t of v2.tasks) assert.equal(new Set(t.input.notes.map(x => x.id)).size, t.input.notes.length, t.id);
  for (const t of v2.tasks.filter(t => t.ladder.family === 'selective-delete')) {
    const misses = t.input.notes.filter(x => t.ladder.nearMissIds.includes(x.id));
    assert.equal(misses.length, t.ladder.level);
    assert.equal(new Set(misses.map(x => x.at)).size, misses.length);
  }
  // v1's selection, package and pin are untouched.
  assert.deepEqual(round2Selection().cohorts, ROUND2.cohorts);
  assert(checkExecution(pinned, pkg, pilotPlan(pkg.manifest, round2Selection())));
});

test('R01-D18: v3 is one package per cohort with fresh instances, per-family repeats and a pinned full pass', async () => {
  const { LADDERS_V3, V3_SOURCE_INSTANCES, V3_RANGE_INSTANCES, ROUND2_WINDOWS_V3_PATH } = await import('./round2-tasks.mjs');
  const { ROUND2_WINDOW_RULES_V3 } = await import('./round2-inputs.mjs');
  const v2 = resolvePackage('round2-development-v2');
  const earlierIds = new Set([...pkg.tasks, ...v2.tasks].map(t => t.id));
  const earlierInputs = new Set([...pkg.tasks, ...v2.tasks].map(t => canonical(t.input)));
  // Windows v3: v1's 128-note instances 1-4 unchanged, then four fresh windows.
  const w3 = loadRound2Windows(ROUND2_WINDOWS_V3_PATH);
  assert.deepEqual(w3.rules, ROUND2_WINDOW_RULES_V3);
  for (let k = 1; k <= 4; k++) assert.deepEqual(w3.windows.find(w => w.instance === k), windows.windows.find(w => w.size === 128 && w.instance === k));
  assert.deepEqual(w3.windows.map(w => [w.size, w.instance]), Array.from({ length: 8 }, (_, i) => [128, i + 1]));
  assert(w3.windows.filter(w => w.instance > 4).every(w => w.largestOverlapWithAnEarlierInstance <= 16));
  const expected = { 'round2-development-v3-haiku': ['claude-current', 240, 240], 'round2-development-v3-luna': ['codex-current-high', 288, 336] };
  for (const [name, [cohort, eligible, runs]] of Object.entries(expected)) {
    const v3 = resolvePackage(name), pin = loadExecution(name), m = v3.manifest;
    assert.deepEqual([m.cohort, m.selectionVersion, m.packageVersion, m.counts.eligibleCells, m.counts.diagnosticCells], [cohort, 3, name, eligible, 0]);
    assert.deepEqual(Object.fromEntries(Object.entries(m.ladders).map(([f, l]) => [f, l.levels])),
      Object.fromEntries(Object.entries(LADDERS_V3[cohort]).map(([f, l]) => [f, l.levels])));
    // Fresh instances only: no v3 task repeats an ID or an input of packages v1 and v2.
    for (const t of v3.tasks) {
      assert(!earlierIds.has(t.id) && !earlierInputs.has(canonical(t.input)), t.id);
      assert.deepEqual(t.ladder.instance >= 5, true);
      assert((t.ladder.family === 'range-edit' ? V3_RANGE_INSTANCES : V3_SOURCE_INSTANCES).includes(t.ladder.instance), t.id);
      assert.equal(m.repeats.byTask[t.id], t.ladder.family === 'range-edit' ? 3 : 1);
      assert.equal(new Set(t.input.notes.map(x => x.id)).size, t.input.notes.length, t.id);
    }
    // The full pass is the package's cohort with per-task repeats; it is not a subset.
    const full = round2Selection({ version: 3, packageCohort: cohort });
    assert.deepEqual([full.cohorts, full.seed, full.repeats, full.pass, full.subset], [[cohort], 'r01-round2-order-v3', 1, 'development', false]);
    assert.deepEqual(selectionFor(JSON.parse(JSON.stringify(full))), full);
    const plan = pilotPlan(m, full);
    assert.equal(plan.runs.length, runs);
    for (const t of v3.tasks) {
      const reps = new Set(plan.runs.filter(r => r.task === t.id).map(r => r.repetition));
      assert.deepEqual([...reps].sort(), t.ladder.family === 'range-edit' ? [0, 1, 2] : [0], t.id);
    }
    assert.equal(pin.selection.subset, false);
    assert.equal(pin.order[cohort].length, runs);
    assert.deepEqual(pin.controls.contextPolicies[cohort], cohort === 'codex-current-high' ? 'r01-codex-context-policy-v5' : 'r01-claude-context-policy-v2');
    assert.equal(pin.rehearsal.counts.wrongAnswersRejected, pin.rehearsal.counts.wrongAnswersScored);
    assert.equal(pin.rehearsal.counts.notDistinguishing, 0);
    assert(checkExecution(pin, v3, plan));
    // A uniform repeat count is a subset and drops the per-task repeats.
    const once = pilotPlan(m, round2Selection({ version: 3, packageCohort: cohort, repeats: 1, tasks: [v3.tasks[0].id] }));
    assert(once.runs.every(r => r.repetition === 0));
  }
  assert.throws(() => round2Selection({ version: 3 }), /package cohort/);
  assert.throws(() => round2Selection({ version: 3, packageCohort: 'claude-current', cohorts: ['codex-current-high'] }), /not a round-2 cohort/);
  assert.throws(() => round2Selection({ version: 2, packageCohort: 'claude-current' }), /only v3/);
  // The planner's per-task repeats are optional and checked.
  const v5 = resolvePackage('pilot-development-v5').manifest, model = [{ provider: 'claude', model: 'm', effort: 'low' }];
  assert.throws(() => buildTrialPlan(v5, { models: model, seed: 's', repeatsByTask: { 'p01-read-sounding-at': 2 } }), /no repeat count/);
  assert.throws(() => buildTrialPlan(v5, { models: model, seed: 's', repeatsByTask: { x: 0 } }), /invalid repeatsByTask/);
  const plain = buildTrialPlan(v5, { models: model, seed: 's', repeats: 2 });
  const same = buildTrialPlan(v5, { models: model, seed: 's', repeats: 2, repeatsByTask: Object.fromEntries(v5.tasks.map(t => [t.id, 2])) });
  assert.deepEqual(plain.runs.map(r => r.id), same.runs.map(r => r.id));
});
