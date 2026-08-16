# Repository instructions

Use ASD-STE100 Simplified Technical English for prose in documentation and code
comments. Keep sentences concise, direct, and easy to read. When you already
change a document or comment, correct unclear prose in the part that you touch.
Do not start an unrelated rewrite.

## Implementation sessions

1. Read `context/NOW.md`, then read the linked plans, evidence, decisions, and
   code needed for the named session.
2. Derive the work and acceptance criteria from those sources. Ask a question
   only when a missing answer can materially change the result.
3. Implement the complete session. Add or update tests and run the checks that
   the acceptance criteria require. Leave live projects and fixtures at their
   documented baseline, with no test residue.
4. Update the relevant context documents. Make `context/NOW.md` a short,
   accurate handoff for the next session.
5. Stage only the session changes for review. Do not commit them. End with a
   concise result summary, verification results, and a short suggested commit
   message.
6. Do a tiny retrospective before the handoff. Check whether clearer
   instructions or references could have prevented an issue, and whether context
   management or lookup across documentation and code could be more efficient.
   Record only a brief, actionable finding; state that no change is needed when
   there is none.

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
   tests, and documentation that overstates the implementation.
5. Report findings in priority order with file and line references. If there are
   no high-priority findings, say so directly and note any remaining verification
   gap. Do not change the implementation unless the user asks for fixes.
