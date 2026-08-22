/** Phase 4 session 4f: prove deep parameters, drum pads, and remote controls. */
import { LiveAdapter } from '../adapters/live/adapter.js';
import { BridgeTransport, type Transport } from '../adapters/live/transport.js';
import { WIRE, type Frame } from '../adapters/live/wiremap.js';
import { BridgeClient } from '../client.js';
import {
  addressKey, chain, device, deviceIn, drumPad, fullyApplied, param, remote, remotes, track,
  type DeviceAddress, type ParamState, type RemoteControlState, type RemotePageState,
} from '../contract/index.js';
import { check, failureCount, note, pollUntil } from './lib.js';

const PROJECT = '26.05-2 moon';
const TRACK_NAME = 'gn-4f-deep-parameter-proof';
const FX_LAYER = 'a0913b7f-096b-4ac9-bddd-33c775314b42';
const DRUM_MACHINE = '8ea97e45-0255-40fd-bc7e-94419741e9d1';
const POLYSYNTH = 'a9ffacb5-33e9-4fc7-8621-b1af31e410ef';
const TOLERANCE = 2e-3;

interface TrackRow {
  readonly index: number;
  readonly channelId: string;
  readonly name: string;
}

interface Selection {
  readonly trackIndex: number;
  readonly slotIndex: number;
}

interface LayerDevice {
  readonly index: number;
  readonly name: string;
}

interface LayerRow {
  readonly index: number;
  readonly name: string;
  readonly devices: readonly LayerDevice[];
}

interface LayerInventory {
  readonly layers: readonly LayerRow[];
  readonly itemCount: number;
  readonly bankSize: number;
  readonly deviceBankSize: number;
}

interface PadInventory {
  readonly pads: readonly { readonly index: number; readonly name: string }[];
  readonly itemCount: number;
  readonly bankSize: number;
}

class InterferenceTransport implements Transport {
  private readonly inner = new BridgeTransport();
  private interference: (() => Promise<void>) | undefined;
  readonly trace: unknown[] = [];

  arm(interference: () => Promise<void>): void {
    this.interference = interference;
  }

  async send(frame: Frame): Promise<unknown> {
    if (frame.method === WIRE.batchRun && this.interference !== undefined) {
      const interference = this.interference;
      this.interference = undefined;
      await interference();
    }
    const result = await this.inner.send(frame);
    if (frame.method === WIRE.deviceCursorStatus || frame.method === WIRE.deviceCursorSelectInLayer
        || frame.method === WIRE.layerList
        || frame.method === WIRE.directParamList) {
      const row = result as Record<string, unknown>;
      this.trace.push({
        method: frame.method,
        request: frame.params,
        result: frame.method === WIRE.deviceCursorSelectInLayer
          ? { sent: frame.params }
          : frame.method === WIRE.layerList
          ? {
            itemCount: row['itemCount'], bankSize: row['bankSize'],
            layers: (row['layers'] as readonly Record<string, unknown>[] | undefined)?.map((layer) => ({
              index: layer['index'], name: layer['name'], deviceCount: layer['deviceCount'],
              devices: layer['devices'],
            })),
          }
          : {
            exists: row['exists'], name: row['name'], isNested: row['isNested'],
            isPinned: row['isPinned'], deviceIndex: row['deviceIndex'],
            trackChannelId: row['trackChannelId'], trackPosition: row['trackPosition'],
            cursorTrackPinned: row['cursorTrackPinned'], count: row['count'],
            generation: row['generation'], idsGeneration: row['idsGeneration'],
            deviceExists: row['deviceExists'], deviceName: row['deviceName'],
            observedTrackChannelId: row['observedTrackChannelId'],
            observedDeviceName: row['observedDeviceName'],
            observedDeviceIndex: row['observedDeviceIndex'],
          },
      });
    }
    return result;
  }

  close(): Promise<void> {
    return this.inner.close();
  }
}

const bridge = new BridgeClient();
const transport = new InterferenceTransport();
const adapter = new LiveAdapter({ transport });
let ownedTrackId: string | undefined;
let entryTrackCount = 0;
let entrySelection: Selection | undefined;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function tracks(): Promise<readonly TrackRow[]> {
  return ((await bridge.request('track.list')) as { readonly tracks: readonly TrackRow[] }).tracks;
}

async function resolveOwned(): Promise<TrackRow | undefined> {
  if (ownedTrackId === undefined) return undefined;
  return (await tracks()).find((row) => row.channelId === ownedTrackId);
}

async function pointOwned(): Promise<TrackRow> {
  const row = await resolveOwned();
  if (row === undefined) throw new Error('the owned scratch track is absent');
  await bridge.request('cursor.pointTrack', { cursor: '0', trackIndex: row.index });
  const pointed = await pollUntil(async () => {
    const result = await bridge.request('device.list', { cursor: '0' }) as {
      readonly trackChannelId?: string;
    };
    return result.trackChannelId === ownedTrackId;
  }, 5000, 100);
  if (!pointed.ok) throw new Error('the device bank did not reach the owned track');
  return row;
}

async function devices(): Promise<readonly LayerDevice[]> {
  return ((await bridge.request('device.list', { cursor: '0' })) as {
    readonly devices: readonly LayerDevice[];
  }).devices;
}

async function layers(): Promise<LayerInventory> {
  return await bridge.request('layer.list') as LayerInventory;
}

async function pads(): Promise<PadInventory> {
  return await bridge.request('drumpad.list') as PadInventory;
}

async function selectTop(index: number): Promise<void> {
  await pointOwned();
  await bridge.request('devcursor.selectAt', { deviceIndex: index });
  const selected = await pollUntil(async () => {
    const status = await bridge.request('devcursor.status') as {
      readonly exists?: boolean;
      readonly deviceIndex?: number;
      readonly isNested?: boolean;
    };
    return status.exists === true && status.deviceIndex === index && status.isNested === false;
  }, 5000, 100);
  if (!selected.ok) throw new Error(`top-level device ${index} did not settle`);
}

async function createOwnedTrack(): Promise<void> {
  const before = await tracks();
  entryTrackCount = before.length;
  await bridge.request('track.create', { position: before.length });
  const created = await pollUntil(async () => (await tracks()).length === before.length + 1, 5000, 100);
  if (!created.ok) throw new Error('the scratch track did not appear');
  const known = new Set(before.map((row) => row.channelId));
  const row = (await tracks()).find((candidate) => !known.has(candidate.channelId));
  if (row === undefined) throw new Error('the scratch track has no new channel id');
  ownedTrackId = row.channelId;
  await bridge.request('track.setName', { trackIndex: row.index, name: TRACK_NAME });
  const named = await pollUntil(async () => (await resolveOwned())?.name === TRACK_NAME, 5000, 100);
  if (!named.ok) throw new Error('the scratch track name did not settle');
  await pointOwned();
  if ((await devices()).length !== 0) throw new Error('the scratch device chain is not empty');
}

async function insertTop(uuid: string, expectedCount: number): Promise<void> {
  await pointOwned();
  await bridge.request('device.insertBitwig', { cursor: '0', uuid });
  const inserted = await pollUntil(async () => (await devices()).length === expectedCount, 10000, 100);
  if (!inserted.ok) throw new Error(`top-level device count did not reach ${expectedCount}`);
}

async function buildFixture(): Promise<{
  readonly depth1: DeviceAddress;
  readonly depth2: DeviceAddress;
  readonly padDevice: DeviceAddress;
}> {
  await insertTop(FX_LAYER, 1);
  await selectTop(0);
  const firstOuter = (await layers()).layers[0];
  if (firstOuter === undefined) throw new Error('FX Layer has no visible layer');
  await bridge.request('layer.insertDevice', { layerIndex: firstOuter.index, uuid: POLYSYNTH });
  let populated = await pollUntil(async () => (await layers()).layers[0]?.devices.length === 1, 10000, 100);
  if (!populated.ok) throw new Error('the depth-1 Polysynth did not appear');
  await bridge.request('layer.insertDevice', { layerIndex: firstOuter.index, uuid: FX_LAYER });
  populated = await pollUntil(async () => (await layers()).layers[0]?.devices.length === 2, 10000, 100);
  if (!populated.ok) throw new Error('the depth-1 FX Layer did not appear');

  await bridge.request('devcursor.selectInLayer', { layerIndex: firstOuter.index, deviceIndex: 1 });
  const nested = await pollUntil(async () => {
    const status = await bridge.request('devcursor.status') as {
      readonly name?: string;
      readonly isNested?: boolean;
    };
    return status.isNested === true && status.name?.includes('Layer') === true;
  }, 5000, 100);
  if (!nested.ok) throw new Error('the nested FX Layer did not settle');
  const firstInner = (await layers()).layers[0];
  if (firstInner === undefined) throw new Error('the nested FX Layer has no visible layer');
  await bridge.request('layer.insertDevice', { layerIndex: firstInner.index, uuid: POLYSYNTH });
  populated = await pollUntil(async () => (await layers()).layers[0]?.devices.length === 1, 10000, 100);
  if (!populated.ok) throw new Error('the depth-2 Polysynth did not appear');

  await selectTop(0);
  const outer = (await layers()).layers[0];
  if (outer === undefined || outer.devices.length !== 2) {
    throw new Error('the complete outer layer inventory is unavailable');
  }
  const owned = track(ownedTrackId!);
  const outerChain = chain(device(owned, 0), outer.name);
  const depth1 = deviceIn(outerChain, 0);
  const innerContainer = deviceIn(outerChain, 1);
  await bridge.request('devcursor.selectInLayer', { layerIndex: outer.index, deviceIndex: 1 });
  await wait(300);
  const inner = (await layers()).layers[0];
  if (inner === undefined || inner.devices.length !== 1) {
    throw new Error('the complete inner layer inventory is unavailable');
  }
  const depth2 = deviceIn(chain(innerContainer, inner.name), 0);

  await insertTop(DRUM_MACHINE, 2);
  await selectTop(1);
  await bridge.request('drumpad.insertDevice', { padIndex: 3, uuid: POLYSYNTH });
  const padFilled = await pollUntil(async () => (await pads()).pads.some((pad) => pad.index === 3), 10000, 100);
  if (!padFilled.ok) throw new Error('drum-pad channel 3 did not populate');
  return { depth1, depth2, padDevice: deviceIn(drumPad(device(owned, 1), 3), 0) };
}

function safeParameter(params: readonly ParamState[]): ParamState | undefined {
  return params.find((candidate) => !/device on|bypass|preset|program|random|trigger|panic/i.test(candidate.name));
}

async function readParameter(deviceAddress: DeviceAddress, id: string): Promise<ParamState | undefined> {
  const address = param(deviceAddress, id);
  const snapshot = await adapter.read([address]);
  const entry = snapshot.entries[addressKey(address)];
  return entry?.value.of === 'param' ? entry.value.param : undefined;
}

async function proveParameter(label: string, deviceAddress: DeviceAddress): Promise<ParamState> {
  transport.trace.length = 0;
  const snapshot = await adapter.read([deviceAddress]);
  const entry = snapshot.entries[addressKey(deviceAddress)];
  const state = entry?.value.of === 'device' ? entry.value.device : undefined;
  const candidate = safeParameter(state?.params ?? []);
  check(`${label}: the DirectParameter inventory is named and non-empty`,
    candidate !== undefined && (state?.params?.length ?? 0) > 8,
    { address: addressKey(deviceAddress), device: state?.name, count: state?.params?.length,
      ...(candidate === undefined ? { trace: transport.trace.slice(-24) } : {}) });
  if (candidate === undefined) throw new Error(`${label} has no safe DirectParameter`);
  const requested = candidate.value <= 0.9 ? candidate.value + 0.05 : candidate.value - 0.05;
  const changed = await adapter.apply({
    ops: [{ op: 'param.set', param: param(deviceAddress, candidate.id), value: requested }],
  });
  const landed = await readParameter(deviceAddress, candidate.id);
  const restored = await adapter.apply({
    ops: [{ op: 'param.set', param: param(deviceAddress, candidate.id), value: candidate.value }],
  });
  const replayed = await readParameter(deviceAddress, candidate.id);
  check(`${label}: write, independent readback, and exact replay agree`,
    fullyApplied(changed) && landed !== undefined
      && Math.abs(landed.value - requested) <= TOLERANCE
      && fullyApplied(restored) && replayed !== undefined
      && Math.abs(replayed.value - candidate.value) <= TOLERANCE,
    { parameter: candidate.name, before: candidate.value, requested, landed: landed?.value,
      replayed: replayed?.value });
  return candidate;
}

function safeRemote(pages: readonly RemotePageState[]): {
  readonly page: RemotePageState;
  readonly control: RemoteControlState;
} | undefined {
  for (const page of pages) {
    const control = page.controls.find((candidate) =>
      !/device on|bypass|preset|program|random|trigger|panic/i.test(candidate.name));
    if (control !== undefined) return { page, control };
  }
  return undefined;
}

async function cleanup(): Promise<void> {
  const row = await resolveOwned();
  if (row !== undefined) {
    await bridge.request('track.delete', { trackIndex: row.index });
    await pollUntil(async () => (await resolveOwned()) === undefined, 5000, 100);
  }
  if (entrySelection !== undefined && entrySelection.trackIndex >= 0 && entrySelection.slotIndex >= 0) {
    await bridge.request('slot.select', { ...entrySelection, mechanism: 'track' });
    await wait(150);
  }
}

try {
  await bridge.connect();
  entrySelection = await bridge.request('selection.status') as Selection;
  await createOwnedTrack();
  const targets = await buildFixture();
  const info = await adapter.hello();
  const revision = await adapter.revision();
  check('4f-L1: the accepted project and new extension contract are live',
    revision.project === PROJECT && info.methodsHash !== undefined,
    { project: revision.project, methodsHash: info.methodsHash });

  await proveParameter('4f-L2 depth 1', targets.depth1);
  await proveParameter('4f-L3 depth 2', targets.depth2);
  await proveParameter('4f-L4 drum-pad channel 3', targets.padDevice);

  const remoteInventoryAddress = remotes(targets.depth2);
  const inventory = await adapter.read([remoteInventoryAddress]);
  const entry = inventory.entries[addressKey(remoteInventoryAddress)];
  const pages = entry?.value.of === 'remotes' ? entry.value.remotes.pages : [];
  const picked = safeRemote(pages);
  check('4f-L5: remote pages enumerate names and indexes with modulated values',
    pages.length > 0 && pages.every((page, index) => page.index === index && page.name.trim() !== '')
      && picked !== undefined && Number.isFinite(picked.control.modulatedValue),
    { pages: pages.map((page) => ({ index: page.index, name: page.name, controls: page.controls.length })) });
  if (picked === undefined) throw new Error('the depth-2 device has no safe remote control');

  const remoteAddress = remote(targets.depth2, picked.page.index, picked.page.name,
    picked.control.index, picked.control.name);
  const requestedRemote = picked.control.value <= 0.9
    ? picked.control.value + 0.05 : picked.control.value - 0.05;
  const remoteWrite = await adapter.apply({
    ops: [{ op: 'remote.set', remote: remoteAddress, value: requestedRemote }],
  });
  const remoteChanged = await adapter.read([remoteAddress]);
  const changedEntry = remoteChanged.entries[addressKey(remoteAddress)];
  const changedControl = changedEntry?.value.of === 'remote' ? changedEntry.value.remote : undefined;
  const remoteRestore = await adapter.apply({
    ops: [{ op: 'remote.set', remote: remoteAddress, value: picked.control.value }],
  });
  const remoteAfter = await adapter.read([remoteAddress]);
  const afterEntry = remoteAfter.entries[addressKey(remoteAddress)];
  const afterControl = afterEntry?.value.of === 'remote' ? afterEntry.value.remote : undefined;
  check('4f-L6: one remote write lands and exact replay restores its base value',
    fullyApplied(remoteWrite) && changedControl !== undefined
      && Math.abs(changedControl.value - requestedRemote) <= TOLERANCE
      && Number.isFinite(changedControl.modulatedValue)
      && fullyApplied(remoteRestore) && afterControl !== undefined
      && Math.abs(afterControl.value - picked.control.value) <= TOLERANCE,
    { page: picked.page.name, control: picked.control.name, before: picked.control.value,
      requested: requestedRemote, landed: changedControl?.value, replayed: afterControl?.value });

  const selectionToPreserve = entrySelection !== undefined
    && entrySelection.trackIndex >= 0 && entrySelection.slotIndex >= 0
    ? entrySelection : { trackIndex: 0, slotIndex: 0 };
  await bridge.request('slot.select', { ...selectionToPreserve, mechanism: 'track' });
  await pollUntil(async () => {
    const current = await bridge.request('selection.status') as Selection;
    return current.trackIndex === selectionToPreserve.trackIndex
      && current.slotIndex === selectionToPreserve.slotIndex;
  }, 3000, 100);
  const held = await readParameter(targets.depth2, (await proveParameter(
    '4f-L7 held depth-2 target', targets.depth2)).id);
  if (held === undefined) throw new Error('the held target parameter is unavailable');
  const heldAddress = param(targets.depth2, held.id);
  const heldRequested = held.value <= 0.9 ? held.value + 0.05 : held.value - 0.05;
  let interferenceFired = false;
  transport.arm(async () => {
    const row = await resolveOwned();
    if (row === undefined) throw new Error('the interference track is absent');
    await bridge.request('slot.select', { trackIndex: row.index, slotIndex: 0, mechanism: 'track' });
    interferenceFired = true;
  });
  const heldWrite = await adapter.apply({
    ops: [{ op: 'param.set', param: heldAddress, value: heldRequested }],
  });
  const heldLanded = await readParameter(targets.depth2, held.id);
  const selectionAfter = await bridge.request('selection.status') as Selection;
  const heldRestore = await adapter.apply({
    ops: [{ op: 'param.set', param: heldAddress, value: held.value }],
  });
  check('4f-L8: a concurrent selection change cannot retarget the held deep write',
    interferenceFired && fullyApplied(heldWrite) && heldLanded !== undefined
      && Math.abs(heldLanded.value - heldRequested) <= TOLERANCE
      && selectionAfter.trackIndex === selectionToPreserve.trackIndex
      && selectionAfter.slotIndex === selectionToPreserve.slotIndex
      && fullyApplied(heldRestore),
    { interferenceFired, requested: heldRequested, landed: heldLanded?.value,
      selectionToPreserve, selectionAfter });
} catch (error) {
  check('4f-LX: the deep parameter proof completed without an unexpected failure', false,
    error instanceof Error ? `${error.name}: ${error.message}` : String(error));
} finally {
  try {
    await cleanup();
  } catch (error) {
    check('4f-L9: cleanup removes the owned scratch track', false,
      error instanceof Error ? error.message : String(error));
  }
  const finalTracks = await tracks().catch(() => []);
  check('4f-L9: cleanup removes the owned scratch track and restores the track count',
    ownedTrackId !== undefined && finalTracks.length === entryTrackCount
      && !finalTracks.some((row) => row.channelId === ownedTrackId),
    { entryTrackCount, finalTrackCount: finalTracks.length, ownedTrackId });
  await adapter.close();
  bridge.disconnect();
}

note(`Phase 4 session 4f live proof: ${failureCount() === 0 ? 'PASS' : 'FAILED'}`);
if (failureCount() > 0) process.exitCode = 1;
