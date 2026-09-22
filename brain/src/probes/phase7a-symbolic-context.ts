/** Phase 7a read-only dogfood: one complete clip to compact context. */
import { LiveAdapter, type LiveTimingEvent } from '../adapters/live/adapter.js';
import { BridgeTransport, type Transport } from '../adapters/live/transport.js';
import type { Frame } from '../adapters/live/wiremap.js';
import { clip, scene, slot, track } from '../contract/index.js';
import {
  readExactNoteSource, serializeExactNoteSource,
} from '../musical/exact-note-source.js';
import {
  symbolicContextModule, type SymbolicContextRequest, type SymbolicContextResult,
  type SymbolicContextTimingEvent,
} from '../musical/symbolic-context.js';
import {
  WORKSTATION_REQUEST_SCHEMA, WorkstationModuleRegistry,
} from '../workstation/index.js';
import { client as bridge } from './lib.js';

interface RequestTiming {
  readonly method: string;
  readonly elapsedMs: number;
  readonly scanMicros?: number;
}

class TimingTransport implements Transport {
  readonly requests: RequestTiming[] = [];

  constructor(private readonly inner: Transport) {}

  async send(frame: Frame): Promise<unknown> {
    const started = performance.now();
    const result = await this.inner.send(frame);
    const scanMicros = (result as { scanMicros?: unknown } | undefined)?.scanMicros;
    this.requests.push({
      method: frame.method,
      elapsedMs: performance.now() - started,
      ...(typeof scanMicros === 'number' ? { scanMicros } : {}),
    });
    return result;
  }

  close(): Promise<void> {
    return this.inner.close();
  }
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

function countByMethod(requests: readonly RequestTiming[]): Record<string, number> {
  const counts = new Map<string, number>();
  for (const request of requests) counts.set(request.method, (counts.get(request.method) ?? 0) + 1);
  return Object.fromEntries([...counts].sort(([left], [right]) => left.localeCompare(right)));
}

function sumLivePhases(events: readonly LiveTimingEvent[]): Record<string, number> {
  const totals = new Map<string, number>();
  for (const event of events) totals.set(event.phase, (totals.get(event.phase) ?? 0) + event.elapsedMs);
  return Object.fromEntries([...totals].map(([phase, elapsedMs]) => [phase, elapsedMs]));
}

await bridge.connect();
const rig = await bridge.request('rig.info') as {
  readonly noteReadSteps?: number;
  readonly fineSteps?: number;
};
const selectionBefore = await bridge.request('selection.status') as {
  readonly trackIndex?: number;
  readonly slotIndex?: number;
  readonly mixerTrackIndex?: number;
};
const transport = new TimingTransport(new BridgeTransport(bridge));
const liveTimings: LiveTimingEvent[] = [];
const adapter = new LiveAdapter({ transport, onTiming: (event) => liveTimings.push(event) });

try {
  const adapterInfo = await adapter.hello();
  const tracks = await adapter.tracks();
  const requestedTrackId = argument('--track');
  const selectedIndex = selectionBefore.mixerTrackIndex ?? selectionBefore.trackIndex ?? 0;
  const selectedTrack = requestedTrackId === undefined
    ? tracks.find((item) => item.position === selectedIndex)
    : tracks.find((item) => item.channelId === requestedTrackId);
  if (selectedTrack === undefined) {
    throw new Error('select one launcher track, or supply --track with a visible track ID');
  }
  const rowText = argument('--row');
  const selectedRow = selectionBefore.slotIndex;
  const row = rowText === undefined
    ? (Number.isSafeInteger(selectedRow) && selectedRow! >= 0 ? selectedRow! : 0)
    : Number(rowText);
  if (!Number.isSafeInteger(row) || row < 0) throw new Error('--row must be a non-negative integer');
  const bpm = Number(argument('--bpm') ?? '120');
  if (!Number.isFinite(bpm) || bpm <= 0) throw new Error('--bpm must be a positive number');

  const baseline = await adapter.revision();
  const target = clip(slot(track(selectedTrack.channelId), scene(row, baseline.sceneEpoch)));
  const acquired = await readExactNoteSource(adapter, {
    clips: [target],
    source: {
      kind: 'live-bitwig',
      id: `phase7a:${baseline.generation}:${selectedTrack.channelId}:${row}`,
      permission: 'operator-requested read-only analysis of the current project',
    },
    expectedGeneration: baseline.generation,
  });
  const clipState = acquired.source.clips[0]!;
  const contextTimings: SymbolicContextTimingEvent[] = [];
  const registry = new WorkstationModuleRegistry();
  registry.register(symbolicContextModule({ onTiming: (event) => contextTimings.push(event) }));
  const moduleRequest = {
    schema: WORKSTATION_REQUEST_SCHEMA,
    requestId: 'phase7a-live-context-1',
    inputSchema: 'ghostnote-exact-note-source-v0',
    sourceSha256: acquired.source.digest.value,
    payload: {
      source: acquired.source,
      expectedGeneration: baseline.generation,
      task: {
        id: 'explain-one-complete-clip-and-propose-an-unapplied-revision',
        mode: 'compact-bar-v0' as const,
        coverage: { fromBeats: 0, toBeats: clipState.metadata.lengthBeats },
        meter: { numerator: 4, denominator: 4 as const },
        tempoMap: [{ atBeats: 0, bpm }],
        measurements: ['note-count-v0', 'pitch-span-v0'] as const,
      },
    },
  } as const;
  const coldStarted = performance.now();
  const response = await registry.request<SymbolicContextRequest, SymbolicContextResult>(
    'ghostnote-symbolic-context',
    moduleRequest,
  );
  const coldRequestMs = performance.now() - coldStarted;
  const coldContextPhases = contextTimings.splice(0);
  const warmStarted = performance.now();
  const warmResponse = await registry.request<SymbolicContextRequest, SymbolicContextResult>(
    'ghostnote-symbolic-context',
    { ...moduleRequest, requestId: 'phase7a-live-context-2' },
  );
  const warmRequestMs = performance.now() - warmStarted;
  const warmContextPhases = contextTimings.splice(0);
  const result = response.payload;
  if (warmResponse.payload.rendered !== result.rendered
      || warmResponse.payload.contextDigest.value !== result.contextDigest.value) {
    throw new Error('the warm module result differs from the cold result');
  }
  const exit = await adapter.revision();
  const selectionAfter = await bridge.request('selection.status');
  const exactBytes = Buffer.byteLength(serializeExactNoteSource(acquired.source), 'utf8');
  const contextBytes = Buffer.byteLength(result.rendered, 'utf8');
  const scrollRequests = transport.requests
    .filter((item) => item.method === 'cursor.scrollToStep').length;
  const bulkPageReads = transport.requests
    .filter((item) => item.method === 'cursor.getNotesVerboseAllChannels').length;
  const noteCount = acquired.source.clips.reduce((total, item) => total
    + item.channels.reduce((channelTotal, channel) => channelTotal + channel.notes.length, 0), 0);

  console.log(JSON.stringify({
    schema: 'ghostnote-phase7a-run-v0',
    mode: 'module-only',
    permissions: ['read current selected launcher clip', 'no project write'],
    enabledModules: registry.discover(),
    adapter: adapterInfo,
    reader: {
      advertisedSteps: rig.noteReadSteps ?? rig.fineSteps ?? null,
      pages: bulkPageReads,
      pageResets: scrollRequests - bulkPageReads,
      scrollRequests,
      scanMicros: transport.requests.reduce((total, item) => total + (item.scanMicros ?? 0), 0),
    },
    target: {
      project: baseline.project,
      trackId: selectedTrack.channelId,
      trackName: selectedTrack.name,
      row,
      clipName: clipState.metadata.name,
      lengthBeats: clipState.metadata.lengthBeats,
    },
    source: {
      sha256: acquired.source.digest.value,
      digestDomain: acquired.source.digest.domain,
      canonicalization: acquired.source.digest.canonicalization,
      exactBytes,
      clipCount: acquired.source.clips.length,
      channelCount: acquired.source.clips.length * 16,
      noteCount,
      coverage: acquired.source.coverage,
    },
    context: {
      sha256: result.contextDigest.value,
      digestDomain: result.contextDigest.domain,
      bytes: contextBytes,
      rendered: result.rendered,
      measurements: result.derivedMeasurements,
      unavailableFields: result.contextCoverage.unavailableFields,
      omittedFields: result.contextCoverage.omittedFields,
      alternatives: result.alternatives,
      warnings: result.warnings,
    },
    timingMs: {
      hostAcquisition: acquired.acquisitionMs,
      sourceCanonicalizationAndHash: acquired.canonicalizationAndHashMs,
      coldContextPhases,
      warmContextPhases,
      coldModuleRequestInclusive: coldRequestMs,
      warmModuleRequestInclusive: warmRequestMs,
      adapterPhases: sumLivePhases(liveTimings),
    },
    bridgeRequestCounts: countByMethod(transport.requests),
    baseline,
    exit,
    selectionBefore,
    selectionAfter,
    effects: 'none',
  }, null, 2));
} finally {
  await adapter.close();
}
