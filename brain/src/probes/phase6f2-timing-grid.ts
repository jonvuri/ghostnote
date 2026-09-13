/** Measure fine binary and triplet note grids in one owned Bitwig clip. */
import { createHash } from 'node:crypto';

import {
  check, client, cursorStatus, failureCount, point, pollUntil,
} from './lib.js';

const TRACK_NAME = 'gn-6f2-timing-grid';
const CLIP_ROW = 0;
const CLIP_LENGTH_BEATS = 16;
const WRITER = '0';
const WITNESS = 'fine';
const PAGE_STEPS = 512;
const READ_STEPS = 2048;
const SETTLE_MS = 180;
const TEMPO_BPM = 120;

const binaryGrids = [1 / 64, 1 / 128, 1 / 256, 1 / 512] as const;
const tripletGrids = [1 / 96, 1 / 192, 1 / 384, 1 / 768] as const;
const grids = [
  ...binaryGrids.map((beats) => ({ family: 'binary' as const, beats })),
  ...tripletGrids.map((beats) => ({ family: 'triplet' as const, beats })),
];

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

interface VerboseNote {
  readonly x: number;
  readonly y: number;
  readonly channel: number;
  readonly velocity: number;
  readonly releaseVelocity: number;
  readonly duration: number;
  readonly gain: number;
  readonly pan: number;
  readonly pressure: number;
  readonly timbre: number;
  readonly transpose: number;
  readonly isMuted: boolean;
  readonly [key: string]: unknown;
}

interface ChannelRead {
  readonly channel: number;
  readonly notes: readonly VerboseNote[];
  readonly count: number;
}

interface AllChannelRead {
  readonly channels: readonly ChannelRead[];
  readonly count: number;
  readonly scanMicros: number;
  readonly clipExists: boolean;
}

interface ReadCollection {
  readonly notes: readonly Record<string, unknown>[];
  readonly scanMicros: readonly number[];
}

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const stable = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const bag = value as Record<string, unknown>;
    return `{${Object.keys(bag).sort().map((key) => `${JSON.stringify(key)}:${stable(bag[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
};
const hash = (value: unknown): string =>
  createHash('sha256').update(stable(value)).digest('hex');
const tracks = async (): Promise<readonly TrackRow[]> =>
  ((await client.request('track.list')) as { readonly tracks: readonly TrackRow[] }).tracks;
const selection = async (): Promise<Selection> =>
  (await client.request('selection.status')) as Selection;

function notePayload(read: AllChannelRead): readonly Record<string, unknown>[] {
  return read.channels.flatMap((channel) => channel.notes.map((note) => ({ ...note })))
    .sort((left, right) => Number(left['channel']) - Number(right['channel'])
      || Number(left['x']) - Number(right['x'])
      || Number(left['y']) - Number(right['y']));
}

async function setView(cursor: string, grid: number, page = 0): Promise<void> {
  await client.request('cursor.setStepSize', { cursor, stepSize: grid });
  await client.request('cursor.scrollToStep', { cursor, step: page });
  await wait(SETTLE_MS);
}

async function readAll(cursor: string): Promise<AllChannelRead> {
  return await client.request('cursor.getNotesVerboseAllChannels', {
    cursor, maxX: READ_STEPS,
  }) as AllChannelRead;
}

async function readFixture(grid: number): Promise<ReadCollection> {
  const longX = Math.round(15 / grid) - 1;
  const longPage = Math.floor(longX / READ_STEPS) * READ_STEPS;
  const pages = longPage === 0 ? [0] : [0, longPage];
  const reads = [];
  for (const page of pages) {
    await client.request('cursor.scrollToStep', { cursor: WITNESS, step: page });
    await wait(SETTLE_MS);
    reads.push(await readAll(WITNESS));
  }
  const unique = new Map<string, Record<string, unknown>>();
  for (let index = 0; index < reads.length; index += 1) {
    const read = reads[index]!;
    const page = pages[index]!;
    for (const item of notePayload(read)) {
      const absolute: Record<string, unknown> = { ...item, x: Number(item['x']) + page };
      unique.set(`${absolute['channel']}:${absolute['x']}:${absolute['y']}`, absolute);
    }
  }
  return {
    notes: [...unique.values()].sort((left, right) => Number(left['channel']) - Number(right['channel'])
      || Number(left['x']) - Number(right['x']) || Number(left['y']) - Number(right['y'])),
    scanMicros: reads.map((read) => read.scanMicros),
  };
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

async function createOwnedTrack(entryTracks: readonly TrackRow[]): Promise<TrackRow> {
  if (entryTracks.some((track) => track.name === TRACK_NAME)) {
    throw new Error(`${TRACK_NAME} already exists; remove or inspect it before this probe`);
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
    (await tracks()).some((track) => track.channelId === added[0]!.channelId && track.name === TRACK_NAME));
  if (!renamed.ok) throw new Error('the owned track name did not settle');
  return (await tracks()).find((track) => track.channelId === added[0]!.channelId)!;
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

async function runGrid(family: 'binary' | 'triplet', grid: number): Promise<Record<string, unknown>> {
  await setView(WRITER, grid);
  await setView(WITNESS, grid);
  await client.request('cursor.clearNotes', { cursor: WRITER });
  await wait(60);

  const pageZero = [
    [1, 60, 101, grid],
    [5, 63, 93, grid],
    [6, 63, 95, grid],
    [8, 65, 87, grid * 3],
    [9, 65, 89, grid],
    [PAGE_STEPS - 1, 61, 99, grid * 2],
  ];
  await client.request('cursor.setNotes', { cursor: WRITER, channel: 0, notes: pageZero });
  for (let channel = 1; channel < 16; channel += 1) {
    await client.request('cursor.setNotes', {
      cursor: WRITER, channel, notes: [[16 + channel, 40 + channel, 70 + channel, grid]],
    });
  }
  await client.request('cursor.scrollToStep', { cursor: WRITER, step: PAGE_STEPS });
  await wait(SETTLE_MS);
  await client.request('cursor.setNotes', {
    cursor: WRITER, channel: 0, notes: [[0, 62, 97, grid * 2], [3, 67, 91, grid]],
  });
  await client.request('cursor.scrollToStep', { cursor: WRITER, step: 0 });
  await wait(SETTLE_MS);

  const longX = Math.round(15 / grid) - 1;
  const longWriterPage = Math.floor(longX / PAGE_STEPS) * PAGE_STEPS;
  await client.request('cursor.scrollToStep', { cursor: WRITER, step: longWriterPage });
  await wait(SETTLE_MS);
  await client.request('cursor.setNotes', {
    cursor: WRITER, channel: 15, notes: [[longX - longWriterPage, 100, 111, grid]],
  });
  await client.request('cursor.scrollToStep', { cursor: WRITER, step: 0 });
  await wait(SETTLE_MS);

  const settled = await pollUntil(async () => (await readFixture(grid)).notes.length >= 24, 8000, 180);
  if (!settled.ok) throw new Error(`${family} grid ${grid} did not settle`);
  const first = await readFixture(grid);
  const second = await readFixture(grid);
  const firstPayload = first.notes;
  const secondPayload = second.notes;
  const stableHash = hash(firstPayload);
  const expectedStarts = new Set([
    1, 5, 6, 8, 9, PAGE_STEPS - 1, PAGE_STEPS, PAGE_STEPS + 3,
    ...Array.from({ length: 15 }, (_, index) => 17 + index), longX, 10,
  ]);
  const exactFineStarts = secondPayload.length === 25
    && secondPayload.every((item) => expectedStarts.has(Number(item['x'])));
  const durationRows = secondPayload.map((item) => ({
    channel: item['channel'], pitch: item['y'], x: item['x'],
    start_beats: Number(item['x']) * grid,
    duration_beats: item['duration'],
    duration_error_beats: Number(item['duration']) - (
      Number(item['y']) === 61 || Number(item['y']) === 62 ? grid * 2
        : Number(item['y']) === 65 && Number(item['x']) === 8 ? grid * 3 : grid
    ),
  }));

  const coarse = grid * 2;
  await setView(WITNESS, coarse);
  const coarseRead = await readFixture(coarse);
  await setView(WITNESS, grid);
  const returned = await readFixture(grid);
  const returnedHash = hash(returned.notes);

  await setView(WRITER, grid);
  const propWrite = await client.request('cursor.setNoteProps', {
    cursor: WRITER, channel: 0, x: 1, y: 60,
    props: { pan: -0.25, timbre: 0.375, releaseVelocity: 0.625 },
  }) as { readonly applied?: Readonly<Record<string, string>> };
  let propertyNote: Record<string, unknown> | undefined;
  const propertySettled = await pollUntil(async () => {
    const propertyRead = await readFixture(grid);
    propertyNote = propertyRead.notes.find((item) =>
      item['channel'] === 0 && item['x'] === 1 && item['y'] === 60);
    return Math.abs(Number(propertyNote?.['pan']) + 0.25) < 1e-9
      && Math.abs(Number(propertyNote?.['timbre']) - 0.375) < 1e-9
      && Math.abs(Number(propertyNote?.['releaseVelocity']) - 0.625) < 1e-9;
  }, 4000, 180);
  const propertiesLand = propWrite.applied?.['pan'] === 'ok'
    && propWrite.applied?.['timbre'] === 'ok'
    && propWrite.applied?.['releaseVelocity'] === 'ok' && propertySettled.ok;

  const adjacent = secondPayload.filter((item) => item['channel'] === 0 && item['y'] === 63);
  const overlap = secondPayload.filter((item) => item['channel'] === 0 && item['y'] === 65);
  const allChannels = new Set(secondPayload.map((item) => item['channel'])).size === 16;
  const exactReturn = returnedHash === stableHash;
  const stableReads = stable(firstPayload) === stable(secondPayload);
  const coarseIdentityCount = coarseRead.notes.length;
  const maxDurationError = durationRows.reduce((maximum, item) =>
    item.pitch === 65 ? maximum : Math.max(maximum, Math.abs(item.duration_error_beats)), 0);

  check(`6f2 ${family} ${grid}: two independent reads are stable`, stableReads,
    { stableHash, firstScanMicros: first.scanMicros, secondScanMicros: second.scanMicros });
  check(`6f2 ${family} ${grid}: starts, pages, and all channels are visible`,
    exactFineStarts && allChannels, { count: secondPayload.length, allChannels });
  check(`6f2 ${family} ${grid}: adjacency survives and overlap expansion is detected`,
    adjacent.length === 2 && overlap.length === 3,
    { adjacent: adjacent.map((item) => item['x']), overlap: overlap.map((item) => item['x']) });
  check(`6f2 ${family} ${grid}: a coarse view and return preserve fine identity`, exactReturn,
    { fineCount: secondPayload.length, coarseIdentityCount, stableHash, returnedHash });
  check(`6f2 ${family} ${grid}: settled note properties land`, propertiesLand, propertyNote);

  return {
    family, grid_beats: grid,
    conventional_note_value: family === 'binary'
      ? `1/${4 / grid}` : `triplet step ${grid}`,
    milliseconds_at_120_bpm: grid * 60000 / TEMPO_BPM,
    note_count: secondPayload.length,
    all_channels: allChannels,
    stable_reads: stableReads,
    stable_readback_sha256: stableHash,
    returned_readback_sha256: returnedHash,
    exact_after_coarse_return: exactReturn,
    coarse_identity_count: coarseIdentityCount,
    page_boundary_steps: [PAGE_STEPS - 1, PAGE_STEPS, PAGE_STEPS + 3],
    long_clip_step: longX,
    long_clip_start_beats: longX * grid,
    same_pitch_adjacency_count: adjacent.length,
    same_pitch_overlap_requested: 2,
    same_pitch_overlap_realized: overlap.length,
    same_pitch_overlap_policy: 'refuse-before-mutation',
    properties_land: propertiesLand,
    scan_micros: [first.scanMicros, second.scanMicros, coarseRead.scanMicros, returned.scanMicros],
    max_duration_error_beats: maxDurationError,
    max_duration_error_ms_at_120_bpm: maxDurationError * 60000 / TEMPO_BPM,
    duration_samples: durationRows.filter((item) =>
      item.channel === 0 && [60, 61, 62].includes(Number(item.pitch))),
  };
}

await client.connect();
const entryTracks = await tracks();
const entrySelection = await selection();
const entryTransport = await client.request('transport.status') as { readonly isPlaying?: boolean };
const entryCursors = new Map<string, Awaited<ReturnType<typeof cursorStatus>>>();
for (const cursor of [WRITER, WITNESS]) entryCursors.set(cursor, await cursorStatus(cursor));
let owned: TrackRow | undefined;
const results: Record<string, unknown>[] = [];

try {
  const project = await client.request('revision.get') as { readonly project?: string };
  check('6f2-L0: entry project is stopped and the scratch name is unused',
    entryTransport.isPlaying === false && !entryTracks.some((track) => track.name === TRACK_NAME),
    { project: project.project, tracks: entryTracks.length, isPlaying: entryTransport.isPlaying });
  if (entryTransport.isPlaying !== false) throw new Error('stop transport before the timing probe');

  owned = await createOwnedTrack(entryTracks);
  await client.request('clip.create', {
    trackIndex: owned.index, slotIndex: CLIP_ROW, lengthBeats: CLIP_LENGTH_BEATS,
  });
  const clipExists = await pollUntil(async () =>
    ((await client.request('slot.status', {
      trackIndex: owned!.index, slotIndex: CLIP_ROW,
    })) as { readonly hasContent: boolean }).hasContent);
  check('6f2-L1: one owned 16-beat clip exists', clipExists.ok, owned);
  if (!clipExists.ok) throw new Error('the owned clip did not appear');

  for (const cursor of [WRITER, WITNESS]) {
    const pointed = await point(cursor, owned.index, CLIP_ROW, 'trackThenSlot');
    if (!pointed.ok) throw new Error(`${cursor} did not point to the owned clip`);
    await client.request('cursor.pinTrack', { cursor: Number.isFinite(Number(cursor)) ? Number(cursor) : cursor, pinned: true });
    await client.request('cursor.pin', { cursor, pinned: true });
  }

  for (const spec of grids) results.push(await runGrid(spec.family, spec.beats));
  console.log(`GRID_MEASUREMENTS ${JSON.stringify(results)}`);
} catch (error) {
  check('6f2-LX: the live grid probe completed without an unexpected failure', false,
    error instanceof Error ? `${error.name}: ${error.message}` : String(error));
} finally {
  if (owned !== undefined) {
    try {
      await client.request('cursor.clearNotes', { cursor: WRITER });
      await wait(60);
      await deleteOwnedTrack(owned.channelId);
      check('6f2-L2: the owned track and clip are removed', true);
    } catch (error) {
      check('6f2-L2: the owned track and clip are removed', false,
        error instanceof Error ? error.message : String(error));
    }
  }
  try {
    for (const [cursor, status] of entryCursors) {
      await client.request('cursor.pin', { cursor, pinned: false });
      if (cursor !== WITNESS) {
        await client.request('cursor.pinTrack', { cursor: Number(cursor), pinned: false });
      }
      if (status.trackExists && status.slotExists) {
        const restored = await point(cursor, status.trackPosition, status.sceneIndex, 'trackThenSlot');
        if (!restored.ok) throw new Error(`${cursor} did not return to its entry target`);
      }
      if (cursor !== WITNESS && status.cursorTrackPinned === true) {
        await client.request('cursor.pinTrack', { cursor: Number(cursor), pinned: true });
      }
      if (status.isPinned === true) await client.request('cursor.pin', { cursor, pinned: true });
    }
    await restoreSelection(entrySelection);
    const finalTracks = await tracks();
    const finalTransport = await client.request('transport.status') as { readonly isPlaying?: boolean };
    check('6f2-L3: exact tracks, selection, and transport baseline are restored',
      stable(finalTracks) === stable(entryTracks) && finalTransport.isPlaying === entryTransport.isPlaying,
      { tracks: finalTracks.length, selection: await selection(), isPlaying: finalTransport.isPlaying });
  } catch (error) {
    check('6f2-L3: exact tracks, selection, and transport baseline are restored', false,
      error instanceof Error ? error.message : String(error));
  }
}

process.exit(failureCount() === 0 ? 0 : 1);
