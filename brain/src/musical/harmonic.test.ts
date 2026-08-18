import assert from 'node:assert/strict';
import test from 'node:test';

import { FakeAdapter } from '../adapters/fake/adapter.js';
import {
  NOTE_PROP_FIDELITY, addressKey, clip, notes as notesAt, scene, slot, track,
  type NoteRecord,
} from '../contract/index.js';
import { Executor } from '../engine/index.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { workspaceOf, type Workspace } from '../surface/workspace.js';
import {
  MUSICAL_REQUEST_CORPUS, compileMusicalClip, groupNotesByExactOnset,
  materializeHarmonicTarget, parseMusicalPatch, resolveHarmonyPlan,
  selectCanonicalNotes, toMaterializedMusicalTarget,
  type CanonicalMusicalNote, type MusicalOperation, type MusicalTarget,
  type TheoryResult,
} from './index.js';

const provenance = { targetIndex: 0, variationIndex: 0, operationIndex: -1 } as const;

function canonical(over: Partial<CanonicalMusicalNote> = {}): CanonicalMusicalNote {
  return {
    startBeats: 0,
    pitch: 60,
    velocity: 96,
    durationBeats: 1,
    channel: 3,
    provenance,
    ...over,
  };
}

function valueOf<T>(result: TheoryResult<T>): T {
  if (!result.ok) assert.fail(result.reason);
  return result.value;
}

function target(
  operations: readonly MusicalOperation[],
  channel = 3,
  write: 'merge' | 'replace' = 'replace',
): MusicalTarget {
  return parseMusicalPatch({
    schema: 'ghostnote-musical-patch',
    version: 1,
    protection: { kind: 'direct' },
    targets: [{ clip: { trackId: 'track-a', row: 0 }, channel, write, operations }],
  }).targets[0]!;
}

function withoutPitch(note: NoteRecord): Omit<NoteRecord, 'pitch'> {
  const { pitch: _pitch, ...rest } = note;
  return rest;
}

function withoutBoundary(note: CanonicalMusicalNote): NoteRecord {
  const { channel: _channel, provenance: _source, ...plain } = note;
  return plain;
}

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

async function offlineFixture(): Promise<{
  workspace: Workspace;
  address: ReturnType<typeof clip>;
}> {
  const fake = new FakeAdapter({ tracks: ['gn-A'], scenes: 2 });
  const [trackState] = await fake.tracks();
  const at = await fake.revision();
  const address = clip(slot(track(trackState!.channelId), scene(0, at.sceneEpoch)));
  let change = 0;
  const workspace = workspaceOf({
    ready: async () => undefined,
    adapter: fake,
    executor: new Executor(fake, { newId: () => `harmonic-${++change}`, now: () => 1 }),
    stash: new Stash({ now: () => 1 }),
    observationStore: new FakeObservationStore(),
  });
  await workspace.apply([{ op: 'clip.create', slot: address.slot, lengthBeats: 8 }]);
  return { workspace, address };
}

async function preflight(workspace: Workspace, address: ReturnType<typeof clip>) {
  const addresses = Array.from({ length: 16 }, (_item, channel) => notesAt(address, channel));
  const snapshot = await workspace.read(addresses);
  return {
    revision: snapshot.at.revision,
    channels: addresses.map((notesAddress) => {
      const entry = snapshot.entries[addressKey(notesAddress)];
      assert.equal(entry?.value.of, 'notes');
      return {
        channel: notesAddress.channel,
        notes: entry!.value.of === 'notes' ? entry!.value.notes : [],
      };
    }),
  };
}

test('H-seams: selection and exact-onset grouping stay separate and preserve order', () => {
  const notes = [
    canonical({ startBeats: 0, pitch: 60 }),
    canonical({ startBeats: 1, pitch: 64 }),
    canonical({ startBeats: 2, pitch: 62 }),
    canonical({ startBeats: 1, pitch: 67 }),
  ];
  const selected = selectCanonicalNotes(notes, {
    beatRange: { fromBeats: 1, toBeats: 2 },
    pitchRange: { min: 64, max: 67 },
  });
  assert.deepEqual([...selected.selectedIndexes], [1, 3]);
  assert.deepEqual(selected.selected.map((note) => note.pitch), [64, 67]);

  const groups = groupNotesByExactOnset(notes);
  assert.deepEqual(groups.map((group) => [group.startBeats, group.sourceIndexes]), [
    [0, [0]], [1, [1, 3]], [2, [2]],
  ]);
  assert.deepEqual(groups[1]!.notes.map((note) => note.pitch), [64, 67]);
});

test('H-seams: grouping and range-local harmony resolution are replaceable', () => {
  let groupingCalls = 0;
  const source = [
    { ...FULL_EXPRESSION_NOTE, startBeats: 0, pitch: 60 },
    { ...FULL_EXPRESSION_NOTE, startBeats: 2, pitch: 60 },
  ];
  const result = valueOf(materializeHarmonicTarget(target([{
    op: 'harmonize', harmony: { kind: 'chord', symbol: 'C' },
  }]), source, 0, 0, {
    groupNotes: (notes, sourceIndexes) => {
      groupingCalls += 1;
      return groupNotesByExactOnset(notes, sourceIndexes);
    },
    resolveHarmony: () => ({
      ok: true,
      warnings: [],
      value: {
        kind: 'regions',
        regions: [
          { fromBeats: 0, toBeats: 2, label: 'C major', pitchClasses: ['C', 'E', 'G'] },
          { fromBeats: 2, toBeats: 4, label: 'C minor', pitchClasses: ['C', 'Eb', 'G'] },
        ],
      },
    }),
  }));
  assert.equal(groupingCalls, 1);
  assert.deepEqual(result.notes.map((note) => [note.startBeats, note.pitch]), [
    [0, 60], [0, 64], [0, 55],
    [2, 60], [2, 63], [2, 55],
  ]);
});

test('H-selection: group reconstruction preserves interleaved unselected order', () => {
  const source = [60, 70, 61].map((pitch, index) => ({
    ...FULL_EXPRESSION_NOTE, pitch, velocity: 90 + index,
  }));
  const result = valueOf(materializeHarmonicTarget(target([
    {
      op: 'harmonize', harmony: { kind: 'intervals', intervals: ['8P'] },
      selection: { pitchRange: { min: 60, max: 61 } },
    },
    { op: 'arpeggiate', pattern: 'as-played', stepBeats: 0.25, durationBeats: 0.2 },
  ]), source));
  assert.deepEqual(result.notes.map((note) => [note.startBeats, note.pitch, note.velocity]), [
    [0, 60, 90], [0.25, 70, 91], [0.5, 61, 92], [0.75, 72, 90], [1, 73, 92],
  ]);
});

test('H-transpose: pitch changes while timing, channel, and all expression stay exact', () => {
  const source = [FULL_EXPRESSION_NOTE, { ...FULL_EXPRESSION_NOTE, startBeats: 1, pitch: 72 }];
  const result = valueOf(materializeHarmonicTarget(target([{
    op: 'transpose', semitones: 7, selection: { pitchRange: { min: 60, max: 60 } },
  }]), source));
  assert.deepEqual(result.notes.map((note) => note.pitch), [67, 72]);
  assert.deepEqual(withoutPitch(withoutBoundary(result.notes[0]!)), withoutPitch(source[0]!));
  assert.deepEqual(withoutBoundary(result.notes[1]!), source[1]);
  assert.ok(result.notes.every((note) => note.channel === 3));
  assert.deepEqual(result.loss, []);
});

test('H-harmonize: interval and regional plans add deterministic expression-preserving voices', () => {
  const source = [{ ...FULL_EXPRESSION_NOTE, pitch: 64 }];
  const intervals = valueOf(materializeHarmonicTarget(target([{
    op: 'harmonize', harmony: { kind: 'intervals', intervals: ['3m', '5P'] },
  }]), source));
  assert.deepEqual(intervals.notes.map((note) => note.pitch), [64, 67, 71]);
  assert.deepEqual(intervals.loss.map((item) => item.code), ['note-added', 'note-added']);
  assert.deepEqual(withoutPitch(withoutBoundary(intervals.notes[1]!)), withoutPitch(source[0]!));

  const chordPlan = valueOf(resolveHarmonyPlan(
    { kind: 'chord', symbol: 'Cmaj7' },
    [canonical({ pitch: 64 })],
  ));
  assert.equal(chordPlan.kind, 'regions');
  if (chordPlan.kind === 'regions') {
    assert.deepEqual(chordPlan.regions[0]!.pitchClasses, ['C', 'E', 'G', 'B']);
    assert.equal(chordPlan.regions[0]!.fromBeats, Number.NEGATIVE_INFINITY);
  }
  const chord = valueOf(materializeHarmonicTarget(target([{
    op: 'harmonize', harmony: { kind: 'chord', symbol: 'Cmaj7' },
  }]), source));
  assert.deepEqual(chord.notes.map((note) => note.pitch).sort((left, right) => left - right),
    [59, 60, 64, 67]);
  assert.ok(chord.notes.every((note) => note.startBeats === 0 && note.channel === 3));

  const scale = valueOf(materializeHarmonicTarget(target([{
    op: 'harmonize', harmony: { kind: 'scale', tonic: 'C', name: 'major' },
  }]), [{ ...FULL_EXPRESSION_NOTE, pitch: 60 }]));
  assert.equal(scale.notes.length, 7);
  assert.deepEqual(new Set(scale.notes.map((note) => note.pitch % 12)),
    new Set([0, 2, 4, 5, 7, 9, 11]));

  const detected = valueOf(materializeHarmonicTarget(target([{
    op: 'harmonize', harmony: { kind: 'detect', as: 'chord' },
  }]), [
    { ...FULL_EXPRESSION_NOTE, startBeats: 0, pitch: 60 },
    { ...FULL_EXPRESSION_NOTE, startBeats: 1, pitch: 64 },
    { ...FULL_EXPRESSION_NOTE, startBeats: 2, pitch: 67 },
  ]));
  assert.equal(detected.notes.length, 9);
  assert.equal(detected.loss.length, 6);
});

test('H-arpeggiate: patterns process each onset group and preserve non-owned fields', () => {
  const source = [
    { ...FULL_EXPRESSION_NOTE, pitch: 67 },
    { ...FULL_EXPRESSION_NOTE, pitch: 60 },
    { ...FULL_EXPRESSION_NOTE, pitch: 64 },
  ];
  const asPlayed = valueOf(materializeHarmonicTarget(target([{
    op: 'arpeggiate', pattern: 'as-played', stepBeats: 0.5, durationBeats: 0.4,
  }]), source));
  assert.deepEqual(asPlayed.notes.map((note) => [note.startBeats, note.pitch]),
    [[0, 67], [0.5, 60], [1, 64]]);
  asPlayed.notes.forEach((note, index) => {
    assert.deepEqual(
      withoutPitch({ ...withoutBoundary(note), startBeats: 0, durationBeats: 0.75 }),
      withoutPitch(source[index]!),
    );
    assert.equal(note.channel, 3);
  });

  const upDown = valueOf(materializeHarmonicTarget(target([{
    op: 'arpeggiate', pattern: 'up-down', stepBeats: 0.25, durationBeats: 0.2,
  }]), source));
  assert.deepEqual(upDown.notes.map((note) => [note.startBeats, note.pitch]),
    [[0, 60], [0.25, 64], [0.5, 67], [0.75, 64]]);
  assert.ok(upDown.loss.some((item) => item.code === 'note-added'));
  assert.ok(upDown.loss.some((item) => item.code === 'timing-moved'));

  for (const [pattern, pitches] of [
    ['up', [60, 64, 67]],
    ['down', [67, 64, 60]],
  ] as const) {
    const result = valueOf(materializeHarmonicTarget(target([{
      op: 'arpeggiate', pattern, stepBeats: 0.25, durationBeats: 0.2,
    }]), source));
    assert.deepEqual(result.notes.map((note) => note.pitch), pitches);
  }
});

test('H-revoice: closest, ascending, and drop-2 report octave displacement', () => {
  const source = [
    { ...FULL_EXPRESSION_NOTE, pitch: 36 },
    { ...FULL_EXPRESSION_NOTE, pitch: 79 },
    { ...FULL_EXPRESSION_NOTE, pitch: 64 },
  ];
  const closest = valueOf(materializeHarmonicTarget(target([{
    op: 'revoice', minPitch: 48, maxPitch: 72, strategy: 'closest',
  }]), source));
  assert.deepEqual(closest.notes.map((note) => note.pitch), [48, 67, 64]);
  assert.deepEqual(closest.loss.map((item) => item.code), ['octave-displaced', 'octave-displaced']);
  closest.notes.forEach((note, index) => {
    assert.deepEqual(withoutPitch(withoutBoundary(note)), withoutPitch(source[index]!));
  });

  const ascending = valueOf(materializeHarmonicTarget(target([{
    op: 'revoice', minPitch: 48, maxPitch: 72, strategy: 'ascending',
  }]), source));
  assert.deepEqual(ascending.notes.map((note) => note.pitch), [48, 52, 55]);

  const drop2Source = [60, 64, 67, 71].map((pitch) => ({ ...FULL_EXPRESSION_NOTE, pitch }));
  const drop2 = valueOf(materializeHarmonicTarget(target([{
    op: 'revoice', minPitch: 36, maxPitch: 84, strategy: 'drop-2',
  }]), drop2Source));
  assert.deepEqual(drop2.notes.map((note) => note.pitch), [55, 60, 64, 71]);
  assert.deepEqual(drop2.loss.map((item) => item.code), ['octave-displaced']);
});

test('H-pipeline: ordered transforms and generation arpeggiation repeat exactly', () => {
  const pipeline = target([
    { op: 'transpose', semitones: 7 },
    { op: 'harmonize', harmony: { kind: 'detect', as: 'chord' } },
    { op: 'revoice', minPitch: 48, maxPitch: 84, strategy: 'closest' },
  ]);
  const source = [60, 64, 67].map((pitch) => ({ ...FULL_EXPRESSION_NOTE, pitch }));
  const first = materializeHarmonicTarget(pipeline, source);
  const second = materializeHarmonicTarget(pipeline, source);
  assert.deepEqual(second, first);
  const output = valueOf(first);
  assert.ok(output.notes.every((note) => note.pitch >= 48 && note.pitch <= 84));

  const corpus = MUSICAL_REQUEST_CORPUS.find((entry) => entry.id === 'replace-mode-arpeggio')!;
  assert.equal(corpus.outcome.kind, 'patch');
  const generated = valueOf(materializeHarmonicTarget(corpus.outcome.patch.targets[0]!, []));
  assert.equal(generated.notes.length, 14);
  assert.deepEqual(generated.notes.slice(0, 3).map((note) => [note.startBeats, note.pitch]),
    [[0, 50], [0.5, 52], [1, 53]]);
  assert.ok(generated.notes.every((note) => note.durationBeats === 0.45 && note.channel === 2));
});

test('H-merge: existing notes stay inputs but are not emitted as new notes', async () => {
  const { workspace, address } = await offlineFixture();
  await workspace.apply([{
    op: 'note.write', clip: address, channel: 3, notes: [FULL_EXPRESSION_NOTE],
  }]);
  const before = await preflight(workspace, address);
  const source = before.channels[3]!.notes;
  const harmonized = valueOf(materializeHarmonicTarget(target([{
    op: 'harmonize', harmony: { kind: 'intervals', intervals: ['3M'] },
  }], 3, 'merge'), source));
  assert.deepEqual(harmonized.notes.map((note) => note.pitch), [64]);

  const compiled = compileMusicalClip(
    address,
    [toMaterializedMusicalTarget(harmonized)],
    before,
  );
  const applied = await workspace.apply(compiled.ops, { ifRevision: compiled.ifRevision });
  assert.equal(applied.take.report.applied, true);
  const after = await preflight(workspace, address);
  assert.deepEqual(after.channels[3]!.notes.map((note) => note.pitch), [60, 64]);

  const partial = valueOf(materializeHarmonicTarget(target([{
    op: 'transpose', semitones: 2, selection: { pitchRange: { min: 60, max: 60 } },
  }], 3, 'merge'), source));
  assert.deepEqual(partial.notes.map((note) => note.pitch), [62]);
});

test('H-refusal: range, duplicate identity, empty selection, and pressure are never silent', () => {
  const range = materializeHarmonicTarget(target([{ op: 'transpose', semitones: 1 }]), [
    { ...FULL_EXPRESSION_NOTE, pitch: 127 },
  ]);
  assert.equal(range.ok, false);
  if (!range.ok) {
    assert.equal(range.code, 'midi-range');
    assert.match(range.reason, /outside 0-127/);
  }

  const duplicate = materializeHarmonicTarget(target([{
    op: 'transpose', semitones: 1, selection: { pitchRange: { min: 60, max: 60 } },
  }]), [FULL_EXPRESSION_NOTE, { ...FULL_EXPRESSION_NOTE, pitch: 61 }]);
  assert.equal(duplicate.ok, false);
  if (!duplicate.ok) {
    assert.equal(duplicate.code, 'duplicate-note');
    assert.match(duplicate.reason, /duplicate collapse is refused/);
  }

  const empty = materializeHarmonicTarget(target([{
    op: 'transpose', semitones: 2, selection: { beatRange: { fromBeats: 2, toBeats: 3 } },
  }]), [FULL_EXPRESSION_NOTE]);
  assert.equal(empty.ok, false);
  if (!empty.ok) assert.match(empty.reason, /at least one selected note/);

  const pressure = materializeHarmonicTarget(target([{ op: 'transpose', semitones: 2 }]), [
    { ...FULL_EXPRESSION_NOTE, pressure: 0.5 },
  ]);
  assert.equal(pressure.ok, false);
  if (!pressure.ok) {
    assert.equal(pressure.code, 'unwritable-expression');
    assert.match(pressure.reason, /pressure is not writable and cannot be dropped/);
  }
});

test('H-round-trip: transpose preserves every writable property, including exact gain', async () => {
  const exact = Object.entries(NOTE_PROP_FIDELITY)
    .filter(([, fidelity]) => fidelity === 'exact')
    .map(([name]) => name);
  const covered = Object.keys(FULL_EXPRESSION_NOTE).map((name) =>
    name === 'durationBeats' ? 'duration' : name)
    .filter((name) => name !== 'startBeats' && name !== 'pitch');
  assert.deepEqual([...covered].sort(), [...exact].sort());

  const { workspace, address } = await offlineFixture();
  await workspace.apply([{
    op: 'note.write', clip: address, channel: 3, notes: [FULL_EXPRESSION_NOTE],
  }]);
  const before = await preflight(workspace, address);
  const source = before.channels[3]!.notes;
  const transformed = valueOf(materializeHarmonicTarget(
    target([{ op: 'transpose', semitones: 12 }]), source,
  ));
  const compiled = compileMusicalClip(
    address,
    [toMaterializedMusicalTarget(transformed)],
    before,
  );
  const applied = await workspace.apply(compiled.ops, { ifRevision: compiled.ifRevision });
  assert.equal(applied.take.report.applied, true);

  const after = await preflight(workspace, address);
  assert.deepEqual(after.channels[3]!.notes, [{ ...FULL_EXPRESSION_NOTE, pitch: 72 }]);
});
