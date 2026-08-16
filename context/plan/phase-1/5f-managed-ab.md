---
title: Phase 1, session 5f — managed A/B
kind: plan
state: planned
status: Not started.
updated: 2026-08-16
parent: 5-proving.md
prev: 5e-refusal-boundaries.md
next: 5g-live-conformance.md
scope: Phase 1 exit criterion 4
evidence: E16w, E17, E20a/b, E22 · D14, D17, D18
needs: Bitwig foregrounded; a human at the keyboard
---

# Phase 1, session 5f — managed A/B

> **Purpose.** Prove the complete human A/B workflow for both managed
> representations, without a ghostnote-specific switcher.

## Scope

1. Create a layer-chain alternate through the production surface. Switch it from
   inside Bitwig with container-local exclusive solo. Confirm that one control
   selects one audible device alternate.
2. Create a clip-block alternate through the production surface. Switch it from
   inside Bitwig with per-slot launch. Confirm the stored launch behavior and
   beat-aligned comparison.
3. Record one mixed instruction that creates one device event and one clip event
   with the same correlation id. Confirm distinct result ids and independent
   controls. Switching one must not switch the other.
4. Smoke `copy_track`. Confirm that it is an ordinary-use record and does not
   enter managed-event counts or take lifecycle.
5. Read the observation report, then restore its exact initial value and remove
   every project object created by the probe.

## Out of scope

- a custom take switcher or daemon API;
- a compound take or shared switch;
- track copy as a managed representation;
- new branch capability.

## Exit criteria

1. A human can A/B a layer-chain alternate through one exclusive solo control.
2. A human can A/B a clip-block alternate through per-slot launch.
3. A mixed instruction produces two correlated but independent managed events.
4. Ordinary track copy remains outside managed-event bookkeeping.
5. Production results, readback, and the observation record agree.
6. Cleanup restores all project objects, selection, and observation data.
7. Focused tests, the full offline check, the context check, and
   `git diff --check` pass.

If an existing mechanism cannot meet this workflow, record the defect and plan a
repair session. Do not add capability inside this proving session.
