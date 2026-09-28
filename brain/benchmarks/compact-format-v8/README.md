# Compact-format v8 Haiku output-limit repair

This package implements the Phase 8c4b Haiku output-limit repair. It increases
the total output limit from 5,000 to 12,000 tokens. It keeps the manual
thinking target at 1,024 tokens.

The package uses a fresh Haiku cohort. It retains Gemini's complete and
eligible r3 result. It makes no Gemini, OpenAI, or Sonnet call.

## Result

Calibration r5 returns `analysis-repair-pass`. Haiku scored all five unique
initial tasks and passed one. The 0.20 rate is the inclusive lower eligibility
boundary. The retained Gemini result remains eligible at 3/5.

No response reached the 12,000-token limit. The run made 10 Haiku message
requests and 10 free token-count requests. It cost USD 0.158130. See the
[report](runs/2026-09-28-analysis-report.md) and
[summary](runs/2026-09-28-analysis-summary.json).

## Reason for the repair

Haiku r4 scored only two of five unique tasks. Three calls reached the
5,000-token output limit entirely in reported thinking and returned no answer.
The same prompt also passed as the named sentinel. R4 therefore measured an
incomplete and unstable response process, not a Haiku floor.

The 5,000-token limit came from the earlier Sonnet and Gemini harness. Haiku
supports a larger output window. R5 changes only the Haiku output limit and
uses a fresh matched-difficulty cohort.

## Fresh cohort

The `calibration-haiku-r5` cohort has five unique analysis tasks and one named
repeated-prompt sentinel. It keeps the r4 batch-count schedule of 1, 2, 2, 3,
and 3 cases.

The cohort uses seed 12000. Its whole-task and individual-case semantic hashes
have no overlap with the earlier v5 or v6 calibration and validation material.

R5 is a provider-specific settings repair. Retained Gemini and new Haiku use
the same difficulty schedule, but they do not use identical fixtures.

## Cost guard

Before each message request, the harness uses Anthropic's free token-count
endpoint. It rejects a request when the estimated input plus a 128-token
margin exceeds 5,000 tokens.

Each message reserves the maximum possible call cost before inference:

- 5,000 input tokens at USD 1 per million;
- 12,000 output tokens at USD 5 per million; and
- USD 0.065 maximum per call.

The run has at most 12 message requests and 12 free token-count requests. The
hard cost ceiling is USD 0.780000. The harness makes no automatic message
retry. A failed message attempt keeps its full reservation.

## Decision

Retain Gemini's complete 3/5 gate. Return `analysis-repair-pass` only when all
five unique Haiku initial results are scored and Haiku passes 1 through 4.
Return `repair-measurement` for a floor, ceiling, or incomplete result.

The result cannot select a format. A pass restores only the analysis entry
condition beside the retained r2 motif and progression results.

## Offline checks

Run these commands from `brain`:

```sh
python3 -B benchmarks/compact-format-v8/benchmark.py --self-test
python3 -B benchmarks/compact-format-v8/benchmark.py \
  --check benchmarks/compact-format-v8/expected-deterministic.json
```

## Approval and stop boundary

The run ID is `phase8c4b-analysis-haiku-calibration-r5`. The maximum is 12
Haiku message requests, 12 free token-count requests, and USD 0.780000. The
plan authorizes zero Gemini, OpenAI, or Sonnet calls.

The exact r5 run is complete. Do not rerun it. No further Phase 8c4b provider
request is approved.

Combined with retained r2, r5 makes every decision family informative on at
least two providers. Phase 8c4b returns `proceed-development`. Phase 8c4c can
start offline preparation but needs separate provider approval.
