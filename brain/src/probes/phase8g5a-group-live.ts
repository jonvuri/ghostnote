// 8h3e removed the research wire or rig configuration that this live driver uses. Live use needs the
// earlier research build of its own session. Its retained artifacts and offline checks do not need a host.
/** Run note and retirement controls in the owned New 5 fixture. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { BridgeClient } from '../client.js';
import { parseSignature } from './e216-delivery-coherence-lib.js';
import { closed, independentNotes, noPayload, verifyComparison, verifySeed, type Wire } from './phase8g4-native-lib.js';
import { GROUP_CANDIDATE_MARKER } from './phase8g5a-group-controls.js';
const bridge = new BridgeClient(), GRID = 1 / 512;
const request = async (method: string, params?: Wire): Promise<Wire> => await bridge.request(method, params, 30_000) as Wire;
const shadow = async (operation: string, params: Wire = {}): Promise<Wire> => request('cache.shadow', { operation, ...params });
const save = async (path: string, value: Wire): Promise<void> => writeFile(path, JSON.stringify(value, null, 1) + '\n', { flag: 'wx' });
const read = async (path: string): Promise<Wire> => JSON.parse(await readFile(path, 'utf8')) as Wire;
const wait = async (ms = 50): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));
async function poll(next: () => Promise<Wire>, done: (value: Wire) => boolean): Promise<Wire> {
  const until = Date.now() + 30_000;
  for (;;) { const value = await next(); if (done(value)) return value; assert(Date.now() < until, JSON.stringify(value)); await wait(); }
}
async function guard(): Promise<void> {
  assert.equal(parseSignature(String((await shadow('deliveryStatus')).signature)).name, 'New 5');
  assert.equal((await shadow('info')).instrumentationRevision, GROUP_CANDIDATE_MARKER);
  assert.equal((await request('scene.count')).sceneCount, 8);
}
async function find(id: unknown): Promise<Wire> {
  await guard(); const tracks = await request('track.list'); assert.equal(tracks.count, tracks.itemCount);
  assert(Number(tracks.count) <= 16); const found = (tracks.tracks as Wire[]).find(track => track.channelId === id); assert(found); return found;
}
async function writer(state: Wire, row: number, mechanism = 'track'): Promise<void> {
  const track = await find(state.trackId), cursor = 'fine';
  const tracks = (await request('track.list')).tracks as Wire[];
  assert.equal(tracks.filter(value => value.name === track.name).length, 1, 'reader target name must be unique');
  const topology = await shadow('trackTopology'); assert.equal(topology.membershipComplete, true);
  const raw = ((topology.candidates as Wire).first as Wire), banks = [raw.roots, ...Object.values(raw.children as Wire)] as Wire[];
  const addressed = banks.flatMap(bank => bank.rows as Wire[]).filter(value => value.channelId === state.trackId);
  assert.equal(addressed.length, 1); const localPosition = addressed[0]!.position;
  await request('cursor.pin', { cursor, pinned: false }); await request('cursor.pinTrack', { cursor, pinned: false });
  await request('cursor.pointTrack', { cursor, trackIndex: track.index });
  await request('slot.select', { trackIndex: track.index, slotIndex: row, mechanism });
  await poll(() => request('cursor.status', { cursor }), value => value.slotExists === true && value.sceneIndex === row &&
    value.trackName === track.name && value.trackPosition === localPosition);
  await request('cursor.pinTrack', { cursor, pinned: true }); await request('cursor.pin', { cursor, pinned: true });
  await request('cursor.setStepSize', { cursor, stepSize: GRID }); await request('cursor.scrollToStep', { cursor, step: 0 }); await wait(200);
}
async function seed(path: string, trackId: string, pitch: number, resumeEmpty = false): Promise<void> {
  assert([60, 72].includes(pitch)); const track = await find(trackId); assert.equal(track.type, 'Instrument');
  const state: Wire = { schema: 'phase8g5a-seed-v1', project: 'New 5', trackId, pitch, clipName: `gn-8g4-${pitch}`,
    complete: false, eligible: false, ownedRows: [0, 1], tracksBefore: await request('track.list') };
  for (const row of [0, 1]) {
    const occupied = (await request('slot.status', { trackIndex: track.index, slotIndex: row })).hasContent;
    if (resumeEmpty && row === 0 && occupied === true) {
      await writer(state, row); assert.equal((await request('cursor.clipMetadata', { cursor: 'fine' })).name, '');
      assert.equal((await request('cursor.getNotesVerboseAllChannels', { cursor: 'fine', maxX: 2048 })).count, 0);
    } else { assert.equal(occupied, false); await request('clip.create', { trackIndex: track.index, slotIndex: row, lengthBeats: 4 }); await wait(200); await writer(state, row); }
    await request('cursor.setClipMetadata', { cursor: 'fine', name: row === 0 ? state.clipName : `gn-8g5a-canary-${pitch}` });
    for (let channel = 0; channel < 16; channel++) await request('cursor.setNotes', { cursor: 'fine', channel,
      notes: Array.from({ length: 4 }, (_, cell) => [cell * 8, pitch + cell, 80 + channel, 8 * GRID]) });
    await wait(250);
  }
  await writer(state, 0); state.notes = await request('cursor.getNotesVerboseAllChannels', { cursor: 'fine', maxX: 2048 });
  state.confirmationNotes = await request('cursor.getNotesVerboseAllChannels', { cursor: 'fine', maxX: 2048 });
  state.metadata = await request('cursor.clipMetadata', { cursor: 'fine' });
  verifySeed(state); assert.deepEqual(independentNotes(state.notes as Wire), independentNotes(state.confirmationNotes as Wire));
  state.topology = await shadow('trackTopology'); await save(path, state); console.log(JSON.stringify({ seeded: trackId, notes: 64 }));
}
async function bind(state: Wire): Promise<void> {
  const track = await find(state.trackId), topology = await shadow('trackTopology');
  assert.equal(topology.membershipComplete, true); assert.equal(topology.topologyControlRevision, '8g5a-uuid-group-master-v1');
  const start = await shadow('point', { index: 0, trackIndex: track.index, row: 0, canaryTrackIndex: track.index, canaryRow: 1 });
  assert.equal(start.index, 0, JSON.stringify(start));
  const settled = await poll(() => shadow('poll', { index: 0 }), value => value.phase === 'retired' ||
    (['settled', 'complete'].includes(String(value.phase)) && value.canaryPhase === 'target'));
  assert.notEqual(settled.phase, 'retired', JSON.stringify(settled)); assert.equal(settled.canaryVerifiedForBinding, true);
  await poll(() => shadow('reconcile', { index: 0 }), value => value.physicalPendingHints === 0 && value.pendingCoordinates === 0);
}
async function compare(state: Wire): Promise<Wire> {
  await bind(state); let value = await shadow('compareStart', { index: 0 });
  value = await poll(async () => value.comparison === 'pending' ? (value = await shadow('comparePoll')) : value, value => value.comparison !== 'pending');
  return value;
}
async function comparison(path: string, sourcePath: string): Promise<void> {
  const source = await read(sourcePath); await writer(source, 0);
  const notes = await request('cursor.getNotesVerboseAllChannels', { cursor: 'fine', maxX: 2048 });
  assert.deepEqual(independentNotes(notes), independentNotes(source.notes as Wire));
  const report: Wire = { schema: 'phase8g5a-comparison-v1', project: 'New 5', complete: false, eligible: false,
    source, notes, metadata: await request('cursor.clipMetadata', { cursor: 'fine' }), topology: await shadow('trackTopology'),
    tracks: await request('track.list'), comparison: await compare(source) };
  await save(path, report); verifyComparison(report.comparison as Wire, source, GROUP_CANDIDATE_MARKER);
  console.log(JSON.stringify({ comparison: 'match', track: source.trackId, notes: 64 }));
}
async function arm(path: string, sourcePath: string, label: string): Promise<void> {
  const source = await read(sourcePath); await guard(); const before = await compare(source);
  verifyComparison(before, source, GROUP_CANDIDATE_MARKER);
  const active = await shadow('compareStart', { index: 0 });
  closed(active); noPayload(active); assert.equal(active.comparison, 'pending'); assert.equal(active.scanStage, 'membership');
  await save(path, { schema: 'phase8g5a-change-arm-v1', project: 'New 5', label, complete: false, eligible: false,
    source, before, active, status: await shadow('status', { index: 0 }), info: await shadow('info'),
    topology: await shadow('trackTopology'), tracks: await request('track.list'), armedAt: new Date().toISOString() });
  console.log(JSON.stringify({ armed: label, scanId: active.scanId }));
}
async function finish(path: string, armPath: string): Promise<void> {
  const arm = await read(armPath); await guard();
  const retired = await shadow('compareStatus'), status = await shadow('status', { index: 0 }), info = await shadow('info');
  const topology = await shadow('trackTopology');
  await save(path, { schema: 'phase8g5a-change-result-v1', project: 'New 5', complete: false, eligible: false,
    arm, retired, status, info, topology, tracks: await request('track.list'), finishedAt: new Date().toISOString() });
  closed(retired); noPayload(retired); assert.equal(retired.comparison, 'window-changed');
  assert(Number(info.automaticIdentityInvalidations) > Number((arm.info as Wire).automaticIdentityInvalidations));
  assert.equal(topology.membershipComplete, true);
  console.log(JSON.stringify({ label: arm.label, comparison: retired.comparison, topologyAccepted: true }));
}
/** Remove owned clips only after native ungrouping restores the original track order. */
async function cleanup(path: string, seedPath: string, baselinePath: string): Promise<void> {
  const source = await read(seedPath), entry = await read(baselinePath), expected = entry.baseline as Wire;
  assert.equal(entry.schema, 'phase8g5a-candidates-v1'); assert.equal(entry.project, 'New 5');
  verifySeed(source); await guard();
  const tracks = await request('track.list'), original = (expected.tracks as Wire).tracks as Wire[];
  assert.deepEqual((tracks.tracks as Wire[]).map(track => track.channelId), original.map(track => track.channelId));
  const topology = await shadow('trackTopology'); assert.equal(topology.membershipComplete, true);
  assert.deepEqual(Object.keys(((topology.tree as Wire).children as Wire)), []);
  const report: Wire = { schema: 'phase8g5a-fixture-content-cleanup-v1', project: 'New 5',
    complete: false, eligible: false, readerRestorePending: true, source, baselinePath,
    tracksBefore: tracks, topologyBefore: topology, deleted: [] };
  await save(path, report);
  const checkpoint = async (): Promise<void> => writeFile(path, JSON.stringify(report, null, 1) + '\n');
  try {
    for (const row of [0, 1]) {
      await writer(source, row);
      const metadata = await request('cursor.clipMetadata', { cursor: 'fine' });
      assert.equal(metadata.exists, true);
      assert.equal(metadata.name, row === 0 ? source.clipName : `gn-8g5a-canary-${source.pitch}`);
      const notes = await request('cursor.getNotesVerboseAllChannels', { cursor: 'fine', maxX: 2048 });
      assert.deepEqual(independentNotes(notes), independentNotes(source.notes as Wire));
      (report.deleted as Wire[]).push({ row, metadata, notes, stage: 'verified' }); await checkpoint();
      const track = await find(source.trackId);
      await request('slot.delete', { trackIndex: track.index, slotIndex: row });
      await poll(() => request('slot.status', { trackIndex: track.index, slotIndex: row }), value => value.hasContent === false);
      ((report.deleted as Wire[]).at(-1)!).stage = 'deleted'; await checkpoint();
    }
    for (const index of [0, 1]) await shadow('retire', { index });
    for (const cursor of ['0', '1', '2', '3', '4', '5', '6', '7', 'fine', 'observer']) {
      await request('cursor.pin', { cursor, pinned: false }); await request('cursor.pinTrack', { cursor, pinned: false });
    }
    for (const track of original) {
      const current = await find(track.channelId);
      if (current.name !== track.name) await request('track.setName', { trackIndex: current.index, name: track.name });
    }
    await poll(() => request('track.list'), value => JSON.stringify(value) === JSON.stringify(expected.tracks));
    const slots: Wire[] = [];
    for (const track of original) for (let row = 0; row < 8; row++)
      slots.push({ trackId: track.channelId, row, ...await request('slot.status', { trackIndex: track.index, slotIndex: row }) });
    report.tracks = await request('track.list'); report.slots = slots;
    const contentValues = (values: Wire[]): Wire[] => values.map(value => {
      const copy = { ...value }; delete copy.isSelected; return copy;
    });
    assert.deepEqual(contentValues(slots), contentValues(expected.slots as Wire[]));
    report.selectionRestorePending = true;
    report.scan = await request('rig.scanTracks'); assert.equal((report.scan as Wire).slotsWithContent, 0);
    report.finishedAt = new Date().toISOString(); report.contentBaselineRestored = true;
  } catch (error) { report.error = String(error); throw error; }
  finally { await checkpoint(); }
  console.log(JSON.stringify({ project: 'New 5', originalTracks: 4, emptySlots: 32, readerRestorePending: true }));
}
async function main(): Promise<void> {
  const [mode, path, source, label] = process.argv.slice(2); assert(path && source);
  if (mode === 'seed' || mode === 'resume-empty-seed') { assert(label); await seed(path, source, Number(label), mode === 'resume-empty-seed'); }
  else if (mode === 'compare') await comparison(path, source);
  else if (mode === 'arm') { assert(label); await arm(path, source, label); }
  else if (mode === 'cleanup') { assert(label); await cleanup(path, source, label); }
  else if (mode === 'reader-check' || mode === 'reader-check-slot') {
    const state = await read(source); const mechanism = mode === 'reader-check-slot' ? 'slot' : 'track'; await writer(state, 1, mechanism);
    const status = await request('cursor.status', { cursor: 'fine' }), notes = await request('cursor.getNotesVerboseAllChannels', { cursor: 'fine', maxX: 2048 });
    await save(path, { schema: 'phase8g5a-reader-diagnostic-v1', complete: false, eligible: false, status, notes });
    assert.equal(notes.count, 64); await writer(state, 0, mechanism);
  }
  else { assert.equal(mode, 'finish'); await finish(path, source); }
}
void main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => bridge.disconnect());
