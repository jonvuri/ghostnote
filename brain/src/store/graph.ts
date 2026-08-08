/**
 * The take graph — branching, navigation and diff, as pure functions.
 *
 * ⚠ **The scope discipline this module is under.** PHASE-1 §Risks: *"take
 * branching is more design than expected. It is a graph, not a stack, and the
 * temptation is a general VCS. Build A/B comparison and partial revert and stop.
 * If a merge operation appears in the design, something has gone wrong."* There
 * is no merge here, no conflict resolution, no three-way anything. There are two
 * verbs and one walk:
 *
 *   `planBetween`  move the world from one take to another (A/B, revert, partial)
 *   `diffBetween`  what differs between two takes (Phase 3 renders it)
 *
 * Both are the SAME walk of the path between two nodes, which is §8f's "one
 * mechanism, two features" showing up a second time. And the walk's output is a
 * `RevertInput` — session 1's existing `revertOps` materializes the ops, so a
 * jump, a revert and a partial revert are one code path and cannot disagree
 * about what restoring an address means.
 *
 * ## Why a path walk rather than "restore the target take's own write-set"
 *
 * The cheap version — jump to T by replaying T's verify over T's addresses — is
 * wrong the moment two takes touch different things, which is the normal case.
 * Head at T2 (wrote bass), jumping to T1 (wrote hats) would leave T2's bass in
 * place and call it "the state at T1". The path walk costs about thirty lines
 * and is actually true:
 *
 *   - takes between head and the common ancestor are UNWOUND, and the value that
 *     wins for an address is the OLDEST stash on that arm — the state before the
 *     branch touched it at all;
 *   - takes from the common ancestor down to the target are REPLAYED, and the
 *     value that wins is the NEWEST verify;
 *   - the replay arm overrides the unwind arm, because the target's own history
 *     is authoritative about the target's state.
 *
 * Nothing is deleted by any of this, which is what makes branching free: jumping
 * back and writing again gives the new take a different parent, and the branch
 * left behind is still reachable through `childrenOf` (D5).
 */
import {
  CONTRACT_TAG, addressKey, type Address, type AddressKey, type Fidelity, type NoteRecord,
  type Snapshot, type StateEntry, type StateValue,
} from '../contract/index.js';
import {
  worstOf,
  type RevertInput, type TakeValue, type Unrestored, type UnrevertableOp, type WriteTarget,
} from '../engine/index.js';
import { TakeCycleError, TakeNotFoundError } from './errors.js';
import type { StoredTake } from './format.js';
import { isWholeTake, selects, type Slice } from './slice.js';

export type TakeIndex = ReadonlyMap<string, StoredTake>;

// --- the graph ---------------------------------------------------------------

/** `[id, parent, …, root]`. Throws on a cycle, which only a corrupt store has. */
export function ancestryOf(index: TakeIndex, id: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  let cursor: string | null = id;
  while (cursor !== null) {
    if (seen.has(cursor)) throw new TakeCycleError(id);
    const node: StoredTake | undefined = index.get(cursor);
    if (node === undefined) break;
    seen.add(cursor);
    out.push(cursor);
    cursor = node.parent;
  }
  return out;
}

export function childrenOf(index: TakeIndex, id: string): string[] {
  return [...index.values()].filter((n) => n.parent === id).map((n) => n.take.id);
}

/** Takes with no children — the tips of every branch, abandoned ones included. */
export function leavesOf(index: TakeIndex): string[] {
  const parents = new Set([...index.values()].map((n) => n.parent).filter((p): p is string => p !== null));
  return [...index.values()].map((n) => n.take.id).filter((id) => !parents.has(id));
}

export interface Path {
  /** Takes to unwind, NEWEST FIRST. */
  readonly undo: readonly StoredTake[];
  /** Takes to replay, OLDEST FIRST. */
  readonly redo: readonly StoredTake[];
  /** The lowest common ancestor, or `null` when the two live in different roots. */
  readonly common: string | null;
}

export function pathBetween(index: TakeIndex, from: string | null, to: string | null): Path {
  const back = from === null ? [] : ancestryOf(index, from);
  const forward = to === null ? [] : ancestryOf(index, to);
  const forwardSet = new Set(forward);
  const common = back.find((id) => forwardSet.has(id)) ?? null;

  const cut = (chain: string[]): string[] =>
    common === null ? chain : chain.slice(0, chain.indexOf(common));
  const node = (id: string): StoredTake => {
    const found = index.get(id);
    if (found === undefined) throw new TakeNotFoundError(id);
    return found;
  };

  return {
    undo: cut(back).map(node),
    redo: cut(forward).reverse().map(node),
    common,
  };
}

// --- the walk ----------------------------------------------------------------

/** One address, and the state the path says it should be in. */
interface Wanted {
  readonly target: WriteTarget;
  readonly entry: StateEntry | undefined;
  /** The source take's own derived label for this address, if it has one. */
  readonly label: TakeValue | undefined;
  readonly unreachable: boolean;
}

/**
 * A take that applied nothing changed nothing, so neither arm should replay it.
 *
 * D10: a stale `ifRevision` rejects the batch WHOLE, applying zero ops. Its stash
 * is still a true record of the world at that moment — it is just not a step, and
 * replaying it would emit writes that restore the state to itself.
 */
const changedTheWorld = (node: StoredTake): boolean => node.take.report.applied;

/**
 * ⚠ Inserts a SLICED revert is deliberately not undoing.
 *
 * `device.insert` has an exact inverse — delete it at the chain index the receipt
 * minted (D16 rev 2) — and the walk now emits it, by handing `revertOps` each
 * take's `(ops, minted)` pair separately (`InsertBatch`). A slice is the one case
 * that still cannot: slicing selects ADDRESSES, and an insert has none to select,
 * so "restore just this clip" has no honest reading under which a device also
 * disappears. Reported rather than silently skipped, with the move that WOULD
 * remove it named.
 *
 * > ⚠ This function used to run on every path, including the single-take undo,
 * > on the reasoning that a walk cannot address one batch's mint. True of a walk
 * > that FLATTENS the takes; the fix was to stop flattening them. Its message
 * > told the reader to "revert that take on its own" — which is exactly what
 * > `planRevert` is, so the advice pointed back at the path that had just
 * > declined.
 */
function slicedInserts(node: StoredTake): UnrevertableOp[] {
  const out: UnrevertableOp[] = [];
  node.take.ops.forEach((op, opIndex) => {
    if (op.op !== 'device.insert') return;
    out.push({
      opIndex,
      op: op.op,
      why:
        `take ${node.take.id} inserted a device, and this revert selects specific addresses. An ` +
        'insert has no address to select, so it is outside the slice: the device stays in the ' +
        'chain. Revert the WHOLE take to remove it.',
    });
  });
  return out;
}

/**
 * The state at the far end of a path.
 *
 * `back` is walked NEWEST→OLDEST so the oldest stash wins; `forward` is walked
 * OLDEST→NEWEST so the newest verify wins; `forward` runs second so it overrides.
 * Those three sentences are the entire branching model.
 */
function stateAlong(
  back: readonly StoredTake[],
  forward: readonly StoredTake[],
): { wanted: Map<AddressKey, Wanted>; blocked: Unrestored[] } {
  const wanted = new Map<AddressKey, Wanted>();
  const blocked: Unrestored[] = [];

  const put = (node: StoredTake, snapshot: Snapshot): void => {
    for (const target of node.take.targets) {
      wanted.set(target.key, {
        target,
        entry: snapshot.entries[target.key],
        label: node.take.values.find((v) => v.key === target.key),
        unreachable: snapshot.unreachable.some((a) => addressKey(a) === target.key),
      });
    }
  };

  for (const node of back) {
    if (!changedTheWorld(node)) continue;
    put(node, node.take.stash);
  }

  // ⚠ An address the take's own verify could not READ must not be replayed
  // forward. E3's case — a batch that bumps the scene epoch invalidates its own
  // verify read — leaves no entry in `verify`, and an absent notes entry means
  // "no clip here" everywhere else in this codebase, so replaying it would emit a
  // `note.clear` against music that is very probably fine. "We could not look" is
  // not "it was empty", which is the whole reason `ApplyReport.unverified` exists
  // instead of being folded into the report's silence.
  const blind = new Map<AddressKey, Unrestored>();

  for (const node of forward) {
    if (!changedTheWorld(node)) continue;
    const unread = new Set(node.take.report.unverified.map((u) => addressKey(u.address)));
    put(node, node.take.verify);
    for (const target of node.take.targets) {
      // A later take that DID read the address back supersedes an earlier blind
      // spot — the newest verify is the state at the target, blind or not.
      if (!unread.has(target.key)) {
        blind.delete(target.key);
        continue;
      }
      blind.set(target.key, {
        address: target.address,
        what: target.address.kind,
        why:
          `take ${node.take.id} could not verify this address after applying (E3: the batch ` +
          'changed the scene layout, which invalidates every scene-relative address minted ' +
          'before it). There is no readback to replay forward, and treating the gap as "empty" ' +
          'would clear a clip we simply never saw. Re-resolve and re-read instead.',
      });
    }
  }

  for (const [key, why] of blind) {
    blocked.push(why);
    wanted.delete(key);
  }

  return { wanted, blocked };
}

// --- verb 1: move the world --------------------------------------------------

export interface PlanInput {
  /** Ready for session 1's `revertOps` — the same function a whole revert uses. */
  readonly input: RevertInput;
  /** Things this move cannot do, known BEFORE any op runs (exit criterion 4). */
  readonly blocked: readonly Unrestored[];
  /** The per-address labels the takes themselves derived. */
  readonly labels: readonly TakeValue[];
  readonly addresses: readonly AddressKey[];
  readonly fidelity: Fidelity;
}

/**
 * The ops that move the world from take `from` to take `to`, optionally sliced.
 *
 * `to === null` means "back to before the root", which is how a revert of the
 * very first take is expressed. `from === null` means the store has no head yet.
 */
export function planBetween(
  index: TakeIndex,
  from: string | null,
  to: string | null,
  slice?: Slice,
): PlanInput {
  const path = pathBetween(index, from, to);
  return planAlong(path.undo, path.redo, slice);
}

/**
 * Undo exactly one take, wherever the head happens to be.
 *
 * This is the verb the control layer's revert button calls, and it is NOT
 * `planBetween(take, take.parent)` in general: that would also replay whatever
 * came after the take on the way back. Reverting a take means undoing that take's
 * own write-set and nothing else — which is also what makes a partial revert of
 * it meaningful.
 */
export function planUndo(index: TakeIndex, id: string, slice?: Slice): PlanInput {
  const node = index.get(id);
  if (node === undefined) throw new TakeNotFoundError(id);
  return planAlong([node], [], slice);
}

function planAlong(
  undo: readonly StoredTake[],
  redo: readonly StoredTake[],
  slice: Slice | undefined,
): PlanInput {
  const { wanted, blocked } = stateAlong(undo, redo);

  const targets: WriteTarget[] = [];
  const entries: Record<AddressKey, StateEntry> = {};
  const unreachable: Address[] = [];
  const labels: TakeValue[] = [];

  for (const [key, want] of wanted) {
    if (!selects(slice, key)) continue;
    targets.push(want.target);
    if (want.entry !== undefined) entries[key] = want.entry;
    if (want.unreachable) unreachable.push(want.target.address);
    if (want.label !== undefined) labels.push(want.label);
  }

  // ⚠ The undo arm's `unrevertable` ops reach the report; the redo arm's are
  // named separately below, because "the track did not exist, so there is nothing
  // to restore" is the wrong sentence when the problem is that we cannot CREATE
  // it again on the way forward.
  //
  // An insert whose landing place nobody observed is already in `take.unrevertable`
  // — the executor stamps it there when the receipt comes back — so it arrives
  // here without this function knowing anything about mints.
  const applied = undo.filter(changedTheWorld);
  const whole = isWholeTake(slice);
  const unrevertable = applied.flatMap((n) => [
    ...n.take.unrevertable,
    ...(whole ? [] : slicedInserts(n)),
  ]);
  for (const node of redo) {
    for (const op of node.take.unrevertable) {
      blocked.push({
        what: op.op,
        why:
          `take ${node.take.id} minted something that cannot be replayed forward: ${op.op} has no ` +
          'prior address to restore from and no readback that could reproduce it (D16d). Moving ' +
          'to this take restores everything it wrote INTO that object, not the object itself.',
      });
    }
  }

  /**
   * ⚠ NOT a guard. `revertOps` never reads `at`, and the executor guards on a
   * revision it reads for itself immediately before applying — which is the only
   * mark that can be true. This one is provenance: it says which moment in the
   * session the replayed values were captured at, for the record and for Phase
   * 3's timeline.
   */
  const provenance = redo[redo.length - 1] ?? undo[0];

  const input: RevertInput = {
    targets,
    unrevertable,
    stash: {
      contract: CONTRACT_TAG,
      at: provenance?.take.at ?? { revision: 0, sceneEpoch: 0 },
      entries,
      missing: [],
      unreachable,
    },
    // ⚠ One entry PER TAKE, never flattened: `minted` is indexed by op index
    // within its own batch, so merging them would make op 0 ambiguous and the
    // resulting delete would take a device nobody addressed. Kept apart, a walk
    // undoes inserts for the same reason a single-take undo does, and
    // `deviceRemovals` orders the whole set descending — the hazard is the
    // chain's shape (E3), not which take caused it.
    //
    // Omitted entirely for a SLICED revert: an insert has no address, so no slice
    // can select it, and `slicedInserts` says so instead.
    ...(whole ? { batches: applied.map((n) => ({ ops: n.take.ops, minted: n.take.receipt.minted })) } : {}),
  };

  return {
    input,
    // A sliced plan reports only what its own slice could not do. A blind spot on
    // a clip the human did not ask about is noise, and noise is what gets a
    // "could not restore" line skimmed past on the day it matters.
    blocked: blocked.filter((b) => b.address === undefined || selects(slice, addressKey(b.address))),
    labels,
    addresses: targets.map((t) => t.key),
    fidelity: worstOf(
      targets.map((t) => ({
        fidelity: (t.restore === 'none'
          ? 'none'
          : labels.find((l) => l.key === t.key)?.fidelity ?? 'exact') as Fidelity,
      })),
    ),
  };
}

// --- verb 2: compare ---------------------------------------------------------

export interface AddressDiff {
  readonly key: AddressKey;
  readonly address: Address;
  readonly before: StateValue | undefined;
  readonly after: StateValue | undefined;
  readonly changed: boolean;
  /** The worse of the two sides' labels — what a revert back could promise. */
  readonly fidelity: Fidelity;
}

/**
 * What differs between two takes — the data Phase 3's before/after view renders.
 *
 * The same walk as `planBetween`, run in both directions: the state at `to` is
 * `stateAlong(undo, redo)`, and the state at `from` is the identical function
 * with the arms swapped. That symmetry is why there is no separate diff engine
 * and no risk of the diff and the revert disagreeing about what a take did.
 */
export function diffBetween(index: TakeIndex, from: string | null, to: string | null): AddressDiff[] {
  const path = pathBetween(index, from, to);
  const reversed = [...path.redo].reverse();
  const forward = [...path.undo].reverse();

  const after = stateAlong(path.undo, path.redo).wanted;
  const before = stateAlong(reversed, forward).wanted;

  const keys = new Set([...before.keys(), ...after.keys()]);
  const out: AddressDiff[] = [];
  for (const key of keys) {
    const a = before.get(key);
    const b = after.get(key);
    const address = (b ?? a)!.target.address;
    const beforeValue = a?.entry?.value;
    const afterValue = b?.entry?.value;
    out.push({
      key,
      address,
      before: beforeValue,
      after: afterValue,
      changed: !sameValue(beforeValue, afterValue),
      fidelity: worstOf([a?.label, b?.label].filter((l): l is TakeValue => l !== undefined)),
    });
  }
  return out;
}

/**
 * Structural equality over state values.
 *
 * Notes are sorted before comparison because readback order is the adapter's
 * business, not the clip's — two identical clips reported in a different order
 * are not a change, and reporting them as one would make every diff noisy enough
 * to be ignored.
 */
function sameValue(a: StateValue | undefined, b: StateValue | undefined): boolean {
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
