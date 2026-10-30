# R01-D18 — Round 2: discordant levels, fresh instances over repeats, and the analysis model

Date: 2026-10-30. Status: **accepted by the operator** ("I approve the
development pass - go ahead and kick it off now."). Package v3 is built and
rehearsed offline ([E386](../../../context/evidence/experiments/e386-r01-round2-mixed-model-discordance-and-package-v3.md)).

## Context

The operator chose to strengthen the statistics of round 2 before step 6,
keeping Haiku 5.5 `low` and Luna `high`
([handoff](../../../context/work/r01-round-2-difficulty-scaling.md#next-steps-handoff-2026-10-30)).
E386 fits a mixed-effects model to [E385](../../../context/evidence/experiments/e385-r01-round2-v2-development-pass.md),
counts discordant pairs and compares repeats with instances.

## Decision

**Analysis model.** Each cohort's primary analysis is fitted separately,
with this pre-stated model:

```
logit P(first-attempt pass) = cell(family, level) + format [+ format × read]
                              + u(family, level, instance) + v(instance × format)
```

- **Fits.**
  - *Source:* C3 against C4 FIELDS on the source families. C4 × read is a
    pre-stated term; reads are derived-read, and writes are every other
    source family. Report C4's odds ratio for writes and for reads, and the
    interaction.
  - *Performed:* all six primary arms, with baseline JSON as the reference.
    Report every arm against bar|beat, and C4 FIELDS against C3 FIELDS and
    each baseline.
- **Estimation.** Penalized maximum likelihood with priors N(0, 2.5²) on
  format terms, N(0, 5²) on cell intercepts and Gamma(2, 0) on each
  random-effect SD. Use nested Gauss–Hermite quadrature and report odds
  ratios with 95% profile intervals.
- **Implementation:** [`round2-glmm.py`](../../../context/evidence/data/r01-pilot-runs/round2-glmm.py).
  Cluster sign tests are reported beside the model.
- **Rigorous round.** This model is the candidate for pre-registration. The
  development pass below is its first fresh test.

**Levels.** A cohort × family × level is kept when E385 shows at least 4 of
12 discordant pairs in an open planned comparison: C4 against C3 FIELDS, or
C4 FIELDS against a baseline. bar|beat's comparisons are settled (model
p < 0.001 in both cohorts) and no longer select levels. For a kept family,
one level 1.5× above its top level is added where some arm still passes more
than half at the top.

| Cohort | Levels |
|---|---|
| Haiku 5.5 `low` | derived-read 8, 16, 32, 48; group-retime 16, 32, 48; regroup 12, 16, 24 |
| Luna `high` | derived-read 8, 16, 32, 48; group-retime 16, 32, 48; regroup 16, 24; member-move 16, 24; range-edit 128 |

Dropped: derived-read 4, member-move for Haiku, member-move 12 and regroup
12 for Luna, preservation, selective-delete and Haiku's performed families
(all ties in E385). Their E385 results stand.

**Instances over repeats.** At equal cost, 12 instances × 1 repeat is at
least as powerful as 4 × 3 for every comparison (E386). So:

- Synthetic families run 12 fresh instances (5–16) × 1 repeat.
- Range-edit runs at 128 notes only, on the four fresh windows (5–8) × 3
  repeats. Works 4–6 hold no other low-overlap windows: the next 128-note
  instances would share 60–101 notes, one 256-note window is nearly
  disjoint, and there are no 512-note windows. Where material is exhausted,
  repeats are the remaining source of precision.
- No repeated stability subset; E385 already measured within-instance
  variance.
- No source diagnostics.

**Packaging.** One package per cohort (`round2-development-v3-haiku`,
`round2-development-v3-luna`), selection v3 (seed `r01-round2-order-v3`).
Each package's full pass is that cohort with per-task repeats from the
package. That is 240 and 336 runs, and the two cohorts run as parallel
processes. Luna is audited under Codex context policy v5 (R01-D16). The
R01-D16 and R01-D17 continuations apply.

## Consequences

- New levels are uncalibrated; a level at the floor or ceiling is reported
  as such, not rerun.
- Questions needing larger performed windows (Luna's C4 against baselines
  at 512 notes) wait for other material: the rigorous round's works 1–3, or
  a merged-track or synthetic window rule.
- Development results never count toward rigorous results.
