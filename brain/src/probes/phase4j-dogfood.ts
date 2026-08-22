/** Phase 4 session 4j: natural device-surface dogfood client. */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

import {
  addressKey, chain as chainAt, device as deviceAt, track as trackAt,
} from '../contract/index.js';
import { INSTRUMENT_LAYER_SEED_PATH } from '../device-alternates/assets.js';
import { Session } from '../session.js';
import { workspaceOf } from '../surface/workspace.js';

const PROJECT = '26.05-2 moon';
const TARGET_TRACK = 'Harmony – Open Minor';
const CHORUS = '1b8f2226-c432-4a0a-9830-69bc76d1a276';
const REVERB = '5a1cb339-1c4a-4cc7-9cae-bd7a2058153d';
const ENTRY_DEVICES = [
  { name: 'Key Filter+', enabled: true },
  { name: 'Repro-5', enabled: true },
] as const;
const mode = process.argv[2] ?? 'inspect';
const transport = new StdioClientTransport({ command: 'npx', args: ['tsx', 'src/mcp-server.ts'] });
const mcp = new Client({ name: 'phase4j-dogfood', version: '1.0.0' });

function parse(value: unknown): Record<string, unknown> {
  const result = value as {
    readonly isError?: boolean;
    readonly content?: readonly { readonly type: string; readonly text?: string }[];
  };
  const output = result.content?.find((item) => item.type === 'text')?.text;
  if (result.isError === true || output === undefined) {
    throw new Error(output ?? 'the public MCP call failed');
  }
  return JSON.parse(output) as Record<string, unknown>;
}

async function call(
  name: string,
  args: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const result = parse(await mcp.callTool({ name, arguments: args }));
  console.log(JSON.stringify({ tool: name, args, result }));
  return result;
}

interface Track {
  readonly trackId: string;
  readonly name: string;
}

interface Device {
  readonly position: number;
  readonly name: string;
  readonly enabled?: boolean;
}

interface Parameter {
  readonly id: string;
  readonly name: string;
  readonly normalizedValue: number;
}

async function tracks(): Promise<readonly Track[]> {
  const listed = await call('list_tracks') as { readonly tracks?: readonly Track[] };
  return listed.tracks ?? [];
}

async function targetTrack(): Promise<Track> {
  const matches = (await tracks()).filter((track) => track.name === TARGET_TRACK);
  if (matches.length !== 1) throw new Error(`${TARGET_TRACK} matched ${matches.length} tracks`);
  return matches[0]!;
}

async function devices(trackId: string): Promise<readonly Device[]> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const inspected = await call('inspect_devices', { trackId }) as {
      readonly complete?: boolean;
      readonly devices?: readonly Device[];
    };
    if (inspected.complete === true
        && inspected.devices?.every((device) => typeof device.enabled === 'boolean') === true) {
      return inspected.devices;
    }
  }
  throw new Error('the complete enabled device chain is unavailable after three reads');
}

function expected(devices: readonly Device[]): readonly { name: string; enabled: boolean }[] {
  return devices.map((device) => ({ name: device.name, enabled: device.enabled! }));
}

function sameChain(
  actual: readonly Device[],
  wanted: readonly { readonly name: string; readonly enabled: boolean }[],
): boolean {
  return actual.length === wanted.length && actual.every((device, index) =>
    device.position === index
      && device.name === wanted[index]?.name
      && device.enabled === wanted[index]?.enabled);
}

async function inspectCandidate(trackId: string): Promise<void> {
  for (const devicePosition of [2, 3]) {
    await call('inspect_device_parameters', {
      device: { trackId, devicePosition },
      view: 'direct',
    });
  }
}

async function parameterInventory(trackId: string, devicePosition: number): Promise<readonly Parameter[]> {
  const inventory = await call('inspect_device_parameters', {
    device: { trackId, devicePosition },
    view: 'direct',
  }) as { readonly standing?: string; readonly parameters?: readonly Parameter[] };
  if (inventory.standing !== 'stable') {
    throw new Error(`device ${devicePosition} parameter standing is ${String(inventory.standing)}`);
  }
  return inventory.parameters ?? [];
}

function parameter(
  inventory: readonly Parameter[],
  name: string,
): Parameter {
  const matches = inventory.filter((item) => item.name === name);
  if (matches.length !== 1) throw new Error(`${name} matched ${matches.length} parameters`);
  return matches[0]!;
}

async function tuneCandidate(trackId: string): Promise<void> {
  const chain = await devices(trackId);
  const wanted = [...ENTRY_DEVICES, { name: 'Chorus+', enabled: true }, { name: 'Reverb', enabled: true }];
  if (!sameChain(chain, wanted)) {
    throw new Error(`the candidate chain differs before tuning: ${JSON.stringify(chain)}`);
  }
  const chorus = await parameterInventory(trackId, 2);
  const reverb = await parameterInventory(trackId, 3);
  const settings = [
    [2, parameter(chorus, 'LFO Speed').id, 0.22],
    [2, parameter(chorus, 'Modulation Depth').id, 0.35],
    [2, parameter(chorus, 'Mix').id, 0.30],
    [3, parameter(reverb, 'Room Size').id, 0.68],
    [3, parameter(reverb, 'Reverb Time').id, 0.42],
    [3, parameter(reverb, 'Mix').id, 0.22],
    [3, parameter(reverb, 'Stereo Width').id, 0.72],
  ] as const;
  const changed = await call('set_parameter', {
    settings: settings.map(([devicePosition, parameterId, normalizedValue]) => ({
      kind: 'direct',
      device: { trackId, devicePosition },
      parameterId,
      normalizedValue,
    })),
  });
  if (changed['verified'] !== true) throw new Error('the candidate tuning did not verify');
  await inspectCandidate(trackId);
}

async function reviseCandidate(trackId: string): Promise<void> {
  const chain = await devices(trackId);
  const wanted = [...ENTRY_DEVICES, { name: 'Chorus+', enabled: true }, { name: 'Reverb', enabled: true }];
  if (!sameChain(chain, wanted)) {
    throw new Error(`the candidate chain differs before revision: ${JSON.stringify(chain)}`);
  }
  const reverb = await parameterInventory(trackId, 3);
  const settings = [
    [parameter(reverb, 'Room Size').id, 0.72],
    [parameter(reverb, 'Reverb Time').id, 0.50],
    [parameter(reverb, 'Mix').id, 0.38],
    [parameter(reverb, 'Stereo Width').id, 0.78],
    [parameter(reverb, 'Low Band Reverb Factor').id, 0.10],
    [parameter(reverb, 'High Band Reverb Factor').id, 0.46],
  ] as const;
  const changed = await call('set_parameter', {
    settings: settings.map(([parameterId, normalizedValue]) => ({
      kind: 'direct',
      device: { trackId, devicePosition: 3 },
      parameterId,
      normalizedValue,
    })),
  });
  if (changed['verified'] !== true) throw new Error('the candidate revision did not verify');
  await inspectCandidate(trackId);
}

async function setCandidateEnabled(trackId: string, enabled: boolean): Promise<void> {
  const chain = await devices(trackId);
  const wantedNames = [...ENTRY_DEVICES.map((item) => item.name), 'Chorus+', 'Reverb'];
  if (chain.map((item) => item.name).join('|') !== wantedNames.join('|')) {
    throw new Error(`the candidate chain differs before bypass: ${JSON.stringify(chain)}`);
  }
  const changed = await call('set_device_enabled', {
    settings: [2, 3].map((devicePosition) => ({ trackId, devicePosition, enabled })),
  });
  if (changed['verified'] !== true) throw new Error('the candidate enabled state did not verify');
}

async function prepareObservableAlternateContainer(trackId: string): Promise<void> {
  const session = new Session();
  try {
    await session.ready();
    const workspace = workspaceOf({
      ready: async () => { await session.ready(); },
      get adapter() { return session.bitwig; },
      get executor() { return session.executor; },
      stash: session.stash,
      observationStore: session.observations,
    });
    const track = trackAt(trackId);
    const starting = await workspace.devices(track);
    const startingNames = ['Key Filter+', 'Repro-5', 'Chorus+', 'Reverb', 'Instrument Layer'];
    if (!starting.devicesComplete
        || starting.devices.map((item) => item.name).join('|') !== startingNames.join('|')
        || starting.devices.some((item) => typeof item.enabled !== 'boolean')) {
      throw new Error(`the post-insert order differs: ${JSON.stringify(starting)}`);
    }
    const relocated = await workspace.apply([{
      op: 'device.relocate',
      track,
      sourceFromEnd: 0,
      expectedName: 'Instrument Layer',
      before: deviceAt(track, 1),
      expectedChain: startingNames,
      expectedEnabledChain: starting.devices.map((item) => item.enabled!),
    }]);
    console.log(JSON.stringify({ internal: 'relocate-alternate-container', report: relocated.take.report }));
    if (!relocated.take.report.applied || relocated.take.report.disagreements.length > 0) {
      throw new Error('the alternate container relocation did not verify');
    }

    const reordered = await workspace.devices(track);
    const reorderedNames = ['Key Filter+', 'Instrument Layer', 'Repro-5', 'Chorus+', 'Reverb'];
    if (!reordered.devicesComplete
        || reordered.devices.map((item) => item.name).join('|') !== reorderedNames.join('|')) {
      throw new Error(`the relocated order differs: ${JSON.stringify(reordered)}`);
    }

    const container = deviceAt(track, 1);
    const snapshot = await workspace.read([container]);
    const entry = snapshot.entries[addressKey(container)];
    const observed = entry?.value.of === 'device' ? entry.value.device.container : undefined;
    if (observed?.chainsComplete !== true || observed.chains.length !== 1
        || observed.chains[0]?.devices.length !== 0) {
      throw new Error(`the empty alternate seed differs: ${JSON.stringify(observed)}`);
    }
    const seedName = observed.chains[0]!.name;
    const named = await workspace.apply([{
      op: 'chain.rename',
      chain: chainAt(container, seedName),
      name: 'Original',
    }]);
    console.log(JSON.stringify({ internal: 'name-original-alternate', report: named.take.report }));
    if (!named.take.report.applied || named.take.report.disagreements.length > 0) {
      throw new Error('the Original alternate name did not verify');
    }
    const created = await workspace.apply([{
      op: 'chain.create',
      source: chainAt(container, 'Original'),
      name: 'Revised',
    }]);
    console.log(JSON.stringify({ internal: 'create-revised-alternate', report: created.take.report }));
    if (!created.take.report.applied || created.take.report.disagreements.length > 0) {
      throw new Error('the Revised alternate did not verify');
    }
  } finally {
    await session.close();
  }
}

async function makeAlternates(trackId: string): Promise<void> {
  const entry = await devices(trackId);
  const candidate = [...ENTRY_DEVICES, { name: 'Chorus+', enabled: true }, { name: 'Reverb', enabled: true }];
  if (!sameChain(entry, candidate)) {
    throw new Error(`the candidate chain differs before A/B setup: ${JSON.stringify(entry)}`);
  }
  const inserted = await call('add_device', {
    devices: [{
      trackId,
      from: 'preset',
      path: INSTRUMENT_LAYER_SEED_PATH,
      expectedDevices: expected(entry),
    }],
  });
  if (inserted['applied'] !== true) throw new Error('the alternate container did not insert');

  await prepareObservableAlternateContainer(trackId);
  const empty = await call('inspect_device_alternates', { trackId, containerPosition: 1 }) as {
    readonly readable?: boolean;
    readonly complete?: boolean;
    readonly alternates?: readonly { readonly name: string; readonly devices: readonly unknown[] }[];
  };
  if (empty.readable !== true || empty.complete !== true
      || empty.alternates?.map((item) => item.name).join('|') !== 'Original|Revised'
      || empty.alternates.some((item) => item.devices.length !== 0)) {
    throw new Error(`the empty alternate structure differs: ${JSON.stringify(empty)}`);
  }

  const original = await call('fill_device_alternate', {
    trackId,
    containerPosition: 1,
    alternateName: 'Original',
    sourceDevicePositions: [2],
    mode: 'copy',
  });
  if (original['applied'] !== true) throw new Error('the Original alternate did not fill');

  const revised = await call('fill_device_alternate', {
    trackId,
    containerPosition: 1,
    alternateName: 'Revised',
    sourceDevicePositions: [2, 3, 4],
    mode: 'move',
  });
  if (revised['applied'] !== true) throw new Error('the Revised alternate did not fill');

  const finalDevices = await devices(trackId);
  const finalNames = ['Key Filter+', 'Instrument Layer'];
  if (finalDevices.map((item) => item.name).join('|') !== finalNames.join('|')) {
    throw new Error(`the final top-level order differs: ${JSON.stringify(finalDevices)}`);
  }
  const structure = await call('inspect_device_alternates', { trackId, containerPosition: 1 });
  const active = await call('switch_device_alternate', {
    trackId,
    containerPosition: 1,
    alternateName: 'Original',
  });
  if (active['exclusiveStateConfirmed'] !== true) {
    throw new Error('the Original alternate was not exclusively active');
  }
  console.log(JSON.stringify({ dogfoodAlternates: structure }));
}

async function inspectAlternates(trackId: string): Promise<void> {
  await call('inspect_device_alternates', { trackId, containerPosition: 1 });
  for (const devicePosition of [1, 2]) {
    await call('inspect_device_parameters', {
      device: {
        trackId,
        devicePosition: 1,
        route: [{
          through: 'named-container-entry',
          name: 'Revised',
          devicePosition,
        }],
      },
      view: 'direct',
    });
  }
}

async function keepRevised(trackId: string): Promise<void> {
  const before = await call('inspect_device_alternates', { trackId, containerPosition: 1 }) as {
    readonly readable?: boolean;
    readonly complete?: boolean;
    readonly alternates?: readonly { readonly name: string }[];
  };
  if (before.readable !== true || before.complete !== true
      || before.alternates?.map((item) => item.name).join('|') !== 'Original|Revised') {
    throw new Error(`the alternate structure differs before collapse: ${JSON.stringify(before)}`);
  }
  const kept = await call('keep_device_alternate', {
    trackId,
    containerPosition: 1,
    alternateName: 'Revised',
  });
  if (kept['applied'] !== true
      || kept['containerRemoved'] !== true
      || kept['finalPositionConfirmed'] !== true) {
    throw new Error('the Revised winner collapse did not verify');
  }
  const final = await devices(trackId);
  const wanted = [...ENTRY_DEVICES, { name: 'Chorus+', enabled: true }, { name: 'Reverb', enabled: true }];
  if (!sameChain(final, wanted)) {
    throw new Error(`the collapsed winner order differs: ${JSON.stringify(final)}`);
  }
  await inspectCandidate(trackId);
}

async function cleanupCandidate(trackId: string): Promise<void> {
  const chain = await devices(trackId);
  const wanted = [...ENTRY_DEVICES, { name: 'Chorus+', enabled: true }, { name: 'Reverb', enabled: true }];
  if (sameChain(chain, ENTRY_DEVICES)) return;
  if (!sameChain(chain, wanted)) {
    throw new Error(`refusing cleanup of an unexpected chain: ${JSON.stringify(chain)}`);
  }
  const removed = await call('delete_device', {
    devices: [{ trackId, position: 3 }, { trackId, position: 2 }],
  });
  if (removed['verified'] !== true) throw new Error('candidate cleanup did not verify');
}

try {
  await mcp.connect(transport);
  const connection = await call('check_connection');
  if (connection['project'] !== PROJECT) {
    throw new Error(`expected project ${PROJECT}, got ${String(connection['project'])}`);
  }

  if (mode === 'inspect') {
    for (const track of await tracks()) {
      await call('inspect_devices', { trackId: track.trackId });
    }
  } else if (mode === 'build') {
    const track = await targetTrack();
    const entry = await devices(track.trackId);
    if (!sameChain(entry, ENTRY_DEVICES)) {
      throw new Error(`the target is not at its entry chain: ${JSON.stringify(entry)}`);
    }
    try {
      for (const source of [
        { id: CHORUS, name: 'Chorus+' },
        { id: REVERB, name: 'Reverb' },
      ]) {
        const before = await devices(track.trackId);
        const added = await call('add_device', {
          devices: [{
            trackId: track.trackId,
            from: 'bitwig',
            id: source.id,
            expectedDevices: expected(before),
          }],
        });
        if (added['applied'] !== true) throw new Error(`${source.name} did not insert`);
      }
      const built = await devices(track.trackId);
      const wanted = [
        ...ENTRY_DEVICES,
        { name: 'Chorus+', enabled: true },
        { name: 'Reverb', enabled: true },
      ];
      if (!sameChain(built, wanted)) throw new Error(`the candidate chain differs: ${JSON.stringify(built)}`);
      await inspectCandidate(track.trackId);
    } catch (error) {
      await cleanupCandidate(track.trackId);
      throw error;
    }
  } else if (mode === 'inspect-candidate') {
    await inspectCandidate((await targetTrack()).trackId);
  } else if (mode === 'tune') {
    await tuneCandidate((await targetTrack()).trackId);
  } else if (mode === 'revise') {
    await reviseCandidate((await targetTrack()).trackId);
  } else if (mode === 'bypass') {
    await setCandidateEnabled((await targetTrack()).trackId, false);
  } else if (mode === 'enable') {
    await setCandidateEnabled((await targetTrack()).trackId, true);
  } else if (mode === 'make-alternates') {
    await makeAlternates((await targetTrack()).trackId);
  } else if (mode === 'inspect-alternates') {
    await inspectAlternates((await targetTrack()).trackId);
  } else if (mode === 'keep-revised') {
    await keepRevised((await targetTrack()).trackId);
  } else if (mode === 'cleanup') {
    await cleanupCandidate((await targetTrack()).trackId);
  } else {
    throw new Error(`unknown mode: ${mode}`);
  }
} finally {
  await mcp.close();
}
