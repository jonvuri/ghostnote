---
title: Phase 1, session 5a — selection preservation
kind: plan
state: complete
status: COMPLETE 2026-08-16. B4 passes 8/8 live with cleanup.
updated: 2026-08-16
parent: 5-proving.md
prev: 4b-change-navigation.md
next: 5b-fidelity.md
scope: Session 3 carry-in B4
evidence: E23 · D6, D15
---

# Phase 1, session 5a — selection preservation

> **Purpose.** Make the executor preserve the user's clip selection once across
> its complete pipeline.

## Delivered

The executor owns one lazy selection scope across resolve, stash, apply, verify,
and reporting. Nested and overlapping pipelines share the scope. Direct adapter
calls keep their local preservation behavior.

The live adapter waits for selection readback after its one restore. A restore
timeout does not hide a content-write receipt that already exists.

## Exit result

`probe:5-selection` passes 8/8 live. It confirms one borrow and one restore,
exact reversal, final selection restoration, and removal of the probe clip.
Offline checks pass 527/527. The extension and wire method set did not change.

## Retrospective

A probe must claim an empty fixture row from live readback. A fixed-row
assumption caused two safe false starts. E23 and the probe now record this rule.
No repository instruction change is needed.
