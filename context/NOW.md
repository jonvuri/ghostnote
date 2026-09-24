---
title: Current state
kind: status
state: active
updated: 2026-09-24
phase: phase-7-follow-up
session: phase7b-consolidated-clip-acquisition
---

# Now

Start the
[consolidated clip acquisition](plan/phase-7/7b-follow-up-consolidated-clip-acquisition.md)
in a fresh session. First build a probe-only sparse enrichment method. Collect
settled `NoteOn` coordinates from `addStepDataObserver`, then call `getStep` for
all 16 MIDI channels only at those coordinates. Compare every field and
normalized time with the current complete dual-grid reader.

[E130](evidence/experiments/e130-constant-time-launcher-clip-read-search.md)
records the Controller API inventory and the observer follow-up. Target, grid,
and page changes clear prior occupied cells and replay the complete occupied
view. One edit reports one changed cell. The callback gives only `x`, `y`, and
state. It collapses MIDI channels and has no completion signal.

Measure observer settlement, targeted host reads, bridge transfer,
normalization, and total time on short and long, sparse and dense fixtures.
Keep the selected 2,048-step cursor. Test page coverage, straight and triplet
timing, all channels, same-pitch adjacency and overlap, and optional fields.
Do not promote the route until it matches the complete reader.

The E130 inventory and observer probes remain in the staged changes. The
deployed extension has 156 methods and method hash `c6f38b114c5d9074`. A
controller-code change reloads only after the control surface is removed and
added again. An off/on toggle is not sufficient.

The E129 played-range implementation remains intact. Its independent live
agent trial stays paused until the new experimental acquisition route can
supply fresh clip state. Do not discard or redo that work.

The observer probe created one owned track and three owned clips. It removed
them and restored the exact four-track selection and stopped transport
baseline. It created no file and left no test residue.

## Retrospective

Static signatures did not show step-data replay semantics. Live-test each
observer family before carrying another observer's limits to it.
