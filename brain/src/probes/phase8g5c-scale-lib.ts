/** Check the owned flat fixture and the UUID delta for each track creation. */
import assert from 'node:assert/strict';
import { COUNTED_ALLOCATION_MARKER, OWNED_PROJECT, intervalCpu, verifyAllocation, type Wire } from './phase8g5c-storage-lib.js';
import { independentNotes, verifySeed, verifyComparison, noPayload } from './phase8g4-native-lib.js';
import type { GroupOracle } from './phase8g5a-group-lib.js';
import { publishedOccupancy, scanOccupancy } from './phase8g5b-slot-lib.js';

export interface TrackRow { index: number; name: string; position: number; type: string; channelId: string }
export function fullTracks(value: Wire): TrackRow[] {
  const rows = value.tracks as TrackRow[];
  assert(Array.isArray(rows)); assert.equal(value.bankSize, 512);
  assert.equal(value.count, rows.length); assert.equal(value.itemCount, rows.length);
  assert(rows.length >= 4 && rows.length <= 512, 'incomplete fixture window');
  assert.equal(new Set(rows.map(row => row.channelId)).size, rows.length);
  rows.forEach((row, index) => {
    assert.equal(row.index, index);
    assert.match(row.channelId, /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i);
    assert.equal(typeof row.name, 'string'); assert(Number.isInteger(row.position));
    assert(['Instrument', 'Audio', 'Effect', 'Master', 'Group'].includes(row.type));
  });
  return rows;
}
/** Derive the wide tree from the declared native operation and one new census UUID. */
export function wideOracle(population: Wire, census: Wire): GroupOracle {
  const before = fullTracks(population.after as Wire), after = fullTracks(census), known = new Set(before.map(row => row.channelId));
  assert.equal(after.length, before.length + 1);
  const added = after.filter(row => !known.has(row.channelId)); assert.equal(added.length, 1);
  const group = added[0]!; assert.equal(group.type, 'Group'); assert.equal(group.name, 'gn-8g5c-wide'); assert.equal(group.index, 0);
  const retained = after.filter(row => known.has(row.channelId));
  assert.deepEqual(retained.map(row => row.channelId), before.map(row => row.channelId));
  retained.forEach((row, index) => { assert.equal(row.name, before[index]!.name); assert.equal(row.type, before[index]!.type); });
  const base = before.slice(0, 256); assert(base.every(row => ['Instrument', 'Audio'].includes(row.type)));
  assert.equal(before[256]!.type, 'Effect'); assert.equal(before[257]!.type, 'Master');
  return { project: OWNED_PROJECT, masterId: before[257]!.channelId,
    roots: [group.channelId, before[256]!.channelId, before[257]!.channelId],
    children: { [group.channelId]: base.map(row => row.channelId) }, expanded: { [group.channelId]: true },
    flatOrder: [group.channelId, ...before.map(row => row.channelId)] };
}
/** Check counted reads against an external closed forest, including every UUID master witness. */
export function verifyCountedScale(topology: Wire, census: Wire, oracle: GroupOracle): void {
  const rows = fullTracks(census), ids = rows.map(row => row.channelId), groups = Object.keys(oracle.children).sort();
  assert.equal(oracle.project, OWNED_PROJECT); assert.deepEqual(ids, oracle.flatOrder);
  assert.deepEqual(groups, rows.filter(row => row.type === 'Group').map(row => row.channelId).sort());
  assert.deepEqual(Object.keys(oracle.expanded).sort(), groups);
  assert.equal(rows.find(row => row.type === 'Master')!.channelId, oracle.masterId);
  const visited = new Set<string>(), order: string[] = [];
  const visit = (id: string): void => {
    assert(ids.includes(id) && !visited.has(id), 'foreign, duplicate, or cyclic oracle UUID'); visited.add(id); order.push(id);
    for (const child of oracle.children[id] ?? []) visit(child);
  };
  oracle.roots.forEach(visit); assert.deepEqual(order, ids);
  assert.equal(topology.complete, false); assert.equal(topology.eligible, false); assert.equal(topology.researchOnly, true);
  assert.equal(topology.membershipComplete, true); assert.equal(topology.coherent, true); assert.equal(topology.groupMembershipProved, true);
  assert.equal(topology.topologyControlRevision, '8g5c-counted-preorder-v1'); assert.equal(topology.oracle, 'counted-preorder-with-uuid-master');
  assert.equal(topology.maximumTracks, 512); assert.equal(topology.hostInputOrderingProved, false); assert.equal(topology.wrapperDeletionAllowed, false);
  assert.equal(topology.readError, undefined); assert.equal(topology.callbacksChangedDuringRead, false);
  assert.equal(topology.sequenceBeforeRead, topology.sequenceAfterRead);
  const candidate = topology.candidates as Wire;
  assert.equal(candidate.coherent, true); assert.equal(candidate.readError, undefined); assert.equal(candidate.routeProved, false);
  assert.equal(candidate.sequenceBeforeRead, candidate.sequenceAfterRead); assert.deepEqual(candidate.first, candidate.second);
  const raw = candidate.first as Wire; assert.deepEqual(raw.parents, {});
  for (const [key, expected] of [['flat', ids], ['roots', oracle.roots]] as const) {
    const bank = raw[key] as Wire, bankRows = bank.rows as Wire[];
    assert.equal(bank.offset, 0); assert.equal(bank.count, expected.length); assert.deepEqual(bank.ids, expected);
    assert.equal(bankRows.length, expected.length);
    bankRows.forEach((row, index) => {
      const id = String(row.channelId); assert.equal(row.index, index); assert.equal(id, expected[index]);
      assert.equal(row.isGroup, groups.includes(id)); assert.equal(row.expanded, oracle.expanded[id] ?? false);
      assert.equal(row.name, rows.find(track => track.channelId === id)!.name);
      if (key === 'flat') assert.equal(row.position, rows[index]!.position);
    });
  }
  const counts = raw.children as Wire; assert.deepEqual(Object.keys(counts).sort(), groups);
  for (const group of groups) {
    const count = counts[group] as Wire, master = count.master as Wire;
    assert.equal(count.count, oracle.children[group]!.length + 1); assert.equal(count.offset, Number(count.count) - 1);
    assert.equal(count.exists, true); assert.equal(master.index, 0); assert.equal(master.channelId, group);
    assert.equal(master.isGroup, false); assert.equal(master.expanded, false);
  }
  const tree = topology.tree as Wire; assert.deepEqual(tree.flat, (raw.flat as Wire).rows);
  assert.deepEqual((tree.roots as Wire).ids, oracle.roots); const children = tree.children as Wire;
  assert.deepEqual(Object.keys(children).sort(), groups);
  for (const group of groups) {
    const bank = children[group] as Wire; assert.equal(bank.offset, 0); assert.equal(bank.count, oracle.children[group]!.length);
    assert.deepEqual(bank.ids, oracle.children[group]);
  }
}
export function verifyWideFirst(report: Wire, arm: Wire, population: Wire): GroupOracle {
  assert.equal(report.schema, 'phase8g5c-wide-first-read-v1'); assert.equal(report.project, OWNED_PROJECT);
  assert.equal(report.complete, false); assert.equal(report.eligible, false);
  const declaration = report.declaration as Wire; assert.equal(declaration.operatorConfirmed, true);
  assert.equal(declaration.placement, 'top level'); assert.equal(declaration.children, 'all 256 instrument/audio tracks');
  assert.equal(declaration.excluded, 'FX and Master');
  const retired = report.retired as Wire; assert.equal(retired.comparison, 'window-changed'); noPayload(retired);
  assert.equal(retired.complete, false); assert.equal(retired.eligible, false); assert.equal(retired.registryPublished, false);
  // The terminal status has no active scan ID. Retain its counters and the recorded arm ID.
  assert.equal(retired.scanActive, false);
  assert.equal(retired.windowChanges, Number((arm.active as Wire).windowChanges) + 1);
  assert.equal(retired.authorityScans, (arm.active as Wire).authorityScans);
  const info = report.info as Wire; assert.equal(info.instrumentationRevision, COUNTED_ALLOCATION_MARKER);
  assert.equal(info.registryPublished, false); assert.equal(info.inventoryEnumerated, false);
  const hello = report.hello as Wire; assert.equal(hello.runtimeProfile, 'phase-8-probe-v1');
  assert.equal(hello.methodCount, 97); assert.equal(hello.methodsHash, 'f03f19414f40e3d3');
  assert(Date.parse(String(report.captured)) > Date.parse(String(arm.finished)));
  assert(Number((report.info as Wire).automaticIdentityInvalidations) > Number((arm.info as Wire).automaticIdentityInvalidations));
  const oracle = wideOracle(population, report.tracks as Wire); verifyCountedScale(report.topology as Wire, report.tracks as Wire, oracle);
  assert(Number((report.topology as Wire).sequenceBeforeRead) > Number((arm.topology as Wire).sequenceAfterRead));
  return oracle;
}
export function verifyWideResult(report: Wire, first: Wire, arm: Wire, seed: Wire, population: Wire): void {
  assert.equal(report.schema, 'phase8g5c-wide-result-v1'); assert.equal(report.project, OWNED_PROJECT);
  assert.equal(report.complete, false); assert.equal(report.eligible, false); assert.equal(report.populatedScaleAccepted, false);
  assert.equal(report.error, undefined); assert.equal(report.wideChecksPassed, true);
  const oracle = verifyWideFirst(first, arm, population); assert.deepEqual(report.oracle, oracle);
  const census = first.tracks as Wire; assert.deepEqual(report.tracks, census);
  const reads = report.topologyReads as Wire[]; assert.equal(reads.length, 3); reads.forEach(read => verifyCountedScale(read, census, oracle));
  const expected = arm.declaredOccupancy as string[], group = oracle.roots[0]!;
  const groupSlots = [`${group}:0`, `${group}:1`].sort();
  for (const key of ['firstScan', 'secondScan']) {
    const scan = report[key] as Wire; assert.deepEqual(scan.tracks, census); assert.equal(scan.sceneCount, 8);
    assert.deepEqual(scan.groupIds, [group]); const slots = scan.slots as Wire[]; assert.equal(slots.length, 259 * 8);
    fullTracks(census).forEach((track, index) => {
      for (let row = 0; row < 8; row++) {
        const slot = slots[index * 8 + row]!; assert.equal(slot.trackId, track.channelId); assert.equal(slot.row, row);
        assert.equal(typeof slot.hasContent, 'boolean'); assert.equal(typeof slot.exists, 'boolean');
      }
    });
    assert.deepEqual(scanOccupancy(scan), { clips: expected, groupSlots });
  }
  assert.deepEqual((report.firstScan as Wire).slots, (report.secondScan as Wire).slots);
  assert.deepEqual(report.scanOccupancy, { clips: expected, groupSlots });
  const list = (report.publication as Wire).list as Wire, rebuild = list.inventoryRebuild as Wire;
  assert.deepEqual(publishedOccupancy(list), expected); assert.equal(rebuild.totalCells, 259 * 8);
  assert.equal(rebuild.enumeratedCells, 259 * 8); assert.equal(rebuild.presentClips, 4);
  const comparisons = report.comparisons as Wire[]; assert.equal(comparisons.length, 2);
  comparisons.forEach((value, index) => {
    verifyComparison(value, (seed.seeds as Wire[])[index]!, COUNTED_ALLOCATION_MARKER);
    assert(Number(value.driverReacquisitionMs) > 0 && Number(value.driverReacquisitionMs) < 40_000);
  });
  verifyAllocation(report.after as Wire, 512, true);
}
export function verifyNestedArm(report: Wire, wide: Wire, seed: Wire): void {
  assert.equal(report.schema, 'phase8g5c-nested-arm-v1'); assert.equal(report.project, OWNED_PROJECT);
  assert.equal(report.complete, false); assert.equal(report.eligible, false); assert.equal(report.populatedScaleAccepted, false);
  assert.equal(report.error, undefined); assert.equal(report.armed, true); assert.deepEqual(report.tracks, wide.tracks);
  const oracle = wide.oracle as unknown as GroupOracle, parentId = oracle.roots[0]!;
  assert.deepEqual(report.declaration, { operation: 'native-group', parentId, selected: oracle.children[parentId]!.slice(0, 2),
    name: 'gn-8g5c-inner', expanded: true, placement: 'first child of wide group' });
  verifyCountedScale(report.topology as Wire, wide.tracks as Wire, oracle);
  verifyComparison(report.before as Wire, (seed.seeds as Wire[])[0]!, COUNTED_ALLOCATION_MARKER);
  const active = report.active as Wire; assert.equal(active.comparison, 'pending'); assert.equal(active.scanStage, 'membership');
  assert.equal(active.scanActive, true); assert.equal(active.complete, false); assert.equal(active.eligible, false); noPayload(active);
}
/** Derive nesting from the declared selection and the new UUID. */
export function nestedOracle(wide: Wire, census: Wire): GroupOracle {
  const before = fullTracks(wide.tracks as Wire), after = fullTracks(census);
  const known = new Set(before.map(row => row.channelId)), added = after.filter(row => !known.has(row.channelId));
  assert.equal(after.length, before.length + 1); assert.equal(added.length, 1);
  const inner = added[0]!; assert.equal(inner.type, 'Group'); assert.equal(inner.name, 'gn-8g5c-inner'); assert.equal(inner.index, 1);
  const retained = after.filter(row => known.has(row.channelId));
  assert.deepEqual(retained.map(row => row.channelId), before.map(row => row.channelId));
  // Native grouping can renumber generated names. UUIDs and channel types must persist.
  retained.forEach((row, index) => { assert.equal(row.type, before[index]!.type); });
  const prior = wide.oracle as unknown as GroupOracle, outer = prior.roots[0]!, children = prior.children[outer]!;
  assert.equal(children.length, 256);
  return { ...prior, children: { [outer]: [inner.channelId, ...children.slice(2)], [inner.channelId]: children.slice(0, 2) },
    expanded: { ...prior.expanded, [inner.channelId]: true }, flatOrder: after.map(row => row.channelId) };
}
export function verifyNestedFirst(report: Wire, arm: Wire, wide: Wire): GroupOracle {
  assert.equal(report.schema, 'phase8g5c-nested-first-read-v1'); assert.equal(report.project, OWNED_PROJECT);
  assert.equal(report.complete, false); assert.equal(report.eligible, false);
  assert.deepEqual(report.declaration, { operatorConfirmed: true, placement: 'first child of wide group',
    selected: ['Inst 1', 'Audio 2'], name: 'gn-8g5c-inner', expanded: true });
  const retired = report.retired as Wire, info = report.info as Wire, hello = report.hello as Wire;
  assert.equal(retired.comparison, 'window-changed'); noPayload(retired);
  assert.equal(retired.complete, false); assert.equal(retired.eligible, false); assert.equal(retired.registryPublished, false);
  assert.equal(retired.scanActive, false); assert.equal(retired.windowChanges, Number((arm.active as Wire).windowChanges) + 1);
  assert.equal(retired.authorityScans, (arm.active as Wire).authorityScans);
  assert.equal(info.instrumentationRevision, COUNTED_ALLOCATION_MARKER);
  assert.equal(info.registryPublished, false); assert.equal(info.inventoryEnumerated, false);
  assert(Number(info.automaticIdentityInvalidations) > Number((arm.info as Wire).automaticIdentityInvalidations));
  assert.equal(hello.runtimeProfile, 'phase-8-probe-v1'); assert.equal(hello.methodCount, 97); assert.equal(hello.methodsHash, 'f03f19414f40e3d3');
  assert(Date.parse(String(report.captured)) > Date.parse(String(arm.finished)));
  const oracle = nestedOracle(wide, report.tracks as Wire);
  verifyCountedScale(report.topology as Wire, report.tracks as Wire, oracle);
  assert(Number((report.topology as Wire).sequenceBeforeRead) > Number((arm.topology as Wire).sequenceAfterRead));
  return oracle;
}
export function verifyNestedResult(report: Wire, first: Wire, arm: Wire, wide: Wire, seed: Wire): void {
  assert.equal(report.schema, 'phase8g5c-nested-result-v1'); assert.equal(report.project, OWNED_PROJECT);
  assert.equal(report.complete, false); assert.equal(report.eligible, false); assert.equal(report.populatedScaleAccepted, false);
  assert.equal(report.error, undefined); assert.equal(report.nestedChecksPassed, true);
  const oracle = verifyNestedFirst(first, arm, wide), census = first.tracks as Wire;
  assert.deepEqual(report.oracle, oracle); assert.deepEqual(report.tracks, census);
  verifyGroupRecovery(report, census, oracle, seed);
}
/** Check every slot against two independent source scans. */
function verifyGroupSlots(report: Wire, census: Wire, oracle: GroupOracle, seed: Wire): void {
  const cells = fullTracks(census).length * 8;
  const reads = report.topologyReads as Wire[]; assert.equal(reads.length, 3); reads.forEach(read => verifyCountedScale(read, census, oracle));
  const expected = (seed.seeds as Wire[]).flatMap(state => [0, 1].map(row => `${String(state.trackId)}:${row}`)).sort();
  const groups = Object.keys(oracle.children), groupSlots = groups.flatMap(id => [`${id}:0`, `${id}:1`]).sort();
  for (const key of ['firstScan', 'secondScan']) {
    const scan = report[key] as Wire, slots = scan.slots as Wire[];
    assert.deepEqual(scan.tracks, census); assert.equal(scan.sceneCount, 8); assert.deepEqual(scan.groupIds, groups);
    assert.equal(slots.length, cells);
    fullTracks(census).forEach((track, index) => {
      for (let row = 0; row < 8; row++) {
        const slot = slots[index * 8 + row]!; assert.equal(slot.trackId, track.channelId); assert.equal(slot.row, row);
        assert.equal(typeof slot.hasContent, 'boolean'); assert.equal(typeof slot.exists, 'boolean');
      }
    });
    assert.deepEqual(scanOccupancy(scan), { clips: expected, groupSlots });
  }
  assert.deepEqual((report.firstScan as Wire).slots, (report.secondScan as Wire).slots);
  assert.deepEqual(report.scanOccupancy, { clips: expected, groupSlots });
  const list = (report.publication as Wire).list as Wire, rebuild = list.inventoryRebuild as Wire;
  assert.deepEqual(publishedOccupancy(list), expected); assert.equal(rebuild.totalCells, cells);
  assert.equal(rebuild.enumeratedCells, cells); assert.equal(rebuild.presentClips, 4);
}
/** Check slots and note authority. A refused collapsed binding must be retired. */
function verifyGroupRecovery(report: Wire, census: Wire, oracle: GroupOracle, seed: Wire, collapsed = false): void {
  verifyGroupSlots(report, census, oracle, seed);
  if (collapsed) {
    const primary = report.primaryBinding as Wire, status = primary.status as Wire;
    assert(Number(primary.wallMs) > 0 && Number(primary.wallMs) < 40_000);
    assert.equal((primary.point as Wire).index, 0);
    assert.equal(status.complete, false); assert.equal(status.eligible, false);
    if (primary.outcome === 'refused') {
      assert.equal(status.phase, 'retired'); assert.equal(status.fallbackReason, 'binding-budget');
      noPayload(status);
      const detail = primary.detail as Wire, retirement = primary.retirement as Wire;
      assert.equal(detail.index, 0); assert.equal(detail.phase, 'retired'); assert.equal(detail.fallbackReason, 'binding-budget');
      assert.equal(detail.canaryVerifiedForBinding, false); assert.equal(detail.bindingReady, false); noPayload(detail);
      assert.deepEqual(detail.address, { trackId: (seed.seeds as Wire[])[0]!.trackId, row: 1 });
      assert.equal(retirement.index, 0); assert.equal(retirement.phase, 'retired'); noPayload(retirement);
      assert.equal(retirement.physicalViewPendingHints, 0);
      assert.equal(primary.comparison, undefined);
    } else {
      assert.equal(primary.outcome, 'matched'); assert.equal(status.index, 0); assert.equal(status.canaryVerifiedForBinding, true);
      assert(['settled', 'complete'].includes(String(status.phase))); assert.equal(status.bindingReady, true);
      assert.equal(status.canaryPhase, 'target'); assert.deepEqual(status.address, { trackId: (seed.seeds as Wire[])[0]!.trackId, row: 0 });
      verifyComparison(primary.comparison as Wire, (seed.seeds as Wire[])[0]!, COUNTED_ALLOCATION_MARKER);
    }
    verifyCountedScale(report.topologyAfterBindings as Wire, census, oracle);
  }
  const comparisons = report.comparisons as Wire[]; assert.equal(comparisons.length, collapsed ? 1 : 2);
  comparisons.forEach((value, index) => {
    verifyComparison(value, (seed.seeds as Wire[])[collapsed ? 1 : index]!, COUNTED_ALLOCATION_MARKER);
    assert(Number(value.driverReacquisitionMs) > 0 && Number(value.driverReacquisitionMs) < 40_000);
  });
  verifyAllocation(report.after as Wire, 512, true);
}
/** Apply the declared boundary move without changing flat UUID order. */
export function boundaryOracle(nested: Wire, census: Wire): GroupOracle {
  const before = fullTracks(nested.tracks as Wire), after = fullTracks(census);
  assert.deepEqual(after.map(row => row.channelId), before.map(row => row.channelId));
  after.forEach((row, index) => assert.equal(row.type, before[index]!.type));
  const prior = nested.oracle as unknown as GroupOracle, outer = prior.roots[0]!, inner = prior.children[outer]![0]!;
  const selected = prior.children[inner]![1]!;
  assert.equal(prior.children[inner]!.length, 2); assert.equal(prior.children[outer]!.length, 255);
  return { ...prior, children: { [outer]: [inner, selected, ...prior.children[outer]!.slice(1)],
    [inner]: prior.children[inner]!.slice(0, 1) } };
}
export function verifyBoundaryFirst(report: Wire, arm: Wire, nested: Wire): GroupOracle {
  assert.equal(report.schema, 'phase8g5c-boundary-first-read-v1'); assert.equal(report.project, OWNED_PROJECT);
  assert.equal(report.complete, false); assert.equal(report.eligible, false); assert.equal(report.error, undefined);
  verifyChangeRetirement(report, arm);
  const oracle = boundaryOracle(nested, report.tracks as Wire);
  verifyCountedScale(report.topology as Wire, report.tracks as Wire, oracle);
  return oracle;
}
/** Check terminal retirement before any new binding. */
function verifyChangeRetirement(report: Wire, arm: Wire): void {
  assert.deepEqual(report.declaration, { ...arm.declaration as Wire, operatorConfirmed: true });
  const retired = report.retired as Wire, info = report.info as Wire, hello = report.hello as Wire;
  assert.equal(retired.comparison, 'window-changed'); noPayload(retired);
  assert.equal(retired.complete, false); assert.equal(retired.eligible, false); assert.equal(retired.registryPublished, false);
  assert.equal(retired.scanActive, false); assert.equal(retired.windowChanges, Number((arm.active as Wire).windowChanges) + 1);
  assert.equal(retired.authorityScans, (arm.active as Wire).authorityScans);
  assert.equal(info.instrumentationRevision, COUNTED_ALLOCATION_MARKER);
  assert.equal(info.registryPublished, false); assert.equal(info.inventoryEnumerated, false);
  assert(Number(info.automaticIdentityInvalidations) > Number((arm.info as Wire).automaticIdentityInvalidations));
  assert.equal(hello.runtimeProfile, 'phase-8-probe-v1'); assert.equal(hello.methodCount, 97); assert.equal(hello.methodsHash, 'f03f19414f40e3d3');
  assert(Date.parse(String(report.captured)) > Date.parse(String(arm.finished)));
  assert(Number((report.topology as Wire).sequenceBeforeRead) > Number((arm.topology as Wire).sequenceAfterRead));
  const attempts = report.topologyAttempts as Wire[]; assert(attempts.length > 0);
  assert.deepEqual(attempts.at(-1), report.topology); assert(Number(report.driverSettlementMs) >= 0 && Number(report.driverSettlementMs) < 30_000);
  const stats = report.stats as Wire, config = stats.config as Wire;
  assert.equal(stats.runtimeProfile, 'phase-8-probe-v1'); assert.equal(config.tracks, 512);
  assert.equal(config.cacheTopologyTracks, 512); assert.equal(config.cacheTopologyCounted, true);
}
export function verifyBoundaryResult(report: Wire, first: Wire, arm: Wire, nested: Wire, seed: Wire): void {
  assert.equal(report.schema, 'phase8g5c-boundary-result-v1'); assert.equal(report.project, OWNED_PROJECT);
  assert.equal(report.complete, false); assert.equal(report.eligible, false); assert.equal(report.populatedScaleAccepted, false);
  assert.equal(report.error, undefined); assert.equal(report.boundaryChecksPassed, true);
  const oracle = verifyBoundaryFirst(first, arm, nested), census = first.tracks as Wire;
  assert.deepEqual(report.oracle, oracle); assert.deepEqual(report.tracks, census);
  verifyGroupRecovery(report, census, oracle, seed);
}
export function verifyBoundaryArm(report: Wire, nested: Wire, seed: Wire): void {
  assert.equal(report.schema, 'phase8g5c-boundary-arm-v1'); assert.equal(report.project, OWNED_PROJECT);
  assert.equal(report.complete, false); assert.equal(report.eligible, false); assert.equal(report.populatedScaleAccepted, false);
  assert.equal(report.error, undefined); assert.equal(report.armed, true); assert.deepEqual(report.tracks, nested.tracks);
  const oracle = nested.oracle as unknown as GroupOracle, outer = oracle.roots[0]!, inner = oracle.children[outer]![0]!;
  const beforeId = oracle.children[outer]![1]!;
  assert.deepEqual(report.declaration, { operation: 'native-move', selected: oracle.children[inner]![1]!, from: inner, to: outer,
    placement: 'after inner group and before first remaining child', beforeId,
    beforeName: fullTracks(nested.tracks as Wire).find(row => row.channelId === beforeId)!.name, flatOrderUnchanged: true });
  verifyCountedScale(report.topology as Wire, nested.tracks as Wire, oracle);
  verifyComparison(report.before as Wire, (seed.seeds as Wire[])[0]!, COUNTED_ALLOCATION_MARKER);
  const active = report.active as Wire; assert.equal(active.comparison, 'pending'); assert.equal(active.scanStage, 'membership');
  assert.equal(active.scanActive, true); assert.equal(active.complete, false); assert.equal(active.eligible, false); noPayload(active);
}
export function verifyCollapseArm(report: Wire, boundary: Wire, seed: Wire): void {
  assert.equal(report.schema, 'phase8g5c-collapse-arm-v1'); assert.equal(report.project, OWNED_PROJECT);
  assert.equal(report.complete, false); assert.equal(report.eligible, false); assert.equal(report.populatedScaleAccepted, false);
  assert.equal(report.error, undefined); assert.equal(report.armed, true); assert.deepEqual(report.tracks, boundary.tracks);
  const oracle = boundary.oracle as unknown as GroupOracle, outer = oracle.roots[0]!, inner = oracle.children[outer]![0]!;
  assert.equal(oracle.expanded[outer], true); assert.equal(oracle.expanded[inner], true);
  assert.deepEqual(report.declaration, { operation: 'native-collapse', selected: inner, name: 'gn-8g5c-inner',
    expanded: false, outerExpanded: true, flatOrderUnchanged: true });
  verifyCountedScale(report.topology as Wire, boundary.tracks as Wire, oracle);
  verifyComparison(report.before as Wire, (seed.seeds as Wire[])[0]!, COUNTED_ALLOCATION_MARKER);
  const active = report.active as Wire; assert.equal(active.comparison, 'pending'); assert.equal(active.scanStage, 'membership');
  assert.equal(active.scanActive, true); assert.equal(active.complete, false); assert.equal(active.eligible, false); noPayload(active);
}
/** Change only the declared inner expansion flag. UUIDs and direct degrees persist. */
export function toggleOracle(priorReport: Wire, census: Wire, expanded: boolean): GroupOracle {
  const before = fullTracks(priorReport.tracks as Wire), after = fullTracks(census);
  assert.deepEqual(after.map(row => row.channelId), before.map(row => row.channelId));
  after.forEach((row, index) => assert.equal(row.type, before[index]!.type));
  const prior = priorReport.oracle as unknown as GroupOracle, outer = prior.roots[0]!, inner = prior.children[outer]![0]!;
  assert.equal(prior.expanded[outer], true); assert.equal(prior.expanded[inner], !expanded);
  assert.equal(prior.children[outer]!.length, 256); assert.equal(prior.children[inner]!.length, 1);
  return { ...prior, expanded: { ...prior.expanded, [inner]: expanded } };
}
export function verifyToggleFirst(report: Wire, arm: Wire, prior: Wire, expanded: boolean): GroupOracle {
  assert.equal(report.schema, `phase8g5c-${expanded ? 'expand' : 'collapse'}-first-read-v1`);
  assert.equal(report.project, OWNED_PROJECT); assert.equal(report.complete, false); assert.equal(report.eligible, false);
  assert.equal(report.error, undefined); verifyChangeRetirement(report, arm);
  const oracle = toggleOracle(prior, report.tracks as Wire, expanded);
  verifyCountedScale(report.topology as Wire, report.tracks as Wire, oracle); return oracle;
}
export function verifyCollapseResult(report: Wire, first: Wire, arm: Wire, boundary: Wire, seed: Wire): void {
  assert.equal(report.schema, 'phase8g5c-collapse-result-v1'); assert.equal(report.project, OWNED_PROJECT);
  assert.equal(report.complete, false); assert.equal(report.eligible, false); assert.equal(report.populatedScaleAccepted, false);
  assert.equal(report.error, undefined); assert.equal(report.collapseChecksPassed, true);
  const oracle = verifyToggleFirst(first, arm, boundary, false), census = first.tracks as Wire;
  assert.deepEqual(report.oracle, oracle); assert.deepEqual(report.tracks, census);
  verifyGroupRecovery(report, census, oracle, seed, true);
}
/** Preserve the first queue-drain timeout. It proves no tail comparison. */
export function verifyCollapseDiagnostic(report: Wire, first: Wire, arm: Wire, boundary: Wire, seed: Wire): void {
  assert.equal(report.schema, 'phase8g5c-collapse-result-v1'); assert.equal(report.project, OWNED_PROJECT);
  assert.equal(report.complete, false); assert.equal(report.eligible, false); assert.equal(report.populatedScaleAccepted, false);
  assert.equal(report.collapseChecksPassed, undefined); assert.equal(report.finished, undefined); assert.deepEqual(report.comparisons, []);
  const oracle = verifyToggleFirst(first, arm, boundary, false), census = first.tracks as Wire;
  assert.deepEqual(report.oracle, oracle); verifyGroupSlots(report, census, oracle, seed);
  const primary = report.primaryBinding as Wire, status = primary.status as Wire;
  assert.equal(primary.outcome, 'refused'); assert.equal(status.phase, 'retired'); assert.equal(status.fallbackReason, 'binding-budget');
  assert.equal(primary.comparison, undefined); assert.equal(primary.retirement, undefined); noPayload(status);
  const prefix = 'AssertionError [ERR_ASSERTION]: ', error = String(report.error); assert(error.startsWith(prefix));
  const stalled = JSON.parse(error.slice(prefix.length)) as Wire;
  assert.equal(stalled.index, 1); assert.equal(stalled.phase, 'settled'); assert.equal(stalled.canaryVerifiedForBinding, true);
  assert.equal(stalled.physicalPendingHints, 32); assert.equal(stalled.physicalViewPendingHints, 0);
  assert.equal(stalled.pendingCoordinates, 0); assert.equal(stalled.complete, false); assert.equal(stalled.eligible, false); noPayload(stalled);
  assert.equal(stalled.authorityScans, (first.retired as Wire).authorityScans);
}
export function verifyExpandArm(report: Wire, collapse: Wire, seed: Wire): void {
  assert.equal(report.schema, 'phase8g5c-expand-arm-v1'); assert.equal(report.project, OWNED_PROJECT);
  assert.equal(report.complete, false); assert.equal(report.eligible, false); assert.equal(report.populatedScaleAccepted, false);
  assert.equal(report.error, undefined); assert.equal(report.armed, true); assert.deepEqual(report.tracks, collapse.tracks);
  const oracle = collapse.oracle as unknown as GroupOracle, outer = oracle.roots[0]!, inner = oracle.children[outer]![0]!;
  assert.equal(oracle.expanded[outer], true); assert.equal(oracle.expanded[inner], false);
  assert.deepEqual(report.declaration, { operation: 'native-expand', selected: inner, name: 'gn-8g5c-inner',
    expanded: true, outerExpanded: true, flatOrderUnchanged: true });
  verifyCountedScale(report.topology as Wire, collapse.tracks as Wire, oracle);
  verifyComparison(report.before as Wire, (seed.seeds as Wire[])[1]!, COUNTED_ALLOCATION_MARKER);
  const active = report.active as Wire; assert.equal(active.comparison, 'pending'); assert.equal(active.scanStage, 'membership');
  assert.equal(active.scanActive, true); assert.equal(active.complete, false); assert.equal(active.eligible, false); noPayload(active);
}
export function verifyExpandResult(report: Wire, first: Wire, arm: Wire, collapse: Wire, seed: Wire): void {
  assert.equal(report.schema, 'phase8g5c-expand-result-v1'); assert.equal(report.project, OWNED_PROJECT);
  assert.equal(report.complete, false); assert.equal(report.eligible, false); assert.equal(report.populatedScaleAccepted, false);
  assert.equal(report.error, undefined); assert.equal(report.expandChecksPassed, true);
  const oracle = verifyToggleFirst(first, arm, collapse, true), census = first.tracks as Wire;
  assert.deepEqual(report.oracle, oracle); assert.deepEqual(report.tracks, census);
  verifyGroupRecovery(report, census, oracle, seed);
}
export function verifyUngroupArm(report: Wire, expanded: Wire, seed: Wire): void {
  assert.equal(report.schema, 'phase8g5c-ungroup-arm-v1'); assert.equal(report.project, OWNED_PROJECT);
  assert.equal(report.complete, false); assert.equal(report.eligible, false); assert.equal(report.populatedScaleAccepted, false);
  assert.equal(report.error, undefined); assert.equal(report.armed, true); assert.deepEqual(report.tracks, expanded.tracks);
  const oracle = expanded.oracle as unknown as GroupOracle, outer = oracle.roots[0]!, inner = oracle.children[outer]![0]!;
  assert.deepEqual(report.declaration, { operation: 'native-ungroup', selected: [inner, outer],
    keepAllChildrenAndClips: true, placement: 'all instrument/audio tracks at top level' });
  verifyCountedScale(report.topology as Wire, expanded.tracks as Wire, oracle);
  verifyComparison(report.before as Wire, (seed.seeds as Wire[])[0]!, COUNTED_ALLOCATION_MARKER);
  const active = report.active as Wire; assert.equal(active.comparison, 'pending'); assert.equal(active.scanStage, 'membership');
  assert.equal(active.scanActive, true); assert.equal(active.complete, false); assert.equal(active.eligible, false); noPayload(active);
}
/** Native ungroup removes only the two owned wrapper UUIDs. */
export function ungroupOracle(population: Wire, census: Wire): GroupOracle {
  const before = fullTracks(population.after as Wire), after = fullTracks(census);
  assert.equal(after.length, 258); assert.deepEqual(after.map(row => row.channelId), before.map(row => row.channelId));
  after.forEach((row, index) => assert.equal(row.type, before[index]!.type));
  const ids = after.map(row => row.channelId);
  return { project: OWNED_PROJECT, roots: ids, children: {}, expanded: {}, flatOrder: ids,
    masterId: after.find(row => row.type === 'Master')!.channelId };
}
export function verifyUngroupFirst(report: Wire, arm: Wire, population: Wire): GroupOracle {
  assert.equal(report.schema, 'phase8g5c-ungroup-first-read-v1'); assert.equal(report.project, OWNED_PROJECT);
  assert.equal(report.complete, false); assert.equal(report.eligible, false); assert.equal(report.error, undefined);
  verifyChangeRetirement(report, arm);
  const oracle = ungroupOracle(population, report.tracks as Wire);
  verifyCountedScale(report.topology as Wire, report.tracks as Wire, oracle); return oracle;
}
export function verifyUngroupResult(report: Wire, first: Wire, arm: Wire, population: Wire, seed: Wire): void {
  assert.equal(report.schema, 'phase8g5c-ungroup-result-v1'); assert.equal(report.project, OWNED_PROJECT);
  assert.equal(report.complete, false); assert.equal(report.eligible, false); assert.equal(report.populatedScaleAccepted, false);
  assert.equal(report.error, undefined); assert.equal(report.ungroupChecksPassed, true);
  const oracle = verifyUngroupFirst(first, arm, population), census = first.tracks as Wire;
  assert.deepEqual(report.oracle, oracle); assert.deepEqual(report.tracks, census);
  verifyGroupRecovery(report, census, oracle, seed);
}
/** Replay all creates through the inclusive 512-channel boundary. */
export function verify512Population(report: Wire, ungroup: Wire): void {
  assert.equal(report.schema, 'phase8g5c-512-population-v1'); assert.equal(report.project, OWNED_PROJECT);
  assert.equal(report.complete, false); assert.equal(report.eligible, false); assert.equal(report.populatedScaleAccepted, false);
  assert.equal(report.error, undefined); assert.equal(report.populationVerified, true); assert.equal(report.targetTotalChannels, 512);
  let current = ungroup.tracks as Wire; assert.equal(fullTracks(current).length, 258); assert.deepEqual(report.before, current);
  verifyFlatScale(report.topologyBefore as Wire, current);
  const operations = report.operations as Wire[]; assert.equal(operations.length, 254); const seen = new Set<string>();
  for (const operation of operations) {
    assert.equal(operation.stage, 'verified'); assert.deepEqual(operation.before, current);
    assert.equal(operation.position, fullTracks(current).length - 2); assert.equal((operation.response as Wire).success, true);
    const added = createdTrack(current, operation.after as Wire); assert.deepEqual(operation.created, added);
    assert.equal(added.index, operation.position); assert.equal(added.position, operation.position);
    assert(!seen.has(added.channelId)); seen.add(added.channelId); current = operation.after as Wire;
  }
  assert.deepEqual(report.after, current); const rows = fullTracks(current);
  assert.equal(rows.length, 512); assert.equal(rows.filter(row => ['Instrument', 'Audio'].includes(row.type)).length, 510);
  assert.equal(rows[510]!.type, 'Effect'); assert.equal(rows[511]!.type, 'Master');
  verifyFlatScale(report.topologyAfter as Wire, current);
  for (const [key, count] of [['scanBefore', 258], ['scanAfter', 512]] as const) {
    const scan = report[key] as Wire; assert.equal(scan.existing, count); assert.equal(scan.itemCount, count);
    assert.equal(scan.withChannelId, count); assert.equal(scan.bankSize, 512); assert.equal(scan.slotsWithContent, 4);
  }
  verifyAllocation(report.allocationAfter as Wire, 512, true);
  const stats = report.stats as Wire; assert.equal(stats.runtimeProfile, 'phase-8-probe-v1');
  const config = stats.config as Wire; assert.equal(config.tracks, 512); assert.equal(config.cacheTopologyTracks, 512);
  assert.equal(config.cacheTopologyCounted, true);
}
/** Check end-track content and every occupied slot at capacity equality. */
export function verify512Result(report: Wire, population: Wire, seed: Wire): void {
  assert.equal(report.schema, 'phase8g5c-512-result-v1'); assert.equal(report.project, OWNED_PROJECT);
  assert.equal(report.complete, false); assert.equal(report.eligible, false); assert.equal(report.populatedScaleAccepted, false);
  assert.equal(report.error, undefined); assert.equal(report.boundaryChecksPassed, true);
  const census = population.after as Wire, rows = fullTracks(census); assert.equal(rows.length, 512); assert.deepEqual(report.tracks, census);
  const end = report.endSeed as Wire; assert.equal(end.trackId, rows[509]!.channelId); assert.equal(end.pitch, 84);
  verifySeed(end, [84]); assert.deepEqual(independentNotes(end.notes as Wire), independentNotes(end.confirmationNotes as Wire));
  const operations = report.operations as Wire[]; assert.equal(operations.length, 2);
  operations.forEach((operation, row) => {
    assert.equal(operation.trackId, end.trackId); assert.equal(operation.row, row); assert.equal(operation.stage, 'verified');
    assert.equal((operation.created as Wire).success, true); verifySeed({ ...end, notes: operation.notes }, [84]);
  });
  const reads = report.topologyReads as Wire[]; assert.equal(reads.length, 3); reads.forEach(value => verifyFlatScale(value, census));
  const states = [...seed.seeds as Wire[], end], expected = states.flatMap(state => [0, 1].map(row => `${String(state.trackId)}:${row}`)).sort();
  for (const key of ['firstScan', 'secondScan']) {
    const scan = report[key] as Wire, slots = scan.slots as Wire[];
    assert.deepEqual(scan.tracks, census); assert.equal(scan.sceneCount, 8); assert.deepEqual(scan.groupIds, []); assert.equal(slots.length, 4096);
    rows.forEach((track, index) => {
      for (let row = 0; row < 8; row++) {
        const slot = slots[index * 8 + row]!; assert.equal(slot.trackId, track.channelId); assert.equal(slot.row, row);
        assert.equal(typeof slot.exists, 'boolean'); assert.equal(typeof slot.hasContent, 'boolean');
      }
    });
    assert.deepEqual(scanOccupancy(scan), { clips: expected, groupSlots: [] });
  }
  assert.deepEqual((report.firstScan as Wire).slots, (report.secondScan as Wire).slots);
  const list = (report.publication as Wire).list as Wire, rebuild = list.inventoryRebuild as Wire;
  assert.deepEqual(publishedOccupancy(list), expected); assert.equal(rebuild.totalCells, 4096);
  assert.equal(rebuild.enumeratedCells, 4096); assert.equal(rebuild.presentClips, 6);
  assert(Number(rebuild.elapsedMs) < 40_000); assert(Number(rebuild.lastBatchMs) <= 45);
  const comparisons = report.comparisons as Wire[]; assert.equal(comparisons.length, 3);
  comparisons.forEach((value, index) => {
    verifyComparison(value, states[index]!, COUNTED_ALLOCATION_MARKER, index === 2 ? [84] : [60, 72]);
    assert(Number(value.driverReacquisitionMs) > 0 && Number(value.driverReacquisitionMs) < 40_000);
  });
  const scan = report.scanAfter as Wire; assert.equal(scan.existing, 512); assert.equal(scan.itemCount, 512);
  assert.equal(scan.withChannelId, 512); assert.equal(scan.slotsWithContent, 6); assert.equal(scan.bankSize, 512);
  verifyAllocation(report.allocationAfter as Wire, 512, true); verifyAllocation(report.idleAllocationAfter as Wire, 512, true);
  const first = report.processBefore as Wire, second = report.processAfter as Wire;
  const interval = Number(second.capturedEpochMs) - Number(first.capturedEpochMs); assert(interval >= 5000);
  assert.equal(report.idleIntervalMs, interval); assert.deepEqual(report.idleCpu, intervalCpu(first.rows as Wire[], second.rows as Wire[], interval));
}
/** The only hidden row is the known Master. The new empty Instrument stays visible for cleanup. */
export function ownedExcessTrack(before: Wire, after: Wire): TrackRow {
  const prior = fullTracks(before); assert.equal(prior.length, 512); assert.equal(prior[511]!.type, 'Master');
  assert.equal(after.bankSize, 512); assert.equal(after.itemCount, 513); assert.equal(after.count, 512);
  const rows = after.tracks as TrackRow[]; assert.equal(rows.length, 512);
  const known = new Set(prior.map(row => row.channelId)), added = rows.filter(row => !known.has(row.channelId)); assert.equal(added.length, 1);
  const track = added[0]!; assert.match(track.channelId, /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i);
  assert.equal(track.type, 'Instrument'); assert.equal(track.index, 510); assert.equal(track.position, 510);
  const expected = [...prior.slice(0, 510), track, prior[510]!];
  assert.deepEqual(rows.map(row => row.channelId), expected.map(row => row.channelId));
  assert.equal(new Set(rows.map(row => row.channelId)).size, 512);
  rows.forEach((row, index) => {
    assert.equal(row.index, index); assert.equal(row.type, expected[index]!.type); assert.equal(row.name, expected[index]!.name);
  });
  return track;
}
export function verify512Excess(report: Wire, boundary: Wire, seed: Wire, expectedVerifierDiagnostic = false): void {
  assert.equal(report.schema, 'phase8g5c-512-excess-v1'); assert.equal(report.project, OWNED_PROJECT);
  assert.equal(report.complete, false); assert.equal(report.eligible, false); assert.equal(report.populatedScaleAccepted, false);
  if (expectedVerifierDiagnostic) assert.equal(report.error,
    "AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:\n+ actual - expected\n\n+ 'group-topology-unproved'\n- 'slot-coverage-track-limit'\n");
  else assert.equal(report.error, undefined);
  assert.equal(report.excessAndRecoveryPassed, true);
  assert.deepEqual(report.before, boundary.tracks); verifyComparison(report.beforeComparison as Wire, boundary.endSeed as Wire, COUNTED_ALLOCATION_MARKER, [84]);
  const active = report.active as Wire; assert.equal(active.comparison, 'pending'); assert.equal(active.scanStage, 'membership');
  const creation = report.creation as Wire; assert.equal(creation.stage, 'verified'); assert.equal(creation.position, 510);
  assert.equal((creation.response as Wire).success, true);
  const added = ownedExcessTrack(report.before as Wire, report.excessTracks as Wire); assert.deepEqual(creation.created, added);
  const retired = report.retired as Wire; assert.equal(retired.comparison, 'window-changed'); noPayload(retired);
  assert.equal(retired.windowChanges, Number(active.windowChanges) + 1); assert.equal(retired.authorityScans, active.authorityScans);
  assert.equal(retired.scanActive, false); assert.equal(retired.registryPublished, false);
  const topology = report.excessTopology as Wire;
  assert.equal(topology.membershipComplete, false); assert.equal(topology.coherent, false); assert.equal(topology.groupMembershipProved, false);
  assert.equal(topology.reason, 'flat-topology-window-incomplete'); assert.equal(topology.tree, undefined);
  for (const key of ['inventory', 'rebuild', 'point', 'exact']) {
    const refusal = report[key] as Wire; assert.equal(refusal.complete, false); assert.equal(refusal.eligible, false); noPayload(refusal);
    assert.notEqual(refusal.occupancyAdmitted, true); assert.equal(refusal.registryPublished, false);
    assert.equal(refusal.reason, key === 'inventory' ? 'slot-coverage-track-limit' : 'group-topology-unproved');
  }
  const slots = report.emptyExcessSlots as Wire[]; assert.equal(slots.length, 8);
  slots.forEach((slot, index) => { assert.equal(slot.row, index); assert.equal(slot.hasContent, false); });
  const deletion = report.deletion as Wire; assert.equal(deletion.stage, 'verified'); assert.equal(deletion.trackId, added.channelId);
  assert.equal((deletion.response as Wire).success, true); assert.deepEqual(report.after, boundary.tracks);
  verifyFlatScale(report.recoveredTopology as Wire, report.after as Wire);
  const list = (report.recoveredPublication as Wire).list as Wire;
  const expected = [...seed.seeds as Wire[], boundary.endSeed as Wire].flatMap(state => [0, 1].map(row => `${String(state.trackId)}:${row}`)).sort();
  assert.deepEqual(publishedOccupancy(list), expected);
  const comparisons = report.recoveredComparisons as Wire[]; assert.equal(comparisons.length, 2);
  verifyComparison(comparisons[0]!, (seed.seeds as Wire[])[0]!, COUNTED_ALLOCATION_MARKER);
  verifyComparison(comparisons[1]!, boundary.endSeed as Wire, COUNTED_ALLOCATION_MARKER, [84]);
}
/** Check the immutable verifier diagnostic, then the independently read restored state. */
export function verify512ExcessConfirmation(report: Wire, source: Wire, boundary: Wire, seed: Wire): void {
  assert.equal(report.schema, 'phase8g5c-512-excess-confirmation-v1'); assert.equal(report.project, OWNED_PROJECT);
  assert.equal(report.complete, false); assert.equal(report.eligible, false); assert.equal(report.excessAndRecoveryPassed, true);
  assert.equal(report.error, undefined); assert.match(String(report.sourceRawSha256), /^[a-f0-9]{64}$/);
  verify512Excess(source, boundary, seed, true); assert.deepEqual(report.tracks, boundary.tracks);
  verifyFlatScale(report.topology as Wire, boundary.tracks as Wire);
  assert.deepEqual(publishedOccupancy(report.inventory as Wire), publishedOccupancy((source.recoveredPublication as Wire).list as Wire));
}
/** A create must add one Instrument UUID and preserve every prior track in order. */
export function createdTrack(before: Wire, after: Wire): TrackRow {
  const prior = fullTracks(before), current = fullTracks(after);
  assert.equal(current.length, prior.length + 1);
  const known = new Set(prior.map(row => row.channelId));
  const added = current.filter(row => !known.has(row.channelId));
  assert.equal(added.length, 1, 'create has no unique UUID witness');
  assert.equal(added[0]!.type, 'Instrument');
  const retained = current.filter(row => known.has(row.channelId));
  assert.deepEqual(retained.map(row => row.channelId), prior.map(row => row.channelId));
  retained.forEach((row, index) => {
    assert.equal(row.name, prior[index]!.name); assert.equal(row.type, prior[index]!.type);
  });
  return added[0]!;
}
/** All roots come from the fixture census. The topology candidate cannot supply its oracle. */
export function verifyFlatScale(topology: Wire, census: Wire): void {
  const rows = fullTracks(census), ids = rows.map(row => row.channelId);
  assert.equal(topology.complete, false); assert.equal(topology.eligible, false);
  assert.equal(topology.membershipComplete, true); assert.equal(topology.coherent, true);
  assert.equal(topology.topologyControlRevision, '8g5c-counted-preorder-v1');
  assert.equal(topology.oracle, 'counted-preorder-with-uuid-master');
  assert.equal(topology.maximumTracks, 512); assert.equal(topology.hostInputOrderingProved, false);
  assert.equal(topology.readError, undefined); assert.equal(topology.callbacksChangedDuringRead, false);
  assert.equal(topology.sequenceBeforeRead, topology.sequenceAfterRead);
  const candidate = topology.candidates as Wire;
  assert.equal(candidate.coherent, true); assert.equal(candidate.readError, undefined);
  assert.equal(candidate.sequenceBeforeRead, candidate.sequenceAfterRead);
  assert.deepEqual(candidate.first, candidate.second);
  const raw = candidate.first as Wire;
  assert.deepEqual(raw.children, {}); assert.deepEqual(raw.parents, {});
  for (const key of ['flat', 'roots']) {
    const bank = raw[key] as Wire;
    assert.equal(bank.count, rows.length); assert.equal(bank.offset, 0); assert.deepEqual(bank.ids, ids);
    const bankRows = bank.rows as Wire[]; assert.equal(bankRows.length, rows.length);
    bankRows.forEach((row, index) => {
      assert.equal(row.index, index); assert.equal(row.channelId, ids[index]);
      assert.equal(row.isGroup, false); assert.equal(row.expanded, false);
    });
  }
  const tree = topology.tree as Wire;
  assert.deepEqual((tree.roots as Wire).ids, ids); assert.deepEqual(tree.children, {});
  assert.deepEqual((tree.flat as Wire[]).map(row => row.channelId), ids);
}

/** Replay every mutation witness. Population alone cannot accept slot or group scale. */
export function verifyPopulation(report: Wire, baseline: Wire, prior: Wire): void {
  assert.equal(report.schema, 'phase8g5c-flat-population-v1'); assert.equal(report.project, OWNED_PROJECT);
  assert.equal(report.complete, false); assert.equal(report.eligible, false);
  assert.equal(report.populatedScaleAccepted, false); assert.equal(report.populationVerified, true);
  assert.equal(report.error, undefined); assert.equal(report.targetBaseTracks, 256); assert.equal(report.baseTracks, 256);
  assert.equal(baseline.schema, 'phase8g5c-fixture-entry-v1'); assert.equal(baseline.project, OWNED_PROJECT);
  assert.equal(baseline.emptySlotsVerified, true); assert.equal(prior.capacity, 0);
  assert.equal(prior.instrumentationRevision, COUNTED_ALLOCATION_MARKER);
  const stats = report.stats as Wire, config = stats.config as Wire, hello = report.hello as Wire;
  assert(Number(stats.initEpochMs) > Number((prior.stats as Wire).initEpochMs));
  assert.equal(config.tracks, 512); assert.equal(config.cacheTopologyTracks, 512); assert.equal(config.cacheTopologyCounted, true);
  assert.equal(hello.runtimeProfile, 'phase-8-probe-v1'); assert.equal(hello.methodCount, 97);
  assert.equal(hello.methodsHash, 'f03f19414f40e3d3');
  let current = (baseline.first as Wire).tracks as Wire;
  assert.deepEqual(report.before, current); verifyFlatScale(report.topologyBefore as Wire, current);
  const operations = report.operations as Wire[]; assert.equal(operations.length, 254);
  const created = new Set<string>();
  for (const operation of operations) {
    assert.equal(operation.stage, 'verified'); assert.deepEqual(operation.before, current);
    assert.equal(operation.position, fullTracks(current).length - 2);
    assert.equal((operation.response as Wire).success, true);
    const after = operation.after as Wire, added = createdTrack(current, after);
    assert.deepEqual(operation.created, added); assert(!created.has(added.channelId)); created.add(added.channelId); current = after;
  }
  assert.deepEqual(report.after, current); const rows = fullTracks(current); assert.equal(rows.length, 258);
  assert.equal(rows.filter(row => ['Instrument', 'Audio'].includes(row.type)).length, 256);
  for (const [key, count] of [['scanBefore', 4], ['scanAfter', 258]] as const) {
    const scan = report[key] as Wire;
    assert.equal(scan.existing, count); assert.equal(scan.itemCount, count); assert.equal(scan.withChannelId, count);
    assert.equal(scan.bankSize, 512); assert.equal(scan.sceneCount, 8); assert.equal(scan.slotsWithContent, 0);
  }
  verifyFlatScale(report.topologyAfter as Wire, current);
  const oracle = report.flatOracle as Wire, ids = rows.map(row => row.channelId);
  assert.equal(oracle.project, OWNED_PROJECT); assert.deepEqual(oracle.roots, ids); assert.deepEqual(oracle.flatOrder, ids);
  assert.deepEqual(oracle.children, {}); assert.deepEqual(oracle.expanded, {});
  assert.equal(oracle.masterId, rows.find(row => row.type === 'Master')!.channelId);
}
export function verifyFlatEmpty(report: Wire, population: Wire): void {
  assert.equal(report.schema, 'phase8g5c-flat-empty-check-v1'); assert.equal(report.project, OWNED_PROJECT);
  assert.equal(report.complete, false); assert.equal(report.eligible, false); assert.equal(report.populatedScaleAccepted, false);
  assert.equal(report.error, undefined); assert.equal(report.emptyOccupancyMatches, true);
  assert.deepEqual(report.tracks, population.after);
  assert.equal((report.stats as Wire).initEpochMs, (population.stats as Wire).initEpochMs);
  verifyAllocation(report.before as Wire, 512, true); verifyAllocation(report.after as Wire, 512, true);
  const first = report.processBefore as Wire, second = report.processAfter as Wire;
  const interval = Number(second.capturedEpochMs) - Number(first.capturedEpochMs);
  assert(interval >= 5000); assert.equal(report.idleIntervalMs, interval);
  assert.deepEqual(report.idleCpu, intervalCpu(first.rows as Wire[], second.rows as Wire[], interval));
  const reads = report.topologyReads as Wire[]; assert.equal(reads.length, 3);
  reads.forEach(read => verifyFlatScale(read, population.after as Wire));
  for (const key of ['scanBefore', 'scanAfter']) {
    const scan = report[key] as Wire;
    assert.equal(scan.slotsWithContent, 0); assert.equal(scan.existing, 258); assert.equal(scan.withChannelId, 258);
    assert.equal(scan.itemCount, 258); assert.equal(scan.bankSize, 512); assert.equal(scan.sceneCount, 8);
  }
  const list = (report.publication as Wire).list as Wire, rebuild = list.inventoryRebuild as Wire;
  assert.equal(list.complete, false); assert.equal(list.eligible, false); assert.deepEqual(publishedOccupancy(list), []);
  assert.equal(rebuild.phase, 'published'); assert.equal(rebuild.registryPublished, true); assert.equal(rebuild.fullInventoryEnumerated, true);
  assert.equal(rebuild.enumeratedCells, 258 * 8); assert.equal(rebuild.totalCells, 258 * 8); assert.equal(rebuild.presentClips, 0);
  assert(Number(rebuild.elapsedMs) <= 40_000); assert(Number(rebuild.lastBatchMs) <= 45);
  const resources = list.slotSourceResources as Wire;
  assert.equal(resources.admittedTracks, 512); assert.equal(resources.admittedScenes, 128);
  assert.equal(resources.slotObservers, 512); assert.equal(resources.observedSlotHandles, 65536); assert.equal(resources.newHostHandles, 0);
}
export function verifyFlatSeed(report: Wire, population: Wire): void {
  assert.equal(report.schema, 'phase8g5c-flat-seed-v1'); assert.equal(report.project, OWNED_PROJECT);
  assert.equal(report.complete, false); assert.equal(report.eligible, false); assert.equal(report.populatedScaleAccepted, false);
  assert.equal(report.error, undefined); assert.equal(report.flatNotesMatched, true); assert.deepEqual(report.census, population.after);
  const rows = fullTracks(population.after as Wire), seeds = report.seeds as Wire[], comparisons = report.comparisons as Wire[];
  assert.equal(seeds.length, 2); assert.equal(comparisons.length, 2);
  for (let index = 0; index < 2; index++) {
    const seed = seeds[index]!; assert.equal(seed.trackId, rows[index === 0 ? 0 : 255]!.channelId);
    assert.equal(seed.pitch, index === 0 ? 60 : 72); verifySeed(seed);
    assert.deepEqual(independentNotes(seed.notes as Wire), independentNotes(seed.confirmationNotes as Wire));
    verifyComparison(comparisons[index]!, seed, COUNTED_ALLOCATION_MARKER);
  }
  const operations = report.operations as Wire[]; assert.equal(operations.length, 4);
  operations.forEach((operation, index) => {
    const seed = seeds[Math.floor(index / 2)]!;
    assert.equal(operation.trackId, seed.trackId); assert.equal(operation.row, index % 2); assert.equal(operation.stage, 'verified');
    verifySeed({ ...seed, notes: operation.notes });
  });
  assert.equal((report.scanAfter as Wire).slotsWithContent, 4);
}
export function verifyWideArm(report: Wire, seed: Wire, population: Wire): void {
  assert.equal(report.schema, 'phase8g5c-wide-arm-v1'); assert.equal(report.project, OWNED_PROJECT);
  assert.equal(report.complete, false); assert.equal(report.eligible, false); assert.equal(report.populatedScaleAccepted, false);
  assert.equal(report.error, undefined); assert.equal(report.armed, true); assert.deepEqual(report.tracks, population.after);
  const expected = (seed.seeds as Wire[]).flatMap(state => [0, 1].map(row => `${String(state.trackId)}:${row}`)).sort();
  for (const key of ['firstScan', 'secondScan']) {
    const scan = report[key] as Wire; assert.deepEqual(scan.tracks, population.after); assert.equal(scan.sceneCount, 8);
    assert.deepEqual(scan.groupIds, []); const slots = scan.slots as Wire[]; assert.equal(slots.length, 258 * 8);
    fullTracks(population.after as Wire).forEach((track, index) => {
      for (let row = 0; row < 8; row++) {
        const slot = slots[index * 8 + row]!; assert.equal(slot.trackId, track.channelId); assert.equal(slot.row, row);
        assert.equal(typeof slot.exists, 'boolean'); assert.equal(typeof slot.hasContent, 'boolean');
      }
    });
    assert.deepEqual(scanOccupancy(scan).clips, expected);
  }
  assert.deepEqual((report.firstScan as Wire).slots, (report.secondScan as Wire).slots);
  assert.deepEqual(report.declaredOccupancy, expected);
  assert.deepEqual(publishedOccupancy((report.publication as Wire).list as Wire), expected);
  verifyFlatScale(report.topology as Wire, population.after as Wire);
  verifyComparison(report.before as Wire, (seed.seeds as Wire[])[0]!, COUNTED_ALLOCATION_MARKER);
  const active = report.active as Wire; assert.equal(active.comparison, 'pending'); assert.equal(active.scanStage, 'membership');
  assert.equal(active.complete, false); assert.equal(active.eligible, false);
}
