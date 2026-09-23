import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  HYBRID_RUN_RECORD_SCHEMA, PHASE_7F_AUDIO_GUIDED_PROFILE, PHASE_7F_RUN_PROFILE,
  validateHybridRunRecord,
} from './hybrid-run-record.js';

const base = () => ({
  schema: HYBRID_RUN_RECORD_SCHEMA,
  profile: PHASE_7F_RUN_PROFILE,
  status: 'running',
  rootSession: {
    id: 'run-1', client: 'Codex', model: 'GPT-5', operatingMode: 'hybrid',
    startedAt: '2026-09-23T00:00:00.000Z',
  },
  permissions: {
    projectPath: '/tmp/real.bwproject', temporaryProjectLocalWaveFiles: true,
    boundedDeviceParameters: true, changesRequireRecordedIds: true, externalReference: false,
  },
  versions: { node: '24.11.1' },
  modules: PHASE_7F_AUDIO_GUIDED_PROFILE.modules.map((module) => ({
    ...module, state: 'uninitialized',
  })),
  request: { id: 'request-1', text: 'Make one sound brighter without making it louder.' },
  links: [{ kind: 'request', id: 'request-1' }],
  source: {
    id: 'source-1', projectFileSha256: 'a'.repeat(64), trackId: 'track-1', trackName: 'keys',
    launcherRow: 0, devicePosition: 0, deviceName: 'EQ+', parameterId: 'gain',
    parameterName: 'High Gain',
  },
  artifacts: [], evidence: [], operations: [], changes: [], seams: [], authorities: [],
  uiEvents: [],
  costs: {
    toolCalls: 0, latencyMs: {}, operatorInterventions: [], targetErrors: [],
    verificationCost: [], unsupportedBoundaries: [],
  },
  operatorVerdict: { state: 'pending' },
  finalState: {
    project: 'unchanged except selected parameter', recorder: 'inactive', transport: 'stopped',
    selection: 'entry state', filesystem: 'captures retained pending verdict',
  },
  interfaceClassifications: [],
});

test('the frozen profile names exact module schemas and the level gate', () => {
  assert.equal(PHASE_7F_AUDIO_GUIDED_PROFILE.stableToolProfile, 'stable-v1');
  assert.equal(PHASE_7F_AUDIO_GUIDED_PROFILE.task.maximumAbsoluteLoudnessDeltaLu, 0.2);
  assert.deepEqual(PHASE_7F_AUDIO_GUIDED_PROFILE.intendedSeams, [
    'S01', 'S02', 'S11', 'S12', 'S13', 'S16', 'S17',
  ]);
});

test('a running record can retain pending artifacts and verdict', () => {
  assert.deepEqual(validateHybridRunRecord(base()), base());
});

test('a complete record needs A and B, an operator verdict, and passing S16', () => {
  assert.throws(() => validateHybridRunRecord({ ...base(), status: 'complete' }), /A and B/);
  const complete = {
    ...base(),
    status: 'complete',
    artifacts: [
      { id: 'a', role: 'A', absolutePath: '/tmp/a.wav', sha256: 'a'.repeat(64), byteCount: 1, owned: true },
      { id: 'b', role: 'B', absolutePath: '/tmp/b.wav', sha256: 'b'.repeat(64), byteCount: 1, owned: true },
    ],
    operatorVerdict: { state: 'accepted-B', rawResponse: 'Keep B.' },
    seams: [{
      id: 'S16', producer: 'run', consumer: 'record',
      formats: [{ name: HYBRID_RUN_RECORD_SCHEMA, producerVersion: '0', consumerVersion: '0' }],
      projection: 'All linked records keep their own authority.',
      translation: 'No value translation.', defaults: [], validation: ['Strict schema validation.'],
      droppedData: [], verdict: 'pass',
    }],
  };
  assert.equal(validateHybridRunRecord(complete).status, 'complete');
});
