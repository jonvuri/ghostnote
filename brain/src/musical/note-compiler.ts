/** Compile guarded agent note proposals against complete exact note state. */
import { createHash } from 'node:crypto';

import { z } from 'zod';

import {
  NOTE_PROP_FIDELITY, addressKey, assertOpsWritable, chooseStepSize,
  clipMetadata, notes as notesAt, track,
  type ClipAddress, type NoteRecord, type Op, type RevisionMark, type Snapshot,
} from '../contract/index.js';
import { revertOps, takeAppliedAnything } from '../engine/index.js';
import type { Disagreement, Unverified } from '../engine/index.js';
import type { StashedChangeset } from '../stash/index.js';
import type { Workspace } from '../surface/workspace.js';
import {
  WORKSTATION_RESPONSE_SCHEMA,
  type WorkstationModule,
} from '../workstation/module-registry.js';
import {
  EXACT_NOTE_SOURCE_DOMAIN, EXACT_NOTE_SOURCE_MAX_NOTES, EXACT_NOTE_SOURCE_SCHEMA,
  snapshotToExactSource, validateExactNoteSource,
  type ExactNoteClip, type ExactNoteSource,
} from './exact-note-source.js';

export const NOTE_PROPOSAL_SCHEMA = 'ghostnote-note-patch-v0';
export const NOTE_INVARIANTS_SCHEMA = 'ghostnote-note-invariants-v0';
export const NOTE_CANDIDATE_SCHEMA = 'ghostnote-note-candidate-v0';
export const NOTE_COMPILER_SCHEMA = 'note-compiler-v0';
export const NOTE_COMPILER_MODULE_ID = 'ghostnote-note-compiler';
export const NOTE_COMPILER_MODULE_VERSION = '0';
export const NOTE_COMPILER_MAX_OPERATIONS = 128;
export const NOTE_COMPILER_MAX_INSERTIONS = 2_048;
export const NOTE_COMPILER_PREVIEW_DOMAIN = 'note-compiler-preview-v0';

const rationalText = z.string().min(1);
const noteId = z.string().min(1).max(128);
const trackAlias = z.string().regex(/^t-[1-9][0-9]*$/);
const sha256 = z.string().regex(/^[0-9a-f]{64}$/);
const midiPitch = z.number().int().min(0).max(127);
const midiVelocity = z.number().int().min(1).max(127);

const transposeSchema = z.object({
  op: z.literal('transpose'), note_ids: z.array(noteId).min(1), semitones: z.number().int(),
}).strict();
const deleteSchema = z.object({
  op: z.literal('delete'), note_ids: z.array(noteId).min(1),
}).strict();
const moveSchema = z.object({
  op: z.literal('move'), note_id: noteId, start: rationalText,
}).strict();
const insertedNoteSchema = z.object({
  id: noteId,
  track: trackAlias,
  start: rationalText,
  duration: rationalText,
  pitch: midiPitch,
  velocity: midiVelocity,
}).strict();
const insertSchema = z.object({
  op: z.literal('insert'),
  default_policy: z.literal('track-neutral-v0'),
  notes: z.array(insertedNoteSchema).min(1).max(NOTE_COMPILER_MAX_INSERTIONS),
}).strict();

export const noteProposalSchema = z.object({
  schema: z.literal(NOTE_PROPOSAL_SCHEMA),
  base_sha256: sha256,
  ops: z.array(z.discriminatedUnion('op', [
    transposeSchema, deleteSchema, moveSchema, insertSchema,
  ])).min(1).max(NOTE_COMPILER_MAX_OPERATIONS),
}).strict();

const allowedOperation = z.enum(['transpose', 'delete', 'move', 'insert']);
export const noteProposalInvariantsSchema = z.object({
  schema: z.literal(NOTE_INVARIANTS_SCHEMA),
  preserveUnmentionedFields: z.literal(true),
  samePitchOverlap: z.literal('refuse'),
  allowedOperations: z.array(allowedOperation).min(1),
  allowedTrackAliases: z.array(trackAlias).min(1),
  noteCount: z.object({
    min: z.number().int().nonnegative(), max: z.number().int().nonnegative(),
  }).strict().optional(),
  pitchRange: z.object({ min: midiPitch, max: midiPitch }).strict().optional(),
  beatRange: z.object({
    from: rationalText, to: rationalText, noteEndsWithin: z.literal(true),
  }).strict().optional(),
  requiredEventIds: z.array(noteId).optional(),
}).strict();

export type NoteProposal = z.infer<typeof noteProposalSchema>;
export type NoteProposalOperation = NoteProposal['ops'][number];
export type NoteProposalInvariants = z.infer<typeof noteProposalInvariantsSchema>;

export interface CandidateNote {
  readonly id: string;
  readonly origin: 'source' | 'inserted';
  readonly trackAlias: string;
  readonly channel: number;
  readonly note: NoteRecord;
}

export interface CandidateChannel {
  readonly channel: number;
  readonly notes: readonly CandidateNote[];
}

export interface CandidateClip {
  readonly address: ClipAddress;
  readonly track: ExactNoteClip['track'];
  readonly clip: ExactNoteClip['clip'];
  readonly metadata: ExactNoteClip['metadata'];
  readonly channels: readonly CandidateChannel[];
}

export interface NoteCandidate {
  readonly schema: typeof NOTE_CANDIDATE_SCHEMA;
  readonly baseSourceSha256: string;
  readonly clips: readonly CandidateClip[];
}

export interface NoteCompilerTimingEvent {
  readonly phase: 'source-validation' | 'proposal-validation'
  | 'candidate-compilation' | 'operation-translation';
  readonly elapsedMs: number;
}

export interface NoteCompilerOptions {
  readonly now?: () => number;
  readonly onTiming?: (event: NoteCompilerTimingEvent) => void;
}

export interface NoteApplicationTimingEvent {
  readonly phase: 'supplied-preview-compilation' | 'guard-mark'
  | 'fresh-preflight-acquisition-and-hash' | 'fresh-compilation'
  | 'recorded-workspace-apply' | 'independent-readback-acquisition-and-hash'
  | 'readback-comparison';
  readonly elapsedMs: number;
}

export interface NoteApplicationOptions {
  readonly now?: () => number;
  readonly onTiming?: (event: NoteApplicationTimingEvent) => void;
}

export interface NoteCompilerRequest {
  readonly source: ExactNoteSource;
  readonly proposal: NoteProposal;
  readonly invariants: NoteProposalInvariants;
}

export interface NoteCompilerResult {
  readonly schema: typeof NOTE_COMPILER_SCHEMA;
  readonly source: {
    readonly sha256: string;
    readonly digestDomain: typeof EXACT_NOTE_SOURCE_DOMAIN;
    readonly observedAt: RevisionMark;
  };
  readonly proposal: NoteProposal;
  readonly invariants: NoteProposalInvariants;
  readonly before: ExactNoteSource['clips'];
  readonly candidate: NoteCandidate;
  readonly operations: readonly Op[];
  readonly losses: readonly [];
  readonly guards: {
    readonly sourceSha256: string;
    readonly observedAt: RevisionMark;
    readonly clipAddresses: readonly ClipAddress[];
    readonly changedEventIds: readonly string[];
    readonly insertedEventIds: readonly string[];
  };
  readonly insertionDefaults: {
    readonly policy: 'track-neutral-v0';
    readonly candidateNormalization: 'explicit-host-normalized';
    readonly releaseVelocityMidi: 64;
    readonly releaseVelocityHost: number;
    readonly velocitySpread: 0;
    readonly gain: 1;
    readonly pan: 0;
    readonly pressure: 0;
    readonly timbre: 0;
    readonly transpose: 0;
    readonly chance: 1;
    readonly isChanceEnabled: true;
    readonly isMuted: false;
    readonly isOccurrenceEnabled: true;
    readonly occurrence: 'ALWAYS';
    readonly isRecurrenceEnabled: true;
    readonly recurrence: readonly [1, 1];
    readonly isRepeatEnabled: true;
    readonly repeatCount: 0;
    readonly repeatCurve: 0;
    readonly repeatVelocityCurve: 0;
    readonly repeatVelocityEnd: 0;
    readonly omittedFromOperations: readonly ['pressure'];
    readonly pressureProof: string;
  };
  readonly previewDigest: {
    readonly algorithm: 'sha256';
    readonly domain: typeof NOTE_COMPILER_PREVIEW_DOMAIN;
    readonly value: string;
  };
}

export interface NoteReadbackDiscrepancy {
  readonly clip: ClipAddress;
  readonly channel?: number;
  readonly at?: string;
  readonly field: string;
  readonly expected: unknown;
  readonly observed: unknown;
}

export interface NoteProposalApplicationResult {
  readonly schema: 'note-compiler-application-v0';
  readonly preview: NoteCompilerResult;
  readonly applied: boolean;
  readonly change: {
    readonly id: string;
    readonly seq: number;
    readonly fidelity: StashedChangeset['take']['fidelity'];
    readonly disagreements: readonly Disagreement[];
    readonly unverified: readonly Unverified[];
    readonly concurrent: StashedChangeset['take']['report']['concurrent'];
    readonly undecidable?: string;
  };
  readonly readback?: {
    readonly source: ExactNoteSource;
    readonly complete: true;
    readonly discrepancies: readonly NoteReadbackDiscrepancy[];
  };
  readonly verificationFailure?: string;
  readonly reversal: {
    readonly changeId: string;
    readonly fidelity: StashedChangeset['take']['fidelity'];
    readonly unrestored: ReturnType<typeof revertOps>['unrestored'];
  };
}

export class NoteCompilerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NoteCompilerError';
  }
}

interface MutableCandidateNote {
  id: string;
  origin: 'source' | 'inserted';
  trackAlias: string;
  channel: number;
  note: NoteRecord;
  clip: CandidateClip;
}

interface ChangedTarget {
  readonly clipKey: string;
  readonly kind: NoteProposalOperation['op'];
  readonly eventId: string;
  readonly note?: NoteRecord;
  readonly channel?: number;
}

const HOST_NOTE_DEFAULTS_V0: Readonly<Record<string, unknown>> = {
  releaseVelocity: 100 / 127,
  velocitySpread: 0,
  gain: 0,
  pan: 0,
  pressure: 0,
  timbre: 0,
  transpose: 0,
  chance: 1,
  isChanceEnabled: true,
  isMuted: false,
  isOccurrenceEnabled: true,
  occurrence: 'ALWAYS',
  isRecurrenceEnabled: true,
  recurrence: [1, 1],
  isRepeatEnabled: true,
  repeatCount: 0,
  repeatCurve: 0,
  repeatVelocityCurve: 0,
  repeatVelocityEnd: 0,
};

const TRACK_NEUTRAL_DEFAULTS_V0 = {
  releaseVelocity: 64 / 127,
  velocitySpread: 0,
  gain: 1,
  pan: 0,
  pressure: 0,
  timbre: 0,
  transpose: 0,
  chance: 1,
  isChanceEnabled: true,
  isMuted: false,
  isOccurrenceEnabled: true,
  occurrence: 'ALWAYS',
  isRecurrenceEnabled: true,
  recurrence: [1, 1] as const,
  isRepeatEnabled: true,
  repeatCount: 0,
  repeatCurve: 0,
  repeatVelocityCurve: 0,
  repeatVelocityEnd: 0,
} as const satisfies Partial<NoteRecord>;

const NOTE_FIELDS = [
  'startBeats', 'pitch', 'velocity', 'durationBeats',
  'releaseVelocity', 'velocitySpread', 'gain', 'pan', 'pressure', 'timbre',
  'transpose', 'chance', 'isChanceEnabled', 'isMuted', 'isOccurrenceEnabled',
  'occurrence', 'isRecurrenceEnabled', 'recurrence', 'isRepeatEnabled',
  'repeatCount', 'repeatCurve', 'repeatVelocityCurve', 'repeatVelocityEnd',
] as const;

function fail(message: string): never {
  throw new NoteCompilerError(message);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function gcd(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

/** Parse one canonical reduced rational string without accepting rounded text. */
export function parseNoteRational(value: string, label: string): number {
  const match = /^(0|-?[1-9][0-9]*)(?:\/([1-9][0-9]*))?$/.exec(value);
  if (match === null) return fail(`${label} must be a canonical rational string`);
  const numerator = BigInt(match[1]!);
  const denominator = BigInt(match[2] ?? '1');
  if (gcd(numerator, denominator) !== 1n) return fail(`${label} must be reduced`);
  const numeric = Number(numerator) / Number(denominator);
  if (!Number.isFinite(numeric) || !Number.isSafeInteger(Number(numerator))
      || !Number.isSafeInteger(Number(denominator))) {
    return fail(`${label} is outside the supported rational range`);
  }
  return Object.is(numeric, -0) ? 0 : numeric;
}

function canonicalValue(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('the preview contains a non-finite number');
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => compareText(left, right))
      .map(([key, item]) => [key, canonicalValue(item)]));
  }
  return fail(`the preview contains unsupported ${typeof value} data`);
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalValue(value));
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function candidateClips(source: ExactNoteSource): CandidateClip[] {
  const aliasByTrack = new Map(source.aliases.map((item) => [item.trackId, item.alias]));
  const eventByCell = new Map(source.eventMap.map((event) => [
    `${addressKey(event.clip)}\0${event.channel}\0${event.startBeats}\0${event.pitch}`,
    event.id,
  ]));
  return source.clips.map((clip): CandidateClip => ({
    address: clone(clip.address),
    track: clone(clip.track),
    clip: clone(clip.clip),
    metadata: clone(clip.metadata),
    channels: clip.channels.map((channel): CandidateChannel => ({
      channel: channel.channel,
      notes: channel.notes.map((note): CandidateNote => {
        const id = eventByCell.get(
          `${addressKey(clip.address)}\0${channel.channel}\0${note.startBeats}\0${note.pitch}`,
        );
        const alias = aliasByTrack.get(clip.track.channelId);
        if (id === undefined || alias === undefined) fail('the exact source maps are incomplete');
        return {
          id, origin: 'source', trackAlias: alias,
          channel: channel.channel, note: clone(note),
        };
      }),
    })),
  }));
}

function mutableNotes(clips: readonly CandidateClip[]): MutableCandidateNote[] {
  return clips.flatMap((clip) => clip.channels.flatMap((channel) => channel.notes.map((item) => ({
    id: item.id,
    origin: item.origin,
    trackAlias: item.trackAlias,
    channel: item.channel,
    note: clone(item.note),
    clip,
  }))));
}

function uniqueStrings(values: readonly string[], label: string): void {
  if (new Set(values).size !== values.length) fail(`${label} must not contain duplicates`);
}

function assertInvariantsShape(invariants: NoteProposalInvariants): void {
  uniqueStrings(invariants.allowedOperations, 'allowedOperations');
  uniqueStrings(invariants.allowedTrackAliases, 'allowedTrackAliases');
  uniqueStrings(invariants.requiredEventIds ?? [], 'requiredEventIds');
  if (invariants.noteCount !== undefined && invariants.noteCount.max < invariants.noteCount.min) {
    fail('the note-count maximum must be at least the minimum');
  }
  if (invariants.pitchRange !== undefined && invariants.pitchRange.max < invariants.pitchRange.min) {
    fail('the pitch-range maximum must be at least the minimum');
  }
  if (invariants.beatRange !== undefined) {
    const from = parseNoteRational(invariants.beatRange.from, 'invariants.beatRange.from');
    const to = parseNoteRational(invariants.beatRange.to, 'invariants.beatRange.to');
    if (from < 0 || to <= from) fail('the invariant beat range is invalid');
  }
}

function findAliasClip(
  clips: readonly CandidateClip[], alias: string,
): CandidateClip {
  const matches = clips.filter((clip) => clip.channels.some((channel) =>
    channel.notes.some((note) => note.trackAlias === alias)));
  if (matches.length === 0) {
    // An empty track has no channel authority and cannot accept track-neutral-v0.
    fail(`track alias ${alias} has no source note from which to infer a channel`);
  }
  if (matches.length !== 1) fail(`track alias ${alias} names more than one addressed clip`);
  return matches[0]!;
}

function uniqueAliasChannel(clip: CandidateClip, alias: string): number {
  const channels = new Set(clip.channels.flatMap((channel) =>
    channel.notes.some((note) => note.trackAlias === alias) ? [channel.channel] : []));
  if (channels.size !== 1) fail(`track-neutral-v0 needs one unique source channel for ${alias}`);
  return [...channels][0]!;
}

function assertAllowed(
  operation: NoteProposalOperation,
  alias: string,
  invariants: NoteProposalInvariants,
): void {
  if (!invariants.allowedOperations.includes(operation.op)) {
    fail(`operation ${operation.op} is outside the declared invariant set`);
  }
  if (!invariants.allowedTrackAliases.includes(alias)) {
    fail(`track alias ${alias} is outside the declared invariant set`);
  }
}

function assertCandidate(
  clips: readonly CandidateClip[],
  invariants: NoteProposalInvariants,
  changedEventIds: ReadonlySet<string>,
): void {
  const notes = clips.flatMap((clip) => clip.channels.flatMap((channel) =>
    channel.notes.map((item) => ({ clip, channel: channel.channel, item }))));
  if (invariants.noteCount !== undefined
      && (notes.length < invariants.noteCount.min || notes.length > invariants.noteCount.max)) {
    fail(`candidate note count ${notes.length} violates the declared range`);
  }
  const byId = new Set(notes.map(({ item }) => item.id));
  for (const id of invariants.requiredEventIds ?? []) {
    if (!byId.has(id)) fail(`required event ${id} is absent from the candidate`);
  }
  const beatFrom = invariants.beatRange === undefined
    ? undefined : parseNoteRational(invariants.beatRange.from, 'invariants.beatRange.from');
  const beatTo = invariants.beatRange === undefined
    ? undefined : parseNoteRational(invariants.beatRange.to, 'invariants.beatRange.to');

  for (const { clip, channel, item } of notes) {
    const { note } = item;
    if (!Number.isInteger(channel) || channel < 0 || channel > 15) {
      fail(`candidate event ${item.id} has an impossible MIDI channel`);
    }
    if (!Number.isInteger(note.pitch) || note.pitch < 0 || note.pitch > 127) {
      fail(`candidate event ${item.id} has a pitch outside MIDI 0-127`);
    }
    if (invariants.pitchRange !== undefined
        && (note.pitch < invariants.pitchRange.min || note.pitch > invariants.pitchRange.max)) {
      fail(`candidate event ${item.id} violates the declared pitch range`);
    }
    if (!Number.isInteger(note.velocity) || note.velocity < 0 || note.velocity > 127) {
      fail(`candidate event ${item.id} has an invalid velocity`);
    }
    if (!Number.isFinite(note.startBeats) || note.startBeats < 0
        || !Number.isFinite(note.durationBeats) || note.durationBeats <= 0) {
      fail(`candidate event ${item.id} has an invalid beat range`);
    }
    const end = note.startBeats + note.durationBeats;
    if (end > clip.metadata.lengthBeats
        && (item.origin === 'inserted' || changedEventIds.has(item.id))) {
      fail(`candidate event ${item.id} ends beyond its clip`);
    }
    if (beatFrom !== undefined && beatTo !== undefined
        && (note.startBeats < beatFrom || note.startBeats >= beatTo || end > beatTo)) {
      fail(`candidate event ${item.id} violates the declared beat range`);
    }
  }

  for (const clip of clips) {
    for (const channel of clip.channels) {
      const byPitch = new Map<number, CandidateNote[]>();
      for (const item of channel.notes) {
        const group = byPitch.get(item.note.pitch) ?? [];
        group.push(item);
        byPitch.set(item.note.pitch, group);
      }
      for (const [pitch, group] of byPitch) {
        const ordered = [...group].sort((left, right) =>
          left.note.startBeats - right.note.startBeats || compareText(left.id, right.id));
        for (let index = 1; index < ordered.length; index += 1) {
          const prior = ordered[index - 1]!;
          const next = ordered[index]!;
          if (prior.note.startBeats === next.note.startBeats) {
            fail(`candidate events ${prior.id} and ${next.id} have a duplicate note cell`);
          }
          if (prior.note.startBeats + prior.note.durationBeats > next.note.startBeats) {
            fail(`candidate events ${prior.id} and ${next.id} have a same-pitch overlap on channel ${channel.channel}, pitch ${pitch}`);
          }
        }
      }
    }
  }
}

function rebuildCandidate(
  base: readonly CandidateClip[],
  notes: readonly MutableCandidateNote[],
  sourceSha256: string,
): NoteCandidate {
  const active = new Set(notes);
  const clips = base.map((clip): CandidateClip => ({
    address: clone(clip.address),
    track: clone(clip.track),
    clip: clone(clip.clip),
    metadata: clone(clip.metadata),
    channels: clip.channels.map((channel): CandidateChannel => ({
      channel: channel.channel,
      notes: notes.filter((item) => active.has(item)
        && addressKey(item.clip.address) === addressKey(clip.address)
        && item.channel === channel.channel)
        .map((item): CandidateNote => ({
          id: item.id,
          origin: item.origin,
          trackAlias: item.trackAlias,
          channel: item.channel,
          note: clone(item.note),
        }))
        .sort((left, right) => left.note.startBeats - right.note.startBeats
          || left.note.pitch - right.note.pitch || compareText(left.id, right.id)),
    })),
  }));
  return { schema: NOTE_CANDIDATE_SCHEMA, baseSourceSha256: sourceSha256, clips };
}

function candidateToOps(
  candidate: NoteCandidate,
  changes: readonly ChangedTarget[],
): readonly Op[] {
  const ops: Op[] = [];
  const byClip = new Map<string, ChangedTarget[]>();
  for (const change of changes) {
    const group = byClip.get(change.clipKey) ?? [];
    group.push(change);
    byClip.set(change.clipKey, group);
  }
  for (const [clipKey, clipChanges] of byClip) {
    const clip = candidate.clips.find((item) => addressKey(item.address) === clipKey);
    if (clip === undefined) fail(`changed clip ${clipKey} is absent from the candidate`);
    const reconstruct = clipChanges.some((item) => item.kind !== 'insert');
    if (reconstruct) {
      ops.push({ op: 'note.clear', clip: clip.address });
      for (const channel of clip.channels) {
        const notes = channel.notes.map((item) => item.origin === 'inserted'
          ? insertedNoteForOperation(item.note)
          : item.note);
        if (notes.length > 0) ops.push({
          op: 'note.write', clip: clip.address, channel: channel.channel, notes,
        });
      }
      continue;
    }
    const insertedByChannel = new Map<number, NoteRecord[]>();
    for (const change of clipChanges) {
      if (change.note === undefined || change.channel === undefined) {
        fail('an insertion translation is incomplete');
      }
      const notes = insertedByChannel.get(change.channel) ?? [];
      notes.push(insertedNoteForOperation(change.note));
      insertedByChannel.set(change.channel, notes);
    }
    for (const [channel, notes] of [...insertedByChannel].sort(([left], [right]) => left - right)) {
      ops.push({ op: 'note.write', clip: clip.address, channel, notes });
    }
  }
  assertOpsWritable(ops);
  for (const op of ops) {
    if (op.op === 'note.write') chooseStepSize(op.notes);
  }
  return ops;
}

function insertedNoteForOperation(note: NoteRecord): NoteRecord {
  const { pressure, ...writable } = note;
  if (pressure !== 0) fail('track-neutral-v0 pressure must remain neutral');
  return writable;
}

function previewDigest(result: Omit<NoteCompilerResult, 'previewDigest'>): string {
  return createHash('sha256').update(canonicalJson(result), 'utf8').digest('hex');
}

/** Compile the full operation sequence and refuse all implicit loss. */
export function compileNoteProposal(
  request: NoteCompilerRequest,
  options: NoteCompilerOptions = {},
): NoteCompilerResult {
  const now = options.now ?? (() => performance.now());
  let started = now();
  validateExactNoteSource(request.source);
  options.onTiming?.({ phase: 'source-validation', elapsedMs: now() - started });
  started = now();
  const proposal = noteProposalSchema.parse(request.proposal);
  const invariants = noteProposalInvariantsSchema.parse(request.invariants);
  assertInvariantsShape(invariants);
  if (proposal.base_sha256 !== request.source.digest.value) {
    fail('the proposal base_sha256 does not match the exact source');
  }
  options.onTiming?.({ phase: 'proposal-validation', elapsedMs: now() - started });
  started = now();

  const baseClips = candidateClips(request.source);
  let notes = mutableNotes(baseClips);
  const sourceIds = new Set(notes.map((item) => item.id));
  const insertedIds = new Set<string>();
  const targetedIds = new Set<string>();
  const changed: ChangedTarget[] = [];

  const targetExisting = (id: string, operation: NoteProposalOperation): MutableCandidateNote => {
    if (targetedIds.has(id)) fail(`event ${id} is targeted by more than one operation`);
    targetedIds.add(id);
    const item = notes.find((candidate) => candidate.id === id && candidate.origin === 'source');
    if (item === undefined) fail(`operation ${operation.op} names unknown or deleted event ${id}`);
    assertAllowed(operation, item.trackAlias, invariants);
    return item;
  };

  for (const [operationIndex, operation] of proposal.ops.entries()) {
    if (operation.op === 'transpose' || operation.op === 'delete') {
      uniqueStrings(operation.note_ids, `ops.${operationIndex}.note_ids`);
      for (const id of operation.note_ids) {
        const item = targetExisting(id, operation);
        changed.push({ clipKey: addressKey(item.clip.address), kind: operation.op, eventId: id });
        if (operation.op === 'delete') {
          notes = notes.filter((candidate) => candidate !== item);
          continue;
        }
        item.note = { ...item.note, pitch: item.note.pitch + operation.semitones };
      }
      continue;
    }
    if (operation.op === 'move') {
      const item = targetExisting(operation.note_id, operation);
      const startBeats = parseNoteRational(operation.start, `ops.${operationIndex}.start`);
      if (startBeats < 0) fail(`ops.${operationIndex}.start must not be negative`);
      item.note = { ...item.note, startBeats };
      changed.push({
        clipKey: addressKey(item.clip.address), kind: operation.op, eventId: operation.note_id,
      });
      continue;
    }

    for (const [noteIndex, inserted] of operation.notes.entries()) {
      if (sourceIds.has(inserted.id) || insertedIds.has(inserted.id)) {
        fail(`inserted event ID ${inserted.id} is already in use`);
      }
      insertedIds.add(inserted.id);
      assertAllowed(operation, inserted.track, invariants);
      const clip = findAliasClip(baseClips, inserted.track);
      const channel = uniqueAliasChannel(clip, inserted.track);
      const startBeats = parseNoteRational(
        inserted.start, `ops.${operationIndex}.notes.${noteIndex}.start`,
      );
      const durationBeats = parseNoteRational(
        inserted.duration, `ops.${operationIndex}.notes.${noteIndex}.duration`,
      );
      if (startBeats < 0 || durationBeats <= 0) {
        fail(`inserted event ${inserted.id} has an invalid beat range`);
      }
      const note: NoteRecord = {
        startBeats,
        pitch: inserted.pitch,
        velocity: inserted.velocity,
        durationBeats,
        ...TRACK_NEUTRAL_DEFAULTS_V0,
      };
      notes.push({
        id: inserted.id, origin: 'inserted', trackAlias: inserted.track,
        channel, note, clip,
      });
      changed.push({
        clipKey: addressKey(clip.address), kind: 'insert', eventId: inserted.id,
        note, channel,
      });
    }
  }

  if (notes.length > EXACT_NOTE_SOURCE_MAX_NOTES) {
    fail(
      `candidate note count ${notes.length} exceeds the exact source limit of `
      + EXACT_NOTE_SOURCE_MAX_NOTES,
    );
  }
  const candidate = rebuildCandidate(baseClips, notes, request.source.digest.value);
  assertCandidate(candidate.clips, invariants, new Set([
    ...targetedIds, ...insertedIds,
  ]));
  options.onTiming?.({ phase: 'candidate-compilation', elapsedMs: now() - started });
  started = now();
  const operations = candidateToOps(candidate, changed);
  options.onTiming?.({ phase: 'operation-translation', elapsedMs: now() - started });
  const baseResult: Omit<NoteCompilerResult, 'previewDigest'> = {
    schema: NOTE_COMPILER_SCHEMA,
    source: {
      sha256: request.source.digest.value,
      digestDomain: EXACT_NOTE_SOURCE_DOMAIN,
      observedAt: clone(request.source.observedAt),
    },
    proposal,
    invariants,
    before: clone(request.source.clips),
    candidate,
    operations,
    losses: [],
    guards: {
      sourceSha256: request.source.digest.value,
      observedAt: clone(request.source.observedAt),
      clipAddresses: [...new Map(changed.map((item) => {
        const clip = candidate.clips.find((value) => addressKey(value.address) === item.clipKey)!;
        return [item.clipKey, clip.address] as const;
      })).values()],
      changedEventIds: [...targetedIds].sort(compareText),
      insertedEventIds: [...insertedIds].sort(compareText),
    },
    insertionDefaults: {
      policy: 'track-neutral-v0',
      candidateNormalization: 'explicit-host-normalized',
      releaseVelocityMidi: 64,
      releaseVelocityHost: TRACK_NEUTRAL_DEFAULTS_V0.releaseVelocity,
      velocitySpread: TRACK_NEUTRAL_DEFAULTS_V0.velocitySpread,
      gain: TRACK_NEUTRAL_DEFAULTS_V0.gain,
      pan: TRACK_NEUTRAL_DEFAULTS_V0.pan,
      pressure: TRACK_NEUTRAL_DEFAULTS_V0.pressure,
      timbre: TRACK_NEUTRAL_DEFAULTS_V0.timbre,
      transpose: TRACK_NEUTRAL_DEFAULTS_V0.transpose,
      chance: TRACK_NEUTRAL_DEFAULTS_V0.chance,
      isChanceEnabled: TRACK_NEUTRAL_DEFAULTS_V0.isChanceEnabled,
      isMuted: TRACK_NEUTRAL_DEFAULTS_V0.isMuted,
      isOccurrenceEnabled: TRACK_NEUTRAL_DEFAULTS_V0.isOccurrenceEnabled,
      occurrence: TRACK_NEUTRAL_DEFAULTS_V0.occurrence,
      isRecurrenceEnabled: TRACK_NEUTRAL_DEFAULTS_V0.isRecurrenceEnabled,
      recurrence: TRACK_NEUTRAL_DEFAULTS_V0.recurrence,
      isRepeatEnabled: TRACK_NEUTRAL_DEFAULTS_V0.isRepeatEnabled,
      repeatCount: TRACK_NEUTRAL_DEFAULTS_V0.repeatCount,
      repeatCurve: TRACK_NEUTRAL_DEFAULTS_V0.repeatCurve,
      repeatVelocityCurve: TRACK_NEUTRAL_DEFAULTS_V0.repeatVelocityCurve,
      repeatVelocityEnd: TRACK_NEUTRAL_DEFAULTS_V0.repeatVelocityEnd,
      omittedFromOperations: ['pressure'],
      pressureProof: NOTE_PROP_FIDELITY.pressure === 'unwritable'
        ? 'candidate pressure 0 is omitted from operations; complete readback compares host 0'
        : fail('the pressure capability changed; revise track-neutral-v0 before use'),
    },
  };
  return {
    ...baseResult,
    previewDigest: {
      algorithm: 'sha256', domain: NOTE_COMPILER_PREVIEW_DOMAIN,
      value: previewDigest(baseResult),
    },
  };
}

function noteField(note: NoteRecord, field: string): unknown {
  const value = (note as unknown as Record<string, unknown>)[field];
  return value === undefined ? HOST_NOTE_DEFAULTS_V0[field] : value;
}

function equalHostValue(left: unknown, right: unknown): boolean {
  if (typeof left === 'number' && typeof right === 'number') return Math.abs(left - right) <= 2e-3;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((item, index) =>
      equalHostValue(item, right[index]));
  }
  return left === right;
}

/** Compare a complete independent exact-source read with the planned candidate. */
export function compareCandidateReadback(
  compilation: NoteCompilerResult,
  observed: ExactNoteSource,
): readonly NoteReadbackDiscrepancy[] {
  validateExactNoteSource(observed);
  const discrepancies: NoteReadbackDiscrepancy[] = [];
  for (const expectedClip of compilation.candidate.clips) {
    const observedClip = observed.clips.find((item) =>
      addressKey(item.address) === addressKey(expectedClip.address));
    if (observedClip === undefined) {
      discrepancies.push({
        clip: expectedClip.address, field: 'clip.exists', expected: true, observed: false,
      });
      continue;
    }
    for (const field of ['track', 'clip', 'metadata'] as const) {
      if (canonicalJson(expectedClip[field]) !== canonicalJson(observedClip[field])) {
        discrepancies.push({
          clip: expectedClip.address, field, expected: expectedClip[field], observed: observedClip[field],
        });
      }
    }
    for (const expectedChannel of expectedClip.channels) {
      const observedChannel = observedClip.channels[expectedChannel.channel];
      if (observedChannel === undefined) {
        discrepancies.push({
          clip: expectedClip.address, channel: expectedChannel.channel,
          field: 'channel.exists', expected: true, observed: false,
        });
        continue;
      }
      const remaining = [...observedChannel.notes];
      for (const expectedItem of expectedChannel.notes) {
        const index = remaining.findIndex((item) => item.pitch === expectedItem.note.pitch
          && Math.abs(item.startBeats - expectedItem.note.startBeats) <= 1e-9);
        if (index < 0) {
          discrepancies.push({
            clip: expectedClip.address, channel: expectedChannel.channel,
            at: `${expectedItem.note.pitch}@${expectedItem.note.startBeats}`,
            field: 'note.exists', expected: true, observed: false,
          });
          continue;
        }
        const found = remaining.splice(index, 1)[0]!;
        for (const field of NOTE_FIELDS) {
          const expected = noteField(expectedItem.note, field);
          const actual = noteField(found, field);
          if (equalHostValue(expected, actual)) continue;
          discrepancies.push({
            clip: expectedClip.address, channel: expectedChannel.channel,
            at: `${expectedItem.note.pitch}@${expectedItem.note.startBeats}`,
            field: `note.${field}`, expected, observed: actual,
          });
        }
      }
      for (const extra of remaining) {
        discrepancies.push({
          clip: expectedClip.address, channel: expectedChannel.channel,
          at: `${extra.pitch}@${extra.startBeats}`,
          field: 'note.exists', expected: false, observed: true,
        });
      }
    }
  }
  return discrepancies;
}

function sourceAddresses(source: ExactNoteSource) {
  return source.clips.flatMap((clip) => [
    track(clip.track.channelId),
    clip.address,
    clipMetadata(clip.address),
    ...Array.from({ length: 16 }, (_, channel) => notesAt(clip.address, channel)),
  ]);
}

async function refreshSource(workspace: Workspace, source: ExactNoteSource): Promise<ExactNoteSource> {
  const read = async (): Promise<Snapshot> => workspace.read(sourceAddresses(source));
  const snapshot = workspace.preserveSelection === undefined
    ? await read() : await workspace.preserveSelection(read);
  return snapshotToExactSource({
    snapshot,
    clips: source.clips.map((clip) => clip.address),
    source: source.source,
    expectedGeneration: source.observedAt.generation,
  });
}

/** Apply one accepted preview through the recorded workspace seam. */
export async function applyNoteProposal(
  workspace: Workspace,
  request: NoteCompilerRequest & { readonly acceptedPreviewSha256: string },
  options: NoteApplicationOptions = {},
): Promise<NoteProposalApplicationResult> {
  const now = options.now ?? (() => performance.now());
  let started = now();
  const suppliedPreview = compileNoteProposal(request);
  options.onTiming?.({ phase: 'supplied-preview-compilation', elapsedMs: now() - started });
  if (request.acceptedPreviewSha256 !== suppliedPreview.previewDigest.value) {
    fail('the accepted preview digest does not match the supplied plan');
  }
  started = now();
  const marked = await workspace.mark();
  options.onTiming?.({ phase: 'guard-mark', elapsedMs: now() - started });
  if (canonicalJson(marked) !== canonicalJson(request.source.observedAt)) {
    fail('the live target guards changed after preview; refresh and preview again');
  }
  started = now();
  const fresh = await refreshSource(workspace, request.source);
  options.onTiming?.({
    phase: 'fresh-preflight-acquisition-and-hash', elapsedMs: now() - started,
  });
  if (fresh.digest.value !== request.source.digest.value) {
    fail('the complete live source changed after preview; refresh and preview again');
  }
  started = now();
  const preview = compileNoteProposal({ ...request, source: fresh });
  options.onTiming?.({ phase: 'fresh-compilation', elapsedMs: now() - started });
  if (preview.previewDigest.value !== request.acceptedPreviewSha256) {
    fail('fresh preflight produced a different plan; preview again');
  }

  started = now();
  const change = await workspace.apply(preview.operations, {
    ifRevision: fresh.observedAt.revision,
  });
  options.onTiming?.({ phase: 'recorded-workspace-apply', elapsedMs: now() - started });
  const applied = takeAppliedAnything(change.take);
  const reversal = applied
    ? { fidelity: change.take.fidelity, ...revertOps(change.take) }
    : { fidelity: change.take.fidelity, unrestored: [] };
  const base = {
    schema: 'note-compiler-application-v0' as const,
    preview,
    applied,
    change: {
      id: change.take.id,
      seq: change.seq,
      fidelity: change.take.fidelity,
      disagreements: change.take.report.disagreements,
      unverified: change.take.report.unverified,
      concurrent: change.take.report.concurrent,
      ...(change.take.report.undecidable === undefined
        ? {} : { undecidable: change.take.report.undecidable }),
    },
    reversal: {
      changeId: change.take.id,
      fidelity: reversal.fidelity,
      unrestored: reversal.unrestored,
    },
  };
  try {
    started = now();
    const observed = await refreshSource(workspace, fresh);
    options.onTiming?.({
      phase: 'independent-readback-acquisition-and-hash', elapsedMs: now() - started,
    });
    started = now();
    const discrepancies = applied ? compareCandidateReadback(preview, observed) : [];
    options.onTiming?.({ phase: 'readback-comparison', elapsedMs: now() - started });
    return {
      ...base,
      readback: {
        source: observed,
        complete: true,
        discrepancies,
      },
    };
  } catch (error) {
    return {
      ...base,
      verificationFailure: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Create the pure compiler module. Bitwig starts only for a later apply call. */
export function noteCompilerModule(
  options: NoteCompilerOptions = {},
): WorkstationModule<NoteCompilerRequest, NoteCompilerResult> {
  return {
    descriptor: {
      moduleId: NOTE_COMPILER_MODULE_ID,
      version: NOTE_COMPILER_MODULE_VERSION,
      acceptedSchemas: [NOTE_PROPOSAL_SCHEMA, EXACT_NOTE_SOURCE_SCHEMA],
      emittedSchemas: [NOTE_COMPILER_SCHEMA],
      capabilities: [
        'compile-note-proposal-v0', 'preview-complete-candidate-v0',
        'translate-typed-note-operations-v0',
      ],
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
        outputSchema: NOTE_COMPILER_SCHEMA,
        payload: compileNoteProposal(request.payload, options),
      };
    },
  };
}
