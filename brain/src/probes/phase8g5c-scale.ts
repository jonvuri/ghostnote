/** Populate only the declared New 8 fixture. Record intent before each mutation. */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { gunzipSync } from 'node:zlib';
import { BridgeClient } from '../client.js';
import { parseSignature } from './e216-delivery-coherence-lib.js';
import { independentNotes, verifySeed, verifyComparison } from './phase8g4-native-lib.js';
import { createdTrack, fullTracks, verifyFlatScale, verifyPopulation, verifyCountedScale, verifyWideFirst, verifyWideResult,
  verifyNestedFirst, verifyNestedResult, verifyBoundaryArm, verifyBoundaryFirst, verifyBoundaryResult, verifyCollapseArm,
  verifyToggleFirst, verifyCollapseResult, verifyExpandArm, verifyExpandResult, verifyUngroupArm,
  verifyUngroupFirst, verifyUngroupResult, verify512Population, verify512Result, ownedExcessTrack, verify512Excess } from './phase8g5c-scale-lib.js';
import type { GroupOracle } from './phase8g5a-group-lib.js';
import { publishedOccupancy, scanOccupancy } from './phase8g5b-slot-lib.js';
import { COUNTED_ALLOCATION_MARKER, OWNED_PROJECT, intervalCpu, processes, verifyAllocation, type Wire } from './phase8g5c-storage-lib.js';

const bridge = new BridgeClient();
const request = async (method: string, params?: Wire): Promise<Wire> => await bridge.request(method, params, 30_000) as Wire;
const shadow = async (operation: string, params: Wire = {}): Promise<Wire> => request('cache.shadow', { operation, ...params });
const wait = async (ms = 100): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));
const read = async (path: string): Promise<Wire> => {
  let actual = path, bytes: Buffer;
  try { bytes = await readFile(actual); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT' || !path.endsWith('.json')) throw error;
    actual = path + '.gz'; bytes = await readFile(actual);
  }
  return JSON.parse((actual.endsWith('.gz') ? gunzipSync(bytes, { maxOutputLength: 64 * 1024 * 1024 }) : bytes).toString('utf8')) as Wire;
};
const execute = promisify(execFile);
async function processSample(): Promise<Wire> {
  const { stdout } = await execute('ps', ['-axo', 'pid=,ppid=,rss=,%cpu=,time=,comm=']);
  return { capturedEpochMs: Date.now(), rows: processes(stdout) };
}

async function guard(expectedInit?: number): Promise<Wire> {
  assert.equal(parseSignature(String((await shadow('deliveryStatus')).signature)).name, OWNED_PROJECT);
  assert.equal((await shadow('info')).instrumentationRevision, COUNTED_ALLOCATION_MARKER);
  const stats = await request('rig.stats'), config = stats.config as Wire;
  assert.equal(stats.runtimeProfile, 'phase-8-probe-v1');
  if (expectedInit !== undefined) assert.equal(stats.initEpochMs, expectedInit, 'controller changed during population');
  assert.equal(config.tracks, 512); assert.equal(config.cacheTopologyTracks, 512);
  assert.equal(config.cacheTopologyCounted, true); assert.equal(config.contentFilter, 'ALL_CHANNELS');
  assert.equal((await request('scene.count')).sceneCount, 8);
  return stats;
}
async function topology(census: Wire): Promise<Wire> {
  const deadline = Date.now() + 30_000;
  for (;;) {
    const value = await shadow('trackTopology');
    if (value.membershipComplete === true) { verifyFlatScale(value, census); return value; }
    assert(Date.now() < deadline, `flat topology did not settle: ${JSON.stringify(value)}`); await wait();
  }
}

async function populate(path: string, baselinePath: string, priorPath: string): Promise<void> {
  const baseline = await read(baselinePath);
  assert.equal(baseline.schema, 'phase8g5c-fixture-entry-v1'); assert.equal(baseline.project, OWNED_PROJECT);
  assert.equal(baseline.emptySlotsVerified, true);
  const expected = (baseline.first as Wire).tracks as Wire;
  assert.equal(fullTracks(expected).length, 4);
  const prior = await read(priorPath); assert.equal(prior.schema, 'phase8g5c-allocation-v1');
  assert.equal(prior.project, OWNED_PROJECT); assert.equal(prior.capacity, 0);
  assert.equal(prior.instrumentationRevision, COUNTED_ALLOCATION_MARKER); assert.equal(prior.error, undefined);
  const stats = await guard(), initialization = Number(stats.initEpochMs);
  assert(initialization > Number((prior.stats as Wire).initEpochMs), 'population needs a fresh counted-512 controller');
  const hello = await request('contract.hello');
  assert.equal(hello.runtimeProfile, 'phase-8-probe-v1'); assert.equal(hello.methodCount, 97);
  assert.equal(hello.methodsHash, 'f03f19414f40e3d3');
  const before = await request('track.list'); assert.deepEqual(before, expected);
  const scan = await request('rig.scanTracks'); assert.equal(scan.slotsWithContent, 0);
  const report: Wire = { schema: 'phase8g5c-flat-population-v1', project: OWNED_PROJECT, baselinePath, priorPath, hello, stats,
    captured: new Date().toISOString(), complete: false, eligible: false, populatedScaleAccepted: false,
    targetBaseTracks: 256, before, scanBefore: scan, topologyBefore: await topology(before), operations: [] };
  await writeFile(path, JSON.stringify(report, null, 1) + '\n', { flag: 'wx' });
  const persist = async (): Promise<void> => writeFile(path, JSON.stringify(report, null, 1) + '\n');
  let current = before;
  try {
    while (fullTracks(current).filter(row => ['Instrument', 'Audio'].includes(row.type)).length < 256) {
      await guard(initialization); assert.deepEqual(await request('track.list'), current, 'fixture changed before create');
      const position = fullTracks(current).length - 2;
      const operation: Wire = { stage: 'intent', position, before: current, started: new Date().toISOString() };
      (report.operations as Wire[]).push(operation); await persist();
      operation.response = await request('track.create', { position }); operation.stage = 'requested'; await persist();
      const deadline = Date.now() + 30_000;
      let next: Wire;
      for (;;) {
        await guard(initialization); next = await request('track.list');
        if (Number(next.itemCount) !== Number(current.itemCount)) break;
        assert(Date.now() < deadline, 'created track has no delivered census'); await wait();
      }
      operation.after = next; await persist();
      const added = createdTrack(current, next); operation.created = added;
      await wait(); await guard(initialization); assert.deepEqual(await request('track.list'), next, 'create did not settle');
      operation.stage = 'verified'; operation.finished = new Date().toISOString(); current = next; await persist();
      if ((report.operations as Wire[]).length % 32 === 0) console.log(JSON.stringify({ created: (report.operations as Wire[]).length }));
    }
    await guard(initialization); report.after = current; report.topologyAfter = await topology(current);
    report.scanAfter = await request('rig.scanTracks'); assert.equal((report.scanAfter as Wire).slotsWithContent, 0);
    const rows = fullTracks(current);
    report.flatOracle = { project: OWNED_PROJECT, roots: rows.map(row => row.channelId), children: {},
      flatOrder: rows.map(row => row.channelId), expanded: {},
      masterId: rows.find(row => row.type === 'Master')!.channelId,
      source: 'entry UUIDs and one verified census delta per native API create' };
    report.baseTracks = rows.filter(row => ['Instrument', 'Audio'].includes(row.type)).length;
    assert.equal(report.baseTracks, 256); assert.equal(rows.length, 258);
    report.finished = new Date().toISOString(); report.populationVerified = true;
  } catch (error) { report.error = String(error); throw error; }
  finally { await persist(); }
  console.log(JSON.stringify({ project: OWNED_PROJECT, baseTracks: report.baseTracks,
    totalChannels: fullTracks(current).length, populationVerified: true, populatedScaleAccepted: false }));
}
async function populate512(path: string, ungroupPath: string): Promise<void> {
  const ungroup = await read(ungroupPath), first = await read(String(ungroup.firstPath)), arm = await read(String(ungroup.armPath));
  const seed = await seedFor(arm), population = await read(String(seed.sourcePath));
  verifyUngroupResult(ungroup, first, arm, population, seed);
  const initialization = Number((population.stats as Wire).initEpochMs), stats = await guard(initialization);
  let current = await request('track.list'); assert.deepEqual(current, ungroup.tracks);
  const report: Wire = { schema: 'phase8g5c-512-population-v1', project: OWNED_PROJECT, ungroupPath, stats,
    captured: new Date().toISOString(), complete: false, eligible: false, populatedScaleAccepted: false,
    targetTotalChannels: 512, before: current, topologyBefore: await topology(current),
    scanBefore: await request('rig.scanTracks'), operations: [] };
  assert.equal((report.scanBefore as Wire).slotsWithContent, 4);
  await writeFile(path, JSON.stringify(report, null, 1) + '\n', { flag: 'wx' });
  const persist = async (): Promise<void> => writeFile(path, JSON.stringify(report, null, 1) + '\n');
  try {
    while (fullTracks(current).length < 512) {
      await guard(initialization); assert.deepEqual(await request('track.list'), current);
      const operation: Wire = { stage: 'intent', position: fullTracks(current).length - 2, before: current,
        started: new Date().toISOString() };
      (report.operations as Wire[]).push(operation); await persist();
      operation.response = await request('track.create', { position: operation.position }); operation.stage = 'requested'; await persist();
      const next = await until(() => request('track.list'), value => Number(value.itemCount) !== Number(current.itemCount));
      operation.after = next; await persist(); const added = createdTrack(current, next);
      operation.created = added; assert.equal(added.index, operation.position); assert.equal(added.position, operation.position);
      await wait(); await guard(initialization); assert.deepEqual(await request('track.list'), next);
      operation.stage = 'verified'; operation.finished = new Date().toISOString(); current = next; await persist();
      if ((report.operations as Wire[]).length % 32 === 0) console.log(JSON.stringify({ created: (report.operations as Wire[]).length, channels: fullTracks(current).length }));
    }
    report.after = current; report.topologyAfter = await topology(current); report.scanAfter = await request('rig.scanTracks');
    report.allocationAfter = await shadow('allocationStats'); report.populationVerified = true; report.finished = new Date().toISOString();
    verify512Population(report, ungroup);
  } catch (error) { report.error = String(error); throw error; }
  finally { await persist(); }
  console.log(JSON.stringify({ totalChannels: 512, baseTracks: 510, populationVerified: true, populatedScaleAccepted: false }));
}

/** Measure the populated empty fixture. Rig scans use stable handlers outside the cache inventory. */
async function flatCheck(path: string, sourcePath: string): Promise<void> {
  const source = await read(sourcePath);
  verifyPopulation(source, await read(String(source.baselinePath)), await read(String(source.priorPath)));
  const initialization = Number((source.stats as Wire).initEpochMs), stats = await guard(initialization);
  const census = await request('track.list'); assert.deepEqual(census, source.after);
  const report: Wire = { schema: 'phase8g5c-flat-empty-check-v1', project: OWNED_PROJECT, sourcePath, stats,
    complete: false, eligible: false, populatedScaleAccepted: false, captured: new Date().toISOString() };
  try {
    report.before = await shadow('allocationStats'); verifyAllocation(report.before as Wire, 512, true);
    report.processBefore = await processSample(); await wait(5000); report.processAfter = await processSample();
    const first = report.processBefore as Wire, second = report.processAfter as Wire;
    report.idleIntervalMs = Number(second.capturedEpochMs) - Number(first.capturedEpochMs);
    report.idleCpu = intervalCpu(first.rows as Wire[], second.rows as Wire[], Number(report.idleIntervalMs));
    const reads: Wire[] = [];
    for (let index = 0; index < 3; index++) reads.push(await topology(census));
    report.topologyReads = reads;
    report.scanBefore = await request('rig.scanTracks'); assert.equal((report.scanBefore as Wire).slotsWithContent, 0);
    const started = Date.now(), begun = await shadow('rebuildBegin'), polls: Wire[] = [];
    let list: Wire;
    for (;;) {
      await guard(initialization); const polled = await shadow('rebuildPoll');
      const rebuild = polled.inventoryRebuild as Wire;
      polls.push({ enumeratedCells: rebuild?.enumeratedCells, registryPhase: rebuild?.phase,
        rebuildTerminal: polled.rebuildTerminal, fallbackReason: polled.fallbackReason });
      list = await shadow('inventoryList');
      if (list.occupancyAdmitted === true) break;
      assert(Date.now() - started < 40_000, `empty occupancy did not publish: ${String(list.reason)}`);
      assert(polled.rebuildTerminal !== true || list.reason === 'slot-window-pending', JSON.stringify(polled)); await wait(20);
    }
    assert.deepEqual(publishedOccupancy(list), []);
    report.publication = { begun, polls, list, wallMs: Date.now() - started };
    report.scanAfter = await request('rig.scanTracks'); assert.equal((report.scanAfter as Wire).slotsWithContent, 0);
    assert.deepEqual(await request('track.list'), census); report.tracks = census;
    report.after = await shadow('allocationStats'); verifyAllocation(report.after as Wire, 512, true);
    report.emptyOccupancyMatches = true; report.finished = new Date().toISOString();
  } catch (error) { report.error = String(error); throw error; }
  finally { await writeFile(path, JSON.stringify(report, null, 1) + '\n', { flag: 'wx' }); }
  console.log(JSON.stringify({ emptyOccupancyMatches: true, totalChannels: 258, populatedScaleAccepted: false }));
}
async function until(next: () => Promise<Wire>, done: (value: Wire) => boolean): Promise<Wire> {
  const deadline = Date.now() + 40_000;
  for (;;) { const value = await next(); if (done(value)) return value; assert(Date.now() < deadline, JSON.stringify(value)); await wait(50); }
}
async function writer(trackId: string, row: number, census: Wire, initialization: number): Promise<void> {
  await guard(initialization); assert.deepEqual(await request('track.list'), census);
  const track = fullTracks(census).find(value => value.channelId === trackId); assert(track);
  assert.equal(fullTracks(census).filter(value => value.name === track.name).length, 1);
  const cursor = 'fine';
  await request('cursor.pin', { cursor, pinned: false }); await request('cursor.pinTrack', { cursor, pinned: false });
  await request('cursor.pointTrack', { cursor, trackIndex: track.index });
  await request('slot.select', { trackIndex: track.index, slotIndex: row, mechanism: 'track' });
  await until(() => request('cursor.status', { cursor }), value => value.slotExists === true && value.sceneIndex === row
    && value.trackName === track.name && value.trackPosition === track.position);
  await request('cursor.pinTrack', { cursor, pinned: true }); await request('cursor.pin', { cursor, pinned: true });
  await request('cursor.setStepSize', { cursor, stepSize: 1 / 512 }); await request('cursor.scrollToStep', { cursor, step: 0 }); await wait(200);
}
async function compareSeed(state: Wire, index: number, census: Wire, initialization: number): Promise<Wire> {
  const pitches = state.pitch === 84 ? [84] : [60, 72];
  await guard(initialization); assert.deepEqual(await request('track.list'), census); verifySeed(state, pitches);
  const track = fullTracks(census).find(row => row.channelId === state.trackId); assert(track);
  await shadow('point', { index, trackIndex: track.index, row: 0, canaryTrackIndex: track.index, canaryRow: 1 });
  const settled = await until(() => shadow('poll', { index }), value => value.phase === 'retired'
    || (['settled', 'complete'].includes(String(value.phase)) && value.canaryPhase === 'target'));
  assert.notEqual(settled.phase, 'retired', JSON.stringify(settled)); assert.equal(settled.canaryVerifiedForBinding, true);
  await until(() => shadow('reconcile', { index }), value => value.physicalPendingHints === 0 && value.pendingCoordinates === 0);
  const ping: number[] = [];
  for (let sample = 0; sample < 25; sample++) { const start = performance.now(); await request('ping'); ping.push(performance.now() - start); }
  await shadow('ping', { p95Ms: [...ping].sort((a, b) => a - b)[Math.ceil(ping.length * .95) - 1] });
  let value = await shadow('compareStart', { index });
  value = await until(async () => value.comparison === 'pending' ? (value = await shadow('comparePoll')) : value,
    next => next.comparison !== 'pending');
  verifyComparison(value, state, COUNTED_ALLOCATION_MARKER, pitches); return { ...value, driverPingSamplesMs: ping };
}
/** Seed and compare clips at both ends of the base-track range. */
async function seedFlat(path: string, sourcePath: string): Promise<void> {
  const source = await read(sourcePath);
  verifyPopulation(source, await read(String(source.baselinePath)), await read(String(source.priorPath)));
  const census = source.after as Wire, initialization = Number((source.stats as Wire).initEpochMs);
  await guard(initialization); assert.deepEqual(await request('track.list'), census);
  assert.equal((await request('rig.scanTracks')).slotsWithContent, 0);
  const rows = fullTracks(census), tracks = [rows[0]!, rows[255]!];
  assert(tracks.every(row => row.type === 'Instrument'));
  const report: Wire = { schema: 'phase8g5c-flat-seed-v1', project: OWNED_PROJECT, sourcePath,
    complete: false, eligible: false, populatedScaleAccepted: false, captured: new Date().toISOString(), census, seeds: [], operations: [] };
  await writeFile(path, JSON.stringify(report, null, 1) + '\n', { flag: 'wx' });
  const persist = async (): Promise<void> => writeFile(path, JSON.stringify(report, null, 1) + '\n');
  try {
    for (let index = 0; index < tracks.length; index++) {
      const track = tracks[index]!, pitch = index === 0 ? 60 : 72;
      const state: Wire = { project: OWNED_PROJECT, trackId: track.channelId, pitch, clipName: `gn-8g4-${pitch}`, ownedRows: [0, 1] };
      for (const row of [0, 1]) {
        await guard(initialization); assert.deepEqual(await request('track.list'), census);
        assert.equal((await request('slot.status', { trackIndex: track.index, slotIndex: row })).hasContent, false);
        const operation: Wire = { trackId: track.channelId, row, stage: 'intent' };
        (report.operations as Wire[]).push(operation); await persist();
        await request('clip.create', { trackIndex: track.index, slotIndex: row, lengthBeats: 4 }); await wait(200);
        await writer(track.channelId, row, census, initialization);
        await request('cursor.setClipMetadata', { cursor: 'fine', name: row === 0 ? state.clipName : `gn-8g5c-canary-${pitch}` });
        for (let channel = 0; channel < 16; channel++) await request('cursor.setNotes', { cursor: 'fine', channel,
          notes: Array.from({ length: 4 }, (_, cell) => [cell * 8, pitch + cell, 80 + channel, 8 / 512]) });
        await wait(200); operation.notes = await request('cursor.getNotesVerboseAllChannels', { cursor: 'fine', maxX: 2048 });
        verifySeed({ ...state, notes: operation.notes }); operation.stage = 'verified'; await persist();
      }
      await writer(track.channelId, 0, census, initialization);
      state.notes = await request('cursor.getNotesVerboseAllChannels', { cursor: 'fine', maxX: 2048 });
      state.confirmationNotes = await request('cursor.getNotesVerboseAllChannels', { cursor: 'fine', maxX: 2048 });
      state.metadata = await request('cursor.clipMetadata', { cursor: 'fine' }); verifySeed(state);
      assert.deepEqual(independentNotes(state.notes as Wire), independentNotes(state.confirmationNotes as Wire));
      (report.seeds as Wire[]).push(state); await persist();
    }
    report.comparisons = [];
    for (let index = 0; index < tracks.length; index++) {
      (report.comparisons as Wire[]).push(await compareSeed((report.seeds as Wire[])[index]!, index, census, initialization)); await persist();
    }
    report.scanAfter = await request('rig.scanTracks'); assert.equal((report.scanAfter as Wire).slotsWithContent, 4);
    report.finished = new Date().toISOString(); report.flatNotesMatched = true;
  } catch (error) { report.error = String(error); throw error; }
  finally { await persist(); }
  console.log(JSON.stringify({ flatNotesMatched: true, residentClips: 2, ownedClips: 4, totalChannels: 258 }));
}
/** Seed the new last instrument, then check all three known note clips. */
async function check512(path: string, populationPath: string): Promise<void> {
  const population = await read(populationPath), ungroup = await read(String(population.ungroupPath));
  verify512Population(population, ungroup);
  const arm = await read(String(ungroup.armPath)), seed = await seedFor(arm), states = seed.seeds as Wire[];
  const census = population.after as Wire, initialization = Number((population.stats as Wire).initEpochMs);
  await guard(initialization); assert.deepEqual(await request('track.list'), census);
  const track = fullTracks(census)[509]!; assert.equal(track.type, 'Instrument');
  const state: Wire = { project: OWNED_PROJECT, trackId: track.channelId, pitch: 84, clipName: 'gn-8g4-84', ownedRows: [0, 1] };
  const report: Wire = { schema: 'phase8g5c-512-result-v1', project: OWNED_PROJECT, populationPath,
    complete: false, eligible: false, populatedScaleAccepted: false, captured: new Date().toISOString(), operations: [], endSeed: state };
  await writeFile(path, JSON.stringify(report, null, 1) + '\n', { flag: 'wx' });
  const persist = async (): Promise<void> => writeFile(path, JSON.stringify(report, null, 1) + '\n');
  try {
    assert.equal((await request('rig.scanTracks')).slotsWithContent, 4);
    for (const row of [0, 1]) {
      await guard(initialization); assert.deepEqual(await request('track.list'), census);
      assert.equal((await request('slot.status', { trackIndex: track.index, slotIndex: row })).hasContent, false);
      const operation: Wire = { trackId: track.channelId, row, stage: 'intent' }; (report.operations as Wire[]).push(operation); await persist();
      operation.created = await request('clip.create', { trackIndex: track.index, slotIndex: row, lengthBeats: 4 }); await wait(200);
      await writer(track.channelId, row, census, initialization);
      await request('cursor.setClipMetadata', { cursor: 'fine', name: row === 0 ? state.clipName : 'gn-8g5c-canary-84' });
      for (let channel = 0; channel < 16; channel++) await request('cursor.setNotes', { cursor: 'fine', channel,
        notes: Array.from({ length: 4 }, (_, cell) => [cell * 8, 84 + cell, 80 + channel, 8 / 512]) });
      await wait(200); operation.notes = await request('cursor.getNotesVerboseAllChannels', { cursor: 'fine', maxX: 2048 });
      verifySeed({ ...state, notes: operation.notes }, [84]); operation.stage = 'verified'; await persist();
    }
    await writer(track.channelId, 0, census, initialization);
    state.notes = await request('cursor.getNotesVerboseAllChannels', { cursor: 'fine', maxX: 2048 });
    state.confirmationNotes = await request('cursor.getNotesVerboseAllChannels', { cursor: 'fine', maxX: 2048 });
    state.metadata = await request('cursor.clipMetadata', { cursor: 'fine' }); verifySeed(state, [84]); await persist();
    report.topologyReads = [];
    for (let index = 0; index < 3; index++) (report.topologyReads as Wire[]).push(await topology(census));
    report.firstScan = await scanSlots(census, initialization); report.secondScan = await scanSlots(census, initialization);
    const expected = [...states, state].flatMap(value => [0, 1].map(row => `${String(value.trackId)}:${row}`)).sort();
    assert.deepEqual((report.firstScan as Wire).slots, (report.secondScan as Wire).slots);
    assert.deepEqual(scanOccupancy(report.secondScan as Wire), { clips: expected, groupSlots: [] });
    const begun = await shadow('rebuildBegin'), started = Date.now(); let polled: Wire, list: Wire;
    for (;;) {
      polled = await shadow('rebuildPoll'); list = await shadow('inventoryList');
      if (list.occupancyAdmitted === true) break;
      assert(Date.now() - started < 40_000, '512 occupancy did not publish');
      assert(polled.rebuildTerminal !== true || list.reason === 'slot-window-pending'); await wait(20);
    }
    assert.deepEqual(publishedOccupancy(list), expected); report.publication = { begun, polled, list, wallMs: Date.now() - started };
    report.comparisons = [];
    for (const [index, value] of [...states, state].entries()) {
      const started = Date.now(), comparison = await compareSeed(value, index === 0 ? 0 : 1, census, initialization);
      (report.comparisons as Wire[]).push({ ...comparison, driverReacquisitionMs: Date.now() - started }); await persist();
    }
    report.tracks = await request('track.list'); assert.deepEqual(report.tracks, census);
    report.scanAfter = await request('rig.scanTracks'); report.allocationAfter = await shadow('allocationStats');
    report.processBefore = await processSample(); await wait(5000); report.processAfter = await processSample();
    const first = report.processBefore as Wire, second = report.processAfter as Wire;
    report.idleIntervalMs = Number(second.capturedEpochMs) - Number(first.capturedEpochMs);
    report.idleCpu = intervalCpu(first.rows as Wire[], second.rows as Wire[], Number(report.idleIntervalMs));
    report.idleAllocationAfter = await shadow('allocationStats'); report.infoAfter = await shadow('info');
    report.boundaryChecksPassed = true; report.finished = new Date().toISOString(); verify512Result(report, population, seed);
  } catch (error) { report.error = String(error); throw error; }
  finally { await persist(); }
  console.log(JSON.stringify({ boundaryChecksPassed: true, totalChannels: 512, ownedClips: 6, comparedTracks: 3, populatedScaleAccepted: false }));
}
/** Refuse a 513-channel project. Delete only the new empty UUID to restore the full window. */
async function excess512(path: string, boundaryPath: string): Promise<void> {
  const boundary = await read(boundaryPath), population = await read(String(boundary.populationPath));
  const ungroup = await read(String(population.ungroupPath)), arm = await read(String(ungroup.armPath)), seed = await seedFor(arm);
  verify512Result(boundary, population, seed);
  const initialization = Number((population.stats as Wire).initEpochMs), census = boundary.tracks as Wire;
  await guard(initialization); assert.deepEqual(await request('track.list'), census);
  const report: Wire = { schema: 'phase8g5c-512-excess-v1', project: OWNED_PROJECT, boundaryPath,
    complete: false, eligible: false, populatedScaleAccepted: false, captured: new Date().toISOString(), before: census };
  await writeFile(path, JSON.stringify(report, null, 1) + '\n', { flag: 'wx' });
  const persist = async (): Promise<void> => writeFile(path, JSON.stringify(report, null, 1) + '\n');
  try {
    report.beforeComparison = await compareSeed(boundary.endSeed as Wire, 1, census, initialization);
    report.active = await shadow('compareStart', { index: 1 }); assert.equal((report.active as Wire).scanStage, 'membership');
    const creation: Wire = { stage: 'intent', position: 510 }; report.creation = creation; await persist();
    await guard(initialization); assert.deepEqual(await request('track.list'), census);
    creation.response = await request('track.create', { position: 510 }); creation.stage = 'requested'; await persist();
    const excess = await until(() => request('track.list'), value => value.itemCount === 513); report.excessTracks = excess; await persist();
    const added = ownedExcessTrack(census, excess); creation.created = added; creation.stage = 'verified'; await persist();
    report.retired = await shadow('compareStatus'); report.excessTopology = await shadow('trackTopology');
    report.inventory = await shadow('inventoryList'); report.rebuild = await shadow('rebuildBegin');
    report.point = await shadow('point', { index: 0, trackIndex: 0, row: 0, canaryTrackIndex: 0, canaryRow: 1 });
    report.exact = await shadow('exactStart', { trackIndex: 0, row: 0 });
    report.emptyExcessSlots = [];
    for (let row = 0; row < 8; row++) {
      const slot = await request('slot.status', { trackIndex: added.index, slotIndex: row }); assert.equal(slot.hasContent, false);
      (report.emptyExcessSlots as Wire[]).push({ row, ...slot });
    }
    await guard(initialization); assert.deepEqual(await request('track.list'), excess);
    const resolved = await request('track.resolveByChannelId', { channelId: added.channelId });
    assert.equal(resolved.found, true); assert.equal(resolved.index, added.index); assert.equal(resolved.type, 'Instrument');
    const deletion: Wire = { stage: 'intent', trackId: added.channelId, resolved }; report.deletion = deletion; await persist();
    // This cleanup removes only the UUID created above. The other off-window UUID is the known Master.
    deletion.response = await request('track.delete', { trackIndex: added.index }); deletion.stage = 'requested'; await persist();
    report.after = await until(() => request('track.list'), value => value.itemCount === 512);
    assert.deepEqual(report.after, census); deletion.stage = 'verified'; await persist();
    report.recoveredTopology = await topology(census);
    const begun = await shadow('rebuildBegin'), started = Date.now(); let polled: Wire, list: Wire;
    for (;;) {
      polled = await shadow('rebuildPoll'); list = await shadow('inventoryList');
      if (list.occupancyAdmitted === true) break;
      assert(Date.now() - started < 40_000, '512 recovery occupancy did not publish');
      assert(polled.rebuildTerminal !== true || list.reason === 'slot-window-pending'); await wait(20);
    }
    report.recoveredPublication = { begun, polled, list, wallMs: Date.now() - started }; report.recoveredComparisons = [];
    for (const [index, state] of [(seed.seeds as Wire[])[0]!, boundary.endSeed as Wire].entries())
      (report.recoveredComparisons as Wire[]).push(await compareSeed(state, index, census, initialization));
    report.excessAndRecoveryPassed = true; report.finished = new Date().toISOString(); verify512Excess(report, boundary, seed);
  } catch (error) { report.error = String(error); throw error; }
  finally { await persist(); }
  console.log(JSON.stringify({ equality: 512, excess: 513, excessAndRecoveryPassed: true, removedOnlyNewEmptyTrack: true }));
}
/** Stable slot handlers provide the external occupancy scan. Limit concurrent requests to 64. */
async function scanSlots(census: Wire, initialization: number, groupIds: string[] = []): Promise<Wire> {
  await guard(initialization); assert.deepEqual(await request('track.list'), census);
  const addresses = fullTracks(census).flatMap(track => Array.from({ length: 8 }, (_, row) => ({ track, row })));
  const slots: Wire[] = [], started = Date.now();
  for (let offset = 0; offset < addresses.length; offset += 64) {
    slots.push(...await Promise.all(addresses.slice(offset, offset + 64).map(async ({ track, row }) => {
      const status = await request('slot.status', { trackIndex: track.index, slotIndex: row });
      return { trackId: track.channelId, row, exists: status.exists, hasContent: status.hasContent };
    })));
  }
  await guard(initialization); assert.deepEqual(await request('track.list'), census);
  return { tracks: census, sceneCount: 8, groupIds, slots, wallMs: Date.now() - started };
}
/** Publish four declared slots, then hold a note comparison before the native wide-group command. */
async function armWide(path: string, seedPath: string): Promise<void> {
  const seed = await read(seedPath); assert.equal(seed.flatNotesMatched, true); assert.equal(seed.error, undefined);
  const source = await read(String(seed.sourcePath)), census = seed.census as Wire;
  verifyPopulation(source, await read(String(source.baselinePath)), await read(String(source.priorPath)));
  assert.deepEqual(census, source.after); const initialization = Number((source.stats as Wire).initEpochMs);
  const report: Wire = { schema: 'phase8g5c-wide-arm-v1', project: OWNED_PROJECT, seedPath,
    complete: false, eligible: false, populatedScaleAccepted: false, captured: new Date().toISOString() };
  try {
    report.firstScan = await scanSlots(census, initialization); report.secondScan = await scanSlots(census, initialization);
    assert.deepEqual((report.firstScan as Wire).slots, (report.secondScan as Wire).slots);
    const expected = (seed.seeds as Wire[]).flatMap(state => [0, 1].map(row => `${String(state.trackId)}:${row}`)).sort();
    assert.deepEqual(scanOccupancy(report.secondScan as Wire).clips, expected); report.declaredOccupancy = expected;
    const begun = await shadow('rebuildBegin'), started = Date.now(); let polled: Wire, list: Wire;
    for (;;) {
      polled = await shadow('rebuildPoll'); list = await shadow('inventoryList');
      if (list.occupancyAdmitted === true) break;
      assert(Date.now() - started < 40_000, 'populated occupancy did not publish');
      assert(polled.rebuildTerminal !== true || list.reason === 'slot-window-pending', JSON.stringify(polled)); await wait(20);
    }
    assert.deepEqual(publishedOccupancy(list), expected);
    report.publication = { begun, polled, list, wallMs: Date.now() - started };
    report.before = await compareSeed((seed.seeds as Wire[])[0]!, 0, census, initialization);
    report.topology = await topology(census); report.tracks = census; report.info = await shadow('info');
    report.active = await shadow('compareStart', { index: 0 });
    assert.equal((report.active as Wire).comparison, 'pending'); assert.equal((report.active as Wire).scanStage, 'membership');
    report.armed = true; report.finished = new Date().toISOString();
  } catch (error) { report.error = String(error); throw error; }
  finally { await writeFile(path, JSON.stringify(report, null, 1) + '\n', { flag: 'wx' }); }
  console.log(JSON.stringify({ armed: 'wide-group', occupiedSlots: 4, totalChannels: 258, scanStage: 'membership' }));
}
async function countedTopology(census: Wire, oracle: GroupOracle): Promise<Wire> {
  const started = Date.now(), attempts: Wire[] = [];
  for (;;) {
    const value = await shadow('trackTopology');
    attempts.push({ reason: value.reason, readMs: value.readMs, sequenceBeforeRead: value.sequenceBeforeRead,
      sequenceAfterRead: value.sequenceAfterRead, membershipComplete: value.membershipComplete });
    if (value.membershipComplete === true) { verifyCountedScale(value, census, oracle); return { ...value, driverAttempts: attempts, driverSettlementMs: Date.now() - started }; }
    assert(Date.now() - started < 30_000, 'counted group topology did not settle'); await wait(50);
  }
}
/** Find the retained seed through the prior native-change reports. */
async function seedFor(arm: Wire): Promise<Wire> {
  let current = arm;
  for (let depth = 0; depth < 12; depth++) {
    assert.equal(current.project, OWNED_PROJECT);
    if (current.seedPath) return read(String(current.seedPath));
    const links = ['widePath', 'nestedPath', 'boundaryPath', 'collapsePath', 'expandedPath'].filter(key => current[key] !== undefined);
    if (links.length === 1) current = await read(String(current[links[0]!]));
    else { assert.equal(links.length, 0); assert(current.armPath); current = await read(String(current.armPath)); }
  }
  throw new Error('native-change seed chain is too deep');
}
/** Recover the fixture against its declared native change. */
async function wideCheck(path: string, firstPath: string, kind: 'wide' | 'nested' | 'boundary' | 'collapse' | 'expand' | 'ungroup' = 'wide'): Promise<void> {
  const first = await read(firstPath), armPath = `../context/evidence/data/phase8g5c-storage/${kind}-arm.json.gz`;
  const arm = await read(armPath), seed = await seedFor(arm), population = await read(String(seed.sourcePath));
  const priorKey = { wide: '', nested: 'widePath', boundary: 'nestedPath', collapse: 'boundaryPath', expand: 'collapsePath', ungroup: 'expandedPath' }[kind];
  const prior = kind === 'wide' ? population : await read(String(arm[priorKey]));
  const oracle = kind === 'boundary' ? verifyBoundaryFirst(first, arm, prior)
    : kind === 'nested' ? verifyNestedFirst(first, arm, prior)
      : kind === 'collapse' || kind === 'expand' ? verifyToggleFirst(first, arm, prior, kind === 'expand')
        : kind === 'ungroup' ? verifyUngroupFirst(first, arm, population) : verifyWideFirst(first, arm, population), census = first.tracks as Wire;
  const initialization = Number((population.stats as Wire).initEpochMs); await guard(initialization);
  assert.deepEqual(await request('track.list'), census);
  const report: Wire = { schema: `phase8g5c-${kind}-result-v1`, project: OWNED_PROJECT, firstPath, armPath, oracle,
    complete: false, eligible: false, populatedScaleAccepted: false, captured: new Date().toISOString() };
  try {
    report.topologyReads = [];
    for (let index = 0; index < 3; index++) (report.topologyReads as Wire[]).push(await countedTopology(census, oracle));
    report.firstScan = await scanSlots(census, initialization, Object.keys(oracle.children));
    report.secondScan = await scanSlots(census, initialization, Object.keys(oracle.children));
    assert.deepEqual((report.firstScan as Wire).slots, (report.secondScan as Wire).slots);
    const expected = (seed.seeds as Wire[]).flatMap(state => [0, 1].map(row => `${String(state.trackId)}:${row}`)).sort();
    const observed = scanOccupancy(report.secondScan as Wire);
    assert.deepEqual(observed.clips, expected); assert.equal(observed.groupSlots.length, Object.keys(oracle.children).length * 2); report.scanOccupancy = observed;
    const begun = await shadow('rebuildBegin'), started = Date.now(); let polled: Wire, list: Wire;
    for (;;) {
      polled = await shadow('rebuildPoll'); list = await shadow('inventoryList');
      if (list.occupancyAdmitted === true) break;
      assert(Date.now() - started < 40_000, 'wide occupancy did not publish');
      assert(polled.rebuildTerminal !== true || list.reason === 'slot-window-pending', JSON.stringify(polled)); await wait(20);
    }
    assert.deepEqual(publishedOccupancy(list), expected); report.publication = { begun, polled, list, wallMs: Date.now() - started };
    report.comparisons = [];
    if (kind === 'collapse') {
      const state = (seed.seeds as Wire[])[0]!, track = fullTracks(census).find(row => row.channelId === state.trackId)!;
      await guard(initialization); assert.deepEqual(await request('track.list'), census);
      const started = Date.now(), point = await shadow('point', { index: 0, trackIndex: track.index, row: 0, canaryTrackIndex: track.index, canaryRow: 1 });
      const status = await until(() => shadow('poll', { index: 0 }), value => value.phase === 'retired'
        || (['settled', 'complete'].includes(String(value.phase)) && value.canaryPhase === 'target'));
      const primary: Wire = { point, status, outcome: status.phase === 'retired' ? 'refused' : 'matched' };
      if (primary.outcome === 'matched') primary.comparison = await compareSeed(state, 0, census, initialization);
      else {
        primary.detail = await shadow('status', { index: 0 });
        primary.retirement = await shadow('retire', { index: 0 });
        assert.equal((primary.retirement as Wire).physicalViewPendingHints, 0);
      }
      primary.wallMs = Date.now() - started; report.primaryBinding = primary;
    }
    for (const index of kind === 'collapse' ? [1] : [0, 1]) {
      const started = Date.now(), comparison = await compareSeed((seed.seeds as Wire[])[index]!, index, census, initialization);
      (report.comparisons as Wire[]).push({ ...comparison, driverReacquisitionMs: Date.now() - started });
    }
    report.tracks = await request('track.list'); assert.deepEqual(report.tracks, census);
    if (kind === 'collapse') report.topologyAfterBindings = await countedTopology(census, oracle);
    report.after = await shadow('allocationStats'); verifyAllocation(report.after as Wire, 512, true);
    report[`${kind}ChecksPassed`] = true; report.finished = new Date().toISOString();
    if (kind === 'nested') verifyNestedResult(report, first, arm, prior, seed);
    if (kind === 'boundary') verifyBoundaryResult(report, first, arm, prior, seed);
    if (kind === 'collapse') verifyCollapseResult(report, first, arm, prior, seed);
    if (kind === 'expand') verifyExpandResult(report, first, arm, prior, seed);
    if (kind === 'ungroup') verifyUngroupResult(report, first, arm, population, seed);
  } catch (error) { report.error = String(error); throw error; }
  finally { await writeFile(path, JSON.stringify(report, null, 1) + '\n', { flag: 'wx' }); }
  console.log(JSON.stringify({ [`${kind}ChecksPassed`]: true,
    baseTracks: 256, totalChannels: fullTracks(census).length, ownedClips: 4, excludedGroupSlots: Object.keys(oracle.children).length * 2,
    ...(kind === 'collapse' ? { primaryBinding: (report.primaryBinding as Wire).outcome } : {}) }));
}
async function armBoundary(path: string, nestedPath: string): Promise<void> {
  const nested = await read(nestedPath), first = await read(String(nested.firstPath)), arm = await read(String(nested.armPath));
  const wide = await read(String(arm.widePath)), wideArm = await read(String(wide.armPath)), seed = await read(String(wideArm.seedPath));
  verifyNestedResult(nested, first, arm, wide, seed);
  const population = await read(String(seed.sourcePath)), census = nested.tracks as Wire, oracle = nested.oracle as unknown as GroupOracle;
  const initialization = Number((population.stats as Wire).initEpochMs); await guard(initialization);
  assert.deepEqual(await request('track.list'), census);
  const outer = oracle.roots[0]!, inner = oracle.children[outer]![0]!, selected = oracle.children[inner]![1]!;
  const beforeId = oracle.children[outer]![1]!, beforeName = fullTracks(census).find(row => row.channelId === beforeId)!.name;
  const report: Wire = { schema: 'phase8g5c-boundary-arm-v1', project: OWNED_PROJECT, nestedPath,
    complete: false, eligible: false, populatedScaleAccepted: false, captured: new Date().toISOString(),
    declaration: { operation: 'native-move', selected, from: inner, to: outer,
      placement: 'after inner group and before first remaining child', beforeId, beforeName, flatOrderUnchanged: true } };
  try {
    report.before = await compareSeed((seed.seeds as Wire[])[0]!, 0, census, initialization);
    report.topology = await countedTopology(census, oracle); report.tracks = census; report.info = await shadow('info');
    report.active = await shadow('compareStart', { index: 0 });
    assert.equal((report.active as Wire).comparison, 'pending'); assert.equal((report.active as Wire).scanStage, 'membership');
    report.armed = true; report.finished = new Date().toISOString();
  } catch (error) { report.error = String(error); throw error; }
  finally { await writeFile(path, JSON.stringify(report, null, 1) + '\n', { flag: 'wx' }); }
  verifyBoundaryArm(report, nested, seed);
  console.log(JSON.stringify({ armed: 'boundary-move', selected: 'Audio 2', flatOrderUnchanged: true }));
}
async function armCollapse(path: string, boundaryPath: string): Promise<void> {
  const boundary = await read(boundaryPath), first = await read(String(boundary.firstPath)), arm = await read(String(boundary.armPath));
  const nested = await read(String(arm.nestedPath)), nestedArm = await read(String(nested.armPath));
  const wide = await read(String(nestedArm.widePath)), wideArm = await read(String(wide.armPath)), seed = await read(String(wideArm.seedPath));
  verifyBoundaryResult(boundary, first, arm, nested, seed);
  const population = await read(String(seed.sourcePath)), census = boundary.tracks as Wire, oracle = boundary.oracle as unknown as GroupOracle;
  const initialization = Number((population.stats as Wire).initEpochMs); await guard(initialization);
  assert.deepEqual(await request('track.list'), census);
  const inner = oracle.children[oracle.roots[0]!]![0]!;
  const report: Wire = { schema: 'phase8g5c-collapse-arm-v1', project: OWNED_PROJECT, boundaryPath,
    complete: false, eligible: false, populatedScaleAccepted: false, captured: new Date().toISOString(),
    declaration: { operation: 'native-collapse', selected: inner, name: 'gn-8g5c-inner',
      expanded: false, outerExpanded: true, flatOrderUnchanged: true } };
  try {
    report.before = await compareSeed((seed.seeds as Wire[])[0]!, 0, census, initialization);
    report.topology = await countedTopology(census, oracle); report.tracks = census; report.info = await shadow('info');
    report.active = await shadow('compareStart', { index: 0 });
    assert.equal((report.active as Wire).comparison, 'pending'); assert.equal((report.active as Wire).scanStage, 'membership');
    report.armed = true; report.finished = new Date().toISOString(); verifyCollapseArm(report, boundary, seed);
  } catch (error) { report.error = String(error); throw error; }
  finally { await writeFile(path, JSON.stringify(report, null, 1) + '\n', { flag: 'wx' }); }
  console.log(JSON.stringify({ armed: 'collapse-inner', selected: inner, scanId: (report.active as Wire).scanId }));
}
/** Capture only after the operator confirms the declared native toggle. */
async function captureToggle(path: string, armPath: string, kind: 'collapse' | 'expand' | 'ungroup'): Promise<void> {
  const arm = await read(armPath), priorKey = { collapse: 'boundaryPath', expand: 'collapsePath', ungroup: 'expandedPath' }[kind];
  const prior = await read(String(arm[priorKey]));
  const seed = await seedFor(arm), population = await read(String(seed.sourcePath));
  const report: Wire = { schema: `phase8g5c-${kind}-first-read-v1`, project: OWNED_PROJECT,
    captured: new Date().toISOString(), complete: false, eligible: false, armPath,
    declaration: { ...arm.declaration as Wire, operatorConfirmed: true } };
  try {
    report.stats = await guard(Number((population.stats as Wire).initEpochMs)); report.hello = await request('contract.hello');
    report.retired = await shadow('compareStatus'); report.info = await shadow('info'); report.tracks = await request('track.list');
    const started = Date.now(), attempts: Wire[] = []; report.topologyAttempts = attempts;
    for (;;) {
      const value = await shadow('trackTopology'); attempts.push(value);
      if (value.membershipComplete === true) { report.topology = value; break; }
      assert(Date.now() - started < 30_000, 'native toggle topology did not settle'); await wait(50);
    }
    report.driverSettlementMs = Date.now() - started;
    if (kind === 'ungroup') verifyUngroupFirst(report, arm, population);
    else verifyToggleFirst(report, arm, prior, kind === 'expand');
  } catch (error) { report.error = String(error); throw error; }
  finally { await writeFile(path, JSON.stringify(report, null, 1) + '\n', { flag: 'wx' }); }
  console.log(JSON.stringify({ toggle: kind, retired: (report.retired as Wire).comparison, count: fullTracks(report.tracks as Wire).length }));
}
async function armExpand(path: string, collapsePath: string): Promise<void> {
  const collapse = await read(collapsePath), first = await read(String(collapse.firstPath)), arm = await read(String(collapse.armPath));
  const boundary = await read(String(arm.boundaryPath)), seed = await seedFor(arm);
  verifyCollapseResult(collapse, first, arm, boundary, seed);
  const population = await read(String(seed.sourcePath)), census = collapse.tracks as Wire, oracle = collapse.oracle as unknown as GroupOracle;
  const initialization = Number((population.stats as Wire).initEpochMs); await guard(initialization);
  assert.deepEqual(await request('track.list'), census);
  const inner = oracle.children[oracle.roots[0]!]![0]!;
  const report: Wire = { schema: 'phase8g5c-expand-arm-v1', project: OWNED_PROJECT, collapsePath,
    complete: false, eligible: false, populatedScaleAccepted: false, captured: new Date().toISOString(),
    declaration: { operation: 'native-expand', selected: inner, name: 'gn-8g5c-inner',
      expanded: true, outerExpanded: true, flatOrderUnchanged: true } };
  try {
    report.before = await compareSeed((seed.seeds as Wire[])[1]!, 1, census, initialization);
    report.topology = await countedTopology(census, oracle); report.tracks = census; report.info = await shadow('info');
    report.active = await shadow('compareStart', { index: 1 });
    assert.equal((report.active as Wire).comparison, 'pending'); assert.equal((report.active as Wire).scanStage, 'membership');
    report.armed = true; report.finished = new Date().toISOString(); verifyExpandArm(report, collapse, seed);
  } catch (error) { report.error = String(error); throw error; }
  finally { await writeFile(path, JSON.stringify(report, null, 1) + '\n', { flag: 'wx' }); }
  console.log(JSON.stringify({ armed: 'expand-inner', selected: inner, scanId: (report.active as Wire).scanId }));
}
async function armUngroup(path: string, expandedPath: string): Promise<void> {
  const expanded = await read(expandedPath), first = await read(String(expanded.firstPath)), arm = await read(String(expanded.armPath));
  const collapse = await read(String(arm.collapsePath)), seed = await seedFor(arm);
  verifyExpandResult(expanded, first, arm, collapse, seed);
  const population = await read(String(seed.sourcePath)), census = expanded.tracks as Wire, oracle = expanded.oracle as unknown as GroupOracle;
  const initialization = Number((population.stats as Wire).initEpochMs); await guard(initialization);
  assert.deepEqual(await request('track.list'), census);
  const outer = oracle.roots[0]!, inner = oracle.children[outer]![0]!;
  const report: Wire = { schema: 'phase8g5c-ungroup-arm-v1', project: OWNED_PROJECT, expandedPath,
    complete: false, eligible: false, populatedScaleAccepted: false, captured: new Date().toISOString(),
    declaration: { operation: 'native-ungroup', selected: [inner, outer], keepAllChildrenAndClips: true,
      placement: 'all instrument/audio tracks at top level' } };
  try {
    report.before = await compareSeed((seed.seeds as Wire[])[0]!, 0, census, initialization);
    report.topology = await countedTopology(census, oracle); report.tracks = census; report.info = await shadow('info');
    report.active = await shadow('compareStart', { index: 0 });
    assert.equal((report.active as Wire).comparison, 'pending'); assert.equal((report.active as Wire).scanStage, 'membership');
    report.armed = true; report.finished = new Date().toISOString(); verifyUngroupArm(report, expanded, seed);
  } catch (error) { report.error = String(error); throw error; }
  finally { await writeFile(path, JSON.stringify(report, null, 1) + '\n', { flag: 'wx' }); }
  console.log(JSON.stringify({ armed: 'ungroup-inner-then-wide', selected: [inner, outer], scanId: (report.active as Wire).scanId }));
}
async function armNested(path: string, widePath: string): Promise<void> {
  const wide = await read(widePath), first = await read(String(wide.firstPath)), arm = await read(String(wide.armPath));
  const seed = await read(String(arm.seedPath)), population = await read(String(seed.sourcePath));
  verifyWideResult(wide, first, arm, seed, population);
  const census = wide.tracks as Wire, oracle = wide.oracle as unknown as GroupOracle;
  const initialization = Number((population.stats as Wire).initEpochMs); await guard(initialization);
  assert.deepEqual(await request('track.list'), census);
  const parentId = oracle.roots[0]!, selected = oracle.children[parentId]!.slice(0, 2);
  const report: Wire = { schema: 'phase8g5c-nested-arm-v1', project: OWNED_PROJECT, widePath,
    complete: false, eligible: false, populatedScaleAccepted: false, captured: new Date().toISOString(),
    declaration: { operation: 'native-group', parentId, selected, name: 'gn-8g5c-inner', expanded: true, placement: 'first child of wide group' } };
  try {
    report.before = await compareSeed((seed.seeds as Wire[])[0]!, 0, census, initialization);
    report.topology = await countedTopology(census, oracle); report.tracks = census; report.info = await shadow('info');
    report.active = await shadow('compareStart', { index: 0 });
    assert.equal((report.active as Wire).comparison, 'pending'); assert.equal((report.active as Wire).scanStage, 'membership');
    report.armed = true; report.finished = new Date().toISOString();
  } catch (error) { report.error = String(error); throw error; }
  finally { await writeFile(path, JSON.stringify(report, null, 1) + '\n', { flag: 'wx' }); }
  console.log(JSON.stringify({ armed: 'nested-group', selected: ['Inst 1', 'Audio 2'], parentId, scanId: (report.active as Wire).scanId }));
}
async function main(): Promise<void> {
  const [mode, path, baseline, prior] = process.argv.slice(2); assert(path && baseline);
  if (mode === 'populate-flat') { assert(prior); await populate(path, baseline, prior); }
  else if (mode === 'populate-512') await populate512(path, baseline);
  else if (mode === 'flat-check') await flatCheck(path, baseline);
  else if (mode === 'seed-flat') await seedFlat(path, baseline);
  else if (mode === 'check-512') await check512(path, baseline);
  else if (mode === 'excess-512') await excess512(path, baseline);
  else if (mode === 'arm-wide') await armWide(path, baseline);
  else if (mode === 'wide-check') await wideCheck(path, baseline);
  else if (mode === 'nested-check') await wideCheck(path, baseline, 'nested');
  else if (mode === 'boundary-check') await wideCheck(path, baseline, 'boundary');
  else if (mode === 'collapse-check') await wideCheck(path, baseline, 'collapse');
  else if (mode === 'expand-check') await wideCheck(path, baseline, 'expand');
  else if (mode === 'ungroup-check') await wideCheck(path, baseline, 'ungroup');
  else if (mode === 'collapse-first') await captureToggle(path, baseline, 'collapse');
  else if (mode === 'expand-first') await captureToggle(path, baseline, 'expand');
  else if (mode === 'ungroup-first') await captureToggle(path, baseline, 'ungroup');
  else if (mode === 'arm-nested') await armNested(path, baseline);
  else if (mode === 'arm-boundary') await armBoundary(path, baseline);
  else if (mode === 'arm-collapse') await armCollapse(path, baseline);
  else if (mode === 'arm-expand') await armExpand(path, baseline);
  else if (mode === 'arm-ungroup') await armUngroup(path, baseline);
  else { assert.equal(mode, 'verify-population'); assert(prior); verifyPopulation(await read(path), await read(baseline), await read(prior)); console.log('flat population verified'); }
}
void main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => bridge.disconnect());
