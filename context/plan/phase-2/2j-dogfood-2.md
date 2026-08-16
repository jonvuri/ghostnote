---
title: Phase 2, session 2j — dogfood round two and revision
kind: plan
state: planned
updated: 2026-08-16
parent: README.md
prev: 2i-dogfood-1.md
next: 2k-closeout.md
scope: Phase 2 dogfood gate, second use and evidence-based revision
evidence: Phase 2 observation record and session 2i
---

# Phase 2, session 2j — dogfood round two and revision

> **Purpose.** Use the surface for a second, different musical task and revise it
> only where the combined evidence justifies a change.

## Entry rule

The operator again starts from a real musical intention. This must be a separate
use, not a replay of session 2i. Use an operator-selected project and leave the
conformance fixture unchanged.

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
