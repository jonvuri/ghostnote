// Fixed model-visible context for isolated Codex 0.163.0 / Luna (E363).
// Version 2 (D62) accepts a request without the top-level `access_programs`
// field. That field selects the account's cyber access tier and is not
// model-visible text. When present it must still equal the template value.
// Version 3 (E376) compares `reasoning.effort` with the profile's declared
// effort instead of the template's `low`, so a development effort probe is
// audited against its own setting. Every other field is compared as before.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
const sha = value => createHash('sha256').update(value).digest('hex');
const templateText = readFileSync(new URL('./codex-context-template.json', import.meta.url), 'utf8');
const template = JSON.parse(templateText);
export const CODEX_CONTEXT_POLICY = Object.freeze({ schema: 'r01-codex-context-policy-v3',
  cliVersion: 'codex-cli 0.163.0', model: 'gpt-6-luna', templateSha256: sha(templateText),
  volatileFields: ['message IDs', 'turn IDs and creation times', 'scratch cwd and root', 'current date',
    'prompt cache key', 'client transport metadata'],
  // Fields that may be absent; a present value must equal the template's.
  optionalFields: ['access_programs'],
  // The requested reasoning effort must equal the profile's; it then compares as the template's.
  profileFields: ['reasoning.effort'],
});
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;

export function auditCodexContext(request, { prompt, scratch, profile }) {
  const issues = [], normalized = structuredClone(request);
  if (profile?.version !== CODEX_CONTEXT_POLICY.cliVersion || profile?.model !== CODEX_CONTEXT_POLICY.model)
    issues.push('codex-context-policy-profile-mismatch');
  // These fields carry transport attribution, not model-visible instructions.
  if (!UUID.test(normalized.prompt_cache_key ?? '') || !normalized.client_metadata
      || typeof normalized.client_metadata !== 'object') issues.push('unexpected-codex-transport-metadata');
  delete normalized.prompt_cache_key; delete normalized.client_metadata;
  // D57 observes provider limits without making them context/admission gates.
  delete normalized.max_output_tokens;
  // D62: an absent optional field is reported, not failed; a present one is compared.
  const absentOptionalFields = CODEX_CONTEXT_POLICY.optionalFields.filter(key => !Object.hasOwn(normalized, key));
  for (const key of absentOptionalFields) normalized[key] = structuredClone(template[key]);
  if (normalized.reasoning?.effort !== profile?.effort) issues.push('codex-reasoning-effort-mismatch');
  else if (normalized.reasoning) normalized.reasoning.effort = template.reasoning.effort;
  const blocks = [];
  for (const [i, message] of (Array.isArray(normalized.input) ? normalized.input : []).entries()) {
    if (!/^(?:msg|at)_[0-9a-f-]{36}$/.test(message.id ?? '')) issues.push('unexpected-codex-message-id');
    delete message.id;
    const meta = message.internal_chat_message_metadata_passthrough;
    if (meta && Object.hasOwn(meta, 'turn_id')) {
      if (!UUID.test(meta.turn_id) || !Number.isFinite(meta.create_time)) issues.push('unexpected-codex-message-metadata');
      delete meta.turn_id; delete meta.create_time;
    }
    const kind = meta?.content_item_kinds?.[0] ?? message.type;
    const content = message.content?.[0];
    if (kind === 'environments.environment_context' && typeof content?.text === 'string') {
      const allowed = [scratch, scratch?.startsWith('/private/') ? scratch.slice(8) : `/private${scratch}`];
      const cwd = content.text.match(/<cwd>([^<]+)<\/cwd>/)?.[1];
      const root = content.text.match(/<root>([^<]+)<\/root>/)?.[1];
      if (!scratch || !allowed.includes(cwd) || root !== cwd) issues.push('codex-environment-cwd-mismatch');
      content.text = content.text.replace(/<cwd>[^<]+<\/cwd>/, '<cwd>{scratch}</cwd>')
        .replace(/<root>[^<]+<\/root>/, '<root>{scratch}</root>')
        .replace(/<current_date>\d{4}-\d{2}-\d{2}<\/current_date>/, '<current_date>{date}</current_date>');
    }
    if (kind === 'user.text') {
      if (content?.text !== prompt) issues.push('codex-delivered-task-mismatch');
      if (content) content.text = '{prompt}';
    }
    blocks.push({ kind, bytes: Buffer.byteLength(JSON.stringify(request.input[i])),
      sha256: sha(JSON.stringify(request.input[i])) });
  }
  if (!isDeepStrictEqual(normalized, template)) issues.push('unexpected-codex-context');
  return { policy: CODEX_CONTEXT_POLICY.schema, policySha256: CODEX_CONTEXT_POLICY.templateSha256,
    pass: issues.length === 0, issues: [...new Set(issues)], absentOptionalFields,
    reasoningEffort: request.reasoning?.effort ?? null, blocks,
    clientAddedContextBytes: blocks.filter(b => b.kind !== 'user.text').reduce((n, b) => n + b.bytes, 0),
    taskBytes: Buffer.byteLength(prompt ?? '') };
}
