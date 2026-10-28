// Private per-attempt state. Never symlink mutable authentication to user state.
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function prepareCodexHome(scratch, inherited = process.env) {
  const source = inherited.CODEX_HOME ?? (inherited.HOME && join(inherited.HOME, '.codex'));
  assert(source, 'Codex authentication location required');
  const bytes = readFileSync(join(source, 'auth.json'));
  const auth = JSON.parse(bytes);
  assert(auth.auth_mode === 'chatgpt' && !auth.OPENAI_API_KEY
    && typeof auth.tokens?.access_token === 'string' && auth.tokens.access_token.length > 0,
  'isolated Codex requires file-backed ChatGPT authentication');
  const directory = join(scratch, 'codex-home');
  mkdirSync(directory, { mode: 0o700 }); // Refuse reuse of an earlier home.
  writeFileSync(join(directory, 'auth.json'), bytes, { mode: 0o600, flag: 'wx' });
  return directory;
}
