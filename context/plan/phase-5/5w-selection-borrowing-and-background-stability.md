---
title: Phase 5w — selection borrowing and background stability
kind: plan
state: done
status: Atomic selection ownership, safe target reuse, and the expanded background matrix pass.
updated: 2026-09-05
parent: README.md
prev: 5v-semantic-parameter-units-and-fail-closed-guidance.md
next: 5x-existing-wrapper-update-operation.md
evidence: D6, D15, E1, E14, E32, E36, E55, E58, E99, dogfood session 01a0690e-1761-76b1-9e8e-635bfa35e583
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

## Result

The public wrapper and reversal now share one selection scope. Stable track and
device targets are reused only after exact status checks. Track identity, bank
position, route signature, device name and position, nested state, both pins,
extension generation, and local structural revision guard the fast path.
Structural stages clear every hold. Cursor drift or a target mismatch forces a
complete retarget.

Selection restoration now checks current host selection. It does not overwrite
a newer operator track or launcher-slot selection. The extension reports the
exact device route signature that makes same-target confirmation possible.

The final live trace recorded 20 actual cursor points, 141 avoided points, and
31 device-target reuses across scalar controls, the wrapper, and reversal. The
repeatable read control reduced cursor points from 34 to four and observed
selection events from one to zero. Bitwig stayed in the background.

A follow-up review found three gaps. Selection restoration used separate check
and write calls. Track-cursor drift did not clear its cached track hold. The
live matrix omitted scalar writes and repeatable frontmost and background
controls.

The repair gives each composed scope an extension-owned selection lease. A
different observed operator selection clears it. The restore handler checks
and consumes the lease before it writes. Track-cursor drift now clears the
track hold and re-points. The expanded probe compares repeated frontmost and
background reads, measures observed selection events, runs direct and remote
scalar writes and reversals, and then runs the wrapper and reversal. Delayed
device banks now settle to two complete readings. Direct scalar cohorts wait
for the exact target-bound write callback before the full integrity read.

## Verification

- `npm run probe:phase5w-selection`: all live cases and exact cleanup pass.
- `npm run check`: type checking and 1,023 tests pass.
- `./gradlew test`: pass.
- `./gradlew copyExtension`: pass.
- `npm run probe:hello`: deployment freshness passes.

## Retrospective

Include nested batch methods when a probe measures wire cost. Keep target reuse
inside the workflow scope that owns selection borrowing. Put an ownership check
in the same extension handler as its write. A prior coordinate read cannot
close a restore race.
