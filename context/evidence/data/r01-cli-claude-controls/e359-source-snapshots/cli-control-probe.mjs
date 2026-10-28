// Explicit bounded external probe. One invocation; never retries or changes model.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, cpSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { SYSTEM, PROFILES, invocation, INHERITED_NAMES } from './cli-controls.mjs';

const [profileId, outputArg, creditsEvidence] = process.argv.slice(2);
assert(PROFILES[profileId] && outputArg, 'usage: node cli-control-probe.mjs PROFILE NEW_OUTPUT_DIRECTORY [CLAUDE_CREDITS_CONFIRMATION_FILE]');
const profile = PROFILES[profileId], output = resolve(outputArg);
// Account billing is distinct from API-key exclusion. Preserve the actual reply.
if (profile.provider === 'claude') {
  assert(creditsEvidence, 'Claude probe needs the retained operator confirmation that usage credits are disabled');
  const confirmation = JSON.parse(readFileSync(resolve(creditsEvidence), 'utf8'));
  assert.equal(confirmation.usageCreditsDisabled, true);
  assert(typeof confirmation.operatorReply === 'string' && confirmation.operatorReply.trim());
}
mkdirSync(output);
const scratch = mkdtempSync(join(tmpdir(), 'r01-cli-control-'));
const prompt = 'Change only the velocity of note b to 91. Return only the complete JSON object.\n'
  + '{"notes":[{"id":"a","pitch":60,"at":"3/512","duration":"1","velocity":90},{"id":"b","pitch":64,"at":"9/512","duration":"7/4","velocity":84}]}\n';
const sha = b => createHash('sha256').update(b).digest('hex');
const save = (path, value) => writeFileSync(join(output, path), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n');
const { args, env } = invocation(profile, scratch);
const run = (argv, input) => spawnSync(profile.provider, argv, { cwd: scratch, env, input, encoding: 'utf8',
  timeout: 120000, maxBuffer: 32 * 1024 * 1024, killSignal: 'SIGKILL' });
try {
  writeFileSync(join(scratch, 'system.txt'), SYSTEM);
  const version = run(['--version']);
  assert.equal(version.status, 0); assert.equal(version.stdout.trim(), profile.version, 'CLI version drift');
  const auth = run(profile.provider === 'codex' ? ['login', 'status'] : ['auth', 'status', '--json']);
  let authentication;
  if (profile.provider === 'codex') {
    assert(auth.status === 0 && /Logged in using ChatGPT/.test(auth.stdout + auth.stderr), 'subscription authentication required');
    authentication = { method: 'chatgpt' };
  } else {
    const parsed = JSON.parse(auth.stdout);
    assert(auth.status === 0 && parsed.loggedIn && parsed.authMethod === 'claude.ai' && parsed.apiProvider === 'firstParty', 'subscription first-party authentication required');
    authentication = Object.fromEntries(['authMethod', 'apiProvider', 'subscriptionType'].map(k => [k, parsed[k]]));
  }
  save('manifest.json', { schema: 'r01-cli-control-probe-v1', kind: 'unscored-control-probe', profileId, profile,
    authentication, args, inheritedEnvironmentNames: INHERITED_NAMES.filter(k => env[k] !== undefined),
    explicitEnvironment: Object.fromEntries(Object.entries(env).filter(([k]) => !INHERITED_NAMES.includes(k))),
    scratch, timeoutMs: 120000, wrapperRetries: 0, promptSha256: sha(prompt), systemSha256: sha(SYSTEM),
    startedAt: new Date().toISOString(), sources: ['cli-controls.mjs', 'cli-control-probe.mjs'].map(path => ({ path, sha256: sha(readFileSync(new URL(path, import.meta.url))) })),
    ...(creditsEvidence ? { usageCreditsConfirmation: JSON.parse(readFileSync(resolve(creditsEvidence), 'utf8')) } : {}) });
  save('prompt.txt', prompt); save('system.txt', SYSTEM);
  const start = performance.now(), result = run(args, prompt);
  save('stdout.jsonl', result.stdout ?? ''); save('stderr.txt', result.stderr ?? '');
  for (const name of ['codex-traces', 'api-bodies']) if (existsSync(join(scratch, name))) cpSync(join(scratch, name), join(output, name), { recursive: true });
  const processResult = { exitCode: result.status, signal: result.signal, error: result.error?.message ?? null,
    elapsedMs: performance.now() - start, controlAuditRequired: true };
  save('process.json', processResult); console.log(JSON.stringify(processResult));
  if (result.status !== 0) process.exitCode = 1;
} finally { rmSync(scratch, { recursive: true, force: true }); }
