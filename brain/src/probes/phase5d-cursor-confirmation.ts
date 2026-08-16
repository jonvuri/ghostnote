/** Phase 1 session 5d repair: read every occupied visible clip without mutation. */
import { LiveAdapter } from '../adapters/live/adapter.js';
import { BridgeTransport } from '../adapters/live/transport.js';
import {
  addressKey, clip, notes as notesAt, scene, slot, track, type Address,
} from '../contract/index.js';
import { emptyObservationRecord, encodeObservationRecord } from '../observation/index.js';
import { check, client, failureCount, note } from './lib.js';

const PROJECT = 'gn-scale-test';
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

interface TrackRow {
  readonly index: number;
  readonly name: string;
  readonly channelId: string;
  readonly type: string;
}

interface Selection {
  readonly trackIndex: number;
  readonly slotIndex: number;
}

async function readObservation(): Promise<string | undefined> {
  const reply = (await client.request('observation.read')) as {
    readonly available?: boolean;
    readonly value?: string;
  };
  return reply.available === true ? reply.value : undefined;
}

async function occupancy(list: readonly TrackRow[]): Promise<Map<string, boolean>> {
  const result = new Map<string, boolean>();
  for (const item of list) {
    for (let row = 0; row < ROWS; row += 1) {
      const status = (await client.request('slot.status', {
        trackIndex: item.index,
        slotIndex: row,
      })) as { hasContent: boolean };
      result.set(`${item.channelId}:${row}`, status.hasContent);
    }
  }
  return result;
}

await client.connect();
const witness = new LiveAdapter({
  transport: new BridgeTransport(client),
  cursorRefs: [WITNESS_CURSOR],
});

try {
  await witness.hello();
  const originalSelection = (await client.request('selection.status')) as Selection;
  const listed = (await client.request('track.list')) as { tracks: TrackRow[] };
  const identitiesMatch = listed.tracks.length === Object.keys(TRACKS).length
    && listed.tracks.every((item) => TRACKS[item.channelId] === item.name);
  check('5d-cursor-L0: all fixture identities match the documented baseline',
    identitiesMatch, listed.tracks);

  const info = (await client.request('rig.info')) as { scenes?: number; sceneCount?: number };
  const beforeMark = await witness.revision();
  const transport = (await client.request('transport.status')) as { isPlaying?: boolean };
  check('5d-cursor-L1: project, rows, observation, and transport match the baseline',
    beforeMark.project === PROJECT && info.scenes === 16 && info.sceneCount === ROWS
      && await readObservation() === EMPTY_RECORD && transport.isPlaying === false,
    { project: beforeMark.project, info, transport });

  const before = await occupancy(listed.tracks);
  const addresses: Address[] = [];
  for (const [key, occupied] of before) {
    if (!occupied) continue;
    const [trackId, rowText] = key.split(':');
    const trackRow = listed.tracks.find((item) => item.channelId === trackId);
    if (trackRow?.type === 'Group' || trackRow?.type === 'Effect'
        || trackRow?.type === 'Master') continue;
    addresses.push(notesAt(clip(slot(
      track(trackId!),
      scene(Number(rowText), beforeMark.sceneEpoch),
    ))));
  }

  const snapshot = await witness.read(addresses);
  const readable = addresses.every((address) =>
    snapshot.entries[addressKey(address)]?.value.of === 'notes');
  check('5d-cursor-L2: every pointable occupied visible clip is readable through cursor 1',
    readable && snapshot.missing.length === 0 && snapshot.unreachable.length === 0,
    { occupied: addresses.length, missing: snapshot.missing, unreachable: snapshot.unreachable });

  const finalSelection = (await client.request('selection.status')) as Selection;
  check('5d-cursor-L3: the sweep restores the entry selection exactly',
    finalSelection.trackIndex === originalSelection.trackIndex
      && finalSelection.slotIndex === originalSelection.slotIndex,
    { originalSelection, finalSelection });

  const after = await occupancy(listed.tracks);
  const afterMark = await witness.revision();
  check('5d-cursor-L4: the sweep does not mutate project content',
    JSON.stringify([...after]) === JSON.stringify([...before])
      && afterMark.contentEpoch === beforeMark.contentEpoch
      && afterMark.sceneEpoch === beforeMark.sceneEpoch
      && await readObservation() === EMPTY_RECORD,
    { beforeMark, afterMark });
} catch (error) {
  check('5d-cursor-LX: the focused live sweep completed without an unexpected failure', false,
    error instanceof Error ? `${error.name}: ${error.message}` : String(error));
} finally {
  await witness.close();
}

note(`Phase 1 session 5d cursor repair: ${failureCount() === 0 ? 'PASS' : 'FAILED'}`);
process.exit(failureCount() === 0 ? 0 : 1);
