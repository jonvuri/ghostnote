---
title: E391 — R01 round 2 development pass of the format-dependent families (package v6)
kind: evidence
state: done
updated: 2026-10-31
owner: R01
---

# E391 — R01 round 2: development pass of the format-dependent families

Date: 2026-10-31, 06:04–12:29 UTC. Stage: **development**, round 2, step 6.3.
Packages `round2-development-v6-haiku` and `round2-development-v6-luna`
([R01-D21](../../../spec/r01-research/decisions/r01-d21-round-2-haiku-recalibration-and-shared-development-ladder.md)).
The operator delegated the levels and asked for the full pass. The two
packages share one task set: 144 tasks × C3 and C4 FIELDS, 288 runs each.
- **Ladder:** query 8, 16, 64, 96 groups; overlap 4, 6, 24 memberships;
  large-edit 128, 256 notes; interp 2, 4, 32 edits.
- **Instances:** fresh instances 2–13, one repeat.
- **Setup:** Claude Code 2.1.302 and codex-cli 0.163.0, run in parallel on
  subscription CLIs only.

**Offline build.** Both packages pass all 288 goldens and reject all 2,736
wrong answers, with no variant that fails to distinguish. Prompts are
byte-identical between models, and no input repeats a calibration input.
273 focused tests pass.

| Model | Run | Runs | First attempt (C3 / C4) | Within budget (C3 / C4) | Submissions | Stalls | Duration |
|---|---|---|---|---|---|---|---|
| Haiku 5.5 `low` | [`round2-v6-dev-haiku/`](../data/r01-pilot-runs/round2-v6-dev-haiku/) | 288/288 | 263 (131 / 132) | 287 (143 / 144) | 316 | 0 | 5 h 23 min |
| Luna `high` | [`round2-v6-dev-luna/`](../data/r01-pilot-runs/round2-v6-dev-luna/) | 288/288 | 94 (39 / 55) | 178 (75 / 103) | 607 | 0 | 6 h 25 min |

No control failure, halt or stall occurred.
- **Measures:** [`analysis-round2-v6-dev.json`](../data/r01-pilot-runs/analysis-round2-v6-dev.json).
- **Model:** [`round2-glmm-families.py`](../data/r01-pilot-runs/round2-glmm-families.py)
  → [`glmm-round2-v6-dev.json`](../data/r01-pilot-runs/glmm-round2-v6-dev.json).
  It reuses the E386 estimator (penalized ML, profile intervals). The
  instance × format term is pinned without repeats (E387), and there is one
  C4 term per family.
- **Raw attempts:** kept outside the evidence in `.tmp/r01-v6-dev-*-attempts`.

## C4 against C3 FIELDS (first attempt)

Odds ratios above 1 favour C4; intervals are 95% profile intervals. Sign
tests are exact and two-sided, on discordant pairs.

| Family | Haiku OR (95%) | Haiku C3-only / C4-only | Luna OR (95%) | Luna C3-only / C4-only |
|---|---|---|---|---|
| **All families** | 1.28 (0.54–3.1), p = 0.58 | 11 / 12, p = 1 | **1.98 (1.10–3.7), p = 0.023** | 15 / 31, p = 0.026 |
| query-edit | 1.54 (0.56–4.4), p = 0.40 | 8 / 11 | **5.9 (1.6–25), p = 0.007** | 2 / 11, p = 0.022 |
| overlap-edit | 1.34 (0.14–17) | 1 / 1 | 1.00 (0.37–2.7) | 8 / 8 |
| large-edit | ceiling (all pass) | 0 / 0 | **9.0 (2.1–49), p = 0.002** | 0 / 9, p = 0.004 |
| interp-maintain | 0.35 (0.03–3.5), p = 0.37 | 2 / 0 | 0.67 (0.20–2.2), p = 0.51 | 5 / 3 |

Per level, first-attempt passes out of 12 (C3 / C4):

| Family | Level | Haiku | Luna |
|---|---|---|---|
| query-edit | 8 | 11 / 11 | 2 / 7 |
| | 16 | 11 / 11 | 1 / 5 |
| | 64 | 8 / 8 | 0 / 0 |
| | 96 | 6 / 9 | 0 / 0 |
| overlap-edit | 4 | 11 / 12 | 8 / 6 |
| | 6 | 12 / 11 | 7 / 7 |
| | 24 | 12 / 12 | 3 / 5 |
| large-edit | 128 | 12 / 12 | 3 / 8 |
| | 256 | 12 / 12 | 0 / 4 |
| interp-maintain | 2 | 12 / 11 | 8 / 7 |
| | 4 | 12 / 12 | 7 / 6 |
| | 32 | 12 / 11 | 0 / 0 |

## Findings

- **Luna: C4 is better overall,** concentrated in two families.
  - *Query-selected edits:* C4 is better (OR 5.9) even though C4 must derive
    onsets to select notes. C3 can read onsets directly but must then rewrite
    every moved member's explicit onset consistently, and it fails there.
    This repeats E385–E387's C4 write advantage for Luna.
  - *Edits inside a large document:* C4 wins at both sizes, 9 C4-only pairs
    against 0. C3 never passed at 256 notes.
  - *No difference:* overlapping memberships (8 / 8).
  - *Leans C3 without significance:* interpretation maintenance.
- **Haiku: no accuracy difference.** It passes 263/288, and its discordant
  pairs split 11 / 12. Only query-edit at 64–96 groups bends it, where C4 leads
  at 96 (9 against 6 of 12; pairs 2 / 5). The families still saturate Haiku
  everywhere else, even at overlap 24 and interp 32.
- **Haiku: C4 is cheaper at the ceiling.** On pairs where both formats pass,
  C4's median share of C3's generated tokens is: query 0.63, overlap 0.64,
  large-edit 0.75, interp 0.92. Reasoning tokens show the same pattern (0.51–0.61,
  and 0.89 for interp). Elapsed time follows, for example query 96 at 219 s
  in C3 against 113 s in C4. This is the clearest format effect for the
  stronger model: the same correct answer for about two-thirds of the
  generation.
- **Luna abandons long C3 answers.** At query 64–96, 17 of 24 C3 first
  answers were not attempts: empty, a statement that it cannot produce the
  complete surface, `REFUSE`, or a bare header. C4 had 3 of 24. Haiku and
  every other Luna cell had none. These count as parse errors, so they
  inflate C3's validator-caught share. Neither format passed there for Luna;
  the abandonment is a size effect that reaches C3 first, since C3 answers
  are about 1.5× larger.
- **Error visibility.** Validator-caught first-attempt failures:
  - *Haiku:* C3 8 of 13, C4 1 of 12.
  - *Luna:* C3 88 of 105, C4 45 of 89. C3 still catches more of its own
    failures without the non-attempts (72 of 88 against 42 of 86).

  C3's redundant timing turns inconsistent edits into visible errors. C4's
  failures are more often silent wrong states.
- **Corrections.** Within budget, Haiku reaches 287/288. Luna reaches C3
  75/144 and C4 103/144, so Luna's C4 lead survives feedback, as in E387.

## What this answers (R01-D19)

The format-dependent families separate the formats for Luna, and they do so
in C4's favour where structure and size matter (query edits, large
documents). For Haiku they separate the formats by cost, not accuracy. No
family favours C3 significantly for either model. Interpretation maintenance
and overlapping memberships show no format difference at these sample sizes.

## Limits

- Development evidence: 12 instances × 1 repeat per level, synthetic
  material only.
- Each model's ladder includes levels chosen for the other. Haiku's levels at
  Luna's floor (query 64–96, interp 32) add no paired information for Luna,
  and the reverse holds for Haiku.
- Haiku's large-edit and overlap results are at the ceiling, so their odds
  ratios are prior-dominated.
- Token counts are client-reported. Codex HTTP totals remain unknown (E363).
