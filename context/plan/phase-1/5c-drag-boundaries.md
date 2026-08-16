---
title: Phase 1, session 5c — observer drag boundaries
kind: plan
state: planned
status: Not started.
updated: 2026-08-16
parent: 5-proving.md
prev: 5b-fidelity.md
next: 5d-concurrent-editing.md
scope: Session 3 carry-in B5
evidence: E19, E21 · D6, D16
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
