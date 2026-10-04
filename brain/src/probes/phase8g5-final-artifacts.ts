/** Verify the retained 8g5 reports: pinned bytes plus an independent meaning check for each role. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { FINAL_SHADOW_MARKER } from './e218-step-delta-acceptance-lib.js';
import { verify as verifyDetour } from './e218-step-delta-acceptance.js';
import { CANARY_FIXTURE, FINAL_MARKER, ORIGINAL_CONFIG_SHA256, PATCH, PROTECTED_PROJECT, TARGET_FIXTURE, TARGET_NAME, TARGET_ROW,
  applyChange, caseIssues, consumerConfig, declaredIssues, rawNotesOf, verifyConsumerReport, writerEffects, type Wire } from './phase8g5-consumers-lib.js';

export const DIRECTORY = new URL('../../../context/evidence/data/phase8g5-final/', import.meta.url);
type Role = 'consumers' | 'metadata-verifier-diagnostic' | 'stable-writer-diagnostic' | 'detour' | 'detour-oracle-diagnostic'
  | 'fixture' | 'config' | 'research-final' | 'protected-baseline';
export interface Pin { readonly file: string; readonly role: Role; readonly bytes: number; readonly sha256: string }
export const PINS: readonly Pin[] = [
  { file: 'config-entry.json', role: 'config', bytes: 569, sha256: '476b4b47c1a92baa7ddedff3e41ca58e8f932e61233a4218ee090d6fef28b5bd' },
  { file: 'fixture-state.json', role: 'fixture', bytes: 26939, sha256: '3f516963530956dab2f10f81959acd61aad580cac219dd073dbdfb9c87a1b7bf' },
  { file: 'consumers-1-verifier-diagnostic.json', role: 'metadata-verifier-diagnostic', bytes: 124660, sha256: 'ed93a58a4109277abedd9239f32dc6cf22d122c6cf2dd4ac6ba290a432a12609' },
  { file: 'consumers-2-stable-writer-diagnostic.json', role: 'stable-writer-diagnostic', bytes: 346034, sha256: 'a5debce63f26ad3a577d21213e40f4162109918238df78e383bcf62f91528261' },
  { file: 'consumers.json', role: 'consumers', bytes: 846571, sha256: '9b8535d5a9ca61decc25ba95becd60aa6ba176b1f39c725659c49d77f23715cb' },
  { file: 'detour-window-same-callback.json', role: 'detour', bytes: 126216, sha256: 'e120e91f4c80bc62bb7f55a567056db5b2a832071b619ee7bd5073a9af15202b' },
  { file: 'detour-window-exact-1-oracle-budget-diagnostic.json', role: 'detour-oracle-diagnostic', bytes: 40281, sha256: 'fa32e72fdd2065c8fb9f885024f412d3eb365b895b98f6dc9a6ac74f435bd277' },
  { file: 'detour-same-callback.json', role: 'detour', bytes: 332340, sha256: 'f30c57cbb0bc5f329159e3508c0487c01462c9587c794562d7b5f71416de29cf' },
  { file: 'detour-window-exact-2.json', role: 'detour', bytes: 86147, sha256: '98ba0f2e10fd8ae3f31a7573cdb5dc6856c95bb70c9671ee1d641ab1c1763441' },
  { file: 'research-final-info.json', role: 'research-final', bytes: 16650, sha256: 'e0515bf57befe9d58cef987294295c69f699bbd9525256a49ed722fe702ab316' },
  { file: 'new3-final-baseline.json', role: 'protected-baseline', bytes: 22624, sha256: '09493de590ae40450be5cdd48dfa71a18aac70c08251cffdb61c74d172cf43dd' },
];
const sha = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const sorted = (notes: unknown[]): string[] => notes.map(note => JSON.stringify(note, Object.keys(note as object).sort())).sort();

function detour(report: Wire, accepted: boolean): Wire {
  assert.equal(report.shadowMarker, FINAL_SHADOW_MARKER);
  const summary = verifyDetour(report);
  assert.equal(summary.foreignOutputs, 0, 'foreign output');
  const identities = report.identities as Wire;
  assert.equal((identities.P as Wire).name, 'New 9'); assert.equal((identities.Q as Wire).name, 'New 10');
  if (accepted) {
    assert.equal(report.stoppedReason, undefined); assert.equal(summary.outputsDifferingFromAuthority, 0); assert.equal(summary.independentFailures, 0);
    return summary;
  }
  // The independent oracle refused. The published set still equals every earlier independent P read.
  assert.equal(report.stoppedReason, 'trial 5 independent authority read failed');
  const trials = report.trials as Wire[], last = trials.at(-1)!;
  assert.equal((last.independent as Wire).reason, 'authority-host-work-budget'); assert.equal((last.independent as Wire).authorityNotes, undefined);
  const published = sorted((last.exact as Wire).authorityNotes as unknown[]);
  for (const trial of trials.slice(0, -1)) assert.deepEqual(sorted((trial.independent as Wire).authorityNotes as unknown[]), published);
  return { ...summary, oracleRefusal: 'authority-host-work-budget' };
}
/** Return a summary for each role. Every pinned file needs its exact bytes. */
export function verifyRole(role: Role, report: Wire): Wire {
  switch (role) {
    case 'consumers': return verifyConsumerReport(report);
    case 'metadata-verifier-diagnostic': {
      // The first verifier compared serialized key order. Values are equal under the corrected check.
      assert.equal(report.stoppedReason, 'cold-read-only: snapshot-metadata, authority-metadata');
      const cases = report.cases as Wire[]; assert.equal(cases.length, 1);
      const row = cases[0]!, expected = rawNotesOf((report.fixture as Wire).raw as Wire);
      assert.deepEqual(caseIssues(row.comparison as Wire, row.raw as Wire, row.rawMetadata as Wire, expected, { trackId: report.trackId, row: TARGET_ROW }, TARGET_NAME), []);
      return { diagnostic: 'verifier-key-order', valuesEqual: true };
    }
    case 'stable-writer-diagnostic': {
      assert(String(report.stoppedReason).startsWith('public-patch: raw:fixture-field:3:256:62:isChanceEnabled'));
      const cases = report.cases as Wire[], fixture = rawNotesOf((report.fixture as Wire).raw as Wire);
      for (const row of cases.slice(0, 2)) assert.deepEqual(caseIssues(row.comparison as Wire, row.raw as Wire, row.rawMetadata as Wire, fixture, { trackId: report.trackId, row: TARGET_ROW }, TARGET_NAME), []);
      const patch = cases[2]!; assert.equal(patch.label, 'public-patch'); assert.equal((patch.application as Wire).applied, true);
      assert.notEqual((patch.staleApply as Wire).applied, true);
      const effects = writerEffects(applyChange(fixture, { kind: 'transpose', ...PATCH }), patch.raw as Wire);
      assert.deepEqual(effects.issues, []); assert.equal(effects.effects.length, 6);
      const actual = rawNotesOf(patch.raw as Wire);
      assert.deepEqual(caseIssues(patch.comparison as Wire, patch.raw as Wire, patch.rawMetadata as Wire, actual, { trackId: report.trackId, row: TARGET_ROW }, TARGET_NAME), []);
      return { diagnostic: 'legacy-stable-writer-disabled-state', shadowEqualsAuthorityAndRaw: true, effects: effects.effects };
    }
    case 'detour': return detour(report, true);
    case 'detour-oracle-diagnostic': return detour(report, false);
    case 'fixture': {
      assert.equal((report.P as Wire).name, 'New 9'); assert.equal((report.Q as Wire).name, 'New 10');
      const consumer = report.consumer as Wire;
      assert.deepEqual(declaredIssues(consumer.raw as Wire, TARGET_FIXTURE), []); assert.deepEqual(declaredIssues(consumer.canaryRaw as Wire, CANARY_FIXTURE), []);
      return { P: 'New 9', Q: 'New 10', targetNotes: TARGET_FIXTURE.length };
    }
    case 'config': {
      assert.equal(report.originalSha256, ORIGINAL_CONFIG_SHA256);
      assert.equal(sha(Buffer.from(String(report.originalBase64), 'base64')), ORIGINAL_CONFIG_SHA256);
      assert.deepEqual(report.research, consumerConfig()); return { originalSha256: ORIGINAL_CONFIG_SHA256 };
    }
    case 'research-final': {
      const info = report.info as Wire;
      assert.equal(info.instrumentationRevision, FINAL_MARKER); assert.equal(info.mismatches, 0); assert.deepEqual(info.mismatchesByCause, {});
      assert.equal(info.complete, false); assert.equal(info.eligible, false); assert.equal(info.hostInputFenceProved, false);
      return { matches: info.matches, mismatches: 0, refusals: info.comparisonRefusalsByCause };
    }
    case 'protected-baseline': {
      assert.equal(report.project, PROTECTED_PROJECT); assert.equal(report.stateValuesRestored, true); assert.equal(report.configSha256, ORIGINAL_CONFIG_SHA256);
      const hello = report.hello as Wire; assert.equal(hello.runtimeProfile, 'normal-v1'); assert.equal(hello.methodCount, 85); assert.equal(hello.methodsHash, 'bba7383dce25c0f0');
      return { project: PROTECTED_PROJECT, stateValuesRestored: true };
    }
  }
}
export async function verifyFinalArtifacts(read = async (file: string): Promise<Uint8Array> => await readFile(new URL(file, DIRECTORY))): Promise<Wire> {
  const roles: Wire = {};
  for (const pin of PINS) {
    const bytes = await read(pin.file);
    assert.equal(bytes.length, pin.bytes, `${pin.file} size`); assert.equal(sha(bytes), pin.sha256, `${pin.file} hash`);
    roles[pin.file] = verifyRole(pin.role, JSON.parse(Buffer.from(bytes).toString('utf8')) as Wire);
  }
  return { files: PINS.length, roles, complete: false, eligible: false };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  void verifyFinalArtifacts().then(value => console.log(JSON.stringify(value, null, 1))).catch(error => { console.error(error); process.exitCode = 1; });
