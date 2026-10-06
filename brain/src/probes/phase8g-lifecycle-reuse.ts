// 8h3e removed the research wire or rig configuration that this live driver uses. Live use needs the
// earlier research build of its own session. Its retained artifacts and offline checks do not need a host.
/** Collect project signals and observer reuse evidence. Cache authority stays disabled. */
import assert from 'node:assert/strict';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { gunzipSync } from 'node:zlib';
import { BridgeClient } from '../client.js';
const GRID = 1 / 512, PREFIX = 'gn-8g-reuse';
const STATE = '/tmp/ghostnote-8g-research-state.json', RESULTS = '/tmp/ghostnote-8g-reuse-results.json';
const ROOT_RESULTS = '/tmp/ghostnote-8g-root-results.json', BACKUP = '/tmp/ghostnote-8g-research-rig-backup.json';
export const RESEARCH_CLEANUP_OUTPUT = '/tmp/ghostnote-8g-research-cleanup.json';
export const RESEARCH_CLEANUP_VERIFIED_OUTPUT = '/tmp/ghostnote-8g-research-cleanup-verified.json';
export interface CleanupArguments { readonly output: string; readonly explicitOutput: boolean; readonly keepState: boolean }
/** Reserve a new explicit report before any host operation. Defaults retain the old CLI behavior. */
export function parseCleanupArguments(command: 'cleanup' | 'verify-cleanup', args: readonly string[]): CleanupArguments {
  const paths = args.filter(value => !value.startsWith('--'));
  assert(paths.length <= 1, 'cleanup accepts one output path');
  const flags = args.filter(value => value.startsWith('--'));
  assert(flags.every(value => value === '--keep-state' && command === 'verify-cleanup'), 'unknown cleanup option');
  assert(flags.length <= 1, 'cleanup option cannot repeat');
  const output = paths[0] ?? (command === 'cleanup' ? RESEARCH_CLEANUP_OUTPUT : RESEARCH_CLEANUP_VERIFIED_OUTPUT);
  assert(output.trim().length > 0 && !output.includes('\0'), 'cleanup output path is invalid');
  return { output, explicitOutput: paths.length === 1, keepState: flags.includes('--keep-state') };
}
export async function reserveCleanupOutput(options: CleanupArguments, report: unknown): Promise<void> {
  if (options.explicitOutput) await writeFile(options.output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
}
const CONFIG = join(homedir(), '.ghostnote', 'rig.json');
const bridge = new BridgeClient();
const wait = async (ms: number): Promise<void> => await new Promise(resolve => setTimeout(resolve, ms));
type Wire = Record<string, unknown>;
interface Track { readonly channelId: string; readonly name: string; readonly index: number }
interface Cursor { readonly trackExists: boolean; readonly slotExists: boolean; readonly trackPosition: number;
  readonly sceneIndex: number; readonly isPinned?: boolean; readonly cursorTrackPinned?: boolean }
interface Selection { readonly trackIndex: number; readonly slotIndex: number; readonly mixerTrackIndex: number }
interface State { readonly baselineIds: readonly string[]; readonly baselineScenes: number;
  readonly baselineSlotsWithContent: number; readonly baselineSelection: Selection;
  readonly cursors: Readonly<Record<string, Cursor>>; readonly ownedTrackId: string | null }
interface ResearchNote { readonly channel: number; readonly cell: number; readonly pitch: number; readonly fields: Wire }
async function request<T = Wire>(method: string, params?: Wire): Promise<T> { return await bridge.request(method, params) as T; }
async function shadow(operation: string, params: Wire = {}): Promise<Wire> { return await request('cache.shadow', { operation, ...params }); }
async function tracks(): Promise<readonly Track[]> { return (await request<{ tracks: Track[] }>('track.list')).tracks; }
async function findTrack(id: string): Promise<Track | undefined> { return (await tracks()).find(track => track.channelId === id); }
async function poll<T>(read: () => Promise<T>, done: (value: T) => boolean, timeoutMs = 12_000): Promise<T> {
  const started = performance.now();
  for (;;) { const value = await read(); if (done(value)) return value;
    if (performance.now() - started > timeoutMs) throw new Error(`poll expired: ${JSON.stringify(value)}`); await wait(50); }
}
async function save(path: string, value: unknown): Promise<void> { await writeFile(path, JSON.stringify(value, null, 2) + '\n'); }
async function loadState(): Promise<State> { return JSON.parse(await readFile(STATE, 'utf8')) as State; }
async function point(cursor: string, trackIndex: number, row: number): Promise<void> {
  await request('cursor.pin', { cursor, pinned: false }); await request('cursor.pinTrack', { cursor, pinned: false });
  await request('cursor.pointTrack', { cursor, trackIndex });
  await poll(() => request<Cursor>('cursor.status', { cursor }), value => value.trackExists && value.trackPosition === trackIndex);
  await request('cursor.pinTrack', { cursor, pinned: true });
  await request('slot.select', { trackIndex, slotIndex: row, mechanism: 'track' });
  await poll(() => request<Cursor>('cursor.status', { cursor }), value => value.slotExists && value.sceneIndex === row);
  await request('cursor.pin', { cursor, pinned: true }); await request('cursor.setStepSize', { cursor, stepSize: GRID });
  await request('cursor.scrollToStep', { cursor, step: 0 });
}
async function configure(restore = false): Promise<void> {
  if (restore) { await writeFile(CONFIG, await readFile(BACKUP)); await unlink(BACKUP); console.log('Restored the exact entry rig configuration.'); return; }
  const original = await readFile(CONFIG), prior = JSON.parse(original.toString()) as Wire;
  await writeFile(BACKUP, original, { flag: 'wx' });
  await save(CONFIG, { ...prior, cacheLifecycleResearch: true, cacheShadowObservers: 0, stamp: 'phase8g-lifecycle-reuse-v1' });
  console.log('Configured root observations and two observer reuse handles. Reload the probe controller.');
}
async function setup(): Promise<void> {
  const before = await tracks(); assert(!before.some(track => track.name.startsWith(PREFIX)), 'unowned reuse fixture already exists');
  const baselineScenes = (await request<{ sceneCount: number }>('scene.count')).sceneCount;
  assert(baselineScenes >= 3, 'fixture needs three existing scenes'); const cursors: Record<string, Cursor> = {};
  for (const cursor of ['0', 'fine']) cursors[cursor] = await request<Cursor>('cursor.status', { cursor });
  const state: State = { baselineIds: before.map(track => track.channelId), baselineScenes,
    baselineSlotsWithContent: (await request<{ slotsWithContent: number }>('rig.scanTracks')).slotsWithContent,
    baselineSelection: await request<Selection>('selection.status'), cursors, ownedTrackId: null };
  await writeFile(STATE, JSON.stringify(state, null, 2) + '\n', { flag: 'wx' }); await request('track.create', { position: before.length });
  const prior = new Set(state.baselineIds), created = await poll(tracks, value => value.some(track => !prior.has(track.channelId)));
  const added = created.filter(track => !prior.has(track.channelId)); assert.equal(added.length, 1, 'new track identity must be unique');
  const track = added[0]!; await save(STATE, { ...state, ownedTrackId: track.channelId }); await request('track.setName', { trackIndex: track.index, name: PREFIX });
  for (let row = 0; row < 3; row++) {
    await request('clip.create', { trackIndex: track.index, slotIndex: row, lengthBeats: 4 });
    await poll(() => request<{ hasContent: boolean }>('slot.status', { trackIndex: track.index, slotIndex: row }), value => value.hasContent);
    await point('0', track.index, row); await request('cursor.setClipMetadata', { cursor: '0', name: `${PREFIX}-${['A', 'B', 'empty'][row]}` });
  }
  await point('0', track.index, 0);
  for (let channel = 0; channel < 16; channel++) await request('cursor.setNotes', { cursor: '0', channel, notes: [[0, 60, 80 + channel, 2 * GRID]] });
  await request('cursor.setNoteProps', { cursor: '0', channel: 0, x: 0, y: 60, props: { chance: .375, isChanceEnabled: false, timbre: -.5 } });
  await point('0', track.index, 1); await request('cursor.scrollToStep', { cursor: '0', step: 1024 });
  for (const channel of [0, 15]) await request('cursor.setNotes', { cursor: '0', channel, notes: [[0, 72, 100, 2 * GRID]] });
  await point('0', track.index, 0); await wait(200);
  console.log('Reuse fixture ready: row 0 has 16 channels, row 1 has two disjoint notes, row 2 is empty.');
}
/** Check both proxies against fixture facts. Equal wrong proxies cannot pass. */
export function checkExpectedFixture(notes: readonly ResearchNote[], row: number, chance = .375, chanceEnabled = false): readonly string[] {
  const issues: string[] = [], addresses = notes.map(note => `${note.channel}:${note.cell}:${note.pitch}`).sort();
  const expected = row === 0 ? Array.from({ length: 16 }, (_, channel) => `${channel}:0:60`).sort()
    : row === 1 ? ['0:1024:72', '15:1024:72'].sort() : [];
  if (JSON.stringify(addresses) !== JSON.stringify(expected)) issues.push('fixture-membership-mismatch');
  if (row === 0) { const first = notes.find(note => note.channel === 0 && note.cell === 0 && note.pitch === 60);
    if (!first) issues.push('fixture-disabled-fields-unavailable');
    else { if (first.fields.chance !== chance || first.fields.isChanceEnabled !== chanceEnabled) issues.push('fixture-disabled-chance-mismatch');
      if (first.fields.rawTimbre !== -.5 || first.fields.timbre !== .25) issues.push('fixture-timbre-units-mismatch'); }
  } return issues;
}
function phase(status: Wire): unknown { return (status.resident as Wire | undefined)?.phase; }
async function settle(track: Track, row: number, subscribed?: boolean, statuses: Wire[] = [], subscriptionMode = 'resume-after-point'): Promise<Wire[]> {
  if (subscribed !== undefined) statuses.push(await shadow('reuseSubscribe', { subscribed }));
  if (subscribed === false && subscriptionMode === 'resume-before-point') {
    await poll(async () => { const status = await shadow('reuseStatus'); statuses.push(status); return status; },
      status => (status.resident as Wire | undefined)?.actualSubscribed === false);
    statuses.push(await shadow('reuseSubscribe', { subscribed: true }));
    await poll(async () => { const status = await shadow('reuseStatus'); statuses.push(status); return status; },
      status => (status.resident as Wire | undefined)?.actualSubscribed === true);
    // Allow control delivery before selection. This delay does not prove content settlement.
    await wait(200);
  }
  statuses.push(await shadow('reusePoint', { trackIndex: track.index, row, expectedChannelId: track.channelId }));
  if (subscribed === false && subscriptionMode === 'resume-after-point') statuses.push(await shadow('reuseSubscribe', { subscribed: true }));
  await poll(async () => { const status = await shadow('reusePoll'); statuses.push(status); return status; },
    value => ['settled', 'retired', 'refused', 'cancelled', 'invalid'].includes(String(phase(value))));
  statuses.push(await shadow('reuseReconcile')); return statuses;
}
async function comparison(): Promise<Wire> {
  let result = await shadow('reuseCompareStart');
  return await poll(async () => { if (['binding-authority', 'scanning', 'pending'].includes(String(result.comparison))) result = await shadow('reuseComparePoll'); return result; },
    value => !['binding-authority', 'scanning', 'pending'].includes(String(value.comparison)), 65_000);
}
async function run(cycles = 10, subscriptionMode = 'resume-after-point'): Promise<void> {
  assert(['resume-after-point', 'resume-before-point'].includes(subscriptionMode), 'invalid subscription mode');
  assert(Number.isInteger(cycles) && cycles > 0 && cycles <= 100, 'cycles must be an integer from 1 through 100');
  const state = await loadState(); assert(state.ownedTrackId); const track = await findTrack(state.ownedTrackId); assert(track); assert.equal(track.name, PREFIX);
  const report: Wire = { started: new Date().toISOString(), researchOnly: true, eligible: false, promotion: 'no-eligibility-claim', subscriptionMode, ownedTrackId: track.channelId, cases: [] };
  try {
    const prior = JSON.parse(await readFile(RESULTS, 'utf8')) as Wire;
    const priorRuns = Array.isArray(prior.priorRuns) ? prior.priorRuns : [];
    delete prior.priorRuns; report.priorRuns = [...priorRuns, prior];
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  const cases = report.cases as Wire[], persist = async (): Promise<void> => await save(RESULTS, report); await persist(); let chance = .375;
  const arm = async (label: string, row: number, before?: () => Promise<unknown>, rebind = true, subscribed?: boolean): Promise<void> => {
    const started = performance.now(), result: Wire = { label, row, expectedChance: chance, researchOnly: true, eligible: false }; cases.push(result); await persist();
    try { result.before = await shadow('reuseStatus'); await shadow('reuseClearTrace'); if (before) result.action = await before();
      if (rebind) { result.statuses = []; await settle(track, row, subscribed, result.statuses as Wire[], subscriptionMode); }
      else { await wait(600); result.statuses = [await shadow('reuseStatus'), await shadow('reuseReconcile')]; }
      const compared = await comparison(); result.comparisonData = compared;
      result.expectedResidentIssues = Array.isArray(compared.residentNotes) ? checkExpectedFixture(compared.residentNotes as ResearchNote[], row, chance) : ['fixture-not-acquired'];
      result.expectedAuthorityIssues = Array.isArray(compared.authorityNotes) ? checkExpectedFixture(compared.authorityNotes as ResearchNote[], row, chance) : ['fixture-not-acquired'];
      const expectedName = `${PREFIX}-${['A', 'B', 'empty'][row]}`;
      result.expectedResidentMetadataIssues = (compared.residentMetadata as Wire | undefined)?.name === expectedName ? [] : ['fixture-clip-name-mismatch'];
      result.expectedAuthorityMetadataIssues = (compared.authorityMetadata as Wire | undefined)?.name === expectedName ? [] : ['fixture-clip-name-mismatch'];
      result.outcome = compared.comparison === 'match' && (result.expectedResidentIssues as string[]).length === 0 && (result.expectedAuthorityIssues as string[]).length === 0
        && (result.expectedResidentMetadataIssues as string[]).length === 0 && (result.expectedAuthorityMetadataIssues as string[]).length === 0
        ? 'content-and-fixture-match' : 'content-or-fixture-failure'; assert.equal(compared.eligible, false, 'research cannot establish eligibility');
      assert.equal(compared.complete, false, 'research cannot establish completeness');
    } catch (error) { result.outcome = 'error'; result.error = error instanceof Error ? `${error.name}: ${error.message}` : String(error); }
    finally { try { result.after = await shadow('reuseStatus'); result.trace = await shadow('reuseTrace'); } catch (error) { result.traceError = String(error); }
      result.wallMs = performance.now() - started; await persist(); console.log(JSON.stringify({ label, outcome: result.outcome, wallMs: result.wallMs })); }
  };
  try { report.hello = await request('contract.hello'); report.info = await shadow('reuseInfo');
    for (let cycle = 0; cycle < cycles; cycle++) { const subscribed = cycle < Math.ceil(cycles / 2);
      for (const [index, row] of [0, 1, 0, 2, 0].entries())
        await arm(`cycle-${cycle}-${subscribed ? 'subscribed' : 'resubscribe'}-${index}-row-${row}`, row, undefined, true, subscribed);
    }
    chance = .625; await arm('field-only-change-while-chance-disabled', 0, async () => { await point('0', track.index, 0);
      return await request('cursor.setNoteProps', { cursor: '0', channel: 0, x: 0, y: 60, props: { chance, isChanceEnabled: false } }); }, false);
    chance = .875; await arm('unsubscribed-field-mutation', 0, async () => { await shadow('reuseSubscribe', { subscribed: false }); await point('0', track.index, 0);
      return await request('cursor.setNoteProps', { cursor: '0', channel: 0, x: 0, y: 60, props: { chance, isChanceEnabled: false } }); }, false);
    await arm('resume-subscription-after-field-mutation', 0, async () => await shadow('reuseSubscribe', { subscribed: true }), false);
    await arm('repoint-after-unsubscribed-mutation', 0);
    await arm('rapid-point-cancel-and-recovery', 0, async () => { const transitions: Wire[] = [];
      for (const row of [1, 0, 2, 1, 0]) {
        transitions.push(await shadow('reusePoint', { trackIndex: track.index, row, expectedChannelId: track.channelId }));
        await poll(async () => { const status = await shadow('reusePoll'); transitions.push(status); return status; },
          status => ['settling', 'settled', 'retired'].includes(String(phase(status))));
        assert.equal((transitions.at(-1)!.resident as Wire).sceneIndex, row, 'rapid arm must select its target row');
      }
      transitions.push(await shadow('reuseCancel'));
      return transitions; });
    await arm('interrupted-comparison-and-recovery', 0, async () => {
      const transitions = [await shadow('reuseCompareStart')];
      await poll(async () => { const status = await shadow('reuseComparePoll'); transitions.push(status); return status; },
        status => ['scanning', 'match', 'mismatch', 'refused', 'window-changed'].includes(String(status.comparison)), 12_000);
      assert.equal(transitions.at(-1)!.comparison, 'scanning', 'interruption must occur during an active scan');
      transitions.push(await shadow('reusePoint', { trackIndex: track.index, row: 1, expectedChannelId: track.channelId }));
      const oldPoll = await shadow('reuseComparePoll'); transitions.push(oldPoll);
      assert.equal(oldPoll.scanComplete, false, 'old comparison must not publish after repoint');
      assert.equal(oldPoll.comparison, 'not-run', 'repoint clears the old comparison');
      transitions.push(await shadow('reuseCancel')); return transitions;
    });
  } catch (error) { report.error = error instanceof Error ? `${error.name}: ${error.message}` : String(error); throw error; }
  finally { try { await shadow('reuseSubscribe', { subscribed: true }); await shadow('reuseCancel'); await point('0', track.index, 0);
      await request('cursor.setNoteProps', { cursor: '0', channel: 0, x: 0, y: 60, props: { chance: .375, isChanceEnabled: false, timbre: -.5 } }); report.fixtureRestored = true;
    } catch (error) { report.fixtureRestoreError = String(error); }
    report.ended = new Date().toISOString(); report.failures = cases.filter(value => value.outcome !== 'content-and-fixture-match').map(value => ({ label: value.label, outcome: value.outcome })); await persist(); }
  console.log(`Research cases retained at ${RESULTS}. Failures are evidence; no cache eligibility is claimed.`);
}
/** Check sparse data before an independent scan. This is a fixture check, not cache admission. */
export function checkSparseFixture(result: Wire, row: number, chance = .375, chanceEnabled = false): readonly string[] {
  const issues = Array.isArray(result.sparseNotes) ? [...checkExpectedFixture(result.sparseNotes as ResearchNote[], row, chance, chanceEnabled)] : ['sparse-not-acquired'];
  if ((result.sparseMetadata as Wire | undefined)?.name !== `${PREFIX}-${['A', 'B', 'empty'][row]}`) issues.push('sparse-clip-name-mismatch');
  if (result.sparseObservationCurrent !== true) issues.push('sparse-window-not-current');
  for (const pair of [['sparseRevisionBefore', 'sparseRevisionAfter'], ['sparseBindingBefore', 'sparseBindingAfter'], ['sparseCallbacksBefore', 'sparseCallbacksAfter']])
    if (typeof result[pair[0]!] !== 'number' || result[pair[0]!] !== result[pair[1]!]) issues.push(`${pair[0]}-changed`);
  if (result.fullComparisonSeedsRecorder !== false) issues.push('scan-seeding-not-disabled');
  if (result.observerKind !== 'StepDataChangedCallback' || result.observerRegistration !== 'addStepDataObserver') issues.push('wrong-observer-family');
  if (result.complete !== false || result.eligible !== false) issues.push('research-authority-claim');
  return issues;
}
async function drainSparse(): Promise<Wire> {
  return await poll(() => shadow('reuseReconcile'), value => {
    const resident = value.resident as Wire | undefined;
    return resident?.pendingHints === 0 || resident?.phase !== 'settled';
  });
}
class ReplayFailure extends Error {
  constructor(message: string, readonly evidence: readonly Wire[]) { super(message); }
}
async function runReplay(cycles = 2): Promise<void> {
  assert(Number.isInteger(cycles) && cycles > 0 && cycles <= 20, 'replay cycles must be an integer from 1 through 20');
  const state = await loadState(); assert(state.ownedTrackId); const track = await findTrack(state.ownedTrackId); assert(track); assert.equal(track.name, PREFIX);
  const output = '/tmp/ghostnote-8g-replay-v3-results.json';
  const info = await shadow('reuseInfo');
  assert.equal(info.instrumentationRevision, '8g-reuse-sparse-replay-v3');
  assert.equal(info.observerKind, 'StepDataChangedCallback'); assert.equal(info.observerRegistration, 'addStepDataObserver');
  assert.equal(info.fullComparisonSeedsRecorder, false);
  const report: Wire = { started: new Date().toISOString(), researchOnly: true, complete: false, eligible: false,
    instrumentationRevision: info.instrumentationRevision, info, hello: await request('contract.hello'), cases: [] };
  try { const prior = JSON.parse(await readFile(output, 'utf8')) as Wire;
    const priorRuns = Array.isArray(prior.priorRuns) ? prior.priorRuns : []; delete prior.priorRuns; report.priorRuns = [...priorRuns, prior];
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  const cases = report.cases as Wire[], persist = async (): Promise<void> => await save(output, report);
  let chance = .375, chanceEnabled = false;
  const bind = async (row: number): Promise<Wire[]> => {
    const statuses = [await shadow('reusePoint', { trackIndex: track.index, row, expectedChannelId: track.channelId })];
    await poll(async () => { const status = await shadow('reusePoll'); statuses.push(status); return status; },
      value => ['settled', 'retired', 'refused'].includes(String(phase(value))));
    return statuses;
  };
  const resetTo = async (row: number): Promise<Wire[]> => {
    const before = await shadow('reuseStatus'), actual = before.resident as Wire;
    const firstCanary = actual.trackId === track.channelId && actual.sceneIndex === 0 ? 1 : 0;
    const actions: Wire[] = [await shadow('reuseCancel')];
    const visitCanary = async (canary: number): Promise<void> => {
      actions.push({ kind: 'populated-canary-binding', row: canary, statuses: await bind(canary) });
      const sparse = await drainSparse(), issues = checkSparseFixture(sparse, canary, chance, chanceEnabled);
      actions.push({ kind: 'populated-canary-sparse', row: canary, sparse, issues });
      if (issues.length > 0) throw new ReplayFailure('populated canary did not replay before target acquisition', actions);
    };
    await visitCanary(firstCanary);
    if (firstCanary === row) await visitCanary(firstCanary === 0 ? 1 : 0);
    actions.push({ kind: 'target-after-canary', row, statuses: await bind(row) }); return actions;
  };
  const arm = async (label: string, row: number, prepare: () => Promise<Wire[]>, extra?: (sparse: Wire, before: Wire) => readonly string[]): Promise<void> => {
    const started = performance.now(), result: Wire = { label, row, expectedChance: chance, expectedChanceEnabled: chanceEnabled,
      researchOnly: true, complete: false, eligible: false }; cases.push(result); await persist();
    try {
      result.before = await shadow('reuseStatus'); await shadow('reuseClearTrace'); result.actions = await prepare();
      result.expectedChance = chance; result.expectedChanceEnabled = chanceEnabled;
      const sparse = await drainSparse(); result.sparse = sparse;
      result.sparseIssues = [...checkSparseFixture(sparse, row, chance, chanceEnabled), ...(extra?.(sparse, result.before as Wire) ?? [])];
      await persist();
      const compared = await comparison(); result.comparisonData = compared;
      result.expectedResidentIssues = Array.isArray(compared.residentNotes) ? checkExpectedFixture(compared.residentNotes as ResearchNote[], row, chance, chanceEnabled) : ['fixture-not-acquired'];
      result.expectedAuthorityIssues = Array.isArray(compared.authorityNotes) ? checkExpectedFixture(compared.authorityNotes as ResearchNote[], row, chance, chanceEnabled) : ['fixture-not-acquired'];
      result.outcome = (result.sparseIssues as string[]).length === 0 && compared.comparison === 'match'
        && compared.sparseMatchesResidentScan === true && compared.sparseMatchesAuthorityScan === true
        && (result.expectedResidentIssues as string[]).length === 0 && (result.expectedAuthorityIssues as string[]).length === 0
        ? 'sparse-and-independent-match' : 'sparse-or-independent-failure';
      assert.equal(compared.eligible, false); assert.equal(compared.complete, false);
    } catch (error) { result.outcome = 'error'; result.error = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      if (error instanceof ReplayFailure) result.failedActions = error.evidence; }
    finally { try { result.after = await shadow('reuseStatus'); result.trace = await shadow('reuseTrace'); } catch (error) { result.traceError = String(error); }
      result.wallMs = performance.now() - started; await persist(); console.log(JSON.stringify({ label, outcome: result.outcome, wallMs: result.wallMs })); }
  };
  try {
    await shadow('reuseSubscribe', { subscribed: true });
    for (let cycle = 0; cycle < cycles; cycle++) for (const [index, row] of [0, 1, 0, 2, 0].entries()) {
      await arm(`reset-canary-target-${cycle}-${index}-row-${row}`, row, async () => await resetTo(row));
      await arm(`warm-same-target-${cycle}-${index}-row-${row}`, row, async () => await bind(row), sparse =>
        (sparse.resident as Wire).recorderPreserved === true ? [] : ['same-target-recorder-not-preserved']);
    }
    await arm('sparse-field-only-disabled-chance', 0, async () => {
      await point('0', track.index, 0); chance = .625;
      await request('cursor.setNoteProps', { cursor: '0', channel: 0, x: 0, y: 60, props: { chance, isChanceEnabled: false } }); await wait(200); return [];
    });
    // Enable-only changes must invalidate fields even when membership is unchanged.
    chanceEnabled = true;
    await arm('sparse-enable-only-chance-on', 0, async () => {
      await request('cursor.setNoteProps', { cursor: '0', channel: 0, x: 0, y: 60, props: { isChanceEnabled: true } }); await wait(200); return [];
    }, (sparse, before) => Number((sparse.resident as Wire).callbacks) > Number((before.resident as Wire).callbacks) ? [] : ['enable-only-invalidation-missing']);
    chanceEnabled = false;
    await arm('sparse-enable-only-chance-off', 0, async () => {
      await request('cursor.setNoteProps', { cursor: '0', channel: 0, x: 0, y: 60, props: { isChanceEnabled: false } }); await wait(200); return [];
    }, (sparse, before) => Number((sparse.resident as Wire).callbacks) > Number((before.resident as Wire).callbacks) ? [] : ['enable-only-invalidation-missing']);
    await arm('physical-old-coordinate-hints-reread-current-A', 0, async () => {
      const actions: Wire[] = [{ kind: 'B-binding', statuses: await bind(1) }];
      actions.push({ kind: 'B-sparse', sparse: await drainSparse() }); actions.push({ kind: 'A-binding', statuses: await bind(0) }); return actions;
    }, sparse => {
      const changed = sparse.changedCoordinates as { cell: number; pitch: number; notes: unknown[] }[] | undefined;
      return changed?.some(value => value.cell === 1024 && value.pitch === 72 && value.notes.length === 0)
        ? [] : ['old-coordinate-current-empty-read-not-retained'];
    });
    await arm('cancelled-transition-sparse-recovery', 0, async () => {
      const actions = [await shadow('reusePoint', { trackIndex: track.index, row: 1, expectedChannelId: track.channelId })];
      await poll(async () => { const status = await shadow('reusePoll'); actions.push(status); return status; },
        value => ['settling', 'settled', 'retired'].includes(String(phase(value))));
      actions.push(await shadow('reuseCancel')); actions.push({ kind: 'canary-recovery', actions: await resetTo(0) }); return actions;
    });
    await arm('cancelled-scan-before-sparse-recovery', 0, async () => {
      const actions = [await shadow('reuseCompareStart')];
      await poll(async () => { const status = await shadow('reuseComparePoll'); actions.push(status); return status; },
        value => ['scanning', 'match', 'mismatch', 'refused', 'window-changed'].includes(String(value.comparison)), 12_000);
      const scanning = actions.at(-1)!;
      if (scanning.comparison !== 'scanning') throw new ReplayFailure('scan did not reach an active interruption window', actions);
      actions.push(await shadow('reuseCancel'));
      const late = await shadow('reuseComparePoll'); actions.push(late);
      if (late.scanComplete !== false || late.comparison !== 'cancelled' || Number(late.revision) <= Number(scanning.revision))
        throw new ReplayFailure('cancelled scan published or kept its old revision', actions);
      actions.push({ kind: 'canary-recovery', actions: await resetTo(0) }); return actions;
    });
  } finally {
    try { await shadow('reuseSubscribe', { subscribed: true }); await shadow('reuseCancel'); await point('0', track.index, 0);
      await request('cursor.setNoteProps', { cursor: '0', channel: 0, x: 0, y: 60, props: { chance: .375, isChanceEnabled: false, timbre: -.5 } }); report.fixtureRestored = true;
    } catch (error) { report.fixtureRestoreError = String(error); }
    report.ended = new Date().toISOString(); report.failures = cases.filter(value => value.outcome !== 'sparse-and-independent-match').map(value => ({ label: value.label, outcome: value.outcome })); await persist();
  }
  console.log(`StepData sparse replay research retained at ${output}. No cache eligibility is claimed.`);
}
async function captureRoot(label: string): Promise<void> {
  assert(label, 'capture needs an event label'); let report: { researchOnly: true; identityDetectionProved: false; captures: Wire[] };
  try { report = JSON.parse(await readFile(ROOT_RESULTS, 'utf8')) as typeof report; }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; report = { researchOnly: true, identityDetectionProved: false, captures: [] }; }
  report.captures.push({ label, capturedAt: new Date().toISOString(), hello: await request('contract.hello'), snapshot: await shadow('rootSnapshot'), trace: await shadow('rootTrace') });
  await save(ROOT_RESULTS, report); console.log(`Captured root signals: ${label}`);
}
async function cleanup(options: CleanupArguments): Promise<void> {
  const state = await loadState(), report: Wire = { started: new Date().toISOString(), cleaned: false, entryState: state };
  await reserveCleanupOutput(options, report);
  try { await shadow('reuseCancel');
  if (state.ownedTrackId) { const track = await findTrack(state.ownedTrackId); if (track) { assert.equal(track.name, PREFIX, 'cleanup refuses a renamed fixture track');
      await request('track.delete', { trackIndex: track.index }); await poll(() => findTrack(track.channelId), value => value === undefined); } }
  for (const [cursor, prior] of Object.entries(state.cursors)) {
    await request('cursor.pin', { cursor, pinned: false }); await request('cursor.pinTrack', { cursor, pinned: false });
    if (prior.trackExists && prior.slotExists) await point(cursor, prior.trackPosition, prior.sceneIndex);
    await request('cursor.setStepSize', { cursor, stepSize: cursor === '0' ? .25 : GRID }); await request('cursor.scrollToStep', { cursor, step: 0 });
    await request('cursor.pin', { cursor, pinned: prior.isPinned ?? false }); await request('cursor.pinTrack', { cursor, pinned: prior.cursorTrackPinned ?? false });
  }
  if (state.baselineSelection.trackIndex >= 0 && state.baselineSelection.slotIndex >= 0) await request('slot.select', { ...state.baselineSelection, mechanism: 'slot' });
  await verifyInventory(state);
  Object.assign(report, { cleaned: true, ended: new Date().toISOString(), tracks: await tracks(), selection: await request('selection.status'),
    cursors: { writer: await request('cursor.status', { cursor: '0' }), reader: await request('cursor.status', { cursor: 'fine' }) } });
  await save(options.output, report);
  console.log(`Fixture removed. Cleanup retained at ${options.output}. Verify selection and cursors after normal runtime reload.`);
  } catch (error) { report.error = String(error); report.ended = new Date().toISOString();
    if (options.explicitOutput) await save(options.output, report); throw error; }
}
async function verifyInventory(state: State): Promise<void> {
  assert.deepEqual((await tracks()).map(track => track.channelId), state.baselineIds);
  assert.equal((await request<{ sceneCount: number }>('scene.count')).sceneCount, state.baselineScenes);
  assert.equal((await request<{ slotsWithContent: number }>('rig.scanTracks')).slotsWithContent, state.baselineSlotsWithContent);
}
async function verifyCleanup(options: CleanupArguments): Promise<void> {
  const state = await loadState(), report: Wire = { started: new Date().toISOString(), verified: false, entryState: state,
    stateRetentionPolicy: options.keepState ? 'retain' : 'remove-after-verification' };
  await reserveCleanupOutput(options, report);
  try { const hello = await request<Wire>('contract.hello'); assert.equal(hello.runtimeProfile, 'normal-v1'); await verifyInventory(state);
  const cursors: Record<string, Cursor> = {};
  for (const [cursor, prior] of Object.entries(state.cursors)) { const now = await request<Cursor>('cursor.status', { cursor }); cursors[cursor] = now;
    for (const key of ['trackExists', 'slotExists', 'trackPosition', 'sceneIndex', 'isPinned', 'cursorTrackPinned'] as const) assert.equal(now[key], prior[key], `${cursor}.${key}`); }
  const selection = await request<Selection>('selection.status');
  for (const key of ['trackIndex', 'slotIndex', 'mixerTrackIndex'] as const) assert.equal(selection[key], state.baselineSelection[key], `selection.${key}`);
  Object.assign(report, { verified: true, ended: new Date().toISOString(), hello, cursors, selection, baselineIds: state.baselineIds, sceneCount: state.baselineScenes });
  await save(options.output, report);
  if (!options.keepState) await unlink(STATE);
  console.log(`Normal runtime, inventory, selection, and cursor pins match the entry baseline. Verification retained at ${options.output}.`);
  } catch (error) { report.error = String(error); report.ended = new Date().toISOString();
    if (options.explicitOutput) await save(options.output, report); throw error; }
}
interface ResearchVerification { readonly rootCaptures: number; readonly reuseCases: number; readonly matches: number; readonly failures: number }
function wire(value: unknown, label: string): Wire {
  assert(value !== null && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
  return value as Wire;
}
/** Recompute retained evidence. Expected measurement failures remain valid evidence. */
export function verifyResearchReports(rootValue: unknown, reuseValue: unknown, cleanupValue: unknown): ResearchVerification {
  const roots = wire(rootValue, 'root report'), reuse = wire(reuseValue, 'reuse report'), cleanup = wire(cleanupValue, 'cleanup');
  assert.equal(roots.researchOnly, true); assert.equal(roots.identityDetectionProved, false); assert(Array.isArray(roots.captures));
  for (const value of roots.captures) {
    const capture = wire(value, 'root capture');
    for (const key of ['snapshot', 'trace']) {
      const observation = wire(capture[key], `capture.${key}`);
      assert.equal(observation.identityDetectionProved, false); assert.equal(observation.purpose, 'root-identity-research');
      if (observation.researchOnly !== undefined) assert.equal(observation.researchOnly, true);
    }
  }
  assert.equal(cleanup.verified, true); assert.equal(wire(cleanup.hello, 'cleanup hello').runtimeProfile, 'normal-v1');
  assert(Array.isArray(cleanup.baselineIds) && cleanup.baselineIds.every(id => typeof id === 'string' && id.length > 0));
  assert.equal(new Set(cleanup.baselineIds).size, cleanup.baselineIds.length, 'cleanup IDs must be unique');
  let matches = 0, failures = 0, count = 0;
  const reports = [reuse, ...(Array.isArray(reuse.priorRuns) ? reuse.priorRuns.map(value => wire(value, 'prior run')) : [])];
  for (const report of reports) {
    assert.equal(report.researchOnly, true); assert.equal(report.eligible, false); assert(Array.isArray(report.cases));
    for (const value of report.cases) {
      count++; const arm = wire(value, 'reuse case'); assert.equal(arm.researchOnly, true); assert.equal(arm.eligible, false);
      assert(Number.isInteger(arm.row) && Number(arm.row) >= 0 && Number(arm.row) <= 2, 'fixture row must be 0, 1, or 2');
      assert(typeof arm.expectedChance === 'number' && Number.isFinite(arm.expectedChance), 'fixture chance must be finite');
      if (arm.comparisonData !== undefined) {
        const result = wire(arm.comparisonData, 'comparison'); assert.equal(result.eligible, false); assert.equal(result.complete, false);
        if (result.comparison === 'match') {
          assert(Array.isArray(result.residentNotes) && Array.isArray(result.authorityNotes), 'a match needs both acquired note lists');
          const ordered = (notes: ResearchNote[]): ResearchNote[] => [...notes].sort((a, b) => a.channel - b.channel || a.cell - b.cell || a.pitch - b.pitch);
          assert.deepEqual(ordered(result.residentNotes as ResearchNote[]), ordered(result.authorityNotes as ResearchNote[]), 'a match needs equal typed note fields');
          assert.deepEqual(result.residentMetadata, result.authorityMetadata, 'a match needs equal clip metadata');
        }
        const residentIssues = Array.isArray(result.residentNotes) ? checkExpectedFixture(result.residentNotes as ResearchNote[], Number(arm.row), arm.expectedChance) : ['fixture-not-acquired'];
        const authorityIssues = Array.isArray(result.authorityNotes) ? checkExpectedFixture(result.authorityNotes as ResearchNote[], Number(arm.row), arm.expectedChance) : ['fixture-not-acquired'];
        const expectedName = `${PREFIX}-${['A', 'B', 'empty'][Number(arm.row)]}`;
        const residentMetadataIssues = (result.residentMetadata as Wire | undefined)?.name === expectedName ? [] : ['fixture-clip-name-mismatch'];
        const authorityMetadataIssues = (result.authorityMetadata as Wire | undefined)?.name === expectedName ? [] : ['fixture-clip-name-mismatch'];
        assert.deepEqual(arm.expectedResidentIssues, residentIssues); assert.deepEqual(arm.expectedAuthorityIssues, authorityIssues);
        assert.deepEqual(arm.expectedResidentMetadataIssues, residentMetadataIssues); assert.deepEqual(arm.expectedAuthorityMetadataIssues, authorityMetadataIssues);
        const outcome = result.comparison === 'match' && residentIssues.length === 0 && authorityIssues.length === 0
          && residentMetadataIssues.length === 0 && authorityMetadataIssues.length === 0 ? 'content-and-fixture-match' : 'content-or-fixture-failure';
        assert.equal(arm.outcome, outcome, 'stored outcome must follow typed fixture checks');
        if (outcome === 'content-and-fixture-match') { assert.equal(result.scanComplete, true); matches++; } else failures++;
      } else { assert.equal(arm.outcome, 'error', 'a case without a comparison must retain its error'); assert.equal(typeof arm.error, 'string'); failures++; }
      if (arm.label === 'interrupted-comparison-and-recovery' && Array.isArray(arm.action)) {
        const transitions = arm.action.map(value => wire(value, 'interruption transition'));
        const scanning = transitions.findIndex(value => value.comparison === 'scanning'); assert(scanning >= 0, 'interruption must have an active scan');
        const after = transitions.slice(scanning + 1); assert(after.length >= 2);
        for (const status of after) {
          assert.equal(status.scanComplete, false, 'interrupted revision must not publish');
          assert.notEqual(status.comparison, 'match'); assert.notEqual(status.comparison, 'mismatch');
          assert(typeof status.revision === 'number' && status.revision > Number(transitions[scanning].revision), 'interruption must advance revision');
        }
      }
    }
  }
  return { rootCaptures: roots.captures.length, reuseCases: count, matches, failures };
}
async function verifyArtifacts(): Promise<void> {
  const base = new URL('../../../context/evidence/data/phase8g-lifecycle-reuse/', import.meta.url);
  const manifest = wire(JSON.parse(await readFile(new URL('manifest.json', base), 'utf8')), 'manifest');
  const files = wire(manifest.files, 'manifest files'), reports = new Map<string, unknown>();
  for (const [key, value] of Object.entries(files)) {
    const file = wire(value, `manifest.${key}`);
    assert(typeof file.file === 'string' && /^[a-zA-Z0-9_-]+\.json\.gz$/.test(file.file), 'artifact filename must stay inside the evidence directory');
    const raw = gunzipSync(await readFile(new URL(file.file, base)));
    assert.equal(raw.byteLength, file.uncompressedBytes, `${key} byte length`);
    assert.equal(createHash('sha256').update(raw).digest('hex'), file.uncompressedSha256, `${key} hash`);
    reports.set(file.file, JSON.parse(raw.toString()));
  }
  for (const name of ['root-signals.json.gz', 'observer-reuse.json.gz', 'cleanup.json.gz']) assert(reports.has(name), `missing artifact ${name}`);
  const summary = verifyResearchReports(reports.get('root-signals.json.gz'), reports.get('observer-reuse.json.gz'), reports.get('cleanup.json.gz'));
  console.log(`Research artifacts pass: ${summary.rootCaptures} root captures, ${summary.matches} reuse matches, ${summary.failures} retained failures (${summary.reuseCases} cases). No cache eligibility is claimed.`);
}
/** Verify the new StepData record without changing the retained NoteStep artifacts. */
export function verifyReplayReport(value: unknown): { matches: number; failures: number } {
  const report = wire(value, 'replay report'); let matches = 0, failures = 0;
  const reports = [report, ...(Array.isArray(report.priorRuns) ? report.priorRuns.map(value => wire(value, 'prior replay')) : [])];
  const ordered = (notes: ResearchNote[]): ResearchNote[] => [...notes].sort((a, b) => a.channel - b.channel || a.cell - b.cell || a.pitch - b.pitch);
  for (const run of reports) {
    assert.equal(run.instrumentationRevision, '8g-reuse-sparse-replay-v3'); assert.equal(run.researchOnly, true);
    assert.equal(run.complete, false); assert.equal(run.eligible, false); assert(Array.isArray(run.cases));
    for (const value of run.cases) {
      const arm = wire(value, 'replay case'); assert.equal(arm.complete, false); assert.equal(arm.eligible, false);
      const checkActions = (values: unknown[]): void => {
        for (const value of values) {
          const action = wire(value, 'replay action');
          if (action.kind === 'populated-canary-sparse') assert.deepEqual(action.issues,
            checkSparseFixture(wire(action.sparse, 'canary sparse'), Number(action.row), Number(arm.expectedChance), arm.expectedChanceEnabled === true));
          if (Array.isArray(action.actions)) checkActions(action.actions);
        }
      };
      if (Array.isArray(arm.actions)) checkActions(arm.actions);
      if (Array.isArray(arm.failedActions)) checkActions(arm.failedActions);
      if (arm.label === 'cancelled-scan-before-sparse-recovery' && Array.isArray(arm.actions)) {
        const actions = arm.actions.map(value => wire(value, 'cancelled scan action'));
        const index = actions.findIndex(action => action.comparison === 'scanning'); assert(index >= 0);
        assert(actions.length > index + 2);
        for (const action of actions.slice(index + 1, index + 3)) {
          assert.equal(action.scanComplete, false); assert.equal(action.comparison, 'cancelled');
          assert(Number(action.revision) > Number(actions[index].revision));
        }
      }
      if (arm.outcome === 'error') { assert.equal(typeof arm.error, 'string'); failures++; continue; }
      const sparse = wire(arm.sparse, 'sparse observation'), compared = wire(arm.comparisonData, 'replay comparison');
      const row = Number(arm.row), chance = Number(arm.expectedChance), enabled = arm.expectedChanceEnabled === true;
      assert(Number.isInteger(row) && row >= 0 && row <= 2 && Number.isFinite(chance));
      const sparseIssues = [...checkSparseFixture(sparse, row, chance, enabled)];
      if (String(arm.label).startsWith('warm-same-target-') && (sparse.resident as Wire).recorderPreserved !== true) sparseIssues.push('same-target-recorder-not-preserved');
      if (String(arm.label).startsWith('sparse-enable-only-')
        && Number((sparse.resident as Wire).callbacks) <= Number((wire(arm.before, 'before').resident as Wire).callbacks)) sparseIssues.push('enable-only-invalidation-missing');
      if (arm.label === 'physical-old-coordinate-hints-reread-current-A') {
        const changed = sparse.changedCoordinates as { cell: number; pitch: number; notes: unknown[] }[] | undefined;
        if (!changed?.some(value => value.cell === 1024 && value.pitch === 72 && value.notes.length === 0)) sparseIssues.push('old-coordinate-current-empty-read-not-retained');
      }
      assert.deepEqual(arm.sparseIssues, sparseIssues);
      const resident = Array.isArray(compared.residentNotes) ? compared.residentNotes as ResearchNote[] : undefined;
      const authority = Array.isArray(compared.authorityNotes) ? compared.authorityNotes as ResearchNote[] : undefined;
      const residentIssues = resident ? checkExpectedFixture(resident, row, chance, enabled) : ['fixture-not-acquired'];
      const authorityIssues = authority ? checkExpectedFixture(authority, row, chance, enabled) : ['fixture-not-acquired'];
      assert.deepEqual(arm.expectedResidentIssues, residentIssues); assert.deepEqual(arm.expectedAuthorityIssues, authorityIssues);
      assert.equal(compared.complete, false); assert.equal(compared.eligible, false); assert.equal(compared.fullComparisonSeedsRecorder, false);
      if (compared.scanComplete === true) {
        assert(Array.isArray(compared.residentSparseNotesBeforeScan) && resident && authority);
        const before = ordered(compared.residentSparseNotesBeforeScan as ResearchNote[]);
        assert.equal(compared.sparseMatchesResidentScan, isDeepStrictEqual(before, ordered(resident)));
        assert.equal(compared.sparseMatchesAuthorityScan, isDeepStrictEqual(before, ordered(authority)));
        if (compared.comparison === 'match') { assert.deepEqual(ordered(resident), ordered(authority)); assert.deepEqual(compared.residentMetadata, compared.authorityMetadata); }
      }
      const outcome = sparseIssues.length === 0 && compared.comparison === 'match' && compared.sparseMatchesResidentScan === true
        && compared.sparseMatchesAuthorityScan === true && residentIssues.length === 0 && authorityIssues.length === 0
        ? 'sparse-and-independent-match' : 'sparse-or-independent-failure';
      assert.equal(arm.outcome, outcome); if (outcome === 'sparse-and-independent-match') matches++; else failures++;
    }
  }
  return { matches, failures };
}
async function main(): Promise<void> {
  const command = process.argv[2];
  if (command === 'configure') await configure(); else if (command === 'restore-config') await configure(true);
  else if (command === 'setup') await setup(); else if (command === 'run') await run(process.argv[3] === undefined ? 10 : Number(process.argv[3]), process.argv[4]);
  else if (command === 'run-replay') await runReplay(process.argv[3] === undefined ? 2 : Number(process.argv[3]));
  else if (command === 'capture') await captureRoot(process.argv.slice(3).join(' '));
  else if (command === 'clear-root-trace') console.log(JSON.stringify(await shadow('rootClearTrace')));
  else if (command === 'cleanup') await cleanup(parseCleanupArguments(command, process.argv.slice(3)));
  else if (command === 'verify-cleanup') await verifyCleanup(parseCleanupArguments(command, process.argv.slice(3)));
  else if (command === 'verify-replay') {
    const summary = verifyReplayReport(JSON.parse(await readFile(process.argv[3] ?? '/tmp/ghostnote-8g-replay-v3-results.json', 'utf8')));
    console.log(`StepData replay checks pass: ${summary.matches} sparse matches, ${summary.failures} retained failures; no eligibility claim.`);
  }
  else if (command === 'verify-artifacts') await verifyArtifacts();
  else if (command === 'info') console.log(JSON.stringify({ root: await shadow('rootSnapshot'), reuse: await shadow('reuseInfo') }));
  else throw new Error('usage: phase8g-lifecycle-reuse.ts configure | restore-config | setup | run [cycles] [resume-before-point] | run-replay [cycles] | verify-replay [file] | capture <label> | clear-root-trace | cleanup [output] | verify-cleanup [output] [--keep-state] | verify-artifacts | info');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => bridge.disconnect());
