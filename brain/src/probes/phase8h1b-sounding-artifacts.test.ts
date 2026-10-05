import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fixtureSoundingCells } from './phase8h1a-knee-lib.js';
import { releaseDelta, verifyMatrix, SOUNDING_MARKER, type Wire } from './phase8h1b-sounding-lib.js';

const dir = new URL('../../../context/evidence/data/phase8h1b-sounding/', import.meta.url);
const read = (name: string): Wire => JSON.parse(readFileSync(new URL(name, dir), 'utf8')) as Wire;
const research = (report: Wire): void => {
  assert.equal(report.complete, false); assert.equal(report.eligible, false); assert.equal(report.marker, SOUNDING_MARKER);
  assert.equal(report.error, undefined, 'a retained artifact has no error');
};
const steps = (sample: unknown): number => Number((sample as Wire).noteSteps);

test('E226: unsubscribe, another track, and scroll release the grid; unpin and an empty slot do not', () => {
  const report = read('release.json'); research(report);
  const fixture = report.fixture as Wire, cells = Number(fixture.cells);
  assert.equal(cells, fixtureSoundingCells(16_384, 1_048_576, 64));
  assert.equal(steps(((report.bound as Wire).heap)) - steps(report.baseline), cells, 'one note step for each sounding cell');
  const bound = steps((report.bound as Wire).heap);
  const verdict = Object.fromEntries((report.actions as Wire[]).map(row => {
    const delta = releaseDelta(bound, steps(row.after), cells);
    assert.deepEqual(row.delta, delta);
    // Every restore brings the complete grid back.
    assert.equal((row.restore as Wire).boundNoteSteps, cells);
    return [String(row.action), delta.releases];
  }));
  assert.deepEqual(verdict, { unsubscribe: true, unpin: false, 'empty-slot': false, 'other-track': true, 'coarse-step': true, 'scroll-off': true });
  const resubscribe = ((report.actions as Wire[])[0]!.restore as Wire).replay as Wire;
  assert.equal(resubscribe.callbacks, cells); assert(Number(resubscribe.lastCallbackMs) < 200, 'resubscribe replays in under 200 ms');
  assert.equal((report.fixtureRelease as Wire).releases, true);
  assert.equal(steps(report.released), steps(report.baseline));
});

test('E226: full-width cursors hold every cell; windowed cursors hold only their window', () => {
  const report = read('census.json'); research(report);
  const cells = Number((report.fixture as Wire).cells);
  for (const row of report.cursors as Wire[]) {
    assert.equal(row.releasedNoteSteps, 0, `${String(row.role)} releases`);
    if (row.windowed === true) {
      assert(Number(row.boundNoteSteps) <= 6_013 && Number(row.fineStepNoteSteps) <= Number(row.width), `${String(row.role)} is bounded by its window`);
    } else assert.equal(row.boundNoteSteps, cells, `${String(row.role)} holds the clip`);
  }
  assert.deepEqual((report.cursors as Wire[]).filter(row => row.windowed !== true).map(row => row.role), ['view:0', 'view:1', 'authority', 'fixture']);
});

test('E226: a one-clip cell budget evicts and readmits exactly', () => {
  const report = read('admission.json'); research(report);
  const rows = report.steps as Wire[];
  assert.deepEqual(rows.map(row => (row.decision as Wire).evicted), [[], ['sustain'], ['half'], ['sustain']]);
  for (const row of rows) {
    assert.deepEqual((row.bind as Wire).issues, []);
    // The host keeps 128 unrelated note steps after a cache read, as in the release baseline.
    const held = steps(row.heap) - steps(report.baseline) - Number(row.cells);
    assert(held >= 0 && held <= 128, `only the admitted clip holds note steps (${held} more)`);
  }
  const readmit = rows.slice(2).map(row => Number((row.bind as Wire).totalMs));
  assert(Math.max(...readmit) < 8_000);
});

test('E226: the 1/16 sentinel misses only the nudge inside one coarse cell', () => {
  const report = read('matrix-32.json'); research(report);
  assert.deepEqual(report.summary, verifyMatrix(report));
  assert.deepEqual((report.summary as Wire).misses, ['nudge-inside-cell']);
  assert.deepEqual((report.summary as Wire).fineBlind, []);
});

test('E226: the normal extension and original config are restored', () => {
  const report = read('restoration.json');
  assert.equal(report.configSha256, '256bbf07094cd654c372d0e5e050e494ef7783c9a0001a0a2a688331bcf643b0');
  assert.deepEqual(report.hello, { contractVersion: 0, extensionVersion: '0.0.1', runtimeProfile: 'normal-v1', hostApiVersion: 25,
    methodCount: 85, methodsHash: 'bba7383dce25c0f0' });
  assert(!(report.deployedExtensions as string[]).some(name => name.includes('shadow')));
  assert(!(report.visibleTracks as string[]).some(name => name.startsWith('gn-8h1b')));
});
