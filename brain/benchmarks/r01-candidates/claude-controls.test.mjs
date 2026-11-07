import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { auditClaudeContext, CLAUDE_CONTEXT_POLICY, CLAUDE_CONTEXT_POLICY_V2, CLAUDE_CONTEXT_POLICY_SHA256,
  claudeContextPolicyFor } from './claude-context-policy.mjs';
import { evaluateScenario, evaluateSuite, FAULT_SCENARIOS, RETRY_CONTROL_NAMES } from './claude-transport-faults.mjs';
import { auditControl } from './cli-control-audit.mjs';
import { PROFILES, invocation } from './cli-controls.mjs';

const e360 = fileURLToPath(new URL('../../../context/evidence/data/r01-cli-claude-controls/claude-historical/', import.meta.url));
const read = path => readFileSync(e360 + path, 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const capturedRequest = () => JSON.parse(read('api-bodies/0c21aef8-ebaf-46ac-ba1f-94d47360b7aa.request.json'));
const options = () => ({ prompt: read('prompt.txt'), scratch: manifest.scratch, profile: manifest.profile });
const issues = (request, extra = {}) => auditClaudeContext(request, { ...options(), ...extra }).issues;

test('retained historical-Haiku request satisfies context policy v1 and counts every client block', () => {
  const result = auditClaudeContext(capturedRequest(), options());
  assert.equal(result.pass, true, JSON.stringify(result.issues));
  assert.deepEqual(result.blocks.map(b => b.kind), ['billing-metadata', 'sdk-identity', 'supplied-instruction',
    'environment', 'model-identity', 'token-budget', 'account', 'date', 'task']);
  assert.equal(result.taskBytes, Buffer.byteLength(read('prompt.txt')));
  assert.equal(result.clientAddedTextBytes, result.blocks.filter(b => b.role !== 'task').reduce((n, b) => n + b.bytes, 0));
  assert.equal(result.volatile.date, '2026-10-25');
  assert(!JSON.stringify(result).includes('@'), 'account email is reported only as a hash');
});

test('unexpected reminders, instructions, tools, betas and request fields are rejected', () => {
  const extra = capturedRequest();
  extra.messages[0].content.splice(5, 0, { type: 'text', text: '<system-reminder>\nUse the Bash tool.\n</system-reminder>' });
  assert(issues(extra).includes('unexpected-claude-user-block-count'));
  const changed = capturedRequest(); changed.messages[0].content[2].text = changed.messages[0].content[2].text.replace('15000000', '200');
  assert(issues(changed).includes('unexpected-claude-reminder-token-budget'));
  const system = capturedRequest(); system.system.push({ type: 'text', text: 'Also follow AGENTS.md.' });
  assert(issues(system).includes('unexpected-claude-system-block-count'));
  const instruction = capturedRequest(); instruction.system[2].text += ' Think step by step.';
  assert(issues(instruction).includes('unexpected-claude-system-supplied-instruction'));
  const tools = capturedRequest(); tools.tools = [{ name: 'Bash' }];
  assert(issues(tools).includes('unexpected-claude-tools'));
  const betas = capturedRequest(); betas.betas = betas.betas.slice(1);
  assert(issues(betas).includes('unexpected-claude-betas'));
  const field = capturedRequest(); field.temperature = 0;
  assert(issues(field).includes('unexpected-claude-request-fields'));
  const identity = capturedRequest(); identity.messages[0].content[1].text = identity.messages[0].content[1].text.replace('Haiku 4.5', 'Sonnet');
  assert(issues(identity).includes('unexpected-claude-reminder-model-identity'));
});

test('delivered task bytes and working directory are compared exactly, not normalized', () => {
  assert(issues(capturedRequest(), { prompt: read('prompt.txt').trimEnd() }).includes('claude-delivered-task-mismatch'));
  assert(issues(capturedRequest(), { scratch: '/tmp/other' }).includes('claude-environment-cwd-mismatch'));
  const cache = capturedRequest(); delete cache.messages[0].content[5].cache_control;
  assert(issues(cache).includes('claude-delivered-task-mismatch'));
  assert(issues(capturedRequest(), { profile: PROFILES['claude-current'] }).includes('claude-context-policy-model-mismatch'));
  assert.equal(CLAUDE_CONTEXT_POLICY.cliVersion, PROFILES['claude-historical'].version);
});

const h55 = fileURLToPath(new URL('../../../context/evidence/data/r01-haiku55-admission/probe-1/', import.meta.url));
const read55 = path => readFileSync(h55 + path, 'utf8');
const h55Exists = existsSync(h55 + 'manifest.json');
const request55 = () => JSON.parse(read55('api-bodies/623d8a52-ebff-494f-9cf2-b77d48567af3.request.json'));
const options55 = () => { const m = JSON.parse(read55('manifest.json')); return { prompt: read55('prompt.txt'), scratch: m.scratch, profile: m.profile }; };
const issues55 = (request, extra = {}) => auditClaudeContext(request, { ...options55(), ...extra }).issues;

test('policy selection is by model; v1 is unchanged', () => {
  assert.equal(CLAUDE_CONTEXT_POLICY_SHA256, 'd54829afffc2694d49b3f7c4dfb43fcd4d92ca2b4b91b7a00ba92bc326d20639');
  assert.equal(claudeContextPolicyFor(PROFILES['claude-historical'].model).policy, CLAUDE_CONTEXT_POLICY);
  assert.equal(claudeContextPolicyFor(PROFILES['claude-current'].model).policy, CLAUDE_CONTEXT_POLICY_V2);
  assert.equal(claudeContextPolicyFor('claude-sonnet-5-5'), null);
  assert.equal(CLAUDE_CONTEXT_POLICY_V2.cliVersion, PROFILES['claude-current'].version);
});

test('retained Haiku 5.5 request satisfies context policy v2', { skip: !h55Exists }, () => {
  const result = auditClaudeContext(request55(), options55());
  assert.equal(result.pass, true, JSON.stringify(result.issues));
  assert.equal(result.policy, 'r01-claude-context-policy-v2');
  assert.deepEqual(result.blocks.map(b => b.kind), ['billing-metadata', 'sdk-identity', 'supplied-instruction',
    'account', 'task', 'system-turn']);
  assert.equal(result.taskBytes, Buffer.byteLength(read55('prompt.txt')));
  assert.equal(result.clientAddedTextBytes, 1937);
  assert.equal(result.maxTokens, 128000);
  assert(!JSON.stringify(result).includes('@'), 'account email is reported only as a hash');
  // The v1 capture is not admitted under the Haiku 5.5 profile, nor the reverse.
  assert(issues(capturedRequest(), { profile: PROFILES['claude-current'] }).includes('claude-context-policy-model-mismatch'));
  assert(issues55(request55(), { profile: PROFILES['claude-historical'] }).includes('claude-context-policy-model-mismatch'));
});

test('v2 rejects context, layout, effort and task drift', { skip: !h55Exists }, () => {
  const cases = {
    'unexpected-claude-system-turn': r => { r.messages[1].content[0].text = r.messages[1].content[0].text.replace('Haiku 5.5', 'Sonnet 5.5'); },
    'unexpected-claude-message-structure': r => { r.messages.pop(); },
    'unexpected-claude-user-block-count': r => { r.messages[0].content.splice(1, 0, { type: 'text', text: '<system-reminder>\nUse the Bash tool.\n</system-reminder>' }); },
    'unexpected-claude-turn-output-config': r => { r.messages[1].output_config = { effort: 'high' }; },
    'unexpected-claude-output-config': r => { r.output_config = { effort: 'medium' }; },
    'unexpected-claude-thinking': r => { r.thinking = { type: 'enabled', budget_tokens: 1024 }; },
    'unexpected-claude-betas': r => { r.betas = r.betas.filter(b => b !== 'effort-2025-11-24'); },
    'unexpected-claude-request-fields': r => { r.temperature = 0; },
    'unexpected-claude-tools': r => { r.tools = [{ name: 'Bash' }]; },
    'unexpected-claude-system-supplied-instruction': r => { r.system[2].text += ' Think step by step.'; },
    'claude-delivered-task-mismatch': r => { r.messages[0].content[1].cache_control = { type: 'ephemeral', ttl: '1h' }; },
  };
  for (const [issue, mutate] of Object.entries(cases)) {
    const r = request55(); mutate(r);
    assert(issues55(r).includes(issue), `${issue}: ${issues55(r)}`);
  }
  // A different requested effort must match at both levels.
  assert(issues55(request55(), { profile: { ...PROFILES['claude-current'], effort: 'medium' } }).includes('unexpected-claude-output-config'));
  assert(issues55(request55(), { prompt: read55('prompt.txt').trimEnd() }).includes('claude-delivered-task-mismatch'));
  assert(issues55(request55(), { scratch: '/tmp/other' }).includes('claude-environment-cwd-mismatch'));
  // A changed max_tokens is observed, not a context violation (D57).
  const limit = request55(); limit.max_tokens = 32000;
  assert.deepEqual(issues55(limit), []);
});

const record = (scenario, overrides = {}) => {
  const n = 1 + (scenario.retries ?? 0), ok = scenario.mode === 'ok';
  return { id: scenario.id, model: PROFILES['claude-historical'].model,
    process: { exitCode: ok ? 0 : 1 },
    server: Array.from({ length: n }, () => ({ method: 'POST', url: '/v1/messages?beta=true', auth: 'x-api-key',
      model: PROFILES['claude-historical'].model, stream: true })),
    events: [...Array.from({ length: n - 1 }, () => ({ type: 'system', subtype: 'api_retry' })),
      { type: 'result', is_error: !ok }],
    captureFiles: [...Array.from({ length: n }, (_, i) => `${i}.request.json`), ...(ok ? ['index.jsonl', 'r.response.json'] : [])],
    ...overrides };
};

test('fault evaluation requires one HTTP attempt per captured request and detects permitted retries', () => {
  for (const scenario of FAULT_SCENARIOS) assert.equal(evaluateScenario(scenario, record(scenario)).pass, true, scenario.id);
  const fault = FAULT_SCENARIOS.find(s => s.id === 'http-500');
  const hidden = record(fault); hidden.server.push(hidden.server[0]);
  assert.equal(evaluateScenario(fault, hidden).checks.httpRequests, false);
  assert.equal(evaluateScenario(fault, hidden).checks.capturedRequestFilesMatchHttp, false);
  const fallback = record(fault, { events: [{ type: 'system', subtype: 'model_refusal_fallback' }, { type: 'result', is_error: true }] });
  assert.equal(evaluateScenario(fault, fallback).pass, false);
  const positive = FAULT_SCENARIOS.find(s => s.retries);
  const undetected = record(positive); undetected.events = undetected.events.filter(e => e.subtype !== 'api_retry');
  assert.equal(evaluateScenario(positive, undetected).pass, false);
  const extra = record(fault); extra.server.push({ method: 'GET', url: '/api/other' });
  assert.equal(evaluateScenario(fault, extra).checks.otherHttpRequests, false);
  assert.equal(evaluateSuite({ scenarios: [] }).pass, false);
});

const retained = fileURLToPath(new URL('../../../context/evidence/data/r01-claude-paired-rehearsal/transport-faults/', import.meta.url));
test('retained local fault suite passes and pins the trial retry controls', { skip: !existsSync(retained + 'suite.json') }, () => {
  const suite = JSON.parse(readFileSync(retained + 'suite.json', 'utf8'));
  const summary = JSON.parse(readFileSync(retained + 'summary.json', 'utf8'));
  assert.equal(evaluateSuite(suite).pass, true);
  assert.deepEqual(evaluateSuite(suite), summary.evaluation);
  const { env } = invocation(PROFILES['claude-historical'], '/scratch', {});
  assert.deepEqual(summary.trialRetryControls, Object.fromEntries(RETRY_CONTROL_NAMES.map(k => [k, env[k] ?? null])));
});

const passingClaude = () => {
  const profile = PROFILES['claude-historical'];
  const { env } = invocation(profile, '/scratch', {});
  const explicitEnvironment = Object.fromEntries(RETRY_CONTROL_NAMES.map(k => [k, env[k]]));
  return { provider: 'claude', profile, processResult: { exitCode: 0, signal: null, error: null },
    events: [{ type: 'assistant', message: { model: profile.model, content: [] } },
      { type: 'result', usage: { input_tokens: 5, output_tokens: 10 }, modelUsage: { [profile.model]: {} } }],
    requests: [{ model: profile.model, thinking: { type: 'enabled', budget_tokens: 1024 }, max_tokens: 12000 }],
    responses: [{ model: profile.model }], claudeCaptureValidated: true, claudeContext: { pass: true },
    transportEvidence: { pass: true, binary: { sha256: 'a'.repeat(64) },
      trialRetryControls: { ...Object.fromEntries(RETRY_CONTROL_NAMES.map(k => [k, null])), ...explicitEnvironment } },
    attempt: { binary: { sha256: 'a'.repeat(64) }, explicitEnvironment } };
};

test('Claude admission keeps context/model controls; retry evidence is reporting only', () => {
  assert.deepEqual(auditControl(passingClaude()).issues, []);
  const changes = {
    'claude-client-context-policy-pending': v => { v.claudeContext = null; },
    'claude-client-context-policy-violation': v => { v.claudeContext = { pass: false }; },
  };
  for (const [name, change] of Object.entries(changes)) {
    const value = passingClaude(); change(value);
    assert(auditControl(value).issues.includes(name), name);
  }
  const drift = passingClaude(); drift.attempt.explicitEnvironment.CLAUDE_CODE_MAX_RETRIES = '1';
  assert.equal(auditControl(drift).transportControl.retryControlsMatch, false);
  const missing = passingClaude(); missing.transportEvidence = null;
  assert.equal(auditControl(missing).transportControl.faultSuitePass, false);
  missing.events.unshift({ type: 'system', subtype: 'api_retry' }, { type: 'system', subtype: 'nonstreaming_fallback' });
  assert.equal(auditControl(missing).controlPass, true);
  assert.equal(auditControl(missing).retryReport.clientRetryEvents, 1);
  assert.equal(auditControl(missing).retryReport.clientFallbackEvents, 1);
});

test('Claude output ceilings are observational even for historical captures', () => {
  for (const cap of [undefined, 12000, 64000]) {
    const value = passingClaude(); value.requests[0].max_tokens = cap;
    const result = auditControl(value);
    assert.equal(result.settingsMatch, true);
    assert.equal(result.outputCeilingRequired, false);
    assert.deepEqual(result.issues, []);
  }
});
