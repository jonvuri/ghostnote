/** Keep native acquisition evidence separate from earlier accepted controls. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { verifyFollowupArtifacts } from './phase8g-followup-artifacts.js';
import { BOUNDARIES, closed, NATIVE_MARKER, verifyOrdering, type Wire } from './phase8g4-native-lib.js';
import { verifyNativeTopologyReport } from './phase8g4-native-topology.js';
import { verifyFixtureCleanup, verifyLiveRestoration, verifyResearchReload, verifyTopologyReaderDiagnostic } from './phase8g4-native-restoration.js';
export const ORDERING_ROLES = [...BOUNDARIES.map(boundary => `ordering-${boundary}`), 'ordering-return'] as const;
const REQUIRED_ROLES = [...ORDERING_ROLES, 'native-group-membership', 'final-live-baseline'];
const SUPPORT_ROLES = ['research-reload', 'fixture-p-cleanup', 'fixture-q-cleanup', 'topology-reader-diagnostic'];
export const PRIOR_MANIFEST_SHA256 = 'fb2049be891a3cc810450f27b37b528a3b5b7bbedf403d6362b9c64d81af8b83';
const prior = fileURLToPath(new URL('../../../context/evidence/data/phase8g-followup-acceptance/manifest.json', import.meta.url));
const current = fileURLToPath(new URL('../../../context/evidence/data/phase8g4-native/manifest.json', import.meta.url));
const hash = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const object = (value: unknown): Wire => { assert(value && typeof value === 'object' && !Array.isArray(value)); return value as Wire; };
/** Check report meaning after its compressed and raw hashes pass. */
export async function verifyNativeOrderingFiles(manifest: Wire, load: (name: string) => Promise<Uint8Array>): Promise<Wire> {
  assert.equal(manifest.schema, 'phase8g4-native-evidence-v1'); assert.equal(manifest.marker, NATIVE_MARKER);
  assert.equal(manifest.researchOnly, true); closed(manifest);
  const files = object(manifest.files); const pending = manifest.pending as string[];
  assert(Array.isArray(pending)); assert.equal(new Set(pending).size, pending.length);
  const summaries: Wire = {}; let accepted = 0, diagnostic = 0;
  for (const [role, value] of Object.entries(files)) {
    const diagnosticRole = role.endsWith('-diagnostic'), base = diagnosticRole ? role.slice(0, -11) : role;
    assert(ORDERING_ROLES.includes(base) || [...REQUIRED_ROLES, ...SUPPORT_ROLES].includes(role), 'unknown native artifact role');
    const record = object(value); assert.equal(record.file, `${role}.json.gz`);
    for (const field of ['compressedBytes', 'uncompressedBytes'])
      assert(Number.isSafeInteger(record[field]) && Number(record[field]) > 0 && Number(record[field]) <= 64 * 1024 * 1024);
    const bytes = await load(String(record.file)); assert.equal(bytes.length, record.compressedBytes);
    assert.equal(hash(bytes), record.compressedSha256); assert.deepEqual([...bytes.slice(4, 8)], [0, 0, 0, 0]);
    const raw = gunzipSync(bytes, { maxOutputLength: Number(record.uncompressedBytes) + 1 });
    assert.equal(raw.length, record.uncompressedBytes); assert.equal(hash(raw), record.uncompressedSha256);
    const report = object(JSON.parse(raw.toString()));
    let summary: Wire;
    if (ORDERING_ROLES.includes(base)) {
      if (base !== 'ordering-return') assert.equal(report.boundary, base.slice(9), 'altered acquisition boundary');
      summary = verifyOrdering(report, !diagnosticRole);
      accepted += Number(summary.acceptedTrials); diagnostic += Number(summary.diagnosticTrials);
    } else if (role === 'native-group-membership') {
      summary = verifyNativeTopologyReport(report); assert.deepEqual(report.summary, summary);
    } else if (role === 'final-live-baseline') summary = verifyLiveRestoration(report);
    else if (role === 'research-reload') summary = verifyResearchReload(report);
    else if (role === 'topology-reader-diagnostic') summary = verifyTopologyReaderDiagnostic(report);
    else summary = verifyFixtureCleanup(report);
    summaries[role] = summary;
  }
  for (const role of REQUIRED_ROLES) assert.equal(pending.includes(role), !Object.hasOwn(files, role));
  assert(pending.every(role => REQUIRED_ROLES.includes(role)));
  assert.equal(manifest.wholeSessionComplete, pending.length === 0);
  if (manifest.wholeSessionComplete) for (const role of SUPPORT_ROLES) assert(files[role], `missing support role: ${role}`);
  if (files['ordering-return']) {
    const returned = summaries['ordering-return'] as Wire;
    const forward = Object.entries(summaries).find(([role]) => role.startsWith('ordering-') && role !== 'ordering-return' && !role.endsWith('-diagnostic'))?.[1] as Wire | undefined;
    assert(forward, 'a return trial needs a separately accepted forward trial');
    assert.equal(returned.direction, String(forward.direction).split('->').reverse().join('->'));
    assert.equal(returned.initDomain, forward.initDomain); assert.notEqual(returned.acquisitionId, forward.acquisitionId);
  }
  return { verifiedFiles: Object.keys(files).length, acceptedNativeTrials: accepted, diagnosticNativeTrials: diagnostic, pending, trials: summaries };
}
export async function verifyNativeArtifacts(path = current): Promise<Wire> {
  const bytes = await readFile(prior); assert.equal(hash(bytes), PRIOR_MANIFEST_SHA256, 'the reused corpus changed');
  const reused = await verifyFollowupArtifacts(JSON.parse(bytes.toString()), name => readFile(join(dirname(prior), name)));
  const manifest = object(JSON.parse(await readFile(path, 'utf8')));
  assert.equal(manifest.priorFollowupManifestSha256, PRIOR_MANIFEST_SHA256);
  assert.deepEqual(manifest.reusedDenominators, { structuralFences: 14, inventoryInterruptions: 3, nativeGroupUngroupCases: 1,
    isolatedAddSceneCases: 1, compoundAddMoveCases: 1, nativeVelocityEdits: 1, priorBOverlapTrials: 1 });
  return { reusedDenominators: manifest.reusedDenominators, reused, ...await verifyNativeOrderingFiles(manifest, name => readFile(join(dirname(path), name))),
    complete: false, eligible: false, wholeSessionComplete: manifest.wholeSessionComplete };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  void verifyNativeArtifacts(resolve(process.argv[2] ?? current)).then(value => console.log(JSON.stringify(value, null, 2)))
    .catch(error => { console.error(error); process.exitCode = 1; });
