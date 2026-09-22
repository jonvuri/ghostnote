/** Build bounded reference context and independent copy measurements. */
import { z } from 'zod';

import type { NoteRecord } from '../contract/index.js';
import {
  WORKSTATION_RESPONSE_SCHEMA, type WorkstationModule,
} from '../workstation/module-registry.js';
import {
  EXACT_NOTE_SOURCE_DOMAIN, validateExactNoteSource, type ExactNoteSource,
} from './exact-note-source.js';
import type { NoteCandidate } from './note-compiler.js';
import {
  exactSourceToContext, hostBeatToRational,
  type ProviderVersion, type SymbolicContextResult, type SymbolicContextTask,
} from './symbolic-context.js';

export const REFERENCE_CONTEXT_REQUEST_SCHEMA = 'reference-context-request-v0';
export const REFERENCE_CONTEXT_SCHEMA = 'reference-context-v0';
export const REFERENCE_COMPARISON_SCHEMA = 'reference-comparison-v0';
export const REFERENCE_CONTEXT_MODULE_ID = 'ghostnote-symbolic-reference-context';
export const REFERENCE_CONTEXT_MODULE_VERSION = '0';
export const REFERENCE_CONTEXT_MAX_EVENTS = 4_096;

export interface ReferenceTrackRole {
  readonly source: 'seed' | 'reference';
  readonly trackId: string;
  readonly role: string;
  readonly provenance: string;
}

export interface ReferenceRawExcerpt {
  readonly reason: string;
  readonly contextTask: SymbolicContextTask;
}

export interface ReferenceContextTask {
  readonly id: string;
  readonly profile: 'extracted-structure-v0' | 'mixed-v0';
  readonly coverage: { readonly fromBeats: number; readonly toBeats: number };
  readonly roles?: readonly ReferenceTrackRole[];
  readonly rawExcerpt?: ReferenceRawExcerpt;
}

export interface ReferenceContextRequest {
  readonly seed: ExactNoteSource;
  readonly reference: ExactNoteSource;
  readonly expectedReferenceSha256: string;
  readonly task: ReferenceContextTask;
}

export interface ReferenceEvidence {
  readonly fieldId: string;
  readonly value: unknown;
  readonly unit: 'count' | 'MIDI-note' | 'ratio' | 'quarter-note-beats' | 'sequence';
  readonly kind: 'deterministic-derived';
  readonly sourceSha256: string;
  readonly providerId: string;
  readonly formula: string;
  readonly settings: Readonly<Record<string, unknown>>;
  readonly coverageEventIds: readonly string[];
  readonly tolerance: 'exact';
}

export interface ResolvedReferenceRole {
  readonly source: 'seed' | 'reference';
  readonly trackAlias: string;
  readonly trackId: string;
  readonly role: string;
  readonly provenance: string;
}

export interface ReferenceContextResult {
  readonly schema: typeof REFERENCE_CONTEXT_SCHEMA;
  readonly taskId: string;
  readonly profile: ReferenceContextTask['profile'];
  readonly seed: {
    readonly id: string;
    readonly sha256: string;
    readonly digestDomain: typeof EXACT_NOTE_SOURCE_DOMAIN;
  };
  readonly reference: {
    readonly id: string;
    readonly sha256: string;
    readonly digestDomain: typeof EXACT_NOTE_SOURCE_DOMAIN;
    readonly permission: string;
  };
  readonly coverage: {
    readonly complete: ExactNoteSource['coverage'];
    readonly used: {
      readonly fromBeats: string;
      readonly toBeats: string;
      readonly eventCount: number;
      readonly onsetRule: 'inclusive-start-exclusive-end';
      readonly completeReferenceUsedForComparison: true;
    };
    readonly excerpt?: {
      readonly fromBeats: string;
      readonly toBeats: string;
      readonly eventCount: number;
      readonly reason: string;
    };
  };
  readonly provider: ProviderVersion;
  readonly roles: readonly ResolvedReferenceRole[];
  readonly extractedEvidence: readonly ReferenceEvidence[];
  readonly rawContext?: SymbolicContextResult;
  readonly warnings: readonly { readonly code: string; readonly message: string }[];
}

export interface ReferenceComparisonMetric {
  readonly fieldId: string;
  readonly value: number;
  readonly unit: 'count' | 'ratio';
  readonly kind: 'derived-measurement';
  readonly sourceSha256: string;
  readonly candidateSourceSha256: string;
  readonly providerId: string;
  readonly formula: string;
  readonly coverage: {
    readonly reference: 'complete-addressed-clips';
    readonly candidate: 'complete-candidate';
    readonly referenceEventCount: number;
    readonly candidateEventCount: number;
  };
  readonly tolerance: 'exact';
}

export interface ReferenceComparisonResult {
  readonly schema: typeof REFERENCE_COMPARISON_SCHEMA;
  readonly taskId: string;
  readonly seedSha256: string;
  readonly referenceSha256: string;
  readonly candidateSourceSha256: string;
  readonly exactCopy: readonly ReferenceComparisonMetric[];
  readonly structural: readonly ReferenceComparisonMetric[];
  readonly limits: readonly string[];
}

export class ReferenceContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReferenceContextError';
  }
}

interface ComparableEvent {
  readonly role: string;
  readonly alias: string;
  readonly startBeats: number;
  readonly durationBeats: number;
  readonly pitch: number;
  readonly velocity: number;
  readonly note: NoteRecord;
}

const PROVIDER: ProviderVersion = {
  id: 'ghostnote-symbolic-context',
  adapterVersion: REFERENCE_CONTEXT_MODULE_VERSION,
  settings: {
    profile: REFERENCE_CONTEXT_SCHEMA,
    eventOrder: 'start-track-pitch-v0',
    comparison: REFERENCE_COMPARISON_SCHEMA,
  },
};

const referenceContextResultShape = z.object({
  schema: z.literal(REFERENCE_CONTEXT_SCHEMA),
  taskId: z.string().min(1),
  profile: z.enum(['extracted-structure-v0', 'mixed-v0']),
  seed: z.object({
    id: z.string().min(1),
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
    digestDomain: z.literal(EXACT_NOTE_SOURCE_DOMAIN),
  }).strict(),
  reference: z.object({
    id: z.string().min(1),
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
    digestDomain: z.literal(EXACT_NOTE_SOURCE_DOMAIN),
    permission: z.string().min(1),
  }).strict(),
  coverage: z.object({
    complete: z.object({
      requestedClipCount: z.number().int().nonnegative(),
      observedClipCount: z.number().int().nonnegative(),
      channelsPerClip: z.literal(16),
      complete: z.literal(true),
      noteOnsetScope: z.literal('complete-addressed-clips'),
      includesNotesExtendingBeyondClipEnd: z.literal(true),
      omittedFields: z.array(z.never()).max(0),
      unavailableFields: z.array(z.never()).max(0),
    }).strict(),
    used: z.object({
      fromBeats: z.string().min(1),
      toBeats: z.string().min(1),
      eventCount: z.number().int().positive().max(REFERENCE_CONTEXT_MAX_EVENTS),
      onsetRule: z.literal('inclusive-start-exclusive-end'),
      completeReferenceUsedForComparison: z.literal(true),
    }).strict(),
    excerpt: z.object({
      fromBeats: z.string().min(1),
      toBeats: z.string().min(1),
      eventCount: z.number().int().nonnegative(),
      reason: z.string().min(1),
    }).strict().optional(),
  }).strict(),
  provider: z.object({
    id: z.string().min(1),
    adapterVersion: z.string().min(1),
    dependencyVersion: z.string().min(1).optional(),
    settings: z.record(z.string(), z.unknown()),
  }).strict(),
  roles: z.array(z.object({
    source: z.enum(['seed', 'reference']),
    trackAlias: z.string().min(1),
    trackId: z.string().min(1),
    role: z.string().min(1),
    provenance: z.string().min(1),
  }).strict()),
  extractedEvidence: z.array(z.object({
    fieldId: z.string().min(1),
    value: z.unknown(),
    unit: z.enum(['count', 'MIDI-note', 'ratio', 'quarter-note-beats', 'sequence']),
    kind: z.literal('deterministic-derived'),
    sourceSha256: z.string().regex(/^[0-9a-f]{64}$/),
    providerId: z.string().min(1),
    formula: z.string().min(1),
    settings: z.record(z.string(), z.unknown()),
    coverageEventIds: z.array(z.string().min(1)),
    tolerance: z.literal('exact'),
  }).strict()).min(1),
  rawContext: z.unknown().optional(),
  warnings: z.array(z.object({
    code: z.string().min(1), message: z.string().min(1),
  }).strict()),
}).strict();

function fail(message: string): never {
  throw new ReferenceContextError(message);
}

/** Validate one reference projection before a consumer trusts its metadata. */
export function validateReferenceContextResult(value: unknown): asserts value is ReferenceContextResult {
  const parsed = referenceContextResultShape.safeParse(value);
  if (!parsed.success) fail('the reference-context-v0 result is invalid');
  const result = parsed.data;
  if (result.seed.id === result.reference.id || result.seed.sha256 === result.reference.sha256) {
    fail('the reference-context-v0 result merges seed and reference identity');
  }
  if (result.provider.id !== PROVIDER.id
      || result.extractedEvidence.some((item) =>
        item.sourceSha256 !== result.reference.sha256 || item.providerId !== result.provider.id)) {
    fail('the reference-context-v0 evidence provenance is inconsistent');
  }
  const roleKeys = result.roles.map((item) => `${item.source}\0${item.trackAlias}`);
  if (new Set(roleKeys).size !== roleKeys.length) {
    fail('the reference-context-v0 result has duplicate role targets');
  }
  if (result.profile === 'extracted-structure-v0'
      && (result.coverage.excerpt !== undefined || result.rawContext !== undefined)) {
    fail('the extracted reference profile contains a raw excerpt');
  }
  if (result.profile === 'mixed-v0'
      && (result.coverage.excerpt === undefined || result.rawContext === undefined)) {
    fail('the mixed reference profile is missing its bounded raw excerpt');
  }
  if (result.rawContext !== undefined) {
    const raw = result.rawContext as {
      readonly schema?: unknown;
      readonly source?: { readonly sha256?: unknown };
    };
    if (raw.schema !== 'symbolic-context-v0'
        || raw.source?.sha256 !== result.reference.sha256) {
      fail('the raw reference context does not match the complete reference');
    }
  }
}

export const referenceContextResultValidator = z.custom<ReferenceContextResult>((value) => {
  try {
    validateReferenceContextResult(value);
    return true;
  } catch {
    return false;
  }
});

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => compareText(left, right))
      .map(([key, item]) => [key, canonicalValue(item)]));
  }
  return value;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalValue(value));
}

function sourceEvents(
  source: ExactNoteSource,
  roles: ReadonlyMap<string, string>,
  coverage?: { readonly fromBeats: number; readonly toBeats: number },
): ComparableEvent[] {
  const aliasByTrack = new Map(source.aliases.map((item) => [item.trackId, item.alias]));
  const events: ComparableEvent[] = [];
  for (const clip of source.clips) {
    const alias = aliasByTrack.get(clip.track.channelId);
    if (alias === undefined) fail(`source track ${clip.track.channelId} has no alias`);
    for (const channel of clip.channels) {
      for (const note of channel.notes) {
        if (coverage !== undefined
            && (note.startBeats < coverage.fromBeats || note.startBeats >= coverage.toBeats)) continue;
        events.push({
          role: roles.get(alias) ?? 'unassigned',
          alias,
          startBeats: note.startBeats,
          durationBeats: note.durationBeats,
          pitch: note.pitch,
          velocity: note.velocity,
          note,
        });
      }
    }
  }
  return events.sort((left, right) => left.startBeats - right.startBeats
    || compareText(left.role, right.role) || left.pitch - right.pitch
    || compareText(canonicalJson(left.note), canonicalJson(right.note)));
}

function candidateEvents(
  candidate: NoteCandidate,
  roles: ReadonlyMap<string, string>,
): ComparableEvent[] {
  return candidate.clips.flatMap((clip) => clip.channels.flatMap((channel) =>
    channel.notes.map((item): ComparableEvent => ({
      role: roles.get(item.trackAlias) ?? 'unassigned',
      alias: item.trackAlias,
      startBeats: item.note.startBeats,
      durationBeats: item.note.durationBeats,
      pitch: item.note.pitch,
      velocity: item.note.velocity,
      note: item.note,
    })))).sort((left, right) => left.startBeats - right.startBeats
      || compareText(left.role, right.role) || left.pitch - right.pitch
      || compareText(canonicalJson(left.note), canonicalJson(right.note)));
}

function resolvedRoles(
  request: ReferenceContextRequest,
): readonly ResolvedReferenceRole[] {
  const seen = new Set<string>();
  return (request.task.roles ?? []).map((role): ResolvedReferenceRole => {
    const source = role.source === 'seed' ? request.seed : request.reference;
    const alias = source.aliases.find((item) => item.trackId === role.trackId)?.alias;
    if (alias === undefined) fail(`${role.source} role target ${role.trackId} is not in its source`);
    const key = `${role.source}\0${alias}`;
    if (seen.has(key)) fail(`${role.source} track alias ${alias} has more than one role`);
    seen.add(key);
    if (role.role.length === 0 || role.provenance.length === 0) {
      fail('reference roles need a role and provenance');
    }
    return { ...role, trackAlias: alias };
  });
}

function histogram<T extends string | number>(values: readonly T[]): readonly { value: T; count: number }[] {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].sort(([left], [right]) => compareText(String(left), String(right)))
    .map(([value, count]) => ({ value, count }));
}

function referenceEvidence(
  reference: ExactNoteSource,
  events: readonly ComparableEvent[],
  coverage: ReferenceContextTask['coverage'],
): readonly ReferenceEvidence[] {
  const eventIds = reference.eventMap.filter((item) =>
    item.startBeats >= coverage.fromBeats && item.startBeats < coverage.toBeats)
    .map((item) => item.id);
  const base = {
    kind: 'deterministic-derived' as const,
    sourceSha256: reference.digest.value,
    providerId: PROVIDER.id,
    coverageEventIds: eventIds,
    tolerance: 'exact' as const,
  };
  const pitches = events.map((event) => event.pitch);
  const orderedByVoice = new Map<string, ComparableEvent[]>();
  for (const event of events) {
    const key = `${event.role}\0${event.alias}`;
    const group = orderedByVoice.get(key) ?? [];
    group.push(event);
    orderedByVoice.set(key, group);
  }
  const contour = [...orderedByVoice].map(([voice, values]) => ({
    voice,
    signs: values.slice(1).map((event, index) =>
      Math.sign(event.pitch - values[index]!.pitch)),
  }));
  return [
    {
      ...base, fieldId: 'reference.note-count-v0', value: events.length, unit: 'count',
      formula: 'count(events with onsets in used coverage)', settings: {},
    },
    {
      ...base, fieldId: 'reference.pitch-range-v0',
      value: pitches.length === 0 ? [] : [Math.min(...pitches), Math.max(...pitches)],
      unit: 'MIDI-note', formula: '[minimum pitch, maximum pitch]', settings: {},
    },
    {
      ...base, fieldId: 'reference.onset-sequence-v0',
      value: events.map((event) => hostBeatToRational(event.startBeats)),
      unit: 'quarter-note-beats', formula: 'ordered absolute event onsets', settings: {},
    },
    {
      ...base, fieldId: 'reference.duration-histogram-v0',
      value: histogram(events.map((event) => hostBeatToRational(event.durationBeats))),
      unit: 'count', formula: 'count by reduced quarter-beat duration', settings: {},
    },
    {
      ...base, fieldId: 'reference.pitch-class-histogram-v0',
      value: histogram(events.map((event) => event.pitch % 12)),
      unit: 'count', formula: 'count by MIDI pitch modulo 12', settings: {},
    },
    {
      ...base, fieldId: 'reference.contour-sign-sequence-v0', value: contour,
      unit: 'sequence', formula: 'sign of adjacent pitch movement per declared role and track',
      settings: { simultaneousEvents: 'stable-pitch-order' },
    },
  ];
}

/** Build the default extracted reference profile and an optional bounded raw view. */
export function referenceProjection(request: ReferenceContextRequest): ReferenceContextResult {
  validateExactNoteSource(request.seed);
  if (request.reference.source.permission.trim().length === 0) {
    fail('the reference permission is missing');
  }
  validateExactNoteSource(request.reference);
  if (request.task.id.length === 0) fail('the reference task ID must not be empty');
  if (request.seed.source.id === request.reference.source.id
      || request.seed.digest.value === request.reference.digest.value) {
    fail('seed and reference identities must be separate');
  }
  if (request.expectedReferenceSha256 !== request.reference.digest.value) {
    fail('the expected reference hash does not match the complete reference');
  }
  const coverage = request.task.coverage;
  if (!Number.isFinite(coverage.fromBeats) || !Number.isFinite(coverage.toBeats)
      || coverage.fromBeats < 0 || coverage.toBeats <= coverage.fromBeats) {
    fail('the reference used coverage is invalid');
  }
  if (request.reference.clips.some((clip) => coverage.toBeats > clip.metadata.lengthBeats)) {
    fail('the reference used coverage extends beyond an addressed clip');
  }
  if (request.task.profile === 'extracted-structure-v0' && request.task.rawExcerpt !== undefined) {
    fail('extracted-structure-v0 does not include raw event context');
  }
  if (request.task.profile === 'mixed-v0' && request.task.rawExcerpt === undefined) {
    fail('mixed-v0 needs one bounded raw excerpt and a reason');
  }
  const roles = resolvedRoles(request);
  const referenceRoles = new Map(roles.filter((item) => item.source === 'reference')
    .map((item) => [item.trackAlias, item.role]));
  const events = sourceEvents(request.reference, referenceRoles, coverage);
  if (events.length === 0) fail('the selected reference coverage is empty');
  if (events.length > REFERENCE_CONTEXT_MAX_EVENTS) {
    fail(`reference context is limited to ${REFERENCE_CONTEXT_MAX_EVENTS} events`);
  }

  let rawContext: SymbolicContextResult | undefined;
  let excerpt: ReferenceContextResult['coverage']['excerpt'];
  if (request.task.rawExcerpt !== undefined) {
    if (request.task.rawExcerpt.reason.trim().length === 0) {
      fail('a raw reference excerpt needs an explicit task reason');
    }
    const rawTask = request.task.rawExcerpt.contextTask;
    if (rawTask.coverage.fromBeats < coverage.fromBeats
        || rawTask.coverage.toBeats > coverage.toBeats) {
      fail('the raw excerpt must stay within the used reference coverage');
    }
    rawContext = exactSourceToContext({ source: request.reference, task: rawTask });
    excerpt = {
      fromBeats: hostBeatToRational(rawTask.coverage.fromBeats),
      toBeats: hostBeatToRational(rawTask.coverage.toBeats),
      eventCount: rawContext.context.events.length,
      reason: request.task.rawExcerpt.reason,
    };
  }

  const result: ReferenceContextResult = {
    schema: REFERENCE_CONTEXT_SCHEMA,
    taskId: request.task.id,
    profile: request.task.profile,
    seed: {
      id: request.seed.source.id,
      sha256: request.seed.digest.value,
      digestDomain: EXACT_NOTE_SOURCE_DOMAIN,
    },
    reference: {
      id: request.reference.source.id,
      sha256: request.reference.digest.value,
      digestDomain: EXACT_NOTE_SOURCE_DOMAIN,
      permission: request.reference.source.permission,
    },
    coverage: {
      complete: request.reference.coverage,
      used: {
        fromBeats: hostBeatToRational(coverage.fromBeats),
        toBeats: hostBeatToRational(coverage.toBeats),
        eventCount: events.length,
        onsetRule: 'inclusive-start-exclusive-end',
        completeReferenceUsedForComparison: true,
      },
      ...(excerpt === undefined ? {} : { excerpt }),
    },
    provider: PROVIDER,
    roles,
    extractedEvidence: referenceEvidence(request.reference, events, coverage),
    ...(rawContext === undefined ? {} : { rawContext }),
    warnings: [{
      code: 'comparison-is-not-permission-or-verdict',
      message: 'Copy and structural measurements do not decide permission or aesthetic quality.',
    }],
  };
  validateReferenceContextResult(result);
  return result;
}

function relative(events: readonly ComparableEvent[]): readonly ComparableEvent[] {
  const origin = events.length === 0 ? 0 : Math.min(...events.map((event) => event.startBeats));
  return events.map((event) => ({ ...event, startBeats: event.startBeats - origin }));
}

function longestCommon<T>(left: readonly T[], right: readonly T[]): number {
  if (left.length === 0 || right.length === 0) return 0;
  let previous = new Array<number>(right.length + 1).fill(0);
  let best = 0;
  for (const leftItem of left) {
    const current = [0];
    for (let index = 1; index <= right.length; index += 1) {
      const value = leftItem === right[index - 1] ? previous[index - 1]! + 1 : 0;
      current.push(value);
      best = Math.max(best, value);
    }
    previous = current;
  }
  return best;
}

function jaccard<T>(left: ReadonlySet<T>, right: ReadonlySet<T>): number {
  const union = new Set([...left, ...right]);
  if (union.size === 0) return 1;
  return [...left].filter((value) => right.has(value)).length / union.size;
}

function multisetIntersection(left: readonly string[], right: readonly string[]): number {
  const counts = new Map<string, number>();
  for (const value of right) counts.set(value, (counts.get(value) ?? 0) + 1);
  let matches = 0;
  for (const value of left) {
    const remaining = counts.get(value) ?? 0;
    if (remaining === 0) continue;
    counts.set(value, remaining - 1);
    matches += 1;
  }
  return matches;
}

function comparisonMetric(
  fieldId: string,
  value: number,
  unit: ReferenceComparisonMetric['unit'],
  formula: string,
  projection: ReferenceContextResult,
  candidate: NoteCandidate,
  referenceCount: number,
  candidateCount: number,
): ReferenceComparisonMetric {
  return {
    fieldId, value, unit, kind: 'derived-measurement',
    sourceSha256: projection.reference.sha256,
    candidateSourceSha256: candidate.baseSourceSha256,
    providerId: PROVIDER.id,
    formula,
    coverage: {
      reference: 'complete-addressed-clips', candidate: 'complete-candidate',
      referenceEventCount: referenceCount, candidateEventCount: candidateCount,
    },
    tolerance: 'exact',
  };
}

/** Compare the complete candidate with the complete permitted reference. */
export function compareCandidateToReference(
  projection: ReferenceContextResult,
  reference: ExactNoteSource,
  candidate: NoteCandidate,
): ReferenceComparisonResult {
  validateReferenceContextResult(projection);
  validateExactNoteSource(reference);
  if (reference.source.permission.trim().length === 0) {
    fail('the comparison reference permission is missing');
  }
  if (reference.digest.value !== projection.reference.sha256
      || reference.source.id !== projection.reference.id) {
    fail('the comparison reference changed after projection');
  }
  if (reference.source.permission !== projection.reference.permission) {
    fail('the comparison reference permission changed after projection');
  }
  if (candidate.baseSourceSha256 !== projection.seed.sha256) {
    fail('the candidate source is not the projected seed');
  }
  if (candidate.baseSourceSha256 === reference.digest.value) {
    fail('the reference hash cannot replace the seed candidate hash');
  }
  const seedRoles = new Map(projection.roles.filter((item) => item.source === 'seed')
    .map((item) => [item.trackAlias, item.role]));
  const referenceRoles = new Map(projection.roles.filter((item) => item.source === 'reference')
    .map((item) => [item.trackAlias, item.role]));
  const output = relative(candidateEvents(candidate, seedRoles));
  const source = relative(sourceEvents(reference, referenceRoles));
  const eventKey = (event: ComparableEvent): string => canonicalJson({
    role: event.role,
    startBeats: hostBeatToRational(event.startBeats),
    note: { ...event.note, startBeats: hostBeatToRational(event.startBeats) },
  });
  const noteKey = (event: ComparableEvent): string => canonicalJson([
    event.role, hostBeatToRational(event.durationBeats), event.pitch, event.velocity,
  ]);
  const rhythmKey = (event: ComparableEvent): string => canonicalJson([
    event.role, hostBeatToRational(event.startBeats), hostBeatToRational(event.durationBeats),
  ]);
  const outputEvents = output.map(eventKey);
  const referenceEvents = source.map(eventKey);
  const outputNotes = output.map(noteKey);
  const referenceNotes = source.map(noteKey);
  const outputRhythm = output.map(rhythmKey);
  const referenceRhythm = source.map(rhythmKey);
  const outputContour = output.slice(1).map((event, index) =>
    String(Math.sign(event.pitch - output[index]!.pitch)));
  const referenceContour = source.slice(1).map((event, index) =>
    String(Math.sign(event.pitch - source[index]!.pitch)));
  const exact = [
    comparisonMetric(
      'reference.exact-event-count-v0',
      multisetIntersection(outputEvents, referenceEvents), 'count',
      'multiset intersection of role, relative onset, and complete note fields',
      projection, candidate, source.length, output.length,
    ),
    comparisonMetric(
      'reference.longest-exact-note-sequence-v0',
      longestCommon(outputNotes, referenceNotes), 'count',
      'longest contiguous common sequence of role, duration, pitch, and velocity',
      projection, candidate, source.length, output.length,
    ),
    comparisonMetric(
      'reference.longest-exact-rhythm-sequence-v0',
      longestCommon(outputRhythm, referenceRhythm), 'count',
      'longest contiguous common sequence of role, relative onset, and duration',
      projection, candidate, source.length, output.length,
    ),
    comparisonMetric(
      'reference.longest-unchanged-event-span-v0',
      longestCommon(outputEvents, referenceEvents), 'count',
      'longest contiguous common sequence of complete normalized events',
      projection, candidate, source.length, output.length,
    ),
  ];
  const candidateDensity = output.length === 0 ? 0
    : output.length / Math.max(1, Math.max(...output.map((event) =>
      event.startBeats + event.durationBeats)));
  const referenceDensity = source.length === 0 ? 0
    : source.length / Math.max(1, Math.max(...source.map((event) =>
      event.startBeats + event.durationBeats)));
  const densityRatio = candidateDensity === 0 && referenceDensity === 0 ? 1
    : Math.min(candidateDensity, referenceDensity) / Math.max(candidateDensity, referenceDensity);
  const structural = [
    comparisonMetric(
      'reference.pitch-class-jaccard-v0',
      jaccard(new Set(output.map((event) => event.pitch % 12)),
        new Set(source.map((event) => event.pitch % 12))),
      'ratio', 'Jaccard similarity of present MIDI pitch classes',
      projection, candidate, source.length, output.length,
    ),
    comparisonMetric(
      'reference.rhythm-onset-jaccard-v0',
      jaccard(new Set(output.map((event) => hostBeatToRational(event.startBeats))),
        new Set(source.map((event) => hostBeatToRational(event.startBeats)))),
      'ratio', 'Jaccard similarity of relative reduced onset positions',
      projection, candidate, source.length, output.length,
    ),
    comparisonMetric(
      'reference.contour-longest-sequence-v0',
      longestCommon(outputContour, referenceContour), 'count',
      'longest contiguous common sequence of adjacent pitch-direction signs',
      projection, candidate, source.length, output.length,
    ),
    comparisonMetric(
      'reference.density-similarity-v0', densityRatio, 'ratio',
      'smaller notes-per-covered-beat divided by larger notes-per-covered-beat',
      projection, candidate, source.length, output.length,
    ),
    comparisonMetric(
      'reference.role-jaccard-v0',
      jaccard(new Set(output.map((event) => event.role)),
        new Set(source.map((event) => event.role))),
      'ratio', 'Jaccard similarity of declared roles; unassigned remains explicit',
      projection, candidate, source.length, output.length,
    ),
  ];
  return {
    schema: REFERENCE_COMPARISON_SCHEMA,
    taskId: projection.taskId,
    seedSha256: projection.seed.sha256,
    referenceSha256: projection.reference.sha256,
    candidateSourceSha256: candidate.baseSourceSha256,
    exactCopy: exact,
    structural,
    limits: [
      'The comparison is descriptive. It is not a permission or legal conclusion.',
      'The comparison is not an aesthetic verdict.',
      'Undeclared roles use the explicit unassigned label.',
    ],
  };
}

/** Create the reference profile of the pure symbolic module. */
export function referenceContextModule(): WorkstationModule<
ReferenceContextRequest, ReferenceContextResult
> {
  return {
    descriptor: {
      moduleId: REFERENCE_CONTEXT_MODULE_ID,
      version: REFERENCE_CONTEXT_MODULE_VERSION,
      acceptedSchemas: [REFERENCE_CONTEXT_REQUEST_SCHEMA],
      emittedSchemas: [REFERENCE_CONTEXT_SCHEMA],
      capabilities: [
        'extract-reference-structure-v0', 'render-bounded-reference-context-v0',
        'compare-complete-reference-v0',
      ],
      dependencyVersions: { node: process.versions.node },
      startupDeadlineMs: 250,
      requestDeadlineMs: 1_000,
    },
    handle: async (request) => {
      if (request.sourceSha256 !== request.payload.reference.digest.value) {
        fail('the module request source digest does not match its complete reference');
      }
      return {
        schema: WORKSTATION_RESPONSE_SCHEMA,
        requestId: request.requestId,
        sourceSha256: request.sourceSha256,
        outputSchema: REFERENCE_CONTEXT_SCHEMA,
        payload: referenceProjection(request.payload),
      };
    },
  };
}

/** Runtime validator for the experimental transform wrapper. */
export const referenceContextRequestValidator = z.custom<ReferenceContextRequest>((value) => {
  if (value === null || typeof value !== 'object') return false;
  const request = value as Partial<ReferenceContextRequest>;
  return request.seed !== undefined && request.reference !== undefined
    && typeof request.expectedReferenceSha256 === 'string' && request.task !== undefined;
});
