# Phase 8c4c fresh full-family comparison protocol

This comparison tests the three main decision families after the v11 prompt
repair. It can inform the next format decision. It cannot select a public
format or enter holdout by itself.

## Scope

Run these arms on OpenAI, Gemini, and Haiku:

- exact-object JSON;
- positional compact-bar v1; and
- compact-bar with the fixed `FIELDS` declaration.

Use eight fresh unique fixtures for each of these families:

- comprehension analysis;
- motif continuation; and
- progression generation.

Repeat the first fixture once for each arm and family. This produces 81
message requests per provider and 243 in total. Make no repair call and no
automatic retry.

## Measurement separation

Analysis varies the input representation and uses one shared output grammar.
The output contains eight field assignments. A leading legacy `ANALYSIS`
label is optional and ignored. It cannot change syntax or musical scoring.

Progression has no input document. Report its strict syntax and musical
checks separately. Motif uses the tested representation for both input and
output, so report it as a combined task.

Report every provider and family separately. Report strict syntax, strict
full pass, paired discordant results, and repeated-sentinel stability. Do not
pool providers into one format-selection score.

## Freshness

Use generated MIT symbolic text only. The new task and analysis-case hashes
must not overlap prior benchmark artifacts. Do not consume the reserved v10
holdout cohort.

## Cost and approval

| Provider | Maximum messages | Hard limit |
|---|---:|---:|
| OpenAI | 81 | USD 0.650000 |
| Gemini | 81 | USD 0.300000 |
| Haiku | 81 | USD 1.500000 |
| Total | 243 | USD 2.450000 |

Haiku can make at most 81 token-count requests. Record each token-count
attempt before its external request starts. Reserve the token-bound cost
before each message. A failed request is not retried.

No token-count or provider request is approved until the operator approves
the exact protocol and run-plan hashes.
