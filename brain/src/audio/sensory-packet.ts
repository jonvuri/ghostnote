/** Task-only paired projections of audio-facts-v0. */
import {
  AUDIO_FACT_SCHEMA, AUDIO_FACTS_RESULT_SCHEMA, AUDIO_PROPERTY_DEFINITIONS, AudioFactsError,
  type AudioFact, type AudioFactFieldId, type AudioFactsResult, type AudioProperty,
} from './audio-facts.js';

export const SENSORY_PACKET_SCHEMA = 'ghostnote-sensory-packet-v1';
export const SENSORY_REQUEST_SCHEMA = 'ghostnote-sensory-request-v1';
export const BRIGHTNESS_LEVEL_LIMIT_LU = 0.2;

export interface SensoryPairRequest {
  readonly schema: typeof SENSORY_REQUEST_SCHEMA;
  readonly taskId: string;
  readonly property: AudioProperty;
  readonly operationalDefinition: string;
  readonly decisionPurpose: string;
  readonly A: AudioFactsResult;
  readonly B: AudioFactsResult;
}

export interface PairedAudioField {
  readonly fieldId: AudioFactFieldId;
  readonly A: AudioFact;
  readonly B: AudioFact;
  readonly B_minus_A: number | null;
  readonly unit: AudioFact['unit'];
  readonly comparisonTolerance: AudioFact['tolerance'];
  readonly decisionPurpose: string;
  readonly status: 'comparable' | 'no-change' | 'unavailable';
}

export interface SensoryPacketV1 {
  readonly schema: typeof SENSORY_PACKET_SCHEMA;
  readonly taskId: string;
  readonly property: {
    readonly id: AudioProperty;
    readonly operationalDefinition: string;
  };
  readonly sources: {
    readonly A: AudioFactsResult['source'];
    readonly B: AudioFactsResult['source'];
  };
  readonly fields: readonly PairedAudioField[];
  readonly evidenceStatus: 'comparable' | 'no-change' | 'insufficient';
  readonly decisionPurpose: string;
  readonly limits: readonly string[];
  readonly authority: 'paired-measurement-projection';
  readonly timingMs: {
    readonly routing: number;
  };
}

const ROUTES: Readonly<Record<AudioProperty, readonly AudioFactFieldId[]>> = {
  brightness: ['silence-duration-v0', 'integrated-loudness-v0', 'spectral-rolloff-85-v0'],
  loudness: ['silence-duration-v0', 'integrated-loudness-v0'],
  crest: ['silence-duration-v0', 'peak-rms-crest-v0'],
  silence: ['silence-duration-v0'],
};

const PRIMARY_FIELD: Readonly<Record<AudioProperty, AudioFactFieldId>> = {
  brightness: 'spectral-rolloff-85-v0',
  loudness: 'integrated-loudness-v0',
  crest: 'peak-rms-crest-v0',
  silence: 'silence-duration-v0',
};

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function factById(result: AudioFactsResult, fieldId: AudioFactFieldId): AudioFact {
  const matches = result.facts.filter((fact) => fact.fieldId === fieldId);
  if (matches.length !== 1) {
    throw new AudioFactsError(
      `the ${fieldId} field is unavailable for source ${result.source.sourceId}`,
      'incompatible-comparison',
    );
  }
  return matches[0]!;
}

function validateResult(result: AudioFactsResult, property: AudioProperty): void {
  const expectedFields = ROUTES[property];
  if (result.coverage.requestedProperty !== property
      || result.authority !== 'measured-signal-evidence'
      || canonical(result.coverage.selectedFields) !== canonical(expectedFields)
      || result.facts.length !== expectedFields.length
      || result.facts.some((fact, index) => fact.schema !== AUDIO_FACT_SCHEMA
        || fact.fieldId !== expectedFields[index]
        || canonical(fact.source) !== canonical(result.source)
        || canonical(fact.provider) !== canonical(result.provider)
        || canonical(fact.coverage.requestedSamples) !== canonical(result.coverage.sampleRange)
        || canonical(fact.coverage.observedSamples) !== canonical(result.coverage.sampleRange)
        || canonical(fact.coverage.channelIndices) !== canonical(result.coverage.channelIndices)
        || fact.coverage.complete !== true
        || (fact.value === null) !== (fact.unavailable !== null)
        || (fact.value !== null && !Number.isFinite(fact.value))
        || fact.tolerance.kind !== 'absolute' || fact.tolerance.unit !== fact.unit
        || !Number.isFinite(fact.tolerance.value) || fact.tolerance.value < 0)) {
    throw new AudioFactsError(
      'the audio fact result has inconsistent provenance or coverage',
      'incompatible-comparison',
    );
  }
  const silence = result.facts[0]!;
  const durationSamples = result.coverage.sampleRange.end - result.coverage.sampleRange.start;
  const silenceSamples = silence.value === null
    ? null : Math.round(silence.value * silence.coverage.sampleRateHz);
  const toleranceSamples = Math.round(
    silence.tolerance.value * silence.coverage.sampleRateHz,
  );
  const completeSilence = silence.fieldId === 'silence-duration-v0'
    && silenceSamples !== null
    && Math.abs(silenceSamples - durationSamples) <= toleranceSamples;
  const gatedDependentsAreNull = result.facts.slice(1).every(
    (fact) => fact.value === null && fact.unavailable?.code === 'silence-gate',
  );
  if (result.silenceGateApplied !== completeSilence
      || (result.silenceGateApplied && !gatedDependentsAreNull)) {
    throw new AudioFactsError(
      'the silence gate does not match its fact coverage', 'incompatible-comparison',
    );
  }
}

function comparableCoverage(left: AudioFact, right: AudioFact): boolean {
  const leftSamples = left.coverage.observedSamples.end - left.coverage.observedSamples.start;
  const rightSamples = right.coverage.observedSamples.end - right.coverage.observedSamples.start;
  return left.coverage.sampleRateHz === right.coverage.sampleRateHz
    && leftSamples === rightSamples
    && canonical(left.coverage.channelIndices) === canonical(right.coverage.channelIndices)
    && left.coverage.channelPolicy === right.coverage.channelPolicy
    && canonical(left.coverage.frames) === canonical(right.coverage.frames);
}

function pairField(
  left: AudioFact,
  right: AudioFact,
  decisionPurpose: string,
): PairedAudioField {
  if (left.fieldId !== right.fieldId || left.unit !== right.unit || left.kind !== right.kind
      || left.formula.id !== right.formula.id
      || canonical(left.formula.settings) !== canonical(right.formula.settings)
      || canonical(left.tolerance) !== canonical(right.tolerance)
      || canonical(left.provider) !== canonical(right.provider)
      || !comparableCoverage(left, right)) {
    throw new AudioFactsError(
      `the ${left.fieldId} facts are not comparison-compatible`, 'incompatible-comparison',
    );
  }
  const delta = left.value === null || right.value === null ? null : right.value - left.value;
  if (delta !== null && !Number.isFinite(delta)) {
    throw new AudioFactsError(
      `the ${left.fieldId} delta is not finite`, 'incompatible-comparison',
    );
  }
  return {
    fieldId: left.fieldId,
    A: structuredClone(left),
    B: structuredClone(right),
    B_minus_A: delta,
    unit: left.unit,
    comparisonTolerance: structuredClone(left.tolerance),
    decisionPurpose,
    status: delta === null ? 'unavailable'
      : Math.abs(delta) <= left.tolerance.value ? 'no-change' : 'comparable',
  };
}

function validateRequest(request: SensoryPairRequest): void {
  if (request.schema !== SENSORY_REQUEST_SCHEMA || request.taskId.trim().length === 0
      || request.taskId.length > 128 || request.decisionPurpose.trim().length === 0
      || !Object.hasOwn(AUDIO_PROPERTY_DEFINITIONS, request.property)
      || request.operationalDefinition !== AUDIO_PROPERTY_DEFINITIONS[request.property]) {
    throw new AudioFactsError('the requested sensory property is not mapped', 'unmapped-property');
  }
  for (const result of [request.A, request.B]) {
    if (result.schema !== AUDIO_FACTS_RESULT_SCHEMA || result.task.property !== request.property
        || result.task.operationalDefinition !== request.operationalDefinition) {
      throw new AudioFactsError(
        'the audio fact result does not match the sensory task', 'incompatible-comparison',
      );
    }
    validateResult(result, request.property);
  }
}

function fieldPurpose(property: AudioProperty, fieldId: AudioFactFieldId): string {
  if (fieldId === 'silence-duration-v0') return 'Apply the thresholded silence gate.';
  if (property === 'brightness' && fieldId === 'integrated-loudness-v0') {
    return 'Confirm level matching before the rolloff comparison.';
  }
  if (fieldId === 'spectral-rolloff-85-v0') {
    return 'Compare only the declared 85% spectral-rolloff brightness proxy.';
  }
  if (fieldId === 'integrated-loudness-v0') return 'Compare integrated loudness.';
  return 'Compare peak-to-RMS crest or detect no change in that metric.';
}

/** Copy compatible facts into sensory v1. This function starts no provider. */
export function routeAudioEvidence(request: SensoryPairRequest): SensoryPacketV1 {
  const started = performance.now();
  validateRequest(request);
  const fields = ROUTES[request.property].map((fieldId) => pairField(
    factById(request.A, fieldId), factById(request.B, fieldId),
    fieldPurpose(request.property, fieldId),
  ));
  const primary = fields.find((field) => field.fieldId === PRIMARY_FIELD[request.property])!;
  const silenceBlocked = request.property !== 'silence'
    && (request.A.silenceGateApplied || request.B.silenceGateApplied);
  const loudness = request.property === 'brightness'
    ? fields.find((field) => field.fieldId === 'integrated-loudness-v0') : undefined;
  const levelBlocked = loudness !== undefined
    && (loudness.B_minus_A === null
      || Math.abs(loudness.B_minus_A) > BRIGHTNESS_LEVEL_LIMIT_LU);
  const unavailable = fields.some((field) => field.status === 'unavailable');
  const evidenceStatus = silenceBlocked || levelBlocked || unavailable
    ? 'insufficient' as const
    : primary.status === 'no-change' ? 'no-change' as const : 'comparable' as const;
  const limits = [
    'This packet contains measured signal evidence. It contains no aesthetic or operator verdict.',
    'Different source hashes do not prove audible change.',
    'Equal selected metrics do not prove equal music.',
    request.property === 'brightness'
      ? 'Rolloff is usable only when the integrated loudness difference is at most 0.2 LU.'
      : request.property === 'crest'
        ? 'Crest does not define general dynamic quality.'
        : request.property === 'silence'
          ? 'Silence uses a -90 dBFS noise floor and requires complete-range gate coverage.'
          : 'Loudness is the target; no level-match gate applies.',
  ];
  return {
    schema: SENSORY_PACKET_SCHEMA,
    taskId: request.taskId,
    property: { id: request.property, operationalDefinition: request.operationalDefinition },
    sources: { A: structuredClone(request.A.source), B: structuredClone(request.B.source) },
    fields,
    evidenceStatus,
    decisionPurpose: request.decisionPurpose,
    limits,
    authority: 'paired-measurement-projection',
    timingMs: { routing: performance.now() - started },
  };
}
