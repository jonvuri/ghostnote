/**
 * Phase 1 session 5e — stale-revision refusal and positive control.
 *
 * Cursor 0 writes. Cursor 1 is the independent read witness. The probe creates
 * one clip in a slot that live readback proves empty. It submits the same
 * two-operation batch first with a stale revision and then with the current
 * revision. Cleanup removes the probe clip and restores the complete fixture.
 */
import { LiveAdapter } from '../adapters/live/adapter.js';
import { BridgeTransport } from '../adapters/live/transport.js';
import {
  addressKey, clip, notes as notesAt, scene, slot, track,
  type Address, type ClipAddress, type NoteRecord, type Op,
} from '../contract/index.js';
import { emptyObservationRecord, encodeObservationRecord } from '../observation/index.js';
import { check, client, failureCount, note, pollUntil } from './lib.js';

const PROJECT = 'gn-scale-test';
const WRITER_CURSOR = '0';
const WITNESS_CURSOR = '1';
const ROWS = 10;
const EMPTY_RECORD = encodeObservationRecord(emptyObservationRecord());
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
const PROBE_TRACK_IDS = Object.entries(TRACKS)
  .filter(([, name]) => name.startsWith('gn-'))
  .map(([id]) => id);

interface TrackRow {
  readonly index: number;
  readonly name: string;
  readonly channelId: string;
}

interface Selection {
  readonly trackIndex: number;
  readonly slotIndex: number;
}

const selection = async (): Promise<Selection> =>
  (await client.request('selection.status')) as Selection;

async function select(target: Selection): Promise<Selection> {
  await client.request('slot.select', {
    trackIndex: target.trackIndex,
    slotIndex: target.slotIndex,
    mechanism: 'slot',
  });
  const settled = await pollUntil(async () => {
    const current = await selection();
    return current.trackIndex === target.trackIndex && current.slotIndex === target.slotIndex;
  });
  if (!settled.ok) {
    throw new Error(`selection did not reach track ${target.trackIndex}, row ${target.slotIndex}`);
  }
  return selection();
}

async function readObservation(): Promise<string> {
  const reply = (await client.request('observation.read')) as {
    readonly available?: boolean;
    readonly value?: string;
  };
  if (reply.available !== true || typeof reply.value !== 'string') {
    throw new Error('the observation record is unavailable');
  }
  return reply.value;
}

async function readNotes(adapter: LiveAdapter, address: Address): Promise<readonly NoteRecord[]> {
  const snapshot = await adapter.read([address]);
  const value = snapshot.entries[addressKey(address)]?.value;
  return value?.of === 'notes' ? value.notes : [];
}

function requestedOps(target: ClipAddress): readonly Op[] {
  return [
    {
      op: 'note.write',
      clip: target,
      notes: [{ startBeats: 0, pitch: 72, velocity: 91, durationBeats: 0.5 }],
    },
    {
      op: 'note.write',
      clip: target,
      notes: [{ startBeats: 1, pitch: 79, velocity: 83, durationBeats: 0.5 }],
    },
  ];
}

await client.connect();
const originalSelection = await selection();
const writer = new LiveAdapter({
  transport: new BridgeTransport(client), cursorRefs: [WRITER_CURSOR],
});
const witness = new LiveAdapter({
  transport: new BridgeTransport(client), cursorRefs: [WITNESS_CURSOR],
});
let created = false;
let probeRow: number | undefined;
let probeTrack: TrackRow | undefined;

try {
  await writer.hello();
  await witness.hello();
  const listed = (await client.request('track.list')) as { tracks: TrackRow[] };
  const identitiesMatch = listed.tracks.length === Object.keys(TRACKS).length
    && listed.tracks.every((item) => TRACKS[item.channelId] === item.name);
  check('5e-L0: all destructive fixture identities match the documented baseline',
    identitiesMatch, listed.tracks);
  if (!identitiesMatch) throw new Error('fixture identity mismatch');

  const info = (await client.request('rig.info')) as { scenes?: number; sceneCount?: number };
  const mark = (await client.request('revision.get')) as { project?: string };
  const transport = (await client.request('transport.status')) as { isPlaying?: boolean };
  const observation = await readObservation();
  const baselineMatches = mark.project === PROJECT && info.scenes === 16
    && info.sceneCount === ROWS && observation === EMPTY_RECORD
    && transport.isPlaying === false && originalSelection.trackIndex === 0
    && originalSelection.slotIndex === 1;
  check('5e-L1: project, rows, observation, transport, and selection match the baseline',
    baselineMatches, { project: mark.project, info, transport, originalSelection });
  if (!baselineMatches) throw new Error('live project baseline mismatch');

  for (const trackId of PROBE_TRACK_IDS) {
    const candidate = listed.tracks.find((item) => item.channelId === trackId);
    if (candidate === undefined) continue;
    for (let row = 2; row < ROWS; row += 1) {
      const status = (await client.request('slot.status', {
        trackIndex: candidate.index,
        slotIndex: row,
      })) as { hasContent: boolean };
      if (!status.hasContent) {
        probeTrack = candidate;
        probeRow = row;
        break;
      }
    }
    if (probeTrack !== undefined) break;
  }
  check('5e-L2: the probe claims a slot proven empty by live readback',
    probeTrack !== undefined && probeRow !== undefined,
    { track: probeTrack?.name, row: probeRow });
  if (probeTrack === undefined || probeRow === undefined) throw new Error('no empty probe slot');

  const beforeCreate = await writer.revision();
  const probeSlot = slot(track(probeTrack.channelId), scene(probeRow, beforeCreate.sceneEpoch));
  const probeClip = clip(probeSlot);
  const address = notesAt(probeClip);
  await writer.apply({ ops: [{ op: 'clip.create', slot: probeSlot, lengthBeats: 4 }] });
  created = true;
  await writer.settle('trackStruct');
  check('5e-L3: the independent cursor confirms the probe clip starts empty',
    (await readNotes(witness, address)).length === 0);

  const stale = await writer.revision();
  await client.request('revision.bump');
  const current = await writer.revision();
  check('5e-L4: an intervening writer advances the shared revision',
    current.revision === stale.revision + 1,
    { stale: stale.revision, current: current.revision });

  const ops = requestedOps(probeClip);
  const rejected = await writer.apply({ ops, ifRevision: stale.revision });
  await writer.settle('noteWrite');
  const afterStale = await readNotes(witness, address);
  check('5e-L5: the stale two-operation batch rejects whole with zero stages',
    rejected.accepted === false && rejected.rejected?.reason === 'stale-revision'
      && rejected.rejected.expected === stale.revision
      && rejected.rejected.actual === current.revision && rejected.stages.length === 0,
    rejected);
  check('5e-L6: independent readback proves the stale batch applied zero operations',
    afterStale.length === 0, afterStale);

  const fresh = await writer.revision();
  const accepted = await writer.apply({ ops, ifRevision: fresh.revision });
  await writer.settle('noteWrite');
  const afterFresh = await readNotes(witness, address);
  const appliedWrites = accepted.stages.flatMap((stage) => stage.ops)
    .filter((item) => item.op === 'cursor.setNotes' && item.ok).length;
  check('5e-L7: the same batch applies against the current revision',
    accepted.accepted === true && accepted.rejected === undefined
      && accepted.stages.length === 1 && appliedWrites === ops.length,
    accepted);
  check('5e-L8: independent readback finds both positive-control operations',
    afterFresh.length === 2 && afterFresh.some((item) => item.pitch === 72)
      && afterFresh.some((item) => item.pitch === 79), afterFresh);
} catch (error) {
  check('5e-LX: the focused live probe completed without an unexpected failure', false,
    error instanceof Error ? `${error.name}: ${error.message}` : String(error));
} finally {
  if (created && probeTrack !== undefined && probeRow !== undefined) {
    try {
      const current = await writer.revision();
      const target = slot(track(probeTrack.channelId), scene(probeRow, current.sceneEpoch));
      await writer.apply({ ops: [{ op: 'clip.delete', slot: target }] });
      await writer.settle('trackStruct');
      const status = (await client.request('slot.status', {
        trackIndex: probeTrack.index,
        slotIndex: probeRow,
      })) as { hasContent: boolean };
      check('5e-L9: cleanup removes the positive-control clip', !status.hasContent);
    } catch (error) {
      check('5e-L9: cleanup removes the positive-control clip', false,
        error instanceof Error ? error.message : String(error));
    }
  }

  try {
    if (originalSelection.trackIndex >= 0 && originalSelection.slotIndex >= 0) {
      await select(originalSelection);
    }
    const finalSelection = await selection();
    const finalTracks = (await client.request('track.list')) as { tracks: TrackRow[] };
    const finalInfo = (await client.request('rig.info')) as { sceneCount?: number };
    const finalTransport = (await client.request('transport.status')) as { isPlaying?: boolean };
    const finalMatches = finalTracks.tracks.length === Object.keys(TRACKS).length
      && finalTracks.tracks.every((item) => TRACKS[item.channelId] === item.name)
      && finalInfo.sceneCount === ROWS && await readObservation() === EMPTY_RECORD
      && finalTransport.isPlaying === false
      && finalSelection.trackIndex === originalSelection.trackIndex
      && finalSelection.slotIndex === originalSelection.slotIndex;
    check('5e-L10: the complete fixture returns to its documented baseline',
      finalMatches, { finalInfo, finalTransport, finalSelection });
  } catch (error) {
    check('5e-L10: the complete fixture returns to its documented baseline', false,
      error instanceof Error ? error.message : String(error));
  }
  await writer.close();
}

note(`Phase 1 session 5e: ${failureCount() === 0 ? 'PASS' : 'FAILED'}`);
process.exit(failureCount() === 0 ? 0 : 1);
