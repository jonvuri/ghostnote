# Phase 8c4b Haiku provider-substitution protocol

This calibration replaces the mismatched Sonnet 5 evaluator with Haiku 4.5.
It retains the frozen eligible Gemini r3 result and the frozen r2 motif and
progression evidence. It is diagnostic and cannot select a representation.

## Scope

Run Haiku once on the unchanged v6 `calibration-easy` cohort. The cohort has
five unique exact-object analysis tasks and one named repeated-prompt
sentinel. Each task contains an ordered batch of chord groups and motif pairs.

Each available initial parse or musical-contract failure receives one repair
turn. The repair prompt contains only the structured diagnostic. Unavailable
and failed results do not receive a repair. Repairs do not enter the primary
numerator or denominator.

## Cohort reuse

The usual fresh-cohort rule prevents task tuning after provider feedback. This
run makes one narrow exception for a new model that has not received the
cohort. The prompt, fixtures, scorer, repair rule, and eligibility band remain
byte-for-byte frozen.

This reuse supplies a direct comparison with Gemini. It does not permit a
Gemini or Sonnet rerun. The harness checks every prompt hash against the
retained Gemini manifest before it reads a credential.

## Model and settings

| Provider | Model | Thinking | Output limit |
|---|---|---|---:|
| Anthropic | `claude-haiku-4-5-20251001` | Manual, 1,024 tokens | 5,000 |

The request does not set temperature or `effort`. Haiku 4.5 uses manual
extended thinking. Structured output uses `output_config.format`.

A valid low-scoring response does not retry. Transport retries only a rate
limit, network failure, or provider-server failure.

## Decision rule

The retained Gemini result is complete and eligible at 3/5. Haiku must have
five scored unique initial results. A Haiku rate from 0.20 through 0.80 is
eligible.

Return `analysis-repair-pass` only when Haiku is eligible. Return
`repair-measurement` after a floor, ceiling, or incomplete result. Do not make
another provider call under this plan.

## Call and cost limits

Haiku has six initial calls and at most six repair calls. The maximum is 12
calls. Gemini, OpenAI, and Sonnet each have zero new calls.

The cost ceiling reprices the maximum observed r3 Sonnet easy-tier call at
Haiku 4.5 rates, then adds 25 percent across the maximum call count. The
maximum is USD 0.188385.

## Approval

The run plan fixes the model, settings, output limit, retained dependencies,
cohort, prompt hashes, repair policy, stopping rule, call limit, and cost
limit. Approval does not carry to a changed value or hash. No provider call
can occur while the approval record is pending.
