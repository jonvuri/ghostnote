/** Add one existing preset to the owned mutation fixture. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { BridgeClient } from '../client.js';

type Wire = Record<string, unknown>;
interface Track { index: number; name: string; channelId: string }
const STATE = '/tmp/ghostnote-8g-research-state.json';
const OUTPUT = '/tmp/ghostnote-8g-mutation-witness.json';
const PRESET = fileURLToPath(new URL('../../fixtures/InstrumentLayer/gn_layer_4chain.bwpreset', import.meta.url));
const REQUIRED = ['cache.shadow', 'track.list', 'rig.scanTracks', 'rig.methods', 'slot.status', 'slot.select', 'cursor.pin',
  'cursor.pinTrack', 'cursor.pointTrack', 'cursor.status', 'cursor.scrollToStep', 'cursor.setStepSize', 'cursor.clipMetadata',
  'cursor.getNotesVerboseAllChannels', 'device.list', 'device.insertFile', 'chain.inventory'];
const bridge = new BridgeClient();
const wait = async (): Promise<void> => await new Promise(resolve => setTimeout(resolve, 100));
async function request<T = Wire>(method: string, params?: Wire): Promise<T> { return await bridge.request(method, params) as T; }
async function root(): Promise<Wire> { return await request('cache.shadow', { operation: 'rootSnapshot' }); }
async function poll(read: () => Promise<Wire>, done: (value: Wire) => boolean): Promise<Wire> {
  const started = performance.now();
  for (;;) { const value = await read(); if (done(value)) return value;
    assert(performance.now() - started < 15_000, `witness did not settle: ${JSON.stringify(value)}`); await wait(); }
}
function rootValue(value: Wire, field: string): unknown {
  const current = value.current as Wire, read = current[field] as Wire;
  assert.equal(read?.status, 'read', `root field unavailable: ${field}`); return read.value;
}
async function owned(id: string): Promise<Track> {
  const listed = await request<{ tracks: Track[]; count: number; itemCount: number; bankSize: number }>('track.list');
  assert.equal(listed.count, listed.itemCount); assert(listed.itemCount <= listed.bankSize);
  const matching = listed.tracks.filter(track => track.channelId === id); assert.equal(matching.length, 1);
  assert.equal(matching[0]!.name, 'gn-8g-reuse', 'track is not the owned replay fixture'); return matching[0]!;
}
async function guardRoot(id: string): Promise<Wire> {
  const track = await owned(id), value = await root();
  assert.equal(rootValue(value, 'hasActiveEngine'), true, 'the disposable project engine must be active');
  assert.equal(rootValue(value, 'projectExists'), true); assert.equal(rootValue(value, 'rootExists'), true);
  const witness = value.existingChainWitnesses as Wire;
  assert(typeof witness.trackWindow === 'number' && witness.trackWindow > 0 && witness.trackWindow <= 4);
  assert(track.index < witness.trackWindow, 'owned track is outside the first four root witness tracks');
  const current = witness.current as Wire, field = current[`chainWitness.track.${track.index}.channelId`] as Wire;
  assert.equal(field?.status, 'read'); assert.equal(field.value, id, 'root witness track differs from the owned track');
  return value;
}
async function pointTrack(track: Track): Promise<void> {
  await request('cursor.pin', { cursor: '0', pinned: false }); await request('cursor.pinTrack', { cursor: '0', pinned: false });
  await request('cursor.pointTrack', { cursor: '0', trackIndex: track.index });
  await poll(() => request('device.list', { cursor: '0' }), value => value.trackChannelId === track.channelId && value.trackPosition === track.index);
  await request('cursor.pinTrack', { cursor: '0', pinned: true });
}
async function deviceInventory(track: Track): Promise<Wire> {
  await pointTrack(track); let previous = '';
  return await poll(() => request('device.list', { cursor: '0' }), value => {
    const text = JSON.stringify(value), stable = text === previous; previous = text;
    return stable && value.trackChannelId === track.channelId && value.count === value.itemCount && Number(value.itemCount) <= Number(value.bankSize);
  });
}
async function fixtureNotes(id: string): Promise<Wire[]> {
  const result: Wire[] = [], track = await owned(id);
  for (let row = 0; row < 3; row++) {
    await pointTrack(track); await request('slot.select', { trackIndex: track.index, slotIndex: row, mechanism: 'track' });
    await poll(() => request('cursor.status', { cursor: '0' }), value => value.slotExists === true && value.sceneIndex === row);
    await request('cursor.pin', { cursor: '0', pinned: true }); await request('cursor.setStepSize', { cursor: '0', stepSize: 1 / 512 });
    const metadata = await request('cursor.clipMetadata', { cursor: '0' });
    assert.equal(metadata.name, `gn-8g-reuse-${['A', 'B', 'empty'][row]}`); assert.equal(metadata.playStop, 4); assert.equal(metadata.loopLength, 4);
    const notes: Wire[] = [];
    for (let page = 0; page < 2048; page += 512) {
      await request('cursor.scrollToStep', { cursor: '0', step: page }); await wait();
      const scan = await request<{ channels: { channel: number; notes: Wire[] }[]; clipExists: boolean }>('cursor.getNotesVerboseAllChannels', { cursor: '0', maxX: 512 });
      assert.equal(scan.clipExists, true); assert.deepEqual(scan.channels.map(value => value.channel), Array.from({ length: 16 }, (_, channel) => channel));
      for (const channel of scan.channels) for (const note of channel.notes) {
        assert.equal(note.channel, channel.channel); const rawX = Number(note.x);
        assert(Number.isSafeInteger(rawX)); const cell = rawX >= 0 && rawX < 512 ? page + rawX : rawX;
        assert(cell >= page && cell < page + 512, 'note coordinate is outside the scanned page');
        notes.push({ ...note, x: cell, sourceX: rawX, sourcePage: page });
      }
    }
    notes.sort((a, b) => Number(a.channel) - Number(b.channel) || Number(a.x) - Number(b.x) || Number(a.y) - Number(b.y));
    const addresses = notes.map(note => `${note.channel}:${note.x}:${note.y}`).sort();
    assert.deepEqual(addresses, row === 0 ? Array.from({ length: 16 }, (_, channel) => `${channel}:0:60`).sort()
      : row === 1 ? ['0:1024:72', '15:1024:72'] : []);
    result.push({ row, metadata, notes });
  }
  await request('cursor.scrollToStep', { cursor: '0', step: 0 }); return result;
}
async function census(id: string): Promise<Wire> {
  const tracks = await request<{ tracks: Track[]; count: number; itemCount: number; bankSize: number }>('track.list');
  assert.equal(tracks.count, tracks.itemCount); assert(tracks.itemCount <= tracks.bankSize);
  const scan = await request('rig.scanTracks'), scenes = Number(scan.sceneCount);
  assert(Number.isInteger(scenes) && scenes >= 3 && scenes <= 64);
  const devices: Wire = {}, slots: Wire[] = [];
  for (const track of tracks.tracks) {
    devices[track.channelId] = await deviceInventory(track);
    for (let row = 0; row < scenes; row++) {
      const slot = await request('slot.status', { trackIndex: track.index, slotIndex: row });
      assert.equal(typeof slot.hasContent, 'boolean');
      if (track.channelId !== id) assert.equal(slot.hasContent, false, 'this helper requires the empty non-fixture tracks');
      slots.push({ channelId: track.channelId, row, exists: slot.exists, hasContent: slot.hasContent });
    }
  }
  const notes = await fixtureNotes(id);
  return { tracks, devices, slots, notes, scan: Object.fromEntries(Object.entries(scan).filter(([field]) => field !== 'scanMicros')) };
}
function compareCensus(before: Wire, after: Wire, id: string): void {
  for (const field of ['tracks', 'slots', 'notes', 'scan']) assert.deepEqual(after[field], before[field], `fixture census changed: ${field}`);
  const oldDevices = before.devices as Wire, newDevices = after.devices as Wire;
  for (const track of Object.keys(oldDevices)) if (track !== id) assert.deepEqual(newDevices[track], oldDevices[track], 'another track device inventory changed');
}
function checkLayer(devices: Wire, inventory: Wire, rootSnapshot: Wire, id: string): void {
  assert.equal(devices.trackChannelId, id); assert.equal(devices.count, 1); assert.equal(devices.itemCount, 1);
  assert.deepEqual((devices.devices as Wire[]).map(value => value.name), ['Instrument Layer']);
  const scopes = inventory.scopes as Wire[], scope = scopes[0]!;
  assert.equal(scope.deviceExists, true); assert.equal(scope.deviceName, 'Instrument Layer'); assert.equal(scope.hasLayers, true);
  assert.equal(scope.chainCount, 4); assert.equal(scope.visibleChainCount, 4);
  const chains = scope.chains as Wire[]; assert.equal(chains.length, 4);
  assert(chains.every(chain => typeof chain.name === 'string' && chain.name.length > 0 && typeof chain.channelId === 'string' && chain.channelId.length > 0));
  assert.equal(new Set(chains.map(chain => chain.channelId)).size, 4);
  const candidates = ((rootSnapshot.existingChainWitnesses as Wire).candidates as Wire[]).filter(value => value.trackChannelId === id);
  assert.equal(candidates.length, 4);
  assert.deepEqual(candidates.map(value => value.layerWindowIndex).sort(), [0, 1, 2, 3]);
  assert(candidates.every(value => value.deviceWindowIndex === 0 && value.deviceName === 'Instrument Layer' && value.layerCount === 4 && value.trackDeviceCount === 1));
  assert.deepEqual(candidates.map(value => value.chainChannelId).sort(), chains.map(value => value.channelId).sort());
}
async function settledLayer(id: string): Promise<Wire> {
  const track = await owned(id), devices = await deviceInventory(track);
  const inventory = await poll(() => request('chain.inventory'), value => {
    const scope = (value.scopes as Wire[])[0]; return scope?.deviceName === 'Instrument Layer' && scope.chainCount === 4 && (scope.chains as Wire[]).length === 4;
  });
  const snapshot = await poll(() => guardRoot(id), value => ((value.existingChainWitnesses as Wire).candidates as Wire[]).filter(candidate => candidate.trackChannelId === id).length === 4);
  checkLayer(devices, inventory, snapshot, id); return { devices, inventory, root: snapshot };
}
async function presetHash(): Promise<string> { return createHash('sha256').update(await readFile(PRESET)).digest('hex'); }
async function save(value: Wire, exclusive = false): Promise<void> { await writeFile(OUTPUT, JSON.stringify(value, null, 2) + '\n', exclusive ? { flag: 'wx' } : undefined); }
async function loadMarker(): Promise<Wire | undefined> {
  try { return JSON.parse(await readFile(OUTPUT, 'utf8')) as Wire; }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; return undefined; }
}
/** Verify retained ownership and unchanged inventories without accessing the host. */
export function verifyMutationWitness(report: Wire, ownedTrackId: string): void {
  assert.equal(report.researchOnly, true); assert.equal(report.identityDetectionProved, false);
  assert.equal(report.status, 'ready'); assert.equal(report.ownedTrackId, ownedTrackId);
  assert.equal(typeof report.presetPath, 'string');
  assert((report.presetPath as string).endsWith('/brain/fixtures/InstrumentLayer/gn_layer_4chain.bwpreset'));
  assert.match(String(report.presetSha256), /^[a-f0-9]{64}$/);
  assert.equal(report.presetSha256After, report.presetSha256); assert.equal(typeof report.insertRequestedAt, 'string');
  assert.equal(typeof report.ended, 'string');
  assert.deepEqual(report.insertParams, { cursor: '0', path: report.presetPath, expectedTrackChannelId: ownedTrackId, expectedDeviceNames: [] });
  const before = report.before as Wire, after = report.after as Wire;
  assert.equal(((before.devices as Wire)[ownedTrackId] as Wire).count, 0);
  compareCensus(before, after, ownedTrackId);
  const layer = report.layer as Wire;
  assert.deepEqual(layer.devices, (after.devices as Wire)[ownedTrackId]);
  checkLayer(layer.devices as Wire, layer.inventory as Wire, layer.root as Wire, ownedTrackId);
}
async function setup(inspect = false): Promise<void> {
  const state = JSON.parse(await readFile(STATE, 'utf8')) as Wire;
  assert.equal(typeof state.ownedTrackId, 'string'); assert.equal(state.baselineSlotsWithContent, 0);
  const id = state.ownedTrackId as string, hash = await presetHash(), rootBefore = await guardRoot(id);
  const methods = await request('rig.methods'); assert.equal(methods.runtimeProfile, 'phase-8-probe-v1');
  assert(Array.isArray(methods.methods)); assert(REQUIRED.every(method => (methods.methods as string[]).includes(method)), 'required witness methods unavailable');
  const existing = await loadMarker();
  if (existing) { assert.equal(existing.ownedTrackId, id); assert.equal(existing.presetPath, PRESET); assert.equal(existing.presetSha256, hash);
    assert.equal((existing.insertParams as Wire)?.expectedTrackChannelId, id); assert.deepEqual((existing.insertParams as Wire)?.expectedDeviceNames, []);
    assert.equal((existing.insertParams as Wire)?.path, PRESET); assert.equal((existing.insertParams as Wire)?.cursor, '0'); }
  const before = await census(id), track = await owned(id), deviceBefore = (before.devices as Wire)[id] as Wire;
  let report: Wire;
  if (deviceBefore.count !== 0) {
    assert(existing, 'preexisting device has no owned insertion marker');
    assert.equal(typeof existing.insertRequestedAt, 'string', 'the marker does not record a prior insertion request');
    compareCensus(existing.before as Wire, before, id);
    const layer = await settledLayer(id);
    if (inspect) { assert.equal(await presetHash(), hash, 'preset asset changed'); existing.inspection = { capturedAt: new Date().toISOString(), census: before, layer }; await save(existing); console.log('Owned insertion has an independent read-only inventory inspection.'); return; }
    assert(existing.inspection, 'run inspect before resuming a prior insertion');
    assert.deepEqual((existing.inspection as Wire).census, before, 'device or fixture inventory changed after inspection');
    report = existing; report.resumedAfterInspection = true;
  } else {
    assert(!inspect, 'no inserted device is available for inspection'); assert(!existing, 'prior insertion state exists; do not submit a second insertion');
    const params = { cursor: '0', path: PRESET, expectedTrackChannelId: id, expectedDeviceNames: [] };
    report = { researchOnly: true, identityDetectionProved: false, ownedTrackId: id, presetPath: PRESET, presetSha256: hash,
      started: new Date().toISOString(), status: 'insert-authorized', before, rootBefore, methods, insertParams: params };
    await save(report, true);
    await pointTrack(track); const current = await deviceInventory(await owned(id)); assert.equal(current.trackChannelId, id); assert.equal(current.itemCount, 0); assert.equal(current.count, 0);
    await guardRoot(id); report.insertRequestedAt = new Date().toISOString(); await save(report);
    try { report.insertResult = await request('device.insertFile', params); await save(report); }
    catch (error) { report.insertError = String(error); await save(report); throw error; }
  }
  try {
    report.layer = await settledLayer(id); const after = await census(id); compareCensus(report.before as Wire, after, id);
    assert.equal(await presetHash(), hash, 'preset asset changed'); report.after = after; report.presetSha256After = hash;
    report.status = 'ready'; report.ended = new Date().toISOString(); await save(report);
    await pointTrack(await owned(id)); console.log('Owned Instrument Layer has four root-visible chains. No note or other-track change was made.');
  } catch (error) { report.settleError = String(error); await save(report); throw error; }
}
async function main(): Promise<void> {
  if (process.argv[2] === 'verify') {
    const state = JSON.parse(await readFile(STATE, 'utf8')) as Wire;
    const report = JSON.parse(await readFile(process.argv[3] ?? OUTPUT, 'utf8')) as Wire;
    verifyMutationWitness(report, state.ownedTrackId as string); assert.equal(await presetHash(), report.presetSha256);
    console.log('Owned witness artifact and fixed preset hash pass.');
  } else { assert(['setup', 'inspect'].includes(process.argv[2] ?? '')); await setup(process.argv[2] === 'inspect'); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  void main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => bridge.disconnect());
