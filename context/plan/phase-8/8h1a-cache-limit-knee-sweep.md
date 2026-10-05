---
title: Phase 8h1a — Cache limit knee sweep
kind: plan
state: active
status: First pass done (E225). Width is free; cost is per sounding cell and per observer. Continue with the open rows.
updated: 2026-10-05
parent: 8h-cache-promotion-and-interface-simplification.md
prev: 8h-cache-promotion-and-interface-simplification.md
next: 8h2-exact-reader-consolidation.md
evidence: E139, E214, E215, E219, E222, E223, E224, E225; D26, D27, D28, D29
---

# Phase 8h1a — Cache limit knee sweep

## Status

The first pass is recorded in
[E225](../../evidence/experiments/e225-cache-limit-knee-sweep.md). It replaces
the single maximum allocation with one dimension for each fresh Bitwig session
([D29](../../decisions/d29-saved-anchor-project-replaces-protected-new-3.md)).
The middle allocation crashed the host; the maximum allocation must not load.
Measure the live heap with `jcmd <pid> GC.class_histogram` and stop at 2 GiB.

### Continuation session

Start a fresh research session with these rows, in order:

1. **Warm-read slowdown.** The same 4,096-note clip needs 32 ms of enrichment
   host work with 2 allocated observers and 211 ms with 4,096. Test the suspect
   first: `eligibility` calls `recorderTotal`, which sums every view's hint
   queue for each enriched coordinate. Replace the sum with a maintained count,
   then compare 2, 512, and 4,096 observers. Also remove the handle-pool list
   from each poll response.
2. **Cursor slot bank.** Rerun the binding matrix with
   `cacheShadowCursorScenes: 0`: rows up to the last scene, canary rebinds and
   the escape stage, the dense comparison path, and exact fallback.
3. **Flat bank.** Vary tracks, then scenes, at a fixed observer count. Measure
   the heap per slot and the slot-delta drain after a real project switch.
4. **Deadlines.** Derive replay, enrichment, and rebuild deadlines. Measure the
   serial canary rebind of a working set.
5. **Combined arm.** Run near the selected values in a fresh JVM. Get an
   operator rating of UI responsiveness.

Then replace the limit table below with the selected values and reasons.

## Why

The cache exists only to give a very fast clip read. Its limits must be so
large that normal use practically never reaches them. Set a limit only at a
measured knee: the first point where host performance degrades, or where a
warm cache read stops being clearly faster than the exact E131 read.

Most current limits do not come from such a knee:

| Parameter | Current | Origin | Status |
|---|---|---|---|
| Clip width | 131,072 steps (64 bars) | E139 musical choice | No knee through 1,048,576 steps |
| Occupied coordinates per clip | 2,048 | E139 single reconcile pass above 50 ms | Obsolete: reconcile and enrichment now run in batches of 40 ms or less |
| Pending dirty coordinates | 2,048 total | Same single-pass knee | Obsolete; a large reconstruct transpose forces a rebuild |
| Observers | 512 (2 in the accepted config) | 50 ms one-time construction budget | Replay and ping showed no knee through 768 |
| Project channels / scenes | 512 / 128 | Operator requirement / research bound | No measured knee |
| Snapshot, authority, registry, combined estimates | 16 / 16 / 16 / 24 MiB | Round numbers | No knee; estimates, not heap |
| Replay, enrichment, rebuild deadlines | 5 s / 5 s / 40 s | Small-clip budgets | Not derived at large sizes |

A promoted read keeps cached membership only. It reads values live at occupied
coordinates and does not reuse a retained snapshot. Thus snapshot size limits
only one transient read copy.

## Runtime configuration

Bitwig creates host objects only during `init()`. Allocate once at maximum
capacity, then vary active scale at runtime. E139 used this method for its
768-observer count sweep.

1. Add a research build that allocates the maximum: 4,096 shadow observers
   with grid width 4,194,304 steps, and a 2,048-channel by 512-scene flat bank
   with counted topology.
2. Add a research `cache.configure` bridge operation. It sets the active
   observer count (subscribe and unsubscribe), bank size (`setSizeOfBank`),
   used coverage width, and every software cap and deadline. It returns the
   applied configuration. It refuses a value above the allocated capacity.
3. Queue many arms in one controller load.

Reload only for allocation cost and for Java fixes. Measure allocation cost at
about three sizes, smallest first: the current research allocation, a middle
allocation, and the maximum. If the maximum cannot load, record that as a knee
and step down. Target three to five operator replacements for the session.

Measure one control first: idle CPU and ping with the maximum allocation and
nothing subscribed, then with everything subscribed. Unsubscribed cost is not
proved (E215).

## Axes

Vary each axis independently, then run one combined arm near the selected
values.

| Axis | Range |
|---|---|
| Width | 131,072 to 4,194,304 steps |
| Occupied coordinates per clip | 1,000 to 131,072 |
| Active observers | 512 to 4,096 |
| Project size | 512 to 2,048 channels; 128 to 512 scenes |
| Edit burst | Reconstruct transpose of clips up to 50,000 notes |
| Project switch | Slot-delta delivery and drain at each project size |

## Metrics

For each arm, record:

- warm promoted-read latency, without the dense oracle;
- cold bind, replay, and settlement time;
- enrichment host work and batches for each read;
- reconcile and dirty-work drain time after an edit burst;
- controller initialization and allocation time for each allocation size;
- bridge ping p95 and host idle CPU;
- shared JVM heap at the largest arms;
- slot-delta drain time after a project switch; and
- a short operator rating of Bitwig UI responsiveness at each knee candidate.

Compare warm reads with paired E131 reads on the same clips.

## Correctness checks

Keep checks proportional. Use E131 or targeted coordinate reads as the oracle
at large widths. Use the dense shadow oracle only at moderate widths, because
its cost grows with width (about 2.1 billion reads at 1,048,576 steps). Check
the final cell, all 16 channels, and membership at every axis maximum.

## Selection

Set each limit at its first knee with a small stated margin. If no knee
appears, use the largest passing value. Then:

- remove the snapshot, authority, registry, and combined estimate gates;
  optionally keep one coarse runaway guard of a few hundred MiB;
- replace the pending-count limit with a time-bounded drain;
- keep the per-batch host-work limit and the ping health signal; and
- derive replay, enrichment, and rebuild deadlines from the largest passing
  arms.

Record compact note storage or a persistent buffer as an 8h1 task only if
warm reads at large occupancy exceed about 100 ms.

## Acceptance criteria

- Every axis has a recorded knee or its largest passing value, with metrics.
- Allocation cost is measured at each allocation size in fresh loads.
- The unsubscribed-cost control is recorded.
- Warm-read latency is compared with E131 across widths and densities.
- A selected limit table with reasons replaces the table above.
- Owned fixtures are removed. Protected New 3 stays at its baseline. The normal
  extension is restored with a fresh normal hello.
- Brain check, extension check, wire goldens, context check, and
  `git diff --check` pass.

## Out of scope

- Live eligibility, the clip-extent predicate, and E131 fallback wiring (8h1).
- Exact reader changes (8h2).
