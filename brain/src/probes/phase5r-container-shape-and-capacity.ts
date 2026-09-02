/** Focused live proof for bounded container shapes and capacities. */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { LiveAdapter } from '../adapters/live/adapter.js';
import { device, track, type TrackAddress, type TrackState } from '../contract/index.js';
import { Executor, fingerprintPreset } from '../engine/index.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { callTool } from '../surface/tools.js';
import { workspaceOf, type Workspace } from '../surface/workspace.js';
import { check, client, failureCount, note } from './lib.js';

const TRACK_NAME = 'gn-p5r-container-shape-capacity';
const DELAY_UUID = 'f2baa2a8-36c5-4a79-b1d9-a4e461c45ee9';
const TARGET = { parameterId: 'CONTENTS/F1FREQ', parameterName: 'Filter Frequency' };
const NESTED_PRESET = join(
  import.meta.dirname, '..', '..', 'fixtures', 'InstrumentLayer', 'gn_layer_4chain.bwpreset',
);
const OUTER = {
  location: 'container', modulator: 'lfo', target: TARGET, amount: 1,
} as const;

function sameTracks(left: readonly TrackState[], right: readonly TrackState[]): boolean {
  return JSON.stringify(left.map((item) => [item.channelId, item.name, item.position, item.type]))
    === JSON.stringify(right.map((item) => [item.channelId, item.name, item.position, item.type]));
}

async function composeAndReverse(
  workspace: Workspace,
  adapter: LiveAdapter,
  ownedTrack: TrackAddress,
  request: Record<string, unknown>,
  label: string,
  expectedEntries: number,
  expectedDevices: number,
  expectedWitnessEntry: number,
  expectedWitnessDevice: number,
): Promise<void> {
  const composed = await callTool(workspace, 'compose_device_sources', request) as {
    complete?: boolean;
    capacities?: Record<string, number>;
    entries?: readonly {
      entryIndex: number;
      deviceIndex: number;
      behaviors: readonly { verified: boolean; maximumDivergence: number }[];
    }[];
    structure?: readonly { devices: readonly unknown[] }[];
    reversalCheckpoint?: unknown;
  };
  const witnesses = (composed.entries ?? []).flatMap((entry) =>
    entry.behaviors.map((behavior) => ({
      entryIndex: entry.entryIndex, deviceIndex: entry.deviceIndex, behavior,
    })));
  const expectedWitness = witnesses.find((item) =>
    item.entryIndex === expectedWitnessEntry && item.deviceIndex === expectedWitnessDevice);
  check(`${label}: structure, active modulation, and public capacities pass`,
    composed.complete === true
      && composed.structure?.length === expectedEntries
      && composed.structure.every((entry) => entry.devices.length === expectedDevices)
      && witnesses.length === 1
      && expectedWitness?.behavior.verified === true
      && expectedWitness.behavior.maximumDivergence > 0
      && JSON.stringify(composed.capacities) === JSON.stringify({
        topLevelContainerPositions: 3,
        entriesPerLayer: 5,
        devicesPerEntry: 4,
        parameterRouteDepth: 2,
      }), composed);

  const reversed = await callTool(workspace, 'reverse_device_source_composition', {
    checkpoint: composed.reversalCheckpoint,
  }) as { complete?: boolean; containerRemoved?: boolean; restoredDeviceOrder?: boolean };
  const after = await adapter.devices(ownedTrack);
  check(`${label}: reversal restores the exact prior top-level order`,
    reversed.complete === true && reversed.containerRemoved === true
      && reversed.restoredDeviceOrder === true && after.devicesComplete,
    { reversed, after });
}

const info = await client.request('rig.info') as Record<string, number>;
const stats = await client.request('rig.stats') as {
  resources?: Record<string, number>;
  initEpochMs?: number;
};
check('5r-resources: the deployed extension reports each selected capacity',
  info.containerScopes === 3 && info.containerEntryBank === 5
    && info.containerEntryDeviceBank === 4 && info.parameterRouteDepth === 2,
  { info, resources: stats.resources });
check('5r-resources: resource accounting includes layer and named-slot observers',
  stats.resources?.slotDeviceBanks === 15
    && stats.resources?.namedSlotDeviceBanks === 0
    && stats.resources?.slotDeviceSlots === 60
    && stats.resources?.namedSlotDeviceSlots === 0,
  stats.resources);

const adapter = new LiveAdapter();
const keepAlive = setInterval(() => undefined, 1_000);
let ownedTrack: TrackAddress | undefined;
let entryTracks: readonly TrackState[] = [];
const entrySceneCount = info.sceneCount;

try {
  const hello = await adapter.hello();
  note(`Bitwig ${hello.host?.version ?? 'unknown'}; extension started ${stats.initEpochMs ?? -1}`);
  entryTracks = await adapter.tracks();
  const created = await adapter.apply({ ops: [{ op: 'track.create', name: TRACK_NAME }] });
  await adapter.settle('trackStruct');
  const mint = created.minted[0];
  const createdTracks = (await adapter.tracks()).filter((candidate) =>
    !entryTracks.some((entry) => entry.channelId === candidate.channelId));
  const cleanupChannelId = mint?.kind === 'track'
      && createdTracks.some((candidate) => candidate.channelId === mint.channelId)
    ? mint.channelId : createdTracks.length === 1 ? createdTracks[0]!.channelId : undefined;
  if (cleanupChannelId !== undefined) ownedTrack = track(cleanupChannelId);
  if (createdTracks.length !== 1) {
    throw new Error('the scratch track could not be identified exactly');
  }
  if (mint !== undefined
      && (mint.kind !== 'track' || mint.channelId !== createdTracks[0]!.channelId)) {
    throw new Error('the scratch track mint disagreed with the durable-id diff');
  }
  ownedTrack = track(createdTracks[0]!.channelId);
  if (createdTracks[0]!.name !== TRACK_NAME) {
    await adapter.apply({ ops: [{ op: 'track.rename', track: ownedTrack, name: TRACK_NAME }] });
    await adapter.settle('trackStruct');
    const renamed = (await adapter.tracks()).find((candidate) =>
      candidate.channelId === ownedTrack!.channelId);
    if (renamed?.name !== TRACK_NAME) {
      throw new Error('the scratch track name did not read back exactly');
    }
  }
  const workspace = workspaceOf({
    ready: async () => undefined,
    adapter,
    executor: new Executor(adapter),
    stash: new Stash(),
    observationStore: new FakeObservationStore(),
  });

  for (let index = 0; index < 2; index++) {
    const current = await adapter.devices(ownedTrack);
    await adapter.apply({ ops: [{
      op: 'device.insert', track: ownedTrack,
      source: { from: 'bitwig', uuid: DELAY_UUID }, expectedDeviceName: 'Delay+',
      expectedChain: current.devices.map((item) => item.name),
      expectedEnabledChain: current.devices.map((item) => item.enabled as boolean),
    }] });
    await adapter.settle('deviceInsert');
  }
  await composeAndReverse(workspace, adapter, ownedTrack, {
    trackId: ownedTrack.channelId,
    expectedDeviceOrder: [
      { name: 'Delay+', enabled: true }, { name: 'Delay+', enabled: true },
    ],
    containerKind: 'FX Layer', containerPosition: 2,
    entries: [{
      entryName: 'Four devices',
      devices: Array.from({ length: 4 }, (_, index) => ({
        source: { kind: 'native', name: 'Polysynth' }, modulators: index === 0 ? [OUTER] : [],
      })),
    }],
  }, '5r-FX-position-2', 1, 4, 0, 0);
  let current = await adapter.devices(ownedTrack);
  check('5r-FX-position-2: both pre-existing anchors remain in order',
    current.devices.map((item) => item.name).join('|') === 'Delay+|Delay+', current);
  for (let index = 1; index >= 0; index--) {
    current = await adapter.devices(ownedTrack);
    await adapter.apply({ ops: [{
      op: 'device.delete', device: device(ownedTrack, index), expectedName: 'Delay+',
      expectedChain: current.devices.map((item) => item.name),
      expectedEnabledChain: current.devices.map((item) => item.enabled as boolean),
    }] });
    await adapter.settle('trackStruct');
  }

  await composeAndReverse(workspace, adapter, ownedTrack, {
    trackId: ownedTrack.channelId, expectedDeviceOrder: [],
    containerKind: 'Instrument Layer', containerPosition: 0,
    entries: Array.from({ length: 5 }, (_, index) => ({
      entryName: `Instrument ${index + 1}`,
      devices: [{
        source: { kind: 'native', name: 'Polysynth' }, modulators: index === 4 ? [OUTER] : [],
      }],
    })),
  }, '5r-Instrument-Layer-five', 5, 1, 4, 0);

  const nestedPresetBytes = await readFile(NESTED_PRESET);
  await composeAndReverse(workspace, adapter, ownedTrack, {
    trackId: ownedTrack.channelId, expectedDeviceOrder: [],
    containerKind: 'FX Layer', containerPosition: 0,
    entries: [{
      entryName: 'Nested preset',
      devices: [{
        source: {
          kind: 'preset', path: NESTED_PRESET,
          fingerprint: fingerprintPreset(nestedPresetBytes),
          modulatorLocation: {
            kind: 'entry', entry: { position: 1, name: 'CHAIN1' },
            devicePath: [{ position: 0, name: 'Polysynth' }],
          },
        },
        modulators: [{
          location: 'device', modulator: 'lfo', target: TARGET, amount: 1,
        }],
      }],
    }],
  }, '5r-total-route-depth-2', 1, 1, 0, 0);

  const beforeRefusals = workspace.changes.list().length;
  for (let index = 0; index < 3; index++) {
    current = await adapter.devices(ownedTrack);
    const inserted = await adapter.apply({ ops: [{
      op: 'device.insert', track: ownedTrack,
      source: { from: 'bitwig', uuid: DELAY_UUID }, expectedDeviceName: 'Delay+',
      expectedChain: current.devices.map((item) => item.name),
      expectedEnabledChain: current.devices.map((item) => item.enabled as boolean),
    }] });
    if (inserted.stages.flatMap((stage) => stage.ops).some((op) => !op.ok)
        || inserted.minted[0]?.kind !== 'device') {
      throw new Error(`boundary anchor ${index + 1} did not insert exactly`);
    }
    await adapter.settle('deviceInsert');
  }
  const anchors = [
    { name: 'Delay+', enabled: true },
    { name: 'Delay+', enabled: true },
    { name: 'Delay+', enabled: true },
  ];
  current = await adapter.devices(ownedTrack);
  if (!current.devicesComplete || JSON.stringify(current.devices.map((item) => ({
    name: item.name, enabled: item.enabled,
  }))) !== JSON.stringify(anchors)) {
    throw new Error('the three boundary anchors did not read back exactly');
  }
  for (const [name, request] of [
    ['top position 3', {
      trackId: ownedTrack.channelId, expectedDeviceOrder: anchors,
      containerKind: 'FX Layer', containerPosition: 3,
      entries: [{ entryName: 'A', source: { kind: 'native', name: 'Polysynth' }, modulators: [] }],
    }],
    ['sixth entry', {
      trackId: ownedTrack.channelId, expectedDeviceOrder: anchors, containerKind: 'FX Layer',
      entries: Array.from({ length: 6 }, (_, index) => ({
        entryName: `E${index}`, source: { kind: 'native', name: 'Polysynth' }, modulators: [],
      })),
    }],
    ['fifth device', {
      trackId: ownedTrack.channelId, expectedDeviceOrder: anchors, containerKind: 'FX Layer',
      entries: [{
        entryName: 'A', devices: Array.from({ length: 5 }, () => ({
          source: { kind: 'native', name: 'Polysynth' }, modulators: [],
        })),
      }],
    }],
  ] as const) {
    let refused = false;
    try {
      const result = await callTool(workspace, 'compose_device_sources', request) as {
        refused?: boolean; nothingWasWritten?: boolean; capacities?: Record<string, number>;
      };
      refused = result.refused === true && result.nothingWasWritten === true
        && result.capacities?.topLevelContainerPositions === 3;
    } catch {
      refused = false;
    }
    check(`5r-boundary: ${name} refuses before a project write`,
      refused && workspace.changes.list().length === beforeRefusals);
  }
} catch (error) {
  check('5r-LX: the focused public proof completed without an unexpected failure', false,
    error instanceof Error ? `${error.name}: ${error.message}` : String(error));
} finally {
  if (ownedTrack !== undefined) {
    try {
      await adapter.apply({ ops: [{ op: 'track.delete', track: ownedTrack }] });
      await adapter.settle('trackStruct');
    } catch (error) {
      check('5r-cleanup: the scratch track was removed', false,
        error instanceof Error ? error.message : String(error));
    }
  }
  try {
    const finalTracks = await adapter.tracks();
    check('5r-cleanup: the exact entry track list is restored', sameTracks(finalTracks, entryTracks), {
      entry: entryTracks, final: finalTracks,
    });
    const finalInfo = await client.request('rig.info') as { sceneCount?: number };
    check('5r-cleanup: the launcher row count is unchanged',
      entrySceneCount === 8 && finalInfo.sceneCount === entrySceneCount,
      { entrySceneCount, finalSceneCount: finalInfo.sceneCount });
  } catch (error) {
    check('5r-cleanup: final baseline inspection completed', false,
      error instanceof Error ? error.message : String(error));
  }
  await adapter.close();
  clearInterval(keepAlive);
}

console.log(failureCount() === 0 ? '\nPhase 5r: ALL PASS' : `\nPhase 5r: ${failureCount()} FAILURE(S)`);
process.exit(failureCount() === 0 ? 0 : 1);
