/** E131 diagnostic control. Product reads use clip.read. */
import { AddressUnresolvedError, type AddressKey, type ClipAddress, type ClipMetadataState, type NoteRecord, type SettleBudget } from '../contract/index.js';
import { decodeVerboseNote } from '../adapters/live/encoder.js';
import { WIRE } from '../adapters/live/wiremap.js';
import type { Transport } from '../adapters/live/transport.js';
type ClipNoteChannels = ReadonlyMap<number, readonly NoteRecord[]>;
export interface E131Context {
  readonly steps: number;
  readonly transport: Transport;
  pointAtClip(clip: ClipAddress, trackIndex: number, pointedAt: Map<string, AddressKey>, cursor: string): Promise<unknown>;
  readClipMetadata(clip: ClipAddress, trackIndex: number, pointedAt: Map<string, AddressKey>, cursor: string): Promise<{ metadata: ClipMetadataState; playStopBeats: number }>;
  settle(budget: SettleBudget): Promise<void>;
  timed<T>(phase: string, run: () => Promise<T>): Promise<T>;
}
/** Join two lossy grid views without dropping a note that only one view reports. */
export function reconcileExactNoteScans(
  clipRef: ClipAddress,
  channel: number,
  binary: readonly NoteRecord[],
  triplet: readonly NoteRecord[],
  maximumStartDifference = 1 / 48,
): readonly NoteRecord[] {
  const byPitch = (notes: readonly NoteRecord[]): ReadonlyMap<number, readonly NoteRecord[]> => {
    const grouped = new Map<number, NoteRecord[]>();
    for (const note of notes) {
      const found = grouped.get(note.pitch) ?? [];
      found.push(note);
      grouped.set(note.pitch, found);
    }
    for (const found of grouped.values()) found.sort((left, right) => left.startBeats - right.startBeats);
    return grouped;
  };
  const body = (note: NoteRecord): string => {
    const { startBeats: _start, ...fields } = note;
    return JSON.stringify(fields);
  };
  const left = byPitch(binary);
  const right = byPitch(triplet);
  const pitches = new Set([...left.keys(), ...right.keys()]);
  const result: NoteRecord[] = [];
  for (const pitch of pitches) {
    const binaryPitch = left.get(pitch) ?? [];
    const tripletPitch = right.get(pitch) ?? [];
    const unusedTriplet = new Set(tripletPitch.map((_, index) => index));
    const unmatchedBinary: NoteRecord[] = [];
    for (const binaryNote of binaryPitch) {
      const matched = [...unusedTriplet]
        .filter((index) => body(binaryNote) === body(tripletPitch[index]!))
        .map((index) => ({
          index,
          distance: Math.abs(binaryNote.startBeats - tripletPitch[index]!.startBeats),
        }))
        .filter((item) => item.distance <= maximumStartDifference)
        .sort((first, second) => first.distance - second.distance || first.index - second.index)[0];
      if (matched === undefined) {
        unmatchedBinary.push(binaryNote);
        continue;
      }
      unusedTriplet.delete(matched.index);
      const tripletNote = tripletPitch[matched.index]!;
      result.push({
        ...binaryNote,
        startBeats: Math.max(binaryNote.startBeats, tripletNote.startBeats),
      });
    }
    const unmatchedTriplet = [...unusedTriplet].map((index) => tripletPitch[index]!);
    const ambiguous = unmatchedBinary.some((binaryNote) => unmatchedTriplet.some((tripletNote) =>
      Math.abs(binaryNote.startBeats - tripletNote.startBeats) <= maximumStartDifference));
    if (ambiguous) {
      throw new AddressUnresolvedError(
        clipRef,
        `binary and triplet scans disagree on channel ${channel}, pitch ${pitch} note identity`,
      );
    }
    result.push(...unmatchedBinary, ...unmatchedTriplet);
  }
  return result.sort((leftNote, rightNote) =>
    leftNote.startBeats - rightNote.startBeats || leftNote.pitch - rightNote.pitch);
}

interface WireVerboseChannel {
  readonly channel: number;
  readonly notes: readonly Record<string, number | boolean | string>[];
  readonly count: number;
}

interface WireVerboseAllChannels {
  readonly channels: readonly WireVerboseChannel[];
  readonly count: number;
  readonly scanMicros: number;
  readonly clipExists?: boolean;
}

export async function readFineClipNotes(
    context: E131Context,
    clipRef: ClipAddress,
    trackIndex: number,
    pointedAt: Map<string, AddressKey>,
  ): Promise<ClipNoteChannels> {
    const cursor = 'fine';
    const steps = context.steps;
    if (cursor !== 'fine' || steps === undefined) {
      throw new AddressUnresolvedError(
        clipRef,
        'exact note read requires the dedicated fine cursor and its measured width',
      );
    }
    await context.timed('targetAcquisition', () =>
      context.pointAtClip(clipRef, trackIndex, pointedAt, cursor));
    const observed = await context.timed('metadata', () =>
      context.readClipMetadata(clipRef, trackIndex, pointedAt, cursor));
    const extent = Math.max(observed.playStopBeats, observed.metadata.loopEndBeats);
    const lengthBeats = extent > 0 ? extent : 4;
    const binaryStep = 1 / 512;
    const tripletStep = 1 / 768;
    const scan = async (stepSize: number): Promise<ReadonlyMap<number, readonly NoteRecord[]>> => {
      await context.transport.send({ method: WIRE.cursorSetStepSize, params: { cursor, stepSize } });
      const channels = new Map<number, NoteRecord[]>();
      for (let channel = 0; channel < 16; channel += 1) channels.set(channel, []);
      const totalSteps = Math.max(1, Math.ceil(lengthBeats / stepSize));
      let currentPageStart = 0;
      try {
        for (let pageStart = 0; pageStart < totalSteps; pageStart += steps) {
          currentPageStart = pageStart;
          await context.timed('pageTurn', () => context.transport.send({
            method: WIRE.cursorScrollToStep,
            params: { cursor, step: pageStart },
          }));
          // One full settlement covers the grid and page-zero transition. Later
          // pages keep the same measured budget. Neither transition has readback.
          await context.timed('gridSettlement', () => context.settle('gridChange'));
          const pageSteps = Math.min(steps, totalSteps - pageStart);
          const result = (await context.timed('bulkPageRead', () => context.transport.send({
            method: WIRE.cursorGetNotesVerboseAllChannels,
            params: { cursor, maxX: pageSteps },
          }))) as WireVerboseAllChannels;
          if (!Array.isArray(result.channels) || result.channels.length !== 16) {
            throw new AddressUnresolvedError(
              clipRef,
              'the bulk note reply did not return all 16 MIDI channels',
            );
          }
          const seen = new Set<number>();
          let returnedCount = 0;
          for (const returned of result.channels) {
            const channel = returned.channel;
            if (!Number.isInteger(channel) || channel < 0 || channel > 15 || seen.has(channel)
                || !Array.isArray(returned.notes) || returned.count !== returned.notes.length) {
              throw new AddressUnresolvedError(
                clipRef,
                'the bulk note reply returned an invalid or duplicate MIDI channel',
              );
            }
            seen.add(channel);
            returnedCount += returned.count;
            channels.get(channel)!.push(...returned.notes.map((note: Record<string, number | boolean | string>) => {
              const x = note['x'];
              if (typeof x !== 'number') {
                throw new AddressUnresolvedError(clipRef, 'a note step returned no numeric position');
              }
              return decodeVerboseNote({ ...note, x: x + pageStart }, stepSize);
            }));
          }
          if (result.count !== returnedCount || result.clipExists === false
              || !Number.isFinite(result.scanMicros) || result.scanMicros < 0) {
            throw new AddressUnresolvedError(
              clipRef,
              'the bulk note reply returned inconsistent page bounds or counts',
            );
          }
        }
      } finally {
        if (currentPageStart !== 0) {
          // The reader is shared across calls. Do not leak a nonzero page.
          await context.timed('pageReset', async () => {
            await context.transport.send({
              method: WIRE.cursorScrollToStep,
              params: { cursor, step: 0 },
            });
            await context.settle('gridChange');
          });
        }
      }
      return channels;
    };

    const binary = await scan(binaryStep);
    const triplet = await scan(tripletStep);
    return context.timed('reconciliation', async () => {
      const reconciled = new Map<number, readonly NoteRecord[]>();
      for (let channel = 0; channel < 16; channel += 1) {
        reconciled.set(channel, reconcileExactNoteScans(
          clipRef,
          channel,
          binary.get(channel) ?? [],
          triplet.get(channel) ?? [],
          Math.max(binaryStep, tripletStep),
        ));
      }
      return reconciled;
    });
  }
