/** E131: compare sparse step-data enrichment with the complete dual-grid reader. */
import {
  check, client, cursorStatus, failureCount, note, point, pollUntil,
} from './lib.js';

const TRACK_NAME = 'gn-e131-sparse-enrichment';
const EMPTY_ROW = 0;
const WRITER = '0';
const READER = 'fine';
const OBSERVER = 'observer';
const BINARY_GRID = 1 / 512;
const TRIPLET_GRID = 1 / 768;
const READER_STEPS = 2_048;
const WRITER_STEPS = 512;
const NORMALIZED_STEPS_PER_BEAT = 512;
const MIN_SETTLEMENT_MS = 250;
const POLL_MS = 25;

interface TrackRow {
  readonly index: number;
  readonly name: string;
  readonly type: string;
  readonly channelId: string;
}

interface Selection {
  readonly trackIndex: number;
  readonly slotIndex: number;
}

interface FixtureNote {
  readonly grid: number;
  readonly x: number;
  readonly pitch: number;
  readonly channel: number;
  readonly velocity: number;
  readonly duration: number;
  readonly props?: Readonly<Record<string, unknown>>;
}

interface Fixture {
  readonly label: string;
  readonly row: number;
  readonly lengthBeats: number;
  readonly notes: readonly FixtureNote[];
}

interface StepDataRead {
  readonly generation: number;
  readonly callbacks: number;
  readonly firstCallbackMicros?: number;
  readonly lastCallbackMicros?: number;
  readonly nonEmpty: readonly { readonly x: number; readonly y: number; readonly state: number }[];
}

interface WireNote extends Record<string, number | boolean | string> {
  readonly x: number;
  readonly y: number;
  readonly channel: number;
  readonly duration: number;
}

interface PageRead {
  readonly notes: readonly WireNote[];
  readonly count: number;
  readonly coordinateCount: number;
  readonly getStepCalls: number;
  readonly scanMicros: number;
  readonly stable: boolean;
  readonly clipExists?: boolean;
}

interface ScanNote {
  readonly note: WireNote;
  readonly startBeats: number;
}

interface Timing {
  settlementMs: number;
  targetedHostMs: number;
  bridgeTransferMs: number;
  normalizationMs: number;
  totalMs: number;
  pages: number;
  coordinates: number;
  getStepCalls: number;
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
const tracks = async (): Promise<readonly TrackRow[]> =>
  (await client.request('track.list') as { readonly tracks: readonly TrackRow[] }).tracks;
const selection = async (): Promise<Selection> => await client.request('selection.status') as Selection;

function denseNotes(lengthBeats: number, count: number): FixtureNote[] {
  const totalSteps = lengthBeats * 512;
  return Array.from({ length: count }, (_, index) => ({
    grid: BINARY_GRID,
    x: Math.floor((index + 1) * (totalSteps - 2) / (count + 1)),
    pitch: 24 + index % 72,
    channel: index % 16,
    velocity: 45 + index % 80,
    duration: BINARY_GRID * (1 + index % 7),
  }));
}

const optionalProps = {
  velocity: 0.61,
  releaseVelocity: 0.37,
  velocitySpread: 0.22,
  duration: BINARY_GRID * 9,
  gain: 0.35,
  pan: -0.4,
  pressure: 0.5,
  timbre: 0.55,
  transpose: 2.5,
  chance: 0.63,
  isChanceEnabled: true,
  isMuted: false,
  isOccurrenceEnabled: true,
  occurrence: 'FILL',
  isRecurrenceEnabled: true,
  recurrence: [4, 5],
  isRepeatEnabled: true,
  repeatCount: 3,
  repeatCurve: 0.2,
  repeatVelocityCurve: -0.3,
  repeatVelocityEnd: 0.6,
} as const;

const coverageNotes: readonly FixtureNote[] = [
  ...Array.from({ length: 16 }, (_, channel): FixtureNote => ({
    grid: BINARY_GRID, x: 64, pitch: 72, channel, velocity: 80 + channel,
    duration: BINARY_GRID * 2,
  })),
  { grid: BINARY_GRID, x: 0, pitch: 60, channel: 0, velocity: 96, duration: 64 / 512 },
  { grid: BINARY_GRID, x: 64, pitch: 60, channel: 0, velocity: 97, duration: 64 / 512 },
  { grid: BINARY_GRID, x: 32, pitch: 60, channel: 1, velocity: 98, duration: 128 / 512 },
  { grid: BINARY_GRID, x: 32, pitch: 100, channel: 4, velocity: 99,
    duration: BINARY_GRID * 2, props: optionalProps },
  { grid: TRIPLET_GRID, x: 1, pitch: 110, channel: 0, velocity: 91, duration: TRIPLET_GRID },
  { grid: TRIPLET_GRID, x: 256, pitch: 111, channel: 1, velocity: 92, duration: TRIPLET_GRID * 2 },
  { grid: TRIPLET_GRID, x: 767, pitch: 112, channel: 2, velocity: 93, duration: TRIPLET_GRID },
  { grid: TRIPLET_GRID, x: 8 * 768 - 1, pitch: 113, channel: 3, velocity: 94,
    duration: TRIPLET_GRID },
];

const fixtures: readonly Fixture[] = [
  { label: 'short sparse', row: 1, lengthBeats: 1, notes: coverageNotes.filter((item) => item.x < 512) },
  { label: 'short dense', row: 2, lengthBeats: 1, notes: denseNotes(1, 96) },
  { label: 'long sparse', row: 3, lengthBeats: 8, notes: coverageNotes },
  { label: 'long dense', row: 4, lengthBeats: 8, notes: [...denseNotes(8, 256), ...coverageNotes] },
];

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
  }, 4_000, 50);
  if (!pinned.ok) throw new Error(`${cursor} did not pin to ${trackIndex}:${slotIndex}`);
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

async function createClip(trackIndex: number, row: number, lengthBeats: number): Promise<void> {
  await client.request('clip.create', { trackIndex, slotIndex: row, lengthBeats });
  const exists = await pollUntil(async () =>
    (await client.request('slot.status', { trackIndex, slotIndex: row }) as { hasContent: boolean }).hasContent);
  if (!exists.ok) throw new Error(`owned clip ${trackIndex}:${row} did not appear`);
}

async function writeFixture(trackIndex: number, fixture: Fixture): Promise<void> {
  await pointAndPin(WRITER, trackIndex, fixture.row);
  for (const grid of [BINARY_GRID, TRIPLET_GRID]) {
    const notes = fixture.notes.filter((item) => item.grid === grid);
    const pages = new Set(notes.map((item) => Math.floor(item.x / WRITER_STEPS) * WRITER_STEPS));
    await client.request('cursor.setStepSize', { cursor: WRITER, stepSize: grid });
    for (const page of [...pages].sort((left, right) => left - right)) {
      await client.request('cursor.scrollToStep', { cursor: WRITER, step: page });
      await wait(50);
      for (let channel = 0; channel < 16; channel += 1) {
        const batch = notes.filter((item) => item.channel === channel
          && Math.floor(item.x / WRITER_STEPS) * WRITER_STEPS === page);
        if (batch.length === 0) continue;
        await client.request('cursor.setNotes', {
          cursor: WRITER,
          channel,
          notes: batch.map((item) => [
            item.x - page, item.pitch, item.velocity, item.duration,
          ]),
        });
      }
      for (const item of notes.filter((candidate) => candidate.props !== undefined
        && Math.floor(candidate.x / WRITER_STEPS) * WRITER_STEPS === page)) {
        await client.request('cursor.setNoteProps', {
          cursor: WRITER, channel: item.channel, x: item.x - page, y: item.pitch,
          props: item.props,
        });
      }
    }
  }
  await client.request('cursor.scrollToStep', { cursor: WRITER, step: 0 });
  await wait(200);
}

async function settledRead(action: () => Promise<void>): Promise<{ read: StepDataRead; ms: number }> {
  const started = performance.now();
  await action();
  let priorCallbacks = -1;
  let unchanged = 0;
  let read = await client.request('stepdata.observer.read') as StepDataRead;
  for (;;) {
    unchanged = read.callbacks === priorCallbacks ? unchanged + 1 : 0;
    priorCallbacks = read.callbacks;
    const elapsed = performance.now() - started;
    if (elapsed >= MIN_SETTLEMENT_MS && unchanged >= 5) return { read, ms: elapsed };
    if (elapsed >= 4_000) throw new Error('step-data observer did not reach bounded stability');
    await wait(POLL_MS);
    read = await client.request('stepdata.observer.read') as StepDataRead;
  }
}

async function sparseGrid(
  grid: number,
  lengthBeats: number,
  initialAction: () => Promise<void>,
  timing: Timing,
): Promise<ScanNote[]> {
  const totalSteps = Math.max(1, Math.ceil(lengthBeats / grid));
  const result: ScanNote[] = [];
  for (let page = 0; page < totalSteps; page += READER_STEPS) {
    const prepared = await client.request('stepdata.observer.prepare') as StepDataRead;
    const settlement = await settledRead(page === 0 ? initialAction : () =>
      client.request('cursor.scrollToStep', { cursor: OBSERVER, step: page }).then(() => undefined));
    timing.settlementMs += settlement.ms;
    const bridgeStarted = performance.now();
    const enriched = await client.request('stepdata.observer.enrich', {
      generation: prepared.generation,
      callbacks: settlement.read.callbacks,
    }) as PageRead;
    const requestMs = performance.now() - bridgeStarted;
    if (!enriched.stable || enriched.clipExists === false || enriched.count !== enriched.notes.length) {
      throw new Error('sparse enrichment returned an unstable or inconsistent page');
    }
    timing.targetedHostMs += enriched.scanMicros / 1_000;
    timing.bridgeTransferMs += Math.max(0, requestMs - enriched.scanMicros / 1_000);
    timing.pages += 1;
    timing.coordinates += enriched.coordinateCount;
    timing.getStepCalls += enriched.getStepCalls;
    result.push(...enriched.notes.map((wireNote) => ({
      note: wireNote,
      startBeats: (wireNote.x + page) * grid,
    })));
  }
  return result;
}

async function sparseRead(
  trackIndex: number,
  fixture: Fixture,
): Promise<{ binary: ScanNote[]; triplet: ScanNote[]; timing: Timing }> {
  const timing: Timing = {
    settlementMs: 0, targetedHostMs: 0, bridgeTransferMs: 0, normalizationMs: 0,
    totalMs: 0, pages: 0, coordinates: 0, getStepCalls: 0,
  };
  const started = performance.now();
  await pointAndPin(OBSERVER, trackIndex, EMPTY_ROW);
  await client.request('cursor.setStepSize', { cursor: OBSERVER, stepSize: BINARY_GRID });
  await client.request('cursor.scrollToStep', { cursor: OBSERVER, step: 0 });
  await wait(200);
  const binary = await sparseGrid(BINARY_GRID, fixture.lengthBeats,
    () => pointAndPin(OBSERVER, trackIndex, fixture.row), timing);
  const triplet = await sparseGrid(TRIPLET_GRID, fixture.lengthBeats, async () => {
    await client.request('cursor.setStepSize', { cursor: OBSERVER, stepSize: TRIPLET_GRID });
    await client.request('cursor.scrollToStep', { cursor: OBSERVER, step: 0 });
  }, timing);
  timing.totalMs = performance.now() - started;
  return { binary, triplet, timing };
}

async function completeGrid(grid: number, lengthBeats: number): Promise<ScanNote[]> {
  await client.request('cursor.setStepSize', { cursor: READER, stepSize: grid });
  const totalSteps = Math.max(1, Math.ceil(lengthBeats / grid));
  const result: ScanNote[] = [];
  for (let page = 0; page < totalSteps; page += READER_STEPS) {
    await client.request('cursor.scrollToStep', { cursor: READER, step: page });
    await wait(144);
    const maxX = Math.min(READER_STEPS, totalSteps - page);
    const read = await client.request('cursor.getNotesVerboseAllChannels', {
      cursor: READER, maxX,
    }) as { readonly channels: readonly { readonly notes: readonly WireNote[] }[] };
    for (const channel of read.channels) {
      result.push(...channel.notes.map((wireNote) => ({
        note: wireNote,
        startBeats: (wireNote.x + page) * grid,
      })));
    }
  }
  await client.request('cursor.scrollToStep', { cursor: READER, step: 0 });
  return result;
}

async function completeRead(trackIndex: number, fixture: Fixture): Promise<{
  binary: ScanNote[]; triplet: ScanNote[]; totalMs: number;
}> {
  const started = performance.now();
  await pointAndPin(READER, trackIndex, fixture.row);
  const binary = await completeGrid(BINARY_GRID, fixture.lengthBeats);
  const triplet = await completeGrid(TRIPLET_GRID, fixture.lengthBeats);
  return { binary, triplet, totalMs: performance.now() - started };
}

function noteFields(item: ScanNote): Record<string, unknown> {
  const { x: _x, y: _y, channel: _channel, duration: _duration, ...fields } = item.note;
  return fields;
}

function reconcile(binary: readonly ScanNote[], triplet: readonly ScanNote[]): {
  readonly notes: ScanNote[];
  readonly unequalGroups: number;
} {
  const group = (notes: readonly ScanNote[]): Map<string, ScanNote[]> => {
    const result = new Map<string, ScanNote[]>();
    for (const item of notes) {
      const key = `${item.note.channel}:${item.note.y}`;
      const found = result.get(key) ?? [];
      found.push(item);
      result.set(key, found);
    }
    for (const found of result.values()) found.sort((left, right) => left.startBeats - right.startBeats);
    return result;
  };
  const left = group(binary);
  const right = group(triplet);
  const result: ScanNote[] = [];
  let unequalGroups = 0;
  for (const key of new Set([...left.keys(), ...right.keys()])) {
    const a = left.get(key) ?? [];
    const b = right.get(key) ?? [];
    if (a.length !== b.length) unequalGroups += 1;
    const unused = new Set(b.map((_, index) => index));
    for (const binaryNote of a) {
      const candidates = [...unused]
        .filter((index) => stable(noteFields(binaryNote)) === stable(noteFields(b[index]!)))
        .map((index) => ({ index, distance: Math.abs(binaryNote.startBeats - b[index]!.startBeats) }))
        .filter((item) => item.distance <= 1 / 48)
        .sort((first, second) => first.distance - second.distance || first.index - second.index);
      const matched = candidates[0];
      if (matched === undefined) {
        result.push(binaryNote);
        continue;
      }
      unused.delete(matched.index);
      const tripletNote = b[matched.index]!;
      result.push(binaryNote.startBeats >= tripletNote.startBeats ? binaryNote : tripletNote);
    }
    for (const index of unused) result.push(b[index]!);
  }
  return { notes: result, unequalGroups };
}

function normalize(notes: readonly ScanNote[]): readonly Record<string, unknown>[] {
  const normalized = notes.map((item) => {
    const fields = noteFields(item);
    return {
      channel: item.note.channel,
      pitch: item.note.y,
      startTick: Math.round(item.startBeats * NORMALIZED_STEPS_PER_BEAT),
      durationTicks: Math.max(1, Math.round(item.note.duration * NORMALIZED_STEPS_PER_BEAT)),
      ...fields,
    };
  }).sort((left, right) => left.channel - right.channel
    || left.startTick - right.startTick || left.pitch - right.pitch);
  const keys = new Set<string>();
  for (const item of normalized) {
    const key = `${item.channel}:${item.pitch}:${item.startTick}`;
    if (keys.has(key)) throw new Error(`normalization collision at ${key}`);
    keys.add(key);
  }
  return normalized;
}

async function deleteOwnedTrack(trackId: string): Promise<void> {
  const current = (await tracks()).find((track) => track.channelId === trackId);
  if (current === undefined) return;
  if (current.name !== TRACK_NAME) throw new Error('the owned track was renamed; cleanup refused');
  await client.request('track.delete', { trackIndex: current.index });
  const gone = await pollUntil(async () => !(await tracks()).some((track) => track.channelId === trackId));
  if (!gone.ok) throw new Error('the owned track did not delete');
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
  readonly hostApiVersion: number; readonly methodCount: number; readonly methodsHash: string;
};
const entryTracks = await tracks();
const entrySelection = await selection();
const entryTransport = await client.request('transport.status') as { readonly isPlaying?: boolean };
const entryCursors = new Map<string, Awaited<ReturnType<typeof cursorStatus>>>();
for (const cursor of [WRITER, READER, OBSERVER]) entryCursors.set(cursor, await cursorStatus(cursor));
let owned: TrackRow | undefined;
const measurements: Record<string, unknown>[] = [];

try {
  check('E131-S0: the sparse enrichment probe build is live',
    hello.hostApiVersion === 25 && hello.methodCount === 157,
    hello);
  check('E131-S1: entry is stopped and the owned name is unused',
    entryTransport.isPlaying === false && !entryTracks.some((track) => track.name === TRACK_NAME),
    { tracks: entryTracks.length, isPlaying: entryTransport.isPlaying });
  if (entryTransport.isPlaying !== false) throw new Error('stop transport before this probe');

  owned = await createOwnedTrack(entryTracks);
  await createClip(owned.index, EMPTY_ROW, 1);
  for (const fixture of fixtures) {
    await createClip(owned.index, fixture.row, fixture.lengthBeats);
    await writeFixture(owned.index, fixture);
  }

  for (const fixture of fixtures) {
    const sparse = await sparseRead(owned.index, fixture);
    const authority = await completeRead(owned.index, fixture);
    const normalizeStarted = performance.now();
    const completeReconciled = reconcile(authority.binary, authority.triplet);
    const authoritative = normalize(completeReconciled.notes);
    const sparseBinary = normalize(sparse.binary);
    const sparseReconciled = reconcile(sparse.binary, sparse.triplet);
    const sparseDual = normalize(sparseReconciled.notes);
    sparse.timing.normalizationMs = performance.now() - normalizeStarted;
    sparse.timing.totalMs += sparse.timing.normalizationMs;
    const singleEqual = stable(sparseBinary) === stable(authoritative);
    const dualEqual = stable(sparseDual) === stable(authoritative);
    const measured = {
      fixture: fixture.label,
      lengthBeats: fixture.lengthBeats,
      fixtureNotes: fixture.notes.length,
      authoritativeNotes: authoritative.length,
      singleGridEqual: singleEqual,
      dualGridEqual: dualEqual,
      completeUnequalGridGroups: completeReconciled.unequalGroups,
      sparseUnequalGridGroups: sparseReconciled.unequalGroups,
      sparse: sparse.timing,
      completeDualTotalMs: authority.totalMs,
    };
    measurements.push(measured);
    note(`${fixture.label}: ${authoritative.length} notes; 1/512 ${singleEqual ? 'equal' : 'differs'}; `
      + `dual sparse ${dualEqual ? 'equal' : 'differs'}; sparse ${sparse.timing.totalMs.toFixed(1)} ms; `
      + `complete ${authority.totalMs.toFixed(1)} ms`);
    check(`E131 ${fixture.label}: sparse dual-grid coverage equals the complete reader`, dualEqual, measured);
  }

  check('E131-S2: one 1/512 sparse view does not overclaim normalized timing completeness',
    measurements.some((item) => item['singleGridEqual'] === false),
    measurements.map((item) => ({ fixture: item['fixture'], equal: item['singleGridEqual'] })));
  check('E131-S3: all channels, same-pitch notes, late content, and optional fields survive',
    measurements.every((item) => item['dualGridEqual'] === true), measurements);
  console.log(`SPARSE_ENRICHMENT_MEASUREMENTS ${JSON.stringify(measurements)}`);
} catch (error) {
  check('E131-SX: sparse enrichment completed without an unexpected failure', false,
    error instanceof Error ? `${error.name}: ${error.message}` : String(error));
} finally {
  if (owned !== undefined) {
    try {
      await deleteOwnedTrack(owned.channelId);
      check('E131-S4: the owned track and five clips are removed', true);
    } catch (error) {
      check('E131-S4: the owned track and five clips are removed', false,
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
      if (status.cursorTrackPinned === true) await client.request('cursor.pinTrack', { cursor, pinned: true });
      if (status.isPinned === true) await client.request('cursor.pin', { cursor, pinned: true });
    }
    await restoreSelection(entrySelection);
    const finalTracks = await tracks();
    const finalTransport = await client.request('transport.status') as { readonly isPlaying?: boolean };
    check('E131-S5: exact tracks, selection, and transport baseline are restored',
      stable(finalTracks) === stable(entryTracks)
        && (await selection()).trackIndex === entrySelection.trackIndex
        && (await selection()).slotIndex === entrySelection.slotIndex
        && finalTransport.isPlaying === entryTransport.isPlaying,
      { tracks: finalTracks.length, selection: await selection(), isPlaying: finalTransport.isPlaying });
  } catch (error) {
    check('E131-S5: exact tracks, selection, and transport baseline are restored', false,
      error instanceof Error ? error.message : String(error));
  }
}

client.disconnect();
console.log(`\n${failureCount() === 0 ? 'ALL PASS' : `${failureCount()} FAILURE(S)`}`);
process.exit(failureCount() === 0 ? 0 : 1);
