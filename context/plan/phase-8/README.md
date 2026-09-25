---
title: Phase 8 — Agent-native live engine
kind: plan
state: planned
status: Start after the played-range consolidation live gate. Begin with the product posture and interface audit.
updated: 2026-09-25
parent: ../ROADMAP.md
prev: ../phase-7/README.md
next: ../phase-9/README.md
---

# Phase 8 — Agent-native live engine

## Purpose

Recast Ghostnote as a fast set of specialized sensors and limbs for a frontier
agent working in Bitwig. Use structured tools where they improve on visual
inspection, clicking, and typing. Let agent reasoning and computer use handle
open-ended work that does not need a dedicated typed operation.

Reduce verification, output, and rollback ceremony when it does not prevent a
measured failure. Keep stronger safeguards for destructive, ambiguous, or
hard-to-observe changes. Prefer a small coherent surface, low latency, and low
token use over a self-contained workstation abstraction.

Build one normalized compact musical document and a fast project-wide clip
cache. Keep their boundaries separate: the cache is internal observed state;
the compact-bar document is the agent-facing musical language.

## Entry condition

First complete the independent
[played-range consolidation live trial](../phase-7/7b-follow-up-played-range-consolidation.md).
That trial is a small example of the intended hybrid posture. Ghostnote detects
a semantic boundary, computer use performs the UI-only operation, and
Ghostnote reacquires structured state.

Use the trial's latency, tool calls, ceremony, and failure handling as input to
8a. Keep the current E131 reader and experimental note-patch profile unchanged
until the new cache reaches its promotion gate.

## Product direction

Phase 8 uses these working principles. Session 8a can revise them with evidence.

- Ghostnote supplies fast structured observation where generic vision is weak.
- Ghostnote supplies precise bounded actions where generic clicking is slow or
  unreliable.
- Computer use owns visual discovery, focus-dependent actions, and ordinary UI
  work when a typed route adds little value.
- Verification cost is proportional to risk and observability.
- A tool returns the smallest result that lets an agent continue safely.
- Experimental machinery does not stay in the normal runtime without a current
  product or regression owner.
- Internal cache records do not become a public music format by accident.
- The stable reader remains a comparison authority until promotion evidence is
  complete.

## Session order

1. [8a — Agent-native product posture and interface audit](8a-agent-native-product-and-interface-audit.md).
   Review the complete surface, verification posture, computer-use boundary,
   and interface coherence. Select a target architecture and risk tiers.
2. [8b — Runtime and surface cleanup foundation](8b-runtime-and-surface-cleanup.md).
   Separate product and probe runtime, retire unowned apparatus, and establish
   the lean baseline used by later measurements.
3. [8c — Compact-bar prior art and reproducible benchmark](8c-compact-bar-prior-art-and-benchmark.md).
   Turn E114 and E115 into durable comparison documents and a reusable task
   corpus for common textual music formats.
4. [8d — Cache identity and lifecycle](8d-cache-identity-and-lifecycle.md).
   Resolve stale addresses, structural compaction, project changes, restart,
   replacement, and observer recovery.
5. [8e — Cache scale limits and degradation policy](8e-cache-scale-limits-and-degradation.md).
   Find practical performance knees and select product limits, budgets, and
   explicit overflow behavior.
6. [8f — Consolidated compact-bar and cache contracts](8f-consolidated-compact-bar-and-cache-contracts.md).
   Settle the public musical document and the separate internal cache boundary.
7. [8g — Shadow project cache](8g-shadow-project-cache.md).
   Implement the cache behind an experimental boundary while E131 remains
   authoritative.
8. [8h — Cache promotion and interface simplification](8h-cache-promotion-and-interface-simplification.md).
   Promote proved cache reads in stages and apply the selected tool and
   verification reductions.
9. [8i — Agent-native hybrid dogfood](8i-agent-native-hybrid-dogfood.md).
   Test ordinary work in fresh agent sessions and decide whether the engine,
   format, and surface are ready for Phase 9 publication review.

## Cross-session rules

- Preserve one stable comparison path until 8h explicitly retires or demotes
  it.
- Do not infer an upper limit from the largest passing E134 arm. Its 131,072
  steps, 256 observers, and 1,000 occupied coordinates are healthy lower
  bounds.
- Do not silently omit clips, notes, channels, or fields outside a cache limit.
- Keep normalized `1/512` loss explicit under D23.
- Label UI observations, structured observations, agent interpretations, and
  operator verdicts by their actual authority.
- Measure wall time, host work, tool calls, and result tokens before and after
  a material simplification.
- Use generated, public-domain, or permissively licensed music in publishable
  format fixtures.
- Do not publish a package, specification, asset, or release in Phase 8.

## Exit criteria

- The product posture names what Ghostnote owns and what computer use owns.
- Every retained normal-runtime method and public tool has a current purpose.
- Compact-bar comparisons are documented and can be rerun with fixed fixtures
  and scoring rules.
- Clip identity, invalidation, structural rebuild, project-change, and restart
  behavior are explicit.
- Product cache limits and degradation behavior are explicit and tested.
- The consolidated compact-bar contract has a versioned grammar, loss model,
  conformance corpus, and migration decision.
- The cache passes shadow comparison and is promoted only within proved health
  and coverage states.
- The simplified surface improves measured latency, calls, or tokens without
  hiding material effects or failures.
- Fresh hybrid dogfood confirms that an agent can use the surface without
  repository-specific coaching.
- Phase 9 receives explicit publication candidates and remaining limits.

## Phase 9 handoff

[Phase 9](../phase-9/README.md) owns breadth and external publication review.
The existing `bwmod` review moves there. A compact-bar publication review can
start only after 8i accepts the specification and conformance package.
