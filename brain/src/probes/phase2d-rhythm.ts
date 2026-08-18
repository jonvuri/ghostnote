/** Phase 2 session 2d — independent live readback for straight and triplet timing. */
import { emptyObservationRecord, encodeObservationRecord } from '../observation/index.js';
import { check, client, cursorStatus, failureCount, note, point, pollUntil } from './lib.js';

const TRACKS: Readonly<Record<string, string>> = {
  '98ba8aa3-dbce-4e51-8bb2-de9302542b6e': 'Instrument Layer',
  '4a6a024a-f213-48f1-9029-532fc077d857': 'Hybrid 2',
  'd61c23c2-4f85-4eee-bc08-8bb9baf6ff63': 'gn-A',
  '78a40fcf-3eae-48fc-badf-1ff18900166b': 'gn-B',
  'ae4caa0f-f689-4f17-88cf-a5ae0d9ebdd3': 'Group 5',
  'd367ac16-b7bd-4662-971f-fe924ec033a3': 'gn-lay',
  '9a88b37d-337a-4ef2-96a8-a147419d7cda': 'gn-lay4',
  '6fb96670-abde-4958-9147-f573a4b43918': 'gn-sel',
  '52bd865e-c958-4bda-b9d3-97d0ea2f463a': 'FX 1',
  '834e65ab-efa4-4bc6-ae9d-4eafd818d16e': 'Master',
};
const CLIP_TRACK_IDS = [
  'd61c23c2-4f85-4eee-bc08-8bb9baf6ff63',
  '78a40fcf-3eae-48fc-badf-1ff18900166b',
  'd367ac16-b7bd-4662-971f-fe924ec033a3',
  '9a88b37d-337a-4ef2-96a8-a147419d7cda',
  '6fb96670-abde-4958-9147-f573a4b43918',
] as const;
const HOME_TRACK_ID = 'd367ac16-b7bd-4662-971f-fe924ec033a3';
const EMPTY_RECORD = encodeObservationRecord(emptyObservationRecord());
const WRITER = '0';
const WITNESS = '1';
const GRID = 1 / 12;

interface TrackRow {
  readonly index: number;
  readonly name: string;
  readonly channelId: string;
}

interface Selection {
  readonly trackIndex: number;
  readonly slotIndex: number;
}

interface VerboseNote {
  readonly x: number;
  readonly y: number;
  readonly duration: number;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const close = (left: number, right: number): boolean => Math.abs(left - right) <= 2e-3;
const selection = async (): Promise<Selection> =>
  (await client.request('selection.status')) as Selection;

async function observation(): Promise<string> {
  const result = (await client.request('observation.read')) as {
    readonly available?: boolean;
    readonly value?: string;
  };
  if (result.available !== true || typeof result.value !== 'string') {
    throw new Error('the observation record is unavailable');
  }
  return result.value;
}

async function occupiedCount(tracks: readonly TrackRow[]): Promise<number> {
  let count = 0;
  for (const track of tracks) {
    for (let row = 0; row < 10; row += 1) {
      const status = (await client.request('slot.status', {
        trackIndex: track.index, slotIndex: row,
      })) as { readonly hasContent: boolean };
      if (status.hasContent) count += 1;
    }
  }
  return count;
}

async function restoreSelection(target: Selection): Promise<void> {
  await client.request('slot.select', {
    trackIndex: target.trackIndex, slotIndex: target.slotIndex, mechanism: 'slot',
  });
  const settled = await pollUntil(async () => {
    const current = await selection();
    return current.trackIndex === target.trackIndex && current.slotIndex === target.slotIndex;
  });
  if (!settled.ok) throw new Error('the entry selection did not restore');
}

await client.connect();
const originalSelection = await selection();
let tracks: TrackRow[] = [];
let probeTrack: TrackRow | undefined;
let probeRow: number | undefined;
let created = false;
let originalOccupied = -1;

try {
  const listed = (await client.request('track.list')) as { readonly tracks: TrackRow[] };
  tracks = listed.tracks;
  const identitiesMatch = tracks.length === Object.keys(TRACKS).length
    && tracks.every((track) => TRACKS[track.channelId] === track.name);
  check('2d-L0: all destructive fixture identities match the documented baseline', identitiesMatch,
    tracks.map(({ index, name, channelId }) => ({ index, name, channelId })));
  if (!identitiesMatch) throw new Error('fixture identity mismatch');

  const project = (await client.request('revision.get')) as { readonly project?: string };
  const transport = (await client.request('transport.status')) as { readonly isPlaying?: boolean };
  const record = await observation();
  originalOccupied = await occupiedCount(tracks);
  const baseline = project.project === 'gn-scale-test' && transport.isPlaying === false
    && record === EMPTY_RECORD && originalOccupied === 22;
  check('2d-L1: project, transport, observation, and occupied-cell baseline match', baseline,
    { project: project.project, isPlaying: transport.isPlaying, occupied: originalOccupied, record });
  if (!baseline) throw new Error('live project baseline mismatch');

  for (const trackId of CLIP_TRACK_IDS) {
    const candidate = tracks.find((track) => track.channelId === trackId);
    if (candidate === undefined) continue;
    for (let row = 2; row < 10; row += 1) {
      const status = (await client.request('slot.status', {
        trackIndex: candidate.index, slotIndex: row,
      })) as { readonly hasContent: boolean };
      if (!status.hasContent) {
        probeTrack = candidate;
        probeRow = row;
        break;
      }
    }
    if (probeTrack !== undefined) break;
  }
  check('2d-L2: the probe claims a slot proven empty by live readback',
    probeTrack !== undefined && probeRow !== undefined,
    { track: probeTrack?.name, row: probeRow });
  if (probeTrack === undefined || probeRow === undefined) throw new Error('no empty probe slot');

  await client.request('clip.create', {
    trackIndex: probeTrack.index, slotIndex: probeRow, lengthBeats: 4,
  });
  created = true;
  const appeared = await pollUntil(async () => {
    const status = (await client.request('slot.status', {
      trackIndex: probeTrack!.index, slotIndex: probeRow!,
    })) as { readonly hasContent: boolean };
    return status.hasContent;
  });
  check('2d-L3: the owned probe clip exists', appeared.ok);
  if (!appeared.ok) throw new Error('probe clip did not appear');

  const writerPoint = await point(WRITER, probeTrack.index, probeRow, 'trackThenSlot');
  check('2d-L4: writer cursor points to the owned clip', writerPoint.ok);
  if (!writerPoint.ok) throw new Error('writer did not point to the probe clip');
  await client.request('cursor.setStepSize', { cursor: WRITER, stepSize: GRID });
  await sleep(200);
  await client.request('cursor.setNotes', {
    cursor: WRITER,
    notes: [
      [2, 60, 100, 1 / 3],
      [3, 64, 90, 0.25],
    ],
  });
  await sleep(100);

  const witnessPoint = await point(WITNESS, probeTrack.index, probeRow, 'trackThenSlot');
  check('2d-L5: independent witness cursor points to the owned clip', witnessPoint.ok);
  if (!witnessPoint.ok) throw new Error('witness did not point to the probe clip');
  await client.request('cursor.setStepSize', { cursor: WITNESS, stepSize: GRID });
  await sleep(200);
  const read = async (): Promise<readonly VerboseNote[]> => {
    const result = (await client.request('cursor.getNotesVerbose', {
      cursor: WITNESS, channel: 0, maxX: 48,
    })) as { readonly notes: VerboseNote[] };
    return result.notes;
  };
  const settled = await pollUntil(async () => (await read()).length === 2);
  const first = await read();
  const repeated = await read();
  const triplet = repeated.find((item) => item.x === 2 && item.y === 60);
  const straight = repeated.find((item) => item.x === 3 && item.y === 64);
  check('2d-L6: independent read sees the exact triplet position and duration',
    settled.ok && triplet !== undefined && close(triplet.duration, 1 / 3), triplet);
  check('2d-L7: the same grid reads the exact straight position and duration',
    straight !== undefined && close(straight.duration, 0.25), straight);
  check('2d-L8: repeated independent readback is stable',
    JSON.stringify(repeated) === JSON.stringify(first), { first, repeated });
} catch (error) {
  check('2d-LX: the live probe completed without an unexpected failure', false,
    error instanceof Error ? `${error.name}: ${error.message}` : String(error));
} finally {
  if (created && probeTrack !== undefined && probeRow !== undefined) {
    try {
      await client.request('slot.delete', { trackIndex: probeTrack.index, slotIndex: probeRow });
      const gone = await pollUntil(async () => {
        const status = (await client.request('slot.status', {
          trackIndex: probeTrack!.index, slotIndex: probeRow!,
        })) as { readonly hasContent: boolean };
        return !status.hasContent;
      });
      check('2d-L9: the owned probe clip is removed', gone.ok);
    } catch (error) {
      check('2d-L9: the owned probe clip is removed', false,
        error instanceof Error ? error.message : String(error));
    }
  }

  try {
    const home = tracks.find((track) => track.channelId === HOME_TRACK_ID);
    if (home === undefined) throw new Error('gn-lay home track is absent');
    for (const cursor of ['0', '1', '2']) {
      await client.request('cursor.pin', { cursor, pinned: false });
      await client.request('cursor.pinTrack', { cursor: Number(cursor), pinned: false });
      const restored = await point(cursor, home.index, 0, 'trackThenSlot');
      if (!restored.ok) throw new Error(`cursor ${cursor} did not return to gn-lay row 0`);
      const status = await cursorStatus(cursor);
      if (status.isPinned === true || status.cursorTrackPinned === true) {
        throw new Error(`cursor ${cursor} stayed pinned`);
      }
    }
    await restoreSelection(originalSelection);
    check('2d-L10: cursor homes and entry selection are restored', true, originalSelection);
  } catch (error) {
    check('2d-L10: cursor homes and entry selection are restored', false,
      error instanceof Error ? error.message : String(error));
  }

  try {
    const transport = (await client.request('transport.status')) as { readonly isPlaying?: boolean };
    const finalOccupied = tracks.length === 0 ? -1 : await occupiedCount(tracks);
    const finalSelection = await selection();
    const clean = finalOccupied === originalOccupied && originalOccupied === 22
      && finalSelection.trackIndex === originalSelection.trackIndex
      && finalSelection.slotIndex === originalSelection.slotIndex
      && await observation() === EMPTY_RECORD && transport.isPlaying === false;
    check('2d-L11: the documented live baseline is exact after cleanup', clean,
      { occupied: finalOccupied, selection: finalSelection, isPlaying: transport.isPlaying });
  } catch (error) {
    check('2d-L11: the documented live baseline is exact after cleanup', false,
      error instanceof Error ? error.message : String(error));
  }

  try {
    const at = (await client.request('revision.get')) as {
      readonly generation?: string;
      readonly project?: string;
    };
    const result = (await client.request('status.push', {
      value: 'Change · 4a-live-check',
      expectedGeneration: at.generation,
      expectedProject: at.project,
    })) as { readonly accepted?: boolean };
    check('2d-L12: Last change returns to the documented baseline', result.accepted === true, result);
  } catch (error) {
    check('2d-L12: Last change returns to the documented baseline', false,
      error instanceof Error ? error.message : String(error));
  }
}

note(`Phase 2 session 2d live rhythm probe: ${failureCount() === 0 ? 'PASS' : 'FAILED'}`);
client.disconnect();
process.exit(failureCount() === 0 ? 0 : 1);
