import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { CAPACITIES, COUNTED_ALLOCATION_MARKER, cpuSeconds, intervalCpu, processes, sweepConfig, verifyAllocation, verifyAllocationSample, verifyEmptyTopology, verifyPopulatedAnchor, type Wire } from './phase8g5c-storage-lib.js';
import { gunzipSync } from 'node:zlib';
const memory = { capturedEpochMs: 1, usedBytes: 100, committedBytes: 200, maximumBytes: 300, scope: 'shared-jvm', forcedGc: false };
const allocation = (capacity: number): Wire => ({ revision: '8g5c-allocation-v1', complete: false, eligible: false,
  flatBankTracks: 512, slotObservers: 512, slotHandles: 65536, topologyAllocated: capacity > 0, jvmMemory: memory,
  ...(capacity === 0 ? {} : { topology: { maximumTracks: capacity, banks: capacity + 1,
    bankTrackHandles: (capacity + 1) * capacity, parentTrackHandles: capacity, stepDataObservers: 0,
    allocationMeasurement: { constructionMs: 1, before: memory, after: memory } } }) });
test('allocation capacities keep the other rig settings equal', () => {
  const reference = { ...sweepConfig(0) }; delete reference.stamp; delete reference.cacheTopologyTracks;
  for (const capacity of CAPACITIES) {
    verifyAllocation(allocation(capacity), capacity);
    const actual = { ...sweepConfig(capacity) }; delete actual.stamp; delete actual.cacheTopologyTracks;
    assert.deepEqual(actual, reference);
  }
  assert.throws(() => sweepConfig(128));
});
test('enabled empty topology must equal the fixture UUIDs and order', () => {
  const report = JSON.parse(readFileSync(new URL('empty-16-1.json', root), 'utf8')) as Wire;
  const prior = JSON.parse(readFileSync(new URL('empty-0-3.json', root), 'utf8')) as Wire;
  verifyAllocationSample(report, prior);
  for (const mutate of [
    (value: Wire) => { const tree = value.tree as Wire; (tree.roots as Wire).ids = []; },
    (value: Wire) => { const tree = value.tree as Wire; tree.flat = (tree.flat as Wire[]).slice().reverse(); },
    (value: Wire) => { const tree = value.tree as Wire; tree.children = { foreign: { count: 0, offset: 0, ids: [] } }; },
    (value: Wire) => { value.sequenceAfterRead = Number(value.sequenceBeforeRead) + 1; },
    (value: Wire) => { (value.candidates as Wire).coherent = false; },
    (value: Wire) => { value.hostInputOrderingProved = true; },
  ]) {
    const topology = structuredClone(report.topology as Wire); mutate(topology);
    assert.throws(() => verifyEmptyTopology(topology, report.tracks as Wire));
  }
});
test('allocation checks refuse wrong counts and memory claims', () => {
  for (const [key, value] of Object.entries({ revision: 'old', eligible: true, flatBankTracks: 256, slotObservers: 256, slotHandles: 32768 }))
    assert.throws(() => verifyAllocation({ ...allocation(512), [key]: value }, 512));
  for (const [key, value] of Object.entries({ usedBytes: 400, maximumBytes: 100, scope: 'extension', forcedGc: true }))
    assert.throws(() => verifyAllocation({ ...allocation(0), jvmMemory: { ...memory, [key]: value } }, 0));
  assert.throws(() => verifyAllocation({ ...allocation(0), topology: {} }, 0));
  const value = allocation(512); (value.topology as Wire).bankTrackHandles = 512;
  assert.throws(() => verifyAllocation(value, 512));
});
test('counted route has separate config, marker, handles, and empty-tree checks', () => {
  const report = JSON.parse(readFileSync(new URL('empty-16-1.json', root), 'utf8')) as Wire;
  const prior = JSON.parse(readFileSync(new URL('empty-0-3.json', root), 'utf8')) as Wire;
  report.allocationRoute = 'counted';
  report.instrumentationRevision = COUNTED_ALLOCATION_MARKER;
  (report.stats as Wire).config = { ...(report.stats as Wire).config as Wire, ...sweepConfig(16, true) };
  for (const key of ['before', 'after']) {
    const value = report[key] as Wire;
    const resources = value.topology as Wire;
    resources.bankTrackHandles = 32; resources.parentTrackHandles = 0;
    resources.selectedRoute = 'counted-preorder-with-uuid-master';
  }
  const topology = report.topology as Wire;
  topology.topologyControlRevision = '8g5c-counted-preorder-v1'; topology.oracle = 'counted-preorder-with-uuid-master';
  const candidates = topology.candidates as Wire;
  candidates.resources = (report.before as Wire).topology;
  for (const key of ['first', 'second']) (candidates[key] as Wire).parents = {};
  verifyAllocationSample(report, prior);
  for (const mutate of [
    (value: Wire) => { delete value.allocationRoute; },
    (value: Wire) => { ((value.stats as Wire).config as Wire).cacheTopologyCounted = false; },
    (value: Wire) => { value.instrumentationRevision = '8g5c-allocation-v1'; },
    (value: Wire) => { delete value.instrumentationRevision; },
    (value: Wire) => { (value.before as Wire).revision = COUNTED_ALLOCATION_MARKER; },
    (value: Wire) => { ((value.before as Wire).topology as Wire).bankTrackHandles = 272; },
    (value: Wire) => { (value.topology as Wire).oracle = 'direct-child-banks-with-uuid-group-master'; },
  ]) {
    const changed = structuredClone(report); mutate(changed); assert.throws(() => verifyAllocationSample(changed, prior));
  }
  for (const capacity of CAPACITIES) {
    const value = allocation(capacity);
    if (capacity > 0) Object.assign(value.topology as Wire,
      { bankTrackHandles: 2 * capacity, parentTrackHandles: 0, selectedRoute: 'counted-preorder-with-uuid-master' });
    verifyAllocation(value, capacity, true);
  }
});
test('process CPU uses elapsed cumulative time, with explicit process changes', () => {
  assert.equal(cpuSeconds('1:02.50'), 62.5); assert.equal(cpuSeconds('1:02:03'), 3723);
  const first = processes(' 10 1 100 90.0 1:02.50 /Applications/Bitwig Studio.app/Contents/MacOS/BitwigStudio\n 11 1 50 1.0 0:00.00 other');
  const second = [{ ...first[0], cumulativeCpuSeconds: 63, rssKiB: 110 }, { ...first[0], pid: 12 }];
  assert.deepEqual(intervalCpu(first, second, 5000), [
    { pid: 10, available: true, cpuPercent: 10, beforeRssKiB: 100, afterRssKiB: 110 },
    { pid: 12, available: false, reason: 'process-changed' },
  ]);
  assert.throws(() => processes('Bitwig invalid'));
  assert.throws(() => intervalCpu(first, second, 0));
});
const root = new URL('../../../context/evidence/data/phase8g5c-storage/', import.meta.url);
test('the populated reload oracle requires the complete census and six published slots', () => {
  const anchor = JSON.parse(readFileSync(new URL('populated-anchor.json', root), 'utf8')) as Wire;
  const boundary = JSON.parse(gunzipSync(readFileSync(new URL('512-result.json.gz', root))).toString()) as Wire;
  verifyPopulatedAnchor(anchor, boundary);
  for (const mutate of [
    (value: Wire) => { (value.tracks as Wire).itemCount = 513; },
    (value: Wire) => { value.expectedOccupancy = []; },
    (value: Wire) => { (value.scan as Wire).slotsWithContent = 4; },
    (value: Wire) => { value.archiveMtimeMs = (value.stats as Wire).initEpochMs; },
  ]) { const changed = structuredClone(anchor); mutate(changed); assert.throws(() => verifyPopulatedAnchor(changed, boundary)); }
  const sample = JSON.parse(readFileSync(new URL('counted-empty-512-1.json', root), 'utf8')) as Wire;
  sample.fixture = 'populated'; assert.throws(() => verifyAllocationSample(sample, anchor));
});
test('a populated sample requires a fresh initialization and the independent fixture oracle', () => {
  const anchor = JSON.parse(readFileSync(new URL('populated-anchor.json', root), 'utf8')) as Wire;
  const sample = JSON.parse(readFileSync(new URL('counted-empty-512-1.json', root), 'utf8')) as Wire;
  sample.fixture = 'populated'; sample.tracks = anchor.tracks; sample.tracksAfter = anchor.tracks;
  sample.topology = anchor.topology; sample.scanBefore = anchor.scan; sample.scanAfter = anchor.scan;
  sample.inventory = anchor.inventory; sample.archiveMtimeMs = anchor.archiveMtimeMs;
  (sample.stats as Wire).initEpochMs = Number(anchor.archiveMtimeMs) + 1;
  sample.statsAfter = sample.stats;
  verifyAllocationSample(sample, anchor, anchor);
  for (const mutate of [
    (value: Wire) => { (value.stats as Wire).initEpochMs = (anchor.stats as Wire).initEpochMs; },
    (value: Wire) => { (value.scanAfter as Wire).slotsWithContent = 4; },
    (value: Wire) => { (value.inventory as Wire).occupancyAdmitted = false; },
    (value: Wire) => { ((value.inventory as Wire).inventoryRebuild as Wire).enumeratedCells = 4095; },
    (value: Wire) => { ((value.tracks as Wire).tracks as Wire[])[0]!.channelId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'; },
  ]) { const changed = structuredClone(sample); mutate(changed); assert.throws(() => verifyAllocationSample(changed, anchor, anchor)); }
});
test('the live control sample recomputes; false freshness, counts, and CPU refuse', () => {
  const report = JSON.parse(readFileSync(new URL('empty-0-1.json', root), 'utf8')) as Wire;
  const prior = JSON.parse(readFileSync(new URL('entry.json', root), 'utf8')) as Wire;
  verifyAllocationSample(report, prior);
  const second = JSON.parse(readFileSync(new URL('empty-0-2.json', root), 'utf8')) as Wire;
  verifyAllocationSample(second, report);
  assert.deepEqual(second.tracks, report.tracks);
  assert.deepEqual((second.stats as Wire).config, (report.stats as Wire).config);
  for (const mutate of [
    (value: Wire) => { value.project = 'New 3'; },
    (value: Wire) => { value.eligible = true; },
    (value: Wire) => { (value.stats as Wire).initEpochMs = (prior.stats as Wire).initEpochMs; },
    (value: Wire) => { value.archiveMtimeMs = Number((value.stats as Wire).initEpochMs) + 1; },
    (value: Wire) => { (value.tracks as Wire).itemCount = 513; },
    (value: Wire) => { value.idleCpu = []; },
    (value: Wire) => { value.idleIntervalMs = 1; },
    (value: Wire) => { ((value.stats as Wire).config as Wire).tracks = 256; },
  ]) {
    const changed = structuredClone(report); mutate(changed); assert.throws(() => verifyAllocationSample(changed, prior));
  }
});
