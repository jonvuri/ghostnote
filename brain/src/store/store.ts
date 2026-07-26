/**
 * The take store — a durable, branchable, human-owned home for what the executor
 * produces.
 *
 * Deliberately a LIBRARY WITH A DIRECTORY PATH, not a component of the daemon.
 * PHASE-1-SESSION-2 puts it before session 3 for exactly that reason: "a store
 * that is born inside a daemon process acquires lifecycle bugs before it has
 * correctness ones." Everything here is provable offline in milliseconds.
 *
 * ## ⚠ The privilege split, made structural
 *
 * §8g / standing rule 8: *the agent may read and explain the log; it may never
 * mutate it.* D14 notes the daemon must keep the agent off those endpoints — and
 * a rule the daemon has to remember is a rule that gets forgotten in one
 * refactor. So the split is a TYPE split with a real object behind it:
 *
 *   `TakeLog`     the read half. `store.log` returns a frozen plain object whose
 *                 own properties are read methods and nothing else — not the
 *                 store narrowed by a cast, which `as never` defeats in a line.
 *   `TakeWriter`  the mutate half, named member by member in `STORE_MUTATORS`.
 *
 * `surface.test.ts` asserts no `STORE_MUTATORS` name is reachable from a `log`,
 * in the spirit of `WIRE_METHODS_BANNED` — the point of both is that the ban is
 * reviewable rather than merely stated.
 *
 * ## Layout
 *
 *     <root>/projects/<projectKey>/meta.json      head pointer, hint, versions
 *     <root>/projects/<projectKey>/takes/<id>.json one take, written atomically
 *
 * One file per take, so a crash mid-write can damage at most the take being
 * written — and write-then-rename means it cannot damage even that. Everything is
 * loaded into memory on open, which is honest for a personal tool at the retention
 * depths below and is what lets the graph be pure functions over a Map.
 */
import { mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import type {
  Address, AddressKey, ClipAddress, Fidelity, Op, TrackAddress,
} from '../contract/index.js';
import { revertOps, type Take, type TakeValue, type Unrestored } from '../engine/index.js';
import { DuplicateTakeError, StoreFormatError, TakeIdError, TakeNotFoundError } from './errors.js';
import {
  STORE_FORMAT, emptyMeta, encode, parseMeta, parseStoredTake, writeAtomic,
  type StoreMeta, type StoredTake, type TakeSummary, type UnreadableTake,
} from './format.js';
import {
  ancestryOf, childrenOf, diffBetween, leavesOf, planBetween, planUndo,
  type AddressDiff, type TakeIndex,
} from './graph.js';
import {
  assertProjectKey, reconcilePointer, type Divergence, type ProjectKeySource,
} from './project.js';
import { assertSelects, isWholeTake, selectClip, selectTrack, type Slice } from './slice.js';

/**
 * A move the world can be asked to make, fully described BEFORE anything runs.
 *
 * Exit criterion 4 lives here: `fidelity`, `unrestored` and `caveats` are all
 * computed by planning, so "this take contains something a revert cannot put
 * back" is answerable without applying a single op.
 */
export interface StorePlan {
  readonly from: string | null;
  readonly to: string | null;
  /**
   * ⚠ What the caller must do to the log AFTER applying, and the one piece of
   * store semantics that is easy to get catastrophically wrong.
   *
   *   `take`       the world ends up exactly on take `to`. **Move the head; do
   *                NOT append.** Appending the navigation as a take would make
   *                the log contain a step that undid another step, and the next
   *                jump would undo the undo — re-applying the very change the
   *                human just walked away from. Navigation is a move of the
   *                pointer, not a new fact about the music.
   *   `new-state`  the world ends up somewhere no take describes — every partial
   *                revert, and any undo of a take that is not the head. **Append
   *                it.** The human chose to keep the hats and drop the snare;
   *                that is authored change and it deserves a node.
   *
   * Session 1's `Executor.revert` produces a take value either way, because the
   * executor has no store to consult. Deciding which of the two it is happens
   * here, where the graph is.
   */
  readonly lands: 'take' | 'new-state';
  /** Ready for the executor. Empty is legitimate only for a no-op move. */
  readonly ops: readonly Op[];
  /** D5's "never silently under-delivers" half — what this move will not do. */
  readonly unrestored: readonly Unrestored[];
  /** The worst label across the addresses this move touches. */
  readonly fidelity: Fidelity;
  readonly caveats: readonly string[];
  readonly addresses: readonly AddressKey[];
  readonly slice?: Slice;
}

// --- the read half -----------------------------------------------------------

/**
 * Everything the agent may do with the take log: read it and explain it.
 *
 * Session 3 hands one of these to the MCP client. Note what is absent — there is
 * no `append`, no `setHead`, no `prune`, and no property leading back to the
 * store that owns them.
 */
export interface TakeLog {
  readonly projectKey: string;
  head(): string | null;
  get(id: string): StoredTake | undefined;
  require(id: string): StoredTake;
  /** Newest first. */
  list(): readonly TakeSummary[];
  summary(id: string): TakeSummary;
  children(id: string): readonly string[];
  ancestry(id: string): readonly string[];
  leaves(): readonly string[];
  /** Files this build refused to read, with the reason. Empty in the ordinary case. */
  unreadable(): readonly UnreadableTake[];

  /** Verb 1: move the world from the current head to `id` (A/B navigation). */
  planTo(id: string | null, slice?: Slice): StorePlan;
  /** Verb 2: undo one take's own write-set, wherever the head is. */
  planRevert(id: string, slice?: Slice): StorePlan;
  /** The before/after data Phase 3 renders. `from: null` means "from the root". */
  diff(from: string | null, to: string | null): readonly AddressDiff[];

  /** The take's addresses that belong to one clip — a partial-revert selector. */
  selectClip(id: string, clip: ClipAddress): Slice;
  selectTrack(id: string, track: TrackAddress): Slice;
}

// --- the mutate half ---------------------------------------------------------

/**
 * ⚠ The half the agent must never reach (§8g, standing rule 8).
 *
 * Every member is named in `STORE_MUTATORS` with the reason, so a new mutator
 * added without a matching entry fails `surface.test.ts` rather than quietly
 * becoming a hole in the privilege boundary.
 */
export interface TakeWriter {
  append(take: Take, options?: { parent?: string | null; label?: string }): Promise<StoredTake>;
  setHead(id: string | null): Promise<void>;
  label(id: string, label: string | null): Promise<void>;
  prune(): Promise<readonly string[]>;
  adopt(pointer: string | null): Promise<Divergence | undefined>;
  publishPointer(source: ProjectKeySource): Promise<void>;
}

/**
 * The mutating surface, named so the ban is reviewable — the `WIRE_METHODS_BANNED`
 * idiom, applied to a privilege boundary instead of a wire.
 */
export const STORE_MUTATORS: Readonly<Record<keyof TakeWriter, string>> = {
  append: '§8g — a take is created by a batch running, never by the agent asking for one',
  setHead: '§8g — where the human is in their own history is theirs to move',
  label: 'D5 — "that take had a better hi-hat" is a human sentence about a human take',
  prune: '§8g — forgetting is a mutation, and the destructive one',
  adopt: 'reconciliation moves the head; see setHead',
  publishPointer: 'writes into the project document, which the agent has no business touching',
};

// --- the store ---------------------------------------------------------------

export interface RetentionPolicy {
  /**
   * How many takes to keep. Depth rather than age: a session that writes 40 takes
   * in an hour and one that writes 40 over a month want the same log.
   *
   * ⚠ Pruning only ever removes a CHILDLESS take, so a branch is trimmed from its
   * tip inward and the graph never loses an interior node. That is what "what
   * happens to old branches" resolves to: abandoned tips go first, and no
   * surviving take ever finds its parent missing.
   */
  readonly maxTakes: number;
}

export const DEFAULT_RETENTION: RetentionPolicy = { maxTakes: 200 };

export interface OpenStoreOptions {
  readonly projectKey: string;
  /** Defaults to `$GHOSTNOTE_HOME` or `~/.ghostnote`. */
  readonly root?: string;
  readonly retention?: RetentionPolicy;
  readonly projectHint?: string;
  /** Injected so tests are deterministic. Never a module global (session 1's rule). */
  readonly now?: () => number;
}

export function defaultStoreRoot(): string {
  return process.env['GHOSTNOTE_HOME'] ?? join(homedir(), '.ghostnote');
}

export class TakeStore implements TakeLog, TakeWriter {
  readonly projectKey: string;

  private readonly takesDir: string;
  private readonly metaFile: string;
  private readonly retention: RetentionPolicy;
  private readonly now: () => number;
  private readonly takes = new Map<string, StoredTake>();
  private readonly broken: UnreadableTake[] = [];
  private meta: StoreMeta;
  private readonly readHalf: TakeLog;

  private constructor(options: Required<Pick<OpenStoreOptions, 'projectKey'>> & {
    dir: string; retention: RetentionPolicy; now: () => number; meta: StoreMeta;
  }) {
    this.projectKey = options.projectKey;
    this.takesDir = join(options.dir, 'takes');
    this.metaFile = join(options.dir, 'meta.json');
    this.retention = options.retention;
    this.now = options.now;
    this.meta = options.meta;
    this.readHalf = this.buildReadHalf();
  }

  /**
   * The read half, as a separate frozen object.
   *
   * ⚠ NOT `this` narrowed to `TakeLog`. A narrowing cast is undone by another
   * cast, which makes the boundary a comment; a distinct object with only these
   * own properties makes it a fact something can be asserted about. Nothing here
   * closes over a mutator, and the object is frozen so a client cannot bolt one
   * on either.
   */
  get log(): TakeLog {
    return this.readHalf;
  }

  private buildReadHalf(): TakeLog {
    const half: TakeLog = {
      projectKey: this.projectKey,
      head: () => this.head(),
      get: (id) => this.get(id),
      require: (id) => this.require(id),
      list: () => this.list(),
      summary: (id) => this.summary(id),
      children: (id) => this.children(id),
      ancestry: (id) => this.ancestry(id),
      leaves: () => this.leaves(),
      unreadable: () => this.unreadable(),
      planTo: (id, slice) => this.planTo(id, slice),
      planRevert: (id, slice) => this.planRevert(id, slice),
      diff: (from, to) => this.diff(from, to),
      selectClip: (id, clip) => this.selectClip(id, clip),
      selectTrack: (id, track) => this.selectTrack(id, track),
    };
    return Object.freeze(half);
  }

  // --- opening -------------------------------------------------------------

  static async open(options: OpenStoreOptions): Promise<TakeStore> {
    assertProjectKey(options.projectKey);
    const root = options.root ?? defaultStoreRoot();
    const dir = join(root, 'projects', options.projectKey);
    const now = options.now ?? (() => Date.now());

    await mkdir(join(dir, 'takes'), { recursive: true });

    let meta = emptyMeta(options.projectKey, now());
    let metaFailure: string | undefined;
    try {
      meta = parseMeta(join(dir, 'meta.json'), await readFile(join(dir, 'meta.json'), 'utf8'));
    } catch (error) {
      // A missing meta is an empty store — the ordinary first-run case. A CORRUPT
      // one costs the head pointer and nothing else, and the takes themselves are
      // all still on disk, so refusing to open would throw away everything over
      // the one file that holds the least. Same posture as a foreign take: start
      // with no head, say so, and let the human navigate explicitly.
      if (!isMissing(error)) metaFailure = error instanceof StoreFormatError ? error.message : String(error);
    }
    if (options.projectHint !== undefined) meta = { ...meta, projectHint: options.projectHint };

    const store = new TakeStore({
      projectKey: options.projectKey,
      dir,
      retention: options.retention ?? DEFAULT_RETENTION,
      now,
      meta,
    });
    if (metaFailure !== undefined) store.broken.push({ file: 'meta.json', why: metaFailure });
    await store.load();
    return store;
  }

  private async load(): Promise<void> {
    const files = (await readdir(this.takesDir)).filter((f) => f.endsWith('.json'));
    for (const file of files.sort()) {
      const path = join(this.takesDir, file);
      try {
        const stored = parseStoredTake(path, await readFile(path, 'utf8'));
        this.takes.set(stored.take.id, stored);
      } catch (error) {
        // ⚠ Quarantine, do not throw. One take written by an older contract must
        // not make the other 199 unreadable — but it is not silently skipped
        // either: it is listed, and any operation that would have used it fails
        // with "not in this store" rather than with a wrong answer.
        this.broken.push({
          file,
          why: error instanceof StoreFormatError ? error.message : String(error),
        });
      }
    }
    // A head naming a take we could not read is no head at all.
    if (this.meta.head !== null && !this.takes.has(this.meta.head)) {
      this.broken.push({
        file: 'meta.json',
        why:
          `head pointed at take ${this.meta.head}, which is not readable in this store. The head ` +
          'is cleared rather than trusted; navigate explicitly.',
      });
      this.meta = { ...this.meta, head: null };
    }
  }

  private get index(): TakeIndex {
    return this.takes;
  }

  // --- read ----------------------------------------------------------------

  head(): string | null {
    return this.meta.head;
  }

  get(id: string): StoredTake | undefined {
    const found = this.takes.get(id);
    // Cloned on the way out: an in-memory cache a caller can mutate is a store
    // whose disk and memory disagree, and the read half must not be able to do
    // that even by accident.
    return found === undefined ? undefined : structuredClone(found);
  }

  require(id: string): StoredTake {
    const found = this.get(id);
    if (found === undefined) throw new TakeNotFoundError(id);
    return found;
  }

  list(): readonly TakeSummary[] {
    return [...this.takes.values()]
      .sort((a, b) => b.take.createdAtMs - a.take.createdAtMs || (a.take.id < b.take.id ? 1 : -1))
      .map((n) => this.summarize(n));
  }

  summary(id: string): TakeSummary {
    const node = this.takes.get(id);
    if (node === undefined) throw new TakeNotFoundError(id);
    return this.summarize(node);
  }

  private summarize(node: StoredTake): TakeSummary {
    return {
      id: node.take.id,
      parent: node.parent,
      ...(node.label === undefined ? {} : { label: node.label }),
      createdAtMs: node.take.createdAtMs,
      fidelity: node.take.fidelity,
      applied: node.take.report.applied,
      addresses: node.take.targets.map((t) => t.key),
      // ⚠ Exit criterion 4, computed from what the take already carries: an
      // address labelled `none` cannot be put back, and saying so belongs in the
      // listing rather than in the middle of a revert.
      unrestorable: node.take.values
        .filter((v) => v.fidelity === 'none')
        .map((v) => ({ key: v.key, why: v.caveats.join(' ') })),
      isHead: this.meta.head === node.take.id,
      children: childrenOf(this.index, node.take.id),
    };
  }

  children(id: string): readonly string[] {
    return childrenOf(this.index, id);
  }

  ancestry(id: string): readonly string[] {
    if (!this.takes.has(id)) throw new TakeNotFoundError(id);
    return ancestryOf(this.index, id);
  }

  leaves(): readonly string[] {
    return leavesOf(this.index);
  }

  unreadable(): readonly UnreadableTake[] {
    return [...this.broken];
  }

  planTo(id: string | null, slice?: Slice): StorePlan {
    if (id !== null && !this.takes.has(id)) throw new TakeNotFoundError(id);
    const from = this.meta.head;
    assertSelects(slice, planBetween(this.index, from, id, undefined).addresses);
    return this.materialize(
      from, id, planBetween(this.index, from, id, slice), slice,
      isWholeTake(slice) ? 'take' : 'new-state',
    );
  }

  planRevert(id: string, slice?: Slice): StorePlan {
    const node = this.takes.get(id);
    if (node === undefined) throw new TakeNotFoundError(id);
    assertSelects(slice, planUndo(this.index, id, undefined).addresses);
    // ⚠ Undoing the HEAD in full is the only revert that lands on an existing
    // take. Undo an ancestor instead, or undo only part of one, and the result is
    // a state the graph does not contain — it has to become a node of its own.
    const lands = isWholeTake(slice) && this.meta.head === id ? 'take' : 'new-state';
    return this.materialize(id, lands === 'take' ? node.parent : null, planUndo(this.index, id, slice), slice, lands);
  }

  private materialize(
    from: string | null,
    to: string | null,
    planned: ReturnType<typeof planBetween>,
    slice: Slice | undefined,
    lands: StorePlan['lands'],
  ): StorePlan {
    const plan = revertOps(planned.input);
    return {
      from,
      to,
      lands,
      ops: plan.ops,
      unrestored: [...plan.unrestored, ...planned.blocked],
      fidelity: planned.fidelity,
      caveats: dedupe(planned.labels.flatMap((l: TakeValue) => l.caveats)),
      addresses: planned.addresses,
      ...(slice === undefined ? {} : { slice }),
    };
  }

  diff(from: string | null, to: string | null): readonly AddressDiff[] {
    return diffBetween(this.index, from, to);
  }

  selectClip(id: string, clip: ClipAddress): Slice {
    return selectClip(this.addressesOf(id), clip);
  }

  selectTrack(id: string, track: TrackAddress): Slice {
    return selectTrack(this.addressesOf(id), track);
  }

  private addressesOf(id: string): Address[] {
    const node = this.takes.get(id);
    if (node === undefined) throw new TakeNotFoundError(id);
    return node.take.targets.map((t) => t.address);
  }

  // --- mutate --------------------------------------------------------------

  /**
   * Record a take and make it the head.
   *
   * ⚠ The take FILE is written before the meta. A crash between the two leaves a
   * take on disk that no head points at, which the next open sees as an ordinary
   * childless leaf — recoverable and visible. The other order would leave a head
   * naming a take that does not exist, which is a store that will not open.
   */
  async append(take: Take, options: { parent?: string | null; label?: string } = {}): Promise<StoredTake> {
    assertTakeId(take.id);
    if (this.takes.has(take.id)) throw new DuplicateTakeError(take.id);

    const parent = options.parent === undefined ? this.meta.head : options.parent;
    if (parent !== null && !this.takes.has(parent)) throw new TakeNotFoundError(parent, 'as a parent');

    const stored: StoredTake = {
      format: STORE_FORMAT,
      projectKey: this.projectKey,
      parent,
      ...(options.label === undefined ? {} : { label: options.label }),
      storedAtMs: this.now(),
      take,
    };

    await writeAtomic(this.fileFor(take.id), encode(stored));
    this.takes.set(take.id, stored);
    await this.writeMeta({ head: take.id });
    await this.prune();
    return structuredClone(stored);
  }

  /**
   * Move the head. Nothing is truncated, which is the whole of branching:
   * appending after a jump gives the new take the jumped-to take as its parent,
   * and the takes that used to follow are still there under their own parent
   * (D5 — "reverting to an earlier take and proceeding does not destroy the
   * branch you left").
   */
  async setHead(id: string | null): Promise<void> {
    if (id !== null && !this.takes.has(id)) throw new TakeNotFoundError(id);
    await this.writeMeta({ head: id });
  }

  async label(id: string, label: string | null): Promise<void> {
    const node = this.takes.get(id);
    if (node === undefined) throw new TakeNotFoundError(id);
    const next: StoredTake = label === null
      ? { ...withoutLabel(node), storedAtMs: this.now() }
      : { ...node, label, storedAtMs: this.now() };
    await writeAtomic(this.fileFor(id), encode(next));
    this.takes.set(id, next);
  }

  /**
   * Trim the log to the retention depth.
   *
   * Three protections, and each one is a thing a human would be upset to lose:
   * the head (where they are), a labelled take (they named it, so it is theirs),
   * and any take with children (removing it would orphan a branch). Oldest
   * eligible leaf first, which trims abandoned branches from the tip inward.
   */
  async prune(): Promise<readonly string[]> {
    const pruned: string[] = [];
    while (this.takes.size > this.retention.maxTakes) {
      const parents = new Set(
        [...this.takes.values()].map((n) => n.parent).filter((p): p is string => p !== null),
      );
      const candidate = [...this.takes.values()]
        .filter((n) => !parents.has(n.take.id) && n.label === undefined && this.meta.head !== n.take.id)
        .sort((a, b) => a.take.createdAtMs - b.take.createdAtMs)[0];
      // Everything left is protected. Overshooting the depth is the right answer:
      // the alternative is deleting something the policy just said not to.
      if (candidate === undefined) break;
      await rm(this.fileFor(candidate.take.id), { force: true });
      this.takes.delete(candidate.take.id);
      pruned.push(candidate.take.id);
    }
    return pruned;
  }

  /**
   * Reconcile with the pointer stored in the project document, and act on the
   * verdict. See `project.ts` for why the project document wins.
   */
  async adopt(pointer: string | null): Promise<Divergence | undefined> {
    const divergence = reconcilePointer(
      this.meta.head,
      pointer,
      (id) => this.takes.has(id),
      (id) => ancestryOf(this.index, id),
    );
    if (divergence?.adopted === true) await this.writeMeta({ head: divergence.projectPointer });
    return divergence;
  }

  /** Push the current head into the project document, so a save records it. */
  async publishPointer(source: ProjectKeySource): Promise<void> {
    await source.writePointer(this.meta.head);
  }

  // --- disk ----------------------------------------------------------------

  private fileFor(id: string): string {
    return join(this.takesDir, `${id}.json`);
  }

  private async writeMeta(patch: Partial<StoreMeta>): Promise<void> {
    this.meta = { ...this.meta, ...patch, updatedAtMs: this.now() };
    await writeAtomic(this.metaFile, encode(this.meta));
  }
}

function assertTakeId(id: string): void {
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(id) || id === '.' || id === '..') throw new TakeIdError(id);
}

function withoutLabel(node: StoredTake): StoredTake {
  const { label: _label, ...rest } = node;
  return rest;
}

function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT';
}

const dedupe = (values: readonly string[]): string[] => [...new Set(values)];
