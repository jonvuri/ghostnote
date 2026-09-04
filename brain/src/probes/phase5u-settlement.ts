/** Live proof for bounded nested remote settlement on ColourCopy. */
import { performance } from 'node:perf_hooks';

import { LiveAdapter } from '../adapters/live/adapter.js';
import { BridgeTransport, type Transport } from '../adapters/live/transport.js';
import { WIRE, type Frame } from '../adapters/live/wiremap.js';
import {
  addressKey, chain, device, deviceIn, remotes, track,
  type DeviceAddress, type TrackAddress, type TrackState,
} from '../contract/index.js';
import { Executor } from '../engine/index.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { callTool } from '../surface/tools.js';
import { workspaceOf, type Workspace } from '../surface/workspace.js';
import { check, client, failureCount, note } from './lib.js';

interface RemoteEvent {
  readonly atMs: number;
  readonly begin: boolean;
  readonly generation?: number;
  readonly observedGeneration?: number;
  readonly observedDeviceIndex?: number;
  readonly observedTrackChannelId?: string;
  readonly deviceName?: string;
  readonly deviceExists?: boolean;
  readonly isNested?: boolean;
  readonly pageCount?: number;
  readonly pagesComplete?: boolean;
  readonly pageNames?: readonly string[];
  readonly pages?: readonly {
    readonly index?: number;
    readonly selectedPageIndex?: number;
    readonly observedGeneration?: number;
    readonly observedDeviceIndex?: number;
    readonly name?: string;
    readonly existing?: number;
    readonly bankSize?: number;
    readonly validControls?: number;
    readonly invalidControls?: readonly Record<string, unknown>[];
  }[];
}

function remoteEventSummary(events: readonly RemoteEvent[]): unknown {
  const relevant = events.filter((event) => event.deviceName === 'ColourCopy' || event.isNested);
  const generations = new Map<number | undefined, RemoteEvent[]>();
  for (const event of relevant) {
    const rows = generations.get(event.generation) ?? [];
    rows.push(event);
    generations.set(event.generation, rows);
  }
  return [...generations.entries()].map(([generation, rows]) => ({
    generation,
    reads: rows.length,
    elapsedMs: Math.round(rows.at(-1)!.atMs - rows[0]!.atMs),
    nested: rows.at(-1)!.isNested,
    fresh: rows.at(-1)!.observedGeneration === generation,
    observedDeviceIndex: rows.at(-1)!.observedDeviceIndex,
    pagesComplete: rows.at(-1)!.pagesComplete,
    pageCount: rows.at(-1)!.pageCount,
    pageIdentitiesCurrent: rows.at(-1)!.pages?.every((page) =>
      page.index === page.selectedPageIndex && page.observedGeneration === generation),
    unnamedSlots: rows.at(-1)!.pages?.reduce((count, page) =>
      count + (page.invalidControls?.filter((control) => control['name'] === '').length ?? 0), 0),
    pageStates: rows.at(-1)!.pages?.map((page) => [
      page.index, page.selectedPageIndex, page.observedGeneration,
      page.observedDeviceIndex, page.existing, page.validControls,
      page.invalidControls?.length ?? 0,
    ]),
  }));
}

class SettlementTransport implements Transport {
  readonly events: RemoteEvent[] = [];
  private delayNext = false;
  private delayedGeneration: number | undefined;

  constructor(private readonly inner: Transport) {}

  delayOneGeneration(): void {
    this.delayNext = true;
    this.delayedGeneration = undefined;
  }

  async send(frame: Frame): Promise<unknown> {
    const result = await this.inner.send(frame);
    if (frame.method !== WIRE.remoteList || result === null || typeof result !== 'object') return result;
    const wire = result as Record<string, unknown>;
    const begin = frame.params?.['begin'] === true;
    const generation = typeof wire['generation'] === 'number' ? wire['generation'] : undefined;
    if (begin && this.delayNext) {
      if (this.delayedGeneration === undefined) this.delayedGeneration = generation;
      else if (generation !== this.delayedGeneration) {
        this.delayNext = false;
        this.delayedGeneration = undefined;
      }
    }
    this.events.push({
      atMs: performance.now(), begin, generation,
      observedGeneration: typeof wire['observedGeneration'] === 'number'
        ? wire['observedGeneration'] : undefined,
      observedDeviceIndex: typeof wire['observedDeviceIndex'] === 'number'
        ? wire['observedDeviceIndex'] : undefined,
      observedTrackChannelId: typeof wire['observedTrackChannelId'] === 'string'
        ? wire['observedTrackChannelId'] : undefined,
      deviceName: typeof wire['deviceName'] === 'string' ? wire['deviceName'] : undefined,
      deviceExists: wire['deviceExists'] === true,
      isNested: wire['isNested'] === true,
      pageCount: typeof wire['pageCount'] === 'number' ? wire['pageCount'] : undefined,
      pagesComplete: wire['pagesComplete'] === true,
      pageNames: Array.isArray(wire['pageNames']) ? wire['pageNames'] as string[] : undefined,
      pages: Array.isArray(wire['pages']) ? wire['pages'].map((pageValue) => {
        const page = pageValue as Record<string, unknown>;
        const controls = Array.isArray(page['remotes'])
          ? page['remotes'] as Record<string, unknown>[] : [];
        return {
          index: typeof page['index'] === 'number' ? page['index'] : undefined,
          selectedPageIndex: typeof page['selectedPageIndex'] === 'number'
            ? page['selectedPageIndex'] : undefined,
          observedGeneration: typeof page['observedGeneration'] === 'number'
            ? page['observedGeneration'] : undefined,
          observedDeviceIndex: typeof page['observedDeviceIndex'] === 'number'
            ? page['observedDeviceIndex'] : undefined,
          name: typeof page['name'] === 'string' ? page['name'] : undefined,
          existing: typeof page['existing'] === 'number' ? page['existing'] : undefined,
          bankSize: typeof page['bankSize'] === 'number' ? page['bankSize'] : undefined,
          validControls: controls.filter((control) => control['exists'] === true
            && typeof control['name'] === 'string' && control['name'] !== ''
            && typeof control['value'] === 'number'
            && typeof control['modulatedValue'] === 'number'
            && typeof control['isBeingMapped'] === 'boolean').length,
          invalidControls: controls.filter((control) => control['exists'] === true
            && !(typeof control['name'] === 'string' && control['name'] !== ''
              && typeof control['value'] === 'number'
              && typeof control['modulatedValue'] === 'number'
              && typeof control['isBeingMapped'] === 'boolean')),
        };
      }) : undefined,
    });
    if (!this.delayNext || generation !== this.delayedGeneration) return result;
    const stale = generation === undefined ? -1 : generation - 1;
    return {
      ...wire,
      observedGeneration: stale,
      pages: Array.isArray(wire['pages'])
        ? wire['pages'].map((page) => ({ ...(page as object), observedGeneration: stale }))
        : wire['pages'],
    };
  }

  close(): Promise<void> {
    return this.inner.close();
  }
}

interface WrapperResult {
  readonly complete?: boolean;
  readonly verification?: {
    readonly pages?: { readonly verified?: boolean };
    readonly behaviors?: readonly {
      readonly verified?: boolean;
      readonly maximumDivergence?: number;
      readonly settlement?: { readonly elapsedMs?: number; readonly attempts?: number };
    }[];
  };
  readonly reversalCheckpoint?: unknown;
}

function sameTracks(left: readonly TrackState[], right: readonly TrackState[]): boolean {
  return JSON.stringify(left.map((item) => [item.channelId, item.name, item.position, item.type]))
    === JSON.stringify(right.map((item) => [item.channelId, item.name, item.position, item.type]));
}

async function findColourCopy(adapter: LiveAdapter): Promise<{
  readonly address: DeviceAddress;
  readonly owner: TrackAddress;
  readonly order: readonly { readonly name: string; readonly enabled: boolean }[];
}> {
  for (const row of await adapter.tracks()) {
    const owner = track(row.channelId);
    const bank = await adapter.devices(owner);
    for (const item of bank.devices) {
      const top = device(owner, item.index);
      if (item.name === 'ColourCopy') {
        return {
          address: top, owner,
          order: bank.devices.map((entry) => ({ name: entry.name, enabled: entry.enabled as boolean })),
        };
      }
      const snapshot = await adapter.read([top]);
      const value = snapshot.entries[addressKey(top)]?.value;
      const container = value?.of === 'device' ? value.device.container : undefined;
      for (const entry of container?.chains ?? []) {
        const nested = entry.devices.find((candidate) => candidate.name === 'ColourCopy');
        if (nested !== undefined) {
          return {
            address: deviceIn(chain(top, entry.name), nested.index), owner,
            order: bank.devices.map((candidate) => ({
              name: candidate.name, enabled: candidate.enabled as boolean,
            })),
          };
        }
      }
    }
  }
  throw new Error('no visible ColourCopy device was found');
}

async function remoteRead(
  adapter: LiveAdapter, address: DeviceAddress,
): Promise<{ readonly elapsedMs: number; readonly names: readonly string[] }> {
  const selector = remotes(address);
  const started = performance.now();
  const snapshot = await adapter.read([selector]);
  const elapsedMs = Math.round(performance.now() - started);
  const value = snapshot.entries[addressKey(selector)]?.value;
  if (value?.of !== 'remotes') {
    throw new Error(`remote inventory stayed ${snapshot.unstable.length > 0 ? 'unstable' : 'missing'}`);
  }
  return {
    elapsedMs,
    names: value.remotes.pages.flatMap((page) => page.controls.map((control) => control.name)),
  };
}

async function reverseWrapper(workspace: Workspace, result: WrapperResult): Promise<void> {
  if (result.reversalCheckpoint === undefined) throw new Error('the wrapper returned no reversal checkpoint');
  const reversed = await callTool(workspace, 'reverse_existing_device_modulation_wrap', {
    checkpoint: result.reversalCheckpoint,
  }) as { readonly complete?: boolean };
  if (reversed.complete !== true) throw new Error(`wrapper reversal failed: ${JSON.stringify(reversed)}`);
}

await client.connect();
const transport = new SettlementTransport(new BridgeTransport(client));
const adapter = new LiveAdapter({ transport });
const keepAlive = setInterval(() => undefined, 1_000);
let entryTracks: readonly TrackState[] = [];
let entryDeviceOrder: readonly { readonly name: string; readonly enabled?: boolean }[] = [];
let sourceOwner: TrackAddress | undefined;
let pendingWrapper: { readonly workspace: Workspace; readonly result: WrapperResult } | undefined;

try {
  const hello = await adapter.hello();
  note(`Bitwig ${hello.host?.version ?? 'unknown'}; contract ${hello.contractVersion}`);
  entryTracks = await adapter.tracks();
  const source = await findColourCopy(adapter);
  sourceOwner = source.owner;
  entryDeviceOrder = (await adapter.devices(source.owner)).devices.map((item) => ({
    name: item.name, enabled: item.enabled,
  }));
  if (source.address.chain !== undefined) {
    throw new Error('the live wrapper fixture requires one top-level ColourCopy source');
  }

  const cold = await remoteRead(adapter, source.address);
  const warm = await remoteRead(adapter, source.address);
  transport.delayOneGeneration();
  const delayed = await remoteRead(adapter, source.address);
  check('5u-source: ColourCopy settles cold, warm, and after one stale generation',
    cold.names.length > 0 && warm.names.length > 0 && delayed.names.length > 0,
    { cold, warm, delayed });

  const direct = await adapter.read([source.address]);
  const directValue = direct.entries[addressKey(source.address)]?.value;
  const params = directValue?.of === 'device' ? directValue.device.params ?? [] : [];
  const controls = (await remoteRead(adapter, source.address)).names;
  const targets = params.filter((item) => item.name.trim() !== '' && controls.includes(item.name)).slice(0, 2);
  if (targets.length < 2) {
    throw new Error(`ColourCopy exposed only ${targets.length} exact DirectParameter-to-remote matches`);
  }

  const workspace = workspaceOf({
    ready: async () => undefined,
    adapter,
    executor: new Executor(adapter),
    stash: new Stash(),
    observationStore: new FakeObservationStore(),
  });
  const timings: { run: string; elapsedMs: number; result: WrapperResult }[] = [];
  for (const run of ['cold', 'warm']) {
    const order = await adapter.devices(source.owner);
    const started = performance.now();
    const result = await callTool(workspace, 'wrap_existing_device_modulation', {
      trackId: source.owner.channelId,
      devicePosition: source.address.chainIndex,
      expectedDeviceOrder: order.devices.map((item) => ({ name: item.name, enabled: item.enabled })),
      containerKind: 'FX Layer',
      entryName: 'Layer 1',
      modulators: targets.map((target, index) => ({
        modulator: index === 0 ? 'lfo' : 'classic-lfo',
        target: { parameterId: target.id, parameterName: target.name },
        amount: index === 0 ? 0.3 : 0.25,
      })),
    }) as WrapperResult;
    pendingWrapper = { workspace, result };
    timings.push({ run, elapsedMs: Math.round(performance.now() - started), result });
    check(`5u-${run}: two nested ColourCopy routes pass active verification`,
      result.complete === true && result.verification?.pages?.verified === true
        && result.verification.behaviors?.length === 2
        && result.verification.behaviors.every((item) => item.verified === true
          && (item.maximumDivergence ?? 0) >= 1e-3),
      { targets: targets.map((item) => item.name), elapsedMs: timings.at(-1)?.elapsedMs, result });
    await reverseWrapper(workspace, result);
    pendingWrapper = undefined;
  }
  note(`timings ${JSON.stringify({ cold, warm, delayed, wrappers: timings.map((item) => ({
    run: item.run,
    elapsedMs: item.elapsedMs,
    settlement: item.result.verification?.behaviors?.map((behavior) => behavior.settlement),
  })) })}`);
  note(`remote events ${JSON.stringify(remoteEventSummary(transport.events))}`);
} catch (error) {
  check('5u-LX: the live proof completed without an unexpected failure', false,
    error instanceof Error ? `${error.name}: ${error.message}` : String(error));
  note(`remote events before failure ${JSON.stringify(remoteEventSummary(transport.events))}`);
} finally {
  if (pendingWrapper !== undefined) {
    try {
      await reverseWrapper(pendingWrapper.workspace, pendingWrapper.result);
      pendingWrapper = undefined;
    } catch (error) {
      check('5u-cleanup: the pending wrapper was reversed', false,
        error instanceof Error ? error.message : String(error));
    }
  }
  if (sourceOwner !== undefined) {
    try {
      const finalOrder = (await adapter.devices(sourceOwner)).devices.map((item) => ({
        name: item.name, enabled: item.enabled,
      }));
      check('5u-cleanup: the exact source device order is restored',
        JSON.stringify(finalOrder) === JSON.stringify(entryDeviceOrder), {
          entry: entryDeviceOrder, final: finalOrder,
        });
    } catch (error) {
      check('5u-cleanup: the exact source device order is restored', false,
        error instanceof Error ? error.message : String(error));
    }
  }
  try {
    const finalTracks = await adapter.tracks();
    check('5u-cleanup: the exact entry track list is restored', sameTracks(finalTracks, entryTracks), {
      entry: entryTracks, final: finalTracks,
    });
  } catch (error) {
    check('5u-cleanup: the exact entry track list is restored', false,
      error instanceof Error ? error.message : String(error));
  }
  await adapter.close();
  clearInterval(keepAlive);
}

console.log(failureCount() === 0 ? '\nPhase 5u: ALL PASS' : `\nPhase 5u: ${failureCount()} FAILURE(S)`);
process.exit(failureCount() === 0 ? 0 : 1);
