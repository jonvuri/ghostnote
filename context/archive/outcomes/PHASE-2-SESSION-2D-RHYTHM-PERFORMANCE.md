---
title: Phase 2, session 2d — rhythm and performance transformations
kind: outcome
state: complete
updated: 2026-08-18
parent: ../../plan/phase-2/README.md
prev: PHASE-2-SESSION-2C-HARMONIC-TRANSFORMS.md
next: ../../plan/phase-2/2d-grid-precision-follow-up.md
scope: Phase 2 manipulation vocabulary and grid contract
evidence: E41 · D8–D10, D15, D16, D21
---

# Phase 2, session 2d — rhythm and performance transformations

Session 2d is complete. Quantize, humanize, thin, and densify now run in the
same pure, ordered pipeline as the harmonic transforms.

## Delivered transforms

Quantize snaps to the nearest grid line. A tie moves later. Strength linearly
moves the note from its input beat to the requested grid beat. The loss report
contains both the requested and realized beat.

Humanize uses the stateless SHA-256 draws fixed in 2a. Timing draws snap to the
finest grid that keeps the complete note set exact. Starts clip at beat zero and
velocities round to host integers and clip to 0–127. The result returns the
effective seed and derived operation scopes.

Thin treats probability as removal chance for each selected note. It refuses in
merge mode because merge cannot remove source notes. Densify copies the preceding
onset group to empty grid lines between selected groups. Its probability is each
copied note's addition chance.

All operations use half-open beat selection and inclusive pitch selection. They
keep fields they do not own. The focused fixture covers all writable expression
fields, including exact gain. Pressure remains refused.

## Safety and reporting

An unsupported output grid refuses before compilation. Duplicate identities
refuse by encoded grid cell. The pure pipeline truncates overlapping same-pitch
notes at the next onset, revalidates the result, and reports each changed
duration. Snapped, clipped, shortened, removed, and added notes all appear in
the report.

The per-operation grid contract now supports triplet views at 1/3, 1/6, 1/12,
1/24, and 1/48 beat. It keeps the 1/64-beat floor. The coarsest exact view still
wins. D9 grid-change settlement and D10 write/property stage order did not
change.

## Live proof

E41 wrote mixed straight and triplet notes with cursor `0` and read them twice
with cursor `1`. The witness returned the 1/6-beat triplet position, 1/3-beat
triplet duration, 1/4-beat straight position, and 1/4-beat straight duration
exactly within the existing note tolerance.

The probe removed its owned clip. Final readback matched the documented 10
tracks, 10 scenes, 22 occupied cells, entry selection, stopped transport, and
empty observation value. All cursor pairs returned unpinned to `gn-lay` row 0.

## Verification

The focused suite passes 135/135. The full offline suite passes 589/589,
including the existing D9 and D10 grid regressions. Typecheck, the context check,
and `git diff --check` pass. The live 2d probe passes 13/13 checks after the
required live handshake.

## Retrospective

The 2a grammar fixed operation shapes but left density behavior and probability
direction open. The implementation had to fix both rules. A future contract
session must define those semantics when it adds an operation shape. This is the
first actionable documentation finding. Review also found that the measured
triplet duration does not pass the unmeasured grid epsilon. The focused follow-up
measures that boundary before changing it.
