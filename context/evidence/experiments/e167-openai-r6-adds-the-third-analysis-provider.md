---
title: E167 — OpenAI r6 adds the third analysis provider
kind: evidence
state: active
updated: 2026-09-28
parent: ../../plan/phase-8/8c4b-focused-compact-calibration.md
---

# E167 — OpenAI r6 adds the third analysis provider

## Verdict

Return `add-openai-third-provider`. OpenAI is complete and informative at 1/5
on the repaired analysis measurement. Gemini remains eligible at 3/5, and
Haiku remains eligible at 1/5.

The retained
[report](../../../brain/benchmarks/compact-format-v9/runs/2026-09-28-analysis-report.md)
and
[summary](../../../brain/benchmarks/compact-format-v9/runs/2026-09-28-analysis-summary.json)
record the result. The summary SHA-256 is
`86a23a942b0c943c2308e9c0035be88f85113c7c235c0370a074e0deab6fb0f2`.

## Result

| Provider | Unique initial result | Complete | Gate |
|---|---:|---:|---|
| OpenAI | 1/5 | yes | eligible |
| Gemini | 3/5 | yes | eligible |
| Haiku | 1/5 | yes | eligible |

OpenAI passed variant 2. The other four unique initial tasks failed one or
more musical checks. All six initial responses parsed, including the sentinel.
No result was unavailable or failed.

OpenAI and Haiku used identical fixtures. Gemini used the matched-difficulty
r3 cohort. The three scores are provider gates, not one pooled
identical-fixture estimate.

## Sentinel and repair

The variant 1 unique task and sentinel returned the exact same initial payload.
Both failed only motif relation. This repeated-prompt result was stable.

Five failures received one repair. The unique variant 1 repair passed. The
other four repairs remained musical-contract failures. Repairs do not enter
the primary gate.

## Usage

| Calls | Input tokens | Output tokens | Reasoning tokens | Cost |
|---:|---:|---:|---:|---:|
| 11 | 14,611 | 8,449 | 7,459 | USD 0.047251 |

The run used 11 of 12 approved requests and 6.4 percent of the USD 0.738000
cost ceiling. The requested and returned model was
`gpt-5.4-mini-2026-03-17`. No request retried. No Gemini, Haiku, or Sonnet call
occurred.

The OpenAI manifest SHA-256 is
`1ef50f195f33bcd87349cf68cd03ead2cf82134a7271db7a5b914df37207cf57`.
The raw-run SHA-256 is
`564a99683a03ebf0156d9e3bf6a1d7b4a9411e5bbb0388feb12f7324deeb1784`.

## Accounting note

The per-call API records sum to USD 0.04725075. The manifest and guard
committed total round to USD 0.047251. The separately rounded settled counter
is USD 0.047249. This USD 0.000002 difference is a running-rounding artifact.
It does not affect authorization or the gate. The next harness must sum exact
line items before one final rounding step.

The operator owns the separate provider-dashboard comparison.

## Consequence

Phase 8c4b remains complete with `proceed-development`, now with three eligible
analysis providers. Phase 8c4c can resume offline preparation for OpenAI,
Gemini, and Haiku. It still needs a fresh development corpus, frozen gates, a
run plan, and separate approval before provider calls.

## Retrospective

The exact fixture reuse added a direct OpenAI-to-Haiku check for only 11 calls.
Add an exact aggregate-cost reconciliation assertion before the Phase 8c4c
approval gate.
