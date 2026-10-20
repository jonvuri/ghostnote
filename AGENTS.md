# Repository instructions

Use ASD-STE100 Simplified Technical English for prose in documentation and code
comments. Keep sentences concise, direct, and easy to read. When you already
change a document or comment, correct unclear prose in the part that you touch.
Do not start an unrelated rewrite.

## Reload the Bitwig controller extension

Always defer controller replacement in Bitwig Settings to the operator. Do not
try to remove or add controllers through computer use. Mouse and keyboard focus
in this view are unreliable, including for the operator. Do not retry selectors
or search for keyboard workarounds.

Prepare and deploy the archive from `extension/`: use `./gradlew copyExtension`
for normal `ghostnote`, or `./gradlew copyProbeExtension` for research
`ghostnote probe`. Both write the same archive file, so deploy one at a time.
Then ask the operator to replace the controller with the required product.
State that full removal and the final matching product in the complete list
are needed. A power toggle or an earlier duplicate can
load cached Java classes. The orange circular-arrow button adds detected
controllers; it does not reload the extension.

Wait for the operator to confirm replacement. Then run `npm run probe:hello`
from `brain/`. Check the profile, method count/hash, fresh initialization time,
and deliberate build markers before live work.

## Live work

Check the current project, target, and selection before a live write. Check
running probe drivers and Ghostnote clients for competing work; use process
names that match the current session. Run one foreground driver chain and one
live writer at a time. Do not stop unrelated processes.

Keep input validation, ownership and freshness guards, selection protection,
and independent post-write readback ([D15](context/decisions/d15-verification-discipline-settled-2026-07-25.md)).
A writer echo is not readback. After an uncertain write, inspect the state;
do not automatically repeat the write. Native research writes also keep their
write lock and uncertain-state latch.

Remove owned scratch objects and check the relevant preserved state. Exact
file restoration is required when the session tests saved-fixture persistence
or promises exact saved-file preservation. Do not apply it to every scratch
test. Claims belong to one server session and do not survive a new thread or
resume. The normal profile has no `transport.stop`; the operator stops playback
after a launch.

## Implementation sessions

1. Read `context/NOW.md`, then read the linked plans, evidence, decisions, and
   code needed for the named session.
2. Derive the work and acceptance criteria from those sources. Ask a question
   only when a missing answer can materially change the result.
   - When the session adds or changes a live path, read the
     [performance ledger](context/contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md)
     first. Follow its rules for cost models and measurements. An unchanged
     path can cite its existing model. New research probes need bounded host
     work and memory; they do not need a full product performance study.
3. Implement the complete session. Match verification to the changed boundary
   and the acceptance criteria: documentation needs link and diff checks;
   offline behavior needs relevant tests; host behavior needs a focused live
   check. Broaden checks for shared changes, failures, or unresolved risks.
   Leave live projects and fixtures at their agreed baseline, with no test
   residue.
   - The call-budget tests (`brain/src/surface/call-budget.test.ts` and the
     live adapter frame test) fail when a host call is added. When a budget
     changes on purpose, update the test and the ledger, and state the cost
     in the E record. Remeasure when host calls, traversal, waits, allocation,
     or admitted limits change. Use comparable per-call results to assess a
     regression over 20 percent. Repeat only when safe and needed to separate
     timing noise from a regression; never repeat an uncertain write for timing.
   - Tool descriptions are part of the implementation. When a change makes a
     tool description inaccurate or incomplete, update the description in the
     same session and bump `TOOL_DESCRIPTION_VERSION`
     (`brain/src/surface/description-cohort.ts`) and its public artifact. Do
     not defer a description change to a later or dogfood session. Report the
     new version when it changes. Use the
     [tool maintenance checklist](context/README.md#tool-maintenance) for its
     consumers.
4. Update the relevant context documents. Make `context/NOW.md` a short,
   accurate handoff for the next session: the next step, material to
   preserve, live state, and facts. Do not keep open items in NOW. Plan
   each item worth doing as an explicit session, or add it to a planned
   session, with a source link. Record any other item as a limit in its E
   record only.
5. Stage only the session changes for review. Do not commit them. End with a
   concise result summary, verification results, and a short suggested commit
   message.
6. Check whether clearer instructions or references could have prevented an
   issue. Record a brief retrospective only when there is an actionable lesson.

Use E records for measured results and D records for durable design decisions.
Add an index row with each new record. Routine planning and documentation
cleanup do not need a new E or D record. Keep the existing records unchanged.

## Review sessions

Treat the work as a review session when the initial prompt asks to review,
inspect, audit, or approve staged changes.

1. Read `context/NOW.md` and the acceptance criteria for the session under
   review.
2. Review the staged diff as the primary artifact. Check repository status for
   relevant unstaged or untracked files.
3. Confirm that the changes meet the acceptance criteria and that the reported
   verification is sufficient. Run focused, non-destructive checks when useful.
4. Look first for high-priority problems: incorrect behavior, data loss,
   permission-boundary errors, regressions, missing failure handling, missing
   tests, and documentation that overstates the implementation. Include
   performance regressions: a changed call budget or a ledger number that
   moved without a stated cause.
5. Report findings in priority order with file and line references. If there are
   no high-priority findings, say so directly and note any remaining verification
   gap. Do not change the implementation unless the user asks for fixes.
