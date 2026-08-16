/**
 * Phase 1 session 5d — production-executor writes under human interference.
 *
 * The probe creates two clips in slots that live readback proves empty. The
 * executor writes one clip while the operator changes selection and moves the
 * other clip. Cursor 1 then reads every visible clip as an independent witness.
 * Cleanup reverts the take, removes both owned clips, and restores selection.
 */
import { LiveAdapter } from '../adapters/live/adapter.js';
import { BridgeTransport } from '../adapters/live/transport.js';
import {
  addressKey, clip, notes as notesAt, scene, slot, track,
  type Address, type NoteRecord, type RevisionMark,
} from '../contract/index.js';
import { Executor } from '../engine/executor.js';
import { emptyObservationRecord, encodeObservationRecord } from '../observation/index.js';
import { check, client, failureCount, note, pollUntil, waitForEnter } from './lib.js';
import {
  canonicalNotes, ownClip, promoteOwnedClip, removeOwnedClip, type CleanupCell,
  type OwnedClip, type OwnedClipCleanupPort,
} from './phase5d-owned-cleanup.js';

const PROJECT = 'gn-scale-test';
const WRITER_CURSOR = '0';
const WITNESS_CURSOR = '1';
const ROWS = 10;
const WRITE_COUNT = 40;
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

interface TrackRow {
  readonly index: number;
  readonly name: string;
  readonly channelId: string;
  readonly type: string;
}

interface Selection {
  readonly trackIndex: number;
  readonly slotIndex: number;
  readonly changes: number;
}

interface Cell extends CleanupCell {
  readonly trackId: string;
  readonly trackIndex: number;
  readonly trackName: string;
  readonly row: number;
}

interface ClipState {
  readonly occupied: boolean;
  readonly notes: readonly NoteRecord[];
}

interface SelectionSample extends Selection {
  readonly atMs: number;
}

const selection = async (): Promise<Selection> =>
  (await client.request('selection.status')) as Selection;

const hasContent = async (cell: Pick<Cell, 'trackIndex' | 'row'>): Promise<boolean> =>
  ((await client.request('slot.status', {
    trackIndex: cell.trackIndex,
    slotIndex: cell.row,
  })) as { hasContent: boolean }).hasContent;

const cellKey = (trackId: string, row: number): string => `${trackId}:${row}`;

async function select(target: Pick<Selection, 'trackIndex' | 'slotIndex'>): Promise<Selection> {
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
      const cell = { trackId, trackIndex: item.index, trackName: item.name, row };
      if (!(await hasContent(cell))) empty.push(cell);
    }
    if (empty.length >= 3) {
      return { target: empty[0]!, dragSource: empty[1]!, dragDestination: empty[2]! };
    }
  }
  throw new Error('three documented fixture tracks have no shared empty row from 2 through 9');
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
      const cell = { trackIndex: item.index, row };
      const occupied = await hasContent(cell);
      result.set(cellKey(item.channelId, row), { occupied, notes: [] });
      // Group and output rows can report aggregate launcher content. They do
      // not own a clip that a launcher cursor can point at.
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
    const row = address.kind === 'notes' ? address.clip.slot.scene.index : -1;
    const trackId = address.kind === 'notes' ? address.clip.slot.track.channelId : '';
    result.set(cellKey(trackId, row), { occupied: true, notes: value.notes });
  }
  return result;
}

function compareUnintended(
  before: ReadonlyMap<string, ClipState>,
  after: ReadonlyMap<string, ClipState>,
  target: Cell,
  source: Cell,
  destination: Cell,
): { readonly ok: boolean; readonly differences: readonly string[] } {
  const differences: string[] = [];
  const ignored = new Set([
    cellKey(target.trackId, target.row),
    cellKey(source.trackId, source.row),
    cellKey(destination.trackId, destination.row),
  ]);
  for (const [key, prior] of before) {
    if (ignored.has(key)) continue;
    const current = after.get(key);
    if (current === undefined || current.occupied !== prior.occupied
        || canonicalNotes(current.notes) !== canonicalNotes(prior.notes)) {
      differences.push(key);
    }
  }
  return { ok: differences.length === 0, differences };
}

function requestedNotes(): NoteRecord[] {
  const pans = [-0.5, -0.25, 0.25, 0.5] as const;
  return Array.from({ length: WRITE_COUNT }, (_, i) => ({
    startBeats: (i % 8) * 0.5,
    pitch: 40 + i,
    velocity: 80 + (i % 20),
    durationBeats: 0.25,
    // Bitwig omits a default pan of zero from verbose note readback. Use only
    // explicit non-zero values so absence cannot be confused with a lost write.
    pan: pans[i % pans.length],
  }));
}

function hasRequested(got: readonly NoteRecord[], requested: readonly NoteRecord[]): boolean {
  return requested.every((wanted) => got.some((item) =>
    item.pitch === wanted.pitch
    && Math.abs(item.startBeats - wanted.startBeats) < 1e-9
    && Math.abs(item.velocity - wanted.velocity) <= 2e-3
    && Math.abs(item.durationBeats - wanted.durationBeats) <= 2e-3
    && item.pan !== undefined && Math.abs(item.pan - (wanted.pan ?? 0)) <= 2e-3));
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

async function monitorSelection(
  initial: Selection,
  stop: Promise<void>,
): Promise<{ readonly samples: readonly SelectionSample[]; readonly missed: number }> {
  const started = Date.now();
  const samples: SelectionSample[] = [{ ...initial, atMs: 0 }];
  let previous = initial;
  let missed = 0;
  let stopped = false;
  void stop.then(() => { stopped = true; });
  while (!stopped) {
    const current = await selection();
    if (current.changes !== previous.changes) {
      missed += Math.max(0, current.changes - previous.changes - 1);
      samples.push({ ...current, atMs: Date.now() - started });
      previous = current;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  const current = await selection();
  if (current.changes !== previous.changes) {
    missed += Math.max(0, current.changes - previous.changes - 1);
    samples.push({ ...current, atMs: Date.now() - started });
  }
  return { samples, missed };
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
const executor = new Executor(writer);
let targetCreated = false;
let dragCreated = false;
let target: Cell | undefined;
let dragSource: Cell | undefined;
let dragDestination: Cell | undefined;
let take: Awaited<ReturnType<Executor['run']>> | undefined;
let targetBaseline: readonly NoteRecord[] = [];
let dragBaseline: readonly NoteRecord[] = [];
let targetOwned: OwnedClip | undefined;
let dragOwned: OwnedClip | undefined;

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
  const identitiesMatch = listed.tracks.length === Object.keys(TRACKS).length
    && listed.tracks.every((item) => TRACKS[item.channelId] === item.name);
  check('5d-L0: all destructive fixture identities match the documented baseline',
    identitiesMatch, listed.tracks);
  if (!identitiesMatch) throw new Error('fixture identity mismatch');

  const info = (await client.request('rig.info')) as { scenes?: number; sceneCount?: number };
  const mark = (await client.request('revision.get')) as { project?: string };
  const observation = await readObservation();
  const transport = (await client.request('transport.status')) as { isPlaying?: boolean };
  check('5d-L1: the project, rows, observation record, and transport match the baseline',
    mark.project === PROJECT && info.scenes === 16 && info.sceneCount === ROWS
      && observation === EMPTY_RECORD && transport.isPlaying === false,
    { project: mark.project, info, observation, transport });
  if (mark.project !== PROJECT || info.scenes !== 16 || info.sceneCount !== ROWS
      || observation !== EMPTY_RECORD || transport.isPlaying !== false) {
    throw new Error('live project baseline mismatch');
  }

  ({ target, dragSource, dragDestination } = await claimCells(listed.tracks));
  check('5d-L2: the write and drag cells are empty by live readback',
    !(await hasContent(target)) && !(await hasContent(dragSource))
      && !(await hasContent(dragDestination)),
    { target, dragSource, dragDestination });

  const at = await writer.revision();
  const targetSlot = slot(track(target.trackId), scene(target.row, at.sceneEpoch));
  const sourceSlot = slot(track(dragSource.trackId), scene(dragSource.row, at.sceneEpoch));
  const targetClip = clip(targetSlot);
  const dragClip = clip(sourceSlot);
  targetOwned = ownClip(target, [
    { startBeats: 0, pitch: 36, velocity: 72, durationBeats: 0.25 },
  ]);
  dragOwned = ownClip(dragSource, [
    { startBeats: 3.5, pitch: 108, velocity: 64, durationBeats: 0.25 },
  ], dragDestination);
  targetBaseline = targetOwned.creationFingerprint;
  dragBaseline = dragOwned.creationFingerprint;
  await writer.apply({ ops: [{ op: 'clip.create', slot: targetSlot, lengthBeats: 4 }] });
  targetCreated = true;
  await writer.apply({ ops: [{ op: 'clip.create', slot: sourceSlot, lengthBeats: 4 }] });
  dragCreated = true;
  await writer.apply({ ops: [{
    op: 'note.write', clip: targetClip,
    notes: targetBaseline,
  }] });
  await writer.apply({ ops: [{
    op: 'note.write', clip: dragClip,
    notes: dragBaseline,
  }] });
  await writer.settle('noteWrite');

  const targetFingerprint = await cleanupPort.readNotes(targetOwned.source);
  const dragFingerprint = await cleanupPort.readNotes(dragOwned.source);
  const promotedTarget = promoteOwnedClip(targetOwned, targetFingerprint);
  const promotedDrag = promoteOwnedClip(dragOwned, dragFingerprint);
  targetOwned = promotedTarget;
  dragOwned = promotedDrag;
  targetBaseline = promotedTarget.exactFingerprint;
  dragBaseline = promotedDrag.exactFingerprint;
  check('5d-L3: both owned clip fingerprints read through the witness cursor',
    targetOwned.exactFingerprint !== undefined && dragOwned.exactFingerprint !== undefined,
    { targetFingerprint, dragFingerprint });

  const beforeMark = await witness.revision();
  const beforeGrid = await captureGrid(witness, listed.tracks, beforeMark);

  const selectionHome = rowFor(listed.tracks, '78a40fcf-3eae-48fc-badf-1ff18900166b');
  const initial = await select({ trackIndex: selectionHome.index, slotIndex: 0 });
  await waitForEnter(
    `Bring Bitwig to the foreground. During the run:\n`
      + `     1. Move the clip from ${dragSource.trackName} row ${dragSource.row + 1} `
      + `to ${dragDestination.trackName} row ${dragDestination.row + 1}.\n`
      + `     2. Select at least two other clips on different tracks.\n`
      + `     3. Do not select ${target.trackName} row ${target.row + 1} or gn-B row 1.\n`
      + '     Keep editing until the terminal says STOP.',
  );
  console.log('\nStarting in 3 seconds. Keep Bitwig in the foreground.');
  await new Promise((resolve) => setTimeout(resolve, 3000));
  console.log(`WRITE NOW: ${WRITE_COUNT} production writes are running. INTERFERE NOW.`);

  let stopMonitor!: () => void;
  const stop = new Promise<void>((resolve) => { stopMonitor = resolve; });
  const monitored = monitorSelection(initial, stop);
  const requested = requestedNotes();
  take = await executor.run(requested.map((item) => ({
    op: 'note.write' as const,
    clip: targetClip,
    notes: [item],
  })));
  stopMonitor();
  const selectionTrace = await monitored;
  console.log('STOP: the executor pipeline and final restore are complete.\n');

  const finalSelection = await selection();
  const afterMark = await witness.revision();
  const afterGrid = await captureGrid(witness, listed.tracks, afterMark);
  const targetAfter = afterGrid.get(cellKey(target.trackId, target.row));
  const sourceAfter = afterGrid.get(cellKey(dragSource.trackId, dragSource.row));
  const destinationAfter = afterGrid.get(cellKey(dragDestination.trackId, dragDestination.row));
  const unintended = compareUnintended(
    beforeGrid, afterGrid, target, dragSource, dragDestination);

  const targetArrivals = selectionTrace.samples.filter((sample, index, all) =>
    sample.trackIndex === target?.trackIndex && sample.slotIndex === target?.row
      && (index === 0 || all[index - 1]?.trackIndex !== target?.trackIndex
        || all[index - 1]?.slotIndex !== target?.row)).length;
  const restoreArrivals = selectionTrace.samples.filter((sample, index, all) =>
    index > 0 && sample.trackIndex === initial.trackIndex && sample.slotIndex === initial.slotIndex
      && (all[index - 1]?.trackIndex !== initial.trackIndex
        || all[index - 1]?.slotIndex !== initial.slotIndex)).length;
  const humanSelections = new Set(selectionTrace.samples
    .filter((sample) => !(sample.trackIndex === target?.trackIndex && sample.slotIndex === target?.row)
      && !(sample.trackIndex === initial.trackIndex && sample.slotIndex === initial.slotIndex))
    .map((sample) => `${sample.trackIndex}:${sample.slotIndex}`));
  const humanTracks = new Set(selectionTrace.samples
    .filter((sample) => !(sample.trackIndex === target?.trackIndex && sample.slotIndex === target?.row)
      && !(sample.trackIndex === initial.trackIndex && sample.slotIndex === initial.slotIndex))
    .map((sample) => sample.trackIndex));
  const dragEvents = take.report.concurrent.filter((event) =>
    (event.channelId === dragSource?.trackId && event.slotIndex === dragSource?.row
      && event.filled === false)
    || (event.channelId === dragDestination?.trackId && event.slotIndex === dragDestination?.row
      && event.filled === true));

  check('5d-L4: the production executor applies and verifies all requested writes',
    take.report.applied && take.report.disagreements.length === 0, take.report);
  check('5d-L5: the independent cursor finds all writes on the durable target',
    targetAfter?.occupied === true && hasRequested(targetAfter.notes, requested), targetAfter);
  check('5d-L6: no non-probe clip changes and the drag clip contains no target write',
    unintended.ok && sourceAfter?.occupied === false && destinationAfter?.occupied === true
      && canonicalNotes(destinationAfter.notes) === canonicalNotes(dragBaseline)
      && !destinationAfter.notes.some((item) => requested.some((wanted) =>
        item.pitch === wanted.pitch && item.startBeats === wanted.startBeats)),
    { differences: unintended.differences, sourceAfter, destinationAfter });
  check('5d-L7: the executor reports the outside-target drag by both durable identities',
    dragEvents.length === 2, { concurrent: take.report.concurrent });
  check('5d-L8: the operator changed clips and tracks during the measured pipeline',
    humanSelections.size >= 2 && humanTracks.size >= 2,
    { humanSelections: [...humanSelections], humanTracks: [...humanTracks] });
  check('5d-L9: selection measurement saw one target borrow and one final restore',
    selectionTrace.missed === 0 && targetArrivals === 1 && restoreArrivals === 1,
    { targetArrivals, restoreArrivals, missed: selectionTrace.missed,
      samples: selectionTrace.samples });
  check('5d-L10: the final selection matches the selection from before the run',
    finalSelection.trackIndex === initial.trackIndex
      && finalSelection.slotIndex === initial.slotIndex,
    { initial, finalSelection });

  const reverted = await executor.revertUnchecked(take);
  const revertedMark = await witness.revision();
  const revertedGrid = await captureGrid(witness, listed.tracks, revertedMark);
  const targetReverted = revertedGrid.get(cellKey(target.trackId, target.row));
  check('5d-L11: revert restores the owned target exactly through the witness cursor',
    reverted.unrestored.length === 0 && targetReverted?.occupied === true
      && canonicalNotes(targetReverted.notes) === canonicalNotes(targetBaseline),
    { unrestored: reverted.unrestored, targetReverted, targetBaseline });
} catch (error) {
  check('5d-LX: the focused live probe completed without an unexpected failure', false,
    error instanceof Error ? `${error.name}: ${error.message}` : String(error));
} finally {
  if (dragCreated && dragOwned !== undefined && dragSource !== undefined
      && dragDestination !== undefined) {
    try {
      await removeOwnedClip(dragOwned, cleanupPort);
      await writer.settle('trackStruct');
      check('5d-L12: the owned drag clip is removed from both cells',
        !(await hasContent(dragSource)) && !(await hasContent(dragDestination)));
    } catch (error) {
      check('5d-L12: the owned drag clip is removed from both cells', false,
        error instanceof Error ? error.message : String(error));
    }
  }
  if (targetCreated && targetOwned !== undefined && target !== undefined) {
    try {
      await removeOwnedClip(targetOwned, cleanupPort);
      await writer.settle('trackStruct');
      check('5d-L13: the owned write-target clip is removed', !(await hasContent(target)));
    } catch (error) {
      check('5d-L13: the owned write-target clip is removed', false,
        error instanceof Error ? error.message : String(error));
    }
  }
  if (originalSelection.trackIndex >= 0 && originalSelection.slotIndex >= 0) {
    try {
      const restored = await select(originalSelection);
      check('5d-L14: the probe restores the pre-run user selection',
        restored.trackIndex === originalSelection.trackIndex
          && restored.slotIndex === originalSelection.slotIndex,
        { originalSelection, restored });
    } catch (error) {
      check('5d-L14: the probe restores the pre-run user selection', false,
        error instanceof Error ? error.message : String(error));
    }
  }
  try {
    check('5d-L15: the observation record remains at the exact baseline',
      await readObservation() === EMPTY_RECORD);
  } catch (error) {
    check('5d-L15: the observation record remains at the exact baseline', false,
      error instanceof Error ? error.message : String(error));
  }
  await writer.close();
}

note(`Phase 1 session 5d: ${failureCount() === 0 ? 'PASS' : 'FAILED'}`);
process.exit(failureCount() === 0 ? 0 : 1);
