---
title: Phase 8e — Cache scale limits and degradation policy
kind: plan
state: planned
status: Find practical performance knees on the lean runtime and select explicit product limits.
updated: 2026-09-25
parent: README.md
prev: 8d-cache-identity-and-lifecycle.md
next: 8f-consolidated-compact-bar-and-cache-contracts.md
evidence: E51-E54, E119, E130-E134; D23
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
