/** Phase 4 session 4b: compare the 512-step and 2,048-step note readers. */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { LiveAdapter, type LiveTimingEvent } from '../adapters/live/adapter.js';
import { LiveObservationStore } from '../adapters/live/observation-store.js';
import { BridgeTransport, type Transport } from '../adapters/live/transport.js';
import type { Frame } from '../adapters/live/wiremap.js';
import { Executor } from '../engine/index.js';
import { Stash } from '../stash/index.js';
import { registerTools } from '../surface/tools.js';
import { workspaceOf } from '../surface/workspace.js';
import { check, client as bridge, failureCount, note } from './lib.js';

const CONFIG_PATH = path.join(os.homedir(), '.ghostnote', 'rig.json');
const BUILT = path.resolve('../extension/build/libs/ghostnote-0.0.1.bwextension');
const DEPLOYED = path.join(
  os.homedir(), 'Documents', 'Bitwig Studio', 'Extensions', 'ghostnote-0.0.1.bwextension');
const PROJECT = '26.05-2 moon';
const TRACK = 'Harmony – Open Minor';
const BASELINE_MEDIAN_MS = 5323;
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

interface RigStats {
  readonly config: {
    readonly stamp: string;
    readonly fineSteps: number;
    readonly noteReadSteps: number;
  };
  readonly rigConstructMicros: number;
  readonly initMicros: number;
  readonly initEpochMs: number;
}

interface RequestTiming {
  readonly method: string;
  readonly scanMicros?: number;
}

class TimingTransport implements Transport {
  readonly requests: RequestTiming[] = [];

  constructor(private readonly inner: Transport) {}

  async send(frame: Frame): Promise<unknown> {
    const result = await this.inner.send(frame);
    const scanMicros = (result as { scanMicros?: unknown } | undefined)?.scanMicros;
    this.requests.push({
      method: frame.method,
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

const sumByPhase = (events: readonly LiveTimingEvent[]): Record<string, number> => {
  const result: Record<string, number> = {};
  for (const event of events) result[event.phase] = (result[event.phase] ?? 0) + event.elapsedMs;
  return Object.fromEntries(Object.entries(result).map(([key, value]) => [key, Math.round(value)]));
};

const sameSelection = (left: Selection, right: Selection): boolean =>
  left.trackIndex === right.trackIndex
    && left.slotIndex === right.slotIndex
    && left.mixerTrackIndex === right.mixerTrackIndex;

async function restoreSelection(entry: Selection): Promise<void> {
  if (entry.mixerTrackIndex === undefined) return;
  await bridge.request('cursor.pin', { cursor: 'fine', pinned: false });
  await bridge.request('cursor.pinTrack', { cursor: 'fine', pinned: false });
  await bridge.request('cursor.pointTrack', { cursor: 'fine', trackIndex: entry.mixerTrackIndex });
  await bridge.request('slot.select', {
    trackIndex: entry.trackIndex,
    slotIndex: entry.slotIndex,
    mechanism: 'track',
  });
  await wait(150);
  await bridge.request('cursor.pinTrack', { cursor: 'fine', pinned: true });
  await bridge.request('cursor.pin', { cursor: 'fine', pinned: true });
}

function replaceConfig(bytes: Buffer): void {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  const staged = `${CONFIG_PATH}.phase4b-staged`;
  fs.writeFileSync(staged, bytes);
  fs.renameSync(staged, CONFIG_PATH);
}

async function reloadUntil(predicate: (stats: RigStats) => boolean): Promise<{
  readonly reloadMs: number;
  readonly stats: RigStats;
}> {
  bridge.disconnect();
  const startedAt = Date.now();
  fs.copyFileSync(BUILT, DEPLOYED);
  let stableEpoch = -1;
  let stable = 0;
  let last: unknown;
  for (let attempt = 0; attempt < 360; attempt += 1) {
    try {
      await bridge.connect();
      const stats = await bridge.request('rig.stats', undefined, 3000) as RigStats;
      if (predicate(stats)) {
        stable = stats.initEpochMs === stableEpoch ? stable + 1 : 1;
        stableEpoch = stats.initEpochMs;
        if (stable >= 4) return { reloadMs: Date.now() - startedAt, stats };
      } else {
        stable = 0;
      }
    } catch (error) {
      last = error;
      bridge.disconnect();
      stable = 0;
    }
    await wait(250);
  }
  throw new Error(`the extension did not reload: ${String(last)}`);
}

async function measureCurrent(stats: RigStats): Promise<Record<string, unknown>> {
  const transport = new TimingTransport(new BridgeTransport(bridge));
  const timings: LiveTimingEvent[] = [];
  const adapter = new LiveAdapter({ transport, onTiming: (event) => timings.push(event) });
  await adapter.hello();
  const executor = new Executor(adapter);
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
  const server = new McpServer({ name: 'ghostnote-4b-read-window', version: '1.0.0' });
  registerTools(server, workspace);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const mcp = new Client({ name: 'phase-4b-read-window', version: '1.0.0' });
  await server.connect(serverTransport);
  await mcp.connect(clientTransport);
  try {
    const call = async (name: string, args: Record<string, unknown> = {}) =>
      parse(await mcp.callTool({ name, arguments: args }));
    const connection = await call('check_connection');
    if (connection['project'] !== PROJECT) {
      throw new Error(`expected project ${PROJECT}, got ${String(connection['project'])}`);
    }
    const listed = await bridge.request('track.list') as { readonly tracks: readonly TrackRow[] };
    const accepted = listed.tracks.find((track) => track.name === TRACK);
    if (accepted === undefined) throw new Error(`the accepted ${TRACK} track is absent`);
    const reads: Record<string, unknown>[] = [];
    for (let sample = 0; sample < 3; sample += 1) {
      transport.requests.length = 0;
      timings.length = 0;
      const startedAt = performance.now();
      const result = await call('read_clip', { trackId: accepted.channelId, row: 5, channel: 0 });
      const elapsedMs = performance.now() - startedAt;
      const phases = sumByPhase(timings);
      const namedMs = Object.values(phases).reduce((sum, value) => sum + value, 0);
      reads.push({
        elapsedMs: Math.round(elapsedMs),
        noteCount: (result['notes'] as readonly unknown[]).length,
        bulkPageRequests: transport.requests.filter((request) =>
          request.method === 'cursor.getNotesVerboseAllChannels').length,
        hostScanMs: Math.round(transport.requests.reduce((sum, request) =>
          sum + (request.scanMicros ?? 0) / 1000, 0)),
        phases,
        coordinatorRemainderMs: Math.max(0, Math.round(elapsedMs - namedMs)),
      });
    }
    const elapsed = reads.map((read) => read['elapsedMs'] as number).sort((a, b) => a - b);
    return {
      noteReadSteps: stats.config.noteReadSteps,
      writerSteps: stats.config.fineSteps,
      constructMs: Math.round(stats.rigConstructMicros / 1000),
      initMs: Math.round(stats.initMicros / 1000),
      medianReadMs: elapsed[1],
      reads,
    };
  } finally {
    await mcp.close();
    await server.close();
  }
}

const originalExists = fs.existsSync(CONFIG_PATH);
const originalBytes = originalExists ? fs.readFileSync(CONFIG_PATH) : Buffer.alloc(0);
const originalConfig = originalExists
  ? JSON.parse(originalBytes.toString('utf8')) as Record<string, unknown>
  : {};
const originalHash = createHash('sha256').update(originalBytes).digest('hex');
let entrySelection: Selection | undefined;
let lastEpoch = -1;
const measurements: Record<string, unknown>[] = [];

try {
  await bridge.connect();
  entrySelection = await bridge.request('selection.status') as Selection;
  for (const noteReadSteps of [512, 2048]) {
    const stamp = `phase4b-read-${noteReadSteps}`;
    replaceConfig(Buffer.from(JSON.stringify({ ...originalConfig, noteReadSteps, stamp })));
    const reloaded = await reloadUntil((stats) =>
      stats.config.stamp === stamp && stats.config.noteReadSteps === noteReadSteps);
    lastEpoch = reloaded.stats.initEpochMs;
    const measured = await measureCurrent(reloaded.stats);
    measurements.push({ ...measured, reloadMs: reloaded.reloadMs });
  }

  const baseline = measurements[0]!;
  const candidate = measurements[1]!;
  const candidateReads = candidate['reads'] as readonly Record<string, unknown>[];
  check('4b-W1: writer cursors stay at 512 steps in both measurements',
    measurements.every((measurement) => measurement['writerSteps'] === 512), measurements);
  check('4b-W2: the 2,048-step reader preserves all three accepted 21-note reads',
    candidateReads.every((read) => read['noteCount'] === 21), candidate);
  check('4b-W3: the 2,048-step reader uses one bulk page per grid',
    candidateReads.every((read) => read['bulkPageRequests'] === 2), candidate);
  check('4b-W4: the candidate median closes the half-time exact-read gate',
    (candidate['medianReadMs'] as number) <= BASELINE_MEDIAN_MS / 2,
    { requiredMaximumMs: BASELINE_MEDIAN_MS / 2, baseline, candidate });
} catch (error) {
  check('4b-WX: the read-window measurement completed without an unexpected failure', false,
    error instanceof Error ? `${error.name}: ${error.message}` : String(error));
} finally {
  try {
    if (originalExists) replaceConfig(originalBytes);
    else if (fs.existsSync(CONFIG_PATH)) fs.unlinkSync(CONFIG_PATH);
    const restored = await reloadUntil((stats) => stats.initEpochMs !== lastEpoch);
    if (entrySelection !== undefined) {
      const current = await bridge.request('selection.status') as Selection;
      if (!sameSelection(current, entrySelection)) await restoreSelection(entrySelection);
      const finalSelection = await bridge.request('selection.status') as Selection;
      check('4b-W5: the entry selection is restored after both reloads',
        sameSelection(finalSelection, entrySelection), { entrySelection, finalSelection });
    }
    const finalBytes = fs.existsSync(CONFIG_PATH) ? fs.readFileSync(CONFIG_PATH) : Buffer.alloc(0);
    const finalHash = createHash('sha256').update(finalBytes).digest('hex');
    check('4b-W6: rig configuration bytes return to their entry state',
      originalExists === fs.existsSync(CONFIG_PATH) && finalHash === originalHash,
      { originalExists, originalHash, finalHash, restored: restored.stats.config });
  } catch (error) {
    check('4b-WY: read-window cleanup completed', false,
      error instanceof Error ? `${error.name}: ${error.message}` : String(error));
  }
  bridge.disconnect();
}

console.log(JSON.stringify({ historicalBaselineMedianMs: BASELINE_MEDIAN_MS, measurements }, null, 2));
note(`Phase 4 session 4b read window: ${failureCount() === 0 ? 'PASS' : 'FAILED'}`);
process.exit(failureCount() === 0 ? 0 : 1);
