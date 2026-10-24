import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  DOCTOR_ROLES, DOCTOR_ROLE_COUNT, GridAdmissionRefusedError, acceptedCacheFile, admissionNextStep, fingerprintJar,
  readGridAdmission, requireGridWriteAdmission, validateAcceptedRecord,
} from './admission.js';

const ROOT = join(import.meta.dirname, '../../..');
const E342 = join(ROOT, 'context/evidence/data/phase9b-doctor/614-third-pass/live-v21-third-pass/accepted.json');
const E316 = join(ROOT, 'context/evidence/data/phase9b-doctor/live-v20/accepted.json');

const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

function fixture(): { dir: string; jar: string; cache: string } {
  const dir = mkdtempSync(join(tmpdir(), 'gn-grid-admission-'));
  const jar = join(dir, 'bitwig.jar');
  writeFileSync(jar, Buffer.from('not a real jar, only bytes with a stable hash'));
  const cache = join(dir, 'cache');
  return { dir, jar, cache };
}

/** The E342 record rewritten for the fixture jar: the same cases, roles, and teardown. */
function acceptedFor(jarPath: string, over: Record<string, unknown> = {}): Record<string, unknown> {
  const record = JSON.parse(readFileSync(E342, 'utf8')) as Record<string, unknown>;
  return { ...record, fingerprint: fingerprintJar(jarPath).fingerprint, ...over };
}

test('the fingerprint is sha256:bytes:mtimeNs and is cached for an unchanged file', () => {
  const { dir, jar } = fixture();
  try {
    const first = fingerprintJar(jar);
    const bytes = readFileSync(jar);
    assert.equal(first.sha256, sha256(bytes));
    assert.equal(first.fingerprint, `${first.sha256}:${bytes.length}:${first.mtimeNs}`);
    assert.equal(first.key, sha256(Buffer.from(first.fingerprint)));
    assert.equal(fingerprintJar(jar), first, 'same object for an unchanged file');
    writeFileSync(jar, Buffer.from('changed bytes of the same length!!!!!!!!!!!!!!!!'));
    utimesSync(jar, new Date(0), new Date(1_700_000_000_000));
    const second = fingerprintJar(jar);
    assert.notEqual(second.sha256, first.sha256);
    assert.notEqual(second.fingerprint, first.fingerprint);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('the committed E342 and E316 records validate against their own fingerprints', () => {
  for (const [file, version] of [[E342, '6.1.4'], [E316, '6.0.6']] as const) {
    const record = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
    const [sha, bytes, mtimeNs] = (record['fingerprint'] as string).split(':') as [string, string, string];
    const jar = { path: '/x', sha256: sha, bytes: Number(bytes), mtimeNs, fingerprint: record['fingerprint'] as string, key: 'k' };
    const checked = validateAcceptedRecord(record, file, jar, version);
    assert.ok('cache' in checked, JSON.stringify(checked));
    assert.equal(checked.cache.roles, DOCTOR_ROLE_COUNT);
    assert.equal(checked.cache.cases, 3);
    assert.equal(checked.cache.hostVersion, version);
    const wrongHost = validateAcceptedRecord(record, file, jar, '7.0.0');
    assert.ok('problem' in wrongHost && wrongHost.problem.startsWith('the record is for host'));
  }
});

test('the gate refuses without a cached pass, with an invalid record, and with another host version', () => {
  const { dir, jar, cache } = fixture();
  try {
    const missing = readGridAdmission({ jarPath: jar, cacheDirectory: cache, hostVersion: '6.1.4' });
    assert.equal(missing.verdict, 'refused');
    assert.equal(missing.verdict === 'refused' && missing.reason, 'no-cached-pass');
    assert.throws(() => requireGridWriteAdmission({ jarPath: jar, cacheDirectory: cache }), GridAdmissionRefusedError);
    assert.match(admissionNextStep(missing), /consent-gated doctor pass/);

    const file = acceptedCacheFile(cache, fingerprintJar(jar));
    const write = (record: unknown) => {
      mkdirSync(cache, { recursive: true });
      writeFileSync(file, JSON.stringify(record));
    };
    const cases: [string, Record<string, unknown>, string][] = [
      ['verdict', { verdict: 'refused' }, 'cache-invalid'],
      ['write authority', { writeAuthority: true }, 'cache-invalid'],
      ['baseline', { baselineVerified: false }, 'cache-invalid'],
      ['no cases', { roles: [] }, 'cache-invalid'],
      ['locked teardown', { teardown: { released: true, locked: true, failure: '' } }, 'cache-invalid'],
      ['unreleased teardown', { teardown: { released: false, locked: false, failure: '' } }, 'cache-invalid'],
      ['teardown failure', { teardown: { released: true, locked: false, failure: 'doctor-pair-differs' } }, 'cache-invalid'],
      ['host version', { hostVersion: '6.0.6' }, 'host-version-differs'],
    ];
    for (const [label, over, reason] of cases) {
      write(acceptedFor(jar, over));
      const admission = readGridAdmission({ jarPath: jar, cacheDirectory: cache, hostVersion: '6.1.4' });
      assert.equal(admission.verdict, 'refused', label);
      assert.equal(admission.verdict === 'refused' && admission.reason, reason, label);
    }
    const base = acceptedFor(jar);
    const roles = structuredClone(base['roles']) as Record<string, unknown>[];
    (roles[2]!['roles'] as string[]).pop();
    write({ ...base, roles });
    const fewer = readGridAdmission({ jarPath: jar, cacheDirectory: cache, hostVersion: '6.1.4' });
    assert.ok(fewer.verdict === 'refused' && fewer.detail.includes('75 roles passed')
      && fewer.detail.includes('misses 1: journal-recording-edit'), fewer.verdict === 'refused' ? fewer.detail : '');
    // The same count of unrelated names is not coverage.
    const unrelated = structuredClone(base['roles']) as Record<string, unknown>[];
    unrelated[2]!['roles'] = (unrelated[2]!['roles'] as string[]).map((role) => `other-${role}`);
    write({ ...base, roles: unrelated });
    const renamed = readGridAdmission({ jarPath: jar, cacheDirectory: cache, hostVersion: '6.1.4' });
    assert.ok(renamed.verdict === 'refused' && renamed.reason === 'cache-invalid' && renamed.detail.includes('misses 71'));
    assert.equal(DOCTOR_ROLES.length, DOCTOR_ROLE_COUNT);
    assert.equal(new Set(DOCTOR_ROLES).size, DOCTOR_ROLE_COUNT);
    const failed = structuredClone(base['roles']) as Record<string, unknown>[];
    failed[0]!['verdict'] = 'failed';
    write({ ...base, roles: failed });
    assert.equal(readGridAdmission({ jarPath: jar, cacheDirectory: cache, hostVersion: '6.1.4' }).verdict, 'refused');
    write({ ...base, fingerprint: 'other:1:2' });
    assert.equal(readGridAdmission({ jarPath: jar, cacheDirectory: cache }).verdict, 'refused');
    writeFileSync(file, '{not json');
    const unreadable = readGridAdmission({ jarPath: jar, cacheDirectory: cache });
    assert.equal(unreadable.verdict === 'refused' && unreadable.reason, 'cache-unreadable');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('the gate admits a complete accepted record for the exact fingerprint and host version', () => {
  const { dir, jar, cache } = fixture();
  try {
    mkdirSync(cache, { recursive: true });
    writeFileSync(acceptedCacheFile(cache, fingerprintJar(jar)), JSON.stringify(acceptedFor(jar)));
    const admission = requireGridWriteAdmission({ jarPath: jar, cacheDirectory: cache, hostVersion: '6.1.4' });
    assert.equal(admission.verdict, 'admitted');
    assert.equal(admission.cache.roles, DOCTOR_ROLE_COUNT);
    assert.equal(admission.cache.marker, '9b-grid-doctor-v21');
    assert.equal(admission.cache.guardsSha256, 'd14cf2f564cc5b2b534bef726dce9b4c5e8e03db0cdabe4a52431c88be3cf819');
    assert.equal(admission.jar.path, realpathSync(jar));
    // Without a host version (the fake adapter) the record's version is not cross-checked.
    assert.equal(readGridAdmission({ jarPath: jar, cacheDirectory: cache, hostVersion: null }).verdict, 'admitted');
    assert.equal(admissionNextStep(admission), 'Native Grid writes are admitted on this build.');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('an unreadable jar path refuses before any cache read', () => {
  const admission = readGridAdmission({ jarPath: '/no/such/bitwig.jar', cacheDirectory: '/no/such/cache' });
  assert.equal(admission.verdict === 'refused' && admission.reason, 'jar-unreadable');
  assert.equal(admission.jar, null);
  assert.match(admissionNextStep(admission), /GHOSTNOTE_BITWIG_JAR/);
});
