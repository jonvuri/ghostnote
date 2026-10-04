/** Check bounded topology and native acquisition controls. All cache gates stay closed. */
import assert from 'node:assert/strict';
import { ACQUIRED_FIELDS, checkMutationNotes } from './phase8g-shadow-mutations.js';
import type { ShadowNote, NormalizedValue } from './phase8g-shadow-cache-lib.js';
export type Wire = Record<string, unknown>;
export const NATIVE_MARKER = '8g4-shadow-topology-v1';
export const TOPOLOGY_MARKER = '8g4-direct-membership-v1';
export const BOUNDARIES = ['membership', 'authority', 'settlement', 'enrichment', 'result'] as const;
export type Boundary = typeof BOUNDARIES[number];
export interface TopologyTree {
  flat: { index: number; channelId: string; name: string; position: number; isGroup: boolean; expanded: boolean }[];
  roots: { count: number; offset: number; ids: string[] };
  children: Record<string, { count: number; offset: number; ids: string[] }>;
}
export function closed(value: Wire): void { assert.equal(value.complete, false); assert.equal(value.eligible, false); }
export function noPayload(value: Wire): void {
  for (const field of ['authorityNotes', 'diagnosticSnapshot', 'authoritativeSnapshot', 'historicalSnapshot', 'authorityMetadata', 'authorityCoverage'])
    assert.equal(value[field], undefined, `unexpected current or retained payload: ${field}`);
}
/** Recompute a forest from direct banks. Compare it with an external expected parent and child order. */
export function verifyTopology(value: Wire, expected?: { roots: string[]; children: Record<string, string[]> }): TopologyTree {
  assert.equal(value.topologyControlRevision, TOPOLOGY_MARKER); assert.equal(value.oracle, 'direct-child-banks');
  assert.equal(value.researchOnly, true); closed(value); assert.equal(value.hostInputOrderingProved, false);
  assert.equal(value.wrapperDeletionAllowed, false); assert.equal(value.membershipComplete, true); assert.equal(value.coherent, true);
  assert.equal(value.groupMembershipProved, true); assert.equal(value.callbacksChangedDuringRead, false);
  assert.equal(value.sequenceBeforeRead, value.sequenceAfterRead); assert.equal(value.maximumTracks, 16); assert.equal(value.readError, undefined);
  const tree = value.tree as TopologyTree; assert(tree && Array.isArray(tree.flat) && tree.flat.length <= 16);
  const ids = tree.flat.map((row, index) => { assert.equal(row.index, index); assert.equal(typeof row.isGroup, 'boolean');
    assert.equal(typeof row.expanded, 'boolean'); assert.equal(typeof row.name, 'string'); assert(Number.isInteger(row.position));
    assert.match(row.channelId, /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i); return row.channelId; });
  assert.equal(new Set(ids).size, ids.length);
  const parent = new Map<string, string | null>();
  const bank = (b: TopologyTree['roots'], p: string | null): void => {
    assert(b && Array.isArray(b.ids)); assert.equal(b.offset, 0); assert.equal(b.count, b.ids.length); assert(b.count <= 16);
    for (const id of b.ids) { assert(ids.includes(id), 'unknown descendant'); assert(!parent.has(id), 'duplicate parent'); parent.set(id, p); }
  };
  bank(tree.roots, null);
  assert.deepEqual(Object.keys(tree.children).sort(), tree.flat.filter(row => row.isGroup).map(row => row.channelId).sort(), 'omitted group bank');
  for (const [id, children] of Object.entries(tree.children)) bank(children, id);
  assert.equal(parent.size, ids.length, 'omitted descendants');
  for (const id of ids) { const seen = new Set<string>(); let at: string | null = id;
    while (at !== null) { assert(!seen.has(at), 'membership cycle'); seen.add(at); at = parent.get(at)!; } }
  if (expected) {
    assert.deepEqual(tree.roots.ids, expected.roots, 'wrong independent root address or order');
    assert.deepEqual(Object.fromEntries(Object.entries(tree.children).map(([id, b]) => [id, b.ids])), expected.children, 'wrong independent child address or order');
  }
  return tree;
}
export function atBoundary(value: Wire, boundary: Boundary): boolean {
  if (value.comparison !== 'pending' || value.scanActive !== true || value.terminal === true || value.scanStage !== boundary) return false;
  if (boundary === 'authority') return Number(value.scanProgressCoordinates) > 0 && Number(value.scanProgressCoordinates) < Number(value.scanTotalCoordinates);
  if (boundary === 'enrichment') { const c = value.snapshotCandidate as Wire | undefined;
    return c?.phase === 'enriching' && Number(c.coordinatesDone) > 0 && Number(c.coordinatesDone) < Number(c.coordinatesTotal); }
  return true;
}
export function independentNotes(raw: Wire): ShadowNote[] {
  assert.equal(raw.clipExists, true); assert(Array.isArray(raw.channels)); const channels = raw.channels as Wire[];
  assert.deepEqual(channels.map(v => v.channel), Array.from({ length: 16 }, (_, index) => index));
  const notes = channels.flatMap(c => { assert(Array.isArray(c.notes)); assert.equal(c.count, c.notes.length);
    return (c.notes as Wire[]).map(n => {
      const fields: Record<string, NormalizedValue> = {};
      for (const field of ACQUIRED_FIELDS) {
        if (['rawDuration', 'durationCells', 'rawGain', 'rawTimbre'].includes(field)) continue;
        const value = n[field]; assert(value === null || ['number', 'boolean', 'string'].includes(typeof value), `missing raw field ${field}`);
        fields[field] = value as NormalizedValue;
      }
      fields.rawDuration = fields.duration; fields.durationCells = Math.max(1, Math.floor(Number(fields.duration) * 512 + .5));
      fields.duration = Number(fields.durationCells) / 512; fields.rawGain = fields.gain;
      fields.rawTimbre = fields.timbre; fields.timbre = (Number(fields.rawTimbre) + 1) / 2;
      return { channel: Number(c.channel), cell: Number(n.x), pitch: Number(n.y), fields };
    }); });
  assert.equal(raw.count, notes.length); return notes;
}
/** Check the declared seed against fixed native inputs before it can become a field oracle. */
export function verifySeed(state: Wire, allowedPitches: readonly number[] = [60, 72]): void {
  assert(['New 1', '', undefined].every(name => state.project !== name));
  assert(allowedPitches.includes(Number(state.pitch))); assert.equal(state.clipName, `gn-8g4-${state.pitch}`);
  const notes = independentNotes(state.notes as Wire); assert.equal(notes.length, 64);
  for (let channel = 0; channel < 16; channel++) for (let index = 0; index < 4; index++) {
    const matches = notes.filter(note => note.channel === channel && note.cell === index * 8 && note.pitch === Number(state.pitch) + index);
    assert.equal(matches.length, 1); const fields = matches[0]!.fields;
    assert(Math.abs(Number(fields.velocity) - (80 + channel) / 127) < 1e-6); assert.equal(fields.rawDuration, 8 / 512);
  }
}
export function verifyComparison(value: Wire, state: Wire, marker = NATIVE_MARKER, allowedPitches: readonly number[] = [60, 72]): void {
  closed(value); assert.equal(value.instrumentationRevision, marker); assert.equal(value.comparison, 'match');
  assert.equal(value.authorityAvailable, true); assert.equal(value.stepWindowConfirmed, true); assert.equal(value.contentComparisonComplete, true);
  verifySeed(state, allowedPitches); const expected = independentNotes(state.notes as Wire), snapshot = value.diagnosticSnapshot as Wire;
  assert(snapshot); assert.deepEqual(snapshot.address, { trackId: state.trackId, row: 0 });
  const raw = state.metadata as Wire; assert(raw); assert.equal(raw.exists, true); assert.equal(raw.name, state.clipName);
  const metadata: Wire = { name: raw.name, isLoopEnabled: raw.loopEnabled };
  assert.equal(typeof metadata.isLoopEnabled, 'boolean');
  for (const field of ['playStart', 'playStop', 'loopStart', 'loopLength', 'colorRed', 'colorGreen', 'colorBlue', 'colorAlpha']) {
    assert.equal(typeof raw[field], 'number'); assert(Number.isFinite(raw[field])); metadata[field] = raw[field];
  }
  assert.deepEqual(snapshot.metadata, metadata); assert.deepEqual(value.authorityMetadata, metadata);
  for (const coverage of [snapshot.coverage, value.authorityCoverage] as Wire[]) {
    assert.equal(coverage.allChannels, true); assert.equal(coverage.width, 2048); assert.equal(coverage.startCell, 0);
    assert.equal(coverage.timingBasis, '1/512-beat'); assert(Array.isArray(coverage.fields)); assert.deepEqual([...coverage.fields as string[]].sort(), [...ACQUIRED_FIELDS].sort());
  }
  assert.deepEqual(checkMutationNotes(snapshot.notes as ShadowNote[], expected), []);
  assert.deepEqual(checkMutationNotes(value.authorityNotes as ShadowNote[], expected), []);
}
function time(value: unknown): number { assert.equal(typeof value, 'string'); const n = Date.parse(String(value)); assert(Number.isFinite(n)); return n; }
/** Command times are external UI times. They are not host input acknowledgements. */
export function orderingSummary(report: Wire): Wire {
  const source = report.source as Wire, target = report.target as Wire, boundary = report.boundary as Boundary;
  assert(BOUNDARIES.includes(boundary)); assert.notEqual(source.project, target.project); assert.notEqual(source.trackId, target.trackId);
  const samples = report.samples as Wire[]; assert(Array.isArray(samples) && samples.length > 1 && samples.length <= 400);
  const active = report.active as Wire; closed(active); noPayload(active); assert(atBoundary(active, boundary));
  assert.equal(typeof active.initDomain, 'string'); assert(String(active.initDomain).length > 0);
  assert(Number.isSafeInteger(active.scanId) && Number(active.scanId) > 0);
  let last = 0, terminal: Wire | undefined; const gaps: number[] = []; let observedTarget = 0;
  for (const sample of samples) {
    const start = time(sample.started), end = time(sample.ended); assert(end >= start && start >= last);
    if (last > 0 && start - last > 750) gaps.push(start - last); last = end;
    if (sample.error !== undefined) continue;
    const acquisition = sample.acquisition as Wire; closed(acquisition); noPayload(acquisition);
    assert.equal(acquisition.instrumentationRevision, NATIVE_MARKER); assert.equal(acquisition.initDomain, active.initDomain);
    if (acquisition.comparison === 'pending' && acquisition.scanActive === true) {
      assert.equal(acquisition.scanId, active.scanId); assert(atBoundary(acquisition, boundary), 'sampling changed the declared boundary');
    } else terminal ??= sample;
    const tracks = (sample.tracks as Wire).tracks as Wire[];
    if (tracks.some(t => t.channelId === target.trackId)) observedTarget++;
  }
  const command = report.command as Wire; assert(command); assert.equal(command.operation, 'select-project-tab');
  assert.equal(command.fromProject, source.project); assert.equal(command.toProject, target.project); assert.equal(command.completed, true);
  const started = time(command.started), ended = time(command.ended); assert(ended >= started);
  const before = samples.filter(s => time(s.ended) <= started && !(s.error) && atBoundary(s.acquisition as Wire, boundary)).at(-1);
  const contained = !!before && !!terminal && started - time(before.ended) <= 750 && ended < time(terminal.started);
  const errors = samples.filter(s => s.error !== undefined).length;
  for (const trace of [report.beforeTrace, report.afterTrace] as Wire[]) {
    assert(trace && Array.isArray(trace.events)); assert.equal(trace.traceRetained, trace.events.length);
    assert.equal(typeof trace.extensionInitNonce, 'string'); assert(String(trace.extensionInitNonce).length > 0);
    assert.equal(trace.extensionInitNonce, (report.beforeTrace as Wire).extensionInitNonce);
    assert.equal(trace.traceClearCount, (report.beforeTrace as Wire).traceClearCount);
  }
  const drops = Number((report.afterTrace as Wire).traceDroppedSinceClear);
  assert(Number.isSafeInteger(drops) && drops >= 0);
  return { accepted: contained && errors === 0 && gaps.length === 0 && drops === 0 && observedTarget > 0,
    commandInsideActiveAcquisition: contained, boundary, direction: `${source.project}->${target.project}`,
    acquisitionId: active.scanId, initDomain: active.initDomain,
    samples: samples.length, sampleErrors: errors, eventGaps: gaps.length, traceDrops: drops, targetSamples: observedTarget,
    terminalComparison: terminal ? (terminal.acquisition as Wire).comparison : null,
    callbackOriginProved: false, hostInputOrderingProved: false, missingEventContinuityProved: false };
}
export function verifyOrdering(report: Wire, accepted = true): Wire {
  assert.equal(report.schema, 'phase8g4-native-ordering-v1'); assert.equal(report.marker, NATIVE_MARKER);
  assert.equal(report.stage, 'finished'); assert.equal(report.researchOnly, true); closed(report);
  assert.equal(report.error, undefined); assert.equal(report.recoveryError, undefined); assert.equal(report.fixtureRestored, true);
  verifyComparison(report.baseline as Wire, report.source as Wire); verifyComparison(report.recovery as Wire, report.source as Wire);
  assert.equal((report.baseline as Wire).initDomain, (report.active as Wire).initDomain);
  assert.equal((report.recovery as Wire).initDomain, (report.active as Wire).initDomain);
  assert.deepEqual(independentNotes(report.recoveryNotes as Wire), independentNotes((report.source as Wire).notes as Wire));
  assert.deepEqual(report.finalTracks, (report.source as Wire).tracks); assert.equal(report.finalScenes, 8);
  const summary = orderingSummary(report); assert.deepEqual(report.summary, summary); assert.equal(summary.accepted, accepted);
  if (accepted) assert(['window-changed', 'step-window-changed'].includes(String(summary.terminalComparison)));
  return { ...summary, acceptedTrials: accepted ? 1 : 0, diagnosticTrials: accepted ? 0 : 1 };
}
