/** D02 Session 3 live timing and reversal proof for cohort parameter writes. */
import { LiveAdapter } from '../adapters/live/adapter.js';
import { BridgeTransport, type Transport } from '../adapters/live/transport.js';
import { WIRE, type Frame } from '../adapters/live/wiremap.js';
import { BridgeClient } from '../client.js';
import {
  addressKey, chain, device, deviceIn, remotes, track,
  type DeviceAddress, type RemoteControlState, type RemotePageState, type TrackState,
} from '../contract/index.js';
import { Executor } from '../engine/index.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { callTool } from '../surface/tools.js';
import { workspaceOf } from '../surface/workspace.js';
import { check, failureCount, note, pollUntil } from './lib.js';

const TRACK_NAME = 'gn-d02-s3-parameter-cohort';
const FX_LAYER = 'a0913b7f-096b-4ac9-bddd-33c775314b42';
const POLYSYNTH = 'a9ffacb5-33e9-4fc7-8621-b1af31e410ef';
const BASELINE_MS = 33_300;
const TOLERANCE = 2e-3;

interface TrackRow extends TrackState { readonly index: number }
interface LayerRow {
  readonly index: number;
  readonly name: string;
  readonly devices: readonly { readonly index: number; readonly name: string }[];
}

class TraceTransport implements Transport {
  readonly frames: Frame[] = [];
  private readonly bridge = new BridgeTransport();

  async send(frame: Frame): Promise<unknown> {
    const result = await this.bridge.send(frame);
    this.frames.push(frame);
    return result;
  }

  close(): Promise<void> {
    return this.bridge.close();
  }
}

const trace = new TraceTransport();
const adapter = new LiveAdapter({ transport: trace });
const raw = new BridgeClient();
let ownedTrackId: string | undefined;
let entryTracks: readonly TrackState[] = [];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(method: string, params?: Record<string, unknown>): Promise<unknown> {
  return raw.request(method, params);
}

async function tracks(): Promise<readonly TrackRow[]> {
  return ((await request('track.list')) as { readonly tracks: readonly TrackRow[] }).tracks;
}

async function ownedRow(): Promise<TrackRow | undefined> {
  return (await tracks()).find((row) => row.channelId === ownedTrackId);
}

async function pointOwned(): Promise<TrackRow> {
  const row = await ownedRow();
  if (row === undefined) throw new Error('the owned track is absent');
  await request('cursor.pointTrack', { cursor: '0', trackIndex: row.index });
  const pointed = await pollUntil(async () => {
    const result = await request('device.list', { cursor: '0' }) as {
      readonly trackChannelId?: string;
    };
    return result.trackChannelId === ownedTrackId;
  }, 5000, 100);
  if (!pointed.ok) throw new Error('the device bank did not reach the owned track');
  return row;
}

async function topDevices(): Promise<readonly { readonly index: number; readonly name: string }[]> {
  return ((await request('device.list', { cursor: '0' })) as {
    readonly devices: readonly { readonly index: number; readonly name: string }[];
  }).devices;
}

async function layers(): Promise<readonly LayerRow[]> {
  return ((await request('layer.list')) as { readonly layers: readonly LayerRow[] }).layers;
}

async function createFixture(): Promise<{
  readonly target: DeviceAddress;
  readonly outerName: string;
  readonly innerName: string;
}> {
  const before = await tracks();
  await request('track.create', { position: before.length });
  const created = await pollUntil(async () => (await tracks()).length === before.length + 1, 5000, 100);
  if (!created.ok) throw new Error('the scratch track did not appear');
  const known = new Set(before.map((row) => row.channelId));
  const row = (await tracks()).find((candidate) => !known.has(candidate.channelId));
  if (row === undefined) throw new Error('the scratch track has no durable id');
  ownedTrackId = row.channelId;
  await request('track.setName', { trackIndex: row.index, name: TRACK_NAME });
  await pointOwned();

  await request('device.insertBitwig', { cursor: '0', uuid: FX_LAYER });
  const topReady = await pollUntil(async () => (await topDevices()).length === 1, 10_000, 100);
  if (!topReady.ok) throw new Error('the top-level FX Layer did not appear');
  await request('devcursor.selectAt', { deviceIndex: 0 });
  await wait(300);
  const outer = (await layers())[0];
  if (outer === undefined) throw new Error('the outer FX Layer has no visible entry');

  await request('layer.insertDevice', { layerIndex: outer.index, uuid: FX_LAYER });
  const innerReady = await pollUntil(async () => (await layers())[0]?.devices.length === 1, 10_000, 100);
  if (!innerReady.ok) throw new Error('the nested FX Layer did not appear');
  await request('devcursor.selectInLayer', { layerIndex: outer.index, deviceIndex: 0 });
  await wait(300);
  const inner = (await layers())[0];
  if (inner === undefined) throw new Error('the nested FX Layer has no visible entry');

  await request('layer.insertDevice', { layerIndex: inner.index, uuid: POLYSYNTH });
  const synthReady = await pollUntil(async () => (await layers())[0]?.devices.length === 1, 10_000, 100);
  if (!synthReady.ok) throw new Error('the depth-2 Polysynth did not appear');

  await pointOwned();
  await request('devcursor.selectAt', { deviceIndex: 0 });
  await wait(300);
  const observedOuter = (await layers())[0];
  if (observedOuter === undefined || observedOuter.devices.length !== 1) {
    throw new Error('the complete outer entry is unavailable');
  }
  await request('devcursor.selectInLayer', {
    layerIndex: observedOuter.index,
    deviceIndex: 0,
  });
  await wait(300);
  const observedInner = (await layers())[0];
  if (observedInner === undefined || observedInner.devices.length !== 1) {
    throw new Error('the complete inner entry is unavailable');
  }

  const owned = track(ownedTrackId);
  const innerContainer = deviceIn(chain(device(owned, 0), observedOuter.name), 0);
  return {
    target: deviceIn(chain(innerContainer, observedInner.name), 0),
    outerName: observedOuter.name,
    innerName: observedInner.name,
  };
}

function safeControls(pages: readonly RemotePageState[]): readonly {
  readonly page: RemotePageState;
  readonly control: RemoteControlState;
}[] {
  return pages.flatMap((page) => page.controls.map((control) => ({ page, control })))
    .filter(({ control }) =>
      !/device on|bypass|preset|program|random|trigger|panic/i.test(control.name))
    .slice(0, 4);
}

function sameTracks(left: readonly TrackState[], right: readonly TrackState[]): boolean {
  return JSON.stringify(left.map((item) => [item.channelId, item.name, item.position, item.type]))
    === JSON.stringify(right.map((item) => [item.channelId, item.name, item.position, item.type]));
}

async function cleanup(): Promise<void> {
  const row = await ownedRow();
  if (row === undefined) return;
  await request('track.delete', { trackIndex: row.index });
  await pollUntil(async () => await ownedRow() === undefined, 5000, 100);
}

try {
  await raw.connect();
  const info = await adapter.hello();
  entryTracks = await adapter.tracks();
  const fixture = await createFixture();
  const target = fixture.target;
  const inventoryAddress = remotes(target);
  const inventory = await adapter.read([inventoryAddress]);
  const inventoryEntry = inventory.entries[addressKey(inventoryAddress)];
  const pages = inventoryEntry?.value.of === 'remotes'
    ? inventoryEntry.value.remotes.pages : [];
  const controls = safeControls(pages);
  check('d02-s3-L1: one depth-2 device exposes four safe remote controls',
    controls.length === 4,
    { methodHash: info.methodsHash, pages: pages.map((page) => ({ name: page.name, controls: page.controls.length })) });
  if (controls.length !== 4 || ownedTrackId === undefined) {
    throw new Error('the depth-2 remote cohort is incomplete');
  }

  const settings = controls.map(({ page, control }, index) => ({
    kind: 'remote' as const,
    device: {
      trackId: ownedTrackId!, devicePosition: 0,
      route: [
        { through: 'named-container-entry' as const, name: fixture.outerName, devicePosition: 0 },
        { through: 'named-container-entry' as const, name: fixture.innerName, devicePosition: 0 },
      ],
    },
    pagePosition: page.index,
    pageName: page.name,
    controlPosition: control.index,
    controlName: control.name,
    normalizedValue: control.value <= 0.9 ? control.value + 0.05 : control.value - 0.05,
  }));
  const beforeValues = controls.map(({ control }) => control.value);
  const workspace = workspaceOf({
    ready: async () => undefined,
    adapter,
    executor: new Executor(adapter),
    stash: new Stash(),
    observationStore: new FakeObservationStore(),
  });
  trace.frames.length = 0;
  const started = performance.now();
  const result = await callTool(workspace, 'set_parameter', { settings }) as {
    readonly verified?: boolean;
    readonly changes?: readonly { readonly changeId: string }[];
    readonly elapsedMs?: number;
  };
  const wallMs = performance.now() - started;
  const begins = trace.frames.filter((frame) =>
    frame.method === WIRE.remoteList && frame.params?.['begin'] === true).length;
  const writes = trace.frames.flatMap((frame) => frame.method === WIRE.batchRun
    ? ((frame.params?.['ops'] as readonly { readonly method: string }[] | undefined) ?? [])
    : [frame])
    .filter((frame) => frame.method === WIRE.remoteSet);
  check('d02-s3-L2: one public cohort returns four independent scalar receipts',
    result.verified === true
      && result.changes?.length === 4
      && new Set(result.changes.map((change) => change.changeId)).size === 4,
    result);
  check('d02-s3-L3: the trace has one preflight inventory and one complete readback',
    begins === 2 && writes.length === 4,
    { begins, writes: writes.length, methods: trace.frames.map((frame) => frame.method) });
  check('d02-s3-L4: the four-control call is at least 50 percent faster than 33.3 seconds',
    wallMs < BASELINE_MS / 2,
    { baselineMs: BASELINE_MS, targetMs: BASELINE_MS / 2, wallMs, reportedMs: result.elapsedMs });

  const changed = await adapter.read(settings.map((setting) => ({
    kind: 'remote' as const,
    device: target,
    pageIndex: setting.pagePosition,
    pageName: setting.pageName,
    controlIndex: setting.controlPosition,
    controlName: setting.controlName,
  })));
  check('d02-s3-L5: every requested base value reads back exactly',
    settings.every((setting, index) => {
      const address = {
        kind: 'remote' as const, device: target,
        pageIndex: setting.pagePosition, pageName: setting.pageName,
        controlIndex: setting.controlPosition, controlName: setting.controlName,
      };
      const entry = changed.entries[addressKey(address)];
      return entry?.value.of === 'remote'
        && Math.abs(entry.value.remote.value - setting.normalizedValue) <= TOLERANCE;
    }),
    settings.map((setting) => setting.normalizedValue));

  if (result.changes === undefined) throw new Error('the cohort returned no scalar receipts');
  for (const change of [...result.changes].reverse()) {
    const reversed = await callTool(workspace, 'revert_change', { changeId: change.changeId }) as {
      readonly applied?: boolean;
    };
    if (reversed.applied !== true) throw new Error(`reversal failed for ${change.changeId}`);
  }
  const final = await adapter.read(settings.map((setting) => ({
    kind: 'remote' as const, device: target,
    pageIndex: setting.pagePosition, pageName: setting.pageName,
    controlIndex: setting.controlPosition, controlName: setting.controlName,
  })));
  check('d02-s3-L6: exact replay restores all four prior base values',
    settings.every((setting, index) => {
        const address = {
          kind: 'remote' as const, device: target,
          pageIndex: setting.pagePosition, pageName: setting.pageName,
          controlIndex: setting.controlPosition, controlName: setting.controlName,
        };
        const entry = final.entries[addressKey(address)];
        return entry?.value.of === 'remote'
          && Math.abs(entry.value.remote.value - beforeValues[index]!) <= TOLERANCE;
      }),
    { beforeValues });
} catch (error) {
  check('d02-s3-LX: the focused cohort proof completed without an unexpected failure', false,
    error instanceof Error ? `${error.name}: ${error.message}` : String(error));
} finally {
  try {
    await cleanup();
  } catch (error) {
    check('d02-s3-cleanup: owned content was removed', false,
      error instanceof Error ? error.message : String(error));
  }
  try {
    const finalTracks = await adapter.tracks();
    check('d02-s3-cleanup: the exact entry track list is restored',
      sameTracks(finalTracks, entryTracks),
      { entry: entryTracks, final: finalTracks });
  } catch (error) {
    check('d02-s3-cleanup: final inventory completed', false,
      error instanceof Error ? error.message : String(error));
  }
  await adapter.close();
  raw.disconnect();
}

note(`D02 Session 3 live proof: ${failureCount() === 0 ? 'PASS' : 'FAILED'}`);
process.exit(failureCount() === 0 ? 0 : 1);
