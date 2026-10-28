// D55 admits pinned Luna selection without claiming independent served identity.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { auditTranscript } from './cli-smoke-audit.mjs';
import { auditClaudeContext } from './claude-context-policy.mjs';
import { RETRY_CONTROL_NAMES } from './claude-transport-faults.mjs';
const sha = text => createHash('sha256').update(text).digest('hex');
const jsonl = text => text.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
const toolNames = (tools, prefix = '') => tools.flatMap(tool => {
  const name = `${prefix}${tool.name ?? tool.function?.name ?? tool.type}`;
  return tool.type === 'namespace' ? toolNames(tool.tools ?? [], `${name}.`) : [name];
});
// Inspect structured call records, not tool names mentioned in prose or schemas.
// Observations may repeat the same invocation across capture surfaces.
const isToolUse = item => typeof item?.type === 'string' && (
  /_(?:call|call_output)$/.test(item.type)
  || ['tool_use', 'tool_result', 'command_execution', 'file_change', 'web_search'].includes(item.type));
const toolUseItems = (items, source) => (Array.isArray(items) ? items : []).flatMap((item, index) => [
  ...(isToolUse(item) ? [{ source, index, type: item.type }] : []),
  ...toolUseItems(item?.content, `${source}[${index}].content`),
]);
const safeRead = (root, ref) => {
  const path = resolve(root, ref), rel = relative(root, path);
  if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('capture reference outside attempt');
  return JSON.parse(readFileSync(path, 'utf8'));
};

export function auditControl({ provider, profile, events, processResult, requests = [], responses = [],
  inferenceStarts = requests.length, inferenceFailures = 0, reroutes = [], rawFiles = [], tokenizer,
  captureIssues = [], claudeCaptureValidated = false, claudeContext = null, transportEvidence = null, attempt = null,
  traceToolUse = [] }) {
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
      effort: request.output_config?.effort ?? null,
      maxOutputTokens: (provider === 'codex' ? request.max_output_tokens : request.max_tokens) ?? null,
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
  const requestModelPolicy = provider === 'codex' && profile.model === 'gpt-6-luna'
    && profile.version === 'codex-cli 0.163.0';
  const modelSelectionPolicy = requestModelPolicy ? 'r01-codex-luna-request-model-v1' : 'served-model-v1';
  const completedSuccessfully = Boolean(complete && !complete.is_error)
    && processResult.exitCode === 0 && !processResult.signal && !processResult.error
    && !events.some(e => ['error', 'turn.failed'].includes(e.type));
  const observedReroute = reroutes.length > 0 || events.some(e => e.type === 'model_reroute');
  const modelSelectionPass = requestModelPolicy
    ? oneRequest && requests[0].model === profile.model && completedSuccessfully && !observedReroute
      && servedModels.every(model => model === profile.model)
      && Object.keys(complete.modelUsage ?? {}).every(model => model === profile.model)
    : modelVerified && !observedReroute;
  const modelEvidenceBasis = modelSelectionPass
    ? modelVerified ? 'served-model' : 'captured-request-success-no-reroute'
    : 'insufficient-or-conflicting';
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
  if (!modelSelectionPass) issues.push(requestModelPolicy
    ? 'model-selection-unverified-or-mismatched' : 'served-model-unverified-or-mismatched');
  if (!settingsMatch) issues.push('effective-generation-settings-unverified-or-mismatched');
  const outputCeilingVerified = Number.isSafeInteger(profile.maxOutputTokens) && profile.maxOutputTokens > 0
    && requestReports.length === 1 && requestReports[0].maxOutputTokens === profile.maxOutputTokens;
  if (!outputCeilingVerified) issues.push('effective-output-ceiling-unverified-or-mismatched');
  // D56 allows fixed Codex declarations as accounted context, but no invocation
  // (including blocked/failed attempts). The context-policy gate remains separate.
  if (provider !== 'codex' && requestReports.some(r => r.tools.length)) issues.push('advertised-tools-present');
  const toolUseObservations = [
    ...traceToolUse,
    ...requests.flatMap((r, i) => toolUseItems(r.input ?? r.messages, `request[${i}]`)),
    ...responses.flatMap((r, i) => toolUseItems(r.output_items ?? r.output ?? r.content, `response[${i}]`)),
    ...events.flatMap((e, i) => [
      ...toolUseItems(e.item ? [e.item] : [], `event[${i}].item`),
      ...toolUseItems(e.message?.content, `event[${i}].message.content`),
      ...(isToolUse(e) ? [{ source: `event[${i}]`, type: e.type }] : []),
    ]),
  ];
  const toolUseObserved = transport.toolEventCount > 0 || toolUseObservations.length > 0;
  if (toolUseObserved) issues.push('tool-use-observed');
  if (requestReports.some(r => r.userProjectInstructionsPresent || r.skillsPresent)) issues.push('unexpected-client-instructions');
  // Subscription usage is operator-monitored. Record overage without making
  // an account-credit setting a prerequisite for experimental admission.
  if (Object.keys(complete?.modelUsage ?? {}).some(model => model !== profile.model)) issues.push('usage-model-mismatch');
  const clientRetryEvents = events.filter(e => e.type === 'system' && e.subtype === 'api_retry').length;
  const clientFallbackEvents = events.filter(e => e.type === 'system' && /fallback/.test(e.subtype ?? '')).length;
  let transportControl = null;
  if (provider === 'claude') {
    if (!claudeCaptureValidated) issues.push('claude-request-capture-validation-pending');
    if (!claudeContext) issues.push('claude-client-context-policy-pending');
    else if (!claudeContext.pass) issues.push('claude-client-context-policy-violation');
    if (clientRetryEvents) issues.push('client-retry-observed');
    if (clientFallbackEvents) issues.push('client-fallback-observed');
    // Retry absence rests on the local fault suite for this exact binary and
    // retry settings, plus one captured request file in this attempt. The
    // suite showed one request file per HTTP attempt, including failures.
    transportControl = { faultSuitePass: transportEvidence?.pass === true,
      binaryMatches: Boolean(attempt?.binary?.sha256) && attempt.binary.sha256 === transportEvidence?.binary?.sha256,
      retryControlsMatch: Boolean(attempt?.explicitEnvironment) && RETRY_CONTROL_NAMES.every(k =>
        (attempt.explicitEnvironment[k] ?? null) === (transportEvidence?.trialRetryControls?.[k] ?? null)),
      oneCapturedRequest: requests.length === 1 };
    if (!Object.values(transportControl).every(Boolean)) issues.push('transport-retry-control-unverified');
  }
  // Built-in Codex provider rejects retry overrides; one logical inference is
  // not proof of one HTTP attempt. Keep this gate until transport-level capture.
  if (provider === 'codex') issues.push('transport-retry-control-unverified', 'codex-client-context-policy-pending');
  return { schema: 'r01-cli-control-audit-v1', provider, requestedModel: profile.model,
    servedModels, modelVerified, modelSelectionPolicy, modelSelectionPass, modelEvidenceBasis,
    oneLogicalInference: oneRequest, settingsMatch, outputCeilingVerified,
    rawFinalUsage: usage ?? null, usageModelNames: Object.keys(complete?.modelUsage ?? {}),
    requests: requestReports, requestCount: requests.length, responseCount: responses.length,
    inferenceStarts, inferenceFailures, reroutes, claudeCaptureValidated, clientRetryEvents, clientFallbackEvents,
    toolPolicy: provider === 'codex' ? 'r01-codex-no-tool-use-v1' : 'no-tools-advertised-or-used',
    toolUseObserved, toolUseObservations,
    transportControl, claudeContext, apiErrorStatus: complete?.api_error_status ?? null,
    rateLimitStatuses: events.filter(e => e.type === 'rate_limit_event').map(e => e.rate_limit_info?.status ?? null), ...transport,
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
  const root = join(directory, 'codex-traces'), requests = [], responses = [], reroutes = [], rawFiles = [], traceToolUse = [];
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
      if (/^(?:tool_call(?:_|$)|code_cell_)/.test(p.type)
          || p.type === 'protocol_event_observed' && (
            /^(?:exec_command_|mcp_tool_call_|web_search_|patch_apply_|tool_call_|code_cell_|request_user_input)/.test(p.event_type)
            || isToolUse({ type: p.event_type })))
        traceToolUse.push({ source: relative(directory, tracePath), seq: e.seq,
          type: p.type, ...(p.event_type ? { eventType: p.event_type } : {}) });
    }
    for (const part of ['manifest.json', 'trace.jsonl', ...readdirSync(join(bundle, 'payloads')).map(n => `payloads/${n}`)]) {
      const path = join(bundle, part); rawFiles.push({ path: relative(directory, path), sha256: sha(readFileSync(path)) });
    }
  }
  return { requests, responses, reroutes, rawFiles, inferenceStarts, inferenceFailures, traceToolUse };
}

/** Audit a retained attempt directory with the pinned context and transport evidence. */
export function auditAttempt(directory, { tokenizer, transportEvidence = null } = {}) {
  const manifest = safeRead(directory, 'manifest.json'), processResult = safeRead(directory, 'process.json');
  const provider = manifest.profile.provider;
  const events = jsonl(readFileSync(join(directory, 'stdout.jsonl'), 'utf8'));
  const prompt = readFileSync(join(directory, 'prompt.txt'), 'utf8');
  const capture = provider === 'codex' ? loadCodexCapture(directory) : loadClaudeCapture(directory);
  let claudeContext = null;
  if (provider === 'claude') {
    const usage = events.findLast(e => e.type === 'result')?.usage;
    if (capture.responses.length === 1 && !isDeepStrictEqual(capture.responses[0].usage, usage))
      capture.captureIssues.push('claude-final-usage-mismatch');
    if (capture.requests.length === 1) claudeContext = auditClaudeContext(capture.requests[0],
      { prompt, scratch: manifest.scratch, profile: manifest.profile });
  }
  const answer = provider === 'codex'
    ? events.filter(e => e.type === 'item.completed' && e.item?.type === 'agent_message').at(-1)?.item.text
    : events.findLast(e => e.type === 'result')?.result;
  return { answer: typeof answer === 'string' ? answer : null, ...auditControl({ provider, profile: manifest.profile,
    events, processResult, ...capture, tokenizer, claudeContext, transportEvidence, attempt: manifest }) };
}

export function auditProbe(directory, tokenizer, transportEvidence = null) {
  const { answer, ...audit } = auditAttempt(directory, { tokenizer, transportEvidence });
  let probeAnswerMatches = false;
  try {
    const expected = JSON.parse(readFileSync(join(directory, 'prompt.txt'), 'utf8').trim().split('\n').at(-1));
    expected.notes.find(n => n.id === 'b').velocity = 91;
    probeAnswerMatches = isDeepStrictEqual(JSON.parse(answer), expected);
  } catch {}
  return { probeAnswerMatches, ...audit };
}
