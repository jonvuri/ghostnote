import assert from 'node:assert/strict';
import test from 'node:test';

import type { Transport } from '../adapters/live/transport.js';
import type { Frame } from '../adapters/live/wiremap.js';
import { DevicePerformanceRecorder, DeviceTimingTransport } from './phase4h-device-performance-lib.js';

class StubTransport implements Transport {
  async send(frame: Frame): Promise<unknown> {
    return frame.method === 'batch.run' ? { elapsedMicros: 2500 } : {};
  }

  async close(): Promise<void> {}
}

test('4h trace counts bridge requests and extension server time', async () => {
  const transport = new DeviceTimingTransport(new StubTransport());
  const recorder = new DevicePerformanceRecorder(transport);
  const result = await recorder.sample('native', async () => {
    await recorder.phase('targetAcquisition', async () => transport.send({
      method: 'devcursor.status', params: {},
    }));
    await recorder.phase('plannedSettlement', async () => transport.send({
      method: 'batch.run', params: {},
    }));
    return 42;
  });

  assert.equal(result.value, 42);
  assert.equal(result.sample.bridgeRequests, 2);
  assert.equal(result.sample.serverMs, 2.5);
  assert.deepEqual(result.sample.requests, { 'devcursor.status': 1, 'batch.run': 1 });
  assert.ok(result.sample.phases['targetAcquisition']! >= 0);
  assert.ok(result.sample.phases['plannedSettlement']! >= 0);
  assert.ok(result.sample.hostSettleMs >= 0);
  assert.ok(result.sample.dominantPhase.length > 0);
});

test('4h trace keeps a sample when a live workload refuses', async () => {
  const recorder = new DevicePerformanceRecorder(
    new DeviceTimingTransport(new StubTransport()),
  );
  await assert.rejects(recorder.sample('refusal', async () => {
    throw new Error('observer unstable');
  }), /observer unstable/);
  assert.equal(recorder.samples.length, 1);
  assert.equal(recorder.samples[0]?.name, 'refusal');
});
