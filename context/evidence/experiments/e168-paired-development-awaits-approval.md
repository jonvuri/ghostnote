---
title: E168 — Paired development awaits approval
kind: evidence
state: active
updated: 2026-09-28
parent: ../../plan/phase-8/8c4c-compact-bar-paired-development.md
---

# E168 — Paired development awaits approval

## Verdict

The Phase 8c4c offline package passes. Paired development r1 is frozen at the
provider approval gate. Do not make a token-count or provider request until
the operator approves the exact protocol hash, run-plan hash, call limit, and
cost limit.

The new package is
[`compact-format-v10`](../../../brain/benchmarks/compact-format-v10/README.md).
It reuses the repaired v6 contracts and scorers. It does not change v4 through
v9, `normal-v1`, the cache, or a live Bitwig project.

## Fresh paired scope

Development and reserved holdout each contain 44 unique fixtures. Each cohort
has eight fixtures for each decision family and four fixtures for each guard
family. The development run adds nine named sentinels.

The 24-row decision macro has a 4.17 percentage-point step. This meets the
five-point resolution limit. Sentinels do not replace unique fixtures or enter
the effect estimate.

The cohort audit found no task or analysis-case semantic overlap with
calibration, earlier packages, or the other new cohort.

| Cohort | Corpus SHA-256 | Unique fixtures |
|---|---|---:|
| Development | `af2aa7c933ce618b96b882f0f6a2764ab81306247da90b2d2586a6ff7f97e39b` | 44 |
| Reserved holdout | `8a9e5617b79aad8b06e2c9f6f735d87818e14582d9cf3fcbc0261bb642d7bd87` | 44 |

The cohort-manifest SHA-256 is
`ff9a98d46a9d07873eb83a74d5f0f4ac2d4c628753a60ca749f080547d103808`.
The dependency-manifest SHA-256 is
`fbb31617cbe69e79b56e58207984d447f110f75901bf0981b6d3d56397a40ac8`.

## Frozen gates

Every provider uses these numeric gates:

- 0.50 minimum initial decision-macro success;
- 0.05 paired musical margin against exact-object JSON;
- 0.05 paired musical margin for `FIELDS` against positional v1;
- at most one candidate-only loss in a provider and family;
- 0.875 minimum initial syntax and completion for each family;
- 0.25 paired guard-family margin; and
- every deterministic capability and size gate.

`FIELDS` also needs one benefit on at least two providers. A benefit is a 0.05
decision-macro gain, a 0.125 analysis-family gain, fewer framing failures, or
fewer musical losses against exact-object JSON. Development can freeze one
candidate for holdout. It cannot select a public format.

## Calls and cost guard

Each provider has 141 initial requests and at most 48 repair requests. The
maximum is 189 requests per provider and 567 requests in total.

| Provider | Model | Maximum calls | Provider budget |
|---|---|---:|---:|
| OpenAI | `gpt-5.4-mini-2026-03-17` | 189 | USD 1.500000 |
| Gemini | `gemini-3.8-flash` | 189 | USD 0.750000 |
| Haiku | `claude-haiku-4-5-20251001` | 189 | USD 2.750000 |
| Total | — | 567 | USD 5.000000 |

Every request has a 12,000-input-token and 12,000-output-token bound. Haiku
uses the free token-count endpoint with a 128-token margin. The harness does
not retry message requests.

The guard reserves the full token-bound cost of the next request against the
cumulative provider budget. It refuses a request when the reservation does
not fit. It sums exact cost line items and rounds only final aggregate totals.
The offline test detects iterative-rounding drift and asserts that a reported
provider total equals the settled guard total.

## Frozen identities

- protocol SHA-256:
  `0cefdc1606921daa8f4d393675c83e09cc46705ceee2b203f91073b7e323c73e`;
- run-plan SHA-256:
  `e471c8f9ddb742efe6c6368e487a82416c5b74fda4c1dcd6c5244b10cf287a7d`;
- deterministic SHA-256:
  `b41cc9f64c62492ff38c61d72c0ca8ae371a26498fe23a9d522189e50369b91c`.

The pending approval record rejects a provider run before it reads the
credential file. No provider or token-count request occurred in this session.

## Approval boundary

Approval must name the run and exact hashes. It must allow no more than 567
message requests, 189 free Haiku token-count requests, and USD 5.000000.
Phase 8c4b approval does not carry to development.

Phase 8f remains blocked. After a development result freezes one candidate,
the Phase 8c4d plan must state the exact candidate hash, calls, cost, and
stopping rule before holdout approval.

## Retrospective

The first package draft multiplied the full per-call reservation by every
possible call. That arithmetic was correct, but it was not a useful run
budget. Use a cumulative provider budget with per-call preauthorization.
