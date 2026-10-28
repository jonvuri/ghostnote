// One pinned CLI invocation with raw capture. No retry, repair or fallback.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, cpSync, existsSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';
import { SYSTEM, invocation, INHERITED_NAMES } from './cli-controls.mjs';
import { prepareCodexHome } from './codex-isolation.mjs';

export const sha = value => createHash('sha256').update(value).digest('hex');
const save = (dir, path, value) => writeFileSync(join(dir, path),
  typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n');

/** Resolve the executable PATH would run, then pin its real file and hash. */
export function resolveBinary(name, path = process.env.PATH ?? '') {
  for (const dir of path.split(delimiter).filter(Boolean)) {
    const candidate = join(dir, name);
    if (!existsSync(candidate)) continue;
    const real = realpathSync(candidate);
    return { name, path: candidate, realPath: real, sha256: sha(readFileSync(real)) };
  }
  throw new Error(`${name} not found on PATH`);
}

/**
 * Run one attempt in a fresh scratch directory and retain its raw outputs in
 * `output`, which must not exist. `envOverrides` is for local fault tests only.
 */
export function runCliAttempt({ profile, binary, prompt, output, timeoutMs = 120000, envOverrides = {}, deleteEnv = [], meta = {} }) {
  if (typeof prompt !== 'string' || !prompt.length) throw new Error('prompt required');
  if (sha(readFileSync(binary.realPath)) !== binary.sha256) throw new Error('CLI binary changed since it was pinned');
  mkdirSync(output); // Refuse to overwrite an earlier attempt.
  const scratch = mkdtempSync(join(tmpdir(), 'r01-cli-attempt-'));
  try {
    if (profile.provider === 'codex') prepareCodexHome(scratch);
    writeFileSync(join(scratch, 'system.txt'), SYSTEM);
    const { args, env } = invocation(profile, scratch);
    Object.assign(env, envOverrides);
    for (const name of deleteEnv) delete env[name];
    save(output, 'manifest.json', { schema: 'r01-cli-attempt-v1', profile, binary, args,
      inheritedEnvironmentNames: INHERITED_NAMES.filter(k => env[k] !== undefined
        && !(profile.provider === 'codex' && k === 'CODEX_HOME')),
      explicitEnvironment: Object.fromEntries(Object.entries(env).filter(([k]) => !INHERITED_NAMES.includes(k)
        || profile.provider === 'codex' && k === 'CODEX_HOME')
        .map(([k, v]) => [k, /KEY|TOKEN/.test(k) ? '<redacted>' : v])),
      ...(profile.provider === 'codex' ? { isolatedCodexHome: env.CODEX_HOME } : {}),
      scratch, timeoutMs, wrapperRetries: 0, promptSha256: sha(prompt), systemSha256: sha(SYSTEM),
      startedAt: new Date().toISOString(), ...meta });
    save(output, 'prompt.txt', prompt); save(output, 'system.txt', SYSTEM);
    const start = performance.now();
    const result = spawnSync(binary.realPath, args, { cwd: scratch, env, input: prompt, encoding: 'utf8',
      timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024, killSignal: 'SIGKILL' });
    const elapsedMs = performance.now() - start;
    save(output, 'stdout.jsonl', result.stdout ?? ''); save(output, 'stderr.txt', result.stderr ?? '');
    for (const name of ['codex-traces', 'api-bodies'])
      if (existsSync(join(scratch, name))) cpSync(join(scratch, name), join(output, name), { recursive: true });
    const processResult = { exitCode: result.status, signal: result.signal, error: result.error?.message ?? null,
      elapsedMs, controlAuditRequired: true };
    save(output, 'process.json', processResult);
    return { processResult, scratch };
  } finally { rmSync(scratch, { recursive: true, force: true }); }
}
