/**
 * What "the same project" means, and who wins when two records disagree.
 *
 * ## The key: a UUID minted into `getDocumentState()`
 *
 * The store must recognise a project across close and reopen. The two candidates
 * were a path hash and a minted UUID; the UUID wins, and E14 already proved the
 * storage works — document state survives save + a **full Bitwig restart** and is
 * scoped **per project** (E14-A3/A4). A path hash would rename the project's take
 * log every time the file moved, which is a thing humans do to project files
 * constantly and would silently orphan every take.
 *
 * ⚠ **The key is minted at init, not on demand.** `getDocumentState()` settings
 * cannot be created after `init()` — *"This can only be called during driver
 * initialization"* (E14-C2, and D7's amended rule now says treat that as the
 * default for anything Bitwig hands out). So the extension pre-allocates a hidden
 * String setting; ghostnote reads it, and mints into it on first write.
 *
 * ⚠ **An unsaved project still has a key**, because document state exists in
 * memory from the moment it is set — it is only *persistence* that waits for a
 * save. So the case is answered rather than discovered: a never-saved project
 * gets a key and a take log like any other, and if the human then discards the
 * project the log is orphaned. It is reaped by ordinary retention. It is NOT
 * specially detected, because the only signal would be "this key never came
 * back", which is indistinguishable from a project that is merely closed.
 *
 * ## The pointer: two records, and the one that is authoritative
 *
 * Take CONTENTS live in the daemon's store; the ACTIVE TAKE POINTER is naturally
 * project-scoped and lives in the project document. That split means they can
 * disagree, and the important half of the design is knowing which is right.
 *
 * ⚠ **The project document wins, and the reason is that the pointer and the music
 * are saved by the same operation.** If the human works up to take 20 and closes
 * without saving, what comes back off disk is the project as of the last save —
 * both its clips AND its pointer, atomically. The store's head would claim 20
 * while the world is at 5. So on open the store ADOPTS the project's pointer, and
 * takes 6-20 remain perfectly reachable as an abandoned branch, which is the
 * branching model doing exactly the job it exists for rather than a special case.
 *
 * The one thing never guessed: a pointer naming a take this store has never seen.
 * That is surfaced and nothing moves — PHASE-1 is explicit that detection matters
 * more than resolution here.
 */
import { ProjectKeyError } from './errors.js';

/** Keys name a directory. Refused rather than sanitized — see `ProjectKeyError`. */
const SAFE_KEY = /^[A-Za-z0-9._-]{1,128}$/;

export function assertProjectKey(key: string): void {
  if (!SAFE_KEY.test(key) || key === '.' || key === '..') throw new ProjectKeyError(key);
}

/**
 * Where the project key comes from.
 *
 * A port, because this session is offline by construction and the real
 * implementation is a `getDocumentState()` String setting the daemon reaches over
 * the bridge (session 3). Keeping it an interface is also what lets every rule
 * about minting, adopting and diverging be tested in milliseconds without Bitwig.
 */
export interface ProjectKeySource {
  /** The key stored in the project document, or `null` if it has never been minted. */
  readKey(): Promise<string | null>;
  /** Persist a freshly minted key into the project document. */
  writeKey(key: string): Promise<void>;
  /** The take the project document was last SAVED at. */
  readPointer(): Promise<string | null>;
  writePointer(takeId: string | null): Promise<void>;
  /** A human-readable project name. Identifies orphans; never used as a key. */
  hint?(): Promise<string | undefined>;
}

export interface ProjectIdentity {
  readonly key: string;
  /** True when this call created the key — i.e. ghostnote has never written here. */
  readonly minted: boolean;
  readonly hint?: string;
}

export async function resolveProjectIdentity(
  source: ProjectKeySource,
  newId: () => string,
): Promise<ProjectIdentity> {
  const hint = await source.hint?.();
  const existing = await source.readKey();
  if (existing !== null) {
    assertProjectKey(existing);
    return { key: existing, minted: false, ...(hint === undefined ? {} : { hint }) };
  }
  const key = newId();
  assertProjectKey(key);
  await source.writeKey(key);
  return { key, minted: true, ...(hint === undefined ? {} : { hint }) };
}

/**
 * How the store's head and the project's pointer disagree.
 *
 * `adopted` is the consequential field: it says whether the store moved to match
 * the project. It is `false` only when moving would be a guess.
 */
export interface Divergence {
  readonly reason:
    /** ⚠ The pointer names a take this store has never seen. Nothing moves. */
    | 'unknown-take'
    /** The normal unsaved-work case: the pointer is an ancestor of our head. */
    | 'store-ahead'
    /** Our head is an ancestor of the pointer — a meta write that did not land. */
    | 'store-behind'
    /** Neither is an ancestor of the other: the project came back on another branch. */
    | 'diverged'
    /** The project has no pointer at all, but this store has a head. */
    | 'no-pointer';
  readonly projectPointer: string | null;
  readonly storeHead: string | null;
  readonly adopted: boolean;
  readonly detail: string;
}

/**
 * Decide what a disagreement means. Pure — the store applies the verdict.
 *
 * `ancestryOf` is passed in rather than imported so this stays a decision
 * function with no opinion about where takes are kept.
 */
export function reconcilePointer(
  storeHead: string | null,
  projectPointer: string | null,
  known: (id: string) => boolean,
  ancestryOf: (id: string) => readonly string[],
): Divergence | undefined {
  if (projectPointer === storeHead) return undefined;

  if (projectPointer === null) {
    return {
      reason: 'no-pointer',
      projectPointer,
      storeHead,
      adopted: false,
      detail:
        'this project document carries no take pointer but the store has a head. Either the ' +
        'project was reopened from a backup or a copy, or it has never been saved since ' +
        'ghostnote first wrote to it. The store keeps its head; nothing is assumed about what ' +
        'the clips actually contain.',
    };
  }

  if (!known(projectPointer)) {
    return {
      reason: 'unknown-take',
      projectPointer,
      storeHead,
      adopted: false,
      detail:
        `the project document points at take ${projectPointer}, which is not in this store — ` +
        'pruned by retention, or written on another machine. Where the world actually is cannot ' +
        'be derived from what we hold, so nothing moves and nothing is claimed. Surfacing this ' +
        'is the answer; guessing a nearby take would be worse than saying so.',
    };
  }

  const headLine = storeHead === null ? [] : ancestryOf(storeHead);
  const pointerLine = ancestryOf(projectPointer);

  if (headLine.includes(projectPointer)) {
    return {
      reason: 'store-ahead',
      projectPointer,
      storeHead,
      adopted: true,
      detail:
        `the project was last saved at take ${projectPointer}, and this store recorded ` +
        `${headLine.indexOf(projectPointer)} take(s) after it. Those takes were never saved into ` +
        'the project, so the clips on disk are the ones from the saved take — the pointer and ' +
        'the music are written by the same save and are therefore exactly as fresh as each ' +
        "other. The head moves back to the project's pointer; the later takes stay reachable as " +
        'a branch.',
    };
  }

  if (storeHead !== null && pointerLine.includes(storeHead)) {
    return {
      reason: 'store-behind',
      projectPointer,
      storeHead,
      adopted: true,
      detail:
        `the project points at take ${projectPointer}, which is a descendant of this store's ` +
        `head ${storeHead} — the take file landed but the metadata write did not. The project ` +
        'document is the record of what was saved, so the head moves forward to match it.',
    };
  }

  return {
    reason: 'diverged',
    projectPointer,
    storeHead,
    adopted: true,
    detail:
      `the project points at take ${projectPointer} and this store's head is ${String(storeHead)}; ` +
      'neither is an ancestor of the other, so the project document came back on a different ' +
      'branch than the one the store was following. The pointer wins because it was saved with ' +
      "the music it describes; the store's branch is not deleted and stays reachable.",
  };
}

/** An in-memory `ProjectKeySource`, for tests and for running with no Bitwig. */
export class MemoryProjectKeySource implements ProjectKeySource {
  private key: string | null;
  private pointer: string | null = null;
  /** What a `save()` committed — everything after it is lost on `reopen()`. */
  private saved: { key: string | null; pointer: string | null } = { key: null, pointer: null };

  constructor(key: string | null = null, private readonly name?: string) {
    this.key = key;
  }

  async readKey(): Promise<string | null> {
    return this.key;
  }

  async writeKey(key: string): Promise<void> {
    this.key = key;
  }

  async readPointer(): Promise<string | null> {
    return this.pointer;
  }

  async writePointer(takeId: string | null): Promise<void> {
    this.pointer = takeId;
  }

  async hint(): Promise<string | undefined> {
    return this.name;
  }

  /** Model a close-without-save: everything written since the last save is lost. */
  save(): void {
    this.saved = { key: this.key, pointer: this.pointer };
  }

  reopen(): MemoryProjectKeySource {
    const next = new MemoryProjectKeySource(this.saved.key, this.name);
    next.pointer = this.saved.pointer;
    next.saved = { ...this.saved };
    return next;
  }
}
