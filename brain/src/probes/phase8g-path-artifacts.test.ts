import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync, gzipSync } from 'node:zlib';
import { verifyPathArtifacts } from './phase8g-path-artifacts.js';

type Wire = Record<string, unknown>;
interface FileRecord { file: string; uncompressedBytes: number; uncompressedSha256: string }
interface Manifest { files: Record<string, FileRecord>; [key: string]: unknown }
const base = new URL('../../../context/evidence/data/phase8g-selected-replay-and-witnesses/', import.meta.url);
const original = JSON.parse(await readFile(new URL('manifest.json', base), 'utf8')) as Manifest;
const compressed = new Map(await Promise.all(Object.values(original.files).map(async record =>
  [record.file, await readFile(new URL(record.file, base))] as const)));
function fixture(): { manifest: Manifest; files: Map<string, Uint8Array> } {
  return { manifest: structuredClone(original), files: new Map(compressed) };
}
function change(f: ReturnType<typeof fixture>, key: string, mutate: (report: Wire) => void): void {
  const record = f.manifest.files[key]!, value = JSON.parse(gunzipSync(f.files.get(record.file)!).toString()) as Wire;
  mutate(value); const raw = Buffer.from(JSON.stringify(value)); f.files.set(record.file, gzipSync(raw));
  record.uncompressedBytes = raw.byteLength; record.uncompressedSha256 = createHash('sha256').update(raw).digest('hex');
}
function run(f: ReturnType<typeof fixture>) { return verifyPathArtifacts(f.manifest, async name => {
  assert(f.files.has(name), 'requested file must be inside the supplied evidence fixture'); return f.files.get(name)!;
}); }

test('selected path artifacts pass without claiming session or universal identity completion', async () => {
  const result = await run(fixture());
  assert.deepEqual(result.replay, { cases: 26, matches: 26, failures: 0 }); assert.equal(result.shadowV2.cases, 18);
  assert.equal(result.state, 'active'); assert.equal(result.wholeSessionComplete, false); assert.equal(result.eligibilityProved, false);
  assert.equal(result.chains.identityDetectionProved, false); assert(result.chains.captures > 0);
  assert.deepEqual(result.pairedReload, { comparedChains: 4, chainUUIDs: 'same', extensionNonceChanged: true });
  assert.equal(result.copyProof.byteEqualityRecorded, true); assert.equal(result.cleanupBeforeIdentity.fixtureTrackAbsent, true);
});
test('paired reload cannot pass with a missing endpoint or an unchanged extension instance', async () => {
  const missing = fixture(); change(missing, 'chains', report => {
    report.captures = (report.captures as Wire[]).filter(capture => capture.label !== 'A-after-controller-reload');
  });
  await assert.rejects(run(missing), /paired reload needs one/);
  const sameInstance = fixture(); change(sameInstance, 'chains', report => {
    const captures = report.captures as Wire[];
    const before = captures.find(capture => capture.label === 'A-before-controller-reload')!.snapshot as Wire;
    const after = captures.find(capture => capture.label === 'A-after-controller-reload')!;
    (after.snapshot as Wire).extensionInitNonce = before.extensionInitNonce;
    (after.trace as Wire).extensionInitNonce = before.extensionInitNonce;
  });
  await assert.rejects(run(sameInstance), /new extension instance/);
});
test('unsafe names and missing required roles fail before any file read', async () => {
  for (const file of ['../replay.json.gz', '/tmp/replay.json.gz', 'subdir/replay.json.gz', 'subdir\\replay.json.gz',
    'https://example.com/replay.json.gz', '%2e%2e-replay.json.gz', 'replay.json', '.replay.json.gz']) {
    const f = fixture(); f.manifest.files.replay!.file = file; let reads = 0;
    await assert.rejects(verifyPathArtifacts(f.manifest, async () => { reads++; return new Uint8Array(); }), /unsafe artifact/);
    assert.equal(reads, 0);
  }
  for (const key of ['replay', 'shadowV2', 'chains', 'copyProof', 'fixtureState', 'cleanupBeforeIdentity']) {
    const f = fixture(); delete f.manifest.files[key]; let reads = 0;
    await assert.rejects(verifyPathArtifacts(f.manifest, async () => { reads++; return new Uint8Array(); }), /missing required artifact/);
    assert.equal(reads, 0);
  }
});
test('raw byte and checksum changes cannot pass artifact loading', async () => {
  const hash = fixture(); hash.manifest.files.replay!.uncompressedSha256 = '0'.repeat(64);
  await assert.rejects(run(hash), /raw SHA256 changed/);
  const length = fixture(); length.manifest.files.replay!.uncompressedBytes--;
  await assert.rejects(run(length), /raw byte count changed/);
  const broken = fixture(), file = broken.manifest.files.replay!.file;
  broken.files.set(file, Buffer.from('not gzip')); await assert.rejects(run(broken));
  const duplicate = fixture(); duplicate.manifest.files.chains!.file = duplicate.manifest.files.replay!.file;
  await assert.rejects(run(duplicate), /separate filenames/);
});
test('rehashed replay tampering cannot hide unfinished, unrestored, or truncated evidence', async () => {
  for (const mutate of [(r: Wire) => { delete r.ended; }, (r: Wire) => { r.fixtureRestored = false; },
    (r: Wire) => { (r.cases as Wire[]).pop(); }, (r: Wire) => { r.failures = ['hidden refusal']; },
    (r: Wire) => { r.eligible = true; }, (r: Wire) => { (r.info as Wire).observerRegistration = 'addNoteStepObserver'; },
    (r: Wire) => { (r.info as Wire).observerKind = 'NoteStepChangedCallback'; },
    (r: Wire) => { (r.info as Wire).fullComparisonSeedsRecorder = true; }]) {
    const f = fixture(); change(f, 'replay', mutate); await assert.rejects(run(f));
  }
});
test('V2 comparisons use the independent fixture track despite the omitted report owner', async () => {
  const f = fixture(); change(f, 'shadowV2', report => {
    const result = (report.cases as Wire[])[0]!.result as Wire;
    ((result.diagnosticSnapshot as Wire).address as Wire).trackId = 'foreign-track';
  });
  await assert.rejects(run(f), /fixture-address-mismatch/);
  const owner = fixture(); change(owner, 'fixtureState', report => { report.ownedTrackId = 'foreign-track'; });
  await assert.rejects(run(owner), /fixture-address-mismatch/);
});
test('copy proof, chain provenance, cleanup, and active state retain their limits', async () => {
  for (const [key, mutate] of [
    ['copyProof', (r: Wire) => { r.byteIdentical = false; }],
    ['copyProof', (r: Wire) => { (r.files as Wire[]).find(row => row.file === 'identity.bwproject')!.sha256 = 'invalid'; }],
    ['copyProof', (r: Wire) => { r.files = []; }],
    ['chains', (r: Wire) => { r.identityDetectionProved = true; }],
    ['chains', (r: Wire) => { ((r.captures as Wire[])[0]!.snapshot as Wire).instrumentationRevision = 'old-code'; }],
    ['cleanupBeforeIdentity', (r: Wire) => { r.cleaned = false; }],
    ['cleanupBeforeIdentity', (r: Wire) => { (r.tracks as Wire[])[0]!.channelId = 'wrong-baseline-track'; }],
  ] as const) { const f = fixture(); change(f, key, mutate); await assert.rejects(run(f)); }
  for (const state of [{ state: 'complete' }, { wholeSessionComplete: true }, { eligibilityProved: true }]) {
    const f = fixture(); Object.assign(f.manifest, state); await assert.rejects(run(f));
  }
});
test('optional V3 evidence needs both terminal cancellation controls and fixture recovery', async () => {
  const f = fixture(), v2 = f.manifest.files.shadowV2!;
  delete f.manifest.files.mutationWitness;
  const report = JSON.parse(gunzipSync(f.files.get(v2.file)!).toString()) as Wire;
  const marker = '8g-shadow-physical-hints-v3'; (report.initial as Wire).instrumentationRevision = marker;
  const state = JSON.parse(gunzipSync(f.files.get(f.manifest.files.fixtureState!.file)!).toString()) as Wire;
  const newOwner = '66710582-292d-4cfb-8b92-7c1820b5a6d8'; state.ownedTrackId = newOwner; report.ownedTrackId = newOwner;
  const stateRaw = Buffer.from(JSON.stringify(state)), stateFile = 'synthetic-fixture-state-v3.json.gz';
  f.manifest.files.fixtureStateV3 = { file: stateFile, uncompressedBytes: stateRaw.byteLength,
    uncompressedSha256: createHash('sha256').update(stateRaw).digest('hex') }; f.files.set(stateFile, gzipSync(stateRaw));
  for (const arm of report.cases as Wire[]) { const result = arm.result as Wire; result.instrumentationRevision = marker;
    ((result.diagnosticSnapshot as Wire).address as Wire).trackId = newOwner; }
  const recovery = structuredClone((report.cases as Wire[])[0]!);
  report.cancellations = ['retire-between-polls', 'rebind-between-polls'].map(kind => ({ kind,
    active: { comparison: 'pending', scanProgressCoordinates: 1, scanTotalCoordinates: 262144, windowChanges: 2 },
    after: [0, 1].map(() => ({ comparison: 'window-changed', authorityAvailable: false, complete: false, eligible: false,
      readMode: 'refuse', fallbackReason: 'authority-scan-cancelled', windowChanges: 3 })), recovery }));
  const file = 'synthetic-shadow-v3.json.gz', raw = Buffer.from(JSON.stringify(report));
  f.manifest.files.shadowV3 = { file, uncompressedBytes: raw.byteLength, uncompressedSha256: createHash('sha256').update(raw).digest('hex') };
  f.files.set(file, gzipSync(raw)); const result = await run(f);
  assert.equal(result.shadowV3!.cases, 18); assert.equal(result.shadowV3!.cancellationControls, 2);
  assert.equal(result.shadowV3!.fixtureTrackId, newOwner);
  const missingState = { manifest: structuredClone(f.manifest), files: new Map(f.files) }; delete missingState.manifest.files.fixtureStateV3;
  await assert.rejects(run(missingState), /independently retained fixtureStateV3/);
  const wrongBaseline = { manifest: structuredClone(f.manifest), files: new Map(f.files) };
  change(wrongBaseline, 'fixtureStateV3', value => { (value.baselineIds as string[])[0] = 'foreign-baseline'; });
  await assert.rejects(run(wrongBaseline), /V3 baseline track IDs differ/);
  change(f, 'shadowV3', report => { ((report.cancellations as Wire[])[0]!.after as Wire[])[1]!.authorityAvailable = true; });
  await assert.rejects(run(f));
});
