/**
 * What a take looks like on disk.
 *
 * The store is a SERIALIZER, not a second model. Session 1's `Take` already
 * carries everything §8f's diff and this session's partial revert need — stash,
 * verify, targets, the derived fidelity labels — so the on-disk record wraps it
 * with exactly the three facts a take value cannot know about itself:
 *
 *   `projectKey`  which project's world this stash describes (D5: take contents
 *                 are project-keyed; a stash replayed into another project would
 *                 address `channelId`s that do not exist there)
 *   `parent`      the graph edge. A parent pointer and a head pointer are very
 *                 nearly the whole branching model, and deliberately so —
 *                 PHASE-1 §Risks names a general VCS as the temptation here.
 *   `label`       "that take had a better hi-hat" (D5) implies the human can name
 *                 one. Cheap now, and it doubles as retention's protection mark.
 *
 * ⚠ TWO version fields, and they are not redundant. `contract` is stamped by the
 * executor and says which adapter vocabulary the stash speaks; `format` says how
 * this wrapper is laid out. They move independently: adding a `label` field is a
 * format change that leaves every stash readable, while a contract bump
 * invalidates the stash itself. `version.ts` is explicit that comparison is exact
 * equality and the answer to a v1 is to bump rather than negotiate.
 */
import { randomUUID } from 'node:crypto';
import { open, rename } from 'node:fs/promises';

import { CONTRACT_TAG, type AddressKey, type ContractTag, type Fidelity } from '../contract/index.js';
import type { Take } from '../engine/index.js';
import { StoreFormatError } from './errors.js';

/**
 * The on-disk layout version. Bumped when the WRAPPER changes shape.
 *
 * PHASE-1-SESSION-2 §Risks: "give the on-disk format a version field on day one —
 * the project already has a `CONTRACT_TAG` idiom to copy." This is that copy, and
 * it exists so the schema calcifying before Phase 3 knows what it needs is a
 * cheap problem rather than an expensive one.
 */
export const STORE_FORMAT = 1;

export interface StoredTake {
  readonly format: typeof STORE_FORMAT;
  readonly projectKey: string;
  /** `null` for a root take — the first thing this project ever recorded. */
  readonly parent: string | null;
  /** Human-given. Its presence also makes a take exempt from retention. */
  readonly label?: string;
  readonly storedAtMs: number;
  /** Session 1's value, verbatim. Everything else here is what it cannot know. */
  readonly take: Take;
}

/** What `list()` returns — enough for a chooser, without loading every stash. */
export interface TakeSummary {
  readonly id: string;
  readonly parent: string | null;
  readonly label?: string;
  readonly createdAtMs: number;
  /** The worst label across the take's write-set. `none` means part of it is gone. */
  readonly fidelity: Fidelity;
  readonly applied: boolean;
  readonly addresses: readonly AddressKey[];
  /**
   * ⚠ Exit criterion 4: what this take could not restore even in principle,
   * available WITHOUT planning a revert. A `none`-fidelity entry has to be
   * visible before someone commits to reverting, not discovered halfway through.
   */
  readonly unrestorable: readonly { readonly key: AddressKey; readonly why: string }[];
  readonly isHead: boolean;
  readonly children: readonly string[];
}

/** A file in the store directory that this build refuses to read, and why. */
export interface UnreadableTake {
  readonly file: string;
  readonly why: string;
}

/** The per-project metadata file. Small, rewritten atomically on every change. */
export interface StoreMeta {
  readonly format: typeof STORE_FORMAT;
  readonly contract: ContractTag;
  readonly projectKey: string;
  /** A human-readable project name, for identifying orphaned stores. NEVER the key. */
  readonly projectHint?: string;
  /** Where this store believes the world is. See `project.ts` on who wins a disagreement. */
  readonly head: string | null;
  readonly createdAtMs: number;
  readonly updatedAtMs: number;
}

export function emptyMeta(projectKey: string, nowMs: number): StoreMeta {
  return {
    format: STORE_FORMAT,
    contract: CONTRACT_TAG,
    projectKey,
    head: null,
    createdAtMs: nowMs,
    updatedAtMs: nowMs,
  };
}

/**
 * Read a stored take back, refusing anything this build cannot fully understand.
 *
 * Deliberately NOT a schema validator. It checks the three things whose absence
 * would make the rest a guess — the format, the contract stamp, and the presence
 * of the two snapshots a revert replays — and trusts the rest, because the file
 * was written by this program and a full validator here would be a second copy
 * of the type definitions that can drift from them.
 */
export function parseStoredTake(file: string, text: string): StoredTake {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    throw new StoreFormatError(file, `not valid JSON (${(error as Error).message})`);
  }
  if (typeof raw !== 'object' || raw === null) throw new StoreFormatError(file, 'not an object');
  const record = raw as Partial<StoredTake>;

  if (record.format !== STORE_FORMAT) {
    throw new StoreFormatError(
      file,
      `store format ${String(record.format)}, this build reads ${STORE_FORMAT}`,
    );
  }
  const take = record.take;
  if (take === undefined || typeof take !== 'object') throw new StoreFormatError(file, 'no take');
  if (take.contract !== CONTRACT_TAG) {
    throw new StoreFormatError(
      file,
      `written by contract ${String(take.contract)}, this build speaks ${CONTRACT_TAG}. The stash ` +
        'is in a vocabulary this adapter no longer shares, so replaying it would be a guess.',
    );
  }
  if (typeof take.id !== 'string' || take.stash === undefined || take.verify === undefined) {
    throw new StoreFormatError(file, 'take is missing id, stash or verify');
  }
  if (typeof record.projectKey !== 'string') throw new StoreFormatError(file, 'no projectKey');
  if (record.parent !== null && typeof record.parent !== 'string') {
    throw new StoreFormatError(file, 'parent must be a take id or null');
  }
  return record as StoredTake;
}

export function parseMeta(file: string, text: string): StoreMeta {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    throw new StoreFormatError(file, `not valid JSON (${(error as Error).message})`);
  }
  const meta = raw as Partial<StoreMeta>;
  if (meta.format !== STORE_FORMAT) {
    throw new StoreFormatError(file, `store format ${String(meta.format)}, this build reads ${STORE_FORMAT}`);
  }
  if (typeof meta.projectKey !== 'string') throw new StoreFormatError(file, 'no projectKey');
  return meta as StoreMeta;
}

/**
 * ⚠ Write-then-rename, because a crash mid-write must not leave an unreadable
 * store (PHASE-1-SESSION-2 §Risks names it and calls it "worth the twenty
 * minutes now").
 *
 * `rename` within a directory is atomic on every filesystem we target, so a
 * reader sees either the old file or the new one and never a truncated take. The
 * `sync` before the rename is what makes that true across a power loss rather
 * than only across a process crash; the temp name carries a random suffix so two
 * writers cannot collide on it.
 */
export async function writeAtomic(path: string, text: string): Promise<void> {
  const tmp = `${path}.tmp-${randomUUID().slice(0, 8)}`;
  const handle = await open(tmp, 'w');
  try {
    await handle.writeFile(text, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(tmp, path);
}

/** Stable, readable JSON — these files are meant to be greppable by a human. */
export const encode = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;
