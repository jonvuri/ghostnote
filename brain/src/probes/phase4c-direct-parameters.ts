/** Phase 4 session 4c: prove the DirectParameter core against the accepted project. */
import { LiveAdapter } from '../adapters/live/adapter.js';
import { BridgeTransport, type Transport } from '../adapters/live/transport.js';
import type { Frame } from '../adapters/live/wiremap.js';
import { addressKey, device, fullyApplied, param, track } from '../contract/index.js';
import type { DeviceState, ParamState, TrackState } from '../contract/index.js';
import { check, failureCount, note } from './lib.js';
import {
  DevicePerformanceRecorder, DeviceTimingTransport, type DevicePerformanceSample,
} from './phase4h-device-performance-lib.js';

const PROJECT = '26.05-2 moon';
const TOLERANCE = 2e-3;

class TraceTransport implements Transport {
  readonly trace: unknown[] = [];
  private readonly inner = new BridgeTransport();

  async send(frame: Frame): Promise<unknown> {
    const result = await this.inner.send(frame);
    if (frame.method === 'directparam.list' || frame.method === 'devcursor.status') {
      const row = result as Record<string, unknown>;
      this.trace.push({ method: frame.method, request: frame.params, result: {
        count: row['count'], generation: row['generation'], idsGeneration: row['idsGeneration'],
        deviceExists: row['deviceExists'] ?? row['exists'], deviceName: row['deviceName'] ?? row['name'],
        deviceIndex: row['deviceIndex'], trackChannelId: row['trackChannelId'],
        trackPosition: row['trackPosition'], observedTrackChannelId: row['observedTrackChannelId'],
        observedDeviceName: row['observedDeviceName'], observedDeviceIndex: row['observedDeviceIndex'],
      } });
    }
    return result;
  }

  close(): Promise<void> {
    return this.inner.close();
  }
}

const transport = new TraceTransport();
const timingTransport = new DeviceTimingTransport(transport);
const performanceRecorder = new DevicePerformanceRecorder(timingTransport);
const adapter = new LiveAdapter({
  transport: timingTransport,
  onTiming: (event) => performanceRecorder.record(event.phase, event.elapsedMs),
});
let target:
  | { readonly device: ReturnType<typeof device>; readonly state: DeviceState; readonly track: TrackState }
  | undefined;
let parameter: ParamState | undefined;
let captured: number | undefined;
const performanceSamples: DevicePerformanceSample[] = [];

const readParameter = async (): Promise<number | undefined> => {
  if (target === undefined || parameter === undefined) return undefined;
  const address = param(target.device, parameter.id);
  const snapshot = await adapter.read([address]);
  const entry = snapshot.entries[addressKey(address)];
  return entry?.value.of === 'param' ? entry.value.param.value : undefined;
};

try {
  const info = await adapter.hello();
  const revision = await adapter.revision();
  check('4c-L1: the accepted project and contract are live',
    revision.project === PROJECT,
    { project: revision.project, contract: info.contract, extension: info.host?.extensionVersion });

  const enumeration = await performanceRecorder.sample('native-enumeration', () =>
    performanceRecorder.phase('observerStabilization', async () => {
      const tracks = await adapter.tracks();
      const candidates: { readonly address: ReturnType<typeof device>; readonly track: TrackState;
        readonly name: string }[] = [];
      for (const row of tracks) {
        const bank = await adapter.devices(track(row.channelId));
        for (const observed of bank.devices) {
          candidates.push({
            address: device(track(row.channelId), observed.index),
            track: row,
            name: observed.name,
          });
        }
      }
      candidates.sort((left, right) =>
        Number(right.name === 'Sampler') - Number(left.name === 'Sampler'));
      for (const candidate of candidates) {
        const snapshot = await adapter.read([candidate.address]);
        const entry = snapshot.entries[addressKey(candidate.address)];
        const state = entry?.value.of === 'device' ? entry.value.device : undefined;
        if ((state?.params?.length ?? 0) > 8) {
          target = { device: candidate.address, state: state!, track: candidate.track };
          break;
        }
      }
      return tracks.length;
    }));
  performanceSamples.push(enumeration.sample);
  const trackCount = enumeration.value;

  check('4c-L2: one top-level device exposes more than eight direct parameters',
    target !== undefined,
    target === undefined ? { tracks: trackCount, trace: transport.trace.slice(-12) } : {
      track: target.track.name,
      device: target.state.name,
      params: target.state.params?.length,
    });
  if (target === undefined) throw new Error('no top-level device has a stable parameter inventory');

  parameter = target.state.params?.find((candidate) =>
    !/device on|bypass|preset|volume/i.test(candidate.name));
  if (parameter === undefined) throw new Error('the stable inventory has no safe scalar parameter');
  captured = parameter.value;
  const requested = captured <= 0.9 ? captured + 0.05 : captured - 0.05;
  const address = param(target.device, parameter.id);
  note(`target ${target.track.name} / ${target.state.name} / ${parameter.name}`);
  note(`captured ${captured}; requested ${requested}`);

  const writeSample = await performanceRecorder.sample('native-write-readback-replay', () =>
    performanceRecorder.phase('verification', async () => {
      const write = await adapter.apply({ ops: [{ op: 'param.set', param: address, value: requested }] });
      const landed = await readParameter();
      const reversal = await adapter.apply({
        ops: [{ op: 'param.set', param: address, value: captured! }],
      });
      const restored = await readParameter();
      return { write, landed, reversal, restored };
    }));
  performanceSamples.push(writeSample.sample);
  const { write, landed, reversal, restored } = writeSample.value;
  check('4c-L3: a normalized write lands and independent readback agrees',
    fullyApplied(write) && landed !== undefined && Math.abs(landed - requested) <= TOLERANCE,
    { receipt: write.stages.flatMap((stage) => stage.ops), requested, landed });

  check('4c-L4: exact replay restores the captured base value',
    fullyApplied(reversal) && restored !== undefined && Math.abs(restored - captured) <= TOLERANCE,
    { receipt: reversal.stages.flatMap((stage) => stage.ops), captured, restored });
  captured = undefined;
} catch (error) {
  check('4c-LX: the direct-parameter proof completed without an unexpected failure', false,
    error instanceof Error ? `${error.name}: ${error.message}` : String(error));
} finally {
  if (captured !== undefined && target !== undefined && parameter !== undefined) {
    try {
      const address = param(target.device, parameter.id);
      await adapter.apply({ ops: [{ op: 'param.set', param: address, value: captured }] });
      const restored = await readParameter();
      check('4c-L5: failure cleanup restores the captured base value',
        restored !== undefined && Math.abs(restored - captured) <= TOLERANCE,
        { captured, restored });
    } catch (error) {
      check('4c-L5: failure cleanup restores the captured base value', false,
        error instanceof Error ? error.message : String(error));
    }
  }
  await adapter.close();
}

console.log(`\n${failureCount() === 0 ? 'ALL PASS' : `${failureCount()} FAILURE(S)`}`);
note(`Phase 4 session 4h native performance: ${JSON.stringify(performanceSamples, null, 2)}`);
if (failureCount() > 0) process.exitCode = 1;
