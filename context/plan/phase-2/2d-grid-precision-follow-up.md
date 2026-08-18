---
title: Phase 2, session 2d follow-up — measured grid precision
kind: plan
state: active
updated: 2026-08-18
parent: README.md
prev: ../../archive/outcomes/PHASE-2-SESSION-2D-RHYTHM-PERFORMANCE.md
next: 2e-clip-lifecycle.md
scope: Host duration precision and safe grid normalization
evidence: E2, E15-D/F, E41 · D9, D10, D15, D21
---

# Phase 2, session 2d follow-up — measured grid precision

> **Purpose.** Measure host duration representation at the Java boundary, then
> make grid classification accept measured host noise without accepting notes
> that encode to the same grid cell.

## Problem

E41 read a requested 1/3-beat duration as `0.33333301544189453`. This value is
within the established note readback tolerance, but the product grid classifier
uses an unmeasured `1e-9` ratio tolerance and refuses it. The current live proof
therefore establishes stable host readback but does not establish an end-to-end
product round trip.

Start positions and durations have different read paths. Start positions return
as integer grid coordinates and the brain reconstructs beats. Durations return
from `NoteStep.duration()` as Java doubles. Do not apply one widened tolerance to
both fields.

## Execution order

1. Add probe-only instrumentation that records the requested Java double, the
   settled `NoteStep.duration()` raw double bits, and the JSON value received by
   the brain. Keep product wire reachability unchanged.
2. Measure binary controls and the supported triplet durations at 1/3, 1/6,
   1/12, 1/24, and 1/48 beat. Include several multiples, repeated reads, and an
   independent read cursor.
3. Record the observed error direction, bound, stability, and representation.
   State whether the evidence supports fixed-point quantization or only a safe
   empirical bound.
4. Separate start-grid identity from duration normalization. Keep encoded grid
   cell identity exact. Normalize a duration only under the measured rule, and
   refuse values outside it.
5. Add fixtures with the raw measured values. Cover mixed binary and triplet
   notes, adjacent same-pitch notes, grid-cell collisions, and the 1/64-beat
   floor.
6. Prove the product path through read, transform, compile, write, and independent
   readback. Restore the documented live baseline.

## Required boundaries

- Do not replace the current epsilon with the broad 2e-3 fidelity tolerance.
- Do not let duration normalization merge distinct start identities.
- Do not infer a host representation from one 1/3-beat sample.
- Do not change D9 grid-settlement or D10 write/property stage order.
- Keep diagnostic raw-bit data on probe-only wire surface.

## Exit criteria

1. Evidence records raw Java and brain values for every supported triplet grid
   and binary controls.
2. The normalization bound follows from the measured worst case and names its
   qualification.
3. The E41 raw 1/3-beat duration passes `stepSizeFor` and the complete product
   path.
4. Off-grid durations outside the measured bound still refuse.
5. Distinct notes that encode to one channel, pitch, and grid cell refuse before
   output. No transform returns a zero or negative duration.
6. Independent live readback proves mixed binary and triplet timing after the
   product rewrite.
7. Live cleanup restores the exact documented baseline.
8. Focused tests, full offline tests, typecheck, context check, and
   `git diff --check` pass.

## Retrospective target

Record whether separate start and duration precision rules make later grid work
clearer. Update D9 with the measured representation and bound. Change repository
instructions only if a general measurement rule is missing.
