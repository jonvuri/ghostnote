---
title: Phase 1, session 5g repair — two-clip revert confirmation
kind: plan
state: complete
status: Complete. E38 separates target and pin settlement, and the focused
        revert passes independent readback with exact cleanup.
updated: 2026-08-16
parent: 5-proving.md
prev: 5g-live-conformance.md
next: 5g-live-conformance.md
scope: Repair only; rerun 5g after this session
evidence: E15, E29, E36, E37, E38 · D6, D15
needs: Bitwig foregrounded for the focused live proof
---

# Phase 1, session 5g repair — two-clip revert confirmation

> **Purpose.** Explain and repair the cursor confirmation timeout that E37
> exposed after a two-clip revert.

## Scope

1. Reproduce the `C-revert` ordering with two generated clips. Include the
   distinct expression writes, executor clear, revert, and independent reads.
2. Trace each point attempt. Record target track and row, clip pin state, track
   pin state, and the status that caused retry or acceptance.
3. Distinguish target movement from delayed pin settlement. Do not infer the
   failed state from the current generic error text.
4. Repair the smallest confirmed cause. Keep the retry bounded, preserve E36
   physical ownership, and do not weaken exact target and dual-pin checks.
5. Add offline regressions for the measured delay and the bounded refusal.
6. Run a focused live proof and the full offline check. Leave full live
   conformance for the separate 5g rerun.

## Exit criteria

1. The focused two-clip revert completes after the measured cursor delay.
2. Independent readback finds pan `-0.25` on clip A and `0.5` on clip B.
3. A cursor that never reaches the complete target and pin state still refuses
   within a documented bound.
4. Selection, cursor state, clips, tracks, scenes, observation data, status,
   and transport return to the recorded baseline.
5. Focused tests, the full offline check, the context check, and
   `git diff --check` pass.

## Out of scope

- claiming Session 5g complete;
- changing note-property fidelity, pressure, or gain policy;
- weakening independent readback;
- changing bank-window, managed A/B, or CI policy.

After this repair, rerun Session 5g in one complete invocation. Do not replace
the full run with the focused result.

## Result

E38 records the completed repair. `pointAtClip` now polls pending pins without
restarting a confirmed point. It still refuses after eight attempts and still
requires exact target and dual-pin readback. The focused live sequence passed
all ten checks and restored the complete baseline. Rerun Session 5g next.
