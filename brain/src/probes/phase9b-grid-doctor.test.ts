import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { requireCandidate, requireAccepted, verifyCounterTrace, runDoctorCase, recordRevisedAttempt, MARKER, CONSENT } from './phase9b-grid-doctor.js';
import type { Wire } from './phase9b-grid-survey-read.js';
const data = new URL('../../../context/evidence/data/phase9b-doctor/v20-preparation/', import.meta.url);
const candidate = JSON.parse(readFileSync(new URL('candidate.json', data), 'utf8'));
const selectors = JSON.parse(readFileSync(new URL('selectors.json', data), 'utf8'));
test('a revised pass requires explicit consent, preserves the original record, and cannot repeat', () => {
  const dir = mkdtempSync(join(tmpdir(), 'grid-doctor-attempt-'));
  const original = Buffer.from(JSON.stringify({fingerprint:'f',host:{hostVersion:'6.0.6'},writeAuthority:false}));
  try {
    writeFileSync(join(dir,'key.attempt.json'),original);
    assert.throws(() => recordRevisedAttempt(dir,'key','f','old consent',original,{}));
    assert.equal(existsSync(join(dir,'key.v20.attempt.json')),false);
    assert.throws(() => recordRevisedAttempt(dir,'key','changed',CONSENT,original,{}));
    assert.throws(() => recordRevisedAttempt(dir,'key','f',CONSENT,Buffer.from('changed'),{}));
    recordRevisedAttempt(dir,'key','f',CONSENT,original,{});
    assert.deepEqual(readFileSync(join(dir,'key.attempt.json')),original);
    assert.throws(() => recordRevisedAttempt(dir,'key','f',CONSENT,original,{}));
    rmSync(join(dir,'key.v20.attempt.json')); writeFileSync(join(dir,'key.accepted.json'),'{}');
    assert.throws(() => recordRevisedAttempt(dir,'key','f',CONSENT,original,{}));
  } finally {rmSync(dir,{recursive:true,force:true});}
});
test('candidate metadata requires all roles, invariants, and no prior live authority', () => {
  requireCandidate(candidate, selectors);
  for (const mutate of [
    (r: Wire) => r.members.pop(),
    (r: Wire) => r.members.splice(0, 1, r.members[1]),
    (r: Wire) => r.verdict.writeAuthority = true,
    (r: Wire) => r.liveInvariants.descriptor = 'unproved',
  ]) {
    const changed = structuredClone(candidate); mutate(changed); assert.throws(() => requireCandidate(changed, selectors));
  }
});
const teardown = { bound: false, busy: false, nativeUnfinished: false, timeoutLocked: false, failed: false, phase: 3, foreignOwner: false };
const results = ['boolean', 'mapping', 'core'].map((kind, i) => ({ case: kind, verdict: 'passed', pairedReadback: true, roles: [String(i)] }));
test('acceptance requires every unique role and clean teardown', () => {
  requireAccepted(results, ['0', '1', '2'], teardown);
  assert.throws(() => requireAccepted(results.slice(0, 2), ['0', '1', '2'], teardown));
  for (const key of ['bound', 'busy', 'nativeUnfinished', 'timeoutLocked', 'failed', 'foreignOwner']) {
    assert.throws(() => requireAccepted(results, ['0', '1', '2'], { ...teardown, [key]: true }));
  }
  assert.throws(() => requireAccepted(results, ['0', '1', '2', 'missing'], teardown));
  assert.throws(() => requireAccepted([...results, results[0]!], ['0', '1', '2'], teardown));
});
test('counter proof requires a transition and preserved zero long-edit and lock counters', () => {
  const row = (stage: string, active: boolean) => ({ stage, frames: active ? 1 : 0, instant: active ? 1 : 0,
    longer: 0, locks: 0, lockSet: false, active });
  const trace = [row('before', false), { stage: 'label', label: 'Insert Module' }, row('owned', true),
    row('same-owned-edit', true), row('same-owned-edit', true), row('idle', false)];
  verifyCounterTrace(trace);
  assert.throws(() => verifyCounterTrace([row('before', false), row('idle', false)]));
  const wrong: Wire[] = structuredClone(trace); wrong[2]!.instant = 0; assert.throws(() => verifyCounterTrace(wrong));
});
test('an uncertain command is inspected once and never repeated or released', async () => {
  const calls: Wire[] = []; let command = false;
  const request = async (method: string, p: Wire = {}): Promise<Wire> => {
    calls.push({ method, ...p });
    if (p.operation === 'doctorStatus') return { marker: MARKER, metadata: { fingerprint: 'test' }, bound: command,
      failed: command, session: 's', attempted: command, locked: command, busy: false, nativeUnfinished: false };
    if (method === 'selection.status') return { revision: 1 };
    if (p.operation === 'doctorBind') return { marker: MARKER, session: 's' };
    if (p.operation === 'doctorRead') return { marker: MARKER, session: 's', status: { locked: false },
      snapshot: { graph: { complete: true, errorCount: 0, nodes: [] }, witness: {} } };
    if (p.operation === 'doctorCommand') { command = true; throw new Error('timeout-after-write'); }
    if (p.operation === 'doctorInspect') return { uncertain: true };
    throw new Error(`unexpected ${p.operation}`);
  };
  await assert.rejects(runDoctorCase(request, {}, { case: 'core' }, () => {}, 'test', []), /timeout-after-write/);
  assert.equal(calls.filter(c => c.operation === 'doctorCommand').length, 1);
  assert.equal(calls.filter(c => c.operation === 'doctorInspect').length, 1);
  assert.equal(calls.filter(c => c.operation === 'doctorRelease').length, 0);
});
