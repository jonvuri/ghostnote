// Strict control audit: requested model metadata is never served-model proof.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { auditTranscript } from './cli-smoke-audit.mjs';
const sha = text => createHash('sha256').update(text).digest('hex');
const jsonl = text => text.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
const toolNames = (tools, prefix = '') => tools.flatMap(tool => {
  const name = `${prefix}${tool.name ?? tool.function?.name ?? tool.type}`;
  return tool.type === 'namespace' ? toolNames(tool.tools ?? [], `${name}.`) : [name];
});
const safeRead = (root, ref) => {
  const path = resolve(root, ref), rel = relative(root, path);
  if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('capture reference outside attempt');
  return JSON.parse(readFileSync(path, 'utf8'));
};

export function auditControl({ provider, profile, events, processResult, requests = [], responses = [],
  inferenceStarts = requests.length, inferenceFailures = 0, reroutes = [], rawFiles = [], tokenizer,
  captureIssues = [], claudeCaptureValidated = false }) {
  if (!['codex', 'claude'].includes(provider) || profile.provider !== provider) throw new Error('provider/profile mismatch');
  const transport = auditTranscript(provider, events);
  // A later below-limit event cannot erase an earlier overage observation.
  const overage = events.filter(e => e.type === 'rate_limit_event')
    .map(e => e.rate_limit_info?.isUsingOverage);
  transport.overageUsed = overage.includes(true) ? true
    : overage.length && overage.every(value => value === false) ? false : null;
  const complete = events.findLast(e => e.type === 'turn.completed' || e.type === 'result');
  const streamModels = provider === 'claude' ? events.map(e => e.message?.model).filter(Boolean) : [];
  const servedModels = [...new Set([...responses.map(r => r.model), ...streamModels].filter(Boolean))];
  const modelVerified = servedModels.length > 0 && servedModels.every(m => m === profile.model)
    && requests.length === 1 && requests[0].model === profile.model && reroutes.length === 0;
  const requestReports = requests.map(request => {
    const messages = request.input ?? request.messages ?? [];
    const contextKinds = messages.flatMap(m => m.internal_chat_message_metadata_passthrough?.content_item_kinds ?? []);
    const text = JSON.stringify({ instructions: request.instructions, system: request.system, input: messages, tools: request.tools ?? [] });
    return { model: request.model, reasoning: request.reasoning ?? null, thinking: request.thinking ?? null,
      effort: request.output_config?.effort ?? null, maxOutputTokens: request.max_tokens ?? request.max_output_tokens ?? null,
      temperaturePresent: Object.hasOwn(request, 'temperature'), tools: toolNames([
        ...(request.tools ?? []), ...messages.filter(m => m.type === 'additional_tools').flatMap(m => m.tools ?? [])]),
      contextKinds, contextSha256: sha(text), contextBytes: Buffer.byteLength(text),
      localSerializedContextTokens: tokenizer ? tokenizer.encode(text).length : null,
      requestSha256: sha(JSON.stringify(request)), userProjectInstructionsPresent: contextKinds.includes('agents_md.instructions'),
      skillsPresent: contextKinds.some(k => k.includes('skills')),
      systemBlockCount: Array.isArray(request.system) ? request.system.length : null,
      reminderBlockCount: messages.flatMap(m => Array.isArray(m.content) ? m.content : [])
        .filter(c => c.type === 'text' && c.text.startsWith('<system-reminder>')).length };
  });
  const oneRequest = requests.length === 1 && inferenceStarts === 1 && inferenceFailures === 0;
  const settingsMatch = requests.length === 1 && (provider === 'codex'
    ? requests[0].reasoning?.effort === profile.effort
    : (profile.thinkingBudget !== undefined
      ? requests[0].thinking?.type === 'enabled' && requests[0].thinking?.budget_tokens === profile.thinkingBudget
      : requests[0].output_config?.effort === profile.effort)
      && requests[0].max_tokens === profile.maxOutputTokens) && !requestReports[0].temperaturePresent;
  const issues = [...captureIssues];
  const usage = complete?.usage;
  const counters = usage ? [usage.input_tokens, usage.output_tokens, ...['cached_input_tokens',
    'cache_creation_input_tokens', 'cache_read_input_tokens', 'reasoning_output_tokens']
    .filter(k => Object.hasOwn(usage, k)).map(k => usage[k])] : [];
  if (!counters.length || counters.some(v => !Number.isSafeInteger(v) || v < 0)
      || provider === 'codex' && (usage?.cached_input_tokens ?? 0) > usage?.input_tokens) issues.push('invalid-token-accounting');
  if (processResult.exitCode !== 0 || processResult.signal || processResult.error || !transport.transportClean) issues.push('transport-or-client-failure');
  if (!oneRequest) issues.push('missing-or-multiple-inference-requests');
  if (!modelVerified) issues.push('served-model-unverified-or-mismatched');
  if (!settingsMatch) issues.push('effective-generation-settings-unverified-or-mismatched');
  if (requestReports.some(r => r.tools.length)) issues.push('advertised-tools-present');
  if (requestReports.some(r => r.userProjectInstructionsPresent || r.skillsPresent)) issues.push('unexpected-client-instructions');
  // Subscription usage is operator-monitored. Record overage without making
  // an account-credit setting a prerequisite for experimental admission.
  if (Object.keys(complete?.modelUsage ?? {}).some(model => model !== profile.model)) issues.push('usage-model-mismatch');
  if (provider === 'claude') {
    if (!claudeCaptureValidated) issues.push('claude-request-capture-validation-pending');
    // Capture validates model/settings, but the paired runner still needs a
    // frozen client-context policy and transport-level retry evidence.
    issues.push('claude-client-context-policy-pending', 'transport-retry-control-unverified');
  }
  // Built-in Codex provider rejects retry overrides; one logical inference is
  // not proof of one HTTP attempt. Keep this gate until transport-level capture.
  if (provider === 'codex') issues.push('transport-retry-control-unverified');
  return { schema: 'r01-cli-control-audit-v1', provider, requestedModel: profile.model,
    servedModels, modelVerified, oneLogicalInference: oneRequest, settingsMatch,
    rawFinalUsage: usage ?? null, usageModelNames: Object.keys(complete?.modelUsage ?? {}),
    requests: requestReports, requestCount: requests.length, responseCount: responses.length,
    inferenceStarts, inferenceFailures, reroutes, claudeCaptureValidated, ...transport,
    controlPass: issues.length === 0, issues, rawFiles };
}

export function loadClaudeCapture(directory) {
  const root = join(directory, 'api-bodies'), requests = [], responses = [], rawFiles = [], captureIssues = [];
  if (!existsSync(join(root, 'index.jsonl'))) return { requests, responses, rawFiles,
    captureIssues: ['missing-claude-capture-index'], claudeCaptureValidated: false };
  const names = readdirSync(root).sort();
  const index = jsonl(readFileSync(join(root, 'index.jsonl'), 'utf8'));
  const seen = new Set();
  for (const entry of index) {
    for (const [key, suffix] of [['request_file', '.request.json'], ['response_file', '.response.json']]) {
      const name = entry[key];
      if (typeof name !== 'string' || !name.endsWith(suffix) || !names.includes(name) || seen.has(name)) {
        captureIssues.push('invalid-or-duplicate-claude-capture-reference'); continue;
      }
      seen.add(name);
    }
  }
  // Include orphan request files: a completed index entry must not hide an
  // earlier failed attempt. Unknown files also invalidate capture admission.
  for (const name of names) {
    const path = join(root, name);
    rawFiles.push({ path: relative(directory, path), sha256: sha(readFileSync(path)) });
    if (name.endsWith('.request.json')) requests.push(safeRead(root, name));
    else if (name.endsWith('.response.json')) responses.push(safeRead(root, name));
    else if (name !== 'index.jsonl') captureIssues.push('unknown-claude-capture-file');
    if (name !== 'index.jsonl' && !seen.has(name)) captureIssues.push('unindexed-claude-capture-file');
  }
  for (const entry of index) {
    if (!names.includes(entry.request_file) || !names.includes(entry.response_file)) continue;
    const request = safeRead(root, entry.request_file), response = safeRead(root, entry.response_file);
    if (request.model !== entry.model || response.model !== entry.model || response.id !== entry.message_id)
      captureIssues.push('claude-capture-index-mismatch');
  }
  return { requests, responses, rawFiles, captureIssues: [...new Set(captureIssues)],
    claudeCaptureValidated: index.length > 0 && captureIssues.length === 0 };
}

export function loadCodexCapture(directory) {
  const root = join(directory, 'codex-traces'), requests = [], responses = [], reroutes = [], rawFiles = [];
  let inferenceStarts = 0, inferenceFailures = 0;
  if (existsSync(root)) for (const name of readdirSync(root)) {
    const bundle = join(root, name), tracePath = join(bundle, 'trace.jsonl');
    if (!existsSync(tracePath)) continue;
    for (const e of jsonl(readFileSync(tracePath, 'utf8'))) {
      const p = e.payload;
      if (p.type === 'inference_started') { inferenceStarts++; requests.push(safeRead(bundle, p.request_payload.path)); }
      if (p.type === 'inference_completed') responses.push(safeRead(bundle, p.response_payload.path));
      if (p.type === 'inference_failed') inferenceFailures++;
      if (p.type === 'protocol_event_observed' && p.event_type === 'model_reroute') reroutes.push(safeRead(bundle, p.event_payload.path));
    }
    for (const part of ['manifest.json', 'trace.jsonl', ...readdirSync(join(bundle, 'payloads')).map(n => `payloads/${n}`)]) {
      const path = join(bundle, part); rawFiles.push({ path: relative(directory, path), sha256: sha(readFileSync(path)) });
    }
  }
  return { requests, responses, reroutes, rawFiles, inferenceStarts, inferenceFailures };
}

export function auditProbe(directory, tokenizer) {
  const manifest = safeRead(directory, 'manifest.json'), processResult = safeRead(directory, 'process.json');
  const provider = manifest.profile.provider;
  const events = jsonl(readFileSync(join(directory, 'stdout.jsonl'), 'utf8'));
  const answer = provider === 'codex'
    ? events.filter(e => e.type === 'item.completed' && e.item?.type === 'agent_message').at(-1)?.item.text
    : events.findLast(e => e.type === 'result')?.result;
  let probeAnswerMatches = false;
  try {
    const expected = JSON.parse(readFileSync(join(directory, 'prompt.txt'), 'utf8').trim().split('\n').at(-1));
    expected.notes.find(n => n.id === 'b').velocity = 91;
    probeAnswerMatches = isDeepStrictEqual(JSON.parse(answer), expected);
  } catch {}
  const capture = provider === 'codex' ? loadCodexCapture(directory) : loadClaudeCapture(directory);
  if (provider === 'claude') {
    const usage = events.findLast(e => e.type === 'result')?.usage;
    if (capture.responses.length === 1 && !isDeepStrictEqual(capture.responses[0].usage, usage))
      capture.captureIssues.push('claude-final-usage-mismatch');
  }
  return { probeAnswerMatches, ...auditControl({ provider, profile: manifest.profile,
    events, processResult,
    ...capture, tokenizer }) };
}
