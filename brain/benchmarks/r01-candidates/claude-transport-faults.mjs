// Local transport fault test for the pinned Claude Code client. The CLI talks
// only to a loopback fake Messages endpoint with a dummy API key; proxies point
// to a closed local port so any other HTTP(S) traffic fails. No inference occurs.
import { spawn } from 'node:child_process';
import http from 'node:http';
import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROFILES } from './cli-controls.mjs';
import { resolveBinary, runCliAttempt, sha } from './cli-attempt.mjs';

export const FAULT_SCENARIOS = [
  { id: 'success', mode: 'ok' },
  { id: 'http-500', mode: '500' },
  { id: 'http-529-overloaded', mode: '529' },
  { id: 'http-429-rate-limit', mode: '429' },
  { id: 'reset-before-events', mode: 'reset' },
  { id: 'reset-mid-stream', mode: 'midstream' },
  // Positive controls: the same counters must detect a permitted retry.
  { id: 'positive-control-http-500-one-retry', mode: '500', retries: 1 },
  { id: 'positive-control-http-529-one-retry', mode: '529', retries: 1 },
];
// Retry/fallback settings under test; they must equal the trial invocation's.
export const RETRY_CONTROL_NAMES = ['CLAUDE_CODE_MAX_RETRIES', 'CLAUDE_CODE_RETRY_WATCHDOG',
  'CLAUDE_CODE_DISABLE_NONSTREAMING_FALLBACK', 'CLAUDE_CODE_DISABLE_REFUSAL_FALLBACK'];
const DEAD_PROXY = 'http://127.0.0.1:9';

function serve(mode) {
  const log = [];
  const event = (res, type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
  const start = (res, model, id) => event(res, 'message_start', { message: { id, type: 'message', role: 'assistant', model,
    content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 1,
      cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } } });
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let parsed = null; try { parsed = JSON.parse(body); } catch {}
      // Record only the authentication scheme, never header values.
      log.push({ method: req.method, url: req.url, auth: req.headers['x-api-key'] ? 'x-api-key'
        : req.headers.authorization ? 'authorization' : 'none', model: parsed?.model ?? null,
        stream: parsed?.stream ?? null, stainlessRetryCount: req.headers['x-stainless-retry-count'] ?? null,
        bodySha256: sha(body) });
      process.stderr.write(JSON.stringify(log.at(-1)) + '\n');
      if (req.method !== 'POST' || !/^\/v1\/messages(\?|$)/.test(req.url)) { res.writeHead(404); res.end('{}'); return; }
      const id = `req_local_${log.length}`;
      if (mode === 'ok') {
        res.writeHead(200, { 'content-type': 'text/event-stream', 'request-id': id });
        start(res, parsed?.model, `msg_local_${log.length}`);
        event(res, 'content_block_start', { index: 0, content_block: { type: 'text', text: '' } });
        event(res, 'content_block_delta', { index: 0, delta: { type: 'text_delta', text: 'OK' } });
        event(res, 'content_block_stop', { index: 0 });
        event(res, 'message_delta', { delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 2 } });
        event(res, 'message_stop', {}); res.end(); return;
      }
      if (mode === 'reset' || mode === 'midstream') {
        res.writeHead(200, { 'content-type': 'text/event-stream', 'request-id': id });
        if (mode === 'reset') event(res, 'ping', {});
        else {
          start(res, parsed?.model, `msg_local_${log.length}`);
          event(res, 'content_block_start', { index: 0, content_block: { type: 'text', text: '' } });
          event(res, 'content_block_delta', { index: 0, delta: { type: 'text_delta', text: 'O' } });
        }
        setTimeout(() => req.socket.destroy(), 50); return;
      }
      const status = Number(mode);
      res.writeHead(status, { 'content-type': 'application/json', 'retry-after': '0', 'request-id': id });
      res.end(JSON.stringify({ type: 'error', error: { type: status === 529 ? 'overloaded_error'
        : status === 429 ? 'rate_limit_error' : 'api_error', message: 'local fault' } }));
    });
  });
  server.listen(0, '127.0.0.1', () => process.stdout.write(`${server.address().port}\n`));
  process.on('SIGTERM', () => server.close(() => process.exit(0)));
}

const jsonl = text => text.split('\n').filter(Boolean).map(line => { try { return JSON.parse(line); } catch { return { unparsed: line }; } });

/** Pure evaluation of one retained scenario. */
export function evaluateScenario(scenario, record) {
  const requests = record.server.filter(r => r.method === 'POST' && /^\/v1\/messages(\?|$)/.test(r.url));
  const retries = record.events.filter(e => e.type === 'system' && e.subtype === 'api_retry').length;
  const fallbacks = record.events.filter(e => e.type === 'system' && /fallback/.test(e.subtype ?? '')).length;
  const captured = record.captureFiles.filter(f => f.endsWith('.request.json')).length;
  const result = record.events.findLast(e => e.type === 'result');
  const expectedRequests = 1 + (scenario.retries ?? 0);
  const checks = {
    httpRequests: requests.length === expectedRequests,
    otherHttpRequests: record.server.length === requests.length,
    capturedRequestFilesMatchHttp: captured === requests.length,
    retryEventsMatch: retries === (scenario.retries ?? 0),
    noFallbackEvents: fallbacks === 0,
    streamingOnly: requests.every(r => r.stream === true),
    requestedModelOnly: requests.every(r => r.model === record.model),
    dummyKeyOnly: requests.every(r => r.auth === 'x-api-key'),
    outcome: scenario.mode === 'ok'
      ? record.process.exitCode === 0 && result?.is_error === false && record.captureFiles.includes('index.jsonl')
      : record.process.exitCode !== 0 && result?.is_error === true && !record.captureFiles.includes('index.jsonl'),
  };
  return { id: scenario.id, pass: Object.values(checks).every(Boolean), checks, httpRequests: requests.length,
    capturedRequestFiles: captured, apiRetryEvents: retries, resultError: result?.result ?? null };
}

export function evaluateSuite(suite) {
  const results = FAULT_SCENARIOS.map(s => {
    const record = suite.scenarios.find(r => r.id === s.id);
    return record ? evaluateScenario(s, record) : { id: s.id, pass: false, missing: true };
  });
  return { pass: results.every(r => r.pass), results };
}

async function runSuite(outputArg) {
  const output = resolve(outputArg), profile = PROFILES['claude-historical'];
  mkdirSync(output);
  const binary = resolveBinary('claude');
  const suite = { schema: 'r01-claude-transport-faults-v1', profile, binary, startedAt: new Date().toISOString(),
    scenarios: [], source: { path: 'brain/benchmarks/r01-candidates/claude-transport-faults.mjs',
      sha256: sha(readFileSync(fileURLToPath(import.meta.url))) } };
  for (const scenario of FAULT_SCENARIOS) {
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), '--serve', scenario.mode], { stdio: ['ignore', 'pipe', 'pipe'] });
    let serverLog = ''; child.stderr.on('data', d => { serverLog += d; });
    const port = await new Promise((ok, fail) => { child.stdout.once('data', d => ok(String(d).trim())); child.once('exit', fail); });
    const dir = join(output, scenario.id);
    const envOverrides = { ANTHROPIC_BASE_URL: `http://127.0.0.1:${port}`, ANTHROPIC_API_KEY: 'sk-ant-local-fault-dummy',
      HTTPS_PROXY: DEAD_PROXY, HTTP_PROXY: DEAD_PROXY, ALL_PROXY: DEAD_PROXY, https_proxy: DEAD_PROXY,
      http_proxy: DEAD_PROXY, all_proxy: DEAD_PROXY, NO_PROXY: '127.0.0.1,localhost', no_proxy: '127.0.0.1,localhost',
      ...(scenario.retries ? { CLAUDE_CODE_MAX_RETRIES: String(scenario.retries) } : {}) };
    let processResult;
    try {
      ({ processResult } = runCliAttempt({ profile, binary, prompt: 'Local transport fault test. Reply OK.\n',
        output: dir, timeoutMs: 60000, envOverrides, meta: { kind: 'local-transport-fault', scenario } }));
    } finally {
      child.kill('SIGTERM'); await new Promise(ok => child.exitCode !== null ? ok() : child.once('exit', ok));
    }
    writeFileSync(join(dir, 'server.jsonl'), serverLog);
    const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
    suite.scenarios.push({ id: scenario.id, model: profile.model, process: processResult,
      retryControls: Object.fromEntries(RETRY_CONTROL_NAMES.map(k => [k, manifest.explicitEnvironment[k] ?? null])),
      server: jsonl(serverLog), events: jsonl(readFileSync(join(dir, 'stdout.jsonl'), 'utf8')),
      captureFiles: existsSync(join(dir, 'api-bodies')) ? readdirSync(join(dir, 'api-bodies')).sort() : [] });
  }
  const evaluation = evaluateSuite(suite);
  const summary = { ...suite, scenarios: undefined, evaluation,
    trialRetryControls: suite.scenarios.find(s => s.id === 'success').retryControls };
  writeFileSync(join(output, 'suite.json'), JSON.stringify(suite, null, 2) + '\n');
  writeFileSync(join(output, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
  console.log(JSON.stringify(evaluation, null, 2));
  if (!evaluation.pass) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === '--serve') serve(process.argv[3]);
  else if (process.argv[2]) await runSuite(process.argv[2]);
  else throw new Error('usage: node claude-transport-faults.mjs NEW_OUTPUT_DIRECTORY');
}
