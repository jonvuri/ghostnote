---
title: Current state
kind: status
state: active
updated: 2026-08-29
phase: phase-5
session: 5p-existing-device-modulation-wrapper
---

# Now

Phases 1, 2, and 4 are complete. Phase 3 remains deferred. Phase 5 and the open
ColourCopy dogfood loop remain active. Session 6a stays after Phase 5 and the
explicit dogfood-loop close.

## Stable baseline

The accepted live project is `New 3`. It has exactly five tracks, eight launcher
rows, the accepted six-pad Drum Machine, and the accepted Instrument Layer with
nested Polysynth. Session 5o restored this exact track list and left no scratch
content.

Sessions 5j through 5n provide general DirectParameter targets, semantic preset
inspection, complete list-scoped topology, the 42-type donor catalog, and the
public fingerprinted authoring workflow. E85 through E89 record those results.

## Session 5o result

Session 5o is complete. The promoted human-authored FX Layer seed has one empty
`Layer 1` entry. Its manifest records SHA-256
`fdc1f2d64132d8aabe277c090e052b9a6dfb76ba3c80e1c9e0a1748c60e71f50`,
6,687 bytes, Bitwig 6.0.6, creator `jrajav`, target device position 0, and no
external files or reference stubs.

The outer route stays valid while the entry is empty. It becomes active after
an existing Polysynth or Zebra3 VST3 instance moves into position 0. Both keep
their name, enabled state, complete DirectParameter inventory, and base-value
fingerprint. The wrong-position route stays inactive. No automation is present.

Chain cannot select an empty named slot. Instrument Layer has no addressable
empty entry, and a placeholder route stays bound to the placeholder after
replacement. These strategies refuse or remain inactive without residue.
[E90](evidence/experiments/e90-fx-layer-late-binding-is-live.md) records the
matrix and qualifications.

Verification passes: brain 927/927, extension tests, deployed 149-method
contract freshness, the focused Bitwig 6.0.6 matrix, and exact cleanup.

## Next action

Implement [Session 5p](plan/phase-5/5p-existing-device-modulation-wrapper.md).
Use FX Layer only. Add the guarded public wrap and reversal lifecycle for one
existing device. Do not begin Phase 6a until Phase 5 and the open dogfood loop
close.

## Retrospective

Inspect container object topology before authoring a route. Treat a repeated
device name as an observer identity ambiguity and force an observed transition.
Bind both mutation endpoints to the same cursor track.
