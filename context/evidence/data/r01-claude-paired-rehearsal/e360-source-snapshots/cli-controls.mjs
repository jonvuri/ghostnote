// Research-only controls, separate from the historical E355 smoke driver.
import assert from 'node:assert/strict';
import { join } from 'node:path';

export const SYSTEM = 'Complete the supplied offline music-format task. Use only the supplied data. Do not use tools. Return exactly the requested answer, without explanation or Markdown fences.';
export const PROFILES = {
  'codex-historical': { provider: 'codex', model: 'gpt-5.4-mini-2026-03-17', effort: 'low', version: 'codex-cli 0.163.0' },
  'codex-current': { provider: 'codex', model: 'gpt-6-luna', effort: 'low', version: 'codex-cli 0.163.0' },
  'claude-historical': { provider: 'claude', model: 'claude-haiku-4-5-20251001', thinkingBudget: 1024, maxOutputTokens: 12000, version: '2.1.302 (Claude Code)' },
  'claude-current': { provider: 'claude', model: 'claude-haiku-5-5', effort: 'low', maxOutputTokens: 12000, version: '2.1.302 (Claude Code)' },
};
export const INHERITED_NAMES = ['HOME', 'CODEX_HOME', 'PATH', 'TMPDIR', 'USER', 'LOGNAME',
  'SHELL', 'LANG', 'LC_ALL', 'TERM', 'SSL_CERT_FILE', 'SSL_CERT_DIR', 'NODE_EXTRA_CA_CERTS',
  'HTTPS_PROXY', 'HTTP_PROXY', 'ALL_PROXY', 'NO_PROXY', 'https_proxy', 'http_proxy', 'all_proxy', 'no_proxy'];
const disabled = ['apps', 'plugins', 'remote_plugin', 'hooks', 'multi_agent', 'shell_tool',
  'unified_exec', 'skill_search', 'browser_use', 'browser_use_external', 'browser_use_full_cdp_access',
  'computer_use', 'in_app_browser', 'image_generation', 'view_image', 'sleep_tool', 'goals',
  'shell_snapshot', 'unbounded_connection_retries', 'workspace_dependencies', 'fast_mode'];

export function invocation(profile, scratch, inherited = process.env) {
  assert(['codex', 'claude'].includes(profile.provider));
  assert(typeof profile.model === 'string' && profile.model.length > 0);
  const env = Object.fromEntries(INHERITED_NAMES.filter(k => inherited[k] !== undefined).map(k => [k, inherited[k]]));
  let args;
  if (profile.provider === 'codex') {
    args = ['exec', '--json', '--ephemeral', '--ignore-user-config', '--ignore-rules', '--strict-config',
      '--skip-git-repo-check', '--sandbox', 'read-only', '--color', 'never', '--model', profile.model,
      '-c', 'forced_login_method="chatgpt"', '-c', 'model_provider="openai"',
      '-c', `model_reasoning_effort=${JSON.stringify(profile.effort)}`,
      '-c', `model_instructions_file=${JSON.stringify(join(scratch, 'system.txt'))}`,
      '-c', 'skills.include_instructions=false', '-c', 'skills.bundled.enabled=false',
      '-c', 'project_doc_max_bytes=0', '-c', 'web_search="disabled"',
      '-c', 'analytics.enabled=false', '-c', 'otel.metrics_exporter="none"',
      '--enable', 'skip_host_skill_discovery', ...disabled.flatMap(f => ['--disable', f]), '-'];
    // Present in the pinned binary; verify emitted artifacts, never assume capture.
    env.CODEX_ROLLOUT_TRACE_ROOT = join(scratch, 'codex-traces');
    env.RUST_LOG = 'codex_api::sse::responses=trace';
  } else {
    args = ['-p', '--output-format', 'stream-json', '--verbose', '--model', profile.model,
      '--system-prompt', SYSTEM, '--safe-mode', '--tools', '', '--strict-mcp-config',
      '--mcp-config', '{"mcpServers":{}}', '--setting-sources', '', '--no-session-persistence',
      '--permission-mode', 'dontAsk', '--permission-prompts', 'none', '--no-chrome',
      '--disable-slash-commands', '--prompt-suggestions', 'false', '--max-turns', '1'];
    if (profile.thinkingBudget !== undefined) {
      assert(Number.isInteger(profile.thinkingBudget) && profile.thinkingBudget >= 1024);
      assert.equal(profile.effort, undefined, 'fixed and adaptive thinking must not be conflated');
      args.push('--settings', '{"alwaysThinkingEnabled":true}');
      env.MAX_THINKING_TOKENS = String(profile.thinkingBudget);
    } else args.push('--effort', profile.effort);
    Object.assign(env, { CLAUDE_CODE_MAX_OUTPUT_TOKENS: String(profile.maxOutputTokens),
      CLAUDE_CODE_MAX_RETRIES: '0', CLAUDE_CODE_RETRY_WATCHDOG: '0',
      CLAUDE_CODE_DISABLE_NONSTREAMING_FALLBACK: '1', CLAUDE_CODE_DISABLE_REFUSAL_FALLBACK: '1',
      CLAUDE_CODE_DISABLE_TERMINAL_TITLE: '1', DISABLE_UPDATES: '1',
      CLAUDE_CODE_ENABLE_TELEMETRY: '1', OTEL_LOG_RAW_API_BODIES: `file:${join(scratch, 'api-bodies')}`,
      OTEL_LOGS_EXPORTER: 'none', OTEL_METRICS_EXPORTER: 'none', OTEL_TRACES_EXPORTER: 'none' });
  }
  return { args, env };
}
