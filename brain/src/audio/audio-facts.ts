/** Verified local-file analysis for audio-facts-v0. */
import { createHash } from 'node:crypto';
import { open, stat } from 'node:fs/promises';
import { isAbsolute, normalize } from 'node:path';

import {
  AudioExecutableError, ROLLOFF_CUTOFF, ROLLOFF_FRAME_SAMPLES, SILENCE_MINIMUM_SECONDS,
  SILENCE_THRESHOLD_DBFS, type AudioExecutableAdapter, type AudioExecutableDiscovery,
  type AudioSelection, type SilenceInterval,
} from './ffmpeg-adapter.js';
import {
  WORKSTATION_RESPONSE_SCHEMA, WorkstationModuleError, type MissingCapability,
  type ModuleHealth, type WorkstationModule,
} from '../workstation/module-registry.js';

export const AUDIO_ARTIFACT_SCHEMA = 'ghostnote-audio-artifact-v0';
export const VERIFIED_AUDIO_ARTIFACT_SCHEMA = 'ghostnote-verified-audio-artifact-v0';
export const AUDIO_FACTS_REQUEST_SCHEMA = 'ghostnote-audio-facts-request-v0';
export const AUDIO_FACTS_RESULT_SCHEMA = 'audio-facts-v0';
export const AUDIO_FACT_SCHEMA = 'ghostnote-audio-fact-v0';
export const AUDIO_FACTS_MODULE_ID = 'ghostnote-audio-facts';
export const AUDIO_FACTS_MODULE_VERSION = '0';
export const AUDIO_FACTS_PROVIDER_VERSION = '0';

export const MAX_AUDIO_ARTIFACT_BYTES = 16 * 1_024 * 1_024;
export const MAX_AUDIO_RANGE_SECONDS = 60;
export const AUDIO_STARTUP_DEADLINE_MS = 2_000;
export const AUDIO_REQUEST_DEADLINE_MS = 20_000;

export const AUDIO_PROPERTY_DEFINITIONS = {
  brightness: 'Compare the 85% spectral-rolloff proxy only after level matching within 0.2 LU.',
  loudness: 'Compare EBU R128 integrated loudness. Loudness is the target.',
  crest: 'Compare peak-to-RMS crest only as a signal metric.',
  silence: 'Compare thresholded silence below -90 dBFS for at least 0.05 seconds.',
} as const;

export type AudioProperty = keyof typeof AUDIO_PROPERTY_DEFINITIONS;
export type AudioFactFieldId = 'silence-duration-v0' | 'integrated-loudness-v0'
| 'spectral-rolloff-85-v0' | 'peak-rms-crest-v0';

export interface AudioArtifactDeclaration {
  readonly schema: typeof AUDIO_ARTIFACT_SCHEMA;
  readonly sourceId: string;
  readonly absolutePath: string;
  readonly mediaType: 'audio/wav';
  readonly byteCount: number;
  readonly sha256: string;
  readonly digestDomain: 'file-bytes';
  readonly creator: string;
  readonly permissionBasis: string;
  readonly format: {
    readonly container: 'wav';
    readonly codec: 'pcm_s24le';
    readonly sampleRateHz: 44_100;
    readonly channels: 2;
    readonly bitsPerSample: 24;
  };
  readonly scope: {
    readonly sampleRange: {
      readonly start: number;
      readonly end: number;
    };
    readonly channelIndices: readonly number[];
  };
}

export interface VerifiedAudioArtifact {
  readonly schema: typeof VERIFIED_AUDIO_ARTIFACT_SCHEMA;
  readonly artifact: AudioArtifactDeclaration;
  readonly header: {
    readonly sampleRateHz: 44_100;
    readonly channels: 2;
    readonly bitsPerSample: 24;
    readonly blockAlignBytes: 6;
    readonly sampleCount: number;
    readonly dataOffset: number;
    readonly dataBytes: number;
  };
  readonly bytes: Uint8Array;
  readonly timingMs: {
    readonly readAndHash: number;
    readonly headerAndScopeValidation: number;
  };
}

export interface AudioFactsTask {
  readonly taskId: string;
  readonly property: AudioProperty;
  readonly operationalDefinition: string;
}

export interface AudioFactsRequest {
  readonly schema: typeof AUDIO_FACTS_REQUEST_SCHEMA;
  readonly artifact: VerifiedAudioArtifact;
  readonly task: AudioFactsTask;
}

export interface AudioFactSource {
  readonly sourceId: string;
  readonly artifactPath: string;
  readonly mediaType: 'audio/wav';
  readonly byteCount: number;
  readonly sha256: string;
  readonly digestDomain: 'file-bytes';
  readonly creator: string;
  readonly permissionBasis: string;
}

export interface AudioFactProvider {
  readonly name: 'ghostnote-ffmpeg-audio-facts';
  readonly version: typeof AUDIO_FACTS_PROVIDER_VERSION;
  readonly ffprobeVersion: string;
  readonly ffmpegVersion: string;
}

export interface AudioFactCoverage {
  readonly requestedSamples: {
    readonly start: number;
    readonly end: number;
  };
  readonly observedSamples: {
    readonly start: number;
    readonly end: number;
  };
  readonly sampleRateHz: number;
  readonly channelIndices: readonly number[];
  readonly channelPolicy: 'selected-discrete-channels';
  readonly complete: true;
  readonly frames: null | {
    readonly sizeSamples: typeof ROLLOFF_FRAME_SAMPLES;
    readonly hopSamples: typeof ROLLOFF_FRAME_SAMPLES;
    readonly count: number;
    readonly coveredSamples: number;
    readonly tailSamples: number;
    readonly window: 'hann';
    readonly padding: 'none';
    readonly tailPolicy: 'discard-incomplete';
  };
}

export interface AudioFact {
  readonly schema: typeof AUDIO_FACT_SCHEMA;
  readonly fieldId: AudioFactFieldId;
  readonly value: number | null;
  readonly unit: 's' | 'LUFS' | 'Hz' | 'dB';
  readonly kind: 'thresholded-fact' | 'estimate' | 'derived-measurement';
  readonly source: AudioFactSource;
  readonly provider: AudioFactProvider;
  readonly coverage: AudioFactCoverage;
  readonly formula: {
    readonly id: string;
    readonly settings: Readonly<Record<string, unknown>>;
  };
  readonly tolerance: {
    readonly kind: 'absolute';
    readonly value: number;
    readonly unit: AudioFact['unit'];
    readonly basis: string;
  };
  readonly uncertainty: string;
  readonly unavailable: null | {
    readonly code: 'silence-gate' | 'insufficient-frames' | 'provider-null';
    readonly reason: string;
  };
}

export interface AudioFactsResult {
  readonly schema: typeof AUDIO_FACTS_RESULT_SCHEMA;
  readonly task: AudioFactsTask;
  readonly source: AudioFactSource;
  readonly provider: AudioFactProvider;
  readonly coverage: {
    readonly requestedProperty: AudioProperty;
    readonly selectedFields: readonly AudioFactFieldId[];
    readonly omittedFields: readonly string[];
    readonly sampleRange: AudioArtifactDeclaration['scope']['sampleRange'];
    readonly channelIndices: readonly number[];
    readonly complete: boolean;
  };
  readonly authority: 'measured-signal-evidence';
  readonly facts: readonly AudioFact[];
  readonly silenceGateApplied: boolean;
  readonly warnings: readonly string[];
  readonly timingMs: {
    readonly sourceReadAndHash: number;
    readonly headerAndScopeValidation: number;
    readonly providerProbe: number;
    readonly silence: number;
    readonly selectedFacts: number;
    readonly outputValidation: number;
    readonly finalSourceVerification: number;
  };
}

export interface AudioFactsModuleOptions {
  readonly adapter: AudioExecutableAdapter;
  readonly onTiming?: (event: { readonly phase: string; readonly elapsedMs: number }) => void;
}

export class AudioFactsError extends Error {
  constructor(
    message: string,
    readonly code: 'invalid-request' | 'source-mismatch' | 'unsupported-format'
    | 'incomplete-coverage' | 'missing-dependency' | 'provider-failure'
    | 'timeout' | 'verification-failed' | 'unmapped-property' | 'incompatible-comparison',
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'AudioFactsError';
  }
}

interface WavHeader {
  readonly sampleRateHz: number;
  readonly channels: number;
  readonly bitsPerSample: number;
  readonly blockAlignBytes: number;
  readonly sampleCount: number;
  readonly dataOffset: number;
  readonly dataBytes: number;
}

const SHA256 = /^[0-9a-f]{64}$/;
const SOURCE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

function hash(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return Buffer.from(bytes.buffer, bytes.byteOffset + start, length).toString('ascii');
}

function parseWavHeader(bytes: Uint8Array): WavHeader {
  if (bytes.byteLength < 44 || ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WAVE') {
    throw new AudioFactsError('the artifact is not a RIFF WAVE file', 'unsupported-format');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(4, true) + 8 !== bytes.byteLength) {
    throw new AudioFactsError('the RIFF byte count does not match the artifact', 'unsupported-format');
  }
  let offset = 12;
  let format: {
    audioFormat: number; channels: number; sampleRateHz: number; byteRate: number;
    blockAlignBytes: number; bitsPerSample: number;
  } | undefined;
  let data: { offset: number; bytes: number } | undefined;
  while (offset + 8 <= bytes.byteLength) {
    const chunkId = ascii(bytes, offset, 4);
    const chunkBytes = view.getUint32(offset + 4, true);
    const contentOffset = offset + 8;
    if (contentOffset + chunkBytes > bytes.byteLength) {
      throw new AudioFactsError('a WAVE chunk exceeds the artifact', 'unsupported-format');
    }
    if (chunkId === 'fmt ') {
      if (format !== undefined || chunkBytes < 16) {
        throw new AudioFactsError('the WAVE format chunk is invalid', 'unsupported-format');
      }
      format = {
        audioFormat: view.getUint16(contentOffset, true),
        channels: view.getUint16(contentOffset + 2, true),
        sampleRateHz: view.getUint32(contentOffset + 4, true),
        byteRate: view.getUint32(contentOffset + 8, true),
        blockAlignBytes: view.getUint16(contentOffset + 12, true),
        bitsPerSample: view.getUint16(contentOffset + 14, true),
      };
    } else if (chunkId === 'data') {
      if (data !== undefined) {
        throw new AudioFactsError('the WAVE file has more than one data chunk', 'unsupported-format');
      }
      data = { offset: contentOffset, bytes: chunkBytes };
    }
    offset = contentOffset + chunkBytes + (chunkBytes % 2);
  }
  if (offset !== bytes.byteLength) {
    throw new AudioFactsError('the WAVE chunk layout is incomplete', 'unsupported-format');
  }
  if (format === undefined || data === undefined) {
    throw new AudioFactsError('the WAVE file omits its format or data chunk', 'unsupported-format');
  }
  if (format.audioFormat !== 1 || format.channels !== 2 || format.sampleRateHz !== 44_100
      || format.bitsPerSample !== 24 || format.blockAlignBytes !== 6
      || format.byteRate !== 44_100 * 6 || data.bytes % format.blockAlignBytes !== 0) {
    throw new AudioFactsError(
      'audio-facts-v0 requires stereo 24-bit PCM WAVE at 44.1 kHz', 'unsupported-format',
    );
  }
  return {
    sampleRateHz: format.sampleRateHz,
    channels: format.channels,
    bitsPerSample: format.bitsPerSample,
    blockAlignBytes: format.blockAlignBytes,
    sampleCount: data.bytes / format.blockAlignBytes,
    dataOffset: data.offset,
    dataBytes: data.bytes,
  };
}

function validateDeclarationMetadata(declaration: AudioArtifactDeclaration): void {
  if (typeof declaration !== 'object' || declaration === null
      || typeof declaration.format !== 'object' || declaration.format === null
      || typeof declaration.scope !== 'object' || declaration.scope === null
      || typeof declaration.scope.sampleRange !== 'object'
      || declaration.scope.sampleRange === null
      || declaration.schema !== AUDIO_ARTIFACT_SCHEMA
      || typeof declaration.sourceId !== 'string' || !SOURCE_ID.test(declaration.sourceId)
      || typeof declaration.absolutePath !== 'string' || !isAbsolute(declaration.absolutePath)
      || normalize(declaration.absolutePath) !== declaration.absolutePath
      || declaration.mediaType !== 'audio/wav' || declaration.digestDomain !== 'file-bytes'
      || typeof declaration.creator !== 'string' || declaration.creator.trim().length === 0
      || typeof declaration.permissionBasis !== 'string'
      || declaration.permissionBasis.trim().length === 0 || !SHA256.test(declaration.sha256)) {
    throw new AudioFactsError('the audio artifact declaration is invalid', 'invalid-request');
  }
  if (!Number.isSafeInteger(declaration.byteCount)
      || declaration.byteCount < 44 || declaration.byteCount > MAX_AUDIO_ARTIFACT_BYTES) {
    throw new AudioFactsError('the audio artifact byte count is invalid', 'invalid-request');
  }
  if (declaration.format.container !== 'wav' || declaration.format.codec !== 'pcm_s24le'
      || declaration.format.sampleRateHz !== 44_100 || declaration.format.channels !== 2
      || declaration.format.bitsPerSample !== 24) {
    throw new AudioFactsError('the declared audio format is unsupported', 'unsupported-format');
  }
}

function validateDeclaration(
  declaration: AudioArtifactDeclaration,
  bytes: Uint8Array,
  verifyDigest = true,
): WavHeader {
  validateDeclarationMetadata(declaration);
  if (declaration.byteCount !== bytes.byteLength) {
    throw new AudioFactsError('the audio artifact byte count is invalid', 'invalid-request');
  }
  if (verifyDigest && hash(bytes) !== declaration.sha256) {
    throw new AudioFactsError('the audio artifact SHA-256 does not match', 'source-mismatch');
  }
  const header = parseWavHeader(bytes);
  const { start, end } = declaration.scope.sampleRange;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end <= start
      || end > header.sampleCount || end - start > MAX_AUDIO_RANGE_SECONDS * header.sampleRateHz
      || end - start < Math.ceil(SILENCE_MINIMUM_SECONDS * header.sampleRateHz)) {
    throw new AudioFactsError('the requested audio sample range is invalid', 'incomplete-coverage');
  }
  const channels = declaration.scope.channelIndices;
  if (!Array.isArray(channels) || channels.length < 1 || channels.length > 2
      || channels.some((value, index) => !Number.isSafeInteger(value) || value < 0
        || value >= header.channels || (index > 0 && channels[index - 1]! >= value))) {
    throw new AudioFactsError('the requested channel selection is invalid', 'incomplete-coverage');
  }
  return header;
}

function sameFileSnapshot(
  left: Awaited<ReturnType<Awaited<ReturnType<typeof open>>['stat']>>,
  right: Awaited<ReturnType<Awaited<ReturnType<typeof open>>['stat']>>,
): boolean {
  return left.dev === right.dev && left.ino === right.ino && left.size === right.size
    && left.mtimeMs === right.mtimeMs && left.ctimeMs === right.ctimeMs;
}

async function readStableArtifact(
  absolutePath: string,
  expectedBytes: number,
): Promise<Buffer> {
  const handle = await open(absolutePath, 'r');
  try {
    const before = await handle.stat();
    if (!before.isFile() || before.size !== expectedBytes || before.size < 44
        || before.size > MAX_AUDIO_ARTIFACT_BYTES) {
      throw new Error('the file size is outside the declared audio-facts-v0 limit');
    }
    const bytes = await handle.readFile();
    const after = await handle.stat();
    const currentPath = await stat(absolutePath);
    if (!sameFileSnapshot(before, after) || !sameFileSnapshot(after, currentPath)
        || bytes.byteLength !== expectedBytes) {
      throw new Error('the file changed while it was read');
    }
    return bytes;
  } finally {
    await handle.close();
  }
}

/** Verify and retain the exact bytes before the audio module starts. */
export async function verifyAudioArtifact(
  declaration: AudioArtifactDeclaration,
): Promise<VerifiedAudioArtifact> {
  validateDeclarationMetadata(declaration);
  const readStarted = performance.now();
  let opened: Buffer;
  try {
    opened = await readStableArtifact(declaration.absolutePath, declaration.byteCount);
  } catch (error) {
    throw new AudioFactsError(
      `cannot read the audio artifact: ${error instanceof Error ? error.message : String(error)}`,
      'source-mismatch',
    );
  }
  const bytes = new Uint8Array(opened);
  const digest = hash(bytes);
  const readAndHash = performance.now() - readStarted;
  if (digest !== declaration.sha256) {
    throw new AudioFactsError('the audio artifact SHA-256 does not match', 'source-mismatch');
  }
  const validationStarted = performance.now();
  const header = validateDeclaration(declaration, bytes, false);
  const headerAndScopeValidation = performance.now() - validationStarted;
  return {
    schema: VERIFIED_AUDIO_ARTIFACT_SCHEMA,
    artifact: structuredClone(declaration),
    header: {
      sampleRateHz: 44_100,
      channels: 2,
      bitsPerSample: 24,
      blockAlignBytes: 6,
      sampleCount: header.sampleCount,
      dataOffset: header.dataOffset,
      dataBytes: header.dataBytes,
    },
    bytes: new Uint8Array(bytes),
    timingMs: { readAndHash, headerAndScopeValidation },
  };
}

export function audioFactsRequest(
  artifact: VerifiedAudioArtifact,
  task: AudioFactsTask,
): AudioFactsRequest {
  validateTask(task);
  const request: AudioFactsRequest = {
    schema: AUDIO_FACTS_REQUEST_SCHEMA, artifact, task: structuredClone(task),
  };
  validateRetainedArtifact(request);
  return request;
}

function validateTask(task: AudioFactsTask): void {
  if (typeof task !== 'object' || task === null || typeof task.taskId !== 'string'
      || task.taskId.trim().length === 0 || task.taskId.length > 128
      || !Object.hasOwn(AUDIO_PROPERTY_DEFINITIONS, task.property)) {
    throw new AudioFactsError('the requested audio property is not mapped', 'unmapped-property');
  }
  if (task.operationalDefinition !== AUDIO_PROPERTY_DEFINITIONS[task.property]) {
    throw new AudioFactsError('the audio property definition is not the selected definition', 'unmapped-property');
  }
}

function sourceOf(artifact: AudioArtifactDeclaration): AudioFactSource {
  return {
    sourceId: artifact.sourceId,
    artifactPath: artifact.absolutePath,
    mediaType: artifact.mediaType,
    byteCount: artifact.byteCount,
    sha256: artifact.sha256,
    digestDomain: artifact.digestDomain,
    creator: artifact.creator,
    permissionBasis: artifact.permissionBasis,
  };
}

function baseCoverage(artifact: VerifiedAudioArtifact): AudioFactCoverage {
  return {
    requestedSamples: structuredClone(artifact.artifact.scope.sampleRange),
    observedSamples: structuredClone(artifact.artifact.scope.sampleRange),
    sampleRateHz: artifact.header.sampleRateHz,
    channelIndices: [...artifact.artifact.scope.channelIndices],
    channelPolicy: 'selected-discrete-channels',
    complete: true,
    frames: null,
  };
}

function fact(
  common: { source: AudioFactSource; provider: AudioFactProvider; coverage: AudioFactCoverage },
  value: Omit<AudioFact, 'schema' | 'source' | 'provider' | 'coverage'>,
): AudioFact {
  return { schema: AUDIO_FACT_SCHEMA, ...value, ...common };
}

function selectedFields(property: AudioProperty): readonly AudioFactFieldId[] {
  switch (property) {
    case 'brightness': return [
      'silence-duration-v0', 'integrated-loudness-v0', 'spectral-rolloff-85-v0',
    ];
    case 'loudness': return ['silence-duration-v0', 'integrated-loudness-v0'];
    case 'crest': return ['silence-duration-v0', 'peak-rms-crest-v0'];
    case 'silence': return ['silence-duration-v0'];
  }
}

const ALL_AUDIO_FACT_FIELDS: readonly AudioFactFieldId[] = [
  'silence-duration-v0', 'integrated-loudness-v0',
  'spectral-rolloff-85-v0', 'peak-rms-crest-v0',
];

function validateLoudness(value: number | null): void {
  if (value !== null && (!Number.isFinite(value) || value < -120 || value > 10)) {
    throw new AudioFactsError('FFmpeg returned invalid integrated loudness', 'provider-failure');
  }
}

function exactSampleCount(probe: Awaited<ReturnType<AudioExecutableAdapter['probe']>>): number {
  const numerator = probe.durationTs * probe.timeBaseNumerator * probe.sampleRateHz;
  if (!Number.isSafeInteger(numerator) || numerator % probe.timeBaseDenominator !== 0) {
    throw new AudioFactsError(
      'the FFprobe duration does not convert to an exact sample count', 'provider-failure',
    );
  }
  return numerator / probe.timeBaseDenominator;
}

function validateProbe(
  probe: Awaited<ReturnType<AudioExecutableAdapter['probe']>>,
  artifact: VerifiedAudioArtifact,
): void {
  if (probe.codecName !== 'pcm_s24le' || probe.sampleFormat !== 's32'
      || probe.bitsPerRawSample !== 24 || probe.sampleRateHz !== artifact.header.sampleRateHz
      || probe.channels !== artifact.header.channels
      || exactSampleCount(probe) !== artifact.header.sampleCount) {
    throw new AudioFactsError('FFprobe does not match the verified WAVE header', 'source-mismatch');
  }
}

function normalizeIntervals(
  intervals: readonly SilenceInterval[],
  selectedSampleCount: number,
  sampleRateHz: number,
): readonly { readonly startSample: number; readonly endSample: number }[] {
  const durationSeconds = selectedSampleCount / sampleRateHz;
  const toleranceSeconds = 1 / sampleRateHz;
  const sorted = intervals.map((interval) => {
    if (!Number.isFinite(interval.startSeconds) || !Number.isFinite(interval.endSeconds)
        || interval.startSeconds < -toleranceSeconds
        || interval.endSeconds < interval.startSeconds
        || interval.endSeconds > durationSeconds + toleranceSeconds) {
      throw new AudioFactsError('FFmpeg returned an invalid silence interval', 'provider-failure');
    }
    return {
      startSample: Math.max(0, Math.min(
        selectedSampleCount, Math.round(interval.startSeconds * sampleRateHz),
      )),
      endSample: Math.max(0, Math.min(
        selectedSampleCount, Math.round(interval.endSeconds * sampleRateHz),
      )),
    };
  }).sort((left, right) => left.startSample - right.startSample);
  const merged: { startSample: number; endSample: number }[] = [];
  for (const interval of sorted) {
    const previous = merged.at(-1);
    if (previous === undefined || interval.startSample > previous.endSample) {
      merged.push(interval);
    } else {
      merged[merged.length - 1] = {
        startSample: previous.startSample,
        endSample: Math.max(previous.endSample, interval.endSample),
      };
    }
  }
  return merged;
}

function median(values: readonly number[]): number {
  if (values.length === 0 || values.some((value) => !Number.isFinite(value))) {
    throw new AudioFactsError('the provider returned invalid numeric values', 'provider-failure');
  }
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function providerFailure(error: unknown): never {
  if (error instanceof AudioFactsError) throw error;
  if (error instanceof AudioExecutableError) {
    throw new AudioFactsError(
      error.message,
      error.code === 'missing-dependency' ? 'missing-dependency'
        : error.code === 'timeout' ? 'timeout' : 'provider-failure',
      { cause: error },
    );
  }
  throw new AudioFactsError(
    error instanceof Error ? error.message : String(error),
    'provider-failure',
    { cause: error },
  );
}

function unavailableFact(
  common: { source: AudioFactSource; provider: AudioFactProvider; coverage: AudioFactCoverage },
  fieldId: 'integrated-loudness-v0' | 'spectral-rolloff-85-v0' | 'peak-rms-crest-v0',
  code: NonNullable<AudioFact['unavailable']>['code'],
  reason: string,
): AudioFact {
  const definitions = {
    'integrated-loudness-v0': {
      unit: 'LUFS' as const, kind: 'estimate' as const, formulaId: 'ffmpeg-ebur128-integrated-v0',
      tolerance: 0.1, basis: 'FFmpeg EBU R128 summary precision',
    },
    'spectral-rolloff-85-v0': {
      unit: 'Hz' as const, kind: 'estimate' as const, formulaId: 'ffmpeg-rolloff-85-v0',
      tolerance: 2 * common.coverage.sampleRateHz / ROLLOFF_FRAME_SAMPLES,
      basis: 'two 8,192-sample FFT bins',
    },
    'peak-rms-crest-v0': {
      unit: 'dB' as const, kind: 'derived-measurement' as const,
      formulaId: 'ffmpeg-peak-rms-crest-v0', tolerance: 0.001,
      basis: 'declared parsed-decibel comparison tolerance',
    },
  }[fieldId];
  return fact(common, {
    fieldId, value: null, unit: definitions.unit, kind: definitions.kind,
    formula: { id: definitions.formulaId, settings: metricSettings(fieldId) },
    tolerance: {
      kind: 'absolute', value: definitions.tolerance, unit: definitions.unit,
      basis: definitions.basis,
    },
    uncertainty: reason,
    unavailable: { code, reason },
  });
}

function metricSettings(fieldId: AudioFactFieldId): Readonly<Record<string, unknown>> {
  switch (fieldId) {
    case 'silence-duration-v0': return {
      thresholdDbfs: SILENCE_THRESHOLD_DBFS,
      minimumIntervalSeconds: SILENCE_MINIMUM_SECONDS,
      channelRule: 'all-selected-channels-below-threshold',
      gateRule: 'merged-intervals-cover-complete-selected-range-within-one-sample',
      timestampRule: 'round-to-nearest-sample-before-union',
    };
    case 'integrated-loudness-v0': return {
      standard: 'EBU R128', peakMode: 'true', dualMono: false, resample: false,
    };
    case 'spectral-rolloff-85-v0': return {
      cutoffMagnitudeRatio: ROLLOFF_CUTOFF,
      frameSamples: ROLLOFF_FRAME_SAMPLES,
      hopSamples: ROLLOFF_FRAME_SAMPLES,
      window: 'hann', overlap: 0, padding: 'none', tailPolicy: 'discard-incomplete',
      aggregation: 'median-across-complete-frames-and-selected-channels',
      resample: false,
    };
    case 'peak-rms-crest-v0': return {
      peakAggregation: 'largest-per-channel-peak-dbfs',
      rmsAggregation: 'largest-per-channel-rms-dbfs',
      formula: 'largest-peak-dbfs-minus-largest-rms-dbfs', resample: false,
    };
  }
}

function validateFacts(facts: readonly AudioFact[], expected: readonly AudioFactFieldId[]): void {
  if (facts.length !== expected.length
      || facts.some((item, index) => item.fieldId !== expected[index]
        || (item.value !== null && !Number.isFinite(item.value))
        || (item.value === null) !== (item.unavailable !== null)
        || item.source.sha256.length !== 64 || item.provider.ffmpegVersion.length === 0
        || item.provider.ffprobeVersion.length === 0)) {
    throw new AudioFactsError('the audio fact result failed validation', 'verification-failed');
  }
}

async function verifyUnchanged(artifact: VerifiedAudioArtifact): Promise<void> {
  let current: Buffer;
  try {
    current = await readStableArtifact(
      artifact.artifact.absolutePath, artifact.artifact.byteCount,
    );
  } catch (error) {
    throw new AudioFactsError(
      `cannot verify the audio artifact after analysis: ${error instanceof Error ? error.message : String(error)}`,
      'source-mismatch',
    );
  }
  if (current.byteLength !== artifact.artifact.byteCount
      || hash(current) !== artifact.artifact.sha256) {
    throw new AudioFactsError('the audio artifact changed during analysis', 'source-mismatch');
  }
}

function validateRetainedArtifact(request: AudioFactsRequest): void {
  if (typeof request !== 'object' || request === null
      || request.schema !== AUDIO_FACTS_REQUEST_SCHEMA
      || typeof request.artifact !== 'object' || request.artifact === null
      || request.artifact.schema !== VERIFIED_AUDIO_ARTIFACT_SCHEMA
      || !(request.artifact.bytes instanceof Uint8Array)
      || typeof request.artifact.header !== 'object' || request.artifact.header === null) {
    throw new AudioFactsError('the audio-facts request schema is unsupported', 'invalid-request');
  }
  validateTask(request.task);
  const bytes = new Uint8Array(request.artifact.bytes);
  const retainedHeader = validateDeclaration(request.artifact.artifact, bytes);
  if (retainedHeader.sampleRateHz !== request.artifact.header.sampleRateHz
      || retainedHeader.channels !== request.artifact.header.channels
      || retainedHeader.bitsPerSample !== request.artifact.header.bitsPerSample
      || retainedHeader.blockAlignBytes !== request.artifact.header.blockAlignBytes
      || retainedHeader.sampleCount !== request.artifact.header.sampleCount
      || retainedHeader.dataOffset !== request.artifact.header.dataOffset
      || retainedHeader.dataBytes !== request.artifact.header.dataBytes) {
    throw new AudioFactsError('the retained audio artifact metadata is invalid', 'verification-failed');
  }
}

async function preflightAudioFactsRequest(request: AudioFactsRequest): Promise<void> {
  validateRetainedArtifact(request);
  await verifyUnchanged(request.artifact);
}

/** Analyze only the facts selected by one declared task. */
export async function analyzeAudioFacts(
  adapter: AudioExecutableAdapter,
  discovery: AudioExecutableDiscovery,
  request: AudioFactsRequest,
  onTiming?: AudioFactsModuleOptions['onTiming'],
  signal?: AbortSignal,
): Promise<AudioFactsResult> {
  validateRetainedArtifact(request);
  if (discovery.ffprobeVersion === null || discovery.ffmpegVersion === null) {
    throw new AudioFactsError('FFprobe and FFmpeg are required for this task', 'missing-dependency');
  }
  const bytes = new Uint8Array(request.artifact.bytes);
  const source = sourceOf(request.artifact.artifact);
  const provider: AudioFactProvider = {
    name: 'ghostnote-ffmpeg-audio-facts', version: AUDIO_FACTS_PROVIDER_VERSION,
    ffprobeVersion: discovery.ffprobeVersion, ffmpegVersion: discovery.ffmpegVersion,
  };
  const selection: AudioSelection = {
    sampleStart: request.artifact.artifact.scope.sampleRange.start,
    sampleEnd: request.artifact.artifact.scope.sampleRange.end,
    channelIndices: [...request.artifact.artifact.scope.channelIndices],
  };
  const record = async <T>(phase: string, operation: () => Promise<T>): Promise<{
    value: T; elapsedMs: number;
  }> => {
    const started = performance.now();
    let value: T;
    try {
      value = await operation();
    } catch (error) {
      providerFailure(error);
    }
    const elapsedMs = performance.now() - started;
    onTiming?.({ phase, elapsedMs });
    return { value, elapsedMs };
  };
  const probe = await record('provider-probe', () => adapter.probe(bytes, signal));
  validateProbe(probe.value, request.artifact);
  const silence = await record(
    'provider-silence', () => adapter.silence(bytes, selection, signal),
  );
  const selectedSampleCount = selection.sampleEnd - selection.sampleStart;
  const sampleToleranceSeconds = 1 / request.artifact.header.sampleRateHz;
  const intervals = normalizeIntervals(
    silence.value, selectedSampleCount, request.artifact.header.sampleRateHz,
  );
  const silenceSamples = intervals.reduce(
    (total, interval) => total + interval.endSample - interval.startSample, 0,
  );
  const silenceDuration = silenceSamples / request.artifact.header.sampleRateHz;
  const gate = selectedSampleCount - silenceSamples <= 1;
  const coverage = baseCoverage(request.artifact);
  const common = { source, provider, coverage };
  const facts: AudioFact[] = [fact(common, {
    fieldId: 'silence-duration-v0', value: silenceDuration, unit: 's', kind: 'thresholded-fact',
    formula: { id: 'ffmpeg-silencedetect-complete-range-v0', settings: metricSettings('silence-duration-v0') },
    tolerance: {
      kind: 'absolute', value: sampleToleranceSeconds, unit: 's', basis: 'one sample',
    },
    uncertainty: 'Intervals use a -90 dBFS noise floor and a 0.05-second minimum duration.',
    unavailable: null,
  })];
  let selectedFactsMs = 0;
  if (request.task.property === 'brightness') {
    if (gate) {
      facts.push(unavailableFact(common, 'integrated-loudness-v0', 'silence-gate',
        'The complete selected range is below the silence threshold.'));
      const frameCount = Math.floor((selection.sampleEnd - selection.sampleStart)
        / ROLLOFF_FRAME_SAMPLES);
      const frameCoverage: AudioFactCoverage = {
        ...coverage,
        frames: {
          sizeSamples: ROLLOFF_FRAME_SAMPLES, hopSamples: ROLLOFF_FRAME_SAMPLES,
          count: frameCount, coveredSamples: frameCount * ROLLOFF_FRAME_SAMPLES,
          tailSamples: selection.sampleEnd - selection.sampleStart
            - frameCount * ROLLOFF_FRAME_SAMPLES,
          window: 'hann', padding: 'none', tailPolicy: 'discard-incomplete',
        },
      };
      facts.push(unavailableFact({ source, provider, coverage: frameCoverage },
        'spectral-rolloff-85-v0', 'silence-gate',
        'The complete selected range is below the silence threshold.'));
    } else {
      const frameCount = Math.floor((selection.sampleEnd - selection.sampleStart)
        / ROLLOFF_FRAME_SAMPLES);
      const frameCoverage: AudioFactCoverage = {
        ...coverage,
        frames: {
          sizeSamples: ROLLOFF_FRAME_SAMPLES, hopSamples: ROLLOFF_FRAME_SAMPLES,
          count: frameCount, coveredSamples: frameCount * ROLLOFF_FRAME_SAMPLES,
          tailSamples: selection.sampleEnd - selection.sampleStart
            - frameCount * ROLLOFF_FRAME_SAMPLES,
          window: 'hann', padding: 'none', tailPolicy: 'discard-incomplete',
        },
      };
      const rolloffPending = frameCount === 0 ? Promise.resolve(undefined) : record(
        'provider-spectral-rolloff', () => adapter.rolloffInputs(bytes, selection, signal),
      );
      const [loudness, rolloff] = await Promise.all([
        record(
          'provider-integrated-loudness',
          () => adapter.integratedLoudness(bytes, selection, signal),
        ),
        rolloffPending,
      ]);
      validateLoudness(loudness.value);
      selectedFactsMs += loudness.elapsedMs + (rolloff?.elapsedMs ?? 0);
      facts.push(loudness.value === null
        ? unavailableFact(common, 'integrated-loudness-v0', 'provider-null',
          'FFmpeg returned no integrated loudness for the selected range.')
        : fact(common, {
          fieldId: 'integrated-loudness-v0', value: loudness.value, unit: 'LUFS', kind: 'estimate',
          formula: { id: 'ffmpeg-ebur128-integrated-v0', settings: metricSettings('integrated-loudness-v0') },
          tolerance: {
            kind: 'absolute', value: 0.1, unit: 'LUFS',
            basis: 'FFmpeg EBU R128 summary precision',
          },
          uncertainty: 'This is the integrated EBU R128 estimate for the complete selected range.',
          unavailable: null,
        }));
      if (frameCount === 0) {
        facts.push(unavailableFact({ source, provider, coverage: frameCoverage },
          'spectral-rolloff-85-v0', 'insufficient-frames',
          'The selected range contains no complete 8,192-sample frame.'));
      } else {
        if (rolloff === undefined) {
          throw new AudioFactsError('the rolloff result is missing', 'provider-failure');
        }
        if (rolloff.value.frameCount !== frameCount
            || rolloff.value.valuesHz.length !== frameCount * selection.channelIndices.length
            || rolloff.value.valuesHz.some((value) => !Number.isFinite(value)
              || value < 0 || value > request.artifact.header.sampleRateHz / 2)) {
          throw new AudioFactsError('the rolloff frame coverage is invalid', 'provider-failure');
        }
        facts.push(fact({ source, provider, coverage: frameCoverage }, {
          fieldId: 'spectral-rolloff-85-v0', value: median(rolloff.value.valuesHz),
          unit: 'Hz', kind: 'estimate',
          formula: { id: 'ffmpeg-rolloff-85-v0', settings: metricSettings('spectral-rolloff-85-v0') },
          tolerance: {
            kind: 'absolute', value: 2 * request.artifact.header.sampleRateHz
              / ROLLOFF_FRAME_SAMPLES,
            unit: 'Hz', basis: 'two 8,192-sample FFT bins',
          },
          uncertainty: 'The value is the median over complete frames and selected channels.',
          unavailable: null,
        }));
      }
    }
  } else if (request.task.property === 'loudness') {
    if (gate) {
      facts.push(unavailableFact(common, 'integrated-loudness-v0', 'silence-gate',
        'The complete selected range is below the silence threshold.'));
    } else {
      const loudness = await record(
        'provider-integrated-loudness', () => adapter.integratedLoudness(bytes, selection, signal),
      );
      validateLoudness(loudness.value);
      selectedFactsMs += loudness.elapsedMs;
      facts.push(loudness.value === null
        ? unavailableFact(common, 'integrated-loudness-v0', 'provider-null',
          'FFmpeg returned no integrated loudness for the selected range.')
        : fact(common, {
          fieldId: 'integrated-loudness-v0', value: loudness.value, unit: 'LUFS', kind: 'estimate',
          formula: { id: 'ffmpeg-ebur128-integrated-v0', settings: metricSettings('integrated-loudness-v0') },
          tolerance: {
            kind: 'absolute', value: 0.1, unit: 'LUFS',
            basis: 'FFmpeg EBU R128 summary precision',
          },
          uncertainty: 'This is the integrated EBU R128 estimate for the complete selected range.',
          unavailable: null,
        }));
    }
  } else if (request.task.property === 'crest') {
    if (gate) {
      facts.push(unavailableFact(common, 'peak-rms-crest-v0', 'silence-gate',
        'The complete selected range is below the silence threshold.'));
    } else {
      const inputs = await record(
        'provider-crest-inputs', () => adapter.crestInputs(bytes, selection, signal),
      );
      selectedFactsMs += inputs.elapsedMs;
      if (inputs.value.peakDbfsByChannel.length !== selection.channelIndices.length
          || inputs.value.rmsDbfsByChannel.length !== selection.channelIndices.length) {
        throw new AudioFactsError('the crest channel coverage is invalid', 'provider-failure');
      }
      const peaks = inputs.value.peakDbfsByChannel.filter((value): value is number => value !== null);
      const rms = inputs.value.rmsDbfsByChannel.filter((value): value is number => value !== null);
      if (peaks.length !== selection.channelIndices.length || rms.length !== selection.channelIndices.length
          || peaks.some((value) => !Number.isFinite(value))
          || rms.some((value) => !Number.isFinite(value))) {
        facts.push(unavailableFact(common, 'peak-rms-crest-v0', 'provider-null',
          'FFmpeg returned no finite peak or RMS for a selected channel.'));
      } else {
        if (peaks.some((value, index) => value > 0 || rms[index]! > value)) {
          throw new AudioFactsError('FFmpeg returned invalid peak or RMS values', 'provider-failure');
        }
        const value = Math.max(...peaks) - Math.max(...rms);
        if (value < 0) {
          throw new AudioFactsError('FFmpeg returned a negative crest value', 'provider-failure');
        }
        facts.push(fact(common, {
          fieldId: 'peak-rms-crest-v0', value, unit: 'dB', kind: 'derived-measurement',
          formula: { id: 'ffmpeg-peak-rms-crest-v0', settings: metricSettings('peak-rms-crest-v0') },
          tolerance: {
            kind: 'absolute', value: 0.001, unit: 'dB',
            basis: 'declared parsed-decibel comparison tolerance',
          },
          uncertainty: 'The result depends on FFmpeg complete-range peak and RMS aggregates.',
          unavailable: null,
        }));
      }
    }
  }
  const validationStarted = performance.now();
  const expected = selectedFields(request.task.property);
  validateFacts(facts, expected);
  const outputValidation = performance.now() - validationStarted;
  onTiming?.({ phase: 'output-validation', elapsedMs: outputValidation });
  const finalStarted = performance.now();
  await verifyUnchanged(request.artifact);
  const finalSourceVerification = performance.now() - finalStarted;
  onTiming?.({ phase: 'final-source-verification', elapsedMs: finalSourceVerification });
  return {
    schema: AUDIO_FACTS_RESULT_SCHEMA,
    task: structuredClone(request.task), source, provider,
    coverage: {
      requestedProperty: request.task.property,
      selectedFields: expected,
      omittedFields: [...ALL_AUDIO_FACT_FIELDS.filter((fieldId) => !expected.includes(fieldId)),
        'sample-peak', 'pitch', 'onsets', 'stereo-correlation',
        'modulation-rate', 'spectrogram', 'perceptual-label'],
      sampleRange: structuredClone(request.artifact.artifact.scope.sampleRange),
      channelIndices: [...request.artifact.artifact.scope.channelIndices],
      complete: facts.every((item) => item.value !== null) || gate,
    },
    authority: 'measured-signal-evidence', facts, silenceGateApplied: gate, warnings: [],
    timingMs: {
      sourceReadAndHash: request.artifact.timingMs.readAndHash,
      headerAndScopeValidation: request.artifact.timingMs.headerAndScopeValidation,
      providerProbe: probe.elapsedMs,
      silence: silence.elapsedMs,
      selectedFacts: selectedFactsMs,
      outputValidation,
      finalSourceVerification,
    },
  };
}

const ANALYSIS_CAPABILITIES = [
  'compare-brightness-v0', 'compare-loudness-v0', 'compare-crest-v0', 'measure-silence-v0',
] as const;

function moduleHealth(discovery: AudioExecutableDiscovery): ModuleHealth {
  const missing: MissingCapability[] = [];
  if (discovery.ffprobeVersion === null) {
    missing.push(...ANALYSIS_CAPABILITIES.map((capability) => ({
      capability, dependency: 'ffprobe', reason: 'FFprobe is unavailable.',
    })));
  }
  if (discovery.ffmpegVersion === null) {
    missing.push(...ANALYSIS_CAPABILITIES.map((capability) => ({
      capability, dependency: 'ffmpeg', reason: 'FFmpeg is unavailable.',
    })));
  }
  return {
    state: missing.length === 0 ? 'available' : 'degraded',
    capabilities: missing.length === 0 ? ANALYSIS_CAPABILITIES : [],
    missingCapabilities: missing,
    dependencyVersions: {
      node: process.versions.node,
      ...(discovery.ffprobeVersion === null ? {} : { ffprobe: discovery.ffprobeVersion }),
      ...(discovery.ffmpegVersion === null ? {} : { ffmpeg: discovery.ffmpegVersion }),
    },
  };
}

/** Create the lazy audio-facts-v0 workstation module. */
export function audioFactsModule(
  options: AudioFactsModuleOptions,
): WorkstationModule<AudioFactsRequest, AudioFactsResult> {
  let discovery: AudioExecutableDiscovery | undefined;
  return {
    descriptor: {
      moduleId: AUDIO_FACTS_MODULE_ID,
      version: AUDIO_FACTS_MODULE_VERSION,
      acceptedSchemas: [AUDIO_FACTS_REQUEST_SCHEMA],
      emittedSchemas: [AUDIO_FACTS_RESULT_SCHEMA],
      capabilities: ANALYSIS_CAPABILITIES,
      startupDeadlineMs: AUDIO_STARTUP_DEADLINE_MS,
      requestDeadlineMs: AUDIO_REQUEST_DEADLINE_MS,
    },
    preflight: async (request) => {
      try {
        if (request.sourceSha256 !== request.payload?.artifact?.artifact?.sha256) {
          throw new AudioFactsError(
            'the module request source digest does not match the audio artifact',
            'source-mismatch',
          );
        }
        await preflightAudioFactsRequest(request.payload);
      } catch (error) {
        if (error instanceof AudioFactsError) {
          throw new WorkstationModuleError(
            error.message,
            error.code === 'source-mismatch' ? 'source-mismatch' : 'verification-failed',
            AUDIO_FACTS_MODULE_ID,
            { cause: error },
          );
        }
        throw error;
      }
    },
    start: async (signal) => {
      const started = performance.now();
      discovery = await options.adapter.discover(signal);
      options.onTiming?.({ phase: 'provider-discovery', elapsedMs: performance.now() - started });
      return moduleHealth(discovery);
    },
    handle: async (request, signal) => {
      if (discovery === undefined) {
        throw new WorkstationModuleError(
          'the audio-facts module did not start', 'missing-dependency', AUDIO_FACTS_MODULE_ID,
        );
      }
      try {
        return {
          schema: WORKSTATION_RESPONSE_SCHEMA,
          requestId: request.requestId,
          sourceSha256: request.sourceSha256,
          outputSchema: AUDIO_FACTS_RESULT_SCHEMA,
          payload: await analyzeAudioFacts(
            options.adapter, discovery, request.payload, options.onTiming, signal,
          ),
        };
      } catch (error) {
        if (error instanceof AudioFactsError) {
          throw new WorkstationModuleError(
            error.message,
            error.code === 'missing-dependency' ? 'missing-dependency'
              : error.code === 'source-mismatch' ? 'source-mismatch'
                : error.code === 'timeout' ? 'timeout' : 'verification-failed',
            AUDIO_FACTS_MODULE_ID,
            { cause: error },
          );
        }
        throw error;
      }
    },
  };
}
