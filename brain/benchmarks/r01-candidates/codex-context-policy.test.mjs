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
  assert.equal(CODEX_CONTEXT_POLICY.schema, 'r01-codex-context-policy-v3');
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
