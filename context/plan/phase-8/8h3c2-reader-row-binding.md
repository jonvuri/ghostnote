---
title: Phase 8h3c2 — Reader row binding
kind: plan
state: planned
status: Planned. Make the product clip reader bind the requested row on a track with more than one clip.
updated: 2026-10-06
parent: 8h-cache-promotion-and-interface-simplification.md
prev: 8h3d-change-awareness.md
next: 8h3e-cache-machinery-trim.md
evidence: E228, E230, E231; D30
---

# Phase 8h3c2 — Reader row binding

## Why

[E231](../../evidence/experiments/e231-change-awareness.md) found that the
8h3c reader does not bind a requested row other than the row that its cursor
holds for that track. Every read of row 1 on a multi-clip track refused with
`bound-target-mismatch` and bound row 0, also when the entry selection was the
target row. The watch probe, with the same route, bound row 1 for every
request on another track. Single-clip tracks read correctly. The guard
refused each mismatch, so no wrong data was published. But Ghostnote cannot
read most clips in a real project. 8h3e and 8i need every row.

[E228](../../evidence/experiments/e228-cold-read-dealbreaker-check.md) read
rows 1 and 63 with an empty park track that has launcher slots.
[E230](../../evidence/experiments/e230-cold-reader-promotion.md) changed the
park target to the master track, which has no launcher slots, and tested only
row 0.

## Entry

Read E228 (row cases and route), E230, the E231 reader row finding, D30, and
`ClipReader.java`. Use an owned project, never `gn-scale-test` (D29).

## Work

1. Reproduce: a multi-clip track with a distinct clip in rows 0, 1, and 63,
   read in every order, from three entry selections. Record the bound row.
2. Identify the rule that sets the bound row. Test candidates in this order:
   select the row in an earlier task than the point (E228 order); park on an
   owned slot-bearing track instead of the master track; select the slot
   through the cursor clip after the point. Change one variable at a time.
3. Fix the product route with the smallest change that binds the requested
   row. Keep the D30 close, confirmation, and release order, the E99 selection
   lease, and the bound-target guard.
4. Add Java tests for the route order. Add the row matrix to the 8h3c live
   acceptance, with a distinct clip for each row.

## Acceptance criteria

- Reads of rows 0, 1, and 63 on one track return the declared clip in every
  order and entry selection, with zero refusals.
- Repeated reads of alternating rows pass on two tracks.
- The bound-target guard still refuses a forced mismatch.
- The E230 paired, selection, and gate cases still pass at row 0 and at a
  row other than 0.
- Owned projects are closed without saving. The normal archive is deployed,
  with a fresh normal hello.
- Brain check, extension check, context check, and `git diff --check` pass.

## Out of scope

- Change awareness. E231 selected pull only.
- The 8h3e identity and generation promotion.
