/** E139: cache scale, mutation, and degradation measurements. */
import { appendFile, readFile, unlink, writeFile } from 'node:fs/promises';

import { BridgeClient } from '../client.js';
import { check, failureCount, pollUntil } from './lib.js';

const PROFILE = 'phase-8-probe-v1';
const METHOD_COUNT = 96;
const STATE_FILE = '/tmp/ghostnote-e139-scale-state.json';
const RESULT_FILE = '/tmp/ghostnote-e139-scale-results.jsonl';
const LAYOUT_PREFIX = 'gn-e139-layout-';
const FIXTURE_NAME = 'gn-e139-scale-fixtures';
const TRACKS = 32;
const SCENES = 32;
const OCCUPIED_ROWS = 24;
const PIPELINE_COUNTS = [64, 128, 256, 384, 512, 640, 768] as const;
const GRID = 1 / 512;
const WRITER = '0';
const READER = 'fine';

interface TrackRow {
  readonly index: number;
  readonly name: string;
  readonly type: string;
  readonly channelId: string;
}

interface Selection {
  readonly trackIndex: number;
  readonly slotIndex: number;
  readonly mixerTrackIndex?: number;
}

interface CursorState {
  readonly trackExists: boolean;
  readonly trackPosition: number;
  readonly slotExists: boolean;
  readonly sceneIndex: number;
}

interface ProbeState {
  readonly baselineTrackIds: readonly string[];
  readonly baselineScenes: number;
  readonly baselineSelection: Selection;
  readonly baselineCursors: Readonly<Record<string, CursorState>>;
  readonly ownedTrackIds: readonly string[];
}

interface ScaleSummary {
  readonly views: number;
  readonly callbacks: number;
  readonly rejectedCallbacks: number;
  readonly duplicateDirty: number;
  readonly occupiedCoordinates: number;
  readonly pendingDirty: number;
  readonly maxDirty: number;
  readonly estimatedRecorderBytes: number;
  readonly boundViews: number;
  readonly reconcileMicros?: number;
  readonly reconciledCoordinates?: number;
  readonly noteCount?: number;
  readonly getStepCalls?: number;
  readonly stable?: boolean;
}

interface ScaleAddress {
  readonly trackIndex: number;
  readonly row: number;
}

interface ScaleStatus {
  readonly trackPosition: number;
  readonly sceneIndex: number;
  readonly trackPinned: boolean;
  readonly clipPinned: boolean;
}

interface PipelineCountMeasurement {
  readonly count: number;
  readonly trial: number;
  readonly resetBindMs: number;
  readonly resetDrainMs: number;
  readonly bindMs: number;
  readonly bindMsPerObserver: number;
  readonly drainMs: number;
  readonly reconcileMs: number;
  readonly totalReplayMs: number;
  readonly totalReplayMsPerObserver: number;
  readonly ping: {
    readonly medianMs: number;
    readonly p95Ms: number;
    readonly maxMs: number;
  };
  readonly reconciled: ScaleSummary;
  readonly authority: readonly {
    readonly index: number;
    readonly count: number;
    readonly totalMs: number;
    readonly scanMs: number;
  }[];
}

const client = new BridgeClient();
const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

async function request<T>(method: string, params?: Record<string, unknown>): Promise<T> {
  return await client.request(method, params) as T;
}

async function scale<T>(operation: string, params: Record<string, unknown> = {}): Promise<T> {
  return await request<T>('cache.scale', { operation, ...params });
}

async function tracks(): Promise<readonly TrackRow[]> {
  return (await request<{ readonly tracks: readonly TrackRow[] }>('track.list')).tracks;
}

async function scenes(): Promise<number> {
  return (await request<{ readonly sceneCount: number }>('scene.count')).sceneCount;
}

async function selection(): Promise<Selection> {
  return await request<Selection>('selection.status');
}

async function cursorState(cursor: string): Promise<CursorState> {
  return await request<CursorState>('cursor.status', { cursor });
}

async function resolve(channelId: string): Promise<TrackRow | undefined> {
  const result = await request<{
    readonly found: boolean;
    readonly index?: number;
    readonly name?: string;
    readonly type?: string;
  }>('track.resolveByChannelId', { channelId });
  return result.found && result.index !== undefined
    ? { index: result.index, channelId, name: result.name ?? '', type: result.type ?? '' }
    : undefined;
}

async function createTrack(name: string): Promise<TrackRow> {
  const before = await tracks();
  await request('track.create', { position: before.length });
  const prior = new Set(before.map((track) => track.channelId));
  const appeared = await pollUntil(async () => (await tracks()).some((track) => !prior.has(track.channelId)));
  if (!appeared.ok) throw new Error(`track ${name} did not appear`);
  const created = (await tracks()).filter((track) => !prior.has(track.channelId));
  if (created.length !== 1) throw new Error(`track ${name} identity is ambiguous`);
  await request('track.setName', { trackIndex: created[0]!.index, name });
  const renamed = await pollUntil(async () => (await resolve(created[0]!.channelId))?.name === name);
  if (!renamed.ok) throw new Error(`track ${name} did not rename`);
  return (await resolve(created[0]!.channelId))!;
}

async function slotHasContent(trackIndex: number, row: number): Promise<boolean> {
  return (await request<{ readonly hasContent: boolean }>('slot.status', {
    trackIndex, slotIndex: row,
  })).hasContent;
}

async function createClip(trackIndex: number, row: number, lengthBeats = 4): Promise<void> {
  await request('clip.create', { trackIndex, slotIndex: row, lengthBeats });
  const ready = await pollUntil(() => slotHasContent(trackIndex, row));
  if (!ready.ok) throw new Error(`clip ${trackIndex}:${row} did not appear`);
}

async function point(cursor: string, trackIndex: number, row: number): Promise<void> {
  await request('cursor.pin', { cursor, pinned: false });
  await request('cursor.pinTrack', { cursor, pinned: false });
  await request('cursor.pointTrack', { cursor, trackIndex });
  await request('slot.select', { trackIndex, slotIndex: row, mechanism: 'track' });
  const ready = await pollUntil(async () => {
    const status = await cursorState(cursor);
    return status.trackExists && status.slotExists
      && status.trackPosition === trackIndex && status.sceneIndex === row;
  });
  if (!ready.ok) throw new Error(`cursor ${cursor} did not reach ${trackIndex}:${row}`);
  await request('cursor.pin', { cursor, pinned: true });
  await request('cursor.pinTrack', { cursor, pinned: true });
}

async function writeOneNote(trackIndex: number, row: number, x: number, y: number): Promise<void> {
  await point(WRITER, trackIndex, row);
  await request('cursor.setStepSize', { cursor: WRITER, stepSize: GRID });
  await request('cursor.setNotes', { cursor: WRITER, channel: 0, notes: [[x, y, 100, GRID]] });
}

async function duplicateRows(trackIndex: number): Promise<void> {
  for (let row = 0; row < OCCUPIED_ROWS - 1; row += 1) {
    await request('slot.duplicateClip', { trackIndex, slotIndex: row, route: 'slot' });
    const copied = await pollUntil(() => slotHasContent(trackIndex, row + 1));
    if (!copied.ok) throw new Error(`duplicate did not reach ${trackIndex}:${row + 1}`);
  }
}

async function writeCoordinateFixture(
  trackIndex: number, row: number, count: number,
): Promise<void> {
  if (count === 0) return;
  await point(WRITER, trackIndex, row);
  await request('cursor.setStepSize', { cursor: WRITER, stepSize: GRID });
  const byChannel = new Map<number, [number, number, number, number][]>();
  for (let coordinate = 0; coordinate < count; coordinate += 1) {
    const channel = coordinate % 16;
    const items = byChannel.get(channel) ?? [];
    items.push([
      Math.floor(coordinate / 128),
      coordinate % 128,
      72 + coordinate % 48,
      GRID,
    ]);
    byChannel.set(channel, items);
  }
  for (const [channel, notes] of byChannel) {
    await request('cursor.setNotes', { cursor: WRITER, channel, notes });
  }
}

async function setup(): Promise<void> {
  try {
    await readFile(STATE_FILE, 'utf8');
    throw new Error('E139 state already exists; run cleanup before setup');
  } catch (error) {
    if (error instanceof Error && !error.message.includes('ENOENT')) throw error;
  }
  const baselineTracks = await tracks();
  if (baselineTracks.some((track) => track.name.startsWith('gn-e139-'))) {
    throw new Error('an E139 fixture name already exists');
  }
  const baselineScenes = await scenes();
  const baselineSelection = await selection();
  const baselineCursors: Record<string, CursorState> = {};
  for (const cursor of [WRITER, READER, 'observer']) baselineCursors[cursor] = await cursorState(cursor);

  const owned: TrackRow[] = [];
  const persistState = async (): Promise<void> => {
    const state: ProbeState = {
      baselineTrackIds: baselineTracks.map((track) => track.channelId),
      baselineScenes,
      baselineSelection,
      baselineCursors,
      ownedTrackIds: owned.map((track) => track.channelId),
    };
    await writeFile(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  };
  await persistState();

  if (baselineScenes < SCENES) await request('scene.create', { count: SCENES - baselineScenes });
  const sceneReady = await pollUntil(async () => await scenes() === Math.max(SCENES, baselineScenes));
  if (!sceneReady.ok) throw new Error('E139 scenes did not appear');

  const fixture = await createTrack(FIXTURE_NAME);
  owned.push(fixture);
  await persistState();
  const fixtureRows = [1, 16, 256, 1_000, 2_000, 4_000, 8_192, 0, 1];
  for (let row = 0; row < fixtureRows.length; row += 1) {
    await createClip(fixture.index, row, row === 8 ? 4096 : 64);
    await writeCoordinateFixture(fixture.index, row, fixtureRows[row]!);
  }

  for (let index = 0; index < TRACKS; index += 1) {
    const created = await createTrack(`${LAYOUT_PREFIX}${String(index).padStart(2, '0')}`);
    owned.push(created);
    await persistState();
    await createClip(created.index, 0, 4);
    await writeOneNote(created.index, 0, 0, 60);
    await duplicateRows(created.index);
  }

  check(`E139 setup creates one fixture track and a ${TRACKS}-by-${SCENES} realistic layout`,
    owned.length === TRACKS + 1 && await scenes() >= SCENES,
    { ownedTracks: owned.length, scenes: await scenes(), occupiedClips: TRACKS * OCCUPIED_ROWS });
  check('E139 setup leaves more addressable slots than occupied clips',
    TRACKS * SCENES > TRACKS * OCCUPIED_ROWS,
    { addressable: TRACKS * SCENES, occupied: TRACKS * OCCUPIED_ROWS });
}

async function loadState(): Promise<ProbeState> {
  return JSON.parse(await readFile(STATE_FILE, 'utf8')) as ProbeState;
}

async function fixtureTracks(): Promise<{ fixture: TrackRow; layout: readonly TrackRow[] }> {
  const current = await tracks();
  const fixture = current.find((track) => track.name === FIXTURE_NAME);
  const layout = current.filter((track) => track.name.startsWith(LAYOUT_PREFIX))
    .sort((left, right) => left.name.localeCompare(right.name));
  if (fixture === undefined || layout.length !== TRACKS) {
    throw new Error(`E139 fixture is incomplete: fixture=${fixture !== undefined}, layout=${layout.length}`);
  }
  return { fixture, layout };
}

async function pings(samples = 25): Promise<{
  readonly medianMs: number; readonly p95Ms: number; readonly maxMs: number;
}> {
  const values: number[] = [];
  for (let index = 0; index < samples; index += 1) {
    const started = performance.now();
    await request('ping');
    values.push(performance.now() - started);
  }
  values.sort((left, right) => left - right);
  const percentile = (fraction: number): number => values[Math.min(
    values.length - 1, Math.ceil(values.length * fraction) - 1,
  )]!;
  return {
    medianMs: percentile(0.5),
    p95Ms: percentile(0.95),
    maxMs: values.at(-1)!,
  };
}

async function settled(kind: 'count' | 'width', limit: number, timeoutMs = 60_000): Promise<{
  readonly summary: ScaleSummary; readonly drainMs: number; readonly fallbackWindow: string;
}> {
  const started = performance.now();
  let priorCallbacks = -1;
  let unchanged = 0;
  let summary = await scale<ScaleSummary>('read', { kind, limit });
  for (;;) {
    unchanged = summary.callbacks === priorCallbacks ? unchanged + 1 : 0;
    priorCallbacks = summary.callbacks;
    const elapsed = performance.now() - started;
    if (summary.boundViews === limit && elapsed >= 1_500 && unchanged >= 10) {
      return {
        summary,
        drainMs: elapsed,
        fallbackWindow: elapsed <= 8_000 ? 'short'
          : elapsed <= 30_000 ? '30-second' : '60-second',
      };
    }
    if (elapsed >= timeoutMs) {
      throw new Error(`observer callbacks did not drain in ${timeoutMs} ms: ${JSON.stringify(summary)}`);
    }
    await wait(50);
    summary = await scale<ScaleSummary>('read', { kind, limit });
  }
}

async function bind(
  kind: 'count' | 'width', addresses: readonly ScaleAddress[],
): Promise<number> {
  const started = performance.now();
  for (let index = 0; index < addresses.length; index += 1) {
    const address = addresses[index]!;
    await scale('point', { kind, index, trackIndex: address.trackIndex });
    const trackReady = await pollUntil(async () => {
      const status = await scale<{ readonly trackPosition: number }>('status', { kind, index });
      return status.trackPosition === address.trackIndex;
    });
    if (!trackReady.ok) throw new Error(`scale view ${index} did not reach track ${address.trackIndex}`);
    await scale('select', { kind, index, trackIndex: address.trackIndex, row: address.row });
    const clipReady = await pollUntil(async () => {
      const status = await scale<{
        readonly trackPosition: number; readonly sceneIndex: number;
      }>('status', { kind, index });
      return status.trackPosition === address.trackIndex
        && status.sceneIndex === address.row;
    }, 10_000);
    if (!clipReady.ok) throw new Error(`scale view ${index} did not reach scene ${address.row}`);
    await scale('bind', { kind, index, trackIndex: address.trackIndex, row: address.row });
    const pinned = await pollUntil(async () => {
      const status = await scale<{
        readonly trackPinned: boolean; readonly clipPinned: boolean;
      }>('status', { kind, index });
      return status.trackPinned && status.clipPinned;
    });
    if (!pinned.ok) throw new Error(`scale view ${index} did not pin`);
  }
  return performance.now() - started;
}

async function statuses(
  kind: 'count' | 'width', indices: readonly number[],
): Promise<readonly ScaleStatus[]> {
  return await Promise.all(indices.map(
    (index) => scale<ScaleStatus>('status', { kind, index }),
  ));
}

/** Bind one bank by host phase instead of waiting for each complete observer. */
async function bindPipelined(
  kind: 'count' | 'width', addresses: readonly ScaleAddress[],
): Promise<number> {
  const started = performance.now();
  const groupedIndices = (field: 'trackIndex' | 'row'): readonly number[][] => {
    const groups = new Map<number, number[]>();
    for (let index = 0; index < addresses.length; index += 1) {
      const key = addresses[index]![field];
      groups.set(key, [...(groups.get(key) ?? []), index]);
    }
    return [...groups.values()];
  };

  for (const indices of groupedIndices('trackIndex')) {
    await Promise.all(indices.map((index) => scale('point', {
      kind, index, trackIndex: addresses[index]!.trackIndex,
    })));
    const tracksReady = await pollUntil(async () => {
      const current = await statuses(kind, indices);
      return current.every(
        (status, offset) => status.trackPosition === addresses[indices[offset]!]!.trackIndex,
      );
    }, 10_000, 50);
    if (!tracksReady.ok) throw new Error('pipelined scale track group did not settle');
    await Promise.all(indices.map((index) => scale('pinTrack', {
      kind, index, pinned: true,
    })));
    const tracksPinned = await pollUntil(async () =>
      (await statuses(kind, indices)).every((status) => status.trackPinned),
    10_000, 50);
    if (!tracksPinned.ok) throw new Error('pipelined scale track group did not pin');
  }

  for (const indices of groupedIndices('row')) {
    await Promise.all(indices.map((index) => scale('select', {
      kind, index, trackIndex: addresses[index]!.trackIndex, row: addresses[index]!.row,
    })));
    const clipsReady = await pollUntil(async () => {
      const current = await statuses(kind, indices);
      return current.every((status, offset) => {
        const address = addresses[indices[offset]!]!;
        return status.trackPosition === address.trackIndex && status.sceneIndex === address.row;
      });
    }, 10_000, 50);
    if (!clipsReady.ok) throw new Error('pipelined scale scene group did not settle');
    await Promise.all(indices.map((index) => scale('bind', {
      kind, index, trackIndex: addresses[index]!.trackIndex, row: addresses[index]!.row,
    })));
    const clipsPinned = await pollUntil(async () =>
      (await statuses(kind, indices)).every(
        (status) => status.trackPinned && status.clipPinned,
      ), 10_000, 50);
    if (!clipsPinned.ok) throw new Error('pipelined scale scene group did not pin');
  }
  return performance.now() - started;
}

async function completeSample(trackIndex: number, row: number): Promise<{
  readonly count: number; readonly totalMs: number; readonly scanMs: number;
}> {
  const started = performance.now();
  await point(READER, trackIndex, row);
  await request('cursor.setStepSize', { cursor: READER, stepSize: GRID });
  await wait(144);
  const read = await request<{ readonly count: number; readonly scanMicros: number }>(
    'cursor.getNotesVerboseAllChannels', { cursor: READER, maxX: 64 },
  );
  return { count: read.count, scanMs: read.scanMicros / 1_000, totalMs: performance.now() - started };
}

async function record(result: Record<string, unknown>): Promise<void> {
  const row = { recordedAt: new Date().toISOString(), ...result };
  await appendFile(RESULT_FILE, `${JSON.stringify(row)}\n`, 'utf8');
  console.log(`E139_RESULT ${JSON.stringify(row)}`);
}

async function countArm(): Promise<void> {
  const { fixture, layout } = await fixtureTracks();
  const info = await scale<Record<string, number>>('info');
  const count = info['countViews'] ?? 0;
  if (count < 1 || count > TRACKS * SCENES) throw new Error(`invalid count bank: ${count}`);
  const stats = await request<Record<string, unknown>>('rig.stats');
  const idlePing = await pings();
  await scale('prepare', { kind: 'count', limit: count });
  const canary = Array.from({ length: count }, () => ({ trackIndex: fixture.index, row: 0 }));
  const canaryBindMs = await bind('count', canary);
  const canaryDrain = await settled('count', count);
  const canaryRead = await scale<ScaleSummary>('reconcile', { kind: 'count', limit: count });

  const occupiedAddresses = layout.flatMap((track) => Array.from(
    { length: OCCUPIED_ROWS }, (_, row) => ({ trackIndex: track.index, row }),
  ));
  const addresses = Array.from(
    { length: count }, (_, index) => occupiedAddresses[index % occupiedAddresses.length]!,
  );
  const targetBindMs = await bind('count', addresses);
  const targetDrain = await settled('count', count);
  const targetRead = await scale<ScaleSummary>('reconcile', { kind: 'count', limit: count });
  const steadyPing = await pings();
  const sampleIndices = [...new Set([0, Math.floor((count - 1) / 2), count - 1])];
  const authority = [];
  for (const index of sampleIndices) {
    const address = addresses[index]!;
    authority.push({ index, ...(await completeSample(address.trackIndex, address.row)) });
  }
  const expectedOccupied = count;
  const result = {
    arm: 'observer-count', count, info, stats,
    idlePing, canaryBindMs, canaryDrain, canaryRead,
    targetBindMs, targetDrain, targetRead, steadyPing, authority,
    expectedOccupied,
    uniqueObservedClips: Math.min(count, occupiedAddresses.length),
    projectOccupiedClips: occupiedAddresses.length,
    projectEmptySlots: TRACKS * (SCENES - OCCUPIED_ROWS),
    projectAddressableSlots: TRACKS * SCENES,
    rebuildMs: canaryBindMs + canaryDrain.drainMs + (canaryRead.reconcileMicros ?? 0) / 1_000
      + targetBindMs + targetDrain.drainMs + (targetRead.reconcileMicros ?? 0) / 1_000,
  };
  check(`E139 count ${count}: every observer binds and callback work drains`,
    targetDrain.summary.boundViews === count && targetRead.pendingDirty === 0 && targetRead.stable === true,
    targetRead);
  check(`E139 count ${count}: sparse state matches the selected occupied working set`,
    targetRead.occupiedCoordinates === expectedOccupied,
    { actual: targetRead.occupiedCoordinates, expected: expectedOccupied });
  check(`E139 count ${count}: fresh complete samples match the target rows`,
    authority.every((item) => item.count === (addresses[item.index]!.row < OCCUPIED_ROWS ? 1 : 0)),
    authority);
  await record(result);
}

async function pipelineArm(): Promise<void> {
  const { fixture, layout } = await fixtureTracks();
  const info = await scale<Record<string, number>>('info');
  const count = info['countViews'] ?? 0;
  if (count !== 64) throw new Error(`pipeline arm needs exactly 64 count views, got ${count}`);
  const occupiedAddresses = layout.flatMap((track) => Array.from(
    { length: OCCUPIED_ROWS }, (_, row) => ({ trackIndex: track.index, row }),
  ));
  const addresses = occupiedAddresses.slice(0, count);
  const canary = Array.from({ length: count }, () => ({ trackIndex: fixture.index, row: 0 }));
  const modes = ['serial', 'pipelined', 'pipelined', 'serial', 'serial', 'pipelined'] as const;
  const measurements: Record<string, unknown>[] = [];

  for (let trial = 0; trial < modes.length; trial += 1) {
    const mode = modes[trial]!;
    await scale('prepare', { kind: 'count', limit: count });
    const resetBindMs = await bindPipelined('count', canary);
    const resetDrain = await settled('count', count);
    const resetRead = await scale<ScaleSummary>('reconcile', { kind: 'count', limit: count });

    const bindMs = mode === 'serial'
      ? await bind('count', addresses)
      : await bindPipelined('count', addresses);
    const drain = await settled('count', count);
    const reconciled = await scale<ScaleSummary>('reconcile', { kind: 'count', limit: count });
    const ping = await pings(15);
    const reconcileMs = (reconciled.reconcileMicros ?? 0) / 1_000;
    const totalReplayMs = bindMs + drain.drainMs + reconcileMs;
    check(`E139 pipeline trial ${trial + 1}: ${mode} binding stays exact`,
      resetRead.occupiedCoordinates === count
        && reconciled.occupiedCoordinates === count
        && reconciled.pendingDirty === 0
        && reconciled.boundViews === count
        && reconciled.stable === true,
      { mode, resetRead, reconciled });
    measurements.push({
      trial: trial + 1,
      mode,
      resetBindMs,
      resetDrainMs: resetDrain.drainMs,
      bindMs,
      bindMsPerObserver: bindMs / count,
      drainMs: drain.drainMs,
      reconcileMs,
      reconciled,
      totalReplayMs,
      totalReplayMsPerObserver: totalReplayMs / count,
      ping,
    });
  }

  const values = (mode: typeof modes[number], field: 'bindMs' | 'totalReplayMs'): number[] =>
    measurements
      .filter((item) => item['mode'] === mode)
      .map((item) => item[field] as number)
      .sort((left, right) => left - right);
  const median = (items: readonly number[]): number => items[Math.floor(items.length / 2)]!;
  const serialBind = median(values('serial', 'bindMs'));
  const pipelinedBind = median(values('pipelined', 'bindMs'));
  const serialReplay = median(values('serial', 'totalReplayMs'));
  const pipelinedReplay = median(values('pipelined', 'totalReplayMs'));
  const authority = [];
  for (const index of [0, Math.floor(count / 2), count - 1]) {
    const address = addresses[index]!;
    authority.push({ index, ...(await completeSample(address.trackIndex, address.row)) });
  }
  check('E139 pipelined binding keeps representative exact authority reads',
    authority.every((item) => item.count === 1), authority);
  await record({
    arm: 'binding-pipeline',
    count,
    info,
    modes,
    measurements,
    medians: {
      serialBindMs: serialBind,
      serialBindMsPerObserver: serialBind / count,
      pipelinedBindMs: pipelinedBind,
      pipelinedBindMsPerObserver: pipelinedBind / count,
      bindSpeedup: serialBind / pipelinedBind,
      serialReplayMs: serialReplay,
      serialReplayMsPerObserver: serialReplay / count,
      pipelinedReplayMs: pipelinedReplay,
      pipelinedReplayMsPerObserver: pipelinedReplay / count,
      replaySpeedup: serialReplay / pipelinedReplay,
    },
    authority,
  });
}

async function pipelineCountSweepArm(): Promise<void> {
  const { fixture, layout } = await fixtureTracks();
  const info = await scale<Record<string, number>>('info');
  const allocated = info['countViews'] ?? 0;
  const occupiedAddresses = layout.flatMap((track) => Array.from(
    { length: OCCUPIED_ROWS }, (_, row) => ({ trackIndex: track.index, row }),
  ));
  const counts = PIPELINE_COUNTS.filter(
    (count) => count <= allocated && count <= occupiedAddresses.length,
  );
  if (counts.length === 0 || counts[0] !== 64) {
    throw new Error(`pipeline count sweep needs at least 64 views, got ${allocated}`);
  }
  const stats = await request<Record<string, unknown>>('rig.stats');
  const idlePing = await pings();
  const summaries: Record<string, unknown>[] = [];
  let firstKnee: number | undefined;

  const runTrial = async (count: number, trial: number): Promise<PipelineCountMeasurement> => {
    const addresses = occupiedAddresses.slice(0, count);
    const canary = Array.from(
      { length: count }, () => ({ trackIndex: fixture.index, row: 0 }),
    );
    await scale('prepare', { kind: 'count', limit: count });
    const resetBindMs = await bindPipelined('count', canary);
    const resetDrain = await settled('count', count);
    const resetRead = await scale<ScaleSummary>('reconcile', { kind: 'count', limit: count });
    const bindMs = await bindPipelined('count', addresses);
    const drain = await settled('count', count);
    const reconciled = await scale<ScaleSummary>('reconcile', { kind: 'count', limit: count });
    const ping = await pings(15);
    const reconcileMs = (reconciled.reconcileMicros ?? 0) / 1_000;
    const totalReplayMs = bindMs + drain.drainMs + reconcileMs;
    const sampleIndices = [...new Set([0, Math.floor((count - 1) / 2), count - 1])];
    const authority = [];
    for (const index of sampleIndices) {
      const address = addresses[index]!;
      authority.push({ index, ...(await completeSample(address.trackIndex, address.row)) });
    }
    const exact = resetRead.occupiedCoordinates === count
      && reconciled.occupiedCoordinates === count
      && reconciled.noteCount === count
      && reconciled.pendingDirty === 0
      && reconciled.boundViews === count
      && reconciled.stable === true
      && authority.every((item) => item.count === 1);
    check(`E139 pipelined count ${count}, trial ${trial}: replay stays exact`, exact, {
      resetRead, reconciled, authority,
    });
    const measurement: PipelineCountMeasurement = {
      count,
      trial,
      resetBindMs,
      resetDrainMs: resetDrain.drainMs,
      bindMs,
      bindMsPerObserver: bindMs / count,
      drainMs: drain.drainMs,
      reconcileMs,
      totalReplayMs,
      totalReplayMsPerObserver: totalReplayMs / count,
      ping,
      reconciled,
      authority,
    };
    await record({ arm: 'pipeline-count-sweep-trial', ...measurement });
    if (!exact) throw new Error(`pipelined count ${count}, trial ${trial} was not exact`);
    return measurement;
  };

  for (const count of counts) {
    const measurements: PipelineCountMeasurement[] = [];
    for (let trial = 1; trial <= 3; trial += 1) {
      measurements.push(await runTrial(count, trial));
    }
    const median = (field: 'bindMs' | 'totalReplayMs' | 'bindMsPerObserver'
      | 'totalReplayMsPerObserver'): number => measurements
      .map((item) => item[field])
      .sort((left, right) => left - right)[1]!;
    const p95Values = measurements.map((item) => item.ping.p95Ms)
      .sort((left, right) => left - right);
    const summary = {
      count,
      trials: measurements.length,
      medianBindMs: median('bindMs'),
      medianBindMsPerObserver: median('bindMsPerObserver'),
      medianReplayMs: median('totalReplayMs'),
      medianReplayMsPerObserver: median('totalReplayMsPerObserver'),
      medianPingP95Ms: p95Values[1]!,
      maxPingP95Ms: p95Values.at(-1)!,
      withinRebuildBudget: median('totalReplayMs') <= 40_000,
      withinPingBudget: p95Values[1]! <= 50,
    };
    summaries.push(summary);
    await record({ arm: 'pipeline-count-sweep-count', ...summary });
    if (!summary.withinRebuildBudget || !summary.withinPingBudget) {
      firstKnee = count;
      break;
    }
  }

  const recovery = await runTrial(64, 4);
  const largestPassing = summaries
    .filter((item) => item['withinRebuildBudget'] && item['withinPingBudget'])
    .at(-1)?.['count'];
  await record({
    arm: 'pipeline-count-sweep',
    allocated,
    uniqueOccupiedClips: occupiedAddresses.length,
    info,
    stats,
    idlePing,
    summaries,
    firstKnee: firstKnee ?? null,
    largestPassing: largestPassing ?? null,
    recovery,
  });
}

async function profileArm(): Promise<void> {
  await record({
    arm: 'pipeline-count-allocation',
    info: await scale<Record<string, number>>('info'),
    stats: await request<Record<string, unknown>>('rig.stats'),
    ping: await pings(),
  });
}

async function widthArm(): Promise<void> {
  const { fixture } = await fixtureTracks();
  const info = await scale<Record<string, number>>('info');
  const candidateSteps = info['candidateSteps'] ?? 0;
  if ((info['widthViews'] ?? 0) !== 2 || candidateSteps < 131_072) {
    throw new Error(`invalid width pair: ${JSON.stringify(info)}`);
  }
  const idlePing = await pings();
  await scale('prepare', { kind: 'width', limit: 2 });
  const canaryBindMs = await bind('width', [0, 1].map(() => ({ trackIndex: fixture.index, row: 0 })));
  const canaryDrain = await settled('width', 2);
  await scale('reconcile', { kind: 'width', limit: 2 });
  const targetBindMs = await bind('width', [0, 1].map(() => ({ trackIndex: fixture.index, row: 8 })));
  const targetDrain = await settled('width', 2);
  await scale('reconcile', { kind: 'width', limit: 2 });

  const boundary = candidateSteps - 1;
  await scale('mutate', {
    kind: 'width', index: 1, mutation: 'set', channel: 15,
    x: boundary, y: 127, velocity: 111, duration: GRID,
  });
  const mutationDrain = await settled('width', 2);
  const mutationRead = await scale<ScaleSummary>('reconcile', { kind: 'width', limit: 2 });
  const direct = await scale<{ readonly count: number; readonly scanMicros: number }>('directRead', {
    kind: 'width', index: 1, x: boundary, y: 127,
  });
  const steadyPing = await pings();
  await scale('mutate', {
    kind: 'width', index: 1, mutation: 'clear', channel: 15, x: boundary, y: 127,
  });
  await settled('width', 2);
  await scale('reconcile', { kind: 'width', limit: 2 });
  check(`E139 width ${candidateSteps}: exact final cell replays and reads directly`,
    direct.count === 1 && mutationRead.occupiedCoordinates === 3,
    { direct, mutationRead });
  await record({
    arm: 'width', candidateSteps, beats: candidateSteps / 512,
    barsAtFourFour: candidateSteps / 2048, info, idlePing,
    canaryBindMs, canaryDrain, targetBindMs, targetDrain,
    mutationDrain, mutationRead, direct, steadyPing,
  });
}

async function occupancyArm(): Promise<void> {
  const { fixture } = await fixtureTracks();
  const info = await scale<Record<string, number>>('info');
  if ((info['widthViews'] ?? 0) !== 2 || (info['candidateSteps'] ?? 0) < 131_072) {
    throw new Error('occupancy arm needs the paired 131072-step or wider views');
  }
  const fixtures = [
    { row: 7, count: 0 },
    { row: 0, count: 1 },
    { row: 1, count: 16 },
    { row: 2, count: 256 },
    { row: 3, count: 1_000 },
    { row: 4, count: 2_000 },
    { row: 5, count: 4_000 },
    { row: 6, count: 8_192 },
  ];
  const measurements: Record<string, unknown>[] = [];
  for (const fixtureRow of fixtures) {
    await scale('prepare', { kind: 'width', limit: 2 });
    await bind('width', [0, 1].map(() => ({ trackIndex: fixture.index, row: 0 })));
    await settled('width', 2);
    await scale('reconcile', { kind: 'width', limit: 2 });
    const bindMs = await bind('width', [0, 1].map(() => ({
      trackIndex: fixture.index, row: fixtureRow.row,
    })));
    const drain = await settled('width', 2);
    const reconciled = await scale<ScaleSummary>('reconcile', { kind: 'width', limit: 2 });
    const ping = await pings(15);
    const expected = fixtureRow.count * 2;
    check(`E139 occupancy ${fixtureRow.count}: both paired views match`,
      reconciled.occupiedCoordinates === expected && reconciled.pendingDirty === 0,
      { expected, reconciled });
    measurements.push({ count: fixtureRow.count, bindMs, drain, reconciled, ping });
  }
  await record({ arm: 'occupancy', info, measurements });
}

async function mutationArm(): Promise<void> {
  const { fixture } = await fixtureTracks();
  const info = await scale<Record<string, number>>('info');
  if ((info['widthViews'] ?? 0) !== 2) throw new Error('mutation arm needs paired width views');
  const measurements: Record<string, unknown>[] = [];
  const targetRow = 7;
  for (const count of [16, 64, 256, 1_024, 4_096]) {
    await scale('prepare', { kind: 'width', limit: 2 });
    await bind('width', [0, 1].map(() => ({ trackIndex: fixture.index, row: 0 })));
    await settled('width', 2);
    await scale('reconcile', { kind: 'width', limit: 2 });
    await bind('width', [0, 1].map(() => ({ trackIndex: fixture.index, row: targetRow })));
    await settled('width', 2);
    await scale('reconcile', { kind: 'width', limit: 2 });
    const mutation = await scale<Record<string, number>>('mutateBatch', {
      kind: 'width', index: 1, mutation: 'set', count,
    });
    const drain = await settled('width', 2);
    const reconciled = await scale<ScaleSummary>('reconcile', { kind: 'width', limit: 2 });
    const field = await scale<Record<string, number>>('mutateBatch', {
      kind: 'width', index: 1, mutation: 'field', count,
    });
    const fieldDrain = await settled('width', 2);
    const fieldRead = await scale<ScaleSummary>('reconcile', { kind: 'width', limit: 2 });
    const clear = await scale<Record<string, number>>('mutateBatch', {
      kind: 'width', index: 1, mutation: 'clear', count,
    });
    const clearDrain = await settled('width', 2);
    const clearRead = await scale<ScaleSummary>('reconcile', { kind: 'width', limit: 2 });
    measurements.push({
      count, mutation, drain, reconciled, field, fieldDrain, fieldRead,
      clear, clearDrain, clearRead, ping: await pings(15),
    });
  }

  await scale('prepare', { kind: 'width', limit: 2 });
  await bind('width', [0, 1].map(() => ({ trackIndex: fixture.index, row: targetRow })));
  await settled('width', 2);
  await scale('pause', { kind: 'width', limit: 2, paused: true });
  await scale('mutateBatch', { kind: 'width', index: 1, mutation: 'set', count: 256 });
  await wait(300);
  const shed = await scale<ScaleSummary>('read', { kind: 'width', limit: 2 });
  await scale('pause', { kind: 'width', limit: 2, paused: false });
  await bind('width', [0, 1].map(() => ({ trackIndex: fixture.index, row: 0 })));
  await settled('width', 2);
  await scale('reconcile', { kind: 'width', limit: 2 });
  await bind('width', [0, 1].map(() => ({ trackIndex: fixture.index, row: targetRow })));
  const rebuildDrain = await settled('width', 2);
  const rebuild = await scale<ScaleSummary>('reconcile', { kind: 'width', limit: 2 });
  await scale('mutateBatch', { kind: 'width', index: 1, mutation: 'clear', count: 4_096 });
  await settled('width', 2);
  await scale('reconcile', { kind: 'width', limit: 2 });
  check('E139 load shedding rejects late callbacks and rebuilds before publish',
    shed.rejectedCallbacks > 0 && rebuild.pendingDirty === 0 && rebuild.stable === true,
    { shed, rebuild });
  await record({ arm: 'mutation', info, measurements, shed, rebuildDrain, rebuild });
}

async function restoreCursor(cursor: string, state: CursorState): Promise<void> {
  await request('cursor.pin', { cursor, pinned: false });
  await request('cursor.pinTrack', { cursor, pinned: false });
  if (state.trackExists && state.slotExists) await point(cursor, state.trackPosition, state.sceneIndex);
}

async function cleanup(): Promise<void> {
  const state = await loadState();
  for (const channelId of [...state.ownedTrackIds].reverse()) {
    const current = await resolve(channelId);
    if (current === undefined) continue;
    if (!current.name.startsWith('gn-e139-')) {
      throw new Error(`cleanup refuses renamed owned track ${channelId}: ${current.name}`);
    }
    await request('track.delete', { trackIndex: current.index });
    const gone = await pollUntil(async () => await resolve(channelId) === undefined);
    if (!gone.ok) throw new Error(`owned track ${channelId} did not delete`);
  }
  while (await scenes() > state.baselineScenes) {
    await request('scene.delete', { sceneIndex: await scenes() - 1 });
    await wait(50);
  }
  for (const [cursor, prior] of Object.entries(state.baselineCursors)) {
    await restoreCursor(cursor, prior);
  }
  if (state.baselineSelection.trackIndex >= 0 && state.baselineSelection.slotIndex >= 0) {
    await request('slot.select', {
      trackIndex: state.baselineSelection.trackIndex,
      slotIndex: state.baselineSelection.slotIndex,
      mechanism: 'slot',
    });
  }
  const finalTracks = await tracks();
  const scan = await request<{ readonly slotsWithContent: number; readonly sceneCount: number }>(
    'rig.scanTracks',
  );
  check('E139 cleanup restores exact baseline track identities',
    JSON.stringify(finalTracks.map((track) => track.channelId)) === JSON.stringify(state.baselineTrackIds),
    { final: finalTracks.map((track) => track.channelId), baseline: state.baselineTrackIds });
  check('E139 cleanup restores scene count and empty launcher baseline',
    scan.sceneCount === state.baselineScenes && scan.slotsWithContent === 0, scan);
  await unlink(STATE_FILE);
}

async function main(): Promise<void> {
  const command = process.argv[2];
  if (!['setup', 'count', 'pipeline', 'pipeline-sweep', 'profile', 'width', 'occupancy', 'mutation', 'cleanup']
    .includes(command ?? '')) {
    throw new Error(
      'usage: phase8e-cache-scale.ts setup | count | pipeline | pipeline-sweep | profile | width | occupancy | mutation | cleanup',
    );
  }
  await client.connect();
  const hello = await request<{
    readonly runtimeProfile: string; readonly methodCount: number; readonly hostApiVersion: number;
  }>('contract.hello');
  check('E139 runs on the exact Phase 8 probe surface',
    hello.runtimeProfile === PROFILE && hello.methodCount === METHOD_COUNT && hello.hostApiVersion === 25,
    hello);
  if (hello.runtimeProfile !== PROFILE || hello.methodCount !== METHOD_COUNT) {
    throw new Error('the exact E139 probe archive is not live');
  }
  if (command === 'setup') await setup();
  if (command === 'count') await countArm();
  if (command === 'pipeline') await pipelineArm();
  if (command === 'pipeline-sweep') await pipelineCountSweepArm();
  if (command === 'profile') await profileArm();
  if (command === 'width') await widthArm();
  if (command === 'occupancy') await occupancyArm();
  if (command === 'mutation') await mutationArm();
  if (command === 'cleanup') await cleanup();
  client.disconnect();
  if (failureCount() > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
  client.disconnect();
  process.exitCode = 1;
});
