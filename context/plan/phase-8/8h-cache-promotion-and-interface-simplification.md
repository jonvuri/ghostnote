---
title: Phase 8h — Cache promotion and interface simplification
kind: plan
state: planned
status: Promote only proved cache states and apply the 8a product reductions over the replacement route.
updated: 2026-09-25
parent: README.md
prev: 8g-shadow-project-cache.md
next: 8i-agent-native-hybrid-dogfood.md
evidence: E119-E134; D23
---

# Phase 8h — Cache promotion and interface simplification

## Purpose

Make proved cache reads part of the live engine, connect the consolidated
compact-bar document, and simplify the agent surface according to the 8a
posture. Keep explicit fallback for states that the cache cannot cover.

## Promotion stages

1. Use healthy cache snapshots for experimental read-only compact documents.
2. Use them for repeated reads while retaining sampled authority comparisons.
3. Permit a fresh immutable healthy snapshot to serve an eligible write
   preflight only when the 8f risk policy allows it.
4. Share state with write preparation only when scope, generation, channels,
   metadata, defaults, and freshness all match.
5. Retire or demote the old route only after every retained fallback and
   diagnostic owner is explicit.

Each stage has its own feature flag or profile, comparison result, rollback to
the prior stage, and live acceptance gate. Do not promote all uses at once.

## Interface simplification

Apply the 8a disposition after the replacement path exists:

- merge tools that differ only by historical implementation seams;
- remove workflow wrappers that agent reasoning and small primitives replace;
- make reads return compact useful state instead of repeated internal evidence;
- make successful writes return concise effects and follow-up handles;
- keep detailed diagnostics for partial, ambiguous, or failed work;
- unify address, coverage, health, error, and change-reference conventions;
- reduce profiles and schema translations;
- keep computer-use seams explicit without wrapping focus-dependent actions;
  and
- retire experimental formats according to the 8f migration decision.

## Verification and reversal reductions

Implement the risk tiers selected by 8a and specified in 8f. Measure each
reduction against the prior route. Possible reductions include shared fresh
state, targeted readback, agent-visible confirmation through another sensor,
and optional directed reversal for low-risk observable edits.

Do not remove a guard or recovery path only because it is verbose. Name the
failure it covered, the replacement evidence, and the measured saved work.

## Acceptance criteria

- Cache authority is limited to explicit healthy and complete states.
- Every unhealthy, partial, or over-limit state takes the documented fallback
  or refuses clearly.
- Consolidated compact-bar reads and patches use the 8f contract and corpus.
- Every retired tool, format, method, and check has a migration or explicit
  incompatibility record.
- Destructive and ambiguous operations retain the selected stronger policy.
- Result size, tool calls, and wall time improve on representative workflows.
- The surface has one coherent address, health, result, and error vocabulary.
- Stable and experimental profile names state their actual compatibility.
- Focused checks, the complete brain check, extension tests, wire checks,
  context check, live comparisons, and `git diff --check` pass.

## Out of scope

- External publication.
- Breadth features unrelated to the selected agent-native core.
- Hiding a cache miss or computer-use action from the agent.

## Retrospective target

Record which simplification removed the most agent work and which retained
safeguard still costs the most. Use those facts in the 8i dogfood charter.
