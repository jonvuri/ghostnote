/** Retain one native UI velocity edit and a separate reacquisition observation. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { BridgeClient } from '../client.js';
import { identityEndpoint } from './phase8g-identity-fence.js';
import { checkExpectedFixture } from './phase8g-lifecycle-reuse.js';
import { MUTATION_MARKER, checkMutationComparison, collectMutationRegistry } from './phase8g-shadow-mutations.js';
import { checkStructureComparison } from './phase8g-shadow-structure.js';
import { groupCensus, verifyTrackGroups } from './phase8g-ui-group-controls.js';
import { sceneRows, verifySceneTrackExtension, verifySceneSlotLayout } from './phase8g-ui-scene-controls.js';
import type { ShadowCacheWireSnapshot, ShadowNote } from './phase8g-shadow-cache-lib.js';
type Wire = Record<string, unknown>;
interface Track { index: number; channelId: string; name: string; position: number; type: string }
interface Target { id: string; row: number; name: string; notes: readonly ShadowNote[] }
export const UI_NOTE_OUTPUT = '/tmp/ghostnote-8g-ui-note-v5-results.json';
export const UI_NOTE_VELOCITY = .5;
export const UI_NOTE_METHODS = ['cache.shadow', 'rig.methods', 'track.list', 'track.create', 'track.setName', 'track.delete',
  'clip.create', 'slot.status', 'slot.select', 'slot.delete', 'cursor.pin', 'cursor.pinTrack', 'cursor.pointTrack', 'cursor.status',
  'cursor.setStepSize', 'cursor.scrollToStep', 'cursor.setClipMetadata', 'cursor.setNotes', 'cursor.getNotesVerboseAllChannels'] as const;
export function verifyUiNoteMethods(value: Wire): void {
  assert.equal(value.runtimeProfile, 'phase-8-probe-v1'); assert(Array.isArray(value.methods));
  assert.deepEqual(UI_NOTE_METHODS.filter(method => !(value.methods as string[]).includes(method)), []);
}
/** The target changes velocity only. Every other acquired field stays in the oracle. */
export function uiVelocityTarget(target: Target): Target {
  assert.equal(target.row, 0); assert.equal(target.notes.length, 1); const note = target.notes[0]!;
  assert.deepEqual([note.channel, note.cell, note.pitch, note.fields.durationCells], [0, 0, 60, 8]);
  assert(Math.abs(Number(note.fields.velocity) - 80 / 127) < 1e-6); assert.equal(note.fields.pressure, 0);
  return { ...target, notes: [{ ...structuredClone(note), fields: { ...note.fields, velocity: UI_NOTE_VELOCITY } }] };
}
export function uiNoteClosed(value: Wire): void {
  assert.equal(value.complete, false); assert.equal(value.eligible, false);
}
export function uiNoteSeedSettled(value: Wire): boolean {
  if (!Array.isArray(value.channels) || value.channels.length !== 16 || value.count !== 1) return false;
  const channels = value.channels as Wire[];
  if (new Set(channels.map(channel => channel.channel)).size !== 16
    || channels.some(channel => !Number.isInteger(channel.channel) || Number(channel.channel) < 0 || Number(channel.channel) > 15 || !Array.isArray(channel.notes))) return false;
  const notes: Wire[] = channels.flatMap(channel => (channel.notes as Wire[]).map(note => ({ ...note, sourceChannel: channel.channel })));
  if (notes.length !== 1) return false; const note = notes[0]!;
  return note.sourceChannel === 0 && note.x === 0 && note.y === 60
    && Math.abs(Number(note.velocity) - 80 / 127) < 1e-6 && note.duration === 8 / 512;
}
export function uiWarmOracleFailure(value: Wire, target: Target): string | undefined {
  try {
    assert(value && typeof value === 'object' && !Array.isArray(value), 'warm comparison must be an object');
    uiNoteClosed(value);
    assert.equal(typeof value.comparison, 'string', 'warm comparison label is missing or malformed');
    if (String(value.comparison).includes('mismatch')) return `warm comparison reported ${value.comparison}`;
    if (value.comparison === 'match') checkStructureComparison(value, target);
    else {
      assert(UI_NOTE_WARM_REFUSALS.includes(value.comparison as typeof UI_NOTE_WARM_REFUSALS[number]), 'unsupported warm comparison');
      assert.equal(value.terminal, true); assert.equal(value.reason, value.comparison);
      assert.equal(value.readMode, 'refuse'); assert.equal(value.authorityAvailable, false); assert.equal(value.fallbackPerformed, false);
      assert(value.contentComparisonComplete === undefined || value.contentComparisonComplete === false);
      for (const field of ['diagnosticSnapshot', 'authorityNotes', 'historicalSnapshot', 'authoritativeSnapshot', 'authorityMetadata', 'authorityCoverage'])
        assert.equal(value[field], undefined, `warm refusal contains ${field}`);
    }
  } catch (error) { return `warm outcome failed edited-field oracle or refusal validation: ${String(error)}`; }
  return undefined;
}
/** These labels end a current scan without acquired output. */
export const UI_NOTE_WARM_REFUSALS = ['window-changed', 'authority-scan-budget', 'authority-binding-unavailable',
  'authority-binding-budget', 'authority-replay-budget', 'authority-binding-changed', 'authority-staging-memory-budget',
  'authority-unavailable', 'authority-host-work-budget', 'authority-control-unavailable'] as const;
export function verifyUiNoteCleanup(baseline: Wire, current: Wire, groups: Wire, slots: Wire[], originalId: string,
                                    childId: string, name: string, hasContent: boolean): void {
  verifySceneTrackExtension(baseline, current, originalId, childId, name);
  const flags = verifyTrackGroups(groups, current); assert.equal(flags.find(row => row.channelId === childId)!.isGroup, false);
  verifySceneSlotLayout(slots, groupCensus(current).map(track => track.channelId), hasContent ? childId : undefined,
    hasContent ? 0 : undefined, originalId, 8);
}
/** A historical comparison label does not describe a current refused read. */
export function summarizeUiNoteFences(raw: Wire): Wire {
  const read = raw.read as Wire, poll = raw.comparePoll as Wire, exact = raw.exactPoll as Wire, status = raw.status as Wire;
  for (const value of [read, poll, exact, status]) uiNoteClosed(value);
  const cacheOutputAbsent = !read.diagnosticSnapshot && !read.authorityNotes && !read.historicalSnapshot && !read.authoritativeSnapshot;
  return { cacheReadMode: read.readMode ?? null, cacheReadReason: read.reason ?? null, cacheReadComparisonLabel: read.comparison ?? null,
    cacheCurrentOutputAbsent: cacheOutputAbsent, historicalComparisonLabel: poll.comparison ?? null,
    exactTerminal: exact.terminal === true, exactPhase: exact.phase ?? null, exactReason: exact.reason ?? null,
    exactOutputAbsent: !exact.authorityNotes && !exact.diagnosticSnapshot && !exact.historicalSnapshot && !exact.authoritativeSnapshot,
    exactTerminalRefusalObserved: exact.terminal === true && exact.phase === 'refused' && !exact.authorityNotes,
    exactWindowChangeRefusalObserved: exact.terminal === true && exact.phase === 'refused' && exact.reason === 'authority-window-changed' && !exact.authorityNotes,
    exactCallbackCancellationProved: false,
    missingEventContinuityProved: false, hostInputOrderingProved: false };
}
export function verifyUiNoteReport(report: Wire): Wire {
  assert.equal(report.marker, MUTATION_MARKER); assert.equal(report.researchOnly, true); assert.equal(report.complete, false); assert.equal(report.eligible, false);
  assert.equal(report.stage, 'finished'); assert.equal(report.fixtureRestored, true); assert.equal(report.temporaryFixturesRemoved, true);
  assert.equal(report.uiEditCount, 1); assert.equal(report.reacquisitionObservationCount, 1); assert.equal(report.aggregateAcceptanceCount, undefined);
  assert.equal(report.missingEventContinuityProved, false); assert.equal(report.hostInputOrderingProved, false);
  assert.equal(report.simultaneousAuthorityScansSupported, false); assert(!report.error && !report.cleanupError); assert.equal(typeof report.ended, 'string');
  verifyUiNoteMethods(report.methods as Wire);
  const baseline = report.baseline as Wire, prepared = report.prepare as Wire, finished = report.finish as Wire, after = report.after as Wire;
  const id = String(report.originalTrackId), child = String(report.ownedTrackId), target = prepared.target as unknown as Target;
  assert.equal(target.id, child); assert.equal(target.name, report.ownedClipName); const edited = uiVelocityTarget(target);
  assert.deepEqual(report.expectedEditedTarget, edited); checkStructureComparison(prepared.fullComparison as Wire, target);
  assert.equal((prepared.cacheActive as Wire).comparison, 'pending'); assert(Number((prepared.cacheActive as Wire).scanProgressCoordinates) > 0);
  assert(Number((prepared.cacheActive as Wire).scanProgressCoordinates) < 2048 * 128);
  const busy = prepared.exactWhileComparisonBusy as Wire; assert.equal(busy.terminal, true); assert.equal(busy.phase, 'refused');
  assert.equal(busy.authorityAvailable, false); assert(!busy.authorityNotes && !busy.diagnosticSnapshot); uiNoteClosed(busy);
  const active = prepared.exactActive as Wire; assert.equal(active.terminal, false); assert(Number(active.scannedCoordinates) > 0 && Number(active.scannedCoordinates) < 2048 * 128);
  const baselineTracks = groupCensus(baseline.trackList as Wire), ready = groupCensus(prepared.trackList as Wire);
  verifySceneTrackExtension(baseline.trackList as Wire, prepared.trackList as Wire, id, child, String(report.ownedTrackName));
  assert.deepEqual(sceneRows(prepared.sceneSnapshot as Wire), sceneRows(baseline.sceneSnapshot as Wire));
  verifySceneSlotLayout(prepared.slots as Wire[], ready.map(track => track.channelId), child, 0, id, 8);
  assert.deepEqual(finished.fences, summarizeUiNoteFences(finished.preBarrier as Wire));
  const deliveredDelta = Number(((finished.preBarrier as Wire).status as Wire).callbacks) - Number((prepared.status as Wire).callbacks);
  assert(Number.isSafeInteger(deliveredDelta) && deliveredDelta >= 0); assert.equal(finished.residentDeliveredCallbacksDelta, deliveredDelta);
  const warm = finished.reacquisition as Wire; assert.equal(warm.observationOnly, true); assert.equal(warm.barrierBeforeAttempt, false);
  assert.equal(warm.decision, (warm.acquired as Wire | undefined)?.poolDecision ?? 'request-error');
  if (warm.comparison !== undefined) {
    assert.equal(warm.error, undefined, 'warm comparison conflicts with a request error');
    const failure = uiWarmOracleFailure(warm.comparison as Wire, edited); assert.equal(failure, undefined, failure);
  } else {
    assert.equal(typeof warm.error, 'string', 'warm attempt needs a result or a request error'); assert((warm.error as string).length > 0);
    for (const field of ['diagnosticSnapshot', 'authorityNotes', 'historicalSnapshot', 'authoritativeSnapshot', 'authorityMetadata', 'authorityCoverage']) assert.equal(warm[field], undefined);
  }
  assert.equal(finished.explicitRecoveryBarrier, true); checkStructureComparison(finished.recoveryComparison as Wire, edited);
  verifySceneSlotLayout(report.cleanupSlots as Wire[], ready.map(track => track.channelId), child, 0, id, 8);
  const cleanupFlags = verifyTrackGroups(report.cleanupGroups as Wire, prepared.trackList as Wire); assert.equal(cleanupFlags.find(row => row.channelId === child)!.isGroup, false);
  assert.deepEqual(groupCensus(after.trackList as Wire), baselineTracks); assert.deepEqual(sceneRows(after.sceneSnapshot as Wire), sceneRows(baseline.sceneSnapshot as Wire));
  assert.deepEqual(after.slots, baseline.slots); assert.deepEqual(after.rootEndpoint, baseline.rootEndpoint);
  const originals = baseline.comparisons as Wire[], restored = after.comparisons as Wire[]; assert.equal(originals.length, 3); assert.equal(restored.length, 3);
  for (let row = 0; row < 3; row++) { const notes = (originals[row]!.diagnosticSnapshot as ShadowCacheWireSnapshot).notes;
    assert.deepEqual(checkExpectedFixture(notes, row), []); assert.deepEqual(checkMutationComparison(originals[row]!, row, id, notes), []);
    assert.deepEqual(checkMutationComparison(restored[row]!, row, id, notes), []); assert.deepEqual(restored[row]!.authorityMetadata, originals[row]!.authorityMetadata); }
  return { uiVelocityEdits: 1, reacquisitionObservations: 1, reacquisitionDecision: warm.decision, fences: finished.fences,
    restorationComparisons: 3, missingEventContinuityProved: false, hostInputOrderingProved: false, complete: false, eligible: false };
}
const bridge = new BridgeClient();
async function request<T = Wire>(method: string, params?: Wire): Promise<T> { return await bridge.request(method, params) as T; }
async function shadow(operation: string, params: Wire = {}): Promise<Wire> { return await request('cache.shadow', { operation, ...params }); }
async function poll(read: () => Promise<Wire>, done: (value: Wire) => boolean): Promise<Wire> {
  const started = performance.now(); for (;;) { const value = await read(); if (done(value)) return value;
    assert(performance.now() - started < 45_000, `UI note control expired: ${JSON.stringify(value)}`); await new Promise(resolve => setTimeout(resolve, 75)); }
}
async function tracks(): Promise<Wire> { const value = await request('track.list'); groupCensus(value); return value; }
async function find(id: string): Promise<Track> { const matches = groupCensus(await tracks()).filter(track => track.channelId === id); assert.equal(matches.length, 1); return matches[0]!; }
async function scenes(): Promise<Wire> { const value = await shadow('sceneSnapshot'); sceneRows(value); return value; }
async function slots(values: Track[]): Promise<Wire[]> { const result: Wire[] = [];
  for (const track of values) for (let row = 0; row < 8; row++) { const value = await request('slot.status', { trackIndex: track.index, slotIndex: row });
    result.push({ id: track.channelId, row, exists: value.exists, hasContent: value.hasContent }); } return result; }
async function inventory(operation = 'inventory'): Promise<void> { await collectMutationRegistry(await shadow(operation), () => shadow('rebuildPoll')); }
async function point(id: string, row: number, canaryId: string): Promise<void> {
  const track = await find(id), canary = await find(canaryId); await shadow('point', { index: 0, trackIndex: track.index, row, canaryTrackIndex: canary.index, canaryRow: id === canaryId && row === 1 ? 0 : 1 });
  const result = await poll(() => shadow('poll', { index: 0 }), value => value.phase === 'retired' || ((value.phase === 'settled' || value.phase === 'complete') && value.canaryPhase === 'target'));
  assert.notEqual(result.phase, 'retired'); assert.equal(result.canaryVerifiedForBinding, true); await shadow('reconcile', { index: 0 });
}
async function comparison(index = 0): Promise<Wire> { let value = await shadow('compareStart', { index });
  return await poll(async () => { if (value.comparison === 'pending') value = await shadow('comparePoll'); return value; }, value => value.comparison !== 'pending'); }
async function originals(id: string, expected?: Wire[]): Promise<Wire[]> { await inventory(); const result: Wire[] = [];
  for (let row = 0; row < 3; row++) { await point(id, row, id); const value = await comparison();
    const notes = expected ? (expected[row]!.diagnosticSnapshot as ShadowCacheWireSnapshot).notes : (value.diagnosticSnapshot as ShadowCacheWireSnapshot).notes;
    assert.deepEqual(checkExpectedFixture(notes, row), []); assert.deepEqual(checkMutationComparison(value, row, id, notes), []); result.push(value); } return result; }
async function save(output: string, report: Wire): Promise<void> { await writeFile(output, JSON.stringify(report, null, 2) + '\n'); }
async function scopeGuard(report: Wire): Promise<Wire> {
  const current = await tracks(); verifySceneTrackExtension((report.baseline as Wire).trackList as Wire, current, String(report.originalTrackId), String(report.ownedTrackId), String(report.ownedTrackName));
  assert.deepEqual(sceneRows(await scenes()), sceneRows((report.baseline as Wire).sceneSnapshot as Wire));
  assert.deepEqual(identityEndpoint(await shadow('rootSnapshot'), String(report.originalTrackId)), (report.baseline as Wire).rootEndpoint);
  const flags = verifyTrackGroups(await shadow('trackGroups'), current); assert.equal(flags.find(row => row.channelId === report.ownedTrackId)!.isGroup, false); return current;
}
async function pooled(id: string, canaryId: string, retain: Wire): Promise<number> {
  const track = await find(id), canary = await find(canaryId);
  retain.acquired = await shadow('acquire', { trackIndex: track.index, row: 0, canaryTrackIndex: canary.index, canaryRow: 1 });
  const acquired = retain.acquired as Wire; retain.decision = acquired.poolDecision ?? 'request-error'; assert(['warm', 'reserved'].includes(String(retain.decision)), JSON.stringify(acquired));
  const index = Number(acquired.index); assert(index === 0 || index === 1); retain.index = index;
  retain.settled = await poll(() => shadow('poll', { index }), value => value.phase === 'retired' || ((value.phase === 'settled' || value.phase === 'complete') && value.canaryPhase === 'target'));
  assert.notEqual((retain.settled as Wire).phase, 'retired'); await shadow('reconcile', { index }); return index;
}
async function prepare(output: string): Promise<void> {
  const methods = await request('rig.methods'); verifyUiNoteMethods(methods);
  const state = JSON.parse(await readFile('/tmp/ghostnote-8g-research-state.json', 'utf8')) as Wire, witness = JSON.parse(await readFile('/tmp/ghostnote-8g-mutation-witness.json', 'utf8')) as Wire;
  const id = String(state.ownedTrackId); assert.equal(witness.status, 'ready'); assert.equal(witness.ownedTrackId, id);
  const rootEndpoint = identityEndpoint(await shadow('rootSnapshot'), id); assert.deepEqual(rootEndpoint, identityEndpoint((witness.layer as Wire).root as Wire, id, true));
  const trackList = await tracks(), initialTracks = groupCensus(trackList), sceneSnapshot = await scenes();
  assert.deepEqual(initialTracks.map(track => track.channelId).sort(), [...state.baselineIds as string[], id].sort()); assert.equal(sceneRows(sceneSnapshot).length, 8);
  verifyTrackGroups(await shadow('trackGroups'), trackList); const baselineSlots = await slots(initialTracks); verifySceneSlotLayout(baselineSlots, initialTracks.map(track => track.channelId), undefined, undefined, id, 8);
  const prefix = `gn-8g-ui-note-${randomUUID().slice(0, 8)}`;
  const report: Wire = { marker: MUTATION_MARKER, methods, stage: 'preparing', started: new Date().toISOString(), researchOnly: true, complete: false, eligible: false,
    missingEventContinuityProved: false, hostInputOrderingProved: false, simultaneousAuthorityScansSupported: false, originalTrackId: id,
    ownedTrackName: `${prefix}-track`, ownedClipName: `${prefix}-clip`, plannedUiEditCount: 1, uiEditCount: 0, reacquisitionObservationCount: 0,
    baseline: { trackList, sceneSnapshot, slots: baselineSlots, rootEndpoint } };
  await writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  try {
    (report.baseline as Wire).comparisons = await originals(id); await save(output, report);
    const original = await find(id); report.creationIntent = { position: original.index + 1, priorIds: initialTracks.map(track => track.channelId) }; await save(output, report);
    await request('track.create', { position: original.index + 1 }); await poll(tracks, value => groupCensus(value).length > initialTracks.length);
    const added = groupCensus(await tracks()).filter(track => !initialTracks.some(before => before.channelId === track.channelId)); assert.equal(added.length, 1);
    report.ownedTrackId = added[0]!.channelId; await save(output, report); await request('track.setName', { trackIndex: added[0]!.index, name: report.ownedTrackName });
    await poll(tracks, value => groupCensus(value).find(track => track.channelId === report.ownedTrackId)?.name === report.ownedTrackName);
    const current = await scopeGuard(report), child = await find(String(report.ownedTrackId));
    verifySceneSlotLayout(await slots(groupCensus(current)), groupCensus(current).map(track => track.channelId), undefined, undefined, id, 8);
    await request('clip.create', { trackIndex: child.index, slotIndex: 0, lengthBeats: 4 }); await poll(() => request('slot.status', { trackIndex: child.index, slotIndex: 0 }), value => value.hasContent === true);
    const cursor = 'fine'; await request('cursor.pin', { cursor, pinned: false }); await request('cursor.pinTrack', { cursor, pinned: false });
    await request('cursor.pointTrack', { cursor, trackIndex: child.index }); await request('slot.select', { trackIndex: child.index, slotIndex: 0, mechanism: 'track' });
    await poll(() => request('cursor.status', { cursor }), value => value.trackPosition === child.index && value.sceneIndex === 0 && value.slotExists === true);
    await request('cursor.pinTrack', { cursor, pinned: true }); await request('cursor.pin', { cursor, pinned: true });
    await request('cursor.setStepSize', { cursor, stepSize: 1 / 512 }); await request('cursor.scrollToStep', { cursor, step: 0 });
    await request('cursor.setClipMetadata', { cursor, name: report.ownedClipName }); await request('cursor.setNotes', { cursor, channel: 0, notes: [[0, 60, 80, 8 / 512]] });
    await poll(() => request('cursor.getNotesVerboseAllChannels', { cursor, maxX: 2048 }), uiNoteSeedSettled);
    await inventory(); await shadow('retire', { index: 0 }); await shadow('retire', { index: 1 }); const residence: Wire = {};
    const index = await pooled(child.channelId, id, residence), fullComparison = await comparison(index);
    const target: Target = { id: child.channelId, row: 0, name: String(report.ownedClipName), notes: (fullComparison.diagnosticSnapshot as ShadowCacheWireSnapshot).notes };
    uiVelocityTarget(target); checkStructureComparison(fullComparison, target);
    let cacheActive = await shadow('compareStart', { index }); cacheActive = await poll(async () => { if (cacheActive.comparison === 'pending' && Number(cacheActive.scanProgressCoordinates ?? 0) === 0) cacheActive = await shadow('comparePoll'); return cacheActive; },
      value => value.comparison !== 'pending' || Number(value.scanProgressCoordinates ?? 0) > 0); assert.equal(cacheActive.comparison, 'pending');
    const busy = await shadow('exactStart', { trackIndex: child.index, row: 0 }); assert.equal(busy.terminal, true); assert.equal(busy.phase, 'refused');
    let cacheCompleted = cacheActive; cacheCompleted = await poll(async () => { if (cacheCompleted.comparison === 'pending') cacheCompleted = await shadow('comparePoll'); return cacheCompleted; }, value => value.comparison !== 'pending'); checkStructureComparison(cacheCompleted, target);
    let exactActive = await shadow('exactStart', { trackIndex: child.index, row: 0 }); exactActive = await poll(async () => { if (exactActive.terminal !== true && Number(exactActive.scannedCoordinates ?? 0) === 0) exactActive = await shadow('exactPoll'); return exactActive; }, value => value.terminal === true || Number(value.scannedCoordinates ?? 0) > 0);
    assert.equal(exactActive.terminal, false); assert(Number(exactActive.scannedCoordinates) > 0);
    report.prepare = { trackList: current, sceneSnapshot: await scenes(), slots: await slots(groupCensus(current)), residence, index, target, fullComparison,
      cacheActive, cacheCompleted, exactWhileComparisonBusy: busy, exactActive, status: await shadow('status', { index }) };
    report.expectedEditedTarget = uiVelocityTarget(target); report.stage = 'prepared'; await save(output, report);
    console.log(`Open only clip ${report.ownedClipName} on track ${report.ownedTrackName} (${child.channelId}), Launcher row 0. Select its sole channel-1 note, MIDI pitch 60 at beat 0, duration 8/512 beat. Set native Velocity to 50.0% (normalized 0.5). Leave all other fields unchanged. Then run finish.`);
  } catch (error) { report.error = String(error); await save(output, report); throw error; }
}
async function finish(output: string): Promise<void> {
  const report = JSON.parse(await readFile(output, 'utf8')) as Wire; assert.equal(report.stage, 'prepared'); const prepared = report.prepare as Wire, finished: Wire = {}; report.finish = finished;
  const index = Number(prepared.index), child = String(report.ownedTrackId), original = String(report.originalTrackId), edited = report.expectedEditedTarget as unknown as Target;
  try {
    const pre: Wire = { root: await shadow('rootSnapshot'), info: await shadow('info') }; finished.preBarrier = pre;
    pre.read = await shadow('read', { index }); pre.comparePoll = await shadow('comparePoll'); pre.exactPoll = await shadow('exactPoll'); pre.status = await shadow('status', { index });
    finished.fences = summarizeUiNoteFences(pre);
    finished.residentDeliveredCallbacksDelta = Number((pre.status as Wire).callbacks) - Number((prepared.status as Wire).callbacks);
    assert(Number.isSafeInteger(finished.residentDeliveredCallbacksDelta) && Number(finished.residentDeliveredCallbacksDelta) >= 0);
    await save(output, report); await scopeGuard(report);
    await shadow('exactCancel', { reason: 'UI note pre-barrier observation retained' });
    const warm: Wire = { observationOnly: true, barrierBeforeAttempt: false, before: await shadow('status', { index }) }; finished.reacquisition = warm;
    report.reacquisitionObservationCount = 1;
    try { warm.reconcile = await shadow('reconcile', { index }); const warmIndex = await pooled(child, original, warm); warm.comparison = await comparison(warmIndex);
      const oracleFailure = uiWarmOracleFailure(warm.comparison as Wire, edited);
      if (oracleFailure) { warm.oracleFailure = oracleFailure; warm.mismatchIsFatal = true; report.error = oracleFailure; } }
    catch (error) { warm.error = String(error); warm.decision ??= (warm.acquired as Wire | undefined)?.poolDecision ?? 'request-error'; }
    await save(output, report); finished.explicitRecoveryBarrier = true;
    await shadow('invalidate', { reason: 'owned UI velocity edit recovery' }); await inventory('rebuild'); await point(child, 0, original);
    finished.recoveryComparison = await comparison(); await save(output, report); checkStructureComparison(finished.recoveryComparison as Wire, edited);
    report.uiEditCount = 1;
    report.stage = 'edit-recorded'; await save(output, report);
    if (report.error) throw new Error(`Warm mismatch is retained as a failed control: ${report.error}. Run cleanup.`);
    console.log(JSON.stringify({ uiVelocityEdits: 1, reacquisitionDecision: warm.decision, fences: finished.fences, recoveryComparison: 'match' }));
    console.log('Run cleanup to remove only this owned clip and track and check the original three clips.');
  } catch (error) { report.error = String(error); await save(output, report); throw error; }
}
async function cleanup(output: string): Promise<void> {
  const report = JSON.parse(await readFile(output, 'utf8')) as Wire;
  assert(['preparing', 'prepared', 'edit-recorded'].includes(String(report.stage)) && typeof report.ownedTrackId === 'string');
  const baseline = report.baseline as Wire, id = String(report.originalTrackId), childId = String(report.ownedTrackId);
  assert.equal((baseline.comparisons as Wire[]).length, 3, 'original oracle must exist before guarded cleanup');
  try {
    const current = await scopeGuard(report), child = await find(childId); report.cleanupGroups = await shadow('trackGroups'); verifyTrackGroups(report.cleanupGroups as Wire, current);
    report.cleanupSlots = await slots(groupCensus(current));
    report.cleanupTargetHadContent = (report.cleanupSlots as Wire[]).find(slot => slot.id === childId && slot.row === 0)!.hasContent;
    verifyUiNoteCleanup(baseline.trackList as Wire, current, report.cleanupGroups as Wire, report.cleanupSlots as Wire[], id, childId,
      String(report.ownedTrackName), report.cleanupTargetHadContent === true); await save(output, report);
    await shadow('exactCancel', { reason: 'owned UI note cleanup' }); await shadow('retire', { index: 0 }); await shadow('retire', { index: 1 });
    if (report.cleanupTargetHadContent === true) { await request('slot.delete', { trackIndex: child.index, slotIndex: 0 });
      await poll(() => request('slot.status', { trackIndex: child.index, slotIndex: 0 }), value => value.hasContent === false); }
    const beforeDelete = await scopeGuard(report); verifySceneSlotLayout(await slots(groupCensus(beforeDelete)), groupCensus(beforeDelete).map(track => track.channelId), undefined, undefined, id, 8);
    const empty = await find(childId); assert.equal(empty.name, report.ownedTrackName); await request('track.delete', { trackIndex: empty.index }); await poll(tracks, value => !groupCensus(value).some(track => track.channelId === childId));
    const after: Wire = { trackList: await tracks(), sceneSnapshot: await scenes(), rootEndpoint: identityEndpoint(await shadow('rootSnapshot'), id) }; after.slots = await slots(groupCensus(after.trackList as Wire));
    assert.deepEqual(groupCensus(after.trackList as Wire), groupCensus(baseline.trackList as Wire)); after.comparisons = await originals(id, baseline.comparisons as Wire[]); report.after = after;
    await shadow('retire', { index: 0 }); await shadow('retire', { index: 1 });
    report.fixtureRestored = true; report.temporaryFixturesRemoved = true; report.stage = 'finished'; report.ended = new Date().toISOString();
    report.controlOutcome = report.error || !report.finish ? 'failed-or-unfinished' : 'guarded-ui-edit-pass'; await save(output, report);
    if (report.error || !report.finish) console.log(JSON.stringify({ fixtureRestored: true, controlOutcome: 'failed-or-unfinished', retainedError: report.error ?? null }));
    else console.log(JSON.stringify(verifyUiNoteReport(report)));
  } catch (error) { report.cleanupError = String(error); await save(output, report); throw error; }
  if (report.error) throw new Error(`UI note control failed; guarded cleanup passed: ${report.error}`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mode = process.argv[2], output = process.argv[3] ?? UI_NOTE_OUTPUT;
  void (mode === 'prepare' ? prepare(output) : mode === 'finish' ? finish(output) : mode === 'cleanup' ? cleanup(output)
    : (assert.equal(mode, 'verify'), readFile(output, 'utf8').then(value => console.log(JSON.stringify(verifyUiNoteReport(JSON.parse(value) as Wire))))))
    .catch(error => { console.error(error); process.exitCode = 1; }).finally(() => bridge.disconnect());
}
