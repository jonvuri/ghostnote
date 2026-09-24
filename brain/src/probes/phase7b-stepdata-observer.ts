/** E130 follow-up: measure initial and changed occupancy from addStepDataObserver. */
import {
  check, client, cursorStatus, failureCount, note, point, pollUntil,
} from './lib.js';

const TRACK_NAME = 'gn-e130-stepdata';
const EMPTY_ROW = 0;
const FIXTURE_ROW = 1;
const IDENTICAL_ROW = 2;
const CLIP_LENGTH_BEATS = 16;
const WRITER = '0';
const OBSERVER = 'observer';
const BINARY_GRID = 1 / 512;
const TRIPLET_GRID = 1 / 768;
const WRITER_STEPS = 512;
const OBSERVER_STEPS = 2048;
const SETTLE_MS = 180;

interface TrackRow {
  readonly index: number;
  readonly name: string;
  readonly position: number;
  readonly type: string;
  readonly channelId: string;
}

interface Selection {
  readonly trackIndex: number;
  readonly slotIndex: number;
}

interface StateCounts {
  readonly empty: number;
  readonly sustain: number;
  readonly noteOn: number;
  readonly other: number;
}

interface OccupancyCell {
  readonly x: number;
  readonly y: number;
  readonly state: number;
}

interface StepDataRead {
  readonly generation: number;
  readonly steps: number;
  readonly keys: number;
  readonly grid: number;
  readonly page: number;
  readonly callbacks: number;
  readonly uniqueCells: number;
  readonly repeatedCallbacks: number;
  readonly invalidCells: number;
  readonly callbackStates: StateCounts;
  readonly currentStates: StateCounts;
  readonly sincePrepareMicros: number;
  readonly firstCallbackMicros?: number;
  readonly lastCallbackMicros?: number;
  readonly callbackSpanMicros?: number;
  readonly nonEmpty: readonly OccupancyCell[];
}

interface ObserverMeasurement {
  readonly label: string;
  readonly actionMs: number;
  readonly stableMs: number;
  readonly read: StepDataRead;
}

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const tracks = async (): Promise<readonly TrackRow[]> =>
  ((await client.request('track.list')) as { readonly tracks: readonly TrackRow[] }).tracks;
const selection = async (): Promise<Selection> =>
  await client.request('selection.status') as Selection;
const stable = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const bag = value as Record<string, unknown>;
    return `{${Object.keys(bag).sort().map((key) => `${JSON.stringify(key)}:${stable(bag[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
};

async function stepDataRead(): Promise<StepDataRead> {
  return await client.request('stepdata.observer.read') as StepDataRead;
}

async function measure(
  label: string,
  action: () => Promise<void>,
  requireCallback = true,
): Promise<ObserverMeasurement> {
  await client.request('stepdata.observer.prepare');
  const actionStarted = performance.now();
  await action();
  const actionMs = performance.now() - actionStarted;
  const stableStarted = performance.now();
  let priorCallbacks = -1;
  let unchanged = 0;
  let read = await stepDataRead();
  for (;;) {
    if (read.callbacks === priorCallbacks) unchanged += 1;
    else unchanged = 0;
    priorCallbacks = read.callbacks;
    const elapsed = performance.now() - stableStarted;
    if (unchanged >= 5 && (!requireCallback || read.callbacks > 0)) break;
    if (elapsed >= 8000) break;
    await wait(50);
    read = await stepDataRead();
  }
  const result = { label, actionMs, stableMs: performance.now() - stableStarted, read };
  note(`${label}: ${read.callbacks} callbacks, ${read.uniqueCells} unique cells, `
    + `${read.nonEmpty.length} non-empty, action ${actionMs.toFixed(1)} ms, `
    + `stable ${result.stableMs.toFixed(1)} ms`);
  return result;
}

async function pointAndPin(cursor: string, trackIndex: number, slotIndex: number): Promise<void> {
  await client.request('cursor.pin', { cursor, pinned: false });
  await client.request('cursor.pinTrack', { cursor, pinned: false });
  const pointed = await point(cursor, trackIndex, slotIndex, 'trackThenSlot');
  if (!pointed.ok) throw new Error(`${cursor} did not point to ${trackIndex}:${slotIndex}`);
  await client.request('cursor.pinTrack', { cursor, pinned: true });
  await client.request('cursor.pin', { cursor, pinned: true });
  const pinned = await pollUntil(async () => {
    const status = await cursorStatus(cursor);
    return status.trackPosition === trackIndex && status.sceneIndex === slotIndex
      && status.cursorTrackPinned === true && status.isPinned === true;
  }, 4000, 50);
  if (!pinned.ok) throw new Error(`${cursor} did not pin to ${trackIndex}:${slotIndex}`);
}

async function setView(cursor: string, grid: number, page = 0): Promise<void> {
  await client.request('cursor.setStepSize', { cursor, stepSize: grid });
  await client.request('cursor.scrollToStep', { cursor, step: page });
  await wait(SETTLE_MS);
}

async function createOwnedTrack(entryTracks: readonly TrackRow[]): Promise<TrackRow> {
  if (entryTracks.some((track) => track.name === TRACK_NAME)) {
    throw new Error(`${TRACK_NAME} already exists; cleanup refused`);
  }
  await client.request('track.create', { position: entryTracks.length });
  const appeared = await pollUntil(async () => (await tracks()).length === entryTracks.length + 1);
  if (!appeared.ok) throw new Error('the owned track did not appear');
  const added = (await tracks()).filter((track) =>
    !entryTracks.some((entry) => entry.channelId === track.channelId));
  if (added.length !== 1 || added[0]?.type !== 'Instrument') {
    throw new Error(`the owned track is ambiguous: ${JSON.stringify(added)}`);
  }
  await client.request('track.setName', { trackIndex: added[0].index, name: TRACK_NAME });
  const renamed = await pollUntil(async () =>
    (await tracks()).some((track) => track.channelId === added[0]!.channelId
      && track.name === TRACK_NAME));
  if (!renamed.ok) throw new Error('the owned track name did not settle');
  return (await tracks()).find((track) => track.channelId === added[0]!.channelId)!;
}

async function createClip(trackIndex: number, row: number): Promise<void> {
  await client.request('clip.create', {
    trackIndex, slotIndex: row, lengthBeats: CLIP_LENGTH_BEATS,
  });
  const exists = await pollUntil(async () =>
    ((await client.request('slot.status', {
      trackIndex, slotIndex: row,
    })) as { readonly hasContent: boolean }).hasContent);
  if (!exists.ok) throw new Error(`owned clip ${trackIndex}:${row} did not appear`);
}

async function deleteOwnedTrack(trackId: string): Promise<void> {
  const current = (await tracks()).find((track) => track.channelId === trackId);
  if (current === undefined) return;
  if (current.name !== TRACK_NAME) throw new Error('the owned track was renamed; cleanup refused');
  await client.request('track.delete', { trackIndex: current.index });
  const gone = await pollUntil(async () =>
    !(await tracks()).some((track) => track.channelId === trackId));
  if (!gone.ok) throw new Error('the owned track did not delete');
}

async function writeFixture(): Promise<void> {
  await setView(WRITER, BINARY_GRID);
  for (let channel = 0; channel < 16; channel += 1) {
    await client.request('cursor.setNotes', {
      cursor: WRITER,
      channel,
      notes: [
        [4 + channel, 36 + channel, 80 + channel, BINARY_GRID],
        [64, 72, 100, BINARY_GRID * 2],
      ],
    });
  }
  const dense = Array.from({ length: 48 }, (_, index) => [
    128 + index * 2, 80 + index % 12, 70 + index % 40, BINARY_GRID,
  ]);
  await client.request('cursor.setNotes', { cursor: WRITER, channel: 0, notes: dense });
  await wait(SETTLE_MS);

  await setView(WRITER, TRIPLET_GRID);
  await client.request('cursor.setNotes', {
    cursor: WRITER,
    channel: 0,
    notes: [[1, 110, 91, TRIPLET_GRID]],
  });
  await client.request('cursor.setNotes', {
    cursor: WRITER,
    channel: 1,
    notes: [[256, 111, 92, TRIPLET_GRID * 2]],
  });
  await client.request('cursor.scrollToStep', { cursor: WRITER, step: WRITER_STEPS });
  await wait(SETTLE_MS);
  await client.request('cursor.setNotes', {
    cursor: WRITER,
    channel: 2,
    notes: [[767 - WRITER_STEPS, 112, 93, TRIPLET_GRID]],
  });
  const lateX = 15 * 768 - 1;
  const latePage = Math.floor(lateX / WRITER_STEPS) * WRITER_STEPS;
  await client.request('cursor.scrollToStep', { cursor: WRITER, step: latePage });
  await wait(SETTLE_MS);
  await client.request('cursor.setNotes', {
    cursor: WRITER,
    channel: 3,
    notes: [[lateX - latePage, 113, 94, TRIPLET_GRID]],
  });
  await client.request('cursor.scrollToStep', { cursor: WRITER, step: 0 });
  await wait(SETTLE_MS);
}

function hasPitch(read: StepDataRead, pitch: number): boolean {
  return read.nonEmpty.some((cell) => cell.y === pitch && cell.state === 2);
}

async function collisionChannels(): Promise<number[]> {
  await setView(WRITER, BINARY_GRID);
  const found: number[] = [];
  for (let channel = 0; channel < 16; channel += 1) {
    const result = await client.request('cursor.setAndReadNote', {
      cursor: WRITER,
      channel,
      measurements: [{ x: 64, y: 72, duration: BINARY_GRID * 2 }],
    }) as { readonly measurements: readonly { readonly state: string }[] };
    if (result.measurements[0]?.state === 'NoteOn') found.push(channel);
  }
  return found;
}

async function restoreSelection(entry: Selection): Promise<void> {
  await client.request('slot.select', {
    trackIndex: entry.trackIndex, slotIndex: entry.slotIndex, mechanism: 'slot',
  });
  const restored = await pollUntil(async () => {
    const current = await selection();
    return current.trackIndex === entry.trackIndex && current.slotIndex === entry.slotIndex;
  });
  if (!restored.ok) throw new Error('the entry selection did not restore');
}

await client.connect();
const hello = await client.request('contract.hello') as {
  readonly hostApiVersion: number;
  readonly methodCount: number;
  readonly methodsHash: string;
};
const entryTracks = await tracks();
const entrySelection = await selection();
const entryTransport = await client.request('transport.status') as { readonly isPlaying?: boolean };
const entryCursors = new Map<string, Awaited<ReturnType<typeof cursorStatus>>>();
for (const cursor of [WRITER, OBSERVER]) entryCursors.set(cursor, await cursorStatus(cursor));
let owned: TrackRow | undefined;
const measurements: ObserverMeasurement[] = [];

try {
  check('E130-S0: the current API 25 probe build is live',
    hello.hostApiVersion === 25 && hello.methodCount === 156,
    hello);
  check('E130-S1: entry is stopped and the owned name is unused',
    entryTransport.isPlaying === false && !entryTracks.some((track) => track.name === TRACK_NAME),
    { tracks: entryTracks.length, isPlaying: entryTransport.isPlaying });
  if (entryTransport.isPlaying !== false) throw new Error('stop transport before this probe');

  owned = await createOwnedTrack(entryTracks);
  await createClip(owned.index, EMPTY_ROW);
  await createClip(owned.index, FIXTURE_ROW);
  await pointAndPin(WRITER, owned.index, FIXTURE_ROW);
  await writeFixture();
  await client.request('slot.duplicateClip', {
    trackIndex: owned.index, slotIndex: FIXTURE_ROW, route: 'slot',
  });
  const duplicateExists = await pollUntil(async () =>
    ((await client.request('slot.status', {
      trackIndex: owned!.index, slotIndex: IDENTICAL_ROW,
    })) as { readonly hasContent: boolean }).hasContent);
  if (!duplicateExists.ok) throw new Error('the identical owned clip did not appear');

  await pointAndPin(OBSERVER, owned.index, EMPTY_ROW);
  await setView(OBSERVER, BINARY_GRID);
  const populated = await measure('existing populated target at 1/512', async () => {
    await pointAndPin(OBSERVER, owned!.index, FIXTURE_ROW);
  });
  measurements.push(populated);
  check('E130-S2: target change replays an initial occupancy view',
    populated.read.callbacks > 0 && populated.read.uniqueCells > 0,
    populated.read);
  check('E130-S3: the initial 1/512 view contains the binary fixture',
    Array.from({ length: 16 }, (_, channel) => hasPitch(populated.read, 36 + channel)).every(Boolean)
      && hasPitch(populated.read, 72),
    { nonEmpty: populated.read.nonEmpty.length });
  check('E130-S4: the 1/512 occupancy view discovers page-zero triplet pitches',
    [110, 111, 112].every((pitch) => hasPitch(populated.read, pitch)),
    populated.read.nonEmpty.filter((cell) => cell.y >= 110 && cell.y <= 112));

  const channels = await collisionChannels();
  const collisionCells = populated.read.nonEmpty.filter((cell) => cell.x === 64 && cell.y === 72);
  check('E130-S5: occupancy collapses 16 MIDI channels into one cell',
    channels.length === 16 && collisionCells.length === 1,
    { channels, collisionCells });

  const empty = await measure('existing empty target at 1/512', async () => {
    await pointAndPin(OBSERVER, owned!.index, EMPTY_ROW);
  }, false);
  measurements.push(empty);
  check('E130-S6: empty-target behavior is measured without claiming completion',
    empty.read.nonEmpty.length === 0,
    { callbacks: empty.read.callbacks, uniqueCells: empty.read.uniqueCells });

  const warm = await measure('repeated populated target at 1/512', async () => {
    await pointAndPin(OBSERVER, owned!.index, FIXTURE_ROW);
  });
  measurements.push(warm);
  check('E130-S7: repeated target acquisition reproduces occupancy',
    stable(warm.read.nonEmpty) === stable(populated.read.nonEmpty),
    { first: populated.read.nonEmpty.length, repeated: warm.read.nonEmpty.length });

  const identical = await measure('target change to an identical clip', async () => {
    await pointAndPin(OBSERVER, owned!.index, IDENTICAL_ROW);
  }, false);
  measurements.push(identical);
  check('E130-S7a: an identical target change clears and replays complete occupancy',
    stable(identical.read.nonEmpty) === stable(populated.read.nonEmpty)
      && identical.read.callbackStates.empty > 0
      && identical.read.callbackStates.noteOn > 0,
    {
      callbacks: identical.read.callbacks,
      emptyCallbacks: identical.read.callbackStates.empty,
      replayedCells: identical.read.nonEmpty.length,
    });
  await pointAndPin(OBSERVER, owned.index, FIXTURE_ROW);
  await wait(SETTLE_MS);

  const triplet = await measure('grid change to 1/768', async () => {
    await client.request('cursor.setStepSize', { cursor: OBSERVER, stepSize: TRIPLET_GRID });
  });
  measurements.push(triplet);
  check('E130-S8: a 1/768 grid change replays exact triplet occupancy',
    [110, 111, 112].every((pitch) => hasPitch(triplet.read, pitch)),
    triplet.read.nonEmpty.filter((cell) => cell.y >= 110 && cell.y <= 112));

  await setView(OBSERVER, BINARY_GRID);
  const late = await measure('page change to late 1/512 window', async () => {
    await client.request('cursor.scrollToStep', { cursor: OBSERVER, step: 3 * OBSERVER_STEPS });
  });
  measurements.push(late);
  check('E130-S9: a page change replays late clip occupancy',
    hasPitch(late.read, 113),
    late.read.nonEmpty.filter((cell) => cell.y === 113));

  await setView(OBSERVER, BINARY_GRID);
  await setView(WRITER, BINARY_GRID);
  const added = await measure('one note addition', async () => {
    await client.request('cursor.setNotes', {
      cursor: WRITER, channel: 5, notes: [[300, 120, 99, BINARY_GRID]],
    });
  });
  measurements.push(added);
  check('E130-S10: one edit produces a bounded changed-cell callback',
    hasPitch(added.read, 120),
    added.read);

  const cleared = await measure('one note clear', async () => {
    await client.request('cursor.clearNote', {
      cursor: WRITER, channel: 5, x: 300, y: 120,
    });
  });
  measurements.push(cleared);
  check('E130-S11: clearing the note reports the empty cell',
    cleared.read.currentStates.empty > 0 && !hasPitch(cleared.read, 120),
    cleared.read);

  const replayHasNoDeclaredFence = populated.read.callbacks > 0
    && populated.read.lastCallbackMicros !== undefined;
  check('E130-S12: replay timing is observable but has no completion field',
    replayHasNoDeclaredFence,
    { first: populated.read.firstCallbackMicros, last: populated.read.lastCallbackMicros });

  console.log(`STEPDATA_MEASUREMENTS ${JSON.stringify(measurements)}`);
} catch (error) {
  check('E130-SX: the step-data observer probe completed without an unexpected failure', false,
    error instanceof Error ? `${error.name}: ${error.message}` : String(error));
} finally {
  if (owned !== undefined) {
    try {
      await deleteOwnedTrack(owned.channelId);
      check('E130-S13: the owned track and three clips are removed', true);
    } catch (error) {
      check('E130-S13: the owned track and three clips are removed', false,
        error instanceof Error ? error.message : String(error));
    }
  }
  try {
    for (const [cursor, status] of entryCursors) {
      await client.request('cursor.pin', { cursor, pinned: false });
      await client.request('cursor.pinTrack', { cursor, pinned: false });
      if (status.trackExists && status.slotExists) {
        const restored = await point(cursor, status.trackPosition, status.sceneIndex, 'trackThenSlot');
        if (!restored.ok) throw new Error(`${cursor} did not return to its entry target`);
      }
      if (status.cursorTrackPinned === true) {
        await client.request('cursor.pinTrack', { cursor, pinned: true });
      }
      if (status.isPinned === true) await client.request('cursor.pin', { cursor, pinned: true });
    }
    await restoreSelection(entrySelection);
    const finalTracks = await tracks();
    const finalTransport = await client.request('transport.status') as { readonly isPlaying?: boolean };
    check('E130-S14: exact tracks, selection, and transport baseline are restored',
      stable(finalTracks) === stable(entryTracks)
        && finalTransport.isPlaying === entryTransport.isPlaying,
      { tracks: finalTracks.length, selection: await selection(), isPlaying: finalTransport.isPlaying });
  } catch (error) {
    check('E130-S14: exact tracks, selection, and transport baseline are restored', false,
      error instanceof Error ? error.message : String(error));
  }
}

client.disconnect();
console.log(`\n${failureCount() === 0 ? 'ALL PASS' : `${failureCount()} FAILURE(S)`}`);
process.exit(failureCount() === 0 ? 0 : 1);
