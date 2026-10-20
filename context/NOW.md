---
title: Current state
kind: status
state: active
updated: 2026-10-20
phase: phase-9-overlap-investigation
session: 9b.3-bounded-write-probes
---

## Next session

**9b.3 — Bounded write probes.** Read the
[session brief](plan/phase-9/9b-grid-breadth-discovery-and-build-out.md#session-9b3--bounded-write-probes)
and [E304](evidence/experiments/e304-focused-grid-reader-live.md). The selected
cases are one Gates boolean, one proved Grid modulation mapping, and the
Gates factory case. Trace and validate each native command before use.
Keep independent descriptor readback, ownership, selection, freshness,
write locks, and uncertain-state handling. Batch extension changes into
one build; controller replacement remains an operator action.

9b.2a is complete. Selective schemas pass both former route refusals.
Focused reads pass at 31 modules and on selected parts of a 50-module patch.
Stutter Steps has 83 modules and remains outside the 64-module driver scope.
Gates data and Wavetable file identity are readable. Outer-modulator owners,
resource loading, Sampler/Audio File, and cross-flavour writes are not proved.
No native Grid write ran in E304.

## Deployment and live state

V15 is loaded and verified: `phase-8-probe-v1`, 118 methods,
`2e939035ea90b8b0`, marker `gridReadProbe: 9b-grid-focused-v15`, initialization
`2026-10-20T17:03:31.091Z`. Run `npm run probe:hello` from `brain/` before
new live work. E304 made no new deployment. The normal profile is not restored.
Do not repeat the completed 9a audio workflow.

The chosen project is `gn-grid-spike`. All 13 E304 scratch tracks are deleted.
Original tracks (`grid-probe`, `FX 1`, `Master`), device banks, mixer, and
selection match entry. `grid-probe` remains muted at -10 dB. Its final paired
read matches the normalized E276 baseline: four modules and two cables.
The reader is released and unlocked; no uncertain write remains. E304 sent
no engine, transport, or save command. Engine activity, saved-file identity,
and the UI save marker were not independently tested. Recheck state on entry.

Use muted owned scratch tracks. Park both survey cursors on a preserved
track before deletion. Keep `grid-probe` unchanged. Managed IDs from E304
must not be reused in a new session.

## Material to preserve

- [Focused report](evidence/data/phase9b-focused/focused-report.json),
  [final projection](evidence/data/phase9b-focused/focused-query-v6.json),
  [schemas](evidence/data/phase9b-focused/observed-schemas.json), and
  [catalog](evidence/data/phase9b-focused/catalog-updated.json): 65 UUIDs,
  89 observed name pairs, 56 lexical filename matches. Names are editable.
- Each focused run's `captures.zip` contains the full capture JSON. The
  report driver reads these archives and checks baseline preservation.
- [Symbol manifest](plan/phase-9/9b-grid-symbol-manifest.md): no new pinned
  member. Public descriptions remain v52.
- The saved `gn-grid-spike-baseline.bwpreset` control; its path is in the
  [survey inputs](plan/phase-9/9b-grid-breadth-discovery-and-build-out.md#session-9b1--stock-grid-preset-survey-read-only).
  The E289 edited project is not a baseline.

[9a is complete](evidence/experiments/e299-grid-spike-close-out.md).
Build discovery still needs the operator's Bitwig 6.1.x update after the
general feature audit, with 6.0.6 copied aside. See the
[roadmap](plan/ROADMAP.md) for the independent 8i17 survey and Phase 10.
