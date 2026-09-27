---
title: Current state
kind: status
state: active
updated: 2026-09-27
phase: phase-8-agent-native-live-engine
session: phase8c1-expanded-symbolic-format-comparison
---

# Now

Run the
[Phase 8c1 expanded symbolic-format comparison](plan/phase-8/8c1-expanded-symbolic-format-comparison.md).
This is a side investigation before the original Phase 8f contract session.
Do not begin Phase 8f until 8c1 gives a proceed, revise, or block decision.

[E137](evidence/experiments/e137-compact-bar-prior-art-and-benchmark.md) fixes
the first comparison corpus. It shows that compact-bar uses about half the
model input tokens of exact JSON. It does not show a syntax-only accuracy win.
8c1 must add native no-ledger arms, deterministic comprehension, generation,
continuation, and transformation tasks, repeated trials, and Claude Sonnet 5.
The environment contains `CLAUDE_API_KEY`; do not expose or retain its value.

Treat USD 5 per provider as a soft ceiling. Stop earlier when the frozen
nondeterminism rule settles the result. Notify the operator before a run that
is projected to exceed it. Keep native musical-task success separate from
stable identity and preservation requirements.

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

After 8c1, return to
[Phase 8f — Consolidated compact-bar and cache contracts](plan/phase-8/8f-consolidated-compact-bar-and-cache-contracts.md)
only if the evidence supports it. E138 and E139 remain the cache authorities;
8c1 must not change the cache or a live Bitwig project.

## Retrospective

The first benchmark bundled many tasks and used one retained response per cell.
Focused calls, native/composite pairs, and adaptive repeats isolate the missing
evidence without freezing the final syntax.
