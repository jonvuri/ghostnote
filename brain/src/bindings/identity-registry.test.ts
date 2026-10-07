import assert from 'node:assert/strict';
import test from 'node:test';

import type { ClipSnapshotRef } from '../contract/clip-snapshot.js';
import type { RevisionMark } from '../contract/snapshot.js';
import { IdentityRegistry, REGISTRY_LIMIT, cellKey, type CellKey, type ProjectionIds } from './identity-registry.js';

const mark = (over: Partial<RevisionMark> = {}): RevisionMark => ({
  revision: 1, sceneEpoch: 0, contentEpoch: 0, generation: 'g1', project: 'p1',
  window: { tracks: { count: 2, bankSize: 16 }, scenes: { count: 4, bankSize: 16 } },
  ...over,
});
const ref = (sha: string, over: Partial<ClipSnapshotRef> = {}): ClipSnapshotRef => ({
  version: 'ghostnote-clip-snapshot/1', mark: mark(), channelId: 'track-a', row: 0,
  source: { domain: 'ghostnote-launcher-source/1', sha256: sha.repeat(64).slice(0, 64) }, ...over,
});
const cell = (pitch: number, at = 0, channel = 0): CellKey => ({ channel, pitch, cell: at });
const project = (hash: string) => (ids: ProjectionIds) => ({
  contentHash: hash.repeat(64).slice(0, 64), coverage: [],
  boundary: { plane: 'D23-1/512-cell' as const, channels: 16 as const, from: '0', to: '4' },
  document: { overlays: ids.overlays, ...ids.envelope },
});

function first(registry: IdentityRegistry, cells = [cell(60), cell(64, 512), cell(67, 1024)]) {
  return registry.acquire({ snapshot: ref('a'), cells, project: project('1') });
}

test('identity: a first acquisition mints one clip ID and one event ID for each cell', () => {
  const registry = new IdentityRegistry();
  const acquired = first(registry);
  assert.equal(acquired.outcome, 'new');
  assert.equal(acquired.minted, 3);
  assert.equal(new Set(acquired.entry.events.values()).size, 3);
  assert.match(acquired.entry.ref, /^gnb1\.[A-Za-z0-9_-]+$/);
  assert.ok(IdentityRegistry.isRefShape(acquired.entry.ref));
  assert.equal(registry.latestAt('track-a', 0), acquired.entry);
  assert.deepEqual(registry.lookup(acquired.entry.ref), { state: 'live', entry: acquired.entry });
});

test('identity: a current verdict keeps the ref and every ID, and does not project again', () => {
  const registry = new IdentityRegistry();
  const prior = first(registry).entry;
  let projected = 0;
  const again = registry.acquire({
    snapshot: ref('a', { mark: mark({ revision: 9 }) }), cells: [cell(60), cell(64, 512), cell(67, 1024)],
    prior: { entry: prior, verdict: 'current' }, project: (ids) => { projected += 1; return project('1')(ids); },
  });
  assert.equal(again.outcome, 'current');
  assert.equal(again.entry, prior);
  assert.equal(projected, 0);
  assert.throws(() => registry.acquire({ snapshot: ref('b'), cells: [cell(60)],
    prior: { entry: prior, verdict: 'current' }, project: project('2') }), /same source and the same cells/);
});

test('identity: stale keeps the clip ID and the ID of each unchanged cell; a moved cell gets a new ID', () => {
  const registry = new IdentityRegistry();
  const prior = first(registry).entry;
  const ids = (key: CellKey) => prior.events.get(cellKey(key));
  // A velocity, duration, mute, or expression edit keeps the cell: the same three keys.
  const velocity = registry.acquire({ snapshot: ref('b'), cells: [cell(60), cell(64, 512), cell(67, 1024)],
    prior: { entry: prior, verdict: 'stale' }, project: project('2') });
  assert.equal(velocity.outcome, 'stale');
  assert.equal(velocity.entry.clipId, prior.clipId);
  assert.notEqual(velocity.entry.ref, prior.ref);
  assert.equal(velocity.retained, 3);
  assert.deepEqual([...velocity.entry.events.values()], [...prior.events.values()]);
  // Pitch, onset, and channel edits move the cell: retire the old ID and mint at the new cell.
  const moved = registry.acquire({ snapshot: ref('c'), cells: [cell(62), cell(64, 768), cell(67, 1024, 1)],
    prior: { entry: velocity.entry, verdict: 'stale' }, project: project('3') });
  assert.equal(moved.retained, 0);
  assert.equal(moved.minted, 3);
  for (const id of moved.entry.events.values()) assert.ok(![...prior.events.values()].includes(id));
  // Deletion then insertion at the same cell between two reads is not visible (D23 boundary).
  const reinserted = registry.acquire({ snapshot: ref('d'), cells: [cell(60), cell(64, 512)],
    prior: { entry: prior, verdict: 'stale' }, project: project('4') });
  assert.equal(reinserted.entry.events.get(cellKey(cell(60))), ids(cell(60)));
  // The older refs stay live; the newest acquisition is the address default.
  assert.equal(registry.lookup(prior.ref).state, 'live');
  assert.equal(registry.latestAt('track-a', 0), reinserted.entry);
});

for (const verdict of ['identity-changed', 'absent', 'incomparable', 'uncovered'] as const) {
  test(`identity: ${verdict} retires every ref at the address and the next acquisition mints all IDs`, () => {
    const registry = new IdentityRegistry();
    const prior = first(registry).entry;
    const older = registry.acquire({ snapshot: ref('b'), cells: [cell(60)],
      prior: { entry: prior, verdict: 'stale' }, project: project('2') }).entry;
    const next = registry.acquire({ snapshot: ref('c'), cells: [cell(60), cell(64, 512)],
      prior: { entry: older, verdict }, project: project('3') });
    assert.equal(next.outcome, 'retired-and-new');
    assert.notEqual(next.entry.clipId, prior.clipId);
    assert.equal(next.retained, 0);
    assert.deepEqual(next.retired?.map((item) => item.reason), [verdict, verdict]);
    for (const old of [prior, older]) {
      const found = registry.lookup(old.ref);
      assert.equal(found.state, 'retired');
      assert.equal(found.state === 'retired' && found.retirement.reason, verdict);
    }
    assert.equal(registry.latestAt('track-a', 0), next.entry);
  });
}

test('identity: a sweep retires refs of another project, generation, or scene layout', () => {
  const registry = new IdentityRegistry();
  const a = first(registry).entry;
  assert.deepEqual(registry.sweep(mark({ revision: 5 })), []);
  assert.deepEqual(registry.sweep(mark({ sceneEpoch: 1 })).map((item) => item.reason), ['identity-changed']);
  assert.equal(registry.lookup(a.ref).state, 'retired');
  const b = first(registry).entry;
  assert.deepEqual(registry.sweep(mark({ project: 'p2' })).map((item) => item.reason), ['incomparable']);
  const c = first(registry).entry;
  assert.deepEqual(registry.sweep(mark({ generation: 'g2' })).map((item) => item.reason), ['incomparable']);
  for (const old of [b, c]) assert.equal(registry.lookup(old.ref).state, 'retired');
  assert.equal(registry.latestAt('track-a', 0), undefined);
});

test('identity: the registry is bounded; the least recently used ref retires as evicted', () => {
  assert.equal(REGISTRY_LIMIT, 256);
  const registry = new IdentityRegistry(2);
  const one = registry.acquire({ snapshot: ref('a', { row: 0 }), cells: [], project: project('1') }).entry;
  const two = registry.acquire({ snapshot: ref('b', { row: 1 }), cells: [], project: project('2') }).entry;
  registry.lookup(one.ref);
  const three = registry.acquire({ snapshot: ref('c', { row: 2 }), cells: [], project: project('3') }).entry;
  assert.equal(registry.size, 2);
  const evicted = registry.lookup(two.ref);
  assert.equal(evicted.state === 'retired' && evicted.retirement.reason, 'evicted');
  assert.equal(registry.lookup(one.ref).state, 'live');
  assert.equal(registry.lookup(three.ref).state, 'live');
  assert.deepEqual(registry.lookup('gnb1.unknown-ref'), { state: 'unknown' });
  assert.equal(IdentityRegistry.isRefShape('gcs1.abc'), false);
  assert.throws(() => new IdentityRegistry(0), /positive integer/);
});

test('identity: duplicate cells and a prior at another address refuse', () => {
  const registry = new IdentityRegistry();
  assert.throws(() => registry.acquire({ snapshot: ref('a'), cells: [cell(60), cell(60)], project: project('1') }),
    /one cell address/);
  const prior = first(registry).entry;
  assert.throws(() => registry.acquire({ snapshot: ref('b', { row: 1 }), cells: [],
    prior: { entry: prior, verdict: 'stale' }, project: project('2') }), /another address/);
});

test('identity: a verified write keeps the clip ID and takes event IDs from the candidate', () => {
  const registry = new IdentityRegistry();
  const prior = first(registry).entry;
  const moved = cell(62, 512);
  const ids = new Map([[cellKey(cell(60)), prior.events.get(cellKey(cell(60)))!],
    [cellKey(moved), prior.events.get(cellKey(cell(64, 512)))!], [cellKey(cell(70, 0)), 'n-new']]);
  const written = registry.recordWrite({
    snapshot: ref('b', { mark: mark({ revision: 2 }) }), cells: [cell(60), moved, cell(70, 0), cell(72, 0)],
    clipId: prior.clipId, ids, overlays: [], envelope: {}, project: project('2'),
  });
  assert.equal(written.outcome, 'written');
  assert.equal(written.entry.clipId, prior.clipId);
  assert.equal(written.retained, 3);
  assert.equal(written.minted, 1, 'a cell outside the candidate gets a new ID');
  assert.equal(written.entry.events.get(cellKey(moved)), prior.events.get(cellKey(cell(64, 512))));
  assert.equal(written.entry.events.get(cellKey(cell(70, 0))), 'n-new');
  assert.equal(registry.latestAt('track-a', 0), written.entry);
  assert.equal(registry.lookup(prior.ref).state, 'live', 'the older ref stays live; its next check is stale');
});
