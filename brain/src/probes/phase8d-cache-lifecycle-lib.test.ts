import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CacheLifecycleRegistry,
  type ClipAddress,
  type ClipCandidate,
  type ContentEvent,
} from './phase8d-cache-lifecycle-lib.js';

const A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const address = (channelId: string, row: number): ClipAddress => ({ channelId, row });
const clip = (channelId: string, row: number, fingerprint: string): ClipCandidate => ({
  address: address(channelId, row), fingerprint,
});
const event = (
  sequence: number, channelId: string, row: number, filled: boolean,
): ContentEvent => ({ sequence, address: address(channelId, row), filled });

function seeded(...clips: readonly ClipCandidate[]): CacheLifecycleRegistry {
  const registry = new CacheLifecycleRegistry();
  registry.beginProject('extension-1', { name: 'A', trackIds: [A, B] });
  const rebuild = registry.startRebuild();
  assert.equal(registry.finishRebuild(rebuild, clips), true);
  return registry;
}

test('8d: one exact move pair preserves a logical clip identity', () => {
  const registry = seeded(clip(A, 1, 'one'));
  const before = registry.entries()[0]!;
  const result = registry.reconcileContentEvents(
    [event(1, A, 1, false), event(2, B, 3, true)],
    [clip(B, 3, 'one')],
  );
  assert.equal(result.kind, 'move');
  assert.deepEqual(result.preserved, [before.logicalId]);
  assert.equal(registry.entries()[0]?.logicalId, before.logicalId);
  assert.deepEqual(registry.entries()[0]?.address, address(B, 3));
  assert.equal(registry.entries()[0]?.state, 'repairing');
});

test('8d: an out-of-order event sequence cannot preserve move identity', () => {
  const registry = seeded(clip(A, 1, 'one'));
  const before = registry.entries()[0]!;
  const result = registry.reconcileContentEvents(
    [event(2, A, 1, false), event(1, B, 3, true)],
    [clip(B, 3, 'one')],
  );
  assert.equal(result.kind, 'replace');
  assert.deepEqual(result.preserved, []);
  assert.deepEqual(result.retired, [before.logicalId]);
  assert.notEqual(registry.entries()[0]?.logicalId, before.logicalId);
});

test('8d: create and duplicate fills mint new identities even with equal content', () => {
  const registry = seeded(clip(A, 1, 'same'));
  const first = registry.entries()[0]!;
  const result = registry.reconcileContentEvents(
    [event(1, A, 2, true)],
    [clip(A, 1, 'same'), clip(A, 2, 'same')],
  );
  assert.equal(result.kind, 'create');
  assert.equal(registry.entries().length, 2);
  assert.notEqual(registry.entries().find((entry) => entry.address.row === 2)?.logicalId,
    first.logicalId);
  assert.equal(registry.candidateAmbiguity('same', [clip(A, 1, 'same'), clip(A, 2, 'same')]),
    'many');
  assert.equal(registry.health, 'ambiguous');
});

test('8d: delete and replace cannot preserve the retired identity', () => {
  const registry = seeded(clip(A, 1, 'old'));
  const oldId = registry.entries()[0]!.logicalId;
  const result = registry.reconcileContentEvents(
    [event(1, A, 1, false), event(2, A, 1, true)],
    [clip(A, 1, 'old')],
  );
  assert.equal(result.kind, 'replace');
  assert.deepEqual(result.retired, [oldId]);
  assert.notEqual(registry.entries()[0]?.logicalId, oldId);
  assert.equal(registry.retired().find((entry) => entry.logicalId === oldId)?.state, 'deleted');
});

test('8d: note and field edits retain identity and increment content generation', () => {
  const registry = seeded(clip(A, 1, 'before'));
  const before = registry.entries()[0]!;
  const after = registry.updateContent(address(A, 1), 'after');
  assert.equal(after.logicalId, before.logicalId);
  assert.equal(after.contentGeneration, before.contentGeneration + 1);
  const same = registry.updateContent(address(A, 1), 'after');
  assert.equal(same.contentGeneration, after.contentGeneration);
});

test('8d: known scene compaction repairs rows and retires the deleted row', () => {
  const registry = seeded(
    clip(A, 1, 'before'), clip(A, 2, 'at'), clip(A, 3, 'after'),
  );
  const ids = new Map(registry.entries().map((entry) => [entry.fingerprint, entry.logicalId]));
  const retired = registry.deleteScene(2);
  assert.deepEqual(retired, [ids.get('at')]);
  assert.equal(registry.entries().find((entry) => entry.fingerprint === 'before')?.address.row, 1);
  assert.equal(registry.entries().find((entry) => entry.fingerprint === 'after')?.address.row, 2);
  assert.equal(registry.entries().find((entry) => entry.fingerprint === 'after')?.logicalId,
    ids.get('after'));
});

test('8d: track movement preserves channel-address identity and invalidates bindings', () => {
  const registry = seeded(clip(A, 1, 'one'));
  const callback = registry.bind(address(A, 1));
  const logicalId = registry.entries()[0]!.logicalId;
  registry.trackPositionChanged();
  assert.equal(registry.entries()[0]?.logicalId, logicalId);
  assert.equal(registry.acceptsCallback(callback), false);
  assert.equal(registry.health, 'repairing');
});

test('8d: track deletion retires all clips on one durable channel identity', () => {
  const registry = seeded(clip(A, 1, 'one'), clip(A, 2, 'two'), clip(B, 1, 'three'));
  const retired = registry.deleteTrack(A);
  assert.equal(retired.length, 2);
  assert.deepEqual(registry.entries().map((entry) => entry.address.channelId), [B]);
});

test('8d: project change invalidates entries, callbacks, rebuilds, and patch bases', () => {
  const registry = seeded(clip(A, 1, 'one'));
  const callback = registry.bind(address(A, 1));
  const rebuild = registry.startRebuild();
  const oldId = registry.entries()[0]!.logicalId;
  assert.equal(registry.observeProject('extension-1', { name: 'B', trackIds: [B] }), true);
  assert.equal(registry.entries().length, 0);
  assert.equal(registry.acceptsCallback(callback), false);
  assert.equal(registry.finishRebuild(rebuild, [clip(A, 1, 'one')]), false);
  assert.equal(registry.retired().find((entry) => entry.logicalId === oldId)?.state, 'invalid');
});

test('8d: controller reload starts a new project generation even in the same project', () => {
  const registry = seeded(clip(A, 1, 'one'));
  const oldGeneration = registry.projectGeneration;
  assert.equal(registry.observeProject('extension-2', { name: 'A', trackIds: [A, B] }), true);
  assert.equal(registry.projectGeneration, oldGeneration + 1);
  const rebuild = registry.startRebuild();
  registry.finishRebuild(rebuild, [clip(A, 1, 'one')]);
  assert.notEqual(registry.entries()[0]?.projectGeneration, oldGeneration);
});

test('8d: late callbacks and interrupted rebuilds cannot publish', () => {
  const registry = seeded(clip(A, 1, 'one'));
  const callback = registry.bind(address(A, 1));
  const rebuild = registry.startRebuild();
  assert.equal(registry.abortRebuild(rebuild), true);
  assert.equal(registry.health, 'invalid');
  assert.equal(registry.finishRebuild(rebuild, [clip(A, 1, 'one')]), false);
  assert.equal(registry.acceptsCallback(callback), false);
});

test('8d: group topology requires a complete rebuild', () => {
  const registry = seeded(clip(A, 1, 'one'));
  const oldId = registry.entries()[0]!.logicalId;
  const rebuild = registry.groupTopologyChanged();
  assert.equal(registry.health, 'rebuilding');
  assert.equal(registry.finishRebuild(rebuild, [clip(A, 1, 'one')]), true);
  assert.notEqual(registry.entries()[0]?.logicalId, oldId);
});

test('8d: same-address identity retention requires an explicit continuous event window', () => {
  const registry = seeded(clip(A, 1, 'one'));
  const oldId = registry.entries()[0]!.logicalId;
  const conservative = registry.startRebuild();
  registry.finishRebuild(conservative, [clip(A, 1, 'one')]);
  assert.notEqual(registry.entries()[0]?.logicalId, oldId);

  const retainedId = registry.entries()[0]!.logicalId;
  const continuous = registry.startRebuild();
  registry.finishRebuild(continuous, [clip(A, 1, 'one')], 'continuous-same-address');
  assert.equal(registry.entries()[0]?.logicalId, retainedId);
});
