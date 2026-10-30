---
title: E383 — R01 round 2 Luna at high effort on calibration floor tasks
kind: evidence
state: done
updated: 2026-10-28
owner: R01
---

# E383 — R01 round 2 Luna at high effort on calibration floor tasks

Date: 2026-10-29 03:52–03:58 UTC. Stage: **development**, round 2. This was an
operator-requested bounded probe after
[E382](e382-r01-round2-calibration-pass.md): Luna at `high` on floor tasks
it failed at `medium`. Subscription Codex only; no API billing or Bitwig
contact. It is a probe, not a cohort change.

## Setup

- Profile `codex-current-high` (`gpt-6-luna`, `high`, Codex 0.163.0). Policy
  v4 audits `reasoning.effort` against the profile. The runner admits the
  profile only in subsets (`ROUND2_PROBE_COHORTS`), and the pinned full-pass
  plan is unchanged.
- Six tasks, chosen from the lowest rungs of the families where Luna was at
  or near its floor: read at 1 and 2 groups, regroup at 1 and 2, range-edit
  at 64 notes and delete with one near miss. Package
  `round2-development-v1`, one repeat, instance 1. These are the same cells
  E382 ran at `medium`, so every cell is paired.
- 26 runs (20 primary, 6 diagnostic) in 28 submissions. There was no control
  failure, stall or quota pause. Plan, results and session are in
  [`round2-luna-high-r1/`](../data/r01-pilot-runs/round2-luna-high-r1/).

## Results (paired with E382's `medium` runs)

| | `medium` (E382) | `high` |
|---|---|---|
| First attempt | 5/26 | **24/26** |
| Within budget | 10/26 | **26/26** |
| Submissions | 65 | 28 |
| First attempts reporting zero reasoning | 19/26 | 0/26 |
| Median first-attempt generated / reasoning tokens | 686 / 0 | 1,207 / 271 |
| Output tokens over all submissions | 69,221 | 42,782 |
| Median first-attempt elapsed | 7.9 s | 10.0 s |

- Every family rises: read 7/7 (medium 1/7), regroup 6/7 (3/7), range-edit
  5/6 (0/6) and delete 6/6 (1/6). Both C3 and C4 FIELDS pass every source
  task at `high`. The two first-attempt misses are range-edit bar|beat and
  the detached-layout regroup diagnostic; corrections recovered both.
- The C3 delete gratuitous refusal and the instant read answers at `medium`
  (8–32 generated tokens, about 3 s) are gone. Each `high` first attempt
  reasoned for 62 to 1,077 tokens.
- `High` used **fewer** output tokens overall, because it needed few
  corrections.

## Interpretation

Luna's floor at `medium` is mostly a **no-reasoning mode**, not a capability
limit. In E382, 84 of Luna's 112 first attempts reported zero reasoning
tokens; they passed 33/84, against 16/28 for those with reasoning. At `high`,
Luna reasons on every submission and clears these first rungs almost
completely. Luna `medium` therefore separates formats partly through whether
it chooses to reason. Its C3/C4 split (E379, E382) may reflect that as well
as the formats.

## Limits

Six tasks, first rungs only, one instance and one repeat. Higher rungs at
`high`, and whether C3/C4 separation survives there, are untested. The
reasoning counts are client-reported.
