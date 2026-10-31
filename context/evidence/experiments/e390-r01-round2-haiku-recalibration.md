---
title: E390 — R01 round 2 Haiku recalibration of the format-dependent families (package v5)
kind: evidence
state: done
updated: 2026-10-31
owner: R01
---

# E390 — R01 round 2: Haiku recalibration at higher levels

Date: 2026-10-31, about 05:33–06:03 UTC. Stage: **development**, round 2.
Package `round2-development-v5-haiku`
([R01-D21](../../../spec/r01-research/decisions/r01-d21-round-2-haiku-recalibration-and-shared-development-ladder.md)).
The operator delegated the level choice ("make a call on your own of which
levels to support for Haiku"); the rule was fixed in R01-D21 before the run.
Haiku 5.5 `low` on Claude Code 2.1.302; one instance per level, one repeat,
C3 and C4 FIELDS. Subscription CLI only.

- **Offline.** 9 tasks and 18 cells. All goldens pass, all 168 wrong answers
  are rejected, and no variant fails to distinguish. Interp-maintain now uses
  max(3, ceil(E/6) + 1) loose notes, so 32 edits fit; v4 regenerates
  unchanged.
- **Run** ([`round2-v5-cal-haiku/`](../data/r01-pilot-runs/round2-v5-cal-haiku/)):
  18/18 complete, with no halt or stall. Measures:
  [`analysis-round2-v5-haiku-calibration.json`](../data/r01-pilot-runs/analysis-round2-v5-haiku-calibration.json).

| Family | Level | C3 first / median generated | C4 first / median generated |
|---|---|---|---|
| query-edit | 48 groups | pass / 34,014 | pass / 19,444 |
| | 64 | **fail** (timing equation; one correction) / 46,494 | pass / 31,406 |
| | 96 | pass / 71,975 | pass / 39,899 |
| overlap-edit | 12 memberships | pass / 9,699 | pass / 5,978 |
| | 16 | pass / 12,450 | pass / 7,188 |
| | 24 | pass / 11,808 | pass / 7,764 |
| interp-maintain | 16 edits | pass / 20,709 | pass / 16,938 |
| | 24 | pass / 30,955 | pass / 31,066 |
| | 32 | pass / 40,168 | pass / 37,426 |

## Findings

- **Haiku stays near the ceiling** at 2–3× the v4 top levels. It passed 17/18
  on the first attempt and 18/18 within budget. Its only miss was C3 at query
  level 64, where one member's explicit onset disagreed with its group
  equation (`q42a`). The validator caught it.
- **The cost at the ceiling separates the formats.** For the same correct
  result, C4 needs 55–68% of C3's generated tokens on query-edit and 58–66%
  on overlap-edit. Interp is close to even (82–100%). Reasoning dominates the
  difference: at query 96 Haiku reasoned for 45,586 tokens in C3 against
  20,609 in C4. Elapsed time follows, for example 231 s against 130 s.
- **Rule outcome (R01-D21).**
  - *Query:* the break is at 64, so Haiku's levels are 64 and 96.
  - *Overlap and interp:* no break; both are saturated, with levels 24 and
    32.
  - *Shared development ladder (v6):* query 8, 16, 64, 96; overlap 4, 6, 24;
    large-edit 128, 256; interp 2, 4, 32. Both models run it on instances
    2–13.

## Limits

- One instance per cell. A single failure at query 64 sets the break; a
  repeat could have passed.
- Generated-token counts are client-reported, from one run each.
- Haiku's large-edit is not probed above 384 notes (output cap, R01-D20).
