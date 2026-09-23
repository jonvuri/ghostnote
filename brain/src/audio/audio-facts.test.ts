import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmod, mkdtemp, rm, truncate, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';

import {
  AUDIO_ARTIFACT_SCHEMA, AUDIO_FACTS_MODULE_ID, AUDIO_FACTS_REQUEST_SCHEMA,
  AUDIO_PROPERTY_DEFINITIONS, MAX_AUDIO_ARTIFACT_BYTES, AudioExecutableError, AudioFactsError,
  audioFactsModule, audioFactsRequest, analyzeAudioFacts, createFfmpegExecutableAdapter,
  routeAudioEvidence, SENSORY_REQUEST_SCHEMA, verifyAudioArtifact,
  type AudioArtifactDeclaration, type AudioExecutableAdapter, type AudioExecutableDiscovery,
  type AudioFactsRequest, type AudioFactsResult, type AudioSelection, type CrestInputs, type RolloffInputs,
  type SilenceInterval,
} from './index.js';
import {
  WORKSTATION_REQUEST_SCHEMA, WORKSTATION_RESPONSE_SCHEMA, WorkstationModuleError,
  WorkstationModuleRegistry, type WorkstationModule,
} from '../workstation/index.js';

const AVAILABLE: AudioExecutableDiscovery = {
  ffprobeVersion: '8.1.2', ffmpegVersion: '8.1.2', failures: [],
};

interface FakeOptions {
  readonly silence?: readonly SilenceInterval[];
  readonly loudness?: number | null;
  readonly crest?: CrestInputs;
  readonly rolloff?: readonly number[];
  readonly discovery?: AudioExecutableDiscovery;
  readonly onSilence?: () => Promise<void>;
  readonly probeTimeBase?: readonly [number, number, number];
}

class FakeAudioAdapter implements AudioExecutableAdapter {
  readonly calls: string[] = [];
  readonly selections: AudioSelection[] = [];

  constructor(private readonly options: FakeOptions = {}) {}

  async discover(): Promise<AudioExecutableDiscovery> {
    this.calls.push('discover');
    return this.options.discovery ?? AVAILABLE;
  }

  async probe(bytes: Uint8Array) {
    this.calls.push(`probe:${digest(bytes)}`);
    return {
      codecName: 'pcm_s24le', sampleFormat: 's32', bitsPerRawSample: 24,
      sampleRateHz: 44_100, channels: 2,
      durationTs: this.options.probeTimeBase?.[0] ?? (bytes.byteLength - 44) / 6,
      timeBaseNumerator: this.options.probeTimeBase?.[1] ?? 1,
      timeBaseDenominator: this.options.probeTimeBase?.[2] ?? 44_100,
    };
  }

  async silence(bytes: Uint8Array, selection: AudioSelection) {
    this.calls.push(`silence:${digest(bytes)}`);
    this.selections.push(structuredClone(selection));
    await this.options.onSilence?.();
    return this.options.silence ?? [];
  }

  async integratedLoudness(bytes: Uint8Array, _selection: AudioSelection) {
    this.calls.push(`loudness:${digest(bytes)}`);
    return this.options.loudness === undefined ? -24 : this.options.loudness;
  }

  async crestInputs(bytes: Uint8Array, _selection: AudioSelection) {
    this.calls.push(`crest:${digest(bytes)}`);
    return this.options.crest ?? {
      peakDbfsByChannel: [-3, -4], rmsDbfsByChannel: [-12, -13],
    };
  }

  async rolloffInputs(bytes: Uint8Array, selection: AudioSelection): Promise<RolloffInputs> {
    this.calls.push(`rolloff:${digest(bytes)}`);
    const frameCount = Math.floor((selection.sampleEnd - selection.sampleStart) / 8_192);
    return {
      frameCount,
      valuesHz: this.options.rolloff
        ?? Array.from({ length: frameCount * selection.channelIndices.length }, () => 440),
    };
  }
}

function digest(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function pcm24Wav(sampleCount: number, seed = 1): Buffer {
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
    const value = Math.round(Math.sin((sample + seed) * 0.03) * 500_000);
    for (let channel = 0; channel < 2; channel += 1) {
      output.writeIntLE(value + channel * seed, 44 + (sample * 2 + channel) * 3, 3);
    }
  }
  return output;
}

async function fixture(
  t: TestContext,
  options: {
    sampleCount?: number; seed?: number; sourceId?: string; channels?: readonly number[];
    sampleRange?: { readonly start: number; readonly end: number };
  } = {},
): Promise<{ path: string; bytes: Buffer; declaration: AudioArtifactDeclaration }> {
  const root = await mkdtemp(join(tmpdir(), 'ghostnote-audio-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const bytes = pcm24Wav(options.sampleCount ?? 20_000, options.seed ?? 1);
  const path = join(root, 'owned.wav');
  await writeFile(path, bytes);
  return {
    path,
    bytes,
    declaration: {
      schema: AUDIO_ARTIFACT_SCHEMA,
      sourceId: options.sourceId ?? 'owned-A',
      absolutePath: path,
      mediaType: 'audio/wav',
      byteCount: bytes.byteLength,
      sha256: digest(bytes),
      digestDomain: 'file-bytes',
      creator: 'audio-facts test fixture',
      permissionBasis: 'generated temporary test fixture',
      format: {
        container: 'wav', codec: 'pcm_s24le', sampleRateHz: 44_100,
        channels: 2, bitsPerSample: 24,
      },
      scope: {
        sampleRange: options.sampleRange ?? { start: 0, end: options.sampleCount ?? 20_000 },
        channelIndices: options.channels ?? [0, 1],
      },
    },
  };
}

function task(property: keyof typeof AUDIO_PROPERTY_DEFINITIONS) {
  return {
    taskId: `test-${property}`,
    property,
    operationalDefinition: AUDIO_PROPERTY_DEFINITIONS[property],
  };
}

async function analyze(
  t: TestContext,
  property: keyof typeof AUDIO_PROPERTY_DEFINITIONS,
  adapter: FakeAudioAdapter,
  fixtureOptions: Parameters<typeof fixture>[1] = {},
): Promise<AudioFactsResult> {
  const input = await fixture(t, fixtureOptions);
  const verified = await verifyAudioArtifact(input.declaration);
  return analyzeAudioFacts(adapter, AVAILABLE, audioFactsRequest(verified, task(property)));
}

test('7d-S12: artifact identity, PCM format, range, and channels verify before startup', async (t) => {
  const input = await fixture(t);
  const invalidHash = { ...input.declaration, sha256: '0'.repeat(64) };
  const adapter = new FakeAudioAdapter();
  await assert.rejects(
    verifyAudioArtifact(invalidHash),
    (error) => error instanceof AudioFactsError && error.code === 'source-mismatch',
  );
  assert.deepEqual(adapter.calls, []);

  const invalidRange = {
    ...input.declaration,
    scope: { ...input.declaration.scope, sampleRange: { start: 0, end: 20_001 } },
  };
  await assert.rejects(
    verifyAudioArtifact(invalidRange),
    (error) => error instanceof AudioFactsError && error.code === 'incomplete-coverage',
  );
  const invalidChannels = {
    ...input.declaration,
    scope: { ...input.declaration.scope, channelIndices: [1, 0] },
  };
  await assert.rejects(
    verifyAudioArtifact(invalidChannels),
    (error) => error instanceof AudioFactsError && error.code === 'incomplete-coverage',
  );

  await assert.rejects(
    verifyAudioArtifact({ ...input.declaration, byteCount: MAX_AUDIO_ARTIFACT_BYTES + 1 }),
    (error) => error instanceof AudioFactsError && error.code === 'invalid-request',
  );

  const invalidFormatBytes = Buffer.from(input.bytes);
  invalidFormatBytes.writeUInt16LE(16, 34);
  const invalidFormatPath = join(input.path, '..', 'invalid-format.wav');
  await writeFile(invalidFormatPath, invalidFormatBytes);
  await assert.rejects(
    verifyAudioArtifact({
      ...input.declaration,
      absolutePath: invalidFormatPath,
      sha256: digest(invalidFormatBytes),
    }),
    (error) => error instanceof AudioFactsError && error.code === 'unsupported-format',
  );

  const missingPad = Buffer.alloc(input.bytes.byteLength + 9);
  input.bytes.copy(missingPad);
  missingPad.write('JUNK', input.bytes.byteLength, 'ascii');
  missingPad.writeUInt32LE(1, input.bytes.byteLength + 4);
  missingPad[input.bytes.byteLength + 8] = 1;
  missingPad.writeUInt32LE(missingPad.byteLength - 8, 4);
  const missingPadPath = join(input.path, '..', 'missing-pad.wav');
  await writeFile(missingPadPath, missingPad);
  await assert.rejects(
    verifyAudioArtifact({
      ...input.declaration,
      absolutePath: missingPadPath,
      byteCount: missingPad.byteLength,
      sha256: digest(missingPad),
    }),
    (error) => error instanceof AudioFactsError && error.code === 'unsupported-format',
  );

  await truncate(input.path, MAX_AUDIO_ARTIFACT_BYTES + 1);
  await assert.rejects(
    verifyAudioArtifact(input.declaration),
    (error) => error instanceof AudioFactsError && error.code === 'source-mismatch',
  );
});

test('7d-S12: forged retained bytes refuse before provider discovery', async (t) => {
  const input = await fixture(t);
  const verified = await verifyAudioArtifact(input.declaration);
  const forged = structuredClone(audioFactsRequest(verified, task('silence')));
  forged.artifact.bytes[44] ^= 1;
  const adapter = new FakeAudioAdapter();
  const registry = new WorkstationModuleRegistry();
  registry.register(audioFactsModule({ adapter }));
  await assert.rejects(
    registry.request(AUDIO_FACTS_MODULE_ID, {
      schema: WORKSTATION_REQUEST_SCHEMA,
      requestId: 'forged-retained-bytes', inputSchema: AUDIO_FACTS_REQUEST_SCHEMA,
      sourceSha256: input.declaration.sha256, payload: forged,
    }),
    (error) => error instanceof WorkstationModuleError && error.code === 'source-mismatch',
  );
  assert.deepEqual(adapter.calls, []);
  assert.equal(registry.discover()[0]?.state, 'uninitialized');
});

test('7d-S12: a nonzero range, one channel, and rational probe duration stay exact', async (t) => {
  const adapter = new FakeAudioAdapter({ probeTimeBase: [40_000, 1, 88_200] });
  const result = await analyze(t, 'silence', adapter, {
    channels: [1], sampleRange: { start: 2_000, end: 18_000 },
  });
  assert.deepEqual(adapter.selections, [{
    sampleStart: 2_000, sampleEnd: 18_000, channelIndices: [1],
  }]);
  assert.deepEqual(result.coverage.channelIndices, [1]);
  assert.deepEqual(result.coverage.sampleRange, { start: 2_000, end: 18_000 });
});

test('7d-S12/S13: brightness computes only selected FFmpeg facts from retained bytes', async (t) => {
  const adapter = new FakeAudioAdapter({ loudness: -24, rolloff: [220, 230, 440, 450] });
  const input = await fixture(t);
  const verified = await verifyAudioArtifact(input.declaration);
  const registry = new WorkstationModuleRegistry();
  registry.register(audioFactsModule({ adapter }));
  assert.equal(adapter.calls.length, 0, 'artifact verification must precede lazy startup');
  const payload = audioFactsRequest(verified, task('brightness'));
  const response = await registry.request<AudioFactsRequest, AudioFactsResult>(
    AUDIO_FACTS_MODULE_ID,
    {
      schema: WORKSTATION_REQUEST_SCHEMA,
      requestId: 'brightness-request',
      inputSchema: AUDIO_FACTS_REQUEST_SCHEMA,
      sourceSha256: input.declaration.sha256,
      payload,
    },
  );
  assert.deepEqual(response.payload.facts.map((fact) => fact.fieldId), [
    'silence-duration-v0', 'integrated-loudness-v0', 'spectral-rolloff-85-v0',
  ]);
  assert.equal(response.payload.facts[2]?.value, 335);
  assert.deepEqual(response.payload.facts[2]?.coverage.frames, {
    sizeSamples: 8192, hopSamples: 8192, count: 2, coveredSamples: 16_384,
    tailSamples: 3_616, window: 'hann', padding: 'none', tailPolicy: 'discard-incomplete',
  });
  assert.equal(adapter.calls.some((call) => call.startsWith('crest:')), false);
  assert.equal(adapter.calls.every((call) => !call.includes('librosa')), true);
  const consumedDigests = adapter.calls.slice(1).map((call) => call.split(':')[1]);
  assert.equal(consumedDigests.every((value) => value === input.declaration.sha256), true);
});

test('7d-S13: thresholded analog silence gates dependent facts without broader analysis', async (t) => {
  const duration = 20_000 / 44_100;
  const adapter = new FakeAudioAdapter({
    silence: [{ startSeconds: 0, endSeconds: duration }], loudness: -70,
  });
  const result = await analyze(t, 'brightness', adapter);
  assert.equal(result.silenceGateApplied, true);
  assert.deepEqual(result.facts.map((fact) => fact.value), [duration, null, null]);
  assert.deepEqual(result.facts.slice(1).map((fact) => fact.unavailable?.code), [
    'silence-gate', 'silence-gate',
  ]);
  assert.equal(adapter.calls.some((call) => call.startsWith('loudness:')), false);
  assert.equal(adapter.calls.some((call) => call.startsWith('rolloff:')), false);
  assert.equal(result.facts.some((fact) => fact.fieldId.includes('pitch')), false);
  assert.equal(result.coverage.omittedFields.includes('perceptual-label'), true);
});

test('7d-S13: the one-sample silence allowance is global across all gaps', async (t) => {
  const sampleRateHz = 44_100;
  const sampleCount = 20_000;
  const oneGap = await analyze(t, 'brightness', new FakeAudioAdapter({
    silence: [
      { startSeconds: 0, endSeconds: 3_002 / sampleRateHz },
      { startSeconds: 3_003 / sampleRateHz, endSeconds: sampleCount / sampleRateHz },
    ],
  }));
  assert.equal(oneGap.facts[0]?.value, (sampleCount - 1) / sampleRateHz);
  assert.equal(oneGap.silenceGateApplied, true);
  assert.equal(routeAudioEvidence({
    schema: SENSORY_REQUEST_SCHEMA,
    taskId: 'one-sample-silence', property: 'brightness',
    operationalDefinition: AUDIO_PROPERTY_DEFINITIONS.brightness,
    decisionPurpose: 'Confirm one global sample of silence tolerance.',
    A: oneGap, B: oneGap,
  }).evidenceStatus, 'insufficient');

  const severalGaps = await analyze(t, 'brightness', new FakeAudioAdapter({
    silence: [
      { startSeconds: 0, endSeconds: 0.0680726 },
      { startSeconds: 0.0680952, endSeconds: 0.124785 },
      { startSeconds: 0.124807, endSeconds: 0.181497 },
      { startSeconds: 0.181519, endSeconds: 0.238209 },
      { startSeconds: 0.238231, endSeconds: 0.453515 },
    ],
    loudness: -35,
  }));
  assert.equal(severalGaps.facts[0]?.value, (sampleCount - 4) / sampleRateHz);
  assert.equal(severalGaps.silenceGateApplied, false);
  assert.equal(severalGaps.facts[1]?.value, -35);
});

test('7d-S13: a qualifying interval does not gate a partly audible selected range', async (t) => {
  const adapter = new FakeAudioAdapter({
    silence: [{ startSeconds: 0, endSeconds: 0.1 }], loudness: -35,
  });
  const result = await analyze(t, 'loudness', adapter);
  assert.equal(result.silenceGateApplied, false);
  assert.equal(result.facts[0]?.value, 0.1);
  assert.equal(result.facts[1]?.value, -35);
  assert.equal(adapter.calls.some((call) => call.startsWith('loudness:')), true);
});

test('7d-S12: a source mutation after provider use discards the result', async (t) => {
  const input = await fixture(t);
  const verified = await verifyAudioArtifact(input.declaration);
  const changed = pcm24Wav(20_000, 99);
  const adapter = new FakeAudioAdapter({
    onSilence: async () => writeFile(input.path, changed),
  });
  await assert.rejects(
    analyzeAudioFacts(adapter, AVAILABLE, audioFactsRequest(verified, task('silence'))),
    (error) => error instanceof AudioFactsError && error.code === 'source-mismatch',
  );
  assert.equal(adapter.calls[1], `silence:${input.declaration.sha256}`,
    'the provider must receive the retained verified bytes');
});

test('7d-S17: missing executables degrade only the audio module', async (t) => {
  const input = await fixture(t);
  const verified = await verifyAudioArtifact(input.declaration);
  const missing = new FakeAudioAdapter({
    discovery: {
      ffprobeVersion: '8.1.2', ffmpegVersion: null,
      failures: [{ executable: 'ffmpeg', reason: 'not found' }],
    },
  });
  const registry = new WorkstationModuleRegistry();
  registry.register(audioFactsModule({ adapter: missing }));
  const other: WorkstationModule<Record<string, never>, { ok: true }> = {
    descriptor: {
      moduleId: 'unrelated-local-module', version: '0', acceptedSchemas: ['other-input-v0'],
      emittedSchemas: ['other-output-v0'], capabilities: ['read'],
      startupDeadlineMs: 50, requestDeadlineMs: 50,
    },
    handle: async (request) => ({
      schema: WORKSTATION_RESPONSE_SCHEMA,
      requestId: request.requestId,
      sourceSha256: request.sourceSha256,
      outputSchema: 'other-output-v0',
      payload: { ok: true },
    }),
  };
  registry.register(other);
  await assert.rejects(
    registry.request(AUDIO_FACTS_MODULE_ID, {
      schema: WORKSTATION_REQUEST_SCHEMA,
      requestId: 'missing-provider', inputSchema: AUDIO_FACTS_REQUEST_SCHEMA,
      sourceSha256: input.declaration.sha256,
      payload: audioFactsRequest(verified, task('silence')),
    }),
    (error) => error instanceof WorkstationModuleError && error.code === 'missing-dependency',
  );
  const descriptor = registry.discover().find((item) => item.moduleId === AUDIO_FACTS_MODULE_ID)!;
  assert.equal(descriptor.state, 'degraded');
  assert.deepEqual(descriptor.capabilities, []);
  assert.equal(descriptor.missingCapabilities.every((item) => item.dependency === 'ffmpeg'), true);
  const otherResponse = await registry.request('unrelated-local-module', {
    schema: WORKSTATION_REQUEST_SCHEMA,
    requestId: 'other-request', inputSchema: 'other-input-v0',
    sourceSha256: input.declaration.sha256, payload: {},
  });
  assert.deepEqual(otherResponse.payload, { ok: true });

  const missingProbe = new FakeAudioAdapter({
    discovery: {
      ffprobeVersion: null, ffmpegVersion: '8.1.2',
      failures: [{ executable: 'ffprobe', reason: 'not found' }],
    },
  });
  const secondRegistry = new WorkstationModuleRegistry();
  secondRegistry.register(audioFactsModule({ adapter: missingProbe }));
  await assert.rejects(
    secondRegistry.request(AUDIO_FACTS_MODULE_ID, {
      schema: WORKSTATION_REQUEST_SCHEMA,
      requestId: 'missing-ffprobe', inputSchema: AUDIO_FACTS_REQUEST_SCHEMA,
      sourceSha256: input.declaration.sha256,
      payload: audioFactsRequest(verified, task('silence')),
    }),
    (error) => error instanceof WorkstationModuleError && error.code === 'missing-dependency',
  );
  assert.equal(secondRegistry.discover()[0]?.missingCapabilities
    .every((item) => item.dependency === 'ffprobe'), true);
});

test('7d-S17: the executable adapter reports absent commands independently', async () => {
  const adapter = createFfmpegExecutableAdapter({
    ffprobePath: '/ghostnote/absent/ffprobe',
    ffmpegPath: '/ghostnote/absent/ffmpeg',
    deadlineMs: 100,
  });
  const discovery = await adapter.discover();
  assert.equal(discovery.ffprobeVersion, null);
  assert.equal(discovery.ffmpegVersion, null);
  assert.deepEqual(discovery.failures.map((failure) => failure.executable), ['ffprobe', 'ffmpeg']);
});

test('7d-S17: timed-out executable processes close before discovery returns', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'ghostnote-audio-timeout-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const executable = join(root, 'blocked-provider');
  await writeFile(executable, '#!/bin/sh\nwhile :; do :; done\n');
  await chmod(executable, 0o700);
  const adapter = createFfmpegExecutableAdapter({
    ffprobePath: executable, ffmpegPath: executable, deadlineMs: 20,
  });
  const started = performance.now();
  const discovery = await adapter.discover();
  assert.equal(discovery.ffprobeVersion, null);
  assert.equal(discovery.ffmpegVersion, null);
  assert.equal(discovery.failures.every((failure) => failure.reason.includes('deadline')), true);
  assert.equal(performance.now() - started < 1_000, true);

  const input = await fixture(t);
  const verified = await verifyAudioArtifact(input.declaration);
  const registry = new WorkstationModuleRegistry();
  registry.register(audioFactsModule({ adapter }));
  registry.register({
    descriptor: {
      moduleId: 'timeout-control-module', version: '0', acceptedSchemas: ['control-input-v0'],
      emittedSchemas: ['control-output-v0'], capabilities: ['read'],
      startupDeadlineMs: 50, requestDeadlineMs: 50,
    },
    handle: async (request) => ({
      schema: WORKSTATION_RESPONSE_SCHEMA,
      requestId: request.requestId,
      sourceSha256: request.sourceSha256,
      outputSchema: 'control-output-v0',
      payload: { ok: true },
    }),
  });
  await assert.rejects(
    registry.request(AUDIO_FACTS_MODULE_ID, {
      schema: WORKSTATION_REQUEST_SCHEMA,
      requestId: 'timeout-audio', inputSchema: AUDIO_FACTS_REQUEST_SCHEMA,
      sourceSha256: input.declaration.sha256,
      payload: audioFactsRequest(verified, task('silence')),
    }),
    (error) => error instanceof WorkstationModuleError && error.code === 'missing-dependency',
  );
  const control = await registry.request('timeout-control-module', {
    schema: WORKSTATION_REQUEST_SCHEMA,
    requestId: 'timeout-control', inputSchema: 'control-input-v0',
    sourceSha256: input.declaration.sha256, payload: {},
  });
  assert.deepEqual(control.payload, { ok: true });
});

test('7d-S17: a provider process timeout remains a module timeout', async (t) => {
  const input = await fixture(t);
  const verified = await verifyAudioArtifact(input.declaration);
  const adapter = new FakeAudioAdapter({
    onSilence: async () => {
      throw new AudioExecutableError('ffmpeg exceeded its deadline', 'timeout', 'ffmpeg');
    },
  });
  const registry = new WorkstationModuleRegistry();
  registry.register(audioFactsModule({ adapter }));
  await assert.rejects(
    registry.request(AUDIO_FACTS_MODULE_ID, {
      schema: WORKSTATION_REQUEST_SCHEMA,
      requestId: 'provider-timeout', inputSchema: AUDIO_FACTS_REQUEST_SCHEMA,
      sourceSha256: input.declaration.sha256,
      payload: audioFactsRequest(verified, task('silence')),
    }),
    (error) => error instanceof WorkstationModuleError && error.code === 'timeout',
  );
});

test('7d-S13: impossible provider values refuse typed facts', async (t) => {
  await assert.rejects(
    analyze(t, 'brightness', new FakeAudioAdapter({
      rolloff: [30_000, 30_000, 30_000, 30_000],
    })),
    (error) => error instanceof AudioFactsError && error.code === 'provider-failure',
  );
  await assert.rejects(
    analyze(t, 'crest', new FakeAudioAdapter({
      crest: { peakDbfsByChannel: [-12, -12], rmsDbfsByChannel: [-3, -3] },
    })),
    (error) => error instanceof AudioFactsError && error.code === 'provider-failure',
  );
});

test('7d-S13: sensory v1 preserves aliases and returns no change for equal metrics', async (t) => {
  const left = await analyze(t, 'crest', new FakeAudioAdapter(), { sourceId: 'alias-A' });
  const right = await analyze(t, 'crest', new FakeAudioAdapter(), { sourceId: 'alias-B' });
  assert.equal(left.source.sha256, right.source.sha256);
  const packet = routeAudioEvidence({
    schema: SENSORY_REQUEST_SCHEMA,
    taskId: 'crest-aliases', property: 'crest',
    operationalDefinition: AUDIO_PROPERTY_DEFINITIONS.crest,
    decisionPurpose: 'Detect a crest change or no change.', A: left, B: right,
  });
  assert.equal(packet.evidenceStatus, 'no-change');
  assert.deepEqual(packet.sources, { A: left.source, B: right.source });
  assert.equal(packet.fields[1]?.B_minus_A, 0);
});

test('7d-S13: equal facts from different hashes support metric no change only', async (t) => {
  const left = await analyze(t, 'crest', new FakeAudioAdapter(), { seed: 1, sourceId: 'different-A' });
  const right = await analyze(t, 'crest', new FakeAudioAdapter(), { seed: 2, sourceId: 'different-B' });
  assert.notEqual(left.source.sha256, right.source.sha256);
  const packet = routeAudioEvidence({
    schema: SENSORY_REQUEST_SCHEMA,
    taskId: 'crest-different-hashes', property: 'crest',
    operationalDefinition: AUDIO_PROPERTY_DEFINITIONS.crest,
    decisionPurpose: 'Detect a crest change or no change.', A: left, B: right,
  });
  assert.equal(packet.evidenceStatus, 'no-change');
  assert.equal(packet.limits.includes('Equal selected metrics do not prove equal music.'), true);
});

test('7d-S13: brightness uses the inclusive 0.2 LU compatibility gate', async (t) => {
  const left = await analyze(t, 'brightness', new FakeAudioAdapter({ loudness: -24.0 }),
    { seed: 1, sourceId: 'level-A' });
  const atBoundary = await analyze(t, 'brightness', new FakeAudioAdapter({ loudness: -23.8 }),
    { seed: 2, sourceId: 'level-B' });
  const outside = await analyze(t, 'brightness', new FakeAudioAdapter({ loudness: -23.79 }),
    { seed: 3, sourceId: 'level-C' });
  const request = {
    schema: SENSORY_REQUEST_SCHEMA as typeof SENSORY_REQUEST_SCHEMA,
    taskId: 'brightness-level', property: 'brightness' as const,
    operationalDefinition: AUDIO_PROPERTY_DEFINITIONS.brightness,
    decisionPurpose: 'Compare the declared brightness proxy.', A: left,
  };
  assert.equal(routeAudioEvidence({ ...request, B: atBoundary }).evidenceStatus, 'no-change');
  assert.equal(routeAudioEvidence({ ...request, B: outside }).evidenceStatus, 'insufficient');
});

test('7d-S13: incompatible settings and missing fields refuse without a direction', async (t) => {
  const left = await analyze(t, 'brightness', new FakeAudioAdapter(),
    { seed: 1, sourceId: 'compatible-A' });
  const right = await analyze(t, 'brightness', new FakeAudioAdapter(),
    { seed: 2, sourceId: 'compatible-B' });
  const incompatible = structuredClone(right);
  const rolloff = incompatible.facts.find((fact) => fact.fieldId === 'spectral-rolloff-85-v0')!;
  (rolloff.formula.settings as Record<string, unknown>).tailPolicy = 'pad';
  const base = {
    schema: SENSORY_REQUEST_SCHEMA as typeof SENSORY_REQUEST_SCHEMA,
    taskId: 'incompatible-brightness', property: 'brightness' as const,
    operationalDefinition: AUDIO_PROPERTY_DEFINITIONS.brightness,
    decisionPurpose: 'Compare the declared brightness proxy.', A: left,
  };
  assert.throws(
    () => routeAudioEvidence({ ...base, B: incompatible }),
    (error) => error instanceof AudioFactsError && error.code === 'incompatible-comparison',
  );
  const missing = { ...right, facts: right.facts.slice(0, 2) };
  assert.throws(
    () => routeAudioEvidence({ ...base, B: missing }),
    (error) => error instanceof AudioFactsError && error.code === 'incompatible-comparison',
  );

  const wrongChannels = structuredClone(right);
  (wrongChannels.facts[0]!.coverage as unknown as Record<string, unknown>).channelIndices = [0];
  assert.throws(
    () => routeAudioEvidence({ ...base, B: wrongChannels }),
    (error) => error instanceof AudioFactsError && error.code === 'incompatible-comparison',
  );
  const wrongFrameSize = structuredClone(right);
  (wrongFrameSize.facts[2]!.coverage.frames as unknown as Record<string, unknown>)
    .sizeSamples = 4_096;
  assert.throws(
    () => routeAudioEvidence({ ...base, B: wrongFrameSize }),
    (error) => error instanceof AudioFactsError && error.code === 'incompatible-comparison',
  );
  const wrongProvenance = structuredClone(right);
  (wrongProvenance.facts[1] as unknown as Record<string, unknown>).source = {
    ...wrongProvenance.source, sourceId: 'other-source',
  };
  assert.throws(
    () => routeAudioEvidence({ ...base, B: wrongProvenance }),
    (error) => error instanceof AudioFactsError && error.code === 'incompatible-comparison',
  );
  const falseGate = structuredClone(right);
  (falseGate.facts[0] as unknown as Record<string, unknown>).value = 20_000 / 44_100;
  assert.throws(
    () => routeAudioEvidence({ ...base, B: falseGate }),
    (error) => error instanceof AudioFactsError && error.code === 'incompatible-comparison',
  );
  const nonNullGatedFact = structuredClone(right);
  (nonNullGatedFact.facts[0] as unknown as Record<string, unknown>).value = 20_000 / 44_100;
  (nonNullGatedFact as unknown as Record<string, unknown>).silenceGateApplied = true;
  assert.throws(
    () => routeAudioEvidence({ ...base, B: nonNullGatedFact }),
    (error) => error instanceof AudioFactsError && error.code === 'incompatible-comparison',
  );
});

test('7d-S13: loudness and silence routes expose only selected fields', async (t) => {
  const loudnessA = await analyze(t, 'loudness', new FakeAudioAdapter({ loudness: -24 }),
    { sourceId: 'loudness-A' });
  const loudnessB = await analyze(t, 'loudness', new FakeAudioAdapter({ loudness: -23.5 }),
    { sourceId: 'loudness-B', seed: 2 });
  const loudnessPacket = routeAudioEvidence({
    schema: SENSORY_REQUEST_SCHEMA,
    taskId: 'loudness-route', property: 'loudness',
    operationalDefinition: AUDIO_PROPERTY_DEFINITIONS.loudness,
    decisionPurpose: 'Compare integrated loudness.', A: loudnessA, B: loudnessB,
  });
  assert.equal(loudnessPacket.evidenceStatus, 'comparable');
  assert.deepEqual(loudnessPacket.fields.map((field) => field.fieldId), [
    'silence-duration-v0', 'integrated-loudness-v0',
  ]);
  assert.equal(loudnessA.coverage.omittedFields.includes('spectral-rolloff-85-v0'), true);
  assert.equal(loudnessA.coverage.omittedFields.includes('peak-rms-crest-v0'), true);

  const silenceA = await analyze(t, 'silence', new FakeAudioAdapter(), { sourceId: 'silence-A' });
  const silenceB = await analyze(t, 'silence', new FakeAudioAdapter(), { sourceId: 'silence-B' });
  const silencePacket = routeAudioEvidence({
    schema: SENSORY_REQUEST_SCHEMA,
    taskId: 'silence-route', property: 'silence',
    operationalDefinition: AUDIO_PROPERTY_DEFINITIONS.silence,
    decisionPurpose: 'Compare thresholded silence.', A: silenceA, B: silenceB,
  });
  assert.equal(silencePacket.evidenceStatus, 'no-change');
  assert.deepEqual(silencePacket.fields.map((field) => field.fieldId), ['silence-duration-v0']);
  assert.equal(silenceA.coverage.omittedFields.includes('integrated-loudness-v0'), true);
});

test('7d-R4: undefined presence refuses before analysis or routing', async (t) => {
  const input = await fixture(t);
  const verified = await verifyAudioArtifact(input.declaration);
  assert.throws(
    () => audioFactsRequest(verified, {
      taskId: 'presence', property: 'presence' as never,
      operationalDefinition: 'Choose the source with more presence.',
    }),
    (error) => error instanceof AudioFactsError && error.code === 'unmapped-property',
  );
  const adapter = new FakeAudioAdapter();
  assert.deepEqual(adapter.calls, []);
});
