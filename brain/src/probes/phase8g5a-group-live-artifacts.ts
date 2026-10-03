/** Verify retained topology, note comparisons, and automatic retirement. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { verifyGroupTopology, type GroupOracle } from './phase8g5a-group-lib.js';
import { closed, independentNotes, noPayload, verifyComparison, type Wire } from './phase8g4-native-lib.js';

const directory = new URL('../../../context/evidence/data/phase8g5a-group/', import.meta.url);
const hash = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const manifest = JSON.parse(await readFile(new URL('live-artifacts.json', directory), 'utf8')) as {
  oracleSha256: string; wholeSessionComplete: boolean; reports: Array<{
    file: string; kind: string; bytes: number; sha256: string; beforeOracle?: string;
  }>;
};
assert.equal(manifest.wholeSessionComplete, false);
const oracleBytes = await readFile(new URL('live-oracles.json', directory));
assert.equal(hash(oracleBytes), manifest.oracleSha256);
const { oracles } = JSON.parse(oracleBytes.toString()) as { oracles: Record<string, GroupOracle> };
const marker = '8g5a-group-topology-v2';
let comparisons = 0, retirements = 0;
const changes = new Set<string>();
for (const record of manifest.reports) {
  assert.match(record.file, /^[a-z0-9-]+\.json$/);
  const bytes = await readFile(new URL(record.file, directory));
  assert.equal(bytes.length, record.bytes); assert.equal(hash(bytes), record.sha256);
  const report = JSON.parse(bytes.toString()) as Wire, oracle = oracles[record.file]; assert(oracle);
  closed(report);
  verifyGroupTopology(report.topology as Wire, report.tracks as Wire, oracle);
  if (record.kind === 'comparison') {
    assert.equal(report.schema, 'phase8g5a-comparison-v1');
    const source = report.source as Wire;
    verifyComparison(report.comparison as Wire, source, marker);
    assert.deepEqual(independentNotes(report.notes as Wire), independentNotes(source.notes as Wire));
    assert.deepEqual(report.metadata, source.metadata); comparisons++;
  } else if (record.kind === 'change') {
    assert.equal(report.schema, 'phase8g5a-change-result-v1');
    const arm = report.arm as Wire, active = arm.active as Wire;
    assert.equal(typeof arm.label, 'string'); assert(!changes.has(String(arm.label))); changes.add(String(arm.label));
    assert(record.beforeOracle); const beforeOracle = oracles[record.beforeOracle]; assert(beforeOracle);
    verifyGroupTopology(arm.topology as Wire, arm.tracks as Wire, beforeOracle);
    verifyComparison(arm.before as Wire, arm.source as Wire, marker);
    closed(arm); closed(active); noPayload(active);
    assert.equal(active.comparison, 'pending'); assert.equal(active.scanActive, true);
    assert.equal(active.scanStage, 'membership');
    const retired = report.retired as Wire, status = report.status as Wire, info = report.info as Wire;
    closed(retired); noPayload(retired); assert.equal(retired.comparison, 'window-changed');
    assert.equal(status.phase, 'retired'); assert.equal(status.bindingReady, false);
    assert.equal(info.instrumentationRevision, marker);
    assert.equal(info.initDomain, (arm.info as Wire).initDomain);
    assert(Number(info.automaticIdentityInvalidations) > Number((arm.info as Wire).automaticIdentityInvalidations));
    assert(Number(info.projectGeneration) > Number((arm.info as Wire).projectGeneration));
    assert(Number((report.topology as Wire).sequenceBeforeRead) > Number((arm.topology as Wire).sequenceAfterRead));
    retirements++;
  } else assert.equal(record.kind, 'topology');
}
assert.equal(manifest.reports.length, 14); assert.equal(comparisons, 3); assert.equal(retirements, 7);
assert.deepEqual([...changes].sort(), ['collapse-group-1', 'expand-empty-root-group', 'group-inst-1',
  'move-inst-in-last', 'move-inst-out', 'reorder-inst-first', 'ungroup-inst-wrapper'].sort());
console.log(JSON.stringify({ topologyMatches: manifest.reports.length, comparisons, retirements,
  wholeSessionComplete: false, complete: false, eligible: false }));
