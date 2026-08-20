---
title: Phase 2, session 2j — dogfood round two and revision
kind: plan
state: complete
status: Complete 2026-08-20. E48 records the accepted second task, the dogfood
        comparison, and operation wall-clock measurement.
updated: 2026-08-20
parent: README.md
prev: ../phase-1/6-async.md
next: 2k-closeout.md
scope: Phase 2 dogfood gate, second use and evidence-based revision
evidence: E45, E47, E48, and the Phase 2 observation record
---

# Phase 2, session 2j — dogfood round two and revision

> **Purpose.** Use the surface for a second, different musical task and revise it
> only where the combined evidence justifies a change.

## Entry rule

The operator again starts from a real musical intention. This must be a separate
use, not a replay of session 2i. Use an operator-selected project and leave the
conformance fixture unchanged.

The 2i long-clip follow-up and session 2x must be complete. Known repair work
does not count as the second dogfood use.

## Scope

1. Use a different musical task, vocabulary path, or transformation path from
   session 2i.
2. Compare tool choice, call count, refusals, result usefulness, reversals, and
   operator responses across both sessions.
3. Change public granularity or wording only for a repeated pattern across the
   two uses, unless one result exposes a safety or correctness fault.
4. Give every public schema or wording change a new description version. Keep
   old frozen artifacts intact.
5. Add focused regression for each change and rerun the affected live path.

## Exit criteria

1. A second real musical task reaches a useful or clearly rejected outcome.
2. The two dogfood records are distinct and identify their surface versions.
3. Each revision cites repeated evidence or a named safety or correctness fault.
4. The final ordinary MCP surface can create musically useful clip content
   without direct DAW interaction.
5. Focused tests, affected live checks, full offline tests, typecheck, context
   check, and `git diff --check` pass.

## Outcome

Complete. The operator asked for a Harmony track copy with two different minor
progressions in the Lead key. The ordinary MCP surface created and named
`Harmony – Open Minor`, added two 32-beat clips, and wrote 43 verified notes.
The operator auditioned and kept both F Dorian progressions.

The accepted operation completed in 34,470 ms at the server. The polling client
observed 34,569 ms. Operation status now reports live `elapsedMs` and freezes it
at terminal state. `ghostnote-description-v4` identifies the returned status
shape. The prior description artifacts stay frozen.

E45 and E48 both show slow exact reads and verification. Session 2x already made
that cost non-blocking and cancellation-safe. Direct timing is the only new
revision that the repeated evidence justifies. The second use had no refusal,
mismatch, veto, or repeated wording and granularity problem.

## Retrospective

Record server and client polling time separately. This keeps polling delay out
of project-work latency.
