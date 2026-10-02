import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyFinalBaselineReports, verifyFinalConfigCopies } from './phase8g-final-baseline.js';
type Wire = Record<string, unknown>;
const ids = [1, 2, 3, 4].map(n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`);
function fixture() {
  const cursor = { trackExists: false, slotExists: false, trackPosition: -1, sceneIndex: 0, isPinned: false, cursorTrackPinned: false };
  const selection = { trackIndex: -1, slotIndex: -1, mixerTrackIndex: 0 };
  const entry = { baselineIds: ids, baselineScenes: 8, baselineSlotsWithContent: 0, baselineSelection: selection,
    cursors: { '0': cursor, fine: structuredClone(cursor) }, ownedTrackId: 'removed-track' };
  const tracks = ids.map((channelId, index) => ({ channelId, index, position: index, name: `original-${index}`, type: 'Instrument' }));
  const hello = { runtimeProfile: 'normal-v1', methodCount: 85, methodsHash: 'bba7383dce25c0f0', contractVersion: 0, hostApiVersion: 25 };
  return { cleanup: { started: '2026-10-01T18:00:00Z', ended: '2026-10-01T18:00:01Z', cleaned: true, entryState: entry, tracks },
    verified: { started: '2026-10-01T18:01:00Z', ended: '2026-10-01T18:01:01Z', verified: true, stateRetentionPolicy: 'retain',
      entryState: structuredClone(entry), baselineIds: ids, sceneCount: 8, hello, selection, cursors: structuredClone(entry.cursors) },
    baseline: { captured: '2026-10-01T18:02:00Z', entryState: structuredClone(entry), hello: structuredClone(hello),
      tracks: { tracks: structuredClone(tracks), count: 4, itemCount: 4, bankSize: 256 }, scenes: { sceneCount: 8 },
      scan: { existing: 4, withChannelId: 4, slotsWithContent: 0, sceneCount: 8, itemCount: 4, bankSize: 256 },
      slots: ids.flatMap(id => Array.from({ length: 8 }, (_, row) => ({ id, row, exists: true, hasContent: false }))),
      selection: structuredClone(selection), cursors: structuredClone(entry.cursors), stats: { initEpochMs: Date.parse('2026-10-01T18:00:30Z') } } };
}
test('final cleanup validates actual normal census, empty slots, selection, and cursor targets', () => {
  const { cleanup, verified, baseline } = fixture(), result = verifyFinalBaselineReports(cleanup, verified, baseline);
  assert.equal(result.normalRuntimeRestored, true); assert.equal(result.emptyBaselineSlots, 32); assert.equal(result.wholeSessionComplete, false);
});
test('verified flags cannot hide another UUID, reordered tracks, or test track residue', () => {
  for (const change of [
    (value: ReturnType<typeof fixture>) => { value.baseline.tracks.tracks[0]!.channelId = 'foreign-track'; },
    (value: ReturnType<typeof fixture>) => { value.baseline.tracks.tracks.reverse(); },
    (value: ReturnType<typeof fixture>) => { value.baseline.tracks.tracks[0]!.name = 'gn-8g-residue'; },
  ]) { const value = fixture(); change(value); assert.throws(() => verifyFinalBaselineReports(value.cleanup, value.verified, value.baseline)); }
});
test('slot residue, omitted coordinates, and stale selection or pins prevent cleanup proof', () => {
  for (const change of [
    (value: ReturnType<typeof fixture>) => { value.baseline.slots[3]!.hasContent = true; },
    (value: ReturnType<typeof fixture>) => { value.baseline.slots.pop(); },
    (value: ReturnType<typeof fixture>) => { value.baseline.selection.slotIndex = 0; },
    (value: ReturnType<typeof fixture>) => { value.baseline.cursors.fine.cursorTrackPinned = true; },
  ]) { const value = fixture(); change(value); assert.throws(() => verifyFinalBaselineReports(value.cleanup, value.verified, value.baseline)); }
});
test('normal profile, exact entry state, and a new initialization after cleanup are required', () => {
  for (const change of [
    (value: ReturnType<typeof fixture>) => { value.verified.hello.runtimeProfile = 'phase-8-probe-v1'; },
    (value: ReturnType<typeof fixture>) => { value.verified.entryState.baselineScenes = 9; },
    (value: ReturnType<typeof fixture>) => { value.baseline.stats.initEpochMs = Date.parse('2026-10-01T17:59:00Z'); },
    (value: ReturnType<typeof fixture>) => { value.verified.stateRetentionPolicy = 'remove-after-verification'; },
  ]) { const value = fixture(); change(value); assert.throws(() => verifyFinalBaselineReports(value.cleanup, value.verified, value.baseline)); }
});
test('omitted observations and session proof claims cannot pass final baseline verification', () => {
  for (const field of ['slots', 'scan', 'stats', 'cursors', 'selection']) {
    const value = fixture(); delete (value.baseline as unknown as Wire)[field]; assert.throws(() => verifyFinalBaselineReports(value.cleanup, value.verified, value.baseline));
  }
  const value = fixture(); (value.baseline as unknown as Wire).wholeSessionComplete = true;
  assert.throws(() => verifyFinalBaselineReports(value.cleanup, value.verified, value.baseline));
});
test('configuration restoration requires exact raw bytes and disabled entry research allocation', () => {
  const original = Buffer.from('{"tracks":256,"scenes":128}\n');
  const research = Buffer.from('{"tracks":256,"scenes":128,"cacheLifecycleResearch":true,"cacheShadowObservers":2,"cacheShadowSteps":2048}\n');
  assert.equal(verifyFinalConfigCopies(original, research, original).exactEntryConfigurationRestored, true);
  const equivalent = Buffer.from(JSON.stringify(JSON.parse(original.toString()))); assert.deepEqual(JSON.parse(equivalent.toString()), JSON.parse(original.toString()));
  assert.throws(() => verifyFinalConfigCopies(original, research, equivalent), /exact entry bytes/);
  assert.throws(() => verifyFinalConfigCopies(original, original, original));
  assert.throws(() => verifyFinalConfigCopies(research, research, research));
});
