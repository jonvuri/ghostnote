/** Phase 4 session 4a: device-populated project scale. SCRATCH PROJECT ONLY. */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { BridgeClient } from '../client.js';
import {
  percentile, requireFullTrackWindow, stableDeviceRead,
  type DeviceRead, type StableDeviceRow,
} from './phase4a-device-scale-lib.js';

const STATE_PATH = path.join(os.tmpdir(), 'ghostnote-phase4a-device-scale.json');
const CONFIG_PATH = path.join(os.homedir(), '.ghostnote', 'rig.json');
const BUILT = path.resolve('../extension/build/libs/ghostnote-0.0.1.bwextension');
const DEPLOYED = path.join(
  os.homedir(), 'Documents', 'Bitwig Studio', 'Extensions', 'ghostnote-0.0.1.bwextension');
const PROJECT_NAME = '4a-device-scale';
const CREATED_TRACKS = 48;
const POLYSYNTH = 'a9ffacb5-33e9-4fc7-8621-b1af31e410ef';
const POLYMER = '8f58138b-03aa-4e9d-83bd-a038c99a4ed5';

interface TrackRow {
  readonly index: number;
  readonly name: string;
  readonly position: number;
  readonly type: string;
  readonly channelId: string;
}

interface TrackList {
  readonly tracks: readonly TrackRow[];
  readonly count: number;
  readonly itemCount: number;
  readonly bankSize: number;
}

interface Scan {
  readonly scanMicros: number;
  readonly existing: number;
  readonly withChannelId: number;
  readonly slotsWithContent: number;
  readonly sceneCount: number;
  readonly itemCount: number;
  readonly bankSize: number;
}

interface Config {
  readonly stamp: string;
  readonly tracks: number;
  readonly scenes: number;
  readonly cursorPool: number;
  readonly deviceBank: number;
  readonly paramHandles: number;
  readonly directObservers: boolean;
}

interface RigStats {
  readonly config: Config & { readonly fromFile: boolean };
  readonly rigConstructMicros: number;
  readonly initMicros: number;
  readonly initEpochMs: number;
  readonly heapUsedMb: number;
  readonly resources: Record<string, number>;
}

interface Measurement {
  readonly load: number;
  readonly config: string;
  readonly reloadMs: number;
  readonly constructMs: number;
  readonly initMs: number;
  readonly warmupMs: number;
  readonly sweepMs: number;
  readonly pingP50Ms: number;
  readonly pingP95Ms: number;
  readonly pingMaxMs: number;
  readonly heapMb: number;
  readonly deviceCount: number;
  readonly unstableRows: number;
  readonly blindRows: number;
  readonly deviceReadTimeouts: number;
  readonly projectBytes: number;
  readonly resources: Record<string, number>;
  readonly rows: readonly StableDeviceRow[];
}

interface SessionState {
  readonly entry: {
    readonly capturedAt: string;
    readonly configExists: boolean;
    readonly configBase64: string;
    readonly configSha256: string;
    readonly builtSha256: string;
    readonly deployedSha256: string;
    readonly host: unknown;
    readonly rig: RigStats;
    readonly scan: Scan;
    readonly project: unknown;
    readonly transport: unknown;
    readonly selection: unknown;
    readonly tracks: TrackList;
    readonly devices: readonly StableDeviceRow[];
  };
  scratch?: {
    readonly projectPath: string;
    readonly baselineIds: readonly string[];
    readonly createdIds: readonly string[];
    readonly measurements: readonly Measurement[];
  };
}

const client = new BridgeClient();
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const readState = (): SessionState => JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')) as SessionState;
const writeState = (state: SessionState): void => {
  fs.writeFileSync(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`);
};

async function request<T>(method: string, params?: Record<string, unknown>, timeout = 10_000): Promise<T> {
  return await client.request(method, params, timeout) as T;
}

const listTracks = () => request<TrackList>('track.list');
const scanTracks = () => request<Scan>('rig.scanTracks');
const rigStats = () => request<RigStats>('rig.stats');

async function projectName(): Promise<string> {
  const revision = await request<{ readonly project?: string }>('revision.get');
  return revision.project ?? '';
}

function triggerReload(): void {
  // E5: Bitwig ignores an atomic replacement and watches an in-place content
  // change. The production deploy stays atomic. This measurement-only reload
  // uses the proven E5 trigger and verifies the requested stamp after restart.
  fs.copyFileSync(BUILT, DEPLOYED);
}

function writeConfig(config: Config): void {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  const staged = `${CONFIG_PATH}.phase4a-staged`;
  fs.writeFileSync(staged, JSON.stringify(config));
  fs.renameSync(staged, CONFIG_PATH);
}

async function reconnect(): Promise<void> {
  client.disconnect();
  for (let attempt = 0; attempt < 360; attempt += 1) {
    try {
      await client.connect();
      await request('ping', undefined, 3000);
      return;
    } catch {
      client.disconnect();
      await wait(250);
    }
  }
  throw new Error('the bridge did not return within 90 seconds');
}

async function reload(config: Config): Promise<number> {
  writeConfig(config);
  client.disconnect();
  const started = Date.now();
  triggerReload();
  await reconnect();
  let liveEpoch = -1;
  let stable = 0;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const stats = await request<RigStats>('rig.stats', undefined, 3000);
      if (stats.config.stamp === config.stamp) {
        stable = stats.initEpochMs === liveEpoch ? stable + 1 : 1;
        liveEpoch = stats.initEpochMs;
        if (stable >= 4) return Date.now() - started;
      } else {
        stable = 0;
      }
    } catch {
      // A connection can answer one ping while the old extension instance is
      // going away. Drop that socket and connect to the new instance.
      client.disconnect();
      stable = 0;
      await wait(250);
    }
    await wait(250);
  }
  throw new Error(`the extension did not load config ${config.stamp}`);
}

async function warmup(): Promise<{ readonly ms: number; readonly scan: Scan }> {
  const started = Date.now();
  let prior = '';
  let stable = 0;
  let scan = await scanTracks();
  for (let attempt = 0; attempt < 600; attempt += 1) {
    scan = await scanTracks();
    const signature = `${scan.existing}/${scan.withChannelId}/${scan.slotsWithContent}`;
    const ready = scan.existing > 0 && scan.existing === scan.withChannelId;
    stable = ready && signature === prior ? stable + 1 : 0;
    if (stable >= 3) return { ms: Date.now() - started, scan };
    prior = signature;
    await wait(10);
  }
  throw new Error('the track bank did not stabilize');
}

async function readDevices(): Promise<DeviceRead> {
  let last: unknown;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      return await request<DeviceRead>('device.list', { cursor: 0 }, 3000);
    } catch (error) {
      last = error;
      console.log(`device.list retry ${attempt}/4 during population: ${String(error)}`);
      client.disconnect();
      await wait(250);
    }
  }
  throw last;
}

async function pointTrack(index: number, label: string, onTimeout?: () => void): Promise<void> {
  let last: unknown;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      await request('cursor.pointTrack', { cursor: '0', trackIndex: index }, 3000);
      return;
    } catch (error) {
      last = error;
      onTimeout?.();
      console.log(`cursor.pointTrack retry ${attempt}/4 at ${label}: ${String(error)}`);
      client.disconnect();
      await wait(250);
    }
  }
  throw last;
}

async function deviceSweep(tracks: readonly TrackRow[]): Promise<{
  readonly ms: number;
  readonly rows: readonly StableDeviceRow[];
  readonly timeouts: number;
}> {
  const started = Date.now();
  const rows: StableDeviceRow[] = [];
  let timeouts = 0;
  for (const track of tracks) {
    await pointTrack(track.index, track.channelId, () => { timeouts += 1; });
    const read = async (): Promise<DeviceRead> => {
      try {
        return await request<DeviceRead>('device.list', { cursor: 0 }, 3000);
      } catch (error) {
        timeouts += 1;
        console.log(`device.list timeout at ${track.channelId} attempt ${timeouts}: ${String(error)}`);
        client.disconnect();
        await wait(250);
        return {
          devices: [], count: 0, itemCount: 0, trackChannelId: '',
          trackPosition: -1, bankSize: 0,
        };
      }
    };
    rows.push(await stableDeviceRead(track.channelId, read, 12));
  }
  return { ms: Date.now() - started, rows, timeouts };
}

async function pingLatency(samples = 50): Promise<{
  readonly p50: number;
  readonly p95: number;
  readonly max: number;
}> {
  const values: number[] = [];
  for (let sample = 0; sample < samples; sample += 1) {
    const started = process.hrtime.bigint();
    await request('ping');
    values.push(Number(process.hrtime.bigint() - started) / 1e6);
  }
  return { p50: percentile(values, 0.5), p95: percentile(values, 0.95), max: Math.max(...values) };
}

function projectBytes(target: string): number {
  const stat = fs.statSync(target);
  if (stat.isFile()) return stat.size;
  return fs.readdirSync(target, { withFileTypes: true }).reduce((total, entry) =>
    total + projectBytes(path.join(target, entry.name)), 0);
}

async function saveProject(target: string): Promise<number> {
  const before = fs.existsSync(target)
    ? { bytes: projectBytes(target), mtimeMs: fs.statSync(target).mtimeMs }
    : { bytes: -1, mtimeMs: -1 };
  execFileSync('osascript', ['-e', 'tell application "Bitwig Studio" to activate']);
  const invoked = await request<{ readonly resolved?: boolean; readonly resolvedName?: string }>(
    'app.invokeAction', { id: 'Save' });
  if (invoked.resolved !== true || invoked.resolvedName !== 'Save') {
    throw new Error(`Bitwig Save did not resolve: ${JSON.stringify(invoked)}`);
  }
  let prior = -1;
  let stable = 0;
  let changed = false;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    await wait(100);
    let bytes: number;
    try {
      bytes = projectBytes(target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        stable = 0;
        continue;
      }
      throw error;
    }
    const mtimeMs = fs.statSync(target).mtimeMs;
    changed ||= bytes !== before.bytes || mtimeMs !== before.mtimeMs;
    stable = bytes === prior ? stable + 1 : 0;
    if (stable >= 5 && (changed || attempt >= 20)) return bytes;
    prior = bytes;
  }
  throw new Error('the project save did not settle');
}

const BASE: Omit<Config, 'stamp'> = {
  tracks: 64, scenes: 16, cursorPool: 3, deviceBank: 8,
  paramHandles: 16, directObservers: true,
};

function configs(load: number): readonly [string, Config][] {
  const make = (name: string, values: Partial<Config> = {}): [string, Config] => [name, {
    ...BASE, ...values, stamp: `4a-${load}-${name}`,
  }];
  return [
    make('small-full-window'),
    make('pool-8', { cursorPool: 8 }),
    make('device-bank-16', { deviceBank: 16 }),
    make('params-64', { paramHandles: 64 }),
    make('combined-full-window', { cursorPool: 8, deviceBank: 16, paramHandles: 64 }),
    make('d7-candidate', {
      tracks: 256, scenes: 128, cursorPool: 8, deviceBank: 16, paramHandles: 64,
    }),
    make('d7-no-direct', {
      tracks: 256, scenes: 128, cursorPool: 8, deviceBank: 16, paramHandles: 64,
      directObservers: false,
    }),
  ];
}

async function measure(
  load: number,
  name: string,
  config: Config,
  createdIds: readonly string[],
  target: string,
): Promise<Measurement> {
  console.log(`measure load=${load} config=${name}`);
  const reloadMs = await reload(config);
  const warmed = await warmup();
  requireFullTrackWindow(warmed.scan.itemCount, warmed.scan.bankSize);
  const listed = await listTracks();
  const created = createdIds.map((id) => listed.tracks.find((track) => track.channelId === id))
    .filter((track): track is TrackRow => track !== undefined);
  if (created.length !== CREATED_TRACKS) {
    throw new Error(`only ${created.length}/${CREATED_TRACKS} created tracks are visible at ${name}`);
  }
  const sweep = await deviceSweep(created);
  const unstableRows = sweep.rows.filter((row) => !row.stable).length;
  const blindRows = sweep.rows.filter((row) => row.itemCount > row.bankSize
    || row.count !== row.itemCount).length;
  const deviceCount = sweep.rows.reduce((sum, row) => sum + row.itemCount, 0);
  if (unstableRows > 0 || blindRows > 0 || deviceCount !== load * CREATED_TRACKS) {
    throw new Error(`${name} load ${load} sweep failed: `
      + `${deviceCount} devices, ${unstableRows} unstable rows, ${blindRows} blind rows`);
  }
  const ping = await pingLatency();
  const stats = await rigStats();
  const savedBytes = await saveProject(target);
  const result: Measurement = {
    load, config: name, reloadMs,
    constructMs: stats.rigConstructMicros / 1000,
    initMs: stats.initMicros / 1000,
    warmupMs: warmed.ms,
    sweepMs: sweep.ms,
    pingP50Ms: ping.p50,
    pingP95Ms: ping.p95,
    pingMaxMs: ping.max,
    heapMb: stats.heapUsedMb,
    deviceCount, unstableRows, blindRows, deviceReadTimeouts: sweep.timeouts,
    projectBytes: savedBytes,
    resources: stats.resources,
    rows: sweep.rows,
  };
  console.log(JSON.stringify({ ...result, rows: undefined }));
  return result;
}

async function addDevices(createdIds: readonly string[], from: number, to: number): Promise<boolean> {
  await reload({
    stamp: `4a-build-${to}`, tracks: 64, scenes: 16, cursorPool: 3,
    deviceBank: 8, paramHandles: 16, directObservers: true,
  });
  await warmup();
  const trackLimit = Number(process.env['GHOSTNOTE_4A_POPULATION_TRACKS_PER_RUN'] ?? 6);
  let changedTracks = 0;
  for (let trackNumber = 0; trackNumber < createdIds.length; trackNumber += 1) {
    const id = createdIds[trackNumber]!;
    const listed = await listTracks();
    const track = listed.tracks.find((item) => item.channelId === id);
    if (track === undefined) throw new Error(`created track is not visible: ${id}`);
    await pointTrack(track.index, id);
    const before = await stableDeviceRead(id, readDevices, 12);
    if (!before.stable || before.itemCount < from) {
      throw new Error(`track ${id} has ${before.itemCount} devices before ${from}->${to}`);
    }
    if (before.itemCount === to) continue;
    if (changedTracks >= trackLimit) return false;
    changedTracks += 1;

    let current = before;
    // A command cutoff can leave an asynchronous insert pending. If it lands
    // before the next run, remove only the surplus devices on our recorded row.
    for (let device = current.itemCount - 1; device >= to; device -= 1) {
      const item = current.devices.find((candidate) => candidate.index === device);
      if (item === undefined) throw new Error(`surplus device ${device} is outside the bank`);
      await request('device.delete', {
        cursor: '0', deviceIndex: device, expectedName: item.name,
        expectedTrackChannelId: id,
      });
      for (let attempt = 0; attempt < 30; attempt += 1) {
        current = await stableDeviceRead(id, readDevices, 4);
        if (current.stable && current.itemCount === device) break;
        await wait(100);
      }
      if (!current.stable || current.itemCount !== device) {
        throw new Error(`surplus device ${device} did not delete from track ${id}`);
      }
    }

    for (let device = current.itemCount; device < to; device += 1) {
      const uuid = (trackNumber + device) % 2 === 0 ? POLYSYNTH : POLYMER;
      await request('device.insertBitwig', { cursor: '0', uuid });
      let settled: StableDeviceRow | undefined;
      for (let attempt = 0; attempt < 30; attempt += 1) {
        settled = await stableDeviceRead(id, readDevices, 4);
        if (settled.stable && settled.itemCount === device + 1) break;
        await wait(100);
      }
      if (settled?.stable !== true || settled.itemCount !== device + 1) {
        throw new Error(`device ${device + 1} did not settle on track ${id}`);
      }
    }
  }
  return true;
}

async function captureEntry(): Promise<void> {
  await client.connect();
  const configExists = fs.existsSync(CONFIG_PATH);
  const config = configExists ? fs.readFileSync(CONFIG_PATH) : Buffer.alloc(0);
  const warmed = await warmup();
  requireFullTrackWindow(warmed.scan.itemCount, warmed.scan.bankSize);
  const tracks = await listTracks();
  const selection = await request<{ readonly trackIndex: number; readonly slotIndex: number }>(
    'selection.status');
  let devices: Awaited<ReturnType<typeof deviceSweep>>;
  try {
    devices = await deviceSweep(tracks.tracks);
  } finally {
    if (selection.trackIndex >= 0 && selection.slotIndex >= 0) {
      await request('slot.select', {
        trackIndex: selection.trackIndex, slotIndex: selection.slotIndex, mechanism: 'slot',
      });
    }
  }
  const badRows = devices.rows.filter((row) => !row.stable || row.itemCount > row.bankSize);
  if (badRows.length > 0) {
    throw new Error(`the entry project device window is unstable or blind: ${JSON.stringify(badRows)}`);
  }
  const state: SessionState = {
    entry: {
      capturedAt: new Date().toISOString(),
      configExists,
      configBase64: config.toString('base64'),
      configSha256: sha256(config),
      builtSha256: sha256(fs.readFileSync(BUILT)),
      deployedSha256: sha256(fs.readFileSync(DEPLOYED)),
      host: await request('host.info'),
      rig: await rigStats(),
      scan: warmed.scan,
      project: await request('revision.get'),
      transport: await request('transport.status'),
      selection,
      tracks,
      devices: devices.rows,
    },
  };
  writeState(state);
  console.log(JSON.stringify(state.entry, null, 2));
}

async function createTracks(state: SessionState, projectPath: string): Promise<SessionState> {
  if (await projectName() !== PROJECT_NAME) {
    throw new Error(`open the saved scratch project "${PROJECT_NAME}" before the run`);
  }
  if (!fs.existsSync(projectPath)) throw new Error(`scratch project path does not exist: ${projectPath}`);
  const transport = await request<{ readonly isPlaying: boolean }>('transport.status');
  if (transport.isPlaying) throw new Error('stop transport before the run');
  await reload({
    stamp: '4a-build-tracks', tracks: 64, scenes: 16, cursorPool: 3,
    deviceBank: 8, paramHandles: 16, directObservers: true,
  });
  const before = await listTracks();
  requireFullTrackWindow(before.itemCount + CREATED_TRACKS, 64);
  const baseline = new Set(before.tracks.map((track) => track.channelId));
  for (let index = 0; index < CREATED_TRACKS; index += 1) {
    await request('track.create', { position: before.count + index });
  }
  for (let attempt = 0; attempt < 600; attempt += 1) {
    if ((await listTracks()).count >= before.count + CREATED_TRACKS) break;
    await wait(100);
  }
  const after = await listTracks();
  const created = after.tracks.filter((track) => !baseline.has(track.channelId));
  if (created.length !== CREATED_TRACKS) {
    throw new Error(`identified ${created.length}/${CREATED_TRACKS} created tracks`);
  }
  for (let index = 0; index < created.length; index += 1) {
    await request('track.setName', {
      trackIndex: created[index]!.index,
      name: `gn-4a-${String(index + 1).padStart(2, '0')}`,
    });
  }
  const next: SessionState = {
    ...state,
    scratch: {
      projectPath,
      baselineIds: before.tracks.map((track) => track.channelId),
      createdIds: created.map((track) => track.channelId),
      measurements: [],
    },
  };
  writeState(next);
  return next;
}

async function run(): Promise<void> {
  let state = readState();
  await client.connect();
  const target = process.env['GHOSTNOTE_4A_PROJECT_PATH'];
  if (target === undefined) throw new Error('set GHOSTNOTE_4A_PROJECT_PATH to the saved scratch project');
  if (state.scratch === undefined) state = await createTracks(state, target);
  const scratch = state.scratch!;
  const measurements = [...scratch.measurements];
  const measurementLimit = Number(process.env['GHOSTNOTE_4A_MEASUREMENTS_PER_RUN'] ?? 2);
  let acceptedThisRun = 0;
  for (const [from, load] of [[0, 0], [0, 1], [1, 4], [4, 8]] as const) {
    const planned = configs(load);
    if (planned.every(([name]) => measurements.some(
      (item) => item.load === load && item.config === name))) {
      continue;
    }
    if (load > from && !(await addDevices(scratch.createdIds, from, load))) {
      console.log(`checkpointed a bounded ${from}->${load} population step; run again to continue`);
      return;
    }
    for (const [name, config] of planned) {
      if (measurements.some((item) => item.load === load && item.config === name)) continue;
      measurements.push(await measure(load, name, config, scratch.createdIds, scratch.projectPath));
      state = { ...state, scratch: { ...scratch, measurements } };
      writeState(state);
      acceptedThisRun += 1;
      if (acceptedThisRun >= measurementLimit) {
        console.log(`checkpointed ${acceptedThisRun} measurements; run again to continue`);
        return;
      }
    }
  }
  await reload({
    stamp: '4a-maximum-ready', tracks: 256, scenes: 128, cursorPool: 8,
    deviceBank: 16, paramHandles: 64, directObservers: true,
  });
  console.log(`maximum fixture ready: ${CREATED_TRACKS} tracks and ${CREATED_TRACKS * 8} devices`);
  console.log(`state: ${STATE_PATH}`);
}

async function restoreEntryConfig(state: SessionState): Promise<void> {
  const bytes = Buffer.from(state.entry.configBase64, 'base64');
  client.disconnect();
  if (state.entry.configExists) {
    fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
    const staged = `${CONFIG_PATH}.phase4a-restore`;
    fs.writeFileSync(staged, bytes);
    fs.renameSync(staged, CONFIG_PATH);
  } else if (fs.existsSync(CONFIG_PATH)) {
    fs.unlinkSync(CONFIG_PATH);
  }
  triggerReload();
  await reconnect();
  const restored = state.entry.configExists ? fs.readFileSync(CONFIG_PATH) : Buffer.alloc(0);
  if (sha256(restored) !== state.entry.configSha256) {
    throw new Error('rig.json was not restored byte for byte');
  }
}

async function cleanup(): Promise<void> {
  const state = readState();
  if (state.scratch === undefined) throw new Error('the state has no scratch fixture');
  await client.connect();
  if (await projectName() !== PROJECT_NAME) {
    throw new Error(`open scratch project "${PROJECT_NAME}" before cleanup`);
  }
  await reload({
    stamp: '4a-cleanup', tracks: 256, scenes: 128, cursorPool: 8,
    deviceBank: 16, paramHandles: 64, directObservers: true,
  });
  const before = await listTracks();
  const targets = before.tracks.filter((track) => state.scratch!.createdIds.includes(track.channelId))
    .sort((left, right) => right.position - left.position);
  for (const target of targets) {
    const resolved = await request<{ readonly found: boolean; readonly index?: number }>(
      'track.resolveByChannelId', { channelId: target.channelId });
    if (resolved.found && resolved.index !== undefined) {
      await request('track.delete', { trackIndex: resolved.index });
    }
  }
  for (let attempt = 0; attempt < 300; attempt += 1) {
    const remaining = (await listTracks()).tracks
      .filter((track) => state.scratch!.createdIds.includes(track.channelId));
    if (remaining.length === 0) break;
    await wait(100);
  }
  const after = await listTracks();
  const finalIds = after.tracks.map((track) => track.channelId);
  if (state.scratch.createdIds.some((id) => finalIds.includes(id))) {
    throw new Error('one or more created tracks remain after cleanup');
  }
  if (state.scratch.baselineIds.some((id) => !finalIds.includes(id))) {
    throw new Error('cleanup removed a scratch-project baseline track');
  }
  await saveProject(state.scratch.projectPath);
  await restoreEntryConfig(state);
  console.log(`cleanup passed: removed ${targets.length} recorded tracks and restored rig.json exactly`);
}

const mode = process.argv[2] ?? 'status';
try {
  if (mode === 'entry') await captureEntry();
  else if (mode === 'run') await run();
  else if (mode === 'cleanup') await cleanup();
  else if (mode === 'status') console.log(fs.existsSync(STATE_PATH)
    ? fs.readFileSync(STATE_PATH, 'utf8') : 'no 4a state captured');
  else if (mode === 'forget') {
    fs.unlinkSync(STATE_PATH);
    console.log('removed the completed 4a state file');
  } else throw new Error(`unknown mode: ${mode}`);
} finally {
  client.disconnect();
}
