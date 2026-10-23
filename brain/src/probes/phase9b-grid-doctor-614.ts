/**
 * V21: one consent-gated, guarded doctor pass on the Bitwig 6.1.4 fingerprint (D52).
 * The V20 driver (phase9b-grid-doctor.ts) stays pinned to 6.0.6 and its E313 retry record.
 * This driver uses its own candidate directory, first-attempt policy, guard receipt checks,
 * and timing comparison. A durable attempt file prevents automatic retries.
 * Argv: <new absolute output directory> <consent>. This is a live writer.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, realpathSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runSurvey } from './phase9b-grid-survey.js';
import { validateSnapshot, fixtureRuntime, type Case } from './phase9b-grid-writes.js';
import { CORE_ACTIONS, requireAccepted, verifyCounterTrace } from './phase9b-grid-doctor.js';
import type { Request, Wire } from './phase9b-grid-survey-read.js';

export const MARKER = '9b-grid-doctor-v21';
export const HOST_VERSION = '6.1.4';
export const CONSENT = 'I saved first. I consent to one guarded scratch doctor pass on the 6.1.4 fingerprint, including boolean and mapping checks and the cold first factory call. A failed check can require a Bitwig restart.';
export const GUARD_FORMAT = 'grid-doctor-guards-v1';
export const GUARD_FIELD_ROLES = ['helper-list', 'pending-helper', 'pending-list', 'disposal-tracking-flag',
  'listener-tracking-flag'];
export const GUARD_CHECKS = ['projectDocumentClass', 'sameManager', 'helperList', 'pendingHelper', 'pendingList',
  'disposalTrackingFalse', 'listenerTrackingFalse'];
export const OWNED_TREE_NODES = 77;
const ROOT = join(import.meta.dirname, '../../..');
export const DATA = join(ROOT, 'context/evidence/data/phase9b-doctor');
export const CANDIDATE_DIRECTORY = join(DATA, '614-guarded');
export const ATTEMPTS = join(ROOT, '.local/grid-doctor');
const OLD_KEY = 'fd829f5381cd55021de542d9581accfb20ca82ed2c975c3863a562fe083ed87a';
/** The 6.0.6 records in the attempt directory and their committed copies (relative to DATA). */
export const OLD_RECORDS: [string, string][] = [
  [`${OLD_KEY}.attempt.json`, 'attempt-record.json'],
  [`${OLD_KEY}.v20.attempt.json`, 'live-v20/attempt-record.json'],
  [`${OLD_KEY}.accepted.json`, 'live-v20/accepted.json'],
];
/** The single admitted retry after a preflight refusal with no scratch write and no bind. */
export const RETRY_CONSENT = 'No scratch track was created and the doctor was never bound in the refused preflight. I consent to one guarded scratch doctor pass on the 6.1.4 fingerprint as the single retry after that refusal.';
/** Preflight refusals that happen before any scratch write: the control-read jar pin and the control comparison. */
export const REFUSED_PREFLIGHT_ERRORS = ['BridgeError: Internal error: unsupported-host-jar:',
  'AssertionError [ERR_ASSERTION]: baseline-control-disagrees'];
export type Timing = { action: string; nativeCommandNanos: number };
export type TimingRow = { action: string; e316Nanos: number | null; v21Nanos: number;
  percentChange: number | null; over20Percent: boolean };

const sha256 = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
const load = (path: string): Wire => {
  assert.ok(statSync(path).size <= 128 * 1024, 'doctor-input-limit');
  return JSON.parse(readFileSync(path, 'utf8'));
};

/** Record the first attempt for a fingerprint. Any earlier record with the same key is a refusal. */
export function recordFirstAttempt(directory: string, key: string, fingerprint: string, consent: string,
  details: Wire) {
  assert.equal(consent, CONSENT, 'guarded-pass-consent-required');
  assert.ok(!readdirSync(directory).some(name => name.startsWith(`${key}.`)), 'attempt-already-recorded');
  writeFileSync(join(directory, `${key}.attempt.json`), JSON.stringify({ ...details, fingerprint, consent,
    marker: MARKER, hostVersion: HOST_VERSION, started: new Date().toISOString(), writeAuthority: false },
  null, 2) + '\n', { flag: 'wx' });
}

export const MAX_REFUSED_PREFLIGHTS = 6;
const attemptName = (key: string, ordinal: number) => `${key}.attempt${ordinal === 1 ? '' : `-${ordinal}`}.json`;
/**
 * Prior attempt records admit a retry only when every one of them proves that no scratch track was
 * created, no doctor bind happened, and the failure was a control-read jar refusal. The evidence
 * directories are given in attempt order. Returns each record's SHA-256. Records are never changed.
 */
export function requireRefusedPreflights(directory: string, key: string, priorEvidence: string[]): string[] {
  assert.ok(priorEvidence.length >= 1 && priorEvidence.length < MAX_REFUSED_PREFLIGHTS, 'refused-preflight-limit');
  assert.ok(!existsSync(join(directory, `${key}.accepted.json`)), 'already-accepted');
  assert.ok(!existsSync(join(directory, attemptName(key, priorEvidence.length + 1))), 'retry-already-recorded');
  return priorEvidence.map((evidence, i) => {
    const priorPath = join(directory, attemptName(key, i + 1));
    assert.ok(existsSync(priorPath), `prior-attempt-missing:${i + 1}`);
    const priorBytes = readFileSync(priorPath);
    const prior = JSON.parse(priorBytes.toString('utf8'));
    assert.equal(prior.output, evidence, 'prior-evidence-mismatch');
    assert.equal(prior.marker, MARKER); assert.equal(prior.hostVersion, HOST_VERSION); assert.equal(prior.writeAuthority, false);
    const exit = load(join(evidence, 'exit.json'));
    assert.equal(exit.scratch, null, 'prior-scratch-remains'); assert.equal(exit.uncertain, false, 'prior-pass-uncertain');
    const failure = load(join(evidence, 'failure.json'));
    assert.equal(failure.uncertain, false, 'prior-failure-uncertain');
    const files = readdirSync(evidence);
    // No native command receipt or inspection may exist. A bound case that refused on its first read
    // is recorded as refused-before-command with no roles.
    assert.ok(!files.some(name => /^preset-\d+-stage-\d+-command/.test(name) || /^preset-\d+-inspection/.test(name)),
      'prior-pass-ran-a-command');
    if (exit.completedPresets === 0) {
      assert.ok(typeof failure.error === 'string' && REFUSED_PREFLIGHT_ERRORS.some(e => failure.error.startsWith(e)), 'prior-failure-kind');
      assert.ok(!files.some(name => name.startsWith('preset-')), 'prior-pass-reached-a-preset');
    } else {
      const results = load(join(evidence, 'results.json'));
      assert.ok(Array.isArray(results) && results.length === exit.completedPresets, 'prior-results-missing');
      for (const r of results) {
        assert.equal(r.verdict, 'refused-before-command', 'prior-case-not-refused-before-command');
        assert.deepEqual(r.roles, [], 'prior-case-roles');
      }
      assert.deepEqual(load(join(evidence, 'after.json')), load(join(evidence, 'before.json')), 'prior-preserved-state-differs');
    }
    return sha256(priorBytes);
  });
}

/** Record the retry as the next numbered attempt. Both consent strings are the operator's exact answers. */
export function recordRetryAttempt(directory: string, key: string, fingerprint: string, consent: string,
  retryConsent: string, priorEvidence: string[], details: Wire) {
  assert.equal(consent, CONSENT, 'guarded-pass-consent-required');
  assert.equal(retryConsent, RETRY_CONSENT, 'retry-consent-required');
  const priorAttemptSha256 = requireRefusedPreflights(directory, key, priorEvidence);
  writeFileSync(join(directory, attemptName(key, priorEvidence.length + 1)), JSON.stringify({ ...details, fingerprint,
    consent, retryConsent, priorAttemptSha256, priorEvidence, marker: MARKER, hostVersion: HOST_VERSION,
    started: new Date().toISOString(), writeAuthority: false }, null, 2) + '\n', { flag: 'wx' });
}

/** The 6.0.6 records must stay byte-equal to their committed copies. Do not repair them. */
export function requireOldRecordsPreserved(directory: string, data = DATA) {
  for (const [local, committed] of OLD_RECORDS) {
    const path = join(directory, local);
    assert.ok(existsSync(path), `old-record-missing:${local}`);
    assert.ok(readFileSync(path).equals(readFileSync(join(data, committed))), `old-record-changed:${local}`);
  }
}

export function requireCandidate(candidate: Wire, selectors: Wire, guards: Wire) {
  assert.equal(candidate.result, 'pass'); assert.equal(candidate.verdict.structuralValidation, 'pass');
  assert.equal(candidate.verdict.liveValidation, 'not-run'); assert.equal(candidate.verdict.writeAuthority, false);
  assert.equal(Object.keys(candidate.types).length, 55); assert.equal(candidate.members.length, 76);
  const roles = candidate.members.map((r: Wire) => r.role).sort();
  assert.equal(new Set(roles).size, 76);
  assert.deepEqual(roles, selectors.members.map((r: Wire) => r.role).sort());
  assert.deepEqual(roles, Object.keys(candidate.liveInvariants).sort());
  for (const r of selectors.members) assert.equal(candidate.liveInvariants[r.role], r.liveInvariant);
  assert.equal(candidate.source?.hostVersion, HOST_VERSION, 'candidate-host-version');
  assert.deepEqual(candidate.source.variants, selectors.variants, 'candidate-variants-differ');
  assert.equal(candidate.source.variants.length, 1, 'one-variant-required');
  const [variant] = candidate.source.variants;
  assert.equal(variant.role, 'journal-recording-edit'); assert.equal(variant.from, 2); assert.equal(variant.to, 0);
  const journal = candidate.members.filter((r: Wire) => r.role === 'journal-recording-edit');
  assert.equal(journal.length, 1); assert.equal(journal[0].flags, 0, 'journal-recording-edit-flags');
  assert.equal(guards.format, GUARD_FORMAT); assert.equal(guards.jarSha256, candidate.jarSha256, 'guards-jar');
  assert.equal(Object.keys(guards.types).length, 1); assert.equal(typeof guards.types['project-document'], 'string');
  assert.equal(guards.fields.length, 5);
  assert.deepEqual(guards.fields.map((f: Wire) => f.role).sort(), [...GUARD_FIELD_ROLES].sort());
  for (const f of guards.fields) assert.ok(['empty', 'null', 'false'].includes(f.check), 'guard-check');
  assert.equal(guards.ownedTree.classes.length, 33);
  const managed = guards.ownedTree.classes.filter((c: Wire) => c.managed === true).map((c: Wire) => c.name);
  assert.equal(managed.length, 1, 'one-managed-class');
  assert.deepEqual(guards.ownedTree.managed, managed); assert.equal(guards.ownedTree.managedNodes, 1);
}

/** Check one guard receipt. A failed guard refuses before the next stage. */
export function requireGuardReceipt(action: string, guards: Wire) {
  assert.ok(guards && typeof guards === 'object', 'guard-receipt-missing');
  assert.equal(guards.passed, true, 'guard-not-passed');
  for (const check of GUARD_CHECKS) assert.equal(guards.checks?.[check], true, `guard-check:${check}`);
  for (const [check, value] of Object.entries(guards.checks)) assert.equal(value, true, `guard-check:${check}`);
  assert.ok(Number.isFinite(guards.guardNanos) && guards.guardNanos >= 0, 'guard-nanos');
  if (action === 'factory-dispose') {
    const tree = guards.ownedTree;
    assert.equal(tree?.passed, true, 'owned-tree-not-passed');
    assert.equal(tree.nodes, OWNED_TREE_NODES, 'owned-tree-nodes'); assert.equal(tree.managed, 1, 'owned-tree-managed');
    assert.ok(Number.isInteger(tree.depth) && tree.depth >= 0 && tree.depth <= 12, 'owned-tree-depth');
  }
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
  // Breadth snapshot rules compare the resolved runtime class names of this build, not the 6.0.6 names.
  const runtime = kind === 'core' ? undefined : fixtureRuntime(candidate);
  let session: string | undefined, attempted = false, initial: Wire | undefined;
  const timings: Timing[] = [];
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
        if (kind !== 'core') validateSnapshot(initial!, r.snapshot, kind as Case, stage, runtime);
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
        const action = actions[stage]!;
        attempted = true;
        const r = await request('probe.gridModuleAttach', { operation: 'doctorCommand', session, action });
        save(`stage-${stage}-command`, r); assert.equal(r.status.locked, false);
        assert.equal(r.receipt.commandReturned, true); assert.equal(r.receipt.readback, 'pending-independent-pair');
        requireGuardReceipt(action, r.receipt.guards);
        if (action === 'attach') verifyCounterTrace(r.receipt.transaction.editTrace);
        if (action === 'undo-delete' || action === 'undo-attach')
          assert.equal(r.receipt.documentUndoContextVerified, true);
        // Timing is data only. It never blocks the pass or causes a repeat.
        if (Number.isFinite(r.receipt.nativeCommandNanos))
          timings.push({ action, nativeCommandNanos: r.receipt.nativeCommandNanos });
      }
    }
    const released = await request('probe.gridRead', { operation: 'doctorRelease', session }); save('released', released);
    assert.equal(released.bound, false); assert.equal(released.failed, false);
    return { case: kind, verdict: 'passed', pairedReadback: true, roles,
      commands: actions.length, reads: 2 * (actions.length + 1), timings };
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

export type PrepareContext = {
  attempts: string; key: string; fingerprint: string; consent: string; selectorSha256: string;
  guardsSha256: string; candidateSha256: string; output: string; data?: string;
  retry?: { priorEvidence: string[]; retryConsent: string };
};
/** Check the host and the prepared doctor, then record the first attempt. */
export async function prepareDoctor(request: Request, save: (name: string, value: unknown) => void,
  context: PrepareContext) {
  const host = await request('host.info');
  assert.equal(host.hostVersion, HOST_VERSION, 'host-version-614-required');
  requireOldRecordsPreserved(context.attempts, context.data);
  const prepared = await request('probe.gridRead', { operation: 'doctorPrepare' }); save('doctor-prepared', { host, prepared });
  assert.equal(prepared.marker, MARKER); assert.equal(prepared.metadata.fingerprint, context.fingerprint);
  assert.equal(prepared.metadata.selectorSha256, context.selectorSha256);
  assert.equal(prepared.metadata.members, 76); assert.equal(prepared.metadata.types, 55);
  assert.equal(prepared.used, false); assert.equal(prepared.failed, false);
  if (context.retry) { assert.equal(prepared.phase, 0, 'retry-needs-unused-doctor'); assert.equal(prepared.bound, false); }
  const g = prepared.guards;
  assert.equal(g?.format, GUARD_FORMAT); assert.equal(g.types, 1); assert.equal(g.fields, 5);
  assert.equal(g.ownedTreeClasses, 33);
  assert.equal(g.guardsSha256, context.guardsSha256, 'host-guards-differ');
  assert.equal(g.candidateSha256, context.candidateSha256, 'host-candidate-differs');
  const details = { host, output: context.output, guardsSha256: context.guardsSha256, candidateSha256: context.candidateSha256 };
  if (context.retry) recordRetryAttempt(context.attempts, context.key, context.fingerprint, context.consent,
    context.retry.retryConsent, context.retry.priorEvidence, details);
  else recordFirstAttempt(context.attempts, context.key, context.fingerprint, context.consent, details);
}

/** Read the E316 command sample (V20 on 6.0.6), in preset and stage order. */
export function loadE316Sample(directory = join(DATA, 'live-v20')): Timing[] {
  const pattern = /^preset-(\d+)-stage-(\d+)-command\.json$/;
  return readdirSync(directory).flatMap(name => {
    const m = pattern.exec(name); return m ? [{ name, preset: Number(m[1]), stage: Number(m[2]) }] : [];
  }).sort((a, b) => a.preset - b.preset || a.stage - b.stage).map(({ name }) => {
    const receipt = load(join(directory, name)).receipt;
    return { action: receipt.action, nativeCommandNanos: receipt.nativeCommandNanos };
  });
}

/** Compare V21 command times with the E316 sample. The result is data; it is not a gate. */
export function compareTiming(baseline: Timing[], current: Timing[]): TimingRow[] {
  const prior = new Map(baseline.map(r => [r.action, r.nativeCommandNanos]));
  return current.map(({ action, nativeCommandNanos }) => {
    const e316 = prior.get(action);
    const percentChange = e316 && e316 > 0 ? (nativeCommandNanos - e316) / e316 * 100 : null;
    return { action, e316Nanos: e316 ?? null, v21Nanos: nativeCommandNanos, percentChange,
      over20Percent: percentChange !== null && percentChange > 20 };
  });
}

async function main() {
  const [output, consent, retryFlag, priorEvidence, retryConsent] = process.argv.slice(2);
  assert.ok(process.argv.length === 4 || process.argv.length === 7, 'argv: <output> <consent> [--retry-after-refused-preflight <prior evidence dirs, comma separated> <retry consent>]');
  assert.ok(output && isAbsolute(output)); assert.equal(consent, CONSENT);
  const retry = process.argv.length === 7 ? { priorEvidence: priorEvidence!.split(','), retryConsent: retryConsent! } : undefined;
  if (retry) { assert.equal(retryFlag, '--retry-after-refused-preflight'); assert.ok(retry.priorEvidence.every(isAbsolute)); assert.equal(retry.retryConsent, RETRY_CONSENT); }
  const candidateBytes = readFileSync(join(CANDIDATE_DIRECTORY, 'candidate.json'));
  const guardsBytes = readFileSync(join(CANDIDATE_DIRECTORY, 'guards.json'));
  const candidate = load(join(CANDIDATE_DIRECTORY, 'candidate.json'));
  const selectors = load(join(CANDIDATE_DIRECTORY, 'selectors.json'));
  const guards = load(join(CANDIDATE_DIRECTORY, 'guards.json'));
  requireCandidate(candidate, selectors, guards);
  const candidateSha256 = sha256(candidateBytes), guardsSha256 = sha256(guardsBytes);
  assert.equal(guards.candidateSha256, candidateSha256, 'guards-candidate-differs');
  assert.equal(candidate.selectorSha256, sha256(readFileSync(join(CANDIDATE_DIRECTORY, 'selectors.json'))));
  const jar = realpathSync(candidate.jarPath), stat = statSync(jar, { bigint: true });
  assert.equal(jar, candidate.jarPath); assert.equal(stat.size, BigInt(candidate.counts.jarBytes));
  assert.equal(stat.mtimeNs, BigInt(candidate.jarMtimeNsText));
  assert.equal(sha256(readFileSync(jar)), candidate.jarSha256);
  const fingerprint = `${candidate.jarSha256}:${candidate.counts.jarBytes}:${candidate.jarMtimeNsText}`;
  const roles = candidate.members.map((r: Wire) => r.role) as string[];
  const groups: Record<string, string[]> = {
    boolean: ['boolean-command'], mapping: ['remove-mapping', 'restore-mapping', 'target-domain', 'domain-extent'],
    core: roles.filter(r => !['boolean-command', 'remove-mapping', 'restore-mapping', 'target-domain', 'domain-extent'].includes(r)),
  };
  mkdirSync(ATTEMPTS, { recursive: true });
  const key = sha256(fingerprint);
  const e316 = loadE316Sample();
  await runSurvey(['gn-grid-spike', output, join(DATA, 'plan.json')], {
    marker: MARKER, stopOnRefusal: true, budget: { calls: 1500, milliseconds: 900_000, bytes: 64 * 1024 * 1024 },
    prepare: (request, save) => prepareDoctor(request, save, { attempts: ATTEMPTS, key, fingerprint, consent: consent!,
      selectorSha256: candidate.selectorSha256, guardsSha256, candidateSha256, output, retry }),
    run: (request, target, c, save) => runDoctorCase(request, target, { ...c, types: candidate.types }, save, fingerprint, groups[c.case]!),
    async complete(request, results, before, after) {
      assert.deepEqual(after, before);
      const state = await request('probe.gridRead', { operation: 'doctorStatus' });
      requireAccepted(results, roles, state);
      requireOldRecordsPreserved(ATTEMPTS);
      const accepted = { fingerprint, selectorSha256: candidate.selectorSha256, hostVersion: HOST_VERSION,
        marker: MARKER, guardsSha256, candidateSha256, retry: retry ?? null, verdict: 'accepted', roles: results, teardown: state,
        baselineVerified: true, completed: new Date().toISOString(), evidence: output, writeAuthority: false };
      // This cache is research evidence. Product paths do not consume it.
      writeFileSync(join(ATTEMPTS, `${key}.accepted.json`), JSON.stringify(accepted, null, 2) + '\n', { flag: 'wx' });
      writeFileSync(join(output, 'accepted.json'), JSON.stringify(accepted, null, 2) + '\n', { flag: 'wx' });
      const rows = compareTiming(e316, results.flatMap(r => r.timings as Timing[]));
      writeFileSync(join(output, 'timing-comparison.json'), JSON.stringify({ baseline: 'E316 live-v20',
        threshold: 20, gate: false, rows }, null, 2) + '\n', { flag: 'wx' });
    },
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
