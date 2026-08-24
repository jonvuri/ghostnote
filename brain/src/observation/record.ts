/**
 * The versioned observation record for alternate-choice measurement (D18e/f).
 *
 * This module defines data and pure transitions only. Session 3g-b owns the
 * per-project store. Session 3g-d owns production capture. Keeping this contract
 * independent prevents a storage acknowledgement or a tool result from changing
 * what an observation means.
 */
import { z } from 'zod';

export const OBSERVATION_RECORD_FORMAT = 'ghostnote-observation-record' as const;
export const OBSERVATION_SCHEMA_VERSION = 3 as const;
export const PREVIOUS_OBSERVATION_SCHEMA_VERSION = 2 as const;
export const LEGACY_OBSERVATION_SCHEMA_VERSION = 1 as const;

export type RequestedScope = 'device-only' | 'launcher-clip-only' | 'mixed' | 'unsupported';
export type OperatorResponse = 'silent' | 'accepted' | 'vetoed' | 'mixed';
export type ExplicitOperatorResponse = 'accepted' | 'vetoed';
export type ManagedStructure = 'device-alternate' | 'clip-block';
export type JsonValue = null | boolean | number | string | JsonValue[] | {
  readonly [key: string]: JsonValue;
};

export interface InstructionObservation {
  readonly type: 'instruction-observation';
  /** Stable record identity. It is never derived from array position. */
  readonly id: string;
  /** Provenance only. It does not create a shared lifecycle or switch. */
  readonly correlationId: string;
  readonly recordedAtMs: number;
  readonly descriptionVersion: string;
  readonly requestedScope: RequestedScope;
  /** Caller-supplied instruction text or structured write scope, unchanged. */
  readonly rawScope: JsonValue;
  readonly rationale?: string;
  /** Starts as silent. Only explicit enrichment can set a verdict. */
  readonly operatorResponse: OperatorResponse;
  /** Present only when accepted and vetoed responses apply to different sub-scopes. */
  readonly responseItems?: readonly ScopedOperatorResponse[];
  /** Independent managed-event or ordinary-use entry ids. */
  readonly resultIds: readonly string[];
}

export interface ScopedOperatorResponse {
  /** Caller-supplied sub-scope, unchanged. */
  readonly scope: JsonValue;
  readonly response: ExplicitOperatorResponse;
}

export interface DeviceAlternateEvent {
  readonly type: 'managed-event';
  readonly id: string;
  readonly correlationId: string;
  readonly executionId: string;
  readonly recordedAtMs: number;
  readonly descriptionVersion: string;
  readonly structure: 'device-alternate';
  readonly tool: 'create_device_alternates';
  readonly result: {
    readonly trackId: string;
    /** Position observed after the complete creation readback. */
    readonly containerPosition: number;
    readonly alternateNames: readonly string[];
  };
}

export interface ClipBlockEvent {
  readonly type: 'managed-event';
  readonly id: string;
  readonly correlationId: string;
  readonly executionId: string;
  readonly recordedAtMs: number;
  readonly descriptionVersion: string;
  readonly structure: 'clip-block';
  readonly tool: 'copy_clip_down';
  readonly result: {
    readonly trackId: string;
    /** Launcher rows count from zero, as the tool surface does. */
    readonly sourceRow: number;
    readonly copiedRow: number;
  };
}

export type ManagedEvent = DeviceAlternateEvent | ClipBlockEvent;

export interface OrdinaryUse {
  readonly type: 'ordinary-use';
  readonly id: string;
  readonly correlationId: string;
  readonly executionId: string;
  readonly recordedAtMs: number;
  readonly descriptionVersion: string;
  readonly outcome: 'copy-track';
  readonly tool: 'copy_track';
  readonly result: {
    readonly sourceTrackId: string;
    /** Durable id independently observed for the fresh copy. */
    readonly copiedTrackId: string;
  };
}

export interface MusicalUse {
  readonly type: 'musical-use';
  readonly id: string;
  readonly correlationId: string;
  readonly executionId: string;
  readonly recordedAtMs: number;
  readonly descriptionVersion: string;
  readonly tool: 'generate_clip_music' | 'transform_clip_music';
  readonly result: {
    readonly format: 'ghostnote-musical-result';
    readonly version: 1;
    readonly changeId: string;
    readonly applied: boolean;
    readonly outputCount: number;
    readonly differenceCount: number;
    readonly warningCount: number;
  };
}

export type ObservationEntry = InstructionObservation | ManagedEvent | OrdinaryUse | MusicalUse;

export interface ObservationRecord {
  readonly format: typeof OBSERVATION_RECORD_FORMAT;
  readonly schemaVersion: typeof OBSERVATION_SCHEMA_VERSION;
  readonly entries: readonly ObservationEntry[];
}

export class ObservationRecordError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class MalformedObservationRecordError extends ObservationRecordError {}

export class UnsupportedObservationSchemaError extends ObservationRecordError {
  constructor(readonly schemaVersion: unknown) {
    super(
      `observation schema ${JSON.stringify(schemaVersion)} is not supported. `
      + `This checkout reads schemas ${LEGACY_OBSERVATION_SCHEMA_VERSION}, `
      + `${PREVIOUS_OBSERVATION_SCHEMA_VERSION}, and ${OBSERVATION_SCHEMA_VERSION}; `
      + 'the record was not changed.',
    );
  }
}

export class ObservationCapacityError extends ObservationRecordError {
  constructor(readonly requiredChars: number, readonly capacityChars: number) {
    super(
      `the observation record needs ${requiredChars} characters, but the store holds `
      + `${capacityChars}. The record was not truncated or replaced.`,
    );
  }
}

export class ObservationStoreUnavailableError extends ObservationRecordError {
  constructor(message = 'the per-project observation store is unavailable') {
    super(`${message}. No observation was discarded or reported as stored.`);
  }
}

export class ObservationStorageAbsentError extends ObservationRecordError {}

export class ObservationStorageDowncastError extends ObservationRecordError {}

export class ObservationStaleReadbackError extends ObservationRecordError {
  constructor(
    readonly expected: string,
    readonly observed: string,
    readonly attempts: number,
  ) {
    super(
      `the observation replacement was not visible after ${attempts} readback attempts. `
      + 'The write acknowledgement was not treated as proof.',
    );
  }
}

/** A lossy guard detected that the foreground project name changed. */
export class ObservationProjectNameChangedError extends ObservationRecordError {
  constructor(readonly before: string, readonly after: string) {
    super(
      `the foreground project name changed from ${JSON.stringify(before)} to `
      + `${JSON.stringify(after)} during the observation store operation. `
      + 'No result was reported as stored.',
    );
  }
}

export class ObservationConflictError extends ObservationRecordError {}

const identifier = z.string().min(1).max(256);
const recordedAtMs = z.number().int().nonnegative();
const descriptionVersion = z.string().min(1).max(256);
const jsonValue: z.ZodType<JsonValue> = z.lazy(() => z.union([
  z.null(),
  z.boolean(),
  z.number().finite(),
  z.string(),
  z.array(jsonValue),
  z.record(z.string(), jsonValue),
]));

const commonEntry = {
  id: identifier,
  correlationId: identifier,
  recordedAtMs,
  descriptionVersion,
} as const;

const scopedOperatorResponseSchema = z.object({
  scope: jsonValue,
  response: z.enum(['accepted', 'vetoed']),
}).strict();

const instructionSchema = z.object({
  type: z.literal('instruction-observation'),
  ...commonEntry,
  requestedScope: z.enum(['device-only', 'launcher-clip-only', 'mixed', 'unsupported']),
  rawScope: jsonValue,
  rationale: z.string().optional(),
  operatorResponse: z.enum(['silent', 'accepted', 'vetoed', 'mixed']),
  responseItems: z.array(scopedOperatorResponseSchema).min(2).max(16).optional(),
  resultIds: z.array(identifier),
}).strict();

const previousInstructionSchema = z.object({
  type: z.literal('instruction-observation'),
  ...commonEntry,
  requestedScope: z.enum(['device-only', 'launcher-clip-only', 'mixed', 'unsupported']),
  rawScope: jsonValue,
  rationale: z.string().optional(),
  operatorResponse: z.enum(['silent', 'accepted', 'vetoed']),
  resultIds: z.array(identifier),
}).strict();

const deviceEventSchema = z.object({
  type: z.literal('managed-event'),
  ...commonEntry,
  executionId: identifier,
  structure: z.literal('device-alternate'),
  tool: z.literal('create_device_alternates'),
  result: z.object({
    trackId: identifier,
    containerPosition: z.number().int().nonnegative(),
    alternateNames: z.array(z.string().min(1)).min(1).max(4),
  }).strict(),
}).strict();

const clipEventSchema = z.object({
  type: z.literal('managed-event'),
  ...commonEntry,
  executionId: identifier,
  structure: z.literal('clip-block'),
  tool: z.literal('copy_clip_down'),
  result: z.object({
    trackId: identifier,
    sourceRow: z.number().int().nonnegative(),
    copiedRow: z.number().int().nonnegative(),
  }).strict().refine((result) => result.copiedRow === result.sourceRow + 1, {
    message: 'copy_clip_down must identify the immediately following launcher row',
  }),
}).strict();

const ordinaryUseSchema = z.object({
  type: z.literal('ordinary-use'),
  ...commonEntry,
  executionId: identifier,
  outcome: z.literal('copy-track'),
  tool: z.literal('copy_track'),
  result: z.object({
    sourceTrackId: identifier,
    copiedTrackId: identifier,
  }).strict(),
}).strict();

const musicalUseSchema = z.object({
  type: z.literal('musical-use'),
  ...commonEntry,
  executionId: identifier,
  tool: z.enum(['generate_clip_music', 'transform_clip_music']),
  result: z.object({
    format: z.literal('ghostnote-musical-result'),
    version: z.literal(1),
    changeId: identifier,
    applied: z.boolean(),
    outputCount: z.number().int().nonnegative(),
    differenceCount: z.number().int().nonnegative(),
    warningCount: z.number().int().nonnegative(),
  }).strict(),
}).strict();

const entrySchema = z.discriminatedUnion('type', [
  instructionSchema,
  z.discriminatedUnion('structure', [deviceEventSchema, clipEventSchema]),
  ordinaryUseSchema,
  musicalUseSchema,
]);

const legacyEntrySchema = z.discriminatedUnion('type', [
  previousInstructionSchema,
  z.discriminatedUnion('structure', [deviceEventSchema, clipEventSchema]),
  ordinaryUseSchema,
]);

const previousEntrySchema = z.discriminatedUnion('type', [
  previousInstructionSchema,
  z.discriminatedUnion('structure', [deviceEventSchema, clipEventSchema]),
  ordinaryUseSchema,
  musicalUseSchema,
]);

const recordSchema = z.object({
  format: z.literal(OBSERVATION_RECORD_FORMAT),
  schemaVersion: z.literal(OBSERVATION_SCHEMA_VERSION),
  entries: z.array(entrySchema),
}).strict().superRefine((record, context) => {
  const ids = new Map<string, ObservationEntry>();
  const executionIds = new Set<string>();
  for (const [index, entry] of record.entries.entries()) {
    if (ids.has(entry.id)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['entries', index, 'id'],
        message: `entry id ${entry.id} is duplicated`,
      });
    } else {
      ids.set(entry.id, entry);
    }
    if (entry.type !== 'instruction-observation') {
      if (executionIds.has(entry.executionId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['entries', index, 'executionId'],
          message: `execution id ${entry.executionId} already has a result`,
        });
      }
      executionIds.add(entry.executionId);
    }
  }

  for (const [index, entry] of record.entries.entries()) {
    if (entry.type !== 'instruction-observation') continue;
    const responseItems = entry.responseItems ?? [];
    if (entry.operatorResponse === 'mixed') {
      const responses = new Set(responseItems.map((item) => item.response));
      if (!responses.has('accepted') || !responses.has('vetoed')) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['entries', index, 'responseItems'],
          message: 'a mixed response needs accepted and vetoed scoped items',
        });
      }
    } else if (responseItems.length > 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['entries', index, 'responseItems'],
        message: 'scoped response items require operator response mixed',
      });
    }
    const seen = new Set<string>();
    for (const [resultIndex, resultId] of entry.resultIds.entries()) {
      const path = ['entries', index, 'resultIds', resultIndex] as const;
      if (seen.has(resultId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [...path],
          message: `result id ${resultId} is repeated`,
        });
        continue;
      }
      seen.add(resultId);
      const result = ids.get(resultId);
      if (result === undefined || result.type === 'instruction-observation') {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [...path],
          message: `result id ${resultId} does not name a result entry`,
        });
      } else if (result.correlationId !== entry.correlationId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [...path],
          message: `result id ${resultId} has another correlation id`,
        });
      }
    }
  }
});

const legacyRecordSchema = z.object({
  format: z.literal(OBSERVATION_RECORD_FORMAT),
  schemaVersion: z.literal(LEGACY_OBSERVATION_SCHEMA_VERSION),
  entries: z.array(legacyEntrySchema),
}).strict();

const previousRecordSchema = z.object({
  format: z.literal(OBSERVATION_RECORD_FORMAT),
  schemaVersion: z.literal(PREVIOUS_OBSERVATION_SCHEMA_VERSION),
  entries: z.array(previousEntrySchema),
}).strict();

/** Start an empty record. Storage is not consulted by this pure constructor. */
export function emptyObservationRecord(): ObservationRecord {
  return {
    format: OBSERVATION_RECORD_FORMAT,
    schemaVersion: OBSERVATION_SCHEMA_VERSION,
    entries: [],
  };
}

export type NewInstructionObservation = Omit<
  InstructionObservation,
  'type' | 'operatorResponse' | 'responseItems' | 'resultIds'
>;

/** Capture caller context before work. Operator response always starts silent. */
export function instructionObservation(input: NewInstructionObservation): InstructionObservation {
  return parseEntry({
    type: 'instruction-observation',
    ...input,
    operatorResponse: 'silent',
    resultIds: [],
  }) as InstructionObservation;
}

/** Append one independently identified entry. No existing entry is rewritten. */
export function appendObservationEntry(
  record: ObservationRecord,
  entry: ObservationEntry,
): ObservationRecord {
  return parseRecord({ ...record, entries: [...record.entries, entry] });
}

export interface InstructionEnrichment {
  readonly instructionId: string;
  readonly resultIds?: readonly string[];
  /** The recording caller must supply this value explicitly. */
  readonly rationale?: string;
  /** Tool success and host permission never supply this value implicitly. */
  readonly operatorResponse?: ExplicitOperatorResponse;
  /** Use this instead of a whole-instruction response for a partial verdict. */
  readonly responseItems?: readonly ScopedOperatorResponse[];
}

/** Enrich one instruction after work without changing its raw request or identity. */
export function enrichInstructionObservation(
  record: ObservationRecord,
  enrichment: InstructionEnrichment,
): ObservationRecord {
  const at = record.entries.findIndex((entry) => entry.id === enrichment.instructionId);
  if (at === -1 || record.entries[at]?.type !== 'instruction-observation') {
    throw new ObservationConflictError(
      `instruction observation ${enrichment.instructionId} does not exist. The record was not changed.`,
    );
  }
  const current = record.entries[at] as InstructionObservation;
  if (enrichment.rationale !== undefined
      && current.rationale !== undefined
      && enrichment.rationale !== current.rationale) {
    throw new ObservationConflictError(
      `instruction observation ${enrichment.instructionId} already has a rationale. `
      + `Rationale is write-once. The preserved rationale is ${JSON.stringify(current.rationale)}. `
      + 'The record was not changed.',
    );
  }
  if (enrichment.operatorResponse !== undefined && enrichment.responseItems !== undefined) {
    throw new ObservationConflictError(
      'Supply either operatorResponse or responseItems, not both. The record was not changed.',
    );
  }
  const requestedResponse = enrichment.responseItems === undefined
    ? enrichment.operatorResponse
    : 'mixed';
  const sameResponse = requestedResponse === current.operatorResponse
    && (requestedResponse !== 'mixed'
      || sameScopedResponses(enrichment.responseItems ?? [], current.responseItems ?? []));
  if (requestedResponse !== undefined
      && current.operatorResponse !== 'silent'
      && !sameResponse) {
    throw new ObservationConflictError(
      `instruction observation ${enrichment.instructionId} already has an operator response. `
      + `Operator response is write-once. The preserved response is ${current.operatorResponse}. `
      + 'The record was not changed.',
    );
  }
  const replacement: InstructionObservation = {
    ...current,
    ...(enrichment.rationale === undefined ? {} : { rationale: enrichment.rationale }),
    ...(requestedResponse === undefined ? {} : { operatorResponse: requestedResponse }),
    ...(enrichment.responseItems === undefined
      ? {}
      : { responseItems: enrichment.responseItems }),
    resultIds: [...current.resultIds, ...(enrichment.resultIds ?? [])],
  };
  const entries = [...record.entries];
  entries[at] = replacement;
  return parseRecord({ ...record, entries });
}

/** Decode schema v3. Older verdicts migrate without changing their meaning. */
export function decodeObservationRecord(encoded: string): ObservationRecord {
  let value: unknown;
  try {
    value = JSON.parse(encoded);
  } catch (error) {
    throw new MalformedObservationRecordError(
      `the observation record is not valid JSON: ${errorMessage(error)}. The record was not changed.`,
    );
  }
  if (isObject(value) && value.schemaVersion === LEGACY_OBSERVATION_SCHEMA_VERSION) {
    const legacy = legacyRecordSchema.safeParse(value);
    if (!legacy.success) throw malformed(legacy.error);
    return parseRecord({
      format: legacy.data.format,
      schemaVersion: OBSERVATION_SCHEMA_VERSION,
      entries: legacy.data.entries,
    });
  }
  if (isObject(value) && value.schemaVersion === PREVIOUS_OBSERVATION_SCHEMA_VERSION) {
    const previous = previousRecordSchema.safeParse(value);
    if (!previous.success) throw malformed(previous.error);
    return parseRecord({
      format: previous.data.format,
      schemaVersion: OBSERVATION_SCHEMA_VERSION,
      entries: previous.data.entries,
    });
  }
  if (isObject(value) && 'schemaVersion' in value
      && value.schemaVersion !== OBSERVATION_SCHEMA_VERSION) {
    throw new UnsupportedObservationSchemaError(value.schemaVersion);
  }
  return parseRecord(value);
}

/**
 * Encode with sorted object keys. A capacity check refuses the complete value;
 * it never slices, evicts, or rewrites entries to make the value fit.
 */
export function encodeObservationRecord(
  record: ObservationRecord,
  options: { readonly capacityChars?: number } = {},
): string {
  const encoded = stableJson(parseRecord(record));
  if (options.capacityChars !== undefined && encoded.length > options.capacityChars) {
    throw new ObservationCapacityError(encoded.length, options.capacityChars);
  }
  return encoded;
}

export type ObservationFailure =
  | { readonly kind: 'malformed-record'; readonly message: string }
  | { readonly kind: 'unsupported-schema'; readonly message: string }
  | { readonly kind: 'unavailable-store'; readonly message: string }
  | { readonly kind: 'capacity-exhaustion'; readonly message: string }
  | { readonly kind: 'storage-absent'; readonly message: string }
  | { readonly kind: 'storage-downcast-refused'; readonly message: string }
  | { readonly kind: 'stale-readback'; readonly message: string }
  | { readonly kind: 'project-name-changed'; readonly message: string }
  | { readonly kind: 'record-update-failed'; readonly message: string };

export interface ProjectWriteObservationFailure<Result> {
  readonly partialSuccess: true;
  readonly projectWrite: { readonly succeeded: true; readonly result: Result };
  readonly observationUpdate: { readonly succeeded: false; readonly error: ObservationFailure };
}

/** Report a record failure after a confirmed project write without recasting that write as failed. */
export function reportObservationFailureAfterProjectWrite<Result>(
  projectResult: Result,
  error: unknown,
): ProjectWriteObservationFailure<Result> {
  return {
    partialSuccess: true,
    projectWrite: { succeeded: true, result: projectResult },
    observationUpdate: { succeeded: false, error: observationFailure(error) },
  };
}

function observationFailure(error: unknown): ObservationFailure {
  const message = errorMessage(error);
  if (error instanceof MalformedObservationRecordError) return { kind: 'malformed-record', message };
  if (error instanceof UnsupportedObservationSchemaError) {
    return { kind: 'unsupported-schema', message };
  }
  if (error instanceof ObservationStoreUnavailableError) {
    return { kind: 'unavailable-store', message };
  }
  if (error instanceof ObservationCapacityError) {
    return { kind: 'capacity-exhaustion', message };
  }
  if (error instanceof ObservationStorageAbsentError) return { kind: 'storage-absent', message };
  if (error instanceof ObservationStorageDowncastError) {
    return { kind: 'storage-downcast-refused', message };
  }
  if (error instanceof ObservationStaleReadbackError) return { kind: 'stale-readback', message };
  if (error instanceof ObservationProjectNameChangedError) {
    return { kind: 'project-name-changed', message };
  }
  return { kind: 'record-update-failed', message };
}

function parseEntry(value: unknown): ObservationEntry {
  const result = entrySchema.safeParse(value);
  if (!result.success) throw malformed(result.error);
  return result.data;
}

function parseRecord(value: unknown): ObservationRecord {
  const result = recordSchema.safeParse(value);
  if (!result.success) throw malformed(result.error);
  return result.data;
}

function malformed(error: z.ZodError): MalformedObservationRecordError {
  const details = error.issues.map((issue) => {
    const path = issue.path.length === 0 ? 'record' : issue.path.join('.');
    return `${path}: ${issue.message}`;
  }).join('; ');
  return new MalformedObservationRecordError(
    `the observation record is malformed: ${details}. The record was not changed.`,
  );
}

function stableJson(value: JsonValue | ObservationRecord): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(',')}]`;
  const entries = Object.entries(value)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item as JsonValue)}`)
    .join(',')}}`;
}

function sameScopedResponses(
  left: readonly ScopedOperatorResponse[],
  right: readonly ScopedOperatorResponse[],
): boolean {
  return left.length === right.length && left.every((item, index) => {
    const other = right[index];
    return other !== undefined
      && item.response === other.response
      && stableJson(item.scope) === stableJson(other.scope);
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
