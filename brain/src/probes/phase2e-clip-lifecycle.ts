/** Phase 2 session 2e — launcher-clip metadata and duplication routes. */
import { LiveAdapter } from '../adapters/live/adapter.js';
import { BridgeTransport } from '../adapters/live/transport.js';
import { clip, fullyApplied, scene, slot, track } from '../contract/index.js';
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
const GRID = 0.25;
const SOURCE_NAME = 'gn-2e-source';
const SOURCE_COLOR = [31 / 255, 159 / 255, 223 / 255] as const;
const SOURCE_NOTE = [0, 60, 101, 0.5] as const;
const MARKER_NOTE = [0, 72, 81, 0.25] as const;

interface TrackRow {
  readonly index: number;
  readonly name: string;
  readonly channelId: string;
}

interface Selection {
  readonly trackIndex: number;
  readonly slotIndex: number;
}

interface Metadata {
  readonly exists: boolean;
  readonly name: string;
  readonly playStart: number;
  readonly playStop: number;
  readonly loopEnabled: boolean;
  readonly loopStart: number;
  readonly loopLength: number;
  readonly colorRed: number;
  readonly colorGreen: number;
  readonly colorBlue: number;
  readonly colorAlpha: number;
}

interface VerboseNote {
  readonly x: number;
  readonly y: number;
  readonly velocity: number;
  readonly duration: number;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const close = (left: number, right: number): boolean => Math.abs(left - right) <= 1e-6;
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

async function occupied(trackIndex: number, row: number): Promise<boolean> {
  const status = (await client.request('slot.status', {
    trackIndex, slotIndex: row,
  })) as { readonly hasContent: boolean };
  return status.hasContent;
}

async function occupiedCount(tracks: readonly TrackRow[]): Promise<number> {
  let count = 0;
  for (const track of tracks) {
    for (let row = 0; row < 10; row += 1) {
      if (await occupied(track.index, row)) count += 1;
    }
  }
  return count;
}

async function sceneCount(): Promise<number> {
  const result = (await client.request('scene.count')) as { readonly sceneCount: number };
  return result.sceneCount;
}

async function metadata(cursor: string): Promise<Metadata> {
  return (await client.request('cursor.clipMetadata', { cursor })) as Metadata;
}

async function notes(cursor: string): Promise<readonly VerboseNote[]> {
  const result = (await client.request('cursor.getNotesVerbose', {
    cursor, channel: 0, maxX: 64,
  })) as { readonly notes: VerboseNote[] };
  return result.notes;
}

async function pointAt(cursor: string, trackIndex: number, row: number): Promise<void> {
  const result = await point(cursor, trackIndex, row, 'trackThenSlot');
  if (!result.ok) throw new Error(`cursor ${cursor} did not point to row ${row}`);
  await client.request('cursor.setStepSize', { cursor, stepSize: GRID });
  await sleep(200);
}

async function deleteOwned(trackIndex: number, row: number): Promise<void> {
  if (!(await occupied(trackIndex, row))) return;
  await client.request('slot.delete', { trackIndex, slotIndex: row });
  const gone = await pollUntil(async () => !(await occupied(trackIndex, row)));
  if (!gone.ok) throw new Error(`owned clip at row ${row} did not delete`);
}

async function createOwned(trackIndex: number, row: number): Promise<void> {
  if (await occupied(trackIndex, row)) {
    throw new Error(`row ${row} is occupied before owned creation`);
  }
  await client.request('clip.create', { trackIndex, slotIndex: row, lengthBeats: 8 });
  const appeared = await pollUntil(async () => occupied(trackIndex, row));
  if (!appeared.ok) throw new Error(`owned clip at row ${row} did not appear`);
}

interface SeedResult {
  readonly initial: Metadata;
  readonly afterName: Metadata;
  readonly afterColor: Metadata;
  readonly afterLength: Metadata;
  readonly afterLoopStart: Metadata;
  readonly afterPlayStart: Metadata;
  readonly afterEarlyPlayStop: Metadata;
  readonly afterLatePlayStop: Metadata;
  readonly afterLoopDisabled: Metadata;
  readonly afterLoopEnabled: Metadata;
  readonly final: Metadata;
}

async function setAndWitness(
  trackIndex: number,
  row: number,
  params: Readonly<Record<string, unknown>>,
): Promise<Metadata> {
  await pointAt(WRITER, trackIndex, row);
  await client.request('cursor.setClipMetadata', { cursor: WRITER, ...params });
  await sleep(100);
  await pointAt(WITNESS, trackIndex, row);
  return metadata(WITNESS);
}

async function seedSource(trackIndex: number, row: number): Promise<SeedResult> {
  await pointAt(WRITER, trackIndex, row);
  await client.request('cursor.clearNotes', { cursor: WRITER });
  await client.request('cursor.setNotes', { cursor: WRITER, notes: [SOURCE_NOTE] });
  await sleep(100);
  await pointAt(WITNESS, trackIndex, row);
  const initial = await metadata(WITNESS);
  const afterName = await setAndWitness(trackIndex, row, { name: SOURCE_NAME });
  const afterColor = await setAndWitness(trackIndex, row, { color: SOURCE_COLOR });
  const afterLength = await setAndWitness(trackIndex, row, { loopLength: 10 });
  const afterLoopStart = await setAndWitness(trackIndex, row, { loopStart: 1 });
  const afterPlayStart = await setAndWitness(trackIndex, row, { playStart: 2 });
  const afterEarlyPlayStop = await setAndWitness(trackIndex, row, { playStop: 9 });
  const afterLatePlayStop = await setAndWitness(trackIndex, row, { playStop: 12 });
  const afterLoopDisabled = await setAndWitness(trackIndex, row, { loopEnabled: false });
  const afterLoopEnabled = await setAndWitness(trackIndex, row, { loopEnabled: true });
  await pointAt(WRITER, trackIndex, row);
  await client.request('cursor.setLaunchSettings', {
    cursor: WRITER,
    launchQuantization: '1',
    launchMode: 'continue_or_synced',
    useLoopStartAsQuantizationReference: true,
  });
  await sleep(100);
  await pointAt(WITNESS, trackIndex, row);
  return { initial, afterName, afterColor, afterLength, afterLoopStart, afterPlayStart,
    afterEarlyPlayStop, afterLatePlayStop,
    afterLoopDisabled, afterLoopEnabled,
    final: await metadata(WITNESS) };
}

function sameMetadata(left: Metadata, right: Metadata): boolean {
  return left.exists === right.exists
    && left.name === right.name
    && close(left.playStart, right.playStart)
    && close(left.playStop, right.playStop)
    && left.loopEnabled === right.loopEnabled
    && close(left.loopStart, right.loopStart)
    && close(left.loopLength, right.loopLength)
    && close(left.colorRed, right.colorRed)
    && close(left.colorGreen, right.colorGreen)
    && close(left.colorBlue, right.colorBlue)
    && close(left.colorAlpha, right.colorAlpha);
}

function sameLaunch(left: unknown, right: unknown): boolean {
  const pick = (value: unknown): unknown => {
    const item = value as Readonly<Record<string, unknown>>;
    return {
      launchQuantization: item.launchQuantization,
      launchMode: item.launchMode,
      useLoopStartAsQuantizationReference: item.useLoopStartAsQuantizationReference,
    };
  };
  return JSON.stringify(pick(left)) === JSON.stringify(pick(right));
}

async function copiedState(trackIndex: number, row: number): Promise<{
  readonly metadata: Metadata;
  readonly notes: readonly VerboseNote[];
  readonly launch: unknown;
}> {
  await pointAt(WITNESS, trackIndex, row);
  return {
    metadata: await metadata(WITNESS),
    notes: await notes(WITNESS),
    launch: await client.request('cursor.launchSettings', { cursor: WITNESS }),
  };
}

await client.connect();
const typed = new LiveAdapter({
  transport: new BridgeTransport(client), cursorRefs: [WRITER],
});
await typed.hello();
const originalSelection = await selection();
let tracks: TrackRow[] = [];
let probeTrack: TrackRow | undefined;
let sourceRow: number | undefined;
let originalOccupied = -1;

try {
  const listed = (await client.request('track.list')) as { readonly tracks: TrackRow[] };
  tracks = listed.tracks;
  const identitiesMatch = tracks.length === Object.keys(TRACKS).length
    && tracks.every((track) => TRACKS[track.channelId] === track.name);
  check('2e-L0: destructive fixture identities match the documented baseline', identitiesMatch,
    tracks.map(({ index, name, channelId }) => ({ index, name, channelId })));
  if (!identitiesMatch) throw new Error('fixture identity mismatch');

  const project = (await client.request('revision.get')) as { readonly project?: string };
  const scenes = await sceneCount();
  const transport = (await client.request('transport.status')) as { readonly isPlaying?: boolean };
  originalOccupied = await occupiedCount(tracks);
  const record = await observation();
  const baseline = project.project === 'gn-scale-test'
    && scenes === 10
    && transport.isPlaying === false
    && originalOccupied === 22
    && record === EMPTY_RECORD;
  check('2e-L1: project, scenes, transport, grid, and observation match the baseline', baseline,
    { project: project.project, scenes,
      isPlaying: transport.isPlaying, occupied: originalOccupied, record });
  if (!baseline) throw new Error('live project baseline mismatch');

  for (const trackId of CLIP_TRACK_IDS) {
    const candidate = tracks.find((track) => track.channelId === trackId);
    if (candidate === undefined) continue;
    for (let row = 2; row < 9; row += 1) {
      if (!(await occupied(candidate.index, row)) && !(await occupied(candidate.index, row + 1))) {
        probeTrack = candidate;
        sourceRow = row;
        break;
      }
    }
    if (probeTrack !== undefined) break;
  }
  check('2e-L2: the probe claims two consecutive empty slots by readback',
    probeTrack !== undefined && sourceRow !== undefined,
    { track: probeTrack?.name, sourceRow });
  if (probeTrack === undefined || sourceRow === undefined) throw new Error('no two-row empty probe block');
  const destinationRow = sourceRow + 1;

  await createOwned(probeTrack.index, sourceRow);
  const seed = await seedSource(probeTrack.index, sourceRow);
  const seeded = seed.final;
  check('2e-L3a: name has independent read-after-write proof',
    seed.afterName.name === SOURCE_NAME, seed.afterName);
  check('2e-L3b: colour has independent read-after-write proof',
    close(seed.afterColor.colorRed, SOURCE_COLOR[0])
      && close(seed.afterColor.colorGreen, SOURCE_COLOR[1])
      && close(seed.afterColor.colorBlue, SOURCE_COLOR[2]), seed.afterColor);
  check('2e-L3c: clip length has independent read-after-write proof',
    close(seed.afterLength.loopLength, 10), seed.afterLength);
  check('2e-L3d: loop start has independent read-after-write proof',
    close(seed.afterLoopStart.loopStart, 1), seed.afterLoopStart);
  check('2e-L3e: play start has independent read-after-write proof',
    close(seed.afterPlayStart.playStart, 2), seed.afterPlayStart);
  check('2e-L3f: play-stop writes below and above the loop end are silently ignored',
    close(seed.afterEarlyPlayStop.playStop, 11) && close(seed.afterLatePlayStop.playStop, 11),
    { early: seed.afterEarlyPlayStop, late: seed.afterLatePlayStop });
  check('2e-L3g: loop enabled state has independent read-after-write proof',
    seed.afterLoopDisabled.loopEnabled === false && seed.afterLoopEnabled.loopEnabled === true,
    { disabled: seed.afterLoopDisabled, enabled: seed.afterLoopEnabled });
  const sourceNotes = await notes(WITNESS);
  const sourceLaunch = await client.request('cursor.launchSettings', { cursor: WITNESS });
  note(`CLIP_METADATA_STAGES ${JSON.stringify(seed)}`);

  await client.request('slot.duplicateObject', {
    trackIndex: probeTrack.index, slotIndex: sourceRow,
  });
  const objectCopyLanded = await pollUntil(async () => occupied(probeTrack!.index, destinationRow));
  const objectCopy = objectCopyLanded.ok
    ? await copiedState(probeTrack.index, destinationRow)
    : undefined;
  check('2e-L4a: duplicateObject lands in the next empty row', objectCopyLanded.ok);
  check('2e-L4b: duplicateObject keeps the source', await occupied(probeTrack.index, sourceRow));
  check('2e-L4c: duplicateObject copies metadata, notes, and launch settings',
    objectCopy !== undefined
      && sameMetadata(objectCopy.metadata, seeded)
      && JSON.stringify(objectCopy.notes) === JSON.stringify(sourceNotes)
      && sameLaunch(objectCopy.launch, sourceLaunch), objectCopy);
  if (objectCopyLanded.ok) {
    await pointAt(WRITER, probeTrack.index, sourceRow);
    await pointAt(WITNESS, probeTrack.index, destinationRow);
    const equal = (await client.request('equals.status', { all: true })) as {
      readonly pairs?: Readonly<Record<string, boolean>>;
    };
    check('2e-L4d: cursor equality cannot distinguish the two clip rows',
      equal.pairs?.['clip0=clip1'] === true, equal.pairs?.['clip0=clip1']);
  }
  await deleteOwned(probeTrack.index, destinationRow);

  await pointAt(WRITER, probeTrack.index, sourceRow);
  const beforeContent = await copiedState(probeTrack.index, sourceRow);
  await pointAt(WRITER, probeTrack.index, sourceRow);
  await client.request('cursor.duplicateContent', { cursor: WRITER });
  await sleep(300);
  const afterContent = await copiedState(probeTrack.index, sourceRow);
  check('2e-L5a: duplicateContent creates no destination clip',
    !(await occupied(probeTrack.index, destinationRow)));
  check('2e-L5b: duplicateContent edits the source content in place',
    afterContent.metadata.playStop > beforeContent.metadata.playStop
      || afterContent.metadata.loopLength > beforeContent.metadata.loopLength
      || afterContent.notes.length > beforeContent.notes.length,
    { before: beforeContent, after: afterContent });
  note(`DUPLICATE_CONTENT ${JSON.stringify({ before: beforeContent, after: afterContent })}`);

  await deleteOwned(probeTrack.index, sourceRow);
  await createOwned(probeTrack.index, sourceRow);
  const reseeded = (await seedSource(probeTrack.index, sourceRow)).final;
  await client.request('slot.duplicateClip', {
    trackIndex: probeTrack.index, slotIndex: sourceRow, route: 'slot',
  });
  const clipCopyLanded = await pollUntil(async () => occupied(probeTrack!.index, destinationRow));
  const clipCopy = clipCopyLanded.ok
    ? await copiedState(probeTrack.index, destinationRow)
    : undefined;
  check('2e-L6a: duplicateClip lands in the named next row', clipCopyLanded.ok);
  check('2e-L6b: duplicateClip copies metadata, notes, and launch settings',
    clipCopy !== undefined
      && sameMetadata(clipCopy.metadata, reseeded)
      && JSON.stringify(clipCopy.notes) === JSON.stringify(sourceNotes)
      && sameLaunch(clipCopy.launch, sourceLaunch), clipCopy);
  await deleteOwned(probeTrack.index, destinationRow);

  // Confirm the two object-copy routes share the E20b overwrite trap. The
  // destination is owned by this probe and contains a distinct marker.
  for (const route of ['duplicateObject', 'duplicateClip'] as const) {
    await createOwned(probeTrack.index, destinationRow);
    await pointAt(WRITER, probeTrack.index, destinationRow);
    await client.request('cursor.clearNotes', { cursor: WRITER });
    await client.request('cursor.setNotes', { cursor: WRITER, notes: [MARKER_NOTE] });
    await client.request('cursor.setClipMetadata', { cursor: WRITER, name: `gn-2e-${route}-marker` });
    await sleep(150);
    const epochBefore = (await client.request('slot.epoch')) as { readonly epoch: number };
    if (route === 'duplicateObject') {
      await client.request('slot.duplicateObject', {
        trackIndex: probeTrack.index, slotIndex: sourceRow,
      });
    } else {
      await client.request('slot.duplicateClip', {
        trackIndex: probeTrack.index, slotIndex: sourceRow, route: 'slot',
      });
    }
    const overwritten = await pollUntil(async () => {
      const state = await copiedState(probeTrack!.index, destinationRow);
      return state.metadata.name === SOURCE_NAME;
    });
    const epochAfter = (await client.request('slot.epoch')) as { readonly epoch: number };
    check(`2e-L7-${route}: occupied destination is overwritten`, overwritten.ok);
    check(`2e-L8-${route}: overwrite emits no occupancy event`,
      epochAfter.epoch === epochBefore.epoch, { before: epochBefore.epoch, after: epochAfter.epoch });
    await deleteOwned(probeTrack.index, destinationRow);
  }

  // Run the selected routes through the typed adapter. The second cursor reads
  // each result so the writer is not its own witness.
  await deleteOwned(probeTrack.index, sourceRow);
  const mark = await typed.revision();
  const typedSourceSlot = slot(track(probeTrack.channelId), scene(sourceRow, mark.sceneEpoch));
  const typedDestinationSlot = slot(track(probeTrack.channelId), scene(destinationRow, mark.sceneEpoch));
  const typedSource = clip(typedSourceSlot);
  const typedMetadata = {
    name: 'gn-2e-typed', color: { red: 31, green: 159, blue: 223 },
    lengthBeats: 9, playStartBeats: 2, loopEnabled: true,
    loopStartBeats: 1, loopEndBeats: 10,
  } as const;
  const createdAndEdited = await typed.apply({ ops: [
    { op: 'clip.create', slot: typedSourceSlot, lengthBeats: 8 },
    { op: 'clip.update', clip: typedSource, metadata: typedMetadata },
  ] });
  await typed.settle('trackStruct');
  await pointAt(WITNESS, probeTrack.index, sourceRow);
  const typedSourceRead = await metadata(WITNESS);
  check('2e-L10: typed create and metadata edit read back through an independent cursor',
    fullyApplied(createdAndEdited)
      && typedSourceRead.name === typedMetadata.name
      && close(typedSourceRead.playStart, typedMetadata.playStartBeats)
      && close(typedSourceRead.loopStart, typedMetadata.loopStartBeats)
      && close(typedSourceRead.loopLength, typedMetadata.lengthBeats)
      && close(typedSourceRead.colorRed, typedMetadata.color.red / 255)
      && close(typedSourceRead.colorGreen, typedMetadata.color.green / 255)
      && close(typedSourceRead.colorBlue, typedMetadata.color.blue / 255),
    typedSourceRead);

  const duplicated = await typed.apply({ ops: [{
    op: 'clip.duplicate', source: typedSource, destination: typedDestinationSlot,
  }] });
  await typed.settle('trackStruct');
  const typedCopy = await copiedState(probeTrack.index, destinationRow);
  check('2e-L11: typed duplicate copies the complete exact metadata',
    fullyApplied(duplicated) && sameMetadata(typedCopy.metadata, typedSourceRead), typedCopy.metadata);

  const deleted = await typed.apply({ ops: [
    { op: 'clip.delete', slot: typedDestinationSlot },
    { op: 'clip.delete', slot: typedSourceSlot },
  ] });
  await typed.settle('trackStruct');
  check('2e-L12: typed directed delete leaves both owned slots empty',
    fullyApplied(deleted)
      && !(await occupied(probeTrack.index, sourceRow))
      && !(await occupied(probeTrack.index, destinationRow)));
} catch (error) {
  check('2e-LX: the live probe completed without an unexpected failure', false,
    error instanceof Error ? `${error.name}: ${error.message}` : String(error));
} finally {
  if (probeTrack !== undefined && sourceRow !== undefined) {
    for (const row of [sourceRow + 1, sourceRow]) {
      try {
        await deleteOwned(probeTrack.index, row);
      } catch (error) {
        check(`2e-L9: owned row ${row} is removed`, false,
          error instanceof Error ? error.message : String(error));
      }
    }
  }

  try {
    const home = tracks.find((track) => track.channelId === HOME_TRACK_ID);
    if (home === undefined) throw new Error('gn-lay home track is absent');
    for (const cursor of ['0', '1', '2']) {
      await client.request('cursor.pin', { cursor, pinned: false });
      await client.request('cursor.pinTrack', { cursor: Number(cursor), pinned: false });
      await pointAt(cursor, home.index, 0);
      const status = await cursorStatus(cursor);
      if (status.isPinned === true || status.cursorTrackPinned === true) {
        throw new Error(`cursor ${cursor} stayed pinned`);
      }
    }
    await client.request('slot.select', {
      trackIndex: originalSelection.trackIndex,
      slotIndex: originalSelection.slotIndex,
      mechanism: 'slot',
    });
    const selectionRestored = await pollUntil(async () => {
      const current = await selection();
      return current.trackIndex === originalSelection.trackIndex
        && current.slotIndex === originalSelection.slotIndex;
    });
    if (!selectionRestored.ok) throw new Error('the entry selection did not restore');
    const project = (await client.request('revision.get')) as { readonly project?: string };
    const scenes = await sceneCount();
    const transport = (await client.request('transport.status')) as { readonly isPlaying?: boolean };
    const finalOccupied = await occupiedCount(tracks);
    const finalRecord = await observation();
    check('2e-L9: cleanup restores the exact live baseline',
      project.project === 'gn-scale-test'
        && scenes === 10
        && transport.isPlaying === false
        && finalOccupied === originalOccupied
        && finalRecord === EMPTY_RECORD,
      { project: project.project, scenes,
        isPlaying: transport.isPlaying, occupied: finalOccupied, record: finalRecord });
  } catch (error) {
    check('2e-L9: cleanup restores the exact live baseline', false,
      error instanceof Error ? error.message : String(error));
  }
  client.disconnect();
}

if (failureCount() > 0) process.exitCode = 1;
