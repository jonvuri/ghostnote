---
title: Phase 1, session 5f — managed A/B
kind: plan
state: complete
status: Complete 2026-08-16. Both native controls, mixed bookkeeping, and ordinary track copy pass live (E34).
updated: 2026-08-16
parent: 5-proving.md
prev: 5e-refusal-boundaries.md
next: 5g-live-conformance.md
scope: Phase 1 exit criterion 4
evidence: E16w, E17, E20a/b, E22, E34 · D14, D17, D18
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

## Result

The human-assisted `probe:5f-ab` run passed all assertions. Machine readback
confirmed exclusive A-only, B-only, then A-only layer selection. The operator
heard the empty alternate silence the playing clip and heard the copied device
chain restore it. Bitwig uses Shift-click for this exclusive solo action. A
normal solo click is additive.

The two four-beat clips stored half-bar quantization and
`continue_or_synced`. The probe observed the queued state, a landing within
0.038 beats of the half-bar grid, and position continuity. Device selection did
not change during the clip switch. The selected clip kept playing during device
switches.

One mixed instruction stored two managed events with one correlation id and
distinct result and execution ids. The production report matched the persisted
record. A production track copy stored one separate ordinary-use event and no
managed event.

Cleanup removed the one disposable track. It restored both cursors, the exact
observation value, status, selection, track identities, row count, and stopped
transport. Focused tests pass 83/83. The full offline check passes 541/541. The
context check covers 152 active documents with intact links, and
`git diff --check` passes. E34 records the result. Session 5g is next.

## Session retrospective

Name Shift-click explicitly when a Bitwig solo proof requires exclusive
behavior. No repository instruction change is needed.
