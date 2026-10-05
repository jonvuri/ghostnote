import assert from 'node:assert/strict';
import test from 'node:test';
import { classCounts, evaluateRow, matrixPlan, releaseDelta, soundingConfig, verifyMatrix, MATRIX_WIDTH, NOTE_STEP_CLASS, REGION,
  SENTINEL_RATIO, SENTINEL_STEPS, SOUNDING_MARKER, SOUNDING_WIDTH, type TraceRow, type Wire } from './phase8h1b-sounding-lib.js';

test('8h1b: the research config allocates the sounding proxies and no cursor slot bank', () => {
  const config = soundingConfig();
  assert.deepEqual([config.cacheShadowObservers, config.cacheShadowSteps, config.tracks, config.scenes, config.cacheShadowCursorScenes],
    [2, SOUNDING_WIDTH, 16, 16, 0]);
  assert.equal(config.cacheSoundingResearch, true); assert.equal(config.cacheKneeResearch, true);
  // The sentinel covers the matrix clip at the finest step.
  assert(SOUNDING_WIDTH / SENTINEL_RATIO * SENTINEL_STEPS[0] >= MATRIX_WIDTH);
});

test('8h1b: class counts read named rows and default absent classes to zero', () => {
  const text = [' num     #instances         #bytes  class name (module)', '-------------------------------------------------------',
    `   1:       1048576      176160768  ${NOTE_STEP_CLASS}`, '   2:            12            480  java.lang.String (java.base@25)',
    'Total       1048588      176161248'].join('\n');
  assert.deepEqual(classCounts(text, [NOTE_STEP_CLASS, 'absent.Class']),
    { [NOTE_STEP_CLASS]: { instances: 1_048_576, bytes: 176_160_768 }, 'absent.Class': { instances: 0, bytes: 0 } });
});

test('8h1b: each matrix plan lists every edit type in separate regions', () => {
  for (const step of SENTINEL_STEPS) {
    const { baseline, setup, rows } = matrixPlan(step);
    const kinds = new Set(rows.map(row => row.kind));
    for (const kind of ['nudge', 'field', 'disabled-control', 'duration', 'delete-readd', 'same-pitch-channel', 'channel', 'final-cell', 'clip-extent'])
      assert(kinds.has(kind), `${kind} at ${step}`);
    assert.equal(rows.filter(row => row.kind === 'channel').length, 16);
    assert.equal(new Set(rows.map(row => row.label)).size, rows.length, 'labels are unique');
    assert(baseline.every(op => op.op === 'set' && op.x >= 0 && op.x < MATRIX_WIDTH));
    assert(setup.every(op => op.op === 'field'));
    // Notes of different rows are in different regions, except the final-cell notes.
    const regions = rows.filter(row => row.kind !== 'final-cell' && row.expected.length > 0)
      .map(row => Math.floor(row.expected[0]!.x / REGION));
    assert.equal(new Set(regions).size, regions.length);
    const inside = rows.find(row => row.label === 'nudge-inside-cell')!, across = rows.find(row => row.label === 'nudge-across-boundary')!;
    assert.equal(Math.floor(inside.expected[0]!.x / step), Math.floor(inside.expected[1]!.x / step));
    assert.equal(Math.floor(across.expected[0]!.x / step) + 1, Math.floor(across.expected[1]!.x / step));
    const same = rows.filter(row => row.kind === 'same-pitch-channel');
    for (const row of same) {
      const x = row.expected[0]!.x, partner = baseline.filter(op => op.op === 'set' && Math.floor(op.x / step) === Math.floor(x / step) && op.y === 60);
      assert.equal(partner.length, 2, 'two same-pitch notes share one coarse cell');
    }
  }
});

const traceRow = (x: number, y: number, channel: number, state = 2): TraceRow => [1, x, y, channel, state, 0.5, 0.01, 0, 1, false, false];

test('8h1b: a row passes only when the sentinel covers every edited start and every fine projection', () => {
  const row = matrixPlan(32).rows.find(value => value.label === 'nudge-inside-cell')!;
  const [old, moved] = row.expected as [{ x: number; y: number; channel: number }, { x: number; y: number; channel: number }];
  const fine = [traceRow(old.x, 60, 0, 0), traceRow(moved.x, 60, 0)];
  assert.equal(evaluateRow(row, 32, fine, [traceRow(Math.floor(old.x / 32), 60, 0)]).pass, true);
  const miss = evaluateRow(row, 32, fine, []);
  assert.equal(miss.pass, false); assert.equal((miss.missing as string[]).length, 2);
  // A sustained fine cell in the next coarse cell needs its own coarse callback.
  const tail = evaluateRow(row, 32, [...fine, traceRow(old.x + 40, 60, 0, 1)], [traceRow(Math.floor(old.x / 32), 60, 0)]);
  assert.equal(tail.pass, false); assert.deepEqual(tail.derivedMissing, [`${Math.floor((old.x + 40) / 32)}:60:0`]);
  const extent = matrixPlan(32).rows.find(value => value.label === 'loop-shorten')!;
  assert.equal(evaluateRow(extent, 32, [], []).pass, true, 'no fine change needs no coarse callback');
});

test('8h1b: a matrix artifact is recomputed from its traces', () => {
  const plan = matrixPlan(32);
  const rows = plan.rows.map(row => {
    const fine = row.expected.map(e => traceRow(e.x, e.y, e.channel)), sentinel = row.expected.map(e => traceRow(Math.floor(e.x / 32), e.y, e.channel));
    return { label: row.label, fine, sentinel, fineComplete: true, sentinelComplete: true, result: evaluateRow(row, 32, fine, sentinel) };
  });
  const report: Wire = { marker: SOUNDING_MARKER, complete: false, eligible: false, stepCells: 32, rows };
  assert.deepEqual(verifyMatrix(report), { stepCells: 32, stepBeats: 1 / 16, rows: plan.rows.length, pass: true, misses: [], fineBlind: [] });
  (rows[0]!.sentinel as TraceRow[]).length = 0;
  assert.throws(() => verifyMatrix(report), /result differs/);
  (rows[0] as Wire).result = evaluateRow(plan.rows[0]!, 32, rows[0]!.fine, []);
  assert.deepEqual(verifyMatrix(report).misses, ['nudge-inside-cell']);
  assert.throws(() => verifyMatrix({ ...report, eligible: true }));
});

test('8h1b: a release frees at least 95 % of the bound grid', () => {
  assert.deepEqual(releaseDelta(1_100_000, 52_000, 1_048_576), { freed: 1_048_000, fraction: 1_048_000 / 1_048_576, releases: true });
  assert.equal(releaseDelta(1_100_000, 1_099_000, 1_048_576).releases, false);
  assert.equal(releaseDelta(10, 10, 0).releases, false);
});
