/** D02 Session 6 live proof for exact-name top-level native insertion. */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { LiveAdapter } from '../adapters/live/adapter.js';
import { track, type TrackAddress, type TrackState } from '../contract/index.js';
import { Executor } from '../engine/index.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { registerTools } from '../surface/tools.js';
import { workspaceOf } from '../surface/workspace.js';
import { check, failureCount, note } from './lib.js';

const TRACK_NAME = 'gn-d02-s6-native-insertion';
const DEVICE_NAMES = ['Polysynth', 'Delay+'] as const;

const adapter = new LiveAdapter();
let ownedTrack: TrackAddress | undefined;
let entryTracks: readonly TrackState[] = [];
let mcp: Client | undefined;

function parseToolResult(value: unknown): Record<string, unknown> {
  const content = (value as { content?: { type: string; text?: string }[] }).content ?? [];
  const raw = content.find((item) => item.type === 'text')?.text;
  if (raw === undefined) throw new Error('the MCP call returned no text result');
  return JSON.parse(raw) as Record<string, unknown>;
}

function sameTracks(left: readonly TrackState[], right: readonly TrackState[]): boolean {
  return JSON.stringify(left.map((item) => [item.channelId, item.name, item.position, item.type]))
    === JSON.stringify(right.map((item) => [item.channelId, item.name, item.position, item.type]));
}

try {
  const hello = await adapter.hello();
  note(`Bitwig ${hello.host?.version ?? 'unknown'}; contract ${hello.contractVersion}`);
  const entryRevision = await adapter.revision();
  note(`Project ${entryRevision.project}; revision ${entryRevision.revision}; content epoch ${entryRevision.contentEpoch}`);
  entryTracks = await adapter.tracks();
  const created = await adapter.apply({ ops: [{ op: 'track.create', name: TRACK_NAME }] });
  await adapter.settle('trackStruct');
  const mint = created.minted[0];
  if (mint?.kind !== 'track') throw new Error('the owned track returned no durable id');
  ownedTrack = track(mint.channelId);

  const stash = new Stash();
  const workspace = workspaceOf({
    ready: async () => undefined,
    adapter,
    executor: new Executor(adapter),
    stash,
    observationStore: new FakeObservationStore(),
  });
  const server = new McpServer({ name: 'ghostnote-d02-s6-proof', version: '0.0.1' });
  registerTools(server, workspace);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  mcp = new Client({ name: 'd02-native-insertion-proof', version: '1.0.0' });
  await server.connect(serverTransport);
  await mcp.connect(clientTransport);

  const listed = await mcp.listTools();
  const publicTool = listed.tools.find((tool) => tool.name === 'add_native_devices');
  const schema = publicTool?.inputSchema as {
    readonly properties?: Record<string, unknown>;
    readonly required?: readonly string[];
  } | undefined;
  check('d02-s6-M1: tools/list exposes the compatible exact-name schema',
    listed.tools.length === 47
      && publicTool !== undefined
      && JSON.stringify(schema?.required) === JSON.stringify(['trackId', 'deviceNames'])
      && JSON.stringify(Object.keys(schema?.properties ?? {}))
        === JSON.stringify(['trackId', 'deviceNames'])
      && !JSON.stringify(schema).toLowerCase().includes('uuid'),
    { toolCount: listed.tools.length, tool: publicTool });

  const result = parseToolResult(await mcp.callTool({
    name: 'add_native_devices',
    arguments: { trackId: ownedTrack.channelId, deviceNames: DEVICE_NAMES },
  })) as {
    readonly applied?: boolean;
    readonly partialSuccess?: boolean;
    readonly verified?: boolean;
    readonly added?: readonly {
      readonly deviceName: string;
      readonly position: number;
      readonly verified: boolean;
      readonly change: { readonly changeId: string };
    }[];
  };
  check('d02-s6-L1: one public call appends two verified top-level native devices',
    result.applied === true
      && result.partialSuccess === false
      && result.verified === true
      && result.added?.length === 2
      && result.added.every((item, index) => item.deviceName === DEVICE_NAMES[index]
        && item.position === index && item.verified),
    result);
  const devices = await adapter.devices(ownedTrack);
  check('d02-s6-L2: complete readback is Polysynth then Delay+',
    devices.devicesComplete
      && devices.devices.length === 2
      && devices.devices.every((device, index) =>
        device.index === index && device.name === DEVICE_NAMES[index] && device.enabled === true),
    devices);

  for (const [reversalIndex, item] of [...(result.added ?? [])].reverse().entries()) {
    const reversed = parseToolResult(await mcp.callTool({
      name: 'revert_change',
      arguments: { changeId: item.change.changeId },
    }));
    check(`d02-s6-L${reversalIndex + 3}: reversal removes ${item.deviceName}`,
      reversed['applied'] === true
        && ((reversed['failed'] as readonly unknown[] | undefined)?.length ?? 0) === 0
        && ((reversed['notRestored'] as readonly unknown[] | undefined)?.length ?? 0) === 0
        && ((reversed['caveats'] as readonly unknown[] | undefined)?.length ?? 0) === 0,
      reversed);
  }
  const empty = await adapter.devices(ownedTrack);
  check('d02-s6-L5: reversal restores the empty owned track',
    empty.devicesComplete && empty.devices.length === 0,
    empty);
} catch (error) {
  check('d02-s6-LX: the focused public proof completed without an unexpected failure', false,
    error instanceof Error ? `${error.name}: ${error.message}` : String(error));
} finally {
  if (ownedTrack !== undefined) {
    try {
      const devices = await adapter.devices(ownedTrack);
      for (const device of [...devices.devices].reverse()) {
        await adapter.apply({ ops: [{
          op: 'device.delete',
          device: { kind: 'device', track: ownedTrack, chainIndex: device.index },
        }] });
        await adapter.settle('trackStruct');
      }
      await adapter.apply({ ops: [{ op: 'track.delete', track: ownedTrack }] });
      await adapter.settle('trackStruct');
    } catch (error) {
      check('d02-s6-cleanup: owned content was removed', false,
        error instanceof Error ? error.message : String(error));
    }
  }
  try {
    const finalTracks = await adapter.tracks();
    check('d02-s6-cleanup: the exact entry track list is restored',
      sameTracks(finalTracks, entryTracks),
      { entry: entryTracks, final: finalTracks });
  } catch (error) {
    check('d02-s6-cleanup: final inventory completed', false,
      error instanceof Error ? error.message : String(error));
  }
  await mcp?.close();
  await adapter.close();
}

console.log(failureCount() === 0
  ? '\nD02 Session 6: ALL PASS'
  : `\nD02 Session 6: ${failureCount()} FAILURE(S)`);
process.exit(failureCount() === 0 ? 0 : 1);
