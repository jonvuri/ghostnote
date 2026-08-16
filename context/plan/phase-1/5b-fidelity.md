---
title: Phase 1, session 5b — note fidelity and gain
kind: plan
state: complete
status: Complete 2026-08-16. E24 proves 20 exact properties, the gain inverse,
        and pressure refusal through an independent handle.
updated: 2026-08-16
parent: 5-proving.md
prev: 5a-selection.md
next: 5c-drag-boundaries.md
scope: Phase 1 exit criterion 1
evidence: E2, E8, E15-B/E, E24 · D8, D15, D16
needs: Bitwig foregrounded
---

# Phase 1, session 5b — note fidelity and gain

> **Purpose.** Prove the complete 21-property contract through an independent
> read handle, and settle the gain inverse from measurement.

## Scope

1. Make independent-handle verification structural in the live harness. Use a
   separate cursor, or re-point before readback. Do not let a test select the
   writing handle by accident.
2. Run one patch through apply, verify, and revert. Cover the 19 members that
   were exact before the session and compare final readback with initial state.
3. Confirm that `pressure` is refused before a write reaches Bitwig.
4. Measure `gain` at several valid values, including repeated reads and a revert.
   Read every result through the independent handle.
5. Let the measured curve decide whether gain becomes exact or stays lossy.
6. Add focused offline coverage and one runnable live regression for the final
   property table.
7. Update D8, D16, and the Phase 2 premise with the measured gain verdict.

## Out of scope

- observer drag measurements;
- concurrent user editing;
- managed-take switching;
- the full live conformance run.

## Exit criteria

1. N note operations apply and verify through an independent handle.
2. All properties with the final `exact` verdict return to their initial values
   after revert.
3. Gain has a measured exact or lossy verdict. No guessed correction exists.
4. Pressure is refused before mutation.
5. The probe removes its clip and restores selection and project state.
6. Focused tests, the full offline check, the context check, and
   `git diff --check` pass.

If live behavior contradicts the property model, stop and create a focused
repair session. Do not fold the repair into this proof.

## Result

Complete. The focused harness partitions cursor `0` for writes and cursor `1`
for witness reads. The executor uses the witness for stash, verification, and
final readback.

E24 measured nine gain values. Each repeated read returned twice the raw setter
input, and zero reverted exactly. The shared encoder now writes requested gain
divided by two. Gain is exact and replays normally.

`probe:5-fidelity` passed 12/12. The patch verified without disagreement, all 20
exact properties returned to the initial witness read after revert, and pressure
refused without changing the clip. Cleanup removed the probe clip and restored
selection. The full offline and repository checks passed.

## Session retrospective

Reset state between curve samples. This prevents a missed setter call from
looking like a mapping exception. The probe now does this. No repository
instruction change is needed.
