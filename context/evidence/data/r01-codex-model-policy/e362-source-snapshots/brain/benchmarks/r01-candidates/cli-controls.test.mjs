import test from 'node:test';
import assert from 'node:assert/strict';
import { PROFILES, invocation } from './cli-controls.mjs';

test('child environment excludes billing credentials and inherited model overrides', () => {
  const inherited = { HOME: '/same/home', CODEX_HOME: '/same/codex', PATH: '/bin',
    OPENAI_API_KEY: 'secret', ANTHROPIC_API_KEY: 'secret', CLAUDE_CODE_OAUTH_TOKEN: 'secret',
    ANTHROPIC_MODEL: 'other', CODEX_ROLLOUT_TRACE_ROOT: '/other', MAX_THINKING_TOKENS: '9999' };
  const before = structuredClone(inherited);
  for (const profile of Object.values(PROFILES)) {
    const { env } = invocation(profile, '/scratch', inherited);
    assert.equal(env.HOME, inherited.HOME);
    assert.equal(env.CODEX_HOME, profile.provider === 'codex' ? '/scratch/codex-home' : inherited.CODEX_HOME);
    for (const key of ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'CLAUDE_CODE_OAUTH_TOKEN', 'ANTHROPIC_MODEL']) assert.equal(env[key], undefined);
  }
  assert.deepEqual(inherited, before);
});

test('historical Claude retains a fixed thinking budget, not adaptive effort', () => {
  const { args, env } = invocation(PROFILES['claude-historical'], '/scratch', {});
  assert.equal(args[args.indexOf('--model') + 1], 'claude-haiku-4-5-20251001');
  assert.equal(env.MAX_THINKING_TOKENS, '1024');
  assert.equal(env.CLAUDE_CODE_MAX_OUTPUT_TOKENS, '12000');
  assert(!args.includes('--effort'));
  assert.throws(() => invocation({ ...PROFILES['claude-historical'], effort: 'low' }, '/scratch', {}));
});

test('current Claude uses adaptive effort without leaking a fixed budget', () => {
  const { args, env } = invocation(PROFILES['claude-current'], '/scratch', { MAX_THINKING_TOKENS: '1024' });
  assert.equal(args[args.indexOf('--effort') + 1], 'low');
  assert.equal(env.MAX_THINKING_TOKENS, undefined);
});

test('Claude invocation disables tools, client fallback and retries and captures local raw bodies', () => {
  const { args, env } = invocation(PROFILES['claude-historical'], '/scratch', {});
  assert.equal(args[args.indexOf('--tools') + 1], '');
  assert.equal(args[args.indexOf('--max-turns') + 1], '1');
  assert.equal(args[args.indexOf('--setting-sources') + 1], '');
  assert.equal(env.CLAUDE_CODE_MAX_RETRIES, '0');
  assert.equal(env.CLAUDE_CODE_DISABLE_NONSTREAMING_FALLBACK, '1');
  assert.equal(env.CLAUDE_CODE_DISABLE_REFUSAL_FALLBACK, '1');
  assert.equal(env.OTEL_LOG_RAW_API_BODIES, 'file:/scratch/api-bodies');
  for (const key of ['OTEL_LOGS_EXPORTER', 'OTEL_METRICS_EXPORTER', 'OTEL_TRACES_EXPORTER']) assert.equal(env[key], 'none');
  for (const option of ['--fallback-model', '--json-schema', '--bare']) assert(!args.includes(option));
});

test('Codex uses subscription auth and fresh restricted context without rejected provider overrides', () => {
  const { args, env } = invocation(PROFILES['codex-current'], '/scratch', {});
  for (const option of ['--ephemeral', '--ignore-user-config', '--ignore-rules', '--strict-config',
    'forced_login_method="chatgpt"', 'skills.include_instructions=false', 'skills.bundled.enabled=false']) assert(args.includes(option));
  assert.equal(args[args.indexOf('--sandbox') + 1], 'read-only');
  assert.equal(args[args.indexOf('--model') + 1], 'gpt-6-luna');
  assert.equal(env.CODEX_ROLLOUT_TRACE_ROOT, '/scratch/codex-traces');
  assert(!args.some(arg => arg.includes('model_providers.openai.')));
});
