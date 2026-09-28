# Phase 8c4b Haiku output-limit repair protocol

This calibration repairs the incomplete Haiku r4 measurement. It retains the
eligible Gemini r3 gate and the r2 motif and progression evidence. It is
diagnostic and cannot select a representation.

## Scope

Run Haiku once on the fresh `calibration-haiku-r5` cohort. The cohort has five
unique exact-object analysis tasks and one named repeated-prompt sentinel.
Each task contains an ordered batch of chord groups and motif pairs.

Run all initial tasks before repairs. Each available initial parse or
musical-contract failure receives one repair turn. The repair prompt contains
only the structured diagnostic. Unavailable and failed results do not receive
a repair. Repairs do not enter the primary numerator or denominator.

## Fresh cohort

The cohort uses a new seed and new whole-task and case semantics. It keeps the
r4 easy-tier batch-count schedule of 1, 2, 2, 3, and 3 cases. No task or case
semantic hash overlaps the earlier v5 or v6 calibration and validation
material.

Retain Gemini's eligible r3 gate without a rerun. R5 is a provider-specific
settings repair. Gemini and Haiku use matched difficulty schedules, not
identical fixtures.

## Model and settings

| Provider | Model | Thinking target | Output limit |
|---|---|---:|---:|
| Anthropic | `claude-haiku-4-5-20251001` | 1,024 | 12,000 |

The request does not set temperature or `effort`. Haiku 4.5 uses manual
extended thinking. The thinking target is not a hard cap. The 12,000-token
`max_tokens` value is the hard total-output limit. Structured output uses
`output_config.format`.

Do not retry a message request. A valid low-scoring response also does not
retry.

## Cost guard

Before each message request, call Anthropic's free token-count endpoint with
the same model, thinking, messages, and structured-output configuration. Add a
128-token margin. Reject the request when this value exceeds the 5,000-token
input ceiling.

Reserve USD 0.065 before each message request. This covers 5,000 input tokens
at USD 1 per million and 12,000 output tokens at USD 5 per million. Settle a
successful request to its measured cost. Keep the full reservation after a
failed request.

Stop before a request that would exceed 12 message attempts or USD 0.780000.
The run can make at most 12 free token-count requests. Token counting does not
authorize a message request by itself.

## Decision rule

The retained Gemini result is complete and eligible at 3/5. Haiku must have
five scored unique initial results. A Haiku rate from 0.20 through 0.80 is
eligible.

Return `analysis-repair-pass` only when Haiku is eligible. Return
`repair-measurement` after a floor, ceiling, or incomplete result. Do not make
another provider call under this plan.

## Approval

The run plan fixes the model, settings, fresh cohort, output limit, input
ceiling, token-count margin, cost guard, retained dependencies, repair policy,
stopping rule, call limit, and cost limit. Approval does not carry to a changed
value or hash. No token-count or message request can occur while the approval
record is pending.
