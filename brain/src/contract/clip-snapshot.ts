/**
 * D32 pull snapshots: the reference, the source fingerprint, and the verdict.
 *
 * An agent works on a snapshot of one launcher clip and sends a patch against
 * it. A reference names the clip that the snapshot came from and lets
 * Ghostnote tell at use time if the snapshot is still current. Each use reads
 * the clip again (8h3c cold reader). There is no resident grid.
 *
 * A reference holds three things, as typed fields:
 *
 *   - the complete `RevisionMark` of the read, so that `contentDelta` can use
 *     the full mark at both ends;
 *   - the durable address: track `channelId` and launcher row;
 *   - one `ghostnote-launcher-source/1` content fingerprint.
 *
 * The guards are not inside the digest. A typed comparison gives each refusal
 * its own reason. A `current` verdict states content equality at the same
 * address in one identity domain. It does not prove that the host clip object
 * is the same object (E224).
 */
import { createHash } from 'node:crypto';

import { canonicalJson } from '../document/json.js';
import {
  clip as clipAt, clipMetadata as clipMetadataAt, notes as notesAt, scene as sceneAt,
  slot as slotAt, track as trackAt, addressKey, type Address, type ClipAddress,
} from './address.js';
import { ContractError } from './errors.js';
import {
  contentTouching, deltaComplete, discontinuityBetween, uncoveredBetween,
  type ContentDelta, type ContentEvent, type UncoveredIn,
} from './observers.js';
import type { RevisionMark, Snapshot, WindowCoverage } from './snapshot.js';
import type { ClipMetadataState, NoteRecord } from './state.js';

export const CLIP_SOURCE_DOMAIN = 'ghostnote-launcher-source/1';
export const CLIP_SNAPSHOT_VERSION = 'ghostnote-clip-snapshot/1';
const TOKEN_PREFIX = 'gcs1.';

/** One raw host value: binary64, boolean, or text. */
export type RawSourceValue = number | boolean | string;
export type RawSourceRecord = Readonly<Record<string, RawSourceValue>>;

/**
 * The raw host state of one clip, as one read reported it.
 *
 * `clipMetadata` is the complete `cursor.clipMetadata` reply. `clipRead` is the
 * `bound` extent of the `clip.read` reply without its `channelId` and `row`:
 * the address is a typed field of the reference, not digest input. `notes` has
 * every raw field of every note, with disabled controls and raw binary64
 * values. Read IDs, timings, and callback counts are not part of a capture.
 */
export interface ClipSourceCapture {
  readonly clipMetadata: RawSourceRecord;
  readonly clipRead: RawSourceRecord;
  readonly notes: readonly RawSourceRecord[];
}

export interface ClipSourceDigest {
  readonly domain: typeof CLIP_SOURCE_DOMAIN;
  readonly sha256: string;
}

const ADDRESS_FIELDS = new Set(['channelId', 'row']);

/**
 * SHA-256 over the domain name, LF, and R26 canonical JSON of the capture.
 * Notes are in channel, cell, and pitch order.
 */
export function clipSourceFingerprint(capture: ClipSourceCapture): ClipSourceDigest {
  const order = (note: RawSourceRecord, field: string): number => {
    const value = note[field];
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      throw new ContractError(`clip source note field ${field} is not an integer`);
    }
    return value;
  };
  const notes = [...capture.notes].sort((left, right) =>
    order(left, 'channel') - order(right, 'channel')
    || order(left, 'cell') - order(right, 'cell')
    || order(left, 'pitch') - order(right, 'pitch'));
  const clipRead = Object.fromEntries(
    Object.entries(capture.clipRead).filter(([field]) => !ADDRESS_FIELDS.has(field)),
  );
  const body = canonicalJson({ clipMetadata: capture.clipMetadata, clipRead, notes });
  const sha256 = createHash('sha256').update(`${CLIP_SOURCE_DOMAIN}\n${body}`, 'utf8').digest('hex');
  return { domain: CLIP_SOURCE_DOMAIN, sha256 };
}

/** The opaque reference to one clip snapshot (D32). */
export interface ClipSnapshotRef {
  readonly version: typeof CLIP_SNAPSHOT_VERSION;
  readonly mark: RevisionMark;
  readonly channelId: string;
  readonly row: number;
  readonly source: ClipSourceDigest;
}

/** A reference and the clip content that it names. */
export interface ClipSnapshot {
  readonly ref: ClipSnapshotRef;
  readonly metadata: ClipMetadataState;
  /** All 16 MIDI channels, in channel order. Each list is in start and pitch order. */
  readonly channels: readonly (readonly NoteRecord[])[];
}

export type ClipSnapshotVerdict =
  | { readonly verdict: 'incomparable'; readonly ref: ClipSnapshotRef;
      readonly why: 'extension-restarted' | 'project-changed' }
  | { readonly verdict: 'uncovered'; readonly ref: ClipSnapshotRef; readonly uncoveredIn: UncoveredIn }
  | { readonly verdict: 'identity-changed'; readonly ref: ClipSnapshotRef;
      readonly why: 'scene-layout' | 'delta-incomplete' | 'slot-event';
      readonly events?: readonly ContentEvent[] }
  | { readonly verdict: 'absent'; readonly ref: ClipSnapshotRef;
      readonly why: 'unknown-track' | 'absent-clip' }
  | { readonly verdict: 'stale'; readonly ref: ClipSnapshotRef; readonly snapshot: ClipSnapshot }
  | { readonly verdict: 'current'; readonly ref: ClipSnapshotRef };

export type ClipSnapshotVerdictKind = ClipSnapshotVerdict['verdict'];

/** A batch refused before any host mutation, because a reference was not current. */
export class ClipSnapshotRefusedError extends ContractError {
  constructor(readonly verdicts: readonly ClipSnapshotVerdict[]) {
    super(`clip snapshot refused: ${verdicts
      .filter((item) => item.verdict !== 'current')
      .map((item) => `${item.ref.channelId} row ${item.ref.row} is ${item.verdict}`)
      .join('; ')}. Nothing was written.`);
  }
}

/** The clip address of a reference at one scene epoch. */
export function snapshotClip(ref: Pick<ClipSnapshotRef, 'channelId' | 'row'>, sceneEpoch: number): ClipAddress {
  return clipAt(slotAt(trackAt(ref.channelId), sceneAt(ref.row, sceneEpoch)));
}

/** Every address that a snapshot read needs: the clip, its metadata, and all 16 channels. */
export function snapshotAddresses(clip: ClipAddress): Address[] {
  return [clip, clipMetadataAt(clip), ...Array.from({ length: 16 }, (_, channel) => notesAt(clip, channel))];
}

/**
 * Rows 1 to 3 of the verdict table. They need the marks and the delta only.
 * `undefined` means that every guard holds.
 */
export function guardVerdict(
  ref: ClipSnapshotRef,
  now: RevisionMark,
  delta: ContentDelta | undefined,
): ClipSnapshotVerdict | undefined {
  const discontinuity = discontinuityBetween(ref.mark, now) ?? delta?.discontinuity;
  if (discontinuity !== undefined || delta?.discontinuous === true) {
    return { verdict: 'incomparable', ref, why: discontinuity ?? 'project-changed' };
  }
  const uncoveredIn = unionUncovered(uncoveredBetween(ref.mark, now), delta?.uncoveredIn);
  if (uncoveredIn !== undefined || delta?.uncovered === true) {
    return { verdict: 'uncovered', ref, uncoveredIn: uncoveredIn ?? 'both' };
  }
  if (now.sceneEpoch !== ref.mark.sceneEpoch || now.window.scenes.count !== ref.mark.window.scenes.count) {
    return { verdict: 'identity-changed', ref, why: 'scene-layout' };
  }
  if (delta === undefined) return undefined;
  if (!deltaComplete(delta)) return { verdict: 'identity-changed', ref, why: 'delta-incomplete' };
  const events = contentTouching(delta, snapshotClip(ref, ref.mark.sceneEpoch));
  if (events.length > 0) return { verdict: 'identity-changed', ref, why: 'slot-event', events };
  return undefined;
}

function unionUncovered(a: UncoveredIn | undefined, b: UncoveredIn | undefined): UncoveredIn | undefined {
  if (a === undefined) return b;
  if (b === undefined || a === b) return a;
  return 'both';
}

/**
 * The complete verdict for one reference, from a fresh read of its address and
 * the content delta since the reference mark (D32). The first row that matches
 * gives the verdict.
 *
 * `fresh` must hold the `snapshotAddresses` of the reference at `fresh.at`, and
 * the adapter must have captured the clip source. A missing capture of an
 * occupied clip is an adapter error; it never reads as current.
 *
 * `after` is a mark taken after the read and the delta. The read mark precedes
 * the read, and the delta has no scene fields, so only `after` sees a scene
 * change during the read. Without it, a compaction during the read can slide
 * another clip into the row with no event for the slot (8h3e review).
 */
export function judgeClipSnapshot(
  ref: ClipSnapshotRef,
  fresh: Snapshot,
  delta: ContentDelta,
  after?: RevisionMark,
): ClipSnapshotVerdict {
  const guarded = guardVerdict(ref, fresh.at, delta)
    ?? (after === undefined ? undefined : guardVerdict(ref, after, delta));
  if (guarded !== undefined) return guarded;
  const clip = snapshotClip(ref, fresh.at.sceneEpoch);
  const key = addressKey(clip);
  const entry = fresh.entries[key];
  if (entry === undefined) {
    if (fresh.unreachable.some((address) => addressKey(address) === key)) {
      return { verdict: 'uncovered', ref, uncoveredIn: 'tracks' };
    }
    return { verdict: 'absent', ref, why: 'unknown-track' };
  }
  if (entry.value.of !== 'clip' || !entry.value.exists) return { verdict: 'absent', ref, why: 'absent-clip' };
  const snapshot = clipSnapshotFrom(fresh, clip);
  if (snapshot.ref.source.sha256 === ref.source.sha256) return { verdict: 'current', ref };
  return { verdict: 'stale', ref, snapshot };
}

/** Build the snapshot of one occupied clip from a read that holds its addresses and source. */
export function clipSnapshotFrom(read: Snapshot, clip: ClipAddress): ClipSnapshot {
  const key = addressKey(clip);
  const source = read.sources?.[key];
  if (source === undefined) {
    throw new ContractError(`the adapter did not capture the clip source of ${key}`);
  }
  const metadata = read.entries[addressKey(clipMetadataAt(clip))];
  if (metadata?.value.of !== 'clipMetadata') {
    throw new ContractError(`the snapshot read has no clip metadata for ${key}`);
  }
  const channels = Array.from({ length: 16 }, (_, channel) => {
    const value = read.entries[addressKey(notesAt(clip, channel))]?.value;
    if (value?.of !== 'notes') throw new ContractError(`the snapshot read has no notes for channel ${channel}`);
    return value.notes;
  });
  return {
    ref: {
      version: CLIP_SNAPSHOT_VERSION,
      mark: read.at,
      channelId: clip.slot.track.channelId,
      row: clip.slot.scene.index,
      source,
    },
    metadata: metadata.value.metadata,
    channels,
  };
}

/** Encode a reference as one opaque token. */
export function encodeClipSnapshotRef(ref: ClipSnapshotRef): string {
  return TOKEN_PREFIX + Buffer.from(canonicalJson(ref), 'utf8').toString('base64url');
}

/** Decode and validate a token. Any other shape refuses. */
export function decodeClipSnapshotRef(token: string): ClipSnapshotRef {
  const invalid = (detail: string): never => {
    throw new ContractError(`invalid clip snapshot reference: ${detail}`);
  };
  if (typeof token !== 'string' || !token.startsWith(TOKEN_PREFIX)) invalid('unknown token format');
  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(token.slice(TOKEN_PREFIX.length), 'base64url').toString('utf8'));
  } catch {
    return invalid('the token is not valid JSON');
  }
  return validateClipSnapshotRef(value, invalid);
}

function validateClipSnapshotRef(value: unknown, invalid: (detail: string) => never): ClipSnapshotRef {
  const record = (input: unknown, path: string, keys: readonly string[]): Record<string, unknown> => {
    if (input === null || typeof input !== 'object' || Array.isArray(input)) return invalid(`${path} is not an object`);
    const actual = Object.keys(input).sort();
    const expected = [...keys].sort();
    if (actual.join() !== expected.join()) invalid(`${path} has fields ${actual.join(',')}`);
    return input as Record<string, unknown>;
  };
  const integer = (input: unknown, path: string, min: number): number => {
    if (typeof input !== 'number' || !Number.isSafeInteger(input) || input < min) invalid(`${path} is not an integer`);
    return input as number;
  };
  const text = (input: unknown, path: string): string => {
    if (typeof input !== 'string') invalid(`${path} is not text`);
    return input as string;
  };
  const coverage = (input: unknown, path: string): WindowCoverage => {
    const c = record(input, path, ['count', 'bankSize']);
    return { count: integer(c['count'], `${path}.count`, -1), bankSize: integer(c['bankSize'], `${path}.bankSize`, 0) };
  };
  const top = record(value, 'reference', ['version', 'mark', 'channelId', 'row', 'source']);
  if (top['version'] !== CLIP_SNAPSHOT_VERSION) invalid('unknown version');
  const mark = record(top['mark'], 'mark',
    ['revision', 'sceneEpoch', 'contentEpoch', 'generation', 'project', 'window']);
  const window = record(mark['window'], 'mark.window', ['tracks', 'scenes']);
  const source = record(top['source'], 'source', ['domain', 'sha256']);
  if (source['domain'] !== CLIP_SOURCE_DOMAIN) invalid('unknown source domain');
  const sha256 = text(source['sha256'], 'source.sha256');
  if (!/^[0-9a-f]{64}$/.test(sha256)) invalid('source.sha256 is not a SHA-256 digest');
  const channelId = text(top['channelId'], 'channelId');
  if (channelId === '') invalid('channelId is empty');
  return {
    version: CLIP_SNAPSHOT_VERSION,
    mark: {
      revision: integer(mark['revision'], 'mark.revision', 0),
      sceneEpoch: integer(mark['sceneEpoch'], 'mark.sceneEpoch', 0),
      contentEpoch: integer(mark['contentEpoch'], 'mark.contentEpoch', 0),
      generation: text(mark['generation'], 'mark.generation'),
      project: text(mark['project'], 'mark.project'),
      window: {
        tracks: coverage(window['tracks'], 'mark.window.tracks'),
        scenes: coverage(window['scenes'], 'mark.window.scenes'),
      },
    },
    channelId,
    row: integer(top['row'], 'row', 0),
    source: { domain: CLIP_SOURCE_DOMAIN, sha256 },
  };
}
