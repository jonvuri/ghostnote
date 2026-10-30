# R01-D15 — Round 2: trimmed development pass of package v2

Date: 2026-10-29. Status: **accepted by the operator** ("I agree. Let's
proceed with option 2 for now."), choosing option 2 of
[E384](../../../context/evidence/experiments/e384-r01-round2-v2-calibration.md).

## Decision

The development pass of `round2-development-v2` (Haiku 5.5 `low`, Luna
`high`, [R01-D14](r01-d14-round-2-two-cohorts-harder-ladder.md)) runs a task
subset. Every selected task gets four instances and three repeats (R01-D11),
in the pinned seeded order (`r01-round2-order-v2`).

| Family | Levels run | Role |
|---|---|---|
| range-edit | 128, 256, 512 | breaking point |
| derived-read | 4, 8, 16, 32 (diagnostics at 8) | breaking point |
| group-retime | 16, 32 | cost at the ceiling |
| regroup, member-move | 12, 16 | cost at the ceiling |
| selective-delete | 24 | cost at the ceiling |
| preserve-performed, preserve-exact | 512 (exact: diagnostics included) | cost at the ceiling |

That is 64 tasks: 684 initial runs per cohort, 1,368 in total and at most
4,104 submissions. The runner records it as a subset; each run's prompt is
checked against the pinned execution manifest.

## Rationale

E384 found breaking points only on range-edit and derived reads. The other
families stay at the ceiling for both cohorts at four times v1's sizes, so
their lower levels add cost without information. Their top levels still give
pass³, generated tokens and output size per format.

## Consequences

- Redesigning the group families (format-relevant axes such as large
  surrounding state, overlapping memberships, or edits selected by derived
  queries) is deferred to a later small calibration.
- The levels left out of this pass are not run at three repeats.
