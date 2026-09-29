---
title: E181 — V15 validity ladder is incomplete
kind: evidence
state: active
updated: 2026-09-28
parent: ../../plan/phase-8/8c4d-follow-up-v15-validity-ladder.md
---

# E181 — V15 validity ladder is incomplete

## Verdict

The frozen v15 summary returns `invalid`. OpenAI and Claude Haiku completed
108/108 messages. Gemini stopped safely at 69/108 because its next maximum
cost reservation would exceed the frozen USD 0.550000 provider limit.

The run made no retry or repair call. No response was unavailable. Total cost
was USD 3.227840 against the USD 6.350000 overall hard limit.

The result does not authorize Phase 8c4e. The operator can accept the explicit
Gemini evidence limit, approve a frozen continuation supplement, or stop.

## Operational result

| Provider | Completed | Scored | Failed | Unavailable | Budget stop | Cost, USD |
|---|---:|---:|---:|---:|---:|---:|
| OpenAI | 108/108 | 108 | 0 | 0 | 0 | 0.708237 |
| Gemini | 69/108 | 69 | 1 | 0 | 1 | 0.499339 |
| Claude Haiku | 108/108 | 108 | 0 | 0 | 0 | 2.020264 |
| **Total** | **285/324** | **285** | **1** | **0** | **1** | **3.227840** |

Gemini's 69 completed calls cost USD 0.499339. The next frozen maximum-call
reservation was USD 0.054000. Their sum exceeded the USD 0.550000 provider
limit, so the harness made no seventieth request.

Haiku completed every message with 4,096 thinking tokens and a 24,000-token
total ceiling. This closes the v14 output-limit concern for this cohort and
setting.

## Component result

The complete OpenAI and Haiku results are strong and non-perfect for every
format.

| Provider | Global components | Global accuracy | Average case accuracy | Perfect cases |
|---|---:|---:|---:|---:|
| OpenAI | 3,341/3,396 | 98.38% | 98.48% | 441/462 (95.45%) |
| Gemini, partial | 2,148/2,148 | 100.00% | 100.00% | 291/291 (100.00%) |
| Claude Haiku | 3,322/3,396 | 97.82% | 97.89% | 430/462 (93.07%) |

| Provider | Format | Global accuracy | Average case accuracy | Perfect cases |
|---|---|---:|---:|---:|
| OpenAI | `FIELDS` | 98.76% | 98.81% | 147/154 (95.45%) |
| OpenAI | Local labels | 98.76% | 98.86% | 149/154 (96.75%) |
| OpenAI | Exact JSON | 97.61% | 97.75% | 145/154 (94.16%) |
| Claude Haiku | `FIELDS` | 97.53% | 97.73% | 146/154 (94.81%) |
| Claude Haiku | Local labels | 98.06% | 98.05% | 144/154 (93.51%) |
| Claude Haiku | Exact JSON | 97.88% | 97.89% | 140/154 (90.91%) |

Gemini's completed subset was perfect in every observed format and difficulty
cell. Do not treat it as a complete provider result or infer that later cells
would also be perfect.

OpenAI and Haiku both lost more analysis accuracy on selected one-case and
four-case fixtures than on the combined moderate tier. Thus the density ladder
exposed useful failures, but case count alone did not create a monotonic
difficulty scale. Literal serialization was effectively a ceiling guard.

## Validity audit

The summary loader validated every manifest identity, approval, schedule,
model, setting, ordinal, cost line item, payload, and score. It reproduced all
285 retained scores from the raw payloads. Reference-answer inspection of the
repeated OpenAI chord failures confirmed the frozen pitch-class, quality,
inversion, and function components.

No scoring, prompt-visibility, affine-expression, JSON-framing, Haiku output,
or cross-format balance defect was found. The one validity failure was the
underestimated Gemini medium-reasoning provider cap.

## Identity

| Artifact | SHA-256 |
|---|---|
| OpenAI raw run | `4cb438daae9b6cb042f1314b6bc63ab6b95292f88609f92abb7eb806fb67d779` |
| OpenAI manifest | `52851299dfd70918b744476752d095d2d2fdb49267fb9dee64ddb9f4ff975503` |
| Gemini raw run | `b73d99260ff112ca2c266ce5be3bbf7298920ab8a63e4974342728dd10854521` |
| Gemini manifest | `2e96858b12bd42bc193b6f8a8df182a24797f850e81d017821705726b43adc3c` |
| Haiku raw run | `89c11578e45ce2af4e09c8539fb570bfa2a8b2196617e6a6c67372d8641157c3` |
| Haiku manifest | `e8f2e02e04885f00881f7a1d3c893a3f1844b53d9ba0d25289e52cb2f01218a8` |
| Summary | `66242e305c0d1b20afa2667cb818c2e0fd06f8256e936a2f7c9d819c4ae54781` |

## Retrospective

The recent-cost estimate fit the total run but not Gemini's medium-reasoning
provider allocation. A continuation plan must use measured v15 Gemini cost and
reserve the next maximum call without rerunning the 69 completed rows.
