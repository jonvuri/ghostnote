// 8h3e removed the research wire or rig configuration that this live driver uses. Live use needs the
// earlier research build of its own session. Its retained artifacts and offline checks do not need a host.
/** Retain native UI group controls. Delete only the ungrouped owned empty track. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { BridgeClient } from '../client.js';
import { identityEndpoint } from './phase8g-identity-fence.js';
import { checkExpectedFixture } from './phase8g-lifecycle-reuse.js';
import { MUTATION_MARKER, checkMutationComparison, collectMutationRegistry } from './phase8g-shadow-mutations.js';
import { automaticStructureFence } from './phase8g-shadow-structure.js';
import type { ShadowCacheWireSnapshot } from './phase8g-shadow-cache-lib.js';

type Wire = Record<string, unknown>;
interface Track { index: number; channelId: string; name: string; position: number; type: string }
export const UI_GROUP_NAME = 'gn-8g-ui-group';
export const UI_GROUP_OUTPUT = '/tmp/ghostnote-8g-ui-group-v5-results.json';
export const GROUP_CONTROL_REVISION = '8g-group-controls-v1';
export const GROUP_REQUIRED_METHODS = ['cache.shadow', 'rig.methods', 'rig.scanTracks', 'track.list', 'track.create',
  'track.setName', 'track.delete', 'scene.count', 'slot.status'] as const;
export function verifyGroupMethods(value: Wire): void {
  assert.equal(value.runtimeProfile, 'phase-8-probe-v1'); assert(Array.isArray(value.methods));
  assert.deepEqual(GROUP_REQUIRED_METHODS.filter(method => !(value.methods as string[]).includes(method)), []);
}
export function verifyTrackGroups(value: Wire, census: Wire): Wire[] {
  assert.equal(value.groupControlRevision, GROUP_CONTROL_REVISION); assert.equal(value.coherent, true); assert.equal(value.fullWindow, true);
  assert.equal(value.researchOnly, true); assert.equal(value.groupMembershipProved, false); assert.equal(value.hostInputOrderingProved, false);
  const tracks = groupCensus(census); assert.equal(value.totalCount, tracks.length); assert(Array.isArray(value.tracks));
  const rows = value.tracks as Wire[]; assert.equal(rows.length, tracks.length);
  for (const [index, track] of tracks.entries()) { const row = rows[index]!;
    assert.equal(row.index, track.index); assert.equal(row.channelId, track.channelId); assert.equal(row.name, track.name);
    assert.equal(typeof row.isGroup, 'boolean'); assert.equal(typeof row.isGroupExpanded, 'boolean'); assert(!row.readError);
  }
  return rows;
}
const bridge = new BridgeClient();
const pause = async (): Promise<void> => await new Promise(resolve => setTimeout(resolve, 75));
async function request<T = Wire>(method: string, params?: Wire): Promise<T> { return await bridge.request(method, params) as T; }
async function shadow(operation: string, params: Wire = {}): Promise<Wire> { return await request('cache.shadow', { operation, ...params }); }
async function poll(read: () => Promise<Wire>, done: (value: Wire) => boolean): Promise<Wire> {
  const started = performance.now(); for (;;) { const value = await read(); if (done(value)) return value;
    assert(performance.now() - started < 45_000, `group control expired: ${JSON.stringify(value)}`); await pause(); }
}
export function groupCensus(value: Wire): Track[] {
  assert(Array.isArray(value.tracks)); const tracks = value.tracks as Track[];
  assert.equal(value.count, tracks.length); assert.equal(value.itemCount, tracks.length);
  assert(Number(value.itemCount) <= Number(value.bankSize)); assert.equal(new Set(tracks.map(track => track.channelId)).size, tracks.length);
  for (const [index, track] of tracks.entries()) { assert.equal(track.index, index); assert.match(track.channelId, /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i); }
  return tracks;
}
const ids = (tracks: Track[]): string[] => tracks.map(track => track.channelId);
/** A flat census cannot prove a group's descendants. Keep wrapper deletion unavailable. */
export function summarizeGroupTopology(before: Wire, after: Wire, ownedId: string, mixers: Wire[]): Wire {
  const prior = groupCensus(before), current = groupCensus(after), added = current.filter(track => !ids(prior).includes(track.channelId));
  const missing = prior.filter(track => !ids(current).includes(track.channelId)).map(track => track.channelId);
  const groups = mixers.filter(value => value.isGroup === true).map(value => value.channelId);
  return { addedIds: ids(added), missingIds: missing, ownedChildVisible: ids(current).includes(ownedId),
    newGroupIds: ids(added).filter(id => groups.includes(id)), groupMembershipProved: false,
    baselineDescendantsExcluded: false, wrapperDeletionAllowed: false, requiresNativeUngroup: true };
}
/** Require the exact prepared census and a non-group empty child before deletion. */
export function verifyUngroupedCleanup(prepared: Wire, current: Wire, ownedId: string, mixer: Wire, slots: Wire[]): void {
  assert.deepEqual(groupCensus(current), groupCensus(prepared), 'native Ungroup must restore the exact prepared census');
  const matches = groupCensus(current).filter(track => track.channelId === ownedId); assert.equal(matches.length, 1);
  assert.equal(matches[0]!.name, UI_GROUP_NAME); assert.equal(mixer.channelId, ownedId); assert.equal(mixer.name, UI_GROUP_NAME);
  assert.equal(mixer.isGroup, false, 'never delete a group wrapper'); assert.equal(slots.length, 8);
  assert.deepEqual(slots.map(value => value.row), [0, 1, 2, 3, 4, 5, 6, 7]);
  for (const slot of slots) { assert.equal(slot.id, ownedId); assert.equal(slot.hasContent, false); }
}
export function groupCancellationObserved(poll: Wire): boolean {
  assert.equal(poll.complete, false); assert.equal(poll.eligible, false);
  return poll.comparison !== 'pending' && poll.comparison !== 'match' && poll.authorityAvailable !== true
    && !poll.diagnosticSnapshot && !poll.authorityNotes && !poll.historicalSnapshot && !poll.authoritativeSnapshot;
}
/** Recover only the child from a failed prepare with no native Group action. */
export function verifyAbortedChild(source: Wire, current: Wire, groups: Wire, childSlots: Wire[]): void {
  assert.equal(source.stage, 'preparing'); assert.equal(source.error, 'BridgeError: Method not found: branch.mixer');
  assert(!source.prepare && !source.grouped, 'the failed prepare must precede the UI group control');
  const baseline = groupCensus((source.baseline as Wire).trackList as Wire), now = groupCensus(current);
  const childId = String(source.ownedTrackId), intent = source.creationIntent as Wire;
  assert.deepEqual(intent.priorIds, ids(baseline)); assert.equal(intent.name, UI_GROUP_NAME);
  const position = Number(intent.position); assert(Number.isInteger(position) && position > 0 && position <= baseline.length);
  assert.equal(baseline[position - 1]!.channelId, source.originalTrackId);
  const child = now.find(track => track.channelId === childId); assert(child && child.type === 'Instrument');
  const expected = [...baseline.slice(0, position), { ...child, index: position, position, name: UI_GROUP_NAME }, ...baseline.slice(position)]
    .map((track, index) => ({ ...track, index, position: index }));
  assert.deepEqual(now, expected, 'failed prepare must contain exactly one added plain child');
  const flags = verifyTrackGroups(groups, current).find(row => row.channelId === childId)!;
  verifyUngroupedCleanup(current, current, childId, flags, childSlots);
}
export function verifyGroupReport(report: Wire): Wire {
  assert.equal(report.marker, MUTATION_MARKER); assert.equal(report.researchOnly, true); assert.equal(report.complete, false); assert.equal(report.eligible, false);
  assert.equal(report.stage, 'finished'); assert.equal(report.fixtureRestored, true); assert.equal(report.temporaryFixturesRemoved, true);
  assert.equal(report.wrapperDeleted, false); assert.equal(report.groupMembershipProved, false); assert.equal(report.nativeUngroupConfirmed, true);
  assert.equal(typeof report.ended, 'string'); assert(!report.error && !report.cleanupError);
  const baseline = report.baseline as Wire, prepared = report.prepare as Wire, grouped = report.grouped as Wire, after = report.after as Wire;
  verifyGroupMethods(report.methods as Wire); verifyTrackGroups(baseline.trackGroups as Wire, baseline.trackList as Wire);
  verifyTrackGroups(prepared.trackGroups as Wire, prepared.trackList as Wire);
  assert.deepEqual(grouped.mixers, verifyTrackGroups(grouped.trackGroups as Wire, grouped.trackList as Wire));
  verifyTrackGroups(report.cleanupTrackGroups as Wire, report.cleanupTrackList as Wire);
  const id = String(report.originalTrackId), child = String(report.ownedTrackId), initial = groupCensus(baseline.trackList as Wire);
  assert(!ids(initial).includes(child)); assert.equal(initial.find(track => track.channelId === id)?.name, 'gn-8g-reuse');
  const ready = groupCensus(prepared.trackList as Wire), originalIndex = initial.findIndex(track => track.channelId === id);
  assert.deepEqual(ids(ready), [...ids(initial).slice(0, originalIndex + 1), child, ...ids(initial).slice(originalIndex + 1)]);
  assert.equal(ready.find(track => track.channelId === child)?.name, UI_GROUP_NAME);
  assert.deepEqual(groupCensus(after.trackList as Wire), initial); assert.equal(baseline.scenes, 8); assert.equal(after.scenes, 8);
  assert.deepEqual(after.slots, baseline.slots); assert.deepEqual(after.rootEndpoint, baseline.rootEndpoint);
  assert.deepEqual(prepared.rootEndpoint, baseline.rootEndpoint);
  assert.deepEqual(grouped.rootEndpoint, baseline.rootEndpoint);
  assert.deepEqual(grouped.topology, summarizeGroupTopology(prepared.trackList as Wire, grouped.trackList as Wire, child, grouped.mixers as Wire[]));
  assert.equal((grouped.topology as Wire).newGroupIds instanceof Array, true); assert.equal(((grouped.topology as Wire).newGroupIds as string[]).length, 1);
  assert.deepEqual(grouped.automaticFence, automaticStructureFence(prepared.info as Wire, grouped.info as Wire, grouped.status as Wire, grouped.read as Wire));
  assert.equal(grouped.staleComparisonCancelled, groupCancellationObserved(grouped.poll as Wire));
  assert.equal(report.uiGroupAutomaticAcceptanceComplete, (grouped.automaticFence as Wire).observed === true && grouped.staleComparisonCancelled === true);
  const active = prepared.active as Wire; assert.equal(active.comparison, 'pending');
  assert(Number(active.scanProgressCoordinates) > 0 && Number(active.scanProgressCoordinates) < Number(active.scanTotalCoordinates));
  assert.equal(active.scanTotalCoordinates, 2048 * 128);
  for (const value of [grouped.info, grouped.status, grouped.read, grouped.poll] as Wire[]) { assert.equal(value.complete, false); assert.equal(value.eligible, false); }
  verifyUngroupedCleanup(prepared.trackList as Wire, report.cleanupTrackList as Wire, child, report.cleanupMixer as Wire, report.cleanupSlots as Wire[]);
  const before = baseline.comparisons as Wire[], restored = after.comparisons as Wire[]; assert.equal(before.length, 3); assert.equal(restored.length, 3);
  assert.deepEqual(checkMutationComparison(prepared.fullComparison as Wire, 0, id,
    (before[0]!.diagnosticSnapshot as ShadowCacheWireSnapshot).notes), []);
  for (let row = 0; row < 3; row++) {
    const expected = (before[row]!.diagnosticSnapshot as ShadowCacheWireSnapshot).notes; assert.deepEqual(checkExpectedFixture(expected, row), []);
    assert.deepEqual(checkMutationComparison(before[row]!, row, id, expected), []);
    assert.deepEqual(checkMutationComparison(restored[row]!, row, id, expected), []);
    assert.deepEqual(restored[row]!.authorityMetadata, before[row]!.authorityMetadata);
  }
  return { automaticFence: grouped.automaticFence, staleComparisonCancelled: grouped.staleComparisonCancelled,
    uiGroupAutomaticAcceptanceComplete: report.uiGroupAutomaticAcceptanceComplete, groupMembershipProved: false,
    wrapperDeleted: false, restorationComparisons: 3, complete: false, eligible: false };
}
async function tracks(): Promise<Wire> { const value = await request('track.list'); groupCensus(value); return value; }
async function find(id: string): Promise<Track> { const matches = groupCensus(await tracks()).filter(track => track.channelId === id); assert.equal(matches.length, 1); return matches[0]!; }
async function scenes(): Promise<number> { return Number((await request('scene.count')).sceneCount); }
async function slots(values: Track[]): Promise<Wire[]> {
  const result: Wire[] = []; for (const track of values) for (let row = 0; row < 8; row++) {
    const value = await request('slot.status', { trackIndex: track.index, slotIndex: row }); result.push({ id: track.channelId, row, exists: value.exists, hasContent: value.hasContent }); }
  return result;
}
async function registry(): Promise<void> { await collectMutationRegistry(await shadow('inventory'), () => shadow('rebuildPoll')); }
async function bind(id: string, row: number): Promise<void> {
  const track = await find(id); await shadow('point', { index: 0, trackIndex: track.index, row, canaryTrackIndex: track.index, canaryRow: row === 1 ? 0 : 1 });
  const result = await poll(() => shadow('poll', { index: 0 }), value => value.phase === 'retired' || ((value.phase === 'settled' || value.phase === 'complete') && value.canaryPhase === 'target'));
  assert.notEqual(result.phase, 'retired'); assert.equal(result.canaryVerifiedForBinding, true); await shadow('reconcile', { index: 0 });
}
async function comparison(): Promise<Wire> {
  let value = await shadow('compareStart', { index: 0 }); return await poll(async () => { if (value.comparison === 'pending') value = await shadow('comparePoll'); return value; }, value => value.comparison !== 'pending');
}
async function originals(id: string, expected?: Wire[]): Promise<Wire[]> {
  await registry(); const result: Wire[] = []; for (let row = 0; row < 3; row++) { await bind(id, row); const value = await comparison();
    const notes = expected ? (expected[row]!.diagnosticSnapshot as ShadowCacheWireSnapshot).notes : (value.diagnosticSnapshot as ShadowCacheWireSnapshot).notes;
    assert.deepEqual(checkExpectedFixture(notes, row), []); assert.deepEqual(checkMutationComparison(value, row, id, notes), []); result.push(value); }
  return result;
}
async function save(output: string, report: Wire): Promise<void> { await writeFile(output, JSON.stringify(report, null, 2) + '\n'); }
async function prepare(output: string): Promise<void> {
  const methods = await request('rig.methods'); verifyGroupMethods(methods);
  const state = JSON.parse(await readFile('/tmp/ghostnote-8g-research-state.json', 'utf8')) as Wire;
  const witness = JSON.parse(await readFile('/tmp/ghostnote-8g-mutation-witness.json', 'utf8')) as Wire;
  const id = String(state.ownedTrackId); assert.equal(witness.status, 'ready'); assert.equal(witness.ownedTrackId, id);
  const root = await shadow('rootSnapshot'), endpoint = identityEndpoint(root, id);
  assert.deepEqual(endpoint, identityEndpoint((witness.layer as Wire).root as Wire, id, true));
  const trackList = await tracks(), trackGroups = await shadow('trackGroups'); verifyTrackGroups(trackGroups, trackList);
  const baselineTracks = groupCensus(trackList); assert.deepEqual(ids(baselineTracks).sort(), [...state.baselineIds as string[], id].sort());
  assert.equal(await scenes(), 8); assert.equal(state.baselineScenes, 8); assert(!baselineTracks.some(track => track.name === UI_GROUP_NAME));
  const original = await find(id); assert.equal(original.name, 'gn-8g-reuse');
  const baselineSlots = await slots(baselineTracks); for (const slot of baselineSlots) assert.equal(slot.hasContent, slot.id === id && Number(slot.row) < 3);
  const initial = await shadow('info'); assert.equal(initial.instrumentationRevision, MUTATION_MARKER);
  const report: Wire = { marker: MUTATION_MARKER, started: new Date().toISOString(), researchOnly: true, complete: false, eligible: false,
    originalTrackId: id, methods, stage: 'preparing', groupMembershipProved: false, wrapperDeleted: false,
    baseline: { trackList, trackGroups, scenes: 8, slots: baselineSlots, rootEndpoint: endpoint } };
  await writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  try {
    (report.baseline as Wire).comparisons = await originals(id); await save(output, report);
    report.creationIntent = { position: original.index + 1, name: UI_GROUP_NAME, priorIds: ids(baselineTracks) }; await save(output, report);
    await request('track.create', { position: original.index + 1 });
    await poll(tracks, value => groupCensus(value).some(track => !ids(baselineTracks).includes(track.channelId)));
    const added = groupCensus(await tracks()).filter(track => !ids(baselineTracks).includes(track.channelId)); assert.equal(added.length, 1);
    report.ownedTrackId = added[0]!.channelId; await save(output, report);
    await request('track.setName', { trackIndex: added[0]!.index, name: UI_GROUP_NAME });
    await poll(tracks, value => groupCensus(value).find(track => track.channelId === report.ownedTrackId)?.name === UI_GROUP_NAME);
    const preparedTracks = await tracks(), child = await find(String(report.ownedTrackId)), childSlots = await slots([child]);
    assert.deepEqual(ids(groupCensus(preparedTracks)), [...ids(baselineTracks).slice(0, original.index + 1), child.channelId,
      ...ids(baselineTracks).slice(original.index + 1)]);
    const preparedGroups = await shadow('trackGroups'), childFlags = verifyTrackGroups(preparedGroups, preparedTracks).find(row => row.channelId === child.channelId)!;
    verifyUngroupedCleanup(preparedTracks, preparedTracks, child.channelId, childFlags, childSlots);
    await registry(); await bind(id, 0); const full = await comparison();
    const expected = (((report.baseline as Wire).comparisons as Wire[])[0]!.diagnosticSnapshot as ShadowCacheWireSnapshot).notes;
    assert.deepEqual(checkMutationComparison(full, 0, id, expected), []);
    let active = await shadow('compareStart', { index: 0 });
    active = await poll(async () => { if (active.comparison === 'pending' && Number(active.scanProgressCoordinates ?? 0) === 0) active = await shadow('comparePoll'); return active; }, value => value.comparison !== 'pending' || Number(value.scanProgressCoordinates ?? 0) > 0);
    assert.equal(active.comparison, 'pending'); assert(Number(active.scanProgressCoordinates) > 0);
    report.prepare = { trackList: preparedTracks, trackGroups: preparedGroups, rootEndpoint: identityEndpoint(await shadow('rootSnapshot'), id), info: await shadow('info'), fullComparison: full, active };
    report.stage = 'prepared'; await save(output, report);
    console.log(`Prepared one empty track: ${UI_GROUP_NAME} (${child.channelId}). Select only this track in the UI and use Group. Then run finish-group.`);
  } catch (error) { report.error = String(error); await save(output, report); throw error; }
}
async function finishGroup(output: string): Promise<void> {
  const report = JSON.parse(await readFile(output, 'utf8')) as Wire; assert.equal(report.stage, 'prepared');
  const grouped: Wire = {}; report.grouped = grouped;
  try {
    grouped.root = await shadow('rootSnapshot'); grouped.info = await shadow('info'); grouped.read = await shadow('read', { index: 0 });
    grouped.poll = await shadow('comparePoll'); grouped.status = await shadow('status', { index: 0 });
    grouped.scan = await request('rig.scanTracks'); grouped.trackList = await tracks(); grouped.trackGroups = await shadow('trackGroups');
    grouped.mixers = verifyTrackGroups(grouped.trackGroups as Wire, grouped.trackList as Wire);
    grouped.rootEndpoint = identityEndpoint(grouped.root as Wire, String(report.originalTrackId));
    assert.deepEqual(grouped.rootEndpoint, (report.baseline as Wire).rootEndpoint);
    grouped.topology = summarizeGroupTopology((report.prepare as Wire).trackList as Wire, grouped.trackList as Wire, String(report.ownedTrackId), grouped.mixers as Wire[]);
    grouped.automaticFence = automaticStructureFence((report.prepare as Wire).info as Wire, grouped.info as Wire, grouped.status as Wire, grouped.read as Wire);
    grouped.staleComparisonCancelled = groupCancellationObserved(grouped.poll as Wire);
    report.uiGroupAutomaticAcceptanceComplete = (grouped.automaticFence as Wire).observed === true && grouped.staleComparisonCancelled === true;
    assert.equal(((grouped.topology as Wire).newGroupIds as string[]).length, 1, 'one native group must be visible');
    assert.equal(await scenes(), 8); report.stage = 'group-recorded'; await save(output, report);
    console.log(JSON.stringify({ automaticFence: grouped.automaticFence, topology: grouped.topology }));
    console.log('Use native UI Ungroup on the new group. Then run finish-cleanup. The helper will not delete the wrapper.');
  } catch (error) { report.observationError = String(error); await save(output, report); throw error; }
}
async function finishCleanup(output: string): Promise<void> {
  const report = JSON.parse(await readFile(output, 'utf8')) as Wire; assert.equal(report.stage, 'group-recorded');
  const id = String(report.originalTrackId), childId = String(report.ownedTrackId), baseline = report.baseline as Wire;
  try {
    assert.deepEqual(identityEndpoint(await shadow('rootSnapshot'), id), baseline.rootEndpoint); assert.equal(await scenes(), 8);
    report.cleanupTrackList = await tracks(); const child = await find(childId); report.cleanupTrackGroups = await shadow('trackGroups');
    report.cleanupMixer = verifyTrackGroups(report.cleanupTrackGroups as Wire, report.cleanupTrackList as Wire).find(row => row.channelId === childId)!;
    report.cleanupSlots = await slots([child]); verifyUngroupedCleanup((report.prepare as Wire).trackList as Wire, report.cleanupTrackList as Wire, childId, report.cleanupMixer as Wire, report.cleanupSlots as Wire[]);
    assert.deepEqual(await slots(groupCensus(report.cleanupTrackList as Wire).filter(track => track.channelId !== childId)), baseline.slots);
    await save(output, report); await request('track.delete', { trackIndex: child.index });
    await poll(tracks, value => !ids(groupCensus(value)).includes(childId)); report.nativeUngroupConfirmed = true;
    const trackList = await tracks(); assert.deepEqual(groupCensus(trackList), groupCensus(baseline.trackList as Wire));
    const after: Wire = { trackList, scenes: await scenes(), slots: await slots(groupCensus(trackList)), rootEndpoint: identityEndpoint(await shadow('rootSnapshot'), id) };
    assert.deepEqual(after.slots, baseline.slots); after.comparisons = await originals(id, baseline.comparisons as Wire[]); report.after = after;
    await shadow('retire', { index: 0 }); await shadow('retire', { index: 1 }); await shadow('exactCancel', { reason: 'ui-group-ended' });
    report.fixtureRestored = true; report.temporaryFixturesRemoved = true; report.stage = 'finished'; report.ended = new Date().toISOString(); await save(output, report);
    console.log(JSON.stringify(verifyGroupReport(report)));
  } catch (error) { report.cleanupError = String(error); await save(output, report); throw error; }
}
async function abortCleanup(input: string): Promise<void> {
  assert(process.argv.includes('--no-group-action-confirmed'), 'confirm that no native Group action occurred');
  const source = JSON.parse(await readFile(input, 'utf8')) as Wire, baseline = source.baseline as Wire;
  const output = `${input}.abort-cleanup.json`, id = String(source.originalTrackId), childId = String(source.ownedTrackId);
  assert.equal(source.marker, MUTATION_MARKER); assert.equal(source.stage, 'preparing');
  assert.equal(source.error, 'BridgeError: Method not found: branch.mixer'); assert(!source.prepare && !source.grouped);
  assert.deepEqual(identityEndpoint(await shadow('rootSnapshot'), id), baseline.rootEndpoint); assert.equal(await scenes(), 8);
  const current = await tracks(), groups = await shadow('trackGroups'); verifyTrackGroups(groups, current);
  const child = groupCensus(current).find(track => track.channelId === childId);
  const report: Wire = { marker: MUTATION_MARKER, researchOnly: true, complete: false, eligible: false, sourcePath: input,
    sourceReport: source, started: new Date().toISOString(), noGroupActionConfirmed: true, wrapperDeleted: false,
    beforeTrackList: current, beforeTrackGroups: groups, ownedTrackId: childId, ownedChildDeleted: false };
  if (child) {
    report.childSlots = await slots([child]); verifyAbortedChild(source, current, groups, report.childSlots as Wire[]);
    assert.deepEqual(await slots(groupCensus(current).filter(track => track.channelId !== childId)), baseline.slots);
  } else assert.deepEqual(groupCensus(current), groupCensus(baseline.trackList as Wire));
  await writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  try {
    if (child) { await request('track.delete', { trackIndex: child.index });
      await poll(tracks, value => !ids(groupCensus(value)).includes(childId)); report.ownedChildDeleted = true; }
    report.afterTrackList = await tracks(); assert.deepEqual(groupCensus(report.afterTrackList as Wire), groupCensus(baseline.trackList as Wire));
    report.afterSlots = await slots(groupCensus(report.afterTrackList as Wire)); assert.deepEqual(report.afterSlots, baseline.slots);
    report.afterComparisons = await originals(id, baseline.comparisons as Wire[]);
    await shadow('retire', { index: 0 }); await shadow('retire', { index: 1 });
    assert.equal(await scenes(), 8); assert.deepEqual(identityEndpoint(await shadow('rootSnapshot'), id), baseline.rootEndpoint);
    report.fixtureRestored = true; report.ended = new Date().toISOString(); await save(output, report);
    console.log(`Failed prepare cleanup retained at ${output}. Original report was not changed.`);
  } catch (error) { report.cleanupError = String(error); await save(output, report); throw error; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mode = process.argv[2], output = process.argv[3] ?? UI_GROUP_OUTPUT;
  void (mode === 'prepare' ? prepare(output) : mode === 'finish-group' ? finishGroup(output) : mode === 'finish-cleanup' ? finishCleanup(output)
    : mode === 'abort-cleanup' ? abortCleanup(output)
    : (assert.equal(mode, 'verify'), readFile(output, 'utf8').then(value => console.log(JSON.stringify(verifyGroupReport(JSON.parse(value) as Wire))))))
    .catch(error => { console.error(error); process.exitCode = 1; }).finally(() => bridge.disconnect());
}
