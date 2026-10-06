// 8h3e removed the research wire or rig configuration that this live driver uses. Live use needs the
// earlier research build of its own session. Its retained artifacts and offline checks do not need a host.
/** Capture allocation costs. Each sample requires a fresh operator controller replacement. */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { gunzipSync } from 'node:zlib';
import { BridgeClient } from '../client.js';
import { parseSignature } from './e216-delivery-coherence-lib.js';
import { publishedOccupancy } from './phase8g5b-slot-lib.js';
import { ALLOCATION_MARKER, COUNTED_ALLOCATION_MARKER, CAPACITIES, OWNED_PROJECT, intervalCpu, processes, sweepConfig, verifyAllocation, verifyAllocationSample, verifyPopulatedAnchor, type Wire } from './phase8g5c-storage-lib.js';
const bridge = new BridgeClient(), execute = promisify(execFile);
const configPath = join(homedir(), '.ghostnote', 'rig.json');
const request = async (method: string, params?: Wire): Promise<Wire> => await bridge.request(method, params, 30_000) as Wire;
const shadow = async (operation: string): Promise<Wire> => await request('cache.shadow', { operation });
const hash = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');
const read = async (path: string): Promise<Wire> => {
  let actual = path, bytes: Buffer;
  try { bytes = await readFile(actual); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT' || !path.endsWith('.json')) throw error;
    actual += '.gz'; bytes = await readFile(actual);
  }
  return JSON.parse((actual.endsWith('.gz') ? gunzipSync(bytes, { maxOutputLength: 64 * 1024 * 1024 }) : bytes).toString('utf8')) as Wire;
};
const save = async (path: string, value: Wire): Promise<void> => await writeFile(path, JSON.stringify(value, null, 1) + '\n', { flag: 'wx' });
const configBytes = (capacity: number, counted = false): Buffer => Buffer.from(JSON.stringify(sweepConfig(capacity, counted), null, 2) + '\n');
async function processSample(): Promise<Wire> {
  const { stdout } = await execute('ps', ['-axo', 'pid=,ppid=,rss=,%cpu=,time=,comm=']);
  const rows = processes(stdout); assert(rows.length > 0, 'no Bitwig process measurement');
  return { capturedEpochMs: Date.now(), rows };
}
async function entry(path: string, baselinePath: string): Promise<void> {
  const baseline = await read(baselinePath); assert.equal(baseline.project, 'New 3');
  assert.equal(baseline.stateValuesRestored, true);
  const config = await readFile(configPath), hello = await request('contract.hello');
  assert.equal(hello.runtimeProfile, 'normal-v1'); assert.equal(hello.methodCount, 85);
  assert.equal(hello.methodsHash, 'bba7383dce25c0f0');
  assert.equal(hash(config), baseline.configSha256);
  await save(path, { schema: 'phase8g5c-entry-v1', captured: new Date().toISOString(), baselinePath,
    configBase64: config.toString('base64'), configSha256: hash(config), hello, stats: await request('rig.stats'),
    complete: false, eligible: false });
  console.log(JSON.stringify({ entry: path, configSha256: hash(config) }));
}
/** Change only known entry or sweep bytes. Controller replacement stays with the operator. */
async function config(mode: string, entryPath: string): Promise<void> {
  const entry = await read(entryPath); assert.equal(entry.schema, 'phase8g5c-entry-v1');
  const original = Buffer.from(String(entry.configBase64), 'base64'); assert.equal(hash(original), entry.configSha256);
  const current = await readFile(configPath);
  assert(current.equals(original) || CAPACITIES.some(capacity =>
    [false, true].some(counted => current.equals(configBytes(capacity, counted)))), 'unowned config bytes');
  const counted = mode.startsWith('counted-');
  const replacement = mode === 'restore' ? original : configBytes(Number(counted ? mode.slice(8) : mode), counted);
  await writeFile(configPath, replacement); assert.deepEqual(await readFile(configPath), replacement);
  console.log(JSON.stringify({ config: mode, sha256: hash(replacement), controllerReplacementPending: true }));
}
/** Capture the owned fixture before population. Two full scans must report no occupied slots. */
async function fixtureEntry(path: string, samplePath: string): Promise<void> {
  const sample = await read(samplePath); assert.equal(sample.project, OWNED_PROJECT);
  assert.equal((await shadow('info')).instrumentationRevision, ALLOCATION_MARKER);
  const project = parseSignature(String((await shadow('deliveryStatus')).signature)).name;
  assert.equal(project, OWNED_PROJECT);
  const capture = async (): Promise<Wire> => {
    const cursors: Wire = {};
    for (const cursor of ['0', '1', '2', '3', '4', '5', '6', '7', 'fine', 'observer'])
      cursors[cursor] = await request('cursor.status', { cursor });
    return { tracks: await request('track.list'), scenes: await request('scene.count'),
      scan: await request('rig.scanTracks'), selection: await request('selection.status'), cursors };
  };
  const first = await capture(), second = await capture();
  const values = (state: Wire): Wire => {
    const scan = { ...state.scan as Wire }, selection = { ...state.selection as Wire };
    delete scan.scanMicros; delete selection.changes; delete selection.revision;
    return { ...state, scan, selection };
  };
  assert.deepEqual(values(first), values(second)); assert.deepEqual(first.tracks, sample.tracks);
  assert.equal((first.scenes as Wire).sceneCount, 8);
  for (const state of [first, second]) {
    const scan = state.scan as Wire;
    assert.equal(scan.existing, 4); assert.equal(scan.withChannelId, 4);
    assert.equal(scan.itemCount, 4); assert.equal(scan.bankSize, 512); assert.equal(scan.slotsWithContent, 0);
  }
  await save(path, { schema: 'phase8g5c-fixture-entry-v1', project, samplePath,
    captured: new Date().toISOString(), first, second, stats: await request('rig.stats'),
    complete: false, eligible: false, emptySlotsVerified: true,
    excludedStateFields: ['scan.scanMicros', 'selection.changes', 'selection.revision'] });
  console.log(JSON.stringify({ fixtureEntry: path, project, emptySlotsVerified: true }));
}
async function populatedAnchor(path: string, sourcePath: string): Promise<void> {
  const boundary = await read(sourcePath), stats = await request('rig.stats');
  assert.equal(parseSignature(String((await shadow('deliveryStatus')).signature)).name, OWNED_PROJECT);
  const population = await read(String(boundary.populationPath));
  assert.equal(stats.initEpochMs, (population.stats as Wire).initEpochMs);
  const marker = (await shadow('info')).instrumentationRevision;
  assert.equal(marker, COUNTED_ALLOCATION_MARKER);
  const archivePath = join(homedir(), 'Documents', 'Bitwig Studio', 'Extensions', 'ghostnote-shadow-8g-controls.bwextension');
  const config = await readFile(configPath); assert(config.equals(configBytes(512, true)));
  const inventory = await shadow('inventoryList');
  const report: Wire = { schema: 'phase8g5c-populated-anchor-v1', project: OWNED_PROJECT, sourcePath, stats, marker,
    captured: new Date().toISOString(), complete: false, eligible: false,
    archiveSha256: hash(await readFile(archivePath)), archiveMtimeMs: (await stat(archivePath)).mtimeMs,
    configSha256: hash(config), tracks: await request('track.list'), scan: await request('rig.scanTracks'),
    topology: await shadow('trackTopology'), inventory,
    expectedOccupancy: publishedOccupancy((boundary.publication as Wire).list as Wire),
    allocation: await shadow('allocationStats'), tracksAfter: await request('track.list') };
  verifyPopulatedAnchor(report, boundary); await save(path, report);
  console.log(JSON.stringify({ populatedAnchor: path, archiveSha256: report.archiveSha256, controllerReplacementPending: true }));
}
async function sample(path: string, priorPath: string, capacity: number, fixture: string, counted = false): Promise<void> {
  const prior = await read(priorPath), stats = await request('rig.stats'), hello = await request('contract.hello');
  const fixtureAnchorPath = fixture === 'populated' ? String(prior.fixtureAnchorPath ?? priorPath) : undefined;
  const fixtureAnchor = fixtureAnchorPath ? await read(fixtureAnchorPath) : undefined;
  assert(fixture === 'empty' || fixture === 'populated', 'unknown fixture');
  if (fixtureAnchor) assert.equal(fixtureAnchor.schema, 'phase8g5c-populated-anchor-v1');
  assert.equal(hello.runtimeProfile, 'phase-8-probe-v1'); assert.equal(hello.methodCount, 97);
  assert.equal(hello.methodsHash, 'f03f19414f40e3d3');
  assert(Number(stats.initEpochMs) > Number((prior.stats as Wire).initEpochMs), 'controller initialization is not fresh');
  const archivePath = join(homedir(), 'Documents', 'Bitwig Studio', 'Extensions', 'ghostnote-shadow-8g-controls.bwextension');
  const archive = await stat(archivePath);
  assert(Number(stats.initEpochMs) >= archive.mtimeMs, 'initialization predates the research archive');
  const liveConfig = stats.config as Wire, expected = sweepConfig(capacity, counted);
  for (const [key, value] of Object.entries(expected)) if (key !== 'recordChars') assert.equal(liveConfig[key], value, key);
  const instrumentationRevision = (await shadow('info')).instrumentationRevision;
  assert.equal(instrumentationRevision, counted ? COUNTED_ALLOCATION_MARKER : ALLOCATION_MARKER);
  const project = parseSignature(String((await shadow('deliveryStatus')).signature)).name;
  assert.equal(project, OWNED_PROJECT, 'use the declared owned fixture for the sweep');
  const report: Wire = { schema: 'phase8g5c-allocation-v1', captured: new Date().toISOString(), priorPath, capacity,
    fixture, project, hello, stats, instrumentationRevision,
    ...(fixtureAnchorPath ? { fixtureAnchorPath } : {}),
    complete: false, eligible: false, coldScope: 'fresh-controller-in-shared-jvm',
    ...(counted ? { allocationRoute: 'counted' } : {}),
    archiveSha256: hash(await readFile(archivePath)), archiveMtimeMs: archive.mtimeMs,
    attribution: 'shared JVM and whole processes; neither is topology-owned memory' };
  try {
    report.tracks = await request('track.list'); report.scenes = await request('scene.count');
    if (fixtureAnchor) { assert.deepEqual(report.tracks, fixtureAnchor.tracks); report.scanBefore = await request('rig.scanTracks'); }
    report.before = await shadow('allocationStats'); verifyAllocation(report.before as Wire, capacity, counted);
    const first = await processSample(); report.processBefore = first;
    // No bridge reads run during the idle interval.
    await new Promise(resolve => setTimeout(resolve, 5000));
    const second = await processSample(); report.processAfter = second;
    const elapsed = Number(second.capturedEpochMs) - Number(first.capturedEpochMs);
    report.idleIntervalMs = elapsed; report.idleCpu = intervalCpu(first.rows as Wire[], second.rows as Wire[], elapsed);
    report.after = await shadow('allocationStats'); verifyAllocation(report.after as Wire, capacity, counted);
    if (capacity > 0) report.topology = await shadow('trackTopology');
    if (fixtureAnchor) {
      report.rebuildBegin = await shadow('rebuildBegin'); const started = Date.now();
      for (;;) {
        report.rebuildPoll = await shadow('rebuildPoll'); report.inventory = await shadow('inventoryList');
        if ((report.inventory as Wire).occupancyAdmitted === true) break;
        assert(Date.now() - started < 40_000, 'populated occupancy did not publish');
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      report.publicationWallMs = Date.now() - started;
      report.scanAfter = await request('rig.scanTracks'); report.tracksAfter = await request('track.list');
      report.statsAfter = await request('rig.stats');
      assert.equal(parseSignature(String((await shadow('deliveryStatus')).signature)).name, OWNED_PROJECT);
    }
    verifyAllocationSample(report, prior, fixtureAnchor);
  } catch (error) { report.error = String(error); throw error; }
  finally { await save(path, report); }
  console.log(JSON.stringify({ sample: path, project, capacity, initMicros: stats.initMicros, idleCpu: report.idleCpu }));
}
async function main(): Promise<void> {
  const [mode, path, prior, capacity, fixture] = process.argv.slice(2); assert(path && prior);
  if (mode === 'entry') await entry(path, prior);
  else if (mode === 'fixture-entry') await fixtureEntry(path, prior);
  else if (mode === 'populated-anchor') await populatedAnchor(path, prior);
  else if (mode === 'config') await config(path, prior);
  else if (mode === 'verify') {
    const report = await read(path);
    verifyAllocationSample(report, await read(prior), report.fixtureAnchorPath ? await read(String(report.fixtureAnchorPath)) : undefined);
    console.log('allocation sample verified');
  }
  else {
    assert.equal(mode, 'sample'); assert(capacity && fixture); const counted = capacity.startsWith('counted-');
    await sample(path, prior, Number(counted ? capacity.slice(8) : capacity), fixture, counted);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => bridge.disconnect());
