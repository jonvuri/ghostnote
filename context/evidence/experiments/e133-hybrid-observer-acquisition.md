---
title: E133 — Requested quiet observer acquisition is unsafe
kind: evidence
state: active
updated: 2026-09-24
parent: ../../plan/phase-7/7b-follow-up-hybrid-observer-acquisition.md
---

# E133 — Requested quiet observer acquisition is unsafe [K]

## Verdict

Reject the proposed hybrid fast path. Every candidate rule that could fire
returned five early results in 44 shadow trials for each request pattern. A
requested quiet flush, a 48 ms unchanged confirmation task, and a second
requested quiet flush all accepted the prior observer view during a same-target
repin and grid change.

The experiment stopped after 396 trials because every promotion candidate had
failed. It did not run the 3,000-trial confidence gate, silent fallback matrix,
concurrent-edit matrix, or latency gate. Those gates cannot rescue a rule that
already completed early. The complete dual-grid reader remains authoritative.
The E131 experimental acquisition route and stable profile are unchanged.

## Shadow screen

The probe tested three candidate rules:

- first requested quiet flush after dirty;
- first requested quiet flush plus an unchanged 48 ms confirmation task; and
- second requested quiet flush after dirty.

It tested one request, requests at 0, 24, and 48 ms, and a bounded repeated
request pattern. Each rule and pattern crossed target, grid, page, and combined
view arms at the 11 planned offsets. Each combination ran 44 trials.

| Rule | Request pattern | Eligible | Early | Misses |
|---|---|---:|---:|---:|
| First quiet | One | 44 | 5 | 0 |
| First quiet | 0, 24, 48 ms | 44 | 5 | 0 |
| First quiet | Repeated | 44 | 5 | 0 |
| First quiet plus 48 ms | One | 44 | 5 | 0 |
| First quiet plus 48 ms | 0, 24, 48 ms | 44 | 5 | 0 |
| First quiet plus 48 ms | Repeated | 44 | 5 | 0 |
| Second quiet | One | 0 | 0 | 44 |
| Second quiet | 0, 24, 48 ms | 44 | 5 | 0 |
| Second quiet | Repeated | 44 | 5 | 0 |

The total was 40 early results in 352 eligible trials. The one-request
second-quiet rule had no second requested boundary and missed all 44 trials.

All early results occurred in the same-target repin and grid-change arm on the
dense triplet view. The callback count stayed unchanged across both targeted
all-channel enrichments. The enriched content still differed from the settled
complete reader. The five affected iterations corresponded to the 8, 24, 48,
96, and 144 ms matrix positions. This pattern follows the alternating dense
triplet fixture. It does not establish a safe timing threshold.

## Boundary

The exact target canary was correct. It could not prove grid or page identity.
The local generation, dirty callback, requested quiet event, unchanged callback
count, and repeated enrichment all agreed with each other while the observer
still represented the prior grid. A second requested quiet event added delay
but no missing host identity.

This result rejects the complete candidate family. Do not add a cache or a
hybrid route from this evidence. A future fast path needs an authoritative host
identity or completion signal for grid and page. More quiet observations of
the same local state are not sufficient.

## Cleanup and product state

The live probe used one owned track with two empty clips and four short or long,
sparse or dense clips. It removed the track and all six clips. The launcher
selection helper restored row `0:0`. A follow-up read confirmed the original
four tracks, mixer track 0, all three cursor targets on `Inst 1` row 0 with
their entry pin states, and stopped transport.

The first cleanup assertion compared the complete selection object. Its
monotonic `changes` and `revision` counters had increased, so that assertion
reported a false failure after fixture cleanup. The targeted restoration checks
and follow-up read passed. No test residue remains.

The temporary flush recorder, request method, target canary fields, and shadow
probe were removed. The source method table returned to 157 methods and hash
`905bc2531512025b`. No acquisition or stable-profile code changed.

## Verification

The complete brain check passes 1,176 tests. The extension build, 346-document
context check, generated wire-golden check, whitespace check, and final live
hello pass. The restored live extension reports Controller API 25, 157 methods,
and method hash `905bc2531512025b`.

## Retrospective

Fallback preparation supplied an authoritative comparison and did not weaken
the restored selection. The latency gate did not run after the safety failure.
The screen found a real grid-identity boundary before the full statistical
gate. Keep failure screens small and run them before long confidence matrices.
