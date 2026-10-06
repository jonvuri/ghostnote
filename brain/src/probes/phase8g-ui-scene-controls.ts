// 8h3e removed the research wire or rig configuration that this live driver uses. Live use needs the
// earlier research build of its own session. Its retained artifacts and offline checks do not need a host.
/** Check a declared native scene edit inside a named owned tail. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { BridgeClient } from '../client.js';
import { identityEndpoint } from './phase8g-identity-fence.js';
import { checkExpectedFixture } from './phase8g-lifecycle-reuse.js';
import { MUTATION_MARKER, checkMutationComparison, collectMutationRegistry } from './phase8g-shadow-mutations.js';
import { automaticStructureFence, checkStructureComparison } from './phase8g-shadow-structure.js';
import { groupCancellationObserved, groupCensus, verifyTrackGroups } from './phase8g-ui-group-controls.js';
import type { ShadowCacheWireSnapshot, ShadowNote } from './phase8g-shadow-cache-lib.js';

type Wire = Record<string, unknown>;
interface SceneRow { index: number; exists: boolean; name: string; position: number }
interface Track { index: number; channelId: string; name: string; position: number; type: string }
interface Target { id: string; row: number; name: string; notes: readonly ShadowNote[] }
export const SCENE_CONTROL_REVISION = '8g-scene-controls-v1';
export const UI_SCENE_OUTPUT = '/tmp/ghostnote-8g-ui-scene-v5-results.json';
export type SceneFinishMode = 'finish-insert' | 'finish-add-move';
export function sceneActionProvenance(mode: SceneFinishMode): Wire {
  const compound = mode === 'finish-add-move';
  return { kind: compound ? 'compound-add-move' : 'declared-direct-insertion', source: 'user-reported',
    actions: compound ? ['native-add-after-selected-target', 'native-move-added-scene-before-target'] : ['native-insert-before-observed-target'],
    actionCount: compound ? 2 : 1, intermediateStatesObserved: false, singleInsertionDeclared: !compound, singleInsertionProved: false };
}
export function parseSceneFinishArguments(mode: SceneFinishMode, args: readonly string[]): { output: string; provenance: Wire } {
  const flags = args.filter(arg => arg.startsWith('--')), paths = args.filter(arg => !arg.startsWith('--'));
  assert(paths.length <= 1, 'use at most one report path');
  assert.deepEqual(flags, mode === 'finish-insert' ? ['--direct-insertion-confirmed'] : [],
    'finish-insert requires --direct-insertion-confirmed; use finish-add-move for Add followed by Move');
  return { output: paths[0] ?? UI_SCENE_OUTPUT, provenance: sceneActionProvenance(mode) };
}
function actionEvidence(provenance: Wire, fence: Wire, cancelled: boolean): Wire {
  const compound = provenance.kind === 'compound-add-move';
  assert.deepEqual(provenance, sceneActionProvenance(compound ? 'finish-add-move' : 'finish-insert'));
  return { caseLabels: [compound ? 'native-add-after-and-move-before-observed-target' : 'native-insert-before-observed-target'],
    actionCount: provenance.actionCount, singleInsertionProved: false,
    aggregateMutationFenceObserved: fence.observed === true, aggregateScanCancelled: cancelled,
    automaticInsertionAcceptanceComplete: !compound && fence.observed === true && cancelled };
}
/** Endpoint layout cannot identify the action sequence or its individual effects. */
export function verifySceneActionEvidence(report: Wire): Wire {
  const prepared = report.prepare as Wire, inserted = report.inserted as Wire;
  const fence = automaticStructureFence(prepared.info as Wire, inserted.info as Wire, inserted.status as Wire, inserted.read as Wire);
  const cancelled = groupCancellationObserved(inserted.poll as Wire);
  assert.deepEqual(inserted.aggregateMutationFence, fence);
  const evidence = actionEvidence(report.actionProvenance as Wire, fence, cancelled);
  for (const [key, value] of Object.entries(evidence)) assert.deepEqual(report[key], value);
  if ((report.actionProvenance as Wire).kind === 'compound-add-move') {
    assert(!('automaticFence' in inserted)); assert(!('staleComparisonCancelled' in inserted));
  } else {
    assert.deepEqual(inserted.automaticFence, fence); assert.equal(inserted.staleComparisonCancelled, cancelled);
  }
  return evidence;
}
export const SCENE_METHODS = ['cache.shadow', 'rig.methods', 'rig.scanTracks', 'track.list', 'track.create', 'track.setName',
  'track.delete', 'scene.count', 'scene.create', 'scene.delete', 'clip.create', 'slot.status', 'slot.delete', 'slot.select',
  'cursor.pin', 'cursor.pinTrack', 'cursor.pointTrack', 'cursor.status', 'cursor.setStepSize', 'cursor.scrollToStep',
  'cursor.setClipMetadata', 'cursor.setNotes', 'cursor.getNotesVerboseAllChannels'] as const;
export function verifySceneMethods(value: Wire): void {
  assert.equal(value.runtimeProfile, 'phase-8-probe-v1'); assert(Array.isArray(value.methods));
  assert.deepEqual(SCENE_METHODS.filter(method => !(value.methods as string[]).includes(method)), []);
}
export function uiSceneSeedSettled(value: Wire): boolean {
  if (!Array.isArray(value.channels) || value.channels.length !== 16 || value.count !== 1) return false;
  const channels = value.channels as Wire[];
  if (new Set(channels.map(channel => channel.channel)).size !== 16
    || channels.some(channel => !Number.isInteger(channel.channel) || Number(channel.channel) < 0 || Number(channel.channel) > 15 || !Array.isArray(channel.notes))) return false;
  const notes: Wire[] = channels.flatMap(channel => (channel.notes as Wire[]).map(note => ({ ...note, sourceChannel: channel.channel })));
  if (notes.length !== 1) return false; const note = notes[0]!;
  return note.sourceChannel === 0 && note.x === 0 && note.y === 67
    && Math.abs(Number(note.velocity) - 91 / 127) < 1e-6 && note.duration === 5 / 512;
}
export function sceneRows(value: Wire): SceneRow[] {
  assert.equal(value.sceneControlRevision, SCENE_CONTROL_REVISION); assert.equal(value.coherent, true); assert.equal(value.fullWindow, true);
  assert.equal(value.researchOnly, true); assert.equal(value.sceneIdentityProved, false); assert.equal(value.hostInputOrderingProved, false);
  assert.equal(value.namesAreMutable, true); assert.equal(value.windowStart, 0); assert.equal(value.callbacksChangedDuringRead, false);
  assert.equal(value.sequenceBeforeRead, value.sequenceAfterRead); assert(Array.isArray(value.scenes));
  const count = Number(value.totalCount), size = Number(value.bankSize); assert(Number.isSafeInteger(count) && count >= 0 && count <= size && size <= 128);
  assert.equal(value.scenes.length, size); const result: SceneRow[] = [];
  for (const [index, row] of (value.scenes as Wire[]).entries()) {
    assert.equal(row.index, index); assert.equal(row.exists, index < count); assert(!row.readError);
    if (index < count) { assert.equal(row.position, index); assert.equal(typeof row.name, 'string'); result.push(row as unknown as SceneRow); }
  }
  return result;
}
/** These names guard a local edit. They do not identify a loaded scene instance. */
export function verifyOwnedSceneTail(baseline: Wire, current: Wire, names: readonly string[]): void {
  const before = sceneRows(baseline), after = sceneRows(current); assert.equal(before.length, 8);
  assert.equal(new Set(names).size, names.length); assert(names.every(name => name.startsWith('gn-8g-ui-scene-') && !before.some(row => row.name === name)));
  assert.equal(after.length, 8 + names.length); assert.deepEqual(after.slice(0, 8), before);
  assert.deepEqual(after.slice(8).map(row => row.name), names);
}
/** The final layout puts one extra scene before the middle marker. */
export function verifyNativeSceneInsertion(baseline: Wire, current: Wire, names: readonly string[]): SceneRow {
  assert.equal(names.length, 3); const rows = sceneRows(current); assert.equal(rows.length, 12);
  assert.deepEqual(rows.slice(0, 8), sceneRows(baseline));
  assert.equal(rows[8]!.name, names[0]); assert.equal(rows[10]!.name, names[1]); assert.equal(rows[11]!.name, names[2]);
  assert(!names.includes(rows[9]!.name)); return rows[9]!;
}
export function verifySceneSlotLayout(values: Wire[], trackIds: readonly string[], temporaryId: string | undefined, targetRow: number | undefined, originalId: string, count: number): void {
  assert.equal(values.length, trackIds.length * count); const keys = new Set<string>();
  for (const value of values) {
    assert(trackIds.includes(String(value.id))); const row = Number(value.row); assert(Number.isSafeInteger(row) && row >= 0 && row < count);
    const key = `${value.id}:${row}`; assert(!keys.has(key)); keys.add(key);
    assert.equal(value.hasContent, (value.id === originalId && row < 3) || (value.id === temporaryId && row === targetRow));
  }
}
export function verifySceneTrackExtension(baseline: Wire, current: Wire, originalId: string, childId: string, name: string): void {
  const before = groupCensus(baseline), now = groupCensus(current), position = before.findIndex(track => track.channelId === originalId) + 1;
  assert(position > 0); assert(!before.some(track => track.channelId === childId));
  const child = now.find(track => track.channelId === childId); assert(child && child.type === 'Instrument');
  const expected = [...before.slice(0, position), { ...child, name }, ...before.slice(position)]
    .map((track, index) => ({ ...track, index, position: index }));
  assert.deepEqual(now, expected, 'exact original census plus one owned tail instrument track required');
}
export function verifySceneReport(report: Wire): Wire {
  assert.equal(report.marker, MUTATION_MARKER); assert.equal(report.researchOnly, true); assert.equal(report.complete, false); assert.equal(report.eligible, false);
  assert.equal(report.sceneIdentityProved, false); assert.equal(report.hostInputOrderingProved, false);
  assert.equal(report.stage, 'finished'); assert.equal(report.fixtureRestored, true); assert.equal(report.temporaryFixturesRemoved, true);
  assert.equal(typeof report.ended, 'string'); assert(!report.error && !report.cleanupError); verifySceneMethods(report.methods as Wire);
  const actionSummary = verifySceneActionEvidence(report);
  assert.equal(report.atCaseDistinct, false); assert.equal(report.caseCount, 1);
  const before = report.baseline as Wire, prepared = report.prepare as Wire, inserted = report.inserted as Wire, after = report.after as Wire;
  const names = report.ownedSceneNames as string[], id = String(report.originalTrackId), child = String(report.ownedTrackId);
  const baselineTracks = groupCensus(before.trackList as Wire), readyTracks = groupCensus(prepared.trackList as Wire), originalIndex = baselineTracks.findIndex(track => track.channelId === id);
  verifySceneTrackExtension(before.trackList as Wire, prepared.trackList as Wire, id, child, String(report.ownedTrackName));
  assert.deepEqual(readyTracks.map(track => track.channelId), [...baselineTracks.slice(0, originalIndex + 1).map(track => track.channelId), child,
    ...baselineTracks.slice(originalIndex + 1).map(track => track.channelId)]);
  verifyOwnedSceneTail(before.sceneSnapshot as Wire, prepared.sceneSnapshot as Wire, names);
  verifyNativeSceneInsertion(before.sceneSnapshot as Wire, inserted.beforeRename as Wire, names);
  const finalNames = [names[0]!, String(report.insertedSceneName), names[1]!, names[2]!];
  verifyOwnedSceneTail(before.sceneSnapshot as Wire, inserted.afterRename as Wire, finalNames);
  const target = prepared.target as unknown as Target; assert.equal(target.id, child); assert.equal(target.row, 9);
  assert.equal(target.notes.length, 1); const note = target.notes[0]!;
  assert.deepEqual([note.channel, note.cell, note.pitch, note.fields.durationCells], [0, 0, 67, 5]); assert(Math.abs(Number(note.fields.velocity) - 91 / 127) < 1e-6);
  checkStructureComparison(prepared.fullComparison as Wire, target); checkStructureComparison(inserted.recoveryComparison as Wire, { ...target, row: 10 });
  verifySceneSlotLayout(prepared.slots as Wire[], readyTracks.map(track => track.channelId), child, 9, id, 11);
  verifySceneSlotLayout(inserted.slots as Wire[], readyTracks.map(track => track.channelId), child, 10, id, 12);
  const active = prepared.active as Wire; assert.equal(active.comparison, 'pending'); assert(Number(active.scanProgressCoordinates) > 0 && Number(active.scanProgressCoordinates) < 2048 * 128);
  assert.equal(active.scanTotalCoordinates, 2048 * 128);
  const deletions = (report.cleanup as Wire).deletions as Wire[]; assert.equal(deletions.length, 4);
  for (const [offset, deletion] of deletions.entries()) {
    assert.equal(deletion.index, 11 - offset); assert.equal(deletion.name, finalNames[3 - offset]);
    verifyOwnedSceneTail(before.sceneSnapshot as Wire, deletion.sceneSnapshot as Wire, finalNames.slice(0, 4 - offset));
  }
  assert.deepEqual(groupCensus(after.trackList as Wire), baselineTracks); assert.deepEqual(sceneRows(after.sceneSnapshot as Wire), sceneRows(before.sceneSnapshot as Wire));
  assert.deepEqual(after.slots, before.slots); assert.deepEqual(after.rootEndpoint, before.rootEndpoint);
  const restored = after.comparisons as Wire[], initial = before.comparisons as Wire[]; assert.equal(initial.length, 3); assert.equal(restored.length, 3);
  for (let row = 0; row < 3; row++) { const notes = (initial[row]!.diagnosticSnapshot as ShadowCacheWireSnapshot).notes;
    assert.deepEqual(checkExpectedFixture(notes, row), []); assert.deepEqual(checkMutationComparison(initial[row]!, row, id, notes), []);
    assert.deepEqual(checkMutationComparison(restored[row]!, row, id, notes), []); assert.deepEqual(restored[row]!.authorityMetadata, initial[row]!.authorityMetadata); }
  return { cases: 1, targetMovedFrom: 9, targetMovedTo: 10, actionProvenance: report.actionProvenance, ...actionSummary,
    restorationComparisons: 3, sceneIdentityProved: false, hostInputOrderingProved: false, complete: false, eligible: false };
}
const bridge = new BridgeClient();
async function request<T = Wire>(method: string, params?: Wire): Promise<T> { return await bridge.request(method, params) as T; }
async function shadow(operation: string, params: Wire = {}): Promise<Wire> { return await request('cache.shadow', { operation, ...params }); }
async function poll(read: () => Promise<Wire>, done: (value: Wire) => boolean): Promise<Wire> {
  const started = performance.now(); for (;;) { const value = await read(); if (done(value)) return value;
    assert(performance.now() - started < 45_000, `scene control expired: ${JSON.stringify(value)}`); await new Promise(resolve => setTimeout(resolve, 75)); }
}
async function tracks(): Promise<Wire> { const value = await request('track.list'); groupCensus(value); return value; }
async function find(id: string): Promise<Track> { const result = groupCensus(await tracks()).filter(track => track.channelId === id); assert.equal(result.length, 1); return result[0]!; }
async function scenes(): Promise<Wire> { const value = await shadow('sceneSnapshot'); sceneRows(value); return value; }
async function slots(values: Track[], count: number): Promise<Wire[]> {
  const result: Wire[] = []; for (const track of values) for (let row = 0; row < count; row++) { const value = await request('slot.status', { trackIndex: track.index, slotIndex: row });
    result.push({ id: track.channelId, row, exists: value.exists, hasContent: value.hasContent }); } return result;
}
async function inventory(operation = 'inventory'): Promise<void> { await collectMutationRegistry(await shadow(operation), () => shadow('rebuildPoll')); }
async function bind(id: string, row: number, canaryId: string): Promise<void> {
  const track = await find(id), canary = await find(canaryId); await shadow('point', { index: 0, trackIndex: track.index, row, canaryTrackIndex: canary.index, canaryRow: row === 1 && id === canaryId ? 0 : 1 });
  const result = await poll(() => shadow('poll', { index: 0 }), value => value.phase === 'retired' || ((value.phase === 'settled' || value.phase === 'complete') && value.canaryPhase === 'target'));
  assert.notEqual(result.phase, 'retired'); assert.equal(result.canaryVerifiedForBinding, true); await shadow('reconcile', { index: 0 });
}
async function comparison(): Promise<Wire> { let value = await shadow('compareStart', { index: 0 });
  return await poll(async () => { if (value.comparison === 'pending') value = await shadow('comparePoll'); return value; }, value => value.comparison !== 'pending'); }
async function originals(id: string, expected?: Wire[]): Promise<Wire[]> { await inventory(); const result: Wire[] = [];
  for (let row = 0; row < 3; row++) { await bind(id, row, id); const value = await comparison();
    const notes = expected ? (expected[row]!.diagnosticSnapshot as ShadowCacheWireSnapshot).notes : (value.diagnosticSnapshot as ShadowCacheWireSnapshot).notes;
    assert.deepEqual(checkExpectedFixture(notes, row), []); assert.deepEqual(checkMutationComparison(value, row, id, notes), []); result.push(value); } return result; }
async function save(output: string, report: Wire): Promise<void> { await writeFile(output, JSON.stringify(report, null, 2) + '\n'); }
async function rename(index: number, name: string): Promise<void> { const value = await scenes(), row = sceneRows(value)[index]!; assert(row);
  await shadow('setSceneName', { index, expectedName: row.name, expectedPosition: row.position, expectedTotalCount: value.totalCount, expectedBankSize: value.bankSize, name });
  await poll(scenes, next => sceneRows(next)[index]?.name === name); }
async function guardTracks(report: Wire): Promise<Wire> {
  const value = await tracks(); assert.deepEqual(groupCensus(value), groupCensus((report.prepare as Wire).trackList as Wire));
  assert.deepEqual(identityEndpoint(await shadow('rootSnapshot'), String(report.originalTrackId)), (report.baseline as Wire).rootEndpoint); return value;
}
async function prepare(output: string): Promise<void> {
  const methods = await request('rig.methods'); verifySceneMethods(methods);
  const state = JSON.parse(await readFile('/tmp/ghostnote-8g-research-state.json', 'utf8')) as Wire, witness = JSON.parse(await readFile('/tmp/ghostnote-8g-mutation-witness.json', 'utf8')) as Wire;
  const id = String(state.ownedTrackId); assert.equal(witness.status, 'ready'); assert.equal(witness.ownedTrackId, id);
  const endpoint = identityEndpoint(await shadow('rootSnapshot'), id); assert.deepEqual(endpoint, identityEndpoint((witness.layer as Wire).root as Wire, id, true));
  const trackList = await tracks(), baselineTracks = groupCensus(trackList), sceneSnapshot = await scenes();
  assert.deepEqual(baselineTracks.map(track => track.channelId).sort(), [...state.baselineIds as string[], id].sort());
  assert.equal(sceneRows(sceneSnapshot).length, 8); assert.equal(state.baselineScenes, 8); verifyTrackGroups(await shadow('trackGroups'), trackList);
  const baselineSlots = await slots(baselineTracks, 8); verifySceneSlotLayout(baselineSlots, baselineTracks.map(track => track.channelId), undefined, undefined, id, 8);
  const prefix = `gn-8g-ui-scene-${randomUUID().slice(0, 8)}`, names = [`${prefix}-first`, `${prefix}-target`, `${prefix}-last`];
  assert(!sceneRows(sceneSnapshot).some(row => row.name.startsWith(prefix))); assert(!baselineTracks.some(track => track.name.startsWith(prefix)));
  const report: Wire = { marker: MUTATION_MARKER, methods, researchOnly: true, complete: false, eligible: false, sceneIdentityProved: false,
    hostInputOrderingProved: false, started: new Date().toISOString(), stage: 'preparing', originalTrackId: id, ownedTrackName: `${prefix}-track`,
    ownedSceneNames: names, insertedSceneName: `${prefix}-inserted`, caseLabels: ['native-action-not-yet-declared'], caseCount: 1,
    atCaseDistinct: false, atCaseLimitation: 'Before the target and at its row use the same boundary. Final layout does not prove the native action sequence.',
    baseline: { trackList, sceneSnapshot, slots: baselineSlots, rootEndpoint: endpoint } };
  await writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  try {
    (report.baseline as Wire).comparisons = await originals(id); await save(output, report);
    const original = await find(id); report.creationIntent = { position: original.index + 1, priorIds: baselineTracks.map(track => track.channelId) }; await save(output, report);
    await request('track.create', { position: original.index + 1 });
    await poll(tracks, value => groupCensus(value).length > baselineTracks.length);
    const added = groupCensus(await tracks()).filter(track => !baselineTracks.some(old => old.channelId === track.channelId)); assert.equal(added.length, 1);
    report.ownedTrackId = added[0]!.channelId; await save(output, report); await request('track.setName', { trackIndex: added[0]!.index, name: report.ownedTrackName });
    await poll(tracks, value => groupCensus(value).find(track => track.channelId === report.ownedTrackId)?.name === report.ownedTrackName);
    const freshTracks = await tracks(); verifySceneTrackExtension(trackList, freshTracks, id, String(report.ownedTrackId), String(report.ownedTrackName));
    verifySceneSlotLayout(await slots(groupCensus(freshTracks), 8), groupCensus(freshTracks).map(track => track.channelId), undefined, undefined, id, 8);
    report.appendIntent = { firstRow: 8, count: 3 }; await save(output, report); await request('scene.create', { count: 3 });
    await poll(scenes, value => sceneRows(value).length === 11);
    for (const [offset, name] of names.entries()) { assert.deepEqual(sceneRows(await scenes()).slice(0, 8), sceneRows(sceneSnapshot)); await rename(8 + offset, name); }
    verifyOwnedSceneTail(sceneSnapshot, await scenes(), names); const child = await find(String(report.ownedTrackId));
    const preparedTracks = await tracks(), preparedGroups = verifyTrackGroups(await shadow('trackGroups'), preparedTracks); assert.equal(preparedGroups.find(row => row.channelId === child.channelId)!.isGroup, false);
    await request('clip.create', { trackIndex: child.index, slotIndex: 9, lengthBeats: 4 });
    await poll(() => request('slot.status', { trackIndex: child.index, slotIndex: 9 }), value => value.hasContent === true);
    const cursor = 'fine'; await request('cursor.pin', { cursor, pinned: false }); await request('cursor.pinTrack', { cursor, pinned: false });
    await request('cursor.pointTrack', { cursor, trackIndex: child.index }); await request('slot.select', { trackIndex: child.index, slotIndex: 9, mechanism: 'track' });
    await poll(() => request('cursor.status', { cursor }), value => value.slotExists === true && value.sceneIndex === 9 && value.trackPosition === child.index);
    await request('cursor.pinTrack', { cursor, pinned: true }); await request('cursor.pin', { cursor, pinned: true });
    await request('cursor.setStepSize', { cursor, stepSize: 1 / 512 }); await request('cursor.scrollToStep', { cursor, step: 0 });
    const clipName = `${prefix}-clip`; await request('cursor.setClipMetadata', { cursor, name: clipName });
    await request('cursor.setNotes', { cursor, channel: 0, notes: [[0, 67, 91, 5 / 512]] });
    await poll(() => request('cursor.getNotesVerboseAllChannels', { cursor, maxX: 2048 }), uiSceneSeedSettled);
    await inventory(); await bind(child.channelId, 9, id); const fullComparison = await comparison();
    const target: Target = { id: child.channelId, row: 9, name: clipName, notes: (fullComparison.diagnosticSnapshot as ShadowCacheWireSnapshot).notes }; checkStructureComparison(fullComparison, target);
    let active = await shadow('compareStart', { index: 0 }); active = await poll(async () => {
      if (active.comparison === 'pending' && Number(active.scanProgressCoordinates ?? 0) === 0) active = await shadow('comparePoll'); return active;
    }, value => value.comparison !== 'pending' || Number(value.scanProgressCoordinates ?? 0) > 0); assert.equal(active.comparison, 'pending');
    const preparedSlots = await slots(groupCensus(preparedTracks), 11); verifySceneSlotLayout(preparedSlots, groupCensus(preparedTracks).map(track => track.channelId), child.channelId, 9, id, 11);
    report.prepare = { trackList: preparedTracks, sceneSnapshot: await scenes(), target, fullComparison, active, info: await shadow('info'), slots: preparedSlots };
    report.stage = 'prepared'; await save(output, report);
    console.log(`Select only scene ${names[0]} (row index 8). Use native Add Scene once. It adds row 9 before ${names[1]}. Leave the new scene in place. Then run finish-insert --direct-insertion-confirmed. Use finish-add-move only after Add then Move.`);
  } catch (error) { report.error = String(error); await save(output, report); throw error; }
}
async function finishInsert(output: string, provenance: Wire): Promise<void> {
  const report = JSON.parse(await readFile(output, 'utf8')) as Wire; assert.equal(report.stage, 'prepared'); const inserted: Wire = {}; report.inserted = inserted; report.actionProvenance = provenance;
  report.atCaseLimitation = 'Before the target and at its row use the same boundary. Final layout does not prove the native action sequence.';
  try {
    inserted.root = await shadow('rootSnapshot'); inserted.info = await shadow('info'); inserted.read = await shadow('read', { index: 0 });
    inserted.poll = await shadow('comparePoll'); inserted.status = await shadow('status', { index: 0 }); inserted.beforeRename = await scenes();
    verifyNativeSceneInsertion((report.baseline as Wire).sceneSnapshot as Wire, inserted.beforeRename as Wire, report.ownedSceneNames as string[]);
    const trackList = await guardTracks(report); inserted.slots = await slots(groupCensus(trackList), 12);
    verifySceneSlotLayout(inserted.slots as Wire[], groupCensus(trackList).map(track => track.channelId), String(report.ownedTrackId), 10, String(report.originalTrackId), 12);
    const fence = automaticStructureFence((report.prepare as Wire).info as Wire, inserted.info as Wire, inserted.status as Wire, inserted.read as Wire);
    const cancelled = groupCancellationObserved(inserted.poll as Wire); inserted.aggregateMutationFence = fence;
    Object.assign(report, actionEvidence(provenance, fence, cancelled));
    if (provenance.kind === 'declared-direct-insertion') { inserted.automaticFence = fence; inserted.staleComparisonCancelled = cancelled; }
    await rename(9, String(report.insertedSceneName)); inserted.afterRename = await scenes();
    await shadow('invalidate', { reason: 'owned native scene insertion recovery' }); await inventory('rebuild');
    const target = (report.prepare as Wire).target as unknown as Target; await bind(target.id, 10, String(report.originalTrackId)); inserted.recoveryComparison = await comparison();
    checkStructureComparison(inserted.recoveryComparison as Wire, { ...target, row: 10 }); report.stage = 'insert-recorded'; await save(output, report);
    console.log(`Retained ${provenance.kind} and a fresh row-10 comparison. Run cleanup to remove only the named owned tail and its track.`);
  } catch (error) { report.error = String(error); await save(output, report); throw error; }
}
async function cleanup(output: string): Promise<void> {
  const report = JSON.parse(await readFile(output, 'utf8')) as Wire; assert.equal(report.stage, 'insert-recorded'); const baseline = report.baseline as Wire;
  const names = report.ownedSceneNames as string[], tail = [names[0]!, String(report.insertedSceneName), names[1]!, names[2]!], childId = String(report.ownedTrackId), id = String(report.originalTrackId);
  try {
    const trackList = await guardTracks(report), current = await scenes(); verifyOwnedSceneTail(baseline.sceneSnapshot as Wire, current, tail);
    const groups = verifyTrackGroups(await shadow('trackGroups'), trackList), child = await find(childId); assert.equal(child.name, report.ownedTrackName);
    assert.equal(groups.find(row => row.channelId === childId)!.isGroup, false);
    verifySceneSlotLayout(await slots(groupCensus(trackList), 12), groupCensus(trackList).map(track => track.channelId), childId, 10, id, 12);
    report.cleanup = { beforeSceneSnapshot: current, deletions: [] }; await save(output, report);
    await request('slot.delete', { trackIndex: child.index, slotIndex: 10 }); await poll(() => request('slot.status', { trackIndex: child.index, slotIndex: 10 }), value => value.hasContent === false);
    while (tail.length) {
      const sceneSnapshot = await scenes(); verifyOwnedSceneTail(baseline.sceneSnapshot as Wire, sceneSnapshot, tail); await guardTracks(report);
      verifySceneSlotLayout(await slots(groupCensus(trackList), 8 + tail.length), groupCensus(trackList).map(track => track.channelId), undefined, undefined, id, 8 + tail.length);
      const index = 8 + tail.length - 1; ((report.cleanup as Wire).deletions as Wire[]).push({ index, name: tail.at(-1), sceneSnapshot }); await save(output, report);
      await request('scene.delete', { sceneIndex: index }); tail.pop(); await poll(scenes, value => sceneRows(value).length === 8 + tail.length);
    }
    await guardTracks(report); const finalChild = await find(childId); assert.equal(finalChild.name, report.ownedTrackName);
    const finalGroups = verifyTrackGroups(await shadow('trackGroups'), await tracks()); assert.equal(finalGroups.find(row => row.channelId === childId)!.isGroup, false);
    await request('track.delete', { trackIndex: finalChild.index }); await poll(tracks, value => !groupCensus(value).some(track => track.channelId === childId));
    const finalTracks = await tracks(), after: Wire = { trackList: finalTracks, sceneSnapshot: await scenes(), slots: await slots(groupCensus(finalTracks), 8), rootEndpoint: identityEndpoint(await shadow('rootSnapshot'), id) };
    assert.deepEqual(groupCensus(finalTracks), groupCensus(baseline.trackList as Wire)); after.comparisons = await originals(id, baseline.comparisons as Wire[]); report.after = after;
    await shadow('retire', { index: 0 }); await shadow('retire', { index: 1 }); await shadow('exactCancel', { reason: 'ui-scene-ended' });
    report.stage = 'finished'; report.fixtureRestored = true; report.temporaryFixturesRemoved = true; report.ended = new Date().toISOString(); await save(output, report);
    console.log(JSON.stringify(verifySceneReport(report)));
  } catch (error) { report.cleanupError = String(error); await save(output, report); throw error; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void (async () => {
    const mode = process.argv[2];
    if (mode === 'finish-insert' || mode === 'finish-add-move') {
      const options = parseSceneFinishArguments(mode, process.argv.slice(3));
      await finishInsert(options.output, options.provenance); return;
    }
    const output = process.argv[3] ?? UI_SCENE_OUTPUT;
    if (mode === 'prepare') await prepare(output);
    else if (mode === 'cleanup') await cleanup(output);
    else { assert.equal(mode, 'verify'); console.log(JSON.stringify(verifySceneReport(JSON.parse(await readFile(output, 'utf8')) as Wire))); }
  })().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => bridge.disconnect());
}
