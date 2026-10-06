// 8h3e removed the research wire or rig configuration that this live driver uses. Live use needs the
// earlier research build of its own session. Its retained artifacts and offline checks do not need a host.
/** Verify bounded shadow-handle reuse on the owned replay fixture. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { BridgeClient } from '../client.js';
import { checkExpectedFixture } from './phase8g-lifecycle-reuse.js';
import { compareShadowSnapshots, shadowSnapshotFromWire, type ShadowCacheWireSnapshot } from './phase8g-shadow-cache-lib.js';

type Wire = Record<string, unknown>;
const MARKER = '8g-shadow-physical-hints-v3';
const OUTPUT = '/tmp/ghostnote-8g-shadow-reuse-v3-results.json';
const bridge = new BridgeClient();
const wait = async (): Promise<void> => await new Promise(resolve => setTimeout(resolve, 50));
async function shadow(operation: string, params: Wire = {}): Promise<Wire> {
  return await bridge.request('cache.shadow', { operation, ...params }) as Wire;
}
async function poll(read: () => Promise<Wire>, done: (value: Wire) => boolean, limit = 40_000): Promise<Wire> {
  const started = performance.now();
  for (;;) { const value = await read(); if (done(value)) return value;
    assert(performance.now() - started < limit, `poll expired: ${JSON.stringify(value)}`); await wait(); }
}
export function checkComparison(value: Wire, row: number, trackId?: string): readonly string[] {
  const issues: string[] = [];
  if (value.comparison !== 'match') return [`comparison:${String(value.comparison)}`];
  const wire = value.diagnosticSnapshot as ShadowCacheWireSnapshot;
  assert(wire && Array.isArray(value.authorityNotes) && value.authorityMetadata);
  if (wire.address.row !== row || (trackId !== undefined && wire.address.trackId !== trackId)) issues.push('fixture-address-mismatch');
  const expectedName = `gn-8g-reuse-${['A', 'B', 'empty'][row]}`;
  if (wire.metadata.name !== expectedName || (value.authorityMetadata as Wire).name !== expectedName) issues.push('fixture-clip-name-mismatch');
  const authorityCoverage = value.authorityCoverage as ShadowCacheWireSnapshot['coverage'];
  for (const coverage of [wire.coverage, authorityCoverage]) {
    if (!coverage || coverage.startCell !== 0 || coverage.width !== 2048 || coverage.allChannels !== true
      || coverage.timingBasis !== '1/512-beat') issues.push('fixture-coverage-mismatch');
  }
  const cached = shadowSnapshotFromWire(wire, 'complete');
  const authority = shadowSnapshotFromWire({ ...wire, notes: value.authorityNotes, coverage: authorityCoverage ?? wire.coverage,
    metadata: value.authorityMetadata as ShadowCacheWireSnapshot['metadata'] } as ShadowCacheWireSnapshot, 'complete');
  if (compareShadowSnapshots(cached, authority, { before: cached.window, after: cached.window }).outcome !== 'match') issues.push('typed-comparison');
  issues.push(...checkExpectedFixture(cached.notes, row), ...checkExpectedFixture(authority.notes, row));
  if (value.complete !== false || value.eligible !== false || value.callbackSourceIdentityKnown !== false) issues.push('unproved-eligibility');
  if (value.physicalPendingHints !== 0 || value.physicalHintOverflow !== false
    || value.pendingWorkItemsIncludingPhysicalHints !== 0) issues.push('physical-work-incomplete');
  if (value.stepDataObservers !== 3 || value.residentHandles !== 2 || value.observerKind !== 'addStepDataObserver') issues.push('physical-pool-or-family-changed');
  return issues;
}
export function checkBinding(value: Wire, reset: boolean): void {
  assert(Array.isArray(value.binding) && value.binding.length > 0);
  const before = value.before as Wire, first = value.binding[0] as Wire, last = value.binding.at(-1) as Wire;
  assert.equal(last.canaryPhase, 'target'); assert.equal(last.bindingReady, true);
  assert.equal(last.canaryVerifiedForBinding, true);
  assert.equal(first.recorderPreserved, !reset);
  assert.equal(typeof before.physicalBindingRevision, 'number');
  if (reset) assert(Number(last.physicalBindingRevision) > Number(before.physicalBindingRevision), 'reset must advance the physical binding');
  else assert.equal(last.physicalBindingRevision, before.physicalBindingRevision, 'warm reads must preserve the physical binding');
}
/** An interrupted scan must refuse its output and remain terminal on another poll. */
export function checkCancellation(value: Wire): void {
  const active = value.active as Wire;
  assert.equal(active.comparison, 'pending');
  assert(Number(active.scanProgressCoordinates) > 0 && Number(active.scanProgressCoordinates) < Number(active.scanTotalCoordinates),
    'interruption must occur during an active scan');
  assert(Array.isArray(value.after) && value.after.length === 2);
  for (const status of value.after as Wire[]) {
    assert.equal(status.comparison, 'window-changed'); assert.equal(status.authorityAvailable, false);
    assert.equal(status.complete, false); assert.equal(status.eligible, false); assert.equal(status.readMode, 'refuse');
    assert.equal(status.fallbackReason, 'authority-scan-cancelled');
    assert.equal(status.windowChanges, Number(active.windowChanges) + 1);
    assert.equal(status.diagnosticSnapshot, undefined); assert.equal(status.authorityNotes, undefined);
  }
}
/** Require the full live sequence before accepting its retained results. */
export function verifyShadowReuseReport(report: Wire): number {
  assert.equal(report.researchOnly, true);
  assert.equal(report.complete, false);
  assert.equal(report.eligible, false);
  const marker = (report.initial as Wire)?.instrumentationRevision;
  assert(['8g-shadow-physical-hints-v2', MARKER].includes(String(marker)));
  if (marker === MARKER) assert.equal(typeof report.ownedTrackId, 'string');
  assert.equal((report.initial as Wire)?.steps, 2048);
  assert.equal((report.initial as Wire)?.residentHandles, 2);
  assert(Array.isArray(report.cases) && typeof report.ended === 'string');
  const expected: { label: string; row: number; reset: boolean }[] = [
    { label: 'forced-initialization-A', row: 0, reset: true },
    { label: 'warm-preserves-A', row: 0, reset: false },
  ];
  for (let cycle = 0; cycle < 2; cycle++) for (const [index, row] of [1, 0, 2, 0].entries()) {
    expected.push({ label: `evict-reacquire-${cycle}-${index}-row-${row}`, row, reset: true },
      { label: `warm-${cycle}-${index}-row-${row}`, row, reset: false });
  }
  assert.equal(report.cases.length, expected.length, 'the bounded reuse sequence is incomplete');
  for (const [index, value] of (report.cases as Wire[]).entries()) {
    const target = expected[index]!;
    assert.equal(value.label, target.label); assert.equal(value.row, target.row); assert.equal(value.reset, target.reset);
    assert.equal(value.outcome, 'match'); assert.equal((value.result as Wire).instrumentationRevision, marker);
    assert.deepEqual(checkComparison(value.result as Wire, target.row, report.ownedTrackId as string | undefined), []);
    checkBinding(value, target.reset);
  }
  if (marker === MARKER) {
    assert(Array.isArray(report.cancellations)); assert.equal(report.cancellations.length, 2);
    for (const [index, value] of (report.cancellations as Wire[]).entries()) {
      assert.equal(value.kind, ['retire-between-polls', 'rebind-between-polls'][index]);
      checkCancellation(value);
      checkBinding(value.recovery as Wire, true);
      assert.deepEqual(checkComparison((value.recovery as Wire).result as Wire, 0, report.ownedTrackId as string), []);
    }
  }
  return expected.length;
}
async function run(): Promise<void> {
  const state = JSON.parse(await readFile('/tmp/ghostnote-8g-research-state.json', 'utf8')) as { ownedTrackId: string };
  const inventory = await bridge.request('track.list') as { tracks: { index: number; channelId: string; name: string }[] };
  const track = inventory.tracks.find(value => value.channelId === state.ownedTrackId);
  assert(track && track.name === 'gn-8g-reuse');
  const initial = await shadow('info'); assert.equal(initial.instrumentationRevision, MARKER);
  assert.equal(initial.steps, 2048); assert.equal(initial.residentHandles, 2);
  const report: Wire = { started: new Date().toISOString(), researchOnly: true, complete: false, eligible: false,
    hello: await bridge.request('contract.hello'), ownedTrackId: state.ownedTrackId, initial, cases: [], cancellations: [] };
  const cases = report.cases as Wire[];
  const persist = async (): Promise<void> => await writeFile(OUTPUT, JSON.stringify(report, null, 2) + '\n');
  const bind = async (row: number, reset: boolean): Promise<Wire[]> => {
    const statuses = [await shadow('point', { index: 0, trackIndex: track.index, row,
      ...(reset ? { canaryTrackIndex: track.index, canaryRow: row === 0 ? 1 : 0 } : {}) })];
    await poll(async () => { const status = await shadow('poll', { index: 0 }); statuses.push(status); return status; },
      value => value.phase === 'retired' || ((value.phase === 'settled' || value.phase === 'complete') && value.canaryPhase === 'target'));
    assert(['settled', 'complete'].includes(String(statuses.at(-1)!.phase)), 'binding refused'); return statuses;
  };
  const compare = async (): Promise<Wire> => {
    let result = await shadow('compareStart', { index: 0 });
    return await poll(async () => { if (result.comparison === 'pending') result = await shadow('comparePoll'); return result; }, value => value.comparison !== 'pending');
  };
  const arm = async (label: string, row: number, reset: boolean): Promise<void> => {
    const result: Wire = { label, row, reset, before: await shadow('status', { index: 0 }) };
    cases.push(result); const started = performance.now(); await persist();
    try { result.binding = await bind(row, reset);
      checkBinding(result, reset);
      result.reconciliation = await shadow('reconcile', { index: 0 });
      result.result = await compare(); result.issues = checkComparison(result.result as Wire, row, state.ownedTrackId);
      result.outcome = (result.issues as string[]).length === 0 ? 'match' : 'failure';
    } catch (error) { result.outcome = 'error'; result.error = String(error); }
    result.wallMs = performance.now() - started; result.after = await shadow('status', { index: 0 }); await persist();
    console.log(JSON.stringify({ label, outcome: result.outcome, issues: result.issues, wallMs: result.wallMs }));
    assert.equal(result.outcome, 'match', `${label}: ${JSON.stringify(result.issues ?? result.error)}`);
  };
  try {
    await shadow('inventory');
    await arm('forced-initialization-A', 0, true);
    await arm('warm-preserves-A', 0, false);
    for (let cycle = 0; cycle < 2; cycle++) for (const [index, row] of [1, 0, 2, 0].entries()) {
      await shadow('retire', { index: 0 }); await arm(`evict-reacquire-${cycle}-${index}-row-${row}`, row, true);
      await arm(`warm-${cycle}-${index}-row-${row}`, row, false);
    }
    for (const kind of ['retire-between-polls', 'rebind-between-polls']) {
      const value: Wire = { kind }; (report.cancellations as Wire[]).push(value); await persist();
      let active = await shadow('compareStart', { index: 0 });
      value.active = await poll(async () => { if (active.comparison === 'pending') active = await shadow('comparePoll'); return active; },
        status => status.comparison !== 'pending' || Number(status.scanProgressCoordinates) > 0);
      if (kind === 'retire-between-polls') value.action = await shadow('retire', { index: 0 });
      else value.action = await shadow('point', { index: 0, trackIndex: track.index, row: 1,
        canaryTrackIndex: track.index, canaryRow: 0 });
      value.after = [await shadow('comparePoll'), await shadow('comparePoll')];
      await persist(); checkCancellation(value);
      const recovery: Wire = { before: await shadow('status', { index: 0 }) };
      value.recovery = recovery; recovery.binding = await bind(0, true); checkBinding(recovery, true);
      recovery.reconciliation = await shadow('reconcile', { index: 0 }); recovery.result = await compare();
      assert.deepEqual(checkComparison(recovery.result as Wire, 0, state.ownedTrackId), []);
      console.log(JSON.stringify({ kind, outcome: 'cancelled-and-recovered' })); await persist();
    }
    report.final = await shadow('info'); report.ended = new Date().toISOString(); await persist();
  } finally { await shadow('retire', { index: 0 }); }
}
async function main(): Promise<void> {
  if (process.argv[2] === 'verify') {
    const report = JSON.parse(await readFile(process.argv[3] ?? OUTPUT, 'utf8')) as Wire;
    console.log(`Bounded shadow reuse passes ${verifyShadowReuseReport(report)} retained cases; eligibility remains unproved.`);
  } else { assert.equal(process.argv[2], 'run'); await run(); }
}
if (process.argv[1]?.endsWith('phase8g-shadow-reuse.ts')) void main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => bridge.disconnect());
