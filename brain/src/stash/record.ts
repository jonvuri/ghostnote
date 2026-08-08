/**
 * What the stash holds, as shapes.
 *
 * ⚠ This file used to be `format.ts` — what a take looked like ON DISK. Nothing
 * persists (D17a/D17 rev), so everything that made it a serializer is gone:
 * `writeAtomic`, `parseStoredTake`, `parseMeta`, `STORE_FORMAT`, `StoreMeta`, the
 * `projectKey`/`parent`/`label` envelope. What survives is the sentence the
 * disposition table asked to survive — *the `StoredTake` shape survives as an
 * in-memory stash record* — and it turns out to need exactly one field the take
 * cannot know about itself.
 *
 *   `seq`  where this batch falls in the session's order. That is what answers
 *          *who wrote this address last*, which is the whole of the boundary
 *          check below. The old envelope's `parent` answered a different
 *          question — where a take sits in a GRAPH — and the graph is the project
 *          now (D18a).
 *
 * ⚠ `contract` is still stamped, on the `Take` itself, and still matters even
 * with no disk: an adapter reconnecting under a different contract makes a
 * stashed snapshot a vocabulary we no longer share. It is the executor's stamp,
 * not ours, so there is nothing here to parse — but a caller comparing it is
 * doing the right thing.
 */
import type { Address, AddressKey, Fidelity, NoteRecord, StateValue } from '../contract/index.js';
import type { Take } from '../engine/index.js';

/** One batch this session ran, in the order it ran. */
export interface StashedChangeset {
  /** 1-based position in the session. Later beats earlier for "who wrote it last". */
  readonly seq: number;
  readonly recordedAtMs: number;
  /** Session 1's value, verbatim. Everything else here is what it cannot know. */
  readonly take: Take;
}

/** Enough to list what this session has done, without walking every snapshot. */
export interface ChangesetSummary {
  readonly id: string;
  readonly seq: number;
  readonly createdAtMs: number;
  /** The worst label across the write-set. `none` means part of it is gone. */
  readonly fidelity: Fidelity;
  readonly applied: boolean;
  readonly addresses: readonly AddressKey[];
  /**
   * ⚠ What this changeset could not put back even in principle, available
   * WITHOUT planning a reversal. A `none`-fidelity entry has to be visible
   * before someone commits to reversing, not discovered halfway through (D5).
   */
  readonly unrestorable: readonly { readonly key: AddressKey; readonly why: string }[];
}

// --- the boundary ------------------------------------------------------------

/**
 * ⚠ D19's boundary, per address — *"reversal that would destroy anything the
 * agent did not itself mint-and-last-write is withheld and reported."*
 *
 * The same verdict answers the stash's OTHER standing job (D17 rev, D19): the
 * clip content fingerprint that guards positional clip addressing. Both questions
 * are *"is this address still holding what we last left in it?"*, asked before a
 * write instead of before a reversal — one mechanism, two features, which is the
 * same shape §8f's diff had.
 */
export type BoundaryVerdict =
  /** Live matches what this changeset left. Ours to put back. */
  | 'ours'
  /** A LATER changeset of this session wrote it. Reverse that one first. */
  | 'superseded'
  /** ⚠ Live differs and no changeset of ours explains it — a human edited it. */
  | 'changed'
  /** ⚠ We never read this address back after writing it (E3). We do not know what we left. */
  | 'unverified'
  /** The caller did not read this address just now, so the boundary is unevaluated. */
  | 'unread'
  /** ⚠ Outside the bank window in the current read — invisible, not unchanged (E5). */
  | 'blind'
  /**
   * ⚠ No changeset of this session has ever written this address, so the stash
   * has nothing to compare against. **Not a claim that the address is safe** —
   * only that this mechanism has no opinion. Reachable from `fingerprint`, never
   * from `boundary`, which is always asked about a changeset's own write-set.
   */
  | 'unseen';

export interface BoundaryCheck {
  readonly key: AddressKey;
  readonly address: Address;
  readonly verdict: BoundaryVerdict;
  /** The changeset that last wrote this address, when the stash knows of one. */
  readonly lastWrittenBy?: string;
  /** In the caller's language, and empty only for `ours`. */
  readonly why: string;
}

/** Everything except `ours` is withheld — stated once, so no caller re-derives it. */
export const inBounds = (check: BoundaryCheck): boolean => check.verdict === 'ours';

// --- structural equality over state values -----------------------------------

/**
 * Whether two readings of an address are the same reading.
 *
 * Salvaged from `graph.ts`'s diff, which is where it was written and is the one
 * part of that file the stateless model still needs: the diff asked *"did this
 * change between two takes"* and the fingerprint asks *"did this change since we
 * wrote it"*, which is the same comparison against a different second operand.
 *
 * ⚠ Notes are sorted before comparison because readback ORDER is the adapter's
 * business, not the clip's. Two identical clips reported in a different order are
 * not a change, and treating them as one would make the boundary withhold every
 * reversal — a fingerprint that cries wolf is a fingerprint nobody honours.
 */
export function sameValue(a: StateValue | undefined, b: StateValue | undefined): boolean {
  return stable(canonical(a)) === stable(canonical(b));
}

function canonical(value: StateValue | undefined): unknown {
  if (value === undefined) return null;
  if (value.of !== 'notes') return value;
  const notes = [...value.notes].sort(
    (x: NoteRecord, y: NoteRecord) => x.startBeats - y.startBeats || x.pitch - y.pitch,
  );
  return { of: 'notes', notes };
}

/** Key-sorted JSON, so an object built two different ways compares equal. */
function stable(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'undefined';
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(',')}}`;
}
