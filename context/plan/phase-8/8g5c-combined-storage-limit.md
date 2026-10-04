---
title: Phase 8g5c — Combined storage limit
kind: plan
state: active
status: Complete. Counted 512-channel topology and occupancy pass. Live 24 MiB equality, excess, independent exact fallback, recovery, JVM sampling, eviction, and final restoration pass. E223 records the supported limits. Cache eligibility remains false; run 8g5 next.
updated: 2026-10-04
parent: 8g-shadow-project-cache.md
prev: 8g5b-slot-inventory-delivery.md
next: 8g5-final-shadow-acceptance.md
---

# Phase 8g5c — Combined storage limit

Result: [E223](../../evidence/experiments/e223-combined-storage-scale.md).

## Why

[E219](../../evidence/experiments/e219-snapshot-budgets-and-combined-storage.md)
sums every cache-owned estimate in one ledger, but each domain applies only its
own limit. No total limit is selected. Java heap and host memory are not
measured. 8g5a topology handles add new costs. The 8g5b occupancy source adds
no host handles; it reuses the rig's 256 `hasContent` observers over 32,768
slots ([E222](../../evidence/experiments/e222-slot-delivery-and-occupancy-window.md)).
Its admission limit (16 tracks, 128 scenes) must rise with the topology limit.

The operator requires support for at least 256 instrument/audio tracks.
Group wrappers, FX tracks, and Master need additional capacity. The current
16-flat-track topology limit is a research bound. It cannot satisfy the final
8g gate. Test 512 total channels as a candidate with additional capacity.

## Entry and scope

Read E219, the cache contract limit table, and the 8g5a and 8g5b cost records.
This session requires live allocation and scale measurements. Preserve protected
New 3. Use owned fixtures and operator controller replacement as AGENTS.md
requires. Do not enter 8h.

## Work and independent oracles

1. Measure initialization at topology capacities 16, 64, 256, and 512. Include
   a control with topology allocation disabled and keep other rig settings
   equal. Repeat cold initialization and report variation. Measure an empty
   project separately from populated fixtures: unused handles still allocate.
   Record bank/handle counts, initialization time, JVM heap, process memory,
   and idle CPU. Separate Java and host costs where the available measurements
   permit it. Report attribution limits; total process memory is not a precise
   topology allocation measurement.
2. Exercise at least 256 instrument/audio tracks plus group wrappers, FX, and
   Master. Include flat, wide-group, and nested-group trees with independent
   UUID oracles. Measure topology read time, callback activity, settlement,
   invalidation, and reacquisition during native changes. Include slot observer
   costs from 8g5b. A configured capacity without a populated fixture is not
   a scale acceptance result.
3. Select and implement a supported flat-track limit that meets the base-track
   minimum and leaves stated room for other channel types. Evaluate 512 total
   channels first. Report the selected limit and measured costs. If quadratic
   allocation is too costly, change the allocation design and repeat the
   affected correctness and cost checks. A smaller limit holds the final gate.
4. Add the topology and slot inventory domains to the resource ledger.
5. Select one combined estimate limit. Equality passes. Excess sheds load
   deterministically and uses exact fallback. A domain limit still applies.
6. Measure Java heap around a cold build, a full working set, and eviction.
   Use the JVM's own memory values as a separate measurement. Do not call the
   estimate heap memory.
7. Live: show combined equality and excess, then recovery, on one owned fixture.
   Also confirm that an independent TypeScript oracle agrees with the Java
   estimate.

## Acceptance criteria

- At least 256 instrument/audio tracks plus stated capacity for group wrappers,
  FX, and Master pass live topology and slot checks. The selected flat-track
  limit is implemented; excess refuses without accepting a partial project.
- Allocation measurements separate unused capacity from populated project
  cost. Initialization, memory, CPU, and topology change costs are reported.
- The 512-channel candidate has a measured result or an explicit measured reason
  to select another capacity that still meets the minimum.
- The contract limit table lists the combined limit with its over-limit result.
- Combined equality passes and excess refuses with recovery, live.
- Heap measurements are reported next to estimates, with their scope.
- Cleanup, normal reload, and all checks pass.
