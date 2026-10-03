/** Check fixture cleanup and the final normal runtime against independent entry state. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { closed, NATIVE_MARKER, noPayload, verifySeed, verifyTopology, type Wire } from './phase8g4-native-lib.js';
export const BASELINE_CONFIG_SHA256 = '256bbf07094cd654c372d0e5e050e494ef7783c9a0001a0a2a688331bcf643b0';
export const ENTRY_BASELINE_SHA256 = 'bf7dee15b9473acd38e51062461d597031f41d9a2c5d80993c7c77d171a5cda5';
export function verifyFixtureCleanup(state: Wire): Wire {
  verifySeed(state); const cleanup = state.cleanup as Wire; assert(cleanup);
  assert.deepEqual(cleanup.tracks, state.tracks); assert.equal((cleanup.scan as Wire).slotsWithContent, 0);
  verifyTopology(cleanup.topology as Wire, { roots: ((state.tracks as Wire).tracks as Wire[]).map(t => String(t.channelId)), children: {} });
  const slots = cleanup.slots as Wire[]; assert.equal(slots.length, 32);
  const expected = ((state.tracks as Wire).tracks as Wire[]).flatMap(t => Array.from({ length: 8 }, (_, row) => [t.channelId, row]));
  assert.deepEqual(slots.map(s => [s.trackId, s.row]), expected);
  for (const slot of slots) { assert.equal(slot.exists, true); assert.equal(slot.hasContent, false); }
  for (const cursor of ['0', 'fine']) {
    const value = (cleanup.cursors as Wire)[cursor] as Wire;
    assert.equal(value.isPinned, false); assert.equal(value.cursorTrackPinned, false); assert.equal(value.slotExists, false);
  }
  return { project: state.project, emptySlots: 32, pinsReleased: true };
}
export function verifyResearchReload(report: Wire): Wire {
  const hello = report.hello as Wire, info = report.info as Wire;
  assert.equal(hello.runtimeProfile, 'phase-8-probe-v1'); assert.equal(hello.methodCount, 97); assert.equal(hello.methodsHash, 'f03f19414f40e3d3');
  closed(info); assert.equal(info.instrumentationRevision, NATIVE_MARKER); assert.equal(typeof info.initDomain, 'string');
  verifyTopology(report.topology as Wire); return { initDomain: info.initDomain, methods: 97 };
}
export function verifyTopologyReaderDiagnostic(report: Wire): Wire {
  assert.equal(report.schema, 'phase8g4-topology-read-diagnostic-v1'); closed(report); assert.equal(report.researchOnly, true);
  assert.equal(report.operation, 'topology-reader-preparation'); assert.equal(typeof report.error, 'string');
  const capture = report.capture as Wire, topology = capture.topology as Wire, status = capture.status as Wire;
  closed(topology); assert.equal(topology.membershipComplete, false); assert.equal(topology.wrapperDeletionAllowed, false);
  assert.equal(typeof topology.readError, 'string'); closed(status); noPayload(status); assert.equal(status.phase, 'retired');
  assert.equal(report.expectedFlatPosition, 1); assert.equal((report.actual as Wire).trackPosition, 0);
  assert.equal((report.command as Wire).operation, 'group-selected-tracks');
  return { preparationDiagnostics: 1, acceptedGroupCases: 0 };
}
export function verifyLiveRestoration(report: Wire): Wire {
  assert.equal(report.schema, 'phase8g4-live-restoration-v1'); closed(report); assert.equal(report.researchOnly, true);
  assert.equal(report.project, 'New 1'); assert.equal(report.originalOpen, true); assert.equal(report.originalUnsaved, true);
  assert.equal(report.originalSavedOrClosed, false); assert.deepEqual(report.closedFixtures, ['New 11', 'New 12']);
  assert.equal(report.fixturesSaved, false); assert.equal(report.researchArchiveRemoved, true);
  assert.equal(report.engineActiveObserved, true); assert.equal(report.transportStoppedObserved, true);
  assert.equal(report.positionObserved, '1.1.1.00'); assert.equal(report.identicalViewportProved, false);
  const bytes = Buffer.from(String(report.configBase64), 'base64');
  assert.equal(createHash('sha256').update(bytes).digest('hex'), BASELINE_CONFIG_SHA256);
  const entry = report.entry as Wire, final = report.final as Wire;
  const entryBytes = Buffer.from(String(report.entryRawBase64), 'base64');
  assert.equal(createHash('sha256').update(entryBytes).digest('hex'), ENTRY_BASELINE_SHA256);
  assert.deepEqual(JSON.parse(entryBytes.toString()), entry);
  for (const field of ['selection', 'tracks', 'trackCount', 'sceneCount', 'scan', 'slots', 'cursors', 'methodCount'])
    assert.deepEqual(final[field], entry[field], `final baseline differs: ${field}`);
  assert.equal(final.trackCount, 4); assert.equal(final.sceneCount, 8); assert.equal((final.slots as Wire[]).length, 32);
  const hello = report.hello as Wire;
  assert.equal(hello.runtimeProfile, 'normal-v1'); assert.equal(hello.methodCount, 85); assert.equal(hello.methodsHash, 'bba7383dce25c0f0');
  assert.equal(final.methodHash, hello.methodsHash); assert.equal(typeof report.initEpochMs, 'number');
  assert(Number(report.initEpochMs) > Date.parse('2026-10-03T03:12:40.486Z'));
  return { baselineRestored: true, normalMethods: 85, configRestored: true, identicalViewportProved: false };
}
