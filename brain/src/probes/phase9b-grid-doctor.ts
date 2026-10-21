/** One consent-gated doctor pass. A durable attempt file prevents automatic retries. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync, realpathSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runSurvey } from './phase9b-grid-survey.js';
import { validateSnapshot, type Case } from './phase9b-grid-writes.js';
import type { Request, Wire } from './phase9b-grid-survey-read.js';

export const MARKER = '9b-grid-doctor-v20';
export const CONSENT = 'I saved first. I consent to one revised V20 scratch doctor pass on the same fingerprint, including boolean and mapping checks. A failed check can require a Bitwig restart.';
export const CORE_ACTIONS = ['value-set', 'value-restore', 'cable-connect', 'cable-disconnect',
  'factory-create', 'factory-dispose', 'delete-connect', 'delete', 'undo-delete', 'delete-disconnect', 'attach', 'undo-attach'];
const ROOT = join(import.meta.dirname, '../../..');
const DATA = join(ROOT, 'context/evidence/data/phase9b-doctor');
const load = (path: string): Wire => {
  assert.ok(statSync(path).size <= 128 * 1024, 'doctor-input-limit');
  return JSON.parse(readFileSync(path, 'utf8'));
};
export function recordRevisedAttempt(directory: string, key: string, fingerprint: string, consent: string,
  original: Buffer, details: Wire) {
  assert.equal(consent, CONSENT, 'revised-pass-consent-required');
  const priorPath = join(directory, `${key}.attempt.json`);
  const priorBytes = readFileSync(priorPath);
  assert.ok(priorBytes.equals(original), 'original-attempt-record-changed');
  const prior = JSON.parse(priorBytes.toString('utf8'));
  assert.equal(prior.fingerprint, fingerprint); assert.equal(prior.host.hostVersion, '6.0.6');
  assert.equal(prior.writeAuthority, false);
  assert.equal(existsSync(join(directory, `${key}.accepted.json`)), false, 'already-accepted');
  writeFileSync(join(directory, `${key}.v20.attempt.json`), JSON.stringify({ ...details, fingerprint, consent,
    marker: MARKER, priorAttemptSha256: createHash('sha256').update(priorBytes).digest('hex'),
    started: new Date().toISOString(), writeAuthority: false }, null, 2) + '\n', { flag: 'wx' });
}
export function requireCandidate(candidate: Wire, selectors: Wire) {
  assert.equal(candidate.result, 'pass'); assert.equal(candidate.verdict.structuralValidation, 'pass');
  assert.equal(candidate.verdict.liveValidation, 'not-run'); assert.equal(candidate.verdict.writeAuthority, false);
  assert.equal(Object.keys(candidate.types).length, 55); assert.equal(candidate.members.length, 76);
  const roles = candidate.members.map((r: Wire) => r.role).sort();
  assert.equal(new Set(roles).size, 76);
  assert.deepEqual(roles, selectors.members.map((r: Wire) => r.role).sort());
  assert.deepEqual(roles, Object.keys(candidate.liveInvariants).sort());
  for (const r of selectors.members) assert.equal(candidate.liveInvariants[r.role], r.liveInvariant);
}
export function requireAccepted(results: Wire[], roles: string[], teardown: Wire) {
  assert.deepEqual(results.map(r => r.case), ['boolean', 'mapping', 'core']);
  assert.ok(results.every(r => r.verdict === 'passed' && r.pairedReadback === true));
  assert.equal(teardown.bound, false); assert.equal(teardown.busy, false); assert.equal(teardown.nativeUnfinished, false);
  assert.equal(teardown.timeoutLocked, false); assert.equal(teardown.failed, false); assert.equal(teardown.phase, 3);
  assert.equal(teardown.foreignOwner, false);
  const proved = results.flatMap(r => r.roles).sort();
  assert.deepEqual(proved, [...roles].sort());
  assert.equal(new Set(proved).size, roles.length);
}
export function verifyCounterTrace(trace: Wire[]) {
  assert.ok(Array.isArray(trace) && trace.length <= 16);
  const before = trace.find(r => r.stage === 'before');
  const owned = trace.filter(r => r.stage === 'owned' || r.stage === 'same-owned-edit');
  const after = trace.at(-1);
  assert.ok(before && owned.length >= 3 && after?.stage === 'idle');
  for (const row of [before, ...owned, after]) {
    assert.equal(row.longer, 0); assert.equal(row.locks, 0); assert.equal(row.lockSet, false);
    const active = row.stage === 'owned' || row.stage === 'same-owned-edit';
    assert.equal(row.frames, active ? 1 : 0); assert.equal(row.instant, active ? 1 : 0); assert.equal(row.active, active);
  }
  assert.ok(trace.some(r => r.stage === 'label' && typeof r.label === 'string' && r.label.length > 0));
}
export async function runDoctorCase(request: Request, target: Wire, candidate: Wire,
  save: (name: string, value: unknown) => void, fingerprint: string, roles: string[]): Promise<Wire> {
  const kind = candidate.case as 'boolean' | 'mapping' | 'core';
  assert.ok(['boolean', 'mapping', 'core'].includes(kind));
  const actions = kind === 'core' ? CORE_ACTIONS : kind === 'boolean'
    ? ['boolean-enable', 'boolean-restore'] : ['mapping-remove', 'mapping-restore'];
  const status = await request('probe.gridRead', { operation: 'doctorStatus' });
  assert.equal(status.marker, MARKER); assert.equal(status.bound, false); assert.equal(status.failed, false);
  assert.equal(status.metadata.fingerprint, fingerprint);
  let session: string | undefined, attempted = false, initial: Wire | undefined;
  try {
    const selection = await request('selection.status');
    const bound = await request('probe.gridRead', { ...target, operation: 'doctorBind', case: kind,
      consent: CONSENT, fingerprint, selectionRevision: selection.revision });
    save('bind', bound); assert.equal(bound.marker, MARKER); session = bound.session;
    assert.equal(typeof session, 'string');
    for (let stage = 0; stage <= actions.length; stage++) {
      let pair: Wire | undefined;
      for (let i = 0; i < 2; i++) {
        const r = await request('probe.gridRead', { operation: 'doctorRead', session });
        save(`stage-${stage}-read-${i}`, r); assert.equal(r.marker, MARKER); assert.equal(r.session, session);
        assert.equal(r.status.locked, false);
        initial ??= structuredClone(r.snapshot);
        if (kind !== 'core') validateSnapshot(initial!, r.snapshot, kind as Case, stage);
        else {
          assert.equal(r.snapshot.graph.complete, true); assert.equal(r.snapshot.graph.errorCount, 0);
          if (stage === actions.length) {
            assert.deepEqual(r.snapshot.graph.nodes, initial!.graph.nodes);
            assert.deepEqual(r.snapshot.witness, initial!.witness);
          }
        }
        if (pair) assert.deepEqual(r.snapshot, pair, 'doctor-independent-pair');
        pair = r.snapshot;
      }
      if (stage < actions.length) {
        attempted = true;
        const r = await request('probe.gridModuleAttach', { operation: 'doctorCommand', session, action: actions[stage] });
        save(`stage-${stage}-command`, r); assert.equal(r.status.locked, false);
        assert.equal(r.receipt.commandReturned, true); assert.equal(r.receipt.readback, 'pending-independent-pair');
        if (actions[stage] === 'attach') verifyCounterTrace(r.receipt.transaction.editTrace);
        if (actions[stage] === 'undo-delete' || actions[stage] === 'undo-attach')
          assert.equal(r.receipt.documentUndoContextVerified, true);
      }
    }
    const released = await request('probe.gridRead', { operation: 'doctorRelease', session }); save('released', released);
    assert.equal(released.bound, false); assert.equal(released.failed, false);
    return { case: kind, verdict: 'passed', pairedReadback: true, roles,
      commands: actions.length, reads: 2 * (actions.length + 1) };
  } catch (error) {
    const state = await request('probe.gridRead', { operation: 'doctorStatus' }); save('failure-status', state);
    session ??= state.session;
    if (session && !state.busy && !state.nativeUnfinished && !state.timeoutLocked && !attempted
      && state.attempted !== true && !(state.commands > 0)) {
      save('cancelled', await request('probe.gridRead', { operation: 'doctorRelease', session, cancel: true }));
      return { case: kind, verdict: 'refused-before-command', error: String(error), roles: [] };
    }
    if (session && state.locked && !state.busy && !state.nativeUnfinished) {
      try { save('inspection', await request('probe.gridRead', { operation: 'doctorInspect', session })); }
      catch (inspection) { save('inspection-error', { error: String(inspection) }); }
    }
    throw error;
  }
}
async function main() {
  const [output, consent] = process.argv.slice(2);
  assert.equal(process.argv.length, 4); assert.ok(output && isAbsolute(output)); assert.equal(consent, CONSENT);
  const tableData = join(DATA, 'v20-preparation');
  const candidate = load(join(tableData, 'candidate.json')), selectors = load(join(tableData, 'selectors.json'));
  requireCandidate(candidate, selectors);
  assert.equal(candidate.selectorSha256, createHash('sha256').update(readFileSync(join(tableData, 'selectors.json'))).digest('hex'));
  const jar = realpathSync(candidate.jarPath), stat = statSync(jar, { bigint: true });
  assert.equal(jar, candidate.jarPath); assert.equal(stat.size, BigInt(candidate.counts.jarBytes));
  assert.equal(stat.mtimeNs, BigInt(candidate.jarMtimeNsText));
  assert.equal(createHash('sha256').update(readFileSync(jar)).digest('hex'), candidate.jarSha256);
  const fingerprint = `${candidate.jarSha256}:${candidate.counts.jarBytes}:${candidate.jarMtimeNsText}`;
  const roles = candidate.members.map((r: Wire) => r.role) as string[];
  const groups: Record<string, string[]> = {
    boolean: ['boolean-command'], mapping: ['remove-mapping', 'restore-mapping', 'target-domain', 'domain-extent'],
    core: roles.filter(r => !['boolean-command', 'remove-mapping', 'restore-mapping', 'target-domain', 'domain-extent'].includes(r)),
  };
  const attempts = join(ROOT, '.local/grid-doctor'); mkdirSync(attempts, { recursive: true });
  const key = createHash('sha256').update(fingerprint).digest('hex');
  await runSurvey(['gn-grid-spike', output, join(DATA, 'plan.json')], {
    marker: MARKER, stopOnRefusal: true, budget: { calls: 1500, milliseconds: 900_000, bytes: 64 * 1024 * 1024 },
    async prepare(request, save) {
      const host = await request('host.info'); assert.equal(host.hostVersion, '6.0.6');
      const prepared = await request('probe.gridRead', { operation: 'doctorPrepare' }); save('doctor-prepared', { host, prepared });
      assert.equal(prepared.marker, MARKER); assert.equal(prepared.metadata.fingerprint, fingerprint);
      assert.equal(prepared.metadata.selectorSha256, candidate.selectorSha256);
      assert.equal(prepared.metadata.members, 76); assert.equal(prepared.metadata.types, 55);
      assert.equal(prepared.used, false); assert.equal(prepared.failed, false);
      recordRevisedAttempt(attempts, key, fingerprint, consent!, readFileSync(join(DATA, 'attempt-record.json')),
        { host, output });
    },
    run: (request, target, c, save) => runDoctorCase(request, target, c, save, fingerprint, groups[c.case]!),
    async complete(request, results, before, after) {
      assert.deepEqual(after, before);
      const state = await request('probe.gridRead', { operation: 'doctorStatus' });
      requireAccepted(results, roles, state);
      const accepted = { fingerprint, selectorSha256: candidate.selectorSha256, hostVersion: '6.0.6',
        verdict: 'accepted', roles: results, teardown: state, baselineVerified: true,
        completed: new Date().toISOString(), evidence: output, writeAuthority: false };
      // This cache is research evidence. Product paths do not consume it.
      writeFileSync(join(attempts, `${key}.accepted.json`), JSON.stringify(accepted, null, 2) + '\n', { flag: 'wx' });
      writeFileSync(join(output, 'accepted.json'), JSON.stringify(accepted, null, 2) + '\n', { flag: 'wx' });
    },
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
