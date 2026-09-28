---
title: E163 — Haiku r4 is incomplete under extended thinking
kind: evidence
state: active
updated: 2026-09-28
parent: ../../plan/phase-8/8c4b-focused-compact-calibration.md
---

# E163 — Haiku r4 is incomplete under extended thinking

## Verdict

Return `repair-measurement` and stop provider work. Haiku produced scored
initial results for only two of five unique tasks. Neither passed. Three calls
used the full output allowance without an answer, so Haiku is incomplete and
not at a measured floor.

The retained
[report](../../../brain/benchmarks/compact-format-v7/runs/2026-09-28-analysis-report.md)
and
[summary](../../../brain/benchmarks/compact-format-v7/runs/2026-09-28-analysis-summary.json)
record the result. The summary SHA-256 is
`179ce1c88360939c4f015edca634e4a945189701595d5864bf12d17126b45315`.

## Result

| Provider | Unique initial result | Complete | Gate |
|---|---:|---:|---|
| Gemini | 3/5 | yes | eligible |
| Haiku | 0/2 scored | no | incomplete |

Haiku variants 1, 3, and 5 stopped at the 5,000-token output limit. Variant 2
omitted the required prefix. Variant 4 failed the rhythm check. The two repair
calls did not pass and do not enter the initial gate.

The variant 1 unique call and named sentinel used the same prompt hash. The
unique call reached the output limit without an answer. The sentinel passed
all checks. The approved setting therefore did not give a stable complete
sample.

## Usage

| Calls | Input tokens | Output tokens | Thinking tokens | Mean latency | Cost |
|---:|---:|---:|---:|---:|---:|
| 8 | 13,300 | 27,101 | 26,624 | 42.221 s | USD 0.148805 |

The API reported 98.2 percent of output tokens as thinking. Three calls used
5,000 thinking tokens and returned no answer. The requested and returned model
was `claude-haiku-4-5-20251001`. No retry occurred.

The run stayed within the approved 12 calls and USD 0.188385. No Gemini,
OpenAI, or Sonnet call occurred. The provider manifest SHA-256 is
`27d3741d079cdaaca792f69d06fa5cd3765c6313445cff74c451192cf01ffb2d`.
The raw-run SHA-256 is
`c6566aa177c4df12adc78e88a7bc8ba488a22a30d3168702a79b95cbb45aa316`.

## Consequence

The retained Gemini result cannot combine with incomplete Haiku evidence.
The retained r2 motif and progression results do not restore the analysis
entry condition. Phase 8c4c and Phase 8f remain blocked. Do not select a
format.

Any further provider work needs a new package, cohort, protocol, run plan, and
approval. The plan must freeze a changed Anthropic generation setting before
it sees new results.

## Cost-control finding

The r4 estimate repriced an observed Sonnet call. It did not price all calls at
the 5,000-token output limit. The harness did not enforce accumulated cost
during the run. Actual spend stayed within approval, but this method is not a
safe future cost ceiling.

A future harness must estimate the maximum token-bound cost and stop before a
conditional call can exceed the approved total.

## Retrospective

Do not use an observed-call reprice as a hard cost ceiling when a model can
consume the full output limit in hidden reasoning. Add live accumulated-cost
enforcement before the next provider run.

## Follow-up

The operator selected a 12,000-token output limit with the 1,024-token thinking
target unchanged. [E164](e164-haiku-output-limit-repair-awaits-approval.md)
records the fresh cohort, token-count preflight, live cost guard, and frozen r5
approval boundary.
