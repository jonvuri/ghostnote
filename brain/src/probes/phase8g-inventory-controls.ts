// 8h3e removed the research wire or rig configuration that this live driver uses. Live use needs the
// earlier research build of its own session. Its retained artifacts and offline checks do not need a host.
/** Test private inventory cancellation, deadline, and delivered structural events. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { BridgeClient } from '../client.js';
import { identityEndpoint } from './phase8g-identity-fence.js';
import { checkExpectedFixture } from './phase8g-lifecycle-reuse.js';
import { MUTATION_MARKER, checkMutationComparison, collectMutationRegistry, verifyMutationRegistry } from './phase8g-shadow-mutations.js';
import type { ShadowCacheWireSnapshot } from './phase8g-shadow-cache-lib.js';

type Wire = Record<string, unknown>;
interface Track { index: number; position: number; channelId: string; name: string }
export const INVENTORY_OUTPUT = '/tmp/ghostnote-8g-inventory-controls-v5-results.json';
export const INVENTORY_REVISION = '8g-inventory-preparation-v1';
export const INVENTORY_LABELS = ['explicit-cancel', 'total-deadline', 'launcher-content-event'] as const;
const CANCEL_REASON = 'inventory-control-explicit-cancel';
const METHODS = ['cache.shadow', 'rig.methods', 'contract.hello', 'track.list', 'scene.count', 'slot.status', 'clip.create', 'slot.delete', 'ping'];
function object(value: unknown, name: string): Wire {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${name} must be an object`); return value as Wire;
}
function count(value: unknown): number { assert(Number.isSafeInteger(value) && Number(value) >= 0); return Number(value); }
function closed(value: Wire): void { assert.equal(value.complete, false); assert.equal(value.eligible, false); }
export function verifyInventoryMethods(value: Wire): void {
  assert.equal(value.runtimeProfile, 'phase-8-probe-v1'); assert(Array.isArray(value.methods));
  assert.deepEqual(METHODS.filter(method => !(value.methods as string[]).includes(method)), []);
}
export function verifyInventoryStatus(value: Wire): Wire {
  closed(value); assert.equal(value.instrumentationRevision, MUTATION_MARKER);
  assert.equal(value.inventoryControlRevision, INVENTORY_REVISION); assert.equal(value.inventoryControlMaximumBatchCells, 64);
  const state = object(value.inventoryRebuild, 'inventory attempt'); closed(state); assert.equal(state.membershipComplete, false);
  const done = count(state.enumeratedCells), total = count(state.totalCells); assert.equal(total, 40); assert(done <= total);
  assert.equal(typeof state.terminal, 'boolean'); assert.equal(typeof state.registryPublished, 'boolean');
  assert.equal(value.rebuildTerminal, state.terminal); assert.equal(value.registryPublished, state.registryPublished);
  assert.equal(value.inventoryEnumerated, state.registryPublished);
  const token = object(state.token, 'inventory token'); assert(typeof token.initDomain === 'string' && token.initDomain.length > 0);
  for (const field of ['project', 'structure', 'rebuild']) count(token[field]);
  if (!state.registryPublished) { assert.equal(value.inventoryClipEntries, 0); assert.equal(state.fullInventoryEnumerated, false); }
  if (state.phase === 'enumerating') {
    assert.equal(state.terminal, false); assert.equal(state.registryPublished, false); assert.equal(state.explicitRetryAvailable, false);
  }
  if (state.registryPublished) { assert.equal(done, total); assert.equal(state.phase, 'published'); verifyMutationRegistry(value); }
  for (const field of ['elapsedMs', 'lastBatchMs', 'registryMetadataEstimatedBytes'])
    assert(typeof state[field] === 'number' && Number.isFinite(state[field]) && Number(state[field]) >= 0);
  return state;
}
/** Positive private progress cannot publish a registry or resident membership. */
export function verifyInventoryPrivateProgress(begin: Wire, partial: Wire): Wire {
  const initial = verifyInventoryStatus(begin), progress = verifyInventoryStatus(partial);
  assert.equal(initial.phase, 'enumerating'); assert.equal(initial.enumeratedCells, 0);
  assert.equal(progress.phase, 'enumerating'); assert.equal(progress.enumeratedCells, 3);
  assert.deepEqual(progress.token, initial.token); assert.deepEqual(progress.capturedGuard, initial.capturedGuard);
  assert.equal(begin.resident, 0); assert.equal(partial.resident, 0); return progress;
}
/** A terminal attempt cannot retry when the caller only polls it. */
export function verifyInventoryTerminal(partial: Wire, values: unknown, reason: string): Wire {
  assert(Array.isArray(values) && values.length === 2, 'retain two terminal polls');
  const previous = verifyInventoryStatus(partial); let first: Wire | undefined;
  for (const value of values) {
    const state = verifyInventoryStatus(object(value, 'terminal status'));
    assert.equal(state.phase, 'aborted'); assert.equal(state.reason, reason); assert.equal(state.terminal, true);
    assert.equal(state.registryPublished, false); assert.equal(state.explicitRetryAvailable, true);
    assert.equal(state.enumeratedCells, previous.enumeratedCells); assert.deepEqual(state.token, previous.token);
    assert.equal(state.attempt, previous.attempt);
    if (first) for (const field of ['phase', 'reason', 'token', 'attempt', 'enumeratedCells', 'totalCells']) assert.deepEqual(state[field], first[field]);
    else first = state;
    for (const field of ['diagnosticSnapshot', 'authorityNotes', 'historicalSnapshot']) assert.equal((value as Wire)[field], undefined);
  }
  return first!;
}
function verifyRecovery(value: Wire, previous: Wire): void {
  const states = value.statuses as Wire[]; assert(Array.isArray(states) && states.length > 0);
  let progress = 0;
  for (const status of states) { const state = verifyInventoryStatus(status); assert(count(state.enumeratedCells) >= progress); progress = count(state.enumeratedCells); }
  verifyMutationRegistry(object(value.result, 'recovery registry'));
  const token = object(object((value.result as Wire).inventoryRebuild, 'recovery state').token, 'recovery token');
  assert.notDeepEqual(token, previous.token, 'recovery needs a new explicit attempt token');
  assert.equal(token.initDomain, (previous.token as Wire).initDomain); assert(count(token.rebuild) > count((previous.token as Wire).rebuild));
}
export function verifyInventoryReport(report: Wire): number {
  closed(report); assert.equal(report.marker, MUTATION_MARKER); assert.equal(report.researchOnly, true);
  assert.equal(report.inventoryControlRevision, INVENTORY_REVISION); assert.equal(report.identityDetectionProved, false);
  assert.equal(report.hostInputFenceProved, false); assert.equal(report.missingEventContinuityProved, false);
  assert.equal(report.ambiguousMoveContinuityProved, false); assert.equal(report.fixtureRestored, true); assert.equal(report.temporaryClipRemoved, true);
  assert(typeof report.started === 'string' && Number.isFinite(Date.parse(report.started)));
  assert(typeof report.ended === 'string' && Date.parse(report.ended) >= Date.parse(report.started));
  assert.equal(report.error, undefined); assert.equal(report.cleanupError, undefined); assert.equal(report.retirementError, undefined);
  const retired = report.retired as Wire[]; assert(Array.isArray(retired) && retired.length === 2);
  retired.forEach((value, index) => { closed(value); assert.equal(value.phase, 'retired'); assert.equal(value.index, index);
    assert.equal(value.diagnosticSnapshot, undefined); assert.equal(value.historicalSnapshot, undefined); });
  assert.equal(retired[1]!.resident, 0); assert.equal(retired[1]!.physicalPendingHints, 0);
  closed(object(report.exactCancelled, 'final authority cancellation'));
  verifyInventoryMethods(object(report.methods, 'methods'));
  assert.deepEqual(report.finalTracks, report.baselineTracks); assert.equal(report.baselineScenes, 8); assert.equal(report.finalScenes, 8);
  assert.deepEqual(report.finalRootEndpoint, report.initialRootEndpoint); assert.deepEqual(report.slotsAfter, report.slotsBefore);
  assert.deepEqual(report.initialRootEndpoint, report.witnessRootEndpoint);
  const tracks = report.baselineTracks as Track[]; assert(Array.isArray(tracks) && tracks.length === 5);
  assert.equal(new Set(tracks.map(value => value.channelId)).size, 5);
  const owner = String(report.ownedTrackId); assert.equal(tracks.filter(value => value.channelId === owner && value.name === 'gn-8g-reuse').length, 1);
  const endpoint = object(report.initialRootEndpoint, 'root endpoint'); assert(Array.isArray(endpoint.chains) && endpoint.chains.length === 4);
  const slots = report.slotsBefore as Wire[]; assert.equal(slots.length, 40);
  const addresses = tracks.flatMap(track => Array.from({ length: 8 }, (_, row) => `${track.channelId}:${row}`)).sort();
  assert.deepEqual(slots.map(value => `${value.id}:${value.row}`).sort(), addresses);
  for (const slot of slots) assert.equal(slot.hasContent, slot.id === owner && Number(slot.row) < 3);
  const before = report.originalBefore as Wire[], after = report.originalAfter as Wire[]; assert.equal(before.length, 3); assert.equal(after.length, 3);
  const originals = before.map((value, row) => {
    const result = object(value.result, 'baseline comparison'), notes = (result.diagnosticSnapshot as ShadowCacheWireSnapshot).notes;
    assert.equal(value.row, row); assert.deepEqual(checkExpectedFixture(notes, row), []);
    assert.deepEqual(checkMutationComparison(result, row, owner, notes), []); return notes;
  });
  for (let row = 0; row < 3; row++) {
    assert.equal(after[row]!.row, row); const result = object(after[row]!.result, 'restored comparison');
    assert.deepEqual(checkMutationComparison(result, row, owner, originals[row]!), []);
    assert.deepEqual(result.authorityMetadata, (before[row]!.result as Wire).authorityMetadata);
  }
  const cases = report.cases as Wire[]; assert.deepEqual(cases.map(value => value.label), INVENTORY_LABELS);
  for (const arm of cases) {
    const partial = object(arm.partial, 'private progress'), state = verifyInventoryPrivateProgress(object(arm.begin, 'private begin'), partial);
    const reason = arm.label === 'explicit-cancel' ? CANCEL_REASON : arm.label === 'total-deadline' ? 'inventory-rebuild-budget' : 'structural-event-requires-rebind';
    verifyInventoryTerminal(partial, arm.terminalPolls, reason);
    if (arm.label === 'explicit-cancel') assert.deepEqual(arm.action, { operation: 'rebuildCancel', reason: CANCEL_REASON });
    if (arm.label === 'total-deadline') {
      assert(Number.isFinite(arm.waitedMs) && Number(arm.waitedMs) >= 40_500); const beats = arm.heartbeats as Wire[]; assert(beats.length >= 40);
      let elapsed = 0; for (const beat of beats) {
        assert(Number(beat.elapsedMs) >= elapsed); elapsed = Number(beat.elapsedMs); assert(Number.isFinite(beat.pingMs) && Number(beat.pingMs) >= 0);
        const retained = verifyInventoryStatus(object(beat.info, 'deadline heartbeat')); assert.equal(retained.phase, 'enumerating');
        assert.equal(retained.enumeratedCells, 3); assert.deepEqual(retained.token, state.token);
      }
      assert(Number(object((arm.terminalPolls as Wire[])[0]!.inventoryRebuild, 'deadline terminal').elapsedMs) > 40_000);
    }
    if (arm.label === 'launcher-content-event') {
      assert.deepEqual(arm.createdAddress, { trackId: owner, row: 3 }); assert.equal((arm.slotBefore as Wire).hasContent, false);
      assert.equal((arm.slotCreated as Wire).hasContent, true); assert.equal((arm.slotRemoved as Wire).hasContent, false);
      assert.equal(arm.createdClipCount, 1); assert.equal(arm.temporaryClipRemoved, true);
      const created = object(arm.request, 'temporary creation'); const track = tracks.find(value => value.channelId === owner)!;
      assert.deepEqual(created, { trackIndex: track.index, slotIndex: 3, lengthBeats: 4 });
    }
    verifyRecovery(object(arm.recovery, 'explicit recovery'), state);
    const result = object(arm.recoveryComparison, 'recovery comparison');
    const snapshotToken = object(object(result.diagnosticSnapshot, 'recovery snapshot').token, 'recovery snapshot token');
    const registryToken = object(object(object((arm.recovery as Wire).result, 'recovery result').inventoryRebuild, 'recovery registry state').token, 'recovery registry token');
    for (const field of ['initDomain', 'project', 'structure', 'rebuild']) assert.equal(snapshotToken[field], registryToken[field]);
    assert.deepEqual(checkMutationComparison(result, 0, owner, originals[0]!), []);
    assert.deepEqual(result.authorityMetadata, (before[0]!.result as Wire).authorityMetadata);
    assert.equal(arm.outcome, 'terminal-refusal-and-explicit-recovery');
  }
  return cases.length;
}

const bridge = new BridgeClient(); let calls = 0, responseBytes = 0;
const wait = async (ms = 100): Promise<void> => await new Promise(resolve => setTimeout(resolve, ms));
async function request(method: string, params?: Wire): Promise<Wire> {
  const value = await bridge.request(method, params) as Wire; calls++; responseBytes += Buffer.byteLength(JSON.stringify(value)); return value;
}
async function shadow(operation: string, params: Wire = {}): Promise<Wire> { return await request('cache.shadow', { operation, ...params }); }
async function poll(read: () => Promise<Wire>, done: (value: Wire) => boolean): Promise<Wire> {
  const started = performance.now(); for (;;) { const value = await read(); if (done(value)) return value;
    assert(performance.now() - started < 45_000, `inventory operation expired: ${JSON.stringify(value)}`); await wait(); }
}
async function tracks(): Promise<Track[]> { return (await request('track.list')).tracks as Track[]; }
async function scenes(): Promise<number> { return Number((await request('scene.count')).sceneCount); }
async function find(id: string): Promise<Track> { const values = (await tracks()).filter(track => track.channelId === id); assert.equal(values.length, 1); return values[0]!; }
async function slot(id: string, row: number): Promise<Wire> { return await request('slot.status', { trackIndex: (await find(id)).index, slotIndex: row }); }
async function registry(): Promise<Wire> { const statuses: Wire[] = [], result = await collectMutationRegistry(await shadow('rebuild'), () => shadow('rebuildPoll'), statuses);
  return { operation: 'rebuild', statuses, result }; }
async function compare(id: string, row: number): Promise<Wire> {
  const track = await find(id); await shadow('point', { index: 0, trackIndex: track.index, row, canaryTrackIndex: track.index, canaryRow: row === 0 ? 1 : 0 });
  const settled = await poll(() => shadow('poll', { index: 0 }), value => value.phase === 'retired'
    || ((value.phase === 'settled' || value.phase === 'complete') && value.canaryPhase === 'target'));
  assert.notEqual(settled.phase, 'retired'); assert.equal(settled.canaryVerifiedForBinding, true);
  await poll(() => shadow('reconcile', { index: 0 }), value => value.physicalPendingHints === 0 && value.pendingCoordinates === 0);
  let result = await shadow('compareStart', { index: 0 });
  return await poll(async () => { if (result.comparison === 'pending') result = await shadow('comparePoll'); return result; }, value => value.comparison !== 'pending');
}
async function run(output: string): Promise<void> {
  const state = JSON.parse(await readFile('/tmp/ghostnote-8g-research-state.json', 'utf8')) as { ownedTrackId: string; baselineIds: string[]; baselineScenes: number };
  const witness = JSON.parse(await readFile('/tmp/ghostnote-8g-mutation-witness.json', 'utf8')) as Wire;
  assert.equal(witness.status, 'ready'); assert.equal(witness.ownedTrackId, state.ownedTrackId);
  const baselineTracks = await tracks(); assert.equal(baselineTracks.length, 5); assert.equal(await scenes(), 8); assert.equal(state.baselineScenes, 8);
  assert.deepEqual(baselineTracks.map(value => value.channelId).sort(), [...state.baselineIds, state.ownedTrackId].sort());
  assert.deepEqual(baselineTracks, object(object(witness.after, 'witness after').tracks, 'witness tracks').tracks);
  const original = await find(state.ownedTrackId); assert.equal(original.name, 'gn-8g-reuse');
  const initialRootEndpoint = identityEndpoint(await shadow('rootSnapshot'), state.ownedTrackId);
  const witnessRootEndpoint = identityEndpoint(object(object(witness.layer, 'witness layer').root, 'witness root'), state.ownedTrackId, true);
  assert.deepEqual(initialRootEndpoint, witnessRootEndpoint);
  assert.equal((initialRootEndpoint.chains as unknown[]).length, 4);
  const methods = await request('rig.methods'); verifyInventoryMethods(methods);
  const initial = await shadow('info'); assert.equal(initial.instrumentationRevision, MUTATION_MARKER);
  assert.equal(initial.inventoryControlRevision, INVENTORY_REVISION); assert.equal(initial.inventoryControlMaximumBatchCells, 64);
  const report: Wire = { marker: MUTATION_MARKER, inventoryControlRevision: INVENTORY_REVISION, started: new Date().toISOString(),
    researchOnly: true, complete: false, eligible: false, identityDetectionProved: false, hostInputFenceProved: false,
    missingEventContinuityProved: false, ambiguousMoveContinuityProved: false, ownedTrackId: state.ownedTrackId, baselineTracks,
    baselineScenes: 8, initialRootEndpoint, witnessRootEndpoint, methods, hello: await request('contract.hello'), initial, cases: [], originalBefore: [], originalAfter: [] };
  await writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  const save = async (): Promise<void> => { report.calls = calls; report.responseBytes = responseBytes; await writeFile(output, JSON.stringify(report, null, 2) + '\n'); };
  const guard = async (): Promise<void> => { assert.deepEqual(await tracks(), baselineTracks); assert.equal(await scenes(), 8);
    assert.deepEqual(identityEndpoint(await shadow('rootSnapshot'), state.ownedTrackId), initialRootEndpoint); };
  const census = async (): Promise<Wire[]> => { const result: Wire[] = []; for (const track of baselineTracks) for (let row = 0; row < 8; row++) {
    const value = await slot(track.channelId, row); result.push({ id: track.channelId, row, exists: value.exists, hasContent: value.hasContent });
  } return result; };
  const originalChecks = async (field: 'originalBefore' | 'originalAfter'): Promise<void> => {
    await registry(); for (let row = 0; row < 3; row++) {
      const result = await compare(state.ownedTrackId, row), notes = (result.diagnosticSnapshot as ShadowCacheWireSnapshot).notes;
      assert.deepEqual(checkExpectedFixture(notes, row), []); const before = (report.originalBefore as Wire[])[row];
      assert.deepEqual(checkMutationComparison(result, row, state.ownedTrackId, before ? ((before.result as Wire).diagnosticSnapshot as ShadowCacheWireSnapshot).notes : notes), []);
      if (before) assert.deepEqual(result.authorityMetadata, (before.result as Wire).authorityMetadata);
      (report[field] as Wire[]).push({ row, result }); await save();
    }
  };
  let failed: unknown, ownsTemporarySlot = false;
  const removeTemporary = async (): Promise<Wire> => { await guard(); const current = await slot(state.ownedTrackId, 3);
    if (ownsTemporarySlot && current.hasContent === true) {
      await request('slot.delete', { trackIndex: (await find(state.ownedTrackId)).index, slotIndex: 3 });
      await poll(() => slot(state.ownedTrackId, 3), value => value.hasContent === false);
    }
    const removed = await slot(state.ownedTrackId, 3); assert.equal(removed.hasContent, false); ownsTemporarySlot = false; return removed;
  };
  try {
    report.slotsBefore = await census(); for (const value of report.slotsBefore as Wire[]) assert.equal(value.hasContent, value.id === state.ownedTrackId && Number(value.row) < 3);
    await originalChecks('originalBefore');
    for (const label of INVENTORY_LABELS) {
      await guard(); const arm: Wire = { label, begin: await shadow('rebuildBegin') }; (report.cases as Wire[]).push(arm); await save();
      arm.partial = await shadow('rebuildPoll', { maxCells: 3 }); verifyInventoryPrivateProgress(arm.begin as Wire, arm.partial as Wire); await save();
      if (label === 'explicit-cancel') { arm.action = { operation: 'rebuildCancel', reason: CANCEL_REASON };
        arm.cancelResult = await shadow('rebuildCancel', { reason: CANCEL_REASON }); await save(); }
      if (label === 'total-deadline') {
        arm.heartbeats = []; const started = performance.now();
        while (performance.now() - started < 40_500 || (arm.heartbeats as Wire[]).length < 40) { await wait(1000); const pingStarted = performance.now(); const result = await request('ping');
          (arm.heartbeats as Wire[]).push({ elapsedMs: performance.now() - started, pingMs: performance.now() - pingStarted, ping: result, info: await shadow('info') }); await save(); }
        arm.waitedMs = performance.now() - started;
      }
      if (label === 'launcher-content-event') {
        await guard(); arm.slotBefore = await slot(state.ownedTrackId, 3); assert.equal((arm.slotBefore as Wire).hasContent, false);
        arm.createdAddress = { trackId: state.ownedTrackId, row: 3 }; arm.createdClipCount = 1;
        arm.request = { trackIndex: (await find(state.ownedTrackId)).index, slotIndex: 3, lengthBeats: 4 };
        ownsTemporarySlot = true; await save(); arm.action = await request('clip.create', arm.request as Wire);
        arm.slotCreated = await poll(() => slot(state.ownedTrackId, 3), value => value.hasContent === true); await wait(200); await save();
      }
      arm.terminalPolls = [await shadow('rebuildPoll', { maxCells: 3 }), await shadow('rebuildPoll', { maxCells: 3 })];
      verifyInventoryTerminal(arm.partial as Wire, arm.terminalPolls, label === 'explicit-cancel' ? CANCEL_REASON : label === 'total-deadline' ? 'inventory-rebuild-budget' : 'structural-event-requires-rebind'); await save();
      if (label === 'launcher-content-event') { arm.slotRemoved = await removeTemporary(); arm.temporaryClipRemoved = true; await save(); }
      arm.recovery = await registry(); arm.recoveryComparison = await compare(state.ownedTrackId, 0);
      const originalNotes = (((report.originalBefore as Wire[])[0]!.result as Wire).diagnosticSnapshot as ShadowCacheWireSnapshot).notes;
      assert.deepEqual(checkMutationComparison(arm.recoveryComparison as Wire, 0, state.ownedTrackId, originalNotes), []);
      arm.outcome = 'terminal-refusal-and-explicit-recovery'; await save(); console.log(JSON.stringify({ label, outcome: arm.outcome }));
    }
  } catch (error) { failed = error; report.error = String(error); await save(); }
  finally {
    try {
      await shadow('rebuildCancel', { reason: 'inventory-control-cleanup' }); await removeTemporary(); report.temporaryClipRemoved = true;
      await guard(); await originalChecks('originalAfter'); report.finalTracks = await tracks(); report.finalScenes = await scenes();
      report.finalRootEndpoint = identityEndpoint(await shadow('rootSnapshot'), state.ownedTrackId); report.slotsAfter = await census();
      assert.deepEqual(report.slotsAfter, report.slotsBefore); report.fixtureRestored = true;
    } catch (error) { report.cleanupError = String(error); if (!failed) failed = error; }
    try { report.retired = [await shadow('retire', { index: 0 }), await shadow('retire', { index: 1 })];
      report.exactCancelled = await shadow('exactCancel', { reason: 'inventory-controls-ended' }); }
    catch (error) { report.retirementError = String(error); if (!failed) failed = error; }
    report.ended = new Date().toISOString(); await save();
  }
  if (failed) throw failed; console.log(`Verified ${verifyInventoryReport(report)} private inventory controls. No eligibility is claimed.`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  void (process.argv[2] === 'verify' ? readFile(process.argv[3] ?? INVENTORY_OUTPUT, 'utf8').then(value => console.log(`Verified ${verifyInventoryReport(JSON.parse(value) as Wire)} private inventory controls.`))
    : (assert.equal(process.argv[2], 'run'), run(process.argv[3] ?? INVENTORY_OUTPUT))).catch(error => { console.error(error); process.exitCode = 1; }).finally(() => bridge.disconnect());
