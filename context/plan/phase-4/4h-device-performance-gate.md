---
title: Phase 4, session 4h — device performance gate
kind: plan
state: complete
status: Complete. E60 measures the complete workflows and identifies remote and
        plugin observer loops. Session 4h1 blocks the public schema freeze.
updated: 2026-08-22
parent: README.md
prev: 4g-managed-fx-chain.md
next: 4h1-device-observer-efficiency.md
scope: Device workflow latency, observer cost, and targeted optimization
evidence: E5, E45, E48, E50, E55, E59, E60 · D7, D10
---

# Phase 4, session 4h — device performance gate

> **Purpose.** Explain and reduce repeated software overhead in the completed
> device workflow before public tool wording makes it harder to change.

## Carry-in

E55 proves that one serialized device cursor is sufficient for correct
parameter enumeration, write, independent readback, and exact reversal. E59
adds the complete managed workload: mixed insertion, relocation, parameter and
enabled-state writes, guarded observation, retryable recovery, and reversal. It
does not prove that the serialized path is fast enough for real parameter
batches. Measure complete batch latency before you allocate a wider observer
pool. Add cursor concurrency only when the serialized cursor is a measured
bottleneck and each concurrent target can keep the same isolation proof.

## Scope

1. Define repeatable workloads for native enumeration and write, VST3 and CLAP
   enumeration and write, depth-2 routing, remote-page access, and the E59
   managed mixed-chain workflow. Include construction, guarded verification,
   recovery, and reversal.
2. Record end-to-end time and separate target acquisition, observer
   stabilization, bridge traffic, host insertion, planned settlement, readback,
   and checkpoint recording.
3. Count cursor repoints, device selections, observer generations, bridge
   requests, complete chain sweeps, and managed accepted-boundary reads.
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

## Result

E60 records native, VST3, CLAP, depth-1, depth-2, drum-pad, remote, managed,
reversal, and clip-regression measurements. Verification and observer work
dominate. Extension server time is small.

The managed cold and warm builds took 50,203 and 50,426 ms. The cold run used
1,163 bridge requests. The warm run used 1,170. Plugin load is not the dominant
cost. One remote change and replay took 14,243 ms and used 335 requests. It
included 124 remote-list reads and 56 page selections.

A same-generation DirectParameter readback trial kept the settle budget but
returned stale plugin values. The trial was removed. A wider cursor pool would
not remove the measured same-target and per-page loops, so no concurrency was
added.

The existing settle budgets remain. E60 sets provisional device ceilings and
requires background progress after 2,000 ms. The 4b clip median was 1,936 ms,
and the two-empty-clip workflow was 6,352 ms. Both stay within the accepted
gates.

The session found a product design problem in the one-page remote observer and
an implementation completion problem for large plugin inventories. Session
4h1 is the focused repair. Session 4i remains blocked.

The full brain check passes 752/752, including typecheck. Extension tests pass.
The context check passes for 201 active documents. The final read-only accepted-
project baseline passes with seven tracks and no launcher residue. Both diff
checks pass.
