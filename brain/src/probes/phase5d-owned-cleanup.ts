import type { NoteRecord } from '../contract/index.js';

export interface CleanupCell {
  readonly trackId: string;
  readonly trackIndex: number;
  readonly row: number;
}

export interface OwnedClip {
  readonly source: CleanupCell;
  readonly destination?: CleanupCell;
  readonly fingerprint: readonly NoteRecord[];
}

export interface OwnedClipCleanupPort {
  hasContent(cell: CleanupCell): Promise<boolean>;
  readNotes(cell: CleanupCell): Promise<readonly NoteRecord[]>;
  move(source: CleanupCell, destination: CleanupCell): Promise<void>;
  remove(cell: CleanupCell): Promise<void>;
}

function noteOrder(a: NoteRecord, b: NoteRecord): number {
  return a.startBeats - b.startBeats || a.pitch - b.pitch;
}

export function canonicalNotes(value: readonly NoteRecord[]): string {
  return JSON.stringify([...value].sort(noteOrder));
}

/** Store an immutable cleanup fingerprint before later setup work can fail. */
export function ownClip(
  source: CleanupCell,
  fingerprint: readonly NoteRecord[],
  destination?: CleanupCell,
): OwnedClip {
  return {
    source: { ...source },
    ...(destination === undefined ? {} : { destination: { ...destination } }),
    fingerprint: fingerprint.map((item) => ({ ...item })),
  };
}

/** Move an owned drag clip home, verify its exact fingerprint, and remove it. */
export async function removeOwnedClip(
  owned: OwnedClip,
  port: OwnedClipCleanupPort,
): Promise<void> {
  let sourceHas = await port.hasContent(owned.source);
  let destinationHas = owned.destination === undefined
    ? false
    : await port.hasContent(owned.destination);

  if (!sourceHas && destinationHas && owned.destination !== undefined) {
    await port.move(owned.destination, owned.source);
    sourceHas = await port.hasContent(owned.source);
    destinationHas = await port.hasContent(owned.destination);
  }
  if (!sourceHas || destinationHas) {
    throw new Error('the owned clip is not at its source alone');
  }

  const observed = await port.readNotes(owned.source);
  if (canonicalNotes(observed) !== canonicalNotes(owned.fingerprint)) {
    throw new Error('the owned clip fingerprint changed; cleanup refuses to delete it');
  }

  await port.remove(owned.source);
  if (await port.hasContent(owned.source)
      || (owned.destination !== undefined && await port.hasContent(owned.destination))) {
    throw new Error('the owned clip remains after cleanup');
  }
}
