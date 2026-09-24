/** Project complete exact note state into the frozen compact agent context. */
import { createHash } from 'node:crypto';

import { addressKey } from '../contract/index.js';
import {
  WORKSTATION_RESPONSE_SCHEMA,
  type MissingCapability, type WorkstationModule,
} from '../workstation/module-registry.js';
import {
  AGENT_CONTEXT_SCHEMA, parseAgentContext, renderAgentContext, type AgentContext,
} from './agent-context.js';
import {
  EXACT_NOTE_SOURCE_DOMAIN, EXACT_NOTE_SOURCE_SCHEMA,
  exactNoteClipRangeDiagnostic, validateExactNoteSource, type ExactNoteSource,
} from './exact-note-source.js';

export const SYMBOLIC_CONTEXT_SCHEMA = 'symbolic-context-v0';
export const SYMBOLIC_CONTEXT_MODULE_ID = 'ghostnote-symbolic-context';
export const SYMBOLIC_CONTEXT_MODULE_VERSION = '0';
export const HOST_BEAT_RATIONAL_VERSION = 'host-beat-rational-v0';
export const SYMBOLIC_CONTEXT_MAX_EVENTS = 2_048;

const SYMBOLIC_MEASUREMENTS = ['note-count-v0', 'pitch-span-v0'] as const;
export type SymbolicMeasurement = typeof SYMBOLIC_MEASUREMENTS[number];

export interface ProviderVersion {
  readonly id: string;
  readonly adapterVersion: string;
  readonly dependencyVersion?: string;
  readonly settings: Readonly<Record<string, unknown>>;
}

export interface DeclaredTrackRole {
  readonly trackId: string;
  readonly role: string;
  readonly provenance: string;
}

export interface DeclaredRegion {
  readonly id: string;
  readonly fromBeats: number;
  readonly toBeats: number;
}

export interface HarmonyAlternative {
  readonly symbol: string;
  readonly score?: number;
}

export interface QualifiedHarmonyEvidence {
  readonly fieldId: string;
  readonly atBeats: number;
  readonly selected?: string;
  readonly alternatives: readonly HarmonyAlternative[];
  readonly confidenceRule: string;
  readonly sourceSha256: string;
  readonly provider: ProviderVersion;
}

export interface SymbolicContextTask {
  readonly id: string;
  readonly mode: 'compact-bar-v0';
  readonly coverage: { readonly fromBeats: number; readonly toBeats: number };
  readonly meter: { readonly numerator: number; readonly denominator: 1 | 2 | 4 | 8 | 16 | 32 };
  readonly tempoMap: readonly { readonly atBeats: number; readonly bpm: number }[];
  readonly roles?: readonly DeclaredTrackRole[];
  readonly regions?: readonly DeclaredRegion[];
  readonly harmony?: readonly QualifiedHarmonyEvidence[];
  readonly measurements: readonly SymbolicMeasurement[];
}

export interface SymbolicContextRequest {
  readonly source: ExactNoteSource;
  readonly expectedGeneration?: string;
  readonly task: SymbolicContextTask;
}

export interface SymbolicContextTimingEvent {
  readonly phase: 'source-validation' | 'projection' | 'context-validation' | 'render-and-hash';
  readonly elapsedMs: number;
}

export interface SymbolicContextOptions {
  readonly now?: () => number;
  readonly onTiming?: (event: SymbolicContextTimingEvent) => void;
}

export interface AuthorityEntry {
  readonly fieldId: string;
  readonly authority: 'exact-observation' | 'deterministic-derived' | 'declared'
  | 'inferred-label' | 'unavailable';
  readonly providerId: string;
  readonly sourceSha256: string;
  readonly provenance: string;
}

export interface ExactFact {
  readonly fieldId: string;
  readonly value: Readonly<Record<string, unknown>>;
  readonly unit: 'note';
  readonly kind: 'exact-observation';
  readonly sourceSha256: string;
  readonly providerId: string;
  readonly coverageEventIds: readonly string[];
}

export interface DerivedMeasurement {
  readonly fieldId: SymbolicMeasurement;
  readonly value: number;
  readonly unit: 'count' | 'semitones';
  readonly kind: 'derived-measurement';
  readonly sourceSha256: string;
  readonly providerId: string;
  readonly coverageEventIds: readonly string[];
  readonly formula: string;
  readonly settings: Readonly<Record<string, unknown>>;
  readonly tolerance: 'exact';
  readonly inputFieldIds: readonly string[];
}

export interface AlternativeEvidence {
  readonly fieldId: string;
  readonly candidates: readonly HarmonyAlternative[];
  readonly selected?: string;
  readonly kind: 'inferred-label';
  readonly confidenceRule: string;
  readonly sourceSha256: string;
  readonly providerId: string;
}

export interface SymbolicContextResult {
  readonly schema: typeof SYMBOLIC_CONTEXT_SCHEMA;
  readonly taskId: string;
  readonly source: {
    readonly id: string;
    readonly kind: ExactNoteSource['source']['kind'];
    readonly sha256: string;
    readonly digestDomain: typeof EXACT_NOTE_SOURCE_DOMAIN;
    readonly canonicalization: ExactNoteSource['canonicalization'];
    readonly permission: string;
    readonly observedAt: ExactNoteSource['observedAt'];
  };
  readonly exactCoverage: ExactNoteSource['coverage'];
  readonly contextCoverage: {
    readonly fromBeats: string;
    readonly toBeats: string;
    readonly clipCount: number;
    readonly trackAliases: readonly string[];
    readonly eventCount: number;
    readonly onsetRule: 'inclusive-start-exclusive-end';
    readonly sourceWasComplete: true;
    readonly omittedFields: readonly string[];
    readonly unavailableFields: readonly string[];
    readonly limits: { readonly maximumEvents: number };
  };
  readonly providers: readonly ProviderVersion[];
  readonly capabilities: readonly string[];
  readonly missingCapabilities: readonly MissingCapability[];
  readonly authority: readonly AuthorityEntry[];
  readonly exactFacts: readonly ExactFact[];
  readonly derivedMeasurements: readonly DerivedMeasurement[];
  readonly alternatives: readonly AlternativeEvidence[];
  readonly aliasMap: ExactNoteSource['aliases'];
  readonly context: AgentContext;
  readonly rendered: string;
  readonly contextDigest: {
    readonly algorithm: 'sha256';
    readonly domain: 'agent-context-v0';
    readonly value: string;
  };
  readonly warnings: readonly {
    readonly code: string;
    readonly field: string;
    readonly message: string;
  }[];
}

export class SymbolicContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SymbolicContextError';
  }
}

const SOURCE_PROVIDER: ProviderVersion = {
  id: 'ghostnote-exact-note-source', adapterVersion: '0',
  settings: { canonicalization: 'exact-note-json-v0' },
};
const CONTEXT_PROVIDER: ProviderVersion = {
  id: SYMBOLIC_CONTEXT_MODULE_ID, adapterVersion: SYMBOLIC_CONTEXT_MODULE_VERSION,
  settings: { beatAdapter: HOST_BEAT_RATIONAL_VERSION },
};
const TASK_PROVIDER: ProviderVersion = {
  id: 'ghostnote-task-declaration', adapterVersion: '0', settings: {},
};

const BASE_CAPABILITIES = [
  'render-compact-context-v0',
  'measure-note-count-v0',
  'measure-pitch-span-v0',
  'render-qualified-harmony-v0',
] as const;

const NO_THEORY: MissingCapability = {
  capability: 'analyze-harmony-v0',
  dependency: 'Music21',
  reason: 'no optional theory provider is configured',
};

function fail(message: string): never {
  throw new SymbolicContextError(message);
}

function gcd(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

function fractionText(numerator: bigint, denominator: bigint): string {
  if (numerator === 0n) return '0';
  const divisor = gcd(numerator, denominator);
  const reducedNumerator = numerator / divisor;
  const reducedDenominator = denominator / divisor;
  return reducedDenominator === 1n
    ? `${reducedNumerator}` : `${reducedNumerator}/${reducedDenominator}`;
}

function decimalFraction(value: number): string {
  const text = value.toString();
  const [coefficient, exponentText] = text.toLowerCase().split('e');
  const exponent = exponentText === undefined ? 0 : Number(exponentText);
  const negative = coefficient!.startsWith('-');
  const unsigned = negative ? coefficient!.slice(1) : coefficient!;
  const [whole, fraction = ''] = unsigned.split('.');
  const digits = `${whole}${fraction}`;
  let numerator = BigInt(digits || '0');
  if (negative) numerator = -numerator;
  const decimalPlaces = fraction.length - exponent;
  if (decimalPlaces <= 0) return fractionText(numerator * (10n ** BigInt(-decimalPlaces)), 1n);
  return fractionText(numerator, 10n ** BigInt(decimalPlaces));
}

/** Convert one finite host beat number without quantizing the exact source. */
export function hostBeatToRational(value: number): string {
  if (!Number.isFinite(value)) fail('a host beat value is not finite');
  if (Object.is(value, -0) || value === 0) return '0';
  const sign = value < 0 ? -1 : 1;
  const absolute = Math.abs(value);
  const maximumDenominator = 1_048_576;
  let x = absolute;
  let h0 = 0;
  let h1 = 1;
  let k0 = 1;
  let k1 = 0;
  for (let index = 0; index < 64; index += 1) {
    const coefficient = Math.floor(x);
    const h2 = coefficient * h1 + h0;
    const k2 = coefficient * k1 + k0;
    if (!Number.isSafeInteger(h2) || k2 > maximumDenominator) break;
    const candidate = h2 / k2;
    const tolerance = Number.EPSILON * Math.max(1, absolute) * 4;
    if (Math.abs(candidate - absolute) <= tolerance) {
      return fractionText(BigInt(sign * h2), BigInt(k2));
    }
    const remainder = x - coefficient;
    if (remainder === 0) break;
    [h0, h1] = [h1, h2];
    [k0, k1] = [k1, k2];
    x = 1 / remainder;
  }
  return decimalFraction(value);
}

function providerKey(provider: ProviderVersion): string {
  return `${provider.id}\0${provider.adapterVersion}\0${provider.dependencyVersion ?? ''}`;
}

function eventLocator(clipKey: string, channel: number, startBeats: number, pitch: number): string {
  return `${clipKey}\0${channel}\0${Object.is(startBeats, -0) ? 0 : startBeats}\0${pitch}`;
}

/** Render compact v0 context and evidence from verified exact state. */
export function exactSourceToContext(
  request: SymbolicContextRequest,
  options: SymbolicContextOptions = {},
): SymbolicContextResult {
  const now = options.now ?? (() => performance.now());
  let phaseStart = now();
  validateExactNoteSource(request.source);
  options.onTiming?.({ phase: 'source-validation', elapsedMs: now() - phaseStart });
  phaseStart = now();
  if (request.expectedGeneration !== undefined
      && request.expectedGeneration !== request.source.observedAt.generation) {
    fail('the exact source generation is stale for this request');
  }
  for (const clip of request.source.clips) {
    const diagnostic = exactNoteClipRangeDiagnostic(clip);
    if (diagnostic !== undefined) fail(diagnostic.message);
  }
  const task = request.task;
  if (task.id.length === 0) fail('the task ID must not be empty');
  if (task.mode !== 'compact-bar-v0') fail('only compact-bar-v0 is enabled for this task');
  if (!Number.isFinite(task.coverage.fromBeats) || !Number.isFinite(task.coverage.toBeats)
      || task.coverage.fromBeats < 0 || task.coverage.toBeats <= task.coverage.fromBeats) {
    fail('the task beat coverage is invalid');
  }
  if (request.source.clips.some((clip) => task.coverage.toBeats > clip.metadata.lengthBeats)) {
    fail('the task beat coverage extends beyond an addressed clip');
  }
  if (new Set(task.measurements).size !== task.measurements.length) {
    fail('the selected measurement list contains duplicates');
  }
  const supportedMeasurements = new Set<string>(SYMBOLIC_MEASUREMENTS);
  for (const measurement of task.measurements) {
    if (!supportedMeasurements.has(measurement)) {
      fail(`the selected measurement ${measurement} is unsupported`);
    }
  }

  const aliasByTrack = new Map(request.source.aliases.map((item) => [item.trackId, item.alias]));
  const roles = new Map<string, DeclaredTrackRole>();
  for (const role of task.roles ?? []) {
    if (!aliasByTrack.has(role.trackId)) fail(`role target ${role.trackId} is not in the exact source`);
    if (roles.has(role.trackId)) fail(`track ${role.trackId} has more than one declared role`);
    roles.set(role.trackId, role);
  }
  const eventIdByLocator = new Map(request.source.eventMap.map((entry) => [
    eventLocator(addressKey(entry.clip), entry.channel, entry.startBeats, entry.pitch), entry.id,
  ]));
  const authority: AuthorityEntry[] = [];
  const exactFacts: ExactFact[] = [];
  const warnings: SymbolicContextResult['warnings'][number][] = [];
  const usedTrackAliases = new Set<string>();
  const visibleEvents: AgentContext['events'][number][] = [];
  const presentOmittedNoteFields = new Set<string>(['channel']);
  const projectedNoteFields = new Set([
    'startBeats', 'durationBeats', 'pitch', 'velocity', 'isMuted',
  ]);
  const regions = (task.regions ?? []).map((region) => ({
    id: region.id,
    fromBeats: hostBeatToRational(region.fromBeats),
    toBeats: hostBeatToRational(region.toBeats),
  }));
  authority.push({
    fieldId: 'context.meter', authority: 'declared', providerId: TASK_PROVIDER.id,
    sourceSha256: request.source.digest.value, provenance: `task ${task.id}`,
  });
  authority.push({
    fieldId: 'context.tempoMap', authority: 'declared', providerId: TASK_PROVIDER.id,
    sourceSha256: request.source.digest.value, provenance: `task ${task.id}`,
  });
  for (const region of regions) {
    authority.push({
      fieldId: `context.region.${region.id}`, authority: 'declared', providerId: TASK_PROVIDER.id,
      sourceSha256: request.source.digest.value, provenance: `task ${task.id}`,
    });
  }

  for (const clip of request.source.clips) {
    const alias = aliasByTrack.get(clip.track.channelId);
    if (alias === undefined) fail(`track ${clip.track.channelId} has no valid context alias`);
    for (const channel of clip.channels) {
      for (const note of channel.notes) {
        if (note.startBeats < task.coverage.fromBeats || note.startBeats >= task.coverage.toBeats) continue;
        if (note.isMuted === undefined && request.source.source.kind !== 'live-bitwig') {
          fail('compact context requires an observed isMuted value for supplied exact state');
        }
        const mute = note.isMuted ?? false;
        if (visibleEvents.length >= SYMBOLIC_CONTEXT_MAX_EVENTS) {
          fail(`compact context is limited to ${SYMBOLIC_CONTEXT_MAX_EVENTS} events`);
        }
        const id = eventIdByLocator.get(eventLocator(
          addressKey(clip.address), channel.channel, note.startBeats, note.pitch,
        ));
        if (id === undefined) fail('the exact source event map does not cover one visible note');
        usedTrackAliases.add(alias);
        for (const key of Object.keys(note)) {
          if (!projectedNoteFields.has(key)) presentOmittedNoteFields.add(key);
        }
        const role = roles.get(clip.track.channelId);
        const matchingRegions = (task.regions ?? []).filter((region) =>
          note.startBeats >= region.fromBeats && note.startBeats < region.toBeats);
        if (matchingRegions.length > 1) fail(`event ${id} belongs to overlapping declared regions`);
        visibleEvents.push({
          id,
          track: alias,
          role: role?.role ?? 'unassigned',
          ...(matchingRegions[0] === undefined ? {} : { regionId: matchingRegions[0].id }),
          atBeats: hostBeatToRational(note.startBeats),
          durationBeats: hostBeatToRational(note.durationBeats),
          pitch: note.pitch,
          velocity: note.velocity,
          mute,
        });
        exactFacts.push({
          fieldId: `event.${id}`,
          value: {
            atBeats: note.startBeats, durationBeats: note.durationBeats,
            pitch: note.pitch, velocity: note.velocity,
            ...(note.isMuted === undefined ? {} : { mute: note.isMuted }),
          },
          unit: 'note', kind: 'exact-observation',
          sourceSha256: request.source.digest.value,
          providerId: SOURCE_PROVIDER.id,
          coverageEventIds: [id],
        });
        authority.push({
          fieldId: `event.${id}.role`,
          authority: role === undefined ? 'unavailable' : 'declared',
          providerId: role === undefined ? CONTEXT_PROVIDER.id : TASK_PROVIDER.id,
          sourceSha256: request.source.digest.value,
          provenance: role?.provenance ?? 'no musical role was supplied; unassigned is an absence marker',
        });
        if (note.isMuted === undefined) {
          authority.push({
            fieldId: `event.${id}.mute`, authority: 'deterministic-derived',
            providerId: SOURCE_PROVIDER.id, sourceSha256: request.source.digest.value,
            provenance: 'live verbose-note default elision maps absent isMuted to the host default false',
          });
          if (!warnings.some((warning) => warning.code === 'live-default-elision')) {
            warnings.push({
              code: 'live-default-elision', field: 'context.events.mute',
              message: 'The live decoder omits default false isMuted values. The projection restores the named host default.',
            });
          }
        }
        authority.push({
          fieldId: `event.${id}.articulation`, authority: 'unavailable',
          providerId: CONTEXT_PROVIDER.id, sourceSha256: request.source.digest.value,
          provenance: 'no articulation observation or qualified annotation was supplied',
        });
      }
    }
  }
  if (visibleEvents.length === 0) fail('the selected context is empty; no event can be invented');

  const alternatives: AlternativeEvidence[] = [];
  const harmony: AgentContext['harmony'] = [];
  const extraProviders = new Map<string, ProviderVersion>();
  for (const item of task.harmony ?? []) {
    if (item.sourceSha256 !== request.source.digest.value) {
      fail(`harmony evidence ${item.fieldId} names a different source`);
    }
    if (!Number.isFinite(item.atBeats)
        || item.atBeats < task.coverage.fromBeats
        || item.atBeats >= task.coverage.toBeats) {
      fail(`harmony evidence ${item.fieldId} is outside the task beat coverage`);
    }
    if (item.alternatives.length === 0 || item.confidenceRule.length === 0) {
      fail(`harmony evidence ${item.fieldId} lacks alternatives or a confidence rule`);
    }
    if (item.selected !== undefined
        && !item.alternatives.some((alternative) => alternative.symbol === item.selected)) {
      fail(`harmony evidence ${item.fieldId} selected a value outside its alternatives`);
    }
    extraProviders.set(providerKey(item.provider), item.provider);
    alternatives.push({
      fieldId: item.fieldId,
      candidates: item.alternatives,
      ...(item.selected === undefined ? {} : { selected: item.selected }),
      kind: 'inferred-label', confidenceRule: item.confidenceRule,
      sourceSha256: request.source.digest.value, providerId: item.provider.id,
    });
    if (item.selected !== undefined) {
      harmony.push({ atBeats: hostBeatToRational(item.atBeats), symbol: item.selected });
      authority.push({
        fieldId: `context.harmony.${harmony.length - 1}`,
        authority: 'inferred-label', providerId: item.provider.id,
        sourceSha256: request.source.digest.value,
        provenance: `${item.fieldId}; ${item.confidenceRule}`,
      });
    }
  }

  const fromBeats = hostBeatToRational(task.coverage.fromBeats);
  const toBeats = hostBeatToRational(task.coverage.toBeats);
  const omittedFields = [
    ...presentOmittedNoteFields,
    'clipAddress', 'clipMetadata', 'hostTrackId',
  ].sort();
  const unavailableFields = [
    ...(authority.some((item) => item.fieldId.endsWith('.role') && item.authority === 'unavailable')
      ? ['musicalRole'] : []),
    'articulation',
    ...(harmony.length === 0 ? ['harmony'] : []),
  ].sort();
  const projectedContext = {
    schema: AGENT_CONTEXT_SCHEMA,
    mode: task.mode,
    source: {
      sha256: request.source.digest.value,
      permission: request.source.source.permission,
      coverage: {
        fromBeats, toBeats,
        trackIds: [...usedTrackAliases].sort(),
        eventCount: visibleEvents.length,
        omittedFields,
      },
    },
    meter: task.meter,
    tempoMap: task.tempoMap.map((point) => ({
      atBeats: hostBeatToRational(point.atBeats), bpm: point.bpm,
    })),
    harmony,
    regions,
    events: visibleEvents,
  };
  options.onTiming?.({ phase: 'projection', elapsedMs: now() - phaseStart });
  phaseStart = now();
  const context = parseAgentContext(projectedContext);
  options.onTiming?.({ phase: 'context-validation', elapsedMs: now() - phaseStart });
  phaseStart = now();
  const rendered = renderAgentContext(context);
  const contextSha256 = createHash('sha256').update(rendered, 'utf8').digest('hex');
  options.onTiming?.({ phase: 'render-and-hash', elapsedMs: now() - phaseStart });
  const eventIds = context.events.map((event) => event.id);
  const derivedMeasurements = task.measurements.map((measurement): DerivedMeasurement => {
    if (measurement === 'note-count-v0') {
      return {
        fieldId: measurement, value: context.events.length, unit: 'count',
        kind: 'derived-measurement', sourceSha256: request.source.digest.value,
        providerId: CONTEXT_PROVIDER.id, coverageEventIds: eventIds,
        formula: 'count(compact events)', settings: {}, tolerance: 'exact',
        inputFieldIds: eventIds.map((id) => `event.${id}`),
      };
    }
    if (measurement === 'pitch-span-v0') {
      const pitches = context.events.map((event) => event.pitch);
      return {
        fieldId: measurement,
        value: Math.max(...pitches) - Math.min(...pitches),
        unit: 'semitones', kind: 'derived-measurement',
        sourceSha256: request.source.digest.value,
        providerId: CONTEXT_PROVIDER.id, coverageEventIds: eventIds,
        formula: 'maximum MIDI pitch minus minimum MIDI pitch', settings: {}, tolerance: 'exact',
        inputFieldIds: eventIds.map((id) => `event.${id}.pitch`),
      };
    }
    return fail(`the selected measurement ${measurement} is unsupported`);
  });
  for (const measurement of derivedMeasurements) {
    authority.push({
      fieldId: measurement.fieldId, authority: 'deterministic-derived',
      providerId: measurement.providerId, sourceSha256: request.source.digest.value,
      provenance: measurement.formula,
    });
  }

  return {
    schema: SYMBOLIC_CONTEXT_SCHEMA,
    taskId: task.id,
    source: {
      id: request.source.source.id,
      kind: request.source.source.kind,
      sha256: request.source.digest.value,
      digestDomain: EXACT_NOTE_SOURCE_DOMAIN,
      canonicalization: request.source.canonicalization,
      permission: request.source.source.permission,
      observedAt: request.source.observedAt,
    },
    exactCoverage: request.source.coverage,
    contextCoverage: {
      fromBeats, toBeats,
      clipCount: request.source.clips.length,
      trackAliases: [...usedTrackAliases].sort(),
      eventCount: context.events.length,
      onsetRule: 'inclusive-start-exclusive-end',
      sourceWasComplete: true,
      omittedFields,
      unavailableFields,
      limits: { maximumEvents: SYMBOLIC_CONTEXT_MAX_EVENTS },
    },
    providers: [SOURCE_PROVIDER, CONTEXT_PROVIDER, TASK_PROVIDER, ...extraProviders.values()],
    capabilities: BASE_CAPABILITIES,
    missingCapabilities: [NO_THEORY],
    authority,
    exactFacts,
    derivedMeasurements,
    alternatives,
    aliasMap: request.source.aliases,
    context,
    rendered,
    contextDigest: {
      algorithm: 'sha256', domain: 'agent-context-v0',
      value: contextSha256,
    },
    warnings: [...warnings, {
      code: 'v0-articulation-display-sentinel', field: 'context.events.articulation',
      message: 'The v0 renderer prints normal when optional articulation is absent. It is not an observation.',
    }],
  };
}

/** Create the pure module. Discovery and use do not connect to Bitwig or Python. */
export function symbolicContextModule(
  options: SymbolicContextOptions = {},
): WorkstationModule<SymbolicContextRequest, SymbolicContextResult> {
  return {
    descriptor: {
      moduleId: SYMBOLIC_CONTEXT_MODULE_ID,
      version: SYMBOLIC_CONTEXT_MODULE_VERSION,
      acceptedSchemas: [EXACT_NOTE_SOURCE_SCHEMA],
      emittedSchemas: [SYMBOLIC_CONTEXT_SCHEMA],
      capabilities: BASE_CAPABILITIES,
      missingCapabilities: [NO_THEORY],
      dependencyVersions: { node: process.versions.node },
      startupDeadlineMs: 250,
      requestDeadlineMs: 1_000,
    },
    handle: async (request) => {
      if (request.sourceSha256 !== request.payload.source.digest.value) {
        fail('the module request source digest does not match its exact source');
      }
      return {
        schema: WORKSTATION_RESPONSE_SCHEMA,
        requestId: request.requestId,
        sourceSha256: request.sourceSha256,
        outputSchema: SYMBOLIC_CONTEXT_SCHEMA,
        payload: exactSourceToContext(request.payload, options),
      };
    },
  };
}
