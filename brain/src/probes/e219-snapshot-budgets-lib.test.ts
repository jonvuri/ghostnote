import assert from 'node:assert/strict';
import test from 'node:test';
import { ACQUIRED_FIELDS } from './phase8g-shadow-mutations.js';
import { SELECTED_LIMITS, SNAPSHOT_LIMIT, baseEstimate, checkRefusal, checkStatus, javaDecimalText, layoutNotes, noteEstimate,
  scalarLength, solveLayout, E219_MARKER } from './e219-snapshot-budgets-lib.js';

type Wire = Record<string, unknown>;

test('Java decimal text matches JDK Double.toString and Float.toString', () => {
  // Reference strings from Temurin 26 for the same values.
  const doubles: [number, string][] = [[0.5, '0.5'], [1, '1.0'], [100 / 127, '0.7874015748031497'], [0.001953125, '0.001953125'],
    [1e-4, '1.0E-4'], [0.0001234, '1.234E-4'], [1e7, '1.0E7'], [12345678.9, '1.23456789E7'], [123, '123.0'], [-0, '-0.0'], [0, '0.0'],
    [1 / 127, '0.007874015748031496'], [0.0009765625, '9.765625E-4'], [9999999, '9999999.0'], [2.5e-7, '2.5E-7'], [1e21, '1.0E21'],
    [64 / 127, '0.5039370078740157'], [0.1 + 0.2, '0.30000000000000004']];
  for (const [value, text] of doubles) assert.equal(javaDecimalText(value, 'Double'), text, String(value));
  const floats: [number, string][] = [[0.85490197, '0.85490197'], [0.5, '0.5'], [1, '1.0'], [0.2, '0.2'], [0.33333334, '0.33333334'], [1e-4, '1.0E-4'], [0, '0.0']];
  for (const [value, text] of floats) assert.equal(javaDecimalText(value, 'Float'), text, String(value));
});

test('canonical lengths follow class name, separators, length digits, and text', () => {
  assert.equal(scalarLength('velocity', 'String'), 'String'.length + 3 + 1 + 8);
  assert.equal(scalarLength(0.5, 'Double'), 'Double'.length + 3 + 1 + 3);
  assert.equal(scalarLength(1, 'Long'), 'Long'.length + 3 + 1 + 1);
  assert.equal(scalarLength(true, 'Boolean'), 'Boolean'.length + 3 + 1 + 4);
  assert.equal(scalarLength(null, 'Double'), 5);
  assert.throws(() => scalarLength(1.5, 'Integer'));
});

const fields = (velocity: number): Record<string, unknown> => Object.fromEntries(ACQUIRED_FIELDS.map(field => [field,
  field === 'occurrence' ? 'ALWAYS' : field.startsWith('is') ? false : ['durationCells', 'recurrenceLength', 'recurrenceMask', 'repeatCount'].includes(field) ? 1
    : field === 'velocity' ? velocity : 0.5]));

test('note estimates require exactly the acquired fields', () => {
  const base = noteEstimate(fields(0.5));
  assert.equal(noteEstimate(fields(0.25)), base + 2, 'one more character costs two bytes');
  assert.throws(() => noteEstimate({ ...fields(0.5), extra: 1 }));
  const missing = fields(0.5); delete missing.pan; assert.throws(() => noteEstimate(missing));
  assert(baseEstimate({ name: 'a', playStart: 0, playStop: 4, isLoopEnabled: true, loopStart: 0, loopLength: 4, colorRed: 0.5,
    colorGreen: 0.5, colorBlue: 0.5, colorAlpha: 1 }) > 256);
});

test('layout solver reaches the exact target and refuses impossible limits', () => {
  const costs = new Map([[100, 2058], [127, 2028], [64, 2058], [3, 2060], [5, 2056]]);
  const layout = solveLayout(1504, costs, SNAPSHOT_LIMIT, 100, 2048 * 16);
  assert.equal(layout.a, 100); assert.equal(1504 + layout.countA * 2058 + layout.countB * costs.get(layout.b)!, SNAPSHOT_LIMIT);
  assert.equal(costs.get(layout.a)! - costs.get(layout.b)!, 2, 'the smallest step is preferred');
  const notes = layoutNotes(layout); assert.equal(notes.length, layout.total);
  assert.deepEqual(notes[17], { channel: 1, cell: 0, pitch: 1, velocity: notes[17]!.velocity });
  assert.equal(notes.filter(note => note.velocity === layout.b).length, layout.countB);
  assert.throws(() => solveLayout(1504, costs, SNAPSHOT_LIMIT, 100, 1000));
  assert.throws(() => solveLayout(1504, new Map([[100, 2058]]), SNAPSHOT_LIMIT + 1, 100, 2048 * 16));
});

test('the limit ledger lists every selected limit once with all rule columns', () => {
  const names = SELECTED_LIMITS.map(row => row.limit);
  assert.equal(new Set(names).size, names.length);
  for (const required of ['view-width', 'active-observers', 'occupied-per-clip', 'pending-dirty', 'recorder-storage', 'snapshot-storage',
    'construction', 'binding-replay', 'rebuild-and-scan', 'ping-p95', 'host-work-batch']) assert(names.includes(required), required);
  for (const row of SELECTED_LIMITS) for (const value of Object.values(row)) assert(typeof value === 'string' && value.length > 0);
});

const accounting = (candidate = 0, retained = 0): Wire => ({ heapMeasured: false, hostMemoryMeasured: false, combinedLimitSelected: false,
  serializedBytesAreMemoryMeasurement: false, recorderLimitBytes: SNAPSHOT_LIMIT, snapshotLimitBytes: SNAPSHOT_LIMIT,
  recorderDomainEstimatedBytes: 312, snapshotDomainEstimatedBytes: candidate + retained, authorityDomainEstimatedBytes: 0,
  retainedSnapshotEstimatedBytes: retained, candidateSnapshotEstimatedBytes: candidate });

test('status and refusal checks reject open gates, measured-heap claims, and retained candidates', () => {
  const status = { instrumentationRevision: E219_MARKER, complete: false, eligible: false, resourceAccounting: accounting() };
  checkStatus(status);
  assert.throws(() => checkStatus({ ...status, eligible: true }));
  assert.throws(() => checkStatus({ ...status, resourceAccounting: { ...accounting(), heapMeasured: true } }));
  assert.throws(() => checkStatus({ ...status, resourceAccounting: accounting(SNAPSHOT_LIMIT, 2) }), 'domain over the limit');
  checkRefusal({ ...status, comparison: 'snapshot-memory-budget' }, 'snapshot-memory-budget');
  assert.throws(() => checkRefusal({ ...status, comparison: 'snapshot-memory-budget', resourceAccounting: accounting(2048) }, 'snapshot-memory-budget'));
  assert.throws(() => checkRefusal({ ...status, comparison: 'snapshot-memory-budget', diagnosticSnapshot: {} }, 'snapshot-memory-budget'));
  assert.throws(() => checkRefusal({ ...status, comparison: 'enrichment-budget' }, 'snapshot-memory-budget'), 'an earlier limit is not the boundary');
});

test('the TypeScript estimate equals a Java-built snapshot estimate', async () => {
  const { readFile } = await import('node:fs/promises');
  const { snapshotEstimate } = await import('./e219-snapshot-budgets-lib.js');
  const golden = JSON.parse(await readFile(new URL('../../../context/evidence/data/e219-snapshot-budgets/java-estimate-golden.json', import.meta.url), 'utf8')) as Wire;
  const notes = golden.notes as { fields: Wire }[];
  assert.equal(notes.length, 5);
  assert.equal(snapshotEstimate(golden.metadata as Wire, notes), golden.payloadEstimatedBytes);
  const changed = structuredClone(notes); changed[0]!.fields.velocity = 0.5;
  assert.notEqual(snapshotEstimate(golden.metadata as Wire, changed), golden.payloadEstimatedBytes, 'a changed value changes the estimate');
});

async function retained(name: string): Promise<Wire> {
  const { readFile } = await import('node:fs/promises'); const { gunzipSync } = await import('node:zlib');
  return JSON.parse(gunzipSync(await readFile(new URL(`../../../context/evidence/data/e219-snapshot-budgets/${name}`, import.meta.url))).toString('utf8')) as Wire;
}
type Arm = { name: string; steps: Wire[] };
const stepOf = (report: Wire, arm: string, label: string): Wire =>
  (report.arms as Arm[]).find(value => value.name === arm)!.steps.find(value => value.label === label)!;

test('the retained E219 run verifies every arm at the 16 MiB boundary', async () => {
  const { verifyReport } = await import('./e219-snapshot-budgets-lib.js');
  const summary = verifyReport(await retained('run-2.json.gz'));
  assert.equal(summary.excessStepBytes, 2); assert.equal(summary.complete, false); assert.equal(summary.eligible, false);
  assert.equal(Object.keys(summary.outcomes as Wire).length, 9);
});

test('retained-report mutants fail verification', async () => {
  const { verifyReport } = await import('./e219-snapshot-budgets-lib.js');
  const original = await retained('run-2.json.gz');
  const mutants: [string, (report: Wire) => void][] = [
    ['equality estimate below the limit', r => { ((stepOf(r, 'boundary', 'equality').result as Wire).diagnosticSnapshot as Wire).payloadEstimatedBytes = SNAPSHOT_LIMIT - 2; }],
    ['excess published', r => { (stepOf(r, 'boundary', 'excess').result as Wire).comparison = 'match'; }],
    ['excess retains a candidate', r => { ((stepOf(r, 'boundary', 'excess').result as Wire).resourceAccounting as Wire).candidateSnapshotEstimatedBytes = 64; }],
    ['earlier limit labeled as the boundary', r => { (stepOf(r, 'boundary', 'excess').result as Wire).comparison = 'enrichment-budget'; }],
    ['combined refusal without overlap', r => { ((stepOf(r, 'combined', 'second-over-retained').result as Wire).resourceAccounting as Wire).retainedSnapshotEstimatedBytes = 0; }],
    ['wrong field value', r => { (((stepOf(r, 'boundary', 'equality').result as Wire).authorityNotes as Wire[])[0]!.fields as Wire).velocity = 0.5; }],
    ['interruption released nothing', r => { (((stepOf(r, 'interrupted', 'retire-during-enrichment').metrics as Wire).interrupted as Wire).after as Wire).resourceAccounting = { ...((stepOf(r, 'interrupted', 'retire-during-enrichment').result as Wire).resourceAccounting as Wire), snapshotDomainEstimatedBytes: 4096, candidateSnapshotEstimatedBytes: 4096 }; }],
    ['missing recovery', r => { (r.arms as Arm[]).find(arm => arm.name === 'interrupted')!.steps.pop(); }],
    ['ping p95 over the limit', r => { (r.latency as Wire).underLoadP95Ms = 50.5; }],
    ['open eligibility gate', r => { (stepOf(r, 'combined', 'first-after-eviction').result as Wire).eligible = true; }],
    ['measured heap claim', r => { ((stepOf(r, 'boundary', 'equality').result as Wire).resourceAccounting as Wire).heapMeasured = true; }],
  ];
  for (const [name, mutate] of mutants) {
    const report = structuredClone(original); mutate(report);
    assert.throws(() => verifyReport(report), name);
  }
});

test('the first live run stays a diagnostic: it never reached partial enrichment', async () => {
  const { verifyReport } = await import('./e219-snapshot-budgets-lib.js');
  const run = await retained('run-1-diagnostic.json.gz');
  assert.equal(run.marker, '8g3-shadow-budgets-v1'); assert.match(String(run.error), /enrichment stage was reached/);
  assert.throws(() => verifyReport(run));
  assert.equal((stepOf(run, 'boundary', 'equality').result as Wire).comparison, 'match');
  assert.equal((stepOf(run, 'boundary', 'excess').result as Wire).comparison, 'snapshot-memory-budget');
  assert.equal((stepOf(run, 'interrupted', 'retire-during-enrichment').result as Wire).comparison, 'match', 'the interruption did not occur');
});
