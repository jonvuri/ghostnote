import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MalformedObservationRecordError,
  ObservationCapacityError,
  ObservationStoreUnavailableError,
  ObservationProjectNameChangedError,
  ObservationStaleReadbackError,
  ObservationStorageAbsentError,
  ObservationStorageDowncastError,
  UnsupportedObservationSchemaError,
  appendObservationEntry,
  decodeObservationRecord,
  emptyObservationRecord,
  encodeObservationRecord,
  enrichInstructionObservation,
  instructionObservation,
  reportObservationFailureAfterProjectWrite,
  type ClipBlockEvent,
  type DeviceAlternateEvent,
  type OrdinaryUse,
  type MusicalUse,
} from './index.js';

const common = {
  correlationId: 'correlation-1',
  recordedAtMs: 1_786_835_200_000,
  descriptionVersion: 'description-v1',
} as const;

const instruction = () => instructionObservation({
  ...common,
  id: 'instruction-1',
  requestedScope: 'mixed',
  rawScope: {
    instruction: 'Keep this text unchanged: café 🎹',
    writes: ['device', { launcherRow: 3 }],
  },
});

const deviceEvent: DeviceAlternateEvent = {
  type: 'managed-event',
  ...common,
  id: 'event-device-1',
  executionId: 'execution-device-1',
  structure: 'device-alternate',
  tool: 'create_device_alternates',
  result: {
    trackId: 'track-device',
    containerPosition: 1,
    alternateNames: ['source', 'brighter'],
  },
};

const clipEvent: ClipBlockEvent = {
  type: 'managed-event',
  ...common,
  id: 'event-clip-1',
  executionId: 'execution-clip-1',
  structure: 'clip-block',
  tool: 'copy_clip_down',
  result: { trackId: 'track-clip', sourceRow: 2, copiedRow: 3 },
};

const ordinaryUse: OrdinaryUse = {
  type: 'ordinary-use',
  ...common,
  id: 'ordinary-1',
  executionId: 'execution-copy-1',
  outcome: 'copy-track',
  tool: 'copy_track',
  result: { sourceTrackId: 'track-source', copiedTrackId: 'track-copy' },
};

const musicalUse: MusicalUse = {
  type: 'musical-use',
  ...common,
  id: 'musical-1',
  executionId: 'execution-musical-1',
  tool: 'generate_clip_music',
  result: {
    format: 'ghostnote-musical-result', version: 1, changeId: 'change-music',
    applied: true, outputCount: 1, differenceCount: 0, warningCount: 0,
  },
};

test('observation entries stay distinct and all operator responses are representable', () => {
  let record = appendObservationEntry(emptyObservationRecord(), instruction());
  record = appendObservationEntry(record, deviceEvent);
  record = appendObservationEntry(record, ordinaryUse);
  assert.deepEqual(record.entries.map((entry) => entry.type), [
    'instruction-observation', 'managed-event', 'ordinary-use',
  ]);
  assert.equal(
    record.entries[0]?.type === 'instruction-observation'
      ? record.entries[0].operatorResponse
      : undefined,
    'silent',
  );

  record = enrichInstructionObservation(record, {
    instructionId: 'instruction-1',
    resultIds: ['event-device-1', 'ordinary-1'],
    operatorResponse: 'accepted',
  });
  assert.equal(
    record.entries[0]?.type === 'instruction-observation'
      ? record.entries[0].operatorResponse
      : undefined,
    'accepted',
  );

  const veto = appendObservationEntry(emptyObservationRecord(), instructionObservation({
    ...common,
    id: 'instruction-veto',
    requestedScope: 'unsupported',
    rawScope: 'Change the arrangement and project tempo.',
  }));
  const enriched = enrichInstructionObservation(veto, {
    instructionId: 'instruction-veto',
    operatorResponse: 'vetoed',
  });
  assert.equal(
    enriched.entries[0]?.type === 'instruction-observation'
      ? enriched.entries[0].operatorResponse
      : undefined,
    'vetoed',
  );
  assert.deepEqual((enriched.entries[0] as { resultIds: readonly string[] }).resultIds, []);
});

test('enrichment never silently replaces explicit rationale or response', () => {
  let record = appendObservationEntry(emptyObservationRecord(), instruction());
  record = enrichInstructionObservation(record, {
    instructionId: 'instruction-1',
    rationale: 'The scoped tools match both requested objects.',
    operatorResponse: 'accepted',
  });
  assert.throws(
    () => enrichInstructionObservation(record, {
      instructionId: 'instruction-1', rationale: 'Replace the earlier text.',
    }),
    /Rationale is write-once.*preserved rationale.*record was not changed/s,
  );
  assert.throws(
    () => enrichInstructionObservation(record, {
      instructionId: 'instruction-1', operatorResponse: 'vetoed',
    }),
    /Operator response is write-once.*preserved response is accepted.*record was not changed/s,
  );
  assert.deepEqual(enrichInstructionObservation(record, {
    instructionId: 'instruction-1',
    rationale: 'The scoped tools match both requested objects.',
    operatorResponse: 'accepted',
  }), record);
});

test('one mixed instruction keeps accepted rhythm and vetoed timbre scopes', () => {
  let record = appendObservationEntry(emptyObservationRecord(), instruction());
  record = appendObservationEntry(record, deviceEvent);
  const responseItems = [
    { scope: 'rhythm', response: 'accepted' as const },
    { scope: { chord: 'timbre' }, response: 'vetoed' as const },
  ];
  record = enrichInstructionObservation(record, {
    instructionId: 'instruction-1', responseItems, resultIds: ['event-device-1'],
  });
  const observed = record.entries[0];
  assert.equal(observed?.type, 'instruction-observation');
  if (observed?.type !== 'instruction-observation') return;
  assert.equal(observed.operatorResponse, 'mixed');
  assert.deepEqual(observed.responseItems, responseItems);
  assert.deepEqual(observed.rawScope, instruction().rawScope);
  assert.deepEqual(observed.resultIds, ['event-device-1']);
  assert.deepEqual(enrichInstructionObservation(record, {
    instructionId: 'instruction-1', responseItems,
  }), record);
  assert.throws(() => enrichInstructionObservation(record, {
    instructionId: 'instruction-1',
    responseItems: [
      { scope: 'rhythm', response: 'vetoed' },
      { scope: { chord: 'timbre' }, response: 'accepted' },
    ],
  }), /Operator response is write-once.*preserved response is mixed/s);

  const silent = appendObservationEntry(emptyObservationRecord(), instruction());
  assert.throws(() => enrichInstructionObservation(silent, {
    instructionId: 'instruction-1',
    responseItems: [
      { scope: 'rhythm', response: 'accepted' },
      { scope: 'chord timbre', response: 'accepted' },
    ],
  }), /mixed response needs accepted and vetoed scoped items/);
});

test('canonical round trip preserves raw scope and free-form rationale exactly', () => {
  let record = appendObservationEntry(emptyObservationRecord(), instruction());
  record = enrichInstructionObservation(record, {
    instructionId: 'instruction-1',
    rationale: 'Unknown rationale: use β, keep punctuation\nincluding this line.',
  });
  const encoded = encodeObservationRecord(record);
  const reordered = JSON.stringify({
    entries: record.entries,
    schemaVersion: record.schemaVersion,
    format: record.format,
  });
  assert.equal(encodeObservationRecord(decodeObservationRecord(reordered)), encoded);
  assert.deepEqual(decodeObservationRecord(encoded), record);
});

test('one mixed correlation keeps independent event identities', () => {
  let record = appendObservationEntry(emptyObservationRecord(), instruction());
  record = appendObservationEntry(record, deviceEvent);
  record = appendObservationEntry(record, clipEvent);
  record = enrichInstructionObservation(record, {
    instructionId: 'instruction-1',
    resultIds: ['event-device-1', 'event-clip-1'],
  });
  const events = record.entries.filter((entry) => entry.type === 'managed-event');
  assert.deepEqual(events.map((entry) => entry.structure), ['device-alternate', 'clip-block']);
  assert.deepEqual(events.map((entry) => entry.id), ['event-device-1', 'event-clip-1']);
  assert.deepEqual(events.map((entry) => entry.executionId), [
    'execution-device-1', 'execution-clip-1',
  ]);
});

test('correlation validates references but never combines results', () => {
  let record = appendObservationEntry(emptyObservationRecord(), instruction());
  record = appendObservationEntry(record, {
    ...deviceEvent,
    correlationId: 'another-correlation',
  });
  assert.throws(
    () => enrichInstructionObservation(record, {
      instructionId: 'instruction-1', resultIds: ['event-device-1'],
    }),
    (error: unknown) => error instanceof MalformedObservationRecordError
      && /another correlation id/.test(error.message),
  );
});

test('one execution cannot create two result entries', () => {
  let record = appendObservationEntry(emptyObservationRecord(), deviceEvent);
  assert.throws(
    () => appendObservationEntry(record, { ...deviceEvent, id: 'event-device-2' }),
    (error: unknown) => error instanceof MalformedObservationRecordError
      && /already has a result/.test(error.message),
  );
});

test('musical use keeps tool, result identity, version, and concise outcome counts', () => {
  const record = appendObservationEntry(emptyObservationRecord(), musicalUse);
  assert.deepEqual(record.entries[0], musicalUse);
  assert.deepEqual(decodeObservationRecord(encodeObservationRecord(record)), record);
});

test('managed events accept only the two creation tools and structures', () => {
  const forged = {
    ...deviceEvent,
    tool: 'fill_device_alternate',
  };
  assert.throws(
    () => decodeObservationRecord(JSON.stringify({
      ...emptyObservationRecord(), entries: [forged],
    })),
    (error: unknown) => error instanceof MalformedObservationRecordError
      && /create_device_alternates/.test(error.message),
  );
  assert.equal(ordinaryUse.type, 'ordinary-use');
  assert.equal(ordinaryUse.outcome, 'copy-track');
});

test('schemas v1 and v2 migrate without changing old verdict meaning', () => {
  assert.throws(
    () => decodeObservationRecord('{'),
    MalformedObservationRecordError,
  );
  assert.deepEqual(decodeObservationRecord(JSON.stringify({
    format: 'ghostnote-observation-record', schemaVersion: 1, entries: [],
  })), emptyObservationRecord());
  const accepted = {
    ...instruction(), operatorResponse: 'accepted', resultIds: ['musical-1'],
  };
  assert.deepEqual(decodeObservationRecord(JSON.stringify({
    format: 'ghostnote-observation-record', schemaVersion: 2,
    entries: [accepted, musicalUse],
  })), {
    ...emptyObservationRecord(), entries: [accepted, musicalUse],
  });
  assert.throws(() => decodeObservationRecord(JSON.stringify({
    format: 'ghostnote-observation-record', schemaVersion: 4, entries: [],
  })), UnsupportedObservationSchemaError);
  assert.throws(
    () => decodeObservationRecord(JSON.stringify({
      ...emptyObservationRecord(), extra: 'not schema v3',
    })),
    MalformedObservationRecordError,
  );
});

test('capacity exhaustion refuses the complete value without truncation', () => {
  const record = appendObservationEntry(emptyObservationRecord(), instruction());
  const complete = encodeObservationRecord(record);
  assert.throws(
    () => encodeObservationRecord(record, { capacityChars: complete.length - 1 }),
    (error: unknown) => error instanceof ObservationCapacityError
      && error.requiredChars === complete.length
      && error.capacityChars === complete.length - 1,
  );
  assert.equal(encodeObservationRecord(record, { capacityChars: complete.length }), complete);
});

test('a record failure after a project write reports both facts', () => {
  const report = reportObservationFailureAfterProjectWrite(
    { applied: true, copiedTrackId: 'track-copy' },
    new ObservationStoreUnavailableError('the project changed during record replacement'),
  );
  assert.equal(report.partialSuccess, true);
  assert.deepEqual(report.projectWrite, {
    succeeded: true,
    result: { applied: true, copiedTrackId: 'track-copy' },
  });
  assert.equal(report.observationUpdate.succeeded, false);
  assert.equal(report.observationUpdate.error.kind, 'unavailable-store');
});

test('persistence transport failures keep distinct public kinds', () => {
  const cases = [
    [new ObservationStorageAbsentError('absent'), 'storage-absent'],
    [new ObservationStorageDowncastError('refused'), 'storage-downcast-refused'],
    [new ObservationStaleReadbackError('new', 'old', 4), 'stale-readback'],
    [new ObservationProjectNameChangedError('A', 'B'), 'project-name-changed'],
  ] as const;
  for (const [error, kind] of cases) {
    const report = reportObservationFailureAfterProjectWrite({ applied: true }, error);
    assert.equal(report.observationUpdate.error.kind, kind);
  }
});
