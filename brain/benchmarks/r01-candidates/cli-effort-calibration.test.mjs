import test from 'node:test';
import assert from 'node:assert/strict';
import { CALIBRATION, calibrationCells, calibrationSchedule, generatedTokens, summarize } from './cli-effort-calibration.mjs';
import { loadPackage } from './cli-paired-runner.mjs';

const { manifest } = loadPackage();

test('calibration cells cover every task and family with balanced primary arms', () => {
  const cells = calibrationCells(manifest);
  assert.equal(cells.length, 38);
  assert(cells.every(c => c.eligible && c.role === 'primary'));
  assert.deepEqual(new Set(cells.map(c => c.task)), new Set(manifest.tasks.map(t => t.id)));
  const count = arm => cells.filter(c => c.arm === arm).length;
  // Full-coverage performed tasks contribute each arm four times.
  for (const arm of ['baseline-fields', 'baseline-json']) assert.equal(count(arm), 4);
  for (const arm of ['pp-barbeat', 'pp-midi-json']) assert.equal(count(arm), 5);
  for (const arm of ['c3-fields', 'c4-fields']) assert.equal(count(arm), 10);
});

test('schedule is deterministic, matched across configurations and independent of list order', () => {
  const cells = calibrationCells(manifest);
  const a = calibrationSchedule(cells, ['codex-low', 'claude-low']);
  const b = calibrationSchedule(cells, ['claude-low', 'codex-low']);
  assert.deepEqual(a, b);
  assert.equal(a.length, 76);
  for (let i = 0; i < a.length; i += 2) assert.equal(a[i].cell, a[i + 1].cell);
  assert.notDeepEqual(a.map(r => r.cell), cells.flatMap(c => [c.id, c.id]), 'cells are shuffled');
});

test('configurations differ only in effort within a provider', () => {
  const { 'claude-low': low, 'claude-medium': medium, 'codex-low': codex } = CALIBRATION.configurations;
  assert.deepEqual({ ...low, effort: 'medium' }, medium);
  assert.equal(codex.effort, 'low'); assert.equal(low.model, 'claude-haiku-5-5');
  assert(Object.values(CALIBRATION.configurations).every(p => p.maxOutputTokens === undefined && p.thinkingBudget === undefined));
});

test('generated tokens use output (which includes reasoning) without double counting', () => {
  assert.deepEqual(generatedTokens('claude', { output_tokens: 1854, output_tokens_details: { thinking_tokens: 1674 } }), { generated: 1854, reasoning: 1674 });
  assert.deepEqual(generatedTokens('codex', { output_tokens: 300, reasoning_output_tokens: 200 }), { generated: 300, reasoning: 200 });
  assert.deepEqual(generatedTokens('codex', null), { generated: null, reasoning: null });
});

test('summary excludes unadmitted submissions and reports matched ratios to the reference', () => {
  const row = (configuration, cell, generated, extra = {}) => ({ configuration, cell, repetition: 0, family: 'f',
    controlPass: true, generated, reasoning: 0, totalInputTokens: 10, elapsedMs: 1, outcome: 'pass', ...extra });
  const s = summarize([row('codex-low', 'a', 100), row('codex-low', 'b', 200), row('claude-low', 'a', 50),
    row('claude-low', 'b', 400, { outcome: 'fail' }), row('claude-low', 'c', 999, { controlPass: false, outcome: 'control' })]);
  assert.equal(s['codex-low'].generated.median, 150);
  assert.equal(s['claude-low'].admitted, 2);
  assert.equal(s['claude-low'].generated.median, 225);
  assert.equal(s['claude-low'].medianRatioToReference, 1.5);
  assert.deepEqual([s['claude-low'].pairedRatioToReference.min, s['claude-low'].pairedRatioToReference.max], [0.5, 2]);
  assert.equal(s['claude-low'].passes, 1);
});
