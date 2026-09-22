/** Complete synthetic exact-note fixture shared by the Phase 7a tests. */
import {
  CONTRACT_TAG, addressKey, clip, clipMetadata, notes, scene, slot, track,
  type ClipAddress, type NoteRecord, type Snapshot, type StateEntry,
} from '../contract/index.js';
import { snapshotToExactSource } from './exact-note-source.js';

export const exactSourceFixtureMark = {
  revision: 19,
  sceneEpoch: 7,
  contentEpoch: 23,
  generation: 'generation-7a',
  project: 'Fixture – β',
  window: {
    tracks: { count: 2, bankSize: 8 },
    scenes: { count: 4, bankSize: 8 },
  },
} as const;

export const exactSourceFixtureClipA = clip(slot(
  track('raw uuid/A'), scene(0, exactSourceFixtureMark.sceneEpoch),
));
export const exactSourceFixtureClipB = clip(slot(
  track('β-track'), scene(1, exactSourceFixtureMark.sceneEpoch),
));

export function exactSourceFixtureNote(over: Partial<NoteRecord> = {}): NoteRecord {
  return {
    startBeats: 0,
    pitch: 60,
    velocity: 91,
    durationBeats: 1,
    isMuted: false,
    ...over,
  };
}

export function exactSourceFixtureEntry(
  address: StateEntry['address'],
  value: StateEntry['value'],
): StateEntry {
  return { address, fidelity: 'exact', value };
}

function addClipEntries(
  entries: Record<string, StateEntry>,
  address: ClipAddress,
  trackName: string,
  channelNotes: Readonly<Record<number, readonly NoteRecord[]>>,
): void {
  const trackAddress = address.slot.track;
  entries[addressKey(trackAddress)] = exactSourceFixtureEntry(trackAddress, {
    of: 'track',
    track: { channelId: trackAddress.channelId, name: trackName, position: 0, type: 'Instrument' },
  });
  entries[addressKey(address)] = exactSourceFixtureEntry(address, {
    of: 'clip', exists: true, lengthBeats: 4,
  });
  const metadataAddress = clipMetadata(address);
  entries[addressKey(metadataAddress)] = exactSourceFixtureEntry(metadataAddress, {
    of: 'clipMetadata',
    metadata: {
      name: `Café ${trackName}`, color: { red: 1, green: 2, blue: 3 },
      lengthBeats: 4, playStartBeats: 0, loopEnabled: true,
      loopStartBeats: 0, loopEndBeats: 4,
    },
  });
  for (let channel = 0; channel < 16; channel += 1) {
    const noteAddress = notes(address, channel);
    entries[addressKey(noteAddress)] = exactSourceFixtureEntry(noteAddress, {
      of: 'notes', notes: channelNotes[channel] ?? [],
    });
  }
}

export function exactSourceFixtureSnapshot(over: Partial<Snapshot> = {}): Snapshot {
  const entries: Record<string, StateEntry> = {};
  addClipEntries(entries, exactSourceFixtureClipB, 'Bass β', {
    0: [exactSourceFixtureNote({
      startBeats: 1 / 3, pitch: 48, durationBeats: 1 / 768, recurrence: [7, 5],
    })],
  });
  addClipEntries(entries, exactSourceFixtureClipA, 'Lead A', {
    2: [exactSourceFixtureNote({
      startBeats: -0, pitch: 64, releaseVelocity: 72, gain: 0.75,
    })],
    3: [exactSourceFixtureNote({ startBeats: 0, pitch: 64, velocity: 80, pan: -0.25 })],
  });
  return {
    contract: CONTRACT_TAG,
    at: exactSourceFixtureMark,
    entries,
    missing: [],
    unreachable: [],
    unstable: [],
    ...over,
  };
}

export function exactNoteSourceFixture(
  snapshot = exactSourceFixtureSnapshot(),
  kind: 'live-bitwig' | 'supplied-exact-state' = 'supplied-exact-state',
) {
  return snapshotToExactSource({
    snapshot,
    clips: [exactSourceFixtureClipB, exactSourceFixtureClipA],
    source: {
      kind, id: 'generated-two-clip-fixture',
      permission: 'generated repository fixture under the MIT license',
    },
    expectedGeneration: exactSourceFixtureMark.generation,
  });
}
