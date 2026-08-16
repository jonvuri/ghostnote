---
title: Phase 1, session 5d repair — owned cleanup fingerprint
kind: plan
state: planned
status: Planned 2026-08-16 after E30 stopped the third 5d attempt during setup.
updated: 2026-08-16
parent: 5-proving.md
prev: 5d-concurrent-editing.md
next: 5d-concurrent-editing.md
scope: Repair only; rerun 5d after this session
evidence: E26, E27, E28, E29, E30 · D6, D15
needs: Bitwig foregrounded for the focused live cleanup sweep
---

# Phase 1, session 5d repair — owned cleanup fingerprint

> **Purpose.** Keep owned cleanup safe when live note readback contains
> host-normalized properties that were absent from the write recipe.

## Scope

1. Keep an immutable creation fingerprint before each owned clip is created.
2. Match early cleanup against the complete note count and every authored note
   field. Permit only extra fields that independent readback supplies.
3. Promote a verified independent read to the exact cleanup fingerprint before
   the larger grid capture or human prompt.
4. After promotion, require an exact fingerprint. Refuse if any field changes
   or if a note is added or removed.
5. Keep source and destination occupancy checks and durable addressing
   unchanged.
6. Add focused tests for enriched readback, changed authored fields, added
   notes, exact promotion, and post-promotion drift.
7. Run a focused live sweep that creates, verifies, promotes, and removes both
   owned clips. Leave the human concurrent-editing proof for a separate rerun.

## Exit criteria

1. Host-supplied properties do not block cleanup before exact promotion.
2. A changed authored field or a different note set blocks early cleanup.
3. Independent readback becomes the exact cleanup fingerprint before later
   setup work can fail.
4. Any post-promotion change blocks cleanup.
5. The focused live sweep removes both owned clips and restores the complete
   fixture baseline without directed cleanup.
6. Focused tests, the full offline check, the context check, and
   `git diff --check` pass.

## Out of scope

- claiming Phase 1 exit criterion 2;
- changing production note fidelity or cursor behavior;
- stale-revision, bank-window, managed A/B, or full conformance proof.

## Session retrospective

No finding yet.
