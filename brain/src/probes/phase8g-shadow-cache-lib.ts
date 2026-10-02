import { isDeepStrictEqual } from 'node:util';
import { binary64 } from '../document/rational.js';
import { evaluateCachePolicy, type CachePolicyDecision, type CachePolicyInput,
  type CachePolicyReason } from '../contract/cache-policy.js';

export type NormalizedValue = string | number | boolean | null;
export type FieldCoverage = 'known' | 'unknown' | 'unsupported';
export type ShadowHealth = 'complete' | 'warming' | 'rebuilding' | 'overflow'
  | 'invalid' | 'dirty' | 'repairing' | 'partial' | 'ambiguous';

export interface ShadowWindow {
  /** Older diagnostic artifacts do not contain the initialization domain. */
  readonly initDomain?: string;
  readonly projectGeneration: number;
  readonly structuralEpoch: number;
  readonly bindingGeneration: number;
  readonly rebuildGeneration: number;
  readonly contentGeneration: number;
  readonly invalidationSequence: number;
}

export interface ShadowCoverage {
  readonly startCell: number;
  readonly endCell: number;
  readonly allChannels: boolean;
  readonly membershipComplete: boolean;
  readonly timingBasis: '1/512';
  readonly fields: Readonly<Record<string, FieldCoverage>>;
}

export interface ShadowNote {
  readonly channel: number;
  readonly cell: number;
  readonly pitch: number;
  readonly fields: Readonly<Record<string, NormalizedValue>>;
}

export interface ShadowSnapshot {
  readonly logicalClipId: string;
  readonly address: { readonly channelId: string; readonly row: number };
  readonly window: ShadowWindow;
  readonly health: ShadowHealth;
  readonly metadata: Readonly<Record<string, NormalizedValue>>;
  readonly coverage: ShadowCoverage;
  readonly notes: readonly ShadowNote[];
  readonly fingerprint: string;
}

export interface D23Diagnostic {
  readonly sourceCollisions: number;
  readonly onsetDisplacements: number;
  readonly exactSourceOutcome: 'match' | 'different' | 'unavailable' | 'not-run';
}

export type ShadowMismatchCause = 'address-identity' | 'membership' | 'field'
  | 'stale-generation' | 'coverage' | 'metadata';

export interface ShadowComparison {
  readonly outcome: 'match' | 'mismatch' | 'window-changed';
  readonly mismatches: readonly { readonly cause: ShadowMismatchCause; readonly path: string }[];
  readonly d23: D23Diagnostic;
}

function nonnegative(value: unknown, integer: boolean): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    && (!integer || Number.isSafeInteger(value));
}

function checkWindow(window: ShadowWindow): void {
  if (window.initDomain !== undefined && (typeof window.initDomain !== 'string' || !window.initDomain)) {
    throw new Error('invalid shadow initialization domain');
  }
  for (const key of ['projectGeneration', 'structuralEpoch', 'bindingGeneration',
    'rebuildGeneration', 'contentGeneration', 'invalidationSequence'] as const) {
    if (!nonnegative(window[key], true)) throw new Error('invalid shadow window');
  }
}

function checkValues(values: Readonly<Record<string, NormalizedValue>>): void {
  for (const value of Object.values(values)) {
    if (value === null || typeof value === 'boolean' || typeof value === 'string') continue;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error('invalid normalized shadow value');
    }
  }
}

function noteKey(note: ShadowNote): string {
  return `${note.channel}:${note.cell}:${note.pitch}`;
}

function checkSnapshot(snapshot: ShadowSnapshot): void {
  checkWindow(snapshot.window);
  const coverage = snapshot.coverage;
  if (!snapshot.logicalClipId || !snapshot.address.channelId
    || !nonnegative(snapshot.address.row, true)
    || !nonnegative(coverage.startCell, true) || !nonnegative(coverage.endCell, true)
    || coverage.endCell < coverage.startCell || coverage.timingBasis !== '1/512'
    || typeof coverage.allChannels !== 'boolean'
    || typeof coverage.membershipComplete !== 'boolean') {
    throw new Error('invalid shadow identity or coverage');
  }
  for (const value of Object.values(coverage.fields)) {
    if (!['known', 'unknown', 'unsupported'].includes(value)) {
      throw new Error('invalid shadow field coverage');
    }
  }
  checkValues(snapshot.metadata);
  const keys = new Set<string>();
  for (const note of snapshot.notes) {
    if (!nonnegative(note.channel, true) || note.channel > 15
      || !nonnegative(note.pitch, true) || note.pitch > 127
      || !nonnegative(note.cell, true)
      || note.cell < coverage.startCell || note.cell >= coverage.endCell) {
      throw new Error('invalid normalized note address');
    }
    const key = noteKey(note);
    if (keys.has(key)) throw new Error('duplicate normalized note address');
    keys.add(key);
    checkValues(note.fields);
    for (const [field, status] of Object.entries(coverage.fields)) {
      if (status === 'known' && (!Object.hasOwn(note.fields, field) || note.fields[field] === null)) {
        throw new Error('known shadow field is missing');
      }
    }
    if (Object.hasOwn(note.fields, 'durationCells')) {
      const { durationCells, duration, rawDuration } = note.fields;
      if (!nonnegative(durationCells, true) || durationCells < 1
        || typeof duration !== 'number' || typeof rawDuration !== 'number'
        || !Number.isFinite(rawDuration) || rawDuration <= 0) {
        throw new Error('invalid normalized shadow duration');
      }
      const raw = binary64(rawDuration);
      const rounded = (raw.n * 1024n + raw.d) / (raw.d * 2n);
      const expected = rounded < 1n ? 1n : rounded;
      if (BigInt(durationCells) !== expected
        || duration !== durationCells / 512) {
        throw new Error('invalid normalized shadow duration');
      }
    }
  }
}

/** Compare acquired domain values within one unchanged authority window. */
export function compareShadowSnapshots(
  cache: ShadowSnapshot,
  authority: ShadowSnapshot,
  window: { readonly before: ShadowWindow; readonly after: ShadowWindow },
  d23: D23Diagnostic = {
    sourceCollisions: 0, onsetDisplacements: 0, exactSourceOutcome: 'not-run',
  },
): ShadowComparison {
  checkWindow(window.before);
  checkWindow(window.after);
  if (!nonnegative(d23.sourceCollisions, true) || !nonnegative(d23.onsetDisplacements, true)) {
    throw new Error('invalid D23 diagnostic');
  }
  if (!isDeepStrictEqual(window.before, window.after)) {
    return { outcome: 'window-changed', mismatches: [], d23 };
  }
  checkSnapshot(cache);
  checkSnapshot(authority);
  const mismatches: { cause: ShadowMismatchCause; path: string }[] = [];
  const add = (cause: ShadowMismatchCause, path: string): void => {
    mismatches.push({ cause, path });
  };
  if (!isDeepStrictEqual(cache.window, window.before)
    || !isDeepStrictEqual(authority.window, window.before)) add('stale-generation', 'window');
  if (cache.logicalClipId !== authority.logicalClipId
    || !isDeepStrictEqual(cache.address, authority.address)) add('address-identity', 'identity');
  if (!isDeepStrictEqual(cache.metadata, authority.metadata)) add('metadata', 'metadata');
  if (cache.health !== 'complete' || authority.health !== 'complete'
    || !cache.coverage.membershipComplete || !authority.coverage.membershipComplete
    || !cache.coverage.allChannels || !authority.coverage.allChannels
    || !isDeepStrictEqual(cache.coverage, authority.coverage)) add('coverage', 'coverage');
  const cacheNotes = new Map(cache.notes.map((note) => [noteKey(note), note]));
  const authorityNotes = new Map(authority.notes.map((note) => [noteKey(note), note]));
  const keys = [...new Set([...cacheNotes.keys(), ...authorityNotes.keys()])].sort();
  for (const key of keys) {
    const cached = cacheNotes.get(key);
    const scanned = authorityNotes.get(key);
    if (cached === undefined || scanned === undefined) {
      add('membership', `notes.${key}`);
      continue;
    }
    for (const [field, status] of Object.entries(cache.coverage.fields).sort()) {
      if (status === 'known' && authority.coverage.fields[field] === 'known'
        && !isDeepStrictEqual(cached.fields[field], scanned.fields[field])) {
        add('field', `notes.${key}.${field}`);
      }
    }
  }
  return { outcome: mismatches.length === 0 ? 'match' : 'mismatch', mismatches, d23 };
}

export interface ShadowCacheWireSnapshot {
  readonly clipRef: string;
  readonly address: { readonly trackId: string; readonly row: number };
  readonly token: {
    readonly initDomain?: string;
    readonly project: number;
    readonly structure: number;
    readonly binding: number;
    readonly rebuild: number;
  };
  readonly contentGeneration: number;
  readonly invalidationSequence: number;
  readonly coverage: {
    readonly startCell: number;
    readonly width: number;
    readonly allChannels: boolean;
    readonly fields: readonly string[];
    readonly unsupportedFields: readonly string[];
    readonly timingBasis: '1/512-beat';
  };
  readonly metadata: ShadowSnapshot['metadata'];
  readonly notes: readonly ShadowNote[];
  readonly fingerprint: string;
}

/** Project the experimental wire snapshot into independent comparison types. */
export function shadowSnapshotFromWire(
  wire: ShadowCacheWireSnapshot,
  health: ShadowHealth,
  declaredFields: readonly string[] = [],
): ShadowSnapshot {
  if (wire.coverage.timingBasis !== '1/512-beat') throw new Error('invalid wire timing basis');
  const coverage: Record<string, FieldCoverage> = Object.fromEntries(
    declaredFields.map((field) => [field, 'unknown']),
  );
  for (const field of wire.coverage.unsupportedFields) coverage[field] = 'unsupported';
  for (const field of wire.coverage.fields) {
    if (coverage[field] === 'unsupported') throw new Error('conflicting wire field coverage');
    coverage[field] = 'known';
  }
  const result: ShadowSnapshot = {
    logicalClipId: wire.clipRef,
    address: { channelId: wire.address.trackId, row: wire.address.row },
    window: {
      ...(wire.token.initDomain === undefined ? {} : { initDomain: wire.token.initDomain }),
      projectGeneration: wire.token.project, structuralEpoch: wire.token.structure,
      bindingGeneration: wire.token.binding, rebuildGeneration: wire.token.rebuild,
      contentGeneration: wire.contentGeneration, invalidationSequence: wire.invalidationSequence,
    },
    health,
    metadata: structuredClone(wire.metadata),
    coverage: {
      startCell: wire.coverage.startCell, endCell: wire.coverage.startCell + wire.coverage.width,
      allChannels: wire.coverage.allChannels, membershipComplete: health === 'complete',
      timingBasis: '1/512', fields: coverage,
    },
    notes: structuredClone(wire.notes),
    fingerprint: wire.fingerprint,
  };
  checkSnapshot(result);
  Object.freeze(result.address);
  Object.freeze(result.window);
  Object.freeze(result.metadata);
  Object.freeze(result.coverage.fields);
  Object.freeze(result.coverage);
  for (const note of result.notes) {
    Object.freeze(note.fields);
    Object.freeze(note);
  }
  Object.freeze(result.notes);
  return Object.freeze(result);
}

export interface ShadowDependency {
  readonly logicalClipId: string;
  readonly projectGeneration: number;
  readonly contentGeneration: number;
  readonly fingerprint: string;
}

export interface ShadowConsumerResult {
  readonly mode: 'shadow-observation' | 'shadow-preparation-only' | 'exact-fallback' | 'refuse';
  readonly reason: 'current' | 'stale-generation' | 'partial-fields' | 'unhealthy'
    | 'partial-coverage' | 'base-conflict' | 'authority-unavailable';
  readonly overlayCurrent: boolean;
}

function dependencyCurrent(dependency: ShadowDependency, snapshot: ShadowSnapshot): boolean {
  return dependency.logicalClipId === snapshot.logicalClipId
    && dependency.projectGeneration === snapshot.window.projectGeneration
    && dependency.contentGeneration === snapshot.window.contentGeneration
    && dependency.fingerprint === snapshot.fingerprint;
}

/** Test consumer freshness without granting cache write authority. */
export function assessShadowConsumer(
  snapshot: ShadowSnapshot,
  request: {
    readonly workflow: 'read-only' | 'sparse-patch';
    readonly currentWindow: ShadowWindow;
    readonly fields: readonly string[];
    readonly onsetSpan?: { readonly startCell: number; readonly endCell: number };
    readonly authorityAvailable: boolean;
    readonly base?: ShadowDependency;
    readonly overlay?: ShadowDependency;
  },
): ShadowConsumerResult {
  checkSnapshot(snapshot);
  checkWindow(request.currentWindow);
  const overlayCurrent = request.overlay === undefined
    || dependencyCurrent(request.overlay, snapshot);
  const fallback = (reason: ShadowConsumerResult['reason']): ShadowConsumerResult => ({
    mode: request.authorityAvailable ? 'exact-fallback' : 'refuse',
    reason: request.authorityAvailable ? reason : 'authority-unavailable',
    overlayCurrent: false,
  });
  if (!isDeepStrictEqual(snapshot.window, request.currentWindow)) return fallback('stale-generation');
  if (snapshot.health !== 'complete'
    || !snapshot.coverage.membershipComplete || !snapshot.coverage.allChannels) {
    return fallback('unhealthy');
  }
  if (request.onsetSpan !== undefined) {
    const { startCell, endCell } = request.onsetSpan;
    if (!nonnegative(startCell, true) || !nonnegative(endCell, true) || startCell > endCell) {
      throw new Error('invalid requested onset span');
    }
    if (startCell < snapshot.coverage.startCell || endCell > snapshot.coverage.endCell) {
      return fallback('partial-coverage');
    }
  }
  if (request.fields.some((field) => snapshot.coverage.fields[field] !== 'known')) {
    return fallback('partial-fields');
  }
  if (request.workflow === 'sparse-patch'
    && (request.base === undefined || !dependencyCurrent(request.base, snapshot))) {
    return { mode: 'refuse', reason: 'base-conflict', overlayCurrent };
  }
  return {
    mode: request.workflow === 'read-only' ? 'shadow-observation' : 'shadow-preparation-only',
    reason: 'current', overlayCurrent,
  };
}

export interface ShadowEligibility {
  readonly identityVerified: boolean;
  readonly lifecycleVerified: boolean;
  readonly bindingCurrent: boolean;
  readonly membershipComplete: boolean;
  readonly fieldsComplete: boolean;
  readonly populatedCanaryPassed: boolean;
  readonly targetSettled: boolean;
  readonly windowUnchanged: boolean;
  readonly noStructuralEvent: boolean;
  readonly noEventGap: boolean;
}

export interface ShadowAdmissionInput {
  readonly policy: CachePolicyInput;
  readonly health: ShadowHealth;
  readonly eligibility: ShadowEligibility;
  readonly comparison: 'match' | 'mismatch' | 'window-changed' | 'not-run';
}

type ShadowAdmissionReason = CachePolicyReason | 'identity-unverified' | 'lifecycle-unverified'
  | 'binding-invalid' | 'membership-incomplete' | 'fields-incomplete' | 'canary-unproved'
  | 'target-unsettled' | 'window-changed' | 'structural-event-pending' | 'event-gap'
  | 'dirty-coordinates' | 'unhealthy' | 'comparison-unproved' | 'shadow-mismatch';

export interface ShadowAdmission {
  readonly eligible: boolean;
  readonly complete: boolean;
  readonly health: ShadowHealth;
  readonly mode: CachePolicyDecision['mode'];
  readonly reason: ShadowAdmissionReason;
  readonly budgetAdmitted: boolean;
  readonly policyDecision: CachePolicyDecision;
}

const POLICY_COUNTERS = ['viewSteps', 'activeObservers', 'occupiedCoordinates',
  'pendingDirtyCoordinates', 'estimatedBytes'] as const;
const POLICY_TIMES = ['cacheConstructionMs', 'replayMs', 'rebuildMs', 'pingP95Ms'] as const;
const ELIGIBILITY_KEYS = ['identityVerified', 'lifecycleVerified', 'bindingCurrent',
  'membershipComplete', 'fieldsComplete', 'populatedCanaryPassed', 'targetSettled',
  'windowUnchanged', 'noStructuralEvent', 'noEventGap'] as const;
const SHADOW_HEALTH = ['complete', 'warming', 'rebuilding', 'overflow', 'invalid',
  'dirty', 'repairing', 'partial', 'ambiguous'] as const;

/** Select an experimental read route. A fallback decision does not acquire authority. */
export function assessShadowAdmission(input: ShadowAdmissionInput): ShadowAdmission {
  const { policy, eligibility, health, comparison } = input;
  for (const key of POLICY_COUNTERS) {
    if (!nonnegative(policy[key], true)) throw new Error(`invalid shadow admission measurement: ${key}`);
  }
  for (const key of POLICY_TIMES) {
    if (!nonnegative(policy[key], false)) throw new Error(`invalid shadow admission measurement: ${key}`);
  }
  for (const key of ['generationValid', 'replayComplete', 'authorityAvailable'] as const) {
    if (typeof policy[key] !== 'boolean') throw new Error(`invalid shadow admission predicate: ${key}`);
  }
  for (const key of ELIGIBILITY_KEYS) {
    if (typeof eligibility[key] !== 'boolean') throw new Error(`invalid shadow eligibility predicate: ${key}`);
  }
  if (!SHADOW_HEALTH.includes(health) || !['match', 'mismatch', 'window-changed', 'not-run'].includes(comparison)) {
    throw new Error('invalid shadow admission state');
  }
  let blocked: ShadowAdmissionReason | undefined;
  let blockedHealth: ShadowHealth = health;
  const gates: readonly [boolean, ShadowAdmissionReason, ShadowHealth][] = [
    [eligibility.lifecycleVerified, 'lifecycle-unverified', 'invalid'],
    [eligibility.identityVerified, 'identity-unverified', 'invalid'],
    [eligibility.bindingCurrent, 'binding-invalid', 'invalid'],
    [eligibility.noEventGap, 'event-gap', 'invalid'],
    [eligibility.windowUnchanged && comparison !== 'window-changed', 'window-changed', 'dirty'],
    [eligibility.noStructuralEvent, 'structural-event-pending', 'repairing'],
    [health === 'complete', 'unhealthy', health],
    [eligibility.membershipComplete, 'membership-incomplete', 'partial'],
    [eligibility.fieldsComplete, 'fields-incomplete', 'partial'],
    [eligibility.populatedCanaryPassed, 'canary-unproved', 'warming'],
    [eligibility.targetSettled, 'target-unsettled', 'warming'],
    [policy.pendingDirtyCoordinates === 0, 'dirty-coordinates', 'dirty'],
    [comparison !== 'mismatch', 'shadow-mismatch', 'invalid'],
    [comparison === 'match', 'comparison-unproved', 'partial'],
  ];
  for (const [passes, reason, state] of gates) {
    if (!passes) { blocked = reason; blockedHealth = state; break; }
  }
  const budgetDecision = evaluateCachePolicy(policy);
  const budgetAdmitted = budgetDecision.mode === 'cache';
  // Apply completeness before the evaluator can select a cache read.
  const completeDecision = evaluateCachePolicy({ ...policy,
    generationValid: policy.generationValid && !['invalid', 'overflow', 'ambiguous'].includes(blockedHealth),
    replayComplete: policy.replayComplete && blocked === undefined,
  });
  const policyDecision = budgetAdmitted ? completeDecision : budgetDecision;
  const eligible = blocked === undefined && policyDecision.mode === 'cache';
  return {
    eligible, complete: eligible,
    health: eligible ? 'complete' : !budgetAdmitted || blocked === undefined ? policyDecision.health : blockedHealth,
    mode: policyDecision.mode,
    reason: !eligible && !policy.authorityAvailable ? 'authority-unavailable'
      : !budgetAdmitted ? policyDecision.reason : blocked ?? policyDecision.reason,
    budgetAdmitted, policyDecision,
  };
}

export interface ShadowResourceMeasurements {
  readonly activeObservers: number;
  readonly occupiedCoordinates: number;
  readonly pendingCoordinates: number;
  readonly rejectedCallbacks: number;
  readonly recorderEstimatedBytes: number;
  readonly enrichedPayloadBytes: number;
  readonly snapshotRetainedBytes: number;
  readonly explicitHostObjects: number;
  readonly extensionObjects: number;
  readonly cacheConstructionMs: number;
  readonly replayMs: number;
  readonly rebuildMs: number;
  readonly pingP95Ms: number;
  readonly authorityScanMs: number;
  readonly enrichmentMs: number;
  readonly avoidedHostReads: number;
  readonly responseBytes: number;
  readonly toolCalls: number;
  readonly agentVisibleDelayMs: number;
}

const TIME_MEASUREMENTS = new Set([
  'cacheConstructionMs', 'replayMs', 'rebuildMs', 'pingP95Ms', 'authorityScanMs',
  'enrichmentMs', 'agentVisibleDelayMs',
]);
const RESOURCE_KEYS = [
  'activeObservers', 'occupiedCoordinates', 'pendingCoordinates', 'rejectedCallbacks',
  'recorderEstimatedBytes', 'enrichedPayloadBytes', 'snapshotRetainedBytes',
  'explicitHostObjects', 'extensionObjects', 'cacheConstructionMs', 'replayMs',
  'rebuildMs', 'pingP95Ms', 'authorityScanMs', 'enrichmentMs', 'avoidedHostReads',
  'responseBytes', 'toolCalls', 'agentVisibleDelayMs',
] as const;

/** Validate extension-owned measurements without treating sparse bytes as total memory. */
export function validateShadowResourceMeasurements(value: unknown): ShadowResourceMeasurements {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('invalid shadow resource measurements');
  }
  const record = value as Record<string, unknown>;
  for (const key of RESOURCE_KEYS) {
    if (!nonnegative(record[key], !TIME_MEASUREMENTS.has(key))) {
      throw new Error(`invalid shadow resource measurement: ${key}`);
    }
  }
  return Object.fromEntries(RESOURCE_KEYS.map((key) => [key, record[key]])) as unknown as ShadowResourceMeasurements;
}
