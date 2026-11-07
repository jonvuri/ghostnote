# R01-D14 — Round 2: Haiku 5.5 low and Luna high on a harder shared ladder

Date: 2026-10-29. Status: **accepted by the operator.** They proposed it
after [E382](../../../context/evidence/experiments/e382-r01-round2-calibration-pass.md)
and [E383](../../../context/evidence/experiments/e383-r01-round2-luna-high-effort-floor-probe.md):
"raising the ladder and then going to haiku 5.5 and luna high now seems like
a plausible and cost effective option … calibrate a more difficult ladder to
prepare for a full development run of those two."

## Decision

- **Cohorts.** Round 2's development pass uses Haiku 5.5 at `low`
  (`claude-current`) and Luna at `high` (`codex-current-high`). Luna `high`
  replaces `medium`; Haiku 4.5 and `gpt-5.6-terra` leave the development
  pass, and their admissions remain on record. This resolves R01-D9's Terra
  rule by not using Terra and supersedes R01-D10's development inclusion.
- **Cost.** At API rates, Haiku 5.5 costs a tenth of Haiku 4.5 per token, and
  Luna matches Haiku 5.5. On the paired probe, Luna `high` used fewer output
  tokens overall than `medium`, because it needed fewer corrections.
- **One shared ladder** (package `round2-development-v2`, `LADDERS_V2`),
  starting near the top of v1:

  | Family | v2 levels |
  |---|---|
  | derived-read, group-retime | 4, 8, 16, 32 groups |
  | regroup | 4, 8, 12, 16 groups |
  | member-move | 4, 8, 12, 16 moves |
  | range-edit | 128, 256, 512 notes |
  | selective-delete | 6, 12, 24 near misses |
  | preservation (both series) | 512 notes only, as a cost measure |

  Generators, windows, prompts, cards, scoring, feedback and the timeout rule
  are unchanged. Group and note IDs beyond v1's range follow a
  `prefix + index` rule. Near misses beyond six alternate after T and before
  F at seeded, distinct distances under one quarter.
- **Order seed** `r01-round2-order-v2`. A v2 calibration pass (instance 1,
  one repeat) precedes the full pass (four instances, three repeats).

## Consequences

- R01-D11's per-cohort ladders are not used, so both cohorts' results lie on
  one scale.
- Package v1, its execution manifest and its calibration results are
  unchanged and are not pooled with v2.
- Cross-provider results are reported side by side, not ranked (R01-D7's
  rule carries over).
