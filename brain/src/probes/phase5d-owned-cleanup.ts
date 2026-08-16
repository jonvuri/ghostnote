import type { NoteRecord } from '../contract/index.js';

export interface CleanupCell {
  readonly trackId: string;
  readonly trackIndex: number;
  readonly row: number;
}

export interface OwnedClip {
  readonly source: CleanupCell;
  readonly destination?: CleanupCell;
  readonly creationFingerprint: readonly NoteRecord[];
  readonly exactFingerprint?: readonly NoteRecord[];
}

export interface OwnedClipCleanupPort {
  hasContent(cell: CleanupCell): Promise<boolean>;
  readNotes(cell: CleanupCell): Promise<readonly NoteRecord[]>;
  move(source: CleanupCell, destination: CleanupCell): Promise<void>;
  remove(cell: CleanupCell): Promise<void>;
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, canonicalValue(item)]));
  }
  return value;
}

export function canonicalNotes(value: readonly NoteRecord[]): string {
  return JSON.stringify(value.map((note) => canonicalValue(note))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
}

function cloneValue(value: unknown): unknown {
  if (Array.isArray(value)) return Object.freeze(value.map(cloneValue));
  if (value !== null && typeof value === 'object') {
    return Object.freeze(Object.fromEntries(Object.entries(value)
      .map(([key, item]) => [key, cloneValue(item)])));
  }
  return value;
}

function cloneNotes(value: readonly NoteRecord[]): readonly NoteRecord[] {
  return Object.freeze(value.map((note) => cloneValue(note) as NoteRecord));
}

function authoredNoteMatches(authored: NoteRecord, observed: NoteRecord): boolean {
  const actual = observed as unknown as Readonly<Record<string, unknown>>;
  return Object.entries(authored).every(([key, expected]) =>
    JSON.stringify(canonicalValue(actual[key])) === JSON.stringify(canonicalValue(expected)));
}

function creationMatches(
  authored: readonly NoteRecord[],
  observed: readonly NoteRecord[],
): boolean {
  if (authored.length !== observed.length) return false;
  const unmatched = [...observed];
  return authored.every((wanted) => {
    const index = unmatched.findIndex((actual) => authoredNoteMatches(wanted, actual));
    if (index < 0) return false;
    unmatched.splice(index, 1);
    return true;
  });
}

/** Store an immutable cleanup fingerprint before later setup work can fail. */
export function ownClip(
  source: CleanupCell,
  creationFingerprint: readonly NoteRecord[],
  destination?: CleanupCell,
): OwnedClip {
  return {
    source: Object.freeze({ ...source }),
    ...(destination === undefined ? {} : { destination: Object.freeze({ ...destination }) }),
    creationFingerprint: cloneNotes(creationFingerprint),
  };
}

/** Promote an independent read to the exact cleanup fingerprint. */
export function promoteOwnedClip(
  owned: OwnedClip,
  observed: readonly NoteRecord[],
): OwnedClip & { readonly exactFingerprint: readonly NoteRecord[] } {
  if (!creationMatches(owned.creationFingerprint, observed)) {
    throw new Error('the owned clip does not match its creation fingerprint');
  }
  if (owned.exactFingerprint !== undefined
      && canonicalNotes(owned.exactFingerprint) !== canonicalNotes(observed)) {
    throw new Error('the owned clip changed after exact fingerprint promotion');
  }
  return Object.freeze({
    ...owned,
    exactFingerprint: cloneNotes(observed),
  });
}

/** Move an owned drag clip home, verify its cleanup fingerprint, and remove it. */
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
  const matches = owned.exactFingerprint === undefined
    ? creationMatches(owned.creationFingerprint, observed)
    : canonicalNotes(observed) === canonicalNotes(owned.exactFingerprint);
  if (!matches) {
    throw new Error('the owned clip fingerprint changed; cleanup refuses to delete it');
  }

  await port.remove(owned.source);
  if (await port.hasContent(owned.source)
      || (owned.destination !== undefined && await port.hasContent(owned.destination))) {
    throw new Error('the owned clip remains after cleanup');
  }
}
