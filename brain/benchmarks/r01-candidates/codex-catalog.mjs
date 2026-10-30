// Capture the account's Codex model catalog with `codex debug models`; no inference.
// Uses the pinned binary, an isolated CODEX_HOME and the trial invocation's flags.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { SYSTEM, PROFILES, invocation } from './cli-controls.mjs';
import { prepareCodexHome } from './codex-isolation.mjs';
import { preflightProvider, sha } from './cli-attempt.mjs';

/** Keep the trial's -c/--enable/--disable flags; replace `exec … -` with `debug models`. */
export function catalogArgs(execArgs, model) {
  const flags = [];
  for (let i = 0; i < execArgs.length; i++)
    if (['-c', '--enable', '--disable'].includes(execArgs[i])) flags.push(execArgs[i], execArgs[++i]);
  return ['debug', 'models', ...flags, '-c', `model=${JSON.stringify(model)}`];
}

/** Summarize the fields that select request layout, tools and effort. */
export function catalogSummary(catalog) {
  return catalog.models.map(m => ({ slug: m.slug, displayName: m.display_name, description: m.description,
    visibility: m.visibility, defaultEffort: m.default_reasoning_level,
    efforts: (m.supported_reasoning_levels ?? []).map(e => e.effort), toolMode: m.tool_mode,
    multiAgentVersion: m.multi_agent_version, sha256: sha(JSON.stringify(m)) }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [outputArg] = process.argv.slice(2);
  assert(outputArg, 'usage: node codex-catalog.mjs NEW_OUTPUT_DIRECTORY');
  const output = resolve(outputArg), profile = PROFILES['codex-current'];
  const { binary, version, authentication } = preflightProvider('codex', profile.version);
  mkdirSync(output);
  const scratch = mkdtempSync(join(tmpdir(), 'r01-codex-catalog-'));
  const save = (name, value) => writeFileSync(join(output, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n');
  try {
    prepareCodexHome(scratch);
    writeFileSync(join(scratch, 'system.txt'), SYSTEM);
    const spec = invocation(profile, scratch), args = catalogArgs(spec.args, profile.model);
    const start = performance.now();
    const r = spawnSync(binary.realPath, args, { cwd: scratch, env: spec.env, encoding: 'utf8', timeout: 120000,
      maxBuffer: 32 * 1024 * 1024, killSignal: 'SIGKILL' });
    save('stdout.json', r.stdout ?? ''); save('stderr.txt', r.stderr ?? '');
    const processResult = { exitCode: r.status, signal: r.signal, error: r.error?.message ?? null, elapsedMs: performance.now() - start };
    let summary = null;
    try { summary = catalogSummary(JSON.parse(r.stdout)); } catch {}
    save('manifest.json', { schema: 'r01-codex-catalog-v1', kind: 'no-inference-catalog', binary, version, authentication,
      args, scratch, capturedAt: new Date().toISOString(), process: processResult, stdoutSha256: sha(r.stdout ?? ''),
      sources: ['codex-catalog.mjs', 'cli-controls.mjs', 'codex-isolation.mjs', 'cli-attempt.mjs']
        .map(path => ({ path, sha256: sha(readFileSync(new URL(path, import.meta.url))) })), summary });
    console.log(JSON.stringify({ ...processResult, models: summary?.map(m => m.slug) }));
    if (r.status !== 0) process.exitCode = 1;
  } finally { rmSync(scratch, { recursive: true, force: true }); }
}
