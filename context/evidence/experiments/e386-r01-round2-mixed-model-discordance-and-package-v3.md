---
title: E386 — R01 round 2 mixed-effects model of E385, discordant cases, repeats against instances, and package v3
kind: evidence
state: done
updated: 2026-10-30
owner: R01
---

# E386 — R01 round 2: mixed-effects model, discordant cases and package v3

Date: 2026-10-30. Stage: **development**, round 2. Offline only: no model
call, API billing or Bitwig contact. This record does the three statistics
items of the round 2 [handoff](../../work/r01-round-2-difficulty-scaling.md#next-steps-handoff-2026-10-30)
on [E385](e385-r01-round2-v2-development-pass.md)'s results and builds the
proposed next pass ([R01-D18](../../../spec/r01-research/decisions/r01-d18-round-2-discordant-levels-fresh-instances.md),
awaiting the operator). Nothing here is a rigorous result.

Data: [`analysis-round2-v2-dev-r3.json`](../data/r01-pilot-runs/analysis-round2-v2-dev-r3.json)
(1,368 runs, primary arms only). The model is
[`round2-glmm.py`](../data/r01-pilot-runs/round2-glmm.py) →
[`glmm-round2-v2-dev-r3.json`](../data/r01-pilot-runs/glmm-round2-v2-dev-r3.json);
discordance, repeats, power and level selection are
[`round2-design.py`](../data/r01-pilot-runs/round2-design.py) →
[`design-round2-v2-dev-r3.json`](../data/r01-pilot-runs/design-round2-v2-dev-r3.json).
Both run with `uv run --script` (pinned numpy 2.5.4, scipy 1.18.1,
statsmodels 0.15.0); commands are in each script's header.

## 1. Mixed-effects logistic model

Per cohort, first-attempt pass:

`logit P = cell(family, level) + format [+ format × read] + u(instance) + v(instance × format)`

- **Random effects.** `u` is the (family, level, instance) cluster. `v`
  correlates the repeats of one instance in one format, which is the
  clustering E385's correction found. Without `v`, repeats would again count
  as independent.
- **Two fits.**
  - *Source:* C3 against C4 FIELDS on the five source families. The term
    C4 × read is pre-stated: reads are derived-read, and writes are every
    other source family.
  - *Performed:* all six primary arms on range-edit, preserve-performed and
    selective-delete, with format main effects.
- **Estimation.** Penalized maximum likelihood (posterior mode) with priors
  N(0, 2.5²) on format terms, N(0, 5²) on cell intercepts and Gamma(2, 0) on
  each random-effect SD (as in blme). Integration uses nested 30-node
  Gauss–Hermite quadrature. The penalty keeps all-pass ceiling cells finite.
- **Intervals.** 95% profile intervals; Wald intervals agree within a few
  percent.

**C3 against C4 FIELDS (source families).** Odds ratios above 1 favour C4.

| Cohort | Writes | Reads | Read × C4 interaction | Pooled (no interaction) |
|---|---|---|---|---|
| Haiku 5.5 `low` | **3.2** (1.2–9.3), p = 0.019 | **5.7** (1.7–22), p = 0.004 | 1.8 (0.4–8.8), p = 0.46 | **4.0** (1.9–9.6), p = 0.0004 |
| Luna `high` | **6.0** (2.4–17), p = 0.0002 | 0.52 (0.18–1.5), p = 0.21 | **0.09** (0.02–0.34), p = 0.0006 | 2.1 (1.0–4.9), p = 0.048 |

- **Haiku favours C4 on reads and writes alike;** the interaction is not
  significant.
- **Luna's split is now estimated, not averaged.** C4 is clearly better on
  writes, reads lean C3 without significance, and the difference between
  the two is significant. The pooled Luna estimate mixes opposite effects
  and is not a useful summary.
- **Random-effect SDs** (logit scale): instance 0.38 and 0.75,
  instance × format 0.51 and 0.59 (Haiku, Luna). Repeats of one instance in
  one format are only mildly correlated.

**Performed arms (Wald and profile p agree).**

| Contrast | Haiku OR (95%) | Luna OR (95%) |
|---|---|---|
| Each other arm vs bar\|beat | 7.9–21, every p ≤ 0.0001 | 7.2–47, every p ≤ 0.0004 |
| C4 FIELDS vs C3 FIELDS | 1.8 (0.4–9.0) | 1.5 (0.4–5.0) |
| C4 FIELDS vs baseline JSON | 1.5 (0.3–7.3) | 2.2 (0.7–7.1) |
| C4 FIELDS vs baseline FIELDS | 1.7 (0.4–9.0) | 0.9 (0.3–3.2) |
| C4 FIELDS vs MIDI JSON | 2.7 (0.6–13) | **6.0** (2.0–20), p = 0.002 |

bar|beat's deficit is settled for development purposes. C4 against the
baselines is not, except Luna's C4 over MIDI JSON.

**Checks.** The fit is insensitive to a wider format prior (SD 10) and to 50
quadrature nodes. statsmodels' variational Bayes fit with the same random
effects gives the same directions and similar sizes: C4 log-odds 1.34 vs
1.17 (Haiku writes), 1.85 vs 1.79 (Luna writes), and an interaction of −2.44
vs −2.41 (Luna). Dropping the `v` term narrows the intervals only slightly.

## 2. Discordant difficulty cases

Only pairs in which one format passes and the other fails carry paired
evidence. For each cohort × family × level, E385 gives 12 pairs (4
instances × 3 repeats) per comparison.

| Cohort | Cells with ≥ 4/12 discordant C4/C3 pairs | Ties (≤ 3/12) |
|---|---|---|
| Haiku | reads 8, 16, 32 (5, 7, 5); retime 16, 32 (4, 4; split directions); regroup 12, 16 (8, 7) | reads 4; member-move; preservation; delete; range-edit (C4/C3 2 each) |
| Luna | reads 8, 16, 32 (6, 5, 6); retime 16, 32 (7, 5); member-move 16 (4); regroup 16 (4); range-edit 512 (5) | reads 4; member-move 12 (3); regroup 12; preservation; delete |

- **C4 against the baselines** reaches 4 or more discordant pairs only for
  Luna's range-edit. At 128 notes baseline JSON and FIELDS beat C4 (0/4 and
  1/4 pairs). At 512, C4 beats baseline JSON (9/0) and MIDI JSON (8/0), but
  every 512-note window is from one piano part. For Haiku, it is at most
  3/12 everywhere.
- **bar|beat** is discordant with every arm in almost every performed cell.
  Its comparisons are settled (section 1), so more runs there add little.

## 3. Repeats against instances

**Repeat stability.** Within-instance agreement (all three repeats equal) is
high at the ceiling and low where formats separate. For example, Haiku C3
FIELDS agrees in 7 of 16 read instances and 2 of 8 regroup instances. A
single repeat, compared with its cluster's three-repeat C3/C4 verdict,
gives the same verdict in 275 of 384 cases. It turns a decided cluster into
a tie in 84 cases and a tie into a decision in 22. It reverses a verdict in
only 3 cases (two Haiku, one Luna).

**Power at equal cost** (12 runs per format per cell), simulated 2,000 times
from each cohort's fitted source model:

| Design | Haiku: pooled / reads / writes | Luna: pooled / reads / writes |
|---|---|---|
| 4 instances × 3 repeats (sign test) | 0.86 / 0.57 / 0.40 | 0.29 / 0.12 / 0.90 |
| 4 instances × 3 repeats (sign-flip test) | 0.92 / 0.64 / 0.47 | 0.32 / 0.15 / 0.94 |
| 12 instances × 1 repeat | **0.94 / 0.76 / 0.55** | **0.46 / 0.18 / 0.97** |
| 9 instances, 3 of them twice | 0.94 / 0.74 / 0.54 | 0.41 / 0.18 / 0.97 |

The sign-flip test also uses how many repeats differ, so the 4 × 3 design
is not handicapped by the test. At equal cost, 12 × 1 is at least as
powerful in every comparison. A repeated subset costs a little power and
would mainly re-measure the within-instance variance that E385 already
measured (instance × format SD about 0.5–0.6). Luna's reads stay weakly
powered in any design. Their fitted effect (OR 0.52) is small.

## 4. Package v3 (proposed next pass)

The rule and its outcome are in R01-D18 and in `design-round2-v2-dev-r3.json`
(`nextPass`).

| Cohort | Package | Levels | Instances × repeats | Runs |
|---|---|---|---|---|
| Haiku 5.5 `low` | `round2-development-v3-haiku` | reads 8, 16, 32, **48**; retime 16, 32, **48**; regroup 12, 16, **24** | synthetic 5–16 × 1 | 240 |
| Luna `high` | `round2-development-v3-luna` | reads 8, 16, 32, **48**; retime 16, 32, **48**; regroup 16, **24**; member-move 16, **24**; range-edit 128 | synthetic 5–16 × 1; range-edit 5–8 × 3 | 336 |

Bold levels are new and uncalibrated. All runs use C3 and C4 FIELDS, except
range-edit, which uses the six performed arms. No diagnostics run.

- **Windows v3** ([`v3/windows.json`](../data/r01-round2/v3/windows.json),
  SHA-256 `50e4f10a…`) extends the 128-note selection to eight instances
  under the unchanged rule. Instances 1–4 equal v1's byte for byte. Instances
  5–8 (gapra piano, open spaces cello, trailing piano, gapra piano) share at
  most 16 notes with any earlier window. Instances 9–16 would share 60–101
  notes. At 256 notes only one more window is nearly disjoint, and at 512
  none. Only works 4–6 were read.
- **Packages.** Haiku: 120 tasks, 240 eligible cells, manifest
  `bcc18b85…`. Luna: 136 tasks, 288 eligible cells, manifest `949638e7…`.
  Every task is new: no v3 task shares an ID or an input with packages v1 or
  v2. Timeouts follow R01-D12 (130–760 s).
- **Rehearsal.** All 528 goldens pass. All 4,848 task-specific wrong answers
  and 528 gratuitous refusals are rejected, and no variant fails to
  distinguish.
- **Execution manifests** pin each cohort's full pass in seed
  `r01-round2-order-v3`: Haiku 240 runs (plan `2dfa2f48…`), Luna 336 runs
  (plan `eb93c9bd…`), with Codex context policy v5 recorded for Luna.
- **Code.** The planner accepts optional per-task repeats; without them,
  plans are unchanged. The runner gains selection v3, whose full pass is the
  package's cohort. Round-2 analysis can merge per-cohort packages. A
  regenerated E385 analysis is identical to the retained one. 265 focused
  tests pass.
- **Estimated cost.** Scaling E385's elapsed times gives about 3.7 h for Haiku
  and 5.1 h for Luna, so about 5 hours in parallel. That is about half of
  E385's work, roughly $4–6 at API rates.

## Limits

- Development material and evidence. The model is fitted to the same data
  that suggested it; the next pass is its first fresh test.
- New levels (48 groups, 24 sets or moves) are extrapolations from E385's
  trends.
- Power uses fitted intercepts of E385's cells only; new levels are
  excluded, so the projection is conservative for them.
- Range-edit has only four fresh real instances, and 256 and 512 notes have
  none in works 4–6. Luna's 512-note C4-over-baseline result rests on one
  piano part.
