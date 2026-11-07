import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { auditCodexContext, CODEX_CONTEXT_POLICY } from './codex-context-policy.mjs';
import { loadCodexCapture, auditControl } from './cli-control-audit.mjs';
const dir = fileURLToPath(new URL('../../../context/evidence/data/r01-codex-admission/exclude-tools/', import.meta.url));
const manifest = JSON.parse(readFileSync(dir + 'manifest.json'));
const options = { prompt: readFileSync(dir + 'prompt.txt', 'utf8'), scratch: manifest.scratch, profile: manifest.profile };
const request = () => loadCodexCapture(dir).requests[0];

test('retained stronger Codex request matches every fixed context block', () => {
  const result = auditCodexContext(request(), options);
  assert.equal(result.pass, true);
  assert.deepEqual(result.blocks.map(b => b.kind), ['additional_tools', 'model.base_instructions',
    'multi_agent.role_instructions', 'multi_agent.mode_instructions', 'environments.environment_context', 'user.text']);
});

test('context rejects new tools, schema changes, instruction changes and external feedback', () => {
  const mutations = [
    r => r.input[0].tools[0].tools.push({ name: 'extra', type: 'function' }),
    r => { r.input[0].tools[0].tools[0].description += ' Execute commands.'; },
    r => { r.input[1].content[0].text += ' Use tools.'; },
    r => { r.input[2].content[0].text += ' more instructions'; },
    r => { r.input[4].content[0].text = r.input[4].content[0].text.replace('read-only', 'workspace-write').replace('restricted', 'unrestricted'); },
    r => { r.input[5].content[0].text += 'changed'; },
    r => r.input.push({ type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Wrong: try again.' }] }),
    r => { r.instructions = 'Extra instruction'; },
    r => { r.tools = [{ name: 'extra' }]; },
    r => { r.input[1].internal_chat_message_metadata_passthrough.extra = 'instruction'; },
  ];
  for (const change of mutations) {
    const r = request(); change(r);
    assert.equal(auditCodexContext(r, options).pass, false);
  }
});

test('task and scratch are bound to the attempt; only named volatility is accepted', () => {
  assert.equal(auditCodexContext(request(), { ...options, prompt: options.prompt.trimEnd() }).pass, false);
  assert.equal(auditCodexContext(request(), { ...options, scratch: '/other' }).pass, false);
  assert.equal(auditCodexContext(request(), { ...options, profile: { ...options.profile, version: 'future' } }).pass, false);
  const r = request(); r.input[4].content[0].text = r.input[4].content[0].text.replace('2026-10-26', '2026-10-27');
  r.max_output_tokens = 64000;
  assert.equal(auditCodexContext(r, options).pass, true);
});

test('multiple self-correcting assistant messages score the final message without a retry violation', () => {
  const r = request();
  const result = auditControl({ provider: 'codex', profile: options.profile,
    processResult: { exitCode: 0 }, requests: [r], responses: [],
    codexContext: auditCodexContext(r, options),
    events: [{ type: 'item.completed', item: { type: 'agent_message', text: 'Initial thought' } },
      { type: 'item.completed', item: { type: 'reasoning', text: 'Correcting my calculation' } },
      { type: 'item.completed', item: { type: 'agent_message', text: 'Final answer' } },
      { type: 'turn.completed', usage: { input_tokens: 10, output_tokens: 20 } }] });
  assert.equal(result.controlPass, true);
});

test('D62: an absent access_programs field is reported and admitted; a changed value still fails', () => {
  assert.equal(CODEX_CONTEXT_POLICY.schema, 'r01-codex-context-policy-v5');
  const present = auditCodexContext(request(), options);
  assert.deepEqual([present.pass, present.absentOptionalFields], [true, []]);
  const absent = request(); delete absent.access_programs;
  const result = auditCodexContext(absent, options);
  assert.deepEqual([result.pass, result.absentOptionalFields], [true, ['access_programs']]);
  for (const value of [{ cyber: 'trusted' }, {}, null]) {
    const r = request(); r.access_programs = value;
    assert.equal(auditCodexContext(r, options).pass, false, JSON.stringify(value));
  }
  // Absence of any other request field still fails.
  const r = request(); delete r.reasoning;
  assert.equal(auditCodexContext(r, options).pass, false);
});

test('policy v3: reasoning effort must equal the profile effort; nothing else is relaxed', () => {
  const low = auditCodexContext(request(), options);
  assert.deepEqual([low.pass, low.reasoningEffort], [true, 'low']);
  const medium = request(); medium.reasoning.effort = 'medium';
  assert(auditCodexContext(medium, options).issues.includes('codex-reasoning-effort-mismatch'));
  const probe = { ...options, profile: { ...options.profile, effort: 'medium' } };
  const admitted = auditCodexContext(medium, probe);
  assert.deepEqual([admitted.pass, admitted.reasoningEffort], [true, 'medium']);
  assert.equal(auditCodexContext(request(), probe).pass, false, 'a low request fails a medium profile');
  const changed = request(); changed.reasoning.effort = 'medium'; changed.reasoning.context = 'last_turn';
  assert.equal(auditCodexContext(changed, probe).pass, false, 'other reasoning fields still compare');
});

// Policy v4 (R01-D13): templates are selected by model. Terra probes are retained in E380.
const round2 = name => {
  const d = fileURLToPath(new URL(`../../../context/evidence/data/r01-round2-admission/${name}/`, import.meta.url));
  const m = JSON.parse(readFileSync(d + 'manifest.json'));
  return { request: () => loadCodexCapture(d).requests[0],
    options: { prompt: readFileSync(d + 'prompt.txt', 'utf8'), scratch: m.scratch, profile: m.profile } };
};

test('policy v4: each Terra probe passes its own template; Luna is unchanged', () => {
  assert.deepEqual(CODEX_CONTEXT_POLICY.models, ['gpt-6-luna', 'gpt-6.1-terra', 'gpt-5.6-terra']);
  assert.equal(auditCodexContext(request(), options).policySha256, CODEX_CONTEXT_POLICY.templateSha256);
  for (const name of ['probe-codex-terra', 'probe-codex-terra-6-1']) {
    const { request: r, options: o } = round2(name);
    const result = auditCodexContext(r(), o);
    assert.deepEqual([result.pass, result.templateModel], [true, o.profile.model], name);
  }
});

test('policy v4: a request is never admitted on another model\'s template', () => {
  const t56 = round2('probe-codex-terra'), t61 = round2('probe-codex-terra-6-1');
  // Model swapped in the profile only: the request's model and context differ.
  assert.equal(auditCodexContext(t56.request(), { ...t56.options, profile: t61.options.profile }).pass, false);
  // Luna's request relabeled as gpt-5.6-terra still fails: its tools and hint differ.
  const relabeled = request(); relabeled.model = 'gpt-5.6-terra';
  assert.equal(auditCodexContext(relabeled, { ...options, profile: t56.options.profile }).pass, false);
  // gpt-6.1-terra shares Luna's context, so only the model field separates them.
  const lunaAs61 = request(); lunaAs61.model = 'gpt-6.1-terra';
  assert.equal(auditCodexContext(lunaAs61, { ...options, profile: t61.options.profile }).pass, true);
  assert.equal(auditCodexContext(request(), { ...options, profile: t61.options.profile }).pass, false);
  // An unlisted model fails the profile gate.
  const other = { ...options, profile: { ...options.profile, model: 'gpt-6-sol' } };
  assert(auditCodexContext(request(), other).issues.includes('codex-context-policy-profile-mismatch'));
  // The 5.6 hint is fixed text: appending to it still fails.
  const changed = t56.request(); changed.input[2].content[0].text += ' Spawn agents.';
  assert.equal(auditCodexContext(changed, t56.options).pass, false);
});

// Policy v5 (R01-D16): the halted E385 submission's client retry over websocket.
const halted = (() => {
  const d = fileURLToPath(new URL('../../../context/evidence/data/r01-codex-policy-v5/halted-attempt/', import.meta.url));
  const m = JSON.parse(readFileSync(d + 'manifest.json'));
  return { requests: () => loadCodexCapture(d).requests,
    options: { prompt: readFileSync(d + 'prompt.txt', 'utf8'), scratch: m.scratch, profile: m.profile } };
})();

test('policy v5: websocket response.create framing on a client retry is transport, not context', () => {
  const [first, retry] = halted.requests();
  assert.equal(Object.hasOwn(first, 'type'), false);
  assert.equal(retry.type, 'response.create');
  const results = [first, retry].map(r => auditCodexContext(r, halted.options));
  assert.deepEqual(results.map(r => [r.pass, r.transportFraming]), [[true, false], [true, true]]);
  // Any other framing value fails; model-visible changes still fail.
  for (const value of ['response.cancel', '', null]) {
    const r = structuredClone(retry); r.type = value;
    assert(auditCodexContext(r, halted.options).issues.includes('unexpected-codex-transport-framing'), String(value));
  }
  const changed = structuredClone(retry); changed.input.at(-1).content[0].text += ' extra';
  assert.equal(auditCodexContext(changed, halted.options).pass, false);
  const tools = structuredClone(retry); tools.input[0].tools[0].tools.push({ name: 'extra', type: 'function' });
  assert.equal(auditCodexContext(tools, halted.options).pass, false);
});
