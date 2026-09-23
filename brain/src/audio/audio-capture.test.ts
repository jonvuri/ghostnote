import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';

import {
  AUDIO_CAPTURE_MODULE_ID, AUDIO_CAPTURE_PROJECT_SCHEMA, AUDIO_CAPTURE_REQUEST_SCHEMA,
  AUDIO_CAPTURE_RESULT_SCHEMA, AUDIO_CAPTURE_SOURCE_SCHEMA, AUDIO_FACTS_MODULE_ID,
  AUDIO_FACTS_REQUEST_SCHEMA, AUDIO_FACTS_RESULT_SCHEMA, AUDIO_PROPERTY_DEFINITIONS,
  AudioCaptureError, AudioCaptureRecorderActiveError, audioCaptureModule,
  audioCaptureRequest, audioCaptureSource,
  captureAndAnalyze, createNodeAudioCaptureStorage,
  type AudioCaptureController, type AudioCaptureDiscovery, type AudioCaptureGuard,
  type AudioCaptureRangeObservation, type AudioCaptureRecorderStatus,
  type AudioCaptureRequest, type AudioCaptureResult, type AudioFactsRequest,
  type AudioFactsResult, type SavedBitwigProject,
} from './index.js';
import {
  WORKSTATION_REQUEST_SCHEMA, WORKSTATION_RESPONSE_SCHEMA, WorkstationModuleError,
  WorkstationModuleRegistry, type WorkstationModule,
} from '../workstation/index.js';

const LIVE_NAME = 'gn-7e-audio-capture';
const GUARD: AudioCaptureGuard = {
  generation: 'generation-7e', project: LIVE_NAME,
  revision: 7, sceneEpoch: 4, contentEpoch: 11,
};
const DISCOVERY: AudioCaptureDiscovery = {
  adapterName: 'ghostnote-bitwig-live-adapter',
  adapterVersion: 'ghostnote/0',
  bitwigVersion: '6.0.6',
  controllerApiVersion: 25,
  extensionVersion: '0.0.1',
  methodsHash: '78368fe47ea0e814',
  deploymentState: 'fresh',
};

function digest(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function pcm24Wav(sampleCount = 198_450): Buffer {
  const dataBytes = sampleCount * 2 * 3;
  const output = Buffer.alloc(44 + dataBytes);
  output.write('RIFF', 0, 'ascii');
  output.writeUInt32LE(output.byteLength - 8, 4);
  output.write('WAVE', 8, 'ascii');
  output.write('fmt ', 12, 'ascii');
  output.writeUInt32LE(16, 16);
  output.writeUInt16LE(1, 20);
  output.writeUInt16LE(2, 22);
  output.writeUInt32LE(44_100, 24);
  output.writeUInt32LE(44_100 * 6, 28);
  output.writeUInt16LE(6, 32);
  output.writeUInt16LE(24, 34);
  output.write('data', 36, 'ascii');
  output.writeUInt32LE(dataBytes, 40);
  for (let sample = 0; sample < sampleCount; sample += 1) {
    const value = Math.round(Math.sin(sample * 0.03) * 400_000);
    output.writeIntLE(value, 44 + sample * 6, 3);
    output.writeIntLE(value, 47 + sample * 6, 3);
  }
  return output;
}

interface Fixture {
  readonly project: SavedBitwigProject;
  readonly recordingDirectory: string;
  readonly request: AudioCaptureRequest;
}

async function fixture(t: TestContext): Promise<Fixture> {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'ghostnote-capture-test-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  const projectFile = join(root, `${LIVE_NAME}.bwproject`);
  const projectBytes = Buffer.from('owned disposable Bitwig project fixture');
  await writeFile(projectFile, projectBytes);
  const recordingDirectory = join(root, 'master-recordings');
  await mkdir(recordingDirectory);
  const project: SavedBitwigProject = {
    schema: AUDIO_CAPTURE_PROJECT_SCHEMA,
    directory: root,
    projectFile,
    projectFileSha256: digest(projectBytes),
    liveProjectName: LIVE_NAME,
    permissionBasis: 'owned disposable test project',
    associationBasis: 'operator-established-path-plus-live-guard-v0',
  };
  const source = audioCaptureSource({
    schema: AUDIO_CAPTURE_SOURCE_SCHEMA,
    sourceId: 'capture-7e-source',
    sourceKind: 'project-master-during-launcher-clip',
    projectFileSha256: project.projectFileSha256,
    launcherClip: {
      kind: 'clip',
      slot: {
        kind: 'slot',
        track: { kind: 'track', channelId: 'owned-track-7e' },
        scene: { kind: 'scene', index: 0, epoch: GUARD.sceneEpoch },
      },
    },
    guard: GUARD,
    range: {
      policy: 'one-launcher-loop-from-start-v0',
      startBeats: 0,
      endBeats: 8,
      stepSizeBeats: 0.25,
    },
    permissionBasis: 'owned launcher clip and project master output',
    coverage: {
      masterSource: 'project-master',
      launcherClipRole: 'range-trigger',
      otherProjectOutput: 'not-excluded',
    },
  });
  return {
    project,
    recordingDirectory,
    request: audioCaptureRequest(project, source, {
      activationMs: 100,
      playbackMs: 1_000,
      stopMs: 100,
      settleMs: 150,
      pollMs: 10,
      stabilityMs: 50,
    }),
  };
}

class FakeCaptureController implements AudioCaptureController {
  readonly calls: string[] = [];
  active: boolean;
  guard: AudioCaptureGuard = GUARD;
  stickActiveAfterStop = false;
  activateOnStart = true;
  refuseStart = false;
  dropDuringRange = false;
  changeGuardDuringRange = false;
  failRange: Error | undefined;
  failTransportStopOnCall: number | undefined;
  delayActiveStatusMs = 0;
  durationMs = 4_500;
  failPrepare: Error | undefined;
  onStop: (() => Promise<void>) | undefined;
  private sampledAtMs = 1_000;
  private ownerToken: string | undefined;

  constructor(active = false) {
    this.active = active;
  }

  async discover(): Promise<AudioCaptureDiscovery> {
    this.calls.push('discover');
    return DISCOVERY;
  }

  async currentGuard(): Promise<AudioCaptureGuard> {
    this.calls.push('guard');
    return this.guard;
  }

  async recorderStatus(ownerToken: string): Promise<AudioCaptureRecorderStatus> {
    this.calls.push('status');
    if (this.active && this.ownerToken === ownerToken && this.delayActiveStatusMs > 0) {
      const delayMs = this.delayActiveStatusMs;
      this.delayActiveStatusMs = 0;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    this.sampledAtMs += 10;
    return {
      isActive: this.active,
      durationMs: this.active ? this.durationMs : 0,
      sampledAtMs: this.sampledAtMs,
      leaseState: this.ownerToken === undefined ? 'none'
        : this.ownerToken === ownerToken ? 'owned' : 'other',
    };
  }

  async prepareSource(): Promise<void> {
    this.calls.push('prepare');
    if (this.failPrepare !== undefined) throw this.failPrepare;
  }

  async startRecorder(ownerToken: string): Promise<AudioCaptureRecorderStatus> {
    this.calls.push('start');
    if (this.refuseStart || this.ownerToken !== undefined) {
      this.active = true;
      throw new AudioCaptureRecorderActiveError({
        isActive: true, durationMs: 20, sampledAtMs: this.sampledAtMs += 10,
        leaseState: 'other',
      });
    }
    this.ownerToken = ownerToken;
    this.active = this.activateOnStart;
    return {
      isActive: this.active, durationMs: 0, sampledAtMs: this.sampledAtMs += 10,
      leaseState: 'owned',
    };
  }

  async stopTransport(): Promise<void> {
    this.calls.push('transport-stop');
    const call = this.calls.filter((item) => item === 'transport-stop').length;
    if (call === this.failTransportStopOnCall) {
      throw new Error('transport stop failed');
    }
  }

  async performRange(): Promise<AudioCaptureRangeObservation> {
    this.calls.push('playback');
    if (this.failRange !== undefined) throw this.failRange;
    if (this.dropDuringRange) {
      this.active = false;
      this.ownerToken = undefined;
    }
    if (this.changeGuardDuringRange) {
      this.guard = { ...this.guard, generation: 'reconnected-during-capture' };
    }
    return {
      playbackStartedAtMs: 1_100,
      terminalRangeObservedAtMs: 5_300,
      rangeWrappedAtMs: 5_500,
      transportStoppedAtMs: 5_520,
      terminalStep: 28,
      wrappedStep: 1,
    };
  }

  async stopRecorder(ownerToken: string): Promise<AudioCaptureRecorderStatus> {
    this.calls.push('stop');
    if (this.ownerToken !== ownerToken) throw new Error('recorder is not owned');
    await this.onStop?.();
    if (!this.stickActiveAfterStop) this.active = false;
    if (!this.active) this.ownerToken = undefined;
    return {
      isActive: this.active,
      durationMs: this.durationMs,
      sampledAtMs: this.sampledAtMs += 10,
      leaseState: this.active ? 'owned' : 'none',
    };
  }
}

function envelope(request: AudioCaptureRequest, requestId = 'capture-request') {
  return {
    schema: WORKSTATION_REQUEST_SCHEMA,
    requestId,
    inputSchema: AUDIO_CAPTURE_REQUEST_SCHEMA,
    sourceSha256: request.source.sha256,
    payload: request,
  } as const;
}

function captureCause(error: unknown): AudioCaptureError | undefined {
  return error instanceof WorkstationModuleError && error.cause instanceof AudioCaptureError
    ? error.cause : undefined;
}

test('7e-S11: one stable PCM WAVE becomes a capture artifact without analysis startup', async (t) => {
  const input = await fixture(t);
  const controller = new FakeCaptureController();
  controller.onStop = async () => writeFile(join(input.recordingDirectory, 'capture.wav'), pcm24Wav());
  let analysisStarts = 0;
  const analysis: WorkstationModule<AudioFactsRequest, AudioFactsResult> = {
    descriptor: {
      moduleId: AUDIO_FACTS_MODULE_ID, version: 'test', acceptedSchemas: [AUDIO_FACTS_REQUEST_SCHEMA],
      emittedSchemas: [AUDIO_FACTS_RESULT_SCHEMA], capabilities: ['test-analysis'],
      startupDeadlineMs: 100, requestDeadlineMs: 100,
    },
    start: async () => {
      analysisStarts += 1;
      return {
        state: 'available', capabilities: ['test-analysis'], missingCapabilities: [], dependencyVersions: {},
      };
    },
    handle: async () => { throw new Error('not called'); },
  };
  const registry = new WorkstationModuleRegistry();
  registry.register(audioCaptureModule({ controller }));
  registry.register(analysis);
  const response = await registry.request<AudioCaptureRequest, AudioCaptureResult>(
    AUDIO_CAPTURE_MODULE_ID, envelope(input.request),
  );
  assert.equal(response.outputSchema, AUDIO_CAPTURE_RESULT_SCHEMA);
  assert.equal(response.payload.artifact.sha256, digest(pcm24Wav()));
  assert.equal(response.payload.captureArtifact.durationSeconds, 4.5);
  assert.deepEqual(response.payload.artifact.scope, {
    sampleRange: { start: 0, end: 198_450 }, channelIndices: [0, 1],
  });
  assert.equal(response.payload.provider.headerReader, 'ghostnote-pcm24-wave-header');
  assert.equal(response.payload.coverage.sampleAlignment, 'not-proved');
  assert.equal(analysisStarts, 0);
  assert.equal(controller.calls.filter((call) => call === 'discover').length, 2);
});

test('7e-S11: unknown project bytes and an active recorder refuse before effects', async (t) => {
  const invalid = await fixture(t);
  const invalidController = new FakeCaptureController();
  const registry = new WorkstationModuleRegistry();
  registry.register(audioCaptureModule({ controller: invalidController }));
  const changed = {
    ...invalid.request,
    project: { ...invalid.project, projectFileSha256: '0'.repeat(64) },
  };
  await assert.rejects(
    registry.request(AUDIO_CAPTURE_MODULE_ID, envelope(changed)),
    (error) => error instanceof WorkstationModuleError && error.code === 'verification-failed',
  );
  assert.deepEqual(invalidController.calls, []);

  const active = await fixture(t);
  const activeController = new FakeCaptureController(true);
  const activeRegistry = new WorkstationModuleRegistry();
  activeRegistry.register(audioCaptureModule({ controller: activeController }));
  await assert.rejects(
    activeRegistry.request(AUDIO_CAPTURE_MODULE_ID, envelope(active.request)),
    (error) => {
      const cause = captureCause(error);
      return cause?.failure.effects === 'none' && cause.failure.recorderState?.isActive === true;
    },
  );
  assert.equal(activeController.calls.includes('prepare'), false);
  assert.equal(activeController.calls.includes('start'), false);

  const raced = await fixture(t);
  const racedController = new FakeCaptureController();
  racedController.refuseStart = true;
  const racedRegistry = new WorkstationModuleRegistry();
  racedRegistry.register(audioCaptureModule({ controller: racedController }));
  await assert.rejects(
    racedRegistry.request(AUDIO_CAPTURE_MODULE_ID, envelope(raced.request)),
    (error) => captureCause(error)?.failure.effects === 'none',
  );
  assert.equal(racedController.calls.filter((call) => call === 'stop').length, 0);
});

test('7e-S11: zero, multiple, and reused capture paths are ambiguous', async (t) => {
  const zero = await fixture(t);
  const zeroController = new FakeCaptureController();
  const zeroRegistry = new WorkstationModuleRegistry();
  zeroRegistry.register(audioCaptureModule({ controller: zeroController }));
  await assert.rejects(
    zeroRegistry.request(AUDIO_CAPTURE_MODULE_ID, envelope(zero.request)),
    (error) => error instanceof WorkstationModuleError && error.code === 'capture-ambiguous'
      && captureCause(error)?.failure.effects === 'known',
  );

  const multiple = await fixture(t);
  const multipleController = new FakeCaptureController();
  multipleController.onStop = async () => {
    await Promise.all([
      writeFile(join(multiple.recordingDirectory, 'one.wav'), pcm24Wav()),
      writeFile(join(multiple.recordingDirectory, 'two.wav'), pcm24Wav()),
    ]);
  };
  const multipleRegistry = new WorkstationModuleRegistry();
  multipleRegistry.register(audioCaptureModule({ controller: multipleController }));
  await assert.rejects(
    multipleRegistry.request(AUDIO_CAPTURE_MODULE_ID, envelope(multiple.request)),
    (error) => captureCause(error)?.failure.candidates.length === 2,
  );

  const reused = await fixture(t);
  const reusedPath = join(reused.recordingDirectory, 'existing.wav');
  await writeFile(reusedPath, pcm24Wav());
  const reusedController = new FakeCaptureController();
  reusedController.onStop = async () => writeFile(reusedPath, pcm24Wav(5_000));
  const reusedRegistry = new WorkstationModuleRegistry();
  reusedRegistry.register(audioCaptureModule({ controller: reusedController }));
  await assert.rejects(
    reusedRegistry.request(AUDIO_CAPTURE_MODULE_ID, envelope(reused.request)),
    (error) => captureCause(error)?.failure.candidates[0]?.status === 'reused-path',
  );
});

test('7e-S11: path mutation during the stable read rejects the artifact', async (t) => {
  const input = await fixture(t);
  const path = join(input.recordingDirectory, 'changing.wav');
  const controller = new FakeCaptureController();
  controller.onStop = async () => writeFile(path, pcm24Wav());
  const storage = createNodeAudioCaptureStorage({
    beforeArtifactRead: async () => writeFile(path, pcm24Wav(5_000)),
  });
  const registry = new WorkstationModuleRegistry();
  registry.register(audioCaptureModule({ controller, storage }));
  await assert.rejects(
    registry.request(AUDIO_CAPTURE_MODULE_ID, envelope(input.request)),
    (error) => error instanceof WorkstationModuleError && error.code === 'source-mismatch'
      && captureCause(error)?.failure.stage === 'artifact-hash',
  );
});

test('7e-S11: same-size path replacement after hashing rejects the artifact', async (t) => {
  const input = await fixture(t);
  const path = join(input.recordingDirectory, 'replaced.wav');
  const controller = new FakeCaptureController();
  controller.onStop = async () => writeFile(path, pcm24Wav());
  const replacement = pcm24Wav();
  replacement[replacement.byteLength - 1] ^= 1;
  const storage = createNodeAudioCaptureStorage({
    afterArtifactRead: async () => writeFile(path, replacement),
  });
  const registry = new WorkstationModuleRegistry();
  registry.register(audioCaptureModule({ controller, storage }));
  await assert.rejects(
    registry.request(AUDIO_CAPTURE_MODULE_ID, envelope(input.request)),
    (error) => error instanceof WorkstationModuleError && error.code === 'source-mismatch'
      && captureCause(error)?.failure.stage === 'artifact-hash',
  );
});

test('7e-S11: invalid capture headers and activation timeout fail closed', async (t) => {
  const invalid = await fixture(t);
  const invalidController = new FakeCaptureController();
  invalidController.onStop = async () => writeFile(
    join(invalid.recordingDirectory, 'invalid.wav'), Buffer.alloc(44, 0),
  );
  const invalidRegistry = new WorkstationModuleRegistry();
  invalidRegistry.register(audioCaptureModule({ controller: invalidController }));
  await assert.rejects(
    invalidRegistry.request(AUDIO_CAPTURE_MODULE_ID, envelope(invalid.request)),
    (error) => captureCause(error)?.failure.stage === 'header-validation',
  );

  const inactive = await fixture(t);
  const inactiveController = new FakeCaptureController();
  inactiveController.activateOnStart = false;
  const inactiveRegistry = new WorkstationModuleRegistry();
  inactiveRegistry.register(audioCaptureModule({ controller: inactiveController }));
  await assert.rejects(
    inactiveRegistry.request(AUDIO_CAPTURE_MODULE_ID, envelope(inactive.request)),
    (error) => captureCause(error)?.failure.stage === 'recorder-start'
      && inactiveController.calls.includes('playback') === false,
  );

  const late = await fixture(t);
  const lateController = new FakeCaptureController();
  lateController.delayActiveStatusMs = 120;
  const lateRegistry = new WorkstationModuleRegistry();
  lateRegistry.register(audioCaptureModule({ controller: lateController }));
  await assert.rejects(
    lateRegistry.request(AUDIO_CAPTURE_MODULE_ID, envelope(late.request)),
    (error) => captureCause(error)?.failure.stage === 'recorder-start',
  );
});

test('7e-S11: stop timeout reports unknown effects and recorder state', async (t) => {
  const input = await fixture(t);
  const controller = new FakeCaptureController();
  controller.stickActiveAfterStop = true;
  const registry = new WorkstationModuleRegistry();
  registry.register(audioCaptureModule({ controller }));
  await assert.rejects(
    registry.request(AUDIO_CAPTURE_MODULE_ID, envelope(input.request)),
    (error) => {
      const cause = captureCause(error);
      return cause?.failure.stage === 'recorder-stop'
        && cause.failure.effects === 'unknown'
        && cause.failure.recorderState?.isActive === true;
    },
  );
});

test('7e-S11: playback failure confirms transport cleanup before known effects', async (t) => {
  const recovered = await fixture(t);
  const recoveredController = new FakeCaptureController();
  recoveredController.failRange = new Error('playback observation failed');
  const recoveredRegistry = new WorkstationModuleRegistry();
  recoveredRegistry.register(audioCaptureModule({ controller: recoveredController }));
  await assert.rejects(
    recoveredRegistry.request(AUDIO_CAPTURE_MODULE_ID, envelope(recovered.request)),
    (error) => captureCause(error)?.failure.stage === 'playback'
      && captureCause(error)?.failure.effects === 'known',
  );
  assert.equal(recoveredController.calls.filter((call) => call === 'transport-stop').length, 2);
  assert.equal(recoveredController.calls.filter((call) => call === 'stop').length, 1);

  const unknown = await fixture(t);
  const unknownController = new FakeCaptureController();
  unknownController.failRange = new Error('playback observation failed');
  unknownController.failTransportStopOnCall = 2;
  const unknownRegistry = new WorkstationModuleRegistry();
  unknownRegistry.register(audioCaptureModule({ controller: unknownController }));
  await assert.rejects(
    unknownRegistry.request(AUDIO_CAPTURE_MODULE_ID, envelope(unknown.request)),
    (error) => captureCause(error)?.failure.stage === 'playback'
      && captureCause(error)?.failure.effects === 'unknown',
  );
  assert.equal(unknownController.calls.filter((call) => call === 'transport-stop').length, 2);
  assert.equal(unknownController.calls.filter((call) => call === 'stop').length, 1);
});

test('7e-S11: an unreadable failure snapshot cannot report known effects', async (t) => {
  const input = await fixture(t);
  const controller = new FakeCaptureController();
  const base = createNodeAudioCaptureStorage();
  const registry = new WorkstationModuleRegistry();
  registry.register(audioCaptureModule({
    controller,
    storage: {
      ...base,
      settle: async () => { throw new Error('candidate scan failed'); },
      candidates: async () => { throw new Error('candidate scan failed'); },
    },
  }));
  await assert.rejects(
    registry.request(AUDIO_CAPTURE_MODULE_ID, envelope(input.request)),
    (error) => captureCause(error)?.failure.effects === 'unknown',
  );
});

test('7e-S11: recorder dropout and truncated duration cannot claim the full range', async (t) => {
  const dropped = await fixture(t);
  const droppedController = new FakeCaptureController();
  droppedController.dropDuringRange = true;
  const droppedRegistry = new WorkstationModuleRegistry();
  droppedRegistry.register(audioCaptureModule({ controller: droppedController }));
  await assert.rejects(
    droppedRegistry.request(AUDIO_CAPTURE_MODULE_ID, envelope(dropped.request)),
    (error) => captureCause(error)?.failure.stage === 'playback',
  );

  const truncated = await fixture(t);
  const truncatedController = new FakeCaptureController();
  truncatedController.onStop = async () => writeFile(
    join(truncated.recordingDirectory, 'truncated.wav'), pcm24Wav(4_410),
  );
  const truncatedRegistry = new WorkstationModuleRegistry();
  truncatedRegistry.register(audioCaptureModule({ controller: truncatedController }));
  await assert.rejects(
    truncatedRegistry.request(AUDIO_CAPTURE_MODULE_ID, envelope(truncated.request)),
    (error) => captureCause(error)?.failure.stage === 'header-validation',
  );

  const nearBoundary = await fixture(t);
  const nearBoundaryController = new FakeCaptureController();
  nearBoundaryController.onStop = async () => writeFile(
    join(nearBoundary.recordingDirectory, 'near-boundary.wav'), pcm24Wav(167_580),
  );
  const nearBoundaryRegistry = new WorkstationModuleRegistry();
  nearBoundaryRegistry.register(audioCaptureModule({ controller: nearBoundaryController }));
  await assert.rejects(
    nearBoundaryRegistry.request(AUDIO_CAPTURE_MODULE_ID, envelope(nearBoundary.request)),
    (error) => captureCause(error)?.failure.stage === 'header-validation',
  );
});

test('7e-S11: concurrent captures preserve the winning recorder lease', async (t) => {
  const input = await fixture(t);
  const controller = new FakeCaptureController();
  controller.onStop = async () => writeFile(join(input.recordingDirectory, 'winner.wav'), pcm24Wav());
  const registry = new WorkstationModuleRegistry();
  registry.register(audioCaptureModule({ controller }));
  const settled = await Promise.allSettled([
    registry.request(AUDIO_CAPTURE_MODULE_ID, envelope(input.request, 'capture-a')),
    registry.request(AUDIO_CAPTURE_MODULE_ID, envelope(input.request, 'capture-b')),
  ]);
  assert.equal(settled.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(settled.filter((result) => result.status === 'rejected').length, 1);
  assert.equal(controller.calls.filter((call) => call === 'stop').length, 1);
});

test('7e-S17: a changed live guard fails capture without disabling analysis-only work', async (t) => {
  const input = await fixture(t);
  const controller = new FakeCaptureController();
  controller.guard = { ...GUARD, generation: 'reconnected-generation' };
  const registry = new WorkstationModuleRegistry();
  registry.register(audioCaptureModule({ controller }));
  const analysis = analysisModule(false);
  registry.register(analysis.module);
  await assert.rejects(
    registry.request(AUDIO_CAPTURE_MODULE_ID, envelope(input.request)),
    (error) => error instanceof WorkstationModuleError && error.code === 'source-mismatch',
  );
  const analyzed = await registry.request(AUDIO_FACTS_MODULE_ID, analysis.request);
  assert.equal((analyzed.payload as { ok: boolean }).ok, true);
});

test('7e-S17: a mid-capture reconnect makes artifact effects unknown', async (t) => {
  const input = await fixture(t);
  const controller = new FakeCaptureController();
  controller.changeGuardDuringRange = true;
  controller.onStop = async () => writeFile(join(input.recordingDirectory, 'disconnected.wav'), pcm24Wav());
  const registry = new WorkstationModuleRegistry();
  registry.register(audioCaptureModule({ controller }));
  await assert.rejects(
    registry.request(AUDIO_CAPTURE_MODULE_ID, envelope(input.request)),
    (error) => error instanceof WorkstationModuleError && error.code === 'source-mismatch'
      && captureCause(error)?.failure.effects === 'unknown',
  );
});

function analysisModule(fail: boolean): {
  readonly module: WorkstationModule<AudioFactsRequest, AudioFactsResult | { ok: true }>;
  readonly request: {
    readonly schema: typeof WORKSTATION_REQUEST_SCHEMA;
    readonly requestId: string;
    readonly inputSchema: typeof AUDIO_FACTS_REQUEST_SCHEMA;
    readonly sourceSha256: string;
    readonly payload: AudioFactsRequest;
  };
} {
  const result = { ok: true } as const;
  const module: WorkstationModule<AudioFactsRequest, AudioFactsResult | { ok: true }> = {
    descriptor: {
      moduleId: AUDIO_FACTS_MODULE_ID, version: 'test', acceptedSchemas: [AUDIO_FACTS_REQUEST_SCHEMA],
      emittedSchemas: [AUDIO_FACTS_RESULT_SCHEMA], capabilities: ['test-analysis'],
      startupDeadlineMs: 100, requestDeadlineMs: 100,
    },
    handle: async (request) => {
      if (fail) throw new WorkstationModuleError(
        'selected analysis failed', 'verification-failed', AUDIO_FACTS_MODULE_ID,
      );
      return {
        schema: WORKSTATION_RESPONSE_SCHEMA,
        requestId: request.requestId,
        sourceSha256: request.sourceSha256,
        outputSchema: AUDIO_FACTS_RESULT_SCHEMA,
        payload: result,
      };
    },
  };
  return {
    module,
    request: {
      schema: WORKSTATION_REQUEST_SCHEMA,
      requestId: 'analysis-only',
      inputSchema: AUDIO_FACTS_REQUEST_SCHEMA,
      sourceSha256: 'a'.repeat(64),
      payload: {
        schema: AUDIO_FACTS_REQUEST_SCHEMA,
        artifact: {} as AudioFactsRequest['artifact'],
        task: {
          taskId: 'analysis-only', property: 'silence',
          operationalDefinition: AUDIO_PROPERTY_DEFINITIONS.silence,
        },
      },
    },
  };
}

test('7e-composition: analysis failure preserves the successful capture result', async (t) => {
  const input = await fixture(t);
  const controller = new FakeCaptureController();
  controller.onStop = async () => writeFile(join(input.recordingDirectory, 'capture.wav'), pcm24Wav());
  const analysis = analysisModule(true);
  const registry = new WorkstationModuleRegistry();
  registry.register(audioCaptureModule({ controller }));
  registry.register(analysis.module);
  const composed = await captureAndAnalyze(
    registry,
    envelope(input.request, 'composed-capture'),
    'composed-analysis',
    {
      taskId: 'composed-silence', property: 'silence',
      operationalDefinition: AUDIO_PROPERTY_DEFINITIONS.silence,
    },
  );
  assert.equal(composed.analysis.ok, false);
  assert.equal(composed.capture.payload.artifact.sha256, digest(pcm24Wav()));
  assert.equal(composed.capture.payload.ownership.creator, 'ghostnote-audio-capture');
});
