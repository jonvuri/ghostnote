// Unscored subscription CLI transport check. One fresh attempt; no automatic retry.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { auditTranscript } from './cli-smoke-audit.mjs';
import { encodeNestedFields, decodeNestedFields } from './nested-fields.mjs';

const [provider, destination, taskPath] = process.argv.slice(2);
if (!['codex', 'claude'].includes(provider) || !destination) {
  throw new Error('Usage: node cli-smoke.mjs codex|claude NEW_OUTPUT_DIRECTORY [NESTED_TASK_JSON]');
}
const taskText = taskPath ? readFileSync(resolve(taskPath), 'utf8') : null;
const task = taskText ? JSON.parse(taskText) : null;
if (task && (task.kind !== 'unscored-nested-fields-development'
    || typeof task.prompt !== 'string'
    || !isDeepStrictEqual(decodeNestedFields(encodeNestedFields(task.expected)), task.expected))) {
  throw new Error('Invalid nested FIELDS development task');
}
const output = resolve(destination);
mkdirSync(output); // Refuse to overwrite an earlier attempt.
const cwd = mkdtempSync(join(tmpdir(), 'r01-cli-smoke-'));
// Inherit local authentication locations, never API credentials or model/provider overrides.
const inheritedNames = ['HOME', 'CODEX_HOME', 'PATH', 'TMPDIR', 'USER', 'LOGNAME',
  'SHELL', 'LANG', 'LC_ALL', 'TERM', 'SSL_CERT_FILE', 'SSL_CERT_DIR',
  'NODE_EXTRA_CA_CERTS', 'HTTPS_PROXY', 'HTTP_PROXY', 'ALL_PROXY', 'NO_PROXY',
  'https_proxy', 'http_proxy', 'all_proxy', 'no_proxy'];
const env = Object.fromEntries(inheritedNames.filter(k => process.env[k] !== undefined)
  .map(k => [k, process.env[k]]));
const initial = { notes: [
  { id: 'a', pitch: 60, at: '3/512', duration: '1', velocity: 90 },
  { id: 'b', pitch: 64, at: '9/512', duration: '7/4', velocity: 84 },
] };
const expected = task?.expected ?? structuredClone(initial);
if (!task) expected.notes[1].velocity = 91;
const prompt = task?.prompt ?? ('This is an unscored transport smoke test using synthetic development data. '
  + 'Do not use tools. Change only the velocity of note b to 91. Preserve every other '
  + 'field and the note order exactly. Return only the complete JSON object, without '
  + 'Markdown or explanation.\n' + JSON.stringify(initial) + '\n');
const hash = value => createHash('sha256').update(value).digest('hex');
const save = (name, value) => writeFileSync(join(output, name), value);
const run = (args, input) => spawnSync(provider, args, {
  cwd, env, input, encoding: 'utf8', timeout: 120_000, maxBuffer: 8 * 1024 * 1024,
  killSignal: 'SIGKILL',
});

try {
  const version = run(['--version']);
  if (version.status !== 0) throw new Error('CLI version check failed');
  const auth = run(provider === 'codex' ? ['login', 'status'] : ['auth', 'status', '--json']);
  let authentication;
  if (provider === 'codex') {
    const ok = auth.status === 0 && /Logged in using ChatGPT/.test(auth.stdout + auth.stderr);
    if (!ok) throw new Error('Expected ChatGPT subscription login');
    authentication = { method: 'chatgpt' };
  } else {
    const info = JSON.parse(auth.stdout);
    if (auth.status !== 0 || !info.loggedIn || info.authMethod !== 'claude.ai') {
      throw new Error('Expected Claude subscription login');
    }
    authentication = Object.fromEntries(['authMethod', 'apiProvider', 'subscriptionType']
      .map(k => [k, info[k]]));
  }
  const model = provider === 'codex' ? 'gpt-6-luna' : 'claude-haiku-5-5';
  const args = provider === 'codex' ? [
    'exec', '--json', '--ephemeral', '--ignore-user-config', '--skip-git-repo-check',
    '--sandbox', 'read-only', '--model', model,
    '-c', 'forced_login_method="chatgpt"', '-c', 'model_provider="openai"',
    '-c', 'model_reasoning_effort="low"', '-c', 'project_doc_max_bytes=0',
    '-c', 'web_search="disabled"', '--enable', 'skip_host_skill_discovery',
    ...['apps', 'plugins', 'remote_plugin', 'hooks', 'multi_agent', 'shell_tool',
      'unified_exec', 'skill_search', 'browser_use', 'browser_use_external',
      'browser_use_full_cdp_access', 'computer_use', 'in_app_browser',
      'image_generation', 'view_image', 'sleep_tool', 'goals', 'shell_snapshot',
      'unbounded_connection_retries', 'workspace_dependencies']
      .flatMap(feature => ['--disable', feature]),
    '-',
  ] : [
    '-p', '--output-format', 'stream-json', '--verbose', '--model', model,
    '--effort', 'low', '--safe-mode', '--tools', '', '--strict-mcp-config',
    '--mcp-config', '{"mcpServers":{}}', '--setting-sources', '',
    '--no-session-persistence', '--permission-mode', 'dontAsk',
    '--permission-prompts', 'none', '--no-chrome', '--disable-slash-commands',
    '--prompt-suggestions', 'false',
  ];
  const manifest = { kind: task?.kind ?? 'unscored-transport-smoke', provider, model,
    version: version.stdout.trim(), authentication, args, inheritedEnvironmentNames:
    Object.keys(env), cwd, promptSha256: hash(prompt), driverSha256:
    hash(readFileSync(new URL(import.meta.url))), auditSha256:
    hash(readFileSync(new URL('./cli-smoke-audit.mjs', import.meta.url))), timeoutMs: 120_000,
    ...(task ? { taskSha256: hash(taskText), codecSha256:
      hash(readFileSync(new URL('./nested-fields.mjs', import.meta.url))), semanticOracleSha256:
      hash(readFileSync(new URL('./structured.mjs', import.meta.url))) } : {}),
    startedAt: new Date().toISOString() };
  save('manifest.json', JSON.stringify(manifest, null, 2) + '\n');
  save('prompt.txt', prompt);
  const start = performance.now();
  const result = run(args, prompt);
  const elapsedMs = performance.now() - start;
  save('stdout.jsonl', result.stdout ?? '');
  save('stderr.txt', result.stderr ?? '');
  const events = [];
  const malformedLines = [];
  for (const line of (result.stdout ?? '').split('\n').filter(Boolean)) {
    try { events.push(JSON.parse(line)); } catch { malformedLines.push(line); }
  }
  const completed = events.findLast(e => e.type === 'turn.completed' || e.type === 'result');
  const init = events.find(e => e.type === 'system' && e.subtype === 'init');
  const messages = events.filter(e => e.type === 'item.completed' && e.item?.type === 'agent_message');
  const answer = provider === 'codex' ? messages.at(-1)?.item.text : completed?.result;
  let answerMatches = false;
  try { answerMatches = isDeepStrictEqual(task ? decodeNestedFields(answer) : JSON.parse(answer), expected); } catch {}
  const audit = auditTranscript(provider, events);
  const summary = { exitCode: result.status, signal: result.signal,
    error: result.error?.message ?? null, elapsedMs, answerMatches,
    malformedLineCount: malformedLines.length, ...audit,
    advertisedTools: init?.tools ?? null, requestedModel: model,
    reportedModels: [...new Set([init?.model, ...events.map(e => e.message?.model),
      ...Object.keys(completed?.modelUsage ?? {})].filter(Boolean))],
    usage: completed?.usage ?? null, modelUsage: completed?.modelUsage ?? null,
    estimatedUsd: completed?.total_cost_usd ?? null,
    completionType: completed?.subtype ?? completed?.type ?? null,
    errors: events.filter(e => ['error', 'turn.failed'].includes(e.type)),
  };
  summary.modelMatchesRequest = summary.reportedModels.length
    ? summary.reportedModels.every(name => name === model) : null;
  save('summary.json', JSON.stringify(summary, null, 2) + '\n');
  console.log(JSON.stringify(summary, null, 2));
  if (result.status !== 0 || !answerMatches || !completed?.usage || !audit.transportClean
      || malformedLines.length || summary.errors.length || summary.modelMatchesRequest === false) process.exitCode = 1;
} finally {
  rmSync(cwd, { recursive: true, force: true });
}
