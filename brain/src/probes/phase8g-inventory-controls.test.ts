import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { INVENTORY_LABELS, INVENTORY_REVISION, verifyInventoryPrivateProgress, verifyInventoryReport, verifyInventoryTerminal } from './phase8g-inventory-controls.js';
import { MUTATION_MARKER } from './phase8g-shadow-mutations.js';

type Wire = Record<string, unknown>;
const retained = JSON.parse(gunzipSync(await readFile(new URL('../../../context/evidence/data/phase8g-v5-acceptance/capacity.json.gz', import.meta.url))).toString('utf8')) as Wire;
const baseline = (retained.baselines as Wire[])[0]!.result as Wire;
const sourceToken = ((baseline.diagnosticSnapshot as Wire).token as Wire);
function status(progress: number, rebuild: number, phase = 'enumerating', reason = 'inventory-in-progress'): Wire {
  const published = phase === 'published';
  return { instrumentationRevision: MUTATION_MARKER, inventoryControlRevision: INVENTORY_REVISION, inventoryControlMaximumBatchCells: 64,
    complete: false, eligible: false, resident: 0, inventoryEnumerated: published, inventoryClipEntries: published ? 3 : 0,
    registryPublished: published, rebuildTerminal: phase !== 'enumerating',
    inventoryRebuild: { phase, reason, attempt: 1, token: { initDomain: sourceToken.initDomain, project: sourceToken.project,
      structure: sourceToken.structure, rebuild }, capturedGuard: { structureWitness: 'stable', verified: false, completeEventWindow: true },
      enumeratedCells: progress, totalCells: 40, terminal: phase !== 'enumerating', registryPublished: published,
      fullInventoryEnumerated: published, membershipComplete: false, complete: false, eligible: false,
      explicitRetryAvailable: phase === 'aborted', elapsedMs: reason === 'inventory-rebuild-budget' ? 40_501 : 1,
      lastBatchMs: 1, registryMetadataEstimatedBytes: published ? 9108 : 0 } };
}
function comparison(rebuild: number): Wire {
  const value = structuredClone(baseline); ((value.diagnosticSnapshot as Wire).token as Wire).rebuild = rebuild;
  return value;
}
function fixture(): Wire {
  const tracks = [
    { index: 0, position: 0, channelId: (retained.baselineTrackIds as string[])[0], name: 'Inst 1' },
    { index: 1, position: 1, channelId: (retained.baselineTrackIds as string[])[1], name: 'Audio 2' },
    { index: 2, position: 2, channelId: retained.ownedTrackId, name: 'gn-8g-reuse' },
    { index: 3, position: 3, channelId: (retained.baselineTrackIds as string[])[3], name: 'FX 1' },
    { index: 4, position: 4, channelId: (retained.baselineTrackIds as string[])[4], name: 'Master' },
  ];
  const slots = tracks.flatMap(track => Array.from({ length: 8 }, (_, row) => ({ id: track.channelId, row, exists: true, hasContent: track.channelId === retained.ownedTrackId && row < 3 })));
  return { marker: MUTATION_MARKER, inventoryControlRevision: INVENTORY_REVISION, researchOnly: true, complete: false, eligible: false,
    identityDetectionProved: false, hostInputFenceProved: false, missingEventContinuityProved: false, ambiguousMoveContinuityProved: false,
    fixtureRestored: true, temporaryClipRemoved: true, started: '2026-10-01T12:00:00Z', ended: '2026-10-01T12:02:00Z',
    ownedTrackId: retained.ownedTrackId, baselineTracks: tracks, finalTracks: structuredClone(tracks), baselineScenes: 8, finalScenes: 8,
    methods: retained.methods, initialRootEndpoint: retained.initialRootEndpoint, finalRootEndpoint: retained.initialRootEndpoint,
    witnessRootEndpoint: retained.initialRootEndpoint, slotsBefore: slots, slotsAfter: structuredClone(slots),
    originalBefore: retained.baselines, originalAfter: retained.restoration,
    retired: [0, 1].map(index => ({ index, phase: 'retired', complete: false, eligible: false, resident: 0, physicalPendingHints: 0 })),
    exactCancelled: { complete: false, eligible: false },
    cases: INVENTORY_LABELS.map((label, index) => {
      const rebuild = Number(sourceToken.rebuild) + index * 2 + 1;
      const reason = label === 'explicit-cancel' ? 'inventory-control-explicit-cancel' : label === 'total-deadline' ? 'inventory-rebuild-budget' : 'structural-event-requires-rebind';
      const partial = status(3, rebuild), recovered = status(40, rebuild + 1, 'published', 'identity-unverified');
      return { label, begin: status(0, rebuild), partial, terminalPolls: [status(3, rebuild, 'aborted', reason), status(3, rebuild, 'aborted', reason)],
        ...(index === 0 ? { action: { operation: 'rebuildCancel', reason } } : {}),
        ...(index === 1 ? { waitedMs: 40_501, heartbeats: Array.from({ length: 40 }, (_, i) => ({ elapsedMs: (i + 1) * 1000, pingMs: 25, info: partial })) } : {}),
        ...(index === 2 ? { createdAddress: { trackId: retained.ownedTrackId, row: 3 }, slotBefore: { hasContent: false }, slotCreated: { hasContent: true },
          slotRemoved: { hasContent: false }, createdClipCount: 1, temporaryClipRemoved: true, request: { trackIndex: 2, slotIndex: 3, lengthBeats: 4 } } : {}),
        recovery: { statuses: [recovered], result: recovered }, recoveryComparison: comparison(rebuild + 1), outcome: 'terminal-refusal-and-explicit-recovery' };
    }) };
}
test('private inventory controls verify against retained full field fixture oracles', () => {
  assert.equal(verifyInventoryReport(fixture()), 3);
});
test('begin must not read slots and progress must remain private', () => {
  const begin = status(0, 1), partial = status(3, 1); verifyInventoryPrivateProgress(begin, partial);
  const read = structuredClone(begin); (read.inventoryRebuild as Wire).enumeratedCells = 1;
  assert.throws(() => verifyInventoryPrivateProgress(read, partial));
  assert.throws(() => verifyInventoryPrivateProgress(begin, status(0, 1)));
  const published = status(3, 1, 'published'); assert.throws(() => verifyInventoryPrivateProgress(begin, published));
});
test('two terminal polls cannot retry or expose stale acquisition output', () => {
  const partial = status(3, 1), terminal = status(3, 1, 'aborted', 'cancel');
  verifyInventoryTerminal(partial, [terminal, structuredClone(terminal)], 'cancel');
  assert.throws(() => verifyInventoryTerminal(partial, [terminal, status(3, 2, 'aborted', 'cancel')], 'cancel'));
  assert.throws(() => verifyInventoryTerminal(partial, [terminal, status(4, 1, 'aborted', 'cancel')], 'cancel'));
  assert.throws(() => verifyInventoryTerminal(partial, [terminal, { ...terminal, authorityNotes: [] }], 'cancel'));
  assert.throws(() => verifyInventoryTerminal(partial, [terminal], 'cancel'));
});
test('deadline needs retained positive private progress and a full 40.5 second wait', () => {
  const short = fixture(); ((short.cases as Wire[])[1]!).waitedMs = 39_999; assert.throws(() => verifyInventoryReport(short));
  const missing = fixture(); ((missing.cases as Wire[])[1]!.heartbeats as Wire[]).pop(); assert.throws(() => verifyInventoryReport(missing));
  const stepped = fixture(); (((stepped.cases as Wire[])[1]!.heartbeats as Wire[])[0]!.info as Wire).inventoryRebuild = status(4, 1).inventoryRebuild;
  assert.throws(() => verifyInventoryReport(stepped));
});
test('explicit recovery needs a fresh token in both published registry and comparison', () => {
  const stale = fixture(), arm = (stale.cases as Wire[])[0]!;
  ((arm.recovery as Wire).result as Wire).inventoryRebuild = status(40, Number(sourceToken.rebuild) + 1, 'published').inventoryRebuild;
  assert.throws(() => verifyInventoryReport(stale));
  const mismatch = fixture(); ((((mismatch.cases as Wire[])[0]!.recoveryComparison as Wire).diagnosticSnapshot as Wire).token as Wire).rebuild = 0;
  assert.throws(() => verifyInventoryReport(mismatch));
});
test('event ownership and exact baseline restoration reject foreign writes and residue', () => {
  for (const change of [
    (report: Wire) => { ((report.cases as Wire[])[2]!.createdAddress as Wire).row = 0; },
    (report: Wire) => { ((report.cases as Wire[])[2]!.slotBefore as Wire).hasContent = true; },
    (report: Wire) => { (report.slotsAfter as Wire[]).at(-1)!.hasContent = true; },
    (report: Wire) => { report.finalScenes = 9; },
    (report: Wire) => { report.fixtureRestored = false; },
  ]) { const report = fixture(); change(report); assert.throws(() => verifyInventoryReport(report)); }
});
test('the report cannot certify missing-event continuity or eligibility', () => {
  for (const field of ['complete', 'eligible', 'identityDetectionProved', 'hostInputFenceProved', 'missingEventContinuityProved', 'ambiguousMoveContinuityProved']) {
    const report = fixture(); report[field] = true; assert.throws(() => verifyInventoryReport(report));
  }
});
