// 8h3e removed the research wire or rig configuration that this live driver uses. Live use needs the
// earlier research build of its own session. Its retained artifacts and offline checks do not need a host.
/** Check structural recovery on disposable tracks and appended scenes. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { BridgeClient } from '../client.js';
import { checkExpectedFixture } from './phase8g-lifecycle-reuse.js';
import { identityEndpoint } from './phase8g-identity-fence.js';
import { ACQUIRED_FIELDS, MUTATION_MARKER, checkMutationComparison, checkMutationNotes, collectMutationRegistry,
  verifyMutationRegistry } from './phase8g-shadow-mutations.js';
import { compareShadowSnapshots, shadowSnapshotFromWire, type ShadowCacheWireSnapshot, type ShadowNote } from './phase8g-shadow-cache-lib.js';

type Wire = Record<string, unknown>;
function measurement(value: unknown, field: string): number {
  assert(typeof value === 'number' && Number.isFinite(value) && value >= 0, `invalid measurement: ${field}`); return value;
}
interface Track { index: number; channelId: string; name: string }
interface Target { id: string; row: number; name: string; notes: readonly ShadowNote[] }
const PREFIX = 'gn-8g-structure', GRID = 1 / 512, WIDTH = 2048;
export const STRUCTURE_OUTPUT = '/tmp/ghostnote-8g-shadow-structure-v5-results.json';
export const STRUCTURE_LABELS = ['clip-duplicate', 'clip-move', 'clip-replace', 'clip-delete', 'clip-recreate',
  'scene-append-after', 'scene-delete-after', 'scene-delete-before', 'scene-delete-at',
  'track-insert-before-owned', 'track-delete-before-owned', 'track-duplicate', 'track-delete-copy', 'track-delete-observed'] as const;
export const STRUCTURE_UNSUPPORTED = [
  { label: 'scene-insert-before', reason: 'scene.create appends; no active indexed insertion method' },
  { label: 'scene-insert-at', reason: 'scene.create appends; no active indexed insertion method' },
  { label: 'group-topology', reason: 'branch.groupTrack is the E22 unsafe focus regression route; UI control remains unrun' },
] as const;
export const STRUCTURE_METHODS = ['cache.shadow', 'contract.hello', 'rig.methods', 'rig.scanTracks', 'track.list', 'track.create',
  'track.setName', 'track.delete', 'branch.duplicateTrack', 'scene.count', 'scene.create', 'scene.delete', 'clip.create',
  'slot.status', 'slot.select', 'slot.duplicateClip', 'slot.moveTo', 'slot.delete', 'cursor.pin', 'cursor.pinTrack',
  'cursor.pointTrack', 'cursor.status', 'cursor.setStepSize', 'cursor.scrollToStep', 'cursor.setClipMetadata',
  'cursor.setNotes', 'cursor.setNoteProps', 'cursor.getNotes', 'cursor.getNotesVerboseAllChannels', 'ping'] as const;
export function verifyStructureMethods(value: Wire): void {
  assert.equal(value.runtimeProfile, 'phase-8-probe-v1'); assert(Array.isArray(value.methods));
  assert.deepEqual(STRUCTURE_METHODS.filter(method => !(value.methods as string[]).includes(method)), []);
}
/** Compare both acquisitions with the retained fixture oracle. */
export function checkStructureComparison(value: Wire, target: Target): void {
  assert.equal(value.instrumentationRevision, MUTATION_MARKER); assert.equal(value.comparison, 'match');
  assert.equal(value.complete, false); assert.equal(value.eligible, false); assert.equal(value.callbackSourceIdentityKnown, false);
  assert.equal(value.contentComparisonComplete, true); assert.equal(value.authorityAvailable, true);
  assert.equal(value.stepDataObservers, 3); assert.equal(value.residentHandles, 2); assert.equal(value.observerKind, 'addStepDataObserver');
  assert.equal(value.physicalPendingHints, 0); assert.equal(value.pendingCoordinates, 0); assert.equal(value.physicalHintOverflow, false);
  const wire = value.diagnosticSnapshot as ShadowCacheWireSnapshot; assert(wire && Array.isArray(value.authorityNotes));
  assert.deepEqual(wire.address, { trackId: target.id, row: target.row }); assert(typeof wire.token.initDomain === 'string' && wire.token.initDomain.trim());
  assert.equal(wire.metadata.name, target.name); assert.equal((value.authorityMetadata as Wire).name, target.name);
  for (const coverage of [wire.coverage, value.authorityCoverage as ShadowCacheWireSnapshot['coverage']]) {
    assert.equal(coverage.startCell, 0); assert.equal(coverage.width, WIDTH); assert.equal(coverage.allChannels, true);
    assert.equal(coverage.timingBasis, '1/512-beat'); assert(ACQUIRED_FIELDS.every(field => coverage.fields.includes(field)));
  }
  const cached = shadowSnapshotFromWire(wire, 'complete'), authority = shadowSnapshotFromWire({ ...wire,
    coverage: value.authorityCoverage as ShadowCacheWireSnapshot['coverage'], metadata: value.authorityMetadata as ShadowCacheWireSnapshot['metadata'],
    notes: value.authorityNotes as ShadowNote[] }, 'complete');
  assert.equal(compareShadowSnapshots(cached, authority, { before: cached.window, after: cached.window }).outcome, 'match');
  assert.deepEqual(checkMutationNotes(cached.notes, target.notes), []); assert.deepEqual(checkMutationNotes(authority.notes, target.notes), []);
}
/** Check setter values before the acquired defaults become the full field oracle. */
export function checkStructureSeed(target: Target, kind: 'A' | 'B'): void {
  const expected = kind === 'A' ? ['0:0:60', '0:16:76', '15:0:60', '15:16:76'] : ['7:32:72'];
  assert.deepEqual(target.notes.map(note => `${note.channel}:${note.cell}:${note.pitch}`).sort(), expected.sort());
  assert.equal(target.name, `${PREFIX}-${kind}`);
  for (const note of target.notes) {
    assert.equal(note.fields.chance, .375); assert.equal(note.fields.isChanceEnabled, false);
    assert.equal(note.fields.rawTimbre, -.5); assert.equal(note.fields.timbre, .25); assert.equal(note.fields.gain, 1.25);
    assert(Math.abs(Number(note.fields.velocity) - (kind === 'B' ? 77 : note.cell === 0 ? 80 : 100) / 127) < 1e-6);
    assert.equal(note.fields.durationCells, kind === 'B' ? 9 : note.cell === 0 ? 2 : 4);
  }
}
/** Record missing automatic fences before the explicit recovery barrier. */
export function structureReadRefused(value: Wire): boolean {
  return value.readMode === 'refuse' && value.phase === 'retired' && value.authorityAvailable === false
    && value.complete === false && value.eligible === false && value.fallbackPerformed === false
    && !value.diagnosticSnapshot && !value.authorityNotes && !Object.hasOwn(value, 'scanProgressCoordinates');
}
export function automaticStructureFence(before: Wire, info: Wire, status: Wire, read: Wire): Wire {
  for (const value of [info, status, read]) { assert.equal(value.complete, false); assert.equal(value.eligible, false); }
  const generationChanged = ['projectGeneration', 'structuralEpoch'].some(field => typeof before[field] === 'number'
    && typeof info[field] === 'number' && before[field] !== info[field]);
  const terminalRefusal = structureReadRefused(read);
  return { observed: generationChanged && terminalRefusal, generationChanged, terminalRefusal,
    outcome: generationChanged && terminalRefusal ? 'automatic-fence-observed' : 'automatic-fence-missing',
    historicalComparison: read.comparison ?? null, callbackOriginProved: false };
}
export function verifyStructureReport(report: Wire): number {
  assert.equal(report.marker, MUTATION_MARKER); assert.equal(report.researchOnly, true); assert.equal(report.complete, false);
  assert.equal(report.eligible, false); assert.equal(report.fixtureRestored, true); assert.equal(report.temporaryFixturesRemoved, true);
  assert.equal(report.structuralScopeComplete, false); assert.equal(report.callbackOriginProved, false);
  assert.equal(typeof report.ended, 'string'); assert(!report.error); verifyStructureMethods(report.methods as Wire);
  assert.deepEqual(report.unsupported, STRUCTURE_UNSUPPORTED); assert.deepEqual(report.finalTrackIds, report.baselineTrackIds);
  assert.equal(report.finalScenes, report.baselineScenes);
  assert.deepEqual(report.baselineSlotsAfter, report.baselineSlotsBefore); assert.deepEqual(report.finalRootEndpoint, report.initialRootEndpoint);
  const cases = report.cases as Wire[]; assert.deepEqual(cases.map(value => value.label), STRUCTURE_LABELS);
  const initial = report.originalBefore as Wire[], restored = report.originalAfter as Wire[];
  assert.equal(initial.length, 3); assert.equal(restored.length, 3);
  for (const [row, value] of initial.entries()) {
    const result = value.result as Wire, notes = (result.diagnosticSnapshot as ShadowCacheWireSnapshot).notes;
    assert.deepEqual(checkExpectedFixture(notes, row), []); assert.deepEqual(checkMutationComparison(result, row, String(report.originalTrackId), notes), []);
  }
  const seeds = report.fixtureBaselines as Wire[]; assert.equal(seeds.length, 2);
  for (const [i, seed] of seeds.entries()) { const seedTarget = seed.target as unknown as Target; checkStructureSeed(seedTarget, i === 0 ? 'A' : 'B'); checkStructureComparison(seed.result as Wire, seedTarget); }
  const a = seeds[0]!.target as unknown as Target, b = seeds[1]!.target as unknown as Target;
  assert.equal(a.id, b.id); assert.equal(a.row, Number(report.baselineScenes) + 1); assert.equal(b.row, Number(report.baselineScenes) + 4);
  assert(!(report.baselineTrackIds as string[]).includes(a.id));
  const rows = [2, 3, 3, 1, 3, 3, 3, 2, 0, 0, 0, 0, 0];
  let copyId = '';
  for (const [row, value] of restored.entries()) {
    const baseline = initial[row]!.result as Wire, expected = (baseline.diagnosticSnapshot as ShadowCacheWireSnapshot).notes;
    assert.deepEqual(checkMutationComparison(value.result as Wire, row, String(report.originalTrackId), expected), []);
    assert.deepEqual((value.result as Wire).authorityMetadata, baseline.authorityMetadata);
  }
  for (const [index, value] of cases.entries()) {
    assert.equal(value.outcome, 'recovery-match'); assert.equal(value.explicitBarrier, true);
    const observed = automaticStructureFence(value.before as Wire, value.automaticInfo as Wire, value.automaticStatus as Wire, value.automaticRead as Wire);
    assert.deepEqual(value.automaticFence, observed); verifyMutationRegistry((value.rebuild as Wire).result as Wire);
    const stale = value.afterBarrierRead as Wire;
    assert(structureReadRefused(stale));
    const target = value.target as unknown as Target;
    if (value.label === 'track-duplicate') { copyId = target.id; assert(copyId !== a.id && !(report.baselineTrackIds as string[]).includes(copyId)); }
    const expectedId = value.label === 'track-duplicate' ? copyId : value.label === 'track-delete-observed' ? report.originalTrackId : a.id;
    const expected = value.label === 'track-delete-observed' ? ((initial[0]!.result as Wire).diagnosticSnapshot as ShadowCacheWireSnapshot).notes : value.label === 'clip-replace' ? b.notes : a.notes;
    assert.equal(target.id, expectedId); assert.equal(target.row, index === cases.length - 1 ? 0 : Number(report.baselineScenes) + rows[index]!);
    assert.equal(target.name, value.label === 'track-delete-observed' ? 'gn-8g-reuse-A' : value.label === 'clip-replace' ? b.name : a.name);
    assert.deepEqual(checkMutationNotes(target.notes, expected), []); checkStructureComparison(value.result as Wire, target);
    assert.equal(typeof value.wallMs, 'number'); assert(Number.isFinite(value.wallMs) && Number(value.wallMs) >= 0);
    for (const field of ['membershipGetStepCalls', 'authorityGetStepCalls', 'enrichmentGetStepCalls', 'membershipHostWorkMs', 'authorityHostWorkMs',
      'enrichmentHostWorkMs', 'recorderEstimatedBytes', 'physicalHintRecorderEstimatedBytes', 'retainedSnapshotEstimatedBytes']) {
      const measurement = (value.metrics as Wire)[field]; assert(typeof measurement === 'number' && Number.isFinite(measurement) && measurement >= 0);
    }
    assert.equal((value.metrics as Wire).serializedBytesAreMemoryMeasurement, false);
  }
  assert.equal(report.automaticFenceMissing, cases.filter(value => (value.automaticFence as Wire).observed !== true).length);
  assert.equal(report.automaticStructureAcceptanceComplete, report.automaticFenceMissing === 0);
  return cases.length;
}

const bridge = new BridgeClient(); let calls = 0, responseBytes = 0;
const wait = async (ms = 100): Promise<void> => await new Promise(resolve => setTimeout(resolve, ms));
async function request<T = Wire>(method: string, params?: Wire): Promise<T> {
  const value = await bridge.request(method, params) as T; calls++; responseBytes += Buffer.byteLength(JSON.stringify(value)); return value;
}
async function shadow(operation: string, params: Wire = {}): Promise<Wire> { return await request('cache.shadow', { operation, ...params }); }
async function poll(read: () => Promise<Wire>, done: (value: Wire) => boolean, budget = 45_000): Promise<Wire> {
  const start = performance.now(); for (;;) { const value = await read(); if (done(value)) return value;
    assert(performance.now() - start < budget, `structural operation expired: ${JSON.stringify(value)}`); await wait(); }
}
/** Wait for note-on state before a field setter can acquire its NoteStep. */
export async function settleStructureSeedChannel(inputs: readonly number[][], readOnsets: () => Promise<Wire>,
  apply: () => Promise<Wire[]>, readFields: () => Promise<Wire>): Promise<Wire> {
  const onsets = await poll(readOnsets, value => Array.isArray(value.notes) && (value.notes as number[][]).length === inputs.length
    && inputs.every(input => (value.notes as number[][]).some(note => note[0] === input[0] && note[1] === input[1]
      && note[2] === input[2] && Math.abs(Number(note[3]) - input[3]!) < 1e-9)));
  const applied = await apply();
  for (const value of applied) assert.deepEqual(value.applied, { chance: 'ok', isChanceEnabled: 'ok', timbre: 'ok', gain: 'ok' });
  const settled = await poll(readFields, value => Array.isArray(value.notes) && (value.notes as Wire[]).length === inputs.length
    && inputs.every(input => (value.notes as Wire[]).some(note => note.x === input[0] && note.y === input[1]
      && note.chance === .375 && note.isChanceEnabled === false && note.timbre === -.5 && note.gain === 1.25)));
  return { onsets, applied, settled };
}
async function tracks(): Promise<Track[]> {
  const value = await request<{ tracks: Track[]; count: number; itemCount: number; bankSize: number }>('track.list');
  assert.equal(value.count, value.itemCount); assert(value.itemCount <= value.bankSize); return value.tracks;
}
async function scenes(): Promise<number> { return (await request<{ sceneCount: number }>('scene.count')).sceneCount; }
async function slot(id: string, row: number): Promise<Wire> { const track = await find(id); return await request('slot.status', { trackIndex: track.index, slotIndex: row }); }
async function find(id: string): Promise<Track> { const found = (await tracks()).filter(value => value.channelId === id); assert.equal(found.length, 1); return found[0]!; }
async function pointWriter(id: string, row: number): Promise<void> {
  const track = await find(id), cursor = 'fine'; await request('cursor.pin', { cursor, pinned: false }); await request('cursor.pinTrack', { cursor, pinned: false });
  await request('cursor.pointTrack', { cursor, trackIndex: track.index });
  await request('slot.select', { trackIndex: track.index, slotIndex: row, mechanism: 'track' });
  await poll(() => request('cursor.status', { cursor }), value => value.slotExists === true && value.sceneIndex === row && value.trackPosition === track.index);
  await request('cursor.pinTrack', { cursor, pinned: true }); await request('cursor.pin', { cursor, pinned: true });
  await request('cursor.setStepSize', { cursor, stepSize: GRID }); await request('cursor.scrollToStep', { cursor, step: 0 }); await wait(150);
}
async function bind(id: string, row: number, canaryId: string): Promise<Wire> {
  const track = await find(id), canary = await find(canaryId);
  await shadow('point', { index: 0, trackIndex: track.index, row, canaryTrackIndex: canary.index, canaryRow: row === 1 && id === canaryId ? 0 : 1 });
  const final = await poll(() => shadow('poll', { index: 0 }), value => value.phase === 'retired'
    || ((value.phase === 'settled' || value.phase === 'complete') && value.canaryPhase === 'target'));
  assert.notEqual(final.phase, 'retired'); assert.equal(final.canaryVerifiedForBinding, true); await shadow('reconcile', { index: 0 }); return final;
}
async function compare(): Promise<Wire> {
  let value = await shadow('compareStart', { index: 0 });
  return await poll(async () => { if (value.comparison === 'pending') value = await shadow('comparePoll'); return value; }, value => value.comparison !== 'pending');
}
async function registry(operation: 'inventory' | 'rebuild'): Promise<Wire> {
  const retained: Wire[] = [], result = await collectMutationRegistry(await shadow(operation), () => shadow('rebuildPoll'), retained);
  return { operation, statuses: retained, result };
}

async function run(output: string): Promise<void> {
  const state = JSON.parse(await readFile('/tmp/ghostnote-8g-research-state.json', 'utf8')) as { ownedTrackId: string; baselineIds: string[]; baselineScenes: number };
  const witness = JSON.parse(await readFile('/tmp/ghostnote-8g-mutation-witness.json', 'utf8')) as Wire;
  assert.equal(witness.status, 'ready'); assert.equal(witness.ownedTrackId, state.ownedTrackId);
  const original = await find(state.ownedTrackId); assert.equal(original.name, 'gn-8g-reuse');
  const baselineTracks = await tracks(), baselineScenes = await scenes(); assert.equal(baselineScenes, state.baselineScenes);
  assert.deepEqual(baselineTracks.map(value => value.channelId).sort(), [...state.baselineIds, state.ownedTrackId].sort());
  assert(!baselineTracks.some(value => value.name.startsWith(PREFIX))); assert(baselineScenes + 6 <= 64);
  const methods = await request('rig.methods'); verifyStructureMethods(methods);
  const initial = await shadow('info'); assert.equal(initial.instrumentationRevision, MUTATION_MARKER);
  assert.equal(initial.steps, WIDTH); assert.equal(initial.residentHandles, 2); assert.equal(initial.authorityHandles, 1);
  const rootEndpoint = identityEndpoint(await shadow('rootSnapshot'), state.ownedTrackId);
  const report: Wire = { marker: MUTATION_MARKER, started: new Date().toISOString(), researchOnly: true, complete: false, eligible: false,
    structuralScopeComplete: false, callbackOriginProved: false, baselineTrackIds: baselineTracks.map(value => value.channelId), baselineScenes,
    originalTrackId: state.ownedTrackId, methods, hello: await request('contract.hello'), initial, cases: [], originalBefore: [], originalAfter: [],
    unsupported: STRUCTURE_UNSUPPORTED, ownedTracks: [], initialRootEndpoint: rootEndpoint, sceneOwnership: { first: baselineScenes, count: 0 } };
  await writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  const owned = new Map<string, string[]>(); let ownedScenes = 0, target: Target | undefined, failed: unknown;
  const save = async (): Promise<void> => { report.calls = calls; report.responseBytes = responseBytes; report.ownedTracks = [...owned].map(([id, names]) => ({ id, names }));
    report.sceneOwnership = { first: baselineScenes, count: ownedScenes }; await writeFile(output, JSON.stringify(report, null, 2) + '\n'); };
  const guard = async (): Promise<void> => {
    const values = await tracks(); assert.deepEqual(values.filter(value => !owned.has(value.channelId)).map(value => value.channelId), report.baselineTrackIds);
    assert.equal((await find(state.ownedTrackId)).name, 'gn-8g-reuse'); assert.equal(await scenes(), baselineScenes + ownedScenes);
    for (const value of values.filter(value => owned.has(value.channelId))) assert(owned.get(value.channelId)!.includes(value.name), 'owned track was renamed');
    assert.deepEqual(identityEndpoint(await shadow('rootSnapshot'), state.ownedTrackId), rootEndpoint, 'the original project or preset witness changed');
  };
  const baselineSlots = async (): Promise<Wire[]> => {
    const result: Wire[] = []; for (const baseline of baselineTracks) for (let row = 0; row < baselineScenes; row++) {
      const value = await slot(baseline.channelId, row); assert.equal(value.hasContent, baseline.channelId === state.ownedTrackId && row < 3);
      result.push({ id: baseline.channelId, row, exists: value.exists, hasContent: value.hasContent });
    } return result;
  };
  const addTrack = async (name: string, position: number, duplicateId?: string): Promise<Track> => {
    await guard(); const prior = await tracks(), ids = new Set(prior.map(value => value.channelId));
    report.pendingTrackCreation = { name, position, duplicateId, priorIds: [...ids] }; await save();
    if (duplicateId) { const source = await find(duplicateId); assert(owned.has(source.channelId));
      await request('branch.duplicateTrack', { trackIndex: source.index, expectedChannelId: source.channelId, route: 'channelDuplicate' }); }
    else await request('track.create', { position });
    await poll(async () => ({ tracks: await tracks() }), value => (value.tracks as Track[]).some(track => !ids.has(track.channelId)));
    const added = (await tracks()).filter(value => !ids.has(value.channelId)); assert.equal(added.length, 1);
    const track = added[0]!; owned.set(track.channelId, [track.name, name]); delete report.pendingTrackCreation; await save();
    await request('track.setName', { trackIndex: track.index, name }); await poll(async () => ({ track: await find(track.channelId) }), value => (value.track as Track).name === name);
    return await find(track.channelId);
  };
  const deleteTrack = async (id: string): Promise<void> => { await guard(); assert(owned.has(id)); const track = await find(id);
    await request('track.delete', { trackIndex: track.index }); await poll(async () => ({ tracks: await tracks() }), value => !(value.tracks as Track[]).some(track => track.channelId === id)); owned.delete(id); await save(); };
  const createClip = async (id: string, row: number, kind: 'A' | 'B'): Promise<Target> => {
    await guard(); assert(owned.has(id)); assert(row >= baselineScenes && row < baselineScenes + ownedScenes); assert.equal((await slot(id, row)).hasContent, false);
    const track = await find(id); await request('clip.create', { trackIndex: track.index, slotIndex: row, lengthBeats: 4 });
    await poll(() => slot(id, row), value => value.hasContent === true); await pointWriter(id, row);
    const name = `${PREFIX}-${kind}`; await request('cursor.setClipMetadata', { cursor: 'fine', name });
    const inputs = kind === 'A' ? [[0, 60, 80, 2 * GRID], [16, 76, 100, 4 * GRID]] : [[32, 72, 77, 9 * GRID]];
    const channels = kind === 'A' ? [0, 15] : [7];
    for (const channel of channels) { await request('cursor.setNotes', { cursor: 'fine', channel, notes: inputs });
      const settled = await settleStructureSeedChannel(inputs, () => request('cursor.getNotes', { cursor: 'fine', channel }), async () => {
        const result: Wire[] = []; for (const [x, y] of inputs) result.push(await request('cursor.setNoteProps', { cursor: 'fine', channel, x, y,
          props: { chance: .375, isChanceEnabled: false, timbre: -.5, gain: .625 } })); return result;
      }, async () => {
        const read = await request<{ channels: { channel: number; notes: Wire[] }[] }>('cursor.getNotesVerboseAllChannels', { cursor: 'fine', maxX: 33 });
        const found = read.channels.filter(value => value.channel === channel); assert.equal(found.length, 1); return { notes: found[0]!.notes };
      });
      report.seedWrites ??= []; (report.seedWrites as Wire[]).push({ id, row, kind, channel, inputs, settled }); await save(); }
    await wait(200); return { id, row, name, notes: [] };
  };
  const dropClip = async (id: string, row: number): Promise<void> => { await guard(); assert(owned.has(id)); assert(row >= baselineScenes);
    await request('slot.delete', { trackIndex: (await find(id)).index, slotIndex: row }); await poll(() => slot(id, row), value => value.hasContent === false); };
  const moveClip = async (id: string, from: number, to: number): Promise<void> => { await guard(); assert(owned.has(id)); assert(from >= baselineScenes && to >= baselineScenes);
    const track = await find(id); await request('slot.moveTo', { trackIndex: track.index, slotIndex: from, toTrackIndex: track.index, toSlotIndex: to, route: 'insertionPoint' });
    await poll(async () => ({ from: await slot(id, from), to: await slot(id, to) }), value => (value.from as Wire).hasContent === false && (value.to as Wire).hasContent === true); };
  const append = async (count: number): Promise<void> => { await guard(); report.pendingSceneAppend = count; await save(); await request('scene.create', { count });
    await poll(async () => ({ count: await scenes() }), value => value.count === baselineScenes + ownedScenes + count); ownedScenes += count; delete report.pendingSceneAppend; await save(); };
  const deleteScene = async (row: number): Promise<void> => { await guard(); assert(row >= baselineScenes && row < baselineScenes + ownedScenes);
    for (const baseline of baselineTracks) assert.equal((await slot(baseline.channelId, row)).hasContent, false, 'scene deletion refuses other track content');
    await request('scene.delete', { sceneIndex: row }); await poll(async () => ({ count: await scenes() }), value => value.count === baselineScenes + ownedScenes - 1); ownedScenes--; await save(); };
  const originalChecks = async (field: 'originalBefore' | 'originalAfter'): Promise<void> => {
    await registry('rebuild'); for (let row = 0; row < 3; row++) { await bind(state.ownedTrackId, row, state.ownedTrackId); const result = await compare();
      const notes = (result.diagnosticSnapshot as ShadowCacheWireSnapshot).notes;
      assert.deepEqual(checkExpectedFixture(notes, row), []);
      const prior = (report.originalBefore as Wire[])[row];
      assert.deepEqual(checkMutationComparison(result, row, state.ownedTrackId, prior ? ((prior.result as Wire).diagnosticSnapshot as ShadowCacheWireSnapshot).notes : notes), []);
      (report[field] as Wire[]).push({ row, result }); await save(); }
  };
  const recover = async (value: Target): Promise<Wire> => { await bind(value.id, value.row, state.ownedTrackId); return await compare(); };
  const arm = async (label: string, mutate: () => Promise<Target>): Promise<void> => {
    assert(target); await guard(); await bind(target.id, target.row, state.ownedTrackId); checkStructureComparison(await compare(), target);
    const item: Wire = { label, before: await shadow('info') }, started = performance.now(), startCalls = calls, startBytes = responseBytes;
    (report.cases as Wire[]).push(item); await save();
    target = await mutate(); item.target = structuredClone(target);
    item.automaticStatus = await shadow('status', { index: 0 }); item.automaticInfo = await shadow('info'); item.automaticRead = await shadow('read', { index: 0 });
    item.automaticFence = automaticStructureFence(item.before as Wire, item.automaticInfo as Wire, item.automaticStatus as Wire, item.automaticRead as Wire); await save();
    item.explicitBarrier = true; item.barrier = await shadow('invalidate', { reason: `owned-structure:${label}` });
    item.afterBarrierRead = await shadow('read', { index: 0 }); const refused = item.afterBarrierRead as Wire;
    assert(structureReadRefused(refused));
    item.rebuild = await registry('rebuild');
    item.result = await recover(target); await save(); checkStructureComparison(item.result as Wire, target);
    const after = await shadow('info'), before = item.before as Wire, result = item.result as Wire;
    const metrics: Wire = { serializedBytesAreMemoryMeasurement: false, snapshotPayloadEstimatedBytes: (result.diagnosticSnapshot as Wire).payloadEstimatedBytes };
    for (const field of ['membershipGetStepCalls', 'authorityGetStepCalls', 'enrichmentGetStepCalls', 'membershipHostWorkMs', 'authorityHostWorkMs', 'enrichmentHostWorkMs']) {
      metrics[field] = measurement(after[field], field) - measurement(before[field], field); assert(Number(metrics[field]) >= 0);
    }
    for (const field of ['recorderEstimatedBytes', 'physicalHintRecorderEstimatedBytes', 'retainedSnapshotEstimatedBytes']) metrics[field] = measurement(after[field], field);
    item.metrics = metrics; item.calls = calls - startCalls; item.responseBytes = responseBytes - startBytes;
    item.wallMs = performance.now() - started; item.outcome = 'recovery-match'; await save();
    console.log(JSON.stringify({ label, outcome: item.outcome, automaticFence: (item.automaticFence as Wire).outcome, wallMs: item.wallMs }));
  };
  try {
    const pings: number[] = []; for (let i = 0; i < 25; i++) { const start = performance.now(); await request('ping'); pings.push(performance.now() - start); }
    pings.sort((a, b) => a - b); report.ping = { samplesMs: pings, p95Ms: pings[23] }; await shadow('ping', { p95Ms: pings[23] });
    report.baselineSlotsBefore = await baselineSlots(); await originalChecks('originalBefore'); await append(5); const temp = await addTrack(`${PREFIX}-main`, (await tracks()).length);
    let a = await createClip(temp.channelId, baselineScenes + 1, 'A'), b = await createClip(temp.channelId, baselineScenes + 4, 'B');
    await shadow('invalidate', { reason: 'owned structural fixture setup' }); await registry('rebuild');
    for (const value of [a, b]) { await bind(value.id, value.row, state.ownedTrackId); const result = await compare();
      value.notes = structuredClone((result.diagnosticSnapshot as ShadowCacheWireSnapshot).notes);
      checkStructureSeed(value, value === a ? 'A' : 'B');
      checkStructureComparison(result, value); report.fixtureBaselines ??= []; (report.fixtureBaselines as Wire[]).push({ target: structuredClone(value), result }); }
    target = a;
    await arm('clip-duplicate', async () => { const before: number[] = []; for (let row = baselineScenes; row < baselineScenes + ownedScenes; row++) if ((await slot(a.id, row)).hasContent) before.push(row);
      await request('slot.duplicateClip', { trackIndex: (await find(a.id)).index, slotIndex: a.row, route: 'slot' });
      let added: number[] = []; await poll(async () => { added = []; for (let row = baselineScenes; row < baselineScenes + ownedScenes; row++) if (!before.includes(row) && (await slot(a.id, row)).hasContent) added.push(row); return { added }; }, value => (value.added as number[]).length > 0);
      assert.equal(added.length, 1); assert.equal(added[0], baselineScenes + 2, 'duplicate must stay in the owned empty row'); return { ...a, row: added[0]! }; });
    await arm('clip-move', async () => { await moveClip(a.id, target!.row, baselineScenes + 3); return { ...a, row: baselineScenes + 3 }; });
    await arm('clip-replace', async () => { assert.equal((await slot(a.id, target!.row)).hasContent, true);
      await moveClip(b.id, b.row, target!.row); return { ...b, row: target!.row }; });
    await arm('clip-delete', async () => { await dropClip(target!.id, target!.row); return a; });
    await arm('clip-recreate', async () => { const recreated = await createClip(a.id, baselineScenes + 3, 'A'); return { ...recreated, notes: a.notes }; });
    await arm('scene-append-after', async () => { await append(1); return target!; });
    await arm('scene-delete-after', async () => { await deleteScene(baselineScenes + ownedScenes - 1); return target!; });
    await arm('scene-delete-before', async () => { await deleteScene(baselineScenes); a = { ...a, row: a.row - 1 }; return { ...target!, row: target!.row - 1 }; });
    await arm('scene-delete-at', async () => { await deleteScene(target!.row); return a; });
    let helper: Track | undefined;
    await arm('track-insert-before-owned', async () => { const old = await find(a.id); helper = await addTrack(`${PREFIX}-before`, old.index);
      assert.equal((await find(a.id)).index, old.index + 1); return a; });
    await arm('track-delete-before-owned', async () => { const old = await find(a.id); await deleteTrack(helper!.channelId); assert.equal((await find(a.id)).index, old.index - 1); return a; });
    let copy: Track | undefined;
    await arm('track-duplicate', async () => { copy = await addTrack(`${PREFIX}-copy`, 0, a.id); return { ...a, id: copy.channelId }; });
    await arm('track-delete-copy', async () => { await deleteTrack(copy!.channelId); return a; });
    await arm('track-delete-observed', async () => { await deleteTrack(a.id); const result = (report.originalBefore as Wire[])[0]!.result as Wire;
      return { id: state.ownedTrackId, row: 0, name: 'gn-8g-reuse-A', notes: (result.diagnosticSnapshot as ShadowCacheWireSnapshot).notes }; });
  } catch (error) { failed = error; report.error = String(error); await save(); }
  finally {
    try { await shadow('invalidate', { reason: 'owned structural cleanup' });
      for (const id of [...owned.keys()].reverse()) await deleteTrack(id);
      while (ownedScenes > 0) await deleteScene(baselineScenes + ownedScenes - 1);
      await guard(); await originalChecks('originalAfter'); report.finalTrackIds = (await tracks()).map(value => value.channelId); report.finalScenes = await scenes();
      report.baselineSlotsAfter = await baselineSlots(); report.finalRootEndpoint = identityEndpoint(await shadow('rootSnapshot'), state.ownedTrackId);
      report.fixtureRestored = true; report.temporaryFixturesRemoved = true;
    } catch (error) { report.cleanupError = String(error); if (!failed) failed = error; }
    await shadow('retire', { index: 0 }); await shadow('retire', { index: 1 }); await shadow('exactCancel', { reason: 'structure-ended' });
    report.automaticFenceMissing = (report.cases as Wire[]).filter(value => (value.automaticFence as Wire | undefined)?.observed !== true).length;
    report.automaticStructureAcceptanceComplete = report.automaticFenceMissing === 0; report.ended = new Date().toISOString(); await save();
  }
  if (failed) throw failed; console.log(`Structural recovery verifies ${verifyStructureReport(report)} cases. Unsupported UI controls remain open.`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  void (process.argv[2] === 'verify' ? readFile(process.argv[3] ?? STRUCTURE_OUTPUT, 'utf8').then(value => console.log(`Verified ${verifyStructureReport(JSON.parse(value) as Wire)} structural recovery cases.`))
    : (assert.equal(process.argv[2], 'run'), run(process.argv[3] ?? STRUCTURE_OUTPUT))).catch(error => { console.error(error); process.exitCode = 1; }).finally(() => bridge.disconnect());
