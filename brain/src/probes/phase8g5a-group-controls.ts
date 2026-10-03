/** Capture a fresh baseline and raw topology candidates. These reads grant no cache eligibility. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { BridgeClient } from '../client.js';
import type { Wire } from './phase8g4-native-lib.js';
import { parseSignature } from './e216-delivery-coherence-lib.js';

export const GROUP_CANDIDATE_MARKER = '8g5a-group-topology-v2';
const bridge = new BridgeClient();
const configPath = join(homedir(), '.ghostnote', 'rig.json');
const hash = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');
const request = async (method: string, params?: Wire): Promise<Wire> =>
  await bridge.request(method, params, 30_000) as Wire;
const shadow = async (operation: string, params: Wire = {}): Promise<Wire> =>
  await request('cache.shadow', { operation, ...params });
async function save(path: string, value: Wire): Promise<void> {
  await writeFile(path, JSON.stringify(value, null, 1) + '\n', { flag: 'wx' });
}
async function baseline(): Promise<Wire> {
  const tracks = await request('track.list'), count = await request('scene.count');
  assert.equal(tracks.count, tracks.itemCount); assert(Number(tracks.itemCount) <= Number(tracks.bankSize));
  const slots: Wire[] = [];
  for (const track of tracks.tracks as Wire[]) for (let row = 0; row < Number(count.sceneCount); row++) {
    slots.push({ trackId: track.channelId, row,
      ...await request('slot.status', { trackIndex: track.index, slotIndex: row }) });
  }
  const cursors: Wire = {};
  for (const cursor of ['0', '1', '2', '3', '4', '5', '6', '7', 'fine', 'observer']) {
    cursors[cursor] = await request('cursor.status', { cursor });
  }
  return { selection: await request('selection.status'), tracks, sceneCount: count.sceneCount,
    scan: await request('rig.scanTracks'), slots, cursors };
}
/** Compare state values. Scan duration and event counters do not describe project state. */
function stateValues(value: Wire): Wire {
  const scan = { ...value.scan as Wire }, selection = { ...value.selection as Wire };
  delete scan.scanMicros; delete selection.changes; delete selection.revision;
  return { ...value, scan, selection };
}
/** Verify restoration after the operator loads the normal extension. */
async function normalBaseline(path: string, entryPath: string, prepareReader: boolean): Promise<void> {
  const entry = JSON.parse(await readFile(entryPath, 'utf8')) as Wire, expected = entry.baseline as Wire;
  assert(['phase8g5a-candidates-v1', 'phase8g5a-rebaseline-v1'].includes(String(entry.schema)));
  const hello = await request('contract.hello');
  assert.equal(hello.runtimeProfile, 'normal-v1'); assert.equal(hello.methodCount, 85);
  assert.equal(hello.methodsHash, 'bba7383dce25c0f0');
  const config = await readFile(configPath);
  assert.equal(hash(config), '256bbf07094cd654c372d0e5e050e494ef7783c9a0001a0a2a688331bcf643b0');
  assert.deepEqual(await request('track.list'), expected.tracks);
  assert.equal((await request('scene.count')).sceneCount, expected.sceneCount);
  const report: Wire = { schema: 'phase8g5a-normal-restoration-v1', complete: false, eligible: false,
    entryPath, project: entry.originalProject ?? entry.project, hello, configSha256: hash(config),
    excludedStateFields: ['scan.scanMicros', 'selection.changes', 'selection.revision'] };
  try {
    if (prepareReader) {
      assert.equal(entry.schema, 'phase8g5a-rebaseline-v1'); assert.equal(entry.originalProject, 'New 3');
      const preserved = entry.preservedClip as Wire;
      const tracks = ((expected.tracks as Wire).tracks as Wire[]);
      const target = tracks.find(track => track.channelId === preserved.trackId); assert(target);
      await request('cursor.pin', { cursor: 'fine', pinned: false });
      await request('cursor.pinTrack', { cursor: 'fine', pinned: false });
      await request('cursor.pointTrack', { cursor: 'fine', trackIndex: target.index });
      await request('slot.select', { trackIndex: target.index, slotIndex: preserved.row, mechanism: 'track' });
      const until = Date.now() + 10_000;
      for (;;) {
        const status = await request('cursor.status', { cursor: 'fine' });
        if (status.exists === true && status.trackName === target.name && status.sceneIndex === preserved.row) break;
        assert(Date.now() < until, 'protected reader did not settle');
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      await request('cursor.setStepSize', { cursor: 'fine', stepSize: preserved.stepSize });
      await request('cursor.scrollToStep', { cursor: 'fine', step: 0 });
      await new Promise(resolve => setTimeout(resolve, 250));
      report.metadata = await request('cursor.clipMetadata', { cursor: 'fine' });
      report.launchSettings = await request('cursor.launchSettings', { cursor: 'fine' });
      report.notes = await request('cursor.getNotesVerboseAllChannels', { cursor: 'fine', maxX: preserved.maxX });
      report.confirmationNotes = await request('cursor.getNotesVerboseAllChannels', { cursor: 'fine', maxX: preserved.maxX });
      assert.deepEqual(report.metadata, preserved.metadata); assert.deepEqual(report.launchSettings, preserved.launchSettings);
      const noteValues = (value: Wire): Wire => { const copy = { ...value }; delete copy.scanMicros; return copy; };
      (report.excludedStateFields as string[]).push('notes.scanMicros', 'confirmationNotes.scanMicros');
      assert.deepEqual(noteValues(report.notes as Wire), noteValues(preserved.notes as Wire));
      assert.deepEqual(noteValues(report.confirmationNotes as Wire), noteValues(preserved.confirmationNotes as Wire));
    }
    report.baseline = await baseline(); report.confirmation = await baseline();
    assert.deepEqual(stateValues(report.baseline as Wire), stateValues(report.confirmation as Wire));
    assert.deepEqual(stateValues(report.baseline as Wire), stateValues(expected));
    report.stateValuesRestored = true;
  } catch (error) { report.error = String(error); throw error; }
  finally { report.stats = await request('rig.stats'); report.captured = new Date().toISOString(); await save(path, report); }
  console.log(JSON.stringify({ restored: report.project, stateValuesRestored: true, configSha256: report.configSha256 }));
}
/** Restore the fixture's remembered first-slot address without binding a reader. */
async function fixtureSelection(path: string, entryPath: string): Promise<void> {
  const entry = JSON.parse(await readFile(entryPath, 'utf8')) as Wire;
  assert.equal(entry.project, 'New 5'); assert.equal(entry.schema, 'phase8g5a-candidates-v1');
  const expected = entry.baseline as Wire;
  assert.deepEqual(await request('track.list'), expected.tracks);
  assert.equal((await request('contract.hello')).runtimeProfile, 'normal-v1');
  await request('slot.select', { trackIndex: 0, slotIndex: 0, mechanism: 'track' });
  await new Promise(resolve => setTimeout(resolve, 200));
  const current = await baseline(), confirmation = await baseline();
  await save(path, { schema: 'phase8g5a-fixture-selection-v1', complete: false, eligible: false,
    project: 'New 5', baseline: current, confirmation, selection: current.selection });
  assert.deepEqual(stateValues(current), stateValues(confirmation));
  const actual = stateValues(current), target = stateValues(expected);
  assert.deepEqual(actual.selection, target.selection);
  const slots = actual.slots as Wire[], expectedSlots = target.slots as Wire[];
  assert.equal(slots[0]!.isSelected, true); assert.equal(expectedSlots[0]!.isSelected, false);
  assert.deepEqual({ ...actual, slots: slots.map((slot, index) => index === 0 ? { ...slot, isSelected: false } : slot) }, target);
  console.log(JSON.stringify({ project: 'New 5', contentAndCursorsRestored: true,
    rememberedSelectionRestored: true, soleRemainingDifference: 'slot-0-selected-instead-of-no-slot' }));
}
async function entry(path: string): Promise<void> {
  const config = await readFile(configPath), hello = await request('contract.hello');
  assert.equal(hello.runtimeProfile, 'normal-v1'); assert.equal(hello.methodCount, 85);
  assert.equal(hello.methodsHash, 'bba7383dce25c0f0');
  const first = await baseline(), second = await baseline();
  const stable = (value: Wire): Wire => {
    const scan = { ...value.scan as Wire }; delete scan.scanMicros;
    return { ...value, scan };
  };
  assert.deepEqual(stable(second), stable(first));
  await save(path, { schema: 'phase8g5a-entry-v1', captured: new Date().toISOString(),
    priorProjectLostOnRestart: true, originalProject: 'New 1', complete: false, eligible: false,
    configBase64: config.toString('base64'), configSha256: hash(config), hello,
    stats: await request('rig.stats'), baseline: first, confirmation: second });
  console.log(JSON.stringify({ entry: path, tracks: (first.tracks as Wire).count,
    scenes: first.sceneCount, configSha256: hash(config) }));
}
/** Adopt the operator's replacement project and retain its existing empty clip. */
async function rebaseline(path: string, originalEntryPath: string): Promise<void> {
  const original = JSON.parse(await readFile(originalEntryPath, 'utf8')) as Wire;
  assert.equal(original.schema, 'phase8g5a-entry-v1');
  const originalConfig = Buffer.from(String(original.configBase64), 'base64');
  assert.equal(hash(originalConfig), original.configSha256);
  const project = async (): Promise<string> => parseSignature(String((await shadow('deliveryStatus')).signature)).name;
  assert.equal(await project(), 'New 3');
  assert.equal((await shadow('info')).instrumentationRevision, GROUP_CANDIDATE_MARKER);
  const before = await baseline(); assert.equal((before.tracks as Wire).count, 4); assert.equal(before.sceneCount, 8);
  const occupied = (before.slots as Wire[]).filter(slot => slot.hasContent === true); assert.equal(occupied.length, 1);
  const track = ((before.tracks as Wire).tracks as Wire[]).find(row => row.channelId === occupied[0]!.trackId)!;
  assert.equal(track.index, 0); assert.equal(occupied[0]!.row, 0); assert.equal(track.type, 'Instrument');
  assert.equal(((before.cursors as Wire).fine as Wire).isPinned, false);
  assert.equal(((before.cursors as Wire).fine as Wire).cursorTrackPinned, false);
  await request('cursor.pointTrack', { cursor: 'fine', trackIndex: track.index });
  await request('slot.select', { trackIndex: track.index, slotIndex: 0, mechanism: 'track' });
  const until = Date.now() + 10_000;
  for (;;) {
    const status = await request('cursor.status', { cursor: 'fine' });
    if (status.slotExists === true && status.trackName === track.name && status.sceneIndex === 0) break;
    assert(Date.now() < until, 'empty clip reader did not settle');
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  await request('cursor.setStepSize', { cursor: 'fine', stepSize: 1 / 512 });
  await request('cursor.scrollToStep', { cursor: 'fine', step: 0 });
  await new Promise(resolve => setTimeout(resolve, 250));
  const metadata = await request('cursor.clipMetadata', { cursor: 'fine' });
  assert.equal(metadata.exists, true); assert.equal(typeof metadata.name, 'string');
  assert(Number(metadata.playStop) <= 4 && Number(metadata.loopStart) + Number(metadata.loopLength) <= 4);
  const notes = await request('cursor.getNotesVerboseAllChannels', { cursor: 'fine', maxX: 2048 });
  const confirmationNotes = await request('cursor.getNotesVerboseAllChannels', { cursor: 'fine', maxX: 2048 });
  for (const read of [notes, confirmationNotes]) {
    assert.equal(read.clipExists, true); assert.equal(read.count, 0);
    assert.deepEqual((read.channels as Wire[]).map(channel => channel.channel), Array.from({ length: 16 }, (_, index) => index));
    for (const channel of read.channels as Wire[]) { assert.equal(channel.count, 0); assert.deepEqual(channel.notes, []); }
  }
  assert.deepEqual(await request('cursor.clipMetadata', { cursor: 'fine' }), metadata);
  const first = await baseline(), second = await baseline();
  const stable = (value: Wire): Wire => { const scan = { ...value.scan as Wire }; delete scan.scanMicros; return { ...value, scan }; };
  assert.deepEqual(stable(first), stable(second)); assert.deepEqual(first.tracks, before.tracks);
  assert.deepEqual(first.slots, before.slots); assert.equal(await project(), 'New 3');
  await save(path, { schema: 'phase8g5a-rebaseline-v1', captured: new Date().toISOString(), originalProject: 'New 3',
    supersedesProject: 'New 1', reason: 'operator-new-project-replaced-untouched-project', complete: false, eligible: false,
    configSource: originalEntryPath, configBase64: original.configBase64, configSha256: original.configSha256,
    currentConfigSha256: hash(await readFile(configPath)), hello: await request('contract.hello'), stats: await request('rig.stats'),
    beforeReaderPreparation: before, baseline: first, confirmation: second,
    preservedClip: { trackId: track.channelId, row: 0, displayLabel: 'S1', metadata, notes, confirmationNotes,
      stepSize: 1 / 512, maxX: 2048, launchSettings: await request('cursor.launchSettings', { cursor: 'fine' }) },
    topology: await shadow('trackTopology'), projectContentMutatedByAgent: false });
  console.log(JSON.stringify({ baseline: path, project: 'New 3', preservedClip: 'S1', noteCount: 0, channels: 16 }));
}
async function config(mode: string, entryPath: string): Promise<void> {
  const saved = JSON.parse(await readFile(entryPath, 'utf8')) as Wire;
  assert(['phase8g5a-entry-v1', 'phase8g5a-rebaseline-v1'].includes(String(saved.schema)));
  const bytes = Buffer.from(String(saved.configBase64), 'base64'); assert.equal(hash(bytes), saved.configSha256);
  const research = Buffer.from(JSON.stringify({ recordChars: 0, stamp: '8g5a-topology-candidates',
    cacheLifecycleResearch: true, deliveryResearch: true, cacheShadowObservers: 2,
    cacheShadowSteps: 2048, fineSteps: 2048, contentFilter: 'ALL_CHANNELS' }, null, 2) + '\n');
  const current = await readFile(configPath);
  if (mode === 'set') { assert.deepEqual(current, bytes); await writeFile(configPath, research); }
  else { assert.equal(mode, 'restore'); assert.deepEqual(current, research); await writeFile(configPath, bytes); }
  assert.deepEqual(await readFile(configPath), mode === 'set' ? research : bytes);
  console.log(JSON.stringify({ config: mode, sha256: hash(await readFile(configPath)) }));
}
async function capture(path: string, fixtureEntry = false): Promise<void> {
  const info = await shadow('info'); assert.equal(info.instrumentationRevision, GROUP_CANDIDATE_MARKER);
  const project = parseSignature(String((await shadow('deliveryStatus')).signature)).name;
  const report: Wire = { schema: 'phase8g5a-candidates-v1', captured: new Date().toISOString(), project,
    complete: false, eligible: false, researchOnly: true, hello: await request('contract.hello'),
    stats: await request('rig.stats'), info, tracks: await request('track.list'),
    groups: await shadow('trackGroups'), topology: await shadow('trackTopology'),
    scenes: await shadow('sceneSnapshot'), status: await shadow('status', { index: 0 }) };
  if (fixtureEntry) {
    assert.equal(project, 'New 5');
    report.baseline = await baseline(); report.confirmation = await baseline();
    const stable = (value: Wire): Wire => { const scan = { ...value.scan as Wire }; delete scan.scanMicros; return { ...value, scan }; };
    assert.deepEqual(stable(report.baseline as Wire), stable(report.confirmation as Wire));
    assert.equal((report.baseline as Wire).sceneCount, 8);
    assert.equal(((report.baseline as Wire).tracks as Wire).count, 4);
    assert((report.baseline as Wire).slots && ((report.baseline as Wire).slots as Wire[]).every(slot => slot.hasContent === false));
  }
  await save(path, report);
  console.log(JSON.stringify({ capture: path, topology: report.topology }));
}
async function createFixtureTrack(path: string): Promise<void> {
  assert.equal(parseSignature(String((await shadow('deliveryStatus')).signature)).name, 'New 5');
  const before = await request('track.list');
  await request('track.create', { position: -1 });
  let after: Wire;
  const until = Date.now() + 10_000;
  do { after = await request('track.list'); if (Number(after.count) === Number(before.count) + 1) break;
    assert(Date.now() < until); await new Promise(resolve => setTimeout(resolve, 50));
  } while (true);
  const ids = new Set((before.tracks as Wire[]).map(track => track.channelId));
  const added = (after.tracks as Wire[]).filter(track => !ids.has(track.channelId)); assert.equal(added.length, 1);
  await request('track.setName', { trackIndex: added[0]!.index, name: 'gn-8g5a-owned' });
  await save(path, { schema: 'phase8g5a-created-track-v1', project: 'New 5', complete: false, eligible: false,
    before, after, ownedId: added[0]!.channelId });
  console.log(JSON.stringify(added[0]));
}
async function emptyFixtureGroup(path: string, ownedPath: string): Promise<void> {
  const owned = JSON.parse(await readFile(ownedPath, 'utf8')) as Wire;
  assert.equal(owned.schema, 'phase8g5a-created-track-v1');
  assert.equal(parseSignature(String((await shadow('deliveryStatus')).signature)).name, 'New 5');
  const tracks = await request('track.list');
  const track = (tracks.tracks as Wire[]).find(row => row.channelId === owned.ownedId);
  assert(track); assert.equal(track.name, 'gn-8g5a-owned');
  await request('track.delete', { trackIndex: track.index });
  const until = Date.now() + 10_000;
  while (((await request('track.list')).tracks as Wire[]).some(row => row.channelId === owned.ownedId)) {
    assert(Date.now() < until); await new Promise(resolve => setTimeout(resolve, 50));
  }
  await capture(path);
}
async function main(): Promise<void> {
  const [mode, path, entryPath] = process.argv.slice(2); assert(path);
  if (mode === 'entry') await entry(path);
  else if (mode === 'rebaseline') { assert(entryPath); await rebaseline(path, entryPath); }
  else if (mode === 'config') { assert(entryPath); await config(path, entryPath); }
  else if (mode === 'normal-baseline' || mode === 'restore-protected-reader') {
    assert(entryPath); await normalBaseline(path, entryPath, mode === 'restore-protected-reader');
  }
  else if (mode === 'fixture-selection') { assert(entryPath); await fixtureSelection(path, entryPath); }
  else if (mode === 'fixture-entry') await capture(path, true);
  else if (mode === 'create-track') await createFixtureTrack(path);
  else if (mode === 'empty-group') { assert(entryPath); await emptyFixtureGroup(path, entryPath); }
  else { assert.equal(mode, 'capture'); await capture(path); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => bridge.disconnect());
}
