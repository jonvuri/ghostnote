# Grouped-format development run

The progression-repair calibration passed on all three providers. This
development run tests the unchanged `grouped-label-compact` candidate against
four baselines and controls. It uses fresh development fixtures. Its reserved
holdout fixtures stay unused.

The new wrapper replaces the unused development and holdout progression tasks
with triad-only tasks. Their prompts require each listed pitch class at least
once. It also corrects the strong-beat pitch classes in the unused melody
regression tasks. The old fractional grids did not agree with that scorer
check.

## Offline checks

Run these commands from `brain`:

```sh
python3 benchmarks/compact-format-v3/development.py --self-test
python3 benchmarks/compact-format-v3/development.py \
  --check benchmarks/compact-format-v3/expected-development-deterministic.json
```

The checks cover 44 fixtures in each fresh cohort, all five representations,
reference answers, explicit progression coverage, cohort separation, sample
resolution, both aggregation branches, and the pending approval gate.

## Frozen scope

The run ID is `phase8c2-2-grouped-development-r1`. It uses five arms and eight
families. Each provider gets 220 calls, for 660 calls in total. The decision
families each have eight fixtures. The regression and guard families each
have four fixtures.

The exact plan is in `runs/development-r1-plan.json`. The approval record is
pending in `runs/development-r1-approval.json`. Do not make provider calls
until the operator explicitly approves this exact run.

The summary returns `freeze-holdout` only when every frozen gate passes. It
otherwise returns `stop-custom-compact`. A holdout run always needs a new plan
and a new approval.

## Conditional stop

The operator approved OpenAI and Gemini first, with Claude conditional on no
new issue. Both cheaper providers completed, but all eight grouped melody
responses exposed an omitted single-note row template in the prompt. The
decision-critical macro also trailed compact-bar v1 on both providers. This
makes the two-provider improvement gate unreachable with only Claude left.

`runs/2026-09-27-development-partial-report.json` records the integrity-checked
`stop-before-claude` result. The approval record is closed. Do not run Claude
or resume this frozen run.
