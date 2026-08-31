---
title: Current state
kind: status
state: active
updated: 2026-08-31
phase: phase-5
session: 5q-general-device-source-composition
---

# Now

Phases 1, 2, and 4 are complete. Phase 3 remains deferred. Phase 5 and the open
ColourCopy dogfood loop remain active. Session 6a stays after Phase 5 and the
explicit dogfood-loop close.

## Stable baseline

The accepted live project is `New 3`. It has exactly five tracks, eight launcher
rows, the accepted six-pad Drum Machine, and the accepted Instrument Layer with
nested Polysynth. Session 5p restored this exact track list and left no scratch
content.

Sessions 5j through 5n provide general DirectParameter targets, semantic preset
inspection, complete list-scoped topology, the 42-type donor catalog, and the
public fingerprinted authoring workflow. E85 through E89 record those results.

## Session 5p result

Session 5p is complete. `wrap_existing_device_modulation` moves one existing
top-level device into an owned FX Layer without creating a replacement. It
records insertion, positioning, explicit entry naming, relocation, complete
state proof, and active behavior. Its checkpointed reversal restores the exact
prior top-level order and removes only the empty owned container.

Native Delay+ preserved all 23 DirectParameter rows and reached maximum Blur
Amount divergence `0.494476318359375`. Zebra3 VST3 preserved all 2,185 rows and
reached maximum Cutoff divergence `0.45879265666007996`. Both kept their exact
base fingerprints, enabled state, and names. Both reversals and exact cleanup
passed. Opaque state is qualified as same-instance preservation, not byte-exact
readback.

Review repairs bind reversal to the exact checkpoint that this session issued.
A changed checkpoint cannot use the owned insertion clearance. Post-write read
failures now return a partial result and the last proved checkpoint. Reversal
can first move a tail insertion into the observable window.

[E91](evidence/experiments/e91-existing-device-modulation-wrapper-is-live.md)
records the workflow, live matrix, guards, and qualifications.

Verification passes: brain 942/942, extension tests, deployed 149-method
contract freshness, the focused Bitwig 6.0.6 matrix, and exact cleanup.

## Next action

Implement [Session 5q](plan/phase-5/5q-general-device-source-composition.md).
Reuse the guarded wrapper pipeline for native, VST3, CLAP, preset, existing
move, and existing copy sources. Keep source identity and preset-name behavior
explicit. Do not begin Phase 6a until Phase 5 and the open dogfood loop close.

## Retrospective

Mark a shipped default entry name as explicit before filling it. Preserve every
identity field that the extension observes. Bind destructive checkpoints to the
exact issued value. Arm observer generations only after the exact target is
acquired.
