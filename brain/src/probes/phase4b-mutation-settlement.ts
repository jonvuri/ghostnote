/** Phase 4 session 4b follow-up: controlled clip-mutation settlement gate. */
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
import { check, client as bridge, failureCount, note } from './lib.js';

const GATE_MS = 9_000;
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

interface RequestRecord {
  readonly method: string;
  readonly elapsedMs: number;
}

class TimingTransport implements Transport {
  readonly requests: RequestRecord[] = [];

  constructor(private readonly inner: Transport) {}

  async send(frame: Frame): Promise<unknown> {
    const started = performance.now();
    const result = await this.inner.send(frame);
    this.requests.push({ method: frame.method, elapsedMs: performance.now() - started });
    return result;
  }

  close(): Promise<void> {
    return this.inner.close();
  }
}

class CountingAdapter extends LiveAdapter {
  readonly settles = new Map<SettleBudget, number>();

  override async settle(budget: SettleBudget): Promise<void> {
    this.settles.set(budget, (this.settles.get(budget) ?? 0) + 1);
    await super.settle(budget);
  }

  resetCounts(): void {
    this.settles.clear();
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

const phrase = (pitches: readonly (readonly number[])[]) => pitches.flatMap((chord, chordIndex) =>
  chord.map((pitch, noteIndex) => ({
    startBeats: chordIndex * 8,
    pitch,
    velocity: 82 + noteIndex * 3,
    durationBeats: 7.5,
    pan: (noteIndex - 2) * 0.12,
    timbre: 0.2 + noteIndex * 0.08,
    chance: 0.9,
    isChanceEnabled: true,
  })));

const FIRST = phrase([
  [41, 48, 55, 58, 63],
  [43, 50, 53, 58, 65],
  [39, 46, 53, 55, 62],
  [36, 43, 48, 55, 58, 63],
]);
const SECOND = phrase([
  [41, 48, 53, 56, 63],
  [44, 51, 56, 60, 63, 68],
  [46, 53, 58, 62, 68],
  [39, 46, 51, 55, 58, 63],
]);

let ownedTrackId: string | undefined;
let activeChangeId: string | undefined;
let entrySelection: Selection | undefined;
let mcp: Client | undefined;
let server: McpServer | undefined;

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

await bridge.connect();
const timingTransport = new TimingTransport(new BridgeTransport(bridge));
const liveTimings: LiveTimingEvent[] = [];
const executorTimings: ExecutorTimingEvent[] = [];
const adapter = new CountingAdapter({
  transport: timingTransport,
  onTiming: (event) => liveTimings.push(event),
});

try {
  await adapter.hello();
  const project = (await adapter.revision()).project;
  if (project !== '26.05-2 moon') throw new Error(`expected project 26.05-2 moon, got ${project}`);
  entrySelection = await bridge.request('selection.status') as Selection;
  const entryTracks = await bridge.request('track.list') as { readonly tracks: readonly TrackRow[] };

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
  server = new McpServer({ name: 'ghostnote-4b-mutation-settlement', version: '1.0.0' });
  registerTools(server, workspace);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  mcp = new Client({ name: 'phase-4b-mutation-settlement', version: '1.0.0' });
  await server.connect(serverTransport);
  await mcp.connect(clientTransport);
  const call = async (name: string, args: Record<string, unknown> = {}) =>
    parse(await mcp!.callTool({ name, arguments: args }));

  const createdTrack = await call('add_track', { names: ['gn-4b-mutation-settlement'] }) as {
    readonly created?: readonly { readonly trackId?: string }[];
  };
  ownedTrackId = createdTrack.created?.[0]?.trackId;
  if (ownedTrackId === undefined) throw new Error('the scratch track returned no durable id');
  const createdClips = await call('add_clip', {
    clips: [0, 1].map((row) => ({ trackId: ownedTrackId, row, lengthBeats: 32 })),
  });
  activeChangeId = createdClips['changeId'] as string | undefined;

  const samples: Record<string, unknown>[] = [];
  for (let sample = 0; sample < 2; sample += 1) {
    timingTransport.requests.length = 0;
    liveTimings.length = 0;
    executorTimings.length = 0;
    adapter.resetCounts();
    const started = performance.now();
    const result = await call('write_notes', { clips: [
      { trackId: ownedTrackId, row: 0, channel: 0, notes: FIRST },
      { trackId: ownedTrackId, row: 1, channel: 0, notes: SECOND },
    ] });
    const elapsedMs = performance.now() - started;
    const changeId = result['changeId'] as string | undefined;
    activeChangeId = changeId;
    const mismatches = Array.isArray(result['mismatches']) ? result['mismatches'] : [];
    check(`4b-S sample ${sample + 1}: exact write returns no conflict`,
      result['applied'] === true
        && changeId !== undefined
        && mismatches.length === 0,
      {
        applied: result['applied'],
        changeId,
        mismatchCount: mismatches.length,
        mismatches: mismatches.slice(0, 8),
      });
    samples.push({
      elapsedMs: Math.round(elapsedMs),
      requests: timingTransport.requests.length,
      stages: timingTransport.requests.filter((request) => request.method === 'batch.run').length,
      pageTurns: timingTransport.requests.filter((request) => request.method === 'cursor.scrollToStep').length,
      bulkReads: timingTransport.requests.filter((request) =>
        request.method === 'cursor.getNotesVerboseAllChannels').length,
      settles: Object.fromEntries(adapter.settles),
      livePhases: liveTimings.map((event) => event.phase),
      executorPhases: executorTimings.map((event) => event.phase),
    });
    if (changeId !== undefined) {
      const reversed = await call('revert_change', { changeId });
      check(`4b-S sample ${sample + 1}: reversal restores both empty clips`,
        reversed['applied'] === true,
        { applied: reversed['applied'], changeId: reversed['changeId'] });
      activeChangeId = undefined;
    }
  }

  const ordered = samples.map((sample) => sample['elapsedMs'] as number).sort((a, b) => a - b);
  const medianMs = ordered[Math.floor(ordered.length / 2)]!;
  check('4b-S representative write meets the fixed performance gate', medianMs <= GATE_MS, {
    gateMs: GATE_MS, medianMs, samples: ordered,
  });

  const row0 = await call('read_clip', { trackId: ownedTrackId, row: 0 });
  const row1 = await call('read_clip', { trackId: ownedTrackId, row: 1 });
  check('4b-S exact reversal leaves both clips empty',
    (row0['notes'] as unknown[]).length === 0 && (row1['notes'] as unknown[]).length === 0,
    { row0: row0['notes'], row1: row1['notes'] });

  const deleted = await call('delete_track', { trackIds: [ownedTrackId] });
  if (deleted['applied'] === true) ownedTrackId = undefined;
  await restoreEntrySelection();
  const finalTracks = await bridge.request('track.list') as { readonly tracks: readonly TrackRow[] };
  const finalSelection = await bridge.request('selection.status') as Selection;
  check('4b-S cleanup restores the project shape and entry selection',
    ownedTrackId === undefined
      && finalTracks.tracks.length === entryTracks.tracks.length
      && !finalTracks.tracks.some((track) => track.name === 'gn-4b-mutation-settlement')
      && finalSelection.trackIndex === entrySelection.trackIndex
      && finalSelection.slotIndex === entrySelection.slotIndex
      && finalSelection.mixerTrackIndex === entrySelection.mixerTrackIndex,
    { entrySelection, finalSelection, trackCount: finalTracks.tracks.length });

  console.log(JSON.stringify({ baselineMs: 11_444, gateMs: GATE_MS, medianMs, samples }, null, 2));
} catch (error) {
  check('4b-SX: mutation-settlement probe completed without an unexpected failure', false,
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

note(`Phase 4 session 4b mutation settlement: ${failureCount() === 0 ? 'PASS' : 'FAILED'}`);
process.exit(failureCount() === 0 ? 0 : 1);
