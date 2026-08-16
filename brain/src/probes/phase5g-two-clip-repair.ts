/** Phase 1 session 5g repairs: prove two-clip isolation and bounded cursor confirmation. */
import { LiveAdapter } from '../adapters/live/adapter.js';
import { BridgeTransport, type Transport } from '../adapters/live/transport.js';
import { WIRE, type Frame } from '../adapters/live/wiremap.js';
import {
  addressKey, clip, notes as notesAt, scene, slot, track,
  type NoteRecord, type RevisionMark,
} from '../contract/index.js';
import { Executor } from '../engine/executor.js';
import { emptyObservationRecord, encodeObservationRecord } from '../observation/index.js';
import { check, client, failureCount, note, pollUntil } from './lib.js';
import { canonicalNotes } from './phase5d-owned-cleanup.js';

const PROJECT = 'gn-scale-test';
const ROWS = 10;
const TARGET_ROW = 9;
const STATUS = 'Change · 4a-live-check';
const BASELINE_SELECTION: Selection = { trackIndex: 0, slotIndex: 1 };
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
const TRACK_A = 'd367ac16-b7bd-4662-971f-fe924ec033a3';
const TRACK_B = '9a88b37d-337a-4ef2-96a8-a147419d7cda';
const PARK_TRACK = TRACK_A;
const PLAIN_A: readonly NoteRecord[] = [
  { startBeats: 0, pitch: 60, velocity: 100, durationBeats: 1 },
];
const PLAIN_B: readonly NoteRecord[] = [
  { startBeats: 1, pitch: 67, velocity: 100, durationBeats: 1 },
];
const EXPRESSION_A: readonly NoteRecord[] = [{ ...PLAIN_A[0]!, pan: -0.25 }];
const EXPRESSION_B: readonly NoteRecord[] = [{ ...PLAIN_B[0]!, pan: 0.5 }];

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

interface ClipState {
  readonly occupied: boolean;
  readonly notes: readonly NoteRecord[];
}

class TraceTransport implements Transport {
  readonly frames: Frame[] = [];
  readonly statuses: {
    readonly elapsedMs: number;
    readonly cursor: string;
    readonly attempt: number;
    readonly check: 'target' | 'pins';
    readonly expectedTrack?: number;
    readonly expectedRow?: number;
    readonly reply: unknown;
  }[] = [];
  private readonly attempts = new Map<string, number>();
  private readonly expected = new Map<string, { track?: number; row?: number }>();
  private readonly checks = new Map<string, 'target' | 'pins' | 'held'>();
  private readonly checkStarted = new Map<string, number>();

  async send(frame: Frame): Promise<unknown> {
    this.frames.push(frame);
    const cursor = frame.params?.['cursor'];
    if (typeof cursor === 'string') {
      if (frame.method === WIRE.cursorPin && frame.params?.['pinned'] === false) {
        this.attempts.set(cursor, (this.attempts.get(cursor) ?? 0) + 1);
        this.checks.set(cursor, 'target');
      } else if (frame.method === WIRE.cursorPointTrack) {
        this.expected.set(cursor, { track: frame.params?.['trackIndex'] as number });
        this.checkStarted.set(cursor, Date.now());
      } else if (frame.method === WIRE.cursorPin && frame.params?.['pinned'] === true) {
        this.checks.set(cursor, 'pins');
        this.checkStarted.set(cursor, Date.now());
      }
    }
    if (frame.method === WIRE.slotSelect && frame.params?.['mechanism'] === 'track') {
      const pending = [...this.expected.entries()].find(([, target]) => target.row === undefined);
      if (pending !== undefined) {
        const [ref, target] = pending;
        this.expected.set(ref, { ...target, row: frame.params?.['slotIndex'] as number });
      }
    }
    const reply = await client.request(frame.method, frame.params);
    const check = typeof cursor === 'string' ? this.checks.get(cursor) : undefined;
    if (frame.method === WIRE.cursorStatus && typeof cursor === 'string' && check !== 'held') {
      const target = this.expected.get(cursor);
      this.statuses.push({
        elapsedMs: Date.now() - (this.checkStarted.get(cursor) ?? Date.now()),
        cursor,
        attempt: this.attempts.get(cursor) ?? 0,
        check: check ?? 'target',
        ...(target?.track === undefined ? {} : { expectedTrack: target.track }),
        ...(target?.row === undefined ? {} : { expectedRow: target.row }),
        reply,
      });
      const state = reply as {
        trackPosition?: number;
        sceneIndex?: number;
        isPinned?: boolean;
        cursorTrackPinned?: boolean;
      };
      if (check === 'pins' && state.trackPosition === target?.track
          && state.sceneIndex === target?.row && state.isPinned === true
          && state.cursorTrackPinned === true) {
        this.checks.set(cursor, 'held');
      }
    }
    return reply;
  }

  async close(): Promise<void> {}
}

const selection = async (): Promise<Selection> =>
  (await client.request(WIRE.selectionStatus)) as Selection;

const readObservation = async (): Promise<string | undefined> => {
  const reply = (await client.request('observation.read')) as {
    readonly available?: boolean;
    readonly value?: string;
  };
  return reply.available === true ? reply.value : undefined;
};

const listTracks = async (): Promise<readonly TrackRow[]> =>
  ((await client.request(WIRE.trackList)) as { tracks: TrackRow[] }).tracks;

function trackRow(list: readonly TrackRow[], id: string): TrackRow {
  const found = list.find((item) => item.channelId === id);
  if (found === undefined) throw new Error(`track ${id} is outside the visible bank`);
  return found;
}

async function occupied(trackIndex: number, row: number): Promise<boolean> {
  const reply = (await client.request(WIRE.slotStatus, {
    trackIndex,
    slotIndex: row,
  })) as { hasContent: boolean };
  return reply.hasContent;
}

async function occupancy(list: readonly TrackRow[]): Promise<Map<string, boolean>> {
  const result = new Map<string, boolean>();
  for (const item of list) {
    for (let row = 0; row < ROWS; row += 1) {
      result.set(`${item.channelId}:${row}`, await occupied(item.index, row));
    }
  }
  return result;
}

async function readPair(
  adapter: LiveAdapter,
  at: RevisionMark,
): Promise<readonly [readonly NoteRecord[], readonly NoteRecord[]]> {
  const a = notesAt(clip(slot(track(TRACK_A), scene(TARGET_ROW, at.sceneEpoch))));
  const b = notesAt(clip(slot(track(TRACK_B), scene(TARGET_ROW, at.sceneEpoch))));
  const snapshot = await adapter.read([a, b]);
  const valueA = snapshot.entries[addressKey(a)]?.value;
  const valueB = snapshot.entries[addressKey(b)]?.value;
  if (valueA?.of !== 'notes' || valueB?.of !== 'notes') {
    throw new Error('one of the focused clips is unreadable');
  }
  return [valueA.notes, valueB.notes];
}

async function cursorState(cursor: string): Promise<unknown> {
  return client.request(WIRE.cursorStatus, { cursor });
}

function traceStages(trace: TraceTransport, start: number, label: string): void {
  const stages = trace.frames.slice(start)
    .filter((frame) => frame.method === WIRE.batchRun)
    .map((frame) => {
      const ops = Array.isArray(frame.params?.['ops'])
        ? frame.params['ops'] as { method?: string; params?: Record<string, unknown> }[]
        : [];
      return ops.map((op) => ({
        method: op.method,
        cursor: op.params?.['cursor'],
        trackIndex: op.params?.['trackIndex'],
        slotIndex: op.params?.['slotIndex'],
        x: op.params?.['x'],
        pan: op.params?.['pan'],
      }));
    });
  note(`${label} stages: ${JSON.stringify(stages)}`);
}

function traceAttempts(trace: TraceTransport, start: number, label: string): void {
  const attempts = trace.statuses.slice(start).map((status) => ({
    cursor: status.cursor,
    attempt: status.attempt,
    check: status.check,
    elapsedMs: status.elapsedMs,
    target: [status.expectedTrack, status.expectedRow],
    status: status.reply,
  }));
  note(`${label} cursor confirmation: ${JSON.stringify(attempts)}`);
}

async function restoreSelection(target: Selection): Promise<void> {
  await client.request(WIRE.slotSelect, {
    trackIndex: target.trackIndex,
    slotIndex: target.slotIndex,
    mechanism: 'track',
  });
  const restored = await pollUntil(async () => {
    const current = await selection();
    return current.trackIndex === target.trackIndex && current.slotIndex === target.slotIndex;
  });
  if (!restored.ok) throw new Error('the entry selection did not restore');
}

async function parkCursors(trackIndex: number): Promise<void> {
  for (const cursor of ['0', '1', '2']) {
    await client.request(WIRE.cursorPin, { cursor, pinned: false });
    await client.request(WIRE.cursorPinTrack, { cursor, pinned: false });
    await client.request(WIRE.cursorPointTrack, { cursor, trackIndex });
    await client.request(WIRE.slotSelect, {
      trackIndex,
      slotIndex: 0,
      mechanism: 'track',
    });
  }
}

await client.connect();
const entrySelection = await selection();
const trace = new TraceTransport();
const writer = new LiveAdapter({ transport: trace, cursorRefs: ['0', '1'] });
const witness = new LiveAdapter({
  transport: new BridgeTransport(client),
  cursorRefs: ['2'],
});
let baselineTracks: readonly TrackRow[] = [];
let baselineOccupancy: ReadonlyMap<string, boolean> | undefined;
let createdA = false;
let createdB = false;

try {
  await writer.hello();
  await witness.hello();
  baselineTracks = await listTracks();
  const identitiesMatch = baselineTracks.length === Object.keys(TRACKS).length
    && baselineTracks.every((item) => TRACKS[item.channelId] === item.name);
  check('5gr-L0: all destructive fixture identities match the documented baseline',
    identitiesMatch, baselineTracks);
  if (!identitiesMatch) throw new Error('fixture identity mismatch');

  const rig = (await client.request(WIRE.rigInfo)) as { sceneCount?: number };
  const mark = await writer.revision();
  const transport = (await client.request('transport.status')) as { isPlaying?: boolean };
  const baselineMatches = mark.project === PROJECT && rig.sceneCount === ROWS
    && await readObservation() === EMPTY_RECORD && transport.isPlaying === false
    && entrySelection.trackIndex === BASELINE_SELECTION.trackIndex
    && entrySelection.slotIndex === BASELINE_SELECTION.slotIndex;
  check('5gr-L1: project, rows, selection, observation, and transport match the baseline',
    baselineMatches, { project: mark.project, rig, entrySelection, transport });
  if (!baselineMatches) throw new Error('live project baseline mismatch');

  baselineOccupancy = await occupancy(baselineTracks);
  const rowA = trackRow(baselineTracks, TRACK_A);
  const rowB = trackRow(baselineTracks, TRACK_B);
  const cellsEmpty = !(await occupied(rowA.index, TARGET_ROW))
    && !(await occupied(rowB.index, TARGET_ROW));
  check('5gr-L2: both focused cells are empty before creation', cellsEmpty, {
    trackA: rowA.name,
    trackB: rowB.name,
    row: TARGET_ROW,
  });
  if (!cellsEmpty) throw new Error('a focused cell is occupied');

  const clipA = clip(slot(track(TRACK_A), scene(TARGET_ROW, mark.sceneEpoch)));
  const clipB = clip(slot(track(TRACK_B), scene(TARGET_ROW, mark.sceneEpoch)));
  await writer.apply({ ops: [{ op: 'clip.create', slot: clipA.slot, lengthBeats: 4 }] });
  createdA = true;
  await writer.apply({ ops: [{ op: 'clip.create', slot: clipB.slot, lengthBeats: 4 }] });
  createdB = true;

  await readPair(writer, await writer.revision());
  note(`after earlier read: ${JSON.stringify(await Promise.all(['0', '1'].map(cursorState)))}`);

  let traceAt = trace.frames.length;
  await writer.apply({ ops: [
    { op: 'note.clear', clip: clipA },
    { op: 'note.clear', clip: clipB },
  ] });
  traceStages(trace, traceAt, 'clear');

  traceAt = trace.frames.length;
  await writer.apply({ ops: [
    { op: 'note.write', clip: clipA, notes: PLAIN_A },
    { op: 'note.write', clip: clipB, notes: PLAIN_B },
  ] });
  await writer.settle('noteWrite');
  traceStages(trace, traceAt, 'plain write');
  const plain = await readPair(writer, await writer.revision());
  check('5gr-L3: the warm writer reads each plain note from its own clip',
    plain[0][0]?.pitch === 60 && plain[1][0]?.pitch === 67, plain);

  await writer.apply({ ops: [
    { op: 'note.clear', clip: clipA },
    { op: 'note.clear', clip: clipB },
  ] });
  await writer.settle('noteWrite');

  traceAt = trace.frames.length;
  await writer.apply({ ops: [
    { op: 'note.write', clip: clipA, notes: EXPRESSION_A },
    { op: 'note.write', clip: clipB, notes: EXPRESSION_B },
  ] });
  await writer.settle('noteWrite');
  traceStages(trace, traceAt, 'expression write');
  note(`after expression write: ${JSON.stringify(await Promise.all(['0', '1'].map(cursorState)))}`);

  const writerRead = await readPair(writer, await writer.revision());
  const independentRead = await readPair(witness, await witness.revision());
  check('5gr-L4: the writing pool reports the two requested pan values',
    writerRead[0][0]?.pan === -0.25 && writerRead[1][0]?.pan === 0.5, writerRead);
  check('5gr-L5: an independent cursor finds each pan persisted on its own clip',
    independentRead[0][0]?.pan === -0.25 && independentRead[1][0]?.pan === 0.5,
    independentRead);

  const executor = new Executor(writer);
  const statusAt = trace.statuses.length;
  const take = await executor.run([
    { op: 'note.clear', clip: clipA },
    { op: 'note.clear', clip: clipB },
  ]);
  check('5gr-L6: the executor stashes both expression clips before clear',
    take.values.length === 2, take.values);
  await executor.revertUnchecked(take);
  traceAttempts(trace, statusAt, 'executor clear and revert');

  const reverted = await readPair(witness, await witness.revision());
  check('5gr-L7: independent readback finds both pan values after revert',
    reverted[0][0]?.pan === -0.25 && reverted[1][0]?.pan === 0.5, reverted);

  await parkCursors(trackRow(baselineTracks, PARK_TRACK).index);
  const repointedRead = await readPair(writer, await writer.revision());
  check('5gr-L8: the writer agrees after both physical handles move away and back',
    repointedRead[0][0]?.pan === -0.25 && repointedRead[1][0]?.pan === 0.5,
    repointedRead);
} catch (error) {
  check('5gr-LX: the focused diagnosis completed without an unexpected failure', false,
    error instanceof Error ? `${error.name}: ${error.message}` : String(error));
} finally {
  try {
    const current = await writer.revision();
    const rowA = baselineTracks.find((item) => item.channelId === TRACK_A);
    const rowB = baselineTracks.find((item) => item.channelId === TRACK_B);
    if (createdA && rowA !== undefined && await occupied(rowA.index, TARGET_ROW)) {
      await writer.apply({ ops: [{
        op: 'clip.delete',
        slot: slot(track(TRACK_A), scene(TARGET_ROW, current.sceneEpoch)),
      }] });
    }
    if (createdB && rowB !== undefined && await occupied(rowB.index, TARGET_ROW)) {
      const at = await writer.revision();
      await writer.apply({ ops: [{
        op: 'clip.delete',
        slot: slot(track(TRACK_B), scene(TARGET_ROW, at.sceneEpoch)),
      }] });
    }
    await restoreSelection(BASELINE_SELECTION);
    if (baselineTracks.length > 0) {
      await parkCursors(trackRow(baselineTracks, PARK_TRACK).index);
      await restoreSelection(BASELINE_SELECTION);
    }
    const statusAt = await writer.revision();
    const status = (await client.request('status.push', {
      value: STATUS,
      expectedGeneration: statusAt.generation,
      expectedProject: statusAt.project,
    })) as { accepted?: boolean };

    const finalTracks = await listTracks();
    const finalOccupancy = await occupancy(finalTracks);
    const finalSelection = await selection();
    const finalRig = (await client.request(WIRE.rigInfo)) as { sceneCount?: number };
    const finalTransport = (await client.request('transport.status')) as { isPlaying?: boolean };
    const cursorStates = await Promise.all(['0', '1', '2'].map(cursorState)) as {
      trackPosition?: number;
      sceneIndex?: number;
      isPinned?: boolean;
      cursorTrackPinned?: boolean;
    }[];
    const parkIndex = trackRow(baselineTracks, PARK_TRACK).index;
    const baselineRestored = baselineOccupancy !== undefined
      && JSON.stringify([...finalOccupancy]) === JSON.stringify([...baselineOccupancy])
      && finalTracks.length === baselineTracks.length
      && finalTracks.every((item) => TRACKS[item.channelId] === item.name)
      && finalRig.sceneCount === ROWS
      && await readObservation() === EMPTY_RECORD
      && finalTransport.isPlaying === false
      && finalSelection.trackIndex === BASELINE_SELECTION.trackIndex
      && finalSelection.slotIndex === BASELINE_SELECTION.slotIndex
      && status.accepted === true
      && cursorStates.every((cursor) => cursor.trackPosition === parkIndex
        && cursor.sceneIndex === 0 && cursor.isPinned === false
        && cursor.cursorTrackPinned === false);
    check('5gr-L9: cleanup restores tracks, cells, rows, selection, observation, and transport',
      baselineRestored, { finalSelection, finalRig, finalTransport, status, cursorStates });
  } catch (error) {
    check('5gr-L9: cleanup restores the complete documented baseline', false,
      error instanceof Error ? `${error.name}: ${error.message}` : String(error));
  }
  await writer.close();
  await witness.close();
  client.disconnect();
}

note(`Phase 1 session 5g two-clip repair: ${failureCount() === 0 ? 'PASS' : 'FAILED'}`);
process.exit(failureCount() === 0 ? 0 : 1);
