// 8h3e removed the research wire or rig configuration that this live driver uses. Live use needs the
// earlier research build of its own session. Its retained artifacts and offline checks do not need a host.
/** Run the experimental shadow cache and restore its disposable fixture. */
import assert from 'node:assert/strict';
import { access, readFile, unlink, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { BridgeClient } from '../client.js';
import { LiveAdapter } from '../adapters/live/adapter.js';
import { BridgeTransport } from '../adapters/live/transport.js';
import { Executor } from '../engine/index.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { NOTE_INVARIANTS_SCHEMA, NOTE_PROPOSAL_SCHEMA, type ExactNoteSource } from '../musical/index.js';
import { callExperimental7b } from './phase7b-profile.js';
import { workspaceOf } from '../surface/workspace.js';
import { compareShadowSnapshots, shadowSnapshotFromWire, assessShadowConsumer, assessShadowAdmission,
  type ShadowCacheWireSnapshot, type ShadowNote } from './phase8g-shadow-cache-lib.js';

const GRID = 1 / 512;
const PREFIX = 'gn-8g-shadow';
const STATE = '/tmp/ghostnote-8g-shadow-state.json';
const RESULTS = '/tmp/ghostnote-8g-shadow-results.json';
const CONFIG = join(homedir(), '.ghostnote', 'rig.json');
const BACKUP = '/tmp/ghostnote-8g-rig-backup.json';
const bridge = new BridgeClient();
const adapter = new LiveAdapter({ transport: new BridgeTransport(bridge) });
const workspace = workspaceOf({ ready: async () => undefined, adapter,
  executor: new Executor(adapter), stash: new Stash(), observationStore: new FakeObservationStore() });
let calls = 0, responseBytes = 0;
const wait = async (ms: number): Promise<void> => await new Promise(resolve => setTimeout(resolve, ms));
async function request<T>(method: string, params?: Record<string, unknown>): Promise<T> {
  calls++;
  const result = await bridge.request(method, params);
  responseBytes += Buffer.byteLength(JSON.stringify(result));
  return result as T;
}
async function shadow<T = Record<string, unknown>>(operation: string, params: Record<string, unknown> = {}): Promise<T> {
  return await request<T>('cache.shadow', { operation, ...params });
}
interface Track { readonly channelId: string; readonly name: string; readonly index: number }
interface Selection { readonly trackIndex: number; readonly slotIndex: number; readonly mixerTrackIndex: number }
interface Cursor { readonly trackExists: boolean; readonly slotExists: boolean; readonly trackPosition: number;
  readonly sceneIndex: number; readonly isPinned?: boolean; readonly cursorTrackPinned?: boolean }
interface State { readonly baselineIds: readonly string[]; readonly baselineScenes: number;
  readonly baselineSlotsWithContent: number;
  readonly baselineSelection: Selection; readonly cursors: Readonly<Record<string, Cursor>>;
  readonly ownedTrackId: string | null }
async function tracks(): Promise<readonly Track[]> { return (await request<{ tracks: Track[] }>('track.list')).tracks; }
async function findTrack(id: string): Promise<Track | undefined> { return (await tracks()).find(t => t.channelId === id); }
async function poll<T>(read: () => Promise<T>, done: (value: T) => boolean, ms = 10_000): Promise<T> {
  const started = performance.now();
  for (;;) {
    const value = await read();
    if (done(value)) return value;
    if (performance.now() - started > ms) throw new Error(`poll expired: ${JSON.stringify(value)}`);
    await wait(50);
  }
}
async function point(cursor: string, trackIndex: number, row: number): Promise<void> {
  await request('cursor.pin', { cursor, pinned: false });
  await request('cursor.pinTrack', { cursor, pinned: false });
  await request('cursor.pointTrack', { cursor, trackIndex });
  await poll(() => request<Cursor>('cursor.status', { cursor }), v => v.trackExists && v.trackPosition === trackIndex);
  await request('cursor.pinTrack', { cursor, pinned: true });
  await request('slot.select', { trackIndex, slotIndex: row, mechanism: 'track' });
  await poll(() => request<Cursor>('cursor.status', { cursor }), v => v.slotExists && v.sceneIndex === row);
  await request('cursor.pin', { cursor, pinned: true });
  await request('cursor.setStepSize', { cursor, stepSize: GRID });
  await request('cursor.scrollToStep', { cursor, step: 0 });
}
async function configure(restore = false): Promise<void> {
  if (restore) {
    await writeFile(CONFIG, await readFile(BACKUP));
    await unlink(BACKUP);
    console.log('Restored exact entry rig configuration.');
    return;
  }
  try { await access(BACKUP); throw new Error('rig backup already exists; restore before configuring'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  const original = await readFile(CONFIG);
  const prior = JSON.parse(original.toString()) as Record<string, unknown>;
  await writeFile(BACKUP, original);
  await writeFile(CONFIG, JSON.stringify({ ...prior, cacheShadowObservers: 8,
    cacheShadowSteps: 131_072, stamp: 'phase8g-shadow-v1' }, null, 2) + '\n');
  console.log('Configured 8 resident handles plus one independent authority handle.');
}
async function setup(): Promise<void> {
  try { await access(STATE); throw new Error('fixture state exists; cleanup before setup'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  const before = await tracks();
  assert(!before.some(t => t.name.startsWith(PREFIX)), 'unowned shadow fixture already exists');
  const sceneCount = (await request<{ sceneCount: number }>('scene.count')).sceneCount;
  assert(sceneCount >= 4, 'fixture needs four existing scenes');
  const cursors: Record<string, Cursor> = {};
  for (const cursor of ['0', 'fine']) cursors[cursor] = await request<Cursor>('cursor.status', { cursor });
  const state: State = { baselineIds: before.map(t => t.channelId), baselineScenes: sceneCount,
    baselineSlotsWithContent: (await request<{ slotsWithContent: number }>('rig.scanTracks')).slotsWithContent,
    baselineSelection: await request<Selection>('selection.status'), cursors, ownedTrackId: null };
  await writeFile(STATE, JSON.stringify(state, null, 2) + '\n');
  await request('track.create', { position: before.length });
  const prior = new Set(state.baselineIds);
  const created = await poll(tracks, v => v.some(t => !prior.has(t.channelId)));
  const added = created.filter(t => !prior.has(t.channelId));
  assert.equal(added.length, 1, 'new track identity must be unique');
  const track = added[0]!;
  await writeFile(STATE, JSON.stringify({ ...state, ownedTrackId: track.channelId }, null, 2) + '\n');
  await request('track.setName', { trackIndex: track.index, name: PREFIX });
  for (let row = 0; row < 4; row++) {
    await request('clip.create', { trackIndex: track.index, slotIndex: row, lengthBeats: row === 2 ? 256 : 4 });
    await poll(() => request<{ hasContent: boolean }>('slot.status', { trackIndex: track.index, slotIndex: row }), v => v.hasContent);
  }
  await point('0', track.index, 0);
  for (let channel = 0; channel < 16; channel++) {
    await request('cursor.setNotes', { cursor: '0', channel, notes: [[0, 60, 80 + channel, 2 * GRID]] });
  }
  await request('cursor.setNoteProps', { cursor: '0', channel: 0, x: 0, y: 60,
    props: { chance: 0.375, isChanceEnabled: false, recurrence: [8, 85], isRecurrenceEnabled: false,
      repeatCount: 2, isRepeatEnabled: false, timbre: -0.5 } });
  await point('0', track.index, 2);
  await request('cursor.scrollToStep', { cursor: '0', step: 131_071 });
  await request('cursor.setNotes', { cursor: '0', channel: 15, notes: [[0, 127, 96, GRID]] });
  await request('cursor.scrollToStep', { cursor: '0', step: 0 });
  await point('0', track.index, 3);
  for (let channel = 0; channel < 16; channel++) {
    const notes = Array.from({ length: 16 }, (_, n) => {
      const key = channel * 16 + n;
      return [Math.floor(key / 128), key % 128, 96, GRID];
    });
    await request('cursor.setNotes', { cursor: '0', channel, notes });
  }
  await point('0', track.index, 0);
  console.log('Fixture ready: all-channel clip, empty clip, boundary clip, 256-coordinate clip.');
}
interface CompareResult extends Record<string, unknown> {
  readonly comparison: string;
  readonly diagnosticSnapshot?: ShadowCacheWireSnapshot;
  readonly authorityNotes?: readonly ShadowNote[];
  readonly authorityMetadata?: ShadowCacheWireSnapshot['metadata'];
}
function numericMeasure(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`invalid shadow measurement: ${field}`);
  }
  return value;
}
async function compare(index: number, label: string): Promise<CompareResult> {
  const started = performance.now();
  const callsAtStart = calls, bytesAtStart = responseBytes;
  const pingTimes: number[] = [];
  for (let n = 0; n < 25; n++) {
    const now = performance.now(); await request('ping'); pingTimes.push(performance.now() - now);
  }
  pingTimes.sort((a, b) => a - b);
  await shadow('ping', { p95Ms: pingTimes[23] });
  let result = await shadow<CompareResult>('compareStart', { index });
  result = await poll(async () => result.comparison !== 'pending' ? result
    : (result = await shadow<CompareResult>('comparePoll')), v => v.comparison !== 'pending', 45_000);
  if (result.comparison === 'match') {
    assert(result.diagnosticSnapshot && result.authorityNotes && result.authorityMetadata);
    const cached = shadowSnapshotFromWire(result.diagnosticSnapshot, 'complete');
    const authority = shadowSnapshotFromWire({ ...result.diagnosticSnapshot,
      notes: result.authorityNotes, metadata: result.authorityMetadata }, 'complete');
    assert.equal(compareShadowSnapshots(cached, authority, { before: cached.window, after: cached.window }).outcome, 'match');
  }
  assert.equal(result.eligible, false, 'unproved project lifecycle must block healthy publication');
  const policyAdmission = result.diagnosticSnapshot === undefined ? undefined : assessShadowAdmission({
    policy: { generationValid: true, replayComplete: result.contentComparisonComplete === true,
      authorityAvailable: result.authorityAvailable === true,
      viewSteps: numericMeasure(result.steps, 'steps'),
      activeObservers: numericMeasure(result.stepDataObservers, 'stepDataObservers'),
      occupiedCoordinates: new Set(result.diagnosticSnapshot.notes.map(n => `${n.cell}:${n.pitch}`)).size,
      pendingDirtyCoordinates: numericMeasure(result.pendingCoordinates, 'pendingCoordinates'),
      estimatedBytes: numericMeasure(result.recorderEstimatedBytes, 'recorderEstimatedBytes'),
      cacheConstructionMs: numericMeasure(result.constructionMs, 'constructionMs'),
      replayMs: numericMeasure(result.replayMs, 'replayMs'),
      rebuildMs: numericMeasure(result.rebuildMs, 'rebuildMs'),
      pingP95Ms: numericMeasure(result.pingP95Ms, 'pingP95Ms') },
    health: result.cacheModelHealth as 'complete',
    eligibility: { identityVerified: false, lifecycleVerified: false, bindingCurrent: true,
      membershipComplete: result.contentComparisonComplete === true, fieldsComplete: true,
      populatedCanaryPassed: result.canaryPassed === true, targetSettled: true,
      windowUnchanged: result.comparison === 'match', noStructuralEvent: true, noEventGap: false },
    comparison: result.comparison === 'match' ? 'match' : result.comparison === 'mismatch' ? 'mismatch' : 'not-run',
  });
  if (policyAdmission) assert.equal(policyAdmission.eligible, false);
  const report = { ...result, label, wallMs: performance.now() - started,
    policyAdmission,
    bridgeRequests: calls - callsAtStart, responseBytes: responseBytes - bytesAtStart };
  console.log(JSON.stringify({ label, comparison: result.comparison, wallMs: report.wallMs,
    authorityNoteCount: result.authorityNoteCount, pendingCoordinates: result.pendingCoordinates,
    bridgeRequests: report.bridgeRequests }));
  assert.equal(result.comparison, 'match', `${label}: independent comparison failed`);
  return report;
}
async function bind(index: number, trackIndex: number, row: number): Promise<void> {
  const prior = await shadow('status', { index });
  if (prior.phase === 'complete' || prior.phase === 'settled') {
    assert.equal((prior.address as { row: number }).row, row);
    return;
  }
  await shadow('point', { index, trackIndex, row });
  await poll(() => shadow('poll', { index }), v => v.phase === 'settled' || v.phase === 'retired');
  const state = await shadow('status', { index });
  assert.equal(state.phase, 'settled', JSON.stringify(state));
  await shadow('reconcile', { index });
}
async function run(): Promise<void> {
  const hello = await request<{ runtimeProfile: string; methodCount: number }>('contract.hello');
  assert.equal(hello.runtimeProfile, 'phase-8-probe-v1'); assert.equal(hello.methodCount, 97);
  const state = JSON.parse(await readFile(STATE, 'utf8')) as State;
  assert(state.ownedTrackId); const track = await findTrack(state.ownedTrackId); assert(track);
  const report: Record<string, unknown> = { hello, started: new Date().toISOString(),
    baselineIds: state.baselineIds, cases: [] };
  const cases = report['cases'] as Record<string, unknown>[];
  const persist = async (): Promise<void> => await writeFile(RESULTS, JSON.stringify(report, null, 2) + '\n');
  await shadow('inventory');
  const info = await shadow('info'); report['initialInfo'] = info;
  assert.equal(info.residentHandles, 8);
  await bind(0, track.index, 0);
  cases.push(await compare(0, 'initialization-all-16-channels')); await persist();
  assert.equal(cases.at(-1)!['authorityNoteCount'], 16);
  cases.push(await compare(0, 'warm-read')); await persist();
  await adapter.hello();
  const readStarted = performance.now();
  const stableRead = await callExperimental7b(workspace, 'read_clip', { trackId: track.channelId, row: 0 });
  assert.equal((stableRead as { readable?: boolean }).readable, true);
  assert.equal((stableRead as { clipExists?: boolean }).clipExists, true);
  assert.equal((stableRead as { notes?: readonly unknown[] }).notes?.length, 1);
  report['stableReadOnly'] = { result: stableRead, wallMs: performance.now() - readStarted,
    publicToolCalls: 1, source: 'stable-E131' };
  await point('0', track.index, 0);
  await request('cursor.setNoteProps', { cursor: '0', channel: 15, x: 0, y: 60,
    props: { velocity: 0.5, chance: 0.25, isChanceEnabled: false, pan: -0.2 } });
  await wait(200);
  cases.push(await compare(0, 'field-only-disabled-property-channel-15')); await persist();
  await request('cursor.setNotes', { cursor: '0', channel: 4, notes: [[12, 72, 100, 4 * GRID]] });
  await wait(150); cases.push(await compare(0, 'note-add-and-sustain-invalidation')); await persist();
  await request('cursor.clearNote', { cursor: '0', channel: 4, x: 12, y: 72 });
  await request('cursor.setNotes', { cursor: '0', channel: 4, notes: [[20, 73, 90, GRID]] });
  await wait(150); cases.push(await compare(0, 'sparse-note-move')); await persist();
  await request('cursor.clearNote', { cursor: '0', channel: 4, x: 20, y: 73 });
  await wait(150); cases.push(await compare(0, 'note-remove')); await persist();
  await bind(1, track.index, 1); cases.push(await compare(1, 'existing-empty-clip')); await persist();
  await bind(2, track.index, 2); cases.push(await compare(2, 'final-boundary-cell')); await persist();
  await bind(3, track.index, 3); cases.push(await compare(3, '256-coordinate-payload')); await persist();
  const sample = cases[2]?.['diagnosticSnapshot'] as ShadowCacheWireSnapshot | undefined;
  if (sample) {
    const observation = shadowSnapshotFromWire(sample, 'partial');
    report['consumer'] = assessShadowConsumer(observation, { workflow: 'sparse-patch',
      currentWindow: observation.window, fields: ['velocity'], authorityAvailable: true });
    assert.equal((report['consumer'] as { mode: string }).mode, 'exact-fallback');
  }
  report['absentSlot'] = await shadow('point', { index: 4, trackIndex: track.index, row: 4 });
  assert.equal((report['absentSlot'] as Record<string, unknown>)['slotAbsenceProved'], true);
  report['retire'] = await shadow('retire', { index: 0 });
  report['rebindSameHandle'] = await shadow('point', { index: 0, trackIndex: track.index, row: 0 });
  assert.equal((report['rebindSameHandle'] as Record<string, unknown>)['reason'], 'binding-handle-used-select-unused-handle');
  await bind(4, track.index, 0); cases.push(await compare(4, 'reacquire-with-unused-handle')); await persist();
  report['saveIdentity'] = await shadow('lifecycle', { kind: 'save' });
  const pingTimes: number[] = [];
  for (let n = 0; n < 25; n++) { const now = performance.now(); await request('ping'); pingTimes.push(performance.now() - now); }
  pingTimes.sort((a,b) => a-b);
  report['ping'] = { medianMs: pingTimes[12], p95Ms: pingTimes[23], maxMs: pingTimes[24] };
  await shadow('ping', { p95Ms: pingTimes[23] });
  report['finalInfo'] = await shadow('info'); report['ended'] = new Date().toISOString();
  report['mismatches'] = cases.filter(c => c['comparison'] !== 'match').map(c => ({ label: c['label'], cause: c['comparison'] }));
  report['promotion'] = 'hold-lifecycle-unverified'; await persist();
  assert.equal((report['mismatches'] as unknown[]).length, 0, 'content comparisons must all match');
  console.log(`Shadow content checks passed. Lifecycle promotion remains blocked. Results: ${RESULTS}`);
}
async function cleanup(): Promise<void> {
  const state = JSON.parse(await readFile(STATE, 'utf8')) as State;
  if (state.ownedTrackId) {
    const target = await findTrack(state.ownedTrackId);
    if (target) {
      assert.equal(target.name, PREFIX, 'cleanup refuses renamed owned track');
      await request('track.delete', { trackIndex: target.index });
      await poll(() => findTrack(target.channelId), v => v === undefined);
    }
  }
  for (const [cursor, prior] of Object.entries(state.cursors)) {
    await request('cursor.pin', { cursor, pinned: false });
    await request('cursor.pinTrack', { cursor, pinned: false });
    if (prior.trackExists && prior.slotExists) await point(cursor, prior.trackPosition, prior.sceneIndex);
    await request('cursor.setStepSize', { cursor, stepSize: cursor === '0' ? 0.25 : GRID });
    await request('cursor.scrollToStep', { cursor, step: 0 });
    await request('cursor.pin', { cursor, pinned: prior.isPinned ?? false });
    await request('cursor.pinTrack', { cursor, pinned: prior.cursorTrackPinned ?? false });
  }
  if (state.baselineSelection.trackIndex >= 0 && state.baselineSelection.slotIndex >= 0) {
    await request('slot.select', { ...state.baselineSelection, mechanism: 'slot' });
  }
  assert.deepEqual((await tracks()).map(t => t.channelId), state.baselineIds);
  assert.equal((await request<{ sceneCount: number }>('scene.count')).sceneCount, state.baselineScenes);
  const final = { tracks: await tracks(), selection: await request('selection.status'),
    cursors: { writer: await request('cursor.status', { cursor: '0' }),
      reader: await request('cursor.status', { cursor: 'fine' }) },
    scan: await request('rig.scanTracks') };
  await writeFile('/tmp/ghostnote-8g-cleanup.json', JSON.stringify(final, null, 2) + '\n');
  console.log('Fixture removed. Track IDs and scene count match. Verify cursor/selection after normal reload.');
}
async function workflow(): Promise<void> {
  const report = JSON.parse(await readFile(RESULTS, 'utf8')) as Record<string, unknown>;
  const state = JSON.parse(await readFile(STATE, 'utf8')) as State;
  assert(state.ownedTrackId); const target = await findTrack(state.ownedTrackId); assert(target);
  await adapter.hello();
  // The insertion policy needs one source channel. Keep this seed in the fixture.
  await point('0', target.index, 1);
  await request('cursor.scrollToStep', { cursor: '0', step: 512 });
  await request('cursor.clearNote', { cursor: '0', channel: 0, x: 0, y: 84 });
  await request('cursor.scrollToStep', { cursor: '0', step: 0 });
  await request('cursor.setNotes', { cursor: '0', channel: 0, notes: [[0, 48, 96, GRID]] });
  await wait(150);
  const acquisition = await callExperimental7b(workspace, 'acquire_clip_note_source', {
    trackId: target.channelId, row: 1,
  }) as { exactSource: ExactNoteSource };
  const source = acquisition.exactSource;
  const input = { mode: 'agent-note-proposal-v0', source,
    proposal: { schema: NOTE_PROPOSAL_SCHEMA, base_sha256: source.digest.value,
      ops: [{ op: 'insert', default_policy: 'track-neutral-v0', notes: [{
        id: 'shadow-insert', track: source.aliases[0]!.alias, start: '1',
        duration: '1/512', pitch: 84, velocity: 100,
      }] }] },
    invariants: { schema: NOTE_INVARIANTS_SCHEMA, preserveUnmentionedFields: true,
      samePitchOverlap: 'refuse', allowedOperations: ['insert'],
      allowedTrackAliases: source.aliases.map(v => v.alias), noteCount: { min: 2, max: 2 } } };
  const started = performance.now();
  const preview = await callExperimental7b(workspace, 'transform_clip_music', {
    ...input, action: 'preview',
  }) as { preview: { previewDigest: { value: string } } };
  assert(preview.preview?.previewDigest?.value, JSON.stringify(preview));
  const application = await callExperimental7b(workspace, 'transform_clip_music', {
    ...input, action: 'apply', acceptedPreviewSha256: preview.preview.previewDigest.value,
  }) as Record<string, unknown>;
  assert.equal(application.applied, true, JSON.stringify(application));
  report['sparsePatchWorkflow'] = { application, publicToolCalls: 3,
    wallMs: performance.now() - started, authority: 'stable-E131',
    comparison: await compare(1, 'real-agent-note-patch-insert') };
  await writeFile(RESULTS, JSON.stringify(report, null, 2) + '\n');
  await point('0', target.index, 1);
  await request('cursor.scrollToStep', { cursor: '0', step: 512 });
  await request('cursor.clearNote', { cursor: '0', channel: 0, x: 0, y: 84 });
  await request('cursor.scrollToStep', { cursor: '0', step: 0 });
  await request('cursor.clearNote', { cursor: '0', channel: 0, x: 0, y: 48 });
  await wait(150);
  report['sparsePatchCleanup'] = await compare(1, 'real-agent-note-patch-cleanup');
  await writeFile(RESULTS, JSON.stringify(report, null, 2) + '\n');
  await request('slot.duplicateClip', { trackIndex: target.index, slotIndex: 3, route: 'slot' });
  await poll(() => request<{ hasContent: boolean }>('slot.status', {
    trackIndex: target.index, slotIndex: 4 }), v => v.hasContent);
  report['structuralFallback'] = await shadow('status', { index: 3 });
  assert.equal((report['structuralFallback'] as Record<string, unknown>)['phase'], 'retired');
  await shadow('rebuild');
  await bind(5, target.index, 4);
  report['duplicateRebuild'] = await compare(5, 'duplicate-new-identity-rebuild');
  await writeFile(RESULTS, JSON.stringify(report, null, 2) + '\n');
  console.log('Real note-patch workflow and structural fallback checked.');
}
async function main(): Promise<void> {
  const command = process.argv[2];
  if (command === 'configure') await configure();
  else if (command === 'restore-config') await configure(true);
  else if (command === 'setup') await setup();
  else if (command === 'run') await run();
  else if (command === 'cleanup') await cleanup();
  else if (command === 'workflow') await workflow();
  else if (command === 'final-live') {
    const state = JSON.parse(await readFile(STATE, 'utf8')) as State;
    assert(state.ownedTrackId); const target = await findTrack(state.ownedTrackId); assert(target);
    const hello = await request('contract.hello');
    await shadow('inventory'); await bind(0, target.index, 4);
    const cases = [await compare(0, 'final-build-dense-replay'), await compare(0, 'final-build-dense-warm')];
    await writeFile('/tmp/ghostnote-8g-final-live.json', JSON.stringify({ hello, cases,
      info: await shadow('info') }, null, 2) + '\n');
  }
  else if (command === 'verify-cleanup') {
    const state = JSON.parse(await readFile(STATE, 'utf8')) as State;
    const hello = await request<{ runtimeProfile: string }>('contract.hello');
    assert.equal(hello.runtimeProfile, 'normal-v1');
    assert.deepEqual((await tracks()).map(t => t.channelId), state.baselineIds);
    assert.equal((await request<{ sceneCount: number }>('scene.count')).sceneCount, state.baselineScenes);
    const restoredCursors: Record<string, Cursor> = {};
    for (const [cursor, prior] of Object.entries(state.cursors)) {
      const now = await request<Cursor>('cursor.status', { cursor });
      restoredCursors[cursor] = now;
      for (const field of ['trackExists', 'slotExists', 'trackPosition', 'sceneIndex',
        'isPinned', 'cursorTrackPinned'] as const) assert.equal(now[field], prior[field], `${cursor}.${field}`);
    }
    const selection = await request<Selection>('selection.status');
    assert.equal(selection.trackIndex, state.baselineSelection.trackIndex);
    assert.equal(selection.slotIndex, state.baselineSelection.slotIndex);
    assert.equal(selection.mixerTrackIndex, state.baselineSelection.mixerTrackIndex);
    const scan = await request('rig.scanTracks');
    assert.equal((scan as { slotsWithContent: number }).slotsWithContent, state.baselineSlotsWithContent);
    await writeFile('/tmp/ghostnote-8g-cleanup-verified.json', JSON.stringify({ hello,
      baselineIds: state.baselineIds, sceneCount: state.baselineScenes, selection, scan,
      cursors: restoredCursors, cursorsMatch: true, verified: true }, null, 2) + '\n');
    await unlink(STATE);
    console.log('Normal runtime, track IDs, scenes, selection, and cursors match the entry baseline.');
  }
  else if (command === 'verify-artifacts') {
    const base = new URL('../../../context/evidence/data/phase8g-shadow-cache/', import.meta.url);
    const manifest = JSON.parse(await readFile(new URL('manifest.json', base), 'utf8')) as {
      files: Record<string, { file: string; uncompressedSha256: string }>; retainedComparisons: number;
    };
    let count = 0;
    for (const [name, file] of Object.entries(manifest.files)) {
      const raw = gunzipSync(await readFile(new URL(file.file, base)));
      assert.equal(createHash('sha256').update(raw).digest('hex'), file.uncompressedSha256);
      const report = JSON.parse(raw.toString()) as { verified?: boolean; cases: CompareResult[];
        sparsePatchWorkflow: { comparison: CompareResult }; sparsePatchCleanup: CompareResult;
        duplicateRebuild: CompareResult };
      if (name === 'cleanup') { assert.equal(report.verified, true); continue; }
      const cases = [...report.cases];
      if (name === 'main-workflow') cases.push(report.sparsePatchWorkflow.comparison,
        report.sparsePatchCleanup, report.duplicateRebuild);
      for (const result of cases) {
        assert.equal(result.comparison, 'match'); assert.equal(result.eligible, false);
        assert.equal(result.complete, false); assert.equal(result.pendingCoordinates, 0);
        assert(result.diagnosticSnapshot && result.authorityNotes && result.authorityMetadata);
        const cached = shadowSnapshotFromWire(result.diagnosticSnapshot, 'complete');
        const authority = shadowSnapshotFromWire({ ...result.diagnosticSnapshot,
          notes: result.authorityNotes, metadata: result.authorityMetadata }, 'complete');
        assert.equal(compareShadowSnapshots(cached, authority, {
          before: cached.window, after: cached.window }).outcome, 'match');
        count++;
      }
    }
    assert.equal(count, manifest.retainedComparisons);
    console.log(`Artifact checks pass: ${count} content matches; no eligible cache result.`);
  }
  else if (command === 'info') console.log(JSON.stringify(await shadow('info')));
  else if (command === 'compare') console.log(JSON.stringify(await compare(Number(process.argv[3]), 'manual')));
  else throw new Error('usage: phase8g-shadow-cache.ts configure | restore-config | setup | run | workflow | final-live | cleanup | verify-cleanup | verify-artifacts | info | compare <index>');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => bridge.disconnect());
