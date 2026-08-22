/** Phase 4 session 4b: exact-read latency and bulk-page fidelity. */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { LiveAdapter, type LiveTimingEvent } from '../adapters/live/adapter.js';
import { LiveObservationStore } from '../adapters/live/observation-store.js';
import { BridgeTransport, type Transport } from '../adapters/live/transport.js';
import type { Frame } from '../adapters/live/wiremap.js';
import { Executor, type ExecutorTimingEvent } from '../engine/index.js';
import { Stash } from '../stash/index.js';
import { registerTools } from '../surface/tools.js';
import { workspaceOf } from '../surface/workspace.js';
import { check, client as bridge, failureCount, note } from './lib.js';

interface TrackRow {
  readonly index: number;
  readonly name: string;
  readonly channelId: string;
}

interface RequestTiming {
  readonly method: string;
  readonly elapsedMs: number;
  readonly scanMicros?: number;
}

class TimingTransport implements Transport {
  readonly requests: RequestTiming[] = [];

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

const parse = (value: unknown): Record<string, unknown> => {
  const result = value as {
    readonly isError?: boolean;
    readonly content?: readonly { readonly type: string; readonly text?: string }[];
  };
  const text = result.content?.find((item) => item.type === 'text')?.text;
  if (result.isError === true || text === undefined) throw new Error(text ?? 'the public call failed');
  return JSON.parse(text) as Record<string, unknown>;
};

const sumByPhase = <T extends { readonly phase: string; readonly elapsedMs: number }>(
  events: readonly T[],
): Record<string, number> => {
  const result: Record<string, number> = {};
  for (const event of events) result[event.phase] = (result[event.phase] ?? 0) + event.elapsedMs;
  return Object.fromEntries(Object.entries(result).map(([key, value]) => [key, Math.round(value)]));
};

const liveTimings: LiveTimingEvent[] = [];
const executorTimings: ExecutorTimingEvent[] = [];
let ownedTrackId: string | undefined;
let activeChangeId: string | undefined;
let mcp: Client | undefined;
let server: McpServer | undefined;
let entrySelection: {
  readonly trackIndex: number;
  readonly slotIndex: number;
  readonly mixerTrackIndex?: number;
} | undefined;

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
  await new Promise((resolve) => setTimeout(resolve, 150));
  await bridge.request('cursor.pinTrack', { cursor: 'fine', pinned: true });
  await bridge.request('cursor.pin', { cursor: 'fine', pinned: true });
}

await bridge.connect();
const transport = new TimingTransport(new BridgeTransport(bridge));
const adapter = new LiveAdapter({ transport, onTiming: (event) => liveTimings.push(event) });

try {
  await adapter.hello();
  const executor = new Executor(adapter, { onTiming: (event) => executorTimings.push(event) });
  const workspace = workspaceOf({
    ready: async () => undefined,
    adapter,
    executor,
    stash: new Stash(),
    observationStore: new LiveObservationStore({
      transport,
      projectName: async () => (await adapter.revision()).project,
    }),
  });
  server = new McpServer({ name: 'ghostnote-4b-clip-latency', version: '1.0.0' });
  registerTools(server, workspace);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  mcp = new Client({ name: 'phase-4b-clip-latency', version: '1.0.0' });
  await server.connect(serverTransport);
  await mcp.connect(clientTransport);
  const call = async (name: string, args: Record<string, unknown> = {}) =>
    parse(await mcp!.callTool({ name, arguments: args }));

  const connection = await call('check_connection');
  if (connection['project'] !== '26.05-2 moon') {
    throw new Error(`expected project 26.05-2 moon, got ${String(connection['project'])}`);
  }
  entrySelection = await bridge.request('selection.status') as {
    readonly trackIndex: number;
    readonly slotIndex: number;
    readonly mixerTrackIndex?: number;
  };
  const listed = await bridge.request('track.list') as { readonly tracks: readonly TrackRow[] };
  const accepted = listed.tracks.find((track) => track.name === 'Harmony – Open Minor');
  if (accepted === undefined) throw new Error('the accepted Harmony – Open Minor track is absent');

  const reads: Record<string, unknown>[] = [];
  for (let sample = 0; sample < 3; sample += 1) {
    transport.requests.length = 0;
    liveTimings.length = 0;
    const startedAt = performance.now();
    const result = await call('read_clip', {
      trackId: accepted.channelId,
      row: 5,
      channel: 0,
    });
    const elapsedMs = performance.now() - startedAt;
    const notes = result['notes'] as readonly unknown[];
    const phases = sumByPhase(liveTimings);
    const namedMs = Object.values(phases).reduce((sum, value) => sum + value, 0);
    reads.push({
      elapsedMs: Math.round(elapsedMs),
      noteCount: notes.length,
      requestCount: transport.requests.length,
      bulkPageRequests: transport.requests.filter((entry) =>
        entry.method === 'cursor.getNotesVerboseAllChannels').length,
      hostScanMs: Math.round(transport.requests.reduce((sum, entry) =>
        sum + (entry.scanMicros ?? 0) / 1000, 0)),
      phases,
      coordinatorRemainderMs: Math.max(0, Math.round(elapsedMs - namedMs)),
    });
  }
  check('4b-L1: three exact 32-beat reads preserve the accepted 21-note result',
    reads.every((sample) => sample['noteCount'] === 21), reads);
  check('4b-L2: each long read uses seven bulk page requests, not 112 channel requests',
    reads.every((sample) => sample['bulkPageRequests'] === 7), reads);
  const medianReadMs = [...reads]
    .map((sample) => sample['elapsedMs'] as number)
    .sort((left, right) => left - right)[1]!;
  check('4b-L3: the median exact read is at most half of the 5323 ms live baseline',
    medianReadMs <= 5323 / 2, { baselineMedianMs: 5323, medianReadMs, reads });

  const createdTrack = await call('add_track', { names: ['gn-4b-latency'] }) as {
    readonly created?: readonly { readonly trackId?: string }[];
  };
  ownedTrackId = createdTrack.created?.[0]?.trackId;
  if (ownedTrackId === undefined) throw new Error('the scratch track did not return a durable id');

  transport.requests.length = 0;
  liveTimings.length = 0;
  executorTimings.length = 0;
  const createStartedAt = performance.now();
  const created = await call('add_clip', {
    clips: [0, 1].map((row) => ({ trackId: ownedTrackId, row, lengthBeats: 32 })),
  });
  const createElapsedMs = performance.now() - createStartedAt;
  activeChangeId = created['changeId'] as string | undefined;
  if (activeChangeId === undefined) throw new Error('the two-clip workflow returned no change id');
  const creation = {
    elapsedMs: Math.round(createElapsedMs),
    requestCount: transport.requests.length,
    bulkPageRequests: transport.requests.filter((entry) =>
      entry.method === 'cursor.getNotesVerboseAllChannels').length,
    hostScanMs: Math.round(transport.requests.reduce((sum, entry) =>
      sum + (entry.scanMicros ?? 0) / 1000, 0)),
    livePhases: sumByPhase(liveTimings),
    executorPhases: sumByPhase(executorTimings),
  };
  check('4b-L4: two empty 32-beat clips are created and independently verified',
    created['applied'] === true
      && (creation.executorPhases as Record<string, number>)['verification'] !== undefined,
    { created, creation });

  const reversalStartedAt = performance.now();
  const reversal = await call('revert_change', { changeId: activeChangeId });
  const reversalElapsedMs = performance.now() - reversalStartedAt;
  if (reversal['applied'] === true) activeChangeId = undefined;
  const block = await call('inspect_clip_block', {
    trackId: ownedTrackId,
    firstRow: 0,
    lastRow: 1,
  });
  const rows = block['rows'] as readonly { readonly clipExists?: boolean }[] | undefined;
  check('4b-L5: reversal restores both scratch slots to empty',
    reversal['applied'] === true && rows?.every((row) => row.clipExists === false) === true,
    { reversal, block });

  const deleted = await call('delete_track', { trackIds: [ownedTrackId] });
  if (deleted['applied'] === true) ownedTrackId = undefined;
  await restoreEntrySelection();
  const finalTracks = await bridge.request('track.list') as { readonly tracks: readonly TrackRow[] };
  const finalSelection = await bridge.request('selection.status') as {
    readonly trackIndex: number;
    readonly slotIndex: number;
    readonly mixerTrackIndex?: number;
  };
  check('4b-L6: scratch cleanup and user selection return to their entry state',
    ownedTrackId === undefined
      && !finalTracks.tracks.some((track) => track.name === 'gn-4b-latency')
      && finalSelection.trackIndex === entrySelection.trackIndex
      && finalSelection.slotIndex === entrySelection.slotIndex
      && finalSelection.mixerTrackIndex === entrySelection.mixerTrackIndex,
    { ownedTrackId, entrySelection, finalSelection });

  console.log(JSON.stringify({
    baseline: { exactReadMedianMs: 5323, twoEmptyClipsMs: 13436 },
    after: {
      exactReads: reads,
      exactReadMedianMs: medianReadMs,
      twoEmptyClips: creation,
      reversalMs: Math.round(reversalElapsedMs),
    },
  }, null, 2));
} catch (error) {
  check('4b-LX: the latency probe completed without an unexpected failure', false,
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

note(`Phase 4 session 4b clip latency: ${failureCount() === 0 ? 'PASS' : 'FAILED'}`);
process.exit(failureCount() === 0 ? 0 : 1);
