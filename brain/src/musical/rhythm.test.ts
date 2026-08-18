import assert from 'node:assert/strict';
import test from 'node:test';

import { chooseStepSize, stepSizeFor, type NoteRecord } from '../contract/index.js';
import {
  compileMusicalClip, materializeRhythmTarget, parseMusicalPatch,
  toMaterializedMusicalTarget, type CanonicalMusicalNote,
  type MusicalOperation, type MusicalTarget, type TheoryResult,
} from './index.js';

const FULL_EXPRESSION_NOTE: NoteRecord = {
  startBeats: 0,
  pitch: 60,
  velocity: 96,
  durationBeats: 0.75,
  releaseVelocity: 0.4,
  velocitySpread: 0.2,
  gain: 0.7,
  pan: -0.25,
  timbre: 0.3,
  transpose: 2,
  chance: 0.6,
  isChanceEnabled: true,
  isMuted: true,
  isOccurrenceEnabled: true,
  occurrence: 'FIRST',
  isRecurrenceEnabled: true,
  recurrence: [4, 5],
  isRepeatEnabled: true,
  repeatCount: 3,
  repeatCurve: 0.2,
  repeatVelocityCurve: -0.1,
  repeatVelocityEnd: 0.8,
};

function target(
  operations: readonly MusicalOperation[],
  write: 'merge' | 'replace' = 'replace',
  seed?: string,
): MusicalTarget {
  return parseMusicalPatch({
    schema: 'ghostnote-musical-patch',
    version: 1,
    ...(seed === undefined ? {} : { seed }),
    protection: { kind: 'direct' },
    targets: [{ clip: { trackId: 'track-rhythm', row: 0 }, channel: 3, write, operations }],
  }).targets[0]!;
}

function valueOf<T>(result: TheoryResult<T>): T {
  if (!result.ok) assert.fail(result.reason);
  return result.value;
}

function plain(note: CanonicalMusicalNote): NoteRecord {
  const { channel: _channel, provenance: _provenance, ...value } = note;
  return value;
}

function withoutOwned(note: NoteRecord): Omit<NoteRecord, 'startBeats' | 'velocity'> {
  const { startBeats: _start, velocity: _velocity, ...preserved } = note;
  return preserved;
}

function assertNear(actual: number | undefined, expected: number): void {
  assert.ok(actual !== undefined && Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
}

test('R-grid: straight, triplet, and mixed straight-triplet values choose an exact grid', () => {
  assert.equal(stepSizeFor([{ ...FULL_EXPRESSION_NOTE, startBeats: 1 / 3, durationBeats: 1 / 3 }]), 1 / 3);
  assert.equal(stepSizeFor([
    { ...FULL_EXPRESSION_NOTE, startBeats: 0.25, durationBeats: 0.25 },
    { ...FULL_EXPRESSION_NOTE, startBeats: 1 / 3, durationBeats: 1 / 3, pitch: 61 },
  ]), 1 / 12);
  assert.equal(chooseStepSize([{ ...FULL_EXPRESSION_NOTE, startBeats: 1 / 6, durationBeats: 1 / 6 }]), 1 / 6);
});

test('R-quantize: nearest ties move later and strength reports requested and realized timing', () => {
  const source = { ...FULL_EXPRESSION_NOTE, startBeats: 0.25, durationBeats: 0.25 };
  const half = valueOf(materializeRhythmTarget(target([{
    op: 'quantize', gridBeats: 1 / 3, strength: 0.5,
  }]), [source]));
  assertNear(half.notes[0]!.startBeats, 7 / 24);
  assertNear(half.loss[0]!.requestedStartBeats, 1 / 3);
  assertNear(half.loss[0]!.realizedStartBeats, 7 / 24);
  assert.deepEqual(withoutOwned(plain(half.notes[0]!)), withoutOwned(source));

  const tie = valueOf(materializeRhythmTarget(target([{
    op: 'quantize', gridBeats: 0.25, strength: 1,
  }]), [{ ...FULL_EXPRESSION_NOTE, startBeats: 0.125, durationBeats: 0.25 }]));
  assert.equal(tie.notes[0]!.startBeats, 0.25);
});

test('R-quantize: an unrepresentable strength refuses instead of losing timing', () => {
  const result = materializeRhythmTarget(target([{
    op: 'quantize', gridBeats: 1 / 3, strength: 0.3,
  }]), [{ ...FULL_EXPRESSION_NOTE, startBeats: 0.25, durationBeats: 0.25 }]);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, 'grid-refused');
    assert.match(result.reason, /no exact straight or triplet grid/);
  }
});

test('R-quantize: positions that encode to one grid cell refuse as duplicates', () => {
  const result = materializeRhythmTarget(target([{
    op: 'quantize', gridBeats: 0.25, strength: 0.9999999998888892,
  }]), [
    { ...FULL_EXPRESSION_NOTE, startBeats: 0.25, durationBeats: 0.25 },
    { ...FULL_EXPRESSION_NOTE, startBeats: 0.34, durationBeats: 0.25 },
  ]);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, 'duplicate-note');
    assert.match(result.reason, /grid step 1 on the 0.25-beat grid/);
  }
});

test('R-humanize: the seed repeats notes and reports, while a different seed changes them', () => {
  const operation = {
    op: 'humanize', maxTimingBeats: 0.03125, maxVelocity: 4,
  } as const;
  const source = [
    FULL_EXPRESSION_NOTE,
    { ...FULL_EXPRESSION_NOTE, startBeats: 1, pitch: 64 },
  ];
  const first = materializeRhythmTarget(target([operation], 'replace', 'seed-a'), source, 0, 0, { seed: 'seed-a' });
  const repeat = materializeRhythmTarget(target([operation], 'replace', 'seed-a'), source, 0, 0, { seed: 'seed-a' });
  const other = materializeRhythmTarget(target([operation], 'replace', 'seed-b'), source, 0, 0, { seed: 'seed-b' });
  assert.deepEqual(repeat, first);
  assert.notDeepEqual(other, first);
  const output = valueOf(first);
  assert.equal(output.effectiveSeed, 'seed-a');
  assert.equal(output.seedScopes.length, 1);
  assert.equal(output.seedScopes[0]!.operationIndex, 0);
  assert.ok(output.notes.every((note) => note.startBeats >= 0));
  assert.ok(output.notes.every((note) => Number.isInteger(note.velocity)));
  assert.ok(output.notes.every((note) => stepSizeFor([plain(note)]) !== undefined));
  output.notes.forEach((note, index) => {
    assert.deepEqual(withoutOwned(plain(note)), withoutOwned(source[index]!));
  });
  const timing = output.loss.filter((item) => item.code === 'timing-moved');
  assert.ok(timing.length > 0);
  assert.ok(timing.every((item) => item.requestedStartBeats !== undefined
    && item.realizedStartBeats !== undefined));
  assert.ok(timing.some((item) => item.requestedStartBeats! < 0
    && item.realizedStartBeats === 0), 'the beat-zero note must report lower-range clipping');
  const velocity = output.loss.filter((item) => item.code === 'velocity-changed');
  assert.ok(velocity.length > 0);
  assert.ok(velocity.every((item) => Number.isInteger(item.after?.velocity)));
});

test('R-humanize: a missing effective seed refuses before output', () => {
  const result = materializeRhythmTarget({
    ...target([{ op: 'quantize', gridBeats: 0.25, strength: 1 }]),
    operations: [{ op: 'humanize', maxTimingBeats: 0.03125, maxVelocity: 2 }],
  }, [FULL_EXPRESSION_NOTE]);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'missing-seed');
});

test('R-thin: probability is removal chance, selection is exact, and merge refuses', () => {
  const source = [
    FULL_EXPRESSION_NOTE,
    { ...FULL_EXPRESSION_NOTE, startBeats: 1, pitch: 64 },
    { ...FULL_EXPRESSION_NOTE, startBeats: 2, pitch: 67 },
  ];
  const operation = {
    op: 'thin', probability: 1,
    selection: { beatRange: { fromBeats: 1, toBeats: 2 } },
  } as const;
  const result = valueOf(materializeRhythmTarget(
    target([operation], 'replace', 'thin-seed'), source, 0, 0, { seed: 'thin-seed' },
  ));
  assert.deepEqual(result.notes.map((note) => note.pitch), [60, 67]);
  assert.deepEqual(result.loss.map((item) => item.code), ['note-removed']);
  assert.deepEqual(result.loss[0]!.before, source[1]);

  const merge = materializeRhythmTarget(
    target([operation], 'merge', 'thin-seed'), source, 0, 0, { seed: 'thin-seed' },
  );
  assert.equal(merge.ok, false);
  if (!merge.ok) assert.match(merge.reason, /thin requires replace mode/);
});

test('R-densify: grid gaps copy the preceding group and report additions and truncation', () => {
  const source = [
    { ...FULL_EXPRESSION_NOTE, durationBeats: 1 },
    { ...FULL_EXPRESSION_NOTE, startBeats: 1, durationBeats: 0.25 },
  ];
  const result = valueOf(materializeRhythmTarget(
    target([{ op: 'densify', gridBeats: 0.25, probability: 1 }], 'replace', 'dense'),
    source, 0, 0, { seed: 'dense' },
  ));
  assert.deepEqual(
    result.notes.map((note) => note.startBeats).sort((left, right) => left - right),
    [0, 0.25, 0.5, 0.75, 1],
  );
  assert.equal(result.loss.filter((item) => item.code === 'note-added').length, 3);
  assert.equal(result.loss.filter((item) => item.code === 'note-shortened').length, 4);
  result.notes.forEach((note) => {
    assert.deepEqual(withoutOwned(plain(note)), withoutOwned({
      ...FULL_EXPRESSION_NOTE, durationBeats: note.durationBeats,
    }));
  });
});

test('R-densify: merge emits additions while compilation derives source truncation without duplicates', () => {
  const source = [
    { ...FULL_EXPRESSION_NOTE, durationBeats: 1 },
    { ...FULL_EXPRESSION_NOTE, startBeats: 1, durationBeats: 0.25 },
  ];
  const result = valueOf(materializeRhythmTarget(
    target([{ op: 'densify', gridBeats: 0.25, probability: 1 }], 'merge', 'dense-merge'),
    source, 0, 0, { seed: 'dense-merge' },
  ));
  assert.deepEqual(result.notes.map((note) => note.startBeats), [0.25, 0.5, 0.75]);
  const compiled = compileMusicalClip(
    {
      kind: 'clip',
      slot: {
        kind: 'slot',
        track: { kind: 'track', channelId: 'track-rhythm' },
        scene: { kind: 'scene', index: 0, epoch: 1 },
      },
    },
    [toMaterializedMusicalTarget(result)],
    {
      revision: 1,
      channels: Array.from({ length: 16 }, (_item, channel) => ({
        channel, notes: channel === 3 ? source : [],
      })),
    },
  );
  assert.deepEqual(compiled.loss.map((item) => item.code), ['note-shortened']);
  assert.equal(compiled.ops.length, 1);
});

test('R-densify: an identical generated identity refuses instead of collapsing', () => {
  const source = [
    { ...FULL_EXPRESSION_NOTE, durationBeats: 0.25 },
    { ...FULL_EXPRESSION_NOTE, startBeats: 0.5, durationBeats: 0.25 },
    { ...FULL_EXPRESSION_NOTE, startBeats: 1, durationBeats: 0.25 },
  ];
  const result = materializeRhythmTarget(
    target([{ op: 'densify', gridBeats: 0.5, probability: 1 }], 'replace', 'collision'),
    source, 0, 0, {
      seed: 'collision',
      groupNotes: (notes) => [
        { startBeats: 0, sourceIndexes: [0], notes: [notes[0]!] },
        { startBeats: 1, sourceIndexes: [2], notes: [notes[2]!] },
      ],
    },
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'duplicate-note');
});

test('R-pipeline: harmonic and seeded rhythm operations keep order and provenance', () => {
  const operations = [
    { op: 'transpose', semitones: 12 },
    { op: 'quantize', gridBeats: 0.25, strength: 1 },
    { op: 'humanize', maxTimingBeats: 0.015625, maxVelocity: 1 },
  ] as const;
  const result = valueOf(materializeRhythmTarget(
    target(operations, 'replace', 'pipeline'),
    [{ ...FULL_EXPRESSION_NOTE, startBeats: 0.125, durationBeats: 0.25 }],
    0, 0, { seed: 'pipeline' },
  ));
  assert.equal(result.notes[0]!.pitch, 72);
  assert.equal(result.notes[0]!.provenance.operationIndex, 2);
  assert.equal(result.loss[0]!.operationIndex, 1);
  assert.ok(result.loss.slice(1).every((item) => item.operationIndex === 2));
});
