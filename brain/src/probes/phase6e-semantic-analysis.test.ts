import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';

test('Phase 6e exact analysis keeps its typed invariants', () => {
  const output = execFileSync('python3', [
    'src/probes/phase6e-semantic-analysis.py',
    '--work-dir', '.tmp/phase6e-self-test',
    '--self-test',
  ], { cwd: process.cwd(), encoding: 'utf8' });
  const result = JSON.parse(output) as { readonly passed: number };
  assert.equal(result.passed, 6);
});

test('Phase 6e provider survey keeps its controlled cohorts', () => {
  const output = execFileSync('python3', [
    'src/probes/phase6e-provider-survey.py',
    '--self-test',
  ], { cwd: process.cwd(), encoding: 'utf8' });
  const result = JSON.parse(output) as { readonly passed: number };
  assert.equal(result.passed, 5);
});
