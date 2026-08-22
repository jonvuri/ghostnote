---
title: Phase 4, session 4h — device performance gate
kind: plan
state: planned
status: Planned after 4g. Measure complete device workflows before the public
        schema freezes.
updated: 2026-08-22
parent: README.md
prev: 4g-managed-fx-chain.md
next: 4i-device-surface.md
scope: Device workflow latency, observer cost, and targeted optimization
evidence: E5, E45, E48, E50, E55 · D7, D10
---

# Phase 4, session 4h — device performance gate

> **Purpose.** Explain and reduce repeated software overhead in the completed
> device workflow before public tool wording makes it harder to change.

## Carry-in

E55 proves that one serialized device cursor is sufficient for correct
parameter enumeration, write, independent readback, and exact reversal. It does
not prove that the serialized path is fast enough for real parameter batches.
Measure complete batch latency before you allocate a wider observer pool. Add
cursor concurrency only when the serialized cursor is a measured bottleneck and
each concurrent target can keep the same isolation proof.

## Scope

1. Define repeatable workloads for native enumeration and write, VST3 and CLAP
   enumeration and write, depth-2 routing, remote-page access, mixed three-device
   chain construction, verification, and reversal.
2. Record end-to-end time and separate target acquisition, observer
   stabilization, bridge traffic, host insertion, planned settlement, readback,
   and checkpoint recording.
3. Count cursor repoints, device selections, observer generations, bridge
   requests, and complete chain sweeps.
4. Compare cold and warm runs. Keep plugin load time separate from ghostnote
   overhead.
5. Remove repeated work only where the measurement identifies it. Reuse a
   confirmed observation within one safe operation, batch independent frames,
   or add a bounded bulk read when it preserves the same proof.
6. Re-run the session 4b clip benchmark to detect shared transport or adapter
   regression.
7. Set the measured device budgets and the public progress-report thresholds
   that session 4i will use.

## Required boundaries

- Do not reduce a settle budget without a new live boundary measurement.
- Do not cache a positional device address across a structural edit.
- Do not compare total plugin load with observer cost as one number.
- Do not add concurrency unless the serialized path is a measured bottleneck
  and target isolation remains provable.
- Do not freeze the public device surface while a repeated dominant cost remains
  unexplained.

## Exit criteria

1. Every workload has server time, bridge request count, host-settle time, and a
   named dominant phase.
2. Cold plugin load, warm parameter work, ghostnote overhead, and verification
   cost are reported separately.
3. No repeated per-parameter or per-channel bridge loop remains where one
   bounded complete reply can preserve the same semantics.
4. Any material optimization passes the same readback, interference, reversal,
   and cleanup checks as its baseline.
5. The session 4b exact-read benchmark has no material regression.
6. Device progress thresholds and settle budgets cite the new measurements.
7. The result records whether the serialized parameter cursor remains sufficient
   or a measured bottleneck justifies a wider isolated pool.
8. The public-surface session is either unblocked or the remaining blocker is
   named with a focused successor plan.
9. Focused tests, the brain check, extension tests, context check, and
   `git diff --check` pass.

## Retrospective target

Record whether the performance gate found a product design problem or only an
implementation loop. Carry forward only the distinction that changes work.
