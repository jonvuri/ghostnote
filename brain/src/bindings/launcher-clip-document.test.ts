import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import type { ClipSnapshot } from '../contract/clip-snapshot.js';
import type { NoteRecord } from '../contract/state.js';
import { equivalentExactJson, pythonCanonical } from '../probes/phase8h4b-document-read-lib.js';
import { hostGain } from './ghostnote-document.js';
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
  muted: boolean; release_velocity: number; track: string; articulation: string;
  expression: { pressure: string; timbre: string; pan: string; gain: string };
}
interface Fixture { sha256: string; length_beats: string; notes: FixtureNote[] }

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
      // The 8c gain is a portable amplitude ratio; the host stores its raw value (E245).
      gain: hostGain(number(item.expression.gain)),
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

/** The fixture as a document, with the read IDs. */
function projectFixture(name: keyof typeof PINNED) {
  const snapshot = snapshotOf(CORPUS[name]!);
  const cells = launcherClipCells(snapshot);
  return projectLauncherClip(snapshot, 'c1', cells.map((_, index) => `e${(index + 1).toString(36)}`)).document;
}

/** FIELDS bytes against the equivalent exact JSON and against the 8c control fields, for one fixture. */
export function measureFixture(name: keyof typeof PINNED) {
  const fixture = CORPUS[name]!;
  const document = projectFixture(name);
  const fields = Buffer.byteLength(encodeLauncherClip(document, 'fields'));
  const exact = Buffer.byteLength(equivalentExactJson(document));
  // The 8c control without the fields that the document does not represent (track, articulation).
  const control = Buffer.byteLength(pythonCanonical({ length_beats: fixture.length_beats,
    notes: fixture.notes.map(({ track: _track, articulation: _articulation, ...rest }) => rest) }));
  return { notes: fixture.notes.length, fields, exact, control };
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
 * E245 records these bytes. FIELDS is at most 40 percent of the equivalent exact JSON. Each 8c note has MIDI
 * release velocity 64, not the default 100/127, so each row keeps it in WITH (about 45 bytes). The pins make any
 * change of the read output visible.
 */
test('8h4b2 corpus: FIELDS is at most 40 percent of the equivalent exact JSON', () => {
  const measured = Object.fromEntries((Object.keys(PINNED) as (keyof typeof PINNED)[]).map((name) => {
    const { fields, exact, control } = measureFixture(name);
    assert.ok(fields <= 0.4 * exact, `${name}: ${fields} > 40 percent of ${exact}`);
    return [name, { fields, exact, control }];
  }));
  assert.deepEqual(measured, {
    short: { fields: 1528, exact: 4330, control: 2200 },
    medium: { fields: 4673, exact: 16818, control: 8495 },
    long: { fields: 9006, exact: 33674, control: 17133 },
  });
});

/** A typical E231 clip of new host notes (256 notes, 16 channels): no WITH object, and the same bound. */
test('8h4b2 typical clip: host-default notes have no WITH object', () => {
  const channels: NoteRecord[][] = Array.from({ length: 16 }, (_, channel) => Array.from({ length: 16 }, (_, k) => {
    const step = k * 16 + channel;
    return { startBeats: step / 4, durationBeats: 0.125, pitch: 36 + (step % 48), velocity: 100,
      releaseVelocity: 100 / 127, isChanceEnabled: true, isOccurrenceEnabled: true, isRecurrenceEnabled: true,
      isRepeatEnabled: true };
  }));
  const snapshot: ClipSnapshot = { ref: {} as ClipSnapshot['ref'], metadata: { name: '', color: { red: 0, green: 0,
    blue: 0 } as never, lengthBeats: 64, playStartBeats: 0, loopEnabled: true, loopStartBeats: 0, loopEndBeats: 64 },
  channels };
  const cells = launcherClipCells(snapshot);
  const { document } = projectLauncherClip(snapshot, 'c1', cells.map((_, index) => `e${(index + 1).toString(36)}`));
  const fields = encodeLauncherClip(document, 'fields');
  assert.ok(!fields.includes(' WITH '));
  const bytes = { notes: 256, fields: Buffer.byteLength(fields), exact: Buffer.byteLength(equivalentExactJson(document)) };
  assert.ok(bytes.fields <= 0.4 * bytes.exact);
  assert.deepEqual(bytes, { notes: 256, fields: 9902, exact: 92468 });
});
