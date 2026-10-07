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
 * restores those host defaults. It does not use the portable defaults.
 */
import type { ClipSnapshot } from '../contract/clip-snapshot.js';
import type { NoteRecord } from '../contract/state.js';
import {
  contentHash, LIMITS, serialize, type Coverage, type Encoding, type ImportReport, type StateDocument,
} from '../document/index.js';
import { binary64, spelling } from '../document/rational.js';
import { projectRawClip, type RawNote } from './ghostnote-document.js';
import { cellKey, type AcquisitionBoundary, type CellKey } from './identity-registry.js';

/** The note fields that the reader always reports. A note without one is a partial read. */
const ALWAYS_READ = ['releaseVelocity', 'isChanceEnabled', 'isOccurrenceEnabled', 'isRecurrenceEnabled'] as const;

/** Host defaults of a new note, as `readerNote` omits them. */
const HOST_DEFAULTS = {
  velocitySpread: 0, gain: 0, pan: 0, pressure: 0, timbre: 0, transpose: 0, chance: 1,
  occurrence: 'ALWAYS', recurrence: [1, 1] as const,
};

/** Clip fields that this read does not cover. The read has no play-stop marker. */
export const UNCOVERED_CLIP_FIELDS = ['playRange'] as const;
/** Event fields with no measured host mapping (HOST-BINDING.md). */
export const UNCOVERED_EVENT_FIELDS = ['articulation', 'repeat'] as const;

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
}

/** Project the snapshot with assigned IDs. `eventIds` follows `launcherClipCells` order. */
export function projectLauncherClip(
  snapshot: ClipSnapshot,
  clipId: string,
  eventIds: readonly string[],
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
  const { document, report } = projectRawClip(clip, notes);
  // Complete coverage needs no reason; the read wrapper states the uncovered fields.
  const coverage = document.coverage.map(({ reason: _reason, ...item }) => item);
  const projected: StateDocument = { ...document, coverage };
  return {
    document: projected,
    contentHash: contentHash(projected),
    coverage,
    boundary: { plane: 'D23-1/512-cell', channels: 16, from: '0', to: length },
    loss: lossFacts(report),
    notesPastLength: located.filter((item) => item.note.startBeats + item.note.durationBeats > metadata.lengthBeats).length,
  };
}

/** Serialize a projection in the requested encoding. */
export function encodeLauncherClip(document: StateDocument, encoding: Encoding): string {
  return serialize(document, encoding);
}

export { cellKey };
