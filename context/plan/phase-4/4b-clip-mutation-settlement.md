---
title: Phase 4, session 4b follow-up — clip mutation settlement
kind: plan
state: complete
status: Complete. E54 bounds writer settlement, observer wake-up, exact retry,
        and complete-state conflict reporting without mutation replay.
updated: 2026-08-21
parent: README.md
prev: 4b-note-completion-signals.md
next: 4c-direct-parameter-core.md
scope: Ordered clip mutation batches, bounded completion, and exact verification
evidence: E2, E8, E15, E19, E20b, E51–E54 · D6, D9, D10, D15
---

# Phase 4, session 4b follow-up — clip mutation settlement

> **Purpose.** Make settlement and verification constant in note count when one
> stable clip target and one fixed set of writer pages permit it.

## Carry-in

E53 finds that basic note count does not increase the current request, stage,
settle, page, or verification counts. Distinct clips, writer pages, and
property dependency turns do. `addNoteStepObserver()` is a wake hint for most
mutations, not a completion fence. Four enable fields produce no callback.

Use an eligible event only to start exact verification early. Use bounded
polling or the fixed fallback for the silent fields and callback timeout. Exact
bulk readback remains the success proof.

E15-F remains binding. `note.props` reads the `NoteStep` data held when the
controller turn began. Property stages for different clips cannot be hoisted
into one trailing turn. The safe target is controlled batching within one
confirmed clip and page set, not unrestricted concurrent requests.

## Scope

1. Define one semantic clip-mutation boundary around a confirmed durable track,
   slot, pinned cursor, grid, and writer-page set.
2. Merge compatible same-target note frames before transport. Send one ordered
   extension request for each dependency turn that Bitwig requires.
3. Keep note creation before property reads. Keep each cross-clip property stage
   directly behind the create stage for that same clip, as E15-F requires.
4. Use a measured note event as a completion fence or wake hint only at the
   strength recorded by the prior session. Otherwise use bounded expected-state
   polling or the existing measured fixed fallback.
5. Perform one final bulk exact read per touched clip after its last mutation.
   Reconcile the complete expected state once.
6. Retry target checks and readback. Do not replay a mutation unless its
   idempotence is explicit. Calculate a remaining delta or report a conflict
   after an ambiguous partial result.
7. Treat unrelated human activity as harmless wake noise. Treat an incompatible
   same-target edit as a conflict that preserves the captured checkpoint.
8. Extend timing traces with observer arm, first callback, first complete read,
   retries, fallback, conflict, and final reconciliation.
9. Re-run plain, expression-rich, long, triplet, clear, replace, reversal,
   interference, cancellation, selection-restoration, and cleanup workflows.

## Required boundaries

- Do not hoist `note.props` across clip targets or writer pages when the
  turn-start clip invariant would change.
- Do not use a general project or undo signal as success proof.
- Do not retry a non-idempotent mutation after an ambiguous result.
- Do not reduce a settle budget without a new live boundary measurement.
- Do not skip dual-grid, all-channel, expression, target, pin, page-reset,
  checkpoint, or exact-read verification.
- Do not add shared-cursor concurrency. Parallel work requires independent,
  confirmed cursor resources.
- Do not redesign the public tools or background-operation protocol.

## Exit criteria

1. For one clip and a fixed required page set, mutation settlement and final
   verification counts do not grow with note count.
2. The implementation reports its remaining cost as a function of distinct
   clips, required writer pages, and proven dependency turns.
3. The note create-before-properties rule and E15-F cross-clip ordering remain
   covered by offline and live regressions.
4. Event-based completion cannot return success before exact bulk readback
   agrees. Its timeout path uses the recorded safe fallback.
5. Same-target interference produces a conflict or an exact intended result.
   It never silently overwrites an unrecognized edit.
6. The evidence session records a performance gate before implementation, and
   the final representative workflow meets that gate without reduced fidelity.
7. Exact read, reversal, cancellation, selection restoration, and the accepted
   Phase 2 project have no material regression.
8. The scratch fixture and accepted project return to their exact entry state.
9. Focused tests, full conformance, the brain check, extension tests, context
   check, and `git diff --check` pass.

## Performance gate

E53 measured 11,444 ms for one controlled two-clip expression write. The final
representative workflow must complete in at most 9,000 ms. This bound requires
at least a 20% reduction. It must keep both exact 32-beat reads, all expression
fields, reversal, and cleanup.

## Retrospective target

Record whether the saved time came from fewer controller turns, earlier wake-up,
or fewer exact reads. Do not describe one source as another.

## Result

E54 closes the session. Compatible adjacent note writes merge only within one
clip, channel, and grid. Confirmed writer targets, grids, and pages remain valid
for one batch. Page zero is restored and verified once. E15-F ordering remains
unchanged.

The product can use one exact target-generation note event as a wake hint. The
fixed fallback remains active for silence or mismatch. Exact bulk readback is
still the success proof.

Final reconciliation compares the complete expected note state on all 16 MIDI
channels. One incomplete read can retry after settlement. The executor never
replays an ambiguous mutation. It reports unexpected same-target notes and
partial staged rejection as conflicts. A rejected later stage does not erase
the ownership or inverse of a stage that already landed. Exact before-and-after
state limits that ownership to changed targets and all channels of a changed
clip.

The controlled two-clip expression workflow measured 7,524 and 7,749 ms. Its
7,749 ms median passes the 9,000 ms gate and is 32 percent below the 11,444 ms
baseline. It kept four dependency stages and eight exact bulk page reads. The
saved time came from fewer controller and page turns, not fewer exact reads or
the single-clip observer.

Full conformance passed 54 cases with six expected skips. The brain check
passed 670 tests. Long-clip, interference, cancellation, reversal, cleanup,
extension, context, diff, and accepted-project baseline checks passed.
