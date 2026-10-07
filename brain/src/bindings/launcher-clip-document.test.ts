import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import type { ClipSnapshot } from '../contract/clip-snapshot.js';
import type { NoteRecord } from '../contract/state.js';
import { encodeLauncherClip, launcherClipCells, projectLauncherClip } from './launcher-clip-document.js';

/** The fixed 8c corpus (`benchmarks/compact-bar-v0/corpus.py`), frozen as canonical JSON. */
const CORPUS = JSON.parse(readFileSync(new URL('./fixtures/compact-bar-v0-corpus.json', import.meta.url), 'utf8')) as
  Record<string, Fixture>;
/** Bytes and hashes pinned by `benchmarks/compact-bar-v0/expected-deterministic.json`. */
const PINNED = {
  short: { bytes: 3289, sha256: '1c25dee60c4e0abefe3ab5d2c8899381c6b50cc5fc88b3e722a70dc37de9ba19' },
  medium: { bytes: 11173, sha256: 'c284bc87f98dca39975a348a08b9895700a6ab26693df4aa8f3082984c551ba5' },
  long: { bytes: 21940, sha256: '320a98004bab148fbf49c8bebbdce4d95ee55094e492b3950c3a6ff2a93b2fe6' },
};

interface FixtureNote {
  id: string; channel: number; start: string; duration: string; pitch: number; velocity: number;
  muted: boolean; release_velocity: number;
  expression: { pressure: string; timbre: string; pan: string; gain: string };
}
interface Fixture { sha256: string; length_beats: string; notes: FixtureNote[] }

/** Python `json.dumps(sort_keys=True, separators=(',', ':'), ensure_ascii=False)`. */
function pythonCanonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(pythonCanonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${pythonCanonical((value as Record<string, unknown>)[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
const number = (text: string): number => {
  const [n, d = '1'] = text.split('/');
  return Number(n) / Number(d);
};

/** The fixture as the cold reader would report it: cell onsets and raw host fields. */
function snapshotOf(fixture: Fixture): ClipSnapshot {
  const channels: NoteRecord[][] = Array.from({ length: 16 }, () => []);
  for (const item of fixture.notes) {
    channels[item.channel]!.push({
      startBeats: Math.floor(number(item.start) * 512) / 512,
      durationBeats: number(item.duration),
      pitch: item.pitch,
      velocity: item.velocity,
      releaseVelocity: item.release_velocity / 127,
      isMuted: item.muted,
      pressure: number(item.expression.pressure),
      timbre: number(item.expression.timbre),
      pan: number(item.expression.pan),
      gain: number(item.expression.gain),
      isChanceEnabled: false, isOccurrenceEnabled: false, isRecurrenceEnabled: false, isRepeatEnabled: false,
    });
  }
  const length = number(fixture.length_beats);
  return {
    ref: {} as ClipSnapshot['ref'],
    metadata: { name: '', color: { red: 0, green: 0, blue: 0 } as never, lengthBeats: length, playStartBeats: 0,
      loopEnabled: true, loopStartBeats: 0, loopEndBeats: length },
    channels,
  };
}

/** FIELDS bytes against the 8c exact JSON control, for one fixture. */
export function measureFixture(name: keyof typeof PINNED) {
  const fixture = CORPUS[name]!;
  const snapshot = snapshotOf(fixture);
  const cells = launcherClipCells(snapshot);
  const projection = projectLauncherClip(snapshot, 'c1', cells.map((_, index) => `e${(index + 1).toString(36)}`));
  const fields = Buffer.byteLength(encodeLauncherClip(projection.document, 'fields'));
  const json = Buffer.byteLength(encodeLauncherClip(projection.document, 'json'));
  const exact = Buffer.byteLength(pythonCanonical(fixture));
  const notesOnly = Buffer.byteLength(pythonCanonical({ length_beats: fixture.length_beats, notes: fixture.notes }));
  return { notes: fixture.notes.length, fields, documentJson: json, exact, notesOnly,
    ratioExact: fields / exact, ratioNotesOnly: fields / notesOnly };
}

test('8h4b corpus: the frozen fixture is the pinned 8c corpus', () => {
  for (const [name, pinned] of Object.entries(PINNED)) {
    const fixture = CORPUS[name]!;
    const { sha256, ...body } = fixture;
    assert.equal(Buffer.byteLength(pythonCanonical(fixture)), pinned.bytes, name);
    assert.equal(sha256, pinned.sha256, name);
    assert.equal(createHash('sha256').update(pythonCanonical(body)).digest('hex'), pinned.sha256, name);
  }
});

/**
 * E235 records these bytes. The 40 percent target of the interface audit is NOT met: each 8c note has
 * MIDI release velocity 64, which the document holds exactly as `releaseVelocity` 64/127 in binary64.
 * The pins make any change of the read output visible.
 */
test('8h4b corpus: FIELDS read output bytes against the 8c exact JSON control are pinned', () => {
  const measured = Object.fromEntries((Object.keys(PINNED) as (keyof typeof PINNED)[]).map((name) => {
    const { fields, documentJson, exact, notesOnly } = measureFixture(name);
    return [name, { fields, documentJson, exact, notesOnly }];
  }));
  assert.deepEqual(measured, {
    short: { fields: 1528, documentJson: 2064, exact: 3289, notesOnly: 2672 },
    medium: { fields: 4673, documentJson: 6770, exact: 11173, notesOnly: 10338 },
    long: { fields: 9006, documentJson: 13192, exact: 21940, notesOnly: 20819 },
  });
});
