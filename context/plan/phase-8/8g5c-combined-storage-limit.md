---
title: Phase 8g5c — Combined storage limit
kind: plan
state: active
status: Pending. Run after 8g5b. Select one total cache storage limit.
updated: 2026-10-03
parent: 8g-shadow-project-cache.md
prev: 8g5b-slot-inventory-delivery.md
next: 8g5-final-shadow-acceptance.md
---

# Phase 8g5c — Combined storage limit

## Why

[E219](../../evidence/experiments/e219-snapshot-budgets-and-combined-storage.md)
sums every cache-owned estimate in one ledger, but each domain applies only its
own limit. No total limit is selected. Java heap and host memory are not
measured. 8g5a topology handles and 8g5b slot observers add new costs.

## Entry and scope

Read E219, the cache contract limit table, and the 8g5a and 8g5b cost records.
This session can run mostly offline. Do not enter 8h.

## Work and independent oracles

1. Add the topology and slot inventory domains to the resource ledger.
2. Select one combined estimate limit. Equality passes. Excess sheds load
   deterministically and uses exact fallback. A domain limit still applies.
3. Measure Java heap around a cold build, a full working set, and eviction.
   Use the JVM's own memory values as a separate measurement. Do not call the
   estimate heap memory.
4. Live: show combined equality and excess, then recovery, on one owned fixture.
   Also confirm that an independent TypeScript oracle agrees with the Java
   estimate.

## Acceptance criteria

- The contract limit table lists the combined limit with its over-limit result.
- Combined equality passes and excess refuses with recovery, live.
- Heap measurements are reported next to estimates, with their scope.
- Cleanup, normal reload, and all checks pass.
