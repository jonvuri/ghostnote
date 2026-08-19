import { test } from 'node:test';
import assert from 'node:assert/strict';

import { decodeObservationRecord } from './record.js';
import { reportObservationRecord } from './report.js';

const version = 'ghostnote-description-v1';

const instruction = (
  id: string,
  requestedScope: 'device-only' | 'launcher-clip-only' | 'mixed' | 'unsupported',
  operatorResponse: 'silent' | 'accepted' | 'vetoed',
  resultIds: string[],
) => ({
  type: 'instruction-observation' as const,
  id,
  correlationId: `correlation-${id}`,
  recordedAtMs: 1,
  descriptionVersion: version,
  requestedScope,
  rawScope: { id },
  operatorResponse,
  resultIds,
});

const device = (id: string, instructionId: string) => ({
  type: 'managed-event' as const,
  id,
  correlationId: `correlation-${instructionId}`,
  executionId: `execution-${id}`,
  recordedAtMs: 2,
  descriptionVersion: version,
  structure: 'device-alternate' as const,
  tool: 'create_device_alternates' as const,
  result: { trackId: `track-${id}`, containerPosition: 0, alternateNames: ['a', 'b'] },
});

const clip = (id: string, instructionId: string) => ({
  type: 'managed-event' as const,
  id,
  correlationId: `correlation-${instructionId}`,
  executionId: `execution-${id}`,
  recordedAtMs: 2,
  descriptionVersion: version,
  structure: 'clip-block' as const,
  tool: 'copy_clip_down' as const,
  result: { trackId: `track-${id}`, sourceRow: 0, copiedRow: 1 },
});

const trackCopy = (id: string, instructionId: string) => ({
  type: 'ordinary-use' as const,
  id,
  correlationId: `correlation-${instructionId}`,
  executionId: `execution-${id}`,
  recordedAtMs: 2,
  descriptionVersion: version,
  outcome: 'copy-track' as const,
  tool: 'copy_track' as const,
  result: { sourceTrackId: 'track-source', copiedTrackId: 'track-copy' },
});

const record = decodeObservationRecord(JSON.stringify({
  format: 'ghostnote-observation-record',
  schemaVersion: 1,
  entries: [
    instruction('instruction-device', 'device-only', 'accepted', ['device-1']),
    device('device-1', 'instruction-device'),
    instruction('instruction-clip', 'launcher-clip-only', 'silent', ['clip-1']),
    clip('clip-1', 'instruction-clip'),
    instruction('instruction-mixed', 'mixed', 'accepted', ['device-2', 'clip-2']),
    device('device-2', 'instruction-mixed'),
    clip('clip-2', 'instruction-mixed'),
    instruction('instruction-copy', 'device-only', 'vetoed', ['copy-1']),
    trackCopy('copy-1', 'instruction-copy'),
    instruction('instruction-veto', 'unsupported', 'vetoed', []),
    instruction('instruction-none', 'device-only', 'silent', []),
  ],
}));

test('report totals reconcile with every raw entry type', () => {
  const report = reportObservationRecord(record);
  assert.deepEqual(report.totals, {
    entries: 11,
    instructions: 6,
    managedEvents: 4,
    ordinaryUses: 1,
    musicalUses: 0,
    resultReferences: 5,
  });
  assert.deepEqual(report.managedEvents, { deviceAlternate: 2, clipBlock: 2 });
  assert.deepEqual(report.ordinaryUses, { copyTrack: 1 });
  assert.deepEqual(report.musicalUses, { generation: 0, transformation: 0, applied: 0 });
  assert.equal(report.instructionsWithoutResults, 2);
  assert.deepEqual(report.unreferencedResults, {
    managedEvents: 0, ordinaryUses: 0, musicalUses: 0,
  });
  assert.deepEqual(report.operatorResponses, { silent: 2, accepted: 2, vetoed: 2 });
  assert.deepEqual(report.descriptionVersions, [{
    descriptionVersion: version,
    instructionObservations: 6,
    managedEvents: 4,
    ordinaryUses: 1,
    musicalUses: 0,
  }]);
});

test('requested scope cross-tab keeps independent structures and track copies distinct', () => {
  const report = reportObservationRecord(record);
  assert.equal(report.crossTab.reduce((sum, row) => sum + row.instructionCount, 0), 6);
  assert.ok(report.crossTab.every((row) => row.descriptionVersion === version));

  const mixed = report.crossTab.find((row) => row.requestedScope === 'mixed');
  assert.deepEqual(mixed, {
    descriptionVersion: version,
    requestedScope: 'mixed',
    actualResults: {
      deviceAlternateEvents: 1,
      clipBlockEvents: 1,
      copyTrackUses: 0,
      generationUses: 0,
      transformationUses: 0,
    },
    instructionCount: 1,
    operatorResponses: { silent: 0, accepted: 1, vetoed: 0 },
    operatorResponseRates: { silent: 0, accepted: 1, vetoed: 0 },
  });

  const copy = report.crossTab.find((row) => row.actualResults.copyTrackUses === 1);
  assert.equal(copy?.requestedScope, 'device-only');
  assert.deepEqual(copy?.actualResults, {
    deviceAlternateEvents: 0,
    clipBlockEvents: 0,
    copyTrackUses: 1,
    generationUses: 0,
    transformationUses: 0,
  });
  assert.equal(report.crossTab.filter((row) =>
    row.actualResults.deviceAlternateEvents === 0
      && row.actualResults.clipBlockEvents === 0
      && row.actualResults.copyTrackUses === 0).length, 2);
});

test('choice diversity is beside explicit response counts and rates', () => {
  const report = reportObservationRecord(record);
  const deviceScope = report.scopeSummaries.find((row) => row.requestedScope === 'device-only');
  assert.deepEqual(deviceScope, {
    descriptionVersion: version,
    requestedScope: 'device-only',
    instructionCount: 3,
    choiceDiversity: 3,
    operatorResponses: { silent: 1, accepted: 1, vetoed: 1 },
    operatorResponseRates: { silent: 1 / 3, accepted: 1 / 3, vetoed: 1 / 3 },
  });
});

test('empty reporting is complete and does not invent rows', () => {
  const empty = reportObservationRecord(decodeObservationRecord(JSON.stringify({
    format: 'ghostnote-observation-record', schemaVersion: 1, entries: [],
  })));
  assert.equal(empty.totals.entries, 0);
  assert.deepEqual(empty.operatorResponses, { silent: 0, accepted: 0, vetoed: 0 });
  assert.deepEqual(empty.scopeSummaries, []);
  assert.deepEqual(empty.crossTab, []);
});
