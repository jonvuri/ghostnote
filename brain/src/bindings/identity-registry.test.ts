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
  document: {
    clips: ids.envelope.provenance === undefined ? [] : [{ id: ids.clipId, length: '4', provenance: ids.envelope.provenance }],
    ...(ids.envelope.meta === undefined ? {} : { meta: ids.envelope.meta }),
    ...(ids.envelope.extensions === undefined ? {} : { extensions: ids.envelope.extensions }),
  },
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
  assert.equal(again.entry.ref, prior.ref);
  assert.equal(again.entry.events, prior.events);
  assert.equal(again.entry.contentHash, prior.contentHash);
  // B18: the ref's change window restarts at the current acquisition.
  assert.equal(again.entry.snapshot.mark.revision, 9);
  assert.equal(registry.latestAt(prior.snapshot.channelId, prior.snapshot.row), again.entry);
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
    clipId: prior.clipId, ids, envelope: {}, project: project('2'),
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

test('D73: a kept clip ID carries the stored provenance and envelope; a new clip ID starts without them', () => {
  const registry = new IdentityRegistry();
  const prior = first(registry);
  const provenance = { sources: [{ path: '/music/source.mid', sha256: 'f'.repeat(64) }] };
  const written = registry.recordWrite({
    snapshot: ref('b'), cells: [cell(60), cell(64, 512), cell(67, 1024)], clipId: prior.entry.clipId,
    ids: prior.entry.events, envelope: { provenance, meta: { title: 'kept' } }, project: project('2'),
  });
  assert.deepEqual(written.entry.envelope, { provenance, meta: { title: 'kept' } });
  // A human edit (stale verdict) keeps the clip ID, so the next projection receives the same envelope.
  let seen: ProjectionIds | undefined;
  const stale = registry.acquire({ snapshot: ref('c'), cells: [cell(60), cell(65, 512)],
    prior: { entry: written.entry, verdict: 'stale' }, project: (ids) => { seen = ids; return project('3')(ids); } });
  assert.equal(stale.outcome, 'stale');
  assert.deepEqual(seen!.envelope, { provenance, meta: { title: 'kept' } });
  assert.deepEqual(stale.entry.envelope.provenance, provenance);
  // A retiring verdict mints a new clip ID with no envelope.
  const fresh = registry.acquire({ snapshot: ref('d'), cells: [cell(60)],
    prior: { entry: stale.entry, verdict: 'identity-changed' }, project: (ids) => { seen = ids; return project('4')(ids); } });
  assert.equal(fresh.outcome, 'retired-and-new');
  assert.deepEqual(seen!.envelope, {});
});

const CELLS = [cell(60), cell(64, 512), cell(67, 1024)];
const at = (row: number) => ({ channelId: 'track-a', row });

/** A registry with one written entry at row 0 that holds provenance. */
function withHeld() {
  const registry = new IdentityRegistry();
  const prior = first(registry);
  const provenance = { sources: [{ path: '/music/source.mid' }] };
  const written = registry.recordWrite({ snapshot: ref('b'), cells: CELLS, clipId: prior.entry.clipId,
    ids: prior.entry.events, envelope: { provenance }, project: project('2') });
  return { registry, written: written.entry, provenance };
}

test('B19: a moved clip that equals its source keeps the clip ID, event IDs, and envelope (moved)', () => {
  const { registry, written, provenance } = withHeld();
  assert.equal(registry.carry('move', [{ source: at(0), destination: at(2) }], mark()), 1);
  assert.equal(registry.lookup(written.ref).state, 'retired', 'the source ref retires');
  assert.equal(registry.latestAt('track-a', 0), undefined);
  const moved = registry.acquire({ snapshot: ref('b', { row: 2 }), cells: CELLS, project: project('2') });
  assert.equal(moved.outcome, 'moved');
  assert.equal(moved.entry.clipId, written.clipId);
  assert.deepEqual([...moved.entry.events], [...written.events]);
  assert.deepEqual(moved.entry.envelope, { provenance });
  assert.equal(moved.minted, 0);
  // The carry is used once: the next read is an ordinary acquisition.
  assert.equal(registry.acquire({ snapshot: ref('b', { row: 2 }), cells: CELLS,
    prior: { entry: moved.entry, verdict: 'current' }, project: project('2') }).outcome, 'current');
});

test('B19: a copy carries the envelope with new IDs; a copy of a clip without one carries nothing', () => {
  const { registry, written, provenance } = withHeld();
  assert.equal(registry.carry('copy', [{ source: at(0), destination: at(3) }], mark()), 1);
  assert.equal(registry.lookup(written.ref).state, 'live', 'the source stays');
  let seen: ProjectionIds | undefined;
  const copied = registry.acquire({ snapshot: ref('b', { row: 3 }), cells: CELLS,
    project: (ids) => { seen = ids; return project('2')(ids); } });
  assert.equal(copied.outcome, 'new');
  assert.notEqual(copied.entry.clipId, written.clipId);
  assert.ok([...copied.entry.events.values()].every((id) => ![...written.events.values()].includes(id)));
  assert.deepEqual(seen!.envelope, { provenance });
  assert.deepEqual(copied.entry.envelope, { provenance });

  const plain = new IdentityRegistry();
  first(plain);
  assert.equal(plain.carry('copy', [{ source: at(0), destination: at(3) }], mark()), 0);
});

test('B19: a carry applies only to the same document in the same domain, once', () => {
  // Another document at the destination (the source changed before the copy): new IDs, no envelope.
  const changed = withHeld();
  changed.registry.carry('move', [{ source: at(0), destination: at(2) }], mark());
  const other = changed.registry.acquire({ snapshot: ref('x', { row: 2 }), cells: CELLS, project: project('9') });
  assert.equal(other.outcome, 'new');
  assert.notEqual(other.entry.clipId, changed.written.clipId);
  assert.deepEqual(other.entry.envelope, {});
  // Other cells refuse the carry before any projection with the source IDs.
  const cells = withHeld();
  cells.registry.carry('copy', [{ source: at(0), destination: at(2) }], mark());
  assert.deepEqual(cells.registry.acquire({ snapshot: ref('b', { row: 2 }), cells: [cell(60)], project: project('2') })
    .entry.envelope, {});
  // A scene layout change, an empty read, or a write at the destination drops the carry.
  const swept = withHeld();
  swept.registry.carry('copy', [{ source: at(0), destination: at(2) }], mark());
  swept.registry.sweep(mark({ sceneEpoch: 1 }));
  assert.deepEqual(swept.registry.acquire({ snapshot: ref('b', { row: 2, mark: mark({ sceneEpoch: 1 }) }), cells: CELLS,
    project: project('2') }).entry.envelope, {});
  const emptied = withHeld();
  emptied.registry.carry('copy', [{ source: at(0), destination: at(2) }], mark());
  emptied.registry.emptied(at(2));
  assert.deepEqual(emptied.registry.acquire({ snapshot: ref('b', { row: 2 }), cells: CELLS, project: project('2') })
    .entry.envelope, {});
  const rewritten = withHeld();
  rewritten.registry.carry('copy', [{ source: at(0), destination: at(2) }], mark());
  const add = rewritten.registry.recordWrite({ snapshot: ref('e', { row: 2 }), cells: [cell(72)], clipId: 'cz',
    ids: new Map(), envelope: {}, project: project('5') });
  const reread = rewritten.registry.acquire({ snapshot: ref('b', { row: 2 }), cells: CELLS,
    prior: { entry: add.entry, verdict: 'identity-changed' }, project: project('2') });
  assert.deepEqual(reread.entry.envelope, {});
});

test('B19: an overlapping move carries each clip to its own destination', () => {
  const registry = new IdentityRegistry();
  const a = registry.acquire({ snapshot: ref('a', { row: 1 }), cells: [cell(60)], project: project('1') });
  const b = registry.acquire({ snapshot: ref('b', { row: 2 }), cells: [cell(62)], project: project('2') });
  assert.equal(registry.carry('move', [{ source: at(2), destination: at(3) }, { source: at(1), destination: at(2) }],
    mark()), 2);
  const atTwo = registry.acquire({ snapshot: ref('a', { row: 2 }), cells: [cell(60)], project: project('1') });
  const atThree = registry.acquire({ snapshot: ref('b', { row: 3 }), cells: [cell(62)], project: project('2') });
  assert.deepEqual([atTwo.outcome, atTwo.entry.clipId], ['moved', a.entry.clipId]);
  assert.deepEqual([atThree.outcome, atThree.entry.clipId], ['moved', b.entry.clipId]);
});
