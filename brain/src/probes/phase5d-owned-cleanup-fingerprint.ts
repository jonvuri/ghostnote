/**
 * Phase 1 session 5d repair — owned cleanup fingerprint live sweep.
 *
 * The probe creates two clips in cells that live readback proves empty. It
 * promotes independent readback to exact cleanup fingerprints, moves one clip,
 * and removes both clips through the shared cleanup path.
 */
import { LiveAdapter } from '../adapters/live/adapter.js';
import { BridgeTransport } from '../adapters/live/transport.js';
import {
  addressKey, clip, notes as notesAt, scene, slot, track,
  type Address, type NoteRecord, type RevisionMark,
} from '../contract/index.js';
import { emptyObservationRecord, encodeObservationRecord } from '../observation/index.js';
import { check, client, failureCount, note, pollUntil } from './lib.js';
import {
  canonicalNotes, ownClip, promoteOwnedClip, removeOwnedClip, type CleanupCell,
  type OwnedClip, type OwnedClipCleanupPort,
} from './phase5d-owned-cleanup.js';

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
const CLIP_TRACK_IDS = Object.entries(TRACKS)
  .filter(([, name]) => name.startsWith('gn-'))
  .map(([id]) => id);
const TARGET_NOTES: readonly NoteRecord[] = [
  { startBeats: 0, pitch: 36, velocity: 72, durationBeats: 0.25 },
];
const DRAG_NOTES: readonly NoteRecord[] = [
  { startBeats: 3.5, pitch: 108, velocity: 64, durationBeats: 0.25 },
];

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

interface Cell extends CleanupCell {
  readonly trackName: string;
}

interface ClipState {
  readonly occupied: boolean;
  readonly notes: readonly NoteRecord[];
}

const selection = async (): Promise<Selection> =>
  (await client.request('selection.status')) as Selection;

const hasContent = async (cell: Pick<Cell, 'trackIndex' | 'row'>): Promise<boolean> =>
  ((await client.request('slot.status', {
    trackIndex: cell.trackIndex,
    slotIndex: cell.row,
  })) as { hasContent: boolean }).hasContent;

const cellKey = (trackId: string, row: number): string => `${trackId}:${row}`;

function rowFor(list: readonly TrackRow[], channelId: string): TrackRow {
  const found = list.find((item) => item.channelId === channelId);
  if (found === undefined) throw new Error(`track ${channelId} is outside the bank`);
  return found;
}

async function claimCells(list: readonly TrackRow[]): Promise<{
  readonly target: Cell;
  readonly dragSource: Cell;
  readonly dragDestination: Cell;
}> {
  for (let row = ROWS - 1; row >= 2; row -= 1) {
    const empty: Cell[] = [];
    for (const trackId of CLIP_TRACK_IDS) {
      const item = rowFor(list, trackId);
      const cell = {
        trackId, trackIndex: item.index, trackName: item.name, row,
      };
      if (!(await hasContent(cell))) empty.push(cell);
    }
    if (empty.length >= 3) {
      return { target: empty[0]!, dragSource: empty[1]!, dragDestination: empty[2]! };
    }
  }
  throw new Error('three fixture tracks have no shared empty row from 2 through 9');
}

async function captureGrid(
  witness: LiveAdapter,
  list: readonly TrackRow[],
  at: RevisionMark,
): Promise<Map<string, ClipState>> {
  const result = new Map<string, ClipState>();
  const addresses: Address[] = [];
  for (const item of list) {
    for (let row = 0; row < ROWS; row += 1) {
      const occupied = await hasContent({ trackIndex: item.index, row });
      result.set(cellKey(item.channelId, row), { occupied, notes: [] });
      if (occupied && item.type !== 'Group' && item.type !== 'Effect'
          && item.type !== 'Master') {
        addresses.push(notesAt(clip(slot(track(item.channelId), scene(row, at.sceneEpoch)))));
      }
    }
  }
  const snapshot = await witness.read(addresses);
  for (const address of addresses) {
    const value = snapshot.entries[addressKey(address)]?.value;
    if (value?.of !== 'notes') throw new Error(`notes are unreadable at ${addressKey(address)}`);
    if (address.kind !== 'notes') continue;
    result.set(cellKey(address.clip.slot.track.channelId, address.clip.slot.scene.index), {
      occupied: true,
      notes: value.notes,
    });
  }
  return result;
}

function compareGrid(
  before: ReadonlyMap<string, ClipState>,
  after: ReadonlyMap<string, ClipState>,
): readonly string[] {
  const differences: string[] = [];
  for (const [key, prior] of before) {
    const current = after.get(key);
    if (current === undefined || current.occupied !== prior.occupied
        || canonicalNotes(current.notes) !== canonicalNotes(prior.notes)) {
      differences.push(key);
    }
  }
  return differences;
}

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
  if (!settled.ok) throw new Error('the entry selection did not restore');
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

await client.connect();
const originalSelection = await selection();
const writer = new LiveAdapter({
  transport: new BridgeTransport(client),
  cursorRefs: [WRITER_CURSOR],
});
const witness = new LiveAdapter({
  transport: new BridgeTransport(client),
  cursorRefs: [WITNESS_CURSOR],
});
let target: Cell | undefined;
let dragSource: Cell | undefined;
let dragDestination: Cell | undefined;
let targetOwned: OwnedClip | undefined;
let dragOwned: OwnedClip | undefined;
let targetCreated = false;
let dragCreated = false;
let baselineGrid: ReadonlyMap<string, ClipState> | undefined;
let listedTracks: readonly TrackRow[] = [];

const cleanupPort: OwnedClipCleanupPort = {
  hasContent,
  async readNotes(cell) {
    const current = await witness.revision();
    const address = notesAt(clip(slot(track(cell.trackId), scene(cell.row, current.sceneEpoch))));
    const state = await witness.read([address]);
    const value = state.entries[addressKey(address)]?.value;
    if (value?.of !== 'notes') throw new Error('the owned clip notes are unreadable');
    return value.notes;
  },
  async move(source, destination) {
    const current = await writer.revision();
    await writer.apply({ ops: [{
      op: 'clip.move',
      source: clip(slot(track(source.trackId), scene(source.row, current.sceneEpoch))),
      destination: slot(track(destination.trackId), scene(destination.row, current.sceneEpoch)),
    }] });
  },
  async remove(cell) {
    const current = await writer.revision();
    await writer.apply({ ops: [{
      op: 'clip.delete',
      slot: slot(track(cell.trackId), scene(cell.row, current.sceneEpoch)),
    }] });
  },
};

try {
  await writer.hello();
  await witness.hello();
  const listed = (await client.request('track.list')) as { tracks: TrackRow[] };
  listedTracks = listed.tracks;
  const identitiesMatch = listed.tracks.length === Object.keys(TRACKS).length
    && listed.tracks.every((item) => TRACKS[item.channelId] === item.name);
  check('5df-L0: all destructive fixture identities match the documented baseline',
    identitiesMatch, listed.tracks);
  if (!identitiesMatch) throw new Error('fixture identity mismatch');

  const info = (await client.request('rig.info')) as { scenes?: number; sceneCount?: number };
  const mark = (await client.request('revision.get')) as { project?: string };
  const observation = await readObservation();
  const transport = (await client.request('transport.status')) as { isPlaying?: boolean };
  const baselineMatches = mark.project === PROJECT && info.scenes === 16 && info.sceneCount === ROWS
    && observation === EMPTY_RECORD && transport.isPlaying === false;
  check('5df-L1: project, rows, observation, and transport match the baseline',
    baselineMatches, { project: mark.project, info, observation, transport });
  if (!baselineMatches) throw new Error('live project baseline mismatch');

  const beforeMark = await witness.revision();
  baselineGrid = await captureGrid(witness, listed.tracks, beforeMark);
  ({ target, dragSource, dragDestination } = await claimCells(listed.tracks));
  check('5df-L2: three claimed cells are empty by live readback',
    !(await hasContent(target)) && !(await hasContent(dragSource))
      && !(await hasContent(dragDestination)),
    { target, dragSource, dragDestination });

  const at = await writer.revision();
  const targetSlot = slot(track(target.trackId), scene(target.row, at.sceneEpoch));
  const sourceSlot = slot(track(dragSource.trackId), scene(dragSource.row, at.sceneEpoch));
  targetOwned = ownClip(target, TARGET_NOTES);
  dragOwned = ownClip(dragSource, DRAG_NOTES, dragDestination);
  await writer.apply({ ops: [{ op: 'clip.create', slot: targetSlot, lengthBeats: 4 }] });
  targetCreated = true;
  await writer.apply({ ops: [{ op: 'clip.create', slot: sourceSlot, lengthBeats: 4 }] });
  dragCreated = true;
  await writer.apply({ ops: [{
    op: 'note.write', clip: clip(targetSlot), notes: targetOwned.creationFingerprint,
  }] });
  await writer.apply({ ops: [{
    op: 'note.write', clip: clip(sourceSlot), notes: dragOwned.creationFingerprint,
  }] });
  await writer.settle('noteWrite');

  const targetReadback = await cleanupPort.readNotes(targetOwned.source);
  const dragReadback = await cleanupPort.readNotes(dragOwned.source);
  targetOwned = promoteOwnedClip(targetOwned, targetReadback);
  dragOwned = promoteOwnedClip(dragOwned, dragReadback);
  check('5df-L3: independent enriched readback becomes each exact fingerprint',
    canonicalNotes(targetReadback) !== canonicalNotes(TARGET_NOTES)
      && canonicalNotes(dragReadback) !== canonicalNotes(DRAG_NOTES)
      && targetOwned.exactFingerprint !== undefined
      && dragOwned.exactFingerprint !== undefined,
    { targetReadback, dragReadback });

  await cleanupPort.move(dragSource, dragDestination);
  await writer.settle('trackStruct');
  check('5df-L4: the owned drag clip moved to its empty destination',
    !(await hasContent(dragSource)) && await hasContent(dragDestination));
} catch (error) {
  check('5df-LX: the focused live sweep completed without an unexpected failure', false,
    error instanceof Error ? `${error.name}: ${error.message}` : String(error));
} finally {
  if (dragCreated && dragOwned !== undefined) {
    try {
      await removeOwnedClip(dragOwned, cleanupPort);
      await writer.settle('trackStruct');
      check('5df-L5: exact cleanup removes the owned drag clip',
        dragSource !== undefined && dragDestination !== undefined
          && !(await hasContent(dragSource)) && !(await hasContent(dragDestination)));
    } catch (error) {
      check('5df-L5: exact cleanup removes the owned drag clip', false,
        error instanceof Error ? error.message : String(error));
    }
  }
  if (targetCreated && targetOwned !== undefined) {
    try {
      await removeOwnedClip(targetOwned, cleanupPort);
      await writer.settle('trackStruct');
      check('5df-L6: exact cleanup removes the owned target clip',
        target !== undefined && !(await hasContent(target)));
    } catch (error) {
      check('5df-L6: exact cleanup removes the owned target clip', false,
        error instanceof Error ? error.message : String(error));
    }
  }
  try {
    const restored = await select(originalSelection);
    check('5df-L7: the sweep restores the entry selection',
      restored.trackIndex === originalSelection.trackIndex
        && restored.slotIndex === originalSelection.slotIndex,
      { originalSelection, restored });
  } catch (error) {
    check('5df-L7: the sweep restores the entry selection', false,
      error instanceof Error ? error.message : String(error));
  }
  try {
    if (baselineGrid === undefined) throw new Error('the baseline grid was not captured');
    const finalMark = await witness.revision();
    const finalGrid = await captureGrid(witness, listedTracks, finalMark);
    const differences = compareGrid(baselineGrid, finalGrid);
    const observation = await readObservation();
    const transport = (await client.request('transport.status')) as { isPlaying?: boolean };
    check('5df-L8: the complete fixture baseline is restored',
      differences.length === 0 && observation === EMPTY_RECORD && transport.isPlaying === false,
      { differences, observation, transport, finalMark });
  } catch (error) {
    check('5df-L8: the complete fixture baseline is restored', false,
      error instanceof Error ? error.message : String(error));
  }
  await writer.close();
}

note(`Phase 1 session 5d cleanup repair: ${failureCount() === 0 ? 'PASS' : 'FAILED'}`);
process.exit(failureCount() === 0 ? 0 : 1);
