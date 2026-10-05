import assert from 'node:assert/strict';
import test from 'node:test';
import { compactIssues, fixtureCell, fixtureChannel, fixtureDurationCells, fixtureNote, fixturePitch, fixtureVelocity,
  fixtureSoundingCells, isolationShape, kneeConfig, observerConfig, openLimits, oracleIndexes, parseHistogram, widthConfig, HEAP_STOP_BYTES, pointPasses, selectLimit, targetedIssues, verifyArm, KNEE_MARKER, type Wire } from './phase8h1a-knee-lib.js';

test('8h1a: fixture spec matches the Java golden values', () => {
  const rows = [0, 1, 2, 3, 4].map(i => [fixtureCell(i, 5, 17), fixtureChannel(i), fixturePitch(i), fixtureVelocity(i), fixtureDurationCells(i, 5, 17)]);
  assert.deepEqual(rows, [[0, 0, 24, 1, 4], [4, 1, 31, 38, 4], [8, 2, 38, 75, 4], [12, 3, 45, 112, 4], [16, 4, 52, 22, 1]]);
  assert.equal(fixtureCell(0, 1, 4_194_304), 4_194_303);
  assert.equal(fixtureCell(131_071, 131_072, 4_194_304), 4_194_303);
  assert.equal(fixtureDurationCells(10, 131_072, 131_072), 1);
  assert.throws(() => fixtureCell(5, 5, 17));
  assert.throws(() => fixtureCell(0, 18, 17));
});

test('8h1a: the maximum allocation config is explicit and research-only', () => {
  const config = kneeConfig('max');
  assert.deepEqual([config.cacheShadowObservers, config.cacheShadowSteps, config.tracks, config.scenes, config.cacheTopologyTracks],
    [4_096, 4_194_304, 2_048, 512, 2_048]);
  assert.equal(config.cacheKneeResearch, true); assert.equal(config.contentFilter, 'ALL_CHANNELS');
  assert.equal(kneeConfig('max', 4_095).cacheShadowObservers, 4_095);
});

const compact = (count: number, width: number, semitones = 0): unknown[][] =>
  Array.from({ length: count }, (_, i) => { const n = fixtureNote(i, count, width, semitones);
    return [n.channel, n.cell, n.pitch, n.velocity / 127, n.durationCells]; });

test('8h1a: compact promoted rows match only the declared fixture', () => {
  assert.deepEqual(compactIssues(compact(64, 4096), 64, 4096), []);
  assert.deepEqual(compactIssues(compact(64, 4096, 12), 64, 4096, 12), []);
  assert.notDeepEqual(compactIssues(compact(64, 4096, 12), 64, 4096), [], 'a transposed read is not the untransposed fixture');
  const missing = compact(64, 4096).slice(1);
  assert.match(compactIssues(missing, 64, 4096).join(';'), /note count 63.*1 declared notes are absent/);
  const wrong = compact(64, 4096); wrong[3]![3] = 0.9; wrong[5]![4] = 2;
  assert.deepEqual(compactIssues(wrong, 64, 4096).length, 2);
  const foreign = compact(64, 4096); foreign[0] = [15, 1, 1, 0.5, 1];
  assert.match(compactIssues(foreign, 64, 4096).join(';'), /foreign note/);
  assert.deepEqual(compactIssues(undefined, 1, 1), ['compact rows are absent']);
});

test('8h1a: targeted oracle checks the final cell and all 16 channels', () => {
  const count = 1000, width = 131_072, indexes = oracleIndexes(count);
  assert(indexes.includes(count - 1) && indexes.includes(0));
  assert.deepEqual(new Set(indexes.map(fixtureChannel)).size, 16);
  assert.equal(fixtureCell(count - 1, count, width), width - 1);
  const notes: Wire[] = indexes.map(i => { const n = fixtureNote(i, count, width);
    return { channel: n.channel, cell: n.cell, pitch: n.pitch, velocity: n.velocity / 127, durationCells: n.durationCells }; });
  assert.deepEqual(targetedIssues(notes, indexes, count, width), []);
  assert.notDeepEqual(targetedIssues(notes.slice(1), indexes, count, width), []);
  const duplicated = [...notes, { ...notes[0]!, channel: 9 }];
  assert.notDeepEqual(targetedIssues(duplicated, indexes, count, width), []);
});

test('8h1a: the first knee selects the last passing value', () => {
  const pass = (value: number) => ({ value, exact: true, pingP95Ms: 26, warmReadMs: 100, exactReadMs: 2000 });
  assert.deepEqual(selectLimit([pass(1), pass(2), pass(4)]), { knee: null, kneeReasons: [], largestPassing: 4, selected: 4, source: 'largest-passing' });
  const knee = selectLimit([pass(512), { ...pass(2048), pingP95Ms: 80 }, pass(1024)], 0.75);
  assert.deepEqual(knee, { knee: 2048, kneeReasons: ['ping-knee'], largestPassing: 1024, selected: 768, source: 'first-knee' });
  assert.deepEqual(pointPasses({ ...pass(1), warmReadMs: 1500 }).reasons, ['speed-knee']);
  assert.deepEqual(pointPasses({ ...pass(1), hostWorkMaxBatchMs: 51 }).reasons, ['host-work-knee']);
  assert.deepEqual(pointPasses({ ...pass(1), exact: false, refused: 'replay-budget' }).reasons, ['refused:replay-budget', 'inexact']);
  assert.equal(selectLimit([{ ...pass(1), exact: false }]).selected, null);
  assert.throws(() => selectLimit([pass(1), pass(1)]));
});

test('8h1a: an arm summary is recomputed from its samples', () => {
  const arm: Wire = { schema: 'phase8h1a-arm-v1', complete: false, eligible: false, marker: KNEE_MARKER, axisValue: 4096,
    pingSamplesMs: Array.from({ length: 20 }, (_, i) => 20 + i), oracleIssues: [],
    warmReads: [{ wallMs: 30, maxBatchMs: 40, issues: [] }, { wallMs: 50, maxBatchMs: 41, issues: [] }, { wallMs: 40, maxBatchMs: 39, issues: [] }],
    exactReads: [{ wallMs: 900, issues: [] }] };
  const point = verifyArm(arm);
  assert.deepEqual(point, { value: 4096, exact: true, pingP95Ms: 38, warmReadMs: 40, exactReadMs: 900, hostWorkMaxBatchMs: 41 });
  assert.throws(() => verifyArm({ ...arm, summary: { ...point, warmReadMs: 10 } }));
  assert.equal(verifyArm({ ...arm, warmReads: [{ wallMs: 30, maxBatchMs: 40, issues: ['velocity'] }] }).exact, false);
  const refused = verifyArm({ ...arm, exactReads: [{ wallMs: 5, refused: 'the exact source limit is 4096 notes', issues: [] }] });
  assert.equal(refused.exactReadMs, undefined); assert.equal(refused.exact, true);
  assert.throws(() => verifyArm({ ...arm, eligible: true }));
  assert.throws(() => verifyArm({ ...arm, pingSamplesMs: [1] }));
});

test('8h1a: open limits keep the ping signal and open every estimate gate', () => {
  const limits = openLimits();
  for (const key of ['pending', 'recorderBytes', 'snapshotBytes', 'combinedBytes', 'registryBytes']) assert.equal(limits[key], 'open', key);
  assert.equal(limits.pingBudgetMs, 50); assert.equal(limits.occupied, 2 ** 30);
});

test('8h1a: the class histogram total is the live set', () => {
  const text = `43359:\n num     #instances         #bytes  class name (module)\n-------------------------------------------------------\n` +
    `   1:        280046       20163312  com.bitwig.flt.control_surface.values.ComputedBooleanValue\n` +
    `   2:        256819       19002928  [B (java.base@25)\nTotal       3000000      452984832\n`;
  const parsed = parseHistogram(text, 1);
  assert.equal(parsed.totalBytes, 452_984_832); assert.equal(parsed.totalInstances, 3_000_000);
  assert.deepEqual(parsed.top, [{ instances: 280_046, bytes: 20_163_312, name: 'com.bitwig.flt.control_surface.values.ComputedBooleanValue' }]);
  assert.throws(() => parseHistogram('43359:\nno rows\n'));
  assert(HEAP_STOP_BYTES === 2 * 1024 ** 3);
});

test('8h1a: width isolation changes only the shadow width', () => {
  const small = widthConfig(131_072), large = widthConfig(4_194_304);
  const { cacheShadowSteps: a, stamp: s1, ...restSmall } = small; const { cacheShadowSteps: b, stamp: s2, ...restLarge } = large;
  assert.deepEqual(restSmall, restLarge); assert.equal(a, 131_072); assert.equal(b, 4_194_304);
  assert.equal(small.cacheShadowObservers, 2); assert.equal(small.tracks, 16);
  assert.throws(() => widthConfig(1000));
});

test('8h1a: sounding cells follow the duration cap, not the width', () => {
  assert.equal(fixtureDurationCells(0, 5, 17, 3), 3);
  assert.equal(fixtureDurationCells(0, 4096, 1_048_576, 1_000_000), 256);
  // With the default cap, widths above 262,144 give the same sounding cells. Width alone adds none.
  assert.equal(fixtureSoundingCells(4096, 524_288), fixtureSoundingCells(4096, 4_194_304));
  assert.equal(fixtureSoundingCells(4096, 1_048_576, 1_048_576), 1_048_576);
  assert.throws(() => fixtureDurationCells(0, 5, 17, 0));
});

test('8h1a: observer isolation changes only the observer allocation', () => {
  const { cacheShadowObservers: a, stamp: s1, ...small } = observerConfig(512);
  const { cacheShadowObservers: b, stamp: s2, ...large } = observerConfig(4_096);
  const { cacheShadowObservers: c, stamp: s3, ...width } = widthConfig(131_072);
  assert.deepEqual(small, large); assert.deepEqual(small, width); assert.deepEqual([a, b, c], [512, 4_096, 2]);
  assert.deepEqual(isolationShape('observers-2048'), { width: 131_072, tracks: 16, scenes: 16, observers: 2_048 });
  assert.equal(isolationShape('middle'), undefined);
  assert.throws(() => observerConfig(3));
});

test('8h1a: the cursor-scene variant changes only the shadow cursor slot bank', () => {
  const { cacheShadowCursorScenes, stamp, ...rest } = observerConfig(4_096, 0);
  const { stamp: base, ...plain } = observerConfig(4_096);
  assert.equal(cacheShadowCursorScenes, 0); assert.equal(stamp, `${base}-cursor0`); assert.deepEqual(rest, plain);
  assert.equal(isolationShape('observers-4096-cursor0')!.observers, 4_096);
});
