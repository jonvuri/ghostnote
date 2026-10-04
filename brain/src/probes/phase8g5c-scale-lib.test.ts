import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { createdTrack, fullTracks, verifyFlatScale, verifyPopulation, verifyFlatEmpty, verifyFlatSeed, verifyWideArm,
  wideOracle, verifyCountedScale, verifyWideFirst, verifyWideResult, verifyNestedArm, nestedOracle,
  verifyNestedFirst, verifyNestedResult, verifyBoundaryArm, boundaryOracle, verifyBoundaryFirst,
  verifyBoundaryResult, verifyCollapseArm, toggleOracle, verifyToggleFirst, verifyCollapseResult,
  verifyCollapseDiagnostic, verifyExpandArm, verifyExpandResult, verifyUngroupArm, ungroupOracle,
  verifyUngroupFirst, verifyUngroupResult, verify512Population, verify512Result, ownedExcessTrack,
  verify512Excess, verify512ExcessConfirmation } from './phase8g5c-scale-lib.js';
import { verifySeed } from './phase8g4-native-lib.js';
import type { Wire } from './phase8g5c-storage-lib.js';
const sample = JSON.parse(readFileSync(new URL('../../../context/evidence/data/phase8g5c-storage/counted-empty-512-3.json', import.meta.url), 'utf8')) as Wire;
const root = new URL('../../../context/evidence/data/phase8g5c-storage/', import.meta.url);
const read = (name: string): Wire => {
  const bytes = readFileSync(new URL(name, root)); return JSON.parse((name.endsWith('.gz') ? gunzipSync(bytes) : bytes).toString()) as Wire;
};

test('native ungroup restores the original flat UUID order and both clip contents', () => {
  const first = read('ungroup-first-read.json.gz'), arm = read('ungroup-arm.json.gz');
  const population = read('flat-population.json.gz'), result = read('ungroup-result.json.gz'), seed = read('flat-seed.json.gz');
  verifyUngroupFirst(first, arm, population); verifyUngroupResult(result, first, arm, population, seed);
  const changed = structuredClone(first); (changed.retired as Wire).scanActive = true;
  assert.throws(() => verifyUngroupFirst(changed, arm, population));
});
test('the 512 journal proves all 254 creates and their actual positions', () => {
  const population = read('512-population.json.gz'), ungroup = read('ungroup-result.json.gz');
  verify512Population(population, ungroup);
  assert.throws(() => verify512Population({ ...population, operations: (population.operations as Wire[]).slice(1) }, ungroup));
  const operations = [...population.operations as Wire[]], first = structuredClone(operations[0]!);
  (first.created as Wire).position = 0; operations[0] = first;
  assert.throws(() => verify512Population({ ...population, operations }, ungroup));
});
test('512 equality needs the new end content and every independent slot', () => {
  const population = read('512-population.json.gz'), result = read('512-result.json.gz'), seed = read('flat-seed.json.gz');
  verify512Result(result, population, seed); verifySeed(result.endSeed as Wire, [84]);
  assert.throws(() => verifySeed(result.endSeed as Wire));
  for (const mutate of [
    (value: Wire) => { (value.endSeed as Wire).trackId = ((seed.seeds as Wire[])[0] as Wire).trackId; },
    (value: Wire) => { (value.firstScan as Wire).slots = ((value.firstScan as Wire).slots as Wire[]).slice(8); },
    (value: Wire) => { (((value.publication as Wire).list as Wire).inventoryRebuild as Wire).enumeratedCells = 4095; },
    (value: Wire) => { (value.comparisons as Wire[])[2] = (value.comparisons as Wire[])[0]!; },
  ]) { const changed = structuredClone(result); mutate(changed); assert.throws(() => verify512Result(changed, population, seed)); }
});
test('513 cleanup is restricted to the unique owned empty track and rejects partial admission', () => {
  const boundary = read('512-result.json.gz'), excess = read('512-excess.json.gz'), seed = read('flat-seed.json.gz');
  const confirmation = read('512-excess-confirmation.json.gz');
  verify512ExcessConfirmation(confirmation, excess, boundary, seed);
  assert.throws(() => verify512Excess(excess, boundary, seed));
  assert.throws(() => fullTracks(excess.excessTracks as Wire));
  const wrong = structuredClone(excess.excessTracks as Wire); (wrong.tracks as Wire[])[0]!.channelId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  assert.throws(() => ownedExcessTrack(excess.before as Wire, wrong));
  for (const mutate of [
    (value: Wire) => { (value.deletion as Wire).trackId = (boundary.endSeed as Wire).trackId; },
    (value: Wire) => { (value.inventory as Wire).occupancyAdmitted = true; },
    (value: Wire) => { (value.rebuild as Wire).reason = 'slot-coverage-track-limit'; },
    (value: Wire) => { (value.emptyExcessSlots as Wire[])[0]!.hasContent = true; },
    (value: Wire) => { value.error = 'other failure'; },
  ]) { const changed = structuredClone(excess); mutate(changed); assert.throws(() => verify512Excess(changed, boundary, seed, true)); }
});

test('a fixture create needs exactly one new Instrument UUID and preserves prior tracks', () => {
  const before = sample.tracks as Wire, after = structuredClone(before), rows = after.tracks as Wire[];
  const added = { index: 2, position: 2, name: 'Inst 3', type: 'Instrument', channelId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' };
  rows.splice(2, 0, added); rows.forEach((row, index) => { row.index = index; }); after.count = after.itemCount = rows.length;
  assert.deepEqual(createdTrack(before, after), added);
  for (const mutate of [
    (value: Wire) => { value.itemCount = 513; },
    (value: Wire) => { (value.tracks as Wire[])[2]!.type = 'Audio'; },
    (value: Wire) => { (value.tracks as Wire[])[0]!.channelId = added.channelId; },
    (value: Wire) => { (value.tracks as Wire[])[0]!.name = 'changed'; },
    (value: Wire) => {
      const current = value.tracks as Wire[]; [current[0], current[1]] = [current[1]!, current[0]!];
      current.forEach((row, index) => { row.index = index; });
    },
  ]) { const changed = structuredClone(after); mutate(changed); assert.throws(() => createdTrack(before, changed)); }
  const partial = structuredClone(before); partial.bankSize = 256; assert.throws(() => fullTracks(partial));
});
test('counted wide membership needs every declared child and the final UUID master witness', () => {
  const population = read('flat-population.json.gz'), first = read('wide-first-read.json.gz');
  const oracle = wideOracle(population, first.tracks as Wire), group = oracle.roots[0]!;
  verifyCountedScale(first.topology as Wire, first.tracks as Wire, oracle);
  for (const mutate of [
    (value: Wire) => { for (const key of ['first', 'second']) (((value.candidates as Wire)[key] as Wire).children as Wire)[group] = { count: 256, offset: 255 }; },
    (value: Wire) => { for (const key of ['first', 'second']) {
      const count = ((((value.candidates as Wire)[key] as Wire).children as Wire)[group] as Wire); (count.master as Wire).channelId = oracle.masterId;
    } },
    (value: Wire) => { for (const key of ['first', 'second']) {
      const count = ((((value.candidates as Wire)[key] as Wire).children as Wire)[group] as Wire); count.offset = 0;
    } },
    (value: Wire) => { ((value.tree as Wire).children as Wire)[group] = { count: 0, offset: 0, ids: [] }; },
  ]) { const changed = structuredClone(first.topology as Wire); mutate(changed); assert.throws(() => verifyCountedScale(changed, first.tracks as Wire, oracle)); }
  const changed = structuredClone(oracle); changed.children[group]!.pop();
  assert.throws(() => verifyCountedScale(first.topology as Wire, first.tracks as Wire, changed));
});
test('native wide retirement uses terminal counters and refuses stale or published state', () => {
  const population = read('flat-population.json.gz'), first = read('wide-first-read.json.gz'), arm = read('wide-arm.json.gz');
  verifyWideFirst(first, arm, population); assert.equal((first.retired as Wire).scanId, undefined);
  for (const mutate of [
    (value: Wire) => { (value.retired as Wire).windowChanges = (arm.active as Wire).windowChanges; },
    (value: Wire) => { (value.retired as Wire).authorityScans = Number((arm.active as Wire).authorityScans) + 1; },
    (value: Wire) => { (value.retired as Wire).scanActive = true; },
    (value: Wire) => { (value.info as Wire).registryPublished = true; },
  ]) { const changed = structuredClone(first); mutate(changed); assert.throws(() => verifyWideFirst(changed, arm, population)); }
});
test('wide recovery excludes mirror slots, matches both clips, and arms only the declared nested operation', () => {
  const population = read('flat-population.json.gz'), first = read('wide-first-read.json.gz'), arm = read('wide-arm.json.gz');
  const seed = read('flat-seed.json.gz'), wide = read('wide-result.json.gz'), nested = read('nested-arm.json.gz');
  verifyWideResult(wide, first, arm, seed, population); verifyNestedArm(nested, wide, seed);
  const wrong = structuredClone(wide); (wrong.scanOccupancy as Wire).clips = (wrong.scanOccupancy as Wire).groupSlots;
  assert.throws(() => verifyWideResult(wrong, first, arm, seed, population));
  const changed = structuredClone(nested); (changed.declaration as Wire).parentId = (wide.oracle as Wire).masterId;
  assert.throws(() => verifyNestedArm(changed, wide, seed));
});
test('the populated journal proves every create and rejects gaps or foreign state', () => {
  const population = read('flat-population.json.gz'), baseline = read('new8-baseline.json'), prior = read('counted-empty-0-3.json');
  verifyPopulation(population, baseline, prior);
  for (const mutate of [
    (value: Wire) => { value.project = 'New 3'; },
    (value: Wire) => { (value.operations as Wire[]).pop(); },
    (value: Wire) => { (value.operations as Wire[])[0]!.stage = 'requested'; },
    (value: Wire) => { value.populatedScaleAccepted = true; },
    (value: Wire) => { (value.stats as Wire).initEpochMs = (prior.stats as Wire).initEpochMs; },
    (value: Wire) => { (value.flatOracle as Wire).roots = []; },
  ]) { const changed = structuredClone(population); mutate(changed); assert.throws(() => verifyPopulation(changed, baseline, prior)); }
});
test('nested membership follows UUIDs through native name changes and checks both masters', () => {
  const wide = read('wide-result.json.gz'), arm = read('nested-arm.json.gz'), first = read('nested-first-read.json.gz');
  const oracle = verifyNestedFirst(first, arm, wide), groups = Object.keys(oracle.children);
  assert.equal(oracle.children[groups[0]!]!.length, 255); assert.equal(oracle.children[groups[1]!]!.length, 2);
  const prior = fullTracks(wide.tracks as Wire), current = fullTracks(first.tracks as Wire);
  assert.notEqual(prior[3]!.name, current[4]!.name);
  assert.equal(prior[3]!.channelId, current[4]!.channelId);
  const wrong = structuredClone(first.tracks as Wire); (wrong.tracks as Wire[])[4]!.type = 'Audio';
  assert.throws(() => nestedOracle(wide, wrong));
  for (const mutate of [
    (value: Wire) => { (value.retired as Wire).authorityScans = Number((arm.active as Wire).authorityScans) + 1; },
    (value: Wire) => { (value.info as Wire).registryPublished = true; },
    (value: Wire) => { for (const key of ['first', 'second']) {
      const count = (((((value.topology as Wire).candidates as Wire)[key] as Wire).children as Wire)[groups[1]!] as Wire);
      (count.master as Wire).channelId = groups[0];
    } },
  ]) { const changed = structuredClone(first); mutate(changed); assert.throws(() => verifyNestedFirst(changed, arm, wide)); }
});
test('nested recovery excludes every mirror and arms the declared boundary move', () => {
  const wide = read('wide-result.json.gz'), arm = read('nested-arm.json.gz'), first = read('nested-first-read.json.gz');
  const nested = read('nested-result.json.gz'), seed = read('flat-seed.json.gz'), boundary = read('boundary-arm.json.gz');
  verifyNestedResult(nested, first, arm, wide, seed); verifyBoundaryArm(boundary, nested, seed);
  const wrong = structuredClone(nested); ((wrong.firstScan as Wire).groupIds as string[]).pop();
  assert.throws(() => verifyNestedResult(wrong, first, arm, wide, seed));
  const moved = structuredClone(boundary); (moved.declaration as Wire).selected = (moved.declaration as Wire).beforeId;
  assert.throws(() => verifyBoundaryArm(moved, nested, seed));
});
test('a native boundary move changes direct degrees despite unchanged flat UUID order', () => {
  const nested = read('nested-result.json.gz'), arm = read('boundary-arm.json.gz'), first = read('boundary-first-read.json.gz');
  const oracle = verifyBoundaryFirst(first, arm, nested), prior = nested.oracle as unknown as typeof oracle;
  assert.deepEqual(oracle.flatOrder, prior.flatOrder); assert.deepEqual(oracle.roots, prior.roots);
  const [outer, inner] = Object.keys(oracle.children);
  assert.equal(oracle.children[outer!]!.length, 256); assert.equal(oracle.children[inner!]!.length, 1);
  assert.throws(() => verifyCountedScale(first.topology as Wire, first.tracks as Wire, prior));
  for (const mutate of [
    (value: Wire) => { (value.retired as Wire).windowChanges = (arm.active as Wire).windowChanges; },
    (value: Wire) => { (value.info as Wire).automaticIdentityInvalidations = (arm.info as Wire).automaticIdentityInvalidations; },
    (value: Wire) => { for (const key of ['first', 'second']) {
      const count = (((((value.topology as Wire).candidates as Wire)[key] as Wire).children as Wire)[inner!] as Wire);
      count.offset = 2;
    } },
  ]) { const changed = structuredClone(first); mutate(changed); assert.throws(() => verifyBoundaryFirst(changed, arm, nested)); }
  const wrong = structuredClone(first.tracks as Wire), rows = wrong.tracks as Wire[];
  [rows[3], rows[4]] = [rows[4]!, rows[3]!]; rows.forEach((row, index) => { row.index = index; });
  assert.throws(() => boundaryOracle(nested, wrong));
});
test('boundary recovery needs both content comparisons before the declared inner collapse', () => {
  const nested = read('nested-result.json.gz'), arm = read('boundary-arm.json.gz'), first = read('boundary-first-read.json.gz');
  const boundary = read('boundary-result.json.gz'), seed = read('flat-seed.json.gz'), collapse = read('collapse-arm.json.gz');
  verifyBoundaryResult(boundary, first, arm, nested, seed); verifyCollapseArm(collapse, boundary, seed);
  const wrong = structuredClone(boundary); (wrong.comparisons as Wire[])[1]!.comparison = 'window-changed';
  assert.throws(() => verifyBoundaryResult(wrong, first, arm, nested, seed));
  const changed = structuredClone(collapse); (changed.declaration as Wire).outerExpanded = false;
  assert.throws(() => verifyCollapseArm(changed, boundary, seed));
});
test('collapse changes only the declared inner flag and preserves both UUID masters', () => {
  const boundary = read('boundary-result.json.gz'), arm = read('collapse-arm.json.gz'), first = read('collapse-first-read.json.gz');
  const oracle = verifyToggleFirst(first, arm, boundary, false), prior = boundary.oracle as unknown as typeof oracle;
  assert.deepEqual(oracle.children, prior.children); assert.deepEqual(oracle.flatOrder, prior.flatOrder);
  assert.throws(() => verifyCountedScale(first.topology as Wire, first.tracks as Wire, prior));
  for (const mutate of [
    (value: Wire) => { (value.declaration as Wire).outerExpanded = false; },
    (value: Wire) => { (value.retired as Wire).scanActive = true; },
    (value: Wire) => { (value.stats as Wire).config = { tracks: 256, cacheTopologyTracks: 512, cacheTopologyCounted: true }; },
  ]) { const changed = structuredClone(first); mutate(changed); assert.throws(() => verifyToggleFirst(changed, arm, boundary, false)); }
});
test('the first collapsed binding diagnostic cannot claim a tail comparison or queue cleanup', () => {
  const boundary = read('boundary-result.json.gz'), arm = read('collapse-arm.json.gz'), first = read('collapse-first-read.json.gz');
  const seed = read('flat-seed.json.gz'), diagnostic = read('collapse-result-diagnostic.json.gz');
  verifyCollapseDiagnostic(diagnostic, first, arm, boundary, seed);
  for (const mutate of [
    (value: Wire) => { value.collapseChecksPassed = true; },
    (value: Wire) => { (value.primaryBinding as Wire).outcome = 'matched'; },
    (value: Wire) => { value.error = 'another failure'; },
    (value: Wire) => {
      const prefix = 'AssertionError [ERR_ASSERTION]: ', stalled = JSON.parse(String(value.error).slice(prefix.length)) as Wire;
      stalled.physicalPendingHints = 0; value.error = prefix + JSON.stringify(stalled);
    },
  ]) { const changed = structuredClone(diagnostic); mutate(changed); assert.throws(() => verifyCollapseDiagnostic(changed, first, arm, boundary, seed)); }
});
test('collapsed refusal must retire hints before tail recovery and expansion arming', () => {
  const boundary = read('boundary-result.json.gz'), arm = read('collapse-arm.json.gz'), first = read('collapse-first-read.json.gz');
  const collapse = read('collapse-result.json.gz'), seed = read('flat-seed.json.gz'), expand = read('expand-arm.json.gz');
  verifyCollapseResult(collapse, first, arm, boundary, seed); verifyExpandArm(expand, collapse, seed);
  assert.deepEqual(toggleOracle(collapse, collapse.tracks as Wire, true), boundary.oracle);
  for (const mutate of [
    (value: Wire) => { ((value.primaryBinding as Wire).retirement as Wire).physicalViewPendingHints = 32; },
    (value: Wire) => { (value.primaryBinding as Wire).comparison = (value.comparisons as Wire[])[0]; },
    (value: Wire) => { (value.primaryBinding as Wire).detail = (value.primaryBinding as Wire).status; },
    (value: Wire) => { value.topologyAfterBindings = boundary.topologyReads && (boundary.topologyReads as Wire[])[0]; },
  ]) { const changed = structuredClone(collapse); mutate(changed); assert.throws(() => verifyCollapseResult(changed, first, arm, boundary, seed)); }
  const wrong = structuredClone(expand); wrong.before = (seed.comparisons as Wire[])[0];
  assert.throws(() => verifyExpandArm(wrong, collapse, seed));
});
test('native expansion retires the tail arm and restores the declared inner flag', () => {
  const collapse = read('collapse-result.json.gz'), arm = read('expand-arm.json.gz'), first = read('expand-first-read.json.gz');
  const oracle = verifyToggleFirst(first, arm, collapse, true), prior = collapse.oracle as unknown as typeof oracle;
  assert.deepEqual(oracle.children, prior.children); assert.deepEqual(oracle.flatOrder, prior.flatOrder);
  assert.throws(() => verifyCountedScale(first.topology as Wire, first.tracks as Wire, prior));
  for (const mutate of [
    (value: Wire) => { (value.declaration as Wire).expanded = false; },
    (value: Wire) => { (value.retired as Wire).authorityScans = Number((arm.active as Wire).authorityScans) + 1; },
    (value: Wire) => { (value.info as Wire).registryPublished = true; },
  ]) { const changed = structuredClone(first); mutate(changed); assert.throws(() => verifyToggleFirst(changed, arm, collapse, true)); }
});
test('expanded recovery needs both content matches before child-preserving ungrouping', () => {
  const collapse = read('collapse-result.json.gz'), arm = read('expand-arm.json.gz'), first = read('expand-first-read.json.gz');
  const expanded = read('expand-result.json.gz'), seed = read('flat-seed.json.gz'), ungroup = read('ungroup-arm.json.gz');
  verifyExpandResult(expanded, first, arm, collapse, seed); verifyUngroupArm(ungroup, expanded, seed);
  const wrong = structuredClone(expanded); (wrong.comparisons as Wire[])[0]!.comparison = 'window-changed';
  assert.throws(() => verifyExpandResult(wrong, first, arm, collapse, seed));
  const changed = structuredClone(ungroup); (changed.declaration as Wire).keepAllChildrenAndClips = false;
  assert.throws(() => verifyUngroupArm(changed, expanded, seed));
});
test('ungrouping must restore every original UUID and type in flat order', () => {
  const population = read('flat-population.json.gz'), census = population.after as Wire;
  const oracle = ungroupOracle(population, census); assert.equal(oracle.roots.length, 258);
  assert.deepEqual(oracle.children, {}); assert.deepEqual(oracle.expanded, {});
  for (const mutate of [
    (value: Wire) => { (value.tracks as Wire[])[0]!.type = 'Group'; },
    (value: Wire) => { value.itemCount = 260; },
    (value: Wire) => { (value.tracks as Wire[])[0]!.channelId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'; },
  ]) { const changed = structuredClone(census); mutate(changed); assert.throws(() => ungroupOracle(population, changed)); }
});
test('flat empty occupancy needs full scans, confirmed publication, and the reported costs', () => {
  const population = read('flat-population.json.gz'), report = read('flat-empty-check.json.gz'); verifyFlatEmpty(report, population);
  for (const mutate of [
    (value: Wire) => { (value.scanAfter as Wire).slotsWithContent = 1; },
    (value: Wire) => { ((value.publication as Wire).list as Wire).occupancyAdmitted = false; },
    (value: Wire) => { (((value.publication as Wire).list as Wire).inventoryRebuild as Wire).enumeratedCells = 8; },
    (value: Wire) => { value.idleCpu = []; },
  ]) { const changed = structuredClone(report); mutate(changed); assert.throws(() => verifyFlatEmpty(changed, population)); }
});
test('flat notes prove both end tracks against authority before a native group trial', () => {
  const population = read('flat-population.json.gz'), seed = read('flat-seed.json.gz'); verifyFlatSeed(seed, population);
  for (const mutate of [
    (value: Wire) => { (value.seeds as Wire[])[1]!.trackId = (value.seeds as Wire[])[0]!.trackId; },
    (value: Wire) => { (value.comparisons as Wire[])[0]!.comparison = 'window-changed'; },
    (value: Wire) => { (value.operations as Wire[]).pop(); },
  ]) { const changed = structuredClone(seed); mutate(changed); assert.throws(() => verifyFlatSeed(changed, population)); }
});
test('the wide-group arm keeps the external slot scans and active comparison', () => {
  const population = read('flat-population.json.gz'), seed = read('flat-seed.json.gz'), report = read('wide-arm.json.gz');
  verifyWideArm(report, seed, population);
  for (const mutate of [
    (value: Wire) => { ((value.firstScan as Wire).slots as Wire[])[0]!.hasContent = false; },
    (value: Wire) => { (value.active as Wire).scanStage = 'enrichment'; },
    (value: Wire) => { value.declaredOccupancy = []; },
  ]) { const changed = structuredClone(report); mutate(changed); assert.throws(() => verifyWideArm(changed, seed, population)); }
});
test('flat scale compares the counted tree with an independent UUID census', () => {
  verifyFlatScale(sample.topology as Wire, sample.tracks as Wire);
  for (const mutate of [
    (value: Wire) => { value.membershipComplete = false; },
    (value: Wire) => { value.maximumTracks = 16; },
    (value: Wire) => { value.eligible = true; },
    (value: Wire) => { value.sequenceAfterRead = Number(value.sequenceBeforeRead) + 1; },
    (value: Wire) => { ((value.tree as Wire).roots as Wire).ids = []; },
    (value: Wire) => { (value.candidates as Wire).second = {}; },
    (value: Wire) => { (value.tree as Wire).children = { foreign: [] }; },
  ]) { const changed = structuredClone(sample.topology as Wire); mutate(changed); assert.throws(() => verifyFlatScale(changed, sample.tracks as Wire)); }
});
