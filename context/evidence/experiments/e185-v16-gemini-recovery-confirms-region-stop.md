---
title: E185 — V16 Gemini recovery confirms region stop
kind: evidence
state: active
updated: 2026-09-29
parent: ../../plan/phase-8/8c4d-follow-up-v16-medium-difficulty-tuning.md
---

# E185 — V16 Gemini recovery confirms region stop

## Verdict

The approved Gemini recovery stopped after its one added attempt. Gemini
returned HTTP 400 with provider status `FAILED_PRECONDITION` and this message:
`User location is not supported for the API use.`

No provider response completed. No row was scored. Recorded cost remains USD
0.000000. The conservative guard now retains two USD 0.054000 failed
reservations, for USD 0.108000 committed cost under the unchanged USD 0.650000
hard limit.

This is an execution-environment failure. It gives no evidence about task
difficulty or format quality.

## Recovery result

| Metric | Value |
|---|---:|
| Planned scientific rows | 66 |
| Recovery attempts | 1 |
| Cumulative attempts | 2 |
| Provider completions | 0 |
| Scored rows | 0 |
| Recorded cost | USD 0.000000 |
| Conservative committed cost | USD 0.108000 |
| HTTP status | 400 |
| Provider status | `FAILED_PRECONDITION` |

The provider error body is 140 bytes. Its SHA-256 is
`9291968278af95b5c1d7e27bb164d09933fbfdfd46b8bb6174e07edb2311f1d7`.

## Artifact identity

| Item | SHA-256 |
|---|---|
| Approved pending supplement | `bbdb93978980882102f9d13870f99cddcd99103744469945576c1e7df71675ec` |
| Recorded approval artifact | `487b9b7f2ff441e9364a1483fc6a910a4c1d071cb6d036dbfc3260c96fc1aae5` |
| Recovered manifest | `1400519effc82405ad33dad4e54955dd521530678a175291c64bb15fdd2da487` |
| Recovered file | `937d87dfc63c77f3833fd140a8da91650e4c746ad66d8f7496685ebeea29d16a` |

The recovery manifest passes its offline validator.

## Interpretation

Google applies Gemini Developer API availability by execution region. Its
published list does not include China. The current environment is in the
Asia/Shanghai timezone, and the provider response directly reports a location
failure. Do not retry this endpoint from the same environment.

A later attempt needs one of these explicit choices:

- run the frozen workload from an authorized environment in a supported
  region; or
- design and freeze a different Gemini provider route.

Either choice needs a new plan and approval. Do not route traffic through an
unapproved proxy or change provider infrastructure implicitly.

## Retrospective

Network preflight must distinguish TCP reachability from provider eligibility.
Future provider runners must retain safe HTTP error details on the first
failure.
