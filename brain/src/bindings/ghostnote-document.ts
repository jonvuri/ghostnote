/** Pure 8f3 contract checks. This module does not read or write a host. */
import {
  applyDesired, applyPatch, contentHash, EVENT_DEFAULTS, importNotes, validate,
  type Document, type Event, type EventField, type SourceNote, type StateDocument,
} from '../document/index.js';
import { binary64, cmp, rational, spelling, sum } from '../document/rational.js';
import { applyDesiredTo, applyPatchTo } from '../document/materialize.js';
import { normalizedContentHash } from '../document/semantic.js';
import { chooseStepSize } from '../contract/grid.js';
import { orderedNoteProps, type NoteRecord } from '../contract/state.js';
import {
  decodeClipSnapshotRef, encodeClipSnapshotRef, judgeClipSnapshot,
  type ClipSnapshotRef, type ClipSnapshotVerdict,
} from '../contract/clip-snapshot.js';
import type { ContentDelta } from '../contract/observers.js';
import type { RevisionMark, Snapshot } from '../contract/snapshot.js';
import { isDeepStrictEqual } from 'node:util';

export class BindingRefusal extends Error {
  constructor(readonly code: string, message: string, readonly detail: Readonly<Record<string, unknown>> = {}) {
    super(message);
    this.name = 'BindingRefusal';
  }
}
function refuse(code: string, message: string, detail?: Readonly<Record<string, unknown>>): never {
  throw new BindingRefusal(code, message, detail);
}
export const OCCURRENCES = [
  'ALWAYS', 'FIRST', 'NOT_FIRST', 'PREV', 'NOT_PREV', 'PREV_CHANNEL',
  'NOT_PREV_CHANNEL', 'PREV_KEY', 'NOT_PREV_KEY', 'FILL', 'NOT_FILL',
] as const;
export const RAW_FIELDS: EventField[] = [
  'id', 'clip', 'at', 'duration', 'pitch', 'velocity', 'channel', 'mute',
  'releaseVelocity', 'expression', 'chance', 'occurrence', 'recurrence',
];
/** Each group contains raw values. Host timbre is signed from -1 through 1. */
export interface RawNote {
  id: string;
  channel: number;
  at: string | number;
  duration: string | number;
  pitch: number;
  velocity: number;
  mute: boolean;
  releaseVelocity: number;
  expression: NonNullable<Event['expression']>;
  chance: NonNullable<Event['chance']>;
  occurrence: { enabled: boolean; condition: string };
  recurrence: NonNullable<Event['recurrence']>;
}
export function portableOccurrence(host: string): string {
  if (!(OCCURRENCES as readonly string[]).includes(host))
    refuse('occurrence', `Unknown host occurrence ${host}`);
  return host === 'ALWAYS' ? 'always' : `bitwig:${host}`;
}
export function hostOccurrence(portable: string): string {
  const host = portable === 'always' ? 'ALWAYS' : portable.startsWith('bitwig:') ? portable.slice(7) : '';
  if (!(OCCURRENCES as readonly string[]).includes(host) || (host === 'ALWAYS' && portable !== 'always'))
    refuse('occurrence', `Unsupported portable occurrence ${portable}`);
  return host;
}
/** The binary64 value `steps` units in the last place away from a nonnegative `value`. */
function ulpStep(value: number, steps: number): number {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value);
  view.setBigInt64(0, view.getBigInt64(0) + BigInt(steps));
  return view.getFloat64(0);
}
/**
 * Portable gain of a raw host gain (E245). The inspector shows `60*log10(raw)` dB, so the amplitude ratio is
 * `raw^3`. About three binary64 ratios have the same cube root; return the one with the shortest spelling, so a
 * written portable value with up to six decimals reads back unchanged. `cbrt` of the result is `raw` whenever
 * the cube is a normal number. Raw 0 is the gain of a new note and of setter 0, which the host plays at 0 dB; it
 * is unity. An inspector -inf note also reads raw 0 (HOST-BINDING.md, "Gain zero").
 */
export function portableGain(raw: number): number {
  if (raw === 0) return 1;
  const cube = raw ** 3;
  let best = cube;
  for (let steps = -4; steps <= 4; steps += 1) {
    const candidate = ulpStep(cube, steps);
    if (candidate >= 0 && Math.cbrt(candidate) === raw && String(candidate).length < String(best).length) best = candidate;
  }
  return best;
}
/** The smallest raw gain. The host shows it as -inf and it reads back as portable 0, not as unity. */
export const SILENT_RAW_GAIN = 1e-323;
/** Raw host gain of a portable gain: the inverse of `portableGain`. */
export function hostGain(portable: number): number {
  return portable === 0 ? SILENT_RAW_GAIN : Math.cbrt(portable);
}
/**
 * An enabled control with a neutral value has no effect. It projects to the portable default (disabled).
 * A disabled control keeps its stored value.
 */
function neutralChance(chance: RawNote['chance']): RawNote['chance'] {
  return chance.enabled && chance.value === 1 ? { enabled: false, value: 1 } : chance;
}
function neutralOccurrence(occurrence: RawNote['occurrence']): RawNote['occurrence'] {
  return occurrence.enabled && occurrence.condition === 'ALWAYS' ? { enabled: false, condition: 'ALWAYS' } : occurrence;
}
function neutralRecurrence(recurrence: RawNote['recurrence']): RawNote['recurrence'] {
  return recurrence.enabled && recurrence.length === 1 && recurrence.mask === 1
    ? { enabled: false, length: 1, mask: 1 } : recurrence;
}
/**
 * Project a raw note scan. Clip metadata is supplied as portable values. `reason: false` omits the coverage
 * reason, for a caller that states the uncovered fields itself (8h4g: the projection is then validated once).
 */
export function projectRawClip(clip: StateDocument['clips'][number], notes: RawNote[], options: { reason?: boolean } = {}) {
  const source: SourceNote[] = notes.map(n => {
    if (!Number.isInteger(n.channel) || n.channel < 0 || n.channel > 15)
      refuse('channel', 'Host channel must be an integer from 0 through 15');
    const occurrence = neutralOccurrence(n.occurrence);
    return { ...n, clip: clip.id, channel: n.channel + 1,
      expression: { ...n.expression, gain: portableGain(n.expression.gain), timbre: (n.expression.timbre + 1) / 2 },
      chance: neutralChance(n.chance),
      occurrence: { ...occurrence, condition: portableOccurrence(occurrence.condition) },
      recurrence: neutralRecurrence(n.recurrence) };
  });
  const { events, report } = importNotes(source);
  const document = validate({
    format: 'ghostnote-document', version: '1.0', kind: 'snapshot',
    clips: [clip], events, overlays: [], coverage: [{
      clip: clip.id, from: '0', to: clip.length, channels: Array.from({ length: 16 }, (_, i) => i + 1),
      fields: RAW_FIELDS, status: 'complete',
      ...(options.reason === false ? {} : { reason: 'Full supplied raw scan; articulation and repeat are unavailable' }),
    }],
  }) as StateDocument;
  return { document, report };
}

/**
 * Private base authority: one D32 snapshot reference (mark, durable address,
 * and `ghostnote-launcher-source/1` digest). It is separate from the portable
 * document digest.
 */
export interface Authority {
  snapshot: ClipSnapshotRef;
}
/** A fresh read of the reference address and the content delta since its mark. */
export interface FreshAuthority {
  read: Snapshot;
  delta: ContentDelta;
  /** A mark after the read. The scene guard needs it to see a scene change during the read. */
  after?: RevisionMark;
}
/** Run the D32 verdict. Every verdict other than `current` refuses. */
export function guardAuthority(expected: Authority, fresh: FreshAuthority): ClipSnapshotVerdict {
  if (expected === null || typeof expected !== 'object' || !Object.hasOwn(expected, 'snapshot'))
    refuse('authority', 'Missing private snapshot authority');
  let ref: ClipSnapshotRef;
  try {
    ref = decodeClipSnapshotRef(encodeClipSnapshotRef(expected.snapshot));
  } catch (error) {
    return refuse('authority', `Invalid private snapshot authority: ${String(error)}`);
  }
  let verdict: ClipSnapshotVerdict;
  try {
    verdict = judgeClipSnapshot(ref, fresh.read, fresh.delta, fresh.after);
  } catch (error) {
    return refuse('authority', `Fresh authority is unavailable: ${String(error)}`);
  }
  if (verdict.verdict !== 'current') refuse('authority', `The snapshot reference is ${verdict.verdict}`);
  return verdict;
}
/** Resolve retained partial context with explicit full state and fresh authority. */
export function resolvePartialProposal(input: {
  original: StateDocument; freshProjection: StateDocument; full: StateDocument;
  proposal: Document; expected: Authority; fresh: FreshAuthority;
  resolution: {
    ref: string; declaredFields: { event: string; fields: EventField[] }[];
    hostPreservationProved: boolean;
  };
  options?: AssessOptions;
  /** The content hash of `original` when the caller has it (the projection's hash). */
  originalHash?: string;
}) {
  const { original, freshProjection, full, proposal, expected, fresh, resolution } = input;
  guardAuthority(expected, fresh);
  for (const c of original.clips) {
    const coverage = original.coverage.find(v => v.clip === c.id);
    if (!coverage || coverage.status !== 'complete' || coverage.channels.length !== 16
      || cmp(coverage.from, '0') !== 0 || cmp(coverage.to, c.length) !== 0)
      refuse('resolution', 'This fixture resolver supports field-only partial coverage');
  }
  if (!proposal.base?.ref || resolution.ref !== proposal.base.ref)
    refuse('resolution', 'Partial resolution needs the retained binding reference');
  if (!resolution.hostPreservationProved)
    refuse('resolution', 'The caller must prove preservation of unmapped host values');
  const declared = new Map<string, EventField[]>();
  for (const d of resolution.declaredFields) declared.set(d.event, [...(declared.get(d.event) ?? []), ...d.fields]);
  for (const e of full.events) {
    const covered = original.coverage.find(c => c.clip === e.clip)?.fields;
    if (!covered) refuse('coverage', 'The full base has a clip outside the retained projection');
    if (covered !== 'all') for (const field of Object.keys(EVENT_DEFAULTS) as EventField[])
      if (!covered.includes(field) && !declared.get(e.id)?.includes(field))
        refuse('resolution', `Unknown ${field} needs an explicit declaration for ${e.id}`);
  }
  const originalHash = input.originalHash ?? contentHash(original);
  const freshHash = freshProjection === original ? originalHash : contentHash(freshProjection);
  if (!proposal.base || proposal.base.sha256 !== originalHash || freshHash !== originalHash)
    refuse('base', 'The retained partial guard does not match fresh projected state');
  const projected = structuredClone(full);
  projected.kind = original.kind;
  projected.coverage = structuredClone(original.coverage);
  for (const e of projected.events) {
    const fields = projected.coverage.find(c => c.clip === e.clip)?.fields;
    if (!fields) refuse('coverage', 'The full base has a clip outside the retained projection');
    if (fields !== 'all') for (const key of Object.keys(e) as EventField[])
      if (!fields.includes(key)) delete e[key];
  }
  if (contentHash(projected) !== originalHash)
    refuse('base', 'The full base does not reproduce the retained projection');
  const normalizedFull = validate(full) as StateDocument;
  const fullHash = normalizedContentHash(normalizedFull);
  const rebound = structuredClone(proposal);
  rebound.base = { ...proposal.base, sha256: fullHash };
  const result = assessBindingProposal(full, rebound, expected, fresh, input.options,
    { normalized: normalizedFull, hash: fullHash });
  return { ...result, guard: { originalHash, fullHash, ref: proposal.base.ref,
    sourceSha256: expected.snapshot.source.sha256 } };
}
function values(event: Event): Event {
  return { ...structuredClone(EVENT_DEFAULTS), ...event };
}
function equal(a: unknown, b: unknown): boolean {
  // Strings, booleans, and finite numbers survive JSON unchanged, except -0, which becomes 0.
  const scalar = (v: unknown) => typeof v === 'string' || typeof v === 'boolean' || Number.isFinite(v);
  if (scalar(a) && scalar(b)) return a === b;
  const plain = (v: unknown) => v === undefined ? undefined : JSON.parse(JSON.stringify(v));
  return isDeepStrictEqual(plain(a), plain(b));
}
export interface AssessOptions {
  /**
   * The live writer builds each reconstructed or removed note from its fresh raw host state, so the raw repeat
   * controls replay exactly (E230, D36). A pure fixture has no raw state and leaves this unset: then every
   * reconstruction and removal refuses for repeat. Pressure refusals do not change.
   */
  rawReplay?: boolean;
}
/**
 * Assess a complete portable base. Reacquisition must retain the original guard. `known` is the normalized base
 * (`validate(base)`) and its content hash when the caller has just computed them (8h4g).
 */
export function assessBindingProposal(
  base: StateDocument, proposal: Document, expected: Authority, fresh: FreshAuthority, options: AssessOptions = {},
  known?: { readonly normalized: StateDocument; readonly hash: string },
) {
  guardAuthority(expected, fresh);
  const normalizedBase = known?.normalized ?? validate(base) as StateDocument;
  if (!proposal.base || proposal.base.sha256 !== (known?.hash ?? normalizedContentHash(normalizedBase)))
    refuse('base', 'Fresh base does not match the original portable guard');
  const result = proposal.kind === 'patch' ? applyPatchTo(normalizedBase, proposal)
    : proposal.kind === 'desired' ? applyDesiredTo(normalizedBase, proposal)
    : refuse('proposal', 'A snapshot is not a host edit proposal');
  const oldClips = new Map(normalizedBase.clips.map(c => [c.id, c]));
  if (result.document.clips.length !== oldClips.size || result.document.clips.some(c => !oldClips.has(c.id)))
    refuse('clip-inventory', 'A portable inventory does not authorize host container changes');
  for (const clip of result.document.clips)
    if (!equal(clip.playRange ?? null, oldClips.get(clip.id)!.playRange ?? null))
      refuse('play-range', 'The measured host path cannot write a complete played range');
  const old = new Map(normalizedBase.events.map(e => [e.id, values(e)]));
  const changed = new Set([...result.report.added, ...result.report.changedFields.map(e => e.id)]);
  for (const e of result.document.events) {
    if (!changed.has(e.id)) continue;
    const next = values(e), prior = old.get(e.id);
    if (next.articulation !== 'normal' && next.articulation !== prior?.articulation)
      refuse('articulation', 'The host cannot write articulation labels');
    if (!equal(next.repeat, prior?.repeat ?? EVENT_DEFAULTS.repeat))
      refuse('repeat', 'Host repeat controls have no total-trigger-count mapping');
    if (!equal(next.expression?.pressure, prior?.expression?.pressure ?? 0))
      refuse('pressure', 'The host cannot write pressure');
    if (!equal(next.expression?.transpose, prior?.expression?.transpose) && Math.abs(next.expression!.transpose) > 96)
      refuse('transpose', 'The host transpose setter supports -96 through 96 semitones');
    const reconstruction = !prior || ['clip', 'at', 'pitch', 'channel'].some(k => !equal(next[k as keyof Event], prior[k as keyof Event]));
    if (reconstruction && next.expression!.pressure !== 0)
      refuse('pressure', 'Reconstruction cannot preserve nonzero pressure');
    if (reconstruction && !options.rawReplay)
      refuse('repeat', 'Reconstruction needs a confirmed mapping for all repeat controls');
    if (!equal(next.occurrence, prior?.occurrence)) hostOccurrence(next.occurrence!.condition);
    if (!equal(next.recurrence, prior?.recurrence) && next.recurrence!.length > 8)
      refuse('recurrence', 'The host supports at most eight recurrence cycles');
  }
  for (const id of result.report.removed)
    if (old.get(id)?.expression?.pressure !== 0)
      refuse('pressure', 'Reversal cannot restore removed nonzero pressure');
    else if (!options.rawReplay) refuse('repeat', 'Removal needs a confirmed repeat mapping for reversal');
  refuseOverlaps(result.document.events, changed);
  return result;
}

/** The pairs that an overlap refusal lists. `overlapPairs` counts all of them. */
export const OVERLAP_DETAIL_PAIRS = 16;
export interface OverlapPair {
  readonly first: string; readonly second: string;
  readonly channel: number; readonly pitch: number; readonly firstAt: string; readonly secondAt: string;
}

/** A binary min-heap of active notes by end. */
class Ends {
  readonly items: { end: string; event: Event }[] = [];
  push(item: { end: string; event: Event }): void {
    const a = this.items; a.push(item);
    for (let i = a.length - 1; i > 0;) {
      const up = (i - 1) >> 1;
      if (cmp(a[up]!.end, a[i]!.end) <= 0) break;
      [a[up], a[i]] = [a[i]!, a[up]!]; i = up;
    }
  }
  /** Remove the notes that end at or before `at`. */
  prune(at: string): void {
    const a = this.items;
    while (a.length > 0 && cmp(a[0]!.end, at) <= 0) {
      const last = a.pop()!;
      if (a.length === 0) break;
      a[0] = last;
      for (let i = 0; ;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && cmp(a[l]!.end, a[m]!.end) < 0) m = l;
        if (r < a.length && cmp(a[r]!.end, a[m]!.end) < 0) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i]!, a[m]!]; i = m;
      }
    }
  }
}

/**
 * The same-key overlaps that the measured write path cannot promise: two notes of one clip, channel, and pitch whose
 * intervals overlap, when at least one of them is in `changed`. Without `changed`, every note is new (a desired
 * document on an empty or replaced clip). One sort and one sweep in onset order; the listed pairs are bounded.
 */
export function sameKeyOverlaps(events: readonly Event[], changed?: ReadonlySet<string>) {
  const isChanged = (e: Event) => changed === undefined || changed.has(e.id);
  const sorted = events.map(values).sort((a, b) => a.clip < b.clip ? -1 : a.clip > b.clip ? 1 : cmp(a.at, b.at));
  const active = new Map<string, { all: Ends; changed: Ends }>();
  const pairs: OverlapPair[] = [];
  let total = 0;
  for (const e of sorted) {
    const key = `${e.clip}\0${e.channel}\0${e.pitch}`;
    const heaps = active.get(key) ?? { all: new Ends(), changed: new Ends() };
    active.set(key, heaps);
    heaps.all.prune(e.at); heaps.changed.prune(e.at);
    const prior = isChanged(e) ? heaps.all : heaps.changed;
    total += prior.items.length;
    if (pairs.length < OVERLAP_DETAIL_PAIRS && prior.items.length > 0) {
      const listed = prior.items.map(item => item.event).sort((a, b) => cmp(a.at, b.at));
      for (const p of listed.slice(0, OVERLAP_DETAIL_PAIRS - pairs.length))
        pairs.push({ first: p.id, second: e.id, channel: e.channel!, pitch: e.pitch, firstAt: p.at, secondAt: e.at });
    }
    const item = { end: sum(e.at, e.duration), event: e };
    heaps.all.push(item);
    if (isChanged(e)) heaps.changed.push(item);
  }
  return { pairs, total };
}

/** Refuse a same-key overlap (`sameKeyOverlaps`) with the bounded pair list and the total count (8i20). */
export function refuseOverlaps(events: readonly Event[], changed?: ReadonlySet<string>): void {
  const { pairs, total } = sameKeyOverlaps(events, changed);
  if (total > 0) refuse('overlap', 'The measured write path cannot promise this same-key overlap',
    { overlaps: pairs, overlapPairs: total });
}

/**
 * Map scalar fields to D9 inputs. This is not a complete insertion plan. `validated`: the event is an event of a
 * document that `validate` returned, so it is not validated again (8h4g: the planner maps each changed note).
 */
export function d9MappedFields(
  event: Event, options: { validated?: boolean } = {},
): { channel: number; note: NoteRecord; props: ReturnType<typeof orderedNoteProps> } {
  let checked: Event;
  if (options.validated === true) {
    checked = event;
  } else {
    const patch = validate({ format: 'ghostnote-document', version: '1.0', kind: 'patch',
      base: { sha256: '0'.repeat(64) }, add: [event], remove: [], update: [],
      clipUpdate: [], overlayPut: [], overlayRemove: [] });
    if (patch.kind !== 'patch') refuse('event', 'The scalar mapper needs a valid portable event');
    checked = patch.add[0];
  }
  const e = values(checked);
  if (e.articulation !== 'normal') refuse('articulation', 'The host cannot write articulation labels');
  if (!equal(e.repeat, EVENT_DEFAULTS.repeat)) refuse('repeat', 'Host repeat controls need an explicit semantic converter');
  if (e.expression!.pressure !== 0) refuse('pressure', 'The host cannot write pressure');
  if (Math.abs(e.expression!.transpose) > 96) refuse('transpose', 'The transpose setter supports -96 through 96 semitones');
  if (e.recurrence!.length > 8) refuse('recurrence', 'The host supports at most eight recurrence cycles');
  const rationalNumber = (s: string) => {
    const value = rational(s);
    const number = Number(value.n) / Number(value.d);
    if (!Number.isFinite(number) || cmp(spelling(binary64(number)), s) !== 0)
      refuse('timing', 'D9 input must preserve exact portable timing in binary64');
    return number;
  };
  const { pressure: _pressure, ...expression } = e.expression!;
  const note: NoteRecord = {
    startBeats: rationalNumber(e.at), durationBeats: rationalNumber(e.duration),
    pitch: e.pitch, velocity: e.velocity, ...expression, gain: hostGain(expression.gain), timbre: 2 * expression.timbre - 1,
    releaseVelocity: e.releaseVelocity, isMuted: e.mute,
    chance: e.chance!.value, isChanceEnabled: e.chance!.enabled,
    occurrence: hostOccurrence(e.occurrence!.condition), isOccurrenceEnabled: e.occurrence!.enabled,
    recurrence: [e.recurrence!.length, e.recurrence!.mask], isRecurrenceEnabled: e.recurrence!.enabled,
  };
  chooseStepSize([note]);
  return { channel: e.channel! - 1, note, props: orderedNoteProps(note) };
}

/** Keep legacy replay checks separate from normalized document timing. */
export function checkLegacyReplay(notes: readonly NoteRecord[]): void {
  chooseStepSize(notes);
}

export interface RecoveryCandidate { oldId: string; candidates: string[] }
/** Recover only one-to-one identity matches with independent ownership evidence. */
export function recoverEventIds(matches: RecoveryCandidate[], ownershipProved: boolean) {
  const reused: [string, string][] = [], remint: string[] = [], oldIds = new Set<string>();
  const counts = new Map<string, number>();
  for (const m of matches) {
    if (oldIds.has(m.oldId)) refuse('identity', 'Duplicate old event IDs cannot be recovered');
    oldIds.add(m.oldId);
    for (const id of new Set(m.candidates)) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  for (const m of matches) {
    const candidates = [...new Set(m.candidates)];
    if (ownershipProved && candidates.length === 1 && counts.get(candidates[0]) === 1)
      reused.push([m.oldId, candidates[0]]);
    else remint.push(m.oldId);
  }
  return { reused: Object.fromEntries(reused), remint };
}
