import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { prepareCodexHome } from './codex-isolation.mjs';
import { runCliAttempt, sha } from './cli-attempt.mjs';
import { PROFILES } from './cli-controls.mjs';
import { auditProbe, loadCodexCapture } from './cli-control-audit.mjs';

function fixture(t, auth = { auth_mode: 'chatgpt', tokens: { access_token: 'dummy-local-token' } }) {
  const root = mkdtempSync(join(tmpdir(), 'r01-isolation-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const source = join(root, 'source'), scratch = join(root, 'scratch');
  mkdirSync(source); mkdirSync(scratch);
  writeFileSync(join(source, 'auth.json'), JSON.stringify(auth));
  writeFileSync(join(source, 'config.toml'), 'operator configuration');
  writeFileSync(join(source, 'AGENTS.md'), 'operator preferences');
  return { source, scratch };
}

test('private home copies only subscription auth; local refresh cannot mutate the source', t => {
  const { source, scratch } = fixture(t);
  const before = readdirSync(source).map(name => [name, readFileSync(join(source, name), 'utf8')]);
  const isolated = prepareCodexHome(scratch, { CODEX_HOME: source, HOME: '/unused' });
  assert.deepEqual(readdirSync(isolated), ['auth.json']);
  assert.equal(statSync(isolated).mode & 0o777, 0o700);
  assert.equal(statSync(join(isolated, 'auth.json')).mode & 0o777, 0o600);
  writeFileSync(join(isolated, 'auth.json'), 'simulated refresh');
  for (const [name, bytes] of before) assert.equal(readFileSync(join(source, name), 'utf8'), bytes);
  assert.throws(() => prepareCodexHome(scratch, { CODEX_HOME: source }), /EEXIST/);
});

test('API auth, mixed credentials and missing subscription tokens fail before home creation', t => {
  for (const auth of [{ auth_mode: 'apikey', OPENAI_API_KEY: 'dummy' },
    { auth_mode: 'chatgpt', OPENAI_API_KEY: 'dummy', tokens: { access_token: 'dummy' } },
    { auth_mode: 'chatgpt' }]) {
    const { source, scratch } = fixture(t, auth);
    assert.throws(() => prepareCodexHome(scratch, { CODEX_HOME: source }), /file-backed ChatGPT/);
    assert.deepEqual(readdirSync(scratch), []);
  }
});

test('default authentication location uses HOME without changing the inherited environment', t => {
  const { source, scratch } = fixture(t);
  mkdirSync(join(source, '.codex'));
  writeFileSync(join(source, '.codex/auth.json'), readFileSync(join(source, 'auth.json')));
  const inherited = { HOME: source };
  assert.equal(prepareCodexHome(scratch, inherited), join(scratch, 'codex-home'));
  assert.deepEqual(inherited, { HOME: source });
});

test('attempt runner uses private auth and removes it without retaining credentials', t => {
  const { source, scratch } = fixture(t);
  const prior = process.env.CODEX_HOME;
  process.env.CODEX_HOME = source;
  t.after(() => { if (prior === undefined) delete process.env.CODEX_HOME; else process.env.CODEX_HOME = prior; });
  const executable = join(scratch, 'fake-codex');
  writeFileSync(executable, `#!${process.execPath}
const fs = require('node:fs');
const home = process.env.CODEX_HOME;
if (!fs.existsSync(home + '/auth.json') || fs.existsSync(home + '/AGENTS.md')) process.exit(1);
console.log(JSON.stringify({ privateHome: home, files: fs.readdirSync(home) }));
`, { mode: 0o700 });
  const binary = { realPath: executable, sha256: sha(readFileSync(executable)) };
  const output = join(scratch, 'attempt');
  const result = runCliAttempt({ profile: PROFILES['codex-current'], binary, prompt: 'Local test.', output });
  assert.equal(result.processResult.exitCode, 0);
  const observed = JSON.parse(readFileSync(join(output, 'stdout.jsonl')));
  assert.notEqual(observed.privateHome, source);
  assert.deepEqual(observed.files, ['auth.json']);
  assert.equal(existsSync(result.scratch), false);
  for (const name of readdirSync(output)) assert(!readFileSync(join(output, name), 'utf8').includes('dummy-local-token'));
  assert(readFileSync(join(source, 'auth.json'), 'utf8').includes('dummy-local-token'));
});

const evidence = fileURLToPath(new URL('../../../context/evidence/data/r01-codex-admission/', import.meta.url));
test('retained isolated subscription probes remove AGENTS/skills but remain unadmitted', () => {
  for (const name of ['isolated-home', 'exclude-tools']) {
    const result = auditProbe(join(evidence, name));
    assert.equal(result.probeAnswerMatches, true);
    assert.equal(result.requests[0].userProjectInstructionsPresent, false);
    assert.equal(result.requests[0].skillsPresent, false);
    assert.equal(result.requests[0].maxOutputTokens, null);
    assert.equal(result.outputCeilingVerified, false);
    assert.equal(result.outputCeilingRequired, false);
    assert(!result.issues.includes('effective-output-ceiling-unverified-or-mismatched'));
    assert.equal(result.modelVerified, false);
    assert.equal(result.modelSelectionPass, true);
    assert.equal(result.modelEvidenceBasis, 'captured-request-success-no-reroute');
    assert.equal(result.toolUseObserved, false);
    assert(!result.issues.includes('advertised-tools-present'));
    assert.equal(result.controlPass, false);
    assert(result.requests[0].tools.includes('functions.exec'));
    for (const issue of ['codex-client-context-policy-pending',
      'transport-retry-control-unverified']) assert(result.issues.includes(issue));
  }
});

test('retained local faults distinguish HTTP attempts from logical inference counts', () => {
  for (const name of ['http-500', 'http-429', 'stream-disconnect', 'positive-http-500']) {
    const dir = join(evidence, 'faults', name);
    const record = JSON.parse(readFileSync(join(dir, 'record.json')));
    assert.equal(record.requests.length, name === 'positive-http-500' ? 2 : 1);
    assert(record.requests.every(r => r.dummyCredential && r.path === '/responses'));
    assert.equal(record.process.signal, null);
    assert.notEqual(record.process.exitCode, 0);
    const trace = loadCodexCapture(dir);
    assert.equal(trace.inferenceStarts, 1);
    assert.equal(trace.inferenceFailures, 1);
  }
});
