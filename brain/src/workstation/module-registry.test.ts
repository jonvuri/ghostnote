import assert from 'node:assert/strict';
import test from 'node:test';

import {
  WORKSTATION_REQUEST_SCHEMA, WORKSTATION_RESPONSE_SCHEMA,
  WorkstationModuleError, WorkstationModuleRegistry, type WorkstationModule,
} from './module-registry.js';

const digest = 'a'.repeat(64);

function moduleOf(
  id: string,
  handle: WorkstationModule<unknown, unknown>['handle'],
  start?: WorkstationModule<unknown, unknown>['start'],
  requestDeadlineMs = 50,
): WorkstationModule<unknown, unknown> {
  return {
    descriptor: {
      moduleId: id, version: '0', acceptedSchemas: ['input-v0'], emittedSchemas: ['output-v0'],
      capabilities: ['read'], startupDeadlineMs: 50, requestDeadlineMs,
    },
    ...(start === undefined ? {} : { start }),
    handle,
  };
}

const request = {
  schema: WORKSTATION_REQUEST_SCHEMA,
  requestId: 'request-1',
  inputSchema: 'input-v0',
  sourceSha256: digest,
  payload: {},
} as const;

test('7a-S17: discovery is inert and one missing dependency does not disable another module', async () => {
  let missingStarts = 0;
  let availableStarts = 0;
  const registry = new WorkstationModuleRegistry();
  registry.register(moduleOf(
    'missing-python',
    async () => assert.fail('the unavailable handler must not run'),
    async () => {
      missingStarts += 1;
      throw new Error('Python executable is absent');
    },
  ));
  registry.register(moduleOf(
    'bitwig-adapter',
    async (input) => ({
      schema: WORKSTATION_RESPONSE_SCHEMA,
      requestId: input.requestId,
      sourceSha256: input.sourceSha256,
      outputSchema: 'output-v0',
      payload: { ok: true },
    }),
    async () => {
      availableStarts += 1;
      return {
        state: 'available', capabilities: ['read'], missingCapabilities: [],
        dependencyVersions: { bitwig: 'fixture' },
      };
    },
  ));
  assert.equal(registry.discover().every((item) => item.state === 'uninitialized'), true);
  assert.equal(missingStarts + availableStarts, 0, 'discovery must not start or install dependencies');
  await assert.rejects(
    registry.request('missing-python', request),
    (error) => error instanceof WorkstationModuleError && error.code === 'missing-dependency',
  );
  const response = await registry.request('bitwig-adapter', request);
  assert.deepEqual(response.payload, { ok: true });
  assert.equal(registry.discover().find((item) => item.moduleId === 'missing-python')?.state,
    'unavailable');
  assert.equal(registry.discover().find((item) => item.moduleId === 'bitwig-adapter')?.state,
    'available');
});

test('7a-S17: mismatched and late responses refuse with no retry', async () => {
  const mismatch = new WorkstationModuleRegistry();
  mismatch.register(moduleOf('mismatch', async () => ({
    schema: WORKSTATION_RESPONSE_SCHEMA,
    requestId: 'different-request',
    sourceSha256: digest,
    outputSchema: 'output-v0',
    payload: {},
  })));
  await assert.rejects(
    mismatch.request('mismatch', request),
    (error) => error instanceof WorkstationModuleError && error.code === 'source-mismatch',
  );

  let calls = 0;
  const late = new WorkstationModuleRegistry();
  late.register(moduleOf('late', async (input) => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 25));
    return {
      schema: WORKSTATION_RESPONSE_SCHEMA,
      requestId: input.requestId,
      sourceSha256: input.sourceSha256,
      outputSchema: 'output-v0',
      payload: {},
    };
  }, undefined, 5));
  await assert.rejects(
    late.request('late', request),
    (error) => error instanceof WorkstationModuleError && error.code === 'timeout',
  );
  assert.equal(calls, 1, 'the registry must not retry a timed-out request');
});

test('7d-S17: a timed-out request waits for abort cleanup', async () => {
  let cleanupFinished = false;
  const registry = new WorkstationModuleRegistry();
  registry.register(moduleOf('abort-cleanup', async (_input, signal) => {
    await new Promise<void>((_resolve, reject) => {
      signal?.addEventListener('abort', () => {
        setTimeout(() => {
          cleanupFinished = true;
          reject(new Error('cancelled after cleanup'));
        }, 10);
      }, { once: true });
    });
    assert.fail('the aborted handler must not return a response');
  }, undefined, 5));
  await assert.rejects(
    registry.request('abort-cleanup', request),
    (error) => error instanceof WorkstationModuleError && error.code === 'timeout',
  );
  assert.equal(cleanupFinished, true);
});

test('7d-S17: a request timeout cancels startup and permits a later request', async () => {
  let starts = 0;
  let cleanupFinished = false;
  const registry = new WorkstationModuleRegistry();
  registry.register(moduleOf('startup-abort', async (input) => ({
    schema: WORKSTATION_RESPONSE_SCHEMA,
    requestId: input.requestId,
    sourceSha256: input.sourceSha256,
    outputSchema: 'output-v0',
    payload: { ok: true },
  }), async (signal) => {
    starts += 1;
    if (starts === 1) {
      await new Promise<void>((_resolve, reject) => {
        signal?.addEventListener('abort', () => {
          cleanupFinished = true;
          reject(new Error('startup cancelled'));
        }, { once: true });
      });
    }
    return {
      state: 'available', capabilities: ['read'], missingCapabilities: [],
      dependencyVersions: { fixture: '1' },
    };
  }, 20));

  await assert.rejects(
    registry.request('startup-abort', request),
    (error) => error instanceof WorkstationModuleError && error.code === 'timeout',
  );
  assert.equal(cleanupFinished, true);
  assert.equal(registry.discover()[0]?.state, 'uninitialized');

  const response = await registry.request('startup-abort', request);
  assert.deepEqual(response.payload, { ok: true });
  assert.equal(starts, 2);
  assert.equal(registry.discover()[0]?.state, 'available');
});
