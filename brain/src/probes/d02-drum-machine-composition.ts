/** D02 Session 1 live proof for public native Drum Machine composition. */
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

const TRACK_NAME = 'gn-d02-s1-drum-machine';
const PADS = [
  { midiNote: 36, padChannel: 0, deviceName: 'v1 Kick' },
  { midiNote: 38, padChannel: 2, deviceName: 'v1 Snare' },
  { midiNote: 42, padChannel: 6, deviceName: 'v1 Hat' },
  { midiNote: 46, padChannel: 10, deviceName: 'v0 Hat' },
] as const;

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
  const server = new McpServer({ name: 'ghostnote-d02-proof', version: '0.0.1' });
  registerTools(server, workspace);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  mcp = new Client({ name: 'd02-drum-machine-proof', version: '1.0.0' });
  await server.connect(serverTransport);
  await mcp.connect(clientTransport);
  const listed = await mcp.listTools();
  const publicTool = listed.tools.find((tool) => tool.name === 'compose_drum_machine');
  const schema = publicTool?.inputSchema as {
    readonly properties?: Record<string, { readonly items?: { readonly properties?: object } }>;
    readonly required?: readonly string[];
  } | undefined;
  check('d02-s1-M1: tools/list exposes the public tool with its compatible schema',
    listed.tools.length === 46
      && publicTool !== undefined
      && JSON.stringify(schema?.required) === JSON.stringify(['trackId', 'pads'])
      && JSON.stringify(Object.keys(schema?.properties ?? {})) === JSON.stringify(['trackId', 'pads'])
      && JSON.stringify(Object.keys(schema?.properties?.['pads']?.items?.properties ?? {}))
        === JSON.stringify(['midiNote', 'deviceName']),
    { toolCount: listed.tools.length, tool: publicTool });

  const result = parseToolResult(await mcp.callTool({
    name: 'compose_drum_machine',
    arguments: {
      trackId: ownedTrack.channelId,
      pads: PADS.map(({ midiNote, deviceName }) => ({ midiNote, deviceName })),
    },
  })) as {
    readonly applied?: boolean;
    readonly containerKind?: string | null;
    readonly requested?: readonly typeof PADS[number][];
    readonly observed?: {
      readonly verified: boolean;
      readonly containerKind: string | null;
      readonly pads: readonly {
        readonly midiNote: number;
        readonly padChannel: number;
        readonly requestedDeviceName: string;
        readonly observedDeviceName: string | null;
        readonly verified: boolean;
      }[];
    };
    readonly verification?: { readonly verified: boolean };
    readonly change?: { readonly changeId: string };
  };

  check('d02-s1-L1: one public call records one owned Drum Machine insertion',
    result.applied === true
      && result.containerKind === 'Drum Machine'
      && typeof result.change?.changeId === 'string'
      && stash.log.list().length === 1,
    result);
  check('d02-s1-L2: MIDI notes map to the exact reachable pad channels',
    JSON.stringify(result.requested) === JSON.stringify(PADS),
    result.requested);
  check('d02-s1-L3: four separate pads contain the four exact native devices',
    result.observed?.verified === true
      && result.verification?.verified === true
      && result.observed.containerKind === 'Drum Machine'
      && result.observed.pads.length === 4
      && result.observed.pads.every((item, index) =>
        item.verified
          && item.midiNote === PADS[index]!.midiNote
          && item.padChannel === PADS[index]!.padChannel
          && item.requestedDeviceName === PADS[index]!.deviceName
          && item.observedDeviceName === PADS[index]!.deviceName),
    result.observed);

  if (result.change?.changeId === undefined) throw new Error('the composition returned no change id');
  const reversed = parseToolResult(await mcp.callTool({
    name: 'revert_change',
    arguments: { changeId: result.change.changeId },
  })) as {
    readonly applied?: boolean;
    readonly failed?: readonly unknown[];
    readonly notRestored?: readonly unknown[];
    readonly caveats?: readonly unknown[];
  };
  const devices = await adapter.devices(ownedTrack);
  check('d02-s1-L4: reversal removes the complete owned Drum Machine',
    reversed.applied === true
      && (reversed.failed?.length ?? 0) === 0
      && (reversed.notRestored?.length ?? 0) === 0
      && (reversed.caveats?.length ?? 0) === 0
      && devices.devicesComplete
      && devices.devices.length === 0,
    { reversed, devices });
} catch (error) {
  check('d02-s1-LX: the focused public proof completed without an unexpected failure', false,
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
      check('d02-s1-cleanup: owned content was removed', false,
        error instanceof Error ? error.message : String(error));
    }
  }
  try {
    const finalTracks = await adapter.tracks();
    check('d02-s1-cleanup: the exact entry track list is restored',
      sameTracks(finalTracks, entryTracks),
      { entry: entryTracks, final: finalTracks });
  } catch (error) {
    check('d02-s1-cleanup: final inventory completed', false,
      error instanceof Error ? error.message : String(error));
  }
  await mcp?.close();
  await adapter.close();
}

console.log(failureCount() === 0 ? '\nD02 Session 1: ALL PASS' : `\nD02 Session 1: ${failureCount()} FAILURE(S)`);
process.exit(failureCount() === 0 ? 0 : 1);
