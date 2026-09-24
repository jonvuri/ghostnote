import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import {
  addressKey, clipMetadata, notes, type NoteRecord, type StateEntry,
} from '../contract/index.js';
import {
  ExactNoteSourceError, exactNoteClipRangeDiagnostic, serializeExactNoteSource, snapshotToExactSource,
  validateExactNoteSource,
} from './exact-note-source.js';
import {
  exactNoteSourceFixture, exactSourceFixtureClipA as clipA,
  exactSourceFixtureEntry as entry, exactSourceFixtureMark as mark,
  exactSourceFixtureNote as note, exactSourceFixtureSnapshot as fixtureSnapshot,
} from './exact-note-source.fixture.js';

test('7a-S03: canonical exact state sorts clips, keys, channels, and notes without field loss', () => {
  const source = exactNoteSourceFixture();
  assert.deepEqual(source.clips.map((item) => item.track.channelId), ['raw uuid/A', 'β-track']);
  assert.deepEqual(source.aliases, [
    { alias: 't-1', trackId: 'raw uuid/A' },
    { alias: 't-2', trackId: 'β-track' },
  ]);
  assert.equal(source.clips[0]!.channels.length, 16);
  assert.equal(source.clips[1]!.channels.length, 16);
  assert.equal(source.eventMap.length, 3);
  assert.equal(source.eventMap.every((item) => item.sourceSha256 === source.digest.value), true);
  const first = source.clips[0]!.channels[2]!.notes[0]!;
  assert.equal(first.startBeats, 0, 'negative zero is normalized');
  assert.equal(first.releaseVelocity, 72);
  assert.equal(first.gain, 0.75);
  assert.deepEqual(source.clips[1]!.channels[0]!.notes[0]!.recurrence, [7, 5]);
  assert.equal(source.clips[1]!.channels[0]!.notes[0]!.durationBeats, 1 / 768);
  validateExactNoteSource(source);

  const serialized = serializeExactNoteSource(source);
  assert.equal(serialized.endsWith('\n'), false);
  assert.doesNotMatch(serialized, /"digest"|"aliases"|"eventMap"/);
  assert.match(serialized, /Café/);
  assert.equal(source.digest.value, '2b840c8ba867ca2496120ae8c81d49e4e99835fc40d1f5d2a71c431a848f37fc');
});

test('7a-S03: object insertion order does not change identity and Unicode is not normalized', () => {
  const source = exactNoteSourceFixture();
  const reordered = fixtureSnapshot();
  const target = reordered.entries[addressKey(notes(clipA, 2))]!;
  assert.equal(target.value.of, 'notes');
  if (target.value.of !== 'notes') return;
  const original = target.value.notes[0]!;
  const reorderedNote = {
    gain: original.gain,
    isMuted: original.isMuted,
    durationBeats: original.durationBeats,
    velocity: original.velocity,
    pitch: original.pitch,
    releaseVelocity: original.releaseVelocity,
    startBeats: original.startBeats,
  } as NoteRecord;
  (reordered.entries as Record<string, StateEntry>)[addressKey(notes(clipA, 2))] = entry(notes(clipA, 2), {
    of: 'notes', notes: [reorderedNote],
  });
  assert.equal(exactNoteSourceFixture(reordered).digest.value, source.digest.value);

  const decomposed = fixtureSnapshot();
  const metadata = decomposed.entries[addressKey(clipMetadata(clipA))]!;
  assert.equal(metadata.value.of, 'clipMetadata');
  if (metadata.value.of !== 'clipMetadata') return;
  (decomposed.entries as Record<string, StateEntry>)[addressKey(clipMetadata(clipA))] = entry(clipMetadata(clipA), {
    of: 'clipMetadata',
    metadata: { ...metadata.value.metadata, name: 'Cafe\u0301 Lead A' },
  });
  assert.notEqual(exactNoteSourceFixture(decomposed).digest.value, source.digest.value);
});

test('7a-S03 refusal: incomplete data, invalid notes, stale generations, and stale guards fail', () => {
  const incomplete = fixtureSnapshot();
  delete (incomplete.entries as Record<string, StateEntry>)[addressKey(notes(clipA, 15))];
  assert.throws(() => exactNoteSourceFixture(incomplete), /channel 15 was not read completely/);

  const duplicate = fixtureSnapshot();
  (duplicate.entries as Record<string, StateEntry>)[addressKey(notes(clipA, 2))] = entry(notes(clipA, 2), {
    of: 'notes', notes: [note({ pitch: 64 }), note({ pitch: 64, velocity: 20 })],
  });
  assert.throws(() => exactNoteSourceFixture(duplicate), /duplicate note key/);

  const invalid = fixtureSnapshot();
  (invalid.entries as Record<string, StateEntry>)[addressKey(notes(clipA, 2))] = entry(notes(clipA, 2), {
    of: 'notes', notes: [note({ gain: Number.NaN })],
  });
  assert.throws(() => exactNoteSourceFixture(invalid), /finite numbers/);

  assert.throws(() => snapshotToExactSource({
    snapshot: fixtureSnapshot(), clips: [clipA],
    source: { kind: 'live-bitwig', id: 'live', permission: 'operator-owned project' },
    expectedGeneration: 'stale-generation',
  }), /generation changed/);

  const source = exactNoteSourceFixture();
  const staleMark = {
    ...source,
    observedAt: { ...source.observedAt, sceneEpoch: source.observedAt.sceneEpoch + 1 },
  };
  const staleDigest = createHash('sha256')
    .update(serializeExactNoteSource(staleMark), 'utf8').digest('hex');
  const staleGuardSource = {
    ...staleMark,
    digest: { ...source.digest, value: staleDigest },
    eventMap: source.eventMap.map((item) => ({ ...item, sourceSha256: staleDigest })),
  };
  assert.throws(() => validateExactNoteSource(staleGuardSource), /stale scene epoch/);
});

test('7a-S03 refusal: missing, unreachable, and unstable required reads never become empty state', () => {
  const required = notes(clipA, 4);
  for (const field of ['missing', 'unreachable', 'unstable'] as const) {
    const snapshot = fixtureSnapshot({ [field]: [required] });
    assert.throws(
      () => exactNoteSourceFixture(snapshot),
      (error) => error instanceof ExactNoteSourceError && error.message.includes(field),
    );
  }
});

test('7b-follow-up: the exact clip-range diagnostic retains observed ranges', () => {
  const snapshot = fixtureSnapshot();
  const clipEntry = snapshot.entries[addressKey(clipA)]!;
  const metadataEntry = snapshot.entries[addressKey(clipMetadata(clipA))]!;
  assert.equal(clipEntry.value.of, 'clip');
  assert.equal(metadataEntry.value.of, 'clipMetadata');
  if (clipEntry.value.of !== 'clip' || metadataEntry.value.of !== 'clipMetadata') return;
  (snapshot.entries as Record<string, StateEntry>)[addressKey(clipA)] = entry(clipA, {
    of: 'clip', exists: true, lengthBeats: 16,
  });
  (snapshot.entries as Record<string, StateEntry>)[addressKey(clipMetadata(clipA))] = entry(
    clipMetadata(clipA), {
      of: 'clipMetadata',
      metadata: {
        ...metadataEntry.value.metadata,
        lengthBeats: 16,
        loopStartBeats: 24,
        loopEndBeats: 40,
      },
    },
  );
  (snapshot.entries as Record<string, StateEntry>)[addressKey(notes(clipA, 2))] = entry(
    notes(clipA, 2), { of: 'notes', notes: [note({ startBeats: 24, durationBeats: 16 })] },
  );
  (snapshot.entries as Record<string, StateEntry>)[addressKey(notes(clipA, 3))] = entry(
    notes(clipA, 3), { of: 'notes', notes: [] },
  );
  const source = exactNoteSourceFixture(snapshot);
  const target = source.clips.find((item) => addressKey(item.address) === addressKey(clipA))!;
  const diagnostic = exactNoteClipRangeDiagnostic(target);
  assert.deepEqual(diagnostic?.localRange, { fromBeats: 0, toBeats: 16 });
  assert.deepEqual(diagnostic?.loopRange, { fromBeats: 24, toBeats: 40 });
  assert.deepEqual(diagnostic?.noteContentRange, { fromBeats: 24, toBeats: 40 });
  assert.match(diagnostic?.message ?? '', /Select this clip in Bitwig and use Consolidate/);
});

test('7b-follow-up: negative notes are exact source data and require consolidation', () => {
  const snapshot = fixtureSnapshot();
  (snapshot.entries as Record<string, StateEntry>)[addressKey(notes(clipA, 2))] = entry(
    notes(clipA, 2), { of: 'notes', notes: [note({ startBeats: -0.25 })] },
  );
  const source = exactNoteSourceFixture(snapshot);
  const target = source.clips.find((item) => addressKey(item.address) === addressKey(clipA))!;
  assert.equal(exactNoteClipRangeDiagnostic(target)?.noteContentRange?.fromBeats, -0.25);
});
