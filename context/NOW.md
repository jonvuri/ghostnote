---
title: Current state
kind: status
state: active
updated: 2026-10-03
phase: phase-8-agent-native-live-engine
session: 8g5a-complete
---

# Now

Next session: [8g5b — Slot inventory delivery](plan/phase-8/8g5b-slot-inventory-delivery.md).

[8g5a](plan/phase-8/8g5a-group-topology-support.md) is complete.
[E221](evidence/experiments/e221-group-topology-candidates.md) records five
fixture shapes, fourteen tree checks, three note comparisons, and seven native
changes that retire active acquisitions. Admission uses UUID-validated child
banks. Parent handles are diagnostic; they can retain an old parent after a move.

The limit is 16 flat tracks. Added cost is 17 banks, 272 bank track handles,
16 diagnostic parent handles, and zero StepData observers. Heap is unmeasured.
The operator now requires at least 256 instrument/audio tracks plus group, FX,
and Master capacity. 8g5c measures allocation cost and raises the limit; it
tests 512 total channels as a candidate. The 16-track bound cannot pass 8g5.
Collapsed membership passes, but collapsed child canary rebinding refuses with
`binding-budget`. Carry this limit into the final supported-state matrix.

Only protected `New 3 *` remains open. Never save or close it. Its
[adopted baseline](evidence/data/phase8g5a-group/new3-baseline.json) supersedes
lost New 1. Track UUIDs, slots, ten cursors, selection indices, the existing
empty clip, metadata, launch settings, and two empty-note reads match.
Scan durations and selection event counters are excluded. The audio engine is
active; transport is stopped at zero. New 5 was discarded without saving.
Its sole remaining slot-selection flag difference is recorded in
[final restoration](evidence/data/phase8g5a-group/final-restoration.json).

Normal hello passes: 85 methods, hash `bba7383dce25c0f0`, fresh init
`2026-10-03T07:45:08.426Z`. Exact config SHA-256 is `256bbf07…43b0`.
The research archive is removed. Brain typecheck and 1,742 tests pass.
Extension, archive, artifact, wire, context, and diff checks pass.

The final gate scope remains project-wide occupancy. Run 8g5b and 8g5c, then
8g5. All cache results remain `complete:false` and `eligible:false`.
Do not enter 8h. Entry HEAD is `e76f8bf`. Session changes are staged; no commit
is made.

## Retrospective

Keep a visible dirty change before New Project. Wait for each live control to
exit before starting another on the same cache view. Exclude scan durations
from state equality, and report selection exceptions explicitly.
State the required project size in final-gate plans. A bounded topology proof
does not establish practical project capacity.
