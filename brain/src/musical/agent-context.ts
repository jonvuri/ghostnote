/** Versioned agent-facing musical context with an optional groove overlay. */
import { createHash } from 'node:crypto';

import { z } from 'zod';

export const AGENT_CONTEXT_SCHEMA = 'ghostnote-agent-context-v0';
export const GROOVE_CONTEXT_SCHEMA = 'ghostnote-groove-context-v0';
export const AGENT_CONTEXT_MODES = ['compact-bar-v0', 'groove-two-layer-v0'] as const;

const identifier = z.string().regex(
  /^[A-Za-z][A-Za-z0-9_.:-]*$/,
  'must start with a letter and use only letters, digits, dot, underscore, colon, or hyphen',
);
const sha256 = z.string().regex(/^[0-9a-f]{64}$/, 'must be a lowercase SHA-256 value');

interface FractionValue {
  readonly numerator: bigint;
  readonly denominator: bigint;
}

function gcd(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

function fractionText(value: FractionValue): string {
  if (value.numerator === 0n) return '0';
  const divisor = gcd(value.numerator, value.denominator);
  const numerator = value.numerator / divisor;
  const denominator = value.denominator / divisor;
  return denominator === 1n ? `${numerator}` : `${numerator}/${denominator}`;
}

function fractionOf(value: string): FractionValue {
  const [rawNumerator, rawDenominator] = value.split('/');
  return {
    numerator: BigInt(rawNumerator!),
    denominator: rawDenominator === undefined ? 1n : BigInt(rawDenominator),
  };
}

function addFractions(...values: readonly FractionValue[]): FractionValue {
  return values.reduce<FractionValue>((sum, value) => ({
    numerator: sum.numerator * value.denominator + value.numerator * sum.denominator,
    denominator: sum.denominator * value.denominator,
  }), { numerator: 0n, denominator: 1n });
}

function compareFractions(left: FractionValue, right: FractionValue): number {
  const difference = left.numerator * right.denominator - right.numerator * left.denominator;
  return difference < 0n ? -1 : difference > 0n ? 1 : 0;
}

function fractionNumber(value: FractionValue): number {
  return Number(value.numerator) / Number(value.denominator);
}

const rational = z.string()
  .regex(/^-?(0|[1-9][0-9]*)(\/[1-9][0-9]*)?$/, 'must be an exact rational')
  .refine((value) => fractionText(fractionOf(value)) === value, 'must be in canonical reduced form');
const nonnegativeRational = rational.refine(
  (value) => fractionOf(value).numerator >= 0n,
  'must be non-negative',
);
const positiveRational = rational.refine(
  (value) => fractionOf(value).numerator > 0n,
  'must be positive',
);

const coverageSchema = z.object({
  fromBeats: nonnegativeRational,
  toBeats: positiveRational,
  trackIds: z.array(identifier).min(1),
  eventCount: z.number().int().nonnegative(),
  omittedFields: z.array(z.string().min(1)),
}).strict();

const sourceSchema = z.object({
  sha256,
  permission: z.string().min(1),
  coverage: coverageSchema,
}).strict();

const tempoPointSchema = z.object({
  atBeats: nonnegativeRational,
  bpm: z.number().finite().positive(),
}).strict();

const regionSchema = z.object({
  id: identifier,
  fromBeats: nonnegativeRational,
  toBeats: positiveRational,
}).strict();

const harmonySchema = z.object({
  atBeats: nonnegativeRational,
  symbol: z.string().min(1),
}).strict();

const eventSchema = z.object({
  id: identifier,
  track: identifier,
  role: identifier,
  layer: identifier.optional(),
  regionId: identifier.optional(),
  atBeats: nonnegativeRational,
  durationBeats: positiveRational,
  pitch: z.number().int().min(0).max(127),
  velocity: z.number().int().min(0).max(127),
  mute: z.boolean(),
  articulation: identifier.optional(),
}).strict();

const timingShapeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('point') }).strict(),
  z.object({ kind: z.literal('span'), widthBeats: positiveRational }).strict(),
]);

const timingReferenceSchema = z.object({
  id: identifier,
  subdivisionBeats: positiveRational,
  phaseBeats: rational,
  swingRatio: z.string().regex(/^[1-9][0-9]*:[1-9][0-9]*$/).optional(),
  shape: timingShapeSchema,
}).strict();

const timingProvenanceSchema = z.object({
  kind: z.enum(['declared', 'measured', 'inferred']),
  source: z.string().min(1),
}).strict();

const grooveEventSchema = z.object({
  eventId: identifier,
  nominalAtBeats: nonnegativeRational,
  nominalDurationBeats: positiveRational,
  realizedDurationBeats: positiveRational,
  referenceId: identifier,
  templateBeats: rational,
  crossPartBeats: rational,
  localBeats: rational,
  deviationBeats: rational,
  deviationMs: z.number().finite(),
  anchorEventId: identifier.optional(),
  confidence: z.number().finite().min(0).max(1),
  provenance: timingProvenanceSchema,
}).strict();

const grooveSchema = z.object({
  schema: z.literal(GROOVE_CONTEXT_SCHEMA),
  references: z.array(timingReferenceSchema).min(1),
  events: z.array(grooveEventSchema).min(1),
  generation: z.object({
    generator: identifier,
    version: z.string().min(1),
    seed: z.string().min(1),
    policy: identifier,
  }).strict().optional(),
}).strict();

export const agentContextSchema = z.object({
  schema: z.literal(AGENT_CONTEXT_SCHEMA),
  mode: z.enum(AGENT_CONTEXT_MODES),
  source: sourceSchema,
  meter: z.object({
    numerator: z.number().int().positive(),
    denominator: z.union([
      z.literal(1), z.literal(2), z.literal(4), z.literal(8), z.literal(16), z.literal(32),
    ]),
  }).strict(),
  tempoMap: z.array(tempoPointSchema).min(1),
  harmony: z.array(harmonySchema),
  regions: z.array(regionSchema),
  events: z.array(eventSchema).min(1),
  groove: grooveSchema.optional(),
}).strict().superRefine((context, issues) => {
  const add = (path: readonly (string | number)[], message: string): void => {
    issues.addIssue({ code: 'custom', path: [...path], message });
  };
  if (context.mode === 'compact-bar-v0' && context.groove !== undefined) {
    add(['groove'], 'compact-bar-v0 must not include the groove overlay');
  }
  if (context.mode === 'groove-two-layer-v0' && context.groove === undefined) {
    add(['groove'], 'groove-two-layer-v0 requires the groove overlay');
  }

  const eventIds = new Set<string>();
  const trackIds = new Set<string>();
  context.events.forEach((event, index) => {
    if (eventIds.has(event.id)) add(['events', index, 'id'], 'event IDs must be unique');
    eventIds.add(event.id);
    trackIds.add(event.track);
  });
  if (context.source.coverage.eventCount !== context.events.length) {
    add(['source', 'coverage', 'eventCount'], 'event count must equal the visible event count');
  }
  if ([...trackIds].sort().join('\0') !== [...new Set(context.source.coverage.trackIds)].sort().join('\0')) {
    add(['source', 'coverage', 'trackIds'], 'track coverage must equal the visible track set');
  }
  if (new Set(context.source.coverage.trackIds).size !== context.source.coverage.trackIds.length) {
    add(['source', 'coverage', 'trackIds'], 'track coverage must not contain duplicates');
  }
  const coverageFrom = fractionOf(context.source.coverage.fromBeats);
  const coverageTo = fractionOf(context.source.coverage.toBeats);
  if (compareFractions(coverageFrom, coverageTo) >= 0) {
    add(['source', 'coverage'], 'coverage end must be after coverage start');
  }
  context.events.forEach((event, index) => {
    const at = fractionOf(event.atBeats);
    if (compareFractions(at, coverageFrom) < 0 || compareFractions(at, coverageTo) >= 0) {
      add(['events', index, 'atBeats'], 'event start must be inside declared beat coverage');
    }
  });

  const regionIds = new Set<string>();
  context.regions.forEach((region, index) => {
    if (regionIds.has(region.id)) add(['regions', index, 'id'], 'region IDs must be unique');
    regionIds.add(region.id);
    if (compareFractions(fractionOf(region.fromBeats), fractionOf(region.toBeats)) >= 0) {
      add(['regions', index], 'region end must be after region start');
    }
  });
  context.events.forEach((event, index) => {
    if (event.regionId !== undefined && !regionIds.has(event.regionId)) {
      add(['events', index, 'regionId'], 'event region must exist');
    }
  });

  for (let index = 1; index < context.tempoMap.length; index += 1) {
    if (compareFractions(
      fractionOf(context.tempoMap[index - 1]!.atBeats),
      fractionOf(context.tempoMap[index]!.atBeats),
    ) >= 0) add(['tempoMap', index, 'atBeats'], 'tempo points must increase');
  }
  if (context.tempoMap[0]?.atBeats !== '0') {
    add(['tempoMap', 0, 'atBeats'], 'the first tempo point must start at beat 0');
  }

  if (context.groove === undefined) return;
  const references = new Map<string, z.infer<typeof timingReferenceSchema>>();
  context.groove.references.forEach((reference, index) => {
    if (references.has(reference.id)) add(['groove', 'references', index, 'id'], 'reference IDs must be unique');
    references.set(reference.id, reference);
  });
  const timedEvents = new Set<string>();
  context.groove.events.forEach((timing, index) => {
    const path = ['groove', 'events', index] as const;
    if (timedEvents.has(timing.eventId)) add([...path, 'eventId'], 'one event can have only one timing overlay');
    timedEvents.add(timing.eventId);
    const event = context.events.find((candidate) => candidate.id === timing.eventId);
    if (event === undefined) {
      add([...path, 'eventId'], 'timing event must exist in the compact event plane');
      return;
    }
    const reference = references.get(timing.referenceId);
    if (reference === undefined) {
      add([...path, 'referenceId'], 'timing reference must exist');
      return;
    }
    if (timing.anchorEventId !== undefined && !eventIds.has(timing.anchorEventId)) {
      add([...path, 'anchorEventId'], 'anchor event must exist');
    }
    const deviation = addFractions(
      fractionOf(reference.phaseBeats),
      fractionOf(timing.templateBeats),
      fractionOf(timing.crossPartBeats),
      fractionOf(timing.localBeats),
    );
    if (fractionText(deviation) !== timing.deviationBeats) {
      add([...path, 'deviationBeats'], 'deviation must equal reference phase plus template, cross-part, and local components');
    }
    const realized = addFractions(fractionOf(timing.nominalAtBeats), deviation);
    if (fractionText(realized) !== event.atBeats) {
      add([...path, 'nominalAtBeats'], 'nominal position plus deviation must equal the compact realized position');
    }
    if (timing.realizedDurationBeats !== event.durationBeats) {
      add([...path, 'realizedDurationBeats'], 'realized duration must equal the compact duration');
    }
    const nominal = fractionOf(timing.nominalAtBeats);
    const tempo = [...context.tempoMap].reverse().find((point) =>
      compareFractions(fractionOf(point.atBeats), nominal) <= 0);
    if (tempo !== undefined) {
      const milliseconds = fractionNumber(deviation) * 60_000 / tempo.bpm;
      if (Math.abs(milliseconds - timing.deviationMs) > 0.000001) {
        add([...path, 'deviationMs'], 'milliseconds must match the beat deviation and active tempo');
      }
    }
  });
});

export type AgentContext = z.infer<typeof agentContextSchema>;
export type AgentContextMode = AgentContext['mode'];
export type GrooveContext = NonNullable<AgentContext['groove']>;

export class AgentContextError extends Error {
  constructor(message: string, readonly issues: readonly string[]) {
    super(message);
    this.name = 'AgentContextError';
  }
}

/** Validate an unknown context and keep every refusal path explicit. */
export function parseAgentContext(input: unknown): AgentContext {
  const parsed = agentContextSchema.safeParse(input);
  if (parsed.success) return parsed.data;
  const issues = parsed.error.issues.map((issue) =>
    `${issue.path.length === 0 ? 'context' : issue.path.join('.')}: ${issue.message}`);
  throw new AgentContextError(`invalid agent musical context: ${issues.join('; ')}`, issues);
}

function shapeText(shape: z.infer<typeof timingShapeSchema>): string {
  return shape.kind === 'point' ? 'point' : `span:${shape.widthBeats}`;
}

function byBeatThenId(
  left: { readonly atBeats: string; readonly id?: string; readonly symbol?: string },
  right: { readonly atBeats: string; readonly id?: string; readonly symbol?: string },
): number {
  return compareFractions(fractionOf(left.atBeats), fractionOf(right.atBeats))
    || (left.id ?? left.symbol ?? '').localeCompare(right.id ?? right.symbol ?? '');
}

/** Render the deterministic agent text view. This function cannot read or write Bitwig. */
export function renderAgentContext(input: AgentContext): string {
  const context = parseAgentContext(input);
  const lines = [
    `CONTEXT ${context.schema} MODE ${context.mode}`,
    `SOURCE ${context.source.sha256} PERMISSION ${JSON.stringify(context.source.permission)}`,
    `COVERAGE ${context.source.coverage.fromBeats}..${context.source.coverage.toBeats} `
      + `TRACKS ${[...context.source.coverage.trackIds].sort().join(',')} `
      + `EVENTS ${context.source.coverage.eventCount} `
      + `OMITS ${[...context.source.coverage.omittedFields].sort().join(',') || 'none'}`,
    `METER ${context.meter.numerator}/${context.meter.denominator}`,
  ];
  lines.push(...context.tempoMap.map((point) => `TEMPO ${point.atBeats} ${point.bpm}`));
  lines.push(...[...context.harmony].sort(byBeatThenId)
    .map((item) => `HARMONY ${item.atBeats} ${JSON.stringify(item.symbol)}`));
  lines.push(...[...context.regions].sort((left, right) =>
    compareFractions(fractionOf(left.fromBeats), fractionOf(right.fromBeats))
      || left.id.localeCompare(right.id)).map((region) =>
    `REGION ${region.id} ${region.fromBeats}..${region.toBeats}`));
  const events = [...context.events].sort((left, right) => byBeatThenId(left, right)
    || left.track.localeCompare(right.track) || left.pitch - right.pitch);
  lines.push(...events.map((event) =>
    `EVENT ${event.id} TRACK ${event.track} ROLE ${event.role} LAYER ${event.layer ?? 'none'} `
      + `REGION ${event.regionId ?? 'none'} AT ${event.atBeats} DUR ${event.durationBeats} `
      + `PITCH ${event.pitch} VELOCITY ${event.velocity} MUTE ${event.mute} `
      + `ARTICULATION ${event.articulation ?? 'normal'}`));
  if (context.groove !== undefined) {
    lines.push(`GROOVE ${context.groove.schema}`);
    lines.push(...[...context.groove.references].sort((left, right) => left.id.localeCompare(right.id))
      .map((reference) =>
      `REFERENCE ${reference.id} SUBDIVISION ${reference.subdivisionBeats} PHASE ${reference.phaseBeats} `
        + `SWING ${reference.swingRatio ?? 'none'} SHAPE ${shapeText(reference.shape)}`));
    const eventOrder = new Map(events.map((event, index) => [event.id, index]));
    lines.push(...[...context.groove.events].sort((left, right) =>
      eventOrder.get(left.eventId)! - eventOrder.get(right.eventId)!).map((timing) =>
      `TIMING ${timing.eventId} NOMINAL ${timing.nominalAtBeats} NOMINAL_DUR ${timing.nominalDurationBeats} `
        + `REALIZED_DUR ${timing.realizedDurationBeats} REF ${timing.referenceId} `
        + `TEMPLATE ${timing.templateBeats} CROSS ${timing.crossPartBeats} LOCAL ${timing.localBeats} `
        + `DEVIATION ${timing.deviationBeats} DEVIATION_MS ${timing.deviationMs} `
        + `ANCHOR ${timing.anchorEventId ?? 'none'} CONFIDENCE ${timing.confidence} `
        + `PROVENANCE ${timing.provenance.kind}:${JSON.stringify(timing.provenance.source)}`));
    if (context.groove.generation !== undefined) {
      const generation = context.groove.generation;
      lines.push(`GENERATION ${generation.generator} VERSION ${JSON.stringify(generation.version)} `
        + `SEED ${JSON.stringify(generation.seed)} POLICY ${generation.policy}`);
    }
  }
  return lines.join('\n');
}

/** Fingerprint the exact rendered view used by an agent call. */
export function fingerprintAgentContext(input: AgentContext): string {
  return createHash('sha256').update(renderAgentContext(input), 'utf8').digest('hex');
}
