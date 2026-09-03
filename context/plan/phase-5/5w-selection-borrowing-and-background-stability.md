---
title: Phase 5w — selection borrowing and background stability
kind: plan
state: planned
status: Planned. Isolate intermittent Bitwig foreground changes and repeated retargeting.
updated: 2026-09-03
parent: README.md
prev: 5v-semantic-parameter-units-and-fail-closed-guidance.md
next: 5x-existing-wrapper-update-operation.md
evidence: D6, D15, E1, E14, E32, E36, E55, E58, dogfood session 01a0690e-1761-76b1-9e8e-635bfa35e583
---

# Phase 5w — selection borrowing and background stability

## Purpose

Find the intermittent cause of Bitwig returning to the foreground during a
Ghostnote workflow. Reduce repeated selection movement and cursor retargeting
without weakening target identity checks.

## Starting facts and questions

During the follow-up in dogfood session
`01a0690e-1761-76b1-9e8e-635bfa35e583`, Bitwig repeatedly returned to the
foreground while the operator tried to switch to another application. The
event appeared near track-selection work, but the transcript does not prove
the triggering method.

Ghostnote already records that cursor pointing borrows the user's Bitwig
selection. Device, parameter, remote, and structural paths can call
`CursorTrack.selectChannel`. Selection restoration uses `selectSlot`. The
adapter can preserve selection across one executor pipeline, but the wrapper
performs several independent reads and writes. Each call can retarget and
restore again. There is no recorded operation-level matrix for macOS
application activation.

Investigate why the foreground change occurs only sometimes. Test whether it
depends on a parameter path, operation type, cursor state, selection type,
restore path, or host timing. Also evaluate the operator's proposal to keep a
confirmed target and retarget only after a mismatch, instead of selecting away
and back for each operation.

## Work order

1. Instrument cursor points, device selections, layer selections, slot
   selections, selection capture and restoration, target confirmation, and
   frontmost-application transitions with one ordered trace.
2. Reproduce the wrapper while Bitwig is frontmost, backgrounded, and actively
   left by the operator. Test read-only device inspection, direct parameters,
   remotes, scalar writes, container insertion, relocation, page verification,
   and reversal separately.
3. Vary the selected Bitwig object: track, launcher slot, device, layer entry,
   and nested device. Record which exact method, if any, precedes each macOS
   activation event. Do not equate a Bitwig selection change with application
   activation.
4. Count every selection and cursor-target operation in one wrapper call.
   Identify duplicate work across stable reads, write preflight, write
   readback, page verification, and behavior sampling.
5. Evaluate a wrapper-wide selection scope and a verified cursor-target cache.
   Reuse a target only while track identity, route, pin state, device name,
   position guard, generation, and structural revision still agree. Retarget on
   mismatch or after a structural invalidation.
6. Test operator interference during a long workflow. Do not restore an old
   selection over a newer deliberate user selection. Keep writes bound to the
   confirmed target or refuse.
7. Apply the smallest proved repair. Add fake transport traces and live
   regressions for the intermittent trigger, same-target reuse, invalidation,
   and selection restoration.
8. Run the representative wrapper and reversal while the operator works in
   another application. Restore the live project baseline.

## Acceptance criteria

- One method-by-method matrix identifies the exact foreground trigger or proves
  a bounded host-level condition with repeatable controls.
- A supported representative wrapper does not bring Bitwig to the foreground
  after the operator leaves it. If the host makes this unavoidable, record the
  exact boundary, minimize the event, and do not claim background stability.
- The trace reports a measured reduction in cursor points and selection changes
  for repeated same-target work.
- A stable confirmed target is reused only while all required identity and
  revision guards agree.
- Structural change, cursor drift, or target mismatch forces a safe retarget or
  refusal before a write.
- A new operator selection is not overwritten by stale restoration state.
- Read, write, verification, reversal, and exact cleanup tests pass.

## Out of scope

- Removing all Bitwig selection borrowing when the Controller API requires it.
- Programmatically activating Bitwig as a workaround.
- Semantic parameter conversion.
- Existing-wrapper update design beyond the selection requirements it inherits.

## Handoff

Session 5x evaluates and, if bounded, adds an existing-wrapper update operation.
Use the proved selection scope and target-reuse rules in that design.
