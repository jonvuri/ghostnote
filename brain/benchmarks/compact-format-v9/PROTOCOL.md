# Phase 8c4b OpenAI analysis supplement protocol

This run checks OpenAI on the repaired analysis measurement. It is a
supplement to the complete r5 calibration. It cannot change the r5 decision or
select a representation.

## Scope

Run OpenAI once on the exact r5 cohort. The cohort has five unique exact-object
analysis tasks and one named repeated-prompt sentinel. OpenAI has not seen
these tasks in an earlier run.

Run all initial tasks before repairs. Each available initial parse or
musical-contract failure receives one repair turn. The repair prompt contains
only the structured diagnostic. Unavailable and failed results do not receive
a repair. Repairs do not enter the primary numerator or denominator.

## Reused measurement

Reuse the r5 corpus, prompt builder, exact-object schema, scorer, component
checks, repair policy, sentinel, task order, and eligibility band. Do not
generate a replacement cohort.

OpenAI and Haiku use identical fixtures. Gemini retains its matched-difficulty
r3 result. This comparison limit must remain explicit.

## Model and settings

| Provider | Model | Reasoning | Output limit |
|---|---|---:|---:|
| OpenAI | `gpt-5.4-mini-2026-03-17` | low | 12,000 |

The request uses Chat Completions and strict structured output. It does not set
temperature. The model snapshot, endpoint, reasoning setting, structured
output support, and prices are confirmed by the
[official OpenAI model page](https://developers.openai.com/api/docs/models/gpt-5.4-mini).

Do not retry a message request. A valid low-scoring response also does not
retry.

## Cost guard

Reject a serialized request above 9,000 bytes. Reserve 10,000 input tokens and
12,000 output tokens before each request. The input reservation is larger than
the complete serialized request and includes a structural margin.

Use USD 0.75 per million input tokens, USD 0.075 per million cached input
tokens, and USD 4.50 per million output tokens. Reserve USD 0.061500 per
request. Settle a successful request to its measured cost. Keep the full
reservation after a failed request.

Stop before a request that would exceed 12 message attempts or USD 0.738000.
This run makes no token-count request.

## Decision rule

OpenAI must have five scored unique initial results. A rate from 0.20 through
0.80 is eligible.

Record OpenAI as a third eligible analysis provider only when it is eligible.
Otherwise, retain the completed two-provider r5 decision. R6 cannot reopen
Phase 8c4b or select a compact arm.

## Approval

The run plan fixes the model, settings, reused cohort, output limit, request
byte ceiling, input reservation, cost guard, repair policy, stopping rule,
call limit, and cost limit. Approval does not carry to a changed value or hash.
No OpenAI request can occur while the approval record is pending.
