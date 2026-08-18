---
id: E41
kind: evidence
state: active
source: phase-2-session-2d-rhythm-performance
---

# E41 — Triplet rhythm readback and seeded transforms [K] (2026-08-18)

**Verdict: mixed straight and triplet positions and durations round-trip through
an independent live cursor. Quantize, humanize, thin, and densify are pure,
seeded transforms with explicit timing and collision reports.**

## Grid measurement

The 2d probe created one owned clip in a slot that live readback proved empty.
Cursor `0` wrote on a 1/12-beat grid. Cursor `1` was the only read witness. It
read these notes twice:

- triplet position 1/6 beat and duration 1/3 beat;
- straight position 1/4 beat and duration 1/4 beat.

Both reads were stable. The host reported the triplet duration as
`0.33333301544189453`, within `3.2e-7` beats of the request. The position stayed
at step 2 on the 1/12-beat grid. This is exact within the existing note readback
tolerance.

The shared grid contract now includes 1/3, 1/6, 1/12, 1/24, and 1/48 beat
views. It keeps 1/64 beat as the finest supported view. A mixed straight and
triplet note set chooses the coarsest grid that represents all starts and
durations exactly.

## Transform result

Quantize uses the nearest grid line. A tie moves later. Strength linearly moves
from the input to the requested grid line. An output that no supported grid can
represent refuses.

Humanize derives each draw from the patch seed, target, variation, operation,
and draw index. It snaps timing to the finest exact host grid. It clips starts
at beat zero, rounds velocities to host integers, and clips velocities to 0–127.
The result returns the caller seed and the derived operation scopes.

Thin treats probability as removal chance. It requires replace mode because
merge cannot remove source notes. Densify copies the preceding onset group to
empty grid lines between selected groups. Its probability is the addition
chance for each copied note.

Timing reports contain requested and realized start beats. Same-pitch overlap
shortening is applied and reported inside the pure pipeline. Duplicate note
identities refuse by encoded grid cell. Truncated output is revalidated before
it leaves the pipeline. Unsupported grids refuse. All fields that an operation
does not own remain unchanged. Pressure still refuses before materialization.

## Baseline and verification

The live probe started with all 10 documented durable tracks, 10 scenes, 22
occupied cells, selection at track 0 row 1, stopped transport, and the exact
empty schema-v1 observation record. Cleanup removed the owned clip, returned all
three cursor pairs unpinned to `gn-lay` row 0, and restored the entry selection.
Final readback found the same 22 occupied cells, stopped transport, and exact
observation value. `Last change` returned to `Change · 4a-live-check` through
the project-bound status path.

The focused suite passed 135 checks. The full offline suite passed 589 checks.
Typecheck, the context check, and `git diff --check` passed.

## Decision impact

D9 now names the measured triplet grid family. D15 is unchanged: the triplet
verdict comes from a handle that did not write. D21 keeps its patch grammar and
adds the effective-seed and realized-timing result details.

## Retrospective

The 2a grammar fixed operation fields but did not fix density behavior or the
meaning of thin probability. Record these rules when an operation enters the
grammar. This prevents a later session from choosing semantics during coding.
The grid follow-up must also measure host precision before it selects a
normalization tolerance.
