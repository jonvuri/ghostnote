/**
 * Project one D32 clip snapshot to a Document 1.0 snapshot (8h4b).
 *
 * The input is one fresh cold read on all 16 channels (`ClipSnapshot`). The
 * output uses `projectRawClip` and the reference codec. The reader gives each
 * note at its 1/512-beat cell (D23, D31); the codec floors any finer onset and
 * rounds each duration to a cell, and the import report keeps both deltas.
 *
 * The reader omits a note field that equals the default of a new host note,
 * except release velocity and the four enable flags (`readerNote`). This module
 * restores those raw host defaults. `projectRawClip` then maps raw values to
 * portable values: gain by the E245 cube law, and an enabled control with a
 * neutral value to the portable default. A new host note therefore has no
 * non-default field (8h4b2). The uncovered fields (articulation, repeat, and
 * playRange) are stated in the `read_launcher_clip` description.
 */
import type { ClipSnapshot } from '../contract/clip-snapshot.js';
import type { NoteRecord } from '../contract/state.js';
import {
  contentHash, LIMITS, serialize, type Coverage, type Encoding, type ImportReport, type Overlay, type StateDocument,
} from '../document/index.js';
import { binary64, spelling } from '../document/rational.js';
import { normalizedContentHash } from '../document/semantic.js';
import { projectRawClip, type RawNote } from './ghostnote-document.js';
import { cellKey, type AcquisitionBoundary, type CellKey, type StoredEnvelope } from './identity-registry.js';
import { carryOverlays, type CarriedOverlays } from './overlay-carry.js';

/** The note fields that the reader always reports. A note without one is a partial read. */
const ALWAYS_READ = ['releaseVelocity', 'isChanceEnabled', 'isOccurrenceEnabled', 'isRecurrenceEnabled'] as const;

/** Host defaults of a new note, as `readerNote` omits them. */
const HOST_DEFAULTS = {
  velocitySpread: 0, gain: 0, pan: 0, pressure: 0, timbre: 0, transpose: 0, chance: 1,
  occurrence: 'ALWAYS', recurrence: [1, 1] as const,
};

/** A clip that the portable model cannot hold without consolidation (E129). */
export interface RangeDiagnostic {
  readonly localRange: { readonly fromBeats: 0; readonly toBeats: number };
  readonly loopRange: { readonly fromBeats: number; readonly toBeats: number };
  readonly noteContentRange: { readonly fromBeats: number; readonly toBeats: number } | null;
  readonly remediation: string;
}

export class LauncherClipReadError extends Error {
  constructor(
    readonly code: 'range' | 'partial' | 'outside-limit' | 'unavailable' | 'collision',
    message: string,
    readonly detail?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = 'LauncherClipReadError';
  }
}

export const CONSOLIDATE_REMEDIATION = 'Select this clip in Bitwig and use Consolidate. Then read the clip again.';

interface Located {
  readonly channel: number;
  readonly note: NoteRecord;
  readonly key: CellKey;
}

/** All notes of the snapshot in channel, cell, and pitch order, with their cell addresses. */
function locate(snapshot: ClipSnapshot): Located[] {
  if (snapshot.channels.length !== 16) {
    throw new LauncherClipReadError('partial', 'The read did not cover all 16 MIDI channels.');
  }
  const located = snapshot.channels.flatMap((notes, channel) => notes.map((note) => ({
    channel, note, key: { channel, pitch: note.pitch, cell: Math.floor(note.startBeats * 512) },
  })));
  if (located.length > LIMITS.events) {
    throw new LauncherClipReadError('outside-limit', `The clip has more than ${LIMITS.events} notes.`);
  }
  return located.sort((a, b) => a.key.channel - b.key.channel || a.key.cell - b.key.cell || a.key.pitch - b.key.pitch);
}

/** The range diagnostic, or `undefined` when the stored notes fit the local clip range. */
export function launcherClipRange(snapshot: ClipSnapshot): RangeDiagnostic | undefined {
  const { metadata } = snapshot;
  const notes = snapshot.channels.flat();
  const lengthBeats = metadata.lengthBeats;
  const incompatible = metadata.loopStartBeats !== 0
    || notes.some((note) => note.startBeats < 0 || note.startBeats >= lengthBeats);
  if (!incompatible) return undefined;
  return {
    localRange: { fromBeats: 0, toBeats: lengthBeats },
    loopRange: { fromBeats: metadata.loopStartBeats, toBeats: metadata.loopEndBeats },
    noteContentRange: notes.length === 0 ? null : {
      fromBeats: Math.min(...notes.map((note) => note.startBeats)),
      toBeats: Math.max(...notes.map((note) => note.startBeats + note.durationBeats)),
    },
    remediation: CONSOLIDATE_REMEDIATION,
  };
}

/**
 * The cell addresses of the snapshot, in document order. Refuses a range that
 * needs consolidation, a partial note, and a clip outside the reader limits.
 */
export function launcherClipCells(snapshot: ClipSnapshot): CellKey[] {
  if (!(snapshot.metadata.lengthBeats > 0) || !Number.isFinite(snapshot.metadata.lengthBeats)) {
    throw new LauncherClipReadError('unavailable', 'The clip has no positive loop length.');
  }
  const range = launcherClipRange(snapshot);
  if (range !== undefined) {
    throw new LauncherClipReadError('range', 'The stored notes or the loop start are outside the local clip '
      + `range [0, ${snapshot.metadata.lengthBeats}) beats. ${CONSOLIDATE_REMEDIATION}`, { range });
  }
  const located = locate(snapshot);
  for (const { note } of located) {
    const missing = ALWAYS_READ.filter((field) => note[field] === undefined);
    if (missing.length > 0) {
      throw new LauncherClipReadError('partial', `The read did not report ${missing.join(', ')} for a note.`);
    }
  }
  const seen = new Map<string, number>();
  const collisions: CellKey[] = [];
  for (const { key } of located) {
    const text = cellKey(key);
    seen.set(text, (seen.get(text) ?? 0) + 1);
    if (seen.get(text) === 2) collisions.push(key);
  }
  if (collisions.length > 0) {
    throw new LauncherClipReadError('collision', 'Two or more host notes normalize to one channel, pitch, and '
      + '1/512-beat cell. The document cannot hold both.', {
      collisions: collisions.slice(0, 64).map((key) => ({ channel: key.channel + 1, pitch: key.pitch, at: `${key.cell}/512` })),
    });
  }
  return located.map((item) => item.key);
}

function rawNote(id: string, channel: number, note: NoteRecord): RawNote {
  const recurrence = note.recurrence ?? HOST_DEFAULTS.recurrence;
  return {
    id,
    channel,
    at: note.startBeats,
    duration: note.durationBeats,
    pitch: note.pitch,
    velocity: note.velocity,
    mute: note.isMuted === true,
    releaseVelocity: note.releaseVelocity!,
    expression: {
      velocitySpread: note.velocitySpread ?? HOST_DEFAULTS.velocitySpread,
      gain: note.gain ?? HOST_DEFAULTS.gain,
      pan: note.pan ?? HOST_DEFAULTS.pan,
      pressure: note.pressure ?? HOST_DEFAULTS.pressure,
      timbre: note.timbre ?? HOST_DEFAULTS.timbre,
      transpose: note.transpose ?? HOST_DEFAULTS.transpose,
    },
    chance: { enabled: note.isChanceEnabled === true, value: note.chance ?? HOST_DEFAULTS.chance },
    occurrence: { enabled: note.isOccurrenceEnabled === true, condition: note.occurrence ?? HOST_DEFAULTS.occurrence },
    recurrence: { enabled: note.isRecurrenceEnabled === true, length: recurrence[0], mask: recurrence[1] },
  };
}

/** D23 loss facts from the import report. Conversion itself adds no loss. */
export interface LossFacts {
  readonly boundary: 'D23-1/512-cell';
  /** The reader reports each onset at its cell. A finer source onset before the read is not observable. */
  readonly sourceOnsets: 'cell-observed';
  readonly onsetsMoved: number;
  readonly durationsRounded: number;
  readonly minimumDurationPromotions: number;
  readonly changedOverlaps: number;
  /** D23 cannot see several source notes in one cell. */
  readonly collisionCount: 'unknown';
  readonly events?: readonly { readonly id: string; readonly atDelta: string; readonly durationDelta: string }[];
}

function lossFacts(report: ImportReport): LossFacts {
  const moved = report.notes.filter((note) => note.atDelta !== '0' || note.durationDelta !== '0');
  return {
    boundary: 'D23-1/512-cell',
    sourceOnsets: 'cell-observed',
    onsetsMoved: report.notes.filter((note) => note.atDelta !== '0').length,
    durationsRounded: report.notes.filter((note) => note.durationDelta !== '0').length,
    minimumDurationPromotions: report.notes.filter((note) => note.minimumDurationPromotion).length,
    changedOverlaps: report.changedOverlaps.length,
    collisionCount: 'unknown',
    ...(moved.length === 0 ? {} : {
      events: moved.slice(0, 64).map((note) => ({ id: note.id, atDelta: note.atDelta, durationDelta: note.durationDelta })),
    }),
  };
}

export interface LauncherClipProjection {
  readonly document: StateDocument;
  readonly contentHash: string;
  readonly coverage: readonly Coverage[];
  readonly boundary: AcquisitionBoundary;
  readonly loss: LossFacts;
  /** Notes whose end is after the clip length. Valid in the document; the host writer refuses them. */
  readonly notesPastLength: number;
  /** The carry of stored overlays, when the clip had any (8h4c). */
  readonly overlays?: CarriedOverlays;
}

/**
 * Project the snapshot with assigned IDs. `eventIds` follows `launcherClipCells` order. `priorOverlays` are the
 * stored overlays of the clip ID; the projection carries them under the overlay lifecycle rules. `envelope` is
 * the stored META and EXTENSIONS.
 */
export function projectLauncherClip(
  snapshot: ClipSnapshot,
  clipId: string,
  eventIds: readonly string[],
  priorOverlays: readonly Overlay[] = [],
  envelope: StoredEnvelope = {},
): LauncherClipProjection {
  // 8h4g: an edit projects its fresh read again to check the base (R27). When the D32 source digest, the IDs, the
  // overlays, and the envelope are the inputs of the last projection, the result is the same; reuse it. The
  // source digest covers the clip metadata and every raw note field. The memo holds one frozen projection.
  const source = snapshot.ref?.source?.sha256;
  if (typeof source !== 'string') return projectOnce(snapshot, clipId, eventIds, priorOverlays, envelope);
  const key = { source, clipId, eventIds, extra: JSON.stringify([priorOverlays, envelope]) };
  const last = lastProjection;
  if (last !== undefined && last.key.source === key.source && last.key.clipId === clipId && last.key.extra === key.extra
      && last.key.eventIds.length === eventIds.length && last.key.eventIds.every((id, index) => id === eventIds[index])) {
    return last.projection;
  }
  const projection = deepFreeze(projectOnce(snapshot, clipId, eventIds, priorOverlays, envelope));
  lastProjection = { key: { ...key, eventIds: [...eventIds] }, projection };
  return projection;
}

let lastProjection: {
  readonly key: { readonly source: string; readonly clipId: string; readonly eventIds: readonly string[]; readonly extra: string };
  readonly projection: LauncherClipProjection;
} | undefined;

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value)) deepFreeze(item);
  }
  return value;
}

function projectOnce(
  snapshot: ClipSnapshot,
  clipId: string,
  eventIds: readonly string[],
  priorOverlays: readonly Overlay[],
  envelope: StoredEnvelope,
): LauncherClipProjection {
  const located = locate(snapshot);
  if (eventIds.length !== located.length) throw new Error('one event ID is needed for each acquired note');
  const { metadata } = snapshot;
  const length = spelling(binary64(metadata.lengthBeats));
  const clip: StateDocument['clips'][number] = {
    id: clipId,
    length,
    name: metadata.name,
    loop: metadata.loopEnabled ? { from: '0', to: length } : null,
  };
  const notes = located.map((item, index) => rawNote(eventIds[index]!, item.channel, item.note));
  // Complete coverage needs no reason; the read wrapper states the uncovered fields.
  const { document, report } = projectRawClip(clip, notes, { reason: false });
  const coverage = document.coverage;
  const plain = envelope.meta === undefined && envelope.extensions === undefined;
  const bare: StateDocument = plain ? document : { ...document, ...envelope };
  const overlays = priorOverlays.length === 0 ? undefined : carryOverlays(priorOverlays, bare);
  const projected: StateDocument = overlays === undefined ? bare : { ...bare, overlays: overlays.overlays };
  return {
    document: projected,
    // A projection without envelope or overlays is the validated document itself (8h4g: one validation).
    contentHash: projected === document ? normalizedContentHash(document) : contentHash(projected),
    coverage,
    boundary: { plane: 'D23-1/512-cell', channels: 16, from: '0', to: length },
    loss: lossFacts(report),
    notesPastLength: located.filter((item) => item.note.startBeats + item.note.durationBeats > metadata.lengthBeats).length,
    ...(overlays === undefined ? {} : { overlays }),
  };
}

/** Serialize a projection in the requested encoding. */
export function encodeLauncherClip(document: StateDocument, encoding: Encoding): string {
  return serialize(document, encoding);
}

export { cellKey };
