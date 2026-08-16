import { test } from 'node:test';
import assert from 'node:assert/strict';

import { LiveObservationStore } from '../adapters/live/observation-store.js';
import { RecordingTransport } from '../adapters/live/transport.js';
import { WIRE } from '../adapters/live/wiremap.js';
import {
  FakeObservationStore,
  ObservationCapacityError,
  ObservationProjectNameChangedError,
  ObservationStaleReadbackError,
  ObservationStorageAbsentError,
  ObservationStorageDowncastError,
} from './index.js';

const available = (value: string, projectName = 'project-A') => ({
  available: true,
  capacityChars: 262144,
  projectName,
  value,
});

const liveStore = (
  transport: RecordingTransport,
  projectName: () => Promise<string> = async () => 'project-A',
  maxReadAttempts = 4,
) => new LiveObservationStore({
  transport,
  projectName,
  maxReadAttempts,
  pollIntervalMs: 0,
  sleep: async () => {},
});

test('the fake keeps empty and populated values byte-for-byte and isolates projects', async () => {
  const store = new FakeObservationStore(64, 'project-A');
  assert.deepEqual(await store.read(), { value: '', capacityChars: 64 });

  const opaque = '{not-json:\n"café 🎹"}';
  assert.equal((await store.replace(opaque)).value, opaque);
  store.switchProject('project-B');
  assert.equal((await store.read()).value, '');
  await store.replace('project B');
  store.switchProject('project-A');
  assert.equal((await store.read()).value, opaque);
});

test('the fake refuses overflow before replacement and never truncates', async () => {
  const store = new FakeObservationStore(4);
  await store.replace('safe');
  await assert.rejects(() => store.replace('too large'), ObservationCapacityError);
  assert.equal((await store.read()).value, 'safe');
});

test('the live store uses product methods and polls until exact readback', async () => {
  const transport = new RecordingTransport().willReturn(
    { available: true, accepted: true, capacityChars: 262144, projectName: 'project-A' },
    available('stale'),
    available('stale'),
    available('next'),
  );
  const stored = await liveStore(transport).replace('next');

  assert.deepEqual(stored, { value: 'next', capacityChars: 262144 });
  assert.deepEqual(transport.methods, [
    WIRE.observationReplace,
    WIRE.observationRead,
    WIRE.observationRead,
    WIRE.observationRead,
  ]);
  assert.deepEqual(transport.frames[0]?.params, { value: 'next' });
});

test('a stale prior value cannot satisfy a bounded replacement poll', async () => {
  const transport = new RecordingTransport().willReturn(
    { available: true, accepted: true, capacityChars: 262144, projectName: 'project-A' },
    available('old'),
    available('old'),
  );
  await assert.rejects(
    () => liveStore(transport, undefined, 2).replace('new'),
    (error: unknown) => error instanceof ObservationStaleReadbackError
      && error.observed === 'old'
      && error.attempts === 2,
  );
});

test('absent storage and downcast refusal remain different failures', async () => {
  const absent = new RecordingTransport().willReturn({
    available: false,
    failure: 'storage-absent',
    error: 'panel did not initialize',
    capacityChars: 262144,
    projectName: 'project-A',
  });
  await assert.rejects(() => liveStore(absent).read(), ObservationStorageAbsentError);

  const downcast = new RecordingTransport().willReturn({
    available: false,
    failure: 'downcast-refused',
    error: 'Setting is unavailable',
    capacityChars: 262144,
    projectName: 'project-A',
  });
  await assert.rejects(() => liveStore(downcast).read(), ObservationStorageDowncastError);
});

test('a project-name change during replacement is reported before readback can pass', async () => {
  const projectNames = ['project-A', 'project-A', 'project-B'];
  const transport = new RecordingTransport().willReturn({
    available: true,
    accepted: true,
    capacityChars: 262144,
    projectName: 'project-A',
  });
  const store = liveStore(transport, async () => projectNames.shift() ?? 'project-B');

  await assert.rejects(
    () => store.replace('same text might exist in both projects'),
    (error: unknown) => error instanceof ObservationProjectNameChangedError
      && error.before === 'project-A'
      && error.after === 'project-B',
  );
  assert.deepEqual(transport.methods, [WIRE.observationReplace]);
});

test('an oversized live value is refused before any wire call', async () => {
  const transport = new RecordingTransport();
  await assert.rejects(
    () => liveStore(transport).replace('x'.repeat(262145)),
    ObservationCapacityError,
  );
  assert.deepEqual(transport.frames, []);
});
