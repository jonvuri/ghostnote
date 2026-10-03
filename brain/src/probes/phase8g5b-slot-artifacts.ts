/**
 * Verify the retained 8g5b slot artifacts. Hashes come from the manifest. Every
 * summary is recomputed from raw traces and scans. Research only; nothing becomes eligible.
 *
 * Run from brain/: node --import tsx src/probes/phase8g5b-slot-artifacts.ts
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { occupancyFor, summarizeSlotRun } from './e222-slot-delivery-lib.js';
import type { SlotSides } from './e222-slot-delivery-lib.js';
import { verify as verifyTrial } from './e222-slot-delivery.js';
import { compareOccupancy, declaredOccupancy, publishedOccupancy, scanOccupancy } from './phase8g5b-slot-lib.js';

type Wire = Record<string, unknown>;
export const DATA = join(dirname(fileURLToPath(import.meta.url)), '../../../context/evidence/data/phase8g5b-slot');
export const CHECKS = ['native-1-create', 'native-2-delete', 'native-3-duplicate', 'native-4-drag', 'native-5-insert-scene',
  'native-6-delete-scene', 'native-7-switch-q', 'native-8-switch-p', 'native-9-group', 'native-10-collapse',
  'api-11-collapsed-delete', 'native-12-expand', 'native-13-ungroup', 'api-14-move'];
const read = async (name: string): Promise<Buffer> => await readFile(join(DATA, name));
const json = async (name: string): Promise<Wire> => JSON.parse((await read(name)).toString('utf8')) as Wire;
const sha = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');

/** A retained check: retirement, settled scan, declaration, and a fresh confirmed publication. */
export function verifyCheck(name: string, report: Wire, prior: Wire): Wire {
  assert.equal(report.schema, 'phase8g5b-check-v1'); assert.equal(report.eligible, false); assert.equal(report.error, undefined, name);
  const retained = report.retained as Wire;
  assert.notEqual(retained.occupancyAdmitted, true, `${name}: the retained publication survived the change`);
  assert.equal(retained.occupancy, undefined);
  const settled = report.settled as Wire;
  assert.equal(JSON.stringify(settled.first), JSON.stringify(settled.second), `${name}: scan was not settled`);
  const current = scanOccupancy(settled.second as Wire);
  assert.deepEqual(scanOccupancy((report.after as Wire).second as Wire), current, `${name}: occupancy changed during the check`);
  const declaration = report.declaration as Wire;
  const base = declaration.baseline === 'replace' ? [] : (prior.scanOccupancy as Wire).clips as string[];
  const declared = declaredOccupancy(base, declaration.operations as Wire[]);
  assert.deepEqual(declared, report.declared);
  const published = publishedOccupancy((report.publication as Wire).list as Wire);
  const comparison = compareOccupancy(published, current.clips, declared);
  assert.deepEqual(comparison, report.comparison); assert.equal(comparison.matches, true, `${name}: occupancy mismatch`);
  assert.equal(((report.topology as Wire).membershipComplete), true, `${name}: topology refused`);
  const retiredBy = retained.lastRetiredInventoryRebuild as Wire | undefined;
  return { name, project: report.project, published: published.length, groupSlots: current.groupSlots.length,
    retirement: retiredBy?.reason === 'slot-window-changed' ? 'slot-window-changed' : String(retained.fallbackReason) };
}

export async function verifyArtifacts(): Promise<Wire> {
  const manifest = await json('artifacts.json');
  assert.equal(manifest.schema, 'phase8g5b-artifacts-v1'); assert.equal(manifest.eligible, false);
  for (const [file, digest] of Object.entries(manifest.files as Record<string, string>))
    assert.equal(sha(await read(file)), digest, `${file} hash differs`);

  // E222: the diagnostic stop is an analyzer defect; the declared intermediate state removes every violation.
  const diagnostic = await json('e222-trial-1-analyzer-diagnostic.json'), sides = diagnostic.sides as SlotSides;
  assert.match(String(diagnostic.stoppedReason), /^separate-create-delete rep=0 violates/);
  const stopped = (diagnostic.runs as Wire[]).at(-1)!;
  const strict = summarizeSlotRun(stopped.trace as Wire, sides, stopped.watch as { t: number; s: number }[]);
  const declaredEdit = summarizeSlotRun(stopped.trace as Wire, sides, stopped.watch as { t: number; s: number }[],
    [occupancyFor([0, 1, 2, 6], sides.P.occupancy)]);
  assert(Number(strict.admittedForeignTicks) > 0); assert.equal(declaredEdit.admittedForeignTicks, 0);
  assert.equal(declaredEdit.missedDeliveries, 0);
  for (const run of (diagnostic.runs as Wire[]).slice(0, -1)) {
    const summary = run.summary as Wire;
    assert.equal(summary.missedDeliveries, 0); assert.equal(summary.admittedForeignTicks, 0);
  }
  const trial = verifyTrial(await json('e222-trial-2.json'));
  assert.equal(trial.stoppedReason, null);
  const aggregates = trial.aggregates as Record<string, Wire>;
  for (const [kind, value] of Object.entries(aggregates)) {
    assert.equal(value.missedDeliveries, 0, `${kind} missed`); assert.equal(value.admittedForeignTicks, 0, `${kind} admitted foreign`);
    assert.equal(value.droppedRecords, 0); assert.equal(value.otherOutcomes, 0);
  }

  const witness = await json('e222-recreate-witness.json');
  const witnessRuns = (witness.runs as Wire[]).map(run => {
    const summary = summarizeSlotRun(run.trace as Wire, witness.sides as SlotSides, [{ t: 0, s: Number(witness.row) }]);
    assert.deepEqual(summary, run.summary);
    const before = run.before as Wire, after = run.after as Wire;
    assert.equal(before.notes, 1); assert.match(String(before.name), /^gn-8g5b-witness-\d+$/);
    return { changed: after.name === '' && after.notes === 0, silent: (summary.watchedSlotEvents as number[])[0] === 0,
      missed: Number(summary.missedDeliveries), finalP: summary.finalOccupancyIsP === true };
  });
  const witnessSummary = { runs: witnessRuns.length, identityChanged: witnessRuns.filter(r => r.changed).length,
    withoutRowCallback: witnessRuns.filter(r => r.silent).length,
    identityChangedWithoutRowCallback: witnessRuns.filter(r => r.changed && r.silent).length,
    missedDeliveries: witnessRuns.reduce((n, r) => n + r.missed, 0) };
  assert.deepEqual(witnessSummary, witness.summary); assert(witnessRuns.every(r => r.finalP));

  const detours = await json('cache-detours.json');
  const expected = (detours.referenceOccupancy as Wire).clips as string[];
  assert.deepEqual(scanOccupancy(((detours.reference as Wire).second) as Wire).clips, expected);
  const trials = detours.trials as Wire[];
  for (const t of trials) {
    assert.equal(t.endpoint, (detours.sides as SlotSides).P.name); assert.deepEqual((t.scan as Wire).clips, expected);
    assert.equal(t.admitted, (t.list as Wire).occupancyAdmitted === true);
    if (t.admitted) assert.equal(compareOccupancy(publishedOccupancy(t.list as Wire), expected).matches, true);
    else assert.equal((t.list as Wire).occupancy, undefined);
  }
  const reasons: Record<string, number> = {};
  for (const t of trials.filter(t => !t.admitted)) reasons[String(t.reason)] = (reasons[String(t.reason)] ?? 0) + 1;
  assert.deepEqual({ trials: trials.length, admitted: trials.filter(t => t.admitted).length, refused: trials.filter(t => !t.admitted).length,
    refusalReasons: reasons, admittedMismatches: 0, foreignSlots: 0 }, detours.summary);

  const arm = await json('p-arm-0.json');
  assert.equal(arm.error, undefined); assert.equal((arm.comparison as Wire).matches, true);
  assert.deepEqual(compareOccupancy(publishedOccupancy((arm.publication as Wire).list as Wire), (arm.scanOccupancy as Wire).clips as string[]), arm.comparison);
  let prior = arm; const checks: Wire[] = [];
  for (const name of CHECKS) { const report = await json(`${name}.json`); checks.push(verifyCheck(name, report, prior)); prior = report; }

  const reload = await json('research-reload.json');
  assert.equal((reload.hello as Wire).methodCount, 97); assert.equal((reload.hello as Wire).methodsHash, 'f03f19414f40e3d3');
  assert.equal((reload.info as Wire).instrumentationRevision, '8g5b-slot-window-v1');
  assert.equal((reload.delivery as Wire).slotMarker, 'e222-slot-delivery-v1');
  const restoration = await json('final-restoration.json'), final = await json('new3-final-baseline.json');
  assert.equal(final.stateValuesRestored, true); assert.equal(final.project, 'New 3');
  assert.equal((final.hello as Wire).methodCount, 85); assert.equal((final.hello as Wire).methodsHash, 'bba7383dce25c0f0');
  assert.equal(final.configSha256, '256bbf07094cd654c372d0e5e050e494ef7783c9a0001a0a2a688331bcf643b0');
  assert.equal(restoration.restorationReportSha256, sha(await read('new3-final-baseline.json')));
  const entry = await json('entry-baseline.json'); assert.equal(entry.stateValuesRestored, true);
  return { e222: aggregates, recreateWitness: witnessSummary, cacheDetours: detours.summary, checks, eligible: false, complete: false };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  void verifyArtifacts().then(result => console.log(JSON.stringify(result, null, 1))).catch(error => { console.error(error); process.exitCode = 1; });
