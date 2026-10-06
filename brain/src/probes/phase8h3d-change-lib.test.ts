import assert from 'node:assert/strict';
import { test } from 'node:test';
import { agentResult, changedValues, compact, declared, declaredIssues, editToStaleMs, researchConfig, SIZES,
  snapshotFingerprint, staleKeys, TYPICAL } from './phase8h3d-change-lib.js';
import { fixtureSoundingCells } from './phase8h1a-knee-lib.js';

const row = (channel: number, cell: number, pitch: number, velocity = 100 / 127, duration = 64 / 512) =>
  ({ channel, cell, pitch, velocity, duration, gain: 0, isMuted: false });
const bound = { loopStartBeats: 0, loopEndBeats: 64, playStopBeats: 64 };

test('typical density has 16,321 sounding cells on all 16 channels', () => {
  assert.equal(fixtureSoundingCells(TYPICAL.count, TYPICAL.beats * 512, TYPICAL.cap), 16_321);
  assert.equal(new Set(declared({ kind: 'spec', ...TYPICAL }).map(r => r[0])).size, 16);
});

test('declared sizes match E227', () => {
  assert.deepEqual(declared(SIZES.find(s => s.name === 'final-8192')!), [[0, 4_194_303, 24, 1, 1]]);
  assert.equal(declared(SIZES.find(s => s.name === 'n131072-2048')!).length, 131_072);
  assert.deepEqual(declared(SIZES[0]!), []);
});

test('declared issues find a count and a field change', () => {
  const plan = { kind: 'one' as const, beats: 64, count: 1, cap: 64 };
  assert.deepEqual(declaredIssues([row(0, 0, 60, 100 / 127, 4 / 512)], plan), []);
  assert.equal(declaredIssues([row(0, 0, 60, 90 / 127, 4 / 512)], plan).length, 1);
  assert.equal(declaredIssues([], plan)[0], 'count 0 for 1');
});

test('fingerprint ignores order and detects each edit kind', () => {
  const base = [row(0, 0, 60), row(1, 128, 62)];
  const fp = snapshotFingerprint(base, bound);
  assert.equal(snapshotFingerprint([...base].reverse(), bound), fp);
  assert.notEqual(snapshotFingerprint([...base, row(5, 40, 100)], bound), fp);
  assert.notEqual(snapshotFingerprint([base[0]!], bound), fp);
  assert.notEqual(snapshotFingerprint([row(0, 0, 60, 0.25), base[1]!], bound), fp);
  assert.notEqual(snapshotFingerprint([row(0, 1, 60), base[1]!], bound), fp);
  assert.notEqual(snapshotFingerprint([{ ...base[0]!, isMuted: true }, base[1]!], bound), fp);
  assert.notEqual(snapshotFingerprint(base, { ...bound, loopEndBeats: 32 }), fp);
});

test('stale keys and agent results', () => {
  const a = new Map([['x', '1'], ['y', '2'], ['z', '3']]);
  assert.deepEqual(staleKeys(a, new Map([['x', '1'], ['y', '9']])), ['y', 'z']);
  assert.ok(agentResult('x', 'f', true).length < agentResult('x', 'f', false, [row(0, 0, 60)]).length);
  assert.deepEqual(compact([row(1, 128, 62), row(0, 0, 60)]), [[0, 0, 60, 100, 64], [1, 128, 62, 100, 64]]);
});

test('changed values and stale time', () => {
  const status = { values: { 'clip.loopLength': { count: 1 }, 'slot.name': { count: 0 } }, flatBankContentEvents: 0 };
  assert.deepEqual(changedValues(status), ['clip.loopLength']);
  assert.deepEqual(changedValues({ values: {}, flatBankContentEvents: 2 }), ['flatBank.hasContent']);
  assert.equal(editToStaleMs(100, 180, 30), 50);
  assert.throws(() => editToStaleMs(0, 1, -1));
  assert.equal(researchConfig().changeWatchCursors, 32);
});
