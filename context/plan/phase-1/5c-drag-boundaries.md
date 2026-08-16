---
title: Phase 1, session 5c — observer drag boundaries
kind: plan
state: complete
status: Complete 2026-08-16. E25 confirms the cross-track identity pair and the
        explicit below-window limit.
updated: 2026-08-16
parent: 5-proving.md
prev: 5b-fidelity.md
next: 5d-concurrent-editing.md
scope: Session 3 carry-in B5
evidence: E19, E21, E25 · D6, D16
needs: Bitwig foregrounded; a human at the keyboard
---

# Phase 1, session 5c — observer drag boundaries

> **Purpose.** Replace two observer inferences with direct live measurements.

## Scope

1. Arm the content-event observer, then have the operator drag one clip from one
   documented track to another.
2. Confirm a source-empty event and a destination-fill event in order. Confirm
   that each event carries the correct durable `channelId`.
3. Measure a drag below the scene-bank window. Shrink the configured window
   against the existing project; do not grow the project past the window.
4. Confirm whether the below-window drag emits no content event, as E21 predicts,
   and that the mark reports an uncovered scene window.
5. Restore the original window configuration, reload the extension, and restore
   every moved clip and the original selection.

## Out of scope

- writes under interference;
- selection-preservation counts;
- full live conformance;
- changing the observer model without contradictory evidence.

## Exit criteria

1. The cross-track event pair is measured with two correct track identities.
2. The below-window result is measured and recorded as a known limit or a defect.
3. The result receives a new E-number and states what was measured and inferred.
4. The project and extension configuration match the documented baseline.
5. The context check and `git diff --check` pass.

This is a human-assisted measurement, not an unattended regression. If either
result contradicts the model, create a focused repair session before continuing.

## Result

Complete. The operator moved one owned clip from `gn-B` row 9 to `gn-lay` row
9. The observer emitted exactly two events. The source-empty event carried the
`gn-B` durable id. The destination-fill event carried the `gn-lay` durable id.
The event window was complete, and the scene epoch did not move.

The second arm reduced the scene window from 16 rows to 8 against the existing
10-scene project. The operator moved an owned clip from `gn-B` row 9 to row 8.
The content epoch did not move. The delta had no events and reported
`uncoveredIn: 'scenes'`. After the probe restored the 16-row window, live
readback proved the drag had occurred.

The probe restored the exact prior rig configuration, reloaded the extension,
removed both owned clips, and restored selection, `Last change`, and the empty
observation record. E25 records the measurements. No observer-model change is
needed.

## Session retrospective

Finish cleanup before closing a shared bridge client. Immediate reuse can race
the prior socket's close event. The focused probe now uses the safe order. No
repository instruction change is needed.
