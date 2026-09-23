/** Phase 7d module-only run for verified audio facts and sensory v1. */
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  AUDIO_ARTIFACT_SCHEMA, AUDIO_FACTS_MODULE_ID, AUDIO_FACTS_REQUEST_SCHEMA,
  AUDIO_PROPERTY_DEFINITIONS, SENSORY_REQUEST_SCHEMA, audioFactsModule,
  audioFactsRequest, createFfmpegExecutableAdapter, routeAudioEvidence,
  verifyAudioArtifact, type AudioArtifactDeclaration, type AudioFactsResult,
} from '../audio/index.js';
import {
  WORKSTATION_REQUEST_SCHEMA, WorkstationModuleRegistry,
} from '../workstation/index.js';

const SAMPLE_RATE = 44_100;
const DURATION_SECONDS = 4;
const SAMPLE_COUNT = SAMPLE_RATE * DURATION_SECONDS;

function wav(
  kind: 'low' | 'bright' | 'loudness-low' | 'loudness-high' | 'same' | 'silence',
  gain: number,
): Buffer {
  const dataBytes = SAMPLE_COUNT * 2 * 3;
  const output = Buffer.alloc(44 + dataBytes);
  output.write('RIFF', 0, 'ascii');
  output.writeUInt32LE(output.byteLength - 8, 4);
  output.write('WAVE', 8, 'ascii');
  output.write('fmt ', 12, 'ascii');
  output.writeUInt32LE(16, 16);
  output.writeUInt16LE(1, 20);
  output.writeUInt16LE(2, 22);
  output.writeUInt32LE(SAMPLE_RATE, 24);
  output.writeUInt32LE(SAMPLE_RATE * 6, 28);
  output.writeUInt16LE(6, 32);
  output.writeUInt16LE(24, 34);
  output.write('data', 36, 'ascii');
  output.writeUInt32LE(dataBytes, 40);
  for (let sample = 0; sample < SAMPLE_COUNT; sample += 1) {
    const seconds = sample / SAMPLE_RATE;
    const fade = Math.min(1, seconds * 20, (DURATION_SECONDS - seconds) * 20);
    const signal = kind === 'low'
      ? (0.16 * Math.sin(2 * Math.PI * 220 * seconds)
        + 0.015 * Math.sin(2 * Math.PI * 440 * seconds)) * fade
      : kind === 'bright'
        ? (0.14 * Math.sin(2 * Math.PI * 220 * seconds)
          + 0.055 * Math.sin(2 * Math.PI * 4_000 * seconds)) * fade
        : kind === 'loudness-low'
          ? 0.05 * Math.sin(2 * Math.PI * 440 * seconds) * fade
          : kind === 'loudness-high'
            ? 0.20 * Math.sin(2 * Math.PI * 440 * seconds) * fade
            : kind === 'same'
              ? (0.13 * Math.sin(2 * Math.PI * 440 * seconds) * fade
                + 0.02 * Math.sin(2 * Math.PI * 1_320 * seconds)) * fade
              : 0;
    const value = Math.max(-8_388_608, Math.min(8_388_607,
      Math.round(signal * gain * 8_388_607)));
    output.writeIntLE(value, 44 + sample * 6, 3);
    output.writeIntLE(value, 47 + sample * 6, 3);
  }
  return output;
}

function rangeChannelWav(start: number, end: number): Buffer {
  const output = wav('silence', 1);
  for (let sample = start; sample < end; sample += 1) {
    const seconds = sample / SAMPLE_RATE;
    const value = Math.round(0.1 * Math.sin(2 * Math.PI * 440 * seconds) * 8_388_607);
    output.writeIntLE(value, 47 + sample * 6, 3);
  }
  return output;
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function declaration(sourceId: string, path: string, bytes: Uint8Array): AudioArtifactDeclaration {
  return {
    schema: AUDIO_ARTIFACT_SCHEMA,
    sourceId,
    absolutePath: path,
    mediaType: 'audio/wav',
    byteCount: bytes.byteLength,
    sha256: sha256(bytes),
    digestDomain: 'file-bytes',
    creator: 'phase7d generated MIT fixture',
    permissionBasis: 'generated temporary session fixture',
    format: {
      container: 'wav', codec: 'pcm_s24le', sampleRateHz: SAMPLE_RATE,
      channels: 2, bitsPerSample: 24,
    },
    scope: { sampleRange: { start: 0, end: SAMPLE_COUNT }, channelIndices: [0, 1] },
  };
}

const root = await mkdtemp(join(tmpdir(), 'ghostnote-phase7d-'));
try {
  const adapter = createFfmpegExecutableAdapter();
  const selection = { sampleStart: 0, sampleEnd: SAMPLE_COUNT, channelIndices: [0, 1] };
  const fixtureStarted = performance.now();
  const lowInitial = wav('low', 1);
  const brightInitial = wav('bright', 1);
  const sameInitial = wav('same', 1);
  const [lowInitialLufs, brightInitialLufs, sameInitialLufs] = await Promise.all([
    adapter.integratedLoudness(lowInitial, selection),
    adapter.integratedLoudness(brightInitial, selection),
    adapter.integratedLoudness(sameInitial, selection),
  ]);
  if (lowInitialLufs === null || brightInitialLufs === null || sameInitialLufs === null) {
    throw new Error('the level-match setup returned null loudness');
  }
  const targetLufs = -24;
  const low = wav('low', 10 ** ((targetLufs - lowInitialLufs) / 20));
  const bright = wav('bright', 10 ** ((targetLufs - brightInitialLufs) / 20));
  const same = wav('same', 10 ** ((targetLufs - sameInitialLufs) / 20));
  const loudnessLow = wav('loudness-low', 1);
  const loudnessHigh = wav('loudness-high', 1);
  const silence = wav('silence', 1);
  const rangeChannel = rangeChannelWav(4_410, 48_510);
  const fixtureSetupMs = performance.now() - fixtureStarted;
  const lowPath = join(root, 'brightness-A.wav');
  const brightPath = join(root, 'brightness-B.wav');
  const sameAPath = join(root, 'audio-same-A.wav');
  const sameBPath = join(root, 'audio-same-B.wav');
  const loudnessAPath = join(root, 'loudness-A.wav');
  const loudnessBPath = join(root, 'loudness-B.wav');
  const silenceAPath = join(root, 'silence-A.wav');
  const silenceBPath = join(root, 'silence-B.wav');
  const rangeChannelPath = join(root, 'range-channel-control.wav');
  await Promise.all([
    writeFile(lowPath, low), writeFile(brightPath, bright),
    writeFile(loudnessAPath, loudnessLow), writeFile(loudnessBPath, loudnessHigh),
    writeFile(sameAPath, same), writeFile(sameBPath, same),
    writeFile(silenceAPath, silence), writeFile(silenceBPath, silence),
    writeFile(rangeChannelPath, rangeChannel),
  ]);
  const declarations = [
    declaration('brightness-A', lowPath, low), declaration('brightness-B', brightPath, bright),
    declaration('loudness-A', loudnessAPath, loudnessLow),
    declaration('loudness-B', loudnessBPath, loudnessHigh),
    declaration('audio-same-A', sameAPath, same), declaration('audio-same-B', sameBPath, same),
    declaration('silence-A', silenceAPath, silence),
    declaration('silence-B', silenceBPath, silence),
  ];
  const rangeChannelDeclaration: AudioArtifactDeclaration = {
    ...declaration('range-channel-control', rangeChannelPath, rangeChannel),
    scope: { sampleRange: { start: 4_410, end: 48_510 }, channelIndices: [1] },
  };
  const allDeclarations = [...declarations, rangeChannelDeclaration];
  const expectedHashes = [
    '69be4de7391b91c0b1b0faa648478cb7e3032b0c7f3620215afa7c170fafff09',
    '03cb1e5ba6bd7762af29e812b77a4f1f008e303facd7b52b4cdec84d039f052a',
    'aa2104b48487f887d58abb358b85cde7594cd96d5397f2cab367ac1ce7670ab4',
    '9c04179da1385305ef87a303e16ef303420f9162e084861b947443ee315b4cd8',
    'f10eadf0d582cabd2df667196a3492c6849a63986849353685741782d8fb9549',
    'f10eadf0d582cabd2df667196a3492c6849a63986849353685741782d8fb9549',
    '9f8b353cfc3da23638f91bdb9da5fc4c34013b4f2cb65e52a5f63d56e77c8254',
    '9f8b353cfc3da23638f91bdb9da5fc4c34013b4f2cb65e52a5f63d56e77c8254',
  ];
  if (JSON.stringify(declarations.map((item) => item.sha256)) !== JSON.stringify(expectedHashes)) {
    throw new Error('the generated source hashes do not match the E118 controls');
  }
  const sourceStarted = performance.now();
  const verified = await Promise.all(
    allDeclarations.map(verifyAudioArtifact),
  );
  const sourceVerificationMs = performance.now() - sourceStarted;
  const events: { phase: string; elapsedMs: number }[] = [];
  const registry = new WorkstationModuleRegistry();
  registry.register(audioFactsModule({ adapter, onTiming: (event) => events.push(event) }));
  const run = async (
    index: number,
    property: 'brightness' | 'loudness' | 'crest' | 'silence',
    taskId: string,
  ): Promise<{ result: AudioFactsResult; elapsedMs: number }> => {
    const request = audioFactsRequest(verified[index]!, {
      taskId,
      property,
      operationalDefinition: AUDIO_PROPERTY_DEFINITIONS[property],
    });
    const started = performance.now();
    const response = await registry.request<typeof request, AudioFactsResult>(
      AUDIO_FACTS_MODULE_ID,
      {
        schema: WORKSTATION_REQUEST_SCHEMA,
        requestId: `phase7d-${allDeclarations[index]!.sourceId}`,
        inputSchema: AUDIO_FACTS_REQUEST_SCHEMA,
        sourceSha256: allDeclarations[index]!.sha256,
        payload: request,
      },
    );
    return { result: response.payload, elapsedMs: performance.now() - started };
  };
  const runs = [
    await run(0, 'brightness', 'phase7d-level-matched-brightness'),
    await run(1, 'brightness', 'phase7d-level-matched-brightness'),
    await run(2, 'loudness', 'phase7d-loudness'),
    await run(3, 'loudness', 'phase7d-loudness'),
    await run(4, 'crest', 'phase7d-crest-no-change'),
    await run(5, 'crest', 'phase7d-crest-no-change'),
    await run(6, 'brightness', 'phase7d-silence-control'),
    await run(7, 'brightness', 'phase7d-silence-control'),
  ];
  const rangeChannelRun = await run(8, 'silence', 'phase7d-range-channel-control');
  const routingStarted = performance.now();
  const brightnessPacket = routeAudioEvidence({
    schema: SENSORY_REQUEST_SCHEMA,
    taskId: 'phase7d-level-matched-brightness',
    property: 'brightness',
    operationalDefinition: AUDIO_PROPERTY_DEFINITIONS.brightness,
    decisionPurpose: 'Compare the declared level-controlled brightness proxy.',
    A: runs[0]!.result,
    B: runs[1]!.result,
  });
  const crestPacket = routeAudioEvidence({
    schema: SENSORY_REQUEST_SCHEMA,
    taskId: 'phase7d-crest-no-change',
    property: 'crest',
    operationalDefinition: AUDIO_PROPERTY_DEFINITIONS.crest,
    decisionPurpose: 'Detect a crest change or no change.',
    A: runs[4]!.result,
    B: runs[5]!.result,
  });
  const loudnessPacket = routeAudioEvidence({
    schema: SENSORY_REQUEST_SCHEMA,
    taskId: 'phase7d-loudness',
    property: 'loudness',
    operationalDefinition: AUDIO_PROPERTY_DEFINITIONS.loudness,
    decisionPurpose: 'Compare the declared integrated loudness.',
    A: runs[2]!.result,
    B: runs[3]!.result,
  });
  const silencePacket = routeAudioEvidence({
    schema: SENSORY_REQUEST_SCHEMA,
    taskId: 'phase7d-silence-control',
    property: 'brightness',
    operationalDefinition: AUDIO_PROPERTY_DEFINITIONS.brightness,
    decisionPurpose: 'Refuse a brightness direction for silence.',
    A: runs[6]!.result,
    B: runs[7]!.result,
  });
  const routingInclusiveMs = performance.now() - routingStarted;
  const brightnessValues = runs.slice(0, 2).map((run) => Object.fromEntries(
    run.result.facts.map((fact) => [fact.fieldId, fact.value]),
  ));
  const loudnessValues = runs.slice(2, 4).map((run) => run.result.facts
    .find((fact) => fact.fieldId === 'integrated-loudness-v0')?.value);
  const crestValues = runs.slice(4, 6).map((run) => run.result.facts
    .find((fact) => fact.fieldId === 'peak-rms-crest-v0')?.value);
  if (brightnessPacket.evidenceStatus !== 'comparable'
      || brightnessValues[0]?.['integrated-loudness-v0'] !== -24
      || brightnessValues[1]?.['integrated-loudness-v0'] !== -24
      || brightnessValues[0]?.['spectral-rolloff-85-v0'] !== 226.099
      || brightnessValues[1]?.['spectral-rolloff-85-v0'] !== 3_999.79
      || loudnessPacket.evidenceStatus !== 'comparable'
      || loudnessValues[0] !== -26.7 || loudnessValues[1] !== -14.7
      || crestPacket.evidenceStatus !== 'no-change'
      || crestValues.some((value) => value === null || value === undefined
        || Math.abs(value - 1.755905) > 0.001)
      || rangeChannelRun.result.facts[0]?.value !== 0
      || rangeChannelRun.result.coverage.sampleRange.start !== 4_410
      || rangeChannelRun.result.coverage.sampleRange.end !== 48_510
      || JSON.stringify(rangeChannelRun.result.coverage.channelIndices) !== '[1]'
      || silencePacket.evidenceStatus !== 'insufficient'
      || runs.slice(6).some((run) => !run.result.silenceGateApplied
        || run.result.facts[0]?.value !== 4
        || run.result.facts[1]?.value !== null || run.result.facts[2]?.value !== null)) {
    throw new Error('the retained E118 audio controls did not reproduce');
  }
  console.log(JSON.stringify({
    schema: 'ghostnote-phase7d-run-v0',
    mode: 'module-only',
    permissions: ['read generated local audio', 'no Bitwig connection', 'no project write'],
    enabledModules: registry.discover(),
    sources: allDeclarations.map((item) => ({
      sourceId: item.sourceId, sha256: item.sha256, bytes: item.byteCount,
      sampleRange: item.scope.sampleRange, channelIndices: item.scope.channelIndices,
    })),
    facts: [...runs, rangeChannelRun].map(({ result }) => ({
      sourceId: result.source.sourceId,
      values: Object.fromEntries(result.facts.map((fact) => [fact.fieldId, fact.value])),
      silenceGateApplied: result.silenceGateApplied,
      timingMs: result.timingMs,
    })),
    packets: [brightnessPacket, loudnessPacket, crestPacket, silencePacket].map((packet) => ({
      taskId: packet.taskId,
      schema: packet.schema,
      evidenceStatus: packet.evidenceStatus,
      deltas: Object.fromEntries(packet.fields.map((field) => [field.fieldId, field.B_minus_A])),
      limits: packet.limits,
      timingMs: packet.timingMs,
    })),
    timingMs: {
      fixtureSetup: fixtureSetupMs,
      sourceVerificationInclusive: sourceVerificationMs,
      requestInclusive: Object.fromEntries(runs.map((run, index) => [
        declarations[index]!.sourceId, run.elapsedMs,
      ]).concat([['range-channel-control', rangeChannelRun.elapsedMs]])),
      routingInclusive: routingInclusiveMs,
      events,
    },
    cleanup: 'generated WAV files and temporary directory removed in finally',
  }, null, 2));
} finally {
  await rm(root, { recursive: true, force: true });
}
