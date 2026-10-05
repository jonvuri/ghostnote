import assert from 'node:assert/strict';
import test from 'node:test';
import { FIXTURES, REPLAY_WIDTH, completion, declaredNotes, decodeIssues, decoration, replayConfig, startCandidates, summarizeTrials,
  targetedAgreement, widthCells, windowVerdict, type BatchRow, type DecodedRow, type Wire } from './phase8h2a-replay-lib.js';

const defaults = { gain: 0.5, chance: 1, chanceEnabled: true, muted: false };

test('8h2a: the research config allocates the reader at the largest width and no sounding proxies', () => {
  const config = replayConfig();
  assert.equal(config.cacheShadowSteps, REPLAY_WIDTH); assert.equal(config.cacheReplayResearch, true);
  assert.equal(config.cacheKneeResearch, true); assert.equal(config.cacheSoundingResearch, undefined);
  for (const plan of FIXTURES) assert(widthCells(plan) <= REPLAY_WIDTH, `${plan.name} fits the reader`);
  assert.deepEqual([...new Set(FIXTURES.map(plan => plan.beats))].sort((a, b) => a - b), [64, 512, 2_048, 8_192]);
});

test('8h2a: decoration mirrors the Java goldens and leaves index 4 mod 8 at defaults', () => {
  // Java writes 0.70; the settled host read is twice that (E2).
  assert.ok(Math.abs(decoration(5).gain! - 1.40) < 1e-9);
  assert.ok(Math.abs(decoration(2).chance! - 0.24) < 1e-9);
  assert.equal(decoration(0).chanceEnabled, false); assert.equal(decoration(3).muted, true);
  assert.deepEqual(decoration(4), { gain: null, chance: null, chanceEnabled: null, muted: null });
});

test('8h2a: decode issues compare every field and report foreign and absent notes', () => {
  const plan = FIXTURES.find(row => row.name === 'n4096-64')!, declared = declaredNotes(plan, defaults);
  const rows: DecodedRow[] = declared.map(n => [n.channel, n.cell, n.pitch, n.velocity / 127, n.durationCells, n.gain, n.chance, n.chanceEnabled, n.muted]);
  assert.deepEqual(decodeIssues(rows, declared), []);
  const bad = rows.map(row => [...row] as DecodedRow);
  bad[1]![5] = 0.9; bad[3]![8] = false; bad.pop(); bad.push([0, 1, 1, 0.5, 1, 0.5, 1, true, false]);
  const issues = decodeIssues(bad, declared);
  assert(issues.some(text => text.startsWith('gain')) && issues.some(text => text.startsWith('muted')) && issues.some(text => text.startsWith('foreign')));
  assert(issues.includes('1 declared notes are absent'));
  assert.deepEqual(declaredNotes(FIXTURES[0]!, defaults), []);
  assert.equal(declaredNotes(FIXTURES[1]!, defaults)[0]!.cell, 0);
  assert.equal(declaredNotes(FIXTURES[2]!, defaults)[0]!.cell, REPLAY_WIDTH - 1);
});

test('8h2a: targeted agreement requires identical host values', () => {
  const row: DecodedRow = [2, 10, 60, 0.5, 4, 0.3, 0.7, true, false];
  const host = { channel: 2, cell: 10, pitch: 60, velocity: 0.5, durationCells: 4, gain: 0.3, chance: 0.7, isChanceEnabled: true, isMuted: false };
  assert.deepEqual(targetedAgreement([row], [host]), []);
  assert.equal(targetedAgreement([row], [{ ...host, gain: 0.31 }]).length, 1);
  assert.equal(targetedAgreement([], [host]).length, 1);
});

const epoch = (batches: BatchRow[], callbacks: number, values: unknown[] = [], duplicates = 0): Wire =>
  ({ callbacks, batches, values, duplicates, droppedBatches: 0, droppedValues: 0, firstCallbackMs: batches[0]?.[1] ?? -1,
    lastCallbackMs: batches.at(-1)?.[4] ?? -1 });

test('8h2a: completion accepts one closed batch and refuses a late batch', () => {
  const one = completion(epoch([[1, 140, 100, 190, 170, 100, 210]], 100));
  assert.equal(one.singleTask, true); assert.equal(one.completeMs, 190); assert.equal(one.firstToLastMs, 30);
  const late = completion(epoch([[1, 140, 60, 190, 170, 60, 210], [61, 200, 100, 230, 205, 100, 250]], 100));
  assert.equal(late.singleTask, false); assert.equal(late.batches, 2); assert.equal(late.lateCallbacks, 40); assert.equal(late.chainCompleteMs, 230);
  assert.equal(completion(epoch([[1, 140, 100, 190, 170, 100, 210]], 100, [], 1)).singleTask, false);
  assert.equal(completion(epoch([], 0)).singleTask, null);
});

test('8h2a: a start candidate closes only when its task saw every step callback', () => {
  const values = [['trackChannelId', 't1', 0, 5, 0, 30], ['clipExists', 'true', 0, 140, 100, 190], ['loopLength', '64.0', 0, 140, 100, 190]];
  const start = startCandidates(epoch([[1, 140, 100, 190, 170, 100, 210]], 100, values), { beats: 64, row: 0, trackId: 't1' });
  assert.equal(start.clipExists!.closes, true); assert.equal(start.loopLength!.closes, true);
  assert.equal(start.trackChannelId!.closes, false); assert.equal(start.playStop!.present, false);
  const empty = startCandidates(epoch([], 0, [['clipExists', 'true', 0, 140, 0, 190]]), { beats: 64, row: 0, trackId: 't1' });
  assert.equal(empty.clipExists!.closes, true);
});

test('8h2a: the window refuses a change before confirmation, a late batch, or a duplicate cell', () => {
  assert.equal(windowVerdict(epoch([[1, 140, 100, 190, 170, 100, 210]], 100)).refuse, false);
  assert.deepEqual(windowVerdict(epoch([[1, 140, 100, 190, 170, 101, 210]], 101)).reasons, ['changed-before-confirmation', 'late-batch']);
  assert.deepEqual(windowVerdict(epoch([[1, 140, 100, 190, 170, 100, 210]], 100, [], 2)).reasons, ['duplicate-cell']);
});

test('8h2a: trial summaries count single-task passes and closing candidates', () => {
  const trial = (callbacks: number, single: boolean): Wire => ({ completion: { callbacks, batches: single ? 1 : 2, singleTask: callbacks > 0 ? single : null,
    bindToFirstMs: 130, firstToLastMs: 30, completeMs: 190 }, decodeIssues: [],
  start: Object.fromEntries(['clipExists', 'loopLength', 'playStop', 'sceneIndex', 'trackChannelId'].map(k => [k, { present: true, closes: k === 'clipExists' }])) });
  const summary = summarizeTrials([trial(100, true), trial(100, false)]);
  assert.equal(summary.singleTaskPass, 1); assert.deepEqual(summary.batchCounts, [1, 2]);
  assert.deepEqual((summary.start as Wire).clipExists, { present: 2, closes: 2 });
  assert.deepEqual((summary.start as Wire).playStop, { present: 2, closes: 0 });
});
