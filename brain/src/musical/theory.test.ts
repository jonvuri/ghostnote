import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MUSICAL_REQUEST_CORPUS, chordFact, detectHarmony, intervalFact, keyFact,
  materializeGenerationPatch, modeFact, noteFact, parseMusicalPatch,
  pitchClassSetFact, progressionFact, scaleFact, toMaterializedMusicalTarget,
  type TheoryResult,
} from './index.js';

function resultValue<T>(result: TheoryResult<T>): T {
  if (!result.ok) assert.fail(result.reason);
  return result.value;
}

test('T-facts: notes and intervals use one stable local spelling', () => {
  assert.deepEqual(resultValue(noteFact('C#4')), {
    name: 'Db4', pitchClass: 'Db', chroma: 1, octave: 4, midi: 61,
  });
  assert.deepEqual(resultValue(noteFact('Db')), {
    name: 'Db', pitchClass: 'Db', chroma: 1,
  });
  assert.deepEqual(resultValue(intervalFact('P5')), {
    name: '5P', semitones: 7, direction: 1,
  });
  assert.deepEqual(resultValue(intervalFact('-3m')), {
    name: '-3m', semitones: -3, direction: -1,
  });
});

test('T-theory: chord, scale, mode, and key facts do not expose Tonal objects', () => {
  assert.deepEqual(resultValue(chordFact('Fm')), {
    symbol: 'Fm', name: 'F minor', tonic: 'F', bass: undefined,
    intervals: ['1P', '3m', '5P'], pitchClasses: ['F', 'Ab', 'C'],
    chroma: '100001001000',
  });
  assert.deepEqual(resultValue(scaleFact('D', 'dorian')), {
    name: 'D dorian', tonic: 'D', type: 'dorian',
    intervals: ['1P', '2M', '3m', '4P', '5P', '6M', '7m'],
    pitchClasses: ['D', 'E', 'F', 'G', 'A', 'B', 'C'],
    chroma: '101011010101',
  });
  assert.deepEqual(resultValue(modeFact('dorian', 'D')).pitchClasses,
    ['D', 'E', 'F', 'G', 'A', 'B', 'C']);
  const key = resultValue(keyFact('C minor'));
  assert.equal(key.name, 'C minor');
  assert.equal(key.keySignature, 'bbb');
  assert.deepEqual(key.pitchClasses, ['C', 'D', 'Eb', 'F', 'G', 'Ab', 'Bb']);
  assert.deepEqual(key.triads, ['Cm', 'Ddim', 'Eb', 'Fm', 'Gm', 'Ab', 'Bb']);
});

test('T-detection: detection and pitch-class sets are input-order independent', () => {
  const first = resultValue(detectHarmony(['G4', 'C3', 'E5']));
  const second = resultValue(detectHarmony(['E', 'G', 'C']));
  assert.deepEqual(first, second);
  assert.deepEqual(first.pitchClasses, ['C', 'E', 'G']);
  assert.ok(first.chords.includes('CM'));
  assert.deepEqual(first.chords, [...first.chords].sort((left, right) => left.localeCompare(right)));
  assert.deepEqual(first.scales, [...first.scales].sort((left, right) => left.localeCompare(right)));

  const sharp = resultValue(pitchClassSetFact(['A#', 'F#', 'C', 'E', 'D', 'G#']));
  const flat = resultValue(pitchClassSetFact(['Ab', 'D', 'Bb', 'Gb', 'E', 'C']));
  assert.deepEqual(sharp, flat);
  assert.deepEqual(sharp.pitchClasses, ['C', 'D', 'E', 'Gb', 'Ab', 'Bb']);
  assert.equal(sharp.chroma, '101010101010');
});

test('T-progression: minor-key degrees resolve against the key scale', () => {
  const progression = resultValue(progressionFact('C minor', ['i', 'VI', 'III', 'VII']));
  assert.deepEqual(progression.chordSymbols, ['Cm', 'Ab', 'Eb', 'Bb']);
  assert.deepEqual(progression.degrees, ['i', 'VI', 'III', 'VII']);
  assert.equal(progression.key.name, 'C minor');
});

test('T-corpus: every generation request has deterministic explicit-channel notes', () => {
  const generationCases = MUSICAL_REQUEST_CORPUS.filter((entry) =>
    entry.outcome.kind === 'patch'
    && entry.outcome.patch.targets.every((target) => target.operations[0]?.op === 'generate'));
  assert.equal(generationCases.length, 5);
  for (const entry of generationCases) {
    assert.equal(entry.outcome.kind, 'patch');
    const first = materializeGenerationPatch(entry.outcome.patch);
    const second = materializeGenerationPatch(entry.outcome.patch);
    assert.deepEqual(second, first, entry.id);
    const targets = resultValue(first);
    assert.equal(targets.length, entry.outcome.patch.targets.length, entry.id);
    for (const target of targets) {
      assert.ok(target.notes.length > 0, entry.id);
      for (const note of target.notes) {
        assert.equal(note.channel, target.channel, entry.id);
        assert.equal(note.provenance.targetIndex, target.targetIndex, entry.id);
        assert.equal(note.provenance.variationIndex, target.variationIndex, entry.id);
        assert.equal(note.provenance.operationIndex, 0, entry.id);
        assert.ok(Number.isFinite(note.startBeats), entry.id);
        assert.ok(note.durationBeats > 0, entry.id);
        assert.ok(note.velocity >= 0 && note.velocity <= 127, entry.id);
      }
    }
  }
});

test('T-generation: progression and theory forms have fixed beats and pitches', () => {
  const progressionCase = MUSICAL_REQUEST_CORPUS.find((entry) => entry.id === 'generation-progression')!;
  assert.equal(progressionCase.outcome.kind, 'patch');
  const progression = resultValue(materializeGenerationPatch(progressionCase.outcome.patch))[0]!;
  assert.deepEqual(progression.notes.map((note) => [note.startBeats, note.pitch]), [
    [0, 48], [0, 51], [0, 55],
    [1, 56], [1, 60], [1, 63],
    [2, 51], [2, 55], [2, 58],
    [3, 58], [3, 62], [3, 65],
  ]);

  const formsCase = MUSICAL_REQUEST_CORPUS.find((entry) => entry.id === 'several-clips-theory-forms')!;
  assert.equal(formsCase.outcome.kind, 'patch');
  const forms = resultValue(materializeGenerationPatch(formsCase.outcome.patch));
  assert.deepEqual(forms[0]!.notes.map((note) => [note.startBeats, note.pitch]),
    [[0, 53], [0, 56], [0, 60]]);
  assert.deepEqual(forms[1]!.notes.map((note) => [note.startBeats, note.pitch]),
    [[0, 53], [1, 57], [2, 60]]);
});

test('T-generation: literal order survives for as-played arpeggiation', () => {
  const patch = parseMusicalPatch({
    schema: 'ghostnote-musical-patch', version: 1, protection: { kind: 'direct' },
    targets: [{
      clip: { trackId: 'track-a', row: 0 }, channel: 0, write: 'replace',
      operations: [
        {
          op: 'generate', source: { kind: 'notes', notes: [
            { startBeats: 0, pitch: 67, velocity: 100, durationBeats: 1 },
            { startBeats: 0, pitch: 60, velocity: 100, durationBeats: 1 },
            { startBeats: 0, pitch: 64, velocity: 100, durationBeats: 1 },
          ] },
        },
        { op: 'arpeggiate', pattern: 'as-played', stepBeats: 0.5, durationBeats: 0.4 },
      ],
    }],
  });
  const generated = resultValue(materializeGenerationPatch(patch))[0]!;
  assert.deepEqual(generated.notes.map((note) => note.pitch), [67, 60, 64]);
});

test('T-generation: equivalent pitch-class inputs have identical canonical output', () => {
  const base = {
    schema: 'ghostnote-musical-patch', version: 1, protection: { kind: 'direct' },
    targets: [{
      clip: { trackId: 'track-a', row: 0 }, channel: 9, write: 'replace',
      operations: [{
        op: 'generate',
        source: { kind: 'pitch-class-set', pitchClasses: ['Db', 'D#', 'G#'], octave: 3, octaves: 1 },
        placement: { kind: 'sequence', startBeats: 0, stepBeats: 0.5, durationBeats: 0.5 },
        velocity: 80,
      }],
    }],
  };
  const equivalent = structuredClone(base);
  equivalent.targets[0]!.operations[0]!.source.pitchClasses = ['Ab', 'Eb', 'C#'];
  const first = resultValue(materializeGenerationPatch(parseMusicalPatch(base)));
  const second = resultValue(materializeGenerationPatch(parseMusicalPatch(equivalent)));
  assert.deepEqual(second, first);
  assert.deepEqual(first[0]!.notes.map((note) => note.pitch), [49, 51, 56]);
});

test('T-compiler-boundary: compiler values keep target provenance and remove local note fields', () => {
  const entry = MUSICAL_REQUEST_CORPUS.find((item) => item.id === 'literal-expression-merge')!;
  assert.equal(entry.outcome.kind, 'patch');
  const generated = resultValue(materializeGenerationPatch(entry.outcome.patch))[0]!;
  const materialized = toMaterializedMusicalTarget(generated);
  assert.deepEqual(
    {
      channel: materialized.channel,
      targetIndex: materialized.targetIndex,
      variationIndex: materialized.variationIndex,
      operationIndex: materialized.operationIndex,
    },
    { channel: 4, targetIndex: 0, variationIndex: 0, operationIndex: 0 },
  );
  assert.equal('channel' in materialized.notes[0]!, false);
  assert.equal('provenance' in materialized.notes[0]!, false);
  assert.equal(materialized.notes[0]!.gain, 0.7);
});

test('T-refusal: invalid theory, empty input, and MIDI range fail with action', () => {
  assert.deepEqual(noteFact('H4'), {
    ok: false, code: 'invalid-note',
    reason: 'invalid note name "H4"; use a name such as C, Db, or F#4',
  });
  assert.deepEqual(noteFact('G#9'), {
    ok: false, code: 'midi-range',
    reason: 'note "G#9" resolves to MIDI pitch 128, outside 0-127; choose another octave or source',
  });
  assert.deepEqual(noteFact('C-2'), {
    ok: false, code: 'midi-range',
    reason: 'note "C-2" resolves to MIDI pitch -12, outside 0-127; choose another octave or source',
  });
  const invalidInterval = intervalFact('perfect-ish');
  assert.equal(invalidInterval.ok, false);
  if (!invalidInterval.ok) assert.match(invalidInterval.reason, /3M or 5P/);
  const unknownChord = chordFact('C definitely-not-a-chord');
  assert.equal(unknownChord.ok, false);
  if (!unknownChord.ok) assert.match(unknownChord.reason, /unknown chord/);
  const unknownScale = scaleFact('C', 'definitely-not-a-scale');
  assert.equal(unknownScale.ok, false);
  if (!unknownScale.ok) assert.match(unknownScale.reason, /unknown scale/);
  const empty = detectHarmony([]);
  assert.equal(empty.ok, false);
  if (!empty.ok) assert.match(empty.reason, /at least one note/);

  const impossible = parseMusicalPatch({
    schema: 'ghostnote-musical-patch', version: 1, protection: { kind: 'direct' },
    targets: [{
      clip: { trackId: 'track-a', row: 0 }, channel: 0, write: 'replace',
      operations: [{
        op: 'generate', source: { kind: 'chord', symbol: 'C', octave: 10 },
        placement: { kind: 'stack', startBeats: 0, durationBeats: 1 }, velocity: 100,
      }],
    }],
  });
  const range = materializeGenerationPatch(impossible);
  assert.equal(range.ok, false);
  if (!range.ok) assert.match(range.reason, /outside 0-127.*choose another octave/);

  const impossibleRoot = parseMusicalPatch({
    schema: 'ghostnote-musical-patch', version: 1, protection: { kind: 'direct' },
    targets: [{
      clip: { trackId: 'track-a', row: 0 }, channel: 0, write: 'replace',
      operations: [{
        op: 'generate', source: { kind: 'intervals', root: 'G#9', intervals: ['1P'] },
        placement: { kind: 'stack', startBeats: 0, durationBeats: 1 }, velocity: 100,
      }],
    }],
  });
  const rootRange = materializeGenerationPatch(impossibleRoot);
  assert.equal(rootRange.ok, false);
  if (!rootRange.ok) {
    assert.equal(rootRange.code, 'midi-range');
    assert.match(rootRange.reason, /note "G#9" resolves to MIDI pitch 128/);
  }

  const duplicate = parseMusicalPatch({
    schema: 'ghostnote-musical-patch', version: 1, protection: { kind: 'direct' },
    targets: [{
      clip: { trackId: 'track-a', row: 0 }, channel: 3, write: 'replace',
      operations: [{
        op: 'generate', source: { kind: 'notes', notes: [
          { startBeats: 0, pitch: 60, velocity: 100, durationBeats: 1 },
          { startBeats: 0, pitch: 60, velocity: 90, durationBeats: 0.5 },
        ] },
      }],
    }],
  });
  const duplicateResult = materializeGenerationPatch(duplicate);
  assert.equal(duplicateResult.ok, false);
  if (!duplicateResult.ok) {
    assert.equal(duplicateResult.code, 'duplicate-note');
    assert.match(duplicateResult.reason, /channel 3.*pitch 60.*beat 0/);
  }

  const transform = MUSICAL_REQUEST_CORPUS.find((entry) => entry.id === 'transform-detected-harmony')!;
  assert.equal(transform.outcome.kind, 'patch');
  const wrongBoundary = materializeGenerationPatch(transform.outcome.patch);
  assert.equal(wrongBoundary.ok, false);
  if (!wrongBoundary.ok) assert.match(wrongBoundary.reason, /transformation boundary/);
});
