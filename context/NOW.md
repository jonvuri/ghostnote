---
title: Current state
kind: status
state: active
updated: 2026-10-20
phase: phase-9-overlap-investigation
session: 9b.2a-focused-reader-coverage
---

## Next session

**9b.2a — Focused reader coverage.** Read the
[session brief](plan/phase-9/9b-grid-breadth-discovery-and-build-out.md#session-9b2a--focused-reader-coverage)
and [E302 survey](evidence/experiments/e302-stock-grid-survey.md).
Add selective schema discovery and focused parameter/resource projections.
Test representative refusals and the 31-module patch. Define the 9b.3 write
scope only where independent readback is sufficient. Batch extension changes
into one build; controller replacement remains an operator action.

9b.2 is complete: 12 stock presets plus the control, 55 observed type UUIDs,
63 UUID/name pairs, and 49 exact overlaps with 232 module filenames.
Eight paired catalog inventories pass, including the control. Broad stock
graphs are incomplete or refused. Caps were not raised. The first discovery
heap samples reached +38 MiB; the old 8 MiB estimate is not a supported bound.

## Deployment and live state

V14 is loaded and verified: `phase-8-probe-v1`, 118 methods,
`2e939035ea90b8b0`, marker `gridReadProbe: 9b-grid-survey-v14`, initialization
`2026-10-20T15:30:37.799Z`. Run `npm run probe:hello` from `brain/` before
new live work. No new extension deployment occurred in E302.
The normal profile is not restored. Do not repeat the completed 9a audio
preparation, run, or restoration workflow.

The operator chose `gn-grid-spike` with the engine active. E302 sent no
engine or transport command. All scratch tracks are deleted. Original
tracks (`grid-probe`, `FX 1`, `Master`), device banks, mixer, and selection
match entry. `grid-probe` is muted at -10 dB. Its final paired read matches
the normalized E276 baseline: four modules and two cables. The reader is
released and unlocked. No uncertain write remains. No save ran; the UI save
marker and saved-file identity were not tested. Recheck live state on entry.

Use muted owned scratch tracks. Park both survey cursors on a preserved
track before deletion; E302 found a stranded cursor after deleting its track.
The driver now does this. Keep `grid-probe` unchanged.

## Material to preserve

- [Survey report](evidence/data/phase9b-survey/survey-report.json),
  [catalog](evidence/data/phase9b-survey/catalog-first-pass.json), and
  [observed schemas](evidence/data/phase9b-survey/observed-schemas.json).
- [Symbol manifest](plan/phase-9/9b-grid-symbol-manifest.md). No new pinned
  member was added. Public descriptions remain v52.
- The saved `gn-grid-spike-baseline.bwpreset` control; its path is in the
  [survey inputs](plan/phase-9/9b-grid-breadth-discovery-and-build-out.md#session-9b1--stock-grid-preset-survey-read-only).
  The E289 edited project is not a baseline.

[9a is complete](evidence/experiments/e299-grid-spike-close-out.md).
Build discovery still needs the operator's Bitwig 6.1.x update after the
general feature audit, with 6.0.6 copied aside. See the
[roadmap](plan/ROADMAP.md) for the independent 8i17 survey and Phase 10.
