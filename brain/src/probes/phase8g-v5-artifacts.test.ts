import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync, gzipSync } from 'node:zlib';
import { verifyV5Artifacts, type V5ArtifactManifest } from './phase8g-v5-artifacts.js';

type Wire = Record<string, unknown>;
const base = new URL('../../../context/evidence/data/phase8g-v5-acceptance/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', base), 'utf8')) as V5ArtifactManifest;
const compressed = new Map(await Promise.all(Object.values(manifest.files).map(async value =>
  [value.file, await readFile(new URL(value.file, base))] as const)));
const hash = (value: Uint8Array): string => createHash('sha256').update(value).digest('hex');
function fixture() { return { manifest: structuredClone(manifest), files: new Map(compressed) }; }
function rewrite(value: ReturnType<typeof fixture>, key: string, change: (report: Wire) => void): void {
  const record = value.manifest.files[key]!;
  const report = JSON.parse(gunzipSync(value.files.get(record.file)!).toString('utf8')) as Wire;
  change(report);
  const raw = Buffer.from(JSON.stringify(report)), zipped = gzipSync(raw, { level: 9 });
  Object.assign(record, { uncompressedBytes: raw.byteLength, uncompressedSha256: hash(raw), compressedBytes: zipped.byteLength, compressedSha256: hash(zipped) });
  value.files.set(record.file, zipped);
}
function run(value: ReturnType<typeof fixture>) {
  return verifyV5Artifacts(value.manifest, async name => {
    assert(value.files.has(name), 'the checker must load a supplied basename'); return value.files.get(name)!;
  });
}

test('group preflight failure keeps exact empty-track cleanup separate from group acceptance', async () => {
  const summary = await run(fixture());
  assert.equal(summary.diagnosticErrors['diagnostic-group-preflight-error']!.completedGroupControls, 0);
  assert.equal(summary.diagnosticErrors['diagnostic-group-preflight-cleanup']!.fullContentRestorationMeasured, false);
  const native = fixture(); rewrite(native, 'diagnostic-group-preflight-cleanup', report => { report.nativeGroupActionPerformed = true; });
  await assert.rejects(run(native));
  const census = fixture(); rewrite(census, 'diagnostic-group-preflight-cleanup', report => {
    ((report.after as Wire).tracks as Wire[])[0]!.channelId = 'different-track';
  });
  await assert.rejects(run(census), /exact original track census/);
  const empty = fixture(); rewrite(empty, 'diagnostic-group-preflight-cleanup', report => { (report.slots as Wire[])[3]!.hasContent = true; });
  await assert.rejects(run(empty));
  const missing = fixture(); delete missing.manifest.files['diagnostic-group-preflight-cleanup'];
  missing.manifest.retainedReportCounts['diagnostic-group-preflight-cleanup'] = 0;
  await assert.rejects(run(missing), /retain both group preflight files/);
});

test('v5 evidence verifies content, recorded measurements, and the narrow identity fence', async () => {
  const summary = await run(fixture());
  assert.equal(summary.cacheAcceptance.comparisons, 10); assert.equal(summary.cacheAcceptance.consumerControls, 6);
  assert.equal(summary.mutations.cases, 38); assert.equal(summary.mutations.restorationComparisons, 3);
  assert.equal(summary.state, 'active'); assert.equal(summary.wholeSessionComplete, false);
  assert.equal(summary.eligibilityProved, false); assert.equal(summary.identityDetectionProved, false);
  assert.equal(summary.cacheAcceptance.serializedBytesAreMemoryMeasurement, false);
  assert(Object.keys(summary.identityFences).length >= 1);
});

test('v5 artifact paths and declared bounds are checked before any file read', async () => {
  for (const path of ['../cache-acceptance.json.gz', '/tmp/cache-acceptance.json.gz', 'cache-acceptance.json.gz/extra']) {
    const value = fixture(); value.manifest.files['cache-acceptance']!.file = path; let reads = 0;
    await assert.rejects(verifyV5Artifacts(value.manifest, async () => { reads++; return Buffer.alloc(0); }), /unsafe v5 artifact/);
    assert.equal(reads, 0);
  }
  const value = fixture(); value.manifest.files['cache-acceptance']!.uncompressedBytes = 129 * 1024 * 1024;
  await assert.rejects(run(value), /artifact bound/);
});

test('missing main reports and missing retained fence reports cannot silently reduce coverage', async () => {
  for (const key of ['cache-acceptance', 'mutations']) {
    const value = fixture(); delete value.manifest.files[key]; await assert.rejects(run(value), /missing required v5 artifact/);
  }
  const value = fixture(), key = Object.keys(value.manifest.files).find(key => key.startsWith('identity-fence-'))!;
  delete value.manifest.files[key]; await assert.rejects(run(value), /retained report count changed/);
});

test('compressed and raw checksums and exact byte counts reject changed evidence', async () => {
  for (const field of ['compressedSha256', 'uncompressedSha256'] as const) {
    const value = fixture(); value.manifest.files.mutations![field] = '0'.repeat(64); await assert.rejects(run(value), /SHA256 changed/);
  }
  for (const field of ['compressedBytes', 'uncompressedBytes'] as const) {
    const value = fixture(); value.manifest.files.mutations![field]++; await assert.rejects(run(value), /byte count changed/);
  }
});

test('a truncated gzip stream still fails when its compressed checksum is updated', async () => {
  const value = fixture(), record = value.manifest.files.mutations!, old = value.files.get(record.file)!;
  const truncated = old.subarray(0, old.length - 8);
  value.files.set(record.file, truncated); record.compressedBytes = truncated.byteLength; record.compressedSha256 = hash(truncated);
  await assert.rejects(run(value));
});

test('a changed gzip timestamp is rejected as nondeterministic evidence', async () => {
  const value = fixture(), record = value.manifest.files.mutations!, changed = Buffer.from(value.files.get(record.file)!);
  changed[4] = 1; value.files.set(record.file, changed); record.compressedSha256 = hash(changed);
  await assert.rejects(run(value), /gzip timestamp is not deterministic/);
});

test('recomputed checksums cannot hide incomplete runs or shortened live corpora', async () => {
  const incomplete = fixture(); rewrite(incomplete, 'cache-acceptance', report => { delete report.ended; });
  await assert.rejects(run(incomplete), /ended is unavailable/);
  const pool = fixture(); rewrite(pool, 'cache-acceptance', report => { (report.poolCases as Wire[]).pop(); });
  await assert.rejects(run(pool));
  const mutations = fixture(); rewrite(mutations, 'mutations', report => { (report.cases as Wire[]).pop(); });
  await assert.rejects(run(mutations));
  const restoration = fixture(); rewrite(restoration, 'mutations', report => { report.fixtureRestored = false; });
  await assert.rejects(run(restoration));
});

test('stale markers and complete or eligible diagnostic results fail semantic verification', async () => {
  for (const change of [
    (report: Wire) => { (report.initial as Wire).instrumentationRevision = '8g-shadow-physical-hints-v3'; },
    (report: Wire) => { ((report.poolCases as Wire[])[0]!.comparison as Wire).eligible = true; },
    (report: Wire) => { ((report.poolCases as Wire[])[0]!.comparison as Wire).complete = true; },
  ]) {
    const value = fixture(); rewrite(value, 'cache-acceptance', change); await assert.rejects(run(value));
  }
});

test('recorded ping p95 must match every retained sample rather than a supplied budget flag', async () => {
  const value = fixture(); rewrite(value, 'cache-acceptance', report => { (report.pingBeforePool as Wire).p95Ms = 0; });
  await assert.rejects(run(value), /p95 differs from retained samples/);
});

test('session and universal identity claims cannot be added to this narrow bundle', async () => {
  for (const flag of ['wholeSessionComplete', 'eligibilityProved', 'identityDetectionProved', 'complete', 'eligible']) {
    const value = fixture(); (value.manifest as unknown as Wire)[flag] = true; await assert.rejects(run(value));
  }
  const value = fixture(), key = Object.keys(value.manifest.files).find(key => key.startsWith('identity-fence-'))!;
  rewrite(value, key, report => { report.hostInputFenceProved = true; }); await assert.rejects(run(value));
});

test('inactive-engine failure remains a diagnostic error and cannot count as a passing identity control', async () => {
  const key = Object.keys(manifest.files).find(key => key.startsWith('diagnostic-error-'))!;
  assert(key, 'retain the failed control');
  const summary = await run(fixture()); assert.equal(summary.diagnosticErrors[key]!.cacheMismatchProved, false);
  const engine = fixture(); rewrite(engine, key, report => {
    (((report.finish as Wire).root as Wire).current as Wire).hasActiveEngine = { status: 'read', value: true };
  });
  await assert.rejects(run(engine), /inactive original engine/);
  const completed = fixture(); rewrite(completed, key, report => { report.outcome = 'observed-event-fence-pass'; });
  await assert.rejects(run(completed));
});

test('structure setup error retains zero arms and verified original fixture cleanup', async () => {
  const key = 'diagnostic-structure-setup-error', summary = await run(fixture());
  assert.equal(summary.diagnosticErrors[key]!.structuralCases, 0); assert.equal(summary.diagnosticErrors[key]!.cacheMismatchProved, false);
  const changed = fixture(); rewrite(changed, key, report => { report.cases = [{ outcome: 'recovery-match' }]; });
  await assert.rejects(run(changed), /no structural arm ran/);
  const cleanup = fixture(); rewrite(cleanup, key, report => { report.finalScenes = Number(report.baselineScenes) + 1; });
  await assert.rejects(run(cleanup));
});

test('no-chain authority does not imply residence and save cannot change the loaded domain', async () => {
  const summary = await run(fixture()); assert.equal(summary.noChain!.exactComparisons, 1);
  assert.equal(summary.noChainSave!.projectGenerationUnchanged, true);
  const resident = fixture(); rewrite(resident, 'no-chain', report => { (report.exact as Wire).cacheResidenceAdmitted = true; });
  await assert.rejects(run(resident));
  const save = fixture(); rewrite(save, 'no-chain-save', report => {
    const cache = (report.after as Wire).cache as Wire; cache.projectGeneration = Number(cache.projectGeneration) + 1;
  });
  await assert.rejects(run(save));
});

test('historical comparison label failure cannot turn a closed read into current content', async () => {
  const key = 'diagnostic-structure-historical-label-error', summary = await run(fixture());
  assert.equal(summary.diagnosticErrors[key]!.completedStructuralCases, 0); assert.equal(summary.diagnosticErrors[key]!.cacheMismatchProved, false);
  const output = fixture(); rewrite(output, key, report => {
    ((report.cases as Wire[])[0]!.afterBarrierRead as Wire).diagnosticSnapshot = { stale: true };
  });
  await assert.rejects(run(output));
  const accepted = fixture(); rewrite(accepted, key, report => { ((report.cases as Wire[])[0]!.automaticRead as Wire).readMode = 'shadow-cache'; });
  await assert.rejects(run(accepted));
});

test('bounded authority refusal retains its missing wire result and excludes a full structure pass', async () => {
  const key = 'diagnostic-structure-authority-refusal', summary = await run(fixture());
  assert.equal(summary.diagnosticErrors[key]!.completedStructuralCases, 1);
  assert.equal(summary.diagnosticErrors[key]!.terminalWireResultRetained, false);
  const invented = fixture(); rewrite(invented, key, report => { (report.cases as Wire[])[1]!.result = { comparison: 'match' }; });
  await assert.rejects(run(invented));
});

test('density equality and excess retain the limited scope and reason inference', async () => {
  const summary = await run(fixture()); assert.equal(summary.capacity!.controls, 4);
  assert.equal(summary.capacity!.capacityScopeComplete, false); assert.equal(summary.capacity!.literalClipReasonAvailable, false);
  const literal = fixture(); rewrite(literal, 'capacity', report => { (report.overflow as Wire).literalClipReasonAvailable = true; });
  await assert.rejects(run(literal));
  const truncated = fixture(); rewrite(truncated, 'capacity', report => { (report.cases as Wire[]).pop(); });
  await assert.rejects(run(truncated));
});
