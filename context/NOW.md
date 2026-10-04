---
title: Current state
kind: status
state: active
updated: 2026-10-04
phase: phase-8-agent-native-live-engine
session: 8g5c-complete
---

# Now

Next session: [8g5 — Final shadow acceptance](plan/phase-8/8g5-final-shadow-acceptance.md).
[8g5c](plan/phase-8/8g5c-combined-storage-limit.md) is complete.
[E223](evidence/experiments/e223-combined-storage-scale.md) records the results.
All cache results keep `complete:false` and `eligible:false`. Do not enter 8h.

Counted topology and occupancy support 512 total channels and 128 scenes. FX,
Master, and group wrappers share that capacity. The flat boundary has 510
instrument/audio tracks, FX, and Master. Group controls pass at 256 base tracks
plus FX, Master, and up to two wrappers. At 513, all project admission paths
refuse; cleanup and recovery pass. Counted allocation uses 513 banks, 1,024 bank
track handles, and no parent handles. Three empty and three populated fresh
controller samples pass. Populated initialization median is 50.512 ms; topology
construction median is 4.298 ms. The JVM and host memory values are shared.

Live 24 MiB equality passes across all seven independent estimate domains.
Two-byte excess sheds all enriched payloads and returns confirmed authority.
Independent exact fallback matches all 6,315 notes. Explicit recovery, eviction,
and restoration pass. The accepted journal preserves completed arms from an
immutable diagnostic. Retain both harness failures; do not rerun fixture trials.
Estimates exclude host objects and transient diagnostic copies. JVM samples do
not measure cache-owned heap. Normal rig defaults stay unchanged.

Carry D28, E222 identity limits, and collapsed-child `binding-budget` refusal
into 8g5. Group own slots mirror children and are not clips. Occupancy never
proves identity. Each rebuild mints fresh references. Native input ordering
remains unproved.

Only protected `New 3 *` remains open. Never save or close it. Its
[final check](evidence/data/phase8g5c-storage/new3-final-baseline.json) matches the
[adopted baseline](evidence/data/phase8g5a-group/new3-baseline.json) twice,
including its reader and empty clip. The operator discarded New 8 without
saving. Exact original config SHA-256 is `256bbf07…43b0`. The research archive
is removed. Normal hello passes: 85 methods, hash `bba7383dce25c0f0`, fresh init
`2026-10-04T04:25:55.814Z`. Normal archive SHA-256 is `fd1e32ea…3e03f4`.

Brain typecheck and all 1,800 tests pass. Extension, all four archive
registrations, the 65-file artifact verifier, normal reload, active wire, context,
and diff checks pass. Entry HEAD is `bcfb5f4`. Session changes are staged for
review; no commit is made.

## Retrospective

Use `status` to inspect a view. `read` starts a comparison. Retire other views
before a global hint drain. Preserve completed live arms during continuation.
