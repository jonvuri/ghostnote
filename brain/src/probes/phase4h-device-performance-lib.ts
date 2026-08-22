import type { Transport } from '../adapters/live/transport.js';
import type { Frame } from '../adapters/live/wiremap.js';

export interface DeviceRequestTiming {
  readonly method: string;
  readonly elapsedMs: number;
  readonly serverMs: number;
}

export interface DevicePhaseTiming {
  readonly phase: string;
  readonly elapsedMs: number;
}

export interface DevicePerformanceSample {
  readonly name: string;
  readonly elapsedMs: number;
  readonly serverMs: number;
  readonly bridgeMs: number;
  readonly bridgeRequests: number;
  readonly hostSettleMs: number;
  readonly phases: Readonly<Record<string, number>>;
  readonly requests: Readonly<Record<string, number>>;
  readonly dominantPhase: string;
}

const rounded = (value: number): number => Math.round(value * 10) / 10;

function sumBy<T>(values: readonly T[], key: (value: T) => string, amount: (value: T) => number) {
  const result: Record<string, number> = {};
  for (const value of values) {
    const name = key(value);
    result[name] = (result[name] ?? 0) + amount(value);
  }
  return Object.fromEntries(Object.entries(result).map(([name, value]) => [name, rounded(value)]));
}

/** Record bridge and extension time without changing the wire request. */
export class DeviceTimingTransport implements Transport {
  readonly requests: DeviceRequestTiming[] = [];

  constructor(private readonly inner: Transport) {}

  recordExternal(method: string, elapsedMs: number, result: unknown): void {
    const elapsedMicros = (result as { readonly elapsedMicros?: unknown } | undefined)?.elapsedMicros;
    this.requests.push({
      method,
      elapsedMs,
      serverMs: typeof elapsedMicros === 'number' ? elapsedMicros / 1000 : 0,
    });
  }

  async send(frame: Frame): Promise<unknown> {
    const started = performance.now();
    const result = await this.inner.send(frame);
    const elapsedMs = performance.now() - started;
    this.recordExternal(frame.method, elapsedMs, result);
    return result;
  }

  close(): Promise<void> {
    return this.inner.close();
  }
}

/** Collect non-overlapping workflow phases around a traced transport. */
export class DevicePerformanceRecorder {
  readonly phases: DevicePhaseTiming[] = [];
  readonly samples: DevicePerformanceSample[] = [];

  constructor(readonly transport: DeviceTimingTransport) {}

  record(phase: string, elapsedMs: number): void {
    this.phases.push({ phase, elapsedMs });
  }

  async phase<T>(phase: string, work: () => Promise<T>): Promise<T> {
    const started = performance.now();
    try {
      return await work();
    } finally {
      this.phases.push({ phase, elapsedMs: performance.now() - started });
    }
  }

  async sample<T>(name: string, work: () => Promise<T>): Promise<{
    readonly value: T;
    readonly sample: DevicePerformanceSample;
  }> {
    const requestStart = this.transport.requests.length;
    const phaseStart = this.phases.length;
    const started = performance.now();
    let value: T | undefined;
    let failure: unknown;
    try {
      value = await work();
    } catch (error) {
      failure = error;
    }
    const elapsedMs = performance.now() - started;
    const requests = this.transport.requests.slice(requestStart);
    const phases = this.phases.slice(phaseStart);
    const phaseTotals = sumBy(phases, (event) => event.phase, (event) => event.elapsedMs);
    const requestTotals = sumBy(requests, (event) => event.method, () => 1);
    const serverMs = requests.reduce((sum, event) => sum + event.serverMs, 0);
    const bridgeMs = requests.reduce((sum, event) => sum + Math.max(0, event.elapsedMs - event.serverMs), 0);
    const namedMs = Object.values(phaseTotals).reduce((sum, amount) => sum + amount, 0);
    const completePhases = {
      ...phaseTotals,
      checkpointRecording: rounded(Math.max(0, elapsedMs - namedMs)),
    };
    const dominantPhase = Object.entries(completePhases)
      .sort((left, right) => right[1] - left[1])[0]?.[0] ?? 'checkpointRecording';
    const sample: DevicePerformanceSample = {
        name,
        elapsedMs: rounded(elapsedMs),
        serverMs: rounded(serverMs),
        bridgeMs: rounded(bridgeMs),
        bridgeRequests: requests.length,
        hostSettleMs: rounded(Math.max(0, elapsedMs - serverMs - bridgeMs)),
        phases: completePhases,
        requests: requestTotals,
        dominantPhase,
      };
    this.samples.push(sample);
    if (failure !== undefined) throw failure;
    return { value: value!, sample };
  }
}
