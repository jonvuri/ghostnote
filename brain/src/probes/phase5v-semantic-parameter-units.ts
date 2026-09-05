/** Live proof for parameter display metadata and fail-closed semantic writes. */
import { LiveAdapter } from '../adapters/live/adapter.js';
import { BridgeTransport } from '../adapters/live/transport.js';
import {
  addressKey, device, remotes, track,
  type DeviceAddress, type TrackAddress, type TrackState,
} from '../contract/index.js';
import { Executor } from '../engine/index.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { callTool } from '../surface/tools.js';
import { workspaceOf, type Workspace } from '../surface/workspace.js';
import { check, client, failureCount, note } from './lib.js';

interface PublicControl {
  readonly position: number;
  readonly name: string;
  readonly normalizedValue: number;
  readonly display?: string;
  readonly discreteNormalizedValues?: readonly number[];
  readonly discreteValueNames?: readonly string[];
}

interface PublicPage {
  readonly position: number;
  readonly name: string;
  readonly controls: readonly PublicControl[];
}

interface WrapperResult {
  readonly complete?: boolean;
  readonly reversalCheckpoint?: unknown;
}

function sameTracks(left: readonly TrackState[], right: readonly TrackState[]): boolean {
  return JSON.stringify(left.map((item) => [item.channelId, item.name, item.position, item.type]))
    === JSON.stringify(right.map((item) => [item.channelId, item.name, item.position, item.type]));
}

async function findTopLevelColourCopy(adapter: LiveAdapter): Promise<{
  readonly address: DeviceAddress;
  readonly owner: TrackAddress;
}> {
  for (const row of await adapter.tracks()) {
    const owner = track(row.channelId);
    const bank = await adapter.devices(owner);
    const found = bank.devices.find((item) => item.name === 'ColourCopy');
    if (found !== undefined) return { address: device(owner, found.index), owner };
  }
  throw new Error('no top-level ColourCopy device was found');
}

async function publicPages(workspace: Workspace, target: DeviceAddress): Promise<readonly PublicPage[]> {
  if (target.chain !== undefined && target.chain.kind !== 'chain') {
    throw new Error('this probe expects a top-level device or one named container entry');
  }
  const result = await callTool(workspace, 'inspect_device_parameters', {
    device: {
      trackId: target.track.channelId,
      devicePosition: target.chain === undefined
        ? target.chainIndex : target.chain.container.chainIndex,
      ...(target.chain === undefined ? {} : {
        route: [{
          through: 'named-container-entry',
          name: target.chain.name,
          devicePosition: target.chainIndex,
        }],
      }),
    },
    view: 'remote-controls',
  }) as { readonly standing?: string; readonly remotePages?: readonly PublicPage[] };
  if (result.standing !== 'stable') {
    throw new Error(`remote controls stayed ${result.standing ?? 'unknown'}`);
  }
  return result.remotePages ?? [];
}

await client.connect();
const adapter = new LiveAdapter({ transport: new BridgeTransport(client) });
const keepAlive = setInterval(() => undefined, 1_000);
const workspace = workspaceOf({
  ready: async () => undefined,
  adapter,
  executor: new Executor(adapter),
  stash: new Stash(),
  observationStore: new FakeObservationStore(),
});
let entryTracks: readonly TrackState[] = [];
let owner: TrackAddress | undefined;
let entryOrder: readonly { readonly name: string; readonly enabled?: boolean }[] = [];
let wrapper: WrapperResult | undefined;
let wrappedContainer: DeviceAddress | undefined;
let initialControls: {
  readonly pagePosition: number;
  readonly pageName: string;
  readonly rate: PublicControl;
  readonly timebase: PublicControl;
} | undefined;
const scalarChanges: string[] = [];

try {
  const hello = await adapter.hello();
  note(`Bitwig ${hello.host?.version ?? 'unknown'}; contract ${hello.contractVersion}`);
  entryTracks = await adapter.tracks();
  const source = await findTopLevelColourCopy(adapter);
  owner = source.owner;
  const sourceBank = await adapter.devices(source.owner);
  entryOrder = sourceBank.devices.map((item) => ({ name: item.name, enabled: item.enabled }));

  const direct = await adapter.read([source.address]);
  const directValue = direct.entries[addressKey(source.address)]?.value;
  const parameters = directValue?.of === 'device' ? directValue.device.params ?? [] : [];
  const remote = await adapter.read([remotes(source.address)]);
  const remoteValue = remote.entries[addressKey(remotes(source.address))]?.value;
  const remoteNames = remoteValue?.of === 'remotes'
    ? remoteValue.remotes.pages.flatMap((page) => page.controls.map((control) => control.name)) : [];
  const targets = parameters.filter((item) => remoteNames.includes(item.name)).slice(0, 2);
  if (targets.length < 2) throw new Error('ColourCopy did not expose two exact wrapper targets');

  wrapper = await callTool(workspace, 'wrap_existing_device_modulation', {
    trackId: source.owner.channelId,
    devicePosition: source.address.chainIndex,
    expectedDeviceOrder: sourceBank.devices.map((item) => ({ name: item.name, enabled: item.enabled })),
    containerKind: 'FX Layer',
    entryName: 'Layer 1',
    modulators: targets.map((target, index) => ({
      modulator: index === 0 ? 'lfo' : 'classic-lfo',
      target: { parameterId: target.id, parameterName: target.name },
      amount: index === 0 ? 0.3 : 0.25,
    })),
  }) as WrapperResult;
  if (wrapper.complete !== true || wrapper.reversalCheckpoint === undefined) {
    throw new Error(`wrapper did not complete: ${JSON.stringify(wrapper)}`);
  }

  const container = device(source.owner, source.address.chainIndex);
  wrappedContainer = container;
  const pages = await publicPages(workspace, container);
  const classic = pages.find((page) => page.name === 'Classic LFO');
  const rate = classic?.controls.find((control) => control.name === 'Rate');
  const timebase = classic?.controls.find((control) => control.name === 'Timebase');
  if (classic === undefined || rate === undefined || timebase === undefined) {
    throw new Error(`Classic LFO Rate or Timebase is missing: ${JSON.stringify(classic)}`);
  }
  initialControls = {
    pagePosition: classic.position,
    pageName: classic.name,
    rate,
    timebase,
  };

  const semantic = await callTool(workspace, 'set_parameter', { settings: [{
    kind: 'remote',
    device: {
      trackId: source.owner.channelId,
      devicePosition: container.chainIndex,
    },
    pagePosition: classic.position,
    pageName: classic.name,
    controlPosition: rate.position,
    controlName: rate.name,
    valueKind: 'semantic',
    semanticValue: '1.5 measures',
  }] }) as Record<string, unknown>;
  check('5v-boundary: 1.5 measures refuses before any scalar write',
    semantic['refused'] === true && semantic['nothingWasWritten'] === true
      && Array.isArray(semantic['changes']) && semantic['changes'].length === 0,
    semantic);

  const modes = timebase.discreteNormalizedValues ?? [];
  check('5v-timebase: the host reports exact discrete choices',
    modes.length >= 2 && modes.every((value) => value >= 0 && value <= 1), timebase);

  const observations: Array<Record<string, unknown>> = [];
  for (const mode of modes.slice(0, 2)) {
    const modeSet = await callTool(workspace, 'set_parameter', { settings: [{
      kind: 'remote',
      device: {
        trackId: source.owner.channelId,
        devicePosition: container.chainIndex,
      },
      pagePosition: classic.position,
      pageName: classic.name,
      controlPosition: timebase.position,
      controlName: timebase.name,
      normalizedValue: mode,
    }] }) as { readonly verified?: boolean; readonly changes?: readonly { readonly changeId?: string }[] };
    if (modeSet.verified !== true) throw new Error(`Timebase write failed: ${JSON.stringify(modeSet)}`);
    scalarChanges.push(...(modeSet.changes ?? []).flatMap((change) => change.changeId ?? []));

    for (const normalizedValue of [0.25, 0.5, 0.75]) {
      const rateSet = await callTool(workspace, 'set_parameter', { settings: [{
        kind: 'remote',
        device: {
          trackId: source.owner.channelId,
          devicePosition: container.chainIndex,
        },
        pagePosition: classic.position,
        pageName: classic.name,
        controlPosition: rate.position,
        controlName: rate.name,
        normalizedValue,
      }] }) as { readonly verified?: boolean; readonly changes?: readonly { readonly changeId?: string }[] };
      if (rateSet.verified !== true) throw new Error(`Rate write failed: ${JSON.stringify(rateSet)}`);
      scalarChanges.push(...(rateSet.changes ?? []).flatMap((change) => change.changeId ?? []));
      const observedPage = (await publicPages(workspace, container)).find(
        (page) => page.position === classic.position && page.name === classic.name,
      );
      observations.push({
        timebaseNormalized: mode,
        timebaseDisplay: observedPage?.controls[timebase.position]?.display,
        rateNormalized: normalizedValue,
        rateDisplay: observedPage?.controls[rate.position]?.display,
      });
    }
  }
  check('5v-display: stepped Timebase and continuous Rate have complete host display text',
    observations.length === 6 && observations.every((item) =>
      typeof item['timebaseDisplay'] === 'string' && item['timebaseDisplay'] !== ''
        && typeof item['rateDisplay'] === 'string' && item['rateDisplay'] !== ''), observations);
  check('5v-display: Timebase is tempo-stepped and Rate is free-running',
    observations.every((item) => String(item['timebaseDisplay']).includes('/')
      && String(item['rateDisplay']).endsWith(' Hz'))
      && new Set(observations.map((item) => item['rateDisplay'])).size >= 3,
    observations);
  note(`semantic observations ${JSON.stringify(observations)}`);
} catch (error) {
  check('5v-LX: the live proof completed without an unexpected failure', false,
    error instanceof Error ? `${error.name}: ${error.message}` : String(error));
} finally {
  for (const changeId of scalarChanges.reverse()) {
    try {
      const reversed = await callTool(workspace, 'revert_change', { changeId }) as {
        readonly applied?: boolean;
      };
      if (reversed.applied !== true) throw new Error(JSON.stringify(reversed));
    } catch (error) {
      check(`5v-cleanup: scalar ${changeId} reversed`, false,
        error instanceof Error ? error.message : String(error));
    }
  }
  if (wrappedContainer !== undefined && initialControls !== undefined) {
    try {
      const page = (await publicPages(workspace, wrappedContainer)).find((item) =>
        item.position === initialControls!.pagePosition && item.name === initialControls!.pageName);
      const rate = page?.controls.find((control) =>
        control.position === initialControls!.rate.position
          && control.name === initialControls!.rate.name);
      const timebase = page?.controls.find((control) =>
        control.position === initialControls!.timebase.position
          && control.name === initialControls!.timebase.name);
      check('5v-cleanup: Rate and Timebase restore their exact entry values',
        rate?.normalizedValue === initialControls.rate.normalizedValue
          && rate.display === initialControls.rate.display
          && timebase?.normalizedValue === initialControls.timebase.normalizedValue
          && timebase.display === initialControls.timebase.display,
        { initial: initialControls, final: { rate, timebase } });
    } catch (error) {
      check('5v-cleanup: Rate and Timebase restore their exact entry values', false,
        error instanceof Error ? error.message : String(error));
    }
  }
  if (wrapper?.reversalCheckpoint !== undefined) {
    try {
      const reversed = await callTool(workspace, 'reverse_existing_device_modulation_wrap', {
        checkpoint: wrapper.reversalCheckpoint,
      }) as { readonly complete?: boolean };
      check('5v-cleanup: the wrapper reverses exactly', reversed.complete === true, reversed);
    } catch (error) {
      check('5v-cleanup: the wrapper reverses exactly', false,
        error instanceof Error ? error.message : String(error));
    }
  }
  if (owner !== undefined) {
    const finalOrder = (await adapter.devices(owner)).devices.map((item) => ({
      name: item.name, enabled: item.enabled,
    }));
    check('5v-cleanup: the exact source order is restored',
      JSON.stringify(finalOrder) === JSON.stringify(entryOrder), { entryOrder, finalOrder });
  }
  const finalTracks = await adapter.tracks();
  check('5v-cleanup: the exact track list is restored', sameTracks(finalTracks, entryTracks), {
    entryTracks, finalTracks,
  });
  await adapter.close();
  clearInterval(keepAlive);
}

console.log(failureCount() === 0 ? '\nPhase 5v: ALL PASS' : `\nPhase 5v: ${failureCount()} FAILURE(S)`);
process.exit(failureCount() === 0 ? 0 : 1);
