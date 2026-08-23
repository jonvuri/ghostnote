/** Phase 5i useful composition, nested parameter control, and exact cleanup. */
import { readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';

import { LiveAdapter } from '../adapters/live/adapter.js';
import { track, type TrackAddress, type TrackState } from '../contract/index.js';
import { Executor } from '../engine/index.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { callTool } from '../surface/tools.js';
import { workspaceOf } from '../surface/workspace.js';
import { check, failureCount, note } from './lib.js';

const TRACK_NAME = 'gn-p5i-layered-motion';
const ENTRY_ORDER = ['Phase-4', 'Polysynth', 'Organ', 'Sampler'] as const;
const adapter = new LiveAdapter();
let ownedTrack: TrackAddress | undefined;
let entryTracks: readonly TrackState[] = [];
let entryTempDirectories: readonly string[] = [];

interface PublicControl {
  readonly position: number;
  readonly name: string;
  readonly normalizedValue: number;
  readonly modulatedValue?: number;
  readonly hasAutomation?: boolean;
}

interface PublicPage {
  readonly position: number;
  readonly name: string;
  readonly controls: readonly PublicControl[];
}

interface PublicWitness {
  readonly entryPosition: number;
  readonly modulatorName: string;
  readonly target: string;
  readonly verified: boolean;
  readonly page: { readonly verified: boolean; readonly actualCount: number };
  readonly behavior?: {
    readonly verified: boolean;
    readonly maximumDivergence: number;
    readonly baseSpread: number;
    readonly samples: readonly { readonly hasAutomation?: boolean }[];
    readonly selector?: {
      readonly pagePosition: number;
      readonly pageName: string;
      readonly controlPosition: number;
      readonly controlName: string;
    };
  };
}

interface CompositionResult {
  readonly applied?: boolean;
  readonly requested?: { readonly entryOrder: readonly string[] };
  readonly validated?: {
    readonly entries: readonly {
      readonly deviceName: string;
      readonly modulators: readonly { readonly name: string; readonly routed: boolean }[];
    }[];
  };
  readonly observed?: {
    readonly verified: boolean;
    readonly entryOrder: readonly string[];
    readonly entries: readonly {
      readonly entryPosition: number;
      readonly entryName: string;
      readonly devicesComplete: boolean;
      readonly deviceNames: readonly string[];
    }[];
  };
  readonly verification?: { readonly verified: boolean; readonly witnesses: readonly PublicWitness[] };
  readonly insertedDevicePosition?: number;
  readonly change?: { readonly changeId: string };
}

function sameTracks(left: readonly TrackState[], right: readonly TrackState[]): boolean {
  return JSON.stringify(left.map((item) => [item.channelId, item.name, item.position, item.type]))
    === JSON.stringify(right.map((item) => [item.channelId, item.name, item.position, item.type]));
}

async function compositionTempDirectories(): Promise<readonly string[]> {
  return (await readdir(tmpdir())).filter((name) => name.startsWith('ghostnote-compose-')).sort();
}

function nestedDevice(
  trackId: string,
  containerPosition: number,
  entryName: string,
): Record<string, unknown> {
  return {
    trackId,
    devicePosition: containerPosition,
    route: [{ through: 'named-container-entry', name: entryName, devicePosition: 0 }],
  };
}

try {
  const hello = await adapter.hello();
  note(`Bitwig ${hello.host?.version ?? 'unknown'}; contract ${hello.contractVersion}`);
  entryTracks = await adapter.tracks();
  entryTempDirectories = await compositionTempDirectories();
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
  const result = await callTool(workspace, 'compose_device_structure', {
    trackId: ownedTrack.channelId,
    entries: [
      { deviceName: 'Phase-4' },
      {
        deviceName: 'Polysynth',
        modulators: [{
          kind: 'add', modulator: 'lfo',
          target: 'polysynth-filter-frequency', amount: 0.55,
        }],
      },
      { deviceName: 'Organ' },
      {
        deviceName: 'Sampler',
        modulators: [{
          kind: 'add', modulator: 'lfo',
          target: 'sampler-amp-attack', amount: 0.45,
        }],
      },
    ],
  }) as CompositionResult;

  check('5i-L1: one public request creates the complete four-entry patch',
    result.applied === true
      && result.requested?.entryOrder.join('|') === ENTRY_ORDER.join('|')
      && result.observed?.verified === true
      && result.observed.entryOrder.join('|') === ENTRY_ORDER.join('|')
      && result.observed.entries.every((entry, index) =>
        entry.entryPosition === index
          && entry.devicesComplete
          && entry.deviceNames.length === 1
          && entry.deviceNames[0] === ENTRY_ORDER[index]),
    { requested: result.requested, observed: result.observed });

  const routedEntries = result.validated?.entries.filter((entry) =>
    entry.deviceName === 'Polysynth' || entry.deviceName === 'Sampler') ?? [];
  const witnesses = result.verification?.witnesses ?? [];
  check('5i-L2: both device-specific LFO routes have exact active live witnesses',
    routedEntries.length === 2
      && routedEntries.every((entry) =>
        entry.modulators.some((item) => item.name === 'LFO' && item.routed))
      && result.verification?.verified === true
      && witnesses.length === 2
      && witnesses.every((item) => item.verified
        && item.page.verified
        && item.page.actualCount === 1
        && item.behavior?.verified === true
        && item.behavior.maximumDivergence > 0
        && item.behavior.baseSpread <= 2e-3
        && item.behavior.samples.every((sample) => sample.hasAutomation === false)),
    { validated: routedEntries, witnesses });

  if (ownedTrack === undefined
      || typeof result.insertedDevicePosition !== 'number') {
    throw new Error('the composition returned no address for its nested devices');
  }
  const targets = witnesses.map((witness) => {
    const observedEntry = result.observed?.entries[witness.entryPosition];
    if (observedEntry === undefined) throw new Error('a witness has no observed container entry');
    return nestedDevice(
      ownedTrack!.channelId,
      result.insertedDevicePosition!,
      observedEntry.entryName,
    );
  });
  const before = await Promise.all(targets.map(async (device) =>
    await callTool(workspace, 'inspect_device_parameters', {
      device,
      view: 'remote-controls',
    }) as { readonly standing?: string; readonly remotePages?: readonly PublicPage[] }));
  const selectors = witnesses.map((item) => item.behavior?.selector);
  const controls = selectors.map((selector, index) => before[index]?.remotePages
    ?.find((page) => page.position === selector?.pagePosition && page.name === selector.pageName)
    ?.controls.find((control) =>
      control.position === selector?.controlPosition && control.name === selector.controlName));
  check('5i-L3: existing inspection reaches both nested modulation bases',
    before.every((inventory) => inventory.standing === 'stable')
      && selectors.every((selector) => selector !== undefined)
      && controls.every((control) => control !== undefined
        && typeof control.normalizedValue === 'number'
        && typeof control.modulatedValue === 'number'),
    { selectors, controls });

  const requestedBases = [0.34, 0.22] as const;
  const tuned: Array<{
    readonly verified?: boolean;
    readonly changes?: readonly { readonly changeId: string }[];
  }> = [];
  for (const [index, selector] of selectors.entries()) {
    tuned.push(await callTool(workspace, 'set_parameter', {
      settings: [{
        kind: 'remote',
        device: targets[index],
        pagePosition: selector!.pagePosition,
        pageName: selector!.pageName,
        controlPosition: selector!.controlPosition,
        controlName: selector!.controlName,
        normalizedValue: requestedBases[index]!,
      }],
    }) as (typeof tuned)[number]);
  }
  const after = await Promise.all(targets.map(async (device) =>
    await callTool(workspace, 'inspect_device_parameters', {
      device,
      view: 'remote-controls',
    }) as { readonly standing?: string; readonly remotePages?: readonly PublicPage[] }));
  const tunedControls = selectors.map((selector, index) => after[index]?.remotePages
    ?.find((page) => page.position === selector?.pagePosition && page.name === selector.pageName)
    ?.controls.find((control) =>
      control.position === selector?.controlPosition && control.name === selector.controlName));
  check('5i-L4: existing parameter control sets and reads both nested bases exactly',
    tuned.every((result) => result.verified === true && result.changes?.length === 1)
      && after.every((inventory) => inventory.standing === 'stable')
      && tunedControls.every((control, index) =>
        control !== undefined && Math.abs(control.normalizedValue - requestedBases[index]!) <= 1e-6),
    { tuned, requestedBases, tunedControls });
  note(`Composition witnesses: ${JSON.stringify(witnesses)}`);
  note(`Nested parameter bases: ${JSON.stringify(tunedControls)}`);

  if (result.change?.changeId === undefined) throw new Error('the composition returned no change id');
  const reversed = await callTool(workspace, 'revert_change', {
    changeId: result.change.changeId,
  }) as { readonly applied?: boolean; readonly notRestored?: readonly unknown[] };
  const devices = await adapter.devices(ownedTrack);
  check('5i-L5: public composition reversal removes the tuned patch and restores the empty track',
    reversed.applied === true
      && (reversed.notRestored?.length ?? 0) === 0
      && devices.devicesComplete
      && devices.devices.length === 0,
    { reversed, devices });
} catch (error) {
  check('5i-LX: the closeout dogfood completed without an unexpected failure', false,
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
      check('5i-cleanup: owned content was removed', false,
        error instanceof Error ? error.message : String(error));
    }
  }
  try {
    const finalTracks = await adapter.tracks();
    check('5i-cleanup: the exact entry track list is restored', sameTracks(finalTracks, entryTracks), {
      entry: entryTracks,
      final: finalTracks,
    });
    const finalTempDirectories = await compositionTempDirectories();
    check('5i-cleanup: no composition temporary directory remains',
      JSON.stringify(finalTempDirectories) === JSON.stringify(entryTempDirectories), {
        entry: entryTempDirectories,
        final: finalTempDirectories,
      });
  } catch (error) {
    check('5i-cleanup: final inventory completed', false,
      error instanceof Error ? error.message : String(error));
  }
  await adapter.close();
}

console.log(failureCount() === 0 ? '\nPhase 5i: ALL PASS' : `\nPhase 5i: ${failureCount()} FAILURE(S)`);
process.exit(failureCount() === 0 ? 0 : 1);
