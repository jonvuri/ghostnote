/**
 * Stash refusals.
 *
 * Same posture as `contract/errors.ts`: each one exists because the alternative
 * is a SILENT wrong result, and the message names the measurement or the rule it
 * enforces. A stash that quietly does nothing is the specific failure D5 forbids
 * ("a revert never silently under-delivers") — so an empty slice and an unknown
 * changeset are errors rather than no-ops.
 *
 * ⚠ Three errors were RETIRED with the store (D17 rev), and the reason is worth
 * keeping so nobody re-derives them: `StoreFormatError` and `TakeIdError` both
 * existed because a take named a FILE, and nothing is on disk any more;
 * `ProjectKeyError` guarded a per-project store directory that no longer exists
 * (D17a). `TakeCycleError` went with `graph.ts` — there is no parent pointer to
 * loop.
 */

export class StashError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/**
 * ⚠ The id is not in this session's stash — and this is D19's structural bound,
 * not a lookup failure.
 *
 * *"Reversal is DIRECTED and rides the ordinary write surface, structurally
 * bounded to the session's own changesets."* The stash holds exactly the batches
 * this session ran, so "reverse changeset X" is unaskable for anything else: the
 * bound is the shape of the API rather than a check somebody has to remember.
 */
export class ChangesetNotFoundError extends StashError {
  constructor(readonly id: string) {
    super(
      `changeset ${id} is not in this session's stash. Reversal is bounded to the changesets ` +
        'this session itself recorded (D19) — nothing survives a restart, and a batch run by ' +
        'another session belongs to that session. Undoing anything else is a human verb, in ' +
        "Bitwig's own undo history.",
    );
  }
}

/**
 * ⚠ A partial revert selected nothing.
 *
 * The one failure mode a partial revert must never have is doing nothing while
 * reporting success — the human hears no change and concludes the stash is
 * broken, or worse, that the reversal happened. So an empty selection is loud.
 */
export class EmptySliceError extends StashError {
  constructor(readonly available: readonly string[]) {
    super(
      'this slice selects none of the addresses in the changeset. A partial revert that matches ' +
        'nothing would apply zero ops and report success, which is indistinguishable from a ' +
        `revert that worked. The changeset covers: ${available.join(', ') || '(nothing)'}`,
    );
  }
}

/** Recording an id the stash already holds would silently rewrite the record. */
export class DuplicateChangesetError extends StashError {
  constructor(readonly id: string) {
    super(
      `changeset ${id} is already in this session's stash. Overwriting it would replace the one ` +
        'record of what the world looked like before that batch — which is the "before" a ' +
        'reversal replays and the fingerprint a later write is checked against (D19).',
    );
  }
}
