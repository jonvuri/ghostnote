/**
 * Store refusals.
 *
 * Same posture as `contract/errors.ts`: each one exists because the alternative
 * is a SILENT wrong result, and the message names the measurement or the rule it
 * enforces. A store that quietly does nothing is the specific failure D5 forbids
 * ("a revert never silently under-delivers") — so an empty slice, a missing take
 * and a foreign format are all errors rather than no-ops.
 */

export class StoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** The id is not in this project's store — pruned, or from another project. */
export class TakeNotFoundError extends StoreError {
  constructor(readonly id: string, detail = '') {
    super(
      `take ${id} is not in this store${detail === '' ? '' : `: ${detail}`}. It may have been ` +
        'pruned by retention, or it may belong to another project — take contents are ' +
        'project-keyed and never migrate between projects.',
    );
  }
}

/**
 * ⚠ The on-disk record was written by a different format or a different contract.
 *
 * `version.ts` is explicit that comparison is exact equality and the answer to a
 * v1 is to bump, not to negotiate. A take half-understood is worse than a take
 * refused, because the half we understand is the stash a revert would replay.
 */
export class StoreFormatError extends StoreError {
  constructor(readonly file: string, detail: string) {
    super(`${file} is not readable by this build: ${detail}`);
  }
}

/**
 * ⚠ A partial revert selected nothing.
 *
 * The one failure mode a partial revert must never have is doing nothing while
 * reporting success — the human hears no change and concludes the store is
 * broken, or worse, that the revert happened. So an empty selection is loud.
 */
export class EmptySliceError extends StoreError {
  constructor(readonly available: readonly string[]) {
    super(
      'this slice selects none of the addresses in the take. A partial revert that matches ' +
        'nothing would apply zero ops and report success, which is indistinguishable from a ' +
        `revert that worked. The take covers: ${available.join(', ') || '(nothing)'}`,
    );
  }
}

/**
 * The project key is not usable as a directory name.
 *
 * Refused rather than sanitized: a munged key silently maps two projects onto one
 * store, which merges two humans' take logs. D6's "identity, never index" applies
 * to projects too.
 */
export class ProjectKeyError extends StoreError {
  constructor(readonly key: string) {
    super(
      `project key ${JSON.stringify(key)} is not a safe store key. Keys must be 1-128 characters ` +
        'of [A-Za-z0-9._-] — they name a directory, and a sanitized key could collide with ' +
        'another project and merge two take logs.',
    );
  }
}

/** A take id that cannot safely name a file. Same reasoning as `ProjectKeyError`. */
export class TakeIdError extends StoreError {
  constructor(readonly id: string) {
    super(
      `take id ${JSON.stringify(id)} cannot name a file. Ids must be 1-128 characters of ` +
        '[A-Za-z0-9._-]; the executor mints UUIDs, so this is a caller supplying its own.',
    );
  }
}

/** Appending an id the store already holds would silently rewrite history. */
export class DuplicateTakeError extends StoreError {
  constructor(readonly id: string) {
    super(
      `take ${id} is already in this store. Overwriting it would rewrite a take a human may ` +
        'already have navigated to, which is the one thing the log must never do (§8g).',
    );
  }
}

/** The parent chain loops. Only reachable from a hand-edited or corrupt store. */
export class TakeCycleError extends StoreError {
  constructor(readonly id: string) {
    super(`the parent chain of take ${id} contains a cycle; the store graph is corrupt`);
  }
}
