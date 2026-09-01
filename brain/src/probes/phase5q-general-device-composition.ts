/** Focused live proof for general device-source composition and reversal. */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { LiveAdapter } from '../adapters/live/adapter.js';
import { device, track, type TrackAddress, type TrackState } from '../contract/index.js';
import { Executor } from '../engine/index.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { callTool } from '../surface/tools.js';
import { workspaceOf } from '../surface/workspace.js';
import { check, failureCount, note } from './lib.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TRACK_NAME = 'gn-p5q-general-device-composition';
const VST3_CLASS_UID = 'D39D5B69D6AF42FA123456785A334D44';
const CLAP_ID = 'com.u-he.Zebra3';
const SAMPLED_PRESET = join(ROOT, 'fixtures', 'Sampler', 'gn_sampler_multi_bare.bwpreset');

const zebraTarget = { parameterId: 'CONTENTS/PID411', parameterName: 'Cutoff' };
const delayTarget = { parameterId: 'CONTENTS/BLUR', parameterName: 'Blur Amount' };
const samplerTarget = {
  parameterId: 'CONTENTS/AMP_ATTACK_TIME', parameterName: 'AEG Attack Time',
};

function sameTracks(left: readonly TrackState[], right: readonly TrackState[]): boolean {
  return JSON.stringify(left.map((item) => [item.channelId, item.name, item.position, item.type]))
    === JSON.stringify(right.map((item) => [item.channelId, item.name, item.position, item.type]));
}

const adapter = new LiveAdapter();
const keepAlive = setInterval(() => undefined, 1_000);
let ownedTrack: TrackAddress | undefined;
let entryTracks: readonly TrackState[] = [];

try {
  const hello = await adapter.hello();
  note(`Bitwig ${hello.host?.version ?? 'unknown'}; contract ${hello.contractVersion}`);
  entryTracks = await adapter.tracks();
  const created = await adapter.apply({ ops: [{ op: 'track.create', name: TRACK_NAME }] });
  await adapter.settle('trackStruct');
  const mint = created.minted[0];
  if (mint?.kind !== 'track') throw new Error('the owned track returned no durable id');
  ownedTrack = track(mint.channelId);
  const workspace = workspaceOf({
    ready: async () => undefined,
    adapter,
    executor: new Executor(adapter),
    stash: new Stash(),
    observationStore: new FakeObservationStore(),
  });

  const sampledInspection = await callTool(workspace, 'inspect_preset_modulation', {
    presetPath: SAMPLED_PRESET,
  }) as {
    supported?: boolean;
    fingerprint?: { algorithm: 'sha256'; sha256: string; byteLength: number };
    modulation?: readonly { location: { kind: string } }[];
  };
  const sampledLocation = sampledInspection.modulation?.find((item) => item.location.kind === 'self')?.location;
  if (sampledInspection.supported !== true || sampledInspection.fingerprint === undefined
      || sampledLocation === undefined) {
    throw new Error(`the sampled preset inspection failed: ${JSON.stringify(sampledInspection)}`);
  }

  const composed = await callTool(workspace, 'compose_device_sources', {
    trackId: ownedTrack.channelId,
    expectedDeviceOrder: [],
    containerKind: 'FX Layer',
    entries: [
      {
        entryName: 'Zebra VST3', source: { kind: 'vst3', classUid: VST3_CLASS_UID },
        modulators: [{
          location: 'container', modulator: 'lfo', target: zebraTarget, amount: 1,
        }],
      },
      {
        entryName: 'Native Polysynth', source: { kind: 'native', name: 'Polysynth' },
        modulators: [],
      },
      {
        entryName: 'Zebra CLAP', source: { kind: 'clap', id: CLAP_ID },
        modulators: [],
      },
      {
        entryName: 'Sampled Sampler',
        source: {
          kind: 'preset', path: SAMPLED_PRESET,
          fingerprint: sampledInspection.fingerprint,
          modulatorLocation: sampledLocation,
        },
        modulators: [{
          location: 'device', modulator: 'lfo', target: samplerTarget, amount: 1,
          behaviorCheck: 'page-only',
        }],
      },
    ],
  }) as {
    complete?: boolean;
    entries?: readonly {
      sourceKind: string; verified: boolean;
      sourceIdentity: { sampledPreset?: boolean; adjustedSampleReferences?: number };
      behaviors: readonly { verified: boolean; maximumDivergence: number }[];
      pages: { verified: boolean };
      containerPages: { verified: boolean };
    }[];
    structure?: readonly { entryName: string; devices: readonly { name: string; enabled: boolean }[] }[];
    reversalCheckpoint?: unknown;
  };
  check('5q-new-sources: native, VST3, CLAP, and sampled preset compose in caller order',
    composed.complete === true
      && JSON.stringify(composed.entries?.map((item) => item.sourceKind))
        === JSON.stringify(['vst3', 'native', 'clap', 'preset'])
      && JSON.stringify(composed.structure?.map((item) => item.entryName))
        === JSON.stringify(['Zebra VST3', 'Native Polysynth', 'Zebra CLAP', 'Sampled Sampler'])
      && composed.structure?.every((item) => item.devices.length === 1
        && item.devices[0]?.enabled === true) === true
      && composed.entries?.every((item) => item.verified) === true,
    composed);
  check('5q-new-sources: active and qualified page-only witnesses stay explicit',
    composed.entries?.[0]?.behaviors[0]?.verified === true
      && (composed.entries[0]?.behaviors[0]?.maximumDivergence ?? 0) > 0
      && composed.entries[0]?.containerPages.verified === true
      && composed.entries[1]?.behaviors.length === 0
      && composed.entries[2]?.behaviors.length === 0
      && composed.entries[3]?.behaviors.length === 0
      && composed.entries[3]?.pages.verified === true
      && composed.entries[3]?.sourceIdentity.sampledPreset === true
      && (composed.entries[3]?.sourceIdentity.adjustedSampleReferences ?? 0) > 0,
    composed.entries);

  const newReversal = await callTool(workspace, 'reverse_device_source_composition', {
    checkpoint: composed.reversalCheckpoint,
  }) as { complete?: boolean; containerRemoved?: boolean; restoredDeviceOrder?: boolean };
  let current = await adapter.devices(ownedTrack);
  check('5q-new-sources: reversal restores the exact empty track',
    newReversal.complete === true && newReversal.containerRemoved === true
      && newReversal.restoredDeviceOrder === true
      && current.devicesComplete && current.devices.length === 0,
    { newReversal, current });

  await adapter.apply({ ops: [{
    op: 'device.insert', track: ownedTrack,
    source: { from: 'bitwig', uuid: 'f2baa2a8-36c5-4a79-b1d9-a4e461c45ee9' },
    expectedDeviceName: 'Delay+', expectedChain: [], expectedEnabledChain: [],
  }] });
  await adapter.settle('deviceInsert');
  current = await adapter.devices(ownedTrack);
  const existing = await callTool(workspace, 'compose_device_sources', {
    trackId: ownedTrack.channelId,
    expectedDeviceOrder: current.devices.map((item) => ({
      name: item.name, enabled: item.enabled as boolean,
    })),
    containerKind: 'FX Layer',
    entries: [
      {
        entryName: 'Delay copy', source: { kind: 'existing-copy', devicePosition: 0 },
        modulators: [{
          location: 'container', modulator: 'lfo', target: delayTarget, amount: 1,
        }],
      },
      {
        entryName: 'Delay move', source: { kind: 'existing-move', devicePosition: 0 },
        modulators: [],
      },
    ],
  }) as {
    complete?: boolean;
    entries?: readonly {
      instance: string; stateClaim: string;
      scalarFingerprint: { preserved?: boolean };
      observed: { deviceName: string };
    }[];
    reversalCheckpoint?: unknown;
  };
  check('5q-existing: repeated Delay+ names remain separate through unique entry names',
    existing.complete === true
      && existing.entries?.map((item) => item.observed.deviceName)
        .every((name) => name === 'Delay+') === true
      && existing.entries?.[0]?.instance === 'new'
      && /No state-identity claim/.test(existing.entries[0]?.stateClaim ?? '')
      && existing.entries?.[1]?.instance === 'preserved'
      && existing.entries[1]?.scalarFingerprint.preserved === true,
    existing);

  const existingReversal = await callTool(workspace, 'reverse_device_source_composition', {
    checkpoint: existing.reversalCheckpoint,
  }) as { complete?: boolean; containerRemoved?: boolean; restoredDeviceOrder?: boolean };
  current = await adapter.devices(ownedTrack);
  check('5q-existing: reversal restores one exact pre-existing Delay+ instance',
    existingReversal.complete === true && existingReversal.containerRemoved === true
      && existingReversal.restoredDeviceOrder === true
      && current.devicesComplete && current.devices.length === 1
      && current.devices[0]?.name === 'Delay+',
    { existingReversal, current });

  await adapter.apply({ ops: [{
    op: 'device.delete', device: device(ownedTrack, 0), expectedName: 'Delay+',
    expectedChain: ['Delay+'], expectedEnabledChain: [true],
  }] });
  await adapter.settle('trackStruct');
} catch (error) {
  check('5q-LX: the focused public proof completed without an unexpected failure', false,
    error instanceof Error ? `${error.name}: ${error.message}` : String(error));
} finally {
  if (ownedTrack !== undefined) {
    try {
      await adapter.apply({ ops: [{ op: 'track.delete', track: ownedTrack }] });
      await adapter.settle('trackStruct');
    } catch (error) {
      check('5q-cleanup: the owned track was removed', false,
        error instanceof Error ? error.message : String(error));
    }
  }
  try {
    const finalTracks = await adapter.tracks();
    check('5q-cleanup: the exact entry track list is restored', sameTracks(finalTracks, entryTracks), {
      entry: entryTracks, final: finalTracks,
    });
  } catch (error) {
    check('5q-cleanup: the exact entry track list is restored', false,
      error instanceof Error ? error.message : String(error));
  }
  await adapter.close();
  clearInterval(keepAlive);
}

console.log(failureCount() === 0 ? '\nPhase 5q: ALL PASS' : `\nPhase 5q: ${failureCount()} FAILURE(S)`);
process.exit(failureCount() === 0 ? 0 : 1);
