/** Phase 6a: prove Bitwig MasterRecorder file identity and repeatability. */
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve, relative } from 'node:path';

import { check, client, failureCount, note, pollUntil } from './lib.js';

const POLYSYNTH = 'a9ffacb5-33e9-4fc7-8621-b1af31e410ef';
const TRACK_NAME = 'gn-6a-master-recorder-source';
const SLOT = 0;
const RANGE_BEATS = 8;
const STEP_SIZE = 0.25;
const AUDIO_SUFFIX = /\.(?:wav|flac|aif|aiff)$/i;
const FFMPEG = '/opt/homebrew/bin/ffmpeg';
const FFPROBE = '/opt/homebrew/bin/ffprobe';
const RECORDER_OWNER = 'phase6a-master-recorder-probe';

interface TrackRow {
  readonly index: number;
  readonly name: string;
  readonly channelId: string;
  readonly position: number;
  readonly type: string;
}

interface FileState {
  readonly bytes: number;
  readonly modifiedMs: number;
}

interface RecorderStatus {
  readonly isActive: boolean;
  readonly durationMs: number;
  readonly sampledAtMs: number;
}

interface AudioFacts {
  readonly path: string;
  readonly bytes: number;
  readonly sha256: string;
  readonly codec: string;
  readonly channels: number;
  readonly sampleRate: number;
  readonly durationSeconds: number;
  readonly meanDb: number;
  readonly peakDb: number;
}

interface CaptureTiming {
  readonly clipSetupMs: number;
  readonly recorderActivationMs: number;
  readonly playbackMs: number;
  readonly recorderStopMs: number;
  readonly artifactSettlementMs: number;
  readonly analysisMs: number;
  readonly totalMs: number;
}

const wait = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));
const req = (method: string, params: Record<string, unknown> = {}): Promise<unknown> =>
  client.request(method, params);

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function walk(directory: string, prefix = '', root = directory): Promise<Map<string, FileState>> {
  const result = new Map<string, FileState>();
  let entries;
  try {
    entries = await readdir(resolve(root, prefix), { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return result;
    throw error;
  }
  for (const entry of entries) {
    const name = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
    const path = resolve(root, name);
    if (entry.isDirectory()) {
      for (const [child, value] of await walk(root, name, root)) result.set(child, value);
    } else if (entry.isFile()) {
      try {
        const details = await stat(path);
        result.set(name, { bytes: details.size, modifiedMs: details.mtimeMs });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }
  }
  return result;
}

async function tracks(): Promise<readonly TrackRow[]> {
  const result = await req('track.list') as { readonly tracks: readonly TrackRow[] };
  return result.tracks;
}

async function point(trackIndex: number, requireSlot = false): Promise<void> {
  await req('cursor.pin', { cursor: '0', pinned: false });
  await req('cursor.pinTrack', { cursor: '0', pinned: false });
  await req('cursor.pointTrack', { cursor: '0', trackIndex });
  if (requireSlot) {
    await req('slot.select', { trackIndex, slotIndex: SLOT, mechanism: 'track' });
  }
  const settled = await pollUntil(async () => {
    const status = await req('cursor.status', { cursor: '0' }) as {
      readonly trackPosition?: number;
      readonly cursorTrackPosition?: number;
      readonly sceneIndex?: number;
    };
    return status.cursorTrackPosition === trackIndex
      && (!requireSlot || status.trackPosition === trackIndex && status.sceneIndex === SLOT);
  });
  if (!settled.ok) throw new Error('the source cursor did not settle');
}

async function recorderStatus(): Promise<RecorderStatus> {
  return await req('masterRecorder.status', { ownerToken: RECORDER_OWNER }) as RecorderStatus;
}

async function seedClip(trackIndex: number): Promise<number> {
  const startedAt = Date.now();
  await req('clip.create', { trackIndex, slotIndex: SLOT, lengthBeats: RANGE_BEATS });
  const clip = await pollUntil(async () => {
    const slot = await req('slot.status', { trackIndex, slotIndex: SLOT }) as {
      readonly hasContent: boolean;
    };
    return slot.hasContent;
  });
  if (!clip.ok) throw new Error('the owned source clip did not appear');
  await point(trackIndex, true);
  await req('cursor.setStepSize', { cursor: '0', stepSize: STEP_SIZE });
  await req('cursor.setNotes', {
    cursor: '0',
    notes: [
      [0, 48, 88, 0.22], [4, 55, 80, 0.22], [8, 60, 88, 0.22], [12, 55, 80, 0.22],
      [16, 48, 88, 0.22], [20, 55, 80, 0.22], [24, 60, 88, 0.22], [28, 55, 80, 0.22],
    ],
  });
  await wait(200);
  return Date.now() - startedAt;
}

async function removeClip(trackIndex: number): Promise<void> {
  await req('slot.delete', { trackIndex, slotIndex: SLOT });
  const removed = await pollUntil(async () => {
    const slot = await req('slot.status', { trackIndex, slotIndex: SLOT }) as {
      readonly hasContent: boolean;
    };
    return !slot.hasContent;
  });
  if (!removed.ok) throw new Error('the owned source clip did not delete');
}

async function sha256(path: string): Promise<string> {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

async function audioFacts(path: string, file: FileState): Promise<AudioFacts> {
  const probe = JSON.parse(execFileSync(FFPROBE, [
    '-v', 'error',
    '-select_streams', 'a:0',
    '-show_entries', 'stream=codec_name,channels,sample_rate:format=duration',
    '-of', 'json',
    path,
  ], { encoding: 'utf8' })) as {
    readonly streams?: readonly {
      readonly codec_name?: string;
      readonly channels?: number;
      readonly sample_rate?: string;
    }[];
    readonly format?: { readonly duration?: string };
  };
  const volumeRun = spawnSync(FFMPEG, [
    '-hide_banner', '-nostats', '-i', path, '-af', 'volumedetect', '-f', 'null', '-',
  ], { encoding: 'utf8' });
  if (volumeRun.status !== 0) throw new Error(`ffmpeg failed for ${path}: ${volumeRun.stderr}`);
  const volume = volumeRun.stderr;
  const stream = probe.streams?.[0];
  const mean = /mean_volume:\s*(-?(?:inf|\d+(?:\.\d+)?)) dB/i.exec(volume);
  const peak = /max_volume:\s*(-?(?:inf|\d+(?:\.\d+)?)) dB/i.exec(volume);
  return {
    path,
    bytes: file.bytes,
    sha256: await sha256(path),
    codec: stream?.codec_name ?? 'unknown',
    channels: stream?.channels ?? -1,
    sampleRate: Number(stream?.sample_rate ?? Number.NaN),
    durationSeconds: Number(probe.format?.duration ?? Number.NaN),
    meanDb: mean?.[1]?.toLowerCase() === '-inf' ? Number.NEGATIVE_INFINITY : Number(mean?.[1]),
    peakDb: peak?.[1]?.toLowerCase() === '-inf' ? Number.NEGATIVE_INFINITY : Number(peak?.[1]),
  };
}

async function capture(
  projectDirectory: string,
  trackIndex: number,
  run: number,
  clipSetupMs: number,
): Promise<{
  readonly facts: AudioFacts;
  readonly recorderDurationMs: number;
  readonly timing: CaptureTiming;
}> {
  const before = await walk(projectDirectory);
  await req('transport.stop');
  const totalStartedAt = Date.now();
  const activationStartedAt = Date.now();
  await req('masterRecorder.start', { ownerToken: RECORDER_OWNER });
  const armed = await pollUntil(async () => (await recorderStatus()).isActive, 4000, 25);
  if (!armed.ok) throw new Error(`capture ${run}: MasterRecorder did not become active`);
  const activatedAt = Date.now();

  await req('slot.launchWithOptions', {
    trackIndex, slotIndex: SLOT, quantization: 'none', launchMode: 'from_start',
  });
  const reachedLastBeat = await pollUntil(async () => {
    const state = await req('cursor.playState', { cursor: '0' }) as {
      readonly isPlaying: boolean;
      readonly playingStep: number;
    };
    return state.isPlaying && state.playingStep >= 28;
  }, 8000, 20);
  if (!reachedLastBeat.ok) throw new Error(`capture ${run}: playback did not reach beat 8`);
  const wrapped = await pollUntil(async () => {
    const state = await req('cursor.playState', { cursor: '0' }) as {
      readonly isPlaying: boolean;
      readonly playingStep: number;
    };
    return state.isPlaying && state.playingStep >= 0 && state.playingStep <= 3;
  }, 3000, 10);
  if (!wrapped.ok) throw new Error(`capture ${run}: playback did not finish the 8-beat range`);
  const playbackFinishedAt = Date.now();
  await req('transport.stop');
  const durationBeforeStop = await recorderStatus();
  await req('masterRecorder.stop', { ownerToken: RECORDER_OWNER });
  const stopped = await pollUntil(async () => !(await recorderStatus()).isActive, 4000, 25);
  if (!stopped.ok) throw new Error(`capture ${run}: MasterRecorder did not stop`);
  const stoppedAt = Date.now();

  let artifact: [string, FileState] | undefined;
  const settlementStartedAt = Date.now();
  const appeared = await pollUntil(async () => {
    const after = await walk(projectDirectory);
    const newAudio = [...after.entries()].filter(([name]) =>
      AUDIO_SUFFIX.test(name) && !before.has(name));
    if (newAudio.length !== 1 || newAudio[0]![1].bytes === 0) return false;
    await wait(100);
    const stable = (await walk(projectDirectory)).get(newAudio[0]![0]);
    if (stable?.bytes !== newAudio[0]![1].bytes) return false;
    artifact = [newAudio[0]![0], stable];
    return true;
  }, 6000, 100);
  if (!appeared.ok || artifact === undefined) {
    throw new Error(`capture ${run}: no single stable audio artifact appeared`);
  }
  const [name, file] = artifact;
  const path = resolve(projectDirectory, name);
  const analysisStartedAt = Date.now();
  const facts = await audioFacts(path, file);
  const analyzedAt = Date.now();
  const timing = {
    clipSetupMs,
    recorderActivationMs: activatedAt - activationStartedAt,
    playbackMs: playbackFinishedAt - activatedAt,
    recorderStopMs: stoppedAt - playbackFinishedAt,
    artifactSettlementMs: analysisStartedAt - settlementStartedAt,
    analysisMs: analyzedAt - analysisStartedAt,
    totalMs: analyzedAt - totalStartedAt,
  };
  note(`capture ${run}: ${JSON.stringify({
    ...facts,
    path: relative(projectDirectory, facts.path),
    recorderDurationMs: durationBeforeStop.durationMs,
    timing,
  })}`);
  return {
    facts,
    recorderDurationMs: durationBeforeStop.durationMs,
    timing,
  };
}

const projectDirectoryArgument = argument('--project-dir');
if (projectDirectoryArgument === undefined) {
  throw new Error('usage: phase6a-master-recorder.ts --project-dir /absolute/project/directory');
}
const projectDirectory = resolve(projectDirectoryArgument);
const entryFiles = await walk(projectDirectory);
let entryTracks: readonly TrackRow[] = [];
let ownedTrackId: string | undefined;
let captures: readonly Awaited<ReturnType<typeof capture>>[] = [];

try {
  await client.connect();
  const hello = await req('contract.hello') as {
    readonly hostApiVersion: number;
    readonly methodCount: number;
    readonly methodsHash: string;
  };
  note(`host API ${hello.hostApiVersion}; ${hello.methodCount} methods; ${hello.methodsHash}`);
  entryTracks = await tracks();

  await req('track.create', { position: entryTracks.length });
  const created = await pollUntil(async () => (await tracks()).length === entryTracks.length + 1);
  if (!created.ok) throw new Error('the owned source track did not appear');
  const owned = (await tracks()).find((item) =>
    !entryTracks.some((entry) => entry.channelId === item.channelId));
  if (owned === undefined) throw new Error('the owned source track has no unique identity');
  ownedTrackId = owned.channelId;
  await req('track.setName', { trackIndex: owned.index, name: TRACK_NAME });
  await point(owned.index);
  await req('device.insertBitwig', { cursor: '0', uuid: POLYSYNTH });
  const device = await pollUntil(async () => {
    const listed = await req('device.list', { cursor: '0' }) as { readonly count: number };
    return listed.count === 1;
  });
  if (!device.ok) throw new Error('Polysynth did not appear on the owned source track');

  note(`source: project master; ${RANGE_BEATS} beats; UI tempo 110 BPM; Polysynth; no input track`);
  const completed: Awaited<ReturnType<typeof capture>>[] = [];
  for (let run = 1; run <= 3; run += 1) {
    const clipSetupMs = await seedClip(owned.index);
    completed.push(await capture(projectDirectory, owned.index, run, clipSetupMs));
    await removeClip(owned.index);
  }
  captures = completed;
  check('6a-L1: three captures produced three independent files',
    new Set(captures.map((item) => item.facts.path)).size === 3, captures.map((item) => item.facts.path));
  check('6a-L2: every capture is stereo PCM at one stable sample rate',
    captures.every((item) => item.facts.codec.startsWith('pcm_') && item.facts.channels === 2)
      && new Set(captures.map((item) => item.facts.sampleRate)).size === 1,
    captures.map((item) => ({ codec: item.facts.codec, channels: item.facts.channels,
      sampleRate: item.facts.sampleRate })));
  check('6a-L3: every capture is non-silent and not clipped',
    captures.every((item) => item.facts.meanDb > -70 && item.facts.peakDb < -0.1),
    captures.map((item) => ({ meanDb: item.facts.meanDb, peakDb: item.facts.peakDb })));
  check('6a-L4: every capture has a distinct content hash',
    new Set(captures.map((item) => item.facts.sha256)).size === 3,
    captures.map((item) => item.facts.sha256));
} catch (error) {
  check('6a-LX: the MasterRecorder proof completed', false,
    error instanceof Error ? `${error.name}: ${error.message}` : String(error));
} finally {
  try {
    await req('transport.stop');
    if ((await recorderStatus()).isActive) {
      await req('masterRecorder.stop', { ownerToken: RECORDER_OWNER });
    }
  } catch {
    // The bridge can be unavailable after an earlier connection failure.
  }
  if (ownedTrackId !== undefined) {
    try {
      const current = await tracks();
      const owned = current.find((item) => item.channelId === ownedTrackId);
      if (owned !== undefined) await req('track.delete', { trackIndex: owned.index });
      await wait(200);
    } catch (error) {
      check('6a-L5: owned source cleanup completed', false,
        error instanceof Error ? error.message : String(error));
    }
  }
  try {
    const finalTracks = await tracks();
    check('6a-L5: the exact entry track list is restored',
      JSON.stringify(finalTracks) === JSON.stringify(entryTracks), { entryTracks, finalTracks });
  } catch {
    // The earlier failure already reports a closed bridge.
  }
  client.disconnect();
}

const finalFiles = await walk(projectDirectory);
const newFiles = [...finalFiles.entries()].filter(([name]) => !entryFiles.has(name));
note(`new project artifacts: ${JSON.stringify(await Promise.all(newFiles.map(async ([name, value]) => ({
  path: name,
  bytes: value.bytes,
  modifiedMs: value.modifiedMs,
  sha256: await sha256(resolve(projectDirectory, name)),
}))))}`);
check('6a-L6: all three audio artifacts are inside the project master-recordings directory',
  captures.length === 3 && captures.every((item) =>
    relative(projectDirectory, item.facts.path).startsWith('master-recordings/')),
  captures.map((item) => relative(projectDirectory, item.facts.path)));
console.log(failureCount() === 0 ? '\nPhase 6a MasterRecorder: ALL PASS'
  : `\nPhase 6a MasterRecorder: ${failureCount()} FAILURE(S)`);
process.exit(failureCount() === 0 ? 0 : 1);
