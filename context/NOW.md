---
title: Current state
kind: status
state: active
updated: 2026-09-25
phase: phase-8-agent-native-live-engine
session: phase8e-cache-scale-limits-and-degradation
---

# Now

Run
[Phase 8e — Cache scale limits and degradation policy](plan/phase-8/8e-cache-scale-limits-and-degradation.md).
Measure width, observer count, occupancy, mutation load, rebuild cost, and
resource use independently before combined stress. Select limits from useful
budgets. Do not seek a crash boundary or implement the product cache.

[E138](evidence/experiments/e138-cache-identity-and-lifecycle.md) completes 8d.
The [lifecycle rules](evidence/format/CACHE_IDENTITY_AND_LIFECYCLE.md) separate
project generation, logical clip identity, current address, slot identity, and
content fingerprint. Exact structural events permit repair. Project lifecycle,
topology change, ambiguity, event gaps, and interrupted work require a complete
rebuild. Incremental repair measured 1,155.078 ms; the small complete rebuild
measured 4,388.368 ms.

Keep the E131 reader as comparison authority. E134 values of 131,072 steps,
256 observers, and 1,000 occupied coordinates are healthy lower bounds, not
limits. The runtime baseline is `normal-v1`, with 85 methods and hash
`bba7383dce25c0f0`. Use a probe profile only for the named 8e measurements and
restore the stable archive after the run.

## Retrospective

Classifying lifecycle arms by evidence source exposed that Bitwig has no safe
track-reorder route. Start 8e with an explicit live, model, and unavailable
classification for each stress arm.
