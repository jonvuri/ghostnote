---
title: E134 — Project observer scale sweep
kind: evidence
state: active
updated: 2026-09-25
parent: ../../plan/phase-7/7b-follow-up-project-observer-scale-sweep.md
---

# E134 — Project observer scale sweep [K]

## Verdict

Design a project-wide persistent occupancy cache in a later session. One fixed
`1/512` view per clip passed through 131,072 steps, or 256 beats. The required
128-clip load and the separate 256-clip stretch load both passed. Ping p95 did
not materially change. Sparse warm reads remained more than 99 percent faster
than matched complete scans.

The cache rule must treat each step-data callback as a channel-free coordinate
invalidation. It must re-read all 16 MIDI channels at that coordinate. It can
remove the coordinate only when every channel is empty. It must also re-resolve
clip addresses after structural changes because a pinned clip can keep content
while its reported scene index is stale.

This verdict replaces the withdrawn initial E134 rejection. The first run had
three experiment-design errors:

- It reset the recorder after controller load without forcing a later target
  transition. Initial replay could finish before the reset.
- It jumped from 16 to 64 observers without intermediate counts or a populated
  canary for every observer.
- It treated a channel-free callback as channel-aware note truth. Bitwig kept
  the other channel in the clip. The recorder removed the shared coordinate.

## Corrected method

Each width arm allocated two isolated cursor tracks, pinned clip proxies, and
observers. One view was always 2,048 steps. The other was the candidate width.
Both views first bound to a populated clip on another track. Both then bound to
the same width fixture. Direct `getStep` samples proved each expected boundary
note through the current proxy.

Each count arm allocated one isolated cursor track, pinned clip proxy, and
observer per clip. Every observer first replayed the same populated cross-track
canary. It then replayed one unique low-density clip. The count sequence was 1,
8, 16, 24, 32, 48, 64, 96, and 128. A separate arm used 256 distinct clips.

The recorder held sparse occupied and dirty coordinate sets. A callback only
marked a coordinate dirty. Reconciliation read all 16 channels at each dirty
coordinate. Targeted enrichment then read full note fields at the settled
occupied coordinates. A settled complete `1/512` scan was the authority.

The short window required at least 250 ms after the last callback. The probe
had 8-, 30-, and 60-second fallback windows, direct target reads, canary
rebinds, and failed-index retries. No corrected arm needed an extended window.
The 250 ms period remains an empirical policy, not an API guarantee.

## Width

Every candidate passed beside its 2,048-step control.

| Steps | Beats at `1/512` | Result | Candidate first callback | Final boundary |
|---:|---:|---|---:|---:|
| 2,049 | 4.002 | Pass | 47.873 ms | 2,048 |
| 4,096 | 8 | Pass | 50.359 ms | 4,095 |
| 8,192 | 16 | Pass | 24.412 ms | 8,191 |
| 16,384 | 32 | Pass | 23.959 ms | 16,383 |
| 32,768 | 64 | Pass | 44.312 ms | 32,767 |
| 65,536 | 128 | Pass | 49.201 ms | 65,535 |
| 131,072 | 256 | Pass | 25.094 ms | 131,071 |

The candidate and control each replayed the canary before the target. The
candidate sparse set contained every in-range boundary. The control contained
only its two in-range fixture coordinates. Direct samples confirmed the exact
notes. Target settlement took approximately 328–345 ms in these two-observer
arms.

The earlier claimed 2,048-step ceiling was an artifact of the recorder reset.
It was not a Controller API limit.

## Observer count and latency

All count arms used 131,072-step views. Settlement includes sequential bridge
binding and the callback quiet period. Warm and complete values are host scan
medians for one populated clip.

| Observers | Result | Target settlement | Ping p95 | Warm median | Complete median | Sparse entries |
|---:|---|---:|---:|---:|---:|---:|
| 1 | Pass | 0.388 s | 25.433 ms | 0.080 ms | 245.284 ms | 1 |
| 8 | Pass | 0.483 s | 25.529 ms | 0.079 ms | 247.514 ms | 8 |
| 16 | Pass | 0.388 s | 24.835 ms | 0.091 ms | 246.444 ms | 16 |
| 24 | Pass | 0.578 s | 25.375 ms | 0.097 ms | 176.140 ms | 24 |
| 32 | Pass | 0.777 s | 25.020 ms | 0.089 ms | 233.935 ms | 32 |
| 48 | Pass | 1.159 s | 25.611 ms | 0.089 ms | 259.170 ms | 48 |
| 64 | Pass | 1.535 s | 24.903 ms | 0.087 ms | 254.215 ms | 64 |
| 96 | Pass | 2.306 s | 25.102 ms | 0.117 ms | 242.981 ms | 96 |
| 128 | Pass | 3.077 s | 24.960 ms | 0.087 ms | 252.758 ms | 128 |
| 256 | Pass | 6.180 s | 25.518 ms | 0.077 ms | 216.245 ms | 256 |

The matched no-observer ping p95 from the first run was 25.111 ms. The largest
corrected p95 was 25.611 ms, a 2.0 percent increase. It is below the 15 percent
gate. Ordinary ping maxima remained below 28 ms and far below the 100 ms gate.

The 64-observer arm is important. All 64 views replayed the canary and unique
targets. The earlier zero-callback result was not repeatable with an explicit
target transition. It was an experiment error, not a capacity boundary.

Controller initialization did not grow monotonically. Measured total init time
was 43.364 ms with one observer, 35.519 ms with 128, and 36.878 ms with 256.
The 256-view rig constructed in 35.167 ms. The normal host and bridge remained
responsive.

## Callback density

Five fixed views replayed clips with 1, 16, 64, 256, and 1,000 occupied
coordinates. Every sparse result matched a complete `1/512` scan.

| Coordinates | Arm callbacks | Targeted host read | Complete host scan |
|---:|---:|---:|---:|
| 1 | 20 | 0.126 ms | 142.667 ms |
| 16 | 19 | 0.074 ms | 249.180 ms |
| 64 | 97 | 0.294 ms | 320.680 ms |
| 256 | 385 | 0.904 ms | 171.107 ms |
| 1,000 | 1,513 | 1.704 ms | 121.675 ms |

Callback counts include target-transition clears and replays. They are not a
pure note-count measure. Sparse coordinate counts were exactly 1, 16, 64, 256,
and 1,000. Targeted host work grew with occupied coordinates and remained well
below complete-scan cost.

## Correctness

The corrected shared-coordinate test started with channel 0 and channel 5 at
the same time and pitch. Removing channel 5 caused an empty occupancy callback.
Reconciliation read every channel, kept the coordinate, and returned channel 0.
Removing channel 0 then removed the coordinate. Both results matched fresh
complete scans. Bitwig did not delete the wrong note. The first recorder held
the callback incorrectly.

A second corrected mutation matrix matched complete scans after every step:

| Step | Occupied coordinates | Notes | Result |
|---|---:|---:|---|
| Initial replay | 4 | 5 | Pass |
| Add | 5 | 6 | Pass |
| Move | 5 | 6 | Pass |
| Field-only edit | 5 | 6 | Pass |
| Remove | 4 | 5 | Pass |
| Remove one shared channel | 4 | 4 | Pass |
| Remove the last shared channel | 3 | 3 | Pass |

The field-only arm confirmed velocity, duration, and chance from targeted
enrichment. The first run's empty, sparse, dense, binary, triplet, all-channel,
different-pitch, and sub-cell comparisons remain valid raw observations. The
accepted D23 loss is unchanged: multiple same-channel, same-pitch onsets inside
one `1/512` cell become one acquired identity.

Scene compaction preserved the pinned target and all three remaining notes.
Deleting an earlier track moved the target from track index 3 to 2 and preserved
the notes. Deleting the observed clip produced empty callbacks; reconciliation
cleared all entries and matched the empty complete scan. The pinned clip still
reported its old scene index after scene compaction. A cache must use structural
epochs and address re-resolution instead of trusting that index.

The corrected probe ran across many controller loads and repeatedly proved
initial replay after load. It did not perform a separate saved-project close
and reopen cycle. That remains a product-design verification item. It does not
change the measured width or handle capacity.

## Memory

Whole-JVM heap samples were noisy. Several complete-scan arms raised the sample
near the 3,072 MB maximum. Later arms returned to approximately 600–740 MB
without a process restart. The 48- and 256-observer arms ended at 680 MB and
672 MB. These readings do not support a per-observer memory estimate.

Extension-owned recorder storage was sparse. It held one entry per occupied
coordinate in the count fixture. It did not allocate `width * 128` cell arrays.
The exact product object overhead remains unmeasured.

## Cleanup and product state

The corrected probe removed its four owned tracks, 265 owned clips, and 119
remaining added scenes. It restored four unowned baseline tracks, eight empty
scenes, launcher and mixer selection `0:0`, stopped transport, and the original
cursor pin states. No owned fixture name remains.

The temporary observer bank, six methods, configuration fields, and live probe
were removed. The original rig configuration and stable extension were
restored. The stable reader, stable profile, and note-write path did not change.

After the final stable controller reload, live hello confirmed Controller API
25, 157 methods, and method hash `905bc2531512025b`. It also confirmed four
tracks and eight scenes. Visual inspection confirmed an empty launcher and
stopped transport in the unsaved `New 1` project.

## Verification

- `npm run check`: 1,176 tests passed.
- `./gradlew test`: passed.
- `ruby context/check.rb`: 349 active documents passed with intact links.
- `npm run wire:golden`: 157 methods matched hash `905bc2531512025b`.
- `npm run probe:hello`: all live stable-extension checks passed.
- `git diff --check`: passed.

## Retrospective

Record the exact baseline identities before fixture setup, not only during
cleanup. Require a populated source-to-target transition in every observer
replay test. Treat channel-free callbacks as invalidations, not note truth.
