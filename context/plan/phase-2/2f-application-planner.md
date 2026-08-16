---
title: Phase 2, session 2f — musical application planner
kind: plan
state: planned
updated: 2026-08-16
parent: README.md
prev: 2e-clip-lifecycle.md
next: 2g-mcp-surface.md
scope: Phase 2 patch materialization and protection
evidence: E24, E32–E39 · D8–D10, D15, D16, D18–D20
---

# Phase 2, session 2f — musical application planner

> **Purpose.** Join pure musical intent to the existing verified write engine
> without giving musical code a second mutation path.

## Scope

1. Read target clip content through the workspace and materialize a complete
   musical patch before mutation.
2. Apply generation and transformation pipelines in declared order.
3. Produce explicit typed operations for each MIDI channel. Preserve every note
   property not changed by the patch.
4. Preflight all targets, rows, grids, clip-block destinations, fidelity floors,
   and expected revisions before the first operation applies.
5. Keep ordinary generation and transformation direct and stash-backed.
6. For requested variations, mint the required clip block first and write each
   result into its own take. For fidelity-required protection, require an
   existing suitable block or the explicit creation procedure settled in 2a.
7. Return musical results, material differences, warnings, changeset identities,
   readback disagreements, and reversal qualifications in one planner result.
8. Use `Workspace.apply` as the only project-write seam.

## Out of scope

- MCP names, schemas, titles, or descriptions;
- track copying as a protection mechanism;
- compound take linkage across tracks or device alternates;
- async completion.

## Exit criteria

1. Pure planner tests cover generation, transformation, several channels,
   several clips, triplets, expression, and requested variations.
2. A failed preflight applies no stage and creates no partial clip block.
3. Every successful project mutation appears in the stash and is verified by
   readback.
4. Direct work creates no alternate unless the request or D18 fidelity floor
   requires one.
5. Variation work uses clip blocks and never track copies.
6. Directed `revert_change` restores the planner's exact members and reports all
   qualifications through the existing fidelity path.
7. Focused tests, full offline tests, typecheck, context check, and
   `git diff --check` pass.
