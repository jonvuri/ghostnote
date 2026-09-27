---
title: E139 — Cache scale limits and degradation are measured
kind: evidence
state: active
updated: 2026-09-25
parent: ../../plan/phase-8/8e-cache-scale-limits-and-degradation.md
---

# E139 — Cache scale limits and degradation are measured

## Verdict

The initial serial probe made lifecycle cost appear to be the first useful cache
limit. Pipelined binding disproved that interpretation. A count sweep stayed
exact from 64 through 768 unique occupied clips. At 768 observers, median
working-set replay was 11.535 seconds and ping p95 was 27.43 ms. Replay and ping
did not set an observer-count knee.

Cache-bank construction sets the selected observer limit. Construction took
38.949 ms at 512 observers and 59.057 ms at 768. The selected 512-observer bound
stays below the 50 ms budget and has 1.5x measured correctness headroom. The
measured occupancy and dirty-work knees remain valid.

The selected policy uses 131,072 steps, 512 active observers, 2,048 occupied
coordinates per cached clip, 2,048 pending dirty coordinates, and 16 MiB of
estimated sparse recorder storage. Every over-limit case uses an exact E131
fallback or an explicit refusal. The policy is defined in
[cache scale limits and degradation](../format/CACHE_SCALE_AND_DEGRADATION.md).

No product cache was added.

## Method

The run used Bitwig Studio 6.0.6, host API 25, runtime
`phase-8-probe-v1`, 96 methods, and hash `2fb62a8d7beb82a6`.
The normal comparison runtime remains `normal-v1`, 85 methods, and hash
`bba7383dce25c0f0`.

The probe allocated one cursor track, one pinnable clip proxy, and one step-data
observer for each scale view. Its sparse recorder stored only occupied and
dirty `(x,y)` coordinates. Each authority reconciliation read all 16 MIDI
channels for each dirty coordinate.

The first pass used 12 tracks and 32 scenes. It contained 288 occupied clips
and 96 empty slots. The pipelined count sweep expanded the layout to 32 tracks
and 32 scenes. It contained 768 occupied clips and 256 empty slots. A separate
density track contained clips with 0, 1, 16, 256, 1,000, 2,000, 4,000, and 8,192
occupied coordinates. Count arms bound only to occupied clips because a
launcher cursor clip cannot bind to a slot that has no clip.

Width, observer count, occupancy, and mutation arms ran independently. The
final combined arm used 64 count observers plus the paired 2,048-step control
and 131,072-step candidate.

## Width

| Steps | Beats | 4/4 bars | Construct | Target bind | Final-cell direct read | Ping p95 |
|---:|---:|---:|---:|---:|---:|---:|
| 131,072 | 256 | 64 | 0.076 ms | 405.9 ms | 0.086 ms | 25.59 ms |
| 524,288 | 1,024 | 256 | 0.095 ms | 412.4 ms | 0.064 ms | 25.03 ms |
| 1,048,576 | 2,048 | 512 | 0.082 ms | 407.7 ms | 0.042 ms | 25.00 ms |

Each final boundary cell replayed exactly and matched a direct 16-channel read.
No width knee appeared through 1,048,576 steps. The product still selects
131,072 steps because it covers 64 bars at 4/4 and keeps 8x measured technical
headroom.

An early 131,072-step arm and one 262,144-step arm ran while a failed duplicate
controller card had also allocated probe resources. They passed, but their
timings are not in this table. The retained 131,072, 524,288, and 1,048,576
rows each used one confirmed controller instance.

## Observer working set

| Views | Construct | Initialization | Canary bind | Layout bind | Full rebuild | Reconcile | Recorder bytes | Ping p95 |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 64 | 2.882 ms | 25.982 ms | 11.736 s | 18.230 s | 33.034 s | 0.703 ms | 19,968 | 25.16 ms |
| 128 | 7.309 ms | 35.901 ms | 20.838 s | 40.593 s | 64.485 s | 1.692 ms | 39,936 | 25.44 ms |
| 192 | 6.458 ms | 23.325 ms | 36.687 s | 62.371 s | 102.134 s | 3.836 ms | 59,904 | 25.48 ms |
| 256 | 8.560 ms | 25.800 ms | 52.427 s | 81.988 s | 137.504 s | 3.034 ms | 79,872 | 25.64 ms |
| 320 | 9.879 ms | 25.630 ms | 65.727 s | 106.361 s | 175.147 s | 3.336 ms | 99,840 | 25.11 ms |

All views bound, replayed, reconciled, and returned exact representative E131
authority samples. The 320-view arm used all 288 unique occupied clips, then 32
duplicate bindings. It did not claim 320 unique clips.

The rebuild measurement includes a canary pass, a realistic layout pass,
callback settlement, and authority reconciliation. Binding is deliberately
sequential because each proxy must confirm its track before the slot selection.
This method includes avoidable waiting between observers. It does not affect
steady reads.

The original serial method put the apparent 40-second rebuild knee between 64
and 128 observers. The 64-view combined arm initialized in 17.619 ms, rebuilt in
34.097 seconds, and held ping p95 at 25.22 ms. The pipelined follow-up below
shows that this serial knee is not a valid observer limit.

### Pipelined binding follow-up

The follow-up alternated three serial and three pipelined trials in one live
controller instance. Each trial started from the same 64-observer canary state
and bound the same 64 occupied target clips.

An initial all-at-once attempt did not settle. Unpinned cursor tracks converged
on the last selected target. The retained pipeline therefore grouped track
pointing and pinning by target track. It then grouped clip selection and pinning
by scene. This preserved cursor identity and removed the wait after each
observer.

| Mode | Median bind | Bind per observer | Median working-set replay | Replay per observer | Ping p95 range |
|---|---:|---:|---:|---:|---:|
| Serial | 21.439 s | 334.99 ms | 22.993 s | 359.26 ms | 24.85–25.82 ms |
| Pipelined | 4.472 s | 69.87 ms | 6.007 s | 93.86 ms | 24.94–25.86 ms |

Pipelining improved median binding by 4.79x and working-set replay by 3.83x.
All six trials published 64 exact occupied coordinates, drained pending work,
and kept all 64 views bound. Pipelined reconciliation stayed between 7.820 and
20.605 ms. Three representative E131 reads remained exact.

This result confirms that per-observer serial waiting was too conservative. The
count sweep below measures the same pipeline at higher counts.

### Pipelined count sweep

The sweep allocated 768 observers in one controller. It activated prefixes of
64, 128, 256, 384, 512, 640, and 768 observers. Thus, lower-count trials also
carried the full 768-observer host allocation. Each count ran three trials.
Each trial used a canary reset, one unique occupied clip per active observer,
complete callback drain, reconciliation, three independent E131 samples, and
a ping tail. A final 64-observer recovery trial checked for cumulative damage.

| Active observers | Median bind | Bind per observer | Median working-set replay | Replay per observer | Median ping p95 |
|---:|---:|---:|---:|---:|---:|
| 64 | 4.913 s | 76.77 ms | 6.462 s | 100.97 ms | 26.25 ms |
| 128 | 5.527 s | 43.18 ms | 7.076 s | 55.28 ms | 26.77 ms |
| 256 | 5.926 s | 23.15 ms | 7.446 s | 29.08 ms | 25.99 ms |
| 384 | 6.252 s | 16.28 ms | 7.788 s | 20.28 ms | 27.63 ms |
| 512 | 7.215 s | 14.09 ms | 8.813 s | 17.21 ms | 27.31 ms |
| 640 | 8.689 s | 13.58 ms | 10.256 s | 16.02 ms | 26.71 ms |
| 768 | 9.979 s | 12.99 ms | 11.535 s | 15.02 ms | 27.43 ms |

All 21 trials stayed exact. Each trial drained pending work, kept all active
views bound, and matched all representative authority reads. No replay or ping
knee appeared. The 512-observer replay has 4.5x headroom under the 40-second
working-set budget. It can cover 32 tracks by 16 clips or 16 tracks by 32
clips. The 768-observer result gives 1.5x count headroom.

The recovery trial also stayed exact. It bound in 4.299 seconds, replayed in
5.822 seconds, and held ping p95 at 26.87 ms. Per-observer replay decreased as
the count grew. This shows that phase-based binding amortizes fixed settlement
cost.

### Observer allocation boundary

Separate controller reloads measured cache-bank construction. The zero-view
row used the same expanded project and isolates the base rig cost.

| Allocated observers | Cache-bank construction | Full rig construction | Initialization | Explicit host objects | Callbacks | Ping p95 |
|---:|---:|---:|---:|---:|---:|---:|
| 0 | 0 ms | 51.970 ms | 55.197 ms | 33,893 | 839 | 25.43 ms |
| 384 | 27.798 ms | 80.244 ms | 82.032 ms | 34,661 | 1,223 | 25.31 ms |
| 512 | 38.949 ms | 84.453 ms | 86.501 ms | 34,917 | 1,351 | 25.02 ms |
| 768 | 59.057 ms | 94.598 ms | 115.722 ms | 35,429 | 1,607 | 25.74 ms |

The base rig already needs more than 50 ms in this expanded project. Therefore,
the 50 ms product budget applies to incremental cache-bank construction, not to
the full extension initialization. The 512 row passes. The 768 row fails. This
construction boundary selects 512 even though replay remains healthy at 768.

## Occupancy

| Coordinates per view | Callback tail | Reconcile, two views | Recorder estimate, two views | Ping p95 |
|---:|---:|---:|---:|---:|
| 0 | 2.166 s | 0.040 ms | 512 B | 25.40 ms |
| 1 | 0.192 s | 0.023 ms | 624 B | 25.62 ms |
| 16 | 2.025 s | 0.103 ms | 2,304 B | 25.77 ms |
| 256 | 2.163 s | 1.560 ms | 29,184 B | 25.31 ms |
| 1,000 | 2.020 s | 10.695 ms | 112,512 B | 25.46 ms |
| 2,000 | 2.271 s | 31.694 ms | 224,512 B | 27.02 ms |
| 4,000 | 2.168 s | 68.679 ms | 448,512 B | 25.94 ms |
| 8,192 | 2.318 s | 146.190 ms | 918,016 B | 24.83 ms |

All arms were exact. The first useful host-work knee is between 2,000 and 4,000
coordinates because reconciliation crosses 50 ms. The selected 2,048 limit is
close to the passing neighbor and has 4x technical correctness headroom.

The object estimate uses 256 bytes for one recorder and its two set shells, then
56 bytes for each boxed key and set node. It excludes Bitwig host internals.
At 64 clips and 2,048 occupied coordinates, the estimate is about 7.0 MiB.
At 512 clips, the same worst-case density would need about 56 MiB. The 16 MiB
storage budget is independent of the observer cap. It can reduce the resident
set below 512 when cached clips are dense.

## Mutation and backpressure

The retained combined arm ran under 64 bound count observers.

| Changed coordinates | Set reconcile | Field reconcile | Clear reconcile | Peak dirty, paired views | Peak recorder estimate | Ping p95 |
|---:|---:|---:|---:|---:|---:|---:|
| 16 | 0.049 ms | 0.082 ms | 0.113 ms | 32 | 4,096 B | 25.33 ms |
| 64 | 0.308 ms | 0.192 ms | 0.296 ms | 128 | 14,848 B | 25.19 ms |
| 256 | 0.851 ms | 0.609 ms | 0.923 ms | 512 | 57,856 B | 26.12 ms |
| 1,024 | 15.463 ms | 8.063 ms | 11.083 ms | 2,048 | 229,888 B | 25.96 ms |
| 4,096 | 67.152 ms | 52.710 ms | 68.068 ms | 8,192 | 918,016 B | 25.10 ms |

The selected pending-work limit is 2,048 coordinates. The next arm crossed the
50 ms host-work budget for set, field, and clear reconciliation.

The shedding arm stopped accepting callbacks, changed 256 coordinates, and
rejected all 512 callbacks from the paired views. It then changed binding state,
replayed, and reconciled 512 exact occupied coordinates in 1.178 ms. No rejected
callback entered the rebuilt published state.

## Resource and responsiveness results

The normal runtime baseline from E136 owns 33,891 explicitly counted host
proxies and 838 callbacks. The 64-view count probe reported 34,021 explicit
proxies. The selected combined probe reported 34,025. Each scale view added one
cursor track, one clip proxy, one step-data observer, and about 32 bytes of
extension references.

In the expanded project, the zero-view probe reported 33,893 explicit host
objects and 839 callbacks. The 512-view probe added 1,024 explicit host objects
and 512 callbacks. The 768-view probe added 1,536 objects and 768 callbacks.
Each view still owns one cursor track, one clip proxy, and one step-data
observer.

Whole-JVM heap samples ranged from 598 to 1,836 MB and did not increase
monotonically with observer count. They include Bitwig and JVM activity, so they
are noisy host evidence and not an extension-owned memory estimate.

Steady ping p95 stayed below 28.1 ms in retained arms. Settings, controller
reload, project setup, and cleanup remained interactive. No independent human
latency rating ran during the long rebuild loops. The measured ping and exact
authority reads are the retained responsiveness evidence.

Representative complete E131 samples returned exact one-note or empty results.
Their internal scans took 7.4 to 17.5 ms. Total acquisition took 365.7 to 491.1
ms because it included pointing, grid settlement, and the bridge.

The retained JSONL transcript contains 50 result rows and 122,023 bytes. The
probe and tables keep the result reproducible without making the transcript a
product artifact.

## Cleanup and verification

The probe restored the exact four baseline track IDs, eight scenes, and zero
occupied launcher slots. It removed its state file and restored the exact entry
`rig.json` bytes. The stable archive was restored after the checks.

Focused cache-policy tests, the complete brain check, extension tests, wire
golden checks, the context check, the live stable handshake, and
`git diff --check` pass.

## Retrospective

Phase-based binding amortizes host settlement cost. Cache-bank construction,
not replay or ping, sets the selected observer bound. Future scale probes must
also confirm that the bridge listener is gone and that every old controller
card is removed before they add a new instance.
