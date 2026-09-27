---
title: Current state
kind: status
state: active
updated: 2026-09-27
phase: phase-8-agent-native-live-engine
session: phase8c2-2-measurement-repair-and-grouped-compact-iteration
---

# Now

Start
[Phase 8c2.2](plan/phase-8/8c2-2-measurement-repair-and-grouped-compact-iteration.md).
It is a fresh continuation of the compact-format development loop. Repair the
task measurement first. Then test one grouped-label compact hypothesis with
fresh calibration, development, and holdout cohorts.

[E142](evidence/experiments/e142-label-only-compact-fails-targeted-holdout.md)
records the frozen Phase 8c2 `do-not-select` result. Keep that result and every
v2 artifact unchanged. It does not prove equivalence between label-only
compact and compact-bar v1.

All 216 approved holdout calls completed. The recorded costs were USD 0.318270
for OpenAI, USD 0.202205 for Gemini, USD 1.236459 for Claude, and USD 1.756934
in total. The corrected report SHA-256 is
`18c3a6fd8e5235e23c9ddc3682dacb818e8585620a9e67e382d32bcde759fd87`.
The operator should compare these values with the provider dashboards.

The old revoice task had a contract defect. Its prompt required preservation
of the source `5/4` duration, but its canonical scorer answer used `3/2`. It
also accepted only one exact pitch realization. Across all old holdout arms
and providers, revoice passed 0/36, progression passed 2/36, melody passed
33/36, and role continuation passed 26/36. Repair these floor, ceiling, and
contract limits before another selection run.

Before each provider-bearing pilot, diagnostic, development, or holdout run,
state the exact scope, expected calls by provider, model settings, and
estimated cost by provider and in total. Get explicit operator approval for
that named run. The former USD 5 soft ceiling does not apply. Approval for one
run does not approve a later iteration. Record API cost after each run; the
operator will compare it with the provider dashboards.

No Phase 8c2.2 provider run is approved. Calibration, development, and holdout
need separate named scopes, estimates, hashes, and explicit approvals.

Phase 8c3 has no candidate that meets its entry conditions. Do not start its
fresh full retained matrix. Keep
[Phase 8f](plan/phase-8/8f-consolidated-compact-bar-and-cache-contracts.md)
blocked until Phase 8c3 gives a `proceed` decision.

[E138](evidence/experiments/e138-cache-identity-and-lifecycle.md) defines
session-local clip identity, structural repair, project generations, and atomic
rebuild rules. [E139](evidence/experiments/e139-cache-scale-limits-and-degradation.md)
selects a 131,072-step cached view, 512 active observers, 2,048 occupied
coordinates per clip, 2,048 pending dirty coordinates, and explicit exact-read
degradation. Use the
[scale policy](evidence/format/CACHE_SCALE_AND_DEGRADATION.md) for cache coverage
and health. Keep E131 as the comparison authority.

The stable runtime is restored at `normal-v1`, with 85 methods and hash
`bba7383dce25c0f0`. The scratch project is back at its four original track IDs,
eight scenes, and zero launcher clips. Do not change the cache or a live Bitwig
project.

## Immediate work

1. Create a new versioned package. Do not modify compact-format v2.
2. Add the task-to-scorer contract audit, property-based revoice scorer,
   progression components, mutation tests, and aggregation-path test.
3. Build one grouped-label compact renderer, parser, and capability suite.
4. Generate disjoint calibration, development, and holdout cohorts.
5. Freeze the exact calibration scope and cost. Request explicit approval
   before its first provider call.

## Retrospective

Test instruction-to-scorer agreement and the final aggregation path before
paid calls. Deterministic reference generation alone did not find either old
measurement defect.
