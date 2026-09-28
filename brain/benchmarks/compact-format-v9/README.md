# Compact-format v9 OpenAI analysis supplement

This package checks whether OpenAI also enters the repaired analysis
eligibility band. It uses the exact r5 fixtures and measurement code.

## Result

R6 returns `add-openai-third-provider`. OpenAI scored all five unique initial
tasks and passed one. Its 0.20 rate is the inclusive lower eligibility
boundary.

The run made 11 requests and cost USD 0.047251. No response reached the output
limit, and no request retried. See the
[report](runs/2026-09-28-analysis-report.md) and
[summary](runs/2026-09-28-analysis-summary.json).

## Reuse

OpenAI has not seen the r5 cohort. The package reuses these r5 elements:

- five unique exact-object analysis tasks;
- one named repeated-prompt sentinel;
- prompt and repair builders;
- musical scorer and component checks;
- initial-only primary gate; and
- the inclusive 0.20 through 0.80 eligibility band.

OpenAI and Haiku therefore use identical fixtures. Gemini retains its eligible
3/5 result from the matched-difficulty r3 cohort. R6 is supplemental. It does
not change the completed Phase 8c4b decision.

## OpenAI settings

The run uses `gpt-5.4-mini-2026-03-17`, low reasoning, strict structured
output, provider-default temperature, and a 12,000-token completion limit.
The [official OpenAI model page](https://developers.openai.com/api/docs/models/gpt-5.4-mini)
confirms the snapshot, Chat Completions endpoint, structured output support,
reasoning settings, and token prices.

## Cost guard

Each request must fit below 9,000 serialized bytes. The harness reserves 10,000
input tokens and 12,000 output tokens before the request. This gives a maximum
reservation of USD 0.061500 per request.

The run can make six initial requests and at most six repair requests. The
hard limits are 12 OpenAI requests and USD 0.738000. The harness makes no
automatic request retry.

## Decision

Add OpenAI as a third eligible analysis provider only when all five unique
initial results are scored and OpenAI passes one through four. Otherwise,
retain the completed Gemini and Haiku calibration result.

Calibration still cannot select a format. Phase 8c4c needs a separate fresh
development corpus, run plan, and provider approval.

## Offline checks

Run these commands from `brain`:

```sh
python3 -B benchmarks/compact-format-v9/benchmark.py --self-test
python3 -B benchmarks/compact-format-v9/benchmark.py \
  --check benchmarks/compact-format-v9/expected-deterministic.json
```

## Approval and stop boundary

The run ID is `phase8c4b-analysis-openai-supplement-r6`. The maximum is 12
OpenAI requests and USD 0.738000. The plan authorizes no Gemini, Haiku, or
Sonnet call.

The exact r6 run is complete. Do not rerun it. No further Phase 8c4b provider
request is approved.

Gemini, Haiku, and OpenAI are eligible on the repaired analysis measurement.
Phase 8c4c can resume offline preparation but needs separate provider approval.
