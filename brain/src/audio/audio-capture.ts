/** Guarded launcher-clip capture for audio-capture-v0. */
import { createHash, randomUUID } from 'node:crypto';
import { lstat, open, readdir, realpath, stat } from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, join, normalize } from 'node:path';

import type { ClipAddress } from '../contract/index.js';
import {
  WORKSTATION_REQUEST_SCHEMA, WORKSTATION_RESPONSE_SCHEMA, WorkstationModuleError,
  WorkstationModuleRegistry, type ModuleHealth, type WorkstationModule,
  type WorkstationRequest, type WorkstationResponse,
} from '../workstation/index.js';
import {
  AUDIO_ARTIFACT_SCHEMA, AUDIO_FACTS_MODULE_ID, AUDIO_FACTS_REQUEST_SCHEMA,
  AUDIO_FACTS_RESULT_SCHEMA, MAX_AUDIO_ARTIFACT_BYTES, readPcm24WaveHeader,
  verifyAudioArtifact,
  type AudioArtifactDeclaration, type AudioFactsRequest, type AudioFactsResult,
  type AudioFactsTask, type Pcm24WaveHeader,
} from './audio-facts.js';

export const AUDIO_CAPTURE_SOURCE_SCHEMA = 'ghostnote-audio-capture-source-v0';
export const AUDIO_CAPTURE_PROJECT_SCHEMA = 'ghostnote-saved-bitwig-project-v0';
export const AUDIO_CAPTURE_REQUEST_SCHEMA = 'ghostnote-audio-capture-request-v0';
export const AUDIO_CAPTURE_RESULT_SCHEMA = 'audio-capture-v0';
export const AUDIO_CAPTURE_MODULE_ID = 'ghostnote-audio-capture';
export const AUDIO_CAPTURE_MODULE_VERSION = '0';
export const AUDIO_CAPTURE_PROVIDER_VERSION = '0';
export const AUDIO_CAPTURE_HEADER_READER_VERSION = '0';
export const AUDIO_CAPTURE_STARTUP_DEADLINE_MS = 10_000;
export const AUDIO_CAPTURE_REQUEST_DEADLINE_MS = 90_000;
export const MAX_CAPTURE_PROJECT_BYTES = 512 * 1_024 * 1_024;
export const AUDIO_CAPTURE_DURATION_TOLERANCE_MS = 750;

const SHA256 = /^[0-9a-f]{64}$/;
const SOURCE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const LOSSLESS_AUDIO = /\.(?:wav|flac|aif|aiff)$/i;

export interface SavedBitwigProject {
  readonly schema: typeof AUDIO_CAPTURE_PROJECT_SCHEMA;
  readonly directory: string;
  readonly projectFile: string;
  readonly projectFileSha256: string;
  readonly liveProjectName: string;
  readonly permissionBasis: string;
  readonly associationBasis: 'operator-established-path-plus-live-guard-v0';
}

export interface AudioCaptureGuard {
  readonly generation: string;
  readonly project: string;
  readonly revision: number;
  readonly sceneEpoch: number;
  readonly contentEpoch: number;
}

export interface AudioCaptureRange {
  readonly policy: 'one-launcher-loop-from-start-v0';
  /** Exact launcher play start. The loop still starts at beat zero. */
  readonly startBeats: number;
  readonly endBeats: number;
  readonly stepSizeBeats: 0.25;
}

export interface AudioCaptureSourceManifest {
  readonly schema: typeof AUDIO_CAPTURE_SOURCE_SCHEMA;
  readonly sourceId: string;
  readonly sourceKind: 'project-master-during-launcher-clip';
  readonly projectFileSha256: string;
  readonly launcherClip: ClipAddress;
  readonly guard: AudioCaptureGuard;
  readonly range: AudioCaptureRange;
  readonly permissionBasis: string;
  readonly coverage: {
    readonly masterSource: 'project-master';
    readonly launcherClipRole: 'range-trigger';
    readonly otherProjectOutput: 'not-excluded';
  };
}

export interface AudioCaptureSource {
  readonly manifest: AudioCaptureSourceManifest;
  readonly sha256: string;
  readonly digestDomain: 'audio-capture-source-v0';
  readonly canonicalizationVersion: 'capture-source-json-v0';
}

export interface AudioCaptureBounds {
  readonly activationMs: number;
  readonly playbackMs: number;
  readonly stopMs: number;
  readonly settleMs: number;
  readonly pollMs: number;
  readonly stabilityMs: number;
}

export interface AudioCaptureRequest {
  readonly schema: typeof AUDIO_CAPTURE_REQUEST_SCHEMA;
  readonly project: SavedBitwigProject;
  readonly source: AudioCaptureSource;
  readonly bounds: AudioCaptureBounds;
}

export interface AudioCaptureRecorderStatus {
  readonly isActive: boolean;
  readonly durationMs: number;
  readonly sampledAtMs: number;
  readonly leaseState: 'none' | 'owned' | 'other';
}

interface AudioCaptureRangeObservationBase {
  readonly playbackStartedAtMs: number;
  readonly terminalRangeObservedAtMs: number;
  readonly rangeWrappedAtMs: number;
  readonly transportStoppedAtMs: number;
}

export type AudioCaptureRangeObservation = AudioCaptureRangeObservationBase & ({
  readonly observationBasis: 'playing-step-v0';
  readonly terminalStep: number;
  readonly wrappedStep: number;
} | {
  readonly observationBasis: 'slot-transport-beats-v0';
  readonly transportStartBeats: number;
  readonly transportEndBeats: number;
  readonly requiredAdvanceBeats: number;
  readonly observedAdvanceBeats: number;
});

export interface AudioCaptureDiscovery {
  readonly adapterName: 'ghostnote-bitwig-live-adapter';
  readonly adapterVersion: string;
  readonly bitwigVersion: string;
  readonly controllerApiVersion: number;
  readonly extensionVersion: string;
  readonly methodsHash: string;
  readonly deploymentState: 'fresh' | 'unknown';
}

export interface AudioCaptureController {
  discover(signal?: AbortSignal): Promise<AudioCaptureDiscovery>;
  currentGuard(signal?: AbortSignal): Promise<AudioCaptureGuard>;
  recorderStatus(ownerToken: string, signal?: AbortSignal): Promise<AudioCaptureRecorderStatus>;
  prepareSource(request: AudioCaptureRequest, signal?: AbortSignal): Promise<void>;
  startRecorder(ownerToken: string, signal?: AbortSignal): Promise<AudioCaptureRecorderStatus>;
  stopTransport(request: AudioCaptureRequest, signal?: AbortSignal): Promise<void>;
  performRange(request: AudioCaptureRequest, signal?: AbortSignal): Promise<AudioCaptureRangeObservation>;
  stopRecorder(ownerToken: string, signal?: AbortSignal): Promise<AudioCaptureRecorderStatus>;
}

export interface AudioCaptureCandidate {
  readonly absolutePath: string;
  readonly byteCount: number;
  readonly kind: 'file' | 'symlink' | 'other';
  readonly status: 'new' | 'reused-path';
}

export type AudioCaptureFailureStage =
  | 'request-validation' | 'project-association' | 'source-preflight'
  | 'recorder-start' | 'playback' | 'recorder-stop' | 'artifact-settle'
  | 'artifact-hash' | 'header-validation';

export interface AudioCaptureFailure {
  readonly code: 'invalid-request' | 'source-mismatch' | 'capture-ambiguous'
  | 'timeout' | 'verification-failed';
  readonly module: typeof AUDIO_CAPTURE_MODULE_ID;
  readonly stage: AudioCaptureFailureStage;
  readonly sourceSha256: string | null;
  readonly retryCondition: string;
  readonly effects: 'none' | 'known' | 'unknown';
  readonly recorderState: AudioCaptureRecorderStatus | null;
  readonly candidates: readonly AudioCaptureCandidate[];
}

export class AudioCaptureError extends Error {
  constructor(
    message: string,
    readonly failure: AudioCaptureFailure,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'AudioCaptureError';
  }
}

/** An atomic recorder start refused because another recording is active. */
export class AudioCaptureRecorderActiveError extends Error {
  constructor(readonly status: AudioCaptureRecorderStatus) {
    super('the project MasterRecorder is already active');
    this.name = 'AudioCaptureRecorderActiveError';
  }
}

interface FileStamp {
  readonly dev: number;
  readonly ino: number;
  readonly size: number;
  readonly mtimeMs: number;
  readonly ctimeMs: number;
}

interface DirectoryEntry {
  readonly name: string;
  readonly absolutePath: string;
  readonly kind: AudioCaptureCandidate['kind'];
  readonly stamp: FileStamp;
}

export interface AudioCaptureDirectorySnapshot {
  readonly directory: string;
  readonly entries: ReadonlyMap<string, DirectoryEntry>;
}

export interface ProjectAssociationEvidence {
  readonly recordingDirectory: string;
  readonly projectFileSha256: string;
  readonly elapsedMs: number;
}

export interface SettledCaptureFile {
  readonly absolutePath: string;
  readonly bytes: Uint8Array;
  readonly sha256: string;
  readonly header: Pcm24WaveHeader;
  readonly candidates: readonly AudioCaptureCandidate[];
  readonly timingMs: {
    readonly settle: number;
    readonly readAndHash: number;
    readonly header: number;
  };
}

export interface AudioCaptureStorage {
  validateProject(project: SavedBitwigProject): Promise<ProjectAssociationEvidence>;
  snapshot(recordingDirectory: string): Promise<AudioCaptureDirectorySnapshot>;
  settle(
    before: AudioCaptureDirectorySnapshot,
    bounds: AudioCaptureBounds,
    signal?: AbortSignal,
  ): Promise<SettledCaptureFile>;
  candidates(before: AudioCaptureDirectorySnapshot): Promise<readonly AudioCaptureCandidate[]>;
}

class CaptureStorageError extends Error {
  constructor(
    message: string,
    readonly code: AudioCaptureFailure['code'],
    readonly stage: AudioCaptureFailureStage,
    readonly knownCandidates: readonly AudioCaptureCandidate[],
  ) {
    super(message);
    this.name = 'CaptureStorageError';
  }
}

function stampOf(value: Awaited<ReturnType<typeof stat>>): FileStamp {
  return {
    dev: Number(value.dev),
    ino: Number(value.ino),
    size: Number(value.size),
    mtimeMs: Number(value.mtimeMs),
    ctimeMs: Number(value.ctimeMs),
  };
}

function sameStamp(left: FileStamp, right: FileStamp): boolean {
  return left.dev === right.dev && left.ino === right.ino && left.size === right.size
    && left.mtimeMs === right.mtimeMs && left.ctimeMs === right.ctimeMs;
}

async function stableFileHash(path: string, maximumBytes: number): Promise<{
  readonly sha256: string; readonly stamp: FileStamp;
}> {
  const handle = await open(path, 'r');
  try {
    const before = await handle.stat();
    if (!before.isFile() || before.size < 1 || before.size > maximumBytes) {
      throw new Error('the file size is outside its allowed range');
    }
    const digest = createHash('sha256');
    const buffer = Buffer.allocUnsafe(Math.min(1_048_576, before.size));
    let position = 0;
    while (position < before.size) {
      const length = Math.min(buffer.byteLength, before.size - position);
      const read = await handle.read(buffer, 0, length, position);
      if (read.bytesRead !== length) throw new Error('the file ended during hashing');
      digest.update(buffer.subarray(0, read.bytesRead));
      position += read.bytesRead;
    }
    const after = await handle.stat();
    const current = await stat(path);
    const first = stampOf(before);
    if (!sameStamp(first, stampOf(after)) || !sameStamp(first, stampOf(current))) {
      throw new Error('the file changed while it was hashed');
    }
    return { sha256: digest.digest('hex'), stamp: first };
  } finally {
    await handle.close();
  }
}

async function stableArtifactRead(path: string, expected: FileStamp): Promise<Uint8Array> {
  const handle = await open(path, 'r');
  try {
    const before = await handle.stat();
    if (!before.isFile() || !sameStamp(stampOf(before), expected)
        || before.size < 44 || before.size > MAX_AUDIO_ARTIFACT_BYTES) {
      throw new Error('the capture candidate changed before reading');
    }
    const bytes = await handle.readFile();
    const after = await handle.stat();
    const current = await stat(path);
    if (!sameStamp(expected, stampOf(after)) || !sameStamp(expected, stampOf(current))
        || bytes.byteLength !== expected.size) {
      throw new Error('the capture candidate changed while it was read');
    }
    return new Uint8Array(bytes);
  } finally {
    await handle.close();
  }
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted === true) return Promise.reject(new Error('capture was cancelled'));
  return new Promise((resolve, reject) => {
    const done = (): void => {
      signal?.removeEventListener('abort', aborted);
      resolve();
    };
    const timer = setTimeout(done, ms);
    const aborted = (): void => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', aborted);
      reject(new Error('capture was cancelled'));
    };
    signal?.addEventListener('abort', aborted, { once: true });
  });
}

async function scanDirectory(recordingDirectory: string): Promise<AudioCaptureDirectorySnapshot> {
  let names;
  try {
    names = await readdir(recordingDirectory, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { directory: recordingDirectory, entries: new Map() };
    }
    throw error;
  }
  const resolved = await realpath(recordingDirectory);
  if (resolved !== recordingDirectory) throw new Error('the recording directory is not an exact real path');
  const entries = new Map<string, DirectoryEntry>();
  for (const item of names) {
    const absolutePath = join(recordingDirectory, item.name);
    const details = await lstat(absolutePath);
    const kind = details.isSymbolicLink() ? 'symlink' : details.isFile() ? 'file' : 'other';
    entries.set(item.name, { name: item.name, absolutePath, kind, stamp: stampOf(details) });
  }
  return { directory: recordingDirectory, entries };
}

function changedCandidates(
  before: AudioCaptureDirectorySnapshot,
  after: AudioCaptureDirectorySnapshot,
): readonly AudioCaptureCandidate[] {
  const result: AudioCaptureCandidate[] = [];
  for (const entry of after.entries.values()) {
    const previous = before.entries.get(entry.name);
    if (previous === undefined) {
      result.push({
        absolutePath: entry.absolutePath,
        byteCount: entry.stamp.size,
        kind: entry.kind,
        status: 'new',
      });
    } else if (!sameStamp(previous.stamp, entry.stamp) && LOSSLESS_AUDIO.test(entry.name)) {
      result.push({
        absolutePath: entry.absolutePath,
        byteCount: entry.stamp.size,
        kind: entry.kind,
        status: 'reused-path',
      });
    }
  }
  return result.sort((left, right) => left.absolutePath.localeCompare(right.absolutePath));
}

/** Create the local filesystem dependency for audio-capture-v0. */
export function createNodeAudioCaptureStorage(options: {
  readonly beforeArtifactRead?: (path: string) => Promise<void> | void;
  readonly afterArtifactRead?: (path: string) => Promise<void> | void;
} = {}): AudioCaptureStorage {
  return {
    async validateProject(project) {
      const started = performance.now();
      if (!isAbsolute(project.directory) || normalize(project.directory) !== project.directory
          || !isAbsolute(project.projectFile) || normalize(project.projectFile) !== project.projectFile
          || dirname(project.projectFile) !== project.directory || extname(project.projectFile) !== '.bwproject'
          || basename(project.projectFile, '.bwproject') !== project.liveProjectName) {
        throw new CaptureStorageError(
          'the saved project path association is invalid', 'invalid-request',
          'project-association', [],
        );
      }
      try {
        const directory = await stat(project.directory);
        if (!directory.isDirectory() || await realpath(project.directory) !== project.directory
            || await realpath(project.projectFile) !== project.projectFile) {
          throw new Error('the saved project paths are not exact real paths');
        }
        const observed = await stableFileHash(project.projectFile, MAX_CAPTURE_PROJECT_BYTES);
        if (observed.sha256 !== project.projectFileSha256) {
          throw new Error('the saved project file SHA-256 does not match');
        }
        const recordingDirectory = join(project.directory, 'master-recordings');
        try {
          const recording = await stat(recordingDirectory);
          if (!recording.isDirectory() || await realpath(recordingDirectory) !== recordingDirectory) {
            throw new Error('the master-recordings path is not an exact directory');
          }
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
        return {
          recordingDirectory,
          projectFileSha256: observed.sha256,
          elapsedMs: performance.now() - started,
        };
      } catch (error) {
        if (error instanceof CaptureStorageError) throw error;
        throw new CaptureStorageError(
          `cannot establish the saved project association: ${String(error)}`,
          'source-mismatch', 'project-association', [],
        );
      }
    },
    snapshot: scanDirectory,
    async candidates(before) {
      return changedCandidates(before, await scanDirectory(before.directory));
    },
    async settle(before, bounds, signal) {
      const settleStarted = performance.now();
      let stable: { readonly name: string; readonly stamp: FileStamp; readonly since: number } | undefined;
      while (performance.now() - settleStarted < bounds.settleMs) {
        if (signal?.aborted === true) {
          throw new CaptureStorageError('capture settlement was cancelled', 'timeout', 'artifact-settle', [],);
        }
        const after = await scanDirectory(before.directory);
        const candidates = changedCandidates(before, after);
        const reused = candidates.filter((candidate) => candidate.status === 'reused-path');
        const newLossless = candidates.filter((candidate) =>
          candidate.status === 'new' && LOSSLESS_AUDIO.test(candidate.absolutePath));
        if (reused.length > 0) {
          throw new CaptureStorageError(
            'capture reused a path that existed before recording', 'capture-ambiguous',
            'artifact-settle', candidates,
          );
        }
        if (newLossless.length > 1) {
          throw new CaptureStorageError(
            'capture produced more than one new lossless artifact', 'capture-ambiguous',
            'artifact-settle', candidates,
          );
        }
        if (newLossless.length === 1) {
          const candidate = newLossless[0]!;
          const entry = [...after.entries.values()].find((item) => item.absolutePath === candidate.absolutePath)!;
          if (entry.kind !== 'file' || entry.stamp.size < 44
              || entry.stamp.size > MAX_AUDIO_ARTIFACT_BYTES) {
            throw new CaptureStorageError(
              'the capture candidate is not a bounded regular audio file',
              'verification-failed', 'artifact-settle', candidates,
            );
          }
          if (stable === undefined || stable.name !== entry.name || !sameStamp(stable.stamp, entry.stamp)) {
            stable = { name: entry.name, stamp: entry.stamp, since: performance.now() };
          } else if (performance.now() - stable.since >= bounds.stabilityMs) {
            await options.beforeArtifactRead?.(entry.absolutePath);
            const readStarted = performance.now();
            const settle = readStarted - settleStarted;
            let bytes: Uint8Array;
            try {
              bytes = await stableArtifactRead(entry.absolutePath, entry.stamp);
            } catch (error) {
              throw new CaptureStorageError(
                `the capture candidate changed during hashing: ${String(error)}`,
                'source-mismatch', 'artifact-hash', candidates,
              );
            }
            const sha256 = createHash('sha256').update(bytes).digest('hex');
            const readAndHash = performance.now() - readStarted;
            const headerStarted = performance.now();
            let header: Pcm24WaveHeader;
            try {
              header = readPcm24WaveHeader(bytes);
            } catch (error) {
              throw new CaptureStorageError(
                `the capture header is unsupported: ${String(error)}`,
                'verification-failed', 'header-validation', candidates,
              );
            }
            const headerElapsed = performance.now() - headerStarted;
            await options.afterArtifactRead?.(entry.absolutePath);
            const finalDirectory = await scanDirectory(before.directory);
            const finalCandidates = changedCandidates(before, finalDirectory);
            const finalEntry = finalDirectory.entries.get(entry.name);
            if (finalCandidates.length !== candidates.length
                || finalCandidates.some((candidate, index) =>
                  candidate.absolutePath !== candidates[index]?.absolutePath
                  || candidate.byteCount !== candidates[index]?.byteCount)
                || finalEntry === undefined || !sameStamp(entry.stamp, finalEntry.stamp)) {
              throw new CaptureStorageError(
                'the capture directory changed during artifact verification',
                'source-mismatch', 'artifact-hash', finalCandidates,
              );
            }
            return {
              absolutePath: entry.absolutePath,
              bytes,
              sha256,
              header,
              candidates,
              timingMs: {
                settle,
                readAndHash,
                header: headerElapsed,
              },
            };
          }
        }
        await delay(bounds.pollMs, signal);
      }
      const candidates = changedCandidates(before, await scanDirectory(before.directory));
      const lossless = candidates.filter((candidate) => LOSSLESS_AUDIO.test(candidate.absolutePath));
      throw new CaptureStorageError(
        lossless.length === 0
          ? 'capture produced no new lossless artifact'
          : 'the capture artifact did not settle before its deadline',
        lossless.length === 0 ? 'capture-ambiguous' : 'timeout',
        'artifact-settle', candidates,
      );
    },
  };
}

function canonicalSourceManifest(manifest: AudioCaptureSourceManifest): AudioCaptureSourceManifest {
  return {
    schema: AUDIO_CAPTURE_SOURCE_SCHEMA,
    sourceId: manifest.sourceId,
    sourceKind: 'project-master-during-launcher-clip',
    projectFileSha256: manifest.projectFileSha256,
    launcherClip: {
      kind: 'clip',
      slot: {
        kind: 'slot',
        track: { kind: 'track', channelId: manifest.launcherClip.slot.track.channelId },
        scene: {
          kind: 'scene',
          index: manifest.launcherClip.slot.scene.index,
          epoch: manifest.launcherClip.slot.scene.epoch,
        },
      },
    },
    guard: {
      generation: manifest.guard.generation,
      project: manifest.guard.project,
      revision: manifest.guard.revision,
      sceneEpoch: manifest.guard.sceneEpoch,
      contentEpoch: manifest.guard.contentEpoch,
    },
    range: {
      policy: 'one-launcher-loop-from-start-v0',
      startBeats: manifest.range.startBeats,
      endBeats: manifest.range.endBeats,
      stepSizeBeats: 0.25,
    },
    permissionBasis: manifest.permissionBasis,
    coverage: {
      masterSource: 'project-master',
      launcherClipRole: 'range-trigger',
      otherProjectOutput: 'not-excluded',
    },
  };
}

/** Create the exact source-manifest identity used for request correlation. */
export function audioCaptureSource(manifest: AudioCaptureSourceManifest): AudioCaptureSource {
  const canonical = canonicalSourceManifest(manifest);
  return {
    manifest: canonical,
    sha256: createHash('sha256').update(JSON.stringify(canonical)).digest('hex'),
    digestDomain: 'audio-capture-source-v0',
    canonicalizationVersion: 'capture-source-json-v0',
  };
}

function validClipAddress(clip: ClipAddress): boolean {
  return clip?.kind === 'clip' && clip.slot?.kind === 'slot'
    && clip.slot.track?.kind === 'track' && typeof clip.slot.track.channelId === 'string'
    && clip.slot.track.channelId.length > 0 && clip.slot.scene?.kind === 'scene'
    && Number.isSafeInteger(clip.slot.scene.index) && clip.slot.scene.index >= 0
    && Number.isSafeInteger(clip.slot.scene.epoch) && clip.slot.scene.epoch >= 0;
}

function validateCaptureRequest(request: AudioCaptureRequest): void {
  const manifest = request?.source?.manifest;
  const bounds = request?.bounds;
  const project = request?.project;
  if (request?.schema !== AUDIO_CAPTURE_REQUEST_SCHEMA || project?.schema !== AUDIO_CAPTURE_PROJECT_SCHEMA
      || manifest?.schema !== AUDIO_CAPTURE_SOURCE_SCHEMA || !SOURCE_ID.test(manifest.sourceId)
      || manifest.sourceKind !== 'project-master-during-launcher-clip'
      || !SHA256.test(project.projectFileSha256) || !SHA256.test(manifest.projectFileSha256)
      || manifest.projectFileSha256 !== project.projectFileSha256
      || typeof project.liveProjectName !== 'string' || project.liveProjectName.length === 0
      || project.liveProjectName !== manifest.guard.project
      || typeof project.permissionBasis !== 'string' || project.permissionBasis.trim().length === 0
      || typeof manifest.permissionBasis !== 'string' || manifest.permissionBasis.trim().length === 0
      || project.associationBasis !== 'operator-established-path-plus-live-guard-v0'
      || request.source.digestDomain !== 'audio-capture-source-v0'
      || request.source.canonicalizationVersion !== 'capture-source-json-v0'
      || !SHA256.test(request.source.sha256) || !validClipAddress(manifest.launcherClip)
      || typeof manifest.guard.generation !== 'string' || manifest.guard.generation.length === 0
      || !Number.isSafeInteger(manifest.guard.revision) || manifest.guard.revision < 0
      || !Number.isSafeInteger(manifest.guard.sceneEpoch) || manifest.guard.sceneEpoch < 0
      || !Number.isSafeInteger(manifest.guard.contentEpoch) || manifest.guard.contentEpoch < 0
      || manifest.range.policy !== 'one-launcher-loop-from-start-v0'
      || !Number.isFinite(manifest.range.startBeats) || manifest.range.startBeats < 0
      || manifest.range.stepSizeBeats !== 0.25
      || !Number.isFinite(manifest.range.endBeats) || manifest.range.endBeats < 2
      || manifest.range.startBeats >= manifest.range.endBeats
      || manifest.range.endBeats > 32 || !Number.isSafeInteger(manifest.range.endBeats / 0.25)
      || manifest.coverage.masterSource !== 'project-master'
      || manifest.coverage.launcherClipRole !== 'range-trigger'
      || manifest.coverage.otherProjectOutput !== 'not-excluded'
      || typeof bounds !== 'object' || bounds === null
      || !Number.isSafeInteger(bounds.activationMs) || bounds.activationMs < 100 || bounds.activationMs > 5_000
      || !Number.isSafeInteger(bounds.playbackMs) || bounds.playbackMs < 1_000 || bounds.playbackMs > 60_000
      || !Number.isSafeInteger(bounds.stopMs) || bounds.stopMs < 100 || bounds.stopMs > 5_000
      || !Number.isSafeInteger(bounds.settleMs) || bounds.settleMs < 100 || bounds.settleMs > 10_000
      || !Number.isSafeInteger(bounds.pollMs) || bounds.pollMs < 10 || bounds.pollMs > 100
      || !Number.isSafeInteger(bounds.stabilityMs) || bounds.stabilityMs < 50
      || bounds.stabilityMs > 1_000 || bounds.stabilityMs >= bounds.settleMs) {
    throw new AudioCaptureError('the audio capture request is invalid', {
      code: 'invalid-request', module: AUDIO_CAPTURE_MODULE_ID, stage: 'request-validation',
      sourceSha256: request?.source?.sha256 ?? null,
      retryCondition: 'Supply a complete supported audio-capture-v0 request.',
      effects: 'none', recorderState: null, candidates: [],
    });
  }
  const expected = audioCaptureSource(manifest).sha256;
  if (request.source.sha256 !== expected) {
    throw new AudioCaptureError('the capture source manifest SHA-256 does not match', {
      code: 'source-mismatch', module: AUDIO_CAPTURE_MODULE_ID, stage: 'request-validation',
      sourceSha256: request.source.sha256,
      retryCondition: 'Rebuild the source manifest from fresh guarded state.',
      effects: 'none', recorderState: null, candidates: [],
    });
  }
}

export function audioCaptureRequest(
  project: SavedBitwigProject,
  source: AudioCaptureSource,
  bounds: AudioCaptureBounds,
): AudioCaptureRequest {
  const request = {
    schema: AUDIO_CAPTURE_REQUEST_SCHEMA,
    project: structuredClone(project),
    source: structuredClone(source),
    bounds: structuredClone(bounds),
  } as const;
  validateCaptureRequest(request);
  return request;
}

function sameGuard(left: AudioCaptureGuard, right: AudioCaptureGuard): boolean {
  return left.generation === right.generation && left.project === right.project
    && left.revision === right.revision && left.sceneEpoch === right.sceneEpoch
    && left.contentEpoch === right.contentEpoch;
}

async function waitForRecorder(
  controller: AudioCaptureController,
  ownerToken: string,
  active: boolean,
  boundMs: number,
  pollMs: number,
  signal?: AbortSignal,
): Promise<AudioCaptureRecorderStatus> {
  const deadline = performance.now() + boundMs;
  let status = await controller.recorderStatus(ownerToken, signal);
  if (performance.now() > deadline) {
    throw new Error(`MasterRecorder did not become ${active ? 'active' : 'inactive'} in time`);
  }
  const settled = (): boolean => active
    ? status.isActive && status.leaseState === 'owned'
    : !status.isActive && status.leaseState === 'none';
  while (!settled()) {
    if (status.leaseState === 'other') {
      throw new Error('the MasterRecorder lease changed during capture');
    }
    if (signal?.aborted === true || performance.now() >= deadline) {
      throw new Error(`MasterRecorder did not become ${active ? 'active' : 'inactive'} in time`);
    }
    await delay(pollMs, signal);
    status = await controller.recorderStatus(ownerToken, signal);
    if (performance.now() > deadline) {
      throw new Error(`MasterRecorder did not become ${active ? 'active' : 'inactive'} in time`);
    }
  }
  return status;
}

export interface AudioCaptureResult {
  readonly schema: typeof AUDIO_CAPTURE_RESULT_SCHEMA;
  readonly source: AudioCaptureSource;
  readonly project: SavedBitwigProject;
  readonly requestedRange: AudioCaptureRange;
  readonly observedRange: AudioCaptureRangeObservation;
  readonly artifact: AudioArtifactDeclaration;
  readonly captureArtifact: {
    readonly sourceSha256: string;
    readonly requestedRange: AudioCaptureRange;
    readonly absolutePath: string;
    readonly mediaType: 'audio/wav';
    readonly byteCount: number;
    readonly sha256: string;
    readonly format: AudioArtifactDeclaration['format'];
    readonly channels: 2;
    readonly sampleRateHz: 44_100;
    readonly durationSeconds: number;
    readonly recorderDurationMs: number;
    readonly providerVersions: Readonly<Record<string, string>>;
  };
  readonly provider: AudioCaptureDiscovery & {
    readonly name: 'ghostnote-bitwig-master-recorder';
    readonly version: typeof AUDIO_CAPTURE_PROVIDER_VERSION;
    readonly headerReader: 'ghostnote-pcm24-wave-header';
    readonly headerReaderVersion: typeof AUDIO_CAPTURE_HEADER_READER_VERSION;
  };
  readonly coverage: {
    readonly musicalRangeComplete: true;
    readonly sampleRange: { readonly start: 0; readonly end: number };
    readonly channelIndices: readonly [0, 1];
    readonly sampleAlignment: 'not-proved';
    readonly captureLeadMs: number;
    readonly captureTailMs: number;
  };
  readonly ownership: {
    readonly creator: 'ghostnote-audio-capture';
    readonly scope: 'one-created-project-local-file';
    readonly evidence: readonly string[];
  };
  readonly warnings: readonly string[];
  readonly timingMs: {
    readonly projectAssociation: number;
    readonly sourcePreflight: number;
    readonly directorySnapshot: number;
    readonly recorderActivation: number;
    readonly playback: number;
    readonly recorderStop: number;
    readonly artifactSettlement: number;
    readonly artifactReadAndHash: number;
    readonly headerValidation: number;
    readonly total: number;
  };
}

function failureFor(
  request: AudioCaptureRequest,
  stage: AudioCaptureFailureStage,
  code: AudioCaptureFailure['code'],
  effects: AudioCaptureFailure['effects'],
  recorderState: AudioCaptureRecorderStatus | null,
  candidates: readonly AudioCaptureCandidate[],
): AudioCaptureFailure {
  return {
    code,
    module: AUDIO_CAPTURE_MODULE_ID,
    stage,
    sourceSha256: request.source.sha256,
    retryCondition: code === 'source-mismatch'
      ? 'Refresh the saved-project and live-source guards before retrying.'
      : code === 'capture-ambiguous'
        ? 'Remove owned candidates, restore the baseline, and start a new capture.'
        : code === 'timeout'
          ? 'Inspect recorder and candidate state before a new capture.'
          : 'Correct the failed capture precondition before retrying.',
    effects,
    recorderState,
    candidates,
  };
}

/** Capture one guarded launcher loop without starting an analysis provider. */
export async function captureMasterArtifact(
  controller: AudioCaptureController,
  discovery: AudioCaptureDiscovery,
  storage: AudioCaptureStorage,
  request: AudioCaptureRequest,
  signal?: AbortSignal,
): Promise<AudioCaptureResult> {
  validateCaptureRequest(request);
  const totalStarted = performance.now();
  let stage: AudioCaptureFailureStage = 'project-association';
  let before: AudioCaptureDirectorySnapshot | undefined;
  let startAttempted = false;
  let started = false;
  let stopped = false;
  let transportCleanupComplete = true;
  let lastStatus: AudioCaptureRecorderStatus | null = null;
  let activeStatus: AudioCaptureRecorderStatus | null = null;
  let rangeStatus: AudioCaptureRecorderStatus | null = null;
  const ownerToken = randomUUID();
  const timing = {
    projectAssociation: 0, sourcePreflight: 0, directorySnapshot: 0,
    recorderActivation: 0, playback: 0, recorderStop: 0,
  };
  try {
    const association = await storage.validateProject(request.project);
    timing.projectAssociation = association.elapsedMs;

    stage = 'source-preflight';
    const sourceStarted = performance.now();
    const guard = await controller.currentGuard(signal);
    if (!sameGuard(guard, request.source.manifest.guard)) {
      throw new AudioCaptureError('the live capture guard no longer matches',
        failureFor(request, stage, 'source-mismatch', 'none', null, []));
    }
    lastStatus = await controller.recorderStatus(ownerToken, signal);
    if (lastStatus.isActive || lastStatus.leaseState !== 'none') {
      throw new AudioCaptureError('the MasterRecorder is already active',
        failureFor(request, stage, 'verification-failed', 'none', lastStatus, []));
    }
    await controller.prepareSource(request, signal);
    timing.sourcePreflight = performance.now() - sourceStarted;

    const snapshotStarted = performance.now();
    before = await storage.snapshot(association.recordingDirectory);
    timing.directorySnapshot = performance.now() - snapshotStarted;

    stage = 'recorder-start';
    const activationStarted = performance.now();
    startAttempted = true;
    try {
      lastStatus = await controller.startRecorder(ownerToken, signal);
      started = true;
    } catch (error) {
      if (error instanceof AudioCaptureRecorderActiveError) {
        startAttempted = false;
        lastStatus = error.status;
        throw new AudioCaptureError('the MasterRecorder became active before capture started',
          failureFor(request, stage, 'verification-failed', 'none', lastStatus, []),
          { cause: error });
      }
      throw error;
    }
    activeStatus = await waitForRecorder(
      controller, ownerToken, true, request.bounds.activationMs, request.bounds.pollMs, signal,
    );
    lastStatus = activeStatus;
    timing.recorderActivation = performance.now() - activationStarted;

    stage = 'playback';
    const playbackStarted = performance.now();
    transportCleanupComplete = false;
    await controller.stopTransport(request, signal);
    const observedRange = await controller.performRange(request, signal);
    transportCleanupComplete = true;
    timing.playback = performance.now() - playbackStarted;
    rangeStatus = await controller.recorderStatus(ownerToken, signal);
    lastStatus = rangeStatus;
    const observedRangeMs = observedRange.rangeWrappedAtMs - observedRange.playbackStartedAtMs;
    const observationInvalid = observedRange.observationBasis === 'playing-step-v0'
      ? (() => {
        const steps = request.source.manifest.range.endBeats
          / request.source.manifest.range.stepSizeBeats;
        return observedRange.terminalStep < steps - 4 || observedRange.terminalStep >= steps
          || observedRange.wrappedStep < 0 || observedRange.wrappedStep > 3;
      })()
      : observedRange.requiredAdvanceBeats !== request.source.manifest.range.endBeats
        || observedRange.observedAdvanceBeats < observedRange.requiredAdvanceBeats
        || observedRange.transportEndBeats < observedRange.transportStartBeats;
    if (!rangeStatus.isActive || rangeStatus.leaseState !== 'owned'
        || observedRange.playbackStartedAtMs > observedRange.terminalRangeObservedAtMs
        || observedRange.terminalRangeObservedAtMs > observedRange.rangeWrappedAtMs
        || observedRange.rangeWrappedAtMs > observedRange.transportStoppedAtMs
        || observationInvalid
        || observedRangeMs < 1
        || rangeStatus.durationMs + AUDIO_CAPTURE_DURATION_TOLERANCE_MS < observedRangeMs) {
      throw new Error('the recorder did not preserve the complete observed launcher range');
    }

    stage = 'recorder-stop';
    const stopStarted = performance.now();
    await controller.stopRecorder(ownerToken, signal);
    lastStatus = await waitForRecorder(
      controller, ownerToken, false, request.bounds.stopMs, request.bounds.pollMs, signal,
    );
    stopped = true;
    timing.recorderStop = performance.now() - stopStarted;

    stage = 'artifact-settle';
    const captured = await storage.settle(before, request.bounds, signal);
    stage = 'header-validation';
    const declaration: AudioArtifactDeclaration = {
      schema: AUDIO_ARTIFACT_SCHEMA,
      sourceId: request.source.manifest.sourceId,
      absolutePath: captured.absolutePath,
      mediaType: 'audio/wav',
      byteCount: captured.bytes.byteLength,
      sha256: captured.sha256,
      digestDomain: 'file-bytes',
      creator: 'ghostnote-audio-capture',
      permissionBasis: request.project.permissionBasis,
      format: {
        container: 'wav', codec: 'pcm_s24le', sampleRateHz: 44_100,
        channels: 2, bitsPerSample: 24,
      },
      scope: {
        sampleRange: { start: 0, end: captured.header.sampleCount },
        channelIndices: [0, 1],
      },
    };
    const durationMs = captured.header.sampleCount / captured.header.sampleRateHz * 1_000;
    if (durationMs < observedRangeMs || rangeStatus === null
        || Math.abs(durationMs - rangeStatus.durationMs) > AUDIO_CAPTURE_DURATION_TOLERANCE_MS) {
      throw new Error('the capture file duration does not match the owned recorder duration');
    }
    const finalGuard = await controller.currentGuard(signal);
    if (!sameGuard(finalGuard, request.source.manifest.guard)) {
      throw new AudioCaptureError('the live capture guard changed during capture',
        failureFor(request, 'artifact-hash', 'source-mismatch', 'unknown', lastStatus,
          captured.candidates));
    }
    const lead = Math.max(0, observedRange.playbackStartedAtMs - activeStatus.sampledAtMs);
    const tail = Math.max(0, lastStatus.sampledAtMs - observedRange.rangeWrappedAtMs);
    const providerVersions = {
      adapter: discovery.adapterVersion,
      bitwig: discovery.bitwigVersion,
      controllerApi: String(discovery.controllerApiVersion),
      extension: discovery.extensionVersion,
      methodsHash: discovery.methodsHash,
      deployment: discovery.deploymentState,
      captureProvider: AUDIO_CAPTURE_PROVIDER_VERSION,
      headerReader: AUDIO_CAPTURE_HEADER_READER_VERSION,
    };
    return {
      schema: AUDIO_CAPTURE_RESULT_SCHEMA,
      source: structuredClone(request.source),
      project: structuredClone(request.project),
      requestedRange: structuredClone(request.source.manifest.range),
      observedRange,
      artifact: structuredClone(declaration),
      captureArtifact: {
        sourceSha256: request.source.sha256,
        requestedRange: structuredClone(request.source.manifest.range),
        absolutePath: declaration.absolutePath,
        mediaType: declaration.mediaType,
        byteCount: declaration.byteCount,
        sha256: declaration.sha256,
        format: structuredClone(declaration.format),
        channels: 2,
        sampleRateHz: 44_100,
        durationSeconds: captured.header.sampleCount / captured.header.sampleRateHz,
        recorderDurationMs: rangeStatus.durationMs,
        providerVersions,
      },
      provider: {
        ...discovery,
        name: 'ghostnote-bitwig-master-recorder',
        version: AUDIO_CAPTURE_PROVIDER_VERSION,
        headerReader: 'ghostnote-pcm24-wave-header',
        headerReaderVersion: AUDIO_CAPTURE_HEADER_READER_VERSION,
      },
      coverage: {
        musicalRangeComplete: true,
        sampleRange: { start: 0, end: captured.header.sampleCount },
        channelIndices: [0, 1],
        sampleAlignment: 'not-proved',
        captureLeadMs: lead,
        captureTailMs: tail,
      },
      ownership: {
        creator: 'ghostnote-audio-capture',
        scope: 'one-created-project-local-file',
        evidence: [
          'The path was absent from the pre-start master-recordings snapshot.',
          'Exactly one stable regular lossless file appeared after recorder stop.',
          'Stable read, full byte SHA-256, and PCM WAVE header validation passed.',
        ],
      },
      warnings: [
        'Bitwig exposes no loaded-project path. Association uses an operator-established exact '
          + 'project file plus the live project detector and source guard.',
        'The launcher clip controls the musical range. Other project-master output is not excluded.',
        'The musical range does not prove sample-exact start or stop alignment.',
      ],
      timingMs: {
        ...timing,
        artifactSettlement: captured.timingMs.settle,
        artifactReadAndHash: captured.timingMs.readAndHash,
        headerValidation: captured.timingMs.header,
        total: performance.now() - totalStarted,
      },
    };
  } catch (error) {
    if (!transportCleanupComplete) {
      try {
        await controller.stopTransport(request);
        transportCleanupComplete = true;
      } catch {
        // The effects verdict below records unconfirmed transport cleanup.
      }
    }
    if ((startAttempted || started) && !stopped) {
      try {
        await controller.stopRecorder(ownerToken);
        lastStatus = await waitForRecorder(
          controller, ownerToken, false, request.bounds.stopMs, request.bounds.pollMs,
        );
        stopped = true;
      } catch {
        try {
          lastStatus = await controller.recorderStatus(ownerToken);
        } catch {
          lastStatus = null;
        }
      }
    }
    const storageError = error instanceof CaptureStorageError ? error : undefined;
    let candidates: readonly AudioCaptureCandidate[] = storageError?.knownCandidates ?? [];
    let candidateStateKnown = storageError !== undefined;
    if (before !== undefined) {
      try {
        candidates = await storage.candidates(before);
        candidateStateKnown = true;
      } catch {
        // Candidate state is unknown and the effects verdict below records it.
        candidateStateKnown = false;
      }
    }
    if (error instanceof AudioCaptureError) throw error;
    let continuityLost = false;
    if (startAttempted) {
      try {
        continuityLost = !sameGuard(
          await controller.currentGuard(), request.source.manifest.guard,
        );
      } catch {
        continuityLost = true;
      }
    }
    const effects = !startAttempted ? 'none'
      : stopped && transportCleanupComplete && before !== undefined
          && candidateStateKnown && !continuityLost
        ? 'known' : 'unknown';
    const failure = failureFor(
      request,
      storageError?.stage ?? stage,
      storageError?.code ?? (signal?.aborted === true ? 'timeout' : 'verification-failed'),
      effects,
      lastStatus,
      candidates,
    );
    throw new AudioCaptureError(
      error instanceof Error ? error.message : String(error), failure, { cause: error },
    );
  }
}

export interface AudioCaptureModuleOptions {
  readonly controller: AudioCaptureController;
  readonly storage?: AudioCaptureStorage;
  readonly onTiming?: (event: { readonly phase: string; readonly elapsedMs: number }) => void;
}

/** Create the lazy, state-changing audio-capture-v0 workstation module. */
export function audioCaptureModule(
  options: AudioCaptureModuleOptions,
): WorkstationModule<AudioCaptureRequest, AudioCaptureResult> {
  const storage = options.storage ?? createNodeAudioCaptureStorage();
  let discovery: AudioCaptureDiscovery | undefined;
  return {
    descriptor: {
      moduleId: AUDIO_CAPTURE_MODULE_ID,
      version: AUDIO_CAPTURE_MODULE_VERSION,
      acceptedSchemas: [AUDIO_CAPTURE_REQUEST_SCHEMA],
      emittedSchemas: [AUDIO_CAPTURE_RESULT_SCHEMA],
      capabilities: ['capture-launcher-loop-v0'],
      startupDeadlineMs: AUDIO_CAPTURE_STARTUP_DEADLINE_MS,
      requestDeadlineMs: AUDIO_CAPTURE_REQUEST_DEADLINE_MS,
    },
    preflight: async (request) => {
      try {
        validateCaptureRequest(request.payload);
        if (request.sourceSha256 !== request.payload.source.sha256) {
          throw new AudioCaptureError('the module correlation digest does not match the capture source',
            failureFor(request.payload, 'request-validation', 'source-mismatch', 'none', null, []));
        }
        await storage.validateProject(request.payload.project);
      } catch (error) {
        const capture = error instanceof AudioCaptureError ? error
          : error instanceof CaptureStorageError
            ? new AudioCaptureError(error.message, failureFor(
              request.payload, error.stage, error.code, 'none', null, error.knownCandidates,
            ), { cause: error })
            : undefined;
        if (capture !== undefined) {
          throw new WorkstationModuleError(
            capture.message,
            capture.failure.code === 'source-mismatch' ? 'source-mismatch'
              : capture.failure.code === 'capture-ambiguous' ? 'capture-ambiguous'
                : capture.failure.code === 'timeout' ? 'timeout' : 'verification-failed',
            AUDIO_CAPTURE_MODULE_ID,
            { cause: capture },
          );
        }
        throw error;
      }
    },
    start: async (signal): Promise<ModuleHealth> => {
      const started = performance.now();
      discovery = await options.controller.discover(signal);
      options.onTiming?.({ phase: 'bitwig-discovery', elapsedMs: performance.now() - started });
      if (discovery.controllerApiVersion < 20) {
        throw new Error('audio-capture-v0 requires Bitwig Controller API 20 or later');
      }
      return {
        state: 'available',
        capabilities: ['capture-launcher-loop-v0'],
        missingCapabilities: [],
        dependencyVersions: {
          bitwig: discovery.bitwigVersion,
          controllerApi: String(discovery.controllerApiVersion),
          extension: discovery.extensionVersion,
          adapter: discovery.adapterVersion,
          methodsHash: discovery.methodsHash,
          deployment: discovery.deploymentState,
          headerReader: AUDIO_CAPTURE_HEADER_READER_VERSION,
          node: process.versions.node,
        },
      };
    },
    handle: async (request, signal) => {
      if (discovery === undefined) {
        throw new WorkstationModuleError(
          'the audio capture module did not start', 'missing-dependency', AUDIO_CAPTURE_MODULE_ID,
        );
      }
      try {
        const currentDiscovery = await options.controller.discover(signal);
        return {
          schema: WORKSTATION_RESPONSE_SCHEMA,
          requestId: request.requestId,
          sourceSha256: request.sourceSha256,
          outputSchema: AUDIO_CAPTURE_RESULT_SCHEMA,
          payload: await captureMasterArtifact(
            options.controller, currentDiscovery, storage, request.payload, signal,
          ),
        };
      } catch (error) {
        if (error instanceof AudioCaptureError) {
          throw new WorkstationModuleError(
            error.message,
            error.failure.code === 'source-mismatch' ? 'source-mismatch'
              : error.failure.code === 'capture-ambiguous' ? 'capture-ambiguous'
                : error.failure.code === 'timeout' ? 'timeout' : 'verification-failed',
            AUDIO_CAPTURE_MODULE_ID,
            { cause: error },
          );
        }
        throw error;
      }
    },
  };
}

export interface CaptureAndAnalysisResult {
  readonly capture: WorkstationResponse<AudioCaptureResult>;
  readonly analysis:
  | { readonly ok: true; readonly response: WorkstationResponse<AudioFactsResult> }
  | { readonly ok: false; readonly error: unknown };
}

/** Compose capture and analysis as two explicit registry requests. */
export async function captureAndAnalyze(
  registry: WorkstationModuleRegistry,
  captureRequest: WorkstationRequest<AudioCaptureRequest>,
  analysisRequestId: string,
  task: AudioFactsTask,
): Promise<CaptureAndAnalysisResult> {
  const capture = await registry.request<AudioCaptureRequest, AudioCaptureResult>(
    AUDIO_CAPTURE_MODULE_ID, captureRequest,
  );
  try {
    const verified = await verifyAudioArtifact(capture.payload.artifact);
    const analysisPayload: AudioFactsRequest = {
      schema: AUDIO_FACTS_REQUEST_SCHEMA,
      artifact: verified,
      task: structuredClone(task),
    };
    const response = await registry.request<AudioFactsRequest, AudioFactsResult>(
      AUDIO_FACTS_MODULE_ID,
      {
        schema: WORKSTATION_REQUEST_SCHEMA,
        requestId: analysisRequestId,
        inputSchema: AUDIO_FACTS_REQUEST_SCHEMA,
        sourceSha256: capture.payload.artifact.sha256,
        payload: analysisPayload,
      },
    );
    if (response.outputSchema !== AUDIO_FACTS_RESULT_SCHEMA) {
      throw new Error('the audio facts response schema is invalid');
    }
    return { capture, analysis: { ok: true, response } };
  } catch (error) {
    return { capture, analysis: { ok: false, error } };
  }
}
