import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assessShadowConsumer,
  assessShadowAdmission,
  compareShadowSnapshots,
  shadowSnapshotFromWire,
  validateShadowResourceMeasurements,
  type ShadowNote,
  type ShadowCacheWireSnapshot,
  type ShadowResourceMeasurements,
  type ShadowSnapshot,
  type ShadowAdmissionInput,
} from './phase8g-shadow-cache-lib.js';
import { CACHE_SCALE_LIMITS, evaluateCachePolicy } from './phase8e-cache-policy.js';

const snapshot: ShadowSnapshot = {
  logicalClipId: 'clip-1',
  address: { channelId: 'track-1', row: 2 },
  window: {
    projectGeneration: 1, structuralEpoch: 2, bindingGeneration: 3,
    rebuildGeneration: 4, contentGeneration: 5, invalidationSequence: 6,
  },
  health: 'complete',
  metadata: { exists: true, name: 'Shadow', length: 4 },
  coverage: {
    startCell: 0, endCell: 131_072, allChannels: true, membershipComplete: true,
    timingBasis: '1/512',
    fields: { velocity: 'known', duration: 'known', chance: 'known', chanceEnabled: 'known',
      timbre: 'known', pressure: 'unsupported', repeat: 'unknown' },
  },
  notes: [{ channel: 0, cell: 0, pitch: 60,
    fields: { velocity: 0.5, duration: 0.25, chance: 0.2, chanceEnabled: false, timbre: -0.75 } }],
  fingerprint: 'cache-v1:one',
};

const sameWindow = { before: snapshot.window, after: snapshot.window };
const dependency = {
  logicalClipId: snapshot.logicalClipId,
  projectGeneration: snapshot.window.projectGeneration,
  contentGeneration: snapshot.window.contentGeneration,
  fingerprint: snapshot.fingerprint,
};
const readRequest = {
  workflow: 'read-only', currentWindow: snapshot.window, fields: ['velocity'],
  authorityAvailable: true,
} as const;

function fields(fields: ShadowNote['fields']): ShadowSnapshot {
  return { ...snapshot, notes: [{ ...snapshot.notes[0]!, fields }] };
}

describe('8g independent normalized shadow comparison', () => {
  it('compares typed values even when digests claim equality', () => {
    const result = compareShadowSnapshots(snapshot,
      fields({ ...snapshot.notes[0]!.fields, velocity: 0.6 }), sameWindow);
    assert.equal(result.outcome, 'mismatch');
    assert.deepEqual(result.mismatches, [{ cause: 'field', path: 'notes.0:0:60.velocity' }]);
  });

  it('does not compare digests from different implementations', () => {
    assert.equal(compareShadowSnapshots(snapshot,
      { ...snapshot, fingerprint: 'independent-v1:other' }, sameWindow).outcome, 'match');
  });

  it('compares all channels and ignores collection ordering', () => {
    const notes = Array.from({ length: 16 }, (_, channel) => ({ ...snapshot.notes[0]!, channel }));
    const cache = { ...snapshot, notes };
    assert.equal(compareShadowSnapshots(cache,
      { ...cache, notes: [...notes].reverse() }, sameWindow).outcome, 'match');
    const result = compareShadowSnapshots(cache, { ...cache, notes: notes.slice(0, 15) }, sameWindow);
    assert.deepEqual(result.mismatches, [{ cause: 'membership', path: 'notes.15:0:60' }]);
  });

  it('compares disabled raw values and signed timbre', () => {
    const changes: ShadowNote['fields'][] = [{ chance: 0.9 }, { timbre: 0.75 }];
    for (const changed of changes) {
      assert.equal(compareShadowSnapshots(snapshot,
        fields({ ...snapshot.notes[0]!.fields, ...changed }), sameWindow).outcome, 'mismatch');
    }
  });

  it('compares metadata and distinguishes an empty clip from an absent slot', () => {
    const empty = { ...snapshot, notes: [] };
    assert.equal(compareShadowSnapshots(empty, empty, sameWindow).outcome, 'match');
    const absent = { ...empty, metadata: { ...empty.metadata, exists: false } };
    assert.deepEqual(compareShadowSnapshots(empty, absent, sameWindow).mismatches,
      [{ cause: 'metadata', path: 'metadata' }]);
  });

  it('includes the final covered cell and all channel membership', () => {
    const boundary = { ...snapshot, notes: [{ ...snapshot.notes[0]!, cell: 131_071, channel: 15 }] };
    assert.equal(compareShadowSnapshots(boundary, boundary, sameWindow).outcome, 'match');
  });

  it('separates coverage from address and identity mismatches', () => {
    const changed = {
      ...snapshot, logicalClipId: 'clip-2', address: { channelId: 'track-2', row: 3 },
      coverage: { ...snapshot.coverage, endCell: 512 },
    };
    assert.deepEqual(compareShadowSnapshots(snapshot, changed, sameWindow).mismatches.map((m) => m.cause),
      ['address-identity', 'coverage']);
  });

  it('retains unknown fields without inventing values', () => {
    const noUnknown = { ...snapshot.coverage.fields, repeat: 'known' as const };
    assert.throws(() => compareShadowSnapshots(snapshot,
      { ...snapshot, coverage: { ...snapshot.coverage, fields: noUnknown } }, sameWindow),
    /known shadow field is missing/);
    assert.equal(compareShadowSnapshots(snapshot, snapshot, sameWindow).outcome, 'match');
    assert.throws(() => compareShadowSnapshots(
      fields({ ...snapshot.notes[0]!.fields, velocity: null }), snapshot, sameWindow),
    /known shadow field is missing/);
  });

  it('rejects partial membership and unhealthy snapshots as passing comparisons', () => {
    for (const health of ['warming', 'rebuilding', 'overflow', 'invalid', 'dirty',
      'repairing', 'partial', 'ambiguous'] as const) {
      assert.equal(compareShadowSnapshots({ ...snapshot, health }, snapshot, sameWindow).outcome,
        'mismatch');
    }
    for (const coverage of [{ membershipComplete: false }, { allChannels: false }]) {
      assert.equal(compareShadowSnapshots({ ...snapshot, coverage: { ...snapshot.coverage, ...coverage } },
        snapshot, sameWindow).outcome, 'mismatch');
    }
  });

  it('reports a changed acquisition window as a retry without a match', () => {
    for (const key of ['projectGeneration', 'structuralEpoch', 'bindingGeneration',
      'rebuildGeneration', 'contentGeneration', 'invalidationSequence'] as const) {
      const result = compareShadowSnapshots(snapshot, snapshot, {
        before: snapshot.window, after: { ...snapshot.window, [key]: snapshot.window[key] + 1 },
      });
      assert.equal(result.outcome, 'window-changed');
      assert.deepEqual(result.mismatches, []);
    }
  });

  it('detects a historical snapshot in an unchanged new window', () => {
    const freshWindow = { ...snapshot.window, projectGeneration: 2 };
    assert.deepEqual(compareShadowSnapshots(snapshot, { ...snapshot, window: freshWindow },
      { before: freshWindow, after: freshWindow }).mismatches,
    [{ cause: 'stale-generation', path: 'window' }]);
  });

  it('keeps D23 source loss separate from implementation mismatches', () => {
    const d23 = { sourceCollisions: 1, onsetDisplacements: 2, exactSourceOutcome: 'different' } as const;
    const result = compareShadowSnapshots(snapshot, snapshot, sameWindow, d23);
    assert.equal(result.outcome, 'match');
    assert.deepEqual(result.mismatches, []);
    assert.deepEqual(result.d23, d23);
  });

  it('rejects out-of-span cells, bad MIDI addresses, duplicate notes and nonfinite values', () => {
    for (const changed of [{ cell: 131_072 }, { channel: 16 }, { pitch: 128 }, { cell: -1 }]) {
      const invalid = { ...snapshot, notes: [{ ...snapshot.notes[0]!, ...changed }] };
      assert.throws(() => compareShadowSnapshots(invalid, snapshot, sameWindow), /note address/);
    }
    assert.throws(() => compareShadowSnapshots(
      { ...snapshot, notes: [snapshot.notes[0]!, snapshot.notes[0]!] }, snapshot, sameWindow),
    /duplicate normalized/);
    assert.throws(() => compareShadowSnapshots(fields({ ...snapshot.notes[0]!.fields, timbre: NaN }),
      snapshot, sameWindow), /invalid normalized/);
  });
});

const wire: ShadowCacheWireSnapshot = {
  clipRef: snapshot.logicalClipId,
  address: { trackId: snapshot.address.channelId, row: snapshot.address.row },
  token: { project: 1, structure: 2, binding: 3, rebuild: 4 },
  contentGeneration: 5, invalidationSequence: 6,
  coverage: { startCell: 0, width: 131_072, allChannels: true,
    fields: ['velocity', 'duration', 'chance', 'chanceEnabled', 'timbre'],
    unsupportedFields: ['pressure'], timingBasis: '1/512-beat' },
  metadata: snapshot.metadata, notes: snapshot.notes, fingerprint: snapshot.fingerprint,
};

describe('8g experimental wire projection', () => {
  it('retains initialization domains and rejects equal counters from another controller', () => {
    const before = shadowSnapshotFromWire({ ...wire, token: { ...wire.token, initDomain: 'controller-A' } }, 'complete');
    const after = shadowSnapshotFromWire({ ...wire, token: { ...wire.token, initDomain: 'controller-B' } }, 'complete');
    assert.equal(before.window.initDomain, 'controller-A');
    assert.equal(compareShadowSnapshots(before, after, { before: before.window, after: after.window }).outcome, 'window-changed');
    assert.equal(compareShadowSnapshots(before, after, { before: after.window, after: after.window }).outcome, 'mismatch');
    assert.equal(assessShadowConsumer(before, { ...readRequest, currentWindow: after.window }).mode, 'exact-fallback');
    assert.throws(() => shadowSnapshotFromWire({ ...wire, token: { ...wire.token, initDomain: '' } }, 'complete'),
      /invalid shadow initialization domain/);
  });
  it('projects tokens, spans and declared unknown fields without raw-unit changes', () => {
    const converted = shadowSnapshotFromWire(wire, 'complete', ['repeat']);
    assert.deepEqual(converted, snapshot);
  });

  it('does not share mutable note or metadata references with the source', () => {
    const converted = shadowSnapshotFromWire(wire, 'complete');
    assert.notEqual(converted.metadata, wire.metadata);
    assert.notEqual(converted.notes, wire.notes);
    assert.notEqual(converted.notes[0]!.fields, wire.notes[0]!.fields);
  });

  it('freezes all retained values so a historical observation cannot change', () => {
    const converted = shadowSnapshotFromWire(wire, 'complete');
    for (const value of [converted, converted.window, converted.address, converted.metadata,
      converted.coverage, converted.coverage.fields, converted.notes, converted.notes[0],
      converted.notes[0]!.fields]) {
      assert.equal(Object.isFrozen(value), true);
    }
    assert.throws(() => Object.assign(converted.notes[0]!.fields, { velocity: 0.9 }), TypeError);
    assert.equal(converted.notes[0]!.fields.velocity, 0.5);
  });

  it('retains acquired pressure and raw disabled controls with their host units', () => {
    const acquired = {
      pressure: 0.3, timbre: 0.125, rawTimbre: -0.75, chance: 0.2, isChanceEnabled: false,
      isRecurrenceEnabled: false, recurrenceLength: 7, recurrenceMask: 85,
      isRepeatEnabled: false, repeatCount: -3, repeatVelocityEnd: -0.4,
    };
    const rawWire = { ...wire, coverage: { ...wire.coverage,
      fields: Object.keys(acquired), unsupportedFields: ['portableRepeat', 'articulation'] },
    notes: [{ ...wire.notes[0]!, fields: acquired }] };
    const converted = shadowSnapshotFromWire(rawWire, 'complete');
    assert.deepEqual(converted.notes[0]!.fields, acquired);
    assert.equal(converted.coverage.fields.pressure, 'known');
    assert.equal(converted.coverage.fields.portableRepeat, 'unsupported');
    assert.equal(assessShadowConsumer(converted, { ...readRequest, fields: ['pressure'] }).mode,
      'shadow-observation');
  });

  it('validates R07 duration ties, minimum promotion and adjacent binary64 values', () => {
    const cases = [
      { rawDuration: Number.MIN_VALUE, durationCells: 1 },
      { rawDuration: 1 / 2048, durationCells: 1 },
      { rawDuration: 1 / 1024, durationCells: 1 },
      { rawDuration: 3 / 1024 - Number.EPSILON / 512, durationCells: 1 },
      { rawDuration: 3 / 1024, durationCells: 2 },
      { rawDuration: 3 / 1024 + Number.EPSILON / 512, durationCells: 2 },
      { rawDuration: 0.1, durationCells: 51 },
      { rawDuration: 256, durationCells: 131_072 },
    ];
    for (const values of cases) {
      const noteFields = { ...values, duration: values.durationCells / 512 };
      const timedWire = { ...wire, coverage: { ...wire.coverage,
        fields: Object.keys(noteFields), unsupportedFields: [] },
      notes: [{ ...wire.notes[0]!, fields: noteFields }] };
      assert.deepEqual(shadowSnapshotFromWire(timedWire, 'complete').notes[0]!.fields, noteFields);
      assert.throws(() => shadowSnapshotFromWire({ ...timedWire,
        notes: [{ ...timedWire.notes[0]!, fields: { ...noteFields,
          durationCells: values.durationCells + 1, duration: (values.durationCells + 1) / 512 } }] },
      'complete'), /invalid normalized shadow duration/);
    }
  });

  it('does not mark rebuilding wire coverage complete', () => {
    const converted = shadowSnapshotFromWire(wire, 'rebuilding');
    assert.equal(converted.coverage.membershipComplete, false);
    assert.equal(assessShadowConsumer(converted, readRequest).reason, 'unhealthy');
  });

  it('rejects conflicting known and unsupported fields and invalid token counters', () => {
    assert.throws(() => shadowSnapshotFromWire({ ...wire,
      coverage: { ...wire.coverage, unsupportedFields: ['velocity'] } }, 'complete'),
    /conflicting wire field coverage/);
    assert.throws(() => shadowSnapshotFromWire({ ...wire,
      token: { ...wire.token, project: NaN } }, 'complete'), /invalid shadow window/);
  });
});

describe('8g shadow consumer freshness', () => {
  it('permits a read-only observation and a sparse-patch preparation without write authority', () => {
    assert.deepEqual(assessShadowConsumer(snapshot, readRequest), {
      mode: 'shadow-observation', reason: 'current', overlayCurrent: true,
    });
    assert.equal(assessShadowConsumer(snapshot,
      { ...readRequest, workflow: 'sparse-patch', base: dependency }).mode, 'shadow-preparation-only');
  });

  it('discards stale overlays while permitting an independent current read', () => {
    assert.deepEqual(assessShadowConsumer(snapshot,
      { ...readRequest, overlay: { ...dependency, contentGeneration: 4 } }), {
      mode: 'shadow-observation', reason: 'current', overlayCurrent: false,
    });
  });

  it('refuses stale bases even if contents or clip addresses are equal', () => {
    for (const base of [undefined, { ...dependency, logicalClipId: 'duplicate' },
      { ...dependency, projectGeneration: 0 }, { ...dependency, contentGeneration: 4 },
      { ...dependency, fingerprint: 'changed' }]) {
      const request = { ...readRequest, workflow: 'sparse-patch' as const,
        ...(base === undefined ? {} : { base }) };
      assert.deepEqual(assessShadowConsumer(snapshot, request), {
        mode: 'refuse', reason: 'base-conflict', overlayCurrent: true,
      });
    }
  });

  it('allows acquired field-only reads but refuses unknown or unsupported field requirements', () => {
    assert.equal(assessShadowConsumer(snapshot, readRequest).mode, 'shadow-observation');
    for (const field of ['repeat', 'pressure', 'articulation']) {
      assert.equal(assessShadowConsumer(snapshot, { ...readRequest, fields: [field] }).reason,
        'partial-fields');
    }
  });

  it('falls back after a computer-use change until a new observation is acquired', () => {
    const currentWindow = { ...snapshot.window, invalidationSequence: 7, contentGeneration: 6 };
    assert.equal(assessShadowConsumer(snapshot, { ...readRequest, currentWindow }).reason,
      'stale-generation');
    const reacquired = { ...snapshot, window: currentWindow, fingerprint: 'cache-v1:changed' };
    assert.deepEqual(assessShadowConsumer(reacquired,
      { ...readRequest, currentWindow, overlay: dependency }), {
      mode: 'shadow-observation', reason: 'current', overlayCurrent: false,
    });
  });

  it('refuses when an unhealthy snapshot has no authority', () => {
    assert.deepEqual(assessShadowConsumer({ ...snapshot, health: 'warming' },
      { ...readRequest, authorityAvailable: false }), {
      mode: 'refuse', reason: 'authority-unavailable', overlayCurrent: false,
    });
  });

  it('does not admit partial snapshot health even when one requested field is known', () => {
    assert.equal(assessShadowConsumer({ ...snapshot, health: 'partial' }, readRequest).reason, 'unhealthy');
  });

  it('does not expand cached coverage for a wider consumer request', () => {
    assert.equal(assessShadowConsumer(snapshot, { ...readRequest,
      onsetSpan: { startCell: 0, endCell: 131_072 } }).mode, 'shadow-observation');
    assert.equal(assessShadowConsumer(snapshot, { ...readRequest,
      onsetSpan: { startCell: 0, endCell: 131_073 } }).reason, 'partial-coverage');
    assert.throws(() => assessShadowConsumer(snapshot, { ...readRequest,
      onsetSpan: { startCell: -1, endCell: 512 } }), /invalid requested onset span/);
  });
});

const admission: ShadowAdmissionInput = {
  health: 'complete', comparison: 'match',
  eligibility: {
    identityVerified: true, lifecycleVerified: true, bindingCurrent: true,
    membershipComplete: true, fieldsComplete: true, populatedCanaryPassed: true,
    targetSettled: true, windowUnchanged: true, noStructuralEvent: true, noEventGap: true,
  },
  policy: {
    generationValid: true, replayComplete: true, authorityAvailable: true,
    viewSteps: CACHE_SCALE_LIMITS.viewSteps, activeObservers: CACHE_SCALE_LIMITS.activeObservers,
    occupiedCoordinates: CACHE_SCALE_LIMITS.occupiedCoordinatesPerClip,
    pendingDirtyCoordinates: 0, estimatedBytes: CACHE_SCALE_LIMITS.estimatedBytes,
    cacheConstructionMs: CACHE_SCALE_LIMITS.cacheConstructionMs, replayMs: CACHE_SCALE_LIMITS.replayMs,
    rebuildMs: CACHE_SCALE_LIMITS.rebuildMs, pingP95Ms: CACHE_SCALE_LIMITS.pingP95Ms,
  },
};

describe('8g experimental policy admission', () => {
  it('admits complete compared observations at selected budget equality', () => {
    const decision = assessShadowAdmission(admission);
    assert.equal(decision.eligible, true);
    assert.equal(decision.complete, true);
    assert.equal(decision.mode, 'cache');
    assert.equal(decision.budgetAdmitted, true);
  });

  it('does not use passing nonzero dirty admission as completeness', () => {
    for (const pendingDirtyCoordinates of [1, CACHE_SCALE_LIMITS.pendingDirtyCoordinates]) {
      const policy = { ...admission.policy, pendingDirtyCoordinates };
      assert.equal(evaluateCachePolicy(policy).mode, 'cache');
      const decision = assessShadowAdmission({ ...admission, policy });
      assert.equal(decision.budgetAdmitted, true);
      assert.equal(decision.eligible, false);
      assert.equal(decision.complete, false);
      assert.equal(decision.mode, 'exact-fallback');
      assert.equal(decision.health, 'dirty');
      assert.equal(decision.reason, 'dirty-coordinates');
      assert.notEqual(decision.policyDecision.mode, 'cache');
    }
  });

  it('keeps every unproved eligibility predicate outside cache publication', () => {
    for (const key of Object.keys(admission.eligibility) as (keyof typeof admission.eligibility)[]) {
      const decision = assessShadowAdmission({ ...admission,
        eligibility: { ...admission.eligibility, [key]: false } });
      assert.equal(decision.budgetAdmitted, true);
      assert.equal(decision.eligible, false, key);
      assert.equal(decision.complete, false, key);
      assert.notEqual(decision.mode, 'cache', key);
      assert.notEqual(decision.health, 'complete', key);
    }
    assert.equal(assessShadowAdmission({ ...admission,
      eligibility: { ...admission.eligibility, lifecycleVerified: false } }).reason,
    'lifecycle-unverified');
  });

  it('maps every unhealthy orchestration state to fallback before cache selection', () => {
    for (const health of ['warming', 'rebuilding', 'overflow', 'invalid', 'dirty',
      'repairing', 'partial', 'ambiguous'] as const) {
      const decision = assessShadowAdmission({ ...admission, health });
      assert.equal(decision.eligible, false, health);
      assert.equal(decision.mode, 'exact-fallback', health);
      assert.equal(decision.health, health);
      assert.notEqual(decision.policyDecision.mode, 'cache', health);
    }
  });

  it('requires an unchanged independent comparison rather than budget admission alone', () => {
    for (const comparison of ['not-run', 'mismatch', 'window-changed'] as const) {
      const decision = assessShadowAdmission({ ...admission, comparison });
      assert.equal(decision.budgetAdmitted, true);
      assert.equal(decision.complete, false);
      assert.equal(decision.eligible, false);
      assert.notEqual(decision.mode, 'cache');
    }
  });

  it('selects fresh authority fallback only when authority is available', () => {
    const eligibility = { ...admission.eligibility, fieldsComplete: false };
    assert.equal(assessShadowAdmission({ ...admission, eligibility }).mode, 'exact-fallback');
    const decision = assessShadowAdmission({ ...admission, eligibility,
      policy: { ...admission.policy, authorityAvailable: false } });
    assert.equal(decision.mode, 'refuse');
    assert.equal(decision.reason, 'authority-unavailable');
    assert.equal(decision.complete, false);
  });

  it('retains above-limit callback shedding and bounded rebuild instructions', () => {
    const decision = assessShadowAdmission({ ...admission,
      eligibility: { ...admission.eligibility, lifecycleVerified: false },
      policy: { ...admission.policy, pendingDirtyCoordinates: CACHE_SCALE_LIMITS.pendingDirtyCoordinates + 1 } });
    assert.equal(decision.mode, 'exact-fallback');
    assert.equal(decision.reason, 'dirty-backpressure');
    assert.equal(decision.policyDecision.shedCallbacks, true);
    assert.equal(decision.policyDecision.scheduleRebuild, true);
  });

  it('rejects invalid measurements before the permissive budget evaluator runs', () => {
    const counters = ['viewSteps', 'activeObservers', 'occupiedCoordinates',
      'pendingDirtyCoordinates', 'estimatedBytes'] as const;
    for (const key of counters) for (const value of [undefined, null, '0', -1, 0.5, NaN, Infinity,
      Number.MAX_SAFE_INTEGER + 1]) {
      assert.throws(() => assessShadowAdmission({ ...admission,
        policy: { ...admission.policy, [key]: value } } as ShadowAdmissionInput),
      /invalid shadow admission measurement/);
    }
    for (const key of ['cacheConstructionMs', 'replayMs', 'rebuildMs', 'pingP95Ms'] as const) {
      for (const value of [undefined, null, '0', -1, NaN, Infinity]) {
        assert.throws(() => assessShadowAdmission({ ...admission,
          policy: { ...admission.policy, [key]: value } } as ShadowAdmissionInput),
        /invalid shadow admission measurement/);
      }
      assert.equal(assessShadowAdmission({ ...admission,
        policy: { ...admission.policy, [key]: 0.5 } }).eligible, true);
    }
  });

  it('rejects missing or nonboolean proof predicates and unknown states', () => {
    for (const key of Object.keys(admission.eligibility)) {
      assert.throws(() => assessShadowAdmission({ ...admission,
        eligibility: { ...admission.eligibility, [key]: undefined } } as unknown as ShadowAdmissionInput),
      /invalid shadow eligibility predicate/);
    }
    assert.throws(() => assessShadowAdmission({ ...admission, health: 'healthy' } as unknown as ShadowAdmissionInput),
      /invalid shadow admission state/);
    assert.throws(() => assessShadowAdmission({ ...admission,
      policy: { ...admission.policy, authorityAvailable: 'true' } } as unknown as ShadowAdmissionInput),
    /invalid shadow admission predicate/);
  });
});

const measurements: ShadowResourceMeasurements = {
  activeObservers: 1, occupiedCoordinates: 1, pendingCoordinates: 0, rejectedCallbacks: 0,
  recorderEstimatedBytes: 312, enrichedPayloadBytes: 1_024, snapshotRetainedBytes: 2_048,
  explicitHostObjects: 2, extensionObjects: 4, cacheConstructionMs: 0.1,
  replayMs: 1_500, rebuildMs: 2_000, pingP95Ms: 25, authorityScanMs: 7.2,
  enrichmentMs: 0.4, avoidedHostReads: 16, responseBytes: 900, toolCalls: 3,
  agentVisibleDelayMs: 1_900,
};

describe('8g resource measurements', () => {
  it('keeps recorder, enriched payload and retained snapshot storage separate', () => {
    assert.deepEqual(validateShadowResourceMeasurements(measurements), measurements);
    assert.ok(measurements.recorderEstimatedBytes < measurements.enrichedPayloadBytes);
  });

  it('rejects absent, negative, fractional and nonfinite counters', () => {
    for (const value of [undefined, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      assert.throws(() => validateShadowResourceMeasurements({ ...measurements, toolCalls: value }),
        /toolCalls/);
    }
  });

  it('rejects negative or nonfinite times but permits fractional time measurements', () => {
    for (const value of [-1, NaN, Infinity]) {
      assert.throws(() => validateShadowResourceMeasurements({ ...measurements, replayMs: value }),
        /replayMs/);
    }
    assert.equal(validateShadowResourceMeasurements({ ...measurements, replayMs: 0.1 }).replayMs, 0.1);
  });

  it('rejects sparse-only reports and removes host handles from returned measurements', () => {
    assert.throws(() => validateShadowResourceMeasurements({ recorderEstimatedBytes: 312 }),
      /invalid shadow resource/);
    assert.deepEqual(validateShadowResourceMeasurements({ ...measurements, hostHandle: {} }), measurements);
  });
});
