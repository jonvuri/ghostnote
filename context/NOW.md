---
title: Current state
kind: status
state: active
updated: 2026-09-25
phase: phase-8-agent-native-live-engine
session: phase8c-compact-bar-prior-art-and-benchmark
---

# Now

Run
[Phase 8c — Compact-bar prior art and reproducible benchmark](plan/phase-8/8c-compact-bar-prior-art-and-benchmark.md).
Turn the E114 and E115 comparisons into fixed documents and a reusable task
corpus. Do not implement the project cache or change the stable E131 reader.

[E136](evidence/experiments/e136-runtime-and-surface-cleanup.md) completes 8b.
The normal runtime is `normal-v1`, with 85 methods and hash
`bba7383dce25c0f0`. Capture is `capture-v1`, with 90 methods. The Phase 8 probe
is `phase-8-probe-v1`, with 95 methods. Each archive embeds its identity. Use
the normal runtime unless a named capture or probe check requires another
profile.

The 57 historical methods exist only in source evidence. D13's six banned
methods and the four Phase 8 cache and API methods exist only in the probe
runtime. `ui.signalFire` remains absent from all builds. Observation storage and
the complete E131 note route remain in normal.

The current public description cohort is `ghostnote-description-v24`. Its 8b
surface change corrects clip-reversal wording in `delete_clip` and
`revert_change`.

## Retrospective

An alternate manifest does not select a new profile for an existing controller
registration. Embed the identity in the archive and verify it through the live
handshake before a profile-specific probe.
