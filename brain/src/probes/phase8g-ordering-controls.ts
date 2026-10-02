/** Sample existing diagnostic reads during native project switches. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { BridgeClient } from '../client.js';
import { identityEndpoint } from './phase8g-identity-fence.js';
import { checkExpectedFixture } from './phase8g-lifecycle-reuse.js';
import { NO_CHAIN_ROOT } from './phase8g-no-chain-controls.js';
import { ACQUIRED_FIELDS, MUTATION_MARKER, checkMutationComparison, collectMutationRegistry, verifyMutationRegistry } from './phase8g-shadow-mutations.js';
import type { NormalizedValue, ShadowNote } from './phase8g-shadow-cache-lib.js';

type Wire = Record<string, unknown>;
interface Track { index: number; channelId: string; name: string }
export const ORDERING_MAX_SAMPLES = 400;
export const ORDERING_SAMPLE_MS = 30_000;
export const ORDERING_POLL_CADENCE_MS = 10_000;
export function orderingPollDue(elapsedMs: number, previousPollMs: number | undefined, cadenceMs = ORDERING_POLL_CADENCE_MS): boolean {
  assert(Number.isFinite(elapsedMs) && elapsedMs >= 0);
  assert(previousPollMs === undefined || (Number.isFinite(previousPollMs) && previousPollMs >= 0 && previousPollMs <= elapsedMs));
  assert(Number.isFinite(cadenceMs) && cadenceMs > 0);
  return previousPollMs === undefined || elapsedMs - previousPollMs >= cadenceMs;
}
const bridge = new BridgeClient();
const wait = async (ms = 50): Promise<void> => await new Promise(resolve => setTimeout(resolve, ms));
const read = async (path: string): Promise<Wire> => JSON.parse(await readFile(path, 'utf8')) as Wire;
async function save(path: string, value: Wire, exclusive = false): Promise<void> {
  await writeFile(path, JSON.stringify(value, null, 2) + '\n', exclusive ? { flag: 'wx' } : undefined);
}
async function request(method: string, params?: Wire): Promise<Wire> { return await bridge.request(method, params) as Wire; }
async function shadow(operation: string, params: Wire = {}): Promise<Wire> { return await request('cache.shadow', { operation, ...params }); }
function count(value: unknown): number { assert(typeof value === 'number' && Number.isSafeInteger(value) && value >= 0); return value; }
function rootValue(root: Wire, key: string): unknown { const value = (root.current as Wire)?.[key] as Wire | undefined; return value?.status === 'read' ? value.value : undefined; }
function stamp(root: Wire): Wire {
  return { nonce: root.extensionInitNonce, epoch: root.automaticIdentityEpoch, sequence: root.sequenceAfterRead,
    projectExists: rootValue(root, 'projectExists'), root: rootValue(root, 'rootChannelId'),
    master: rootValue(root, 'masterChannelId'), witnesses: (root.existingChainWitnesses as Wire)?.candidates };
}
function noOutput(value: Wire): boolean {
  // A historical snapshot does not supply current authority.
  return ['diagnosticSnapshot', 'authorityNotes', 'authoritativeSnapshot'].every(key => value[key] === undefined);
}
function closed(value: Wire): void { assert.equal(value.complete, false); assert.equal(value.eligible, false); }
function expectedRows(witness: Wire): ShadowNote[][] {
  const rows = (witness.before as Wire).notes as Wire[];
  return [0, 1, 2].map(row => {
    const raw = rows.find(value => value.row === row); assert(raw && Array.isArray(raw.notes));
    return (raw.notes as Wire[]).map(note => {
      const fields: Record<string, NormalizedValue> = {};
      for (const field of ACQUIRED_FIELDS) {
        if (['rawDuration', 'durationCells', 'rawGain', 'rawTimbre'].includes(field)) continue;
        const value = note[field]; assert(value === null || ['number', 'boolean', 'string'].includes(typeof value));
        fields[field] = value as NormalizedValue;
      }
      fields.rawDuration = fields.duration; fields.durationCells = Math.max(1, Math.floor(Number(fields.duration) * 512 + .5));
      fields.duration = Number(fields.durationCells) / 512; fields.rawGain = fields.gain;
      fields.rawTimbre = fields.timbre; fields.timbre = (Number(fields.rawTimbre) + 1) / 2;
      return { channel: Number(note.channel), cell: Number(note.x), pitch: Number(note.y), fields };
    });
  });
}
/** Changed brackets are transition observations. Only retained output is tested as current. */
export function summarizeOrderingSamples(samples: Wire[], id: string, expected: ShadowNote[]): Wire {
  const violations: Wire[] = []; let crossedB = 0, changedBrackets = 0, outputSamples = 0, errors = 0, retiredPolls = 0;
  let historicalMismatchLabels = 0, historicalSnapshotSamples = 0;
  for (const [index, sample] of samples.entries()) {
    if (sample.error !== undefined) { errors++; continue; }
    const before = sample.before as Wire, after = sample.after as Wire, status = sample.status as Wire, result = sample.result as Wire;
    assert(before && after && status); closed(status); if (result) closed(result);
    if ([rootValue(before, 'rootChannelId'), rootValue(after, 'rootChannelId')].includes(NO_CHAIN_ROOT)) crossedB++;
    const changed = JSON.stringify(stamp(before)) !== JSON.stringify(stamp(after))
      || before.callbacksChangedDuringRead === true || after.callbacksChangedDuringRead === true;
    if (changed) changedBrackets++;
    if (!result) continue;
    if (result.historicalSnapshot !== undefined) historicalSnapshotSamples++;
    if (result.comparison === 'window-changed' && noOutput(result)) retiredPolls++;
    const output = !noOutput(result);
    if (String(result.comparison).includes('mismatch')) {
      if (output && result.authorityAvailable === true) violations.push({ index, kind: 'content-mismatch', reason: result.comparison });
      else historicalMismatchLabels++;
    }
    if (!output) continue;
    outputSamples++;
    const epoch = count(before.automaticIdentityEpoch), resultEpoch = count(result.automaticIdentityEpoch);
    if (epoch > resultEpoch || (status.phase === 'retired' && status.authorityAvailable === false))
      violations.push({ index, kind: 'output-after-observed-retirement' });
    if (!changed && rootValue(before, 'rootChannelId') === NO_CHAIN_ROOT)
      violations.push({ index, kind: 'A-output-in-stable-B-bracket' });
    if (result.comparison === 'match') {
      try { const issues = checkMutationComparison(result, 0, id, expected);
        if (issues.length) violations.push({ index, kind: 'fixture-output-mismatch', issues }); }
      catch (error) { violations.push({ index, kind: 'fixture-output-mismatch', error: String(error) }); }
    }
  }
  return { samples: samples.length, crossedB, changedBrackets, outputSamples, errors, retiredPolls, historicalMismatchLabels, historicalSnapshotSamples, violations,
    callbackOriginProved: false, missingEventContinuityProved: false, hostInputOrderingProved: false };
}
/** External command times describe UI observations. They are not controller input acknowledgements. */
export function summarizeOrderingCommands(log: Wire, samples: Wire[]): Wire {
  assert(Array.isArray(log.commands)); assert(log.commands.length >= 2 && log.commands.length <= 100);
  const commands = log.commands as Wire[];
  let previous = 0;
  for (const command of commands) {
    assert(['A', 'B'].includes(String(command.target))); assert.equal(command.completed, true);
    assert.equal(typeof command.started, 'string'); assert.equal(typeof command.ended, 'string');
    const start = Date.parse(String(command.started)), end = Date.parse(String(command.ended));
    assert(Number.isFinite(start) && Number.isFinite(end) && end >= start && start >= previous); previous = start;
  }
  assert(commands.some(command => command.target === 'B')); assert.equal(commands.at(-1)!.target, 'A');
  const start = Date.parse(String(samples[0]?.started)), end = Date.parse(String(samples.at(-1)?.ended));
  assert(Number.isFinite(start) && Number.isFinite(end));
  assert(commands.some(command => Date.parse(String(command.ended)) >= start && Date.parse(String(command.started)) <= end), 'native commands did not overlap sampling');
  const observedB = samples.some(sample => [sample.before, sample.after].some(root => root && rootValue(root as Wire, 'rootChannelId') === NO_CHAIN_ROOT));
  const bCommands = commands.filter(command => command.target === 'B');
  const terminal = samples.find(sample => sample.result && (sample.result as Wire).comparison !== 'pending');
  const activeEnd = Date.parse(String((terminal ?? samples.at(-1))?.ended));
  const acquisitionOverlap = bCommands.some(command => Date.parse(String(command.ended)) >= start && Date.parse(String(command.started)) <= activeEnd);
  return { externalCommands: commands.length, externallyCompletedBTransitions: bCommands.length, samplingObservedB: observedB,
    externallyCompletedBNotSampled: !observedB, externalLogIsHostFence: false,
    activeAcquisitionWindowStarted: samples[0]?.started, activeAcquisitionWindowEnded: (terminal ?? samples.at(-1))?.ended,
    nativeCommandsOverlappedActiveAcquisition: acquisitionOverlap,
    missedLifecycleRetirementProved: false, controllerDeliveryFailureProved: false };
}
function validateOrderingReport(report: Wire, expectedOverlap: boolean): Wire {
  assert.equal(report.marker, MUTATION_MARKER); assert.equal(report.stage, 'finished'); assert.equal(typeof report.ended, 'string');
  assert.equal(report.researchOnly, true); closed(report);
  for (const key of ['callbackOriginProved', 'missingEventContinuityProved', 'hostInputOrderingProved', 'perBatchGetStepValuesAvailable']) assert.equal(report[key], false);
  assert.equal(report.fixtureMutationsIssued, 0); assert.equal(report.fixtureRestored, true); assert.equal(report.error, undefined);
  assert.equal(report.recoveryError, undefined); assert.equal(report.observationError, undefined);
  const samples = report.samples as Wire[]; assert(Array.isArray(samples) && samples.length > 0 && samples.length <= ORDERING_MAX_SAMPLES);
  const cadence = report.comparePollCadenceMs;
  assert(typeof cadence === 'number');
  if (expectedOverlap) assert.equal(cadence, ORDERING_POLL_CADENCE_MS);
  else assert([250, ORDERING_POLL_CADENCE_MS].includes(cadence), 'unknown timing diagnostic cadence');
  let previousPollMs: number | undefined, pollSequence = 0;
  for (const sample of samples) {
    assert.equal(typeof sample.comparePollIssued, 'boolean');
    if (!sample.comparePollIssued) { assert.equal(sample.result, undefined); continue; }
    const elapsed = sample.comparePollAtElapsedMs; assert(typeof elapsed === 'number');
    assert(orderingPollDue(elapsed, previousPollMs, cadence), 'authority polls exceed the declared cadence'); previousPollMs = elapsed;
    assert.equal(sample.comparePollSequence, ++pollSequence);
  }
  assert(pollSequence > 0); assert.equal(report.comparePollCount, pollSequence);
  for (const trace of [report.beforeTrace, report.afterTrace] as Wire[]) {
    assert.equal(trace.traceDroppedSinceClear, 0, 'trace loss leaves the controlled event interval incomplete');
    assert(Array.isArray(trace.events)); assert.equal(trace.events.length, trace.traceRetained);
  }
  assert.equal((report.afterTrace as Wire).extensionInitNonce, (report.beforeTrace as Wire).extensionInitNonce);
  assert.equal((report.afterTrace as Wire).traceClearCount, (report.beforeTrace as Wire).traceClearCount);
  for (const sample of samples) {
    if (sample.error !== undefined) continue;
    for (const root of [sample.before, sample.after] as Wire[]) assert.equal(root.extensionInitNonce, (report.beforeTrace as Wire).extensionInitNonce);
    for (const value of [sample.status, sample.result].filter(Boolean) as Wire[]) {
      assert.equal(value.instrumentationRevision, MUTATION_MARKER); assert.equal(value.initDomain, (report.active as Wire).initDomain);
    }
  }
  const id = String(report.ownedTrackId), rows = report.expectedRows as ShadowNote[][];
  for (const [row, notes] of rows.entries()) assert.deepEqual(checkExpectedFixture(notes, row), []);
  for (const key of ['baseline', 'restoration']) {
    const captures = report[key] as Wire[]; assert.equal(captures.length, 3);
    for (const [row, capture] of captures.entries()) { verifyMutationRegistry((capture.inventory as Wire).result as Wire);
      assert.deepEqual(checkMutationComparison(capture.result as Wire, row, id, rows[row]!), []); }
  }
  const active = report.active as Wire; assert.equal(active.comparison, 'pending'); closed(active);
  assert(count(active.scanProgressCoordinates) > 0 && count(active.scanProgressCoordinates) < count(active.scanTotalCoordinates));
  assert.deepEqual(report.finalTracks, report.initialTracks); assert.equal(report.finalScenes, 8);
  assert.deepEqual(report.finalRootEndpoint, report.initialRootEndpoint);
  const summary = summarizeOrderingSamples(samples, id, rows[0]!); assert.deepEqual(report.summary, summary);
  assert.deepEqual(report.commandSummary, summarizeOrderingCommands(report.commandLog as Wire, samples));
  assert.equal((report.commandSummary as Wire).nativeCommandsOverlappedActiveAcquisition, expectedOverlap,
    expectedOverlap ? 'native commands started after acquisition ended' : 'active interleaving belongs in the accepted role');
  assert.deepEqual(summary.violations, [], 'a concrete retained ordering/content violation was observed');
  assert.equal(summary.errors, 0, 'sample RPC errors leave this trial incomplete');
  return { originalComparisonsBefore: 3, originalRestorationComparisons: 3, ...summary, commandSummary: report.commandSummary };
}
export function verifyOrderingReport(report: Wire): Wire {
  return { interleavingTrials: 1, ...validateOrderingReport(report, true) };
}
export function verifyOrderingTimingDiagnostic(report: Wire): Wire {
  return { interleavingTrials: 0, timingDiagnosticTrials: 1, diagnosticReason: 'nativecommands-after-acquisition',
    ...validateOrderingReport(report, false) };
}
async function poll(readNext: () => Promise<Wire>, done: (value: Wire) => boolean): Promise<Wire> {
  const start = performance.now(); for (;;) { const value = await readNext(); if (done(value)) return value;
    assert(performance.now() - start < 45_000, `ordering preparation expired: ${JSON.stringify(value)}`); await wait(); }
}
async function owned(id: string): Promise<Track> { const tracks = (await request('track.list')).tracks as Track[];
  const matches = tracks.filter(track => track.channelId === id); assert.equal(matches.length, 1); assert.equal(matches[0]!.name, 'gn-8g-reuse'); return matches[0]!; }
async function inventory(): Promise<Wire> { const statuses: Wire[] = [], result = await collectMutationRegistry(await shadow('inventory'), () => shadow('rebuildPoll'), statuses); return { statuses, result }; }
async function bind(id: string, row: number): Promise<Wire> {
  const track = await owned(id); await shadow('point', { index: 0, trackIndex: track.index, row, canaryTrackIndex: track.index, canaryRow: row === 0 ? 1 : 0 });
  const result = await poll(() => shadow('poll', { index: 0 }), value => value.phase === 'retired' || ((value.phase === 'settled' || value.phase === 'complete') && value.canaryPhase === 'target'));
  assert.notEqual(result.phase, 'retired'); assert.equal(result.canaryVerifiedForBinding, true);
  await poll(() => shadow('reconcile', { index: 0 }), value => value.physicalPendingHints === 0 && value.pendingCoordinates === 0); return result;
}
async function originals(report: Wire, key: 'baseline' | 'restoration'): Promise<void> {
  report[key] = []; const rows = report.expectedRows as ShadowNote[][], id = String(report.ownedTrackId);
  for (let row = 0; row < 3; row++) {
    const capture: Wire = { row }; (report[key] as Wire[]).push(capture); capture.inventory = await inventory(); capture.binding = await bind(id, row);
    let result = await shadow('compareStart', { index: 0 });
    result = await poll(async () => result.comparison === 'pending' ? (result = await shadow('comparePoll')) : result, value => value.comparison !== 'pending');
    capture.result = result; assert.deepEqual(checkMutationComparison(result, row, id, rows[row]!), []);
  }
}
async function prepare(output: string): Promise<void> {
  const state = await read('/tmp/ghostnote-8g-research-state.json'), witness = await read('/tmp/ghostnote-8g-mutation-witness.json');
  const id = String(state.ownedTrackId); await owned(id); assert.equal(witness.status, 'ready'); assert.equal(witness.ownedTrackId, id);
  const initialTracks = await request('track.list'), ids = (initialTracks.tracks as Track[]).map(track => track.channelId);
  assert.equal(ids.length, 5); assert.deepEqual([...ids].sort(), [...state.baselineIds as string[], id].sort());
  assert.equal((await request('scene.count')).sceneCount, 8);
  const endpoint = identityEndpoint(await shadow('rootSnapshot'), id); assert.deepEqual(endpoint, identityEndpoint((witness.layer as Wire).root as Wire, id, true));
  const info = await shadow('info'); assert.equal(info.instrumentationRevision, MUTATION_MARKER);
  assert.equal(info.authorityBindingRevision, '8g-authority-transition-v1'); assert.equal(info.inventoryControlRevision, '8g-inventory-preparation-v1');
  assert.equal(info.residentHandles, 2); assert.equal(info.authorityHandles, 1); assert.equal(info.steps, 2048);
  const report: Wire = { marker: MUTATION_MARKER, stage: 'preparing', started: new Date().toISOString(), researchOnly: true,
    complete: false, eligible: false, callbackOriginProved: false, missingEventContinuityProved: false, hostInputOrderingProved: false,
    perBatchGetStepValuesAvailable: false, fixtureMutationsIssued: 0, comparePollCadenceMs: ORDERING_POLL_CADENCE_MS,
    ownedTrackId: id, initialTracks, initialRootEndpoint: endpoint,
    expectedRows: expectedRows(witness), initial: info, samples: [], limitations: ['RPC brackets are not atomic host snapshots',
      'comparePoll exposes aggregate getStep work and final notes only', 'external UI completion does not acknowledge controller input delivery',
      'an unsampled B endpoint is not proof of a missed callback'] };
  await save(output, report, true);
  try {
    const pings: number[] = []; for (let n = 0; n < 25; n++) { const start = performance.now(); await request('ping'); pings.push(performance.now() - start); }
    pings.sort((a, b) => a - b); report.pingP95Ms = pings[23]; await shadow('ping', { p95Ms: pings[23] });
    await originals(report, 'baseline'); report.inventory = await inventory(); report.binding = await bind(id, 0);
    await shadow('rootClearTrace'); let active = await shadow('compareStart', { index: 0 });
    active = await poll(async () => active.comparison === 'pending' && Number(active.scanProgressCoordinates ?? 0) === 0 ? (active = await shadow('comparePoll')) : active,
      value => value.comparison !== 'pending' || Number(value.scanProgressCoordinates ?? 0) > 0);
    report.active = active; assert.equal(active.comparison, 'pending'); assert(Number(active.scanProgressCoordinates) > 0);
    report.beforeRoot = await shadow('rootSnapshot'); report.beforeTrace = await shadow('rootTrace'); report.stage = 'prepared'; report.preparedAt = new Date().toISOString();
  } catch (error) { report.error = String(error); report.stage = 'prepare-error'; throw error; }
  finally { await save(output, report); }
  console.log(`Prepared active scan. Start sample ${output}, then issue native A/B transitions.`);
}
async function sample(output: string): Promise<void> {
  const report = await read(output); assert.equal(report.stage, 'prepared'); report.stage = 'sampling'; await save(output, report);
  const start = performance.now(); report.sampleStarted = new Date().toISOString();
  let previousPollMs: number | undefined, pollSequence = 0;
  try {
    for (let n = 0; n < ORDERING_MAX_SAMPLES && performance.now() - start < ORDERING_SAMPLE_MS; n++) {
      const item: Wire = { index: n, started: new Date().toISOString(), elapsedMs: performance.now() - start, comparePollIssued: false }; (report.samples as Wire[]).push(item);
      try { item.before = await shadow('rootSnapshot'); item.status = await shadow('status', { index: 0 });
        const elapsed = performance.now() - start;
        if (orderingPollDue(elapsed, previousPollMs)) {
          item.comparePollIssued = true; item.comparePollAtElapsedMs = elapsed; item.comparePollSequence = ++pollSequence;
          previousPollMs = elapsed; report.comparePollCount = pollSequence; item.result = await shadow('comparePoll');
        }
        item.after = await shadow('rootSnapshot'); }
      catch (error) { item.error = String(error); }
      finally { item.ended = new Date().toISOString(); await save(output, report); }
      await wait(25);
    }
    report.afterTrace = await shadow('rootTrace'); report.sampleEnded = new Date().toISOString(); report.sampleWallMs = performance.now() - start; report.stage = 'sampled';
  } catch (error) { report.error = String(error); report.stage = 'sample-error'; throw error; }
  finally { await save(output, report); }
  console.log(`Retained ${(report.samples as Wire[]).length} interleaved samples. Return to A before finish.`);
}
async function finish(output: string, log: string): Promise<void> {
  const report = await read(output); assert.equal(report.stage, 'sampled');
  try {
    report.commandLog = await read(log); report.commandSummary = summarizeOrderingCommands(report.commandLog as Wire, report.samples as Wire[]);
    report.summary = summarizeOrderingSamples(report.samples as Wire[], String(report.ownedTrackId), (report.expectedRows as ShadowNote[][])[0]!);
  } catch (error) { report.observationError = String(error); }
  try {
    const id = String(report.ownedTrackId); await owned(id); report.finalRootEndpoint = identityEndpoint(await shadow('rootSnapshot'), id);
    assert.deepEqual(report.finalRootEndpoint, report.initialRootEndpoint); await originals(report, 'restoration');
    report.finalTracks = await request('track.list'); report.finalScenes = (await request('scene.count')).sceneCount;
    assert.deepEqual(report.finalTracks, report.initialTracks); assert.equal(report.finalScenes, 8); report.fixtureRestored = true;
    await shadow('retire', { index: 0 }); await shadow('retire', { index: 1 });
  } catch (error) { report.recoveryError = String(error); report.fixtureRestored = false; }
  report.stage = 'finished'; report.ended = new Date().toISOString(); await save(output, report);
  console.log(JSON.stringify(verifyOrderingReport(report)));
}
async function main(): Promise<void> {
  const [mode, output, log] = process.argv.slice(2); assert(output, 'usage: prepare|sample|finish|verify <output> [native-command-log]');
  if (mode === 'prepare') await prepare(output); else if (mode === 'sample') await sample(output);
  else if (mode === 'prepare-sample') { await prepare(output); await sample(output); }
  else if (mode === 'finish') { assert(log); await finish(output, log); }
  else if (mode === 'verify-timing-diagnostic') console.log(JSON.stringify(verifyOrderingTimingDiagnostic(await read(output))));
  else { assert.equal(mode, 'verify'); console.log(JSON.stringify(verifyOrderingReport(await read(output)))); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  void main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => bridge.disconnect());
