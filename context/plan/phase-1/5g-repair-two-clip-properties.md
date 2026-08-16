---
title: Phase 1, session 5g repair — two-clip property isolation
kind: plan
state: planned
status: Not started. E35 requires this repair before 5g runs again.
updated: 2026-08-16
parent: 5-proving.md
prev: 5g-live-conformance.md
next: 5g-live-conformance.md
scope: Repair only; rerun 5g after this session
evidence: E15, E27, E29, E35 · D6, D10, D15
needs: Bitwig foregrounded for focused diagnosis
---

# Phase 1, session 5g repair — two-clip property isolation

> **Purpose.** Explain and repair the cross-clip pan read that E35 exposed under
> full-suite load.

## Scope

1. Reproduce the `C-twoclips` ordering state with a focused live probe. Include
   the earlier read, clear, plain-write, and expression-write sequence that
   leaves the cursor pool warm.
2. Read each result through a cursor that did not write it, or re-point the
   writer away and back. Decide whether clip B persisted pan `-0.25` or only
   reported it through stale cursor state.
3. Record cursor allocation, pin state, confirmed target, and the frames in each
   generated write and property stage. Do not infer physical cursor ownership
   from the allocator cache.
4. Repair the production path or the conformance oracle according to the
   independent-read verdict. Preserve structural invalidation, selection
   restoration, and the E15-F rule that a property stage must begin on its own
   clip.
5. Add offline regressions for the confirmed mechanism. Include two clips with
   different property values after prior reads and selection restoration.
6. Run the focused live proof and the full offline check. Leave the complete
   live conformance run for the separate 5g rerun.

## Exit criteria

1. Independent readback gives each clip its own authored pan value.
2. No cursor cache can suppress a required point after the physical handle has
   moved or started to follow selection.
3. The fake models the confirmed trap, or the conformance oracle uses a truly
   independent handle if the product write was already correct.
4. Selection, cursor state, fixture clips, tracks, scenes, observation data,
   status, and transport return to their recorded baseline.
5. Focused tests, the full offline check, the context check, and
   `git diff --check` pass.

## Out of scope

- claiming Session 5g complete;
- changing note-property fidelity or pressure policy;
- changing bank-window policy, managed A/B, or CI policy;
- adding a new product capability.

After this repair, rerun Session 5g in one complete invocation. Do not promote
an isolated `C-twoclips` pass to the full-suite verdict.
