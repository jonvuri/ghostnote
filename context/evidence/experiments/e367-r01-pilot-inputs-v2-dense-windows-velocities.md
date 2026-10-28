---
title: E367 — R01 pilot inputs v2: densest windows, distinct targets and synthetic velocities
kind: evidence
state: done
updated: 2026-10-26
owner: R01
---

# E367 — R01 pilot inputs v2: densest windows, distinct targets and synthetic velocities

Date: 2026-10-26. Stage: **development**. No model call, Bitwig contact or
library write occurred. This record revises the inputs of
[E366](e366-r01-pilot-development-inputs.md), which remain retained as v1.

## Result

The operator asked to fix three issues that E366 noted: sparse windows, one
note targeted by two instances, and placeholder velocities. Input version 2
addresses all three. Its windows are 2.7–4.8 times larger:

| Work | v1 window (E366) | v2 window | v2 asset | Timing |
|---|---|---|---|---|
| A — Re:turning | piano, 38 notes | **103 notes**, start 11479/50 | `000-acoustic-piano.mid` (only pool asset) | baked |
| B — Our Taproot | bass, 24 notes | **72 notes**, start 29453/640 | `026-clean-electric-guitar.mid` | mapped |
| C — Good Lies | bass, 24 notes | **115 notes**, start 524951/3200 | `033-electric-bass.mid` | mapped |

The v2 package has the same cells as v1: 67 eligible (56 primary, 11
diagnostic) and 17 exclusions per repeat, matching pilot draft 2. Its offline
rehearsal accepts all 67 goldens, rejects all 67 deliberate wrong results and
rejects all 61 gratuitous refusals. `p05` and `p09` now target different notes
in work B. Real-source inputs carry seeded velocities with 23–30 distinct values
per window: A ranges 56–87 (median 71), B 75–101 (median 87) and C 60–94
(median 77).

Larger windows cost more context. Delivered prompts range from 713 to 4,457
`o200k_base` tokens, and one repeat's eligible cells total 126,003 local
tokens per cohort (v1: 78,601), a 1.6× increase. Write tasks on the 103- and
115-note windows also require proportionally long answers. With three repeats,
this is about 378,000 local prompt tokens per cohort before corrections and
client context.

## Changes

- **Window rule v2** (`r01-pilot-selection-rules-v2`). Work selection and
  asset order are unchanged. For each of works A–C, every pool asset is
  decoded, and every distinct note onset is a candidate start. A
  two-pointer scan counts onsets in the 16-quarter half-open window. The
  admissible window with the most notes wins: it must have 16–128 notes and no
  1/512 pitch/onset collision. Ties go to the earlier asset in seeded order,
  then to the earlier start. No candidate exceeded 128 notes, and no
  collision was skipped. Our Taproot's voice asset had no admissible window
  (fewer than 16 notes in every window). Drum assets remain outside the pool.
  The rule now opens every pitched pool asset of works A–C: seven MIDI files,
  all in development works. No later work was opened.
- **Distinct targets** (`r01-pilot-task-rules-v2`). Instances that share a
  window choose targets in instance order, and a later instance skips notes
  already targeted. `p05` sets the note at 23/2, pitch 39, to velocity 91;
  `p09` deletes the note at 23/2, pitch 46.
- **Synthetic velocities** (seed `r01-pilot-velocity-v1`). The transcriber
  writes velocity 64 for every note, so the task layer adds deterministic
  dynamics to the normalized notes.
  - Per work: a base of 64–84, a phrase depth of 6–12 and a phase of 0–7
    quarters.
  - Beat accent: +6 within 1/16 quarter of a beat, +4 more on a four-quarter
    downbeat, and +2 near an off-beat.
  - Phrase swell: a triangular eight-quarter swell.
  - Register emphasis: round((pitch − median) / 6), clamped to ±4.
  - Jitter: −5 to 5.
  - The result is rounded and clamped to 20–120.

  Only velocity changes; pitch, onset, duration and ID come from the window.
  These dynamics are synthetic. They are not recovered performance dynamics or
  intent.

## Artifacts and reproduction

- [v2 windows](../data/r01-pilot-inputs/v2/windows.json) (SHA-256
  `87b2fc93…742a`) record every scanned asset's candidate count, over-128 and
  collision statistics, best window and the selection.
- [v2 package](../data/r01-pilot-inputs/v2/package/manifest.json) (manifest
  SHA-256 `f59aca29…1030`) records `inputVersion: 2`, the task rules and the
  velocity seed. The runner loads it as `pilot-development-v2`, regenerating
  tasks from code. The E366 package loads as `pilot-development-v1`, with
  artifact checks only.
- From `brain/`, with the E366 raw inventory:
  `node --import tsx benchmarks/r01-candidates/pilot-inputs.mjs RAW.json LIBRARY_ROOT NEW_DIR/windows.json ../context/evidence/data/r01-pilot-inputs/inventory.json`,
  then `pilot-package.mjs PINNED_PP TOOLING NEW_DIR/package`. Both regenerated
  byte-identically. The shared reduced inventory must match byte for byte.
- 221 focused tests pass. The tests now cover the dense scan against brute
  force, over-128 skipping, tie-breaking, distinct targets and velocity bounds.

## Limits

This record covers development material only. The density rule
deliberately chooses each work's busiest admissible passage. It does not
represent typical density, and it shifts the windows toward polyphonic or
fast passages. No pilot submission was made.
