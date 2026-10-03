import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { gunzipSync, gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { ORDERING_ROLES, verifyNativeOrderingFiles } from './phase8g4-native-artifacts.js';
import { atBoundary, BOUNDARIES, independentNotes, NATIVE_MARKER, orderingSummary, TOPOLOGY_MARKER, verifyOrdering, verifyTopology,
  type Wire } from './phase8g4-native-lib.js';
import { ACQUIRED_FIELDS } from './phase8g-shadow-mutations.js';
import { verifyNativeTopologyReport } from './phase8g4-native-topology.js';
import { verifyFixtureCleanup, verifyLiveRestoration, verifyTopologyReaderDiagnostic } from './phase8g4-native-restoration.js';
const id = (n: number): string => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const bank = (...ids: string[]): Wire => ({ count: ids.length, offset: 0, ids });
function topology(expanded = true): Wire {
  const flat = [1, 2, 3, 4].map((n, index) => ({ index, position: index, channelId: id(n), name: `t${n}`, isGroup: n <= 2, expanded }));
  return { topologyControlRevision: TOPOLOGY_MARKER, oracle: 'direct-child-banks', researchOnly: true, complete: false, eligible: false,
    maximumTracks: 16, hostInputOrderingProved: false, membershipComplete: true, coherent: true, groupMembershipProved: true,
    sequenceBeforeRead: 1, sequenceAfterRead: 1, callbacksChangedDuringRead: false, wrapperDeletionAllowed: false,
    tree: { flat, roots: bank(id(1), id(4)), children: { [id(1)]: bank(id(2)), [id(2)]: bank(id(3)) } } };
}
test('independent direct banks close nested, expanded, and collapsed membership without write authority', () => {
  for (const expanded of [true, false]) verifyTopology(topology(expanded), { roots: [id(1), id(4)], children: { [id(1)]: [id(2)], [id(2)]: [id(3)] } });
});
test('omitted descendants, missing groups, unknown addresses, cycles, and wrong child order refuse', () => {
  const mutations = [
    (t: Wire) => { ((t.tree as Wire).children as Wire)[id(2)] = bank(); },
    (t: Wire) => { delete ((t.tree as Wire).children as Wire)[id(2)]; },
    (t: Wire) => { ((t.tree as Wire).children as Wire)[id(2)] = bank(id(9)); },
    (t: Wire) => { ((t.tree as Wire).children as Wire)[id(1)] = bank(id(2), id(3)); },
    (t: Wire) => { (t.tree as Wire).roots = bank(id(4)); ((t.tree as Wire).children as Wire)[id(2)] = bank(id(1), id(3)); },
    (t: Wire) => { (t.tree as Wire).roots = { ...bank(id(1), id(4)), offset: 1 }; },
    (t: Wire) => { t.sequenceAfterRead = 2; }, (t: Wire) => { t.membershipComplete = false; },
    (t: Wire) => { t.wrapperDeletionAllowed = true; }, (t: Wire) => { t.eligible = true; },
  ];
  for (const mutate of mutations) { const value = topology(); mutate(value); assert.throws(() => verifyTopology(value)); }
  assert.throws(() => verifyTopology(topology(), { roots: [id(4), id(1)], children: { [id(1)]: [id(2)], [id(2)]: [id(3)] } }));
});
const retained = JSON.parse(gunzipSync(await readFile(new URL('../../../context/evidence/data/phase8g-followup-acceptance/native-note-controls.json.gz', import.meta.url))).toString()) as Wire;
const template = (((retained.prepare as Wire).target as Wire).notes as Wire[])[0]!.fields as Wire;
function state(pitch = 60, n = 5): Wire {
  const channels = Array.from({ length: 16 }, (_, channel) => ({ channel, count: 4, notes: Array.from({ length: 4 }, (_, cell) => ({
    ...template, velocity: (80 + channel) / 127, duration: 8 / 512, timbre: template.rawTimbre, x: cell * 8, y: pitch + cell, channel,
  })) }));
  return { project: `P${n}`, trackId: id(n), pitch, clipName: `gn-8g4-${pitch}`, tracks: { tracks: [{ channelId: id(n) }] },
    metadata: { exists: true, name: `gn-8g4-${pitch}`, loopEnabled: true, playStart: 0, playStop: 4, loopStart: 0, loopLength: 4,
      colorRed: .5, colorGreen: .5, colorBlue: .5, colorAlpha: 1 }, notes: { channels, count: 64, clipExists: true } };
}
function match(source: Wire): Wire {
  const coverage = { startCell: 0, width: 2048, allChannels: true, timingBasis: '1/512-beat', fields: [...ACQUIRED_FIELDS] };
  const notes = independentNotes(source.notes as Wire), { exists: _exists, loopEnabled, ...raw } = source.metadata as Wire;
  const metadata = { ...raw, isLoopEnabled: loopEnabled };
  return { instrumentationRevision: NATIVE_MARKER, initDomain: 'init', complete: false, eligible: false, comparison: 'match', authorityAvailable: true,
    stepWindowConfirmed: true, contentComparisonComplete: true, diagnosticSnapshot: { address: { trackId: source.trackId, row: 0 }, notes, metadata, coverage },
    authorityNotes: notes, authorityMetadata: metadata, authorityCoverage: coverage };
}
const clock = (ms: number): string => new Date(Date.UTC(2026, 9, 3) + ms).toISOString();
function report(boundary: typeof BOUNDARIES[number] = 'membership'): Wire {
  const source = state(), target = state(72, 6), active = { comparison: 'pending', scanActive: true, scanId: 1, scanStage: boundary,
    complete: false, eligible: false, instrumentationRevision: NATIVE_MARKER, initDomain: 'init', scanProgressCoordinates: 8, scanTotalCoordinates: 262144,
    snapshotCandidate: { phase: 'enriching', coordinatesDone: 1, coordinatesTotal: 4 } };
  const terminal = { ...active, comparison: 'window-changed', scanActive: false }; delete (terminal as Wire).scanId;
  const samples = [
    { started: clock(0), ended: clock(100), acquisition: structuredClone(active), tracks: source.tracks },
    { started: clock(150), ended: clock(250), acquisition: structuredClone(active), tracks: source.tracks },
    { started: clock(400), ended: clock(500), acquisition: terminal, tracks: target.tracks },
  ];
  const trace = { events: [], traceRetained: 0, traceDroppedSinceClear: 0, traceClearCount: 1, extensionInitNonce: 'init' };
  const value: Wire = { schema: 'phase8g4-native-ordering-v1', marker: NATIVE_MARKER, researchOnly: true, complete: false, eligible: false,
    stage: 'finished', source, target, boundary, active, baseline: match(source), recovery: match(source), recoveryNotes: source.notes,
    fixtureRestored: true, finalTracks: source.tracks, finalScenes: 8, samples, beforeTrace: trace, afterTrace: structuredClone(trace),
    command: { operation: 'select-project-tab', fromProject: source.project, toProject: target.project, completed: true, started: clock(275), ended: clock(300) } };
  value.summary = orderingSummary(value); return value;
}
test('each named publication boundary has active command timing and independent recovery', () => {
  for (const boundary of BOUNDARIES) { const r = report(boundary); assert(atBoundary(r.active as Wire, boundary)); assert.equal(verifyOrdering(r).acceptedTrials, 1); }
});
test('return transitions use a separate acquisition and denominator', () => {
  const value = report(); const old = value.source; value.source = value.target; value.target = old;
  const source = value.source as Wire; value.baseline = match(source); value.recovery = match(source); value.recoveryNotes = source.notes;
  value.finalTracks = source.tracks; const samples = value.samples as Wire[]; samples[0]!.tracks = source.tracks; samples[1]!.tracks = source.tracks;
  samples[2]!.tracks = (value.target as Wire).tracks; const command = value.command as Wire; command.fromProject = source.project; command.toProject = (value.target as Wire).project;
  value.summary = orderingSummary(value); assert.equal(verifyOrdering(value).acceptedTrials, 1);
});
test('late commands, sample errors, event gaps, trace drops, and unobserved target stay diagnostic', () => {
  for (const mutate of [
    (r: Wire) => { (r.command as Wire).started = clock(510); (r.command as Wire).ended = clock(520); },
    (r: Wire) => { (r.samples as Wire[])[1]!.error = 'timeout'; },
    (r: Wire) => { (r.afterTrace as Wire).traceDroppedSinceClear = 1; },
    (r: Wire) => { (r.samples as Wire[])[2]!.tracks = (r.source as Wire).tracks; },
    (r: Wire) => { (r.samples as Wire[])[2]!.started = clock(2000); (r.samples as Wire[])[2]!.ended = clock(2100); },
  ]) { const r = report(); mutate(r); r.summary = orderingSummary(r); assert.throws(() => verifyOrdering(r)); assert.equal(verifyOrdering(r, false).acceptedTrials, 0); }
});
test('wrong addresses, current payload after retirement, altered operation and field declarations fail', () => {
  for (const mutate of [
    (r: Wire) => { ((r.recovery as Wire).diagnosticSnapshot as Wire).address = { trackId: id(9), row: 0 }; },
    (r: Wire) => { ((r.samples as Wire[])[2]!.acquisition as Wire).authorityNotes = []; },
    (r: Wire) => { (r.command as Wire).operation = 'add-scene'; },
    (r: Wire) => { (r.source as Wire).pitch = 61; },
    (r: Wire) => { ((r.recovery as Wire).authorityNotes as Wire[])[0]!.fields = { ...template, velocity: .5 }; },
    (r: Wire) => { ((r.recovery as Wire).authorityCoverage as Wire).allChannels = false; },
    (r: Wire) => { (r.active as Wire).scanId = 8; },
    (r: Wire) => { (r.afterTrace as Wire).traceClearCount = 2; },
  ]) { const r = report(); mutate(r); assert.throws(() => verifyOrdering(r)); }
});
test('valid artifact hashes cannot admit wrong addresses, stale payload, late commands, or altered declarations', async () => {
  const bundle = async (value: Wire): Promise<Wire> => {
    const raw = Buffer.from(JSON.stringify(value)), compressed = gzipSync(raw);
    const sha = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');
    const manifest: Wire = { schema: 'phase8g4-native-evidence-v1', marker: NATIVE_MARKER, researchOnly: true,
      complete: false, eligible: false, wholeSessionComplete: false,
      pending: [...ORDERING_ROLES.filter(role => role !== 'ordering-membership'), 'native-group-membership', 'final-live-baseline'],
      files: { 'ordering-membership': { file: 'ordering-membership.json.gz', compressedBytes: compressed.length,
        compressedSha256: sha(compressed), uncompressedBytes: raw.length, uncompressedSha256: sha(raw) } } };
    return await verifyNativeOrderingFiles(manifest, async () => compressed);
  };
  assert.equal((await bundle(report())).acceptedNativeTrials, 1);
  for (const mutate of [
    (r: Wire) => { ((r.recovery as Wire).diagnosticSnapshot as Wire).address = { trackId: id(9), row: 0 }; },
    (r: Wire) => { ((r.samples as Wire[])[2]!.acquisition as Wire).diagnosticSnapshot = {}; },
    (r: Wire) => { (r.command as Wire).started = clock(510); (r.command as Wire).ended = clock(520); r.summary = orderingSummary(r); },
    (r: Wire) => { r.boundary = 'result'; },
    (r: Wire) => { ((r.recovery as Wire).authorityCoverage as Wire).fields = []; },
  ]) { const value = report(); mutate(value); await assert.rejects(bundle(value)); }
});
const nativeFile = async (name: string): Promise<Wire> => JSON.parse(gunzipSync(await readFile(new URL(
  `../../../context/evidence/data/phase8g4-native/${name}.json.gz`, import.meta.url))).toString()) as Wire;
test('native group membership remains unsupported and exact Ungroup recovery passes', async () => {
  const value = await nativeFile('native-group-membership'), summary = verifyNativeTopologyReport(value);
  assert.equal(summary.supportedGroupCases, 0); assert.equal(summary.unsupportedGroupCases, 1);
  assert.equal(summary.expandedCollapsedNestedAndChildOrderProved, false); assert.equal(summary.actions, 2);
  assert.equal(summary.diagnosticCommandAttempts, 1); assert.deepEqual(summary, value.summary);
  assert.equal(verifyTopologyReaderDiagnostic(await nativeFile('topology-reader-diagnostic')).acceptedGroupCases, 0);
});
test('rehashed native group bundles reject omitted census rows, stale output, wrong addresses, and altered declarations', async () => {
  const original = await nativeFile('native-group-membership');
  const bundle = async (value: Wire): Promise<Wire> => {
    const raw = Buffer.from(JSON.stringify(value)), bytes = gzipSync(raw), sha = (b: Buffer): string => createHash('sha256').update(b).digest('hex');
    return await verifyNativeOrderingFiles({ schema: 'phase8g4-native-evidence-v1', marker: NATIVE_MARKER, researchOnly: true,
      complete: false, eligible: false, wholeSessionComplete: false, pending: [...ORDERING_ROLES, 'final-live-baseline'],
      files: { 'native-group-membership': { file: 'native-group-membership.json.gz', compressedBytes: bytes.length,
        uncompressedBytes: raw.length, compressedSha256: sha(bytes), uncompressedSha256: sha(raw) } } }, async () => bytes);
  };
  await bundle(original);
  for (const mutate of [
    (r: Wire) => { ((((r.captures as Wire[])[1]!.topology as Wire).tree as Wire).flat as Wire[]).splice(2, 1); },
    (r: Wire) => { ((r.captures as Wire[])[1]!.status as Wire).diagnosticSnapshot = {}; },
    (r: Wire) => { ((r.recovery as Wire).diagnosticSnapshot as Wire).address = { trackId: id(99), row: 0 }; },
    (r: Wire) => { (r.commands as Wire[])[0]!.operation = 'group-all-tracks'; },
    (r: Wire) => { ((r.captures as Wire[])[1]!.topology as Wire).membershipComplete = true; },
    (r: Wire) => { ((r.recovery as Wire).authorityCoverage as Wire).fields = []; },
    (r: Wire) => { r.wrapperDeleted = true; },
    (r: Wire) => { r.membershipScope = 'bounded-direct-banks'; },
  ]) { const value = structuredClone(original); mutate(value); await assert.rejects(bundle(value)); }
});
test('both owned fixtures have exact empty slot coverage and released pins', async () => {
  for (const role of ['fixture-p-cleanup', 'fixture-q-cleanup']) {
    const state = await nativeFile(role); assert.equal(verifyFixtureCleanup(state).emptySlots, 32);
    for (const mutate of [
      (r: Wire) => { ((r.cleanup as Wire).slots as Wire[])[0]!.hasContent = true; },
      (r: Wire) => { ((r.cleanup as Wire).slots as Wire[])[1]!.row = 0; },
      (r: Wire) => { (((r.cleanup as Wire).cursors as Wire).fine as Wire).isPinned = true; },
    ]) { const value = structuredClone(state); mutate(value); assert.throws(() => verifyFixtureCleanup(value)); }
  }
});
test('modeled native reports require expanded, collapsed, nested, and moved child order from the external oracle', async () => {
  const value = await nativeFile('native-group-membership'), source = value.source as Wire;
  const plain = (value.captures as Wire[])[0]!, restored = (value.captures as Wire[]).at(-1)!;
  const original = (source.tracks as Wire).tracks as Wire[], [a, b, fx, master] = original;
  const outer = { channelId: id(20), name: 'Outer', type: 'Group' }, inner = { channelId: id(21), name: 'Inner', type: 'Group' };
  const capture = (label: string, rows: Wire[], roots: string[], children: Record<string, string[]>, expanded = true): Wire => {
    const c = structuredClone(plain), tracks: Wire[] = rows.map((t, index) => ({ ...t, index, position: index }));
    c.label = label; c.status = { phase: 'retired', complete: false, eligible: false };
    c.tracks = { ...(source.tracks as Wire), tracks, count: tracks.length, itemCount: tracks.length };
    const t = structuredClone(topology(expanded));
    t.tree = { flat: tracks.map(t => ({ ...t, isGroup: t.type === 'Group', expanded: t.type === 'Group' && expanded })), roots: bank(...roots),
      children: Object.fromEntries(Object.entries(children).map(([id, ids]) => [id, bank(...ids)])) };
    c.topology = t; return c;
  };
  const roots = [String(outer.channelId), String(fx!.channelId), String(master!.channelId)];
  value.membershipScope = 'bounded-direct-banks'; value.outerId = outer.channelId; value.innerId = inner.channelId; value.commandDiagnostics = [];
  value.captures = [plain,
    capture('expanded', [outer, a!, b!, fx!, master!], roots, { [id(20)]: [String(a!.channelId), String(b!.channelId)] }),
    capture('collapsed', [outer, a!, b!, fx!, master!], roots, { [id(20)]: [String(a!.channelId), String(b!.channelId)] }, false),
    capture('nested', [outer, inner, a!, b!, fx!, master!], roots, { [id(20)]: [id(21), String(b!.channelId)], [id(21)]: [String(a!.channelId)] }),
    capture('child-moved', [outer, b!, inner, a!, fx!, master!], roots, { [id(20)]: [String(b!.channelId), id(21)], [id(21)]: [String(a!.channelId)] }), restored];
  value.commands = ['group-selected-tracks', 'collapse-group', 'group-selected-track', 'move-child-before-sibling', 'restore-child-order',
    'ungroup-selected-track', 'ungroup-selected-track'].map((operation, index) => ({ operation, project: source.project, completed: true, started: clock(index), ended: clock(index) }));
  assert.equal(verifyNativeTopologyReport(value).supportedGroupCases, 4);
  ((((value.captures as Wire[])[4]!.topology as Wire).tree as Wire).children as Wire)[id(20)] = bank(id(21), String(b!.channelId));
  assert.throws(() => verifyNativeTopologyReport(value));
});
test('normal restoration requires pinned entry bytes, config bytes, API equality, and a fresh normal runtime', async () => {
  const raw = gunzipSync(await readFile(new URL('../../../context/evidence/data/phase8g4-native/entry-baseline.json.gz', import.meta.url)));
  const entry = JSON.parse(raw.toString()) as Wire;
  const value: Wire = { schema: 'phase8g4-live-restoration-v1', researchOnly: true, complete: false, eligible: false, project: 'New 1',
    originalOpen: true, originalUnsaved: true, originalSavedOrClosed: false, closedFixtures: ['New 11', 'New 12'], fixturesSaved: false,
    researchArchiveRemoved: true, engineActiveObserved: true, transportStoppedObserved: true, positionObserved: '1.1.1.00', identicalViewportProved: false,
    entryRawBase64: raw.toString('base64'), entry, final: { ...structuredClone(entry), methodHash: 'bba7383dce25c0f0' },
    configBase64: Buffer.from('{ "recordChars": 0, "stamp": "default" }\n').toString('base64'),
    hello: { runtimeProfile: 'normal-v1', methodCount: 85, methodsHash: 'bba7383dce25c0f0' }, initEpochMs: Date.parse('2026-10-03T04:00:00Z') };
  assert.equal(verifyLiveRestoration(value).baselineRestored, true);
  for (const mutate of [
    (r: Wire) => { r.configBase64 = Buffer.from('{}').toString('base64'); },
    (r: Wire) => { (r.final as Wire).selection = {}; },
    (r: Wire) => { r.entryRawBase64 = Buffer.from(JSON.stringify(r.entry)).toString('base64'); },
    (r: Wire) => { (r.hello as Wire).runtimeProfile = 'phase-8-probe-v1'; },
    (r: Wire) => { r.originalSavedOrClosed = true; },
    (r: Wire) => { r.identicalViewportProved = true; },
    (r: Wire) => { r.initEpochMs = 0; },
  ]) { const r = structuredClone(value); mutate(r); assert.throws(() => verifyLiveRestoration(r)); }
});
