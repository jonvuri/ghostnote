/** Phase 5n live matrix for fingerprinted semantic public authoring. */
import { homedir } from 'node:os';
import { join } from 'node:path';

import { LiveAdapter } from '../adapters/live/adapter.js';
import { FIXTURE_DIR } from '../bwmod/fixtures.js';
import { track, type TrackAddress, type TrackState } from '../contract/index.js';
import { Executor } from '../engine/index.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { callTool } from '../surface/tools.js';
import { workspaceOf } from '../surface/workspace.js';
import { check, failureCount, note } from './lib.js';

const TRACK_NAME = 'gn-p5n-public-authoring';
const libraryPreset = (...parts: string[]): string => join(
  homedir(), 'Documents', 'Bitwig Studio', 'Library', 'Presets', ...parts,
);

interface PublicTarget {
  readonly parameterId: string;
  readonly parameterName: string;
}

interface MatrixCase {
  readonly name: string;
  readonly presetPath: string;
  readonly target: PublicTarget;
  readonly select: (locations: readonly PublicLocation[]) => PublicLocation | undefined;
  readonly pageOnly?: boolean;
  readonly structuralOnly?: boolean;
}

type PublicLocation =
  | { readonly kind: 'self' }
  | { readonly kind: 'container'; readonly name: string }
  | {
    readonly kind: 'entry';
    readonly entry: { readonly position: number; readonly name: string };
    readonly devicePath: readonly { readonly position: number; readonly name: string }[];
  };

const self = (locations: readonly PublicLocation[]): PublicLocation | undefined =>
  locations.find((location) => location.kind === 'self');

const MATRIX: readonly MatrixCase[] = [
  {
    name: 'native-instrument',
    presetPath: join(FIXTURE_DIR, 'Polysynth', 'mp_bare.bwpreset'),
    target: { parameterId: 'CONTENTS/F1FREQ', parameterName: 'Filter Frequency' },
    select: self,
    pageOnly: true,
  },
  {
    name: 'native-fx',
    presetPath: libraryPreset('Delay+', 'gn_delayplus_bare.bwpreset'),
    target: { parameterId: 'CONTENTS/BLUR', parameterName: 'Blur Amount' },
    select: self,
    pageOnly: true,
  },
  {
    name: 'vst3',
    presetPath: join(FIXTURE_DIR, 'Zebra3', 'gn_zebra3vst_bare.bwpreset'),
    target: { parameterId: 'CONTENTS/PID411', parameterName: 'Cutoff' },
    select: self,
  },
  {
    name: 'clap',
    presetPath: join(FIXTURE_DIR, 'Zebra3', 'gn_zebra3clap_bare.bwpreset'),
    target: { parameterId: 'CONTENTS/PID411', parameterName: 'Cutoff' },
    select: self,
    structuralOnly: true,
  },
  {
    name: 'sampleless-sampler',
    presetPath: join(FIXTURE_DIR, 'Sampler', 'gn_sampler_no_sample.bwpreset'),
    target: { parameterId: 'CONTENTS/AMP_ATTACK_TIME', parameterName: 'AEG Attack Time' },
    select: self,
    pageOnly: true,
  },
  {
    name: 'sampled-sampler',
    presetPath: join(FIXTURE_DIR, 'Sampler', 'gn_sampler_multi_bare.bwpreset'),
    target: { parameterId: 'CONTENTS/AMP_ATTACK_TIME', parameterName: 'AEG Attack Time' },
    select: self,
    pageOnly: true,
  },
  {
    name: 'container-entry',
    presetPath: join(FIXTURE_DIR, 'InstrumentLayer', 'gn_layer_4chain.bwpreset'),
    target: { parameterId: 'CONTENTS/F1FREQ', parameterName: 'Filter Frequency' },
    select: (locations) => locations.find((location) => location.kind === 'entry'
      && location.devicePath.at(-1)?.name === 'Polysynth'),
  },
];

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
  const mint = created.minted[0];
  if (mint?.kind !== 'track') throw new Error('the owned track returned no durable id');
  ownedTrack = track(mint.channelId);
  await adapter.settle('trackStruct');

  const workspace = workspaceOf({
    ready: async () => undefined,
    adapter,
    executor: new Executor(adapter),
    stash: new Stash(),
    observationStore: new FakeObservationStore(),
  });

  for (let attempt = 0; attempt < 20; attempt++) {
    const devices = await workspace.devices(ownedTrack);
    if (devices.devicesComplete && devices.devices.every((device) => device.enabled !== undefined)) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  for (const item of MATRIX) {
    const inspection = await callTool(workspace, 'inspect_preset_modulation', {
      presetPath: item.presetPath,
    }) as {
      readonly supported?: boolean;
      readonly why?: string;
      readonly fingerprint?: { readonly algorithm: 'sha256'; readonly sha256: string; readonly byteLength: number };
      readonly host?: { readonly format: string; readonly tier: string };
      readonly modulation?: readonly { readonly location: PublicLocation }[];
    };
    const location = item.select((inspection.modulation ?? []).map((entry) => entry.location));
    if (inspection.supported !== true || inspection.fingerprint === undefined || location === undefined) {
      throw new Error(`${item.name} inspection failed: ${JSON.stringify(inspection)}`);
    }

    const result = await callTool(workspace, 'author_modulators', {
      trackId: ownedTrack.channelId,
      presetPath: item.presetPath,
      fingerprint: inspection.fingerprint,
      location,
      operation: { kind: 'add', modulator: 'lfo', target: item.target, amount: 1 },
      ...(item.pageOnly ? { behaviorChecks: [] } : {}),
      ...(item.structuralOnly ? { structuralCheck: { kind: 'inserted-host' } } : {}),
    }) as {
      readonly applied?: boolean;
      readonly requested?: { readonly location: PublicLocation };
      readonly decoded?: { readonly host: { readonly format: string; readonly tier: string } };
      readonly edited?: { readonly location: PublicLocation; readonly siblingInventoriesUnchanged: boolean };
      readonly verified?: { readonly passed: boolean; readonly insertedHost: boolean };
      readonly change?: { readonly changeId: string };
    };
    check(`5n-${item.name}: semantic public insertion passes its live witness`,
      result.applied === true
        && result.verified?.passed === true
        && result.verified.insertedHost === true
        && result.edited?.siblingInventoriesUnchanged === true
        && JSON.stringify(result.requested?.location) === JSON.stringify(location)
        && JSON.stringify(result.edited?.location) === JSON.stringify(location)
        && typeof result.change?.changeId === 'string',
      { inspection, result });

    if (result.change?.changeId !== undefined) {
      const reversed = await callTool(workspace, 'revert_change', {
        changeId: result.change.changeId,
      }) as { readonly applied?: boolean; readonly notRestored?: readonly unknown[] };
      const devices = await adapter.devices(ownedTrack);
      check(`5n-${item.name}: reversal restores the exact empty entry state`,
        reversed.applied === true
          && (reversed.notRestored?.length ?? 0) === 0
          && devices.devicesComplete
          && devices.devices.length === 0,
        { reversed, devices });
    }
  }
} catch (error) {
  check('5n-LX: the public live matrix completed without an unexpected failure', false,
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
      check('5n-cleanup: owned content was removed', false,
        error instanceof Error ? error.message : String(error));
    }
  }
  try {
    const finalTracks = await adapter.tracks();
    check('5n-cleanup: the exact entry track list is restored', sameTracks(finalTracks, entryTracks), {
      entry: entryTracks,
      final: finalTracks,
    });
  } catch (error) {
    check('5n-cleanup: the exact entry track list is restored', false,
      error instanceof Error ? error.message : String(error));
  }
  await adapter.close();
  clearInterval(keepAlive);
}

console.log(failureCount() === 0 ? '\nPhase 5n: ALL PASS' : `\nPhase 5n: ${failureCount()} FAILURE(S)`);
process.exit(failureCount() === 0 ? 0 : 1);
