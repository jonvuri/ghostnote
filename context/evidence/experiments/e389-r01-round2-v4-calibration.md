---
title: E389 — R01 round 2 calibration of the format-dependent families (package v4)
kind: evidence
state: done
updated: 2026-10-31
owner: R01
---

# E389 — R01 round 2: calibration of the format-dependent families

Date: 2026-10-31, 04:40–05:09 UTC. Stage: **development**, round 2, step 6.2
of the [brief](../../work/r01-round-2-difficulty-scaling.md#next-steps-handoff-2026-10-30-after-e387-format-dependent-families).
The packages are `round2-development-v4-haiku` and `round2-development-v4-luna`
([E388](e388-r01-round2-format-dependent-families-offline.md)), run as
[R01-D20](../../../spec/r01-research/decisions/r01-d20-round-2-format-dependent-family-designs-and-calibration.md)
specifies. The operator approved the run ("These choices are fine with me.
Proceed with the calibration run."). Both runs were pinned full passes:
CLIs Claude Code 2.1.302 and codex-cli 0.163.0, one instance per level, one
repeat. Subscription CLIs only; no API billing or Bitwig contact.

| Cohort | Run | Runs | First attempt | Within budget | Submissions | Stalls | Duration |
|---|---|---|---|---|---|---|---|
| Haiku 5.5 `low` | [`round2-v4-cal-haiku/`](../data/r01-pilot-runs/round2-v4-cal-haiku/) | 32/32 | 30 | 32 | 34 | 0 | 19 min |
| Luna `high` | [`round2-v4-cal-luna/`](../data/r01-pilot-runs/round2-v4-cal-luna/) | 32/32 | 12 | 24 | 63 | 0 | 29 min |

No control failure, halt or stall occurred. Measures:
[`analysis-round2-v4-calibration.json`](../data/r01-pilot-runs/analysis-round2-v4-calibration.json),
which regenerates from the retained plans and results. Raw attempt
directories stay outside the evidence in `.tmp/r01-v4-cal-*-attempts`, as
for E387.

## Results by family (first attempt / within budget, out of 8: 4 levels × 2 formats)

| Family | Haiku | Luna | Luna median generated / reasoning tokens |
|---|---|---|---|
| query-edit (4–32 groups) | 7 / 8 | 3 / 4 | 3,489 / 1,004 |
| overlap-edit (2–8 memberships) | 7 / 8 | 3 / 8 | 2,086 / 460 |
| large-edit (64–384 notes) | 8 / 8 | 6 / 7 | 10,367 / 368 |
| interp-maintain (2–12 edits) | 8 / 8 | 0 / 5 | 3,378 / 933 |

Luna, per cell (first-attempt result; `·` pass, `v` validator-caught failure, `x` silent wrong state):

| Family | Level 1 | Level 2 | Level 3 | Level 4 |
|---|---|---|---|---|
| query (4, 8, 16, 32) | C3 · C4 x | C3 v C4 · | C3 x C4 · | C3 v C4 x |
| overlap (2, 4, 6, 8) | C3 · C4 v | C3 v C4 · | C3 · C4 v | C3 v C4 v |
| large (64, 128, 256, 384) | C3 · C4 x | C3 · C4 · | C3 v C4 · | C3 · C4 · |
| interp (2, 4, 8, 12) | C3 x C4 x | C3 x C4 x | C3 x C4 x | C3 v C4 x |

- **Haiku is at the ceiling.** It passed all 16 C3 cells and 14 of 16 C4
  cells. Its two misses were both C4: a presentation order left stale after
  the overlap removal (validator-caught), and two notes wrongly transposed at
  query level 8. Both were fixed by one correction. Pairs: 14 both-pass, 2
  C3-only, none C4-only or both-fail. At these levels the families do not
  challenge Haiku, although it generates far more reasoning than before
  (medians 2.6k–6.4k tokens).
- **Luna sits near 50%, with discordance and no level trend.** First
  attempts: C3 6/16, C4 6/16. Pairs: 2 both-pass, 4 C3-only, 4 C4-only, 6
  both-fail. With one instance per level, no family shows a monotone level
  effect, so these levels are noisy rather than easy or hard.
- **Error visibility differs by format.** 6 of Luna's 10 C3 first-attempt
  failures were validator-caught, against 3 of 10 for C4. C3's redundant
  timing (CONTEXT spread maps plus explicit onsets) catches inconsistent
  edits as timing-equation mismatches. C4's failures are mostly silent wrong
  states (wrong selection or lifecycle), except for stale order lists.
- **The failures are the designed traps.**
  - *Interpretation:* Luna writes an explicit provenance into mapped nominal
    entries that should inherit it, or stales the wrong entry. This happens
    in both formats; Haiku passed every interpretation cell, so it is a
    model failure, not a prompt defect.
  - *Overlap, C3:* a member referenced but not owned by the retimed group
    (`w1b`) ends up off its owner's equation.
  - *Overlap, C4:* order lists are not updated on removal.
  - *Query, 32 groups:* C4 selects the wrong groups; C3 breaks its timing
    equations.
- **Large-edit fits the output budget.** The largest C3 answer (384 notes)
  took 99 s for Luna; no answer was truncated.

No prompt, oracle or scorer defect was found.

## Implications for the development pass (step 6.3)

- **Luna.** All four families produce discordant or failing cells. A
  fresh-instance pass can estimate the C3/C4 effect per family; single
  calibration instances cannot choose levels finely.
- **Haiku.** The proposed ladders saturate it. Before a development pass, it
  needs harder levels: for example query 64+, overlap 12–16 memberships,
  interp 16–24 edits, with large-edit limited by output size. The
  alternative is to treat Haiku as saturated on these families. R01-D19
  reserves a stronger cohort for the case where both cohorts saturate, which
  this is not.

## Limits

- Development evidence; one instance and one repeat per cell, so each cell is
  one binary outcome.
- Levels are shared and uncalibrated; per-family counts mix four levels.
- Usage is client-reported; Codex HTTP totals remain unknown (E363).
