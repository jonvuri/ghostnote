---
title: Current state
kind: status
state: active
updated: 2026-09-27
phase: phase-8-agent-native-live-engine
session: phase8c2-compact-format-development-loop
---

# Now

Run the
[Phase 8c2 compact-format development loop](plan/phase-8/8c2-compact-grammar-correction.md).
[E140](evidence/experiments/e140-expanded-symbolic-format-comparison-requires-revision.md)
records the completed 8c1 package and its `revise` decision. Use the retained
result only to select stress families and controls. Do not tune against its
outputs.

Start with six arms: compact-bar v1, label-only compact, full v0-style compact,
exact JSON, MIDI-Like native, and MIDI-Like composite. The full v0-style arm
must preserve its labeled events and structural headers. Add renderer parity
against fixed compact-bar v0.

Use fresh generated development fixtures for progression generation, melody
generation, role continuation, and chord revoicing. Use motif continuation as
the repeated-prompt sentinel. Add small structure, local-transformation, and
rhythm-transformation guards. Run the same eligible fixtures on OpenAI,
Gemini, and Claude.

Phase 8c2 can contain one or more later iterations. Each iteration must test
one bounded representation hypothesis. Likely candidates include keyed fields,
canonical role lanes, explicit hierarchy, and onset or chord-group blocks.
End with a fresh targeted holdout. A passing holdout selects one or more
compact candidates for
[Phase 8c3](plan/phase-8/8c3-full-symbolic-format-matrix.md).

Before each provider-bearing pilot, diagnostic, development, or holdout run,
state the exact scope, expected calls by provider, model settings, and
estimated cost by provider and in total. Get explicit operator approval for
that named run. The former USD 5 soft ceiling does not apply. Approval for one
run does not approve a later iteration. Record API cost after each run; the
operator will compare it with the provider dashboards.

Correct the composite failure reporting before the first new run. Report an
explicit score-ledger disagreement separately from a missing or invalid
ledger, a native-score parse failure, and another output or patch parse
failure. State each eligible denominator.

Phase 8c3 owns the fresh full retained matrix. Keep
[Phase 8f](plan/phase-8/8f-consolidated-compact-bar-and-cache-contracts.md)
blocked until 8c3 gives a `proceed` decision.

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

1. Implement the versioned six-arm development protocol and fresh fixture
   generator.
2. Add renderer parity and corrected composite failure classes.
3. Run deterministic checks.
4. Present the exact first-run call scope and cost estimate.
5. Wait for explicit operator approval before any provider call.

## Retrospective

The focused development stage now has a separate fresh holdout and full-matrix
stage. This split permits useful iteration without tuning on the final
decision cohort.
