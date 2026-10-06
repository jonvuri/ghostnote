// 8h3e removed the research wire or rig configuration that this live driver uses. Live use needs the
// earlier research build of its own session. Its retained artifacts and offline checks do not need a host.
/** Retain delivered identity-event fences. Missing-event detection stays unproved. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { BridgeClient } from '../client.js';
import { checkExpectedFixture } from './phase8g-lifecycle-reuse.js';
import { ACQUIRED_FIELDS, MUTATION_MARKER, checkMutationComparison, collectMutationRegistry, verifyMutationRegistry } from './phase8g-shadow-mutations.js';
import type { NormalizedValue, ShadowCacheWireSnapshot, ShadowNote } from './phase8g-shadow-cache-lib.js';

type Wire = Record<string, unknown>;
const STATE = '/tmp/ghostnote-8g-research-state.json', WITNESS = '/tmp/ghostnote-8g-mutation-witness.json';
const bridge = new BridgeClient();
function file(label: string): string { assert.match(label, /^[a-z0-9][a-z0-9_-]{0,79}$/i); return `/tmp/ghostnote-8g-identity-fence-${label}.json`; }
function count(value: unknown, name: string): number { assert(typeof value === 'number' && Number.isSafeInteger(value) && value >= 0, `invalid counter: ${name}`); return value; }
function rootValue(root: Wire, name: string): unknown { const read = (root.current as Wire)[name] as Wire; assert.equal(read?.status, 'read', `root ${name} unavailable`); return read.value; }
export function identityEndpoint(root: Wire, id: string, historical = false): Wire {
  assert.equal(root.instrumentationRevision, '8g-root-existing-chain-v1'); assert.equal(root.identityDetectionProved, false);
  if (!historical || root.hostInputFenceProved !== undefined) assert.equal(root.hostInputFenceProved, false);
  assert.equal(rootValue(root, 'projectExists'), true); assert.equal(rootValue(root, 'rootExists'), true); assert.equal(rootValue(root, 'hasActiveEngine'), true);
  const values = Object.fromEntries(['projectName', 'rootChannelId', 'masterChannelId'].map(name => { const value = rootValue(root, name); assert(typeof value === 'string' && value.length > 0); return [name, value]; }));
  const witness = root.existingChainWitnesses as Wire; assert(Array.isArray(witness.candidates));
  const chains = (witness.candidates as Wire[]).filter(candidate => candidate.trackChannelId === id)
    .map(candidate => Object.fromEntries(['trackWindowIndex', 'deviceWindowIndex', 'layerWindowIndex', 'trackChannelId', 'trackName', 'trackPosition',
      'trackDeviceCount', 'deviceName', 'devicePosition', 'hasLayers', 'layerCount', 'chainChannelId', 'chainName', 'chainDeviceCount'].map(name => [name, candidate[name]])))
    .sort((a, b) => Number(a.layerWindowIndex) - Number(b.layerWindowIndex));
  assert.equal(chains.length, 4); assert.deepEqual(chains.map(chain => chain.layerWindowIndex), [0, 1, 2, 3]);
  assert(chains.every(chain => chain.trackName === 'gn-8g-reuse' && chain.trackDeviceCount === 1 && chain.deviceWindowIndex === 0
    && chain.deviceName === 'Instrument Layer' && chain.hasLayers === true && chain.layerCount === 4
    && typeof chain.chainName === 'string' && chain.chainName.length > 0 && typeof chain.chainChannelId === 'string' && chain.chainChannelId.length > 0));
  assert.equal(new Set(chains.map(chain => chain.chainChannelId)).size, 4);
  return { ...values, chains };
}
function validateCapture(value: Wire): void {
  const root = value.root as Wire, trace = value.trace as Wire;
  assert(root && trace); assert.equal(root.callbacksChangedDuringRead, false);
  assert.equal(root.sequenceBeforeRead, root.sequenceAfterRead); assert.equal(root.sequenceAfterRead, trace.sequence);
  assert.equal(root.callbackCount, trace.callbackCount); assert.equal(root.extensionInitNonce, trace.extensionInitNonce); assert.equal(root.probeInstanceNonce, trace.probeInstanceNonce);
  assert.equal(trace.traceDroppedSinceClear, 0, 'the delivered event interval must be retained in full');
  assert(Array.isArray(trace.events)); assert.equal(trace.events.length, trace.traceRetained);
  let previous = 0;
  for (const event of trace.events as Wire[]) { const sequence = count(event.sequence, 'event sequence'); assert(sequence > previous && sequence <= count(trace.sequence, 'trace sequence')); previous = sequence; }
}
function identitySignal(name: unknown): boolean {
  return typeof name === 'string' && (['projectExists', 'rootExists', 'rootChannelId', 'masterChannelId'].includes(name)
    || (name.startsWith('chainWitness.') && !['chainWitness.canUndo', 'chainWitness.canRedo'].includes(name)));
}
/** Count retained deliveries. Equal endpoint values do not prove a quiet interval. */
export function summarizeIdentityFence(before: Wire, after: Wire, id: string): Wire {
  validateCapture(before); validateCapture(after);
  const a = before.root as Wire, b = after.root as Wire, first = before.trace as Wire, last = after.trace as Wire;
  assert.equal(a.extensionInitNonce, b.extensionInitNonce); assert.equal(a.probeInstanceNonce, b.probeInstanceNonce);
  assert.equal(first.traceClearCount, last.traceClearCount, 'the trace was cleared during the controlled interval');
  assert.deepEqual(identityEndpoint(b, id), identityEndpoint(a, id), 'return to the exact original root and chain inputs');
  const events = (last.events as Wire[]).filter(event => Number(event.sequence) > count(first.sequence, 'before trace sequence'));
  const callbacks = events.filter(event => event.kind === 'callback');
  const delta = count(last.callbackCount, 'after callbacks') - count(first.callbackCount, 'before callbacks');
  assert(delta >= 0); assert.equal(callbacks.length, delta, 'callback count and retained deliveries differ');
  const identities = callbacks.filter(event => identitySignal(event.signal));
  return { endpointInputsEqual: true, deliveredEvents: events.length, deliveredCallbacks: callbacks.length,
    deliveredIdentityCallbacks: identities.length, identityCallbackSignals: [...new Set(identities.map(event => event.signal))].sort(),
    rootIdentityEpochDelta: count(b.automaticIdentityEpoch, 'after identity epoch') - count(a.automaticIdentityEpoch, 'before identity epoch'),
    absentCallbackDetectionProved: false, identityDetectionProved: false, hostInputFenceProved: false };
}
export function checkIdentityRefusal(value: Wire): void {
  assert.equal(value.instrumentationRevision, MUTATION_MARKER); assert.equal(value.complete, false); assert.equal(value.eligible, false);
  assert.equal(value.authorityAvailable, false); assert.equal(value.readMode, 'refuse'); assert.equal(value.callbackSourceIdentityKnown, false);
  for (const field of ['diagnosticSnapshot', 'authorityNotes', 'historicalSnapshot', 'authoritativeSnapshot']) assert.equal(value[field], undefined, 'retired output is unavailable');
}
function expectedFixture(witness: Wire): ShadowNote[] {
  const rows = (witness.before as Wire).notes as Wire[], row = rows.find(value => value.row === 0)!;
  return (row.notes as Wire[]).map(note => {
    const fields: Record<string, NormalizedValue> = {};
    for (const field of ACQUIRED_FIELDS) {
      if (['rawDuration', 'durationCells', 'rawGain', 'rawTimbre'].includes(field)) continue;
      const value = note[field]; assert(value === null || typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean'); fields[field] = value;
    }
    fields.rawDuration = fields.duration; fields.durationCells = Math.max(1, Math.floor(Number(fields.duration) * 512 + .5)); fields.duration = Number(fields.durationCells) / 512;
    fields.rawGain = fields.gain; fields.rawTimbre = fields.timbre; fields.timbre = (Number(fields.rawTimbre) + 1) / 2;
    return { channel: Number(note.channel), cell: Number(note.x), pitch: Number(note.y), fields };
  });
}
export function verifyIdentityFenceReport(report: Wire): Wire {
  assert.equal(report.marker, MUTATION_MARKER); assert.equal(report.researchOnly, true); assert.equal(report.complete, false); assert.equal(report.eligible, false);
  assert.equal(report.identityDetectionProved, false); assert.equal(report.absentCallbackDetectionProved, false); assert.equal(report.hostInputFenceProved, false);
  assert.equal(report.stage, 'finished'); assert.equal(report.outcome, 'observed-event-fence-pass'); assert.equal(typeof report.ended, 'string');
  const initial = report.initial as Wire; assert.equal(initial.instrumentationRevision, MUTATION_MARKER); assert.equal(initial.residentHandles, 2); assert.equal(initial.authorityHandles, 1);
  const id = report.ownedTrackId as string; assert(typeof id === 'string' && id.length > 0); file(String(report.label));
  const prepare = report.prepare as Wire, finish = report.finish as Wire, recovery = report.recovery as Wire, expected = report.expectedNotes as ShadowNote[];
  for (const value of [prepare.inventory, recovery.inventory] as Wire[]) verifyMutationRegistry(value.result as Wire);
  assert.deepEqual(checkExpectedFixture(expected, 0), []);
  assert.deepEqual(checkMutationComparison(prepare.comparison as Wire, 0, id, expected), []);
  assert.equal((prepare.binding as Wire).canaryVerifiedForBinding, true);
  const active = prepare.active as Wire;
  assert.equal(active.comparison, 'pending'); assert(count(active.scanProgressCoordinates, 'active progress') > 0);
  assert(count(active.scanProgressCoordinates, 'active progress') < count(active.scanTotalCoordinates, 'total progress'));
  assert.equal(active.scanTotalCoordinates, 2048 * 128); assert.equal(active.initDomain, (prepare.shadow as Wire).initDomain);
  assert.equal(active.projectGeneration, (prepare.shadow as Wire).projectGeneration);
  assert(Array.isArray(finish.polls) && finish.polls.length === 2);
  for (const value of finish.polls as Wire[]) { checkIdentityRefusal(value); assert.equal(value.comparison, 'window-changed'); }
  checkIdentityRefusal(finish.oldRead as Wire); assert.equal((finish.shadow as Wire).historicalSnapshot, undefined);
  const previous = prepare.shadow as Wire, current = finish.shadow as Wire;
  assert.equal(current.initDomain, previous.initDomain);
  assert(count(current.automaticIdentityInvalidations, 'after invalidations') > count(previous.automaticIdentityInvalidations, 'before invalidations'));
  assert(count(current.projectGeneration, 'after project generation') > count(previous.projectGeneration, 'before project generation'));
  const summary = summarizeIdentityFence(prepare, finish, id);
  assert(Number(summary.deliveredIdentityCallbacks) > 0 && Number(summary.rootIdentityEpochDelta) > 0, 'a delivered identity event is required');
  assert.deepEqual(report.summary, summary);
  assert.equal((recovery.binding as Wire).canaryVerifiedForBinding, true); assert.deepEqual(checkMutationComparison(recovery.comparison as Wire, 0, id, expected), []);
  const token = ((recovery.comparison as Wire).diagnosticSnapshot as ShadowCacheWireSnapshot).token;
  assert.equal(token.initDomain, previous.initDomain); assert.equal(token.project, current.projectGeneration);
  return summary;
}
async function request<T = Wire>(method: string, params?: Wire): Promise<T> { return await bridge.request(method, params) as T; }
async function shadow(operation: string, params: Wire = {}): Promise<Wire> { return await request('cache.shadow', { operation, ...params }); }
const wait = async (): Promise<void> => await new Promise(resolve => setTimeout(resolve, 50));
async function poll(read: () => Promise<Wire>, done: (value: Wire) => boolean): Promise<Wire> {
  const started = performance.now(); for (;;) { const value = await read(); if (done(value)) return value; assert(performance.now() - started < 45_000, `poll expired: ${JSON.stringify(value)}`); await wait(); }
}
async function owned(id: string): Promise<{ index: number; channelId: string; name: string }> {
  const tracks = (await request<{ tracks: { index: number; channelId: string; name: string }[] }>('track.list')).tracks;
  const matches = tracks.filter(track => track.channelId === id); assert.equal(matches.length, 1); assert.equal(matches[0]!.name, 'gn-8g-reuse'); return matches[0]!;
}
async function forceBind(id: string): Promise<Wire> {
  const track = await owned(id); await shadow('point', { index: 0, trackIndex: track.index, row: 0, canaryTrackIndex: track.index, canaryRow: 1 });
  const result = await poll(() => shadow('poll', { index: 0 }), value => value.phase === 'retired' || ((value.phase === 'settled' || value.phase === 'complete') && value.canaryPhase === 'target'));
  assert.equal(result.phase, 'settled'); assert.equal(result.canaryVerifiedForBinding, true); await shadow('reconcile', { index: 0 }); return result;
}
async function comparison(): Promise<Wire> {
  let value = await shadow('compareStart', { index: 0 });
  return await poll(async () => { if (value.comparison === 'pending') value = await shadow('comparePoll'); return value; }, result => result.comparison !== 'pending');
}
async function capture(value: Wire): Promise<void> { value.root = await shadow('rootSnapshot'); value.trace = await shadow('rootTrace'); }
async function inventory(operation: 'inventory' | 'rebuild'): Promise<Wire> {
  const statuses: Wire[] = [], result = await collectMutationRegistry(await shadow(operation), async () => await shadow('rebuildPoll'), statuses); return { statuses, result };
}
async function save(label: string, report: Wire, exclusive = false): Promise<void> { await writeFile(file(label), JSON.stringify(report, null, 2) + '\n', exclusive ? { flag: 'wx' } : undefined); }
async function prepare(label: string): Promise<void> {
  file(label); const state = JSON.parse(await readFile(STATE, 'utf8')) as Wire, witness = JSON.parse(await readFile(WITNESS, 'utf8')) as Wire;
  assert.equal(typeof state.ownedTrackId, 'string'); const id = state.ownedTrackId as string; await owned(id);
  assert.equal(witness.status, 'ready'); assert.equal(witness.ownedTrackId, id);
  const root = await shadow('rootSnapshot'); assert.deepEqual(identityEndpoint(root, id), identityEndpoint((witness.layer as Wire).root as Wire, id, true));
  const initial = await shadow('info'); assert.equal(initial.instrumentationRevision, MUTATION_MARKER); assert.equal(initial.residentHandles, 2); assert.equal(initial.authorityHandles, 1);
  assert.equal(initial.automaticIdentityProbeAttached, true); assert.equal(typeof initial.initDomain, 'string'); assert(String(initial.initDomain).length > 0);
  const expected = expectedFixture(witness); assert.deepEqual(checkExpectedFixture(expected, 0), []);
  const report: Wire = { label, marker: MUTATION_MARKER, started: new Date().toISOString(), stage: 'preparing', researchOnly: true,
    complete: false, eligible: false, identityDetectionProved: false, absentCallbackDetectionProved: false, hostInputFenceProved: false,
    ownedTrackId: id, initial, expectedNotes: expected, prepare: {} };
  await save(label, report, true);
  const prepared = report.prepare as Wire;
  try {
    const pings: number[] = []; for (let n = 0; n < 25; n++) { const start = performance.now(); await request('ping'); pings.push(performance.now() - start); }
    pings.sort((a, b) => a - b); report.pingP95Ms = pings[23]; await shadow('ping', { p95Ms: pings[23] });
    prepared.inventory = await inventory('inventory'); prepared.binding = await forceBind(id); prepared.comparison = await comparison();
    assert.deepEqual(checkMutationComparison(prepared.comparison as Wire, 0, id, expected), []);
    await shadow('rootClearTrace'); let active = await shadow('compareStart', { index: 0 });
    active = await poll(async () => { if (active.comparison === 'pending' && Number(active.scanProgressCoordinates ?? 0) === 0) active = await shadow('comparePoll'); return active; },
      value => value.comparison !== 'pending' || Number(value.scanProgressCoordinates ?? 0) > 0);
    assert.equal(active.comparison, 'pending'); assert(Number(active.scanProgressCoordinates) > 0 && Number(active.scanProgressCoordinates) < Number(active.scanTotalCoordinates));
    prepared.active = active; await capture(prepared); prepared.shadow = await shadow('status', { index: 0 }); validateCapture(prepared);
    assert.equal((prepared.shadow as Wire).comparison, 'pending'); report.stage = 'prepared'; report.preparedAt = new Date().toISOString(); await save(label, report);
    console.log(`Prepared ${label}: a private scan is active. Return to the original fixture before finish.`);
  } catch (error) { report.stage = 'prepare-error'; report.error = String(error); await save(label, report); await shadow('retire', { index: 0 }); throw error; }
}
async function finish(label: string): Promise<void> {
  const report = JSON.parse(await readFile(file(label), 'utf8')) as Wire; assert.equal(report.stage, 'prepared'); assert.equal(report.marker, MUTATION_MARKER);
  const id = report.ownedTrackId as string, prepared = report.prepare as Wire, finished: Wire = {}, recovery: Wire = {}; report.finish = finished; report.recovery = recovery;
  let failure: unknown;
  try {
    await capture(finished); finished.polls = [];
    for (let n = 0; n < 2; n++) (finished.polls as Wire[]).push(await shadow('comparePoll'));
    finished.oldRead = await shadow('read', { index: 0 }); finished.shadow = await shadow('status', { index: 0 });
    report.summary = summarizeIdentityFence(prepared, finished, id);
    for (const value of finished.polls as Wire[]) { checkIdentityRefusal(value); assert.equal(value.comparison, 'window-changed'); }
    checkIdentityRefusal(finished.oldRead as Wire);
    assert(Number((finished.shadow as Wire).automaticIdentityInvalidations) > Number((prepared.shadow as Wire).automaticIdentityInvalidations));
    assert(Number((finished.shadow as Wire).projectGeneration) > Number((prepared.shadow as Wire).projectGeneration));
    assert(Number((report.summary as Wire).deliveredIdentityCallbacks) > 0 && Number((report.summary as Wire).rootIdentityEpochDelta) > 0, 'no delivered identity-event fence was established');
  } catch (error) { failure = error; report.observationError = String(error); }
  try {
    await owned(id); assert.deepEqual(identityEndpoint(await shadow('rootSnapshot'), id), identityEndpoint(prepared.root as Wire, id));
    recovery.inventory = await inventory('inventory'); recovery.binding = await forceBind(id); recovery.comparison = await comparison();
    assert.deepEqual(checkMutationComparison(recovery.comparison as Wire, 0, id, report.expectedNotes as ShadowNote[]), []);
  } catch (error) { failure ??= error; report.recoveryError = String(error); }
  report.stage = 'finished'; report.ended = new Date().toISOString(); report.outcome = failure === undefined ? 'observed-event-fence-pass' : 'error'; await save(label, report);
  if (failure !== undefined) throw failure;
  console.log(JSON.stringify(verifyIdentityFenceReport(report)));
}
async function main(): Promise<void> {
  const mode = process.argv[2], label = process.argv[3]; assert(label, 'a case label or verification path is required');
  if (mode === 'prepare') await prepare(label);
  else if (mode === 'finish') await finish(label);
  else { assert.equal(mode, 'verify'); console.log(JSON.stringify(verifyIdentityFenceReport(JSON.parse(await readFile(label.endsWith('.json') ? label : file(label), 'utf8')) as Wire))); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  void main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => bridge.disconnect());
