---
title: E145 — Progression repair passes and development freezes
kind: evidence
state: active
updated: 2026-09-27
parent: ../../plan/phase-8/8c2-2-measurement-repair-and-grouped-compact-iteration.md
---

# E145 — Progression repair passes and development freezes

## Verdict

The bounded progression repair passes the frozen calibration rule. Return
`proceed-development`. This result approves the measurement for development.
It does not select `grouped-label-compact` or authorize development calls.

A separate paired development plan is frozen. It waits for explicit operator
approval.

## Repair calibration

The completed run ID is
`phase8c2-2-progression-repair-calibration-r2`. All three providers completed
20/20 calls without transport errors or response repairs. Every response
reports the requested model.

The frozen rule pools exact JSON and native MIDI-Like within each provider.
Progression must score from 0.20 through 0.90 on at least two providers. It is
eligible on all three providers.

| Provider | Control pool | Eligible | Compact bar | Label-only | Grouped label |
|---|---:|---|---:|---:|---:|
| OpenAI | 2/8, 0.250 | yes | 0/4 | 1/4 | 2/4 |
| Gemini | 5/8, 0.625 | yes | 3/4 | 1/4 | 0/4 |
| Claude | 4/8, 0.500 | yes | 1/4 | 3/4 | 1/4 |

These four-fixture arm results are diagnostic. Calibration has no format
selection authority. The grouped arm variation is one reason to require the
larger paired development sample.

The summary SHA-256 is
`bc606011893faef8167d96711c4080e608d052595d298cb1d15a66f00203371f`.
The protocol SHA-256 remains
`31693cf6c5f4b5d2141bbe22796886be7c036c3461ee4be6a62c2332a83e2327`.

## Cost

| Provider | Approved estimate | Recorded cost | Calls |
|---|---:|---:|---:|
| OpenAI | USD 0.115476 | USD 0.106379 | 20 |
| Gemini | USD 0.073372 | USD 0.071462 | 20 |
| Claude | USD 0.408460 | USD 0.486306 | 20 |
| Total | USD 0.597308 | USD 0.664147 | 60 |

Claude was USD 0.077846 above its estimate. The total was USD 0.066839 above
the estimate. The operator should compare the recorded values with the
provider dashboards.

## Run identities

| Provider | Raw-run SHA-256 | Manifest SHA-256 |
|---|---|---|
| OpenAI | `258be137708501e1b87000851b6afa239c2986a344ad88766d8e43b11e5a33ba` | `bcf8d1f6c1db6860d6de09244842d9675a732456a215c9884ffed370d04ea299` |
| Gemini | `c0c67f51ad2fffe25be53e699e24878a3cc8758f2f3888c7dea8cda85e3b6790` | `346e2cbab8f411e0a5127fe0a7bb8a391f54f0742688eb9b1671ac15958a374c` |
| Claude | `c3121951b9a5d79bee5dd624282efbc9afc939d484ca0f4e667a8f4b0321e731` | `170544854498ebf6bc81894b286c18f3462489c6f7f75f21bc3563e3db19d5a3` |

## Development freeze

The development run ID is `phase8c2-2-grouped-development-r1`. It uses the
unchanged five arms, three decision families, one regression family, and four
guard families. Each decision family has eight fixtures. Each other family
has four fixtures. This gives 44 calls per arm and 220 calls per provider.

The wrapper replaces the unused development and holdout progression fixtures
with fresh triad tasks and explicit full-coverage wording. Its offline check
also found that the unused melody regression fixtures did not list the strong
beats for their fractional grids correctly. The wrapper corrects those
fixture contracts before provider use. It does not change the candidate,
parser, renderer, or scorer.

The development and reserved holdout cohorts each contain 44 fixtures. They
have no fixture or semantic overlap with each other or with prior cohorts. The
offline package passes 532 checks.

| Provider | Model | Settings | Calls | Estimated cost |
|---|---|---|---:|---:|
| OpenAI | `gpt-5.4-mini-2026-03-17` | low reasoning, 3,000 maximum completion tokens | 220 | USD 1.462711 |
| Gemini | `gemini-3.8-flash` | low thinking, 3,000 maximum output tokens | 220 | USD 0.982603 |
| Claude | `claude-sonnet-5` | low effort, 3,000 maximum tokens | 220 | USD 6.686708 |
| Total | — | provider default temperature | 660 | USD 9.132022 |

The estimate uses each provider's recorded repair-calibration mean call cost
and adds 25 percent.

The frozen identifiers are:

- protocol SHA-256:
  `193148ede3e97e8c8143d48d5944a026517daa3cc227ec3f6725714f7d33ace2`;
- development corpus SHA-256:
  `630fb0f37db601aba8caf5f13a0835a0b082ca3d6bc9ff2a714a5357b1bac69d`;
- reserved holdout corpus SHA-256:
  `c9080094b61653fe937999a06b9ed4f5f9b6b9d4f3484ac5c0f02b6c52375bf8`;
- run-plan SHA-256:
  `07860eb0599542444ee5ae4a8427aa871bf8746b9bbb2504a59ffe2c284fe414`;
  and
- deterministic SHA-256:
  `0b90b00b64f0630d2052e8e792e2f85747bc5878b0f6c9ac940ab5a0a31fb444`.

The grouped candidate must improve the paired 24-fixture decision macro over
compact-bar v1 by at least 5 points on at least two providers. It cannot lose
more than 5 points on another provider. Each provider and family permits at
most one grouped-only loss against compact-bar v1. The guard, syntax,
efficiency, and deterministic capability gates in the run plan must also
pass. A pass returns `freeze-holdout`. A failure returns
`stop-custom-compact`.

The operator later gave conditional development approval for OpenAI and Gemini
first. [E146](e146-grouped-development-stops-before-claude.md) records the new
issue and the stop before Claude. A later holdout still needs a new plan and
approval.

## Retrospective

The calibration repair moved progression out of the control floor without a
candidate change. The next offline freeze found a separate regression-fixture
contract error before paid calls. Run reference answers for every future
cohort, not only the calibration cohort.
