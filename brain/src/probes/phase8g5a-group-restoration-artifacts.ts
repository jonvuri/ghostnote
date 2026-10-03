/** Verify protected restoration and retain the fixture selection exception. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { closed, type Wire } from './phase8g4-native-lib.js';
const directory = new URL('../../../context/evidence/data/phase8g5a-group/', import.meta.url);
const read = async (file: string): Promise<Wire> => JSON.parse(await readFile(new URL(file, directory), 'utf8')) as Wire;
const final = await read('final-restoration.json'); closed(final);
assert.equal(final.schema, 'phase8g5a-final-restoration-v1');
for (const [file, record] of Object.entries(final.reports as Record<string, Wire>)) {
  assert.match(file, /^[a-z0-9-]+\.json$/); const bytes = await readFile(new URL(file, directory));
  assert.equal(bytes.length, record.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), record.sha256);
}
const values = (raw: Wire): Wire => {
  const scan = { ...raw.scan as Wire }, selection = { ...raw.selection as Wire };
  delete scan.scanMicros; delete selection.changes; delete selection.revision;
  return { ...raw, scan, selection };
};
const notes = (raw: Wire): Wire => { const result = { ...raw }; delete result.scanMicros; return result; };
const entry = await read('new3-baseline.json'), restored = await read('new3-final-baseline.json');
closed(restored); assert.equal(restored.stateValuesRestored, true); assert.equal(restored.error, undefined);
assert.deepEqual(values(restored.baseline as Wire), values(entry.baseline as Wire));
assert.deepEqual(values(restored.confirmation as Wire), values(entry.baseline as Wire));
const clip = entry.preservedClip as Wire;
assert.deepEqual(restored.metadata, clip.metadata); assert.deepEqual(restored.launchSettings, clip.launchSettings);
assert.deepEqual(notes(restored.notes as Wire), notes(clip.notes as Wire));
assert.deepEqual(notes(restored.confirmationNotes as Wire), notes(clip.confirmationNotes as Wire));
assert.equal((restored.notes as Wire).count, 0); assert.equal((restored.confirmationNotes as Wire).count, 0);
assert.deepEqual(restored.excludedStateFields, ['scan.scanMicros', 'selection.changes', 'selection.revision',
  'notes.scanMicros', 'confirmationNotes.scanMicros']);
const hello = restored.hello as Wire;
assert.equal(hello.runtimeProfile, 'normal-v1'); assert.equal(hello.methodCount, 85);
assert.equal(hello.methodsHash, 'bba7383dce25c0f0'); assert.equal(restored.configSha256, entry.configSha256);
assert.equal(restored.configSha256, '256bbf07094cd654c372d0e5e050e494ef7783c9a0001a0a2a688331bcf643b0');
const reload = await read('route-reload.json');
assert(Number((restored.stats as Wire).initEpochMs) > Number((reload.stats as Wire).initEpochMs));
const fixture = await read('new5-before-discard.json'), fixtureEntry = await read('new5-fixture-entry.json');
closed(fixture); assert.equal(fixture.project, 'New 5');
const current = values(fixture.baseline as Wire), expected = values(fixtureEntry.baseline as Wire);
assert.deepEqual(current, values(fixture.confirmation as Wire));
const slots = current.slots as Wire[];
assert.equal(slots[0]!.isSelected, true); assert.equal((expected.slots as Wire[])[0]!.isSelected, false);
assert(slots.every(slot => slot.hasContent === false));
assert.deepEqual({ ...current, slots: slots.map((slot, index) => index === 0 ? { ...slot, isSelected: false } : slot) }, expected);
const cleanup = await read('new5-content-cleanup.json');
assert.deepEqual((cleanup.deleted as Wire[]).map(value => [value.row, value.stage]), [[0, 'deleted'], [1, 'deleted']]);
assert.equal(final.fixtureInitialNoSlotSelectionRestored, false);
assert.equal(final.fixtureSolePreDiscardDifference, 'slot-0-selected-instead-of-no-slot');
for (const key of ['sessionWorkComplete', 'protectedStateValuesRestored', 'fixtureClosedWithoutSaving',
  'fixtureContentAndCursorValuesRestored', 'audioEngineActive']) assert.equal(final[key], true);
for (const key of ['protectedProjectSaved', 'protectedProjectClosed', 'transportPlaying', 'identicalViewportClaimed']) assert.equal(final[key], false);
assert.deepEqual(final.openTabs, ['New 3 *']);
assert.equal((final.removedResearchArchive as Wire).absent, true);
console.log(JSON.stringify({ protectedStateValuesRestored: true, fixtureDiscarded: true,
  fixtureInitialNoSlotSelectionRestored: false, normalMethods: 85, complete: false, eligible: false }));
