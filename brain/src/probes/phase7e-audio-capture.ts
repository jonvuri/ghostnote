/** Live proof for independent launcher capture and audio-facts composition. */
import { createHash } from 'node:crypto';
import { readFile, unlink } from 'node:fs/promises';
import { basename, dirname, extname, resolve } from 'node:path';

import {
  AUDIO_CAPTURE_MODULE_ID, AUDIO_CAPTURE_PROJECT_SCHEMA, AUDIO_CAPTURE_REQUEST_SCHEMA,
  AUDIO_CAPTURE_SOURCE_SCHEMA, AUDIO_FACTS_MODULE_ID, AUDIO_PROPERTY_DEFINITIONS,
  audioCaptureModule, audioCaptureRequest, audioCaptureSource, audioFactsModule,
  captureAndAnalyze, createFfmpegExecutableAdapter, createLiveAudioCaptureController,
  type AudioCaptureGuard, type AudioCaptureRequest, type SavedBitwigProject,
} from '../audio/index.js';
import { Session } from '../session.js';
import { WORKSTATION_REQUEST_SCHEMA, WorkstationModuleRegistry } from '../workstation/index.js';
import { client, pollUntil } from './lib.js';

const METHODS_HASH = '78368fe47ea0e814';
const TRACK_NAME = 'gn-7e-audio-capture-source';
const POLYSYNTH = 'a9ffacb5-33e9-4fc7-8621-b1af31e410ef';
const SLOT = 0;
const RANGE_BEATS = 8;

interface TrackRow {
  readonly index: number;
  readonly name: string;
  readonly channelId: string;
  readonly position: number;
  readonly type: string;
}

const wait = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));
const req = (method: string, params: Record<string, unknown> = {}): Promise<unknown> =>
  client.request(method, params);

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function tracks(): Promise<readonly TrackRow[]> {
  return (await req('track.list') as { readonly tracks: readonly TrackRow[] }).tracks;
}

async function point(trackIndex: number, requireSlot: boolean): Promise<void> {
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
  if (!settled.ok) throw new Error('the owned launcher cursor did not settle');
}

async function createFixture(
  entryTracks: readonly TrackRow[],
  onOwned: (track: TrackRow) => void,
): Promise<TrackRow> {
  await req('track.create', { position: entryTracks.length });
  const appeared = await pollUntil(async () => (await tracks()).length === entryTracks.length + 1);
  if (!appeared.ok) throw new Error('the owned source track did not appear');
  const owned = (await tracks()).find((row) =>
    !entryTracks.some((entry) => entry.channelId === row.channelId));
  if (owned === undefined) throw new Error('the owned source track has no unique identity');
  onOwned(owned);
  await req('track.setName', { trackIndex: owned.index, name: TRACK_NAME });
  await point(owned.index, false);
  await req('device.insertBitwig', { cursor: '0', uuid: POLYSYNTH });
  const device = await pollUntil(async () => {
    const listed = await req('device.list', { cursor: '0' }) as { readonly count: number };
    return listed.count === 1;
  });
  if (!device.ok) throw new Error('Polysynth did not appear on the owned source track');
  await req('clip.create', { trackIndex: owned.index, slotIndex: SLOT, lengthBeats: RANGE_BEATS });
  const clip = await pollUntil(async () => {
    const status = await req('slot.status', { trackIndex: owned.index, slotIndex: SLOT }) as {
      readonly hasContent: boolean;
    };
    return status.hasContent;
  });
  if (!clip.ok) throw new Error('the owned launcher clip did not appear');
  await point(owned.index, true);
  await req('cursor.setStepSize', { cursor: '0', stepSize: 0.25 });
  await req('cursor.setNotes', {
    cursor: '0',
    notes: [
      [0, 48, 88, 0.22], [4, 55, 80, 0.22], [8, 60, 88, 0.22], [12, 55, 80, 0.22],
      [16, 48, 88, 0.22], [20, 55, 80, 0.22], [24, 60, 88, 0.22], [28, 55, 80, 0.22],
    ],
  });
  await wait(250);
  return (await tracks()).find((row) => row.channelId === owned.channelId)!;
}

async function stableGuard(session: Session): Promise<AudioCaptureGuard> {
  let prior = await session.mark();
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await wait(100);
    const next = await session.mark();
    if (prior.generation === next.generation && prior.project === next.project
        && prior.revision === next.revision && prior.sceneEpoch === next.sceneEpoch
        && prior.contentEpoch === next.contentEpoch) {
      return {
        generation: next.generation, project: next.project, revision: next.revision,
        sceneEpoch: next.sceneEpoch, contentEpoch: next.contentEpoch,
      };
    }
    prior = next;
  }
  throw new Error('the live capture guard did not settle');
}

const projectArgument = argument('--project-file');
if (projectArgument === undefined) {
  throw new Error('usage: phase7e-audio-capture.ts --project-file /absolute/project.bwproject');
}
const projectFile = resolve(projectArgument);
if (extname(projectFile) !== '.bwproject') throw new Error('the project file must end in .bwproject');
const projectDirectory = dirname(projectFile);
const projectName = basename(projectFile, '.bwproject');
const projectBytes = await readFile(projectFile);
const projectFileSha256 = createHash('sha256').update(projectBytes).digest('hex');
const session = new Session({ client, expectMethodsHash: METHODS_HASH });
let entryTracks: readonly TrackRow[] = [];
let ownedTrackId: string | undefined;
let capturedPath: string | undefined;
let failure: unknown;
const recordFailure = (error: unknown): void => {
  failure = failure === undefined
    ? error
    : new AggregateError([failure, error], 'the Phase 7e run and its cleanup both failed');
};

try {
  await client.connect();
  await session.ready();
  entryTracks = await tracks();
  const owned = await createFixture(entryTracks, (track) => { ownedTrackId = track.channelId; });
  const guard = await stableGuard(session);
  if (guard.project !== projectName) {
    throw new Error(`live project ${guard.project} does not match saved project ${projectName}`);
  }
  const project: SavedBitwigProject = {
    schema: AUDIO_CAPTURE_PROJECT_SCHEMA,
    directory: projectDirectory,
    projectFile,
    projectFileSha256,
    liveProjectName: projectName,
    permissionBasis: 'owned disposable Phase 7e Bitwig project',
    associationBasis: 'operator-established-path-plus-live-guard-v0',
  };
  const source = audioCaptureSource({
    schema: AUDIO_CAPTURE_SOURCE_SCHEMA,
    sourceId: 'phase7e-owned-launcher-loop',
    sourceKind: 'project-master-during-launcher-clip',
    projectFileSha256,
    launcherClip: {
      kind: 'clip',
      slot: {
        kind: 'slot',
        track: { kind: 'track', channelId: owned.channelId },
        scene: { kind: 'scene', index: SLOT, epoch: guard.sceneEpoch },
      },
    },
    guard,
    range: {
      policy: 'one-launcher-loop-from-start-v0',
      startBeats: 0,
      endBeats: RANGE_BEATS,
      stepSizeBeats: 0.25,
    },
    permissionBasis: 'owned launcher clip and disposable project master output',
    coverage: {
      masterSource: 'project-master',
      launcherClipRole: 'range-trigger',
      otherProjectOutput: 'not-excluded',
    },
  });
  const captureRequest = audioCaptureRequest(project, source, {
    activationMs: 4_000,
    playbackMs: 8_000,
    stopMs: 4_000,
    settleMs: 6_000,
    pollMs: 25,
    stabilityMs: 100,
  });
  const envelope = {
    schema: WORKSTATION_REQUEST_SCHEMA,
    requestId: 'phase7e-live-capture',
    inputSchema: AUDIO_CAPTURE_REQUEST_SCHEMA,
    sourceSha256: source.sha256,
    payload: captureRequest,
  } as const;
  const captureTiming: { phase: string; elapsedMs: number }[] = [];
  const analysisTiming: { phase: string; elapsedMs: number }[] = [];
  const registry = new WorkstationModuleRegistry();
  registry.register(audioCaptureModule({
    controller: createLiveAudioCaptureController(session, METHODS_HASH),
    onTiming: (event) => captureTiming.push(event),
  }));
  registry.register(audioFactsModule({
    adapter: createFfmpegExecutableAdapter(),
    onTiming: (event) => analysisTiming.push(event),
  }));
  const composed = await captureAndAnalyze(registry, envelope, 'phase7e-live-analysis', {
    taskId: 'phase7e-live-crest',
    property: 'crest',
    operationalDefinition: AUDIO_PROPERTY_DEFINITIONS.crest,
  });
  capturedPath = composed.capture.payload.artifact.absolutePath;
  if (!composed.analysis.ok) throw composed.analysis.error;
  const result = composed.analysis.response.payload;
  console.log(JSON.stringify({
    captureModule: registry.discover().find((item) => item.moduleId === AUDIO_CAPTURE_MODULE_ID),
    analysisModule: registry.discover().find((item) => item.moduleId === AUDIO_FACTS_MODULE_ID),
    capture: composed.capture.payload,
    analysis: {
      schema: result.schema,
      source: result.source,
      coverage: result.coverage,
      facts: result.facts,
      provider: result.provider,
      timingMs: result.timingMs,
    },
    startupTiming: { capture: captureTiming, analysis: analysisTiming },
  }, null, 2));
} catch (error) {
  failure = error;
} finally {
  try {
    await req('transport.stop');
  } catch {
    // The session error reports a closed bridge.
  }
  if (capturedPath !== undefined) {
    const recordingRoot = resolve(projectDirectory, 'master-recordings');
    if (dirname(capturedPath) !== recordingRoot) {
      recordFailure(new Error('the captured path is outside the owned recording directory'));
    } else {
      await unlink(capturedPath).catch(recordFailure);
    }
  }
  if (ownedTrackId !== undefined) {
    try {
      const current = await tracks();
      const owned = current.find((row) => row.channelId === ownedTrackId);
      if (owned !== undefined) await req('track.delete', { trackIndex: owned.index });
      await wait(250);
    } catch (error) {
      recordFailure(error);
    }
  }
  try {
    const recorder = await req('masterRecorder.status', { ownerToken: 'phase7e-cleanup-check' }) as {
      readonly isActive?: boolean;
      readonly leaseState?: string;
    };
    if (recorder.isActive !== false || recorder.leaseState !== 'none') {
      recordFailure(new Error(`MasterRecorder cleanup is incomplete: ${JSON.stringify(recorder)}`));
    }
    const finalTracks = await tracks();
    if (JSON.stringify(finalTracks) !== JSON.stringify(entryTracks)) {
      recordFailure(new Error('the exact entry track list was not restored'));
    }
  } catch (error) {
    recordFailure(error);
  }
  await session.close().catch(() => undefined);
}

if (failure !== undefined) throw failure;
