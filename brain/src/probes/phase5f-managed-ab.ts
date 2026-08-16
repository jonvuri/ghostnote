/**
 * Phase 1 session 5f — human A/B through Bitwig-native controls.
 *
 * The probe makes one disposable instrument track. One mixed instruction
 * creates a device-alternate event and a clip-block event on that track. The
 * operator switches both structures in Bitwig while the probe reads the solo
 * and playback state. The track copy proves ordinary CRUD bookkeeping.
 * Cleanup removes only the fresh durable track id and restores the exact
 * observation value, status, selection, cursor state, and stopped transport.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

import {
  decodeObservationRecord, emptyObservationRecord, encodeObservationRecord,
  reportObservationRecord,
} from '../observation/index.js';
import { Session } from '../session.js';
import {
  askYesNo, check, client as bridge, failureCount, note, pollUntil, waitForEnter,
} from './lib.js';

const PROJECT = 'gn-scale-test';
const ROWS = 10;
const STATUS = 'Change · 4a-live-check';
const EMPTY_RECORD = encodeObservationRecord(emptyObservationRecord());
const COPY_SOURCE_ID = 'd367ac16-b7bd-4662-971f-fe924ec033a3';
const SOURCE_ROW = 0;
const ALTERNATE_ROW = 1;
const CLIP_BEATS = 4;
const STEPS_PER_BEAT = 4;
const CLIP_STEPS = CLIP_BEATS * STEPS_PER_BEAT;
const GRID_BEATS = 2;
const GRID_TOLERANCE = 0.35;
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

interface SurfaceTrack {
  readonly trackId: string;
  readonly name: string;
  readonly kind: string;
  readonly position: number;
}

interface Selection {
  readonly trackIndex: number;
  readonly slotIndex: number;
}

interface CursorState {
  readonly isPinned?: boolean;
  readonly exists?: boolean;
  readonly trackPosition?: number;
  readonly sceneIndex?: number;
}

interface AlternateState {
  readonly name: string;
  readonly soloed?: boolean | null;
  readonly devices?: readonly { readonly name?: string }[];
}

interface AlternateRead {
  readonly readable?: boolean;
  readonly complete?: boolean;
  readonly exclusiveActive?: string | null;
  readonly alternates?: readonly AlternateState[];
}

interface SlotPlay {
  readonly isPlaying: boolean;
  readonly isPlaybackQueued: boolean;
  readonly playPosition: number;
}

interface CursorPlay {
  readonly playingStep: number;
  readonly loopLength: number;
}

interface ClipSwitchResult {
  readonly sourceDetected: boolean;
  readonly destinationDetected: boolean;
  readonly queuedSeen: boolean;
  readonly sourceStepAtSwitch: number;
  readonly destinationFirstStep: number;
  readonly playPosition: number;
}

const transport = new StdioClientTransport({
  command: 'npx',
  args: ['tsx', 'src/mcp-server.ts'],
});
const mcp = new Client({ name: 'phase5f-managed-ab-probe', version: '0.0.1' });
const recordSession = new Session();

const parse = (result: unknown): Record<string, unknown> => {
  const content = (result as { content?: { type: string; text?: string }[] }).content ?? [];
  const payload = content.find((part) => part.type === 'text')?.text ?? '{}';
  return JSON.parse(payload) as Record<string, unknown>;
};

const call = async (name: string, args: Record<string, unknown> = {}) =>
  parse(await mcp.callTool({ name, arguments: args }));

const selection = async (): Promise<Selection> =>
  (await bridge.request('selection.status')) as Selection;

const cursorState = async (cursor: string): Promise<CursorState> =>
  (await bridge.request('cursor.status', { cursor })) as CursorState;

const slotPlay = async (trackIndex: number, slotIndex: number): Promise<SlotPlay> =>
  (await bridge.request('slot.playState', { trackIndex, slotIndex })) as SlotPlay;

const cursorPlay = async (cursor: string): Promise<CursorPlay> =>
  (await bridge.request('cursor.playState', { cursor })) as CursorPlay;

const fromGrid = (position: number): number => {
  const within = ((position % GRID_BEATS) + GRID_BEATS) % GRID_BEATS;
  return Math.min(within, GRID_BEATS - within);
};

const stepDistance = (left: number, right: number): number => {
  const raw = Math.abs(left - right) % CLIP_STEPS;
  return Math.min(raw, CLIP_STEPS - raw);
};

async function tracks(): Promise<TrackRow[]> {
  return ((await bridge.request('track.list')) as { tracks: TrackRow[] }).tracks;
}

async function surfaceTracks(): Promise<SurfaceTrack[]> {
  return ((await call('list_tracks')) as { tracks?: SurfaceTrack[] }).tracks ?? [];
}

async function readObservation(): Promise<string> {
  const reply = (await bridge.request('observation.read')) as {
    readonly available?: boolean;
    readonly value?: string;
  };
  if (reply.available !== true || typeof reply.value !== 'string') {
    throw new Error('the observation record is unavailable');
  }
  return reply.value;
}

async function inspectAlternates(
  trackId: string,
  containerPosition: number,
): Promise<AlternateRead> {
  return await call('inspect_device_alternates', { trackId, containerPosition });
}

async function select(target: Selection): Promise<void> {
  if (target.trackIndex < 0 || target.slotIndex < 0) return;
  await bridge.request('slot.select', {
    trackIndex: target.trackIndex,
    slotIndex: target.slotIndex,
    mechanism: 'slot',
  });
  const settled = await pollUntil(async () => {
    const current = await selection();
    return current.trackIndex === target.trackIndex && current.slotIndex === target.slotIndex;
  });
  if (!settled.ok) {
    throw new Error(`selection did not return to track ${target.trackIndex}, row ${target.slotIndex}`);
  }
}

async function pinClip(
  cursor: string,
  trackIndex: number,
  row: number,
): Promise<boolean> {
  await bridge.request('cursor.pin', { cursor, pinned: false });
  const unpinned = await pollUntil(async () => (await cursorState(cursor)).isPinned === false);
  if (!unpinned.ok) return false;
  await bridge.request('cursor.pointTrack', { cursor, trackIndex });
  await bridge.request('slot.select', { trackIndex, slotIndex: row, mechanism: 'track' });
  const landed = await pollUntil(async () => {
    const state = await cursorState(cursor);
    return state.exists === true && state.trackPosition === trackIndex && state.sceneIndex === row;
  });
  if (!landed.ok) return false;
  await bridge.request('cursor.pin', { cursor, pinned: true });
  return (await pollUntil(async () => (await cursorState(cursor)).isPinned === true)).ok;
}

async function restoreCursor(cursor: string, before: CursorState): Promise<void> {
  await bridge.request('cursor.pin', { cursor, pinned: false });
  if (before.exists === true && typeof before.trackPosition === 'number'
      && typeof before.sceneIndex === 'number' && before.trackPosition >= 0
      && before.sceneIndex >= 0) {
    await bridge.request('cursor.pointTrack', { cursor, trackIndex: before.trackPosition });
    await bridge.request('slot.select', {
      trackIndex: before.trackPosition,
      slotIndex: before.sceneIndex,
      mechanism: 'track',
    });
    await pollUntil(async () => {
      const state = await cursorState(cursor);
      return state.trackPosition === before.trackPosition && state.sceneIndex === before.sceneIndex;
    });
  }
  await bridge.request('cursor.pin', { cursor, pinned: before.isPinned === true });
  const restored = await pollUntil(async () =>
    (await cursorState(cursor)).isPinned === (before.isPinned === true));
  if (!restored.ok) throw new Error(`cursor ${cursor} pin state did not restore`);
}

async function waitForHumanSolo(
  trackName: string,
  trackId: string,
  containerPosition: number,
  alternateName: string,
): Promise<AlternateRead> {
  await waitForEnter(
    `In Bitwig, open ${trackName}'s Instrument Layer. Shift-click the solo control `
      + `for ${alternateName} once. Do not use a ghostnote tool.`,
  );
  const read = await inspectAlternates(trackId, containerPosition);
  check(`5f-H: the Bitwig solo control selects only ${alternateName}`,
    read.complete === true && read.exclusiveActive === alternateName
      && read.alternates?.filter((item) => item.soloed === true).length === 1,
    read);
  return read;
}

async function humanClipSwitch(
  trackName: string,
  trackIndex: number,
): Promise<ClipSwitchResult> {
  const sourceWatcher = (async (): Promise<boolean> => {
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      if ((await slotPlay(trackIndex, SOURCE_ROW)).isPlaying) return true;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    return false;
  })();
  await waitForEnter(
    `In Bitwig's launcher, click ${trackName} row ${SOURCE_ROW + 1}. `
      + 'Let the clip play, then return here.',
  );
  const sourceDetected = await sourceWatcher;
  if (!sourceDetected) {
    return {
      sourceDetected: false,
      destinationDetected: false,
      queuedSeen: false,
      sourceStepAtSwitch: -1,
      destinationFirstStep: -1,
      playPosition: -1,
    };
  }

  const middle = await pollUntil(async () => {
    const state = await cursorPlay('0');
    return state.playingStep >= 5 && state.playingStep <= 11;
  }, 20_000, 25);
  if (!middle.ok) {
    return {
      sourceDetected: true,
      destinationDetected: false,
      queuedSeen: false,
      sourceStepAtSwitch: -1,
      destinationFirstStep: -1,
      playPosition: -1,
    };
  }

  let queuedSeen = false;
  let sourceStepAtSwitch = (await cursorPlay('0')).playingStep;
  const destinationWatcher = (async (): Promise<Omit<ClipSwitchResult, 'sourceDetected'>> => {
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      const destination = await slotPlay(trackIndex, ALTERNATE_ROW);
      queuedSeen ||= destination.isPlaybackQueued;
      if (destination.isPlaying) {
        const incoming = await cursorPlay('1');
        return {
          destinationDetected: true,
          queuedSeen,
          sourceStepAtSwitch,
          destinationFirstStep: incoming.playingStep,
          playPosition: destination.playPosition,
        };
      }
      const outgoing = await cursorPlay('0');
      if (outgoing.playingStep >= 0) sourceStepAtSwitch = outgoing.playingStep;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    return {
      destinationDetected: false,
      queuedSeen,
      sourceStepAtSwitch,
      destinationFirstStep: -1,
      playPosition: -1,
    };
  })();

  await waitForEnter(
    `In Bitwig, click ${trackName} row ${ALTERNATE_ROW + 1}. `
      + 'The stored half-bar grid must queue the switch. Return here after it plays.',
  );
  return { sourceDetected, ...await destinationWatcher };
}

if (!process.stdin.isTTY) {
  throw new Error(
    'this probe needs a human at the keyboard. Run `npm run probe:5f-ab` in a terminal.',
  );
}

await bridge.connect();
const originalSelection = await selection();
const originalCursors = await Promise.all(['0', '1'].map(cursorState));
let originalRecord: string | undefined;
let sourceTrackId: string | undefined;
let copiedTrackId: string | undefined;
let baselineTrackIds: string[] = [];

try {
  await bridge.request('transport.stop');
  await mcp.connect(transport);
  originalRecord = (await recordSession.observations.read()).value;

  const before = await tracks();
  baselineTrackIds = before.map((item) => item.channelId);
  const identitiesMatch = before.length === Object.keys(TRACKS).length
    && before.every((item) => TRACKS[item.channelId] === item.name);
  check('5f-L0: all destructive fixture identities match the documented baseline',
    identitiesMatch, before);
  if (!identitiesMatch) throw new Error('fixture identity mismatch');

  const info = (await bridge.request('rig.info')) as { scenes?: number; sceneCount?: number };
  const mark = (await bridge.request('revision.get')) as { project?: string };
  const stopped = (await bridge.request('transport.status')) as { isPlaying?: boolean };
  const baselineMatches = mark.project === PROJECT && info.scenes === 16
    && info.sceneCount === ROWS && originalRecord === EMPTY_RECORD
    && stopped.isPlaying === false && originalSelection.trackIndex === 0
    && originalSelection.slotIndex === 1;
  check('5f-L1: project, rows, record, transport, and selection match the baseline',
    baselineMatches, { project: mark.project, info, stopped, originalSelection });
  if (!baselineMatches) throw new Error('live project baseline mismatch');

  const baselineSource = await call('read_clip', {
    trackId: COPY_SOURCE_ID,
    row: SOURCE_ROW,
  });
  const baselineNext = await call('read_clip', {
    trackId: COPY_SOURCE_ID,
    row: ALTERNATE_ROW,
  });
  const baselineNotes = baselineSource['notes'] as { pitch?: number }[] | undefined;
  check('5f-L2: gn-lay has one four-beat source clip and an empty next row',
    baselineSource['clipExists'] === true && baselineSource['lengthBeats'] === CLIP_BEATS
      && baselineNotes?.length === 3 && baselineNext['clipExists'] === false,
    { baselineSource, baselineNext });
  if (baselineSource['clipExists'] !== true || baselineSource['lengthBeats'] !== CLIP_BEATS
      || baselineNotes?.length !== 3 || baselineNext['clipExists'] !== false) {
    throw new Error('the documented gn-lay clip source is not usable');
  }

  const sourceName = `gn-5f-ab-${process.pid}`;
  const copyInstruction = await call('record_observation', {
    operation: 'begin',
    requestedScope: 'unsupported',
    rawScope: { request: 'Copy gn-lay as ordinary track editing.' },
  });
  const beforeCopy = await surfaceTracks();
  const copied = await call('copy_track', {
    trackId: COPY_SOURCE_ID,
    name: sourceName,
  });
  copiedTrackId = (copied['copied'] as { trackId?: string } | undefined)?.trackId;
  const afterCopy = await surfaceTracks();
  const beforeCopyIds = new Set(beforeCopy.map((item) => item.trackId));
  const freshCopies = afterCopy.filter((item) => !beforeCopyIds.has(item.trackId));
  if (copiedTrackId === undefined && freshCopies.length === 1) {
    copiedTrackId = freshCopies[0]!.trackId;
  }
  sourceTrackId = copiedTrackId;
  check('5f-L3: track copy returns ordinary-use identity and no managed-event identity',
    copied['copyConfirmed'] === true && typeof sourceTrackId === 'string'
      && typeof copied['ordinaryUseId'] === 'string'
      && copied['managedEventId'] === undefined && freshCopies.length === 1,
    { copied, freshCopies });
  if (sourceTrackId === undefined) throw new Error('the ordinary copy has no durable id');

  const copyEnriched = await call('record_observation', {
    operation: 'enrich',
    instructionId: copyInstruction['instructionId'],
    rationale: 'The operator requested ordinary whole-track editing.',
    operatorResponse: 'accepted',
  });
  check('5f-L4: the ordinary instruction links only the ordinary-use result',
    copyEnriched['operatorResponse'] === 'accepted'
      && Array.isArray(copyEnriched['resultIds'])
      && copyEnriched['resultIds'].join(',') === copied['ordinaryUseId'],
    copyEnriched);

  const changes = await call('list_changes', { limit: 20 }) as {
    changes?: { changeId?: string }[];
  };
  const changeIds = new Set((changes.changes ?? []).map((item) => item.changeId));
  const copyChangeId = copied['changeId'];
  const namingChangeId = (copied['namingChange'] as { changeId?: string } | undefined)?.changeId;
  const reversal = typeof copyChangeId === 'string'
    ? await call('check_revert', { changeId: copyChangeId })
    : {};
  check('5f-L5: copy and rename are ordinary changes with no automatic track lifecycle',
    typeof copyChangeId === 'string' && typeof namingChangeId === 'string'
      && changeIds.has(copyChangeId) && changeIds.has(namingChangeId)
      && reversal['fullyRestorable'] === false
      && reversal['wouldWriteAnything'] === false
      && Array.isArray(reversal['wouldNotRestore'])
      && reversal['wouldNotRestore'].length > 0,
    { copied, reversal });

  const begun = await call('record_observation', {
    operation: 'begin',
    requestedScope: 'mixed',
    rawScope: {
      request: 'Create independent device and launcher-clip alternates.',
      writes: ['device', 'launcher-clip'],
    },
  });
  check('5f-L6: one explicit mixed instruction starts before either managed result',
    begun['recorded'] === true && begun['operatorResponse'] === 'silent'
      && typeof begun['instructionId'] === 'string',
    begun);

  const names = [`gn-5f-a-${process.pid}`, `gn-5f-b-${process.pid}`];
  const device = await call('create_device_alternates', {
    trackId: sourceTrackId,
    containerType: 'instrument',
    names,
  });
  const createdPosition = ((device['structure'] as {
    container?: { devicePosition?: number };
  } | undefined)?.container?.devicePosition);
  check('5f-L7: production creation reads two named device alternates after the source device',
    device['creationConfirmed'] === true && typeof device['managedEventId'] === 'string'
      && createdPosition === 1,
    device);
  if (createdPosition !== 1) throw new Error('the managed container has no observed position');

  const filled = await call('fill_device_alternate', {
    trackId: sourceTrackId,
    containerPosition: createdPosition,
    alternateName: names[0],
    sourceDevicePositions: [0],
    mode: 'move',
  });
  const containerPosition = filled['finalContainerPosition'];
  const filledRead = filled['structure'] as AlternateRead | undefined;
  check('5f-L8: alternate A owns the instrument and alternate B is an audible silence control',
    filled['applied'] === true && containerPosition === 0
      && filledRead?.complete === true
      && filledRead.alternates?.[0]?.devices?.length === 1
      && filledRead.alternates?.[1]?.devices?.length === 0,
    filled);
  if (containerPosition !== 0) throw new Error('the filled container did not compact to position 0');

  const copiedClip = await call('copy_clip_down', {
    trackId: sourceTrackId,
    row: SOURCE_ROW,
    quantization: '1/2',
    mode: 'continue_or_synced',
    useLoopStartAsQuantizationReference: false,
  });
  check('5f-L10: production clip creation confirms the stored half-bar continuation behavior',
    copiedClip['creationConfirmed'] === true
      && copiedClip['clickLaunchVerified'] === true
      && typeof copiedClip['managedEventId'] === 'string',
    copiedClip);

  const copiedTrack = (await tracks()).find((item) => item.channelId === sourceTrackId);
  if (copiedTrack === undefined) throw new Error('the copied track left the bank');
  const fixturePinned = await pinClip('1', copiedTrack.index, ALTERNATE_ROW);
  if (!fixturePinned) throw new Error('the copied clip could not be pinned for fixture setup');
  await bridge.request('cursor.clearNotes', { cursor: '1' });
  await bridge.request('cursor.setNotes', {
    cursor: '1',
    notes: [[0, 60, 100, 4], [0, 67, 100, 4], [0, 72, 100, 4]],
  });
  const fixtureSettled = await pollUntil(async () => {
    const result = (await bridge.request('cursor.getNotes', { cursor: '1' })) as {
      notes?: unknown[];
    };
    return result.notes?.length === 3;
  });
  check('5f-L11: probe setup makes the copied clip one audible octave higher',
    fixtureSettled.ok);

  const enriched = await call('record_observation', {
    operation: 'enrich',
    instructionId: begun['instructionId'],
    rationale: 'The request names one device scope and one launcher-clip scope.',
    operatorResponse: 'accepted',
  });
  check('5f-L12: the mixed instruction links both independent result ids',
    enriched['operatorResponse'] === 'accepted'
      && Array.isArray(enriched['resultIds'])
      && enriched['resultIds'].join(',')
        === [device['managedEventId'], copiedClip['managedEventId']].join(','),
    enriched);

  const sourceClip = await call('read_clip', { trackId: sourceTrackId, row: SOURCE_ROW });
  const alternateClip = await call('read_clip', { trackId: sourceTrackId, row: ALTERNATE_ROW });
  const sourceLaunch = sourceClip['launch'] as Record<string, unknown> | null;
  const alternateLaunch = alternateClip['launch'] as Record<string, unknown> | null;
  const sourceNotes = sourceClip['notes'] as { pitch?: number }[] | undefined;
  const alternateNotes = alternateClip['notes'] as { pitch?: number }[] | undefined;
  const storedLaunchMatches = (launch: Record<string, unknown> | null): boolean =>
    launch?.['quantization'] === '1/2' && launch['mode'] === 'continue_or_synced'
      && launch['useLoopStartAsQuantizationReference'] === false;
  check('5f-L13: independent clip readback agrees on geometry, notes, and launch behavior',
    sourceClip['clipExists'] === true && alternateClip['clipExists'] === true
      && sourceClip['lengthBeats'] === CLIP_BEATS
      && alternateClip['lengthBeats'] === CLIP_BEATS
      && sourceNotes?.length === 3 && alternateNotes?.length === 3
      && sourceNotes.some((item) => item.pitch === 48)
      && alternateNotes.some((item) => item.pitch === 72)
      && storedLaunchMatches(sourceLaunch) && storedLaunchMatches(alternateLaunch),
    { sourceClip, alternateClip });

  const raw = await call('read_observation_record') as {
    canonicalJson?: string;
  };
  const report = await call('report_observations');
  const storedRecord = decodeObservationRecord(raw.canonicalJson ?? '');
  const appended = storedRecord.entries.slice(
    decodeObservationRecord(originalRecord).entries.length,
  );
  const instructions = appended.filter((entry) => entry.type === 'instruction-observation');
  const managed = appended.filter((entry) => entry.type === 'managed-event');
  const ordinary = appended.filter((entry) => entry.type === 'ordinary-use');
  const mixedInstruction = instructions.find((entry) => entry.requestedScope === 'mixed');
  const ordinaryInstruction = instructions.find((entry) => entry.requestedScope === 'unsupported');
  check('5f-L15: raw persistence has two instructions, two managed events, and one ordinary use',
    appended.length === 5 && instructions.length === 2 && managed.length === 2
      && ordinary.length === 1,
    appended);
  check('5f-L16: mixed results share correlation but keep result and execution identity',
    mixedInstruction !== undefined && managed.length === 2
      && managed.every((entry) => entry.correlationId === mixedInstruction.correlationId)
      && new Set(managed.map((entry) => entry.id)).size === 2
      && new Set(managed.map((entry) => entry.executionId)).size === 2
      && mixedInstruction.resultIds.join(',')
        === [device['managedEventId'], copiedClip['managedEventId']].join(','),
    { mixedInstruction, managed });
  check('5f-L17: copy stays an ordinary referenced result outside managed counts',
    ordinaryInstruction !== undefined && ordinary.length === 1
      && ordinary[0]?.tool === 'copy_track'
      && ordinary[0]?.result.sourceTrackId === COPY_SOURCE_ID
      && ordinary[0]?.result.copiedTrackId === sourceTrackId
      && ordinaryInstruction.resultIds.join(',') === copied['ordinaryUseId'],
    { ordinaryInstruction, ordinary });
  check('5f-L18: production report and direct report agree exactly',
    raw.canonicalJson === await readObservation()
      && JSON.stringify(report) === JSON.stringify(reportObservationRecord(storedRecord))
      && (report['totals'] as { managedEvents?: number })?.managedEvents === 2
      && (report['totals'] as { ordinaryUses?: number })?.ordinaryUses === 1
      && (report['managedEvents'] as { deviceAlternate?: number })?.deviceAlternate === 1
      && (report['managedEvents'] as { clipBlock?: number })?.clipBlock === 1
      && (report['ordinaryUses'] as { copyTrack?: number })?.copyTrack === 1,
    report);

  const currentTracks = await tracks();
  const sourceTrack = currentTracks.find((item) => item.channelId === sourceTrackId);
  if (sourceTrack === undefined) throw new Error('the disposable source left the track bank');

  await bridge.request('cursor.pin', { cursor: '0', pinned: false });
  await bridge.request('cursor.pointTrack', { cursor: '0', trackIndex: sourceTrack.index });
  await bridge.request('device.selectInEditor', { deviceIndex: containerPosition });
  note(`The disposable track is ${sourceName}. Alternate A has the copied device chain; B is empty.`);

  await waitForHumanSolo(sourceName, sourceTrackId, containerPosition, names[0]!);
  await waitForHumanSolo(sourceName, sourceTrackId, containerPosition, names[1]!);
  const activeBeforeClip = await waitForHumanSolo(
    sourceName, sourceTrackId, containerPosition, names[0]!,
  );

  const pinnedSource = await pinClip('0', sourceTrack.index, SOURCE_ROW);
  const pinnedAlternate = await pinClip('1', sourceTrack.index, ALTERNATE_ROW);
  const sourceCursor = pinnedSource ? await cursorPlay('0') : undefined;
  const alternateCursor = pinnedAlternate ? await cursorPlay('1') : undefined;
  check('5f-L19: two independent pinned cursors read the four-beat clip block',
    pinnedSource && pinnedAlternate
      && sourceCursor?.loopLength === CLIP_BEATS
      && alternateCursor?.loopLength === CLIP_BEATS,
    { sourceCursor, alternateCursor });
  if (!(pinnedSource && pinnedAlternate)) throw new Error('the clip block could not be pinned');

  const clipSwitch = await humanClipSwitch(sourceName, sourceTrack.index);
  const continuity = stepDistance(
    clipSwitch.sourceStepAtSwitch,
    clipSwitch.destinationFirstStep,
  );
  const beatsFromGrid = clipSwitch.destinationDetected
    ? fromGrid(clipSwitch.playPosition)
    : Number.POSITIVE_INFINITY;
  check('5f-L20: native clip clicks queue and land on the stored half-bar grid',
    clipSwitch.sourceDetected && clipSwitch.destinationDetected
      && clipSwitch.queuedSeen && beatsFromGrid <= GRID_TOLERANCE,
    { ...clipSwitch, beatsFromGrid, tolerance: GRID_TOLERANCE });
  check('5f-L21: continue_or_synced keeps the outgoing clip position at the switch',
    clipSwitch.destinationDetected && clipSwitch.destinationFirstStep > 5
      && continuity <= 6,
    { ...clipSwitch, stepDistance: continuity });

  const afterClipSwitch = await inspectAlternates(sourceTrackId, containerPosition);
  check('5f-L22: switching the clip alternate does not switch the device alternate',
    activeBeforeClip.exclusiveActive === names[0]
      && afterClipSwitch.exclusiveActive === names[0],
    { before: activeBeforeClip, after: afterClipSwitch });

  await waitForHumanSolo(sourceName, sourceTrackId, containerPosition, names[1]!);
  const clipWhileSilent = await slotPlay(sourceTrack.index, ALTERNATE_ROW);
  const becameSilent = await askYesNo(
    `While row ${ALTERNATE_ROW + 1} kept playing, did ${names[1]} make the `
      + 'disposable track silent with one Shift-click?',
  );
  check('5f-L23: device switching leaves the selected clip playing independently',
    clipWhileSilent.isPlaying && becameSilent,
    { clipWhileSilent, operatorHeardSilence: becameSilent });

  await waitForHumanSolo(sourceName, sourceTrackId, containerPosition, names[0]!);
  const clipWhileAudible = await slotPlay(sourceTrack.index, ALTERNATE_ROW);
  const becameAudible = await askYesNo(
    `Did one Shift-click on ${names[0]} restore the audible high pattern without `
      + 'relaunching the clip?',
  );
  check('5f-L24: one native solo control selects one audible device alternate',
    clipWhileAudible.isPlaying && becameAudible,
    { clipWhileAudible, operatorHeardAudio: becameAudible });
} catch (error) {
  check('5f-LX: the focused live probe completed without an unexpected failure', false,
    error instanceof Error ? `${error.name}: ${error.message}` : String(error));
} finally {
  try { await bridge.request('transport.stop'); } catch { /* reported by final baseline */ }

  const cleanupIds = [...new Set([copiedTrackId, sourceTrackId]
    .filter((id): id is string => id !== undefined))];
  if (cleanupIds.length > 0) {
    try {
      const removed = await call('delete_track', { trackIds: cleanupIds });
      check('5f-L25: directed cleanup removes the fresh durable track id',
        removed['applied'] === true && removed['refused'] !== true,
        removed);
    } catch (error) {
      check('5f-L25: directed cleanup removes the fresh durable track id', false,
        error instanceof Error ? error.message : String(error));
    }
  }

  if (originalRecord !== undefined) {
    try {
      const restored = await recordSession.observations.replace(originalRecord);
      check('5f-L26: cleanup restores the exact initial observation value',
        restored.value === originalRecord && await readObservation() === originalRecord,
        { restoredChars: restored.value.length });
    } catch (error) {
      check('5f-L26: cleanup restores the exact initial observation value', false,
        error instanceof Error ? error.message : String(error));
    }
  }

  try {
    await restoreCursor('0', originalCursors[0]!);
    await restoreCursor('1', originalCursors[1]!);
    await select(originalSelection);
    const at = (await bridge.request('revision.get')) as {
      generation?: string;
      project?: string;
    };
    const status = await bridge.request('status.push', {
      value: STATUS,
      expectedGeneration: at.generation,
      expectedProject: at.project,
    }) as { accepted?: boolean };
    check('5f-L27: Last change returns to the documented baseline',
      status.accepted === true, status);

    const finalTracks = await tracks();
    const finalInfo = (await bridge.request('rig.info')) as { sceneCount?: number };
    const finalTransport = (await bridge.request('transport.status')) as { isPlaying?: boolean };
    const finalSelection = await selection();
    const finalMatches = finalTracks.map((item) => item.channelId).join(',')
        === baselineTrackIds.join(',')
      && finalInfo.sceneCount === ROWS && finalTransport.isPlaying === false
      && finalSelection.trackIndex === originalSelection.trackIndex
      && finalSelection.slotIndex === originalSelection.slotIndex
      && await readObservation() === originalRecord;
    check('5f-L28: the complete project fixture returns to its exact baseline',
      finalMatches,
      { finalInfo, finalTransport, finalSelection, trackIds: finalTracks.map((item) => item.channelId) });
  } catch (error) {
    check('5f-L28: the complete project fixture returns to its exact baseline', false,
      error instanceof Error ? error.message : String(error));
  }

  try { await mcp.close(); } catch { /* the child can already be closed */ }
  await recordSession.close();
  bridge.disconnect();
}

note(`Phase 1 session 5f: ${failureCount() === 0 ? 'PASS' : 'FAILED'}`);
process.exit(failureCount() === 0 ? 0 : 1);
