/** Independent checks for the 8g5c allocation sweep. */
import assert from 'node:assert/strict';
import { publishedOccupancy } from './phase8g5b-slot-lib.js';
export type Wire = Record<string, unknown>;
export const ALLOCATION_MARKER = '8g5c-allocation-v1';
export const COUNTED_ALLOCATION_MARKER = '8g5c-counted-allocation-v2';
/** The allocation data format has its own revision. Build identity comes from probe info. */
export const ALLOCATION_STATS_REVISION = '8g5c-allocation-v1';
export const OWNED_PROJECT = 'New 8';
export const CAPACITIES = [0, 16, 64, 256, 512] as const;
export const sweepConfig = (capacity: number, counted = false): Wire => {
  assert(CAPACITIES.some(value => value === capacity), 'unknown sweep capacity');
  return { recordChars: 0, stamp: counted ? `8g5c-counted-${capacity}` : `8g5c-allocation-${capacity}`, tracks: 512,
    ...(counted ? { cacheTopologyCounted: true } : {}),
    cacheTopologyTracks: capacity, cacheLifecycleResearch: true, deliveryResearch: true,
    cacheShadowObservers: 2, cacheShadowSteps: 2048, fineSteps: 2048, contentFilter: 'ALL_CHANNELS' };
};
export function verifyAllocation(value: Wire, capacity: number, counted = false): void {
  assert(CAPACITIES.some(size => size === capacity));
  assert.equal(value.revision, ALLOCATION_STATS_REVISION);
  assert.equal(value.complete, false); assert.equal(value.eligible, false);
  assert.equal(value.flatBankTracks, 512); assert.equal(value.slotObservers, 512);
  assert.equal(value.slotHandles, 512 * 128);
  assert.equal(value.topologyAllocated, capacity > 0);
  if (capacity === 0) assert.equal(value.topology, undefined);
  else {
    const topology = value.topology as Wire;
    assert.equal(topology.maximumTracks, capacity);
    assert.equal(topology.banks, capacity + 1);
    assert.equal(topology.bankTrackHandles, counted ? 2 * capacity : (capacity + 1) * capacity);
    assert.equal(topology.parentTrackHandles, counted ? 0 : capacity);
    if (counted) assert.equal(topology.selectedRoute, 'counted-preorder-with-uuid-master');
    assert.equal(topology.stepDataObservers, 0);
    const allocation = topology.allocationMeasurement as Wire;
    assert(Number.isFinite(allocation.constructionMs) && Number(allocation.constructionMs) >= 0);
    verifyMemory(allocation.before as Wire); verifyMemory(allocation.after as Wire);
  }
  verifyMemory(value.jvmMemory as Wire);
}
export function verifyMemory(value: Wire): void {
  assert.equal(value.scope, 'shared-jvm'); assert.equal(value.forcedGc, false);
  for (const key of ['capturedEpochMs', 'usedBytes', 'committedBytes', 'maximumBytes'])
    assert(Number.isSafeInteger(value[key]) && Number(value[key]) >= 0, `invalid JVM value: ${key}`);
  assert(Number(value.usedBytes) <= Number(value.committedBytes));
  assert(Number(value.committedBytes) <= Number(value.maximumBytes));
}
/** Parse cumulative process CPU time from macOS ps. RSS is in KiB. */
export function cpuSeconds(time: string): number {
  const parts = time.split(':').map(Number);
  assert(parts.length >= 2 && parts.length <= 3 && parts.every(value => Number.isFinite(value) && value >= 0));
  return parts.reduce((seconds, value) => seconds * 60 + value, 0);
}
export function processes(output: string): Wire[] {
  return output.split('\n').filter(line => /Bitwig/i.test(line)).map(line => {
    const match = line.match(/^\s*(\d+)\s+(\d+)\s+(\d+)\s+([\d.]+)\s+(\S+)\s+(.+)$/);
    assert(match, `unrecognized process row: ${line}`);
    return { pid: Number(match[1]), ppid: Number(match[2]), rssKiB: Number(match[3]),
      lifetimeCpuPercent: Number(match[4]), cumulativeCpuSeconds: cpuSeconds(match[5]!), executable: match[6] };
  });
}
/** Calculate CPU use only when the same process appears at both endpoints. One core is 100%. */
export function intervalCpu(first: Wire[], second: Wire[], elapsedMs: number): Wire[] {
  assert(Number.isFinite(elapsedMs) && elapsedMs > 0);
  return second.map(row => {
    const prior = first.find(value => value.pid === row.pid && value.executable === row.executable);
    if (!prior) return { pid: row.pid, available: false, reason: 'process-changed' };
    const delta = Number(row.cumulativeCpuSeconds) - Number(prior.cumulativeCpuSeconds);
    assert(delta >= 0);
    return { pid: row.pid, available: true, cpuPercent: delta / (elapsedMs / 1000) * 100,
      beforeRssKiB: prior.rssKiB, afterRssKiB: row.rssKiB };
  });
}

/** Recompute an allocation sample from its raw values. A sample does not accept scale. */
export function verifyAllocationSample(report: Wire, prior: Wire, fixtureAnchor?: Wire): void {
  assert.equal(report.schema, 'phase8g5c-allocation-v1'); assert.equal(report.error, undefined);
  assert.equal(report.complete, false); assert.equal(report.eligible, false);
  assert.equal(report.project, OWNED_PROJECT); assert.equal(report.coldScope, 'fresh-controller-in-shared-jvm');
  const counted = report.allocationRoute === 'counted';
  assert(report.allocationRoute === undefined || counted, 'unknown allocation route');
  if (counted || report.instrumentationRevision !== undefined)
    assert.equal(report.instrumentationRevision, counted ? COUNTED_ALLOCATION_MARKER : ALLOCATION_MARKER);
  const capacity = Number(report.capacity);
  verifyAllocation(report.before as Wire, capacity, counted); verifyAllocation(report.after as Wire, capacity, counted);
  const hello = report.hello as Wire, stats = report.stats as Wire;
  assert.equal(hello.runtimeProfile, 'phase-8-probe-v1'); assert.equal(stats.runtimeProfile, hello.runtimeProfile);
  assert.equal(hello.methodCount, 97); assert.equal(hello.methodsHash, 'f03f19414f40e3d3');
  assert(Number(stats.initEpochMs) > Number((prior.stats as Wire).initEpochMs));
  assert(Number(stats.initEpochMs) >= Number(report.archiveMtimeMs));
  assert.match(String(report.archiveSha256), /^[a-f0-9]{64}$/);
  const config = stats.config as Wire;
  for (const [key, value] of Object.entries(sweepConfig(capacity, counted))) if (key !== 'recordChars') assert.equal(config[key], value, key);
  assert.equal(config.cacheTopologyCounted ?? false, counted);
  for (const key of ['initMicros', 'rigConstructMicros']) assert(Number.isFinite(stats[key]) && Number(stats[key]) >= 0);
  const tracks = report.tracks as Wire, rows = tracks.tracks as Wire[];
  assert.equal(tracks.count, rows.length); assert.equal(tracks.count, tracks.itemCount); assert.equal(tracks.bankSize, 512);
  assert(rows.length <= 512); assert.equal(new Set(rows.map(row => row.channelId)).size, rows.length);
  rows.forEach((row, index) => {
    assert.equal(row.index, index); assert.match(String(row.channelId), /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i);
  });
  const first = report.processBefore as Wire, second = report.processAfter as Wire;
  const elapsed = Number(second.capturedEpochMs) - Number(first.capturedEpochMs);
  assert(elapsed >= 5000); assert.equal(report.idleIntervalMs, elapsed);
  assert.deepEqual(report.idleCpu, intervalCpu(first.rows as Wire[], second.rows as Wire[], elapsed));
  assert((first.rows as Wire[]).length > 0);
  if (capacity > 0) {
    const topology = report.topology as Wire;
    assert.equal(topology.maximumTracks, capacity); assert.equal(topology.complete, false); assert.equal(topology.eligible, false);
    assert.equal(topology.membershipComplete, rows.length <= capacity);
    assert(Number.isFinite(topology.readMs) && Number(topology.readMs) >= 0);
  } else assert.equal(report.topology, undefined);
  if (report.fixture === 'empty') {
    assert.equal(rows.length, 4); assert.deepEqual(rows.map(row => row.type), ['Instrument', 'Audio', 'Effect', 'Master']);
    assert.equal((report.scenes as Wire).sceneCount, 8);
    if (capacity > 0) verifyEmptyTopology(report.topology as Wire, tracks, counted);
  } else {
    assert.equal(report.fixture, 'populated'); assert(fixtureAnchor, 'missing populated fixture oracle');
    assert.equal(capacity, 512); assert.equal(counted, true);
    assert.equal(fixtureAnchor.schema, 'phase8g5c-populated-anchor-v1');
    assert.deepEqual(tracks, fixtureAnchor.tracks); assert.equal(rows.length, 512);
    assert.equal((report.scenes as Wire).sceneCount, 8);
    verifyEmptyTopology(report.topology as Wire, tracks, true);
    verifyPopulatedScan(report.scanBefore as Wire); verifyPopulatedScan(report.scanAfter as Wire);
    const inventory = report.inventory as Wire, rebuild = inventory.inventoryRebuild as Wire;
    assert.equal(inventory.complete, false); assert.equal(inventory.eligible, false);
    assert.deepEqual(publishedOccupancy(inventory), fixtureAnchor.expectedOccupancy);
    assert.equal(rebuild.totalCells, 4096); assert.equal(rebuild.enumeratedCells, 4096);
    assert.equal(rebuild.presentClips, 6); assert.equal(rebuild.registryPublished, true);
    assert.deepEqual(report.tracksAfter, tracks);
    assert.equal((report.statsAfter as Wire).initEpochMs, stats.initEpochMs);
  }
}

function verifyPopulatedScan(scan: Wire): void {
  for (const key of ['existing', 'withChannelId', 'itemCount', 'bankSize']) assert.equal(scan[key], 512);
  assert.equal(scan.sceneCount, 8); assert.equal(scan.slotsWithContent, 6);
}
/** Pin the populated UUID and slot oracle before the first controller replacement. */
export function verifyPopulatedAnchor(report: Wire, boundary: Wire): void {
  assert.equal(report.schema, 'phase8g5c-populated-anchor-v1'); assert.equal(report.project, OWNED_PROJECT);
  assert.equal(report.complete, false); assert.equal(report.eligible, false); assert.equal(report.error, undefined);
  assert.equal(boundary.schema, 'phase8g5c-512-result-v1'); assert.equal(boundary.error, undefined);
  assert.deepEqual(report.tracks, boundary.tracks); assert.deepEqual(report.tracksAfter, report.tracks);
  assert.equal((report.tracks as Wire).itemCount, 512);
  assert.deepEqual(report.expectedOccupancy, publishedOccupancy((boundary.publication as Wire).list as Wire));
  assert.equal((report.expectedOccupancy as unknown[]).length, 6);
  verifyPopulatedScan(report.scan as Wire); verifyAllocation(report.allocation as Wire, 512, true);
  verifyEmptyTopology(report.topology as Wire, report.tracks as Wire, true);
  assert.deepEqual(publishedOccupancy(report.inventory as Wire), report.expectedOccupancy);
  assert.equal(report.marker, COUNTED_ALLOCATION_MARKER);
  assert.match(String(report.archiveSha256), /^[a-f0-9]{64}$/);
  assert.match(String(report.configSha256), /^[a-f0-9]{64}$/);
  assert(Number(report.archiveMtimeMs) > Number((report.stats as Wire).initEpochMs));
}

/** The empty fixture has four known roots. A passing flag cannot replace its UUID oracle. */
export function verifyEmptyTopology(topology: Wire, tracks: Wire, counted = false): void {
  assert.equal(topology.membershipComplete, true); assert.equal(topology.coherent, true);
  assert.equal(topology.groupMembershipProved, true); assert.equal(topology.wrapperDeletionAllowed, false);
  assert.equal(topology.hostInputOrderingProved, false); assert.equal(topology.researchOnly, true);
  assert.equal(topology.topologyControlRevision, counted ? '8g5c-counted-preorder-v1' : '8g5a-uuid-group-master-v1');
  assert.equal(topology.oracle, counted ? 'counted-preorder-with-uuid-master' : 'direct-child-banks-with-uuid-group-master');
  assert.equal(topology.callbacksChangedDuringRead, false);
  assert.equal(topology.sequenceBeforeRead, topology.sequenceAfterRead);
  assert.equal(topology.readError, undefined);
  const expected = (tracks.tracks as Wire[]).map(row => ({ index: row.index, channelId: row.channelId,
    name: row.name, position: row.position, isGroup: false, expanded: false }));
  const ids = expected.map(row => row.channelId), tree = topology.tree as Wire;
  assert.deepEqual(tree.flat, expected); assert.deepEqual(tree.roots, { count: ids.length, offset: 0, ids });
  assert.deepEqual(tree.children, {});
  const candidates = topology.candidates as Wire;
  assert.equal(candidates.coherent, true); assert.equal(candidates.routeProved, false);
  assert.equal(candidates.sequenceBeforeRead, candidates.sequenceAfterRead);
  assert.deepEqual(candidates.first, candidates.second);
  const raw = candidates.first as Wire;
  for (const key of ['flat', 'roots']) {
    const bank = raw[key] as Wire;
    assert.equal(bank.count, ids.length); assert.equal(bank.offset, 0); assert.deepEqual(bank.ids, ids);
    assert.deepEqual(bank.rows, expected);
  }
  assert.deepEqual(raw.children, {});
  if (counted) assert.deepEqual(raw.parents, {});
}
