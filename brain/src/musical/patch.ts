/**
 * The versioned, beats-native musical intent contract.
 *
 * This module is pure. It does not read Bitwig and cannot write a project. The
 * theory and transformation sessions materialize each ordered pipeline as
 * canonical notes. The application planner then compiles those notes to the
 * existing `Op` union through `compileMusicalClip`.
 */
import { createHash } from 'node:crypto';

import { z } from 'zod';

import type { ClipAddress, Op } from '../contract/index.js';
import type { NoteRecord } from '../contract/state.js';

export const MUSICAL_PATCH_SCHEMA = 'ghostnote-musical-patch';
export const MUSICAL_PATCH_VERSION = 1;

const finite = z.number().finite();
const beat = finite.nonnegative();
const positiveBeat = finite.positive();
const midiPitch = finite.int().min(0).max(127);
const midiChannel = finite.int().min(0).max(15);

const expressionSchema = z.object({
  releaseVelocity: finite.min(0).max(1).optional(),
  velocitySpread: finite.min(0).max(1).optional(),
  gain: finite.optional(),
  pan: finite.min(-1).max(1).optional(),
  timbre: finite.min(-1).max(1).optional(),
  transpose: finite.optional(),
  chance: finite.min(0).max(1).optional(),
  isChanceEnabled: z.boolean().optional(),
  isMuted: z.boolean().optional(),
  isOccurrenceEnabled: z.boolean().optional(),
  occurrence: z.string().optional(),
  isRecurrenceEnabled: z.boolean().optional(),
  recurrence: z.tuple([finite, finite]).optional(),
  isRepeatEnabled: z.boolean().optional(),
  repeatCount: finite.int().optional(),
  repeatCurve: finite.optional(),
  repeatVelocityCurve: finite.optional(),
  repeatVelocityEnd: finite.optional(),
}).strict();

const literalNoteSchema = expressionSchema.extend({
  startBeats: beat,
  pitch: midiPitch,
  velocity: finite.min(0).max(127),
  durationBeats: positiveBeat,
}).strict();

const literalSourceSchema = z.object({
  kind: z.literal('notes'), notes: z.array(literalNoteSchema).min(1),
}).strict();

const theorySourceSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('intervals'), root: z.string().min(1), intervals: z.array(z.string().min(1)).min(1),
  }).strict(),
  z.object({ kind: z.literal('chord'), symbol: z.string().min(1), octave: finite.int() }).strict(),
  z.object({
    kind: z.literal('scale'), tonic: z.string().min(1), name: z.string().min(1),
    octave: finite.int(), octaves: finite.int().min(1),
  }).strict(),
  z.object({
    kind: z.literal('progression'), key: z.string().min(1),
    degrees: z.array(z.string().min(1)).min(1), octave: finite.int(),
  }).strict(),
  z.object({
    kind: z.literal('pitch-class-set'), pitchClasses: z.array(z.string().min(1)).min(1),
    octave: finite.int(), octaves: finite.int().min(1),
  }).strict(),
]);

const placementSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('stack'), startBeats: beat, durationBeats: positiveBeat }).strict(),
  z.object({
    kind: z.literal('sequence'), startBeats: beat, stepBeats: positiveBeat,
    durationBeats: positiveBeat,
  }).strict(),
]);

const selectionSchema = z.object({
  beatRange: z.object({ fromBeats: beat, toBeats: positiveBeat }).strict().optional(),
  pitchRange: z.object({ min: midiPitch, max: midiPitch }).strict().optional(),
}).strict().superRefine((selection, ctx) => {
  if (selection.beatRange !== undefined
      && selection.beatRange.toBeats <= selection.beatRange.fromBeats) {
    ctx.addIssue({ code: 'custom', path: ['beatRange'], message: 'toBeats must be greater than fromBeats' });
  }
  if (selection.pitchRange !== undefined
      && selection.pitchRange.max < selection.pitchRange.min) {
    ctx.addIssue({ code: 'custom', path: ['pitchRange'], message: 'max must be at least min' });
  }
});

const harmonySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('intervals'), intervals: z.array(z.string().min(1)).min(1) }).strict(),
  z.object({ kind: z.literal('chord'), symbol: z.string().min(1) }).strict(),
  z.object({ kind: z.literal('scale'), tonic: z.string().min(1), name: z.string().min(1) }).strict(),
  z.object({ kind: z.literal('detect'), as: z.enum(['chord', 'scale']) }).strict(),
]);

const generateSchema = z.union([
  z.object({ op: z.literal('generate'), source: literalSourceSchema }).strict(),
  z.object({
    op: z.literal('generate'), source: theorySourceSchema, placement: placementSchema,
    velocity: finite.min(0).max(127), expression: expressionSchema.optional(),
  }).strict(),
]);

const operationSchema = z.union([
  generateSchema,
  z.object({
    op: z.literal('transpose'), semitones: finite.int(), selection: selectionSchema.optional(),
  }).strict(),
  z.object({
    op: z.literal('harmonize'), harmony: harmonySchema,
    selection: selectionSchema.optional(),
  }).strict(),
  z.object({
    op: z.literal('arpeggiate'), pattern: z.enum(['up', 'down', 'up-down', 'as-played']),
    stepBeats: positiveBeat, durationBeats: positiveBeat, selection: selectionSchema.optional(),
  }).strict(),
  z.object({
    op: z.literal('revoice'), minPitch: midiPitch, maxPitch: midiPitch,
    strategy: z.enum(['closest', 'ascending', 'drop-2']), selection: selectionSchema.optional(),
  }).strict().refine((op) => op.maxPitch >= op.minPitch, {
    path: ['maxPitch'], message: 'maxPitch must be at least minPitch',
  }),
  z.object({
    op: z.literal('quantize'), gridBeats: positiveBeat, strength: finite.min(0).max(1),
    selection: selectionSchema.optional(),
  }).strict(),
  z.object({
    op: z.literal('humanize'), maxTimingBeats: beat, maxVelocity: finite.min(0).max(127),
    selection: selectionSchema.optional(),
  }).strict(),
  z.object({
    op: z.literal('thin'), probability: finite.min(0).max(1), selection: selectionSchema.optional(),
  }).strict(),
  z.object({
    op: z.literal('densify'), gridBeats: positiveBeat,
    probability: finite.min(0).max(1), selection: selectionSchema.optional(),
  }).strict(),
]);

const targetSchema = z.object({
  clip: z.object({ trackId: z.string().min(1), row: finite.int().nonnegative() }).strict(),
  channel: midiChannel,
  write: z.enum(['merge', 'replace']),
  operations: z.array(operationSchema).min(1),
}).strict().superRefine((target, ctx) => {
  const generateAt = target.operations
    .map((operation, index) => operation.op === 'generate' ? index : -1)
    .filter((index) => index >= 0);
  if (generateAt.length > 1 || (generateAt.length === 1 && generateAt[0] !== 0)) {
    ctx.addIssue({
      code: 'custom', path: ['operations'],
      message: 'generate may occur once and must be the first operation',
    });
  }
});

const protectionSchema = z.union([
  z.object({ kind: z.literal('direct') }).strict(),
  z.object({
    kind: z.literal('clip-block'),
    reason: z.literal('requested-variations'),
    takes: finite.int().min(2),
  }).strict(),
  z.object({
    kind: z.literal('clip-block'),
    reason: z.literal('fidelity-required'),
    takes: finite.int().min(1),
  }).strict(),
]);

export const musicalPatchSchema = z.object({
  schema: z.literal(MUSICAL_PATCH_SCHEMA),
  version: z.literal(MUSICAL_PATCH_VERSION),
  seed: z.string().min(1).optional(),
  protection: protectionSchema,
  targets: z.array(targetSchema).min(1),
}).strict().superRefine((patch, ctx) => {
  const keys = new Set<string>();
  patch.targets.forEach((target, targetIndex) => {
    const key = `${target.clip.trackId}:${target.clip.row}:${target.channel}`;
    if (keys.has(key)) {
      ctx.addIssue({ code: 'custom', path: ['targets', targetIndex], message: 'duplicate clip channel target' });
    }
    keys.add(key);
  });

  const random = patch.targets.some((target) => target.operations.some((operation) =>
    operation.op === 'humanize' || operation.op === 'thin' || operation.op === 'densify'));
  const variations = patch.protection.kind === 'clip-block'
    && patch.protection.reason === 'requested-variations';
  if ((random || variations) && patch.seed === undefined) {
    ctx.addIssue({ code: 'custom', path: ['seed'], message: 'a seed is required for random work and variations' });
  }
  if (variations && !random) {
    ctx.addIssue({
      code: 'custom', path: ['targets'],
      message: 'requested variations need at least one humanize, thin, or densify operation',
    });
  }
});

export type MusicalPatch = z.infer<typeof musicalPatchSchema>;
export type MusicalTarget = MusicalPatch['targets'][number];
export type MusicalOperation = MusicalTarget['operations'][number];
export type MusicalOperationKind = MusicalOperation['op'];
export type MusicalSelection = z.infer<typeof selectionSchema>;
export type WritableExpression = z.infer<typeof expressionSchema>;

export class MusicalPatchError extends Error {
  constructor(message: string, readonly issues: readonly string[] = []) {
    super(message);
    this.name = 'MusicalPatchError';
  }
}

function incompatibleVersion(input: unknown): number | undefined {
  if (input === null || typeof input !== 'object') return undefined;
  const version = (input as Record<string, unknown>)['version'];
  return typeof version === 'number' ? version : undefined;
}

function pathToKey(input: unknown, wanted: string, path: readonly (string | number)[] = []): string | undefined {
  if (Array.isArray(input)) {
    for (let index = 0; index < input.length; index += 1) {
      const found = pathToKey(input[index], wanted, [...path, index]);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  if (input === null || typeof input !== 'object') return undefined;
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (key === wanted) return [...path, key].join('.');
    const found = pathToKey(value, wanted, [...path, key]);
    if (found !== undefined) return found;
  }
  return undefined;
}

/** Validate an unknown value and reject incompatible versions explicitly. */
export function parseMusicalPatch(input: unknown): MusicalPatch {
  const version = incompatibleVersion(input);
  if (version !== undefined && version !== MUSICAL_PATCH_VERSION) {
    throw new MusicalPatchError(
      `musical patch version mismatch: expected v${MUSICAL_PATCH_VERSION}, received v${version}`,
    );
  }
  const pressure = pathToKey(input, 'pressure');
  if (pressure !== undefined) {
    throw new MusicalPatchError(
      `invalid musical patch: ${pressure}: pressure is not writable and cannot be dropped`,
      [`${pressure}: pressure is not writable and cannot be dropped`],
    );
  }
  const parsed = musicalPatchSchema.safeParse(input);
  if (parsed.success) return parsed.data;
  const issues = parsed.error.issues.map((issue) =>
    `${issue.path.length === 0 ? 'patch' : issue.path.join('.')}: ${issue.message}`);
  throw new MusicalPatchError(`invalid musical patch: ${issues.join('; ')}`, issues);
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalValue(item)]),
    );
  }
  return value;
}

/** Serialize with stable object-key order. Array order stays significant. */
export const encodeMusicalPatch = (patch: MusicalPatch): string =>
  JSON.stringify(canonicalValue(parseMusicalPatch(patch)));

/** Decode one serialized patch. */
export function decodeMusicalPatch(value: string): MusicalPatch {
  let input: unknown;
  try {
    input = JSON.parse(value);
  } catch (error) {
    throw new MusicalPatchError(`invalid musical patch JSON: ${String(error)}`);
  }
  return parseMusicalPatch(input);
}

export type MusicalToolBoundary = 'generation' | 'transformation';

/** Count musical outputs. Fidelity protection keeps adjacent copies unchanged. */
export function musicalOutputCount(patch: MusicalPatch): number {
  return patch.protection.kind === 'clip-block'
    && patch.protection.reason === 'requested-variations'
    ? patch.protection.takes
    : 1;
}

/** Enforce the object boundary that the two future public tools use. */
export function assertMusicalToolBoundary(
  patch: MusicalPatch,
  boundary: MusicalToolBoundary,
): void {
  patch.targets.forEach((target, index) => {
    const generated = target.operations[0]?.op === 'generate';
    if (boundary === 'generation' && !generated) {
      throw new MusicalPatchError(`generation target ${index} must start with generate`);
    }
    if (boundary === 'transformation' && generated) {
      throw new MusicalPatchError(`transformation target ${index} must start from existing clip content`);
    }
  });
}

export interface MaterializedMusicalChannel {
  readonly channel: number;
  readonly notes: readonly NoteRecord[];
}

export interface MaterializedMusicalTarget extends MaterializedMusicalChannel {
  readonly write: MusicalTarget['write'];
  readonly targetIndex: number;
  readonly variationIndex: number;
  readonly operationIndex: number;
}

export interface MaterializedMusicalPreflight {
  readonly revision: number;
  readonly channels: readonly MaterializedMusicalChannel[];
}

export interface MusicalCompilation {
  readonly ops: readonly Op[];
  readonly ifRevision: number;
  readonly loss: readonly MusicalLoss[];
}

function channelMap(channels: readonly MaterializedMusicalChannel[]): Map<number, readonly NoteRecord[]> {
  const byChannel = new Map(channels.map((channel) => [channel.channel, channel.notes]));
  if (byChannel.size !== channels.length || channels.some((entry) =>
    !Number.isInteger(entry.channel) || entry.channel < 0 || entry.channel > 15)) {
    throw new MusicalPatchError('musical preflight channels must be unique MIDI channels in 0-15');
  }
  return byChannel;
}

function completeChannelMap(channels: readonly MaterializedMusicalChannel[]): Map<number, readonly NoteRecord[]> {
  const byChannel = channelMap(channels);
  if (byChannel.size !== 16
      || Array.from({ length: 16 }, (_, channel) => channel).some((channel) => !byChannel.has(channel))) {
    throw new MusicalPatchError(
      'musical compilation needs one preflight value for every MIDI channel 0-15',
    );
  }
  return byChannel;
}

interface NormalizedNote {
  note: NoteRecord;
  readonly source: 'existing' | 'target';
  changed: boolean;
}

function normalizeNotes(
  target: MaterializedMusicalTarget,
  existing: readonly NoteRecord[],
): { notes: readonly NormalizedNote[]; loss: readonly MusicalLoss[] } {
  const notes: NormalizedNote[] = [
    ...existing.map((note) => ({ note, source: 'existing' as const, changed: false })),
    ...target.notes.map((note) => ({ note, source: 'target' as const, changed: false })),
  ].sort((left, right) =>
    left.note.pitch - right.note.pitch || left.note.startBeats - right.note.startBeats);
  const identities = new Set<string>();
  for (const entry of notes) {
    const identity = `${target.channel}:${entry.note.pitch}:${entry.note.startBeats}`;
    if (identities.has(identity)) {
      throw new MusicalPatchError(
        `duplicate note identity refused on channel ${target.channel}: pitch ${entry.note.pitch} `
          + `at beat ${entry.note.startBeats}`,
        [`target ${target.targetIndex}, variation ${target.variationIndex}, operation `
          + `${target.operationIndex}: duplicate note identity ${identity}`],
      );
    }
    identities.add(identity);
  }

  const loss: MusicalLoss[] = [];
  for (let index = 1; index < notes.length; index += 1) {
    const previous = notes[index - 1]!;
    const next = notes[index]!;
    if (previous.note.pitch !== next.note.pitch) continue;
    const durationBeats = next.note.startBeats - previous.note.startBeats;
    if (previous.note.durationBeats <= durationBeats) continue;
    const before = previous.note;
    const after = { ...before, durationBeats };
    previous.note = after;
    previous.changed = true;
    loss.push({
      code: 'note-shortened',
      targetIndex: target.targetIndex,
      variationIndex: target.variationIndex,
      operationIndex: target.operationIndex,
      before,
      after,
      message: `shortened channel ${target.channel}, pitch ${before.pitch} at beat `
        + `${before.startBeats} to end at the next same-pitch note`,
    });
  }
  return {
    notes: notes.sort((left, right) =>
      left.note.startBeats - right.note.startBeats || left.note.pitch - right.note.pitch),
    loss,
  };
}

/**
 * Compile all materialized work for one clip to the current write union.
 *
 * Bitwig's available clear call clears every channel. A channel-scoped replace
 * is therefore compiled as one clear followed by a complete reconstruction of
 * all non-empty channels. The required 16-channel preflight prevents an absent
 * channel from being treated as empty. Merge also reads the addressed channel,
 * refuses duplicate identities, and reports same-pitch overlap shortening.
 *
 * Every emitted `note.write` contains `channel`, even though the Phase 1
 * low-level write still accepts an absent channel as channel 0. `note.clear`
 * is structurally clip-wide and has no channel field.
 */
export function compileMusicalClip(
  clip: ClipAddress,
  targets: readonly MaterializedMusicalTarget[],
  preflight: MaterializedMusicalPreflight,
): MusicalCompilation {
  if (!Number.isSafeInteger(preflight.revision) || preflight.revision < 0) {
    throw new MusicalPatchError('musical preflight revision must be a non-negative safe integer');
  }
  const targetChannels = new Set<number>();
  for (const target of targets) {
    if (!Number.isInteger(target.channel) || target.channel < 0 || target.channel > 15) {
      throw new MusicalPatchError(`materialized MIDI channel must be in 0-15, received ${target.channel}`);
    }
    if (targetChannels.has(target.channel)) {
      throw new MusicalPatchError(`materialized MIDI channel ${target.channel} occurs more than once`);
    }
    targetChannels.add(target.channel);
  }

  const existing = channelMap(preflight.channels);
  for (const target of targets) {
    if (target.write === 'merge' && !existing.has(target.channel)) {
      throw new MusicalPatchError(
        `musical merge needs a preflight value for MIDI channel ${target.channel}`,
      );
    }
  }

  const loss: MusicalLoss[] = [];
  const replacements = targets.filter((target) => target.write === 'replace');
  if (replacements.length === 0) {
    const ops = targets.flatMap((target): Op[] => {
      const normalized = normalizeNotes(target, existing.get(target.channel)!);
      loss.push(...normalized.loss);
      const notes = normalized.notes
        .filter((entry) => entry.source === 'target' || entry.changed)
        .map((entry) => entry.note);
      return notes.length === 0 ? [] : [{
        op: 'note.write', clip, channel: target.channel, notes,
      }];
    });
    return { ops, ifRevision: preflight.revision, loss };
  }

  const final = completeChannelMap(preflight.channels);
  for (const target of targets) {
    const normalized = normalizeNotes(
      target,
      target.write === 'replace' ? [] : final.get(target.channel)!,
    );
    loss.push(...normalized.loss);
    final.set(target.channel, normalized.notes.map((entry) => entry.note));
  }

  const ops: Op[] = [{ op: 'note.clear', clip }];
  for (let channel = 0; channel < 16; channel += 1) {
    const notes = final.get(channel)!;
    if (notes.length > 0) ops.push({ op: 'note.write', clip, channel, notes });
  }
  return { ops, ifRevision: preflight.revision, loss };
}

export const STOCHASTIC_OPERATIONS: ReadonlySet<MusicalOperationKind> = new Set([
  'humanize', 'thin', 'densify',
]);

/**
 * Derive an implementation-independent random scope.
 *
 * A random draw hashes this scope plus its zero-based draw index. It reads the
 * first 53 hash bits as an unsigned integer and divides by 2^53. This gives the
 * same value on every JavaScript runtime without hidden generator state.
 */
export function musicalSeedScope(
  seed: string,
  targetIndex: number,
  variationIndex: number,
  operationIndex: number,
): string {
  return createHash('sha256')
    .update(`${seed}\0${targetIndex}\0${variationIndex}\0${operationIndex}`, 'utf8')
    .digest('hex');
}

/** Return one stable random value in the half-open range [0, 1). */
export function musicalRandom(seedScope: string, drawIndex: number): number {
  if (!Number.isSafeInteger(drawIndex) || drawIndex < 0) {
    throw new MusicalPatchError('random draw index must be a non-negative safe integer');
  }
  const hex = createHash('sha256')
    .update(`${seedScope}\0${drawIndex}`, 'utf8')
    .digest('hex');
  const first53Bits = BigInt(`0x${hex.slice(0, 14)}`) >> 3n;
  return Number(first53Bits) / 2 ** 53;
}

export const MUSICAL_PATCH_POLICY = {
  units: 'beats',
  merge:
    'Keep existing notes and add output notes. Refuse an identical channel, pitch, and start identity.',
  replace:
    'Replace the addressed MIDI channel. Preflight all 16 channels, clear the clip once, and reconstruct every preserved channel.',
  collision:
    'Refuse identical identities. Shorten an earlier overlapping same-pitch note at the later start and report it.',
  midiRange:
    'Refuse pitches outside 0-127. Never clamp, fold, or wrap them.',
  pressure:
    'Refuse pressure before materialization because the host does not persist it.',
  protection:
    'Use direct stash-backed writes unless variations are requested or the fidelity floor requires a clip block.',
  quantize:
    'Snap to the nearest grid line, with a tie moving later. Strength linearly interpolates from the input to the snapped position.',
  humanize:
    'Draw timing and velocity offsets per selected note. Snap timing to the finest exact host grid, round velocity to a host integer, and clip both fields to their ranges.',
  thin:
    'Treat probability as the removal chance for each selected note. Thin requires replace mode because merge cannot remove source notes.',
  densify:
    'At each empty grid line between selected onset groups, copy the preceding group and treat probability as each copied note\'s addition chance.',
} as const;

export type MusicalLossCode =
  | 'timing-moved'
  | 'velocity-changed'
  | 'note-shortened'
  | 'note-added'
  | 'note-removed'
  | 'octave-displaced'
  | 'duplicate-refused'
  | 'pitch-range-refused'
  | 'grid-refused';

export interface MusicalLoss {
  readonly code: MusicalLossCode;
  readonly targetIndex: number;
  readonly variationIndex: number;
  readonly operationIndex: number;
  readonly before?: NoteRecord;
  readonly after?: NoteRecord;
  readonly requestedStartBeats?: number;
  readonly realizedStartBeats?: number;
  readonly message: string;
}

export interface MusicalOperationSemantics {
  readonly input: string;
  readonly output: string;
  readonly changedFields: readonly string[];
  readonly preservedFields: readonly string[];
  readonly ordering: string;
  readonly possibleLoss: readonly MusicalLossCode[];
}

const PRESERVE_EXPRESSION = [
  'channel', 'velocity', 'durationBeats', 'all writable expression not named as changed',
] as const;

/** The field ownership and loss contract for every operation. */
export const MUSICAL_OPERATION_SEMANTICS: Readonly<Record<
  MusicalOperationKind,
  MusicalOperationSemantics
>> = {
  generate: {
    input: 'complete literal notes, or a theory source with beat placement, velocity, and optional writable expression',
    output: 'new canonical notes on the target channel',
    changedFields: ['all output fields'],
    preservedFields: [],
    ordering: 'materialize first; later operations consume its canonical output',
    possibleLoss: ['pitch-range-refused', 'grid-refused', 'duplicate-refused'],
  },
  transpose: {
    input: 'selected input notes and an integer semitone offset',
    output: 'the same notes with changed pitches',
    changedFields: ['pitch'], preservedFields: PRESERVE_EXPRESSION,
    ordering: 'consume the previous operation output',
    possibleLoss: ['pitch-range-refused', 'duplicate-refused'],
  },
  harmonize: {
    input: 'selected input notes and an interval, chord, scale, or detected harmony',
    output: 'input notes plus deterministic harmony notes',
    changedFields: ['adds notes'], preservedFields: ['all input note fields'],
    ordering: 'consume the previous operation output',
    possibleLoss: ['note-added', 'pitch-range-refused', 'duplicate-refused'],
  },
  arpeggiate: {
    input: 'selected input notes, order, step, and duration',
    output: 'selected pitches distributed over ordered beat positions',
    changedFields: ['startBeats', 'durationBeats'],
    preservedFields: ['channel', 'pitch', 'velocity', 'all writable expression'],
    ordering: 'consume the previous operation output',
    possibleLoss: ['timing-moved', 'note-shortened', 'duplicate-refused', 'grid-refused'],
  },
  revoice: {
    input: 'selected input notes, pitch range, and voicing strategy',
    output: 'the same notes displaced by octaves into the range',
    changedFields: ['pitch'], preservedFields: PRESERVE_EXPRESSION,
    ordering: 'consume the previous operation output',
    possibleLoss: ['octave-displaced', 'pitch-range-refused', 'duplicate-refused'],
  },
  quantize: {
    input: 'selected input notes, beat grid, and strength',
    output: 'the same notes with realized start positions',
    changedFields: ['startBeats'], preservedFields: PRESERVE_EXPRESSION,
    ordering: 'consume the previous operation output',
    possibleLoss: ['timing-moved', 'note-shortened', 'duplicate-refused', 'grid-refused'],
  },
  humanize: {
    input: 'selected input notes, bounded timing and velocity ranges, and derived seed scope',
    output: 'the same notes with deterministic timing and velocity offsets',
    changedFields: ['startBeats', 'velocity'],
    preservedFields: ['channel', 'pitch', 'durationBeats', 'all writable expression'],
    ordering: 'consume the previous operation output',
    possibleLoss: ['timing-moved', 'velocity-changed', 'note-shortened', 'duplicate-refused', 'grid-refused'],
  },
  thin: {
    input: 'selected input notes, probability, and derived seed scope',
    output: 'a deterministic subset of the input notes',
    changedFields: ['removes notes'], preservedFields: ['every field on retained notes'],
    ordering: 'consume the previous operation output',
    possibleLoss: ['note-removed'],
  },
  densify: {
    input: 'selected input notes, beat grid, probability, and derived seed scope',
    output: 'input notes plus deterministic derived notes',
    changedFields: ['adds notes'], preservedFields: ['every field on input notes'],
    ordering: 'consume the previous operation output',
    possibleLoss: ['note-added', 'note-shortened', 'duplicate-refused', 'grid-refused'],
  },
};

export interface MusicalContractReport {
  readonly schema: 'ghostnote-musical-report';
  readonly version: 1;
  readonly protection: MusicalPatch['protection'];
  readonly targets: readonly {
    readonly clip: MusicalTarget['clip'];
    readonly channel: number;
    readonly write: MusicalTarget['write'];
    readonly operations: readonly (MusicalOperationSemantics & {
      readonly op: MusicalOperationKind;
      readonly index: number;
      readonly seedScopes: readonly string[];
    })[];
  }[];
}

/** Describe ownership, order, possible loss, and deterministic seed scopes. */
export function describeMusicalPatch(patch: MusicalPatch): MusicalContractReport {
  const takes = musicalOutputCount(patch);
  return {
    schema: 'ghostnote-musical-report',
    version: 1,
    protection: patch.protection,
    targets: patch.targets.map((target, targetIndex) => ({
      clip: target.clip,
      channel: target.channel,
      write: target.write,
      operations: target.operations.map((operation, operationIndex) => ({
        op: operation.op,
        index: operationIndex,
        ...MUSICAL_OPERATION_SEMANTICS[operation.op],
        seedScopes: STOCHASTIC_OPERATIONS.has(operation.op)
          ? Array.from({ length: takes }, (_, variationIndex) =>
            musicalSeedScope(patch.seed!, targetIndex, variationIndex, operationIndex))
          : [],
      })),
    })),
  };
}

export const encodeMusicalReport = (report: MusicalContractReport): string =>
  JSON.stringify(canonicalValue(report));
