/** Live selection and foreground-stability proof for one supported wrapper. */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { LiveAdapter, type LiveTraceEvent } from '../adapters/live/adapter.js';
import { BridgeTransport, type Transport } from '../adapters/live/transport.js';
import { WIRE, type Frame } from '../adapters/live/wiremap.js';
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

const runFile = promisify(execFile);
const FRONTMOST_SCRIPT = 'tell application "System Events" to get name of first application process whose frontmost is true';
const BITWIG_APPLICATION = 'Bitwig Studio';
const BITWIG_PROCESS = 'BitwigStudio';

interface TraceEvent {
  readonly sequence: number;
  readonly atMs: number;
  readonly kind: 'wire' | 'adapter' | 'frontmost' | 'stage';
  readonly name: string;
  readonly target?: string;
  readonly precedingWire?: string;
}

class OrderedTrace {
  readonly events: TraceEvent[] = [];
  private sequence = 0;
  private started = performance.now();

  add(kind: TraceEvent['kind'], name: string, target?: string): void {
    this.events.push({
      sequence: ++this.sequence,
      atMs: Math.round(performance.now() - this.started),
      kind,
      name,
      ...(target === undefined ? {} : { target }),
      ...(kind === 'frontmost' ? { precedingWire: this.lastWire() } : {}),
    });
  }

  reset(): void {
    this.events.length = 0;
    this.sequence = 0;
    this.started = performance.now();
  }

  private lastWire(): string | undefined {
    return [...this.events].reverse().find((event) => event.kind === 'wire')?.name;
  }
}

class TraceTransport implements Transport {
  constructor(private readonly inner: Transport, private readonly trace: OrderedTrace) {}

  async send(frame: Frame): Promise<unknown> {
    this.trace.add('wire', frame.method);
    if (frame.method === WIRE.batchRun) {
      const ops = frame.params?.['ops'];
      if (Array.isArray(ops)) {
        for (const op of ops) {
          const method = (op as { method?: unknown }).method;
          if (typeof method === 'string') this.trace.add('wire', method);
        }
      }
    }
    return this.inner.send(frame);
  }

  close(): Promise<void> {
    return this.inner.close();
  }
}

class FrontmostMonitor {
  private running = false;
  private loop: Promise<void> | undefined;
  private last: string | undefined;

  constructor(private readonly trace: OrderedTrace) {}

  async current(): Promise<string> {
    const result = await runFile('/usr/bin/osascript', ['-e', FRONTMOST_SCRIPT], { timeout: 3000 });
    return result.stdout.trim();
  }

  async activate(application: string, processName = application): Promise<void> {
    const escaped = application.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
    await runFile('/usr/bin/osascript', [
      '-e', `tell application "${escaped}" to activate`,
    ], { timeout: 3000 });
    const started = Date.now();
    while (Date.now() - started < 4000) {
      if (await this.current() === processName) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`${application} did not become frontmost`);
  }

  async waitUntilBackgrounded(application: string, timeoutMs = 60_000): Promise<string> {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const current = await this.current();
      if (current !== application) return current;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`${application} stayed frontmost for ${timeoutMs} ms`);
  }

  async start(): Promise<string> {
    const initial = await this.current();
    this.last = initial;
    this.trace.add('frontmost', initial);
    this.running = true;
    this.loop = this.sampleLoop();
    return initial;
  }

  async stop(): Promise<void> {
    this.running = false;
    await this.loop;
  }

  private async sampleLoop(): Promise<void> {
    while (this.running) {
      try {
        const current = await this.current();
        if (current !== this.last) {
          this.last = current;
          this.trace.add('frontmost', current);
        }
      } catch (error) {
        this.trace.add('frontmost', `monitor error: ${error instanceof Error ? error.message : String(error)}`);
        this.running = false;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}

interface WrapperResult {
  readonly complete?: boolean;
  readonly verification?: {
    readonly pages?: { readonly verified?: boolean };
    readonly behaviors?: readonly { readonly verified?: boolean }[];
  };
  readonly reversalCheckpoint?: unknown;
}

interface ScalarResult {
  readonly verified?: boolean;
  readonly changes?: readonly { readonly changeId?: string }[];
}

interface SelectionStatus {
  readonly trackIndex: number;
  readonly slotIndex: number;
  readonly mixerTrackIndex?: number;
  readonly revision?: number;
}

function sameTracks(left: readonly TrackState[], right: readonly TrackState[]): boolean {
  return JSON.stringify(left.map((item) => [item.channelId, item.name, item.position, item.type]))
    === JSON.stringify(right.map((item) => [item.channelId, item.name, item.position, item.type]));
}

async function findTopLevelColourCopy(adapter: LiveAdapter): Promise<{
  readonly address: DeviceAddress;
  readonly owner: TrackAddress;
  readonly order: readonly { readonly name: string; readonly enabled: boolean }[];
}> {
  for (const row of await adapter.tracks()) {
    const owner = track(row.channelId);
    const bank = await adapter.devices(owner);
    const found = bank.devices.find((item) => item.name === 'ColourCopy');
    if (found !== undefined) {
      return {
        address: device(owner, found.index),
        owner,
        order: bank.devices.map((item) => ({ name: item.name, enabled: item.enabled as boolean })),
      };
    }
  }
  throw new Error('no top-level ColourCopy device was found');
}

async function findNativeScalarControl(
  adapter: LiveAdapter,
  tracks: readonly TrackState[],
): Promise<{
  readonly owner: TrackAddress;
  readonly address: DeviceAddress;
  readonly parameter: { readonly id: string; readonly name: string; readonly value: number };
  readonly page: { readonly index: number; readonly name: string };
  readonly control: {
    readonly index: number;
    readonly name: string;
    readonly value: number;
    readonly discreteValueCount?: number;
  };
}> {
  for (const row of tracks) {
    const owner = track(row.channelId);
    const bank = await adapter.devices(owner);
    const found = bank.devices.find((item) => item.name === 'Tool');
    if (found === undefined) continue;
    const address = device(owner, found.index);
    const remoteAddress = remotes(address);
    const snapshot = await adapter.read([address, remoteAddress]);
    const directValue = snapshot.entries[addressKey(address)]?.value;
    const remoteValue = snapshot.entries[addressKey(remoteAddress)]?.value;
    const parameters = directValue?.of === 'device' ? directValue.device.params ?? [] : [];
    const pages = remoteValue?.of === 'remotes' ? remoteValue.remotes.pages : [];
    for (const parameter of parameters) {
      for (const page of pages) {
        const control = page.controls.find((item) => item.name === parameter.name);
        if (control !== undefined) return { owner, address, parameter, page, control };
      }
    }
  }
  throw new Error('no native Tool device exposed one exact direct-to-remote match');
}

function count(events: readonly TraceEvent[], kind: TraceEvent['kind'], name: string): number {
  return events.filter((event) => event.kind === kind && event.name === name).length;
}

function alternateNormalized(value: number, discreteValueCount?: number): number {
  if (discreteValueCount !== undefined && discreteValueCount > 1) {
    const values = Array.from(
      { length: discreteValueCount },
      (_, index) => index / (discreteValueCount - 1),
    );
    return values.find((candidate) => Math.abs(candidate - value) > 1e-6) ?? value;
  }
  return value <= 0.75 ? value + 0.125 : value - 0.125;
}

const trace = new OrderedTrace();
const transport = new TraceTransport(new BridgeTransport(client), trace);
const adapter = new LiveAdapter({
  transport,
  onTrace: (event: LiveTraceEvent) => trace.add('adapter', event.action, event.target),
});
const monitor = new FrontmostMonitor(trace);
const keepAlive = setInterval(() => undefined, 1000);
let entryTracks: readonly TrackState[] = [];
let sourceOwner: TrackAddress | undefined;
let entryOrder: readonly { readonly name: string; readonly enabled: boolean }[] = [];
let pending: { readonly workspace: Workspace; readonly result: WrapperResult } | undefined;
let cleanupWorkspace: Workspace | undefined;
const pendingScalarChanges: string[] = [];
let frontmostControlEvents: readonly TraceEvent[] = [];
let backgroundControlEvents: readonly TraceEvent[] = [];
let selectionComparison: Record<string, number> | undefined;

try {
  await client.connect();
  const hello = await adapter.hello();
  note(`Bitwig ${hello.host?.version ?? 'unknown'}; contract ${hello.contractVersion}`);
  entryTracks = await adapter.tracks();
  const source = await findTopLevelColourCopy(adapter);
  const scalar = await findNativeScalarControl(adapter, entryTracks);
  sourceOwner = source.owner;
  entryOrder = source.order;

  const direct = await adapter.read([source.address]);
  const directValue = direct.entries[addressKey(source.address)]?.value;
  const params = directValue?.of === 'device' ? directValue.device.params ?? [] : [];
  const remoteAddress = remotes(source.address);
  const remoteSnapshot = await adapter.read([remoteAddress]);
  const remoteValue = remoteSnapshot.entries[addressKey(remoteAddress)]?.value;
  const remoteControls = remoteValue?.of === 'remotes'
    ? remoteValue.remotes.pages.flatMap((page) =>
      page.controls.map((control) => ({ page, control })))
    : [];
  const target = params.find((item) =>
    item.name.trim() !== '' && remoteControls.some(({ control }) => control.name === item.name));
  if (target === undefined) throw new Error('ColourCopy exposed no exact DirectParameter-to-remote match');
  const remoteTarget = remoteControls.find(({ control }) => control.name === target.name);
  if (remoteTarget === undefined) throw new Error('the exact remote-control match disappeared');

  const workspace = workspaceOf({
    ready: async () => undefined,
    adapter,
    executor: new Executor(adapter),
    stash: new Stash(),
    observationStore: new FakeObservationStore(),
  });
  cleanupWorkspace = workspace;

  const selectionStatus = async (): Promise<SelectionStatus> =>
    client.request(WIRE.selectionStatus) as Promise<SelectionStatus>;
  const revisionDelta = (before: SelectionStatus, after: SelectionStatus): number =>
    typeof before.revision === 'number' && typeof after.revision === 'number'
      ? after.revision - before.revision : -1;
  const revertScalar = async (changeId: string): Promise<void> => {
    const reversed = await callTool(workspace, 'revert_change', { changeId }) as {
      readonly applied?: boolean;
    };
    if (reversed.applied !== true) {
      throw new Error(`scalar reversal failed: ${JSON.stringify(reversed)}`);
    }
    const at = pendingScalarChanges.indexOf(changeId);
    if (at >= 0) pendingScalarChanges.splice(at, 1);
  };
  const setAndReverse = async (
    label: string,
    setting: Record<string, unknown>,
  ): Promise<void> => {
    trace.add('stage', label);
    const result = await adapter.preserveSelection(() =>
      callTool(workspace, 'set_parameter', {
        settings: [setting],
      })) as ScalarResult;
    const changes = (result.changes ?? []).flatMap((change) => change.changeId ?? []);
    pendingScalarChanges.push(...changes);
    check(`${label}: the scalar write verifies`,
      result.verified === true && changes.length === 1, result);
    if (result.verified !== true || changes.length !== 1) {
      throw new Error(`${label} did not return one verified change`);
    }
    check(`${label}: the write leaves Bitwig backgrounded`,
      await monitor.current() !== BITWIG_PROCESS);
    await adapter.preserveSelection(() => revertScalar(changes[0]!));
    check(`${label}: the reversal leaves Bitwig backgrounded`,
      await monitor.current() !== BITWIG_PROCESS);
  };

  const backgroundApplication = await monitor.current();
  trace.reset();
  await monitor.activate(BITWIG_APPLICATION, BITWIG_PROCESS);
  const selected = await selectionStatus();
  if (selected.trackIndex < 0 || selected.slotIndex < 0
      || typeof selected.revision !== 'number') {
    throw new Error(
      'select one visible launcher slot and reload the current extension before this probe',
    );
  }
  const selectedTrackIndex = selected.mixerTrackIndex ?? selected.trackIndex;
  const control = await adapter.preserveSelection(async () => {
    for (const row of entryTracks) {
      if (row.position === selectedTrackIndex) continue;
      const owner = track(row.channelId);
      const bank = await adapter.devices(owner);
      const first = bank.devices[0];
      if (first !== undefined) {
        const address = device(owner, first.index);
        return { owner, address, remoteAddress: remotes(address) };
      }
    }
    throw new Error('no device on a track outside the current selection was found');
  });
  const runReadControl = async (): Promise<void> => {
    await adapter.devices(control.owner);
    await adapter.read([control.address]);
    await adapter.read([control.remoteAddress]);
  };
  const frontSelectionBefore = await selectionStatus();
  trace.add('stage', 'frontmost-read-control');
  await runReadControl();
  await runReadControl();
  await new Promise((resolve) => setTimeout(resolve, 200));
  const frontSelectionAfter = await selectionStatus();
  check('5w-control: the frontmost read control leaves Bitwig frontmost',
    await monitor.current() === BITWIG_PROCESS);
  frontmostControlEvents = [...trace.events];

  const requestedBackground = backgroundApplication === BITWIG_PROCESS ? 'Finder' : backgroundApplication;
  try {
    await monitor.activate(requestedBackground);
  } catch {
    note('ACTION: switch from Bitwig to another application within 60 seconds.');
    await monitor.waitUntilBackgrounded(BITWIG_PROCESS);
  }
  trace.reset();
  const initialFrontmost = await monitor.start();
  check('5w-control: Bitwig is backgrounded before the wrapper starts', initialFrontmost !== BITWIG_PROCESS, {
    initialFrontmost,
  });

  const backgroundSelectionBefore = await selectionStatus();
  const backgroundControlStart = trace.events.length;
  trace.add('stage', 'background-read-control-1');
  await adapter.preserveSelection(runReadControl);
  trace.add('stage', 'background-read-control-2');
  await adapter.preserveSelection(runReadControl);
  backgroundControlEvents = trace.events.slice(backgroundControlStart);
  await new Promise((resolve) => setTimeout(resolve, 200));
  const backgroundSelectionAfter = await selectionStatus();
  const frontPoints = count(frontmostControlEvents, 'wire', WIRE.cursorPointTrack);
  const backgroundPoints = count(backgroundControlEvents, 'wire', WIRE.cursorPointTrack);
  const frontSelectionEvents = revisionDelta(frontSelectionBefore, frontSelectionAfter);
  const backgroundSelectionEvents = revisionDelta(
    backgroundSelectionBefore, backgroundSelectionAfter);
  selectionComparison = {
    frontPoints,
    backgroundPoints,
    frontSelectionEvents,
    backgroundSelectionEvents,
  };
  check('5w-control: repeated scoped reads reduce points and observed selection events',
    backgroundPoints < frontPoints
      && frontSelectionEvents >= 0
      && backgroundSelectionEvents >= 0
      && backgroundSelectionEvents < frontSelectionEvents,
    selectionComparison);
  check('5w-control: both background read controls stay backgrounded',
    await monitor.current() !== BITWIG_PROCESS);

  await setAndReverse('background-direct-scalar', {
    kind: 'direct',
    device: {
      trackId: scalar.owner.channelId,
      devicePosition: scalar.address.chainIndex,
    },
    parameterId: scalar.parameter.id,
    normalizedValue: alternateNormalized(scalar.parameter.value),
  });
  await setAndReverse('background-remote-scalar', {
    kind: 'remote',
    device: {
      trackId: scalar.owner.channelId,
      devicePosition: scalar.address.chainIndex,
    },
    pagePosition: scalar.page.index,
    pageName: scalar.page.name,
    controlPosition: scalar.control.index,
    controlName: scalar.control.name,
    normalizedValue: alternateNormalized(
      scalar.control.value,
      scalar.control.discreteValueCount,
    ),
  });

  trace.add('stage', 'wrap');
  const result = await callTool(workspace, 'wrap_existing_device_modulation', {
    trackId: source.owner.channelId,
    devicePosition: source.address.chainIndex,
    expectedDeviceOrder: source.order,
    containerKind: 'FX Layer',
    entryName: 'Layer 1',
    modulators: [{
      modulator: 'lfo',
      target: { parameterId: target.id, parameterName: target.name },
      amount: 0.25,
    }],
  }) as WrapperResult;
  pending = { workspace, result };
  check('5w-wrapper: write, page verification, and behavior verification pass',
    result.complete === true
      && result.verification?.pages?.verified === true
      && result.verification.behaviors?.length === 1
      && result.verification.behaviors[0]?.verified === true,
    result);
  check('5w-wrapper: the complete wrapper leaves Bitwig backgrounded',
    await monitor.current() !== BITWIG_PROCESS);

  trace.add('stage', 'reversal');
  if (result.reversalCheckpoint === undefined) throw new Error('the wrapper returned no reversal checkpoint');
  const reversed = await callTool(workspace, 'reverse_existing_device_modulation_wrap', {
    checkpoint: result.reversalCheckpoint,
  }) as { readonly complete?: boolean; readonly restoredDeviceOrder?: boolean };
  pending = undefined;
  check('5w-reversal: the complete wrapper reverses exactly',
    reversed.complete === true && reversed.restoredDeviceOrder === true, reversed);
  check('5w-reversal: the complete reversal leaves Bitwig backgrounded',
    await monitor.current() !== BITWIG_PROCESS);

  await monitor.stop();
  const activations = trace.events.filter((event) =>
    event.kind === 'frontmost' && event.name === BITWIG_PROCESS);
  check('5w-background: no method brings Bitwig to the foreground', activations.length === 0, activations);
  check('5w-background: the complete write and reversal leave Bitwig backgrounded',
    await monitor.current() !== BITWIG_PROCESS);

  const methodMatrix = [
    WIRE.cursorPointTrack,
    WIRE.slotSelect,
    WIRE.deviceCursorSelectAt,
    WIRE.deviceCursorSelectInLayer,
    WIRE.deviceCursorSelectFirstInSlot,
    WIRE.deviceCursorSelectInSlot,
    WIRE.deviceCursorSelectParent,
    WIRE.chainInventory,
    WIRE.directParamList,
    WIRE.directParamSet,
    WIRE.remoteList,
    WIRE.remoteSet,
    WIRE.deviceMoveTo,
    WIRE.chainMove,
  ].map((method) => ({
    method,
    frontmostControlCalls: count(frontmostControlEvents, 'wire', method),
    backgroundCalls: count(trace.events, 'wire', method),
    foregroundTransitions: activations.filter((event) => event.precedingWire === method).length,
  }));
  check('5w-matrix: direct and remote scalar methods run in the background control',
    count(trace.events, 'wire', WIRE.directParamSet) > 0
      && count(trace.events, 'wire', WIRE.remoteSet) > 0,
    methodMatrix);
  const points = count(trace.events, 'wire', WIRE.cursorPointTrack);
  const reusedPoints = count(trace.events, 'adapter', 'track-reuse');
  const reusedDevices = count(trace.events, 'adapter', 'device-reuse');
  check('5w-reuse: confirmed targets avoid repeated cursor points',
    reusedPoints > 0 && reusedDevices > 0,
    { points, reusedPoints, reusedDevices });
  note(`selection trace ${JSON.stringify({
    actualCursorPoints: points,
    cursorPointsWithoutReuse: points + reusedPoints,
    avoidedCursorPoints: reusedPoints,
    reusedDeviceTargets: reusedDevices,
    restores: count(trace.events, 'adapter', 'selection-restore'),
    suppressedRestoreWrites: count(trace.events, 'adapter', 'selection-restore-skipped'),
    controlComparison: selectionComparison,
  })}`);
  note(`foreground matrix ${JSON.stringify(methodMatrix)}`);
  note(`frontmost transitions ${JSON.stringify(trace.events.filter((event) => event.kind === 'frontmost'))}`);
} catch (error) {
  check('5w-LX: the live proof completed without an unexpected failure', false,
    error instanceof Error ? `${error.name}: ${error.message}` : String(error));
} finally {
  await monitor.stop().catch(() => undefined);
  if (cleanupWorkspace !== undefined) {
    for (const changeId of [...pendingScalarChanges].reverse()) {
      try {
        const reversed = await callTool(cleanupWorkspace, 'revert_change', { changeId }) as {
          readonly applied?: boolean;
        };
        if (reversed.applied !== true) throw new Error(JSON.stringify(reversed));
        const at = pendingScalarChanges.indexOf(changeId);
        if (at >= 0) pendingScalarChanges.splice(at, 1);
      } catch (error) {
        check('5w-cleanup: scalar ' + changeId + ' reversed', false,
          error instanceof Error ? error.message : String(error));
      }
    }
  }
  if (pending !== undefined) {
    try {
      if (pending.result.reversalCheckpoint !== undefined) {
        await callTool(pending.workspace, 'reverse_existing_device_modulation_wrap', {
          checkpoint: pending.result.reversalCheckpoint,
        });
      }
      pending = undefined;
    } catch (error) {
      check('5w-cleanup: the pending wrapper was reversed', false,
        error instanceof Error ? error.message : String(error));
    }
  }
  if (sourceOwner !== undefined) {
    try {
      const finalOrder = (await adapter.devices(sourceOwner)).devices.map((item) => ({
        name: item.name, enabled: item.enabled as boolean,
      }));
      check('5w-cleanup: the exact source device order is restored',
        JSON.stringify(finalOrder) === JSON.stringify(entryOrder), { entryOrder, finalOrder });
    } catch (error) {
      check('5w-cleanup: the exact source device order is restored', false,
        error instanceof Error ? error.message : String(error));
    }
  }
  try {
    const finalTracks = await adapter.tracks();
    check('5w-cleanup: the exact entry track list is restored', sameTracks(finalTracks, entryTracks), {
      entry: entryTracks, final: finalTracks,
    });
  } catch (error) {
    check('5w-cleanup: the exact entry track list is restored', false,
      error instanceof Error ? error.message : String(error));
  }
  await adapter.close();
  clearInterval(keepAlive);
}

console.log(failureCount() === 0 ? '\nPhase 5w: ALL PASS' : `\nPhase 5w: ${failureCount()} FAILURE(S)`);
process.exit(failureCount() === 0 ? 0 : 1);
