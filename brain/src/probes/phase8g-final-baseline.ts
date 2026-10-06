// 8h3e removed the research wire or rig configuration that this live driver uses. Live use needs the
// earlier research build of its own session. Its retained artifacts and offline checks do not need a host.
/** Verify fixture removal and a restored normal runtime from retained observations. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
type Wire = Record<string, unknown>;
function object(value: unknown, name: string): Wire {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${name} must be an object`); return value as Wire;
}
function timestamp(value: unknown, name: string): number {
  assert(typeof value === 'string' && Number.isFinite(Date.parse(value)), `${name} is unavailable`); return Date.parse(value);
}
function completed(value: Wire): void {
  assert(timestamp(value.ended, 'cleanup end') >= timestamp(value.started, 'cleanup start')); assert.equal(value.error, undefined);
}
function normalHello(value: unknown): void {
  const hello = object(value, 'normal hello'); assert.equal(hello.runtimeProfile, 'normal-v1');
  assert.equal(hello.contractVersion, 0); assert.equal(hello.hostApiVersion, 25);
  assert.equal(hello.methodCount, 85); assert.equal(hello.methodsHash, 'bba7383dce25c0f0');
}
function closedClaims(value: Wire): void {
  for (const field of ['wholeSessionComplete', 'complete', 'eligible', 'identityDetectionProved', 'projectContinuityProved', 'hostInputFenceProved'])
    if (Object.hasOwn(value, field)) assert.equal(value[field], false);
}
/** Check raw observations, not only the helper's verified flag. */
export function verifyFinalBaselineReports(cleanupValue: unknown, verifiedValue: unknown, baselineValue: unknown): Wire {
  const cleanup = object(cleanupValue, 'cleanup'), verified = object(verifiedValue, 'verified cleanup'), baseline = object(baselineValue, 'final baseline');
  for (const value of [cleanup, verified, baseline]) closedClaims(value);
  completed(cleanup); completed(verified); assert.equal(cleanup.cleaned, true); assert.equal(verified.verified, true);
  assert.equal(verified.stateRetentionPolicy, 'retain'); assert(timestamp(verified.started, 'normal verification start') >= timestamp(cleanup.ended, 'fixture removal end'));
  const entry = object(cleanup.entryState, 'cleanup entry state'); assert.deepEqual(verified.entryState, entry); assert.deepEqual(baseline.entryState, entry);
  const ids = entry.baselineIds as string[]; assert(Array.isArray(ids) && ids.length === 4); assert.equal(new Set(ids).size, 4);
  ids.forEach(id => assert.match(id, /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/));
  assert.equal(entry.baselineScenes, 8); assert.equal(entry.baselineSlotsWithContent, 0);
  assert(typeof entry.ownedTrackId === 'string' && !ids.includes(entry.ownedTrackId));
  assert.deepEqual(verified.baselineIds, ids); assert.equal(verified.sceneCount, 8);
  normalHello(verified.hello); normalHello(baseline.hello); assert.deepEqual(baseline.hello, verified.hello);
  const tracks = object(baseline.tracks, 'final tracks'), values = tracks.tracks as Wire[];
  assert.equal(tracks.count, 4); assert.equal(tracks.itemCount, 4); assert.equal(tracks.bankSize, 256);
  assert(Array.isArray(values) && values.length === 4); assert.deepEqual(values.map(value => value.channelId), ids);
  for (const [index, value] of values.entries()) {
    assert.equal(value.index, index); assert.equal(value.position, index); assert(typeof value.name === 'string');
    assert(!value.name.startsWith('gn-8g-'), 'test track remains'); assert(typeof value.type === 'string');
  }
  assert.deepEqual(cleanup.tracks, values, 'fixture removal and normal census disagree');
  assert.equal(object(baseline.scenes, 'final scenes').sceneCount, 8);
  const scan = object(baseline.scan, 'final scan');
  for (const [field, expected] of Object.entries({ existing: 4, withChannelId: 4, slotsWithContent: 0, sceneCount: 8, itemCount: 4, bankSize: 256 })) assert.equal(scan[field], expected);
  const slots = baseline.slots as Wire[]; assert(Array.isArray(slots) && slots.length === 32);
  assert.deepEqual(slots.map(value => `${value.id}:${value.row}`).sort(), ids.flatMap(id => Array.from({ length: 8 }, (_, row) => `${id}:${row}`)).sort());
  for (const slot of slots) { assert.equal(typeof slot.exists, 'boolean'); assert.equal(slot.hasContent, false); }
  const beforeSelection = object(entry.baselineSelection, 'entry selection');
  for (const current of [object(verified.selection, 'verified selection'), object(baseline.selection, 'final selection')])
    for (const field of ['trackIndex', 'slotIndex', 'mixerTrackIndex']) assert.equal(current[field], beforeSelection[field], `selection.${field}`);
  const beforeCursors = object(entry.cursors, 'entry cursors'); assert.deepEqual(Object.keys(beforeCursors).sort(), ['0', 'fine']);
  for (const current of [object(verified.cursors, 'verified cursors'), object(baseline.cursors, 'final cursors')]) {
    assert.deepEqual(Object.keys(current).sort(), ['0', 'fine']);
    for (const cursor of ['0', 'fine']) for (const field of ['trackExists', 'slotExists', 'trackPosition', 'sceneIndex', 'isPinned', 'cursorTrackPinned'])
      assert.equal(object(current[cursor], cursor)[field], object(beforeCursors[cursor], `entry ${cursor}`)[field], `${cursor}.${field}`);
  }
  const captured = timestamp(baseline.captured, 'final capture'); assert(captured >= timestamp(verified.ended, 'normal verification end'));
  const initialized = object(baseline.stats, 'final stats').initEpochMs;
  assert(Number.isSafeInteger(initialized) && Number(initialized) > timestamp(cleanup.ended, 'fixture removal end') && Number(initialized) <= captured);
  return { normalRuntimeRestored: true, originalTrackCensusRestored: true, sceneCount: 8, emptyBaselineSlots: 32,
    selectionRestored: true, cursorPinsAndTargetsRestored: true, entryStateRetained: true,
    complete: false, eligible: false, wholeSessionComplete: false, identityDetectionProved: false, projectContinuityProved: false };
}
/** Byte equality proves exact configuration restoration. Parsed equality alone does not. */
export function verifyFinalConfigCopies(original: Uint8Array, research: Uint8Array, restored: Uint8Array): Wire {
  assert.deepEqual(Buffer.from(restored), Buffer.from(original), 'restored configuration differs from the exact entry bytes');
  const prior = object(JSON.parse(Buffer.from(original).toString('utf8')), 'original configuration');
  const experiment = object(JSON.parse(Buffer.from(research).toString('utf8')), 'research configuration');
  assert.equal(experiment.cacheLifecycleResearch, true); assert.equal(experiment.cacheShadowObservers, 2); assert.equal(experiment.cacheShadowSteps, 2048);
  assert.notDeepEqual(Buffer.from(research), Buffer.from(original), 'research configuration must differ from entry configuration');
  assert.notEqual(prior.cacheLifecycleResearch, true); assert(!(typeof prior.cacheShadowObservers === 'number' && prior.cacheShadowObservers > 0));
  const sha256 = (value: Uint8Array): string => createHash('sha256').update(value).digest('hex');
  return { exactEntryConfigurationRestored: true, originalBytes: original.byteLength, researchBytes: research.byteLength,
    restoredBytes: restored.byteLength, originalSha256: sha256(original), researchSha256: sha256(research), restoredSha256: sha256(restored),
    complete: false, eligible: false, wholeSessionComplete: false };
}
