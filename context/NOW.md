---
title: Current state
kind: status
state: active
updated: 2026-09-24
phase: phase-7-follow-up
session: phase7b-constant-time-launcher-reads
---

# Now

Start the
[constant-time launcher-clip read search](plan/phase-7/7b-follow-up-constant-time-launcher-reads.md)
in a fresh session. Search the complete available Bitwig extension API and its
indirect MIDI-content routes before optimizing the existing step scanner. The
goal is a reliable constant-time or near-constant-time sensory read for one
identified launcher clip. Do not use a physical MIDI export or a focus-dependent
named action.

The working interface direction is in
[Consolidated compact-bar direction](evidence/format/CONSOLIDATED_COMPACT_BAR.md).
Use one compact representation for theory, clip reads, and clip writes. Use a
`1/512`-beat realized-time lattice. Treat triplet and higher-cardinality rhythm
as overlays on that lattice. Support complete desired clips and sparse patches
through one candidate and host-difference path. Use best-effort live clip
identity plus fresh content guards.

The current public API inspection found no direct note-enumeration method on
`Clip`. That is a starting fact, not the next session's conclusion. Inventory
all relevant API types, callbacks, transfer paths, MIDI routes, runtime proxy
methods, and observer or cache options. Probe only credible candidates. Record
the result in E130.

The staged Phase 7b played-range implementation remains intact. Its offline gate
passes 1,169 brain tests, `context/check.rb`, `git diff --check`, and the live
extension handshake. [E129](evidence/experiments/e129-played-range-consolidation-guidance.md)
records the result. Its independent live agent trial is paused until the new
clip acquisition interface is available. Do not discard or redo those changes.

No temporary clip was created for E129. The live inventory was read-only and
left no test residue. Two existing affected clips remain at row 0 on the two
`Deep House Kit` tracks in `26.36-4 orangebeat`.

After the read investigation, select the smallest acquisition implementation
for the consolidated clip interface. Resume the E129 live trial only after a
fresh agent can acquire the required clip state through that interface. Phase
8a remains the later return route.

## Retrospective

The narrow exact-source reachability issue exposed a broader interface design
opportunity. Keep the next search reproducible so a later Bitwig API upgrade can
be compared without repeating a manual method survey.
