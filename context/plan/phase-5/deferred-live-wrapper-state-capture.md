---
title: Deferred — live wrapper state capture and guarded update
kind: plan
state: deferred
status: Blocked on complete host-readable wrapper state or runtime modulator APIs.
updated: 2026-09-05
parent: 5x-existing-wrapper-update-operation.md
evidence: E100
---

# Deferred — live wrapper state capture and guarded update

## Trigger

Start this work only when the host provides one of these capabilities:

- export the current live wrapper to complete preset bytes; or
- read and edit every live modulator object, route, amount, setting, grid
  position, and opaque companion state.

Remote page names and selected control values are not a sufficient trigger.

## Work

1. Recheck the capability on native, VST3, and CLAP wrapper cases.
2. Define checkpoint version 2 with current-state fingerprint and provenance.
3. Refuse version 1 checkpoints and incomplete captures before mutation.
4. Implement add first. Do not expose replace, retarget, amount, or delete until
   each verb passes the same fidelity boundary.
5. Keep the current wrapper until the candidate wrapper and nested device pass
   complete independent readback.
6. Return before and after inventories, retained state, routes, stages, and one
   exact recovery path.
7. Test stale state, operator edits, interruption at each stage, failed
   verification, retry, reversal, and exact cleanup.

## Acceptance criteria

- The operation states whether it is in-place or reload-based.
- Every preservation claim has complete independent readback.
- The same existing device instance and scalar fingerprint remain.
- Operator edits either survive exactly or refuse before replacement.
- Partial failure leaves the device reachable and identifies one exact recovery
  path.
- All exposed verbs pass live proof and exact cleanup.
