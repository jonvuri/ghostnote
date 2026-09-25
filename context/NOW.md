---
title: Current state
kind: status
state: active
updated: 2026-09-25
phase: phase-8-agent-native-live-engine
session: phase8d-cache-identity-and-lifecycle
---

# Now

Run
[Phase 8d — Cache identity and lifecycle](plan/phase-8/8d-cache-identity-and-lifecycle.md).
Resolve stale addresses, project changes, restart, replacement, ambiguity, and
observer recovery with a temporary probe. Do not implement the product cache.
Keep the stable E131 reader as comparison authority.

[E137](evidence/experiments/e137-compact-bar-prior-art-and-benchmark.md)
completes 8c. The fixed corpus has 12, 47, and 94 notes. Deterministic package
hash `837b4f4a50891e9abee665c06d2e0fd559313320f79c9f9f3672bfd64bab9fbd`
passes. Compact-bar uses 33.4% of exact JSON bytes and about half its provider
input tokens. The run does not show a syntax-only accuracy win. Keep task
fields, edit identities, and compiler effects separate.

The [benchmark rationale](evidence/format/COMPACT_BAR_RATIONALE.md),
[prior-art matrix](evidence/format/SYMBOLIC_MUSIC_PRIOR_ART.md),
[limitations](evidence/format/COMPACT_BAR_LIMITATIONS.md),
[protocol](evidence/format/COMPACT_BAR_BENCHMARK_PROTOCOL.md), and
[reproducibility guide](evidence/format/COMPACT_BAR_REPRODUCIBILITY.md) are the
8f input. Do not change the current benchmark syntax by treating it as a draft
specification.

The runtime baseline remains `normal-v1`, with 85 methods and hash
`bba7383dce25c0f0`. Use `phase-8-probe-v1`, with 95 methods, only for the named
8d probe. Verify archive identity through the live handshake before the first
profile-specific check.

## Retrospective

Literal patch examples removed generic schema noise. The remaining benchmark
result separates syntax, task fields, IDs, and compiler behavior. Keep this
separation in the 8f contract decision.
