---
title: Current state
kind: status
state: active
updated: 2026-09-25
phase: phase-8-agent-native-live-engine
session: phase8f-consolidated-compact-bar-and-cache-contracts
---

# Now

Run
[Phase 8f — Consolidated compact-bar and cache contracts](plan/phase-8/8f-consolidated-compact-bar-and-cache-contracts.md).
Settle one versioned agent-facing clip document and one separate internal cache
contract. Do not expose observer, proxy, dirty-queue, or rebuild mechanics as
musical syntax.

[E137](evidence/experiments/e137-compact-bar-prior-art-and-benchmark.md) fixes
the comparison corpus and shows that compact-bar uses about half the model input
tokens of exact JSON. It does not show a syntax-only accuracy win. The
[publication gaps](evidence/format/COMPACT_BAR_LIMITATIONS.md) remain open for
8f.

[E138](evidence/experiments/e138-cache-identity-and-lifecycle.md) defines
session-local clip identity, structural repair, project generations, and atomic
rebuild rules. [E139](evidence/experiments/e139-cache-scale-limits-and-degradation.md)
selects a 131,072-step cached view, 512 active observers, 2,048 occupied
coordinates per clip, 2,048 pending dirty coordinates, and explicit exact-read
degradation. Its pipelined count sweep stays exact through 768 observers and
finds no replay or ping knee. Cache-bank construction takes 38.949 ms at 512
observers and 59.057 ms at 768, so the 50 ms construction budget selects 512.
Use the
[scale policy](evidence/format/CACHE_SCALE_AND_DEGRADATION.md) for cache coverage
and health. Keep E131 as the comparison authority.

The stable runtime is restored at `normal-v1`, with 85 methods and hash
`bba7383dce25c0f0`. The scratch project is back at its four original track IDs,
eight scenes, and zero launcher clips.

## Retrospective

Phase-based binding amortizes track and scene settlement. Cache-bank
construction, not replay or ping, sets the selected observer limit.
