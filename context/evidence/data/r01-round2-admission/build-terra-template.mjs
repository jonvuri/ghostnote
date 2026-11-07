// Build the gpt-5.6-terra context template from its admission probe's one captured
// request, with the same normalization auditCodexContext applies (E380).
// Run from the repository root: node context/evidence/data/r01-round2-admission/build-terra-template.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { loadCodexCapture } from '../../../../brain/benchmarks/r01-candidates/cli-control-audit.mjs';
const dir = new URL('./probe-codex-terra/', import.meta.url).pathname;
const manifest = JSON.parse(readFileSync(dir + 'manifest.json', 'utf8'));
const prompt = readFileSync(dir + 'prompt.txt', 'utf8');
const { requests } = loadCodexCapture(dir);
if (requests.length !== 1) throw new Error('expected one captured request');
const r = structuredClone(requests[0]);
delete r.prompt_cache_key; delete r.client_metadata; delete r.max_output_tokens;
for (const m of r.input) {
  delete m.id;
  const meta = m.internal_chat_message_metadata_passthrough;
  if (meta) { delete meta.turn_id; delete meta.create_time; }
  const kind = meta?.content_item_kinds?.[0] ?? m.type, content = m.content?.[0];
  if (kind === 'environments.environment_context') {
    const cwd = content.text.match(/<cwd>([^<]+)<\/cwd>/)[1];
    if (![manifest.scratch, `/private${manifest.scratch}`].includes(cwd)) throw new Error('cwd mismatch');
    content.text = content.text.replace(/<cwd>[^<]+<\/cwd>/, '<cwd>{scratch}</cwd>')
      .replace(/<root>[^<]+<\/root>/, '<root>{scratch}</root>')
      .replace(/<current_date>\d{4}-\d{2}-\d{2}<\/current_date>/, '<current_date>{date}</current_date>');
  }
  if (kind === 'user.text') { if (content.text !== prompt) throw new Error('prompt mismatch'); content.text = '{prompt}'; }
}
if (r.model !== manifest.profile.model || r.reasoning?.effort !== manifest.profile.effort) throw new Error('profile mismatch');
r.reasoning.effort = 'low';
writeFileSync(new URL('../../../../brain/benchmarks/r01-candidates/codex-context-template-gpt-5.6-terra.json', import.meta.url),
  JSON.stringify(r, null, 2) + '\n');
