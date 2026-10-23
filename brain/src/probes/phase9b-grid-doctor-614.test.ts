import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  requireCandidate, requireOldRecordsPreserved, recordFirstAttempt, prepareDoctor, runDoctorCase, compareTiming,
  loadE316Sample, requireGuardReceipt, requireRefusedPreflights, recordRetryAttempt, MARKER, CONSENT, HOST_VERSION,
  RETRY_CONSENT, REFUSED_PREFLIGHT_ERRORS, DATA, CANDIDATE_DIRECTORY, OLD_RECORDS,
  SECOND_PASS_CONSENT, SECOND_PASS_POLICY, PRIOR_614_KEY, PRIOR_614_RECORDS, UNCERTAIN_EVIDENCE_COMMANDS,
  UNCERTAIN_EVIDENCE_INSPECTION, requireSecondPassAdmission, recordSecondPassAttempt, secondPassName, loadE339Sample,
  operatorReplyArgument, E339_SAMPLE, E340_SAMPLE, loadCommandSample, THIRD_PASS_CONSENT, THIRD_PASS_POLICY,
  THIRD_PASS_PRIOR_RECORDS, requireThirdPassAdmission, recordThirdPassAttempt, thirdPassName, SECOND_PASS_COMMANDS,
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
    [{ action: 'a', nativeCommandNanos: 130 }, { action: 'b', nativeCommandNanos: 220 }, { action: 'c', nativeCommandNanos: 1 }],
    [{ action: 'a', nativeCommandNanos: 100 }, { action: 'c', nativeCommandNanos: 2 }]);
  assert.deepEqual(rows, [
    { action: 'a', e316Nanos: 100, v21Nanos: 130, percentChange: 30, over20Percent: true,
      e339Nanos: 100, percentChangeE339: 30, over20PercentE339: true, e340Nanos: null, percentChangeE340: null, over20PercentE340: false },
    { action: 'b', e316Nanos: 200, v21Nanos: 220, percentChange: 10, over20Percent: false,
      e339Nanos: null, percentChangeE339: null, over20PercentE339: false, e340Nanos: null, percentChangeE340: null, over20PercentE340: false },
    { action: 'c', e316Nanos: null, v21Nanos: 1, percentChange: null, over20Percent: false,
      e339Nanos: 2, percentChangeE339: -50, over20PercentE339: false, e340Nanos: null, percentChangeE340: null, over20PercentE340: false },
  ]);
  assert.deepEqual(compareTiming([], [{ action: 'a', nativeCommandNanos: 1 }]),
    [{ action: 'a', e316Nanos: null, v21Nanos: 1, percentChange: null, over20Percent: false,
      e339Nanos: null, percentChangeE339: null, over20PercentE339: false, e340Nanos: null, percentChangeE340: null, over20PercentE340: false }]);
  const sample = loadE316Sample();
  assert.deepEqual(sample.map(r => r.action),
    ['boolean-enable', 'boolean-restore', 'mapping-remove', 'mapping-restore', ...CORE_ACTIONS]);
  assert.ok(sample.every(r => Number.isFinite(r.nativeCommandNanos) && r.nativeCommandNanos > 0));
  // E339 attempt 6: the boolean pair and the uncertain mapping removal, nothing later.
  const attempt = loadE339Sample();
  assert.deepEqual(attempt.map(r => r.action), ['boolean-enable', 'boolean-restore', 'mapping-remove']);
  assert.deepEqual(attempt.map(r => r.nativeCommandNanos), [1_593_125, 236_875, 4_077_541]);
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

test('the mapping fixture rules accept the 6.1.4 removal transform from the attempt-6 captures', () => {
  const candidate = JSON.parse(readFileSync(join(CANDIDATE_DIRECTORY, 'candidate.json'), 'utf8'));
  const runtime = fixtureRuntime(candidate);
  const snapshot = (name: string) => JSON.parse(readFileSync(join(E339_SAMPLE, `${name}.json`), 'utf8')).snapshot;
  const initial = snapshot('preset-1-stage-0-read-0'), pair = snapshot('preset-1-stage-0-read-1');
  const removed = snapshot('preset-1-inspection');
  assert.deepEqual(pair, initial, 'attempt-6-pair');
  validateSnapshot(initial, pair, 'mapping', 0, runtime);
  // The inspection read after the uncertain removal is the exact stage-1 transform with an unchanged witness.
  validateSnapshot(initial, removed, 'mapping', 1, runtime);
  assert.equal(Object.keys(removed.fixture.mappings).length, Object.keys(initial.fixture.mappings).length - 1);
  assert.throws(() => validateSnapshot(initial, initial, 'mapping', 1, runtime), /strictly equal|deep-equal/);
  assert.throws(() => validateSnapshot(initial, removed, 'mapping', 0, runtime), /deep-equal/);
  // The 6.0.6 pin refuses the first read; that is the attempt-6 refusal, now covered offline.
  assert.throws(() => validateSnapshot(initial, pair, 'mapping', 0, PINNED_606), /xMq'[\s\S]*NDn'/);
  assert.throws(() => validateSnapshot(initial, pair, 'mapping', 0), /xMq'[\s\S]*NDn'/);
  // The boolean captures pass every stage with the resolved names.
  const boolean = (stage: number, i: number) => snapshot(`preset-0-stage-${stage}-read-${i}`);
  const first = boolean(0, 0);
  for (let stage = 0; stage <= 2; stage++) for (let i = 0; i < 2; i++) validateSnapshot(first, boolean(stage, i), 'boolean', stage, runtime);
});

test('the second pass is admitted only on the six unchanged records, the uncertain evidence, and a restarted host', () => {
  const root = mkdtempSync(join(tmpdir(), 'grid-doctor-second-pass-'));
  const attempts = join(root, 'attempts'), data = join(root, 'data'), evidence = join(root, 'uncertain');
  mkdirSync(attempts); mkdirSync(evidence); mkdirSync(join(data, 'prior'), { recursive: true });
  const key = 'k', started = '2026-10-23T04:02:17.972Z', restarted = Date.parse(started) + 60_000;
  const priorRecords: [string, string][] = [1, 2, 3, 4, 5, 6].map(n => [`${key}.attempt${n === 1 ? '' : `-${n}`}.json`, `prior/${n}.json`]);
  const write = (dir: string, name: string, value: unknown) => writeFileSync(join(dir, name), JSON.stringify(value));
  try {
    for (const [local, committed] of priorRecords) {
      const record = { output: local.endsWith('-6.json') ? evidence : join(root, local), marker: MARKER, hostVersion: HOST_VERSION,
        writeAuthority: false, started };
      write(attempts, local, record); write(data, committed, record);
    }
    write(evidence, 'exit.json', { scratch: 'scratch-id', uncertain: true, completedPresets: 1 });
    write(evidence, 'failure.json', { error: 'breadth-mapping-atom-class', scratch: 'scratch-id', uncertain: true });
    for (const name of UNCERTAIN_EVIDENCE_COMMANDS) write(evidence, name, {});
    write(evidence, UNCERTAIN_EVIDENCE_INSPECTION, {});
    const admit = (ms = restarted) => requireSecondPassAdmission(attempts, key, evidence, ms, data, priorRecords);
    assert.equal(admit().length, 6);
    // The retry policy refuses these records as a reason to run: the limit and the command receipts.
    assert.throws(() => requireRefusedPreflights(attempts, key, priorRecords.map(([local]) => join(root, local))), /refused-preflight-limit/);
    assert.throws(() => admit(Date.parse(started)), /host-not-restarted-after-uncertain-write/);
    assert.throws(() => admit(Number.NaN), /host-not-restarted-after-uncertain-write/);
    assert.throws(() => requireSecondPassAdmission(attempts, key, join(root, 'other'), restarted, data, priorRecords), /uncertain-evidence-mismatch/);
    assert.throws(() => requireSecondPassAdmission(attempts, key, evidence, restarted, data, priorRecords.slice(0, 5)), /six-prior-records-required/);
    const sixth = join(attempts, priorRecords[5]![0]), bytes = readFileSync(sixth);
    const changed = Buffer.from(bytes); changed[0] = changed[0]! ^ 1; writeFileSync(sixth, changed);
    assert.throws(() => admit(), /prior-record-changed/);
    rmSync(sixth); assert.throws(() => admit(), /prior-record-missing/);
    writeFileSync(sixth, bytes); assert.equal(admit().length, 6, 'a refusal does not repair');
    write(evidence, 'exit.json', { scratch: null, uncertain: true, completedPresets: 1 });
    assert.throws(() => admit(), /prior-scratch-not-retained/);
    write(evidence, 'exit.json', { scratch: 'scratch-id', uncertain: false, completedPresets: 1 });
    assert.throws(() => admit(), /prior-pass-not-uncertain/);
    write(evidence, 'exit.json', { scratch: 'scratch-id', uncertain: true, completedPresets: 1 });
    write(evidence, 'preset-1-stage-1-command.json', {});
    assert.throws(() => admit(), /prior-command-receipts/);
    rmSync(join(evidence, 'preset-1-stage-1-command.json'));
    write(evidence, 'results.json', []); assert.throws(() => admit(), /prior-pass-completed/); rmSync(join(evidence, 'results.json'));
    rmSync(join(evidence, UNCERTAIN_EVIDENCE_INSPECTION)); assert.throws(() => admit(), /prior-inspection-missing/);
    write(evidence, UNCERTAIN_EVIDENCE_INSPECTION, {});
    assert.throws(() => recordSecondPassAttempt(attempts, key, 'f', CONSENT, evidence, restarted, {}, data, priorRecords), /second-pass-consent-required/);
    assert.throws(() => recordSecondPassAttempt(attempts, key, 'f', RETRY_CONSENT, evidence, restarted, {}, data, priorRecords), /second-pass-consent-required/);
    assert.equal(existsSync(join(attempts, secondPassName(key))), false);
    recordSecondPassAttempt(attempts, key, 'f', SECOND_PASS_CONSENT, evidence, restarted, { output: '/x' }, data, priorRecords);
    const record = JSON.parse(readFileSync(join(attempts, secondPassName(key)), 'utf8'));
    assert.equal(record.consent, SECOND_PASS_CONSENT); assert.equal(record.hostConsentToken, CONSENT);
    assert.equal(record.policy, SECOND_PASS_POLICY); assert.equal(record.priorAttemptSha256.length, 6);
    assert.deepEqual(record.priorAttempts, priorRecords.map(([local]) => local));
    assert.equal(record.uncertainEvidence, evidence); assert.equal(record.hostStartedMs, restarted);
    assert.equal(record.writeAuthority, false); assert.equal(record.output, '/x');
    assert.ok(readFileSync(sixth).equals(bytes), 'prior records unchanged');
    assert.throws(() => admit(), /second-pass-already-recorded/);
    assert.throws(() => recordFirstAttempt(attempts, key, 'f', CONSENT, {}), /attempt-already-recorded/);
    rmSync(join(attempts, secondPassName(key))); writeFileSync(join(attempts, `${key}.accepted.json`), '{}');
    assert.throws(() => admit(), /already-accepted/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('the committed copies of the six 9b.6h records name the attempt-6 evidence and refuse the retry policy', () => {
  assert.equal(PRIOR_614_RECORDS.length, 6);
  const records = PRIOR_614_RECORDS.map(([local, committed]) => ({ local, record: JSON.parse(readFileSync(join(DATA, committed), 'utf8')) }));
  for (const { local, record } of records) {
    assert.ok(local.startsWith(`${PRIOR_614_KEY}.attempt`)); assert.equal(record.marker, MARKER);
    assert.equal(record.hostVersion, HOST_VERSION); assert.equal(record.writeAuthority, false); assert.equal(record.consent, CONSENT);
  }
  const sixth = records[5]!.record;
  assert.equal(sixth.priorAttemptSha256.length, 5); assert.equal(sixth.retryConsent, RETRY_CONSENT);
  assert.ok(sixth.output.endsWith('/614-guarded/live-v21-attempt-6'));
  // On the machine that holds the evidence, the full admission passes with a later host start and the retry policy refuses.
  if (!existsSync(sixth.output)) return;
  const attempts = mkdtempSync(join(tmpdir(), 'grid-doctor-prior-'));
  try {
    for (const [local, committed] of PRIOR_614_RECORDS) copyFileSync(join(DATA, committed), join(attempts, local));
    assert.equal(requireSecondPassAdmission(attempts, PRIOR_614_KEY, sixth.output, Date.parse(sixth.started) + 1).length, 6);
    assert.throws(() => requireSecondPassAdmission(attempts, PRIOR_614_KEY, sixth.output, Date.parse(sixth.started)), /host-not-restarted/);
    assert.throws(() => requireRefusedPreflights(attempts, PRIOR_614_KEY, records.map(r => r.record.output)), /refused-preflight-limit/);
    assert.throws(() => requireRefusedPreflights(attempts, PRIOR_614_KEY, records.slice(0, 5).map(r => r.record.output)), /retry-already-recorded/);
  } finally { rmSync(attempts, { recursive: true, force: true }); }
});

test('third-pass admission keeps all seven records and requires the exact E340 stop', () => {
  const root = temp(), attempts = join(root, 'attempts'), data = join(root, 'data'), evidence = join(root, 'evidence');
  mkdirSync(attempts); mkdirSync(data); mkdirSync(evidence);
  const records: [string, string][] = THIRD_PASS_PRIOR_RECORDS.map(([name], i) => [name, `record-${i}.json`]);
  const canonical = join(data, '614-second-pass/live-v21-second-pass'); mkdirSync(canonical, { recursive: true });
  const last = JSON.parse(readFileSync(join(DATA, THIRD_PASS_PRIOR_RECORDS[6]![1]), 'utf8'));
  const started = Date.parse(last.started), key = PRIOR_614_KEY;
  try {
    for (let i = 0; i < records.length; i++) {
      const bytes = i === 6 ? Buffer.from(JSON.stringify({ ...last, output: evidence }))
        : readFileSync(join(DATA, THIRD_PASS_PRIOR_RECORDS[i]![1]));
      writeFileSync(join(attempts, records[i]![0]), bytes); writeFileSync(join(data, records[i]![1]), bytes);
    }
    for (const name of [...SECOND_PASS_COMMANDS, 'preset-2-inspection.json', 'failure.json', 'exit.json']) {
      copyFileSync(join(E340_SAMPLE, name), join(evidence, name)); copyFileSync(join(E340_SAMPLE, name), join(canonical, name));
    }
    const admit = (time = started + 1) => requireThirdPassAdmission(attempts, key, evidence, time, data, records);
    assert.equal(admit().length, 7);
    assert.throws(() => admit(started), /host-not-restarted-after-second-pass/);
    assert.throws(() => admit(Number.NaN), /host-not-restarted-after-second-pass/);
    assert.throws(() => requireSecondPassAdmission(attempts, key, evidence, started + 1), /second-pass-already-recorded/);
    assert.throws(() => requireRefusedPreflights(attempts, key, records.map(() => evidence)), /refused-preflight-limit/);
    for (const [name] of records) {
      const path = join(attempts, name), bytes = readFileSync(path);
      writeFileSync(path, Buffer.concat([bytes, Buffer.from(' ')]));
      assert.throws(() => admit(), /prior-record-changed/); writeFileSync(path, bytes);
    }
    for (const name of SECOND_PASS_COMMANDS) {
      const path = join(evidence, name), bytes = readFileSync(path);
      rmSync(path); assert.throws(() => admit(), /second-pass-command-receipts/);
      writeFileSync(path, '{}'); assert.throws(() => admit(), /second-pass-evidence-changed/); writeFileSync(path, bytes);
    }
    writeFileSync(join(evidence, 'preset-2-stage-5-command.json'), '{}');
    assert.throws(() => admit(), /second-pass-command-receipts/); rmSync(join(evidence, 'preset-2-stage-5-command.json'));
    writeFileSync(join(evidence, 'preset-1-inspection.json'), '{}');
    assert.throws(() => admit(), /second-pass-inspection/); rmSync(join(evidence, 'preset-1-inspection.json'));
    assert.throws(() => recordThirdPassAttempt(attempts, key, 'f', SECOND_PASS_CONSENT, evidence, started + 1, {}, data, records),
      /third-pass-consent-required/);
    recordThirdPassAttempt(attempts, key, 'f', THIRD_PASS_CONSENT, evidence, started + 1, { output: '/third', operatorReply: 'Saved, go ahead' }, data, records);
    const record = JSON.parse(readFileSync(join(attempts, thirdPassName(key)), 'utf8'));
    assert.equal(record.policy, THIRD_PASS_POLICY); assert.equal(record.hostConsentToken, CONSENT);
    assert.equal(record.priorAttemptSha256.length, 7); assert.equal(record.output, '/third');
    assert.equal(record.operatorReply, 'Saved, go ahead');
    assert.throws(() => admit(), /third-pass-already-recorded/);
    assert.throws(() => recordFirstAttempt(attempts, key, 'f', CONSENT, {}), /attempt-already-recorded/);
    for (const [name, committed] of records) assert.ok(readFileSync(join(attempts, name)).equals(readFileSync(join(data, committed))));
    rmSync(join(attempts, thirdPassName(key))); writeFileSync(join(attempts, `${key}.accepted.json`), '{}');
    assert.throws(() => admit(), /already-accepted/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('E340 timing compares all nine completed commands and reports increases as data', () => {
  const sample = loadCommandSample(E340_SAMPLE);
  assert.deepEqual(sample.map(r => r.action), ['boolean-enable', 'boolean-restore', 'mapping-remove', 'mapping-restore', ...CORE_ACTIONS.slice(0, 5)]);
  const rows = compareTiming([], sample.map(r => ({ ...r, nativeCommandNanos: r.nativeCommandNanos * 1.3 })), [], sample);
  assert.ok(rows.every(r => r.over20PercentE340 && Math.abs(r.percentChangeE340! - 30) < 0.0001));
});


test('ordinary operator replies are retained without requiring a prescribed phrase', () => {
  const command = ['/new/output', THIRD_PASS_CONSENT, '--third-pass-after-owned-tree-refusal', '/prior'];
  for (const reply of ['Saved, go ahead', 'Yes, run that test.', 'Saved. Playback is stopped; proceed.']) {
    const input = [...command, '--operator-reply', reply];
    assert.deepEqual(operatorReplyArgument(input), { argv: command, operatorReply: reply });
    assert.equal(input.length, 6);
  }
  assert.deepEqual(operatorReplyArgument(command), { argv: command });
  for (const reply of ['', '   ', 'x'.repeat(4097)])
    assert.throws(() => operatorReplyArgument([...command, '--operator-reply', reply]), /operator-reply-required/);
  assert.throws(() => operatorReplyArgument([...command, '--operator-reply']), /operator-reply-required/);
  assert.throws(() => operatorReplyArgument([...command, '--operator-reply', 'yes', '--operator-reply', 'yes']), /duplicate-operator-reply/);
});
