import assert from 'node:assert/strict';
import test from 'node:test';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { FakeAdapter } from '../adapters/fake/adapter.js';
import {
  clip, scene, slot, track, type BatchReceipt, type BatchRequest, type SettleBudget,
} from '../contract/index.js';
import { Executor } from '../engine/index.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { OperationRegistry } from './operations.js';
import { callTool, registerTools } from './tools.js';
import { cancellableWorkspace, workspaceOf, type Workspace } from './workspace.js';

function deferred(): { readonly promise: Promise<void>; readonly resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

class DelayedApplyFakeAdapter extends FakeAdapter {
  private gate: {
    readonly entered: ReturnType<typeof deferred>;
    readonly release: ReturnType<typeof deferred>;
  } | undefined;
  private appliedBatchNeedsVerification = false;

  delayNextAppliedBatch(): {
    readonly entered: Promise<void>;
    readonly release: () => void;
  } {
    const entered = deferred();
    const release = deferred();
    this.gate = { entered, release };
    return { entered: entered.promise, release: release.resolve };
  }

  override async apply(batch: BatchRequest): Promise<BatchReceipt> {
    const receipt = await super.apply(batch);
    if (this.gate !== undefined) this.appliedBatchNeedsVerification = true;
    return receipt;
  }

  override async settle(budget: SettleBudget): Promise<void> {
    await super.settle(budget);
    const gate = this.gate;
    if (gate !== undefined && this.appliedBatchNeedsVerification) {
      this.gate = undefined;
      this.appliedBatchNeedsVerification = false;
      gate.entered.resolve();
      await gate.release.promise;
    }
  }
}

test('2x completion returns one terminal result through the operation id', async () => {
  let next = 0;
  const registry = new OperationRegistry({
    newId: () => `operation-${++next}`,
    now: () => 10 + next,
  });

  const accepted = registry.start('generation', async () => ({ applied: true }));
  assert.equal(accepted.operationId, 'operation-1');
  assert.equal(accepted.state, 'accepted');
  assert.equal(accepted.terminal, false);

  const completed = await registry.wait(accepted.operationId);
  assert.equal(completed.state, 'completed');
  assert.equal(completed.terminal, true);
  assert.deepEqual(completed.result, { applied: true });
});

test('2j operation status reports live wall-clock time and freezes it at terminal state', async () => {
  const entered = deferred();
  const release = deferred();
  let now = 100;
  const registry = new OperationRegistry({
    newId: () => 'operation-timing',
    now: () => now,
  });
  const accepted = registry.start('generation', async () => {
    entered.resolve();
    await release.promise;
    return { applied: true };
  });

  assert.equal(accepted.startedAtMs, 100);
  assert.equal(accepted.elapsedMs, 0);
  await entered.promise;
  now = 145;
  const running = registry.status(accepted.operationId);
  assert.equal(running.state, 'running');
  assert.equal(running.elapsedMs, 45);

  now = 250;
  release.resolve();
  const completed = await registry.wait(accepted.operationId);
  assert.equal(completed.finishedAtMs, 250);
  assert.equal(completed.elapsedMs, 150);

  now = 900;
  assert.equal(registry.status(accepted.operationId).elapsedMs, 150);
});

test('2x cancellation is not terminal until the running unit stops', async () => {
  const entered = deferred();
  const release = deferred();
  const registry = new OperationRegistry({ newId: () => 'operation-cancel', now: () => 20 });
  const accepted = registry.start('transformation', async ({ signal }) => {
    entered.resolve();
    await release.promise;
    signal.throwIfAborted();
    return { applied: true };
  });

  await entered.promise;
  const requested = registry.cancel(accepted.operationId);
  assert.equal(requested.state, 'cancelling');
  assert.equal(requested.terminal, false);
  assert.equal(requested.cancellationRequested, true);

  release.resolve();
  const cancelled = await registry.wait(accepted.operationId);
  assert.equal(cancelled.state, 'cancelled');
  assert.equal(cancelled.terminal, true);
  assert.equal(cancelled.result, undefined);
});

test('2x cancellation before dispatch prevents the operation body from running', async () => {
  let ran = false;
  const registry = new OperationRegistry({ newId: () => 'operation-early' });
  const accepted = registry.start('generation', async () => {
    ran = true;
    return {};
  });
  registry.cancel(accepted.operationId);

  const cancelled = await registry.wait(accepted.operationId);
  assert.equal(cancelled.state, 'cancelled');
  assert.equal(ran, false);
});

async function musicalWorkspace(
  fake: FakeAdapter = new FakeAdapter({ tracks: ['gn-operation'], scenes: 4 }),
): Promise<{
  readonly fake: FakeAdapter;
  readonly workspace: Workspace;
  readonly trackId: string;
}> {
  const stash = new Stash();
  const workspace = workspaceOf({
    ready: async () => undefined,
    adapter: fake,
    executor: new Executor(fake, { newId: () => `change-${stash.log.list().length + 1}` }),
    stash,
    observationStore: new FakeObservationStore(),
  });
  const trackId = (await workspace.tracks())[0]!.channelId;
  const at = await workspace.mark();
  await workspace.apply([{
    op: 'clip.create',
    slot: slot(track(trackId), scene(0, at.sceneEpoch)),
    lengthBeats: 4,
  }]);
  return { fake, workspace, trackId };
}

const patchFor = (trackId: string) => ({
  schema: 'ghostnote-musical-patch',
  version: 1,
  protection: { kind: 'direct' },
  targets: [{
    clip: { trackId, row: 0 },
    channel: 0,
    write: 'merge',
    operations: [{
      op: 'generate',
      source: {
        kind: 'notes',
        notes: [{ startBeats: 0, pitch: 60, velocity: 100, durationBeats: 1 }],
      },
    }],
  }],
});

test('2x pre-write cancellation reaches terminal with no project mutation', async () => {
  const fx = await musicalWorkspace();
  const entered = deferred();
  const release = deferred();
  const registry = new OperationRegistry({ newId: () => 'operation-before-write' });
  const delayed: Workspace = Object.freeze({
    ...fx.workspace,
    async read(addresses: Parameters<Workspace['read']>[0]) {
      const result = await fx.workspace.read(addresses);
      entered.resolve();
      await release.promise;
      return result;
    },
  });
  const started = registry.start('generation', async ({ signal, record }) => {
    const result = await callTool(
      cancellableWorkspace(delayed, signal, record),
      'generate_clip_music',
      patchFor(fx.trackId),
    );
    signal.throwIfAborted();
    return result;
  });

  await entered.promise;
  registry.cancel(started.operationId);
  release.resolve();
  const cancelled = await registry.wait(started.operationId);

  assert.equal(cancelled.state, 'cancelled');
  assert.deepEqual(cancelled.changes, []);
  assert.equal(fx.fake.model.tracks[0]!.slots[0]!.notes.size, 0);
});

test('2x cancellation after write start records the finished write before terminal', async () => {
  const fake = new DelayedApplyFakeAdapter({ tracks: ['gn-operation'], scenes: 4 });
  const fx = await musicalWorkspace(fake);
  const delayed = fake.delayNextAppliedBatch();
  const registry = new OperationRegistry({ newId: () => 'operation-after-write' });
  const started = registry.start('generation', async ({ signal, record }) => {
    const result = await callTool(
      cancellableWorkspace(fx.workspace, signal, record),
      'generate_clip_music',
      patchFor(fx.trackId),
    );
    signal.throwIfAborted();
    return result;
  });

  await delayed.entered;
  assert.equal(fake.model.tracks[0]!.slots[0]!.notes.size, 1,
    'the adapter mutation landed before cancellation');
  assert.equal(fx.workspace.changes.list().length, 1,
    'the operation is not recorded before executor verification');
  const requested = registry.cancel(started.operationId);
  assert.equal(requested.state, 'cancelling');
  assert.equal(requested.terminal, false);
  delayed.release();
  const cancelled = await registry.wait(started.operationId);

  assert.equal(cancelled.state, 'cancelled');
  assert.equal(cancelled.terminal, true);
  assert.equal(cancelled.changes.length, 1);
  assert.equal(cancelled.changes[0]?.applied, true);
  assert.equal(fx.workspace.changes.list().length, 2,
    'executor verification finished and the operation was recorded');
  assert.equal(fake.model.tracks[0]!.slots[0]!.notes.size, 1);
});

test('2x direct MCP cancellation stops a musical tool after its current read', async (t) => {
  const fx = await musicalWorkspace();
  const entered = deferred();
  const release = deferred();
  let applyCalled = false;
  const delayed: Workspace = Object.freeze({
    ...fx.workspace,
    async read(addresses: Parameters<Workspace['read']>[0]) {
      const result = await fx.workspace.read(addresses);
      entered.resolve();
      await release.promise;
      return result;
    },
    async apply(
      ops: Parameters<Workspace['apply']>[0],
      options?: Parameters<Workspace['apply']>[1],
    ) {
      applyCalled = true;
      return fx.workspace.apply(ops, options);
    },
  });
  const server = new McpServer({ name: 'ghostnote-2x-direct-cancel', version: '1.0.0' });
  registerTools(server, delayed);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'phase-2x-direct-cancel', version: '1.0.0' });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  t.after(async () => {
    await client.close();
    await server.close();
  });

  const controller = new AbortController();
  const request = client.callTool({
    name: 'generate_clip_music',
    arguments: patchFor(fx.trackId),
  }, undefined, { signal: controller.signal });

  await entered.promise;
  controller.abort('cancel direct musical call');
  await assert.rejects(request);
  release.resolve();
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(applyCalled, false, 'cancellation stops before the next workspace write');
  assert.equal(fx.workspace.changes.list().length, 1);
  assert.equal(fx.fake.model.tracks[0]!.slots[0]!.notes.size, 0);
});
