# Compact-format v7 Haiku substitution

This package implements the Phase 8c4b Haiku provider substitution. It keeps
the frozen compact-format v6 easy cohort and Gemini result. It changes only the
Anthropic model from Sonnet 5 to Haiku 4.5.

No Gemini, OpenAI, or Sonnet call is part of this run.

## Result

Calibration r4 returns `repair-measurement`. Haiku scored only two of five
unique initial tasks, and neither passed. Three tasks reached the 5,000-token
output limit without an answer. The retained Gemini result remains eligible
at 3/5, but the incomplete Haiku result does not pass the two-provider gate.

The run made eight Haiku calls and cost USD 0.148805. No other provider ran.
See the [report](runs/2026-09-28-analysis-report.md) and
[summary](runs/2026-09-28-analysis-summary.json).

## Reason for the substitution

OpenAI uses GPT-5.4 Mini, and Gemini uses Gemini 3.8 Flash. Both are
cost-efficient model tiers. Sonnet 5 is a higher-capability and higher-cost
tier. Its 5/5 result did not resolve the measurement.

Haiku 4.5 is Anthropic's cost-efficient tier. This run tests whether the
repaired analysis measurement is informative for Gemini and Haiku without
changing a prompt, fixture, scorer, or eligibility boundary.

## Frozen dependency

The package reuses the exact `calibration-easy` corpus from v6. Haiku has not
received this cohort. Reuse is intentional because it gives a direct matched
comparison with the retained Gemini result.

The dependency manifest verifies:

- the v6 core, cohort manifest, and deterministic manifest;
- the retained Gemini provider manifest and raw-run hash;
- the exact prompt hash for every unique task and sentinel;
- the 3/5 retained Gemini gate; and
- every generated analysis formula.

Do not rerun Gemini or Sonnet. Do not change v6.

## Haiku request

The model is `claude-haiku-4-5-20251001`. Haiku does not use Sonnet's adaptive
`effort` control. The request uses manual extended thinking with the minimum
supported budget of 1,024 tokens. The total output limit is 5,000 tokens.
Temperature stays at the provider default.

The run has five unique initial tasks and one named repeated-prompt sentinel.
Each available initial failure can receive one repair call. The maximum is 12
Haiku calls.

## Decision

Retain Gemini's complete 3/5 result. Return `analysis-repair-pass` only when
all five unique Haiku initial results are scored and Haiku passes 1 through 4.
Return `repair-measurement` for a floor, ceiling, or incomplete result.

The result cannot select a format. A pass restores only the analysis entry
condition beside the retained r2 motif and progression results.

## Offline checks

Run these commands from `brain`:

```sh
python3 -B benchmarks/compact-format-v7/benchmark.py --self-test
python3 -B benchmarks/compact-format-v7/benchmark.py \
  --check benchmarks/compact-format-v7/expected-deterministic.json
```

## Approval and stop boundary

The run ID is `phase8c4b-analysis-haiku-calibration-r4`. The maximum is 12
Haiku calls and USD 0.188385. The plan authorizes zero Gemini, OpenAI, or
Sonnet calls.

The exact r4 run is complete. Do not rerun it. Any further provider work needs
a new package, cohort, protocol, run plan, and approval.

R4 exposed a cost-control defect. Its observed-call estimate did not cover the
case where Haiku used the full output limit in reported thinking. Actual spend
stayed below approval, but a future harness must use a token-bound estimate and
enforce accumulated cost before each conditional call.
