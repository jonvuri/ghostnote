/** Verify retained 8g path evidence. The session remains active. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { verifyReplayReport } from './phase8g-lifecycle-reuse.js';
import { verifyShadowReuseReport } from './phase8g-shadow-reuse.js';
import { verifyChainWitnessReport } from './phase8g-chain-witness.js';
import { verifyMutationWitness } from './phase8g-mutation-witness.js';

type Wire = Record<string, unknown>;
const REQUIRED = ['replay', 'shadowV2', 'chains', 'copyProof', 'fixtureState', 'cleanupBeforeIdentity'] as const;
const SHA256 = /^[0-9a-f]{64}$/;
function object(value: unknown, name: string): Wire {
  assert(value !== null && typeof value === 'object' && !Array.isArray(value), `${name} must be an object`);
  return value as Wire;
}
function string(value: unknown, name: string): string {
  assert(typeof value === 'string' && value.length > 0, `${name} must be a nonempty string`); return value;
}
function bytes(value: unknown, name: string, minimum = 0): number {
  assert(typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum, `${name} must be a byte count`); return value;
}
function ended(report: Wire, name: string): void {
  assert(Number.isFinite(Date.parse(string(report.ended, `${name}.ended`))), `${name} must retain a valid end time`);
}
export interface PathArtifactSummary {
  readonly state: 'active'; readonly session: '8g'; readonly wholeSessionComplete: false; readonly eligibilityProved: false;
  readonly verifiedFiles: number; readonly pending: readonly string[];
  readonly replay: { cases: 26; matches: number; failures: 0 };
  readonly shadowV2: { cases: number; fixtureTrackId: string };
  readonly shadowV3?: { cases: number; cancellationControls: 2; fixtureTrackId: string };
  readonly mutationWitness?: { chainCount: 4; fixtureTrackId: string; inventoriesUnchanged: true };
  readonly chains: { captures: number; same: number; different: number; unknown: number; identityDetectionProved: false };
  readonly pairedReload: { comparedChains: 4; chainUUIDs: 'same'; extensionNonceChanged: true };
  readonly copyProof: { file: 'identity.bwproject'; bytes: number; sha256: string; byteEqualityRecorded: true };
  readonly cleanupBeforeIdentity: { fixtureTrackAbsent: true; baselineTrackIdsRestored: true };
}
/** Load only checked basenames. Verify raw bytes before checking report meaning. */
export async function verifyPathArtifacts(value: unknown, load: (basename: string) => Promise<Uint8Array>): Promise<PathArtifactSummary> {
  const manifest = object(value, 'manifest');
  assert.equal(manifest.state, 'active'); assert.equal(manifest.session, '8g');
  assert.equal(manifest.wholeSessionComplete, false); assert.equal(manifest.eligibilityProved, false);
  assert(Array.isArray(manifest.pending) && manifest.pending.every(value => typeof value === 'string'));
  const denominators = object(manifest.denominators, 'denominators');
  assert.equal(denominators.stepdataReplayV3, 26); assert.equal(denominators.shadowReuseV2, 18);
  const files = object(manifest.files, 'files'); for (const key of REQUIRED) assert(Object.hasOwn(files, key), `missing required artifact ${key}`);
  const records = Object.entries(files).map(([key, value]) => {
    const record = object(value, `files.${key}`), file = string(record.file, `files.${key}.file`);
    assert(/^[A-Za-z0-9][A-Za-z0-9_-]*\.json\.gz$/.test(file), `unsafe artifact basename ${file}`);
    const length = bytes(record.uncompressedBytes, `${key}.uncompressedBytes`, 2), hash = string(record.uncompressedSha256, `${key}.uncompressedSha256`);
    assert(SHA256.test(hash), `${key} needs a SHA256 checksum`); return { key, file, length, hash };
  });
  assert.equal(new Set(records.map(record => record.file)).size, records.length, 'artifact roles need separate filenames');
  const reports = new Map<string, Wire>();
  for (const record of records) {
    const raw = gunzipSync(await load(record.file), { maxOutputLength: record.length + 1 });
    assert.equal(raw.byteLength, record.length, `${record.key} raw byte count changed`);
    assert.equal(createHash('sha256').update(raw).digest('hex'), record.hash, `${record.key} raw SHA256 changed`);
    reports.set(record.key, object(JSON.parse(raw.toString('utf8')), record.key));
  }
  const fixture = reports.get('fixtureState')!, owner = string(fixture.ownedTrackId, 'fixtureState.ownedTrackId');
  assert(Array.isArray(fixture.baselineIds) && fixture.baselineIds.length > 0);
  const baseline = fixture.baselineIds.map(value => string(value, 'baseline track ID'));
  assert.equal(new Set(baseline).size, baseline.length); assert(!baseline.includes(owner), 'the fixture must be separate from baseline tracks');
  const replay = reports.get('replay')!; ended(replay, 'replay'); assert.equal(replay.fixtureRestored, true);
  const replayInfo = object(replay.info, 'replay.info');
  assert.equal(replayInfo.observerRegistration, 'addStepDataObserver');
  assert.equal(replayInfo.observerKind, 'StepDataChangedCallback');
  assert.equal(replayInfo.fullComparisonSeedsRecorder, false);
  assert(Array.isArray(replay.cases)); assert.equal(replay.cases.length, 26, 'the replay denominator must be 26');
  const replayResult = verifyReplayReport(replay); assert.equal(replayResult.matches, 26); assert.equal(replayResult.failures, 0);
  if (Object.hasOwn(replay, 'failures')) assert.deepEqual(replay.failures, []);
  const checkShadow = (key: string, revision: string, fixtureOwner: string): number => {
    const report = reports.get(key)!; ended(report, key);
    assert.equal(object(report.initial, `${key}.initial`).instrumentationRevision, revision);
    if (report.ownedTrackId !== undefined || revision === '8g-shadow-physical-hints-v3')
      assert.equal(report.ownedTrackId, fixtureOwner, `${key} recorded a different fixture track`);
    // V2 omitted the owner. Supply the independently retained fixture address for every comparison.
    return verifyShadowReuseReport({ ...report, ownedTrackId: fixtureOwner });
  };
  const shadowV2 = checkShadow('shadowV2', '8g-shadow-physical-hints-v2', owner); assert.equal(shadowV2, 18);
  let shadowV3: PathArtifactSummary['shadowV3'];
  if (reports.has('shadowV3')) {
    assert(reports.has('fixtureStateV3'), 'shadowV3 needs its independently retained fixtureStateV3');
    const fixtureV3 = reports.get('fixtureStateV3')!, ownerV3 = string(fixtureV3.ownedTrackId, 'fixtureStateV3.ownedTrackId');
    assert.notEqual(ownerV3, owner, 'V3 must use the recreated fixture, not the removed original');
    assert(!baseline.includes(ownerV3)); assert.deepEqual(fixtureV3.baselineIds, baseline, 'V3 baseline track IDs differ');
    const cases = checkShadow('shadowV3', '8g-shadow-physical-hints-v3', ownerV3);
    if (Object.hasOwn(denominators, 'shadowReuseV3')) assert.equal(denominators.shadowReuseV3, cases);
    shadowV3 = { cases, cancellationControls: 2, fixtureTrackId: ownerV3 };
  }
  let mutationWitness: PathArtifactSummary['mutationWitness'];
  if (reports.has('mutationWitness')) {
    assert(reports.has('fixtureStateV3'), 'mutation witness needs the recreated fixture record');
    const id = string(reports.get('fixtureStateV3')!.ownedTrackId, 'mutation witness owner');
    verifyMutationWitness(reports.get('mutationWitness')!, id);
    mutationWitness = { chainCount: 4, fixtureTrackId: id, inventoriesUnchanged: true };
  }
  const chainResult = verifyChainWitnessReport(reports.get('chains'));
  const chainReport = reports.get('chains')!;
  const captures = chainReport.captures as Wire[];
  const endpoints = ['A-before-controller-reload', 'A-after-controller-reload'].map(label => {
    const matches = captures.filter(capture => capture.label === label);
    assert.equal(matches.length, 1, `paired reload needs one ${label} capture`);
    return object(matches[0]!.snapshot, label);
  });
  assert.notEqual(endpoints[0]!.extensionInitNonce, endpoints[1]!.extensionInitNonce,
    'paired reload must use a new extension instance');
  const reloadPair = chainResult.pairs.find(pair => pair.from === 'A-before-controller-reload'
    && pair.to === 'A-after-controller-reload');
  assert(reloadPair && reloadPair.traceComplete && reloadPair.comparedChains === 4
    && reloadPair.changedChainUUIDs === 0 && reloadPair.chainUUIDs === 'same',
    'paired reload must retain all four matched chain UUIDs');
  const copy = reports.get('copyProof')!; assert.equal(copy.byteIdentical, true); assert.equal(copy.ownedDisposableProjects, true);
  assert.notEqual(string(copy.source, 'copy source'), string(copy.copy, 'copy destination'));
  assert(Array.isArray(copy.files)); const projectRecords = copy.files.map(value => object(value, 'copy file')).filter(value => value.file === 'identity.bwproject');
  assert.equal(projectRecords.length, 1, 'copy proof needs one identity.bwproject record'); const project = projectRecords[0]!;
  const projectBytes = bytes(project.bytes, 'identity.bwproject bytes', 1), projectHash = string(project.sha256, 'identity.bwproject SHA256');
  assert(SHA256.test(projectHash));
  const cleanup = reports.get('cleanupBeforeIdentity')!; assert.equal(cleanup.cleaned, true); assert(Array.isArray(cleanup.tracks));
  const restored = cleanup.tracks.map(value => string(object(value, 'cleanup track').channelId, 'cleanup track ID'));
  assert(!restored.includes(owner), 'cleanup retained the fixture track'); assert.deepEqual(restored, baseline, 'cleanup baseline track IDs differ');
  return { state: 'active', session: '8g', wholeSessionComplete: false, eligibilityProved: false,
    verifiedFiles: reports.size, pending: manifest.pending as string[], replay: { cases: 26, matches: replayResult.matches, failures: 0 },
    shadowV2: { cases: shadowV2, fixtureTrackId: owner }, ...(shadowV3 ? { shadowV3 } : {}),
    ...(mutationWitness ? { mutationWitness } : {}),
    chains: { captures: chainResult.captures.length, same: chainResult.pairs.filter(pair => pair.chainUUIDs === 'same').length,
      different: chainResult.pairs.filter(pair => pair.chainUUIDs === 'different').length,
      unknown: chainResult.pairs.filter(pair => pair.chainUUIDs === 'unknown').length, identityDetectionProved: false },
    pairedReload: { comparedChains: 4, chainUUIDs: 'same', extensionNonceChanged: true },
    copyProof: { file: 'identity.bwproject', bytes: projectBytes, sha256: projectHash, byteEqualityRecorded: true },
    cleanupBeforeIdentity: { fixtureTrackAbsent: true, baselineTrackIdsRestored: true } };
}
async function main(): Promise<void> {
  const selected = process.argv[2] ?? fileURLToPath(new URL('../../../context/evidence/data/phase8g-selected-replay-and-witnesses/manifest.json', import.meta.url));
  const path = resolve(selected), manifest = JSON.parse(await readFile(path, 'utf8'));
  console.log(JSON.stringify(await verifyPathArtifacts(manifest, name => readFile(join(dirname(path), name))), null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  void main().catch(error => { console.error(error); process.exitCode = 1; });
