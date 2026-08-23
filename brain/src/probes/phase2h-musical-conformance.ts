/** Phase 2h public musical conformance and measured expression workloads. */
import { performance } from 'node:perf_hooks';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { LiveAdapter } from '../adapters/live/adapter.js';
import { LiveObservationStore } from '../adapters/live/observation-store.js';
import { BridgeTransport } from '../adapters/live/transport.js';
import {
  SETTLE_MS, planStages,
  type BatchRequest, type BitwigAdapter,
} from '../contract/index.js';
import { Executor } from '../engine/index.js';
import { Stash } from '../stash/index.js';
import {
  exactMusicalNote, runPublicMusicalConformance,
  type MusicalConformanceSlot,
} from '../surface/musical-conformance.js';
import { LiveStatusSink } from '../surface/status.js';
import { registerTools } from '../surface/tools.js';
import { workspaceOf } from '../surface/workspace.js';
import {
  check, client as bridge, cursorStatus, failureCount, note, point, pollUntil,
} from './lib.js';

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
const EMPTY_RECORD = '{"entries":[],"format":"ghostnote-observation-record","schemaVersion":1}';
const BASELINE_STATUS = 'Change · 4a-live-check';
const AUDIT_ONLY = process.argv.includes('--audit');

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

interface WorkloadMeasurement {
  readonly clips: number;
  readonly stages: number;
  readonly propertyStages: number;
  readonly totalMs: number;
  readonly propertyWaitMs: number;
  readonly propertyWaitShare: number;
}

function routedAdapter(
  writer: BitwigAdapter,
  witness: BitwigAdapter,
  beforeApply: () => Promise<void>,
): BitwigAdapter {
  return {
    hello: () => writer.hello(),
    resolve: (refs) => writer.resolve(refs),
    tracks: () => writer.tracks(),
    devices: (trackRef) => writer.devices(trackRef),
    drumPads: (container) => writer.drumPads(container),
    read: (refs) => witness.read(refs),
    apply: async (batch: BatchRequest) => {
      await beforeApply();
      return writer.apply(batch);
    },
    settle: (budget) => writer.settle(budget),
    revision: () => writer.revision(),
    contentSince: (since) => writer.contentSince(since),
    preserveSelection: (work) => writer.preserveSelection(work),
    showClipInEditor: (clipRef, verifiedAt) => writer.showClipInEditor(clipRef, verifiedAt),
    close: () => writer.close(),
  };
}

function parseResult(value: unknown): Record<string, unknown> {
  const result = value as {
    readonly isError?: boolean;
    readonly content?: readonly { readonly type: string; readonly text?: string }[];
  };
  const text = result.content?.find((item) => item.type === 'text')?.text;
  if (result.isError === true) throw new Error(text ?? 'MCP tool error');
  if (text === undefined) throw new Error('the MCP tool returned no text result');
  return JSON.parse(text) as Record<string, unknown>;
}

async function tracks(): Promise<readonly TrackRow[]> {
  return ((await bridge.request('track.list')) as { readonly tracks: readonly TrackRow[] }).tracks;
}

async function selection(): Promise<Selection> {
  return (await bridge.request('selection.status')) as Selection;
}

async function occupied(trackIndex: number, row: number): Promise<boolean> {
  return ((await bridge.request('slot.status', {
    trackIndex, slotIndex: row,
  })) as { readonly hasContent: boolean }).hasContent;
}

async function occupiedCount(rows: readonly TrackRow[]): Promise<number> {
  let count = 0;
  for (const row of rows) {
    for (let scene = 0; scene < 10; scene += 1) {
      if (await occupied(row.index, scene)) count += 1;
    }
  }
  return count;
}

async function observation(): Promise<string> {
  const value = await bridge.request('observation.read') as {
    readonly available?: boolean;
    readonly value?: string;
  };
  if (value.available !== true || typeof value.value !== 'string') {
    throw new Error('the observation record is unavailable');
  }
  return value.value;
}

async function restoreBaseline(expectedObservation: string): Promise<boolean> {
  await bridge.request('transport.stop');
  await bridge.request('observation.replace', { value: expectedObservation });
  const home = (await tracks()).find((row) => row.channelId === HOME_TRACK_ID);
  if (home === undefined) throw new Error('the cursor home track is absent');
  for (const cursor of ['0', '1', '2', 'fine']) {
    await bridge.request('cursor.pin', { cursor, pinned: false });
    await bridge.request('cursor.pinTrack', { cursor, pinned: false });
    const restored = await point(cursor, home.index, 0, 'trackThenSlot');
    if (!restored.ok) throw new Error(`cursor ${cursor} did not return home`);
    const state = await cursorStatus(cursor);
    if (state.isPinned === true || state.cursorTrackPinned === true) {
      throw new Error(`cursor ${cursor} stayed pinned`);
    }
  }
  await bridge.request('slot.select', { trackIndex: 0, slotIndex: 1, mechanism: 'slot' });
  const selected = await pollUntil(async () => {
    const current = await selection();
    return current.trackIndex === 0 && current.slotIndex === 1;
  });
  if (!selected.ok) throw new Error('selection did not return to track 0 row 1');
  const at = await bridge.request('revision.get') as {
    readonly generation?: string;
    readonly project?: string;
  };
  const status = await bridge.request('status.push', {
    value: BASELINE_STATUS,
    expectedGeneration: at.generation,
    expectedProject: at.project,
  }) as { readonly accepted?: boolean };
  const rows = await tracks();
  const sceneCount = ((await bridge.request('scene.count')) as { readonly sceneCount: number }).sceneCount;
  const transport = await bridge.request('transport.status') as { readonly isPlaying?: boolean };
  return status.accepted === true
    && rows.length === 10
    && rows.every((row) => TRACKS[row.channelId] === row.name)
    && sceneCount === 10
    && await occupiedCount(rows) === 22
    && (await selection()).trackIndex === 0
    && (await selection()).slotIndex === 1
    && await observation() === expectedObservation
    && transport.isPlaying === false;
}

async function findSlots(rows: readonly TrackRow[]): Promise<readonly [
  MusicalConformanceSlot, MusicalConformanceSlot, MusicalConformanceSlot,
]> {
  const eligible = CLIP_TRACK_IDS.map((id) => rows.find((row) => row.channelId === id))
    .filter((row): row is TrackRow => row !== undefined);
  const empty = new Map<string, boolean>();
  for (const row of eligible) {
    for (let scene = 0; scene < 10; scene += 1) {
      empty.set(`${row.channelId}:${scene}`, !(await occupied(row.index, scene)));
    }
  }
  let block: MusicalConformanceSlot | undefined;
  for (const row of eligible) {
    for (let scene = 0; scene <= 6; scene += 1) {
      if ([0, 1, 2, 3].every((offset) => empty.get(`${row.channelId}:${scene + offset}`))) {
        block = { trackId: row.channelId, row: scene };
        break;
      }
    }
    if (block !== undefined) break;
  }
  if (block === undefined) throw new Error('no four-row empty block is available');
  const others: MusicalConformanceSlot[] = [];
  for (const row of eligible) {
    if (row.channelId === block.trackId) continue;
    for (let scene = 0; scene < 10; scene += 1) {
      if (empty.get(`${row.channelId}:${scene}`)) {
        others.push({ trackId: row.channelId, row: scene });
        break;
      }
    }
    if (others.length === 2) break;
  }
  if (others.length !== 2) throw new Error('two additional empty tracks are not available');
  return [block, others[0]!, others[1]!];
}

interface PublicSession {
  readonly stash: Stash;
  readonly call: (name: string, args?: Record<string, unknown>) => Promise<Record<string, unknown>>;
  armStale(): void;
  close(): Promise<void>;
}

async function publicSession(): Promise<PublicSession> {
  const writer = new LiveAdapter({
    transport: new BridgeTransport(bridge), cursorRefs: ['0', '1', '2'],
  });
  const witness = new LiveAdapter({
    transport: new BridgeTransport(bridge), cursorRefs: ['fine'], noteReadCursorRef: 'fine',
  });
  await writer.hello();
  await witness.hello();
  let stale = false;
  const adapter = routedAdapter(writer, witness, async () => {
    if (!stale) return;
    stale = false;
    await bridge.request('revision.bump');
  });
  const stash = new Stash();
  const transport = new BridgeTransport(bridge);
  const workspace = workspaceOf({
    ready: async () => undefined,
    adapter,
    executor: new Executor(adapter),
    stash,
    observationStore: new LiveObservationStore({
      transport,
      projectName: async () => (await writer.revision()).project,
    }),
    statusSink: new LiveStatusSink(transport, async () => {
      const at = await writer.revision();
      return { generation: at.generation, project: at.project };
    }),
  });
  const server = new McpServer({ name: 'ghostnote-2h-live', version: '1.0.0' });
  registerTools(server, workspace);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const mcp = new Client({ name: 'phase-2h-live-conformance', version: '1.0.0' });
  await server.connect(serverTransport);
  await mcp.connect(clientTransport);
  return {
    stash,
    call: async (name, args = {}) => parseResult(await mcp.callTool({ name, arguments: args })),
    armStale: () => { stale = true; },
    close: async () => {
      await mcp.close();
      await server.close();
    },
  };
}

function changeId(result: Record<string, unknown>): string {
  const changes = result['changes'] as readonly { readonly changeId?: string }[];
  const id = changes?.[0]?.changeId;
  if (typeof id !== 'string') throw new Error('the musical result returned no change id');
  return id;
}

async function measureExpressionWorkload(
  sources: readonly MusicalConformanceSlot[],
  expectedObservation: string,
): Promise<WorkloadMeasurement> {
  const session = await publicSession();
  const active: string[] = [];
  const revert = async (id: string) => {
    const result = await session.call('revert_change', { changeId: id });
    if (result['applied'] !== true) throw new Error(`workload reversal ${id} did not apply`);
    active.splice(active.lastIndexOf(id), 1);
  };
  try {
    const created = await session.call('add_clip', {
      clips: sources.map((source) => ({ ...source, lengthBeats: 8 })),
    });
    const createdId = created['changeId'];
    if (typeof createdId !== 'string') throw new Error('workload clips were not recorded');
    active.push(createdId);
    const started = performance.now();
    const result = await session.call('generate_clip_music', {
      schema: 'ghostnote-musical-patch', version: 1, protection: { kind: 'direct' },
      targets: sources.map((source, index) => ({
        clip: source,
        channel: index,
        write: 'merge',
        operations: [{
          op: 'generate',
          source: { kind: 'notes', notes: [exactMusicalNote({ pitch: 60 + index })] },
        }],
      })),
    });
    const totalMs = performance.now() - started;
    if (result['applied'] !== true) throw new Error('the expression workload did not apply');
    const generatedId = changeId(result);
    active.push(generatedId);
    const take = session.stash.log.require(generatedId).take;
    const stages = take.receipt.stages;
    const planned = planStages(take.ops);
    const propertyStages = planned.filter((stage) => stage.ops.some((op) => op.op === 'note.props'));
    if (stages.length !== planned.length) {
      throw new Error(`the expression receipt has ${stages.length} stages for a ${planned.length}-stage plan`);
    }
    if (stages.length !== sources.length * 2 || propertyStages.length !== sources.length) {
      throw new Error(`expression staging was ${stages.length}/${propertyStages.length}, expected `
        + `${sources.length * 2}/${sources.length}`);
    }
    const propertyWaitMs = propertyStages.length * (SETTLE_MS.gridChange + SETTLE_MS.noteWrite);
    await revert(generatedId);
    for (const [index, source] of sources.entries()) {
      const read = await session.call('read_clip', { ...source, channel: index });
      if (!Array.isArray(read['notes']) || read['notes'].length !== 0) {
        throw new Error('workload reversal did not empty a source clip');
      }
    }
    await revert(createdId);
    return {
      clips: sources.length,
      stages: stages.length,
      propertyStages: propertyStages.length,
      totalMs: Math.round(totalMs),
      propertyWaitMs,
      propertyWaitShare: Number((propertyWaitMs / totalMs).toFixed(3)),
    };
  } finally {
    for (const id of [...active].reverse()) {
      try { await revert(id); } catch { /* The baseline check reports residue. */ }
    }
    await session.close();
    check(`2h cleanup restores the baseline after the ${sources.length}-clip workload`,
      await restoreBaseline(expectedObservation));
  }
}

await bridge.connect();
const baselineObservation = await observation();
let selectedSlots: readonly [
  MusicalConformanceSlot, MusicalConformanceSlot, MusicalConformanceSlot,
] | undefined;

try {
  const beforeTracks = await tracks();
  const scenes = ((await bridge.request('scene.count')) as { readonly sceneCount: number }).sceneCount;
  const initialSelection = await selection();
  const playing = (await bridge.request('transport.status')) as { readonly isPlaying?: boolean };
  const baseline = beforeTracks.length === 10
    && beforeTracks.every((row) => TRACKS[row.channelId] === row.name)
    && scenes === 10
    && await occupiedCount(beforeTracks) === 22
    && initialSelection.trackIndex === 0
    && initialSelection.slotIndex === 1
    && playing.isPlaying === false
    && baselineObservation === EMPTY_RECORD;
  check('2h-L0: the destructive live baseline matches every documented identity', baseline, {
    tracks: beforeTracks.map(({ name, channelId }) => ({ name, channelId })),
    scenes,
    selection: initialSelection,
    isPlaying: playing.isPlaying,
    occupied: await occupiedCount(beforeTracks),
    observation: baselineObservation,
  });
  if (!baseline) throw new Error('the documented live baseline does not match');
  if (AUDIT_ONLY) {
    note('Audit-only mode made no project changes.');
    bridge.disconnect();
    process.exit(0);
  }
  selectedSlots = await findSlots(beforeTracks);
  check('2h-L1: three source slots and one four-row block are positively empty', true, selectedSlots);

  const conformance = await publicSession();
  try {
    const result = await runPublicMusicalConformance({
      slots: selectedSlots,
      call: conformance.call,
      change: (id) => conformance.stash.log.require(id),
      milestone: (name, detail) => check(`2h-L: ${name}`, true, detail),
    });
    check('2h-L2: one live invocation covers the complete public musical contract',
      result.exactProperties.length === 20
        && result.generationStageCount >= 6
        && result.generationPropertyStageCount >= 3,
      result);
  } finally {
    await conformance.close();
  }
  check('2h-L3: conformance cleanup restores the exact baseline',
    await restoreBaseline(baselineObservation));

  const stale = await publicSession();
  const staleActive: string[] = [];
  try {
    const created = await stale.call('add_clip', {
      clips: [{ ...selectedSlots[0], lengthBeats: 8 }],
    });
    const createdId = created['changeId'];
    if (typeof createdId !== 'string') throw new Error('the stale source was not recorded');
    staleActive.push(createdId);
    stale.armStale();
    const rejected = await stale.call('generate_clip_music', {
      schema: 'ghostnote-musical-patch', version: 1, protection: { kind: 'direct' },
      targets: [{
        clip: selectedSlots[0], channel: 0, write: 'replace',
        operations: [{
          op: 'generate', source: { kind: 'notes', notes: [exactMusicalNote()] },
        }],
      }],
    });
    const rejectedId = changeId(rejected);
    const rejectedChange = stale.stash.log.require(rejectedId);
    const read = await stale.call('read_clip', { ...selectedSlots[0], channel: 0 });
    check('2h-L4: a stale public musical patch applies zero stages and zero notes',
      rejected['applied'] === false
        && rejectedChange.take.receipt.stages.length === 0
        && Array.isArray(read['notes'])
        && read['notes'].length === 0,
      rejected);
    const restored = await stale.call('revert_change', { changeId: createdId });
    if (restored['applied'] !== true) throw new Error('the stale source did not reverse');
    staleActive.pop();
  } finally {
    for (const id of staleActive.reverse()) {
      try { await stale.call('revert_change', { changeId: id }); } catch { /* Checked next. */ }
    }
    await stale.close();
  }
  check('2h-L5: stale-revision cleanup restores the exact baseline',
    await restoreBaseline(baselineObservation));

  const one = await measureExpressionWorkload([selectedSlots[0]], baselineObservation);
  const several = await measureExpressionWorkload(selectedSlots, baselineObservation);
  check('2h-L6: measured expression workloads keep the correct 2N path',
    one.stages === 2 && several.stages === 6, { one, several });
  note(`MEASUREMENT ${JSON.stringify({ oneClip: one, threeClips: several })}`);
  check('2h-L7: async completion stays deferred because the named three-clip workload completes',
    several.totalMs > 0 && several.propertyStages === 3, {
      namedUsefulWorkload: 'write full expression to three launcher clips in one MCP request',
      verdict: 'defer-async',
      measurement: several,
    });
  check('2h-L8: live-only overflow and human-interference manufacture remain deliberate skips', true, {
    bankWindow: 'E33 and E39; manufacturing overflow would damage the baseline',
    concurrentHumanEdit: 'E32 and E39; the same public-path cases run against the fake',
  });
} catch (error) {
  check('2h-LX: the live conformance run completed without an unexpected failure', false,
    error instanceof Error ? `${error.name}: ${error.message}` : String(error));
} finally {
  try {
    check('2h-L9: final cleanup restores tracks, clips, cursors, selection, transport, observation, and status',
      await restoreBaseline(baselineObservation));
  } catch (error) {
    check('2h-L9: final cleanup restores the live baseline', false,
      error instanceof Error ? error.message : String(error));
  }
  bridge.disconnect();
}

note(`Phase 2 session 2h musical conformance: ${failureCount() === 0 ? 'PASS' : 'FAILED'}`);
process.exit(failureCount() === 0 ? 0 : 1);
