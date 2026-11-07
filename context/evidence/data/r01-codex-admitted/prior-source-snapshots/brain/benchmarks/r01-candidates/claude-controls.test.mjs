import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { auditClaudeContext, CLAUDE_CONTEXT_POLICY } from './claude-context-policy.mjs';
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

test('Claude admission passes only with policy, fault evidence for the same binary, and no observed retry', () => {
  assert.deepEqual(auditControl(passingClaude()).issues, []);
  const changes = {
    'claude-client-context-policy-pending': v => { v.claudeContext = null; },
    'claude-client-context-policy-violation': v => { v.claudeContext = { pass: false }; },
    'transport-retry-control-unverified': v => { v.attempt.binary.sha256 = 'b'.repeat(64); },
    'client-retry-observed': v => { v.events.unshift({ type: 'system', subtype: 'api_retry' }); },
    'client-fallback-observed': v => { v.events.unshift({ type: 'system', subtype: 'model_refusal_fallback' }); },
  };
  for (const [name, change] of Object.entries(changes)) {
    const value = passingClaude(); change(value);
    assert(auditControl(value).issues.includes(name), name);
  }
  const drift = passingClaude(); drift.attempt.explicitEnvironment.CLAUDE_CODE_MAX_RETRIES = '1';
  assert.equal(auditControl(drift).transportControl.retryControlsMatch, false);
  const missing = passingClaude(); missing.transportEvidence = null;
  assert.equal(auditControl(missing).transportControl.faultSuitePass, false);
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
