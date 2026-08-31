/** Focused public proof for the existing-device modulation wrapper lifecycle. */
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
const TRACK_NAME = 'gn-p5p-existing-device-wrapper';
const adapter = new LiveAdapter();
let ownedTrack: TrackAddress | undefined;
let entryTracks: readonly TrackState[] = [];

const cases = [
  {
    label: 'native-FX',
    source: { from: 'bitwig', uuid: 'f2baa2a8-36c5-4a79-b1d9-a4e461c45ee9' },
    deviceName: 'Delay+',
    target: { parameterId: 'CONTENTS/BLUR', parameterName: 'Blur Amount' },
  },
  {
    label: 'VST3',
    source: {
      from: 'file',
      path: join(ROOT, 'fixtures', 'Zebra3', 'gn_zebra3vst_bare.bwpreset'),
    },
    deviceName: 'Zebra3',
    target: { parameterId: 'CONTENTS/PID411', parameterName: 'Cutoff' },
  },
] as const;

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

  for (const spec of cases) {
    await adapter.apply({ ops: [{
      op: 'device.insert',
      track: ownedTrack,
      source: spec.source,
      expectedDeviceName: spec.deviceName,
      expectedChain: [],
      expectedEnabledChain: [],
    }] });
    await adapter.settle('deviceInsert');
    const before = await adapter.devices(ownedTrack);
    const expectedDeviceOrder = before.devices.map((item) => ({
      name: item.name, enabled: item.enabled as boolean,
    }));
    const wrapped = await callTool(workspace, 'wrap_existing_device_modulation', {
      trackId: ownedTrack.channelId,
      devicePosition: 0,
      expectedDeviceOrder,
      containerKind: 'FX Layer',
      entryName: 'Layer 1',
      modulators: [{ modulator: 'lfo', target: spec.target, amount: 1 }],
    }) as {
      complete?: boolean;
      stages?: readonly { stage: string }[];
      currentLocation?: { kind: string; containerPosition?: number };
      verification?: {
        preservedOpaqueState: boolean;
        opaqueStateQualification: string;
        scalarFingerprint: { preserved: boolean; before: { parameterCount: number } };
        pages: { verified: boolean };
        behaviors: readonly { verified: boolean; maximumDivergence: number; baseSpread: number }[];
      };
      reversalCheckpoint?: unknown;
    };
    check(`5p-${spec.label}: insertion, positioning, relocation, and all live witnesses pass`,
      wrapped.complete === true
        && JSON.stringify(wrapped.stages?.map((item) => item.stage))
          === JSON.stringify([
            'insert-container', 'position-container', 'prepare-entry-name',
            'confirm-entry-name', 'relocate-device',
          ])
        && wrapped.currentLocation?.kind === 'container-entry'
        && wrapped.currentLocation.containerPosition === 0
        && wrapped.verification?.scalarFingerprint.preserved === true
        && (wrapped.verification.scalarFingerprint.before.parameterCount ?? 0) > 0
        && wrapped.verification.pages.verified
        && wrapped.verification.behaviors.length === 1
        && wrapped.verification.behaviors[0]?.verified === true
        && (wrapped.verification.behaviors[0]?.maximumDivergence ?? 0) > 0
        && (wrapped.verification.behaviors[0]?.baseSpread ?? 1) <= 2e-3,
      wrapped);
    check(`5p-${spec.label}: public state claims stay within the measured boundary`,
      wrapped.verification?.preservedOpaqueState === true
        && /not read back byte for byte/.test(wrapped.verification.opaqueStateQualification),
      wrapped.verification);

    const reversed = await callTool(workspace, 'reverse_existing_device_modulation_wrap', {
      checkpoint: wrapped.reversalCheckpoint,
    }) as {
      complete?: boolean;
      containerRemoved?: boolean;
      restoredDeviceOrder?: boolean;
    };
    const restored = await adapter.devices(ownedTrack);
    check(`5p-${spec.label}: guarded reversal restores the same top-level device`,
      reversed.complete === true
        && reversed.containerRemoved === true
        && reversed.restoredDeviceOrder === true
        && restored.devicesComplete
        && restored.devices.length === 1
        && restored.devices[0]?.name === spec.deviceName
        && restored.devices[0]?.enabled === expectedDeviceOrder[0]?.enabled,
      { reversed, restored });

    await adapter.apply({ ops: [{
      op: 'device.delete',
      device: device(ownedTrack, 0),
      expectedName: spec.deviceName,
      expectedChain: [spec.deviceName],
      expectedEnabledChain: [expectedDeviceOrder[0]!.enabled],
    }] });
    await adapter.settle('trackStruct');
  }
} catch (error) {
  check('5p-LX: the focused public proof completed without an unexpected failure', false,
    error instanceof Error ? `${error.name}: ${error.message}` : String(error));
} finally {
  if (ownedTrack !== undefined) {
    try {
      const devices = await adapter.devices(ownedTrack);
      for (const item of [...devices.devices].reverse()) {
        await adapter.apply({ ops: [{
          op: 'device.delete',
          device: device(ownedTrack, item.index),
          expectedName: item.name,
        }] });
        await adapter.settle('trackStruct');
      }
      await adapter.apply({ ops: [{ op: 'track.delete', track: ownedTrack }] });
      await adapter.settle('trackStruct');
    } catch (error) {
      check('5p-cleanup: owned content was removed', false,
        error instanceof Error ? error.message : String(error));
    }
  }
  try {
    const finalTracks = await adapter.tracks();
    check('5p-cleanup: the exact entry track list is restored', sameTracks(finalTracks, entryTracks), {
      entry: entryTracks,
      final: finalTracks,
    });
  } catch (error) {
    check('5p-cleanup: the exact entry track list is restored', false,
      error instanceof Error ? error.message : String(error));
  }
  await adapter.close();
}

console.log(failureCount() === 0 ? '\nPhase 5p: ALL PASS' : `\nPhase 5p: ${failureCount()} FAILURE(S)`);
process.exit(failureCount() === 0 ? 0 : 1);
