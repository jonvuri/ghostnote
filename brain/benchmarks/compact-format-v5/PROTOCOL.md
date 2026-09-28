# Phase 8c4b calibration r2 protocol

Calibration uses the same semantic fixture for all three arms. It is
diagnostic. It cannot select a representation.

This protocol uses a new cohort. It does not reuse a v4 calibration fixture.
Each document-output prompt states the exact output-context values that the
scorer requires. The deterministic suite checks prompt visibility. Motif uses
a six-note compound pitch-and-time operation. Progression uses three-class
chords and a movement limit of 54.

## Scope

Each provider receives 60 unique initial jobs and 9 named repeated-prompt
sentinels. The unique jobs contain five fixtures for each decision family and
one fixture for each guard family. The decision families are analysis, motif,
and progression.

The repeated jobs are nondeterminism sentinels. They do not replace a unique
fixture and do not enter the family eligibility rate.

Each available initial parse or musical-contract failure receives one repair
turn. The repair prompt includes only a structured diagnostic. Unavailable and
failed results do not receive a repair. The maximum is 138 calls per provider.

## Models and settings

| Provider | Model | Setting | Output limit |
|---|---|---|---:|
| OpenAI | `gpt-5.4-mini-2026-03-17` | Low reasoning | 5,000 |
| Gemini | `gemini-3.8-flash` | Low thinking | 5,000 |
| Claude | `claude-sonnet-5` | Low effort | 5,000 |

The requests use each provider's default temperature. A valid low-scoring
response does not retry. The transport retries only a rate limit, network
failure, or provider-server failure.

Before the first provider call, the harness requires non-empty environment values
for all three provider credential names. This preflight prevents a partial
provider run caused by a missing credential.

## Eligibility and stopping

For each provider and decision family, use the initial exact-object results.
The family is informative on that provider when its pass rate is from 0.20
through 0.80, inclusive. Each family must be informative on at least two
providers.

Return `proceed-development` only when every decision family meets that rule
and every unique initial result has a scored state. Return
`repair-measurement` otherwise. A repaired result does not change the initial
rate.

## Capability and size gates

All deterministic document and patch checks must pass. The `FIELDS` document
can use at most 1.30 times the positional document bytes and 1.15 times its
estimated prompt tokens on the fixed capability fixture. Each compact document
can use at most 0.75 times the exact-object document bytes.

These are offline budget gates. Provider-measured input tokens and output bytes
remain separate results.

## Approval

The run-plan JSON fixes the models, settings, output limits, corpus hash,
protocol hash, call limits, repair policy, stopping rule, and maximum estimated
cost. Approval does not carry to a changed value or hash. Development needs a
new plan and separate approval.
