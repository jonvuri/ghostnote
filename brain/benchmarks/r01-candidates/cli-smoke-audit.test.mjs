import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { auditTranscript } from './cli-smoke-audit.mjs';
const transcript = provider => readFileSync(new URL(
  `../../../context/evidence/data/r01-cli-smoke-${provider}/stdout.jsonl`, import.meta.url),
  'utf8').trim().split('\n').map(JSON.parse);

test('Codex startup notice is not tool execution; cached input is not double counted', () => {
  const report = auditTranscript('codex', transcript('codex'));
  assert.equal(report.transportClean, true);
  assert.equal(report.toolEventCount, 0);
  assert.equal(report.notices.length, 1);
  assert.equal(report.totalInputTokens, 8724);
  assert.equal(report.reportedModelAvailable, false);
});
test('Claude final totals include both caches and supersede interim output count', () => {
  const report = auditTranscript('claude', transcript('claude'));
  assert.equal(report.transportClean, true);
  assert.equal(report.totalInputTokens, 3044);
  assert.equal(report.finalOutputTokens, 78);
  assert.equal(report.reportedModelAvailable, true);
  assert.equal(report.overageUsed, false);
  assert.equal(report.initializedPlugins.length, 3);
});
test('tool activity, unknown items, errors, and missing completion prevent admission', () => {
  const base = transcript('codex');
  for (const type of ['command_execution', 'mcp_tool_call', 'file_change', 'future_tool']) {
    assert.equal(auditTranscript('codex', [...base,
      { type: 'item.completed', item: { type } }]).transportClean, false);
  }
  assert.equal(auditTranscript('claude', [...transcript('claude'),
    { type: 'assistant', message: { content: [{ type: 'tool_use' }] } }]).transportClean, false);
  assert.equal(auditTranscript('codex', [...base,
    { type: 'item.completed', item: { type: 'error', message: 'Unexpected failure' } }])
    .transportClean, false);
  assert.equal(auditTranscript('codex', base.filter(e => e.type !== 'turn.completed'))
    .transportClean, false);
});
