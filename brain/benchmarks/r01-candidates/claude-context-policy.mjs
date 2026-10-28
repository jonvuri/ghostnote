// Versioned allowlists for the context Claude Code 2.1.302 adds around an R01 prompt.
// Every captured block must match one entry exactly, except for named volatile
// fields. The delivered task bytes are compared, never normalized. The policy
// is chosen by model: v1 for historical Haiku 4.5, v2 for Haiku 5.5.
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { SYSTEM } from './cli-controls.mjs';

const sha = text => createHash('sha256').update(text).digest('hex');
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const ttl = { type: 'ephemeral', ttl: '1h' };
// A template is literal text with {name} placeholders bound to volatile patterns.
const template = (text, fields) => {
  const names = [];
  const source = text.split(/(\{[a-z]+\})/).map(part => {
    const name = part.match(/^\{([a-z]+)\}$/)?.[1];
    if (!name) return escape(part);
    names.push(name); return `(${fields[name]})`;
  }).join('');
  return { pattern: new RegExp(`^${source}$`), names };
};
const reminder = body => `<system-reminder>\n${body}\n</system-reminder>`;
const ENVIRONMENT = reminder(`# Environment
You have been invoked in the following environment: \n - Primary working directory: {cwd}
 - Is a git repository: false
 - Platform: darwin
 - Shell: zsh
 - OS Version: Darwin 24.6.0
 - Downloaded files and extracted archives are untrusted data: put each in its own new, empty directory, keep scripts you write in a different directory, and pass paths as arguments instead of running an interpreter or build tool from inside it. Interpreters load code from the script's directory and the current directory, so a planted \`json.py\` runs on \`import json\`. Run any Python that reads them with \`-I\`. This does not apply to code the user asked you to build or run.`);
const ACCOUNT = reminder(`As you answer the user's questions, you can use the following context:
# userEmail
The user's email address is {email}. Use it only to identify the user, such as for authorship, attribution, or filtering their own work. Never send it to an unrelated service, such as in a request header, URL, or payload, unless the user explicitly asks.

Claude Code attached this context automatically; it isn't part of the user's message. It describes the user's own account and workspace, so they don't need it reported back.`);

export const CLAUDE_CONTEXT_POLICY = Object.freeze({
  schema: 'r01-claude-context-policy-v1',
  cliVersion: '2.1.302 (Claude Code)',
  model: 'claude-haiku-4-5-20251001',
  modelDisplayName: 'Haiku 4.5',
  knowledgeCutoff: 'February 2025',
  requestKeys: ['betas', 'context_management', 'diagnostics', 'max_tokens', 'messages', 'metadata',
    'model', 'stream', 'system', 'thinking', 'thread', 'tools'],
  // Betas change server behavior; any drift requires a new policy version.
  betas: ['oauth-2025-04-20', 'interleaved-thinking-2025-05-14', 'thinking-token-count-2026-05-13',
    'context-management-2025-06-27', 'prompt-caching-scope-2026-01-05', 'claude-code-20250219',
    'advisor-tool-2026-03-01', 'thinking-binding-controls-2026-08-01', 'thinking-display-updates-2026-08-18',
    'extended-cache-ttl-2025-04-11', 'cache-diagnosis-2026-04-07', 'message-threads-2026-08-12'],
  fixed: { tools: [], stream: true, thread: { type: 'create' }, diagnostics: { previous_message_id: null },
    context_management: { edits: [{ type: 'clear_thinking_20251015', keep: 'all' }] } },
  volatileFields: {
    'system.billing.versionSuffix': 'three lowercase hex characters after cc_version',
    'system.billing.promptId': 'per-invocation UUID',
    'metadata.user_id': 'JSON object with exactly device_id (64 hex), account_uuid and session_id (UUIDs)',
    'reminder.environment.cwd': 'must equal the attempt scratch directory (or its /private alias)',
    'reminder.account.email': 'account email; retained only as a SHA-256 in audit reports',
    'reminder.date.date': 'ISO calendar date supplied by the client',
  },
});

const SYSTEM_BLOCKS = [
  { kind: 'billing-metadata', ...template('x-anthropic-billing-header: cc_version=2.1.302.{suffix}; cc_entrypoint=sdk-cli; cch=00000; cc_prompt_id={prompt}; cc_turn_origin=sdk; cc_prompt_index=0; cc_turn_index=1;',
    { suffix: '[0-9a-f]{3}', prompt: UUID }), cacheControl: undefined },
  { kind: 'sdk-identity', ...template("You are a Claude agent, built on Anthropic's Claude Agent SDK.", {}), cacheControl: ttl },
  { kind: 'supplied-instruction', ...template(SYSTEM, {}), cacheControl: ttl },
];
const USER_BLOCKS = [
  { kind: 'environment', ...template(ENVIRONMENT, { cwd: '/[^\n]+' }) },
  { kind: 'model-identity', ...template(reminder(`You are powered by the model named ${CLAUDE_CONTEXT_POLICY.modelDisplayName}. The exact model ID is ${CLAUDE_CONTEXT_POLICY.model}. Assistant knowledge cutoff is ${CLAUDE_CONTEXT_POLICY.knowledgeCutoff}.`), {}) },
  { kind: 'token-budget', ...template(reminder('<total_tokens>15000000 tokens left</total_tokens>'), {}) },
  { kind: 'account', ...template(ACCOUNT, { email: '[^\\s@]+@[^\\s@]+\\.[^\\s@.]+' }) },
  { kind: 'date', ...template(reminder("Today's date is {date}.") + '\n', { date: '\\d{4}-\\d{2}-\\d{2}' }) },
];
export const CLAUDE_CONTEXT_POLICY_SHA256 = sha(JSON.stringify({ ...CLAUDE_CONTEXT_POLICY,
  system: SYSTEM_BLOCKS.map(b => [b.kind, String(b.pattern), b.cacheControl ?? null]),
  user: USER_BLOCKS.map(b => [b.kind, String(b.pattern)]) }));

function match(entry, block) {
  if (block?.type !== 'text' || typeof block.text !== 'string') return null;
  const found = entry.pattern.exec(block.text);
  return found ? Object.fromEntries(entry.names.map((n, i) => [n, found[i + 1]])) : null;
}
const keys = value => Object.keys(value ?? {}).sort();

/**
 * Audit one captured request against the policy. `prompt` is the exact text
 * delivered on stdin; `scratch` is the attempt's working directory.
 */
export function auditClaudeContext(request, options) {
  const model = options?.profile?.model;
  if (model === CLAUDE_CONTEXT_POLICY_V2.model) return auditClaudeContextV2(request, options);
  return auditClaudeContextV1(request, options);
}

function auditClaudeContextV1(request, { prompt, scratch, profile }) {
  const issues = [], blocks = [], volatile = {};
  const add = (kind, text, role) => blocks.push({ kind, role, bytes: Buffer.byteLength(text), sha256: sha(text) });
  if (!isDeepStrictEqual(keys(request), CLAUDE_CONTEXT_POLICY.requestKeys)) issues.push('unexpected-claude-request-fields');
  if (profile?.model !== CLAUDE_CONTEXT_POLICY.model || request?.model !== CLAUDE_CONTEXT_POLICY.model) issues.push('claude-context-policy-model-mismatch');
  if (!isDeepStrictEqual(request?.betas, CLAUDE_CONTEXT_POLICY.betas)) issues.push('unexpected-claude-betas');
  for (const [key, value] of Object.entries(CLAUDE_CONTEXT_POLICY.fixed))
    if (!isDeepStrictEqual(request?.[key], value)) issues.push(`unexpected-claude-${key.replace('_', '-')}`);
  try {
    const user = JSON.parse(request.metadata.user_id);
    if (!isDeepStrictEqual(keys(request.metadata), ['user_id']) || !isDeepStrictEqual(keys(user), ['account_uuid', 'device_id', 'session_id'])
        || !/^[0-9a-f]{64}$/.test(user.device_id) || !new RegExp(`^${UUID}$`).test(user.account_uuid)
        || !new RegExp(`^${UUID}$`).test(user.session_id)) throw new Error();
    volatile.sessionId = user.session_id;
  } catch { issues.push('unexpected-claude-metadata'); }
  const system = Array.isArray(request?.system) ? request.system : [];
  if (system.length !== SYSTEM_BLOCKS.length) issues.push('unexpected-claude-system-block-count');
  SYSTEM_BLOCKS.forEach((entry, i) => {
    const block = system[i], fields = match(entry, block);
    if (!fields || !isDeepStrictEqual(keys(block), entry.cacheControl ? ['cache_control', 'text', 'type'] : ['text', 'type'])
        || !isDeepStrictEqual(block.cache_control, entry.cacheControl)) { issues.push(`unexpected-claude-system-${entry.kind}`); return; }
    if (entry.kind === 'billing-metadata') Object.assign(volatile, { versionSuffix: fields.suffix, promptId: fields.prompt });
    add(entry.kind, block.text, 'client-system');
  });
  const messages = Array.isArray(request?.messages) ? request.messages : [];
  const content = messages.length === 1 && messages[0].role === 'user' && Array.isArray(messages[0].content) ? messages[0].content : null;
  if (!content || !isDeepStrictEqual(keys(messages[0]), ['content', 'role'])) issues.push('unexpected-claude-message-structure');
  const parts = content ?? [];
  if (parts.length !== USER_BLOCKS.length + 1) issues.push('unexpected-claude-user-block-count');
  USER_BLOCKS.forEach((entry, i) => {
    const block = parts[i], fields = match(entry, block);
    if (!fields || !isDeepStrictEqual(keys(block), ['text', 'type'])) { issues.push(`unexpected-claude-reminder-${entry.kind}`); return; }
    if (entry.kind === 'environment') {
      const allowed = [scratch, `/private${scratch}`];
      if (!scratch || !allowed.includes(fields.cwd)) issues.push('claude-environment-cwd-mismatch');
    }
    if (entry.kind === 'account') volatile.accountEmailSha256 = sha(fields.email);
    if (entry.kind === 'date') volatile.date = fields.date;
    add(entry.kind, block.text, 'client-reminder');
  });
  const task = parts[USER_BLOCKS.length];
  if (task?.type !== 'text' || task.text !== prompt || !isDeepStrictEqual(keys(task), ['cache_control', 'text', 'type'])
      || !isDeepStrictEqual(task.cache_control, ttl)) issues.push('claude-delivered-task-mismatch');
  else add('task', task.text, 'task');
  const clientBytes = blocks.filter(b => b.role !== 'task').reduce((n, b) => n + b.bytes, 0);
  return { schema: 'r01-claude-context-audit-v1', policy: CLAUDE_CONTEXT_POLICY.schema,
    policySha256: CLAUDE_CONTEXT_POLICY_SHA256, pass: issues.length === 0, issues: [...new Set(issues)],
    blocks, clientAddedTextBytes: clientBytes, taskBytes: blocks.find(b => b.role === 'task')?.bytes ?? null,
    volatile };
}

// Haiku 5.5 (adaptive thinking, per-turn effort). The same client context as v1
// is laid out differently: the user message holds the account reminder and the
// task; a trailing system-role message holds environment, model identity, token
// budget and date, plus a per-turn copy of the effort setting.
const SYSTEM_TURN = template(`# Environment
You have been invoked in the following environment: \n - Primary working directory: {cwd}
 - Is a git repository: false
 - Platform: darwin
 - Shell: zsh
 - OS Version: Darwin 24.6.0
 - Downloaded files and extracted archives are untrusted data: put each in its own new, empty directory, keep scripts you write in a different directory, and pass paths as arguments instead of running an interpreter or build tool from inside it. Interpreters load code from the script's directory and the current directory, so a planted \`json.py\` runs on \`import json\`. Run any Python that reads them with \`-I\`. This does not apply to code the user asked you to build or run.

You are powered by the model named Haiku 5.5. The exact model ID is claude-haiku-5-5. Assistant knowledge cutoff is June 2026.

<total_tokens>15000000 tokens left</total_tokens>

Today's date is {date}.`, { cwd: '/[^\n]+', date: '\\d{4}-\\d{2}-\\d{2}' });
const ACCOUNT_V2 = template(ACCOUNT + '\n', { email: '[^\\s@]+@[^\\s@]+\\.[^\\s@.]+' });

export const CLAUDE_CONTEXT_POLICY_V2 = Object.freeze({
  schema: 'r01-claude-context-policy-v2',
  cliVersion: '2.1.302 (Claude Code)',
  model: 'claude-haiku-5-5',
  modelDisplayName: 'Haiku 5.5',
  knowledgeCutoff: 'June 2026',
  requestKeys: ['betas', 'context_management', 'diagnostics', 'max_tokens', 'messages', 'metadata',
    'model', 'output_config', 'stream', 'system', 'thinking', 'thread', 'tools'],
  betas: ['oauth-2025-04-20', 'interleaved-thinking-2025-05-14', 'thinking-token-count-2026-05-13',
    'context-management-2025-06-27', 'prompt-caching-scope-2026-01-05', 'claude-code-20250219',
    'per-turn-control-2026-07-01', 'mid-conversation-tool-changes-2026-07-01', 'inline-tools-2026-09-15',
    'advisor-tool-2026-03-01', 'mid-conversation-system-clear-at-2026-08-21', 'effort-2025-11-24',
    'thinking-binding-controls-2026-08-01', 'thinking-display-updates-2026-08-18',
    'extended-cache-ttl-2025-04-11', 'cache-diagnosis-2026-04-07', 'message-threads-2026-08-12'],
  // max_tokens is the client default and is observed, not pinned (D57).
  // output_config must equal { effort: profile.effort } at request and turn level.
  fixed: { tools: [], stream: true, thread: { type: 'create' }, diagnostics: { previous_message_id: null },
    thinking: { type: 'adaptive', display: 'updates' },
    context_management: { edits: [{ type: 'clear_thinking_20251015', keep: 'all' }] } },
  volatileFields: {
    'system.billing.versionSuffix': 'three lowercase hex characters after cc_version',
    'system.billing.promptId': 'per-invocation UUID',
    'metadata.user_id': 'JSON object with exactly device_id (64 hex), account_uuid and session_id (UUIDs)',
    'systemTurn.cwd': 'must equal the attempt scratch directory (or its /private alias)',
    'reminder.account.email': 'account email; retained only as a SHA-256 in audit reports',
    'systemTurn.date': 'ISO calendar date supplied by the client',
  },
});
export const CLAUDE_CONTEXT_POLICY_V2_SHA256 = sha(JSON.stringify({ ...CLAUDE_CONTEXT_POLICY_V2,
  system: SYSTEM_BLOCKS.map(b => [b.kind, String(b.pattern), b.cacheControl ?? null]),
  user: [['account', String(ACCOUNT_V2.pattern)]], systemTurn: String(SYSTEM_TURN.pattern) }));

/** Select the policy that governs a profile's model; null when none is admitted. */
export function claudeContextPolicyFor(model) {
  return model === CLAUDE_CONTEXT_POLICY.model ? { policy: CLAUDE_CONTEXT_POLICY, sha256: CLAUDE_CONTEXT_POLICY_SHA256 }
    : model === CLAUDE_CONTEXT_POLICY_V2.model ? { policy: CLAUDE_CONTEXT_POLICY_V2, sha256: CLAUDE_CONTEXT_POLICY_V2_SHA256 }
      : null;
}

function auditClaudeContextV2(request, { prompt, scratch, profile }) {
  const P = CLAUDE_CONTEXT_POLICY_V2, issues = [], blocks = [], volatile = {};
  const add = (kind, text, role) => blocks.push({ kind, role, bytes: Buffer.byteLength(text), sha256: sha(text) });
  if (!isDeepStrictEqual(keys(request), P.requestKeys)) issues.push('unexpected-claude-request-fields');
  if (profile?.model !== P.model || request?.model !== P.model) issues.push('claude-context-policy-model-mismatch');
  if (!isDeepStrictEqual(request?.betas, P.betas)) issues.push('unexpected-claude-betas');
  for (const [key, value] of Object.entries(P.fixed))
    if (!isDeepStrictEqual(request?.[key], value)) issues.push(`unexpected-claude-${key.replace('_', '-')}`);
  const outputConfig = { effort: profile?.effort };
  if (!isDeepStrictEqual(request?.output_config, outputConfig)) issues.push('unexpected-claude-output-config');
  try {
    const user = JSON.parse(request.metadata.user_id);
    if (!isDeepStrictEqual(keys(request.metadata), ['user_id']) || !isDeepStrictEqual(keys(user), ['account_uuid', 'device_id', 'session_id'])
        || !/^[0-9a-f]{64}$/.test(user.device_id) || !new RegExp(`^${UUID}$`).test(user.account_uuid)
        || !new RegExp(`^${UUID}$`).test(user.session_id)) throw new Error();
    volatile.sessionId = user.session_id;
  } catch { issues.push('unexpected-claude-metadata'); }
  const system = Array.isArray(request?.system) ? request.system : [];
  if (system.length !== SYSTEM_BLOCKS.length) issues.push('unexpected-claude-system-block-count');
  SYSTEM_BLOCKS.forEach((entry, i) => {
    const block = system[i], fields = match(entry, block);
    if (!fields || !isDeepStrictEqual(keys(block), entry.cacheControl ? ['cache_control', 'text', 'type'] : ['text', 'type'])
        || !isDeepStrictEqual(block.cache_control, entry.cacheControl)) { issues.push(`unexpected-claude-system-${entry.kind}`); return; }
    if (entry.kind === 'billing-metadata') Object.assign(volatile, { versionSuffix: fields.suffix, promptId: fields.prompt });
    add(entry.kind, block.text, 'client-system');
  });
  const messages = Array.isArray(request?.messages) ? request.messages : [];
  const [userTurn, systemTurn] = messages;
  if (messages.length !== 2 || userTurn?.role !== 'user' || !isDeepStrictEqual(keys(userTurn), ['content', 'role'])
      || !Array.isArray(userTurn.content) || systemTurn?.role !== 'system'
      || !isDeepStrictEqual(keys(systemTurn), ['content', 'output_config', 'role']) || !Array.isArray(systemTurn.content))
    issues.push('unexpected-claude-message-structure');
  const parts = Array.isArray(userTurn?.content) ? userTurn.content : [];
  if (parts.length !== 2) issues.push('unexpected-claude-user-block-count');
  const account = match(ACCOUNT_V2, parts[0]);
  if (!account || !isDeepStrictEqual(keys(parts[0]), ['text', 'type'])) issues.push('unexpected-claude-reminder-account');
  else { volatile.accountEmailSha256 = sha(account.email); add('account', parts[0].text, 'client-reminder'); }
  const task = parts[1];
  if (task?.type !== 'text' || task.text !== prompt || !isDeepStrictEqual(keys(task), ['text', 'type']))
    issues.push('claude-delivered-task-mismatch');
  else add('task', task.text, 'task');
  const turnParts = Array.isArray(systemTurn?.content) ? systemTurn.content : [];
  const turn = turnParts.length === 1 ? match(SYSTEM_TURN, turnParts[0]) : null;
  if (!turn || !isDeepStrictEqual(keys(turnParts[0]), ['cache_control', 'text', 'type'])
      || !isDeepStrictEqual(turnParts[0].cache_control, ttl)) issues.push('unexpected-claude-system-turn');
  else {
    if (!scratch || ![scratch, `/private${scratch}`].includes(turn.cwd)) issues.push('claude-environment-cwd-mismatch');
    volatile.date = turn.date;
    add('system-turn', turnParts[0].text, 'client-system-turn');
  }
  if (!isDeepStrictEqual(systemTurn?.output_config, outputConfig)) issues.push('unexpected-claude-turn-output-config');
  const clientBytes = blocks.filter(b => b.role !== 'task').reduce((n, b) => n + b.bytes, 0);
  return { schema: 'r01-claude-context-audit-v1', policy: P.schema,
    policySha256: CLAUDE_CONTEXT_POLICY_V2_SHA256, pass: issues.length === 0, issues: [...new Set(issues)],
    blocks, clientAddedTextBytes: clientBytes, taskBytes: blocks.find(b => b.role === 'task')?.bytes ?? null,
    maxTokens: request?.max_tokens ?? null, volatile };
}
