/** Phase 4 session 4e: prove explicit VST3 and CLAP parameter control. */
import { LiveAdapter } from '../adapters/live/adapter.js';
import { BridgeTransport } from '../adapters/live/transport.js';
import { BridgeClient } from '../client.js';
import {
  addressKey, device, failures, fullyApplied, param, track,
  type DeviceAddress, type DeviceState, type ParamState,
} from '../contract/index.js';
import { check, failureCount, note, pollUntil } from './lib.js';
import {
  DevicePerformanceRecorder, DeviceTimingTransport, type DevicePerformanceSample,
} from './phase4h-device-performance-lib.js';

const PROJECT = '26.05-2 moon';
const TRACK_NAME = 'gn-4e-plugin-parameter-proof';
const VST3_CLASS_UID = 'D39D5B69D6AF42FA123456785A334D44';
const CLAP_ID = 'com.u-he.Zebra3';
const MISSING_CLAP_ID = 'com.ghostnote.missing-plugin-4e';
const TOLERANCE = 2e-3;

interface TrackRow {
  readonly index: number;
  readonly name: string;
  readonly type: string;
  readonly channelId: string;
}

interface Selection {
  readonly trackIndex: number;
  readonly slotIndex: number;
  readonly mixerTrackIndex: number;
}

const bridge = new BridgeClient();
const timingTransport = new DeviceTimingTransport(new BridgeTransport());
const performanceRecorder = new DevicePerformanceRecorder(timingTransport);
const adapter = new LiveAdapter({ transport: timingTransport });
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
let ownedTrackId: string | undefined;
let entrySelection: Selection | undefined;
let entryTrackCount = 0;
let cleanupChainConfirmed = false;
const performanceSamples: DevicePerformanceSample[] = [];

async function tracks(): Promise<readonly TrackRow[]> {
  return ((await bridge.request('track.list')) as { readonly tracks: readonly TrackRow[] }).tracks;
}

async function resolveOwned(): Promise<TrackRow | undefined> {
  if (ownedTrackId === undefined) return undefined;
  return (await tracks()).find((row) => row.channelId === ownedTrackId);
}

async function rawChain(): Promise<readonly { readonly index: number; readonly name: string }[]> {
  const row = await resolveOwned();
  if (row === undefined) return [];
  await bridge.request('cursor.pointTrack', { cursor: '0', trackIndex: row.index });
  const pointed = await pollUntil(async () => {
    const list = await bridge.request('device.list', { cursor: '0' }) as {
      readonly trackChannelId: string;
    };
    return list.trackChannelId === ownedTrackId;
  }, 5000, 100);
  if (!pointed.ok) throw new Error('the device-bank cursor did not reach the owned track');
  return ((await bridge.request('device.list', { cursor: '0' })) as {
    readonly devices: readonly { readonly index: number; readonly name: string }[];
  }).devices;
}

async function createOwnedTrack(): Promise<void> {
  const before = await tracks();
  entryTrackCount = before.length;
  await bridge.request('track.create', { position: before.length });
  const created = await pollUntil(async () => (await tracks()).length === before.length + 1, 5000, 100);
  if (!created.ok) throw new Error('the owned scratch track did not appear');
  const known = new Set(before.map((row) => row.channelId));
  const row = (await tracks()).find((candidate) => !known.has(candidate.channelId));
  if (row === undefined) throw new Error('the created scratch track has no fresh identity');
  ownedTrackId = row.channelId;
  await bridge.request('track.setName', { trackIndex: row.index, name: TRACK_NAME });
  const renamed = await pollUntil(async () => (await resolveOwned())?.name === TRACK_NAME, 5000, 100);
  if (!renamed.ok) throw new Error('the owned scratch track name did not settle');
  const initial = await rawChain();
  if (initial.length !== 0) throw new Error(`the owned scratch chain was not empty: ${JSON.stringify(initial)}`);
}

async function readDevice(address: DeviceAddress): Promise<DeviceState | undefined> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const snapshot = await adapter.read([address]);
      const entry = snapshot.entries[addressKey(address)];
      if (entry?.value.of === 'device' && (entry.value.device.params?.length ?? 0) > 0) {
        return entry.value.device;
      }
    } catch (error) {
      lastError = error;
    }
    if (attempt < 2) await wait(300);
  }
  if (lastError !== undefined) throw lastError;
  return undefined;
}

async function readParameter(address: DeviceAddress, id: string): Promise<number | undefined> {
  const at = param(address, id);
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const snapshot = await adapter.read([at]);
      const entry = snapshot.entries[addressKey(at)];
      if (entry?.value.of === 'param') return entry.value.param.value;
    } catch (error) {
      lastError = error;
    }
    if (attempt === 0) await wait(200);
  }
  if (lastError !== undefined) throw lastError;
  return undefined;
}

async function writeParameter(address: DeviceAddress, id: string, value: number) {
  const at = param(address, id);
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await adapter.apply({ ops: [{ op: 'param.set', param: at, value }] });
    } catch (error) {
      if (attempt > 0 || !(error instanceof Error)
          || error.name !== 'AddressUnresolvedError'
          || !/parameter inventory is unstable/.test(error.message)) throw error;
      await wait(200);
    }
  }
}

function rankedParameters(params: readonly ParamState[]): readonly ParamState[] {
  const unsafe = /bypass|device on|preset|program|random|trigger|midi|panic/i;
  const preferred = /volume|gain|mix|tune|cutoff|frequency|attack|decay|sustain|release|width/i;
  return params
    .filter((candidate) => !unsafe.test(candidate.name))
    .sort((left, right) => Number(preferred.test(right.name)) - Number(preferred.test(left.name)));
}

async function proveParameter(
  format: 'VST3' | 'CLAP',
  address: DeviceAddress,
  state: DeviceState,
): Promise<{
  readonly id: string;
  readonly name: string;
  readonly before: number;
  readonly changed: number;
}> {
  for (const candidate of rankedParameters(state.params ?? []).slice(0, 10)) {
    const before = candidate.value;
    const requested = before <= 0.9 ? before + 0.05 : before - 0.05;
    const write = await writeParameter(address, candidate.id, requested);
    const landed = await readParameter(address, candidate.id);
    const changed = fullyApplied(write)
      && landed !== undefined && Math.abs(landed - requested) <= TOLERANCE;

    const restore = await writeParameter(address, candidate.id, before);
    const restored = await readParameter(address, candidate.id);
    if (!fullyApplied(restore) || restored === undefined || Math.abs(restored - before) > TOLERANCE) {
      throw new Error(`${format} parameter ${candidate.name} did not restore to ${before}; read ${restored}; `
        + `receipt ${JSON.stringify(failures(restore))}`);
    }
    if (changed) return { id: candidate.id, name: candidate.name, before, changed: landed! };
  }
  throw new Error(`${format} exposed no writable non-destructive parameter in the first ten candidates`);
}

async function cleanup(): Promise<void> {
  const row = await resolveOwned();
  if (row !== undefined && row.name === TRACK_NAME) {
    const owned = track(row.channelId);
    const chain = await adapter.devices(owned);
    for (const item of [...chain.devices].sort((left, right) => right.index - left.index)) {
      await adapter.apply({
        ops: [{ op: 'device.delete', device: device(owned, item.index), expectedName: item.name }],
      });
    }
    const restored = await rawChain();
    cleanupChainConfirmed = restored.length === 0;
    check('4e-L9: cleanup restores the exact empty scratch chain', cleanupChainConfirmed, restored);
    const current = await resolveOwned();
    if (current !== undefined) {
      await bridge.request('track.delete', { trackIndex: current.index });
      await pollUntil(async () => (await resolveOwned()) === undefined, 5000, 100);
    }
  }

  if (entrySelection !== undefined && entrySelection.trackIndex >= 0 && entrySelection.slotIndex >= 0) {
    await bridge.request('slot.select', {
      trackIndex: entrySelection.trackIndex,
      slotIndex: entrySelection.slotIndex,
      mechanism: 'track',
    });
    await wait(150);
  }
}

try {
  await bridge.connect();
  await adapter.hello();
  const revision = await adapter.revision();
  entrySelection = await bridge.request('selection.status') as Selection;
  check('4e-L1: the accepted project and extension contract are live', revision.project === PROJECT, {
    project: revision.project,
  });
  await createOwnedTrack();
  const owned = track(ownedTrackId!);

  const formats = [
    { format: 'VST3' as const, source: { from: 'vst3' as const, classUid: VST3_CLASS_UID } },
    { format: 'CLAP' as const, source: { from: 'clap' as const, id: CLAP_ID } },
  ];

  for (const [expectedPosition, target] of formats.entries()) {
    const measured = await performanceRecorder.sample(`${target.format.toLowerCase()}-complete`, async () => {
      const insertionStarted = performance.now();
      const inserted = await performanceRecorder.phase('hostInsertion', () => adapter.apply({
        ops: [{ op: 'device.insert', track: owned, source: target.source }],
      }));
      note(`${target.format} insertion phase completed`);
      const elapsedMs = performance.now() - insertionStarted;
      const minted = inserted.minted[0];
      if (minted?.kind !== 'device') {
        return { inserted, minted, elapsedMs, inventoryMs: 0, state: undefined, proof: undefined };
      }
      const inventoryStarted = performance.now();
      const state = await performanceRecorder.phase('observerStabilization', () => readDevice(minted));
      note(`${target.format} inventory phase completed with ${state?.params?.length ?? 0} parameters`);
      const inventoryMs = performance.now() - inventoryStarted;
      const proof = state === undefined ? undefined
        : await performanceRecorder.phase('verification', () => proveParameter(target.format, minted, state));
      note(`${target.format} verification and replay phase completed`);
      return { inserted, minted, elapsedMs, inventoryMs, state, proof };
    });
    performanceSamples.push(measured.sample);
    const { inserted, minted, elapsedMs, inventoryMs, state, proof } = measured.value;
    check(`4e-L${expectedPosition + 2}: ${target.format} inserts by explicit id and mints its observed position`,
      fullyApplied(inserted) && minted?.kind === 'device'
        && minted.chainIndex === expectedPosition,
      { elapsedMs, minted, failures: failures(inserted) });
    if (minted?.kind !== 'device') throw new Error(`${target.format} insertion did not mint a device`);

    check(`4e-L${expectedPosition + 4}: ${target.format} exposes more than eight named DirectParameters`,
      (state?.params?.length ?? 0) > 8
        && state!.params!.filter((candidate) => candidate.name.trim() !== '').length > 8,
      { name: state?.name, count: state?.params?.length, inventoryMs });
    if (state === undefined) throw new Error(`${target.format} device state did not settle`);

    check(`4e-L${expectedPosition + 6}: ${target.format} changes and restores one parameter`,
      proof !== undefined, proof);
    note(`${target.format} observer inventory settled in ${inventoryMs} ms; insertion took ${elapsedMs} ms`);
  }

  const beforeMissing = await rawChain();
  const missing = await adapter.apply({
    ops: [{ op: 'device.insert', track: owned, source: { from: 'clap', id: MISSING_CLAP_ID } }],
  });
  const afterMissing = await rawChain();
  check('4e-L8: a missing plugin fails visibly and does not mint a false device receipt',
    !fullyApplied(missing) && missing.minted[0] === undefined
      && failures(missing).length > 0
      && JSON.stringify(afterMissing) === JSON.stringify(beforeMissing),
    { failures: failures(missing), before: beforeMissing, after: afterMissing });
} catch (error) {
  check('4e-LX: the plugin proof completed without an unexpected failure', false,
    error instanceof Error ? `${error.name}: ${error.message}` : String(error));
} finally {
  try {
    await cleanup();
  } catch (error) {
    check('4e-L9: cleanup restores the exact empty scratch chain', false,
      error instanceof Error ? error.message : String(error));
  }
  const finalTracks = await tracks().catch(() => []);
  check('4e-L10: cleanup removes the owned track and restores the track count',
    cleanupChainConfirmed && ownedTrackId !== undefined
      && finalTracks.length === entryTrackCount
      && !finalTracks.some((row) => row.channelId === ownedTrackId),
    { entryTrackCount, finalTrackCount: finalTracks.length, ownedTrackId });
  await adapter.close();
  bridge.disconnect();
}

console.log(`\n${failureCount() === 0 ? 'ALL PASS' : `${failureCount()} FAILURE(S)`}`);
note(`Phase 4 session 4h plugin performance: ${JSON.stringify(performanceRecorder.samples, null, 2)}`);
if (failureCount() > 0) process.exitCode = 1;
