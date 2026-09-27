---
title: Phase 8e — Cache scale limits and degradation policy
kind: plan
state: complete
status: Selected bounded cache limits and explicit exact-read degradation from E139.
updated: 2026-09-25
parent: README.md
prev: 8d-cache-identity-and-lifecycle.md
next: 8f-consolidated-compact-bar-and-cache-contracts.md
evidence: E51-E54, E119, E130-E134, E139; D23
---

# Phase 8e — Cache scale limits and degradation policy

## Purpose

Measure the practical working envelope for a project-wide persistent occupancy
cache. Select conservative product limits and explicit behavior beyond them.

Do not treat E134 endpoints as limits. They prove healthy lower bounds of
131,072 steps, 256 observed clips, and 1,000 occupied coordinates in the tested
fixtures.

## Baseline

Use the normal runtime produced by 8b. Use the 8d identity and rebuild rules.
Keep a probe build separate. Record normal-runtime host objects, memory,
initialization time, ping, and stable-reader performance before adding cache
load.

## Measurements

### View width

Continue progressively beyond 131,072 steps only while prior arms remain
healthy. Cover musically useful clip lengths and exact boundary notes. Keep a
smaller paired control and direct target reads. Stop at the first repeatable
performance knee or unsafe result; do not seek a crash boundary.

### Observer working set

Continue beyond 256 clips with realistic track-by-scene layouts. Include sparse
projects, dense rows, mixed empty and occupied slots, and more addressable slots
than the selected cache working set. Separate host-handle construction,
binding, replay, and steady-state cost.

### Occupancy and mutation load

Measure:

- empty, sparse, ordinary, dense, and extreme clips;
- simultaneous edits across several clips;
- note and field-only mutation bursts;
- structural rebuild bursts;
- dirty-coordinate queue growth, drain, and duplicate work; and
- late callbacks during load shedding or rebuild.

### Resource cost

Record extension-owned object counts and estimated bytes by type. Separate
sparse coordinate storage, note enrichment, proxy and observer handles,
registry state, and temporary rebuild state. Keep whole-JVM readings clearly
labeled as noisy host evidence.

Measure cold initialization, project-open replay, warm reads, mutations,
rebuilds, bridge latency, ping median and tail, normal Bitwig interaction, and
result size.

## Product policy

Select limits from useful budgets, not the last passing value. Define:

- maximum cached view width or clip range;
- maximum active observers and cache working-set policy;
- maximum occupied coordinates and pending dirty work;
- memory, initialization, replay, and rebuild budgets;
- callback backpressure and load-shedding rules;
- health states and observability; and
- behavior for every overflow or unhealthy state.

Permitted degradation can include a bounded working set, an exact fallback
read, a scheduled rebuild, or an explicit refusal. It cannot silently return
incomplete project state.

## Acceptance criteria

- Width, observer count, occupancy, and mutation rate are varied independently
  before combined stress arms.
- At least one realistic multi-track and multi-scene project layout is tested.
- The first practical knee has repeatable neighboring controls and fallback
  windows.
- Extension-owned memory has an object-based estimate.
- Tail latency, callback drain, rebuild, and ordinary UI responsiveness are
  reported.
- The selected product limits have stated headroom and musical meaning.
- Every over-limit state has a visible fallback or refusal.
- The stable reader remains available as authority during this session.
- All owned fixtures are removed and the normal extension is restored.
- Focused checks, the brain check, extension checks, context check, live hello,
  and `git diff --check` pass.

## Out of scope

- Shipping the product cache.
- Claiming a universal Bitwig or JVM maximum.
- Hiding overflow through partial results.
- Public compact-bar syntax.

## Retrospective target

Record the resource that sets the first useful product limit. Do not use the
largest numeric input as the conclusion when latency, memory, or rebuild time
sets an earlier limit.

## Result

[E139](../../evidence/experiments/e139-cache-scale-limits-and-degradation.md)
selects a working set of 512 active observers. A pipelined count sweep stayed
exact through 768 observers. It found no replay or ping knee. The 512-observer
cache bank constructed in 38.949 ms. The 768-observer bank took 59.057 ms and
crossed the 50 ms budget. The product view is 131,072 steps, or 64 bars of 4/4
at the D23 grid. Each cached clip can hold 2,048 occupied coordinates. Pending
dirty work is limited to 2,048 coordinates.

The
[degradation policy](../../evidence/format/CACHE_SCALE_AND_DEGRADATION.md)
sets memory, cache-construction, replay, rebuild, and tail-latency budgets. Each
overflow uses an exact authority read or refuses when authority is unavailable.
The executable policy is tested. The product cache remains out of scope.

## Retrospective

Phase-based binding amortizes track and scene settlement. Cache-bank
construction, not replay or ping, sets the selected observer limit. A future
probe reload must also confirm an empty bridge listener and no old controller
card before it adds the next instance.
