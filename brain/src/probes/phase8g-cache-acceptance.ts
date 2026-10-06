// 8h3e removed the research wire or rig configuration that this live driver uses. Live use needs the
// earlier research build of its own session. Its retained artifacts and offline checks do not need a host.
/** Check the fixed pool, atomic registry, and independent fallback on an owned fixture. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { BridgeClient } from '../client.js';
import { checkExpectedFixture } from './phase8g-lifecycle-reuse.js';
import { checkComparison } from './phase8g-shadow-reuse.js';
import { assessShadowConsumer, shadowSnapshotFromWire, type ShadowCacheWireSnapshot } from './phase8g-shadow-cache-lib.js';

type Wire = Record<string, unknown>;
const OUTPUT = '/tmp/ghostnote-8g-cache-acceptance-v5-results.json';
const MARKER = '8g-shadow-physical-hints-v5';
const bridge = new BridgeClient();
let calls = 0, responseBytes = 0;
async function request<T = Wire>(method: string, params?: Wire): Promise<T> {
  const value = await bridge.request(method, params); calls++; responseBytes += Buffer.byteLength(JSON.stringify(value)); return value as T;
}
async function shadow(operation: string, params: Wire = {}): Promise<Wire> { return await request('cache.shadow', { operation, ...params }); }
async function measurePing(): Promise<Wire> {
  const samples: number[] = [];
  for (let i = 0; i < 30; i++) { const started = performance.now(); await request('ping'); samples.push(performance.now() - started); }
  samples.sort((a, b) => a - b);
  return { samplesMs: samples, p95Ms: samples[Math.ceil(samples.length * .95) - 1] };
}
async function poll(read: () => Promise<Wire>, done: (value: Wire) => boolean, limit = 45_000): Promise<Wire> {
  const started = performance.now();
  for (;;) { const value = await read(); if (done(value)) return value;
    assert(performance.now() - started < limit, `poll expired: ${JSON.stringify(value)}`);
    await new Promise(resolve => setTimeout(resolve, 50)); }
}
function closed(value: Wire): void { assert.equal(value.complete, false); assert.equal(value.eligible, false); }
function checkRegistry(value: Wire): void {
  closed(value); assert.equal(value.rebuildTerminal, true); assert.equal(value.registryPublished, true);
  const state = value.inventoryRebuild as Wire; assert.equal(state.phase, 'published'); assert.equal(state.identityVerified, false);
  assert.equal(state.fullInventoryEnumerated, true); assert.equal(value.inventoryClipEntries, 3);
}
function checkExact(value: Wire, row: number, id: string): void {
  closed(value); assert.equal(value.terminal, true); assert.equal(value.authorityAvailable, true);
  assert.equal(value.fallbackPerformed, true); assert.equal(value.cacheResidenceAdmitted, false); assert.equal(value.cacheMembershipUsed, false);
  assert.equal(value.readMode, 'exact-fallback'); assert.equal(value.phase, 'acquired');
  assert.deepEqual(value.address, { trackId: id, row });
  const coverage = value.coverage as Wire; assert.equal(coverage.startCell, 0); assert.equal(coverage.width, 2048);
  assert.equal(coverage.allChannels, true); assert.equal(value.scannedCoordinates, 2048 * 128);
  assert.equal((value.authorityMetadata as Wire).name, `gn-8g-reuse-${['A', 'B', 'empty'][row]}`);
  assert.deepEqual(checkExpectedFixture(value.authorityNotes as Parameters<typeof checkExpectedFixture>[0], row), []);
}
export function verifyCacheAcceptance(report: Wire): number {
  assert.equal(report.researchOnly, true); closed(report); assert.equal(typeof report.ended, 'string');
  assert.equal((report.initial as Wire).instrumentationRevision, MARKER); assert.equal(typeof report.ownedTrackId, 'string');
  checkRegistry(report.registry as Wire); checkRegistry(report.rebuild as Wire);
  const initialPing = report.pingBeforePool as Wire;
  assert.equal((initialPing.samplesMs as number[]).length, 30);
  assert(Number.isFinite(initialPing.p95Ms));
  assert.equal((report.measuredBeforePool as Wire).pingMeasurementAvailable, true);
  const cases = report.poolCases as Wire[]; assert.equal(cases.length, 7);
  const expected = [[0, 'reserved'], [1, 'reserved'], [0, 'warm'], [2, 'reserved'], [0, 'warm'], [1, 'reserved'], [1, 'warm']] as const;
  const refs = new Map<number, string>();
  for (const [i, value] of cases.entries()) {
    const [row, decision] = expected[i]!; assert.equal(value.row, row); assert.equal(value.decision, decision);
    const acquired = value.acquired as Wire; assert.equal(acquired.poolDecision, decision);
    assert.deepEqual(checkComparison(value.comparison as Wire, row, report.ownedTrackId as string), []);
    const index = Number(acquired.index); assert(index === 0 || index === 1);
    const snapshot = (value.comparison as Wire).diagnosticSnapshot as ShadowCacheWireSnapshot;
    assert(snapshot.token.initDomain); if (decision === 'warm') assert.equal(snapshot.clipRef, refs.get(row));
    refs.set(row, snapshot.clipRef);
    if (i === 3) assert.deepEqual(acquired.poolVictim, { trackId: report.ownedTrackId, row: 1 });
    if (i === 5) assert.deepEqual(acquired.poolVictim, { trackId: report.ownedTrackId, row: 2 });
  }
  const exact = report.exactCases as Wire[]; assert.equal(exact.length, 3);
  for (const [row, value] of exact.entries()) checkExact(value, row, report.ownedTrackId as string);
  const cancelled = report.cancelledExact as Wire;
  assert.equal((cancelled.active as Wire).phase, 'scanning'); assert(Number((cancelled.active as Wire).scannedCoordinates) > 0);
  for (const value of cancelled.after as Wire[]) { closed(value); assert.equal(value.terminal, true); assert.equal(value.authorityAvailable, false);
    assert.equal(value.reason, 'acceptance-cancel'); assert.equal(value.authorityNotes, undefined); }
  assert.equal((cancelled.busy as Wire).reason, 'authority-busy');
  const refused = report.scopeRefusals as Wire[]; assert.equal(refused.length, 3);
  for (const value of refused) { closed(value); assert.equal(value.reason, 'authority-coverage-unavailable');
    assert.equal(value.authorityAvailable, false); assert.equal(value.readMode, 'refuse'); }
  const consumers = report.consumers as Wire;
  assert.equal((consumers.readOnly as Wire).mode, 'shadow-observation');
  assert.equal((consumers.patch as Wire).mode, 'shadow-preparation-only');
  assert.equal((consumers.partial as Wire).mode, 'exact-fallback');
  assert.equal((consumers.unavailable as Wire).mode, 'refuse');
  assert.equal((consumers.stale as Wire).mode, 'exact-fallback');
  assert.equal((consumers.conflict as Wire).mode, 'refuse');
  assert.equal((report.final as Wire).stepDataObservers, 3); assert.equal((report.final as Wire).totalExperimentalStepDataObservers, 6);
  assert.equal((report.final as Wire).pingMeasurementAvailable, true);
  return cases.length + exact.length;
}
async function run(): Promise<void> {
  const state = JSON.parse(await readFile('/tmp/ghostnote-8g-research-state.json', 'utf8')) as { ownedTrackId: string };
  const witness = JSON.parse(await readFile('/tmp/ghostnote-8g-mutation-witness.json', 'utf8')) as Wire;
  assert.equal(witness.status, 'ready'); assert.equal(witness.ownedTrackId, state.ownedTrackId);
  const listed = await request<{ tracks: { channelId: string; name: string; index: number }[] }>('track.list');
  const track = listed.tracks.find(value => value.channelId === state.ownedTrackId); assert(track && track.name === 'gn-8g-reuse');
  const initial = await shadow('info'); assert.equal(initial.instrumentationRevision, MARKER);
  const report: Wire = { started: new Date().toISOString(), researchOnly: true, complete: false, eligible: false,
    ownedTrackId: state.ownedTrackId, hello: await request('contract.hello'), initial, poolCases: [], exactCases: [] };
  const save = async (): Promise<void> => { report.calls = calls; report.responseBytes = responseBytes;
    await writeFile(OUTPUT, JSON.stringify(report, null, 2) + '\n'); };
  try {
    let registry = await shadow('inventory');
    report.registry = await poll(async () => { if (registry.rebuildTerminal !== true) registry = await shadow('rebuildPoll'); return registry; }, value => value.rebuildTerminal === true);
    checkRegistry(report.registry as Wire); await save();
    report.pingBeforePool = await measurePing();
    report.measuredBeforePool = await shadow('ping', { p95Ms: (report.pingBeforePool as Wire).p95Ms }); await save();
    let last: ShadowCacheWireSnapshot | undefined;
    for (const row of [0, 1, 0, 2, 0, 1, 1]) {
      const started = performance.now(), acquired = await shadow('acquire', { trackIndex: track.index, row, canaryTrackIndex: track.index, canaryRow: row === 0 ? 1 : 0 });
      const item: Wire = { row, decision: acquired.poolDecision, acquired }; (report.poolCases as Wire[]).push(item); await save();
      assert(['warm', 'reserved'].includes(String(acquired.poolDecision)), JSON.stringify(acquired));
      item.settled = await poll(() => shadow('poll', { index: acquired.index }), value => value.phase === 'retired'
        || ((value.phase === 'settled' || value.phase === 'complete') && value.canaryPhase === 'target'));
      assert.notEqual((item.settled as Wire).phase, 'retired'); await shadow('reconcile', { index: acquired.index });
      let comparison = await shadow('compareStart', { index: acquired.index });
      item.comparison = await poll(async () => { if (comparison.comparison === 'pending') comparison = await shadow('comparePoll'); return comparison; }, value => value.comparison !== 'pending');
      assert.deepEqual(checkComparison(item.comparison as Wire, row, state.ownedTrackId), []);
      last = (item.comparison as Wire).diagnosticSnapshot as ShadowCacheWireSnapshot; item.wallMs = performance.now() - started;
      await save(); console.log(JSON.stringify({ row, decision: item.decision, comparison: 'match', wallMs: item.wallMs }));
    }
    assert(last); const snapshot = shadowSnapshotFromWire(last, 'complete');
    const dependency = { logicalClipId: snapshot.logicalClipId, projectGeneration: snapshot.window.projectGeneration,
      contentGeneration: snapshot.window.contentGeneration, fingerprint: snapshot.fingerprint };
    const common = { currentWindow: snapshot.window, fields: ['velocity'], authorityAvailable: true };
    report.consumers = {
      readOnly: assessShadowConsumer(snapshot, { ...common, workflow: 'read-only' }),
      patch: assessShadowConsumer(snapshot, { ...common, workflow: 'sparse-patch', base: dependency, overlay: dependency }),
      partial: assessShadowConsumer(snapshot, { ...common, workflow: 'read-only', fields: ['portableRepeat'] }),
      unavailable: assessShadowConsumer(snapshot, { ...common, workflow: 'read-only', fields: ['portableRepeat'], authorityAvailable: false }),
      stale: assessShadowConsumer(snapshot, { ...common, workflow: 'read-only', currentWindow: { ...snapshot.window, contentGeneration: snapshot.window.contentGeneration + 1 } }),
      conflict: assessShadowConsumer(snapshot, { ...common, workflow: 'sparse-patch', base: { ...dependency, fingerprint: 'stale' } }),
    };
    for (let row = 0; row < 3; row++) {
      const started = performance.now(); let value = await shadow('exactStart', { trackIndex: track.index, row });
      value = await poll(async () => { if (value.terminal !== true) value = await shadow('exactPoll'); return value; }, result => result.terminal === true);
      value.wallMs = performance.now() - started; (report.exactCases as Wire[]).push(value); await save(); checkExact(value, row, state.ownedTrackId);
      console.log(JSON.stringify({ exactRow: row, phase: value.phase, wallMs: value.wallMs }));
    }
    let active = await shadow('exactStart', { trackIndex: track.index, row: 0 });
    active = await poll(async () => { if (active.terminal !== true) active = await shadow('exactPoll'); return active; }, value => value.terminal === true || Number(value.scannedCoordinates) > 0);
    const busy = await shadow('exactStart', { trackIndex: track.index, row: 1 });
    await shadow('exactCancel', { reason: 'acceptance-cancel' }); report.cancelledExact = { active, busy, after: [await shadow('exactPoll'), await shadow('exactPoll')] }; await save();
    report.scopeRefusals = [];
    for (const coverage of [
      { startCell: 0, width: 2049, allChannels: true, fields: [], unsupportedFields: [], timingBasis: '1/512-beat' },
      { startCell: 0, width: 2048, allChannels: false, fields: [], unsupportedFields: [], timingBasis: '1/512-beat' },
      { startCell: 0, width: 2048, allChannels: true, fields: ['portableRepeat'], unsupportedFields: [], timingBasis: '1/512-beat' },
    ]) (report.scopeRefusals as Wire[]).push(await shadow('exactStart', { trackIndex: track.index, row: 0, coverage }));
    let rebuild = await shadow('rebuild'); report.rebuild = await poll(async () => { if (rebuild.rebuildTerminal !== true) rebuild = await shadow('rebuildPoll'); return rebuild; }, value => value.rebuildTerminal === true);
    checkRegistry(report.rebuild as Wire);
    report.ping = await measurePing();
    report.final = await shadow('ping', { p95Ms: (report.ping as Wire).p95Ms }); report.ended = new Date().toISOString(); await save();
    console.log(`Fixed-pool acceptance passes ${verifyCacheAcceptance(report)} comparisons, six consumer controls, cancellation, and registry rebuild.`);
  } catch (error) { report.error = String(error); await save(); throw error; }
  finally { for (const index of [0, 1]) await shadow('retire', { index }); await shadow('exactCancel', { reason: 'acceptance-ended' }); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  void (process.argv[2] === 'verify'
    ? readFile(process.argv[3] ?? OUTPUT, 'utf8').then(value => console.log(`Verified ${verifyCacheAcceptance(JSON.parse(value) as Wire)} comparisons.`))
    : (assert.equal(process.argv[2], 'run'), run())).catch(error => { console.error(error); process.exitCode = 1; }).finally(() => bridge.disconnect());
