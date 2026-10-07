/**
 * The private clip and event identity registry of the host binding (8h4b).
 *
 * One entry binds an opaque base ref to one D32 snapshot reference, the
 * document clip ID, the R27 content hash, the coverage, the acquisition
 * boundary, and the event map `(host channel, pitch, cell)` to event ID. The
 * identity table of IDENTITY-AND-OVERLAYS.md decides each transition:
 *
 *   - `current`: keep the entry, its ref, and every ID.
 *   - `stale`: keep the clip ID. Keep the event ID of each cell that is still
 *     occupied. Mint an ID at each new cell. The new acquisition gets a new ref.
 *   - `identity-changed`, `absent`, `incomparable`, `uncovered`: retire every
 *     ref at the address. A new acquisition mints all IDs.
 *
 * The registry never matches by similarity. It is in process memory only: a
 * restart retires every ref. It holds at most `limit` live refs (default 256).
 * The least recently used ref retires first. A project or generation change
 * retires every ref of the earlier domain; a scene layout change retires every
 * ref of the project.
 */
import { randomBytes } from 'node:crypto';

import type { ClipSnapshotRef, ClipSnapshotVerdictKind } from '../contract/clip-snapshot.js';
import type { RevisionMark } from '../contract/snapshot.js';
import type { Coverage } from '../document/index.js';

export const REGISTRY_LIMIT = 256;
const TOMBSTONE_LIMIT = 1024;
const REF_PREFIX = 'gnb1.';

/** One acquired event address: host channel 0..15, MIDI pitch, and 1/512-beat cell. */
export interface CellKey {
  readonly channel: number;
  readonly pitch: number;
  readonly cell: number;
}

export const cellKey = (key: CellKey): string => `${key.channel}:${key.pitch}:${key.cell}`;

/** What one acquisition covered: the D23 cell plane over the clip span on all 16 channels. */
export interface AcquisitionBoundary {
  readonly plane: 'D23-1/512-cell';
  readonly channels: 16;
  readonly from: string;
  readonly to: string;
}

export interface BaseEntry {
  readonly ref: string;
  readonly snapshot: ClipSnapshotRef;
  readonly clipId: string;
  readonly contentHash: string;
  readonly coverage: readonly Coverage[];
  readonly boundary: AcquisitionBoundary;
  /** `cellKey` to event ID. */
  readonly events: ReadonlyMap<string, string>;
}

/** Why a ref no longer resolves. */
export type RetirementReason =
  | Exclude<ClipSnapshotVerdictKind, 'current' | 'stale'>
  | 'evicted';

export interface Retirement {
  readonly ref: string;
  readonly reason: RetirementReason;
  readonly channelId: string;
  readonly row: number;
}

export type Lookup =
  | { readonly state: 'live'; readonly entry: BaseEntry }
  | { readonly state: 'retired'; readonly retirement: Retirement }
  | { readonly state: 'unknown' };

/** How the IDs of one acquisition relate to the prior entry at the address. */
export type IdentityOutcome = 'new' | 'current' | 'stale' | 'retired-and-new';

export interface Acquired {
  readonly entry: BaseEntry;
  readonly outcome: IdentityOutcome;
  readonly retained: number;
  readonly minted: number;
  /** The prior ref and its retirement, when the verdict retired it. */
  readonly retired?: readonly Retirement[];
}

/** The document facts that depend on the assigned IDs. */
export interface Projected {
  readonly contentHash: string;
  readonly coverage: readonly Coverage[];
  readonly boundary: AcquisitionBoundary;
}

const RETIRING: ReadonlySet<ClipSnapshotVerdictKind> = new Set(['identity-changed', 'absent', 'incomparable', 'uncovered']);

const addressOf = (snapshot: Pick<ClipSnapshotRef, 'channelId' | 'row'>): string =>
  `${snapshot.channelId}\0${snapshot.row}`;

export class IdentityRegistry {
  private readonly entries = new Map<string, BaseEntry>();
  private readonly tombstones = new Map<string, Retirement>();
  private readonly latest = new Map<string, string>();
  private counter = 0;

  constructor(
    readonly limit: number = REGISTRY_LIMIT,
    private readonly newRef: () => string = () => REF_PREFIX + randomBytes(9).toString('base64url'),
  ) {
    if (!Number.isSafeInteger(limit) || limit < 1) throw new Error('the registry limit must be a positive integer');
  }

  get size(): number {
    return this.entries.size;
  }

  /** Is this text shaped like a base ref of this registry family? */
  static isRefShape(ref: string): boolean {
    return typeof ref === 'string' && ref.startsWith(REF_PREFIX) && /^[A-Za-z0-9_-]{4,64}$/.test(ref.slice(REF_PREFIX.length));
  }

  /**
   * Retire refs whose guards fail at `now`: another project or extension
   * generation (`incomparable`), or another scene layout (`identity-changed`).
   */
  sweep(now: RevisionMark): readonly Retirement[] {
    const retired: Retirement[] = [];
    for (const entry of [...this.entries.values()]) {
      const mark = entry.snapshot.mark;
      if (mark.project !== now.project || mark.generation !== now.generation) {
        retired.push(this.retire(entry, 'incomparable'));
      } else if (mark.sceneEpoch !== now.sceneEpoch || mark.window.scenes.count !== now.window.scenes.count) {
        retired.push(this.retire(entry, 'identity-changed'));
      }
    }
    return retired;
  }

  lookup(ref: string): Lookup {
    const entry = this.entries.get(ref);
    if (entry !== undefined) {
      this.touch(entry);
      return { state: 'live', entry };
    }
    const retirement = this.tombstones.get(ref);
    return retirement === undefined ? { state: 'unknown' } : { state: 'retired', retirement };
  }

  /** The newest live entry at one address. */
  latestAt(channelId: string, row: number): BaseEntry | undefined {
    const ref = this.latest.get(addressOf({ channelId, row }));
    return ref === undefined ? undefined : this.entries.get(ref);
  }

  /** Retire every live ref at the address of `snapshot`, with one reason. */
  retireAddress(snapshot: Pick<ClipSnapshotRef, 'channelId' | 'row'>, reason: RetirementReason): readonly Retirement[] {
    const address = addressOf(snapshot);
    return [...this.entries.values()]
      .filter((entry) => addressOf(entry.snapshot) === address)
      .map((entry) => this.retire(entry, reason));
  }

  /**
   * Bind one fresh acquisition. `prior` is the newest entry at the address and
   * its D32 verdict against this acquisition. `project` builds the document
   * from the assigned IDs; it runs only when the IDs change.
   */
  acquire(input: {
    readonly snapshot: ClipSnapshotRef;
    readonly cells: readonly CellKey[];
    readonly prior?: { readonly entry: BaseEntry; readonly verdict: ClipSnapshotVerdictKind };
    readonly project: (ids: { readonly clipId: string; readonly eventIds: readonly string[] }) => Projected;
  }): Acquired {
    const { snapshot, cells, prior } = input;
    if (prior !== undefined && addressOf(prior.entry.snapshot) !== addressOf(snapshot)) {
      throw new Error('the prior entry has another address');
    }
    const keys = cells.map(cellKey);
    if (new Set(keys).size !== keys.length) throw new Error('two acquired events have one cell address');

    if (prior?.verdict === 'current' && this.entries.has(prior.entry.ref)) {
      if (prior.entry.snapshot.source.sha256 !== snapshot.source.sha256
          || keys.length !== prior.entry.events.size || keys.some((key) => !prior.entry.events.has(key))) {
        throw new Error('a current verdict must name the same source and the same cells');
      }
      this.touch(prior.entry);
      return { entry: prior.entry, outcome: 'current', retained: keys.length, minted: 0 };
    }

    let retired: Retirement[] | undefined;
    let base: BaseEntry | undefined;
    if (prior !== undefined && prior.verdict === 'stale' && this.entries.has(prior.entry.ref)) {
      base = prior.entry;
    } else if (prior !== undefined && RETIRING.has(prior.verdict)) {
      retired = [...this.retireAddress(prior.entry.snapshot, prior.verdict as RetirementReason)];
    }

    const clipId = base?.clipId ?? this.mint('c');
    let retained = 0;
    const eventIds = keys.map((key) => {
      const kept = base?.events.get(key);
      if (kept !== undefined) {
        retained += 1;
        return kept;
      }
      return this.mint('e');
    });
    const projected = input.project({ clipId, eventIds });
    const entry: BaseEntry = {
      ref: this.uniqueRef(),
      snapshot,
      clipId,
      contentHash: projected.contentHash,
      coverage: projected.coverage,
      boundary: projected.boundary,
      events: new Map(keys.map((key, index) => [key, eventIds[index]!])),
    };
    this.insert(entry);
    const outcome: IdentityOutcome = base !== undefined ? 'stale' : retired !== undefined ? 'retired-and-new' : 'new';
    return {
      entry, outcome, retained, minted: keys.length - retained,
      ...(retired === undefined ? {} : { retired }),
    };
  }

  private mint(prefix: 'c' | 'e'): string {
    this.counter += 1;
    return `${prefix}${this.counter.toString(36)}`;
  }

  private uniqueRef(): string {
    for (;;) {
      const ref = this.newRef();
      if (!this.entries.has(ref) && !this.tombstones.has(ref)) return ref;
    }
  }

  private insert(entry: BaseEntry): void {
    this.entries.set(entry.ref, entry);
    this.latest.set(addressOf(entry.snapshot), entry.ref);
    while (this.entries.size > this.limit) {
      const oldest = this.entries.values().next().value!;
      this.retire(oldest, 'evicted');
    }
  }

  /** Move an entry to the most recent end of the eviction order. */
  private touch(entry: BaseEntry): void {
    this.entries.delete(entry.ref);
    this.entries.set(entry.ref, entry);
  }

  private retire(entry: BaseEntry, reason: RetirementReason): Retirement {
    this.entries.delete(entry.ref);
    const address = addressOf(entry.snapshot);
    if (this.latest.get(address) === entry.ref) {
      const newer = [...this.entries.values()].reverse().find((item) => addressOf(item.snapshot) === address);
      if (newer === undefined) this.latest.delete(address);
      else this.latest.set(address, newer.ref);
    }
    const retirement: Retirement = { ref: entry.ref, reason, channelId: entry.snapshot.channelId, row: entry.snapshot.row };
    this.tombstones.set(entry.ref, retirement);
    while (this.tombstones.size > TOMBSTONE_LIMIT) {
      this.tombstones.delete(this.tombstones.keys().next().value!);
    }
    return retirement;
  }
}
