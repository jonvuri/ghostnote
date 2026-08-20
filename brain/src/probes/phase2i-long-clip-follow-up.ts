/** Phase 2i follow-up: public long-clip metadata, paged notes, and reversal. */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { LiveAdapter } from '../adapters/live/adapter.js';
import { LiveObservationStore } from '../adapters/live/observation-store.js';
import { BridgeTransport } from '../adapters/live/transport.js';
import {
  addressKey, clip as clipAt, clipMetadata as metadataAt,
  scene as sceneAt, slot as slotAt, track as trackAt,
} from '../contract/index.js';
import { Executor } from '../engine/index.js';
import { Stash } from '../stash/index.js';
import { registerTools } from '../surface/tools.js';
import { workspaceOf } from '../surface/workspace.js';
import { check, client as bridge, failureCount, note, point } from './lib.js';

interface TrackRow {
  readonly index: number;
  readonly name: string;
  readonly channelId: string;
}

interface Selection {
  readonly trackIndex: number;
  readonly slotIndex: number;
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

async function slotOccupied(trackIndex: number, row: number): Promise<boolean> {
  const result = await bridge.request('slot.status', { trackIndex, slotIndex: row }) as {
    readonly hasContent?: boolean;
  };
  return result.hasContent === true;
}

await bridge.connect();
const baseTransport = new BridgeTransport(bridge);
const writer = new LiveAdapter({ transport: baseTransport });
const active: string[] = [];
let mcp: Client | undefined;
let server: McpServer | undefined;
let target: { trackId: string; row: number; trackIndex: number } | undefined;
let initialSelection: Selection | undefined;

try {
  await writer.hello();
  const adapter = writer;
  const transport = new BridgeTransport(bridge);
  const workspace = workspaceOf({
    ready: async () => undefined,
    adapter,
    executor: new Executor(adapter),
    stash: new Stash(),
    observationStore: new LiveObservationStore({
      transport,
      projectName: async () => (await writer.revision()).project,
    }),
  });
  server = new McpServer({ name: 'ghostnote-2i-long-clip', version: '1.0.0' });
  registerTools(server, workspace);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  mcp = new Client({ name: 'phase-2i-long-clip', version: '1.0.0' });
  await server.connect(serverTransport);
  await mcp.connect(clientTransport);
  const call = async (name: string, args: Record<string, unknown> = {}) =>
    parse(await mcp!.callTool({ name, arguments: args }));
  const reverse = async (id: string) => {
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
  let row: number | undefined;
  for (let candidate = 4; candidate < sceneCount; candidate += 1) {
    if (!(await slotOccupied(lead.index, candidate))) {
      row = candidate;
      break;
    }
  }
  if (row === undefined) throw new Error('the Lead track has no disposable empty row after the accepted clips');
  target = { trackId: lead.channelId, row, trackIndex: lead.index };
  initialSelection = await bridge.request('selection.status') as Selection;
  check('2i-long-L0: the disposable target is outside the accepted rows and positively empty',
    row >= 4 && !(await slotOccupied(lead.index, row)), target);

  const created = await call('add_clip', {
    clips: [{ trackId: target.trackId, row: target.row, lengthBeats: 32 }],
  });
  if (typeof created['changeId'] !== 'string') throw new Error('clip creation returned no change id');
  active.push(created['changeId']);
  const afterCreate = await writer.revision();
  const metadataAddress = metadataAt(clipAt(slotAt(
    trackAt(target.trackId), sceneAt(target.row, afterCreate.sceneEpoch),
  )));
  const directMetadata = await writer.read([metadataAddress]);
  check('2i-long-L0a: the new 32-beat clip has readable metadata before its public update',
    directMetadata.entries[addressKey(metadataAddress)]?.value.of === 'clipMetadata',
    directMetadata.entries[addressKey(metadataAddress)]);

  const metadata = {
    name: 'gn-2i-four-phrases', color: { red: 31, green: 159, blue: 223 },
    lengthBeats: 128, playStartBeats: 0, loopEnabled: true,
    loopStartBeats: 0, loopEndBeats: 128,
  };
  const extended = await call('set_clip_metadata', {
    clips: [{ trackId: target.trackId, row: target.row, metadata }],
  }) as {
    readonly applied?: boolean;
    readonly changeId?: string;
    readonly clips?: readonly { readonly metadataVerified?: boolean; readonly metadata?: unknown }[];
  };
  if (typeof extended.changeId !== 'string') {
    throw new Error(`metadata update returned no change id: ${JSON.stringify(extended)}`);
  }
  active.push(extended.changeId);
  const independentPoint = await point('fine', target.trackIndex, target.row, 'trackThenSlot');
  const independentMetadata = independentPoint.ok
    ? await bridge.request('cursor.clipMetadata', { cursor: 'fine' }) as Record<string, unknown>
    : undefined;
  check('2i-long-L1: one public request extends 32 beats to four phrases with exact readback',
    extended.applied === true
      && extended.clips?.[0]?.metadataVerified === true
      && independentMetadata?.['loopLength'] === 128
      && independentMetadata['name'] === metadata.name,
    { publicReadback: extended.clips?.[0], independentMetadata });

  const written = await call('write_notes', {
    clips: [{
      trackId: target.trackId,
      row: target.row,
      channel: 7,
      notes: [
        { startBeats: 1, pitch: 60, velocity: 90, durationBeats: 1 / 64 },
        { startBeats: 96, pitch: 72, velocity: 80, durationBeats: 1 / 64, pan: -0.25 },
      ],
    }],
  });
  if (typeof written['changeId'] !== 'string') throw new Error('note write returned no change id');
  active.push(written['changeId']);
  const read = await call('read_clip', {
    trackId: target.trackId, row: target.row, channel: 7,
  }) as {
    readonly lengthBeats?: number;
    readonly notes?: readonly { readonly startBeats: number; readonly pitch: number; readonly pan?: number }[];
  };
  check('2i-long-L2: the exact note and expression beyond page one land on channel 7 at beat 96',
    read.lengthBeats === 128
      && read.notes?.some((item) =>
        item.startBeats === 96 && item.pitch === 72 && item.pan === -0.25) === true,
    read);

  await reverse(written['changeId']);
  await reverse(extended.changeId);
  const restored = await call('read_clip', {
    trackId: target.trackId, row: target.row, channel: 7,
  }) as { readonly lengthBeats?: number; readonly notes?: readonly unknown[] };
  check('2i-long-L3: reversal restores the prior 32-beat metadata and empty notes',
    restored.lengthBeats === 32 && restored.notes?.length === 0, restored);
  await reverse(created['changeId']);
  check('2i-long-L4: the owned disposable clip is removed',
    !(await slotOccupied(target.trackIndex, target.row)));
} catch (error) {
  check('2i-long-LX: the live follow-up completed without an unexpected failure', false,
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
  const clean = target !== undefined
    && !(await slotOccupied(target.trackIndex, target.row))
    && active.length === 0;
  check('2i-long-L5: final cleanup leaves no clip residue and no active reversal', clean, { active, target });
  await mcp?.close();
  await server?.close();
  bridge.disconnect();
}

note(`Phase 2 session 2i long-clip follow-up: ${failureCount() === 0 ? 'PASS' : 'FAILED'}`);
process.exit(failureCount() === 0 ? 0 : 1);
