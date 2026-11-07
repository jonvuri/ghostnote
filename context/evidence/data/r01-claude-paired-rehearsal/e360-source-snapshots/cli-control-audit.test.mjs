import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, cpSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { auditControl, auditProbe, loadClaudeCapture } from './cli-control-audit.mjs';
import { PROFILES } from './cli-controls.mjs';

const base = () => ({ provider: 'codex', profile: PROFILES['codex-current'],
  processResult: { exitCode: 0, signal: null, error: null },
  events: [{ type: 'turn.completed', usage: { input_tokens: 100, cached_input_tokens: 70, output_tokens: 10 } }],
  requests: [{ model: 'gpt-6-luna', reasoning: { effort: 'low' }, input: [{ role: 'user', content: 'task' }] }],
  responses: [{ model: 'gpt-6-luna' }] });
const issue = (value, name) => assert(auditControl(value).issues.includes(name), name);

test('requested or initialization model names cannot establish served identity', () => {
  const value = base(); value.responses = [];
  value.events.unshift({ type: 'system', subtype: 'init', model: 'gpt-6-luna' });
  assert.equal(auditControl(value).modelVerified, false);
});
test('mismatched response model and any reroute fail identity control', () => {
  const value = base(); value.responses[0].model = 'different';
  assert.equal(auditControl(value).modelVerified, false);
  value.responses[0].model = value.profile.model; value.reroutes = [{ fromModel: 'x', toModel: value.profile.model }];
  assert.equal(auditControl(value).modelVerified, false);
});
test('one logical Codex inference does not prove absence of HTTP retries', () => {
  const result = auditControl(base());
  assert.equal(result.modelVerified, true); assert.equal(result.oneLogicalInference, true);
  assert.deepEqual(result.issues, ['transport-retry-control-unverified']);
  assert.equal(result.controlPass, false);
});
test('multiple or failed logical requests are not eligible', () => {
  for (const change of [{ requests: [] }, { inferenceStarts: 2 }, { inferenceFailures: 1 }])
    issue({ ...base(), ...change }, 'missing-or-multiple-inference-requests');
});
test('effective reasoning and temperature are audited from captured requests', () => {
  const value = base(); value.requests[0].reasoning.effort = 'high';
  issue(value, 'effective-generation-settings-unverified-or-mismatched');
  value.requests[0].reasoning.effort = 'low'; value.requests[0].temperature = 0;
  issue(value, 'effective-generation-settings-unverified-or-mismatched');
});
test('advertised tools and injected AGENTS/skills fail isolation even without tool calls', () => {
  const value = base(); value.requests[0].tools = [{ type: 'function', name: 'read_file' }];
  value.requests[0].input[0].internal_chat_message_metadata_passthrough = { content_item_kinds: ['agents_md.instructions', 'host_skills.instructions'] };
  const result = auditControl(value);
  assert.equal(result.toolEventCount, 0);
  assert(result.issues.includes('advertised-tools-present'));
  assert(result.issues.includes('unexpected-client-instructions'));
});
test('token counters reject missing, negative, fractional and impossible cache totals', () => {
  for (const patch of [{ output_tokens: undefined }, { input_tokens: -1 }, { input_tokens: 1.5 }, { cached_input_tokens: 101 }]) {
    const value = base(); Object.assign(value.events[0].usage, patch); issue(value, 'invalid-token-accounting');
  }
  assert.equal(auditControl(base()).totalInputTokens, 100);
});
test('process failure cannot be hidden by a completion event', () => {
  for (const processResult of [{ exitCode: 1 }, { exitCode: 0, signal: 'SIGKILL' }, { exitCode: 0, error: 'timeout' }])
    issue({ ...base(), processResult }, 'transport-or-client-failure');
});
test('full serialized context has independent hashes/counts, not an inferred overhead subtraction', () => {
  const value = base(); value.tokenizer = { encode: text => [...text] };
  const first = auditControl(value).requests[0]; value.requests[0].input[0].content += ' extra';
  const second = auditControl(value).requests[0];
  assert.notEqual(first.contextSha256, second.contextSha256);
  assert(second.localSerializedContextTokens > first.localSerializedContextTokens);
});
test('Claude fixed budget and additive cache accounting remain unverified without live capture validation', () => {
  const value = { ...base(), provider: 'claude', profile: PROFILES['claude-historical'],
    requests: [{ model: PROFILES['claude-historical'].model, thinking: { type: 'enabled', budget_tokens: 1024 }, max_tokens: 12000 }],
    responses: [], events: [{ type: 'assistant', message: { model: PROFILES['claude-historical'].model, content: [] } },
      { type: 'result', usage: { input_tokens: 5, cache_read_input_tokens: 20, cache_creation_input_tokens: 30, output_tokens: 10 } }] };
  const result = auditControl(value);
  assert.equal(result.totalInputTokens, 55); assert.equal(result.settingsMatch, true);
  assert.equal(result.modelVerified, true); assert.equal(result.controlPass, false);
  issue(value, 'claude-request-capture-validation-pending');
  value.requests[0].thinking.budget_tokens = 2048;
  issue(value, 'effective-generation-settings-unverified-or-mismatched');
});
test('overage and usage-model mismatches remain visible', () => {
  const value = base(); value.events.push({ type: 'rate_limit_event', rate_limit_info: { isUsingOverage: true } });
  value.events.push({ type: 'rate_limit_event', rate_limit_info: { isUsingOverage: false } });
  value.events[0].modelUsage = { other: {} };
  issue(value, 'usage-model-mismatch');
  assert.equal(auditControl(value).overageUsed, true);
  assert(!auditControl(value).issues.includes('subscription-overage'));
});
test('unknown overage events remain unknown unless an overage was observed', () => {
  const value = base(); value.events.push({ type: 'rate_limit_event', rate_limit_info: { isUsingOverage: false } });
  assert.equal(auditControl(value).overageUsed, false);
  value.events.push({ type: 'rate_limit_event', rate_limit_info: {} });
  assert.equal(auditControl(value).overageUsed, null);
});
test('additional_tools namespaces are audited alongside top-level tool declarations', () => {
  const value = base(); value.requests[0].tools = [{ type: 'function', function: { name: 'top' } }];
  value.requests[0].input.push({ type: 'additional_tools', tools: [{ type: 'namespace', name: 'functions', tools: [{ type: 'custom', name: 'exec' }] }] });
  const result = auditControl(value);
  assert.deepEqual(result.requests[0].tools, ['top', 'functions.exec']);
  assert(result.issues.includes('advertised-tools-present'));
});
test('retained correct Codex edit still fails experimental controls', () => {
  const directory = fileURLToPath(new URL('../../../context/evidence/data/r01-cli-controls/codex-current/', import.meta.url));
  const result = auditProbe(directory);
  assert.equal(result.probeAnswerMatches, true); assert.equal(result.controlPass, false);
  assert.equal(result.totalInputTokens, 5263); assert.equal(result.finalOutputTokens, 55);
  assert(result.requests[0].tools.includes('functions.exec'));
  assert(result.requests[0].tools.includes('collaboration.spawn_agent')); assert.equal(result.requestCount, 1);
  for (const name of ['served-model-unverified-or-mismatched', 'advertised-tools-present', 'unexpected-client-instructions', 'transport-retry-control-unverified']) assert(result.issues.includes(name));
});
test('retained unavailable historical model is a transport outcome, not a musical failure', () => {
  const directory = fileURLToPath(new URL('../../../context/evidence/data/r01-cli-controls/codex-historical/', import.meta.url));
  const result = auditProbe(directory);
  assert.equal(result.probeAnswerMatches, false); assert.equal(result.controlPass, false);
  assert.equal(result.totalInputTokens, null); assert.equal(result.inferenceFailures, 1);
  assert.equal(result.requests[0].model, 'gpt-5.4-mini-2026-03-17');
  assert(result.issues.includes('transport-or-client-failure'));
});

const claudeFixture = fileURLToPath(new URL('../../../context/evidence/data/r01-cli-claude-controls/claude-historical/', import.meta.url));
test('retained Claude probe verifies exact served model, fixed thinking, cap, final usage and answer', () => {
  const result = auditProbe(claudeFixture);
  assert.equal(result.probeAnswerMatches, true); assert.equal(result.modelVerified, true);
  assert.equal(result.settingsMatch, true); assert.equal(result.claudeCaptureValidated, true);
  assert.equal(result.requestCount, 1); assert.equal(result.responseCount, 1);
  assert.equal(result.totalInputTokens, 612); assert.equal(result.finalOutputTokens, 221);
  assert.equal(result.rawFinalUsage.output_tokens_details.thinking_tokens, 162);
  assert.deepEqual(result.requests[0].tools, []);
  assert.equal(result.requests[0].maxOutputTokens, 12000);
  assert.equal(result.requests[0].reminderBlockCount, 5);
  assert.equal(result.requests[0].systemBlockCount, 3);
  assert.equal(result.controlPass, false);
  assert.deepEqual(result.issues, ['claude-client-context-policy-pending', 'transport-retry-control-unverified']);
});
function alteredCapture(t, alter) {
  const directory = mkdtempSync(join(tmpdir(), 'r01-capture-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  cpSync(claudeFixture, directory, { recursive: true });
  const indexPath = join(directory, 'api-bodies/index.jsonl');
  const entry = JSON.parse(readFileSync(indexPath, 'utf8').trim());
  alter({ directory, indexPath, entry }); return directory;
}
test('orphan Claude requests cannot disappear from request counts', t => {
  const directory = alteredCapture(t, ({ directory, entry }) => {
    cpSync(join(directory, 'api-bodies', entry.request_file), join(directory, 'api-bodies/orphan.request.json'));
  });
  const result = loadClaudeCapture(directory);
  assert.equal(result.requests.length, 2); assert.equal(result.claudeCaptureValidated, false);
  assert(result.captureIssues.includes('unindexed-claude-capture-file'));
});
test('duplicate and escaping index references fail capture validation', t => {
  const directory = alteredCapture(t, ({ indexPath, entry }) => {
    writeFileSync(indexPath, [entry, entry, { ...entry, request_file: '../escape.request.json' }].map(JSON.stringify).join('\n') + '\n');
  });
  const result = loadClaudeCapture(directory);
  assert.equal(result.claudeCaptureValidated, false);
  assert(result.captureIssues.includes('invalid-or-duplicate-claude-capture-reference'));
});
test('captured response identity and final usage are checked independently', t => {
  const directory = alteredCapture(t, ({ directory, entry }) => {
    const path = join(directory, 'api-bodies', entry.response_file);
    const response = JSON.parse(readFileSync(path, 'utf8'));
    response.model = 'other'; response.usage.output_tokens = 6;
    writeFileSync(path, JSON.stringify(response));
  });
  const result = auditProbe(directory);
  assert.equal(result.modelVerified, false);
  assert(result.issues.includes('claude-capture-index-mismatch'));
  assert(result.issues.includes('claude-final-usage-mismatch'));
});
