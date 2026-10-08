/**
 * Plan one guarded Launcher clip edit (8h4c). Pure: it reads no host and writes nothing.
 *
 * Input: the fresh raw snapshot of the clip, the registry entry of the base ref
 * (already judged `current` against that snapshot), and one validated proposal:
 * a sparse patch, a desired document, or an unguarded desired replacement.
 *
 * The planner follows the host binding base-resolution steps 3–6:
 *
 *   1. Re-project the fresh snapshot with the original IDs and overlays. The
 *      original R27 guard must match.
 *   2. The read covers every field except articulation and repeat, so the base
 *      is partial. Resolve it to a full base: articulation has no host storage,
 *      and the raw repeat controls stay in the raw candidate (D36). Then run the
 *      binding assessment with `rawReplay`.
 *   3. Build the candidate from fresh raw state. An untouched note keeps every
 *      raw field. A changed note keeps its raw fields outside the changed
 *      portable fields. A new note and a changed field are mapped with
 *      `d9MappedFields`. Then the candidate omits each portable group of a
 *      new or changed field that has its portable default, and each raw value
 *      that equals the host insertion value (8h4c2). The host insertion value
 *      projects to the portable default (D35), so an omitted field needs no
 *      property stage.
 *   4. Select the route. E128 targeted removal and insertion when every
 *      changed note changes its cell and no inserted cell is a removed cell;
 *      otherwise whole-clip replacement with all-channel protection (D16).
 *
 * A refusal is an `EditRefusal`. Every refusal happens before a host call.
 */
import { isDeepStrictEqual } from 'node:util';

import {
  chooseStepSize, exactClipColor, snapshotClip,
  type ClipAddress, type ClipMetadataState, type ClipSnapshot, type NoteRecord, type Op,
} from '../contract/index.js';
import { NoteTimingUnrepresentableError } from '../contract/errors.js';
import {
  contentHash, DocumentError, validate,
  type Document, type Event, type EventField, type Materialized, type StateDocument,
} from '../document/index.js';
import { cloneJson } from '../document/json.js';
import { normalizedContentHash } from '../document/semantic.js';
import { EVENT_DEFAULTS } from '../document/model.js';
import { binary64, cmp, rational, spelling, sum } from '../document/rational.js';
import {
  assessBindingProposal, BindingRefusal, d9MappedFields, resolvePartialProposal,
  type Authority, type FreshAuthority,
} from './ghostnote-document.js';
import { cellKey, type BaseEntry, type CellKey } from './identity-registry.js';
import { launcherClipCells, projectLauncherClip, type LauncherClipProjection } from './launcher-clip-document.js';

/** A planner refusal. `code` is a stable failure code of the result module. */
export class EditRefusal extends Error {
  constructor(
    readonly code: 'unsupported' | 'range' | 'invalid-input' | 'target-changed',
    readonly reason: string,
    message: string,
    readonly detail: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = 'EditRefusal';
  }
}

export type EditRoute = 'none' | 'targeted' | 'whole-clip';

/** One note of the candidate: its host channel, its raw record, and its event ID. */
export interface CandidateNote {
  readonly id: string;
  readonly channel: number;
  readonly note: NoteRecord;
  readonly origin: 'untouched' | 'changed' | 'added';
}

export interface EditPlan {
  /** The materialized portable result, with the coverage of the read. */
  readonly expected: StateDocument;
  readonly expectedHash: string;
  readonly report: Materialized['report'];
  readonly route: EditRoute;
  readonly ops: readonly Op[];
  readonly clip: ClipAddress;
  /** All candidate notes in channel, cell, and pitch order. */
  readonly candidate: readonly CandidateNote[];
  readonly metadata: ClipMetadataState;
  /** `cellKey` to event ID for the readback. */
  readonly ids: ReadonlyMap<string, string>;
  readonly clipId: string;
  /** Changed cells: moved notes have an old and a new cell. */
  readonly moved: readonly { readonly id: string; readonly from: CellKey; readonly to: CellKey }[];
  /** True when the plan changes nothing on the host and nothing in the annotation store. */
  readonly noChange: boolean;
}

export interface EditPlanInput {
  readonly snapshot: ClipSnapshot;
  /** The registry entry of the base, or the fresh acquisition for an unguarded replacement. */
  readonly entry: BaseEntry;
  readonly proposal: Document;
  /** `replace`: an unguarded desired document replaces the clip. The entry is a fresh acquisition. */
  readonly mode: 'guarded' | 'replace';
  readonly fresh: FreshAuthority;
}

/** The raw note keys that one portable event field maps to. Channel moves the note between channel lists. */
const RAW_KEYS: Readonly<Partial<Record<EventField, readonly (keyof NoteRecord)[]>>> = {
  at: ['startBeats'],
  duration: ['durationBeats'],
  pitch: ['pitch'],
  velocity: ['velocity'],
  channel: [],
  mute: ['isMuted'],
  releaseVelocity: ['releaseVelocity'],
  expression: ['velocitySpread', 'gain', 'pan', 'timbre', 'transpose'],
  chance: ['chance', 'isChanceEnabled'],
  occurrence: ['occurrence', 'isOccurrenceEnabled'],
  recurrence: ['recurrence', 'isRecurrenceEnabled'],
};

const UNCOVERED: EventField[] = ['articulation', 'repeat'];

/** The raw key groups that one portable value maps to. Each expression member maps to one raw key. */
const GROUPS: readonly (readonly (keyof NoteRecord)[])[] = [
  ['isMuted'], ['releaseVelocity'], ['velocitySpread'], ['gain'], ['pan'], ['timbre'], ['transpose'],
  ['chance', 'isChanceEnabled'], ['occurrence', 'isOccurrenceEnabled'], ['recurrence', 'isRecurrenceEnabled'],
];
const DEFAULT_GROUPS = {
  mute: EVENT_DEFAULTS.mute, releaseVelocity: EVENT_DEFAULTS.releaseVelocity, expression: EVENT_DEFAULTS.expression,
  chance: EVENT_DEFAULTS.chance, occurrence: EVENT_DEFAULTS.occurrence, recurrence: EVENT_DEFAULTS.recurrence,
};

function refusalOf(error: unknown): never {
  if (error instanceof EditRefusal) throw error;
  if (error instanceof BindingRefusal) {
    if (error.code === 'authority') {
      throw new EditRefusal('target-changed', 'authority', 'The base ref is not current at the write.');
    }
    if (error.code === 'base') {
      throw new EditRefusal('invalid-input', 'base', 'The base sha256 does not match the base ref.');
    }
    throw new EditRefusal('unsupported', error.code, error.message);
  }
  if (error instanceof DocumentError) {
    throw new EditRefusal('invalid-input', error.rule, error.message, { rule: error.rule, path: error.path });
  }
  if (error instanceof NoteTimingUnrepresentableError) {
    throw new EditRefusal('unsupported', 'timing', 'A note start or duration does not fit a supported writable '
      + 'grid. Binary grids extend through 1/512 beat; the triplet family through 1/768 beat.');
  }
  throw error;
}

const exactNumber = (text: string): number => {
  const value = rational(text);
  return Number(value.n) / Number(value.d);
};

function cellOf(event: Event): CellKey {
  const at = rational(event.at);
  return { channel: (event.channel ?? 1) - 1, pitch: event.pitch, cell: Number(at.n * 512n / at.d) };
}

/** The raw note at each cell of the snapshot. */
function rawNotes(snapshot: ClipSnapshot): Map<string, { channel: number; note: NoteRecord }> {
  const found = new Map<string, { channel: number; note: NoteRecord }>();
  snapshot.channels.forEach((notes, channel) => {
    for (const note of notes) {
      found.set(cellKey({ channel, pitch: note.pitch, cell: Math.floor(note.startBeats * 512) }), { channel, note });
    }
  });
  return found;
}

/** The full base: the read with articulation and repeat declared at their defaults (no host storage). */
function fullBase(original: StateDocument): StateDocument {
  const full = cloneJson(original) as StateDocument;
  full.coverage = full.coverage.map((item) => ({ ...item, fields: 'all' }));
  return validate(full) as StateDocument;
}

/**
 * Map changed fields of one event onto a raw note. Pressure is not written; the assessment proved it unchanged.
 * Each event is an event of the validated materialized document.
 */
function mappedNote(event: Event): { channel: number; note: NoteRecord } {
  const writable = event.expression === undefined ? event : { ...event, expression: { ...event.expression, pressure: 0 } };
  const { channel, note } = d9MappedFields(writable, { validated: true });
  return { channel, note };
}

/** The raw values of the default portable groups. They do not depend on the timing, pitch, or channel. */
let defaultGroupValues: Record<string, unknown> | undefined;
function defaultGroups(): Record<string, unknown> {
  defaultGroupValues ??= d9MappedFields({ id: 'default', clip: 'default', at: '0', duration: '1', pitch: 60,
    velocity: 100, ...DEFAULT_GROUPS } as Event).note as unknown as Record<string, unknown>;
  return defaultGroupValues;
}

/**
 * The raw keys of a mapped note whose portable group has its default. The host insertion value projects to the
 * same portable value (D35), so a write can leave these keys to the host.
 */
function defaultKeys(mapped: Record<string, unknown>): Set<string> {
  const fallback = defaultGroups();
  const keys = new Set<string>();
  for (const group of GROUPS) {
    if (group.every((key) => isDeepStrictEqual(mapped[key], fallback[key]))) for (const key of group) keys.add(key);
  }
  return keys;
}

/** A new note: the mapped raw note without the keys whose portable group has its default. */
function addedNote(event: Event): { channel: number; note: NoteRecord } {
  const { channel, note } = mappedNote(event);
  const omitted = defaultKeys(note as unknown as Record<string, unknown>);
  return { channel, note: Object.fromEntries(Object.entries(note).filter(([key]) => !omitted.has(key))) as unknown as NoteRecord };
}

/** Omit each raw value that equals the host insertion value. A note write then leaves it to the host (D31). */
function lean(note: NoteRecord): NoteRecord {
  return Object.fromEntries(Object.entries(note).filter(([key, value]) =>
    !(key in HOST_NOTE_DEFAULTS) || !isDeepStrictEqual(value, HOST_NOTE_DEFAULTS[key]))) as unknown as NoteRecord;
}

function merged(raw: NoteRecord, event: Event, fields: readonly string[]): NoteRecord {
  const mapped = mappedNote(event).note as unknown as Record<string, unknown>;
  const omitted = defaultKeys(mapped);
  const next = { ...raw } as Record<string, unknown>;
  for (const field of fields) {
    for (const key of RAW_KEYS[field as EventField] ?? []) {
      if (mapped[key] === undefined || omitted.has(key)) delete next[key];
      else next[key] = mapped[key];
    }
  }
  return next as unknown as NoteRecord;
}

/** The requested change of one clip property write. Omitted properties keep their prior value. */
export type ClipPropertyChanges = Partial<ClipMetadataState>;

/**
 * The one clip property writer (8h4d): `edit_launcher_clip` and `set_launcher_clip_properties` both complete a
 * `clip.update` here. A property change needs a palette colour before and after, so the change can be reversed
 * exactly. A length change without a loop end keeps the loop start and moves the loop end with the length.
 */
export function completeClipProperties(prior: ClipMetadataState, changes: ClipPropertyChanges): ClipMetadataState {
  if (exactClipColor(prior.color) === undefined) {
    throw new EditRefusal('unsupported', 'clip-colour', 'The clip colour is outside the exact Bitwig palette, so '
      + 'a clip property change cannot be reversed exactly. Set a palette colour in Bitwig first.');
  }
  if (changes.color !== undefined && exactClipColor(changes.color) === undefined) {
    throw new EditRefusal('unsupported', 'clip-colour', 'The requested clip colour is outside the exact Bitwig '
      + 'palette. Use a colour of detail.supportedClipColors.');
  }
  const next = { ...prior, ...changes };
  if (changes.loopEndBeats === undefined
      && (changes.lengthBeats !== undefined || changes.loopStartBeats !== undefined)) {
    next.loopEndBeats = next.loopStartBeats + next.lengthBeats;
  }
  if (next.loopEndBeats !== next.loopStartBeats + next.lengthBeats) {
    throw new EditRefusal('invalid-input', 'loop', 'The loop end must equal the loop start plus the length.');
  }
  return next;
}

/** The clip length of a document clip in beats. It must be an exact binary64 value. */
export function documentClipLength(clip: StateDocument['clips'][number]): number {
  const lengthBeats = exactNumber(clip.length);
  if (cmp(spelling(binary64(lengthBeats)), clip.length) !== 0) {
    throw new EditRefusal('unsupported', 'length', 'The clip length must be an exact binary64 beat value.');
  }
  const loop = clip.loop ?? null;
  if (loop !== null && (cmp(loop.from, '0') !== 0 || cmp(loop.to, clip.length) !== 0)) {
    throw new EditRefusal('unsupported', 'loop', 'The host loop runs from 0 to the clip length. A loop must be '
      + 'null or {from:"0", to:<length>}.');
  }
  return lengthBeats;
}

/** Clip metadata after the portable clip fields; unrepresented raw fields stay. */
function plannedMetadata(raw: ClipMetadataState, clip: StateDocument['clips'][number], fields: readonly string[]): ClipMetadataState {
  if (fields.length === 0) return raw;
  if (exactClipColor(raw.color) === undefined) completeClipProperties(raw, {});
  const lengthBeats = documentClipLength(clip);
  return completeClipProperties(raw, { name: clip.name ?? '', lengthBeats, loopEnabled: (clip.loop ?? null) !== null });
}

function eventEnd(event: Event): string {
  return sum(event.at, event.duration);
}

/** Plan one edit. See the module header for the steps. */
export function planLauncherClipEdit(input: EditPlanInput): EditPlan {
  const { snapshot, entry, fresh } = input;
  const cells = launcherClipCells(snapshot);
  const named = cells.map((key) => entry.events.get(cellKey(key)));
  if (named.some((id) => id === undefined)) {
    throw new EditRefusal('target-changed', 'cells', 'The fresh read has a cell that the base ref does not name.');
  }
  // An unguarded replacement claims no event identity: every base note is removed and every desired note is new.
  const replace = input.mode === 'replace';
  const eventIds = replace ? replacementIds(named.length, input.proposal) : named as string[];
  const original = replace ? projectLauncherClip(snapshot, entry.clipId, eventIds)
    : projectLauncherClip(snapshot, entry.clipId, eventIds, entry.overlays, entry.envelope);
  if (!replace && original.contentHash !== entry.contentHash) {
    throw new EditRefusal('target-changed', 'reprojection', 'The fresh read does not reproduce the base document.');
  }
  const expected: Authority = { snapshot: entry.snapshot };
  const full = fullBase(original.document);
  const proposal = replace ? rebindReplacement(input.proposal, original, full) : input.proposal;

  let result: Materialized;
  try {
    if (replace) {
      result = assessBindingProposal(full, proposal, expected, fresh, { rawReplay: true });
    } else {
      if (proposal.base === undefined) {
        throw new EditRefusal('invalid-input', 'base', 'A guarded edit needs BASE with the sha256 and ref of a read.');
      }
      if (proposal.base.sha256 !== entry.contentHash) {
        throw new EditRefusal('invalid-input', 'base', 'BASE sha256 does not match the base ref. Use the sha256 '
          + 'and ref of the same read.');
      }
      result = resolvePartialProposal({
        original: original.document, freshProjection: original.document, full, proposal, expected, fresh,
        resolution: {
          ref: proposal.base.ref ?? '',
          declaredFields: full.events.map((event) => ({ event: event.id, fields: UNCOVERED })),
          hostPreservationProved: true,
        },
        options: { rawReplay: true },
        originalHash: original.contentHash,
      });
    }
  } catch (error) {
    return refusalOf(error);
  }

  const document = result.document;
  const clip = document.clips[0]!;
  const baseClip = original.document.clips[0]!;
  const clipFields = result.report.clipFields.find((item) => item.id === clip.id)?.fields ?? [];
  const metadata = plannedMetadata(snapshot.metadata, clip, clipFields);

  const raw = rawNotes(snapshot);
  const rawById = new Map<string, { channel: number; note: NoteRecord; key: CellKey }>();
  cells.forEach((key, index) => {
    const found = raw.get(cellKey(key))!;
    rawById.set(eventIds[index]!, { ...found, key });
  });
  const changed = new Map(result.report.changedFields.map((item) => [item.id, item.fields]));
  const added = new Set(result.report.added);
  const lengthChanged = clipFields.includes('length');

  const candidate: CandidateNote[] = [];
  const moved: { id: string; from: CellKey; to: CellKey }[] = [];
  const pastEnd: string[] = [];
  try {
    for (const event of document.events) {
      const key = cellOf(event);
      const fields = changed.get(event.id);
      const touched = added.has(event.id) || fields !== undefined;
      if (touched || lengthChanged) {
        if (cmp(event.at, clip.length) >= 0 || cmp(eventEnd(event), clip.length) > 0) pastEnd.push(event.id);
      }
      if (added.has(event.id)) {
        const { channel, note } = addedNote(event);
        candidate.push({ id: event.id, channel, note: lean(note), origin: 'added' });
        continue;
      }
      const prior = rawById.get(event.id)!;
      if (fields === undefined) {
        candidate.push({ id: event.id, channel: prior.channel, note: lean(prior.note), origin: 'untouched' });
        continue;
      }
      const note = lean(merged(prior.note, event, fields));
      candidate.push({ id: event.id, channel: key.channel, note, origin: 'changed' });
      if (cellKey(key) !== cellKey(prior.key)) moved.push({ id: event.id, from: prior.key, to: key });
    }
  } catch (error) {
    return refusalOf(error);
  }
  if (pastEnd.length > 0) {
    throw new EditRefusal('range', 'past-clip-end', 'A note would start or end after the clip length. The host '
      + 'writer refuses notes past the clip end.', { events: pastEnd.slice(0, 64), length: clip.length });
  }
  candidate.sort((a, b) => a.channel - b.channel || a.note.startBeats - b.note.startBeats || a.note.pitch - b.note.pitch);

  const removedIds = result.report.removed;
  const movedIds = new Set(moved.map((item) => item.id));
  const fieldOnly = [...changed.keys()].filter((id) => !movedIds.has(id));
  const removedKeys = new Set([...removedIds.map((id) => cellKey(rawById.get(id)!.key)),
    ...moved.map((item) => cellKey(item.from))]);
  const eventsById = new Map(document.events.map((event) => [event.id, event]));
  const insertedKeys = [...[...added].map((id) => cellKey(cellOf(eventsById.get(id)!))),
    ...moved.map((item) => cellKey(item.to))];
  const noteChange = removedIds.length + added.size + changed.size > 0;
  const route: EditRoute = !noteChange ? 'none'
    : fieldOnly.length === 0 && insertedKeys.every((key) => !removedKeys.has(key)) ? 'targeted' : 'whole-clip';

  if (route === 'whole-clip') {
    const pressured = candidate.filter((item) => (item.note.pressure ?? 0) !== 0).map((item) => item.id);
    if (pressured.length > 0) {
      // Defensive: Bitwig reports pressure as 0 (E236), so a live read never reaches this refusal.
      throw new EditRefusal('unsupported', 'pressure', 'This edit needs whole-clip replacement, and the clip has '
        + 'notes with pressure. The host cannot write pressure, so replacement would lose it. Change only the '
        + 'cells of notes (add, remove, or move a note to a new cell), or remove the pressure in Bitwig first.',
      { events: pressured.slice(0, 64) });
    }
  }

  const address = snapshotClip(snapshot.ref, fresh.read.at.sceneEpoch);
  const ops: Op[] = [];
  try {
    if (clipFields.length > 0) ops.push({ op: 'clip.update', clip: address, metadata });
    if (route === 'targeted') {
      const removed = [...removedIds.map((id) => rawById.get(id)!), ...moved.map((item) => rawById.get(item.id)!)];
      for (let channel = 0; channel < 16; channel += 1) {
        const notes = removed.filter((item) => item.channel === channel).map((item) => item.note);
        if (notes.length > 0) ops.push({ op: 'note.remove', clip: address, channel, notes });
      }
      const inserted = new Set([...added, ...moved.map((item) => item.id)]);
      for (let channel = 0; channel < 16; channel += 1) {
        const notes = candidate.filter((item) => item.channel === channel && inserted.has(item.id)).map((item) => item.note);
        if (notes.length === 0) continue;
        chooseStepSize(notes);
        ops.push({ op: 'note.insert', clip: address, channel, notes });
      }
    } else if (route === 'whole-clip') {
      ops.push({ op: 'note.clear', clip: address });
      for (let channel = 0; channel < 16; channel += 1) {
        const notes = candidate.filter((item) => item.channel === channel).map((item) => item.note);
        if (notes.length === 0) continue;
        chooseStepSize(notes);
        ops.push({ op: 'note.write', clip: address, channel, notes });
      }
    }
  } catch (error) {
    return refusalOf(error);
  }

  const expectedDocument = validate({
    ...document, kind: 'snapshot',
    coverage: original.document.coverage.map((item) => ({ ...item, to: clip.length })),
  }) as StateDocument;
  const overlaysChanged = result.report.overlayChanges.length > 0;
  return {
    expected: expectedDocument,
    expectedHash: normalizedContentHash(expectedDocument),
    report: result.report,
    route,
    ops,
    clip: address,
    candidate,
    metadata,
    ids: new Map(candidate.map((item) => [cellKey({ channel: item.channel, pitch: item.note.pitch,
      cell: Math.floor(item.note.startBeats * 512) }), item.id])),
    clipId: baseClip.id,
    moved,
    noChange: ops.length === 0 && !overlaysChanged,
  };
}

/** Base event IDs for an unguarded replacement: distinct from every ID of the proposal. */
function replacementIds(count: number, proposal: Document): string[] {
  const used = new Set(proposal.kind === 'patch' ? [] : [...proposal.events.map((event) => event.id),
    ...proposal.overlays.map((overlay) => overlay.id)]);
  let prefix = 'gn.replaced.';
  while ([...used].some((id) => id.startsWith(prefix))) prefix = `${prefix}x.`;
  return Array.from({ length: count }, (_, index) => `${prefix}${index + 1}`);
}

/**
 * An unguarded desired replacement names its own clip ID. Bind it to the clip ID of the fresh read, and give it
 * the base sha256 of the full base. It cannot carry overlays: their dependency bases name the agent's clip ID.
 */
function rebindReplacement(proposal: Document, original: LauncherClipProjection, full: StateDocument): Document {
  if (proposal.kind !== 'desired') {
    throw new EditRefusal('invalid-input', 'replace', 'intent replace needs a desired document.');
  }
  if (proposal.base !== undefined) {
    throw new EditRefusal('invalid-input', 'replace', 'intent replace takes a desired document without BASE. '
      + 'With BASE, omit intent.');
  }
  if (proposal.clips.length !== 1) {
    throw new EditRefusal('invalid-input', 'clip-inventory', 'A desired document for one Launcher clip has exactly one CLIP.');
  }
  const clipId = original.document.clips[0]!.id;
  const from = proposal.clips[0]!.id;
  if (from !== clipId && proposal.overlays.length > 0) {
    throw new EditRefusal('invalid-input', 'replace', 'A replacement with overlays must use the clip ID of a read.');
  }
  const rebound = cloneJson(proposal) as StateDocument;
  rebound.clips = rebound.clips.map((item) => ({ ...item, id: clipId }));
  rebound.coverage = rebound.coverage.map((item) => ({ ...item, clip: clipId }));
  rebound.events = rebound.events.map((event) => ({ ...event, clip: clipId }));
  rebound.base = { sha256: contentHash(full) };
  return validate(rebound);
}

// --- readback ------------------------------------------------------------------

/** Host values of a new note. An absent field of a read note has this value (D31). */
const HOST_NOTE_DEFAULTS: Readonly<Record<string, unknown>> = {
  releaseVelocity: 100 / 127, velocitySpread: 0, gain: 0, pan: 0, pressure: 0, timbre: 0, transpose: 0,
  chance: 1, isChanceEnabled: true, isMuted: false, isOccurrenceEnabled: true, occurrence: 'ALWAYS',
  isRecurrenceEnabled: true, recurrence: [1, 1], isRepeatEnabled: true, repeatCount: 0, repeatCurve: 0,
  repeatVelocityCurve: 0, repeatVelocityEnd: 0,
};
const COMPARED = ['velocity', 'durationBeats', ...Object.keys(HOST_NOTE_DEFAULTS)] as const;
/** The measured scalar property tolerance (E2). Gain, velocity, timing, flags, and enums compare exactly. */
const TOLERANCE = 2e-3;
const EXACT = new Set(['velocity', 'durationBeats', 'gain', 'repeatCount']);

function fieldValue(note: NoteRecord, field: string): unknown {
  const value = (note as unknown as Record<string, unknown>)[field];
  return value === undefined ? HOST_NOTE_DEFAULTS[field] : value;
}

function sameValue(field: string, expected: unknown, observed: unknown): boolean {
  if (typeof expected === 'number' && typeof observed === 'number') {
    return EXACT.has(field) ? expected === observed : Math.abs(expected - observed) <= TOLERANCE;
  }
  if (Array.isArray(expected) && Array.isArray(observed)) {
    return expected.length === observed.length && expected.every((item, index) => item === observed[index]);
  }
  return expected === observed;
}

export interface ReadbackDiscrepancy {
  readonly id?: string;
  /** Portable channel, 1..16. */
  readonly channel: number;
  readonly pitch: number;
  readonly at: string;
  readonly field: string;
  readonly expected: unknown;
  readonly observed: unknown;
}

/**
 * Compare the candidate with an independent raw read on all 16 channels. Each candidate note must be at its cell
 * with every raw field; the read must have no other note. Clip metadata is compared when the plan changed it.
 */
export function compareReadback(plan: EditPlan, observed: ClipSnapshot): ReadbackDiscrepancy[] {
  const found = rawNotes(observed);
  const out: ReadbackDiscrepancy[] = [];
  const at = (note: NoteRecord) => `${Math.floor(note.startBeats * 512)}/512`;
  for (const item of plan.candidate) {
    const key = cellKey({ channel: item.channel, pitch: item.note.pitch, cell: Math.floor(item.note.startBeats * 512) });
    const where = { id: item.id, channel: item.channel + 1, pitch: item.note.pitch, at: at(item.note) };
    const got = found.get(key);
    if (got === undefined) {
      out.push({ ...where, field: 'exists', expected: true, observed: false });
      continue;
    }
    found.delete(key);
    for (const field of COMPARED) {
      const expected = fieldValue(item.note, field);
      const actual = fieldValue(got.note, field);
      if (!sameValue(field, expected, actual)) out.push({ ...where, field, expected, observed: actual });
    }
  }
  for (const extra of found.values()) {
    out.push({ channel: extra.channel + 1, pitch: extra.note.pitch, at: at(extra.note), field: 'exists',
      expected: false, observed: true });
  }
  for (const field of ['name', 'lengthBeats', 'loopEnabled', 'loopStartBeats', 'loopEndBeats', 'playStartBeats'] as const) {
    if (plan.metadata[field] !== observed.metadata[field]) {
      out.push({ channel: 0, pitch: -1, at: 'clip', field: `clip.${field}`, expected: plan.metadata[field],
        observed: observed.metadata[field] });
    }
  }
  return out;
}
