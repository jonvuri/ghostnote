/** Phase 2x: ordinary-MCP background completion, cancellation, and cleanup. */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { LiveAdapter } from '../adapters/live/adapter.js';
import { BridgeTransport } from '../adapters/live/transport.js';
import { Executor } from '../engine/index.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { registerTools } from '../surface/tools.js';
import { workspaceOf } from '../surface/workspace.js';
import { check, client as bridge, failureCount, note } from './lib.js';

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

interface OperationChange {
  readonly changeId: string;
  readonly applied: boolean;
}

interface OperationStatus {
  readonly operationId: string;
  readonly state: string;
  readonly terminal: boolean;
  readonly cancellationRequested: boolean;
  readonly changes: readonly OperationChange[];
  readonly result?: Record<string, unknown>;
  readonly error?: string;
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

const asStatus = (value: Record<string, unknown>): OperationStatus => value as unknown as OperationStatus;

async function slotOccupied(trackIndex: number, row: number): Promise<boolean> {
  const result = await bridge.request('slot.status', { trackIndex, slotIndex: row }) as {
    readonly hasContent?: boolean;
  };
  return result.hasContent === true;
}

const sleep = async (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const acceptedRows = [1, 2, 3, 4] as const;

const sameSelection = (left: Selection | undefined, right: Selection | undefined): boolean =>
  left !== undefined
  && right !== undefined
  && left.trackIndex === right.trackIndex
  && left.slotIndex === right.slotIndex
  && left.mixerTrackIndex === right.mixerTrackIndex;

await bridge.connect();
const writer = new LiveAdapter({ transport: new BridgeTransport(bridge) });
const active: string[] = [];
let mcp: Client | undefined;
let server: McpServer | undefined;
let target: { trackId: string; row: number; trackIndex: number } | undefined;
let initialSelection: Selection | undefined;
let acceptedOccupancy: readonly boolean[] | undefined;

try {
  await writer.hello();
  const workspace = workspaceOf({
    ready: async () => undefined,
    adapter: writer,
    executor: new Executor(writer),
    stash: new Stash(),
    // The probe tests the public operation surface, not project observation storage.
    // Keep that separate store in memory so teardown restores the full project baseline.
    observationStore: new FakeObservationStore(),
  });
  server = new McpServer({ name: 'ghostnote-2x-background', version: '1.0.0' });
  registerTools(server, workspace);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  mcp = new Client({ name: 'phase-2x-background', version: '1.0.0' });
  await server.connect(serverTransport);
  await mcp.connect(clientTransport);

  const call = async (name: string, args: Record<string, unknown> = {}) =>
    parse(await mcp!.callTool({ name, arguments: args }));
  const inspect = async (operationId: string): Promise<OperationStatus> =>
    asStatus(await call('inspect_clip_music_operation', { operationId }));
  const waitForTerminal = async (
    operationId: string,
    timeoutMs = 180_000,
  ): Promise<{ status: OperationStatus; elapsedMs: number }> => {
    const startedAt = Date.now();
    for (;;) {
      const status = await inspect(operationId);
      if (status.terminal) return { status, elapsedMs: Date.now() - startedAt };
      if (Date.now() - startedAt > timeoutMs) {
        throw new Error(`operation ${operationId} did not become terminal within ${timeoutMs} ms`);
      }
      await sleep(250);
    }
  };
  const rememberChanges = (status: OperationStatus): void => {
    for (const change of status.changes) {
      if (!active.includes(change.changeId)) active.push(change.changeId);
    }
  };
  const reverse = async (id: string): Promise<void> => {
    const result = await call('revert_change', { changeId: id });
    if (result['applied'] !== true) throw new Error(`reversal ${id} did not apply`);
    active.splice(active.lastIndexOf(id), 1);
  };

  const connection = await call('check_connection');
  if (connection['project'] !== '26.05-2 moon') {
    throw new Error(`expected project 26.05-2 moon, got ${String(connection['project'])}`);
  }
  const listed = await bridge.request('track.list') as { readonly tracks: readonly TrackRow[] };
  const lead = listed.tracks.find((track) => track.name === 'Lead');
  if (lead === undefined) throw new Error('the Lead track is absent');
  const sceneCount = (await bridge.request('scene.count') as { readonly sceneCount: number }).sceneCount;
  acceptedOccupancy = await Promise.all(acceptedRows.map((row) => slotOccupied(lead.index, row)));
  let row: number | undefined;
  for (let candidate = 4; candidate < sceneCount; candidate += 1) {
    if (!(await slotOccupied(lead.index, candidate))) {
      row = candidate;
      break;
    }
  }
  if (row === undefined) throw new Error('the Lead track has no empty row after the accepted clips');
  target = { trackId: lead.channelId, row, trackIndex: lead.index };
  initialSelection = await bridge.request('selection.status') as Selection;
  check('2x-L0: the target is an empty row after the four accepted Lead clips',
    row >= 4 && !(await slotOccupied(lead.index, row)), { row, acceptedOccupancy });

  const created = await call('add_clip', {
    clips: [{ trackId: target.trackId, row: target.row, lengthBeats: 4 }],
  });
  if (typeof created['changeId'] !== 'string') throw new Error('clip creation returned no change id');
  active.push(created['changeId']);

  const patch = {
    schema: 'ghostnote-musical-patch',
    version: 1,
    protection: { kind: 'direct' },
    targets: [{
      clip: { trackId: target.trackId, row: target.row },
      channel: 7,
      write: 'merge',
      operations: [{
        op: 'generate',
        source: {
          kind: 'notes',
          notes: [{
            startBeats: 0, pitch: 72, velocity: 80, durationBeats: 1, pan: -0.25,
          }],
        },
      }],
    }],
  };

  const startAt = Date.now();
  const started = asStatus(await call('start_clip_music_operation', {
    operation: 'generation', patch,
  }));
  const startMs = Date.now() - startAt;
  check('2x-L1: start returns an operation id before the musical work is terminal',
    typeof started.operationId === 'string' && started.terminal === false,
    { state: started.state, startMs });
  const completed = await waitForTerminal(started.operationId);
  rememberChanges(completed.status);
  check('2x-L2: ordinary MCP inspection reaches the complete verified result',
    completed.status.state === 'completed'
      && completed.status.result?.['applied'] === true
      && completed.status.changes.length === 1
      && completed.status.changes[0]?.applied === true,
    { elapsedMs: completed.elapsedMs, status: completed.status });

  const read = await call('read_clip', {
    trackId: target.trackId, row: target.row, channel: 7,
  }) as { readonly notes?: readonly { readonly pitch: number; readonly pan?: number }[] };
  check('2x-L3: independent public readback sees the completed note and expression',
    read.notes?.some((item) => item.pitch === 72 && item.pan === -0.25) === true, read);
  for (const change of [...completed.status.changes].reverse()) await reverse(change.changeId);

  const cancellingStarted = asStatus(await call('start_clip_music_operation', {
    operation: 'generation', patch,
  }));
  const cancellation = asStatus(await call('cancel_clip_music_operation', {
    operationId: cancellingStarted.operationId,
  }));
  check('2x-L4: cancellation is explicit and does not claim terminal while work is active',
    cancellation.cancellationRequested === true
      && (cancellation.state === 'cancelling' || cancellation.state === 'cancelled'),
    cancellation);
  const cancelled = await waitForTerminal(cancellingStarted.operationId);
  rememberChanges(cancelled.status);
  check('2x-L5: cancelled preflight reaches terminal with no recorded project write',
    cancelled.status.state === 'cancelled' && cancelled.status.changes.length === 0,
    { elapsedMs: cancelled.elapsedMs, status: cancelled.status });
  for (const change of [...cancelled.status.changes].reverse()) await reverse(change.changeId);

  const empty = await call('read_clip', {
    trackId: target.trackId, row: target.row, channel: 7,
  }) as { readonly notes?: readonly unknown[] };
  check('2x-L6: no note remains after completion reversal and cancellation',
    empty.notes?.length === 0, empty);
  await reverse(created['changeId']);
  check('2x-L7: the owned disposable clip is removed',
    !(await slotOccupied(target.trackIndex, target.row)));
} catch (error) {
  check('2x-LX: the live proof completed without an unexpected failure', false,
    error instanceof Error ? `${error.name}: ${error.message}` : String(error));
} finally {
  if (mcp !== undefined) {
    for (const id of [...active].reverse()) {
      try {
        const result = parse(await mcp.callTool({ name: 'revert_change', arguments: { changeId: id } }));
        if (result['applied'] === true) active.splice(active.lastIndexOf(id), 1);
      } catch { /* The final residue check reports cleanup failure. */ }
    }
  }
  for (const cursor of ['0', '1', '2', 'fine']) {
    try { await bridge.request('cursor.scrollToStep', { cursor, step: 0 }); } catch { /* Reported below. */ }
  }
  if (initialSelection !== undefined) {
    try {
      await bridge.request('slot.select', {
        trackIndex: initialSelection.trackIndex,
        slotIndex: initialSelection.slotIndex,
        mechanism: 'slot',
      });
    } catch { /* Reported below. */ }
  }
  const acceptedAfter = target === undefined || acceptedOccupancy === undefined
    ? undefined
    : await Promise.all(acceptedRows.map((row) => slotOccupied(target!.trackIndex, row)));
  const selectionAfter = initialSelection === undefined
    ? undefined
    : await bridge.request('selection.status') as Selection;
  const clean = target !== undefined
    && !(await slotOccupied(target.trackIndex, target.row))
    && active.length === 0
    && JSON.stringify(acceptedAfter) === JSON.stringify(acceptedOccupancy)
    && sameSelection(selectionAfter, initialSelection);
  check('2x-L8: cleanup restores the target, accepted rows, and entry selection',
    clean, { active, target, acceptedOccupancy, acceptedAfter, initialSelection, selectionAfter });
  await mcp?.close();
  await server?.close();
  bridge.disconnect();
}

note(`Phase 2 session 2x background operations: ${failureCount() === 0 ? 'PASS' : 'FAILED'}`);
process.exit(failureCount() === 0 ? 0 : 1);
