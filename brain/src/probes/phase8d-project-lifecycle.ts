/** E138: UI-assisted project and controller lifecycle probe. */
import { readFile, unlink, writeFile } from 'node:fs/promises';

import { LiveAdapter } from '../adapters/live/adapter.js';
import { decodeVerboseNote } from '../adapters/live/encoder.js';
import { BridgeTransport } from '../adapters/live/transport.js';
import { BridgeClient } from '../client.js';
import { Executor } from '../engine/index.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { EXPERIMENTAL_7B_TOOL_PROFILE, callTool } from '../surface/tools.js';
import { workspaceOf } from '../surface/workspace.js';
import { check, failureCount, note, pollUntil } from './lib.js';

const PROFILE = 'phase-8-probe-v1';
const METHOD_COUNT = 95;
const METHOD_HASH = '226dd8c1467c7c3b';
const STATE_FILE = '/tmp/ghostnote-e138-project-lifecycle.json';
const TRACK_NAME = 'gn-e138-project-lifecycle';
const TARGET_ROW = 0;
const CANARY_ROW = 1;
const GRID = 1 / 512;
const STEPS = 2_048;
const OBSERVER = 'observer';
const READER = 'fine';
const WRITER = '0';

type EventName = 'saved' | 'track-move' | 'user-clip-create' | 'user-clip-move' | 'switch-away'
  | 'switch-back' | 'reopen' | 'controller-reload';

interface TrackRow {
  readonly index: number;
  readonly name: string;
  readonly type: string;
  readonly channelId: string;
}

interface WireNote extends Record<string, number | boolean | string> {
  readonly x: number;
  readonly y: number;
  readonly channel: number;
}

interface NormalizedNote extends Record<string, unknown> {
  readonly channel: number;
  readonly pitch: number;
  readonly startTick: number;
  readonly durationTicks: number;
}

interface Revision {
  readonly generation: string;
  readonly project: string;
  readonly contentEpoch: number;
  readonly contentEvents: readonly {
    readonly seq: number;
    readonly channelId: string;
    readonly slotIndex: number;
    readonly filled: boolean;
  }[];
}

interface StepDataRead {
  readonly generation: number;
  readonly callbacks: number;
  readonly sincePrepareMicros: number;
  readonly lastCallbackMicros?: number;
}

interface AcquisitionResult {
  readonly clip: { readonly notes: readonly (NormalizedNote & { readonly eventId: string })[] };
  readonly timing: { readonly totalMs: number };
}

interface ProbeState {
  readonly baselineTrackIds: readonly string[];
  readonly baselineScenes: number;
  readonly baselineSlots: number;
  project: string;
  projectGeneration: number;
  extensionGeneration: string;
  channelId: string;
  trackIndex: number;
  targetRow: number;
  contentEpoch: number;
  expected: readonly NormalizedNote[];
  readonly logicalId: string;
}

const bridge = new BridgeClient();
const adapter = new LiveAdapter({ transport: new BridgeTransport(bridge) });
const workspace = workspaceOf({
  ready: async () => undefined,
  adapter,
  executor: new Executor(adapter),
  stash: new Stash(),
  observationStore: new FakeObservationStore(),
});
const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const bag = value as Record<string, unknown>;
    return `{${Object.keys(bag).sort().map((key) => `${JSON.stringify(key)}:${stable(bag[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

async function tracks(): Promise<readonly TrackRow[]> {
  return (await bridge.request('track.list') as { readonly tracks: readonly TrackRow[] }).tracks;
}

async function revision(): Promise<Revision> {
  return await bridge.request('revision.get') as Revision;
}

async function sceneCount(): Promise<number> {
  return (await bridge.request('scene.count') as { readonly sceneCount: number }).sceneCount;
}

async function scanSummary(): Promise<{ readonly slotsWithContent: number }> {
  return await bridge.request('rig.scanTracks') as { readonly slotsWithContent: number };
}

async function resolve(channelId: string): Promise<TrackRow | undefined> {
  const result = await bridge.request('track.resolveByChannelId', { channelId }) as {
    readonly found: boolean;
    readonly index?: number;
    readonly name?: string;
    readonly type?: string;
  };
  return result.found && result.index !== undefined
    ? {
        index: result.index,
        name: result.name ?? '',
        type: result.type ?? '',
        channelId,
      }
    : undefined;
}

async function createTrack(): Promise<TrackRow> {
  const before = await tracks();
  const prior = new Set(before.map((item) => item.channelId));
  await bridge.request('track.create', { position: before.length });
  const appeared = await pollUntil(async () => (await tracks()).length === before.length + 1);
  if (!appeared.ok) throw new Error('owned project-lifecycle track did not appear');
  const created = (await tracks()).filter((item) => !prior.has(item.channelId));
  if (created.length !== 1) throw new Error('owned project-lifecycle track is ambiguous');
  await bridge.request('track.setName', { trackIndex: created[0]!.index, name: TRACK_NAME });
  const renamed = await pollUntil(async () => (await resolve(created[0]!.channelId))?.name === TRACK_NAME);
  if (!renamed.ok) throw new Error('owned project-lifecycle track did not rename');
  return (await resolve(created[0]!.channelId))!;
}

async function pointAndPin(cursor: string, trackIndex: number, row: number): Promise<void> {
  await bridge.request('cursor.pin', { cursor, pinned: false });
  await bridge.request('cursor.pinTrack', { cursor, pinned: false });
  await bridge.request('cursor.pointTrack', { cursor, trackIndex });
  await bridge.request('slot.select', { trackIndex, slotIndex: row, mechanism: 'track' });
  const pointed = await pollUntil(async () => {
    const result = await bridge.request('cursor.status', { cursor }) as {
      readonly exists: boolean;
      readonly trackPosition: number;
      readonly sceneIndex: number;
    };
    return result.exists && result.trackPosition === trackIndex && result.sceneIndex === row;
  }, 4_000, 50);
  if (!pointed.ok) throw new Error(`${cursor} did not point to ${trackIndex}:${row}`);
  await bridge.request('cursor.pinTrack', { cursor, pinned: true });
  await bridge.request('cursor.pin', { cursor, pinned: true });
  const pinned = await pollUntil(async () => {
    const result = await bridge.request('cursor.status', { cursor }) as {
      readonly trackPosition: number;
      readonly sceneIndex: number;
      readonly cursorTrackPinned?: boolean;
      readonly isPinned?: boolean;
    };
    return result.trackPosition === trackIndex && result.sceneIndex === row
      && result.cursorTrackPinned === true && result.isPinned === true;
  }, 4_000, 50);
  if (!pinned.ok) throw new Error(`${cursor} did not pin to ${trackIndex}:${row}`);
}

async function createClip(trackIndex: number, row: number): Promise<void> {
  await bridge.request('clip.create', { trackIndex, slotIndex: row, lengthBeats: 4 });
  const ready = await pollUntil(async () => (
    await bridge.request('slot.status', { trackIndex, slotIndex: row }) as { readonly hasContent: boolean }
  ).hasContent);
  if (!ready.ok) throw new Error(`owned clip ${trackIndex}:${row} did not appear`);
}

async function prepareWriter(trackIndex: number, row: number): Promise<void> {
  await pointAndPin(WRITER, trackIndex, row);
  await bridge.request('cursor.setStepSize', { cursor: WRITER, stepSize: GRID });
  await bridge.request('cursor.scrollToStep', { cursor: WRITER, step: 0 });
  await wait(144);
}

async function writeFixture(trackIndex: number): Promise<void> {
  await createClip(trackIndex, TARGET_ROW);
  await prepareWriter(trackIndex, TARGET_ROW);
  await bridge.request('cursor.setNotes', {
    cursor: WRITER,
    channel: 0,
    notes: [[0, 60, 100, 64 / 512], [256, 67, 92, 32 / 512]],
  });
  await bridge.request('cursor.setNotes', {
    cursor: WRITER,
    channel: 5,
    notes: [[64, 64, 90, 96 / 512]],
  });
  await createClip(trackIndex, CANARY_ROW);
  await prepareWriter(trackIndex, CANARY_ROW);
  await bridge.request('cursor.setNotes', {
    cursor: WRITER,
    channel: 15,
    notes: [[128, 84, 80, 32 / 512]],
  });
  await wait(200);
}

function normalized(notes: readonly WireNote[]): NormalizedNote[] {
  return notes.map((item) => {
    const decoded = decodeVerboseNote(item, GRID) as unknown as Record<string, unknown>;
    const startBeats = decoded['startBeats'] as number;
    const durationBeats = decoded['durationBeats'] as number;
    const pitch = decoded['pitch'] as number;
    const { startBeats: _start, durationBeats: _duration, pitch: _pitch, ...fields } = decoded;
    return {
      channel: item.channel,
      pitch,
      startTick: Math.round(startBeats * 512),
      durationTicks: Math.max(1, Math.round(durationBeats * 512)),
      ...fields,
    };
  }).sort((left, right) => left.channel - right.channel
    || left.startTick - right.startTick || left.pitch - right.pitch);
}

async function readCurrent(cursor: string): Promise<WireNote[]> {
  const result = await bridge.request('cursor.getNotesVerboseAllChannels', {
    cursor,
    maxX: STEPS,
  }) as { readonly channels: readonly { readonly notes: readonly WireNote[] }[] };
  return result.channels.flatMap((channel) => channel.notes);
}

async function authority(trackIndex: number, row: number): Promise<NormalizedNote[]> {
  await pointAndPin(READER, trackIndex, row);
  await bridge.request('cursor.setStepSize', { cursor: READER, stepSize: GRID });
  await bridge.request('cursor.scrollToStep', { cursor: READER, step: 0 });
  await wait(144);
  return normalized(await readCurrent(READER));
}

async function settleObserver(minimumCallbacks: number): Promise<StepDataRead> {
  const started = performance.now();
  for (;;) {
    const result = await bridge.request('stepdata.observer.read') as StepDataRead;
    const quietMicros = result.lastCallbackMicros === undefined
      ? 0 : result.sincePrepareMicros - result.lastCallbackMicros;
    if (result.callbacks >= minimumCallbacks && quietMicros >= 250_000) return result;
    if (performance.now() - started > 4_000) return result;
    await wait(25);
  }
}

async function observerCache(trackIndex: number, row: number): Promise<NormalizedNote[]> {
  await pointAndPin(OBSERVER, trackIndex, CANARY_ROW);
  await bridge.request('cursor.setStepSize', { cursor: OBSERVER, stepSize: GRID });
  await bridge.request('cursor.scrollToStep', { cursor: OBSERVER, step: 0 });
  await wait(250);
  const prepared = await bridge.request('stepdata.observer.prepare') as StepDataRead;
  await pointAndPin(OBSERVER, trackIndex, row);
  const settled = await settleObserver(prepared.callbacks + 1);
  const result = await bridge.request('stepdata.observer.enrich', {
    generation: settled.generation,
    callbacks: settled.callbacks,
  }) as {
    readonly notes: readonly WireNote[];
    readonly stable: boolean;
    readonly clipExists?: boolean;
  };
  check('populated-canary observer replay settled on the target',
    result.stable && result.clipExists !== false,
    { callbacks: settled.callbacks, row });
  return normalized(result.notes);
}

async function comparePopulated(
  label: string,
  state: ProbeState,
  track: TrackRow,
): Promise<NormalizedNote[]> {
  const cached = await observerCache(track.index, state.targetRow);
  const exact = await authority(track.index, state.targetRow);
  check(`${label}: cache matches the fresh settled 1/512 scan`,
    stable(cached) === stable(exact),
    { cache: cached.length, authority: exact.length });
  check(`${label}: rebuilt content matches the prior normalized cache`,
    stable(exact) === stable(state.expected),
    { rebuilt: exact.length, prior: state.expected.length });
  const acquisition = await callTool(workspace, 'acquire_clip_note_source', {
    trackId: track.channelId,
    row: state.targetRow,
  }, EXPERIMENTAL_7B_TOOL_PROFILE) as AcquisitionResult;
  const e131 = acquisition.clip.notes.map(({ eventId: _eventId, ...item }) => item)
    .sort((left, right) => left.channel - right.channel
      || left.startTick - right.startTick || left.pitch - right.pitch);
  note(`${label}: E131 diagnostic ${stable(e131) === stable(exact) ? 'matches' : 'DIFFERS'}; `
    + `${acquisition.timing.totalMs.toFixed(3)} ms`);
  return exact;
}

async function loadState(): Promise<ProbeState> {
  return JSON.parse(await readFile(STATE_FILE, 'utf8')) as ProbeState;
}

async function saveState(state: ProbeState): Promise<void> {
  await writeFile(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

async function exactProfile(): Promise<void> {
  const hello = await bridge.request('contract.hello') as {
    readonly runtimeProfile: string;
    readonly methodCount: number;
    readonly methodsHash: string;
  };
  check('project lifecycle starts on the exact probe archive',
    hello.runtimeProfile === PROFILE && hello.methodCount === METHOD_COUNT
      && hello.methodsHash === METHOD_HASH,
    hello);
  if (hello.runtimeProfile !== PROFILE || hello.methodCount !== METHOD_COUNT
      || hello.methodsHash !== METHOD_HASH) {
    throw new Error('the exact Phase 8 probe archive is not live');
  }
}

async function prepare(): Promise<void> {
  const beforeTracks = await tracks();
  const beforeScenes = await sceneCount();
  const beforeScan = await scanSummary();
  const beforeRevision = await revision();
  if (beforeTracks.some((item) => item.name === TRACK_NAME) || beforeScan.slotsWithContent !== 0) {
    throw new Error('prepare requires a new empty project without an E138 fixture');
  }
  const created = await createTrack();
  await writeFixture(created.index);
  const currentRevision = await revision();
  const state: ProbeState = {
    baselineTrackIds: beforeTracks.map((item) => item.channelId),
    baselineScenes: beforeScenes,
    baselineSlots: beforeScan.slotsWithContent,
    project: beforeRevision.project,
    projectGeneration: 1,
    extensionGeneration: currentRevision.generation,
    channelId: created.channelId,
    trackIndex: created.index,
    targetRow: TARGET_ROW,
    contentEpoch: currentRevision.contentEpoch,
    expected: [],
    logicalId: 'gnclip-project-1',
  };
  state.expected = await observerCache(created.index, state.targetRow);
  await comparePopulated('prepare', state, created);
  await saveState(state);
  note(`state ${STATE_FILE}`);
}

async function verify(event: EventName): Promise<void> {
  const state = await loadState();
  const currentRevision = await revision();
  const currentTracks = await tracks();
  const named = currentTracks.filter((item) => item.name === TRACK_NAME);

  if (event === 'switch-away') {
    check('project switch changes the observed project name',
      currentRevision.project !== state.project,
      { before: state.project, after: currentRevision.project });
    check('project switch invalidates the old address and leaves an empty cache',
      named.length === 0 && !currentTracks.some((item) => item.channelId === state.channelId),
      { oldChannelId: state.channelId, named: named.length });
    note('switch-away: fresh 1/512 and E131 target scans are unavailable because the old project target is absent');
    state.projectGeneration += 1;
    await saveState(state);
    return;
  }

  if (named.length !== 1) throw new Error(`${event}: owned fixture is absent or ambiguous`);
  const track = named[0]!;
  if (event === 'saved') {
    check('save keeps the extension and project generation live',
      currentRevision.generation === state.extensionGeneration,
      { before: state.extensionGeneration, after: currentRevision.generation });
    state.project = currentRevision.project;
  } else if (event === 'track-move') {
    check('track move preserves the durable channel identity but changes its address',
      track.channelId === state.channelId && track.index !== state.trackIndex,
      { beforeIndex: state.trackIndex, afterIndex: track.index, channelId: track.channelId });
  } else if (event === 'user-clip-create') {
    const events = currentRevision.contentEvents.filter((item) => item.seq > state.contentEpoch
      && item.channelId === state.channelId && item.filled
      && item.slotIndex !== state.targetRow && item.slotIndex !== CANARY_ROW);
    check('the Bitwig UI clip creation emitted one exact filled address', events.length === 1, events);
    if (events.length !== 1) throw new Error('user clip creation event is absent or ambiguous');
    const row = events[0]!.slotIndex;
    const cached = await observerCache(track.index, row);
    const exact = await authority(track.index, row);
    check('user clip create: cache matches the fresh settled 1/512 scan',
      cached.length === 0 && exact.length === 0,
      { cache: cached.length, authority: exact.length });
    const acquisition = await callTool(workspace, 'acquire_clip_note_source', {
      trackId: track.channelId,
      row,
    }, EXPERIMENTAL_7B_TOOL_PROFILE) as AcquisitionResult;
    note(`user clip create: E131 diagnostic ${acquisition.clip.notes.length === 0 ? 'matches' : 'DIFFERS'}; `
      + `${acquisition.timing.totalMs.toFixed(3)} ms`);
    check('a user-created clip mints a new session-local logical identity',
      row !== state.targetRow,
      { logicalId: 'gnclip-project-2', row });
  } else if (event === 'user-clip-move') {
    const events = currentRevision.contentEvents.filter((item) => item.seq > state.contentEpoch
      && item.channelId === state.channelId);
    const emptied = events.filter((item) => !item.filled && item.slotIndex === state.targetRow);
    const filled = events.filter((item) => item.filled && item.slotIndex !== state.targetRow);
    check('the user clip move emitted one exact empty-fill address pair',
      emptied.length === 1 && filled.length === 1,
      events);
    if (emptied.length !== 1 || filled.length !== 1) {
      throw new Error('user clip move event window is incomplete or ambiguous');
    }
    state.targetRow = filled[0]!.slotIndex;
    check('an exact user move preserves the session-local logical clip ID',
      state.logicalId === 'gnclip-project-1',
      { logicalId: state.logicalId, row: state.targetRow });
  } else {
    state.projectGeneration += 1;
    check(`${event} invalidates the prior local project generation`, state.projectGeneration > 1,
      { projectGeneration: state.projectGeneration });
    if (event === 'controller-reload') {
      check('controller reload changes the extension generation',
        currentRevision.generation !== state.extensionGeneration,
        { before: state.extensionGeneration, after: currentRevision.generation });
    }
  }

  state.expected = await comparePopulated(event, state, track);
  state.project = currentRevision.project;
  state.extensionGeneration = currentRevision.generation;
  state.channelId = track.channelId;
  state.trackIndex = track.index;
  state.contentEpoch = currentRevision.contentEpoch;
  await saveState(state);
}

async function cleanup(): Promise<void> {
  const state = await loadState();
  const current = (await tracks()).filter((item) => item.name === TRACK_NAME);
  if (current.length !== 1) throw new Error('cleanup cannot identify the owned fixture track');
  await bridge.request('track.delete', { trackIndex: current[0]!.index });
  const gone = await pollUntil(async () => !(await tracks()).some((item) => item.name === TRACK_NAME));
  if (!gone.ok) throw new Error('owned project-lifecycle track did not delete');
  const afterTracks = await tracks();
  const afterScan = await scanSummary();
  check('cleanup restores the project baseline track identities',
    stable(afterTracks.map((item) => item.channelId).sort())
      === stable([...state.baselineTrackIds].sort()),
    { before: state.baselineTrackIds, after: afterTracks.map((item) => item.channelId) });
  check('cleanup restores the scene and launcher-content baseline',
    await sceneCount() === state.baselineScenes && afterScan.slotsWithContent === state.baselineSlots,
    { scenes: await sceneCount(), slots: afterScan.slotsWithContent });
  await unlink(STATE_FILE);
}

async function run(): Promise<void> {
  const command = process.argv[2];
  if (command !== 'prepare' && command !== 'verify' && command !== 'cleanup') {
    throw new Error('usage: phase8d-project-lifecycle.ts prepare | verify <event> | cleanup');
  }
  await bridge.connect();
  await exactProfile();
  if (command === 'prepare') await prepare();
  if (command === 'verify') {
    const event = process.argv[3] as EventName | undefined;
    if (event === undefined) throw new Error('verify requires an event name');
    await verify(event);
  }
  if (command === 'cleanup') await cleanup();
}

try {
  await run();
} catch (error) {
  check('E138 project lifecycle command completed without an unexpected failure', false,
    error instanceof Error ? `${error.name}: ${error.message}` : String(error));
} finally {
  try {
    await adapter.close();
  } catch {
    // The primary result is more useful than a second close error.
  }
}

console.log(`\n${failureCount() === 0 ? 'ALL PASS' : `${failureCount()} FAILURE(S)`}`);
process.exit(failureCount() === 0 ? 0 : 1);
