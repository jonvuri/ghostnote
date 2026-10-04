/** Independent oracles and checks for the 8g5 consumer workflows. Research only. */
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { ACQUIRED_FIELDS, applyExpectedProps, checkMutationNotes } from './phase8g-shadow-mutations.js';
import { independentNotes } from './phase8g4-native-lib.js';
import { assessShadowAdmission, assessShadowConsumer, shadowSnapshotFromWire, type NormalizedValue,
  type ShadowCacheWireSnapshot, type ShadowConsumerResult, type ShadowDependency, type ShadowNote,
  type ShadowSnapshot } from './phase8g-shadow-cache-lib.js';

export type Wire = Record<string, unknown>;
export const CONSUMER_SCHEMA = 'phase8g5-consumers-v1';
/** The final 8g5c build. 8g5 changes no Java code. */
export const FINAL_MARKER = '8g5c-combined-storage-v4';
export const PROTECTED_PROJECT = 'New 3';
export const ORIGINAL_CONFIG_SHA256 = '256bbf07094cd654c372d0e5e050e494ef7783c9a0001a0a2a688331bcf643b0';
export const TARGET_ROW = 2, CANARY_ROW = 3;
export const TARGET_NAME = 'gn-8g5-A', CANARY_NAME = 'gn-8g5-B';
const GRID = 1 / 512, WIDTH = 2048;

/** The selected counted 512-channel route with the E218 observer settings. */
export function consumerConfig(): Wire {
  return { recordChars: 0, stamp: '8g5-consumers', tracks: 512, cacheTopologyCounted: true, cacheTopologyTracks: 512,
    cacheLifecycleResearch: true, deliveryResearch: true, cacheShadowObservers: 2, cacheShadowSteps: WIDTH,
    fineSteps: WIDTH, contentFilter: 'ALL_CHANNELS' };
}

export interface DeclaredNote {
  readonly channel: number; readonly cell: number; readonly pitch: number;
  /** Integer write velocity, 1..127. */
  readonly velocity: number; readonly durationCells: number; readonly props?: Wire;
}
/** Disabled raw controls, all-channel collisions, and the final covered cell are part of the target. */
export const TARGET_FIXTURE: readonly DeclaredNote[] = [
  { channel: 0, cell: 0, pitch: 60, velocity: 100, durationCells: 128 },
  { channel: 0, cell: 512, pitch: 64, velocity: 90, durationCells: 256, props: { pan: -.25, timbre: .5 } },
  { channel: 0, cell: 1024, pitch: 67, velocity: 80, durationCells: 64 },
  { channel: 3, cell: 256, pitch: 62, velocity: 70, durationCells: 32, props: { chance: .625, isChanceEnabled: false } },
  { channel: 3, cell: 768, pitch: 65, velocity: 110, durationCells: 512, props: { gain: .625, transpose: 3 } },
  { channel: 7, cell: 100, pitch: 70, velocity: 64, durationCells: 3, props: { occurrence: 'FIRST', isOccurrenceEnabled: false } },
  { channel: 7, cell: 1300, pitch: 71, velocity: 64, durationCells: 40, props: { recurrence: [8, 85], isRecurrenceEnabled: false } },
  { channel: 9, cell: 1536, pitch: 36, velocity: 127, durationCells: 16, props: { isMuted: true, velocitySpread: .125 } },
  { channel: 12, cell: 1800, pitch: 50, velocity: 64, durationCells: 40, props: { repeatCount: 3, isRepeatEnabled: false } },
  { channel: 15, cell: 0, pitch: 60, velocity: 50, durationCells: 8 },
  { channel: 15, cell: 2047, pitch: 72, velocity: 1, durationCells: 1, props: { releaseVelocity: .375 } },
];
export const CANARY_FIXTURE: readonly DeclaredNote[] = [{ channel: 0, cell: 0, pitch: 48, velocity: 100, durationCells: 64 }];
/** The public patch transposes this source note by two semitones. */
export const PATCH = { channel: 0, cell: 0, pitch: 60, semitones: 2 } as const;
export const FIELD_EDIT = { channel: 3, cell: 768, pitch: 65, props: { velocity: .25, pan: .5 } } as const;
/** The operator deletes this note in the Bitwig editor. It is the only note at its pitch. */
export const NATIVE_DELETE = { channel: 0, cell: 1024, pitch: 67 } as const;
/** This note is written during an active comparison, then removed. */
export const FALLBACK_WRITE = { channel: 5, cell: 600, pitch: 80, velocity: 100, durationCells: 16 } as const;
export const METADATA = { lengthBeats: 4, playStartBeats: 0, loopStartBeats: 0, loopEndBeats: 4, loopEnabled: true };

const key = (note: { channel: number; cell: number; pitch: number }): string => `${note.channel}:${note.cell}:${note.pitch}`;
const close = (actual: unknown, expected: number): boolean => typeof actual === 'number' && Math.abs(actual - expected) <= 1e-6;

/** The declared write values must read back before the raw read can supply the remaining defaults. */
export function declaredIssues(raw: Wire, declared: readonly DeclaredNote[]): string[] {
  const notes = independentNotes(raw), issues: string[] = [];
  if (notes.length !== declared.length) issues.push(`declared-count:${notes.length}`);
  for (const item of declared) {
    const match = notes.filter(note => key(note) === key(item));
    if (match.length !== 1) { issues.push(`declared-membership:${key(item)}`); continue; }
    const fields = match[0]!.fields, expected: ShadowNote = { channel: item.channel, cell: item.cell, pitch: item.pitch,
      fields: { ...fields, velocity: item.velocity / 127 } };
    applyExpectedProps(expected as never, { duration: item.durationCells * GRID, ...(item.props ?? {}) });
    for (const field of ACQUIRED_FIELDS) {
      const want = expected.fields[field], got = fields[field];
      if (typeof want === 'number' ? !close(got, want) : got !== want) issues.push(`declared-field:${key(item)}:${field}`);
    }
  }
  return issues;
}

export type Change =
  | { kind: 'transpose'; channel: number; cell: number; pitch: number; semitones: number }
  | { kind: 'props'; channel: number; cell: number; pitch: number; props: Wire }
  | { kind: 'delete'; channel: number; cell: number; pitch: number }
  | { kind: 'add'; note: ShadowNote };

/** Apply one declared change. Unchanged notes keep every acquired value. */
export function applyChange(notes: readonly ShadowNote[], change: Change): ShadowNote[] {
  const copy = structuredClone(notes) as ShadowNote[];
  if (change.kind === 'add') {
    assert(!copy.some(note => key(note) === key(change.note)), 'declared add collides');
    return [...copy, structuredClone(change.note)];
  }
  const index = copy.findIndex(note => key(note) === key(change));
  assert(index >= 0, `declared change has no source: ${key(change)}`);
  if (change.kind === 'delete') { copy.splice(index, 1); return copy; }
  if (change.kind === 'transpose') {
    const moved = { ...copy[index]!, pitch: change.pitch + change.semitones };
    assert(!copy.some(note => key(note) === key(moved)), 'transpose collides');
    copy[index] = moved; return copy;
  }
  const note = { ...copy[index]!, fields: { ...copy[index]!.fields } };
  applyExpectedProps(note as never, change.props); copy[index] = note; return copy;
}

function metadataOf(raw: Wire): Wire {
  const metadata: Wire = { name: raw.name, isLoopEnabled: raw.loopEnabled };
  for (const field of ['playStart', 'playStop', 'loopStart', 'loopLength', 'colorRed', 'colorGreen', 'colorBlue', 'colorAlpha']) metadata[field] = raw[field];
  return metadata;
}

/**
 * Check one published comparison against the independent raw read and the declared oracle.
 * A refusal is never a match. Cache and authority values cannot define the oracle.
 */
export function caseIssues(value: Wire, raw: Wire, rawMetadata: Wire, expected: readonly ShadowNote[], address: Wire, name: string): string[] {
  if (value.comparison !== 'match') return [`comparison:${String(value.comparison)}`];
  const issues: string[] = [];
  if (value.complete !== false || value.eligible !== false) issues.push('gate-open');
  if (value.instrumentationRevision !== FINAL_MARKER) issues.push('marker');
  if (value.stepWindowConfirmed !== true || value.contentComparisonComplete !== true || value.authorityAvailable !== true) issues.push('window');
  const snapshot = value.diagnosticSnapshot as ShadowCacheWireSnapshot | undefined;
  if (!snapshot || !Array.isArray(value.authorityNotes)) return [...issues, 'payload'];
  if (!isDeepStrictEqual(snapshot.address, address)) issues.push('address');
  if (rawMetadata.exists !== true || rawMetadata.name !== name) issues.push('raw-metadata');
  const metadata = metadataOf(rawMetadata);
  // Key order is not part of the value.
  if (!isDeepStrictEqual(snapshot.metadata, metadata)) issues.push('snapshot-metadata');
  if (!isDeepStrictEqual(value.authorityMetadata, metadata)) issues.push('authority-metadata');
  for (const coverage of [snapshot.coverage, value.authorityCoverage as Wire] as Wire[]) {
    if (coverage.startCell !== 0 || coverage.width !== WIDTH || coverage.allChannels !== true || coverage.timingBasis !== '1/512-beat'
      || JSON.stringify([...coverage.fields as string[]].sort()) !== JSON.stringify([...ACQUIRED_FIELDS].sort())) issues.push('coverage');
  }
  for (const [label, notes] of [['raw', independentNotes(raw)], ['snapshot', snapshot.notes], ['authority', value.authorityNotes]] as const) {
    for (const issue of checkMutationNotes(notes as ShadowNote[], expected)) issues.push(`${label}:${issue}`);
  }
  return issues;
}

/**
 * The legacy E131 reconstruct path loses disabled expression state (migration contract; 8h owns
 * the fix). It can enable a disabled control and reset disabled recurrence values. These are
 * the only differences that a stable write may have from the declared oracle.
 */
export const LEGACY_WRITER_FIELDS = ['isChanceEnabled', 'isOccurrenceEnabled', 'isRecurrenceEnabled', 'recurrenceLength',
  'recurrenceMask', 'isRepeatEnabled'] as const;
export function writerEffects(expected: readonly ShadowNote[], raw: Wire): { effects: string[]; issues: string[] } {
  const actual = new Map(independentNotes(raw).map(note => [key(note), note])), effects: string[] = [], issues: string[] = [];
  if (actual.size !== expected.length || expected.some(note => !actual.has(key(note)))) return { effects, issues: ['writer-membership'] };
  for (const note of expected) for (const field of ACQUIRED_FIELDS) {
    const want = note.fields[field], got = actual.get(key(note))!.fields[field];
    if (typeof want === 'number' ? close(got, want) : got === want) continue;
    effects.push(`${key(note)}:${field}:${String(want)}->${String(got)}`);
    const legacy = (LEGACY_WRITER_FIELDS as readonly string[]).includes(field)
      && (field.startsWith('is') ? want === false && got === true : note.fields.isRecurrenceEnabled === false);
    if (!legacy) issues.push(`writer-field:${key(note)}:${field}`);
  }
  return { effects, issues };
}

/** An explicit refusal carries no cached or authority payload. */
export function refusalIssues(value: Wire, reasons: readonly string[]): string[] {
  const issues: string[] = [];
  const reason = String(value.comparison ?? value.reason);
  if (!reasons.includes(reason) && !reasons.includes(String(value.reason))) issues.push(`reason:${reason}`);
  if (value.complete !== false || value.eligible !== false) issues.push('gate-open');
  for (const field of ['diagnosticSnapshot', 'authorityNotes', 'historicalSnapshot']) if (value[field] !== undefined) issues.push(`payload:${field}`);
  return issues;
}

/** Exact fallback reads every requested coordinate and channel without cache membership. */
export function exactIssues(value: Wire, expected: readonly ShadowNote[], address: Wire): string[] {
  const issues: string[] = [];
  if (value.terminal !== true || value.phase !== 'acquired' || value.authorityAvailable !== true) return [`exact:${String(value.reason ?? value.phase)}`];
  if (value.complete !== false || value.eligible !== false) issues.push('gate-open');
  if (value.readMode !== 'exact-fallback' || value.cacheResidenceAdmitted !== false || value.cacheMembershipUsed !== false) issues.push('route');
  if (value.scannedCoordinates !== WIDTH * 128) issues.push('scope');
  if (!isDeepStrictEqual(value.address, { trackId: address.trackId, row: address.row })) issues.push('address');
  for (const issue of checkMutationNotes(value.authorityNotes as ShadowNote[], expected)) issues.push(`exact:${issue}`);
  return issues;
}

/**
 * The stable E131 source is a separate public read. Compare identity, timing, velocity, and
 * the fields that it states. Raw unit conversions stay with the shadow comparison.
 */
export function stableSourceIssues(source: Wire, expected: readonly ShadowNote[]): string[] {
  const clips = source.clips as Wire[] | undefined;
  if (!Array.isArray(clips) || clips.length !== 1) return ['stable-clip-count'];
  const coverage = source.coverage as Wire;
  const issues: string[] = [];
  if (coverage.complete !== true || coverage.channelsPerClip !== 16) issues.push('stable-coverage');
  const notes = (clips[0]!.channels as Wire[]).flatMap(channel => (channel.notes as Wire[]).map(note => ({ channel: Number(channel.channel), note })));
  if (notes.length !== expected.length) issues.push(`stable-count:${notes.length}`);
  for (const item of expected) {
    const match = notes.filter(({ channel, note }) => channel === item.channel && note.pitch === item.pitch && close(note.startBeats, item.cell * GRID));
    if (match.length !== 1) { issues.push(`stable-membership:${key(item)}`); continue; }
    const note = match[0]!.note;
    if (note.velocity !== Math.round(Number(item.fields.velocity) * 127)) issues.push(`stable-velocity:${key(item)}`);
    if (!close(note.durationBeats, Number(item.fields.rawDuration))) issues.push(`stable-duration:${key(item)}`);
    for (const field of ['isChanceEnabled', 'isMuted', 'isOccurrenceEnabled', 'isRecurrenceEnabled', 'isRepeatEnabled'] as const) {
      if (note[field] !== undefined && note[field] !== item.fields[field]) issues.push(`stable-${field}:${key(item)}`);
    }
  }
  return issues;
}

export function snapshotOf(value: Wire, health: 'complete' | 'partial'): ShadowSnapshot {
  return shadowSnapshotFromWire(value.diagnosticSnapshot as ShadowCacheWireSnapshot, health, ['portableRepeat']);
}
export function dependencyOf(snapshot: ShadowSnapshot): ShadowDependency {
  return { logicalClipId: snapshot.logicalClipId, projectGeneration: snapshot.window.projectGeneration,
    contentGeneration: snapshot.window.contentGeneration, fingerprint: snapshot.fingerprint };
}

/**
 * The live label decides the actual route. The adapter keeps `eligible:false`, so a live
 * consumer always takes exact fallback, or refuses when authority is unavailable.
 */
export function liveDecision(value: Wire, workflow: 'read-only' | 'sparse-patch', authorityAvailable = true): ShadowConsumerResult {
  assert.equal(value.eligible, false); assert.equal(value.complete, false);
  const snapshot = snapshotOf(value, 'partial');
  return assessShadowConsumer(snapshot, { workflow, currentWindow: snapshot.window, fields: ['velocity'], authorityAvailable,
    base: workflow === 'sparse-patch' ? dependencyOf(snapshot) : undefined });
}

/**
 * Pure decision controls. They label a live snapshot complete to reach each branch.
 * They are not a live eligibility result and grant no write authority.
 */
export function pureControls(earlier: Wire, later: Wire): Record<string, ShadowConsumerResult> {
  const old = snapshotOf(earlier, 'complete'), now = snapshotOf(later, 'complete');
  const common = { currentWindow: now.window, fields: ['velocity'], authorityAvailable: true };
  const current = dependencyOf(now), stale = dependencyOf(old);
  return {
    readOnly: assessShadowConsumer(now, { ...common, workflow: 'read-only' }),
    sparsePatch: assessShadowConsumer(now, { ...common, workflow: 'sparse-patch', base: current, overlay: current }),
    fieldOnlyKnown: assessShadowConsumer(now, { ...common, workflow: 'read-only', fields: ['velocity', 'pan', 'chance', 'isChanceEnabled'] }),
    partialFields: assessShadowConsumer(now, { ...common, workflow: 'read-only', fields: ['portableRepeat'] }),
    partialCoverage: assessShadowConsumer(now, { ...common, workflow: 'read-only', onsetSpan: { startCell: 0, endCell: WIDTH + 1 } }),
    unavailable: assessShadowConsumer(now, { ...common, workflow: 'read-only', fields: ['portableRepeat'], authorityAvailable: false }),
    staleGeneration: assessShadowConsumer(old, { ...common, workflow: 'read-only' }),
    staleInterpretation: assessShadowConsumer(now, { ...common, workflow: 'read-only', overlay: stale }),
    staleBase: assessShadowConsumer(now, { ...common, workflow: 'sparse-patch', base: stale, overlay: stale }),
  };
}
export const PURE_EXPECTED: Readonly<Record<string, ShadowConsumerResult>> = {
  readOnly: { mode: 'shadow-observation', reason: 'current', overlayCurrent: true },
  sparsePatch: { mode: 'shadow-preparation-only', reason: 'current', overlayCurrent: true },
  fieldOnlyKnown: { mode: 'shadow-observation', reason: 'current', overlayCurrent: true },
  partialFields: { mode: 'exact-fallback', reason: 'partial-fields', overlayCurrent: false },
  partialCoverage: { mode: 'exact-fallback', reason: 'partial-coverage', overlayCurrent: false },
  unavailable: { mode: 'refuse', reason: 'authority-unavailable', overlayCurrent: false },
  staleGeneration: { mode: 'exact-fallback', reason: 'stale-generation', overlayCurrent: false },
  staleInterpretation: { mode: 'shadow-observation', reason: 'current', overlayCurrent: false },
  staleBase: { mode: 'refuse', reason: 'base-conflict', overlayCurrent: false },
};
export const LIVE_EXPECTED: ShadowConsumerResult = { mode: 'exact-fallback', reason: 'unhealthy', overlayCurrent: false };

/**
 * Evaluate the live predicates together. Each value comes from the adapter output.
 * A matching comparison and an admitted budget cannot replace identity or lifecycle proof.
 */
export function liveAdmission(value: Wire, info: Wire, pingP95Ms: number): ReturnType<typeof assessShadowAdmission> {
  const accounting = (value.resourceAccounting ?? info.resourceAccounting) as Wire | undefined;
  const estimatedBytes = Number(accounting?.totalEstimatedBytes);
  assert(Number.isSafeInteger(estimatedBytes) && estimatedBytes >= 0, 'combined estimate unavailable');
  return assessShadowAdmission({
    policy: { viewSteps: WIDTH, activeObservers: Number(info.totalExperimentalStepDataObservers),
      occupiedCoordinates: (value.diagnosticSnapshot as ShadowCacheWireSnapshot).notes.length,
      pendingDirtyCoordinates: Number(info.physicalPendingHints), estimatedBytes,
      cacheConstructionMs: Number(info.cacheBankConstructionMs ?? 0), replayMs: 0, rebuildMs: 0, pingP95Ms,
      generationValid: true, replayComplete: info.canaryPassed === true, authorityAvailable: value.authorityAvailable === true },
    health: 'partial',
    eligibility: { identityVerified: info.identityContinuityProved === true, lifecycleVerified: info.lifecycleSignalsSupported === true,
      bindingCurrent: true, membershipComplete: true, fieldsComplete: true, populatedCanaryPassed: info.canaryPassed === true,
      targetSettled: true, windowUnchanged: value.stepWindowConfirmed === true, noStructuralEvent: true,
      noEventGap: info.hostInputFenceProved === true },
    comparison: value.comparison === 'match' ? 'match' : 'not-run',
  });
}

const COUNTERS = ['membershipGetStepCalls', 'authorityGetStepCalls', 'enrichmentGetStepCalls',
  'membershipHostWorkMs', 'authorityHostWorkMs', 'enrichmentHostWorkMs'] as const;
/** Host work for one case. Avoided reads are what a promoted cache read would skip relative to the exact scan. */
export function hostWork(before: Wire, after: Wire): Wire {
  const delta: Wire = {};
  for (const field of COUNTERS) {
    const value = Number(after[field]) - Number(before[field]);
    assert(Number.isFinite(value) && value >= 0, `invalid counter ${field}`); delta[field] = value;
  }
  delta.avoidedHostReadsIfPromoted = Number(delta.authorityGetStepCalls)
    - Number(delta.membershipGetStepCalls) - Number(delta.enrichmentGetStepCalls);
  return delta;
}

/** Recompute every case result from retained raw reads, declarations, and outputs. */
export function verifyConsumerReport(report: Wire): Wire {
  assert.equal(report.schema, CONSUMER_SCHEMA); assert.equal(report.researchOnly, true);
  assert.equal(report.complete, false); assert.equal(report.eligible, false); assert.equal(report.stableWriteAuthorityGranted, false);
  assert.notEqual(report.project, PROTECTED_PROJECT); assert.equal(report.marker, FINAL_MARKER);
  const hello = report.hello as Wire;
  assert.equal(hello.runtimeProfile, 'phase-8-probe-v1'); assert.equal(hello.methodCount, 97); assert.equal(hello.methodsHash, 'f03f19414f40e3d3');
  const address = { trackId: report.trackId, row: TARGET_ROW };
  const fixture = report.fixture as Wire;
  assert.deepEqual(declaredIssues(fixture.raw as Wire, TARGET_FIXTURE), [], 'target declaration');
  assert.deepEqual(declaredIssues(fixture.canaryRaw as Wire, CANARY_FIXTURE), [], 'canary declaration');
  let expected: ShadowNote[] = independentNotes(fixture.raw as Wire);
  const cases = report.cases as Wire[]; assert(Array.isArray(cases));
  const labels = cases.map(row => row.label);
  const required = ['cold-read-only', 'warm-read-only', 'public-patch', 'field-only', 'native-delete', 'native-reacquire',
    'unhealthy-window', 'unhealthy-exact', 'restored-fallback-write', 'unavailable-authority'];
  assert.deepEqual(labels, required, 'case order');
  const summary: Wire = { matches: 0, exactMatches: 0, refusals: 0, publicToolCalls: 0, staleProposalRefused: false, liveDecisions: 0 };
  let earlier: Wire | undefined, latest: Wire | undefined;
  for (const row of cases) {
    // The stable source in a patch case is the observation before its change.
    if (row.stableSource) assert.deepEqual(stableSourceIssues(row.stableSource as Wire, expected), [], `${String(row.label)} stable source`);
    if (row.change) {
      const change = row.change as Change;
      if (change.kind === 'add') {
        // A new note takes undeclared defaults from the independent raw read after its write.
        const raw = independentNotes(row.raw as Wire).find(note => note.channel === change.note.channel
          && note.cell === change.note.cell && note.pitch === change.note.pitch);
        assert(raw, 'added note absent from raw read');
        assert(close(raw.fields.velocity, Number(change.note.fields.velocity)) && close(raw.fields.rawDuration, Number(change.note.fields.rawDuration)), 'added note declaration');
        expected = applyChange(expected, { kind: 'add', note: raw });
      } else expected = applyChange(expected, change);
    }
    if (row.writerEffects) {
      // The independent raw read after a stable write becomes the new base. Only legacy effects can differ.
      const effects = writerEffects(expected, row.raw as Wire);
      assert.deepEqual(effects.issues, [], `${String(row.label)} writer effects`); assert.deepEqual(effects.effects, row.writerEffects);
      summary.stableWriterEffects = effects.effects;
      expected = independentNotes(row.raw as Wire);
    }
    const label = String(row.label);
    if (row.comparison) {
      const comparison = row.comparison as Wire;
      if (label === 'unhealthy-window') {
        assert.deepEqual(refusalIssues(comparison, row.allowedReasons as string[]), [], label);
        summary.refusals = Number(summary.refusals) + 1;
      } else {
        assert.deepEqual(caseIssues(comparison, row.raw as Wire, row.rawMetadata as Wire, expected, address, TARGET_NAME), [], label);
        summary.matches = Number(summary.matches) + 1;
        const decision = liveDecision(comparison, row.workflow === 'sparse-patch' ? 'sparse-patch' : 'read-only');
        assert.deepEqual(decision, LIVE_EXPECTED, `${label} live decision`); assert.deepEqual(row.liveDecision, decision);
        summary.liveDecisions = Number(summary.liveDecisions) + 1;
        const admission = row.admission as Wire;
        assert.equal(admission.eligible, false); assert.equal(admission.complete, false);
        earlier = latest; latest = comparison;
      }
    }
    if (row.retainedAfterChange) assert.equal((row.retainedAfterChange as Wire).historicalSnapshot, undefined, `${label} retained output survived`);
    if (row.exact) { assert.deepEqual(exactIssues(row.exact as Wire, expected, address), [], label); summary.exactMatches = Number(summary.exactMatches) + 1; }
    if (row.exactRefusals) for (const value of row.exactRefusals as Wire[]) {
      assert.deepEqual(refusalIssues(value, ['authority-coverage-unavailable']), [], label);
      assert.equal(value.authorityAvailable, false); assert.equal(value.readMode, 'refuse');
      summary.refusals = Number(summary.refusals) + 1;
    }
    if (row.publicToolCalls !== undefined) summary.publicToolCalls = Number(summary.publicToolCalls) + Number(row.publicToolCalls);
    if (row.staleApply) {
      const stale = row.staleApply as Wire; assert.notEqual(stale.applied, true, 'stale proposal applied');
      summary.staleProposalRefused = true;
    }
    if (row.hostWork) assert.deepEqual(hostWork(row.infoBefore as Wire, row.infoAfter as Wire), row.hostWork);
  }
  assert(earlier && latest);
  const controls = report.pureControls as Wire;
  assert.deepEqual(controls.decisions, pureControls(controls.earlier as Wire, controls.later as Wire));
  assert.deepEqual(controls.decisions, PURE_EXPECTED, 'pure decision controls');
  assert.equal(summary.staleProposalRefused, true);
  assert.equal((report.final as Wire).complete, false); assert.equal((report.final as Wire).eligible, false);
  return { ...summary, pureControls: Object.keys(PURE_EXPECTED).length, complete: false, eligible: false };
}

export function rawNotesOf(raw: Wire): ShadowNote[] { return independentNotes(raw); }
export type { NormalizedValue };
