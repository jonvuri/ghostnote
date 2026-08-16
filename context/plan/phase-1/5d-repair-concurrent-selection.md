---
title: Phase 1, session 5d repair — concurrent selection and property writes
kind: plan
state: planned
status: Not started. E26 blocks the 5d proof.
updated: 2026-08-16
parent: 5-proving.md
prev: 5d-concurrent-editing.md
next: 5d-concurrent-editing.md
scope: Repair only; rerun 5d after this session
evidence: E8, E23, E26 · D6, D10, D15
needs: Bitwig foregrounded for the focused property diagnosis
---

# Phase 1, session 5d repair — concurrent selection and property writes

> **Purpose.** Repair the production defects E26 exposed before the 5d proof is
> run again.

## Scope

1. Capture the selection that exists when the executor pipeline starts. Do not
   let a human change before the first lazy cursor point replace it.
2. Keep a verified, non-following cursor on its pinned target across nonstructural
   stages. Do not send a user-selection-changing point for every stage when the
   cursor already owns that target.
3. Preserve the standing rule to re-point after every structural operation.
4. Reproduce the missing pan write with a focused control and an interference
   case. Repair the production path only if the focused measurement confirms a
   product defect.
5. Add offline regressions for selection changes between stages, eager pipeline
   capture, final restore, and any confirmed property-write defect.
6. Leave the 5d human proof for its own rerun after this repair passes.

## Exit criteria

1. A multi-stage pipeline captures the entry selection before other work can
   change it.
2. Human selection changes do not cause a verified held target to re-borrow the
   UI selection on each nonstructural stage.
3. The pipeline sends one final restore and confirms it through readback.
4. The property diagnosis has an independent-handle verdict and a regression
   for every implemented repair.
5. Focused tests, the full offline check, the context check, and
   `git diff --check` pass.

## Out of scope

- claiming Phase 1 exit criterion 2;
- stale-revision and bank-window proof;
- managed A/B or full live conformance.
