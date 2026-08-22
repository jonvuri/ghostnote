/** Phase 4 session 4b follow-up: note-step observer completion evidence. */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { LiveAdapter, type LiveTimingEvent } from '../adapters/live/adapter.js';
import { LiveObservationStore } from '../adapters/live/observation-store.js';
import { BridgeTransport, type Transport } from '../adapters/live/transport.js';
import type { Frame } from '../adapters/live/wiremap.js';
import type { SettleBudget } from '../contract/index.js';
import { Executor, type ExecutorTimingEvent } from '../engine/index.js';
import { Stash } from '../stash/index.js';
import { registerTools } from '../surface/tools.js';
import { workspaceOf } from '../surface/workspace.js';
import {
  classifyObserver, eventIsEligible,
  type CompletionSample, type NoteObserverEvent, type NoteObserverTarget,
} from './phase4b-note-completion-lib.js';
import { check, client as bridge, failureCount, note } from './lib.js';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface TrackRow {
  readonly index: number;
  readonly name: string;
  readonly channelId: string;
}

interface Selection {
  readonly trackIndex: number;
  readonly slotIndex: number;
  readonly mixerTrackIndex?: number;
}

interface ObserverRead {
  readonly generation: number;
  readonly armed: boolean;
  readonly sequence: number;
  readonly dropped: number;
  readonly retained: number;
  readonly events: readonly NoteObserverEvent[];
}

interface ObserverArm extends NoteObserverTarget {
  readonly afterSequence: number;
}

interface WireNote {
  readonly x: number;
  readonly y: number;
  readonly channel: number;
  readonly state?: string;
  readonly [property: string]: unknown;
}

interface AllChannelRead {
  readonly channels: readonly {
    readonly channel: number;
    readonly notes: readonly WireNote[];
    readonly count: number;
  }[];
  readonly count: number;
  readonly scanMicros: number;
}

interface RequestRecord {
  readonly method: string;
  readonly elapsedMs: number;
  readonly scanMicros?: number;
}

class TimingTransport implements Transport {
  readonly requests: RequestRecord[] = [];

  constructor(private readonly inner: Transport) {}

  async send(frame: Frame): Promise<unknown> {
    const startedAt = performance.now();
    const result = await this.inner.send(frame);
    const scanMicros = (result as { scanMicros?: unknown } | undefined)?.scanMicros;
    this.requests.push({
      method: frame.method,
      elapsedMs: performance.now() - startedAt,
      ...(typeof scanMicros === 'number' ? { scanMicros } : {}),
    });
    return result;
  }

  close(): Promise<void> {
    return this.inner.close();
  }
}

class CountingLiveAdapter extends LiveAdapter {
  readonly settleCounts = new Map<SettleBudget, number>();

  override async settle(budget: SettleBudget): Promise<void> {
    this.settleCounts.set(budget, (this.settleCounts.get(budget) ?? 0) + 1);
    await super.settle(budget);
  }

  resetSettles(): void {
    this.settleCounts.clear();
  }
}

const parse = (value: unknown): Record<string, unknown> => {
  const result = value as {
    readonly isError?: boolean;
    readonly content?: readonly { readonly type: string; readonly text?: string }[];
  };
  const content = result.content?.find((item) => item.type === 'text')?.text;
  if (result.isError === true || content === undefined) {
    throw new Error(content ?? 'the public call failed');
  }
  return JSON.parse(content) as Record<string, unknown>;
};

const percentile = (samples: readonly number[], fraction: number): number => {
  const ordered = [...samples].sort((left, right) => left - right);
  return ordered[Math.min(ordered.length - 1, Math.floor(ordered.length * fraction))]!;
};

const requestCount = (requests: readonly RequestRecord[], method: string): number =>
  requests.filter((request) => request.method === method).length;

const noteAt = (read: AllChannelRead, channel: number, x: number, y: number): WireNote | undefined =>
  read.channels.find((entry) => entry.channel === channel)?.notes
    .find((entry) => entry.x === x && entry.y === y);

const closeTo = (left: unknown, right: number, tolerance = 0.003): boolean =>
  typeof left === 'number' && Math.abs(left - right) <= tolerance;

let ownedTrackId: string | undefined;
let ownedTrackIndex: number | undefined;
let activeChangeId: string | undefined;
let entrySelection: Selection | undefined;
let mcp: Client | undefined;
let server: McpServer | undefined;
const liveTimings: LiveTimingEvent[] = [];
const executorTimings: ExecutorTimingEvent[] = [];
const completionSamples: CompletionSample[] = [];
const completionRecords: Record<string, unknown>[] = [];

async function cursorStatus(cursor: string): Promise<Record<string, unknown>> {
  return await bridge.request('cursor.status', { cursor }) as Record<string, unknown>;
}

async function pointAndPin(cursor: string, trackIndex: number, slotIndex: number): Promise<void> {
  await bridge.request('cursor.pin', { cursor, pinned: false });
  await bridge.request('cursor.pinTrack', { cursor, pinned: false });
  await bridge.request('cursor.pointTrack', { cursor, trackIndex });
  await bridge.request('slot.select', { trackIndex, slotIndex, mechanism: 'track' });
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await wait(attempt === 0 ? 25 : 144);
    const status = await cursorStatus(cursor);
    if (status['exists'] === true
        && status['trackPosition'] === trackIndex
        && status['sceneIndex'] === slotIndex) break;
    if (attempt === 7) throw new Error(`${cursor} did not point at ${trackIndex}:${slotIndex}`);
  }
  await bridge.request('cursor.pinTrack', { cursor, pinned: true });
  await bridge.request('cursor.pin', { cursor, pinned: true });
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await wait(attempt === 0 ? 25 : 144);
    const status = await cursorStatus(cursor);
    if (status['trackPosition'] === trackIndex
        && status['sceneIndex'] === slotIndex
        && status['cursorTrackPinned'] === true
        && status['isPinned'] === true) return;
  }
  throw new Error(`${cursor} did not confirm its pinned target`);
}

async function setView(cursor: string, grid: number, page = 0): Promise<void> {
  await bridge.request('cursor.setStepSize', { cursor, stepSize: grid });
  await bridge.request('cursor.scrollToStep', { cursor, step: page });
  await wait(144);
}

async function restoreEntrySelection(): Promise<void> {
  if (entrySelection?.mixerTrackIndex === undefined) return;
  await bridge.request('cursor.pin', { cursor: 'fine', pinned: false });
  await bridge.request('cursor.pinTrack', { cursor: 'fine', pinned: false });
  await bridge.request('cursor.pointTrack', {
    cursor: 'fine', trackIndex: entrySelection.mixerTrackIndex,
  });
  await bridge.request('slot.select', {
    trackIndex: entrySelection.trackIndex,
    slotIndex: entrySelection.slotIndex,
    mechanism: 'track',
  });
  await wait(150);
  await bridge.request('cursor.pinTrack', { cursor: 'fine', pinned: true });
  await bridge.request('cursor.pin', { cursor: 'fine', pinned: true });
}

async function observerRead(afterSequence = 0): Promise<ObserverRead> {
  return await bridge.request('note.observer.read', { afterSequence }) as ObserverRead;
}

async function armObserver(
  trackId: string,
  trackIndex: number,
  slotIndex: number,
  grid: number,
): Promise<ObserverArm> {
  const prepared = await bridge.request('note.observer.prepare') as {
    readonly generation: number;
    readonly afterSequence: number;
  };
  await pointAndPin('observer', trackIndex, slotIndex);
  await setView('observer', grid);
  const armed = await bridge.request('note.observer.arm', {
    generation: prepared.generation, trackId, trackIndex, slotIndex,
  }) as { readonly afterSequence: number };
  return { generation: prepared.generation, trackId, trackIndex, slotIndex,
    afterSequence: armed.afterSequence };
}

async function readExact(maxX = 256): Promise<AllChannelRead> {
  return await bridge.request('cursor.getNotesVerboseAllChannels', {
    cursor: 'fine', maxX,
  }) as AllChannelRead;
}

async function cleanClip(cursor = '0'): Promise<void> {
  await bridge.request('cursor.clearNotes', { cursor });
  await wait(25);
}

async function measureMutation(
  label: string,
  arm: ObserverArm,
  mutate: () => Promise<unknown>,
  complete: (read: AllChannelRead) => boolean,
  maxX = 256,
): Promise<Record<string, unknown>> {
  const startedAt = performance.now();
  await mutate();
  const mutationReturnedMs = performance.now() - startedAt;
  let events: readonly NoteObserverEvent[] = [];
  let matching: readonly NoteObserverEvent[] = [];
  let firstReadAfterCallbackComplete: boolean | undefined;
  let exactReadCompleted = false;
  let exactReadMs: number | undefined;
  let readAttempts = 0;
  const deadline = performance.now() + 4_000;
  while (performance.now() < deadline) {
    const observed = await observerRead(arm.afterSequence);
    events = observed.events;
    matching = events.filter((event) => eventIsEligible(event, arm));
    const shouldRead = matching.length > 0 || performance.now() - startedAt >= 400;
    if (shouldRead) {
      readAttempts++;
      const read = await readExact(maxX);
      const done = complete(read);
      if (matching.length > 0 && firstReadAfterCallbackComplete === undefined) {
        firstReadAfterCallbackComplete = done;
      }
      if (done) {
        exactReadCompleted = true;
        exactReadMs = performance.now() - startedAt;
        break;
      }
    }
    await wait(10);
  }
  const sample = {
    matchingCallbacks: matching.length,
    exactReadCompleted,
    callbackBeforeCompleteRead: firstReadAfterCallbackComplete === false,
  } satisfies CompletionSample;
  completionSamples.push(sample);
  const record = {
    label,
    mutationReturnedMs: Math.round(mutationReturnedMs),
    matchingCallbacks: matching.length,
    callbackSequences: matching.map((event) => event.sequence),
    firstCallbackMs: matching[0]?.sinceArmMicros === undefined
      ? undefined : Math.round(matching[0].sinceArmMicros / 1000),
    firstReadAfterCallbackComplete,
    exactReadCompleted,
    exactReadMs: exactReadMs === undefined ? undefined : Math.round(exactReadMs),
    readAttempts,
    allEvents: events.length,
  };
  completionRecords.push(record);
  check(`4b-N ${label}: exact readback reaches the expected state`, exactReadCompleted, record);
  return record;
}

async function measureBoundary(
  label: string,
  change: () => Promise<void>,
): Promise<Record<string, unknown>> {
  const prepared = await bridge.request('note.observer.prepare') as {
    readonly generation: number;
    readonly afterSequence: number;
  };
  await change();
  await wait(180);
  const read = await observerRead(prepared.afterSequence);
  const eligible = read.events.filter((event) => event.armed);
  const result = { label, callbacks: read.events.length, eligible: eligible.length };
  check(`4b-N ${label}: setup callbacks stay unarmed`, eligible.length === 0, result);
  return result;
}

async function runPropertyMatrix(
  gridName: string,
  grid: number,
  x: number,
  channel: number,
  pitch: number,
): Promise<Record<string, unknown>[]> {
  if (ownedTrackId === undefined || ownedTrackIndex === undefined) throw new Error('scratch target missing');
  await cleanClip();
  await setView('0', grid);
  await setView('fine', grid);
  await bridge.request('cursor.setNotes', {
    cursor: '0', channel, notes: [[x, pitch, 100, grid * 2]],
  });
  await wait(25);
  const cases: readonly {
    readonly name: string;
    readonly props: Record<string, unknown>;
    readonly matches: (note: WireNote) => boolean;
  }[] = [
    { name: 'velocity', props: { velocity: 0.61 }, matches: (n) => closeTo(n.velocity, 0.61) },
    { name: 'releaseVelocity', props: { releaseVelocity: 0.37 }, matches: (n) => closeTo(n.releaseVelocity, 0.37) },
    { name: 'velocitySpread', props: { velocitySpread: 0.22 }, matches: (n) => closeTo(n.velocitySpread, 0.22) },
    { name: 'duration', props: { duration: grid * 3 }, matches: (n) => closeTo(n.duration, grid * 3) },
    { name: 'gain', props: { gain: 0.35 }, matches: (n) => closeTo(n.gain, 0.7) },
    { name: 'pan', props: { pan: -0.4 }, matches: (n) => closeTo(n.pan, -0.4) },
    { name: 'timbre', props: { timbre: 0.55 }, matches: (n) => closeTo(n.timbre, 0.55) },
    { name: 'transpose', props: { transpose: 2.5 }, matches: (n) => closeTo(n.transpose, 2.5) },
    { name: 'chance', props: { chance: 0.63 }, matches: (n) => closeTo(n.chance, 0.63) },
    { name: 'isChanceEnabled', props: { isChanceEnabled: true }, matches: (n) => n.isChanceEnabled === true },
    { name: 'isMuted', props: { isMuted: true }, matches: (n) => n.isMuted === true },
    { name: 'isOccurrenceEnabled', props: { isOccurrenceEnabled: true }, matches: (n) => n.isOccurrenceEnabled === true },
    { name: 'occurrence', props: { occurrence: 'FILL' }, matches: (n) => n.occurrence === 'FILL' },
    { name: 'isRecurrenceEnabled', props: { isRecurrenceEnabled: true }, matches: (n) => n.isRecurrenceEnabled === true },
    { name: 'recurrence', props: { recurrence: [4, 5] }, matches: (n) => n.recurrenceLength === 4 && n.recurrenceMask === 5 },
    { name: 'isRepeatEnabled', props: { isRepeatEnabled: true }, matches: (n) => n.isRepeatEnabled === true },
    { name: 'repeatCount', props: { repeatCount: 3 }, matches: (n) => n.repeatCount === 3 },
    { name: 'repeatCurve', props: { repeatCurve: 0.2 }, matches: (n) => closeTo(n.repeatCurve, 0.2) },
    { name: 'repeatVelocityCurve', props: { repeatVelocityCurve: -0.3 }, matches: (n) => closeTo(n.repeatVelocityCurve, -0.3) },
    { name: 'repeatVelocityEnd', props: { repeatVelocityEnd: 0.6 }, matches: (n) => closeTo(n.repeatVelocityEnd, 0.6) },
  ];
  const results: Record<string, unknown>[] = [];
  for (const property of cases) {
    const arm = await armObserver(ownedTrackId, ownedTrackIndex, 0, grid);
    results.push(await measureMutation(
      `${gridName} property ${property.name}`,
      arm,
      () => bridge.request('cursor.setNoteProps', {
        cursor: '0', channel, x, y: pitch, props: property.props,
      }),
      (read) => {
        const found = noteAt(read, channel, x, pitch);
        return found !== undefined && property.matches(found);
      },
      Math.max(64, x + 2),
    ));
  }
  return results;
}

await bridge.connect();
const timingTransport = new TimingTransport(new BridgeTransport(bridge));
const adapter = new CountingLiveAdapter({
  transport: timingTransport,
  onTiming: (event) => liveTimings.push(event),
});

try {
  await adapter.hello();
  const project = (await adapter.revision()).project;
  if (project !== '26.05-2 moon') {
    throw new Error(`expected project 26.05-2 moon, got ${project}`);
  }
  const methods = await bridge.request('rig.methods') as { readonly methods: readonly string[] };
  for (const required of [
    'cursor.clearNote', 'cursor.moveNote', 'note.observer.prepare',
    'note.observer.arm', 'note.observer.read',
  ]) {
    if (!methods.methods.includes(required)) throw new Error(`the live extension lacks ${required}`);
  }
  entrySelection = await bridge.request('selection.status') as Selection;
  const entryTracks = await bridge.request('track.list') as { readonly tracks: readonly TrackRow[] };
  const entryObserver = await observerRead();
  const rigStats = await bridge.request('rig.stats') as Record<string, unknown>;

  const executor = new Executor(adapter, { onTiming: (event) => executorTimings.push(event) });
  const workspace = workspaceOf({
    ready: async () => undefined,
    adapter,
    executor,
    stash: new Stash(),
    observationStore: new LiveObservationStore({
      transport: timingTransport,
      projectName: async () => (await adapter.revision()).project,
    }),
  });
  server = new McpServer({ name: 'ghostnote-4b-note-completion', version: '1.0.0' });
  registerTools(server, workspace);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  mcp = new Client({ name: 'phase-4b-note-completion', version: '1.0.0' });
  await server.connect(serverTransport);
  await mcp.connect(clientTransport);
  const call = async (name: string, args: Record<string, unknown> = {}) =>
    parse(await mcp!.callTool({ name, arguments: args }));

  const createdTrack = await call('add_track', { names: ['gn-4b-note-observer'] }) as {
    readonly created?: readonly { readonly trackId?: string }[];
  };
  ownedTrackId = createdTrack.created?.[0]?.trackId;
  if (ownedTrackId === undefined) throw new Error('the scratch track did not return a durable id');
  const withScratch = await bridge.request('track.list') as { readonly tracks: readonly TrackRow[] };
  ownedTrackIndex = withScratch.tracks.find((track) => track.channelId === ownedTrackId)?.index;
  if (ownedTrackIndex === undefined) throw new Error('the scratch track is not in the full window');
  const createdClips = await call('add_clip', {
    clips: [0, 1].map((row) => ({ trackId: ownedTrackId, row, lengthBeats: 32 })),
  });
  activeChangeId = createdClips['changeId'] as string | undefined;
  if (activeChangeId === undefined) throw new Error('scratch clip creation returned no change id');

  await pointAndPin('0', ownedTrackIndex, 0);
  await pointAndPin('1', ownedTrackIndex, 1);
  await pointAndPin('fine', ownedTrackIndex, 0);

  const boundaries: Record<string, unknown>[] = [];
  boundaries.push(await measureBoundary('point', async () => {
    await pointAndPin('observer', ownedTrackIndex!, 0);
  }));
  boundaries.push(await measureBoundary('pin', async () => {
    await bridge.request('cursor.pin', { cursor: 'observer', pinned: false });
    await bridge.request('cursor.pin', { cursor: 'observer', pinned: true });
  }));
  boundaries.push(await measureBoundary('grid', async () => {
    await bridge.request('cursor.setStepSize', { cursor: 'observer', stepSize: 1 / 6 });
  }));
  boundaries.push(await measureBoundary('page', async () => {
    await bridge.request('cursor.scrollToStep', { cursor: 'observer', step: 1 });
    await bridge.request('cursor.scrollToStep', { cursor: 'observer', step: 0 });
  }));

  // Measure the existing mutation path before observer-assisted product work.
  const baseline: Record<string, unknown>[] = [];
  const basicNote = (index: number) => ({
    startBeats: index * 0.25,
    pitch: 36 + (index % 48),
    velocity: 90,
    durationBeats: 0.25,
  });
  const baselineCases = [
    { name: '1-basic', clips: [{ trackId: ownedTrackId, row: 0, channel: 0, notes: [basicNote(0)] }] },
    { name: '16-basic', clips: [{ trackId: ownedTrackId, row: 0, channel: 0,
      notes: Array.from({ length: 16 }, (_, index) => basicNote(index)) }] },
    { name: '64-basic', clips: [{ trackId: ownedTrackId, row: 0, channel: 0,
      notes: Array.from({ length: 64 }, (_, index) => basicNote(index)) }] },
    { name: '16-expression', clips: [{ trackId: ownedTrackId, row: 0, channel: 0,
      notes: Array.from({ length: 16 }, (_, index) => ({ ...basicNote(index), pan: -0.25, timbre: 0.4 })) }] },
    { name: '4-writer-pages', clips: [{ trackId: ownedTrackId, row: 0, channel: 0,
      notes: [0, 1, 2, 3].map((page) => ({
        startBeats: page * 8 + page / 64,
        pitch: 60 + page,
        velocity: 90,
        durationBeats: 1 / 64,
        pan: page / 10,
      })) }] },
    { name: '2-clips-basic', clips: [0, 1].map((row) => ({
      trackId: ownedTrackId, row, channel: 0, notes: [basicNote(row)],
    })) },
    { name: '2-clips-expression', clips: [0, 1].map((row) => ({
      trackId: ownedTrackId, row, channel: 0, notes: [{ ...basicNote(row), pan: row === 0 ? -0.4 : 0.4 }],
    })) },
  ];
  for (const testCase of baselineCases) {
    await pointAndPin('0', ownedTrackIndex, 0);
    await cleanClip('0');
    await pointAndPin('0', ownedTrackIndex, 1);
    await cleanClip('0');
    timingTransport.requests.length = 0;
    liveTimings.length = 0;
    executorTimings.length = 0;
    adapter.resetSettles();
    const startedAt = performance.now();
    const written = await call('write_notes', { clips: testCase.clips });
    const elapsedMs = performance.now() - startedAt;
    const changeId = written['changeId'] as string | undefined;
    const requests = [...timingTransport.requests];
    baseline.push({
      name: testCase.name,
      elapsedMs: Math.round(elapsedMs),
      requestCount: requests.length,
      stages: requestCount(requests, 'batch.run'),
      pageTurns: requestCount(requests, 'cursor.scrollToStep'),
      bulkReads: requestCount(requests, 'cursor.getNotesVerboseAllChannels'),
      fixedSettles: Object.fromEntries(adapter.settleCounts),
      verificationPasses: executorTimings.filter((event) => event.phase === 'verification').length,
      verificationMs: Math.round(executorTimings
        .filter((event) => event.phase === 'verification')
        .reduce((sum, event) => sum + event.elapsedMs, 0)),
    });
    check(`4b-N baseline ${testCase.name} applies and returns a reversible change`,
      written['applied'] === true && changeId !== undefined, written);
    if (changeId !== undefined) await call('revert_change', { changeId });
  }

  // Return all three evidence handles to row 0 and the binary grid.
  await pointAndPin('0', ownedTrackIndex, 0);
  await pointAndPin('fine', ownedTrackIndex, 0);
  await cleanClip();
  await setView('0', 0.25);
  await setView('fine', 0.25);

  let arm = await armObserver(ownedTrackId, ownedTrackIndex, 0, 0.25);
  await measureMutation('binary add', arm,
    () => bridge.request('cursor.setNotes', { cursor: '0', channel: 0, notes: [[0, 60, 100, 0.5]] }),
    (read) => noteAt(read, 0, 0, 60) !== undefined);

  arm = await armObserver(ownedTrackId, ownedTrackIndex, 0, 0.25);
  await measureMutation('single clear', arm,
    () => bridge.request('cursor.clearNote', { cursor: '0', channel: 0, x: 0, y: 60 }),
    (read) => noteAt(read, 0, 0, 60) === undefined);

  await bridge.request('cursor.setNotes', { cursor: '0', channel: 2, notes: [[2, 62, 100, 0.5]] });
  await wait(25);
  arm = await armObserver(ownedTrackId, ownedTrackIndex, 0, 0.25);
  await measureMutation('move', arm,
    () => bridge.request('cursor.moveNote', { cursor: '0', channel: 2, x: 2, y: 62, dx: 2, dy: 1 }),
    (read) => noteAt(read, 2, 2, 62) === undefined && noteAt(read, 2, 4, 63) !== undefined);

  arm = await armObserver(ownedTrackId, ownedTrackIndex, 0, 0.25);
  await measureMutation('full clear', arm,
    () => bridge.request('cursor.clearNotes', { cursor: '0' }),
    (read) => read.count === 0);

  const allChannelOps = Array.from({ length: 16 }, (_, channel) => ({
    method: 'cursor.setNotes',
    params: { cursor: '0', channel, notes: [[8 + channel, 48 + channel, 90, 0.25]] },
  }));
  arm = await armObserver(ownedTrackId, ownedTrackIndex, 0, 0.25);
  await measureMutation('all 16 MIDI channels in one turn', arm,
    () => bridge.request('batch.run', { ops: allChannelOps, verbose: true }),
    (read) => read.count === 16 && Array.from({ length: 16 }, (_, channel) =>
      noteAt(read, channel, 8 + channel, 48 + channel) !== undefined).every(Boolean));
  await cleanClip();

  await setView('0', 1 / 6);
  await setView('fine', 1 / 6);
  arm = await armObserver(ownedTrackId, ownedTrackIndex, 0, 1 / 6);
  await measureMutation('triplet position on channel 15', arm,
    () => bridge.request('cursor.setNotes', { cursor: '0', channel: 15, notes: [[191, 72, 100, 1 / 3]] }),
    (read) => noteAt(read, 15, 191, 72) !== undefined,
    192);
  await cleanClip();

  await setView('0', 0.25);
  await setView('fine', 0.25);
  arm = await armObserver(ownedTrackId, ownedTrackIndex, 0, 0.25);
  await measureMutation('32-beat binary edge', arm,
    () => bridge.request('cursor.setNotes', { cursor: '0', channel: 4, notes: [[127, 67, 100, 0.25]] }),
    (read) => noteAt(read, 4, 127, 67) !== undefined,
    128);
  await cleanClip();

  await setView('0', 1 / 64);
  await setView('fine', 1 / 64);
  const pageOps = [0, 512, 1024, 1536].flatMap((page, index) => [
    { method: 'cursor.scrollToStep', params: { cursor: '0', step: page } },
    { method: 'cursor.setNotes', params: { cursor: '0', channel: index, notes: [[index, 60 + index, 100, 1 / 64]] } },
  ]).concat([{ method: 'cursor.scrollToStep', params: { cursor: '0', step: 0 } }]);
  arm = await armObserver(ownedTrackId, ownedTrackIndex, 0, 1 / 64);
  await measureMutation('four writer pages in one turn', arm,
    () => bridge.request('batch.run', { ops: pageOps, verbose: true }),
    (read) => read.count === 4 && [0, 1, 2, 3].every((index) =>
      noteAt(read, index, index * 512 + index, 60 + index) !== undefined),
    2048);
  await cleanClip();

  const propertyBinary = await runPropertyMatrix('binary', 0.25, 24, 7, 70);
  const propertyTriplet = await runPropertyMatrix('triplet', 1 / 6, 30, 9, 74);
  await cleanClip();

  // An edit on row 1 must not wake the row-0 generation.
  await setView('0', 0.25);
  await setView('1', 0.25);
  await setView('fine', 0.25);
  arm = await armObserver(ownedTrackId, ownedTrackIndex, 0, 0.25);
  await bridge.request('cursor.setNotes', { cursor: '1', channel: 0, notes: [[0, 80, 100, 0.25]] });
  await wait(180);
  const unrelatedRead = await observerRead(arm.afterSequence);
  const unrelatedEligible = unrelatedRead.events.filter((event) => eventIsEligible(event, arm));
  check('4b-N unrelated edit does not produce an eligible target event',
    unrelatedEligible.length === 0, { events: unrelatedRead.events.length, eligible: unrelatedEligible.length });
  await cleanClip('1');

  // A same-target foreign edit may wake the reader, but the extra note is visible.
  await pointAndPin('1', ownedTrackIndex, 0);
  await cleanClip('0');
  arm = await armObserver(ownedTrackId, ownedTrackIndex, 0, 0.25);
  await bridge.request('batch.run', { ops: [
    { method: 'cursor.setNotes', params: { cursor: '0', channel: 0, notes: [[0, 60, 100, 0.25]] } },
    { method: 'cursor.setNotes', params: { cursor: '1', channel: 0, notes: [[1, 61, 100, 0.25]] } },
  ], verbose: true });
  await wait(25);
  const sameTargetEvents = (await observerRead(arm.afterSequence)).events
    .filter((event) => eventIsEligible(event, arm));
  const sameTargetExact = await readExact(64);
  const sameTargetConflict = sameTargetExact.count === 2
    && noteAt(sameTargetExact, 0, 0, 60) !== undefined
    && noteAt(sameTargetExact, 0, 1, 61) !== undefined;
  check('4b-N same-target activity cannot report false completion',
    sameTargetEvents.length > 0 && sameTargetConflict,
    { callbacks: sameTargetEvents.length, exactCount: sameTargetExact.count });
  await cleanClip();

  // A new generation invalidates all events from the previous target.
  const preparedNext = await bridge.request('note.observer.prepare') as {
    readonly generation: number;
    readonly afterSequence: number;
  };
  await pointAndPin('observer', ownedTrackIndex, 1);
  await setView('observer', 0.25);
  const nextArmReply = await bridge.request('note.observer.arm', {
    generation: preparedNext.generation,
    trackId: ownedTrackId,
    trackIndex: ownedTrackIndex,
    slotIndex: 1,
  }) as { readonly afterSequence: number };
  await pointAndPin('0', ownedTrackIndex, 0);
  await bridge.request('cursor.setNotes', { cursor: '0', channel: 0, notes: [[3, 63, 100, 0.25]] });
  await wait(180);
  const nextTarget: ObserverTargetWithSequence = {
    generation: preparedNext.generation,
    trackId: ownedTrackId,
    trackIndex: ownedTrackIndex,
    slotIndex: 1,
    afterSequence: nextArmReply.afterSequence,
  };
  const nextEvents = (await observerRead(nextArmReply.afterSequence)).events;
  const nextEligible = nextEvents.filter((event) => eventIsEligible(event, nextTarget));
  check('4b-N stale-target events cannot enter the new generation',
    nextEligible.length === 0,
    { eventsAfterNewArm: nextEvents.length, nextEligible: nextEligible.length });
  await cleanClip();

  // Compare one observer cursor with the accepted D7 latency boundary.
  const pingSamples: number[] = [];
  for (let sample = 0; sample < 30; sample += 1) {
    const startedAt = performance.now();
    await bridge.request('ping');
    pingSamples.push(performance.now() - startedAt);
  }
  const scale = {
    rigStats,
    entryObserver: {
      callbacks: entryObserver.events.length,
      retained: entryObserver.retained,
      dropped: entryObserver.dropped,
    },
    pingP50Ms: Number(percentile(pingSamples, 0.5).toFixed(2)),
    pingP95Ms: Number(percentile(pingSamples, 0.95).toFixed(2)),
    pingMaxMs: Number(Math.max(...pingSamples).toFixed(2)),
  };
  check('4b-N observer scaffold keeps control-thread latency below 100 ms',
    scale.pingMaxMs < 100, scale);

  await pointAndPin('0', ownedTrackIndex, 0);
  await cleanClip();
  await pointAndPin('0', ownedTrackIndex, 1);
  await cleanClip();
  const deleted = await call('delete_track', { trackIds: [ownedTrackId] });
  if (deleted['applied'] === true) {
    ownedTrackId = undefined;
    activeChangeId = undefined;
  }
  // A track delete selects the row that replaces it. Restore after deletion.
  await restoreEntrySelection();
  const finalTracks = await bridge.request('track.list') as { readonly tracks: readonly TrackRow[] };
  const finalSelection = await bridge.request('selection.status') as Selection;
  check('4b-N scratch cleanup and selection restore the entry state',
    ownedTrackId === undefined
      && finalTracks.tracks.length === entryTracks.tracks.length
      && !finalTracks.tracks.some((track) => track.name === 'gn-4b-note-observer')
      && finalSelection.trackIndex === entrySelection.trackIndex
      && finalSelection.slotIndex === entrySelection.slotIndex
      && finalSelection.mixerTrackIndex === entrySelection.mixerTrackIndex,
    { entrySelection, finalSelection, trackCount: finalTracks.tracks.length });

  console.log(JSON.stringify({
    baseline,
    setupCallbacks: { entryRetained: entryObserver.events.length, boundaries },
    completion: {
      classification: {
        overall: classifyObserver(completionSamples),
        eventProducingOperations: 'wake-hint',
        silentBooleanEnables: 'unusable',
      },
      records: completionRecords,
      propertyBinary: propertyBinary.length,
      propertyTriplet: propertyTriplet.length,
      callbackCoverage: completionSamples.filter((sample) => sample.matchingCallbacks > 0).length,
      sampleCount: completionSamples.length,
    },
    interference: {
      unrelatedEligible: unrelatedEligible.length,
      sameTargetCallbacks: sameTargetEvents.length,
      sameTargetConflict,
      nextEligible: nextEligible.length,
    },
    scale,
  }, null, 2));
} catch (error) {
  check('4b-NX: the note-completion probe completed without an unexpected failure', false,
    error instanceof Error ? `${error.name}: ${error.message}` : String(error));
} finally {
  if (mcp !== undefined && activeChangeId !== undefined) {
    try { await mcp.callTool({ name: 'revert_change', arguments: { changeId: activeChangeId } }); } catch {}
  }
  if (mcp !== undefined && ownedTrackId !== undefined) {
    try { await mcp.callTool({ name: 'delete_track', arguments: { trackIds: [ownedTrackId] } }); } catch {}
  }
  try { await restoreEntrySelection(); } catch {}
  await mcp?.close();
  await server?.close();
  bridge.disconnect();
}

note(`Phase 4 session 4b note completion: ${failureCount() === 0 ? 'PASS' : 'FAILED'}`);
process.exit(failureCount() === 0 ? 0 : 1);

interface ObserverTargetWithSequence extends NoteObserverTarget {
  readonly afterSequence: number;
}
