---
title: Phase 1, session 5g repair — two-clip property isolation
kind: plan
state: complete
status: Completed 2026-08-16. E36 confirms complete track-and-clip pin
        ownership, independent two-clip readback, and exact cleanup.
updated: 2026-08-16
parent: 5-proving.md
prev: 5g-live-conformance.md
next: 5g-live-conformance.md
scope: Repair only; rerun 5g after this session
evidence: E15, E27, E29, E35, E36 · D6, D10, D15
needs: none
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

## Outcome

The focused probe found a physical cursor ownership failure, not a stale
property value. The allocator assigned clips A and B to different cursors, but
both physical handles followed the second selection to clip B. Independent
readback found clip A empty and both authored notes and pan values in clip B.

The adapter now unpins, points, pins, and confirms both the cursor track and
cursor clip before it records a reusable hold. Direct calls clear their holds
when they return. The executor can still reuse a confirmed hold inside its one
selection-preservation scope. Structural invalidation and E15-F interleaving
are unchanged.

Focused tests pass 87/87. The full offline check passes 543/543. The extension
test, live handshake, context check, and `git diff --check` pass. The focused
live probe passes 8/8 and restores the complete baseline. E36 records the
diagnosis, repair, verification, and cleanup. Rerun Session 5g next.
