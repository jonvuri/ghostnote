---
title: Phase 2, session 2d follow-up — measured grid precision
kind: outcome
state: complete
updated: 2026-08-18
parent: ../../plan/phase-2/README.md
prev: PHASE-2-SESSION-2D-RHYTHM-PERFORMANCE.md
next: ../../plan/phase-2/2e-clip-lifecycle.md
scope: Host duration precision and safe grid normalization
evidence: E42 · D9, D10, D15, D21
---

# Phase 2, session 2d follow-up — measured grid precision

The grid-precision follow-up is complete. Host duration normalization now uses a
measured fixed-point rule. Start identity remains exact.

## Measurement and rule

E42 records the requested Java doubles, settled `NoteStep.duration()` raw bits,
and brain JSON values for all binary controls and supported triplet durations.
Binary values stayed bit-exact. Triplet durations settled at the nearest
`2^-20`-beat value. The maximum observed error was
`3.1789143895011307e-7` beat.

Grid classification accepts an exact duration or the exact `2^-20` host result
predicted from a supported grid value. It does not use the broad note fidelity
tolerance. It refuses an adjacent fixed-point value and an arbitrary nearby
value inside the empirical error bound. Start positions keep the strict `1e-9`
ratio check, so duration normalization cannot merge start identities.

## Product and safety proof

The E41 raw third-beat duration passes `stepSizeFor`. The live probe read it
through the production adapter, transformed it, compiled it, wrote it through
both production note stages, and confirmed it with an independent cursor. A
straight quarter-beat note in the same clip remained exact.

Fixtures cover every measured duration, mixed straight and triplet timing,
adjacent same-pitch notes, encoded cell collisions, positive post-truncation
durations, and the 1/64-beat floor. D9 grid settlement and D10 stage order did
not change. Raw-bit data remains on a probe-only route. The product wire remains
134 methods with hash `c2aa57be11e1f47e`.

## Verification

The focused rhythm suite passes 15/15. The full offline check passes 594/594,
including typecheck. The extension build passes. The live probe passes 17 checks
after the handshake. The context check and `git diff --check` pass.

Live cleanup restored the exact 10-track, 10-scene, 22-cell baseline, selection
at track 0 row 1, stopped transport, empty observation value, cursor homes and
pin state, and `Last change`.

## Retrospective

Separate start and duration precision rules make later grid work clearer.
Measuring raw boundary values before selecting the rule avoided a broad epsilon.
No repository instruction change is needed.
