/** Canonical complete note state for private symbolic consumers. */
import { createHash } from 'node:crypto';

import {
  CONTRACT_TAG, addressKey, clipMetadata, notes as notesAt, track,
  type BitwigAdapter, type ClipAddress, type ClipMetadataState, type NoteRecord,
  type RevisionMark, type Snapshot, type TrackState,
} from '../contract/index.js';

export const EXACT_NOTE_SOURCE_SCHEMA = 'ghostnote-exact-note-source-v0';
export const EXACT_NOTE_JSON_VERSION = 'exact-note-json-v0';
export const EXACT_NOTE_SOURCE_DOMAIN = 'exact-note-source-v0';
export const EXACT_NOTE_SOURCE_MAX_CLIPS = 16;
export const EXACT_NOTE_SOURCE_MAX_NOTES = 4_096;

export interface ExactNoteChannel {
  readonly channel: number;
  readonly notes: readonly NoteRecord[];
}

export interface ExactNoteClip {
  readonly address: ClipAddress;
  readonly track: TrackState;
  readonly clip: { readonly exists: true; readonly lengthBeats?: number };
  readonly metadata: ClipMetadataState;
  readonly channels: readonly ExactNoteChannel[];
}

export interface ExactNoteSourcePayload {
  readonly schema: typeof EXACT_NOTE_SOURCE_SCHEMA;
  readonly canonicalization: typeof EXACT_NOTE_JSON_VERSION;
  readonly source: {
    readonly kind: 'live-bitwig' | 'supplied-exact-state';
    readonly id: string;
    readonly permission: string;
  };
  readonly observedAt: RevisionMark;
  readonly coverage: {
    readonly requestedClipCount: number;
    readonly observedClipCount: number;
    readonly channelsPerClip: 16;
    readonly complete: true;
    readonly noteOnsetScope: 'complete-addressed-clips';
    readonly includesNotesExtendingBeyondClipEnd: true;
    readonly omittedFields: readonly [];
    readonly unavailableFields: readonly [];
  };
  readonly clips: readonly ExactNoteClip[];
}

export interface ExactNoteEventMapEntry {
  readonly id: string;
  readonly sourceSha256: string;
  readonly clip: ClipAddress;
  readonly channel: number;
  readonly pitch: number;
  readonly startBeats: number;
}

export interface ExactNoteTrackAlias {
  readonly alias: string;
  readonly trackId: string;
}

export interface ExactNoteSource extends ExactNoteSourcePayload {
  readonly digest: {
    readonly algorithm: 'sha256';
    readonly domain: typeof EXACT_NOTE_SOURCE_DOMAIN;
    readonly canonicalization: typeof EXACT_NOTE_JSON_VERSION;
    readonly value: string;
  };
  readonly aliases: readonly ExactNoteTrackAlias[];
  readonly eventMap: readonly ExactNoteEventMapEntry[];
}

export interface ExactNoteClipRangeDiagnostic {
  readonly clipAddress: string;
  readonly localRange: { readonly fromBeats: 0; readonly toBeats: number };
  readonly loopRange: { readonly fromBeats: number; readonly toBeats: number };
  readonly noteContentRange: {
    readonly fromBeats: number;
    readonly toBeats: number;
  } | null;
  readonly message: string;
}

export interface SnapshotExactSourceRequest {
  readonly snapshot: Snapshot;
  readonly clips: readonly ClipAddress[];
  readonly source: ExactNoteSourcePayload['source'];
  /** Supply the generation captured before acquisition to reject a restarted host. */
  readonly expectedGeneration?: string;
}

export interface ExactNoteAcquisition {
  readonly source: ExactNoteSource;
  readonly acquisitionMs: number;
  readonly canonicalizationAndHashMs: number;
}

export class ExactNoteSourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExactNoteSourceError';
  }
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function fail(message: string): never {
  throw new ExactNoteSourceError(message);
}

/** Rebuild a JSON value with UTF-16 key order and reject JSON data loss. */
function canonicalValue(value: unknown, path = 'source'): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail(`${path} must contain only finite numbers`);
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) {
    return Array.from({ length: value.length }, (_, index) => {
      if (!(index in value)) fail(`${path}.${index} must not be an array hole`);
      return canonicalValue(value[index], `${path}.${index}`);
    });
  }
  if (typeof value === 'object') {
    const bag = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(bag).sort(compareText)) {
      if (bag[key] === undefined) fail(`${path}.${key} must not be undefined`);
      output[key] = canonicalValue(bag[key], `${path}.${key}`);
    }
    return output;
  }
  return fail(`${path} contains unsupported ${typeof value} data`);
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalValue(value));
}

function canonicalClone<T>(value: T): T {
  return JSON.parse(canonicalJson(value)) as T;
}

function payloadOf(source: ExactNoteSource): ExactNoteSourcePayload {
  return {
    schema: source.schema,
    canonicalization: source.canonicalization,
    source: source.source,
    observedAt: source.observedAt,
    coverage: source.coverage,
    clips: source.clips,
  };
}

/** Serialize only the source payload. Derived aliases, IDs, and digest stay outside it. */
export function serializeExactNoteSource(source: ExactNoteSource): string {
  return canonicalJson(payloadOf(source));
}

function sourceDigest(payload: ExactNoteSourcePayload): string {
  return createHash('sha256').update(canonicalJson(payload), 'utf8').digest('hex');
}

function validateNote(note: NoteRecord, location: string): void {
  canonicalValue(note, location);
  if (!Number.isFinite(note.startBeats)) {
    fail(`${location}.startBeats must be a finite beat value`);
  }
  if (!Number.isInteger(note.pitch) || note.pitch < 0 || note.pitch > 127) {
    fail(`${location}.pitch must be a MIDI note from 0 through 127`);
  }
  if (!Number.isInteger(note.velocity) || note.velocity < 0 || note.velocity > 127) {
    fail(`${location}.velocity must be an integer from 0 through 127`);
  }
  if (!Number.isFinite(note.durationBeats) || note.durationBeats <= 0) {
    fail(`${location}.durationBeats must be a finite positive beat value`);
  }
}

const HOST_BEAT_COMPARISON_TOLERANCE = 1e-9;

/** Report when stored note coordinates do not fit the local editing range. */
export function exactNoteClipRangeDiagnostic(
  clip: ExactNoteClip,
): ExactNoteClipRangeDiagnostic | undefined {
  const notes = clip.channels.flatMap((channel) => channel.notes);
  const noteContentRange = notes.length === 0 ? null : {
    fromBeats: Math.min(...notes.map((note) => note.startBeats)),
    toBeats: Math.max(...notes.map((note) => note.startBeats + note.durationBeats)),
  };
  const lengthBeats = clip.metadata.lengthBeats;
  const incompatible = Math.abs(clip.metadata.loopStartBeats) > HOST_BEAT_COMPARISON_TOLERANCE
    || notes.some((note) => note.startBeats < 0
      || note.startBeats >= lengthBeats
      || note.startBeats + note.durationBeats > lengthBeats);
  if (!incompatible) return undefined;

  const clipAddress = addressKey(clip.address);
  const localRange = { fromBeats: 0 as const, toBeats: lengthBeats };
  const loopRange = {
    fromBeats: clip.metadata.loopStartBeats,
    toBeats: clip.metadata.loopEndBeats,
  };
  const noteRange = noteContentRange === null
    ? 'empty'
    : `[${noteContentRange.fromBeats}, ${noteContentRange.toBeats}] beats`;
  const message = `Clip ${clipAddress} requires consolidation. `
    + `Ghostnote local onset range: [0, ${lengthBeats}) beats; note ends must be at or before `
    + `${lengthBeats} beats. `
    + `Bitwig loop range: [${loopRange.fromBeats}, ${loopRange.toBeats}] beats. `
    + `Complete note-content range: ${noteRange}. `
    + 'Select this clip in Bitwig and use Consolidate. Then read the clip and preview '
    + 'the change again.';
  return { clipAddress, localRange, loopRange, noteContentRange, message };
}

function normalizedChannels(
  snapshot: Snapshot,
  clip: ClipAddress,
  clipIndex: number,
): readonly ExactNoteChannel[] {
  const channels: ExactNoteChannel[] = [];
  for (let channel = 0; channel < 16; channel += 1) {
    const address = notesAt(clip, channel);
    const entry = snapshot.entries[addressKey(address)];
    if (entry?.value.of !== 'notes') {
      fail(`clip ${clipIndex} MIDI channel ${channel} was not read completely`);
    }
    const notes = entry.value.notes.map((note, noteIndex) => {
      validateNote(note, `clips.${clipIndex}.channels.${channel}.notes.${noteIndex}`);
      return canonicalClone(note);
    }).sort((left, right) => left.startBeats - right.startBeats || left.pitch - right.pitch);
    const keys = new Set<string>();
    for (const note of notes) {
      const key = `${Object.is(note.startBeats, -0) ? 0 : note.startBeats}\0${note.pitch}`;
      if (keys.has(key)) {
        fail(`clip ${clipIndex} MIDI channel ${channel} has duplicate note key ${JSON.stringify(key)}`);
      }
      keys.add(key);
    }
    channels.push({ channel, notes });
  }
  return channels;
}

function requiredAddressFailure(snapshot: Snapshot, keys: ReadonlySet<string>): string | undefined {
  for (const [label, addresses] of [
    ['missing', snapshot.missing],
    ['unreachable', snapshot.unreachable],
    ['unstable', snapshot.unstable],
  ] as const) {
    const address = addresses.find((candidate) => keys.has(addressKey(candidate)));
    if (address !== undefined) return `${label} required address ${addressKey(address)}`;
  }
  return undefined;
}

function buildDerived(payload: ExactNoteSourcePayload, digest: string): {
  aliases: readonly ExactNoteTrackAlias[];
  eventMap: readonly ExactNoteEventMapEntry[];
} {
  const trackIds = [...new Set(payload.clips.map((clip) => clip.track.channelId))].sort(compareText);
  const aliases = trackIds.map((trackId, index) => ({ alias: `t-${index + 1}`, trackId }));
  const eventMap: ExactNoteEventMapEntry[] = [];
  for (const clip of payload.clips) {
    for (const channel of clip.channels) {
      for (const note of channel.notes) {
        eventMap.push({
          id: `e-${eventMap.length + 1}`,
          sourceSha256: digest,
          clip: clip.address,
          channel: channel.channel,
          pitch: note.pitch,
          startBeats: note.startBeats,
        });
      }
    }
  }
  return { aliases, eventMap };
}

/** Build the canonical wrapper from one complete multi-address snapshot. */
export function snapshotToExactSource(request: SnapshotExactSourceRequest): ExactNoteSource {
  if (request.snapshot.contract !== CONTRACT_TAG) fail('the snapshot contract is not ghostnote/0');
  if (request.source.id.length === 0) fail('the source ID must not be empty');
  if (request.source.permission.length === 0) fail('the permission basis must not be empty');
  if (request.clips.length === 0) fail('at least one clip address is required');
  if (request.clips.length > EXACT_NOTE_SOURCE_MAX_CLIPS) {
    fail(`the exact source limit is ${EXACT_NOTE_SOURCE_MAX_CLIPS} clips`);
  }
  if (request.expectedGeneration !== undefined
      && request.expectedGeneration !== request.snapshot.at.generation) {
    fail('the snapshot generation changed during exact-source acquisition');
  }

  const clipKeys = request.clips.map(addressKey);
  if (new Set(clipKeys).size !== clipKeys.length) fail('clip addresses must be unique');
  const sortedAddresses = [...request.clips].sort((left, right) =>
    compareText(canonicalJson(left), canonicalJson(right)));
  const requiredKeys = new Set<string>();
  for (const address of sortedAddresses) {
    requiredKeys.add(addressKey(address));
    requiredKeys.add(addressKey(track(address.slot.track.channelId)));
    requiredKeys.add(addressKey(clipMetadata(address)));
    for (let channel = 0; channel < 16; channel += 1) {
      requiredKeys.add(addressKey(notesAt(address, channel)));
    }
    if (address.slot.scene.epoch !== request.snapshot.at.sceneEpoch) {
      fail(`clip address ${addressKey(address)} has a stale scene epoch`);
    }
  }
  const addressFailure = requiredAddressFailure(request.snapshot, requiredKeys);
  if (addressFailure !== undefined) fail(addressFailure);

  const clips = sortedAddresses.map((address, clipIndex): ExactNoteClip => {
    const trackEntry = request.snapshot.entries[addressKey(track(address.slot.track.channelId))];
    if (trackEntry?.value.of !== 'track'
        || trackEntry.value.track.channelId !== address.slot.track.channelId) {
      fail(`clip ${clipIndex} track state was not read exactly`);
    }
    const clipEntry = request.snapshot.entries[addressKey(address)];
    if (clipEntry?.value.of !== 'clip' || !clipEntry.value.exists) {
      fail(`clip ${clipIndex} does not exist in the complete snapshot`);
    }
    const metadataEntry = request.snapshot.entries[addressKey(clipMetadata(address))];
    if (metadataEntry?.value.of !== 'clipMetadata') {
      fail(`clip ${clipIndex} metadata was not read exactly`);
    }
    if (clipEntry.value.lengthBeats !== undefined
        && clipEntry.value.lengthBeats !== metadataEntry.value.metadata.lengthBeats) {
      fail(`clip ${clipIndex} length and metadata length disagree`);
    }
    const channels = normalizedChannels(request.snapshot, address, clipIndex);
    return canonicalClone({
      address,
      track: trackEntry.value.track,
      clip: {
        exists: true as const,
        ...(clipEntry.value.lengthBeats === undefined
          ? {} : { lengthBeats: clipEntry.value.lengthBeats }),
      },
      metadata: metadataEntry.value.metadata,
      channels,
    });
  });
  const noteCount = clips.reduce((total, clip) => total
    + clip.channels.reduce((channelTotal, channel) => channelTotal + channel.notes.length, 0), 0);
  if (noteCount > EXACT_NOTE_SOURCE_MAX_NOTES) {
    fail(`the exact source limit is ${EXACT_NOTE_SOURCE_MAX_NOTES} notes`);
  }

  const payload = canonicalClone<ExactNoteSourcePayload>({
    schema: EXACT_NOTE_SOURCE_SCHEMA,
    canonicalization: EXACT_NOTE_JSON_VERSION,
    source: request.source,
    observedAt: request.snapshot.at,
    coverage: {
      requestedClipCount: request.clips.length,
      observedClipCount: clips.length,
      channelsPerClip: 16,
      complete: true,
      noteOnsetScope: 'complete-addressed-clips',
      includesNotesExtendingBeyondClipEnd: true,
      omittedFields: [],
      unavailableFields: [],
    },
    clips,
  });
  const digest = sourceDigest(payload);
  const derived = buildDerived(payload, digest);
  return {
    ...payload,
    digest: {
      algorithm: 'sha256', domain: EXACT_NOTE_SOURCE_DOMAIN,
      canonicalization: EXACT_NOTE_JSON_VERSION, value: digest,
    },
    ...derived,
  };
}

/** Validate source identity and all derived source-scoped maps before use. */
export function validateExactNoteSource(source: ExactNoteSource): void {
  const payload = payloadOf(source);
  canonicalValue(payload);
  if (payload.schema !== EXACT_NOTE_SOURCE_SCHEMA
      || payload.canonicalization !== EXACT_NOTE_JSON_VERSION) {
    fail('the exact-note source schema or canonicalization version is unsupported');
  }
  if (!payload.coverage.complete || payload.coverage.channelsPerClip !== 16
      || payload.coverage.observedClipCount !== payload.clips.length
      || payload.coverage.requestedClipCount !== payload.clips.length) {
    fail('the exact-note source coverage is incomplete');
  }
  for (const [clipIndex, clip] of payload.clips.entries()) {
    if (clip.address.slot.scene.epoch !== payload.observedAt.sceneEpoch) {
      fail(`clip ${clipIndex} address has a stale scene epoch`);
    }
    if (clip.address.slot.track.channelId !== clip.track.channelId) {
      fail(`clip ${clipIndex} address and track state disagree`);
    }
    if (clip.channels.length !== 16
        || clip.channels.some((channel, index) => channel.channel !== index)) {
      fail(`clip ${clipIndex} does not contain ordered complete channel coverage`);
    }
    for (const [channelIndex, channel] of clip.channels.entries()) {
      const keys = new Set<string>();
      for (const [noteIndex, note] of channel.notes.entries()) {
        validateNote(note, `clips.${clipIndex}.channels.${channelIndex}.notes.${noteIndex}`);
        const key = `${Object.is(note.startBeats, -0) ? 0 : note.startBeats}\0${note.pitch}`;
        if (keys.has(key)) fail(`clip ${clipIndex} MIDI channel ${channelIndex} has duplicate notes`);
        keys.add(key);
      }
    }
  }
  const digest = sourceDigest(payload);
  if (source.digest.algorithm !== 'sha256'
      || source.digest.domain !== EXACT_NOTE_SOURCE_DOMAIN
      || source.digest.canonicalization !== EXACT_NOTE_JSON_VERSION
      || source.digest.value !== digest) {
    fail('the exact-note source digest does not match its canonical payload');
  }
  const derived = buildDerived(payload, digest);
  if (canonicalJson(source.aliases) !== canonicalJson(derived.aliases)
      || canonicalJson(source.eventMap) !== canonicalJson(derived.eventMap)) {
    fail('the exact-note source alias or event map is stale');
  }
}

/** Read complete clip state while the adapter preserves the user's selection. */
export async function readExactNoteSource(
  adapter: BitwigAdapter,
  request: Omit<SnapshotExactSourceRequest, 'snapshot'>,
  now: () => number = () => performance.now(),
): Promise<ExactNoteAcquisition> {
  const requestedAddresses = request.clips.flatMap((address) => [
    track(address.slot.track.channelId),
    address,
    clipMetadata(address),
    ...Array.from({ length: 16 }, (_, channel) => notesAt(address, channel)),
  ]);
  const addresses = [...new Map(requestedAddresses.map((address) => [
    addressKey(address), address,
  ])).values()];
  const acquisitionStart = now();
  const snapshot = await adapter.preserveSelection(() => adapter.read(addresses));
  const acquisitionMs = now() - acquisitionStart;
  const canonicalStart = now();
  const source = snapshotToExactSource({ ...request, snapshot });
  return {
    source,
    acquisitionMs,
    canonicalizationAndHashMs: now() - canonicalStart,
  };
}
