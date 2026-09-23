/** Frozen Phase 7f profile and cross-module run record. */
import { z } from 'zod';

import {
  AUDIO_CAPTURE_MODULE_ID, AUDIO_CAPTURE_REQUEST_SCHEMA, AUDIO_CAPTURE_RESULT_SCHEMA,
} from '../audio/audio-capture.js';
import {
  AUDIO_FACTS_MODULE_ID, AUDIO_FACTS_REQUEST_SCHEMA, AUDIO_FACTS_RESULT_SCHEMA,
  AUDIO_PROPERTY_DEFINITIONS,
} from '../audio/audio-facts.js';
import {
  BRIGHTNESS_LEVEL_LIMIT_LU, SENSORY_PACKET_SCHEMA, SENSORY_REQUEST_SCHEMA,
} from '../audio/sensory-packet.js';

export const PHASE_7F_RUN_PROFILE = 'phase-7f-audio-guided-sound-design-v0';
export const HYBRID_RUN_RECORD_SCHEMA = 'ghostnote-hybrid-run-record-v0';

export const PHASE_7F_AUDIO_GUIDED_PROFILE = Object.freeze({
  profile: PHASE_7F_RUN_PROFILE,
  operatingMode: 'hybrid',
  stableToolProfile: 'stable-v1',
  descriptionVersion: 'ghostnote-description-v23',
  modules: [
    {
      moduleId: AUDIO_CAPTURE_MODULE_ID,
      version: '0',
      acceptedSchemas: [AUDIO_CAPTURE_REQUEST_SCHEMA],
      emittedSchemas: [AUDIO_CAPTURE_RESULT_SCHEMA],
    },
    {
      moduleId: AUDIO_FACTS_MODULE_ID,
      version: '0',
      acceptedSchemas: [AUDIO_FACTS_REQUEST_SCHEMA],
      emittedSchemas: [AUDIO_FACTS_RESULT_SCHEMA],
    },
    {
      moduleId: 'ghostnote-sensory-router',
      version: '1',
      acceptedSchemas: [SENSORY_REQUEST_SCHEMA],
      emittedSchemas: [SENSORY_PACKET_SCHEMA],
    },
    {
      moduleId: 'ghostnote-hybrid-run-record',
      version: '0',
      acceptedSchemas: [HYBRID_RUN_RECORD_SCHEMA],
      emittedSchemas: [HYBRID_RUN_RECORD_SCHEMA],
    },
  ],
  task: {
    property: 'brightness',
    operationalDefinition: AUDIO_PROPERTY_DEFINITIONS.brightness,
    maximumAbsoluteLoudnessDeltaLu: BRIGHTNESS_LEVEL_LIMIT_LU,
    silenceGate: 'silence-duration-v0',
    primaryField: 'spectral-rolloff-85-v0',
  },
  intendedSeams: ['S01', 'S02', 'S11', 'S12', 'S13', 'S16', 'S17'],
} as const);

const identifier = z.string().min(1).max(512);
const sha256 = z.string().regex(/^[0-9a-f]{64}$/);
const authority = z.enum([
  'exact-observation', 'derived-measurement', 'agent-interpretation', 'ui-observation',
  'verified-outcome', 'operator-confirmed',
]);

const linkedId = z.object({
  kind: z.enum(['request', 'source', 'artifact', 'evidence', 'operation', 'change']),
  id: identifier,
}).strict();

const seam = z.object({
  id: z.string().regex(/^S(?:0[1-9]|1[0-7])$/),
  producer: identifier,
  consumer: identifier,
  formats: z.array(z.object({
    name: identifier,
    producerVersion: identifier,
    consumerVersion: identifier,
  }).strict()).min(1),
  projection: z.string().min(1),
  translation: z.string().min(1),
  defaults: z.array(z.string()),
  validation: z.array(z.string()).min(1),
  droppedData: z.array(z.string()),
  verdict: z.enum(['pass', 'incompatible', 'not-run']),
}).strict();

const recordSchema = z.object({
  schema: z.literal(HYBRID_RUN_RECORD_SCHEMA),
  profile: z.literal(PHASE_7F_RUN_PROFILE),
  status: z.enum(['running', 'complete', 'blocked', 'incomplete']),
  rootSession: z.object({
    id: identifier,
    client: identifier,
    model: identifier,
    operatingMode: z.literal('hybrid'),
    startedAt: identifier,
    finishedAt: z.string().optional(),
  }).strict(),
  permissions: z.object({
    projectPath: identifier,
    temporaryProjectLocalWaveFiles: z.literal(true),
    boundedDeviceParameters: z.literal(true),
    changesRequireRecordedIds: z.literal(true),
    externalReference: z.literal(false),
  }).strict(),
  versions: z.record(z.string(), z.string()),
  modules: z.array(z.object({
    moduleId: identifier,
    version: identifier,
    state: identifier,
    acceptedSchemas: z.array(identifier),
    emittedSchemas: z.array(identifier),
  }).strict()).min(2),
  request: z.object({ id: identifier, text: identifier }).strict(),
  links: z.array(linkedId).min(1),
  source: z.object({
    id: identifier,
    projectFileSha256: sha256,
    trackId: identifier,
    trackName: identifier,
    launcherRow: z.number().int().nonnegative(),
    devicePosition: z.number().int().nonnegative(),
    deviceName: identifier,
    parameterId: identifier,
    parameterName: identifier,
  }).strict(),
  artifacts: z.array(z.object({
    id: identifier,
    role: z.enum(['A', 'B']),
    absolutePath: identifier,
    sha256,
    byteCount: z.number().int().positive(),
    owned: z.literal(true),
  }).strict()).max(2),
  evidence: z.array(z.object({
    id: identifier,
    role: z.enum(['A', 'B', 'comparison']),
    schema: identifier,
    authority,
    sourceId: identifier,
  }).strict()).max(3),
  operations: z.array(z.object({
    id: identifier,
    name: identifier,
    elapsedMs: z.number().nonnegative(),
    outcome: z.enum(['pass', 'refused', 'failed']),
  }).strict()),
  changes: z.array(z.object({
    id: identifier,
    operationId: identifier,
    verified: z.boolean(),
    finalDisposition: z.enum(['retained', 'reverted', 'pending']),
  }).strict()),
  seams: z.array(seam),
  authorities: z.array(z.object({
    claim: identifier,
    authority,
    evidenceId: identifier,
  }).strict()),
  uiEvents: z.array(z.object({
    id: identifier,
    action: identifier,
    observation: identifier,
    ownership: z.literal('external-ui'),
  }).strict()),
  costs: z.object({
    toolCalls: z.number().int().nonnegative(),
    latencyMs: z.record(z.string(), z.number().nonnegative()),
    operatorInterventions: z.array(z.string()),
    targetErrors: z.array(z.string()),
    verificationCost: z.array(z.string()),
    unsupportedBoundaries: z.array(z.string()),
  }).strict(),
  operatorVerdict: z.object({
    state: z.enum(['pending', 'accepted-A', 'accepted-B', 'rejected-both']),
    rawResponse: z.string().optional(),
  }).strict(),
  finalState: z.object({
    project: identifier,
    recorder: identifier,
    transport: identifier,
    selection: identifier,
    filesystem: identifier,
  }).strict(),
  interfaceClassifications: z.array(z.object({
    interface: identifier,
    classification: z.enum(['graduate', 'revise', 'retain-for-more-dogfood', 'remove']),
    reason: identifier,
  }).strict()),
}).strict().superRefine((record, context) => {
  const roles = new Set(record.artifacts.map((artifact) => artifact.role));
  if (record.status === 'complete' && (roles.size !== 2 || !roles.has('A') || !roles.has('B'))) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['artifacts'],
      message: 'a complete run needs identified A and B artifacts',
    });
  }
  if (record.status === 'complete' && record.operatorVerdict.state === 'pending') {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['operatorVerdict'],
      message: 'a complete run needs an explicit operator verdict',
    });
  }
  if (record.status === 'complete'
      && !record.seams.some((item) => item.id === 'S16' && item.verdict === 'pass')) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['seams'],
      message: 'a complete run needs a passing S16 seam record',
    });
  }
});

export type HybridRunRecord = z.infer<typeof recordSchema>;

/** Validate one complete or partial S16 record without changing it. */
export function validateHybridRunRecord(value: unknown): HybridRunRecord {
  return recordSchema.parse(value);
}
