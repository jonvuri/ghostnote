---
title: Phase 1, session 5d — concurrent editing
kind: plan
state: planned
status: Not started. Depends on completed session 5a.
updated: 2026-08-16
parent: 5-proving.md
prev: 5c-drag-boundaries.md
next: 5e-refusal-boundaries.md
scope: Phase 1 exit criterion 2
evidence: E8, E23 · D6, D10, D15
needs: Bitwig foregrounded; a human at the keyboard
---

# Phase 1, session 5d — concurrent editing

> **Purpose.** Re-run the E8b interference proof through the production executor
> and include the selection guarantee delivered by session 5a.

## Scope

1. Pin a production write target by durable track identity and verified clip
   row.
2. Stream a comparable multi-write batch while the operator clicks tracks,
   switches clips, and drags a clip outside the write target.
3. Read the target through an independent handle. Confirm that every write lands
   on the pinned target and nowhere else.
4. Measure the user selection. The executor may borrow once and must restore the
   original selection once after apply, verify, and reporting finish.
5. Revert the owned write, remove the probe clip if it created one, and restore
   the initial selection.
6. Keep the probe runnable as a human-assisted standing regression.

## Out of scope

- the B5 drag-boundary measurements;
- stale-revision rejection;
- managed A/B;
- full live conformance.

## Exit criteria

1. All requested writes land on the pinned target through observed user changes.
2. Independent readback finds no write on an unintended target.
3. The selection count is exactly one borrow and one restore, and the final
   selection matches the initial selection.
4. Revert restores the owned content exactly and cleanup leaves no residue.
5. Focused tests, the full offline check, the context check, and
   `git diff --check` pass.
