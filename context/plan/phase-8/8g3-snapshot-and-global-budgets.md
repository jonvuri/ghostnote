---
title: Phase 8g3 — Snapshot acquisition and global budgets
kind: plan
state: complete
status: Complete. E219 passes live 16 MiB snapshot equality and excess; other boundaries stay model-only.
updated: 2026-10-03
parent: 8g-shadow-project-cache.md
prev: 8g2b-step-delta-read-window.md
next: 8g4-native-topology-and-ordering.md
---

# Phase 8g3 — Snapshot acquisition and global budgets

## Result

Complete. [E219](../../evidence/experiments/e219-snapshot-budgets-and-combined-storage.md)
records the work. Enrichment runs in bounded private-candidate batches with
guard checks at each batch and at publication. One resource ledger reports all
domains. Live, the 16 MiB snapshot estimate passes equality and two-byte excess
with no earlier limit. Combined storage refuses overlap, and eviction plus an
explicit new attempt recovers. Retirement during enrichment releases the
candidate. Ping p95 under load is 25.06 ms. Recorder, authority, pending,
width, and observer boundaries stay model-only or earlier evidence. Heap is
unmeasured. Nothing is eligible.

## Entry and scope

Complete 8g1. Use the [8g2](8g2-project-continuity.md) guard decision before live
acquisition tests. Read the [review ledger](../../evidence/format/PHASE8G_INTERMEDIATE_REVIEW.md),
E139 selected limits, cache contract, and E214 memory diagnostic. The existing
4,096-note match is accepted. The 8,192-note time refusal does not test 16 MiB.
[8g2b](8g2b-step-delta-read-window.md) passed. Live shadow acquisitions now
use the [step-delta window](../../evidence/format/PHASE8G_PROJECT_CONTINUITY.md#8g2b-step-delta-read-window).
Each read stage needs a confirmation in a later callback, so budgets must count
the extra polls. Any step or rebind in any shadow observer refuses open windows
and discards retained output; measure that effect under load. Live slot
inventory still refuses (`inventory-outside-step-coverage`). Keep the selected
budgets and live eligibility gate unchanged. Do not enter 8h.

## Owned files and interfaces

- Core snapshot/enrichment and accounting in `ShadowProjectCache.java`.
- `ShadowCacheProbe.java`: reconciliation, authority/enrichment scheduling,
  phase times, aggregate storage, recovery, and resource diagnostics.
- Both coordinators: shared resource accounting where needed.
- `RigConfig.java`, `Rig.java`, and observer-budget tests if admission changes.
- `phase8g-snapshot-memory`, capacity, cache-acceptance, and resource library
  drivers/tests; affected v5/followup artifact verifiers.
- Core and adapter tests for budget equality, excess, cancellation, and recovery.

The pool algorithm, field normalization, cold replay, and prior capacity cases
are dependencies. Do not repeat their live corpus without a regression reason.

## Work and independent oracles

1. List each selected E139/contract limit with its measurement, accounting
   domain, equality rule, excess behavior, and recovery condition. Include view
   width, aggregate observers, occupied and pending coordinates, recorder and
   snapshot storage, construction, replay, rebuild, host work, and ping p95.
2. Account for retained residents, private staging, physical hints, independent
   authority, and candidate snapshots at the same time. State which allocations
   estimates cover. Do not add JSON bytes to a memory estimate as if they were
   measured heap. Label heap/host memory unmeasured unless it is measured.
3. Make enrichment bounded without widening time limits. Check each batch and
   final publication against the current guard. Retire partial candidates on
   deadline, memory excess, cancellation, and guard change.
4. Reach the selected snapshot boundary with an independent complete field
   oracle. Demonstrate equality and excess without an earlier time or hint
   limit. If another limit fires first, retain its actual refusal and stop that
   boundary arm. Do not count a synthetic model pass as a live boundary pass.
5. Test combined working sets, eviction/recovery, interrupted staging, and
   latency. Report phase times, host reads, response bytes, public tool calls,
   and agent delay in distinct units and scopes.

## Acceptance criteria

- Every selected limit has model proof and the required implementation/live
  evidence, or is explicitly still unverified. Missing measurements refuse.
- Zero pending dirty work, complete field/channel coverage, replay, and current
  identity remain mandatory even at passing budget equality.
- Snapshot equality and excess exercise the selected 16 MiB estimate itself.
  Excess retains no candidate/current snapshot and has a stable terminal reason.
- Combined storage uses one documented accounting boundary. Old registry,
  staging, authority, recorder, and snapshot overlap cannot silently escape it.
- Callbacks remain bounded hints. Scheduling cannot turn partial acquisition
  into complete output or an endless retry.
- Recovery starts explicitly with a new attempt and passes an independent full
  oracle. Ping and phase latency meet the selected limits under that workload.
- Resource estimates, object counts, serialized bytes, and measured heap retain
  distinct names. Report unavailable quantities directly.

## Checks, live cleanup, and stopping rule

Run affected core, adapter, coordinator, observer, and TS resource tests. Include
equality/excess mutants, stale final guards, and retained terminal output. Run
full brain/extension checks, five artifact verifiers, wire, context, and diffs.

Use one owned fixture. Check marker/fresh hello through the repository reload
procedure. Capture a full entry baseline, preserve raw disabled controls in the
oracle, and restore all fixture notes before deleting only owned content.
Restore the exact API baseline, config bytes, and fresh normal controller.
Never save or close original `New 1`.

A wrong field, incomplete oracle, earlier limit, or exceeded latency stops that
acceptance arm. Persist the terminal result before assertions. Keep diagnostic
attempts separate from passes. A host knowledge gap belongs to 8g2; no vendor
message is authorized by this plan.

## Exit

Update the ledger's individual budget status and costs. Keep unmeasured gates
open. Stage the session's changes without a commit and hand off to 8g4.
Suggested commit message: `feat: bound shadow snapshot acquisition and aggregate storage`.
