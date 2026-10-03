/**
 * E219 (8g3) library: an independent copy of the Java snapshot payload estimate,
 * an exact-equality layout solver, the selected limit ledger, and report checks.
 * The estimate is a source model. It does not measure JVM heap or host memory.
 */
import assert from 'node:assert/strict';
import { ACQUIRED_FIELDS } from './phase8g-shadow-mutations.js';

type Wire = Record<string, unknown>;
export type JavaType = 'Double' | 'Float' | 'Long' | 'Integer' | 'Boolean' | 'String';
export const E219_MARKER = '8g3-shadow-budgets-v2';
export const SNAPSHOT_LIMIT = 16 * 1024 * 1024;
export const RECORDER_LIMIT = 16 * 1024 * 1024;
export const PING_P95_LIMIT_MS = 50;
export const UNSUPPORTED_FIELDS = ['articulation', 'portableRepeat'] as const;

/** Java classes of each acquired value. The adapter boxes NoteStep getters with these types. */
export const NOTE_FIELD_TYPES: Readonly<Record<(typeof ACQUIRED_FIELDS)[number], JavaType>> = {
  velocity: 'Double', releaseVelocity: 'Double', velocitySpread: 'Double', duration: 'Double', durationCells: 'Long',
  rawDuration: 'Double', gain: 'Double', rawGain: 'Double', pan: 'Double', pressure: 'Double', timbre: 'Double',
  rawTimbre: 'Double', transpose: 'Double', chance: 'Double', isChanceEnabled: 'Boolean', isMuted: 'Boolean',
  isOccurrenceEnabled: 'Boolean', occurrence: 'String', isRecurrenceEnabled: 'Boolean', recurrenceLength: 'Integer',
  recurrenceMask: 'Integer', isRepeatEnabled: 'Boolean', repeatCount: 'Integer', repeatCurve: 'Double',
  repeatVelocityCurve: 'Double', repeatVelocityEnd: 'Double',
};
/** Clip metadata classes. Beat times are doubles; color components are floats. */
export const METADATA_TYPES: Readonly<Record<string, JavaType>> = {
  name: 'String', playStart: 'Double', playStop: 'Double', isLoopEnabled: 'Boolean', loopStart: 'Double',
  loopLength: 'Double', colorRed: 'Float', colorGreen: 'Float', colorBlue: 'Float', colorAlpha: 'Float',
};

/** Java Double.toString and Float.toString text from the shortest round-trip digits (JDK 19 and later). */
export function javaDecimalText(value: number, type: 'Double' | 'Float'): string {
  assert(Number.isFinite(value), 'Java decimal text needs a finite value');
  // JSON carries Java's Float text. The parsed double is that decimal; the Java value is its binary32 rounding.
  const exact = type === 'Float' ? Math.fround(value) : value;
  if (exact === 0) return Object.is(exact, -0) ? '-0.0' : '0.0';
  const sign = exact < 0 ? '-' : '', magnitude = Math.abs(exact);
  let scientific = magnitude.toExponential();
  if (type === 'Float') for (let digits = 1; digits <= 9; digits++) {
    const candidate = magnitude.toExponential(digits - 1);
    if (Math.fround(Number(candidate)) === magnitude) { scientific = candidate; break; }
  }
  const [mantissa, exponentText] = scientific.split('e') as [string, string];
  const digits = mantissa.replace('.', ''), exponent = Number(exponentText);
  if (magnitude >= 1e-3 && magnitude < 1e7) {
    if (exponent >= 0) {
      const whole = digits.slice(0, exponent + 1).padEnd(exponent + 1, '0'), fraction = digits.slice(exponent + 1);
      return `${sign}${whole}.${fraction === '' ? '0' : fraction}`;
    }
    return `${sign}0.${'0'.repeat(-exponent - 1)}${digits}`;
  }
  return `${sign}${digits[0]}.${digits.length > 1 ? digits.slice(1) : '0'}E${exponent}`;
}

function javaText(value: unknown, type: JavaType): string {
  switch (type) {
    case 'Double': case 'Float': assert(typeof value === 'number'); return javaDecimalText(value, type);
    case 'Long': case 'Integer': assert(Number.isSafeInteger(value)); return String(value);
    case 'Boolean': assert(typeof value === 'boolean'); return String(value);
    case 'String': assert(typeof value === 'string'); return value;
  }
}
/** ShadowProjectCache.canonicalLength for one scalar: class name, separators, length digits, and text. */
export function scalarLength(value: unknown, type: JavaType): number {
  if (value === null) return 5;
  const text = javaText(value, type);
  return type.length + 3 + String(text.length).length + text.length;
}
const stringLength = (text: string): number => scalarLength(text, 'String');
export function mapLength(values: Readonly<Record<string, unknown>>, types: Readonly<Record<string, JavaType>>): number {
  let length = 2;
  for (const [key, value] of Object.entries(values)) {
    const type = types[key]; assert(type, `no Java type for ${key}`);
    length += stringLength(key) + scalarLength(value, type);
  }
  return length;
}
export function listLength(values: readonly string[]): number { return 2 + values.reduce((sum, value) => sum + stringLength(value), 0); }

/** Base estimate: 256 bytes plus two bytes per canonical character of metadata and field lists. */
export function baseEstimate(metadata: Readonly<Record<string, unknown>>, fields: readonly string[] = ACQUIRED_FIELDS,
  unsupported: readonly string[] = UNSUPPORTED_FIELDS): number {
  return 256 + 2 * (mapLength(metadata, METADATA_TYPES) + listLength(fields) + listLength(unsupported));
}
/** Per-note estimate: 128 bytes plus two bytes per canonical character of the requested field map. */
export function noteEstimate(fields: Readonly<Record<string, unknown>>): number {
  for (const field of ACQUIRED_FIELDS) assert(Object.hasOwn(fields, field), `missing acquired field ${field}`);
  assert.equal(Object.keys(fields).length, ACQUIRED_FIELDS.length, 'only requested fields enter the estimate');
  return 128 + 2 * mapLength(fields, NOTE_FIELD_TYPES);
}
export function snapshotEstimate(metadata: Readonly<Record<string, unknown>>, notes: readonly { fields: Readonly<Record<string, unknown>> }[]): number {
  return notes.reduce((sum, note) => sum + noteEstimate(note.fields), baseEstimate(metadata));
}

export interface Layout { readonly a: number; readonly b: number; readonly countA: number; readonly countB: number; readonly total: number }
/**
 * Choose velocity classes a and b and counts so that base + countA*cost(a) + countB*cost(b) equals the target.
 * Prefer the reference velocity for a, then the smallest cost difference.
 */
export function solveLayout(base: number, costs: ReadonlyMap<number, number>, target: number, reference: number, maximumNotes: number,
  minimumB = 0): Layout {
  const remainder = target - base; assert(remainder > 0, 'the base already reaches the target');
  const ordered = [...costs.keys()].sort((x, y) => (x === reference ? -1 : y === reference ? 1 : x - y));
  let best = null as Layout | null;
  for (const a of ordered) {
    const costA = costs.get(a)!;
    for (const [b, costB] of costs) {
      const step = costA - costB; if (step <= 0) continue;
      const first = Math.ceil(remainder / costA);
      for (let total = first; total < first + step && total <= maximumNotes; total++) {
        const over = total * costA - remainder; if (over % step !== 0) continue;
        const countB = over / step; if (countB > total || countB < minimumB) continue;
        const layout = { a, b, countA: total - countB, countB, total };
        if (!best || (best.a !== reference && a === reference) || (best.a === a && costA - costs.get(best.b)! > step)) best = layout;
      }
    }
    if (best && best.a === reference) break;
  }
  assert(best, 'no exact layout within the note limit');
  assert.equal(base + best.countA * costs.get(best.a)! + best.countB * costs.get(best.b)!, target);
  return best;
}

/** Note positions: 16 channels per coordinate; coordinate index = cell * 128 + pitch. */
export function layoutNotes(layout: Layout): { channel: number; cell: number; pitch: number; velocity: number }[] {
  const notes = [];
  for (let index = 0; index < layout.total; index++) {
    const coordinate = Math.floor(index / 16);
    notes.push({ channel: index % 16, cell: Math.floor(coordinate / 128), pitch: coordinate % 128, velocity: index < layout.countB ? layout.b : layout.a });
  }
  return notes;
}

export interface LimitRow {
  readonly limit: string; readonly selected: string; readonly measurement: string; readonly domain: string;
  readonly equality: string; readonly excess: string; readonly recovery: string;
}
/** Work item 1: every selected limit with its measurement, accounting domain, equality, excess, and recovery rules. */
export const SELECTED_LIMITS: readonly LimitRow[] = [
  { limit: 'view-width', selected: '131,072 steps', measurement: 'requested coverage width', domain: 'per request', equality: 'passes', excess: 'view-width-limit; exact fallback', recovery: 'narrower request' },
  { limit: 'active-observers', selected: '512', measurement: 'allocated StepData observers, all experimental probes', domain: 'aggregate observers', equality: 'passes', excess: 'combined-observer-budget; refuse', recovery: 'reload with a smaller configuration' },
  { limit: 'occupied-per-clip', selected: '2,048 coordinates', measurement: 'sparse occupied set size', domain: 'per clip', equality: 'passes', excess: 'clip-density-limit; overflow', recovery: 'explicit new binding after the clip shrinks' },
  { limit: 'pending-dirty', selected: '2,048 coordinates', measurement: 'cache dirty plus physical hint coordinates', domain: 'aggregate pending', equality: 'passes', excess: 'physical-hint-backpressure or dirty-backpressure; rebuild', recovery: 'explicit rebuild or new binding' },
  { limit: 'recorder-storage', selected: '16 MiB estimate', measurement: '256 per resident or staged recorder + 56 per occupied, dirty, or queued hint', domain: 'recorder (resident + staging + hint queues)', equality: 'passes', excess: 'memory-budget; shed all residence', recovery: 'explicit new binding' },
  { limit: 'snapshot-storage', selected: '16 MiB estimate', measurement: 'payload estimate of retained snapshots plus the private candidate', domain: 'snapshot (retained + candidate)', equality: 'passes', excess: 'snapshot-memory-budget; candidate retired, nothing retained', recovery: 'eviction or a smaller clip, then an explicit new attempt' },
  { limit: 'authority-staging', selected: '16 MiB estimate', measurement: '160 + 64 per field for each staged authority note', domain: 'authority (comparison oracle or exact buffer; one active)', equality: 'passes', excess: 'authority-staging-memory-budget; refuse', recovery: 'explicit new request' },
  { limit: 'construction', selected: '50 ms', measurement: 'shadow bank construction wall time', domain: 'per initialization', equality: 'passes', excess: 'cache-construction-budget; shed', recovery: 'reload' },
  { limit: 'host-work-batch', selected: '50 ms (40 ms target, 45 ms authority cap)', measurement: 'one reconciliation, authority, or enrichment batch', domain: 'per batch', equality: 'passes', excess: 'reconciliation-budget, authority-host-work-budget, or enrichment-budget', recovery: 'explicit new attempt' },
  { limit: 'binding-replay', selected: '5 s', measurement: 'binding stage and replay settlement; also the enrichment candidate deadline', domain: 'per binding or candidate', equality: 'passes', excess: 'binding-budget, replay-budget, or enrichment-deadline', recovery: 'explicit new binding or attempt' },
  { limit: 'rebuild-and-scan', selected: '40 s', measurement: 'binding sequence, comparison scan, exact scan, inventory rebuild', domain: 'per attempt', equality: 'passes', excess: 'binding-sequence-budget, authority-scan-budget, rebuild-budget', recovery: 'explicit new attempt' },
  { limit: 'ping-p95', selected: '50 ms', measurement: 'client-measured bridge ping p95, supplied through the ping operation', domain: 'global', equality: 'passes', excess: 'tail-latency-budget; shed and refuse', recovery: 'new measurement within the limit, then a new binding' },
];

function measure(value: unknown, name: string): number {
  assert(typeof value === 'number' && Number.isFinite(value) && value >= 0, `invalid measurement ${name}`); return value;
}
/** Shape and closed-gate checks for every 8g3 status. Unmeasured quantities stay explicit. */
export function checkStatus(value: Wire): void {
  assert.equal(value.instrumentationRevision, E219_MARKER); assert.equal(value.complete, false); assert.equal(value.eligible, false);
  const accounting = value.resourceAccounting as Wire; assert(accounting, 'resource accounting is reported');
  assert.equal(accounting.heapMeasured, false); assert.equal(accounting.hostMemoryMeasured, false);
  assert.equal(accounting.combinedLimitSelected, false); assert.equal(accounting.serializedBytesAreMemoryMeasurement, false);
  assert.equal(accounting.recorderLimitBytes, RECORDER_LIMIT); assert.equal(accounting.snapshotLimitBytes, SNAPSHOT_LIMIT);
  assert(measure(accounting.recorderDomainEstimatedBytes, 'recorder') <= RECORDER_LIMIT);
  assert(measure(accounting.snapshotDomainEstimatedBytes, 'snapshot') <= SNAPSHOT_LIMIT);
  assert(measure(accounting.authorityDomainEstimatedBytes, 'authority') <= SNAPSHOT_LIMIT);
  assert.equal(accounting.snapshotDomainEstimatedBytes, measure(accounting.retainedSnapshotEstimatedBytes, 'retained')
    + measure(accounting.candidateSnapshotEstimatedBytes, 'candidate'));
}
/** A refusal exposes no snapshot output and retains no candidate. */
export function checkRefusal(value: Wire, reason: string): void {
  checkStatus(value); assert.equal(value.comparison, reason); assert.notEqual(value.contentComparisonComplete, true);
  assert(!value.diagnosticSnapshot && !value.historicalSnapshot, 'a refusal exposes no snapshot');
  assert.equal((value.resourceAccounting as Wire).candidateSnapshotEstimatedBytes, 0, 'a refusal retains no candidate');
}

interface PlainNote { channel: number; cell: number; pitch: number; fields: Record<string, unknown> }
const key = (note: { channel: number; cell: number; pitch: number }): string => `${note.channel}:${note.cell}:${note.pitch}`;
/** Independent field oracle: every written note, and only those, with the written velocity class and full fields. */
export function checkProjection(notes: readonly PlainNote[], expected: readonly { channel: number; cell: number; pitch: number; velocity: number }[],
  velocityValues: ReadonlyMap<number, number>): void {
  assert.equal(notes.length, expected.length, 'note count matches the written layout');
  const byKey = new Map(notes.map(note => [key(note), note]));
  for (const write of expected) {
    const note = byKey.get(key(write)); assert(note, `missing written note ${key(write)}`);
    assert.equal(note.fields.velocity, velocityValues.get(write.velocity), `velocity class at ${key(write)}`);
    assert.equal(note.fields.durationCells, 1); assert.equal(Object.keys(note.fields).length, ACQUIRED_FIELDS.length);
  }
}
/** Independent payload estimate from authority notes and metadata. */
export function authorityEstimate(value: Wire): number {
  return snapshotEstimate(value.authorityMetadata as Wire, value.authorityNotes as PlainNote[]);
}

const NUMBER_FIELDS = ['wallMs', 'bridgeRequests', 'responseBytes'] as const;
const sortKey = (a: PlainNote, b: PlainNote): number => a.channel - b.channel || a.cell - b.cell || a.pitch - b.pitch;
/** Required arms and steps. Each label has its expected terminal comparison. */
export const REQUIRED_STEPS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  boundary: { equality: 'match', excess: 'snapshot-memory-budget', 'equality-restored': 'match' },
  combined: { 'second-over-retained': 'snapshot-memory-budget', 'second-after-eviction': 'match',
    'first-over-retained': 'snapshot-memory-budget', 'first-after-eviction': 'match' },
  interrupted: { 'retire-during-enrichment': 'window-changed', 'explicit-recovery': 'match' },
};
/** Verify one retained E219 report. Returns the arm outcomes. */
export function verifyReport(report: Wire): Wire {
  assert.equal(report.marker, E219_MARKER); assert.equal(report.researchOnly, true);
  assert.equal(report.complete, false); assert.equal(report.eligible, false); assert(typeof report.ended === 'string');
  assert(!report.error, `the run failed: ${String(report.error)}`);
  const calibration = report.calibration as Wire, result = calibration.result as Wire;
  assert.equal(result.comparison, 'match');
  assert.equal(authorityEstimate(result), (result.diagnosticSnapshot as Wire).payloadEstimatedBytes, 'calibration oracle equals the Java estimate');
  const notes = result.authorityNotes as PlainNote[]; assert.equal(notes.length, 127);
  const costs = new Map(notes.map(note => [note.pitch + 1, noteEstimate(note.fields)] as [number, number]));
  const values = new Map(notes.map(note => [note.pitch + 1, note.fields.velocity as number] as [number, number]));
  assert.deepEqual([...costs].sort((x, y) => x[0] - y[0]), [...new Map(calibration.costs as [number, number][])].sort((x, y) => x[0] - y[0]));
  const base = baseEstimate(result.authorityMetadata as Wire); assert.equal(calibration.base, base);
  const layout = solveLayout(base, costs, SNAPSHOT_LIMIT, Number(calibration.reference), 2048 * 16, 1);
  assert.deepEqual({ ...layout, base }, report.layout, 'the layout follows from the calibration');
  const step = costs.get(layout.a)! - costs.get(layout.b)!;
  const arms = new Map((report.arms as Wire[]).map(arm => [String(arm.name), arm.steps as Wire[]]));
  const outcomes: Wire = {};
  for (const [name, required] of Object.entries(REQUIRED_STEPS)) {
    const steps = arms.get(name); assert(steps, `missing arm ${name}`);
    assert.deepEqual(steps.map(value => value.label), Object.keys(required), `${name} steps`);
    for (const value of steps) {
      const label = String(value.label), expected = required[label]!, wire = value.result as Wire;
      assert.equal(value.expected, expected); checkStatus(wire);
      for (const field of NUMBER_FIELDS) measure((value.metrics as Wire)[field], field);
      if (expected === 'match') {
        assert.equal(wire.comparison, 'match', `${name}:${label}`); assert.equal(wire.contentComparisonComplete, true);
        const snapshot = wire.diagnosticSnapshot as Wire, estimate = authorityEstimate(wire);
        assert.equal(estimate, snapshot.payloadEstimatedBytes, `${label}: oracle equals the Java estimate`);
        assert(estimate <= SNAPSHOT_LIMIT);
        assert.deepEqual([...(snapshot.notes as PlainNote[])].sort(sortKey), [...(wire.authorityNotes as PlainNote[])].sort(sortKey),
          `${label}: snapshot notes equal independent authority`);
        if (value.boundary === 'equality') assert.equal(estimate, SNAPSHOT_LIMIT, `${label}: equality exercises 16 MiB itself`);
      } else if (label === 'retire-during-enrichment') {
        const interrupted = (value.metrics as Wire).interrupted as Wire, partial = interrupted.partial as Wire, after = interrupted.after as Wire;
        assert.equal(partial.scanStage, 'enrichment'); assert.equal((partial.snapshotCandidate as Wire).phase, 'enriching');
        assert((partial.resourceAccounting as Wire).candidateSnapshotEstimatedBytes as number > 0, 'partial work was staged');
        assert(!partial.diagnosticSnapshot && !partial.authorityNotes, 'partial work exposed no values');
        checkRefusal(after, 'window-changed'); assert.equal((after.lastSnapshotCandidate as Wire).phase, 'retired');
        assert.equal((after.resourceAccounting as Wire).snapshotDomainEstimatedBytes, 0, 'retirement released the candidate');
        assert(!(interrupted.poll as Wire).diagnosticSnapshot && !(interrupted.poll as Wire).authorityNotes);
      } else {
        checkRefusal(wire, expected);
        if (value.boundary === 'excess') assert.equal(authorityEstimate(wire), SNAPSHOT_LIMIT + step, 'excess is the smallest step over 16 MiB');
        else assert(authorityEstimate(wire) + Number((wire.resourceAccounting as Wire).retainedSnapshotEstimatedBytes) > SNAPSHOT_LIMIT,
          `${label}: the retained snapshot and the candidate exceed the domain`);
      }
      if (value.projection) checkProjection(wire.authorityNotes as PlainNote[], value.projection as never, values);
      outcomes[`${name}:${label}`] = wire.comparison;
    }
  }
  const latency = report.latency as Wire; assert(measure(latency.underLoadP95Ms, 'p95') <= PING_P95_LIMIT_MS, 'ping p95 under load');
  assert((latency.samples as number[]).length >= 25);
  return { outcomes, excessStepBytes: step, pingP95Ms: latency.underLoadP95Ms, complete: false, eligible: false };
}
