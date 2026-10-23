import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  requireCandidate, requireOldRecordsPreserved, recordFirstAttempt, prepareDoctor, runDoctorCase, compareTiming,
  loadE316Sample, requireGuardReceipt, requireRefusedPreflights, recordRetryAttempt, MARKER, CONSENT, HOST_VERSION,
  RETRY_CONSENT, REFUSED_PREFLIGHT_ERRORS, DATA, CANDIDATE_DIRECTORY, OLD_RECORDS,
} from './phase9b-grid-doctor-614.js';
import { CORE_ACTIONS } from './phase9b-grid-doctor.js';
import type { Wire } from './phase9b-grid-survey-read.js';
import { validateSnapshot, fixtureRuntime, PINNED_606 } from './phase9b-grid-writes.js';

const read = (name: string) => JSON.parse(readFileSync(join(CANDIDATE_DIRECTORY, name), 'utf8'));
const candidate = read('candidate.json'), selectors = read('selectors.json'), guards = read('guards.json');
const temp = () => mkdtempSync(join(tmpdir(), 'grid-doctor-614-'));
const copyOldRecords = (dir: string) => {
  for (const [local, committed] of OLD_RECORDS) copyFileSync(join(DATA, committed), join(dir, local));
};

test('the first attempt requires consent, refuses any earlier record, and cannot repeat', () => {
  for (const suffix of ['attempt.json', 'v20.attempt.json', 'accepted.json']) {
    const dir = temp();
    try {
      writeFileSync(join(dir, `key.${suffix}`), '{}');
      assert.throws(() => recordFirstAttempt(dir, 'key', 'f', CONSENT, {}), /attempt-already-recorded/);
      assert.deepEqual(readdirSync(dir), [`key.${suffix}`]);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }
  const dir = temp();
  try {
    assert.throws(() => recordFirstAttempt(dir, 'key', 'f', 'old consent', {}), /guarded-pass-consent-required/);
    assert.equal(existsSync(join(dir, 'key.attempt.json')), false);
    writeFileSync(join(dir, 'other.attempt.json'), '{}');
    recordFirstAttempt(dir, 'key', 'f', CONSENT, { output: '/x' });
    const record = JSON.parse(readFileSync(join(dir, 'key.attempt.json'), 'utf8'));
    assert.equal(record.fingerprint, 'f'); assert.equal(record.marker, MARKER);
    assert.equal(record.hostVersion, HOST_VERSION); assert.equal(record.writeAuthority, false);
    assert.equal(record.output, '/x'); assert.equal(typeof record.started, 'string');
    assert.throws(() => recordFirstAttempt(dir, 'key', 'f', CONSENT, {}), /attempt-already-recorded/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('the 6.0.6 records must stay byte-equal to their committed copies', () => {
  const dir = temp();
  try {
    copyOldRecords(dir); requireOldRecordsPreserved(dir);
    const [first] = OLD_RECORDS[1]!, path = join(dir, first);
    const bytes = readFileSync(path); const changed = Buffer.from(bytes); changed[0] = changed[0]! ^ 1;
    writeFileSync(path, changed);
    assert.throws(() => requireOldRecordsPreserved(dir), /old-record-changed/);
    rmSync(path);
    assert.throws(() => requireOldRecordsPreserved(dir), /old-record-missing/);
    assert.equal(existsSync(path), false, 'a refusal does not repair');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('the 6.1.4 candidate requires all roles, the one variant, and the guard metadata', () => {
  requireCandidate(candidate, selectors, guards);
  const journal = (r: Wire) => r.members.find((m: Wire) => m.role === 'journal-recording-edit');
  const candidateMutations = [
    (r: Wire) => r.members.pop(),
    (r: Wire) => r.members.splice(0, 1, r.members[1]),
    (r: Wire) => r.verdict.writeAuthority = true,
    (r: Wire) => r.liveInvariants.descriptor = 'unproved',
    (r: Wire) => r.source.hostVersion = '6.0.6',
    (r: Wire) => r.source.variants.push({ ...r.source.variants[0], role: 'descriptor' }),
    (r: Wire) => journal(r).flags = 2,
  ];
  for (const mutate of candidateMutations) {
    const changed = structuredClone(candidate); mutate(changed);
    assert.throws(() => requireCandidate(changed, selectors, guards));
  }
  const guardMutations = [
    (g: Wire) => g.jarSha256 = '0'.repeat(64),
    (g: Wire) => g.fields.pop(),
    (g: Wire) => { g.ownedTree.classes[0].managed = true; },
  ];
  for (const mutate of guardMutations) {
    const changed = structuredClone(guards); mutate(changed);
    assert.throws(() => requireCandidate(candidate, selectors, changed));
  }
});

test('prepare refuses a 6.0.6 host before doctorPrepare or an attempt write', async () => {
  const dir = temp(), calls: Wire[] = [];
  try {
    copyOldRecords(dir);
    const request = async (method: string, p: Wire = {}): Promise<Wire> => {
      calls.push({ method, ...p });
      if (method === 'host.info') return { hostVersion: '6.0.6' };
      throw new Error(`unexpected ${method} ${p.operation}`);
    };
    await assert.rejects(prepareDoctor(request, () => {}, { attempts: dir, key: 'key', fingerprint: 'f', consent: CONSENT,
      selectorSha256: 's', guardsSha256: 'g', candidateSha256: 'c', output: '/x' }), /host-version-614-required/);
    assert.deepEqual(calls.map(c => c.method), ['host.info']);
    assert.equal(readdirSync(dir).length, OLD_RECORDS.length);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

const guardReceipt = (action: string): Wire => ({ passed: true, guardNanos: 1000,
  checks: { projectDocumentClass: true, sameManager: true, helperList: true, pendingHelper: true, pendingList: true,
    disposalTrackingFalse: true, listenerTrackingFalse: true },
  ...(action === 'factory-dispose' ? { ownedTree: { passed: true, nodes: 77, managed: 1, depth: 4 } } : {}) });

function fakeHost(commandReply: (action: string) => Wire) {
  const calls: Wire[] = []; let command = false;
  const request = async (method: string, p: Wire = {}): Promise<Wire> => {
    calls.push({ method, ...p });
    if (p.operation === 'doctorStatus') return { marker: MARKER, metadata: { fingerprint: 'test' }, bound: command,
      failed: command, session: 's', attempted: command, locked: command, busy: false, nativeUnfinished: false };
    if (method === 'selection.status') return { revision: 1 };
    if (p.operation === 'doctorBind') return { marker: MARKER, session: 's' };
    if (p.operation === 'doctorRead') return { marker: MARKER, session: 's', status: { locked: false },
      snapshot: { graph: { complete: true, errorCount: 0, nodes: [] }, witness: {} } };
    if (p.operation === 'doctorCommand') { command = true; return commandReply(p.action); }
    if (p.operation === 'doctorInspect') return { uncertain: true };
    throw new Error(`unexpected ${p.operation}`);
  };
  return { calls, request };
}
const count = (calls: Wire[], operation: string) => calls.filter(c => c.operation === operation).length;

test('an uncertain command is inspected once and never repeated or released', async () => {
  const { calls, request } = fakeHost(() => { throw new Error('timeout-after-write'); });
  await assert.rejects(runDoctorCase(request, {}, { case: 'core' }, () => {}, 'test', []), /timeout-after-write/);
  assert.equal(count(calls, 'doctorCommand'), 1); assert.equal(count(calls, 'doctorInspect'), 1);
  assert.equal(count(calls, 'doctorRelease'), 0);
});

test('a failed or incomplete guard receipt refuses before the next stage', async () => {
  const bad: ((g: Wire) => void)[] = [
    g => { g.passed = false; },
    g => { delete g.checks.sameManager; },
    g => { g.checks.pendingList = false; },
  ];
  for (const mutate of bad) {
    const { calls, request } = fakeHost(action => {
      const guards = guardReceipt(action); mutate(guards);
      return { status: { locked: false }, receipt: { commandReturned: true, readback: 'pending-independent-pair',
        nativeCommandNanos: 5, action, guards } };
    });
    await assert.rejects(runDoctorCase(request, {}, { case: 'core' }, () => {}, 'test', []), /guard-/);
    assert.equal(count(calls, 'doctorCommand'), 1); assert.equal(count(calls, 'doctorInspect'), 1);
    assert.equal(count(calls, 'doctorRelease'), 0);
  }
  requireGuardReceipt('factory-dispose', guardReceipt('factory-dispose'));
  const wrongTree = guardReceipt('factory-dispose'); wrongTree.ownedTree.nodes = 76;
  assert.throws(() => requireGuardReceipt('factory-dispose', wrongTree), /owned-tree-nodes/);
  assert.throws(() => requireGuardReceipt('factory-dispose', guardReceipt('delete')), /owned-tree-not-passed/);
  assert.throws(() => requireGuardReceipt('value-set', undefined as unknown as Wire), /guard-receipt-missing/);
});

test('timing comparison reports percent change and the 20 percent flag as data', () => {
  const rows = compareTiming(
    [{ action: 'a', nativeCommandNanos: 100 }, { action: 'b', nativeCommandNanos: 200 }],
    [{ action: 'a', nativeCommandNanos: 130 }, { action: 'b', nativeCommandNanos: 220 }, { action: 'c', nativeCommandNanos: 1 }]);
  assert.deepEqual(rows, [
    { action: 'a', e316Nanos: 100, v21Nanos: 130, percentChange: 30, over20Percent: true },
    { action: 'b', e316Nanos: 200, v21Nanos: 220, percentChange: 10, over20Percent: false },
    { action: 'c', e316Nanos: null, v21Nanos: 1, percentChange: null, over20Percent: false },
  ]);
  const sample = loadE316Sample();
  assert.deepEqual(sample.map(r => r.action),
    ['boolean-enable', 'boolean-restore', 'mapping-remove', 'mapping-restore', ...CORE_ACTIONS]);
  assert.ok(sample.every(r => Number.isFinite(r.nativeCommandNanos) && r.nativeCommandNanos > 0));
});

test('a retry is admitted only after a refused preflight with no scratch write and no bind', () => {
  const dir = mkdtempSync(join(tmpdir(), 'grid-doctor-retry-')); const evidence = join(dir, 'prior'); mkdirSync(evidence);
  try {
    const key = 'k';
    const prior = { output: evidence, marker: MARKER, hostVersion: HOST_VERSION, writeAuthority: false };
    writeFileSync(join(dir, `${key}.attempt.json`), JSON.stringify(prior));
    const exit = { scratch: null, uncertain: false, completedPresets: 0 };
    const failure = { error: `${REFUSED_PREFLIGHT_ERRORS[0]}abc`, uncertain: false };
    const write = (name: string, value: unknown) => writeFileSync(join(evidence, name), JSON.stringify(value));
    write('exit.json', exit); write('failure.json', failure);
    assert.throws(() => recordRetryAttempt(dir, key, 'f', CONSENT, 'wrong', [evidence], {}), /retry-consent-required/);
    assert.throws(() => recordRetryAttempt(dir, key, 'f', 'wrong', RETRY_CONSENT, [evidence], {}), /guarded-pass-consent-required/);
    write('exit.json', { ...exit, scratch: 'x' });
    assert.throws(() => requireRefusedPreflights(dir, key, [evidence]), /prior-scratch-remains/);
    write('exit.json', exit); write('failure.json', { error: 'BridgeError: other', uncertain: false });
    assert.throws(() => requireRefusedPreflights(dir, key, [evidence]), /prior-failure-kind/);
    write('failure.json', { ...failure, uncertain: true });
    assert.throws(() => requireRefusedPreflights(dir, key, [evidence]), /prior-failure-uncertain/);
    write('failure.json', failure); write('preset-0-bind.json', {});
    assert.throws(() => requireRefusedPreflights(dir, key, [evidence]), /prior-pass-reached-a-preset/);
    rmSync(join(evidence, 'preset-0-bind.json'));
    assert.throws(() => requireRefusedPreflights(dir, key, [join(dir, 'other')]), /prior-evidence-mismatch/);
    assert.throws(() => requireRefusedPreflights(dir, key, [evidence, evidence]), /prior-attempt-missing:2/);
    assert.equal(existsSync(join(dir, `${key}.attempt-2.json`)), false);
    recordRetryAttempt(dir, key, 'f', CONSENT, RETRY_CONSENT, [evidence], {});
    const retry = JSON.parse(readFileSync(join(dir, `${key}.attempt-2.json`), 'utf8'));
    assert.equal(retry.retryConsent, RETRY_CONSENT); assert.ok(Array.isArray(retry.priorAttemptSha256) && retry.priorAttemptSha256.length === 1);
    assert.equal(readFileSync(join(dir, `${key}.attempt.json`), 'utf8'), JSON.stringify(prior));
    assert.throws(() => recordRetryAttempt(dir, key, 'f', CONSENT, RETRY_CONSENT, [evidence], {}), /retry-already-recorded/);
    // A second refused preflight admits the third attempt; the limit refuses a fourth.
    const evidence2 = join(dir, 'prior2'); mkdirSync(evidence2);
    writeFileSync(join(evidence2, 'exit.json'), JSON.stringify(exit)); writeFileSync(join(evidence2, 'failure.json'), JSON.stringify(failure));
    writeFileSync(join(dir, `${key}.attempt-2.json`), JSON.stringify({ ...prior, output: evidence2 }));
    assert.equal(requireRefusedPreflights(dir, key, [evidence, evidence2]).length, 2);
    assert.throws(() => requireRefusedPreflights(dir, key, [evidence, evidence2, evidence2, evidence2, evidence2, evidence2]), /refused-preflight-limit/);
    // A bound case that refused on its first read, with no command receipt, also admits a retry.
    const evidence3 = join(dir, 'prior3'); mkdirSync(evidence3);
    const write3 = (name: string, value: unknown) => writeFileSync(join(evidence3, name), JSON.stringify(value));
    write3('exit.json', { scratch: null, uncertain: false, completedPresets: 1 });
    write3('failure.json', { error: 'AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal', uncertain: false });
    write3('results.json', [{ case: 'boolean', verdict: 'refused-before-command', roles: [] }]);
    write3('before.json', { tracks: [1] }); write3('after.json', { tracks: [1] }); write3('preset-0-cancelled.json', {});
    writeFileSync(join(dir, `${key}.attempt-3.json`), JSON.stringify({ ...prior, output: evidence3 }));
    assert.equal(requireRefusedPreflights(dir, key, [evidence, evidence2, evidence3]).length, 3);
    write3('preset-0-stage-0-command.json', {});
    assert.throws(() => requireRefusedPreflights(dir, key, [evidence, evidence2, evidence3]), /prior-pass-ran-a-command/);
    rmSync(join(evidence3, 'preset-0-stage-0-command.json'));
    write3('results.json', [{ case: 'boolean', verdict: 'passed', roles: ['x'] }]);
    assert.throws(() => requireRefusedPreflights(dir, key, [evidence, evidence2, evidence3]), /prior-case-not-refused-before-command/);
    write3('results.json', [{ case: 'boolean', verdict: 'refused-before-command', roles: [] }]); write3('after.json', { tracks: [2] });
    assert.throws(() => requireRefusedPreflights(dir, key, [evidence, evidence2, evidence3]), /prior-preserved-state-differs/);
    rmSync(join(dir, `${key}.attempt-3.json`));
    writeFileSync(join(evidence2, 'failure.json'), JSON.stringify({ error: `${REFUSED_PREFLIGHT_ERRORS[1]}\n+ actual`, uncertain: false }));
    assert.equal(requireRefusedPreflights(dir, key, [evidence, evidence2]).length, 2);
    writeFileSync(join(dir, `${key}.accepted.json`), '{}'); rmSync(join(dir, `${key}.attempt-2.json`));
    assert.throws(() => requireRefusedPreflights(dir, key, [evidence]), /already-accepted/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('breadth snapshot rules use the resolved 6.1.4 runtime names, not the 6.0.6 names', () => {
  const candidate = JSON.parse(readFileSync(join(CANDIDATE_DIRECTORY, 'candidate.json'), 'utf8'));
  const runtime = fixtureRuntime(candidate);
  assert.equal(runtime.booleanAtom, 'RuU'); assert.equal(runtime.sourceAtom, 'com.bitwig.flt.document.core.master.device.xMq');
  const read = JSON.parse(readFileSync(join(DATA, '614-guarded/live-v21-attempt-5/preset-0-stage-0-read-0.json'), 'utf8'));
  validateSnapshot(read.snapshot, read.snapshot, 'boolean', 0, runtime);
  assert.throws(() => validateSnapshot(read.snapshot, read.snapshot, 'boolean', 0, PINNED_606), /'RuU' !== 'QY'/);
  assert.throws(() => validateSnapshot(read.snapshot, read.snapshot, 'boolean', 0), /'RuU' !== 'QY'/);
});
