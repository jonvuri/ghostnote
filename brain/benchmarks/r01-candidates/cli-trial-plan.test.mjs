import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildTrialPlan, createRepairState, recordAttempt } from './cli-trial-plan.mjs';

const manifest = JSON.parse(readFileSync(new URL(
  '../../../context/evidence/data/r01-development-pairs/manifest.json', import.meta.url)));
const models = [
  { provider: 'codex', model: 'gpt-6-luna', effort: 'low' },
  { provider: 'claude', model: 'claude-haiku-4-5-20251001', thinkingBudget: 1024, maxOutputTokens: 12000 },
];
const options = { models, seed: 'r01-development-order-v1', repeats: 2 };
const plan = () => buildTrialPlan(manifest, options);
const taskFail = reason => ({ kind: 'task', pass: false, reason });

test('planning is deterministic, offline, and leaves its inputs unchanged', () => {
  const beforeManifest = structuredClone(manifest), beforeOptions = structuredClone(options);
  const first = plan(), second = plan();
  assert.deepEqual(first, second);
  assert.deepEqual(manifest, beforeManifest);
  assert.deepEqual(options, beforeOptions);
  assert.equal(first.status, 'offline-development-rehearsal');
  assert.equal(first.controls.scoredPilot, false);
  assert.equal(first.controls.inferencePerformed, false);
  assert.equal(first.controls.wrapperAutomaticRetry, false);
  assert.equal(first.controls.wrapperFallback, false);
  assert.equal(first.controls.underlyingCliRetryAndFallback, 'not-verified-by-plan');
  assert.equal(Object.hasOwn(first.controls, 'automaticRetry'), false);
  assert.equal(Object.hasOwn(first.controls, 'fallback'), false);
  assert.equal(first.controls.repairsRequireExplicitSubmission, true);
  assert.equal(first.timeoutMs, 120000);
  assert.equal(first.maxRepairs, 2);
});

test('changing the seed changes paired order without changing coverage or model configurations', () => {
  const first = plan(), other = buildTrialPlan(manifest, { ...options, seed: 'different-development-seed' });
  assert.notDeepEqual(first.runs.map(r => r.id), other.runs.map(r => r.id));
  assert.notDeepEqual(first.blocks.map(b => b.id), other.blocks.map(b => b.id));
  assert.deepEqual(first.runs.map(r => r.id).sort(), other.runs.map(r => r.id).sort());
  assert.deepEqual(first.models, other.models);
  assert.notEqual(first.configurationSha256, other.configurationSha256);
  assert.equal(first.developmentManifestSha256, other.developmentManifestSha256);
  assert(first.blocks.some(block => {
    const paired = other.blocks.find(b => b.id === block.id);
    return JSON.stringify(block.runs) !== JSON.stringify(paired.runs);
  }), 'at least one within-task arm order changes');
});

test('every eligible cell appears once per repetition/configuration with no duplicates or dropped cells', () => {
  const built = plan(), eligible = manifest.cells.filter(c => c.eligible);
  assert.equal(built.runs.length, eligible.length * models.length * options.repeats);
  assert.equal(new Set(built.runs.map(r => r.id)).size, built.runs.length);
  for (const config of built.models) for (let repetition = 0; repetition < options.repeats; repetition++) {
    const selected = built.runs.filter(r => r.configSha256 === config.configSha256 && r.repetition === repetition);
    assert.deepEqual(selected.map(r => r.cell).sort(), eligible.map(c => c.id).sort());
    for (const run of selected) {
      const cell = manifest.cells.find(c => c.id === run.cell);
      assert.equal(run.promptSha256, cell.prompt.sha256);
      assert.equal(run.requestSha256, cell.request.sha256);
      assert.equal(run.sourceFactsSha256, cell.sourceFactsSha256);
      assert.equal(run.role, cell.role);
      assert.equal(run.provider, config.provider);
      assert.equal(run.model, config.model);
      for (const key of ['effort', 'thinkingBudget', 'maxOutputTokens']) {
        assert.equal(Object.hasOwn(run, key), Object.hasOwn(config, key));
        if (Object.hasOwn(config, key)) assert.equal(run[key], config[key]);
      }
    }
  }
  assert.equal(built.counts.initialAttempts, built.runs.length);
  assert.equal(built.counts.maximumTaskAttempts, built.runs.length * 3);
  assert.equal(built.counts.primaryAttempts + built.counts.diagnosticAttempts, built.runs.length);
});

test('task/repetition/provider blocks remain contiguous and diagnostics retain explicit labels', () => {
  const built = plan(); let offset = 0;
  for (const block of built.blocks) {
    const runs = built.runs.slice(offset, offset + block.runs.length);
    assert.deepEqual(runs.map(r => r.id), block.runs);
    assert(runs.every(r => r.task === block.task && r.repetition === block.repetition
      && r.configSha256 === block.configSha256 && r.provider === block.provider && r.blockId === block.id));
    offset += runs.length;
  }
  assert.equal(offset, built.runs.length);
  assert(built.runs.some(r => r.role === 'diagnostic'));
  const providerSequence = built.runs.map(r => r.provider).filter((p, i, all) => i === 0 || p !== all[i - 1]);
  assert.deepEqual(providerSequence, models.map(m => m.provider));
});

test('excluded cells remain explicit for every repetition/configuration and never become attempts', () => {
  const built = plan(), excluded = manifest.cells.filter(c => !c.eligible);
  assert.equal(built.exclusions.length, excluded.length * models.length * options.repeats);
  assert.equal(built.counts.exclusions, built.exclusions.length);
  for (const config of built.models) for (let repetition = 0; repetition < options.repeats; repetition++) {
    const selected = built.exclusions.filter(c => c.configSha256 === config.configSha256 && c.repetition === repetition);
    assert.deepEqual(selected.map(c => c.cell).sort(), excluded.map(c => c.id).sort());
    for (const entry of selected) {
      const original = excluded.find(c => c.id === entry.cell);
      assert.equal(entry.reason, original.reason);
      assert.equal(entry.role, original.role);
      assert(!built.runs.some(r => r.cell === entry.cell));
    }
  }
});

test('manifest and configuration hashes cover changed evidence and runtime controls', () => {
  const first = plan(), changedManifest = structuredClone(manifest);
  changedManifest.reviewNote = 'new evidence';
  assert.notEqual(buildTrialPlan(changedManifest, options).developmentManifestSha256, first.developmentManifestSha256);
  for (const change of [{ maxRepairs: 1 }, { timeoutMs: 60000 },
    { models: [{ ...models[0], effort: 'medium' }] }, { repeats: 3 },
    { models: [{ ...models[1], thinkingBudget: 2048 }] },
    { models: [{ ...models[1], maxOutputTokens: 16000 }] }]) {
    assert.notEqual(buildTrialPlan(manifest, { ...options, ...change }).configurationSha256, first.configurationSha256);
  }
  const reordered = Object.fromEntries(Object.entries(manifest).reverse());
  assert.equal(buildTrialPlan(reordered, options).developmentManifestSha256, first.developmentManifestSha256);
  assert.match(first.developmentManifestSha256, /^[a-f0-9]{64}$/);
  assert.match(first.configurationSha256, /^[a-f0-9]{64}$/);
});

test('same-provider models get separate configurations and a numeric zero seed is valid', () => {
  const built = buildTrialPlan(manifest, { models: [models[0], { ...models[0], model: 'another-pinned-model' }], seed: 0 });
  assert.equal(built.repeats, 1);
  assert.equal(new Set(built.models.map(m => m.configSha256)).size, 2);
  assert.equal(built.runs.length, manifest.cells.filter(c => c.eligible).length * 2);
});

test('optional reasoning settings and output caps are retained exactly without undefined fields', () => {
  const configurations = [models[0], models[1], { provider: 'claude', model: 'explicit-default-profile' },
    { provider: 'claude', model: 'fixed-thinking-without-output-cap', thinkingBudget: 1024 },
    { provider: 'codex', model: 'effort-with-output-cap', effort: 'medium', maxOutputTokens: 8000 },
    { provider: 'claude', model: 'output-cap-only', maxOutputTokens: 5000 }];
  const built = buildTrialPlan(manifest, { models: configurations, seed: 1 });
  assert.deepEqual(JSON.parse(JSON.stringify(built)), built, 'omitted settings do not become undefined properties');
  for (const original of configurations) {
    const config = built.models.find(c => c.model === original.model);
    assert.equal(config.wrapperAutomaticRetry, false);
    assert.equal(config.wrapperFallback, false);
    assert.equal(Object.hasOwn(config, 'automaticRetry'), false);
    assert.equal(Object.hasOwn(config, 'fallback'), false);
    for (const key of ['effort', 'thinkingBudget', 'maxOutputTokens']) {
      assert.equal(Object.hasOwn(config, key), Object.hasOwn(original, key));
      for (const run of built.runs.filter(r => r.configSha256 === config.configSha256)) {
        assert.equal(Object.hasOwn(run, key), Object.hasOwn(original, key));
        if (Object.hasOwn(original, key)) assert.equal(run[key], original[key]);
      }
    }
  }
  const base = buildTrialPlan(manifest, { models: [models[1]], seed: 1 });
  for (const change of [{ thinkingBudget: 2048 }, { maxOutputTokens: 16000 }]) {
    const altered = buildTrialPlan(manifest, { models: [{ ...models[1], ...change }], seed: 1 });
    assert.notEqual(base.models[0].configSha256, altered.models[0].configSha256);
    assert.notEqual(base.configurationSha256, altered.configurationSha256);
  }
});

test('invalid configuration refuses rather than silently expanding limits or enabling fallback', () => {
  const invalid = [null, {}, { ...options, seed: '' }, { ...options, seed: NaN },
    { ...options, repeats: 0 }, { ...options, repeats: 1.5 }, { ...options, repeats: 1000000 },
    { ...options, maxRepairs: -1 }, { ...options, maxRepairs: 3 }, { ...options, maxRepairs: 1.5 },
    { ...options, timeoutMs: 0 }, { ...options, timeoutMs: Infinity }, { ...options, fallback: true },
    { ...options, models: [] }, { ...options, models: [models[0], models[0]] },
    { ...options, models: [{ ...models[0], effort: '' }] },
    { ...options, models: [{ ...models[0], model: '  alias' }] },
    { ...options, models: [{ ...models[0], thinkingBudget: 1024 }] },
    ...[0, -1, 1.5, Infinity, undefined, '1024'].map(thinkingBudget =>
      ({ ...options, models: [{ ...models[1], thinkingBudget }] })),
    ...[0, -1, 1.5, Infinity, undefined, '12000', 1024, 512].map(maxOutputTokens =>
      ({ ...options, models: [{ ...models[1], maxOutputTokens }] })),
    { ...options, models: [{ ...models[0], wrapperAutomaticRetry: true }] },
    { ...options, models: [{ ...models[0], wrapperFallback: true }] },
    { ...options, models: [{ ...models[0], automaticRetry: true }] }];
  for (const config of invalid) assert.throws(() => buildTrialPlan(manifest, config), /R01 CLI trial plan/);
});

test('invalid manifests, duplicate cells, unpinned prompts and unequal paired facts refuse', () => {
  for (const change of [
    m => { m.status = 'heldout-pilot'; },
    m => { m.tasks.push(m.tasks[0]); },
    m => { m.cells.push(m.cells[0]); },
    m => { m.cells.push({ ...m.cells[0], id: 'new-duplicate-arm-id' }); },
    m => { m.cells[0].task = 'unknown-task'; },
    m => { m.cells.find(c => c.eligible).prompt.sha256 = 'unpinned'; },
    m => { m.cells.find(c => !c.eligible).reason = ''; },
    m => { m.cells.find(c => c.eligible).decodedFactsSha256 = '0'.repeat(64); },
    m => { m.cells.find(c => c.eligible).request.sha256 = '0'.repeat(64); },
    m => { m.cells.forEach(c => { c.eligible = false; c.reason = 'excluded'; }); },
  ]) {
    const changed = structuredClone(manifest); change(changed);
    assert.throws(() => buildTrialPlan(changed, options), /R01 CLI trial plan/);
  }
});

test('two explicit corrections are allowed and all failed results remain in order', () => {
  let state = createRepairState();
  assert.equal(state.nextAction, 'initial-submission-allowed');
  const failures = [taskFail('wrong-pitch'), taskFail('unintended-edit'), taskFail('wrong-duration')];
  state = recordAttempt(state, failures[0]);
  assert.equal(state.status, 'awaiting-correction');
  assert.equal(state.repairsUsed, 0);
  assert.equal(state.remainingRepairs, 2);
  assert.equal(state.nextAction, 'explicit-correction-allowed');
  state = recordAttempt(state, failures[1]);
  assert.equal(state.repairsUsed, 1);
  assert.equal(state.remainingRepairs, 1);
  state = recordAttempt(state, failures[2]);
  assert.equal(state.status, 'exhausted');
  assert.equal(state.repairsUsed, 2);
  assert.equal(state.remainingRepairs, 0);
  assert.equal(state.nextAction, 'none');
  assert.deepEqual(state.attempts, failures);
  assert.throws(() => recordAttempt(state, { kind: 'task', pass: true }), /terminal/);
});

test('success on initial or correction completes without discarding earlier failure evidence', () => {
  const initial = createRepairState();
  const result = { kind: 'task', pass: true, expectedRefusal: true, response: 'REFUSE stale-snapshot' };
  const immediate = recordAttempt(initial, result);
  assert.equal(immediate.status, 'complete');
  assert.equal(immediate.repairsUsed, 0);
  assert.deepEqual(initial.attempts, []);
  const failed = recordAttempt(initial, taskFail('wrong-result'));
  const finished = recordAttempt(failed, { kind: 'task', pass: true, response: 'corrected' });
  assert.equal(finished.status, 'complete');
  assert.equal(finished.repairsUsed, 1);
  assert.equal(finished.attempts.length, 2);
  assert.equal(failed.attempts.length, 1);
  assert.throws(() => recordAttempt(finished, taskFail('extra')), /terminal/);
});

test('refusal-task mismatches are task failures; transport/control failures halt without repair', () => {
  const refusal = recordAttempt(createRepairState(), {
    kind: 'task', pass: false, expectedRefusal: true, reason: 'required-refusal-mismatch', response: 'REFUSE wrong-reason',
  });
  assert.equal(refusal.status, 'awaiting-correction');
  for (const kind of ['transport', 'control']) {
    for (const prior of [createRepairState(), refusal]) {
      const failed = recordAttempt(prior, { kind, pass: false, reason: kind === 'transport' ? 'quota-limit' : 'served-model-mismatch' });
      assert.equal(failed.status, `halted-${kind}`);
      assert.equal(failed.nextAction, 'none');
      assert.equal(failed.attempts.length, prior.attempts.length + 1);
      assert.throws(() => recordAttempt(failed, taskFail('retry')), /terminal/);
    }
  }
});

test('zero/one correction budgets exhaust at their declared bounds', () => {
  for (const maxRepairs of [0, 1]) {
    let state = createRepairState({ maxRepairs });
    for (let i = 0; i <= maxRepairs; i++) state = recordAttempt(state, taskFail(`failure-${i}`));
    assert.equal(state.status, 'exhausted');
    assert.equal(state.repairsUsed, maxRepairs);
    assert.equal(state.attempts.length, maxRepairs + 1);
    assert.throws(() => recordAttempt(state, taskFail('excess')), /terminal/);
  }
});

test('attempt evidence is retained by value and invalid state/results refuse', () => {
  const initial = createRepairState(), evidence = { kind: 'task', pass: false, usage: { input: 12 }, raw: ['error'] };
  const recorded = recordAttempt(initial, evidence);
  evidence.usage.input = 99; evidence.raw.push('changed');
  assert.deepEqual(recorded.attempts[0], { kind: 'task', pass: false, usage: { input: 12 }, raw: ['error'] });
  for (const options of [null, { maxRepairs: 3 }, { maxRepairs: -1 }, { retries: 2 }]) {
    assert.throws(() => createRepairState(options), /R01 CLI trial plan/);
  }
  for (const result of [null, { kind: 'other', pass: false }, { kind: 'task', pass: 'false' },
    { kind: 'transport', pass: true }, { kind: 'control', pass: true },
    { kind: 'task', pass: false, tokens: NaN }, { kind: 'task', pass: false, dropped: undefined },
    { kind: 'task', pass: false, date: new Date(0) }, { kind: 'task', pass: false, sparse: Array(2) }]) {
    assert.throws(() => recordAttempt(initial, result), /R01 CLI trial plan/);
  }
  const cyclic = { kind: 'task', pass: false }; cyclic.self = cyclic;
  assert.throws(() => recordAttempt(initial, cyclic), /cyclic/);
  assert.throws(() => recordAttempt({ ...recorded, status: 'ready' }, taskFail('tampered')), /inconsistent/);
  assert.throws(() => recordAttempt({ ...recorded, maxRepairs: 3 }, taskFail('tampered')), /maxRepairs/);
});

test('plans carry a stage label outside the configuration hash; the E358 package is development only', () => {
  const built = plan();
  assert.equal(built.stage, 'development');
  assert.equal(buildTrialPlan(manifest, { ...options, stage: 'development' }).configurationSha256, built.configurationSha256);
  assert.throws(() => buildTrialPlan(manifest, { ...options, stage: 'rigorous' }), /stage differs/);
  assert.throws(() => buildTrialPlan(manifest, { ...options, stage: 'final' }), /development or rigorous/);
  assert.throws(() => buildTrialPlan({ ...manifest, schema: 'r01-pilot-package-v1' }, options), /development or pilot manifest/);
});
